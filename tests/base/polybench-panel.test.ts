import wabtFactory from "wabt";
import Ajv2020Module from "ajv2020";
import { assert, assertEquals } from "../assert.ts";
import { LocalRunStore } from "../../lib/run-store.ts";
import { createHandler } from "../../server.ts";
type Validator = ((value: unknown) => boolean) & { errors?: unknown };
type AjvInstance = { compile: (schema: unknown) => Validator };
type AjvConstructor = new (options?: Record<string, unknown>) => AjvInstance;

import {
  choleskyJS,
  compareNumeric,
  countersFor,
  gemmJS,
  instantiatePanelWasm,
  jacobi2dJS,
  KERNEL_IDS,
  makeCholeskyFixture,
  makeGemmFixture,
  makeGridFixture,
  runCholeskyWasm,
  runGemmWasm,
  runJacobiWasm,
  runStencilWasm,
  stencilJS,
  TARGET_IDS,
  validateStructure,
} from "../../benchmarks/base/numeric-polybench-panel/workload.js";

const artifactRoot = "public/artifacts/numeric-polybench-panel";
async function compileWat() {
  const path = "benchmarks/base/numeric-polybench-panel/polybench-panel.wat";
  const wabt = await wabtFactory();
  const module = wabt.parseWat(path, await Deno.readTextFile(path));
  module.resolveNames();
  module.validate();
  const bytes = new Uint8Array(
    module.toBinary({ canonicalize_lebs: true, write_debug_names: false }).buffer,
  );
  module.destroy();
  return bytes;
}
const bytes = await compileWat();
const wasm = await instantiatePanelWasm(bytes);
const cases = {
  gemm: { fixture: makeGemmFixture(), js: gemmJS, linear: runGemmWasm },
  cholesky: { fixture: makeCholeskyFixture(), js: choleskyJS, linear: runCholeskyWasm },
  stencil: { fixture: makeGridFixture(), js: stencilJS, linear: runStencilWasm },
  jacobi2d: { fixture: makeGridFixture(), js: jacobi2dJS, linear: runJacobiWasm },
} as const;
const parse = async (path: string) => JSON.parse(await Deno.readTextFile(path));
const clone = <T>(value: T): T => structuredClone(value);
const counterValue = (kernel: string, target: string, key: string) =>
  (countersFor(kernel, target) as unknown as Record<string, number | string>)[key];

Deno.test("base PolyBench contract freezes verified MINI_DATASET work without changing catalog v1", async () => {
  const contract = await parse("benchmarks/base/numeric-polybench-panel/contract.json");
  assertEquals(contract.catalogEntryId, "numeric.polybench-panel.v1");
  assertEquals(contract.fixedWork.gemm, {
    dataset: "MINI_DATASET",
    ni: 20,
    nj: 25,
    nk: 30,
    alpha: 1.5,
    beta: 1.2,
    passes: 1,
  });
  assertEquals(contract.fixedWork.cholesky, { dataset: "MINI_DATASET", n: 40, factorizations: 1 });
  assertEquals(contract.fixedWork.stencil.n, 30);
  assertEquals(contract.fixedWork.jacobi2d.timesteps, 20);
  const prior = await parse("evidence/base/numeric-polybench-panel/prior-art-verification.json");
  assertEquals(prior.bytes, 297237);
  assertEquals(prior.sha256, "426519ee8443a5f2175de6a3e9328cda8917a5e33053d0e8f59855ab56d689a4");
  assertEquals(prior.redistributedArchive, false);
  const catalog = new Uint8Array(
    await crypto.subtle.digest("SHA-256", await Deno.readFile("catalog/workloads.v1.json")),
  );
  const hash = Array.from(catalog, (v) => v.toString(16).padStart(2, "0")).join("");
  assertEquals(hash, "6665664f984683e5b7d3fdc8c1602198124844704c224a526d48be2f02edf9d4");
  assertEquals(
    await Deno.readFile("catalog/workloads.v1.json"),
    await Deno.readFile("public/data/workloads.v1.json"),
  );
});

