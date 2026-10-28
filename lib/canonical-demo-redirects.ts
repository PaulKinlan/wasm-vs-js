// lib/canonical-demo-redirects.ts
// Permanent 301 redirects for retired /demos/ routes and clean URL aliases
// pointing to their canonical benchmark runner pages.

/** Map of retired route (with or without trailing slash) -> canonical target URL */
const CANONICAL_TARGETS = new Map<string, string>([
  // The 16 retired /demos/ paths
  ["/demos/base/network-http2-quic-state", "/benchmarks/base/network-http2-quic-state/"],
  ["/demos/base/text.regex-log-scan.v1", "/benchmarks/base/text.regex-log-scan.v1/"],
  ["/demos/cad-parametric-bracket", "/benchmarks/cad-parametric-bracket/"],
  ["/demos/crypto.file-integrity.v1", "/benchmarks/crypto.file-integrity.v1/"],
  ["/demos/game-canvas-arcade", "/benchmarks/game-canvas-arcade/"],
  ["/demos/game-canvas-entity-pathfinding", "/benchmarks/game-canvas-entity-pathfinding/"],
  ["/demos/game-dom-tactics-grid", "/benchmarks/game-dom-tactics-grid/"],
  ["/demos/game-ecs-frame-update", "/benchmarks/game-ecs-frame-update/"],
  ["/demos/network.pcap-decode.v1", "/benchmarks/network.pcap-decode.v1/"],
  ["/demos/numeric.polybench-panel.v1", "/benchmarks/numeric.polybench-panel.v1/"],
  ["/demos/serialization.json-telemetry.v1", "/benchmarks/serialization.json-telemetry.v1/"],
  ["/demos/server.ssr-template.v1", "/benchmarks/server.ssr-template.v1/"],
  ["/demos/simulation-nbody-cloth", "/benchmarks/simulation-nbody-cloth/"],
  ["/demos/text.diff-patch.v1", "/benchmarks/text.diff-patch.v1/"],
  ["/demos/text.gc-document-edit.v1", "/benchmarks/text.gc-document-edit.v1/"],
  ["/demos/text.markdown-cms.v1", "/benchmarks/text.markdown-cms.v1/"],

  // Clean benchmark aliases
  ["/benchmarks/archive-zip-workspace", "/benchmarks/archive-zip-workspace-v1/"],
  ["/benchmarks/cad-mesh-repair", "/benchmarks/cad-mesh-repair-v1/"],
  ["/benchmarks/crypto-file-integrity", "/benchmarks/crypto.file-integrity.v1/"],
  ["/benchmarks/document-pdf-viewer", "/benchmarks/document-pdf-viewer-v1/"],
  ["/benchmarks/dom-todomvc-journey", "/benchmarks/base-dom-todomvc-journey/"],
  ["/benchmarks/dom-virtualized-grid", "/benchmarks/dom-virtualized-grid-v1/"],
  ["/benchmarks/graphics-cpu-path-tracer", "/benchmarks/graphics-cpu-path-tracer-v1/"],
  ["/benchmarks/image-editing", "/benchmarks/image-editing-demo/"],
  ["/benchmarks/image-flood-fill", "/benchmarks/image-flood-fill-demo/"],
  ["/benchmarks/ml-keyword-spotting", "/benchmarks/ml-keyword-spotting-v1/"],
  ["/benchmarks/ml-numeric-kernels", "/benchmarks/ml-numeric-kernels-v1/"],
  ["/benchmarks/network-pcap-decode", "/benchmarks/network.pcap-decode.v1/"],
  ["/benchmarks/numeric-fft-spectral-filter", "/benchmarks/numeric-fft-spectral-filter-v1/"],
  ["/benchmarks/numeric-polybench-panel", "/benchmarks/numeric.polybench-panel.v1/"],
  ["/benchmarks/regex-automata-duel", "/benchmarks/regex-automata-duel-demo/"],
  ["/benchmarks/serialization-json-telemetry", "/benchmarks/serialization.json-telemetry.v1/"],
  ["/benchmarks/server-ssr-template", "/benchmarks/server.ssr-template.v1/"],
  ["/benchmarks/simulation-rigid-body-2d", "/benchmarks/simulation-rigid-body-2d-v1/"],
  ["/benchmarks/text-diff-patch", "/benchmarks/text.diff-patch.v1/"],
  ["/benchmarks/text-gc-document-edit", "/benchmarks/text.gc-document-edit.v1/"],
  ["/benchmarks/text-markdown-cms", "/benchmarks/text.markdown-cms.v1/"],
  ["/benchmarks/text-regex-log-scan", "/benchmarks/base/text.regex-log-scan.v1/"],
  ["/benchmarks/vdom-diff-patch", "/benchmarks/vdom-diff-patch-demo/"],
]);

/** Every redirected pathname, with and without its trailing slash. */
export const CANONICAL_DEMO_REDIRECTS: ReadonlyMap<string, string> = new Map(
  [...CANONICAL_TARGETS].flatMap(([from, to]) => {
    const cleanFrom = from.replace(/\/$/, "");
    return [
      [cleanFrom, to] as [string, string],
      [`${cleanFrom}/`, to] as [string, string],
    ];
  }),
);

/** True when the route is a redirect stub rather than a page that can be served. */
export function isRedirectedDemoRoute(route: string): boolean {
  return CANONICAL_DEMO_REDIRECTS.has(route) ||
    CANONICAL_DEMO_REDIRECTS.has(route.replace(/\/$/, ""));
}
