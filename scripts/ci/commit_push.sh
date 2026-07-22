#!/usr/bin/env bash
# Usage: commit_push.sh "<commit message>" <path>...
# Commits the given paths as the github-actions bot and pushes, rebasing on
# top of any concurrent push. No-op when there is nothing to commit.
#
# The README build-status block (scripts/update_readme_status.py) is a
# machine-generated, timestamped block rewritten on EVERY run, so two runs that
# overlap always collide on it during the rebase. That conflict is meaningless:
# the run finishing last holds the authoritative status, so we re-assert our
# freshly built README and continue. Any OTHER conflict is a genuine concurrent
# data change (e.g. clips.json / manifest.json) and must fail loudly rather than
# be silently resolved — picking "ours" there could drop the other run's clips.
set -euo pipefail

message="$1"
shift

git config user.name "github-actions[bot]"
git config user.email "41898282+github-actions[bot]@users.noreply.github.com"
git add -A "$@"
if git diff --cached --quiet; then
  echo "Nothing to commit."
  exit 0
fi
git commit -m "$message"

branch="${GITHUB_REF_NAME:-main}"
# Keep our built README so we can re-assert it if the rebase conflicts on it.
our_readme="$(mktemp)"
cp README.md "$our_readme"

git fetch origin "$branch"
if ! git rebase "origin/$branch"; then
  while [ -n "$(git diff --name-only --diff-filter=U)" ]; do
    conflicts="$(git diff --name-only --diff-filter=U)"
    if [ "$conflicts" != "README.md" ]; then
      echo "Conflit de rebase inattendu (hors README.md) :" >&2
      echo "$conflicts" >&2
      git rebase --abort
      rm -f "$our_readme"
      exit 1
    fi
    cp "$our_readme" README.md
    git add README.md
    if git diff --cached --quiet; then
      GIT_EDITOR=true git rebase --skip
    else
      GIT_EDITOR=true git rebase --continue
    fi
  done
fi
rm -f "$our_readme"
git push
