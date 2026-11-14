#!/bin/sh
# Static checks for the plugin tree: manifests, links, old names, skills, the researcher
# brief, README, the shared storage contract, template Status lines and the execution stop rules.
# Usage: sh scripts/check.sh [repo-root]. Prints one FAIL line per problem, exit 1 if any.
# Requires jq.

ROOT_PLUGIN="plugin.json"
CLAUDE_PLUGIN=".claude-plugin/plugin.json"
CLAUDE_MARKET=".claude-plugin/marketplace.json"
CODEX_MARKET=".agents/plugins/marketplace.json"
README="README.md"
SKILLS_DIR="skills"
SKILLS_GLOB="skills/**/*.md"
SKILL_NAMES="planner implementer researcher"
SKILL_FILE="SKILL.md"
OLD_NAME_PATTERN='engineering[ -](architect|implementation|context)'
LINK_PREFIXES="../ references/ workflows/ templates/ examples/ agents/"
SKIP_PREFIXES="docs/ .playbook/ #"
STORAGE_PLANNER="skills/planner/references/document-storage.md"
STORAGE_IMPLEMENTER="skills/implementer/references/document-storage.md"
TEMPLATES_DIR="skills/planner/templates"
STORAGE_LINK="references/document-storage.md"
STORAGE_LINK_FILES="skills/planner/workflows/documentation.md
skills/planner/workflows/implementation-handover.md
skills/implementer/workflows/implementation-execution.md"
EXECUTION_WORKFLOW="skills/implementer/workflows/implementation-execution.md"
STOP_RULE_PHRASE="stop and return the question to the planner"
STATUS_GATE_PHRASE="run only documents whose Status is approved"
RESEARCHER_BRIEF="skills/researcher/templates/context-brief.md"
ANSWER_HEADING="## Answer"
# One row per template: file name, then the exact Status line it must carry.
TEMPLATE_STATUS_TABLE="implementation-plan.md|Status: draft
adr.md|Status: Proposed
architecture-assessment.md|Status: draft
architecture-findings.md|Status: draft
drift-report.md|Status: draft
impact-report.md|Status: draft
discovery-state.md|Status: Draft"

REASON_INVALID_JSON="invalid JSON"
REASON_MISSING_FILE="missing file"
REASON_NAME_MISMATCH="name mismatch with"
REASON_VERSION_MISMATCH="version mismatch with"
REASON_BROKEN_LINK="broken link"
REASON_OLD_NAME="old skill name"
REASON_NAME_FOLDER="does not match folder"
REASON_UNEXPECTED_FOLDER="unexpected skill folder"
REASON_README_MISSING="README missing"
REASON_NO_FILES="no files match"
REASON_MISSING_NAME="missing name"
REASON_DIFFERS="differs from"
REASON_UNEXPECTED_STATUS="unexpected Status line"
REASON_MISSING_STORAGE_LINK="missing link to references/document-storage.md"
REASON_MISSING_STOP_RULE="missing stop rule"
REASON_MISSING_STATUS_GATE="missing status gate"
REASON_ANSWER_NOT_FIRST="first section is not $ANSWER_HEADING"

fail() { echo "FAIL check=$1 file=$2: $3"; }

json_name() { jq -r '.name // empty' "$1" 2>/dev/null; }

has_plugin_entry() {
  jq -e --arg n "$2" '.plugins | map(.name) | index($n) != null' "$1" >/dev/null 2>&1
}

