import { sha256Hex } from "../lib/canonical.ts";
import type { AudioSlug } from "../benchmarks/audio-shared/constants.ts";

const root = new URL("../", import.meta.url);
const repository = "https://github.com/PaulKinlan/wasm-vs-js";
const slugs: AudioSlug[] = ["audio-fft", "audio-fir", "audio-stft"];
const variants = [
  { id: "js-controlled", target: "javascript" },
  { id: "wasm-linear-controlled", target: "wasm-linear" },
] as const;
const sourceCommitArgument = Deno.args.find((argument) => argument.startsWith("--source-commit="));
const sourceCommit = sourceCommitArgument?.slice("--source-commit=".length) ?? "";
if (!/^[a-f0-9]{40}$/.test(sourceCommit)) {
  throw new Error("--source-commit=<40 lowercase hex Git commit> is required");
}
const revParse = await new Deno.Command("git", {
  args: ["rev-parse", "HEAD"],
  cwd: root.pathname,
  stdout: "piped",
  stderr: "piped",
}).output();
if (!revParse.success) throw new Error(new TextDecoder().decode(revParse.stderr));
const checkoutCommit = new TextDecoder().decode(revParse.stdout).trim();
if (checkoutCommit !== sourceCommit) {
  throw new Error(`source commit ${sourceCommit} does not match checkout ${checkoutCommit}`);
}

const catalog = JSON.parse(
  await Deno.readTextFile(new URL("catalog/workloads.v2.proposed.json", root)),
);

async function ref(path: string) {
  const bytes = await Deno.readFile(new URL(path, root));
  return {
    path,
    sha256: await sha256Hex(bytes),
    immutableUrl: `${repository}/blob/${sourceCommit}/${path}`,
  };
}

function uniquePaths(references: Array<{ path: string }>): string[] {
  return [...new Set(references.map((reference) => reference.path))].sort();
}

