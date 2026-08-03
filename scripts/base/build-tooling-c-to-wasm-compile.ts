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
const contract = JSON.parse(await Deno.readTextFile(new URL("contract.v1.json", bench)));
const negativeFixtures = JSON.parse(
  await Deno.readTextFile(new URL("negative-fixtures.v1.json", bench)),
).cases as Array<{ id: string; source: string; header: string; reason: string }>;
const counterFields = contract.fixedWork.counterContract.fields as string[];
const equalCounterFields = contract.fixedWork.counterContract.equalAcrossTargets as string[];
const sourcePaths = [
  "benchmarks/base/tooling-c-to-wasm-compile/compiler-js.js",
  "benchmarks/base/tooling-c-to-wasm-compile/compiler-wasm.c",
  "benchmarks/base/tooling-c-to-wasm-compile/contract.v1.json",
  "benchmarks/base/tooling-c-to-wasm-compile/negative-fixtures.v1.json",
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
    ...counterFields.map((field) =>
      `-Wl,--export=counter_${field.replaceAll(/([A-Z])/g, "_$1").toLowerCase()}`
    ),
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
  const wasmCounterExports = Object.fromEntries(counterFields.map((field) => {
    const exportName = `counter_${field.replaceAll(/([A-Z])/g, "_$1").toLowerCase()}`;
    const counter = exports[exportName] as CallableFunction;
    if (!counter) throw new Error(`self-hosted compiler counter export missing: ${exportName}`);
    return [field, counter];
  })) as Record<string, CallableFunction>;
  if (!memory || !compile) throw new Error("self-hosted compiler export contract missing");

  const encoder = new TextEncoder();
  const fixtureEntries = [];
  const results = [];
  const outputHashes: string[] = [];
  const counterTotals = {
    javascript: Object.fromEntries(counterFields.map((field) => [field, 0])) as Record<
      string,
      number
    >,
    wasmSelfHosted: Object.fromEntries(counterFields.map((field) => [field, 0])) as Record<
      string,
      number
    >,
  };
  for (let index = 1; index <= 20; index += 1) {
    const id = String(index).padStart(2, "0");
    const sourcePath = `benchmarks/base/tooling-c-to-wasm-compile/fixtures/programs/${id}.c`;
    const headerPath = `benchmarks/base/tooling-c-to-wasm-compile/fixtures/headers/${id}.h`;
    const sourceBytes = await Deno.readFile(new URL(sourcePath, root));
    const headerBytes = await Deno.readFile(new URL(headerPath, root));
    const source = new TextDecoder("utf-8", { fatal: true }).decode(sourceBytes);
    const header = new TextDecoder("utf-8", { fatal: true }).decode(headerBytes);
    const js = compileC(source, header);
    const jsCounters = js.counters as Record<string, number>;

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
    const wasmCounters = Object.fromEntries(
      counterFields.map((field) => [field, Number(wasmCounterExports[field]())]),
    ) as Record<string, number>;
    const jsCounterKeys = Object.keys(jsCounters);
    if (
      jsCounterKeys.length !== counterFields.length ||
      counterFields.some((field) => !jsCounterKeys.includes(field))
    ) {
      throw new Error(`JavaScript counter contract incomplete for ${id}`);
    }
    for (const field of counterFields) {
      if (!Number.isSafeInteger(jsCounters[field]) || !Number.isSafeInteger(wasmCounters[field])) {
        throw new Error(`counter ${field} is not an integer for ${id}`);
      }
      counterTotals.javascript[field] += jsCounters[field];
      counterTotals.wasmSelfHosted[field] += wasmCounters[field];
    }
    for (const field of equalCounterFields) {
      if (wasmCounters[field] !== jsCounters[field]) {
        throw new Error(
          `counter ${field} mismatch for ${id}: ${wasmCounters[field]} != ${jsCounters[field]}`,
        );
      }
    }
    for (
      const [target, counters] of [
        ["javascript-controlled", jsCounters],
        ["wasm-self-hosted-controlled", wasmCounters],
      ] as const
    ) {
      for (
        const [field, expectedValue] of Object.entries(
          contract.targets[target].counterExpectations,
        )
      ) {
        if (counters[field] !== expectedValue) {
          throw new Error(
            `${target} counter ${field} mismatch for ${id}: ${counters[field]} != ${expectedValue}`,
          );
        }
      }
    }
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
      jsCounters,
      wasmCounters,
    });
  }

  for (const { id, source, header } of negativeFixtures) {
    let rejected = false;
    try {
      compileC(source, header);
    } catch {
      rejected = true;
    }
    if (!rejected) throw new Error(`JavaScript compiler accepted negative fixture ${id}`);
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
      throw new Error(`self-hosted compiler accepted negative fixture ${id}`);
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
      flags: clangArgs.slice(0, -2).map((value) =>
        value === new URL("compiler-wasm.c", bench).pathname
          ? "benchmarks/base/tooling-c-to-wasm-compile/compiler-wasm.c"
          : value
      ),
      licenses: ["LLVM/Clang Apache-2.0 WITH LLVM-exception", "LLD Apache-2.0 WITH LLVM-exception"],
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
      preprocessPasses: contract.fixedWork.preprocessPasses * 2,
      parsePasses: contract.fixedWork.parsePasses * 2,
      typecheckPasses: contract.fixedWork.typecheckPasses * 2,
      codegenPasses: contract.fixedWork.codegenPasses * 2,
      linkPasses: contract.fixedWork.linkPasses * 2,
      executedExports: contract.fixedWork.sources * 2,
      counters: counterTotals,
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
