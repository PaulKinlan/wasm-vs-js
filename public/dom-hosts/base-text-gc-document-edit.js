// Real-DOM text.gc-document-edit host for the iframe orchestration bridge.
//
// Loads the frozen 10,000-edit fixture, computes the oracle via the JS model
// (executeFixture) or the REAL Kotlin WasmGC module
// (/artifacts/text-gc-document-edit/text-gc-document-edit.wasm + glue), then
// applies every edit to a REAL DOM document tree (createElement/insertBefore/
// removeChild/move) and serializes the rendered DOM back to the workload's
// canonical format — requiring byte-for-byte equality with the model's
// canonical oracle (the strongest rendered-vs-oracle check in the suite).
//
// Bridge contract: createTodomvcHost() export.

import { executeFixture, parseFixture } from "/benchmarks/v1/text-gc-document-edit/workload.js";

const WORKLOAD = "text-gc-document-edit-v1";
const FIXTURE_URL = "/artifacts/text-gc-document-edit/fixture.v1.txt";
const WASM_URL = "/artifacts/text-gc-document-edit/text-gc-document-edit.wasm";
const GLUE_URL = "/artifacts/text-gc-document-edit/text-gc-document-edit.mjs";
const IMPORTS_URL = "/artifacts/text-gc-document-edit/text-gc-document-edit.import-object.mjs";
const BUILTINS_URL = "/artifacts/text-gc-document-edit/text-gc-document-edit.js-builtins.mjs";

function median(values) {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.floor(sorted.length / 2)];
}

function statsFor(runs) {
  if (!runs || runs.length === 0) return null;
  const sorted = [...runs].sort((a, b) => a - b);
  return {
    coldMs: runs[0],
    warmMedianMs: median(runs),
    minMs: sorted[0],
    maxMs: sorted[sorted.length - 1],
    // The parent computes confidence intervals from these; a median alone
    // cannot say whether a difference was measured or observed once.
    samples: sorted,
  };
}

function escapeCanonical(value) {
  return value.replaceAll("\\", "\\\\").replaceAll("(", "\\(").replaceAll(")", "\\)")
    .replaceAll("[", "\\[").replaceAll("]", "\\]").replaceAll(":", "\\:");
}

async function fetchBytes(path) {
  const response = await fetch(path, { cache: "no-store" });
  if (!response.ok) throw new Error(`${path} returned ${response.status}`);
  return new Uint8Array(await response.arrayBuffer());
}

/** Real-DOM document: a tree of labelled nodes driven by the edit stream. */
function buildDocumentDom({ container, initial }) {
  const rootList = document.createElement("ul");
  rootList.dataset.wvjDocTree = "1";
  rootList.style.margin = "0";
  rootList.style.padding = "0 0 0 14px";
  rootList.style.listStyle = "none";
  rootList.style.maxHeight = "320px";
  rootList.style.overflow = "auto";
  rootList.style.border = "1px solid #555";
  rootList.style.background = "#101015";
  rootList.style.font = "11px ui-monospace, monospace";
  rootList.style.color = "#d8e2f2";

  const byId = new Map();
  const makeLi = (id, label) => {
    const li = document.createElement("li");
    li.dataset.wvjDocNode = "1";
    li.dataset.id = String(id);
    li.dataset.label = label;
    li.textContent = label;
    li.style.padding = "1px 6px";
    const ul = document.createElement("ul");
    ul.style.margin = "0";
    ul.style.padding = "0 0 0 14px";
    ul.style.listStyle = "none";
    li.append(ul);
    return { li, ul };
  };

  // initial tree (parentId -1 = root)
  for (const item of initial) {
    const node = { id: item.id, label: item.label, ...makeLi(item.id, item.label) };
    byId.set(item.id, node);
  }
  for (const item of initial) {
    const node = byId.get(item.id);
    if (item.parentId === -1) {
      rootList.append(node.li);
    } else {
      byId.get(item.parentId)?.ul.append(node.li);
    }
  }
  container.append(rootList);

  function applyOperation(op, domOpsRef) {
    if (op.kind === "insert") {
      const node = { id: op.id, label: op.label, ...makeLi(op.id, op.label) };
      byId.set(op.id, node);
      const parent = byId.get(op.parentId);
      const siblings = [...parent.ul.children];
      const before = siblings[op.position] ?? null;
      parent.ul.insertBefore(node.li, before);
      domOpsRef.n += 1;
    } else if (op.kind === "delete") {
      const node = byId.get(op.id);
      node.li.remove();
      byId.delete(op.id);
      domOpsRef.n += 1;
    } else {
      // reparent: move the node under its new parent at position
      const node = byId.get(op.id);
      node.li.remove();
      const parent = byId.get(op.parentId);
      const siblings = [...parent.ul.children];
      const before = siblings[op.position] ?? null;
      parent.ul.insertBefore(node.li, before);
      domOpsRef.n += 1;
    }
  }

  function serializeCanonical() {
    // walk the real DOM, replicating the workload's canonical format
    const render = (ul) => {
      let out = "";
      for (const li of ul.children) {
        const id = li.dataset.id;
        const label = li.dataset.label ?? li.textContent;
        const childUl = li.querySelector(":scope > ul");
        out += `(${id}:${escapeCanonical(label)}[${childUl ? render(childUl) : ""}])`;
      }
      return out;
    };
    return render(rootList);
  }

  function verify(finalCanonical, expectedFinalNodes) {
    const serialized = serializeCanonical();
    const ok = serialized === finalCanonical && byId.size === expectedFinalNodes;
    return {
      ok,
      firstBad: ok
        ? ""
        : `rendered canonical != oracle (${serialized.length} vs ${finalCanonical.length} chars, ${byId.size} vs ${expectedFinalNodes} nodes)`,
      serialized,
    };
  }

  return { rootList, applyOperation, verify };
}

