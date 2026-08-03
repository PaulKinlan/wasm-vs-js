import { canonicalize, sha256Hex } from "./canonical.ts";
import { assertLaunchManifestSchema, assertPairedBlockSchema } from "./corpus-contracts.ts";

async function assertPrivateDirectory(path: string): Promise<void> {
  const info = await Deno.lstat(path);
  if (info.isSymlink || !info.isDirectory || await Deno.realPath(path) !== path) {
    throw new Error(`unsafe immutable artifact directory: ${path}`);
  }
  if (info.mode !== null && (info.mode & 0o077) !== 0) {
    throw new Error(`artifact directory is not private: ${path}`);
  }
}
async function ensurePrivateTree(directory: string): Promise<void> {
  const cwd = await Deno.realPath(Deno.cwd());
  const absolute = directory.startsWith("/") ? directory : `${cwd}/${directory}`;
  const anchor = absolute.startsWith(`${cwd}/raw/permits/`) || absolute === `${cwd}/raw/permits`
    ? `${cwd}/raw/permits`
    : absolute.startsWith(`${cwd}/raw/corpora/`) || absolute === `${cwd}/raw/corpora`
    ? `${cwd}/raw/corpora`
    : absolute.startsWith("/tmp/")
    ? `/tmp/${absolute.slice(5).split("/")[0]}`
    : (() => {
      throw new Error("immutable artifact root denied");
    })();
  const suffix = absolute.slice(anchor.length).split("/").filter(Boolean);
  await Deno.mkdir(anchor, { mode: 0o700 }).catch((error) => {
    if (!(error instanceof Deno.errors.AlreadyExists)) throw error;
  });
  await assertPrivateDirectory(anchor);
  let current = anchor;
  for (const part of suffix) {
    if (!/^[A-Za-z0-9._-]+$/.test(part)) throw new Error("unsafe artifact path component");
    current += `/${part}`;
    await Deno.mkdir(current, { mode: 0o700 }).catch((error) => {
      if (!(error instanceof Deno.errors.AlreadyExists)) throw error;
    });
    await assertPrivateDirectory(current);
  }
}
export type VariantRecord = {
  variantId: "js-controlled" | "wasm-linear-controlled";
  payloadSha256: string;
  medianMs: number;
  samples: number[];
};
export type PairInput = {
  schemaVersion: 1;
  corpusId: string;
  blockId: string;
  experimentId: "m1-chrome-sum-u32-v1";
  scheduleIndex: number;
  stratum: "cold" | "warm";
  order: ["js-controlled" | "wasm-linear-controlled", "js-controlled" | "wasm-linear-controlled"];
  records: VariantRecord[];
  launchEvidenceSha256: string;
  workerResultSha256: string;
  cleanup: { complete: boolean; remainingPids: number[]; profileRemoved: boolean };
};
export async function commitPairedBlock(
  root: string,
  input: PairInput,
): Promise<{ path: string; sha256: string }> {
  if (
    !/^[a-z0-9][a-z0-9._-]{1,127}$/.test(input.corpusId) ||
    !/^[a-z0-9][a-z0-9._-]{1,127}$/.test(input.blockId) ||
    input.records.length !== 2 ||
    new Set(input.records.map((x) => x.variantId)).size !== 2
  ) throw new Error("complete distinct pair required");
  if (input.order.join(",") !== input.records.map((x) => x.variantId).join(",")) {
    throw new Error("pair order mismatch");
  }
  if (
    !input.cleanup.complete || input.cleanup.remainingPids.length || !input.cleanup.profileRemoved
  ) throw new Error("cleanup incomplete");
  if (
    !/^[a-f0-9]{64}$/.test(input.launchEvidenceSha256) ||
    !/^[a-f0-9]{64}$/.test(input.workerResultSha256) ||
    input.records.some((x) =>
      !/^[a-f0-9]{64}$/.test(x.payloadSha256) || !Number.isFinite(x.medianMs) || x.medianMs <= 0 ||
      !x.samples.length || x.samples.some((v) => !Number.isFinite(v) || v <= 0) ||
      x.medianMs !== median(x.samples)
    )
  ) throw new Error("pair evidence invalid");
  const dir = `${root}/blocks`;
  await ensurePrivateTree(dir);
  const path = `${dir}/${input.blockId}.json`;
  const committed = { ...input, committed: true as const };
  assertPairedBlockSchema(committed);
  const body = canonicalize(committed);
  const sha256 = await sha256Hex(body);
  const handle = await Deno.open(path, { write: true, createNew: true, mode: 0o600 });
  try {
    await handle.write(new TextEncoder().encode(body + "\n"));
    handle.sync();
  } finally {
    handle.close();
  }
  return { path, sha256 };
}
function median(values: number[]): number {
  const sorted = [...values].sort((a, b) => a - b), middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2;
}

