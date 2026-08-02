import Ajv2020Module from "ajv2020";
import { assert, assertEquals } from "../assert.ts";
import {
  FROZEN_V1_REFERENCE,
  validateProposalCatalogSemantics,
} from "../../benchmarks/v2/shared/workload-contract.js";

type ValidationError = { instancePath?: string; message?: string };
type Validator = ((value: unknown) => boolean) & { errors?: ValidationError[] | null };
type AjvInstance = { compile: (schema: unknown) => Validator };
type AjvConstructor = new (options?: Record<string, unknown>) => AjvInstance;

const Ajv2020 = ((Ajv2020Module as unknown as { default?: AjvConstructor }).default ??
  Ajv2020Module) as unknown as AjvConstructor;
const ajv = new Ajv2020({ allErrors: true, strict: false });
const schema = JSON.parse(
  await Deno.readTextFile("schemas/workload-catalog-v2-proposal.schema.json"),
);
const validateSchema = ajv.compile(schema);
const catalog = JSON.parse(await Deno.readTextFile("catalog/workloads.v2.proposed.json"));
const v1Catalog = JSON.parse(await Deno.readTextFile("catalog/workloads.v1.json"));

async function sha256(path: string): Promise<string> {
  const bytes = await Deno.readFile(path);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return [...new Uint8Array(digest)].map((value) => value.toString(16).padStart(2, "0")).join("");
}

function assertSchemaRejects(value: unknown, message: string): void {
  assert(!validateSchema(value), `${message}: proposal schema accepted mutation`);
}

Deno.test("v2 proposal roster validates as a closed, proposal-only catalog", () => {
  assert(validateSchema(catalog), JSON.stringify(validateSchema.errors));
  const semantic = validateProposalCatalogSemantics(catalog, v1Catalog.entries);
  assert(semantic.ok, semantic.errors.join("; "));
  assertEquals(catalog.proposalCount, 20);
  assertEquals(catalog.prospectiveEntryCount, 58);
  assert(catalog.entries.every((entry: { status: string }) => entry.status === "proposed"));
  assert(catalog.entries.every((entry: { stage: string }) => entry.stage === "contract-draft"));
});

Deno.test("proposal roster covers only the requested families and cases", () => {
  const expected = [
    "audio.fft.v1",
    "audio.fir.v1",
    "audio.stft.v1",
    "dom.dependent-form-validation.v1",
    "dom.grid-movement.v1",
    "dom.keyed-list-mutation.v1",
    "dom.nested-tree-mutation.v1",
    "dom.table-sort-filter-pagination.v1",
    "dom.vdom-diff-patch.v1",
    "dom.virtualized-scrolling.v1",
    "game.canvas-arcade.v1",
    "game.canvas-entity-pathfinding.v1",
    "game.dom-tactics-grid.v1",
    "image.editing-pipeline.v1",
    "image.flood-fill.v1",
    "ml.dense-mlp.v1",
    "ml.gemm.v1",
    "text.diff-patch.v1",
    "text.markdown-cms.v1",
    "text.regex-engine-duel.v1",
  ];
  assertEquals(catalog.entries.map((entry: { id: string }) => entry.id), expected);
  const familyCounts = Object.fromEntries(
    ["games", "dom", "dsp", "neural", "image", "traditional-web"].map((family) => [
      family,
      catalog.entries.filter((entry: { family: string }) => entry.family === family).length,
    ]),
  );
  assertEquals(familyCounts, {
    games: 3,
    dom: 6,
    dsp: 3,
    neural: 2,
    image: 2,
    "traditional-web": 4,
  });
});

