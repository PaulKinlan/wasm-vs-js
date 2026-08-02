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
    const path = `${this.root}/${run.runId}.json`;
    let file: Deno.FsFile;
    try {
      file = await Deno.open(path, { write: true, createNew: true, mode: 0o600 });
    } catch (error) {
      if (error instanceof Deno.errors.AlreadyExists) throw new Error("run already exists");
      throw error;
    }
    try {
      await file.write(new TextEncoder().encode(`${canonicalize(run)}\n`));
    } finally {
      file.close();
    }
    return { runId: run.runId, payloadSha256: expected };
  }

  async get(runId: string): Promise<RunRecord | null> {
    if (!/^[A-Za-z0-9_-]{16,96}$/.test(runId)) return null;
    try {
      return JSON.parse(await Deno.readTextFile(`${this.root}/${runId}.json`));
    } catch (error) {
      if (error instanceof Deno.errors.NotFound) return null;
      throw error;
    }
  }

  async list(): Promise<RunRecord[]> {
    const runs: RunRecord[] = [];
    try {
      for await (const entry of Deno.readDir(this.root)) {
        if (!entry.isFile || !entry.name.endsWith(".json")) continue;
        runs.push(JSON.parse(await Deno.readTextFile(`${this.root}/${entry.name}`)));
      }
    } catch (error) {
      if (error instanceof Deno.errors.NotFound) return [];
      throw error;
    }
    return runs.sort((a, b) => String(a.capturedAt).localeCompare(String(b.capturedAt)));
  }
}
