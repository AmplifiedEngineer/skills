// @ts-check
/**
 * End-to-end install test: adds this repo as a local marketplace in a throwaway config
 * folder per host, installs the plugin and checks all skills arrived.
 *
 * Usage: node .github/scripts/smoke-install.mjs [claude] [codex] [--keep]. Silent on success.
 * Requires the CLI of each requested host.
 */
import { spawn } from "node:child_process";
import {
  accessSync,
  closeSync,
  constants,
  existsSync,
  mkdtempSync,
  openSync,
  readdirSync,
  readFileSync,
  rmSync,
  statSync,
  writeSync,
} from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const HOST_SPECS = {
  claude: { configVar: "CLAUDE_CONFIG_DIR", installWords: "plugin install" },
  codex: { configVar: "CODEX_HOME", installWords: "plugin add" },
};
const HOSTS_ALL = ["claude", "codex"];
const KEEP_FLAG = "--keep";
const MARKETPLACE = "amplifiedengineer";
const PLUGIN = "ae";
const MARKETPLACE_ADD_WORDS = "plugin marketplace add";
const SKILL_NAMES = ["plan", "implement", "research", "review", "commit-and-pr", "writing-style", "engineering-standards"];
const SKILL_FILE = "SKILL.md";
const MANIFEST = "plugins/ae/plugin.json";
const LOG_NAME = "smoke.log";
const TMP_PREFIX = "ae-smoke.";
const CACHE_DIR = "plugins/cache";
const SKILLS_DIR = "skills";
const PARENT_DIR = "../..";
const TEXT_ENCODING = "utf8";
const LOG_APPEND_FLAG = "a";
const PATH_ENV = "PATH";
const PATH_SEPARATOR = path.delimiter;

const REASON_NO_CLI = "CLI not found on PATH";
const REASON_UNKNOWN_HOST = "unknown host";
const REASON_SKILL_MISSING = "missing after install";
const DEV_FOLDERS = [".github", "evals"];
const REASON_DEV_SHIPPED = "development folder shipped in the installed plugin:";
const REASON_NOT_REMOVED = "temp folder not removed";

const EXIT_OK = 0;
const EXIT_FAILED = 1;
const EXIT_SIGNALLED = 130;
const KILL_GRACE_MS = 2_000;
const STDOUT_FD = 1;
const WRITE_RETRY_ERROR = "EAGAIN";
const STOP_SIGNALS = ["SIGINT", "SIGTERM", "SIGHUP"];

const repo = path.resolve(path.dirname(fileURLToPath(import.meta.url)), PARENT_DIR);
const hostDirs = new Map();
let keep = false;
let running;
let cleanedUp = false;
let cleanupFailed = false;
let stopping = false;

// process.exit can drop buffered stdout on a pipe, so every stdout write is synchronous.
function writeOut(text) {
  const bytes = Buffer.from(text, TEXT_ENCODING);
  let offset = 0;
  while (offset < bytes.length) {
    try {
      offset += writeSync(STDOUT_FD, bytes, offset);
    } catch (error) {
      if (error.code !== WRITE_RETRY_ERROR) throw error;
    }
  }
}

function fail(host, message) {
  writeOut(`FAIL host=${host}: ${message}\n`);
}

function isHost(arg) {
  return HOSTS_ALL.includes(arg);
}

function parseArgs(args) {
  const requested = [];
  let bad = false;
  for (const arg of args) {
    if (isHost(arg)) {
      if (!requested.includes(arg)) requested.push(arg);
    } else if (arg === KEEP_FLAG) {
      keep = true;
    } else {
      fail(arg, REASON_UNKNOWN_HOST);
      bad = true;
    }
  }
  if (bad) process.exit(EXIT_FAILED);
  return requested.length > 0 ? requested : HOSTS_ALL;
}

function isFile(file) {
  try {
    return statSync(file).isFile();
  } catch {
    return false;
  }
}

function isExecutable(file) {
  try {
    accessSync(file, constants.X_OK);
    return isFile(file);
  } catch {
    return false;
  }
}

function onPath(command) {
  const dirs = (process.env[PATH_ENV] ?? "").split(PATH_SEPARATOR);
  return dirs.some((dir) => dir !== "" && isExecutable(path.join(dir, command)));
}

function requireClis(requested) {
  let missing = false;
  for (const host of requested) {
    if (onPath(host)) continue;
    fail(host, `${host} ${REASON_NO_CLI}`);
    missing = true;
  }
  if (missing) process.exit(EXIT_FAILED);
}

// Idempotent: runs from the exit path and every signal handler, and process.exit skips finally.
function cleanup() {
  if (cleanedUp) return;
  cleanedUp = true;
  for (const [host, dir] of hostDirs) {
    if (keep) {
      writeOut(`KEEP host=${host}: ${dir}\n`);
      continue;
    }
    rmSync(dir, { recursive: true, force: true });
    if (existsSync(dir)) {
      fail(host, REASON_NOT_REMOVED);
      cleanupFailed = true;
    }
  }
}

