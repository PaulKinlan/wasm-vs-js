import Ajv2020Module from "ajv2020";
import { sha256Hex } from "../lib/canonical.ts";
import { createHandler } from "../server.ts";
import { assert, assertEquals } from "./assert.ts";
import {
  compareToReference,
  PATH_CHECKPOINT_PIXELS,
  readWasmResult,
  renderJavaScript,
  SAMPLE_CHECKPOINT_COORDINATES,
  sampleCheckpointPixels,
} from "../benchmarks/base-v1/graphics-cpu-path-tracer/engine.js";
import { renderReference } from "../benchmarks/base-v1/graphics-cpu-path-tracer/reference.js";

type Validator = ((value: unknown) => boolean) & { errors?: unknown };
type AjvConstructor = new (options?: Record<string, unknown>) => {
  compile: (schema: unknown) => Validator;
};
const Ajv2020 = ((Ajv2020Module as unknown as { default?: AjvConstructor }).default ??
  Ajv2020Module) as unknown as AjvConstructor;
const ARTIFACT = "public/artifacts/graphics-cpu-path-tracer-v1/path-tracer.wasm";
const MANIFEST = "public/artifacts/graphics-cpu-path-tracer-v1/build-manifest.json";

async function instantiate() {
  const bytes = await Deno.readFile(ARTIFACT);
  return (await WebAssembly.instantiate(bytes, {})).instance;
}

Deno.test("frozen v1 catalog stays byte-for-byte unchanged", async () => {
  for (const path of ["catalog/workloads.v1.json", "public/data/workloads.v1.json"]) {
    assertEquals(
      await sha256Hex(await Deno.readFile(path)),
      "6665664f984683e5b7d3fdc8c1602198124844704c224a526d48be2f02edf9d4",
    );
  }
});

Deno.test("supplemental registration is closed, unhashed-catalog-safe, and not accepted early", async () => {
  const schema = JSON.parse(
    await Deno.readTextFile("schemas/base-v1/implementation-registration.schema.json"),
  );
  const value = JSON.parse(
    await Deno.readTextFile(
      "catalog/base-v1-implementations/graphics-cpu-path-tracer.v1.json",
    ),
  );
  const validate = new Ajv2020({ strict: true, allErrors: true }).compile(schema);
  assert(validate(value), JSON.stringify(validate.errors));
  assertEquals(value.catalogMutation, false);
  assertEquals(value.acceptedCoverage, false);
  assertEquals(value.fixedWork, {
    width: 512,
    height: 512,
    samplesPerPixel: 64,
    maxBounces: 4,
  });
  assertEquals(value.fixture.externalAssets, false);
  assertEquals(value.fixture.licenseSpdx, "CC0-1.0");
});

Deno.test("controlled targets perform complete BVH path work across bounded cases", async () => {
  const instance = await instantiate();
  for (const [width, height, spp] of [[1, 1, 1], [8, 8, 2], [16, 9, 3]] as const) {
    const js = renderJavaScript(width, height, spp);
    const wasm = readWasmResult(instance, width, height, spp);
    assertEquals(js.framebuffer.length, width * height * 4);
    assertEquals(wasm.framebuffer.length, width * height * 4);
    assertEquals(js.counters.samples, width * height * spp);
    assertEquals(wasm.counters.samples, width * height * spp);
    assert(js.counters.rays >= js.counters.samples);
    assert(wasm.counters.rays >= wasm.counters.samples);
    assert(js.counters.nodeTests > js.counters.rays);
    assert(wasm.counters.nodeTests > wasm.counters.rays);
    assert(js.counters.intersections > 0);
    assert(wasm.counters.intersections > 0);
    for (
      const key of [
        "rays",
        "bounces",
        "nodeTests",
        "intersections",
        "samples",
        "rngDraws",
        "outputBytes",
      ] as const
    ) assertEquals(js.counters[key], wasm.counters[key]);
    assert(js.counters.allocations > 1);
    assertEquals(js.counters.outputBytes, width * height * 4);
    assertEquals(js.counters.boundaryCrossings, 0);
    assertEquals(wasm.counters.allocations, 0);
    assertEquals(wasm.counters.outputBytes, width * height * 4);
    assertEquals(wasm.counters.boundaryCrossings, 1);
    assertEquals(js.framebuffer, wasm.framebuffer);
    const comparison = compareToReference(js.framebuffer, wasm.framebuffer);
    assert(comparison.passed, JSON.stringify(comparison));
    for (let i = 3; i < js.framebuffer.length; i += 4) {
      assertEquals(js.framebuffer[i], 255);
      assertEquals(wasm.framebuffer[i], 255);
    }
  }
});

