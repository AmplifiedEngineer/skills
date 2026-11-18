// @ts-check
/**
 * Creates the GitHub release for the version in `.claude-plugin/plugin.json`.
 *
 * Assumes a push-to-main run where the checkout is GITHUB_SHA. It calls `gh` with argv arrays
 * and no shell.
 */
import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";

const EXIT_OK = 0;
const EXIT_FAILED = 1;
const EXIT_USAGE = 2;
const USAGE =
  "usage: GITHUB_REPOSITORY=<owner/repo> GITHUB_SHA=<sha> node scripts/release.mjs\n";
const REPO_ENV = "GITHUB_REPOSITORY";
const SHA_ENV = "GITHUB_SHA";
const MANIFEST = ".claude-plugin/plugin.json";
const TEXT_ENCODING = "utf8";
const SEMVER_REGEX = /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/;
const MISSING_VERSION = "missing";
const FAIL_PREFIX = "FAIL release:";
const LINE_SEPARATOR = "\n";
const GH = "gh";
const GH_API = "api";
const GH_RELEASE = "release";
const GH_VIEW = "view";
const GH_CREATE = "create";
// gh reports a missing ref only through its stderr text; any other failure fails closed.
const NOT_FOUND_MARKER = "HTTP 404";
const RELEASE_NOT_FOUND_MARKER = "release not found";
const ANNOTATED_TAG_TYPE = "tag";
const INVALID_JSON = "invalid JSON";

/**
 * @param {string} message
 * @returns {never}
 */
function failWith(message) {
  process.stdout.write(`${FAIL_PREFIX} ${message}\n`);
  process.exit(EXIT_FAILED);
}

/** @returns {{ repo: string, sha: string }} */
function readEnv() {
  const repo = process.env[REPO_ENV];
  const sha = process.env[SHA_ENV];
  if (!repo || !sha) {
    process.stderr.write(USAGE);
    process.exit(EXIT_USAGE);
  }
  return { repo, sha };
}

/** @returns {string} The manifest version, which must be strict MAJOR.MINOR.PATCH. */
function readVersion() {
  let shown = MISSING_VERSION;
  try {
    const { version } = JSON.parse(readFileSync(MANIFEST, TEXT_ENCODING));
    if (typeof version === "string") shown = version;
    else if (version !== undefined) shown = JSON.stringify(version);
  } catch {
    // A missing file or invalid JSON counts as a missing version.
  }
  if (!SEMVER_REGEX.test(shown)) {
    failWith(`${MANIFEST} version ${shown} is not MAJOR.MINOR.PATCH`);
  }
  return shown;
}

/**
 * @param {string[]} args
 * @returns {{ ok: boolean, stdout: string, stderr: string }}
 */
function gh(args) {
  const run = spawnSync(GH, args, { encoding: TEXT_ENCODING });
  const stderr = run.error ? run.error.message : run.stderr;
  return { ok: run.status === 0, stdout: run.stdout ?? "", stderr };
}

/** @param {string} stderr */
const firstLine = (stderr) => stderr.trim().split(LINE_SEPARATOR)[0];

/**
 * @param {string} tag
 * @param {string} repo
 * @returns {{ type: string, sha: string } | null} The tag's target, or null when no tag exists.
 */
function lookupTag(tag, repo) {
  const result = gh([GH_API, `repos/${repo}/git/ref/tags/${tag}`]);
  if (!result.ok) {
    if (result.stderr.includes(NOT_FOUND_MARKER)) return null;
    return failWith(`gh api failed: ${firstLine(result.stderr)}`);
  }
  let object;
  try {
    object = JSON.parse(result.stdout).object;
  } catch {
    // Handled with the shape check below.
  }
  if (typeof object?.type !== "string" || typeof object?.sha !== "string") {
    return failWith(`gh api failed: ${INVALID_JSON}`);
  }
  return { type: object.type, sha: object.sha };
}

/** @param {string} tag */
function releaseExists(tag) {
  const result = gh([GH_RELEASE, GH_VIEW, tag]);
  if (result.ok) return true;
  if (result.stderr.includes(RELEASE_NOT_FOUND_MARKER)) return false;
  return failWith(`gh release view failed: ${firstLine(result.stderr)}`);
}

/** @param {string} tag @param {string} sha */
function createRelease(tag, sha) {
  const result = gh([
    GH_RELEASE, GH_CREATE, tag, "--target", sha, "--title", tag, "--generate-notes",
  ]);
  if (!result.ok) failWith(`gh release create failed: ${firstLine(result.stderr)}`);
}

const { repo, sha } = readEnv();
const tag = `v${readVersion()}`;
const existing = lookupTag(tag, repo);
if (existing) {
  if (existing.type === ANNOTATED_TAG_TYPE) {
    failWith(`tag ${tag} is annotated: delete it or point it at a commit`);
  }
  if (existing.sha !== sha) {
    failWith(
      `tag ${tag} already exists at another commit: the merged PR did not bump the version`,
    );
  }
  if (releaseExists(tag)) process.exit(EXIT_OK);
}
createRelease(tag, sha);
