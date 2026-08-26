// The /demos/ tree was folded into /benchmarks/. Each retired demo route
// redirects to the benchmark page that replaced it.
//
// This lives here rather than inside the request handler because two things
// need it and they must not drift: the server, which answers the redirect, and
// scripts/build-coverage.ts, which has to know these routes are unreachable.
// While the table was private to server.ts the coverage report walked the
// still-present HTML files under public/demos/ and counted eight redirect
// stubs as "pages that measure nothing" — a summary line a reader would take
// as eight broken benchmarks.

/** Retired demo route (no trailing slash) → the benchmark page that replaced it. */
const CANONICAL_TARGETS = new Map<string, string>([
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
]);

/** Every redirected pathname, with and without its trailing slash. */
export const CANONICAL_DEMO_REDIRECTS: ReadonlyMap<string, string> = new Map(
  [...CANONICAL_TARGETS].flatMap(([from, to]) => [
    [from, to] as [string, string],
    [`${from}/`, to] as [string, string],
  ]),
);

/** True when the route is a redirect stub rather than a page that can be served. */
export function isRedirectedDemoRoute(route: string): boolean {
  return CANONICAL_DEMO_REDIRECTS.has(route) ||
    CANONICAL_DEMO_REDIRECTS.has(route.replace(/\/$/, ""));
}
