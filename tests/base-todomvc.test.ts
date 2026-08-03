import Ajv2020Module from "ajv2020";
import wabtFactory from "wabt";
import {
  assertCompleteNetwork,
  assertCompleteTodoEvidence,
  assertLifecycleEvidence,
} from "../lib/base-todomvc-gate.ts";
import { sha256Hex } from "../lib/canonical.ts";
import { createHandler } from "../server.ts";
import {
  ACTION,
  encodeActionTrace,
  finalAxOracle,
  finalDomOracle,
  fixtureDocument,
  generateActionTrace,
} from "../benchmarks/base/dom-todomvc-journey/fixture.js";
import {
  assertEquivalent,
  instantiateTodoWasm,
  runJavaScript,
  runWasm,
} from "../benchmarks/base/dom-todomvc-journey/engine.js";
import { assert, assertEquals, assertRejects } from "./assert.ts";

type Validator = ((value: unknown) => boolean) & { errors?: unknown };
type AjvConstructor = new (options?: Record<string, unknown>) => {
  compile: (schema: unknown) => Validator;
};
const Ajv2020 = ((Ajv2020Module as unknown as { default?: AjvConstructor }).default ??
  Ajv2020Module) as unknown as AjvConstructor;

function assertThrows(fn: () => unknown, includes: string): void {
  try {
    fn();
  } catch (error) {
    if (error instanceof Error && error.message.includes(includes)) return;
    throw error;
  }
  throw new Error("expected exception");
}

async function compileWasm() {
  const wat = await Deno.readTextFile("benchmarks/base/dom-todomvc-journey/todomvc.wat");
  const wabt = await wabtFactory();
  const parsed = wabt.parseWat("todomvc.wat", wat, {
    exceptions: false,
    threads: false,
    simd: false,
  });
  parsed.resolveNames();
  parsed.validate();
  const binary = parsed.toBinary({ canonicalize_lebs: true, write_debug_names: false });
  parsed.destroy();
  return new Uint8Array(binary.buffer);
}

Deno.test("base TodoMVC fixture freezes 100 labels and the complete 150-action journey", () => {
  const fixture = fixtureDocument();
  assertEquals(fixture.labels.length, 100);
  assertEquals(fixture.actions.length, 150);
  assertEquals(fixture.viewport, { width: 1280, height: 720, deviceScaleFactor: 1 });
  const counts = new Map<number, number>();
  for (const action of fixture.actions) {
    counts.set(action.opcode, (counts.get(action.opcode) ?? 0) + 1);
  }
  assertEquals(counts.get(ACTION.ADD), 100);
  assertEquals(counts.get(ACTION.TOGGLE), 34);
  assertEquals(counts.get(ACTION.FILTER), 3);
  assertEquals(counts.get(ACTION.REMOVE), 10);
  assertEquals(counts.get(ACTION.EDIT), 3);
  assert(fixture.labels.some((label) => label.includes("東京")));
  assert(fixture.labels.some((label) => label.includes("🚀")));
  const dom = finalDomOracle();
  assertEquals(dom.length, 90);
  assertEquals(
    dom.map(({ id }) => id),
    Array.from({ length: 100 }, (_, id) => id).filter((id) => id % 10 !== 0),
  );
  for (const item of dom) {
    assertEquals(item.completed, item.id % 3 === 0);
    assertEquals(item.editHidden, item.id !== 95);
    assertEquals(item.editValue, item.label);
  }
  assertEquals(finalAxOracle().map(({ id }) => id), dom.map(({ id }) => id));
  assertEquals(fixture.rights.licenseSpdx, "CC0-1.0");
  assertEquals(fixture.rights.redistribution, "permitted");
});

