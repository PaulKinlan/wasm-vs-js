import Ajv2020Module from "ajv2020";
import { sha256Hex } from "../lib/canonical.ts";
import {
  TRADITIONAL_DEMO_ASSET_PATHS,
  TRADITIONAL_DEMO_ROUTES,
} from "../lib/traditional-demo-registry.ts";
import { createHandler } from "../server.ts";
import { assert, assertEquals } from "./assert.ts";

import {
  generateRegexFixture,
  scanJSAutomata,
  scanNativeRegExp,
  scanWasmAutomata,
} from "../public/benchmarks/regex-automata-duel-demo/engine.js";
import {
  generateVDOMFixture,
  runVdomJS,
  runVdomWasm,
} from "../public/benchmarks/vdom-diff-patch-demo/engine.js";

type Validator = ((value: unknown) => boolean) & { errors?: unknown };
type AjvConstructor = new (options?: Record<string, unknown>) => {
  compile: (schema: unknown) => Validator;
};
const Ajv2020 = ((Ajv2020Module as unknown as { default?: AjvConstructor }).default ??
  Ajv2020Module) as unknown as AjvConstructor;
const MANIFEST_PATH = "public/artifacts/traditional-demos/demo-manifest.v1.json";
const _ENGINE_COMMIT = "3b85ac13019808920bc96e287a20bc2a83cd7bf8";

Deno.test("traditional demo manifest is closed, reduced, reproducible, and engine-commit-bound", async () => {
  const schema = JSON.parse(
    await Deno.readTextFile("schemas/traditional-demo-manifest.schema.json"),
  );
  const manifest = JSON.parse(await Deno.readTextFile(MANIFEST_PATH));
  const validate = new Ajv2020({ strict: true, allErrors: true }).compile(schema);
  assert(validate(manifest), JSON.stringify(validate.errors));
  const sourceCommit = (await Deno.readTextFile(
    "artifacts/demos/traditional/source-commit.txt",
  )).trim();
  assertEquals(manifest.sourceCommit, sourceCommit);
  const treeResult = await new Deno.Command("git", {
    args: ["rev-parse", `${sourceCommit}^{tree}`],
    stdout: "piped",
  }).output();
  assert(treeResult.success);
  assertEquals(manifest.sourceTree, new TextDecoder().decode(treeResult.stdout).trim());
  assertEquals(manifest.catalogV1Coverage, "0/38");
  assertEquals(manifest.authoritativePerformanceEvidence, false);
  assertEquals(
    manifest.demos.map((demo: { fullContract: { status: string } }) => demo.fullContract.status),
    ["unavailable", "unavailable"],
  );
  assertEquals(manifest.demos[0].fixture.corpusBytes, 1_048_576);
  assertEquals(manifest.demos[0].fixture.patterns, 20);
  assertEquals(
    manifest.demos[0].fixture.inputSha256,
    "511c892cd731b740afae39f7c053be4455a6c1cd4a7dd7ac4fc09f92859d072e",
  );
  assertEquals(manifest.demos[1].fixture.nodes, 1_000);
  assertEquals(manifest.demos[1].fixture.edits, 250);
  assertEquals(
    manifest.demos[1].fixture.inputSha256,
    "e0cd8896cbcac384c7ca9d2c0bb97d0d15685c5c19038a1f5010159f77a08563",
  );
  assertEquals(manifest.assets.map((asset: { route: string }) => asset.route), [
    ...TRADITIONAL_DEMO_ASSET_PATHS,
  ]);
  for (const record of [...manifest.assets, ...manifest.sources]) {
    if (record.path === "public/benchmarks/index.html") continue;
    const bytes = await Deno.readFile(record.path);
    assertEquals(bytes.byteLength, record.bytes);
    assertEquals(await sha256Hex(bytes), record.sha256);
  }
  for (const record of manifest.sources) {
    const committed = await new Deno.Command("git", {
      args: ["show", `${sourceCommit}:${record.path}`],
      stdout: "piped",
      stderr: "piped",
    }).output();
    assert(committed.success, `${record.path} is absent from source commit ${sourceCommit}`);
    assertEquals(committed.stdout.byteLength, record.bytes);
    assertEquals(await sha256Hex(committed.stdout), record.sha256);
  }
  for (const id of ["regex-automata-duel", "vdom-diff-patch"]) {
    const engineManifest = JSON.parse(
      await Deno.readTextFile(`public/artifacts/${id}/build-manifest.json`),
    );
    assert(/^[a-f0-9]{40}$/.test(engineManifest.sourceCommit));
  }

  const expectedOutputs = new Map<string, Uint8Array>();
  for (
    const path of [
      MANIFEST_PATH,
      "public/benchmarks/regex-automata-duel-demo/engine.js",
      "public/benchmarks/vdom-diff-patch-demo/engine.js",
    ]
  ) expectedOutputs.set(path, await Deno.readFile(path));

  const tempRoot = await Deno.makeTempDir({ prefix: "traditional-demo-source-checkout-" });
  const checkout = `${tempRoot}/source`;
  try {
    const add = await new Deno.Command("git", {
      args: ["worktree", "add", "--detach", checkout, sourceCommit],
      stdout: "piped",
      stderr: "piped",
    }).output();
    assert(add.success, new TextDecoder().decode(add.stderr));
    const output = await new Deno.Command(Deno.execPath(), {
      cwd: checkout,
      args: [
        "run",
        "--allow-read=.",
        "--allow-write=public/benchmarks/regex-automata-duel-demo,public/benchmarks/vdom-diff-patch-demo,public/artifacts/traditional-demos",
        "--allow-run",
        "scripts/build-traditional-demos.ts",
        `--source-commit=${sourceCommit}`,
      ],
      stdout: "piped",
      stderr: "piped",
    }).output();
    assert(output.success, new TextDecoder().decode(output.stderr));
    for (const [path, expected] of expectedOutputs) {
      assertEquals(await Deno.readFile(`${checkout}/${path}`), expected);
    }
  } finally {
    await new Deno.Command("git", {
      args: ["worktree", "remove", "--force", checkout],
      stdout: "null",
      stderr: "null",
    }).output();
    await Deno.remove(tempRoot, { recursive: true }).catch(() => {});
  }
});

