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

// Constant-time bearer comparison: never early-exit on a mismatching byte,
// so the check does not leak the token through timing. Loops over the
// longer input so a length difference still costs the full comparison.
function bearerEqual(provided: string | null, token: string): boolean {
  const expected = new TextEncoder().encode(`Bearer ${token}`);
  const actual = new TextEncoder().encode(provided ?? "");
  let diff = expected.length === actual.length ? 0 : 1;
  const len = Math.max(expected.length, actual.length);
  for (let i = 0; i < len; i++) {
    diff |= (expected[i] ?? 0) ^ (actual[i] ?? 0);
  }
  return diff === 0;
}

async function sha256Hex(text: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

async function handlePostRuns(
  request: Request,
  config: ReportingConfig,
  serverMode: "local" | "public",
): Promise<Response> {
  // Reporter authorization — FAIL CLOSED (wasm-vs-js-a37). In public mode
  // an absent reporter token is a misconfiguration, never "no auth
  // required": the check used to be skipped entirely when the token was
  // unset, leaving POST /v1/runs unauthenticated on a public deployment.
  // Refusing must live here in the route's code path so it holds however
  // the server is started. CONSEQUENCE, by design: a public deployment
  // without WASM_VS_JS_REPORTER_TOKEN begins REFUSING reports; setting the
  // token restores ingestion. 503 (not 401) because the fault is the
  // server's configuration, not the client's credentials; the body names
  // the auth gate so it can never be confused with the KV-layer 503.
  if (serverMode === "public" && !config.reporterToken) {
    return json(
      { error: "reporter token not configured — public ingestion refuses to serve without one" },
      503,
    );
  }
  if (config.reporterToken) {
    const auth = request.headers.get("authorization");
    if (!bearerEqual(auth, config.reporterToken)) {
      return json({ error: "reporter not authorized" }, 401);
    }
  }

  if (!config.kvStore) {
    return json({ error: "KV store unavailable — reporting requires Deno KV" }, 503);
  }

  // Rate limiting by reporter IDENTITY, never by a client-supplied header
  // (wasm-vs-js-fap). The limiter used to key on the leftmost
  // x-forwarded-for value, which the caller controls: rotating it per
  // request bypassed the limit entirely (demonstrated on the base sha —
  // 31 rotating-header requests passed where 31 fixed-header requests
  // earned a 429). Post-a37 the public path requires a valid bearer, so
  // the token is the identity the limiter exists to bound — keyed as a
  // HASH, never the raw value, so the rate-limit table can never become a
  // credential store. The limit therefore binds on the server's own
  // signal, not on anything the caller can set. Local mode has no token
  // and falls back to the declared IP, which remains best-effort by
  // construction on a loopback developer path.
  const reporterId = config.reporterToken
    ? `tok:${await sha256Hex(config.reporterToken)}`
    : `ip:${request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "127.0.0.1"}`;
  if (!(await config.kvStore.checkRateLimit(reporterId))) {
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
