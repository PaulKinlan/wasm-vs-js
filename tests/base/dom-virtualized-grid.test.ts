import Ajv2020Module from "ajv2020";
import { canonicalize, sha256Hex } from "../../lib/canonical.ts";
import { createHandler } from "../../server.ts";
import { assert, assertEquals } from "../assert.ts";
import {
  ACTIONS,
  generateFixture,
  GRID_TRACE_LIFECYCLE,
  instantiateGridWasm,
  normalizeForEquivalence,
  ROWS,
  runJavaScript,
  runWasm,
  validateGridTraceLifecycle,
} from "../../benchmarks/base/dom-virtualized-grid/engine.js";

const Ajv2020 = (Ajv2020Module as unknown as { default?: typeof Ajv2020Module }).default ??
  Ajv2020Module;
const fixtureHash = "07148a1e52a188d7dbaaf17e922075004e54addd01873b936c6207064494d17a";
const wasmHash = "dd7aab37efdf2c85a0df3114838a67f966c615cb94067253d957537c8c80234a";

async function runtime() {
  return await instantiateGridWasm(
    await Deno.readFile("public/artifacts/dom-virtualized-grid-v1/grid.wasm"),
  );
}

Deno.test("frozen v1 catalog remains byte-identical while supplemental grid registration names it", async () => {
  const catalog = await Deno.readFile("catalog/workloads.v1.json");
  const derivative = await Deno.readFile("public/data/workloads.v1.json");
  assertEquals(
    await sha256Hex(catalog),
    "6665664f984683e5b7d3fdc8c1602198124844704c224a526d48be2f02edf9d4",
  );
  assertEquals(await sha256Hex(derivative), await sha256Hex(catalog));
  const frozen = JSON.parse(new TextDecoder().decode(catalog));
  const entry = frozen.entries.find((item: { id: string }) =>
    item.id === "dom.virtualized-grid.v1"
  );
  assert(entry);
  assertEquals(entry.status, "proposed");
  assertEquals(
    entry.fixedWork.description,
    "100k rows, frozen 30 s trace, viewport, DPR and scroll offsets.",
  );
  const contract = JSON.parse(
    await Deno.readTextFile(
      "benchmarks/base/dom-virtualized-grid/implementation-contract.v1.json",
    ),
  );
  assertEquals(contract.catalog.sha256, await sha256Hex(catalog));
  assertEquals(contract.catalog.immutability, "byte-for-byte");
  assertEquals(contract.fixture.rows, 100_000);
  assertEquals(contract.fixture.actions, 300);
  assertEquals(contract.trace.coalescing, "none; exactly one event per 100 ms trace slot");
  assertEquals(
    contract.phases.load,
    "resource fetch through response validation, JSON.parse, and SHA-256 hashing; excludes response body arrayBuffer, Uint8Array construction, and TextDecoder construction/decode",
  );
  assertEquals(
    contract.phases.transfer,
    "response body arrayBuffer, Uint8Array construction, and build-manifest TextDecoder construction/decode",
  );
  assertEquals(contract.trace.lifecycle, {
    slots: 300,
    firstSlotOffsetMs: 0,
    lastSlotOffsetMs: 29_900,
    slotToleranceMs: 20,
    minimumIntervalMs: 80,
    maximumIntervalMs: 120,
    catchUp: "prohibited; fail immediately when the next slot is already more than 20 ms late",
    minimumCompletionAfterFirstSlotMs: 29_900,
    maximumCompletionAfterFirstSlotMs: 30_100,
    completion: "after the final event paint acknowledgment and model finish",
  });
});

Deno.test("fixture freezes 100,000 rows and all five operations over exactly 30 seconds", async () => {
  const fixture = generateFixture();
  assertEquals(fixture.byteLength, 1_604_864);
  assertEquals(await sha256Hex(fixture), fixtureHash);
  assertEquals(
    await sha256Hex(await Deno.readFile("public/artifacts/dom-virtualized-grid-v1/fixture.bin")),
    fixtureHash,
  );
  const view = new DataView(fixture.buffer, fixture.byteOffset, fixture.byteLength);
  assertEquals(view.getUint32(8, true), ROWS);
  assertEquals(view.getUint32(12, true), ACTIONS);
  assertEquals(view.getUint32(16, true), 30_000);
  assertEquals(view.getUint32(20, true), 100);
  assertEquals(view.getUint32(28, true), 480);
  assertEquals(view.getUint32(32, true), 2);
  assertEquals(view.getUint32(36, true), 24);
  const actionOffset = 64 + ROWS * 16;
  const types = new Set<number>();
  for (let index = 0; index < ACTIONS; index += 1) {
    assertEquals(view.getUint32(actionOffset + index * 16, true), index * 100);
    types.add(view.getUint32(actionOffset + index * 16 + 4, true));
  }
  assertEquals([...types].sort(), [0, 1, 2, 3, 4]);
});

