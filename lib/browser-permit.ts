import { sha256Hex } from "./canonical.ts";

export type BrowserPermit = {
  schemaVersion: 1;
  permitId: string;
  experimentId: string;
  operation: "collect-uninstrumented-headline-paired-corpus" | "pilot-m1-corpus";
  sourceCommit: string;
  chromeBinary: string;
  chromeSha256: string;
  origin: string;
  strata: Array<"cold" | "warm">;
  maximumLaunches: number;
  profileRoot: string;
  issuedAt: string;
  expiresAt: string;
  authorizationReference: string;
  retryOf: null | string;
};

const KEYS = [
  "schemaVersion",
  "permitId",
  "experimentId",
  "operation",
  "sourceCommit",
  "chromeBinary",
  "chromeSha256",
  "origin",
  "strata",
  "maximumLaunches",
  "profileRoot",
  "issuedAt",
  "expiresAt",
  "authorizationReference",
  "retryOf",
].sort();

export function validatePermit(
  value: unknown,
  expected: Partial<BrowserPermit> = {},
): BrowserPermit {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error("permit object required");
  }
  const permit = value as BrowserPermit;
  if (JSON.stringify(Object.keys(permit).sort()) !== JSON.stringify(KEYS)) {
    throw new Error("permit shape denied");
  }
  if (permit.schemaVersion !== 1 || !/^[a-z0-9][a-z0-9._-]{7,127}$/.test(permit.permitId)) {
    throw new Error("permit identity denied");
  }
  if (permit.experimentId !== "m1-chrome-sum-u32-v1") throw new Error("experiment denied");
  if (
    !["collect-uninstrumented-headline-paired-corpus", "pilot-m1-corpus"].includes(permit.operation)
  ) {
    throw new Error("operation denied");
  }
  if (
    !/^[a-f0-9]{40}$/.test(permit.sourceCommit) ||
    permit.chromeBinary !== "/home/paulkinlan/.local/bin/google-chrome-stable" ||
    permit.chromeSha256 !==
      "dea3ab8fba923b718920ef9d62570824f2dc0ab0c72d66d53f91b41de6570355"
  ) throw new Error("exact Chrome identity denied");
  if (permit.origin !== "http://127.0.0.1:8787") throw new Error("origin denied");
  if (JSON.stringify(permit.strata) !== JSON.stringify(["cold", "warm"])) {
    throw new Error("strata denied");
  }
  if (
    !Number.isSafeInteger(permit.maximumLaunches) || permit.maximumLaunches < 1 ||
    permit.maximumLaunches > 120
  ) throw new Error("launch bound denied");
  if (!/^\/tmp\/wasm-vs-js-owned-profiles\/[A-Za-z0-9._-]+$/.test(permit.profileRoot)) {
    throw new Error("profile root denied");
  }
  const issued = Date.parse(permit.issuedAt), expires = Date.parse(permit.expiresAt);
  if (
    !Number.isFinite(issued) ||
    !Number.isFinite(expires) ||
    expires <= issued ||
    expires - issued > 24 * 60 * 60 * 1000
  ) {
    throw new Error("permit time denied");
  }
  if (!permit.authorizationReference || permit.authorizationReference.length > 256) {
    throw new Error("authorization reference denied");
  }
  for (const [key, wanted] of Object.entries(expected)) {
    if (
      wanted !== undefined &&
      JSON.stringify(permit[key as keyof BrowserPermit]) !== JSON.stringify(wanted)
    ) throw new Error(`permit ${key} mismatch`);
  }
  return permit;
}

export async function consumePermit(
  path: string,
  consumptionDir: string,
  expected: Partial<BrowserPermit> = {},
  now = new Date(),
): Promise<{ permit: BrowserPermit; digest: string; receiptPath: string }> {
  const bytes = await Deno.readFile(path);
  const permit = validatePermit(JSON.parse(new TextDecoder().decode(bytes)), expected);
  if (now.getTime() > Date.parse(permit.expiresAt)) throw new Error("permit expired");
  await Deno.mkdir(consumptionDir, { recursive: true, mode: 0o700 });
  const receiptPath = `${consumptionDir}/${permit.permitId}.consumed.json`;
  const digest = await sha256Hex(bytes);
  const handle = await Deno.open(receiptPath, { write: true, createNew: true, mode: 0o600 });
  try {
    await handle.write(
      new TextEncoder().encode(
        JSON.stringify({
          permitId: permit.permitId,
          digest,
          consumedAt: now.toISOString(),
          operation: permit.operation,
        }) + "\n",
      ),
    );
    handle.sync();
  } finally {
    handle.close();
  }
  return { permit, digest, receiptPath };
}
