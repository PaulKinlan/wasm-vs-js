import { assert, assertEquals } from "./assert.ts";
import {
  captureLegacyChromiumHeap,
  captureUaClientHints,
  captureUaSpecificMemory,
  MAX_LONG_ANIMATION_FRAME_ENTRIES,
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

Deno.test("LoAF evidence is windowed, capped, and accounts for dropped entries", () => {
  let callback: (list: { getEntries(): unknown[] }) => void = () => {};
  let clock = 100;
  class FakeObserver {
    constructor(next: typeof callback) {
      callback = next;
    }
    observe() {
      callback({
        getEntries: () => [
          { startTime: 50, duration: 999_999 },
          ...Array.from({ length: 10_000 }, (_, index) => ({
            startTime: 150,
            duration: index + 1,
            blockingDuration: index,
          })),
        ],
      });
    }
    takeRecords() {
      return [{ startTime: 250, duration: 20, blockingDuration: 2 }];
    }
    disconnect() {}
  }
  const observation = startResponsivenessObservation({
    performance: { now: () => clock },
    PerformanceObserver: Object.assign(FakeObserver, {
      supportedEntryTypes: ["long-animation-frame"],
    }),
  });
  clock = 300;
  observation.stop();
  const evidence = observation.snapshot() as {
    status: string;
    value: {
      collectionStart: number;
      collectionEnd: number;
      observedCount: number;
      retainedCount: number;
      maximumRetainedEntries: number;
      droppedEntries: number;
      truncated: boolean;
      maxDurationMs: number;
      entries: unknown[];
    };
  };
  assertEquals(evidence.status, "supported-value");
  assertEquals(evidence.value.collectionStart, 100);
  assertEquals(evidence.value.collectionEnd, 300);
  assertEquals(evidence.value.observedCount, 10_001);
  assertEquals(evidence.value.retainedCount, MAX_LONG_ANIMATION_FRAME_ENTRIES);
  assertEquals(evidence.value.entries.length, MAX_LONG_ANIMATION_FRAME_ENTRIES);
  assertEquals(evidence.value.droppedEntries, 9_801);
  assertEquals(evidence.value.truncated, true);
  assertEquals(evidence.value.maxDurationMs, 10_000);
});

Deno.test("LoAF observer failures become typed evidence without aborting", () => {
  class ObserveFailure {
    static supportedEntryTypes = ["long-animation-frame"];
    observe() {
      throw new Error("observe denied");
    }
  }
  const setup = startResponsivenessObservation({
    performance: { now: () => 1 },
    PerformanceObserver: ObserveFailure,
  });
  setup.stop();
  assertEquals(setup.snapshot().status, "failed");

  class TakeFailure {
    static supportedEntryTypes = ["long-animation-frame"];
    constructor(_callback: unknown) {}
    observe() {}
    takeRecords() {
      throw new Error("take denied");
    }
    disconnect() {}
  }
  const take = startResponsivenessObservation({
    performance: { now: () => 1 },
    PerformanceObserver: TakeFailure,
  });
  take.stop();
  assertEquals(take.snapshot().status, "failed");
});

Deno.test("optional provenance promises time out and absent fields stay unavailable", async () => {
  const never = new Promise(() => {});
  const hints = await captureUaClientHints({
    userAgentData: {
      mobile: false,
      platform: "Linux",
      getHighEntropyValues: () => never,
    },
  }, 5);
  const hintsValue = (hints as {
    value: { lowEntropy: Record<string, { status: string }>; highEntropy: { status: string } };
  }).value;
  assertEquals(hintsValue.lowEntropy.brands.status, "unsupported");
  assertEquals(hintsValue.highEntropy.status, "api-timeout");

  const memory = await captureUaSpecificMemory(
    {
      measureUserAgentSpecificMemory: () => never,
    },
    { isSecureContext: true, crossOriginIsolated: true },
    5,
  );
  assertEquals(memory.status, "api-timeout");

  const observation = startResponsivenessObservation({ PerformanceObserver: class {} });
  assertEquals(observation.supportedEntryTypes.status, "unsupported");
  assertEquals(observation.snapshot().status, "unsupported");
});

Deno.test("hosted runner reconciles controlling Service Worker delivery", async () => {
  const page = await Deno.readTextFile("public/hosted-runner.js");
  const worker = await Deno.readTextFile("public/hosted-runner-worker.js");
  assert(page.includes("navigator.serviceWorker?.controller != null"));
  assert(page.includes("serviceWorkerControlled"));
  assert(page.includes("finally {"));
  assert(page.includes("button.disabled = false;"));
  assert(worker.includes("A Service Worker controlled this page and may have intercepted"));
  assert(worker.includes("delivery may be local cache or Service Worker interception"));
  assert(!worker.includes("zero transfer bytes. This suggests local cache delivery"));
});

Deno.test("hosted runner labels page hints as coarse and reserves exact hardware for corpus diagnostics", async () => {
  const source = await Deno.readTextFile("public/hosted-runner.js");
  assert(source.includes("browser-exposed concurrency, not a physical CPU inventory"));
  assert(source.includes("coarse Chromium hint, not exact installed or available RAM"));
  assert(source.includes("Separate diagnostic launches collect those fields"));
  assert(!source.includes("Exact RAM"));
  assert(!source.includes("Exact CPU"));
});
