import wabtFactory from "wabt";
import Ajv2020Module from "ajv2020";
import addFormatsModule from "ajv-formats";
import { validateProposalProvenanceSemantics } from "../../benchmarks/v2/shared/provenance-contract.js";
import { assert, assertEquals } from "../assert.ts";

type Validator = ((value: unknown) => boolean) & { errors?: unknown };
type AjvInstance = { compile: (schema: unknown) => Validator };
type AjvConstructor = new (options?: Record<string, unknown>) => AjvInstance;
type AddFormats = (ajv: AjvInstance) => void;
import {
  generateDiffFixture,
  myersDiff,
  runDiffJS,
  runDiffWasm,
  serializeDiffPair,
} from "../../benchmarks/v2/text-diff-patch/workload.js";
import {
  generateMarkdownFixture,
  MAX_NON_EMPTY_LINES,
  renderMarkdown,
  renderMarkdownWasm,
  serializeMarkdownCorpus,
} from "../../benchmarks/v2/text-markdown-cms/workload.js";

async function wasm(path: string) {
  const wabt = await wabtFactory();
  const module = wabt.parseWat(path, await Deno.readTextFile(path), {
    simd: false,
    threads: false,
    exceptions: false,
  });
  module.resolveNames();
  module.validate();
  const bytes = new Uint8Array(
    module.toBinary({ canonicalize_lebs: true, write_debug_names: false }).buffer,
  );
  module.destroy();
  return bytes;
}
const diffWasm = await wasm("benchmarks/v2/text-diff-patch/text-diff-patch.wat");
const markdownWasm = await wasm("benchmarks/v2/text-markdown-cms/text-markdown-cms.wat");

Deno.test("text diff frozen Unicode fixture has exact full-contract shape and framing", () => {
  const fixture = generateDiffFixture();
  assertEquals(fixture.base.length, 100000);
  assertEquals(fixture.targets.map((target) => target.lines.length), [99900, 99000, 90000]);
  assert(fixture.base.some((line) => line.includes("🚀")));
  assert(fixture.base.some((line) => line.includes("é")));
  assert(fixture.targets[0].lines.at(-1)?.endsWith("edited-🚧"));
  const framed = serializeDiffPair(fixture.base.slice(0, 2), fixture.targets[0].lines.slice(0, 2));
  assertEquals(new DataView(framed.buffer).getUint32(0, true), 0x31464454);
  assert(
    JSON.stringify([...serializeDiffPair(["ab", "c"], [])]) !==
      JSON.stringify([...serializeDiffPair(["a", "bc"], [])]),
    "diff framing permits a concatenation collision",
  );
});

Deno.test("text diff authored Wasm and JavaScript agree on adversarial Myers ties", async () => {
  const pairs = [
    [["a", "b"], ["b", "a"]],
    [["Café", "東京", "🚀"], ["Café", "é", "🚀"]],
    [["same", "delete", "tail"], ["same", "tail"]],
    [[], ["insert", "only"]],
  ];
  for (const [base, target] of pairs) {
    const js = await runDiffJS(base, target);
    const linear = await runDiffWasm(base, target, diffWasm);
    assertEquals(linear.operations, js.operations);
    assertEquals(linear.digestSha256, js.digestSha256);
    assertEquals(linear.inputSha256, js.inputSha256);
    assertEquals(linear.counters, { ...js.counters, "boundary-crossings": 1 });
  }
  assertEquals(myersDiff(Uint32Array.of(1, 2), Uint32Array.of(2, 1)).operations[0][0], 1);
});

