import { assert, assertEquals } from "./assert.ts";
import {
  formatMarkdown,
  renderWasmBuildDocumentation,
  verifyWasmInventory,
} from "../scripts/build-all-wasm.ts";
import { BENCHMARK_BUILD_SPECS, WASM_BUILD_LANES } from "../scripts/wasm-build-registry.ts";
import { verifyAutoResearchLog } from "../scripts/run-autoresearch.ts";
import { verifyWorkerLifecycleAudit } from "../scripts/audit-worker-lifecycle.ts";
import { createHandler } from "../server.ts";
import { scopeTableHtml, sourceToGitHubUrl, toCsv } from "../public/benchmark-report.js";
import {
  getLastAgreementRecord,
  requireEngineAgreement,
  resolveEngineSource,
} from "../public/multilang-runner.js";
import {
  buildExplorerRows,
  describePipelineToolchains,
  explorerCsvRecords,
  extractOutputDigest,
} from "../public/unified-runner.js";

const GITHUB_BLOB_PREFIX = "https://github.com/PaulKinlan/wasm-vs-js/blob/main/";

async function fileExists(path: string): Promise<boolean> {
  try {
    const st = await Deno.stat(path);
    return st.isFile;
  } catch {
    return false;
  }
}

Deno.test("wasm build registry accounts for all 50 tests and 100% of committed .wasm files", async () => {
  const report = await verifyWasmInventory();
  assertEquals(report.missingPaths, []);
  assertEquals(report.unaccountedWasmFiles, []);
  assertEquals(report.specCount, 50);
  assert(
    report.wasmFilesFound >= 300,
    `expected >= 300 wasm files, found ${report.wasmFilesFound}`,
  );
  assertEquals(report.accountedWasmFiles, report.wasmFilesFound);
  assertEquals(report.ok, true);
});

Deno.test("docs/wasm-build-and-equivalence.md is synchronized with the build registry", async () => {
  const expected = await formatMarkdown(renderWasmBuildDocumentation());
  const committed = await Deno.readTextFile("docs/wasm-build-and-equivalence.md");
  assertEquals(
    committed,
    expected,
    "docs/wasm-build-and-equivalence.md drifted from scripts/build-all-wasm.ts --write-doc",
  );
  for (const lane of WASM_BUILD_LANES) {
    assert(committed.includes(lane.command), `missing build lane command: ${lane.command}`);
  }
  for (const spec of BENCHMARK_BUILD_SPECS) {
    assert(committed.includes(spec.route), `missing benchmark route in build doc: ${spec.route}`);
    assert(committed.includes(spec.id), `missing benchmark id in build doc: ${spec.id}`);
    assert(committed.includes(spec.buildCommand), `missing build command for ${spec.slug}`);
  }
});