Deno.test("traditional browser engines retain exact regex and VDOM oracles and counters", async () => {
  const regexFixture = generateRegexFixture();
  const regexNative = await scanNativeRegExp(regexFixture);
  const regexJs = await scanJSAutomata(regexFixture);
  const regexWasmBytes = await Deno.readFile(
    "public/artifacts/regex-automata-duel/regex-automata-duel.wasm",
  );
  const regexWasm = await scanWasmAutomata(
    regexFixture,
    await WebAssembly.instantiate(await WebAssembly.compile(regexWasmBytes), {}),
  );
  for (const result of [regexNative, regexJs, regexWasm]) {
    assertEquals(
      result.oracleHash,
      "09034692437c8a59f1c82015c0b4e3483de7124ced5d56f1de44eac989b4b3c0",
    );
    assertEquals(result.codePointsSearched, 20_971_520);
    assertEquals(result.patternsExecuted, 20);
    assertEquals(result.matchesFound, 141_605);
    assertEquals(result.capturesExtracted, 1_623);
  }
  assertEquals(regexNative.boundaryCrossings, 0);
  assertEquals(regexJs.boundaryCrossings, 0);
  assertEquals(regexWasm.boundaryCrossings, 20);

  const vdomFixture = generateVDOMFixture();
  const vdomJs = await runVdomJS(vdomFixture);
  const vdomWasmBytes = await Deno.readFile(
    "public/artifacts/vdom-diff-patch/vdom-diff-patch.wasm",
  );
  const vdomWasm = await runVdomWasm(
    vdomFixture,
    await WebAssembly.instantiate(await WebAssembly.compile(vdomWasmBytes), {}),
  );
  for (const result of [vdomJs, vdomWasm]) {
    assertEquals(
      result.patchDigestSha256,
      "d56d2533821727e9b23af28622fb25b3e26011e2858eb7ab98232e81fafb3afd",
    );
    assertEquals(
      result.canonicalHtmlHash,
      "172478394b1ba6762f0b8804fe00d5d3b1a1bf52df1c56f5efefa7523e9d1d1c",
    );
    assertEquals(result.targetHtmlHash, result.canonicalHtmlHash);
    assertEquals(result.nodesVisited, 4_000);
    assertEquals(result.patchesGenerated, 250);
    assertEquals(result.domMutations, 250);
  }
  assertEquals(vdomJs.boundaryCrossings, 0);
  assertEquals(vdomWasm.boundaryCrossings, 1);
});

