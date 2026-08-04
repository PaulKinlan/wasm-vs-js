// M1 Chrome Pilot Collection Script.
// Launches owned Chrome, runs sum-u32 benchmark, collects evidence, stores run record.
//
// Usage: deno run --unstable-kv --allow-all scripts/collect-m1-chrome-pilot.ts \
//          --server-port=8787 --attempts=5 --stratum=cold

import { CdpClient } from "../lib/cdp-client.ts";

// ── Config ──

const CHROME_BIN =
  "/home/paulkinlan/.cache/puppeteer/chrome/linux-150.0.7871.24/chrome-linux64/chrome";
const SERVER_ORIGIN = "http://127.0.0.1";
const DEFAULT_PORT = 8787;
const MAX_ATTEMPTS = 60;
const SCREENSHOT_DIR = "raw/screenshots/m1-pilot";

const args = Object.fromEntries(
  Deno.args.filter((a) => a.startsWith("--")).map((a) => {
    const [k, v] = a.slice(2).split("=");
    return [k, v ?? ""];
  }),
);

const serverPort = Number(args["server-port"] ?? DEFAULT_PORT);
const maxAttempts = Math.min(Number(args["attempts"] ?? 5), MAX_ATTEMPTS);
const stratum = (args["stratum"] ?? "cold") as "cold" | "warm";
const origin = `${SERVER_ORIGIN}:${serverPort}`;

console.log(`M1 Chrome Pilot: ${maxAttempts} attempts, stratum=${stratum}, origin=${origin}`);

// ── Launch owned Chrome ──

async function launchChrome(): Promise<{
  process: Deno.ChildProcess;
  wsUrl: string;
  profileDir: string;
  cdpPort: number;
}> {
  const profileDir = `/tmp/wasm-vs-js-chrome-pilot-${Date.now()}`;
  const cdpPort = 9400 + Math.floor(Math.random() * 100);

  const process = new Deno.Command(CHROME_BIN, {
    args: [
      "--headless=new",
      `--remote-debugging-port=${cdpPort}`,
      `--user-data-dir=${profileDir}`,
      "--no-first-run",
      "--no-default-browser-check",
      "--disable-gpu",
      "--no-sandbox",
      "--disable-extensions",
      "--disable-background-networking",
      "--disable-sync",
      "--metrics-recording-only",
      "--disable-default-apps",
      "--no-proxy-server",
      aboutBlank(),
    ],
    stdout: "null",
    stderr: "null",
  }).spawn();

  // Wait for CDP to be available
  let wsUrl = "";
  for (let i = 0; i < 30; i++) {
    await sleep(500);
    try {
      const resp = await fetch(`http://127.0.0.1:${cdpPort}/json/version`);
      if (resp.ok) {
        const version = await resp.json();
        wsUrl = version.webSocketDebuggerUrl;
        break;
      }
    } catch { /* retry */ }
  }

  if (!wsUrl) {
    process.kill("SIGTERM");
    throw new Error("Chrome CDP did not start within 15s");
  }

  return { process, wsUrl, profileDir, cdpPort };
}

