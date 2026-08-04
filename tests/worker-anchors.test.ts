import { sha256Hex } from "../lib/canonical.ts";
import { assert } from "./assert.ts";

// Generalizes the text-gc anchor pin (tests/text-gc-document-edit.test.ts):
// every worker-side EXPECTED anchor that pins a fetched artifact's bytes must
// match the served file on disk. Runtime counter/digest anchors and
// generated-fixture pins are out of scope here (covered by contract tests).
// Slice 1 of docs/manifest-redesign.md replaces the hardcoded anchors with a
// generated module; until then this test makes any stale anchor fail the gate
// instead of the live demo (the text-gc/path-tracer incident class).

const root = new URL("../", import.meta.url);

const ANCHORS: Array<{
  worker: string;
  key: string;
  url: string;
}> = [
  // public/pcap-decode-worker.js — exactFetch(url, EXPECTED.key)
  {
    worker: "public/pcap-decode-worker.js",
    key: "fixture",
    url: "/artifacts/base-network-pcap-decode/fixture.pcap",
  },
  {
    worker: "public/pcap-decode-worker.js",
    key: "output",
    url: "/artifacts/base-network-pcap-decode/reference-output.bin",
  },
  {
    worker: "public/pcap-decode-worker.js",
    key: "wasm",
    url: "/artifacts/base-network-pcap-decode/pcap-decode.wasm",
  },
  // public/benchmarks/cad-mesh-repair-v1/worker.js — fetch + EXPECTED.key compare
  {
    worker: "public/benchmarks/cad-mesh-repair-v1/worker.js",
    key: "fixture",
    url: "/artifacts/cad-mesh-repair-v1/dirty-grid.stl",
  },
  {
    worker: "public/benchmarks/cad-mesh-repair-v1/worker.js",
    key: "wasm",
    url: "/artifacts/cad-mesh-repair-v1/mesh-repair.wasm",
  },
  // public/demos/game-ecs-frame-update/worker.js — wasmSha256 pins the fetched wasm
  {
    worker: "public/demos/game-ecs-frame-update/worker.js",
    key: "wasmSha256",
    url: "/artifacts/game-ecs-frame-update-v1/ecs-frame-update.wasm",
  },
];

Deno.test("worker EXPECTED file-byte anchors match the served artifact bytes", async () => {
  for (const { worker, key, url } of ANCHORS) {
    const source = await Deno.readTextFile(new URL(worker, root));
    const pattern = new RegExp(`${key}:\\s*"([0-9a-f]{64})"`);
    const match = source.match(pattern);
    assert(match, `${worker}: EXPECTED.${key} anchor literal not found`);
    const file = new URL(`public${url}`, root);
    const bytes = await Deno.readFile(file);
    const actual = await sha256Hex(bytes);
    assert(
      actual === match[1],
      `${worker}: EXPECTED.${key} stale — pinned ${match[1].slice(0, 12)}… ` +
        `but ${url} hashes ${actual.slice(0, 12)}… (a manifest rebind missed this worker)`,
    );
  }
});
