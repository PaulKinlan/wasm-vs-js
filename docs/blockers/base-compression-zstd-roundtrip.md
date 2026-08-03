# Blocker: controlled JavaScript zstd encoder

`compression.zstd-gzip-roundtrip.v1` remains unimplemented. The frozen catalog bytes and the `0/38` numerator are unchanged.

## Required pair

The catalog requires one zstd encode and decode at a frozen level for deterministic 1, 10, and 100 MiB project snapshots. The controlled pair needs:

- a JavaScript encoder and decoder that execute in JavaScript;
- a material linear-Wasm encoder and decoder in the same zstd family;
- interoperability with an independent zstd implementation;
- exact roundtrip hashes plus frame-structure checks.

A Wasm package exposed through a JavaScript API does not satisfy the JavaScript target. A decoder-only package cannot execute the registered encode step.

## Candidate results

`fzstd@0.1.1` is an MIT-licensed pure-JavaScript decoder. Its published API has no encoder.

`zstdify@1.4.0` is the only license-compatible pure-JavaScript encoder and decoder found in the package search. Its npm tarball SHA-256 is `0f464bccc23409fa64b738e12898cb97de4d23dafc37caa9837acb3a2936e973`. Two fixed probes disqualify it for this workload:

1. A 1 MiB valid JSON fixture fails during level-3 compression with `FSE readNCount: truncated input`.
2. A 32 KiB structured binary fixture self-roundtrips through zstdify, but zstd 1.5.7 rejects the emitted frame with exit code 1 and `Data corruption detected`.

The second result matters because a self-roundtrip only proves agreement between one encoder and its paired decoder. It does not prove that the output is a valid zstd frame. The probe input hash is `baa8f91d750a704eb922e69271e776eefb9f6497ea586d7dda2ea158f62db497`; the rejected frame hash is `6027a209cdcdafbcb87bb962f45a953f9c1e8f3feb789d7d5ad407193dff35bb`.

Browser packages such as `@foxglove/wasm-zstd` compile the official C implementation to Wasm. They are suitable Wasm candidates, but using one behind the JavaScript variant would compare Wasm with Wasm. `zstd.ts` and native Node bindings invoke a system library or process and cannot run as the controlled browser JavaScript target.

## Reproduce

Run:

```sh
./scripts/reproduce-base-zstd-js-blocker.sh
```

The script requires Deno 2.9.0, npm access, and zstd CLI 1.5.7. It downloads the exact `zstdify@1.4.0` package, checks the tarball hash, repeats both probes, verifies the self-roundtrip, and requires the independent decoder rejection. The machine-readable result is [`blocker.v1.json`](../../artifacts/base-v1/compression-zstd-roundtrip/blocker.v1.json), validated by [`base-workload-blocker.schema.json`](../../schemas/base-workload-blocker.schema.json).

## Unblock condition

Re-open implementation only when a pinned pure-JavaScript encoder and decoder passes official zstd vectors, the registered 1/10/100 MiB fixtures, and independent zstd 1.5.7 decoding at the frozen level. Until then, adding a demo, artifact, or implementation numerator would claim coverage the project does not have.
