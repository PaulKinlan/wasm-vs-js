// Pinned build + proposal-validation records for the v2 neural slices
// ml-gemm and ml-dense-mlp.
//
// Modes:
//   artifacts — assemble WAT, generate fixtures, compute the pinned f64
//     references and sound propagated stored bounds, execute both controlled
//     targets, execute EVERY catalog oracle check (complete output bound,
//     structural invariants, work counters), and only then write
//     wasm/reference/bounds/manifest artifacts.
//   records — emit one workload-result-v2-proposal record per controlled
//     variant with full commit-bound immutable provenance. Requires
//     WASM_VS_JS_COMMIT to name a commit whose tree contains every
//     referenced file (run after the artifacts commit); every referenced
//     hash is taken from the git tree at that commit and verified to match
//     the working tree, and the output manifest's recorded oracle evidence
//     is re-verified before any record is marked passed.
//
// Toolchain is pinned: the build refuses any Deno other than the recorded
// pin so manifests never absorb ambient toolchain drift.
//
// deno run --allow-read=. --allow-write=artifacts --allow-env=WASM_VS_JS_COMMIT \
//   --allow-run scripts/build-v2-neural.ts <artifacts|records>

import wabtFactory from "wabt";
import { canonicalize, sha256Hex } from "../lib/canonical.ts";
import {
  boundCheck,
  bytesOf,
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
} from "../lib/v2/neural.ts";
import * as gemm from "../benchmarks/v2/ml-gemm/workload.js";
import * as mlp from "../benchmarks/v2/ml-dense-mlp/workload.js";

const PINNED_DENO = "2.9.0";
if (Deno.version.deno !== PINNED_DENO) {
  throw new Error(
    `pinned toolchain violation: build requires Deno ${PINNED_DENO}, found ${Deno.version.deno}`,
  );
}

const mode = Deno.args[0];
if (mode !== "artifacts" && mode !== "records") {
  throw new Error("usage: build-v2-neural.ts <artifacts|records>");
}
// The exact source commit is only needed when emitting commit-bound records;
// artifacts are deterministic bytes independent of any commit.
const commit = Deno.env.get("WASM_VS_JS_COMMIT") ?? "";
if (mode === "records" && !/^[0-9a-f]{40}$/.test(commit)) {
  throw new Error("WASM_VS_JS_COMMIT must be the exact 40-hex source commit");
}
const repository = "https://github.com/PaulKinlan/wasm-vs-js";
const root = new URL("../", import.meta.url);

async function assembleWat(name: string, path: string): Promise<Uint8Array<ArrayBuffer>> {
  const watText = await Deno.readTextFile(new URL(path, root));
  const wabt = await wabtFactory();
  const parsed = wabt.parseWat(name, watText, {
    exceptions: false,
    threads: false,
    simd: false,
  });
  parsed.resolveNames();
  parsed.validate();
  const built = parsed.toBinary({
    canonicalize_lebs: true,
    relocatable: false,
    write_debug_names: false,
  });
  parsed.destroy();
  return new Uint8Array(built.buffer);
}

const writtenJsonPaths: string[] = [];

async function writeJson(dir: URL, name: string, value: unknown): Promise<void> {
  await Deno.writeTextFile(new URL(name, dir), `${canonicalize(value)}\n`);
  writtenJsonPaths.push(`${new URL(dir, root).pathname.replace(/\/$/, "")}/${name}`);
}

// Format every written JSON artifact with the pinned toolchain's own
// formatter so `deno fmt --check` passes by construction and rebuilds remain
// byte-reproducible.
async function fmtWrittenJson(): Promise<void> {
  if (writtenJsonPaths.length === 0) return;
  const command = new Deno.Command(Deno.execPath(), {
    args: ["fmt", ...writtenJsonPaths],
    stdout: "piped",
    stderr: "piped",
  });
  const result = await command.output();
  if (!result.success) throw new Error(new TextDecoder().decode(result.stderr));
}

