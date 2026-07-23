#!/bin/bash

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
LOG_FILE="$ROOT_DIR/logs/review-agent.log"

usage() {
  echo "Usage: $0 [options]"
  echo "Options:"
  echo "  -f          Follow mode (tail -f)"
  echo "  -n <N>      Show last N lines (default: 50)"
  echo "  -c, --clear Truncate the log file"
  exit 1
}

if [[ ! -f "$LOG_FILE" ]]; then
  echo "Error: Log file not found at $LOG_FILE"
  exit 1
fi

if [[ $# -eq 0 ]]; then
  tail -n 50 "$LOG_FILE"
  exit 0
fi

case "${1:-}" in
  -f)
    tail -f "$LOG_FILE"
    ;;
  -n)
    if [[ $# -lt 2 ]]; then
      echo "Error: -n requires a number argument"
      usage
    fi
    tail -n "$2" "$LOG_FILE"
    ;;
  -c|--clear)
    : > "$LOG_FILE"
    echo "✅ Log file truncated: $LOG_FILE"
    ;;
  *)
    usage
    ;;
esac