Deno.test("JavaScript and material Wasm own identical state and typed command semantics", async () => {
  const wasm = await compileWasm();
  const js = runJavaScript();
  const linear = runWasm(await instantiateTodoWasm(wasm));
  assert(assertEquivalent(js, linear));
  assertEquals(js.summary, {
    alive: 90,
    active: 60,
    completed: 30,
    edited: 3,
    filter: 0,
    focus: { id: 95, version: 1 },
  });
  assertEquals(js.commands.length, 600);
  assertEquals(js.counters.actions, 150);
  assertEquals(js.counters.stateWrites, 250);
  assertEquals(linear.counters.boundaryCrossings, 1);
  assertEquals(linear.counters.allocations, 0);
  const freshExports = await instantiateTodoWasm(wasm) as unknown as {
    counter_actions: () => number;
  };
  assertEquals(Number(freshExports.counter_actions()), 0);

  const exports = await instantiateTodoWasm(wasm) as Record<string, unknown>;
  const falsified = { ...exports, counter_state_writes: () => 249 };
  assertThrows(
    () => runWasm(falsified, encodeActionTrace()),
    "operative counter mismatch",
  );
});

Deno.test("verified browser runtime bundle exports the complete controlled engine", async () => {
  const runtime = await import(
    `../public/artifacts/base-dom-todomvc-journey/runtime.js?test=${crypto.randomUUID()}`
  );
  assertEquals(
    Object.keys(runtime).sort(),
    ["assertEquivalent", "encodeActionTrace", "instantiateTodoWasm", "runJavaScript", "runWasm"],
  );
  assertEquals(runtime.runJavaScript().summary.alive, 90);
});

Deno.test("both engines reject invalid or reduced traces rather than accepting cached expected output", async () => {
  const duplicate = encodeActionTrace(generateActionTrace());
  duplicate[4] = ACTION.ADD;
  duplicate[5] = 0;
  let jsFailed = false;
  try {
    runJavaScript(duplicate);
  } catch {
    jsFailed = true;
  }
  assert(jsFailed);
  const exports = await instantiateTodoWasm(await compileWasm()) as unknown as {
    memory: WebAssembly.Memory;
    input_ptr: () => number;
    run: (count: number) => number;
  };
  const input = new Int32Array(
    exports.memory.buffer,
    Number(exports.input_ptr()),
    duplicate.length,
  );
  input.set(duplicate);
  assertEquals(Number(exports.run(150)), -1);
  const reduced = encodeActionTrace(generateActionTrace().slice(0, 149));
  let reducedFailed = false;
  try {
    runJavaScript(reduced);
  } catch {
    reducedFailed = true;
  }
  assert(reducedFailed);
});

Deno.test("supplemental registration validates and binds every served raw byte", async () => {
  const schema = JSON.parse(
    await Deno.readTextFile("schemas/base-workload-implementation.schema.json"),
  );
  const registrationBytes = await Deno.readFile("catalog/base-dom-todomvc-journey.v1.json");
  const publicBytes = await Deno.readFile("public/data/base-dom-todomvc-journey.v1.json");
  assertEquals(publicBytes, registrationBytes);
  const registration = JSON.parse(new TextDecoder().decode(registrationBytes));
  const validate = new Ajv2020({ strict: true, allErrors: true }).compile(schema);
  assert(validate(registration), JSON.stringify(validate.errors));
  assertEquals(registration.status, "implementation-candidate");
  assertEquals(registration.frozenCatalog.entryCount, 38);
  assertEquals(registration.variants, ["js-controlled", "wasm-linear-controlled"]);
  for (const artifact of registration.artifacts) {
    const bytes = await Deno.readFile(artifact.path);
    assert(bytes.byteLength === artifact.bytes, artifact.path);
    assert(await sha256Hex(bytes) === artifact.sha256, artifact.path);
  }
  assertEquals(
    registration.frozenCatalog.sha256,
    "6665664f984683e5b7d3fdc8c1602198124844704c224a526d48be2f02edf9d4",
  );
  assertEquals(
    await sha256Hex(await Deno.readFile("catalog/workloads.v1.json")),
    registration.frozenCatalog.sha256,
  );
});

