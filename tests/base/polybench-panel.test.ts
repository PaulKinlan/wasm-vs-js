import wabtFactory from "wabt";
import Ajv2020Module from "ajv2020";
import { assert, assertEquals } from "../assert.ts";
import { LocalRunStore } from "../../lib/run-store.ts";
import { createHandler } from "../../server.ts";
type Validator = (value: unknown) => boolean;
type AjvInstance = { compile: (schema: unknown) => Validator };
type AjvConstructor = new (options?: Record<string, unknown>) => AjvInstance;

import {
  choleskyJS,
  compareNumeric,
  countersFor,
  gemmJS,
  instantiatePanelWasm,
  jacobi2dJS,
  makeCholeskyFixture,
  makeGemmFixture,
  makeGridFixture,
  runCholeskyWasm,
  runGemmWasm,
  runJacobiWasm,
  runStencilWasm,
  stencilJS,
} from "../../benchmarks/base/numeric-polybench-panel/workload.js";

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

Deno.test("base PolyBench supplemental contract freezes official MINI_DATASET work", async () => {
  const contract = JSON.parse(
    await Deno.readTextFile("benchmarks/base/numeric-polybench-panel/contract.json"),
  );
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
  assertEquals(contract.fixedWork.cholesky.n, 40);
  assertEquals(contract.fixedWork.jacobi2d, {
    dataset: "MINI_DATASET",
    n: 30,
    timesteps: 20,
    sweepsPerTimestep: 2,
    pointsPerInteriorCell: 5,
    weight: 0.2,
  });
  assertEquals(
    contract.sourceBasis.archiveSha256,
    "426519ee8443a5f2175de6a3e9328cda8917a5e33053d0e8f59855ab56d689a4",
  );
  const catalog = await crypto.subtle.digest(
    "SHA-256",
    await Deno.readFile("catalog/workloads.v1.json"),
  );
  const hash = Array.from(new Uint8Array(catalog), (v) => v.toString(16).padStart(2, "0")).join("");
  assertEquals(hash, "6665664f984683e5b7d3fdc8c1602198124844704c224a526d48be2f02edf9d4");
  assertEquals(
    await Deno.readFile("catalog/workloads.v1.json"),
    await Deno.readFile("public/data/workloads.v1.json"),
  );
  const Ajv2020 = ((Ajv2020Module as unknown as { default?: AjvConstructor }).default ??
    Ajv2020Module) as unknown as AjvConstructor;
  const ajv = new Ajv2020({ strict: false });
  const contractSchema = JSON.parse(
    await Deno.readTextFile("schemas/base-workload-contract.schema.json"),
  );
  assert(ajv.compile(contractSchema)(contract));
  const recordSchema = JSON.parse(
    await Deno.readTextFile("schemas/base-correctness-record.schema.json"),
  );
  const record = JSON.parse(
    await Deno.readTextFile("evidence/base/numeric-polybench-panel/correctness-record.json"),
  );
  assert(ajv.compile(recordSchema)(record));
});

Deno.test("all four exact registered kernels execute material Wasm and compare every element", () => {
  const cases = [
    ["gemm", makeGemmFixture(), gemmJS, runGemmWasm],
    ["cholesky", makeCholeskyFixture(), choleskyJS, runCholeskyWasm],
    ["stencil", makeGridFixture(), stencilJS, runStencilWasm],
    ["jacobi", makeGridFixture(), jacobi2dJS, runJacobiWasm],
  ] as const;
  for (const [name, fixture, js, linear] of cases) {
    const expected = js(fixture as never) as Float64Array;
    const actual = linear(wasm as never, fixture as never) as Float64Array;
    assertEquals(actual.length, expected.length);
    const comparison = compareNumeric(actual, expected);
    assert(comparison.passed, name);
    assertEquals(comparison, { passed: true, violations: 0, maxAbs: 0, maxRel: 0 });
    assertEquals(countersFor(name).outputElements, expected.length);
  }
  assertEquals(countersFor("gemm").multiplyAdds, 20 * 25 * 30);
  assertEquals(countersFor("jacobi").stencilPoints, 28 * 28 * 40);
});

