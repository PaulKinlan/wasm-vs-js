import wabtFactory from "wabt";
import { canonicalize, sha256Hex } from "../lib/canonical.ts";
import {
  generateDiffFixture,
  runDiffJS,
  runDiffWasm,
  serializeDiffPair,
} from "../benchmarks/v2/text-diff-patch/workload.js";
import {
  generateMarkdownFixture,
  renderMarkdown,
  renderMarkdownWasm,
  serializeMarkdownCorpus,
  sha256Hex as textSha256,
} from "../benchmarks/v2/text-markdown-cms/workload.js";

if (Deno.version.deno !== "2.9.0") {
  throw new Error(`requires Deno 2.9.0, found ${Deno.version.deno}`);
}
const wabt = await wabtFactory();
async function compile(path: string): Promise<Uint8Array<ArrayBuffer>> {
  const module = wabt.parseWat(path, await Deno.readTextFile(path), {
    simd: false,
    threads: false,
    exceptions: false,
  });
  module.resolveNames();
  module.validate();
  const output = new Uint8Array(
    module.toBinary({ canonicalize_lebs: true, write_debug_names: false }).buffer,
  );
  module.destroy();
  return output;
}
async function writeJson(path: string, value: unknown) {
  await Deno.mkdir(new URL(".", new URL(`../${path}`, import.meta.url)), { recursive: true });
  const text = path.startsWith("artifacts/v2/")
    ? `${JSON.stringify(value, null, 2)}\n`
    : `${canonicalize(value)}\n`;
  await Deno.writeTextFile(new URL(`../${path}`, import.meta.url), text);
}
async function source(path: string) {
  const bytes = await Deno.readFile(path);
  return { path, bytes: bytes.length, sha256: await sha256Hex(bytes) };
}

const workloads = [
  {
    slug: "text-diff-patch",
    id: "text.diff-patch.v1",
    wat: "benchmarks/v2/text-diff-patch/text-diff-patch.wat",
    js: "benchmarks/v2/text-diff-patch/workload.js",
  },
  {
    slug: "text-markdown-cms",
    id: "text.markdown-cms.v1",
    wat: "benchmarks/v2/text-markdown-cms/text-markdown-cms.wat",
    js: "benchmarks/v2/text-markdown-cms/workload.js",
  },
];
const binaries = new Map<string, Uint8Array<ArrayBuffer>>();
for (const workload of workloads) {
  const wasm = await compile(workload.wat);
  binaries.set(workload.slug, wasm);
  const dir = `public/artifacts/${workload.slug}`;
  await Deno.mkdir(dir, { recursive: true });
  await Deno.writeFile(`${dir}/${workload.slug}.wasm`, wasm);
}

