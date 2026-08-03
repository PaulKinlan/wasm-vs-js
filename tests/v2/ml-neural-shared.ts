import Ajv2020Module from "ajv2020";
import addFormatsModule from "ajv-formats";
export { assert, assertEquals } from "../assert.ts";
export {
  assertRepetitions,
  boundCheck,
  checkFiniteAndZero,
  digestOf,
  emptyPhaseTimings,
  GemmJsRunner,
  gemmReference,
  gemmStructuralChecks,
  GemmWasmRunner,
  gemmWorkCounters,
  mlpJsLayerOutputs,
  MlpJsRunner,
  mlpReference,
  mlpStructuralChecks,
  mlpWasmLayerOutputs,
  MlpWasmRunner,
  mlpWorkCounters,
  timedPhase,
} from "../../lib/v2/neural.ts";
export { validateProposalProvenanceSemantics } from "../../benchmarks/v2/shared/provenance-contract.js";
export * as gemm from "../../benchmarks/v2/ml-gemm/workload.js";
export * as mlp from "../../benchmarks/v2/ml-dense-mlp/workload.js";
export {
  frozenExp,
  frozenTanh,
  geluFrozenF64,
} from "../../benchmarks/v2/ml-dense-mlp/frozen-transcendentals.js";
export {
  allocationsCreated,
  resetAllocationCount,
} from "../../benchmarks/v2/shared/allocations.js";
export { verifyManifestEvidence } from "../../lib/v2/manifest-evidence.ts";

export type ValidationError = { instancePath?: string; message?: string };
export type Validator = ((value: unknown) => boolean) & { errors?: ValidationError[] | null };
export type AjvInstance = { compile: (schema: unknown) => Validator };
export type AjvConstructor = new (options?: Record<string, unknown>) => AjvInstance;
export type AddFormats = (ajv: AjvInstance) => void;
export const Ajv2020 = ((Ajv2020Module as unknown as { default?: AjvConstructor }).default ??
  Ajv2020Module) as unknown as AjvConstructor;
export const addFormats = ((addFormatsModule as unknown as { default?: AddFormats }).default ??
  addFormatsModule) as unknown as AddFormats;

export const gemmWasm = await Deno.readFile("artifacts/v2/ml-gemm/ml-gemm.wasm");
export const mlpWasm = await Deno.readFile("artifacts/v2/ml-dense-mlp/ml-dense-mlp.wasm");
export const catalog = JSON.parse(await Deno.readTextFile("catalog/workloads.v2.proposed.json"));

export const gemmFixture = JSON.parse(
  await Deno.readTextFile("artifacts/v2/ml-gemm/fixture-manifest.json"),
);
export const mlpFixture = JSON.parse(
  await Deno.readTextFile("artifacts/v2/ml-dense-mlp/fixture-manifest.json"),
);

export async function instantiate(bytes: Uint8Array) {
  const { instance } = await WebAssembly.instantiate(bytes as Uint8Array<ArrayBuffer>);
  return instance.exports as unknown as {
    memory: WebAssembly.Memory;
    gemm_f32?: (a: number, b: number, c: number, m: number, n: number, k: number) => void;
    linear_f32?: (x: number, w: number, b: number, y: number, batch: number, width: number) => void;
    gelu_f32?: (ptr: number, len: number) => void;
    exp_f64?: (x: number) => number;
    tanh_f64?: (x: number) => number;
  };
}

export async function sha256File(path: string): Promise<string> {
  const bytes = await Deno.readFile(path);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return [...new Uint8Array(digest)].map((value) => value.toString(16).padStart(2, "0")).join("");
}