for (const slug of slugs) {
  const entry = catalog.entries.find((candidate: { benchmarkSlug: string }) =>
    candidate.benchmarkSlug === slug
  );
  if (!entry) throw new Error(`catalog entry missing for ${slug}`);
  const buildManifestPath = `public/artifacts/${slug}/build-manifest.json`;
  const buildManifest = JSON.parse(await Deno.readTextFile(new URL(buildManifestPath, root)));
  const sourceReferences = await Promise.all(
    buildManifest.fullSourceGraph.map(async (source: { path: string }) => ({
      role: source.path === `benchmarks/${slug}/workload.ts`
        ? "javascript-authored"
        : source.path === `benchmarks/${slug}/${slug}.wat`
        ? "wasm-authored"
        : "shared-support",
      ...await ref(source.path),
    })),
  );
  const workloadCatalog = await ref("catalog/workloads.v2.proposed.json");
  const workloadContract = await ref("benchmarks/v2/shared/workload-contract.js");
  const resultContract = await ref("schemas/workload-result-v2-proposal.schema.json");
  const generator = await ref("scripts/build-audio-results.ts");
  const reference = await ref("benchmarks/audio-shared/reference.ts");
  const oracle = await ref("benchmarks/audio-shared/oracle.ts");
  const fixtureManifest = await ref(`public/artifacts/${slug}/fixture-manifest.json`);
  const inputManifest = await ref(`public/artifacts/${slug}/input-manifest.json`);
  const referenceManifest = await ref(`public/artifacts/${slug}/reference-manifest.json`);
  const outputManifest = await ref(`public/artifacts/${slug}/output-manifest.json`);
  const buildManifestReference = await ref(buildManifestPath);
  const referenceArtifact = {
    id: `${slug}-pinned-f64-reference`,
    ...await ref(`public/artifacts/${slug}/reference-output.f32le`),
    mediaType: "application/octet-stream",
  };
  const outputEvidence = JSON.parse(
    await Deno.readTextFile(new URL(`public/artifacts/${slug}/output-manifest.json`, root)),
  );
  const recipe = await ref("scripts/build-audio.ts");
  const lock = await ref("deno.lock");

  for (const variant of variants) {
    const catalogTrack = entry.tracks.find((track: { variants: Array<{ id: string }> }) =>
      track.variants.some((candidate) => candidate.id === variant.id)
    );
    const catalogVariant = catalogTrack?.variants.find((candidate: { id: string }) =>
      candidate.id === variant.id
    );
    if (!catalogVariant || catalogVariant.target !== variant.target) {
      throw new Error(`${slug}/${variant.id} catalog identity mismatch`);
    }
    const artifact = variant.target === "javascript"
      ? {
        id: `${slug}-js-controlled-source`,
        ...await ref(`benchmarks/${slug}/workload.ts`),
        mediaType: "application/typescript",
      }
      : {
        id: `${slug}-wasm-linear-controlled`,
        ...await ref(`public/artifacts/${slug}/${slug}.wasm`),
        mediaType: "application/wasm",
      };
    const variantEvidence = outputEvidence.variants[variant.id];
    const executedOracleCheckIds = Object.entries(variantEvidence?.oracleChecks ?? {})
      .filter(([, value]) => (value as { status?: string }).status === "passed")
      .map(([id]) => id);
    const expectedOracleCheckIds = entry.oracle.checks.map((check: { id: string }) => check.id);
    if (
      variantEvidence?.status !== "passed" ||
      JSON.stringify(executedOracleCheckIds) !== JSON.stringify(expectedOracleCheckIds)
    ) {
      throw new Error(`${slug}/${variant.id} has incomplete executed oracle evidence`);
    }
    const allReferences = [
      workloadCatalog,
      workloadContract,
      resultContract,
      ...sourceReferences,
      generator,
      reference,
      oracle,
      fixtureManifest,
      inputManifest,
      referenceManifest,
      outputManifest,
      buildManifestReference,
      recipe,
      lock,
      artifact,
      referenceArtifact,
    ];
    const record = {
      schemaVersion: 1,
      contractId: "workload-result-v2-proposal-v1",
      status: "proposal-validation-only",
      workloadCatalog: {
        catalogId: catalog.catalogId,
        file: workloadCatalog,
      },
      workloadContract: {
        contractId: catalog.workloadContract.contractId,
        file: workloadContract,
      },
      resultContract: {
        contractId: catalog.resultContract.contractId,
        file: resultContract,
      },
      source: { repository, commit: sourceCommit },
      workload: {
        entryId: entry.id,
        benchmarkSlug: slug,
        variant: {
          id: catalogVariant.id,
          target: catalogVariant.target,
          track: catalogTrack.track,
          algorithmFamilyId: catalogVariant.algorithmFamilyId,
        },
      },
      provenance: {
        sources: sourceReferences,
        generator,
        reference,
        oracle,
        manifests: {
          fixture: fixtureManifest,
          input: inputManifest,
          reference: referenceManifest,
          output: outputManifest,
          build: buildManifestReference,
        },
        build: {
          recipe,
          cwd: buildManifest.build.cwd,
          command: buildManifest.build.command,
          locks: [lock],
          toolchain: buildManifest.build.toolchain,
          flags: buildManifest.build.flags,
          environment: buildManifest.build.environment,
        },
        artifacts: [artifact, referenceArtifact],
      },
      semanticCoverage: {
        inputParameterIds: entry.input.parameters.map((parameter: { name: string }) =>
          parameter.name
        ),
        oracleCheckIds: entry.oracle.checks.map((check: { id: string }) => check.id),
        workCounterIds: entry.work.counters,
        phaseIds: Object.keys(entry.phases),
        missingCellIds: entry.missingCells.map((cell: { cell: string }) => cell.cell),
      },
      collisionGuards: {
        workloadVariantKey: `${entry.id}/${catalogVariant.id}`,
        algorithmIdentityKey: catalogVariant.algorithmFamilyId,
        resourcePaths: uniquePaths(allReferences),
        artifactIds: [artifact.id, referenceArtifact.id],
      },
      correctness: {
        status: "passed",
        oracleCheckIds: executedOracleCheckIds,
        outputManifestSha256: outputManifest.sha256,
      },
      performanceClaims: [],
    };
    const outputDir = new URL(`public/evidence/v2-proposals/${slug}/`, root);
    await Deno.mkdir(outputDir, { recursive: true });
    await Deno.writeTextFile(
      new URL(`${variant.id}.json`, outputDir),
      `${JSON.stringify(record, null, 2)}\n`,
    );
    console.log(`${slug}/${variant.id}: provenance record for ${sourceCommit}`);
  }
}
