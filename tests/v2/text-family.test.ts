import wabtFactory from "wabt";
import { assert, assertEquals } from "../assert.ts";
import {
  generateDiffFixture,
  myersDiff,
  runDiffJS,
  runDiffWasm,
} from "../../benchmarks/v2/text-diff-patch/workload.js";
import {
  generateMarkdownFixture,
  renderMarkdown,
  renderMarkdownWasm,
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

Deno.test("text diff frozen Unicode fixture has exact full-contract shape", () => {
  const fixture = generateDiffFixture();
  assertEquals(fixture.base.length, 100000);
  assertEquals(fixture.targets.map((target) => target.lines.length), [99900, 99000, 90000]);
  assert(fixture.base.some((line) => line.includes("🚀")));
  assert(fixture.base.some((line) => line.includes("é")));
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
  assert(first.documents.some((document) => document.startsWith("![")), "figure transform absent");
  assert(
    first.documents.some((document) => document.startsWith("[link]")),
    "link transform absent",
  );
});

Deno.test("Markdown authored Wasm matches canonical output and rejects adversarial raw HTML", async () => {
  const sources = [
    "# Café 東京\n## é 🚀\n<em>allowed</em>\n<strong>also allowed</strong>\n<script>alert(1)</script>\n<img src=x onerror=alert(1)>\nA & B < C\n",
    "![alt](https://images.example.test/ok.png)\n",
    "[safe](https://docs.example.test/ok)\n",
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
    assert(!linear.html.includes("<script"));
    assert(!linear.html.includes("onerror"));
  }
});

Deno.test("text artifacts and proposal-validation records are reproducible and claim no performance result", async () => {
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
});
