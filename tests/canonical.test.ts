import { canonicalize, hashCanonicalEnvelope, sha256Hex } from "../lib/canonical.ts";
import { assertEquals, assertRejects } from "./assert.ts";

Deno.test("RFC 8785-style canonicalization sorts keys and preserves arrays", () => {
  assertEquals(
    canonicalize({ z: 1, a: [3, { b: true, a: "x" }] }),
    '{"a":[3,{"a":"x","b":true}],"z":1}',
  );
});

Deno.test("canonical run hash omits payloadSha256", async () => {
  const first = await hashCanonicalEnvelope({ b: 2, a: 1 });
  const second = await hashCanonicalEnvelope({ payloadSha256: "ignored", a: 1, b: 2 });
  assertEquals(first, second);
  assertEquals(first, await sha256Hex('{"a":1,"b":2}'));
});

Deno.test("canonicalization rejects non-JSON and lone surrogate input", async () => {
  await assertRejects(() => Promise.resolve(canonicalize({ x: Number.NaN })), "non-finite");
  await assertRejects(() => Promise.resolve(canonicalize({ x: "\ud800" })), "lone surrogate");
  const sparse = new Array(2);
  sparse[1] = 1;
  await assertRejects(() => Promise.resolve(canonicalize(sparse)), "sparse array");
  const decorated = [1];
  Object.assign(decorated, { extra: true });
  await assertRejects(() => Promise.resolve(canonicalize(decorated)), "array property");
});
