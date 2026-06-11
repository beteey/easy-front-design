#!/bin/bash
# Watch design request queue — polls every 10 seconds
# Outputs request JSON when one arrives (consumes it from queue)
SERVER="http://127.0.0.1:3771"

while true; do
  result=$(curl -s --max-time 15 "$SERVER/api/next?timeout=12000" 2>/dev/null)
  if [ -n "$result" ] && echo "$result" | grep -q '"request":{' 2>/dev/null; then
    echo "$result"
  fi
  sleep 1
done
