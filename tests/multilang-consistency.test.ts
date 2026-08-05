// M4/Multilang: Consistency tests — manifests ↔ adapters ↔ report.
// (a) Every manifest.json workloadId has a matching KERNEL_ADAPTERS key
// (b) Every workload in the build script appears in the regenerated report

import { assert } from "./assert.ts";

async function findManifests(): Promise<Array<{ path: string; workloadId: string }>> {
  const manifests: Array<{ path: string; workloadId: string }> = [];
  for (const entry of Deno.readDirSync("public/benchmarks/multilang-wasm")) {
    if (!entry.name.endsWith(".manifest.json") || entry.name === "multilang-wasm.manifest.json") {
      continue;
    }
    const manifest = JSON.parse(
      await Deno.readTextFile(`public/benchmarks/multilang-wasm/${entry.name}`),
    );
    manifests.push({ path: entry.name, workloadId: manifest.workloadId });
  }
  return manifests;
}

Deno.test("multilang-consistency: every manifest workloadId has a KERNEL_ADAPTERS entry", async () => {
  const runner = await Deno.readTextFile("public/multilang-runner.js");
  const manifests = await findManifests();

  for (const { path, workloadId } of manifests) {
    assert(workloadId, `${path}: missing workloadId`);
    assert(
      runner.includes(`"${workloadId}"`) || runner.includes(`'${workloadId}'`),
      `${path}: workloadId "${workloadId}" not found in KERNEL_ADAPTERS (public/multilang-runner.js)`,
    );
  }
});

Deno.test("multilang-consistency: build script workloads appear in report", async () => {
  const report = JSON.parse(
    await Deno.readTextFile("public/data/multilang-wasm-benchmark-report.v1.json"),
  );
  const reportNames = new Set(report.workloads.map((w: { name: string }) => w.name));

  // Extract workload names from the build script's report.workloads array
  const buildScript = await Deno.readTextFile("scripts/build-multilang-wasm-benchmark.ts");
  const matches = [...buildScript.matchAll(/name: "([^"]+)"/g)];
  const buildWorkloads = new Set(matches.map((m) => m[1]));

  // Every workload name in the build script should appear in the report
  for (const name of buildWorkloads) {
    assert(
      reportNames.has(name),
      `build script workload "${name}" not found in report`,
    );
  }
});

Deno.test("multilang-consistency: report variants have real timing data", async () => {
  const report = JSON.parse(
    await Deno.readTextFile("public/data/multilang-wasm-benchmark-report.v1.json"),
  );
  let withTiming = 0;
  let withoutTiming = 0;

  for (const workload of report.workloads) {
    for (const variant of workload.variants) {
      if (typeof variant.warmExecutionMs === "number" && variant.warmExecutionMs > 0) {
        withTiming++;
      } else {
        withoutTiming++;
      }
    }
  }

  assert(withTiming > 0, "report should have at least some variants with timing");
  assert(
    withoutTiming <= 5,
    `too many variants without timing (${withoutTiming}); expected at most 5`,
  );
});
