import Ajv2020Module from "ajv2020";
import { assert, assertEquals } from "./assert.ts";
import { createHandler } from "../server.ts";

type Validator = ((value: unknown) => boolean) & { errors?: unknown };
type AjvCtor = new (options?: Record<string, unknown>) => {
  compile(schema: unknown): Validator;
};
const Ajv2020 = ((Ajv2020Module as unknown as { default?: AjvCtor }).default ??
  Ajv2020Module) as unknown as AjvCtor;

async function sha256(bytes: Uint8Array): Promise<string> {
  return Array.from(
    new Uint8Array(await crypto.subtle.digest("SHA-256", Uint8Array.from(bytes))),
    (byte) => byte.toString(16).padStart(2, "0"),
  ).join("");
}

async function loadRecord(): Promise<Record<string, unknown>> {
  return JSON.parse(
    await Deno.readTextFile("catalog/base-implementations/tooling.minify-format.v1.json"),
  );
}

Deno.test("tooling minify-format blocker is closed and binds the unchanged frozen catalog", async () => {
  const schema = JSON.parse(
    await Deno.readTextFile("schemas/base-tooling-minify-format-blocker.schema.json"),
  );
  const validate = new Ajv2020({ strict: true, allErrors: true }).compile(schema);
  const record = await loadRecord();

  assert(validate(record), JSON.stringify(validate.errors));
  assertEquals(record.status, "blocked");
  assertEquals(record.authoritativePerformanceEvidence, false);
  assertEquals(record.implementationCoverage, 0);
  assertEquals(record.routes, []);
  assertEquals(record.artifacts, []);
  assertEquals(record.evidenceCells, []);

  const frozenCatalog = record.frozenCatalog as Record<string, unknown>;
  assertEquals(
    await sha256(await Deno.readFile("catalog/workloads.v1.json")),
    frozenCatalog.sha256,
  );
  assertEquals(
    await Deno.readFile("catalog/workloads.v1.json"),
    await Deno.readFile("public/data/workloads.v1.json"),
  );
});

Deno.test("tooling minify-format blocker rejects coverage, artifacts, routes and undeclared fields", async () => {
  const schema = JSON.parse(
    await Deno.readTextFile("schemas/base-tooling-minify-format-blocker.schema.json"),
  );
  const validate = new Ajv2020({ strict: true, allErrors: true }).compile(schema);
  const record = await loadRecord();
  const mutations = [
    { ...record, status: "implementation-candidate" },
    { ...record, authoritativePerformanceEvidence: true },
    { ...record, implementationCoverage: 1 },
    { ...record, routes: ["/benchmarks/tooling-minify-format-v1/"] },
    { ...record, artifacts: ["tooling-minify-format.wasm"] },
    { ...record, evidenceCells: [{ language: "javascript", operation: "minify" }] },
    { ...record, undeclared: true },
  ];

  for (const mutation of mutations) assertEquals(validate(mutation), false);
});

Deno.test("rejected tooling minify-format executable and evidence routes fail closed", async () => {
  const handler = createHandler(null, "public", null);
  const paths = [
    "/benchmarks/tooling-minify-format-v1/",
    "/benchmarks/tooling-minify-format-v1/engine.js",
    "/artifacts/base-tooling-minify-format/tooling-minify-format.wasm",
    "/artifacts/base-tooling-minify-format/build-manifest.json",
    "/evidence/base/tooling-minify-format/javascript-controlled.json",
    "/evidence/base/tooling-minify-format/linear-wasm-controlled.json",
  ];

  for (const path of paths) {
    const response = await handler(new Request(`http://local${path}`));
    assert(response.status === 404, path);
  }
});
