#!/bin/sh
# Seeded-fault tests for scripts/check.sh and scripts/smoke-install.sh.
# Each case mutates a throwaway copy of the working tree and asserts the result.
# Run from anywhere: sh scripts/test-check.sh. Silent on success, exit 1 on any failure.

CLI_DIRS_DEFAULT="/usr/bin /bin"
GUARDED_CLIS="claude codex"
DEFAULT_PATH="/usr/bin:/bin"
MARKETPLACE="amplifiedengineer-skills"
PLUGIN="playbook"
SKILLS_PARTIAL="planner implementer"
SKILLS_FULL="planner implementer researcher"
TMP_BASE="${TMPDIR:-/tmp}"
TMP_BASE="${TMP_BASE%/}"

ROOT_PLUGIN="plugin.json"
CLAUDE_PLUGIN=".claude-plugin/plugin.json"
CLAUDE_MARKET=".claude-plugin/marketplace.json"
CODEX_MARKET=".agents/plugins/marketplace.json"
PLANNER_SKILL="skills/planner/SKILL.md"
RESEARCHER_BRIEF="skills/researcher/templates/context-brief.md"
PLANNER_DOC="skills/planner/workflows/documentation.md"
BAD_JSON='{'
STORAGE_IMPL="skills/implementer/references/document-storage.md"
STORAGE_PLAN="skills/planner/references/document-storage.md"
TEMPLATES_DIR="skills/planner/templates"
PLAN_TEMPLATE="$TEMPLATES_DIR/implementation-plan.md"
HANDOVER_DOC="skills/planner/workflows/implementation-handover.md"
EXEC_DOC="skills/implementer/workflows/implementation-execution.md"
STORAGE_LINK_TEXT="document-storage.md"
STOP_RULE_TEXT="stop and return the question to the planner"
STATUS_GATE_TEXT="run only documents whose Status is approved"
WRONG_STATUS='s/^Status: .*/Status: wrong/'

CASES="1 2 3 4 5 6 7 8 9 10 11 12 13 14 15 16 17 18 19 20 21 22 23 24 25 26 27
28 29 30 31 32 33 34 35 36 37 38 39 40 41
42 43 44 45 46 47 48 49 50 51 52 53 54 55 56 57 58 59 60 61 62 63 64 65 66 67 69 70
71 72 73 74 75 76 77 78 79 80 81 82 83 84 85 86 87 68"

root=$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd)

if [ ! -e "$root/scripts/check.sh" ]; then
  echo "FAIL test-check: $root/scripts/check.sh not found"
  exit 1
fi

# A nested run carries its own copy root, so an inherited value cannot match.
nested=0
[ -n "${TEST_CHECK_NESTED:-}" ] && [ "$TEST_CHECK_NESTED" = "$root" ] && nested=1
[ "$nested" = 1 ] || unset TEST_CHECK_CLI_DIRS

for dir in ${TEST_CHECK_CLI_DIRS:-$CLI_DIRS_DEFAULT}; do
  for cli in $GUARDED_CLIS; do
    if [ -e "$dir/$cli" ]; then
      echo "FAIL test-check: $dir/$cli exists; cases 20, 21 and 58 need it absent"
      exit 1
    fi
  done
done

# A nested run (case 27, 68, 72, 79) stops here so it can never recurse.
[ "$nested" = 1 ] && exit 0

sh_bin=$(command -v sh)
files=$(git -C "$root" ls-files --cached --others --exclude-standard)
copy=""
failures=0

cleanup() {
  [ -n "$copy" ] && rm -rf "$copy"
  copy=""
}
trap cleanup EXIT
trap 'exit 130' INT TERM HUP

fail() {
  echo "FAIL case=$case_id: $1"
  failures=1
}

append() { printf '%s\n' "$2" >> "$copy/$1"; }
write_bad_json() { printf '%s\n' "$BAD_JSON" > "$copy/$1"; }
remove() { rm -rf "$copy/$1"; }
sub() { sed "$2" "$copy/$1" > "$copy/$1.tmp" && mv "$copy/$1.tmp" "$copy/$1"; }
want() { want_lines="${want_lines}${want_lines:+
}$1"; }

