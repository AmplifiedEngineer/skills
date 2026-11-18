// @ts-check
/**
 * Computes the next release version from the latest `v*` git tag and a pull request title,
 * and checks that both plugin manifests already hold it.
 *
 * Usage: node scripts/version.mjs next|verify "<title>"
 */
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";

const EXIT_FAILED = 1;
const EXIT_USAGE = 2;
const USAGE = 'usage: node scripts/version.mjs next|verify "<title>"';
const NEXT = "next";
const VERIFY = "verify";
const ROOT_MANIFEST = "plugin.json";
const CLAUDE_MANIFEST = ".claude-plugin/plugin.json";
const MANIFESTS = [ROOT_MANIFEST, CLAUDE_MANIFEST];
const TEXT_ENCODING = "utf8";
const TAG_PATTERN = "v*";
const SEMVER_SOURCE = String.raw`(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)`;
const TAG_REGEX = new RegExp(`^v${SEMVER_SOURCE}$`);
const SEMVER_REGEX = new RegExp(`^${SEMVER_SOURCE}$`);
const BREAKING_REGEX = /^[a-z]+(\([^)]*\))?!:/;
const FEATURE_REGEX = /^feat(\([^)]*\))?!?:/;
const NEWLINE = "\n";
const SEMVER_FORMAT = "MAJOR.MINOR.PATCH";
const NO_VERSION = "no version";
const FAIL_PREFIX = "FAIL version:";

/** @param {string} output */
function failWith(output) {
  console.log(output);
  process.exit(EXIT_FAILED);
}

function usageError() {
  console.error(USAGE);
  process.exit(EXIT_USAGE);
}

function parseArgs() {
  const [command, title] = process.argv.slice(2);
  const firstLine = (title ?? "").trim().split(NEWLINE)[0];
  if ((command !== NEXT && command !== VERIFY) || !firstLine) usageError();
  return { command, title: firstLine };
}

/** @returns {string[]} */
function listTags() {
  try {
    const output = execFileSync("git", ["tag", "--list", TAG_PATTERN], {
      encoding: TEXT_ENCODING,
      stdio: ["ignore", "pipe", "pipe"],
    });
    return output.split(NEWLINE);
  } catch (error) {
    const detail = error.stderr?.toString().trim() || error.message;
    console.error(`git failed: ${detail}`);
    return process.exit(EXIT_FAILED);
  }
}

/** @returns {number[] | null} The highest strict `vX.Y.Z` tag as numbers, or null. */
function latestVersion() {
  const versions = listTags()
    .map((tag) => TAG_REGEX.exec(tag))
    .filter((match) => match !== null)
    .map((match) => match.slice(1).map(Number));
  // git's output order depends on the host's tag.sort setting, so sort numerically here.
  const [highest] = versions.sort(
    ([a1, b1, c1], [a2, b2, c2]) => a2 - a1 || b2 - b1 || c2 - c1,
  );
  return highest ?? null;
}

/** @returns {string | null} The manifest's string `version`, or null when unusable. */
function manifestVersion(file) {
  try {
    const { version } = JSON.parse(readFileSync(file, TEXT_ENCODING));
    return typeof version === "string" ? version : null;
  } catch {
    return null;
  }
}

function nextVersion(title) {
  const latest = latestVersion();
  if (!latest) {
    // With no tag yet, the first release takes the version the manifest already holds.
    const current = manifestVersion(ROOT_MANIFEST);
    if (current === null) failWith(`${FAIL_PREFIX} ${ROOT_MANIFEST} has ${NO_VERSION}`);
    if (!SEMVER_REGEX.test(current)) {
      failWith(`${FAIL_PREFIX} ${ROOT_MANIFEST} has ${current}, set it to ${SEMVER_FORMAT}`);
    }
    return current;
  }
  const [major, minor, patch] = latest;
  const breaking = BREAKING_REGEX.test(title);
  const feature = FEATURE_REGEX.test(title);
  if (breaking && major > 0) return `${major + 1}.0.0`;
  if (breaking || feature) return `${major}.${minor + 1}.0`;
  return `${major}.${minor}.${patch + 1}`;
}

function verify(expected) {
  const failures = MANIFESTS.flatMap((file) => {
    const actual = manifestVersion(file);
    return actual === expected
      ? []
      : [`${FAIL_PREFIX} ${file} has ${actual ?? NO_VERSION}, set it to ${expected}`];
  });
  if (failures.length > 0) failWith(failures.join(NEWLINE));
}

const { command, title } = parseArgs();
const expected = nextVersion(title);
if (command === NEXT) console.log(expected);
else verify(expected);
