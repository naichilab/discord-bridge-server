#!/bin/bash
# Discord にファイルを送信
# Usage: discord-send-file.sh /path/to/file ["メッセージ"]
FILE_PATH="${1:?Usage: discord-send-file.sh FILE_PATH [MESSAGE]}"
MESSAGE="${2:-}"
PORT="${DISCORD_BRIDGE_PORT:-13456}"
PROJECT_ROOT=$(git rev-parse --show-toplevel 2>/dev/null)
CHANNEL_ID=""
if [ -n "$PROJECT_ROOT" ] && [ -f "$PROJECT_ROOT/.discord-bridge.json" ]; then
  CHANNEL_ID=$(python3 -c "import json; print(json.load(open('$PROJECT_ROOT/.discord-bridge.json'))['channelId'])" 2>/dev/null)
fi

JSON=$(python3 -c "
import json, sys
d = {'file_path': sys.argv[1]}
if sys.argv[2]:
    d['message'] = sys.argv[2]
if sys.argv[3]:
    d['channelId'] = sys.argv[3]
print(json.dumps(d, ensure_ascii=False))
" "$FILE_PATH" "$MESSAGE" "$CHANNEL_ID")

curl -s -X POST "http://localhost:${PORT}/send-file" \
  -H "Content-Type: application/json" \
  -d "$JSON"
