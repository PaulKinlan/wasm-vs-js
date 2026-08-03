import { sha256Hex } from "../lib/canonical.ts";
import {
  CONTRACT,
  makeAnimationTable,
  normalizeControlledOutput,
  OUTPUT_BYTES,
  quantizeDecodedMesh,
  runJavaScript,
  validateGltfContract,
} from "../benchmarks/base/graphics-gltf-viewer/engine.js";

const root = new URL("../", import.meta.url);
const fixtures = new URL("fixtures/base/graphics-gltf-viewer/", root);
const artifacts = new URL("public/artifacts/base-gltf-viewer/", root);
const evidenceDir = new URL("public/evidence/base-workloads/graphics-gltf-viewer/", root);
const sourceArg = Deno.args.find((arg) => arg.startsWith("--source-commit="));
const sourceCommit = sourceArg?.slice(16) ?? "";
if (!/^[a-f0-9]{40}$/.test(sourceCommit)) {
  throw new Error("--source-commit=<40 lowercase hex> required");
}

async function command(name: string, args: string[], cwd = root.pathname) {
  const result = await new Deno.Command(name, { args, cwd, stdout: "piped", stderr: "piped" })
    .output();
  if (!result.success) throw new Error(`${name}: ${new TextDecoder().decode(result.stderr)}`);
  return result.stdout;
}
async function decode(mode: "javascript" | "wasm") {
  const decoder = mode === "javascript"
    ? "public/artifacts/base-gltf-viewer/draco_decoder_gltf.js"
    : "public/artifacts/base-gltf-viewer/draco_wasm_wrapper_gltf.js";
  const wasm = mode === "wasm" ? "public/artifacts/base-gltf-viewer/draco_decoder_gltf.wasm" : "-";
  const bytes = await command("node", [
    "scripts/decode-gltf-draco.cjs",
    mode,
    decoder,
    wasm,
    "fixtures/base/graphics-gltf-viewer/Avocado.bin",
  ]);
  const value = JSON.parse(new TextDecoder().decode(bytes));
  if (value.points !== 406 || value.faces !== 682) throw new Error(`${mode} Draco counts`);
  return {
    positions: new Float32Array(value.positions),
    normals: new Float32Array(value.normals),
    texcoords: new Float32Array(value.texcoords),
    indices: new Uint32Array(value.indices),
  };
}
function meshBytes(mesh: ReturnType<typeof quantizeDecodedMesh>) {
  const header = new Uint32Array([
    mesh.vertexCount,
    mesh.indices.length,
    mesh.positions.length,
    mesh.normals.length,
    mesh.texcoords.length,
  ]);
  const bytes = new Uint8Array(
    header.byteLength + mesh.positions.byteLength + mesh.normals.byteLength +
      mesh.texcoords.byteLength + mesh.indices.byteLength,
  );
  let offset = 0;
  for (const value of [header, mesh.positions, mesh.normals, mesh.texcoords, mesh.indices]) {
    bytes.set(new Uint8Array(value.buffer, value.byteOffset, value.byteLength), offset);
    offset += value.byteLength;
  }
  return bytes;
}
async function fileRef(path: string) {
  const bytes = await Deno.readFile(new URL(path, root));
  return { path, bytes: bytes.length, sha256: await sha256Hex(bytes) };
}
async function sourceRef(path: string) {
  const disk = await Deno.readFile(new URL(path, root));
  const tree = await command("git", ["show", `${sourceCommit}:${path}`]);
  if (await sha256Hex(disk) !== await sha256Hex(tree)) {
    throw new Error(`source tree mismatch: ${path}`);
  }
  return {
    path,
    bytes: tree.length,
    sha256: await sha256Hex(tree),
    immutableUrl: `https://github.com/PaulKinlan/wasm-vs-js/blob/${sourceCommit}/${path}`,
  };
}
await Deno.mkdir(artifacts, { recursive: true });
await Deno.mkdir(evidenceDir, { recursive: true });
const gltfText = await Deno.readTextFile(new URL("Avocado.gltf", fixtures));
const contract = validateGltfContract(gltfText);
const jsDecoded = await decode("javascript");
const wasmDecoded = await decode("wasm");
const jsMesh = quantizeDecodedMesh(jsDecoded);
const wasmMesh = quantizeDecodedMesh(wasmDecoded);
const jsMeshBytes = meshBytes(jsMesh);
const wasmMeshBytes = meshBytes(wasmMesh);
if (await sha256Hex(jsMeshBytes) !== await sha256Hex(wasmMeshBytes)) {
  throw new Error("asm.js and Wasm Draco decoded meshes differ");
}
await Deno.writeFile(new URL("decoded-mesh.bin", artifacts), jsMeshBytes);
const animation = makeAnimationTable();
await Deno.writeFile(new URL("animation-table.i32", artifacts), new Uint8Array(animation.buffer));

