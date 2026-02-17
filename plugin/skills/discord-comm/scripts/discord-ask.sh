#!/bin/bash
# Discord に質問を送信し返答を待つ
# Usage: discord-ask.sh "質問" [timeout_seconds] [option1] [option2] ...
QUESTION="${1:?Usage: discord-ask.sh QUESTION [TIMEOUT] [OPTIONS...]}"
TIMEOUT="${2:-300}"
shift 2 2>/dev/null || true
PORT="${DISCORD_BRIDGE_PORT:-13456}"
PROJECT_ROOT=$(git rev-parse --show-toplevel 2>/dev/null)
CHANNEL_ID=""
if [ -n "$PROJECT_ROOT" ] && [ -f "$PROJECT_ROOT/.discord-bridge.json" ]; then
  CHANNEL_ID=$(python3 -c "import json; print(json.load(open('$PROJECT_ROOT/.discord-bridge.json'))['channelId'])" 2>/dev/null)
fi

JSON=$(python3 -c "
import json, sys
d = {'question': sys.argv[1], 'timeout_seconds': int(sys.argv[2])}
opts = sys.argv[4:]
if opts:
    d['options'] = opts
if sys.argv[3]:
    d['channelId'] = sys.argv[3]
print(json.dumps(d, ensure_ascii=False))
" "$QUESTION" "$TIMEOUT" "$CHANNEL_ID" "$@")

curl -s -X POST "http://localhost:${PORT}/ask" \
  -H "Content-Type: application/json" \
  -d "$JSON" \
  --max-time "$((TIMEOUT + 5))"
