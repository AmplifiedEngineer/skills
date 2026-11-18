/**
 * Static checks for the plugin tree: manifests, links, old names, skills, the researcher
 * brief, README, the shared storage contract, template Status lines and the execution
 * stop rules.
 *
 * Usage: node scripts/check.ts [repo-root]. Prints one FAIL line per problem, exit 1 if any.
 */
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import type { Dirent } from "node:fs";
import path from "node:path";

const ROOT_PLUGIN = "plugin.json";
const CLAUDE_PLUGIN = ".claude-plugin/plugin.json";
const CLAUDE_MARKET = ".claude-plugin/marketplace.json";
const CODEX_MARKET = ".agents/plugins/marketplace.json";
const README = "README.md";
const SKILLS_DIR = "skills";
const SKILLS_GLOB = "skills/**/*.md";
const SKILL_NAMES = ["planner", "implementer", "researcher"];
const SKILL_FILE = "SKILL.md";
const OLD_NAME_PATTERN = /engineering[ -](architect|implementation|context)/gi;
const LINK_PREFIXES = ["../", "references/", "workflows/", "templates/", "examples/", "agents/"];
const SKIP_PREFIXES = ["docs/", ".ae/", "#"];
const STORAGE_PLANNER = "skills/planner/references/document-storage.md";
const STORAGE_IMPLEMENTER = "skills/implementer/references/document-storage.md";
const TEMPLATES_DIR = "skills/planner/templates";
const STORAGE_LINK = "references/document-storage.md";
const STORAGE_LINK_FILES = [
  "skills/planner/workflows/documentation.md",
  "skills/planner/workflows/implementation-handover.md",
  "skills/implementer/workflows/implementation-execution.md",
];
const EXECUTION_WORKFLOW = "skills/implementer/workflows/implementation-execution.md";
const STOP_RULE_PHRASE = "stop and return the question to the planner";
const STATUS_GATE_PHRASE = "run only documents whose Status is approved";
const RESEARCHER_BRIEF = "skills/researcher/templates/context-brief.md";
const ANSWER_HEADING = "## Answer";
// One row per template: file name, then the exact Status line it must carry.
const TEMPLATE_STATUS_TABLE: ReadonlyArray<readonly [string, string]> = [
  ["implementation-plan.md", "Status: draft"],
  ["adr.md", "Status: Proposed"],
  ["architecture-assessment.md", "Status: draft"],
  ["architecture-findings.md", "Status: draft"],
  ["drift-report.md", "Status: draft"],
  ["impact-report.md", "Status: draft"],
  ["discovery-state.md", "Status: Draft"],
];

const CHECK_JSON = 1;
const CHECK_MANIFESTS = 2;
const CHECK_LINKS = 3;
const CHECK_OLD_NAMES = 4;
const CHECK_SKILLS = 5;
const CHECK_RESEARCHER = 6;
const CHECK_README = 7;
const CHECK_STORAGE_COPIES = 8;
const CHECK_TEMPLATES = 9;
const CHECK_EXECUTION = 10;

const REASON_INVALID_JSON = "invalid JSON";
const REASON_MISSING_FILE = "missing file";
const REASON_NAME_MISMATCH = "name mismatch with";
const REASON_VERSION_MISMATCH = "version mismatch with";
const REASON_BROKEN_LINK = "broken link";
const REASON_OLD_NAME = "old skill name";
const REASON_NAME_FOLDER = "does not match folder";
const REASON_UNEXPECTED_FOLDER = "unexpected skill folder";
const REASON_README_MISSING = "README missing";
const REASON_NO_ROOT = "cannot change into repo root";
const REASON_NO_FILES = "no files match";
const REASON_MISSING_NAME = "missing name";
const REASON_DIFFERS = "differs from";
const REASON_UNEXPECTED_STATUS = "unexpected Status line";
const REASON_MISSING_STORAGE_LINK = "missing link to references/document-storage.md";
const REASON_MISSING_STOP_RULE = "missing stop rule";
const REASON_MISSING_STATUS_GATE = "missing status gate";
const REASON_ANSWER_NOT_FIRST = `first section is not ${ANSWER_HEADING}`;

