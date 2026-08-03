import { BrowserPermit } from "./browser-permit.ts";
import { canonicalize, sha256Hex } from "./canonical.ts";
import {
  assertBenchmarkSchema,
  assertBuildManifestSchema,
  assertCollectorHealthSchema,
  assertPreregistrationSchema,
  assertSourceManifestSchema,
} from "./corpus-contracts.ts";
import { LaunchManifest, validateLaunchManifest } from "./corpus-store.ts";
import { collectorRouteHashes, FROZEN_PREREGISTRATION_SHA256 } from "./source-identity.ts";

export type CheckedSource = {
  sourceCommit: string;
  sourceManifestSha256: string;
  sourceFiles: Record<string, string>;
};

export type FrozenCollectionManifests = {
  preregistration: Record<string, unknown>;
  schedule: Array<{
    blockId: string;
    stratum: "cold" | "warm";
    order: LaunchManifest["order"];
  }>;
  collectorHashes: Record<string, string>;
};

async function exactFile(
  path: string,
  expected: { bytes?: unknown; sha256?: unknown },
): Promise<void> {
  const bytes = await Deno.readFile(path);
  if (expected.bytes !== undefined && bytes.length !== expected.bytes) {
    throw new Error(`manifest file size mismatch: ${path}`);
  }
  if (expected.sha256 !== undefined && await sha256Hex(bytes) !== expected.sha256) {
    throw new Error(`manifest file hash mismatch: ${path}`);
  }
}

export async function validateFrozenCollectionManifests(
  checked: CheckedSource,
): Promise<FrozenCollectionManifests> {
  const sourceArtifact = {
    sourceCommit: checked.sourceCommit,
    files: checked.sourceFiles,
    sha256: checked.sourceManifestSha256,
  };
  assertSourceManifestSchema(sourceArtifact);

  const preregistrationBytes = await Deno.readFile(
      "experiments/m1-chrome-sum-u32-v1/preregistration.json",
    ),
    publicPreregistrationBytes = await Deno.readFile(
      "public/experiments/m1-chrome-sum-u32-v1.json",
    ),
    preregistration = JSON.parse(new TextDecoder().decode(preregistrationBytes));
  assertPreregistrationSchema(preregistration);
  if (
    await sha256Hex(canonicalize(preregistration)) !== FROZEN_PREREGISTRATION_SHA256 ||
    await sha256Hex(preregistrationBytes) !== await sha256Hex(publicPreregistrationBytes)
  ) throw new Error("frozen preregistration identity mismatch");

  const benchmark = JSON.parse(await Deno.readTextFile("benchmarks/sum-u32/benchmark.json"));
  const build = JSON.parse(
    await Deno.readTextFile("public/artifacts/sum-u32/build-manifest.json"),
  );
  assertBenchmarkSchema(benchmark);
  assertBuildManifestSchema(build);
  for (const entry of build.sources as Array<{ path: string; bytes: number; sha256: string }>) {
    await exactFile(entry.path, entry);
  }
  for (const entry of build.lockfiles as Array<{ name: string; sha256: string }>) {
    await exactFile(entry.name, entry);
  }
  const variants = build.variants as Record<
    string,
    { sha256: string; source?: string; artifact?: string }
  >;
  await exactFile(String(variants["js-controlled"].source), variants["js-controlled"]);
  await exactFile(
    String(variants["wasm-linear-controlled"].artifact),
    variants["wasm-linear-controlled"],
  );
  const benchmarkVariants = benchmark.variants as Array<Record<string, unknown>>;
  if (
    benchmark.id !== build.benchmarkId || benchmark.version !== build.benchmarkVersion ||
    benchmark.track !== undefined ||
    benchmark.inputs.manifestSha256 !== build.input.sha256 ||
    benchmarkVariants.some((variant) =>
      variant.buildManifest !== "public/artifacts/sum-u32/build-manifest.json" ||
      variants[String(variant.id)] === undefined
    )
  ) throw new Error("benchmark/build manifest identity mismatch");

  const collectorHashes = await collectorRouteHashes();
  if (
    collectorHashes["/benchmarks/sum-u32/workload.js"] !== variants["js-controlled"].sha256 ||
    collectorHashes["/artifacts/sum-u32/sum-u32.wasm"] !== variants["wasm-linear-controlled"].sha256
  ) throw new Error("collector artifact manifest hash mismatch");
  const schedule = preregistration.pairing.schedule as FrozenCollectionManifests["schedule"];
  if (schedule.length !== 120) throw new Error("frozen launch schedule length mismatch");
  return { preregistration, schedule, collectorHashes };
}

export async function verifyCollectorOrigin(
  permit: BrowserPermit,
  expectedHashes: Record<string, string>,
  fetcher: typeof fetch = fetch,
): Promise<void> {
  const healthUrl = `${permit.origin}/healthz`;
  const response = await fetcher(healthUrl, { redirect: "error", cache: "no-store" });
  if (!response.ok || response.url !== healthUrl) throw new Error("local origin health denied");
  const health = await response.json();
  assertCollectorHealthSchema(health);
  if (
    health.localCheckoutCommit !== permit.sourceCommit ||
    canonicalize(health.collectorAssets) !== canonicalize(expectedHashes)
  ) throw new Error("local origin source identity mismatch");
  for (const [route, expectedHash] of Object.entries(expectedHashes)) {
    const url = `${permit.origin}${route}`;
    const asset = await fetcher(url, { redirect: "error", cache: "no-store" });
    if (
      !asset.ok || asset.url !== url ||
      await sha256Hex(new Uint8Array(await asset.arrayBuffer())) !== expectedHash
    ) {
      throw new Error(`collector asset identity mismatch: ${route}`);
    }
  }
}

export function validateScheduledLaunchManifest(
  manifest: LaunchManifest,
  permit: BrowserPermit,
  schedule: FrozenCollectionManifests["schedule"],
  now = new Date(),
): void {
  validateLaunchManifest(manifest, now);
  const scheduled = schedule[manifest.scheduleIndex];
  if (
    manifest.corpusId !== `m1-${permit.permitId}` || !scheduled ||
    manifest.blockId !== scheduled.blockId || manifest.stratum !== scheduled.stratum ||
    canonicalize(manifest.order) !== canonicalize(scheduled.order) ||
    Date.parse(manifest.expiresAt) > Date.parse(permit.expiresAt)
  ) throw new Error("launch manifest permit/schedule identity mismatch");
}
