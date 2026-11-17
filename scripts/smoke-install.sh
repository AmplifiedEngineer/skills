#!/bin/sh
# End-to-end install test: adds this repo as a local marketplace in a throwaway
# config folder per host, installs the plugin and checks all skills arrived.
# Usage: sh scripts/smoke-install.sh [claude] [codex] [--keep]. Silent on success.
# Requires jq and the CLI of each requested host.

HOSTS_ALL="claude codex"
KEEP_FLAG="--keep"
MARKETPLACE="amplifiedengineer"
PLUGIN="ae"
SKILL_NAMES="planner implementer researcher"
SKILL_FILE="SKILL.md"
MANIFEST="plugin.json"
LOG_NAME="smoke.log"
TMP_TEMPLATE="${TMPDIR:-/tmp}/ae-smoke.XXXXXX"
CACHE_DIR="plugins/cache"

REASON_NO_CLI="CLI not found on PATH"
REASON_UNKNOWN_HOST="unknown host"
REASON_SKILL_MISSING="missing after install"
REASON_NOT_REMOVED="temp folder not removed"

claude_dir=""
codex_dir=""
hosts=""
keep=0

host_dir() {
  case "$1" in
    claude) printf '%s' "$claude_dir" ;;
    codex) printf '%s' "$codex_dir" ;;
  esac
}

cleanup() {
  status=$?
  for host in $hosts; do
    dir=$(host_dir "$host")
    [ -n "$dir" ] || continue
    if [ "$keep" = 1 ]; then
      echo "KEEP host=$host: $dir"
      continue
    fi
    rm -rf "$dir"
    if [ -e "$dir" ]; then
      echo "FAIL host=$host: $REASON_NOT_REMOVED"
      status=1
    fi
  done
  exit "$status"
}
trap cleanup EXIT
trap 'exit 130' INT TERM HUP

fail() { echo "FAIL host=$1: $2"; }

parse_args() {
  requested=""
  bad=0
  for arg in "$@"; do
    case "$arg" in
      claude | codex)
        case " $requested " in
          *" $arg "*) ;;
          *) requested="$requested $arg" ;;
        esac
        ;;
      "$KEEP_FLAG") keep=1 ;;
      *) fail "$arg" "$REASON_UNKNOWN_HOST"; bad=1 ;;
    esac
  done
  [ "$bad" = 0 ] || exit 1
  requested=${requested:-$HOSTS_ALL}
}

require_clis() {
  missing=0
  for host in $requested; do
    command -v "$host" >/dev/null 2>&1 || { fail "$host" "$host $REASON_NO_CLI"; missing=1; }
  done
  [ "$missing" = 0 ] || exit 1
}

# run_cli <host> <config var> <command words> <argument>
run_cli() {
  env "$2=$config_dir" "$1" $3 "$4" </dev/null >>"$log" 2>&1 && return 0
  fail "$1" "$1 $3 failed"
  cat "$log"
  return 1
}

smoke_host() {
  host=$1
  config_dir=$(mktemp -d "$TMP_TEMPLATE") || exit 1
  case "$host" in
    claude) claude_dir=$config_dir; cfg_var=CLAUDE_CONFIG_DIR; install_words="plugin install" ;;
    codex) codex_dir=$config_dir; cfg_var=CODEX_HOME; install_words="plugin add" ;;
  esac
  log="$config_dir/$LOG_NAME"
  run_cli "$host" "$cfg_var" "plugin marketplace add" "$repo" || return 1
  run_cli "$host" "$cfg_var" "$install_words" "$PLUGIN@$MARKETPLACE" || return 1
  missing=0
  for s in $SKILL_NAMES; do
    [ -f "$config_dir/$CACHE_DIR/$MARKETPLACE/$PLUGIN/$version/skills/$s/$SKILL_FILE" ] && continue
    fail "$host" "skill $s $REASON_SKILL_MISSING"
    missing=1
  done
  [ "$missing" = 0 ] && return 0
  cat "$log"
  return 1
}

repo=$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd)
parse_args "$@"
require_clis
version=$(jq -r .version "$repo/$MANIFEST") || exit 1
hosts=$requested
status=0
for host in $hosts; do
  smoke_host "$host" || status=1
done
exit "$status"
