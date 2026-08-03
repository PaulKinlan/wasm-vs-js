import { sha256Hex } from "./canonical.ts";

export type NumericFftBundle = {
  registration: Record<string, unknown>;
  fixture: Record<string, unknown>;
  output: Record<string, unknown>;
  build: Record<string, unknown>;
  records: Record<string, Record<string, unknown>>;
};

const ENTRY_ID = "numeric.fft-spectral-filter.v1";
const IMPLEMENTATION_ID = "numeric-fft-spectral-filter-controlled-v1";
const VARIANTS = ["js-controlled", "wasm-linear-controlled"] as const;
const CATALOG_SHA256 = "6665664f984683e5b7d3fdc8c1602198124844704c224a526d48be2f02edf9d4";
const FIXTURE_PATH = "public/artifacts/numeric-fft-spectral-filter/fixture-manifest.json";
const OUTPUT_PATH = "public/artifacts/numeric-fft-spectral-filter/output-manifest.json";
const WASM_PATH = "public/artifacts/numeric-fft-spectral-filter/numeric-fft-spectral-filter.wasm";

function object(value: unknown, label: string): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error(`${label} must be an object`);
  }
  return value as Record<string, unknown>;
}

function jsonEqual(left: unknown, right: unknown): boolean {
  return JSON.stringify(left) === JSON.stringify(right);
}

function prettyJsonBytes(value: unknown): Uint8Array {
  return new TextEncoder().encode(`${JSON.stringify(value, null, 2)}\n`);
}

function assertEqual(actual: unknown, expected: unknown, label: string): void {
  if (!jsonEqual(actual, expected)) throw new Error(`${label} mismatch`);
}

function expectedCounters(variantId: string): Record<string, number> {
  return {
    pipelines: 1,
    samples: 1_048_576,
    "forward-ffts": 1,
    "inverse-ffts": 1,
    butterflies: 20_971_520,
    "twiddle-pair-loads": 20_971_520,
    "window-multiplies": 1_048_576,
    "filter-scalar-multiplies": 2_097_152,
    "inverse-scale-multiplies": 2_097_152,
    "input-bytes": 20_971_512,
    "output-bytes": 8_388_608,
    allocations: variantId === "js-controlled" ? 1 : 0,
    "boundary-crossings": variantId === "js-controlled" ? 0 : 1,
  };
}

export async function loadNumericFftBundle(
  repoRoot = ".",
): Promise<NumericFftBundle> {
  const readJson = async (path: string) =>
    object(JSON.parse(await Deno.readTextFile(`${repoRoot}/${path}`)), path);
  return {
    registration: await readJson(
      "catalog/base-implementations/numeric.fft-spectral-filter.v1.json",
    ),
    fixture: await readJson(FIXTURE_PATH),
    output: await readJson(OUTPUT_PATH),
    build: await readJson(
      "public/artifacts/numeric-fft-spectral-filter/build-manifest.json",
    ),
    records: {
      "js-controlled": await readJson(
        "public/evidence/base-v1/numeric-fft-spectral-filter/js-controlled.json",
      ),
      "wasm-linear-controlled": await readJson(
        "public/evidence/base-v1/numeric-fft-spectral-filter/wasm-linear-controlled.json",
      ),
    },
  };
}

