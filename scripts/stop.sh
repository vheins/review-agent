#!/bin/bash

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
PID_FILE="/tmp/review-agent.pid"

if [[ ! -f "$PID_FILE" ]]; then
  echo "⚠️  PID file not found. Running fallback cleanup..."
  "$ROOT_DIR/scripts/cleanup.sh"
  exit 0
fi

pid=$(cat "$PID_FILE")

if [[ -z "$pid" ]]; then
  echo "⚠️  PID file is empty. Running fallback cleanup..."
  rm -f "$PID_FILE"
  "$ROOT_DIR/scripts/cleanup.sh"
  exit 0
fi

if ! kill -0 "$pid" 2>/dev/null; then
  echo "⚠️  Process with PID $pid is not running. Removing stale PID file."
  rm -f "$PID_FILE"
  exit 0
fi

echo "Stopping Review Agent (PID: $pid)..."
kill -TERM "$pid" 2>/dev/null || true

for _ in {1..10}; do
  if ! kill -0 "$pid" 2>/dev/null; then
    rm -f "$PID_FILE"
    echo "✅ Review Agent stopped."
    exit 0
  fi
  sleep 0.5
done

echo "Process still alive after SIGTERM. Sending SIGKILL..."
kill -KILL "$pid" 2>/dev/null || true
sleep 0.5

if ! kill -0 "$pid" 2>/dev/null; then
  rm -f "$PID_FILE"
  echo "✅ Review Agent forcefully stopped."
else
  echo "⚠️  Could not stop process PID $pid. Please check manually."
  exit 1
fi
