import { generateFixture, instantiateToolingWasm, transformJs } from "./engine.js";
async function hash(bytes) {
  return Array.from(
    new Uint8Array(await crypto.subtle.digest("SHA-256", bytes)),
    (b) => b.toString(16).padStart(2, "0"),
  ).join("");
}
self.onmessage = async ({ data }) => {
  const { token, target, language, operation, mode } = data;
  try {
    const input = generateFixture(language);
    const buildResponse = await fetch("/artifacts/base-tooling-minify-format/build-manifest.json", {
      cache: "no-store",
    });
    const buildBytes = new Uint8Array(await buildResponse.arrayBuffer());
    const build = JSON.parse(new TextDecoder().decode(buildBytes));
    const fixtureResponse = await fetch(
      "/artifacts/base-tooling-minify-format/fixture-manifest.json",
      { cache: "no-store" },
    );
    const fixtureBytes = new Uint8Array(await fixtureResponse.arrayBuffer());
    const fixture = JSON.parse(new TextDecoder().decode(fixtureBytes));
    const expectedInput = fixture.fixtures.find((x) => x.language === language);
    if (!expectedInput || await hash(input) !== expectedInput.sha256) {
      throw new Error("fixture hash mismatch");
    }
    let result;
    if (target === "javascript-controlled") result = transformJs(input, language, operation);
    else {
      const wasmResponse = await fetch(
        "/artifacts/base-tooling-minify-format/tooling-minify-format.wasm",
        { cache: "no-store" },
      );
      const wasmBytes = new Uint8Array(await wasmResponse.arrayBuffer());
      if (await hash(wasmBytes) !== build.artifact.sha256) {
        throw new Error("Wasm artifact hash mismatch");
      }
      result = (await instantiateToolingWasm(wasmBytes))(input, language, operation);
    }
    const outputHash = await hash(result.output);
    const expected = build.outputs.find((x) =>
      x.language === language && x.operation === operation
    );
    if (
      !expected || outputHash !== expected.sha256 || result.output.byteLength !== expected.bytes
    ) throw new Error("canonical output mismatch");
    if (mode === "exact") {
      if (await hash(fixtureBytes) !== build.fixtureManifest.sha256) {
        throw new Error("fixture manifest byte hash mismatch");
      }
      if (
        build.catalogV1Sha256 !== "6665664f984683e5b7d3fdc8c1602198124844704c224a526d48be2f02edf9d4"
      ) throw new Error("frozen catalog identity mismatch");
    }
    self.postMessage({
      token,
      ok: true,
      target,
      language,
      operation,
      mode,
      inputHash: expectedInput.sha256,
      outputHash,
      counters: result.counters,
      buildManifestHash: mode === "exact" ? await hash(buildBytes) : "not-collected",
    });
  } catch (error) {
    self.postMessage({
      token,
      ok: false,
      error: error instanceof Error ? error.message : String(error),
    });
  }
};