Deno.test("trace lifecycle rejects early, late, missed, drifted, and overlong schedules", () => {
  const exact = Array.from(
    { length: GRID_TRACE_LIFECYCLE.slots },
    (_, index) => index * GRID_TRACE_LIFECYCLE.cadenceMs,
  );
  assert(validateGridTraceLifecycle(exact, 29_900));
  const invalid = [
    exact.slice(0, -1),
    exact.map((offset, index) => index === 0 ? -21 : offset),
    exact.map((offset, index) => index === 299 ? offset + 21 : offset),
    exact.map((offset, index) =>
      index === 100 ? offset - 20 : index === 101 ? offset + 20 : offset
    ),
  ];
  for (const offsets of invalid) {
    let denied = false;
    try {
      validateGridTraceLifecycle(offsets, 29_900);
    } catch {
      denied = true;
    }
    assert(denied, "invalid trace lifecycle was accepted");
  }
  for (const completion of [29_899.9, 30_100.1]) {
    let denied = false;
    try {
      validateGridTraceLifecycle(exact, completion);
    } catch {
      denied = true;
    }
    assert(denied, "invalid final-paint completion was accepted");
  }
});

Deno.test("JavaScript and material Wasm emit every identical typed DOM command and checkpoint", async () => {
  const fixture = generateFixture();
  const js = runJavaScript(fixture);
  const wasm = runWasm(await runtime(), fixture);
  assertEquals(js.commandDigest, "83889fa4");
  assertEquals(wasm.commandDigest, js.commandDigest);
  assertEquals(js.commands, wasm.commands);
  assertEquals(canonicalize(js.checkpoints), canonicalize(wasm.checkpoints));
  assertEquals(normalizeForEquivalence(js).counters, normalizeForEquivalence(wasm).counters);
  assertEquals(js.counters, {
    rowsScanned: 700000,
    comparisons: 3279951,
    events: 300,
    commands: 4252,
    physicalCreates: 28,
    physicalReuses: 3764,
    physicalUpdates: 2,
    physicalPlacements: 92,
    physicalHides: 64,
    focusOperations: 2,
    layoutReads: 300,
    allocations: 0,
    boundaryCrossings: 0,
  });
  assertEquals(wasm.counters.boundaryCrossings, 304);
  const operativeExports = ["input_ptr", "prepare", "result_ptr", "run_event", "finish"];
  const adapterSource = await Deno.readTextFile("benchmarks/base/dom-virtualized-grid/engine.js");
  for (const name of operativeExports) {
    assert(adapterSource.includes(`exports.${name}(`), `adapter omitted ${name} crossing`);
  }
  assertEquals(
    canonicalize(js.final),
    canonicalize({
      action: 300,
      start: 60318,
      end: 60346,
      visibleLength: 28,
      focused: 10524,
      selected: 10524,
      filteredLength: 100000,
      commandCount: 4252,
    }),
  );
  const c = await Deno.readTextFile("benchmarks/base/dom-virtualized-grid/grid.c");
  for (
    const symbol of [
      "stable_sort",
      "rebuild_filter",
      "reconcile",
      "compare_rows",
      "save_checkpoint",
    ]
  ) {
    assert(c.includes(symbol), `material Wasm source omitted ${symbol}`);
  }
  const wasmAdapter = adapterSource.slice(adapterSource.indexOf("export function runWasm"));
  assert(
    !wasmAdapter.includes("execute(bytes"),
    "Wasm result was reconstructed by the JavaScript reducer",
  );
});

