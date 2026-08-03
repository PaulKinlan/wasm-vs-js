import wabtFactory from "wabt";
import { brotliCompressSync, constants, gzipSync } from "node:zlib";
import { canonicalize, sha256Hex } from "../lib/canonical.ts";
import { generateInput } from "../benchmarks/sum-u32/input.ts";
import { assertOracle, runJavaScript } from "../lib/workload.ts";

const root = new URL("../", import.meta.url);
const sourcePaths = [
  "benchmarks/sum-u32/sum-u32.wat",
  "benchmarks/sum-u32/workload.js",
  "benchmarks/sum-u32/input.ts",
  "benchmarks/sum-u32/js.ts",
  "lib/workload.ts",
  "scripts/build.ts",
  "deno.json",
];
const outputDir = new URL("public/artifacts/sum-u32/", root);
await Deno.mkdir(outputDir, { recursive: true });

const wat = await Deno.readTextFile(new URL("benchmarks/sum-u32/sum-u32.wat", root));
const wabt = await wabtFactory();
const module = wabt.parseWat("sum-u32.wat", wat, {
  exceptions: false,
  threads: false,
  simd: false,
});
module.resolveNames();
module.validate();
const binary = module.toBinary({
  canonicalize_lebs: true,
  relocatable: false,
  write_debug_names: false,
});
module.destroy();
const wasm = new Uint8Array(binary.buffer);

const input = generateInput();
const inputSha256 = await sha256Hex(new Uint8Array(input.buffer));
const oracle = runJavaScript(input);
assertOracle(oracle);
const oracleBytes = new Uint8Array(4);
new DataView(oracleBytes.buffer).setUint32(0, oracle, true);

const gzip = gzipSync(wasm, { level: 9 });
const brotli = brotliCompressSync(wasm, {
  params: {
    [constants.BROTLI_PARAM_QUALITY]: 11,
    [constants.BROTLI_PARAM_MODE]: constants.BROTLI_MODE_GENERIC,
  },
});

const jsArtifact = await Deno.readFile(new URL("benchmarks/sum-u32/workload.js", root));
const jsGzip = gzipSync(jsArtifact, { level: 9 });
const jsBrotli = brotliCompressSync(jsArtifact, {
  params: {
    [constants.BROTLI_PARAM_QUALITY]: 11,
    [constants.BROTLI_PARAM_MODE]: constants.BROTLI_MODE_TEXT,
  },
});
const lockfile = await Deno.readFile(new URL("deno.lock", root));

const sources = [];
for (const path of sourcePaths) {
  const bytes = await Deno.readFile(new URL(path, root));
  sources.push({ path, bytes: bytes.byteLength, sha256: await sha256Hex(bytes) });
}
const sourceBundle = sources.map(({ path, sha256 }) => `${path}\0${sha256}\n`).join("");
const manifest = {
  schemaVersion: 1,
  benchmarkId: "sum-u32",
  benchmarkVersion: 1,
  track: "controlled",
  sourceRepository: "https://github.com/PaulKinlan/wasm-vs-js",
  sourceCommit: "supplied by the runner from the exact checked-out commit",
  sourceSha256: await sha256Hex(sourceBundle),
  input: {
    generation: "xorshift32 seed 0x6d2b79f5, 65,536 Uint32 values, little-endian bytes",
    bytes: input.byteLength,
    sha256: inputSha256,
  },
  oracle: { kind: "exact-u32", value: oracle, outputSha256: await sha256Hex(oracleBytes) },
  variants: {
    "js-controlled": {
      source: "benchmarks/sum-u32/workload.js",
      sha256: await sha256Hex(jsArtifact),
      algorithm: "one scalar O(n) loop with modulo-2^32 addition",
      footprint: {
        sourceBytes: jsArtifact.byteLength,
        glueBytes: 0,
        rawBytes: jsArtifact.byteLength,
        gzipBytes: jsGzip.byteLength,
        brotliBytes: jsBrotli.byteLength,
        requestCount: 1,
      },
    },
    "wasm-linear-controlled": {
      source: "benchmarks/sum-u32/sum-u32.wat",
      artifact: "public/artifacts/sum-u32/sum-u32.wasm",
      sha256: await sha256Hex(wasm),
      algorithm: "one scalar O(n) loop with i32.load and i32.add",
      features: { simd: false, threads: false, memory64: false, exceptions: false },
      footprint: {
        sourceBytes: wat.length,
        glueBytes: 0,
        rawBytes: wasm.byteLength,
        gzipBytes: gzip.byteLength,
        brotliBytes: brotli.byteLength,
        requestCount: 1,
      },
    },
  },
  build: {
    command: "deno task build",
    toolchains: [`Deno ${Deno.version.deno}`, "wabt 1.0.37", "node:zlib via Deno"],
    flags: [
      "wabt canonicalize_lebs=true",
      "write_debug_names=false",
      "gzip level=9 (Node zlib deterministic header)",
      "brotli quality=11",
    ],
  },
  lockfiles: [{ name: "deno.lock", sha256: await sha256Hex(lockfile) }],
  sources,
};

await Deno.writeFile(new URL("sum-u32.wasm", outputDir), wasm);
await Deno.writeTextFile(
  new URL("build-manifest.json", outputDir),
  `${canonicalize(manifest)}\n`,
);
console.log(
  `build: sum-u32.wasm ${wasm.byteLength} bytes; gzip ${gzip.byteLength}; brotli ${brotli.byteLength}`,
);