Deno.test("independent brute-force f64 oracle bounds complete preview output", () => {
  const js = renderJavaScript(32, 24, 4);
  const reference = renderReference(32, 24, 4);
  const comparison = compareToReference(js.framebuffer, reference);
  assert(comparison.passed, JSON.stringify(comparison));
  assertEquals(reference.length, 32 * 24 * 4);
});

Deno.test("fixture RNG and full controlled output are deterministic", async () => {
  const first = renderJavaScript(24, 24, 3);
  const second = renderJavaScript(24, 24, 3);
  assertEquals(first.framebuffer, second.framebuffer);
  assertEquals(first.counters, second.counters);
  const manifest = JSON.parse(await Deno.readTextFile(MANIFEST));
  assertEquals(manifest.oracle.completeBytes, 1_048_576);
  assertEquals(
    manifest.oracle.jsFramebufferSha256,
    await sha256Hex(
      await Deno.readFile("public/artifacts/graphics-cpu-path-tracer-v1/js-controlled.rgba"),
    ),
  );
  assertEquals(
    manifest.oracle.wasmFramebufferSha256,
    await sha256Hex(
      await Deno.readFile(
        "public/artifacts/graphics-cpu-path-tracer-v1/wasm-linear-controlled.rgba",
      ),
    ),
  );
  assertEquals(
    manifest.oracle.referenceFramebufferSha256,
    await sha256Hex(
      await Deno.readFile("public/artifacts/graphics-cpu-path-tracer-v1/reference-f64.rgba"),
    ),
  );
  assertEquals(manifest.oracle.jsCounters.samples, 16_777_216);
  assertEquals(manifest.oracle.wasmCounters.samples, 16_777_216);
  assert(manifest.oracle.crossTarget.passed);
  assertEquals(manifest.oracle.checkpoints.length, 5);
  assertEquals(
    manifest.oracle.checkpoints.map((checkpoint: { pixel: number }) => checkpoint.pixel),
    sampleCheckpointPixels(512, 512),
  );
  assertEquals(SAMPLE_CHECKPOINT_COORDINATES.length, 5);
  assertEquals(
    manifest.oracle.pathCheckpoints.map((checkpoint: { pixel: number }) => checkpoint.pixel),
    PATH_CHECKPOINT_PIXELS,
  );
  for (const checkpoint of manifest.oracle.pathCheckpoints) {
    assert(Number.isInteger(checkpoint.pixel));
    assertEquals(checkpoint.radiance.length, 3);
    assertEquals(checkpoint.throughput.length, 3);
    assert(Number.isInteger(checkpoint.state));
  }
});

Deno.test("material Wasm exports fixed memory and rebuilds byte-identically", async () => {
  const instance = await instantiate();
  assert(instance.exports.memory instanceof WebAssembly.Memory);
  assertEquals(instance.exports.memory.buffer.byteLength, 4_194_304);
  for (const name of ["render", "framebuffer_ptr", "counters_ptr"]) {
    assertEquals(typeof instance.exports[name], "function");
  }
  const temp = await Deno.makeTempDir({ prefix: "path-tracer-rebuild-" });
  try {
    const compile = await new Deno.Command("clang", {
      args: [
        "--target=wasm32-unknown-unknown",
        "-O3",
        "-nostdlib",
        "-ffreestanding",
        "-fno-builtin",
        "-ffp-contract=off",
        "-c",
        "benchmarks/base-v1/graphics-cpu-path-tracer/path-tracer.c",
        "-o",
        `${temp}/path.o`,
      ],
      stdout: "piped",
      stderr: "piped",
    }).output();
    assert(compile.success, new TextDecoder().decode(compile.stderr));
    const link = await new Deno.Command("wasm-ld", {
      args: [
        "--no-entry",
        "--export-memory",
        "--export=framebuffer_ptr",
        "--export=counters_ptr",
        "--export=render",
        "--initial-memory=4194304",
        "--max-memory=4194304",
        "--stack-first",
        `${temp}/path.o`,
        "-o",
        `${temp}/path.wasm`,
      ],
      stdout: "piped",
      stderr: "piped",
    }).output();
    assert(link.success, new TextDecoder().decode(link.stderr));
    assertEquals(await Deno.readFile(`${temp}/path.wasm`), await Deno.readFile(ARTIFACT));
  } finally {
    await Deno.remove(temp, { recursive: true });
  }
});

