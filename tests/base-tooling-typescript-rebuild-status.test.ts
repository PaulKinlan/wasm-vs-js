import Ajv2020Module from "ajv2020";
import { sha256Hex } from "../lib/canonical.ts";
import {
  assessTypeScriptRebuildQualification,
} from "../scripts/check-typescript-rebuild-qualification.ts";
import { assert, assertEquals } from "./assert.ts";

const Ajv2020 = (Ajv2020Module as unknown as { default?: typeof Ajv2020Module }).default ??
  Ajv2020Module;
const statusPath = "benchmarks/base-v1/tooling-typescript-rebuild/implementation-status.v1.json";
const schemaPath = "schemas/base-v1-tooling-typescript-rebuild-status.schema.json";
const status = JSON.parse(await Deno.readTextFile(statusPath));
const schema = JSON.parse(await Deno.readTextFile(schemaPath));

function validator() {
  const ajv = new (Ajv2020 as unknown as new (options: Record<string, unknown>) => {
    compile: (schema: unknown) => ((value: unknown) => boolean) & { errors?: unknown };
  })({ allErrors: true, strict: false });
  return ajv.compile(schema);
}

Deno.test("TypeScript rebuild blocker record is closed, canonical and schema-valid", async () => {
  const validate = validator();
  assert(validate(status), JSON.stringify(validate.errors));
  assertEquals(await Deno.readTextFile(statusPath), `${JSON.stringify(status, null, 2)}\n`);

  const poisoned = structuredClone(status);
  poisoned.inventedImplementation = true;
  assert(!validate(poisoned), "closed schema accepted an undeclared implementation claim");
});

Deno.test("TypeScript rebuild blocker preserves the exact frozen-v1 workload", async () => {
  const catalogBytes = await Deno.readFile("catalog/workloads.v1.json");
  assertEquals(await sha256Hex(catalogBytes), status.frozenCatalog.sha256);
  assertEquals(
    catalogBytes,
    await Deno.readFile("public/data/workloads.v1.json"),
  );

  const catalog = JSON.parse(new TextDecoder().decode(catalogBytes));
  assertEquals(catalog.entries.length, 38);
  const entry = catalog.entries[status.frozenCatalog.entryIndex];
  assertEquals(entry.id, "tooling.typescript-rebuild.v1");
  assertEquals(
    entry.fixedWork.description,
    "One fixed edit, compiler options and normalized diagnostics/bundle checks.",
  );
  assertEquals(entry.oracle.equivalenceClass, "semantic-product-choice");
  assertEquals(catalog.implementationCoverage.implementedCatalogEntries, 0);
});

Deno.test("TypeScript rebuild remains unavailable instead of crediting a reduced bundler", () => {
  assertEquals(status.coverage.countsAsImplementedCatalogEntry, false);
  assertEquals(status.coverage.controlledPairAvailable, false);
  assertEquals(status.coverage.validationRecords, 0);
  assertEquals(status.coverage.interactiveDemoRoute, null);
  assertEquals(status.qualification.qualifiedTarget, null);

  assertEquals(status.requiredContract.moduleCount, 1000);
  assertEquals(status.requiredContract.fixedEditCount, 1);
  assert(
    status.requiredContract.requiredTargetCapabilities.includes("typescript-semantic-typechecker"),
  );
  assert(status.requiredContract.requiredTargetCapabilities.includes("bundle-construction"));
  assert(status.requiredContract.requiredCounters.includes("modules-rechecked"));
  assert(status.requiredContract.requiredCounters.includes("boundary-crossings"));

  const rejected = new Map(
    status.qualification.candidateDispositions.map(
      (candidate: { candidate: string; disposition: string }) => [
        candidate.candidate,
        candidate.disposition,
      ],
    ),
  );
  assertEquals(rejected.get("esbuild-wasm"), "rejected-for-controlled-pair");
  assertEquals(rejected.get("swc-wasm"), "rejected-for-controlled-pair");
  assertEquals(
    rejected.get("typescript-running-inside-a-javascript-wasm-runtime"),
    "rejected-for-controlled-pair",
  );
  assert(status.blocker.doesNotQualify.includes("reduced module count or omitted typechecking"));
});

Deno.test("TypeScript rebuild repository qualification probe fails closed", async () => {
  const assessment = await assessTypeScriptRebuildQualification(".");
  assertEquals(assessment.workloadId, "tooling.typescript-rebuild.v1");
  assertEquals(assessment.qualified, false);
  assertEquals(assessment.countsAsImplementedCatalogEntry, false);
  assertEquals(assessment.recordMatchesRepository, true);
  assertEquals(assessment.requirements.length, 5);
  assert(assessment.requirements.every((requirement) => !requirement.observedPresent));
});
