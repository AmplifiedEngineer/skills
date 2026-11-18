// @ts-check
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdirSync, mkdtempSync, realpathSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { test } from "node:test";
import { REPO_ROOT } from "./helpers.mjs";

const VERSION_SCRIPT = path.join(REPO_ROOT, "scripts/version.mjs");
const ROOT_PLUGIN = "plugin.json";
const CLAUDE_PLUGIN = ".claude-plugin/plugin.json";
const PARENT_PREFIX = "ae-version-";
const REPO_DIR = "repo";
const TEXT_ENCODING = "utf8";
const NULL_DEVICE = "/dev/null";
const GIT_ENV_PREFIX = "GIT_";
const PLUGIN_NAME = "ae";
const INITIAL_COMMIT_MESSAGE = "init";
const GIT_SETUP_CONFIG = [
  "-c", "user.name=t",
  "-c", "user.email=t@t",
  "-c", "commit.gpgsign=false",
  "-c", "tag.gpgsign=false",
  "-c", "init.templateDir=",
];

const EXIT_OK = 0;
const EXIT_FAILED = 1;
const EXIT_USAGE = 2;

const NEXT = "next";
const VERIFY = "verify";
const USAGE_LINE = 'usage: node scripts/version.mjs next|verify "<title>"\n';
const GIT_FAILED_PREFIX = "git failed:";
const NO_ROOT_VERSION = "FAIL version: plugin.json has no version";
const NO_STDOUT = "";
const NO_STDERR = "";

const MISSING = null;
const BAD_JSON = { raw: "{" };

/** @param {string} version */
const planned = (version) => `FAIL version: ${CLAUDE_PLUGIN} has 0.1.0, set it to ${version}`;
const CLAUDE_LINE = planned("0.1.1");

const registeredIds = [];

/**
 * A manifest spec is a version string, `MISSING` (file absent), `{ raw }` (written as is) or
 * a JSON object.
 * @param {string} dir
 * @param {string} file
 * @param {string | null | { raw: string } | Record<string, unknown>} manifest
 */
function writeManifest(dir, file, manifest) {
  if (manifest === MISSING) return;
  let content;
  if (typeof manifest === "string") {
    content = JSON.stringify({ name: PLUGIN_NAME, version: manifest });
  } else if ("raw" in manifest && typeof manifest.raw === "string") {
    content = manifest.raw;
  } else {
    content = JSON.stringify(manifest);
  }
  mkdirSync(path.dirname(path.join(dir, file)), { recursive: true });
  writeFileSync(path.join(dir, file), `${content}\n`);
}

/** Every git call shares this env, so nothing from the host config or `GIT_*` leaks in. */
function isolatedEnv(parent, extra) {
  const env = Object.fromEntries(
    Object.entries(process.env).filter(([key]) => !key.startsWith(GIT_ENV_PREFIX)),
  );
  return {
    ...env,
    GIT_CONFIG_GLOBAL: NULL_DEVICE,
    GIT_CONFIG_SYSTEM: NULL_DEVICE,
    GIT_CEILING_DIRECTORIES: realpathSync(parent),
    ...extra,
  };
}

function git(args, cwd, env) {
  const run = spawnSync("git", [...GIT_SETUP_CONFIG, ...args], {
    cwd,
    env,
    encoding: TEXT_ENCODING,
  });
  assert.equal(run.status, EXIT_OK, `git ${args.join(" ")} failed: ${run.stderr}`);
  return run.stdout;
}

function createRepo(dir, spec, env) {
  git(["init"], dir, env);
  writeManifest(dir, ROOT_PLUGIN, spec.root);
  writeManifest(dir, CLAUDE_PLUGIN, spec.claude);
  git(["add", "--all"], dir, env);
  git(["commit", "--allow-empty", "--message", INITIAL_COMMIT_MESSAGE], dir, env);
  for (const tag of spec.tags) git(["tag", tag], dir, env);
}

function outputMatches(actual, expected) {
  if (typeof expected === "string") assert.equal(actual, expected);
  else assert.ok(actual.startsWith(expected.startsWith), `${actual} does not start with ${expected.startsWith}`);
}

/**
 * @typedef {object} VersionCase
 * @property {string} id
 * @property {string[]} [tags]
 * @property {boolean} [git] Defaults to true; false leaves the dir a plain folder.
 * @property {*} [root] Manifest spec, defaults to 0.1.0.
 * @property {*} [claude] Manifest spec, defaults to 0.1.0.
 * @property {string[][]} args One argv per run; each run must meet the expectation.
 * @property {Record<string, string>} [env] Extra env set after the shared GIT_* strip.
 * @property {(listTags: () => string) => void} [precheck]
 * @property {number} code
 * @property {string} stdout
 * @property {string | { startsWith: string }} stderr
 */

