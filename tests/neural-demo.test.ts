import { assert, assertEquals } from "./assert.ts";

const PORT = "8199";
const ORIGIN = `http://127.0.0.1:${PORT}`;
let server: Deno.ChildProcess;

async function startServer() {
  server = new Deno.Command("deno", {
    args: [
      "run",
      "--allow-net=127.0.0.1",
      "--allow-read=.",
      "--allow-write=.",
      "--allow-env=PORT,HOST,SERVER_MODE,WASM_VS_JS_COMMIT",
      "server.ts",
    ],
    env: {
      PORT: "8199",
      HOST: "127.0.0.1",
      SERVER_MODE: "local",
      WASM_VS_JS_COMMIT: Deno.env.get("WASM_VS_JS_COMMIT") ||
        Deno.env.get("WASM_VS_JS_COMMIT") || (() => {
          const p = new Deno.Command("git", { args: ["rev-parse", "HEAD"] }).outputSync();
          return new TextDecoder().decode(p.stdout).trim();
        })(),
    },
    stdout: "null",
    stderr: "null",
  }).spawn();
  // Wait for server
  for (let i = 0; i < 30; i++) {
    try {
      const r = await fetch(`${ORIGIN}/benchmarks/ml-gemm/`);
      if (r.ok) return;
    } catch (e) {
      void e;
    }
    await new Promise((r) => setTimeout(r, 200));
  }
  throw new Error("server did not start");
}

function stopServer() {
  if (server) {
    try {
      server.kill("SIGTERM");
    } catch (e) {
      void e;
    }
  }
}

async function fetchText(
  path: string,
): Promise<{ status: number; text: string; contentType: string }> {
  const r = await fetch(`${ORIGIN}${path}`);
  return {
    status: r.status,
    text: await r.text(),
    contentType: r.headers.get("content-type") || "",
  };
}

async function fetchBytes(
  path: string,
): Promise<{ status: number; bytes: Uint8Array; contentType: string }> {
  const r = await fetch(`${ORIGIN}${path}`);
  return {
    status: r.status,
    bytes: new Uint8Array(await r.arrayBuffer()),
    contentType: r.headers.get("content-type") || "",
  };
}

Deno.test({
  name: "neural demo routes exist and return correct content types",
  fn: async () => {
    await startServer();
    try {
      // GEMM page
      const gemmPage = await fetchText("/benchmarks/ml-gemm/");
      assert(gemmPage.status === 200);
      assert(gemmPage.contentType.includes("text/html"), `GEMM page CT: ${gemmPage.contentType}`);
      assert(gemmPage.text.includes("GEMM"), "GEMM page missing title");

      // MLP page
      const mlpPage = await fetchText("/benchmarks/ml-dense-mlp/");
      assert(mlpPage.status === 200);
      assert(mlpPage.contentType.includes("text/html"), `MLP page CT: ${mlpPage.contentType}`);
      assert(mlpPage.text.includes("MLP"), "MLP page missing title");

      // Runner JS
      const gemmRunner = await fetchText("/benchmarks/ml-gemm/neural-gemm-runner.js");
      assert(gemmRunner.status === 200);
      assert(
        gemmRunner.contentType.includes("javascript"),
        `GEMM runner CT: ${gemmRunner.contentType}`,
      );

      const mlpRunner = await fetchText("/benchmarks/ml-dense-mlp/neural-mlp-runner.js");
      assert(mlpRunner.status === 200);

      // Workers
      const gemmWorker = await fetchText("/benchmarks/ml-gemm/neural-gemm-worker.js");
      assertEquals(gemmWorker.status, 200);
      assert(gemmWorker.text.includes("gemm_f32"), "GEMM worker missing gemm_f32 call");

      const mlpWorker = await fetchText("/benchmarks/ml-dense-mlp/neural-mlp-worker.js");
      assert(mlpWorker.status === 200);
      assert(mlpWorker.text.includes("linear_f32"), "MLP worker missing linear_f32 call");
      assert(mlpWorker.text.includes("gelu_f32"), "MLP worker missing gelu_f32 call");
    } finally {
      await stopServer();
    }
  },
  sanitizeResources: false,
  sanitizeOps: false,
});

