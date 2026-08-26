// A timed callable must do the work it claims to time.
//
// simulation.rigid-body-2d.v1's JavaScript callable was
//
//   callables.js = { rigid_engine: () => oracleDigest };
//
// a closure returning a digest computed once at build time, outside the timed
// region. The JavaScript row ran no simulation at all while every Wasm engine
// ran 120 timesteps of 500 bodies, so the published comparison reported
// JavaScript as effectively instantaneous.
//
// A callable body that only returns a captured identifier, or a literal, is
// not measuring anything. This finds that shape.

import { assert } from "./assert.ts";

const RUNNER = await Deno.readTextFile(
  new URL("../public/multilang-runner.js", import.meta.url),
);

/**
 * Every `<kernel>: () => <body>` entry inside a `callables.<engine> = { ... }`
 * object literal.
 *
 * The object is found by scanning braces rather than by matching indentation:
 * both a multi-line object and a one-line `callables.js = { k: () => v };` are
 * real shapes in this file, and the defect this test exists for was written on
 * one line. A body capture that stops at `,` `;` `{` `}` or a newline means a
 * block-bodied arrow (`() => { ... }`) yields no body — those do work by
 * construction. What is left is the single-expression form, which is what has
 * to be judged. `blocks` is reported so the caller can tell "nothing to judge"
 * apart from "the scan found nothing at all".
 */
function timedCallables(): {
  blocks: number;
  entries: Array<{ engine: string; kernel: string; body: string }>;
} {
  const entries: Array<{ engine: string; kernel: string; body: string }> = [];
  let blocks = 0;
  const assignment = /callables(?:\.([a-z]+)|\["([a-z]+)"\])\s*=\s*\{/g;
  for (const m of RUNNER.matchAll(assignment)) {
    blocks++;
    const engine = m[1] ?? m[2];
    // Walk from the opening brace to its match.
    let depth = 0, i = m.index + m[0].length - 1;
    for (; i < RUNNER.length; i++) {
      if (RUNNER[i] === "{") depth++;
      else if (RUNNER[i] === "}" && --depth === 0) break;
    }
    const block = RUNNER.slice(m.index + m[0].length, i);
    const entry = /([A-Za-z_][A-Za-z0-9_]*)\s*:\s*\(\)\s*=>[ \t]*([^\s,;{}\n][^,;{}\n]*)/g;
    for (const e of block.matchAll(entry)) {
      entries.push({ engine, kernel: e[1], body: e[2].trim() });
    }
  }
  return { blocks, entries };
}

Deno.test("no timed callable just returns a precomputed value", () => {
  const { blocks, entries } = timedCallables();
  // Non-vacuity is a property of the scan, not of the findings: today every
  // callable is block-bodied, so `entries` is legitimately empty. If the scan
  // stops finding the assignments themselves, the test is broken, not clean.
  assert(blocks > 20, `only ${blocks} callables assignments found — the scan is broken`);

  // A bare identifier or property read: no call, no operator, no literal work.
  // `polybench: jsPolybench` (a plain function reference, no arrow) is fine and
  // is not captured here — the harness invokes it. `() => oracleDigest` is not.
  const offenders = entries
    .filter(({ body }) => /^[A-Za-z_][A-Za-z0-9_.]*$/.test(body))
    .map(({ engine, kernel, body }) =>
      `callables.${engine}.${kernel} returns ${body} without doing any work`
    );

  assert(
    offenders.length === 0,
    `timed callables that measure nothing: ${offenders.join("; ")}`,
  );
});

Deno.test("the rigid-body JavaScript callable runs the simulation it is timing", () => {
  const at = RUNNER.indexOf('"simulation.rigid-body-2d.v1"');
  assert(at !== -1, "rigid-body adapter not found");
  const block = RUNNER.slice(at, at + 14000);
  const jsAt = block.indexOf("callables.js");
  assert(jsAt !== -1, "rigid-body has no JavaScript callable");
  const body = block.slice(jsAt, jsAt + 700);
  assert(
    body.includes("runRigidBodyJavaScript("),
    "the rigid-body JavaScript callable must run the simulation inside the timed region",
  );
});
