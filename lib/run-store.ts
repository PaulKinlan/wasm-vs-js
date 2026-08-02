import { canonicalize, hashCanonicalEnvelope } from "./canonical.ts";
import { validateRun } from "./contracts.ts";

export type RunRecord = Record<string, unknown> & {
  runId: string;
  payloadSha256: string;
  benchmark: { id: string; version: number; tier: string };
  variant: { id: string; target: string; track: string; cacheState: string };
  environment: { pairedBlockId: string; freshLaunchId: string };
  samples: Array<{ iteration: number; phase: string; durationMs: number; valid: boolean }>;
  capabilities?: Record<string, unknown>;
};

const MAX_RUN_BYTES = 256 * 1024;

export class LocalRunStore {
  constructor(readonly root: string) {}

  async initialize(): Promise<void> {
    await Deno.mkdir(this.root, { recursive: true });
  }

  async put(value: unknown): Promise<{ runId: string; payloadSha256: string }> {
    const validation = validateRun(value);
    if (!validation.ok) throw new Error(`run schema denied: ${validation.errors.join("; ")}`);
    const run = value as RunRecord;
    const expected = await hashCanonicalEnvelope(run);
    if (run.payloadSha256 !== expected) throw new Error("run payload hash denied");
    const encoded = new TextEncoder().encode(`${canonicalize(run)}\n`);
    if (encoded.byteLength > MAX_RUN_BYTES) throw new Error("run record too large");
    const path = `${this.root}/${run.runId}.json`;
    let file: Deno.FsFile;
    try {
      file = await Deno.open(path, { write: true, createNew: true, mode: 0o600 });
    } catch (error) {
      if (error instanceof Deno.errors.AlreadyExists) throw new Error("run already exists");
      throw error;
    }
    try {
      await file.write(encoded);
    } finally {
      file.close();
    }
    return { runId: run.runId, payloadSha256: expected };
  }

  async get(runId: string): Promise<RunRecord | null> {
    if (!/^[A-Za-z0-9_-]{16,96}$/.test(runId)) return null;
    try {
      const path = `${this.root}/${runId}.json`;
      if ((await Deno.stat(path)).size > MAX_RUN_BYTES) throw new Error("stored run too large");
      return JSON.parse(await Deno.readTextFile(path));
    } catch (error) {
      if (error instanceof Deno.errors.NotFound) return null;
      throw error;
    }
  }

  async listPage(limit = 50): Promise<{ runs: RunRecord[]; total: number; truncated: boolean }> {
    if (!Number.isSafeInteger(limit) || limit < 1 || limit > 100) {
      throw new Error("run limit denied");
    }
    const runs: RunRecord[] = [];
    try {
      const entries: Array<{ name: string; modified: number }> = [];
      for await (const entry of Deno.readDir(this.root)) {
        if (!entry.isFile || !entry.name.endsWith(".json")) continue;
        const stat = await Deno.stat(`${this.root}/${entry.name}`);
        entries.push({ name: entry.name, modified: stat.mtime?.getTime() ?? 0 });
      }
      entries.sort((a, b) => a.modified - b.modified || a.name.localeCompare(b.name));
      for (const { name } of entries.slice(-limit)) {
        const path = `${this.root}/${name}`;
        if ((await Deno.stat(path)).size > MAX_RUN_BYTES) throw new Error("stored run too large");
        runs.push(JSON.parse(await Deno.readTextFile(path)));
      }
      runs.sort((a, b) => String(a.capturedAt).localeCompare(String(b.capturedAt)));
      return { runs, total: entries.length, truncated: entries.length > runs.length };
    } catch (error) {
      if (error instanceof Deno.errors.NotFound) return { runs: [], total: 0, truncated: false };
      throw error;
    }
  }

  async list(limit = 50): Promise<RunRecord[]> {
    return (await this.listPage(limit)).runs;
  }
}
