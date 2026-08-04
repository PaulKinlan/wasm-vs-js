// scripts/build-routes.ts
//
// Generates:
//   1. routes.generated.ts              — server-side route table for demo pages + companions
//   2. public/workload-catalog-routes.generated.js — browser WORKLOAD_DEMO_ROUTES module
//
// Usage:
//   deno run --allow-read --allow-write scripts/build-routes.ts            # write outputs
//   deno run --allow-read --allow-write scripts/build-routes.ts --check    # gate mode
//
// Design: filesystem scan is truth for routes; card registry is truth for slug→route.

// Inlined path helpers (no remote imports: deno.lock bytes are hash-pinned).
function join(...parts: string[]): string {
  return parts.join("/").replace(/\/+/g, "/").replace(/\/$/, "");
}
function relative(from: string, to: string): string {
  const f = from.replace(/\/$/, "") + "/";
  return to.startsWith(f) ? to.slice(f.length) : to;
}
function extname(file: string): string {
  const i = file.lastIndexOf(".");
  return i > 0 ? file.slice(i) : "";
}

const ROOT_PATH = new URL("../", import.meta.url).pathname;
const PUBLIC = join(ROOT_PATH, "public");
const CATALOG_V1 = join(ROOT_PATH, "catalog", "workloads.v1.json");
const CATALOG_V2 = join(ROOT_PATH, "catalog", "workloads.v2.proposed.json");
const PLAYGROUND_JS = join(ROOT_PATH, "public", "playground.js");

const CONTENT_TYPES: Record<string, string> = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".wasm": "application/wasm",
  ".stl": "model/stl",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".svg": "image/svg+xml",
  ".ico": "image/x-icon",
  ".wav": "audio/wav",
  ".pcm": "application/octet-stream",
  ".bin": "application/octet-stream",
  ".data": "application/octet-stream",
  ".md": "text/markdown; charset=utf-8",
  ".txt": "text/plain; charset=utf-8",
};

function contentTypeFor(file: string): string {
  return CONTENT_TYPES[extname(file)] ?? "application/octet-stream";
}

/** Directory prefixes owned by the image/traditional demo registries
 * (parsed from the registry sources — single owner per route). */
function registryOwnedDirs(): string[] {
  const dirs = new Set<string>();
  for (const lib of ["lib/image-demo-registry.ts", "lib/traditional-demo-registry.ts"]) {
    const src = Deno.readTextFileSync(join(ROOT_PATH, lib));
    for (const m of src.matchAll(/path:\s*"((?:\/benchmarks|\/demos)\/[^"/]+)\/?"/g)) {
      dirs.add("public" + m[1]);
    }
  }
  return [...dirs];
}

/** Scan public/benchmarks + public/demos for pages and companion assets. */
function scanPages(): Array<readonly [string, string, string, boolean?]> {
  const owned = registryOwnedDirs();
  const routes: Array<readonly [string, string, string, boolean?]> = [];
  for (const area of ["benchmarks", "demos"]) {
    const areaRoot = join(PUBLIC, area);
    for (const dir of walkDirs(areaRoot)) {
      const index = join(dir, "index.html");
      if (!fileExists(index)) continue;
      const rel = relative(PUBLIC, dir); // e.g. benchmarks/foo or demos/bar
      const relPublic = "public/" + rel;
      if (owned.some((o) => relPublic === o || relPublic.startsWith(o + "/"))) continue;
      const urlBase = "/" + rel.split("/").join("/");
      const pageFile = `public/${rel}/index.html`;
      routes.push([urlBase, pageFile, "text/html; charset=utf-8"]);
      routes.push([`${urlBase}/`, pageFile, "text/html; charset=utf-8"]);
      for (const name of sortedDir(dir)) {
        if (name === "index.html" || name === "index.template.html" || name.startsWith(".")) {
          continue;
        }
        const file = join(dir, name);
        if (!isFile(file)) continue;
        const assetRel = `public/${rel}/${name}`;
        routes.push([`${urlBase}/${name}`, assetRel, contentTypeFor(name)]);
      }
    }
  }
  return routes;
}