Deno.test("traditional demo routes are an exact read-only allowlist", async () => {
  const expected = [
    "/benchmarks/regex-automata-duel-demo",
    "/benchmarks/regex-automata-duel-demo/",
    "/benchmarks/vdom-diff-patch-demo",
    "/benchmarks/vdom-diff-patch-demo/",
    "/benchmarks/traditional-demo.css",
    "/benchmarks/traditional-demo.js",
    "/benchmarks/regex-automata-duel-demo/worker.js",
    "/benchmarks/regex-automata-duel-demo/engine.js",
    "/benchmarks/vdom-diff-patch-demo/worker.js",
    "/benchmarks/vdom-diff-patch-demo/engine.js",
    "/benchmarks/regex-automata-duel/benchmark.json",
    "/benchmarks/regex-automata-duel/workload.js",
    "/benchmarks/regex-automata-duel/input.ts",
    "/benchmarks/regex-automata-duel/js-native.ts",
    "/benchmarks/regex-automata-duel/js-automata.ts",
    "/benchmarks/regex-automata-duel/regex-automata.wat",
    "/benchmarks/vdom-diff-patch/benchmark.json",
    "/benchmarks/vdom-diff-patch/workload.js",
    "/benchmarks/vdom-diff-patch/input.ts",
    "/benchmarks/vdom-diff-patch/js.ts",
    "/benchmarks/vdom-diff-patch/vdom-diff-patch.wat",
    "/artifacts/regex-automata-duel/regex-automata-duel.wasm",
    "/artifacts/regex-automata-duel/build-manifest.json",
    "/artifacts/vdom-diff-patch/vdom-diff-patch.wasm",
    "/artifacts/vdom-diff-patch/build-manifest.json",
    "/artifacts/traditional-demos/demo-manifest.v1.json",
    "/data/traditional-demo-manifest.schema.json",
  ];
  assertEquals(TRADITIONAL_DEMO_ROUTES.map((route) => route.path), expected);
  assertEquals(new Set(expected).size, expected.length);
  assert(
    TRADITIONAL_DEMO_ROUTES.every((route) =>
      !route.path.includes("*") && !route.path.includes("..")
    ),
  );

  const handler = createHandler(null, "public");
  for (const route of TRADITIONAL_DEMO_ROUTES) {
    const response = await handler(new Request(`http://127.0.0.1${route.path}`));
    assertEquals(response.status, 200);
    assertEquals(response.headers.get("content-type"), route.contentType);
    assertEquals(
      (await handler(new Request(`http://127.0.0.1${route.path}`, { method: "HEAD" }))).status,
      200,
    );
    assertEquals(
      (await handler(new Request(`http://127.0.0.1${route.path}`, { method: "POST" }))).status,
      403,
    );
  }
  for (
    const denied of [
      "/benchmarks/regex-automata-duel-demo/unknown.js",
      "/benchmarks/vdom-diff-patch-demo%2F..%2Fregex-automata-duel-demo%2Fworker.js",
      "/artifacts/traditional-demos/unknown.json",
      "/artifacts/traditional-demos%2F..%2Fsum-u32%2Fsum-u32.wasm",
    ]
  ) assertEquals((await handler(new Request(`http://127.0.0.1${denied}`))).status, 404);
});

Deno.test("retained Chrome 150 evidence covers controls, every target, network, screenshots, and exact cleanup", async () => {
  const schema = JSON.parse(
    await Deno.readTextFile("schemas/traditional-demo-browser-evidence.schema.json"),
  );
  const evidence = JSON.parse(
    await Deno.readTextFile("artifacts/demos/traditional/browser-evidence/evidence.v1.json"),
  );
  const manifest = JSON.parse(await Deno.readTextFile(MANIFEST_PATH));
  const validate = new Ajv2020({ strict: true, allErrors: true }).compile(schema);
  assert(validate(evidence), JSON.stringify(validate.errors));
  assertEquals(evidence.source, {
    commit: manifest.sourceCommit,
    tree: manifest.sourceTree,
  });
  assertEquals(evidence.browser.product, "Chrome/150.0.7871.24");
  assert(evidence.browser.launchArguments.includes("--headless=new"));
  assert(evidence.browser.launchArguments.includes("--remote-debugging-address=127.0.0.1"));
  assert(
    evidence.browser.launchArguments.some((arg: string) =>
      arg.startsWith("--user-data-dir=/tmp/wasm-traditional-chrome-")
    ),
  );
  assertEquals(
    evidence.scenarios.map((scenario: { id: string }) => scenario.id),
    [
      "regex-js-native",
      "regex-js-automata",
      "regex-wasm-automata",
      "vdom-js-browser-dom",
      "vdom-wasm-browser-dom",
      "regex-cancel-control",
    ],
  );
  assertEquals(
    evidence.scenarios
      .filter((scenario: { action: string }) => scenario.action === "complete")
      .map((scenario: { target: string }) => scenario.target)
      .sort(),
    [
      "js-automata-controlled",
      "js-controlled",
      "js-native-controlled",
      "wasm-automata-controlled",
      "wasm-linear-controlled",
    ],
  );
  const allowedNetworkPaths = new Set([
    ...TRADITIONAL_DEMO_ROUTES.map((route) => route.path),
    "/favicon.ico",
  ]);
  for (const scenario of evidence.scenarios) {
    assertEquals(scenario.exceptions, []);
    assert(scenario.console.every((entry: { type: string }) => entry.type !== "error"));
    assert(scenario.network.length >= 3);
    for (const request of scenario.network) {
      assertEquals(new URL(request.url).origin, evidence.server.origin);
      assert(allowedNetworkPaths.has(new URL(request.url).pathname));
      assertEquals(request.status, 200);
      assertEquals(request.failed, false);
      assertEquals(request.fromServiceWorker, false);
    }
    const screenshot = await Deno.readFile(scenario.screenshot.path);
    assertEquals([...screenshot.slice(0, 8)], [137, 80, 78, 71, 13, 10, 26, 10]);
    assertEquals(screenshot.byteLength, scenario.screenshot.bytes);
    assertEquals(await sha256Hex(screenshot), scenario.screenshot.sha256);
  }
  assert(evidence.scenarios[3].assertions.includes("canonical browser DOM SHA-256 matched"));
  assert(evidence.scenarios[4].assertions.includes("canonical browser DOM SHA-256 matched"));
  assert(evidence.scenarios[5].finalStatus.startsWith("Canceled."));
  assertEquals(evidence.cleanup.browser.requested, "Browser.close");
  assertEquals(evidence.cleanup.browser.processesAbsent, true);
  assertEquals(evidence.cleanup.profile.removed, true);
  assertEquals(evidence.cleanup.profile.absent, true);
  assertEquals(evidence.cleanup.server.processAbsent, true);
  const observedPids = new Set(
    evidence.cleanup.browser.observedProcesses.map((process: { pid: number }) => process.pid),
  );
  assert(observedPids.has(evidence.cleanup.browser.launcher.pid));
  assert(
    evidence.cleanup.browser.signals.every((signal: { pid: number }) =>
      observedPids.has(signal.pid)
    ),
  );
});