const WALK_SKIP_COMMON = [".git", ".ae"];
const WALK_SKIP_OLD_NAMES = [...WALK_SKIP_COMMON, "scripts", "test"];
const JSON_SUFFIX = ".json";
const MARKDOWN_SUFFIX = ".md";
const ENCODING = "utf8";
const NUL_BYTE = 0;
const NOT_BLANK = /\S/;
const STATUS_LINE_PREFIX = "Status: ";
const TITLE_PREFIX = "# ";
const SECTION_PREFIX = "## ";
const NAME_KEY_PREFIX = "name:";
const FRONTMATTER_FENCE = "---";
const MD_LINK_PATTERN = /\]\([^)]*\)/g;
const MD_LINK_OPEN = "](";
const BACKTICK_PATTERN = /`[^`]*`/g;
const BACKTICK = "`";
const MAILTO_PREFIX = "mailto:";
const URL_MARKER = "://";
const ANGLE_OPEN = "<";
const FRAGMENT_MARK = "#";
const TRAILING_BLANKS = /[ \t]+$/;
const LEADING_SPACES = /^ */;

type Json = unknown;
type JsonObject = Record<string, Json>;
type Check = () => string[];

function fail(check: number, file: string, reason: string): string {
  return `FAIL check=${check} file=${file}: ${reason}`;
}

function isFile(file: string): boolean {
  return statSync(file, { throwIfNoEntry: false })?.isFile() ?? false;
}

function isDir(dir: string): boolean {
  return statSync(dir, { throwIfNoEntry: false })?.isDirectory() ?? false;
}

function readText(file: string): string | undefined {
  try {
    return readFileSync(file, ENCODING);
  } catch {
    return undefined;
  }
}

function parseJson(file: string): { ok: true; value: Json } | { ok: false } {
  const text = readText(file);
  if (text === undefined) return { ok: false };
  // An empty or blank file counts as a valid, empty document.
  if (!NOT_BLANK.test(text)) return { ok: true, value: undefined };
  try {
    return { ok: true, value: JSON.parse(text) };
  } catch {
    return { ok: false };
  }
}

