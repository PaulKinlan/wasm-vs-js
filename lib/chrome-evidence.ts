import { sha256Hex } from "./canonical.ts";
export type NetworkRecord = {
  url: string;
  method: string;
  status: number;
  fromDiskCache: boolean;
  fromServiceWorker: boolean;
  body?: Uint8Array;
};
const ASSETS = [
  "/artifacts/sum-u32/build-manifest.json",
  "/benchmarks/sum-u32/workload.js",
  "/artifacts/sum-u32/sum-u32.wasm",
];
const EXPECTED_SHA256 = new Map([
  [ASSETS[0], "38136e96462c5b98e3057e4ea18ae339150918aa50f1270eb3db88586185cf98"],
  [ASSETS[1], "4d8379672c1b51b0b315d2bee119880694e5a4f6412ef59b7fe2593ef6b179b7"],
  [ASSETS[2], "9c4ce5f0d9e32cdd364b73b2697566e7396368d9867d9bc3d939bb2063583a6d"],
]);
export async function attestNetwork(
  records: NetworkRecord[],
  stratum: "cold" | "warm",
  origin = "http://127.0.0.1:8787",
): Promise<Record<string, unknown>> {
  if (records.length !== ASSETS.length) throw new Error("exact asset denominator mismatch");
  const byPath = new Map(records.map((r) => [new URL(r.url).pathname, r]));
  const assets = [];
  for (const path of ASSETS) {
    const r = byPath.get(path);
    if (!r) throw new Error(`missing asset ${path}`);
    if (
      new URL(r.url).origin !== origin || r.method !== "GET" || r.status !== 200 ||
      r.fromServiceWorker
    ) throw new Error("network containment/cache contradiction");
    if (stratum === "cold" && r.fromDiskCache) throw new Error("cold cache contradiction");
    if (stratum === "warm" && !r.fromDiskCache) throw new Error("warm cache not attested");
    if (!r.body) throw new Error("network response body evidence missing");
    const sha256 = await sha256Hex(r.body);
    if (sha256 !== EXPECTED_SHA256.get(path)) throw new Error("network response hash mismatch");
    assets.push({
      path,
      fromDiskCache: r.fromDiskCache,
      fromServiceWorker: r.fromServiceWorker,
      sha256,
    });
  }
  return { schemaVersion: 1, stratum, origin, assets, unexpectedRequests: 0, attested: true };
}
