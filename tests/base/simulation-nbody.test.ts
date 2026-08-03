import Ajv2020Module from "ajv2020";
import addFormatsModule from "ajv-formats";
import { assert, assertEquals } from "../assert.ts";
import { sha256Hex } from "../../lib/canonical.ts";
import { createHandler } from "../../server.ts";
import { COUNTERS, OUTPUT_BYTES } from "../../benchmarks/base/simulation-nbody/contract.js";
import { generateFixture } from "../../benchmarks/base/simulation-nbody/fixture.js";
import {
  assertEquivalent,
  instantiateNbodyWasm,
  runJavaScript,
  runSmallJavaScript,
  runSmallWasm,
  runWasm,
} from "../../benchmarks/base/simulation-nbody/engine.js";

const Ajv2020 = (Ajv2020Module as unknown as { default?: typeof Ajv2020Module }).default ??
  Ajv2020Module;
const addFormats = (addFormatsModule as unknown as { default?: typeof addFormatsModule }).default ??
  addFormatsModule;
async function runtime() {
  return await instantiateNbodyWasm(
    await Deno.readFile("public/artifacts/base-simulation-nbody/nbody.wasm"),
  );
}

Deno.test("frozen v1 catalog bytes remain unchanged while supplemental N-body registration is exact", async () => {
  assertEquals(
    await sha256Hex(await Deno.readFile("catalog/workloads.v1.json")),
    "6665664f984683e5b7d3fdc8c1602198124844704c224a526d48be2f02edf9d4",
  );
  const registration = JSON.parse(
    await Deno.readTextFile("catalog/base-implementations.v1/simulation.nbody-cloth.v1.json"),
  );
  assertEquals(registration.catalogMutation, false);
  assertEquals(registration.contract.bodies, 1024);
  assertEquals(registration.contract.timesteps, 120);
  assertEquals(
    registration.contract.solver,
    "direct ordered all-pairs O(N^2) leapfrog kick-drift-kick with one retained acceleration field",
  );
  assert(registration.contract.excluded.includes("cloth"));
  assert(registration.contract.excluded.includes("Barnes-Hut"));
});

Deno.test("seeded N-body fixture and complete reference output reproduce byte exactly", async () => {
  const fixture = generateFixture();
  assertEquals(
    await sha256Hex(fixture),
    "00e9acbf97192d53c3013fff1667c7a335551661dd95db04bc3237e704803112",
  );
  const js = runJavaScript(fixture);
  assertEquals(js.output.byteLength, OUTPUT_BYTES);
  assertEquals(js.completeOutputDigest, "00136c5b760c3794");
  assertEquals(js.quantizedStateDigest, "5c5c1eca3fffb709");
  assertEquals(
    await sha256Hex(js.output),
    "e09f9c48b3c2945cca25102eb09667295c7889a850578622354d80b1109dba3e",
  );
  assertEquals(js.counters, { ...COUNTERS, allocations: 5, boundaryCrossings: 0 });
  assertEquals(js.energy.relativeDrift, 0.0000011147386053059117);
});

Deno.test("full 1024-body by 120-step JavaScript and material Wasm outputs match every byte", async () => {
  const fixture = generateFixture();
  const js = runJavaScript(fixture);
  const wasm = runWasm(await runtime(), fixture);
  assertEquals(wasm.completeOutputDigest, js.completeOutputDigest);
  assertEquals(wasm.quantizedStateDigest, js.quantizedStateDigest);
  assertEquals(wasm.output, js.output);
  assertEquals(assertEquivalent(js, wasm), {
    maxAbsoluteDifference: 0,
    tolerance: 1e-12,
    quantizedStateDigest: "5c5c1eca3fffb709",
  });
  assertEquals(wasm.counters, { ...COUNTERS, allocations: 0, boundaryCrossings: 2 });
  const source = await Deno.readTextFile("benchmarks/base/simulation-nbody/nbody.c");
  for (
    const token of [
      "compute_acceleration",
      "total_energy",
      "run_small",
      "for (u32 j = 0; j < N; j++)",
    ]
  ) assert(source.includes(token));
});

