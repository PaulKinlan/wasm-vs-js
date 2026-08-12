import { assertEquals } from "./assert.ts";
import { runJavaScript } from "../benchmarks/base/ml-keyword-spotting/engine.js";
import { KERNEL_ADAPTERS } from "../public/multilang-runner.js";

const manifest = JSON.parse(
  Deno.readTextFileSync("./public/benchmarks/multilang-wasm/ml-keyword-spotting-v1.manifest.json"),
);

Deno.test("ml.keyword-spotting multilang - JS sanity", () => {
  const bytes = Deno.readFileSync("./public/artifacts/base-ml-keyword-spotting/fixture.pcm16le");
  const pcm = new Int16Array(bytes.buffer, bytes.byteOffset, bytes.byteLength / 2);
  const result = runJavaScript(pcm);
  assertEquals(result.counters.hops, 3000);
});

for (const engine of manifest.engines) {
  if (engine.key === "js") continue;

  Deno.test(`ml.keyword-spotting multilang - ${engine.key} kernel`, async () => {
    const wasmFile = `./public/artifacts/multilang-wasm-benchmark/${engine.files.kws_run}`;
    const bytes = Deno.readFileSync(wasmFile);
    const mod = new WebAssembly.Module(bytes);
    const inst = new WebAssembly.Instance(mod, { env: { abort: () => {} } });

    const adapter = KERNEL_ADAPTERS["ml.keyword-spotting.v1"];
    const mods = {
      engines: {
        [engine.key]: {
          instances: { kws_run: { instance: inst } },
        },
      },
    } as unknown as Parameters<typeof adapter.build>[0];

    const globalFetch = globalThis.fetch;
    globalThis.fetch = (url: string | URL | Request) => {
      const path = url.toString().replace(/^\//, "./public/");
      const data = Deno.readFileSync(path);
      return Promise.resolve(new Response(data));
    };

    try {
      const callables = await adapter.build(mods) as unknown as {
        [key: string]: { kws_run: () => Promise<void> };
      };
      await callables[engine.key].kws_run();
    } finally {
      globalThis.fetch = globalFetch;
    }
  });
}
