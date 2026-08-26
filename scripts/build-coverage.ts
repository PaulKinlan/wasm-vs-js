// scripts/build-coverage.ts
//
// Generates public/data/coverage.v1.json — what each benchmark page actually
// measures, and what it does not.
//
// Coverage gaps were previously invisible: 44 multi-language manifests ship
// between 3 and 7 engines each, AssemblyScript and Dart are mutually exclusive
// in 37 of them, and nothing in the UI said so. AGENTS.md requires every
// benchmark to either ship the comparison or carry a documented exclusion; a
// gap nobody can see is neither.
//
// Usage:
//   deno run --allow-read --allow-write scripts/build-coverage.ts
//   deno run --allow-read scripts/build-coverage.ts --check

const ROOT = new URL("../", import.meta.url).pathname;

/** The engine set a fully covered kernel-capable workload offers. */
export const TARGET_ENGINES = ["js", "wat", "asc", "c", "cpp", "rs", "dart"] as const;

/** Manifest keys that mean the same engine. */
// "asc" is the canonical AssemblyScript key; "as" and the long form are
// historical spellings that still appear in a few manifests.
const ENGINE_ALIASES: Record<string, string> = { as: "asc", assemblyscript: "asc" };

export interface PageCoverage {
  slug: string;
  /** Path under /benchmarks/ or /demos/ — the key a twin is found by. */
  pathKey: string;
  route: string;
  title: string;
  /** Engines the page's multi-language manifest actually ships. */
  engines: string[];
  /** TARGET_ENGINES the page does not ship. */
  missingEngines: string[];
  manifestPath: string | null;
  /** Whether the page drives a rendered UI through the real-DOM stage. */
  domHost: string | null;
  /** Scopes the page can produce evidence for. */
  scopes: string[];
  duplicateOf: string | null;
  /**
   * Whether the page loads any runner that times the workload. Thirteen of the
   * sixteen /demos/ pages show a workload running without timing it, while
   * their /benchmarks/ twin times it.
   */
  measured: boolean;
  /**
   * Whether it uses the standard /unified-runner.js. Six benchmark pages time
   * their workload through a bespoke runner instead, which AGENTS.md treats as
   * a template-conformance gap: they get none of the shared scope separation,
   * confidence intervals or break-even analysis.
   */
  standardRunner: boolean;
}

function normaliseEngine(key: string): string {
  return ENGINE_ALIASES[key] ?? key;
}

async function readText(path: string): Promise<string | null> {
  try {
    return await Deno.readTextFile(path);
  } catch {
    return null;
  }
}

async function* walkIndexPages(dir: string): AsyncGenerator<string> {
  let entries: Deno.DirEntry[];
  try {
    entries = [...Deno.readDirSync(dir)];
  } catch {
    return;
  }
  for (const entry of entries) {
    const full = `${dir}/${entry.name}`;
    if (entry.isDirectory) {
      yield* walkIndexPages(full);
    } else if (entry.name === "index.html") {
      yield full;
    }
  }
}

async function* walkAll(dirs: string[]): AsyncGenerator<string> {
  for (const dir of dirs) yield* walkIndexPages(dir);
}

function attr(html: string, name: string): string | null {
  const m = html.match(new RegExp(`${name}\\s*=\\s*"([^"]*)"`));
  return m ? m[1] : null;
}

function titleOf(html: string, slug: string): string {
  const m = html.match(/<title>([^<]*)<\/title>/);
  return m ? m[1].split("·")[0].trim() : slug;
}