const diffFixture = generateDiffFixture();
const diffPairs = [];
for (const target of diffFixture.targets) {
  const js = await runDiffJS(diffFixture.base, target.lines);
  const wasm = await runDiffWasm(diffFixture.base, target.lines, binaries.get("text-diff-patch")!);
  const expectedWasm = { ...js.counters, "boundary-crossings": 1 };
  if (
    js.digestSha256 !== wasm.digestSha256 ||
    canonicalize(wasm.counters) !== canonicalize(expectedWasm)
  ) throw new Error(`diff oracle mismatch 1/${target.denominator}`);
  diffPairs.push({
    denominator: target.denominator,
    removedLines: target.removed,
    inputSha256: js.inputSha256,
    inputBytes: js.counters["input-bytes"],
    digestSha256: js.digestSha256,
    jsCounters: js.counters,
    wasmCounters: wasm.counters,
  });
}
const diffFixtureRecord = {
  schemaVersion: 1,
  workload: "text.diff-patch.v1",
  generator: {
    algorithm: "xorshift32",
    seed: "0xd1ff2026",
    revision: "proposal-generator-v1",
    unicode: "Unicode 15.1 scalar UTF-8 lines",
    serialization:
      "TDF1: little-endian magic, base count, repeated byte-length plus UTF-8 line bytes, target count, repeated byte-length plus UTF-8 line bytes",
  },
  parameters: {
    baseLines: 100000,
    targetPairs: 3,
    editClasses: ["1/1000", "1/100", "1/10"],
    algorithm: "myers-ond",
    tieBreak: "delete-before-insert",
    targetDerivation:
      "tail deletion for all pairs; 1/1000 additionally replaces the final retained line to exercise Myers frontier",
  },
  allocationCounter:
    "five logical work buffers: intern table, base IDs, target IDs, canonical script, applied target IDs",
  baseFrameSha256: await textSha256(serializeDiffPair(diffFixture.base, [])),
  targets: diffPairs.map((pair, index) => ({
    denominator: pair.denominator,
    lines: diffFixture.targets[index].lines.length,
    framedInputBytes: pair.inputBytes,
    framedInputSha256: pair.inputSha256,
  })),
};
await writeJson("public/artifacts/text-diff-patch/fixture-manifest.json", diffFixtureRecord);
await writeJson("public/artifacts/text-diff-patch/input-manifest.json", {
  schemaVersion: 1,
  workload: "text.diff-patch.v1",
  serialization: "TDF1 little-endian framed UTF-8",
  pairs: diffPairs.map(({ denominator, inputBytes, inputSha256 }) => ({
    denominator,
    bytes: inputBytes,
    sha256: inputSha256,
  })),
});
await writeJson("public/artifacts/text-diff-patch/output-manifest.json", {
  schemaVersion: 1,
  workload: "text.diff-patch.v1",
  oracle: "exact-script-digest-plus-apply",
  pairs: diffPairs,
  performanceClaims: [],
});

const markdownFixture = generateMarkdownFixture();
let markdownInputBytes = 0,
  markdownOutputBytes = 0,
  markdownTokens = 0,
  markdownNodes = 0,
  markdownTransforms = 0,
  markdownChecks = 0,
  markdownRejected = 0;