Deno.test("independent retained C references validate complete JS and material Wasm outputs", async () => {
  for (const kernel of KERNEL_IDS) {
    const run = cases[kernel as keyof typeof cases];
    const referenceBytes = await Deno.readFile(`${artifactRoot}/outputs/${kernel}.reference.f64le`);
    const reference = new Float64Array(
      referenceBytes.buffer,
      referenceBytes.byteOffset,
      referenceBytes.byteLength / 8,
    );
    const js = run.js(run.fixture as never) as Float64Array;
    const linear = run.linear(wasm as never, run.fixture as never) as Float64Array;
    for (
      const [target, output] of [["javascript-controlled", js], [
        "linear-wasm-controlled",
        linear,
      ]] as const
    ) {
      assertEquals(output.length, reference.length);
      assert(compareNumeric(output, reference).passed, `${kernel}/${target} numeric oracle`);
      assert(
        validateStructure(kernel, output, run.fixture).passed,
        `${kernel}/${target} structure`,
      );
      assertEquals(countersFor(kernel, target).outputElements, output.length);
      assertEquals(
        await Deno.readFile(`${artifactRoot}/outputs/${kernel}.${target}.f64le`),
        new Uint8Array(output.buffer, output.byteOffset, output.byteLength),
      );
    }
  }
});

Deno.test("target-specific counters freeze both-grid bytes, allocations, crossings, and work", () => {
  assertEquals(countersFor("gemm", "javascript-controlled"), {
    target: "javascript-controlled",
    boundaryCrossings: 0,
    wasmLinearAllocations: 0,
    kernels: 1,
    outputElements: 500,
    outputBytes: 4000,
    multiplyAdds: 15000,
    scaleMultiplications: 500,
    inputBytes: 14800,
    typedArrayAllocations: 4,
  });
  assertEquals(countersFor("gemm", "linear-wasm-controlled").typedArrayAllocations, 8);
  assertEquals(counterValue("cholesky", "javascript-controlled", "multiplySubtracts"), 10660);
  assertEquals(counterValue("cholesky", "linear-wasm-controlled", "divisions"), 780);
  for (const kernel of ["stencil", "jacobi2d"]) {
    for (const target of TARGET_IDS) {
      const counters = countersFor(kernel, target);
      assertEquals(counters.inputBytes, 14400);
      assertEquals(counters.outputBytes, 7200);
      assertEquals(counters.boundaryCrossings, target === "javascript-controlled" ? 0 : 1);
    }
  }
  assertEquals(counterValue("stencil", "javascript-controlled", "stencilPoints"), 784);
  assertEquals(counterValue("jacobi2d", "linear-wasm-controlled", "stencilPoints"), 31360);
});

Deno.test("small differential/property matrix covers all shapes and structural oracles", () => {
  for (let n = 2; n <= 12; n++) {
    const gemm = makeGemmFixture({ ni: n, nj: n + 1, nk: n + 2 });
    const gemmLinear = runGemmWasm(wasm, gemm);
    assert(compareNumeric(gemmLinear, gemmJS(gemm)).passed);
    assert(validateStructure("gemm", gemmLinear, gemm).passed);
    const chol = makeCholeskyFixture(n);
    const lower = runCholeskyWasm(wasm, chol);
    assert(compareNumeric(lower, choleskyJS(chol)).passed);
    assert(validateStructure("cholesky", lower, chol).passed);
    const grid = makeGridFixture(n);
    const stencil = runStencilWasm(wasm, grid);
    assert(compareNumeric(stencil, stencilJS(grid)).passed);
    assert(validateStructure("stencil", stencil, grid).passed);
    const jacobi = runJacobiWasm(wasm, grid, n);
    assert(compareNumeric(jacobi, jacobi2dJS(grid, n)).passed);
    for (const p of [0, n - 1, n * (n - 1), n * n - 1]) {
      assertEquals(stencil[p], grid.b[p]);
      assertEquals(jacobi[p], grid.a[p]);
    }
  }
});

