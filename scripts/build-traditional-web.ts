import wabtFactory from "wabt";
import { brotliCompressSync, constants, gzipSync } from "node:zlib";
import { canonicalize, sha256Hex } from "../lib/canonical.ts";
import { generateVDOMFixture } from "../benchmarks/vdom-diff-patch/input.ts";
import { runVdomJS, runVdomWasm } from "../benchmarks/vdom-diff-patch/workload.js";
import { generateRegexFixture } from "../benchmarks/regex-automata-duel/input.ts";
import {
  scanJSAutomata,
  scanNativeRegExp,
  scanWasmAutomata,
} from "../benchmarks/regex-automata-duel/workload.js";

const root = new URL("../", import.meta.url);
const wabt = await wabtFactory();

async function provenanceCommit(): Promise<string> {
  try {
    const value = (await Deno.readTextFile(
      new URL("artifacts/v2/traditional-web/source-commit.txt", root),
    )).trim();
    if (!/^[0-9a-f]{40}$/.test(value)) throw new Error("invalid traditional-web source commit");
    return value;
  } catch (error) {
    if (error instanceof Deno.errors.NotFound) return "uncommitted-source-tree";
    throw error;
  }
}

async function sourceInventory(paths: string[]) {
  const sources = [];
  for (const path of paths) {
    const bytes = await Deno.readFile(new URL(path, root));
    sources.push({ path, bytes: bytes.byteLength, sha256: await sha256Hex(bytes) });
  }
  return sources;
}

async function sourceBundleSha256(sources: Array<{ path: string; sha256: string }>) {
  return await sha256Hex(sources.map(({ path, sha256 }) => `${path}\0${sha256}\n`).join(""));
}

async function graphFootprint(paths: string[], extra: Uint8Array[] = []) {
  const resources: Uint8Array[] = await Promise.all(
    paths.map((path) => Deno.readFile(new URL(path, root))),
  );
  resources.push(...extra);
  return {
    rawBytes: resources.reduce((sum, bytes) => sum + bytes.byteLength, 0),
    gzipBytes: resources.reduce((sum, bytes) => sum + gzipSync(bytes, { level: 9 }).byteLength, 0),
    brotliBytes: resources.reduce((sum, bytes) =>
      sum + brotliCompressSync(bytes, {
        params: {
          [constants.BROTLI_PARAM_QUALITY]: 11,
          [constants.BROTLI_PARAM_MODE]: constants.BROTLI_MODE_GENERIC,
        },
      }).byteLength, 0),
    requestCount: resources.length,
  };
}

function concatBytes(...parts: Uint8Array[]): Uint8Array {
  const output = new Uint8Array(parts.reduce((sum, part) => sum + part.byteLength, 0));
  let offset = 0;
  for (const part of parts) {
    output.set(part, offset);
    offset += part.byteLength;
  }
  return output;
}

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

// Build reduced vdom-diff-patch harness