export async function validateNumericFftSemantics(
  bundle: NumericFftBundle,
  options: { repoRoot?: string; requireLocalFiles?: boolean } = {},
): Promise<{ ok: boolean; errors: string[] }> {
  const errors: string[] = [];
  try {
    const { registration, fixture, output, build, records } = bundle;
    const identities = [registration, fixture, output, build, ...Object.values(records)];
    for (const [index, value] of identities.entries()) {
      if (index === 0) {
        assertEqual(
          value.registrationId,
          "numeric-fft-spectral-filter-controlled-v1",
          "registration identity",
        );
      } else {
        assertEqual(value.entryId, ENTRY_ID, `entry identity ${index}`);
        assertEqual(value.implementationId, IMPLEMENTATION_ID, `implementation identity ${index}`);
      }
    }
    assertEqual(
      object(registration.frozenCatalog, "registration frozenCatalog").entryId,
      ENTRY_ID,
      "registration catalog entry",
    );
    assertEqual(
      object(registration.frozenCatalog, "registration frozenCatalog").sha256,
      CATALOG_SHA256,
      "registration catalog hash",
    );
    assertEqual(
      object(build.frozenCatalog, "build frozenCatalog").sha256,
      CATALOG_SHA256,
      "build catalog hash",
    );
    assertEqual(registration.variants, VARIANTS, "registered variants");

    const sourceCommit = build.sourceCommit;
    for (const [index, value] of [fixture, output, ...Object.values(records)].entries()) {
      assertEqual(value.sourceCommit, sourceCommit, `source commit ${index}`);
    }
    const buildCommand = String(object(build.toolchain, "build toolchain").command);
    if (!buildCommand.endsWith(`--source-commit=${sourceCommit}`)) {
      throw new Error("toolchain source commit mismatch");
    }

    const fixtureFields = object(fixture.fields, "fixture fields");
    const fieldOrder = ["signal", "window", "twiddles", "gains"];
    assertEqual(Object.keys(fixtureFields), fieldOrder, "fixture field order");
    const fixtureIdentity = fieldOrder.map((name) =>
      `${name}\0${String(object(fixtureFields[name], `fixture ${name}`).sha256)}\n`
    ).join("");
    assertEqual(
      fixture.fixtureSha256,
      await sha256Hex(fixtureIdentity),
      "fixture composite hash",
    );

    const completeOutput = object(output.completeOutput, "complete output");
    const outputOracle = object(output.oracle, "output oracle");
    const outputVariants = object(output.variants, "output variants");
    const expectedCheckpointIndexes = [0, 1, 131_072, 262_144, 524_288, 1_048_574, 1_048_575];
    assertEqual(
      (completeOutput.checkpoints as Array<Record<string, unknown>>).map((item) => item.index),
      expectedCheckpointIndexes,
      "checkpoint identities",
    );
    assertEqual(
      object(registration.oracle, "registration oracle").absoluteTolerance,
      object(outputOracle.tolerance, "output tolerance").absolute,
      "absolute tolerance",
    );
    assertEqual(
      object(registration.oracle, "registration oracle").relativeTolerance,
      object(outputOracle.tolerance, "output tolerance").relative,
      "relative tolerance",
    );
    assertEqual(
      object(registration.oracle, "registration oracle").energyRelativeTolerance,
      object(outputOracle.tolerance, "output tolerance").energyRelative,
      "energy tolerance",
    );
    assertEqual(
      object(registration.oracle, "registration oracle").quantizationStep,
      completeOutput.quantizationStep,
      "quantization step",
    );

    const fixedWork = object(registration.fixedWork, "registration fixed work");
    assertEqual(fixedWork.samples, fixture.sampleCount, "fixture sample count");
    assertEqual(fixedWork.butterflies, 20_971_520, "registered butterfly count");
    for (const variantId of VARIANTS) {
      const outputVariant = object(outputVariants[variantId], `output variant ${variantId}`);
      assertEqual(
        outputVariant.counters,
        expectedCounters(variantId),
        `${variantId} output counters`,
      );
      const record = object(records[variantId], `${variantId} record`);
      assertEqual(record.variantId, variantId, `${variantId} record identity`);
      assertEqual(record.fixtureSha256, fixture.fixtureSha256, `${variantId} fixture hash`);
      assertEqual(
        record.completeOutputSha256,
        completeOutput.sha256,
        `${variantId} complete output hash`,
      );
      assertEqual(
        record.quantizedOutputSha256,
        completeOutput.quantizedSha256,
        `${variantId} quantized output hash`,
      );
      assertEqual(record.counters, expectedCounters(variantId), `${variantId} record counters`);
      assertEqual(
        record.oracle,
        outputOracle[variantId === "js-controlled" ? "js" : "wasm"],
        `${variantId} oracle provenance`,
      );
      assertEqual(
        record.buildManifest,
        "/artifacts/numeric-fft-spectral-filter/build-manifest.json",
        `${variantId} build provenance`,
      );
      assertEqual(record.performanceSamples, [], `${variantId} performance samples`);
    }

    const sourceGraph = build.fullSourceGraph as Array<Record<string, unknown>>;
    const graphPaths = sourceGraph.map((source) => String(source.path));
    if (new Set(graphPaths).size !== graphPaths.length) throw new Error("duplicate source path");
    const graph = new Map(sourceGraph.map((source) => [String(source.path), source]));
    const sourceIdentity = sourceGraph.map((source) =>
      `${String(source.path)}\0${String(source.sha256)}\n`
    ).join("");
    assertEqual(build.sourceSha256, await sha256Hex(sourceIdentity), "source graph hash");
    const variants = object(build.variants, "build variants");
    const jsBuild = object(variants["js-controlled"], "JS build variant");
    const wasmBuild = object(variants["wasm-linear-controlled"], "Wasm build variant");
    assertEqual(
      jsBuild.sourceSha256,
      graph.get(String(jsBuild.source))?.sha256,
      "JS source graph provenance",
    );
    assertEqual(
      graph.get(String(wasmBuild.source))?.sha256,
      graph.get("benchmarks/base/numeric-fft-spectral-filter/numeric-fft-spectral-filter.wat")
        ?.sha256,
      "Wasm source graph provenance",
    );

    const requireLocalFiles = options.requireLocalFiles ?? true;
    if (requireLocalFiles) {
      const root = options.repoRoot ?? ".";
      assertEqual(
        await sha256Hex(await Deno.readFile(`${root}/catalog/workloads.v1.json`)),
        CATALOG_SHA256,
        "local frozen catalog hash",
      );
      assertEqual(
        await sha256Hex(await Deno.readFile(`${root}/public/data/workloads.v1.json`)),
        CATALOG_SHA256,
        "public frozen catalog hash",
      );
      for (const source of sourceGraph) {
        const bytes = await Deno.readFile(`${root}/${String(source.path)}`);
        assertEqual(bytes.byteLength, source.bytes, `${String(source.path)} bytes`);
        assertEqual(await sha256Hex(bytes), source.sha256, `${String(source.path)} hash`);
      }
      const manifests = object(build.manifests, "build manifests");
      assertEqual(
        object(manifests.fixture, "fixture provenance").sha256,
        await sha256Hex(prettyJsonBytes(fixture)),
        "fixture manifest provenance",
      );
      assertEqual(
        object(manifests.output, "output provenance").sha256,
        await sha256Hex(prettyJsonBytes(output)),
        "output manifest provenance",
      );
      assertEqual(
        object(manifests.fixture, "fixture provenance").path,
        FIXTURE_PATH,
        "fixture manifest path",
      );
      assertEqual(
        object(manifests.output, "output provenance").path,
        OUTPUT_PATH,
        "output manifest path",
      );
      const wasmBytes = await Deno.readFile(`${root}/${WASM_PATH}`);
      assertEqual(wasmBytes.byteLength, wasmBuild.bytes, "Wasm artifact bytes");
      assertEqual(await sha256Hex(wasmBytes), wasmBuild.artifactSha256, "Wasm artifact hash");
      assertEqual(wasmBuild.artifact, WASM_PATH, "Wasm artifact path");
    }
  } catch (error) {
    errors.push(error instanceof Error ? error.message : String(error));
  }
  return { ok: errors.length === 0, errors };
}
