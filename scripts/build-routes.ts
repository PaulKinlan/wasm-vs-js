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
  ".mjs": "text/javascript; charset=utf-8",
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
  ".wat": "text/plain; charset=utf-8",
  ".c": "text/plain; charset=utf-8",
  ".cpp": "text/plain; charset=utf-8",
  ".h": "text/plain; charset=utf-8",
  ".rs": "text/plain; charset=utf-8",
  ".ts": "text/plain; charset=utf-8",
  ".dart": "text/plain; charset=utf-8",
  ".kt": "text/plain; charset=utf-8",
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
  if (fileExists(join(PUBLIC, "methodology", "index.html"))) {
    routes.push(["/methodology", "public/methodology/index.html", "text/html; charset=utf-8"]);
    routes.push(["/methodology/", "public/methodology/index.html", "text/html; charset=utf-8"]);
  }
  return routes;
}

// ---------------------------------------------------------------------------
// Assets routed here instead of in server.ts.
//
// server.ts carries its own hand-maintained `routes` Map for root-level data
// files and for the multilang artifact directory. Its bytes are sha256-pinned
// by 17 provenance manifests under public/artifacts and public/evidence, so
// adding one filename to that list invalidates all of them and forces the
// two-commit re-bind described in AGENTS.md — re-running ~14 builders, 10 of
// which recompile C/C++/Rust and would replace committed artifact bytes.
// Routing new assets through the generated table keeps server.ts untouched.
//
// This is an explicit reviewed list, not a directory scan. A scan of
// public/data and public/artifacts/multilang-wasm-benchmark would also have
// published three files nobody chose to serve — benchmark-validation-logs.v1.json,
// mlp_forward_wat.wasm, and a committed Rust object file
// (grid_kernel_rs.…-cgu.0.rcgu.o) — which is route widening by accident.
// Every entry below is checked to exist and to not collide with a name
// server.ts already claims; server.ts's own duplicate check on
// GENERATED_ROUTES is the backstop.
// ---------------------------------------------------------------------------
const GENERATED_ASSET_ROUTES: ReadonlyArray<string> = [
  // Symmetric warm-worker probe & reusable module worker (loaded by public/unified-runner.js).
  "warm-worker-probe.js",
  "warm-worker-probe-worker.js",
  // Track B registry, read by public/benchmarks/track-b/track-b.js.
  "data/track-b.v1.json",
  // Dart -O2/-O3/-O4 lane report (scripts/build-multilang-dart-opt.ts).
  "data/multilang-dart-opt.v1.json",
  // AssemblyScript cache-blocking lane report (scripts/build-multilang-asc-opt.ts).
  "data/multilang-asc-opt.v1.json",
  // Oracle-equivalence attestation (scripts/attest-oracle-equivalence.ts).
  "data/oracle-equivalence.v1.json",
  // Track B AssemblyScript optimization variants for ml.gemm.v1.
  "artifacts/multilang-wasm-benchmark/gemm_asc_ikj.wasm",
  "artifacts/multilang-wasm-benchmark/gemm_asc_tiled.wasm",
  // Track B Dart optimization variants for ml.gemm.v1.
  "artifacts/multilang-wasm-benchmark/gemm_dart_o2.wasm",
  "artifacts/multilang-wasm-benchmark/gemm_dart_o2.mjs",
  "artifacts/multilang-wasm-benchmark/gemm_dart_o3.wasm",
  "artifacts/multilang-wasm-benchmark/gemm_dart_o3.mjs",
  "artifacts/multilang-wasm-benchmark/gemm_dart_o4.wasm",
  "artifacts/multilang-wasm-benchmark/gemm_dart_o4.mjs",
  // Dart/WasmGC engine for text.gc-document-edit.v1.
  "artifacts/multilang-wasm-benchmark/gc_document_kernel_dart.wasm",
  "artifacts/multilang-wasm-benchmark/gc_document_kernel_dart.mjs",
  // Track B C/C++/Rust optimization variants for ml.gemm.v1.
  "artifacts/multilang-wasm-benchmark/gemm_c_ikj.wasm",
  "artifacts/multilang-wasm-benchmark/gemm_c_tiled.wasm",
  "artifacts/multilang-wasm-benchmark/gemm_c_ikj_simd.wasm",
  "artifacts/multilang-wasm-benchmark/gemm_c_simd_dot.wasm",
  "artifacts/multilang-wasm-benchmark/gemm_cpp_ikj.wasm",
  "artifacts/multilang-wasm-benchmark/gemm_cpp_tiled.wasm",
  "artifacts/multilang-wasm-benchmark/gemm_cpp_ikj_simd.wasm",
  "artifacts/multilang-wasm-benchmark/gemm_rs_ikj.wasm",
  "artifacts/multilang-wasm-benchmark/gemm_rs_tiled.wasm",
  "artifacts/multilang-wasm-benchmark/gemm_rs_ikj_simd.wasm",
  // Track B C/Rust optimization variants for numeric.polybench-panel.v1.
  "artifacts/multilang-wasm-benchmark/polybench_c_opt.wasm",
  "artifacts/multilang-wasm-benchmark/polybench_c_simd.wasm",
  "artifacts/multilang-wasm-benchmark/polybench_rs_simd.wasm",
  // Linear Wasm coverage completions (C on ml.numeric-kernels.v1, Rust on network.pcap-decode.v1).
  "artifacts/multilang-wasm-benchmark/numeric_kernels_c.wasm",
  "artifacts/multilang-wasm-benchmark/pcap_decode_rs.wasm",
  // Canonical catalog
  "data/benchmarks.json",
  // Wasm kernels and SIMD variants
  "artifacts/multilang-wasm-benchmark/arcade_kernel_wat.wasm",
  "artifacts/multilang-wasm-benchmark/audio_dsp_kernel_wat.wasm",
  "artifacts/multilang-wasm-benchmark/bracket_wat.wasm",
  "artifacts/multilang-wasm-benchmark/compiler_wat.wasm",
  "artifacts/multilang-wasm-benchmark/crypto_wat.wasm",
  "artifacts/multilang-wasm-benchmark/dom_vscroll_wat.wasm",
  "artifacts/multilang-wasm-benchmark/ecs_frame_update_wat.wasm",
  "artifacts/multilang-wasm-benchmark/fft_wat.wasm",
  "artifacts/multilang-wasm-benchmark/form_validate_kernel_wat.wasm",
  "artifacts/multilang-wasm-benchmark/gc_document_kernel_wat.wasm",
  "artifacts/multilang-wasm-benchmark/gemm_wat_simd.wasm",
  "artifacts/multilang-wasm-benchmark/grid_kernel_wat.wasm",
  "artifacts/multilang-wasm-benchmark/grid_trace_kernel_wat.wasm",
  "artifacts/multilang-wasm-benchmark/keyed_list_kernel_wat.wasm",
  "artifacts/multilang-wasm-benchmark/kws_kernel_wat.wasm",
  "artifacts/multilang-wasm-benchmark/markdown_cms_kernel_wat.wasm",
  "artifacts/multilang-wasm-benchmark/mesh_repair_wat.wasm",
  "artifacts/multilang-wasm-benchmark/myers_diff_wat.wasm",
  "artifacts/multilang-wasm-benchmark/nbody_step_wat.wasm",
  "artifacts/multilang-wasm-benchmark/nested_tree_kernel_wat.wasm",
  "artifacts/multilang-wasm-benchmark/numeric_kernels_wat.wasm",
  "artifacts/multilang-wasm-benchmark/olap_wat.wasm",
  "artifacts/multilang-wasm-benchmark/path_tracer_wat.wasm",
  "artifacts/multilang-wasm-benchmark/pathfinding_kernel_wat.wasm",
  "artifacts/multilang-wasm-benchmark/pcap_decode_wat.wasm",
  "artifacts/multilang-wasm-benchmark/pdf_engine_wat.wasm",
  "artifacts/multilang-wasm-benchmark/protobuf_gateway_kernel_wat.wasm",
  "artifacts/multilang-wasm-benchmark/quic_state_wat.wasm",
  "artifacts/multilang-wasm-benchmark/regex_scan_kernel_wat.wasm",
  "artifacts/multilang-wasm-benchmark/rigid_wat.wasm",
  "artifacts/multilang-wasm-benchmark/scan_log_wat.wasm",
  "artifacts/multilang-wasm-benchmark/server_ssr_kernel_wat.wasm",
  "artifacts/multilang-wasm-benchmark/sha256_wat.wasm",
  "artifacts/multilang-wasm-benchmark/sum_wat_simd.wasm",
  "artifacts/multilang-wasm-benchmark/table_sort_kernel_wat.wasm",
  "artifacts/multilang-wasm-benchmark/tactics_kernel_wat.wasm",
  "artifacts/multilang-wasm-benchmark/telemetry_wat.wasm",
  "artifacts/multilang-wasm-benchmark/todomvc_engine_wat.wasm",
  "artifacts/multilang-wasm-benchmark/vdom_kernel_wat.wasm",
  "artifacts/multilang-wasm-benchmark/viewer_wat.wasm",
  "artifacts/multilang-wasm-benchmark/zip_kernel_wat.wasm",
  // Pre-computed Track B Auto-Research log & isolated SIMD128 binaries (scripts/run-autoresearch.ts).
  "data/autoresearch-log.v1.json",
  // Source-audited per-test worker lifecycle ledger (scripts/audit-worker-lifecycle.ts).
  "data/worker-lifecycle.v1.json",
  // Provenance-tagged standalone Deno/V8 reference snapshot (scripts/build-reference-snapshot.ts).
  "data/reference-snapshot.v1.json",
  "artifacts/autoresearch/archive-zip-workspace-v1_c_simd128.wasm",
  "artifacts/autoresearch/audio-fft_c_simd128.wasm",
  "artifacts/autoresearch/audio-fir_c_simd128.wasm",
  "artifacts/autoresearch/audio-stft_c_simd128.wasm",
  "artifacts/autoresearch/audio-webaudio-effects-v1_c_simd128.wasm",
  "artifacts/autoresearch/base-dom-todomvc-journey_c_simd128.wasm",
  "artifacts/autoresearch/cad-mesh-repair_c_simd128.wasm",
  "artifacts/autoresearch/cad-parametric-bracket_c_simd128.wasm",
  "artifacts/autoresearch/crypto-authenticated-stream_c_simd128.wasm",
  "artifacts/autoresearch/crypto-file-integrity_c_simd128.wasm",
  "artifacts/autoresearch/database-olap-chart_c_simd128.wasm",
  "artifacts/autoresearch/document-pdf-viewer_c_simd128.wasm",
  "artifacts/autoresearch/dom-dependent-form-validation_c_simd128.wasm",
  "artifacts/autoresearch/dom-grid-movement_c_simd128.wasm",
  "artifacts/autoresearch/dom-keyed-list-mutation_c_simd128.wasm",
  "artifacts/autoresearch/dom-nested-tree-mutation_c_simd128.wasm",
  "artifacts/autoresearch/dom-table-sort-filter-pagination_c_simd128.wasm",
  "artifacts/autoresearch/dom-virtualized-grid-v1_c_simd128.wasm",
  "artifacts/autoresearch/fft-kernel_c_simd128.wasm",
  "artifacts/autoresearch/game-canvas-arcade_c_simd128.wasm",
  "artifacts/autoresearch/game-canvas-entity-pathfinding_c_simd128.wasm",
  "artifacts/autoresearch/game-dom-tactics-grid_c_simd128.wasm",
  "artifacts/autoresearch/game-ecs-frame-update_c_simd128.wasm",
  "artifacts/autoresearch/graphics-cpu-path-tracer_c_simd128.wasm",
  "artifacts/autoresearch/graphics-gltf-viewer_c_simd128.wasm",
  "artifacts/autoresearch/image-editing_c_simd128.wasm",
  "artifacts/autoresearch/ml-dense-mlp_c_simd128.wasm",
  "artifacts/autoresearch/ml-gemm_c_simd128.wasm",
  "artifacts/autoresearch/ml-keyword-spotting-v1_c_simd128.wasm",
  "artifacts/autoresearch/ml-numeric-kernels_c_simd128.wasm",
  "artifacts/autoresearch/multilang-wasm_c_simd128.wasm",
  "artifacts/autoresearch/network-pcap-decode_c_simd128.wasm",
  "artifacts/autoresearch/numeric-polybench-panel_c_simd128.wasm",
  "artifacts/autoresearch/regex-automata-duel-demo_c_simd128.wasm",
  "artifacts/autoresearch/serialization-json-telemetry_c_simd128.wasm",
  "artifacts/autoresearch/serialization-protobuf-gateway_c_simd128.wasm",
  "artifacts/autoresearch/server-ssr-template-v1_c_simd128.wasm",
  "artifacts/autoresearch/simulation-nbody-cloth_c_simd128.wasm",
  "artifacts/autoresearch/simulation-rigid-body-2d_c_simd128.wasm",
  "artifacts/autoresearch/sum-u32_c_simd128.wasm",
  "artifacts/autoresearch/text-diff-patch_c_simd128.wasm",
  "artifacts/autoresearch/text-gc-document-edit_c_simd128.wasm",
  "artifacts/autoresearch/text-markdown-cms_c_simd128.wasm",
  "artifacts/autoresearch/text-regex-log-scan_c_simd128.wasm",
  "artifacts/autoresearch/vdom-diff-patch_c_simd128.wasm",
];

