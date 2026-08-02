import wabtFactory from "wabt";
import { brotliCompressSync, constants, gzipSync } from "node:zlib";
import { canonicalize, sha256Hex } from "../lib/canonical.ts";
import {
  fixtureRecord,
  FLOOD_FIXTURE,
  generateFloodFixture,
  generatePipelineFixture,
  PIPELINE_FIXTURE,
} from "../benchmarks/image-editing/fixtures.ts";
import {
  floodFillJavaScript,
  lumaGaussianPipelineJavaScript,
} from "../benchmarks/image-editing/js.ts";

const root = new URL("../", import.meta.url);
const benchmarkRoot = new URL("benchmarks/image-editing/", root);
const fixtureDir = new URL("fixtures/", benchmarkRoot);
const artifactDir = new URL("artifacts/", benchmarkRoot);
await Deno.mkdir(fixtureDir, { recursive: true });
await Deno.mkdir(artifactDir, { recursive: true });

async function formatGeneratedJson(url: URL): Promise<void> {
  const result = await new Deno.Command(Deno.execPath(), {
    args: ["fmt", url.pathname],
    stdout: "piped",
    stderr: "piped",
  }).output();
  if (!result.success) throw new Error(new TextDecoder().decode(result.stderr));
}

const floodBytes = generateFloodFixture();
const pipelineBytes = generatePipelineFixture();
const fixtureSource = await Deno.readFile(new URL("fixtures.ts", benchmarkRoot));
const fixtureManifest = {
  schemaVersion: 1,
  family: "image-editing-proposal-v1",
  status: "proposal-out-of-catalog",
  format: {
    layout: "row-major-top-to-bottom",
    channels: "RGBA",
    storage: "uint8",
    alpha: "straight",
    colorTag: "sRGB-bytes-no-conversion",
    transparentPixelRule: "RGB=0 when A=0",
  },
  rights: {
    source: "generated solely by benchmarks/image-editing/fixtures.ts without third-party media",
    license: "CC0-1.0",
    redistribution: "permitted",
    declaration: "benchmarks/image-editing/fixtures/RIGHTS.md",
  },
  generator: {
    path: "benchmarks/image-editing/fixtures.ts",
    sha256: await sha256Hex(fixtureSource),
    arithmetic: "integer-only xorshift32, gradients, and pixel primitives",
  },
  fixtures: [
    await fixtureRecord(
      FLOOD_FIXTURE,
      "benchmarks/image-editing/fixtures/generated-map-64x48.rgba",
      floodBytes,
      "flood fill with barriers, concavities, a one-pixel opening, and transparent pixels",
    ),
    await fixtureRecord(
      PIPELINE_FIXTURE,
      "benchmarks/image-editing/fixtures/generated-photo-40x30.rgba",
      pipelineBytes,
      "opaque multichannel gradient and deterministic noise for luma plus Gaussian filtering",
    ),
  ],
};
const fixtureManifestUrl = new URL("fixture-manifest.json", fixtureDir);
await Deno.writeFile(new URL("generated-map-64x48.rgba", fixtureDir), floodBytes);
await Deno.writeFile(new URL("generated-photo-40x30.rgba", fixtureDir), pipelineBytes);
await Deno.writeTextFile(fixtureManifestUrl, `${canonicalize(fixtureManifest)}\n`);
await formatGeneratedJson(fixtureManifestUrl);
const fixtureManifestBytes = await Deno.readFile(fixtureManifestUrl);

const watText = await Deno.readTextFile(new URL("image-editing.wat", benchmarkRoot));
const wabt = await wabtFactory();
const parsed = wabt.parseWat("image-editing.wat", watText, {
  exceptions: false,
  threads: false,
  simd: false,
  bulk_memory: false,
  memory64: false,
});
parsed.resolveNames();
parsed.validate();
const binary = parsed.toBinary({
  canonicalize_lebs: true,
  relocatable: false,
  write_debug_names: false,
});
parsed.destroy();
const wasm = new Uint8Array(binary.buffer);
await Deno.writeFile(new URL("image-editing.wasm", artifactDir), wasm);