make_copy() {
  copy=$(mktemp -d "$TMP_BASE/test-check.XXXXXX") ||
    { echo "FAIL test-check: mktemp failed"; exit 1; }
  printf '%s\n' "$files" | while IFS= read -r f; do
    [ -e "$root/$f" ] || continue
    mkdir -p "$copy/$(dirname "$f")"
    cp -p "$root/$f" "$copy/$f"
  done
}

# make_stub <host> <mode>: mode is allfail, installfail, partial or full.
make_stub() {
  stub_host=$1
  stub_mode=$2
  if [ "$stub_host" = claude ]; then
    cfgvar=CLAUDE_CONFIG_DIR
    install_words="plugin install"
  else
    cfgvar=CODEX_HOME
    install_words="plugin add"
  fi
  case "$stub_mode" in
    allfail)
      printf '#!/bin/sh\nexit 1\n' > "$copy/stubbin/$stub_host"
      ;;
    installfail)
      install_body="exit 1"
      write_stub
      ;;
    partial)
      install_body=$(skills_body "$SKILLS_PARTIAL")
      write_stub
      ;;
    full)
      install_body=$(skills_body "$SKILLS_FULL")
      write_stub
      ;;
  esac
  chmod +x "$copy/stubbin/$stub_host"
}

skills_body() {
  cat <<EOF
v=\$(jq -r .version "$copy/plugin.json")
for s in $1; do
  d="\$$cfgvar/plugins/cache/$MARKETPLACE/$PLUGIN/\$v/skills/\$s"
  mkdir -p "\$d"
  printf '# %s\n' "\$s" > "\$d/SKILL.md"
done
exit 0
EOF
}

write_stub() {
  cat > "$copy/stubbin/$stub_host" <<EOF
#!/bin/sh
printf '%s' "\$$cfgvar" > "$copy/stub-config-path"
case "\$1 \$2" in
  "plugin marketplace") exit 0 ;;
  "$install_words")
$install_body
    ;;
esac
exit 1
EOF
}

# stub_env <host> <mode>: stub CLI plus jq in <copy>/stubbin, PATH put in front.
stub_env() {
  mkdir -p "$copy/stubbin"
  ln -s "$(command -v jq)" "$copy/stubbin/jq"
  make_stub "$1" "$2"
  run_path="$copy/stubbin:$DEFAULT_PATH"
}

# stub_tmp: private TMPDIR whose emptiness afterwards proves cleanup ran.
stub_tmp() {
  mkdir "$copy/tmp"
  tmp_dir="$copy/tmp"
  check_tmp=1
}

empty_exec() { : > "$1"; chmod +x "$1"; }

