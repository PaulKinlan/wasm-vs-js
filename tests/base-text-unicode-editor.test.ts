import Ajv2020Module from "ajv2020";
import { assert, assertEquals, assertRejects } from "./assert.ts";
import { sha256Hex } from "../lib/canonical.ts";
import {
  caseFold,
  graphemeBoundaries,
  normalize,
  runUnicodeEditor,
  type UnicodeTables,
} from "../benchmarks/base/text-unicode-editor/workload.ts";
import {
  codePointCount,
  CORPUS_CODE_POINTS,
  generateUnicodeEditorCorpus,
} from "../benchmarks/base/text-unicode-editor/corpus.ts";

const registrationPath = "catalog/base-text-unicode-editor-implementation.v1.json";
const registration = JSON.parse(await Deno.readTextFile(registrationPath));
const schema = JSON.parse(
  await Deno.readTextFile("schemas/base-workload-implementation.schema.json"),
);
const Ajv2020 = (Ajv2020Module as unknown as { default?: typeof Ajv2020Module }).default ??
  Ajv2020Module;
const validate = new (Ajv2020 as unknown as new (options: Record<string, unknown>) => {
  compile: (schema: unknown) => ((value: unknown) => boolean) & { errors?: unknown };
})({ allErrors: true, strict: false }).compile(schema);
function cloneRegistration(): Record<string, unknown> {
  return structuredClone(registration);
}
function assertInvalid(value: unknown): void {
  assert(!validate(value), "mutated registration unexpectedly validated");
}

Deno.test("unicode editor supplemental registration is closed and does not mutate frozen coverage", async () => {
  assert(validate(registration), JSON.stringify(validate.errors));
  assertEquals(registration.status, "blocked-not-counted");
  assertEquals(
    registration.catalogReference.sha256,
    await sha256Hex(await Deno.readFile("catalog/workloads.v1.json")),
  );
  assertEquals(
    await Deno.readFile("catalog/workloads.v1.json"),
    await Deno.readFile("public/data/workloads.v1.json"),
  );
  assertEquals(registration.targets.linearWasmControlled.status, "blocked-unavailable");
  assertEquals(registration.countsAsImplementation, false);
  assertEquals(registration.countsAsDemo, false);
  assertEquals(registration.performanceClaims, []);
  assertEquals(registration.publicRoutes, []);
  assertEquals(registration.publicArtifacts, []);
  assertEquals(registration.fixture.rights.committedUnicodeSourceExcerpts, false);
  assertEquals(registration.fixture.downloads.length, 9);
  assertEquals(
    new Set(registration.fixture.downloads.map((source: { sha256: string }) => source.sha256)).size,
    9,
  );
});

Deno.test("unicode editor registration rejects recipe, counting, claim, route, artifact, and field mutations", () => {
  const duplicate = cloneRegistration();
  const duplicateFixture = duplicate.fixture as { downloads: unknown[] };
  duplicateFixture.downloads[1] = structuredClone(duplicateFixture.downloads[0]);
  assertInvalid(duplicate);

  const wrongRecipe = cloneRegistration();
  const wrongDownloads =
    (wrongRecipe.fixture as { downloads: Array<{ url: string; sha256: string }> }).downloads;
  wrongDownloads[0].url = "https://www.unicode.org/Public/15.1.0/ucd/CaseFolding.txt";
  assertInvalid(wrongRecipe);
  const wrongHash = cloneRegistration();
  (wrongHash.fixture as { downloads: Array<{ sha256: string }> }).downloads[8].sha256 = "0".repeat(
    64,
  );
  assertInvalid(wrongHash);

  for (const key of ["countsAsImplementation", "countsAsDemo"] as const) {
    const counted = cloneRegistration();
    counted[key] = true;
    assertInvalid(counted);
  }
  const winner = cloneRegistration();
  winner.performanceClaims = ["Wasm wins"];
  assertInvalid(winner);
  const route = cloneRegistration();
  route.publicRoutes = ["/benchmarks/text.unicode-editor.v1/"];
  assertInvalid(route);
  const artifact = cloneRegistration();
  artifact.publicArtifacts = ["public/unicode.wasm"];
  assertInvalid(artifact);
  for (const key of ["semantics", "targets", "evidence"] as const) {
    const missing = cloneRegistration();
    delete missing[key];
    assertInvalid(missing);
  }
});