Deno.test("proposal references the byte-identical frozen v1 catalog and schema", async () => {
  assertEquals(catalog.inheritedV1, FROZEN_V1_REFERENCE);
  assertEquals(await sha256(FROZEN_V1_REFERENCE.catalogPath), FROZEN_V1_REFERENCE.catalogSha256);
  assertEquals(await sha256(FROZEN_V1_REFERENCE.schemaPath), FROZEN_V1_REFERENCE.schemaSha256);
  assertEquals(v1Catalog.entries.length, FROZEN_V1_REFERENCE.entryCount);

  const v1Ids = new Set(v1Catalog.entries.map((entry: { id: string }) => entry.id));
  for (const entry of catalog.entries) {
    assert(!v1Ids.has(entry.id), `${entry.id} changes a frozen v1 row`);
    assert(
      entry.v1CoverageReferences.every((id: string) => v1Ids.has(id)),
      `${entry.id} has an unknown v1 coverage reference`,
    );
  }

  const poisoned = structuredClone(catalog);
  poisoned.inheritedV1.catalogSha256 = "0".repeat(64);
  const result = validateProposalCatalogSemantics(poisoned, v1Catalog.entries);
  assert(!result.ok, "changed v1 reference was accepted");
});

Deno.test("proposal schema closes input, oracle, work, phase, and track contracts", () => {
  const mutations: Array<[string, (value: typeof catalog) => void]> = [
    ["root", (value) => value.publicRoute = "/data/workloads.v2.json"],
    ["entry", (value) => value.entries[0].implementation = "not allowed"],
    ["input", (value) => value.entries[0].input.runtimeRandom = true],
    ["oracle", (value) => value.entries[0].oracle.unboundedError = true],
    ["work", (value) => value.entries[0].work.adaptiveDuration = true],
    ["phase", (value) => value.entries[0].phases.paint = "measured"],
    ["track", (value) => value.entries[0].tracks[0].framework = "target-specific"],
  ];
  for (const [name, mutate] of mutations) {
    const poisoned = structuredClone(catalog);
    mutate(poisoned);
    assertSchemaRejects(poisoned, name);
  }
});

Deno.test("proposal variants bind target and algorithm identity without orphan arrays", () => {
  for (const entry of catalog.entries) {
    for (const track of entry.tracks) {
      assert(!("targets" in track), `${entry.id} retains an orphan target array`);
      assert(!("variantIds" in track), `${entry.id} retains an orphan variant-id array`);
      assert(track.variants.length === 2, `${entry.id} track does not bind two variants`);
      for (const variant of track.variants) {
        assert(variant.id && variant.target && variant.algorithmFamilyId);
      }
    }
  }
});

Deno.test("proposal semantic validation rejects duplicate IDs, algorithm reuse, unknown v1 links, and variable work", () => {
  const mutations: Array<[string, (value: typeof catalog) => void]> = [
    ["duplicate id", (value) => value.entries[1].id = value.entries[0].id],
    ["duplicate slug", (value) => value.entries[1].benchmarkSlug = value.entries[0].benchmarkSlug],
    ["unknown v1 link", (value) => value.entries[0].v1CoverageReferences[0] = "missing.v1"],
    ["variable work", (value) => value.entries[0].work.timeLimited = true],
    [
      "track equivalence",
      (value) => value.entries[0].tracks[0].algorithmEquivalence = "separate-family",
    ],
    [
      "algorithm identity reuse",
      (value) => {
        value.entries[1].tracks[0].variants[0].algorithmFamilyId =
          value.entries[0].tracks[0].variants[0].algorithmFamilyId;
      },
    ],
  ];
  for (const [name, mutate] of mutations) {
    const poisoned = structuredClone(catalog);
    mutate(poisoned);
    const result = validateProposalCatalogSemantics(poisoned, v1Catalog.entries);
    assert(!result.ok, `${name} mutation was accepted`);
  }
});

Deno.test("proposal catalog cannot carry performance claims", () => {
  const declared = structuredClone(catalog);
  declared.entries[0].performanceClaims.push("claim");
  assertSchemaRejects(declared, "declared performance claim");

  const prose = structuredClone(catalog);
  prose.entries[0].tracks[1].contract = "The optimized variant is faster.";
  assert(validateSchema(prose), JSON.stringify(validateSchema.errors));
  const result = validateProposalCatalogSemantics(prose, v1Catalog.entries);
  assert(!result.ok, "performance-claim wording was accepted");
  assert(result.errors.some((error) => error.includes("performance-claim language")));
});
