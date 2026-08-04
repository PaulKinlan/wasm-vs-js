// M4 Results Explorer tests.
// Verifies: results page serves, URL filters work, no winner copy,
// matrix/runs/detail/summary render, API routes connect.

import { assert, assertEquals } from "./assert.ts";

const PORT = "8299";
const ORIGIN = `http://127.0.0.1:${PORT}`;
let server: Deno.ChildProcess;

async function startServer() {
  server = new Deno.Command("deno", {
    args: [
      "run",
      "--unstable-kv",
      "--allow-net=127.0.0.1",
      "--allow-read=.",
      "--allow-write=.",
      "--allow-env=PORT,HOST,SERVER_MODE,WASM_VS_JS_COMMIT",
      "server.ts",
    ],
    env: {
      PORT,
      HOST: "127.0.0.1",
      SERVER_MODE: "local",
      WASM_VS_JS_COMMIT: Deno.env.get("WASM_VS_JS_COMMIT") ??
        new TextDecoder().decode(
          new Deno.Command("git", { args: ["rev-parse", "HEAD"] }).outputSync().stdout,
        ).trim(),
    },
    stdout: "null",
    stderr: "null",
  }).spawn();

  for (let i = 0; i < 30; i++) {
    try {
      const r = await fetch(`${ORIGIN}/results/`);
      if (r.ok) return;
    } catch { /* wait */ }
    await new Promise((r) => setTimeout(r, 200));
  }
  throw new Error("server did not start");
}

function stopServer() {
  try {
    server.kill("SIGTERM");
  } catch { /* already stopped */ }
}

Deno.test({
  name: "results page serves HTML with correct content type",
  sanitizeOps: false,
  sanitizeResources: false,
  async fn() {
    await startServer();
    try {
      const resp = await fetch(`${ORIGIN}/results/`);
      assertEquals(resp.status, 200);
      assertEquals(
        resp.headers.get("content-type"),
        "text/html; charset=utf-8",
      );
      const html = await resp.text();
      assert(html.includes("Results Explorer"), "missing title");
      assert(html.includes("results-filter-form"), "missing filter form");
      assert(html.includes("matrix-container"), "missing matrix container");
      assert(html.includes("runs-container"), "missing runs container");
      assert(html.includes("detail-container"), "missing detail container");
      assert(html.includes("summary-container"), "missing summary container");
    } finally {
      stopServer();
    }
  },
});

Deno.test({
  name: "results explorer JS serves with correct content type",
  sanitizeOps: false,
  sanitizeResources: false,
  async fn() {
    await startServer();
    try {
      const resp = await fetch(`${ORIGIN}/results-explorer.js`);
      assertEquals(resp.status, 200);
      assertEquals(
        resp.headers.get("content-type"),
        "text/javascript; charset=utf-8",
      );
      const js = await resp.text();
      assert(js.includes("readHashFilters"), "missing URL hash filter function");
      assert(js.includes("writeHashFilters"), "missing URL hash writer");
      assert(js.includes("renderMatrix"), "missing matrix renderer");
      assert(js.includes("renderRuns"), "missing runs renderer");
      assert(js.includes("renderRunDetail"), "missing detail renderer");
    } finally {
      stopServer();
    }
  },
});

Deno.test({
  name: "results page avoids winner copy and colour-only status",
  sanitizeOps: false,
  sanitizeResources: false,
  async fn() {
    await startServer();
    try {
      const resp = await fetch(`${ORIGIN}/results/`);
      const html = await resp.text();
      // Must NOT contain winner/speedup language
      assert(!html.toLowerCase().includes("faster"), "page must not claim faster/slower");
      assert(!html.toLowerCase().includes("speedup"), "page must not show speedup");
      assert(!html.toLowerCase().includes("winner"), "page must not declare a winner");
      // Must explicitly state no performance conclusions
      assert(
        html.includes("No accepted corpus claim") || html.includes("inspection surface"),
        "must state no conclusions",
      );
    } finally {
      stopServer();
    }
  },
});

Deno.test({
  name: "results page has URL-backed filter controls",
  sanitizeOps: false,
  sanitizeResources: false,
  async fn() {
    await startServer();
    try {
      const resp = await fetch(`${ORIGIN}/results/`);
      const html = await resp.text();
      assert(html.includes('id="filter-benchmark"'), "missing benchmark filter");
      assert(html.includes('id="filter-target"'), "missing target filter");
      assert(html.includes('id="filter-cache"'), "missing cache filter");
      assert(html.includes('id="filter-limit"'), "missing limit filter");
      assert(html.includes('id="filter-clear"'), "missing clear button");
    } finally {
      stopServer();
    }
  },
});

Deno.test({
  name: "results page links to API endpoints",
  sanitizeOps: false,
  sanitizeResources: false,
  async fn() {
    await startServer();
    try {
      const resp = await fetch(`${ORIGIN}/results/`);
      const html = await resp.text();
      assert(html.includes('href="/v1/runs'), "missing link to /v1/runs");
      assert(html.includes('href="/v1/summaries"'), "missing link to /v1/summaries");
      assert(html.includes('href="/v1/health"'), "missing link to /v1/health");
      assert(html.includes('href="/v1/headroom"'), "missing link to /v1/headroom");
    } finally {
      stopServer();
    }
  },
});

Deno.test({
  name: "results page has detail grid with workload metadata",
  sanitizeOps: false,
  sanitizeResources: false,
  async fn() {
    await startServer();
    try {
      const resp = await fetch(`${ORIGIN}/results/`);
      const html = await resp.text();
      assert(html.includes("detail-grid"), "missing detail grid");
      assert(html.includes("What this shows"), "missing what-it-shows card");
      assert(html.includes("What this does not show"), "missing what-it-does-not-show card");
      assert(html.includes("Data source"), "missing data source card");
      assert(html.includes("API endpoints"), "missing API endpoints card");
    } finally {
      stopServer();
    }
  },
});

Deno.test({
  name: "results page has unified masthead header",
  sanitizeOps: false,
  sanitizeResources: false,
  async fn() {
    await startServer();
    try {
      const resp = await fetch(`${ORIGIN}/results/`);
      const html = await resp.text();
      assert(html.includes('class="masthead"'), "missing masthead header");
      assert(html.includes('href="/benchmarks/"'), "missing catalog link");
      assert(html.includes('href="/experiments/"'), "missing experiment link");
      assert(html.includes('href="/evidence/"'), "missing evidence link");
    } finally {
      stopServer();
    }
  },
});
