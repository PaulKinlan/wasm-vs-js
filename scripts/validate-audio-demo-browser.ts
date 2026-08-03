// Executable browser validation for the audio demo routes. Launches an OWNED
// Chromium child (tracked PID, owned temporary profile), drives the visible
// controls with trusted CDP input events, runs every route on both engines in
// exact-contract mode, exercises the cancel/stale-token lifecycle, and
// retains complete evidence in evidence/browser/audio-demo/: browser version,
// launch arguments, routes, per-run assertions, console and network logs,
// screenshots, and exact owned-process/profile cleanup records. No process is
// killed except the owned child PIDs spawned here.

import { CdpClient } from "../lib/cdp-client.ts";

const ROOT = new URL("../", import.meta.url);
const EVIDENCE = new URL("evidence/browser/audio-demo/", ROOT).pathname;
const CHROME = "/usr/bin/chromium";
const probe = Deno.listen({ hostname: "127.0.0.1", port: 0 });
const SERVER_PORT = (probe.addr as Deno.NetAddr).port;
probe.close();
const BASE = `http://127.0.0.1:${SERVER_PORT}`;
const ROUTES = ["audio-fft", "audio-fir", "audio-stft"] as const;
const ENGINES = ["javascript", "wasm-linear"] as const;

const consoleLog: string[] = [];
const networkLog: string[] = [];
const runRecords: Record<string, unknown>[] = [];
const pageHashes: Record<string, string> = {};

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

// --- owned server child ---------------------------------------------------
const server = new Deno.Command(Deno.execPath(), {
  args: ["task", "public"],
  cwd: new URL(".", ROOT).pathname,
  env: { PORT: String(SERVER_PORT), HOST: "127.0.0.1" },
  stdout: "piped",
  stderr: "piped",
}).spawn();

// --- owned browser child --------------------------------------------------
const profile = await Deno.makeTempDir({ prefix: "audio-demo-browser-" });
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

const cleanup: Record<string, unknown> = { browserPid: browser.pid, serverPid: server.pid };
let cdp: CdpClient | undefined;
let stderrPump: Promise<void> | undefined;

