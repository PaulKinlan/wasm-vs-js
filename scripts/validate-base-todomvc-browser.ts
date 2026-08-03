// Prepared authoritative collector. Do not run from implementation workers.
// The parent evidence controller supplies one exact Chrome path and source commit.
import { canonicalize, sha256Hex } from "../lib/canonical.ts";
import { CdpClient } from "../lib/cdp-client.ts";

const root = new URL("../", import.meta.url);
const sourceCommit = Deno.args.find((arg) => arg.startsWith("--source-commit="))?.slice(16) ?? "";
const chromeArg = Deno.args.find((arg) => arg.startsWith("--chrome="))?.slice(9) ?? "";
if (Deno.args.length !== 2 || !/^[a-f0-9]{40}$/.test(sourceCommit) || !chromeArg) {
  throw new Error(
    "usage: validate-base-todomvc-browser.ts --source-commit=<40 hex> --chrome=<path>",
  );
}
const chrome = await Deno.realPath(chromeArg);

function unusedPort() {
  const listener = Deno.listen({ hostname: "127.0.0.1", port: 0 });
  const port = (listener.addr as Deno.NetAddr).port;
  listener.close();
  return port;
}
async function waitFor(url: string, timeout = 10_000) {
  const deadline = Date.now() + timeout;
  while (Date.now() < deadline) {
    try {
      const response = await fetch(url, { redirect: "error" });
      if (response.ok) return response;
    } catch { /* bounded retry */ }
    await new Promise((resolve) => setTimeout(resolve, 50));
  }
  throw new Error(`timed out waiting for ${url}`);
}
type Identity = { pid: number; parentPid: number; start: string; executable: string };
async function identity(pid: number): Promise<Identity | null> {
  try {
    const stat = await Deno.readTextFile(`/proc/${pid}/stat`);
    const fields = stat.slice(stat.lastIndexOf(")") + 2).split(" ");
    return {
      pid,
      parentPid: Number(fields[1]),
      start: fields[19],
      executable: await Deno.realPath(`/proc/${pid}/exe`),
    };
  } catch {
    return null;
  }
}
async function owned(rootPid: number) {
  const all: Identity[] = [];
  for await (const entry of Deno.readDir("/proc")) {
    if (!entry.isDirectory || !/^\d+$/.test(entry.name)) continue;
    const value = await identity(Number(entry.name));
    if (value) all.push(value);
  }
  const ids = new Set([rootPid]);
  let changed = true;
  while (changed) {
    changed = false;
    for (const item of all) {
      if (ids.has(item.parentPid) && !ids.has(item.pid)) {
        ids.add(item.pid);
        changed = true;
      }
    }
  }
  return all.filter((item) => ids.has(item.pid));
}
async function running(item: Identity) {
  const current = await identity(item.pid);
  return current?.start === item.start && current.executable === item.executable;
}
async function waitExit(items: Identity[], timeout: number) {
  const deadline = Date.now() + timeout;
  while (Date.now() < deadline) {
    if (!(await Promise.all(items.map(running))).some(Boolean)) return true;
    await new Promise((resolve) => setTimeout(resolve, 50));
  }
  return false;
}
async function click(client: CdpClient, sessionId: string, selector: string) {
  const evaluated = await client.send("Runtime.evaluate", {
    expression: `(() => { const n=document.querySelector(${
      JSON.stringify(selector)
    }); const r=n.getBoundingClientRect(); return {x:r.left+r.width/2,y:r.top+r.height/2,disabled:n.disabled}; })()`,
    returnByValue: true,
  }, sessionId);
  const value = (evaluated.result as { value: { x: number; y: number; disabled: boolean } }).value;
  if (value.disabled) throw new Error(`${selector} disabled`);
  for (const type of ["mousePressed", "mouseReleased"]) {
    await client.send("Input.dispatchMouseEvent", {
      type,
      x: value.x,
      y: value.y,
      button: "left",
      clickCount: 1,
    }, sessionId);
  }
}
async function evaluate(client: CdpClient, sessionId: string, expression: string) {
  const response = await client.send("Runtime.evaluate", {
    expression,
    returnByValue: true,
    awaitPromise: true,
  }, sessionId);
  return (response.result as { value: unknown }).value;
}
async function waitStatus(
  client: CdpClient,
  sessionId: string,
  includes: string,
  timeout = 35_000,
) {
  const deadline = Date.now() + timeout;
  let value = "";
  while (Date.now() < deadline) {
    value = String(
      await evaluate(client, sessionId, "document.querySelector('#status').textContent"),
    );
    if (value.includes(includes)) return value;
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  throw new Error(`status timeout: ${value}`);
}

const serverPort = unusedPort();
const debuggerPort = unusedPort();
const origin = `http://127.0.0.1:${serverPort}`;
const server = new Deno.Command(Deno.execPath(), {
  cwd: root,
  args: [
    "run",
    "--allow-env=PORT,HOST,SERVER_MODE",
    "--allow-net=127.0.0.1",
    "--allow-read=.",
    "deploy.ts",
  ],
  env: { PORT: String(serverPort), HOST: "127.0.0.1", SERVER_MODE: "public" },
  stdout: "null",
  stderr: "piped",
}).spawn();
const profile = await Deno.makeTempDir({ prefix: "base-todomvc-chrome-" });
const launchArguments = [
  "--headless=new",
  "--no-sandbox",
  "--disable-gpu",
  "--disable-background-networking",
  "--disable-component-update",
  "--disable-default-apps",
  "--disable-extensions",
  "--disable-sync",
  "--metrics-recording-only",
  "--no-first-run",
  "--window-size=1280,720",
  "--remote-debugging-address=127.0.0.1",
  `--remote-debugging-port=${debuggerPort}`,
  `--user-data-dir=${profile}`,
  "about:blank",
];
const browser = new Deno.Command(chrome, { args: launchArguments, stdout: "null", stderr: "piped" })
  .spawn();
let client: CdpClient | null = null;
try {
  await waitFor(`${origin}/healthz`);
  const discovery = await (await waitFor(`http://127.0.0.1:${debuggerPort}/json/version`)).json();
  const ws = new URL(discovery.webSocketDebuggerUrl);
  if (ws.hostname !== "127.0.0.1" || Number(ws.port) !== debuggerPort) {
    throw new Error("CDP ownership mismatch");
  }
  client = new CdpClient(ws.href);
  await client.ready();
  const version = await client.send("Browser.getVersion");
  if (version.product !== "Chrome/150.0.7871.24") throw new Error(`unexpected ${version.product}`);
  const commandLine = await client.send("Browser.getBrowserCommandLine");
  const scenarios = [
    { id: "javascript-complete", target: "js-controlled", action: "complete" },
    { id: "wasm-complete", target: "wasm-linear-controlled", action: "complete" },
    { id: "cancel-stale-restart", target: "wasm-linear-controlled", action: "lifecycle" },
    { id: "pagehide", target: "js-controlled", action: "pagehide" },
  ];
  const records = [];
  for (const scenario of scenarios) {
    const created = await client.send("Target.createTarget", { url: "about:blank" });
    const targetId = String(created.targetId);
    const attached = await client.send("Target.attachToTarget", { targetId, flatten: true });
    const sessionId = String(attached.sessionId);
    const console: unknown[] = [];
    const requests = new Map<string, Record<string, unknown>>();
    const offs = [
      client.on("Runtime.consoleAPICalled", (params, eventSession) => {
        if (eventSession === sessionId) console.push(params);
      }),
      client.on("Runtime.exceptionThrown", (params, eventSession) => {
        if (eventSession === sessionId) console.push({ exception: params });
      }),
      client.on("Network.requestWillBeSent", (params, eventSession) => {
        if (eventSession !== sessionId) return;
        const request = params.request as Record<string, unknown>;
        requests.set(String(params.requestId), {
          url: request.url,
          method: request.method,
          status: null,
          failed: false,
        });
      }),
      client.on("Network.responseReceived", (params, eventSession) => {
        if (eventSession !== sessionId) return;
        const record = requests.get(String(params.requestId));
        if (record) record.status = Number((params.response as Record<string, unknown>).status);
      }),
      client.on("Network.loadingFailed", (params, eventSession) => {
        if (eventSession !== sessionId) return;
        const record = requests.get(String(params.requestId));
        if (record) record.failed = true;
      }),
    ];
    await Promise.all([
      client.send("Page.enable", {}, sessionId),
      client.send("Runtime.enable", {}, sessionId),
      client.send("Network.enable", {}, sessionId),
    ]);
    await client.send("Page.navigate", {
      url: `${origin}/benchmarks/base-dom-todomvc-journey/?demo-test=1`,
    }, sessionId);
    await waitStatus(client, sessionId, "Ready.");
    await evaluate(
      client,
      sessionId,
      `document.querySelector('#target').value=${JSON.stringify(scenario.target)}`,
    );
    await click(client, sessionId, "#start");
    let assertions;
    if (scenario.action === "complete") {
      await waitStatus(client, sessionId, "Complete.");
      assertions = await evaluate(
        client,
        sessionId,
        `(() => { const r=JSON.parse(document.querySelector('#result').textContent); return {all:Object.values(r.assertions).every(Boolean),items:document.querySelectorAll('#todo-list>li').length,focused:document.activeElement?.id,selection:[document.activeElement?.selectionStart,document.activeElement?.selectionEnd],physical:r.physical}; })()`,
      );
    } else if (scenario.action === "lifecycle") {
      await click(client, sessionId, "#cancel");
      await waitStatus(client, sessionId, "Cancelled.");
      const stale = await evaluate(
        client,
        sessionId,
        `(() => { const before=document.querySelector('#status').textContent; __baseTodoTest.injectStaleMessage(); return {ignored:before===document.querySelector('#status').textContent,active:__baseTodoTest.workerActive()}; })()`,
      );
      await click(client, sessionId, "#start");
      await waitStatus(client, sessionId, "Complete.");
      assertions = { stale, restartCompleted: true };
    } else {
      assertions = await evaluate(
        client,
        sessionId,
        `(() => { window.dispatchEvent(new PageTransitionEvent('pagehide')); return {workerAbsent:!__baseTodoTest.workerActive()}; })()`,
      );
    }
    if (console.length) throw new Error(`${scenario.id} console/exception output`);
    if (
      [...requests.values()].some((record) =>
        record.failed || (record.status !== null && record.status !== 200)
      )
    ) {
      throw new Error(`${scenario.id} network failure`);
    }
    const screenshot = await client.send(
      "Page.captureScreenshot",
      { format: "png", captureBeyondViewport: true },
      sessionId,
      10_000,
    );
    const screenshotBytes = Uint8Array.from(
      atob(String(screenshot.data)),
      (char) => char.charCodeAt(0),
    );
    const screenshotPath = `artifacts/base-dom-todomvc-browser-${scenario.id}.png`;
    await Deno.writeFile(new URL(screenshotPath, root), screenshotBytes);
    records.push({
      ...scenario,
      assertions,
      console,
      network: [...requests.values()],
      screenshot: {
        path: screenshotPath,
        bytes: screenshotBytes.length,
        sha256: await sha256Hex(screenshotBytes),
      },
    });
    offs.forEach((off) => off());
    await client.send("Target.closeTarget", { targetId });
  }
  const registrationBytes =
    await (await fetch(`${origin}/data/base-dom-todomvc-journey.v1.json`, { cache: "no-store" }))
      .bytes();
  const registration = JSON.parse(new TextDecoder().decode(registrationBytes));
  const rawHashes = [];
  for (const artifact of registration.artifacts) {
    const bytes = await (await fetch(`${origin}${artifact.route}`, { cache: "no-store" })).bytes();
    const actual = await sha256Hex(bytes);
    if (actual !== artifact.sha256) throw new Error(`raw served hash mismatch: ${artifact.route}`);
    rawHashes.push({ route: artifact.route, bytes: bytes.length, sha256: actual });
  }
  const ownedBeforeClose = await owned(browser.pid);
  await client.send("Browser.close");
  client.close();
  client = null;
  if (!(await waitExit(ownedBeforeClose, 10_000))) {
    for (const item of [...ownedBeforeClose].reverse()) {
      if (await running(item)) Deno.kill(item.pid, "SIGTERM");
    }
  }
  if (!(await waitExit(ownedBeforeClose, 5_000))) throw new Error("owned Chrome cleanup failed");
  await browser.status;
  await Deno.remove(profile, { recursive: true });
  const serverIdentity = await identity(server.pid);
  if (serverIdentity) Deno.kill(server.pid, "SIGTERM");
  await server.status;
  const evidence = {
    schemaVersion: 1,
    evidenceId: "base-dom-todomvc-chrome-150-v1",
    sourceCommit,
    collectedAt: new Date().toISOString(),
    browser: { version, commandLine, executable: chrome, launchArguments },
    route: "/benchmarks/base-dom-todomvc-journey/",
    viewport: { width: 1280, height: 720, deviceScaleFactor: 1 },
    scenarios: records,
    rawHashes,
    cleanup: { ownedProcessesAbsent: true, profileRemoved: true, serverAbsent: true },
  };
  await Deno.writeTextFile(
    new URL("artifacts/base-dom-todomvc-browser-evidence.json", root),
    `${canonicalize(evidence)}\n`,
  );
} finally {
  client?.close();
  const browserIdentity = await identity(browser.pid);
  if (browserIdentity && await running(browserIdentity)) Deno.kill(browser.pid, "SIGTERM");
  const serverIdentity = await identity(server.pid);
  if (serverIdentity && await running(serverIdentity)) Deno.kill(server.pid, "SIGTERM");
  await Deno.remove(profile, { recursive: true }).catch(() => {});
}