{
  const vdomSources = [
    "benchmarks/vdom-diff-patch/vdom-diff-patch.wat",
    "benchmarks/vdom-diff-patch/workload.js",
    "benchmarks/vdom-diff-patch/input.ts",
    "benchmarks/vdom-diff-patch/js.ts",
    "lib/canonical.ts",
    "scripts/build-traditional-web.ts",
    "deno.json",
  ];
  const outputDir = new URL("public/artifacts/vdom-diff-patch/", root);
  await Deno.mkdir(outputDir, { recursive: true });

  const { wat, wasm } = await compileWat("benchmarks/vdom-diff-patch/vdom-diff-patch.wat");
  const fixture = generateVDOMFixture();
  const inputBytes = concatBytes(fixture.flatA, fixture.flatB);
  const inputSha256 = await sha256Hex(inputBytes);
  const wasmInstance = await WebAssembly.instantiate(await WebAssembly.compile(wasm), {});
  const jsResult = await runVdomJS(fixture);
  const wasmResult = await runVdomWasm(fixture, wasmInstance);
  if (
    jsResult.patchDigestSha256 !== wasmResult.patchDigestSha256 ||
    jsResult.canonicalHtmlHash !== wasmResult.canonicalHtmlHash ||
    jsResult.canonicalHtmlHash !== jsResult.targetHtmlHash
  ) throw new Error("VDOM build oracle mismatch");
  const outputSha256 = await sha256Hex(canonicalize({
    patchDigestSha256: jsResult.patchDigestSha256,
    canonicalHtmlHash: jsResult.canonicalHtmlHash,
  }));

  const jsArtifact = await Deno.readFile(new URL("benchmarks/vdom-diff-patch/workload.js", root));
  const lockfile = await Deno.readFile(new URL("deno.lock", root));

  const watSha256 = await sha256Hex(new TextEncoder().encode(wat));
  const wasmSha256 = await sha256Hex(wasm);
  const jsSha256 = await sha256Hex(jsArtifact);
  const lockfileSha256 = await sha256Hex(lockfile);

  const sources = await sourceInventory(vdomSources);
  const runtimeGraph = [
    "benchmarks/vdom-diff-patch/workload.js",
    "benchmarks/vdom-diff-patch/input.ts",
    "benchmarks/vdom-diff-patch/js.ts",
    "lib/canonical.ts",
  ];
  const jsFootprint = await graphFootprint(runtimeGraph);
  const wasmFootprint = await graphFootprint(runtimeGraph, [wasm]);

  const manifest = {
    schemaVersion: 1,
    benchmarkId: "vdom-diff-patch",
    benchmarkVersion: 1,
    track: "controlled",
    sourceRepository: "https://github.com/PaulKinlan/wasm-vs-js",
    sourceCommit: await provenanceCommit(),
    sourceSha256: await sourceBundleSha256(sources),
    input: {
      generation: "SplitMix64 seed 0xVDOM2026, 1,000 nodes depth <= 8, 250 edit operations",
      bytes: inputBytes.byteLength,
      sha256: inputSha256,
    },
    oracle: {
      kind: "canonical-digest-and-invariants",
      outputSha256,
      patchDigestSha256: jsResult.patchDigestSha256,
      canonicalHtmlSha256: jsResult.canonicalHtmlHash,
      invariants: {
        expectedPatchCount: fixture.expectedPatchCount,
        nodesVisited: jsResult.nodesVisited,
        domMutations: jsResult.domMutations,
      },
    },
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
        command:
          "deno run --allow-read=. --allow-write=public/artifacts scripts/build-traditional-web.ts",
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
        footprint: { sourceBytes: jsFootprint.rawBytes, glueBytes: 0, ...jsFootprint },
      },
      "wasm-linear-controlled": {
        source: "benchmarks/vdom-diff-patch/vdom-diff-patch.wat",
        artifact: "public/artifacts/vdom-diff-patch/vdom-diff-patch.wasm",
        sha256: await sha256Hex(wasm),
        algorithm: "Linear WebAssembly flat array VDOM diff",
        features: { simd: false, threads: false, memory64: false, exceptions: false },
        footprint: { sourceBytes: wat.length, glueBytes: jsFootprint.rawBytes, ...wasmFootprint },
      },
      "hybrid-controlled": {
        source: "benchmarks/vdom-diff-patch/workload.js",
        artifact: "public/artifacts/vdom-diff-patch/vdom-diff-patch.wasm",
        sha256: await sha256Hex(wasm),
        algorithm: "Wasm flat diff compute with JS in-memory host-adapter patch application",
        features: { simd: false, threads: false, memory64: false, exceptions: false },
        footprint: {
          sourceBytes: jsFootprint.rawBytes,
          glueBytes: jsFootprint.rawBytes,
          ...wasmFootprint,
        },
      },
    },
    build: {
      command:
        "deno run --allow-read=. --allow-write=public/artifacts scripts/build-traditional-web.ts",
      toolchains: [`Deno ${Deno.version.deno}`, "wabt 1.0.37"],
      flags: ["wabt canonicalize_lebs=true"],
    },
    lockfiles: [{ name: "deno.lock", sha256: await sha256Hex(lockfile) }],
    sources,
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
  const regexSources = [
    "benchmarks/regex-automata-duel/regex-automata.wat",
    "benchmarks/regex-automata-duel/workload.js",
    "benchmarks/regex-automata-duel/input.ts",
    "benchmarks/regex-automata-duel/js-native.ts",
    "benchmarks/regex-automata-duel/js-automata.ts",
    "lib/canonical.ts",
    "scripts/build-traditional-web.ts",
    "deno.json",
  ];
  const outputDir = new URL("public/artifacts/regex-automata-duel/", root);
  await Deno.mkdir(outputDir, { recursive: true });

  const { wat, wasm } = await compileWat("benchmarks/regex-automata-duel/regex-automata.wat");
  const fixture = generateRegexFixture();
  const patternBytes = new TextEncoder().encode(canonicalize(fixture.patterns));
  const inputBytes = concatBytes(fixture.textBuffer, patternBytes);
  const inputSha256 = await sha256Hex(inputBytes);
  const wasmInstance = await WebAssembly.instantiate(await WebAssembly.compile(wasm), {});
  const nativeResult = await scanNativeRegExp(fixture);
  const jsResult = await scanJSAutomata(fixture);
  const wasmResult = await scanWasmAutomata(fixture, wasmInstance);
  if (
    nativeResult.oracleHash !== jsResult.oracleHash ||
    nativeResult.oracleHash !== wasmResult.oracleHash ||
    nativeResult.matchesFound !== wasmResult.matchesFound
  ) throw new Error("regex build oracle mismatch");
  const outputSha256 = nativeResult.oracleHash;

  const jsArtifact = await Deno.readFile(
    new URL("benchmarks/regex-automata-duel/workload.js", root),
  );
  const lockfile = await Deno.readFile(new URL("deno.lock", root));

  const watSha256 = await sha256Hex(new TextEncoder().encode(wat));
  const wasmSha256 = await sha256Hex(wasm);
  const jsSha256 = await sha256Hex(jsArtifact);
  const lockfileSha256 = await sha256Hex(lockfile);

  const sources = await sourceInventory(regexSources);
  const runtimeGraph = [
    "benchmarks/regex-automata-duel/workload.js",
    "benchmarks/regex-automata-duel/input.ts",
    "benchmarks/regex-automata-duel/js-native.ts",
    "benchmarks/regex-automata-duel/js-automata.ts",
    "lib/canonical.ts",
  ];
  const jsFootprint = await graphFootprint(runtimeGraph);
  const wasmFootprint = await graphFootprint(runtimeGraph, [wasm]);

  const manifest = {
    schemaVersion: 1,
    benchmarkId: "regex-automata-duel",
    benchmarkVersion: 1,
    track: "controlled",
    sourceRepository: "https://github.com/PaulKinlan/wasm-vs-js",
    sourceCommit: await provenanceCommit(),
    sourceSha256: await sourceBundleSha256(sources),
    input: {
      generation:
        "SplitMix64 seed 0xREGEX2026, 1,048,576 BMP code points, 20 frozen safe regex patterns",
      bytes: inputBytes.byteLength,
      sha256: inputSha256,
    },
    oracle: {
      kind: "canonical-digest-and-invariants",
      outputSha256,
      invariants: {
        codePointsSearched: nativeResult.codePointsSearched,
        patternsExecuted: nativeResult.patternsExecuted,
        matchesFound: nativeResult.matchesFound,
        capturesExtracted: nativeResult.capturesExtracted,
      },
    },
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
        command:
          "deno run --allow-read=. --allow-write=public/artifacts scripts/build-traditional-web.ts",
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
        footprint: { sourceBytes: jsFootprint.rawBytes, glueBytes: 0, ...jsFootprint },
      },
      "js-automata-controlled": {
        source: "benchmarks/regex-automata-duel/workload.js",
        sha256: await sha256Hex(jsArtifact),
        algorithm: "JS Thompson NFA automata search engine",
        footprint: { sourceBytes: jsFootprint.rawBytes, glueBytes: 0, ...jsFootprint },
      },
      "wasm-automata-controlled": {
        source: "benchmarks/regex-automata-duel/regex-automata.wat",
        artifact: "public/artifacts/regex-automata-duel/regex-automata-duel.wasm",
        sha256: await sha256Hex(wasm),
        algorithm: "Wasm DFA execution from project Thompson-NFA subset construction",
        features: { simd: false, threads: false, memory64: false, exceptions: false },
        footprint: { sourceBytes: wat.length, glueBytes: jsFootprint.rawBytes, ...wasmFootprint },
      },
    },
    build: {
      command:
        "deno run --allow-read=. --allow-write=public/artifacts scripts/build-traditional-web.ts",
      toolchains: [`Deno ${Deno.version.deno}`, "wabt 1.0.37"],
      flags: ["wabt canonicalize_lebs=true"],
    },
    lockfiles: [{ name: "deno.lock", sha256: await sha256Hex(lockfile) }],
    sources,
  };

  await Deno.writeFile(new URL("regex-automata-duel.wasm", outputDir), wasm);
  await Deno.writeTextFile(
    new URL("build-manifest.json", outputDir),
    `${canonicalize(manifest)}\n`,
  );
  console.log(`build: regex-automata-duel.wasm ${wasm.byteLength} bytes`);
}
