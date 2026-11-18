import assert from "node:assert/strict";
import { test } from "node:test";
import { createCopy, runCheck } from "./helpers.ts";
import type { TreeCopy } from "./helpers.ts";

const ROOT_PLUGIN = "plugin.json";
const PACKAGE_JSON = "package.json";
const CHANGELOG = "CHANGELOG.md";
const README = "README.md";
const AGENTS = "AGENTS.md";
const CLAUDE_PLUGIN = ".claude-plugin/plugin.json";
const CLAUDE_MARKET = ".claude-plugin/marketplace.json";
const CODEX_MARKET = ".agents/plugins/marketplace.json";
const SKILLS_DIR = "skills";
const SKILLS_GLOB = "skills/**/*.md";
const PLANNER_DIR = "skills/planner";
const IMPLEMENTER_DIR = "skills/implementer";
const RESEARCHER_DIR = "skills/researcher";
const SCRATCH_DIR = "skills/scratch";
const PLANNER_SKILL = "skills/planner/SKILL.md";
const IMPLEMENTER_SKILL = "skills/implementer/SKILL.md";
const RESEARCHER_SKILL = "skills/researcher/SKILL.md";
const SCRATCH_SKILL = "skills/scratch/SKILL.md";
const PLANNER_README = "skills/planner/README.md";
const IMPLEMENTER_README = "skills/implementer/README.md";
const PLANNER_DOC = "skills/planner/workflows/documentation.md";
const HANDOVER_DOC = "skills/planner/workflows/implementation-handover.md";
const EXEC_DOC = "skills/implementer/workflows/implementation-execution.md";
const STORAGE_PLANNER = "skills/planner/references/document-storage.md";
const STORAGE_IMPLEMENTER = "skills/implementer/references/document-storage.md";
const TEMPLATES_DIR = "skills/planner/templates";
const PLAN_TEMPLATE = "skills/planner/templates/implementation-plan.md";
const ADR_TEMPLATE = "skills/planner/templates/adr.md";
const EXTRA_TEMPLATE = "skills/planner/templates/extra.md";
const RESEARCHER_BRIEF = "skills/researcher/templates/context-brief.md";
const EXTRA_JSON = "skills/planner/extra.json";
const IGNORED_JSON = "node_modules/x.json";
const TEST_NOTE = "test/x.md";
const AE_JSON = ".ae/x.json";
const AE_NOTE = ".ae/x.md";

const TEMPLATE_FILES = [
  PLAN_TEMPLATE,
  ADR_TEMPLATE,
  `${TEMPLATES_DIR}/architecture-assessment.md`,
  `${TEMPLATES_DIR}/architecture-findings.md`,
  `${TEMPLATES_DIR}/drift-report.md`,
  `${TEMPLATES_DIR}/impact-report.md`,
  `${TEMPLATES_DIR}/discovery-state.md`,
];
const STORAGE_LINK_FILES = [PLANNER_DOC, HANDOVER_DOC, EXEC_DOC];
const WRONG_STATUS_TEMPLATES = [
  [62, "architecture-assessment.md"],
  [63, "architecture-findings.md"],
  [64, "drift-report.md"],
  [65, "impact-report.md"],
  [66, "discovery-state.md"],
] as const;

const BAD_JSON = "{\n";
const WRONG_VERSION = "9.9.9";
const WRONG_NAME = "other";
const MARKETPLACE_NAME = "amplifiedengineer";
const OLD_NAME_TEXT = "Engineering Architect";
const STATUS_DRAFT = "Status: draft";
const STATUS_WRONG = "Status: wrong";
const ANSWER_HEADING = "## Answer";
const STORAGE_LINK_TEXT = "document-storage.md";
const STORAGE_LINK_TARGET = "references/document-storage.md";
const STOP_RULE_TEXT = "stop and return the question to the planner";
const STATUS_GATE_TEXT = "run only documents whose Status is approved";
const FENCE = "```";

