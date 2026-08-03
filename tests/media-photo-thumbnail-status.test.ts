import Ajv2020Module from "ajv2020";
import addFormatsModule from "ajv-formats";
import { sha256Hex as canonicalSha256Hex } from "../lib/canonical.ts";
import {
  acquireMediaPhotoFixtures,
  assertFixtureManifest,
  type MediaPhotoFixtureManifest,
  sha256Hex,
} from "../lib/media-photo-thumbnail-fixtures.ts";
import { assert, assertEquals, assertRejects } from "./assert.ts";

type Validator = ((value: unknown) => boolean) & { errors?: unknown };
type Ajv = { compile(schema: unknown): Validator };
type AjvConstructor = new (options?: Record<string, unknown>) => Ajv;
type AddFormats = (ajv: Ajv) => void;
const Ajv2020 = ((Ajv2020Module as unknown as { default?: AjvConstructor }).default ??
  Ajv2020Module) as unknown as AjvConstructor;
const addFormats = ((addFormatsModule as unknown as { default?: AddFormats }).default ??
  addFormatsModule) as unknown as AddFormats;

const ROOT = "benchmarks/v1/media-photo-thumbnail";
const MANIFEST_PATH = `${ROOT}/fixture-rights-manifest.json`;
const CONTRACT_PATH = `${ROOT}/pipeline-contract.json`;
const AUDIT_PATH = `${ROOT}/engine-candidate-audit.json`;
const STATUS_PATH = `${ROOT}/implementation-status.json`;

async function json(path: string): Promise<Record<string, unknown>> {
  return JSON.parse(await Deno.readTextFile(path)) as Record<string, unknown>;
}

async function fileSha256(path: string): Promise<string> {
  return await canonicalSha256Hex(await Deno.readFile(path));
}

async function filesBelow(path: string): Promise<string[]> {
  const output: string[] = [];
  for await (const entry of Deno.readDir(path)) {
    const child = `${path}/${entry.name}`;
    if (entry.isDirectory) output.push(...await filesBelow(child));
    else if (entry.isFile) output.push(child);
  }
  return output;
}

Deno.test("media photo fixture manifest is closed, catalog-bound, rights-scoped, and schema valid", async () => {
  const manifest = await json(MANIFEST_PATH) as unknown as MediaPhotoFixtureManifest;
  assertFixtureManifest(manifest);
  const schema = await json("schemas/media-photo-thumbnail-fixture-rights.schema.json");
  const ajv = new Ajv2020({ strict: true, allErrors: true });
  addFormats(ajv);
  const validate = ajv.compile(schema);
  assert(validate(manifest), JSON.stringify(validate.errors));

  assertEquals(await fileSha256("catalog/workloads.v1.json"), manifest.catalogSha256);
  assertEquals(await fileSha256("public/data/workloads.v1.json"), manifest.catalogSha256);
  const catalog = await json("catalog/workloads.v1.json") as { entries?: unknown[] };
  assertEquals(catalog.entries?.length, 38);
  assertEquals(manifest.selection.map((entry) => entry.id), [
    "gb82-baby",
    "gb82-night",
    "gb82-grass",
    "gb82-pixel",
    "gb82-sc-graph",
    "gb82-sc-terminal",
  ]);
  assertEquals(
    manifest.selection.reduce((sum, entry) => sum + entry.byteLength, 0),
    1_530_854,
  );
  assertEquals(manifest.rightsAudit.licenseSpdx, "CC0-1.0");
  assertEquals(manifest.rightsAudit.redistributionPermission, "permitted-by-CC0-1.0");
  assert(manifest.rightsAudit.caveat.includes("third-party"));
});

Deno.test("media photo fixture acquisition fails closed before writing changed upstream bytes", async () => {
  const manifest = await json(MANIFEST_PATH) as unknown as MediaPhotoFixtureManifest;
  const output = await Deno.makeTempDir({ prefix: "media-photo-fixture-reject-" });
  let requests = 0;
  const fetcher = ((_input: string | URL | Request) => {
    requests++;
    return Promise.resolve(new Response(new Uint8Array([0]), { status: 200 }));
  }) as typeof fetch;
  await assertRejects(
    () => acquireMediaPhotoFixtures(manifest, output, fetcher),
    "Byte length mismatch",
  );
  assertEquals(requests, 1);
  assertEquals(await filesBelow(output), []);
  await Deno.remove(output, { recursive: true });
});

Deno.test("media photo fixture hashing uses raw bytes", async () => {
  assertEquals(
    await sha256Hex(new TextEncoder().encode("abc")),
    "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad",
  );
});

Deno.test("media photo retained download verification covers every exact selected byte", async () => {
  const manifest = await json(MANIFEST_PATH) as unknown as MediaPhotoFixtureManifest;
  const evidence = await json(
    "evidence/fixtures/media-photo-thumbnail-download-verification.json",
  ) as {
    result: string;
    sourceCommit: string;
    fixtureManifestSha256: string;
    licenseSha256: string;
    readmeSha256: string;
    files: Array<{ path: string; byteLength: number; sha256: string }>;
    fixtureBytesCommitted: boolean;
    temporaryDirectoryRemoved: boolean;
  };
  assertEquals(evidence.result, "passed");
  assertEquals(evidence.sourceCommit, manifest.source.commit);
  assertEquals(evidence.fixtureManifestSha256, await fileSha256(MANIFEST_PATH));
  assertEquals(evidence.licenseSha256, manifest.source.licenseSha256);
  assertEquals(evidence.readmeSha256, manifest.source.readmeSha256);
  assertEquals(
    evidence.files,
    manifest.selection.map((entry) => ({
      path: entry.sourcePath,
      byteLength: entry.byteLength,
      sha256: entry.sha256,
    })),
  );
  assertEquals(evidence.fixtureBytesCommitted, false);
  assertEquals(evidence.temporaryDirectoryRemoved, true);
});

