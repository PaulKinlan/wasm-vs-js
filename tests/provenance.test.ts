import { assert, assertEquals } from "./assert.ts";
import {
  captureLegacyChromiumHeap,
  captureUaClientHints,
  captureUaSpecificMemory,
  measureRefreshEstimate,
  positiveNumberHint,
  startResponsivenessObservation,
} from "../public/provenance-probes.js";

Deno.test("portable provenance keeps absent machine and memory APIs typed instead of zero", async () => {
  const concurrency = positiveNumberHint({}, "hardwareConcurrency", "not exposed");
  const memoryHint = positiveNumberHint({}, "deviceMemory", "not exposed");
  assertEquals(concurrency.status, "unsupported");
  assertEquals(memoryHint.status, "unsupported");
  assert(!("value" in concurrency));
  assert(!("value" in memoryHint));

  const legacy = captureLegacyChromiumHeap({});
  assertEquals(legacy.status, "unsupported");
  assert(!("value" in legacy));

  const uaMemory = await captureUaSpecificMemory({}, {
    isSecureContext: true,
    crossOriginIsolated: false,
  });
  assertEquals(uaMemory.status, "unsupported");
  assert(!("value" in uaMemory));
});

Deno.test("UA-CH preserves omitted, empty-valid, and returned fields separately", async () => {
  const evidence = await captureUaClientHints({
    userAgentData: {
      brands: [{ brand: "Test", version: "1" }],
      mobile: false,
      platform: "Linux",
      getHighEntropyValues: () =>
        Promise.resolve({
          architecture: "x86",
          bitness: "64",
          model: "",
          fullVersionList: [{ brand: "Test", version: "1.2.3" }],
        }),
    },
  });
  assertEquals(evidence.status, "supported-value");
  const fields = (evidence as {
    value: {
      highEntropy: { value: Record<string, { status: string; value?: unknown; note?: string }> };
    };
  }).value
    .highEntropy.value;
  assertEquals(fields.architecture.value, "x86");
  assertEquals(fields.model.status, "supported-value");
  assertEquals(fields.model.note, "empty-valid");
  assertEquals(fields.platformVersion.status, "not-allowed");
  assert(!("value" in fields.platformVersion));
});

Deno.test("memory probes preserve scope and isolation blockers", async () => {
  const legacy = captureLegacyChromiumHeap({
    memory: { jsHeapSizeLimit: 100, totalJSHeapSize: 50, usedJSHeapSize: 25 },
  });
  assertEquals(legacy.status, "supported-value");
  assertEquals((legacy as unknown as { scope: string }).scope, "chromium-shared-js-heap-legacy");

  const blocked = await captureUaSpecificMemory({
    measureUserAgentSpecificMemory: () => Promise.resolve({ bytes: 1, breakdown: [] }),
  }, {
    isSecureContext: true,
    crossOriginIsolated: false,
  });
  assertEquals(blocked.status, "not-cross-origin-isolated");
  assert(!("value" in blocked));
});

Deno.test("refresh and responsiveness evidence is bounded and availability-aware", async () => {
  let timestamp = 0;
  const refresh = await measureRefreshEstimate(
    (callback: (value: number) => void) => {
      timestamp += 16.667;
      queueMicrotask(() => callback(timestamp));
      return timestamp;
    },
    () => {},
    5,
  );
  assertEquals(refresh.status, "supported-value");
  const refreshValue = (refresh as { value: { estimatedHz: number } }).value;
  assert(refreshValue.estimatedHz > 59 && refreshValue.estimatedHz < 61);

  const responsiveness = startResponsivenessObservation({
    PerformanceObserver: { supportedEntryTypes: ["resource"] },
  });
  assertEquals(responsiveness.snapshot().status, "unsupported");
  assert(!("value" in responsiveness.snapshot()));
});

Deno.test("hosted runner labels page hints as coarse and reserves exact hardware for corpus diagnostics", async () => {
  const source = await Deno.readTextFile("public/hosted-runner.js");
  assert(source.includes("browser-exposed concurrency, not a physical CPU inventory"));
  assert(source.includes("coarse Chromium hint, not exact installed or available RAM"));
  assert(source.includes("belong to separately labelled controlled corpus diagnostic launches"));
  assert(!source.includes("Exact RAM"));
  assert(!source.includes("Exact CPU"));
});
