import Ajv2020Module from "ajv2020";
import { sha256Hex } from "../lib/canonical.ts";
import {
  caseFold,
  type FoldMode,
  graphemeBoundaries,
  normalize,
  parseUnicodeTables,
  runUnicodeEditor,
  type UnicodeSourceTexts,
} from "../benchmarks/base/text-unicode-editor/workload.ts";
import {
  codePointCount,
  CORPUS_CODE_POINTS,
  generateUnicodeEditorCorpus,
} from "../benchmarks/base/text-unicode-editor/corpus.ts";

if (Deno.version.deno !== "2.9.0") {
  throw new Error(`requires Deno 2.9.0, found ${Deno.version.deno}`);
}
const registrationPath = "catalog/base-text-unicode-editor-implementation.v1.json";
const registrationBytes = await Deno.readFile(registrationPath);
const registration = JSON.parse(new TextDecoder().decode(registrationBytes));
const schema = JSON.parse(
  await Deno.readTextFile("schemas/base-workload-implementation.schema.json"),
);
const Ajv2020 = (Ajv2020Module as unknown as { default?: typeof Ajv2020Module }).default ??
  Ajv2020Module;
const validate = new (Ajv2020 as unknown as new (options: Record<string, unknown>) => {
  compile: (schema: unknown) => ((value: unknown) => boolean) & { errors?: unknown };
})({ allErrors: true, strict: false }).compile(schema);
if (!validate(registration)) {
  throw new Error(`registration schema: ${JSON.stringify(validate.errors)}`);
}

const catalogBytes = await Deno.readFile("catalog/workloads.v1.json");
if (await sha256Hex(catalogBytes) !== registration.catalogReference.sha256) {
  throw new Error("frozen catalog hash mismatch");
}
const decoder = new TextDecoder("utf-8", { fatal: true });
const downloaded = new Map<string, { bytes: Uint8Array; text: string }>();
for (const source of registration.fixture.downloads) {
  const response = await fetch(source.url, { redirect: "error" });
  if (!response.ok) throw new Error(`${source.name} download ${response.status}`);
  const bytes = new Uint8Array(await response.arrayBuffer());
  if (bytes.length !== source.bytes) throw new Error(`${source.name} byte length mismatch`);
  if (await sha256Hex(bytes) !== source.sha256) throw new Error(`${source.name} SHA-256 mismatch`);
  const text = decoder.decode(bytes);
  downloaded.set(source.name, { bytes, text });
}
function source(name: string): string {
  const value = downloaded.get(name);
  if (!value) throw new Error(`missing downloaded source ${name}`);
  return value.text;
}
const sources: UnicodeSourceTexts = {
  UnicodeData: source("UnicodeData.txt"),
  DerivedNormalizationProps: source("DerivedNormalizationProps.txt"),
  GraphemeBreakProperty: source("GraphemeBreakProperty.txt"),
  emojiData: source("emoji-data.txt"),
  DerivedCoreProperties: source("DerivedCoreProperties.txt"),
  CaseFolding: source("CaseFolding.txt"),
};
const tables = parseUnicodeTables(sources);

