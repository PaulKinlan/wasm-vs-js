import Ajv2020Module from "ajv2020";
import addFormatsModule from "ajv-formats";
import { assert, assertEquals } from "./assert.ts";

const Ajv2020 = (Ajv2020Module as unknown as { default?: typeof Ajv2020Module }).default ??
  Ajv2020Module;
const addFormats = (addFormatsModule as unknown as { default?: typeof addFormatsModule }).default ??
  addFormatsModule;

Deno.test("results and runner pages expose evidence limits and accessible controls", async () => {
  const index = await Deno.readTextFile("public/index.html");
  const runner = await Deno.readTextFile("public/run.html");
  const css = await Deno.readTextFile("public/styles.css");
  assert(index.includes("No accepted result"));
  assert(index.includes("Inspect implementation evidence"));
  assert(index.includes("Those two validation records were removed"));
  assert(index.includes("Raw run inspector"));
  assert(index.includes("Complete trajectories"));
  assert(index.includes("<caption>"));
  assert(runner.includes("Pilot tool, not accepted evidence"));
  assert(runner.includes("Exact environment JSON"));
  assert(runner.includes('aria-live="polite"'));
  assert(css.includes("prefers-reduced-motion"));
  assert(css.includes("forced-colors"));
  assert(css.includes("overflow-x: auto"));
  assert(!index.includes("Wasm wins"));
});

Deno.test("hosted runner is accessible, bounded, and has no mutation or persistence surface", async () => {
  const page = await Deno.readTextFile("public/run/index.html");
  const script = await Deno.readTextFile("public/hosted-runner.js");
  const core = await Deno.readTextFile("public/hosted-runner-core.js");
  const probes = await Deno.readTextFile("public/provenance-probes.js");
  const worker = await Deno.readTextFile("public/hosted-runner-worker.js");
  const hostedWorkload = await Deno.readTextFile("public/benchmarks/sum-u32/workload.js");
  const sourceWorkload = await Deno.readTextFile("benchmarks/sum-u32/workload.js");
  assert(page.includes("Exploratory single-tab run—not accepted corpus or a performance claim"));
  assert(page.includes('id="start-live-run"'));
  assert(page.includes('role="status"'));
  assert(page.includes('aria-live="polite"'));
  assert(page.includes('min="5" max="50"'));
  assert(page.includes("No result is uploaded or saved"));
  assert(page.includes("exist only in the displayed in-memory result"));
  assert(page.includes("worker-src 'self'"));
  assert(script.includes("new Worker"));
  assert(script.includes("worker.terminate"));
  assert(script.includes("Correctness and fixed work"));
  assert(script.includes("First-use lifecycle"));
  assert(script.includes("Scored post-calibration samples"));
  assert(script.includes("Not launched before scored work because this non-cancellable API"));
  assert(script.includes("Not launched in the repeatable live runner"));
  assert(!script.includes("captureUaSpecificMemory("));
  assert(core.includes("scheduler.yield"));
  assert(core.includes("digest = foldOutput"));
  assert(core.includes("allCorrect = allCorrect && output === ORACLE"));
  assert(worker.includes("await sha256Hex(jsFetch.value)"));
  assert(worker.includes("await import(jsBlobUrl)"));
  assert(worker.includes("URL.revokeObjectURL(jsBlobUrl)"));
  assert(worker.includes('status: "unavailable"'));
  assert(worker.includes('scope: "webassembly-linear-memory-buffer-length"'));
  assert(probes.includes('status: "supported-value"'));
  assert(probes.includes("status, reason"));
  assertEquals(hostedWorkload, sourceWorkload);
  for (
    const forbidden of [
      "/api/runs",
      'method: "POST"',
      "sendBeacon",
      "XMLHttpRequest",
      "WebSocket",
      "localStorage",
      "sessionStorage",
      "indexedDB",
      "document.cookie",
      "serviceWorker.register",
    ]
  ) {
    assert(
      !script.includes(forbidden) && !worker.includes(forbidden),
      `hosted runner contains forbidden surface: ${forbidden}`,
    );
  }
  assert(!script.includes("innerHTML"));
  assert(!script.includes("insertAdjacentHTML"));
  assert(!worker.includes("innerHTML"));
});

Deno.test("workload catalog exposes exact totals, filters, and honest implementation coverage", async () => {
  const page = await Deno.readTextFile("public/benchmarks/index.html");
  const script = await Deno.readTextFile("public/workload-catalog.js");
  assert(page.includes("38-WORKLOAD DENOMINATOR"));
  assert(page.includes("P0 harness/calibration"));
  assert(page.includes("P1 representative applications"));
  assert(page.includes("P2 breadth/stress"));
  assert(page.includes("one harness slice, zero of these 38 catalog entries"));
  assert(page.includes('role="search"'));
  assert(page.includes('aria-live="polite"'));
  assert(script.includes("Showing ${visible.length} of ${catalog.entries.length}"));
  assert(script.includes("entry.oracle.algorithmFamily"));
  assert(!script.includes("innerHTML"));
});

Deno.test("versioned public acceptance package is explicit and contains no invented run evidence", async () => {
  const evidencePage = await Deno.readTextFile("public/evidence/index.html");
  const acceptance = JSON.parse(
    await Deno.readTextFile("public/evidence/v1/acceptance.json"),
  );
  assert(evidencePage.includes("Accepted code, not a performance result"));
  assert(evidencePage.includes("does not present the attestation as proof"));
  const schema = JSON.parse(await Deno.readTextFile("schemas/public-acceptance.schema.json"));
  const ajv = new (Ajv2020 as unknown as new (options: Record<string, unknown>) => {
    compile: (schema: unknown) => ((value: unknown) => boolean) & { errors?: unknown };
  })({ allErrors: true, strict: false });
  (addFormats as unknown as (instance: unknown) => void)(ajv);
  const validate = ajv.compile(schema);
  assert(validate(acceptance), JSON.stringify(validate.errors));
  assert(acceptance.acceptedSource.commit === "9c309c4941d1b8550c15f8549f95a5636a634ef6");
  assert(acceptance.artifact.bytes === 96);
  assert(acceptance.claims.performanceClaimAccepted === false);
  assert(acceptance.claims.pairedFreshLaunchCorpusExists === false);
  assert(acceptance.runtimeValidation.retainedBrowserArtifacts === false);
  assert(acceptance.limitations.some((item: string) => item.includes("intentionally removed")));
  assert(!("runs" in acceptance));
  assert(!("samples" in acceptance));
  assert(acceptance.runtimeValidation.status === "parent-attested-unverified");
  const poisoned = structuredClone(acceptance);
  poisoned.runtimeValidation.secret = "must be rejected";
  assert(!validate(poisoned), "closed schema accepted an additional evidence field");
});

Deno.test("public pages contain no inline script, inline style, or remote asset", async () => {
  for (
    const path of [
      "public/index.html",
      "public/run.html",
      "public/run/index.html",
      "public/benchmarks/index.html",
      "public/evidence/index.html",
    ]
  ) {
    const html = await Deno.readTextFile(path);
    assert(!/<script(?![^>]*\bsrc=)/i.test(html), `${path} has inline script`);
    assert(!/\sstyle=/i.test(html), `${path} has inline style`);
    assert(
      !/https?:\/\//i.test(
        html.replaceAll(
          "https://github.com/PaulKinlan/wasm-vs-js/blob/9c309c4941d1b8550c15f8549f95a5636a634ef6/PLAN.md",
          "",
        ),
      ),
      `${path} has unexpected remote asset`,
    );
  }
});
