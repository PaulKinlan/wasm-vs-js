import wabtFactory from "wabt";
import * as workload from "../benchmarks/base/numeric-polybench-panel/workload.js";

const args = [...Deno.args];
function option(name: string, fallback?: string) {
  const index = args.indexOf(name);
  if (index < 0) return fallback;
  const value = args[index + 1];
  if (!value || value.startsWith("--")) throw new Error(`${name} requires a value`);
  return value;
}
if (Deno.version.deno !== "2.9.0") throw new Error(`Deno 2.9.0 required, got ${Deno.version.deno}`);
const sourceCommit = option("--source-commit");
if (!sourceCommit || !/^[0-9a-f]{40}$/.test(sourceCommit)) {
  throw new Error("--source-commit must be the exact 40-character implementation commit");
}
const outputRoot = option("--output-root", ".")!;
const sourceRoot = "benchmarks/base/numeric-polybench-panel";
const relativeArtifactDir = "public/artifacts/numeric-polybench-panel";
const relativeEvidenceDir = "evidence/base/numeric-polybench-panel";
const artifactDir = `${outputRoot}/${relativeArtifactDir}`;
const evidenceDir = `${outputRoot}/${relativeEvidenceDir}`;
const outputDir = `${artifactDir}/outputs`;
const hex = (bytes: Uint8Array) =>
  Array.from(bytes, (value) => value.toString(16).padStart(2, "0")).join("");
const sha256 = async (bytes: Uint8Array) =>
  hex(new Uint8Array(await crypto.subtle.digest("SHA-256", Uint8Array.from(bytes))));
const f64bytes = (values: Float64Array) =>
  new Uint8Array(values.buffer, values.byteOffset, values.byteLength);
const run = async (command: string, commandArgs: string[]) => {
  const result = await new Deno.Command(command, {
    args: commandArgs,
    stdout: "piped",
    stderr: "piped",
  }).output();
  if (!result.success) throw new Error(new TextDecoder().decode(result.stderr));
  return result.stdout;
};

const repository = "https://github.com/PaulKinlan/wasm-vs-js";
const remote = new TextDecoder().decode(await run("git", ["config", "--get", "remote.origin.url"]))
  .trim().replace(/\.git$/, "");
if (remote !== repository) throw new Error(`unexpected source repository ${remote}`);
const resolvedCommit = new TextDecoder().decode(
  await run("git", ["rev-parse", `${sourceCommit}^{commit}`]),
).trim();
if (resolvedCommit !== sourceCommit) throw new Error("source commit did not resolve exactly");

const sourcePaths = [
  `${sourceRoot}/contract.json`,
  `${sourceRoot}/polybench-panel.wat`,
  `${sourceRoot}/reference.c`,
  `${sourceRoot}/workload.js`,
  "deno.lock",
  "deno.polybench.json",
  "evidence/base/numeric-polybench-panel/prior-art-verification.json",
  "public/benchmarks/numeric.polybench-panel.v1/index.html",
  "public/polybench-panel-demo.js",
  "public/polybench-panel-worker.js",
  "schemas/base-correctness-record.schema.json",
  "schemas/base-workload-contract.schema.json",
  "scripts/build-base-polybench.ts",
  "server.ts",
  "tests/base/polybench-panel.test.ts",
];
const sourceGraph = [];
const treeParts: Uint8Array[] = [];
for (const path of sourcePaths) {
  const local = await Deno.readFile(path);
  const committed = await run("git", ["show", `${sourceCommit}:${path}`]);
  if (hex(local) !== hex(committed)) {
    throw new Error(`source path differs from implementation commit: ${path}`);
  }
  const digest = await sha256(local);
  sourceGraph.push({ path, bytes: local.byteLength, sha256: digest });
  treeParts.push(new TextEncoder().encode(`${path}\0${digest}\n`));
}
const sourceTreeBytes = new Uint8Array(treeParts.reduce((sum, part) => sum + part.length, 0));
let sourceOffset = 0;
for (const part of treeParts) {
  sourceTreeBytes.set(part, sourceOffset);
  sourceOffset += part.length;
}
const sourceTreeSha256 = await sha256(sourceTreeBytes);

await Deno.mkdir(outputDir, { recursive: true });
await Deno.mkdir(evidenceDir, { recursive: true });
const watPath = `${sourceRoot}/polybench-panel.wat`;
const wabt = await wabtFactory();
const parsed = wabt.parseWat(watPath, await Deno.readTextFile(watPath), {
  simd: false,
  threads: false,
  exceptions: false,
});
parsed.resolveNames();
parsed.validate();
const wasm = new Uint8Array(
  parsed.toBinary({ canonicalize_lebs: true, write_debug_names: false }).buffer,
);
parsed.destroy();
await Deno.writeFile(`${artifactDir}/polybench-panel.wasm`, wasm);

