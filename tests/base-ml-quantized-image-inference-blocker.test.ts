import Ajv2020Module from "ajv2020";
import addFormatsModule from "ajv-formats";
import { auditQuantizedImageInferenceBlocker } from "../scripts/audit-ml-quantized-image-inference-blocker.ts";
import { createHandler } from "../server.ts";
import { assert, assertEquals } from "./assert.ts";

type ValidationError = { instancePath?: string; message?: string };
type Validator = ((value: unknown) => boolean) & { errors?: ValidationError[] | null };
type AjvInstance = { compile: (schema: unknown) => Validator };
type AjvConstructor = new (options?: Record<string, unknown>) => AjvInstance;
type AddFormats = (ajv: AjvInstance) => void;
const Ajv2020 = ((Ajv2020Module as unknown as { default?: AjvConstructor }).default ??
  Ajv2020Module) as unknown as AjvConstructor;
const addFormats = ((addFormatsModule as unknown as { default?: AddFormats }).default ??
  addFormatsModule) as unknown as AddFormats;

const RECORD_PATH = "public/evidence/base-v1-blockers/ml.quantized-image-inference.v1.json";
const record = JSON.parse(await Deno.readTextFile(RECORD_PATH));
const schema = JSON.parse(await Deno.readTextFile("schemas/base-v1-blocker.schema.json"));

Deno.test("quantized image inference blocker record is schema-valid and frozen-catalog exact", async () => {
  const result = await auditQuantizedImageInferenceBlocker();
  assertEquals(result.workloadId, "ml.quantized-image-inference.v1");
  assertEquals(result.status, "blocked-before-fixture-freeze");
  assertEquals(result.blockers, 4);
  assertEquals(result.implementedCatalogEntries, 0);
  assertEquals(
    result.catalogSha256,
    "6665664f984683e5b7d3fdc8c1602198124844704c224a526d48be2f02edf9d4",
  );
});

Deno.test("blocker schema rejects invented coverage, results, routes, and archive SHA", () => {
  const ajv = new Ajv2020({ allErrors: true, strict: false });
  addFormats(ajv);
  const validate = ajv.compile(schema);
  for (
    const mutate of [
      (value: typeof record) => value.implementation.coverageClaim = true,
      (value: typeof record) => value.implementation.records = 1,
      (value: typeof record) =>
        value.publicDemo.route = "/benchmarks/ml-quantized-image-inference-v1/",
      (value: typeof record) => value.candidateContract.fixture.archiveSha256 = "0".repeat(64),
      (value: typeof record) => value.candidateContract.model.acceptance = "accepted",
      (value: typeof record) => value.acceptanceRequirements[0].status = "met",
    ]
  ) {
    const copy = structuredClone(record);
    mutate(copy);
    assert(!validate(copy), `schema accepted forbidden mutation: ${JSON.stringify(copy)}`);
  }
});

Deno.test("blocker package pins exact 200-image candidate without claiming fixture freeze", () => {
  assertEquals(record.candidateContract.fixedWork, { images: 200, batch: 1, passes: 200 });
  assertEquals(record.candidateContract.preprocessing.shape, [1, 32, 32, 3]);
  assertEquals(record.candidateContract.preprocessing.mapping, "target = source - 128");
  assertEquals(record.candidateContract.model.commit, "4addd0fa08d216e20637637874e084895f289da4");
  assertEquals(
    record.candidateContract.model.sha256,
    "3c002613d1b2475eb51dd78dfb85a546c8ae658dee71cf6ade43b022fe205415",
  );
  assertEquals(record.candidateContract.fixture.archiveSha256, null);
  assertEquals(record.implementation.fixture, "unfrozen");
  assertEquals(record.implementation.controlledJavaScript, "unavailable");
  assertEquals(record.implementation.materialLinearWasm, "unavailable");
  const hashBlocker = record.blockers.find(
    (blocker: { code: string }) => blocker.code === "cifar10-archive-sha256-unpinned",
  );
  const reproduction = hashBlocker.evidence.find(
    (item: { kind: string }) => item.kind === "reproduction",
  );
  assert(
    reproduction.finding.includes("requires archiveSha256 to remain null") &&
      reproduction.finding.includes("does not verify unacquired fixture bytes"),
    "blocker evidence must describe the audit's actual fail-closed behavior",
  );
});

Deno.test("public server exposes immutable blocker evidence but no fake demo", async () => {
  const handler = createHandler(null, "public", null);
  const evidence = await handler(
    new Request("http://localhost/evidence/base-v1-blockers/ml.quantized-image-inference.v1.json"),
  );
  assertEquals(evidence.status, 200);
  assertEquals(evidence.headers.get("content-type"), "application/json; charset=utf-8");
  assertEquals(await evidence.json(), record);

  const mutation = await handler(
    new Request("http://localhost/evidence/base-v1-blockers/ml.quantized-image-inference.v1.json", {
      method: "POST",
    }),
  );
  assertEquals(mutation.status, 403);

  for (
    const path of [
      "/benchmarks/ml-quantized-image-inference-v1/",
      "/benchmarks/ml.quantized-image-inference.v1/",
      "/artifacts/ml-quantized-image-inference/model.wasm",
    ]
  ) {
    assertEquals((await handler(new Request(`http://localhost${path}`))).status, 404);
  }
});
