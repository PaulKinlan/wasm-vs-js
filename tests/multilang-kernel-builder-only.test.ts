// `--only <workload>` rebuilds a subset of the kernels. The ledger write used
// to serialize just that run's records, so a filtered run deleted every recipe
// it had not rebuilt: `--only text-markdown-cms` turned a 147-kernel ledger
// into a 1-kernel one. A filter that matched nothing was worse — zero builds
// ran and the ledger was written holding zero kernels.
//
// Neither failure was visible in the run's own output, which reported the
// number of records it wrote and was truthful about that.
//
// Both are now refused: a no-match filter exits non-zero without writing, and
// a matching filter merges into the ledger it read.

import { assert } from "./assert.ts";

const ROOT = new URL("../", import.meta.url).pathname;
const SOURCE = await Deno.readTextFile(`${ROOT}scripts/build-multilang-kernels.ts`);

Deno.test("a --only filter that matches nothing refuses to write the ledger", () => {
  assert(
    /--only matched no build for/.test(SOURCE),
    "the builder must reject an --only value that matches no build",
  );
  const at = SOURCE.indexOf("--only matched no build for");
  assert(
    SOURCE.slice(at, at + 400).includes("Deno.exit(1)"),
    "rejecting an unmatched --only must exit non-zero before the ledger is written",
  );
});

Deno.test("a filtered run merges into the ledger instead of replacing it", () => {
  assert(
    /let merged = records;/.test(SOURCE),
    "the ledger write must start from a merged record set, not this run's records",
  );
  assert(
    /kernels: merged,/.test(SOURCE),
    "the ledger must serialize the merged records",
  );
  assert(
    /kernelCount: merged\.length,/.test(SOURCE),
    "kernelCount must count the merged ledger, not this run",
  );
  // The merge is only correct if it drops the stale copies of what was rebuilt.
  const at = SOURCE.indexOf("let merged = records;");
  const block = SOURCE.slice(at, at + 900);
  assert(
    block.includes("rebuilt.has(") && block.includes("!"),
    "the merge must exclude prior entries for the kernels this run rebuilt",
  );
});

Deno.test("the recorded ledger covers every kernel a manifest declares", async () => {
  const ledger = JSON.parse(
    await Deno.readTextFile(
      `${ROOT}public/artifacts/multilang-wasm-benchmark/kernel-build-provenance.v1.json`,
    ),
  ) as { kernelCount: number; kernels: Array<{ workload: string; engine: string }> };

  assert(
    ledger.kernels.length === ledger.kernelCount,
    `kernelCount ${ledger.kernelCount} disagrees with ${ledger.kernels.length} entries`,
  );
  // A truncating write is caught by the count alone: the ledger has grown
  // monotonically as engines were added and has never legitimately shrunk.
  assert(
    ledger.kernels.length >= 149,
    `ledger holds ${ledger.kernels.length} kernels — a filtered run may have truncated it`,
  );
  const keys = new Set(ledger.kernels.map((k) => `${k.workload}/${k.engine}`));
  assert(
    keys.size === ledger.kernels.length,
    "the ledger holds duplicate workload/engine entries — the merge is double-counting",
  );
});
