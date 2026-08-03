import {
  assertEquivalent,
  CONTRACT,
  instantiateWasm,
  runJavaScript,
  runWasm,
  sha256Hex,
} from "../benchmarks/base/ml-keyword-spotting/engine.js";
import { generateKeywordSpottingConstants } from "../benchmarks/base/ml-keyword-spotting/generate-constants.ts";

const root = new URL("../", import.meta.url);
const sourceCommit = Deno.args.find((value) => value.startsWith("--source-commit="))?.slice(16) ??
  "";
const pcmPath = Deno.args.find((value) => value.startsWith("--pcm="))?.slice(6) ?? "";
if (!/^[a-f0-9]{40}$/.test(sourceCommit)) {
  throw new Error("--source-commit=<40 lowercase hex> required");
}
if (!pcmPath) throw new Error("--pcm=<recipe-acquired exact 1,920,000-byte PCM16LE path> required");
const fixtureManifest = JSON.parse(
  await Deno.readTextFile(
    new URL("benchmarks/base/ml-keyword-spotting/speech-commands-subset.v1.json", root),
  ),
);
const committedConstants = JSON.parse(
  await Deno.readTextFile(
    new URL("benchmarks/base/ml-keyword-spotting/constants.v1.json", root),
  ),
);
if (JSON.stringify(generateKeywordSpottingConstants()) !== JSON.stringify(committedConstants)) {
  throw new Error("committed model/preprocessing constants do not match the pinned generator");
}
const pcmBytes = await Deno.readFile(pcmPath);
if (pcmBytes.length !== CONTRACT.samples * 2) throw new Error(`PCM byte length ${pcmBytes.length}`);
if (await sha256Hex(pcmBytes) !== fixtureManifest.normalizedPcmSha256) {
  throw new Error("PCM hash does not match frozen recipe-only manifest");
}
const pcm = new Int16Array(pcmBytes.buffer, pcmBytes.byteOffset, CONTRACT.samples);

