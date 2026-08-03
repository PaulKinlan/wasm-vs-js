import { assert, assertEquals, assertRejects } from "../assert.ts";
import {
  assertEquivalent,
  CONTRACT,
  exactCounters,
  instantiateWasm,
  runJavaScript,
  runWasm,
  sha256Hex,
  syntheticValidationPcm,
} from "../../benchmarks/base/ml-keyword-spotting/engine.js";
import { createHandler } from "../../server.ts";

const fixture = JSON.parse(
  await Deno.readTextFile("benchmarks/base/ml-keyword-spotting/speech-commands-subset.v1.json"),
);
const contract = JSON.parse(
  await Deno.readTextFile("benchmarks/base/ml-keyword-spotting/implementation-contract.v1.json"),
);
const registration = JSON.parse(
  await Deno.readTextFile("public/artifacts/base-ml-keyword-spotting/registration.v1.json"),
);
const output = JSON.parse(
  await Deno.readTextFile("public/artifacts/base-ml-keyword-spotting/output-manifest.v1.json"),
);
const wasmBytes = await Deno.readFile(
  "public/artifacts/base-ml-keyword-spotting/keyword-spotting.wasm",
);

Deno.test("keyword spotting preserves the byte-identical frozen catalog", async () => {
  const catalog = await Deno.readFile("catalog/workloads.v1.json");
  const publicCatalog = await Deno.readFile("public/data/workloads.v1.json");
  assertEquals(
    await sha256Hex(catalog),
    "6665664f984683e5b7d3fdc8c1602198124844704c224a526d48be2f02edf9d4",
  );
  assertEquals(await sha256Hex(publicCatalog), await sha256Hex(catalog));
  const parsed = JSON.parse(new TextDecoder().decode(catalog));
  const row = parsed.entries.find((entry: { id: string }) => entry.id === CONTRACT.workloadId);
  assertEquals(row.status, "proposed");
  assertEquals(
    row.fixedWork.description,
    "Exactly 3,000 hops with frozen preprocessing and model.",
  );
});

Deno.test("Speech Commands recipe pins 60 exact files and 60 seconds without redistributing audio", () => {
  assertEquals(fixture.status, "frozen-recipe-only");
  assertEquals(fixture.redistribution, "recipe-only");
  assertEquals(
    fixture.archive.sha256,
    "cc2a00c1147c2254e9be3fa0f779d8c17421dc349b86366567a8edfa9acd51df",
  );
  assertEquals(fixture.files.length, 60);
  assertEquals(new Set(fixture.files.map((entry: { path: string }) => entry.path)).size, 60);
  assert(
    fixture.files.every((entry: { wavSha256: string; normalizedPcmSha256: string }) =>
      /^[a-f0-9]{64}$/.test(entry.wavSha256) && /^[a-f0-9]{64}$/.test(entry.normalizedPcmSha256)
    ),
  );
  assertEquals(fixture.selection.samples, 960000);
  assertEquals(
    fixture.normalizedPcmSha256,
    "1643258d45167c2a1b3795b2c4f2fb11a885b08806fde7f4d235e55be61482ae",
  );
});

Deno.test("supplemental contract freezes every preprocessing/model decision", () => {
  assertEquals(contract.workloadId, CONTRACT.workloadId);
  assertEquals(contract.fixedWork.hops, 3000);
  assertEquals(contract.fixedWork.hopSamples, 320);
  assertEquals(contract.fixedWork.fftSize, 512);
  assertEquals(contract.model.operatorOrder, [
    "depthwise-temporal-convolution",
    "pointwise-convolution",
    "relu",
    "dense-logits",
    "argmax-transition-detection",
  ]);
  assertEquals(contract.audioScheduling.startsWith("excluded"), true);
  assertEquals(contract.performanceClaims, []);
});

Deno.test("complete 3000-hop JS and material Wasm outputs are exact", async () => {
  const pcm = syntheticValidationPcm();
  const js = runJavaScript(pcm);
  const wasm = runWasm(await instantiateWasm(wasmBytes), pcm);
  assertEquivalent(js, wasm);
  assertEquals(js.features.length, 3000 * 13);
  assertEquals(js.scores.length, 3000 * 4);
  assertEquals(
    await sha256Hex(js.features),
    "7309545811430a9c3e5f569fb50cafd57fac46cfbc8dc818532022b64e541366",
  );
  assertEquals(
    await sha256Hex(js.scores),
    "6dd08e5700885d7f178ff6d539b8dec7df42658a014631add323e2fa6f3f9cb5",
  );
  assertEquals(
    await sha256Hex(js.detections),
    "8ca03a24aa39874d1eed6ed373931283d239429bb0d84078cdc76c72ea8e952c",
  );
});

Deno.test("complete work counters are exact and target-specific", () => {
  const js = exactCounters("javascript");
  const wasm = exactCounters("wasm-linear");
  assertEquals(js.hops, 3000);
  assertEquals(js.windowSamples, 960000);
  assertEquals(js.fftButterflies, 6_912_000);
  assertEquals(js.depthwiseMacs, 117000);
  assertEquals(js.pointwiseMacs, 312000);
  assertEquals(js.outputMacs, 96000);
  assertEquals(js.scoreElements, 12000);
  assertEquals(js.featureElements, 39000);
  assertEquals(js.allocations, 10);
  assertEquals(js.boundaryCrossings, 0);
  assertEquals(wasm.allocations, 0);
  assertEquals(wasm.boundaryCrossings, 2);
});