function assetRoutes(): Array<readonly [string, string, string]> {
  const serverSrc = Deno.readTextFileSync(join(ROOT_PATH, "server.ts"));
  return GENERATED_ASSET_ROUTES.map((rel) => {
    const file = `public/${rel}`;
    if (!fileExists(join(ROOT_PATH, file))) {
      throw new Error(`GENERATED_ASSET_ROUTES names a missing file: ${file}`);
    }
    const name = rel.slice(rel.lastIndexOf("/") + 1);
    // `"name"` covers the literal filename lists server.ts loops over;
    // `rel` covers its fully-spelled route entries.
    if (serverSrc.includes(`"${name}"`) || serverSrc.includes(rel)) {
      throw new Error(`server.ts already routes ${rel} — remove it from GENERATED_ASSET_ROUTES`);
    }
    return [`/${rel}`, file, contentTypeFor(name)] as const;
  });
}

// Explicit reviewed repo-root source & build-documentation files exposed for UI
// source inspectability without modifying hash-pinned server.ts.
const GENERATED_REPO_SOURCE_ROUTES: ReadonlyArray<string> = [
  "benchmarks/audio-fft/audio-fft.wat",
  "benchmarks/audio-fft/js.ts",
  "benchmarks/audio-fft/workload.ts",
  "benchmarks/audio-fir/audio-fir.wat",
  "benchmarks/audio-fir/js.ts",
  "benchmarks/audio-fir/workload.ts",
  "benchmarks/audio-stft/audio-stft.wat",
  "benchmarks/audio-stft/js.ts",
  "benchmarks/audio-stft/workload.ts",
  "benchmarks/base-v1/graphics-cpu-path-tracer/path-tracer.c",
  "benchmarks/base/audio-webaudio-effects/audio-webaudio-effects.wat",
  "benchmarks/base/cad-mesh-repair/mesh-repair.c",
  "benchmarks/base/cad-parametric-bracket/bracket.c",
  "benchmarks/base/crypto-authenticated-stream/aead.c",
  "benchmarks/base/crypto-file-integrity/sha256.c",
  "benchmarks/base/database-olap-chart/olap.c",
  "benchmarks/base/document-pdf-viewer/pdf-engine.c",
  "benchmarks/base/dom-virtualized-grid/grid.c",
  "benchmarks/base/graphics-gltf-viewer/viewer.c",
  "benchmarks/base/ml-keyword-spotting/keyword-spotting.c",
  "benchmarks/base/ml-numeric-kernels/ml-numeric-kernels.c",
  "benchmarks/base/network-pcap-decode/pcap-decode.c",
  "benchmarks/base/numeric-fft-spectral-filter/numeric-fft-spectral-filter.wat",
  "benchmarks/base/numeric-polybench-panel/polybench-panel.wat",
  "benchmarks/base/serialization-protobuf-gateway/protobuf-gateway.c",
  "benchmarks/base/simulation-nbody/nbody.c",
  "benchmarks/dom-dependent-form-validation/dom_form_validate.c",
  "benchmarks/dom-grid-movement/dom_grid.c",
  "benchmarks/dom-keyed-list-mutation/dom_keyed_list.c",
  "benchmarks/dom-nested-tree-mutation/dom_nested_tree.c",
  "benchmarks/dom-table-sort-filter-pagination/dom_table_sort.c",
  "benchmarks/dom-virtualized-scrolling/dom_vscroll.c",
  "benchmarks/multilang-wasm/ml-gemm/gemm_ikj.js",
  "benchmarks/multilang-wasm/numeric-polybench-panel/polybench_opt.js",
  "benchmarks/sum-u32/sum-u32.wat",
  "benchmarks/text-regex-log-scan/text-regex-log-scan.wat",
  "benchmarks/v1/archive-zip-workspace/archive_zip.c",
  "benchmarks/v1/game-ecs-frame-update/ecs-frame-update.c",
  "benchmarks/v1/network-http2-quic-state/network-http2-quic-state.c",
  "benchmarks/v1/serialization-json-telemetry/telemetry.c",
  "benchmarks/v1/server-ssr-template/server-ssr-template.c",
  "benchmarks/v1/simulation-rigid-body-2d/rigid-body-2d.c",
  "benchmarks/v1/text-gc-document-edit/kotlin/src/wasmJsMain/kotlin/Main.kt",
  "benchmarks/v2/game-family/game-family.c",
  "benchmarks/v2/text-diff-patch/text-diff-patch.wat",
  "benchmarks/v2/text-markdown-cms/text-markdown-cms.wat",
  "docs/autoresearch-log.md",
  "docs/wasm-build-and-equivalence.md",
  "docs/worker-lifecycle-audit.md",
];

