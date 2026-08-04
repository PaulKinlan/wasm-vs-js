// Regenerate the three audio demo pages from a single template so the
// registry hash embedded in each page's workload-identity JSON is
// byte-reproducible and test-enforced. Page prose is deliberate; edit it
// here, not in the generated files.

const ROOT = new URL("../", import.meta.url);
const REPO = "https://github.com/PaulKinlan/wasm-vs-js";

const DATA: Record<string, {
  title: string;
  lede: string;
  what: string[];
  wat: string;
  wasmBytes: number;
}> = {
  "audio-fft": {
    title: "Radix-2 complex FFT",
    lede:
      "Thirty-two radix-2 transforms over 4,096 interleaved complex samples each, in strict-f32 frozen order. Both engines run the same algorithm with the same frozen twiddle table; the fixture is one exactly representable real impulse per transform.",
    what: [
      "The JavaScript engine (<code>fftRadix2</code>) and the 528-byte linear-Wasm engine run the identical radix-2 decimation-in-time butterfly with identical f32 rounding at every step.",
      "The oracle compares all 262,144 output components against a pinned scalar-f64 direct-DFT reference (absolute 1e-6, relative 1e-5), checks f64 anchor bins 0 and n/2 per transform, inverse-transform reconstruction, conjugate symmetry, and eight exact work counters.",
    ],
    wat: "benchmarks/audio-fft/audio-fft.wat",
    wasmBytes: 528,
  },
  "audio-fir": {
    title: "Direct 256-tap FIR convolution",
    lede:
      "Direct convolution of 131,072 mono samples with a 256-tap windowed-sinc lowpass (cutoff 0.25 sample-rate, Hann window, DC gain normalized to 1), in strict-f32 frozen order.",
    what: [
      "The JavaScript engine and the 226-byte linear-Wasm engine accumulate the same 33,554,432 multiply-accumulates in the same order with the same f32 rounding.",
      "The oracle compares all 131,327 output components against the pinned f64 reference (absolute 1e-6, relative 1e-5) and checks finiteness, DC gain 1 within 1e-6, impulse latency, and eight exact work counters.",
    ],
    wat: "benchmarks/audio-fir/audio-fir.wat",
    wasmBytes: 226,
  },
  "audio-stft": {
    title: "Short-time Fourier transform",
    lede:
      "372 overlapping 1,024-sample frames (hop 256) over 96,000 samples at 48 kHz: a 20 Hz–8 kHz chirp plus seeded noise, frozen Hann window, radix-2 FFT per frame, in strict-f32 frozen order.",
    what: [
      "The JavaScript engine and the 752-byte linear-Wasm engine run the identical window-and-transform pipeline; the Wasm engine writes through a fixed scratch region with zero redundant clears.",
      "The oracle compares all 761,856 output components against the pinned f64 reference (absolute 5e-6, relative 1e-5) and checks per-frame conjugate symmetry, inverse reconstruction, chirp peak-bin tracking within 1.1 bins, and eight exact work counters.",
    ],
    wat: "benchmarks/audio-stft/audio-stft.wat",
    wasmBytes: 752,
  },
};

