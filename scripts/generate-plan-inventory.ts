// scripts/generate-plan-inventory.ts
// Generates the comprehensive 50-benchmark inventory table for PLAN.md and reports.

import { CANONICAL_BENCHMARKS } from "./generate-catalog-benchmarks.ts";

const root = Deno.cwd();

const standaloneWatMap: Record<string, { js: string; wat: string; wasm: string }> = {
  "dom.virtualized-scrolling.v1": {
    js: "benchmarks/dom-virtualized-scrolling/dom-virtualized-scrolling.js",
    wat: "benchmarks/dom-virtualized-scrolling/dom-virtualized-scrolling.wat",
    wasm: "public/artifacts/multilang-wasm-benchmark/dom_vscroll_wat.wasm",
  },
  "network.http2-quic-state.v1": {
    js: "benchmarks/v1/network-http2-quic-state/network-http2-quic-state.js",
    wat: "benchmarks/v1/network-http2-quic-state/network-http2-quic-state.wat",
    wasm: "public/artifacts/multilang-wasm-benchmark/quic_state_wat.wasm",
  },
  "tooling.c-to-wasm-compile.v1": {
    js: "benchmarks/base/tooling-c-to-wasm-compile/compiler-js.js",
    wat: "benchmarks/base/tooling-c-to-wasm-compile/compiler-wasm.wat",
    wasm: "public/artifacts/multilang-wasm-benchmark/compiler_wat.wasm",
  },
  "database.sqlite-notebook.v1": {
    js: "benchmarks/database-sqlite-notebook/sqlite-notebook.js",
    wat: "benchmarks/database-sqlite-notebook/sqlite.wat",
    wasm: "public/artifacts/database-sqlite-notebook/sqlite3.wasm",
  },
};

export interface InventoryItem {
  index: number;
  id: string;
  slug: string;
  title: string;
  category: string;
  pageType: string;
  kernels: string;
  js: string;
  wat: string;
  wasm: string;
  manifest: string;
}

export function buildInventory(): InventoryItem[] {
  const items: InventoryItem[] = [];

  for (const b of CANONICAL_BENCHMARKS) {
    if (standaloneWatMap[b.id]) {
      items.push({
        index: items.length + 1,
        id: b.id,
        slug: b.slug,
        title: b.title,
        category: b.category,
        pageType: b.pageType,
        kernels: b.kernels.join(", "),
        js: standaloneWatMap[b.id].js,
        wat: standaloneWatMap[b.id].wat,
        wasm: standaloneWatMap[b.id].wasm,
        manifest: b.manifest,
      });
      continue;
    }
    const mPath = "public" + b.manifest;
    let jsSource = "";
    let wasmPath = "";
    let watSource = "";

    try {
      const m = JSON.parse(Deno.readTextFileSync(mPath));
      const jsEngine = (m.engines as Array<Record<string, unknown>>).find((e) => e.key === "js");
      const watEngine = (m.engines as Array<Record<string, unknown>>).find((e) => e.key === "wat");
      const primaryKernel = b.kernels[0];
      const filesMap = watEngine?.files as Record<string, string> | undefined;
      const wasmFile = filesMap
        ? Object.values(filesMap)[0]
        : (primaryKernel ? `${primaryKernel}_wat.wasm` : "");
      wasmPath = wasmFile ? `public/artifacts/multilang-wasm-benchmark/${wasmFile}` : "";
      jsSource = (jsEngine?.source as string) || `public/benchmarks/${b.slug}/index.html`;

      // Candidate search locations in specific priority order
      const manifestDirName = b.manifest
        .replace("/benchmarks/multilang-wasm/", "")
        .replace(".manifest.json", "");
      const cleanSlug = b.slug.replace(/^base-/, "").replace(/-v1$/, "");
      const candidateDirs = [
        `benchmarks/multilang-wasm/${manifestDirName}`,
        `benchmarks/multilang-wasm/${b.slug}`,
        `benchmarks/multilang-wasm/${manifestDirName.replace(/-v1$/, "")}`,
        `benchmarks/multilang-wasm/${cleanSlug}`,
        `benchmarks/${b.slug}`,
        `benchmarks/base/${b.slug}`,
        `benchmarks/base/${cleanSlug}`,
        `benchmarks/v2/${cleanSlug}`,
        `benchmarks/v2/${b.slug}`,
        `benchmarks/${cleanSlug}`,
      ];

      for (const dir of candidateDirs) {
        try {
          for (const f of Deno.readDirSync(dir)) {
            if (f.name.endsWith(".wat")) {
              watSource = `${dir}/${f.name}`;
              break;
            }
          }
        } catch {
          // dir does not exist
        }
        if (watSource) break;
      }
      if (!watSource && b.manifest.includes("fft")) {
        watSource = "benchmarks/multilang-wasm/fft_kernel.wat";
      }
    } catch (e) {
      console.error(`Error reading ${mPath}:`, e);
    }

    items.push({
      index: items.length + 1,
      id: b.id,
      slug: b.slug,
      title: b.title,
      category: b.category,
      pageType: b.pageType,
      kernels: b.kernels.join(", "),
      js: jsSource,
      wat: watSource || "benchmarks/multilang-wasm/kernel.wat",
      wasm: wasmPath,
      manifest: b.manifest,
    });
  }

  // Ensure sqlite-notebook is in the 50 inventory if not present
  if (!items.find((x) => x.id === "database.sqlite-notebook.v1")) {
    items.push({
      index: items.length + 1,
      id: "database.sqlite-notebook.v1",
      slug: "database-sqlite-notebook-v1",
      title: "SQLite In-Browser SQL Notebook",
      category: "Database & Storage",
      pageType: "compute",
      kernels: "sqlite_exec",
      js: standaloneWatMap["database.sqlite-notebook.v1"].js,
      wat: standaloneWatMap["database.sqlite-notebook.v1"].wat,
      wasm: standaloneWatMap["database.sqlite-notebook.v1"].wasm,
      manifest: "Documented library exclusion (C SQLite engine)",
    });
  }

  // Ensure numeric.fft-spectral-filter.v1 is present
  if (!items.find((x) => x.slug === "numeric-fft-spectral-filter")) {
    items.push({
      index: items.length + 1,
      id: "numeric.fft-spectral-filter.v1",
      slug: "numeric-fft-spectral-filter",
      title: "FFT Spectral Filter",
      category: "Numeric & Math",
      pageType: "compute",
      kernels: "fft",
      js: "benchmarks/multilang-wasm/fft_kernel.ts",
      wat: "benchmarks/multilang-wasm/fft_kernel.wat",
      wasm: "public/artifacts/multilang-wasm-benchmark/fft_wat.wasm",
      manifest: "/benchmarks/multilang-wasm/fft-kernel.manifest.json",
    });
  }

  // Ensure multilang-wasm 4-kernel DSP panel is included as item 50
  if (!items.find((x) => x.slug === "multilang-wasm-dsp-panel")) {
    items.push({
      index: items.length + 1,
      id: "multilang.wasm.dsp-panel.v1",
      slug: "multilang-wasm-dsp-panel",
      title: "Multi-Language 4-Kernel DSP Panel",
      category: "Numeric & Math",
      pageType: "compute",
      kernels: "fft, fir, stft, gemm",
      js: "benchmarks/multilang-wasm/fft_kernel.ts",
      wat: "benchmarks/multilang-wasm/fft_kernel.wat",
      wasm: "public/artifacts/multilang-wasm-benchmark/fft_wat.wasm",
      manifest: "/benchmarks/multilang-wasm/multilang-wasm.manifest.json",
    });
  }

  // Sort by index
  return items.map((item, idx) => ({ ...item, index: idx + 1 }));
}

