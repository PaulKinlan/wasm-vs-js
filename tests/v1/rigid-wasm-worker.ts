/// <reference lib="webworker" />
// Worker half of the rigid-body differential test: runs the wasm physics
// against a snapshot of the committed artifact while the main thread runs
// the JS physics and the builder rebuilds in its own process. Imports the
// same unmodified engine; instrumentation callbacks run in-worker and only
// their results cross the boundary.
import {
  instantiateRigidBodyWasm,
  runRigidBodyWasm,
} from "../../benchmarks/v1/simulation-rigid-body-2d/engine.js";

interface SeedJob {
  fixture: Uint8Array;
  options: { timesteps: number; checkpointEvery: number; allowTestFixture: boolean };
}
interface Job {
  wasmBytes: Uint8Array;
  seeds: SeedJob[];
  bigFixture: Uint8Array;
}

self.onmessage = async (event: MessageEvent<Job>) => {
  const { wasmBytes, seeds, bigFixture } = event.data;
  const wasm = await instantiateRigidBodyWasm(wasmBytes);
  const seedResults = seeds.map(({ fixture, options }) => runRigidBodyWasm(fixture, wasm, options));
  let wasmAllocations = 0;
  const boundaries: string[] = [];
  const big = runRigidBodyWasm(bigFixture, wasm, {
    onAllocate: () => wasmAllocations++,
    onBoundary: (name: string) => boundaries.push(name),
  });
  self.postMessage({ seedResults, big, wasmAllocations, boundaries });
};