Deno.test("every benchmark source link serves HTTP 200 and maps to a real repo file on GitHub", async () => {
  const handler = createHandler(null, "public");
  const servedPaths = new Set<string>(["/docs/wasm-build-and-equivalence.md"]);
  const githubUrls = new Set<string>();

  const benchmarks = JSON.parse(await Deno.readTextFile("public/data/benchmarks.json"));
  assertEquals(benchmarks.length, 50);

  for (const item of benchmarks) {
    assert(
      typeof item.jsSourceUrl === "string" && item.jsSourceUrl.startsWith("/"),
      `${item.slug} missing jsSourceUrl`,
    );
    assert(
      typeof item.wasmSourceUrl === "string" && item.wasmSourceUrl.startsWith("/"),
      `${item.slug} missing wasmSourceUrl`,
    );
    assert(
      typeof item.buildCommand === "string" && item.buildCommand.length > 0,
      `${item.slug} missing buildCommand`,
    );
    assert(
      Array.isArray(item.oracleTests) && item.oracleTests.length > 0,
      `${item.slug} missing oracleTests`,
    );
    servedPaths.add(item.jsSourceUrl);
    servedPaths.add(item.wasmSourceUrl);
    if (item.jsGitHubUrl) githubUrls.add(item.jsGitHubUrl);
    if (item.wasmGitHubUrl) githubUrls.add(item.wasmGitHubUrl);
  }

  for await (const entry of Deno.readDir("public/benchmarks/multilang-wasm")) {
    if (!entry.isFile || !entry.name.endsWith(".manifest.json")) continue;
    const manifest = JSON.parse(
      await Deno.readTextFile(`public/benchmarks/multilang-wasm/${entry.name}`),
    );
    const primaryKernel = manifest.kernels?.[0] ?? null;
    for (const eng of manifest.engines ?? []) {
      const resolved = resolveEngineSource(manifest, eng, primaryKernel);
      assert(
        typeof resolved === "string" && resolved.length > 0,
        `${entry.name} engine ${eng.key} failed to resolve source path`,
      );
      const urlPath = resolved.startsWith("/") ? resolved : `/${resolved}`;
      servedPaths.add(urlPath);
      const gh = sourceToGitHubUrl(urlPath);
      assert(
        typeof gh === "string" && gh.startsWith(GITHUB_BLOB_PREFIX),
        `sourceToGitHubUrl failed for ${urlPath}`,
      );
      githubUrls.add(gh);
    }
  }

  const badHttp: string[] = [];
  for (const p of servedPaths) {
    const res = await handler(new Request(`http://127.0.0.1${p}`));
    await res.arrayBuffer();
    if (res.status !== 200) {
      badHttp.push(`${p} -> ${res.status}`);
    }
  }
  assertEquals(badHttp, []);

  const missingRepoFiles: string[] = [];
  for (const gh of githubUrls) {
    assert(gh.startsWith(GITHUB_BLOB_PREFIX), `unexpected GitHub URL prefix: ${gh}`);
    const repoPath = gh.slice(GITHUB_BLOB_PREFIX.length);
    if (!(await fileExists(repoPath))) {
      missingRepoFiles.push(`${gh} -> missing ${repoPath}`);
    }
  }
  assertEquals(missingRepoFiles, []);
});

