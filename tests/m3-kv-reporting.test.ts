// M3: Deno KV reporting service tests.
// Tests: POST /v1/runs with streaming byte cap, idempotency, schema validation,
// rate limiting, auth, GET /v1/runs list/detail, summaries, health, headroom.

import { KvRunStore, MAX_RUN_BYTES, readBodyWithLimit } from "../lib/kv-store.ts";
import { handleReportingRoute, type ReportingConfig } from "../lib/reporting-api.ts";
import { hashCanonicalEnvelope } from "../lib/canonical.ts";
import { assert, assertEquals } from "./assert.ts";
import { validRun } from "./fixture.ts";

// ── Helpers ──

async function makeKv(): Promise<Deno.Kv> {
  return await Deno.openKv(":memory:");
}

function makeConfig(kv: Deno.Kv | null, token: string | null = null): ReportingConfig {
  return {
    kvStore: kv ? new KvRunStore(kv) : null,
    reporterToken: token,
  };
}

// ── Tests ──

Deno.test({
  name: "kv-store: valid run stores atomically with dedupe",
  sanitizeOps: false,
  sanitizeResources: false,
  async fn() {
    const kv = await makeKv();
    const store = new KvRunStore(kv);
    const run = await validRun({ capturedAt: new Date().toISOString() });

    const result = await store.put(run);
    assertEquals(result.created, true);
    assertEquals(result.runId, run.runId);

    // Idempotent re-insert returns created=false
    const result2 = await store.put(run);
    assertEquals(result2.created, false);
    assertEquals(result2.runId, run.runId);

    kv.close();
  },
});

Deno.test({
  name: "kv-store: invalid schema is rejected",
  sanitizeOps: false,
  sanitizeResources: false,
  async fn() {
    const kv = await makeKv();
    const store = new KvRunStore(kv);

    let caught = false;
    try {
      await store.put({ not: "a valid run" });
    } catch (e) {
      caught = true;
      assert(e instanceof Error);
      assert(e.message.includes("schema denied"));
    }
    assert(caught, "should reject invalid schema");

    kv.close();
  },
});

Deno.test({
  name: "kv-store: payload hash mismatch is rejected",
  sanitizeOps: false,
  sanitizeResources: false,
  async fn() {
    const kv = await makeKv();
    const store = new KvRunStore(kv);
    const run = await validRun({ capturedAt: new Date().toISOString() });
    run.payloadSha256 = "0".repeat(64); // Wrong hash

    let caught = false;
    try {
      await store.put(run);
    } catch (e) {
      caught = true;
      assert(e instanceof Error);
      assert(e.message.includes("hash denied"));
    }
    assert(caught, "should reject hash mismatch");

    kv.close();
  },
});

Deno.test({
  name: "kv-store: future timestamp is rejected",
  sanitizeOps: false,
  sanitizeResources: false,
  async fn() {
    const kv = await makeKv();
    const store = new KvRunStore(kv);
    const future = new Date(Date.now() + 600_000).toISOString();
    const run = await validRun({ capturedAt: future });
    // Recalculate hash since capturedAt changed
    run.payloadSha256 = await hashCanonicalEnvelope(run);

    let caught = false;
    try {
      await store.put(run);
    } catch (e) {
      caught = true;
      assert((e as Error).message.includes("skew"));
    }
    assert(caught, "should reject future timestamp");

    kv.close();
  },
});

Deno.test({
  name: "kv-store: listPage returns runs in order",
  sanitizeOps: false,
  sanitizeResources: false,
  async fn() {
    const kv = await makeKv();
    const store = new KvRunStore(kv);

    for (let i = 0; i < 5; i++) {
      const run = await validRun({
        runId: `run-${String(i).padStart(16, "0")}`,
        capturedAt: new Date(Date.now() + i * 1000).toISOString(),
      });
      run.payloadSha256 = await hashCanonicalEnvelope(run);
      await store.put(run);
    }

    const page = await store.listPage(10);
    assertEquals(page.total, 5);
    assertEquals(page.runs.length, 5);
    assertEquals(page.truncated, false);

    // Sorted by capturedAt ascending
    assert(page.runs[0].capturedAt <= page.runs[1].capturedAt);

    kv.close();
  },
});