// Records-mode reference: the hash is taken from the git TREE at the
// recorded commit (the immutable URL's actual target), and the working tree
// is verified identical so uncommitted drift can never be recorded.
async function fileRefGit(path: string) {
  const command = new Deno.Command("git", {
    args: ["show", `${commit}:${path}`],
    stdout: "piped",
    stderr: "piped",
  });
  const result = await command.output();
  if (!result.success) {
    throw new Error(`provenance path missing at ${commit}: ${path}`);
  }
  const treeHash = await sha256Hex(new Uint8Array(result.stdout));
  const disk = await Deno.readFile(new URL(path, root));
  const diskHash = await sha256Hex(disk);
  if (treeHash !== diskHash) {
    throw new Error(`provenance path drifted between ${commit} and disk: ${path}`);
  }
  return {
    path,
    sha256: treeHash,
    immutableUrl: `${repository}/blob/${commit}/${path}`,
  };
}

// Deterministic phase-coverage attestation persisted in output manifests;
// records mode requires it to match the catalog's declared phase map.
const PHASE_ATTESTATION = {
  load: "measured",
  initialize: "measured",
  transfer: "measured",
  compute: "measured",
  validation: "separate",
  render: "not-applicable",
  "end-to-end": "measured",
} as const;

// Fails the build unless every catalog-measured phase was really measured
// (no untimed constructor work, no zero placeholders).
function assertPhasesMeasured(label: string, timings: {
  load: number;
  initialize: number;
  transfer: number;
  compute: number;
  "end-to-end": number;
}): void {
  for (const phase of ["load", "initialize", "transfer", "compute", "end-to-end"] as const) {
    if (!(timings[phase] > 0)) {
      throw new Error(`${label}: phase ${phase} was not measured (${timings[phase]})`);
    }
  }
  if (timings["end-to-end"] < timings.compute) {
    throw new Error(`${label}: end-to-end precedes compute measurement`);
  }
}

function assertValidationMeasured(label: string, timings: { validation: number }): void {
  if (!(timings.validation > 0)) {
    throw new Error(`${label}: validation phase was not measured`);
  }
}

// ---------- artifacts mode ----------

