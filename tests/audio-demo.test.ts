import { assert, assertEquals } from "./assert.ts";
import { AUDIO_FROZEN_HASHES } from "../benchmarks/audio-shared/constants.ts";

const ROOT = new URL("../", import.meta.url);
const SLUGS = ["audio-fft", "audio-fir", "audio-stft"] as const;
const DEMO_MODULE_OUTPUTS = [
  "benchmarks/audio-fft/workload.js",
  "benchmarks/audio-fir/workload.js",
  "benchmarks/audio-stft/workload.js",
  "benchmarks/audio-shared/canonical.js",
  "benchmarks/audio-shared/constants.js",
  "benchmarks/audio-shared/oracle.js",
  "lib/audio-workloads.js",
] as const;

async function sha256Hex(bytes: Uint8Array): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", bytes.buffer as ArrayBuffer);
  return [...new Uint8Array(digest)].map((value) => value.toString(16).padStart(2, "0")).join("");
}

async function readBytes(path: string): Promise<Uint8Array> {
  return await Deno.readFile(new URL(path, ROOT));
}

async function readJson(path: string): Promise<Record<string, unknown>> {
  return JSON.parse(new TextDecoder().decode(await readBytes(path)));
}

Deno.test("audio demo registry is closed and truthful", async () => {
  const registry = await readJson("public/demo-registry.json");
  assertEquals(registry.schemaVersion, 1);
  assertEquals(registry.contractId, "audio-demo-registry-v1");
  assertEquals(registry.authoritativePerformanceEvidence, false);
  const demos = registry.demos as Record<string, unknown>[];
  assertEquals(demos.length, 3);
  for (const key of ["runnerSha256", "workerSha256", "assetsManifestSha256"]) {
    assert(/^[a-f0-9]{64}$/.test(registry[key] as string), `${key} pinned`);
  }
  assertEquals(registry.runnerSha256, await sha256Hex(await readBytes("public/demo-runner.js")));
  assertEquals(registry.workerSha256, await sha256Hex(await readBytes("public/demo-worker.js")));
  assertEquals(
    registry.assetsManifestSha256,
    await sha256Hex(await readBytes("public/demo-assets/audio/manifest.json")),
  );
  assertEquals(
    JSON.stringify([...demos.map((demo) => demo.slug)].sort()),
    JSON.stringify([...SLUGS].sort()),
  );
  const expectedKeys = [
    "buildManifestSha256",
    "entryId",
    "frozenHashes",
    "manifestPaths",
    "memoryPages",
    "modes",
    "referencePath",
    "route",
    "slug",
    "targets",
    "timeoutMs",
    "title",
    "wasmPath",
  ];
  for (const demo of demos) {
    assertEquals(
      JSON.stringify(Object.keys(demo).sort()),
      JSON.stringify(expectedKeys),
    );
    const slug = demo.slug as keyof typeof AUDIO_FROZEN_HASHES;
    const hashes = demo.frozenHashes as Record<string, string>;
    assertEquals(hashes.inputSha256, AUDIO_FROZEN_HASHES[slug].inputSha256);
    assertEquals(hashes.outputSha256, AUDIO_FROZEN_HASHES[slug].outputSha256);
    assertEquals(hashes.referenceSha256, AUDIO_FROZEN_HASHES[slug].referenceSha256);
    // Referenced artifacts exist and hash exactly.
    const wasmPath = `public${demo.wasmPath}`;
    const referencePath = `public${demo.referencePath}`;
    assertEquals(await sha256Hex(await readBytes(referencePath)), hashes.referenceSha256);
    const buildManifest = await readJson(`public${(demo.manifestPaths as string[])[0]}`);
    // The registry pin equals both the accepted record's pin and the served
    // build-manifest bytes.
    const acceptedRecord = await readJson(
      `public/evidence/v2-proposals/${demo.slug}/js-controlled.json`,
    ) as Record<string, unknown>;
    const acceptedManifests = (acceptedRecord.provenance as Record<string, unknown>)
      .manifests as Record<string, Record<string, unknown>>;
    assertEquals(demo.buildManifestSha256, acceptedManifests.build.sha256);
    assertEquals(
      demo.buildManifestSha256,
      await sha256Hex(await readBytes(`public/artifacts/${demo.slug}/build-manifest.json`)),
    );
    const variants = buildManifest.variants as Record<string, Record<string, string>>;
    assertEquals(
      await sha256Hex(await readBytes(wasmPath)),
      variants["wasm-linear-controlled"].artifactSha256,
    );
    assertEquals((demo.modes as string[]).join(","), "bounded,exact-contract");
    assertEquals((demo.targets as string[]).join(","), "javascript,wasm-linear");
    assert(typeof demo.timeoutMs === "number" && demo.timeoutMs >= 60_000, "bounded timeout");
  }
});

