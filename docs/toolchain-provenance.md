# Toolchain provenance under changing build infrastructure

How this repository records which compiler built which artifact, and why the
record is shaped the way it is.

## The failure this design came from

The provenance ledger pinned two strings:

```json
"toolchain": { "clang": "clang version 22.1.8", "rustc": "rustc 1.97.1 (8bab26f4f 2026-07-14)" }
```

An arm64 macOS machine with Homebrew's LLVM 22 satisfies both. Its clang reports
`Homebrew clang version 22.1.8` and its rustc matches the pin character for character. Its
fingerprint is `tc-9890abef9b5a`, and across the 181 kernels the ledger now covers it
rebuilds 47 of them byte for byte:

| Language       | Kernels | Rebuilt identically |
| -------------- | ------: | ------------------: |
| Dart           |      27 |                  27 |
| AssemblyScript |      35 |                  13 |
| Rust           |      39 |                   7 |
| C              |      39 |                   0 |
| C++            |      41 |                   0 |

Two caveats on reading that column. It is not purely a toolchain verdict: the recorded
recipe is a generic per-language command, and where the committed artifact was built with
flags nobody wrote down, the recipe cannot reproduce it on any machine. The C and C++ rows
at zero are consistent with either cause, and the ledger does not currently separate them.
The Dart row was at 24 of 27 until the three dart2wasm optimization-level variants got their
`-O` flag into the recipe — that was a recipe error being reported as a reproduction
failure, and fixing the recipe fixed the row.

The direct evidence that the machine matters is in the disagreement between the two
toolchains the ledger now holds. Comparing `tc-unrecorded` with `tc-9890abef9b5a` over the
154 kernels both have observed:

| Both machines                                 | Kernels |
| --------------------------------------------- | ------: |
| rebuilt the committed bytes                   |      20 |
| failed to                                     |     128 |
| **disagreed** — one rebuilt them, one did not |   **6** |

The six are `crypto`, `myers_diff` and `nbody_step` in both C and C++: same source, same
recorded command, different machine, different bytes. There is no case of the reverse, so
the Homebrew toolchain is strictly worse here rather than merely different.

Underneath the 128 both machines failed on, 98 did not even agree with _each other_ — three
distinct binaries for one source and one recipe. A boolean field had no way to say that.

A release number identifies a source tree. Two vendors can build the same tree with
different defaults, different LLVM points, different config files, and ship binaries that
disagree. The pin was satisfied and the bytes still changed.

Worse, the ledger had one writer in mind. `reproducesCommittedBytes` was a bare boolean per
kernel, so the second machine to run the builder either overwrote the first machine's
verdicts or had to be filtered out. A filtered run once rewrote the C and C++ hashes and
relabelled the global toolchain block as Homebrew's — injecting one machine's noise into a
record shared by 154 entries.

## What changed

### Reproduction is recorded as a measurement

Schema v2 replaces the per-kernel boolean with one observation per toolchain:

```json
{
  "artifact": "gemm_asc_ikj.wasm",
  "artifactSha256": "<the committed file's hash>",
  "reproducesCommittedBytes": true,
  "reproductions": [
    {
      "toolchain": "tc-9890abef9b5a",
      "result": "identical",
      "artifactSha256": "<what that machine compiled>",
      "firstObserved": "2026-09-18",
      "lastObserved": "2026-09-18"
    }
  ]
}
```

Appending is the only write. A machine records under its own fingerprint and cannot
overwrite another's. `reproducesCommittedBytes` survives as a roll-up meaning _at least one
recorded toolchain reproduced these bytes_; `reproductionsByToolchain` gives the per-machine
breakdown, where a recipe a machine never ran is `notObserved` rather than a failure.

Two other things the v1 schema got wrong are fixed in the same pass. `artifactSha256` now
holds the committed file's hash — under v1 it held whatever the last run compiled, so for
the entries that do not reproduce it did not describe the file it sat beside. And a kernel
with no committed artifact yet records `notCommitted`, not `differs`: there was nothing to
reproduce.

Entries written before observations had an identity are carried forward under
`tc-unrecorded`, whose record says exactly that. Their dates are the string `"unrecorded"`,
not a guess.

### Toolchains are identified, not versioned

`scripts/toolchain-fingerprint.ts` probes clang, clang++, wasm-ld, rustc, dart and node, and
hashes what they report about themselves into an id like `tc-9890abef9b5a`. The hash covers
version, target triple and backend version. It excludes install paths, so the same
distribution unpacked in two places is one toolchain while two distributions of one release
stay distinct.

A tool that is not installed is recorded as `"unavailable"` with a reason. It is never a
blank and never a zero.

Run it directly to see what your machine would record:

```
deno run -A scripts/toolchain-fingerprint.ts
```

### Distributions are pinned by hash

`toolchain-pin.json` names each compiler by download URL and sha256:

| Distribution   | Pinned by                                                                         |
| -------------- | --------------------------------------------------------------------------------- |
| LLVM 22.1.8    | per-platform release tarball sha256, from the GitHub release digest               |
| Rust 1.97.1    | the sha256 of `channel-rust-1.97.1.toml`, which pins every component transitively |
| Dart 3.12.2    | per-platform SDK archive sha256, from the published `.sha256sum`                  |
| AssemblyScript | the npm registry integrity digest for 0.28.20                                     |

The AssemblyScript entry is new information rather than a restatement. The builder invokes
`npx --yes -p assemblyscript asc`, which resolves to whatever version is current; nothing in
the repository had ever pinned it. Every AssemblyScript artifact reproduces under 0.28.20,
so that is what the pin records.

Deno, Node and the host macOS SDK are listed as deliberately unpinned, each with a reason.
Nothing is left out silently.

What the pin does **not** say is that the committed artifacts came from these distributions.
The originals were recorded only as version strings, so they are unrecoverable. The pin
states what the project builds against from here; the ledger states what each machine has
observed.

## Reading the record

- `toolchain` — the reference pin, read from `toolchain-pin.json`. Not a claim about any
  particular build.
- `toolchains` — every machine that has recorded an observation, by fingerprint.
- `reproducesCommittedBytes` / `doesNotReproduceCommittedBytes` — kernels reproduced by at
  least one recorded toolchain, and by none.
- `reproductionsByToolchain` — the same split per machine, plus `notObserved`.

`tests/multilang-kernel-provenance.test.ts` holds all of it: observations must name a known
toolchain, an `identical` observation must carry the committed hash and a `differs`
observation must not, the roll-up must agree with the observations underneath it, and every
per-toolchain tally must cover every kernel exactly once.

## What this still does not solve

Byte-identical output across machines. Pinning distributions removes the largest identified
source of drift, but not architecture, not libc, not the host SDK. The only design that
makes bytes machine-independent is a hermetic container build, and adopting it honestly
means rebuilding and re-committing the whole multilang artifact set inside the image —
a deliberate change to published bytes, not a refactor.

Until then the record's job is to make disagreement visible rather than to hide it behind
one machine's verdict.
