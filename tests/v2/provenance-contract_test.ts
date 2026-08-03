import Ajv2020Module from "ajv2020";
import addFormatsModule from "ajv-formats";
import { assert, assertEquals } from "../assert.ts";
import { validateProposalProvenanceSemantics } from "../../benchmarks/v2/shared/provenance-contract.js";
import {
  inspectabilityFromResultRecord,
  inspectabilityRows,
  validateInspectabilityManifest,
} from "../../public/inspectability.js";

type ValidationError = { instancePath?: string; message?: string };
type Validator = ((value: unknown) => boolean) & { errors?: ValidationError[] | null };
type AjvInstance = { compile: (schema: unknown) => Validator };
type AjvConstructor = new (options?: Record<string, unknown>) => AjvInstance;
type AddFormats = (ajv: AjvInstance) => void;

const Ajv2020 = ((Ajv2020Module as unknown as { default?: AjvConstructor }).default ??
  Ajv2020Module) as unknown as AjvConstructor;
const addFormats = ((addFormatsModule as unknown as { default?: AddFormats }).default ??
  addFormatsModule) as unknown as AddFormats;
const ajv = new Ajv2020({ allErrors: true, strict: false });
addFormats(ajv);
const schema = JSON.parse(
  await Deno.readTextFile("schemas/workload-result-v2-proposal.schema.json"),
);
const validateSchema = ajv.compile(schema);
const catalog = JSON.parse(await Deno.readTextFile("catalog/workloads.v2.proposed.json"));

async function sha256(path: string): Promise<string> {
  const bytes = await Deno.readFile(path);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return [...new Uint8Array(digest)].map((value) => value.toString(16).padStart(2, "0")).join("");
}

async function currentCommit(): Promise<string> {
  const command = new Deno.Command("git", {
    args: ["rev-parse", "HEAD"],
    stdout: "piped",
    stderr: "piped",
  });
  const output = await command.output();
  assert(output.success, new TextDecoder().decode(output.stderr));
  return new TextDecoder().decode(output.stdout).trim();
}

