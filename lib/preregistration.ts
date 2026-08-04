import Ajv2020Module from "ajv2020";
import addFormatsModule from "ajv-formats";
import { canonicalize, sha256Hex } from "./canonical.ts";

type ValidationError = { instancePath?: string; message?: string };
type Validator = ((value: unknown) => boolean) & { errors?: ValidationError[] | null };
type AjvInstance = { compile: (schema: unknown) => Validator };
type AjvConstructor = new (options?: Record<string, unknown>) => AjvInstance;
type AddFormats = (ajv: AjvInstance) => void;

const Ajv2020 = ((Ajv2020Module as unknown as { default?: AjvConstructor }).default ??
  Ajv2020Module) as unknown as AjvConstructor;
const addFormats = ((addFormatsModule as unknown as { default?: AddFormats }).default ??
  addFormatsModule) as unknown as AddFormats;
const ajv = new Ajv2020({ allErrors: true, strict: false });
addFormats(ajv);
const schema = JSON.parse(
  await Deno.readTextFile(new URL("../schemas/preregistration.schema.json", import.meta.url)),
);
const validateSchema = ajv.compile(schema);

const EXPECTED = {
  canonicalSha256: "bd61f47f37b8dc2a32d2a6e8fad8dd643e56a12e37d8478f18bb9f12dedaa059",
  benchmarkPath: "../benchmarks/sum-u32/benchmark.json",
  benchmarkSha256: "d5a7c9459e5bbed3a64d521af393d30d572b1034184a249f14265e2a0a99ff0a",
  manifestPath: "../public/artifacts/sum-u32/build-manifest.json",
  manifestSha256: "9e49ef5203dc41c3ed92118a40fe350966851bd309f1cd7c5b571477bb43ecfa",
  javascriptPath: "../benchmarks/sum-u32/workload.js",
  javascriptSha256: "4d8379672c1b51b0b315d2bee119880694e5a4f6412ef59b7fe2593ef6b179b7",
  wasmPath: "../public/artifacts/sum-u32/sum-u32.wasm",
  wasmSha256: "9c4ce5f0d9e32cdd364b73b2697566e7396368d9867d9bc3d939bb2063583a6d",
} as const;

function errorsFor(validator: Validator): string[] {
  return (validator.errors ?? []).map((error) => `${error.instancePath || "/"} ${error.message}`);
}

async function checkedFileHash(relativePath: string): Promise<string> {
  return await sha256Hex(await Deno.readFile(new URL(relativePath, import.meta.url)));
}

export async function validatePreregistration(
  value: unknown,
): Promise<{ ok: boolean; errors: string[] }> {
  if (!validateSchema(value)) return { ok: false, errors: errorsFor(validateSchema) };
  const errors: string[] = [];
  let canonicalHash = "";
  try {
    canonicalHash = await sha256Hex(canonicalize(value));
  } catch (error) {
    errors.push(error instanceof Error ? error.message : "canonicalization failed");
  }
  if (canonicalHash !== EXPECTED.canonicalSha256) {
    errors.push("frozen preregistration canonical hash mismatch");
  }
  const files: Array<[string, string, string]> = [
    ["benchmark", EXPECTED.benchmarkPath, EXPECTED.benchmarkSha256],
    ["build manifest", EXPECTED.manifestPath, EXPECTED.manifestSha256],
    ["JavaScript artifact", EXPECTED.javascriptPath, EXPECTED.javascriptSha256],
    ["Wasm artifact", EXPECTED.wasmPath, EXPECTED.wasmSha256],
  ];
  for (const [label, path, expectedHash] of files) {
    const actualHash = await checkedFileHash(path);
    if (actualHash !== expectedHash) errors.push(`checked-out ${label} hash mismatch`);
  }
  const manifest = JSON.parse(
    await Deno.readTextFile(new URL(EXPECTED.manifestPath, import.meta.url)),
  );
  if (
    manifest.variants?.["js-controlled"]?.sha256 !== EXPECTED.javascriptSha256 ||
    manifest.variants?.["wasm-linear-controlled"]?.sha256 !== EXPECTED.wasmSha256
  ) {
    errors.push("build manifest artifact binding mismatch");
  }
  return { ok: errors.length === 0, errors };
}
