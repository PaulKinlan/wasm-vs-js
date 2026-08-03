import Ajv2020Module from "ajv2020";

export const MEDIA_IMAGE_DECODE_BATCH_ID = "media.image-decode-batch.v1";
export const FROZEN_V1_SHA256 = "6665664f984683e5b7d3fdc8c1602198124844704c224a526d48be2f02edf9d4";
export const REQUIRED_FORMATS = ["jpeg", "png", "webp", "avif", "jxl"] as const;

const ROOT = new URL("../", import.meta.url);
const PACKAGE_DIR = "benchmarks/v1/media-image-decode-batch";

export interface BlockerValidation {
  catalogSha256: string;
  publicCatalogSha256: string;
  expectedImages: number;
  pinnedImages: number;
  rawSha256Count: number;
  blockerCodes: string[];
  schemaCount: number;
  sourceMetadataFileCount: number;
}

async function readJson(path: string): Promise<Record<string, unknown>> {
  return JSON.parse(await Deno.readTextFile(new URL(path, ROOT))) as Record<string, unknown>;
}

export async function sha256(bytes: Uint8Array): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", Uint8Array.from(bytes).buffer);
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join(
    "",
  );
}

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

const Ajv2020 = (Ajv2020Module as unknown as { default?: typeof Ajv2020Module }).default ??
  Ajv2020Module;

type JsonValidator = ((value: unknown) => boolean) & { errors?: unknown };

async function validateSchema(recordPath: string, schemaPath: string): Promise<void> {
  const record = await readJson(recordPath);
  const schema = await readJson(schemaPath);
  const ajv = new (Ajv2020 as unknown as new (options: Record<string, unknown>) => {
    compile: (schema: unknown) => JsonValidator;
  })({ allErrors: true, strict: false });
  const validate = ajv.compile(schema);
  assert(validate(record), `${recordPath} fails ${schemaPath}: ${JSON.stringify(validate.errors)}`);
}

