// @ts-check
import { spawnSync } from "node:child_process";
import {
  appendFileSync,
  chmodSync,
  cpSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  rmSync,
  statSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

const PARENT_DIR = "../..";

export const REPO_ROOT = path.resolve(import.meta.dirname, PARENT_DIR);

const CHECK_SCRIPT = ".github/scripts/check.mjs";
const COPY_PREFIX = "ae-test-";
const GIT_LIST_ARGS = ["ls-files", "--cached", "--others", "--exclude-standard"];
const TEXT_ENCODING = "utf8";

/** @typedef {Record<string, any>} JsonObject */

/**
 * @typedef {object} RunResult
 * @property {number} code
 * @property {string[]} lines
 */

/**
 * @typedef {object} TreeCopy
 * @property {string} root
 * @property {(rel: string) => boolean} exists
 * @property {(rel: string, content: string) => void} write
 * @property {(rel: string, text: string) => void} append
 * @property {(rel: string) => void} remove
 * @property {(rel: string, pattern: string | RegExp, replacement: string) => void} replace
 * @property {(rel: string, drop: (line: string) => boolean) => void} dropLines
 * @property {(rel: string, mutate: (json: JsonObject) => void) => void} editJson
 * @property {(rel: string) => void} removeMarkdownUnder
 */

function listedFiles() {
  const listed = spawnSync("git", GIT_LIST_ARGS, { cwd: REPO_ROOT, encoding: TEXT_ENCODING });
  if (listed.status !== 0) {
    throw new Error(`git ls-files failed with status ${listed.status}`);
  }
  return listed.stdout.split("\n").filter((file) => file !== "");
}

function copyListedFiles(destination) {
  for (const file of listedFiles()) {
    const source = path.join(REPO_ROOT, file);
    if (!existsSync(source)) continue;
    const target = path.join(destination, file);
    mkdirSync(path.dirname(target), { recursive: true });
    cpSync(source, target);
  }
}

function markdownFiles(dir) {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) return markdownFiles(full);
    return entry.name.endsWith(".md") ? [full] : [];
  });
}

/** @returns {TreeCopy} */
function toCopy(root) {
  const abs = (rel) => path.join(root, rel);
  const read = (rel) => readFileSync(abs(rel), TEXT_ENCODING);
  const write = (rel, content) => {
    mkdirSync(path.dirname(abs(rel)), { recursive: true });
    writeFileSync(abs(rel), content);
  };
  return {
    root,
    exists: (rel) => existsSync(abs(rel)),
    write,
    append(rel, text) {
      const current = existsSync(abs(rel)) ? read(rel) : "";
      const separator = current === "" || current.endsWith("\n") ? "" : "\n";
      mkdirSync(path.dirname(abs(rel)), { recursive: true });
      appendFileSync(abs(rel), `${separator}${text}\n`);
    },
    remove: (rel) => rmSync(abs(rel), { recursive: true, force: true }),
    replace(rel, pattern, replacement) {
      const before = read(rel);
      const after =
        typeof pattern === "string"
          ? before.replaceAll(pattern, replacement)
          : before.replace(pattern, replacement);
      if (after === before) throw new Error(`fault did not change ${rel}`);
      write(rel, after);
    },
    dropLines(rel, drop) {
      const kept = read(rel)
        .split("\n")
        .filter((line) => !drop(line));
      write(rel, kept.join("\n"));
    },
    editJson(rel, mutate) {
      const json = JSON.parse(read(rel));
      mutate(json);
      write(rel, `${JSON.stringify(json, null, 2)}\n`);
    },
    removeMarkdownUnder(rel) {
      for (const file of markdownFiles(abs(rel))) rmSync(file);
    },
  };
}

/**
 * Copies the git-listed tree into a fresh temp dir that `t.after` removes.
 * @param {import("node:test").TestContext} t
 * @returns {TreeCopy}
 */
export function createCopy(t) {
  const root = mkdtempSync(path.join(tmpdir(), COPY_PREFIX));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  copyListedFiles(root);
  return toCopy(root);
}

export function splitLines(stdout) {
  return stdout === "" ? [] : stdout.replace(/\n$/, "").split("\n");
}

/**
 * @param {string} file
 * @param {string[]} args
 * @param {string} cwd
 * @param {NodeJS.ProcessEnv} [env]
 * @returns {RunResult}
 */
export function runCommand(
  file,
  args,
  cwd,
  env = process.env,
) {
  const run = spawnSync(file, args, { cwd, env, encoding: TEXT_ENCODING });
  if (run.status === null) {
    throw new Error(`${file} did not exit normally: ${run.signal ?? run.error?.message}`);
  }
  return { code: run.status, lines: splitLines(run.stdout) };
}

/**
 * Runs the check script with cwd at the copy.
 * @param {string} cwd
 * @returns {RunResult}
 */
export function runCheck(cwd) {
  return runCommand(process.execPath, [CHECK_SCRIPT], cwd);
}

const STUB_FILE_MODE = 0o755;
const STUB_SHEBANG = "#!/usr/bin/env node";
const PATH_SEPARATOR = path.delimiter;

/**
 * @typedef {"allfail" | "install-fails" | "partial" | "full" | "block" | "stubborn" | "bigfail" | "shipdev"} StubMode
 */

/**
 * @typedef {object} StubOptions
 * @property {"claude" | "codex"} host
 * @property {StubMode} mode
 * @property {string} repoRoot
 * @property {string} recordFile
 * @property {string} [signalDir] Directory for the ready file the `block` and `stubborn` modes
 *   write their pid to.
 */

