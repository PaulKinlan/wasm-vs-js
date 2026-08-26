// text.markdown-cms.v1 and server.ssr-template.v1 had AssemblyScript sources
// and built artifacts, but neither manifest listed "asc" — so the engine that
// existed on disk was never compared on the page. Both adapters enumerate
// Object.keys(mods.engines), so the manifest was the only thing holding them
// out.
//
// Adding an engine to a manifest is a claim that it computes the same thing.
// This runs both kernels against the same frozen oracles their adapters check
// at run time, so the claim is verified here rather than only in a browser.

import { assert } from "./assert.ts";

const ROOT = new URL("../", import.meta.url).pathname;
const ARTIFACTS = `${ROOT}public/artifacts/multilang-wasm-benchmark/`;

interface Case {
  slug: string;
  entry: string;
  fixture: string;
  fixtureOffset: number;
  resultOffset: number;
  /** Result words in the order the adapter reads them, digest last. */
  oracle: number[];
  engines: string[];
}

const CASES: Case[] = [
  {
    slug: "text-markdown-cms",
    entry: "markdown_cms_render",
    fixture: "text-markdown-cms-multilang/fixture.bin",
    fixtureOffset: 3145728,
    resultOffset: 28311552,
    oracle: [500, 10_976_060, 2997, 5996, 1001, 1000, 11_057_325, 499, 0xe5a7f519],
    engines: ["markdown_cms_kernel_c.wasm", "markdown_cms_kernel_asc.wasm"],
  },
  {
    slug: "server-ssr-template-v1",
    entry: "ssr_render",
    fixture: "server-ssr-template-v1-multilang/fixture.bin",
    fixtureOffset: 3145728,
    resultOffset: 3932160,
    oracle: [1000, 7000, 23000, 2000, 1000, 2000, 4000, 2000, 91442, 426192, 0x7c5fa247],
    engines: ["server_ssr_kernel_c.wasm", "server_ssr_kernel_asc.wasm"],
  },
];

async function runKernel(file: string, testCase: Case): Promise<number[]> {
  const fixture = await Deno.readFile(`${ROOT}public/artifacts/${testCase.fixture}`);
  const { instance } = await WebAssembly.instantiate(
    await Deno.readFile(ARTIFACTS + file),
    {
      env: {
        abort: () => {
          throw new Error(`${file}: abort()`);
        },
      },
    },
  );
  const exports = instance.exports as Record<string, CallableFunction> & {
    memory: WebAssembly.Memory;
  };
  const need = Math.max(
    testCase.resultOffset + testCase.oracle.length * 4,
    testCase.fixtureOffset + fixture.byteLength,
  );
  if (exports.memory.buffer.byteLength < need) {
    exports.memory.grow(
      Math.ceil((need - exports.memory.buffer.byteLength) / 65536),
    );
  }
  new Uint8Array(exports.memory.buffer).set(fixture, testCase.fixtureOffset);
  const status = Number(exports[testCase.entry](fixture.byteLength));
  assert(status === 0, `${file}: ${testCase.entry}() returned ${status}, not 0`);
  const words = new Uint32Array(exports.memory.buffer);
  return testCase.oracle.map((_, i) => words[testCase.resultOffset / 4 + i] >>> 0);
}

for (const testCase of CASES) {
  Deno.test(`${testCase.slug}: every manifest engine matches the frozen oracle`, async () => {
    const manifest = JSON.parse(
      await Deno.readTextFile(
        `${ROOT}public/benchmarks/multilang-wasm/${testCase.slug}.manifest.json`,
      ),
    ) as { engines: Array<{ key: string }> };
    const keys = manifest.engines.map((e) => e.key);
    assert(
      keys.includes("asc"),
      `${testCase.slug} must declare the AssemblyScript engine it ships an artifact for`,
    );

    for (const file of testCase.engines) {
      const got = await runKernel(file, testCase);
      assert(
        got.length === testCase.oracle.length &&
          got.every((v, i) => v === testCase.oracle[i]),
        `${file} disagrees with the frozen oracle:\n  got  ${JSON.stringify(got)}` +
          `\n  want ${JSON.stringify(testCase.oracle)}`,
      );
    }
  });
}