const INVALID_JSON = "invalid JSON";
const MISSING_FILE = "missing file";
const MISSING_NAME = "missing name";
const NAME_MISMATCH = "name mismatch with";
const VERSION_MISMATCH = "version mismatch with";
const BROKEN_LINK = "broken link";
const OLD_NAME = "old skill name";
const NO_FILES = "no files match";
const UNEXPECTED_STATUS = "unexpected Status line";
const UNEXPECTED_FOLDER = "unexpected skill folder";
const NOT_FIRST_ANSWER = `first section is not ${ANSWER_HEADING}`;
const MISSING_STORAGE_LINK = `missing link to ${STORAGE_LINK_TARGET}`;
const MISSING_STOP_RULE = "missing stop rule";
const MISSING_STATUS_GATE = "missing status gate";
const README_MISSING = "README missing";
const DIFFERS = "differs from";
const NAME_MISMATCH_ROOT = `${NAME_MISMATCH} ${ROOT_PLUGIN}`;
const VERSION_MISMATCH_ROOT = `${VERSION_MISMATCH} ${ROOT_PLUGIN}`;
const NAME_MISMATCH_CLAUDE_MARKET = `${NAME_MISMATCH} ${CLAUDE_MARKET}`;
const README_MISSING_INSTALL = `${README_MISSING} ae@${MARKETPLACE_NAME}`;

const EXIT_CLEAN = 0;
const EXIT_FAILED = 1;

const EXPECTED_CASE_IDS = [
  1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 22, 23, 24, 25, 26,
  28, 29, 30, 31, 32, 33, 34, 35, 36, 37, 38, 39, 40, 41, 42, 43, 44, 45, 46, 47, 48, 49,
  50, 51, 52, 53, 54, 55, 56, 57, 60, 61, 62, 63, 64, 65, 66, 67, 69, 70, 71, 73, 75, 76,
  86, 87, 94, 97, 98, 99,
];

interface CheckCase {
  id: number;
  fault: string;
  apply: (copy: TreeCopy) => void;
  lines: string[];
}

const registeredIds: number[] = [];

function fail(check: number, file: string, reason: string): string {
  return `FAIL check=${check} file=${file}: ${reason}`;
}

function missing(check: number, files: string[]): string[] {
  return files.map((file) => fail(check, file, MISSING_FILE));
}

function defineCase(spec: CheckCase): void {
  registeredIds.push(spec.id);
  test(`case ${spec.id}: ${spec.fault}`, (t) => {
    // Arrange
    const copy = createCopy(t);
    spec.apply(copy);

    // Act
    const result = runCheck(copy.root);

    // Assert
    assert.deepEqual(result.lines, spec.lines);
    assert.equal(result.code, spec.lines.length === 0 ? EXIT_CLEAN : EXIT_FAILED);
  });
}

interface InvalidJsonRow {
  id: number;
  file: string;
  lines: string[];
}

const invalidJsonRows: InvalidJsonRow[] = [
  {
    id: 2,
    file: ROOT_PLUGIN,
    lines: [
      fail(1, ROOT_PLUGIN, INVALID_JSON),
      fail(2, ROOT_PLUGIN, MISSING_NAME),
      fail(7, README, MISSING_NAME),
    ],
  },
  {
    id: 45,
    file: CLAUDE_MARKET,
    lines: [
      fail(1, CLAUDE_MARKET, INVALID_JSON),
      fail(2, CLAUDE_MARKET, NAME_MISMATCH_ROOT),
      fail(2, CODEX_MARKET, NAME_MISMATCH_CLAUDE_MARKET),
      fail(7, README, MISSING_NAME),
    ],
  },
  {
    id: 54,
    file: CLAUDE_PLUGIN,
    lines: [
      fail(1, CLAUDE_PLUGIN, INVALID_JSON),
      fail(2, CLAUDE_PLUGIN, NAME_MISMATCH_ROOT),
      fail(2, CLAUDE_PLUGIN, VERSION_MISMATCH_ROOT),
    ],
  },
  {
    id: 55,
    file: CODEX_MARKET,
    lines: [
      fail(1, CODEX_MARKET, INVALID_JSON),
      fail(2, CODEX_MARKET, NAME_MISMATCH_ROOT),
      fail(2, CODEX_MARKET, NAME_MISMATCH_CLAUDE_MARKET),
    ],
  },
  { id: 56, file: EXTRA_JSON, lines: [fail(1, EXTRA_JSON, INVALID_JSON)] },
];

