#!/usr/bin/env bash

set -euo pipefail

ROOT_DIR="${ROOT_DIR_OVERRIDE:-$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)}"
cd "$ROOT_DIR"

ITERATIONS="${ITERATIONS:-5}"
MODEL="${MODEL:-}"
GOAL="${GOAL:-Improve ranking quality, signal quality, scoring quality, and developer UX in small safe passes. Commit to develop after each green pass. Stop if blocked or if tests fail.}"
LOG_DIR="${LOG_DIR:-$ROOT_DIR/.codex-autopilot}"
USE_DANGEROUS_MODE="${USE_DANGEROUS_MODE:-0}"
WORKERS="${WORKERS:-}"
WORKTREE_BASE="${WORKTREE_BASE:-$ROOT_DIR/.codex-worktrees}"
WORKER_GOALS="${WORKER_GOALS:-}"
WORKER_BRANCH_PREFIX="${WORKER_BRANCH_PREFIX:-autopilot}"

usage() {
  cat <<'EOF'
Usage: ./scripts/codex_autopilot.sh [iterations]

Environment variables:
  GOAL                Goal prompt passed to Codex for every pass
  MODEL               Optional model name passed with --model
  LOG_DIR             Directory for per-pass logs
  USE_DANGEROUS_MODE  Set to 1 to use --dangerously-bypass-approvals-and-sandbox
  WORKERS             Comma-separated worker names to run in separate git worktrees
  WORKTREE_BASE       Base directory for auto-created worktrees
  WORKER_GOALS        Semicolon-separated worker-specific goals: worker=goal;worker=goal
  WORKER_BRANCH_PREFIX Branch prefix for per-worker branches

Examples:
  ./scripts/codex_autopilot.sh 3
  GOAL="Improve dashboard usability and commit after each green pass." ./scripts/codex_autopilot.sh 4
  USE_DANGEROUS_MODE=1 nohup ./scripts/codex_autopilot.sh 8 > autopilot.out 2>&1 &
  WORKERS="topics,scoring" ./scripts/codex_autopilot.sh 2
  WORKERS="topics,scoring" WORKER_GOALS="topics=Improve topic extraction quality.;scoring=Improve scoring quality." ./scripts/codex_autopilot.sh 2
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
  local workdir="$2"
  local goal="$3"
  local pass_log="$4"
  local branch
  branch="$(git -C "$workdir" branch --show-current)"
  local codex_args=(
    exec
    --cd "$workdir"
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
You are working in the repository at $workdir on branch $branch.

Objective for this pass:
$goal

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

run_single_worker_loop() {
  local workdir="$1"
  local goal="$2"
  local log_dir="$3"
  mkdir -p "$log_dir"

  echo "Starting Codex autopilot in $workdir"
  echo "Iterations: $ITERATIONS"
  echo "Logs: $log_dir"
  echo "Mode: $([[ "$USE_DANGEROUS_MODE" == "1" ]] && echo "dangerous" || echo "full-auto")"

  for ((pass=1; pass<=ITERATIONS; pass++)); do
    echo
    echo "=== Pass $pass/$ITERATIONS ==="
    before_head="$(git -C "$workdir" rev-parse HEAD)"
    before_status="$(git -C "$workdir" status --short)"
    local pass_log="$log_dir/pass-${pass}.log"

    if ! run_codex_pass "$pass" "$workdir" "$goal" "$pass_log"; then
      echo "Codex pass $pass failed. Stopping."
      return 1
    fi

    after_head="$(git -C "$workdir" rev-parse HEAD)"
    after_status="$(git -C "$workdir" status --short)"
    echo "Last commit: $(git -C "$workdir" log --oneline -1)"

    if [[ "$before_head" == "$after_head" && "$before_status" == "$after_status" ]]; then
      echo "No repo changes detected on pass $pass. Stopping early."
      return 0
    fi
  done

  echo
  echo "Autopilot finished. Recent commits:"
  git -C "$workdir" log --oneline -5
}

goal_for_worker() {
  local worker="$1"
  local entry
  IFS=';' read -r -a worker_entries <<<"$WORKER_GOALS"
  for entry in "${worker_entries[@]}"; do
    if [[ "$entry" == "$worker="* ]]; then
      printf '%s\n' "${entry#*=}"
      return 0
    fi
  done
  printf '%s\n' "$GOAL"
}

sanitize_worker_name() {
  local worker="$1"
  worker="${worker// /-}"
  worker="${worker//\//-}"
  printf '%s\n' "$worker"
}

run_multi_worker_mode() {
  local current_branch timestamp
  current_branch="$(git branch --show-current)"
  timestamp="$(date +%Y%m%d%H%M%S)"
  mkdir -p "$WORKTREE_BASE" "$LOG_DIR"

  local worker
  local -a workers worker_pids worker_names worker_dirs
  IFS=',' read -r -a workers <<<"$WORKERS"

  echo "Starting multi-worker Codex autopilot in $ROOT_DIR"
  echo "Iterations per worker: $ITERATIONS"
  echo "Workers: $WORKERS"
  echo "Worktrees: $WORKTREE_BASE"
  echo "Logs: $LOG_DIR"

  for worker in "${workers[@]}"; do
    worker="$(sanitize_worker_name "$worker")"
    if [[ -z "$worker" ]]; then
      continue
    fi
    local worker_branch="${WORKER_BRANCH_PREFIX}/${worker}-${timestamp}"
    local worker_dir="$WORKTREE_BASE/$worker"
    local worker_log_dir="$LOG_DIR/$worker"
    local worker_goal
    worker_goal="$(goal_for_worker "$worker")"

    rm -rf "$worker_dir"
    mkdir -p "$worker_log_dir"
    git worktree add -b "$worker_branch" "$worker_dir" "$current_branch" >/dev/null

    (
      ROOT_DIR_OVERRIDE="$worker_dir" \
      LOG_DIR="$worker_log_dir" \
      GOAL="$worker_goal" \
      WORKERS="" \
      ITERATIONS="$ITERATIONS" \
      MODEL="$MODEL" \
      USE_DANGEROUS_MODE="$USE_DANGEROUS_MODE" \
      "$0" "$ITERATIONS"
    ) >"$worker_log_dir/runner.out" 2>&1 &

    worker_pids+=("$!")
    worker_names+=("$worker")
    worker_dirs+=("$worker_dir")
    echo "Started worker '$worker' in $worker_dir on branch $worker_branch"
  done

  local index exit_code=0
  for index in "${!worker_pids[@]}"; do
    if wait "${worker_pids[$index]}"; then
      echo "Worker '${worker_names[$index]}' finished successfully"
    else
      echo "Worker '${worker_names[$index]}' failed" >&2
      exit_code=1
    fi
    echo "Worker dir: ${worker_dirs[$index]}"
    echo "Worker log: $LOG_DIR/${worker_names[$index]}/runner.out"
  done

  echo
  echo "Multi-worker autopilot finished."
  echo "Review branches and cherry-pick or merge the worker branches you want."
  return "$exit_code"
}

if [[ -n "$WORKERS" ]]; then
  run_multi_worker_mode
else
  run_single_worker_loop "$ROOT_DIR" "$GOAL" "$LOG_DIR"
fi
