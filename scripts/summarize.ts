import { canonicalize, sha256Hex } from "../lib/canonical.ts";
import { LocalRunStore } from "../lib/run-store.ts";
import { generateSummary } from "../lib/summary.ts";

const root = "raw/runs";
const output = "raw/summaries/m1-pilot-1.json";
const store = new LocalRunStore(root);
await store.initialize();
const page = await store.listPage(50);
const runs = page.runs;
const body = {
  ...generateSummary(runs, page.total, page.truncated),
  sourcePayloads: runs.map((run) => run.payloadSha256).sort(),
};
const summarySha256 = await sha256Hex(canonicalize(body));
await Deno.mkdir(output.slice(0, output.lastIndexOf("/")), { recursive: true });
await Deno.writeTextFile(output, `${canonicalize({ ...body, summarySha256 })}\n`);
console.log(`summary: ${runs.length} immutable runs -> ${output} (${summarySha256})`);
