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
const schema = JSON.parse(
  await Deno.readTextFile(new URL("../schemas/preregistration.schema.json", import.meta.url)),
);
const validateSchema = ajv.compile(schema);

const EXPECTED = {
  experimentId: "m1-chrome-sum-u32-v1",
  sourceCommit: "3aea1939e6b17c9c1a1deebebfa69cd2c35bb633",
  benchmarkSha256: "d5a7c9459e5bbed3a64d521af393d30d572b1034184a249f14265e2a0a99ff0a",
  buildManifestSha256: "38136e96462c5b98e3057e4ea18ae339150918aa50f1270eb3db88586185cf98",
  inputSha256: "4f0516549fc9d6952c8d42d642927dd5c43a8c01d03c286e0c80da919bfaf9d7",
  jsSha256: "4d8379672c1b51b0b315d2bee119880694e5a4f6412ef59b7fe2593ef6b179b7",
  wasmSha256: "9c4ce5f0d9e32cdd364b73b2697566e7396368d9867d9bc3d939bb2063583a6d",
  browserVersion: "150.0.7871.24",
  browserSha256: "dea3ab8fba923b718920ef9d62570824f2dc0ab0c72d66d53f91b41de6570355",
  origin: "http://127.0.0.1:8787",
} as const;

async function sha256File(url: URL): Promise<string> {
  const bytes = await Deno.readFile(url);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return [...new Uint8Array(digest)].map((value) => value.toString(16).padStart(2, "0")).join("");
}

function errorsFor(validator: Validator): string[] {
  return (validator.errors ?? []).map((error) => `${error.instancePath || "/"} ${error.message}`);
}

function object(value: unknown): Record<string, unknown> {
  return value as Record<string, unknown>;
}

function same(left: unknown, right: unknown): boolean {
  return JSON.stringify(left) === JSON.stringify(right);
}