async function buildGemmArtifacts(): Promise<void> {
  const outDir = new URL("artifacts/v2/ml-gemm/", root);
  await Deno.mkdir(outDir, { recursive: true });
  const wasmPromise = assembleWat("ml-gemm.wat", "benchmarks/v2/ml-gemm/ml-gemm.wat");

  const { a, b, c0 } = gemm.generateInput();
  const inputBytes = new Uint8Array(a.byteLength + b.byteLength + c0.byteLength);
  inputBytes.set(bytesOf(a), 0);
  inputBytes.set(bytesOf(b), a.byteLength);
  inputBytes.set(bytesOf(c0), a.byteLength + b.byteLength);

  const { reference, bound } = gemmReference(a, b, c0);

  // Execute both controlled targets through the phase-separated runners.
  // Every catalog-measured phase must actually be measured for BOTH
  // variants: load (JS: workload source read; Wasm: payload assembly),
  // initialize, transfer, compute, and end-to-end are timed here;
  // validation is timed per target below.
  const jsTimings = emptyPhaseTimings();
  await timedPhase(
    jsTimings,
    "load",
    () => Deno.readFile(new URL("benchmarks/v2/ml-gemm/workload.js", root)),
  );
  const jsRunner = GemmJsRunner.prepare(jsTimings);
  jsRunner.transfer(a, b, c0);
  jsRunner.run(1);
  const wasmTimings = emptyPhaseTimings();
  const wasm = await timedPhase(wasmTimings, "load", () => wasmPromise);
  const wasmRunner = await GemmWasmRunner.prepare(wasm, a, b, c0, wasmTimings);
  wasmRunner.transfer();
  wasmRunner.run(1);
  assertPhasesMeasured("ml-gemm js-controlled", jsTimings);
  assertPhasesMeasured("ml-gemm wasm-linear-controlled", wasmTimings);
  const jsOut = jsRunner.output();
  const wasmOut = wasmRunner.output();

  // Oracle checks: complete-output-bound, structural-invariants, work-counters.
  // Validation is timed per target as a separate phase.
  const jsBound = await timedPhase(
    jsTimings,
    "validation",
    () => boundCheck(jsOut, reference, bound),
  );
  const wasmBound = await timedPhase(
    wasmTimings,
    "validation",
    () => boundCheck(wasmOut, reference, bound),
  );
  for (const [label, result] of [["js", jsBound], ["wasm", wasmBound]] as const) {
    if (result.maxBoundRatio >= 1) {
      throw new Error(
        `ml-gemm ${label} exceeds stored hybrid bound (ratio ${result.maxBoundRatio})`,
      );
    }
  }
  const jsHealth = checkFiniteAndZero(jsOut);
  const wasmHealth = checkFiniteAndZero(wasmOut);
  if (!jsHealth.finite || !wasmHealth.finite) throw new Error("ml-gemm NaN policy violated");
  if (!jsHealth.negativeZeroFree || !wasmHealth.negativeZeroFree) {
    throw new Error("ml-gemm signed-zero policy violated");
  }
  const crossTarget = boundCheck(jsOut, Float64Array.from(wasmOut), bound);
  if (crossTarget.maxBoundRatio >= 1) {
    throw new Error("ml-gemm cross-target deviation exceeds stored bound");
  }

  // structural-invariants: shape, finite values, row checksums, corners.
  const jsStructural = await timedPhase(
    jsTimings,
    "validation",
    () => gemmStructuralChecks(jsOut, reference, bound),
  );
  const wasmStructural = await timedPhase(
    wasmTimings,
    "validation",
    () => gemmStructuralChecks(wasmOut, reference, bound),
  );
  assertValidationMeasured("ml-gemm js-controlled", jsTimings);
  assertValidationMeasured("ml-gemm wasm-linear-controlled", wasmTimings);
  for (const check of [...jsStructural, ...wasmStructural]) {
    if (!check.passed) {
      throw new Error(`ml-gemm structural invariant failed: ${check.id} (${check.detail})`);
    }
  }
  // work-counters: the analytic counters must cover exactly the catalog's
  // declared counter set with exact integer values (exact values are
  // independently asserted in tests/v2/ml-neural.test.ts).
  const jsCounters = gemmWorkCounters("javascript");
  const wasmCounters = gemmWorkCounters("wasm-linear");
  for (const value of [...Object.values(jsCounters), ...Object.values(wasmCounters)]) {
    if (!Number.isSafeInteger(value) || (value as number) < 0) {
      throw new Error("ml-gemm work counter is not an exact non-negative integer");
    }
  }

  // All oracle checks passed; only now persist artifacts (no partial state
  // from a failed build can be picked up by a later records run).
  await Deno.writeFile(new URL("ml-gemm.wasm", outDir), wasm);
  await Deno.writeFile(new URL("reference.f64", outDir), bytesOf(reference));
  await Deno.writeFile(new URL("bounds.f32", outDir), bytesOf(bound));

  const matrixDigests: string[] = [];
  for (let t = 0; t < gemm.BATCH; t += 1) {
    matrixDigests.push(
      await digestOf(wasmOut.subarray(t * gemm.M * gemm.N, (t + 1) * gemm.M * gemm.N)),
    );
  }

  const fixtureManifest = {
    schemaVersion: 1,
    workload: "ml.gemm.v1",
    generator: {
      algorithm: "xorshift32",
      seed: "0x91e10da5",
      revision: "proposal-generator-v1",
      streamTable: "per batch element: A then B then C0, stream indices 0..11",
      valueMapping: "(d / 2^32) * 2 * scale - scale, f64 compute, single f32 store rounding",
      scales: { A: 1, B: 1, C0: 1 },
    },
    parameters: { batch: gemm.BATCH, m: gemm.M, n: gemm.N, k: gemm.K },
    tensors: {
      a: { bytes: a.byteLength, sha256: await digestOf(a) },
      b: { bytes: b.byteLength, sha256: await digestOf(b) },
      c0: { bytes: c0.byteLength, sha256: await digestOf(c0) },
      concatenated: { bytes: inputBytes.byteLength, sha256: await sha256Hex(inputBytes) },
    },
  };
  await writeJson(outDir, "fixture-manifest.json", fixtureManifest);
  await writeJson(outDir, "input-manifest.json", {
    schemaVersion: 1,
    workload: "ml.gemm.v1",
    bytes: inputBytes.byteLength,
    sha256: await sha256Hex(inputBytes),
  });
  await writeJson(outDir, "output-manifest.json", {
    schemaVersion: 1,
    workload: "ml.gemm.v1",
    reference: { bytes: reference.byteLength, sha256: await digestOf(reference) },
    bounds: { bytes: bound.byteLength, sha256: await digestOf(bound) },
    outputs: {
      "js-controlled": await digestOf(jsOut),
      "wasm-linear-controlled": await digestOf(wasmOut),
    },
    matrixDigests,
    boundChecks: {
      "js-controlled": jsBound,
      "wasm-linear-controlled": wasmBound,
      crossTarget,
    },
    counters: {
      "js-controlled": jsCounters,
      "wasm-linear-controlled": wasmCounters,
    },
    structuralChecks: {
      "js-controlled": jsStructural,
      "wasm-linear-controlled": wasmStructural,
    },
    oracleChecks: [
      "complete-output-bound",
      "structural-invariants",
      "work-counters",
    ],
    // Deterministic phase-coverage attestation: every phase was measured
    // for real above (assertPhasesMeasured), for both variants. Measured
    // values are timing data and deliberately not persisted; the gate
    // re-asserts non-zero measurement on every run.
    phases: {
      "js-controlled": PHASE_ATTESTATION,
      "wasm-linear-controlled": PHASE_ATTESTATION,
    },
  });
  console.log(
    `build: ml-gemm.wasm ${wasm.byteLength} bytes; bound ratios js ${jsBound.maxBoundRatio} wasm ${wasmBound.maxBoundRatio}`,
  );
}