Deno.test("audio demo assets are reproducible from the exact engine sources", async () => {
  const before = new Map<string, string>();
  for (const output of DEMO_MODULE_OUTPUTS) {
    before.set(output, await sha256Hex(await readBytes(`public/demo-assets/audio/${output}`)));
  }
  const build = new Deno.Command(Deno.execPath(), {
    args: [
      "run",
      "--allow-read=.",
      "--allow-write=public/demo-assets",
      "--allow-env",
      "--allow-run",
      "--lock=scripts/audio-demo-assets.lock",
      "scripts/build-audio-demo-assets.ts",
    ],
    cwd: new URL(".", ROOT).pathname,
    stdout: "piped",
    stderr: "piped",
  }).outputSync();
  assert(build.success, `demo asset build failed: ${new TextDecoder().decode(build.stderr)}`);
  for (const output of DEMO_MODULE_OUTPUTS) {
    assertEquals(
      await sha256Hex(await readBytes(`public/demo-assets/audio/${output}`)),
      before.get(output),
    );
  }
  const manifest = await readJson("public/demo-assets/audio/manifest.json");
  assertEquals(manifest.contractId, "audio-demo-assets-manifest-v1");
  const files = manifest.files as Record<string, string>[];
  assertEquals(files.length, DEMO_MODULE_OUTPUTS.length);
  for (const file of files) {
    assertEquals(await sha256Hex(await readBytes(file.source)), file.sourceSha256);
    assertEquals(await sha256Hex(await readBytes(file.output)), file.outputSha256);
  }
});

Deno.test("audio demo pages embed truthful workload identity", async () => {
  const registry = await readJson("public/demo-registry.json");
  const demos = registry.demos as Record<string, unknown>[];
  for (const demo of demos) {
    const slug = demo.slug as string;
    const html = new TextDecoder().decode(await readBytes(`public/benchmarks/${slug}/index.html`));
    const match = html.match(
      /<script type="application\/json" id="workload-identity">([\s\S]*?)<\/script>/,
    );
    assert(match, `${slug} page has no embedded workload identity`);
    const identity = JSON.parse(match[1]);
    const bench = await readJson(`benchmarks/${slug}/benchmark.json`);
    assertEquals(identity.slug, slug);
    assertEquals(identity.entryId, bench.entryId);
    assertEquals(identity.entryId, demo.entryId);
    assertEquals(identity.title, bench.title);
    assertEquals(identity.timeoutMs, demo.timeoutMs);
    assertEquals(identity.frozenHashes, demo.frozenHashes);
    assertEquals(
      identity.registrySha256,
      await sha256Hex(await readBytes("public/demo-registry.json")),
    );
    // The static page carries the frozen evidence and pinned source links.
    const oracle = bench.oracle as Record<string, unknown>;
    assert(html.includes(oracle.outputSha256 as string), `${slug} output hash on page`);
    assert(html.includes("/evidence/v2-proposals/"), `${slug} links the evidence records`);
    assert(
      html.includes(`/blob/${registry.sourceCommit}/`),
      `${slug} pinned source links`,
    );
    assert(html.includes(`benchmarks/${slug}/workload.ts`), `${slug} links the engine source`);
  }
});

