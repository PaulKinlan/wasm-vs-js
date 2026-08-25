import { assert, assertEquals } from "./assert.ts";
import {
  amortizedTotalMs,
  breakEven,
  classifyDelivery,
  contamination,
  fmtBytes,
  fmtMs,
  fmtRatio,
  medianCi95,
  networkCost,
  percentile,
  ratio,
  resourcesInWindow,
  SCOPE_ORDER,
  SCOPES,
  summarize,
} from "../public/measurement-model.js";

Deno.test("every scope in SCOPE_ORDER is defined and self-describing", () => {
  assertEquals(SCOPE_ORDER.length, 4);
  for (const id of SCOPE_ORDER) {
    const scope = (SCOPES as Record<
      string,
      { id: string; question: string; includes: string; excludes: string }
    >)[id];
    assert(scope, `${id} missing from SCOPES`);
    assertEquals(scope.id, id);
    assert(scope.question.length > 0);
    assert(scope.includes.length > 0);
    assert(scope.excludes.length > 0);
  }
});

Deno.test("summarize returns null for an empty sample rather than zero", () => {
  assertEquals(summarize([], { scope: "kernel" }), null);
  assertEquals(summarize(undefined, { scope: "kernel" }), null);
  assertEquals(summarize([NaN, Infinity], { scope: "kernel" }), null);
});

Deno.test("summarize reports order statistics and robust spread", () => {
  const s = summarize([5, 1, 3, 2, 4], { scope: "kernel", label: "js" })!;
  assertEquals(s.n, 5);
  assertEquals(s.minMs, 1);
  assertEquals(s.maxMs, 5);
  assertEquals(s.p50Ms, 3);
  assertEquals(s.meanMs, 3);
  assertEquals(s.madMs, 1);
  assertEquals(s.scope, "kernel");
  assertEquals(s.label, "js");
});

Deno.test("summarize keeps min and max distinct from the median", () => {
  // The defect this guards: a table that printed the median in the Min column.
  const s = summarize([10, 20, 30, 40, 100], { scope: "pipeline" })!;
  assert(s.minMs < s.p50Ms, "min must be below the median");
  assert(s.maxMs > s.p50Ms, "max must be above the median");
  assertEquals(s.minMs, 10);
  assertEquals(s.maxMs, 100);
});

Deno.test("percentile interpolates between ranks", () => {
  assertEquals(percentile([0, 10], 0.5), 5);
  assertEquals(percentile([0, 10, 20], 0.5), 10);
  assertEquals(percentile([], 0.5), null);
});

Deno.test("medianCi95 withholds an interval below n=6", () => {
  assertEquals(medianCi95([1, 2, 3, 4, 5]), null);
  const ci = medianCi95([1, 2, 3, 4, 5, 6, 7, 8, 9, 10])!;
  assert(ci.lowMs <= ci.highMs);
});

Deno.test("ratio refuses to compare across scopes", () => {
  const kernel = summarize([1, 2, 3], { scope: "kernel" })!;
  const pipeline = summarize([10, 20, 30], { scope: "pipeline" })!;
  const r = ratio(pipeline, kernel);
  assertEquals(r.status, "cross-scope");
  assertEquals(r.baselineScope, "pipeline");
  assertEquals(r.candidateScope, "kernel");
});

Deno.test("ratio divides baseline by candidate within one scope", () => {
  const js = summarize([100, 100, 100], { scope: "kernel" })!;
  const wasm = summarize([50, 50, 50], { scope: "kernel" })!;
  const r = ratio(js, wasm);
  assertEquals(r.status, "ok");
  assertEquals(r.value, 2);
});

Deno.test("ratio marks an overlapping interval as not separated", () => {
  const a = summarize([9, 10, 10, 10, 11, 12, 8, 10], { scope: "kernel" })!;
  const b = summarize([10, 9, 11, 10, 10, 12, 8, 10], { scope: "kernel" })!;
  const r = ratio(a, b);
  assertEquals(r.status, "ok");
  assertEquals(r.separated, false);
  assertEquals(fmtRatio(r), `${r.value!.toFixed(2)}× (not separated)`);
});

Deno.test("ratio reports unavailable rather than dividing by zero", () => {
  const zero = summarize([0, 0, 0], { scope: "kernel" })!;
  const some = summarize([1, 2, 3], { scope: "kernel" })!;
  assertEquals(ratio(some, zero).status, "unavailable");
  assertEquals(ratio(null, some).status, "unavailable");
});

Deno.test("amortizedTotalMs pays delivery once", () => {
  assertEquals(amortizedTotalMs(100, 10, 1), 110);
  assertEquals(amortizedTotalMs(100, 10, 10), 200);
  assertEquals(amortizedTotalMs(undefined, 10, 5), 50);
  assertEquals(amortizedTotalMs(100, null, 5), null);
});

Deno.test("breakEven finds the crossing invocation count", () => {
  // JS: no extra delivery, 10 ms per call. Wasm: +300 ms delivery, 4 ms per call.
  const r = breakEven({
    baselineDeliveryMs: 0,
    baselinePerMs: 10,
    candidateDeliveryMs: 300,
    candidatePerMs: 4,
  });
  assertEquals(r.status, "ok");
  assertEquals(r.invocations, 50);
  assert(
    amortizedTotalMs(300, 4, 50)! <= amortizedTotalMs(0, 10, 50)!,
    "candidate must be ahead at the reported crossing",
  );
});