const buildDir = new URL(".build/", artifacts);
await Deno.remove(buildDir, { recursive: true }).catch(() => {});
await Deno.mkdir(buildDir);
try {
  await command("clang", [
    "--target=wasm32-unknown-unknown",
    "-O3",
    "-nostdlib",
    "-ffreestanding",
    "-fno-builtin",
    "-fno-vectorize",
    "-fno-slp-vectorize",
    "-c",
    "benchmarks/base/graphics-gltf-viewer/viewer.c",
    "-o",
    `${buildDir.pathname}viewer.o`,
  ]);
  await command("wasm-ld", [
    "--no-entry",
    "--export-memory",
    "--export=heap_ptr",
    "--export=output_ptr",
    "--export=validate_gltf",
    "--export=run",
    "--stack-first",
    "--initial-memory=33554432",
    "--max-memory=33554432",
    `${buildDir.pathname}viewer.o`,
    "-o",
    `${buildDir.pathname}viewer.wasm`,
  ]);
  await Deno.writeFile(
    new URL("viewer.wasm", artifacts),
    await Deno.readFile(`${buildDir.pathname}viewer.wasm`),
  );
} finally {
  await Deno.remove(buildDir, { recursive: true });
}

const texture = await Deno.readFile(new URL("base-color-64.rgba", fixtures));
const jsOutput = runJavaScript(jsMesh, texture, animation);
const wasmBytes = await Deno.readFile(new URL("viewer.wasm", artifacts));
const instance = await WebAssembly.instantiate(wasmBytes, {});
const exports = instance.instance.exports as unknown as {
  memory: WebAssembly.Memory;
  heap_ptr(): number;
  output_ptr(): number;
  validate_gltf(off: number, len: number): number;
  run(
    a: number,
    b: number,
    c: number,
    d: number,
    e: number,
    f: number,
    g: number,
    h: number,
  ): number;
};
const base = exports.heap_ptr();
const memory = new Uint8Array(exports.memory.buffer);
let cursor = 0;
const copy = (value: ArrayBufferView | Uint8Array) => {
  cursor = (cursor + 7) & ~7;
  const offset = cursor;
  memory.set(new Uint8Array(value.buffer, value.byteOffset, value.byteLength), base + offset);
  cursor += value.byteLength;
  return offset;
};
const posOff = copy(jsMesh.positions),
  normOff = copy(jsMesh.normals),
  uvOff = copy(jsMesh.texcoords),
  idxOff = copy(jsMesh.indices);
const texOff = copy(texture), animOff = copy(animation);
const jsonBytes = new TextEncoder().encode(gltfText), jsonOff = copy(jsonBytes);
if (exports.validate_gltf(jsonOff, jsonBytes.length) !== 0) {
  throw new Error("Wasm glTF parser rejected fixture");
}
if (
  exports.run(
    posOff,
    normOff,
    uvOff,
    idxOff,
    texOff,
    animOff,
    jsMesh.vertexCount,
    jsMesh.indices.length,
  ) !== 0
) {
  throw new Error("Wasm viewer failed");
}
const wasmOutput = memory.slice(exports.output_ptr(), exports.output_ptr() + OUTPUT_BYTES);
const jsSemantic = normalizeControlledOutput(jsOutput);
const wasmSemantic = normalizeControlledOutput(wasmOutput);
if (await sha256Hex(jsSemantic) !== await sha256Hex(wasmSemantic)) {
  const first = jsSemantic.findIndex((value, index) => value !== wasmSemantic[index]);
  throw new Error(
    `complete JS/Wasm semantic output mismatch at ${first}: ${jsSemantic[first]} != ${
      wasmSemantic[first]
    }`,
  );
}
await Deno.writeFile(new URL("reference-output.bin", artifacts), jsSemantic);