for (const row of invalidJsonRows) {
  defineCase({
    id: row.id,
    fault: `${row.file} content is {`,
    apply: (copy) => copy.write(row.file, BAD_JSON),
    lines: row.lines,
  });
}

const nameMismatchCases: CheckCase[] = [
  {
    id: 5,
    fault: "claude plugin.json name -> other",
    apply: (copy) => copy.editJson(CLAUDE_PLUGIN, (json) => (json.name = WRONG_NAME)),
    lines: [fail(2, CLAUDE_PLUGIN, NAME_MISMATCH_ROOT)],
  },
  {
    id: 6,
    fault: "claude marketplace.json plugin entry name -> other",
    apply: (copy) => copy.editJson(CLAUDE_MARKET, (json) => (json.plugins[0].name = WRONG_NAME)),
    lines: [fail(2, CLAUDE_MARKET, NAME_MISMATCH_ROOT)],
  },
  {
    id: 7,
    fault: "codex marketplace.json plugin entry name -> other",
    apply: (copy) => copy.editJson(CODEX_MARKET, (json) => (json.plugins[0].name = WRONG_NAME)),
    lines: [fail(2, CODEX_MARKET, NAME_MISMATCH_ROOT)],
  },
  {
    id: 8,
    fault: "root plugin.json name -> other",
    apply: (copy) => copy.editJson(ROOT_PLUGIN, (json) => (json.name = WRONG_NAME)),
    lines: [
      fail(2, CLAUDE_PLUGIN, NAME_MISMATCH_ROOT),
      fail(2, CLAUDE_MARKET, NAME_MISMATCH_ROOT),
      fail(2, CODEX_MARKET, NAME_MISMATCH_ROOT),
      fail(7, README, `${README_MISSING} ${WRONG_NAME}@${MARKETPLACE_NAME}`),
    ],
  },
  {
    id: 87,
    fault: "codex marketplace.json marketplace name -> other",
    apply: (copy) => copy.editJson(CODEX_MARKET, (json) => (json.name = WRONG_NAME)),
    lines: [fail(2, CODEX_MARKET, NAME_MISMATCH_CLAUDE_MARKET)],
  },
];

for (const spec of nameMismatchCases) defineCase(spec);

interface StatusRow {
  id: number;
  fault: string;
  file: string;
  apply: (copy: TreeCopy) => void;
}

const dropStatusLines = (copy: TreeCopy, file: string) =>
  copy.dropLines(file, (line) => line.startsWith("Status: "));

const statusRows: StatusRow[] = [
  {
    id: 32,
    fault: "implementation-plan.md Status: draft -> approved",
    file: PLAN_TEMPLATE,
    apply: (copy) => copy.replace(PLAN_TEMPLATE, /^Status: draft$/m, "Status: approved"),
  },
  {
    id: 33,
    fault: "add templates/extra.md containing Status: draft",
    file: EXTRA_TEMPLATE,
    apply: (copy) => copy.write(EXTRA_TEMPLATE, `${STATUS_DRAFT}\n`),
  },
  {
    id: 47,
    fault: "delete the Status line from templates/adr.md",
    file: ADR_TEMPLATE,
    apply: (copy) => dropStatusLines(copy, ADR_TEMPLATE),
  },
  ...WRONG_STATUS_TEMPLATES.map(([id, name]) => ({
    id,
    fault: `${name} Status line -> ${STATUS_WRONG}`,
    file: `${TEMPLATES_DIR}/${name}`,
    apply: (copy: TreeCopy) =>
      copy.replace(`${TEMPLATES_DIR}/${name}`, /^Status: .*$/m, STATUS_WRONG),
  })),
  {
    id: 71,
    fault: "append an extra Status: draft line to implementation-plan.md",
    file: PLAN_TEMPLATE,
    apply: (copy) => copy.append(PLAN_TEMPLATE, STATUS_DRAFT),
  },
  {
    id: 76,
    fault: "move the Status line of implementation-plan.md to the end",
    file: PLAN_TEMPLATE,
    apply: (copy) => {
      dropStatusLines(copy, PLAN_TEMPLATE);
      copy.append(PLAN_TEMPLATE, STATUS_DRAFT);
    },
  },
];

