import { generateInput } from "../benchmarks/sum-u32/input.ts";
import { sumU32 } from "../benchmarks/sum-u32/js.ts";
import { sha256Hex } from "../lib/canonical.ts";
import { assertOracle, ORACLE_SUM, prepareWasm, workCounters } from "../lib/workload.ts";
import { assertEquals } from "./assert.ts";

Deno.test("deterministic input and exact JavaScript oracle", async () => {
  const input = generateInput();
  assertEquals(input.byteLength, 262_144);
  assertEquals(
    await sha256Hex(new Uint8Array(input.buffer)),
    "4f0516549fc9d6952c8d42d642927dd5c43a8c01d03c286e0c80da919bfaf9d7",
  );
  assertEquals(sumU32(input), ORACLE_SUM);
  assertOracle(sumU32(input));
});

Deno.test("linear Wasm and JavaScript perform equivalent fixed work and output", async () => {
  const wasm = await Deno.readFile("public/artifacts/sum-u32/sum-u32.wasm");
  const instance = await WebAssembly.instantiate(wasm);
  const wasmRun = prepareWasm(
    instance.instance.exports as unknown as Parameters<typeof prepareWasm>[0],
  );
  assertEquals(wasmRun(), sumU32(generateInput()));
  assertEquals(wasmRun(), ORACLE_SUM);
  assertEquals(workCounters(2), {
    items: 131_072,
    "input-bytes": 524_288,
    additions: 131_072,
    loads: 131_072,
    "boundary-crossings": 2,
  });
});