const TEMPLATE = `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <meta name="color-scheme" content="light dark">
    <meta name="description"
      content="Runnable demo of the {entry_id} v2 proposal workload: exact JavaScript and linear-Wasm engines, frozen fixture, pinned f64 reference oracle.">
    <meta http-equiv="Content-Security-Policy"
      content="default-src 'self'; script-src 'self' 'wasm-unsafe-eval' blob:; worker-src 'self'; style-src 'self'; img-src 'self'; connect-src 'self'; object-src 'none'; base-uri 'none'; form-action 'self'">
    <title>{title} demo · Wasm vs JavaScript</title>
    <link rel="stylesheet" href="/styles.css">
    <link rel="icon" href="/favicon.svg" type="image/svg+xml">
    <script type="module" src="/demo-runner.js"></script>
  </head>
  <body>
    <a class="skip" href="#main">Skip to main content</a>
    <header class="masthead">
      <a class="brand" href="/">Wasm vs JavaScript benchmark</a>
      <a href="/benchmarks/">Browse Catalog</a>
      <a href="/experiments/">Experiment</a>
      <a href="/evidence/">Evidence</a>
      <strong>data v1</strong>
    </header>
    <main id="main">
      <section class="hero" aria-labelledby="demo-title">
        <p class="eyebrow">Runnable demo · v2 proposal · {entry_id}</p>
        <h1 id="demo-title">{title}</h1>
        <p class="lede">{lede}</p>
        <p class="notice"><strong>Scope.</strong> This page runs one contract iteration in a fresh
          worker and reports correctness, oracle, and work-counter evidence. It collects no
          performance claims, uploads nothing, and stores nothing. The authoritative validation
          records live under <a href="/evidence/v2-proposals/">v2 proposal evidence</a>.</p>
      </section>

      <section aria-labelledby="identity-title">
        <h2 id="identity-title">Workload identity</h2>
        <dl class="metrics">
          <div><dt>Entry ID</dt><dd><code>{entry_id}</code></dd></div>
          <div><dt>Slug</dt><dd><code>{slug}</code></dd></div>
          <div><dt>Tier / class</dt><dd>{tier} · {klass}</dd></div>
          <div><dt>Variants</dt><dd><code>js-controlled</code> · <code>wasm-linear-controlled</code></dd></div>
          <div><dt>Floating-point policy</dt><dd>{fp_policy}</dd></div>
          <div><dt>Status</dt><dd>{status}</dd></div>
        </dl>
        <h3>Fixed dimensions</h3>
        <dl class="metrics">{dimensions}
        </dl>
      </section>

      <section aria-labelledby="run-title">
        <h2 id="run-title">Run the contract</h2>
        <p class="no-js-note">JavaScript is off. The identity, dimensions, evidence, and source
          links on this page are complete without it; running the engines requires JavaScript and
          WebAssembly.</p>
        <div class="actions demo-controls js-only">
          <label>Engine
            <select id="demo-target">
              <option value="javascript">JavaScript (strict-f32)</option>
              <option value="wasm-linear">WebAssembly (linear memory, {wasm_bytes} bytes)</option>
            </select>
          </label>
          <label>Mode
            <select id="demo-mode">
              <option value="bounded">Bounded (one contract iteration, tolerance oracle)</option>
              <option value="exact-contract">Exact contract (also verify every artifact hash)</option>
            </select>
          </label>
          <button id="demo-start" type="button">Start</button>
          <button id="demo-cancel" type="button" disabled>Cancel</button>
        </div>
        <p id="demo-status" class="hint js-only" role="status">Loading…</p>
        <p class="hint">Each Start spawns a fresh module worker with a unique run token. Cancel
          terminates the worker; messages from older tokens are discarded. The run times out and
          is terminated after {timeout_s} seconds.</p>
      </section>

      <section id="demo-results" class="js-only" hidden aria-labelledby="results-title">
        <h2 id="results-title">Run evidence</h2>
        <p id="demo-summary"></p>
        <h3>Hashes</h3>
        <table>
          <thead><tr><th scope="col">Artifact</th><th scope="col">SHA-256</th><th scope="col">Verdict</th></tr></thead>
          <tbody id="demo-hashes"></tbody>
        </table>
        <h3>Oracle checks</h3>
        <ul id="demo-oracle" class="demo-oracle"></ul>
        <h3>Exact work counters</h3>
        <table>
          <tbody id="demo-counters"></tbody>
        </table>
        <section aria-labelledby="contract-title">
          <h3 id="contract-title">Exact-contract verification</h3>
          <ul id="demo-contract"></ul>
        </section>
      </section>

      <section aria-labelledby="evidence-title">
        <h2 id="evidence-title">Frozen evidence</h2>
        <dl class="metrics">
          <div><dt>Input SHA-256</dt><dd><code>{input_sha}</code></dd></div>
          <div><dt>Output SHA-256</dt><dd><code>{output_sha}</code></dd></div>
          <div><dt>Reference SHA-256</dt><dd><code>{reference_sha}</code></dd></div>
          <div><dt>Oracle tolerances</dt><dd>absolute {abs_tol} · relative {rel_tol}</dd></div>
        </dl>
        <h3>Artifacts and records</h3>
        <ul class="demo-links">
          <li><a href="/artifacts/{slug}/{slug}.wasm">Wasm artifact ({wasm_bytes} bytes)</a></li>
          <li><a href="/artifacts/{slug}/reference-output.f32le">Pinned f64 reference output</a></li>
          <li><a href="/artifacts/{slug}/build-manifest.json">Build manifest</a> ·
            <a href="/artifacts/{slug}/fixture-manifest.json">fixture</a> ·
            <a href="/artifacts/{slug}/input-manifest.json">input</a> ·
            <a href="/artifacts/{slug}/output-manifest.json">output</a> ·
            <a href="/artifacts/{slug}/reference-manifest.json">reference</a></li>
          <li><a href="/evidence/v2-proposals/{slug}/js-controlled.json">JavaScript validation record</a> ·
            <a href="/evidence/v2-proposals/{slug}/wasm-linear-controlled.json">Wasm validation record</a></li>
        </ul>
        <h3>Sources (pinned commit)</h3>
        <ul class="demo-links">
          <li><a href="{repo}/blob/{commit}/benchmarks/{slug}/workload.ts">Engine source (JavaScript)</a></li>
          <li><a href="{repo}/blob/{commit}/{wat}">Kernel source (WAT)</a></li>
          <li><a href="{repo}/blob/{commit}/benchmarks/{slug}/benchmark.json">Workload contract</a></li>
          <li><a href="{repo}/blob/{commit}/benchmarks/audio-shared/oracle.ts">Oracle implementation</a></li>
        </ul>
        <h3>How the run works</h3>
        <ul class="demo-links">
{what_items}
        </ul>
      </section>
    </main>
    <script type="application/json" id="workload-identity">{identity_json}</script>
  </body>
</html>
`;

