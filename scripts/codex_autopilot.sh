#!/usr/bin/env bash

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

ITERATIONS="${ITERATIONS:-5}"
MODEL="${MODEL:-}"
GOAL="${GOAL:-Improve ranking quality, signal quality, scoring quality, and developer UX in small safe passes. Commit to develop after each green pass. Stop if blocked or if tests fail.}"
LOG_DIR="${LOG_DIR:-$ROOT_DIR/.codex-autopilot}"
USE_DANGEROUS_MODE="${USE_DANGEROUS_MODE:-0}"

usage() {
  cat <<'EOF'
Usage: ./scripts/codex_autopilot.sh [iterations]

Environment variables:
  GOAL                Goal prompt passed to Codex for every pass
  MODEL               Optional model name passed with --model
  LOG_DIR             Directory for per-pass logs
  USE_DANGEROUS_MODE  Set to 1 to use --dangerously-bypass-approvals-and-sandbox

Examples:
  ./scripts/codex_autopilot.sh 3
  GOAL="Improve dashboard usability and commit after each green pass." ./scripts/codex_autopilot.sh 4
  USE_DANGEROUS_MODE=1 nohup ./scripts/codex_autopilot.sh 8 > autopilot.out 2>&1 &
EOF
}

if [[ "${1:-}" == "-h" || "${1:-}" == "--help" ]]; then
  usage
  exit 0
fi

if [[ -n "${1:-}" ]]; then
  ITERATIONS="$1"
fi

mkdir -p "$LOG_DIR"

if ! command -v codex >/dev/null 2>&1; then
  echo "codex CLI not found in PATH" >&2
  exit 1
fi

if ! git rev-parse --is-inside-work-tree >/dev/null 2>&1; then
  echo "This script must run inside a git repository" >&2
  exit 1
fi

run_codex_pass() {
  local pass="$1"
  local pass_log="$LOG_DIR/pass-${pass}.log"
  local branch
  branch="$(git branch --show-current)"
  local codex_args=(
    exec
    --cd "$ROOT_DIR"
    --skip-git-repo-check
    --color never
    -o "$pass_log"
  )

  if [[ -n "$MODEL" ]]; then
    codex_args+=(--model "$MODEL")
  fi

  if [[ "$USE_DANGEROUS_MODE" == "1" ]]; then
    codex_args+=(--dangerously-bypass-approvals-and-sandbox)
  else
    codex_args+=(--full-auto)
  fi

  cat <<EOF | codex "${codex_args[@]}"
You are working in the repository at $ROOT_DIR on branch $branch.

Objective for this pass:
$GOAL

Constraints:
- Make one small, coherent improvement pass.
- Run the relevant tests before finishing.
- Commit only if tests pass.
- Use a normal git commit on branch $branch.
- Do not rewrite history.
- Stop if you are blocked by missing credentials, unclear repo state, or failing tests.
- Leave a concise final message summarizing what changed, what was verified, and whether a commit was created.

Focus on the next highest-leverage improvement based on the current repository state.
EOF
}

echo "Starting Codex autopilot in $ROOT_DIR"
echo "Iterations: $ITERATIONS"
echo "Logs: $LOG_DIR"
echo "Mode: $([[ "$USE_DANGEROUS_MODE" == "1" ]] && echo "dangerous" || echo "full-auto")"

for ((pass=1; pass<=ITERATIONS; pass++)); do
  echo
  echo "=== Pass $pass/$ITERATIONS ==="
  before_head="$(git rev-parse HEAD)"
  before_status="$(git status --short)"

  if ! run_codex_pass "$pass"; then
    echo "Codex pass $pass failed. Stopping."
    exit 1
  fi

  after_head="$(git rev-parse HEAD)"
  after_status="$(git status --short)"
  echo "Last commit: $(git log --oneline -1)"

  if [[ "$before_head" == "$after_head" && "$before_status" == "$after_status" ]]; then
    echo "No repo changes detected on pass $pass. Stopping early."
    exit 0
  fi
done

echo
echo "Autopilot finished. Recent commits:"
git log --oneline -5
