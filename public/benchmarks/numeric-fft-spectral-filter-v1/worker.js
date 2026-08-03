import {
  checkpointValues,
  expectedCounters,
  generateFixture,
  runPipelineJs,
  runPipelineWasm,
} from "/benchmarks/base/numeric-fft-spectral-filter/workload.js";

self.onmessage = async ({ data }) => {
  if (!data || data.type !== "start" || !Number.isInteger(data.token)) return;
  const { token, target } = data;
  try {
    if (target !== "js-controlled" && target !== "wasm-linear-controlled") {
      throw new Error("Unknown controlled target");
    }
    const [manifestResponse, wasmResponse] = await Promise.all([
      fetch("/artifacts/numeric-fft-spectral-filter/output-manifest.json", { cache: "no-store" }),
      fetch("/artifacts/numeric-fft-spectral-filter/numeric-fft-spectral-filter.wasm", {
        cache: "no-store",
      }),
    ]);
    if (!manifestResponse.ok || !wasmResponse.ok) throw new Error("Required artifact fetch failed");
    const manifest = await manifestResponse.json();
    const wasm = new Uint8Array(await wasmResponse.arrayBuffer());
    self.postMessage({ type: "phase", token, phase: "fixture" });
    const fixture = generateFixture();
    self.postMessage({ type: "phase", token, phase: "compute" });
    const output = target === "js-controlled"
      ? runPipelineJs(fixture.signal, fixture.window, fixture.twiddles, fixture.gains)
      : await runPipelineWasm(
        wasm,
        fixture.signal,
        fixture.window,
        fixture.twiddles,
        fixture.gains,
      );
    self.postMessage({ type: "phase", token, phase: "validate" });
    const canonical = output.slice();
    for (let index = 0; index < canonical.length; index += 1) {
      if (Object.is(canonical[index], -0)) canonical[index] = 0;
    }
    const outputSha256 = await sha256(new Uint8Array(canonical.buffer));
    if (outputSha256 !== manifest.completeOutput.sha256) {
      throw new Error("Complete output SHA-256 mismatch");
    }
    self.postMessage({
      type: "result",
      token,
      result: {
        target,
        passed: true,
        completeOutputSha256: outputSha256,
        quantizedOutputSha256: manifest.completeOutput.quantizedSha256,
        componentsValidated: output.length,
        checkpoints: checkpointValues(output),
        counters: expectedCounters(fixture.signal.length, target),
        statement: "No duration was collected.",
      },
    });
  } catch (error) {
    self.postMessage({
      type: "error",
      token,
      message: error instanceof Error ? error.message : String(error),
    });
  }
};

async function sha256(bytes) {
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return [...new Uint8Array(digest)].map((value) => value.toString(16).padStart(2, "0")).join("");
}
