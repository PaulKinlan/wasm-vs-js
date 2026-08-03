import { canonicalize, sha256Hex } from "../../lib/canonical.ts";
import { compileC } from "../../benchmarks/base/tooling-c-to-wasm-compile/compiler-js.js";

const root = new URL("../../", import.meta.url);
const bench = new URL("benchmarks/base/tooling-c-to-wasm-compile/", root);
const artifacts = new URL("public/artifacts/base/tooling-c-to-wasm-compile/", root);
const evidence = new URL("public/evidence/base/tooling-c-to-wasm-compile/", root);
const sourceCommit = Deno.env.get("SOURCE_COMMIT") ?? "";
if (!/^[a-f0-9]{40}$/.test(sourceCommit)) {
  throw new Error("SOURCE_COMMIT must be the exact 40-hex source commit");
}

const expected = [4, 21, 32, 15, 20, 8, 37, 6, 41, 176, 10200, 83, 55, 15, 37, 29, 21, 366, 5, 270];
const sourcePaths = [
  "benchmarks/base/tooling-c-to-wasm-compile/compiler-js.js",
  "benchmarks/base/tooling-c-to-wasm-compile/compiler-wasm.c",
  "benchmarks/base/tooling-c-to-wasm-compile/contract.v1.json",
  "benchmarks/base/tooling-c-to-wasm-compile/fixtures/RIGHTS.md",
  "scripts/base/build-tooling-c-to-wasm-compile.ts",
  "schemas/base/tooling-c-to-wasm-compile.schema.json",
  "public/benchmarks/tooling-c-to-wasm-compile-v1/index.html",
  "public/benchmarks/tooling-c-to-wasm-compile-v1/demo.js",
  "public/benchmarks/tooling-c-to-wasm-compile-v1/worker.js",
  "tests/base/tooling-c-to-wasm-compile.test.ts",
  "server.ts",
  "deno.json",
  "deno.lock",
];
for (let index = 1; index <= 20; index += 1) {
  const id = String(index).padStart(2, "0");
  sourcePaths.push(
    `benchmarks/base/tooling-c-to-wasm-compile/fixtures/programs/${id}.c`,
    `benchmarks/base/tooling-c-to-wasm-compile/fixtures/headers/${id}.h`,
  );
}

async function commandVersion(command: string, args: string[]): Promise<string> {
  const output = await new Deno.Command(command, { args, stdout: "piped", stderr: "piped" })
    .output();
  if (!output.success) throw new Error(`${command} version probe failed`);
  return new TextDecoder().decode(output.stdout).trim().split("\n")[0];
}

async function committedBytes(path: string): Promise<Uint8Array> {
  const output = await new Deno.Command("git", {
    args: ["show", `${sourceCommit}:${path}`],
    cwd: root,
    stdout: "piped",
    stderr: "piped",
  }).output();
  if (!output.success) throw new Error(`source commit does not contain ${path}`);
  return output.stdout;
}

