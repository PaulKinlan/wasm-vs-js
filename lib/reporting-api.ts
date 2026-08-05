// M3 reporting API routes: POST/GET /v1/runs, GET /v1/summaries, GET /v1/health.
// Uses KvRunStore for atomic, idempotent run storage with rate limiting and auth.

import { KvRunStore, MAX_RUN_BYTES, readBodyWithLimit } from "./kv-store.ts";
const REPORTER_TOKEN_ENV = "WASM_VS_JS_REPORTER_TOKEN";

export type ReportingConfig = {
  kvStore: KvRunStore | null;
  reporterToken: string | null;
};

export function createReportingConfig(): ReportingConfig {
  return {
    kvStore: null, // Will be set lazily when KV is available
    reporterToken: Deno.env.get(REPORTER_TOKEN_ENV) ?? null,
  };
}

export function isKvAvailable(): boolean {
  try {
    return typeof Deno.openKv === "function";
  } catch {
    return false;
  }
}

/**
 * Handle reporting API requests.
 * Returns a Response or null if the route doesn't match.
 */
export async function handleReportingRoute(
  request: Request,
  url: URL,
  config: ReportingConfig,
  serverMode: "local" | "public",
): Promise<Response | null> {
  const path = url.pathname;

  // ── GET /v1/health ──
  if (path === "/v1/health") {
    if (request.method !== "GET") {
      return json({ error: "method denied" }, 405);
    }
    if (config.kvStore) {
      const health = await config.kvStore.health();
      return json({
        ok: health.ok,
        kv: "connected",
        latencyMs: health.latencyMs,
        mode: serverMode,
        kvAvailable: isKvAvailable(),
      });
    }
    return json({
      ok: true,
      kv: "unavailable",
      mode: serverMode,
      kvAvailable: isKvAvailable(),
    });
  }

  // ── /v1/runs (POST = create, GET = list) ──
  if (path === "/v1/runs") {
    if (request.method === "POST") {
      return await handlePostRuns(request, config, serverMode);
    }
    if (request.method === "GET") {
      return await handleGetRuns(url, config, serverMode);
    }
    return json({ error: "method denied" }, 405);
  }

  // ── GET /v1/runs/:id ──
  if (path.startsWith("/v1/runs/") && path.length > "/v1/runs/".length) {
    if (request.method !== "GET") {
      return json({ error: "method denied" }, 405);
    }
    if (!config.kvStore) {
      return json({ error: "KV store unavailable" }, 503);
    }

    const runId = path.slice("/v1/runs/".length);
    if (!/^[A-Za-z0-9._-]+$/.test(runId)) {
      return json({ error: "invalid run ID" }, 400);
    }

    const run = await config.kvStore.get(runId);
    if (!run) return json({ error: "run not found" }, 404);
    return json(run);
  }

  // ── GET /v1/summaries ──
  if (path === "/v1/summaries") {
    if (request.method !== "GET") {
      return json({ error: "method denied" }, 405);
    }
    if (!config.kvStore) {
      return json({ error: "KV store unavailable" }, 503);
    }
    const summary = await config.kvStore.summary();
    return json(summary);
  }

  // ── GET /v1/headroom ──
  if (path === "/v1/headroom") {
    if (request.method !== "GET") {
      return json({ error: "method denied" }, 405);
    }
    if (!config.kvStore) {
      return json({ error: "KV store unavailable" }, 503);
    }
    const headroom = await config.kvStore.headroom();
    return json(headroom);
  }

  return null; // Not a reporting route
}

function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data) + "\n", {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "no-store",
    },
  });
}

// ── Extracted handlers for /v1/runs ──

async function handlePostRuns(
  request: Request,
  config: ReportingConfig,
  _serverMode: string,
): Promise<Response> {
  // Reporter authorization
  if (config.reporterToken) {
    const auth = request.headers.get("authorization");
    if (auth !== `Bearer ${config.reporterToken}`) {
      return json({ error: "reporter not authorized" }, 401);
    }
  }

  if (!config.kvStore) {
    return json({ error: "KV store unavailable — reporting requires Deno KV" }, 503);
  }

  // Rate limiting by client IP
  const clientIp = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    "127.0.0.1";
  if (!config.kvStore.checkRateLimit(clientIp)) {
    return json({ error: "rate limit exceeded" }, 429);
  }

  // Content-type check
  const contentType = request.headers.get("content-type")?.split(";")[0];
  if (contentType !== "application/json") {
    return json({ error: "content-type must be application/json" }, 415);
  }

  // Streaming byte cap before JSON parsing
  let bodyBytes: Uint8Array;
  try {
    bodyBytes = await readBodyWithLimit(request.body, MAX_RUN_BYTES);
  } catch (e) {
    const msg = e instanceof Error ? e.message : "body read failed";
    return json({ error: msg }, msg.includes("cap") ? 413 : 400);
  }

  // Parse JSON after byte cap
  let value: unknown;
  try {
    value = JSON.parse(new TextDecoder().decode(bodyBytes));
  } catch {
    return json({ error: "invalid JSON" }, 400);
  }

  // Store atomically
  try {
    const result = await config.kvStore!.put(value);
    return json(
      { stored: true, ...result },
      result.created ? 201 : 200,
    );
  } catch (e) {
    const msg = e instanceof Error ? e.message : "run denied";
    const status = msg.includes("schema denied") || msg.includes("hash denied") ||
        msg.includes("too large") || msg.includes("skew")
      ? 400
      : msg.includes("already exists")
      ? 409
      : 500;
    return json({ error: msg }, status);
  }
}

async function handleGetRuns(
  url: URL,
  config: ReportingConfig,
  _serverMode: "local" | "public",
): Promise<Response> {
  if (!config.kvStore) {
    return json({ error: "KV store unavailable" }, 503);
  }

  const limit = Math.min(
    Math.max(1, Number(url.searchParams.get("limit") ?? 50)),
    100,
  );
  const benchmarkId = url.searchParams.get("benchmark") ?? null;

  if (benchmarkId) {
    const { runs, total } = await config.kvStore.listByBenchmark(benchmarkId, limit);
    return json({ runs, total, limit });
  }

  const { runs, total, truncated } = await config.kvStore.listPage(limit);
  return json({ runs, total, truncated, limit });
}
