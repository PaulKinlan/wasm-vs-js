import Ajv2020Module from "ajv2020";
import {
  FROZEN_V1_SHA256,
  REQUIRED_FORMATS,
  validateMediaImageDecodeBatchBlocker,
} from "../lib/media-image-decode-batch-blocker.ts";

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

const Ajv2020 = (Ajv2020Module as unknown as { default?: typeof Ajv2020Module }).default ??
  Ajv2020Module;
type Validator = ((value: unknown) => boolean) & { errors?: unknown };

const closedRecords = [
  [
    "benchmarks/v1/media-image-decode-batch/blocker.v1.json",
    "schemas/media-image-decode-batch-blocker.schema.json",
  ],
  [
    "benchmarks/v1/media-image-decode-batch/fixture-rights-audit.v1.json",
    "schemas/media-image-decode-batch-fixture-rights-audit.schema.json",
  ],
  [
    "benchmarks/v1/media-image-decode-batch/codec-feasibility-audit.v1.json",
    "schemas/media-image-decode-batch-codec-feasibility-audit.schema.json",
  ],
  [
    "benchmarks/v1/media-image-decode-batch/source-metadata-manifest.v1.json",
    "schemas/media-image-decode-batch-source-metadata-manifest.schema.json",
  ],
] as const;

function compile(schema: unknown): Validator {
  const ajv = new (Ajv2020 as unknown as new (options: Record<string, unknown>) => {
    compile: (schema: unknown) => Validator;
  })({ allErrors: true, strict: false });
  return ajv.compile(schema);
}

function clone<T>(value: T): T {
  return structuredClone(value);
}

Deno.test("media image decode batch remains an explicit non-coverage blocker", async () => {
  const result = await validateMediaImageDecodeBatchBlocker();
  assert(result.catalogSha256 === FROZEN_V1_SHA256, "catalog hash differs");
  assert(result.publicCatalogSha256 === FROZEN_V1_SHA256, "public catalog hash differs");
  assert(result.expectedImages === 125, "expected image count differs");
  assert(result.pinnedImages === 0, "blocked package must not claim fixtures");
  assert(result.rawSha256Count === 0, "blocked package must not claim hashes");
  assert(
    result.blockerCodes.includes("fixture-rights-and-selection-unresolved"),
    "rights blocker missing",
  );
  assert(
    result.blockerCodes.includes("genuine-javascript-jxl-decoder-unavailable"),
    "JavaScript JXL blocker missing",
  );
  assert(result.schemaCount === 4, "closed schema count differs");
  assert(result.sourceMetadataFileCount === 4, "retained source metadata count differs");
});

Deno.test("all image decode blocker records pass their fully closed schemas", async () => {
  for (const [recordPath, schemaPath] of closedRecords) {
    const record = JSON.parse(await Deno.readTextFile(recordPath));
    const schema = JSON.parse(await Deno.readTextFile(schemaPath));
    const validate = compile(schema);
    assert(validate(record), `${recordPath} schema errors: ${JSON.stringify(validate.errors)}`);
  }
});

Deno.test("closed schemas reject missing required fields and additional properties", async () => {
  for (const [recordPath, schemaPath] of closedRecords) {
    const record = JSON.parse(await Deno.readTextFile(recordPath)) as Record<string, unknown>;
    const schema = JSON.parse(await Deno.readTextFile(schemaPath));
    const validate = compile(schema);
    for (const key of Object.keys(record)) {
      const missing = clone(record);
      delete missing[key];
      assert(!validate(missing), `${schemaPath} accepted missing required field ${key}`);
    }
    const extra = clone(record);
    extra.undeclared = true;
    assert(!validate(extra), `${schemaPath} accepted an additional top-level property`);
  }
});