const markdownDocuments = [];
let markdownJsAllocations = 0, markdownWasmAllocations = 0, markdownWasmCrossings = 0;
for (const document of markdownFixture.documents) {
  const js = renderMarkdown(document);
  const wasm = await renderMarkdownWasm(document, binaries.get("text-markdown-cms")!);
  const expectedWasm = { ...js.counters, "boundary-crossings": 4 };
  if (
    js.html !== wasm.html || canonicalize(wasm.counters) !== canonicalize(expectedWasm) ||
    js.rejected !== wasm.rejected ||
    canonicalize([...js.ast]) !== canonicalize([...wasm.ast]) ||
    canonicalize([...js.transformedAst]) !== canonicalize([...wasm.transformedAst])
  ) throw new Error("markdown oracle mismatch");
  markdownDocuments.push({
    index: markdownDocuments.length,
    inputSha256: await textSha256(new TextEncoder().encode(document)),
    astSha256: await textSha256(js.ast),
    transformedAstSha256: await textSha256(js.transformedAst),
    htmlSha256: await textSha256(js.outputBytes),
    variantCounters: {
      "js-controlled": js.counters,
      "wasm-linear-controlled": wasm.counters,
    },
    rejected: js.rejected,
  });
  markdownInputBytes += js.counters["input-bytes"];
  markdownOutputBytes += js.counters["output-bytes"];
  markdownTokens += js.counters.tokens;
  markdownNodes += js.counters["ast-nodes"];
  markdownTransforms += js.counters.transforms;
  markdownChecks += js.counters["sanitizer-checks"];
  markdownRejected += js.rejected;
  markdownJsAllocations += js.counters.allocations;
  markdownWasmAllocations += wasm.counters.allocations;
  markdownWasmCrossings += wasm.counters["boundary-crossings"];
}
const corpusBytes = serializeMarkdownCorpus(markdownFixture.documents);
await writeJson("public/artifacts/text-markdown-cms/fixture-manifest.json", {
  schemaVersion: 1,
  workload: "text.markdown-cms.v1",
  generator: {
    algorithm: "xorshift32",
    seed: "0xc05c0de1",
    revision: "proposal-generator-v1",
    unicode: "Unicode 15.1 scalar UTF-8",
    serialization:
      "MCF1: little-endian magic, document count, repeated byte-length plus UTF-8 document bytes",
  },
  astLayout: {
    encoding: "six little-endian u32 fields per record",
    fields: [
      "type",
      "text-byte-offset",
      "text-byte-length",
      "url-byte-offset",
      "url-byte-length",
      "sanitizer-allowed",
    ],
    typeIds: { heading1: 1, heading2: 2, paragraph: 3, link: 4, figure: 5, rawHtml: 6 },
  },
  parameters: {
    documents: 500,
    minimumBytes: 2048,
    maximumBytes: 40960,
    transforms: ["toc", "anchors", "links", "figures"],
    sanitize: "frozen-allowlist",
  },
  corpus: { bytes: corpusBytes.length, sha256: await textSha256(corpusBytes) },
  allocationCounter:
    "four logical work buffers per document: UTF-8 input, parsed AST, transformed AST with sanitizer flags, canonical HTML",
  allowlist: {
    rawElements: ["em-without-attributes", "strong-without-attributes"],
    linkPrefixes: ["https://example.test/", "https://docs.example.test/"],
    imagePrefixes: ["https://images.example.test/"],
  },
});
await writeJson("public/artifacts/text-markdown-cms/input-manifest.json", {
  schemaVersion: 1,
  workload: "text.markdown-cms.v1",
  serialization: "MCF1 little-endian framed UTF-8",
  documents: 500,
  bytes: corpusBytes.length,
  sha256: await textSha256(corpusBytes),
});
await writeJson("public/artifacts/text-markdown-cms/output-manifest.json", {
  schemaVersion: 1,
  workload: "text.markdown-cms.v1",
  oracle: "per-document-canonical-html-digest-and-invariants",
  corpusDigestSha256: await textSha256(
    new TextEncoder().encode(markdownDocuments.map((document) => document.htmlSha256).join("\n")),
  ),
  documents: markdownDocuments,
  counters: {
    documents: 500,
    "input-bytes": markdownInputBytes,
    tokens: markdownTokens,
    "ast-nodes": markdownNodes,
    transforms: markdownTransforms,
    "sanitizer-checks": markdownChecks,
    "output-bytes": markdownOutputBytes,
    rejected: markdownRejected,
  },
  variants: {
    "js-controlled": { allocations: markdownJsAllocations, "boundary-crossings": 0 },
    "wasm-linear-controlled": {
      allocations: markdownWasmAllocations,
      "boundary-crossings": markdownWasmCrossings,
    },
  },
  performanceClaims: [],
});

for (const workload of workloads) {
  const wasm = binaries.get(workload.slug)!;
  const sources = await Promise.all([
    source(workload.js),
    source(workload.wat),
    source("scripts/build-v2-text.ts"),
    source("deno.json"),
    source("deno.lock"),
  ]);
  const buildManifest = {
    schemaVersion: 1,
    workload: workload.id,
    track: "controlled",
    variants: ["js-controlled", "wasm-linear-controlled"],
    artifact: {
      path: `public/artifacts/${workload.slug}/${workload.slug}.wasm`,
      bytes: wasm.length,
      sha256: await sha256Hex(wasm),
      mediaType: "application/wasm",
    },
    build: {
      command: "deno run --allow-read=. --allow-write=public/artifacts scripts/build-v2-text.ts",
      toolchains: [`Deno ${Deno.version.deno}`, "wabt 1.0.37"],
      flags: [
        "canonicalize_lebs=true",
        "simd=false",
        "threads=false",
        "exceptions=false",
        "write_debug_names=false",
      ],
    },
    sources,
    performanceClaims: [],
  };
  await writeJson(`public/artifacts/${workload.slug}/build-manifest.json`, buildManifest);
  console.log(`${workload.id}: ${wasm.length} wasm bytes, oracle passed`);
}
