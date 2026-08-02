import { generateInput, INPUT_LENGTH } from "../benchmarks/sum-u32/input.ts";
import { sumU32 } from "../benchmarks/sum-u32/js.ts";

export const ORACLE_SUM = 145_417_951;
export const INPUT_BYTES = INPUT_LENGTH * Uint32Array.BYTES_PER_ELEMENT;

export type WasmExports = {
  memory: WebAssembly.Memory;
  sum_u32: (pointer: number, length: number) => number;
};

export function workCounters(batchSize = 1): Record<string, number> {
  if (!Number.isSafeInteger(batchSize) || batchSize < 1) throw new Error("invalid batch size");
  return {
    items: INPUT_LENGTH * batchSize,
    "input-bytes": INPUT_BYTES * batchSize,
    additions: INPUT_LENGTH * batchSize,
    loads: INPUT_LENGTH * batchSize,
    "boundary-crossings": batchSize,
  };
}

export function runJavaScript(input = generateInput()): number {
  return sumU32(input);
}

export function prepareWasm(exports: WasmExports, input = generateInput()): () => number {
  if (exports.memory.buffer.byteLength < input.byteLength) throw new Error("Wasm memory too small");
  new Uint32Array(exports.memory.buffer, 0, input.length).set(input);
  return () => exports.sum_u32(0, input.length) >>> 0;
}

export function assertOracle(value: number): void {
  if (value !== ORACLE_SUM) throw new Error(`output mismatch: ${value}`);
}
