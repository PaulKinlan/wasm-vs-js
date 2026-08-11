import { assertEquals } from "./assert.ts";
import {
  BOUNDED_ENTRY_COUNT,
  runJavaScript,
} from "../benchmarks/v1/archive-zip-workspace/engine.js";
import { KERNEL_ADAPTERS } from "../public/multilang-runner.js";

const manifest = JSON.parse(
  Deno.readTextFileSync(
    "./public/benchmarks/multilang-wasm/archive-zip-workspace-v1.manifest.json",
  ),
);

const JS_COUNTERS = [
  "entries",
  "inputBytes",
  "crcBytes",
  "deflateLiterals",
  "deflateMatches",
  "deflateMatchedBytes",
  "deflateEndSymbols",
  "localHeaders",
  "centralHeaders",
  "zip64Records",
  "listedEntries",
  "extractedEntries",
  "extractedBytes",
  "boundaryCrossings",
];

Deno.test("archive.zip-workspace multilang - JS sanity", () => {
  const result = runJavaScript(BOUNDED_ENTRY_COUNT);
  assertEquals(result.counters.entries, 1000);
});

for (const engine of manifest.engines) {
  if (engine.key === "js") continue;

  Deno.test(`archive.zip-workspace multilang - ${engine.key} kernel`, async () => {
    const wasmFile = `./public/artifacts/multilang-wasm-benchmark/${engine.files.zip_build}`;
    const bytes = Deno.readFileSync(wasmFile);
    const mod = new WebAssembly.Module(bytes);
    const inst = new WebAssembly.Instance(mod, { env: { abort: () => {} } });

    const mods = {
      [engine.key]: { exports: inst.exports, memories: { zip_build: inst.exports.memory } },
    };
    const adapter = KERNEL_ADAPTERS["archive.zip-workspace.v1"];
    const callables: any = await adapter.build(mods);

    // Will throw on verification failure
    callables[engine.key].zip_build();
  });
}
