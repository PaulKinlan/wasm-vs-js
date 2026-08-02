import Ajv2020Module from "ajv2020";
import addFormatsModule from "ajv-formats";

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
const benchmarkSchema = JSON.parse(
  await Deno.readTextFile(new URL("../schemas/benchmark.schema.json", import.meta.url)),
);
const runSchema = JSON.parse(
  await Deno.readTextFile(new URL("../schemas/run.schema.json", import.meta.url)),
);
const validateBenchmarkSchema = ajv.compile(benchmarkSchema);
const validateRunSchema = ajv.compile(runSchema);

export function semanticBenchmark(value: Record<string, unknown>): boolean {
  if (!Array.isArray(value.variants) || !Array.isArray(value.tracks)) return false;
  const variants = value.variants as Array<Record<string, unknown>>;
  const tracks = value.tracks as string[];
  const ids = variants.map((variant) => variant.id);
  if (new Set(ids).size !== ids.length) return false;
  const usedTracks = new Set(variants.map((variant) => variant.track));
  if (tracks.length !== usedTracks.size || !tracks.every((track) => usedTracks.has(track))) {
    return false;
  }
  const controlledTargets = new Set(
    variants.filter((variant) => variant.track === "controlled").map((variant) => variant.target),
  );
  return variants.every(
    (variant) => variant.track !== "optimized" || controlledTargets.has(variant.target),
  );
}

function errors(validator: Validator): string[] {
  return (validator.errors ?? []).map((error) =>
    `${error.instancePath ?? ""} ${error.message ?? "invalid"}`
  );
}

export function validateBenchmark(value: unknown): { ok: boolean; errors: string[] } {
  const schemaValid = validateBenchmarkSchema(value);
  const semanticValid = schemaValid && semanticBenchmark(value as Record<string, unknown>);
  return {
    ok: Boolean(semanticValid),
    errors: schemaValid
      ? semanticValid ? [] : ["semantic benchmark invariant denied"]
      : errors(validateBenchmarkSchema),
  };
}

export function validateRun(value: unknown): { ok: boolean; errors: string[] } {
  const ok = validateRunSchema(value);
  return { ok: Boolean(ok), errors: ok ? [] : errors(validateRunSchema) };
}
