async function fetchBytes(path) {
  const response = await fetch(path, { cache: "no-store" });
  if (!response.ok) throw new Error(`${path} returned ${response.status}`);
  return new Uint8Array(await response.arrayBuffer());
}

async function sha256Hex(bytes) {
  const digest = new Uint8Array(await crypto.subtle.digest("SHA-256", bytes));
  return [...digest].map((value) => value.toString(16).padStart(2, "0")).join("");
}

function parseJson(bytes, label) {
  try {
    return JSON.parse(new TextDecoder().decode(bytes));
  } catch {
    throw new Error(`${label} is not valid JSON`);
  }
}

function align(value, boundary = 16) {
  return Math.ceil(value / boundary) * boundary;
}

function runWasm(instance, fixture, ir) {
  const memory = instance.exports.memory;
  const effects = instance.exports.effects_chain;
  if (!(memory instanceof WebAssembly.Memory) || typeof effects !== "function") {
    throw new Error("Wasm exports are incomplete");
  }
  const frames = fixture.left.length;
  const outputFrames = frames + ir.length - 1;
  const leftIn = 0;
  const rightIn = align(leftIn + frames * 4);
  const irPtr = align(rightIn + frames * 4);
  const leftOut = align(irPtr + ir.length * 4);
  const rightOut = align(leftOut + outputFrames * 4);
  const history = align(rightOut + outputFrames * 4);
  if (history + ir.length * 8 > memory.buffer.byteLength) throw new Error("fixed memory too small");
  new Float32Array(memory.buffer, leftIn, frames).set(fixture.left);
  new Float32Array(memory.buffer, rightIn, frames).set(fixture.right);
  new Float32Array(memory.buffer, irPtr, ir.length).set(ir);
  effects(leftIn, rightIn, frames, irPtr, ir.length, leftOut, rightOut, history);
  return {
    left: new Float32Array(memory.buffer, leftOut, outputFrames).slice(),
    right: new Float32Array(memory.buffer, rightOut, outputFrames).slice(),
  };
}

self.addEventListener("message", async (event) => {
  const { token, target } = event.data ?? {};
  try {
    if (!Number.isInteger(token) || !["javascript", "wasm-linear"].includes(target)) {
      throw new Error("invalid closed demo request");
    }
    const buildBytes = await fetchBytes(
      "/artifacts/base-audio-webaudio-effects-v1/build-manifest.json",
    );
    const outputBytes = await fetchBytes(
      "/artifacts/base-audio-webaudio-effects-v1/output-manifest.json",
    );
    const build = parseJson(buildBytes, "build manifest");
    const oracle = parseJson(outputBytes, "output manifest");
    const workloadPath = "benchmarks/base/audio-webaudio-effects/workload.js";
    const workloadBytes = await fetchBytes(`/${workloadPath}`);
    const expectedSource = build.sources.find((source) => source.path === workloadPath)?.sha256;
    if (!expectedSource || await sha256Hex(workloadBytes) !== expectedSource) {
      throw new Error("controlled JavaScript source hash mismatch");
    }
    const sourceUrl = URL.createObjectURL(new Blob([workloadBytes], { type: "text/javascript" }));
    let workload;
    try {
      workload = await import(sourceUrl);
    } finally {
      URL.revokeObjectURL(sourceUrl);
    }
    self.postMessage({
      token,
      type: "progress",
      phase: 1,
      message: "Generating 60 seconds of committed stereo input.",
    });
    const fixture = workload.generateFixture();
    self.postMessage({
      token,
      type: "progress",
      phase: 2,
      message: `Running the complete ${target} DSP chain.`,
    });
    let result;
    if (target === "javascript") {
      result = workload.processJavaScript(fixture);
    } else {
      const wasmBytes = await fetchBytes(
        "/artifacts/base-audio-webaudio-effects-v1/audio-webaudio-effects.wasm",
      );
      if (await sha256Hex(wasmBytes) !== build.artifact.sha256) {
        throw new Error("Wasm artifact hash mismatch");
      }
      const { instance } = await WebAssembly.instantiate(wasmBytes);
      result = runWasm(instance, fixture, workload.IR);
    }
    self.postMessage({
      token,
      type: "progress",
      phase: 3,
      message: "Hashing every output sample and checking exact fixed work.",
    });
    const digest = await sha256Hex(workload.interleaveBytes(result));
    const expected = target === "javascript" ? oracle.jsSha256 : oracle.wasmSha256;
    if (digest !== expected || oracle.exactCrossTarget !== true) {
      throw new Error("complete output oracle mismatch");
    }
    const counts = workload.counters(workload.CONTRACT.frames, target);
    if (
      counts["input-frames"] !== 2_880_000 || counts["blocks-128"] !== 22_500 ||
      counts["output-samples"] !== 5_760_030 || counts["convolution-macs"] !== 92_160_480
    ) {
      throw new Error("fixed-work counter mismatch");
    }
    self.postMessage({
      token,
      type: "complete",
      text: `Target: ${target}\nComplete output SHA-256: ${digest}\nFrames: ${
        counts["input-frames"]
      }\nBlocks: ${counts["blocks-128"]}\nOutput samples: ${
        counts["output-samples"]
      }\nConvolution MACs: ${counts["convolution-macs"]}\nBoundary crossings: ${
        counts["boundary-crossings"]
      }`,
    });
  } catch (error) {
    self.postMessage({
      token,
      type: "error",
      message: error instanceof Error ? error.message : String(error),
    });
  }
});
