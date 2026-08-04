// CLI Tool for Deno KV Logical Export and Import
// Usage:
//   deno run --unstable-kv -A scripts/export-import-kv.ts export --out=kv-export.json
//   deno run --unstable-kv -A scripts/export-import-kv.ts import --in=kv-export.json

import { KvRunStore } from "../lib/kv-store.ts";

const mode = Deno.args[0];

if (!mode || (mode !== "export" && mode !== "import")) {
  console.error(
    "Usage: deno run --unstable-kv -A scripts/export-import-kv.ts [export|import] [--out=file|--in=file]",
  );
  Deno.exit(1);
}

const kv = await Deno.openKv();
const store = new KvRunStore(kv);

try {
  if (mode === "export") {
    const outArg = Deno.args.find((a) => a.startsWith("--out="));
    const outFile = outArg ? outArg.slice(6) : "kv-export.json";
    const dump = await store.exportLogical();
    await Deno.writeTextFile(outFile, JSON.stringify(dump, null, 2));
    console.log(
      `Successfully exported ${dump.totalRuns} runs to ${outFile} (checksum: ${dump.checksumSha256})`,
    );
  } else {
    const inArg = Deno.args.find((a) => a.startsWith("--in="));
    const inFile = inArg ? inArg.slice(5) : "kv-export.json";
    const text = await Deno.readTextFile(inFile);
    const dump = JSON.parse(text);
    const result = await store.importLogical(dump);
    console.log(
      `Successfully imported ${result.imported} runs (${result.skipped} skipped duplicates) from ${inFile}`,
    );
  }
} catch (error) {
  console.error("Operation failed:", error instanceof Error ? error.message : error);
  Deno.exit(1);
} finally {
  kv.close();
}
