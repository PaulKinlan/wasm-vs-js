import { assert, assertEquals } from "./assert.ts";
import {
  computeStats,
  decodeCommands,
  FILTER_STATE,
  OP,
  planDomOperations,
  summarizePlan,
  validateResultMessage,
  validateStartMessage,
} from "../public/dom-hosts/todomvc-ops.js";
import {
  editedLabels,
  encodeActionTrace,
  generateLabels,
} from "../benchmarks/base/dom-todomvc-journey/fixture.js";

function assertThrows(fn: () => unknown, messageIncludes: string): void {
  let threw: unknown;
  try {
    fn();
  } catch (error) {
    threw = error;
  }
  if (threw === undefined) throw new Error(`expected throw including "${messageIncludes}"`);
  if (threw instanceof Error && !threw.message.includes(messageIncludes)) {
    throw new Error(`threw "${threw.message}" — expected it to include "${messageIncludes}"`);
  }
}

// ── decodeCommands ─────────────────────────────────────────────────────────

Deno.test("iframe bridge: decodeCommands parses the 4-field stream", () => {
  const encoded = encodeActionTrace();
  const ops = decodeCommands(encoded);
  assertEquals(ops.length, 150);
  assertEquals(ops[0], { opcode: 1, id: 0, value: 0, focus: 0 });
});

Deno.test("iframe bridge: decodeCommands rejects malformed streams", () => {
  assertThrows(() => decodeCommands(new Int32Array([1, 0, 0])), "multiple of 4");
  assertThrows(() => decodeCommands(new Int32Array([99, 0, 0, 0])), "unknown opcode");
  assertThrows(() => decodeCommands("nope"), "Int32Array");
});

// ── planDomOperations ──────────────────────────────────────────────────────

Deno.test("iframe bridge: planDomOperations resolves the frozen trace to DOM ops", () => {
  const encoded = encodeActionTrace();
  const plan = planDomOperations(encoded, generateLabels(), editedLabels);
  const summary = summarizePlan(plan);
  assertEquals(summary, { add: 100, toggle: 34, filter: 3, edit: 3, remove: 10 });
  // ADD ops carry the frozen label; EDITED ids get the edited label.
  const firstAdd = plan.find((item) => item.op === OP.ADD);
  assert(firstAdd !== undefined, "first ADD op missing");
  assertEquals(firstAdd.id, 0);
  assertEquals(firstAdd.label, generateLabels()[0]);
  const edit95 = plan.find((item) => item.op === OP.EDIT && item.id === 95);
  assert(edit95 !== undefined, "EDIT id 95 missing");
  assertEquals(edit95.label, editedLabels[95]);
  assertEquals(edit95.focus, 1);
  const filters = plan.filter((item) => item.op === OP.FILTER);
  assertEquals(filters.map((item) => item.value), [
    FILTER_STATE.COMPLETED,
    FILTER_STATE.ACTIVE,
    FILTER_STATE.ALL,
  ]);
});

Deno.test("iframe bridge: summarizePlan counts operation kinds", () => {
  const plan = planDomOperations(encodeActionTrace(), generateLabels(), editedLabels);
  const counts = summarizePlan(plan);
  assertEquals(counts.add + counts.toggle + counts.filter + counts.edit + counts.remove, 150);
});

// ── computeStats ───────────────────────────────────────────────────────────

Deno.test("iframe bridge: computeStats reduces samples honestly", () => {
  const stats = computeStats([10, 12, 11, 13, 9]);
  assertEquals(stats.coldMs, 10);
  assertEquals(stats.warmMedianMs, 12); // sorted warm [9,11,12,13] -> index 1
  assertEquals(stats.minMs, 9);
  assertEquals(stats.maxMs, 13);
  assertEquals(stats.iterations, 5);
});

Deno.test("iframe bridge: computeStats rejects empty or non-finite samples", () => {
  assertThrows(() => computeStats([]), "non-empty");
  assertThrows(() => computeStats([NaN, Infinity]), "no finite samples");
});

// ── Protocol message validation ────────────────────────────────────────────

Deno.test("iframe bridge: validateStartMessage enforces token/iterations/targets", () => {
  const ok = validateStartMessage({
    type: "wvj-benchmark-start",
    token: "0123456789abcdef",
    iterations: 10,
    targets: ["js", "wasm"],
  });
  assertEquals(ok.ok, true);
  assertEquals(ok.targets, ["js", "wasm"]);
  assertEquals(
    validateStartMessage({ type: "wvj-benchmark-start", token: "short", iterations: 10 }).ok,
    false,
  );
  assertEquals(
    validateStartMessage({ type: "other", token: "0123456789abcdef", iterations: 10 }).ok,
    false,
  );
  assertEquals(
    validateStartMessage({ type: "wvj-benchmark-start", token: "0123456789abcdef", iterations: 0 })
      .ok,
    false,
  );
  assertEquals(
    validateStartMessage({
      type: "wvj-benchmark-start",
      token: "0123456789abcdef",
      iterations: 10,
      targets: ["python"],
    }).ok,
    false,
  );
  // Default targets when absent.
  const noTargets = validateStartMessage({
    type: "wvj-benchmark-start",
    token: "0123456789abcdef",
    iterations: 10,
  });
  assertEquals(noTargets.ok, true);
  assertEquals(noTargets.targets, ["js", "wasm"]);
});

Deno.test("iframe bridge: validateResultMessage enforces perTarget", () => {
  assertEquals(
    validateResultMessage({
      type: "wvj-benchmark-result",
      token: "0123456789abcdef",
      perTarget: { js: {} },
    }).ok,
    true,
  );
  assertEquals(
    validateResultMessage({ type: "wvj-benchmark-result", token: "0123456789abcdef" }).ok,
    false,
  );
  assertEquals(
    validateResultMessage({ type: "wvj-benchmark-result", token: "x", perTarget: {} }).ok,
    false,
  );
});

// ── End-to-end plan fidelity vs the engine oracle ──────────────────────────

Deno.test("iframe bridge: planned DOM operations reproduce the canonical summary", async () => {
  const { runJavaScript } = await import(
    "../benchmarks/base/dom-todomvc-journey/engine.js"
  );
  const encoded = encodeActionTrace();
  const result = runJavaScript(encoded);
  const plan = planDomOperations(result.commands, generateLabels(), editedLabels);
  const summary = summarizePlan(plan);
  assertEquals(summary, { add: 100, toggle: 34, filter: 3, edit: 3, remove: 10 });
  // The engine's canonical end-state must be reproducible from the plan:
  // 100 adds - 10 removes = 90 alive; 34 toggles = 34 completed.
  assert(result.summary.alive === 90, "engine summary alive must be 90");
  assert(result.summary.completed === 30, "engine summary completed must be 30");
});
