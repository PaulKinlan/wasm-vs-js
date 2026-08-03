import { sha256Hex } from "../lib/canonical.ts";
import { createHandler } from "../server.ts";
import {
  decodeMessage,
  frame,
  generateFixture,
  protoJson,
  runJavaScript,
  runWasm,
} from "../benchmarks/base/serialization-protobuf-gateway/workload.js";
import { assert, assertEquals, assertRejects } from "./assert.ts";

function throws(fn: () => unknown) {
  let did = false;
  try {
    fn();
  } catch {
    did = true;
  }
  assert(did, "expected function to throw");
}

const DIR = "public/artifacts/serialization-protobuf-gateway/";
const FROZEN = "6665664f984683e5b7d3fdc8c1602198124844704c224a526d48be2f02edf9d4";

Deno.test("base protobuf preserves frozen catalog and registers full exact supplemental work", async () => {
  assertEquals(await sha256Hex(await Deno.readFile("catalog/workloads.v1.json")), FROZEN);
  assertEquals(await sha256Hex(await Deno.readFile("public/data/workloads.v1.json")), FROZEN);
  const contract = JSON.parse(
    await Deno.readTextFile(
      "benchmarks/base/serialization-protobuf-gateway/implementation-contract.v1.json",
    ),
  );
  assertEquals(contract.frozenCatalog.id, "serialization.protobuf-gateway.v1");
  assertEquals(contract.frozenCatalog.catalogSha256, FROZEN);
  assertEquals(contract.fixedWork.messages, 10000);
  assertEquals(
    contract.schema.file,
    "benchmarks/base/serialization-protobuf-gateway/gateway-event.proto",
  );
  const proto = await Deno.readTextFile(contract.schema.file);
  for (
    const field of [
      "uint64 id = 1",
      "map<string, sint64> metrics = 7",
      "oneof choice",
      "float ratio = 11",
    ]
  ) assert(proto.includes(field));
  assertEquals(contract.schema.wireTypes.admitted, [0, 1, 2, 5]);
  assertEquals(contract.schema.protoJsonFieldOrder, [
    "id",
    "name",
    "active",
    "score",
    "status",
    "tags",
    "metrics",
    "payload",
    "note-or-code",
    "ratio",
  ]);
  assertEquals(contract.reference.commit, "4fbd1111a292d04746c732573025e3251de0bb9c");
  assertEquals(
    contract.reference.archiveSha256,
    "bb1fd58473c47c747a3f00fc45ced1d562bba4bf645db07cc889fe86dee279ca",
  );
  assertEquals(contract.reference.redistribution, "recipe-only; archive is not vendored");
});

Deno.test("base protobuf complete 10k JS and material Wasm outputs and operative counters match", async () => {
  const fixture = generateFixture();
  const fixtureManifest = JSON.parse(await Deno.readTextFile(`${DIR}fixture-manifest.json`));
  assertEquals(fixture.length, 1533942);
  assertEquals(await sha256Hex(fixture), fixtureManifest.sha256);
  const js = runJavaScript(fixture);
  const wasmBytes = await Deno.readFile(`${DIR}serialization-protobuf-gateway.wasm`);
  const wasm = await runWasm(fixture, wasmBytes);
  assertEquals(js.text, wasm.text);
  assertEquals(
    await sha256Hex(js.bytes),
    "e0c54e5553fc1850e4ef0583e7cfc50f4636f68364300cc4a9a7de2518f6d8a7",
  );
  assertEquals(js.bytes.length, 354982);
  assertEquals(js.counters.messages, 10000);
  assertEquals(js.counters.fields, 170294);
  assertEquals(js.counters.varintBytes, 474804);
  assertEquals(js.counters.unknownFields, 40000);
  assertEquals(js.counters.filteredMessages, 1703);
  const jsCounters = js.counters as Record<string, number>;
  const wasmCounters = wasm.counters as Record<string, number>;
  for (
    const key of [
      "messages",
      "fields",
      "varintBytes",
      "unknownFields",
      "filteredMessages",
      "wireBytes",
      "protoJsonBytes",
    ]
  ) assertEquals(jsCounters[key], wasmCounters[key]);
  assertEquals(js.counters.boundaryCrossings, 0);
  assertEquals(wasm.counters.boundaryCrossings, 1);
  assertEquals(wasm.counters.allocations, 0);
  const module = await WebAssembly.compile(wasmBytes);
  const exports = WebAssembly.Module.exports(module).map((entry) => entry.name).sort();
  assertEquals(exports, ["memory", "process"]);
});

