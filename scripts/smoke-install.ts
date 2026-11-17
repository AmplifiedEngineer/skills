/**
 * End-to-end install test: adds this repo as a local marketplace in a throwaway config
 * folder per host, installs the plugin and checks all skills arrived.
 *
 * Usage: node scripts/smoke-install.ts [claude] [codex] [--keep]. Silent on success.
 * Requires the CLI of each requested host.
 */
import { spawn } from "node:child_process";
import type { ChildProcess } from "node:child_process";
import {
  accessSync,
  closeSync,
  constants,
  existsSync,
  mkdtempSync,
  openSync,
  readFileSync,
  rmSync,
  statSync,
  writeSync,
} from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

type Host = "claude" | "codex";

interface HostSpec {
  configVar: string;
  installWords: string;
}

const HOST_SPECS: Record<Host, HostSpec> = {
  claude: { configVar: "CLAUDE_CONFIG_DIR", installWords: "plugin install" },
  codex: { configVar: "CODEX_HOME", installWords: "plugin add" },
};
const HOSTS_ALL: Host[] = ["claude", "codex"];
const KEEP_FLAG = "--keep";
const MARKETPLACE = "amplifiedengineer";
const PLUGIN = "ae";
const MARKETPLACE_ADD_WORDS = "plugin marketplace add";
const SKILL_NAMES = ["planner", "implementer", "researcher"];
const SKILL_FILE = "SKILL.md";
const MANIFEST = "plugin.json";
const LOG_NAME = "smoke.log";
const TMP_PREFIX = "ae-smoke.";
const CACHE_DIR = "plugins/cache";
const SKILLS_DIR = "skills";
const PARENT_DIR = "..";
const TEXT_ENCODING = "utf8";
const LOG_APPEND_FLAG = "a";
const PATH_ENV = "PATH";
const PATH_SEPARATOR = path.delimiter;

const REASON_NO_CLI = "CLI not found on PATH";
const REASON_UNKNOWN_HOST = "unknown host";
const REASON_SKILL_MISSING = "missing after install";
const REASON_NOT_REMOVED = "temp folder not removed";

const EXIT_OK = 0;
const EXIT_FAILED = 1;
const EXIT_SIGNALLED = 130;
const KILL_GRACE_MS = 2_000;
const STDOUT_FD = 1;
const WRITE_RETRY_ERROR = "EAGAIN";
const STOP_SIGNALS: NodeJS.Signals[] = ["SIGINT", "SIGTERM", "SIGHUP"];

const repo = path.resolve(path.dirname(fileURLToPath(import.meta.url)), PARENT_DIR);
const hostDirs = new Map<Host, string>();
let keep = false;
let running: ChildProcess | undefined;
let cleanedUp = false;
let cleanupFailed = false;
let stopping = false;

// process.exit can drop buffered stdout on a pipe, so every stdout write is synchronous.
function writeOut(text: string): void {
  const bytes = Buffer.from(text, TEXT_ENCODING);
  let offset = 0;
  while (offset < bytes.length) {
    try {
      offset += writeSync(STDOUT_FD, bytes, offset);
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== WRITE_RETRY_ERROR) throw error;
    }
  }
}

function fail(host: string, message: string): void {
  writeOut(`FAIL host=${host}: ${message}\n`);
}

function isHost(arg: string): arg is Host {
  return (HOSTS_ALL as string[]).includes(arg);
}

function parseArgs(args: string[]): Host[] {
  const requested: Host[] = [];
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

function isFile(file: string): boolean {
  try {
    return statSync(file).isFile();
  } catch {
    return false;
  }
}

function isExecutable(file: string): boolean {
  try {
    accessSync(file, constants.X_OK);
    return isFile(file);
  } catch {
    return false;
  }
}

function onPath(command: string): boolean {
  const dirs = (process.env[PATH_ENV] ?? "").split(PATH_SEPARATOR);
  return dirs.some((dir) => dir !== "" && isExecutable(path.join(dir, command)));
}

function requireClis(requested: Host[]): void {
  let missing = false;
  for (const host of requested) {
    if (onPath(host)) continue;
    fail(host, `${host} ${REASON_NO_CLI}`);
    missing = true;
  }
  if (missing) process.exit(EXIT_FAILED);
}

// Idempotent: runs from the exit path and every signal handler, and process.exit skips finally.
function cleanup(): void {
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

function finish(status: number): never {
  cleanup();
  process.exit(cleanupFailed ? EXIT_FAILED : status);
}

// Resolves once the child has closed, so cleanup never removes a folder it is still writing to.
function stopChild(child: ChildProcess): Promise<void> {
  return new Promise((resolve) => {
    const killTimer = setTimeout(() => child.kill("SIGKILL"), KILL_GRACE_MS);
    child.once("close", () => {
      clearTimeout(killTimer);
      resolve();
    });
    child.kill("SIGTERM");
  });
}

async function onSignal(): Promise<void> {
  if (stopping) return;
  stopping = true;
  if (running) await stopChild(running);
  finish(EXIT_SIGNALLED);
}

function runChild(
  host: Host,
  configDir: string,
  log: string,
  words: string,
  argument: string,
): Promise<boolean> {
  const logFd = openSync(log, LOG_APPEND_FLAG);
  const env = { ...process.env, [HOST_SPECS[host].configVar]: configDir };
  return new Promise((resolve) => {
    const child = spawn(host, [...words.split(" "), argument], {
      env,
      stdio: ["ignore", logFd, logFd],
    });
    running = child;
    let settled = false;
    const settle = (ok: boolean): void => {
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

function dumpLog(log: string): void {
  writeOut(readFileSync(log, TEXT_ENCODING));
}

async function runCli(
  host: Host,
  configDir: string,
  log: string,
  words: string,
  argument: string,
): Promise<boolean> {
  if (await runChild(host, configDir, log, words, argument)) return true;
  fail(host, `${host} ${words} failed`);
  dumpLog(log);
  return false;
}

async function smokeHost(host: Host, version: string): Promise<boolean> {
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
  if (!missing) return true;
  dumpLog(log);
  return false;
}

function readVersion(): string {
  const file = path.join(repo, MANIFEST);
  let version: unknown;
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

async function main(): Promise<void> {
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

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : String(error));
  finish(EXIT_FAILED);
});
