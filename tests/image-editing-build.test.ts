import { assertEquals } from "./assert.ts";

Deno.test("image editing build reproduces fixtures, scalar Wasm, and complete provenance", async () => {
  const paths = [
    "benchmarks/image-editing/fixtures/generated-map-64x48.rgba",
    "benchmarks/image-editing/fixtures/generated-photo-40x30.rgba",
    "benchmarks/image-editing/fixtures/fixture-manifest.json",
    "benchmarks/image-editing/artifacts/image-editing.wasm",
    "benchmarks/image-editing/artifacts/build-manifest.json",
  ];
  const before = await Promise.all(paths.map((path) => Deno.readFile(path)));
  const command = new Deno.Command(Deno.execPath(), {
    args: [
      "run",
      "--allow-read=.",
      "--allow-write=benchmarks/image-editing/artifacts,benchmarks/image-editing/fixtures",
      "--allow-run",
      "scripts/build-image-editing.ts",
    ],
    stdout: "piped",
    stderr: "piped",
  });
  const result = await command.output();
  if (!result.success) throw new Error(new TextDecoder().decode(result.stderr));
  for (let index = 0; index < paths.length; index += 1) {
    assertEquals([...await Deno.readFile(paths[index])], [...before[index]]);
  }

  const manifest = JSON.parse(
    await Deno.readTextFile("benchmarks/image-editing/artifacts/build-manifest.json"),
  );
  assertEquals(manifest.status, "proposal-out-of-catalog");
  assertEquals(manifest.authoritativePerformanceEvidence, false);
  assertEquals(
    manifest.build.command,
    "deno run --allow-read=. --allow-write=benchmarks/image-editing/artifacts,benchmarks/image-editing/fixtures --allow-run scripts/build-image-editing.ts",
  );
  assertEquals(manifest.build.toolchains, ["Deno 2.9.0", "wabt 1.0.37", "node:zlib via Deno"]);
  assertEquals(manifest.variants["wasm-linear-controlled"].features, {
    bulkMemory: false,
    exceptions: false,
    initialPages: 1,
    maximumPages: 1,
    memory64: false,
    memoryGrowth: false,
    simd: false,
    threads: false,
  });
  assertEquals(manifest.oracle.floodFill.changedPixels, 2_795);
  assertEquals(manifest.oracle.lumaGaussianPipeline.algorithmCounters.operations, 22_800);
});
