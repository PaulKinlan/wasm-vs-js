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

    // loadEngines-shaped mods (the same shape runMultilangComparison passes).
    const mods = {
      engines: {
        [engine.key]: {
          instances: { zip_build: { instance: inst } },
        },
      },
    } as unknown as Parameters<typeof adapter.build>[0];
    const adapter = KERNEL_ADAPTERS["archive.zip-workspace.v1"];
    const callables = await adapter.build(mods) as unknown as {
      [key: string]: { zip_build: () => void };
    };

    // Will throw on verification failure
    callables[engine.key].zip_build();
  });
}
