// @ts-check
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import {
  chmodSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { test } from "node:test";
import { REPO_ROOT } from "./helpers.mjs";

const RELEASE_SCRIPT = path.join(REPO_ROOT, "scripts/release.mjs");
const CLAUDE_PLUGIN = ".claude-plugin/plugin.json";
const PARENT_PREFIX = "ae-release-";
const BIN_DIR = "bin";
const WORK_DIR = "work";
const GH_NAME = "gh";
const GH_SCRIPT_FILE = "gh-script.json";
const GH_LOG_FILE = "gh-log.jsonl";
const SCRIPT_ENV = "AE_GH_SCRIPT";
const LOG_ENV = "AE_GH_LOG";
const STUB_FILE_MODE = 0o755;
const TEXT_ENCODING = "utf8";
const PLUGIN_NAME = "ae";

const EXIT_OK = 0;
const EXIT_FAILED = 1;
const EXIT_USAGE = 2;
const EXIT_UNSCRIPTED = 97;

const REPO = "acme/skills";
const SHA = "1111111111111111111111111111111111111111";
const OTHER_SHA = "2222222222222222222222222222222222222222";
const VERSION = "0.2.0";
const TAG = `v${VERSION}`;
const REPO_ENV = "GITHUB_REPOSITORY";
const SHA_ENV = "GITHUB_SHA";

const NO_STDOUT = "";
const NO_STDERR = "";
const USAGE_LINE =
  "usage: GITHUB_REPOSITORY=<owner/repo> GITHUB_SHA=<sha> node scripts/release.mjs\n";
const NOT_SEMVER = "is not MAJOR.MINOR.PATCH";

const MISSING = null;
const BAD_JSON = { raw: "{" };

const API_CALL = ["api", `repos/${REPO}/git/ref/tags/${TAG}`];
const VIEW_CALL = ["release", "view", TAG];
const CREATE_CALL = [
  "release", "create", TAG, "--target", SHA, "--title", TAG, "--generate-notes",
];

// The stub answers by subcommand from a per-test script and logs each call's argv.
const STUB_BODY = String.raw`
const fs = require("node:fs");
const args = process.argv.slice(2);
fs.appendFileSync(process.env.${LOG_ENV}, JSON.stringify(args) + "\n");
const script = JSON.parse(fs.readFileSync(process.env.${SCRIPT_ENV}, "utf8"));
const key = args[0] === "release" ? "release " + args[1] : args[0];
const answer = script[key];
if (!answer) {
  process.stderr.write("no scripted answer for " + key);
  process.exit(${EXIT_UNSCRIPTED});
}
process.stdout.write(answer.stdout ?? "");
process.stderr.write(answer.stderr ?? "");
process.exit(answer.code);
`;

/** @typedef {{ code: number, stdout?: string, stderr?: string }} GhAnswer */
/** @typedef {Partial<Record<"api" | "release view" | "release create", GhAnswer>>} GhScript */

/**
 * @typedef {object} ReleaseCase
 * @property {string} id
 * @property {string | null | { raw: string } | Record<string, unknown>} [manifest] Version
 *   string, `MISSING` (file absent), `{ raw }` (written as is) or a JSON object. Defaults to 0.2.0.
 * @property {GhScript} [gh]
 * @property {string} [unset] Env var to leave out.
 * @property {number} code
 * @property {string} stdout
 * @property {string} stderr
 * @property {string[][]} log
 */

/** @type {string[]} */
const registeredIds = [];

/**
 * @param {string} dir
 * @param {NonNullable<ReleaseCase["manifest"]> | null} manifest
 */
function writeManifest(dir, manifest) {
  if (manifest === MISSING) return;
  let content;
  if (typeof manifest === "string") {
    content = JSON.stringify({ name: PLUGIN_NAME, version: manifest });
  } else if ("raw" in manifest && typeof manifest.raw === "string") {
    content = manifest.raw;
  } else {
    content = JSON.stringify(manifest);
  }
  mkdirSync(path.dirname(path.join(dir, CLAUDE_PLUGIN)), { recursive: true });
  writeFileSync(path.join(dir, CLAUDE_PLUGIN), `${content}\n`);
}

/** @param {string} binDir */
function writeStubGh(binDir) {
  const file = path.join(binDir, GH_NAME);
  writeFileSync(file, `#!${process.execPath}\n${STUB_BODY}`);
  chmodSync(file, STUB_FILE_MODE);
}

/** @param {string} logFile @returns {string[][]} */
function readLog(logFile) {
  if (!existsSync(logFile)) return [];
  return readFileSync(logFile, TEXT_ENCODING)
    .split("\n")
    .filter((line) => line !== "")
    .map((line) => JSON.parse(line));
}

/** @param {ReleaseCase} spec */
function defineCase(spec) {
  registeredIds.push(spec.id);
  test(`${spec.id}: manifest ${JSON.stringify(spec.manifest === undefined ? VERSION : spec.manifest)}`, (t) => {
    // Arrange
    const parent = mkdtempSync(path.join(tmpdir(), PARENT_PREFIX));
    t.after(() => rmSync(parent, { recursive: true, force: true }));
    const binDir = path.join(parent, BIN_DIR);
    const workDir = path.join(parent, WORK_DIR);
    mkdirSync(binDir);
    mkdirSync(workDir);
    const scriptFile = path.join(parent, GH_SCRIPT_FILE);
    const logFile = path.join(parent, GH_LOG_FILE);
    writeFileSync(scriptFile, JSON.stringify(spec.gh ?? {}));
    writeStubGh(binDir);
    writeManifest(workDir, spec.manifest === undefined ? VERSION : spec.manifest);
    /** @type {Record<string, string>} */
    const env = {
      PATH: binDir,
      [REPO_ENV]: REPO,
      [SHA_ENV]: SHA,
      [SCRIPT_ENV]: scriptFile,
      [LOG_ENV]: logFile,
    };
    if (spec.unset) delete env[spec.unset];

    // Act
    const run = spawnSync(process.execPath, [RELEASE_SCRIPT], {
      cwd: workDir,
      env,
      encoding: TEXT_ENCODING,
    });

    // Assert
    assert.equal(run.status, spec.code);
    assert.equal(run.stdout, spec.stdout);
    assert.equal(run.stderr, spec.stderr);
    assert.deepEqual(readLog(logFile), spec.log);
  });
}

/** @param {string} message */
const failLine = (message) => `FAIL release: ${message}\n`;
/** @param {string} shown */
const notSemver = (shown) =>
  failLine(`${CLAUDE_PLUGIN} version ${shown} ${NOT_SEMVER}`);

/** @param {string} type @param {string} sha @returns {GhAnswer} */
const refAnswer = (type, sha) => ({
  code: EXIT_OK,
  stdout: JSON.stringify({ object: { type, sha } }),
});
const REF_AT_SHA = refAnswer("commit", SHA);
/** @param {string} stderr @returns {GhAnswer} */
const failed = (stderr) => ({ code: EXIT_FAILED, stderr });
const NOT_FOUND_404 = failed("HTTP 404");

const CREATED = { code: EXIT_OK, stdout: NO_STDOUT, stderr: NO_STDERR };

// release is created, or already complete
defineCase({
  id: "R1",
  gh: { api: NOT_FOUND_404, "release create": { code: EXIT_OK } },
  ...CREATED,
  log: [API_CALL, CREATE_CALL],
});
defineCase({
  id: "R5",
  gh: { api: REF_AT_SHA, "release view": { code: EXIT_OK } },
  ...CREATED,
  log: [API_CALL, VIEW_CALL],
});
defineCase({
  id: "R6",
  gh: {
    api: REF_AT_SHA,
    "release view": failed("release not found"),
    "release create": { code: EXIT_OK },
  },
  ...CREATED,
  log: [API_CALL, VIEW_CALL, CREATE_CALL],
});

// gh failures stop the run without creating anything
/** @type {Array<[string, GhScript, string, string[][]]>} */
const ghFailRows = [
  ["R2", { api: failed("HTTP 500") }, "gh api failed: HTTP 500", [API_CALL]],
  ["R14", { api: failed("Not Found") }, "gh api failed: Not Found", [API_CALL]],
  [
    "R18",
    { api: { code: EXIT_OK, stdout: "not json" } },
    "gh api failed: invalid JSON",
    [API_CALL],
  ],
  [
    "R19",
    { api: { code: EXIT_OK, stdout: "{}" } },
    "gh api failed: invalid JSON",
    [API_CALL],
  ],
  [
    "R3",
    { api: refAnswer("commit", OTHER_SHA) },
    `tag ${TAG} already exists at another commit: the merged PR did not bump the version`,
    [API_CALL],
  ],
  [
    "R4",
    { api: refAnswer("tag", SHA) },
    `tag ${TAG} is annotated: delete it or point it at a commit`,
    [API_CALL],
  ],
  [
    "R9",
    { api: NOT_FOUND_404, "release create": failed("boom") },
    "gh release create failed: boom",
    [API_CALL, CREATE_CALL],
  ],
  [
    "R10",
    { api: REF_AT_SHA, "release view": failed("HTTP 502") },
    "gh release view failed: HTTP 502",
    [API_CALL, VIEW_CALL],
  ],
];
for (const [id, gh, message, log] of ghFailRows) {
  defineCase({
    id,
    gh,
    code: EXIT_FAILED,
    stdout: failLine(message),
    stderr: NO_STDERR,
    log,
  });
}

// a bad manifest version fails before any gh call
/** @type {Array<[string, ReleaseCase["manifest"], string]>} */
const badVersionRows = [
  ["R7", "0.1", "0.1"],
  ["R11", MISSING, "missing"],
  ["R12", { version: 2 }, "2"],
  ["R15", BAD_JSON, "missing"],
  ["R16", "01.2.3", "01.2.3"],
  ["R17", "v0.2.0", "v0.2.0"],
];
for (const [id, manifest, shown] of badVersionRows) {
  defineCase({
    id,
    manifest,
    code: EXIT_FAILED,
    stdout: notSemver(shown),
    stderr: NO_STDERR,
    log: [],
  });
}

// a missing env var prints usage before any gh call
/** @type {Array<[string, string]>} */
const usageRows = [
  ["R8", SHA_ENV],
  ["R13", REPO_ENV],
];
for (const [id, unset] of usageRows) {
  defineCase({
    id,
    unset,
    code: EXIT_USAGE,
    stdout: NO_STDOUT,
    stderr: USAGE_LINE,
    log: [],
  });
}

const EXPECTED_CASE_IDS = Array.from({ length: 19 }, (_, index) => `R${index + 1}`);

test("every expected release case is defined exactly once", () => {
  // Arrange
  const names = [...registeredIds].sort();

  // Act
  const expected = [...EXPECTED_CASE_IDS].sort();

  // Assert
  assert.deepEqual(names, expected);
  assert.equal(new Set(names).size, names.length);
});
