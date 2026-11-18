// @ts-check
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
} from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { test } from "node:test";

import {
  REPO_ROOT,
  STUB_LOG_MARKER,
  STUB_READY_NAME,
  resolveOnPath,
  runCommand,
  splitLines,
  writeStubCli,
} from "./helpers.mjs";

const SMOKE_SCRIPT = "scripts/smoke-install.mjs";
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

const PID_GONE_GRACE_MS = 100;
const PID_POLL_MS = 10;
const BIG_LOG_MIN_LINES = 500;
const MARKETPLACE_ADD_ARGS = ["plugin", "marketplace", "add", REPO_ROOT];
const PLUGIN_REF = "ae@amplifiedengineer";
const INSTALL_ARGS = {
  claude: ["plugin", "install", PLUGIN_REF],
  codex: ["plugin", "add", PLUGIN_REF],
};

const CLAUDE_MISSING = "FAIL host=claude: claude CLI not found on PATH";
const CODEX_MISSING = "FAIL host=codex: codex CLI not found on PATH";
const SKILL_MISSING = "skill researcher missing after install";

const EXPECTED_CASE_IDS = [20, 21, 58, 59, 74, 77, 78, 80, 81, 82, 83, 84, 85, 93, 95, 96];

const registeredIds = [];

function createSandbox(t) {
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

function installStub(box, host, mode) {
  writeStubCli(box.binDir, {
    host,
    mode,
    repoRoot: REPO_ROOT,
    recordFile: box.recordFile,
    signalDir: box.signalDir,
  });
}

function runSmoke(box, args) {
  return runCommand(process.execPath, [SMOKE_SCRIPT, ...args], REPO_ROOT, box.env);
}

function recordedCalls(box) {
  return splitLines(readFileSync(box.recordFile, TEXT_ENCODING)).map((line) => JSON.parse(line));
}

function recordedConfigDir(box) {
  return recordedCalls(box)[0].configDir;
}

function isGone(pid) {
  try {
    process.kill(pid, 0);
    return false;
  } catch (error) {
    return error.code === "ESRCH";
  }
}

async function sleep(ms) {
  await new Promise((resolve) => setTimeout(resolve, ms));
}

async function waitUntilGone(pid) {
  const deadline = Date.now() + PID_GONE_GRACE_MS;
  while (!isGone(pid) && Date.now() < deadline) await sleep(PID_POLL_MS);
  return isGone(pid);
}

async function readStubPid(box) {
  const ready = path.join(box.signalDir, STUB_READY_NAME);
  const deadline = Date.now() + READY_DEADLINE_MS;
  while (Date.now() < deadline) {
    const text = existsSync(ready) ? readFileSync(ready, TEXT_ENCODING) : "";
    if (text !== "") return Number(text);
    await sleep(READY_POLL_MS);
  }
  throw new Error(`stub did not signal ready within ${READY_DEADLINE_MS} ms`);
}

function assertPrivateTempFolder(box, dir) {
  assert.equal(path.dirname(dir), box.tmpDir);
  assert.match(path.basename(dir), TEMP_FOLDER_NAME);
}

function defineTest(id, title, body) {
  registeredIds.push(id);
  test(`case ${id}: ${title}`, body);
}

function defineCase(spec) {
  defineTest(spec.id, spec.fault, (t) => {
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
    if (spec.bigLog) {
      assert.ok(result.lines.length > BIG_LOG_MIN_LINES, "log dump was cut short");
      assert.equal(result.lines[0], "FAIL host=claude: claude plugin marketplace add failed");
      assert.equal(result.lines.at(-1), STUB_LOG_MARKER);
    } else {
      assert.deepEqual(result.lines, spec.lines);
    }
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
  lines: ["FAIL host=claude: claude plugin marketplace add failed", STUB_LOG_MARKER],
  tmpEmpty: true,
});

defineCase({
  id: 77,
  fault: "claude stub installs only planner and implementer",
  host: "claude",
  mode: "partial",
  args: ["claude"],
  code: EXIT_FAILED,
  lines: [`FAIL host=claude: ${SKILL_MISSING}`, STUB_LOG_MARKER],
  tmpEmpty: true,
});

defineCase({
  id: 78,
  fault: "claude stub: marketplace add succeeds, install exits 1",
  host: "claude",
  mode: "install-fails",
  args: ["claude"],
  code: EXIT_FAILED,
  lines: ["FAIL host=claude: claude plugin install failed", STUB_LOG_MARKER],
  tmpEmpty: true,
});

defineCase({
  id: 80,
  fault: "codex stub fails every call",
  host: "codex",
  mode: "allfail",
  args: ["codex"],
  code: EXIT_FAILED,
  lines: ["FAIL host=codex: codex plugin marketplace add failed", STUB_LOG_MARKER],
  tmpEmpty: true,
});

defineCase({
  id: 81,
  fault: "codex stub: plugin add exits 1",
  host: "codex",
  mode: "install-fails",
  args: ["codex"],
  code: EXIT_FAILED,
  lines: ["FAIL host=codex: codex plugin add failed", STUB_LOG_MARKER],
  tmpEmpty: true,
});

defineCase({
  id: 82,
  fault: "codex stub installs only planner and implementer",
  host: "codex",
  mode: "partial",
  args: ["codex"],
  code: EXIT_FAILED,
  lines: [`FAIL host=codex: ${SKILL_MISSING}`, STUB_LOG_MARKER],
  tmpEmpty: true,
});

defineTest(83, "full claude stub with --keep leaves one private temp folder", (t) => {
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

for (const host of ["claude", "codex"]) {
  defineTest(
    host === "claude" ? 84 : 85,
    `full ${host} stub succeeds silently in a private temp folder`,
    (t) => {
      // Arrange
      const box = createSandbox(t);
      installStub(box, host, "full");

      // Act
      const result = runSmoke(box, [host]);

      // Assert
      assert.equal(result.code, EXIT_CLEAN);
      assert.deepEqual(result.lines, []);
      const calls = recordedCalls(box);
      assert.deepEqual(
        calls.map((call) => call.args),
        [MARKETPLACE_ADD_ARGS, INSTALL_ARGS[host]],
      );
      assertPrivateTempFolder(box, calls[0].configDir);
      assert.deepEqual(readdirSync(box.tmpDir), []);
    },
  );
}

defineCase({
  id: 95,
  fault: "claude stub writes more than 70 KB of log before failing",
  host: "claude",
  mode: "bigfail",
  args: ["claude"],
  code: EXIT_FAILED,
  lines: [],
  tmpEmpty: true,
  bigLog: true,
});

// Stops the smoke script while its CLI runs, then checks the CLI is gone and cleanup ran.
function defineSignalCase(id, mode, title) {
  defineTest(id, title, async (t) => {
    // Arrange
    const box = createSandbox(t);
    installStub(box, "claude", mode);
    const child = spawn(process.execPath, [SMOKE_SCRIPT, "claude"], {
      cwd: REPO_ROOT,
      env: box.env,
    });
    let stdout = "";
    child.stdout.on("data", (chunk) => (stdout += chunk));
    const exited = new Promise((resolve) => child.on("close", resolve));
    t.after(() => {
      child.kill("SIGKILL");
    });
    const stubPid = await readStubPid(box);
    t.after(() => {
      if (!isGone(stubPid)) process.kill(stubPid, "SIGKILL");
    });

    // Act
    child.kill("SIGTERM");
    const code = await exited;

    // Assert
    assert.equal(code, EXIT_SIGNALLED);
    assert.deepEqual(splitLines(stdout), []);
    assert.deepEqual(readdirSync(box.tmpDir), []);
    assert.ok(await waitUntilGone(stubPid), `stub ${stubPid} still running after exit`);
  });
}

defineSignalCase(93, "block", "SIGTERM while a slow-stopping stub runs waits for it and cleans up");
defineSignalCase(96, "stubborn", "SIGTERM while a stub ignores it kills the stub and cleans up");

test("every expected smoke case is defined exactly once", () => {
  // Arrange
  const names = registeredIds.map((id) => `case ${id}`);

  // Act
  const expected = EXPECTED_CASE_IDS.map((id) => `case ${id}`);

  // Assert
  assert.deepEqual([...names].sort(), [...expected].sort());
  assert.equal(new Set(names).size, names.length);
});