async function validRecord() {
  const commit = await currentCommit();
  const repository = "https://github.com/PaulKinlan/wasm-vs-js";
  const ref = async (path: string) => ({
    path,
    sha256: await sha256(path),
    immutableUrl: `${repository}/blob/${commit}/${path}`,
  });
  const entry = catalog.entries.find((candidate: { family: string }) => candidate.family !== "dsp");
  assert(entry, "non-audio generic provenance fixture entry missing");
  const track = entry.tracks[0];
  const variant = track.variants[0];
  const catalogFile = await ref("catalog/workloads.v2.proposed.json");
  const workloadContractFile = await ref("benchmarks/v2/shared/workload-contract.js");
  const resultContractFile = await ref("schemas/workload-result-v2-proposal.schema.json");
  const jsSource = {
    role: "javascript-authored",
    ...await ref("benchmarks/sum-u32/js.ts"),
  };
  const wasmSource = {
    role: "wasm-authored",
    ...await ref("benchmarks/sum-u32/sum-u32.wat"),
  };
  const generator = await ref("benchmarks/sum-u32/workload.js");
  const reference = await ref("tests/workload.test.ts");
  const oracle = await ref("schemas/benchmark.schema.json");
  const fixtureManifest = await ref("benchmarks/sum-u32/benchmark.json");
  const inputManifest = await ref("public/artifacts/sum-u32/build-manifest.json");
  const outputManifest = await ref("public/evidence/v1/acceptance.json");
  const recipe = await ref("scripts/build.ts");
  const lock = await ref("deno.lock");
  const artifact = {
    id: "sum-u32-wasm",
    ...await ref("public/artifacts/sum-u32/sum-u32.wasm"),
    mediaType: "application/wasm",
  };
  const resourcePaths = [
    catalogFile,
    workloadContractFile,
    resultContractFile,
    jsSource,
    wasmSource,
    generator,
    reference,
    oracle,
    fixtureManifest,
    inputManifest,
    outputManifest,
    recipe,
    lock,
    artifact,
  ].map((item) => item.path).sort();

  return {
    schemaVersion: 1,
    contractId: "workload-result-v2-proposal-v1",
    status: "proposal-validation-only",
    workloadCatalog: {
      catalogId: catalog.catalogId,
      file: catalogFile,
    },
    workloadContract: {
      contractId: catalog.workloadContract.contractId,
      file: workloadContractFile,
    },
    resultContract: {
      contractId: catalog.resultContract.contractId,
      file: resultContractFile,
    },
    source: { repository, commit },
    workload: {
      entryId: entry.id,
      benchmarkSlug: entry.benchmarkSlug,
      variant: {
        id: variant.id,
        target: variant.target,
        track: track.track,
        algorithmFamilyId: variant.algorithmFamilyId,
      },
    },
    provenance: {
      sources: [jsSource, wasmSource],
      generator,
      reference,
      oracle,
      manifests: {
        fixture: fixtureManifest,
        input: inputManifest,
        output: outputManifest,
      },
      build: {
        recipe,
        cwd: ".",
        command: ["deno", "task", "build"],
        locks: [lock],
        toolchain: [
          { name: "deno", version: Deno.version.deno },
          { name: "typescript", version: Deno.version.typescript },
        ],
        flags: {
          compiler: ["proposal-test-fixture"],
          linker: [],
          runtime: ["--allow-read=.", "--allow-write=public/artifacts"],
        },
        environment: [{ name: "WASM_VS_JS_PROPOSAL", value: "validation-only" }],
      },
      artifacts: [artifact],
    },
    semanticCoverage: {
      inputParameterIds: entry.input.parameters.map((parameter: { name: string }) =>
        parameter.name
      ),
      oracleCheckIds: entry.oracle.checks.map((check: { id: string }) => check.id),
      workCounterIds: [...entry.work.counters],
      phaseIds: Object.keys(entry.phases),
      missingCellIds: entry.missingCells.map((cell: { cell: string }) => cell.cell),
    },
    collisionGuards: {
      workloadVariantKey: `${entry.id}/${variant.id}`,
      algorithmIdentityKey: variant.algorithmFamilyId,
      resourcePaths,
      artifactIds: [artifact.id],
    },
    correctness: {
      status: "passed",
      oracleCheckIds: entry.oracle.checks.map((check: { id: string }) => check.id),
      outputManifestSha256: outputManifest.sha256,
    },
    performanceClaims: [],
  };
}

function assertSchemaRejects(value: unknown, message: string): void {
  assert(!validateSchema(value), `${message}: result schema accepted mutation`);
}

Deno.test("closed proposal provenance binds catalog, contracts, commit, variant, sources, build, artifacts, and coverage", async () => {
  const record = await validRecord();
  assert(validateSchema(record), JSON.stringify(validateSchema.errors));
  const result = await validateProposalProvenanceSemantics(record, catalog, {
    repoRoot: ".",
    expectedSourceCommit: await currentCommit(),
    requireLocalFiles: true,
  });
  assert(result.ok, result.errors.join("; "));
});

Deno.test("proposal provenance rejects missing authored source roles and null manifests", async () => {
  const missingRole = await validRecord();
  missingRole.provenance.sources[0].role = "shared-support";
  assert(validateSchema(missingRole), JSON.stringify(validateSchema.errors));
  const roleResult = await validateProposalProvenanceSemantics(missingRole, catalog);
  assert(!roleResult.ok, "missing JavaScript-authored role was accepted");

  const nullManifest = JSON.parse(JSON.stringify(await validRecord()));
  nullManifest.provenance.manifests.input = null;
  assertSchemaRejects(nullManifest, "null input manifest");
});

Deno.test("proposal provenance rejects mutable or inconsistent immutable links", async () => {
  const mutable = await validRecord();
  mutable.provenance.sources[0].immutableUrl =
    "https://github.com/PaulKinlan/wasm-vs-js/blob/main/benchmarks/sum-u32/js.ts";
  assertSchemaRejects(mutable, "mutable source link");

  const wrongPath = await validRecord();
  wrongPath.provenance.sources[0].immutableUrl =
    `${wrongPath.source.repository}/blob/${wrongPath.source.commit}/benchmarks/sum-u32/input.ts`;
  assert(validateSchema(wrongPath), JSON.stringify(validateSchema.errors));
  const linkResult = await validateProposalProvenanceSemantics(wrongPath, catalog);
  assert(!linkResult.ok, "path-inconsistent source link was accepted");
});