const immutableCatalog = await fileRef("catalog/workloads.v1.json");
if (
  immutableCatalog.sha256 !== "6665664f984683e5b7d3fdc8c1602198124844704c224a526d48be2f02edf9d4"
) {
  throw new Error("frozen catalog changed");
}
const inputPaths = [
  "fixtures/base/graphics-gltf-viewer/Avocado.gltf",
  "fixtures/base/graphics-gltf-viewer/Avocado.bin",
  "fixtures/base/graphics-gltf-viewer/base-color-64.rgba",
  "fixtures/base/graphics-gltf-viewer/AVOCADO-LICENSE.md",
];
const artifactPaths = [
  "public/artifacts/base-gltf-viewer/draco_decoder_gltf.js",
  "public/artifacts/base-gltf-viewer/draco_wasm_wrapper_gltf.js",
  "public/artifacts/base-gltf-viewer/draco_decoder_gltf.wasm",
  "public/artifacts/base-gltf-viewer/DRACO-LICENSE.txt",
  "public/artifacts/base-gltf-viewer/viewer.wasm",
  "public/artifacts/base-gltf-viewer/decoded-mesh.bin",
  "public/artifacts/base-gltf-viewer/animation-table.i32",
  "public/artifacts/base-gltf-viewer/reference-output.bin",
  "public/artifacts/base-gltf-viewer/fixture-manifest.json",
  "public/artifacts/base-gltf-viewer/implementation-contract.v1.json",
  "public/artifacts/base-gltf-viewer/output-manifest.json",
];
const sourcePaths = [
  "benchmarks/base/graphics-gltf-viewer/engine.js",
  "benchmarks/base/graphics-gltf-viewer/viewer.c",
  "scripts/decode-gltf-draco.cjs",
  "scripts/build-base-gltf-viewer.ts",
  "public/benchmarks/base-gltf-viewer/worker.js",
  "public/benchmarks/base-gltf-viewer/demo.js",
  "public/benchmarks/base-gltf-viewer/index.html",
  "public/benchmarks/base-gltf-viewer/style.css",
  "server.ts",
  "deno.json",
  "deno.lock",
];
const fixtureManifest = {
  schemaVersion: 1,
  workloadId: CONTRACT.workloadId,
  immutable: true,
  sourceModel: {
    name: "Avocado",
    repository: "KhronosGroup/glTF-Sample-Assets",
    revision: "main pinned by individual byte hashes",
    license: "CC0-1.0",
    rightsAudit:
      "Model README and LICENSE identify all model-associated binary, image and text files as CC0-1.0.",
  },
  draco: {
    version: "1.5.7",
    license: "Apache-2.0",
    javascriptTarget: "Emscripten asm.js decoder",
    wasmTarget: "Emscripten linear-Wasm decoder",
    upstream: {
      javascriptSha256: "ea66fdedab5c974050c67aaa86d795cecf9c70aa53b0ddb318b1979f1e1c5be1",
      wasmWrapperSha256: "8bb2952d2ba7d67e1414f8df819410cb0434a666be53f671fff75f68843d76f6",
      wasmPayloadSha256: "712db3449ae2041d6e8a224c395bda6cedb49e51322fae38b7db9beb8b381889",
      localJavaScriptFilesAddOnlyDenoLintDirective: true,
    },
  },
  textureDerivation: {
    sourceSha256: "385dce948c3b9e8bc93e1c930d796e72b02cbd474b121a160d577de95ebbb48f",
    command: "ImageMagick 7.1.2-27: -filter Lanczos -resize 64x64! RGBA:",
    policy:
      "base-color texture; metallic/roughness and tangent-space normal maps excluded from the fixed CPU reference and retained as GPU product-baseline material inputs",
  },
  files: await Promise.all(inputPaths.map(fileRef)),
};
const implementationContract = {
  schemaVersion: 1,
  workloadId: CONTRACT.workloadId,
  status: "implemented-controlled-validation-package",
  frozenCatalog: { ...immutableCatalog, immutability: "byte-for-byte" },
  fixedWork: {
    model: "Avocado glTF-Draco",
    frames: 600,
    viewport: [96, 96],
    checkpoints: CONTRACT.checkpoints,
    pickFrames: CONTRACT.pickFrames,
  },
  algorithm:
    "Draco 1.5.7 decode; quantized fixed-point node animation, transforms, culling, picking and six-frame CPU texture raster reference",
  scenePolicy: {
    gltfVersion: "2.0",
    primitiveMode: "TRIANGLES",
    nodeTransform:
      "fixed source quaternion [0,1,0,0] followed by the 600-entry integer yaw/bounce table",
    skinning: "not-applicable: the audited Avocado model declares no skins or joints",
    camera: "fixed perspective projection into a 96x96 viewport",
    culling: "single-sided screen-space counter-clockwise triangle rejection",
    picking: "12 fixed frame and screen-coordinate triangle tests with nearest average depth",
  },
  materialPolicy: {
    baseColorTexture: "64x64 Lanczos RGBA derivative",
    lighting: "fixed normal-Y Lambert",
    alpha: "OPAQUE",
    doubleSided: false,
    normalMap: "GPU product baseline only",
    metallicRoughness: "GPU product baseline only",
  },
  rendering: {
    controlled:
      "CPU 96x96 raster reference at six checkpoints plus complete 600-frame draw/state stream",
    gpu: "separate unavailable product baseline; never enters controlled output",
  },
  counters: [
    "decoded-vertices",
    "decoded-indices",
    "frames",
    "triangles-tested",
    "visible-triangles",
    "draws",
    "pick-tests",
    "pick-hits",
    "rasterized-pixels",
    "allocations",
    "boundary-crossings",
  ],
};
const outputManifest = {
  schemaVersion: 1,
  workloadId: CONTRACT.workloadId,
  status: "passed",
  sourceCommit,
  input: { decodedMeshSha256: await sha256Hex(jsMeshBytes), asmJsWasmDecodedMeshEqual: true },
  output: {
    bytes: jsOutput.length,
    semanticSha256: await sha256Hex(jsSemantic),
    completeCrossTargetEqual: true,
    variants: {
      javascript: { sha256: await sha256Hex(jsOutput), boundaryCrossings: 0 },
      wasm: { sha256: await sha256Hex(wasmOutput), boundaryCrossings: 1 },
    },
    header: Array.from(new Uint32Array(jsOutput.buffer, 0, 20)),
  },
  performanceClaims: [],
};
for (
  const [name, value] of [["fixture-manifest.json", fixtureManifest], [
    "implementation-contract.v1.json",
    implementationContract,
  ], ["output-manifest.json", outputManifest]] as const
) {
  await Deno.writeTextFile(new URL(name, artifacts), `${JSON.stringify(value, null, 2)}\n`);
}
const buildManifest = {
  schemaVersion: 1,
  workloadId: CONTRACT.workloadId,
  sourceCommit,
  toolchain: {
    deno: Deno.version.deno,
    clang: "22.1.8",
    lld: "22.1.8",
    draco: "1.5.7",
    imageMagick: "7.1.2-27",
  },
  commands: [
    "node scripts/decode-gltf-draco.cjs javascript|wasm ...",
    "clang --target=wasm32-unknown-unknown -O3 -nostdlib -ffreestanding -fno-builtin -fno-vectorize -fno-slp-vectorize",
    "wasm-ld --no-entry --export-memory ... --initial-memory=33554432 --max-memory=33554432",
  ],
  sources: await Promise.all(sourcePaths.map(sourceRef)),
  artifacts: await Promise.all(artifactPaths.map(fileRef)),
};
await Deno.writeTextFile(
  new URL("build-manifest.json", artifacts),
  `${JSON.stringify(buildManifest, null, 2)}\n`,
);
const evidence = {
  schemaVersion: 1,
  workloadId: CONTRACT.workloadId,
  status: "static-validation-passed-browser-pending",
  sourceCommit,
  assertions: {
    catalogImmutable: true,
    rightsAudited: true,
    dracoTargetsIndependentPayloads: true,
    gltfParsedByBothTargets: true,
    all600Frames: true,
    all2046Indices: true,
    all406Vertices: true,
    pickTraceComplete: true,
    cpuRasterCheckpoints: 6,
    completeOutputEqual: true,
    routeLifecycle: "covered by static tests; parent-owned retained Chrome evidence pending",
  },
  semanticOutputSha256: await sha256Hex(jsSemantic),
  browserEvidence: "unavailable-pending-authoritative-controller",
  performanceClaims: [],
};
await Deno.writeTextFile(
  new URL("static-validation.json", evidenceDir),
  `${JSON.stringify(evidence, null, 2)}\n`,
);
console.log(
  `base glTF: ${contract.vertexCount} vertices, 682 triangles, 600 frames, ${jsOutput.length} output bytes, ${await sha256Hex(
    jsSemantic,
  )}`,
);
