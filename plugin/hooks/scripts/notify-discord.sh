#!/bin/bash
set -euo pipefail

# Read hook input from stdin
HOOK_INPUT=$(cat)

DISCORD_TOKEN="${DISCORD_TOKEN:-}"
DISCORD_CHANNEL_ID="${DISCORD_CHANNEL_ID:-}"

if [[ -z "$DISCORD_TOKEN" ]] || [[ -z "$DISCORD_CHANNEL_ID" ]]; then
  exit 0
fi

# Extract notification message
NOTIFICATION=$(echo "$HOOK_INPUT" | /usr/bin/python3 -c "
import sys, json
try:
    data = json.load(sys.stdin)
    print(data.get('notification', data.get('message', 'Claude Code notification')))
except:
    print('Claude Code notification')
" 2>/dev/null || echo "Claude Code notification")

# Send via Discord REST API
curl -s -X POST \
  "https://discord.com/api/v10/channels/${DISCORD_CHANNEL_ID}/messages" \
  -H "Authorization: Bot ${DISCORD_TOKEN}" \
  -H "Content-Type: application/json" \
  -d "$(/usr/bin/python3 -c "
import json, sys
msg = sys.argv[1]
print(json.dumps({'embeds': [{'title': 'Notification', 'description': msg, 'color': 3447003}]}))
" "$NOTIFICATION")" \
  > /dev/null 2>&1

exit 0
