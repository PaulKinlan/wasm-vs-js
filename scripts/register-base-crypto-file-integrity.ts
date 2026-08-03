import { createHash } from "node:crypto";
import {
  FIXTURE_SEED,
  generateFixture,
  REGISTERED_KINDS,
  REGISTERED_SIZES,
} from "../benchmarks/base/crypto-file-integrity/workload.js";

const root = new URL("../", import.meta.url);
const fixtures = [];
for (const kind of REGISTERED_KINDS) {
  for (const byteLength of REGISTERED_SIZES) {
    const bytes = generateFixture(kind, byteLength);
    const digest = createHash("sha256").update(bytes).digest("hex");
    fixtures.push({
      id: `${kind}-${byteLength}`,
      kind,
      byteLength,
      sha256: digest,
      expectedDigestSha256: digest,
    });
    console.log(kind, byteLength, digest);
  }
}
const record = {
  schemaVersion: 1,
  workloadId: "crypto.file-integrity.v1",
  catalogId: "workload-catalog-v1",
  catalogEntryStatus: "implemented-by-supplement-with-frozen-definition-unchanged",
  catalogContract: {
    algorithmFamily: "sha256-fixed-chunk-schedule",
    oracle: "exact-hash",
    fixtures: {
      kinds: [...REGISTERED_KINDS],
      sizesBytes: [...REGISTERED_SIZES],
      seed: `0x${FIXTURE_SEED.toString(16)}`,
      generator: "xorshift32 words serialized little-endian; zero fixture initialized to 0x00",
      licenseSpdx: "CC0-1.0",
      redistribution: "generated",
    },
    schedulesBytes: [1024, 65536, "whole-buffer"],
    variants: ["js-controlled", "wasm-linear-controlled"],
    excludedFromControlledPair: ["WebCrypto host intrinsic", "SIMD", "threads", "BLAKE3"],
  },
  fixtures,
  fixedWork: {
    casesPerTarget: 18,
    fixtureBytesPerTarget: REGISTERED_SIZES.reduce((a, b) => a + b, 0) * REGISTERED_KINDS.length *
      3,
    digestBytesPerCase: 32,
  },
};
const output = new URL("registrations/base/crypto.file-integrity.v1.json", root);
await Deno.mkdir(new URL("./", output), { recursive: true });
await Deno.writeTextFile(output, `${JSON.stringify(record, null, 2)}\n`);