async function buildMlpArtifacts(): Promise<void> {
  const outDir = new URL("artifacts/v2/ml-dense-mlp/", root);
  await Deno.mkdir(outDir, { recursive: true });
  const wasmPromise = assembleWat(
    "ml-dense-mlp.wat",
    "benchmarks/v2/ml-dense-mlp/ml-dense-mlp.wat",
  );

  const { x, w, bias } = mlp.generateInput();
  const inputBytes = new Uint8Array(x.byteLength + w.byteLength + bias.byteLength);
  inputBytes.set(bytesOf(x), 0);
  inputBytes.set(bytesOf(w), x.byteLength);
  inputBytes.set(bytesOf(bias), x.byteLength + w.byteLength);

  // The measured-deviation bound recursion needs the controlled per-layer
  // outputs (identical across targets, verified below).
  const jsLayersForBounds = mlpJsLayerOutputs(x, w, bias);
  const { references, pres, bounds } = mlpReference(x, w, bias, jsLayersForBounds);
  const referenceBytes = new Uint8Array(references.reduce((total, r) => total + r.byteLength, 0));
  const boundBytes = new Uint8Array(bounds.reduce((total, b) => total + b.byteLength, 0));
  {
    let offset = 0;
    for (const layer of references) {
      referenceBytes.set(bytesOf(layer), offset);
      offset += layer.byteLength;
    }
    offset = 0;
    for (const layer of bounds) {
      boundBytes.set(bytesOf(layer), offset);
      offset += layer.byteLength;
    }
  }
  const jsTimings = emptyPhaseTimings();
  await timedPhase(
    jsTimings,
    "load",
    () => Deno.readFile(new URL("benchmarks/v2/ml-dense-mlp/workload.js", root)),
  );
  const jsRunner = MlpJsRunner.prepare(jsTimings);
  jsRunner.transfer(x, w, bias);
  jsRunner.run(1);
  const wasmTimings = emptyPhaseTimings();
  const wasm = await timedPhase(wasmTimings, "load", () => wasmPromise);
  const wasmRunner = await MlpWasmRunner.prepare(wasm, x, w, bias, wasmTimings);
  wasmRunner.run(1);
  assertPhasesMeasured("ml-dense-mlp js-controlled", jsTimings);
  assertPhasesMeasured("ml-dense-mlp wasm-linear-controlled", wasmTimings);

  // Per-layer validation for BOTH targets, not only the final output.
  const jsLayers = mlpJsLayerOutputs(x, w, bias);
  const wasmLayers = mlpWasmLayerOutputs(wasmRunner.exports);
  const layerChecks: unknown[] = [];
  for (let layer = 0; layer < mlp.LAYERS; layer += 1) {
    const jsCheck = boundCheck(jsLayers[layer], references[layer], bounds[layer]);
    const wasmCheck = boundCheck(wasmLayers[layer], references[layer], bounds[layer]);
    if (jsCheck.maxBoundRatio >= 1 || wasmCheck.maxBoundRatio >= 1) {
      throw new Error(`ml-dense-mlp layer ${layer} exceeds stored hybrid bound`);
    }
    const jsHealth = checkFiniteAndZero(jsLayers[layer]);
    const wasmHealth = checkFiniteAndZero(wasmLayers[layer]);
    if (!jsHealth.finite || !wasmHealth.finite) {
      throw new Error(`ml-dense-mlp NaN policy violated at layer ${layer}`);
    }
    if (!jsHealth.negativeZeroFree || !wasmHealth.negativeZeroFree) {
      throw new Error(`ml-dense-mlp signed-zero policy violated at layer ${layer}`);
    }
    layerChecks.push({ layer, js: jsCheck, wasm: wasmCheck });
  }
  const crossTarget = boundCheck(
    jsRunner.output(),
    Float64Array.from(wasmRunner.output()),
    bounds[mlp.LAYERS - 1],
  );
  if (crossTarget.maxBoundRatio >= 1) {
    throw new Error("ml-dense-mlp cross-target deviation exceeds stored bound");
  }

  // structural-invariants: shapes, finite values, final logits, ranking,
  // GELU formula invariants against the ideal reference pre-activations.
  // Validation is timed per target as a separate phase.
  const jsStructural = await timedPhase(
    jsTimings,
    "validation",
    () => mlpStructuralChecks(jsLayers, references, pres, bounds),
  );
  const wasmStructural = await timedPhase(
    wasmTimings,
    "validation",
    () => mlpStructuralChecks(wasmLayers, references, pres, bounds),
  );
  assertValidationMeasured("ml-dense-mlp js-controlled", jsTimings);
  assertValidationMeasured("ml-dense-mlp wasm-linear-controlled", wasmTimings);
  for (const check of [...jsStructural, ...wasmStructural]) {
    if (!check.passed) {
      throw new Error(
        `ml-dense-mlp structural invariant failed: ${check.id} (${check.detail})`,
      );
    }
  }
  // work-counters: exact integers covering the catalog counter set.
  const jsCounters = mlpWorkCounters("javascript");
  const wasmCounters = mlpWorkCounters("wasm-linear");
  for (const value of [...Object.values(jsCounters), ...Object.values(wasmCounters)]) {
    if (!Number.isSafeInteger(value) || (value as number) < 0) {
      throw new Error("ml-dense-mlp work counter is not an exact non-negative integer");
    }
  }

  // All oracle checks passed; only now persist artifacts.
  await Deno.writeFile(new URL("ml-dense-mlp.wasm", outDir), wasm);
  await Deno.writeFile(new URL("reference.f64", outDir), referenceBytes);
  await Deno.writeFile(new URL("bounds.f32", outDir), boundBytes);

  const layerDigests: string[] = [];
  for (const layer of wasmLayers) layerDigests.push(await digestOf(layer));

  const fixtureManifest = {
    schemaVersion: 1,
    workload: "ml.dense-mlp.v1",
    generator: {
      algorithm: "xorshift32",
      seed: "0x5a17c0de",
      revision: "proposal-generator-v1",
      streamTable: "x, then per layer W then bias, stream indices 0..18",
      valueMapping: "(d / 2^32) * 2 * scale - scale, f64 compute, single f32 store rounding",
      scales: { x: 1, W: 0.0625, bias: 0.25 },
    },
    parameters: {
      batch: mlp.MLP_BATCH,
      width: mlp.WIDTH,
      hiddenLayers: mlp.HIDDEN_LAYERS,
      projection: "final 512-wide linear layer without activation",
    },
    tensors: {
      x: { bytes: x.byteLength, sha256: await digestOf(x) },
      w: { bytes: w.byteLength, sha256: await digestOf(w) },
      bias: { bytes: bias.byteLength, sha256: await digestOf(bias) },
      concatenated: { bytes: inputBytes.byteLength, sha256: await sha256Hex(inputBytes) },
    },
  };
  await writeJson(outDir, "fixture-manifest.json", fixtureManifest);
  await writeJson(outDir, "input-manifest.json", {
    schemaVersion: 1,
    workload: "ml.dense-mlp.v1",
    bytes: inputBytes.byteLength,
    sha256: await sha256Hex(inputBytes),
  });
  await writeJson(outDir, "output-manifest.json", {
    schemaVersion: 1,
    workload: "ml.dense-mlp.v1",
    reference: { bytes: referenceBytes.byteLength, sha256: await sha256Hex(referenceBytes) },
    bounds: { bytes: boundBytes.byteLength, sha256: await sha256Hex(boundBytes) },
    outputs: {
      "js-controlled": await digestOf(jsRunner.output()),
      "wasm-linear-controlled": await digestOf(wasmRunner.output()),
    },
    layerDigests,
    layerChecks,
    crossTarget,
    counters: {
      "js-controlled": jsCounters,
      "wasm-linear-controlled": wasmCounters,
    },
    structuralChecks: {
      "js-controlled": jsStructural,
      "wasm-linear-controlled": wasmStructural,
    },
    oracleChecks: [
      "complete-output-bound",
      "structural-invariants",
      "work-counters",
    ],
    phases: {
      "js-controlled": PHASE_ATTESTATION,
      "wasm-linear-controlled": PHASE_ATTESTATION,
    },
  });
  const finalCheck = layerChecks[layerChecks.length - 1] as {
    js: { maxBoundRatio: number };
    wasm: { maxBoundRatio: number };
  };
  console.log(
    `build: ml-dense-mlp.wasm ${wasm.byteLength} bytes; final-layer bound ratios js ${finalCheck.js.maxBoundRatio} wasm ${finalCheck.wasm.maxBoundRatio}`,
  );
}

