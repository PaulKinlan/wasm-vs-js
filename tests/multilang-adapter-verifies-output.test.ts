// No adapter may time an engine without checking what it computed.
//
// Seventeen of the forty-one multi-language adapters ran every engine and
// verified nothing about the result. That concealed engines computing a
// different function (the FFT and STFT twiddle factors), engines doing half or
// double the work of the ones they were compared against (numeric-kernels,
// the AEAD stream), engines that could not run at all (the Rust diff), engines
// parsing a destroyed lookup table and returning nothing (the C and C++ log
// scanners), and a JavaScript callable that returned a precomputed constant
// (the rigid-body simulation).
//
// The browser verifier proves the engines actually agree, but it needs Chrome
// and takes minutes. This is the cheap standing guard: every adapter must
// either call requireEngineAgreement or compare its outputs inline. It cannot
// tell whether a comparison is correct — only that one exists, which is the
// property that was missing.

import { assert } from "./assert.ts";

const RUNNER = await Deno.readTextFile(
  new URL("../public/multilang-runner.js", import.meta.url),
);

/** Each adapter's source, keyed by the workload id it is registered under. */
function adapterBlocks(): Map<string, string> {
  const marks: Array<[number, string]> = [];
  const pattern = /"([a-z0-9.\-]+(?:\.v\d+)?)":\s*\{\s*\n\s*kernels:/g;
  let match: RegExpExecArray | null;
  while ((match = pattern.exec(RUNNER)) !== null) marks.push([match.index, match[1]]);
  const blocks = new Map<string, string>();
  for (let i = 0; i < marks.length; i++) {
    const end = i + 1 < marks.length ? marks[i + 1][0] : RUNNER.length;
    blocks.set(marks[i][1], RUNNER.slice(marks[i][0], end));
  }
  return blocks;
}

/** A comparison that fails loudly: the guard, or a throw on a mismatch. */
function verifiesOutput(block: string): boolean {
  if (block.includes("requireEngineAgreement(")) return true;
  return /throw new Error\([^;]{0,200}(drift|mismatch|disagree|different|oracle)/is.test(block);
}

Deno.test("every multi-language adapter checks what its engines computed", () => {
  const blocks = adapterBlocks();
  assert(blocks.size >= 40, `only ${blocks.size} adapters found — the scan is broken`);

  const offenders = [...blocks]
    .filter(([, block]) => !verifiesOutput(block))
    .map(([id]) => id);

  assert(
    offenders.length === 0,
    `adapters that time engines without checking their output: ${offenders.join(", ")}`,
  );
});

Deno.test("the agreement guard refuses a disagreement rather than reporting one", () => {
  const at = RUNNER.indexOf("export function requireEngineAgreement");
  assert(at !== -1, "requireEngineAgreement not found");
  const body = RUNNER.slice(at, at + 2600);
  assert(
    /distinct\.size > 1/.test(body) && /throw new Error/.test(body),
    "engines that disagree must be refused, not reported with a warning",
  );
  // A probe returning undefined would otherwise collapse to a single "value"
  // and pass, which is the failure mode a digest check is meant to catch.
  assert(
    /Number\.isFinite\(digest\)/.test(body),
    "a probe that produces no digest must fail rather than count as agreement",
  );
});