async function command(name: string, args: string[]) {
  const result = await new Deno.Command(name, {
    args,
    cwd: root.pathname,
    stdout: "piped",
    stderr: "piped",
  }).output();
  if (!result.success) throw new Error(new TextDecoder().decode(result.stderr));
  return new TextDecoder().decode(result.stdout).trim();
}
async function gitBytes(path: string) {
  const result = await new Deno.Command("git", {
    args: ["show", `${sourceCommit}:${path}`],
    cwd: root.pathname,
    stdout: "piped",
    stderr: "piped",
  }).output();
  if (!result.success) throw new Error(`source commit does not contain ${path}`);
  return result.stdout;
}
const outDir = new URL("public/artifacts/base-ml-keyword-spotting/", root);
await Deno.mkdir(outDir, { recursive: true });
const buildDir = new URL(".build/", outDir);
await Deno.remove(buildDir, { recursive: true }).catch((error) => {
  if (!(error instanceof Deno.errors.NotFound)) throw error;
});
await Deno.mkdir(buildDir, { recursive: true });
try {
  const object = new URL("keyword-spotting.o", buildDir).pathname;
  const wasmPath = new URL("keyword-spotting.wasm", buildDir).pathname;
  await command("clang", [
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
  ]);
  await command("wasm-ld", [
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
    wasmPath,
  ]);
  await Deno.writeFile(new URL("keyword-spotting.wasm", outDir), await Deno.readFile(wasmPath));
} finally {
  await Deno.remove(buildDir, { recursive: true });
}
const wasmBytes = await Deno.readFile(new URL("keyword-spotting.wasm", outDir));
const wasmExports = await instantiateWasm(wasmBytes);
const js = runJavaScript(pcm);
const wasm = runWasm(wasmExports, pcm);
assertEquivalent(js, wasm);
const outputs = {
  features: {
    elements: js.features.length,
    bytes: js.features.byteLength,
    sha256: await sha256Hex(js.features),
  },
  scores: {
    elements: js.scores.length,
    bytes: js.scores.byteLength,
    sha256: await sha256Hex(js.scores),
  },
  detections: {
    elements: js.detections.length,
    bytes: js.detections.byteLength,
    sha256: await sha256Hex(js.detections),
  },
};
const sourcePaths = [
  "benchmarks/base/ml-keyword-spotting/engine.js",
  "benchmarks/base/ml-keyword-spotting/generate-constants.ts",
  "benchmarks/base/ml-keyword-spotting/constants.v1.js",
  "benchmarks/base/ml-keyword-spotting/constants.v1.json",
  "benchmarks/base/ml-keyword-spotting/constants.v1.h",
  "benchmarks/base/ml-keyword-spotting/keyword-spotting.c",
  "benchmarks/base/ml-keyword-spotting/speech-commands-subset.v1.json",
  "benchmarks/base/ml-keyword-spotting/implementation-contract.v1.json",
  "benchmarks/base/ml-keyword-spotting/RIGHTS.md",
  "scripts/acquire-base-ml-keyword-spotting.ts",
  "scripts/build-base-ml-keyword-spotting.ts",
  "public/benchmarks/ml-keyword-spotting-v1/index.html",
  "public/base-ml-keyword-spotting-demo.js",
  "public/base-ml-keyword-spotting-worker.js",
  "tests/base/ml-keyword-spotting.test.ts",
  "server.ts",
  "catalog/workloads.v1.json",
  "public/data/workloads.v1.json",
  "deno.json",
  "deno.lock",
];
const sourceGraph = [];
for (const path of sourcePaths) {
  const tree = await gitBytes(path);
  const disk = await Deno.readFile(new URL(path, root));
  const treeHash = await sha256Hex(tree);
  if (treeHash !== await sha256Hex(disk)) throw new Error(`disk/source commit mismatch at ${path}`);
  sourceGraph.push({
    path,
    sha256: treeHash,
    immutableUrl: `https://github.com/PaulKinlan/wasm-vs-js/blob/${sourceCommit}/${path}`,
  });
}
const catalogBytes = await Deno.readFile(new URL("catalog/workloads.v1.json", root));
const registration = {
  schemaVersion: 1,
  workloadId: CONTRACT.workloadId,
  status: "proposal-validation-complete",
  frozenCatalog: {
    path: "catalog/workloads.v1.json",
    sha256: await sha256Hex(catalogBytes),
    immutability: "byte-for-byte",
  },
  fixture: {
    manifestPath: "benchmarks/base/ml-keyword-spotting/speech-commands-subset.v1.json",
    redistribution: "recipe-only",
    normalizedPcmSha256: fixtureManifest.normalizedPcmSha256,
  },
  contract: CONTRACT,
  variants: [
    {
      id: "js-controlled",
      target: "javascript",
      implementation: "independent authored integer preprocessing and DS-CNN",
    },
    {
      id: "wasm-linear-controlled",
      target: "wasm-linear",
      implementation:
        "authored C compiled to linear Wasm; full preprocessing and DS-CNN execute in module",
    },
  ],
  sourceCommit,
  sourceGraph,
  toolchain: {
    deno: Deno.version.deno,
    clang: await command("clang", ["--version"]).then((value) => value.split("\n")[0]),
    linker: await command("wasm-ld", ["--version"]),
    compilerFlags: [
      "--target=wasm32-unknown-unknown",
      "-O3",
      "-nostdlib",
      "-ffreestanding",
      "-fno-builtin",
      "-fwrapv",
    ],
    linkerFlags: [
      "--no-entry",
      "--initial-memory=4194304",
      "--max-memory=4194304",
      "--stack-first",
    ],
  },
  artifact: {
    path: "public/artifacts/base-ml-keyword-spotting/keyword-spotting.wasm",
    bytes: wasmBytes.length,
    sha256: await sha256Hex(wasmBytes),
    initialMemoryBytes: 4194304,
    maximumMemoryBytes: 4194304,
  },
  oracle: {
    kind: "complete exact integer output plus frozen Speech Commands recipe",
    outputs,
    jsCounters: js.counters,
    wasmCounters: wasm.counters,
    crossTargetExact: true,
  },
  performanceClaims: [],
};
await Deno.writeTextFile(
  new URL("registration.v1.json", outDir),
  `${JSON.stringify(registration, null, 2)}\n`,
);
await Deno.writeTextFile(
  new URL("output-manifest.v1.json", outDir),
  `${
    JSON.stringify(
      {
        schemaVersion: 1,
        workloadId: CONTRACT.workloadId,
        fixtureSha256: fixtureManifest.normalizedPcmSha256,
        outputs,
        variants: {
          "js-controlled": { status: "passed", counters: js.counters },
          "wasm-linear-controlled": { status: "passed", counters: wasm.counters },
        },
        performanceClaims: [],
      },
      null,
      2,
    )
  }\n`,
);
console.log(
  JSON.stringify(
    {
      wasmBytes: wasmBytes.length,
      outputs,
      detections: js.detections.length / 3,
      counters: js.counters,
    },
    null,
    2,
  ),
);
