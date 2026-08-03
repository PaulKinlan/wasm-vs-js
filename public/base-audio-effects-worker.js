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

function runWasm(instance, fixture, ir, blockFrames) {
  const { memory, reset_state: resetState, effects_block: effectsBlock, flush_tail: flushTail } =
    instance.exports;
  if (
    !(memory instanceof WebAssembly.Memory) || typeof resetState !== "function" ||
    typeof effectsBlock !== "function" || typeof flushTail !== "function"
  ) throw new Error("Wasm exports are incomplete");
  const frames = fixture.left.length;
  const outputFrames = frames + ir.length - 1;
  const stateBytes = align(16 + ir.length * 4);
  const leftIn = 0;
  const rightIn = align(leftIn + frames * 4);
  const irPtr = align(rightIn + frames * 4);
  const leftOut = align(irPtr + ir.length * 4);
  const rightOut = align(leftOut + outputFrames * 4);
  const leftState = align(rightOut + outputFrames * 4);
  const rightState = leftState + stateBytes;
  if (rightState + stateBytes > memory.buffer.byteLength) throw new Error("fixed memory too small");
  new Float32Array(memory.buffer, leftIn, frames).set(fixture.left);
  new Float32Array(memory.buffer, rightIn, frames).set(fixture.right);
  new Float32Array(memory.buffer, irPtr, ir.length).set(ir);
  const observed = {
    blocksPerChannel: [],
    blockInvocations: 0,
    stateCarryBoundaries: 0,
    tailFlushInvocations: 0,
    tailFlushFrames: 0,
    processingBoundaryCrossings: 0,
  };
  for (
    const [input, output, state] of [
      [leftIn, leftOut, leftState],
      [rightIn, rightOut, rightState],
    ]
  ) {
    resetState(state, ir.length);
    let channelBlocks = 0;
    for (let offset = 0; offset < frames; offset += blockFrames) {
      const count = Math.min(blockFrames, frames - offset);
      if (channelBlocks > 0) observed.stateCarryBoundaries++;
      effectsBlock(input + offset * 4, count, irPtr, ir.length, output + offset * 4, state);
      channelBlocks++;
      observed.blockInvocations++;
      observed.processingBoundaryCrossings++;
    }
    observed.blocksPerChannel.push(channelBlocks);
    flushTail(ir.length - 1, irPtr, ir.length, output + frames * 4, state);
    observed.tailFlushInvocations++;
    observed.tailFlushFrames += ir.length - 1;
    observed.processingBoundaryCrossings++;
  }
  return {
    left: new Float32Array(memory.buffer, leftOut, outputFrames).slice(),
    right: new Float32Array(memory.buffer, rightOut, outputFrames).slice(),
    observations: workloadObservations(observed),
  };
}

function workloadObservations(observed) {
  return Object.freeze({
    ...observed,
    blocksPerChannel: Object.freeze([...observed.blocksPerChannel]),
  });
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
      result = runWasm(instance, fixture, workload.IR, workload.CONTRACT.blockFrames);
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
    const counts = workload.counters(workload.CONTRACT.frames, target, result.observations);
    if (
      counts["input-frames"] !== 2_880_000 || counts["blocks-per-channel"] !== 22_500 ||
      counts["block-invocations"] !== 45_000 ||
      counts["state-carry-boundaries"] !== 44_998 ||
      counts["output-samples"] !== 5_760_030 || counts["convolution-macs"] !== 92_160_480
    ) {
      throw new Error("fixed-work counter mismatch");
    }
    self.postMessage({
      token,
      type: "complete",
      text: `Target: ${target}\nComplete output SHA-256: ${digest}\nFrames: ${
        counts["input-frames"]
      }\nBlocks per channel: ${counts["blocks-per-channel"]}\nBlock invocations: ${
        counts["block-invocations"]
      }\nOutput samples: ${counts["output-samples"]}\nConvolution MACs: ${
        counts["convolution-macs"]
      }\nBoundary crossings: ${counts["boundary-crossings"]}`,
    });
  } catch (error) {
    self.postMessage({
      token,
      type: "error",
      message: error instanceof Error ? error.message : String(error),
    });
  }
});