# One row per case: the mutation, the runner settings and the expected lines.
prepare_case() {
  runner=check
  smoke_args=""
  run_path="$DEFAULT_PATH"
  tmp_dir=""
  cli_dirs=""
  want_exit=1
  want_lines=""
  check_tmp=0
  check_cfg=0
  keep=0
  case "$1" in
    1) want_exit=0 ;;
    2) write_bad_json "$ROOT_PLUGIN"
       want "FAIL check=1 file=plugin.json: invalid JSON" ;;
    3) sub "$CLAUDE_PLUGIN" 's/"version": "0.1.0"/"version": "9.9.9"/'
       want "FAIL check=2 file=.claude-plugin/plugin.json: version mismatch with plugin.json" ;;
    4) remove "$CODEX_MARKET"
       want "FAIL check=2 file=.agents/plugins/marketplace.json: missing file" ;;
    5) sub "$CLAUDE_PLUGIN" 's/"name": "playbook"/"name": "other"/'
       want "FAIL check=2 file=.claude-plugin/plugin.json: name mismatch with plugin.json" ;;
    6) sub "$CLAUDE_MARKET" 's/"name": "playbook"/"name": "other"/'
       want "FAIL check=2 file=.claude-plugin/marketplace.json: name mismatch with plugin.json" ;;
    7) sub "$CODEX_MARKET" 's/"name": "playbook"/"name": "other"/'
       want "FAIL check=2 file=.agents/plugins/marketplace.json: name mismatch with plugin.json" ;;
    8) sub "$ROOT_PLUGIN" 's/"name": "playbook"/"name": "other"/'
       want "FAIL check=2 file=.claude-plugin/plugin.json: name mismatch with plugin.json" ;;
    9) append "$PLANNER_DOC" '[x](../references/missing.md)'
       want "FAIL check=3 file=skills/planner/workflows/documentation.md: broken link ../references/missing.md" ;;
    10) append "$PLANNER_SKILL" '`references/missing.md`'
       want "FAIL check=3 file=skills/planner/SKILL.md: broken link references/missing.md" ;;
    11) append "$PLANNER_DOC" '[licence](LICENSE)'
       want "FAIL check=3 file=skills/planner/workflows/documentation.md: broken link LICENSE" ;;
    12) append "$PLANNER_DOC" '[x](docs/playbook/plans/x.md)'
       append "$PLANNER_DOC" '[x](.playbook/plans/x.md)'
       append "$PLANNER_DOC" '`docs/playbook/plans/x.md`'
       append "$PLANNER_DOC" '`.playbook/plans/x.md`'
       append "$PLANNER_DOC" '[x](../SKILL.md#section)'
       append "$PLANNER_DOC" '`references/<name>.md`'
       append "$PLANNER_DOC" '[x](#anchor)'
       append "$PLANNER_DOC" '[x](https://example.com)'
       want_exit=0 ;;
    13) append skills/implementer/README.md 'Engineering Architect'
       want "FAIL check=4 file=skills/implementer/README.md: old skill name Engineering Architect" ;;
    14) sub "$PLANNER_SKILL" 's/^name: planner$/name: plan/'
       want "FAIL check=5 file=skills/planner/SKILL.md: name plan does not match folder" ;;
    15) mkdir -p "$copy/skills/scratch"
       printf -- '---\nname: scratch\n---\n' > "$copy/skills/scratch/SKILL.md"
       want "FAIL check=5 file=skills/scratch: unexpected skill folder" ;;
    16) remove skills/researcher
       want "FAIL check=5 file=skills/researcher: missing file" ;;
    17) remove skills
       want "FAIL check=3 file=skills/**/*.md: no files match"
       want "FAIL check=5 file=skills/planner: missing file"
       want "FAIL check=5 file=skills/implementer: missing file"
       want "FAIL check=5 file=skills/researcher: missing file" ;;
    18) sub README.md 's/playbook//g'
       want "FAIL check=7 file=README.md: README missing playbook" ;;
    19) sub README.md 's/amplifiedengineer-skills//g'
       want "FAIL check=7 file=README.md: README missing amplifiedengineer-skills" ;;
    20) runner=smoke; smoke_args=codex
       want "FAIL host=codex: codex CLI not found on PATH" ;;
    21) runner=smoke; smoke_args=claude
       want "FAIL host=claude: claude CLI not found on PATH" ;;
    22) remove "$ROOT_PLUGIN"
       want "FAIL check=2 file=plugin.json: missing file" ;;
    23) remove "$CLAUDE_PLUGIN"
       want "FAIL check=2 file=.claude-plugin/plugin.json: missing file" ;;
    24) remove "$CLAUDE_MARKET"
       want "FAIL check=2 file=.claude-plugin/marketplace.json: missing file" ;;
    25) remove README.md
       want "FAIL check=7 file=README.md: missing file" ;;
    26) find "$copy/skills" -name '*.md' -exec rm -f {} +
       want "FAIL check=3 file=skills/**/*.md: no files match" ;;
    27) runner=self
       remove scripts/check.sh
       want "FAIL test-check: $copy/scripts/check.sh not found" ;;
    28) append "$STORAGE_IMPL" x
       want "FAIL check=8 file=$STORAGE_IMPL: differs from $STORAGE_PLAN" ;;
    29) remove "$STORAGE_IMPL"
       want "FAIL check=8 file=$STORAGE_IMPL: missing file" ;;
    30) remove "$STORAGE_PLAN"
       want "FAIL check=8 file=$STORAGE_PLAN: missing file" ;;
    31) remove "$PLAN_TEMPLATE"
       want "FAIL check=9 file=$PLAN_TEMPLATE: missing file" ;;
    32) sub "$PLAN_TEMPLATE" 's/^Status: draft$/Status: approved/'
       want "FAIL check=9 file=$PLAN_TEMPLATE: unexpected Status line" ;;
    33) append "$TEMPLATES_DIR/extra.md" 'Status: draft'
       want "FAIL check=9 file=$TEMPLATES_DIR/extra.md: unexpected Status line" ;;
    34) sub "$PLANNER_DOC" "/$STORAGE_LINK_TEXT/d"
       want "FAIL check=9 file=$PLANNER_DOC: missing link to references/document-storage.md" ;;
    35) sub "$HANDOVER_DOC" "/$STORAGE_LINK_TEXT/d"
       want "FAIL check=9 file=$HANDOVER_DOC: missing link to references/document-storage.md" ;;
    36) sub "$EXEC_DOC" "/$STORAGE_LINK_TEXT/d"
       want "FAIL check=9 file=$EXEC_DOC: missing link to references/document-storage.md" ;;
    37) sub "$EXEC_DOC" "/$STOP_RULE_TEXT/d"
       want "FAIL check=10 file=$EXEC_DOC: missing stop rule" ;;
    38) sub "$EXEC_DOC" "/$STATUS_GATE_TEXT/d"
       want "FAIL check=10 file=$EXEC_DOC: missing status gate" ;;
    39) remove "$EXEC_DOC"
       want "FAIL check=10 file=$EXEC_DOC: missing file" ;;
    40) sub "$RESEARCHER_BRIEF" '/^## Answer$/d'
       want "FAIL check=6 file=$RESEARCHER_BRIEF: first section is not ## Answer" ;;
    41) remove "$RESEARCHER_BRIEF"
       want "FAIL check=6 file=$RESEARCHER_BRIEF: missing file" ;;
    42) append skills/implementer/README.md 'engineering-architect'
       want "FAIL check=4 file=skills/implementer/README.md: old skill name engineering-architect" ;;
    43) append skills/planner/README.md 'ENGINEERING-IMPLEMENTATION'
       want "FAIL check=4 file=skills/planner/README.md: old skill name ENGINEERING-IMPLEMENTATION" ;;
    44) append README.md 'engineering context'
       want "FAIL check=4 file=README.md: old skill name engineering context" ;;
    45) write_bad_json "$CLAUDE_MARKET"
       want "FAIL check=1 file=.claude-plugin/marketplace.json: invalid JSON" ;;
    46) append "$PLANNER_SKILL" '`templates/missing.md`'
       want "FAIL check=3 file=skills/planner/SKILL.md: broken link templates/missing.md" ;;
    47) sub "$TEMPLATES_DIR/adr.md" '/^Status: /d'
       want "FAIL check=9 file=$TEMPLATES_DIR/adr.md: unexpected Status line" ;;
    48) sub "$RESEARCHER_BRIEF" 's/^## Answer$/## Summary/'
       want "FAIL check=6 file=$RESEARCHER_BRIEF: first section is not ## Answer" ;;
    49) sub "$RESEARCHER_BRIEF" '/^## Answer$/d'
       append "$RESEARCHER_BRIEF" '## Answer'
       want "FAIL check=6 file=$RESEARCHER_BRIEF: first section is not ## Answer" ;;
    50) append "$PLANNER_SKILL" '`workflows/missing.md`'
       want "FAIL check=3 file=skills/planner/SKILL.md: broken link workflows/missing.md" ;;
    51) append "$PLANNER_SKILL" '`examples/missing.md`'
       want "FAIL check=3 file=skills/planner/SKILL.md: broken link examples/missing.md" ;;
    52) append "$PLANNER_SKILL" '`agents/missing.yaml`'
       want "FAIL check=3 file=skills/planner/SKILL.md: broken link agents/missing.yaml" ;;
    53) append "$PLANNER_DOC" '`../missing.md`'
       want "FAIL check=3 file=skills/planner/workflows/documentation.md: broken link ../missing.md" ;;
    54) write_bad_json "$CLAUDE_PLUGIN"
       want "FAIL check=1 file=.claude-plugin/plugin.json: invalid JSON" ;;
    55) write_bad_json "$CODEX_MARKET"
       want "FAIL check=1 file=.agents/plugins/marketplace.json: invalid JSON" ;;
    56) write_bad_json skills/planner/extra.json
       want "FAIL check=1 file=skills/planner/extra.json: invalid JSON" ;;
    57) remove "$PLANNER_SKILL"
       want "FAIL check=5 file=skills/planner/SKILL.md: missing file" ;;
    58) runner=smoke
       want "FAIL host=claude: claude CLI not found on PATH"
       want "FAIL host=codex: codex CLI not found on PATH" ;;
    59) runner=smoke; smoke_args=bogus
       want "FAIL host=bogus: unknown host" ;;
    60) remove "$PLANNER_DOC"
       want "FAIL check=9 file=$PLANNER_DOC: missing file" ;;
    61) remove "$HANDOVER_DOC"
       want "FAIL check=9 file=$HANDOVER_DOC: missing file" ;;
    62) sub "$TEMPLATES_DIR/architecture-assessment.md" "$WRONG_STATUS"
       want "FAIL check=9 file=$TEMPLATES_DIR/architecture-assessment.md: unexpected Status line" ;;
    63) sub "$TEMPLATES_DIR/architecture-findings.md" "$WRONG_STATUS"
       want "FAIL check=9 file=$TEMPLATES_DIR/architecture-findings.md: unexpected Status line" ;;
    64) sub "$TEMPLATES_DIR/drift-report.md" "$WRONG_STATUS"
       want "FAIL check=9 file=$TEMPLATES_DIR/drift-report.md: unexpected Status line" ;;
    65) sub "$TEMPLATES_DIR/impact-report.md" "$WRONG_STATUS"
       want "FAIL check=9 file=$TEMPLATES_DIR/impact-report.md: unexpected Status line" ;;
    66) sub "$TEMPLATES_DIR/discovery-state.md" "$WRONG_STATUS"
       want "FAIL check=9 file=$TEMPLATES_DIR/discovery-state.md: unexpected Status line" ;;
    67) append "$PLANNER_SKILL" '[x](references/missing.md#section)'
       want "FAIL check=3 file=skills/planner/SKILL.md: broken link references/missing.md" ;;
    69) printf '```\n[x](references/missing.md)\n```\n' >> "$copy/$PLANNER_SKILL"
       want "FAIL check=3 file=skills/planner/SKILL.md: broken link references/missing.md" ;;
    70) sed '/^name:/d' "$copy/$PLANNER_SKILL" > "$copy/$PLANNER_SKILL.tmp" \
         && mv "$copy/$PLANNER_SKILL.tmp" "$copy/$PLANNER_SKILL"
       want "FAIL check=5 file=skills/planner/SKILL.md: missing name" ;;
    71) append "$PLAN_TEMPLATE" 'Status: draft'
       want "FAIL check=9 file=$PLAN_TEMPLATE: unexpected Status line" ;;
    72) runner=self; cli_dirs="$copy/stubbin"
       mkdir "$copy/stubbin"
       empty_exec "$copy/stubbin/codex"
       want "FAIL test-check: $copy/stubbin/codex exists; cases 20, 21 and 58 need it absent" ;;
    73) append AGENTS.md 'engineering-context'
       want "FAIL check=4 file=AGENTS.md: old skill name engineering-context" ;;
    74) runner=smoke; smoke_args=claude
       stub_env claude allfail; stub_tmp
       want "FAIL host=claude: claude plugin marketplace add failed" ;;
    75) mkdir "$copy/.playbook"
       printf '%s\n' "$BAD_JSON" > "$copy/.playbook/x.json"
       printf 'Engineering Architect\n' > "$copy/.playbook/x.md"
       want_exit=0 ;;
    76) sub "$PLAN_TEMPLATE" '/^Status: /d'
       append "$PLAN_TEMPLATE" 'Status: draft'
       want "FAIL check=9 file=$PLAN_TEMPLATE: unexpected Status line" ;;
    77) runner=smoke; smoke_args=claude
       stub_env claude partial; stub_tmp
       want "FAIL host=claude: skill researcher missing after install" ;;
    78) runner=smoke; smoke_args=claude
       stub_env claude installfail; stub_tmp
       want "FAIL host=claude: claude plugin install failed" ;;
    79) runner=self; cli_dirs="$copy/empty $copy/stubbin"
       mkdir "$copy/empty" "$copy/stubbin"
       empty_exec "$copy/stubbin/claude"
       want "FAIL test-check: $copy/stubbin/claude exists; cases 20, 21 and 58 need it absent" ;;
    80) runner=smoke; smoke_args=codex
       stub_env codex allfail; stub_tmp
       want "FAIL host=codex: codex plugin marketplace add failed" ;;
    81) runner=smoke; smoke_args=codex
       stub_env codex installfail; stub_tmp
       want "FAIL host=codex: codex plugin add failed" ;;
    82) runner=smoke; smoke_args=codex
       stub_env codex partial; stub_tmp
       want "FAIL host=codex: skill researcher missing after install" ;;
    83) runner=smoke; smoke_args="claude --keep"
       stub_env claude full
       want_exit=0; keep=1 ;;
    84) runner=smoke; smoke_args=claude
       stub_env claude full; stub_tmp
       want_exit=0; check_cfg=1 ;;
    85) runner=smoke; smoke_args=codex
       stub_env codex full; stub_tmp
       want_exit=0; check_cfg=1 ;;
    86) sub "$ROOT_PLUGIN" '/"name": "playbook"/d'
       want "FAIL check=2 file=plugin.json: missing name" ;;
    87) sub "$CODEX_MARKET" '2s/"amplifiedengineer-skills"/"other"/'
       want "FAIL check=2 file=$CODEX_MARKET: name mismatch with $CLAUDE_MARKET" ;;
    68) runner=self; cli_dirs="$copy/stubbin"
       mkdir "$copy/stubbin"
       empty_exec "$copy/stubbin/claude"
       want "FAIL test-check: $copy/stubbin/claude exists; cases 20, 21 and 58 need it absent" ;;
  esac
}