check_json_parses() {
  find . \( -path ./.git -o -path ./.playbook \) -prune -o -type f -name '*.json' -print |
    while IFS= read -r f; do
      f=${f#./}
      jq empty "$f" >/dev/null 2>&1 || fail 1 "$f" "$REASON_INVALID_JSON"
    done
}

check_manifests() {
  for f in "$ROOT_PLUGIN" "$CLAUDE_PLUGIN" "$CLAUDE_MARKET" "$CODEX_MARKET"; do
    [ -f "$f" ] || fail 2 "$f" "$REASON_MISSING_FILE"
  done
  [ -f "$ROOT_PLUGIN" ] || return 0
  ref_name=$(json_name "$ROOT_PLUGIN")
  if [ -z "$ref_name" ]; then
    fail 2 "$ROOT_PLUGIN" "$REASON_MISSING_NAME"
    return 0
  fi
  if [ -f "$CLAUDE_PLUGIN" ]; then
    [ "$(json_name "$CLAUDE_PLUGIN")" = "$ref_name" ] ||
      fail 2 "$CLAUDE_PLUGIN" "$REASON_NAME_MISMATCH $ROOT_PLUGIN"
    [ "$(jq -r '.version // empty' "$CLAUDE_PLUGIN" 2>/dev/null)" = \
      "$(jq -r '.version // empty' "$ROOT_PLUGIN" 2>/dev/null)" ] ||
      fail 2 "$CLAUDE_PLUGIN" "$REASON_VERSION_MISMATCH $ROOT_PLUGIN"
  fi
  for f in "$CLAUDE_MARKET" "$CODEX_MARKET"; do
    [ -f "$f" ] || continue
    has_plugin_entry "$f" "$ref_name" || fail 2 "$f" "$REASON_NAME_MISMATCH $ROOT_PLUGIN"
  done
  [ -f "$CLAUDE_MARKET" ] && [ -f "$CODEX_MARKET" ] || return 0
  [ "$(json_name "$CODEX_MARKET")" = "$(json_name "$CLAUDE_MARKET")" ] ||
    fail 2 "$CODEX_MARKET" "$REASON_NAME_MISMATCH $CLAUDE_MARKET"
}

# Prints each link target of a Markdown file: link targets, then backticked paths.
link_targets() {
  grep -o '\]([^)]*)' "$1" | sed 's/^\](//; s/)$//' | sed 's/#.*//' | sed 's/^/L /'
  grep -o '`[^`]*`' "$1" | sed 's/^`//; s/`$//' | sed 's/#.*//' | sed 's/^/B /'
}

starts_with_any() {
  for p in $2; do
    case "$1" in "$p"*) return 0 ;; esac
  done
  return 1
}

link_is_skipped() {
  case "$1" in
    "" | *://* | mailto:* | *"<"*) return 0 ;;
  esac
  starts_with_any "$1" "$SKIP_PREFIXES"
}

check_links() {
  files=$(find "$SKILLS_DIR" -name '*.md' 2>/dev/null)
  if [ -z "$files" ]; then
    fail 3 "$SKILLS_GLOB" "$REASON_NO_FILES"
    return 0
  fi
  printf '%s\n' "$files" | while IFS= read -r f; do
    dir=$(dirname "$f")
    link_targets "$f" | while IFS= read -r line; do
      kind=${line%% *}
      target=${line#* }
      [ "$line" != "$kind" ] || continue
      link_is_skipped "$target" && continue
      if [ "$kind" = B ]; then
        starts_with_any "$target" "$LINK_PREFIXES" || continue
      fi
      [ -e "$dir/$target" ] || fail 3 "$f" "$REASON_BROKEN_LINK $target"
    done
  done
}

check_old_names() {
  find . \( -path ./.git -o -path ./.playbook -o -path ./scripts \) -prune -o -type f -print |
    while IFS= read -r f; do
      grep -IioE "$OLD_NAME_PATTERN" "$f" 2>/dev/null | while IFS= read -r match; do
        fail 4 "${f#./}" "$REASON_OLD_NAME $match"
      done
    done
}

skill_frontmatter_name() {
  awk 'NR == 1 && $0 != "---" { exit }
       NR > 1 && $0 == "---" { exit }
       /^name:/ { sub(/^name:[ ]*/, ""); print; exit }' "$1"
}

check_skills() {
  for n in $SKILL_NAMES; do
    if [ ! -d "$SKILLS_DIR/$n" ]; then
      fail 5 "$SKILLS_DIR/$n" "$REASON_MISSING_FILE"
    elif [ ! -f "$SKILLS_DIR/$n/$SKILL_FILE" ]; then
      fail 5 "$SKILLS_DIR/$n/$SKILL_FILE" "$REASON_MISSING_FILE"
    else
      found=$(skill_frontmatter_name "$SKILLS_DIR/$n/$SKILL_FILE")
      if [ -z "$found" ]; then
        fail 5 "$SKILLS_DIR/$n/$SKILL_FILE" "$REASON_MISSING_NAME"
      elif [ "$found" != "$n" ]; then
        fail 5 "$SKILLS_DIR/$n/$SKILL_FILE" "name $found $REASON_NAME_FOLDER"
      fi
    fi
  done
  for d in "$SKILLS_DIR"/*/; do
    [ -d "$d" ] || continue
    d=${d%/}
    case " $SKILL_NAMES " in
      *" ${d##*/} "*) ;;
      *) fail 5 "$d" "$REASON_UNEXPECTED_FOLDER" ;;
    esac
  done
}

