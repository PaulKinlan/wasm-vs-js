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
  const evidence = await Deno.readTextFile("public/evidence/index.html");
  const app = await Deno.readTextFile("public/app.js");
  const css = await Deno.readTextFile("public/styles.css");
  assert(index.includes("Accepted performance corpus: none"));
  assert(index.includes("Check implementation evidence"));
  assert(index.includes("unverified and supplies no timing evidence"));
  assert(index.includes("Raw run inspector"));
  assert(index.includes('href="/evidence/v2-proposals/"'));
  assert(index.includes('href="/data/sum-u32-inspectability.v1.json"'));
  assert(evidence.includes("Open the source/build manifest without JavaScript"));
  assert(app.includes("renderResultInspectability(inspectability, run)"));
  assert(
    app.includes('runsContainer.replaceChildren(evidenceFallback("Local result loading failed."))'),
  );
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
  assert(page.includes("Status: exploratory"));
  assert(page.includes('id="start-live-run"'));
  assert(page.includes('role="status"'));
  assert(page.includes('aria-live="polite"'));
  assert(page.includes('min="5" max="50"'));
  assert(page.includes("The page does not upload or save the result"));
  assert(page.includes("stay in memory and disappear when the tab closes"));
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
  assert(page.includes("Coverage is 0/38"));
  assert(page.includes("v2 proposal implementation inventory"));
  assert(page.includes("Runnable demos: 12"));
  assert(page.includes("8 full proposal-validation routes and 4 reduced-fixture routes"));
  assertEquals(page.match(/data-v2-id=/g)?.length, 20);
  assert(page.includes('role="search"'));
  assert(page.includes('aria-live="polite"'));
  assert(script.includes("Showing ${visible.length} of ${catalog.entries.length}"));
  assert(script.includes("entry.oracle.algorithmFamily"));
  assert(!script.includes("innerHTML"));
});

Deno.test("public M1 experiment is inspectable without claiming authorization or results", async () => {
  const page = await Deno.readTextFile("public/experiments/index.html");
  const canonical = await Deno.readTextFile(
    "experiments/m1-chrome-sum-u32-v1/preregistration.json",
  );
  const published = await Deno.readTextFile("public/experiments/m1-chrome-sum-u32-v1.json");
  assertEquals(published, canonical);
  assert(page.includes("Corpus status: not collected"));
  assert(page.includes("20 committed pairs before analysis"));
  assert(page.includes("60 attempted launches per stratum"));
  assert(page.includes("exact distribution-free sign/order-statistic interval"));
  assert(page.includes("supplies descriptive sensitivity"));
  assert(page.includes("template-only-not-consumed"));
  assert(!page.includes("benchmark winner"));
});

Deno.test("v2 proposal result page has six per-record panels and raw-HTML fallbacks", async () => {
  const page = await Deno.readTextFile("public/evidence/v2-proposals/index.html");
  const script = await Deno.readTextFile("public/v2-results.js");
  assertEquals((page.match(/data-v2-result-src=/g) ?? []).length, 6);
  assertEquals((page.match(/Open audio .* result JSON/g) ?? []).length, 6);
  assert(page.includes("Performance claims: none."));
  assert(page.includes('role="status"'));
  assert(page.includes('<script type="module" src="/v2-results.js"></script>'));
  assert(script.includes("renderResultInspectability(container, await response.json())"));
  assert(script.includes("RESULT_ROUTES.has(source.pathname)"));
  assert(script.includes("fallback ?? directLink"));
  assert(!script.includes("innerHTML"));
  assert(!script.includes("insertAdjacentHTML"));
});

Deno.test("versioned public acceptance package is explicit and contains no invented run evidence", async () => {
  const evidencePage = await Deno.readTextFile("public/evidence/index.html");
  const acceptance = JSON.parse(
    await Deno.readTextFile("public/evidence/v1/acceptance.json"),
  );
  assert(evidencePage.includes("The code passed; no accepted performance corpus exists yet"));
  assert(evidencePage.includes("Independent review therefore cannot verify these observations"));
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

Deno.test("local corpus collector is absent from the deployable public tree", async () => {
  for (const path of ["public/corpus-run.html", "public/corpus-run.js"]) {
    let exists = true;
    try {
      await Deno.stat(path);
    } catch (error) {
      if (error instanceof Deno.errors.NotFound) exists = false;
      else throw error;
    }
    assert(!exists, `${path} would leak through static hosting`);
  }
});

Deno.test("public pages contain no inline script, inline style, or remote asset", async () => {
  for (
    const path of [
      "public/index.html",
      "public/run.html",
      "public/run/index.html",
      "public/benchmarks/index.html",
      "public/benchmarks/regex-automata-duel-demo/index.html",
      "public/benchmarks/vdom-diff-patch-demo/index.html",
      "public/evidence/index.html",
      "public/experiments/index.html",
      "public/evidence/v2-proposals/index.html",
      "public/demos/game-canvas-arcade/index.html",
      "public/demos/game-canvas-entity-pathfinding/index.html",
      "public/demos/game-dom-tactics-grid/index.html",
    ]
  ) {
    const html = await Deno.readTextFile(path);
    assert(!/<script(?![^>]*\bsrc=)/i.test(html), `${path} has inline script`);
    assert(!/\sstyle=/i.test(html), `${path} has inline style`);
    const withoutAllowedLinks = html
      .replaceAll(
        "https://github.com/PaulKinlan/wasm-vs-js/blob/9c309c4941d1b8550c15f8549f95a5636a634ef6/PLAN.md",
        "",
      )
      .replaceAll(
        /https:\/\/github\.com\/PaulKinlan\/wasm-vs-js\/commit\/[a-f0-9]+/g,
        "",
      )
      .replaceAll(
        /https:\/\/github\.com\/PaulKinlan\/wasm-vs-js\/blob\/(?:30b41425227dc139304f25942d0be0d933fa28c9|9691f0e8353a221880f365712a1ebbec18b7dde4)\/[a-zA-Z0-9._/-]+(?:#L[0-9]+(?:-L[0-9]+)?)?/g,
        "",
      );
    assert(!/https?:\/\//i.test(withoutAllowedLinks), `${path} has an unexpected remote URL`);
    assert(
      !/<(?:script|link|img)[^>]+(?:src|href)="https?:\/\//i.test(html),
      `${path} loads a remote asset`,
    );
  }
});
