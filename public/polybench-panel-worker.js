// @ts-ignore Browser same-origin route, mapped by server.ts.
import {
  checkpointBits,
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
  validateStructure,
} from "/benchmarks/base/numeric-polybench-panel/workload.js";

const runs = {
  gemm: { fixture: makeGemmFixture, js: gemmJS, wasm: runGemmWasm },
  cholesky: { fixture: makeCholeskyFixture, js: choleskyJS, wasm: runCholeskyWasm },
  stencil: { fixture: makeGridFixture, js: stencilJS, wasm: runStencilWasm },
  jacobi2d: { fixture: makeGridFixture, js: jacobi2dJS, wasm: runJacobiWasm },
};
const targetIds = { javascript: "javascript-controlled", wasm: "linear-wasm-controlled" };
const bytesSha256 = async (bytes) =>
  Array.from(
    new Uint8Array(await crypto.subtle.digest("SHA-256", Uint8Array.from(bytes))),
    (value) => value.toString(16).padStart(2, "0"),
  ).join("");
const outputBytes = (values) => new Uint8Array(values.buffer, values.byteOffset, values.byteLength);

async function fetchBytes(route, label) {
  const response = await fetch(route, { cache: "no-store" });
  if (!response.ok) throw new Error(`${label} fetch failed: ${response.status}`);
  return new Uint8Array(await response.arrayBuffer());
}

self.onmessage = async ({ data }) => {
  const { token, target, kernel } = data;
  try {
    const targetId = targetIds[target];
    if (!targetId) throw new Error("unknown target denied");
    const kernels = kernel === "all" ? [...KERNEL_IDS] : [kernel];
    if (kernels.some((name) => !KERNEL_IDS.includes(name))) {
      throw new Error("unknown kernel denied");
    }
    const manifestBytes = await fetchBytes(
      "/artifacts/numeric-polybench-panel/build-manifest.json",
      "build manifest",
    );
    const manifest = JSON.parse(new TextDecoder().decode(manifestBytes));
    if (manifest.workloadId !== "numeric.polybench-panel.v1" || manifest.schemaVersion !== 2) {
      throw new Error("unexpected build manifest identity");
    }
    let wasm;
    if (target === "wasm") {
      const bytes = await fetchBytes(
        "/artifacts/numeric-polybench-panel/polybench-panel.wasm",
        "Wasm",
      );
      if (await bytesSha256(bytes) !== manifest.artifacts.controlledWasm) {
        throw new Error("Wasm bytes do not match the build manifest");
      }
      wasm = await instantiatePanelWasm(bytes);
    }
    const results = [];
    for (const name of kernels) {
      const run = runs[name];
      const fixture = run.fixture();
      const targetOutput = target === "javascript" ? run.js(fixture) : run.wasm(wasm, fixture);
      const expectedDescriptor = manifest.outputs[name]?.reference?.artifact;
      if (!expectedDescriptor || expectedDescriptor.format !== "f64le-complete-output") {
        throw new Error(`${name} reference descriptor missing`);
      }
      const expectedBytes = await fetchBytes(expectedDescriptor.route, `${name} reference`);
      if (
        expectedBytes.byteLength !== expectedDescriptor.bytes ||
        await bytesSha256(expectedBytes) !== expectedDescriptor.sha256
      ) throw new Error(`${name} reference bytes do not match the build manifest`);
      if (expectedBytes.byteLength % 8 !== 0) throw new Error(`${name} reference framing invalid`);
      const expected = new Float64Array(expectedBytes.buffer);
      const comparison = compareNumeric(targetOutput, expected);
      const structuralOracle = validateStructure(name, targetOutput, fixture);
      if (!comparison.passed || !structuralOracle.passed) {
        throw new Error(`${name} independent complete-output oracle failed`);
      }
      results.push({
        kernel: name,
        target: targetId,
        outputSha256: await bytesSha256(outputBytes(targetOutput)),
        comparison,
        structuralOracle,
        checkpoints: checkpointBits(targetOutput),
        counters: countersFor(name, targetId),
      });
      self.postMessage({
        token,
        type: "progress",
        completed: results.length,
        total: kernels.length,
      });
    }
    self.postMessage({ token, type: "complete", results });
  } catch (error) {
    self.postMessage({
      token,
      type: "error",
      message: error instanceof Error ? error.message : String(error),
    });
  }
};