await Deno.mkdir(artifacts, { recursive: true });
await Deno.mkdir(evidence, { recursive: true });
const temp = new URL(".build-temp/", artifacts).pathname;
try {
  await Deno.remove(temp, { recursive: true }).catch((error) => {
    if (!(error instanceof Deno.errors.NotFound)) throw error;
  });
  await Deno.mkdir(temp, { recursive: true });
  const compilerArtifact = `${temp}/compiler.wasm`;
  const clangArgs = [
    "--target=wasm32",
    "-O2",
    "-nostdlib",
    new URL("compiler-wasm.c", bench).pathname,
    "-Wl,--no-entry",
    "-Wl,--export=compile_c",
    "-Wl,--export=counter_tokens",
    "-Wl,--export=counter_ast_nodes",
    "-Wl,--export=counter_instructions",
    "-Wl,--export=counter_output_bytes",
    "-Wl,--export-memory",
    "-Wl,--initial-memory=262144",
    "-Wl,--max-memory=262144",
    "-Wl,--strip-all",
    "-o",
    compilerArtifact,
  ];
  const built = await new Deno.Command("clang", {
    args: clangArgs,
    stdout: "piped",
    stderr: "piped",
  }).output();
  if (!built.success) throw new Error(`clang failed: ${new TextDecoder().decode(built.stderr)}`);
  const compilerBytes = await Deno.readFile(compilerArtifact);
  const compilerModule = await WebAssembly.compile(compilerBytes);
  const compilerInstance = await WebAssembly.instantiate(compilerModule, {});
  const exports = compilerInstance.exports as Record<string, WebAssembly.ExportValue>;
  const memory = exports.memory as WebAssembly.Memory;
  const compile = exports.compile_c as CallableFunction;
  const counterTokens = exports.counter_tokens as CallableFunction;
  const counterAst = exports.counter_ast_nodes as CallableFunction;
  const counterInstructions = exports.counter_instructions as CallableFunction;
  const counterOutput = exports.counter_output_bytes as CallableFunction;
  if (
    !memory || !compile || !counterTokens || !counterAst || !counterInstructions || !counterOutput
  ) {
    throw new Error("self-hosted compiler export contract missing");
  }

  const encoder = new TextEncoder();
  const fixtureEntries = [];
  const results = [];
  const outputHashes: string[] = [];
  let totalSourceBytes = 0;
  let totalHeaderBytes = 0;
  let totalTokens = 0;
  let totalAstNodes = 0;
  let totalInstructions = 0;
  let totalOutputBytes = 0;
  for (let index = 1; index <= 20; index += 1) {
    const id = String(index).padStart(2, "0");
    const sourcePath = `benchmarks/base/tooling-c-to-wasm-compile/fixtures/programs/${id}.c`;
    const headerPath = `benchmarks/base/tooling-c-to-wasm-compile/fixtures/headers/${id}.h`;
    const sourceBytes = await Deno.readFile(new URL(sourcePath, root));
    const headerBytes = await Deno.readFile(new URL(headerPath, root));
    const source = new TextDecoder("utf-8", { fatal: true }).decode(sourceBytes);
    const header = new TextDecoder("utf-8", { fatal: true }).decode(headerBytes);
    const js = compileC(source, header);

    const sourceOffset = 196608;
    const headerOffset = 200704;
    const outputOffset = 131072;
    const view = new Uint8Array(memory.buffer);
    view.fill(0, sourceOffset, outputOffset + 4096);
    view.set(sourceBytes, sourceOffset);
    view.set(headerBytes, headerOffset);
    const outputLength = Number(
      compile(
        sourceOffset,
        sourceBytes.byteLength,
        headerOffset,
        headerBytes.byteLength,
        outputOffset,
        4096,
      ),
    );
    if (outputLength <= 0) throw new Error(`self-hosted compiler rejected ${id}: ${outputLength}`);
    const wasm = view.slice(outputOffset, outputOffset + outputLength);
    if (wasm.byteLength !== Number(counterOutput())) {
      throw new Error(`output counter mismatch for ${id}`);
    }
    if (
      wasm.byteLength !== js.bytes.byteLength ||
      wasm.some((value, offset) => value !== js.bytes[offset])
    ) {
      throw new Error(`compiler output byte mismatch for ${id}`);
    }
    const module = await WebAssembly.compile(wasm);
    const instance = await WebAssembly.instantiate(module, {});
    const test = instance.exports.test as CallableFunction;
    if (!test) throw new Error(`linked test export missing for ${id}`);
    const actual = Number(test());
    if (actual !== expected[index - 1]) {
      throw new Error(`oracle mismatch ${id}: ${actual} != ${expected[index - 1]}`);
    }
    const hash = await sha256Hex(wasm);
    outputHashes.push(hash);
    const wasmCounters = {
      sourceBytes: sourceBytes.byteLength,
      headerBytes: headerBytes.byteLength,
      tokens: Number(counterTokens()),
      astNodes: Number(counterAst()),
      functions: 1,
      instructions: Number(counterInstructions()),
      linkSections: 4,
      vfsReads: 2,
      allocations: 0,
      boundaryCrossings: 2,
      outputBytes: wasm.byteLength,
    };
    for (
      const field of [
        "tokens",
        "astNodes",
        "functions",
        "instructions",
        "linkSections",
        "vfsReads",
        "outputBytes",
      ] as const
    ) {
      if (wasmCounters[field] !== js.counters[field]) {
        throw new Error(
          `counter ${field} mismatch for ${id}: ${wasmCounters[field]} != ${js.counters[field]}`,
        );
      }
    }
    totalSourceBytes += sourceBytes.byteLength;
    totalHeaderBytes += headerBytes.byteLength;
    totalTokens += wasmCounters.tokens;
    totalAstNodes += wasmCounters.astNodes;
    totalInstructions += wasmCounters.instructions;
    totalOutputBytes += wasm.byteLength;
    fixtureEntries.push({
      id,
      source: {
        path: sourcePath,
        bytes: sourceBytes.byteLength,
        sha256: await sha256Hex(sourceBytes),
      },
      header: {
        path: headerPath,
        bytes: headerBytes.byteLength,
        sha256: await sha256Hex(headerBytes),
      },
      expectedTestResult: expected[index - 1],
    });
    results.push({
      id,
      outputSha256: hash,
      outputBytes: wasm.byteLength,
      testResult: actual,
      jsCounters: js.counters,
      wasmCounters,
    });
  }

  const malformed = [
    ['#include "other.h"\nint test(void) { return BASE; }\n', "#define BASE 1\n"],
    ['#include "fixture.h"\nint test(void) { return BASE / 2; }\n', "#define BASE 1\n"],
    ['#include "fixture.h"\nint test(void) { return missing; }\n', "#define BASE 1\n"],
  ];
  for (const [source, header] of malformed) {
    let rejected = false;
    try {
      compileC(source, header);
    } catch {
      rejected = true;
    }
    if (!rejected) throw new Error("JavaScript compiler accepted malformed fixture");
    const sourceBytes = encoder.encode(source);
    const headerBytes = encoder.encode(header);
    const view = new Uint8Array(memory.buffer);
    view.set(sourceBytes, 196608);
    view.set(headerBytes, 200704);
    if (
      Number(
        compile(196608, sourceBytes.byteLength, 200704, headerBytes.byteLength, 131072, 4096),
      ) >= 0
    ) {
      throw new Error("self-hosted compiler accepted malformed fixture");
    }
  }

  const catalogBytes = await Deno.readFile(new URL("catalog/workloads.v1.json", root));
  const catalogPublicBytes = await Deno.readFile(new URL("public/data/workloads.v1.json", root));
  const catalogSha256 = await sha256Hex(catalogBytes);
  if (
    catalogSha256 !== "6665664f984683e5b7d3fdc8c1602198124844704c224a526d48be2f02edf9d4" ||
    await sha256Hex(catalogPublicBytes) !== catalogSha256
  ) {
    throw new Error("frozen catalog identity changed");
  }
  const sources = [];
  for (const path of sourcePaths) {
    const bytes = await Deno.readFile(new URL(path, root));
    const committed = await committedBytes(path);
    const diskHash = await sha256Hex(bytes);
    if (await sha256Hex(committed) !== diskHash) {
      throw new Error(`source path drifted from ${sourceCommit}: ${path}`);
    }
    sources.push({ path, bytes: bytes.byteLength, sha256: diskHash });
  }
  const fixtureManifest = {
    schemaVersion: 1,
    workloadId: "tooling.c-to-wasm-compile.v1",
    sourceCommit,
    rights: {
      licenseSpdx: "CC0-1.0",
      statement: "benchmarks/base/tooling-c-to-wasm-compile/fixtures/RIGHTS.md",
      thirdPartyBytes: false,
    },
    generator: "20 committed translation units and matching fixture.h VFS entries",
    entries: fixtureEntries,
    combinedSha256: await sha256Hex(
      fixtureEntries.map((entry) => `${entry.source.sha256}\0${entry.header.sha256}\n`).join(""),
    ),
  };
  const compilerSha256 = await sha256Hex(compilerBytes);
  const buildManifest = {
    schemaVersion: 1,
    workloadId: "tooling.c-to-wasm-compile.v1",
    sourceCommit,
    catalogSha256,
    artifact: {
      path: "public/artifacts/base/tooling-c-to-wasm-compile/compiler.wasm",
      bytes: compilerBytes.byteLength,
      sha256: compilerSha256,
    },
    variants: {
      javascript: { source: sourcePaths[0], sha256: sources[0].sha256 },
      wasmSelfHosted: {
        source: sourcePaths[1],
        sourceSha256: sources[1].sha256,
        artifactSha256: compilerSha256,
      },
    },
    command:
      "SOURCE_COMMIT=$(cat benchmarks/base/tooling-c-to-wasm-compile/source-commit.txt) deno run --allow-env=SOURCE_COMMIT --allow-read=. --allow-write=public/artifacts/base/tooling-c-to-wasm-compile,public/evidence/base/tooling-c-to-wasm-compile --allow-run=clang,wasm-ld,git scripts/base/build-tooling-c-to-wasm-compile.ts",
    toolchain: {
      deno: Deno.version.deno,
      clang: await commandVersion("clang", ["--version"]),
      lld: await commandVersion("wasm-ld", ["--version"]),
      target: "wasm32-unknown-unknown",
      flags: clangArgs.slice(0, -2),
    },
    sourceGraph: sources,
  };
  const validation = {
    schemaVersion: 1,
    workloadId: "tooling.c-to-wasm-compile.v1",
    status: "static-validation-complete-browser-uncollected",
    sourceCommit,
    coverageCredit: false,
    programs: 20,
    targets: ["javascript-controlled", "wasm-self-hosted-controlled"],
    assertions: {
      allSourcesCompiled: true,
      allOutputsByteIdentical: true,
      allModulesValidated: true,
      allExportsExecuted: true,
      allIndependentOraclesMatched: true,
      allFixedWorkCountersMatched: true,
      malformedInputsRejected: true,
      catalogByteIdentical: true,
      retainedBrowserEvidence: false,
    },
    totals: {
      sourceBytes: totalSourceBytes,
      headerBytes: totalHeaderBytes,
      preprocessPasses: 40,
      parsePasses: 40,
      typecheckPasses: 40,
      codegenPasses: 40,
      linkPasses: 40,
      executedExports: 40,
      tokens: totalTokens * 2,
      astNodes: totalAstNodes * 2,
      instructions: totalInstructions * 2,
      vfsReads: 80,
      allocations: { javascript: 80, wasmSelfHosted: 0 },
      boundaryCrossings: { javascript: 0, wasmSelfHosted: 40 },
      outputBytes: totalOutputBytes * 2,
    },
    outputSetSha256: await sha256Hex(outputHashes.join("\n")),
    results,
    limitations: [
      "No browser launch, timing, cold-load, memory or lifecycle evidence was collected by this build.",
      "Coverage remains unavailable until independent review and retained browser evidence pass.",
    ],
  };
  await Deno.writeFile(new URL("compiler.wasm", artifacts), compilerBytes);
  await Deno.writeTextFile(
    new URL("fixture-manifest.json", artifacts),
    `${canonicalize(fixtureManifest)}\n`,
  );
  await Deno.writeTextFile(
    new URL("build-manifest.json", artifacts),
    `${canonicalize(buildManifest)}\n`,
  );
  await Deno.writeTextFile(
    new URL("validation.json", evidence),
    `${JSON.stringify(validation, null, 2)}\n`,
  );
  console.log(
    `tooling.c-to-wasm-compile: ${compilerBytes.byteLength} byte self-hosted compiler; 20/20 sources; output set ${validation.outputSetSha256}`,
  );
} finally {
  await Deno.remove(temp, { recursive: true });
}
