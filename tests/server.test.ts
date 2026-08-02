import { LocalRunStore } from "../lib/run-store.ts";
import { createHandler } from "../server.ts";
import { assert, assertEquals } from "./assert.ts";
import { validRun } from "./fixture.ts";

Deno.test("local server stores an immutable run and exposes an inspectable summary", async () => {
  const root = await Deno.makeTempDir();
  try {
    const store = new LocalRunStore(root);
    await store.initialize();
    const handler = createHandler(store);
    const run = await validRun();
    const stored = await handler(
      new Request("http://127.0.0.1/api/runs", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(run),
      }),
    );
    assertEquals(stored.status, 201);
    assertEquals(stored.headers.get("cross-origin-opener-policy"), "same-origin");
    assertEquals(stored.headers.get("cross-origin-embedder-policy"), "require-corp");

    const duplicate = await handler(
      new Request("http://127.0.0.1/api/runs", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(run),
      }),
    );
    assertEquals(duplicate.status, 409);

    const summaryResponse = await handler(new Request("http://127.0.0.1/api/summary"));
    const summary = await summaryResponse.json();
    assertEquals(summary.claimStatus, "pilot-only");
    assertEquals(summary.sourceRunCount, 1);
    assertEquals(summary.truncated, false);
    assertEquals(summary.cells[0].trajectories[0].samples[0].iteration, 0);

    const detail = await handler(new Request(`http://127.0.0.1/api/runs/${run.runId}`));
    assertEquals(detail.status, 200);
    assertEquals((await detail.json()).payloadSha256, run.payloadSha256);
  } finally {
    await Deno.remove(root, { recursive: true });
  }
});

Deno.test("public server is fail-closed read-only and exposes only sanitized evidence", async () => {
  const handler = createHandler(null, "public");

  const home = await handler(new Request("http://127.0.0.1/"));
  assertEquals(home.status, 200);
  const evidence = await handler(new Request("http://127.0.0.1/evidence/v1/acceptance.json"));
  assertEquals(evidence.status, 200);
  assert(evidence.headers.get("cache-control")?.includes("immutable"));
  const packageBody = await evidence.json();
  assertEquals(packageBody.claims.performanceClaimAccepted, false);
  assertEquals(packageBody.runtimeValidation.retainedBrowserArtifacts, false);

  const health = await handler(new Request("http://127.0.0.1/healthz"));
  const healthBody = await health.json();
  assertEquals(healthBody.mode, "public-read-only");
  assertEquals(
    healthBody.acceptedImplementationCommit,
    "9c309c4941d1b8550c15f8549f95a5636a634ef6",
  );
  assertEquals("localCheckoutCommit" in healthBody, false);

  for (const path of ["/api/runs", "/api/runs/example", "/styles.css", "/unknown"]) {
    const denied = await handler(
      new Request(`http://127.0.0.1${path}`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: "{}",
      }),
    );
    assertEquals(denied.status, 403);
  }
  for (
    const path of [
      "/run",
      "/run/",
      "/hosted-runner.js",
      "/provenance-probes.js",
      "/hosted-runner-core.js",
      "/hosted-runner-worker.js",
      "/benchmarks",
      "/benchmarks/",
      "/workload-catalog.js",
      "/data/workloads.v1.json",
      "/data/workload-catalog.schema.json",
      "/benchmarks/sum-u32/workload.js",
    ]
  ) {
    assertEquals((await handler(new Request(`http://127.0.0.1${path}`))).status, 200);
  }
  const livePage = await (await handler(new Request("http://127.0.0.1/run"))).text();
  assert(livePage.includes("Exploratory single-tab run"));
  assert(livePage.includes("dedicated same-origin module worker"));
  const catalogPage = await (await handler(new Request("http://127.0.0.1/benchmarks/"))).text();
  assert(catalogPage.includes("38-WORKLOAD DENOMINATOR"));
  assert(catalogPage.includes("zero of these 38 catalog entries"));
  for (const path of ["/run.html", "/runner.js", "/raw/runs/example.json"]) {
    assertEquals((await handler(new Request(`http://127.0.0.1${path}`))).status, 404);
  }
  assertEquals((await handler(new Request("http://127.0.0.1/api/runs"))).status, 403);
  assertEquals((await handler(new Request("http://127.0.0.1/api/runs/example"))).status, 403);
  const summary = await (await handler(new Request("http://127.0.0.1/api/summary"))).json();
  assertEquals(summary.runCount, 0);
  assertEquals(summary.claimStatus, "no-runs");
});

Deno.test("local server bounds writes and serves exact Wasm MIME", async () => {
  const root = await Deno.makeTempDir();
  try {
    const store = new LocalRunStore(root);
    await store.initialize();
    const handler = createHandler(store);
    const tooLarge = await handler(
      new Request("http://127.0.0.1/api/runs", {
        method: "POST",
        headers: { "content-type": "application/json", "content-length": "600000" },
        body: "{}",
      }),
    );
    assertEquals(tooLarge.status, 400);
    const wasm = await handler(new Request("http://127.0.0.1/artifacts/sum-u32/sum-u32.wasm"));
    assertEquals(wasm.status, 200);
    assertEquals(wasm.headers.get("content-type"), "application/wasm");
    assert(wasm.headers.get("cache-control")?.includes("immutable"));
    const csp = wasm.headers.get("content-security-policy") ?? "";
    assert(csp.includes("script-src 'self' 'wasm-unsafe-eval' blob:"));
    assert(csp.includes("worker-src 'self'"));
    assert(!csp.includes("'unsafe-eval'"));
    assert(!csp.includes("'unsafe-inline'"));
    const favicon = await handler(new Request("http://127.0.0.1/favicon.ico"));
    assertEquals(favicon.status, 200);
    assertEquals(favicon.headers.get("content-type"), "image/svg+xml");
    const denied = await handler(new Request("http://127.0.0.1/runner.js", { method: "POST" }));
    assertEquals(denied.status, 405);
  } finally {
    await Deno.remove(root, { recursive: true });
  }
});
