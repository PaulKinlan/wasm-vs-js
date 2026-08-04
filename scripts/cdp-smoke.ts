// CDP smoke test for the wasm-vs-js site. FRESH browser profile (fresh cache is
// the whole point: it must catch stale-worker/contract bugs warm-cache
// verification misses). Runs against a configurable base URL (default the live
// site; pass --base=http://127.0.0.1:PORT to run against a local server, which
// this script then starts itself via `deno task public`).
//
// Checks:
//   1. homepage evidence summary renders (Playground Demos 38 / Run Unattended 37)
//   2. every playground card demo route returns 200
//   3. three representative cards run to "✓ Complete" with zero console errors
//      (fast: sum-u32 · wasm-heavy: graphics-cpu-path-tracer-v1 · bespoke worker:
//      network-pcap-decode-v1 — each with graceful fallback to an equivalent slug)
//
// Output is one parseable PASS/FAIL line per check. Exit 0 = all pass, 1 = any
// check failed, 2 = launch/timeout failure.
//
// Run:
//   deno run --allow-read=/home/paulkinlan/wasm-vs-js/lib,.,/usr/bin \
//     --allow-run=/usr/bin/chromium,deno --allow-write=/tmp --allow-net \
//     /tmp/cdp-smoke.ts [--base=https://wasm-vs-js.paulkinlan-ea.deno.net]

import { CdpClient } from "../lib/cdp-client.ts";

const LIVE_BASE = "https://wasm-vs-js.paulkinlan-ea.deno.net";
const REPO = new URL("..", import.meta.url).pathname;
const CHROME = "/usr/bin/chromium";

const baseArg = Deno.args.find((a) => a.startsWith("--base="));
const BASE = (baseArg ? baseArg.slice("--base=".length) : Deno.env.get("SMOKE_BASE") ?? LIVE_BASE)
  .replace(/\/+$/, "");
const LOCAL = /^https?:\/\/(127\.0\.0\.1|localhost):/.test(BASE);

// --- parseable reporting ----------------------------------------------------
const results: { check: string; ok: boolean; detail: string }[] = [];
function report(check: string, ok: boolean, detail: string) {
  results.push({ check, ok, detail });
  console.log(`${ok ? "PASS" : "FAIL"} ${check} ${detail}`);
}
function fail(message: string): never {
  throw new Error(message);
}
async function waitFor(
  fn: () => Promise<boolean>,
  timeoutMs: number,
  label: string,
): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (await fn()) return;
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  fail(`timeout waiting for ${label}`);
}

// --- owned server (local mode only) -----------------------------------------
let server: Deno.ChildProcess | undefined;
let realBase = BASE;
if (LOCAL) {
  const probe = Deno.listen({ hostname: "127.0.0.1", port: 0 });
  const port = (probe.addr as Deno.NetAddr).port;
  probe.close();
  server = new Deno.Command(Deno.execPath(), {
    args: ["task", "public"],
    cwd: REPO,
    env: { PORT: String(port), HOST: "127.0.0.1" },
    stdout: "piped",
    stderr: "piped",
  }).spawn();
  realBase = BASE.replace(/:\d+$/, "") + ":" + port;
}

// --- owned browser (fresh profile) ------------------------------------------
const profile = await Deno.makeTempDir({ prefix: "cdp-smoke-" });
const launchArguments = [
  "--headless=new",
  "--remote-debugging-port=0",
  `--user-data-dir=${profile}`,
  "--no-first-run",
  "--no-default-browser-check",
  "--disable-sync",
  "--disable-crash-reporter",
  "--disable-breakpad",
  "--window-size=1280,900",
  "about:blank",
];
const browser = new Deno.Command(CHROME, {
  args: launchArguments,
  stdout: "piped",
  stderr: "piped",
}).spawn();

let cdp: CdpClient | undefined;
let stderrPump: Promise<void> | undefined;

