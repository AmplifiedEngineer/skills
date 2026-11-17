import { spawnSync } from "node:child_process";
import {
  appendFileSync,
  cpSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import type { TestContext } from "node:test";

export const REPO_ROOT = path.resolve(import.meta.dirname, "..");

const CHECK_CMD_ENV = "AE_CHECK_CMD";
const CHECK_SCRIPT = "scripts/check.ts";
const COPY_PREFIX = "ae-test-";
const GIT_LIST_ARGS = ["ls-files", "--cached", "--others", "--exclude-standard"];
const SHELL = "sh";
const SHELL_FLAG = "-c";
const TEXT_ENCODING = "utf8";

export type JsonObject = Record<string, any>;

export interface RunResult {
  code: number;
  lines: string[];
}

export interface TreeCopy {
  root: string;
  exists(rel: string): boolean;
  write(rel: string, content: string): void;
  append(rel: string, text: string): void;
  remove(rel: string): void;
  replace(rel: string, pattern: string | RegExp, replacement: string): void;
  dropLines(rel: string, drop: (line: string) => boolean): void;
  editJson(rel: string, mutate: (json: JsonObject) => void): void;
  removeMarkdownUnder(rel: string): void;
}

function listedFiles(): string[] {
  const listed = spawnSync("git", GIT_LIST_ARGS, { cwd: REPO_ROOT, encoding: TEXT_ENCODING });
  if (listed.status !== 0) {
    throw new Error(`git ls-files failed with status ${listed.status}`);
  }
  return listed.stdout.split("\n").filter((file) => file !== "");
}

function copyListedFiles(destination: string): void {
  for (const file of listedFiles()) {
    const source = path.join(REPO_ROOT, file);
    if (!existsSync(source)) continue;
    const target = path.join(destination, file);
    mkdirSync(path.dirname(target), { recursive: true });
    cpSync(source, target);
  }
}

function markdownFiles(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) return markdownFiles(full);
    return entry.name.endsWith(".md") ? [full] : [];
  });
}

function toCopy(root: string): TreeCopy {
  const abs = (rel: string) => path.join(root, rel);
  const read = (rel: string) => readFileSync(abs(rel), TEXT_ENCODING);
  const write = (rel: string, content: string) => {
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
      const json: JsonObject = JSON.parse(read(rel));
      mutate(json);
      write(rel, `${JSON.stringify(json, null, 2)}\n`);
    },
    removeMarkdownUnder(rel) {
      for (const file of markdownFiles(abs(rel))) rmSync(file);
    },
  };
}

/** Copies the git-listed tree into a fresh temp dir that `t.after` removes. */
export function createCopy(t: TestContext): TreeCopy {
  const root = mkdtempSync(path.join(tmpdir(), COPY_PREFIX));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  copyListedFiles(root);
  return toCopy(root);
}

export function splitLines(stdout: string): string[] {
  return stdout === "" ? [] : stdout.replace(/\n$/, "").split("\n");
}

export function runCommand(
  file: string,
  args: string[],
  cwd: string,
  env: NodeJS.ProcessEnv = process.env,
): RunResult {
  const run = spawnSync(file, args, { cwd, env, encoding: TEXT_ENCODING });
  if (run.status === null) {
    throw new Error(`${file} did not exit normally: ${run.signal ?? run.error?.message}`);
  }
  return { code: run.status, lines: splitLines(run.stdout) };
}

/** Runs the check script, from `AE_CHECK_CMD` when set, with cwd at the copy. */
export function runCheck(cwd: string): RunResult {
  const override = process.env[CHECK_CMD_ENV];
  if (override !== undefined && override !== "") {
    return runCommand(SHELL, [SHELL_FLAG, override], cwd);
  }
  return runCommand(process.execPath, [CHECK_SCRIPT], cwd);
}
