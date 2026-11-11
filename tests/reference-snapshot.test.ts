import { createHandler } from "../server.ts";
import {
  NON_BROWSER_DISCLAIMER,
  type ReferenceSnapshotV1,
  verifyReferenceSnapshot,
} from "../scripts/build-reference-snapshot.ts";
import { assert, assertEquals } from "./assert.ts";

Deno.test("build-reference-snapshot.ts --check matches committed public/data/reference-snapshot.v1.json", async () => {
  const direct = verifyReferenceSnapshot();
  assertEquals(direct.ok, true, direct.error);

  const proc = await new Deno.Command(Deno.execPath(), {
    args: ["run", "--no-lock", "--allow-read", "scripts/build-reference-snapshot.ts", "--check"],
    stdout: "piped",
    stderr: "piped",
  }).output();
  const stderr = new TextDecoder().decode(proc.stderr).trim();
  assertEquals(proc.code, 0, stderr);
});

Deno.test("reference-snapshot.v1.json records required non-browser provenance and per-workload metrics", async () => {
  const snap: ReferenceSnapshotV1 = JSON.parse(
    await Deno.readTextFile("public/data/reference-snapshot.v1.json"),
  );

  assertEquals(snap.schemaVersion, "reference-snapshot.v1");
  assertEquals(snap.scope, "standalone-deno-v8-cli-reference");
  assertEquals(snap.cpuModel, "Apple M4 Pro");
  assertEquals(snap.runtime, "Deno 2.9.0 / V8 14.9.207.2-rusty");
  assertEquals(snap.nonBrowserDisclaimer, NON_BROWSER_DISCLAIMER);

  assertEquals(snap.provenance.scope, "standalone-deno-v8-cli-reference");
  assertEquals(snap.provenance.cpuModel, "Apple M4 Pro");
  assertEquals(snap.provenance.runtime, "Deno 2.9.0 / V8 14.9.207.2-rusty");
  assertEquals(snap.provenance.nonBrowserDisclaimer, NON_BROWSER_DISCLAIMER);
  assertEquals(snap.provenance.sourceLedgers, [
    "public/data/autoresearch-log.v1.json",
    "public/data/multilang-wasm-benchmark-report.v1.json",
    "public/data/worker-lifecycle.v1.json",
    "public/data/benchmarks.json",
  ]);

  assertEquals(snap.summary.totalBenchmarkSpecs, 50);
  assertEquals(snap.summary.playgroundSuites, 48);
  assertEquals(snap.summary.measuredPlaygroundWorkloads, 45);
  assertEquals(snap.summary.workerOnlyPlaygroundSuites, 3);
  assertEquals(snap.summary.distinctManifestsEvaluated, 45);
  assertEquals(snap.workloads.length, 50);

  for (const w of snap.workloads) {
    assert(Boolean(w.slug && w.pageSlug && w.workloadId && w.route));
    assert(Boolean(w.workerLifecycleClass));
    if (w.referenceStatus === "measured") {
      assert(w.kernelTimings !== null, `${w.slug} missing kernelTimings`);
      assert(w.kernelTimings!.jsWarmMs > 0, `${w.slug} jsWarmMs must be > 0`);
      assert(w.kernelTimings!.wasmTrackAWarmMs > 0, `${w.slug} wasmTrackAWarmMs must be > 0`);
      assert(w.kernelTimings!.trackARatioVsJs > 0, `${w.slug} trackARatioVsJs must be > 0`);
      assert(
        typeof w.v128InstructionCount === "number" && w.v128InstructionCount >= 0,
        `${w.slug} missing v128InstructionCount`,
      );
      assert(
        typeof w.simdSpeedup === "number" && w.simdSpeedup > 0,
        `${w.slug} missing simdSpeedup`,
      );
      assert(
        typeof w.arenaReuseSpeedup === "number" && w.arenaReuseSpeedup > 0,
        `${w.slug} missing arenaReuseSpeedup`,
      );
    } else {
      assertEquals(w.referenceStatus, "unavailable");
      assert(Boolean(w.unavailableReason), `${w.slug} missing unavailableReason`);
      // Uncollected evidence must be null, never numeric zero.
      assertEquals(w.kernelTimings, null);
      assertEquals(w.v128InstructionCount, null);
      assertEquals(w.simdSpeedup, null);
      assertEquals(w.arenaReuseSpeedup, null);
    }
  }

  const byPageSlug = new Map(snap.workloads.map((w) => [w.pageSlug, w]));
  assertEquals(byPageSlug.get("audio-fir")?.simdSpeedup, 3.2);
  assertEquals(byPageSlug.get("ml-gemm")?.simdSpeedup, 2.37);
  assertEquals(byPageSlug.get("sum-u32")?.arenaReuseSpeedup, 7.83);
  assertEquals(byPageSlug.get("sum-u32")?.workerLifecycleClass, "symmetric-warm");
  assertEquals(byPageSlug.get("network-pcap-decode-v1")?.arenaReuseSpeedup, 15.5);
});

Deno.test("public server exposes /data/reference-snapshot.v1.json with HTTP 200", async () => {
  const handler = createHandler(null, "public");
  const res = await handler(new Request("http://127.0.0.1/data/reference-snapshot.v1.json"));
  const bodyText = await res.text();
  assertEquals(res.status, 200);
  assert(
    (res.headers.get("content-type") ?? "").includes("application/json"),
    "expected application/json content-type",
  );
  const parsed = JSON.parse(bodyText);
  assertEquals(parsed.schemaVersion, "reference-snapshot.v1");
  assertEquals(parsed.scope, "standalone-deno-v8-cli-reference");
});
