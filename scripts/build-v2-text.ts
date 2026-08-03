import wabtFactory from "wabt";
import { canonicalize, sha256Hex } from "../lib/canonical.ts";
import {
  generateDiffFixture,
  runDiffJS,
  runDiffWasm,
} from "../benchmarks/v2/text-diff-patch/workload.js";
import {
  generateMarkdownFixture,
  renderMarkdown,
  renderMarkdownWasm,
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
    serialization: "base UTF-8 lines then targets in 1/1000, 1/100, 1/10 order",
  },
  parameters: {
    baseLines: 100000,
    targetPairs: 3,
    editClasses: ["1/1000", "1/100", "1/10"],
    algorithm: "myers-ond",
    tieBreak: "delete-before-insert",
  },
  baseSha256: await textSha256(new TextEncoder().encode(diffFixture.base.join("\n"))),
  targets: await Promise.all(
    diffFixture.targets.map(async (target) => ({
      denominator: target.denominator,
      lines: target.lines.length,
      sha256: await textSha256(new TextEncoder().encode(target.lines.join("\n"))),
    })),
  ),
};
await writeJson("public/artifacts/text-diff-patch/fixture-manifest.json", diffFixtureRecord);
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
const outputDigests: string[] = [];
for (const document of markdownFixture.documents) {
  const js = renderMarkdown(document);
  const wasm = await renderMarkdownWasm(document, binaries.get("text-markdown-cms")!);
  const expectedWasm = { ...js.counters, "boundary-crossings": 4 };
  if (
    js.html !== wasm.html || canonicalize(wasm.counters) !== canonicalize(expectedWasm) ||
    js.rejected !== wasm.rejected
  ) throw new Error("markdown oracle mismatch");
  outputDigests.push(await textSha256(js.outputBytes));
  markdownInputBytes += js.counters["input-bytes"];
  markdownOutputBytes += js.counters["output-bytes"];
  markdownTokens += js.counters.tokens;
  markdownNodes += js.counters["ast-nodes"];
  markdownTransforms += js.counters.transforms;
  markdownChecks += js.counters["sanitizer-checks"];
  markdownRejected += js.rejected;
}
const corpusBytes = new TextEncoder().encode(markdownFixture.documents.join(""));
await writeJson("public/artifacts/text-markdown-cms/fixture-manifest.json", {
  schemaVersion: 1,
  workload: "text.markdown-cms.v1",
  generator: {
    algorithm: "xorshift32",
    seed: "0xc05c0de1",
    revision: "proposal-generator-v1",
    unicode: "Unicode 15.1 scalar UTF-8",
  },
  parameters: {
    documents: 500,
    minimumBytes: 2048,
    maximumBytes: 40960,
    transforms: ["toc", "anchors", "links", "figures"],
    sanitize: "frozen-allowlist",
  },
  corpus: { bytes: corpusBytes.length, sha256: await textSha256(corpusBytes) },
  allowlist: {
    rawElements: ["em-without-attributes", "strong-without-attributes"],
    linkPrefixes: ["https://example.test/", "https://docs.example.test/"],
    imagePrefixes: ["https://images.example.test/"],
  },
});
await writeJson("public/artifacts/text-markdown-cms/output-manifest.json", {
  schemaVersion: 1,
  workload: "text.markdown-cms.v1",
  oracle: "per-document-canonical-html-digest-and-invariants",
  corpusDigestSha256: await textSha256(new TextEncoder().encode(outputDigests.join("\n"))),
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
