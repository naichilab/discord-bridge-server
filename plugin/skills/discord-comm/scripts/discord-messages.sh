#!/bin/bash
# キューに溜まった Discord メッセージを取得
# Usage: discord-messages.sh [count] [include_history]
COUNT="${1:-10}"
HISTORY="${2:-false}"
PORT="${DISCORD_BRIDGE_PORT:-13456}"
PROJECT_ROOT=$(git rev-parse --show-toplevel 2>/dev/null)
CHANNEL_ID=""
if [ -n "$PROJECT_ROOT" ] && [ -f "$PROJECT_ROOT/.discord-bridge.json" ]; then
  CHANNEL_ID=$(python3 -c "import json; print(json.load(open('$PROJECT_ROOT/.discord-bridge.json'))['channelId'])" 2>/dev/null)
fi

QUERY="count=${COUNT}&include_history=${HISTORY}"
if [ -n "$CHANNEL_ID" ]; then
  QUERY="${QUERY}&channelId=${CHANNEL_ID}"
fi

curl -s "http://localhost:${PORT}/messages?${QUERY}"