/** Parse slug → route from public/playground.js card registry. */
function parseCardRoutes(): Map<string, string> {
  const src = Deno.readTextFileSync(PLAYGROUND_JS);
  const slugRe = /slug:\s*"([^"]+)"/g;
  const routeRe = /route:\s*"([^"]+)"/g;
  const slugs = [...src.matchAll(slugRe)].map((m) => m[1]);
  const routes = [...src.matchAll(routeRe)].map((m) => m[1]);
  const map = new Map<string, string>();
  const n = Math.min(slugs.length, routes.length);
  for (let i = 0; i < n; i++) map.set(slugs[i], routes[i]);
  if (slugs.length !== routes.length) {
    throw new Error(
      `playground.js card registry parse mismatch: ${slugs.length} slugs vs ${routes.length} routes`,
    );
  }
  return map;
}

/** Load catalog ids (v1 ∪ v2). */
function loadCatalogIds(): string[] {
  const ids: string[] = [];
  for (const path of [CATALOG_V1, CATALOG_V2]) {
    if (!fileExists(path)) continue;
    const data = JSON.parse(Deno.readTextFileSync(path));
    const entries = data.entries ?? data.proposals ?? [];
    for (const e of entries) if (typeof e.id === "string") ids.push(e.id);
  }
  return ids;
}

// ---------------------------------------------------------------------------
// Reviewed, hand-maintained linkage: catalog id → playground slug.
// This is the ONLY table that cannot be mechanically derived (v2 demo dir names
// are not id-transforms). Both ends are machine-verified by the gate.
// ---------------------------------------------------------------------------
const CATALOG_ID_TO_SLUG: Record<string, string> = {
  // v1 catalog
  "archive.zip-workspace.v1": "archive-zip-workspace-v1",
  "audio.webaudio-effects.v1": "audio-webaudio-effects-v1",
  "cad.mesh-repair.v1": "cad-mesh-repair-v1",
  "cad.parametric-bracket.v1": "cad-parametric-bracket",
  "crypto.authenticated-stream.v1": "crypto-authenticated-stream",
  "crypto.file-integrity.v1": "crypto-file-integrity",
  "database.olap-chart.v1": "database-olap-chart",
  "database.sqlite-notebook.v1": "database-sqlite-notebook-v1",
  "document.pdf-viewer.v1": "document-pdf-viewer-v1",
  "dom.todomvc-journey.v1": "base-dom-todomvc-journey",
  "dom.virtualized-grid.v1": "dom-virtualized-grid-v1",
  "game.ecs-frame-update.v1": "game-ecs-frame-update",
  "graphics.cpu-path-tracer.v1": "graphics-cpu-path-tracer-v1",
  "graphics.gltf-viewer.v1": "base-gltf-viewer",
  "ml.keyword-spotting.v1": "ml-keyword-spotting-v1",
  "ml.numeric-kernels.v1": "ml-numeric-kernels",
  "network.http2-quic-state.v1": "network-http2-quic-state",
  "network.pcap-decode.v1": "network-pcap-decode-v1",
  "numeric.fft-spectral-filter.v1": "numeric-fft-spectral-filter-v1",
  "numeric.polybench-panel.v1": "numeric-polybench-panel-v1",
  "serialization.json-telemetry.v1": "serialization-json-telemetry",
  "serialization.protobuf-gateway.v1": "serialization-protobuf-gateway",
  "server.ssr-template.v1": "server-ssr-template",
  "simulation.nbody-cloth.v1": "simulation-nbody-cloth",
  "simulation.rigid-body-2d.v1": "simulation-rigid-body-2d-v1",
  "text.gc-document-edit.v1": "text-gc-document-edit-v1",
  "text.regex-log-scan.v1": "text-regex-log-scan",
  "tooling.c-to-wasm-compile.v1": "tooling-c-to-wasm-compile-v1",
  // v2 proposals
  "audio.fft.v1": "audio-fft",
  "audio.fir.v1": "audio-fir",
  "audio.stft.v1": "audio-stft",
  "dom.dependent-form-validation.v1": "dom-dependent-form-validation",
  "dom.grid-movement.v1": "dom-grid-movement",
  "dom.keyed-list-mutation.v1": "dom-keyed-list-mutation",
  "dom.nested-tree-mutation.v1": "dom-nested-tree-mutation",
  "dom.table-sort-filter-pagination.v1": "dom-table-sort-filter-pagination",
  "dom.vdom-diff-patch.v1": "vdom-diff-patch-demo",
  "dom.virtualized-scrolling.v1": "dom-virtualized-scrolling",
  "game.canvas-arcade.v1": "game-canvas-arcade",
  "game.canvas-entity-pathfinding.v1": "game-canvas-entity-pathfinding",
  "game.dom-tactics-grid.v1": "game-dom-tactics-grid",
  "image.editing-pipeline.v1": "image-editing-demo",
  "image.flood-fill.v1": "image-flood-fill-demo",
  "ml.dense-mlp.v1": "ml-dense-mlp",
  "ml.gemm.v1": "ml-gemm",
  "text.diff-patch.v1": "text-diff-patch",
  "text.markdown-cms.v1": "text-markdown-cms",
  "text.regex-engine-duel.v1": "regex-automata-duel-demo",
};