function toleranceDisplay(value: number): string {
  // Match the frozen-evidence style: 1e-06, 5e-06, 1e-05.
  return value.toExponential(0).replace(/e([+-])(\d)$/, "e$10$2");
}

async function sha256Hex(bytes: Uint8Array): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", bytes.buffer as ArrayBuffer);
  return [...new Uint8Array(digest)].map((v) => v.toString(16).padStart(2, "0")).join("");
}

const registryBytes = await Deno.readFile(new URL("public/demo-registry.json", ROOT));
const registrySha256 = await sha256Hex(registryBytes);
const registry = JSON.parse(new TextDecoder().decode(registryBytes));
const COMMIT = registry.sourceCommit;
if (typeof COMMIT !== "string" || !/^[a-f0-9]{40}$/.test(COMMIT)) {
  throw new Error("audio demo registry lacks a valid sourceCommit");
}

for (const demo of registry.demos) {
  const slug: string = demo.slug;
  const bench = JSON.parse(
    new TextDecoder().decode(
      await Deno.readFile(new URL(`benchmarks/${slug}/benchmark.json`, ROOT)),
    ),
  );
  const d = DATA[slug];
  const dimensions = bench.parameters
    .map((p: { name: string; value: unknown }) =>
      `          <div><dt>${p.name}</dt><dd>${p.value}</dd></div>`
    )
    .join("\n");
  const whatItems = d.what.map((w) => `          <li>${w}</li>`).join("\n");
  const identity = {
    slug,
    entryId: bench.entryId,
    title: bench.title,
    timeoutMs: demo.timeoutMs,
    frozenHashes: demo.frozenHashes,
    registrySha256,
  };
  const html = TEMPLATE
    .replaceAll("{entry_id}", bench.entryId)
    .replaceAll("{title}", d.title)
    .replaceAll("{lede}", d.lede)
    .replaceAll("{slug}", slug)
    .replaceAll("{tier}", bench.tier)
    .replaceAll("{klass}", bench.class)
    .replaceAll("{fp_policy}", bench.oracle.floatingPointPolicy)
    .replaceAll("{status}", bench.status)
    .replaceAll("{dimensions}", dimensions)
    .replaceAll("{wasm_bytes}", String(d.wasmBytes))
    .replaceAll("{timeout_s}", String(demo.timeoutMs / 1000))
    .replaceAll("{input_sha}", demo.frozenHashes.inputSha256)
    .replaceAll("{output_sha}", demo.frozenHashes.outputSha256)
    .replaceAll("{reference_sha}", demo.frozenHashes.referenceSha256)
    .replaceAll("{abs_tol}", toleranceDisplay(bench.oracle.absoluteTolerance))
    .replaceAll("{rel_tol}", toleranceDisplay(bench.oracle.relativeTolerance))
    .replaceAll("{repo}", REPO)
    .replaceAll("{commit}", COMMIT)
    .replaceAll("{wat}", d.wat)
    .replaceAll("{what_items}", whatItems)
    .replaceAll("{identity_json}", JSON.stringify(identity, null, 2));
  await Deno.writeTextFile(new URL(`public/benchmarks/${slug}/index.html`, ROOT).pathname, html);
  console.log(`demo page: ${slug}`);
}

// Format with the gating toolchain so `deno fmt --check` stays green and
// regeneration is byte-stable.
const fmt = new Deno.Command(Deno.execPath(), {
  args: [
    "fmt",
    "public/benchmarks/audio-fft/",
    "public/benchmarks/audio-fir/",
    "public/benchmarks/audio-stft/",
  ],
  cwd: new URL(".", ROOT).pathname,
  stdout: "piped",
  stderr: "piped",
}).outputSync();
if (!fmt.success) {
  throw new Error(`deno fmt on demo pages failed: ${new TextDecoder().decode(fmt.stderr)}`);
}

// Non-self-referential trust root: pin the page and registry BYTE hashes in
// a committed, non-served, reviewed file. The served graph can verify itself
// against the page-embedded registry hash, but the page bytes themselves are
// anchored here — outside the replaceable serving graph. The retained
// browser evidence must record served page hashes equal to these pins, and a
// test requires byte-identical regeneration.
const pins: Record<string, unknown> = {
  schemaVersion: 1,
  purpose:
    "Non-served trust root for the audio demo serving graph: page and registry byte hashes, reviewed at the accepted commit.",
  registrySha256: await sha256Hex(
    await Deno.readFile(new URL("public/demo-registry.json", ROOT).pathname),
  ),
  pages: {} as Record<string, string>,
};
for (const slug of Object.keys(DATA)) {
  (pins.pages as Record<string, string>)[slug] = await sha256Hex(
    await Deno.readFile(new URL(`public/benchmarks/${slug}/index.html`, ROOT).pathname),
  );
}
await Deno.writeTextFile(
  new URL("tests/audio-demo-page-pins.json", ROOT).pathname,
  JSON.stringify(pins, null, 2) + "\n",
);
console.log("demo page pins: tests/audio-demo-page-pins.json");
