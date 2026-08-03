export interface ImageDemoRoute {
  path: string;
  file: string;
  contentType: string;
}

export const IMAGE_DEMO_ROUTES: readonly ImageDemoRoute[] = Object.freeze([
  {
    path: "/benchmarks/image-flood-fill-demo",
    file: "public/benchmarks/image-flood-fill-demo/index.html",
    contentType: "text/html; charset=utf-8",
  },
  {
    path: "/benchmarks/image-flood-fill-demo/",
    file: "public/benchmarks/image-flood-fill-demo/index.html",
    contentType: "text/html; charset=utf-8",
  },
  {
    path: "/benchmarks/image-editing-demo",
    file: "public/benchmarks/image-editing-demo/index.html",
    contentType: "text/html; charset=utf-8",
  },
  {
    path: "/benchmarks/image-editing-demo/",
    file: "public/benchmarks/image-editing-demo/index.html",
    contentType: "text/html; charset=utf-8",
  },
  {
    path: "/benchmarks/image-demo.css",
    file: "public/benchmarks/image-demo.css",
    contentType: "text/css; charset=utf-8",
  },
  {
    path: "/benchmarks/image-demo.js",
    file: "public/benchmarks/image-demo.js",
    contentType: "text/javascript; charset=utf-8",
  },
  {
    path: "/benchmarks/image-demo-worker.js",
    file: "public/benchmarks/image-demo-worker.js",
    contentType: "text/javascript; charset=utf-8",
  },
  {
    path: "/benchmarks/image-demo-worker-core.js",
    file: "public/benchmarks/image-demo-worker-core.js",
    contentType: "text/javascript; charset=utf-8",
  },
  {
    path: "/benchmarks/image-demo-controller.js",
    file: "public/benchmarks/image-demo-controller.js",
    contentType: "text/javascript; charset=utf-8",
  },
  {
    path: "/benchmarks/image-demo-js-engine.js",
    file: "public/benchmarks/image-demo-js-engine.js",
    contentType: "text/javascript; charset=utf-8",
  },
  {
    path: "/benchmarks/image-demo-engine.js",
    file: "public/benchmarks/image-demo-engine.js",
    contentType: "text/javascript; charset=utf-8",
  },
  {
    path: "/benchmarks/image-editing/js.ts",
    file: "benchmarks/image-editing/js.ts",
    contentType: "text/plain; charset=utf-8",
  },
  {
    path: "/benchmarks/image-editing/wasm.ts",
    file: "benchmarks/image-editing/wasm.ts",
    contentType: "text/plain; charset=utf-8",
  },
  {
    path: "/benchmarks/image-editing/contract.ts",
    file: "benchmarks/image-editing/contract.ts",
    contentType: "text/plain; charset=utf-8",
  },
  {
    path: "/benchmarks/image-editing/image-editing.wat",
    file: "benchmarks/image-editing/image-editing.wat",
    contentType: "text/plain; charset=utf-8",
  },
  {
    path: "/artifacts/image-editing-demo/image-editing.wasm",
    file: "public/artifacts/image-editing-demo/image-editing.wasm",
    contentType: "application/wasm",
  },
  {
    path: "/artifacts/image-editing-demo/generated-map-64x48.rgba",
    file: "public/artifacts/image-editing-demo/generated-map-64x48.rgba",
    contentType: "application/octet-stream",
  },
  {
    path: "/artifacts/image-editing-demo/generated-photo-40x30.rgba",
    file: "public/artifacts/image-editing-demo/generated-photo-40x30.rgba",
    contentType: "application/octet-stream",
  },
  {
    path: "/artifacts/image-editing-demo/demo-manifest.v1.json",
    file: "public/artifacts/image-editing-demo/demo-manifest.v1.json",
    contentType: "application/json; charset=utf-8",
  },
  {
    path: "/data/image-demo-manifest.schema.json",
    file: "schemas/image-demo-manifest.schema.json",
    contentType: "application/schema+json; charset=utf-8",
  },
]);

export const IMAGE_DEMO_ASSET_PATHS = Object.freeze([
  "/benchmarks/image-demo.css",
  "/benchmarks/image-demo.js",
  "/benchmarks/image-demo-worker.js",
  "/benchmarks/image-demo-worker-core.js",
  "/benchmarks/image-demo-controller.js",
  "/benchmarks/image-demo-js-engine.js",
  "/benchmarks/image-demo-engine.js",
  "/artifacts/image-editing-demo/image-editing.wasm",
  "/artifacts/image-editing-demo/generated-map-64x48.rgba",
  "/artifacts/image-editing-demo/generated-photo-40x30.rgba",
]);