/** @param {VersionCase} spec */
function defineCase(spec) {
  registeredIds.push(spec.id);
  test(`${spec.id}: ${JSON.stringify(spec.args)} tags ${JSON.stringify(spec.tags ?? [])}`, (t) => {
    // Arrange
    const parent = mkdtempSync(path.join(tmpdir(), PARENT_PREFIX));
    t.after(() => rmSync(parent, { recursive: true, force: true }));
    const dir = path.join(parent, REPO_DIR);
    mkdirSync(dir);
    const env = isolatedEnv(parent, spec.env);
    const full = {
      tags: [],
      root: "0.1.0",
      claude: "0.1.0",
      ...spec,
    };
    if (spec.git !== false) createRepo(dir, full, env);
    spec.precheck?.(
      () => git(["tag", "--list"], dir, env),
    );

    for (const args of spec.args) {
      // Act
      const run = spawnSync(process.execPath, [VERSION_SCRIPT, ...args], {
        cwd: dir,
        env,
        encoding: TEXT_ENCODING,
      });

      // Assert
      assert.equal(run.status, spec.code);
      assert.equal(run.stdout, spec.stdout);
      outputMatches(run.stderr, spec.stderr);
    }
  });
}

const OK_SILENT = { code: EXIT_OK, stdout: NO_STDOUT, stderr: NO_STDERR };

/** @param {string} id @param {string[]} tags @param {string | string[]} titles @param {string} version */
function defineNext(id, tags, titles, version, extra = {}) {
  defineCase({
    id,
    tags,
    args: [titles].flat().map((title) => [NEXT, title]),
    code: EXIT_OK,
    stdout: `${version}\n`,
    stderr: NO_STDERR,
    ...extra,
  });
}

/** @param {string} id @param {object} given @param {string[]} lines */
function defineVerifyFails(id, given, lines) {
  defineCase({
    args: [[VERIFY, "fix: x"]],
    code: EXIT_FAILED,
    stdout: `${lines.join("\n")}\n`,
    stderr: NO_STDERR,
    ...given,
    id,
  });
}

// next: bump rule and tag selection
/** @type {Array<[string, string[], string | string[], string]>} */
const nextRows = [
  ["V1", [], "feat: x", "0.1.0"],
  ["V2", ["v0.1.0"], "fix: x", "0.1.1"],
  ["V3", ["v0.1.0"], "feat: x", "0.2.0"],
  ["V4", ["v0.1.0"], "feat!: x", "0.2.0"],
  ["V5", ["v0.1.0"], "refactor(core)!: x", "0.2.0"],
  ["V6", ["v1.2.3"], "feat!: x", "2.0.0"],
  ["V7", ["v1.2.3"], "feat(api): x", "1.3.0"],
  ["V8", ["v1.2.3"], "docs: x", "1.2.4"],
  ["V9", ["v1.2.3"], "Update readme", "1.2.4"],
  ["V10", ["v0.9.0", "v0.10.0"], "fix: x", "0.10.1"],
  ["V11", ["v1.0.0", "v1.1", "v2.0.0-rc.1", "latest"], "fix: x", "1.0.1"],
  ["V21", ["v1.2.3"], "Feat: x", "1.2.4"],
  ["V22", ["v1.2.3"], 'Revert "feat: x"', "1.2.4"],
  ["V23", ["v1.2.3"], "  feat: x\n\nbody", "1.3.0"],
  ["V24", ["v1.2.3", "v01.9.9"], "fix: x", "1.2.4"],
  ["V30", ["v1.2.3"], "Feat!: x", "1.2.4"],
  ["V31", ["v1.2.3"], "feat(): x", "1.3.0"],
  ["V38", ["v1.2.3"], ["feat !: x", "feat! x"], "1.2.4"],
  ["V39", ["v1.2.3"], "refactor(core)!: x", "2.0.0"],
];
for (const [id, tags, title, version] of nextRows) defineNext(id, tags, title, version);

defineNext("V35", ["v1.2", "latest"], "fix: x", "0.3.0", { root: "0.3.0", claude: "0.1.1" });

const TAG_SORT_ENV = {
  GIT_CONFIG_COUNT: "1",
  GIT_CONFIG_KEY_0: "tag.sort",
  GIT_CONFIG_VALUE_0: "-refname",
};
defineNext("V34", ["v1.2.3", "v1.10.0"], "fix: x", "1.10.1", {
  env: TAG_SORT_ENV,
  precheck: (listTags) => {
    // The row only proves anything if the host sort really lists the lower tag first.
    const listed = listTags().split("\n");
    assert.ok(listed.indexOf("v1.2.3") < listed.indexOf("v1.10.0"));
  },
});