Deno.test("independent command validator observes bounded physical reuse, order, focus, and selection", () => {
  const result = runJavaScript(generateFixture());
  const slots = Array.from({ length: 28 }, () => ({ row: -1, attached: false, selected: false }));
  const order: number[] = [];
  const counts = { creates: 0, reuses: 0, updates: 0, places: 0, hides: 0, focuses: 0, layouts: 0 };
  let active = -1;
  for (let at = 0; at < result.commands.length; at += 6) {
    const op = result.commands[at];
    const slot = result.commands[at + 1];
    if (op !== 7) assert(slot < 28);
    if (op === 1) {
      assertEquals(slots[slot].row, -1);
      slots[slot] = {
        row: result.commands[at + 2],
        attached: false,
        selected: Boolean(result.commands[at + 5]),
      };
      counts.creates++;
    } else if (op === 2 || op === 3) {
      assert(slots[slot].row >= 0);
      slots[slot].row = result.commands[at + 2];
      slots[slot].selected = Boolean(result.commands[at + 5]);
      if (op === 2) counts.reuses++;
      else counts.updates++;
    } else if (op === 4) {
      const prior = order.indexOf(slot);
      if (prior >= 0) order.splice(prior, 1);
      order.push(slot);
      slots[slot].attached = true;
      counts.places++;
    } else if (op === 5) {
      const prior = order.indexOf(slot);
      assert(prior >= 0);
      order.splice(prior, 1);
      slots[slot].attached = false;
      counts.hides++;
    } else if (op === 6) {
      assert(slots[slot].attached);
      active = slot;
      counts.focuses++;
    } else if (op === 7) counts.layouts++;
    else throw new Error(`unknown opcode ${op}`);
    assert(order.length <= 28);
  }
  assertEquals(counts, {
    creates: result.counters.physicalCreates,
    reuses: result.counters.physicalReuses,
    updates: result.counters.physicalUpdates,
    places: result.counters.physicalPlacements,
    hides: result.counters.physicalHides,
    focuses: result.counters.focusOperations,
    layouts: result.counters.layoutReads,
  });
  assert(active >= 0);
  assertEquals(order.length, 28);
  assert(order.every((slot) => slots[slot].attached));
  assert(slots.filter((slot) => slot.attached && slot.selected).length <= 1);
});

Deno.test("repeat and reordered execution on one Wasm instance is byte-stable", async () => {
  const wasm = await runtime();
  const fixture = generateFixture();
  const first = runWasm(wasm, fixture);
  runJavaScript(fixture);
  const second = runWasm(wasm, fixture);
  assertEquals(second.commands, first.commands);
  assertEquals(second.counters, first.counters);
  assertEquals(second.checkpoints, first.checkpoints);
  assertEquals((wasm.memory as WebAssembly.Memory).buffer.byteLength, 16 * 1024 * 1024);
  let denied = false;
  try {
    (wasm.memory as WebAssembly.Memory).grow(1);
  } catch (error) {
    denied = error instanceof RangeError;
  }
  assert(denied, "Wasm memory unexpectedly grew");
});

Deno.test("mutated lengths, identities, cadence and actions fail closed in both targets", async () => {
  const mutations: Array<
    (
      bytes: Uint8Array<ArrayBuffer>,
    ) => Uint8Array<ArrayBuffer>
  > = [
    (bytes) => bytes.slice(0, bytes.length - 1),
    (bytes) => {
      bytes[0] ^= 1;
      return bytes;
    },
    (bytes) => {
      new DataView(bytes.buffer).setUint32(64 + ROWS * 16, 1, true);
      return bytes;
    },
    (bytes) => {
      new DataView(bytes.buffer).setUint32(64 + ROWS * 16 + 4, 99, true);
      return bytes;
    },
  ];
  for (const mutate of mutations) {
    const mutated = mutate(generateFixture());
    let jsDenied = false;
    try {
      runJavaScript(mutated);
    } catch {
      jsDenied = true;
    }
    assert(jsDenied);
    let wasmDenied = false;
    try {
      runWasm(await runtime(), mutated);
    } catch {
      wasmDenied = true;
    }
    assert(wasmDenied);
  }
});