run_runner() {
  case "$runner" in
    check)
      out=$("$sh_bin" "$copy/scripts/check.sh" "$copy" 2>&1)
      ;;
    smoke)
      out=$(env PATH="$run_path" ${tmp_dir:+TMPDIR="$tmp_dir"} \
        "$sh_bin" "$copy/scripts/smoke-install.sh" $smoke_args </dev/null 2>&1)
      ;;
    self)
      out=$(
        cd / || exit 1
        [ -z "$cli_dirs" ] || export TEST_CHECK_CLI_DIRS="$cli_dirs"
        TEST_CHECK_NESTED="$copy" "$sh_bin" "$copy/scripts/test-check.sh" 2>&1
      )
      ;;
  esac
  rc=$?
}

assert_keep() {
  case "$out" in
    "KEEP host=claude: "*) ;;
    *) fail "expected a KEEP host=claude line, got: $out"; return ;;
  esac
  case "$out" in
    *"
"*) fail "expected exactly one output line, got: $out"; return ;;
  esac
  kept=${out#"KEEP host=claude: "}
  case "$kept" in
    "$TMP_BASE/playbook-smoke."* | "${TMPDIR:-/tmp}/playbook-smoke."*) ;;
    *) fail "kept folder $kept is outside the smoke temp location, not deleted"; return ;;
  esac
  [ -d "$kept" ] || { fail "kept folder $kept is not an existing folder"; return; }
  rm -rf "$kept"
}

