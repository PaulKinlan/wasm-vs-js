import Ajv2020Module from "ajv2020";
import { sha256Hex } from "../lib/canonical.ts";
import { validateBenchmark } from "../lib/contracts.ts";
import { generatePcapFixture } from "../benchmarks/base/network-pcap-decode/fixture.ts";
import { runPcapJavaScript } from "../benchmarks/base/network-pcap-decode/engine.js";
import {
  type PcapEvidenceBundle,
  validatePcapEvidenceSemantics,
} from "../benchmarks/base/network-pcap-decode/evidence-contract.ts";
import { createHandler } from "../server.ts";
import { assert, assertEquals, assertRejects } from "./assert.ts";

type Validator = ((value: unknown) => boolean) & { errors?: unknown };
type AjvInstance = { compile: (schema: unknown) => Validator };
type AjvConstructor = new (options?: Record<string, unknown>) => AjvInstance;
const Ajv2020 = ((Ajv2020Module as unknown as { default?: AjvConstructor }).default ??
  Ajv2020Module) as unknown as AjvConstructor;

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
function fixtureWithDistinctFlows(count: number) {
  const base = generatePcapFixture();
  const view = new DataView(base.buffer, base.byteOffset, base.byteLength);
  const firstRecordBytes = 16 + view.getUint32(24 + 8, true);
  const firstRecord = base.slice(24, 24 + firstRecordBytes);
  const fixture = new Uint8Array(24 + count * firstRecordBytes);
  fixture.set(base.subarray(0, 24));
  for (let index = 0; index < count; index++) {
    const record = firstRecord.slice();
    record[16 + 14 + 12 + 3] = 100 + index;
    fixture.set(record, 24 + index * firstRecordBytes);
  }
  return fixture;
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

Deno.test("full flow tables terminate and the next distinct flow fails closed", async () => {
  const full = fixtureWithDistinctFlows(16);
  const jsFull = runPcapJavaScript(full);
  const wasmFull = await wasmRun(full);
  assertEquals(wasmFull.status, 0);
  assert(sameBytes(jsFull.bytes, wasmFull.bytes));
  assertEquals(jsFull.counters.flows, 16);

  const overflow = fixtureWithDistinctFlows(17);
  await assertRejects(
    () => Promise.resolve(runPcapJavaScript(overflow)),
    "flow table capacity exceeded",
  );
  assertEquals((await wasmRun(overflow)).status, -8);
});

Deno.test("DNS records require A type and IN class in questions and answers", async () => {
  const base = generatePcapFixture();
  const packets = recordOffsets(base);
  const queryPayload = packets[3] + 14 + 20 + 8;
  const responsePayload = packets[4] + 14 + 20 + 8;
  for (
    const offset of [
      queryPayload + 27,
      queryPayload + 29,
      responsePayload + 27,
      responsePayload + 29,
      responsePayload + 33,
      responsePayload + 35,
    ]
  ) {
    const fixture = base.slice();
    fixture[offset] = 28;
    const js = runPcapJavaScript(fixture);
    const wasm = await wasmRun(fixture);
    assertEquals(wasm.status, 0);
    assert(sameBytes(js.bytes, wasm.bytes));
    const words = new Uint32Array(js.bytes.buffer, js.bytes.byteOffset, js.bytes.byteLength / 4);
    assertEquals(words[7], 1);
  }
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

async function readPcapBundle(): Promise<PcapEvidenceBundle> {
  const readJson = async (path: string) => JSON.parse(await Deno.readTextFile(path));
  return {
    benchmark: await readJson("benchmarks/base/network-pcap-decode/benchmark.json"),
    registration: await readJson(
      "benchmarks/base/network-pcap-decode/implementation-contract.v1.json",
    ),
    fixture: await readJson(
      "public/artifacts/base-network-pcap-decode/fixture-manifest.json",
    ),
    output: await readJson("public/artifacts/base-network-pcap-decode/output-manifest.json"),
    build: await readJson("public/artifacts/base-network-pcap-decode/build-manifest.json"),
    records: {
      "js-controlled": await readJson(
        "public/evidence/base-v1/network-pcap-decode/js-controlled.json",
      ),
      "wasm-linear-controlled": await readJson(
        "public/evidence/base-v1/network-pcap-decode/wasm-linear-controlled.json",
      ),
    },
  };
}

Deno.test("closed PCAP schemas and semantics reject record, manifest, and registration mutations", async () => {
  const bundle = await readPcapBundle();
  const ajv = new Ajv2020({ allErrors: true, strict: false });
  const schemas = Object.fromEntries(
    await Promise.all([
      ["registration", "schemas/base-network-pcap-registration.schema.json"],
      ["fixture", "schemas/base-network-pcap-fixture-manifest.schema.json"],
      ["output", "schemas/base-network-pcap-output-manifest.schema.json"],
      ["build", "schemas/base-network-pcap-build-manifest.schema.json"],
      ["record", "schemas/base-network-pcap-correctness-record.schema.json"],
    ].map(async ([name, path]) => [
      name,
      ajv.compile(JSON.parse(await Deno.readTextFile(path))),
    ])),
  ) as Record<string, Validator>;
  for (
    const [name, value] of [
      ["registration", bundle.registration],
      ["fixture", bundle.fixture],
      ["output", bundle.output],
      ["build", bundle.build],
      ["record", bundle.records["js-controlled"]],
      ["record", bundle.records["wasm-linear-controlled"]],
    ] as const
  ) {
    assert(schemas[name](value), `${name}: ${JSON.stringify(schemas[name].errors)}`);
    const undeclared = structuredClone(value);
    undeclared.unreviewed = true;
    assert(!schemas[name](undeclared), `${name} schema accepted an undeclared property`);
  }
  const valid = await validatePcapEvidenceSemantics(bundle);
  assert(valid.ok, valid.errors.join("; "));

  for (
    const mutate of [
      (value: PcapEvidenceBundle) => value.registration.fixture.sha256 = "0".repeat(64),
      (value: PcapEvidenceBundle) => value.fixture.sha256 = "0".repeat(64),
      (value: PcapEvidenceBundle) => value.output.sha256 = "0".repeat(64),
      (value: PcapEvidenceBundle) => value.build.fixture.sha256 = "0".repeat(64),
      (value: PcapEvidenceBundle) => value.build.wasm.sha256 = "0".repeat(64),
      (value: PcapEvidenceBundle) => value.build.wasm.bytes++,
      (value: PcapEvidenceBundle) => value.build.sourceSha256 = "0".repeat(64),
      (value: PcapEvidenceBundle) => value.build.build.lockfiles[0].sha256 = "0".repeat(64),
      (value: PcapEvidenceBundle) => value.build.build.commands.reverse(),
      (value: PcapEvidenceBundle) => value.records["js-controlled"].target = "wasm-linear",
    ]
  ) {
    const poisoned = structuredClone(bundle);
    mutate(poisoned);
    const rejected = await validatePcapEvidenceSemantics(poisoned);
    assert(!rejected.ok, "semantic validator accepted contradictory PCAP evidence");
  }
});

Deno.test("PCAP build reproduces eight published files from its exact commit and source graph", async () => {
  const bundle = await readPcapBundle();
  const paths = [
    "public/artifacts/base-network-pcap-decode/pcap-decode.wasm",
    "public/artifacts/base-network-pcap-decode/fixture.pcap",
    "public/artifacts/base-network-pcap-decode/reference-output.bin",
    "public/artifacts/base-network-pcap-decode/fixture-manifest.json",
    "public/artifacts/base-network-pcap-decode/output-manifest.json",
    "public/artifacts/base-network-pcap-decode/build-manifest.json",
    "public/evidence/base-v1/network-pcap-decode/js-controlled.json",
    "public/evidence/base-v1/network-pcap-decode/wasm-linear-controlled.json",
  ];
  const before = new Map(
    await Promise.all(paths.map(async (path) =>
      [
        path,
        await sha256Hex(await Deno.readFile(path)),
      ] as const
    )),
  );
  for (const source of bundle.build.fullSourceGraph) {
    const committed = await new Deno.Command("git", {
      args: ["show", `${bundle.build.sourceCommit}:${source.path}`],
      stdout: "piped",
      stderr: "piped",
    }).output();
    assert(committed.success, new TextDecoder().decode(committed.stderr));
    assertEquals(await sha256Hex(committed.stdout), source.sha256);
    assertEquals(await sha256Hex(await Deno.readFile(source.path)), source.sha256);
  }
  const result = await new Deno.Command(Deno.execPath(), {
    args: [
      "run",
      "--allow-read=.,/tmp",
      "--allow-write=/tmp",
      "--allow-run=git,clang,wasm-ld",
      "scripts/build-base-network-pcap-decode.ts",
      "--check",
      `--source-commit=${bundle.build.sourceCommit}`,
    ],
    stdout: "piped",
    stderr: "piped",
  }).output();
  assert(result.success, new TextDecoder().decode(result.stderr));
  for (const [path, expected] of before) {
    assert(
      await sha256Hex(await Deno.readFile(path)) === expected,
      `${path} changed during reproduction`,
    );
  }
});

Deno.test("public server exposes the closed PCAP demo package read-only", async () => {
  const handler = createHandler(null, "public");
  for (
    const path of [
      "/benchmarks/network.pcap-decode.v1/",
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
