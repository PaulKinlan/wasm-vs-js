// deno-lint-ignore-file no-explicit-any
import { AUDIO_COUNTERS } from "../../lib/audio-workloads.ts";
import { sha256Hex } from "./canonical.ts";
import { AUDIO_FROZEN_HASHES, AUDIO_MEMORY_PAGES, type AudioSlug } from "./constants.ts";

export interface AudioManifestBundle {
  fixture: Record<string, any>;
  input: Record<string, any>;
  reference: Record<string, any>;
  output: Record<string, any>;
  build: Record<string, any>;
}

function same(actual: unknown, expected: unknown): boolean {
  return JSON.stringify(actual) === JSON.stringify(expected);
}

export async function validateAudioManifestSemantics(
  slug: AudioSlug,
  bundle: AudioManifestBundle,
  catalog: Record<string, any>,
  options: { repoRoot?: string; readFile?: (path: string) => Promise<Uint8Array> } = {},
): Promise<{ ok: boolean; errors: string[] }> {
  const errors: string[] = [];
  const entry = catalog.entries?.find((candidate: Record<string, any>) =>
    candidate.benchmarkSlug === slug
  );
  if (!entry) return { ok: false, errors: [`catalog entry missing for ${slug}`] };
  const manifests = [bundle.fixture, bundle.input, bundle.reference, bundle.output, bundle.build];
  for (const manifest of manifests) {
    if (manifest.entryId !== entry.id || manifest.benchmarkSlug !== slug) {
      errors.push("audio manifest identity contradicts catalog");
    }
  }
  const implementationCommit = bundle.build.sourceCommit;
  if (!/^[a-f0-9]{40}$/.test(implementationCommit ?? "")) {
    errors.push("build implementation commit is not typed");
  }
  for (const manifest of manifests.slice(0, 4)) {
    if (manifest.sourceCommit !== implementationCommit) {
      errors.push("audio manifest implementation commits disagree");
    }
  }

  const generator = entry.input.generator;
  if (
    bundle.fixture.generator?.algorithm !== generator.algorithm ||
    bundle.fixture.generator?.seed !== generator.seed ||
    bundle.fixture.generator?.revision !== generator.revision
  ) {
    errors.push("fixture generator identity contradicts catalog");
  }
  if (!same(bundle.input.fields, entry.input.parameters)) {
    errors.push("input parameter fields contradict catalog");
  }
  if (
    bundle.input.sha256 !== AUDIO_FROZEN_HASHES[slug].inputSha256 ||
    bundle.input.byteLength !== AUDIO_COUNTERS[slug]["input-bytes"]
  ) {
    errors.push("input manifest contradicts frozen canonical input");
  }
  const tolerance = entry.oracle.tolerance;
  if (
    bundle.reference.sha256 !== AUDIO_FROZEN_HASHES[slug].referenceSha256 ||
    bundle.reference.byteLength !== AUDIO_COUNTERS[slug]["output-bytes"] ||
    bundle.reference.components * 4 !== bundle.reference.byteLength ||
    bundle.reference.tolerance?.absolute !== tolerance.absolute ||
    bundle.reference.tolerance?.relative !== tolerance.relative
  ) {
    errors.push("reference manifest contradicts accepted complete oracle");
  }
  if (
    bundle.output.sha256 !== AUDIO_FROZEN_HASHES[slug].outputSha256 ||
    bundle.output.byteLength !== AUDIO_COUNTERS[slug]["output-bytes"]
  ) {
    errors.push("output manifest contradicts frozen controlled output");
  }

  const expectedCheckIds = entry.oracle.checks.map((check: { id: string }) => check.id);
  for (const variantId of ["js-controlled", "wasm-linear-controlled"]) {
    const variant = bundle.output.variants?.[variantId];
    const executedIds = Object.entries(variant?.oracleChecks ?? {})
      .filter(([, check]) => (check as { status?: string }).status === "passed")
      .map(([id]) => id);
    if (
      variant?.status !== "passed" ||
      !same(executedIds, expectedCheckIds) ||
      variant.referenceSha256 !== bundle.reference.sha256 ||
      variant.oracleChecks?.["complete-output-bound"]?.metrics?.comparedComponents !==
        bundle.reference.components ||
      variant.workCounterGate?.status !== "passed" ||
      !same(variant.workCounters, AUDIO_COUNTERS[slug])
    ) {
      errors.push(`${variantId} has contradictory or incomplete executed gates`);
    }
  }

  const expectedManifestPaths = {
    fixture: `public/artifacts/${slug}/fixture-manifest.json`,
    input: `public/artifacts/${slug}/input-manifest.json`,
    reference: `public/artifacts/${slug}/reference-manifest.json`,
    output: `public/artifacts/${slug}/output-manifest.json`,
  };
  for (const [name, path] of Object.entries(expectedManifestPaths)) {
    if (bundle.build.manifests?.[name]?.path !== path) {
      errors.push(`build manifest path contradicts ${name} manifest`);
    }
  }
  if (
    bundle.build.referenceArtifact?.path !== bundle.reference.artifact ||
    bundle.build.referenceArtifact?.sha256 !== bundle.reference.sha256 ||
    bundle.build.referenceArtifact?.bytes !== bundle.reference.byteLength
  ) {
    errors.push("build reference artifact contradicts reference manifest");
  }
  const features = bundle.build.variants?.["wasm-linear-controlled"]?.features;
  if (
    features?.initialPages !== AUDIO_MEMORY_PAGES[slug] ||
    features?.maximumPages !== AUDIO_MEMORY_PAGES[slug] ||
    features?.memoryGrowth !== false
  ) {
    errors.push("build memory features contradict fixed memory contract");
  }
  const sourcePaths =
    bundle.build.fullSourceGraph?.map((source: { path: string }) => source.path) ?? [];
  if (new Set(sourcePaths).size !== sourcePaths.length) {
    errors.push("build source graph contains path collisions");
  }

  const readFile = options.readFile ?? ((path: string) => Deno.readFile(path));
  const root = String(options.repoRoot ?? ".").replace(/\/$/, "");
  try {
    const referenceBytes = await readFile(`${root}/${bundle.reference.artifact}`);
    if (
      referenceBytes.byteLength !== bundle.reference.byteLength ||
      await sha256Hex(referenceBytes) !== bundle.reference.sha256
    ) {
      errors.push("persisted reference artifact contradicts reference manifest");
    }
    for (const [name, path] of Object.entries(expectedManifestPaths)) {
      const bytes = await readFile(`${root}/${path}`);
      if (await sha256Hex(bytes) !== bundle.build.manifests[name].sha256) {
        errors.push(`build hash contradicts ${name} manifest`);
      }
    }
  } catch {
    errors.push("audio persisted manifest or reference artifact is not readable");
  }

  return { ok: errors.length === 0, errors };
}
