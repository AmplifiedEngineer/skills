import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  realpathSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { test } from "node:test";
import type { TestContext } from "node:test";
import {
  REPO_ROOT,
  STUB_READY_NAME,
  STUB_SENTINEL_NAME,
  resolveOnPath,
  runCommand,
  splitLines,
  writeStubCli,
} from "./helpers.ts";
import type { RunResult, StubMode } from "./helpers.ts";

const SMOKE_SCRIPT = "scripts/smoke-install.ts";
const SANDBOX_PREFIX = "ae-smoke-test-";
const NODE_LINK = "node";
const BIN_DIR = "bin";
const TMP_DIR = "tmp";
const SIGNAL_DIR = "signal";
const RECORD_NAME = "calls.jsonl";
const TEMP_FOLDER_NAME = /^ae-smoke\.[A-Za-z0-9]{6}$/;
const KEEP_LINE = /^KEEP host=claude: (.+)$/;
const KEEP_FLAG = "--keep";
const TEXT_ENCODING = "utf8";
const READY_DEADLINE_MS = 10_000;
const READY_POLL_MS = 25;
const EXIT_CLEAN = 0;
const EXIT_FAILED = 1;
const EXIT_SIGNALLED = 130;

const CLAUDE_MISSING = "FAIL host=claude: claude CLI not found on PATH";
const CODEX_MISSING = "FAIL host=codex: codex CLI not found on PATH";
const SKILL_MISSING = "skill researcher missing after install";

const EXPECTED_CASE_IDS = [20, 21, 58, 59, 74, 77, 78, 80, 81, 82, 83, 84, 85, 93];

type Host = "claude" | "codex";

interface Sandbox {
  binDir: string;
  tmpDir: string;
  signalDir: string;
  recordFile: string;
  env: NodeJS.ProcessEnv;
}

interface SmokeCase {
  id: number;
  fault: string;
  host?: Host;
  mode?: StubMode;
  args: string[];
  code: number;
  lines: string[];
  absent?: Host[];
  tmpEmpty?: boolean;
}

const registeredIds: number[] = [];

function createSandbox(t: TestContext): Sandbox {
  const root = realpathSync(mkdtempSync(path.join(tmpdir(), SANDBOX_PREFIX)));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  const [binDir, tmpDir, signalDir] = [BIN_DIR, TMP_DIR, SIGNAL_DIR].map((name) => {
    const dir = path.join(root, name);
    mkdirSync(dir);
    return dir;
  });
  // The stub CLIs start with `#!/usr/bin/env node`, so node must resolve on the sandbox PATH.
  symlinkSync(process.execPath, path.join(binDir, NODE_LINK));
  return {
    binDir,
    tmpDir,
    signalDir,
    recordFile: path.join(root, RECORD_NAME),
    env: { PATH: binDir, TMPDIR: tmpDir },
  };
}

function installStub(box: Sandbox, host: Host, mode: StubMode): void {
  writeStubCli(box.binDir, {
    host,
    mode,
    repoRoot: REPO_ROOT,
    recordFile: box.recordFile,
    signalDir: box.signalDir,
  });
}

function runSmoke(box: Sandbox, args: string[]): RunResult {
  return runCommand(process.execPath, [SMOKE_SCRIPT, ...args], REPO_ROOT, box.env);
}

function recordedConfigDir(box: Sandbox): string {
  const first = readFileSync(box.recordFile, TEXT_ENCODING).split("\n")[0];
  return JSON.parse(first).configDir;
}

function assertPrivateTempFolder(box: Sandbox, dir: string): void {
  assert.equal(path.dirname(dir), box.tmpDir);
  assert.match(path.basename(dir), TEMP_FOLDER_NAME);
}

function defineCase(spec: SmokeCase): void {
  registeredIds.push(spec.id);
  test(`case ${spec.id}: ${spec.fault}`, (t) => {
    // Arrange
    const box = createSandbox(t);
    if (spec.host !== undefined && spec.mode !== undefined) {
      installStub(box, spec.host, spec.mode);
    }
    for (const host of spec.absent ?? []) {
      assert.equal(resolveOnPath(host, box.env.PATH), undefined, `${host} must not resolve`);
    }

    // Act
    const result = runSmoke(box, spec.args);

    // Assert
    assert.equal(result.code, spec.code);
    assert.deepEqual(result.lines, spec.lines);
    if (spec.tmpEmpty) assert.deepEqual(readdirSync(box.tmpDir), []);
  });
}

defineCase({
  id: 20,
  fault: "codex requested with no codex on PATH",
  args: ["codex"],
  code: EXIT_FAILED,
  lines: [CODEX_MISSING],
  absent: ["codex"],
});

defineCase({
  id: 21,
  fault: "claude requested with no claude on PATH",
  args: ["claude"],
  code: EXIT_FAILED,
  lines: [CLAUDE_MISSING],
  absent: ["claude"],
});

defineCase({
  id: 58,
  fault: "no arguments and neither CLI on PATH",
  args: [],
  code: EXIT_FAILED,
  lines: [CLAUDE_MISSING, CODEX_MISSING],
  absent: ["claude", "codex"],
});

