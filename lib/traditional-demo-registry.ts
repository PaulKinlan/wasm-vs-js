export interface TraditionalDemoRoute {
  path: string;
  file: string;
  contentType: string;
}

export const TRADITIONAL_DEMO_ROUTES: readonly TraditionalDemoRoute[] = Object.freeze([
  {
    path: "/benchmarks/regex-automata-duel-demo",
    file: "public/benchmarks/regex-automata-duel-demo/index.html",
    contentType: "text/html; charset=utf-8",
  },
  {
    path: "/benchmarks/regex-automata-duel-demo/",
    file: "public/benchmarks/regex-automata-duel-demo/index.html",
    contentType: "text/html; charset=utf-8",
  },
  {
    path: "/benchmarks/vdom-diff-patch-demo",
    file: "public/benchmarks/vdom-diff-patch-demo/index.html",
    contentType: "text/html; charset=utf-8",
  },
  {
    path: "/benchmarks/vdom-diff-patch-demo/",
    file: "public/benchmarks/vdom-diff-patch-demo/index.html",
    contentType: "text/html; charset=utf-8",
  },
  {
    path: "/benchmarks/traditional-demo.css",
    file: "public/benchmarks/traditional-demo.css",
    contentType: "text/css; charset=utf-8",
  },
  {
    path: "/benchmarks/traditional-demo.js",
    file: "public/benchmarks/traditional-demo.js",
    contentType: "text/javascript; charset=utf-8",
  },
  {
    path: "/benchmarks/regex-automata-duel-demo/worker.js",
    file: "public/benchmarks/regex-automata-duel-demo/worker.js",
    contentType: "text/javascript; charset=utf-8",
  },
  {
    path: "/benchmarks/regex-automata-duel-demo/engine.js",
    file: "public/benchmarks/regex-automata-duel-demo/engine.js",
    contentType: "text/javascript; charset=utf-8",
  },
  {
    path: "/benchmarks/vdom-diff-patch-demo/worker.js",
    file: "public/benchmarks/vdom-diff-patch-demo/worker.js",
    contentType: "text/javascript; charset=utf-8",
  },
  {
    path: "/benchmarks/vdom-diff-patch-demo/engine.js",
    file: "public/benchmarks/vdom-diff-patch-demo/engine.js",
    contentType: "text/javascript; charset=utf-8",
  },
  {
    path: "/benchmarks/regex-automata-duel/benchmark.json",
    file: "benchmarks/regex-automata-duel/benchmark.json",
    contentType: "application/json; charset=utf-8",
  },
  {
    path: "/benchmarks/regex-automata-duel/workload.js",
    file: "benchmarks/regex-automata-duel/workload.js",
    contentType: "text/javascript; charset=utf-8",
  },
  {
    path: "/benchmarks/regex-automata-duel/input.ts",
    file: "benchmarks/regex-automata-duel/input.ts",
    contentType: "text/plain; charset=utf-8",
  },
  {
    path: "/benchmarks/regex-automata-duel/js-native.ts",
    file: "benchmarks/regex-automata-duel/js-native.ts",
    contentType: "text/plain; charset=utf-8",
  },
  {
    path: "/benchmarks/regex-automata-duel/js-automata.ts",
    file: "benchmarks/regex-automata-duel/js-automata.ts",
    contentType: "text/plain; charset=utf-8",
  },
  {
    path: "/benchmarks/regex-automata-duel/regex-automata.wat",
    file: "benchmarks/regex-automata-duel/regex-automata.wat",
    contentType: "text/plain; charset=utf-8",
  },
  {
    path: "/benchmarks/vdom-diff-patch/benchmark.json",
    file: "benchmarks/vdom-diff-patch/benchmark.json",
    contentType: "application/json; charset=utf-8",
  },
  {
    path: "/benchmarks/vdom-diff-patch/workload.js",
    file: "benchmarks/vdom-diff-patch/workload.js",
    contentType: "text/javascript; charset=utf-8",
  },
  {
    path: "/benchmarks/vdom-diff-patch/input.ts",
    file: "benchmarks/vdom-diff-patch/input.ts",
    contentType: "text/plain; charset=utf-8",
  },
  {
    path: "/benchmarks/vdom-diff-patch/js.ts",
    file: "benchmarks/vdom-diff-patch/js.ts",
    contentType: "text/plain; charset=utf-8",
  },
  {
    path: "/benchmarks/vdom-diff-patch/vdom-diff-patch.wat",
    file: "benchmarks/vdom-diff-patch/vdom-diff-patch.wat",
    contentType: "text/plain; charset=utf-8",
  },
  {
    path: "/artifacts/regex-automata-duel/regex-automata-duel.wasm",
    file: "public/artifacts/regex-automata-duel/regex-automata-duel.wasm",
    contentType: "application/wasm",
  },
  {
    path: "/artifacts/regex-automata-duel/build-manifest.json",
    file: "public/artifacts/regex-automata-duel/build-manifest.json",
    contentType: "application/json; charset=utf-8",
  },
  {
    path: "/artifacts/vdom-diff-patch/vdom-diff-patch.wasm",
    file: "public/artifacts/vdom-diff-patch/vdom-diff-patch.wasm",
    contentType: "application/wasm",
  },
  {
    path: "/artifacts/vdom-diff-patch/build-manifest.json",
    file: "public/artifacts/vdom-diff-patch/build-manifest.json",
    contentType: "application/json; charset=utf-8",
  },
  {
    path: "/artifacts/traditional-demos/demo-manifest.v1.json",
    file: "public/artifacts/traditional-demos/demo-manifest.v1.json",
    contentType: "application/json; charset=utf-8",
  },
  {
    path: "/data/traditional-demo-manifest.schema.json",
    file: "schemas/traditional-demo-manifest.schema.json",
    contentType: "application/schema+json; charset=utf-8",
  },
]);

export const TRADITIONAL_DEMO_ASSET_PATHS = Object.freeze([
  "/benchmarks/traditional-demo.css",
  "/benchmarks/traditional-demo.js",
  "/benchmarks/regex-automata-duel-demo/worker.js",
  "/benchmarks/regex-automata-duel-demo/engine.js",
  "/benchmarks/vdom-diff-patch-demo/worker.js",
  "/benchmarks/vdom-diff-patch-demo/engine.js",
  "/artifacts/regex-automata-duel/regex-automata-duel.wasm",
  "/artifacts/vdom-diff-patch/vdom-diff-patch.wasm",
]);
