import { generateVDOMFixture, runVdomJS, runVdomWasm } from "./engine.js";

const TARGETS = Object.freeze({
  "js-controlled": Object.freeze({
    label: "Controlled JavaScript diff with real browser DOM application",
    boundaryCrossings: 0,
  }),
  "wasm-linear-controlled": Object.freeze({
    label: "Linear Wasm diff with real browser DOM application",
    boundaryCrossings: 1,
  }),
});
const EXPECTED = Object.freeze({
  inputSha256: "e0cd8896cbcac384c7ca9d2c0bb97d0d15685c5c19038a1f5010159f77a08563",
  patchDigestSha256: "d56d2533821727e9b23af28622fb25b3e26011e2858eb7ab98232e81fafb3afd",
  canonicalHtmlSha256: "172478394b1ba6762f0b8804fe00d5d3b1a1bf52df1c56f5efefa7523e9d1d1c",
  nodesVisited: 4_000,
  patchesGenerated: 250,
  domMutations: 250,
});
const FULL_CONTRACT = Object.freeze({
  id: "dom.vdom-diff-patch.v1",
  status: "unavailable",
  reasonCode: "full-contract-not-implemented",
  detail:
    "The required 10,000-node and 2,000-edit full proposal contract is not implemented; this run is fixed at 1,000 nodes and 250 effective edits.",
});
const WASM_URL = "/artifacts/vdom-diff-patch/vdom-diff-patch.wasm";
let accepted = false;

async function fixtureSha256(fixture) {
  const bytes = new Uint8Array(fixture.flatA.byteLength + fixture.flatB.byteLength);
  bytes.set(fixture.flatA);
  bytes.set(fixture.flatB, fixture.flatA.byteLength);
  const digest = new Uint8Array(await crypto.subtle.digest("SHA-256", bytes));
  return [...digest].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

async function fetchWasm() {
  const response = await fetch(WASM_URL, { credentials: "omit", cache: "no-store" });
  if (!response.ok) throw new Error(`Wasm artifact returned HTTP ${response.status}`);
  const bytes = await response.arrayBuffer();
  return await WebAssembly.instantiate(await WebAssembly.compile(bytes), {});
}

function assertExact(result, target) {
  for (const key of ["nodesVisited", "patchesGenerated", "domMutations"]) {
    if (result[key] !== EXPECTED[key]) throw new Error(`${key} counter mismatch`);
  }
  if (result.boundaryCrossings !== TARGETS[target].boundaryCrossings) {
    throw new Error("boundaryCrossings counter mismatch");
  }
  if (result.patchDigestSha256 !== EXPECTED.patchDigestSha256) {
    throw new Error("patch-array oracle mismatch");
  }
  if (
    result.canonicalHtmlHash !== EXPECTED.canonicalHtmlSha256 ||
    result.targetHtmlHash !== EXPECTED.canonicalHtmlSha256
  ) throw new Error("patched-tree oracle mismatch");
}

async function execute(target) {
  if (!Object.hasOwn(TARGETS, target)) throw new Error("unknown target denied");
  const fixture = generateVDOMFixture();
  if (
    fixture.nodeCountA !== 1_000 || fixture.nodeCountB !== 1_000 ||
    fixture.expectedPatchCount !== 250
  ) throw new Error("reduced fixture dimensions changed");
  if (await fixtureSha256(fixture) !== EXPECTED.inputSha256) {
    throw new Error("reduced fixture input hash mismatch");
  }
  const result = target === "js-controlled"
    ? await runVdomJS(fixture)
    : await runVdomWasm(fixture, await fetchWasm());
  assertExact(result, target);
  return {
    target,
    targetLabel: TARGETS[target].label,
    fixtureLabel: "1,000 source nodes; 1,000 target nodes; 250 effective edits",
    inputSha256: EXPECTED.inputSha256,
    oracles: {
      "Canonical patch-array SHA-256": result.patchDigestSha256,
      "Patched-tree HTML SHA-256": result.canonicalHtmlHash,
    },
    counters: {
      nodesVisited: result.nodesVisited,
      patchesGenerated: result.patchesGenerated,
      domMutations: result.domMutations,
      boundaryCrossings: result.boundaryCrossings,
    },
    validation: "exact-worker-match; browser-DOM-application-pending",
    domApplication: {
      treeA: fixture.treeA,
      patches: result.patches,
      expectedCanonicalHtmlSha256: EXPECTED.canonicalHtmlSha256,
    },
    fullContract: FULL_CONTRACT,
  };
}

globalThis.addEventListener("message", async (event) => {
  const message = event.data;
  if (accepted || !message || message.type !== "run" || typeof message.token !== "string") return;
  accepted = true;
  try {
    globalThis.postMessage({
      type: "result",
      token: message.token,
      result: await execute(message.target),
    });
  } catch (error) {
    globalThis.postMessage({
      type: "error",
      token: message.token,
      message: error instanceof Error ? error.message : "worker failed",
    });
  }
});
