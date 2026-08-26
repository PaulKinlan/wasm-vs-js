import { LocalRunStore } from "../lib/run-store.ts";
import { CorpusCoordinator } from "../lib/corpus-store.ts";
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
  const experiment = await handler(
    new Request("http://127.0.0.1/experiments/m1-chrome-sum-u32-v1.json"),
  );
  assertEquals(experiment.status, 200);
  const experimentBody = await experiment.json();
  assertEquals(experimentBody.status, "preregistered-not-authorized");
  assertEquals(experimentBody.permitEnvelope.state, "template-only-not-consumed");
  // no-store policy (2026-08-05): edge cache truncates long CSP headers on
  // cached objects (platform bug); immutable returns with slice-4 hash URLs.
  assert(evidence.headers.get("cache-control")?.includes("no-store"));
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
      "/hosted-runner.js",
      "/provenance-probes.js",
      "/hosted-runner-core.js",
      "/hosted-runner-worker.js",
      "/benchmarks",
      "/benchmarks/",
      "/workload-catalog.js",
      "/data/workloads.v1.json",
      "/data/workload-catalog.schema.json",
      "/data/v2-proposal-implementation-status.v1.json",
      "/data/v2-proposal-implementation-status.schema.json",
      "/data/sum-u32-inspectability.v1.json",
      "/inspectability.js",
      "/v2-results.js",
      "/evidence/v2-proposals/",
      "/evidence/v2-proposals/audio-fft/js-controlled.json",
      "/evidence/v2-proposals/audio-fft/wasm-linear-controlled.json",
      "/artifacts/audio-fft/build-manifest.json",
      "/artifacts/audio-fft/audio-fft.wasm",
      "/artifacts/audio-fft/reference-output.f32le",
      "/artifacts/sum-u32/build-manifest.9c309c49.json",
      "/artifacts/sum-u32/sum-u32.wasm",
      "/benchmarks/sum-u32/workload.js",
      "/benchmarks/game-canvas-arcade/",
      "/benchmarks/game-canvas-entity-pathfinding/",
      "/benchmarks/game-dom-tactics-grid/",
      "/demos/game-family/demo.js",
      "/demos/game-family/worker.js",
      "/demos/game-family/styles.css",
      "/benchmarks/v2/game-family/engine.js",
      "/benchmarks/v2/game-family/fixtures.js",
      "/artifacts/game-v2-controlled-family/build-manifest.json",
      "/artifacts/game-v2-controlled-family/game-family.wasm",
      "/evidence/v2-proposals/games/game-canvas-arcade-v1-js-controlled.json",
      "/evidence/v2-proposals/games/game-canvas-arcade-v1-wasm-linear-controlled.json",
      "/evidence/v2-proposals/games/game-canvas-entity-pathfinding-v1-js-controlled.json",
      "/evidence/v2-proposals/games/game-canvas-entity-pathfinding-v1-wasm-linear-controlled.json",
      "/evidence/v2-proposals/games/game-dom-tactics-grid-v1-js-controlled.json",
      "/evidence/v2-proposals/games/game-dom-tactics-grid-v1-wasm-linear-controlled.json",
    ]
  ) {
    assertEquals((await handler(new Request(`http://127.0.0.1${path}`))).status, 200);
  }
  for (const path of ["/run", "/run/", "/run.html"]) {
    const res = await handler(new Request(`http://127.0.0.1${path}`));
    assertEquals(res.status, 302);
    assertEquals(res.headers.get("location"), "/#workload-sum-u32");
  }

  const runRedirect = await handler(new Request("http://127.0.0.1/run"));
  assertEquals(runRedirect.status, 302);
  assertEquals(runRedirect.headers.get("location"), "/#workload-sum-u32");
  const catalogPage = await (await handler(new Request("http://127.0.0.1/benchmarks/"))).text();
  assert(catalogPage.includes("38-WORKLOAD DENOMINATOR"));
  assert(catalogPage.includes("49 runnable browser demos across 38 proposed workloads"));
  assert(catalogPage.includes("v2 proposal implementation inventory"));
  assert(catalogPage.includes("Runnable demos: 14"));
  assert(catalogPage.includes("10 full proposal-validation routes and 4 reduced-fixture routes"));
  for (
    const path of [
      "/runner.js",
      "/raw/runs/example.json",
      "/source/9c309c4941d1b8550c15f8549f95a5636a634ef6/server.ts",
      "/artifacts/sum-u32/server.ts",
      "/artifacts/other/sum-u32.wasm",
      "/evidence/v2-proposals/audio-fft/unknown.json",
      "/artifacts/audio-fft/server.ts",
      "/artifacts/audio-fft/../audio-fir/not-allowlisted.wasm",
    ]
  ) {
    assertEquals((await handler(new Request(`http://127.0.0.1${path}`))).status, 404);
  }
  assertEquals((await handler(new Request("http://127.0.0.1/api/runs"))).status, 403);
  assertEquals((await handler(new Request("http://127.0.0.1/api/runs/example"))).status, 403);
  assertEquals(
    (await handler(new Request("http://127.0.0.1/api/runs/example/source-bundle"))).status,
    403,
  );
  const summary = await (await handler(new Request("http://127.0.0.1/api/summary"))).json();
  assertEquals(summary.runCount, 0);
  assertEquals(summary.claimStatus, "no-runs");
});

