// Prepared authoritative collector. Do not run from implementation workers.
// The parent evidence controller supplies one exact external Chrome executable and source commit.
import Ajv2020Module from "ajv2020";
import addFormatsModule from "ajv-formats";
import {
  assertCompleteNetwork,
  assertCompleteTodoEvidence,
  assertLifecycleEvidence,
} from "../lib/base-todomvc-gate.ts";
import { canonicalize, sha256Hex } from "../lib/canonical.ts";
import { CdpClient } from "../lib/cdp-client.ts";

const rootUrl = new URL("../", import.meta.url);
const root = await Deno.realPath(rootUrl);
const sourceCommit = Deno.args.find((arg) => arg.startsWith("--source-commit="))?.slice(16) ?? "";
const chromeArg = Deno.args.find((arg) => arg.startsWith("--chrome="))?.slice(9) ?? "";
if (Deno.args.length !== 2 || !/^[a-f0-9]{40}$/.test(sourceCommit) || !chromeArg) {
  throw new Error(
    "usage: validate-base-todomvc-browser.ts --source-commit=<40 hex> --chrome=<path>",
  );
}
const chrome = await Deno.realPath(chromeArg);
if (chrome === root || chrome.startsWith(`${root}/`)) {
  throw new Error("Chrome trust root must be external to the source root");
}

async function command(args: string[]) {
  const output = await new Deno.Command("git", {
    cwd: root,
    args,
    stdout: "piped",
    stderr: "piped",
  }).output();
  if (!output.success) throw new Error(new TextDecoder().decode(output.stderr));
  return new TextDecoder().decode(output.stdout).trim();
}
const collectorHead = await command(["rev-parse", "HEAD"]);
const gitRoot = await Deno.realPath(await command(["rev-parse", "--show-toplevel"]));
if (gitRoot !== root) throw new Error("collector source-root mismatch");
if (await command(["status", "--porcelain=v1", "--untracked-files=all"])) {
  throw new Error("collector HEAD is not clean");
}

