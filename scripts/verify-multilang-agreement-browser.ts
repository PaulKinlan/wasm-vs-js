// Drives the multi-language pages in a real browser and requires every
// declared engine to run.
//
// The adapters now call requireEngineAgreement() in build(), which throws
// before anything is timed if the engines disagree. A page that reaches its
// results table has therefore proved its engines compute the same bytes — so
// this script's job is to make each page actually get there, in a browser,
// with the real modules, and to fail on a console error or a missing engine
// row. Static tests cannot establish that: the adapters only run here.
//
// Usage:
//   deno run -A scripts/verify-multilang-agreement-browser.ts [--pages=a,b]

import { CdpClient } from "../lib/cdp-client.ts";

const REPO = new URL("..", import.meta.url).pathname;

const DEFAULT_PAGES = [
  "audio-fft",
  "audio-fir",
  "audio-stft",
  "ml-gemm",
  "ml-dense-mlp",
  "graphics-cpu-path-tracer-v1",
];

const pagesArg = Deno.args.find((a) => a.startsWith("--pages="));
const PAGES = pagesArg ? pagesArg.slice("--pages=".length).split(",") : DEFAULT_PAGES;

function findChrome(): string {
  const env = Deno.env.get("CHROME_BIN");
  if (env) return env;
  for (
    const c of ["/usr/bin/chromium", "/usr/bin/google-chrome", "/usr/bin/google-chrome-stable"]
  ) {
    try {
      if (Deno.statSync(c).isFile) return c;
    } catch { /* next */ }
  }
  return "/usr/bin/chromium";
}

async function waitFor(fn: () => Promise<boolean>, timeoutMs: number, label: string) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (await fn()) return;
    await new Promise((r) => setTimeout(r, 250));
  }
  throw new Error(`timeout waiting for ${label}`);
}

const results: Array<{ page: string; ok: boolean; detail: string }> = [];
const errorsBySession = new Map<string, string[]>();

// --- owned server -----------------------------------------------------------
const probe = Deno.listen({ hostname: "127.0.0.1", port: 0 });
const port = (probe.addr as Deno.NetAddr).port;
probe.close();
const server = new Deno.Command(Deno.execPath(), {
  args: ["task", "public"],
  cwd: REPO,
  env: { PORT: String(port), HOST: "127.0.0.1" },
  stdout: "piped",
  stderr: "piped",
}).spawn();
const base = `http://127.0.0.1:${port}`;

// --- owned browser ----------------------------------------------------------
const profile = await Deno.makeTempDir({ prefix: "ml-agree-" });
const browser = new Deno.Command(findChrome(), {
  args: [
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
  ],
  stdout: "piped",
  stderr: "piped",
}).spawn();

let cdp: CdpClient | undefined;
try {
  await waitFor(
    async () => {
      try {
        return (await fetch(`${base}/healthz`)).status === 200;
      } catch {
        return false;
      }
    },
    25_000,
    "server",
  );

  let wsUrl = "";
  const reader = browser.stderr.getReader();
  (async () => {
    let buffer = "";
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      buffer += new TextDecoder().decode(value);
      const m = buffer.match(/DevTools listening on (ws:\/\/\S+)/);
      if (m) wsUrl = m[1];
    }
  })();
  await waitFor(() => Promise.resolve(wsUrl !== ""), 25_000, "DevTools socket");
  cdp = new CdpClient(wsUrl);
  await cdp.ready();

  // CdpClient has no off(), so console errors are collected once and bucketed
  // by session rather than by re-registering a listener per page.
  cdp.on("Runtime.consoleAPICalled", (params, sid) => {
    if (!sid || params.type !== "error") return;
    const bucket = errorsBySession.get(sid);
    if (!bucket) return;
    bucket.push(
      (params.args as Record<string, unknown>[])
        .map((a) => String(a.value ?? a.description ?? "")).join(" "),
    );
  });

  for (const page of PAGES) {
    const { targetId } = await cdp.send("Target.createTarget", { url: "about:blank" }) as {
      targetId: string;
    };
    const { sessionId } = await cdp.send("Target.attachToTarget", {
      targetId,
      flatten: true,
    }) as { sessionId: string };
    const send = (m: string, p: Record<string, unknown> = {}, t = 180_000) =>
      cdp!.send(m, p, sessionId, t);

    const errors = errorsBySession.get(sessionId) ?? [];
    errorsBySession.set(sessionId, errors);

    try {
      await send("Page.enable");
      await send("Runtime.enable");
      await send("Log.enable");
      await send("Page.navigate", { url: `${base}/benchmarks/${page}/` });

      const evaluate = async (expression: string): Promise<unknown> => {
        const result = await send("Runtime.evaluate", {
          expression,
          returnByValue: true,
          awaitPromise: true,
        });
        if (result.exceptionDetails) {
          throw new Error(
            `evaluation failed: ${JSON.stringify(result.exceptionDetails).slice(0, 400)}`,
          );
        }
        return (result.result as Record<string, unknown>).value;
      };

      await waitFor(
        async () => Boolean(await evaluate(`Boolean(document.querySelector("#ml-start"))`)),
        60_000,
        `${page}: multi-language start control`,
      );

      // One iteration: this is a correctness gate, not a measurement.
      await evaluate(`
        (() => {
          const iterations = document.querySelector("#ml-iterations");
          if (iterations) iterations.value = "1";
          document.querySelector("#ml-start").click();
          return true;
        })()
      `);

      await waitFor(
        async () => {
          const status = await evaluate(
            `(document.querySelector("#ml-status")?.textContent ?? "")`,
          ) as string;
          return /complete|done|finished|error|failed/i.test(status);
        },
        180_000,
        `${page}: run to finish`,
      );

      const status = await evaluate(
        `(document.querySelector("#ml-status")?.textContent ?? "").trim()`,
      ) as string;
      const engines = await evaluate(`
        (() => {
          const rows = [...document.querySelectorAll("table tbody tr")];
          return rows.map((r) => (r.cells[0]?.textContent ?? "").trim()).filter(Boolean);
        })()
      `) as string[];

      const failed = /error|failed/i.test(status);
      const detail = `status="${status.slice(0, 120)}" engines=${engines.length}` +
        (errors.length ? ` consoleErrors=${errors.length}: ${errors[0].slice(0, 160)}` : "");
      const ok = !failed && errors.length === 0 && engines.length > 0;
      results.push({ page, ok, detail });
      console.log(`${ok ? "PASS" : "FAIL"} ${page} ${detail}`);
    } catch (error) {
      results.push({ page, ok: false, detail: (error as Error).message.slice(0, 300) });
      console.log(`FAIL ${page} ${(error as Error).message.slice(0, 300)}`);
    } finally {
      await cdp.send("Target.closeTarget", { targetId }).catch(() => {});
    }
  }
} finally {
  try {
    cdp?.close();
  } catch { /* closing */ }
  try {
    browser.kill("SIGKILL");
    await browser.status;
  } catch { /* gone */ }
  try {
    server.kill("SIGKILL");
    await server.status;
  } catch { /* gone */ }
  await Deno.remove(profile, { recursive: true }).catch(() => {});
}

const failures = results.filter((r) => !r.ok);
console.log(`\n${results.length - failures.length}/${results.length} pages ran every engine`);
Deno.exit(failures.length === 0 ? 0 : 1);
