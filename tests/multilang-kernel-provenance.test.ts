// 135 of the 176 committed .wasm artifacts under
// public/artifacts/multilang-wasm-benchmark/ had no build step anywhere in the
// repository, no entry in any build manifest, and no recorded compiler flags —
// binaries of unknown origin driving published language comparisons, where
// PLAN.md requires every variant to record its build recipe.
//
// scripts/build-multilang-kernels.ts now derives a recipe for every kernel a
// workload manifest declares and records it with source and artifact hashes.
// This test holds two things: the record covers what the manifests declare,
// and it states honestly how many of those recipes actually reproduce the
// committed bytes rather than implying all of them do.

import { assert, assertEquals } from "./assert.ts";
import { planBuilds } from "../scripts/build-multilang-kernels.ts";

interface KernelRecord {
  workload: string;
  engine: string;
  lang: string;
  source: string;
  sourceSha256: string;
  artifact: string;
  artifactSha256: string;
  artifactBytes: number;
  command: string;
  reproducesCommittedBytes: boolean;
}

interface Provenance {
  schemaVersion: number;
  kernelCount: number;
  reproducesCommittedBytes: number;
  doesNotReproduceCommittedBytes: number;
  toolchain: Record<string, string>;
  kernels: KernelRecord[];
}

const provenance: Provenance = JSON.parse(
  await Deno.readTextFile(
    new URL(
      "../public/artifacts/multilang-wasm-benchmark/kernel-build-provenance.v1.json",
      import.meta.url,
    ),
  ),
);

Deno.test("every kernel a manifest declares has a recorded build recipe", async () => {
  const { builds } = await planBuilds();
  const recorded = new Set(provenance.kernels.map((k) => `${k.workload}/${k.engine}`));
  const missing = builds
    .map((b) => `${b.workload}/${b.engineKey}`)
    .filter((id) => !recorded.has(id));
  assert(
    missing.length === 0,
    `kernels without a recorded recipe: ${missing.slice(0, 10).join(", ")}`,
  );
  assertEquals(provenance.kernelCount, provenance.kernels.length);
});

Deno.test("each record carries a runnable command and both content hashes", () => {
  assert(provenance.kernels.length > 0, "provenance records no kernels");
  for (const k of provenance.kernels) {
    assert(/^[0-9a-f]{64}$/.test(k.sourceSha256), `${k.artifact}: bad source hash`);
    assert(/^[0-9a-f]{64}$/.test(k.artifactSha256), `${k.artifact}: bad artifact hash`);
    assert(k.artifactBytes > 0, `${k.artifact}: zero-length artifact`);
    assert(k.command.length > 0, `${k.artifact}: no command recorded`);
    // The command must be repo-relative, not the absolute paths of whoever
    // happened to run the build.
    assert(!k.command.includes("/home/"), `${k.artifact}: command leaks an absolute path`);
    assert(k.source.startsWith("benchmarks/"), `${k.artifact}: source outside benchmarks/`);
  }
});

Deno.test("the recorded source hash matches the source on disk", async () => {
  for (const k of provenance.kernels) {
    const bytes = await Deno.readFile(new URL(`../${k.source}`, import.meta.url));
    const digest = await crypto.subtle.digest("SHA-256", bytes as Uint8Array<ArrayBuffer>);
    const hex = [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, "0")).join("");
    assertEquals(hex, k.sourceSha256);
  }
});

Deno.test("the reproduction counts are stated and add up", () => {
  const reproduced = provenance.kernels.filter((k) => k.reproducesCommittedBytes).length;
  assertEquals(provenance.reproducesCommittedBytes, reproduced);
  assertEquals(
    provenance.reproducesCommittedBytes + provenance.doesNotReproduceCommittedBytes,
    provenance.kernelCount,
  );
  // Not an aspiration: the point of the record is that the shortfall is
  // visible. If this ever reaches zero the project has closed the gap.
  assert(
    provenance.doesNotReproduceCommittedBytes >= 0,
    "reproduction shortfall must be reported, not omitted",
  );
});

Deno.test("the toolchain that produced the record is named", () => {
  assert(provenance.toolchain.clang?.includes("clang"), "clang version not recorded");
  assert(provenance.toolchain.rustc?.includes("rustc"), "rustc version not recorded");
});
