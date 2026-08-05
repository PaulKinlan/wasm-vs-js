// Cold-start phase breakdown: pure helpers from hosted-runner-core.
// Asserts the breakdown shape, typed-unavailable handling (never zero), and the
// Resource-Timing network-phase derivation that feeds the report renderers and
// the results explorer.
import { assert, assertEquals } from "./assert.ts";
import { coldStartBreakdown, networkPhaseFromEntry } from "../public/hosted-runner-core.js";

Deno.test("networkPhaseFromEntry derives fetchStart -> responseEnd as the network phase", () => {
  const phase = networkPhaseFromEntry({
    fetchStart: 100,
    responseStart: 150,
    responseEnd: 212.5,
  });
  assertEquals(phase.status, "supported-value");
  assertEquals(phase.ms, 112.5);
  assertEquals(phase.scope, "same-origin-resource-timing");
});

Deno.test("networkPhaseFromEntry types missing entries unavailable, never zero", () => {
  const missing = networkPhaseFromEntry(null);
  assertEquals(missing.status, "unavailable");
  assert((missing.reason ?? "").length > 0, "unavailable carries a reason");

  const missingFields = networkPhaseFromEntry({ fetchStart: 1 });
  assertEquals(missingFields.status, "unavailable");
  assertEquals(missingFields.ms, undefined);
});

Deno.test("networkPhaseFromEntry rejects non-finite or negative durations as unavailable", () => {
  assertEquals(networkPhaseFromEntry({ fetchStart: NaN, responseEnd: 10 }).status, "unavailable");
  assertEquals(
    networkPhaseFromEntry({ fetchStart: 50, responseEnd: 20 }).status,
    "unavailable",
  );
});

Deno.test("coldStartBreakdown carries every phase with typed availability", () => {
  const breakdown = coldStartBreakdown({
    manifestTransferMs: 12.4,
    manifestNetwork: { status: "supported-value", ms: 8.1 },
    jsTransferMs: 30.2,
    jsNetwork: { status: "unavailable", reason: "no entry" },
    wasmTransferMs: 45.9,
    wasmNetwork: { status: "supported-value", ms: 22.7 },
    wasmCompileMs: 18.4,
    wasmInstantiateMs: 1.2,
    jsFirstExecuteMs: 3.1,
    wasmFirstExecuteMs: 0.9,
  });

  assertEquals(breakdown.manifest.transferMs, 12.4);
  assertEquals(breakdown.manifest.network.status, "supported-value");
  assertEquals(breakdown.javascript.network.status, "unavailable");
  assertEquals(breakdown.wasm.compileMs, 18.4);
  assertEquals(breakdown.wasm.instantiateMs, 1.2);
  assertEquals(breakdown.firstExecuteMs.javascript, 3.1);
  assertEquals(breakdown.firstExecuteMs.wasm, 0.9);
});

Deno.test("coldStartBreakdown defaults absent phases to null (renderer marks not collected)", () => {
  const breakdown = coldStartBreakdown();
  assertEquals(breakdown.manifest.transferMs, null);
  assertEquals(breakdown.wasm.network, null);
  assertEquals(breakdown.firstExecuteMs.javascript, null);
});
