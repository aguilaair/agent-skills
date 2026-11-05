#!/usr/bin/env bash
# Upload one file to Slack through the 1mcp Slack server and share it.
# Usage: slack-upload.sh <file> <channel_id> [thread_ts] [comment.md]
# The comment file's text becomes the message the file is shared with.
set -euo pipefail
FILE="${1:?file}"; CHANNEL="${2:?channel_id}"; THREAD="${3:-}"; COMMENT="${4:-}"
NAME="$(basename "$FILE")"
SIZE="$(stat -f%z "$FILE" 2>/dev/null || stat -c%s "$FILE")"
case "$NAME" in
  *.mp4) TYPE=video/mp4;; *.png) TYPE=image/png;; *.jpg|*.jpeg) TYPE=image/jpeg;;
  *) TYPE=application/octet-stream;;
esac

text_of() { python3 -I -c '
import json,sys
s=sys.stdin.read(); raw=s[s.find("text,")+5:].strip()
t=json.loads(raw)
t=json.loads(t) if isinstance(t,str) and t.startswith("{") else t
print(t.get("result", json.dumps(t)) if isinstance(t,dict) else t)'; }

OUT="$(1mcp run Slack/slack_get_file_upload_url --args "{\"filename\":\"$NAME\",\"content_length\":$SIZE}" | text_of)"
FID="$(sed -n 's/^File ID: //p' <<<"$OUT")"
URL="$(sed -n 's/^Upload URL: //p' <<<"$OUT")"
[[ -n "$FID" && -n "$URL" ]] || { echo "no upload URL: $OUT" >&2; exit 1; }

CODE="$(curl -s -o /dev/null -w '%{http_code}' -X POST "$URL" -H "Content-Type: $TYPE" --data-binary @"$FILE")"
[[ "$CODE" == 200 ]] || { echo "upload of $NAME failed: HTTP $CODE" >&2; exit 1; }

ARGS="$(python3 -I - "$FID" "$CHANNEL" "$NAME" "$THREAD" "$COMMENT" <<'EOF'
import json,sys
fid,ch,name,thread,comment=sys.argv[1:]
a={"file_id":fid,"channel_id":ch,"title":name}
if thread: a["thread_ts"]=thread
if comment: a["initial_comment"]=open(comment).read().strip()
print(json.dumps(a))
EOF
)"
1mcp run Slack/slack_complete_file_upload --args "$ARGS" | text_of