Deno.test("candidate record is closed-schema, raw-hash anchored, and honestly browser-pending", async () => {
  const schema = JSON.parse(
    await Deno.readTextFile("schemas/base-implementation-candidate.schema.json"),
  );
  const record = JSON.parse(
    await Deno.readTextFile("public/evidence/base/dom-virtualized-grid-v1/candidate.json"),
  );
  const validate = new (Ajv2020 as unknown as new (options: Record<string, unknown>) => {
    compile: (schema: unknown) => ((value: unknown) => boolean) & { errors?: unknown };
  })({ allErrors: true, strict: false }).compile(schema);
  assert(validate(record), JSON.stringify(validate.errors));
  assertEquals(record.status, "implementation-candidate");
  assertEquals(record.browserEvidence.status, "pending-parent-collection");
  assertEquals(record.performanceClaims, []);
  assertEquals(record.lifecycle, {
    slots: 300,
    cadenceMs: 100,
    firstSlotOffsetMs: 0,
    lastSlotOffsetMs: 29_900,
    slotToleranceMs: 20,
    minimumIntervalMs: 80,
    maximumIntervalMs: 120,
    catchUp: false,
    minimumCompletionAfterFirstSlotMs: 29_900,
    maximumCompletionAfterFirstSlotMs: 30_100,
    phaseSpanPolicy: "labelled-non-overlapping-exclusive-spans-plus-e2e-residual",
    manifestDecodePhase: "transfer",
  });
  for (
    const [field, value] of [
      ["slotToleranceMs", 21],
      ["minimumIntervalMs", 79],
      ["maximumIntervalMs", 121],
      ["catchUp", true],
      ["maximumCompletionAfterFirstSlotMs", 30_101],
      ["phaseSpanPolicy", "overlapping"],
      ["manifestDecodePhase", "load"],
    ] as const
  ) {
    const mutation = structuredClone(record);
    mutation.lifecycle[field] = value;
    assert(!validate(mutation), `candidate schema accepted lifecycle mutation ${field}`);
  }
  for (
    const reference of Object.values(record.artifacts) as Array<{ path: string; sha256: string }>
  ) {
    assertEquals(await sha256Hex(await Deno.readFile(reference.path)), reference.sha256);
  }
  assertEquals(await sha256Hex(await Deno.readFile(record.artifacts.wasm.path)), wasmHash);
});

Deno.test("public route exposes only fixed demo assets and exact artifacts", async () => {
  const handler = createHandler(null, "public");
  for (
    const path of [
      "/benchmarks/dom-virtualized-grid-v1/",
      "/benchmarks/dom-virtualized-grid-v1/grid.css",
      "/benchmarks/dom-virtualized-grid-v1/grid-runner.js",
      "/benchmarks/dom-virtualized-grid-v1/grid-worker.js",
      "/benchmarks/base/dom-virtualized-grid/engine.js",
      "/artifacts/dom-virtualized-grid-v1/grid.wasm",
      "/artifacts/dom-virtualized-grid-v1/fixture.bin",
      "/artifacts/dom-virtualized-grid-v1/build-manifest.json",
      "/evidence/base/dom-virtualized-grid-v1/candidate.json",
      "/data/base-implementation-candidates.v1.json",
    ]
  ) {
    const response = await handler(new Request(`http://127.0.0.1${path}`));
    assertEquals(response.status, 200);
  }
  for (
    const path of [
      "/artifacts/dom-virtualized-grid-v1/unknown.json",
      "/benchmarks/dom-virtualized-grid-v1/private.js",
    ]
  ) {
    assertEquals((await handler(new Request(`http://127.0.0.1${path}`))).status, 404);
  }
});

Deno.test("builder reproduces the complete fixture, Wasm, manifests, and hashes", async () => {
  const paths = [
    "public/artifacts/dom-virtualized-grid-v1/grid.wasm",
    "public/artifacts/dom-virtualized-grid-v1/fixture.bin",
    "public/artifacts/dom-virtualized-grid-v1/implementation-contract.v1.json",
    "public/artifacts/dom-virtualized-grid-v1/fixture-manifest.json",
    "public/artifacts/dom-virtualized-grid-v1/output-manifest.json",
    "public/artifacts/dom-virtualized-grid-v1/build-manifest.json",
  ];
  const before = await Promise.all(paths.map((path) => Deno.readFile(path)));
  const result = await new Deno.Command(Deno.execPath(), {
    args: [
      "run",
      "--allow-read=.",
      "--allow-write=public/artifacts/dom-virtualized-grid-v1",
      "--allow-run=clang,wasm-ld",
      "scripts/build-dom-virtualized-grid.ts",
    ],
    stdout: "piped",
    stderr: "piped",
  }).output();
  if (!result.success) throw new Error(new TextDecoder().decode(result.stderr));
  for (let index = 0; index < paths.length; index += 1) {
    assertEquals(await Deno.readFile(paths[index]), before[index]);
  }
});

