import { canonicalize, sha256Hex } from "../lib/canonical.ts";
import {
  compareToReference,
  readWasmResult,
  renderJavaScript,
} from "../benchmarks/base-v1/graphics-cpu-path-tracer/engine.js";
import { renderReference } from "../benchmarks/base-v1/graphics-cpu-path-tracer/reference.js";
const root = new URL("../", import.meta.url),
  out = new URL("public/artifacts/graphics-cpu-path-tracer-v1/", root),
  evidence = new URL("public/evidence/base-v1/graphics-cpu-path-tracer-v1/", root);
const sourceArg = Deno.args.find((arg) => arg.startsWith("--source-commit="));
const sourceCommit = sourceArg?.slice(16) ?? "";
if (!/^[a-f0-9]{40}$/.test(sourceCommit)) throw new Error("--source-commit=<40 hex> required");
await Deno.mkdir(out, { recursive: true });
await Deno.mkdir(evidence, { recursive: true });
async function command(name: string, args: string[]) {
  const r = await new Deno.Command(name, {
    args,
    cwd: root.pathname,
    stdout: "piped",
    stderr: "piped",
  }).output();
  if (!r.success) throw new Error(new TextDecoder().decode(r.stderr));
  return r.stdout;
}
const sourcePaths = [
  "benchmarks/base-v1/graphics-cpu-path-tracer/implementation-contract.v1.json",
  "benchmarks/base-v1/graphics-cpu-path-tracer/engine.js",
  "benchmarks/base-v1/graphics-cpu-path-tracer/reference.js",
  "benchmarks/base-v1/graphics-cpu-path-tracer/path-tracer.c",
  "public/benchmarks/graphics-cpu-path-tracer-v1/index.template.html",
  "public/benchmarks/graphics-cpu-path-tracer-v1/runner.js",
  "public/benchmarks/graphics-cpu-path-tracer-v1/worker.js",
  "scripts/build-base-path-tracer.ts",
  "deno.json",
  "deno.lock",
];
const files = [];
for (const path of sourcePaths) {
  const disk = await Deno.readFile(new URL(path, root));
  const tree = await command("git", ["show", `${sourceCommit}:${path}`]);
  if (await sha256Hex(disk) !== await sha256Hex(tree)) {
    throw new Error(`source tree mismatch ${path}`);
  }
  files.push({
    path,
    bytes: tree.length,
    sha256: await sha256Hex(tree),
    immutableUrl: `https://github.com/PaulKinlan/wasm-vs-js/blob/${sourceCommit}/${path}`,
  });
}
const buildDir = new URL(".build/", out).pathname;
await Deno.remove(buildDir, { recursive: true }).catch((error) => {
  if (!(error instanceof Deno.errors.NotFound)) throw error;
});
await Deno.mkdir(buildDir, { recursive: true });
try {
  await command("clang", [
    "--target=wasm32-unknown-unknown",
    "-O3",
    "-nostdlib",
    "-ffreestanding",
    "-fno-builtin",
    "-ffp-contract=off",
    "-c",
    "benchmarks/base-v1/graphics-cpu-path-tracer/path-tracer.c",
    "-o",
    `${buildDir}/path.o`,
  ]);
  await command("wasm-ld", [
    "--no-entry",
    "--export-memory",
    "--export=framebuffer_ptr",
    "--export=counters_ptr",
    "--export=render",
    "--initial-memory=4194304",
    "--max-memory=4194304",
    "--stack-first",
    `${buildDir}/path.o`,
    "-o",
    `${buildDir}/path.wasm`,
  ]);
  await Deno.writeFile(
    new URL("path-tracer.wasm", out),
    await Deno.readFile(`${buildDir}/path.wasm`),
  );
} finally {
  await Deno.remove(buildDir, { recursive: true });
}
const wasm = await Deno.readFile(new URL("path-tracer.wasm", out));
files.push({
  path: "public/artifacts/graphics-cpu-path-tracer-v1/path-tracer.wasm",
  bytes: wasm.length,
  sha256: await sha256Hex(wasm),
  immutableUrl:
    `https://github.com/PaulKinlan/wasm-vs-js/blob/${sourceCommit}/public/artifacts/graphics-cpu-path-tracer-v1/path-tracer.wasm`,
});
const width = 512, height = 512, spp = 64;
console.log("rendering exact JavaScript framebuffer");
const js = renderJavaScript(width, height, spp);
console.log("rendering exact Wasm framebuffer");
const { instance } = await WebAssembly.instantiate(wasm, {});
const wasmResult = readWasmResult(instance, width, height, spp);
console.log("rendering independent f64 reference framebuffer");
const reference = renderReference(width, height, spp);
const jsReference = compareToReference(js.framebuffer, reference),
  wasmReference = compareToReference(wasmResult.framebuffer, reference);
