import addFormatsModule from "ajv-formats";
import Ajv2020Module from "ajv2020";
import {
  ARCHIVE_ZIP_BROWSER_POLICY as POLICY,
  ARCHIVE_ZIP_SCENARIOS,
  ARCHIVE_ZIP_SOURCE_PATHS,
  assertArchiveZipScenarioSemantics,
  parseArchiveZipVisibleResult,
} from "../lib/archive-zip-browser-evidence.ts";
import { canonicalize, sha256Hex } from "../lib/canonical.ts";
import { CdpClient } from "../lib/cdp-client.ts";
import {
  inspectChromePackage,
  recordStageCleanupLifecycle,
  removeStagedChrome,
  stageChromePackage,
  StagedChrome,
} from "../lib/chrome-stage.ts";
import {
  ChromeLaunchLifecycleError,
  closeOwnedChrome,
  launchOwnedChrome,
  OwnedChrome,
} from "../lib/owned-chrome.ts";
import { refreshLedger } from "../lib/process-ledger.ts";
import { StageCleanupLifecycle } from "../lib/stage-lifecycle.ts";

type Validator = ((value: unknown) => boolean) & { errors?: unknown };
type AjvInstance = { compile: (schema: unknown) => Validator };
type AjvConstructor = new (options?: Record<string, unknown>) => AjvInstance;
const Ajv2020 = ((Ajv2020Module as unknown as { default?: AjvConstructor }).default ??
  Ajv2020Module) as unknown as AjvConstructor;
const addFormats =
  (addFormatsModule as unknown as { default?: (ajv: AjvInstance) => void }).default ??
    addFormatsModule as unknown as (ajv: AjvInstance) => void;

const root = new URL("../", import.meta.url);
const sourceCommit = Deno.args.find((value) => value.startsWith("--source-commit="))?.slice(16) ??
  "";
if (!/^[a-f0-9]{40}$/.test(sourceCommit) || Deno.args.length !== 1) {
  throw new Error("usage: collect-archive-zip-browser-evidence.ts --source-commit=<40 hex>");
}
const startedAt = new Date().toISOString();
const encoder = new TextEncoder();
const decoder = new TextDecoder();
const finalRelative = `artifacts/archive-zip-browser-evidence/${sourceCommit}`;
const finalPath = new URL(`${finalRelative}/`, root);
const candidateRelative =
  `artifacts/archive-zip-browser-evidence/.candidate-${sourceCommit}-${crypto.randomUUID()}`;
const candidatePath = new URL(`${candidateRelative}/`, root);

async function commandText(command: string, args: string[]): Promise<string> {
  const output = await new Deno.Command(command, {
    cwd: root,
    args,
    stdout: "piped",
    stderr: "piped",
  }).output();
  if (!output.success) throw new Error(decoder.decode(output.stderr).trim());
  return decoder.decode(output.stdout).trim();
}

async function mustBeAbsent(path: URL): Promise<void> {
  try {
    await Deno.lstat(path);
    throw new Error(`refusing to replace existing browser evidence: ${path.pathname}`);
  } catch (error) {
    if (!(error instanceof Deno.errors.NotFound)) throw error;
  }
}

async function sourceIdentity() {
  const head = await commandText("/usr/bin/git", ["rev-parse", "HEAD"]);
  if (head !== sourceCommit) throw new Error("source commit is not current HEAD");
  const tree = await commandText("/usr/bin/git", ["rev-parse", `${sourceCommit}^{tree}`]);
  const files = [];
  const graphLines: string[] = [];
  for (const path of ARCHIVE_ZIP_SOURCE_PATHS) {
    const committed = await new Deno.Command("/usr/bin/git", {
      cwd: root,
      args: ["show", `${sourceCommit}:${path}`],
      stdout: "piped",
      stderr: "piped",
    }).output();
    if (!committed.success) throw new Error(`${path} is absent from source commit`);
    const working = await Deno.readFile(new URL(path, root));
    const committedHash = await sha256Hex(committed.stdout);
    if (
      working.byteLength !== committed.stdout.byteLength ||
      await sha256Hex(working) !== committedHash
    ) {
      throw new Error(`working source differs from ${sourceCommit}: ${path}`);
    }
    files.push({ path, bytes: committed.stdout.byteLength, sha256: committedHash });
    graphLines.push(`${path}\0${committedHash}\n`);
  }
  return { commit: sourceCommit, tree, graphSha256: await sha256Hex(graphLines.join("")), files };
}

