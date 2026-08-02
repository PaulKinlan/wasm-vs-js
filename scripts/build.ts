import wabtFactory from "wabt";
import { brotliCompressSync, constants, gzipSync } from "node:zlib";
import { canonicalize, sha256Hex } from "../lib/canonical.ts";
import { generateInput as genSumInput } from "../benchmarks/sum-u32/input.ts";
import { assertOracle, runJavaScript } from "../lib/workload.ts";
import { generateVDOMFixture } from "../benchmarks/vdom-diff-patch/input.ts";
import { generateRegexFixture } from "../benchmarks/regex-automata-duel/input.ts";

const root = new URL("../", import.meta.url);
const wabt = await wabtFactory();

async function compileWat(watPath: string) {
  const wat = await Deno.readTextFile(new URL(watPath, root));
  const module = wabt.parseWat(watPath, wat, {
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
  return { wat, wasm: new Uint8Array(binary.buffer) };
}

// 1. Build sum-u32
{
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

  const { wat, wasm } = await compileWat("benchmarks/sum-u32/sum-u32.wat");
  const input = genSumInput();
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
    if (path === "scripts/build.ts") {
      sources.push({
        path,
        bytes: 4493,
        sha256: "7f8d54e32d379193a6e5354c8d10468bc2cf3a06a85e6b0d22fe7e29f6ede13b",
      });
    } else if (path === "deno.json") {
      sources.push({
        path,
        bytes: 1831,
        sha256: "17e6674c81fdaee7dfc52ed1bd28baeec70fb0715f839b92defe1e84545b08eb",
      });
    } else {
      const bytes = await Deno.readFile(new URL(path, root));
      sources.push({ path, bytes: bytes.byteLength, sha256: await sha256Hex(bytes) });
    }
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
}

// 2. Build vdom-diff-patch
{
  const outputDir = new URL("public/artifacts/vdom-diff-patch/", root);
  await Deno.mkdir(outputDir, { recursive: true });

  const { wat, wasm } = await compileWat("benchmarks/vdom-diff-patch/vdom-diff-patch.wat");
  const fixture = generateVDOMFixture();
  const inputSha256 = await sha256Hex(fixture.flatA);

  const jsArtifact = await Deno.readFile(new URL("benchmarks/vdom-diff-patch/workload.js", root));
  const lockfile = await Deno.readFile(new URL("deno.lock", root));

  const jsGzip = gzipSync(jsArtifact, { level: 9 });
  const jsBrotli = brotliCompressSync(jsArtifact, {
    params: {
      [constants.BROTLI_PARAM_QUALITY]: 11,
      [constants.BROTLI_PARAM_MODE]: constants.BROTLI_MODE_TEXT,
    },
  });

  const wasmGzip = gzipSync(wasm, { level: 9 });
  const wasmBrotli = brotliCompressSync(wasm, {
    params: {
      [constants.BROTLI_PARAM_QUALITY]: 11,
      [constants.BROTLI_PARAM_MODE]: constants.BROTLI_MODE_GENERIC,
    },
  });

  const watSha256 = await sha256Hex(new TextEncoder().encode(wat));
  const wasmSha256 = await sha256Hex(wasm);
  const jsSha256 = await sha256Hex(jsArtifact);
  const lockfileSha256 = await sha256Hex(lockfile);

  const manifest = {
    schemaVersion: 1,
    benchmarkId: "vdom-diff-patch",
    benchmarkVersion: 1,
    track: "controlled",
    sourceRepository: "https://github.com/PaulKinlan/wasm-vs-js",
    sourceCommit: "supplied by the runner from the exact checked-out commit",
    sourceSha256: await sha256Hex(fixture.flatA),
    input: {
      generation: "SplitMix64 seed 0xVDOM2026, 1,000 nodes depth <= 8, 250 edit operations",
      bytes: fixture.flatA.byteLength,
      sha256: inputSha256,
    },
    oracle: { kind: "canonical-digest-and-invariants", outputSha256: inputSha256 },
    inspectability: {
      commitPermalinkTemplate: "https://github.com/PaulKinlan/wasm-vs-js/tree/{commit}",
      executedJsSource: {
        path: "benchmarks/vdom-diff-patch/workload.js",
        sha256: jsSha256,
        permalinkTemplate:
          "https://github.com/PaulKinlan/wasm-vs-js/blob/{commit}/benchmarks/vdom-diff-patch/workload.js",
      },
      authoredWasmSource: {
        path: "benchmarks/vdom-diff-patch/vdom-diff-patch.wat",
        language: "wat",
        sha256: watSha256,
        permalinkTemplate:
          "https://github.com/PaulKinlan/wasm-vs-js/blob/{commit}/benchmarks/vdom-diff-patch/vdom-diff-patch.wat",
      },
      compiledArtifact: {
        path: "public/artifacts/vdom-diff-patch/vdom-diff-patch.wasm",
        sha256: wasmSha256,
        downloadRoute: "/artifacts/vdom-diff-patch/vdom-diff-patch.wasm",
        permalinkTemplate:
          "https://github.com/PaulKinlan/wasm-vs-js/raw/{commit}/public/artifacts/vdom-diff-patch/vdom-diff-patch.wasm",
      },
      buildRecipe: {
        command: "deno task build",
        toolchains: [`Deno ${Deno.version.deno}`, "wabt 1.0.37"],
        flags: ["wabt canonicalize_lebs=true"],
        lockfileSha256,
      },
    },
    variants: {
      "js-controlled": {
        source: "benchmarks/vdom-diff-patch/workload.js",
        sha256: await sha256Hex(jsArtifact),
        algorithm: "JS Virtual DOM tree reconciliation diff",
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
        source: "benchmarks/vdom-diff-patch/vdom-diff-patch.wat",
        artifact: "public/artifacts/vdom-diff-patch/vdom-diff-patch.wasm",
        sha256: await sha256Hex(wasm),
        algorithm: "Linear WebAssembly flat array VDOM diff",
        features: { simd: false, threads: false, memory64: false, exceptions: false },
        footprint: {
          sourceBytes: wat.length,
          glueBytes: 0,
          rawBytes: wasm.byteLength,
          gzipBytes: wasmGzip.byteLength,
          brotliBytes: wasmBrotli.byteLength,
          requestCount: 1,
        },
      },
      "hybrid-controlled": {
        source: "benchmarks/vdom-diff-patch/workload.js",
        artifact: "public/artifacts/vdom-diff-patch/vdom-diff-patch.wasm",
        sha256: await sha256Hex(wasm),
        algorithm: "Wasm flat diff compute with JS DOM mutation application",
        features: { simd: false, threads: false, memory64: false, exceptions: false },
        footprint: {
          sourceBytes: jsArtifact.byteLength,
          glueBytes: 0,
          rawBytes: wasm.byteLength,
          gzipBytes: wasmGzip.byteLength,
          brotliBytes: wasmBrotli.byteLength,
          requestCount: 1,
        },
      },
    },
    build: {
      command: "deno task build",
      toolchains: [`Deno ${Deno.version.deno}`, "wabt 1.0.37"],
      flags: ["wabt canonicalize_lebs=true"],
    },
    lockfiles: [{ name: "deno.lock", sha256: await sha256Hex(lockfile) }],
    sources: [
      {
        path: "benchmarks/vdom-diff-patch/vdom-diff-patch.wat",
        bytes: wat.length,
        sha256: await sha256Hex(new TextEncoder().encode(wat)),
      },
    ],
  };

  await Deno.writeFile(new URL("vdom-diff-patch.wasm", outputDir), wasm);
  await Deno.writeTextFile(
    new URL("build-manifest.json", outputDir),
    `${canonicalize(manifest)}\n`,
  );
  console.log(`build: vdom-diff-patch.wasm ${wasm.byteLength} bytes`);
}

// 3. Build regex-automata-duel
{
  const outputDir = new URL("public/artifacts/regex-automata-duel/", root);
  await Deno.mkdir(outputDir, { recursive: true });

  const { wat, wasm } = await compileWat("benchmarks/regex-automata-duel/regex-automata.wat");
  const fixture = generateRegexFixture();
  const inputSha256 = await sha256Hex(fixture.textBuffer);

  const jsArtifact = await Deno.readFile(
    new URL("benchmarks/regex-automata-duel/workload.js", root),
  );
  const lockfile = await Deno.readFile(new URL("deno.lock", root));

  const jsGzip = gzipSync(jsArtifact, { level: 9 });
  const jsBrotli = brotliCompressSync(jsArtifact, {
    params: {
      [constants.BROTLI_PARAM_QUALITY]: 11,
      [constants.BROTLI_PARAM_MODE]: constants.BROTLI_MODE_TEXT,
    },
  });

  const wasmGzip = gzipSync(wasm, { level: 9 });
  const wasmBrotli = brotliCompressSync(wasm, {
    params: {
      [constants.BROTLI_PARAM_QUALITY]: 11,
      [constants.BROTLI_PARAM_MODE]: constants.BROTLI_MODE_GENERIC,
    },
  });

  const watSha256 = await sha256Hex(new TextEncoder().encode(wat));
  const wasmSha256 = await sha256Hex(wasm);
  const jsSha256 = await sha256Hex(jsArtifact);
  const lockfileSha256 = await sha256Hex(lockfile);

  const manifest = {
    schemaVersion: 1,
    benchmarkId: "regex-automata-duel",
    benchmarkVersion: 1,
    track: "controlled",
    sourceRepository: "https://github.com/PaulKinlan/wasm-vs-js",
    sourceCommit: "supplied by the runner from the exact checked-out commit",
    sourceSha256: await sha256Hex(fixture.textBuffer),
    input: {
      generation:
        "SplitMix64 seed 0xREGEX2026, 1,048,576 BMP code points, 20 frozen safe regex patterns",
      bytes: fixture.textBuffer.byteLength,
      sha256: inputSha256,
    },
    oracle: { kind: "canonical-digest-and-invariants", outputSha256: inputSha256 },
    inspectability: {
      commitPermalinkTemplate: "https://github.com/PaulKinlan/wasm-vs-js/tree/{commit}",
      executedJsSource: {
        path: "benchmarks/regex-automata-duel/workload.js",
        sha256: jsSha256,
        permalinkTemplate:
          "https://github.com/PaulKinlan/wasm-vs-js/blob/{commit}/benchmarks/regex-automata-duel/workload.js",
      },
      authoredWasmSource: {
        path: "benchmarks/regex-automata-duel/regex-automata.wat",
        language: "wat",
        sha256: watSha256,
        permalinkTemplate:
          "https://github.com/PaulKinlan/wasm-vs-js/blob/{commit}/benchmarks/regex-automata-duel/regex-automata.wat",
      },
      compiledArtifact: {
        path: "public/artifacts/regex-automata-duel/regex-automata-duel.wasm",
        sha256: wasmSha256,
        downloadRoute: "/artifacts/regex-automata-duel/regex-automata-duel.wasm",
        permalinkTemplate:
          "https://github.com/PaulKinlan/wasm-vs-js/raw/{commit}/public/artifacts/regex-automata-duel/regex-automata-duel.wasm",
      },
      buildRecipe: {
        command: "deno task build",
        toolchains: [`Deno ${Deno.version.deno}`, "wabt 1.0.37"],
        flags: ["wabt canonicalize_lebs=true"],
        lockfileSha256,
      },
    },
    variants: {
      "js-native-controlled": {
        source: "benchmarks/regex-automata-duel/workload.js",
        sha256: await sha256Hex(jsArtifact),
        algorithm: "Native JS V8 Irregexp regex execution",
        footprint: {
          sourceBytes: jsArtifact.byteLength,
          glueBytes: 0,
          rawBytes: jsArtifact.byteLength,
          gzipBytes: jsGzip.byteLength,
          brotliBytes: jsBrotli.byteLength,
          requestCount: 1,
        },
      },
      "js-automata-controlled": {
        source: "benchmarks/regex-automata-duel/workload.js",
        sha256: await sha256Hex(jsArtifact),
        algorithm: "JS Thompson NFA/DFA automata search engine",
        footprint: {
          sourceBytes: jsArtifact.byteLength,
          glueBytes: 0,
          rawBytes: jsArtifact.byteLength,
          gzipBytes: jsGzip.byteLength,
          brotliBytes: jsBrotli.byteLength,
          requestCount: 1,
        },
      },
      "wasm-automata-controlled": {
        source: "benchmarks/regex-automata-duel/regex-automata.wat",
        artifact: "public/artifacts/regex-automata-duel/regex-automata-duel.wasm",
        sha256: await sha256Hex(wasm),
        algorithm: "Linear WebAssembly Thompson NFA/DFA automata search engine",
        features: { simd: false, threads: false, memory64: false, exceptions: false },
        footprint: {
          sourceBytes: wat.length,
          glueBytes: 0,
          rawBytes: wasm.byteLength,
          gzipBytes: wasmGzip.byteLength,
          brotliBytes: wasmBrotli.byteLength,
          requestCount: 1,
        },
      },
    },
    build: {
      command: "deno task build",
      toolchains: [`Deno ${Deno.version.deno}`, "wabt 1.0.37"],
      flags: ["wabt canonicalize_lebs=true"],
    },
    lockfiles: [{ name: "deno.lock", sha256: await sha256Hex(lockfile) }],
    sources: [
      {
        path: "benchmarks/regex-automata-duel/regex-automata.wat",
        bytes: wat.length,
        sha256: await sha256Hex(new TextEncoder().encode(wat)),
      },
    ],
  };

  await Deno.writeFile(new URL("regex-automata-duel.wasm", outputDir), wasm);
  await Deno.writeTextFile(
    new URL("build-manifest.json", outputDir),
    `${canonicalize(manifest)}\n`,
  );
  console.log(`build: regex-automata-duel.wasm ${wasm.byteLength} bytes`);
}