export async function writeImmutableArtifact(
  path: string,
  value: Uint8Array | string,
): Promise<{ sha256: string; bytes: number }> {
  const bytes = typeof value === "string" ? new TextEncoder().encode(value) : value;
  const cwd = await Deno.realPath(Deno.cwd());
  const absolutePath = path.startsWith("/") ? path : `${cwd}/${path}`;
  const directory = absolutePath.slice(0, absolutePath.lastIndexOf("/"));
  await ensurePrivateTree(directory);
  await assertPrivateDirectory(directory);
  const h = await Deno.open(absolutePath, { write: true, createNew: true, mode: 0o600 });
  try {
    await h.write(bytes);
    h.sync();
  } finally {
    h.close();
  }
  return { sha256: await sha256Hex(bytes), bytes: bytes.length };
}

export type LaunchManifest = {
  experimentId: "m1-chrome-sum-u32-v1";
  corpusId: string;
  blockId: string;
  scheduleIndex: number;
  stratum: "cold" | "warm";
  order: PairInput["order"];
  expiresAt: string;
};
export function validateLaunchManifest(manifest: LaunchManifest, now = new Date()): void {
  assertLaunchManifestSchema(manifest);
  if (
    manifest.experimentId !== "m1-chrome-sum-u32-v1" ||
    !/^[a-z0-9][a-z0-9._-]{1,127}$/.test(manifest.corpusId) ||
    !/^[a-z0-9][a-z0-9._-]{1,127}$/.test(manifest.blockId) ||
    !Number.isSafeInteger(manifest.scheduleIndex) || manifest.scheduleIndex < 0 ||
    manifest.scheduleIndex > 119 ||
    new Set(manifest.order).size !== 2 ||
    Date.parse(manifest.expiresAt) <= now.getTime()
  ) throw new Error("launch manifest denied");
}

export class CorpusCoordinator {
  #tokens = new Map<string, { manifest: LaunchManifest; used: boolean }>();
  constructor(readonly root: string) {}
  issue(manifest: LaunchManifest): string {
    validateLaunchManifest(manifest);
    const token = crypto.randomUUID();
    this.#tokens.set(token, { manifest: structuredClone(manifest), used: false });
    return token;
  }
  lookup(token: string): LaunchManifest {
    const entry = this.#tokens.get(token);
    if (!entry || entry.used || Date.parse(entry.manifest.expiresAt) <= Date.now()) {
      throw new Error("launch token denied");
    }
    return structuredClone(entry.manifest);
  }
  async commit(token: string, input: PairInput): Promise<{ path: string; sha256: string }> {
    const entry = this.#tokens.get(token);
    if (!entry || entry.used) throw new Error("launch token denied");
    entry.used = true;
    const m = entry.manifest;
    if (
      input.corpusId !== m.corpusId || input.blockId !== m.blockId ||
      input.scheduleIndex !== m.scheduleIndex || input.stratum !== m.stratum ||
      JSON.stringify(input.order) !== JSON.stringify(m.order)
    ) throw new Error("launch manifest mismatch");
    try {
      return await commitPairedBlock(`${this.root}/${m.corpusId}`, input);
    } catch (error) {
      throw error;
    }
  }
}
