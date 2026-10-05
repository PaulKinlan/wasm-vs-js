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
#      artefact lands here), invalid target name (HEAD, */HEAD, a refs/ path,
#      or a name with '..', ':', whitespace, a leading '-', or characters
#      outside [A-Za-z0-9_./-]), target absent from
#      refs/remotes/origin/<target> without --new-branch (a typo'd target
#      lands here), a dry-run new-branch row without --new-branch, HEAD ==
#      origin/<target> (the benign "nothing to land" case — it exits 1 here,
#      not 2), dry-run non-zero exit, update-row sha mismatch, usage error
#      (including multiple positional targets).
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
  echo "  <target-branch> is a bare branch name, not a ref path; HEAD and */HEAD" >&2
  echo "  are refused (see the header for the exact name pattern)." >&2
}

# A gate whose safety depends on the caller typing correctly is the gate that
# failed here twice. Validate the target as a bare branch NAME before any git
# work, so a caller cannot smuggle a symbolic ref, a ref path, or a
# path-shaped string through the later checks.
validate_target() {
  local t="$1"
  if [[ "$t" == "HEAD" || "$t" == */HEAD ]]; then
    echo "landing-preflight: invalid target '$t': HEAD is a symbolic ref, not a branch name" >&2
    exit 1
  fi
  if [[ "$t" == refs/* ]]; then
    echo "landing-preflight: invalid target '$t': pass a branch name (e.g. 'main'), not a ref path (e.g. 'refs/heads/main')" >&2
    exit 1
  fi
  # The option parser already rejects a leading '-', but keep the rule here so
  # the validator is complete on its own.
  if [[ "$t" == -* ]]; then
    echo "landing-preflight: invalid target '$t': must not start with '-'" >&2
    exit 1
  fi
  if [[ "$t" == *..* ]]; then
    echo "landing-preflight: invalid target '$t': must not contain '..'" >&2
    exit 1
  fi
  if [[ "$t" == *:* ]]; then
    echo "landing-preflight: invalid target '$t': must not contain ':'" >&2
    exit 1
  fi
  if [[ "$t" == *[[:space:]]* ]]; then
    echo "landing-preflight: invalid target '$t': must not contain whitespace" >&2
    exit 1
  fi
  if [[ ! "$t" =~ ^[A-Za-z0-9_./-]+$ ]]; then
    echo "landing-preflight: invalid target '$t': allowed characters are letters, digits, '-', '_', '.', '/'" >&2
    exit 1
  fi
}

new_branch=false
target=""
for arg in "$@"; do
  case "$arg" in
    --new-branch) new_branch=true ;;
    -h | --help) usage; exit 0 ;;
    -*) echo "landing-preflight: unknown option: $arg" >&2; usage; exit 1 ;;
    *)
      if [[ -n "$target" ]]; then
        echo "landing-preflight: too many targets: '$target' and '$arg' — pass exactly one <target-branch>" >&2
        usage
        exit 1
      fi
      target="$arg" ;;
  esac
done

if [[ -z "$target" ]]; then
  usage
  exit 1
fi
validate_target "$target"

# Precondition: clean worktree. An uncommitted merge leaves HEAD at the old
# tip and would reproduce the false green. `git status --porcelain` also
# counts untracked files, so a stray build artefact forces this branch too —
# fail-closed and intended.
if [[ -n "$(git status --porcelain)" ]]; then
  echo "landing-preflight: worktree is not clean; commit or stash before landing" >&2
  exit 1
fi

head="$(git rev-parse HEAD)"

# The target must already exist as a remote-tracking ref unless the caller
# opts in to creating a new remote branch. A typo'd target (e.g. "mian")
# would otherwise dry-run as "* [new branch]" and be pushed onto the shared
# remote.
#
# Qualify the namespace: check refs/remotes/origin/$target, never the bare
# origin/$target. `git rev-parse` resolves an unqualified name in the order
# refs/heads, refs/tags, refs/remotes — so a LOCAL branch or tag literally
# named origin/$target would satisfy a bare origin/$target check and make the
# guard read green while the remote has no such branch.
remote_tip=""
remote_exists=false
if remote_tip="$(git rev-parse --verify --quiet "refs/remotes/origin/$target")"; then
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
# handled explicitly rather than falling into the unrecognised branch. The
# regex is anchored to line start (a remote MOTD or hook line that merely
# contains the text cannot match) and the block RE-CHECKS --new-branch: a
# stale tracking ref can make the existence check above read green while the
# remote has since deleted the branch, so the dry-run still reports a new
# branch — without the flag that must fail closed, never push.
if grep -qE '^ *\* \[new branch\] +HEAD -> ' "$dry"; then
  if ! $new_branch; then
    echo "landing-preflight: dry-run shows a new remote branch for origin/$target but --new-branch was not passed — refusing to create it, not pushing" >&2
    exit 1
  fi
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
