import wabtFactory from "wabt";
import * as workload from "../benchmarks/base/numeric-polybench-panel/workload.js";

const root = "benchmarks/base/numeric-polybench-panel";
const out = "public/artifacts/numeric-polybench-panel";
const evidenceDir = "evidence/base/numeric-polybench-panel";
const hex = (bytes: Uint8Array) =>
  Array.from(bytes, (value) => value.toString(16).padStart(2, "0")).join("");
const sha256 = async (bytes: Uint8Array) =>
  hex(new Uint8Array(await crypto.subtle.digest("SHA-256", Uint8Array.from(bytes))));
const fileHash = async (path: string) => sha256(await Deno.readFile(path));
const f64bytes = (values: Float64Array) =>
  new Uint8Array(values.buffer, values.byteOffset, values.byteLength);

await Deno.mkdir(out, { recursive: true });
await Deno.mkdir(evidenceDir, { recursive: true });
const watPath = `${root}/polybench-panel.wat`;
const wat = await Deno.readTextFile(watPath);
const wabt = await wabtFactory();
const parsed = wabt.parseWat(watPath, wat, { simd: false, threads: false, exceptions: false });
parsed.resolveNames();
parsed.validate();
const wasm = new Uint8Array(
  parsed.toBinary({ canonicalize_lebs: true, write_debug_names: false }).buffer,
);
parsed.destroy();
await Deno.writeFile(`${out}/polybench-panel.wasm`, wasm);
const exports = await workload.instantiatePanelWasm(wasm);

const runs = [
  ["gemm", workload.makeGemmFixture(), workload.gemmJS, workload.runGemmWasm],
  ["cholesky", workload.makeCholeskyFixture(), workload.choleskyJS, workload.runCholeskyWasm],
  ["stencil", workload.makeGridFixture(), workload.stencilJS, workload.runStencilWasm],
  ["jacobi2d", workload.makeGridFixture(), workload.jacobi2dJS, workload.runJacobiWasm],
] as const;
const outputs: Record<string, unknown> = {};
for (const [kernel, fixture, runJs, runWasm] of runs) {
  const js = runJs(fixture as never) as Float64Array;
  const linear = runWasm(exports as never, fixture as never) as Float64Array;
  const comparison = workload.compareNumeric(linear, js);
  if (!comparison.passed) throw new Error(`${kernel} JS/Wasm mismatch`);
  const fixtureArrays = Object.values(fixture as Record<string, unknown>).filter((value) =>
    value instanceof Float64Array
  ) as Float64Array[];
  const joined = new Uint8Array(
    fixtureArrays.reduce((total, value) => total + value.byteLength, 0),
  );
  let offset = 0;
  for (const value of fixtureArrays) {
    joined.set(f64bytes(value), offset);
    offset += value.byteLength;
  }
  outputs[kernel] = {
    fixtureSha256: await sha256(joined),
    jsOutputSha256: await sha256(f64bytes(js)),
    wasmOutputSha256: await sha256(f64bytes(linear)),
    elementCount: js.length,
    comparison,
    counters: workload.countersFor(kernel === "jacobi2d" ? "jacobi" : kernel),
  };
}

const sourceHashes = {
  contract: await fileHash(`${root}/contract.json`),
  workload: await fileHash(`${root}/workload.js`),
  wat: await fileHash(watPath),
  frozenCatalog: await fileHash("catalog/workloads.v1.json"),
  artifact: await sha256(wasm),
};
const manifest = {
  schemaVersion: 1,
  workloadId: "numeric.polybench-panel.v1",
  contractId: workload.CONTRACT_ID,
  track: "controlled",
  baseCommit: "e836bf78313074da3a055621fb0c0291b8632b6c",
  reproducibleCommand: "deno task build:base-polybench",
  toolchain: {
    deno: "2.9.0",
    wabt: "1.0.37",
    watFeatures: { simd: false, threads: false, exceptions: false },
    artifactMemory: { initialPages: 64, maximumPages: 64, growth: false },
  },
  sourceHashes,
  outputs,
  performanceClaims: [],
};
await Deno.writeTextFile(`${out}/build-manifest.json`, `${JSON.stringify(manifest, null, 2)}\n`);
const record = {
  schemaVersion: 1,
  recordId: "numeric.polybench-panel.v1.correctness.candidate.v1",
  workloadId: "numeric.polybench-panel.v1",
  status: "passed-static-and-runtime-correctness",
  targets: ["javascript-controlled", "linear-wasm-controlled"],
  exactRegisteredKernels: ["gemm", "cholesky", "stencil", "jacobi2d"],
  completeOutputCompared: true,
  retainedBrowserEvidence: "uncollected",
  sourceHashes,
  outputs,
  limitations: [
    "No performance evidence or claim.",
    "Owned-browser evidence remains an independent acceptance-controller step.",
  ],
};
await Deno.writeTextFile(
  `${evidenceDir}/correctness-record.json`,
  `${JSON.stringify(record, null, 2)}\n`,
);
console.log(
  JSON.stringify({
    artifactBytes: wasm.byteLength,
    artifactSha256: sourceHashes.artifact,
    kernels: Object.keys(outputs),
  }),
);