async function runWasmGc(fixtureText) {
  const [wasmBytes, glueBytes, importsBytes, builtinsBytes] = await Promise.all([
    fetchBytes(WASM_URL),
    fetchBytes(GLUE_URL),
    fetchBytes(IMPORTS_URL),
    fetchBytes(BUILTINS_URL),
  ]);
  await WebAssembly.compile(wasmBytes, {
    builtins: ["js-string"],
    importedStringConstants: "'",
  });
  const decoder = new TextDecoder();
  const builtinsUrl = URL.createObjectURL(
    new Blob([builtinsBytes], { type: "text/javascript" }),
  );
  const importsSource = decoder.decode(importsBytes).replace(
    "'./text-gc-document-edit.js-builtins.mjs'",
    JSON.stringify(builtinsUrl),
  );
  const importsUrl = URL.createObjectURL(
    new Blob([importsSource], { type: "text/javascript" }),
  );
  const glueSource = decoder.decode(glueBytes).replace(
    "'./text-gc-document-edit.import-object.mjs'",
    JSON.stringify(importsUrl),
  );
  const glueUrl = URL.createObjectURL(new Blob([glueSource], { type: "text/javascript" }));
  globalThis.__TEXT_GC_DOCUMENT_EDIT_WASM_BYTES__ = wasmBytes;
  try {
    const module = await import(glueUrl);
    if (module.wasmGcFeatureProof() !== "0:array-backed child:1") {
      throw new Error("WasmGC managed-object feature proof failed");
    }
    return JSON.parse(module.runDocumentFixture(fixtureText));
  } finally {
    delete globalThis.__TEXT_GC_DOCUMENT_EDIT_WASM_BYTES__;
    URL.revokeObjectURL(glueUrl);
    URL.revokeObjectURL(importsUrl);
    URL.revokeObjectURL(builtinsUrl);
  }
}

export function createTodomvcHost() {
  return {
    run: async ({ iterations = 30, targets = ["js", "wasm"], onProgress = () => {} }) => {
      const fixtureText = new TextDecoder().decode(await fetchBytes(FIXTURE_URL));
      const { initial, operations } = parseFixture(fixtureText);

      const section = document.createElement("section");
      section.id = "wvj-todomvc-host";
      section.setAttribute("data-wvj-dom-host", WORKLOAD);
      section.style.margin = "16px 0";
      section.style.padding = "12px";
      section.style.border = "1px solid #666";
      section.style.borderRadius = "6px";
      section.style.background = "#101014";
      const heading = document.createElement("h2");
      heading.textContent = "Real DOM document tree (under test — frozen 10,000-edit stream)";
      heading.style.margin = "0 0 8px";
      heading.style.fontSize = "13px";
      heading.style.color = "#bcd";
      const note = document.createElement("p");
      note.textContent =
        "The oracle is computed by the JS model or the REAL Kotlin WasmGC module; the " +
        "rendered DOM applies every edit with real DOM APIs (createElement/insertBefore/" +
        "removeChild) and is serialized back to the canonical format which must match " +
        "the model's canonical oracle byte-for-byte.";
      note.style.margin = "0 0 10px";
      note.style.fontSize = "11px";
      note.style.color = "#89a";
      const container = document.createElement("div");
      container.dataset.wvjDocContainer = "1";
      section.append(heading, note, container);
      document.querySelector("#main")?.prepend(section);

      const measuredPass = async (target, { keep = false } = {}) => {
        const oracle = target === "wasm"
          ? await runWasmGc(fixtureText)
          : executeFixture(fixtureText, "js-controlled");
        const dom = buildDocumentDom({ container, initial });
        const t0 = performance.now();
        const ops = { n: 0 };
        for (const op of operations) dom.applyOperation(op, ops);
        const verified = dom.verify(oracle.canonical, oracle.counters["final-nodes"]);
        const ms = performance.now() - t0;
        if (!keep) dom.rootList.remove();
        return { ms, verified, domOps: ops.n };
      };

      const perTarget = {};
      for (const target of targets) {
        await measuredPass(target);
        const runs = [];
        for (let iteration = 1; iteration <= iterations; iteration++) {
          const isLast = iteration === iterations && target === targets[targets.length - 1];
          const { ms, verified } = await measuredPass(target, { keep: isLast });
          if (!verified.ok) {
            throw new Error(`real-DOM verification failed (${target}): ${verified.firstBad}`);
          }
          runs.push(ms);
          onProgress({ target, iteration, total: iterations });
        }
        perTarget[target] = statsFor(runs);
      }

      return {
        perTarget,
        detail: { workload: WORKLOAD, iterations, operations: operations.length },
      };
    },
  };
}
