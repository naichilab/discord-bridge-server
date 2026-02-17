#!/bin/bash
set -euo pipefail

HOOK_INPUT=$(cat)

DISCORD_TOKEN="${DISCORD_TOKEN:-}"
DISCORD_CHANNEL_ID="${DISCORD_CHANNEL_ID:-}"

if [[ -z "$DISCORD_TOKEN" ]] || [[ -z "$DISCORD_CHANNEL_ID" ]]; then
  exit 0
fi

# Extract stop reason
REASON=$(echo "$HOOK_INPUT" | /usr/bin/python3 -c "
import sys, json
try:
    data = json.load(sys.stdin)
    print(data.get('reason', data.get('stopReason', 'Task completed')))
except:
    print('Task completed')
" 2>/dev/null || echo "Task completed")

# Send stop notification
curl -s -X POST \
  "https://discord.com/api/v10/channels/${DISCORD_CHANNEL_ID}/messages" \
  -H "Authorization: Bot ${DISCORD_TOKEN}" \
  -H "Content-Type: application/json" \
  -d "$(/usr/bin/python3 -c "
import json, sys
msg = sys.argv[1]
print(json.dumps({'embeds': [{'title': 'Claude Code Stopped', 'description': msg, 'color': 15158332}]}))
" "$REASON")" \
  > /dev/null 2>&1

exit 0
