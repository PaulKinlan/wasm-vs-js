import { canonicalize, sha256Hex } from "./canonical.ts";

export const FROZEN_PREREGISTRATION_SHA256 =
  "90ddcc1703d158f34153f2c0d566fb7126f3599c4d848d109cb3ef8a42c2e6dc";
export const EXECUTED_SOURCE_PATHS = [
  "server.ts",
  "deno.corpus.json",
  "scripts/run-m1-chrome-corpus.ts",
  "scripts/remove-owned-file.py",
  "scripts/remove-owned-tree.py",
  "scripts/write-stage-owner.py",
  "lib/browser-permit.ts",
  "lib/canonical.ts",
  "lib/cdp-client.ts",
  "lib/chrome-evidence.ts",
  "lib/chrome-provenance.ts",
  "lib/chrome-stage.ts",
  "lib/collection-preflight.ts",
  "lib/corpus-contracts.ts",
  "lib/corpus-store.ts",
  "lib/corpus-validation.ts",
  "lib/host-provenance.ts",
  "lib/owned-chrome.ts",
  "lib/paired-statistics.ts",
  "lib/process-ledger.ts",
  "lib/source-identity.ts",
  "lib/stage-lifecycle.ts",
  "local/corpus-run.html",
  "local/corpus-run.js",
  "public/styles.css",
  "public/hosted-runner-core.js",
  "public/hosted-runner-worker.js",
  "benchmarks/sum-u32/benchmark.json",
  "benchmarks/sum-u32/workload.js",
  "public/artifacts/sum-u32/build-manifest.json",
  "public/artifacts/sum-u32/sum-u32.wasm",
  "schemas/attempt-record.schema.json",
  "schemas/benchmark.schema.json",
  "schemas/browser-permit.schema.json",
  "schemas/build-manifest.schema.json",
  "schemas/chrome-package-manifest.schema.json",
  "schemas/collection-stop.schema.json",
  "schemas/collector-health.schema.json",
  "schemas/corpus.schema.json",
  "schemas/launch-evidence.schema.json",
  "schemas/launch-manifest.schema.json",
  "schemas/network-attestation.schema.json",
  "schemas/paired-block.schema.json",
  "schemas/permit-receipt.schema.json",
  "schemas/prelaunch-failure.schema.json",
  "schemas/preregistration.schema.json",
  "schemas/source-manifest.schema.json",
  "schemas/stage-owner.schema.json",
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
const GENERATED_RAW_ROOTS = ["raw/permits", "raw/corpora"] as const;

export function assertCheckoutStatus(status: string): void {
  const entries = status.split("\0").filter(Boolean);
  for (const entry of entries) {
    const state = entry.slice(0, 2), path = entry.slice(3);
    const allowed = state === "!!" &&
      (path === ".pi-subagents/" ||
        path.startsWith("raw/m1-pilot-evidence") ||
        path.startsWith("raw/screenshots") ||
        GENERATED_RAW_ROOTS.some((root) =>
          path === root || path === `${root}/` || path.startsWith(`${root}/`)
        ));
    if (!allowed) throw new Error(`collection requires a clean checkout: ${path || "unknown"}`);
  }
}

export async function assertGeneratedTreeSafe(path: string): Promise<void> {
  let root: Deno.FileInfo;
  try {
    root = await Deno.lstat(path);
  } catch (error) {
    if (error instanceof Deno.errors.NotFound) return;
    throw error;
  }
  if (root.isSymlink || !root.isDirectory || await Deno.realPath(path) !== path) {
    throw new Error(`unsafe generated raw root: ${path}`);
  }
  async function visit(directory: string): Promise<void> {
    for await (const entry of Deno.readDir(directory)) {
      const childPath = `${directory}/${entry.name}`, info = await Deno.lstat(childPath);
      if (info.isSymlink || (!info.isDirectory && !info.isFile)) {
        throw new Error(`unsafe generated raw entry: ${childPath}`);
      }
      if (info.isDirectory) await visit(childPath);
    }
  }
  await visit(path);
}

export async function assertCleanCheckout(expectedCommit: string): Promise<void> {
  const head = await command(["rev-parse", "HEAD"]);
  if (head !== expectedCommit) throw new Error("permit source commit does not match HEAD");
  const output = await new Deno.Command("git", {
    args: ["status", "--porcelain=v1", "-z", "--untracked-files=all", "--ignored=matching"],
    stdout: "piped",
    stderr: "piped",
  }).output();
  if (!output.success) throw new Error("git status failed");
  assertCheckoutStatus(new TextDecoder().decode(output.stdout));
  const cwd = await Deno.realPath(Deno.cwd());
  for (const root of GENERATED_RAW_ROOTS) await assertGeneratedTreeSafe(`${cwd}/${root}`);
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