Deno.test("base protobuf conformance golden covers duplicates maps oneof defaults nonfinite UTF8 escaping and unknowns", () => {
  // id=2^53+1; name duplicated (last wins); explicit default active; status ACTIVE;
  // repeated tags; duplicate map key (last wins); note then code (oneof last wins);
  // NaN float; unknown fixed32. This independent byte vector is not produced by the fixture generator.
  const bytes = new Uint8Array([
    0x08,
    0x81,
    0x80,
    0x80,
    0x80,
    0x80,
    0x80,
    0x80,
    0x10,
    0x12,
    0x01,
    0x61,
    0x12,
    0x05,
    0x63,
    0x61,
    0x66,
    0xc3,
    0xa9,
    0x18,
    0x00,
    0x28,
    0x01,
    0x32,
    0x01,
    0x78,
    0x32,
    0x01,
    0x79,
    0x3a,
    0x05,
    0x0a,
    0x01,
    0x6b,
    0x10,
    0x02,
    0x3a,
    0x05,
    0x0a,
    0x01,
    0x6b,
    0x10,
    0x04,
    0x4a,
    0x01,
    0x6e,
    0x50,
    0x07,
    0x5d,
    0x00,
    0x00,
    0xc0,
    0x7f,
    0xed,
    0x05,
    0x01,
    0x00,
    0x00,
    0x00,
  ]);
  const message = decodeMessage(bytes);
  assertEquals(
    protoJson(message),
    '{"id":"9007199254740993","name":"café","status":"ACTIVE","tags":["x","y"],"metrics":{"k":"2"},"code":7,"ratio":"NaN"}',
  );
});

Deno.test("base protobuf adversarial ProtoJSON cases match in JS and material Wasm", async () => {
  const first: number[] = [
    0x08,
    0x03, // selected id
    0x12,
    0x03,
    0x22,
    0x5c,
    0x0a, // quote, backslash, newline
    0x18,
    0x01,
    0x21,
    0x00,
    0x00,
    0x00,
    0x00,
    0x00,
    0x00,
    0x00,
    0x80, // double -0
    0x28,
    0x63, // unknown enum 99
    0x3a,
    0x07,
    0x0a,
    0x03,
    0xee,
    0x80,
    0x80,
    0x10,
    0x02, // U+E000 => 1
    0x3a,
    0x08,
    0x0a,
    0x04,
    0xf0,
    0x90,
    0x80,
    0x80,
    0x10,
    0x04, // U+10000 => 2
    0x5d,
    0x00,
    0x00,
    0xc0,
    0x3f, // float 1.5
  ];
  const second = [0x08, 0x06, 0x18, 0x01, 0x21];
  const score = new Uint8Array(8);
  new DataView(score.buffer).setFloat64(0, -12.25, true);
  second.push(...score, 0x28, 0x01, 0x5d, 0x00, 0x00, 0x00, 0x80); // float -0
  const third = [0x08, 0x09, 0x18, 0x01, 0x21];
  const nonDyadicDouble = new Uint8Array(8);
  new DataView(nonDyadicDouble.buffer).setFloat64(0, 0.1, true);
  const nonDyadicFloat = new Uint8Array(4);
  new DataView(nonDyadicFloat.buffer).setFloat32(0, 0.1, true);
  third.push(...nonDyadicDouble, 0x28, 0x01, 0x5d, ...nonDyadicFloat);
  const messages = [new Uint8Array(first), new Uint8Array(second), new Uint8Array(third)];
  while (messages.length < 10_000) messages.push(new Uint8Array());
  const fixture = frame(messages);
  const js = runJavaScript(fixture);
  const wasm = await runWasm(
    fixture,
    await Deno.readFile(`${DIR}serialization-protobuf-gateway.wasm`),
  );
  const expected =
    '[{"id":"3","name":"\\"\\\\\\n","active":true,"score":-0,"status":99,"metrics":{"":"1","𐀀":"2"},"ratio":1.5},{"id":"6","active":true,"score":-12.25,"status":"ACTIVE","ratio":-0},{"id":"9","active":true,"score":0.1000000000000000055511151231257827021181583404541015625,"status":"ACTIVE","ratio":0.100000001490116119384765625}]';
  assertEquals(js.text, expected);
  assertEquals(wasm.text, expected);
});

Deno.test("base protobuf generated corpus retains every adversarial serializer case", () => {
  const js = runJavaScript(generateFixture());
  assert(js.text.includes('"status":99'));
  assert(js.text.includes('"score":-0'));
  assert(js.text.includes('"ratio":-0'));
  assert(js.text.includes('"score":26.5'));
  assert(js.text.includes('"ratio":'));
  assert(js.text.includes('"metrics":{"alpha":"'));
  assert(js.text.includes(""));
  assert(js.text.includes("𐀀"));
  assert(js.text.includes('\\"'));
  assert(js.text.includes("\\\\"));
  assert(js.text.includes("\\n"));
});

Deno.test("base protobuf malformed lengths varints UTF8 and unsupported groups fail closed", async () => {
  throws(() => decodeMessage(new Uint8Array([0x12, 0x02, 0x61])));
  throws(() => decodeMessage(new Uint8Array([0x08, ...new Array(10).fill(0x80)])));
  throws(() => decodeMessage(new Uint8Array([0x12, 0x01, 0xff])));
  throws(() => decodeMessage(new Uint8Array([0x0b, 0x0c])));
  const fixture = generateFixture();
  const marker = new TextEncoder().encode("café-1");
  let at = -1;
  outer: for (let i = 0; i <= fixture.length - marker.length; i++) {
    for (let j = 0; j < marker.length; j++) if (fixture[i + j] !== marker[j]) continue outer;
    at = i;
    break;
  }
  assert(at > 0);
  const corrupt = fixture.slice();
  corrupt[at + 3] = 0xff;
  throws(() => runJavaScript(corrupt));
  const wasmBytes = await Deno.readFile(`${DIR}serialization-protobuf-gateway.wasm`);
  await assertRejects(() => runWasm(corrupt, wasmBytes), "Wasm protobuf error");
});