Deno.test("raw traditional demo HTML and controller freeze scope, accessibility, and cleanup", async () => {
  const regex = await Deno.readTextFile(
    "public/benchmarks/regex-automata-duel-demo/index.html",
  );
  const vdom = await Deno.readTextFile("public/benchmarks/vdom-diff-patch-demo/index.html");
  for (const html of [regex, vdom]) {
    assert(html.includes("Reduced out-of-catalog fixture"));
    assert(html.includes("fresh module worker"));
    assert(html.includes('id="start" type="submit" disabled'));
    assert(html.includes('id="cancel"'));
    assert(html.includes("<noscript>"));
    assert(html.includes("Unavailable: JavaScript and module workers are required"));
    assert(html.includes('aria-live="polite"'));
    assert(html.includes("raw HTML response"));
    assert(html.includes("frozen-v1 coverage at 0/38"));
    assert(html.includes("no performance ranking"));
  }
  assert(regex.includes("1 MiB / 20 patterns"));
  assert(regex.includes("32 MiB and 40 patterns"));
  assert(vdom.includes("1,000 nodes / 250 edits"));
  assert(vdom.includes("10,000 nodes and 2,000 edits"));
  assert(vdom.includes('id="vdom-mount"'));
  assert(vdom.includes("real <code>DOMHostAdapter</code>"));
  assert(!vdom.includes("not visible browser DOM"));

  const main = await Deno.readTextFile("public/benchmarks/traditional-demo.js");
  const workers = [
    await Deno.readTextFile("public/benchmarks/regex-automata-duel-demo/worker.js"),
    await Deno.readTextFile("public/benchmarks/vdom-diff-patch-demo/worker.js"),
  ];
  assert(main.includes('new Worker(demo.worker, { type: "module" })'));
  assert(main.includes("const TIMEOUT_MS = 30_000"));
  assert(main.includes("active.token !== token"));
  assert(main.includes("worker.terminate()"));
  assert(main.includes("pagehide"));
  assert(main.includes("payload.fullContract.status"));
  assert(main.includes("status.textContent = `Unavailable:"));
  assert(main.includes("new DOMHostAdapter(document, vdomMount)"));
  assert(main.includes("adapter.applyPatches(payload.domApplication.patches)"));
  assert(main.includes("real browser DOM oracle mismatch"));
  assert(workers[1].includes("patches: result.patches"));
  assert(workers[1].includes("treeA: fixture.treeA"));
  for (const worker of workers) {
    assert(worker.includes('status: "unavailable"'));
    assert(worker.includes('reasonCode: "full-contract-not-implemented"'));
    assert(worker.includes("input hash mismatch"));
  }
  for (
    const forbidden of [
      "/api/runs",
      'method: "POST"',
      "sendBeacon",
      "XMLHttpRequest",
      "WebSocket",
      "localStorage",
      "sessionStorage",
      "indexedDB",
      "document.cookie",
      "serviceWorker.register",
    ]
  ) {
    assert(!main.includes(forbidden), `controller contains forbidden surface: ${forbidden}`);
    for (const worker of workers) {
      assert(!worker.includes(forbidden), `worker contains forbidden surface: ${forbidden}`);
    }
  }
  assert(!main.includes("innerHTML"));
  assert(workers.every((worker) => !worker.includes("innerHTML")));
});
