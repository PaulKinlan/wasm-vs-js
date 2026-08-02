import { canonicalize, sha256Hex } from "./canonical.ts";

export const FROZEN_PREREGISTRATION_SHA256 =
  "d13aed9404ec289046f885f79a1d7b9f04923d2264de22b1fee60a4e7a8d6f61";
export const EXECUTED_SOURCE_PATHS = [
  "server.ts",
  "deno.corpus.json",
  "scripts/run-m1-chrome-corpus.ts",
  "lib/browser-permit.ts",
  "lib/canonical.ts",
  "lib/cdp-client.ts",
  "lib/chrome-evidence.ts",
  "lib/chrome-provenance.ts",
  "lib/corpus-contracts.ts",
  "lib/corpus-store.ts",
  "lib/corpus-validation.ts",
  "lib/host-provenance.ts",
  "lib/owned-chrome.ts",
  "lib/paired-statistics.ts",
  "lib/process-ledger.ts",
  "lib/source-identity.ts",
  "local/corpus-run.html",
  "local/corpus-run.js",
  "public/styles.css",
  "public/hosted-runner-core.js",
  "public/hosted-runner-worker.js",
  "benchmarks/sum-u32/benchmark.json",
  "benchmarks/sum-u32/workload.js",
  "public/artifacts/sum-u32/build-manifest.json",
  "public/artifacts/sum-u32/sum-u32.wasm",
  "schemas/browser-permit.schema.json",
  "schemas/corpus.schema.json",
  "schemas/launch-evidence.schema.json",
  "schemas/network-attestation.schema.json",
  "schemas/paired-block.schema.json",
  "experiments/m1-chrome-sum-u32-v1/preregistration.json",
  "public/experiments/m1-chrome-sum-u32-v1.json",
] as const;
export const COLLECTOR_ROUTES: Record<string, string> = {
  "/corpus-run": "local/corpus-run.html",
  "/corpus-run.js": "local/corpus-run.js",
  "/styles.css": "public/styles.css",
  "/hosted-runner-core.js": "public/hosted-runner-core.js",
  "/hosted-runner-worker.js": "public/hosted-runner-worker.js",
  "/benchmarks/sum-u32/workload.js": "benchmarks/sum-u32/workload.js",
  "/artifacts/sum-u32/build-manifest.json": "public/artifacts/sum-u32/build-manifest.json",
  "/artifacts/sum-u32/sum-u32.wasm": "public/artifacts/sum-u32/sum-u32.wasm",
};
async function command(args: string[]): Promise<string> {
  const out = await new Deno.Command("git", { args, stdout: "piped", stderr: "piped" }).output();
  if (!out.success) throw new Error(`git ${args[0]} failed`);
  return new TextDecoder().decode(out.stdout).trim();
}
export async function assertCleanCheckout(expectedCommit: string): Promise<void> {
  const head = await command(["rev-parse", "HEAD"]);
  if (head !== expectedCommit) throw new Error("permit source commit does not match HEAD");
  const dirty = await command(["status", "--porcelain=v1", "--untracked-files=all"]);
  if (dirty) throw new Error("collection requires a clean checkout");
}
export async function fileHashes(paths: readonly string[]): Promise<Record<string, string>> {
  const entries = await Promise.all(
    paths.map(async (path) => [path, await sha256Hex(await Deno.readFile(path))] as const),
  );
  return Object.fromEntries(entries);
}
export async function sourceManifest(
  expectedCommit: string,
): Promise<{ sourceCommit: string; files: Record<string, string>; sha256: string }> {
  await assertCleanCheckout(expectedCommit);
  const files = await fileHashes(EXECUTED_SOURCE_PATHS);
  const prereg = JSON.parse(
    await Deno.readTextFile("experiments/m1-chrome-sum-u32-v1/preregistration.json"),
  );
  const publicPrereg = await Deno.readFile("public/experiments/m1-chrome-sum-u32-v1.json");
  const canonical = await sha256Hex(canonicalize(prereg));
  if (canonical !== FROZEN_PREREGISTRATION_SHA256) {
    throw new Error("frozen preregistration digest mismatch");
  }
  if (
    await sha256Hex(
      await Deno.readFile("experiments/m1-chrome-sum-u32-v1/preregistration.json"),
    ) !== await sha256Hex(publicPrereg)
  ) throw new Error("public preregistration copy mismatch");
  const body = { sourceCommit: expectedCommit, files };
  return { ...body, sha256: await sha256Hex(canonicalize(body)) };
}
export async function collectorRouteHashes(): Promise<Record<string, string>> {
  const result: Record<string, string> = {};
  for (const [route, path] of Object.entries(COLLECTOR_ROUTES)) {
    result[route] = await sha256Hex(await Deno.readFile(path));
  }
  return result;
}
