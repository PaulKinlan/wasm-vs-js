# M1 local pilot

This tool exercises the first complete record path. It is not M1 acceptance evidence and must not be cited as a performance result.

## Build and verify

```sh
deno task build
deno task check
```

The build compiles `benchmarks/sum-u32/sum-u32.wat` with pinned `wabt@1.0.37`. It writes a 96-byte linear-memory module and a canonical build manifest containing source/artifact/input hashes, compiler flags, exact oracle, and raw/gzip/Brotli footprint. The check rebuilds it and rejects byte drift.

## Start the local product

```sh
deno task local
```

Open <http://127.0.0.1:8787/>. The results page starts with no records and no claim. Open `/run` to use the manual pilot.

The runner requires a complete environment manifest. It refuses to infer a fresh profile, launch arguments, physical cores, RAM, source commit, or paired-block identity. The future owned-browser orchestrator supplies these fields. A representative shape is shown in the runner placeholder; values must describe the actual launch.

## Protocol states

- **Validation:** checks the complete path without a cache claim.
- **Cold:** requires `coldProfileAttested: true` from an exact owned fresh-profile launcher. The page alone cannot make that assertion.
- **Warm:** requires the operator to press **Prime exact assets** before running. JavaScript and Wasm use the same requested state, but remain separate result cells.

Choose alternating variant order and a fixed iteration count. Before timing, the runner regenerates the immutable input, verifies its SHA-256, instantiates the exact Wasm artifact, compares both complete outputs with the frozen unsigned-32-bit oracle, calibrates the timer, and chooses one shared fixed batch size. It records first-use lifecycle metrics separately, then retains the first scored post-calibration iteration and every later scored sample.

Uploads happen after measurement. `POST /api/runs` validates the published schema and RFC 8785 payload hash, then uses create-new file semantics under `raw/runs/`. A duplicate run ID returns 409. The public explorer shows every local sample and provenance field, but labels all records `pilot only`.

## Generate a versioned summary

```sh
deno task summary
```

This writes `raw/summaries/m1-pilot-1.json` from immutable source payloads. The summary retains first scored post-calibration medians, full scored trajectories, separate first-use lifecycle metrics, absolute durations, cache state, launch/block counts, and its own canonical hash. It deliberately emits no ratio, confidence interval, or winner.

## Chrome package immutability boundary

Run `deno task --config deno.corpus.json corpus:inspect-chrome-package` before permit issuance; it launches no browser and prints the exact `chromePackageManifestSha256` field to freeze into the permit. The corpus collector then copies the complete reviewed Chrome package before permit consumption, hashes every file, requires that digest to equal the permit, and verifies it immediately before each launch. After systemd reports `MainPID`, it hashes `/proc/<MainPID>/exe` and requires device, inode, and SHA-256 equality before navigation or timed work. It performs no package hashing during scored work.

Mode bits are not claimed as kernel-enforced immutability: portable unprivileged Deno cannot seal the executable or any adjacent Chromium resource while preserving package lookup on every supported filesystem. A malicious same-UID process could theoretically rewrite and restore executable, locale, `.pak`, library, or other package bytes between checks. The fd-relative no-follow profile remover prevents symlink traversal, but terminal replacement races by a malicious process with the same UID are likewise outside its portable guarantee. Collection therefore requires a dedicated user session without any untrusted same-UID processes. This exclusion applies consistently to the complete staged package, cgroup acquisition, and profile removal; a kernel-sealed package and hostile-same-UID design would require separate review.

The production Deno tasks grant write access only to `raw/`, the two owned temporary roots, and the current user's systemd app-slice cgroup (`user-$(id -u)`). The cgroup grant exists solely so the collector can retain and write the authenticated `cgroup.kill` descriptor. `corpus:permission-probe` exercises the same open/write operation against an owned fake cgroup tree without launching systemd or Chrome.

## Permit and cleanup lifecycle

Before writing a consumption receipt, the collector validates the clean source identity, closed preregistration/benchmark/build/source/Chrome/launch manifests, local health response, and the bytes of every collector route against its locally computed SHA-256. It also create-new reserves the permit's complete corpus namespace and profile ownership namespace, rejecting existing output or planned profile paths before consumption. Generated private evidence under `raw/permits/` and `raw/corpora/` is the only ignored checkout state allowed during those repeated checks. A failed preflight does not consume the one-time permit.

An attempt begins only after the exact `systemd-run` invocation succeeds. Failures before that signal are retained in a separate closed prelaunch-failure record and do not increment `attempted`. Stage removal follows an explicit cleanup lifecycle state. A verified no-launch or verified owned cleanup permits removal; active or unresolved owned cleanup retains the exact stage.

Each stage has a closed owner manifest bound to its permit ID, source commit, package digest, stage-parent identity, and root device/inode. Lifecycle writes authenticate an opened descriptor before truncating that descriptor. Stage, owner, corpus-reservation, and profile deletion use retained parent descriptors, terminal no-follow lookups, and exact device/inode checks. Startup reconciles only that permit's named stage and owner file. Missing, symlinked, replaced, or mismatched identity is retained for inspection; the collector does not scan or delete other stage trees. Process cleanup remains limited to the authenticated owned cgroup and profile. No global Chrome process operation is used.

These checks describe the local collector implementation. They are not browser evidence, M1 acceptance, or a performance claim.

## What remains before M1 acceptance

An independently reviewed orchestrator must launch exact owned Chrome processes and profiles, gather at least 20 paired fresh launches, continue to the preregistered precision target or cap, retain console/network/screenshots/assertions, and prove exact process/profile cleanup. A manual pilot cannot satisfy that gate.