Deno.test("closed schemas reject wrong work, fixtures, kernels, outputs, and counters", async () => {
  const Ajv2020 = ((Ajv2020Module as unknown as { default?: AjvConstructor }).default ??
    Ajv2020Module) as unknown as AjvConstructor;
  const ajv = new Ajv2020({ strict: true, allErrors: true });
  const validateContract = ajv.compile(await parse("schemas/base-workload-contract.schema.json"));
  const validateRecord = ajv.compile(await parse("schemas/base-correctness-record.schema.json"));
  const contract = await parse("benchmarks/base/numeric-polybench-panel/contract.json");
  const record = await parse("evidence/base/numeric-polybench-panel/correctness-record.json");
  assert(validateContract(contract), JSON.stringify(validateContract.errors));
  assert(validateRecord(record), JSON.stringify(validateRecord.errors));
  for (
    const mutation of [
      (value: typeof contract) => value.fixedWork.gemm.ni = 21,
      (value: typeof contract) => value.fixtureRecipe.gemm = "bogus",
      (value: typeof contract) => value.targets["javascript-controlled"].completeKernels.pop(),
    ]
  ) {
    const value = clone(contract);
    mutation(value);
    assert(!validateContract(value));
  }
  for (
    const mutation of [
      (value: typeof record) => value.exactRegisteredKernels[0] = "bogus",
      (value: typeof record) => value.outputs.bogus = true,
      (value: typeof record) =>
        value.outputs.stencil.targets["javascript-controlled"].counters.inputBytes = 7200,
      (value: typeof record) =>
        value.outputs.gemm.targets["linear-wasm-controlled"].artifact.sha256 = "0".repeat(64),
    ]
  ) {
    const value = clone(record);
    mutation(value);
    assert(!validateRecord(value));
  }
});

Deno.test("published build task reproduces every artifact and record from exact committed source graph", async () => {
  const manifest = await parse(`${artifactRoot}/build-manifest.json`);
  assertEquals(manifest.repository, "https://github.com/PaulKinlan/wasm-vs-js");
  assert(/^[0-9a-f]{40}$/.test(manifest.implementationCommit));
  assert(
    manifest.sourceGraph.some((entry: { path: string }) =>
      entry.path === "scripts/build-base-polybench.ts"
    ),
  );
  assert(manifest.sourceGraph.some((entry: { path: string }) => entry.path === "deno.lock"));
  assert(
    manifest.sourceGraph.some((entry: { path: string }) => entry.path === "deno.polybench.json"),
  );
  for (const entry of manifest.sourceGraph) {
    const committed = await new Deno.Command("git", {
      args: ["show", `${manifest.implementationCommit}:${entry.path}`],
    }).output();
    assert(committed.success, entry.path);
    const digest = new Uint8Array(await crypto.subtle.digest("SHA-256", committed.stdout));
    assertEquals(Array.from(digest, (v) => v.toString(16).padStart(2, "0")).join(""), entry.sha256);
  }
  const temp = await Deno.makeTempDir({ prefix: "polybench-reproduce-" });
  try {
    const result = await new Deno.Command("deno", {
      args: [
        "task",
        "--config",
        "deno.polybench.json",
        "build:base-polybench",
        "--source-commit",
        manifest.implementationCommit,
        "--output-root",
        temp,
      ],
      stdout: "piped",
      stderr: "piped",
    }).output();
    if (!result.success) throw new Error(new TextDecoder().decode(result.stderr));
    for await (const entry of Deno.readDir(artifactRoot)) {
      if (entry.isDirectory) {
        for await (const child of Deno.readDir(`${artifactRoot}/${entry.name}`)) {
          assertEquals(
            await Deno.readFile(`${temp}/${artifactRoot}/${entry.name}/${child.name}`),
            await Deno.readFile(`${artifactRoot}/${entry.name}/${child.name}`),
          );
        }
      } else {
        assertEquals(
          await Deno.readFile(`${temp}/${artifactRoot}/${entry.name}`),
          await Deno.readFile(`${artifactRoot}/${entry.name}`),
        );
      }
    }
    assertEquals(
      await Deno.readFile(`${temp}/evidence/base/numeric-polybench-panel/correctness-record.json`),
      await Deno.readFile("evidence/base/numeric-polybench-panel/correctness-record.json"),
    );
  } finally {
    await Deno.remove(temp, { recursive: true });
  }
});

