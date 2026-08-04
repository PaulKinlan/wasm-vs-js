import { sha256Hex } from "../lib/canonical.ts";
import { assert } from "./assert.ts";

// Verifies the generated worker-anchor module (slice 1 of
// docs/manifest-redesign.md): every generated anchor must hash-match the
// artifact bytes on disk, AND each consuming worker must actually import its
// block (a worker that quietly keeps a hardcoded literal defeats the point).
// Runtime counter/digest anchors and generated-fixture pins stay inline in
// workers — they pin execution, not bytes (covered by contract tests).

const root = new URL("../", import.meta.url);

import { WORKER_ANCHORS } from "../public/worker-anchors.generated.js";
import { ANCHORS, WORKERS } from "../scripts/build-worker-anchors.ts";

Deno.test("generated worker anchors match artifact bytes and are consumed", async () => {
  for (const [key, worker] of Object.entries(WORKERS)) {
    const source = await Deno.readTextFile(new URL(worker, root));
    assert(
      source.includes(`WORKER_ANCHORS["${key}"]`),
      `${worker} does not consume WORKER_ANCHORS["${key}"]`,
    );
    const anchors = (WORKER_ANCHORS as Record<string, Record<string, string>>)[key];
    assert(anchors, `WORKER_ANCHORS missing "${key}"`);
    for (const [anchor, file] of Object.entries(ANCHORS[key])) {
      const bytes = await Deno.readFile(new URL(file, root));
      const actual = await sha256Hex(bytes);
      assert(
        actual === anchors[anchor],
        `WORKER_ANCHORS["${key}"].${anchor} stale — pinned ${anchors[anchor]?.slice(0, 12)}… ` +
          `but ${file} hashes ${
            actual.slice(0, 12)
          }… (regenerate: scripts/build-worker-anchors.ts)`,
      );
    }
  }
});