export async function validateMediaImageDecodeBatchBlocker(): Promise<BlockerValidation> {
  const catalogBytes = await Deno.readFile(new URL("catalog/workloads.v1.json", ROOT));
  const publicCatalogBytes = await Deno.readFile(new URL("public/data/workloads.v1.json", ROOT));
  const catalogSha256 = await sha256(catalogBytes);
  const publicCatalogSha256 = await sha256(publicCatalogBytes);
  assert(catalogSha256 === FROZEN_V1_SHA256, "frozen catalog bytes changed");
  assert(publicCatalogSha256 === FROZEN_V1_SHA256, "public frozen catalog bytes changed");

  const catalog = JSON.parse(new TextDecoder().decode(catalogBytes)) as {
    entries: Array<Record<string, unknown>>;
  };
  const entry = catalog.entries.find((item) => item.id === MEDIA_IMAGE_DECODE_BATCH_ID);
  assert(entry, "frozen catalog entry is missing");
  assert(entry.status === "proposed", "blocked row must remain proposed");
  const inputs = entry.inputs as Array<Record<string, unknown>>;
  assert(inputs.length === 1, "frozen row must retain one input family");
  assert(inputs[0].rightsStatus === "requires-audit", "rights status must remain unresolved");
  assert(inputs[0].redistribution === "not-reviewed", "redistribution must remain unreviewed");
  assert(inputs[0].sha256 === null, "catalog must not gain a fabricated fixture hash");

  const schemaPairs = [
    [
      `${PACKAGE_DIR}/blocker.v1.json`,
      "schemas/media-image-decode-batch-blocker.schema.json",
    ],
    [
      `${PACKAGE_DIR}/fixture-rights-audit.v1.json`,
      "schemas/media-image-decode-batch-fixture-rights-audit.schema.json",
    ],
    [
      `${PACKAGE_DIR}/codec-feasibility-audit.v1.json`,
      "schemas/media-image-decode-batch-codec-feasibility-audit.schema.json",
    ],
    [
      `${PACKAGE_DIR}/source-metadata-manifest.v1.json`,
      "schemas/media-image-decode-batch-source-metadata-manifest.schema.json",
    ],
  ] as const;
  for (const [recordPath, schemaPath] of schemaPairs) await validateSchema(recordPath, schemaPath);

  const blocker = await readJson(`${PACKAGE_DIR}/blocker.v1.json`);
  assert(blocker.workloadId === MEDIA_IMAGE_DECODE_BATCH_ID, "blocker workload ID differs");
  assert(blocker.catalogSha256 === FROZEN_V1_SHA256, "blocker catalog hash differs");
  assert(blocker.status === "blocked-before-implementation", "blocker status differs");
  const coverage = blocker.coverage as Record<string, unknown>;
  assert(
    Object.values(coverage).every((value) => value === false),
    "blocked coverage must be false",
  );
  const blockers = blocker.blockers as Array<Record<string, unknown>>;
  assert(blockers.length === 3, "three blocking findings are required");
  assert(blockers.every((finding) => finding.severity === "blocker"), "all findings must block");
  const blockerCodes = blockers.map((finding) => String(finding.code));
  assert(
    blockerCodes.includes("fixture-rights-and-selection-unresolved"),
    "fixture-rights blocker missing",
  );
  assert(
    blockerCodes.includes("genuine-javascript-jxl-decoder-unavailable"),
    "JavaScript JXL blocker missing",
  );

  const rights = await readJson(`${PACKAGE_DIR}/fixture-rights-audit.v1.json`);
  assert(rights.status === "blocked-no-freeze", "fixture audit must remain blocked");
  assert(rights.requiredTotalImages === 125, "fixture audit must require 125 images");
  assert(rights.pinnedTotalImages === 0, "fixture audit must not claim pinned images");
  assert(rights.redistributableTotalImages === 0, "fixture audit must not claim rights");
  assert(rights.rawSha256Count === 0, "fixture audit must not claim raw hashes");
  const formatSets = rights.formatSets as Array<Record<string, unknown>>;
  assert(formatSets.length === 5, "fixture audit must contain five format sets");
  assert(
    JSON.stringify(formatSets.map((set) => set.format)) === JSON.stringify(REQUIRED_FORMATS),
    "fixture formats differ",
  );
  for (const set of formatSets) {
    assert(set.expectedCount === 25, `${set.format} must require 25 images`);
    assert(set.pinnedCount === 0, `${set.format} must not claim pinned images`);
    assert(set.rightsClearedCount === 0, `${set.format} must not claim cleared rights`);
    assert(
      Array.isArray(set.rawSha256) && set.rawSha256.length === 0,
      `${set.format} hashes differ`,
    );
    assert(set.status === "blocked", `${set.format} must remain blocked`);
  }

  const codec = await readJson(`${PACKAGE_DIR}/codec-feasibility-audit.v1.json`);
  assert(codec.status === "blocked-no-controlled-pair", "codec audit must remain blocked");
  assert(
    codec.sourceMetadataManifest === `${PACKAGE_DIR}/source-metadata-manifest.v1.json`,
    "codec source metadata manifest differs",
  );
  const targets = codec.controlledTargets as Record<string, Record<string, unknown>>;
  assert(targets.javascript.status === "blocked", "JavaScript target must remain blocked");
  assert(targets.javascript.blockingFormat === "jxl", "JXL blocker must be explicit");
  const checks = codec.candidateChecks as Array<Record<string, unknown>>;
  assert(checks.length >= 2, "codec audit must retain candidate checks");
  const jxl = checks.find((candidate) => candidate.name === "jxl.js");
  assert(jxl?.executionTechnology === "WebAssembly", "jxl.js execution technology differs");
  assert(jxl?.javascriptTargetEligible === false, "Wasm-backed JXL must not count as JavaScript");
  const hostBaseline = codec.hostBaseline as Record<string, unknown>;
  assert(hostBaseline.controlledJavaScriptEligible === false, "native decode must stay separate");

  const sourceMetadata = await readJson(`${PACKAGE_DIR}/source-metadata-manifest.v1.json`);
  assert(
    sourceMetadata.status === "retained-source-metadata-not-codec-implementation",
    "source metadata status differs",
  );
  const sourceFiles = sourceMetadata.files as Array<Record<string, unknown>>;
  assert(sourceFiles.length === 4, "four retained source metadata files are required");
  for (const file of sourceFiles) {
    const bytes = await Deno.readFile(new URL(String(file.path), ROOT));
    assert(
      await sha256(bytes) === file.sha256,
      `retained source metadata hash differs: ${file.path}`,
    );
  }

  const absentPaths = [
    "public/benchmarks/media-image-decode-batch-v1",
    "public/artifacts/media-image-decode-batch-v1",
    "public/evidence/v1-base/media-image-decode-batch-v1",
  ];
  for (const path of absentPaths) {
    try {
      await Deno.stat(new URL(path, ROOT));
      throw new Error(`blocked implementation path unexpectedly exists: ${path}`);
    } catch (error) {
      if (error instanceof Deno.errors.NotFound) continue;
      throw error;
    }
  }

  return {
    catalogSha256,
    publicCatalogSha256,
    expectedImages: 125,
    pinnedImages: 0,
    rawSha256Count: 0,
    blockerCodes,
    schemaCount: schemaPairs.length,
    sourceMetadataFileCount: sourceFiles.length,
  };
}

if (import.meta.main) {
  const result = await validateMediaImageDecodeBatchBlocker();
  console.log(JSON.stringify(result, null, 2));
}
