// iframe-benchmark-bridge.js — postMessage protocol between the suite runner
// (parent) and a DOM demo page (iframe child) for REAL-DOM benchmarks.
//
// Paul's vision: the DOM workloads exist to measure JS vs Wasm interacting
// with the actual DOM. Workers cannot touch the DOM, so the suite runner loads
// each DOM demo page inside an iframe, posts a start message, the page runs
// its real-DOM benchmark, and posts results back.
//
// Protocol (same-origin only — iframe src and parent share the deployment
// origin, so event.origin is checked against location.origin):
//   parent -> child:  { type: "wvj-benchmark-start", token, iterations, targets, config }
//   child -> parent:  { type: "wvj-benchmark-progress", token, target, iteration, total }
//   child -> parent:  { type: "wvj-benchmark-result", token, perTarget, consoleErrors, detail }
//   child -> parent:  { type: "wvj-benchmark-error", token, message }
//
// Both sides validate message shape + token before acting. CSP-safe: no inline
// styles (the strict style-src 'self' policy blocks them).

import { validateResultMessage, validateStartMessage } from "./dom-hosts/todomvc-ops.js";

// ── Child side: register the page's DOM host ───────────────────────────────

// Pages opt in by loading this module and declaring
//   <body data-dom-host="/dom-hosts/<workload>-host.js">
// The bridge dynamic-imports the host, then listens for start messages.
export async function registerIframeHost() {
  const hostPath = document.body?.dataset?.domHost || "";
  if (!hostPath) return { registered: false, reason: "no data-dom-host declared" };

  let host;
  try {
    host = await import(hostPath);
  } catch (error) {
    // Honest failure: the parent will surface this as an unavailable run.
    const notify = (message) => {
      globalThis.parent?.postMessage(
        { type: "wvj-benchmark-error", token: "__load__", message },
        location.origin,
      );
    };
    notify(error instanceof Error ? `host load failed: ${error.message}` : "host load failed");
    return { registered: false, reason: "host import failed" };
  }

  const run = host.createTodomvcHost
    ? await host.createTodomvcHost()
    : host.default?.createTodomvcHost
    ? await host.default.createTodomvcHost()
    : null;
  if (!run || typeof run.run !== "function") {
    return { registered: false, reason: "host has no run()" };
  }

  const processedTokens = new Set();
  globalThis.addEventListener("message", (event) => {
    if (event.origin !== location.origin) return;
    const validated = validateStartMessage(event.data);
    if (!validated.ok) return;
    const { token, iterations, targets } = validated;
    if (processedTokens.has(token)) return; // parent retries until we ack
    processedTokens.add(token);
    const config = event.data.config ?? {};

    run.run({
      iterations,
      targets,
      onProgress: ({ target, iteration, total }) => {
        event.source?.postMessage(
          { type: "wvj-benchmark-progress", token, target, iteration, total },
          event.origin,
        );
      },
      config,
    }).then((result) => {
      const check = validateResultMessage({
        type: "wvj-benchmark-result",
        token,
        perTarget: result.perTarget,
      });
      if (!check.ok) {
        throw new Error(
          `host produced an invalid result shape: ${check.reason} perTarget=${JSON.stringify(Object.keys(result.perTarget ?? {}))}`,
        );
      }
      event.source?.postMessage(
        { type: "wvj-benchmark-result", token, ...result },
        event.origin,
      );
    }).catch((error) => {
      event.source?.postMessage(
        {
          type: "wvj-benchmark-error",
          token,
          message: error instanceof Error ? error.message : String(error),
        },
        event.origin,
      );
    });
  });

  return { registered: true, hostPath };
}

// Auto-register when loaded as a module on a DOM page.
if (typeof globalThis !== "undefined" && document?.body?.dataset?.domHost) {
  registerIframeHost().catch((error) => {
    globalThis.parent?.postMessage(
      { type: "wvj-benchmark-error", token: "__load__", message: String(error) },
      location.origin,
    );
  });
}

// ── Parent side: run a DOM workload inside an iframe ───────────────────────

// Creates a hidden same-origin iframe for the workload page, posts the start
// message, and resolves with the child's result (or rejects on error/timeout).
export function runIframeDomBenchmark({
  route,
  iterations = 30,
  targets = ["js", "wasm"],
  timeoutMs = 240000,
  onProgress = () => {},
}) {
  return new Promise((resolve, reject) => {
    const token = crypto.randomUUID();
    let startRetry = null;
    const iframe = document.createElement("iframe");
    iframe.src = route;
    iframe.setAttribute("aria-hidden", "true");
    iframe.style.display = "none"; // CSSOM property assignment — CSP-safe
    iframe.setAttribute("data-wvj-bridge", "1");
    iframe.addEventListener("load", () => {
      const targetWindow = iframe.contentWindow;
      if (!targetWindow) {
        cleanup();
        reject(new Error("iframe contentWindow unavailable"));
        return;
      }
      const postStart = () => {
        targetWindow.postMessage(
          { type: "wvj-benchmark-start", token, iterations, targets, config: {} },
          location.origin,
        );
      };
      postStart();
      // The child registers its host asynchronously (load + hash-verify +
      // wasm compile) — the first start message may arrive before the child's
      // listener exists. Retry until the child acks (progress/result/error)
      // or the run times out. The child dedupes by token.
      startRetry = setInterval(postStart, 750);
    });

    const timer = setTimeout(() => {
      cleanup();
      reject(new Error(`iframe benchmark timed out after ${timeoutMs} ms`));
    }, timeoutMs);

    const onMessage = (event) => {
      if (event.origin !== location.origin) return;
      const data = event.data;
      if (!data) return;
      // Child errors are fatal regardless of token (load failures use
      // token "__load__"; run failures carry the run token). Surfacing them
      // turns silent hangs into honest, visible failures.
      if (data.type === "wvj-benchmark-error") {
        cleanup();
        reject(new Error(data.message || "iframe benchmark failed"));
        return;
      }
      if (data.token !== token) return;
      if (data.type === "wvj-benchmark-progress") {
        onProgress(data);
        return;
      }
      if (data.type === "wvj-benchmark-result") {
        const validated = validateResultMessage(data);
        if (!validated.ok) {
          cleanup();
          reject(new Error(`invalid result message: ${validated.reason}`));
          return;
        }
        cleanup();
        resolve(data);
        return;
      }
    };
    globalThis.addEventListener("message", onMessage);

    function cleanup() {
      clearTimeout(timer);
      if (startRetry) clearInterval(startRetry);
      globalThis.removeEventListener("message", onMessage);
      iframe.remove();
    }

    document.body.append(iframe);
  });
}