Deno.test("runner uses a fresh worker, typed-only host commands, timeout, stale tokens, and pagehide cleanup", async () => {
  const html = await Deno.readTextFile("public/benchmarks/dom-virtualized-grid-v1/index.html");
  const runner = await Deno.readTextFile(
    "public/benchmarks/dom-virtualized-grid-v1/grid-runner.js",
  );
  const worker = await Deno.readTextFile(
    "public/benchmarks/dom-virtualized-grid-v1/grid-worker.js",
  );
  const collector = await Deno.readTextFile(
    "scripts/validate-dom-virtualized-grid-browser.ts",
  );
  const outputManifest = JSON.parse(
    await Deno.readTextFile("public/artifacts/dom-virtualized-grid-v1/output-manifest.json"),
  );
  assert(html.includes('aria-rowcount="100000"'));
  assert(html.includes("No performance claim."));
  assert(runner.includes("new Worker("));
  assert(runner.includes("runToken !== token"));
  assert(runner.includes("pagehide"));
  assert(runner.includes("injectWrongToken"));
  assert(runner.includes("60_000"));
  assert(runner.includes("getBoundingClientRect"));
  assert(!runner.includes("localStorage"));
  assert(!runner.includes("sessionStorage"));
  assert(!runner.includes("fetch("));
  assert(worker.includes("createJavaScriptGridExecution"));
  assert(worker.includes("createWasmGridExecution"));
  assert(worker.includes("() => execution.next()"));
  assert(worker.includes("scheduledOffsetMs = actionIndex * GRID_TRACE_LIFECYCLE.cadenceMs"));
  assert(worker.includes("await acknowledged"));
  assert(runner.includes('CustomEvent("gridtraceevent"'));
  assert(runner.includes("await afterPaint()"));
  assert(!runner.includes("dataset.focusedRow"));
  assert(!runner.includes("dataset.selectedRow"));
  assert(worker.includes("commands: batch.buffer"));
  assert(worker.includes("Fixture raw-byte hash mismatch"));
  assert(worker.includes("Wasm raw-byte hash mismatch"));
  assert(worker.includes('phases.transfer.spans,\n    "build-manifest:decode"'));
  assert(worker.includes("JSON.parse(manifestText)"));
  assert(!worker.includes("JSON.parse(new TextDecoder().decode"));
  assertEquals(outputManifest.browserDom.state.rows.length, 28);
  assertEquals(outputManifest.trace.scheduledOffsetsMs.length, 300);
  assertEquals(outputManifest.trace.scrollOffsetsCssPx.length, 300);
  assertEquals(outputManifest.phaseTopology.manifestDecodePhase, "transfer");
  assertEquals(
    outputManifest.phaseTopology.javascript.transferLabels,
    [
      "/artifacts/dom-virtualized-grid-v1/build-manifest.json:body",
      "build-manifest:decode",
      "/artifacts/dom-virtualized-grid-v1/fixture.bin:body",
    ],
  );
  assertEquals(
    canonicalize(outputManifest.trace.lifecycle),
    canonicalize(GRID_TRACE_LIFECYCLE),
  );
  assert(collector.includes('client.send("Emulation.setDeviceMetricsOverride"'));
  assert(collector.includes('client.send("Accessibility.getFullAXTree"'));
  assert(collector.includes("canonicalize(parsed.browserDom)"));
  assert(collector.includes("layout.clientWidth !== 960"));
  assert(collector.includes("layout.clientHeight !== 480"));
  assert(collector.includes('"build-manifest:decode"'));
  assert(collector.includes("validatePhaseEvidence(parsed.phases"));
  assert(collector.includes("endingWorktreeStatus"));
  assert(collector.includes("unexpectedEndingChanges"));
  assert(collector.includes('"--porcelain=v1"'));
});