// ---------- records mode ----------

const CATALOG_PATH = "catalog/workloads.v2.proposed.json";

type CatalogEntry = {
  id: string;
  benchmarkSlug: string;
  input: { parameters: { name: string }[] };
  oracle: { checks: { id: string }[] };
  work: { counters: string[] };
  phases: Record<string, string>;
  missingCells: { cell: string }[];
  tracks: {
    id: string;
    track: string;
    variants: { id: string; target: string; algorithmFamilyId: string }[];
  }[];
};

// Re-verifies the output manifest's recorded oracle evidence before any
// record is marked passed: every catalog check id must be recorded as
// executed, every structural check must have passed, every bound ratio must
// be below 1, and the recorded counters must equal the analytic counters.
function verifyManifestEvidence(
  slug: string,
  entry: CatalogEntry,
  manifest: {
    oracleChecks?: string[];
    structuralChecks?: Record<string, { id: string; passed: boolean }[]>;
    boundChecks?: Record<string, { maxBoundRatio: number }>;
    layerChecks?: { js: { maxBoundRatio: number }; wasm: { maxBoundRatio: number } }[];
    crossTarget?: { maxBoundRatio: number };
    counters?: Record<string, Record<string, number>>;
    phases?: Record<string, Record<string, string>>;
  },
): void {
  const declared = entry.oracle.checks.map((check) => check.id);
  const executed = manifest.oracleChecks ?? [];
  for (const id of declared) {
    if (!executed.includes(id)) {
      throw new Error(`${slug}: catalog oracle check not executed: ${id}`);
    }
  }
  const structural = Object.values(manifest.structuralChecks ?? {}).flat();
  if (structural.length === 0) throw new Error(`${slug}: no structural checks recorded`);
  for (const check of structural) {
    if (!check.passed) throw new Error(`${slug}: structural check failed: ${check.id}`);
  }
  const ratios: number[] = [];
  for (const result of Object.values(manifest.boundChecks ?? {})) {
    ratios.push(result.maxBoundRatio);
  }
  for (const layer of manifest.layerChecks ?? []) {
    ratios.push(layer.js.maxBoundRatio, layer.wasm.maxBoundRatio);
  }
  if (manifest.crossTarget) ratios.push(manifest.crossTarget.maxBoundRatio);
  if (ratios.length === 0) throw new Error(`${slug}: no bound evidence recorded`);
  for (const ratio of ratios) {
    if (!(ratio < 1)) throw new Error(`${slug}: recorded bound ratio ${ratio} >= 1`);
  }
  const expectedCounters = slug === "ml-gemm"
    ? {
      "js-controlled": gemmWorkCounters("javascript"),
      "wasm-linear-controlled": gemmWorkCounters("wasm-linear"),
    }
    : {
      "js-controlled": mlpWorkCounters("javascript"),
      "wasm-linear-controlled": mlpWorkCounters("wasm-linear"),
    };
  const declaredCounterIds = [...entry.work.counters].sort();
  for (const [variantId, expected] of Object.entries(expectedCounters)) {
    const recorded = manifest.counters?.[variantId];
    if (!recorded) throw new Error(`${slug}: counters missing for ${variantId}`);
    if (JSON.stringify(Object.keys(recorded).sort()) !== JSON.stringify(declaredCounterIds)) {
      throw new Error(`${slug}: counter set mismatch for ${variantId}`);
    }
    if (canonicalize(recorded) !== canonicalize(expected)) {
      throw new Error(`${slug}: recorded counters diverge from analytic counters for ${variantId}`);
    }
  }
}

