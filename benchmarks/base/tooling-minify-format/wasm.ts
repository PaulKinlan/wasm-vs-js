import { type Language, LANGUAGE_CODE, type Operation, OPERATION_CODE } from "./contract.ts";
import type { TransformResult } from "./engine.ts";

type Exports = {
  memory: WebAssembly.Memory;
  transform(
    inPtr: number,
    length: number,
    tmpPtr: number,
    outPtr: number,
    capacity: number,
    language: number,
    operation: number,
  ): number;
  tokens(): number;
  nodes(): number;
  transforms(): number;
};
const INPUT = 2 * 1024 * 1024,
  TEMP = 8 * 1024 * 1024,
  OUTPUT = 16 * 1024 * 1024,
  CAPACITY = 8 * 1024 * 1024;
export async function instantiateToolingWasm(
  bytes: Uint8Array,
): Promise<(input: Uint8Array, language: Language, operation: Operation) => TransformResult> {
  const ownedBytes = Uint8Array.from(bytes);
  const instance = await WebAssembly.instantiate(await WebAssembly.compile(ownedBytes), {});
  const exp = instance.exports as unknown as Exports;
  return (input, language, operation) => {
    if (input.byteLength > CAPACITY) throw new Error("input exceeds fixed Wasm capacity");
    new Uint8Array(exp.memory.buffer, INPUT, input.byteLength).set(input);
    const length = exp.transform(
      INPUT,
      input.byteLength,
      TEMP,
      OUTPUT,
      CAPACITY,
      LANGUAGE_CODE[language],
      OPERATION_CODE[operation],
    );
    if (length < 0) throw new Error(`Wasm parser rejected input (${length})`);
    const output = new Uint8Array(length);
    output.set(new Uint8Array(exp.memory.buffer, OUTPUT, length));
    return {
      output,
      counters: {
        inputBytes: input.byteLength,
        outputBytes: length,
        tokens: exp.tokens(),
        nodes: exp.nodes(),
        transforms: exp.transforms(),
        allocations: 0,
        boundaryCrossings: 1,
      },
    };
  };
}