const clangVersion = new TextDecoder().decode(await run("clang", ["--version"])).split("\n")[0];
if (clangVersion !== "clang version 22.1.8") {
  throw new Error(`unexpected clang toolchain: ${clangVersion}`);
}
const temp = await Deno.makeTempDir({ prefix: "polybench-reference-" });
let referenceWasm: Uint8Array;
try {
  const referencePath = `${temp}/reference-oracle.wasm`;
  const clangFlags = [
    "--target=wasm32",
    "-O0",
    "-ffp-contract=off",
    "-fno-fast-math",
    "-nostdlib",
    "-Wl,--no-entry",
    "-Wl,--export-memory",
    "-Wl,--export=reference_gemm",
    "-Wl,--export=reference_cholesky",
    "-Wl,--export=reference_stencil5",
    "-Wl,--export=reference_jacobi2d",
    "-Wl,--initial-memory=4194304",
    "-Wl,--max-memory=4194304",
    `${sourceRoot}/reference.c`,
    "-o",
    referencePath,
  ];
  await run("clang", clangFlags);
  referenceWasm = await Deno.readFile(referencePath);
} finally {
  await Deno.remove(temp, { recursive: true });
}
await Deno.writeFile(`${artifactDir}/reference-oracle.wasm`, referenceWasm);

const primary = await workload.instantiatePanelWasm(wasm);
const referenceModule = await WebAssembly.compile(Uint8Array.from(referenceWasm));
const referenceInstance = await WebAssembly.instantiate(referenceModule, {});
type ReferenceExports = {
  memory: WebAssembly.Memory;
  reference_gemm: (
    a: number,
    b: number,
    c: number,
    ni: number,
    nj: number,
    nk: number,
    alpha: number,
    beta: number,
  ) => void;
  reference_cholesky: (a: number, n: number) => number;
  reference_stencil5: (a: number, b: number, n: number) => void;
  reference_jacobi2d: (a: number, b: number, n: number, timesteps: number) => void;
};
const reference = referenceInstance.exports as unknown as ReferenceExports;
const align8 = (value: number) => (value + 7) & ~7;
const write = (memory: WebAssembly.Memory, offset: number, values: Float64Array) => {
  new Float64Array(memory.buffer, offset, values.length).set(values);
  return align8(offset + values.byteLength);
};
const read = (memory: WebAssembly.Memory, offset: number, length: number) =>
  new Float64Array(memory.buffer, offset, length).slice();
function referenceOutput(kernel: string, fixture: Record<string, unknown>) {
  const memory = reference.memory;
  if (kernel === "gemm") {
    const f = fixture as ReturnType<typeof workload.makeGemmFixture>;
    let off = 0;
    const a = off;
    off = write(memory, off, f.a);
    const b = off;
    off = write(memory, off, f.b);
    const c = off;
    write(memory, off, f.c);
    reference.reference_gemm(a, b, c, f.ni, f.nj, f.nk, f.alpha, f.beta);
    return read(memory, c, f.c.length);
  }
  if (kernel === "cholesky") {
    const f = fixture as ReturnType<typeof workload.makeCholeskyFixture>;
    write(memory, 0, f.a);
    if (reference.reference_cholesky(0, f.n) !== 1) {
      throw new Error("C reference rejected registered SPD matrix");
    }
    return read(memory, 0, f.a.length);
  }
  const f = fixture as ReturnType<typeof workload.makeGridFixture>;
  const a = 0, b = align8(f.a.byteLength);
  write(memory, a, f.a);
  write(memory, b, f.b);
  if (kernel === "stencil") reference.reference_stencil5(a, b, f.n);
  else reference.reference_jacobi2d(a, b, f.n, workload.DIMENSIONS.jacobi2d.timesteps);
  return read(memory, kernel === "stencil" ? b : a, f.a.length);
}