for (const row of statusRows) {
  defineCase({
    id: row.id,
    fault: row.fault,
    apply: row.apply,
    lines: [fail(9, row.file, UNEXPECTED_STATUS)],
  });
}

interface AppendRow {
  id: number;
  file: string;
  text: string;
  reportedAs: string;
}

const brokenLinkRows: AppendRow[] = [
  {
    id: 9,
    file: PLANNER_DOC,
    text: "[x](../references/missing.md)",
    reportedAs: "../references/missing.md",
  },
  {
    id: 10,
    file: PLANNER_SKILL,
    text: "`references/missing.md`",
    reportedAs: "references/missing.md",
  },
  { id: 11, file: PLANNER_DOC, text: "[licence](LICENSE)", reportedAs: "LICENSE" },
  {
    id: 46,
    file: PLANNER_SKILL,
    text: "`templates/missing.md`",
    reportedAs: "templates/missing.md",
  },
  {
    id: 50,
    file: PLANNER_SKILL,
    text: "`workflows/missing.md`",
    reportedAs: "workflows/missing.md",
  },
  { id: 51, file: PLANNER_SKILL, text: "`examples/missing.md`", reportedAs: "examples/missing.md" },
  { id: 52, file: PLANNER_SKILL, text: "`agents/missing.yaml`", reportedAs: "agents/missing.yaml" },
  { id: 53, file: PLANNER_DOC, text: "`../missing.md`", reportedAs: "../missing.md" },
  {
    id: 67,
    file: PLANNER_SKILL,
    text: "[x](references/missing.md#section)",
    reportedAs: "references/missing.md",
  },
  {
    id: 69,
    file: PLANNER_SKILL,
    text: `${FENCE}\n[x](references/missing.md)\n${FENCE}`,
    reportedAs: "references/missing.md",
  },
];

for (const row of brokenLinkRows) {
  defineCase({
    id: row.id,
    fault: `append ${row.text.replaceAll("\n", " ")} to ${row.file}`,
    apply: (copy) => copy.append(row.file, row.text),
    lines: [fail(3, row.file, `${BROKEN_LINK} ${row.reportedAs}`)],
  });
}

const oldNameRows: AppendRow[] = [
  { id: 13, file: IMPLEMENTER_README, text: OLD_NAME_TEXT, reportedAs: OLD_NAME_TEXT },
  {
    id: 42,
    file: IMPLEMENTER_README,
    text: "engineering-architect",
    reportedAs: "engineering-architect",
  },
  {
    id: 43,
    file: PLANNER_README,
    text: "ENGINEERING-IMPLEMENTATION",
    reportedAs: "ENGINEERING-IMPLEMENTATION",
  },
  { id: 44, file: README, text: "engineering context", reportedAs: "engineering context" },
  { id: 73, file: AGENTS, text: "engineering-context", reportedAs: "engineering-context" },
];

for (const row of oldNameRows) {
  defineCase({
    id: row.id,
    fault: `append '${row.text}' to ${row.file}`,
    apply: (copy) => copy.append(row.file, row.text),
    lines: [fail(4, row.file, `${OLD_NAME} ${row.reportedAs}`)],
  });
}

interface RemoveRow {
  id: number;
  path: string;
  lines: string[];
}