function repoSourceRoutes(): Array<readonly [string, string, string]> {
  const serverSrc = Deno.readTextFileSync(join(ROOT_PATH, "server.ts"));
  return GENERATED_REPO_SOURCE_ROUTES.map((rel) => {
    if (!fileExists(join(ROOT_PATH, rel))) {
      throw new Error(`GENERATED_REPO_SOURCE_ROUTES names a missing file: ${rel}`);
    }
    const routePath = `/${rel}`;
    if (serverSrc.includes(`"${routePath}"`)) {
      throw new Error(
        `server.ts already routes ${routePath} — remove it from GENERATED_REPO_SOURCE_ROUTES`,
      );
    }
    return [routePath, rel, contentTypeFor(rel)] as const;
  });
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
  "audio.webaudio-effects.v1": "base-audio-webaudio-effects-v1",
  "cad.mesh-repair.v1": "cad-mesh-repair-v1",
  "cad.parametric-bracket.v1": "cad-parametric-bracket",
  "crypto.authenticated-stream.v1": "crypto-authenticated-stream",
  "crypto.file-integrity.v1": "crypto-file-integrity-v1",
  "database.olap-chart.v1": "database-olap-chart",
  // Unlisted with the playground card: the page runs and reports no results.
  // Restore this line and the card in public/playground.js together.
  // "database.sqlite-notebook.v1": "database-sqlite-notebook-v1",
  "document.pdf-viewer.v1": "document-pdf-viewer-v1",
  "dom.todomvc-journey.v1": "base-dom-todomvc-journey",
  "dom.virtualized-grid.v1": "dom-virtualized-grid-v1",
  "game.ecs-frame-update.v1": "game-ecs-frame-update",
  "graphics.cpu-path-tracer.v1": "graphics-cpu-path-tracer-v1",
  "graphics.gltf-viewer.v1": "base-gltf-viewer",
  "ml.keyword-spotting.v1": "ml-keyword-spotting-v1",
  "ml.numeric-kernels.v1": "ml-numeric-kernels-v1",
  "network.http2-quic-state.v1": "network-http2-quic-state",
  "network.pcap-decode.v1": "network-pcap-decode-v1",
  "numeric.fft-spectral-filter.v1": "numeric-fft-spectral-filter-v1",
  "numeric.polybench-panel.v1": "numeric-polybench-panel-v1",
  "serialization.json-telemetry.v1": "serialization-json-telemetry-v1",
  "serialization.protobuf-gateway.v1": "serialization-protobuf-gateway",
  "server.ssr-template.v1": "server-ssr-template-v1",
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

function emitCatalogRoutesJs(cardRoutesUnsorted: Map<string, string>): string {
  const cardRoutes = new Map([...cardRoutesUnsorted].sort((a, b) => a[0] < b[0] ? -1 : 1));
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
  const routes = [...scanPages(), ...assetRoutes(), ...repoSourceRoutes()];
  const cardRoutes = parseCardRoutes();

  routes.sort((a, b) => a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : 0);
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