Deno.test("output consistency helpers record exact digests, reject mismatches, and render source + digest cells", () => {
  const label = "unit-sum-u32-consistency";
  const agreed = requireEngineAgreement(
    label,
    {
      js: () => 0x89abcdef,
      wat: () => 0x89abcdef,
      rs: () => 0x89abcdef,
      c: () => 0x89abcdef,
    },
    0x89abcdef,
  );
  assertEquals(agreed, 0x89abcdef);

  const record = getLastAgreementRecord(label);
  assert(record !== null);
  assertEquals(record.agreedHex, "0x89abcdef");
  assertEquals(record.engineCount, 4);
  assertEquals(record.perEngine.get("rs"), "0x89abcdef");

  let threwMismatch = false;
  try {
    requireEngineAgreement("unit-mismatch-probe", {
      js: () => 0x11111111,
      wasm: () => 0x22222222,
    });
  } catch (err) {
    threwMismatch = err instanceof Error && err.message.includes("engines disagree");
  }
  assert(threwMismatch, "requireEngineAgreement must reject mismatched engine outputs");

  assertEquals(
    extractOutputDigest(
      {
        sha256: "fba0623a3af7679b1e95b79c7f454c38e1ac2123de5ebf3a7a86bc43bff16550",
      },
      "wasm",
    ),
    "sha256:fba0623a3af7679b1e95b79c7f454c38e1ac2123de5ebf3a7a86bc43bff16550",
  );
  assertEquals(extractOutputDigest({ fnv1a: 0x0000abcd }, "javascript"), "0x0000abcd");
  assertEquals(extractOutputDigest({ sum: 499999500000 }, "javascript"), "sum=499999500000");
  // Unsupported or uncollected output evidence is never numeric zero.
  assertEquals(extractOutputDigest({}, "javascript"), null);
  assertEquals(extractOutputDigest(null, "wasm"), null);

  const byScope = buildExplorerRows({
    primaryStats: {
      jsStats: {
        samples: [1.2, 1.1, 1.15],
        outputDigest: "0x89abcdef",
        pipelineSummary: { p50Ms: 1.15 },
      },
      wasmStats: {
        samples: [0.4, 0.38, 0.39],
        outputDigest: "0x89abcdef",
        pipelineSummary: { p50Ms: 0.39 },
      },
    },
    multilangResults: {
      sum: [
        {
          key: "js",
          label: "JavaScript",
          source: "benchmarks/sum-u32/workload.js",
          outputDigest: "0x89abcdef",
          equivalence: "bit-identical",
          samples: [1.0, 0.98, 0.99],
        },
        {
          key: "wat",
          label: "Hand-written WAT",
          source: "benchmarks/sum-u32/sum-u32.wat",
          outputDigest: "0x89abcdef",
          equivalence: "bit-identical",
          bytes: 121,
          binaryUrl: "/artifacts/sum-u32/sum-u32.wasm",
          samples: [0.32, 0.31, 0.31],
        },
      ],
    },
    domResults: null,
    manifest: {
      kernels: ["sum"],
      engines: [
        { key: "js", source: "benchmarks/sum-u32/workload.js" },
        { key: "wat", source: "benchmarks/sum-u32/sum-u32.wat" },
      ],
    },
    catalogSpec: {
      jsSourceUrl: "/benchmarks/sum-u32/workload.js",
      jsGitHubUrl: `${GITHUB_BLOB_PREFIX}benchmarks/sum-u32/workload.js`,
      wasmSourceUrl: "/benchmarks/sum-u32/sum-u32.wat",
      wasmGitHubUrl: `${GITHUB_BLOB_PREFIX}benchmarks/sum-u32/sum-u32.wat`,
      wasmArtifactUrl: "/artifacts/sum-u32/sum-u32.wasm",
    },
  });

  assertEquals(byScope.kernel.length, 2);
  assertEquals(byScope.kernel[0].outputDigest, "0x89abcdef");
  assertEquals(
    byScope.kernel[1].githubSourceUrl,
    `${GITHUB_BLOB_PREFIX}benchmarks/sum-u32/sum-u32.wat`,
  );
  assertEquals(byScope.pipeline.length, 2);
  assertEquals(byScope.pipeline[0].source, "/benchmarks/sum-u32/workload.js");
  assertEquals(byScope.pipeline[1].source, "/benchmarks/sum-u32/sum-u32.wat");

  const html = scopeTableHtml({
    scopeId: "kernel",
    rows: byScope.kernel,
    baselineLabel: "JavaScript",
    iterations: 3,
  });
  assert(html.includes('<th scope="col">Output</th>'));
  assert(html.includes("0x89abcdef"));
  assert(html.includes('href="/benchmarks/sum-u32/sum-u32.wat"'));
  assert(html.includes(`href="${GITHUB_BLOB_PREFIX}benchmarks/sum-u32/sum-u32.wat"`));

  const csv = toCsv(explorerCsvRecords(byScope));
  assert(csv.includes("outputDigest,source"));
  assert(csv.includes('"0x89abcdef","/benchmarks/sum-u32/sum-u32.wat"'));
});

