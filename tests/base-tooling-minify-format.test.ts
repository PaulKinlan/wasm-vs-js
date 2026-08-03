import Ajv2020Module from "ajv2020";
import { assert, assertEquals, assertRejects } from "./assert.ts";
import {
  CATALOG_SHA256,
  FIXTURE_BYTES,
  LANGUAGES,
  OPERATIONS,
  TOTAL_BYTES,
} from "../benchmarks/base/tooling-minify-format/contract.ts";
import { generateAllFixtures } from "../benchmarks/base/tooling-minify-format/generator.ts";
import { transformJs } from "../benchmarks/base/tooling-minify-format/engine.ts";
import { instantiateToolingWasm } from "../benchmarks/base/tooling-minify-format/wasm.ts";
import { createHandler } from "../server.ts";

type Validator = ((v: unknown) => boolean) & { errors?: unknown };
type AjvCtor = new (o?: Record<string, unknown>) => { compile(s: unknown): Validator };
const Ajv2020 = ((Ajv2020Module as unknown as { default?: AjvCtor }).default ??
  Ajv2020Module) as unknown as AjvCtor;
async function hash(bytes: Uint8Array): Promise<string> {
  return Array.from(
    new Uint8Array(await crypto.subtle.digest("SHA-256", Uint8Array.from(bytes))),
    (b) => b.toString(16).padStart(2, "0"),
  ).join("");
}

Deno.test("base tooling registration preserves frozen v1 and freezes exactly 5 MiB of rights-clean source", async () => {
  const catalog = await Deno.readFile("catalog/workloads.v1.json");
  const publicCatalog = await Deno.readFile("public/data/workloads.v1.json");
  assertEquals(await hash(catalog), CATALOG_SHA256);
  assertEquals(await hash(publicCatalog), CATALOG_SHA256);
  const registration = JSON.parse(
    await Deno.readTextFile("catalog/base-implementations/tooling.minify-format.v1.json"),
  );
  assertEquals(registration.baseWorkloadId, "tooling.minify-format.v1");
  assertEquals(registration.frozenCatalog.sha256, CATALOG_SHA256);
  assertEquals(registration.fixedWork.totalInputBytes, TOTAL_BYTES);
  assertEquals(registration.authoritativePerformanceEvidence, false);
  const fixture = JSON.parse(
    await Deno.readTextFile("public/artifacts/base-tooling-minify-format/fixture-manifest.json"),
  );
  assertEquals(fixture.licenseSpdx, "CC0-1.0");
  assertEquals(fixture.totalBytes, 5_242_880);
  const generated = generateAllFixtures();
  assertEquals(Object.values(generated).reduce((n, b) => n + b.byteLength, 0), TOTAL_BYTES);
  for (const language of LANGUAGES) {
    assertEquals(generated[language].byteLength, FIXTURE_BYTES[language]);
    assertEquals(
      await hash(generated[language]),
      fixture.fixtures.find((x: { language: string }) => x.language === language).sha256,
    );
  }
});

Deno.test("JS and material Wasm fully transform all six language-operation cells with exact outputs and counters", async () => {
  const fixtures = generateAllFixtures();
  const runWasm = await instantiateToolingWasm(
    await Deno.readFile("public/artifacts/base-tooling-minify-format/tooling-minify-format.wasm"),
  );
  const build = JSON.parse(
    await Deno.readTextFile("public/artifacts/base-tooling-minify-format/build-manifest.json"),
  );
  for (const language of LANGUAGES) {
    for (const operation of OPERATIONS) {
      const js = transformJs(fixtures[language], language, operation);
      const wasm = runWasm(fixtures[language], language, operation);
      assertEquals(wasm.output, js.output);
      assertEquals(wasm.counters.inputBytes, FIXTURE_BYTES[language]);
      for (const counter of ["tokens", "nodes", "transforms"] as const) {
        assertEquals(wasm.counters[counter], js.counters[counter]);
      }
      assertEquals(js.counters.boundaryCrossings, 0);
      assertEquals(wasm.counters.boundaryCrossings, 1);
      assertEquals(js.counters.allocations, 2);
      assertEquals(wasm.counters.allocations, 0);
      const expected = build.outputs.find((x: { language: string; operation: string }) =>
        x.language === language && x.operation === operation
      );
      assertEquals(await hash(js.output), expected.sha256);
      assertEquals(js.output.byteLength, expected.bytes);
      const canonicalAgain = transformJs(js.output, language, operation).output;
      assertEquals(canonicalAgain, js.output);
    }
    const semanticSignature = transformJs(fixtures[language], language, "minify").output;
    const formatted = transformJs(fixtures[language], language, "format").output;
    assertEquals(transformJs(formatted, language, "minify").output, semanticSignature);
    assertEquals(runWasm(formatted, language, "minify").output, semanticSignature);
  }
});

Deno.test("owned grammar preserves Unicode and rejects malformed syntax in both targets", async () => {
  const runWasm = await instantiateToolingWasm(
    await Deno.readFile("public/artifacts/base-tooling-minify-format/tooling-minify-format.wasm"),
  );
  const enc = new TextEncoder(), dec = new TextDecoder();
  const valid = [
    ["javascript", `const 東京 = "café 🚀";`] as const,
    ["css", `.東京 { content: "café 🚀"; }`] as const,
    ["html", `<section lang="ja"><p>東京 café 🚀</p></section>`] as const,
  ];
  for (const [language, source] of valid) {
    for (const operation of OPERATIONS) {
      const input = enc.encode(source);
      const js = transformJs(input, language, operation);
      const wasm = runWasm(input, language, operation);
      assertEquals(wasm.output, js.output);
      assert(dec.decode(js.output).includes("東京"));
      assert(dec.decode(js.output).includes("🚀"));
    }
  }
  const malformed = [
    ["javascript", `const x = "unterminated;`] as const,
    ["javascript", `/* unterminated`] as const,
    ["css", `.x { color: red;`] as const,
    ["html", `<section><p>x</p>`] as const,
    ["html", `<!-- unterminated`] as const,
  ];
  for (const [language, source] of malformed) {
    await assertRejects(async () => {
      await Promise.resolve();
      return transformJs(enc.encode(source), language, "minify");
    }, "");
    await assertRejects(async () => {
      await Promise.resolve();
      return runWasm(enc.encode(source), language, "minify");
    }, "");
  }
});