const removeRows: RemoveRow[] = [
  { id: 4, path: CODEX_MARKET, lines: missing(2, [CODEX_MARKET]) },
  {
    id: 22,
    path: ROOT_PLUGIN,
    lines: [...missing(2, [ROOT_PLUGIN]), fail(7, README, MISSING_NAME)],
  },
  { id: 23, path: CLAUDE_PLUGIN, lines: missing(2, [CLAUDE_PLUGIN]) },
  {
    id: 24,
    path: CLAUDE_MARKET,
    lines: [...missing(2, [CLAUDE_MARKET]), fail(7, README, MISSING_NAME)],
  },
  { id: 25, path: README, lines: missing(7, [README]) },
  {
    id: 29,
    path: STORAGE_IMPLEMENTER,
    lines: [
      fail(3, EXEC_DOC, `${BROKEN_LINK} ../${STORAGE_LINK_TARGET}`),
      ...missing(8, [STORAGE_IMPLEMENTER]),
    ],
  },
  {
    id: 30,
    path: STORAGE_PLANNER,
    lines: [
      fail(3, PLANNER_SKILL, `${BROKEN_LINK} ${STORAGE_LINK_TARGET}`),
      fail(3, PLANNER_DOC, `${BROKEN_LINK} ../${STORAGE_LINK_TARGET}`),
      fail(3, HANDOVER_DOC, `${BROKEN_LINK} ../${STORAGE_LINK_TARGET}`),
      ...missing(8, [STORAGE_PLANNER]),
    ],
  },
  { id: 39, path: EXEC_DOC, lines: [...missing(9, [EXEC_DOC]), ...missing(10, [EXEC_DOC])] },
  {
    id: 41,
    path: RESEARCHER_BRIEF,
    lines: [
      fail(3, RESEARCHER_SKILL, `${BROKEN_LINK} templates/context-brief.md`),
      ...missing(6, [RESEARCHER_BRIEF]),
    ],
  },
  { id: 57, path: PLANNER_SKILL, lines: missing(5, [PLANNER_SKILL]) },
  {
    id: 60,
    path: PLANNER_DOC,
    lines: [
      fail(3, PLANNER_SKILL, `${BROKEN_LINK} workflows/documentation.md`),
      ...missing(9, [PLANNER_DOC]),
    ],
  },
  {
    id: 61,
    path: HANDOVER_DOC,
    lines: [
      fail(3, PLANNER_SKILL, `${BROKEN_LINK} workflows/implementation-handover.md`),
      ...missing(9, [HANDOVER_DOC]),
    ],
  },
];

for (const row of removeRows) {
  defineCase({
    id: row.id,
    fault: `remove ${row.path}`,
    apply: (copy) => copy.remove(row.path),
    lines: row.lines,
  });
}

const dropRows = [
  {
    id: 34,
    file: PLANNER_DOC,
    text: STORAGE_LINK_TEXT,
    line: fail(9, PLANNER_DOC, MISSING_STORAGE_LINK),
  },
  {
    id: 35,
    file: HANDOVER_DOC,
    text: STORAGE_LINK_TEXT,
    line: fail(9, HANDOVER_DOC, MISSING_STORAGE_LINK),
  },
  {
    id: 36,
    file: EXEC_DOC,
    text: STORAGE_LINK_TEXT,
    line: fail(9, EXEC_DOC, MISSING_STORAGE_LINK),
  },
  { id: 37, file: EXEC_DOC, text: STOP_RULE_TEXT, line: fail(10, EXEC_DOC, MISSING_STOP_RULE) },
  { id: 38, file: EXEC_DOC, text: STATUS_GATE_TEXT, line: fail(10, EXEC_DOC, MISSING_STATUS_GATE) },
];

for (const row of dropRows) {
  defineCase({
    id: row.id,
    fault: `delete lines containing '${row.text}' from ${row.file}`,
    apply: (copy) => copy.dropLines(row.file, (line) => line.includes(row.text)),
    lines: [row.line],
  });
}

