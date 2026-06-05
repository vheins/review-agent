#!/bin/bash
set -euo pipefail

# Load .env if exists
if [ -f "$(dirname "$0")/../.env" ]; then
  set -a
  source "$(dirname "$0")/../.env"
  set +a
fi

TTS_API_URL="${TTS_API_URL:-http://localhost:20128/v1/audio/speech}"
TTS_API_KEY="${TTS_API_KEY:-}"

usage() {
  echo "Usage: yarn tts -- --message=\"<text>\""
  echo "       yarn tts -- --help"
  exit 1
}

# Parse args
MESSAGE=""
MODEL=""
for arg in "$@"; do
  case $arg in
    --message=*)
      MESSAGE="${arg#*=}"
      ;;
    --model=*)
      MODEL="${arg#*=}"
      ;;
    --help|-h)
      echo "Convert text to speech via TTS API"
      echo ""
      echo "Options:"
      echo "  --message=\"<text>\"   Text to convert (required)"
      echo "  --model=\"<name>\"     TTS model (default: edge-tts/id-ID-ArdiNeural)"
      echo ""
      echo "Environment:"
      echo "  TTS_API_URL   (default: http://localhost:20128/v1/audio/speech)"
      echo "  TTS_API_KEY   (required)"
      exit 0
      ;;
    *)
      echo "Unknown argument: $arg"
      usage
      ;;
  esac
done

if [ -z "$MESSAGE" ]; then
  echo "Error: --message is required"
  usage
fi

MODEL="${MODEL:-edge-tts/id-ID-ArdiNeural}"
OUTPUT_FILE="speech.mp3"

AUTH_HEADER=""
if [ -n "$TTS_API_KEY" ]; then
  AUTH_HEADER=(-H "Authorization: Bearer $TTS_API_KEY")
fi

curl -X POST "$TTS_API_URL" \
  -H "Content-Type: application/json" \
  "${AUTH_HEADER[@]}" \
  -d "$(jq -n --arg msg "$MESSAGE" --arg model "$MODEL" '{model: $model, input: $msg}')" \
  --output "$OUTPUT_FILE"

echo "Saved to $OUTPUT_FILE"
