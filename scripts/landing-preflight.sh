#!/usr/bin/env bash
# Landing preflight: gate a `git push` to a shared target behind an
# assert-then-act check of the dry-run output. One tracked implementation for
# every merger lane, so a failed gate can never read green through a pipeline.
#
# Usage: landing-preflight.sh [--new-branch] <target-branch>
#
#   --new-branch  Opt-in: create <target-branch> on origin if it does not
#                 already exist. Without it, a target that is not already
#                 origin/<target> fails closed as a likely typo.
#
# Exit codes:
#   0  OK: dry-run (rc 0) shows a genuine update/new-branch row and the real
#      push ran.
#   1  Precondition/assertion failure — fail closed, do NOT push: dirty
#      worktree (status --porcelain also counts untracked files, so a stray
#      artefact lands here), target absent from origin/<target> without
#      --new-branch (a typo'd target lands here), HEAD == origin/<target>
#      (the benign "nothing to land" case — it exits 1 here, not 2),
#      dry-run non-zero exit, update-row sha mismatch, usage error.
#   2  Nothing to land: "Everything up-to-date" — HEAD has nothing the target
#      lacks. Do NOT push. NOTE: nearly unreachable in the intended flow; see
#      exit 1 (HEAD == origin/<target> fires first). Reaching here needs a
#      stale tracking ref.
#   3  Refused: "[rejected]" — remote moved; fetch, re-merge, re-gate. Do NOT
#      push.
#   4  Unrecognised dry-run output — fail closed, do NOT push.
#   5  Real push attempted and failed (the dry-run passed but the push was
#      declined/errored) — distinct from "never attempted".
set -euo pipefail

usage() {
  echo "usage: $0 [--new-branch] <target-branch>" >&2
  echo "  Runs 'git push --dry-run origin HEAD:<target>' and pushes only when the" >&2
  echo "  dry-run (exit 0) shows a genuine update or new-branch row." >&2
  echo "  A target not already present as origin/<target> requires --new-branch." >&2
}

new_branch=false
target=""
for arg in "$@"; do
  case "$arg" in
    --new-branch) new_branch=true ;;
    -h | --help) usage; exit 0 ;;
    -*) echo "landing-preflight: unknown option: $arg" >&2; usage; exit 1 ;;
    *) target="$arg" ;;
  esac
done

if [[ -z "$target" ]]; then
  usage
  exit 1
fi

# Precondition: clean worktree. An uncommitted merge leaves HEAD at the old
# tip and would reproduce the false green. `git status --porcelain` also
# counts untracked files, so a stray build artefact forces this branch too —
# fail-closed and intended.
if [[ -n "$(git status --porcelain)" ]]; then
  echo "landing-preflight: worktree is not clean; commit or stash before landing" >&2
  exit 1
fi

head="$(git rev-parse HEAD)"

# The target must already exist as origin/<target> unless the caller opts in
# to creating a new remote branch. A typo'd target (e.g. "mian") would
# otherwise dry-run as "* [new branch]" and be pushed onto the shared remote.
remote_tip=""
remote_exists=false
if remote_tip="$(git rev-parse --verify --quiet "origin/$target")"; then
  remote_exists=true
fi
if ! $remote_exists && ! $new_branch; then
  echo "landing-preflight: origin/$target does not exist — refusing to create a remote branch from a possible typo; pass --new-branch to create it deliberately" >&2
  exit 1
fi

# Precondition: HEAD must differ from the remote tip. If they are equal the
# merge produced no new commit (HEAD is still at main), and "Everything
# up-to-date" would misread as success. This is the benign "nothing to land"
# case — it exits 1 here, not 2 (see the header).
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

# NOTHING TO LAND: do NOT push. Nearly unreachable in the intended flow —
# HEAD == origin/<target> fires the precondition above first (exit 1), so
# reaching here needs a stale tracking ref.
if grep -qF 'Everything up-to-date' "$dry"; then
  echo "landing-preflight: nothing to land — not pushing" >&2
  exit 2
fi

# Real push: only after the dry-run passed (rc == 0) and its row parsed. A
# non-zero real-push exit is its own code (5), distinct from "never
# attempted".
do_push() {
  local push_rc=0
  git push origin HEAD:"$target" || push_rc=$?
  if [[ "$push_rc" -ne 0 ]]; then
    echo "landing-preflight: real push to origin/$target was attempted and failed (rc=$push_rc) — not green" >&2
    exit 5
  fi
}

# Brand-new target ref: a "* [new branch]" row has NO sha pair, so it must be
# handled explicitly rather than falling into the unrecognised branch. Only
# reachable with --new-branch (the existence check above fails closed
# otherwise).
if grep -qF '* [new branch]' "$dry"; then
  if [[ "$rc" -ne 0 ]]; then
    echo "landing-preflight: dry-run emitted a new-branch row but exited non-zero (rc=$rc) — failing closed, not pushing" >&2
    exit 1
  fi
  do_push
  exit 0
fi

# Anchored update-row regex, never a loose "HEAD -> " substring. The loose
# substring matches a REFUSAL row (measured: 1 match in both refusal variants)
# while this anchored row regex does not (0 matches). `\.\.` keeps the
# separator literal: an unescaped `..` would match any two characters.
if grep -qE '^ *[0-9a-f]{4,}\.\.[0-9a-f]{4,} +HEAD -> ' "$dry"; then
  if [[ "$rc" -ne 0 ]]; then
    echo "landing-preflight: dry-run emitted an update row but exited non-zero (rc=$rc) — failing closed, not pushing" >&2
    exit 1
  fi
  row="$(grep -m1 -E '^ *[0-9a-f]{4,}\.\.[0-9a-f]{4,} +HEAD -> ' "$dry")"
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
  do_push
  exit 0
fi

# UNKNOWN OUTPUT: fail closed, do NOT push.
echo "landing-preflight: unrecognised dry-run output (rc=$rc) — failing closed, not pushing" >&2
cat "$dry" >&2
exit 4