Deno.test("Markdown fixture is exact, deterministic, Unicode, and spans all 500 documents", () => {
  const first = generateMarkdownFixture();
  const second = generateMarkdownFixture();
  assertEquals(first.documents, second.documents);
  assertEquals(first.documents.length, 500);
  for (const document of first.documents) {
    const bytes = new TextEncoder().encode(document).length;
    assert(bytes >= 2048 && bytes <= 40960, `fixture bytes ${bytes}`);
  }
  assert(first.documents.some((document) => document.includes("東京")));
  assert(first.documents.some((document) => document.includes("\n![")), "figure transform absent");
  assert(first.documents.some((document) => document.includes("\n[x](")), "odd-label link absent");
  assert(
    first.documents.some((document) => document.includes("a b")),
    "Unicode whitespace vector absent",
  );
  const framed = serializeMarkdownCorpus(first.documents.slice(0, 2));
  assertEquals(new DataView(framed.buffer).getUint32(0, true), 0x3146434d);
  assertEquals(new DataView(framed.buffer).getUint32(4, true), 2);
  assert(
    JSON.stringify([...serializeMarkdownCorpus(["ab", "c"])]) !==
      JSON.stringify([...serializeMarkdownCorpus(["a", "bc"])]),
    "Markdown framing permits a concatenation collision",
  );
});

Deno.test("Markdown authored Wasm matches canonical output and rejects adversarial raw HTML", async () => {
  const sources = [
    "# Café 東京\n## é 🚀\n<em>allowed</em>\n<strong>also allowed</strong>\n<script>alert(1)</script>\n<img src=x onerror=alert(1)>\nA & B < C\n",
    "![alt](https://images.example.test/ok.png)\n",
    "[safe](https://docs.example.test/ok)\n",
    "[x](https://docs.example.test/ok)\n",
    "# heading\n[x](https://docs.example.test/path)\n![a](https://images.example.test/x)\n",
    "[nbsp](https://docs.example.test/a b)\n",
    "[emspace](https://docs.example.test/a b)\n",
    "[linesep](https://docs.example.test/a b)\n",
    "!x](https://images.example.test/a)\n",
    "!abc](https://images.example.test/a)\n",
    "!](https://images.example.test/a)\n",
    "[bad](javascript:alert(1))\n",
    "<em onclick=x>not allowed</em>\n",
    "<strong>nested <em>x</em></strong>\n",
  ];
  for (const source of sources) {
    const js = renderMarkdown(source);
    const linear = await renderMarkdownWasm(source, markdownWasm);
    assertEquals(linear.html, js.html);
    assertEquals(linear.counters, { ...js.counters, "boundary-crossings": 4 });
    assertEquals(linear.rejected, js.rejected);
    assertEquals([...linear.ast], [...js.ast]);
    assertEquals([...linear.transformedAst], [...js.transformedAst]);
    assert(!linear.html.includes("<script"));
    assert(!linear.html.includes("onerror"));
    if (/^\[(?:nbsp|emspace|linesep)\]/u.test(source)) assertEquals(linear.html, "");
    if (source.startsWith("!") && !source.startsWith("![")) {
      assertEquals(linear.html, `<p>${source.trim()}</p>`);
      assertEquals(linear.rejected, 0);
    }
  }
  const tooManyLines = "x\n".repeat(MAX_NON_EMPTY_LINES + 1);
  for (
    const run of [
      () => Promise.resolve(renderMarkdown(tooManyLines)),
      () => renderMarkdownWasm(tooManyLines, markdownWasm),
    ]
  ) {
    let rejected = false;
    try {
      await run();
    } catch (error) {
      rejected = error instanceof Error && error.message.includes("non-empty lines");
    }
    assert(rejected, "line-count limit was not enforced consistently");
  }
});