function semanticErrors(value: Record<string, unknown>): string[] {
  const errors: string[] = [];
  const source = object(value.source);
  const benchmark = object(source.benchmark);
  const buildManifest = object(source.buildManifest);
  const input = object(source.input);
  const variants = source.variants as Array<Record<string, unknown>>;
  const browser = object(value.browserPolicy);
  const origin = object(value.originPolicy);
  const strata = value.strata as Array<Record<string, unknown>>;
  const pairing = object(value.pairing);
  const statistics = object(value.statistics);
  const sequential = object(statistics.sequentialProtection);
  const bootstrap = object(statistics.bootstrap);
  const precision = object(statistics.precision);
  const accounting = object(value.accounting);
  const instrumentation = object(value.instrumentation);
  const headline = object(instrumentation.headline);
  const diagnostics = object(instrumentation.diagnostics);
  const permit = object(value.permitEnvelope);

  if (value.experimentId !== EXPECTED.experimentId || permit.experimentId !== value.experimentId) {
    errors.push("experiment identity mismatch");
  }
  if (source.measurementSourceCommit !== EXPECTED.sourceCommit) {
    errors.push("source commit mismatch");
  }
  if (benchmark.sha256 !== EXPECTED.benchmarkSha256) errors.push("benchmark hash mismatch");
  if (buildManifest.sha256 !== EXPECTED.buildManifestSha256) {
    errors.push("build manifest hash mismatch");
  }
  if (input.sha256 !== EXPECTED.inputSha256) errors.push("input hash mismatch");
  const variantMap = new Map(variants.map((variant) => [variant.id, variant]));
  if (variantMap.get("js-controlled")?.sha256 !== EXPECTED.jsSha256) {
    errors.push("JavaScript hash mismatch");
  }
  if (variantMap.get("wasm-linear-controlled")?.sha256 !== EXPECTED.wasmSha256) {
    errors.push("Wasm hash mismatch");
  }
  if (
    browser.version !== EXPECTED.browserVersion ||
    browser.executableSha256 !== EXPECTED.browserSha256 ||
    browser.majorVersion !== 150
  ) errors.push("browser identity mismatch");
  if (origin.exactOrigin !== EXPECTED.origin || permit.exactOrigin !== EXPECTED.origin) {
    errors.push("origin mismatch");
  }
  if (
    permit.exactBrowserVersion !== browser.version ||
    permit.exactBinarySha256 !== browser.executableSha256
  ) errors.push("permit browser mismatch");

  const expectedCheckpoints = [20, 30, 40, 50, 60];
  if (strata.length !== 2 || new Set(strata.map((stratum) => stratum.id)).size !== 2) {
    errors.push("cold and warm strata required");
  }
  for (const id of ["cold", "warm"]) {
    const stratum = strata.find((candidate) => candidate.id === id);
    if (
      !stratum || stratum.cacheState !== id || stratum.minimumPairedLaunches !== 20 ||
      stratum.fixedCapPairedLaunches !== 60 || !same(stratum.checkpoints, expectedCheckpoints)
    ) {
      errors.push(`${id} stratum contract mismatch`);
    }
  }
  if (pairing.strataPoolingAllowed !== false) errors.push("strata pooling forbidden");
  if (pairing.retriesAllowed !== false || pairing.substitutionsAllowed !== false) {
    errors.push("retries and substitutions forbidden");
  }

  const schedule = pairing.schedule as Array<Record<string, unknown>>;
  for (const id of ["cold", "warm"]) {
    const rows = schedule.filter((row) => row.stratum === id);
    if (rows.length !== 60) errors.push(`${id} schedule must contain 60 rows`);
    const start = id === "cold" ? "js-controlled" : "wasm-linear-controlled";
    for (let index = 1; index <= 60; index += 1) {
      const row = rows.find((candidate) => candidate.blockIndex === index);
      const expectedFirst = index % 2 === 1
        ? start
        : start === "js-controlled"
        ? "wasm-linear-controlled"
        : "js-controlled";
      const expectedSecond = expectedFirst === "js-controlled"
        ? "wasm-linear-controlled"
        : "js-controlled";
      if (
        !row || row.blockId !== `${id}-${String(index).padStart(2, "0")}` ||
        !same(row.order, [expectedFirst, expectedSecond])
      ) {
        errors.push(`${id} schedule row ${index} mismatch`);
        break;
      }
    }
  }

  if (
    !same(sequential.checkpoints, expectedCheckpoints) || sequential.looksPerStratum !== 5 ||
    sequential.method !== "Bonferroni" || sequential.familyWiseAlpha !== 0.05 ||
    sequential.twoSidedConfidenceLevelPerLook !== 0.99
  ) {
    errors.push("sequential confidence contract mismatch");
  }
  const derivedConfidence = 1 - Number(sequential.familyWiseAlpha) /
      Number(sequential.looksPerStratum);
  if (Math.abs(derivedConfidence - Number(sequential.twoSidedConfidenceLevelPerLook)) > 1e-12) {
    errors.push("Bonferroni confidence is not internally consistent");
  }
  if (
    bootstrap.resamples !== 10_000 || bootstrap.prng !== "xorshift32-v1" ||
    bootstrap.resampleUnit !== "paired fresh launch" || bootstrap.stratified !== true
  ) {
    errors.push("bootstrap contract mismatch");
  }
  if (precision.targetMaximum !== 0.03 || statistics.headlineInput !== "committed-pairs-only") {
    errors.push("precision or denominator contract mismatch");
  }
  if (
    accounting.committedDenominatorOnly !== true || accounting.noRetryOrSubstitution !== true ||
    accounting.unavailableMetricPolicy !== "typed-unavailable-with-reason-never-zero"
  ) {
    errors.push("accounting contract mismatch");
  }
  if (
    Object.entries(headline).some(([key, setting]) =>
      key.endsWith("Enabled") && setting !== false
    ) ||
    headline.forcedGc !== false || headline.memoryPolling !== false ||
    diagnostics.separateLaunchesAndPermitRequired !== true ||
    diagnostics.neverEnterHeadlineCells !== true ||
    diagnostics.unavailableMetricPolicy !==
      "typed-unavailable-with-source-scope-timestamp-never-zero"
  ) {
    errors.push("diagnostic instrumentation entered headline or lost unavailable typing");
  }
  if (
    permit.state !== "template-only-not-consumed" || permit.singleUse !== true ||
    permit.maximumOwnedBrowserLaunches !== 120 || permit.maximumPerStratum !== 60 ||
    permit.deadlineRequired !== true || permit.maximumValidityHours !== 24 ||
    permit.retryAfterFailureRequiresNewPermit !== true
  ) {
    errors.push("permit envelope mismatch");
  }
  return errors;
}

export async function validatePreregistration(
  value: unknown,
): Promise<{ ok: boolean; errors: string[] }> {
  if (!validateSchema(value)) return { ok: false, errors: errorsFor(validateSchema) };
  const errors = semanticErrors(value as Record<string, unknown>);
  const benchmarkHash = await sha256File(
    new URL("../benchmarks/sum-u32/benchmark.json", import.meta.url),
  );
  const manifestUrl = new URL("../public/artifacts/sum-u32/build-manifest.json", import.meta.url);
  const manifestHash = await sha256File(manifestUrl);
  if (benchmarkHash !== EXPECTED.benchmarkSha256) {
    errors.push("checked-out benchmark hash mismatch");
  }
  if (manifestHash !== EXPECTED.buildManifestSha256) {
    errors.push("checked-out build manifest hash mismatch");
  }
  const manifest = JSON.parse(await Deno.readTextFile(manifestUrl));
  if (
    manifest.input?.sha256 !== EXPECTED.inputSha256 ||
    manifest.variants?.["js-controlled"]?.sha256 !== EXPECTED.jsSha256 ||
    manifest.variants?.["wasm-linear-controlled"]?.sha256 !== EXPECTED.wasmSha256
  ) errors.push("build manifest semantic binding mismatch");
  return { ok: errors.length === 0, errors };
}