Deno.test("build manifest source graph and static evidence are exact-commit bound", async () => {
  const registration = JSON.parse(
    await Deno.readTextFile("catalog/base-dom-todomvc-journey.v1.json"),
  );
  const build = JSON.parse(
    await Deno.readTextFile("public/artifacts/base-dom-todomvc-journey/build-manifest.json"),
  );
  assertEquals(build.sourceCommit, registration.sourceCommit);
  assertEquals(build.build.toolchains, ["Deno 2.9.0", "wabt 1.0.37"]);
  for (const source of build.sourceGraph) {
    const committed = await new Deno.Command("git", {
      args: ["show", `${build.sourceCommit}:${source.path}`],
      stdout: "piped",
      stderr: "piped",
    }).output();
    assert(committed.success, `${source.path} missing from ${build.sourceCommit}`);
    assert(await sha256Hex(committed.stdout) === source.sha256, source.path);
  }
  for (const variant of ["js-controlled", "wasm-linear-controlled"]) {
    const record = JSON.parse(
      await Deno.readTextFile(`public/evidence/base/dom-todomvc-journey/${variant}.json`),
    );
    assertEquals(record.status, "static-validation-passed-browser-pending");
    assertEquals(record.browserEvidence.status, "uncollected");
    assertEquals(record.performanceClaims, []);
  }
});

Deno.test("TodoMVC route is explicit, read-only, accessible, and lifecycle bounded", async () => {
  const handler = createHandler(null, "public");
  const routes = [
    "/benchmarks/base-dom-todomvc-journey/",
    "/benchmarks/base-dom-todomvc-journey/controller.js",
    "/benchmarks/base-dom-todomvc-journey/worker.js",
    "/benchmarks/base-dom-todomvc-journey/styles.css",
    "/benchmarks/base/dom-todomvc-journey/engine.js",
    "/benchmarks/base/dom-todomvc-journey/fixture.js",
    "/artifacts/base-dom-todomvc-journey/runtime.js",
    "/artifacts/base-dom-todomvc-journey/todomvc.wasm",
    "/artifacts/base-dom-todomvc-journey/fixture.json",
    "/artifacts/base-dom-todomvc-journey/output-manifest.json",
    "/artifacts/base-dom-todomvc-journey/build-manifest.json",
    "/data/base-dom-todomvc-journey.v1.json",
    "/data/base-workload-implementation.schema.json",
    "/data/base-todomvc-browser-evidence.schema.json",
  ];
  for (const route of routes) {
    const response = await handler(new Request(`https://example.test${route}`));
    assert(response.status === 200, route);
  }
  assertEquals(
    (await handler(
      new Request("https://example.test/benchmarks/base-dom-todomvc-journey/", {
        method: "POST",
      }),
    )).status,
    403,
  );
  const html = await Deno.readTextFile("public/benchmarks/base-dom-todomvc-journey/index.html");
  assert(html.includes('href="#content"'));
  assert(html.includes('role="status"'));
  assert(html.includes('aria-label="Todo filters"'));
  assert(html.includes("No performance claim."));
  const controller = await Deno.readTextFile(
    "public/benchmarks/base-dom-todomvc-journey/controller.js",
  );
  for (
    const required of [
      "requestAnimationFrame(next)",
      "setSelectionRange",
      "pagehide",
      "injectStaleMessage",
      "worker?.terminate()",
      "physicalMutations",
      "completeCanonicalDom",
      "canonicalDom: domResult.dom",
    ]
  ) assert(controller.includes(required), required);
  const worker = await Deno.readTextFile("public/benchmarks/base-dom-todomvc-journey/worker.js");
  assert(worker.includes('fetch(route, { cache: "no-store" })'));
  assert(worker.includes("raw byte hash mismatch"));
  assert(worker.includes("URL.createObjectURL(new Blob"));
  assert(!worker.startsWith("import "));
});