const floodOracle = floodFillJavaScript(
  floodBytes,
  FLOOD_FIXTURE.width,
  FLOOD_FIXTURE.height,
  10,
  12,
);
const pipelineOracle = lumaGaussianPipelineJavaScript(
  pipelineBytes,
  PIPELINE_FIXTURE.width,
  PIPELINE_FIXTURE.height,
);
const jsPaths = [
  "benchmarks/image-editing/contract.ts",
  "benchmarks/image-editing/fixtures.ts",
  "benchmarks/image-editing/js.ts",
];
const sourcePaths = [
  "benchmarks/image-editing/benchmark.json",
  "benchmarks/image-editing/measurement-contract.json",
  ...jsPaths,
  "benchmarks/image-editing/wasm.ts",
  "benchmarks/image-editing/image-editing.wat",
  "benchmarks/image-editing/fixtures/RIGHTS.md",
  "scripts/build-image-editing.ts",
  "deno.json",
];
const sources = [];
for (const path of sourcePaths) {
  const bytes = await Deno.readFile(new URL(path, root));
  sources.push({ path, bytes: bytes.byteLength, sha256: await sha256Hex(bytes) });
}
const sourceIdentity = sources.map(({ path, sha256 }) => `${path}\0${sha256}\n`).join("");
const jsParts = await Promise.all(jsPaths.map((path) => Deno.readFile(new URL(path, root))));
const jsBundle = new Uint8Array(jsParts.reduce((total, part) => total + part.byteLength, 0));
let jsOffset = 0;
for (const part of jsParts) {
  jsBundle.set(part, jsOffset);
  jsOffset += part.byteLength;
}
const lockfile = await Deno.readFile(new URL("deno.lock", root));
const gzipOptions = { level: 9 } as const;
const brotliGeneric = {
  params: {
    [constants.BROTLI_PARAM_QUALITY]: 11,
    [constants.BROTLI_PARAM_MODE]: constants.BROTLI_MODE_GENERIC,
  },
};
const brotliText = {
  params: {
    [constants.BROTLI_PARAM_QUALITY]: 11,
    [constants.BROTLI_PARAM_MODE]: constants.BROTLI_MODE_TEXT,
  },
};
const manifest = {
  schemaVersion: 1,
  benchmarkId: "image-editing-proposal",
  benchmarkVersion: 1,
  status: "proposal-out-of-catalog",
  authoritativePerformanceEvidence: false,
  track: "controlled",
  sourceRepository: "https://github.com/PaulKinlan/wasm-vs-js",
  sourceCommit: "supplied by a future runner from the exact checked-out commit",
  sourceSha256: await sha256Hex(sourceIdentity),
  fixtures: {
    manifest: "benchmarks/image-editing/fixtures/fixture-manifest.json",
    manifestSha256: await sha256Hex(fixtureManifestBytes),
    entries: fixtureManifest.fixtures,
  },
  oracle: {
    floodFill: {
      fixture: FLOOD_FIXTURE.id,
      seed: [10, 12],
      outputSha256: await sha256Hex(floodOracle.output),
      visitedMaskSha256: await sha256Hex(floodOracle.visitedMask),
      changedPixels: floodOracle.counters.changedPixels,
      changedBounds: floodOracle.changedBounds,
      algorithmCounters: floodOracle.counters,
    },
    lumaGaussianPipeline: {
      fixture: PIPELINE_FIXTURE.id,
      outputSha256: await sha256Hex(pipelineOracle.output),
      algorithmCounters: pipelineOracle.counters,
    },
  },
  variants: {
    "js-controlled": {
      sources: jsPaths,
      sha256: await sha256Hex(jsBundle),
      algorithm:
        "immutable-source iterative DFS flood fill and integer luma plus separable [1,2,1] Gaussian passes",
      footprint: {
        sourceBytes: jsBundle.byteLength,
        glueBytes: 0,
        rawBytes: jsBundle.byteLength,
        gzipBytes: gzipSync(jsBundle, gzipOptions).byteLength,
        brotliBytes: brotliCompressSync(jsBundle, brotliText).byteLength,
        requestCount: 3,
      },
    },
    "wasm-linear-controlled": {
      source: "benchmarks/image-editing/image-editing.wat",
      glue: "benchmarks/image-editing/wasm.ts",
      artifact: "benchmarks/image-editing/artifacts/image-editing.wasm",
      sha256: await sha256Hex(wasm),
      algorithm:
        "the controlled algorithms in one scalar module with a fixed one-page linear-memory layout",
      features: {
        simd: false,
        threads: false,
        bulkMemory: false,
        memory64: false,
        exceptions: false,
        memoryGrowth: false,
        initialPages: 1,
        maximumPages: 1,
      },
      footprint: {
        sourceBytes: new TextEncoder().encode(watText).byteLength,
        glueBytes: (await Deno.readFile(new URL("wasm.ts", benchmarkRoot))).byteLength,
        rawBytes: wasm.byteLength,
        gzipBytes: gzipSync(wasm, gzipOptions).byteLength,
        brotliBytes: brotliCompressSync(wasm, brotliGeneric).byteLength,
        requestCount: 2,
      },
    },
  },
  build: {
    command:
      "deno run --allow-read=. --allow-write=benchmarks/image-editing/artifacts,benchmarks/image-editing/fixtures --allow-run scripts/build-image-editing.ts",
    toolchains: [`Deno ${Deno.version.deno}`, "wabt 1.0.37", "node:zlib via Deno"],
    flags: [
      "wabt exceptions=false threads=false simd=false bulk_memory=false memory64=false",
      "canonicalize_lebs=true relocatable=false write_debug_names=false",
      "fixed WebAssembly memory initial=1 page maximum=1 page",
      "gzip level=9 (Node zlib deterministic header)",
      "brotli quality=11",
      "Deno formatter for generated JSON manifests",
    ],
  },
  lockfiles: [{ name: "deno.lock", sha256: await sha256Hex(lockfile) }],
  sources,
};
const buildManifestUrl = new URL("build-manifest.json", artifactDir);
await Deno.writeTextFile(buildManifestUrl, `${canonicalize(manifest)}\n`);
await formatGeneratedJson(buildManifestUrl);
console.log(
  `build:image-editing ${wasm.byteLength} Wasm bytes; ${
    floodBytes.byteLength + pipelineBytes.byteLength
  } generated RGBA bytes`,
);
