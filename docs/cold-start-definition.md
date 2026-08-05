# Cold start: what the number includes

"Cold" appears in three places on this site: the playground readout, the workload matrix
("First scored median" under the Cold cache filter), and the results explorer's cache-state
filter. They share one definition, set by the collector, not by prose. This page states it.

## The short answer

A cold measurement starts before any benchmark code exists in the engine and ends after the
first scored iteration. It includes every phase needed to get there:

1. **Manifest transfer and parse** — fetching the workload manifest and decoding it
   (`manifestTransferMs`, `manifestBytes`, `manifestDecodeParseMs`).
2. **JavaScript transfer, hash verification, and module import** (`jsTransferMs`, `jsBytes`,
   `jsHashVerifyMs`, `jsVerifiedModuleImportMs`).
3. **Wasm transfer, hash verification, compile, and instantiate** (`wasmTransferMs`,
   `wasmBytes`, `wasmHashVerifyMs`, `wasmCompileMs`, `wasmInstantiateMs`).
4. **Input generation and the copy into linear memory** (`inputGenerateMs`, `inputCopyMs`).
5. **The first scored execution of each variant** (`jsFirstExecuteMs`,
   `wasmFirstExecuteMs`).

Two phases are recorded as **unavailable, not zero**: `jsModuleParseMs` and
`jsModuleEvaluationMs`. Standard browser APIs cannot isolate parse or evaluation duration
from module import, so the collector says so. An unavailable phase is never folded into a
number and never reported as 0 ms.

Every phase above is a named field in the `lifecycle` block of each retained run record;
the collector source is `public/hosted-runner-worker.js`.

## What "warm" means by contrast

Warm is not "fast" and not "cached by luck." It is a separate protocol state. In the frozen
M1 Chrome experiment (`experiments/m1-chrome-sum-u32-v1/preregistration.json`):

- A **cold** launch uses a fresh owned browser process with a unique empty profile, no
  Service Worker, no pre-existing origin storage, no benchmark asset priming, and the
  ordinary HTTP cache enabled. Transfer, compile, and instantiate happen inside the measured
  run, and CDP network evidence plus exact response hashes prove they did.
- A **warm** launch uses the same fresh process and profile, but the exact manifest,
  JavaScript, and Wasm assets are primed once before measurement, with primed hashes and
  cache-reuse evidence verified. Transfer and compile cost the run nothing; the first scored
  iteration is still measured and retained separately.

If any cold requirement is contradicted — for example a response arrives from the disk
cache — the launch is blocked and no timing is recorded (`contradictionPolicy:
block-launch-no-timing`). Cold and warm are never averaged into each other.

## Where each surface gets its number

- **Playground "Cold Start" readout** (`/`, runner section): the duration of the first
  iteration of the run you just triggered (`durations[0]`). Selecting "1 iteration (Cold
  start only)" restricts the run to that single first iteration. This happens in your
  current browser with whatever cache state it already has, so it shows first-iteration cost
  — worker setup, compile, and instantiate included — without the fresh-profile guarantee of
  the experiment strata. It is a demonstration of the lifecycle, not experiment evidence.
- **Workload matrix, "First scored median"** (`/`): the median of iteration-0 durations
  across the retained runs of that cell, filtered to the cache state you select
  (`lib/summary.ts`: `firstIterationMedianMs`). The "All-sample median" column beside it
  spans every scored iteration, so the two columns show cold versus steady-state within one
  cell.
- **Results explorer cache filter** (`/results/`): filters run records by the protocol
  state they were collected under — validation, cold, or warm — as recorded in each record's
  `cacheState`.
- **Full run records**: each record carries the complete `lifecycle` block, the resource
  timing evidence, and the cache disclosure, so any summary number can be traced back to the
  phases that produced it.

## What cold start does not include

- Repeat executions. Iterations after the first are warm by definition and reported
  separately.
- Server-side build time. Reproducible builds happen before collection and are pinned by
  hash, not timed as part of a run.
- Anything the browser will not isolate. Where an API cannot separate a phase, the record
  marks that phase unavailable with the reason, instead of estimating it.

## Why the definition is this strict

The first-use cost of Wasm — transfer, compile, instantiate — is the cost most claims about
"Wasm startup" gesture at without measuring. Splitting it into named phases, and refusing to
record a cold number when the cache state is contradicted, keeps the cold/warm comparison
about the engine and the bytes rather than about whatever happened to be warm already.
