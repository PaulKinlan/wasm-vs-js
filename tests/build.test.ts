import { assert, assertEquals } from "./assert.ts";
import { sha256Hex } from "../lib/canonical.ts";

const ARTIFACTS = ["sum-u32", "vdom-diff-patch", "regex-automata-duel"];

Deno.test("pinned build reproduces every Wasm artifact and manifest byte-for-byte", async () => {
  const before = new Map<string, Uint8Array>();
  for (const id of ARTIFACTS) {
    for (const name of [`${id}.wasm`, "build-manifest.json"]) {
      const path = `public/artifacts/${id}/${name}`;
      before.set(path, await Deno.readFile(path));
    }
  }
  const result = await new Deno.Command(Deno.execPath(), {
    args: ["task", "build"],
    stdout: "piped",
    stderr: "piped",
  }).output();
  if (!result.success) throw new Error(new TextDecoder().decode(result.stderr));
  for (const [path, expected] of before) assertEquals(await Deno.readFile(path), expected);
});

Deno.test("reduced traditional-web slices cannot claim accepted-v2 catalog coverage", async () => {
  for (const id of ["vdom-diff-patch", "regex-automata-duel"]) {
    const benchmark = JSON.parse(await Deno.readTextFile(`benchmarks/${id}/benchmark.json`));
    assertEquals(benchmark.catalogStatus, "out-of-catalog-reduced-conformance-slice");
    assertEquals(benchmark.catalogCoverage, false);
    assertEquals(benchmark.acceptedV2ProductionContract.status, "not-implemented");
  }
});

Deno.test("build manifests bind real source graphs, inputs, outputs, and artifacts", async () => {
  for (const id of ARTIFACTS) {
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