Deno.test({
  name: "kv-store: listByBenchmark filters correctly",
  sanitizeOps: false,
  sanitizeResources: false,
  async fn() {
    const kv = await makeKv();
    const store = new KvRunStore(kv);

    const run1 = await validRun({
      capturedAt: new Date().toISOString(),
      runId: "r1_padding_000001",
    });
    run1.payloadSha256 = await hashCanonicalEnvelope(run1);
    await store.put(run1);

    const run2 = await validRun({
      capturedAt: new Date(Date.now() + 1000).toISOString(),
      runId: "r2_padding_000002",
    });
    run2.payloadSha256 = await hashCanonicalEnvelope(run2);
    await store.put(run2);

    const sumFilter = await store.listByBenchmark("sum-u32");
    assertEquals(sumFilter.total, 2);

    kv.close();
  },
});

Deno.test({
  name: "kv-store: summary counts benchmarks and targets",
  sanitizeOps: false,
  sanitizeResources: false,
  async fn() {
    const kv = await makeKv();
    const store = new KvRunStore(kv);

    for (let i = 0; i < 3; i++) {
      const run = await validRun({
        capturedAt: new Date(Date.now() + i * 1000).toISOString(),
        runId: `sum-run-${String(i).padStart(10, "0")}`,
      });
      run.payloadSha256 = await hashCanonicalEnvelope(run);
      await store.put(run);
    }

    const s = await store.summary();
    assertEquals(s.totalRuns, 3);
    assertEquals(s.benchmarkCounts["sum-u32"], 3);
    assertEquals(s.targetCounts["javascript"], 3);

    kv.close();
  },
});

Deno.test({
  name: "kv-store: health returns ok and latency",
  sanitizeOps: false,
  sanitizeResources: false,
  async fn() {
    const kv = await makeKv();
    const store = new KvRunStore(kv);

    const h = await store.health();
    assertEquals(h.ok, true);
    assert(h.latencyMs >= 0);

    kv.close();
  },
});

Deno.test({
  name: "kv-store: headroom reports key count and byte estimate",
  sanitizeOps: false,
  sanitizeResources: false,
  async fn() {
    const kv = await makeKv();
    const store = new KvRunStore(kv);

    const run = await validRun({ capturedAt: new Date().toISOString() });
    await store.put(run);

    const h = await store.headroom();
    assert(h.keyCount >= 4, `expected at least 4 keys, got ${h.keyCount}`); // run + dedupe + index + summary
    assert(h.estimatedBytes > 0);
    assertEquals(h.maxRunBytes, MAX_RUN_BYTES);

    kv.close();
  },
});

Deno.test({
  name: "kv-store: rate limiter allows up to max then blocks",
  sanitizeOps: false,
  sanitizeResources: false,
  fn() {
    const kv = {
      get: () => Promise.resolve({ value: null }),
      list: () => [],
      atomic: () => ({
        check: () => {},
        set: () => {},
        commit: () => Promise.resolve({ ok: true }),
      }),
      close: () => {},
    } as unknown as Deno.Kv;
    const store = new KvRunStore(kv);

    for (let i = 0; i < 30; i++) {
      assert(store.checkRateLimit("client-1") === true);
    }
    assert(store.checkRateLimit("client-1") === false); // 31st blocked
    assert(store.checkRateLimit("client-2") === true); // Different client allowed
  },
});

Deno.test({
  name: "readBodyWithLimit: rejects oversized body",
  async fn() {
    const largeBody = new ReadableStream({
      start(controller) {
        controller.enqueue(new Uint8Array(MAX_RUN_BYTES + 1));
        controller.close();
      },
    });

    let caught = false;
    try {
      await readBodyWithLimit(largeBody, MAX_RUN_BYTES);
    } catch (e) {
      caught = true;
      assert(e instanceof Error);
      assert(e.message.includes("cap"));
    }
    assert(caught, "should reject oversized body");
  },
});