Deno.test("wrong input and corrupted artifact fail closed", async () => {
  let rejected = false;
  try {
    runJavaScript(new Int16Array(959999));
  } catch (error) {
    rejected = error instanceof RangeError;
  }
  assert(rejected, "wrong PCM length did not fail with RangeError");
  const truncated = wasmBytes.slice(0, wasmBytes.length - 1);
  await assertRejects(() => WebAssembly.compile(truncated), "extends past end");
});

Deno.test("full output responds to boundary input changes", async () => {
  const zero = new Int16Array(CONTRACT.samples);
  const edge = new Int16Array(CONTRACT.samples);
  edge[100] = 32767;
  edge[219] = -32768;
  edge[420] = 32767;
  const zeroResult = runJavaScript(zero);
  const edgeResult = runJavaScript(edge);
  assert((await sha256Hex(zeroResult.features)) !== (await sha256Hex(edgeResult.features)));
  const wasm = await instantiateWasm(wasmBytes);
  assertEquivalent(edgeResult, runWasm(wasm, edge));
});

Deno.test("pinned Clang build and complete source graph reproduce exact committed bytes", async () => {
  const temp = await Deno.makeTempDir();
  try {
    const object = `${temp}/keyword-spotting.o`;
    const artifact = `${temp}/keyword-spotting.wasm`;
    const compile = await new Deno.Command("clang", {
      args: [
        "--target=wasm32-unknown-unknown",
        "-O3",
        "-nostdlib",
        "-ffreestanding",
        "-fno-builtin",
        "-fwrapv",
        "-Ibenchmarks/base/ml-keyword-spotting",
        "-c",
        "benchmarks/base/ml-keyword-spotting/keyword-spotting.c",
        "-o",
        object,
      ],
    }).output();
    assert(compile.success, new TextDecoder().decode(compile.stderr));
    const link = await new Deno.Command("wasm-ld", {
      args: [
        "--no-entry",
        "--export-memory",
        "--export=pcm_ptr",
        "--export=features_ptr",
        "--export=scores_ptr",
        "--export=detections_ptr",
        "--export=detection_count",
        "--export=hop_count",
        "--export=feature_count",
        "--export=class_count",
        "--export=run",
        "--initial-memory=4194304",
        "--max-memory=4194304",
        "--stack-first",
        object,
        "-o",
        artifact,
      ],
    }).output();
    assert(link.success, new TextDecoder().decode(link.stderr));
    assertEquals(await sha256Hex(await Deno.readFile(artifact)), await sha256Hex(wasmBytes));
  } finally {
    await Deno.remove(temp, { recursive: true });
  }
  for (const source of registration.sourceGraph) {
    const disk = await Deno.readFile(source.path);
    assertEquals(await sha256Hex(disk), source.sha256);
    const git = await new Deno.Command("git", {
      args: ["show", `${registration.sourceCommit}:${source.path}`],
      stdout: "piped",
      stderr: "piped",
    }).output();
    assert(git.success, source.path);
    assertEquals(await sha256Hex(git.stdout), source.sha256);
  }
});

Deno.test("real Speech Commands result record binds every feature, score, detection and counter", async () => {
  assertEquals(registration.status, "proposal-validation-complete");
  assertEquals(registration.sourceCommit.length, 40);
  assertEquals(registration.fixture.normalizedPcmSha256, fixture.normalizedPcmSha256);
  assertEquals(registration.artifact.sha256, await sha256Hex(wasmBytes));
  assertEquals(output.outputs.features.elements, 39000);
  assertEquals(output.outputs.scores.elements, 12000);
  assertEquals(output.variants["js-controlled"].counters.hops, 3000);
  assertEquals(output.variants["wasm-linear-controlled"].counters.boundaryCrossings, 2);
  assertEquals(output.performanceClaims, []);
});

Deno.test("public routes are closed, readable and mutation-denied", async () => {
  const handler = createHandler(null, "public", null);
  for (
    const route of [
      "/benchmarks/ml-keyword-spotting-v1/",
      "/base-ml-keyword-spotting-demo.js",
      "/base-ml-keyword-spotting-worker.js",
      "/benchmarks/base/ml-keyword-spotting/engine.js",
      "/artifacts/base-ml-keyword-spotting/keyword-spotting.wasm",
      "/artifacts/base-ml-keyword-spotting/fixture-manifest.json",
      "/artifacts/base-ml-keyword-spotting/registration.v1.json",
      "/artifacts/base-ml-keyword-spotting/output-manifest.v1.json",
    ]
  ) {
    const response = await handler(new Request(`http://local.test${route}`));
    assert(response.status === 200, `${route} returned ${response.status}`);
  }
  assertEquals(
    (await handler(
      new Request("http://local.test/artifacts/base-ml-keyword-spotting/private", {
        method: "GET",
      }),
    )).status,
    404,
  );
  assertEquals(
    (await handler(
      new Request("http://local.test/benchmarks/ml-keyword-spotting-v1/", { method: "POST" }),
    )).status,
    403,
  );
});
