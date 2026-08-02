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

## What remains before M1 acceptance

An independently reviewed orchestrator must launch exact owned Chrome processes and profiles, gather at least 20 paired fresh launches, continue to the preregistered precision target or cap, retain console/network/screenshots/assertions, and prove exact process/profile cleanup. A manual pilot cannot satisfy that gate.
