import Ajv2020Module from "ajv2020";
import { assert, assertEquals } from "./assert.ts";

type Validate = ((value: unknown) => boolean) & { errors?: unknown };
type AjvInstance = { compile(schema: unknown): Validate };
type AjvConstructor = new (options?: Record<string, unknown>) => AjvInstance;
const Ajv2020 = ((Ajv2020Module as unknown as { default?: AjvConstructor }).default ??
  Ajv2020Module) as unknown as AjvConstructor;
import { runProtocolTrace } from "../benchmarks/v1/network-http2-quic-state/engine.js";
import {
  makeMalformedTraces,
  makeProtocolTrace,
} from "../benchmarks/v1/network-http2-quic-state/fixture.js";
import { createHandler } from "../server.ts";

const artifactPath = "public/artifacts/network-http2-quic-state/network-http2-quic-state.wasm";

async function sha256(bytes: Uint8Array) {
  return Array.from(new Uint8Array(await crypto.subtle.digest("SHA-256", bytes.slice().buffer)))
    .map((value) => value.toString(16).padStart(2, "0")).join("");
}

async function wasmRun(input: Uint8Array) {
  const { instance } = await WebAssembly.instantiate(await Deno.readFile(artifactPath));
  const memory = instance.exports.memory as WebAssembly.Memory;
  const runTrace = instance.exports.run_trace as (
    input: number,
    length: number,
    output: number,
  ) => number;
  new Uint8Array(memory.buffer, 0, input.length).set(input);
  runTrace(0, input.length, 200000);
  return new Uint32Array(memory.buffer, 200000, 64).slice();
}

Deno.test("network base trace exercises HTTP/2, HPACK, QUIC and QPACK state", () => {
  const state = runProtocolTrace(makeProtocolTrace());
  assertEquals(state[0], 1);
  assertEquals(state[1], 6);
  assertEquals(state[3], 6);
  assertEquals(state[4], 1);
  assertEquals(state[5], 1);
  assertEquals(state[6], 1);
  assertEquals(state[7], 1);
  assertEquals(state[8], 1);
  assertEquals(state[9], 1);
  assertEquals(state[10], 1);
  assertEquals(state[11], 1);
  assertEquals(state[12], 1);
  assertEquals(state[13], 40);
  assertEquals(state[16], 7);
  assertEquals(state[17], 1024);
  assertEquals(state[18], 6);
  assertEquals(state[19], 2);
  assertEquals(state[20], 1);
  assertEquals(state[21], 1);
  assertEquals(state[22], 1);
  assertEquals(state[23], 1);
  assertEquals(state[24], 64);
  assertEquals(state[25], 1);
  assertEquals(state[26], 1);
  assertEquals(state[27], 82);
  assertEquals(state[28], 19);
  assertEquals(state[29], 1000);
  assertEquals(state[30], 18);
  assertEquals(state[31], 0);
});

Deno.test("controlled JavaScript and material Wasm match every state/event word", async () => {
  const input = makeProtocolTrace();
  const js = runProtocolTrace(input);
  const wasm = await wasmRun(input);
  assertEquals(Array.from(wasm), Array.from(js));
  const expected = new Uint32Array(
    (await Deno.readFile("public/artifacts/network-http2-quic-state/expected-state.u32le")).buffer,
  );
  assertEquals(Array.from(wasm), Array.from(expected));
});

Deno.test("malformed and truncated traces reject identically without trapping", async () => {
  for (const input of makeMalformedTraces()) {
    const js = runProtocolTrace(input);
    const wasm = await wasmRun(input);
    assert(js[31] > 0);
    assertEquals(Array.from(wasm), Array.from(js));
  }
});

Deno.test("supplemental registration satisfies its closed schema without mutating v1", async () => {
  const registration = JSON.parse(
    await Deno.readTextFile("registrations/base-v1/network.http2-quic-state.v1.json"),
  );
  const schema = JSON.parse(
    await Deno.readTextFile("schemas/network-http2-quic-state-registration.schema.json"),
  );
  const validate = new Ajv2020({ strict: true }).compile(schema);
  assert(validate(registration), JSON.stringify(validate.errors));
  const widened = { ...registration, accepted: true };
  assertEquals(validate(widened), false);
});