Deno.test("base protobuf artifacts reproduce byte-identically with pinned Deno and Clang", async () => {
  const before = new Map();
  for (
    const name of [
      "serialization-protobuf-gateway.wasm",
      "fixture-manifest.json",
      "output-manifest.json",
      "build-manifest.json",
    ]
  ) before.set(name, await Deno.readFile(`${DIR}${name}`));
  const run = await new Deno.Command(Deno.execPath(), {
    args: [
      "run",
      "--allow-read=.",
      "--allow-write=public/artifacts/serialization-protobuf-gateway",
      "--allow-run=clang",
      "scripts/build-base-protobuf.ts",
    ],
    stdout: "piped",
    stderr: "piped",
  }).output();
  assert(run.success, new TextDecoder().decode(run.stderr));
  for (const [name, bytes] of before) assertEquals(await Deno.readFile(`${DIR}${name}`), bytes);
  const manifest = JSON.parse(await Deno.readTextFile(`${DIR}build-manifest.json`));
  assertEquals(manifest.build.toolchains, ["Deno 2.9.0", "Clang 22.1.8", "LLD 22.1.8"]);
  for (const source of manifest.sources) {
    assertEquals(await sha256Hex(await Deno.readFile(source.path)), source.sha256);
  }
  assertEquals(
    await sha256Hex(await Deno.readFile(manifest.variants["wasm-linear-controlled"].artifact)),
    manifest.variants["wasm-linear-controlled"].artifactSha256,
  );
});

Deno.test("base protobuf public routes are closed and correctly typed", async () => {
  const handler = createHandler(null, "public");
  const paths = [
    "/benchmarks/serialization-protobuf-gateway/",
    "/benchmarks/serialization-protobuf-gateway/protobuf-runner.js",
    "/benchmarks/serialization-protobuf-gateway/protobuf-worker.js",
    "/benchmarks/base/serialization-protobuf-gateway/workload.js",
    "/benchmarks/base/serialization-protobuf-gateway/implementation-contract.v1.json",
    "/artifacts/serialization-protobuf-gateway/serialization-protobuf-gateway.wasm",
    "/artifacts/serialization-protobuf-gateway/fixture-manifest.json",
    "/artifacts/serialization-protobuf-gateway/output-manifest.json",
    "/artifacts/serialization-protobuf-gateway/build-manifest.json",
  ];
  for (const path of paths) {
    assertEquals((await handler(new Request(`http://local${path}`))).status, 200);
  }
  const wasm = await handler(
    new Request(
      "http://local/artifacts/serialization-protobuf-gateway/serialization-protobuf-gateway.wasm",
    ),
  );
  assertEquals(wasm.headers.get("content-type"), "application/wasm");
  assertEquals(
    (await handler(new Request("http://local/artifacts/serialization-protobuf-gateway/private")))
      .status,
    404,
  );
  assertEquals(
    (await handler(
      new Request("http://local/benchmarks/serialization-protobuf-gateway/", { method: "POST" }),
    )).status,
    403,
  );
});

Deno.test("base protobuf demo lifecycle is bounded and exact mode hashes raw served bytes", async () => {
  const runner = await Deno.readTextFile(
    "public/benchmarks/serialization-protobuf-gateway/protobuf-runner.js",
  );
  const worker = await Deno.readTextFile(
    "public/benchmarks/serialization-protobuf-gateway/protobuf-worker.js",
  );
  for (
    const text of [
      "new Worker",
      "worker.terminate()",
      "setTimeout",
      "120000",
      "data.token !== runToken",
      "pagehide",
    ]
  ) assert(runner.includes(text), text);
  for (
    const text of [
      "arrayBuffer()",
      "sha256Hex(bytes)",
      "fixture hash mismatch",
      "build relationship mismatch",
      "complete cross-target output mismatch",
      "output oracle mismatch",
    ]
  ) assert(worker.includes(text), text);
  assert(!runner.includes("localStorage"));
  assert(!worker.includes("indexedDB"));
  assert(!worker.includes("performance.now"));
  const lastExactOnlyBranch = worker.lastIndexOf('if (mode === "exact")');
  const digest = worker.indexOf("const digest = await sha256Hex(selected.bytes)");
  const oracle = worker.indexOf('EXPECTED["output-manifest.json"]', digest);
  const completion = worker.indexOf("self.postMessage", oracle);
  assert(lastExactOnlyBranch < digest, "output oracle must not be exact-mode-only");
  assert(digest < oracle && oracle < completion, "oracle must gate every successful completion");
});