Deno.test("100 generated semantic cases agree across JS and Wasm", async () => {
  const runWasm = await instantiateToolingWasm(
    await Deno.readFile("public/artifacts/base-tooling-minify-format/tooling-minify-format.wasm"),
  );
  const enc = new TextEncoder();
  let state = 0x37c0ffee;
  const next = () => (state = Math.imul(state ^ state >>> 16, 0x45d9f3b) >>> 0);
  for (let i = 0; i < 100; i++) {
    const n = next() % 10000, u = `東京${n}🚀`;
    const samples = {
      javascript: `/*${i}*/ const v${i} = "${u}"; function f(x){ return x + ${n}; }`,
      css: `/*${i}*/ .c${i} { content: "${u}"; margin: ${n % 12}px; }`,
      html: `<!--${i}--><section data-n="${n}"><p>${u}</p></section>`,
    } as const;
    for (const language of LANGUAGES) {
      for (const operation of OPERATIONS) {
        assertEquals(
          runWasm(enc.encode(samples[language]), language, operation).output,
          transformJs(enc.encode(samples[language]), language, operation).output,
        );
      }
    }
  }
});

Deno.test("validation records satisfy the closed schema and bind build/fixture bytes", async () => {
  const schema = JSON.parse(
    await Deno.readTextFile("schemas/base-tooling-minify-format-validation.schema.json"),
  );
  const validate = new Ajv2020({ strict: true, allErrors: true }).compile(schema);
  const buildBytes = await Deno.readFile(
    "public/artifacts/base-tooling-minify-format/build-manifest.json",
  );
  const build = JSON.parse(new TextDecoder().decode(buildBytes));
  assertEquals(await hash(await Deno.readFile(build.artifact.path)), build.artifact.sha256);
  assertEquals(
    await hash(await Deno.readFile(build.fixtureManifest.path)),
    build.fixtureManifest.sha256,
  );
  for (const target of ["javascript-controlled", "linear-wasm-controlled"]) {
    const record = JSON.parse(
      await Deno.readTextFile(`public/evidence/base/tooling-minify-format/${target}.json`),
    );
    assert(validate(record), JSON.stringify(validate.errors));
    assertEquals(record.cells.length, 6);
    assertEquals(record.fixtureManifestSha256, build.fixtureManifest.sha256);
  }
});

Deno.test("Deno 2.9 and Clang 22 rebuild artifacts, bundle, manifests, registration and records byte-identically", async () => {
  assertEquals(Deno.version.deno, "2.9.0");
  const paths = [
    "public/artifacts/base-tooling-minify-format/tooling-minify-format.wasm",
    "public/artifacts/base-tooling-minify-format/fixture-manifest.json",
    "public/artifacts/base-tooling-minify-format/build-manifest.json",
    "public/benchmarks/tooling-minify-format-v1/engine.js",
    "catalog/base-implementations/tooling.minify-format.v1.json",
    "public/evidence/base/tooling-minify-format/javascript-controlled.json",
    "public/evidence/base/tooling-minify-format/linear-wasm-controlled.json",
  ];
  const before = new Map<string, Uint8Array>();
  for (const path of paths) before.set(path, await Deno.readFile(path));
  const command = await new Deno.Command(Deno.execPath(), {
    args: [
      "run",
      "--allow-read=.",
      "--allow-write=public/artifacts/base-tooling-minify-format,public/benchmarks/tooling-minify-format-v1,public/evidence/base/tooling-minify-format,catalog/base-implementations",
      "--allow-run=clang,deno",
      "scripts/build-base-tooling-minify-format.ts",
    ],
    stdout: "piped",
    stderr: "piped",
  }).output();
  assert(command.success, new TextDecoder().decode(command.stderr));
  for (const path of paths) assertEquals(await Deno.readFile(path), before.get(path));
});

Deno.test("tooling demo and evidence routes are read-only and content-typed", async () => {
  const handler = createHandler(null, "public", null);
  const paths = [
    "/benchmarks/tooling-minify-format-v1/",
    "/benchmarks/tooling-minify-format-v1/demo.js",
    "/benchmarks/tooling-minify-format-v1/worker.js",
    "/benchmarks/tooling-minify-format-v1/engine.js",
    "/artifacts/base-tooling-minify-format/tooling-minify-format.wasm",
    "/artifacts/base-tooling-minify-format/fixture-manifest.json",
    "/artifacts/base-tooling-minify-format/build-manifest.json",
    "/evidence/base/tooling-minify-format/javascript-controlled.json",
    "/evidence/base/tooling-minify-format/linear-wasm-controlled.json",
  ];
  for (const path of paths) {
    const response = await handler(new Request(`http://local${path}`));
    assertEquals(response.status, 200);
    assert(response.headers.get("content-type"));
  }
  assertEquals(
    (await handler(
      new Request("http://local/benchmarks/tooling-minify-format-v1/", { method: "POST" }),
    )).status,
    403,
  );
});
