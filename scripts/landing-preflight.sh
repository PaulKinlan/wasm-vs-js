#!/usr/bin/env bash
# Landing preflight: gate a `git push` to a shared target behind an
# assert-then-act check of the dry-run output. One tracked implementation for
# every merger lane, so a failed gate can never read green through a pipeline.
#
# Usage: landing-preflight.sh <target-branch>
#
# Exit codes (the four landing branches):
#   0  OK: dry-run shows a genuine update/new-branch row and the push ran.
#   2  Nothing to land: "Everything up-to-date" — HEAD has nothing the target
#      lacks. Do NOT push.
#   3  Refused: "[rejected]" — remote moved; fetch, re-merge, re-gate. Do NOT
#      push.
#   4  Unrecognised dry-run output — fail closed, do NOT push.
#   1  Precondition/assertion failure (dirty tree, HEAD == remote tip, update
#      row sha mismatch, usage error) — fail closed, do NOT push.
set -euo pipefail

usage() {
  echo "usage: $0 <target-branch>" >&2
  echo "  Runs 'git push --dry-run origin HEAD:<target>' and pushes only when the" >&2
  echo "  dry-run shows a genuine update or new-branch row." >&2
}

target="${1:-}"
if [[ -z "$target" ]]; then
  usage
  exit 1
fi

# Precondition: clean worktree. An uncommitted merge leaves HEAD at the old
# tip and would reproduce the false green.
if [[ -n "$(git status --porcelain)" ]]; then
  echo "landing-preflight: worktree is not clean; commit or stash before landing" >&2
  exit 1
fi

head="$(git rev-parse HEAD)"

# Precondition: HEAD must differ from the remote tip. If they are equal the
# merge produced no new commit (HEAD is still at main), and "Everything
# up-to-date" would misread as success.
remote_tip=""
remote_exists=false
if remote_tip="$(git rev-parse --verify --quiet "origin/$target")"; then
  remote_exists=true
fi
if $remote_exists && [[ "$head" == "$remote_tip" ]]; then
  echo "landing-preflight: HEAD == origin/$target ($head); merge produced no new commit" >&2
  exit 1
fi

dry="$(mktemp)"
trap 'rm -f "$dry"' EXIT

# Capture the return code UNPIPED and the output to a FILE. A pipeline reports
# the last command's status, which is how a failed gate reads green.
rc=0
git push --dry-run origin HEAD:"$target" >"$dry" 2>&1 || rc=$?

# REFUSED: do NOT push; fetch + re-merge + re-gate.
if grep -qF '[rejected]' "$dry"; then
  echo "landing-preflight: refused (rc=$rc); fetch, re-merge, re-gate — not pushing" >&2
  exit 3
fi

# NOTHING TO LAND: do NOT push.
if grep -qF 'Everything up-to-date' "$dry"; then
  echo "landing-preflight: nothing to land — not pushing" >&2
  exit 2
fi

# Brand-new target ref: a "* [new branch]" row has NO sha pair, so it must be
# handled explicitly rather than falling into the unrecognised branch.
if grep -qF '* [new branch]' "$dry"; then
  git push origin HEAD:"$target"
  exit 0
fi

# Anchored update-row regex, never a loose "HEAD -> " substring. The loose
# substring matches a REFUSAL row (measured: 1 match in both refusal variants)
# while this anchored row regex does not (0 matches).
if grep -qE '^ *[0-9a-f]{4,}..[0-9a-f]{4,} +HEAD -> ' "$dry"; then
  row="$(grep -m1 -E '^ *[0-9a-f]{4,}..[0-9a-f]{4,} +HEAD -> ' "$dry")"
  read -r sha_pair _rest <<< "$row"
  first="${sha_pair%%..*}" # OLD value = destination ref's current value
  second="${sha_pair#*..}" # NEW value = HEAD

  # In "b70e456..60ecc75  HEAD -> main" the FIRST sha is the OLD value and the
  # SECOND is the NEW value. The dry-run abbreviates the shas while
  # `git rev-parse` returns full 40-hex, so resolve each abbreviation before
  # comparing. Asserting FIRST == HEAD fails on every genuine landing.
  new_resolved="$(git rev-parse --verify "$second" 2>/dev/null)" || new_resolved=""
  if [[ "$new_resolved" != "$head" ]]; then
    echo "landing-preflight: update row NEW sha $second resolves to ${new_resolved:-<unresolvable>}, not HEAD $head; not pushing" >&2
    exit 1
  fi
  old_resolved="$(git rev-parse --verify "$first" 2>/dev/null)" || old_resolved=""
  if [[ "$old_resolved" != "$remote_tip" ]]; then
    echo "landing-preflight: update row OLD sha $first resolves to ${old_resolved:-<unresolvable>}, not origin/$target $remote_tip (stale fetch?); not pushing" >&2
    exit 1
  fi

  # OK: push NOW, in this same conditional block. A dry-run followed by an
  # unconditional push is a rehearsal, not a preflight.
  git push origin HEAD:"$target"
  exit 0
fi

# UNKNOWN OUTPUT: fail closed, do NOT push.
echo "landing-preflight: unrecognised dry-run output (rc=$rc) — failing closed, not pushing" >&2
cat "$dry" >&2
exit 4