Deno.test("unicode editor owned corpus has frozen complete size and hash", async () => {
  const corpus = generateUnicodeEditorCorpus();
  const bytes = new TextEncoder().encode(corpus);
  assertEquals(codePointCount(corpus), CORPUS_CODE_POINTS);
  assertEquals(bytes.length, registration.fixture.generatedCorpus.utf8Bytes);
  assertEquals(await sha256Hex(bytes), registration.fixture.generatedCorpus.sha256);
});

// Project-authored private-use values exercise the algorithms without reproducing Unicode source rows.
const starter = 0xe000, mark = 0xe001, composite = 0xe002, folded = 0xe003;
const turkicFolded = 0xe004, pictographA = 0xe100, joiner = 0xe101, pictographB = 0xe102;
const regionalA = 0xe110, regionalB = 0xe111, regionalC = 0xe112;
const syntheticTables: UnicodeTables = {
  unicodeVersion: "15.1.0",
  canonicalDecomposition: new Map([[composite, [starter, mark]]]),
  compatibilityDecomposition: new Map([[composite, [starter, mark]]]),
  combiningClass: new Map([[mark, 230]]),
  composition: new Map([[`${starter},${mark}`, composite]]),
  graphemeRanges: [
    [mark, mark, "Extend"],
    [joiner, joiner, "ZWJ"],
    [regionalA, regionalC, "Regional_Indicator"],
  ],
  extendedPictographicRanges: [
    [pictographA, pictographA, "Extended_Pictographic"],
    [pictographB, pictographB, "Extended_Pictographic"],
  ],
  indicConjunctRanges: [],
  folds: {
    "default-full": new Map([[starter, [folded]]]),
    "default-simple": new Map([[starter, [folded]]]),
    "turkic-full": new Map([[starter, [turkicFolded]]]),
    "turkic-simple": new Map([[starter, [turkicFolded]]]),
  },
};
const text = (...values: number[]) => String.fromCodePoint(...values);

Deno.test("repository-owned table engine normalizes, segments, folds and searches without host intrinsics", () => {
  assertEquals(normalize(text(starter, mark), "NFC", syntheticTables), text(composite));
  assertEquals(normalize(text(composite), "NFD", syntheticTables), text(starter, mark));
  assertEquals(caseFold(text(starter), "default-full", syntheticTables), text(folded));
  assertEquals(caseFold(text(starter), "turkic-full", syntheticTables), text(turkicFolded));
  assertEquals(graphemeBoundaries(text(pictographA, joiner, pictographB), syntheticTables), [0, 3]);
  assertEquals(graphemeBoundaries(text(regionalA, regionalB, regionalC), syntheticTables), [
    0,
    2,
    3,
  ]);
  const result = runUnicodeEditor(
    text(starter, mark, 0x20, starter),
    text(starter),
    syntheticTables,
  );
  assertEquals(result.normalized, text(composite, 0x20, starter));
  assertEquals(result.matches, [2]);
  assert(result.counters["normalization-compositions"] > 0);
  assert(result.counters["search-comparisons"] > 0);
});

Deno.test("unicode editor rejects lone surrogates", async () => {
  await assertRejects(
    () => Promise.resolve(normalize("\ud800", "NFC", syntheticTables)),
    "lone surrogate denied",
  );
});

Deno.test("retained Unicode 15.1 source audit is exact and honestly blocked", async () => {
  const evidence = JSON.parse(
    await Deno.readTextFile("evidence/base/text-unicode-editor/source-audit.json"),
  );
  assertEquals(
    evidence.status,
    "javascript-controlled-conformance-passed-linear-wasm-blocked-not-counted",
  );
  assertEquals(evidence.unicodeVersion, "15.1.0");
  assertEquals(evidence.conformance.normalizationRows, 19074);
  assertEquals(evidence.conformance.normalizationAssertions, 381480);
  assertEquals(evidence.conformance.graphemeRows, 1187);
  assertEquals(evidence.conformance.caseFoldRows, 1563);
  assertEquals(evidence.generatedCorpus.codePoints, CORPUS_CODE_POINTS);
  assertEquals(evidence.linearWasm.status, "blocked-unavailable");
  assertEquals(evidence.performanceClaims, []);
  assertEquals(evidence.downloads.every((source: { verified: boolean }) => source.verified), true);
});
