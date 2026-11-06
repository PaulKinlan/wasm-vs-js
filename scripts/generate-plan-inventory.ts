// scripts/generate-plan-inventory.ts
// Generates the canonical 50-benchmark build, source, artifact, and oracle
// inventory table for PLAN.md from scripts/wasm-build-registry.ts.

import { BENCHMARK_BUILD_SPECS } from "./wasm-build-registry.ts";

export interface InventoryItem {
  index: number;
  id: string;
  slug: string;
  route: string;
  title: string;
  category: string;
  pageType: string;
  kernels: string;
  js: string;
  wasmSource: string;
  wasm: string;
  buildCommand: string;
  oracleTests: string;
  manifest: string | null;
}

export function buildInventory(): InventoryItem[] {
  return BENCHMARK_BUILD_SPECS.map((s) => ({
    index: s.index,
    id: s.id,
    slug: s.slug,
    route: s.route,
    title: s.title,
    category: s.category,
    pageType: s.pageType,
    kernels: s.kernels.join(", "),
    js: s.jsSource,
    wasmSource: s.wasmSource,
    wasm: s.wasmArtifact,
    buildCommand: s.buildCommand,
    oracleTests: s.oracleTests.join(", "),
    manifest: s.manifest,
  }));
}

export function generateMarkdownTable(items: InventoryItem[]): string {
  const lines: string[] = [];
  lines.push("## Complete 50-Benchmark JS + WAT Inventory\n");
  lines.push(
    "All 50 benchmarks execute under the 3-stage architecture; full build recipes across all 300 `.wasm` binaries and 8 build lanes are documented in [`docs/wasm-build-and-equivalence.md`](docs/wasm-build-and-equivalence.md) and verified by `deno run --allow-read scripts/build-all-wasm.ts --verify`:\n" +
      "- **Stage 1 (Mandatory Baseline)**: JavaScript vs primary WebAssembly on identical fixed inputs after pre-timing oracle verification.\n" +
      "- **Stage 2 (Multi-Language Matrix)**: Handwritten WAT, C, C++, Rust, AssemblyScript, and Dart/WasmGC kernels verified against the same oracle.\n" +
      "- **Stage 3 (Track B Optimizations)**: Independently optimized variants (SIMD128, loop tiling, `-O2`/`-O3`/`-O4`) reported separately with declared equivalence class (`bit-identical` or `reassociated`).\n",
  );
  lines.push(
    "| # | Benchmark & Route | Workload ID | Category | Type | JS Source | Wasm Source | Compiled `.wasm` | Build Command | Oracle Tests |",
  );
  lines.push(
    "|---|---|---|---|---|---|---|---|---|---|",
  );
  for (const it of items) {
    const jsName = it.js.split("/").pop() ?? it.js;
    const wasmSrcName = it.wasmSource.split("/").pop() ?? it.wasmSource;
    const wasmName = it.wasm.split("/").pop() ?? it.wasm;
    const htmlFile = `public${it.route}index.html`;
    lines.push(
      `| ${it.index} | [${it.title}](${htmlFile}) (\`${it.route}\`) | \`${it.id}\` | ${it.category} | \`${it.pageType}\` | [${jsName}](${it.js}) | [${wasmSrcName}](${it.wasmSource}) | [${wasmName}](${it.wasm}) | \`${it.buildCommand}\` | \`${it.oracleTests}\` |`,
    );
  }
  lines.push("");
  return lines.join("\n");
}

if (import.meta.main) {
  const items = buildInventory();
  const md = generateMarkdownTable(items);

  if (Deno.args.includes("--write-plan")) {
    const planPath = "PLAN.md";
    let plan = Deno.readTextFileSync(planPath);
    const marker = "## Complete 50-Benchmark JS + WAT Inventory";
    if (plan.includes(marker)) {
      const idx = plan.indexOf(marker);
      plan = plan.slice(0, idx).trimEnd() + "\n\n" + md;
    } else {
      plan = plan.trimEnd() + "\n\n" + md;
    }
    Deno.writeTextFileSync(planPath, plan);
    console.log(`Updated ${planPath} with ${items.length}-benchmark inventory table.`);
  } else {
    console.log(md);
  }
}