function unusedPort(): number {
  const listener = Deno.listen({ hostname: "127.0.0.1", port: 0 });
  const port = (listener.addr as Deno.NetAddr).port;
  listener.close();
  return port;
}

async function waitFor(url: string, timeoutMs = 10_000): Promise<Response> {
  const deadline = Date.now() + timeoutMs;
  let last = "no response";
  while (Date.now() < deadline) {
    try {
      const response = await fetch(url, { redirect: "error" });
      if (response.ok) return response;
      last = `HTTP ${response.status}`;
    } catch (error) {
      last = error instanceof Error ? error.message : String(error);
    }
    await new Promise((resolve) => setTimeout(resolve, 50));
  }
  throw new Error(`${url} unavailable: ${last}`);
}

type ProcessIdentity = {
  pid: number;
  parentPid: number;
  startTimeTicks: string;
  executable: string;
};
async function processIdentity(pid: number): Promise<ProcessIdentity | null> {
  try {
    const stat = await Deno.readTextFile(`/proc/${pid}/stat`);
    const fields = stat.slice(stat.lastIndexOf(")") + 2).split(" ");
    return {
      pid,
      parentPid: Number(fields[1]),
      startTimeTicks: fields[19],
      executable: await Deno.realPath(`/proc/${pid}/exe`),
    };
  } catch {
    return null;
  }
}
async function sameProcess(identity: ProcessIdentity): Promise<boolean> {
  const current = await processIdentity(identity.pid);
  return current?.startTimeTicks === identity.startTimeTicks &&
    current.executable === identity.executable;
}

async function writeRaw(relative: string, bytes: Uint8Array) {
  const candidate = new URL(`raw/${relative}`, candidatePath);
  await Deno.mkdir(new URL("./", candidate), { recursive: true });
  await Deno.writeFile(candidate, bytes);
  return {
    path: `${finalRelative}/raw/${relative}`,
    bytes: bytes.byteLength,
    sha256: await sha256Hex(bytes),
  };
}

async function verifyRawArtifacts(value: unknown): Promise<void> {
  if (Array.isArray(value)) {
    for (const item of value) await verifyRawArtifacts(item);
    return;
  }
  if (!value || typeof value !== "object") return;
  const record = value as Record<string, unknown>;
  if (
    typeof record.path === "string" && record.path.startsWith(`${finalRelative}/raw/`) &&
    typeof record.bytes === "number" && typeof record.sha256 === "string"
  ) {
    const relative = record.path.slice(`${finalRelative}/`.length);
    const bytes = await Deno.readFile(new URL(relative, candidatePath));
    if (bytes.byteLength !== record.bytes || await sha256Hex(bytes) !== record.sha256) {
      throw new Error(`raw artifact changed before publication: ${record.path}`);
    }
    return;
  }
  for (const child of Object.values(record)) await verifyRawArtifacts(child);
}

function decodeBase64(value: string): Uint8Array {
  return Uint8Array.from(atob(value), (character) => character.charCodeAt(0));
}

async function evaluatedValue(
  client: CdpClient,
  sessionId: string,
  expression: string,
  awaitPromise = false,
): Promise<unknown> {
  const evaluated = await client.send(
    "Runtime.evaluate",
    {
      expression,
      returnByValue: true,
      awaitPromise,
    },
    sessionId,
    40_000,
  );
  const exception = evaluated.exceptionDetails as Record<string, unknown> | undefined;
  if (exception) throw new Error(`evaluation failed: ${String(exception.text)}`);
  return (evaluated.result as Record<string, unknown>)?.value;
}

async function pageState(client: CdpClient, sessionId: string) {
  return await evaluatedValue(
    client,
    sessionId,
    `(() => ({
    status: document.querySelector('#status')?.textContent?.trim() ?? '',
    output: document.querySelector('#output')?.textContent ?? '',
    startDisabled: Boolean(document.querySelector('#start')?.disabled),
    cancelDisabled: Boolean(document.querySelector('#cancel')?.disabled),
    workerCount: globalThis.__zipWorkers?.length ?? 0,
    terminatedWorkers: globalThis.__zipWorkers?.filter((worker) => worker.__terminated).length ?? 0
  }))()`,
  ) as Record<string, unknown>;
}

