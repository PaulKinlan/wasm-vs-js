// Full validation harness: every benchmark page, click Run, capture the
// primary JS/Wasm + every multilang variant + the real-DOM stage + a run log.
import { CdpClient } from "../lib/cdp-client.ts";

const LIVE = Deno.env.get("AUDIT_BASE") ?? "https://wasm-vs-js.paulkinlan-ea.deno.net";
const CHROME = "/usr/bin/chromium";
const OUT = "public/data/benchmark-validation-logs.v1.json";

async function waitFor(fn: () => Promise<boolean>, t: number, l: string) {
  const d = Date.now() + t;
  while (Date.now() < d) {
    if (await fn()) return;
    await new Promise((r) => setTimeout(r, 250));
  }
  throw new Error(`timeout ${l}`);
}

const profile = await Deno.makeTempDir({ prefix: "cdp-audit-" });
const browser = new Deno.Command(CHROME, {
  args: [
    "--headless=new",
    "--remote-debugging-port=0",
    `--user-data-dir=${profile}`,
    "--no-first-run",
    "--no-default-browser-check",
    "--disable-sync",
    "--disable-crash-reporter",
    "--disable-breakpad",
    "--window-size=1440,2400",
    "--hide-scrollbars",
    "about:blank",
  ],
  stdout: "piped",
  stderr: "piped",
}).spawn();
let wsUrl = "";
const reader = browser.stderr.getReader();
(async () => {
  const d = new TextDecoder();
  for (;;) {
    const { value, done } = await reader.read();
    if (done) break;
    const m = d.decode(value, { stream: true }).match(/DevTools listening on (ws:\/\/[^\s]+)/);
    if (m) wsUrl = m[1];
  }
})();
await waitFor(() => Promise.resolve(wsUrl !== ""), 20000, "ws");
const cdp = new CdpClient(wsUrl);
const { targetId } = await cdp.send("Target.createTarget", { url: "about:blank" }) as {
  targetId: string;
};
const { sessionId } = await cdp.send("Target.attachToTarget", { targetId, flatten: true }) as {
  sessionId: string;
};
const send = (m: string, p: Record<string, unknown> = {}) => cdp.send(m, p, sessionId, 90000);
await send("Page.enable");
await send("Runtime.enable");
await send("Network.enable");

const pages = [
  "archive-zip-workspace-v1",
  "audio-fft",
  "audio-fir",
  "audio-stft",
  "base-dom-todomvc-journey",
  "base-gltf-viewer",
  "base/network-http2-quic-state",
  "base/text.regex-log-scan.v1",
  "cad-mesh-repair-v1",
  "cad-parametric-bracket",
  "crypto-authenticated-stream",
  "crypto.file-integrity.v1",
  "database-olap-chart",
  "database-sqlite-notebook-v1",
  "document-pdf-viewer-v1",
  "dom-dependent-form-validation",
  "dom-grid-movement",
  "dom-keyed-list-mutation",
  "dom-nested-tree-mutation",
  "dom-table-sort-filter-pagination",
  "dom-virtualized-grid-v1",
  "dom-virtualized-scrolling",
  "game-canvas-arcade",
  "game-canvas-entity-pathfinding",
  "game-dom-tactics-grid",
  "game-ecs-frame-update",
  "graphics-cpu-path-tracer-v1",
  "image-editing-demo",
  "image-flood-fill-demo",
  "ml-dense-mlp",
  "ml-gemm",
  "ml-keyword-spotting-v1",
  "ml-numeric-kernels-v1",
  "multilang-wasm",
  "network.pcap-decode.v1",
  "numeric-fft-spectral-filter-v1",
  "numeric.polybench-panel.v1",
  "regex-automata-duel-demo",
  "serialization-protobuf-gateway",
  "serialization.json-telemetry.v1",
  "server.ssr-template.v1",
  "simulation-nbody-cloth",
  "simulation-rigid-body-2d-v1",
  "sum-u32",
  "text.diff-patch.v1",
  "text.gc-document-edit.v1",
  "text.markdown-cms.v1",
  "tooling-c-to-wasm-compile-v1",
  "vdom-diff-patch-demo",
];

const logs: Record<string, unknown> = {
  generatedAt: new Date().toISOString(),
  base: LIVE,
  pages: {},
};