Deno.test("public route set serves complete raw outputs, source, artifacts, and evidence read-only", async () => {
  const root = await Deno.makeTempDir();
  try {
    const store = new LocalRunStore(root);
    await store.initialize();
    const handler = createHandler(store, "public");
    const routes = [
      ["/benchmarks/numeric.polybench-panel.v1/", "text/html"],
      ["/polybench-panel-demo.js", "text/javascript"],
      ["/polybench-panel-worker.js", "text/javascript"],
      ["/benchmarks/base/numeric-polybench-panel/workload.js", "text/javascript"],
      ["/artifacts/numeric-polybench-panel/polybench-panel.wasm", "application/wasm"],
      ["/artifacts/numeric-polybench-panel/reference-oracle.wasm", "application/wasm"],
      ["/artifacts/numeric-polybench-panel/build-manifest.json", "application/json"],
      ["/evidence/base/numeric-polybench-panel/correctness-record.json", "application/json"],
      ["/evidence/base/numeric-polybench-panel/prior-art-verification.json", "application/json"],
      ["/schemas/base-workload-contract.schema.json", "application/schema+json"],
      ["/schemas/base-correctness-record.schema.json", "application/schema+json"],
    ];
    for (const kernel of KERNEL_IDS) {
      for (const variant of ["reference", ...TARGET_IDS]) {
        routes.push([
          `/artifacts/numeric-polybench-panel/outputs/${kernel}.${variant}.f64le`,
          "application/octet-stream",
        ]);
      }
    }
    for (const [path, type] of routes) {
      const response = await handler(new Request(`http://127.0.0.1${path}`));
      assert(response.status === 200, path);
      assert(response.headers.get("content-type")?.includes(type), path);
    }
    assertEquals(
      (await handler(
        new Request("http://127.0.0.1/demos/numeric.polybench-panel.v1/", { method: "POST" }),
      )).status,
      403,
    );
  } finally {
    await Deno.remove(root, { recursive: true });
  }
});

Deno.test("demo uses independent retained outputs with bounded fresh-worker lifecycle", async () => {
  const controller = await Deno.readTextFile("public/polybench-panel-demo.js");
  const worker = await Deno.readTextFile("public/polybench-panel-worker.js");
  for (const source of [controller, worker]) {
    for (
      const forbidden of [
        "localStorage",
        "sessionStorage",
        "indexedDB",
        "sendBeacon",
        'fetch("/api/',
      ]
    ) assert(!source.includes(forbidden));
  }
  assert(controller.includes("new Worker"));
  assert(controller.includes("worker.terminate()"));
  assert(controller.includes("30_000"));
  assert(controller.includes("data.token !== token"));
  assert(controller.includes('addEventListener("pagehide"'));
  assert(worker.includes("expectedDescriptor.route"));
  assert(worker.includes("validateStructure"));
  assert(!worker.includes("compareNumeric(targetOutput, jsOutput)"));
  const html = await Deno.readTextFile("public/demos/numeric.polybench-panel.v1/index.html");
  assert(html.includes("No performance claim."));
  assert(html.includes('role="status"'));
  assert(html.includes('for="progress"'));
});
