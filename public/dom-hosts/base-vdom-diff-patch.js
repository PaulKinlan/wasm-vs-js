// Real-DOM vdom-diff-patch host for the iframe orchestration bridge.
//
// Builds a REAL DOM tree from the frozen 1,000-node fixture, computes the
// diff (JS or the REAL Wasm kernel /artifacts/vdom-diff-patch/vdom-diff-patch.wasm),
// applies the 250 patches with real DOM APIs (DOMHostAdapter: createElement /
// createTextNode / setAttribute / replaceChild / removeChild / appendChild),
// then serializes the rendered DOM back to canonical HTML and requires it to
// match the treeB oracle byte-for-byte.
//
// Bridge contract: createTodomvcHost() export (shared message validator).

import {
  DOMHostAdapter,
  generateVDOMFixture,
  runVdomJS,
  runVdomWasm,
  serializeVDOMToCanonicalHTML,
} from "/benchmarks/vdom-diff-patch-demo/engine.js";

const WORKLOAD = "vdom-diff-patch-demo";
const WASM_URL = "/artifacts/vdom-diff-patch/vdom-diff-patch.wasm";

function median(values) {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.floor(sorted.length / 2)];
}

function statsFor(runs) {
  const sorted = [...runs].sort((a, b) => a - b);
  return {
    coldMs: runs[0],
    warmMedianMs: median(runs),
    minMs: sorted[0],
    maxMs: sorted[sorted.length - 1],
  };
}

async function fetchWasm() {
  const response = await fetch(WASM_URL, { credentials: "omit", cache: "no-store" });
  if (!response.ok) throw new Error(`vdom-diff-patch.wasm fetch failed: ${response.status}`);
  return await WebAssembly.instantiate(await WebAssembly.compile(await response.arrayBuffer()), {});
}

/** Serialize the REAL rendered DOM back to the canonical HTML format
 * (k-attrs sorted, then data-key; text nodes verbatim; input self-closes). */
function serializeRenderedDom(mount) {
  const render = (el) => {
    if (el.nodeType === Node.TEXT_NODE) return el.data;
    const tag = el.tagName.toLowerCase();
    const kAttrs = el.getAttributeNames()
      .filter((name) => name.startsWith("k"))
      .sort()
      .map((name) => ` ${name}="${el.getAttribute(name)}"`)
      .join("");
    const keyAttr = el.hasAttribute("data-key") ? ` data-key="${el.getAttribute("data-key")}"` : "";
    const attrs = `${kAttrs}${keyAttr}`;
    const children = [...el.childNodes].map(render).join("");
    return tag === "input" ? `<input${attrs}/>` : `<${tag}${attrs}>${children}</${tag}>`;
  };
  return [...mount.childNodes].map(render).join("");
}

export function createTodomvcHost() {
  return {
    run: async ({ iterations = 30, targets = ["js", "wasm"], onProgress = () => {} }) => {
      const fixture = generateVDOMFixture();
      const canonicalHtml = serializeVDOMToCanonicalHTML(fixture.treeB);

      const section = document.createElement("section");
      section.id = "wvj-todomvc-host";
      section.setAttribute("data-wvj-dom-host", WORKLOAD);
      section.style.margin = "16px 0";
      section.style.padding = "12px";
      section.style.border = "1px solid #666";
      section.style.borderRadius = "6px";
      section.style.background = "#101014";
      const heading = document.createElement("h2");
      heading.textContent =
        "Real DOM tree (under test — frozen 1,000-node fixture, 250 diff patches)";
      heading.style.margin = "0 0 8px";
      heading.style.fontSize = "13px";
      heading.style.color = "#bcd";
      const note = document.createElement("p");
      note.textContent =
        "The diff is computed by the JS model or the REAL Wasm kernel; the rendered " +
        "DOM is driven with real DOM APIs (createElement/createTextNode/setAttribute/" +
        "replaceChild/removeChild/appendChild) and serialized back to canonical HTML " +
        "which must match the treeB oracle byte-for-byte.";
      note.style.margin = "0 0 10px";
      note.style.fontSize = "11px";
      note.style.color = "#89a";
      const mount = document.createElement("div");
      mount.dataset.wvjVdomMount = "1";
      mount.style.font = "11px ui-monospace, monospace";
      mount.style.maxHeight = "360px";
      mount.style.overflow = "auto";
      mount.style.border = "1px solid #555";
      mount.style.background = "#101015";
      mount.style.color = "#d8e2f2";
      section.append(heading, note, mount);
      document.querySelector("#main")?.prepend(section);

      const wasmInstance = targets.includes("wasm") ? await fetchWasm() : null;

      const measuredPass = async (target, { keep = false } = {}) => {
        try {
          const t0 = performance.now();
          let patches;
          if (target === "wasm") {
            const result = await runVdomWasm(fixture, wasmInstance);
            patches = result.patches;
          } else {
            const result = await runVdomJS(fixture);
            patches = result.patches;
          }
          // Real DOM application
          const host = new DOMHostAdapter(document, mount);
          host.createTree(fixture.treeA);
          host.applyPatches(patches);
          const renderedHtml = serializeRenderedDom(mount);
          const ms = performance.now() - t0;
          if (!keep) mount.replaceChildren();
          const ok = renderedHtml === canonicalHtml;
          return {
            ms,
            domOps: host.domMutations,
            verified: {
              ok,
              firstBad: ok
                ? ""
                : `rendered DOM != oracle (${renderedHtml.length} vs ${canonicalHtml.length} chars)`,
            },
            renderedHtml,
          };
        } catch (error) {
          throw new Error(
            `${target} host pass failed: ${error instanceof Error ? error.stack : String(error)}`,
          );
        }
      };

      const perTarget = {};
      for (const target of targets) {
        await measuredPass(target);
        const runs = [];
        for (let iteration = 1; iteration <= iterations; iteration++) {
          const isLast = iteration === iterations && target === targets[targets.length - 1];
          const { ms, verified, domOps } = await measuredPass(target, { keep: isLast });
          if (!verified.ok) {
            throw new Error(`real-DOM verification failed (${target}): ${verified.firstBad}`);
          }
          runs.push(ms);
          onProgress({ target, iteration, total: iterations });
        }
        perTarget[target] = statsFor(runs);
      }

      return { perTarget, detail: { workload: WORKLOAD, iterations, domMutations: 250 } };
    },
  };
}
