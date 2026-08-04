import * as workload from "../benchmarks/base/ml-numeric-kernels/workload.js";
const paths = {
  catalog: "/data/workloads.v1.json",
  workload: "/benchmarks/base/ml-numeric-kernels/workload.js",
  fixture: "/artifacts/ml-numeric-kernels/fixture-manifest.json",
  build: "/artifacts/ml-numeric-kernels/build-manifest.json",
  output: "/artifacts/ml-numeric-kernels/output-manifest.json",
  registration: "/implementations/ml.numeric-kernels.v1.json",
  jsEvidence: "/evidence/base-implementations/ml.numeric-kernels.v1/js-controlled-scalar.json",
  wasmEvidence:
    "/evidence/base-implementations/ml.numeric-kernels.v1/wasm-linear-controlled-scalar.json",
  f32Reference: "/artifacts/ml-numeric-kernels/reference.f64",
  f32Bounds: "/artifacts/ml-numeric-kernels/bounds.f64",
  int32Reference: "/artifacts/ml-numeric-kernels/reference.i32",
  uint8Reference: "/artifacts/ml-numeric-kernels/reference.u8",
  wasm: "/artifacts/ml-numeric-kernels/ml-numeric-kernels.wasm",
};
const hex = (bytes) => [...bytes].map((b) => b.toString(16).padStart(2, "0")).join("");
async function sha(bytes) {
  return hex(new Uint8Array(await crypto.subtle.digest("SHA-256", bytes)));
}
async function raw(path) {
  const response = await fetch(path, { cache: "no-store" });
  if (!response.ok) throw new Error(`${path} returned ${response.status}`);
  return new Uint8Array(await response.arrayBuffer());
}
const decodeJson = (bytes) => JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(bytes));
function fixtureBytes(fixtures) {
  const values = Object.values(fixtures);
  const out = new Uint8Array(values.reduce((n, v) => n + v.byteLength, 0));
  let p = 0;
  for (const value of values) {
    out.set(new Uint8Array(value.buffer, value.byteOffset, value.byteLength), p);
    p += value.byteLength;
  }
  return out;
}
function pick(outputs, kernel, dtype) {
  return outputs[`${kernel}${dtype === "f32" ? "F32" : "I8"}`];
}
function f64Values(bytes) {
  if (bytes.byteLength % 8 !== 0) throw new Error("invalid retained f64 oracle length");
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  return Array.from(
    { length: bytes.byteLength / 8 },
    (_, index) => view.getFloat64(index * 8, true),
  );
}
function i32Values(bytes) {
  if (bytes.byteLength % 4 !== 0) throw new Error("invalid retained i32 oracle length");
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  return Array.from({ length: bytes.byteLength / 4 }, (_, index) => view.getInt32(index * 4, true));
}
function assertOracle(outputs, f64Reference, f64Bounds, int32Reference, uint8Reference, target) {
  const f32 = [...outputs.gemmF32, ...outputs.convF32, ...outputs.softmaxF32];
  if (f32.length !== f64Reference.length || f32.length !== f64Bounds.length) {
    throw new Error(`${target} retained FP32 oracle length mismatch`);
  }
  for (let index = 0; index < f32.length; index++) {
    if (
      !Number.isFinite(f32[index]) || Math.abs(f32[index] - f64Reference[index]) > f64Bounds[index]
    ) {
      throw new Error(`${target} retained FP32 oracle mismatch at ${index}`);
    }
  }
  const int32 = [...outputs.gemmI8, ...outputs.convI8];
  if (
    int32.length !== int32Reference.length ||
    !int32.every((value, index) => value === int32Reference[index])
  ) {
    throw new Error(`${target} retained INT32 oracle mismatch`);
  }
  if (
    outputs.softmaxI8.length !== uint8Reference.length ||
    !outputs.softmaxI8.every((value, index) => value === uint8Reference[index])
  ) {
    throw new Error(`${target} retained UINT8 oracle mismatch`);
  }
}
async function wasmOutputs(bytes, fixtures) {
  const { instance } = await WebAssembly.instantiate(bytes);
  const ex = instance.exports, memory = ex.memory;
  function invoke(name, inputs, Ctor, length) {
    let p = 4096;
    const offsets = [];
    for (const value of inputs) {
      p = (p + 3) & ~3;
      offsets.push(p);
      new Uint8Array(memory.buffer, p, value.byteLength).set(
        new Uint8Array(value.buffer, value.byteOffset, value.byteLength),
      );
      p += value.byteLength;
    }
    p = (p + 3) & ~3;
    const out = p;
    const status = ex[name](...offsets, out);
    if (status) throw new Error(`${name} rejected fixture`);
    return new Ctor(memory.buffer, out, length).slice();
  }
  return {
    gemmF32: invoke("gemm_f32", [fixtures.gemmF32A, fixtures.gemmF32B], Float32Array, 56),
    gemmI8: invoke("gemm_i8", [fixtures.gemmI8A, fixtures.gemmI8B], Int32Array, 56),
    convF32: invoke(
      "conv_f32",
      [fixtures.convF32Input, fixtures.convF32Weights],
      Float32Array,
      256,
    ),
    convI8: invoke("conv_i8", [fixtures.convI8Input, fixtures.convI8Weights], Int32Array, 256),
    softmaxF32: invoke("softmax_f32", [fixtures.softmaxF32Input], Float32Array, 128),
    softmaxI8: invoke("softmax_i8", [fixtures.softmaxI8Input], Uint8Array, 128),
  };
}
self.addEventListener("message", async ({ data }) => {
  const token = data?.token;
  try {
    const values = data?.values || {};
    const kernel = values.kernel || "gemm";
    const dtype = values.dtype || "f32";
    let target = values.target || data?.target || "javascript";
    if (target === "wasm" || target === "wasm-linear-controlled") target = "wasm-linear";
    if (target === "js" || target === "js-controlled") target = "javascript";
    if (
      !["gemm", "conv", "softmax"].includes(kernel) || !["f32", "i8"].includes(dtype) ||
      !["javascript", "wasm-linear"].includes(target)
    ) throw new Error("invalid closed demo selection");
    const [
      catalogBytes,
      workloadBytes,
      fixtureManifestBytes,
      buildManifestBytes,
      outputManifestBytes,
      registrationBytes,
      jsEvidenceBytes,
      wasmEvidenceBytes,
      f32ReferenceBytes,
      f32BoundsBytes,
      int32ReferenceBytes,
      uint8ReferenceBytes,
      wasmBytes,
    ] = await Promise.all(Object.values(paths).map(raw));
    const fixtureManifest = decodeJson(fixtureManifestBytes),
      buildManifest = decodeJson(buildManifestBytes),
      outputManifest = decodeJson(outputManifestBytes),
      registration = decodeJson(registrationBytes),
      evidenceRecords = [decodeJson(jsEvidenceBytes), decodeJson(wasmEvidenceBytes)];
    if (
      registration.workloadId !== outputManifest.catalogId ||
      registration.contractId !== outputManifest.contractId ||
      buildManifest.catalogId !== outputManifest.catalogId ||
      buildManifest.contractId !== outputManifest.contractId ||
      fixtureManifest.catalogId !== outputManifest.catalogId ||
      fixtureManifest.contractId !== outputManifest.contractId
    ) throw new Error("manifest identity mismatch");
    const buildManifestSha256 = await sha(buildManifestBytes);
    const outputManifestSha256 = await sha(outputManifestBytes);
    if (buildManifestSha256 !== outputManifest.buildManifestSha256) {
      throw new Error("output manifest does not bind the fetched build manifest bytes");
    }
    const registeredArtifacts = new Map(
      registration.artifactHashes.map((record) => [record.path, record]),
    );
    const assertRegistered = async (path, bytes) => {
      const record = registeredArtifacts.get(path);
      if (
        !registration.artifacts.includes(path) || !record || record.bytes !== bytes.byteLength ||
        record.sha256 !== await sha(bytes)
      ) throw new Error(`registration artifact mismatch: ${path}`);
    };
    await assertRegistered(
      "public/artifacts/ml-numeric-kernels/output-manifest.json",
      outputManifestBytes,
    );
    await assertRegistered(
      "public/evidence/base-implementations/ml.numeric-kernels.v1/js-controlled-scalar.json",
      jsEvidenceBytes,
    );
    await assertRegistered(
      "public/evidence/base-implementations/ml.numeric-kernels.v1/wasm-linear-controlled-scalar.json",
      wasmEvidenceBytes,
    );
    const expectedEvidence = new Map([
      [
        "js-controlled-scalar",
        [outputManifest.jsControlledSha256, outputManifest.counters.javascript],
      ],
      [
        "wasm-linear-controlled-scalar",
        [outputManifest.wasmLinearControlledSha256, outputManifest.counters.wasmLinear],
      ],
    ]);
    const validatedEvidence = new Set();
    for (const evidence of evidenceRecords) {
      const expected = expectedEvidence.get(evidence.variantId);
      if (
        !expected || validatedEvidence.has(evidence.variantId) ||
        evidence.workloadId !== outputManifest.catalogId ||
        evidence.contractId !== outputManifest.contractId ||
        evidence.outputManifestSha256 !== outputManifestSha256 ||
        evidence.buildManifestSha256 !== buildManifestSha256 ||
        JSON.stringify(evidence.completeOutputSha256) !== JSON.stringify(expected[0]) ||
        JSON.stringify(evidence.counters) !== JSON.stringify(expected[1])
      ) throw new Error(`evidence trust-chain mismatch: ${evidence.variantId}`);
      validatedEvidence.add(evidence.variantId);
    }
    if (validatedEvidence.size !== expectedEvidence.size) {
      throw new Error("incomplete evidence trust chain");
    }
    if (await sha(catalogBytes) !== fixtureManifest.frozenCatalogSha256) {
      throw new Error("frozen catalog byte mismatch");
    }
    if (
      await sha(workloadBytes) !== buildManifest.fullSourceGraph.find(
        ({ path }) => path === "benchmarks/base/ml-numeric-kernels/workload.js",
      )?.sha256
    ) throw new Error("workload source mismatch");
    if (await sha(wasmBytes) !== buildManifest.artifact.sha256) {
      throw new Error("Wasm artifact mismatch");
    }
    const fixtures = workload.generateFixtures();
    if (await sha(fixtureBytes(fixtures)) !== fixtureManifest.fixtureSha256) {
      throw new Error("fixture mismatch");
    }
    const oracleArtifacts = [
      [f32ReferenceBytes, outputManifest.oracle.f32Reference],
      [f32BoundsBytes, outputManifest.oracle.f32Bounds],
      [int32ReferenceBytes, outputManifest.oracle.int32Reference],
      [uint8ReferenceBytes, outputManifest.oracle.uint8Reference],
    ];
    for (const [artifactBytes, record] of oracleArtifacts) {
      if (artifactBytes.byteLength !== record.bytes || await sha(artifactBytes) !== record.sha256) {
        throw new Error(`retained oracle artifact mismatch: ${record.path}`);
      }
    }
    const js = workload.runAll(fixtures), wasm = await wasmOutputs(wasmBytes, fixtures);
    const f32Reference = f64Values(f32ReferenceBytes), f32Bounds = f64Values(f32BoundsBytes);
    const int32Reference = i32Values(int32ReferenceBytes);
    assertOracle(js, f32Reference, f32Bounds, int32Reference, uint8ReferenceBytes, "JavaScript");
    assertOracle(wasm, f32Reference, f32Bounds, int32Reference, uint8ReferenceBytes, "Wasm");
    for (const key of Object.keys(js)) {
      if (
        js[key].length !== wasm[key].length || !js[key].every((v, i) => Object.is(v, wasm[key][i]))
      ) throw new Error(`complete output mismatch: ${key}`);
    }
    const jsCounters = workload.workCounters("javascript");
    const wasmCounters = workload.workCounters("wasm-linear");
    // Counter identity is order-insensitive: the pinned manifest stores keys
    // sorted, while the runtime object uses insertion order.
    const canonicalCounters = (counters) =>
      JSON.stringify(
        Object.fromEntries(
          Object.entries(counters).sort(([a], [b]) => (a < b ? -1 : 1)),
        ),
      );
    if (
      canonicalCounters(jsCounters) !== canonicalCounters(outputManifest.counters.javascript) ||
      canonicalCounters(wasmCounters) !== canonicalCounters(outputManifest.counters.wasmLinear)
    ) {
      throw new Error("exact operative counter mismatch");
    }
    const selected = pick(target === "javascript" ? js : wasm, kernel, dtype);
    const selectedBytes = new Uint8Array(selected.buffer, selected.byteOffset, selected.byteLength);
    const expected =
      outputManifest[target === "javascript" ? "jsControlledSha256" : "wasmLinearControlledSha256"][
        `${kernel}${dtype === "f32" ? "F32" : "I8"}`
      ];
    const digest = await sha(selectedBytes);
    if (digest !== expected) throw new Error("selected complete output hash mismatch");
    const counters = target === "javascript" ? jsCounters : wasmCounters;
    const preview = Array.from(selected.slice(0, 8));
    self.postMessage({
      token,
      type: "complete",
      text:
        `Target: ${target}\nKernel: ${kernel}\nData type: ${dtype}\nElements validated: ${selected.length}\nComplete output SHA-256: ${digest}\nPreview: ${
          JSON.stringify(preview)
        }\nCounters: ${JSON.stringify(counters, null, 2)}\nNo timing or ranking was collected.`,
    });
  } catch (error) {
    self.postMessage({
      token,
      type: "error",
      message: error instanceof Error ? error.message : String(error),
    });
  }
});
