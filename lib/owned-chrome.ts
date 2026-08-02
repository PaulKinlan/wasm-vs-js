import { browserWebSocketUrl, CdpClient } from "./cdp-client.ts";
import { createLedger, ProcessLedger, teardownLedger } from "./process-ledger.ts";
import { sha256Hex } from "./canonical.ts";

export type OwnedChrome = {
  child: Deno.ChildProcess;
  ledger: ProcessLedger;
  port: number;
  browser: CdpClient;
  version: Record<string, unknown>;
  arguments: string[];
  binarySha256: string;
};

export async function waitDevToolsActivePort(
  profileRoot: string,
  timeoutMs = 10_000,
): Promise<number> {
  const path = `${profileRoot}/DevToolsActivePort`, deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    try {
      const lines = (await Deno.readTextFile(path)).trim().split(/\r?\n/);
      const port = Number(lines[0]);
      if (Number.isSafeInteger(port) && port > 0 && lines[1]?.startsWith("/devtools/browser/")) {
        return port;
      }
      throw new Error("invalid DevToolsActivePort");
    } catch (error) {
      if (!(error instanceof Deno.errors.NotFound)) throw error;
    }
    await new Promise((r) => setTimeout(r, 25));
  }
  throw new Error("Chrome startup timeout");
}

export async function launchOwnedChrome(
  options: {
    binary: string;
    expectedSha256: string;
    profileRoot: string;
    extraArguments?: string[];
    timeoutMs?: number;
  },
): Promise<OwnedChrome> {
  const prefix = "/tmp/wasm-vs-js-owned-profiles/";
  const suffix = options.profileRoot.slice(prefix.length);
  if (
    !options.profileRoot.startsWith(prefix) ||
    !suffix ||
    suffix.split("/").some((part) =>
      !/^[A-Za-z0-9._-]+$/.test(part) || part === "." || part === ".."
    )
  ) throw new Error("profile root denied");
  try {
    await Deno.stat(options.profileRoot);
    throw new Error("profile root already exists");
  } catch (error) {
    if (!(error instanceof Deno.errors.NotFound)) throw error;
  }
  await Deno.mkdir(options.profileRoot, { recursive: true, mode: 0o700 });
  const binarySha256 = await sha256Hex(await Deno.readFile(options.binary));
  if (binarySha256 !== options.expectedSha256) throw new Error("Chrome binary hash mismatch");
  const launchArguments = [
    `--user-data-dir=${options.profileRoot}`,
    "--remote-debugging-port=0",
    "--no-first-run",
    "--no-default-browser-check",
    "--disable-sync",
    ...(options.extraArguments ?? []),
    "about:blank",
  ];
  const child = new Deno.Command(options.binary, {
    args: launchArguments,
    stdout: "null",
    stderr: "null",
  }).spawn();
  let ledger: ProcessLedger | undefined;
  try {
    const port = await waitDevToolsActivePort(options.profileRoot, options.timeoutMs);
    ledger = await createLedger(child.pid, options.profileRoot);
    const browser = new CdpClient(await browserWebSocketUrl(port));
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
    return {
      child,
      ledger,
      port,
      browser,
      version,
      arguments: launchArguments,
      binarySha256,
    };
  } catch (error) {
    if (!ledger) {
      ledger = {
        rootPid: child.pid,
        ownedPids: [child.pid],
        profileRoot: options.profileRoot,
        recordedAt: new Date().toISOString(),
      };
    }
    await teardownLedger(ledger).catch(() => {});
    throw error;
  }
}

export async function closeOwnedChrome(
  owned: OwnedChrome,
): Promise<{ cleaned: boolean; remaining: number[] }> {
  const beforeClose = await createLedger(owned.ledger.rootPid, owned.ledger.profileRoot).catch(() =>
    owned.ledger
  );
  owned.ledger.ownedPids = [
    ...new Set([...owned.ledger.ownedPids, ...beforeClose.ownedPids]),
  ];
  await owned.browser.send("Browser.close", {}, undefined, 2_000).catch(() => {});
  owned.browser.close();
  const latest = await createLedger(owned.ledger.rootPid, owned.ledger.profileRoot).catch(() =>
    owned.ledger
  );
  latest.ownedPids = [...new Set([...owned.ledger.ownedPids, ...latest.ownedPids])];
  const result = await teardownLedger(latest);
  if (!result.cleaned) throw new Error("owned Chrome cleanup failed");
  return result;
}