async function checkpoint(
  records: Array<Record<string, unknown>>,
  client: CdpClient,
  sessionId: string,
  label: string,
): Promise<Record<string, unknown>> {
  const state = await pageState(client, sessionId);
  const value = {
    sequence: records.length,
    label,
    monotonicMs: performance.now(),
    status: String(state.status),
    output: String(state.output),
    workerCount: Number(state.workerCount),
    terminatedWorkers: Number(state.terminatedWorkers),
  };
  records.push(value);
  return value;
}

async function waitState(
  client: CdpClient,
  sessionId: string,
  predicate: (state: Record<string, unknown>) => boolean,
  timeoutMs = 40_000,
): Promise<Record<string, unknown>> {
  const deadline = Date.now() + timeoutMs;
  let state: Record<string, unknown> = {};
  while (Date.now() < deadline) {
    state = await pageState(client, sessionId);
    if (predicate(state)) return state;
    await new Promise((resolve) => setTimeout(resolve, 50));
  }
  throw new Error(`browser state timeout: ${JSON.stringify(state)}`);
}

async function click(client: CdpClient, sessionId: string, selector: string): Promise<void> {
  const point = await evaluatedValue(
    client,
    sessionId,
    `(() => {
    const node = document.querySelector(${JSON.stringify(selector)});
    if (!node) throw new Error('control absent');
    const rect = node.getBoundingClientRect();
    return { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2, disabled: node.disabled };
  })()`,
  ) as { x: number; y: number; disabled: boolean };
  if (point.disabled) throw new Error(`${selector} disabled`);
  await client.send("Input.dispatchMouseEvent", {
    type: "mousePressed",
    x: point.x,
    y: point.y,
    button: "left",
    clickCount: 1,
  }, sessionId);
  await client.send("Input.dispatchMouseEvent", {
    type: "mouseReleased",
    x: point.x,
    y: point.y,
    button: "left",
    clickCount: 1,
  }, sessionId);
}

const instrumentation = (fakeWorker: boolean) =>
  `(() => {
  const NativeWorker = globalThis.Worker;
  globalThis.__zipWorkers = [];
  globalThis.Worker = ${
    fakeWorker
      ? `class extends EventTarget {
    constructor(url, options) { super(); this.url=String(url); this.options=options; this.__terminated=false; globalThis.__zipWorkers.push(this); }
    postMessage(value) { this.lastMessage=value; }
    terminate() { this.__terminated=true; }
  }`
      : `class extends NativeWorker {
    constructor(...args) { super(...args); this.__terminated=false; globalThis.__zipWorkers.push(this); }
    terminate() { this.__terminated=true; return super.terminate(); }
  }`
  };
})()`;

async function captureHtml(client: CdpClient, sessionId: string, id: string, phase: string) {
  const html = String(
    await evaluatedValue(client, sessionId, "document.documentElement.outerHTML"),
  );
  return await writeRaw(`${id}/${phase}.html`, encoder.encode(html));
}
async function captureScreenshot(client: CdpClient, sessionId: string, id: string, phase: string) {
  const screenshot = await client.send(
    "Page.captureScreenshot",
    { format: "png", fromSurface: true, captureBeyondViewport: true },
    sessionId,
    10_000,
  );
  return await writeRaw(`${id}/${phase}.png`, decodeBase64(String(screenshot.data)));
}
async function captureAx(client: CdpClient, sessionId: string, id: string, phase: string) {
  const tree = await client.send("Accessibility.getFullAXTree", {}, sessionId, 10_000);
  return await writeRaw(`${id}/${phase}-ax.json`, encoder.encode(`${canonicalize(tree)}\n`));
}

