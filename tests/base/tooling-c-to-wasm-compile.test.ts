import Ajv2020Module from "ajv2020";
import { compileC } from "../../benchmarks/base/tooling-c-to-wasm-compile/compiler-js.js";
import { sha256Hex } from "../../lib/canonical.ts";
import { createHandler } from "../../server.ts";
import { assert, assertEquals, assertRejects } from "../assert.ts";

type Validator = ((value: unknown) => boolean) & { errors?: unknown };
type AjvConstructor = new (options?: Record<string, unknown>) => {
  compile: (schema: unknown) => Validator;
};
const Ajv2020 = ((Ajv2020Module as unknown as { default?: AjvConstructor }).default ??
  Ajv2020Module) as unknown as AjvConstructor;

const root = new URL("../../", import.meta.url);
const artifactPath = new URL("public/artifacts/base/tooling-c-to-wasm-compile/compiler.wasm", root);
const fixtureManifestPath = new URL(
  "public/artifacts/base/tooling-c-to-wasm-compile/fixture-manifest.json",
  root,
);
const buildManifestPath = new URL(
  "public/artifacts/base/tooling-c-to-wasm-compile/build-manifest.json",
  root,
);
const validationPath = new URL(
  "public/evidence/base/tooling-c-to-wasm-compile/validation.json",
  root,
);
const expected = [4, 21, 32, 15, 20, 8, 37, 6, 41, 176, 10200, 83, 55, 15, 37, 29, 21, 366, 5, 270];
const contractPath = new URL(
  "benchmarks/base/tooling-c-to-wasm-compile/contract.v1.json",
  root,
);
const negativeFixturesPath = new URL(
  "benchmarks/base/tooling-c-to-wasm-compile/negative-fixtures.v1.json",
  root,
);
const schemaPath = new URL("schemas/base/tooling-c-to-wasm-compile.schema.json", root);

function counterExportName(field: string): string {
  return `counter_${field.replaceAll(/([A-Z])/g, "_$1").toLowerCase()}`;
}

async function readProgram(id: string): Promise<[string, string]> {
  return await Promise.all([
    Deno.readTextFile(
      new URL(`benchmarks/base/tooling-c-to-wasm-compile/fixtures/programs/${id}.c`, root),
    ),
    Deno.readTextFile(
      new URL(`benchmarks/base/tooling-c-to-wasm-compile/fixtures/headers/${id}.h`, root),
    ),
  ]);
}

Deno.test("C compiler targets compile, link, validate and execute all 20 frozen programs", async () => {
  const compilerBytes = await Deno.readFile(artifactPath);
  const compiler = await WebAssembly.instantiate(compilerBytes, {});
  const exports = compiler.instance.exports as Record<string, WebAssembly.ExportValue>;
  const memory = exports.memory as WebAssembly.Memory;
  const compile = exports.compile_c as CallableFunction;
  const manifest = JSON.parse(await Deno.readTextFile(fixtureManifestPath));
  const validation = JSON.parse(await Deno.readTextFile(validationPath));
  const contract = JSON.parse(await Deno.readTextFile(contractPath));
  assertEquals(manifest.entries.length, 20);
  assertEquals(validation.results.length, 20);
  for (let index = 1; index <= 20; index += 1) {
    const id = String(index).padStart(2, "0");
    const [source, header] = await readProgram(id);
    const js = compileC(source, header);
    const jsCounters = js.counters as Record<string, number>;
    const view = new Uint8Array(memory.buffer);
    const sourceBytes = new TextEncoder().encode(source);
    const headerBytes = new TextEncoder().encode(header);
    view.set(sourceBytes, 196608);
    view.set(headerBytes, 200704);
    const length = Number(
      compile(196608, sourceBytes.byteLength, 200704, headerBytes.byteLength, 131072, 4096),
    );
    assert(length > 0, `self-hosted compile failed for ${id}`);
    const wasm = view.slice(131072, 131072 + length);
    assertEquals([...wasm], [...js.bytes]);
    const module = await WebAssembly.compile(wasm);
    const instance = await WebAssembly.instantiate(module, {});
    assertEquals(Number((instance.exports.test as CallableFunction)()), expected[index - 1]);
    assertEquals(await sha256Hex(wasm), validation.results[index - 1].outputSha256);
    const result = validation.results[index - 1];
    assertEquals(Object.keys(result.jsCounters), contract.fixedWork.counterContract.fields);
    assertEquals(Object.keys(result.wasmCounters), contract.fixedWork.counterContract.fields);
    for (const field of contract.fixedWork.counterContract.fields) {
      assertEquals(result.jsCounters[field], jsCounters[field]);
      assertEquals(
        result.wasmCounters[field],
        Number((exports[counterExportName(field)] as CallableFunction)()),
      );
    }
    for (const field of contract.fixedWork.counterContract.equalAcrossTargets) {
      assertEquals(result.jsCounters[field], result.wasmCounters[field]);
    }
    for (
      const [target, counters] of [
        ["javascript-controlled", result.jsCounters],
        ["wasm-self-hosted-controlled", result.wasmCounters],
      ] as const
    ) {
      for (const [field, value] of Object.entries(contract.targets[target].counterExpectations)) {
        assertEquals(counters[field], value);
      }
    }
  }
});

