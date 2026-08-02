import { assertEquals, assertRejects } from "./assert.ts";
import {
  commitPairedBlock,
  CorpusCoordinator,
  PairInput,
  writeImmutableArtifact,
} from "../lib/corpus-store.ts";
import { attestNetwork } from "../lib/chrome-evidence.ts";
const rec = (id: "js-controlled" | "wasm-linear-controlled") => ({
  variantId: id,
  payloadSha256: (id === "js-controlled" ? "a" : "b").repeat(64),
  medianMs: 1,
  samples: [1, 1.1],
});
const pair = (overrides: Partial<PairInput> = {}): PairInput => ({
  schemaVersion: 1,
  corpusId: "corpus-1",
  blockId: "block-1",
  experimentId: "m1-chrome-sum-u32-v1",
  scheduleIndex: 0,
  stratum: "cold",
  order: ["js-controlled", "wasm-linear-controlled"],
  records: [rec("js-controlled"), rec("wasm-linear-controlled")],
  launchEvidenceSha256: "c".repeat(64),
  cleanup: { complete: true, remainingPids: [], profileRemoved: true },
  ...overrides,
});
Deno.test("paired blocks commit atomically only with two valid records and exact cleanup", async () => {
  const root = await Deno.makeTempDir();
  try {
    await commitPairedBlock(root, pair());
    await assertRejects(() => commitPairedBlock(root, pair()), "File exists");
    for (
      const bad of [
        pair({ blockId: "missing", records: [rec("js-controlled")] }),
        pair({
          blockId: "partial",
          cleanup: { complete: false, remainingPids: [], profileRemoved: true },
        }),
        pair({ blockId: "wrong-order", order: ["wasm-linear-controlled", "js-controlled"] }),
      ]
    ) await assertRejects(() => commitPairedBlock(root, bad), "");
  } finally {
    await Deno.remove(root, { recursive: true });
  }
});
Deno.test("launch token is one-time, manifest-bound, and failed commit cannot retry", async () => {
  const root = await Deno.makeTempDir();
  try {
    const c = new CorpusCoordinator(root);
    const m = {
      experimentId: "m1-chrome-sum-u32-v1" as const,
      corpusId: "corpus-1",
      blockId: "block-1",
      scheduleIndex: 0,
      stratum: "cold" as const,
      order: ["js-controlled", "wasm-linear-controlled"] as PairInput["order"],
      expiresAt: new Date(Date.now() + 60000).toISOString(),
    };
    const token = c.issue(m);
    assertEquals(c.lookup(token).blockId, "block-1");
    await assertRejects(() => c.commit(token, pair({ corpusId: "wrong" })), "mismatch");
    let failed = false;
    try {
      c.lookup(token);
    } catch {
      failed = true;
    }
    assertEquals(failed, true);
  } finally {
    await Deno.remove(root, { recursive: true });
  }
});
Deno.test("cold/warm network evidence rejects cache, service worker, origin and method contradictions", async () => {
  const paths = [
    ["/artifacts/sum-u32/build-manifest.json", "public/artifacts/sum-u32/build-manifest.json"],
    ["/benchmarks/sum-u32/workload.js", "benchmarks/sum-u32/workload.js"],
    ["/artifacts/sum-u32/sum-u32.wasm", "public/artifacts/sum-u32/sum-u32.wasm"],
  ];
  const records = async (cached: boolean) =>
    await Promise.all(paths.map(async ([route, file]) => ({
      url: `http://127.0.0.1:8787${route}`,
      method: "GET",
      status: 200,
      fromDiskCache: cached,
      fromServiceWorker: false,
      body: await Deno.readFile(file),
    })));
  assertEquals((await attestNetwork(await records(false), "cold")).attested, true);
  assertEquals((await attestNetwork(await records(true), "warm")).attested, true);
  for (const [r, s] of [[await records(true), "cold"], [await records(false), "warm"]] as const) {
    await assertRejects(() => attestNetwork(r, s), "cache");
  }
  const sw = await records(false);
  sw[0].fromServiceWorker = true;
  await assertRejects(() => attestNetwork(sw, "cold"), "contradiction");
  const poisoned = await records(false);
  poisoned[0].body = new Uint8Array([1]);
  await assertRejects(() => attestNetwork(poisoned, "cold"), "hash mismatch");
});
Deno.test("private artifact writes are immutable and hashed", async () => {
  const root = await Deno.makeTempDir();
  try {
    const p = `${root}/a/x.json`;
    const v = await writeImmutableArtifact(p, "{}\n");
    assertEquals(v.bytes, 3);
    await assertRejects(() => writeImmutableArtifact(p, "bad"), "File exists");
  } finally {
    await Deno.remove(root, { recursive: true });
  }
});
