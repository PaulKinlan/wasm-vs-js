// scripts/build-site.ts
// Static site builder and canonical benchmark catalog validator.
//
// Usage:
//   deno run --allow-read --allow-write scripts/build-site.ts
//   deno run --allow-read scripts/build-site.ts --check

const ROOT = new URL("../", import.meta.url).pathname;

export interface BenchmarkCatalogEntry {
  slug: string;
  id: string;
  title: string;
  category: string;
  pageType: string;
  summary: string;
  whatItDoes: string;
  whyCompare: string;
  manifest: string;
  kernels: string[];
}

export async function buildSite(check = false): Promise<void> {
  const catalogPath = `${ROOT}catalog/benchmarks.json`;
  const publicDataPath = `${ROOT}public/data/benchmarks.json`;
  const methodologyPath = `${ROOT}public/methodology/index.html`;

  const catalogText = await Deno.readTextFile(catalogPath);
  const catalog = JSON.parse(catalogText);
  if (!Array.isArray(catalog) || catalog.length === 0) {
    throw new Error("catalog/benchmarks.json must contain a non-empty array");
  }

  // Ensure every entry has required fields
  for (const b of catalog as BenchmarkCatalogEntry[]) {
    if (!b.slug || !b.id || !b.title || !b.category || !b.manifest || !Array.isArray(b.kernels)) {
      throw new Error(`Benchmark entry missing required fields: ${JSON.stringify(b)}`);
    }
  }

  const formattedCatalog = JSON.stringify(catalog, null, 2) + "\n";
  if (check) {
    const existing = await Deno.readTextFile(publicDataPath).catch(() => "");
    if (existing !== formattedCatalog) {
      throw new Error("public/data/benchmarks.json is stale; run scripts/build-site.ts");
    }
    const hasMethodology = await Deno.stat(methodologyPath).then(() => true).catch(() => false);
    if (!hasMethodology) {
      throw new Error("public/methodology/index.html missing");
    }
    console.log(`site-check: ${catalog.length} canonical benchmarks validated`);
  } else {
    await Deno.writeTextFile(publicDataPath, formattedCatalog);
    console.log(`wrote public/data/benchmarks.json (${catalog.length} benchmarks)`);
  }
}

if (import.meta.main) {
  const check = Deno.args.includes("--check");
  await buildSite(check);
}
