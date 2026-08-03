import {
  generateRegexFixture,
  scanJSAutomata,
  scanNativeRegExp,
  scanWasmAutomata,
} from "./engine.js";

const TARGETS = Object.freeze({
  "js-native-controlled": Object.freeze({
    label: "Native JavaScript RegExp",
    boundaryCrossings: 0,
  }),
  "js-automata-controlled": Object.freeze({
    label: "Project Thompson-NFA JavaScript",
    boundaryCrossings: 0,
  }),
  "wasm-automata-controlled": Object.freeze({
    label: "Project Thompson-to-DFA linear Wasm scanner",
    boundaryCrossings: 20,
  }),
});
const EXPECTED = Object.freeze({
  inputSha256: "511c892cd731b740afae39f7c053be4455a6c1cd4a7dd7ac4fc09f92859d072e",
  oracleHash: "09034692437c8a59f1c82015c0b4e3483de7124ced5d56f1de44eac989b4b3c0",
  codePointsSearched: 20_971_520,
  patternsExecuted: 20,
  matchesFound: 141_605,
  capturesExtracted: 1_623,
});
const FULL_CONTRACT = Object.freeze({
  id: "text.regex-engine-duel.v1",
  status: "unavailable",
  reasonCode: "full-contract-not-implemented",
  detail:
    "The required 32 MiB corpus and 40-pattern full proposal contract are not implemented; this run is fixed at 1 MiB and 20 patterns.",
});
const WASM_URL = "/artifacts/regex-automata-duel/regex-automata-duel.wasm";
let accepted = false;

function canonicalizeJson(value) {
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(canonicalizeJson).join(",")}]`;
  return `{${
    Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${canonicalizeJson(value[key])}`)
      .join(",")
  }}`;
}

async function fixtureSha256(fixture) {
  const patternBytes = new TextEncoder().encode(canonicalizeJson(fixture.patterns));
  const bytes = new Uint8Array(fixture.textBuffer.byteLength + patternBytes.byteLength);
  bytes.set(fixture.textBuffer);
  bytes.set(patternBytes, fixture.textBuffer.byteLength);
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
  for (
    const key of [
      "codePointsSearched",
      "patternsExecuted",
      "matchesFound",
      "capturesExtracted",
    ]
  ) {
    if (result[key] !== EXPECTED[key]) throw new Error(`${key} counter mismatch`);
  }
  if (result.boundaryCrossings !== TARGETS[target].boundaryCrossings) {
    throw new Error("boundaryCrossings counter mismatch");
  }
  if (result.oracleHash !== EXPECTED.oracleHash) throw new Error("match-tuple oracle mismatch");
}

async function execute(target) {
  if (!Object.hasOwn(TARGETS, target)) throw new Error("unknown target denied");
  const fixture = generateRegexFixture();
  if (
    fixture.textBuffer.byteLength !== 1_048_576 || fixture.textCodePoints !== 1_048_576 ||
    fixture.patterns.length !== 20
  ) throw new Error("reduced fixture dimensions changed");
  if (await fixtureSha256(fixture) !== EXPECTED.inputSha256) {
    throw new Error("reduced fixture input hash mismatch");
  }

  let result;
  if (target === "js-native-controlled") result = await scanNativeRegExp(fixture);
  else if (target === "js-automata-controlled") result = await scanJSAutomata(fixture);
  else result = await scanWasmAutomata(fixture, await fetchWasm());
  assertExact(result, target);
  return {
    target,
    targetLabel: TARGETS[target].label,
    fixtureLabel: "1,048,576 BMP code points; 20 frozen patterns",
    inputSha256: EXPECTED.inputSha256,
    oracles: { "Ordered match-tuple SHA-256": result.oracleHash },
    counters: {
      codePointsSearched: result.codePointsSearched,
      patternsExecuted: result.patternsExecuted,
      matchesFound: result.matchesFound,
      capturesExtracted: result.capturesExtracted,
      boundaryCrossings: result.boundaryCrossings,
    },
    validation: "exact-match",
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