Deno.test({
  name: "readBodyWithLimit: returns body under limit",
  async fn() {
    const data = new Uint8Array([1, 2, 3, 4, 5]);
    const body = new ReadableStream({
      start(controller) {
        controller.enqueue(data);
        controller.close();
      },
    });

    const result = await readBodyWithLimit(body, 100);
    assertEquals(result.byteLength, 5);
    assertEquals(result[0], 1);
  },
});

// ── Reporting API route tests ──

Deno.test({
  name: "reporting-api: POST /v1/runs stores valid run",
  sanitizeOps: false,
  sanitizeResources: false,
  async fn() {
    const kv = await makeKv();
    const config = makeConfig(kv);
    const run = await validRun({ capturedAt: new Date().toISOString() });

    const request = new Request("https://example.test/v1/runs", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(run),
    });

    const response = await handleReportingRoute(request, new URL(request.url), config, "local");
    assert(response !== null);
    assertEquals(response!.status, 201);
    const body = await response!.json();
    assertEquals(body.stored, true);
    assertEquals(body.created, true);

    kv.close();
  },
});

Deno.test({
  name: "reporting-api: POST /v1/runs rejects without auth when token configured",
  sanitizeOps: false,
  sanitizeResources: false,
  async fn() {
    const kv = await makeKv();
    const config = makeConfig(kv, "secret-token");

    const request = new Request("https://example.test/v1/runs", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: "{}",
    });

    const response = await handleReportingRoute(request, new URL(request.url), config, "local");
    assert(response !== null);
    assertEquals(response!.status, 401);

    kv.close();
  },
});

Deno.test({
  name: "reporting-api: POST /v1/runs accepts with correct auth",
  sanitizeOps: false,
  sanitizeResources: false,
  async fn() {
    const kv = await makeKv();
    const config = makeConfig(kv, "secret-token");
    const run = await validRun({ capturedAt: new Date().toISOString() });

    const request = new Request("https://example.test/v1/runs", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "authorization": "Bearer secret-token",
      },
      body: JSON.stringify(run),
    });

    const response = await handleReportingRoute(request, new URL(request.url), config, "local");
    assert(response !== null);
    assertEquals(response!.status, 201);

    kv.close();
  },
});

Deno.test({
  name: "reporting-api: POST /v1/runs rejects wrong content-type",
  sanitizeOps: false,
  sanitizeResources: false,
  async fn() {
    const kv = await makeKv();
    const config = makeConfig(kv);

    const request = new Request("https://example.test/v1/runs", {
      method: "POST",
      headers: { "content-type": "text/plain" },
      body: "hello",
    });

    const response = await handleReportingRoute(request, new URL(request.url), config, "local");
    assert(response !== null);
    assertEquals(response!.status, 415);

    kv.close();
  },
});

Deno.test({
  name: "reporting-api: GET /v1/runs lists stored runs",
  sanitizeOps: false,
  sanitizeResources: false,
  async fn() {
    const kv = await makeKv();
    const config = makeConfig(kv);
    const run = await validRun({ capturedAt: new Date().toISOString() });
    await config.kvStore!.put(run);

    const request = new Request("https://example.test/v1/runs", { method: "GET" });
    const response = await handleReportingRoute(request, new URL(request.url), config, "local");
    assert(response !== null);
    assertEquals(response!.status, 200);
    const body = await response!.json();
    assertEquals(body.total, 1);
    assertEquals(body.runs.length, 1);

    kv.close();
  },
});

Deno.test({
  name: "reporting-api: GET /v1/runs/:id returns stored run",
  sanitizeOps: false,
  sanitizeResources: false,
  async fn() {
    const kv = await makeKv();
    const config = makeConfig(kv);
    const run = await validRun({
      capturedAt: new Date().toISOString(),
      runId: "test-run-42-padding",
    });
    run.payloadSha256 = await hashCanonicalEnvelope(run);
    await config.kvStore!.put(run);

    const request = new Request("https://example.test/v1/runs/test-run-42-padding", {
      method: "GET",
    });
    const response = await handleReportingRoute(request, new URL(request.url), config, "local");
    assert(response !== null);
    assertEquals(response!.status, 200);
    const body = await response!.json();
    assertEquals(body.runId, "test-run-42-padding");

    kv.close();
  },
});

