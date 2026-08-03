// @ts-ignore Browser same-origin route, mapped by server.ts.
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
} from "/benchmarks/base/numeric-polybench-panel/workload.js";

const runs = {
  gemm: { fixture: makeGemmFixture, js: gemmJS, wasm: runGemmWasm },
  cholesky: { fixture: makeCholeskyFixture, js: choleskyJS, wasm: runCholeskyWasm },
  stencil: { fixture: makeGridFixture, js: stencilJS, wasm: runStencilWasm },
  jacobi2d: { fixture: makeGridFixture, js: jacobi2dJS, wasm: runJacobiWasm },
};
const sha256 = async (values) => {
  const bytes = new Uint8Array(values.buffer, values.byteOffset, values.byteLength);
  return Array.from(
    new Uint8Array(await crypto.subtle.digest("SHA-256", bytes)),
    (v) => v.toString(16).padStart(2, "0"),
  ).join("");
};

self.onmessage = async ({ data }) => {
  const { token, target, kernel } = data;
  try {
    const kernels = kernel === "all" ? Object.keys(runs) : [kernel];
    let wasm;
    if (target !== "javascript") {
      const response = await fetch("/artifacts/numeric-polybench-panel/polybench-panel.wasm", {
        cache: "no-store",
      });
      if (!response.ok) throw new Error(`Wasm fetch failed: ${response.status}`);
      wasm = await instantiatePanelWasm(await response.arrayBuffer());
    }
    const results = [];
    for (const name of kernels) {
      const run = runs[name];
      if (!run) throw new Error(`unknown kernel ${name}`);
      const fixture = run.fixture();
      const jsOutput = target === "wasm" ? run.js(fixture) : run.js(fixture);
      const targetOutput = target === "javascript" ? jsOutput : run.wasm(wasm, fixture);
      const comparison = compareNumeric(targetOutput, jsOutput);
      if (!comparison.passed) throw new Error(`${name} complete-output oracle failed`);
      results.push({
        kernel: name,
        target,
        outputSha256: await sha256(targetOutput),
        comparison,
        counters: countersFor(name === "jacobi2d" ? "jacobi" : name),
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