if (!jsReference.passed || !wasmReference.passed) {
  throw new Error(`reference failure ${JSON.stringify({ jsReference, wasmReference })}`);
}
let differing = 0;
for (let i = 0; i < js.framebuffer.length; i++) {
  if (js.framebuffer[i] !== wasmResult.framebuffer[i]) differing++;
}
const crossTarget = compareToReference(js.framebuffer, wasmResult.framebuffer);
if (!crossTarget.passed || crossTarget.maxChannelDelta > 64) {
  throw new Error(`cross-target quantized tolerance failed ${JSON.stringify(crossTarget)}`);
}
if (Math.abs(js.counters.intersections - wasmResult.counters.intersections) > 256) {
  throw new Error("cross-target work mismatch");
}
await Deno.writeFile(new URL("js-controlled.rgba", out), js.framebuffer);
await Deno.writeFile(new URL("wasm-linear-controlled.rgba", out), wasmResult.framebuffer);
await Deno.writeFile(new URL("reference-f64.rgba", out), reference);
for (const name of ["js-controlled.rgba", "wasm-linear-controlled.rgba", "reference-f64.rgba"]) {
  const bytes = await Deno.readFile(new URL(name, out));
  files.push({
    path: `public/artifacts/graphics-cpu-path-tracer-v1/${name}`,
    bytes: bytes.length,
    sha256: await sha256Hex(bytes),
    immutableUrl:
      `https://github.com/PaulKinlan/wasm-vs-js/blob/${sourceCommit}/public/artifacts/graphics-cpu-path-tracer-v1/${name}`,
  });
}
const checkpointPixels = [0, 131328, 262143];
const checkpoints = checkpointPixels.map((pixel) => ({
  pixel,
  js: Array.from(js.framebuffer.slice(pixel * 4, pixel * 4 + 4)),
  wasm: Array.from(wasmResult.framebuffer.slice(pixel * 4, pixel * 4 + 4)),
  reference: Array.from(reference.slice(pixel * 4, pixel * 4 + 4)),
}));
const oracle = {
  width,
  height,
  samplesPerPixel: spp,
  completeBytes: width * height * 4,
  jsFramebufferSha256: await sha256Hex(js.framebuffer),
  wasmFramebufferSha256: await sha256Hex(wasmResult.framebuffer),
  referenceFramebufferSha256: await sha256Hex(reference),
  crossTarget: { differingBytes: differing, ...crossTarget, acceptedMaxChannelDelta: 64 },
  jsReference,
  wasmReference,
  checkpoints,
  pathCheckpoints: js.checkpoints,
  jsCounters: js.counters,
  wasmCounters: wasmResult.counters,
};
const manifest = {
  schemaVersion: 1,
  registrationId: "base-v1.graphics.cpu-path-tracer.v1.controlled.v1",
  catalogId: "graphics.cpu-path-tracer.v1",
  catalogV1: {
    immutable: true,
    sha256: "6665664f984683e5b7d3fdc8c1602198124844704c224a526d48be2f02edf9d4",
  },
  sourceCommit,
  track: "controlled",
  status: "implementation-candidate",
  performanceClaims: [],
  build: {
    command:
      `deno run --allow-read=. --allow-write=public/artifacts/graphics-cpu-path-tracer-v1,public/evidence/base-v1/graphics-cpu-path-tracer-v1,catalog/base-v1-implementations,public/benchmarks/graphics-cpu-path-tracer-v1 --allow-run=git,clang,wasm-ld scripts/build-base-path-tracer.ts --source-commit=${sourceCommit}`,
    toolchain: [{ name: "deno", version: Deno.version.deno }, {
      name: "clang",
      version: new TextDecoder().decode(await command("clang", ["--version"])).split("\n")[0],
    }, {
      name: "wasm-ld",
      version: new TextDecoder().decode(await command("wasm-ld", ["--version"])).trim(),
    }],
    flags: [
      "-O3",
      "-nostdlib",
      "-ffreestanding",
      "-fno-builtin",
      "-ffp-contract=off",
      "fixed memory 4 MiB",
      "no SIMD",
      "no threads",
    ],
  },
  files,
  oracle,
};
const manifestBytes = new TextEncoder().encode(`${canonicalize(manifest)}\n`);
await Deno.writeFile(new URL("build-manifest.json", out), manifestBytes);
const manifestHash = await sha256Hex(manifestBytes);
const template = await Deno.readTextFile(
  new URL("public/benchmarks/graphics-cpu-path-tracer-v1/index.template.html", root),
);
await Deno.writeTextFile(
  new URL("public/benchmarks/graphics-cpu-path-tracer-v1/index.html", root),
  template.replace(
    '    <meta name="build-manifest-sha256" content="__BUILD_MANIFEST_SHA256__">',
    `    <meta name="build-manifest-sha256"\n      content="${manifestHash}">`,
  ),
);
const registration = {
  schemaVersion: 1,
  registrationId: manifest.registrationId,
  catalogId: manifest.catalogId,
  status: "candidate-awaiting-independent-review",
  catalogMutation: false,
  catalogSha256: manifest.catalogV1.sha256,
  fixture: {
    kind: "project-generated",
    licenseSpdx: "CC0-1.0",
    redistribution: "permitted",
    externalAssets: false,
    scene: "fixed seven-sphere Cornell product scene",
    seed: 1831565813,
  },
  fixedWork: { width, height, samplesPerPixel: spp, maxBounces: 4 },
  variants: ["js-controlled", "wasm-linear-controlled"],
  artifactManifest: {
    path: "public/artifacts/graphics-cpu-path-tracer-v1/build-manifest.json",
    sha256: manifestHash,
  },
  demoRoute: "/benchmarks/graphics-cpu-path-tracer-v1/",
  acceptedCoverage: false,
};
await Deno.writeTextFile(
  new URL("catalog/base-v1-implementations/graphics-cpu-path-tracer.v1.json", root),
  `${JSON.stringify(registration, null, 2)}\n`,
);
for (
  const [variant, result] of [["js-controlled", js], [
    "wasm-linear-controlled",
    wasmResult,
  ]] as const
) {
  const record = {
    schemaVersion: 1,
    status: "validation-only",
    catalogId: manifest.catalogId,
    registrationId: manifest.registrationId,
    variant,
    sourceCommit,
    input: { width, height, samplesPerPixel: spp, sceneSeed: 1831565813 },
    completeOutput: {
      bytes: result.framebuffer.length,
      sha256: await sha256Hex(result.framebuffer),
    },
    oracle: variant === "js-controlled" ? jsReference : wasmReference,
    counters: result.counters,
    buildManifest: {
      path: "public/artifacts/graphics-cpu-path-tracer-v1/build-manifest.json",
      sha256: manifestHash,
    },
    performanceClaims: [],
  };
  await Deno.writeTextFile(
    new URL(`${variant}.json`, evidence),
    `${JSON.stringify(record, null, 2)}\n`,
  );
}
console.log(
  `path tracer: ${wasm.length} byte Wasm; exact framebuffers ${oracle.jsFramebufferSha256} / ${oracle.wasmFramebufferSha256}; max target delta ${crossTarget.maxChannelDelta}`,
);