Deno.test("small differential matrix covers dimensions, boundaries, and Cholesky reconstruction", () => {
  for (let n = 2; n <= 12; n++) {
    const gemm = makeGemmFixture({ ni: n, nj: n + 1, nk: n + 2 });
    assert(compareNumeric(runGemmWasm(wasm, gemm), gemmJS(gemm)).passed);
    const cholFixture = makeCholeskyFixture(n);
    const lower = runCholeskyWasm(wasm, cholFixture);
    assert(compareNumeric(lower, choleskyJS(cholFixture)).passed);
    for (let i = 0; i < n; i++) {
      for (let j = 0; j < n; j++) {
        let reconstructed = 0;
        for (let k = 0; k < n; k++) reconstructed += lower[i * n + k] * lower[j * n + k];
        assert(Math.abs(reconstructed - cholFixture.a[i * n + j]) <= 1e-10);
        if (j > i) assertEquals(lower[i * n + j], 0);
      }
    }
    const grid = makeGridFixture(n);
    const stencil = runStencilWasm(wasm, grid);
    assert(compareNumeric(stencil, stencilJS(grid)).passed);
    const jacobi = runJacobiWasm(wasm, grid, n);
    assert(compareNumeric(jacobi, jacobi2dJS(grid, n)).passed);
    for (const p of [0, n - 1, n * (n - 1), n * n - 1]) {
      assertEquals(stencil[p], grid.b[p]);
      assertEquals(jacobi[p], grid.a[p]);
    }
  }
});

Deno.test("WAT build is byte reproducible and manifest anchors all exact outputs", async () => {
  assertEquals(
    bytes,
    await Deno.readFile("public/artifacts/numeric-polybench-panel/polybench-panel.wasm"),
  );
  const manifest = JSON.parse(
    await Deno.readTextFile("public/artifacts/numeric-polybench-panel/build-manifest.json"),
  );
  assertEquals(manifest.toolchain.deno, "2.9.0");
  assertEquals(manifest.toolchain.wabt, "1.0.37");
  assertEquals(
    manifest.sourceHashes.frozenCatalog,
    "6665664f984683e5b7d3fdc8c1602198124844704c224a526d48be2f02edf9d4",
  );
  for (const name of ["gemm", "cholesky", "stencil", "jacobi2d"]) {
    assertEquals(manifest.outputs[name].jsOutputSha256, manifest.outputs[name].wasmOutputSha256);
    assertEquals(manifest.outputs[name].comparison.violations, 0);
  }
});

Deno.test("public route set serves demo, worker, source, artifact, and evidence read-only", async () => {
  const root = await Deno.makeTempDir();
  try {
    const store = new LocalRunStore(root);
    await store.initialize();
    const handler = createHandler(store, "public");
    for (
      const [path, type] of [
        ["/demos/numeric.polybench-panel.v1/", "text/html"],
        ["/polybench-panel-demo.js", "text/javascript"],
        ["/polybench-panel-worker.js", "text/javascript"],
        ["/benchmarks/base/numeric-polybench-panel/workload.js", "text/javascript"],
        ["/artifacts/numeric-polybench-panel/polybench-panel.wasm", "application/wasm"],
        ["/artifacts/numeric-polybench-panel/build-manifest.json", "application/json"],
        ["/evidence/base/numeric-polybench-panel/correctness-record.json", "application/json"],
        ["/schemas/base-workload-contract.schema.json", "application/schema+json"],
        ["/schemas/base-correctness-record.schema.json", "application/schema+json"],
      ]
    ) {
      const response = await handler(new Request(`http://127.0.0.1${path}`));
      assert(response.status === 200, path);
      assert(response.headers.get("content-type")?.includes(type), path);
    }
    const denied = await handler(
      new Request("http://127.0.0.1/demos/numeric.polybench-panel.v1/", { method: "POST" }),
    );
    assertEquals(denied.status, 403);
  } finally {
    await Deno.remove(root, { recursive: true });
  }
});

Deno.test("demo lifecycle is bounded, fresh-worker, stale-safe, and non-persistent", async () => {
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
  assert(worker.includes('fetch("/artifacts/numeric-polybench-panel/polybench-panel.wasm"'));
  const html = await Deno.readTextFile("public/demos/numeric.polybench-panel.v1/index.html");
  assert(html.includes("No performance claim."));
  assert(html.includes('role="status"'));
  assert(html.includes('for="progress"'));
});