async function buildRecords(): Promise<void> {
  const catalog = JSON.parse(await Deno.readTextFile(new URL(CATALOG_PATH, root)));
  const catalogFile = await fileRefGit(CATALOG_PATH);
  const workloadContractFile = await fileRefGit("benchmarks/v2/shared/workload-contract.js");
  const resultContractFile = await fileRefGit("schemas/workload-result-v2-proposal.schema.json");
  const recipe = await fileRefGit("scripts/build-v2-neural.ts");
  const lock = await fileRefGit("deno.lock");
  const denoJson = await fileRefGit("deno.json");
  const generator = await fileRefGit("benchmarks/v2/shared/generator.js");
  const reference = await fileRefGit("lib/v2/neural.ts");

  for (const entryId of ["ml.gemm.v1", "ml.dense-mlp.v1"]) {
    const entry = catalog.entries.find((candidate: CatalogEntry) => candidate.id === entryId);
    if (!entry) throw new Error(`catalog entry missing: ${entryId}`);
    const slug = entry.benchmarkSlug;
    const outDir = new URL(`artifacts/v2/${slug}/`, root);
    const wasmPath = `artifacts/v2/${slug}/${slug}.wasm`;
    const referencePath = `artifacts/v2/${slug}/reference.f64`;
    const boundsPath = `artifacts/v2/${slug}/bounds.f32`;
    const fixture = await fileRefGit(`artifacts/v2/${slug}/fixture-manifest.json`);
    const input = await fileRefGit(`artifacts/v2/${slug}/input-manifest.json`);
    const output = await fileRefGit(`artifacts/v2/${slug}/output-manifest.json`);
    const outputManifest = JSON.parse(
      await Deno.readTextFile(new URL(`artifacts/v2/${slug}/output-manifest.json`, root)),
    );
    verifyManifestEvidence(slug, entry, outputManifest);
    const jsSource = {
      role: "javascript-authored",
      ...await fileRefGit(`benchmarks/v2/${slug}/workload.js`),
    };
    const wasmSource = {
      role: "wasm-authored",
      ...await fileRefGit(`benchmarks/v2/${slug}/${slug}.wat`),
    };
    const denoSupport = { role: "shared-support", ...denoJson };
    // The ml-dense-mlp targets share the frozen transcendental algorithm;
    // it is part of the controlled semantics and must be provenance-bound.
    const extraSources = slug === "ml-dense-mlp"
      ? [{
        role: "javascript-authored",
        ...await fileRefGit("benchmarks/v2/ml-dense-mlp/frozen-transcendentals.js"),
      }]
      : [];

    const controlled = entry.tracks.find((track: { id: string }) =>
      track.id === "track-a-controlled"
    );
    for (const variant of controlled.variants) {
      // Artifact identity follows the variant target truthfully: the JS
      // variant's payload artifact is its source; the Wasm variant's is the
      // pinned binary. The oracle reference and bounds are first-class
      // immutable artifacts of every record.
      const payloadArtifact = variant.target === "javascript"
        ? {
          id: `${slug}-javascript-source`,
          ...await fileRefGit(`benchmarks/v2/${slug}/workload.js`),
          mediaType: "text/javascript",
        }
        : {
          id: `${slug}-wasm-linear-wasm`,
          ...await fileRefGit(wasmPath),
          mediaType: "application/wasm",
        };
      const referenceArtifact = {
        id: `${slug}-reference-f64`,
        ...await fileRefGit(referencePath),
        mediaType: "application/octet-stream",
      };
      const boundsArtifact = {
        id: `${slug}-bounds-f32`,
        ...await fileRefGit(boundsPath),
        mediaType: "application/octet-stream",
      };
      const artifacts = [payloadArtifact, referenceArtifact, boundsArtifact];
      const sources = [jsSource, wasmSource, denoSupport, ...extraSources];
      const refs = [
        catalogFile,
        workloadContractFile,
        resultContractFile,
        ...sources,
        generator,
        reference,
        fixture,
        input,
        output,
        recipe,
        lock,
        ...artifacts,
      ];
      const resourcePaths = [...new Set(refs.map((item) => item.path))].sort();
      const record = {
        schemaVersion: 1,
        contractId: "workload-result-v2-proposal-v1",
        status: "proposal-validation-only",
        workloadCatalog: { catalogId: catalog.catalogId, file: catalogFile },
        workloadContract: {
          contractId: catalog.workloadContract.contractId,
          file: workloadContractFile,
        },
        resultContract: {
          contractId: catalog.resultContract.contractId,
          file: resultContractFile,
        },
        source: { repository, commit },
        workload: {
          entryId: entry.id,
          benchmarkSlug: slug,
          variant: {
            id: variant.id,
            target: variant.target,
            track: controlled.track,
            algorithmFamilyId: variant.algorithmFamilyId,
          },
        },
        provenance: {
          sources,
          generator,
          reference,
          oracle: output,
          manifests: { fixture, input, output },
          build: {
            recipe,
            cwd: ".",
            command: [
              "deno",
              "run",
              "--allow-read=.",
              "--allow-write=artifacts",
              "--allow-env=WASM_VS_JS_COMMIT",
              "--allow-run",
              "scripts/build-v2-neural.ts",
              "records",
            ],
            locks: [lock],
            toolchain: [
              { name: "deno", version: Deno.version.deno },
              { name: "typescript", version: Deno.version.typescript },
            ],
            flags: {
              compiler: ["wabt canonicalize_lebs=true", "write_debug_names=false"],
              linker: [],
              runtime: [
                "--allow-read=.",
                "--allow-write=artifacts",
                "--allow-env=WASM_VS_JS_COMMIT",
                "--allow-run",
              ],
            },
            environment: [{ name: "WASM_VS_JS_COMMIT", value: commit }],
          },
          artifacts,
        },
        semanticCoverage: {
          inputParameterIds: entry.input.parameters.map((parameter: { name: string }) =>
            parameter.name
          ),
          oracleCheckIds: entry.oracle.checks.map((check: { id: string }) => check.id),
          workCounterIds: [...entry.work.counters],
          phaseIds: Object.keys(entry.phases),
          missingCellIds: entry.missingCells.map((cell: { cell: string }) => cell.cell),
        },
        collisionGuards: {
          workloadVariantKey: `${entry.id}/${variant.id}`,
          algorithmIdentityKey: variant.algorithmFamilyId,
          resourcePaths,
          artifactIds: artifacts.map((item) => item.id),
        },
        correctness: {
          // Only reached after verifyManifestEvidence confirmed every
          // catalog check id was executed, all structural checks passed,
          // all recorded bound ratios are below 1, and recorded counters
          // equal the analytic counters.
          status: "passed",
          oracleCheckIds: entry.oracle.checks.map((check: { id: string }) => check.id),
          outputManifestSha256: output.sha256,
        },
        performanceClaims: [],
      };
      if (record.provenance.oracle.sha256 !== record.provenance.manifests.output.sha256) {
        throw new Error("oracle reference is not the output manifest");
      }
      await writeJson(outDir, `${variant.id}.result.json`, record);
      console.log(`build: ${slug}/${variant.id}.result.json recorded`);
    }
  }
}

if (mode === "artifacts") {
  await buildGemmArtifacts();
  await buildMlpArtifacts();
} else {
  await buildRecords();
}
await fmtWrittenJson();
