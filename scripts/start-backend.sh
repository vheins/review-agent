#!/bin/bash

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
DB_PATH="$ROOT_DIR/data/pr-review.db"

stop_lingering_review_agent() {
  local pid="$1"
  local args
  args="$(ps -p "$pid" -o args= 2>/dev/null || true)"

  if [[ -z "$args" ]]; then
    return 0
  fi

  if [[ "$args" != *"ts-node/esm ./src/start.ts"* ]] && [[ "$args" != *"review-agent"* ]]; then
    return 0
  fi

  echo "Stopping lingering review-agent process holding DB (PID: $pid)"
  kill -TERM "$pid" 2>/dev/null || true

  for _ in {1..10}; do
    if ! kill -0 "$pid" 2>/dev/null; then
      return 0
    fi
    sleep 0.5
  done

  echo "Force stopping stuck review-agent process (PID: $pid)"
  kill -KILL "$pid" 2>/dev/null || true
}

if command -v lsof >/dev/null 2>&1 && [[ -f "$DB_PATH" ]]; then
  mapfile -t db_pids < <(lsof -t "$DB_PATH" 2>/dev/null | sort -u)
  for pid in "${db_pids[@]:-}"; do
    [[ -n "$pid" ]] || continue
    stop_lingering_review_agent "$pid"
  done
fi

cd "$ROOT_DIR"
exec yarn workspace @review-agent/backend start:continuous "$@"