function emitRoutesTs(routes: Array<readonly [string, string, string, boolean?]>): string {
  const lines = [
    "// GENERATED by scripts/build-routes.ts — do not edit by hand.",
    "// Regenerate: deno run --allow-read --allow-write scripts/build-routes.ts",
    "// Companion-asset + page routes derived from public/benchmarks and public/demos.",
    "export const GENERATED_ROUTES: ReadonlyArray<readonly [string, readonly [string, string, (boolean | undefined)?]]> = [",
  ];
  for (const [path, file, ct, localOnly] of routes) {
    const tuple = localOnly
      ? `  ["${path}", ["${file}", "${ct}", true]],`
      : `  ["${path}", ["${file}", "${ct}"]],`;
    lines.push(tuple);
  }
  lines.push("];", "");
  return lines.join("\n");
}

function emitCatalogRoutesJs(cardRoutes: Map<string, string>): string {
  const catalogIds = loadCatalogIds();
  const missing: string[] = [];
  const lines = [
    "// GENERATED by scripts/build-routes.ts — do not edit by hand.",
    "// Regenerate: deno run --allow-read --allow-write scripts/build-routes.ts",
    "// Catalog id → demo route, derived from catalog ids + playground.js card registry.",
    "export const WORKLOAD_DEMO_ROUTES = {",
  ];
  const rows: string[] = [];
  for (const id of catalogIds) {
    const slug = CATALOG_ID_TO_SLUG[id];
    if (!slug) {
      missing.push(id);
      continue;
    }
    const route = cardRoutes.get(slug);
    if (!route) {
      missing.push(`${id} (slug ${slug} has no card route)`);
      continue;
    }
    rows.push(`  "${id}": "${route}",`);
  }
  lines.push(...rows, "};", "");
  const warn = missing.length
    ? `\n// NOTE: catalog ids without a demo route (${missing.length}):\n//   ${
      missing.join(", ")
    }\n`
    : "";
  return lines.join("\n") + warn;
}

// --- tiny fs helpers (no deps) ---------------------------------------------

function walkDirs(root: string): string[] {
  const out: string[] = [];
  try {
    for (const entry of Deno.readDirSync(root)) {
      if (!entry.isDirectory) continue;
      const full = join(root, entry.name);
      out.push(full, ...walkDirs(full));
    }
  } catch {
    // root missing — fine
  }
  return out;
}

function sortedDir(dir: string): string[] {
  try {
    return [...Deno.readDirSync(dir)].map((e) => e.name).sort();
  } catch {
    return [];
  }
}

function fileExists(p: string): boolean {
  try {
    return Deno.statSync(p).isFile;
  } catch {
    return false;
  }
}

function isFile(p: string): boolean {
  try {
    return Deno.statSync(p).isFile;
  } catch {
    return false;
  }
}

// --- main -------------------------------------------------------------------

function main(): void {
  const check = Deno.args.includes("--check");
  const routes = scanPages();
  const cardRoutes = parseCardRoutes();

  const routesTs = emitRoutesTs(routes);
  const catalogJs = emitCatalogRoutesJs(cardRoutes);

  const out1 = join(ROOT_PATH, "routes.generated.ts");
  const out2 = join(ROOT_PATH, "public", "workload-catalog-routes.generated.js");

  if (check) {
    let dirty = false;
    for (const [path, expected] of [[out1, routesTs], [out2, catalogJs]] as const) {
      if (!fileExists(path) || Deno.readTextFileSync(path) !== expected) {
        console.error(`STALE: ${path}`);
        dirty = true;
      }
    }
    if (dirty) {
      console.error("routes.generated.* drift — regenerate with scripts/build-routes.ts");
      Deno.exit(1);
    }
    console.log(
      `routes generated files up to date (${routes.length} routes, ${cardRoutes.size} card routes)`,
    );
    return;
  }

  Deno.writeTextFileSync(out1, routesTs);
  Deno.writeTextFileSync(out2, catalogJs);
  console.log(`wrote ${out1} (${routes.length} routes)`);
  console.log(`wrote ${out2} (${cardRoutes.size} card routes indexed)`);
}

main();
