#!/bin/bash

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
PID_FILE="/tmp/review-agent.pid"
LOG_FILE="$ROOT_DIR/logs/review-agent.log"

if [[ ! -f "$PID_FILE" ]]; then
  echo "❌ NOT RUNNING (no PID file)"
  exit 1
fi

pid=$(cat "$PID_FILE")

if [[ -z "$pid" ]]; then
  echo "❌ NOT RUNNING (PID file is empty)"
  rm -f "$PID_FILE"
  exit 1
fi

if ! kill -0 "$pid" 2>/dev/null; then
  echo "❌ NOT RUNNING (stale PID $pid)"
  rm -f "$PID_FILE"
  exit 1
fi

uptime=$(ps -p "$pid" -o etime= 2>/dev/null | xargs || echo "unknown")

echo "✅ RUNNING"
echo "   PID:    $pid"
echo "   Uptime: $uptime"
echo "   Log:    $LOG_FILE"
exit 0