/**
 * Returns the first executable file called `name` in the `PATH`-style list, if any.
 * @param {string} name
 * @param {string | undefined} pathList
 * @returns {string | undefined}
 */
export function resolveOnPath(name, pathList) {
  for (const dir of (pathList ?? "").split(PATH_SEPARATOR)) {
    if (dir === "") continue;
    const candidate = path.join(dir, name);
    if (existsSync(candidate) && statSync(candidate).isFile()) return candidate;
  }
  return undefined;
}

const OPTIONS_PLACEHOLDER = "__OPTIONS__";

const STUB_BODY = String.raw`
const fs = require("node:fs");
const path = require("node:path");
const options = __OPTIONS__;
const configDir = process.env[options.configVar];
const args = process.argv.slice(2);
fs.appendFileSync(options.recordFile, JSON.stringify({ args, configDir }) + "\n");

function installSkills(skills) {
  const manifest = JSON.parse(fs.readFileSync(path.join(options.repoRoot, "plugins", "ae", "plugin.json"), "utf8"));
  for (const skill of skills) {
    const dir = path.join(configDir, "plugins", "cache", options.marketplace, options.plugin,
      manifest.version, "skills", skill);
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(path.join(dir, "SKILL.md"), "# " + skill + "\n");
  }
  if (options.mode === "shipdev") {
    const root = path.join(configDir, "plugins", "cache", options.marketplace, options.plugin,
      manifest.version);
    fs.mkdirSync(path.join(root, ".github", "workflows"), { recursive: true });
    fs.mkdirSync(path.join(root, "evals"), { recursive: true });
  }
}

function say(text) {
  fs.writeSync(1, text);
}

function failWithOutput() {
  say(options.marker + "\n");
  process.exit(1);
}

function failWithBigOutput() {
  const filler = "x".repeat(options.fillerLineLength) + "\n";
  for (let written = 0; written < options.bigOutputBytes; written += filler.length) say(filler);
  failWithOutput();
}

// Records its pid, then waits. block exits a little after SIGTERM, stubborn ignores it.
function blockUntilStopped() {
  fs.writeFileSync(path.join(options.signalDir, options.readyName), String(process.pid));
  process.on("SIGTERM", () => {
    if (options.mode === "block") setTimeout(() => process.exit(0), options.sigtermDelayMs);
  });
  setTimeout(() => process.exit(1), options.blockLimitMs);
}

const isMarketplace = args[0] === "plugin" && args[1] === "marketplace";
const isInstall = args.slice(0, 2).join(" ") === options.installWords;
const waits = options.mode === "block" || options.mode === "stubborn";

function run() {
  if (options.mode === "allfail") failWithOutput();
  if (options.mode === "bigfail") failWithBigOutput();
  if (isMarketplace) {
    if (waits) return blockUntilStopped();
    process.exit(0);
  }
  if (!isInstall) process.exit(1);
  if (options.mode === "install-fails") failWithOutput();
  if (options.mode === "partial") {
    say(options.marker + "\n");
    installSkills(options.partialSkills);
  } else if (options.mode === "full" || options.mode === "shipdev") {
    installSkills(options.fullSkills);
  } else {
    process.exit(1);
  }
  process.exit(0);
}

run();
`;

export const STUB_READY_NAME = "stub-ready";
export const STUB_LOG_MARKER = "stub-log-end-marker";
const STUB_SIGTERM_DELAY_MS = 500;
const STUB_FILLER_LINE_LENGTH = 99;
const STUB_BIG_OUTPUT_BYTES = 80_000;
const STUB_BLOCK_LIMIT_MS = 30_000;
const STUB_MARKETPLACE = "amplifiedengineer";
const STUB_PLUGIN = "ae";
const STUB_PARTIAL_SKILLS = ["plan", "implement", "research", "commit-and-pr", "writing-style", "engineering-standards"];
const STUB_FULL_SKILLS = ["plan", "implement", "research", "review", "commit-and-pr", "writing-style", "engineering-standards"];
const STUB_HOSTS = {
  claude: { configVar: "CLAUDE_CONFIG_DIR", installWords: "plugin install" },
  codex: { configVar: "CODEX_HOME", installWords: "plugin add" },
};

/**
 * Writes a Node stub CLI named after the host into `binDir`. It appends its argv and config
 * dir to `recordFile`, prints the log marker (after filler in `bigfail`) in the failing modes,
 * and otherwise behaves according to `mode`.
 * @param {string} binDir
 * @param {StubOptions} stub
 */
export function writeStubCli(binDir, stub) {
  const options = {
    ...STUB_HOSTS[stub.host],
    mode: stub.mode,
    repoRoot: stub.repoRoot,
    recordFile: stub.recordFile,
    signalDir: stub.signalDir,
    readyName: STUB_READY_NAME,
    blockLimitMs: STUB_BLOCK_LIMIT_MS,
    sigtermDelayMs: STUB_SIGTERM_DELAY_MS,
    marker: STUB_LOG_MARKER,
    fillerLineLength: STUB_FILLER_LINE_LENGTH,
    bigOutputBytes: STUB_BIG_OUTPUT_BYTES,
    marketplace: STUB_MARKETPLACE,
    plugin: STUB_PLUGIN,
    partialSkills: STUB_PARTIAL_SKILLS,
    fullSkills: STUB_FULL_SKILLS,
  };
  const body = STUB_BODY.replace(OPTIONS_PLACEHOLDER, () => JSON.stringify(options));
  const file = path.join(binDir, stub.host);
  writeFileSync(file, `${STUB_SHEBANG}\n${body}`);
  chmodSync(file, STUB_FILE_MODE);
}