Deno.test("audio demo pages avoid stock AI-writing phrases", async () => {
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
  for (const slug of SLUGS) {
    const html = new TextDecoder()
      .decode(await readBytes(`public/benchmarks/${slug}/index.html`))
      .toLowerCase();
    for (const phrase of stockPhrases) {
      assert(!html.includes(phrase), `${slug} contains stock phrase: ${phrase}`);
    }
  }
});

Deno.test("public server serves the audio demo routes and nothing else under /demo-assets", async () => {
  const probe = Deno.listen({ hostname: "127.0.0.1", port: 0 });
  const port = (probe.addr as Deno.NetAddr).port;
  probe.close();
  const child = new Deno.Command(Deno.execPath(), {
    args: ["task", "public"],
    cwd: new URL(".", ROOT).pathname,
    env: { PORT: String(port), HOST: "127.0.0.1" },
    stdout: "piped",
    stderr: "piped",
  }).spawn();
  try {
    let ready = false;
    for (let attempt = 0; attempt < 50 && !ready; attempt += 1) {
      try {
        ready = (await fetch(`http://127.0.0.1:${port}/healthz`)).status === 200;
      } catch {
        await new Promise((resolve) => setTimeout(resolve, 50));
      }
    }
    assert(ready, "public task did not start");
    const get = async (path: string) =>
      await fetch(`http://127.0.0.1:${port}${path}`).then((response) => {
        void response.body?.cancel();
        return response;
      });
    for (const slug of SLUGS) {
      const page = await get(`/benchmarks/${slug}/`);
      assertEquals(page.status, 200);
      assertEquals(page.headers.get("content-type"), "text/html; charset=utf-8");
      assertEquals((await get(`/benchmarks/${slug}`)).status, 200);
    }
    assertEquals((await get("/demo-runner.js")).status, 200);
    assertEquals((await get("/demo-worker.js")).status, 200);
    assertEquals((await get("/demo-registry.json")).status, 200);
    assertEquals((await get("/demo-assets/audio/manifest.json")).status, 200);
    for (const output of DEMO_MODULE_OUTPUTS) {
      const response = await get(`/demo-assets/audio/${output}`);
      assertEquals(response.status, 200);
      assertEquals(response.headers.get("content-type"), "text/javascript; charset=utf-8");
    }
    // The allowlist is closed: anything not explicitly listed is 404.
    assertEquals((await get("/demo-assets/audio/lib/other.js")).status, 404);
    assertEquals((await get("/demo-assets/audio/")).status, 404);
    assertEquals((await get("/demo-assets/")).status, 404);
  } finally {
    child.kill("SIGTERM");
    await child.status;
  }
});

