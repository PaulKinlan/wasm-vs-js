// @ts-expect-error Browser absolute route is served from the repository source allowlist.
import { compileC } from "/benchmarks/base/tooling-c-to-wasm-compile/compiler-js.js";

const decoder = new TextDecoder("utf-8", { fatal: true });
async function hash(bytes) {
  const digest = new Uint8Array(await crypto.subtle.digest("SHA-256", bytes));
  return [...digest].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}
async function bytes(path) {
  const response = await fetch(path, { cache: "no-store" });
  if (!response.ok) throw new Error(`${path} returned ${response.status}`);
  return new Uint8Array(await response.arrayBuffer());
}
self.onmessage = async ({ data }) => {
  const { token, target, program } = data;
  try {
    if (!/^(?:javascript|wasm)$/.test(target) || !/^\d{2}$/.test(program)) {
      throw new Error("closed demo selection denied");
    }
    const [sourceBytes, headerBytes, fixtureResponse, buildResponse, validationResponse] =
      await Promise.all([
        bytes(`/benchmarks/base/tooling-c-to-wasm-compile/fixtures/programs/${program}.c`),
        bytes(`/benchmarks/base/tooling-c-to-wasm-compile/fixtures/headers/${program}.h`),
        fetch("/artifacts/base/tooling-c-to-wasm-compile/fixture-manifest.json", {
          cache: "no-store",
        }),
        fetch("/artifacts/base/tooling-c-to-wasm-compile/build-manifest.json", {
          cache: "no-store",
        }),
        fetch("/evidence/base/tooling-c-to-wasm-compile/validation.json", { cache: "no-store" }),
      ]);
    if (!fixtureResponse.ok || !buildResponse.ok || !validationResponse.ok) {
      throw new Error("manifest fetch failed");
    }
    const fixtureManifest = await fixtureResponse.json();
    const buildManifest = await buildResponse.json();
    const validation = await validationResponse.json();
    const fixture = fixtureManifest.entries.find((entry) => entry.id === program);
    const recorded = validation.results.find((entry) => entry.id === program);
    if (!fixture || !recorded) throw new Error("program absent from frozen manifests");
    if (
      await hash(sourceBytes) !== fixture.source.sha256 ||
      await hash(headerBytes) !== fixture.header.sha256
    ) throw new Error("fixture byte hash mismatch");
    const source = decoder.decode(sourceBytes);
    const header = decoder.decode(headerBytes);
    let output;
    let counters;
    if (target === "javascript") {
      const compiled = compileC(source, header);
      output = compiled.bytes;
      counters = compiled.counters;
    } else {
      const compilerBytes = await bytes("/artifacts/base/tooling-c-to-wasm-compile/compiler.wasm");
      if (await hash(compilerBytes) !== buildManifest.artifact.sha256) {
        throw new Error("compiler artifact hash mismatch");
      }
      const instance = await WebAssembly.instantiate(compilerBytes, {});
      const exports = instance.instance.exports;
      const memory = exports.memory;
      const view = new Uint8Array(memory.buffer);
      view.set(sourceBytes, 196608);
      view.set(headerBytes, 200704);
      const length = Number(
        exports.compile_c(
          196608,
          sourceBytes.byteLength,
          200704,
          headerBytes.byteLength,
          131072,
          4096,
        ),
      );
      if (length <= 0) throw new Error(`self-hosted compiler rejected source: ${length}`);
      output = view.slice(131072, 131072 + length);
      counters = {
        sourceBytes: sourceBytes.byteLength,
        headerBytes: headerBytes.byteLength,
        tokens: Number(exports.counter_tokens()),
        astNodes: Number(exports.counter_ast_nodes()),
        functions: 1,
        instructions: Number(exports.counter_instructions()),
        linkSections: 4,
        vfsReads: 2,
        allocations: 0,
        boundaryCrossings: 2,
        outputBytes: length,
      };
    }
    const outputSha256 = await hash(output);
    if (outputSha256 !== recorded.outputSha256) throw new Error("compiled module hash mismatch");
    const module = await WebAssembly.compile(output);
    const instance = await WebAssembly.instantiate(module, {});
    const testResult = Number(instance.exports.test());
    if (testResult !== fixture.expectedTestResult) throw new Error("exported test oracle mismatch");
    self.postMessage({
      token,
      type: "complete",
      result: {
        target,
        program,
        outputSha256,
        outputBytes: output.byteLength,
        testResult,
        counters,
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