const cases = {
  gemm: { fixture: workload.makeGemmFixture(), js: workload.gemmJS, linear: workload.runGemmWasm },
  cholesky: {
    fixture: workload.makeCholeskyFixture(),
    js: workload.choleskyJS,
    linear: workload.runCholeskyWasm,
  },
  stencil: {
    fixture: workload.makeGridFixture(),
    js: workload.stencilJS,
    linear: workload.runStencilWasm,
  },
  jacobi2d: {
    fixture: workload.makeGridFixture(),
    js: workload.jacobi2dJS,
    linear: workload.runJacobiWasm,
  },
} as const;
const outputs: Record<string, unknown> = {};
for (const kernel of workload.KERNEL_IDS) {
  const runCase = cases[kernel as keyof typeof cases];
  const fixture = runCase.fixture as Record<string, unknown>;
  const independent = referenceOutput(kernel, fixture);
  const js = runCase.js(runCase.fixture as never) as Float64Array;
  const linear = runCase.linear(primary as never, runCase.fixture as never) as Float64Array;
  const fixtureArrays = Object.entries(fixture).filter((entry): entry is [string, Float64Array] =>
    entry[1] instanceof Float64Array
  );
  const fixtureParts = [];
  for (const [name, values] of fixtureArrays) {
    fixtureParts.push({ name, bytes: values.byteLength, sha256: await sha256(f64bytes(values)) });
  }
  const targets = {} as Record<string, unknown>;
  for (
    const [target, values] of [["javascript-controlled", js], [
      "linear-wasm-controlled",
      linear,
    ]] as const
  ) {
    const comparison = workload.compareNumeric(values, independent);
    const structuralOracle = workload.validateStructure(kernel, values, runCase.fixture);
    if (!comparison.passed || !structuralOracle.passed) {
      throw new Error(`${kernel}/${target} independent oracle failed`);
    }
    const relativePath = `outputs/${kernel}.${target}.f64le`;
    await Deno.writeFile(`${artifactDir}/${relativePath}`, f64bytes(values));
    targets[target] = {
      artifact: {
        file: `${relativeArtifactDir}/${relativePath}`,
        route: `/artifacts/numeric-polybench-panel/${relativePath}`,
        bytes: values.byteLength,
        elements: values.length,
        sha256: await sha256(f64bytes(values)),
        format: "f64le-complete-output",
      },
      comparison,
      structuralOracle,
      checkpoints: workload.checkpointBits(values),
      counters: workload.countersFor(kernel, target),
    };
  }
  const referenceRelativePath = `outputs/${kernel}.reference.f64le`;
  await Deno.writeFile(`${artifactDir}/${referenceRelativePath}`, f64bytes(independent));
  outputs[kernel] = {
    fixture: {
      arrays: fixtureParts,
      totalBytes: fixtureParts.reduce((sum, part) => sum + part.bytes, 0),
    },
    reference: {
      implementation: "independent-clang-c-oracle",
      artifact: {
        file: `${relativeArtifactDir}/${referenceRelativePath}`,
        route: `/artifacts/numeric-polybench-panel/${referenceRelativePath}`,
        bytes: independent.byteLength,
        elements: independent.length,
        sha256: await sha256(f64bytes(independent)),
        format: "f64le-complete-output",
      },
      checkpoints: workload.checkpointBits(independent),
    },
    targets,
  };
}

const artifactHashes = {
  controlledWasm: await sha256(wasm),
  independentReferenceWasm: await sha256(referenceWasm),
};
const reproducibleCommand =
  `deno task --config deno.polybench.json build:base-polybench --source-commit ${sourceCommit}`;
const manifest = {
  schemaVersion: 2,
  workloadId: "numeric.polybench-panel.v1",
  contractId: workload.CONTRACT_ID,
  track: "controlled",
  repository,
  implementationCommit: sourceCommit,
  sourceTreeSha256,
  sourceGraph,
  reproducibleCommand,
  toolchain: {
    deno: "2.9.0",
    wabt: "1.0.37",
    clang: "22.1.8",
    primaryFlags: [
      "canonicalize_lebs=true",
      "write_debug_names=false",
      "simd=false",
      "threads=false",
      "exceptions=false",
      "memory=64-pages-fixed",
    ],
    referenceFlags: [
      "--target=wasm32",
      "-O0",
      "-ffp-contract=off",
      "-fno-fast-math",
      "-nostdlib",
      "memory=64-pages-fixed",
    ],
    lockfile: sourceGraph.find((entry) => entry.path === "deno.lock"),
  },
  artifacts: artifactHashes,
  outputs,
  performanceClaims: [],
};
await Deno.writeTextFile(
  `${artifactDir}/build-manifest.json`,
  `${JSON.stringify(manifest, null, 2)}\n`,
);
const record = {
  schemaVersion: 2,
  recordId: "numeric.polybench-panel.v1.correctness.candidate.v2",
  workloadId: "numeric.polybench-panel.v1",
  contractId: workload.CONTRACT_ID,
  repository,
  implementationCommit: sourceCommit,
  sourceTreeSha256,
  status: "passed-independent-complete-output-correctness",
  targets: [...workload.TARGET_IDS],
  exactRegisteredKernels: [...workload.KERNEL_IDS],
  completeOutputCompared: true,
  retainedBrowserEvidence: "uncollected",
  buildManifest: {
    file: `${relativeArtifactDir}/build-manifest.json`,
    route: "/artifacts/numeric-polybench-panel/build-manifest.json",
  },
  artifacts: artifactHashes,
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
    implementationCommit: sourceCommit,
    controlledWasmBytes: wasm.byteLength,
    controlledWasmSha256: artifactHashes.controlledWasm,
    referenceWasmBytes: referenceWasm.byteLength,
    kernels: workload.KERNEL_IDS,
  }),
);
