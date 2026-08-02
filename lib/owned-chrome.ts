import { browserWebSocketUrl, CdpClient } from "./cdp-client.ts";
import {
  assertProfileIdentity,
  createLedger,
  prepareProfile,
  ProcessLedger,
  ProfileIdentity,
  readProcessIdentity,
  recoverLedger,
  teardownLedger,
} from "./process-ledger.ts";
import { sha256Hex } from "./canonical.ts";

export type DevToolsEndpoint = { port: number; browserPath: string };
export type OwnedChrome = {
  child: Deno.ChildProcess;
  ledger: ProcessLedger;
  port: number;
  browserPath: string;
  browser: CdpClient;
  version: Record<string, unknown>;
  arguments: string[];
  binarySha256: string;
  resolvedBinary: string;
};
export async function waitDevToolsActivePort(
  profileRoot: string,
  timeoutMs = 10_000,
): Promise<DevToolsEndpoint> {
  const path = `${profileRoot}/DevToolsActivePort`, deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    try {
      const info = await Deno.lstat(path);
      if (info.isSymlink || !info.isFile) throw new Error("unsafe DevToolsActivePort");
      const lines = (await Deno.readTextFile(path)).trim().split(/\r?\n/);
      const port = Number(lines[0]), browserPath = lines[1] ?? "";
      if (
        Number.isSafeInteger(port) && port > 0 && port <= 65535 &&
        /^\/devtools\/browser\/[A-Za-z0-9-]+$/.test(browserPath) && lines.length === 2
      ) return { port, browserPath };
      throw new Error("invalid DevToolsActivePort");
    } catch (error) {
      if (!(error instanceof Deno.errors.NotFound)) throw error;
    }
    await new Promise((r) => setTimeout(r, 25));
  }
  throw new Error("Chrome startup timeout");
}
function numberIdentity(value: number | bigint | null | undefined, label: string): number {
  const n = Number(value);
  if (!Number.isSafeInteger(n) || n < 0) throw new Error(`${label} unavailable`);
  return n;
}
async function executableSnapshot(path: string) {
  const resolved = await Deno.realPath(path), info = await Deno.stat(resolved);
  if (!info.isFile) throw new Error("Chrome binary is not a file");
  return {
    resolved,
    dev: numberIdentity(info.dev, "Chrome dev"),
    ino: numberIdentity(info.ino, "Chrome inode"),
    sha256: await sha256Hex(await Deno.readFile(resolved)),
  };
}
async function listenerInode(port: number, procRoot = "/proc"): Promise<string> {
  const hexPort = port.toString(16).toUpperCase().padStart(4, "0");
  for (const file of [`${procRoot}/net/tcp`, `${procRoot}/net/tcp6`]) {
    try {
      for (const line of (await Deno.readTextFile(file)).trim().split("\n").slice(1)) {
        const fields = line.trim().split(/\s+/),
          local = fields[1] ?? "",
          state = fields[3],
          inode = fields[9];
        const [address, p] = local.split(":");
        const loopback = address === "0100007F" || address === "00000000000000000000000001000000";
        if (p === hexPort && state === "0A" && loopback && /^\d+$/.test(inode)) return inode;
      }
    } catch { /* file unavailable */ }
  }
  throw new Error("DevTools listener socket not found on loopback");
}
export async function assertListenerOwned(
  port: number,
  ledger: ProcessLedger,
  procRoot = "/proc",
): Promise<void> {
  const inode = await listenerInode(port, procRoot), wanted = `socket:[${inode}]`;
  for (const process of ledger.processes) {
    try {
      for await (const fd of Deno.readDir(`${procRoot}/${process.pid}/fd`)) {
        try {
          if (await Deno.readLink(`${procRoot}/${process.pid}/fd/${fd.name}`) === wanted) return;
        } catch { /* raced */ }
      }
    } catch { /* raced */ }
  }
  throw new Error("DevTools listener is not owned by the Chrome ledger");
}
async function initialLedger(
  child: Deno.ChildProcess,
  profile: ProfileIdentity,
  timeoutMs: number,
): Promise<ProcessLedger> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    try {
      return await createLedger(child.pid, profile);
    } catch {
      await new Promise((r) => setTimeout(r, 10));
    }
  }
  throw new Error("Chrome root identity unavailable");
}
export async function launchOwnedChrome(options: {
  binary: string;
  expectedSha256: string;
  profileRoot: string;
  extraArguments?: string[];
  timeoutMs?: number;
}): Promise<OwnedChrome> {
  const before = await executableSnapshot(options.binary);
  const profile = await prepareProfile(options.profileRoot);
  if (before.sha256 !== options.expectedSha256) throw new Error("Chrome binary hash mismatch");
  const launchArguments = [
    `--user-data-dir=${options.profileRoot}`,
    "--remote-debugging-port=0",
    "--no-first-run",
    "--no-default-browser-check",
    "--disable-sync",
    ...(options.extraArguments ?? []),
    "about:blank",
  ];
  const child = new Deno.Command(before.resolved, {
    args: launchArguments,
    stdout: "null",
    stderr: "null",
  }).spawn();
  let ledger: ProcessLedger | undefined;
  try {
    const after = await executableSnapshot(before.resolved);
    if (after.dev !== before.dev || after.ino !== before.ino || after.sha256 !== before.sha256) {
      throw new Error("Chrome executable changed around spawn");
    }
    ledger = await initialLedger(child, profile, options.timeoutMs ?? 10_000);
    const root = await readProcessIdentity(child.pid, options.profileRoot);
    if (
      root.executable.dev !== before.dev || root.executable.ino !== before.ino ||
      root.executable.sha256 !== before.sha256 || root.executable.path !== before.resolved
    ) throw new Error("spawned Chrome executable identity mismatch");
    const endpoint = await waitDevToolsActivePort(options.profileRoot, options.timeoutMs);
    ledger = await createLedger(child.pid, profile);
    await assertListenerOwned(endpoint.port, ledger);
    const browser = new CdpClient(await browserWebSocketUrl(endpoint.port, endpoint.browserPath));
    const version = await browser.send("Browser.getVersion");
    const command = await browser.send("Browser.getBrowserCommandLine").catch(() => ({
      arguments: [],
    }));
    if (!Array.isArray(command.arguments)) throw new Error("Chrome command line unavailable");
    const effective = command.arguments.map(String);
    for (const required of launchArguments.filter((arg) => arg.startsWith("--"))) {
      if (!effective.includes(required)) {
        throw new Error(`Chrome command line mismatch: ${required}`);
      }
    }
    if (effective.some((arg) => arg.startsWith("--headless"))) {
      throw new Error("headless Chrome denied by preregistration");
    }
    await assertProfileIdentity(profile);
    return {
      child,
      ledger,
      port: endpoint.port,
      browserPath: endpoint.browserPath,
      browser,
      version,
      arguments: launchArguments,
      binarySha256: before.sha256,
      resolvedBinary: before.resolved,
    };
  } catch (error) {
    ledger ??= await recoverLedger(profile, child.pid).catch(() => undefined);
    if (ledger) {
      const cleanup = await teardownLedger(ledger).catch(() => ({ cleaned: false }));
      if (!cleanup.cleaned) {
        throw new Error(
          `Chrome startup containment cleanup failed after: ${
            error instanceof Error ? error.message : String(error)
          }`,
        );
      }
    } else {
      throw new Error(
        `Chrome startup identity unavailable; profile preserved for containment review: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
    }
    throw error;
  }
}
export async function closeOwnedChrome(
  owned: OwnedChrome,
): Promise<{ cleaned: boolean; remaining: number[]; identityMismatches: number[] }> {
  await owned.browser.send("Browser.close", {}, undefined, 2_000).catch(() => {});
  owned.browser.close();
  const result = await teardownLedger(owned.ledger);
  if (!result.cleaned) throw new Error("owned Chrome cleanup failed");
  return result;
}
