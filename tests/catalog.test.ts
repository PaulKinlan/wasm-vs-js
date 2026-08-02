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

Deno.test("closed catalog schema rejects undeclared evidence fields", () => {
  const poisoned = structuredClone(catalog);
  poisoned.entries[0].inputs[0].secret = "must fail";
  const result = validateCatalog(poisoned);
  assert(!result.ok, "additional catalog input field was accepted");
});