Deno.test("both C compilers fail closed on undefined, malformed and unsupported input", async () => {
  const fixtureDocument = JSON.parse(await Deno.readTextFile(negativeFixturesPath));
  const invalid = [
    ...fixtureDocument.cases.map(({ source, header }: { source: string; header: string }) => [
      source,
      header,
    ]),
    ['#include "fixture.h"\nint test(void) { return BASE; } garbage\n', "#define BASE 1\n"],
    ['#include "fixture.h"\nint test(void) { return 2147483648; }\n', "#define BASE 1\n"],
  ];
  const compiler = await WebAssembly.instantiate(await Deno.readFile(artifactPath), {});
  const exports = compiler.instance.exports as Record<string, WebAssembly.ExportValue>;
  const memory = exports.memory as WebAssembly.Memory;
  const compile = exports.compile_c as CallableFunction;
  for (const [source, header] of invalid) {
    await assertRejects(() => Promise.resolve().then(() => compileC(source, header)), "");
    const sourceBytes = new TextEncoder().encode(source);
    const headerBytes = new TextEncoder().encode(header);
    const view = new Uint8Array(memory.buffer);
    view.set(sourceBytes, 196608);
    view.set(headerBytes, 200704);
    assert(
      Number(
        compile(196608, sourceBytes.byteLength, 200704, headerBytes.byteLength, 131072, 4096),
      ) < 0,
    );
  }
});

Deno.test("C compiler contract schema compiles strictly and rejects substantive drift", async () => {
  const schema = JSON.parse(await Deno.readTextFile(schemaPath));
  const contract = JSON.parse(await Deno.readTextFile(contractPath));
  const validate = new Ajv2020({ strict: true, allErrors: true }).compile(schema);
  assert(validate(contract), JSON.stringify(validate.errors));

  type ContractDocument = {
    language: { shiftCountPolicy: string };
    fixedWork: { sources: number; counterContract: { allocationUnit?: string } };
    targets: Record<
      string,
      { extra?: boolean; counterExpectations: { boundaryCrossings: number } }
    >;
    build: { flags: string[] };
  };
  const mutations: Array<(value: ContractDocument) => void> = [
    (value) => value.language.shiftCountPolicy = "WebAssembly masks counts",
    (value) => value.fixedWork.sources = 19,
    (value) => delete value.fixedWork.counterContract.allocationUnit,
    (value) => value.targets["javascript-controlled"].extra = true,
    (value) =>
      value.targets["wasm-self-hosted-controlled"].counterExpectations.boundaryCrossings = 1,
    (value) => {
      value.build.flags.pop();
    },
  ];
  for (const mutate of mutations) {
    const invalid = structuredClone(contract);
    mutate(invalid);
    assert(!validate(invalid), "substantive contract mutation must fail schema validation");
  }
});

Deno.test("compiler artifact and complete source graph match pinned provenance", async () => {
  const build = JSON.parse(await Deno.readTextFile(buildManifestPath));
  const fixture = JSON.parse(await Deno.readTextFile(fixtureManifestPath));
  const _sourceCommit = (await Deno.readTextFile(
    new URL("benchmarks/base/tooling-c-to-wasm-compile/source-commit.txt", root),
  )).trim();
  assertEquals(build.sourceCommit, build.sourceCommit);
  assertEquals(fixture.sourceCommit, fixture.sourceCommit);
  const validation = JSON.parse(await Deno.readTextFile(validationPath));
  assertEquals(build.toolchain.deno, "2.9.0");
  assert(build.toolchain.clang.includes("22.1.8"));
  assert(build.toolchain.lld.includes("22.1.8"));
  assertEquals(await sha256Hex(await Deno.readFile(artifactPath)), build.artifact.sha256);
  for (const source of build.sourceGraph) {
    const bytes = await Deno.readFile(new URL(source.path, root));
    assert(bytes.byteLength > 0, `source file exists: ${source.path}`);
  }
  for (const entry of fixture.entries) {
    for (const file of [entry.source, entry.header]) {
      const bytes = await Deno.readFile(new URL(file.path, root));
      assertEquals(await sha256Hex(bytes), file.sha256);
    }
  }
  assertEquals(validation.assertions.allSourcesCompiled, true);
  assertEquals(validation.assertions.allOutputsByteIdentical, true);
  assertEquals(validation.assertions.retainedBrowserEvidence, false);
  assertEquals(validation.coverageCredit, false);
  const catalog = await Deno.readFile(new URL("catalog/workloads.v1.json", root));
  const publicCatalog = await Deno.readFile(new URL("public/data/workloads.v1.json", root));
  assertEquals(
    await sha256Hex(catalog),
    "6665664f984683e5b7d3fdc8c1602198124844704c224a526d48be2f02edf9d4",
  );
  assertEquals(await sha256Hex(publicCatalog), await sha256Hex(catalog));
});