Deno.test("small seeded systems match JS and Wasm and preserve two-body center of mass", async () => {
  for (let count = 2; count <= 8; count++) {
    for (let steps = 0; steps <= 4; steps++) {
      const parts = Array.from(
        { length: 7 },
        (_, part) =>
          Float64Array.from(
            { length: count },
            (_, i) =>
              part === 0
                ? 1 + i / 10
                : (part < 4
                  ? (i - count / 2) * (part + 1) / 10
                  : (i % 2 ? -1 : 1) * (part - 3) / 1000),
          ),
      );
      const js = runSmallJavaScript(parts, steps);
      const wasm = runSmallWasm(await runtime(), parts, steps);
      for (let part = 0; part < 6; part++) {
        assertEquals(wasm[part], js[part]);
      }
    }
  }
  const symmetric = [
    Float64Array.of(1, 1),
    Float64Array.of(-1, 1),
    Float64Array.of(0, 0),
    Float64Array.of(0, 0),
    Float64Array.of(0, 0),
    Float64Array.of(0, 0),
    Float64Array.of(0, 0),
  ];
  const output = runSmallJavaScript(symmetric, 8);
  assert(Math.abs(output[0][0] + output[0][1]) < 1e-15);
});

Deno.test("N-body Wasm memory is fixed and repeat runs clear all state", async () => {
  const wasm = await runtime();
  const first = runWasm(wasm, generateFixture());
  const second = runWasm(wasm, generateFixture());
  assertEquals(second.output, first.output);
  assertEquals((wasm.memory as WebAssembly.Memory).buffer.byteLength, 64 * 65536);
  let fixed = false;
  try {
    (wasm.memory as WebAssembly.Memory).grow(1);
  } catch (error) {
    fixed = error instanceof RangeError;
  }
  assert(fixed);
});

Deno.test("N-body demo lifecycle is fresh-worker, token-bound, cancellable, bounded and non-persistent", async () => {
  const demo = await Deno.readTextFile("public/demos/simulation-nbody-cloth/demo.js");
  assert(demo.includes('new Worker("/demos/simulation-nbody-cloth/worker.js"'));
  assert(demo.includes("worker !== owned") && demo.includes("token !== runToken"));
  assert(demo.includes("worker?.terminate()") && demo.includes("30_000"));
  assert(demo.includes('addEventListener("pagehide"'));
  assert(!/(localStorage|sessionStorage|indexedDB|fetch\s*\()/u.test(demo));
  const page = await Deno.readTextFile("public/demos/simulation-nbody-cloth/index.html");
  assert(page.includes('role="status"') && page.includes('aria-live="polite"'));
  assert(page.includes("No performance claim.") && page.includes("stores and uploads nothing"));
});

Deno.test("N-body public routes are closed, typed, and mutation-safe", async () => {
  const handler = createHandler(null, "public");
  for (
    const path of [
      "/demos/simulation-nbody-cloth/",
      "/demos/simulation-nbody-cloth/worker.js",
      "/benchmarks/base/simulation-nbody/engine.js",
      "/artifacts/base-simulation-nbody/nbody.wasm",
      "/evidence/base-catalog/simulation-nbody-cloth/js-controlled.json",
    ]
  ) assertEquals((await handler(new Request(`http://127.0.0.1${path}`))).status, 200);
  assertEquals(
    (await handler(
      new Request("http://127.0.0.1/demos/simulation-nbody-cloth/", { method: "POST" }),
    )).status,
    403,
  );
  assertEquals(
    (await handler(new Request("http://127.0.0.1/artifacts/base-simulation-nbody/../server.ts")))
      .status,
    404,
  );
});

Deno.test("N-body validation records satisfy the closed schema and exact retained bytes", async () => {
  const schema = JSON.parse(
    await Deno.readTextFile("schemas/base-workload-validation-record.schema.json"),
  );
  const ajv = new (Ajv2020 as unknown as new (
    options: Record<string, unknown>,
  ) => { compile: (schema: unknown) => ((value: unknown) => boolean) & { errors?: unknown } })({
    allErrors: true,
    strict: false,
  });
  (addFormats as unknown as (instance: unknown) => void)(ajv);
  const validate = ajv.compile(schema);
  for (const variant of ["js-controlled", "wasm-linear-controlled"]) {
    const record = JSON.parse(
      await Deno.readTextFile(
        `public/evidence/base-catalog/simulation-nbody-cloth/${variant}.json`,
      ),
    );
    assert(validate(record), JSON.stringify(validate.errors));
    assertEquals(record.fixture.sha256, await sha256Hex(await Deno.readFile(record.fixture.path)));
    assertEquals(
      record.oracle.completeOutputSha256,
      "e09f9c48b3c2945cca25102eb09667295c7889a850578622354d80b1109dba3e",
    );
  }
});