for (const slug of pages) {
  const log: Record<string, unknown> = {
    slug,
    status: "",
    consoleErrors: 0,
    network404s: [] as string[],
    stages: {} as Record<string, Record<string, unknown>>,
  };
  const failed: string[] = [];
  const consoleErrors: string[] = [];
  cdp.on("Network.responseReceived", (p) => {
    const r = p.response as Record<string, unknown>;
    if (r.status === 404) failed.push(String(r.url).replace(LIVE, ""));
  });
  cdp.on("Log.entryAdded", (p) => {
    const e = p.entry as Record<string, unknown>;
    if (e.level === "error") consoleErrors.push(String(e.text ?? ""));
  });
  try {
    await send("Page.navigate", { url: `${LIVE}/benchmarks/${slug}/` });
    await new Promise((r) => setTimeout(r, 4500));
    const clicked = await send("Runtime.evaluate", {
      expression:
        `(() => { const b = document.getElementById('start') ?? document.querySelector('button[type=submit]'); if (b && !b.disabled) { b.click(); return true; } return false; })()`,
      returnByValue: true,
    });
    log.runClicked = (clicked as { result?: { value?: boolean } }).result?.value ?? false;
    const t0 = Date.now();
    while (Date.now() - t0 < 120000) {
      const r = await send("Runtime.evaluate", {
        expression: `document.getElementById('status')?.textContent ?? ""`,
        returnByValue: true,
      });
      const status = (r as { result?: { value?: string } }).result?.value ?? "";
      if (
        status.includes("✓ Full") || status.includes("unavailable") || status.startsWith("Error")
      ) break;
      await new Promise((r2) => setTimeout(r2, 800));
    }
    // Capture every stage + its table
    const stages = await send("Runtime.evaluate", {
      expression: `[...document.querySelectorAll('[data-stage]')].map(s => ({
        stage: s.dataset.stage,
        heading: s.querySelector('h3')?.textContent ?? "",
        rows: [...(s.querySelectorAll('tbody tr') ?? [])].map(tr => [...tr.querySelectorAll('td')].map(td => td.textContent.trim()).slice(0, 6)),
        notice: s.querySelector('.notice')?.textContent?.slice(0, 200) ?? "",
      }))`,
      returnByValue: true,
    });
    const stageList = (stages as { result?: { value?: unknown } }).result?.value as Array<
      Record<string, unknown>
    > ?? [];
    for (const st of stageList) {
      const key = String(st.stage);
      (log.stages as Record<string, Record<string, unknown>>)[key] = {
        heading: st.heading,
        rows: st.rows,
        notice: st.notice,
      };
    }
    // Real-DOM: the visible iframe + rendered UI after the run
    const dom = await send("Runtime.evaluate", {
      expression:
        `(() => { const f = document.querySelector('iframe[data-wvj-bridge]'); if (!f?.contentDocument) return null; const d = f.contentDocument; return { visible: getComputedStyle(f).display, items: d.querySelectorAll('#wvj-todo-list li').length, completed: d.querySelectorAll('#wvj-todo-list li.completed').length, host: !!d.getElementById('wvj-todomvc-host') }; })()`,
      returnByValue: true,
    });
    if ((dom as { result?: { value?: unknown } }).result?.value) {
      (log.stages as Record<string, Record<string, unknown>>)["real-dom-iframe-state"] =
        (dom as { result?: { value?: unknown } }).result?.value as Record<string, unknown>;
    }
    const statusR = await send("Runtime.evaluate", {
      expression: `document.getElementById('status')?.textContent ?? ""`,
      returnByValue: true,
    });
    log.status = (statusR as { result?: { value?: string } }).result?.value ?? "";
    log.consoleErrors = consoleErrors.length;
    log.network404s = [...new Set(failed)];
  } catch (err) {
    log.status = `ERROR: ${err instanceof Error ? err.message : String(err)}`;
  }
  (logs.pages as Record<string, unknown>)[slug] = log;
  console.log(
    slug,
    "->",
    String(log.status ?? "").slice(0, 60),
    "| 404s:",
    (log.network404s as string[]).length,
    "| console:",
    log.consoleErrors,
  );
}

await Deno.writeTextFile(OUT, JSON.stringify(logs, null, 2));
console.log("LOGS WRITTEN:", OUT);
try {
  await cdp.close();
} catch {
  // ignore close errors
}
browser.kill();
try {
  Deno.removeSync(profile, { recursive: true });
} catch {}
