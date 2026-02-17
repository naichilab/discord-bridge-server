#!/bin/bash
# Discord で次のメッセージを待機 (SSE notification + queue fetch)
# キューに複数メッセージがある場合は全件を返す
# Usage: discord-wait.sh [timeout_seconds]
TIMEOUT="${1:-21600}"
PORT="${DISCORD_BRIDGE_PORT:-13456}"
PROJECT_ROOT=$(git rev-parse --show-toplevel 2>/dev/null)
CHANNEL_ID=""
if [ -n "$PROJECT_ROOT" ] && [ -f "$PROJECT_ROOT/.discord-bridge.json" ]; then
  CHANNEL_ID=$(python3 -c "import json; print(json.load(open('$PROJECT_ROOT/.discord-bridge.json'))['channelId'])" 2>/dev/null)
fi

if [ -z "$CHANNEL_ID" ]; then
  echo '{"status":"error","error":"channelId not found in .discord-bridge.json"}'
  exit 1
fi

BASE_URL="http://localhost:${PORT}"

# Health check — サーバーが起動していなければ即エラー終了
HEALTH=$(curl -sf "${BASE_URL}/health?channelId=${CHANNEL_ID}" 2>/dev/null)
if [ $? -ne 0 ]; then
  echo '{"status":"error","error":"Discord bridge server is not running. Start it with: bash ~/projects/discord-bridge-server/start.sh"}'
  exit 1
fi

# First check if there are already queued messages
QUEUED=$(curl -s "${BASE_URL}/messages?channelId=${CHANNEL_ID}&count=50")
RESULT=$(echo "$QUEUED" | python3 -c "
import json, sys
d = json.load(sys.stdin)
if d.get('count', 0) > 0:
    print(json.dumps({'status': 'received', 'messages': d['messages']}, ensure_ascii=False))
" 2>/dev/null)

if [ -n "$RESULT" ]; then
  echo "$RESULT"
  exit 0
fi

# No queued messages — connect to SSE and wait for notify event
NOTIFIED=$(curl -s -N "${BASE_URL}/events?channelId=${CHANNEL_ID}" \
  --max-time "$((TIMEOUT + 5))" 2>/dev/null \
  | awk '/^event: notify$/ { print "1"; exit }')

if [ "$NOTIFIED" = "1" ]; then
  # Fetch all messages from queue (reliable delivery)
  QUEUED=$(curl -s "${BASE_URL}/messages?channelId=${CHANNEL_ID}&count=50")
  RESULT=$(echo "$QUEUED" | python3 -c "
import json, sys
d = json.load(sys.stdin)
if d.get('count', 0) > 0:
    print(json.dumps({'status': 'received', 'messages': d['messages']}, ensure_ascii=False))
" 2>/dev/null)

  if [ -n "$RESULT" ]; then
    echo "$RESULT"
  else
    echo '{"status":"error","error":"Notification received but no message in queue"}'
  fi
else
  echo "{\"status\":\"timeout\",\"error\":\"No reply received within ${TIMEOUT} seconds\"}"
fi
