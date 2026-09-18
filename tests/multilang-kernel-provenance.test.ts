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
//
// Schema v2 split "does this reproduce?" into one observation per toolchain.
// Under v1 it was a bare boolean, so the second machine to run the builder
// either overwrote the first machine's verdicts or had to be excluded — and
// with Homebrew clang satisfying the `clang version 22.1.8` pin textually while
// reproducing none of the C or C++ artifacts, the two machines genuinely
// disagree. Both answers are now recorded, each under the fingerprint of the
// toolchain that produced it.

import { assert, assertEquals } from "./assert.ts";
import { planBuilds } from "../scripts/build-multilang-kernels.ts";

interface Reproduction {
  toolchain: string;
  result: "identical" | "differs" | "notCommitted";
  artifactSha256: string;
  firstObserved: string;
  lastObserved: string;
}

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
  reproductions: Reproduction[];
}

interface Provenance {
  schemaVersion: number;
  kernelCount: number;
  reproducesCommittedBytes: number;
  doesNotReproduceCommittedBytes: number;
  reproducibilityIsAMeasurement: string;
  toolchain: Record<string, string>;
  toolchains: Record<string, { id?: string; tools?: Record<string, { version: string }> }>;
  reproductionsByToolchain: Record<string, Record<string, number>>;
  kernels: KernelRecord[];
}

const ARTIFACT_DIR = new URL("../public/artifacts/multilang-wasm-benchmark/", import.meta.url);

const provenance: Provenance = JSON.parse(
  await Deno.readTextFile(new URL("kernel-build-provenance.v1.json", ARTIFACT_DIR)),
);

async function sha256Hex(bytes: Uint8Array): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", bytes as Uint8Array<ArrayBuffer>);
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

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
    assertEquals(await sha256Hex(bytes), k.sourceSha256);
  }
});

Deno.test("the recorded artifact hash is the committed artifact's", async () => {
  // Under v1 this field held whatever the last run compiled, so for the 128
  // entries that do not reproduce it did not describe the file it sat beside.
  // What a particular machine compiled belongs in that machine's observation.
  for (const k of provenance.kernels) {
    let bytes: Uint8Array;
    try {
      bytes = await Deno.readFile(new URL(k.artifact, ARTIFACT_DIR));
    } catch {
      continue; // No committed artifact to describe.
    }
    assertEquals(await sha256Hex(bytes), k.artifactSha256, `${k.artifact}: hash is not the file's`);
    assertEquals(bytes.byteLength, k.artifactBytes, `${k.artifact}: byte count is not the file's`);
  }
});

Deno.test("every reproduction names a toolchain the record describes", () => {
  assertEquals(provenance.schemaVersion, 2);
  const known = new Set(Object.keys(provenance.toolchains));
  assert(known.size > 0, "no toolchain is described");
  for (const k of provenance.kernels) {
    assert(
      Array.isArray(k.reproductions) && k.reproductions.length > 0,
      `${k.artifact}: no reproduction observation — a recipe nobody has run is not evidence`,
    );
    for (const r of k.reproductions) {
      assert(known.has(r.toolchain), `${k.artifact}: observation from unknown ${r.toolchain}`);
      assert(
        ["identical", "differs", "notCommitted"].includes(r.result),
        `${k.artifact}: unknown result ${r.result}`,
      );
      assert(/^[0-9a-f]{64}$/.test(r.artifactSha256), `${k.artifact}: bad observed hash`);
      // An observation is a claim about one machine at one time. "unrecorded"
      // is allowed for the v1 entries whose date was never captured; a blank is
      // not.
      assert(r.firstObserved.length > 0 && r.lastObserved.length > 0, `${k.artifact}: no date`);
    }
    const ids = k.reproductions.map((r) => r.toolchain);
    assertEquals(new Set(ids).size, ids.length, `${k.artifact}: two observations from one machine`);
  }
});

Deno.test("an identical observation agrees with the committed hash", () => {
  for (const k of provenance.kernels) {
    for (const r of k.reproductions.filter((r) => r.result === "identical")) {
      assertEquals(
        r.artifactSha256,
        k.artifactSha256,
        `${k.artifact}: ${r.toolchain} is recorded as identical but produced different bytes`,
      );
    }
    for (const r of k.reproductions.filter((r) => r.result === "differs")) {
      assert(
        r.artifactSha256 !== k.artifactSha256,
        `${k.artifact}: ${r.toolchain} is recorded as differing but produced the committed bytes`,
      );
    }
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
  // The summary boolean is a roll-up of the observations, not a separate claim.
  for (const k of provenance.kernels) {
    assertEquals(
      k.reproducesCommittedBytes,
      k.reproductions.some((r) => r.result === "identical"),
      `${k.artifact}: summary disagrees with its own observations`,
    );
  }
});

Deno.test("the per-toolchain breakdown covers every kernel once", () => {
  for (const [id, tally] of Object.entries(provenance.reproductionsByToolchain)) {
    assert(
      Object.keys(provenance.toolchains).includes(id),
      `breakdown names unknown toolchain ${id}`,
    );
    const total = Object.values(tally).reduce((a, b) => a + b, 0);
    assertEquals(total, provenance.kernelCount, `${id}: breakdown does not cover every kernel`);
    const counted = provenance.kernels.filter((k) =>
      k.reproductions.some((r) =>
        r.toolchain === id && r.result === "identical"
      )
    ).length;
    assertEquals(tally.identical, counted, `${id}: identical count disagrees with observations`);
    // A machine that never ran a given recipe has no result for it. That is
    // "notObserved", not a failure to reproduce.
    assert(tally.notObserved >= 0, `${id}: missing notObserved count`);
  }
  assertEquals(
    Object.keys(provenance.reproductionsByToolchain).sort(),
    Object.keys(provenance.toolchains).sort(),
  );
});

Deno.test("the toolchain that produced the record is named", () => {
  assert(provenance.toolchain.clang?.includes("clang"), "clang version not recorded");
  assert(provenance.toolchain.rustc?.includes("rustc"), "rustc version not recorded");
  for (const [id, entry] of Object.entries(provenance.toolchains)) {
    const versions = Object.values(entry.tools ?? {}).map((t) => t.version);
    assert(versions.length > 0, `${id}: describes no tools`);
    for (const v of versions) {
      assert(v.length > 0, `${id}: a tool has a blank version instead of "unavailable"`);
    }
  }
});

Deno.test("the record says that reproducibility is a measurement", () => {
  // Without this the counts read as a property of the artifacts, which is the
  // misreading the v1 schema invited.
  assert(
    /property of the machine/i.test(provenance.reproducibilityIsAMeasurement ?? ""),
    "the ledger must state whose measurement the reproduction counts are",
  );
});
