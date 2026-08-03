import Ajv2020Module from "ajv2020";
import addFormatsModule from "ajv-formats";

const ROOT = new URL("../", import.meta.url);
const RECORD_PATH = "public/evidence/base-v1-blockers/ml.quantized-image-inference.v1.json";
const SCHEMA_PATH = "schemas/base-v1-blocker.schema.json";
const FROZEN_SHA256 = "6665664f984683e5b7d3fdc8c1602198124844704c224a526d48be2f02edf9d4";

type ValidationError = { instancePath?: string; message?: string };
type Validator = ((value: unknown) => boolean) & { errors?: ValidationError[] | null };
type AjvInstance = { compile: (schema: unknown) => Validator };
type AjvConstructor = new (options?: Record<string, unknown>) => AjvInstance;
type AddFormats = (ajv: AjvInstance) => void;
const Ajv2020 = ((Ajv2020Module as unknown as { default?: AjvConstructor }).default ??
  Ajv2020Module) as unknown as AjvConstructor;
const addFormats = ((addFormatsModule as unknown as { default?: AddFormats }).default ??
  addFormatsModule) as unknown as AddFormats;

async function read(path: string): Promise<Uint8Array> {
  return await Deno.readFile(new URL(path, ROOT));
}

async function readJson(path: string): Promise<Record<string, unknown>> {
  return JSON.parse(new TextDecoder().decode(await read(path)));
}

async function sha256(bytes: Uint8Array): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", bytes as Uint8Array<ArrayBuffer>);
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

export async function auditQuantizedImageInferenceBlocker() {
  const [record, schema, catalogBytes, publicCatalogBytes] = await Promise.all([
    readJson(RECORD_PATH),
    readJson(SCHEMA_PATH),
    read("catalog/workloads.v1.json"),
    read("public/data/workloads.v1.json"),
  ]);

  const ajv = new Ajv2020({ allErrors: true, strict: false });
  addFormats(ajv);
  const validate = ajv.compile(schema);
  assert(validate(record), `blocker record schema failed: ${JSON.stringify(validate.errors)}`);

  const [catalogHash, publicHash] = await Promise.all([
    sha256(catalogBytes),
    sha256(publicCatalogBytes),
  ]);
  assert(catalogHash === FROZEN_SHA256, `frozen catalog hash changed: ${catalogHash}`);
  assert(publicHash === FROZEN_SHA256, `public frozen catalog hash changed: ${publicHash}`);
  assert(
    catalogBytes.length === publicCatalogBytes.length &&
      catalogBytes.every((byte, index) => byte === publicCatalogBytes[index]),
    "frozen catalog copies are not byte-identical",
  );

  const catalog = JSON.parse(new TextDecoder().decode(catalogBytes));
  assert(catalog.entries.length === 38, "frozen catalog denominator is not 38");
  const entry = catalog.entries.find((candidate: { id?: string }) =>
    candidate.id === "ml.quantized-image-inference.v1"
  );
  assert(entry, "frozen workload entry missing");
  assert(entry.status === "proposed" && entry.stage === "proposal", "frozen entry was mutated");
  assert(entry.inputs?.[0]?.fixtureState === "proposed", "fixture state must remain proposed");
  assert(
    entry.inputs?.[0]?.rightsStatus === "download-recipe",
    "rights state must remain recipe-only",
  );
  assert(entry.inputs?.[0]?.redistribution === "recipe-only", "redistribution state was widened");
  assert(entry.inputs?.[0]?.sha256 === null, "frozen entry input hash must remain null");
  assert(entry.fixedWork?.description.includes("200 images"), "exact 200-image fixed work missing");

  assert(record.status === "blocked-before-fixture-freeze", "record must fail closed");
  const implementation = record.implementation as Record<string, unknown>;
  assert(implementation.coverageClaim === false, "blocked record cannot claim coverage");
  assert(implementation.records === 0, "blocked record cannot claim result records");
  const demo = record.publicDemo as Record<string, unknown>;
  assert(
    demo.status === "unavailable" && demo.route === null,
    "blocked workload cannot expose a demo",
  );

  const blockers = record.blockers as Array<Record<string, unknown>>;
  const codes = new Set(blockers.map((blocker) => blocker.code));
  for (
    const required of [
      "cifar10-redistribution-unresolved",
      "cifar10-archive-sha256-unpinned",
      "model-operator-revision-unaccepted",
      "public-demo-cannot-acquire-recipe-only-fixture",
    ]
  ) {
    assert(codes.has(required), `required blocker missing: ${required}`);
  }
  assert(
    blockers.every((blocker) => blocker.severity === "blocker" && blocker.status === "open"),
    "all recorded blockers must remain open blockers",
  );

  const contract = record.candidateContract as Record<string, Record<string, unknown> | unknown[]>;
  const fixed = contract.fixedWork as Record<string, unknown>;
  assert(
    fixed.images === 200 && fixed.batch === 1 && fixed.passes === 200,
    "candidate fixed work reduced",
  );
  const fixture = contract.fixture as Record<string, unknown>;
  assert(fixture.archiveSha256 === null, "record must not invent the unavailable archive SHA-256");
  const model = contract.model as Record<string, unknown>;
  assert(
    model.acceptance === "candidate-only",
    "candidate model cannot become accepted implicitly",
  );
  assert(
    model.sha256 === "3c002613d1b2475eb51dd78dfb85a546c8ae658dee71cf6ade43b022fe205415",
    "candidate model hash drifted",
  );

  const requirements = record.acceptanceRequirements as Array<Record<string, unknown>>;
  assert(
    requirements.length >= 5 && requirements.every((item) => item.status === "unmet"),
    "acceptance requirements must remain explicitly unmet",
  );

  return {
    workloadId: record.workloadId,
    status: record.status,
    blockers: blockers.length,
    catalogSha256: catalogHash,
    implementedCatalogEntries: 0,
  };
}

if (import.meta.main) {
  console.log(JSON.stringify(await auditQuantizedImageInferenceBlocker()));
}