function finish(status) {
  cleanup();
  process.exit(cleanupFailed ? EXIT_FAILED : status);
}

// Resolves once the child has closed, so cleanup never removes a folder it is still writing to.
function stopChild(child) {
  return new Promise((resolve) => {
    const killTimer = setTimeout(() => child.kill("SIGKILL"), KILL_GRACE_MS);
    child.once("close", () => {
      clearTimeout(killTimer);
      resolve();
    });
    child.kill("SIGTERM");
  });
}

async function onSignal() {
  if (stopping) return;
  stopping = true;
  if (running) await stopChild(running);
  finish(EXIT_SIGNALLED);
}

function runChild(
  host,
  configDir,
  log,
  words,
  argument,
) {
  const logFd = openSync(log, LOG_APPEND_FLAG);
  const env = { ...process.env, [HOST_SPECS[host].configVar]: configDir };
  return new Promise((resolve) => {
    const child = spawn(host, [...words.split(" "), argument], {
      env,
      stdio: ["ignore", logFd, logFd],
    });
    running = child;
    let settled = false;
    const settle = (ok) => {
      // A failed spawn emits both error and close.
      if (settled) return;
      settled = true;
      if (running === child) running = undefined;
      closeSync(logFd);
      // After a stop signal the handler owns the exit, so the steps must not go on or print.
      if (!stopping) resolve(ok);
    };
    child.once("error", () => settle(false));
    child.once("close", (code) => settle(code === EXIT_OK));
  });
}

function dumpLog(log) {
  writeOut(readFileSync(log, TEXT_ENCODING));
}

async function runCli(
  host,
  configDir,
  log,
  words,
  argument,
) {
  if (await runChild(host, configDir, log, words, argument)) return true;
  fail(host, `${host} ${words} failed`);
  dumpLog(log);
  return false;
}

// Folder names under `dir`, at any depth, that match one of `names`. Relative to `dir`.
function findFolders(dir, names, prefix = "") {
  let entries;
  try {
    entries = readdirSync(dir, { withFileTypes: true });
  } catch {
    return [];
  }
  const found = [];
  for (const entry of entries) {
    if (!entry.isDirectory()) continue;
    const rel = prefix === "" ? entry.name : `${prefix}/${entry.name}`;
    if (names.includes(entry.name)) found.push(rel);
    found.push(...findFolders(path.join(dir, entry.name), names, rel));
  }
  return found;
}

async function smokeHost(host, version) {
  const configDir = mkdtempSync(path.join(tmpdir(), TMP_PREFIX));
  hostDirs.set(host, configDir);
  const log = path.join(configDir, LOG_NAME);
  const { installWords } = HOST_SPECS[host];
  if (!(await runCli(host, configDir, log, MARKETPLACE_ADD_WORDS, repo))) return false;
  if (!(await runCli(host, configDir, log, installWords, `${PLUGIN}@${MARKETPLACE}`))) return false;
  let missing = false;
  for (const skill of SKILL_NAMES) {
    const skillFile = path.join(
      configDir, CACHE_DIR, MARKETPLACE, PLUGIN, version, SKILLS_DIR, skill, SKILL_FILE,
    );
    if (isFile(skillFile)) continue;
    fail(host, `skill ${skill} ${REASON_SKILL_MISSING}`);
    missing = true;
  }
  // Only the plugin folder may ship, so no development folder can be in the installed copy.
  const installed = path.join(configDir, CACHE_DIR, MARKETPLACE, PLUGIN, version);
  for (const folder of findFolders(installed, DEV_FOLDERS)) {
    fail(host, `${REASON_DEV_SHIPPED} ${folder}`);
    missing = true;
  }
  if (!missing) return true;
  dumpLog(log);
  return false;
}

function readVersion() {
  const file = path.join(repo, MANIFEST);
  let version;
  try {
    version = JSON.parse(readFileSync(file, TEXT_ENCODING)).version;
  } catch (error) {
    throw new Error(`cannot read ${MANIFEST}: ${error instanceof Error ? error.message : error}`);
  }
  if (typeof version !== "string" || version === "") {
    throw new Error(`${MANIFEST} has no version string`);
  }
  return version;
}

async function main() {
  for (const signal of STOP_SIGNALS) process.on(signal, onSignal);
  const hosts = parseArgs(process.argv.slice(2));
  requireClis(hosts);
  const version = readVersion();
  let status = EXIT_OK;
  for (const host of hosts) {
    if (!(await smokeHost(host, version))) status = EXIT_FAILED;
  }
  finish(status);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  finish(EXIT_FAILED);
});