// verify: manifests against the next version
defineCase({
  id: "V12",
  tags: ["v0.1.0"],
  root: "0.2.0",
  claude: "0.2.0",
  args: [[VERIFY, "feat: x"]],
  ...OK_SILENT,
});
defineCase({
  id: "V18",
  root: "0.3.0",
  claude: "0.3.0",
  args: [[VERIFY, "ci: x"]],
  ...OK_SILENT,
});
defineVerifyFails(
  "V13",
  { tags: ["v0.1.0"], root: "0.2.0", claude: "0.1.0", args: [[VERIFY, "feat: x"]] },
  [planned("0.2.0")],
);

const ROOT_LINE = "FAIL version: plugin.json has 0.1.0, set it to 0.1.1";
const ROOT_NO_VERSION_LINE = "FAIL version: plugin.json has no version, set it to 0.1.1";
const CLAUDE_NO_VERSION_LINE = `FAIL version: ${CLAUDE_PLUGIN} has no version, set it to 0.1.1`;
/** @type {Array<[string, Record<string, unknown>, string[]]>} */
const verifyFailRows = [
  ["V14", { root: "0.1.0", claude: "0.1.0" }, [ROOT_LINE, CLAUDE_LINE]],
  ["V17", { root: "0.1.1", claude: { name: PLUGIN_NAME } }, [CLAUDE_NO_VERSION_LINE]],
  ["V19", { root: "0.1.0", claude: "0.1.1" }, [ROOT_LINE]],
  ["V20", { root: BAD_JSON, claude: "0.1.0" }, [ROOT_NO_VERSION_LINE, CLAUDE_LINE]],
  ["V27", { root: MISSING, claude: "0.1.0" }, [ROOT_NO_VERSION_LINE, CLAUDE_LINE]],
  ["V28", { root: { version: 1 }, claude: "0.1.1" }, [ROOT_NO_VERSION_LINE]],
  ["V32", { root: "0.1.1", claude: MISSING }, [CLAUDE_NO_VERSION_LINE]],
  ["V33", { root: "0.1", claude: "0.1.1" }, ["FAIL version: plugin.json has 0.1, set it to 0.1.1"]],
  ["V36", { root: "0.1.1", claude: BAD_JSON }, [CLAUDE_NO_VERSION_LINE]],
];
for (const [id, given, lines] of verifyFailRows) {
  defineVerifyFails(id, { tags: ["v0.1.0"], ...given }, lines);
}

// no tag and no usable root manifest
defineCase({
  id: "V37",
  root: MISSING,
  args: [[NEXT, "fix: x"]],
  code: EXIT_FAILED,
  stdout: `${NO_ROOT_VERSION}\n`,
  stderr: NO_STDERR,
});
// Chosen: the first-release failure from `next` is the only line verify prints.
defineCase({
  id: "V40",
  root: MISSING,
  args: [[VERIFY, "fix: x"]],
  code: EXIT_FAILED,
  stdout: `${NO_ROOT_VERSION}\n`,
  stderr: NO_STDERR,
});

// git failures
defineCase({
  id: "V16",
  git: false,
  args: [[NEXT, "fix: x"]],
  code: EXIT_FAILED,
  stdout: NO_STDOUT,
  stderr: { startsWith: GIT_FAILED_PREFIX },
});
defineCase({
  id: "V16b",
  git: false,
  args: [[VERIFY, "fix: x"]],
  code: EXIT_FAILED,
  stdout: NO_STDOUT,
  stderr: { startsWith: GIT_FAILED_PREFIX },
});

// usage guards
/** @type {Array<[string, string[][]]>} */
const usageRows = [
  ["V15", [[NEXT], [VERIFY]]],
  ["V25", [["bump", "fix: x"]]],
  ["V26", [[NEXT, ""], [VERIFY, ""]]],
  ["V29", [[NEXT, "   "], [VERIFY, "   "]]],
];
for (const [id, args] of usageRows) {
  defineCase({ id, args, code: EXIT_USAGE, stdout: NO_STDOUT, stderr: USAGE_LINE });
}

const EXPECTED_CASE_IDS = [
  ...Array.from({ length: 40 }, (_, index) => `V${index + 1}`),
  "V16b",
];

test("every expected version case is defined exactly once", () => {
  // Arrange
  const names = [...registeredIds].sort();

  // Act
  const expected = [...EXPECTED_CASE_IDS].sort();

  // Assert
  assert.deepEqual(names, expected);
  assert.equal(new Set(names).size, names.length);
});