export async function buildCoverage(): Promise<{
  generatedAt: null;
  targetEngines: string[];
  pages: PageCoverage[];
  summary: Record<string, number>;
}> {
  const pages: PageCoverage[] = [];
  // Byte-identical page bodies keyed by content, so duplicated demo/benchmark
  // pairs are reported rather than counted twice.
  const bodies = new Map<string, string>();

  // Both trees are scanned. /demos/ and /benchmarks/ carry a page per workload
  // for 16 slugs; three pairs are byte-identical and the rest have drifted.
  // Reporting the duplication is the first step to removing it.
  const roots = [`${ROOT}public/benchmarks`, `${ROOT}public/demos`];
  for await (const file of walkAll(roots)) {
    const html = await readText(file);
    if (!html) continue;
    const rel = file.slice(`${ROOT}public`.length);
    const route = rel.replace(/index\.html$/, "");
    const pathKey = route.replace(/^\/(benchmarks|demos)\//, "").replace(/\/$/, "");
    const slug = attr(html, "data-workload") ?? attr(html, "data-demo") ?? pathKey;
    if (!slug) continue;

    const manifestPath = attr(html, "data-multilang-manifest");
    let engines: string[] = [];
    if (manifestPath) {
      const manifestFile = `${ROOT}public${manifestPath}`;
      const raw = await readText(manifestFile);
      if (raw) {
        try {
          const parsed = JSON.parse(raw);
          engines = (parsed.engines ?? [])
            .map((e: { key?: string }) => normaliseEngine(e.key ?? ""))
            .filter(Boolean);
        } catch {
          engines = [];
        }
      }
    }

    const standardRunner = html.includes("/unified-runner.js");
    // Any script whose name ends in -runner.js times the workload; several
    // pages predate the standard runner and ship their own.
    const measured = standardRunner || /src="[^"]*-runner\.js"/.test(html);
    const domHost = attr(html, "data-dom-host");
    const scopes: string[] = [];
    if (measured) {
      scopes.push("delivery", "pipeline");
      if (engines.length > 0) scopes.unshift("kernel");
      if (domHost) scopes.push("domJourney");
    }

    // Two kinds of duplication: a byte-identical page, and two routes for the
    // same workload slug. Both are reported.
    const key = html.trim();
    const identicalTo = bodies.has(key) ? bodies.get(key)! : null;
    if (!identicalTo) bodies.set(key, route);
    const samePath = pages.find((existing) => existing.pathKey === pathKey);
    const duplicateOf = identicalTo ?? (samePath ? samePath.route : null);

    pages.push({
      slug,
      pathKey,
      route,
      title: titleOf(html, slug),
      engines,
      missingEngines: engines.length > 0 ? TARGET_ENGINES.filter((e) => !engines.includes(e)) : [],
      manifestPath,
      domHost,
      scopes,
      duplicateOf,
      measured,
      standardRunner,
    });
  }

  pages.sort((a, b) => a.route.localeCompare(b.route));

  const summary = {
    pages: pages.length,
    withMultilang: pages.filter((p) => p.engines.length > 0).length,
    withoutMultilang: pages.filter((p) => p.engines.length === 0).length,
    fullyCovered: pages.filter((p) => p.engines.length > 0 && p.missingEngines.length === 0).length,
    withDomStage: pages.filter((p) => p.domHost).length,
    duplicates: pages.filter((p) => p.duplicateOf).length,
    unmeasuredPages: pages.filter((p) => !p.measured).length,
    bespokeRunnerPages: pages.filter((p) => p.measured && !p.standardRunner).length,
    distinctWorkloads: new Set(pages.map((p) => p.pathKey)).size,
  };

  // `generatedAt` is deliberately null: a timestamp would make this file
  // change on every build and defeat the --check gate.
  return { generatedAt: null, targetEngines: [...TARGET_ENGINES], pages, summary };
}

if (import.meta.main) {
  const coverage = await buildCoverage();
  const json = JSON.stringify(coverage, null, 2) + "\n";
  const out = `${ROOT}public/data/coverage.v1.json`;
  if (Deno.args.includes("--check")) {
    const existing = await readText(out);
    if (existing !== json) {
      console.error(
        "public/data/coverage.v1.json is stale — run scripts/build-coverage.ts",
      );
      Deno.exit(1);
    }
    console.log(`coverage up to date (${coverage.summary.pages} pages)`);
  } else {
    await Deno.writeTextFile(out, json);
    console.log(
      `wrote coverage.v1.json — ${coverage.summary.pages} pages, ` +
        `${coverage.summary.withMultilang} with multi-language, ` +
        `${coverage.summary.fullyCovered} with all ${TARGET_ENGINES.length} engines, ` +
        `${coverage.summary.withDomStage} with a real-DOM stage, ` +
        `${coverage.summary.duplicates} duplicate routes, ` +
        `${coverage.summary.unmeasuredPages} pages that measure nothing, ` +
        `${coverage.summary.bespokeRunnerPages} on a bespoke runner`,
    );
  }
}
