import { sha256Hex } from "../lib/canonical.ts";
import { validateBenchmark } from "../lib/contracts.ts";
import { generatePcapFixture } from "../benchmarks/base/network-pcap-decode/fixture.ts";
import { runPcapJavaScript } from "../benchmarks/base/network-pcap-decode/engine.js";
import { createHandler } from "../server.ts";
import { assert, assertEquals, assertRejects } from "./assert.ts";

const artifactPath = "public/artifacts/base-network-pcap-decode/pcap-decode.wasm";

async function wasmRun(fixture: Uint8Array, instance?: WebAssembly.Instance) {
  const runtime = instance ??
    (await WebAssembly.instantiate(await Deno.readFile(artifactPath))).instance;
  const exports = runtime.exports as unknown as {
    memory: WebAssembly.Memory;
    input_ptr(): number;
    output_ptr(): number;
    output_len(): number;
    run(length: number): number;
  };
  new Uint8Array(exports.memory.buffer, exports.input_ptr(), fixture.length).set(fixture);
  const status = exports.run(fixture.length);
  const bytes = status === 0
    ? new Uint8Array(exports.memory.buffer, exports.output_ptr(), exports.output_len()).slice()
    : new Uint8Array();
  return { status, bytes, instance: runtime };
}
function recordOffsets(bytes: Uint8Array) {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const offsets: number[] = [];
  let offset = 24;
  while (offset < bytes.length) {
    const length = view.getUint32(offset + 8, true);
    offsets.push(offset + 16);
    offset += 16 + length;
  }
  return offsets;
}
function sameBytes(a: Uint8Array, b: Uint8Array) {
  return a.length === b.length && a.every((value, index) => value === b[index]);
}

Deno.test("base PCAP fixture is exact, generated, and leaves frozen v1 byte-identical", async () => {
  const fixture = generatePcapFixture();
  assertEquals(fixture.length, 663);
  assertEquals(
    await sha256Hex(fixture),
    "8683e2fc95f0b8940b9dc2c867e08adeccf1a66445d7bf98785ea600ff6d9034",
  );
  assertEquals(
    await sha256Hex(await Deno.readFile("catalog/workloads.v1.json")),
    "6665664f984683e5b7d3fdc8c1602198124844704c224a526d48be2f02edf9d4",
  );
  assertEquals(
    await Deno.readFile("catalog/workloads.v1.json"),
    await Deno.readFile("public/data/workloads.v1.json"),
  );
  const rights = await Deno.readTextFile("benchmarks/base/network-pcap-decode/RIGHTS.md");
  assert(rights.includes("no captured network traffic"));
  assert(rights.includes("CC0-1.0"));
  const benchmark = JSON.parse(
    await Deno.readTextFile("benchmarks/base/network-pcap-decode/benchmark.json"),
  );
  const validation = validateBenchmark(benchmark);
  assert(validation.ok, validation.errors.join("; "));
});

Deno.test("JavaScript and material Wasm emit the complete identical four-flow table", async () => {
  const fixture = generatePcapFixture();
  const js = runPcapJavaScript(fixture);
  const wasm = await wasmRun(fixture);
  assertEquals(wasm.status, 0);
  assert(sameBytes(js.bytes, wasm.bytes));
  assertEquals(js.bytes.length, 208);
  assertEquals(
    await sha256Hex(js.bytes),
    "749c83f435cfc7965a5e13a9fdc7a90772a2c44f9899ce15e041fe0d47a562f3",
  );
  assertEquals(js.counters, {
    packetRecords: 8,
    ethernetHeaders: 7,
    ipv4Headers: 7,
    tcpHeaders: 3,
    udpHeaders: 2,
    dnsMessages: 2,
    httpMessages: 2,
    dnsCompressionPointers: 1,
    tcpReassemblyAppends: 3,
    malformedPackets: 3,
    flowTableProbes: 6,
    packetBytes: 511,
    allocations: 14,
    boundaryCrossings: 0,
    flows: 4,
    outputBytes: 208,
  });
  const words = new Uint32Array(js.bytes.buffer, js.bytes.byteOffset, js.bytes.byteLength / 4);
  assertEquals(Array.from(words.slice(2, 16)), [8, 7, 7, 3, 2, 2, 2, 1, 3, 3, 4, 6, 511, 52]);
});

Deno.test("same Wasm instance clears physical flow and reassembly state between runs", async () => {
  const fixture = generatePcapFixture();
  const first = await wasmRun(fixture);
  const second = await wasmRun(fixture, first.instance);
  assertEquals(first.status, 0);
  assertEquals(second.status, 0);
  assert(sameBytes(first.bytes, second.bytes));
});