Deno.test("closed schemas reject nested additions and vacuous coverage", async () => {
  const blocker = JSON.parse(
    await Deno.readTextFile(closedRecords[0][0]),
  ) as Record<string, unknown>;
  const blockerSchema = JSON.parse(await Deno.readTextFile(closedRecords[0][1]));
  const validateBlocker = compile(blockerSchema);
  const emptyCoverage = clone(blocker);
  emptyCoverage.coverage = {};
  assert(!validateBlocker(emptyCoverage), "blocker schema accepted empty coverage");
  const missingCoverage = clone(blocker) as { coverage: Record<string, unknown> };
  delete missingCoverage.coverage.interactiveDemo;
  assert(!validateBlocker(missingCoverage), "blocker schema accepted missing coverage field");
  const extraCoverage = clone(blocker) as { coverage: Record<string, unknown> };
  extraCoverage.coverage.undeclared = false;
  assert(!validateBlocker(extraCoverage), "blocker schema accepted added coverage field");

  const nestedMutations: Array<[number, (record: Record<string, unknown>) => void]> = [
    [0, (record) => ((record.fixedContract as Record<string, unknown>).undeclared = true)],
    [0, (record) => ((record.blockers as Array<Record<string, unknown>>)[0].undeclared = true)],
    [1, (record) => ((record.selectionPolicy as Record<string, unknown>).undeclared = true)],
    [
      1,
      (record) => ((record.formatSets as Array<Record<string, unknown>>)[0].undeclared = true),
    ],
    [1, (record) => ((record.catalogEvidence as Record<string, unknown>).undeclared = true)],
    [2, (record) => ((record.requirements as Record<string, unknown>).undeclared = true)],
    [
      2,
      (record) => ((record.controlledTargets as Record<string, Record<string, unknown>>).javascript
        .undeclared = true),
    ],
    [
      2,
      (record) => ((record.candidateChecks as Array<Record<string, unknown>>)[0].undeclared = true),
    ],
    [2, (record) => ((record.hostBaseline as Record<string, unknown>).undeclared = true)],
    [3, (record) => ((record.files as Array<Record<string, unknown>>)[0].undeclared = true)],
  ];
  for (const [index, mutate] of nestedMutations) {
    const [recordPath, schemaPath] = closedRecords[index];
    const record = JSON.parse(await Deno.readTextFile(recordPath)) as Record<string, unknown>;
    const validate = compile(JSON.parse(await Deno.readTextFile(schemaPath)));
    mutate(record);
    assert(!validate(record), `${schemaPath} accepted an additional nested property`);
  }
});

Deno.test("media image decode batch requires all five formats without substitutions", async () => {
  const audit = JSON.parse(
    await Deno.readTextFile(
      new URL(
        "../benchmarks/v1/media-image-decode-batch/fixture-rights-audit.v1.json",
        import.meta.url,
      ),
    ),
  ) as {
    selectionPolicy: {
      formats: string[];
      imagesPerFormat: number;
      mixedRightsHeicExcluded: boolean;
      substitutionsAllowed: boolean;
    };
    formatSets: Array<{ format: string; expectedCount: number; rawSha256: string[] }>;
  };
  assert(
    JSON.stringify(audit.selectionPolicy.formats) === JSON.stringify(REQUIRED_FORMATS),
    "formats differ",
  );
  assert(audit.selectionPolicy.imagesPerFormat === 25, "per-format count differs");
  assert(audit.selectionPolicy.mixedRightsHeicExcluded, "HEIC exclusion missing");
  assert(!audit.selectionPolicy.substitutionsAllowed, "substitutions must be forbidden");
  assert(audit.formatSets.every((set) => set.expectedCount === 25), "format count differs");
  assert(audit.formatSets.every((set) => set.rawSha256.length === 0), "hashes were fabricated");
});

Deno.test("retained JXL source metadata supports only the narrow inspected-candidate claim", async () => {
  const root = "benchmarks/v1/media-image-decode-batch/source-metadata";
  const jxlPackage = JSON.parse(
    await Deno.readTextFile(`${root}/jxl.js-1.0.3-package.json.raw`),
  ) as { description: string; files: string[] };
  assert(
    jxlPackage.description === "JPEG XL decoder in JavaScript using WebAssembly",
    "retained jxl.js description differs",
  );
  assert(jxlPackage.files.some((entry) => entry.includes(".wasm")), "jxl.js Wasm files missing");
  const icodecPackage = JSON.parse(
    await Deno.readTextFile(`${root}/icodec-9a81cb4-package.json.raw`),
  ) as { description: string };
  assert(
    icodecPackage.description === "Image encoders & decoders built with WebAssembly",
    "retained icodec description differs",
  );
  const icodecJxlSource = await Deno.readTextFile(`${root}/icodec-9a81cb4-jxl.ts.raw`);
  assert(
    icodecJxlSource.includes('"../dist/jxl-dec.js"'),
    "retained icodec JXL Wasm import differs",
  );
});

Deno.test("media image decode batch rejects Wasm-backed JavaScript and native baselines", async () => {
  const audit = JSON.parse(
    await Deno.readTextFile(
      new URL(
        "../benchmarks/v1/media-image-decode-batch/codec-feasibility-audit.v1.json",
        import.meta.url,
      ),
    ),
  ) as {
    controlledTargets: { javascript: { status: string; blockingFormat: string } };
    candidateChecks: Array<{
      name: string;
      executionTechnology: string;
      javascriptTargetEligible: boolean | string;
    }>;
    hostBaseline: { controlledJavaScriptEligible: boolean };
  };
  assert(audit.controlledTargets.javascript.status === "blocked", "JavaScript target must block");
  assert(audit.controlledTargets.javascript.blockingFormat === "jxl", "blocking format differs");
  for (const name of ["icodec", "jxl.js", "avif.js"]) {
    const candidate = audit.candidateChecks.find((item) => item.name === name);
    assert(candidate, `${name} audit missing`);
    assert(candidate.javascriptTargetEligible === false, `${name} must not count as JavaScript`);
  }
  assert(!audit.hostBaseline.controlledJavaScriptEligible, "native decode must stay separate");
});
