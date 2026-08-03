import { renderResultInspectability } from "./inspectability.js";

const RESULT_ROUTES = new Set([
  "/evidence/v2-proposals/audio-fft/js-controlled.json",
  "/evidence/v2-proposals/audio-fft/wasm-linear-controlled.json",
  "/evidence/v2-proposals/audio-fir/js-controlled.json",
  "/evidence/v2-proposals/audio-fir/wasm-linear-controlled.json",
  "/evidence/v2-proposals/audio-stft/js-controlled.json",
  "/evidence/v2-proposals/audio-stft/wasm-linear-controlled.json",
]);

const status = document.querySelector("#v2-results-status");
let loaded = 0;

function directLink(route, label = "Open the exact result JSON") {
  const anchor = document.createElement("a");
  anchor.href = route;
  anchor.textContent = label;
  return anchor;
}

for (const container of document.querySelectorAll("[data-v2-result-src]")) {
  const fallback = container.querySelector("a");
  try {
    const source = new URL(container.dataset.v2ResultSrc ?? "", location.href);
    if (source.origin !== location.origin || !RESULT_ROUTES.has(source.pathname) || source.search) {
      throw new Error("result route is not allowlisted");
    }
    const response = await fetch(source, { cache: "no-store" });
    if (!response.ok) throw new Error(`result returned ${response.status}`);
    renderResultInspectability(container, await response.json());
    loaded += 1;
  } catch (error) {
    const message = document.createElement("p");
    message.className = "notice";
    message.textContent = `Enhanced result evidence unavailable: ${
      error instanceof Error ? error.message : "request failed"
    }`;
    container.replaceChildren(
      message,
      fallback ?? directLink(container.dataset.v2ResultSrc ?? "/evidence/v2-proposals/"),
    );
  }
}

status.textContent = `Loaded ${loaded} of ${RESULT_ROUTES.size} source and build evidence panels.`;