Deno.test("text artifacts and closed proposal-validation records are reproducible and claim no performance result", async () => {
  const Ajv2020 = ((Ajv2020Module as unknown as { default?: AjvConstructor }).default ??
    Ajv2020Module) as unknown as AjvConstructor;
  const addFormats = ((addFormatsModule as unknown as { default?: AddFormats }).default ??
    addFormatsModule) as unknown as AddFormats;
  const ajv = new Ajv2020({ allErrors: true, strict: false });
  addFormats(ajv);
  const validate = ajv.compile(
    JSON.parse(await Deno.readTextFile("schemas/workload-result-v2-proposal.schema.json")),
  );
  const catalog = JSON.parse(await Deno.readTextFile("catalog/workloads.v2.proposed.json"));
  const diffOutput = JSON.parse(
    await Deno.readTextFile("public/artifacts/text-diff-patch/output-manifest.json"),
  );
  assert(diffOutput.pairs[0].jsCounters["frontier-steps"] > 0);
  assertEquals(
    diffOutput.pairs[0].jsCounters["frontier-steps"],
    diffOutput.pairs[0].wasmCounters["frontier-steps"],
  );
  const markdownOutput = JSON.parse(
    await Deno.readTextFile("public/artifacts/text-markdown-cms/output-manifest.json"),
  );
  assertEquals(markdownOutput.documents.length, 500);
  assert(
    markdownOutput.documents.every((document: Record<string, unknown>) =>
      typeof document.astSha256 === "string" && typeof document.transformedAstSha256 === "string" &&
      typeof document.htmlSha256 === "string"
    ),
  );
  assertEquals(markdownOutput.variants["js-controlled"]["boundary-crossings"], 0);
  assertEquals(markdownOutput.variants["wasm-linear-controlled"]["boundary-crossings"], 2000);
  assertEquals(markdownOutput.variants["js-controlled"].allocations, 2000);
  assertEquals(markdownOutput.variants["wasm-linear-controlled"].allocations, 2000);
  for (const slug of ["text-diff-patch", "text-markdown-cms"]) {
    const manifest = JSON.parse(
      await Deno.readTextFile(`public/artifacts/${slug}/build-manifest.json`),
    );
    const output = JSON.parse(
      await Deno.readTextFile(`public/artifacts/${slug}/output-manifest.json`),
    );
    assertEquals(manifest.performanceClaims, []);
    assertEquals(output.performanceClaims, []);
    assert((await Deno.stat(`public/artifacts/${slug}/${slug}.wasm`)).size > 0);
    for (const variant of ["js-controlled", "wasm-linear-controlled"]) {
      const record = JSON.parse(
        await Deno.readTextFile(`artifacts/v2/${slug}/${variant}.result.json`),
      );
      assertEquals(record.status, "proposal-validation-only");
      assertEquals(record.correctness.status, "passed");
      assertEquals(record.performanceClaims, []);
      const requiredCounters = slug === "text-diff-patch"
        ? ["interned-lines", "allocations"]
        : ["allocations"];
      for (const counter of requiredCounters) {
        assert(
          record.provenance.semanticCoverage.workCounterIds.includes(counter),
          `${slug}/${variant} omits formal ${counter} coverage`,
        );
      }
      assert(validate(record), JSON.stringify(validate.errors));
      const semantics = await validateProposalProvenanceSemantics(record, catalog);
      assert(semantics.ok, semantics.errors.join("\n"));
    }
  }
});

Deno.test("text demo source exposes worker cancellation, timeout, stale-token guard, limits, and text-only output", async () => {
  const controller = await Deno.readTextFile("public/text-demo.js");
  assert(controller.includes("worker.terminate()"));
  assert(controller.includes("TIMEOUT_MS = 10_000"));
  assert(controller.includes("message.data?.token !== active.token"));
  assert(controller.includes("output.textContent"));
  for (const id of ["text.diff-patch.v1", "text.markdown-cms.v1"]) {
    const html = await Deno.readTextFile(`public/demos/${id}/index.html`);
    assert(html.includes("No performance claim."));
    assert(html.includes("does not upload or store"));
    assert(html.includes('aria-live="polite"'));
    assert(html.includes("Start") && html.includes("Cancel"));
  }
  const markdown = await Deno.readTextFile("public/demos/text.markdown-cms.v1/index.html");
  assert(markdown.includes("Raw HTML permits only"));
  assert(markdown.includes("40,960 UTF-8 bytes"));
  assert(markdown.includes("4,096 non-empty lines"));
  for (
    const workerPath of ["public/text-diff-patch-worker.js", "public/text-markdown-cms-worker.js"]
  ) {
    const worker = await Deno.readTextFile(workerPath);
    assert(worker.includes("unknown variant denied"));
    assert(worker.includes('new Set(["js-controlled", "wasm-linear-controlled"])'));
  }
});