Deno.test("every ledger public link resolves through the exact read-only public allowlist", async () => {
  const ledger = JSON.parse(
    await Deno.readTextFile("catalog/v2-proposal-implementation-status.v1.json"),
  );
  const paths = new Set<string>();
  for (const entry of ledger.entries) {
    for (const link of entry.artifacts.publicLinks) paths.add(link.url);
    for (const link of entry.validationResults.publicEvidenceLinks) paths.add(link.url);
  }
  assertEquals(paths.size, 28);

  const publicHandler = createHandler(null, "public");
  for (const path of paths) {
    assertEquals(
      (await publicHandler(new Request(`http://127.0.0.1${path}`))).status,
      200,
    );
  }

  for (
    const path of [
      "/artifacts/audio-fft/unknown.json",
      "/artifacts/audio-fft/../audio-fir/not-allowlisted.wasm",
      "/artifacts/vdom-diff-patch/unknown.wasm",
      "/artifacts/regex-automata-duel/unknown.json",
      "/artifacts/traditional-demos/unknown.json",
    ]
  ) {
    assertEquals((await publicHandler(new Request(`http://127.0.0.1${path}`))).status, 404);
  }

  const publicPath = [...paths][0];
  for (const method of ["POST", "PUT", "PATCH", "DELETE", "OPTIONS"]) {
    assertEquals(
      (await publicHandler(new Request(`http://127.0.0.1${publicPath}`, { method }))).status,
      403,
    );
  }
});

Deno.test("corpus collector is token-bound locally and completely hidden publicly", async () => {
  const root = await Deno.makeTempDir();
  try {
    const store = new LocalRunStore(`${root}/runs`);
    await store.initialize();
    const corpus = new CorpusCoordinator(`${root}/corpora`);
    const local = createHandler(store, "local", corpus);
    const manifest = {
      experimentId: "m1-chrome-sum-u32-v1",
      corpusId: "corpus-1",
      blockId: "block-1",
      scheduleIndex: 0,
      stratum: "cold",
      order: ["js-controlled", "wasm-linear-controlled"],
      expiresAt: new Date(Date.now() + 60_000).toISOString(),
    };
    const issued = await local(
      new Request("http://127.0.0.1/api/corpus/launch", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(manifest),
      }),
    );
    assertEquals(issued.status, 201);
    const token = (await issued.json()).token;
    assertEquals(
      (await local(new Request(`http://127.0.0.1/api/corpus/manifest?token=${token}`))).status,
      200,
    );
    assertEquals((await local(new Request("http://127.0.0.1/corpus-run"))).status, 200);
    const publicHandler = createHandler(null, "public");
    assertEquals((await publicHandler(new Request("http://127.0.0.1/corpus-run"))).status, 404);
    assertEquals((await publicHandler(new Request("http://127.0.0.1/corpus-run.js"))).status, 404);
    assertEquals(
      (await publicHandler(new Request("http://127.0.0.1/api/corpus/manifest?token=x"))).status,
      403,
    );
    assertEquals(
      (await publicHandler(new Request("http://127.0.0.1/api/corpus/launch", { method: "POST" })))
        .status,
      403,
    );
  } finally {
    await Deno.remove(root, { recursive: true });
  }
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
    assert(wasm.headers.get("cache-control")?.includes("no-store"));
    const csp = wasm.headers.get("content-security-policy") ?? "";
    assert(csp.includes("script-src 'self' 'wasm-unsafe-eval' blob:"));
    assert(csp.includes("worker-src 'self'"));
    // 'unsafe-eval' approved by Paul 2026-08-04: AlaSQL compiles queries via
    // eval-class primitives; required for the sqlite-notebook JS target.
    assert(csp.includes("'unsafe-eval'"));
    assert(!csp.includes("'unsafe-inline'"));
    const manifest = await handler(
      new Request("http://127.0.0.1/artifacts/sum-u32/build-manifest.9c309c49.json"),
    );
    assertEquals(manifest.status, 200);
    assertEquals(manifest.headers.get("content-type"), "application/json; charset=utf-8");
    assert(manifest.headers.get("cache-control")?.includes("no-store"));
    assertEquals(
      new Uint8Array(await manifest.arrayBuffer()),
      await Deno.readFile("public/artifacts/sum-u32/build-manifest.9c309c49.json"),
    );
    const head = await handler(
      new Request("http://127.0.0.1/artifacts/sum-u32/sum-u32.wasm", { method: "HEAD" }),
    );
    assertEquals(head.status, 200);
    assertEquals((await head.arrayBuffer()).byteLength, 0);
    for (const path of ["/source/server.ts", "/artifacts/sum-u32/../server.ts"]) {
      assertEquals((await handler(new Request(`http://127.0.0.1${path}`))).status, 404);
    }
    const favicon = await handler(new Request("http://127.0.0.1/favicon.ico"));
    assertEquals(favicon.status, 200);
    assertEquals(favicon.headers.get("content-type"), "image/svg+xml");
    const denied = await handler(new Request("http://127.0.0.1/runner.js", { method: "POST" }));
    assertEquals(denied.status, 405);
  } finally {
    await Deno.remove(root, { recursive: true });
  }
});