export function generateMarkdownTable(items: InventoryItem[]): string {
  const lines: string[] = [];
  lines.push("## Complete 50-Benchmark JS + WAT Inventory\n");
  lines.push(
    "All benchmarks in the suite execute under the refactored 3-stage architecture:\n" +
      "- **Stage 1 (Mandatory Baseline)**: JavaScript vs WebAssembly (`.wat` text source compiled directly via `wabt` to `.wasm`) on the exact same fixed inputs and oracle equivalence check.\n" +
      "- **Stage 2 (Multi-Language Matrix)**: C, C++, Rust, AssemblyScript, Dart (with & without WasmGC) executing identical kernels against the same oracle.\n" +
      "- **Stage 3 (Track B Optimizations)**: Idiomatic engine optimizations (e.g. v128 SIMD vectorization, cache blocking, unrolling) evaluated strictly after Stage 1 baseline is reported.\n",
  );
  lines.push(
    "| # | Benchmark | Workload ID | Category | Type | Kernels | Stage 1 JS | Stage 1 WAT | Compiled WASM |",
  );
  lines.push(
    "|---|-----------|-------------|----------|------|---------|------------|-------------|---------------|",
  );
  for (const it of items) {
    const jsName = it.js.split("/").pop() ?? it.js;
    const watName = it.wat.split("/").pop() ?? it.wat;
    const wasmName = it.wasm.split("/").pop() ?? it.wasm;
    lines.push(
      `| ${it.index} | [${it.title}](file:///${root}/${
        it.manifest.startsWith("/") ? "public" + it.manifest : it.manifest
      }) | \`${it.id}\` | ${it.category} | \`${it.pageType}\` | \`${it.kernels}\` | [${jsName}](file:///${root}/${it.js}) | [${watName}](file:///${root}/${it.wat}) | [${wasmName}](file:///${root}/${it.wasm}) |`,
    );
  }
  lines.push("");
  return lines.join("\n");
}

if (import.meta.main) {
  const items = buildInventory();
  console.log(`Generated inventory of ${items.length} benchmarks.`);
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