function isObject(value: Json): value is JsonObject {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

// Reads a top-level key as text: a missing, null or false value reads as "".
function jsonField(file: string, key: string): string {
  const parsed = parseJson(file);
  if (!parsed.ok || !isObject(parsed.value)) return "";
  const value = parsed.value[key];
  if (value === undefined || value === null || value === false) return "";
  return typeof value === "string" ? value : JSON.stringify(value);
}

// True when `plugins` (an array or an object of entries) lists an entry with this name;
// any other shape is false.
function hasPluginEntry(file: string, name: string): boolean {
  const parsed = parseJson(file);
  if (!parsed.ok || !isObject(parsed.value)) return false;
  const plugins = parsed.value.plugins;
  let entries: Json[];
  if (Array.isArray(plugins)) entries = plugins;
  else if (isObject(plugins)) entries = Object.values(plugins);
  else return false;
  const names: Json[] = [];
  for (const entry of entries) {
    if (entry === null) names.push(null);
    else if (isObject(entry)) names.push(entry.name ?? null);
    else return false;
  }
  return names.includes(name);
}

// Lists files under `dir` in sorted order, skipping `skip` names at the top level only.
function walk(dir: string, keep: (entry: Dirent) => boolean, skip: string[] = []): string[] {
  const found: string[] = [];
  const visit = (current: string, prefix: string, skipNames: string[]): void => {
    let entries: Dirent[];
    try {
      entries = readdirSync(current, { withFileTypes: true });
    } catch {
      return;
    }
    entries.sort((a, b) => (a.name < b.name ? -1 : a.name > b.name ? 1 : 0));
    for (const entry of entries) {
      if (skipNames.includes(entry.name)) continue;
      const rel = prefix === "" ? entry.name : `${prefix}/${entry.name}`;
      const full = current === "." ? entry.name : `${current}/${entry.name}`;
      if (entry.isDirectory()) visit(full, rel, []);
      else if (keep(entry)) found.push(rel);
    }
  };
  visit(dir, dir === "." ? "" : dir, skip);
  return found;
}

const isRegularFile = (entry: Dirent): boolean => entry.isFile();
const isNotDirectory = (entry: Dirent): boolean => !entry.isDirectory();

function checkJsonParses(): string[] {
  return walk(".", (entry) => entry.isFile() && entry.name.endsWith(JSON_SUFFIX), WALK_SKIP_COMMON)
    .filter((file) => !parseJson(file).ok)
    .map((file) => fail(CHECK_JSON, file, REASON_INVALID_JSON));
}

function checkManifests(): string[] {
  const out: string[] = [];
  const add = (file: string, reason: string): void => {
    out.push(fail(CHECK_MANIFESTS, file, reason));
  };
  for (const file of [ROOT_PLUGIN, CLAUDE_PLUGIN, CLAUDE_MARKET, CODEX_MARKET]) {
    if (!isFile(file)) add(file, REASON_MISSING_FILE);
  }
  if (!isFile(ROOT_PLUGIN)) return out;
  const refName = jsonField(ROOT_PLUGIN, "name");
  if (refName === "") {
    add(ROOT_PLUGIN, REASON_MISSING_NAME);
    return out;
  }
  const refVersion = jsonField(ROOT_PLUGIN, "version");
  if (isFile(CLAUDE_PLUGIN)) {
    if (jsonField(CLAUDE_PLUGIN, "name") !== refName) {
      add(CLAUDE_PLUGIN, `${REASON_NAME_MISMATCH} ${ROOT_PLUGIN}`);
    }
    if (jsonField(CLAUDE_PLUGIN, "version") !== refVersion) {
      add(CLAUDE_PLUGIN, `${REASON_VERSION_MISMATCH} ${ROOT_PLUGIN}`);
    }
  }
  for (const file of [CLAUDE_MARKET, CODEX_MARKET]) {
    if (!isFile(file)) continue;
    if (!hasPluginEntry(file, refName)) add(file, `${REASON_NAME_MISMATCH} ${ROOT_PLUGIN}`);
  }
  if (!isFile(CLAUDE_MARKET) || !isFile(CODEX_MARKET)) return out;
  if (jsonField(CODEX_MARKET, "name") !== jsonField(CLAUDE_MARKET, "name")) {
    add(CODEX_MARKET, `${REASON_NAME_MISMATCH} ${CLAUDE_MARKET}`);
  }
  return out;
}

type LinkKind = "link" | "backtick";
interface LinkTarget {
  kind: LinkKind;
  target: string;
}

// Link targets of a Markdown file, then backticked paths, each cut at the first fragment mark.
function linkTargets(text: string): LinkTarget[] {
  const lines = text.split("\n");
  const collect = (kind: LinkKind, pattern: RegExp, strip: (match: string) => string) =>
    lines.flatMap((line) =>
      (line.match(pattern) ?? []).map((match) => {
        const target = strip(match).split(FRAGMENT_MARK)[0] ?? "";
        // Trailing blanks are not part of the target.
        return { kind, target: target.replace(TRAILING_BLANKS, "") };
      }),
    );
  return [
    ...collect("link", MD_LINK_PATTERN, (m) => m.slice(MD_LINK_OPEN.length, -1)),
    ...collect("backtick", BACKTICK_PATTERN, (m) => m.slice(BACKTICK.length, -BACKTICK.length)),
  ];
}

function startsWithAny(value: string, prefixes: string[]): boolean {
  return prefixes.some((prefix) => value.startsWith(prefix));
}

function linkIsSkipped(target: string): boolean {
  return (
    target === "" ||
    target.includes(URL_MARKER) ||
    target.startsWith(MAILTO_PREFIX) ||
    target.includes(ANGLE_OPEN) ||
    startsWithAny(target, SKIP_PREFIXES)
  );
}

function checkLinks(): string[] {
  const files = walk(
    SKILLS_DIR,
    (entry) => isNotDirectory(entry) && entry.name.endsWith(MARKDOWN_SUFFIX),
  );
  if (files.length === 0) return [fail(CHECK_LINKS, SKILLS_GLOB, REASON_NO_FILES)];
  const out: string[] = [];
  for (const file of files) {
    const text = readText(file);
    if (text === undefined) continue;
    const dir = path.posix.dirname(file);
    for (const { kind, target } of linkTargets(text)) {
      if (linkIsSkipped(target)) continue;
      if (kind === "backtick" && !startsWithAny(target, LINK_PREFIXES)) continue;
      if (!existsSync(`${dir}/${target}`)) {
        out.push(fail(CHECK_LINKS, file, `${REASON_BROKEN_LINK} ${target}`));
      }
    }
  }
  return out;
}

function checkOldNames(): string[] {
  const out: string[] = [];
  for (const file of walk(".", isRegularFile, WALK_SKIP_OLD_NAMES)) {
    let content: Buffer;
    try {
      content = readFileSync(file);
    } catch {
      continue;
    }
    // A file with a NUL byte is binary and is skipped.
    if (content.includes(NUL_BYTE)) continue;
    for (const match of content.toString(ENCODING).matchAll(OLD_NAME_PATTERN)) {
      out.push(fail(CHECK_OLD_NAMES, file, `${REASON_OLD_NAME} ${match[0]}`));
    }
  }
  return out;
}

// The `name:` value from a leading `---` frontmatter block, or "" when there is none.
function skillFrontmatterName(file: string): string {
  const lines = (readText(file) ?? "").split("\n");
  for (const [index, line] of lines.entries()) {
    if (index === 0 && line !== FRONTMATTER_FENCE) return "";
    if (index > 0 && line === FRONTMATTER_FENCE) return "";
    if (line.startsWith(NAME_KEY_PREFIX)) {
      return line.slice(NAME_KEY_PREFIX.length).replace(LEADING_SPACES, "");
    }
  }
  return "";
}

function checkSkills(): string[] {
  const out: string[] = [];
  for (const name of SKILL_NAMES) {
    const dir = `${SKILLS_DIR}/${name}`;
    const skillFile = `${dir}/${SKILL_FILE}`;
    if (!isDir(dir)) {
      out.push(fail(CHECK_SKILLS, dir, REASON_MISSING_FILE));
    } else if (!isFile(skillFile)) {
      out.push(fail(CHECK_SKILLS, skillFile, REASON_MISSING_FILE));
    } else {
      const found = skillFrontmatterName(skillFile);
      if (found === "") {
        out.push(fail(CHECK_SKILLS, skillFile, REASON_MISSING_NAME));
      } else if (found !== name) {
        out.push(fail(CHECK_SKILLS, skillFile, `name ${found} ${REASON_NAME_FOLDER}`));
      }
    }
  }
  for (const name of visibleEntries(SKILLS_DIR)) {
    const dir = `${SKILLS_DIR}/${name}`;
    if (isDir(dir) && !SKILL_NAMES.includes(name)) {
      out.push(fail(CHECK_SKILLS, dir, REASON_UNEXPECTED_FOLDER));
    }
  }
  return out;
}

// Sorted entry names, leaving out names that start with a dot.
function visibleEntries(dir: string): string[] {
  try {
    return readdirSync(dir)
      .filter((name) => !name.startsWith("."))
      .sort();
  } catch {
    return [];
  }
}

function checkResearcherBrief(): string[] {
  const file = RESEARCHER_BRIEF;
  if (!isFile(file)) return [fail(CHECK_RESEARCHER, file, REASON_MISSING_FILE)];
  const firstSection = (readText(file) ?? "").split("\n").find((l) => l.startsWith(SECTION_PREFIX));
  return firstSection === ANSWER_HEADING
    ? []
    : [fail(CHECK_RESEARCHER, file, REASON_ANSWER_NOT_FIRST)];
}

function checkReadme(): string[] {
  if (!isFile(README)) return [fail(CHECK_README, README, REASON_MISSING_FILE)];
  const pluginName = jsonField(ROOT_PLUGIN, "name");
  const marketName = jsonField(CLAUDE_MARKET, "name");
  if (pluginName === "" || marketName === "") {
    return [fail(CHECK_README, README, REASON_MISSING_NAME)];
  }
  const installRef = `${pluginName}@${marketName}`;
  return (readText(README) ?? "").includes(installRef)
    ? []
    : [fail(CHECK_README, README, `${REASON_README_MISSING} ${installRef}`)];
}

function checkStorageCopies(): string[] {
  const missing = [STORAGE_PLANNER, STORAGE_IMPLEMENTER].filter((file) => !isFile(file));
  if (missing.length > 0) {
    return missing.map((file) => fail(CHECK_STORAGE_COPIES, file, REASON_MISSING_FILE));
  }
  const same = readFileSync(STORAGE_PLANNER).equals(readFileSync(STORAGE_IMPLEMENTER));
  return same
    ? []
    : [fail(CHECK_STORAGE_COPIES, STORAGE_IMPLEMENTER, `${REASON_DIFFERS} ${STORAGE_PLANNER}`)];
}

// The first non-blank line after the first H1, or "" when there is none.
function lineAfterTitle(text: string): string {
  let seenTitle = false;
  for (const line of text.split("\n")) {
    if (!seenTitle) {
      seenTitle = line.startsWith(TITLE_PREFIX);
    } else if (NOT_BLANK.test(line)) {
      return line;
    }
  }
  return "";
}

function templateStatusOk(file: string, expected: string): boolean {
  const text = readText(file) ?? "";
  const statusLines = text.split("\n").filter((line) => line.startsWith(STATUS_LINE_PREFIX));
  return statusLines.length === 1 && lineAfterTitle(text) === expected;
}

function checkTemplateStatuses(): string[] {
  const out: string[] = [];
  for (const [name, expected] of TEMPLATE_STATUS_TABLE) {
    const file = `${TEMPLATES_DIR}/${name}`;
    if (!isFile(file)) out.push(fail(CHECK_TEMPLATES, file, REASON_MISSING_FILE));
    else if (!templateStatusOk(file, expected)) {
      out.push(fail(CHECK_TEMPLATES, file, REASON_UNEXPECTED_STATUS));
    }
  }
  const known = TEMPLATE_STATUS_TABLE.map(([name]) => name);
  for (const name of visibleEntries(TEMPLATES_DIR)) {
    const file = `${TEMPLATES_DIR}/${name}`;
    if (isFile(file) && !known.includes(name)) {
      out.push(fail(CHECK_TEMPLATES, file, REASON_UNEXPECTED_STATUS));
    }
  }
  return out;
}

function checkStorageLinks(): string[] {
  const out: string[] = [];
  for (const file of STORAGE_LINK_FILES) {
    if (!isFile(file)) out.push(fail(CHECK_TEMPLATES, file, REASON_MISSING_FILE));
    else if (!(readText(file) ?? "").includes(STORAGE_LINK)) {
      out.push(fail(CHECK_TEMPLATES, file, REASON_MISSING_STORAGE_LINK));
    }
  }
  return out;
}

function checkExecutionPhrases(): string[] {
  const file = EXECUTION_WORKFLOW;
  if (!isFile(file)) return [fail(CHECK_EXECUTION, file, REASON_MISSING_FILE)];
  const text = readText(file) ?? "";
  const out: string[] = [];
  if (!text.includes(STOP_RULE_PHRASE)) {
    out.push(fail(CHECK_EXECUTION, file, REASON_MISSING_STOP_RULE));
  }
  if (!text.includes(STATUS_GATE_PHRASE)) {
    out.push(fail(CHECK_EXECUTION, file, REASON_MISSING_STATUS_GATE));
  }
  return out;
}

const CHECKS: Check[] = [
  checkJsonParses,
  checkManifests,
  checkLinks,
  checkOldNames,
  checkSkills,
  checkResearcherBrief,
  checkReadme,
  checkStorageCopies,
  checkTemplateStatuses,
  checkStorageLinks,
  checkExecutionPhrases,
];

function main(): number {
  const root = process.argv[2] || path.resolve(import.meta.dirname, "..");
  try {
    process.chdir(root);
  } catch {
    console.error(`${REASON_NO_ROOT} ${root}`);
    return 1;
  }
  const failures = CHECKS.flatMap((check) => check());
  if (failures.length === 0) return 0;
  console.log(failures.join("\n"));
  return 1;
}

process.exitCode = main();