Deno.test("fixture generation and build provenance are exact and catalog bytes stay frozen", async () => {
  const fixture = makeProtocolTrace();
  assertEquals(fixture, await Deno.readFile("public/artifacts/network-http2-quic-state/trace.bin"));
  const manifest = JSON.parse(
    await Deno.readTextFile("public/artifacts/network-http2-quic-state/build-manifest.json"),
  );
  assertEquals(manifest.toolchain.deno, "2.9.0");
  assertEquals(manifest.toolchain.clang, "22.1.8");
  assertEquals(
    manifest.catalogAnchor.sha256,
    "6665664f984683e5b7d3fdc8c1602198124844704c224a526d48be2f02edf9d4",
  );
  assertEquals(
    await sha256(await Deno.readFile("catalog/workloads.v1.json")),
    manifest.catalogAnchor.sha256,
  );
  for (const item of [...manifest.sources, ...manifest.artifacts]) {
    assertEquals(await sha256(await Deno.readFile(item.path)), item.sha256);
  }
  const registration = JSON.parse(
    await Deno.readTextFile("registrations/base-v1/network.http2-quic-state.v1.json"),
  );
  assertEquals(registration.countsTowardAcceptedCoverage, false);
  assertEquals(registration.fixture.rfcExampleBytesUsed, false);
  assertEquals(registration.scope.http2FrameTypes.length, 6);
  assertEquals(registration.scope.quicFrameTypes.length, 5);
});

Deno.test("Deno 2.9 and Clang 22 rebuild every network artifact byte-identically", async () => {
  assertEquals(Deno.version.deno, "2.9.0");
  const paths = [
    artifactPath,
    "public/artifacts/network-http2-quic-state/trace.bin",
    "public/artifacts/network-http2-quic-state/expected-state.u32le",
    "public/artifacts/network-http2-quic-state/build-manifest.json",
  ];
  const before = await Promise.all(paths.map(async (path) => sha256(await Deno.readFile(path))));
  const output = await new Deno.Command(Deno.execPath(), {
    args: [
      "run",
      "--allow-read=.",
      "--allow-write=public/artifacts/network-http2-quic-state",
      "--allow-run=clang",
      "scripts/build-network-http2-quic-state.ts",
    ],
  }).output();
  assert(output.success, new TextDecoder().decode(output.stderr));
  const after = await Promise.all(paths.map(async (path) => sha256(await Deno.readFile(path))));
  assertEquals(after, before);
});

Deno.test("public handler exposes only the declared demo and artifact routes", async () => {
  const handler = createHandler(null, "public");
  for (
    const path of [
      "/benchmarks/base/network-http2-quic-state/",
      "/network-http2-quic-state-demo.js",
      "/network-http2-quic-state-worker.js",
      "/benchmarks/v1/network-http2-quic-state/engine.js",
      "/benchmarks/v1/network-http2-quic-state/fixture.js",
      "/artifacts/network-http2-quic-state/network-http2-quic-state.wasm",
      "/artifacts/network-http2-quic-state/trace.bin",
      "/artifacts/network-http2-quic-state/expected-state.u32le",
      "/artifacts/network-http2-quic-state/build-manifest.json",
      "/evidence/base-v1/network-http2-quic-state/javascript-controlled.json",
      "/evidence/base-v1/network-http2-quic-state/linear-wasm-controlled.json",
    ]
  ) {
    assertEquals((await handler(new Request(`http://127.0.0.1${path}`))).status, 200);
  }
  assertEquals(
    (await handler(new Request("http://127.0.0.1/artifacts/network-http2-quic-state/private")))
      .status,
    404,
  );
});

Deno.test("demo lifecycle owns worker cancellation, timeout, stale token and pagehide", async () => {
  const source = await Deno.readTextFile("public/network-http2-quic-state-demo.js");
  for (
    const required of [
      "worker.terminate()",
      "runToken !== token",
      "setTimeout",
      "pagehide",
      "aria-live",
    ]
  ) {
    if (required === "aria-live") {
      const page = await Deno.readTextFile("public/benchmarks/base/network-http2-quic-state/index.html");
      assert(page.includes(required));
    } else assert(source.includes(required));
  }
});