Deno.test({
  name: "reporting-api: GET /v1/runs/:id returns 404 for missing",
  sanitizeOps: false,
  sanitizeResources: false,
  async fn() {
    const kv = await makeKv();
    const config = makeConfig(kv);

    const request = new Request("https://example.test/v1/runs/nonexistent", { method: "GET" });
    const response = await handleReportingRoute(request, new URL(request.url), config, "local");
    assert(response !== null);
    assertEquals(response!.status, 404);

    kv.close();
  },
});

Deno.test({
  name: "reporting-api: GET /v1/health returns ok",
  sanitizeOps: false,
  sanitizeResources: false,
  async fn() {
    const kv = await makeKv();
    const config = makeConfig(kv);

    const request = new Request("https://example.test/v1/health", { method: "GET" });
    const response = await handleReportingRoute(request, new URL(request.url), config, "local");
    assert(response !== null);
    assertEquals(response!.status, 200);
    const body = await response!.json();
    assertEquals(body.ok, true);

    kv.close();
  },
});

Deno.test({
  name: "reporting-api: public mode is read-only (GET allowed, ingestion denied)",
  sanitizeOps: false,
  sanitizeResources: false,
  async fn() {
    const kv = await makeKv();
    const config = makeConfig(kv);

    // GET /v1/runs is the Results Explorer's read path — public mode must serve it.
    const getRequest = new Request("https://example.test/v1/runs", { method: "GET" });
    const getResponse = await handleReportingRoute(
      getRequest,
      new URL(getRequest.url),
      config,
      "public",
    );
    assert(getResponse !== null);
    assertEquals(getResponse!.status, 200);

    // Ingestion is reporter-authenticated: a wrong/missing token is denied.
    const authedConfig = makeConfig(kv, "reporter-secret");
    const postRequest = new Request("https://example.test/v1/runs", {
      method: "POST",
      headers: { "content-type": "application/json", authorization: "Bearer wrong-token" },
      body: JSON.stringify({}),
    });
    const postResponse = await handleReportingRoute(
      postRequest,
      new URL(postRequest.url),
      authedConfig,
      "public",
    );
    assert(postResponse !== null);
    assertEquals(postResponse!.status, 401);

    kv.close();
  },
});

Deno.test({
  name: "kv-store: exportLogical and importLogical roundtrip",
  sanitizeOps: false,
  sanitizeResources: false,
  async fn() {
    const kv1 = await makeKv();
    const store1 = new KvRunStore(kv1);
    const run = await validRun({ capturedAt: new Date().toISOString() });
    await store1.put(run);

    const dump = await store1.exportLogical();
    assertEquals(dump.version, 1);
    assertEquals(dump.totalRuns, 1);
    assert(dump.checksumSha256.length === 64);

    const kv2 = await makeKv();
    const store2 = new KvRunStore(kv2);
    const importRes = await store2.importLogical(dump);
    assertEquals(importRes.imported, 1);
    assertEquals(importRes.skipped, 0);

    const runId = String(run.runId);
    const retrieved = await store2.get(runId);
    assert(retrieved !== null);
    assertEquals(retrieved!.runId, runId);

    kv1.close();
    kv2.close();
  },
});

Deno.test({
  name: "reporting-api: GET /v1/summaries returns benchmark counts",
  sanitizeOps: false,
  sanitizeResources: false,
  async fn() {
    const kv = await makeKv();
    const config = makeConfig(kv);
    const run = await validRun({ capturedAt: new Date().toISOString() });
    await config.kvStore!.put(run);

    const request = new Request("https://example.test/v1/summaries", { method: "GET" });
    const response = await handleReportingRoute(request, new URL(request.url), config, "local");
    assert(response !== null);
    assertEquals(response!.status, 200);
    const body = await response!.json();
    assertEquals(body.totalRuns, 1);
    assert(body.benchmarkCounts["sum-u32"] === 1);

    kv.close();
  },
});

Deno.test({
  name: "reporting-api: non-matching route returns null",
  async fn() {
    const config = makeConfig(null);

    const request = new Request("https://example.test/v1/unknown", { method: "GET" });
    const response = await handleReportingRoute(request, new URL(request.url), config, "local");
    assertEquals(response, null);
  },
});
