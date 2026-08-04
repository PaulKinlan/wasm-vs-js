# Manifest redesign: eliminating the hash-cascade class

Status: design (2026-08-04). Trigger: the deno.json fmt-exclude edit (#303) cascaded
through 8 commits of rebinds; the text-gc worker anchor went stale twice in one day;
Gemini's 63d0001a rebound a manifest but missed the worker pin.

## The problem

Artifact/source hashes are embedded as string literals across dozens of files:
workload manifests, evidence records, frozen schemas (`const`), corpus fixtures,
worker `EXPECTED` anchors, status JSON, page pins, test constants. Every source-file
change (deno.json, server.ts, a workload script) cascades transitively through all of
them. The rebind script covers the server.ts-coupled set only; deno.json touches a
wider set (sum-u32, text-gc surgical, audio chain, preregistration canonical hash in
4 sites, traditional evidence commit+tree pairing). Each cascade is mechanical but
wide, fail-closed at every step, and easy to get subtly wrong (string-patching
builder-owned files diverges from builder output; canonical byte formats corrupt
under naive `json.dumps`).

## The principle

Route codegen (#303) proved the pattern: **filesystem/artifact bytes are the single
source of truth; everything else is generated or verified, never hand-maintained.**
Apply it to the remaining hand-pinned surfaces. A hash should exist as a literal in
exactly ONE generated file per consumer surface; the generator recomputes it from
the bytes; the gate checks freshness.

## Slices (in dependency order)

### Slice 1 — Generated worker anchors (owner: integrator)
Six workers hardcode `EXPECTED` anchor objects (pcap-decode, text-gc,
cad-mesh-repair, regex-automata-duel, vdom-diff-patch, game-ecs-frame-update).
- `scripts/build-worker-anchors.ts` scans the workers for anchor objects, maps each
  key to its artifact file (convention: fetchAnchored URLs in the same worker),
  recomputes sha256 from disk bytes, and emits
  `public/worker-anchors.generated.js` (`export const WORKER_ANCHORS = { "<worker>": { ... } }`).
- Workers import their anchor object instead of hardcoding it.
- Gate: freshness check + a generalized anchor test (all six workers, all keys,
  served bytes match) — extends the text-gc pin test added in #303.
- Kills the class that produced Paul's text-gc report and the path-tracer
  `wasm-linear` stale-target bug (#298).

### Slice 2 — Preregistration canonical hash unification (owner: Gemini)
The frozen preregistration canonical sha256 lives in FOUR sites:
`lib/source-identity.ts` (FROZEN_PREREGISTRATION_SHA256),
`lib/preregistration.ts` (EXPECTED.canonicalSha256),
`schemas/corpus.schema.json` (`const`), corpus test/script fixtures.
- `lib/preregistration.ts` becomes the single exported constant; source-identity
  imports it.
- The schema `const` is generated: `scripts/build-schemas.ts` emits
  `schemas/corpus.schema.json` with the current constant (freshness-gated), or the
  validator resolves the constant from the module at check time instead of a JSON
  literal.
- Fixtures import from the module rather than repeating the literal.

### Slice 3 — Evidence-record regeneration policy
Surgical string-patching of evidence records is forbidden (diverges from builder
output; canonical formats corrupt). Rule, to be encoded in AGENTS.md and the rebind
script: evidence/manifest files are ONLY ever written by their builder
(`--write`) or not at all. The rebind script gains the deno.json-only pinners
(sum-u32, text-gc-with-toolchain-flag, image-demos, audio chain, crypto, prereg
canonical) so one command covers the full set. text-gc remains surgical-only until
the WasmGC toolchain is present; its surgical procedure (sourceCommit + per-source
gitBlobOid + entry bytes/sha) gets scripted as
`scripts/rebind-text-gc-surgical.ts` so it stops being oral tradition.

### Slice 4 (deferred) — Content-addressed serving
Routes serve `/artifacts/<slug>/<file>` with an integrity hash computed at server
startup from disk (not a hardcoded table), and pages reference assets by
content-addressed query (`?v=<hash>`) generated at page-build time. Larger;
only worth it after slices 1–3 show residual pain.

## Non-goals

- No change to the frozen preregistered-experiment semantics: the preregistration
  file itself stays frozen and byte-pinned; only its *consumers'* duplicate
  constants are unified.
- No relaxation of fail-closed verification: generated files are freshness-gated,
  so a stale generation fails the gate exactly like a stale hand-pin does today.

## Acceptance

- `deno task check` green after an arbitrary deno.json edit with AT MOST one rebind
  command (the extended script) and zero hand edits.
- A worker anchor can only go stale between a builder run and the next gate run —
  never silently.
