// Track B — side-by-side baseline-vs-optimized renderer (CSP-safe).
// Renders per workload: an optimization log, a source diff view (baseline vs
// optimized, changed lines highlighted) and runtime perf bars (baseline vs
// optimized per language, delta %). No inline style attributes — widths are
// set via CSSOM (bar.style.width), which the site's style-src 'self' policy
// permits. Track A baselines are NEVER modified.

const REPORT = "/data/track-b-report.v1.json";

function el(tag, cls, text) {
  const node = document.createElement(tag);
  if (cls) node.className = cls;
  if (text !== undefined) node.textContent = text;
  return node;
}

// Minimal line diff: returns per-line status 'same' | 'del' | 'add' using a
// greedy LCS over line keys.
function lineDiff(aLines, bLines) {
  const aKey = aLines.map((l) => l.replace(/\s+/g, " "));
  const bKey = bLines.map((l) => l.replace(/\s+/g, " "));
  const dp = Array.from({ length: aKey.length + 1 }, () => new Uint16Array(bKey.length + 1));
  for (let i = aKey.length - 1; i >= 0; i--) {
    for (let j = bKey.length - 1; j >= 0; j--) {
      dp[i][j] = aKey[i] === bKey[j] ? dp[i + 1][j + 1] + 1 : Math.max(dp[i + 1][j], dp[i][j + 1]);
    }
  }
  const statusA = new Array(aKey.length).fill("del");
  const statusB = new Array(bKey.length).fill("add");
  let i = 0, j = 0;
  while (i < aKey.length && j < bKey.length) {
    if (aKey[i] === bKey[j]) {
      statusA[i] = "same";
      statusB[j] = "same";
      i++;
      j++;
    } else if (dp[i + 1][j] >= dp[i][j + 1]) {
      i++;
    } else {
      j++;
    }
  }
  return { statusA, statusB };
}

function sourceDiffView(baseline, optimized) {
  const aLines = baseline.split("\n");
  const bLines = optimized.split("\n");
  const { statusA, statusB } = lineDiff(aLines, bLines);
  const wrap = el("div", "trackb-diff");
  const max = Math.max(aLines.length, bLines.length);
  for (let line = 0; line < max; line++) {
    const row = el("div", "trackb-diff-row");
    const a = el(
      "code",
      `trackb-src ${statusA[line] ?? "same"}`,
      line < aLines.length ? (aLines[line] || " ") : "",
    );
    const b = el(
      "code",
      `trackb-src ${statusB[line] ?? "same"}`,
      line < bLines.length ? (bLines[line] || " ") : "",
    );
    row.append(a, b);
    wrap.append(row);
  }
  return wrap;
}

function perfBars(workload) {
  const wrap = el("div", "trackb-bars");
  for (const lang of workload.languages) {
    const row = el("div", "trackb-bar-row");
    const label = el("span", "trackb-bar-label", lang.language);
    const track = el("div", "trackb-bar-track");
    const maxMs = Math.max(lang.baselineMs, lang.optimizedMs, 1e-9);
    const baseBar = el("div", "trackb-bar trackb-bar-base");
    baseBar.style.width = `${Math.max((lang.baselineMs / maxMs) * 100, 1)}%`;
    baseBar.title = `Track A baseline: ${lang.baselineMs.toFixed(3)} ms`;
    const optBar = el("div", "trackb-bar trackb-bar-opt");
    optBar.style.width = `${Math.max((lang.optimizedMs / maxMs) * 100, 1)}%`;
    optBar.title = `Track B optimized: ${lang.optimizedMs.toFixed(3)} ms`;
    const delta = ((lang.optimizedMs / lang.baselineMs - 1) * 100).toFixed(1);
    const deltaTxt = el(
      "span",
      "trackb-bar-delta",
      `${lang.baselineMs.toFixed(3)}ms → ${lang.optimizedMs.toFixed(3)}ms (${delta}%)`,
    );
    track.append(baseBar, optBar);
    row.append(label, track, deltaTxt);
    wrap.append(row);
  }
  return wrap;
}

function fetchText(url) {
  return fetch(url, { cache: "no-store" }).then((r) => {
    if (!r.ok) throw new Error(`${url} -> ${r.status}`);
    return r.text();
  });
}

export async function initTrackB(root, filterId) {
  const report = await (await fetch(REPORT, { cache: "no-store" })).json();
  const container = typeof root === "string" ? document.querySelector(root) : root;
  container.hidden = false;
  container.textContent = "";

  const note = el("p", "trackb-note");
  note.textContent = "Track A baselines are frozen, controlled workloads and are never modified. " +
    "Track B variants are independent optimizations — explicitly non-default and " +
    "never pooled with Track A claims. Numbers are in-process warm medians.";
  container.append(note);

  for (const w of report.workloads) {
    if (filterId && w.workloadId !== filterId) continue;
    const card = el("section", "trackb-card");
    const h = el("h3", "trackb-title", `${w.label} — ${w.correctness}`);
    card.append(h);

    const log = el("ul", "trackb-log");
    for (const item of w.optimizationLog) log.append(el("li", "trackb-log-item", item));
    card.append(log);

    card.append(perfBars(w));

    const diffLabel = el("h4", "trackb-subhead", "Source (Track A baseline vs Track B optimized)");
    card.append(diffLabel);

    const diffWrap = el("div", "trackb-diffs");
    for (const [langKey, paths] of Object.entries(w.sources)) {
      const langLabel = el("h5", "trackb-lang", langKey === "c" ? "C / Wasm" : "JavaScript");
      diffWrap.append(langLabel);
      if (paths.length === 2) {
        try {
          const [baseline, optimized] = await Promise.all(
            paths.map((p) =>
              fetchText(p.startsWith("/src/") ? p : `/src/${p.replace("benchmarks/", "")}`)
            ),
          );
          const block = el("div", "trackb-diff-block");
          const meta = el(
            "p",
            "trackb-diff-meta",
            `baseline: ${paths[0]} · optimized: ${paths[1]}`,
          );
          block.append(meta, sourceDiffView(baseline, optimized));
          diffWrap.append(block);
        } catch {
          diffWrap.append(el("p", "trackb-diff-meta", `sources unavailable for ${langKey}`));
        }
      } else {
        diffWrap.append(el("p", "trackb-diff-meta", `source paths: ${paths.join(", ")}`));
      }
    }
    card.append(diffWrap);
    container.append(card);
  }
}
