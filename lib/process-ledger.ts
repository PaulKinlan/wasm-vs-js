export type ProcessLedger = {
  rootPid: number;
  ownedPids: number[];
  profileRoot: string;
  recordedAt: string;
};

function validPid(pid: number): boolean {
  return Number.isSafeInteger(pid) && pid > 1;
}

export async function descendants(rootPid: number, procRoot = "/proc"): Promise<number[]> {
  if (!validPid(rootPid)) throw new Error("invalid root pid");
  const parent = new Map<number, number>();
  for await (const entry of Deno.readDir(procRoot)) {
    if (!entry.isDirectory || !/^\d+$/.test(entry.name)) continue;
    try {
      const stat = await Deno.readTextFile(`${procRoot}/${entry.name}/stat`);
      const tail = stat.slice(stat.lastIndexOf(")") + 2).split(" ");
      parent.set(Number(entry.name), Number(tail[1]));
    } catch { /* process raced */ }
  }
  const result = new Set<number>([rootPid]);
  let changed = true;
  while (changed) {
    changed = false;
    for (const [pid, ppid] of parent) {
      if (result.has(ppid) && !result.has(pid)) {
        result.add(pid);
        changed = true;
      }
    }
  }
  return [...result].sort((a, b) => a - b);
}

export async function createLedger(
  rootPid: number,
  profileRoot: string,
  procRoot = "/proc",
): Promise<ProcessLedger> {
  const prefix = "/tmp/wasm-vs-js-owned-profiles/";
  const suffix = profileRoot.slice(prefix.length);
  if (
    !profileRoot.startsWith(prefix) ||
    !suffix ||
    suffix.split("/").some((part) =>
      !/^[A-Za-z0-9._-]+$/.test(part) || part === "." || part === ".."
    )
  ) throw new Error("profile root outside ownership root");
  return {
    rootPid,
    ownedPids: await descendants(rootPid, procRoot),
    profileRoot,
    recordedAt: new Date().toISOString(),
  };
}

export function assertOnlyOwned(targets: number[], ledger: ProcessLedger): void {
  const owned = new Set(ledger.ownedPids);
  if (!targets.every((pid) => validPid(pid) && owned.has(pid))) {
    throw new Error("foreign pid denied");
  }
}

export async function teardownLedger(
  ledger: ProcessLedger,
  options: {
    signal?: Deno.Signal;
    kill?: (pid: number, signal: Deno.Signal) => void;
    exists?: (pid: number) => boolean;
    removeProfile?: boolean;
  } = {},
): Promise<{ cleaned: boolean; remaining: number[] }> {
  assertOnlyOwned(ledger.ownedPids, ledger);
  const kill = options.kill ?? Deno.kill;
  const exists = options.exists ?? ((pid) => {
    try {
      Deno.kill(pid, 0);
      return true;
    } catch {
      return false;
    }
  });
  const signal = options.signal ?? "SIGTERM";
  for (const pid of [...ledger.ownedPids].sort((a, b) => b - a)) {
    if (exists(pid)) {
      try {
        kill(pid, signal);
      } catch { /* verify below */ }
    }
  }
  const deadline = Date.now() + 2_000;
  let remaining = ledger.ownedPids.filter(exists);
  while (remaining.length && Date.now() < deadline) {
    await new Promise((r) => setTimeout(r, 25));
    remaining = ledger.ownedPids.filter(exists);
  }
  if (remaining.length) {
    for (const pid of [...remaining].sort((a, b) => b - a)) {
      try {
        kill(pid, "SIGKILL");
      } catch { /* verify */ }
    }
  }
  remaining = ledger.ownedPids.filter(exists);
  if (options.removeProfile !== false && !remaining.length) {
    await Deno.remove(ledger.profileRoot, { recursive: true }).catch((error) => {
      if (!(error instanceof Deno.errors.NotFound)) {
        throw error;
      }
    });
  }
  let profileExists = false;
  try {
    await Deno.stat(ledger.profileRoot);
    profileExists = true;
  } catch (error) {
    if (!(error instanceof Deno.errors.NotFound)) throw error;
  }
  return { cleaned: remaining.length === 0 && !profileExists, remaining };
}
