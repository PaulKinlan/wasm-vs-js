// @ts-ignore Browser same-origin route, mapped by server.ts.
import { makeProtocolTrace } from "/benchmarks/v1/network-http2-quic-state/fixture.js";
// @ts-ignore Browser same-origin route, mapped by server.ts.
import { runProtocolTrace } from "/benchmarks/v1/network-http2-quic-state/engine.js";

async function sha256(words) {
  const digest = new Uint8Array(
    await crypto.subtle.digest("SHA-256", new Uint8Array(words.buffer)),
  );
  return Array.from(digest).map((value) => value.toString(16).padStart(2, "0")).join("");
}
self.onmessage = async ({ data }) => {
  try {
    const fixture = makeProtocolTrace();
    let state;
    if (data.target === "js") state = runProtocolTrace(fixture);
    else if (data.target === "wasm") {
      const response = await fetch(
        "/artifacts/network-http2-quic-state/network-http2-quic-state.wasm",
      );
      if (!response.ok) throw new Error(`Wasm fetch failed: ${response.status}`);
      const { instance } = await WebAssembly.instantiate(await response.arrayBuffer());
      const { memory, run_trace: runTrace } = instance.exports;
      new Uint8Array(memory.buffer, 0, fixture.length).set(fixture);
      runTrace(0, fixture.length, 200000);
      state = new Uint32Array(memory.buffer, 200000, 64).slice();
    } else throw new Error("Unknown target");
    const expectedResponse = await fetch(
      "/artifacts/network-http2-quic-state/expected-state.u32le",
    );
    if (!expectedResponse.ok) throw new Error(`Oracle fetch failed: ${expectedResponse.status}`);
    const expected = new Uint32Array(await expectedResponse.arrayBuffer());
    if (
      state.length !== expected.length || state.some((value, index) => value !== expected[index])
    ) {
      throw new Error("Complete state vector differs from the frozen oracle");
    }
    self.postMessage({
      token: data.token,
      ok: true,
      target: data.target,
      state: Array.from(state),
      sha256: await sha256(state),
    });
  } catch (error) {
    self.postMessage({
      token: data.token,
      ok: false,
      error: error instanceof Error ? error.message : String(error),
    });
  }
};
