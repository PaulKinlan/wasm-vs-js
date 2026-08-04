/// <reference lib="webworker" />
// Physics half of scripts/build-rigid-body-2d.ts: the 1800-timestep JS
// reference run is ~7s of sync CPU that is independent of the clang/wasm-ld
// compile. Running it on a worker thread overlaps the two. The engine import
// is the same unmodified pinned module; only the fixture crosses in and the
// result crosses out.
import { runRigidBodyJavaScript } from "../benchmarks/v1/simulation-rigid-body-2d/engine.js";

self.onmessage = (event: MessageEvent<{ fixture: Uint8Array }>) => {
  const result = runRigidBodyJavaScript(event.data.fixture);
  self.postMessage(result);
};