try {
  await waitFor(
    async () => {
      try {
        return (await fetch(`${realBase}/healthz`)).status === 200;
      } catch {
        return false;
      }
    },
    20_000,
    "target server",
  );

  let wsUrl = "";
  const stderrReader = browser.stderr.getReader();
  stderrPump = (async () => {
    let buffer = "";
    while (true) {
      const { value, done } = await stderrReader.read();
      if (done) break;
      buffer += new TextDecoder().decode(value);
      const match = buffer.match(/DevTools listening on (ws:\/\/\S+)/);
      if (match) wsUrl = match[1];
    }
  })();
  await waitFor(() => Promise.resolve(wsUrl !== ""), 20_000, "DevTools WebSocket URL");
  cdp = new CdpClient(wsUrl);
  await cdp.ready();

  const { targetId } = await cdp.send("Target.createTarget", { url: "about:blank" }) as {
    targetId: string;
  };
  const { sessionId } = await cdp.send("Target.attachToTarget", { targetId, flatten: true }) as {
    sessionId: string;
  };
  const send = (method: string, params: Record<string, unknown> = {}, timeoutMs = 60_000) =>
    cdp!.send(method, params, sessionId, timeoutMs);

  await send("Page.enable");
  await send("Runtime.enable");
  await send("Network.enable");
  await send("Log.enable");

  const consoleErrors: string[] = [];
  cdp.on("Runtime.consoleAPICalled", (params) => {
    if (params.type !== "error") return;
    const text = (params.args as Record<string, unknown>[])
      .map((arg) => String(arg.value ?? arg.description ?? "")).join(" ");
    consoleErrors.push(text);
  });
  cdp.on("Log.entryAdded", (params) => {
    const entry = params.entry as Record<string, unknown>;
    if (entry.level === "error") consoleErrors.push(String(entry.text ?? "log entry"));
  });

  const evaluate = async (expression: string): Promise<unknown> => {
    const result = await send("Runtime.evaluate", {
      expression,
      returnByValue: true,
      awaitPromise: true,
    });
    if (result.exceptionDetails) {
      fail(`page evaluation failed: ${JSON.stringify(result.exceptionDetails).slice(0, 300)}`);
    }
    return (result.result as Record<string, unknown>).value;
  };

  const click = async (selector: string) => {
    const box = await evaluate(`(() => {
      const el = document.querySelector(${JSON.stringify(selector)});
      if (!el) return null;
      el.scrollIntoView({ block: "center" });
      const rect = el.getBoundingClientRect();
      return { x: rect.x + rect.width / 2, y: rect.y + rect.height / 2 };
    })()`) as { x: number; y: number } | null;
    if (!box) fail(`control ${selector} not found`);
    for (const type of ["mousePressed", "mouseReleased"]) {
      await send("Input.dispatchMouseEvent", {
        type,
        x: box.x,
        y: box.y,
        button: "left",
        clickCount: 1,
      });
    }
  };

  // --- check 1: homepage evidence summary ------------------------------------
  await send("Page.navigate", { url: `${realBase}/` });
  await waitFor(
    async () => (await evaluate(`document.readyState`)) === "complete",
    20_000,
    "homepage load",
  );
  await waitFor(
    async () => {
      const n = await evaluate(`document.querySelectorAll(".playground-card").length`);
      return typeof n === "number" && n > 0;
    },
    20_000,
    "playground cards render",
  );
  const summary = await evaluate(`(() => {
    const dd = (label) => {
      const dt = [...document.querySelectorAll("dt")].find((e) => e.textContent.trim() === label);
      return dt ? dt.nextElementSibling?.textContent.trim() : null;
    };
    return { demos: dd("Playground Demos"), unattended: dd("Run Unattended"), catalog: dd("Catalog Workloads"), v2: dd("v2 Proposals") };
  })()`) as Record<string, string | null>;
  const summaryOk = summary.demos === "38" && summary.unattended === "37" &&
    summary.catalog === "38" && summary.v2 === "20";
  report(
    "homepage-evidence-summary",
    summaryOk,
    `demos=${summary.demos} unattended=${summary.unattended} catalog=${summary.catalog} v2=${summary.v2} (expect 38/37/38/20)`,
  );

  // --- check 2: every card demo route returns 200 -----------------------------
  const routeResult = await evaluate(`(async () => {
    const hrefs = [...document.querySelectorAll("a.btn-pg-link")].map((a) => a.getAttribute("href"));
    const unique = [...new Set(hrefs)].filter(Boolean);
    const bad = [];
    for (const href of unique) {
      try {
        const res = await fetch(href, { method: "GET", redirect: "follow", cache: "no-store" });
        if (res.status !== 200) bad.push(href + " -> " + res.status);
      } catch (e) {
        bad.push(href + " -> " + String(e));
      }
    }
    return { total: unique.length, bad };
  })()`) as { total: number; bad: string[] };
  report(
    "card-routes-200",
    routeResult.bad.length === 0,
    `${routeResult.total - routeResult.bad.length}/${routeResult.total} ok${
      routeResult.bad.length ? " BAD: " + routeResult.bad.slice(0, 6).join(", ") : ""
    }`,
  );

  // --- check 3: three representative cards run to Complete --------------------
  const CARD_PICKER = `(async () => {
    const slugs = [...document.querySelectorAll(".playground-card[data-slug]")].map((el) => el.getAttribute("data-slug"));
    const pick = (preferred) => preferred.find((s) => slugs.includes(s)) ?? slugs[0];
    return {
      fast: pick(["sum-u32", "audio-fft", "serialization-json-telemetry-v1"]),
      heavy: pick(["graphics-cpu-path-tracer-v1", "base-gltf-viewer", "ml-numeric-kernels-v1"]),
      bespoke: pick(["network-pcap-decode-v1", "database-sqlite-notebook-v1", "base-audio-webaudio-effects-v1"]),
      all: slugs,
    };
  })()`;
  const picked = await evaluate(CARD_PICKER) as {
    fast: string;
    heavy: string;
    bespoke: string;
    all: string[];
  };
  // 1 iteration: cold-start only, keeps the smoke under 90s.
  await evaluate(`(() => {
    const sel = document.getElementById("pg-iterations");
    if (sel) sel.value = "1";
    return true;
  })()`);

  for (
    const [label, slug] of [
      ["fast", picked.fast],
      ["wasm-heavy", picked.heavy],
      ["bespoke-worker", picked.bespoke],
    ] as [string, string][]
  ) {
    if (!slug) {
      report(`card-run-${label}`, false, "no card slug available");
      continue;
    }
    const errorsBefore = consoleErrors.length;
    const cardSel = `.playground-card[data-slug="${slug}"]`;
    await click(`${cardSel} .btn-pg-run`);
    let ok = false;
    let finalStatus = "";
    try {
      await waitFor(
        async () => {
          const status = await evaluate(
            `document.querySelector(${
              JSON.stringify(cardSel + " .playground-status")
            })?.textContent ?? ""`,
          );
          if (typeof status !== "string") return false;
          finalStatus = status;
          if (status.startsWith("✕") || status.includes("Error")) return true;
          return status.includes("Complete");
        },
        55_000,
        `${label} card (${slug}) complete`,
      );
      ok = finalStatus.includes("Complete");
    } catch {
      ok = false;
    }
    const newErrors = consoleErrors.slice(errorsBefore);
    const clean = newErrors.length === 0;
    report(
      `card-run-${label}`,
      ok && clean,
      `${slug} status="${finalStatus.trim()}" consoleErrors=${newErrors.length}${
        newErrors.length ? " [" + newErrors.join(" | ").slice(0, 160) + "]" : ""
      }`,
    );
  }

  // --- final verdict ----------------------------------------------------------
  const allOk = results.every((r) => r.ok);
  console.log(allOk ? "SMOKE OK" : `SMOKE FAILED (${results.filter((r) => !r.ok).length} checks)`);
  Deno.exit(allOk ? 0 : 1);
} finally {
  try {
    await cdp?.send("Browser.close", {}, undefined, 5_000);
  } catch { /* closing */ }
  try {
    cdp?.close();
  } catch { /* closed */ }
  const browserStatus = await Promise.race([
    browser.status,
    new Promise((resolve) => setTimeout(() => resolve("timeout"), 10_000)),
  ]);
  if (browserStatus === "timeout") {
    browser.kill("SIGTERM");
    await browser.status;
  }
  await stderrPump?.catch(() => {});
  try {
    server?.kill("SIGTERM");
  } catch { /* exited */ }
  await server?.status.catch(() => {});
  await Deno.remove(profile, { recursive: true }).catch(() => {});
}
