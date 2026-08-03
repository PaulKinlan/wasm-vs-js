import {
  generateFixture,
  runJavaScript,
  runWasm,
  sha256Hex,
} from "/benchmarks/base/serialization-protobuf-gateway/workload.js";
const ROOT = "/artifacts/serialization-protobuf-gateway/";
const EXPECTED = {
  "fixture-manifest.json": "1c0f312f924ded923d39e67eddb477440210fa2b3e939598a8854fd3ff66fe0f",
  "output-manifest.json": "a57ac8b49aec3029761d6750fd713f209dfc049c0c1452f09aa6c385a95f56bf",
  "build-manifest.json": "ff73ccc67058a44dd273a487c3aabbd4aa378c4fd10778a668c7bd22942c50c9",
  "serialization-protobuf-gateway.wasm":
    "d0c64f5bdd783ecfe0f7fe7ff8e87d6118d6736bf807b4db2791e3ff2cea2724",
  "implementation-contract.v1.json":
    "705729301e84f4aefb0f9f76081c7f20e15ecbb291fe58f7da6d72b646e44cfc",
  "workload.js": "1d5908d35c5fed190bc7a6f2489c9adf1f6342f6b9c42b408a222a1c2c87d95b",
};
async function exactFetch(path, expected) {
  const response = await fetch(path, { cache: "no-store" });
  if (!response.ok) throw new Error(`${path} HTTP ${response.status}`);
  const bytes = new Uint8Array(await response.arrayBuffer());
  const hash = await sha256Hex(bytes);
  if (hash !== expected) throw new Error(`${path} hash mismatch`);
  return bytes;
}
self.onmessage = async ({ data }) => {
  const { token, target, mode } = data;
  try {
    const fixture = generateFixture();
    const wasmBytes = await exactFetch(
      `${ROOT}serialization-protobuf-gateway.wasm`,
      EXPECTED["serialization-protobuf-gateway.wasm"],
    );
    let exact = null;
    if (mode === "exact") {
      const records = {};
      for (const name of ["fixture-manifest.json", "output-manifest.json", "build-manifest.json"]) {
        const bytes = await exactFetch(`${ROOT}${name}`, EXPECTED[name]);
        records[name] = JSON.parse(new TextDecoder().decode(bytes));
      }
      await exactFetch(
        "/benchmarks/base/serialization-protobuf-gateway/implementation-contract.v1.json",
        EXPECTED["implementation-contract.v1.json"],
      );
      await exactFetch(
        "/benchmarks/base/serialization-protobuf-gateway/workload.js",
        EXPECTED["workload.js"],
      );
      if (await sha256Hex(fixture) !== records["fixture-manifest.json"].sha256) {
        throw new Error("fixture hash mismatch");
      }
      if (
        records["build-manifest.json"].variants["wasm-linear-controlled"].artifactSha256 !==
          EXPECTED["serialization-protobuf-gateway.wasm"]
      ) throw new Error("build relationship mismatch");
      exact = {
        verifiedRawBytes: Object.keys(EXPECTED).length,
        catalogSha256: records["build-manifest.json"].catalogV1.sha256,
      };
    }
    const js = target !== "wasm" ? runJavaScript(fixture) : null;
    const wasm = target !== "javascript" ? await runWasm(fixture, wasmBytes) : null;
    if (js && wasm && js.text !== wasm.text) {
      throw new Error("complete cross-target output mismatch");
    }
    const selected = js ?? wasm;
    const digest = await sha256Hex(selected.bytes);
    // Every advertised mode is a correctness mode. Never report completion
    // unless the complete output matches the immutable output oracle.
    const outputBytes = await exactFetch(
      `${ROOT}output-manifest.json`,
      EXPECTED["output-manifest.json"],
    );
    if (JSON.parse(new TextDecoder().decode(outputBytes)).sha256 !== digest) {
      throw new Error("output oracle mismatch");
    }
    self.postMessage({
      token,
      type: "complete",
      result: {
        target,
        mode,
        digest,
        outputBytes: selected.bytes.length,
        counters: { javascript: js?.counters ?? null, wasm: wasm?.counters ?? null },
        exact,
      },
    });
  } catch (error) {
    self.postMessage({
      token,
      type: "error",
      message: error instanceof Error ? error.message : String(error),
    });
  }
};
