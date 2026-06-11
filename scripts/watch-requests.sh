#!/bin/bash
# Watch for design requests from the browser extension
# Outputs request details in a structured format to avoid truncation

while true; do
  result=$(curl -s --max-time 65 "http://127.0.0.1:3771/api/next?timeout=60000" 2>&1)

  # Only process if there's an actual request (not null)
  if echo "$result" | grep -q '"request":{'; then
    # Extract key fields for clear display
    id=$(echo "$result" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d['request']['id'])" 2>/dev/null)
    msg=$(echo "$result" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d['request']['userMessage'])" 2>/dev/null)
    tag=$(echo "$result" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d['request']['element']['tag'])" 2>/dev/null)
    classes=$(echo "$result" | python3 -c "import sys,json; d=json.load(sys.stdin); print(' '.join(d['request']['element']['classList']))" 2>/dev/null)
    text=$(echo "$result" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d['request']['element']['textContent'][:80])" 2>/dev/null)
    action=$(echo "$result" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d['request'].get('action','develop'))" 2>/dev/null)
    src=$(echo "$result" | python3 -c "import sys,json; d=json.load(sys.stdin); r=d['request']['element']; print(f\"{r.get('sourceFile','')},{r.get('sourceLine','')}\")" 2>/dev/null)

    echo "=== DESIGN REQUEST ==="
    echo "ID: $id"
    echo "Action: $action"
    echo "User Message: $msg"
    echo "Element: <$tag class=\"$classes\">"
    echo "Text: $text"
    echo "Source: $src"
    echo "======================"
  fi
done
