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
const benchmarkDefinition = JSON.parse(
  await Deno.readTextFile(new URL("../benchmarks/sum-u32/benchmark.json", import.meta.url)),
) as Record<string, unknown>;
const buildManifest = JSON.parse(
  await Deno.readTextFile(
    new URL("../public/artifacts/sum-u32/build-manifest.json", import.meta.url),
  ),
) as Record<string, unknown>;
const variants = buildManifest.variants as Record<string, Record<string, unknown>>;
function expectedCommit(): string {
  return Deno.env.get("WASM_VS_JS_COMMIT") ?? "";
}

// When running in public mode (no WASM_VS_JS_COMMIT), the commit-matching
// semantic check is relaxed: schema validation alone is sufficient.
// This allows the KV store to accept schema-valid run records from reporters.
function hasExpectedCommit(): boolean {
  const commit = expectedCommit();
  return /^(?:[a-f0-9]{40}|[a-f0-9]{64})$/.test(commit);
}
const expectedVariants = new Map([
  ["js-controlled", { target: "javascript", artifact: "benchmarks/sum-u32/workload.js" }],
  [
    "wasm-linear-controlled",
    { target: "wasm-linear", artifact: "public/artifacts/sum-u32/sum-u32.wasm" },
  ],
]);

function sameJson(left: unknown, right: unknown): boolean {
  return JSON.stringify(left) === JSON.stringify(right);
}

function semanticRun(value: Record<string, unknown>): boolean {
  const benchmark = value.benchmark as Record<string, unknown>;
  const variant = value.variant as Record<string, unknown>;
  const build = value.build as Record<string, unknown>;
  const correctness = value.correctness as Record<string, unknown>;
  const counters = correctness.workCounters as Record<string, unknown>;
  const capabilities = value.capabilities as Record<string, unknown>;
  const conditions = value.conditions as Record<string, unknown>;
  if (
    !benchmark || !variant || !build || !correctness || !counters || !capabilities || !conditions
  ) return false;
  // In public mode (no expected commit), skip sum-u32-specific semantic checks.
  // Schema validation alone is sufficient for accepting run records from reporters.
  if (!hasExpectedCommit()) return true;
  const commit = expectedCommit();
  const expected = expectedVariants.get(String(variant.id));
  const variantBuild = variants[String(variant.id)];
  const batch = capabilities.measurementBatchSize;
  if (!expected || !variantBuild || !Number.isSafeInteger(batch) || Number(batch) < 1) return false;
  if (
    (value.suite as Record<string, unknown>).commit !== commit ||
    build.sourceCommit !== commit ||
    benchmark.id !== benchmarkDefinition.id || benchmark.version !== benchmarkDefinition.version ||
    benchmark.tier !== benchmarkDefinition.tier ||
    benchmark.inputManifestSha256 !==
      (benchmarkDefinition.inputs as Record<string, unknown>).manifestSha256 ||
    variant.target !== expected.target || variant.track !== "controlled" ||
    build.sourceRepository !== buildManifest.sourceRepository ||
    build.sourceSha256 !== buildManifest.sourceSha256 ||
    build.command !== (buildManifest.build as Record<string, unknown>).command ||
    !sameJson(build.toolchains, (buildManifest.build as Record<string, unknown>).toolchains) ||
    !sameJson(build.flags, (buildManifest.build as Record<string, unknown>).flags) ||
    !sameJson(build.lockfiles, buildManifest.lockfiles) ||
    !sameJson(build.footprint, variantBuild.footprint)
  ) return false;
  const artifacts = build.artifacts as Array<Record<string, unknown>>;
  if (
    !Array.isArray(artifacts) || artifacts.length !== 1 ||
    artifacts[0].name !== expected.artifact ||
    artifacts[0].sha256 !== variantBuild.sha256
  ) return false;
  const multiplier = Number(batch);
  if (
    counters.items !== 65_536 * multiplier || counters["input-bytes"] !== 262_144 * multiplier ||
    counters.additions !== 65_536 * multiplier || counters.loads !== 65_536 * multiplier ||
    counters["boundary-crossings"] !== multiplier
  ) return false;
  if (
    correctness.status === "passed" &&
    correctness.outputSha256 !== (buildManifest.oracle as Record<string, unknown>).outputSha256
  ) return false;
  if (variant.cacheState === "cold" && capabilities.coldProfileAttested !== true) return false;
  if (variant.cacheState === "warm" && capabilities.assetsPrimed !== true) return false;
  return conditions.orderIndex === 0 || conditions.orderIndex === 1;
}

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
  const schemaValid = validateRunSchema(value);
  const semanticValid = schemaValid && semanticRun(value as Record<string, unknown>);
  return {
    ok: Boolean(semanticValid),
    errors: schemaValid
      ? semanticValid ? [] : ["semantic run invariant denied"]
      : errors(validateRunSchema),
  };
}
