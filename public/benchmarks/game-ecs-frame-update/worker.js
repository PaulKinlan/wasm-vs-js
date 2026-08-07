import {
  instantiateEcsWasm,
  runEcsJavaScript,
  runEcsWasm,
} from "../../../benchmarks/v1/game-ecs-frame-update/engine.js";
import {
  ECS_VARIANTS,
  generateEcsFixture,
} from "../../../benchmarks/v1/game-ecs-frame-update/fixture.js";

import { WORKER_ANCHORS } from "../../../worker-anchors.generated.js";

const EXPECTED = Object.freeze({
  wasmSha256: WORKER_ANCHORS["game-ecs-frame-update"].wasmSha256,
  fixtureSha256: "9ad7ed255f244425f3da0d281f7dffcaa8a8923e03907d5ac0bf0322968df769",
  semanticDigest: "fe967b61",
  finalStateDigest: "4f0cc1ca",
  finalStateSha256: "c514e7e9f50a62707af610bca1bf222ff88061ccbf55aa711bcdc1929adc4210",
  checkpointDigest: "434e9372",
  pairTests: 27_086_270,
  collisions: 8_538,
  stateMutations: 30_113_243,
});

async function sha256(bytes) {
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return [...new Uint8Array(digest)].map((value) => value.toString(16).padStart(2, "0")).join("");
}
function stateBytes(words) {
  const bytes = new Uint8Array(words.length * 4);
  const view = new DataView(bytes.buffer);
  for (let index = 0; index < words.length; index += 1) {
    view.setUint32(index * 4, words[index], true);
  }
  return bytes;
}
function requireExactResult(result, finalStateSha256) {
  const failures = [];
  if (result.semanticDigest !== EXPECTED.semanticDigest) failures.push("semantic digest");
  if (result.oracle.finalStateDigest !== EXPECTED.finalStateDigest) failures.push("state digest");
  if (finalStateSha256 !== EXPECTED.finalStateSha256) failures.push("complete state SHA-256");
  if (result.oracle.checkpointDigest !== EXPECTED.checkpointDigest) {
    failures.push("checkpoint digest");
  }
  if (result.oracle.finalState.length !== 60_000) failures.push("complete state length");
  if (result.oracle.checkpoints.length !== 10) failures.push("checkpoint count");
  if (result.counters.frames !== 1_000 || result.counters.entities !== 10_000) {
    failures.push("fixed work");
  }
  if (result.counters.systemPasses !== 3_000) failures.push("system passes");
  if (result.counters.movementUpdates !== 10_000_000) failures.push("movement updates");
  if (result.counters.animationUpdates !== 10_000_000) failures.push("animation updates");
  if (result.counters.broadphaseInsertions !== 10_000_000) failures.push("grid insertions");
  if (result.counters.pairTests !== EXPECTED.pairTests) failures.push("pair tests");
  if (result.counters.collisions !== EXPECTED.collisions) failures.push("collisions");
  if (result.counters.stateMutations !== EXPECTED.stateMutations) failures.push("state mutations");
  if (
    result.variantId === "js-controlled" &&
    (result.counters.ownedBufferAllocations !== 9 || result.counters.boundaryCrossings !== 0)
  ) {
    failures.push("JavaScript target counters");
  }
  if (
    result.variantId === "wasm-linear-controlled" &&
    (result.counters.ownedBufferAllocations !== 0 || result.counters.boundaryCrossings !== 2)
  ) {
    failures.push("Wasm target counters");
  }
  if (failures.length) throw new Error(`Exact ECS checks failed: ${failures.join(", ")}.`);
}

self.addEventListener("message", async (event) => {
  const message = event.data;
  if (!message || message.type !== "start" || !Number.isSafeInteger(message.token)) return;
  const { token, variantId } = message;
  if (!ECS_VARIANTS.includes(variantId)) {
    self.postMessage({ type: "error", token, message: "Target is not in the fixed allowlist." });
    return;
  }
  try {
    const fixture = generateEcsFixture();
    if (await sha256(fixture) !== EXPECTED.fixtureSha256) throw new Error("Fixture hash mismatch.");
    let result;
    if (variantId === "js-controlled") {
      result = runEcsJavaScript(fixture);
    } else {
      const response = await fetch("/artifacts/game-ecs-frame-update-v1/ecs-frame-update.wasm", {
        cache: "no-store",
      });
      if (!response.ok) throw new Error(`Wasm fetch failed with ${response.status}.`);
      const bytes = new Uint8Array(await response.arrayBuffer());
      if (await sha256(bytes) !== EXPECTED.wasmSha256) {
        throw new Error("Wasm artifact hash mismatch.");
      }
      result = runEcsWasm(await instantiateEcsWasm(bytes), fixture);
    }
    const finalStateSha256 = await sha256(stateBytes(result.oracle.finalState));
    requireExactResult(result, finalStateSha256);
    const safeResult = {
      ...result,
      oracle: {
        ...result.oracle,
        finalState: undefined,
        finalStateWords: result.oracle.finalState.length,
        finalStateSha256,
      },
    };
    self.postMessage({ type: "result", token, result: safeResult });
  } catch (error) {
    self.postMessage({
      type: "error",
      token,
      message: error instanceof Error ? error.message : "Worker failed.",
    });
  }
});