Deno.test("media photo pipeline freezes complete stages, dimensions, policy, oracle, and unavailable counters", async () => {
  const contract = await json(CONTRACT_PATH);
  assertEquals(contract.status, "frozen-preimplementation-contract");
  const fixedWork = contract.fixedWork as {
    images: number;
    passesPerImage: string[];
    outputDimensions: Record<string, number[]>;
  };
  assertEquals(fixedWork.images, 6);
  assertEquals(fixedWork.passesPerImage.length, 8);
  assertEquals(fixedWork.outputDimensions["gb82-sc-graph"], [1280, 773]);
  assertEquals(fixedWork.outputDimensions["gb82-sc-terminal"], [1280, 826]);
  assertEquals(
    (contract.decode as { hostDecoderControlledTarget: boolean }).hostDecoderControlledTarget,
    false,
  );
  assert((contract.orientation as { policy: string }).policy.includes("values 1 through 8"));
  assertEquals((contract.webp as { quality: number }).quality, 80);
  assertEquals((contract.webp as { byteIdentityRequired: boolean }).byteIdentityRequired, false);
  assertEquals(
    (contract.counters as { availability: string }).availability,
    "unavailable-until-controlled-engine-pair",
  );
  assertEquals((contract.counters as { required: string[] }).required.length, 15);
  assertEquals((contract.lifecycle as { persistence: boolean }).persistence, false);
  assertEquals((contract.lifecycle as { upload: boolean }).upload, false);
  assertEquals((contract.lifecycle as { performanceRanking: boolean }).performanceRanking, false);
});

Deno.test("media photo engine audit keeps host paths and unsuitable candidates out of controlled coverage", async () => {
  const audit = await json(AUDIT_PATH);
  assertEquals((audit.controlledJavaScript as { status: string }).status, "blocked");
  assertEquals((audit.controlledLinearWasm as { status: string }).status, "blocked");
  assertEquals(
    (audit.hostBaselines as { allowedAsControlledTargets: boolean }).allowedAsControlledTargets,
    false,
  );
  const conclusion = audit.conclusion as {
    status: string;
    reasonCodes: string[];
    coverageCounted: boolean;
    performanceTimingPermitted: boolean;
    interactiveDemoPermitted: boolean;
  };
  assertEquals(conclusion.status, "blocked-before-engine-implementation");
  assertEquals(conclusion.reasonCodes.length, 5);
  assertEquals(conclusion.coverageCounted, false);
  assertEquals(conclusion.performanceTimingPermitted, false);
  assertEquals(conclusion.interactiveDemoPermitted, false);
  assert(!JSON.stringify(audit).includes('"status":"passed"'));
});

Deno.test("media photo status binds raw manifests and reports missing evidence as unavailable", async () => {
  const status = await json(STATUS_PATH);
  const statusSchema = await json(
    "schemas/media-photo-thumbnail-implementation-status.schema.json",
  );
  const validate = new Ajv2020({ strict: true, allErrors: true }).compile(statusSchema);
  assert(validate(status), JSON.stringify(validate.errors));
  assertEquals(status.maturity, "blocked-before-implementation");
  assertEquals(status.coverageCounted, false);
  assertEquals(
    (status.catalog as { sha256: string }).sha256,
    await fileSha256("catalog/workloads.v1.json"),
  );
  assertEquals(
    (status.fixture as { manifestSha256: string }).manifestSha256,
    await fileSha256(MANIFEST_PATH),
  );
  assertEquals((status.contract as { sha256: string }).sha256, await fileSha256(CONTRACT_PATH));
  assertEquals((status.engineAudit as { sha256: string }).sha256, await fileSha256(AUDIT_PATH));
  const validation = status.validation as Record<string, string>;
  assertEquals(validation.completeOutputOracle, "unavailable");
  assertEquals(validation.counterEvidence, "unavailable");
  assertEquals(validation.browserEvidence, "uncollected");
  assertEquals(validation.performanceEvidence, "not-permitted");
  assertEquals((status.unimplementedRequirements as string[]).length, 6);
  assertEquals((status.prohibitedClaims as string[]).length, 5);
  assert(!JSON.stringify(status).includes('"implementedCatalogEntries":1'));
});

Deno.test("media photo package does not redistribute fixture or claim a runnable demo", async () => {
  const files = await filesBelow(ROOT);
  assertEquals(files.filter((path) => /\.(png|webp|jpg|jpeg)$/i.test(path)), []);
  assertEquals(files.includes(`${ROOT}/implementation-status.json`), true);
  const server = await Deno.readTextFile("server.ts");
  assert(!server.includes("media-photo-thumbnail-v1"));
  const publicIndex = await Deno.readTextFile("public/benchmarks/index.html");
  assert(publicIndex.includes("38 proposed workloads; 0 implemented"));
});