function aboutBlank(): string {
  return "about:blank";
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

// ── Collect Chrome version and launch info ──

async function collectBrowserInfo(cdpPort: number): Promise<{
  product: string;
  userAgent: string;
  launchArguments: string[];
}> {
  const versionResp = await fetch(
    `http://127.0.0.1:${cdpPort}/json/version`,
  );
  const version = await versionResp.json();

  return {
    product: version["Browser"] ?? "unknown",
    userAgent: version["User-Agent"] ?? "unknown",
    launchArguments: [
      "--headless=new",
      "--no-first-run",
      "--no-default-browser-check",
      "--disable-gpu",
      "--no-sandbox",
      "--disable-extensions",
      "--disable-background-networking",
      "--disable-sync",
      "--metrics-recording-only",
      "--disable-default-apps",
      "--no-proxy-server",
    ],
  };
}

// ── Run single benchmark attempt ──

type AttemptResult = {
  attempt: number;
  success: boolean;
  timings?: Record<string, unknown>;
  error?: string;
  screenshotPath?: string;
};

async function runBenchmarkAttempt(
  cdp: CdpClient,
  attempt: number,
  cacheState: "cold" | "warm",
): Promise<AttemptResult> {
  try {
    // Enable required domains
    await cdp.send("Runtime.enable", {});
    await cdp.send("Page.enable", {});
    await cdp.send("Network.enable", {});

    // Navigate to the runner page
    await cdp.send("Page.navigate", { url: `${origin}/run/` });
    await sleep(3000);

    // Wait for page to be ready
    const readyResult = await cdp.send("Runtime.evaluate", {
      expression:
        `typeof document !== 'undefined' && document.getElementById('start-live-run') !== null`,
      returnByValue: true,
    });
    if (!(readyResult as Record<string, unknown>)?.result) {
      throw new Error("Runner page did not load properly");
    }

    // Submit the form via JS evaluation
    const runResult = await cdp.send("Runtime.evaluate", {
      expression: `
        (async () => {
          const form = document.getElementById('hosted-runner-form');
          const iterationsInput = form.querySelector('[name="iterations"]');
          iterationsInput.value = '20';
          form.dispatchEvent(new Event('submit', { cancelable: true, bubbles: true }));

          // Wait for result to appear (up to 30s)
          for (let i = 0; i < 60; i++) {
            await new Promise(r => setTimeout(r, 500));
            const results = document.getElementById('live-results');
            if (results && !results.hidden) {
              // Extract timing from rendered tables
              const tables = results.querySelectorAll('table');
              let jsFirst = null, jsMedian = null, jsP95 = null, jsCount = null;
              let wasmFirst = null, wasmMedian = null, wasmP95 = null, wasmCount = null;
              let trajectory = [];
              for (const table of tables) {
                const rows = table.querySelectorAll('tbody tr');
                for (const row of rows) {
                  const cells = [...row.querySelectorAll('td')].map(td => td.textContent.trim());
                  if (cells[0]?.includes('JavaScript')) {
                    [jsFirst, jsMedian, jsP95, jsCount] = cells.slice(1);
                  }
                  if (cells[0]?.includes('Wasm')) {
                    [wasmFirst, wasmMedian, wasmP95, wasmCount] = cells.slice(1);
                  }
                  if (cells[0]?.match(/^\d+$/)) {
                    trajectory.push({ iter: cells[0], js: cells[1], wasm: cells[2] });
                  }
                }
              }
              return {
                text: 'OK',
                timings: {
                  js: { firstScored: jsFirst, median: jsMedian, p95: jsP95, count: jsCount },
                  wasm: { firstScored: wasmFirst, median: wasmMedian, p95: wasmP95, count: wasmCount },
                  trajectorySamples: trajectory.length,
                  trajectory: trajectory.slice(0, 5),
                },
              };
            }
          }
          return { text: 'TIMEOUT' };
        })()
      `,
      awaitPromise: true,
      returnByValue: true,
    });

    const result = ((runResult as Record<string, unknown>)?.result ?? {}) as Record<
      string,
      unknown
    >;
    const resultText = String(result.text ?? "");
    const success = resultText !== "TIMEOUT" && !resultText.includes("Error");

    // Take screenshot
    const screenshot = await cdp.send("Page.captureScreenshot", { format: "png" });
    await Deno.mkdir(SCREENSHOT_DIR, { recursive: true });
    const screenshotPath = `${SCREENSHOT_DIR}/attempt-${attempt}-${cacheState}.png`;
    await Deno.writeFile(
      screenshotPath,
      new Uint8Array(Buffer.from(screenshot.data as string, "base64")),
    );

    return {
      attempt,
      success,
      timings: result.timings as Record<string, unknown> | undefined,
      screenshotPath,
      error: success ? undefined : resultText,
    };
  } catch (e) {
    return {
      attempt,
      success: false,
      error: e instanceof Error ? e.message : String(e),
    };
  }
}

// ── Cleanup ──

async function cleanupChrome(
  process: Deno.ChildProcess,
  profileDir: string,
): Promise<void> {
  try {
    process.kill("SIGTERM");
  } catch { /* already dead */ }
  await sleep(1000);
  try {
    await Deno.remove(profileDir, { recursive: true });
  } catch { /* already cleaned */ }
}

// ── Main ──

async function main(): Promise<void> {
  console.log("Launching owned Chrome...");
  const { process, profileDir, cdpPort } = await launchChrome();
  const browserInfo = await collectBrowserInfo(cdpPort);
  console.log(`Chrome: ${browserInfo.product}`);

  // Create a new page tab for CDP commands (Runtime/Page/Network require page target)
  const tabResp = await fetch(`http://127.0.0.1:${cdpPort}/json/new?about:blank`, {
    method: "PUT",
  });
  const tab = await tabResp.json();
  const pageWsUrl = tab.webSocketDebuggerUrl;
  console.log(`Page tab: ${pageWsUrl.slice(0, 60)}...`);

  const cdp = new CdpClient(pageWsUrl);
  await cdp.ready();

  const results: AttemptResult[] = [];

  try {
    for (let i = 0; i < maxAttempts; i++) {
      const attempt = i + 1;
      console.log(`  Attempt ${attempt}/${maxAttempts} (${stratum})...`);

      // For cold runs: reload the page to clear caches
      // For warm runs: keep the page loaded between iterations
      const result = await runBenchmarkAttempt(cdp, attempt, stratum);
      results.push(result);

      if (result.success) {
        console.log(`    ✓ Success (screenshot: ${result.screenshotPath})`);
      } else {
        console.log(`    ✗ Failed: ${result.error}`);
      }

      // Checkpoint analysis at 20/30/40/50/60
      if ([20, 30, 40, 50, 60].includes(attempt)) {
        const succeeded = results.filter((r) => r.success).length;
        console.log(`\n  Checkpoint ${attempt}: ${succeeded}/${attempt} succeeded`);
        if (succeeded < 20 && attempt === 60) {
          console.log("  Stratum inconclusive: fewer than 20 committed pairs.");
        }
      }
    }
  } finally {
    // Close the page tab
    try {
      await fetch(`http://127.0.0.1:${cdpPort}/json/close/${tab.id}`, { method: "PUT" });
    } catch {
      // ignore errors closing tab
    }
    await cleanupChrome(process, profileDir);
    console.log("Chrome cleaned up.");
  }

  // Summary
  const succeeded = results.filter((r) => r.success).length;
  console.log(`\n=== PILOT SUMMARY ===`);
  console.log(`Stratum: ${stratum}`);
  console.log(`Attempts: ${maxAttempts}`);
  console.log(`Succeeded: ${succeeded}`);
  console.log(`Failed: ${results.length - succeeded}`);
  console.log(`Screenshots: ${SCREENSHOT_DIR}/`);

  // Store evidence
  const evidencePath = `raw/m1-pilot-evidence-${stratum}-${Date.now()}.json`;
  await Deno.mkdir("raw", { recursive: true });
  await Deno.writeTextFile(
    evidencePath,
    JSON.stringify(
      {
        timestamp: new Date().toISOString(),
        stratum,
        maxAttempts,
        browserInfo,
        results,
        chromeBinary: CHROME_BIN,
      },
      null,
      2,
    ),
  );
  console.log(`Evidence: ${evidencePath}`);
}

await main().catch((e) => {
  console.error("Pilot failed:", e);
  Deno.exit(1);
});