Deno.test("breakEven says never when the candidate is not faster per call", () => {
  const r = breakEven({
    baselineDeliveryMs: 0,
    baselinePerMs: 4,
    candidateDeliveryMs: 300,
    candidatePerMs: 10,
  });
  assertEquals(r.status, "never");
});

Deno.test("breakEven says immediate when the candidate costs no more to deliver", () => {
  const r = breakEven({
    baselineDeliveryMs: 300,
    baselinePerMs: 10,
    candidateDeliveryMs: 100,
    candidatePerMs: 4,
  });
  assertEquals(r.status, "immediate");
  assertEquals(r.invocations, 1);
});

Deno.test("breakEven is unavailable when a measurement is missing", () => {
  assertEquals(breakEven({ baselinePerMs: 10, candidatePerMs: null }).status, "unavailable");
});

Deno.test("classifyDelivery never calls a fast request a cache hit", () => {
  // The removed heuristic was `duration < 2 => cached`.
  const fastNetwork = { transferSize: 4096, decodedBodySize: 4096, duration: 0.4 };
  assertEquals(classifyDelivery(fastNetwork).kind, "network");
});

Deno.test("classifyDelivery uses deliveryType and size signals", () => {
  assertEquals(classifyDelivery({ deliveryType: "cache" }).kind, "cache");
  assertEquals(classifyDelivery({ transferSize: 0, decodedBodySize: 900 }).kind, "cache");
  assertEquals(classifyDelivery({ transferSize: 0, decodedBodySize: 0 }).kind, "opaque");
  assertEquals(classifyDelivery({ transferSize: 200, decodedBodySize: 90000 }).kind, "revalidated");
  assertEquals(classifyDelivery(null).kind, "unknown");
  assertEquals(classifyDelivery({}).kind, "unknown");
});

Deno.test("resourcesInWindow attributes by time, not by URL substring", () => {
  const entries = [
    { name: "https://x/a.wasm", startTime: 5 },
    { name: "https://x/b.js", startTime: 50 },
    { name: "https://x/c.json", startTime: 500 },
  ];
  const got = resourcesInWindow(entries, 10, 100).map((e) => e.name);
  assertEquals(got, ["https://x/b.js"]);
});

Deno.test("networkCost unions overlapping fetches instead of summing them", () => {
  const entries = [
    { startTime: 0, duration: 100, transferSize: 1000, decodedBodySize: 4000 },
    { startTime: 50, duration: 100, transferSize: 2000, decodedBodySize: 8000 },
  ];
  const cost = networkCost(entries);
  // Sum would be 200 ms; the union is 0..150.
  assertEquals(cost.wallMs, 150);
  assertEquals(cost.transferBytes, 3000);
  assertEquals(cost.decodedBytes, 12000);
  assertEquals(cost.networkFetches, 2);
});

Deno.test("networkCost adds disjoint fetches", () => {
  const cost = networkCost([
    { startTime: 0, duration: 10, transferSize: 1, decodedBodySize: 1 },
    { startTime: 100, duration: 10, transferSize: 1, decodedBodySize: 1 },
  ]);
  assertEquals(cost.wallMs, 20);
});

Deno.test("networkCost counts cache hits separately from network fetches", () => {
  const cost = networkCost([
    { startTime: 0, duration: 1, transferSize: 0, decodedBodySize: 500 },
    { startTime: 2, duration: 1, transferSize: 500, decodedBodySize: 500 },
  ]);
  assertEquals(cost.cacheHits, 1);
  assertEquals(cost.networkFetches, 1);
});

Deno.test("contamination grades how much of a timed region was network", () => {
  assertEquals(contamination(100, 90).severity, "dominated");
  assertEquals(contamination(100, 20).severity, "material");
  assertEquals(contamination(100, 5).severity, "minor");
  assertEquals(contamination(100, 0).severity, "clean");
  assertEquals(contamination(0, 10).status, "unavailable");
});

Deno.test("contamination caps the fraction at 1", () => {
  const c = contamination(10, 500);
  assertEquals(c.status, "ok");
  assertEquals(c.fraction, 1);
});

Deno.test("formatters render an absent value as an em dash, never as zero", () => {
  assertEquals(fmtMs(null), "—");
  assertEquals(fmtMs(undefined), "—");
  assertEquals(fmtBytes(null), "—");
  assertEquals(fmtRatio(null), "—");
  assertEquals(fmtRatio({ status: "cross-scope" }), "—");
  assertEquals(fmtMs(0), "0.00 ms");
  assertEquals(fmtBytes(0), "0 B");
});

Deno.test("formatters scale units", () => {
  assertEquals(fmtMs(1500), "1.50 s");
  assertEquals(fmtMs(0.002), "2.0 µs");
  assertEquals(fmtBytes(2048), "2.0 KB");
  assertEquals(fmtBytes(2 * 1024 * 1024), "2.00 MB");
});