defineCase({ id: 1, fault: "no fault, clean tree baseline", apply: () => {}, lines: [] });

defineCase({
  id: 3,
  fault: "claude plugin.json version -> 9.9.9",
  apply: (copy) => copy.editJson(CLAUDE_PLUGIN, (json) => (json.version = WRONG_VERSION)),
  lines: [fail(2, CLAUDE_PLUGIN, VERSION_MISMATCH_ROOT)],
});

defineCase({
  id: 12,
  fault: "append ignorable links to documentation.md",
  apply: (copy) => {
    for (const text of [
      "[x](docs/ae/plans/x.md)",
      "[x](.ae/plans/x.md)",
      "`docs/ae/plans/x.md`",
      "`.ae/plans/x.md`",
      "[x](../SKILL.md#section)",
      "`references/<name>.md`",
      "[x](#anchor)",
      "[x](https://example.com)",
    ]) {
      copy.append(PLANNER_DOC, text);
    }
  },
  lines: [],
});

defineCase({
  id: 14,
  fault: "planner SKILL.md name: planner -> name: plan",
  apply: (copy) => copy.replace(PLANNER_SKILL, /^name: planner$/m, "name: plan"),
  lines: [fail(5, PLANNER_SKILL, "name plan does not match folder")],
});

defineCase({
  id: 15,
  fault: "add skills/scratch/SKILL.md",
  apply: (copy) => copy.write(SCRATCH_SKILL, "---\nname: scratch\n---\n"),
  lines: [fail(5, SCRATCH_DIR, UNEXPECTED_FOLDER)],
});

defineCase({
  id: 16,
  fault: "remove skills/researcher",
  apply: (copy) => copy.remove(RESEARCHER_DIR),
  lines: [...missing(5, [RESEARCHER_DIR]), ...missing(6, [RESEARCHER_BRIEF])],
});

defineCase({
  id: 17,
  fault: "remove the whole skills dir",
  apply: (copy) => copy.remove(SKILLS_DIR),
  lines: [
    fail(3, SKILLS_GLOB, NO_FILES),
    ...missing(5, [PLANNER_DIR, IMPLEMENTER_DIR, RESEARCHER_DIR]),
    ...missing(6, [RESEARCHER_BRIEF]),
    ...missing(8, [STORAGE_PLANNER, STORAGE_IMPLEMENTER]),
    ...missing(9, [...TEMPLATE_FILES, ...STORAGE_LINK_FILES]),
    ...missing(10, [EXEC_DOC]),
  ],
});

defineCase({
  id: 18,
  fault: "README ae@amplifiedengineer -> x@amplifiedengineer",
  apply: (copy) => copy.replace(README, `ae@${MARKETPLACE_NAME}`, `x@${MARKETPLACE_NAME}`),
  lines: [fail(7, README, README_MISSING_INSTALL)],
});

defineCase({
  id: 19,
  fault: "README every @amplifiedengineer -> @x",
  apply: (copy) => copy.replace(README, `@${MARKETPLACE_NAME}`, "@x"),
  lines: [fail(7, README, README_MISSING_INSTALL)],
});

defineCase({
  id: 26,
  fault: "delete every markdown file under skills, folders remain",
  apply: (copy) => copy.removeMarkdownUnder(SKILLS_DIR),
  lines: [
    fail(3, SKILLS_GLOB, NO_FILES),
    ...missing(5, [PLANNER_SKILL, IMPLEMENTER_SKILL, RESEARCHER_SKILL]),
    ...missing(6, [RESEARCHER_BRIEF]),
    ...missing(8, [STORAGE_PLANNER, STORAGE_IMPLEMENTER]),
    ...missing(9, [...TEMPLATE_FILES, ...STORAGE_LINK_FILES]),
    ...missing(10, [EXEC_DOC]),
  ],
});