Deno.test("retained browser validation evidence is complete and passing", async () => {
  const base = "evidence/browser/audio-demo";
  const validation = await readJson(`${base}/validation.json`);
  assertEquals(validation.contractId, "audio-demo-browser-validation-v1");
  const browser = validation.browser as Record<string, unknown>;
  assert(typeof browser.product === "string" && browser.product.includes("Chrome/"));
  assert((browser.launchArguments as string[]).includes("--headless=new"));
  const runs = validation.runs as Record<string, unknown>[];
  const exactRuns = runs.filter((run) => run.mode === "exact-contract");
  assertEquals(exactRuns.length, 6);
  const seen = new Set(exactRuns.map((run) => `${run.route}|${run.engine}`));
  for (const slug of SLUGS) {
    for (const engine of ["javascript", "wasm-linear"]) {
      assert(
        seen.has(`http://127.0.0.1:8899/benchmarks/${slug}/|${engine}`) ||
          [...seen].some((key) => key.includes(`/benchmarks/${slug}/|${engine}`)),
      );
    }
  }
  for (const run of runs) {
    const checks = run.checks as Record<string, boolean>;
    for (const [name, value] of Object.entries(checks)) {
      assert(value === true, `${run.route} ${run.engine}: ${name}`);
    }
  }
  assertEquals(runs.filter((run) => run.mode === "lifecycle").length, 1);
  // The lifecycle-injection record is REQUIRED, not validated-if-present.
  const injectionRuns = runs.filter((run) => run.mode === "lifecycle-injection");
  assertEquals(injectionRuns.length, 1);
  for (
    const required of [
      "wrongTokenMessageIgnored",
      "staleErrorIgnored",
      "runCompletedDespiteInjections",
      "workerActiveBeforePagehide",
      "pagehideTerminatesWorker",
    ]
  ) {
    assert(
      (injectionRuns[0].checks as Record<string, boolean>)[required] === true,
      `lifecycle-injection check ${required}`,
    );
  }
  // The served page bytes are anchored to the non-served reviewed trust root.
  const pins = await readJson("tests/audio-demo-page-pins.json");
  const pageHashes = validation.pageHashes as Record<string, string>;
  for (const slug of SLUGS) {
    assertEquals(pageHashes[slug], (pins.pages as Record<string, string>)[slug]);
  }
  assertEquals(
    pins.registrySha256,
    await sha256Hex(await readBytes("public/demo-registry.json")),
  );
  const consoleLog = new TextDecoder().decode(await readBytes(`${base}/console.jsonl`));
  for (const line of consoleLog.trim().split("\n")) {
    if (!line) continue;
    assert(
      line.includes("frame-ancestors"),
      `unexpected console event retained: ${line.slice(0, 120)}`,
    );
  }
  const networkLog = new TextDecoder().decode(await readBytes(`${base}/network.jsonl`));
  assert(networkLog.includes("/demo-worker.js"));
  assert(networkLog.includes("/demo-runner.js"));
  for (const slug of SLUGS) {
    assert(networkLog.includes(`/benchmarks/${slug}/`));
  }
  const scope = validation.networkScope as string;
  assert(scope.includes("exact-contract assertions"));
  for (const slug of SLUGS) {
    const shot = await Deno.lstat(`${base}/screenshots/${slug}-exact-contract.png`);
    assert(shot.isFile && shot.size > 1_000, `${slug} screenshot retained`);
  }
  const cleanup = await readJson(`${base}/cleanup.json`);
  assertEquals(cleanup.profileRemoved, true);
  assert(typeof cleanup.browserPid === "number" && typeof cleanup.serverPid === "number");
});

Deno.test("audio demo registry and pages regenerate byte-identically", async () => {
  const before = new Map<string, string>();
  const paths = [
    "public/demo-registry.json",
    ...SLUGS.map((slug) => `public/benchmarks/${slug}/index.html`),
  ];
  for (const path of paths) before.set(path, await sha256Hex(await readBytes(path)));
  const registryBuild = new Deno.Command(Deno.execPath(), {
    args: [
      "run",
      "--allow-read=.",
      "--allow-write=public/demo-registry.json",
      "scripts/build-audio-demo-registry.ts",
    ],
    cwd: new URL(".", ROOT).pathname,
    stdout: "piped",
    stderr: "piped",
  }).outputSync();
  assert(registryBuild.success, new TextDecoder().decode(registryBuild.stderr));
  const pagesBuild = new Deno.Command(Deno.execPath(), {
    args: [
      "run",
      "--allow-read=.",
      "--allow-write=public/benchmarks,tests/audio-demo-page-pins.json",
      "--allow-run",
      "scripts/build-audio-demo-pages.ts",
    ],
    cwd: new URL(".", ROOT).pathname,
    stdout: "piped",
    stderr: "piped",
  }).outputSync();
  assert(pagesBuild.success, new TextDecoder().decode(pagesBuild.stderr));
  for (const path of paths) {
    assertEquals(await sha256Hex(await readBytes(path)), before.get(path));
  }
});