defineCase({
  id: 59,
  fault: "unknown host bogus",
  args: ["bogus"],
  code: EXIT_FAILED,
  lines: ["FAIL host=bogus: unknown host"],
});

defineCase({
  id: 74,
  fault: "claude stub fails every call",
  host: "claude",
  mode: "allfail",
  args: ["claude"],
  code: EXIT_FAILED,
  lines: ["FAIL host=claude: claude plugin marketplace add failed"],
  tmpEmpty: true,
});

defineCase({
  id: 77,
  fault: "claude stub installs only planner and implementer",
  host: "claude",
  mode: "partial",
  args: ["claude"],
  code: EXIT_FAILED,
  lines: [`FAIL host=claude: ${SKILL_MISSING}`],
  tmpEmpty: true,
});

defineCase({
  id: 78,
  fault: "claude stub: marketplace add succeeds, install exits 1",
  host: "claude",
  mode: "install-fails",
  args: ["claude"],
  code: EXIT_FAILED,
  lines: ["FAIL host=claude: claude plugin install failed"],
  tmpEmpty: true,
});

defineCase({
  id: 80,
  fault: "codex stub fails every call",
  host: "codex",
  mode: "allfail",
  args: ["codex"],
  code: EXIT_FAILED,
  lines: ["FAIL host=codex: codex plugin marketplace add failed"],
  tmpEmpty: true,
});

defineCase({
  id: 81,
  fault: "codex stub: plugin add exits 1",
  host: "codex",
  mode: "install-fails",
  args: ["codex"],
  code: EXIT_FAILED,
  lines: ["FAIL host=codex: codex plugin add failed"],
  tmpEmpty: true,
});

defineCase({
  id: 82,
  fault: "codex stub installs only planner and implementer",
  host: "codex",
  mode: "partial",
  args: ["codex"],
  code: EXIT_FAILED,
  lines: [`FAIL host=codex: ${SKILL_MISSING}`],
  tmpEmpty: true,
});

test("case 83: full claude stub with --keep leaves one private temp folder", (t) => {
  // Arrange
  const box = createSandbox(t);
  installStub(box, "claude", "full");

  // Act
  const result = runSmoke(box, ["claude", KEEP_FLAG]);
  const kept = readdirSync(box.tmpDir).map((name) => path.join(box.tmpDir, name));
  for (const dir of kept) t.after(() => rmSync(dir, { recursive: true, force: true }));

  // Assert
  assert.equal(result.code, EXIT_CLEAN);
  assert.equal(result.lines.length, 1);
  const match = KEEP_LINE.exec(result.lines[0]);
  assert.ok(match, `expected one KEEP host=claude line, got ${result.lines[0]}`);
  const dir = match[1];
  assert.ok(existsSync(dir), `${dir} should exist`);
  assertPrivateTempFolder(box, dir);
});
registeredIds.push(83);

for (const [id, host] of [
  [84, "claude"],
  [85, "codex"],
] as const) {
  registeredIds.push(id);
  test(`case ${id}: full ${host} stub succeeds silently in a private temp folder`, (t) => {
    // Arrange
    const box = createSandbox(t);
    installStub(box, host, "full");

    // Act
    const result = runSmoke(box, [host]);

    // Assert
    assert.equal(result.code, EXIT_CLEAN);
    assert.deepEqual(result.lines, []);
    assertPrivateTempFolder(box, recordedConfigDir(box));
    assert.deepEqual(readdirSync(box.tmpDir), []);
  });
}

registeredIds.push(93);
test("case 93: SIGTERM while a stub runs exits 130 and removes the temp folder", async (t) => {
  // Arrange
  const box = createSandbox(t);
  installStub(box, "claude", "block");
  const child = spawn(process.execPath, [SMOKE_SCRIPT, "claude"], {
    cwd: REPO_ROOT,
    env: box.env,
  });
  let stdout = "";
  child.stdout.on("data", (chunk) => (stdout += chunk));
  const exited = new Promise<number | null>((resolve) => child.on("close", resolve));
  t.after(() => {
    child.kill("SIGKILL");
  });
  const ready = path.join(box.signalDir, STUB_READY_NAME);
  const deadline = Date.now() + READY_DEADLINE_MS;
  while (!existsSync(ready) && Date.now() < deadline) {
    await new Promise((resolve) => setTimeout(resolve, READY_POLL_MS));
  }
  assert.ok(existsSync(ready), `stub did not signal ready within ${READY_DEADLINE_MS} ms`);

  // Act
  child.kill("SIGTERM");
  writeFileSync(path.join(box.signalDir, STUB_SENTINEL_NAME), "");
  const code = await exited;

  // Assert
  assert.equal(code, EXIT_SIGNALLED);
  assert.deepEqual(splitLines(stdout), []);
  assert.deepEqual(readdirSync(box.tmpDir), []);
});

test("every expected smoke case is defined exactly once", () => {
  // Arrange
  const names = registeredIds.map((id) => `case ${id}`);

  // Act
  const expected = EXPECTED_CASE_IDS.map((id) => `case ${id}`);

  // Assert
  assert.deepEqual([...names].sort(), [...expected].sort());
  assert.equal(new Set(names).size, names.length);
});