defineCase({
  id: 28,
  fault: "append x to the implementer document-storage.md",
  apply: (copy) => copy.append(STORAGE_IMPLEMENTER, "x"),
  lines: [fail(8, STORAGE_IMPLEMENTER, `${DIFFERS} ${STORAGE_PLANNER}`)],
});

defineCase({
  id: 31,
  fault: `remove ${PLAN_TEMPLATE}`,
  apply: (copy) => copy.remove(PLAN_TEMPLATE),
  lines: missing(9, [PLAN_TEMPLATE]),
});

defineCase({
  id: 40,
  fault: "delete the ## Answer heading in the researcher brief",
  apply: (copy) => copy.dropLines(RESEARCHER_BRIEF, (line) => line === ANSWER_HEADING),
  lines: [fail(6, RESEARCHER_BRIEF, NOT_FIRST_ANSWER)],
});

defineCase({
  id: 48,
  fault: "researcher brief ## Answer -> ## Summary",
  apply: (copy) => copy.replace(RESEARCHER_BRIEF, /^## Answer$/m, "## Summary"),
  lines: [fail(6, RESEARCHER_BRIEF, NOT_FIRST_ANSWER)],
});

defineCase({
  id: 49,
  fault: "move ## Answer to the end of the researcher brief",
  apply: (copy) => {
    copy.dropLines(RESEARCHER_BRIEF, (line) => line === ANSWER_HEADING);
    copy.append(RESEARCHER_BRIEF, ANSWER_HEADING);
  },
  lines: [fail(6, RESEARCHER_BRIEF, NOT_FIRST_ANSWER)],
});

defineCase({
  id: 70,
  fault: "delete the name: line from planner SKILL.md",
  apply: (copy) => copy.dropLines(PLANNER_SKILL, (line) => line.startsWith("name:")),
  lines: [fail(5, PLANNER_SKILL, MISSING_NAME)],
});

defineCase({
  id: 75,
  fault: "untracked .ae/ with invalid JSON and an old skill name is skipped",
  apply: (copy) => {
    copy.write(AE_JSON, BAD_JSON);
    copy.write(AE_NOTE, `${OLD_NAME_TEXT}\n`);
  },
  lines: [],
});

defineCase({
  id: 86,
  fault: "delete the name key from root plugin.json",
  apply: (copy) => copy.editJson(ROOT_PLUGIN, (json) => delete json.name),
  lines: [fail(2, ROOT_PLUGIN, MISSING_NAME), fail(7, README, MISSING_NAME)],
});

defineCase({
  id: 94,
  fault: "test/ holding an old skill name is skipped",
  apply: (copy) => {
    copy.write(TEST_NOTE, `${OLD_NAME_TEXT}\n`);
    assert.ok(copy.exists(TEST_NOTE));
  },
  lines: [],
});

defineCase({
  id: 97,
  fault: "CHANGELOG.md quoting an old skill name fails",
  apply: (copy) => copy.write(CHANGELOG, `${OLD_NAME_TEXT}\n`),
  lines: [fail(4, CHANGELOG, `${OLD_NAME} ${OLD_NAME_TEXT}`)],
});

defineCase({
  id: 98,
  fault: "node_modules with invalid JSON fails the JSON check",
  apply: (copy) => copy.write(IGNORED_JSON, BAD_JSON),
  lines: [fail(1, IGNORED_JSON, INVALID_JSON)],
});

defineCase({
  id: 99,
  fault: "a package.json with version 9.9.9 gives no failure",
  apply: (copy) =>
    copy.write(PACKAGE_JSON, `${JSON.stringify({ name: WRONG_NAME, version: WRONG_VERSION })}\n`),
  lines: [],
});

test("every expected check case is defined exactly once", () => {
  // Arrange
  const names = registeredIds.map((id) => `case ${id}`);

  // Act
  const expected = EXPECTED_CASE_IDS.map((id) => `case ${id}`);

  // Assert
  assert.deepEqual([...names].sort(), [...expected].sort());
  assert.equal(new Set(names).size, names.length);
});