const localRegistrationBytes = await Deno.readFile(
  new URL("catalog/base-dom-todomvc-journey.v1.json", rootUrl),
);
const localRegistration = JSON.parse(new TextDecoder().decode(localRegistrationBytes));
const localBuildBytes = await Deno.readFile(
  new URL("public/artifacts/base-dom-todomvc-journey/build-manifest.json", rootUrl),
);
const localBuild = JSON.parse(new TextDecoder().decode(localBuildBytes));
if (localRegistration.sourceCommit !== sourceCommit || localBuild.sourceCommit !== sourceCommit) {
  throw new Error("requested source commit does not match registration and build source roots");
}
for (const source of localBuild.sourceGraph) {
  const disk = await Deno.readFile(new URL(source.path, rootUrl));
  const committed = await new Deno.Command("git", {
    cwd: root,
    args: ["show", `${sourceCommit}:${source.path}`],
    stdout: "piped",
    stderr: "piped",
  }).output();
  if (
    !committed.success || await sha256Hex(disk) !== source.sha256 ||
    await sha256Hex(committed.stdout) !== source.sha256
  ) {
    throw new Error(`source graph mismatch: ${source.path}`);
  }
}

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
async function descendants(rootPid: number) {
  const all: Identity[] = [];
  for await (const entry of Deno.readDir("/proc")) {
    if (!entry.isDirectory || !/^\d+$/.test(entry.name)) continue;
    const value = await identity(Number(entry.name));
    if (value) all.push(value);
  }
  const ids = new Set([rootPid]);
  for (let changed = true; changed;) {
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
async function axName(
  client: CdpClient,
  sessionId: string,
  documentNodeId: number,
  selector: string,
  role: string,
) {
  const queried = await client.send(
    "DOM.querySelector",
    { nodeId: documentNodeId, selector },
    sessionId,
  );
  const nodeId = Number(queried.nodeId);
  if (!nodeId) throw new Error(`AX selector absent: ${selector}`);
  const tree = await client.send("Accessibility.getPartialAXTree", {
    nodeId,
    fetchRelatives: false,
  }, sessionId);
  const nodes = tree.nodes as Array<Record<string, unknown>>;
  const match = nodes.find((node) =>
    (node.role as { value?: string } | undefined)?.value === role && node.ignored !== true
  );
  const name = (match?.name as { value?: unknown } | undefined)?.value;
  if (typeof name !== "string") throw new Error(`AX ${role} name absent: ${selector}`);
  return name;
}
async function collectAx(client: CdpClient, sessionId: string, ids: number[]) {
  const document = await client.send("DOM.getDocument", { depth: 1 }, sessionId);
  const documentNodeId = Number((document.root as { nodeId: number }).nodeId);
  const entries = [];
  for (const id of ids) {
    entries.push({
      id,
      checkboxName: await axName(
        client,
        sessionId,
        documentNodeId,
        `li[data-todo-id="${id}"] input[type="checkbox"]`,
        "checkbox",
      ),
      removeName: await axName(
        client,
        sessionId,
        documentNodeId,
        `li[data-todo-id="${id}"] button`,
        "button",
      ),
    });
  }
  return entries;
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
const observed = new Map<string, Identity>();
let client: CdpClient | null = null;
let browserCloseRequested = false;
let evidenceBody: Record<string, unknown> | null = null;
let failure: unknown = null;
try {
  await waitFor(`${origin}/healthz`);
  const discovery = await (await waitFor(`http://127.0.0.1:${debuggerPort}/json/version`)).json();
  const ws = new URL(discovery.webSocketDebuggerUrl);
  if (ws.protocol !== "ws:" || ws.hostname !== "127.0.0.1" || Number(ws.port) !== debuggerPort) {
    throw new Error("CDP ownership mismatch");
  }
  client = new CdpClient(ws.href);
  await client.ready();
  const version = await client.send("Browser.getVersion");
  if (version.product !== "Chrome/150.0.7871.24") throw new Error(`unexpected ${version.product}`);
  const commandLine = await client.send("Browser.getBrowserCommandLine");
  const servedRegistrationBytes =
    await (await fetch(`${origin}/data/base-dom-todomvc-journey.v1.json`, { cache: "no-store" }))
      .bytes();
  if (await sha256Hex(servedRegistrationBytes) !== await sha256Hex(localRegistrationBytes)) {
    throw new Error("served registration differs from local trust root");
  }
  const outputManifestBytes = await Deno.readFile(
    new URL("public/artifacts/base-dom-todomvc-journey/output-manifest.json", rootUrl),
  );
  const oracleManifest = JSON.parse(new TextDecoder().decode(outputManifestBytes));
  const oracle = { ...oracleManifest.oracle, variants: oracleManifest.variants };
  const scenarios = [
    { id: "javascript-complete", target: "js-controlled", action: "complete" },
    { id: "wasm-complete", target: "wasm-linear-controlled", action: "complete" },
    { id: "cancel-stale-restart", target: "wasm-linear-controlled", action: "lifecycle" },
    { id: "pagehide", target: "js-controlled", action: "pagehide" },
  ];
  const records = [];
  let firstCompleteDom: unknown = null;
  for (const scenario of scenarios) {
    for (const item of await descendants(browser.pid)) {
      observed.set(`${item.pid}:${item.start}`, item);
    }
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
        if (eventSession === sessionId) console.push(params);
      }),
      client.on("Network.requestWillBeSent", (params, eventSession) => {
        if (eventSession !== sessionId) return;
        const request = params.request as Record<string, unknown>;
        requests.set(String(params.requestId), {
          url: request.url,
          method: request.method,
          status: null,
          mimeType: "",
          fromDiskCache: false,
          fromServiceWorker: false,
          failed: false,
          completed: false,
          errorText: null,
        });
      }),
      client.on("Network.responseReceived", (params, eventSession) => {
        if (eventSession !== sessionId) return;
        const record = requests.get(String(params.requestId));
        const response = params.response as Record<string, unknown>;
        if (record) {
          Object.assign(record, {
            status: Number(response.status),
            mimeType: response.mimeType,
            fromDiskCache: Boolean(response.fromDiskCache),
            fromServiceWorker: Boolean(response.fromServiceWorker),
          });
        }
      }),
      client.on("Network.loadingFinished", (params, eventSession) => {
        if (eventSession === sessionId) {
          const record = requests.get(String(params.requestId));
          if (record) record.completed = true;
        }
      }),
      client.on("Network.loadingFailed", (params, eventSession) => {
        if (eventSession === sessionId) {
          const record = requests.get(String(params.requestId));
          if (record) {
            Object.assign(record, {
              failed: true,
              completed: true,
              errorText: String(params.errorText),
            });
          }
        }
      }),
    ];
    await Promise.all([
      client.send("Page.enable", {}, sessionId),
      client.send("Runtime.enable", {}, sessionId),
      client.send("Network.enable", {}, sessionId),
      client.send("DOM.enable", {}, sessionId),
      client.send("Accessibility.enable", {}, sessionId),
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
    let result: Record<string, unknown> | null = null;
    let ax: Array<{ id: number; checkboxName: string; removeName: string }> | null = null;
    const lifecycle = {
      cancelled: false,
      staleIgnored: false,
      workerAbsentAfterCancel: false,
      restartCompleted: false,
      workerAbsentAfterPagehide: false,
    };
    let finalStatus: string;
    if (scenario.action === "complete") {
      finalStatus = await waitStatus(client, sessionId, "Complete.");
      result = await evaluate(
        client,
        sessionId,
        "JSON.parse(document.querySelector('#result').textContent)",
      ) as Record<string, unknown>;
    } else if (scenario.action === "lifecycle") {
      await click(client, sessionId, "#cancel");
      finalStatus = await waitStatus(client, sessionId, "Cancelled.");
      lifecycle.cancelled = true;
      const stale = await evaluate(
        client,
        sessionId,
        "(() => { const before=document.querySelector('#status').textContent; const absent=!__baseTodoTest.workerActive(); __baseTodoTest.injectStaleMessage(); return {ignored:before===document.querySelector('#status').textContent,absent}; })()",
      ) as { ignored: boolean; absent: boolean };
      lifecycle.staleIgnored = stale.ignored;
      lifecycle.workerAbsentAfterCancel = stale.absent;
      await click(client, sessionId, "#start");
      finalStatus = await waitStatus(client, sessionId, "Complete.");
      lifecycle.restartCompleted = true;
      result = await evaluate(
        client,
        sessionId,
        "JSON.parse(document.querySelector('#result').textContent)",
      ) as Record<string, unknown>;
    } else {
      lifecycle.workerAbsentAfterPagehide = Boolean(
        await evaluate(
          client,
          sessionId,
          "(() => { window.dispatchEvent(new PageTransitionEvent('pagehide')); return !__baseTodoTest.workerActive(); })()",
        ),
      );
      finalStatus = String(
        await evaluate(client, sessionId, "document.querySelector('#status').textContent"),
      );
    }
    if (result) {
      const ids = (result.canonicalDom as Array<{ id: number }>).map(({ id }) => id);
      ax = await collectAx(client, sessionId, ids);
      assertCompleteTodoEvidence(result, ax, oracle, scenario.target);
      if (firstCompleteDom === null) firstCompleteDom = result.canonicalDom;
      else if (JSON.stringify(firstCompleteDom) !== JSON.stringify(result.canonicalDom)) {
        throw new Error("cross-scenario canonical DOM mismatch");
      }
    }
    assertLifecycleEvidence(scenario.action, lifecycle);
    await new Promise((resolve) => setTimeout(resolve, 100));
    const network = [...requests.values()] as unknown as Parameters<
      typeof assertCompleteNetwork
    >[0];
    assertCompleteNetwork(network);
    if (console.length) throw new Error(`${scenario.id} console/exception output`);
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
    await Deno.writeFile(new URL(screenshotPath, rootUrl), screenshotBytes);
    records.push({
      ...scenario,
      finalStatus,
      result,
      canonicalDomSha256: result ? await sha256Hex(canonicalize(result.canonicalDom)) : null,
      ax: ax ? { entries: ax, sha256: await sha256Hex(canonicalize(ax)) } : null,
      lifecycle,
      gate: {
        semantic: result ? true : null,
        dom: result ? true : null,
        ax: result ? true : null,
        lifecycle: true,
        network: true,
      },
      console,
      network,
      screenshot: {
        path: screenshotPath,
        bytes: screenshotBytes.length,
        sha256: await sha256Hex(screenshotBytes),
      },
    });
    offs.forEach((off) => off());
    await client.send("Target.closeTarget", { targetId });
  }
  const rawHashes = [];
  for (const artifact of localRegistration.artifacts) {
    const local = await Deno.readFile(new URL(artifact.path, rootUrl));
    if (local.byteLength !== artifact.bytes || await sha256Hex(local) !== artifact.sha256) {
      throw new Error(`local artifact trust-root mismatch: ${artifact.path}`);
    }
    const served = await (await fetch(`${origin}${artifact.route}`, { cache: "no-store" })).bytes();
    if (served.byteLength !== local.byteLength || await sha256Hex(served) !== artifact.sha256) {
      throw new Error(`served artifact mismatch: ${artifact.route}`);
    }
    rawHashes.push({ route: artifact.route, bytes: served.length, sha256: artifact.sha256 });
  }
  evidenceBody = {
    schemaVersion: 1,
    evidenceId: "base-dom-todomvc-chrome-150-v1",
    source: {
      collectorHead,
      sourceCommit,
      sourceRoot: root,
      cleanHead: true,
      registrationSha256: await sha256Hex(localRegistrationBytes),
      buildManifestSha256: await sha256Hex(localBuildBytes),
    },
    collectedAt: new Date().toISOString(),
    browser: {
      version,
      commandLine,
      executable: chrome,
      sha256: await sha256Hex(await Deno.readFile(chrome)),
      externalToSourceRoot: true,
      launchArguments,
    },
    route: "/benchmarks/base-dom-todomvc-journey/",
    viewport: { width: 1280, height: 720, deviceScaleFactor: 1 },
    scenarios: records,
    rawHashes,
  };
} catch (error) {
  failure = error;
} finally {
  for (const item of await descendants(browser.pid)) {
    observed.set(`${item.pid}:${item.start}`, item);
  }
  if (client) {
    try {
      await client.send("Browser.close");
      browserCloseRequested = true;
    } catch { /* signal fallback below */ }
    client.close();
    client = null;
  }
  const observedProcesses = [...observed.values()];
  const signals: Array<{ pid: number; signal: "SIGTERM" | "SIGKILL" }> = [];
  if (!(await waitExit(observedProcesses, 5_000))) {
    for (const item of [...observedProcesses].reverse()) {
      if (await running(item)) {
        Deno.kill(item.pid, "SIGTERM");
        signals.push({ pid: item.pid, signal: "SIGTERM" });
      }
    }
  }
  if (!(await waitExit(observedProcesses, 5_000))) {
    for (const item of [...observedProcesses].reverse()) {
      if (await running(item)) {
        Deno.kill(item.pid, "SIGKILL");
        signals.push({ pid: item.pid, signal: "SIGKILL" });
      }
    }
  }
  const ownedProcessesAbsent = await waitExit(observedProcesses, 5_000);
  await browser.status;
  if (!ownedProcessesAbsent) failure ??= new Error("owned Chrome descendants survived cleanup");
  await Deno.remove(profile, { recursive: true }).catch(() => {});
  let profileAbsent = false;
  try {
    await Deno.stat(profile);
  } catch (error) {
    if (error instanceof Deno.errors.NotFound) profileAbsent = true;
  }
  if (!profileAbsent) failure ??= new Error("Chrome profile survived cleanup");
  const serverProcesses = await descendants(server.pid);
  for (const item of [...serverProcesses].reverse()) {
    if (await running(item)) Deno.kill(item.pid, "SIGTERM");
  }
  if (!(await waitExit(serverProcesses, 5_000))) {
    for (const item of [...serverProcesses].reverse()) {
      if (await running(item)) Deno.kill(item.pid, "SIGKILL");
    }
  }
  const serverAbsent = await waitExit(serverProcesses, 5_000);
  await server.status;
  if (!serverAbsent) failure ??= new Error("owned server descendants survived cleanup");
  if (evidenceBody) {
    evidenceBody.cleanup = {
      observedBrowserProcesses: observedProcesses,
      signals,
      ownedProcessesAbsent,
      profileRemoved: profileAbsent,
      profileAbsent,
      serverAbsent,
    };
  }
}
if (failure) throw failure;
if (!evidenceBody || !browserCloseRequested) {
  throw new Error("evidence or Browser.close request absent");
}
const schema = JSON.parse(
  await Deno.readTextFile(new URL("schemas/base-todomvc-browser-evidence.schema.json", rootUrl)),
);
type Validator = ((value: unknown) => boolean) & { errors?: unknown };
type AjvInstance = { compile: (schema: unknown) => Validator };
type AjvConstructor = new (options?: Record<string, unknown>) => AjvInstance;
const Ajv2020 = ((Ajv2020Module as unknown as { default?: AjvConstructor }).default ??
  Ajv2020Module) as unknown as AjvConstructor;
const addFormats = ((addFormatsModule as unknown as {
  default?: (ajv: AjvInstance) => unknown;
}).default ?? addFormatsModule) as unknown as (ajv: AjvInstance) => unknown;
const ajv = new Ajv2020({ strict: true, allErrors: true });
addFormats(ajv);
const validate = ajv.compile(schema);
if (!validate(evidenceBody)) {
  throw new Error(`closed evidence schema rejected collection: ${JSON.stringify(validate.errors)}`);
}
await Deno.writeTextFile(
  new URL("artifacts/base-dom-todomvc-browser-evidence.json", rootUrl),
  `${canonicalize(evidenceBody)}\n`,
);