async function collectScenario(
  client: CdpClient,
  origin: string,
  scenario: typeof ARCHIVE_ZIP_SCENARIOS[number],
): Promise<Record<string, unknown>> {
  const created = await client.send("Target.createTarget", { url: "about:blank" });
  const targetId = String(created.targetId);
  const attached = await client.send("Target.attachToTarget", { targetId, flatten: true });
  const sessionId = String(attached.sessionId);
  const fakeWorker = !["complete", "cancel", "closed-negative"].includes(scenario.kind);
  const sessionSources = new Map([[sessionId, "page"]]);
  const childTargets: Array<Record<string, unknown>> = [];
  const consoleEntries: Array<Record<string, unknown>> = [];
  const exceptions: Array<Record<string, unknown>> = [];
  const requests = new Map<string, Record<string, unknown>>();
  const bodyTasks: Promise<void>[] = [];
  const attachTasks: Promise<void>[] = [];
  const removers = [
    client.on("Target.attachedToTarget", (params, eventSession) => {
      if (eventSession !== sessionId) return;
      const info = params.targetInfo as Record<string, unknown>;
      if (info.type !== "worker") {
        throw new Error(`unexpected attached target type ${String(info.type)}`);
      }
      const childSession = String(params.sessionId);
      sessionSources.set(childSession, "worker");
      childTargets.push({
        targetId: String(info.targetId),
        sessionId: childSession,
        type: "worker",
      });
      attachTasks.push(
        Promise.all([
          client.send("Runtime.enable", {}, childSession),
          client.send("Network.enable", {}, childSession),
        ]).then(async () => {
          await client.send("Runtime.runIfWaitingForDebugger", {}, childSession);
        }),
      );
    }),
    client.on("Runtime.consoleAPICalled", (params, eventSession) => {
      if (!eventSession || !sessionSources.has(eventSession)) return;
      consoleEntries.push({
        sessionId: eventSession,
        source: sessionSources.get(eventSession),
        type: String(params.type),
        timestamp: Number(params.timestamp ?? 0),
        arguments: ((params.args as Array<Record<string, unknown>>) ?? []).map((arg) =>
          String(arg.value ?? arg.description ?? arg.type ?? "")
        ),
        stack: params.stackTrace ?? null,
      });
    }),
    client.on("Runtime.exceptionThrown", (params, eventSession) => {
      if (!eventSession || !sessionSources.has(eventSession)) return;
      const detail = params.exceptionDetails as Record<string, unknown>;
      exceptions.push({
        sessionId: eventSession,
        source: sessionSources.get(eventSession),
        timestamp: Number(params.timestamp ?? 0),
        text: String(detail.text ?? ""),
        lineNumber: Number(detail.lineNumber ?? 0),
        columnNumber: Number(detail.columnNumber ?? 0),
        url: String(detail.url ?? ""),
        stack: detail.stackTrace ?? null,
      });
    }),
    client.on("Network.requestWillBeSent", (params, eventSession) => {
      if (!eventSession || !sessionSources.has(eventSession)) return;
      const request = params.request as Record<string, unknown>;
      const url = String(request.url);
      if (!url.startsWith(`${origin}/`)) throw new Error(`unexpected network origin: ${url}`);
      const initiator = params.initiator as Record<string, unknown>;
      requests.set(`${eventSession}:${String(params.requestId)}`, {
        requestId: String(params.requestId),
        sessionId: eventSession,
        source: sessionSources.get(eventSession),
        url,
        method: String(request.method),
        type: String(params.type),
        initiator: String(initiator?.type ?? "other"),
        response: null,
        end: null,
        raw: null,
      });
    }),
    client.on("Network.responseReceived", (params, eventSession) => {
      if (!eventSession) return;
      const record = requests.get(`${eventSession}:${String(params.requestId)}`);
      if (!record) return;
      const response = params.response as Record<string, unknown>;
      record.response = {
        status: Number(response.status),
        mimeType: String(response.mimeType),
        protocol: String(response.protocol),
        fromDiskCache: Boolean(response.fromDiskCache),
        fromServiceWorker: Boolean(response.fromServiceWorker),
      };
    }),
    client.on("Network.loadingFinished", (params, eventSession) => {
      if (!eventSession) return;
      const record = requests.get(`${eventSession}:${String(params.requestId)}`);
      if (!record) return;
      record.end = {
        encodedDataLength: Number(params.encodedDataLength),
        failed: false,
        errorText: null,
        blockedReason: null,
      };
      bodyTasks.push((async () => {
        const response = await client.send(
          "Network.getResponseBody",
          { requestId: params.requestId },
          eventSession,
          10_000,
        );
        const bytes = response.base64Encoded
          ? decodeBase64(String(response.body))
          : encoder.encode(String(response.body));
        const ordinal = [...requests.keys()].indexOf(`${eventSession}:${String(params.requestId)}`);
        record.raw = await writeRaw(
          `${scenario.id}/network-${String(ordinal).padStart(2, "0")}.bin`,
          bytes,
        );
      })());
    }),
    client.on("Network.loadingFailed", (params, eventSession) => {
      if (!eventSession) return;
      const record = requests.get(`${eventSession}:${String(params.requestId)}`);
      if (record) {
        record.end = {
          encodedDataLength: 0,
          failed: true,
          errorText: String(params.errorText),
          blockedReason: params.blockedReason ? String(params.blockedReason) : null,
        };
      }
    }),
  ];
  try {
    await Promise.all([
      client.send("Page.enable", {}, sessionId),
      client.send("Runtime.enable", {}, sessionId),
      client.send("Network.enable", {}, sessionId),
      client.send("Accessibility.enable", {}, sessionId),
      client.send("Target.setAutoAttach", {
        autoAttach: true,
        waitForDebuggerOnStart: true,
        flatten: true,
      }, sessionId),
    ]);
    await client.send("Page.addScriptToEvaluateOnNewDocument", {
      source: instrumentation(fakeWorker),
    }, sessionId);
    const loaded = new Promise<void>((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error("page load timeout")), 10_000);
      const remove = client.on("Page.loadEventFired", (_params, eventSession) => {
        if (eventSession !== sessionId) return;
        clearTimeout(timer);
        remove();
        resolve();
      });
    });
    await client.send(
      "Page.navigate",
      { url: `${origin}/benchmarks/archive-zip-workspace-v1/` },
      sessionId,
    );
    await loaded;
    await waitState(client, sessionId, (state) => state.status === "Ready.");
    const checkpoints: Array<Record<string, unknown>> = [];
    const source = await captureHtml(client, sessionId, scenario.id, "source");
    const sourceScreenshot = await captureScreenshot(client, sessionId, scenario.id, "source");
    const sourceAccessibility = await captureAx(client, sessionId, scenario.id, "source");
    await checkpoint(checkpoints, client, sessionId, "ready");
    let negativeMessage: string | null = null;
    if (scenario.kind === "closed-negative") {
      negativeMessage = String(
        await evaluatedValue(
          client,
          sessionId,
          `new Promise((resolve, reject) => {
        const worker = new Worker('/archive-zip-worker.js', {type:'module'});
        const timer = setTimeout(() => reject(new Error('negative worker timeout')), 10000);
        worker.addEventListener('message', (event) => { clearTimeout(timer); worker.terminate(); resolve(event.data?.message ?? ''); }, {once:true});
        worker.addEventListener('error', (event) => { clearTimeout(timer); reject(new Error(event.message)); }, {once:true});
        worker.postMessage({token:73,target:${JSON.stringify(scenario.target)},mode:${
            JSON.stringify(scenario.mode)
          }});
      })`,
          true,
        ),
      );
      const wanted = scenario.id === "unknown-target" ? "unknown target" : "unknown demo mode";
      if (negativeMessage !== wanted) {
        throw new Error(`${scenario.id} did not fail closed: ${negativeMessage}`);
      }
      await evaluatedValue(
        client,
        sessionId,
        `(() => { document.querySelector('#status').textContent='Closed negative passed.'; document.querySelector('#output').textContent=${
          JSON.stringify(negativeMessage)
        }; })()`,
      );
      await checkpoint(checkpoints, client, sessionId, "closed-negative-rejected");
    } else {
      await evaluatedValue(
        client,
        sessionId,
        `(() => { document.querySelector('#target').value=${
          JSON.stringify(scenario.target)
        }; document.querySelector('#mode').value=${JSON.stringify(scenario.mode)}; })()`,
      );
      await click(client, sessionId, "#start");
      await checkpoint(checkpoints, client, sessionId, "started");
      if (scenario.kind === "complete") {
        await waitState(
          client,
          sessionId,
          (state) => String(state.status).includes("validation passed."),
        );
        await checkpoint(checkpoints, client, sessionId, "completed");
      } else if (scenario.kind === "cancel") {
        await click(client, sessionId, "#cancel");
        await waitState(client, sessionId, (state) => state.status === "Cancelled.");
        await checkpoint(checkpoints, client, sessionId, "cancel-terminated");
      } else if (scenario.kind === "wrong-token") {
        await evaluatedValue(
          client,
          sessionId,
          `globalThis.__zipWorkers[0].dispatchEvent(new MessageEvent('message',{data:{token:999,type:'complete',mode:'full',target:'wasm'}}))`,
        );
        const ignored = await checkpoint(checkpoints, client, sessionId, "wrong-token-ignored");
        if (!String(ignored.status).startsWith("Running ")) {
          throw new Error("wrong token changed state");
        }
        await click(client, sessionId, "#cancel");
        await checkpoint(checkpoints, client, sessionId, "wrong-token-cleanup");
      } else if (scenario.kind === "stale") {
        await evaluatedValue(
          client,
          sessionId,
          `document.querySelector('form').dispatchEvent(new SubmitEvent('submit',{bubbles:true,cancelable:true}))`,
        );
        await evaluatedValue(
          client,
          sessionId,
          `globalThis.__zipWorkers[0].dispatchEvent(new MessageEvent('message',{data:{token:1,type:'complete',mode:'full',target:'wasm'}}))`,
        );
        const ignored = await checkpoint(
          checkpoints,
          client,
          sessionId,
          "stale-completion-ignored",
        );
        if (
          !String(ignored.status).startsWith("Running ") || Number(ignored.workerCount) !== 2 ||
          Number(ignored.terminatedWorkers) !== 1
        ) throw new Error("stale completion changed replacement run");
        await click(client, sessionId, "#cancel");
        await checkpoint(checkpoints, client, sessionId, "stale-cleanup");
      } else if (scenario.kind === "restart") {
        await evaluatedValue(
          client,
          sessionId,
          `document.querySelector('form').dispatchEvent(new SubmitEvent('submit',{bubbles:true,cancelable:true}))`,
        );
        const restarted = await checkpoint(
          checkpoints,
          client,
          sessionId,
          "restart-replaced-worker",
        );
        if (Number(restarted.workerCount) !== 2 || Number(restarted.terminatedWorkers) !== 1) {
          throw new Error("restart did not replace worker exactly once");
        }
        await click(client, sessionId, "#cancel");
        await checkpoint(checkpoints, client, sessionId, "restart-cleanup");
      } else if (scenario.kind === "timeout") {
        await waitState(
          client,
          sessionId,
          (state) => String(state.status).startsWith("Stopped after the 10 second bound."),
          12_000,
        );
        await checkpoint(checkpoints, client, sessionId, "timeout-terminated");
      } else if (scenario.kind === "pagehide") {
        await evaluatedValue(
          client,
          sessionId,
          `dispatchEvent(new PageTransitionEvent('pagehide'))`,
        );
        const hidden = await checkpoint(checkpoints, client, sessionId, "pagehide-terminated");
        if (Number(hidden.terminatedWorkers) !== 1) {
          throw new Error("pagehide did not terminate worker");
        }
      }
    }
    await Promise.all(attachTasks);
    await Promise.all(bodyTasks);
    await new Promise((resolve) => setTimeout(resolve, 50));
    await Promise.all(bodyTasks);
    const finalState = await pageState(client, sessionId);
    const result = scenario.kind === "complete"
      ? parseArchiveZipVisibleResult(String(finalState.output))
      : null;
    const assertions = scenario.kind === "complete"
      ? [
        "visible Start control completed",
        "raw source, end-state, and network response bytes were retained",
        "oracle and every target-specific counter matched",
      ]
      : scenario.kind === "closed-negative"
      ? [
        "worker accepted no open target or mode",
        `exact semantic error retained: ${negativeMessage}`,
      ]
      : [
        "causal precondition checkpoint retained",
        `${scenario.kind} termination or ignore effect retained`,
        "no partial semantic result retained",
      ];
    if (exceptions.length) throw new Error(`${scenario.id} raised exceptions`);
    if (consoleEntries.some((entry) => entry.type === "error")) {
      throw new Error(`${scenario.id} logged console errors`);
    }
    const network = [...requests.values()];
    if (
      network.some((record) =>
        !record.response || !record.end || !record.raw ||
        (record.end as Record<string, unknown>).failed
      )
    ) {
      throw new Error(`${scenario.id} has incomplete network evidence`);
    }
    const end = await captureHtml(client, sessionId, scenario.id, "end");
    const endScreenshot = await captureScreenshot(client, sessionId, scenario.id, "end");
    const endAccessibility = await captureAx(client, sessionId, scenario.id, "end");
    return {
      id: scenario.id,
      kind: scenario.kind,
      target: scenario.target,
      mode: scenario.mode,
      route: "/benchmarks/archive-zip-workspace-v1/",
      targetOwnership: { targetId, pageSessionId: sessionId, childTargets },
      source,
      end,
      checkpoints,
      result,
      assertions,
      console: consoleEntries,
      exceptions,
      network,
      accessibility: { source: sourceAccessibility, end: endAccessibility },
      screenshots: { source: sourceScreenshot, end: endScreenshot },
    };
  } finally {
    for (const remove of removers) remove();
    await client.send("Target.closeTarget", { targetId }).catch(() => {});
  }
}

