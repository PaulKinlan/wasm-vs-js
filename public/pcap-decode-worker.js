import { runPcapJavaScript } from "../benchmarks/base/network-pcap-decode/engine.js";

const EXPECTED = {
  fixture: "8683e2fc95f0b8940b9dc2c867e08adeccf1a66445d7bf98785ea600ff6d9034",
  output: "749c83f435cfc7965a5e13a9fdc7a90772a2c44f9899ce15e041fe0d47a562f3",
  wasm: "e19a405c97270763bfb325c656007fe472333553cb92e6e4df24fd8509b54dab",
};
function hex(bytes) {
  return Array.from(bytes, (value) => value.toString(16).padStart(2, "0")).join("");
}
async function sha256(bytes) {
  return hex(new Uint8Array(await crypto.subtle.digest("SHA-256", bytes)));
}
async function exactFetch(path, expected) {
  const response = await fetch(path, { cache: "no-store" });
  if (!response.ok) throw new Error(`${path} returned ${response.status}`);
  const bytes = new Uint8Array(await response.arrayBuffer());
  const actual = await sha256(bytes);
  if (actual !== expected) throw new Error(`${path} byte identity failed`);
  return bytes;
}
function countersFromOutput(bytes, target) {
  const words = new Uint32Array(bytes.buffer, bytes.byteOffset, bytes.byteLength / 4);
  return {
    packetRecords: words[2],
    ethernetHeaders: words[3],
    ipv4Headers: words[4],
    tcpHeaders: words[5],
    udpHeaders: words[6],
    dnsMessages: words[7],
    httpMessages: words[8],
    dnsCompressionPointers: words[9],
    tcpReassemblyAppends: words[10],
    malformedPackets: words[11],
    flows: words[12],
    flowTableProbes: words[13],
    packetBytes: words[14],
    outputBytes: bytes.byteLength,
    allocations: target === "wasm-linear-controlled" ? 0 : 14,
    boundaryCrossings: target === "wasm-linear-controlled" ? 1 : 0,
  };
}
self.addEventListener("message", async (event) => {
  const { token, target } = event.data ?? {};
  if (typeof token !== "string" || !["js-controlled", "wasm-linear-controlled"].includes(target)) {
    return;
  }
  try {
    const fixture = await exactFetch(
      "/artifacts/base-network-pcap-decode/fixture.pcap",
      EXPECTED.fixture,
    );
    const reference = await exactFetch(
      "/artifacts/base-network-pcap-decode/reference-output.bin",
      EXPECTED.output,
    );
    let output;
    if (target === "js-controlled") {
      output = runPcapJavaScript(fixture).bytes;
    } else {
      const wasm = await exactFetch(
        "/artifacts/base-network-pcap-decode/pcap-decode.wasm",
        EXPECTED.wasm,
      );
      const instance = await WebAssembly.instantiate(wasm);
      const exports = instance.instance.exports;
      new Uint8Array(exports.memory.buffer, exports.input_ptr(), fixture.length).set(fixture);
      const status = exports.run(fixture.length);
      if (status !== 0) throw new Error(`Wasm parser stopped with status ${status}`);
      output = new Uint8Array(
        exports.memory.buffer,
        exports.output_ptr(),
        exports.output_len(),
      ).slice();
    }
    if (
      output.length !== reference.length ||
      !output.every((value, index) => value === reference[index])
    ) {
      throw new Error("complete canonical flow table mismatch");
    }
    const outputHash = await sha256(output);
    if (outputHash !== EXPECTED.output) throw new Error("output identity failed");
    self.postMessage({
      type: "complete",
      token,
      result: {
        target,
        outputHash,
        counters: countersFromOutput(output, target),
        protocols: ["Ethernet", "IPv4", "TCP", "UDP", "DNS", "HTTP/1.1"],
        performanceClaim: null,
      },
    });
  } catch (error) {
    self.postMessage({
      type: "error",
      token,
      message: error instanceof Error ? error.message : String(error),
    });
  }
});