Deno.test("isolated Track B auto-research log covers all 45 manifests, verifies oracle digests, and serves all binaries over HTTP", async () => {
  const check = await verifyAutoResearchLog();
  assertEquals(check.errors, []);
  assertEquals(check.ok, true);
  assertEquals(check.workloadCount, 45);
  assertEquals(check.artifactCount, 45);

  const handler = createHandler(null, "public");
  for (const path of ["/data/autoresearch-log.v1.json", "/docs/autoresearch-log.md"]) {
    const res = await handler(new Request(`http://127.0.0.1${path}`));
    await res.arrayBuffer();
    assertEquals(res.status, 200, `${path} did not return HTTP 200`);
  }

  const logRaw = await Deno.readTextFile("public/data/autoresearch-log.v1.json");
  assert(!logRaw.includes("/Users/"), "sanitizedHostPaths must redact personal home directories");
  const log = JSON.parse(logRaw);
  assert(log.buildInfrastructure !== undefined, "missing buildInfrastructure block");
  assert(log.buildInfrastructure.hardware.cpuModel.length > 0);
  assert(log.buildInfrastructure.compilers.clang.version.includes("clang"));
  assert(log.buildInfrastructure.compilers.wasmLd.version.includes("LLD"));
  assert(log.buildInfrastructure.compilers.rustc.version.includes("rustc"));
  assertEquals(log.buildInfrastructure.compilers.wabt.version, "1.0.37");
  assert(/^[0-9a-f]{64}$/.test(log.buildInfrastructure.pins.toolchainPinSha256));
  assert(/^[0-9a-f]{64}$/.test(log.buildInfrastructure.pins.denoLockSha256));
  assertEquals(log.workloads.length, 45);
  for (const w of log.workloads) {
    assert(w.simdArtifact !== null, `${w.manifestSlug} missing isolated simdArtifact`);
    assert(
      w.simdArtifact.servedUrl.startsWith("/artifacts/autoresearch/"),
      `${w.manifestSlug} binary must stay isolated in /artifacts/autoresearch/`,
    );
    assertEquals(w.simdArtifact.oracleVerified, true);
    assertEquals(w.probes.length, 5, `${w.manifestSlug} expected all 5 empirical probes`);
    const res = await handler(new Request(`http://127.0.0.1${w.simdArtifact.servedUrl}`));
    const bytes = new Uint8Array(await res.arrayBuffer());
    assertEquals(res.status, 200, `${w.simdArtifact.servedUrl} returned ${res.status}`);
    assertEquals(bytes.byteLength, w.simdArtifact.bytes);
  }

  const mlRunner = await Deno.readTextFile("public/multilang-runner.js");
  assert(
    !mlRunner.includes("No static Track B binary compiled for this kernel"),
    "Group 3 must render the pre-computed auto-research log rather than an empty placeholder",
  );
  assert(mlRunner.includes("/data/autoresearch-log.v1.json"));
});

Deno.test("methodology page and runner diagnostics explain Worker Wasm task pipelines and avoid stock phrases", async () => {
  const handler = createHandler(null, "public");
  const res = await handler(new Request("http://127.0.0.1/methodology/"));
  const html = await res.text();
  assertEquals(res.status, 200);
  assert(html.includes('id="measurement-scopes"'));
  assert(html.includes('id="worker-wasm-explained"'));
  assert(html.includes("4 / 49"));
  assert(html.includes("33 / 49"));
  assert(html.includes("8 / 49"));
  assert(html.includes("39 / 49"));
  assert(html.includes("37 / 49"));
  assert(html.includes("45 / 49"));
  assert(html.includes("/docs/worker-lifecycle-audit.md"));
  assert(html.includes("/data/worker-lifecycle.v1.json"));
  assert(!html.includes('style="'), "methodology page must obey CSP style-src 'self'");

  const unified = await Deno.readTextFile("public/unified-runner.js");
  assert(unified.includes("/methodology/#worker-wasm-explained"));
  assert(unified.includes("/docs/worker-lifecycle-audit.md"));

  const playground = await Deno.readTextFile("public/playground.js");
  assert(playground.includes("/methodology/#worker-wasm-explained"));
  assert(playground.includes("/docs/worker-lifecycle-audit.md"));
  assert(playground.includes("Scope 1 — In-Memory Kernel Compute"));

  const catalogUi = await Deno.readTextFile("public/workload-catalog.js");
  assert(catalogUi.includes("/docs/worker-lifecycle-audit.md"));
  assert(!catalogUi.includes("innerHTML"), "workload-catalog.js must stay free of innerHTML");

  const stockPhrases = [
    "in today's rapidly evolving landscape",
    "in the realm of",
    "when it comes to",
    "at its core",
    "let's dive into",
    "it's worth noting that",
    "it's important to note that",
    "a testament to",
    "not just ",
    "not only ",
    "this is where ",
    "whether you're ",
    "despite ongoing challenges",
    "looking ahead",
    "in conclusion",
    "overall",
    "ultimately",
    "i hope this helps",
  ];
  for (
    const path of [
      "public/methodology/index.html",
      "docs/autoresearch-log.md",
      "docs/wasm-build-and-equivalence.md",
      "docs/worker-lifecycle-audit.md",
    ]
  ) {
    const lower = (await Deno.readTextFile(path)).toLocaleLowerCase();
    for (const phrase of stockPhrases) {
      assert(!lower.includes(phrase), `${path} contains stock phrase: ${phrase}`);
    }
  }
});

