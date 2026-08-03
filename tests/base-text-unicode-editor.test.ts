import Ajv2020Module from "ajv2020";
import { assert, assertEquals, assertRejects } from "./assert.ts";
import { sha256Hex } from "../lib/canonical.ts";
import {
  caseFold,
  graphemeBoundaries,
  normalize,
  parseUnicodeTables,
  runUnicodeEditor,
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

Deno.test("unicode editor supplemental registration is closed and does not mutate frozen coverage", async () => {
  const validate = new (Ajv2020 as unknown as new (options: Record<string, unknown>) => {
    compile: (schema: unknown) => ((value: unknown) => boolean) & { errors?: unknown };
  })({ allErrors: true, strict: false }).compile(schema);
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
  assertEquals(registration.evidence.performanceClaims, []);
  assertEquals(registration.fixture.downloads.length, 9);
  assertEquals(
    new Set(registration.fixture.downloads.map((source: { sha256: string }) => source.sha256)).size,
    9,
  );
});

Deno.test("unicode editor owned corpus has frozen complete size and hash", async () => {
  const corpus = generateUnicodeEditorCorpus();
  const bytes = new TextEncoder().encode(corpus);
  assertEquals(codePointCount(corpus), CORPUS_CODE_POINTS);
  assertEquals(bytes.length, registration.fixture.generatedCorpus.utf8Bytes);
  assertEquals(await sha256Hex(bytes), registration.fixture.generatedCorpus.sha256);
});

const syntheticTables = parseUnicodeTables({
  UnicodeData: [
    "0041;LATIN CAPITAL LETTER A;Lu;0;L;;;;;N;;;;0061;",
    "0049;LATIN CAPITAL LETTER I;Lu;0;L;;;;;N;;;;0069;",
    "0061;LATIN SMALL LETTER A;Ll;0;L;;;;;N;;;0041;;0041",
    "0069;LATIN SMALL LETTER I;Ll;0;L;;;;;N;;;0049;;0049",
    "00C5;LATIN CAPITAL LETTER A WITH RING ABOVE;Lu;0;L;0041 030A;;;;N;LATIN CAPITAL LETTER A RING;;;00E5;",
    "0130;LATIN CAPITAL LETTER I WITH DOT ABOVE;Lu;0;L;0049 0307;;;;N;LATIN CAPITAL LETTER I DOT;;;0069;",
    "0307;COMBINING DOT ABOVE;Mn;230;NSM;;;;;N;;;;;",
    "030A;COMBINING RING ABOVE;Mn;230;NSM;;;;;N;;;;;",
    "212B;ANGSTROM SIGN;Lu;0;L;00C5;;;;N;ANGSTROM UNIT;;;;",
  ].join("\n"),
  DerivedNormalizationProps: "",
  GraphemeBreakProperty: [
    "000D ; CR",
    "000A ; LF",
    "0300..036F ; Extend",
    "200D ; ZWJ",
    "1F1E6..1F1FF ; Regional_Indicator",
  ].join("\n"),
  emojiData: "1F469 ; Extended_Pictographic\n1F680 ; Extended_Pictographic",
  DerivedCoreProperties:
    "094D ; InCB; Linker\n0915..0939 ; InCB; Consonant\n0300..036F ; InCB; Extend",
  CaseFolding: [
    "0041; C; 0061;",
    "0049; C; 0069;",
    "0049; T; 0131;",
    "0130; F; 0069 0307;",
    "0130; T; 0069;",
  ].join("\n"),
});

Deno.test("repository-owned table engine normalizes, segments, folds and searches without host intrinsics", () => {
  assertEquals(normalize("A\u030A", "NFC", syntheticTables), "Å");
  assertEquals(normalize("\u212B", "NFD", syntheticTables), "A\u030A");
  assertEquals(caseFold("AI", "default-full", syntheticTables), "ai");
  assertEquals(caseFold("Iİ", "turkic-full", syntheticTables), "ıi");
  assertEquals(graphemeBoundaries("👩\u200d🚀", syntheticTables), [0, 3]);
  assertEquals(graphemeBoundaries("🇬🇧🇯", syntheticTables), [0, 2, 3]);
  const result = runUnicodeEditor("A\u030A AI", "ai", syntheticTables);
  assertEquals(result.normalized, "Å AI");
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