Deno.test("proposal provenance rejects target and algorithm identity mismatches", async () => {
  for (const field of ["target", "algorithmFamilyId"] as const) {
    const poisoned = await validRecord();
    poisoned.workload.variant[field] = field === "target" ? "wasm-linear" : "reused-family-v1";
    assert(validateSchema(poisoned), JSON.stringify(validateSchema.errors));
    const result = await validateProposalProvenanceSemantics(poisoned, catalog);
    assert(!result.ok, `${field} mismatch was accepted`);
  }
});

Deno.test("proposal provenance rejects source commit and locally resolvable hash inconsistencies", async () => {
  const wrongCommit = await validRecord();
  wrongCommit.source.commit = "0".repeat(40);
  assert(validateSchema(wrongCommit), JSON.stringify(validateSchema.errors));
  const commitResult = await validateProposalProvenanceSemantics(wrongCommit, catalog, {
    expectedSourceCommit: await currentCommit(),
  });
  assert(!commitResult.ok, "wrong inspected source commit was accepted");

  const poisoned = await validRecord();
  poisoned.provenance.sources[0].sha256 = "0".repeat(64);
  assert(validateSchema(poisoned), JSON.stringify(validateSchema.errors));
  const result = await validateProposalProvenanceSemantics(poisoned, catalog, {
    repoRoot: ".",
    expectedSourceCommit: await currentCommit(),
    requireLocalFiles: true,
  });
  assert(!result.ok, "locally inconsistent source hash was accepted");
  assert(result.errors.some((error) => error.includes("local hash does not match provenance")));
});

Deno.test("proposal provenance rejects incomplete semantic coverage and collision guards", async () => {
  const coverage = await validRecord();
  coverage.semanticCoverage.workCounterIds.pop();
  const coverageResult = await validateProposalProvenanceSemantics(coverage, catalog);
  assert(!coverageResult.ok, "incomplete work-counter coverage was accepted");

  const collision = await validRecord();
  collision.collisionGuards.resourcePaths.pop();
  const collisionResult = await validateProposalProvenanceSemantics(collision, catalog);
  assert(!collisionResult.ok, "incomplete resource collision guard was accepted");
});

Deno.test("accepted v2 result provenance renders its own commit-pinned inspectability rows", async () => {
  const record = await validRecord();
  assert(validateSchema(record), JSON.stringify(validateSchema.errors));
  const inspectability = inspectabilityFromResultRecord(record);
  const result = validateInspectabilityManifest(inspectability);
  assert(result.ok, result.errors.join("; "));
  const rows = inspectabilityRows(inspectability);
  const hrefs = rows.flatMap((row) => row.links.map((item: { href: string }) => item.href));
  const immutableHrefs = hrefs.filter((href) => href.startsWith("https://github.com/"));
  assert(immutableHrefs.length > 0);
  assert(immutableHrefs.every((href) => href.includes(record.source.commit)));
  assert(rows.some((row) => row.term === "Executed JavaScript" && row.code));
  assert(rows.some((row) => row.term === "Authored WebAssembly" && row.code));
  assert(
    rows.some((row) => row.term === "Build manifest" && row.availability.state === "unavailable"),
  );
});

Deno.test("proposal provenance closes structured build and artifact fields", async () => {
  const build = JSON.parse(JSON.stringify(await validRecord()));
  build.provenance.build.compilerVersion = "mutable prose";
  assertSchemaRejects(build, "undeclared build field");

  const artifact = JSON.parse(JSON.stringify(await validRecord()));
  artifact.provenance.artifacts[0].mediaType = null;
  assertSchemaRejects(artifact, "null artifact media type");

  const exact = await validRecord();
  assertEquals(exact.workloadCatalog.file.sha256, await sha256(exact.workloadCatalog.file.path));
  assertEquals(exact.workloadContract.file.sha256, await sha256(exact.workloadContract.file.path));
  assertEquals(exact.resultContract.file.sha256, await sha256(exact.resultContract.file.path));
});