Deno.test("manifest raw hashes bind source, build, complete frames, and exact commit", async () => {
  const manifest = JSON.parse(await Deno.readTextFile(MANIFEST));
  assert(/^[a-f0-9]{40}$/.test(manifest.sourceCommit));
  assertEquals(manifest.catalogV1.immutable, true);
  assertEquals(manifest.performanceClaims, []);
  assert(manifest.files.length >= 13);
  for (const file of manifest.files) {
    assertEquals(await sha256Hex(await Deno.readFile(file.path)), file.sha256);
    assert(file.immutableUrl.includes(manifest.sourceCommit));
  }
  for (const variant of ["js-controlled", "wasm-linear-controlled"]) {
    const record = JSON.parse(
      await Deno.readTextFile(
        `public/evidence/base-v1/graphics-cpu-path-tracer-v1/${variant}.json`,
      ),
    );
    assertEquals(record.status, "validation-only");
    assertEquals(record.input, {
      width: 512,
      height: 512,
      samplesPerPixel: 64,
      sceneSeed: 1831565813,
    });
    assertEquals(record.performanceClaims, []);
    assertEquals(record.completeOutput.bytes, 1_048_576);
  }
});

Deno.test("public demo routes are explicit and mutation remains denied", async () => {
  const handler = createHandler(null, "public", null);
  for (
    const [path, type] of [
      ["/benchmarks/graphics-cpu-path-tracer-v1/", "text/html"],
      ["/benchmarks/graphics-cpu-path-tracer-v1/runner.js", "text/javascript"],
      ["/benchmarks/graphics-cpu-path-tracer-v1/worker.js", "text/javascript"],
      ["/benchmarks/base-v1/graphics-cpu-path-tracer/engine.js", "text/javascript"],
      ["/benchmarks/base-v1/graphics-cpu-path-tracer/reference.js", "text/javascript"],
      ["/artifacts/graphics-cpu-path-tracer-v1/path-tracer.wasm", "application/wasm"],
      ["/artifacts/graphics-cpu-path-tracer-v1/build-manifest.json", "application/json"],
    ]
  ) {
    const response = await handler(new Request(`http://local.test${path}`));
    assert(response.status === 200, `${path}: ${response.status}`);
    assert(response.headers.get("content-type")?.startsWith(type), path);
  }
  assertEquals(
    (await handler(
      new Request("http://local.test/benchmarks/graphics-cpu-path-tracer-v1/", { method: "POST" }),
    )).status,
    403,
  );
});

Deno.test("demo lifecycle is fresh-worker, bounded, stale-safe, and non-persistent", async () => {
  const runner = await Deno.readTextFile(
    "public/benchmarks/graphics-cpu-path-tracer-v1/runner.js",
  );
  const worker = await Deno.readTextFile(
    "public/benchmarks/graphics-cpu-path-tracer-v1/worker.js",
  );
  const page = await Deno.readTextFile(
    "public/benchmarks/graphics-cpu-path-tracer-v1/index.html",
  );
  for (
    const text of [
      "new Worker(",
      "active !== worker",
      "event.data.token !== runToken",
      "terminate()",
      "setTimeout(",
      "pagehide",
      "150000",
    ]
  ) assert(runner.includes(text), text);
  for (
    const text of [
      "SHA-256",
      "build manifest raw-byte mismatch",
      "complete framebuffer hash mismatch",
      "complete counter mismatch",
      "five sample checkpoint mismatch",
      "path checkpoint mismatch",
      "renderReference",
    ]
  ) {
    assert(worker.includes(text), text);
  }
  for (
    const text of [
      "aria-live",
      "No performance claim",
      "does not upload, store or rank",
      "512×512 × 64 spp",
    ]
  ) {
    assert(page.includes(text), text);
  }
  for (
    const prohibited of [
      "localStorage",
      "sessionStorage",
      "indexedDB",
      "fetch('/v1/runs",
      "performance.now(",
    ]
  ) {
    assert(!`${runner}\n${worker}`.includes(prohibited), prohibited);
  }
});