function fromHex(value: string): string {
  return String.fromCodePoint(
    ...value.trim().split(/\s+/).map((part) => Number.parseInt(part, 16)),
  );
}
let normalizationRows = 0;
let normalizationAssertions = 0;
for (const raw of source("NormalizationTest.txt").split("\n")) {
  const line = raw.replace(/#.*/, "").trim();
  if (!line || line.startsWith("@")) continue;
  const fields = line.split(";").slice(0, 5).map(fromHex);
  if (fields.length !== 5) throw new Error("malformed normalization row");
  const [c1, c2, c3, c4, c5] = fields;
  const checks: Array<[string, string]> = [
    [normalize(c1, "NFC", tables), c2],
    [normalize(c2, "NFC", tables), c2],
    [normalize(c3, "NFC", tables), c2],
    [normalize(c4, "NFC", tables), c4],
    [normalize(c5, "NFC", tables), c4],
    [normalize(c1, "NFD", tables), c3],
    [normalize(c2, "NFD", tables), c3],
    [normalize(c3, "NFD", tables), c3],
    [normalize(c4, "NFD", tables), c5],
    [normalize(c5, "NFD", tables), c5],
    [normalize(c1, "NFKC", tables), c4],
    [normalize(c2, "NFKC", tables), c4],
    [normalize(c3, "NFKC", tables), c4],
    [normalize(c4, "NFKC", tables), c4],
    [normalize(c5, "NFKC", tables), c4],
    [normalize(c1, "NFKD", tables), c5],
    [normalize(c2, "NFKD", tables), c5],
    [normalize(c3, "NFKD", tables), c5],
    [normalize(c4, "NFKD", tables), c5],
    [normalize(c5, "NFKD", tables), c5],
  ];
  for (const [actual, expected] of checks) {
    if (actual !== expected) throw new Error(`normalization mismatch row ${normalizationRows + 1}`);
    normalizationAssertions += 1;
  }
  normalizationRows += 1;
}

let graphemeRows = 0;
for (const raw of source("GraphemeBreakTest.txt").split("\n")) {
  const line = raw.replace(/#.*/, "").trim();
  if (!line || line.startsWith("@")) continue;
  const tokens = line.split(/\s+/);
  const codePoints: number[] = [];
  const expected: number[] = [];
  for (const token of tokens) {
    if (token === "÷") expected.push(codePoints.length);
    else if (token !== "×") codePoints.push(Number.parseInt(token, 16));
  }
  const actual = graphemeBoundaries(String.fromCodePoint(...codePoints), tables);
  if (actual.join(",") !== expected.join(",")) {
    throw new Error(`grapheme mismatch row ${graphemeRows + 1}: ${actual} != ${expected}`);
  }
  graphemeRows += 1;
}

const caseLines = source("CaseFolding.txt").split("\n").map((raw) => raw.replace(/#.*/, "").trim())
  .filter(Boolean);
const turkicCodes = new Set<number>();
for (const line of caseLines) {
  const [code, status] = line.split(";").map((field) => field.trim());
  if (status === "T") turkicCodes.add(Number.parseInt(code, 16));
}
let caseFoldRows = 0;
for (const line of caseLines) {
  const [code, status, mapping] = line.split(";").map((field) => field.trim());
  const codePoint = Number.parseInt(code, 16);
  const input = String.fromCodePoint(codePoint);
  const expected = fromHex(mapping);
  const modes: FoldMode[] = status === "C"
    ? ["default-full", "default-simple", "turkic-full", "turkic-simple"]
    : status === "F"
    ? ["default-full"]
    : status === "S"
    ? ["default-simple"]
    : ["turkic-full", "turkic-simple"];
  for (const mode of modes) {
    if (status === "C" && turkicCodes.has(codePoint) && mode.startsWith("turkic")) continue;
    if (caseFold(input, mode, tables) !== expected) throw new Error(`case fold mismatch U+${code}`);
  }
  caseFoldRows += 1;
}

const adversarial = [
  [normalize("A\u030A", "NFC", tables), "Å"],
  [normalize("\u212B", "NFD", tables), "A\u030A"],
  [caseFold("İIıi", "turkic-full", tables), "iııi"],
  [caseFold("Straße", "default-full", tables), "strasse"],
] as const;
for (const [actual, expected] of adversarial) {
  if (actual !== expected) throw new Error("adversarial mismatch");
}
let malformedRejected = false;
try {
  normalize("\ud800", "NFC", tables);
} catch {
  malformedRejected = true;
}
if (!malformedRejected) throw new Error("lone surrogate was accepted");

const corpus = generateUnicodeEditorCorpus();
const corpusBytes = new TextEncoder().encode(corpus);
if (codePointCount(corpus) !== CORPUS_CODE_POINTS) throw new Error("corpus code-point mismatch");
if (corpusBytes.length !== registration.fixture.generatedCorpus.utf8Bytes) {
  throw new Error("corpus byte mismatch");
}
if (await sha256Hex(corpusBytes) !== registration.fixture.generatedCorpus.sha256) {
  throw new Error("corpus hash mismatch");
}
const corpusResult = runUnicodeEditor(corpus, "istanbul", tables, "default-full");
if (corpusResult.counters["input-code-points"] !== CORPUS_CODE_POINTS + 8) {
  throw new Error("corpus counters mismatch");
}

const record = {
  schemaVersion: 1,
  workload: "text.unicode-editor.v1",
  status: "javascript-controlled-conformance-passed-linear-wasm-blocked-not-counted",
  deno: Deno.version.deno,
  unicodeVersion: "15.1.0",
  registrationSha256: await sha256Hex(registrationBytes),
  frozenCatalogSha256: await sha256Hex(catalogBytes),
  downloads: registration.fixture.downloads.map((
    item: { name: string; bytes: number; sha256: string },
  ) => ({
    name: item.name,
    bytes: item.bytes,
    sha256: item.sha256,
    verified: true,
  })),
  conformance: {
    normalizationRows,
    normalizationAssertions,
    graphemeRows,
    caseFoldRows,
    adversarialAssertions: adversarial.length + 1,
  },
  generatedCorpus: {
    codePoints: codePointCount(corpus),
    utf8Bytes: corpusBytes.length,
    sha256: await sha256Hex(corpusBytes),
    resultCounters: corpusResult.counters,
    normalizedSha256: await sha256Hex(new TextEncoder().encode(corpusResult.normalized)),
    searchableSha256: await sha256Hex(new TextEncoder().encode(corpusResult.searchable)),
  },
  linearWasm: {
    status: "blocked-unavailable",
    reason:
      "Unicode data redistribution audit required before generating or publishing table-bearing artifact",
  },
  performanceClaims: [],
};
await Deno.mkdir("evidence/base/text-unicode-editor", { recursive: true });
await Deno.writeTextFile(
  "evidence/base/text-unicode-editor/source-audit.json",
  `${JSON.stringify(record, null, 2)}\n`,
);
console.log(
  `unicode-editor-audit: normalization=${normalizationRows} grapheme=${graphemeRows} casefold=${caseFoldRows} corpus=${CORPUS_CODE_POINTS}; wasm=blocked-not-counted`,
);
