import { assert, assertEquals, assertRejects } from "./assert.ts";
import { assertAggregationComparable, validateCatalog } from "../lib/catalog.ts";

const catalog = JSON.parse(await Deno.readTextFile("catalog/workloads.v1.json"));

Deno.test("frozen workload denominator validates and reconciles exact coverage", () => {
  const result = validateCatalog(catalog);
  assert(result.ok, result.errors.join("; "));
  assertEquals(catalog.entries.length, 38);
  assertEquals(
    catalog.entries.filter((entry: { priority: string }) => entry.priority === "P0").length,
    12,
  );
  assertEquals(
    catalog.entries.filter((entry: { priority: string }) => entry.priority === "P1").length,
    12,
  );
  assertEquals(
    catalog.entries.filter((entry: { priority: string }) => entry.priority === "P2").length,
    14,
  );
  assertEquals(catalog.implementationCoverage.implementedSlices, 1);
  assertEquals(catalog.implementationCoverage.implementedCatalogEntries, 0);
  assert(catalog.entries.every((entry: { status: string }) => entry.status === "proposed"));
});

Deno.test("catalog rejects frozen fixtures without audited rights and provenance", () => {
  const poisoned = structuredClone(catalog);
  poisoned.entries[0].inputs[0].fixtureState = "frozen";
  poisoned.entries[0].inputs[0].sha256 = "0".repeat(64);
  const result = validateCatalog(poisoned);
  assert(!result.ok, "unaudited frozen fixture was accepted");
  assert(result.errors.some((error) => error.includes("freezes input without audited rights")));
});

Deno.test("algorithm aggregates reject family mismatch and product-choice comparisons", async () => {
  const algorithmEntries = catalog.entries.filter((
    entry: { oracle: { equivalenceClass: string } },
  ) => entry.oracle.equivalenceClass !== "semantic-product-choice");
  const first = algorithmEntries[0];
  const different = algorithmEntries.find((entry: { oracle: { algorithmFamily: string } }) =>
    entry.oracle.algorithmFamily !== first.oracle.algorithmFamily
  );
  await assertRejects(
    () => Promise.resolve().then(() => assertAggregationComparable([first, different])),
    "algorithm-family mismatch",
  );
  const productChoice = catalog.entries.find((entry: { oracle: { equivalenceClass: string } }) =>
    entry.oracle.equivalenceClass === "semantic-product-choice"
  );
  await assertRejects(
    () => Promise.resolve().then(() => assertAggregationComparable([productChoice, productChoice])),
    "product-choice workload",
  );
});

Deno.test("catalog algorithm families and rights remain explicit and single-choice", () => {
  type Entry = {
    id: string;
    oracle: { algorithmFamily: string };
    fixedWork: { description: string };
    priorArt: Array<{ name: string; licenseSpdx: string }>;
  };
  const byId = new Map<string, Entry>(
    catalog.entries.map((entry: Entry) => [entry.id, entry]),
  );
  const compression = byId.get("compression.zstd-gzip-roundtrip.v1");
  const hashing = byId.get("crypto.file-integrity.v1");
  const nbody = byId.get("simulation.nbody-cloth.v1");
  const pdf = byId.get("document.pdf-viewer.v1");
  const keyword = byId.get("ml.keyword-spotting.v1");
  assert(compression && hashing && nbody && pdf && keyword, "required workload missing");
  assertEquals(compression.oracle.algorithmFamily, "zstd-fixed-level-roundtrip");
  assert(!JSON.stringify(compression.fixedWork).toLowerCase().includes("gzip"));
  assertEquals(hashing.oracle.algorithmFamily, "sha256-fixed-chunk-schedule");
  assert(!JSON.stringify(hashing.fixedWork).toLowerCase().includes("blake3"));
  assertEquals(nbody.oracle.algorithmFamily, "nbody-direct-n2-leapfrog");
  assert(!JSON.stringify(nbody.fixedWork).toLowerCase().includes("cloth"));
  assert(
    !JSON.stringify(catalog).includes('"licenseSpdx": "LicenseRef-Public-Domain"'),
    "catalog asserts unsupported public-domain rights",
  );
  assert(
    pdf.priorArt.some((item) =>
      item.name === "PDFium" && item.licenseSpdx === "LicenseRef-PDFium-Mixed-Per-File"
    ),
  );
  assert(
    keyword.priorArt.some((item) =>
      item.name === "MLPerf Tiny paper" &&
      item.licenseSpdx === "LicenseRef-ArXiv-Nonexclusive-Distribution"
    ),
  );
});

Deno.test("coverage rejects count, status, reference, and stage contradictions", () => {
  const mutations: Array<[string, (value: typeof catalog) => void]> = [
    ["slice count", (value) => value.implementationCoverage.implementedSlices = 2],
    ["slice status", (value) => value.implementationCoverage.slices[0].status = "proposed"],
    [
      "unknown entry",
      (value) => value.implementationCoverage.slices[0].catalogEntry = "missing.workload.v1",
    ],
    [
      "implemented coverage without entry status",
      (value) => {
        value.implementationCoverage.slices[0].catalogEntry = value.entries[0].id;
        value.implementationCoverage.implementedCatalogEntries = 1;
      },
    ],
    [
      "implemented entry at proposal stage",
      (value) => {
        value.entries[0].status = "implemented";
        value.implementationCoverage.slices[0].catalogEntry = value.entries[0].id;
        value.implementationCoverage.implementedCatalogEntries = 1;
      },
    ],
    [
      "unexplained null catalog entry",
      (value) => value.implementationCoverage.slices[0].note = "outside",
    ],
  ];
  for (const [name, mutate] of mutations) {
    const poisoned = structuredClone(catalog);
    mutate(poisoned);
    const result = validateCatalog(poisoned);
    assert(!result.ok, `${name} mutation was accepted`);
  }
});

Deno.test("closed catalog schema rejects undeclared evidence fields", () => {
  const poisoned = structuredClone(catalog);
  poisoned.entries[0].inputs[0].secret = "must fail";
  const result = validateCatalog(poisoned);
  assert(!result.ok, "additional catalog input field was accepted");
});
