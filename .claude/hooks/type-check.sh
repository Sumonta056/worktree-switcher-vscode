#!/bin/sh
# PostToolUse hook: after an Edit/Write touches a src/**/*.ts file, run a
# type check right away so errors surface immediately instead of at the end
# of a task.
set -eu

input="$(cat)"
file_path="$(printf '%s' "$input" | python3 -c "
import json, sys
try:
    data = json.load(sys.stdin)
    print(data.get('tool_input', {}).get('file_path', ''))
except Exception:
    print('')
")"

case "$file_path" in
    src/*.ts | */src/*.ts)
        cd "${CLAUDE_PROJECT_DIR:-.}"
        echo "type-check hook: checking $file_path" >&2
        npx tsc --noEmit -p . 2>&1 || {
            echo "type-check hook: tsc reported errors above" >&2
            exit 2
        }
        ;;
esac