Deno.test("TodoMVC semantic, lifecycle, network, DOM, and AX gates reject incomplete evidence", () => {
  const js = runJavaScript();
  const result = {
    variantId: js.variantId,
    summary: js.summary,
    counters: js.counters,
    canonicalDom: finalDomOracle(),
    assertions: { completeCanonicalDom: true },
  };
  const oracle = {
    finalState: js.summary,
    canonicalDom: finalDomOracle(),
    canonicalAx: finalAxOracle(),
    variants: { "js-controlled": { counters: js.counters } },
  };
  assertCompleteTodoEvidence(result, finalAxOracle(), oracle, "js-controlled");
  assertThrows(
    () =>
      assertCompleteTodoEvidence(
        { ...result, canonicalDom: result.canonicalDom.slice(1) },
        finalAxOracle(),
        oracle,
        "js-controlled",
      ),
    "canonical DOM mismatch",
  );
  assertThrows(
    () => assertCompleteTodoEvidence(result, finalAxOracle().slice(1), oracle, "js-controlled"),
    "CDP AX-tree mismatch",
  );
  assertCompleteNetwork([{
    url: "http://127.0.0.1:8000/",
    method: "GET",
    status: 200,
    failed: false,
    completed: true,
  }]);
  assertThrows(
    () =>
      assertCompleteNetwork([{
        url: "http://127.0.0.1:8000/",
        method: "GET",
        status: null,
        failed: false,
        completed: true,
      }]),
    "network request incomplete",
  );
  assertLifecycleEvidence("pagehide", {
    cancelled: false,
    staleIgnored: false,
    workerAbsentAfterCancel: false,
    restartCompleted: false,
    workerAbsentAfterPagehide: true,
  });
  assertThrows(
    () =>
      assertLifecycleEvidence("pagehide", {
        cancelled: false,
        staleIgnored: false,
        workerAbsentAfterCancel: false,
        restartCompleted: false,
        workerAbsentAfterPagehide: false,
      }),
    "lifecycle gate failed",
  );
});

Deno.test("browser collector has closed schema, exact trust roots, CDP AX hooks, and descendant cleanup", async () => {
  const schema = JSON.parse(
    await Deno.readTextFile("schemas/base-todomvc-browser-evidence.schema.json"),
  );
  const ajv = new Ajv2020({ strict: true, allErrors: true });
  const validate = ajv.compile(schema);
  assert(!validate({ schemaVersion: 1, unexpected: true }));
  const launchArguments = [
    "--headless=new",
    "--enable-automation",
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
    "--remote-debugging-port=9222",
    "--user-data-dir=/tmp/base-todomvc-chrome-test",
    "about:blank",
  ];
  const browserProperties = schema.properties.browser.properties;
  const validateLaunchArguments = ajv.compile(browserProperties.launchArguments);
  assert(validateLaunchArguments(launchArguments), JSON.stringify(validateLaunchArguments.errors));
  assert(
    !validateLaunchArguments(launchArguments.filter((value) => value !== "--enable-automation")),
  );
  assert(!validateLaunchArguments([...launchArguments, "--unexpected"]));
  const validateCommandLine = ajv.compile(browserProperties.commandLine);
  assert(validateCommandLine({ arguments: ["/external/chrome", ...launchArguments] }));
  assert(!validateCommandLine({ arguments: ["/external/chrome", ...launchArguments.slice(2)] }));
  const script = await Deno.readTextFile("scripts/validate-base-todomvc-browser.ts");
  for (
    const required of [
      "javascript-complete",
      "wasm-complete",
      "cancel-stale-restart",
      "pagehide",
      "Accessibility.getPartialAXTree",
      '"--enable-automation"',
      "CDP command line omitted an exact launch argument",
      "canonicalDomSha256",
      "assertCompleteNetwork(network)",
      "collector HEAD is not clean",
      "served registration differs from local trust root",
      "Chrome trust root must be external",
      'Deno.kill(item.pid, "SIGKILL")',
      "Chrome profile survived cleanup",
      "closed evidence schema rejected collection",
    ]
  ) assert(script.includes(required), required);
  await assertRejects(
    () => Deno.readTextFile("artifacts/base-dom-todomvc-browser-evidence.json"),
    "No such file",
  );
});