assert_lines() {
  while IFS= read -r line; do
    printf '%s\n' "$out" | grep -Fqx -- "$line" || fail "missing output line: $line"
  done <<EOF
$want_lines
EOF
}

assert_case() {
  [ "$rc" -eq "$want_exit" ] || fail "expected exit $want_exit, got $rc"
  if [ "$keep" = 1 ]; then
    assert_keep
  elif [ "$want_exit" -eq 0 ]; then
    [ -z "$out" ] || fail "expected no output, got: $out"
  else
    assert_lines
  fi
  if [ "$check_tmp" = 1 ]; then
    if [ ! -d "$copy/tmp" ]; then
      fail "$copy/tmp no longer exists"
    elif [ -n "$(ls -A "$copy/tmp")" ]; then
      fail "$copy/tmp is not empty afterwards"
    fi
  fi
  if [ "$check_cfg" = 1 ]; then
    case "$(cat "$copy/stub-config-path" 2>/dev/null)" in
      "$copy/tmp/playbook-smoke."*) ;;
      *) fail "config folder not created under $copy/tmp/playbook-smoke." ;;
    esac
  fi
}

for case_id in $CASES; do
  make_copy
  prepare_case "$case_id"
  run_runner
  assert_case
  cleanup
done

exit "$failures"