Deno.test({
  name: "neural demo workload and artifact routes serve correct bytes",
  fn: async () => {
    await startServer();
    try {
      // Workload JS
      const gemmJs = await fetchText("/benchmarks/v2/ml-gemm/workload.js");
      assert(gemmJs.status === 200);
      assert(gemmJs.text.includes("gemmControlled"), "GEMM workload missing export");

      const mlpJs = await fetchText("/benchmarks/v2/ml-dense-mlp/workload.js");
      assert(mlpJs.status === 200);
      assert(mlpJs.text.includes("mlpControlled"), "MLP workload missing export");

      // frozen-transcendentals
      const frozen = await fetchText("/benchmarks/v2/ml-dense-mlp/frozen-transcendentals.js");
      assert(frozen.status === 200, "frozen-transcendentals.js must be routed");

      // Shared deps
      for (
        const dep of [
          "/benchmarks/v2/shared/allocations.js",
          "/benchmarks/v2/shared/generator.js",
          "/benchmarks/v2/shared/workload-contract.js",
        ]
      ) {
        const r = await fetchText(dep);
        assert(r.status === 200, `${dep} must be routed`);
      }

      // Wasm artifacts
      const gemmWasm = await fetchBytes("/artifacts/v2/ml-gemm/ml-gemm.wasm");
      assert(gemmWasm.status === 200);
      assert(gemmWasm.bytes.byteLength > 0, "GEMM wasm empty");
      assert(gemmWasm.contentType.includes("wasm"), `GEMM wasm CT: ${gemmWasm.contentType}`);

      const mlpWasm = await fetchBytes("/artifacts/v2/ml-dense-mlp/ml-dense-mlp.wasm");
      assert(mlpWasm.status === 200);
      assert(mlpWasm.bytes.byteLength > 0, "MLP wasm empty");

      // Reference and bounds
      const gemmRef = await fetchBytes("/artifacts/v2/ml-gemm/reference.f64");
      assert(gemmRef.status === 200);
      assert(
        gemmRef.bytes.byteLength === 1048576 * 8,
        `GEMM ref: ${gemmRef.bytes.byteLength} ≠ ${1048576 * 8}`,
      );

      const gemmBounds = await fetchBytes("/artifacts/v2/ml-gemm/bounds.f32");
      assert(gemmBounds.status === 200);
      assert(
        gemmBounds.bytes.byteLength === 1048576 * 4,
        `GEMM bounds: ${gemmBounds.bytes.byteLength}`,
      );

      const mlpRef = await fetchBytes("/artifacts/v2/ml-dense-mlp/reference.f64");
      assert(mlpRef.status === 200);
      assert(
        mlpRef.bytes.byteLength === 147456 * 8,
        `MLP ref: ${mlpRef.bytes.byteLength} ≠ ${147456 * 8}`,
      );

      const mlpBounds = await fetchBytes("/artifacts/v2/ml-dense-mlp/bounds.f32");
      assert(mlpBounds.status === 200);
      assert(
        mlpBounds.bytes.byteLength === 147456 * 4,
        `MLP bounds: ${mlpBounds.bytes.byteLength}`,
      );

      // Manifests
      const gemmManifest = await fetchText("/artifacts/v2/ml-gemm/fixture-manifest.json");
      assert(gemmManifest.status === 200);
      assert(gemmManifest.text.includes("xorshift32"), "GEMM manifest missing generator");

      const mlpManifest = await fetchText("/artifacts/v2/ml-dense-mlp/fixture-manifest.json");
      assert(mlpManifest.status === 200);
    } finally {
      await stopServer();
    }
  },
  sanitizeResources: false,
  sanitizeOps: false,
});

Deno.test({
  name: "neural demo GEMM output validates against reference and bounds",
  fn: async () => {
    const { generateInput, gemmControlled } = await import("../benchmarks/v2/ml-gemm/workload.js");
    const refBytes = Deno.readFileSync("artifacts/v2/ml-gemm/reference.f64");
    const boundsBytes = Deno.readFileSync("artifacts/v2/ml-gemm/bounds.f32");
    const reference = new Float64Array(
      refBytes.buffer,
      refBytes.byteOffset,
      refBytes.byteLength / 8,
    );
    const bounds = new Float32Array(
      boundsBytes.buffer,
      boundsBytes.byteOffset,
      boundsBytes.byteLength / 4,
    );

    assert(reference.length === 1048576, "GEMM reference element count");
    assert(bounds.length === 1048576, "GEMM bounds element count");

    const { a, b, c0 } = generateInput();
    const c = new Float32Array(4 * 512 * 512);
    gemmControlled(a, b, c0, c);

    let maxDev = 0, violations = 0;
    for (let i = 0; i < c.length; i++) {
      assert(Number.isFinite(c[i]), `NaN/Inf at [${i}]: ${c[i]}`);
      const dev = Math.abs(c[i] - reference[i]);
      if (dev > maxDev) maxDev = dev;
      if (dev > bounds[i]) violations++;
    }
    assert(
      violations === 0,
      `GEMM JS has ${violations} bound violations (max dev ${maxDev.toExponential(3)})`,
    );
    assert(maxDev < 1e-3, `GEMM JS max deviation ${maxDev.toExponential(3)} exceeds 1e-3`);
  },
  sanitizeResources: false,
  sanitizeOps: false,
});