let server: Deno.ChildProcess | undefined;
let serverIdentity: ProcessIdentity | null = null;
let serverStatus: Promise<Deno.CommandStatus> | undefined;
let stage: StagedChrome | undefined;
let owned: OwnedChrome | undefined;
let browserCleanup: Awaited<ReturnType<typeof closeOwnedChrome>> | undefined;
let stageRemoved = false;
let serverCleanup: {
  identityMatched: true;
  signal: "SIGTERM";
  processAbsent: true;
  exit: Deno.CommandStatus;
} | undefined;
let published = false;
const lifecycle = new StageCleanupLifecycle();

try {
  await mustBeAbsent(finalPath);
  await mustBeAbsent(candidatePath);
  await Deno.mkdir(new URL("raw/", candidatePath), { recursive: true });
  const source = await sourceIdentity();
  const inspected = await inspectChromePackage(POLICY.sourceBinary, POLICY.binarySha256);
  if (inspected.manifestSha256 !== POLICY.packageManifestSha256) {
    throw new Error("CfT package manifest mismatch");
  }
  const stageId = `archive-zip-${sourceCommit.slice(0, 12)}-${
    crypto.randomUUID().replaceAll("-", "").slice(0, 16)
  }`;
  const authorization = {
    permitId: stageId,
    sourceCommit,
    chromePackageManifestSha256: POLICY.packageManifestSha256,
  };
  stage = await stageChromePackage(POLICY.sourceBinary, POLICY.binarySha256, authorization);
  const port = unusedPort();
  const origin = `http://127.0.0.1:${port}`;
  server = new Deno.Command(Deno.execPath(), {
    cwd: root,
    args: [
      "run",
      "--allow-env=PORT,HOST,SERVER_MODE",
      "--allow-net=127.0.0.1",
      "--allow-read=.",
      "deploy.ts",
    ],
    env: { PORT: String(port), HOST: "127.0.0.1", SERVER_MODE: "public" },
    stdout: "null",
    stderr: "null",
  }).spawn();
  serverStatus = server.status;
  serverIdentity = await processIdentity(server.pid);
  if (!serverIdentity) throw new Error("evidence server identity unavailable");
  await waitFor(`${origin}/healthz`);
  try {
    owned = await launchOwnedChrome({
      stagedChrome: stage,
      profileRoot: `/tmp/wasm-vs-js-owned-profiles/${stageId}/profile`,
      extraArguments: [...POLICY.extraArguments],
      onSpawn: () => {
        lifecycle.launchBegan();
        recordStageCleanupLifecycle(stage!, "owned-launch-active");
      },
    });
  } catch (error) {
    if (error instanceof ChromeLaunchLifecycleError) {
      if (error.cleanupResolved && lifecycle.state === "owned-launch-active") {
        lifecycle.cleanupVerified();
      } else if (!error.cleanupResolved) lifecycle.cleanupUnresolved();
      recordStageCleanupLifecycle(stage, lifecycle.state);
    }
    throw error;
  }
  if (owned.version.product !== POLICY.cdpProduct) {
    throw new Error(`unexpected CfT ${String(owned.version.product)}`);
  }
  const effective = await owned.browser.send("Browser.getBrowserCommandLine");
  const effectiveArguments = effective.arguments as string[];
  if (
    !Array.isArray(effectiveArguments) ||
    !POLICY.extraArguments.every((argument) => effectiveArguments.includes(argument))
  ) {
    throw new Error("effective CfT launch arguments mismatch");
  }
  const records = [];
  for (const scenario of ARCHIVE_ZIP_SCENARIOS) {
    records.push(await collectScenario(owned.browser as CdpClient, origin, scenario));
  }
  owned.ledger = await refreshLedger(owned.ledger);
  browserCleanup = await closeOwnedChrome(owned);
  lifecycle.cleanupVerified();
  recordStageCleanupLifecycle(stage, "cleanup-verified");
  await removeStagedChrome(stage);
  stageRemoved = true;
  if (!serverIdentity || !(await sameProcess(serverIdentity))) {
    throw new Error("evidence server identity changed before cleanup");
  }
  Deno.kill(serverIdentity.pid, "SIGTERM");
  const exit = await serverStatus!;
  if (await sameProcess(serverIdentity)) throw new Error("evidence server survived cleanup");
  serverCleanup = { identityMatched: true, signal: "SIGTERM", processAbsent: true, exit };
  const profilePath = owned.ledger.profileRoot;
  let profileAbsent = false;
  try {
    await Deno.lstat(profilePath);
  } catch (error) {
    if (error instanceof Deno.errors.NotFound) profileAbsent = true;
    else throw error;
  }
  let stageAbsent = false;
  try {
    await Deno.lstat(stage.root);
  } catch (error) {
    if (error instanceof Deno.errors.NotFound) stageAbsent = true;
    else throw error;
  }
  const evidence = {
    schemaVersion: 1,
    evidenceId: `archive-zip-workspace-browser-${sourceCommit}-v1`,
    collectedAt: new Date().toISOString(),
    source,
    collector: {
      command: "deno task --config deno.corpus.json browser:collect-archive-zip",
      startedAt,
      endedAt: new Date().toISOString(),
      setupCleanupProtected: true,
      performanceEvidence: false,
    },
    browser: {
      channel: POLICY.channel,
      productName: POLICY.productName,
      version: POLICY.version,
      cdpProduct: String(owned.version.product),
      revision: String(owned.version.revision),
      userAgent: String(owned.version.userAgent),
      jsVersion: String(owned.version.jsVersion),
      sourceBinary: POLICY.sourceBinary,
      resolvedStagedBinary: owned.resolvedBinary,
      binarySha256: owned.binarySha256,
      packageManifestSha256: stage.manifestSha256,
      packageFileCount: Object.keys(stage.files).length,
      requestedArguments: owned.arguments,
      effectiveArguments,
      headless: true,
      protocol: "Chrome DevTools Protocol",
    },
    server: { origin, mode: "public", process: serverIdentity },
    scenarios: records,
    ownership: {
      systemdUnit: owned.ledger.unit,
      controlGroup: owned.ledger.controlGroup,
      cgroupPath: owned.ledger.cgroupPath,
      cgroupDev: owned.ledger.cgroupDev,
      cgroupIno: owned.ledger.cgroupIno,
      invocationId: owned.ledger.invocationId,
      mainPid: owned.ledger.mainPid,
      commandLine: owned.ledger.commandLine,
      membershipSnapshots: owned.ledger.membershipSnapshots,
      allTargetSessionsOwned: true,
    },
    cleanup: {
      browser: {
        cgroupKilled: browserCleanup.cleaned,
        remaining: browserCleanup.remaining,
        identityMismatches: browserCleanup.identityMismatches,
        stoppedAt: browserCleanup.stoppedAt,
      },
      profile: { path: profilePath, absent: profileAbsent },
      stage: { path: stage.root, lifecycle: lifecycle.state, absent: stageAbsent },
      server: serverCleanup,
      candidatePublished: true,
    },
  };
  assertArchiveZipScenarioSemantics(evidence);
  const schema = JSON.parse(
    await Deno.readTextFile(new URL("schemas/archive-zip-browser-evidence.schema.json", root)),
  );
  const ajv = new Ajv2020({ strict: true, allErrors: true });
  addFormats(ajv);
  const validate = ajv.compile(schema);
  if (!validate(evidence)) {
    throw new Error(`browser evidence schema failed: ${JSON.stringify(validate.errors)}`);
  }
  await verifyRawArtifacts(evidence.scenarios);
  await Deno.writeTextFile(
    new URL("evidence.v1.json", candidatePath),
    `${canonicalize(evidence)}\n`,
  );
  await Deno.rename(candidatePath, finalPath);
  published = true;
  console.log(
    `archive-zip browser evidence: ${records.length} scenarios; cgroup, profile, stage, and server cleanup exact`,
  );
} finally {
  if (!browserCleanup && owned) {
    try {
      browserCleanup = await closeOwnedChrome(owned);
      if (lifecycle.state === "owned-launch-active") lifecycle.cleanupVerified();
      if (stage) recordStageCleanupLifecycle(stage, lifecycle.state);
    } catch {
      lifecycle.cleanupUnresolved();
      if (stage) {
        try {
          recordStageCleanupLifecycle(stage, "cleanup-unresolved");
        } catch { /* preserve unresolved stage for investigation */ }
      }
    }
  }
  if (stage && !stageRemoved && lifecycle.disposition === "remove-stage") {
    await removeStagedChrome(stage).then(() => stageRemoved = true).catch(() => {});
  }
  if (server && serverIdentity && await sameProcess(serverIdentity)) {
    Deno.kill(serverIdentity.pid, "SIGTERM");
  }
  await serverStatus?.catch(() => {});
  if (!published) await Deno.remove(candidatePath, { recursive: true }).catch(() => {});
}