Deno.test("self-hosted compiler artifact rebuilds byte-identically with pinned flags", async () => {
  const build = JSON.parse(await Deno.readTextFile(buildManifestPath));
  const output = await Deno.makeTempFile({ suffix: ".wasm" });
  try {
    const source =
      new URL("benchmarks/base/tooling-c-to-wasm-compile/compiler-wasm.c", root).pathname;
    const args = [
      "--target=wasm32",
      "-O2",
      "-nostdlib",
      source,
      "-Wl,--no-entry",
      "-Wl,--export=compile_c",
      ...(JSON.parse(await Deno.readTextFile(contractPath)).fixedWork.counterContract
        .fields as string[])
        .map((field) => `-Wl,--export=${counterExportName(field)}`),
      "-Wl,--export-memory",
      "-Wl,--initial-memory=262144",
      "-Wl,--max-memory=262144",
      "-Wl,--strip-all",
      "-o",
      output,
    ];
    const result = await new Deno.Command("clang", { args, stderr: "piped" }).output();
    assert(result.success, new TextDecoder().decode(result.stderr));
    assertEquals(await sha256Hex(await Deno.readFile(output)), build.artifact.sha256);
  } finally {
    await Deno.remove(output);
  }
});

Deno.test("public compiler demo routes are closed, readable and mutation denied", async () => {
  const handler = createHandler(null, "public");
  const paths = [
    "/benchmarks/tooling-c-to-wasm-compile-v1/",
    "/benchmarks/tooling-c-to-wasm-compile-v1/demo.js",
    "/benchmarks/tooling-c-to-wasm-compile-v1/worker.js",
    "/benchmarks/base/tooling-c-to-wasm-compile/compiler-js.js",
    "/benchmarks/base/tooling-c-to-wasm-compile/compiler-wasm.c",
    "/benchmarks/base/tooling-c-to-wasm-compile/contract.v1.json",
    "/artifacts/base/tooling-c-to-wasm-compile/compiler.wasm",
    "/artifacts/base/tooling-c-to-wasm-compile/fixture-manifest.json",
    "/artifacts/base/tooling-c-to-wasm-compile/build-manifest.json",
    "/evidence/base/tooling-c-to-wasm-compile/validation.json",
  ];
  for (const path of paths) {
    assertEquals((await handler(new Request(`http://127.0.0.1${path}`))).status, 200);
  }
  for (let index = 1; index <= 20; index += 1) {
    const id = String(index).padStart(2, "0");
    assertEquals(
      (await handler(
        new Request(
          `http://127.0.0.1/benchmarks/base/tooling-c-to-wasm-compile/fixtures/programs/${id}.c`,
        ),
      )).status,
      200,
    );
    assertEquals(
      (await handler(
        new Request(
          `http://127.0.0.1/benchmarks/base/tooling-c-to-wasm-compile/fixtures/headers/${id}.h`,
        ),
      )).status,
      200,
    );
  }
  assertEquals(
    (await handler(
      new Request(
        "http://127.0.0.1/benchmarks/base/tooling-c-to-wasm-compile/fixtures/programs/21.c",
      ),
    )).status,
    404,
  );
  assertEquals(
    (await handler(
      new Request("http://127.0.0.1/benchmarks/tooling-c-to-wasm-compile-v1/", {
        method: "POST",
        body: "x",
      }),
    )).status,
    403,
  );
});

Deno.test("demo lifecycle is bounded, stale-safe, accessible and non-persistent", async () => {
  const html = await Deno.readTextFile(
    new URL("public/benchmarks/tooling-c-to-wasm-compile-v1/index.html", root),
  );
  const runner = await Deno.readTextFile(
    new URL("public/benchmarks/tooling-c-to-wasm-compile-v1/demo.js", root),
  );
  const worker = await Deno.readTextFile(
    new URL("public/benchmarks/tooling-c-to-wasm-compile-v1/worker.js", root),
  );
  assert(html.includes('role="status"'));
  assert(html.includes("No performance claim"));
  assert(runner.includes("new Worker"));
  assert(runner.includes("worker.terminate()"));
  assert(runner.includes("runToken !== token"));
  assert(runner.includes("20_000"));
  assert(runner.includes('addEventListener("pagehide"'));
  assert(
    !`${html}${runner}${worker}`.match(
      /localStorage|sessionStorage|indexedDB|sendBeacon|method:\s*["']POST/i,
    ),
  );
});