check_researcher_brief() {
  f="$RESEARCHER_BRIEF"
  if [ ! -f "$f" ]; then
    fail 6 "$f" "$REASON_MISSING_FILE"
    return 0
  fi
  [ "$(grep -m 1 '^## ' "$f")" = "$ANSWER_HEADING" ] ||
    fail 6 "$f" "$REASON_ANSWER_NOT_FIRST"
}

check_readme() {
  if [ ! -f "$README" ]; then
    fail 7 "$README" "$REASON_MISSING_FILE"
    return 0
  fi
  plugin_name=$(json_name "$ROOT_PLUGIN")
  market_name=$(json_name "$CLAUDE_MARKET")
  for n in "$plugin_name" "$market_name"; do
    if [ -z "$n" ]; then
      fail 7 "$README" "$REASON_MISSING_NAME"
      continue
    fi
    grep -Fq -- "$n" "$README" || fail 7 "$README" "$REASON_README_MISSING $n"
  done
}

check_storage_copies() {
  ok=1
  for f in "$STORAGE_PLANNER" "$STORAGE_IMPLEMENTER"; do
    [ -f "$f" ] || { fail 8 "$f" "$REASON_MISSING_FILE"; ok=0; }
  done
  [ "$ok" = 1 ] || return 0
  cmp -s "$STORAGE_PLANNER" "$STORAGE_IMPLEMENTER" ||
    fail 8 "$STORAGE_IMPLEMENTER" "$REASON_DIFFERS $STORAGE_PLANNER"
}

# Prints the first non-blank line after the H1.
line_after_title() {
  awk '!h && /^# / { h = 1; next }
       h && NF { print; exit }' "$1"
}

template_status_ok() {
  [ "$(grep -c '^Status: ' "$1")" = 1 ] &&
    [ "$(line_after_title "$1")" = "$2" ]
}

check_template_statuses() {
  printf '%s\n' "$TEMPLATE_STATUS_TABLE" | while IFS='|' read -r name expected; do
    f="$TEMPLATES_DIR/$name"
    if [ ! -f "$f" ]; then
      fail 9 "$f" "$REASON_MISSING_FILE"
    else
      template_status_ok "$f" "$expected" || fail 9 "$f" "$REASON_UNEXPECTED_STATUS"
    fi
  done
  for f in "$TEMPLATES_DIR"/*; do
    [ -f "$f" ] || continue
    printf '%s\n' "$TEMPLATE_STATUS_TABLE" | grep -q "^${f##*/}|" ||
      fail 9 "$f" "$REASON_UNEXPECTED_STATUS"
  done
}

check_storage_links() {
  printf '%s\n' "$STORAGE_LINK_FILES" | while IFS= read -r f; do
    if [ ! -f "$f" ]; then
      fail 9 "$f" "$REASON_MISSING_FILE"
    else
      grep -Fq -- "$STORAGE_LINK" "$f" || fail 9 "$f" "$REASON_MISSING_STORAGE_LINK"
    fi
  done
}

check_execution_phrases() {
  f="$EXECUTION_WORKFLOW"
  if [ ! -f "$f" ]; then
    fail 10 "$f" "$REASON_MISSING_FILE"
    return 0
  fi
  grep -Fq -- "$STOP_RULE_PHRASE" "$f" || fail 10 "$f" "$REASON_MISSING_STOP_RULE"
  grep -Fq -- "$STATUS_GATE_PHRASE" "$f" || fail 10 "$f" "$REASON_MISSING_STATUS_GATE"
}

run_checks() {
  check_json_parses
  check_manifests
  check_links
  check_old_names
  check_skills
  check_researcher_brief
  check_readme
  check_storage_copies
  check_template_statuses
  check_storage_links
  check_execution_phrases
}

root=${1:-$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd)}
cd "$root" || exit 1
out=$(run_checks)
[ -z "$out" ] && exit 0
printf '%s\n' "$out"
exit 1
