#!/bin/bash
# Discord Bridge ヘルスチェック
# Usage: discord-status.sh
PORT="${DISCORD_BRIDGE_PORT:-13456}"
PROJECT_ROOT=$(git rev-parse --show-toplevel 2>/dev/null)
CHANNEL_ID=""
if [ -n "$PROJECT_ROOT" ] && [ -f "$PROJECT_ROOT/.discord-bridge.json" ]; then
  CHANNEL_ID=$(python3 -c "import json; print(json.load(open('$PROJECT_ROOT/.discord-bridge.json'))['channelId'])" 2>/dev/null)
fi

if [ -n "$CHANNEL_ID" ]; then
  curl -s "http://localhost:${PORT}/health?channelId=${CHANNEL_ID}"
else
  curl -s "http://localhost:${PORT}/health"
fi
