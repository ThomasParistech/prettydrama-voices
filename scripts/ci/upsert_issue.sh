#!/usr/bin/env bash
# Usage: upsert_issue.sh "<title>" <body_file>
# Comments on the existing OPEN issue with the same title instead of piling
# up duplicates; creates it if none exists. Titles are fixed constants from
# the workflow (never user-controlled).
set -euo pipefail

title="$1"
body_file="$2"

existing=$(gh issue list --state open --json number,title \
  --jq "[.[] | select(.title == \"$title\")][0].number // empty")

if [ -n "$existing" ]; then
  gh issue comment "$existing" --body-file "$body_file"
else
  gh issue create --title "$title" --body-file "$body_file"
fi
