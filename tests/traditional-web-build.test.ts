import { assert, assertEquals } from "./assert.ts";
import { sha256Hex } from "../lib/canonical.ts";
import { validateBenchmark } from "../lib/contracts.ts";

const HARNESSES = ["vdom-diff-patch", "regex-automata-duel"];

Deno.test("traditional-web builder reproduces only its own artifacts", async () => {
  const before = new Map<string, Uint8Array>();
  for (const id of HARNESSES) {
    for (const name of [`${id}.wasm`, "build-manifest.json"]) {
      const path = `public/artifacts/${id}/${name}`;
      before.set(path, await Deno.readFile(path));
    }
  }
  const frozenSum = await Deno.readFile("public/artifacts/sum-u32/build-manifest.json");
  const frozenPreregistration = await Deno.readFile(
    "experiments/m1-chrome-sum-u32-v1/preregistration.json",
  );
  const result = await new Deno.Command(Deno.execPath(), {
    args: [
      "run",
      "--allow-read=.",
      "--allow-write=public/artifacts",
      "scripts/build-traditional-web.ts",
    ],
    stdout: "piped",
    stderr: "piped",
  }).output();
  if (!result.success) throw new Error(new TextDecoder().decode(result.stderr));
  for (const [path, expected] of before) assertEquals(await Deno.readFile(path), expected);
  assertEquals(await Deno.readFile("public/artifacts/sum-u32/build-manifest.json"), frozenSum);
  assertEquals(
    await Deno.readFile("experiments/m1-chrome-sum-u32-v1/preregistration.json"),
    frozenPreregistration,
  );
  const builder = await Deno.readTextFile("scripts/build-traditional-web.ts");
  assert(!builder.includes("sum-u32"), "traditional builder references frozen sum-u32");
});

Deno.test("reduced benchmark definitions pass the closed benchmark schema", async () => {
  for (const id of HARNESSES) {
    const benchmark = JSON.parse(await Deno.readTextFile(`benchmarks/${id}/benchmark.json`));
    const validation = validateBenchmark(benchmark);
    assert(validation.ok, `${id}: ${validation.errors.join("; ")}`);
    assertEquals(
      benchmark.extensions.reducedHarness.status,
      "out-of-catalog-reduced-conformance-slice",
    );
    assertEquals(benchmark.extensions.reducedHarness.catalogCoverage, false);
    assertEquals(
      benchmark.extensions.reducedHarness.acceptedProductionContract.status,
      "not-implemented",
    );
  }
});

Deno.test("traditional build manifests bind real source graphs, inputs, outputs, and artifacts", async () => {
  for (const id of HARNESSES) {
    const manifest = JSON.parse(
      await Deno.readTextFile(`public/artifacts/${id}/build-manifest.json`),
    );
    assert(!/^0+$/.test(manifest.sourceSha256));
    assert(!/^0+$/.test(manifest.input.sha256));
    assert(!/^0+$/.test(manifest.oracle.outputSha256));
    const lines: string[] = [];
    for (const source of manifest.sources) {
      const bytes = await Deno.readFile(source.path);
      assertEquals(source.bytes, bytes.byteLength);
      assertEquals(source.sha256, await sha256Hex(bytes));
      lines.push(`${source.path}\0${source.sha256}\n`);
    }
    assertEquals(manifest.sourceSha256, await sha256Hex(lines.join("")));
    for (const variant of Object.values(manifest.variants) as Array<Record<string, unknown>>) {
      const footprint = variant.footprint as Record<string, number>;
      assert(footprint.rawBytes > 0);
      assert(footprint.requestCount > 0);
      assert(footprint.gzipBytes > 0);
      assert(footprint.brotliBytes > 0);
    }
  }
});