Deno.test({
  name: "neural demo MLP validates all 9 layer outputs against reference and bounds",
  fn: async () => {
    const { generateInput, linearLayerF32, geluInPlace } = await import(
      "../benchmarks/v2/ml-dense-mlp/workload.js"
    );
    const refBytes = Deno.readFileSync("artifacts/v2/ml-dense-mlp/reference.f64");
    const boundsBytes = Deno.readFileSync("artifacts/v2/ml-dense-mlp/bounds.f32");
    const reference = new Float64Array(
      refBytes.buffer,
      refBytes.byteOffset,
      refBytes.byteLength / 8,
    );
    const bounds = new Float32Array(
      boundsBytes.buffer,
      boundsBytes.byteOffset,
      boundsBytes.byteLength / 4,
    );

    assert(reference.length === 147456, "MLP reference (9×32×512)");
    assert(bounds.length === 147456, "MLP bounds (9×32×512)");

    const { x, w, bias } = generateInput();
    const LAYER_LEN = 32 * 512;
    const LAYERS = 9;
    const WIDTH = 512;

    // Per-layer JS forward pass with output capture
    const scratchA = new Float32Array(LAYER_LEN);
    const scratchB = new Float32Array(LAYER_LEN);
    const layerOutputs: Float32Array[] = [];
    let input = x;
    for (let layer = 0; layer < LAYERS; layer++) {
      const out = layer === LAYERS - 1
        ? new Float32Array(LAYER_LEN)
        : layer % 2 === 0
        ? scratchA
        : scratchB;
      linearLayerF32(
        input,
        w.subarray(layer * WIDTH * WIDTH, (layer + 1) * WIDTH * WIDTH),
        bias.subarray(layer * WIDTH, (layer + 1) * WIDTH),
        out,
        32,
        WIDTH,
      );
      if (layer < LAYERS - 1) geluInPlace(out);
      layerOutputs.push(new Float32Array(out));
      input = out;
    }

    // Validate ALL 9 layers
    let maxDev = 0, totalViolations = 0;
    for (let l = 0; l < LAYERS; l++) {
      const ref = reference.subarray(l * LAYER_LEN, (l + 1) * LAYER_LEN);
      const bnd = bounds.subarray(l * LAYER_LEN, (l + 1) * LAYER_LEN);
      for (let i = 0; i < LAYER_LEN; i++) {
        assert(Number.isFinite(layerOutputs[l][i]), `NaN/Inf layer ${l}[${i}]`);
        const dev = Math.abs(layerOutputs[l][i] - ref[i]);
        if (dev > maxDev) maxDev = dev;
        if (dev > bnd[i]) totalViolations++;
      }
    }
    assert(
      totalViolations === 0,
      `MLP JS has ${totalViolations} bound violations across all 9 layers`,
    );
    assert(maxDev < 1e-3, `MLP JS all-layer max deviation ${maxDev.toExponential(3)} exceeds 1e-3`);
  },
  sanitizeResources: false,
  sanitizeOps: false,
});

Deno.test({
  name: "neural demo GEMM Wasm compiles and exports gemm_f32 + memory",
  fn: async () => {
    const wasm = Deno.readFileSync("artifacts/v2/ml-gemm/ml-gemm.wasm");
    const mod = await WebAssembly.compile(wasm);
    const inst = await WebAssembly.instantiate(mod);
    const exports = inst.exports as Record<string, unknown>;
    assert(typeof exports.gemm_f32 === "function", "missing gemm_f32 export");
    assert(exports.memory instanceof WebAssembly.Memory, "missing memory export");
    const mem = exports.memory as WebAssembly.Memory;
    assert(
      mem.buffer.byteLength === 256 * 65536,
      `GEMM memory: ${mem.buffer.byteLength} ≠ ${256 * 65536}`,
    );
  },
});

Deno.test({
  name: "neural demo MLP Wasm compiles and exports linear_f32, gelu_f32, memory",
  fn: async () => {
    const wasm = Deno.readFileSync("artifacts/v2/ml-dense-mlp/ml-dense-mlp.wasm");
    const mod = await WebAssembly.compile(wasm);
    const inst = await WebAssembly.instantiate(mod);
    const exports = inst.exports as Record<string, unknown>;
    assert(typeof exports.linear_f32 === "function", "missing linear_f32 export");
    assert(typeof exports.gelu_f32 === "function", "missing gelu_f32 export");
    assert(exports.memory instanceof WebAssembly.Memory, "missing memory export");
    const mem = exports.memory as WebAssembly.Memory;
    assert(
      mem.buffer.byteLength === 160 * 65536,
      `MLP memory: ${mem.buffer.byteLength} ≠ ${160 * 65536}`,
    );
  },
});