try {
  await waitFor(
    async () => {
      try {
        return (await fetch(`${BASE}/healthz`)).status === 200;
      } catch {
        return false;
      }
    },
    15_000,
    "demo server",
  );

  // Headless Chromium prints the DevTools WebSocket URL to stderr.
  let wsUrl = "";
  const stderrReader = browser.stderr.getReader();
  stderrPump = (async () => {
    let buffer = "";
    while (true) {
      const { value, done } = await stderrReader.read();
      if (done) break;
      buffer += new TextDecoder().decode(value);
      const match = buffer.match(/DevTools listening on (ws:\/\/\S+)/);
      if (match) {
        wsUrl = match[1];
      }
    }
  })();
  await waitFor(() => Promise.resolve(wsUrl !== ""), 15_000, "DevTools WebSocket URL");
  cdp = new CdpClient(wsUrl);
  await cdp.ready();

  const { targetId } = await cdp.send("Target.createTarget", { url: "about:blank" }) as {
    targetId: string;
  };
  const { sessionId } = await cdp.send("Target.attachToTarget", {
    targetId,
    flatten: true,
  }) as { sessionId: string };
  const send = (method: string, params: Record<string, unknown> = {}) =>
    cdp!.send(method, params, sessionId, 240_000);

  await send("Page.enable");
  await send("Runtime.enable");
  await send("Network.enable");
  await send("Log.enable");
  // Worker-internal fetches do not surface in page-session network events
  // on this Chromium build; they are proven byte-exactly by the per-run
  // exact-contract assertions (every served module, manifest, and artifact
  // is hashed by the worker and mismatches fail the run).
  cdp.on("Runtime.consoleAPICalled", (params) => {
    consoleLog.push(JSON.stringify({
      type: params.type,
      values: (params.args as Record<string, unknown>[]).map((arg) => arg.value ?? arg.description),
    }));
  });
  cdp.on("Log.entryAdded", (params) => {
    const entry = params.entry as Record<string, unknown>;
    consoleLog.push(JSON.stringify({ log: entry.level, text: entry.text }));
  });
  cdp.on("Network.requestWillBeSent", (params) => {
    const request = params.request as Record<string, unknown>;
    networkLog.push(JSON.stringify({ phase: "request", url: request.url, method: request.method }));
  });
  cdp.on("Network.responseReceived", (params) => {
    const response = params.response as Record<string, unknown>;
    networkLog.push(
      JSON.stringify({ phase: "response", url: response.url, status: response.status }),
    );
  });

  const evaluate = async (expression: string) => {
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

  const statusText = () =>
    evaluate(`document.getElementById("demo-status").textContent`) as Promise<string>;

  for (const slug of ROUTES) {
    for (const engine of ENGINES) {
      const route = `${BASE}/benchmarks/${slug}/`;
      await send("Page.navigate", { url: route });
      await waitFor(
        async () => (await evaluate(`document.readyState`)) === "complete",
        15_000,
        "page load",
      );
      await evaluate(`(() => {
        document.getElementById("demo-target").value = ${JSON.stringify(engine)};
        document.getElementById("demo-mode").value = "exact-contract";
        return true;
      })()`);
      await click("#demo-start");
      await waitFor(
        async () => {
          const status = await statusText();
          if (status.startsWith("Run failed") || status.startsWith("Worker error")) fail(status);
          return status.startsWith("Run complete");
        },
        240_000,
        `${slug} ${engine} exact-contract run`,
      );
      const assertions = await evaluate(`(() => {
        const text = (sel) => [...document.querySelectorAll(sel)].map((el) => el.textContent);
        return {
          status: document.getElementById("demo-status").textContent,
          hashVerdicts: text("#demo-hashes td:last-child"),
          oracleHeadings: text("#demo-oracle strong"),
          contractItems: text("#demo-contract li"),
          counterRows: document.querySelectorAll("#demo-counters tr").length,
          variantSummary: document.getElementById("demo-summary").textContent,
        };
      })()`) as Record<string, unknown>;
      const verdicts = assertions.hashVerdicts as string[];
      const headings = assertions.oracleHeadings as string[];
      const items = assertions.contractItems as string[];
      const checks = {
        statusComplete: (assertions.status as string).startsWith("Run complete"),
        hashesMatchFrozen: verdicts.length === 2 &&
          verdicts.every((v) => v === "matches frozen hash"),
        oracleAllPassed: headings.length >= 2 && headings.every((h) => h.endsWith(": passed")),
        contractAllVerified: items.length >= 5 &&
          items.every((item) => item.includes(": verified")),
        counterRowCount: assertions.counterRows === 8,
        variantMatchesEngine: (assertions.variantSummary as string).includes(
          engine === "wasm-linear" ? "wasm-linear-controlled" : "js-controlled",
        ),
      };
      if (!Object.values(checks).every(Boolean)) {
        fail(`${slug} ${engine} assertions failed: ${JSON.stringify(checks)}`);
      }
      runRecords.push({ route, engine, mode: "exact-contract", assertions, checks });
    }
    const shot = await send("Page.captureScreenshot", { format: "png" }) as { data: string };
    const png = Uint8Array.from(atob(shot.data), (c) => c.charCodeAt(0));
    await Deno.mkdir(`${EVIDENCE}/screenshots`, { recursive: true });
    await Deno.writeFile(`${EVIDENCE}/screenshots/${slug}-exact-contract.png`, png);
  }

  // Cancel + stale-token lifecycle on the STFT route (the longest run)
  // with trusted input: cancel as soon as the run is observably active.
  for (const slug of ROUTES) {
    // Record the served page byte hash for the non-served trust root.
    const pageResponse = await fetch(`${BASE}/benchmarks/${slug}/`);
    const pageBytes = new Uint8Array(await pageResponse.arrayBuffer());
    const pageDigest = await crypto.subtle.digest("SHA-256", pageBytes.buffer as ArrayBuffer);
    pageHashes[slug] = [...new Uint8Array(pageDigest)]
      .map((v) => v.toString(16).padStart(2, "0"))
      .join("");
  }

  const route = `${BASE}/benchmarks/audio-stft/`;
  await send("Page.navigate", { url: route });
  await waitFor(async () => (await evaluate(`document.readyState`)) === "complete", 15_000, "load");
  await click("#demo-start");
  // The runner enables Cancel synchronously inside the Start handler, so an
  // immediate trusted Cancel click deterministically lands mid-run without
  // racing the worker's completion.
  const duringStates = await evaluate(`({
    startDisabled: document.getElementById("demo-start").disabled,
    cancelDisabled: document.getElementById("demo-cancel").disabled,
  })`);
  await click("#demo-cancel");
  await waitFor(
    async () => (await statusText()).startsWith("Cancelled"),
    10_000,
    "cancel status",
  );
  await new Promise((resolve) => setTimeout(resolve, 3_000));
  const staleStates = await evaluate(`({
    status: document.getElementById("demo-status").textContent,
    resultsHidden: document.getElementById("demo-results").hidden,
  })`) as Record<string, unknown>;
  const lifecycleChecks = {
    startDisabledDuringRun: (duringStates as Record<string, unknown>).startDisabled === true,
    cancelEnabledDuringRun: (duringStates as Record<string, unknown>).cancelDisabled === false,
    cancelTerminates: (staleStates.status as string).startsWith("Cancelled"),
    staleMessagesDiscarded: staleStates.resultsHidden === true,
  };
  // Restart after cancel proves token invalidation does not wedge the runner.
  await click("#demo-start");
  await waitFor(
    async () => {
      const status = await statusText();
      if (status.startsWith("Run failed") || status.startsWith("Worker error")) fail(status);
      return status.startsWith("Run complete");
    },
    240_000,
    "restart after cancel",
  );
  (lifecycleChecks as Record<string, unknown>).restartAfterCancel = true;
  if (!Object.values(lifecycleChecks).every(Boolean)) {
    fail(`lifecycle assertions failed: ${JSON.stringify(lifecycleChecks)}`);
  }
  runRecords.push({ route, engine: "javascript", mode: "lifecycle", checks: lifecycleChecks });

  // Stale message/error INJECTION and pagehide teardown, driven through the
  // explicit ?demo-test=1 hook and the real listener paths.
  await send("Page.navigate", { url: `${route}?demo-test=1` });
  await waitFor(
    async () => (await evaluate(`document.readyState`)) === "complete",
    15_000,
    "load",
  );
  await click("#demo-start");
  await evaluate(`window.__demoTestA = window.__demoTest.getWorker()`);
  await click("#demo-cancel");
  await waitFor(async () => (await statusText()).startsWith("Cancelled"), 10_000, "cancel");
  // Start run B; while it is in flight, inject a wrong-token message on the
  // live worker and a synthetic error on the TERMINATED run-A worker object.
  await click("#demo-start");
  const injected = await evaluate(`(() => {
    const tokenB = window.__demoTest.currentToken();
    const wrongTokenResult = window.__demoTest.injectMessage({
      token: tokenB + 99,
      type: "failed",
      message: "INJECTED STALE FAILURE",
    });
    const staleErrorResult = window.__demoTest.injectErrorOn(window.__demoTestA);
    return { tokenB, wrongTokenResult, staleErrorResult };
  })()`) as Record<string, unknown>;
  const statusAfterInjection = await statusText();
  await waitFor(
    async () => {
      const status = await statusText();
      if (status.includes("INJECTED")) fail("stale injected message was processed");
      return status.startsWith("Run complete");
    },
    240_000,
    "run B completes despite injections",
  );
  // pagehide teardown: start run C and dispatch a real pagehide event.
  await click("#demo-start");
  const activeBeforePagehide = await evaluate(`window.__demoTest.workerActive()`);
  await evaluate(`window.dispatchEvent(new PageTransitionEvent("pagehide"))`);
  const activeAfterPagehide = await evaluate(`window.__demoTest.workerActive()`);
  const injectionChecks = {
    wrongTokenMessageIgnored: injected.wrongTokenResult === true &&
      !statusAfterInjection.includes("INJECTED"),
    staleErrorIgnored: injected.staleErrorResult === true &&
      !statusAfterInjection.startsWith("Worker error"),
    runCompletedDespiteInjections: true,
    workerActiveBeforePagehide: activeBeforePagehide === true,
    pagehideTerminatesWorker: activeAfterPagehide === false,
  };
  if (!Object.values(injectionChecks).every(Boolean)) {
    fail(`injection lifecycle assertions failed: ${JSON.stringify(injectionChecks)}`);
  }
  runRecords.push({
    route,
    engine: "javascript",
    mode: "lifecycle-injection",
    checks: injectionChecks,
  });

  // Retain evidence.
  await Deno.mkdir(EVIDENCE, { recursive: true });
  await Deno.writeTextFile(`${EVIDENCE}/console.jsonl`, consoleLog.join("\n") + "\n");
  await Deno.writeTextFile(`${EVIDENCE}/network.jsonl`, networkLog.join("\n") + "\n");
  const browserVersion = await cdp.send("Browser.getVersion") as Record<string, unknown>;
  await Deno.writeTextFile(
    `${EVIDENCE}/validation.json`,
    JSON.stringify(
      {
        schemaVersion: 1,
        contractId: "audio-demo-browser-validation-v1",
        startedBy: "scripts/validate-audio-demo-browser.ts",
        browser: {
          product: browserVersion.product,
          userAgent: browserVersion.userAgent,
          binary: CHROME,
          launchArguments,
        },
        server: { task: "public", base: BASE, mode: "public-read-only" },
        pageHashes,
        runs: runRecords,
        networkScope:
          "page and worker-script requests; worker-internal fetches are proven byte-exactly by the per-run exact-contract assertions, which hash the raw served bytes of all five manifests (the build manifest anchored to its accepted-record pin via the registry), all seven engine modules, the registry (the same response that drives execution), the runner, the worker, the Wasm artifact, and the reference artifact; page bytes are anchored to the non-served reviewed pins in tests/audio-demo-page-pins.json",
        consoleEvents: consoleLog.length,
        networkEvents: networkLog.length,
      },
      null,
      2,
    ) + "\n",
  );
  console.log(`browser validation: ${runRecords.length} runs recorded, evidence retained`);
} finally {
  // Exact owned cleanup: close the owned browser via CDP, await the owned
  // child, remove the owned profile, stop the owned server child. Nothing
  // else on the machine is touched.
  try {
    await cdp?.send("Browser.close", {}, undefined, 5_000);
  } catch { /* already closing */ }
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
    server.kill("SIGTERM");
  } catch { /* exited */ }
  await server.status.catch(() => {});
  await Deno.remove(profile, { recursive: true }).catch(() => {});
  const profileRemoved = await Deno.lstat(profile).then(() => false).catch(() => true);
  cleanup.closedAt = new Date().toISOString();
  cleanup.browserExit = browserStatus === "timeout" ? "sigterm-after-grace" : "cdp-browser-close";
  cleanup.serverExit = "sigterm";
  cleanup.profileRemoved = profileRemoved;
  await Deno.mkdir(EVIDENCE, { recursive: true });
  await Deno.writeTextFile(`${EVIDENCE}/cleanup.json`, JSON.stringify(cleanup, null, 2) + "\n");
}