Deno.test("differential malformed, DNS compression, and TCP reassembly perturbations agree", async () => {
  const base = generatePcapFixture();
  const packets = recordOffsets(base);
  const cases: Uint8Array[] = [];
  const badHttp = base.slice();
  badHttp[packets[0] + 14 + 20 + 20] = "X".charCodeAt(0);
  cases.push(badHttp);
  const badSequence = base.slice();
  badSequence[packets[1] + 14 + 20 + 7] ^= 1;
  cases.push(badSequence);
  const badDnsLabel = base.slice();
  badDnsLabel[packets[3] + 14 + 20 + 8 + 12] = 64;
  cases.push(badDnsLabel);
  const badDnsPointer = base.slice();
  const responsePayload = packets[4] + 14 + 20 + 8;
  // Question is 18 bytes (14-byte name + qtype/qclass); answer name starts at payload+30.
  badDnsPointer[responsePayload + 30] = 0;
  cases.push(badDnsPointer);

  for (const fixture of cases) {
    const js = runPcapJavaScript(fixture).bytes;
    const wasm = await wasmRun(fixture);
    assertEquals(wasm.status, 0);
    assert(sameBytes(js, wasm.bytes));
  }
});

Deno.test("truncated records and invalid microsecond timestamps fail closed in both targets", async () => {
  const fixture = generatePcapFixture();
  for (const length of [0, 23, 39, fixture.length - 1]) {
    const truncated = fixture.slice(0, length);
    await assertRejects(() => Promise.resolve(runPcapJavaScript(truncated)), "");
    const wasm = await wasmRun(truncated);
    assert(wasm.status < 0);
  }
  const invalidTimestamp = fixture.slice();
  new DataView(invalidTimestamp.buffer).setUint32(28, 1_000_000, true);
  await assertRejects(() => Promise.resolve(runPcapJavaScript(invalidTimestamp)), "timestamp");
  assertEquals((await wasmRun(invalidTimestamp)).status, -7);
});

Deno.test("build, fixture, output, and evidence manifests anchor exact bytes", async () => {
  const build = JSON.parse(
    await Deno.readTextFile("public/artifacts/base-network-pcap-decode/build-manifest.json"),
  );
  const fixture = JSON.parse(
    await Deno.readTextFile("public/artifacts/base-network-pcap-decode/fixture-manifest.json"),
  );
  const output = JSON.parse(
    await Deno.readTextFile("public/artifacts/base-network-pcap-decode/output-manifest.json"),
  );
  assertEquals(build.fixture.sha256, fixture.sha256);
  assertEquals(build.referenceOutput.sha256, output.sha256);
  assertEquals(build.wasm.sha256, await sha256Hex(await Deno.readFile(build.wasm.path)));
  assertEquals(build.fullSourceGraph.length, 7);
  for (const source of build.fullSourceGraph) {
    assertEquals(source.sha256, await sha256Hex(await Deno.readFile(source.path)));
  }
  for (const variant of ["js-controlled", "wasm-linear-controlled"]) {
    const record = JSON.parse(
      await Deno.readTextFile(`public/evidence/base-v1/network-pcap-decode/${variant}.json`),
    );
    assertEquals(record.completeOutput.sha256, output.sha256);
    assertEquals(record.performanceClaims, []);
    assertEquals(record.structuralChecks.protocolsMateriallyExercised.length, 6);
  }
});

Deno.test("public server exposes the closed PCAP demo package read-only", async () => {
  const handler = createHandler(null, "public");
  for (
    const path of [
      "/demos/network.pcap-decode.v1/",
      "/pcap-decode-demo.js",
      "/pcap-decode-worker.js",
      "/benchmarks/base/network-pcap-decode/engine.js",
      "/artifacts/base-network-pcap-decode/pcap-decode.wasm",
      "/artifacts/base-network-pcap-decode/fixture.pcap",
      "/artifacts/base-network-pcap-decode/reference-output.bin",
      "/artifacts/base-network-pcap-decode/build-manifest.json",
      "/evidence/base-v1/network-pcap-decode/js-controlled.json",
      "/evidence/base-v1/network-pcap-decode/wasm-linear-controlled.json",
    ]
  ) {
    const response = await handler(new Request(`http://127.0.0.1${path}`));
    assert(response.status === 200, `${path} returned ${response.status}`);
  }
  const denied = await handler(
    new Request("http://127.0.0.1/demos/network.pcap-decode.v1/", { method: "POST" }),
  );
  assertEquals(denied.status, 403);
  const unknown = await handler(
    new Request("http://127.0.0.1/artifacts/base-network-pcap-decode/private.bin"),
  );
  assertEquals(unknown.status, 404);
});

Deno.test("demo lifecycle uses fresh workers, cancellation, stale rejection, timeout and pagehide cleanup", async () => {
  const runner = await Deno.readTextFile("public/pcap-decode-demo.js");
  assert(runner.includes("new Worker"));
  assert(runner.includes("worker.terminate()"));
  assert(runner.includes("generation !== runGeneration"));
  assert(runner.includes("TIMEOUT_MS"));
  assert(runner.includes('addEventListener("pagehide"'));
  const page = await Deno.readTextFile("public/demos/network.pcap-decode.v1/index.html");
  assert(page.includes('aria-live="polite"'));
  assert(page.includes("No performance claim"));
  assert(page.includes("does not upload, retain, or rank"));
});