Deno.test("worker lifecycle audit stays synchronized with all 49 worker scripts, catalog metadata, and HTTP routes", async () => {
  const check = await verifyWorkerLifecycleAudit();
  assertEquals(check.errors, []);
  assertEquals(check.ok, true);
  assertEquals(check.entryCount, 50);
  assertEquals(check.workerCount, 49);

  const ledger = JSON.parse(await Deno.readTextFile("public/data/worker-lifecycle.v1.json"));
  assertEquals(ledger.summary.byClass, {
    "symmetric-warm": 4,
    "asymmetric-wasm-cold-per-task": 33,
    "per-task-verified-bundle": 8,
    "symmetric-cold-isolate": 4,
    "in-page-kernel-only": 1,
  });
  assertEquals(ledger.summary.perTaskWasmInstantiateCount, 45);
  assertEquals(ledger.summary.warmCachedWasmCount, 4);

  const handler = createHandler(null, "public");
  for (const path of ["/data/worker-lifecycle.v1.json", "/docs/worker-lifecycle-audit.md"]) {
    const res = await handler(new Request(`http://127.0.0.1${path}`));
    await res.arrayBuffer();
    assertEquals(res.status, 200, `${path} did not return HTTP 200`);
  }

  const benchmarks = JSON.parse(await Deno.readTextFile("public/data/benchmarks.json"));
  assertEquals(benchmarks.length, 50);
  let workerUrlCount = 0;
  for (const b of benchmarks) {
    assert(
      typeof b.workerLifecycleClass === "string" && b.workerLifecycleClass.length > 0,
      `${b.slug} missing workerLifecycleClass`,
    );
    assert(
      typeof b.workerLifecycleBadge === "string" && b.workerLifecycleBadge.length > 0,
      `${b.slug} missing workerLifecycleBadge`,
    );
    assert(
      typeof b.workerLifecycleSummary === "string" && b.workerLifecycleSummary.length > 0,
      `${b.slug} missing workerLifecycleSummary`,
    );
    if (b.workerScriptUrl) {
      workerUrlCount += 1;
      const res = await handler(new Request(`http://127.0.0.1${b.workerScriptUrl}`));
      await res.arrayBuffer();
      assertEquals(res.status, 200, `${b.slug} workerScriptUrl ${b.workerScriptUrl} failed`);
    }
  }
  assertEquals(workerUrlCount, 49);

  assertEquals(
    describePipelineToolchains({
      workerLifecycleClass: "asymmetric-wasm-cold-per-task",
      perTaskNoStoreFetch: true,
    }),
    {
      js: "V8 JIT (warm ES module, 0 re-fetches)",
      wasm: "wasm32 (no-store fetch + re-instantiated per task)",
    },
  );
  assertEquals(
    describePipelineToolchains({ workerLifecycleClass: "symmetric-warm" }),
    {
      js: "V8 JIT (warm module in worker)",
      wasm: "wasm32 (cached WebAssembly.Instance)",
    },
  );

  const asymRows = buildExplorerRows({
    primaryStats: {
      jsStats: { samples: [2.0], pipelineSummary: { p50Ms: 2.0 } },
      wasmStats: { samples: [12.0], pipelineSummary: { p50Ms: 12.0 } },
    },
    multilangResults: null,
    domResults: null,
    manifest: null,
    catalogSpec: {
      workerLifecycleClass: "asymmetric-wasm-cold-per-task",
      perTaskNoStoreFetch: true,
      perTaskWasmInstantiate: true,
    },
  });
  assertEquals(asymRows.pipeline[0].toolchain, "V8 JIT (warm ES module, 0 re-fetches)");
  assertEquals(
    asymRows.pipeline[1].toolchain,
    "wasm32 (no-store fetch + re-instantiated per task)",
  );
  assertEquals(asymRows.pipeline[1].note, "includes per-task WebAssembly.instantiate");
});
