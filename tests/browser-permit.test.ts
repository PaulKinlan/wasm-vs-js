import { assertEquals, assertRejects } from "./assert.ts";
import { consumePermit, validatePermit } from "../lib/browser-permit.ts";
const permit = (overrides = {}) => ({
  schemaVersion: 1,
  permitId: "permit-test-0001",
  experimentId: "m1-chrome-sum-u32-v1",
  operation: "pilot-m1-corpus",
  sourceCommit: "a".repeat(40),
  chromeBinary: "/home/paulkinlan/.local/bin/google-chrome-stable",
  chromeSha256: "dea3ab8fba923b718920ef9d62570824f2dc0ab0c72d66d53f91b41de6570355",
  origin: "http://127.0.0.1:8787",
  strata: ["cold", "warm"],
  maximumLaunches: 2,
  profileRoot: "/tmp/wasm-vs-js-owned-profiles/pilot",
  issuedAt: "2026-08-02T00:00:00Z",
  expiresAt: "2026-08-03T00:00:00Z",
  authorizationReference: "telegram:test",
  retryOf: null,
  ...overrides,
});
Deno.test("permit is exact, bounded, atomic, single-use and expiry-aware", async () => {
  const root = await Deno.makeTempDir();
  try {
    const path = `${root}/permit.json`;
    await Deno.writeTextFile(path, JSON.stringify(permit()));
    const expected = { maximumLaunches: 2 as number, origin: "http://127.0.0.1:8787" };
    const first = await consumePermit(
      path,
      `${root}/used`,
      expected,
      new Date("2026-08-02T01:00:00Z"),
    );
    assertEquals(first.digest.length, 64);
    await assertRejects(
      () => consumePermit(path, `${root}/used`, expected, new Date("2026-08-02T01:01:00Z")),
      "File exists",
    );
    await Deno.writeTextFile(
      `${root}/expired.json`,
      JSON.stringify(permit({ permitId: "permit-expired-1" })),
    );
    await assertRejects(
      () =>
        consumePermit(`${root}/expired.json`, `${root}/used`, {}, new Date("2026-08-04T00:00:00Z")),
      "expired",
    );
  } finally {
    await Deno.remove(root, { recursive: true });
  }
});
Deno.test("permit rejects widening, changed origin/binary, invalid profile and retry substitution", () => {
  for (
    const value of [
      permit({ maximumLaunches: 121 }),
      permit({ origin: "https://example.com" }),
      permit({ profileRoot: "/tmp/foreign" }),
      permit({ profileRoot: "/tmp/wasm-vs-js-owned-profiles/a/../foreign" }),
      permit({ strata: ["warm", "cold"] }),
      permit({ retryOf: "permit-old-0001" }),
    ]
  ) {
    let failed = false;
    try {
      validatePermit(value);
    } catch {
      failed = true;
    }
    assertEquals(failed, true);
  }
  let failed = false;
  try {
    validatePermit(permit(), { chromeBinary: "/different" });
  } catch {
    failed = true;
  }
  assertEquals(failed, true);
  let futureFailed = false;
  try {
    validatePermit(
      permit({ issuedAt: "2026-08-03T01:00:00Z", expiresAt: "2026-08-03T02:00:00Z" }),
      {},
      new Date("2026-08-02T01:00:00Z"),
    );
  } catch {
    futureFailed = true;
  }
  assertEquals(futureFailed, true);
  let oneMillisecondFutureFailed = false;
  try {
    validatePermit(
      permit({ issuedAt: "2026-08-02T01:00:00.001Z", expiresAt: "2026-08-02T02:00:00Z" }),
      {},
      new Date("2026-08-02T01:00:00.000Z"),
    );
  } catch {
    oneMillisecondFutureFailed = true;
  }
  assertEquals(oneMillisecondFutureFailed, true);
});
