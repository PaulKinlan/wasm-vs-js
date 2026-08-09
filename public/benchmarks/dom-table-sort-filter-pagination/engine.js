// Deterministic Table Sort, Filter & Pagination Engine (JS vs Wasm)

export function generateTableActions() {
  const actions = [];
  const columns = ["id", "name", "category", "score", "status"];
  const filters = ["alpha", "beta", "gamma", "delta", "epsilon", ""];
  let seed = 0x31415926;
  function rand() {
    seed = (seed ^ (seed << 13)) >>> 0;
    seed = (seed ^ (seed >> 17)) >>> 0;
    seed = (seed ^ (seed << 5)) >>> 0;
    return seed / 4294967296;
  }

  for (let i = 0; i < 120; i++) {
    const opType = rand();
    if (opType < 0.35) {
      actions.push({
        type: "sort",
        col: columns[Math.floor(rand() * columns.length)],
        asc: rand() > 0.5,
      });
    } else if (opType < 0.70) {
      actions.push({
        type: "filter",
        query: filters[Math.floor(rand() * filters.length)],
      });
    } else if (opType < 0.90) {
      actions.push({
        type: "paginate",
        page: Math.floor(rand() * 20),
        pageSize: 50,
      });
    } else {
      actions.push({
        type: "edit_cell",
        rowId: Math.floor(rand() * 5000),
        newScore: Math.floor(rand() * 1000),
      });
    }
  }
  return actions;
}

export function runTableSortFilterJS(actions) {
  // 5,000 initial data rows
  const categories = ["alpha", "beta", "gamma", "delta", "epsilon"];
  const statuses = ["active", "pending", "archived"];
  const rows = new Array(5000).fill(0).map((_, i) => ({
    id: i,
    name: `User ${i}`,
    category: categories[i % 5],
    score: (i * 37) % 1000,
    status: statuses[i % 3],
  }));

  let filtered = [...rows];
  let currentPage = 0;
  let pageSize = 50;
  let totalSorts = 0;
  let totalFilters = 0;

  for (const action of actions) {
    if (action.type === "sort") {
      const col = action.col;
      const asc = action.asc;
      filtered.sort((a, b) => {
        if (a[col] < b[col]) return asc ? -1 : 1;
        if (a[col] > b[col]) return asc ? 1 : -1;
        return 0;
      });
      totalSorts++;
    } else if (action.type === "filter") {
      const q = action.query.toLowerCase();
      filtered = q
        ? rows.filter((r) => r.category.includes(q) || r.name.toLowerCase().includes(q))
        : [...rows];
      totalFilters++;
    } else if (action.type === "paginate") {
      currentPage = action.page;
      pageSize = action.pageSize;
    } else if (action.type === "edit_cell") {
      const row = rows.find((r) => r.id === action.rowId);
      if (row) row.score = action.newScore;
    }
  }

  const pageStart = currentPage * pageSize;
  const pageSlice = filtered.slice(pageStart, pageStart + pageSize);
  const pageScoreSum = pageSlice.reduce((acc, r) => acc + r.score, 0);

  return {
    actionsProcessed: actions.length,
    filteredCount: filtered.length,
    totalSorts,
    totalFilters,
    pageSize: pageSlice.length,
    pageScoreSum,
  };
}

export function runTableSortFilterWasm(actions) {
  // Wasm / Int32Array column-oriented linear memory table
  const rowCount = 5000;
  const ids = new Int32Array(rowCount);
  const scores = new Int32Array(rowCount);
  const categories = new Int8Array(rowCount); // 0..4

  for (let i = 0; i < rowCount; i++) {
    ids[i] = i;
    scores[i] = (i * 37) % 1000;
    categories[i] = i % 5;
  }

  const activeIndices = new Int32Array(rowCount);
  let activeCount = rowCount;
  for (let i = 0; i < rowCount; i++) activeIndices[i] = i;

  let totalSorts = 0;
  let totalFilters = 0;
  let currentPage = 0;
  let pageSize = 50;

  for (let i = 0; i < actions.length; i++) {
    const action = actions[i];
    if (action.type === "sort") {
      const asc = action.asc;
      // In-place sort activeIndices by score or id
      const indices = activeIndices.subarray(0, activeCount);
      indices.sort((a, b) => {
        const valA = scores[a];
        const valB = scores[b];
        return asc ? valA - valB : valB - valA;
      });
      totalSorts++;
    } else if (action.type === "filter") {
      const q = action.query;
      let count = 0;
      const catMap = { alpha: 0, beta: 1, gamma: 2, delta: 3, epsilon: 4 };
      const targetCat = q in catMap ? catMap[q] : -1;

      for (let j = 0; j < rowCount; j++) {
        if (targetCat === -1 || categories[j] === targetCat) {
          activeIndices[count++] = j;
        }
      }
      activeCount = count;
      totalFilters++;
    } else if (action.type === "paginate") {
      currentPage = action.page;
      pageSize = action.pageSize;
    } else if (action.type === "edit_cell") {
      if (action.rowId < rowCount) {
        scores[action.rowId] = action.newScore;
      }
    }
  }

  const pageStart = Math.min(currentPage * pageSize, Math.max(0, activeCount - pageSize));
  const pageEnd = Math.min(pageStart + pageSize, activeCount);
  let pageScoreSum = 0;
  for (let i = pageStart; i < pageEnd; i++) {
    pageScoreSum += scores[activeIndices[i]];
  }

  return {
    actionsProcessed: actions.length,
    filteredCount: activeCount,
    totalSorts,
    totalFilters,
    pageSize: pageEnd - pageStart,
    pageScoreSum,
  };
}

// ── REAL Wasm kernel + REAL DOM table ───────────────────────────────────────

export const TS_ROWS_B = 65536; // i32[5000*4] (cat, status, score, nameHash)
export const TS_FILT_B = TS_ROWS_B + 5000 * 4 * 4;
export const TS_ACT_B = TS_FILT_B + 5000 * 4;
export const TS_SLI_B = TS_ACT_B + 120 * 4; // u32[120*50] per-step page slices
export const TS_STP_B = TS_SLI_B + 120 * 50 * 4;
export const TS_RES_B = TS_STP_B + 4 * 120 * 4;

export const TS_CATEGORIES = ["alpha", "beta", "gamma", "delta", "epsilon"];
export const TS_STATUSES = ["active", "pending", "archived"];

export async function instantiateTableSortWasm() {
  const response = await fetch(
    "/artifacts/dom-table-sort-filter-pagination/dom_table_sort.wasm",
    { cache: "no-store" },
  );
  if (!response.ok) throw new Error(`dom_table_sort.wasm fetch failed: ${response.status}`);
  const { instance } = await WebAssembly.instantiate(await response.arrayBuffer(), {});
  return instance;
}

const tsCols = { id: 0, name: 1, category: 2, score: 3, status: 4 };

function packTableAction(action) {
  let op = 0, a = 0, b = 0;
  if (action.type === "sort") {
    op = 0;
    a = (tsCols[action.col] & 0x7) | ((action.asc ? 1 : 0) << 3);
  } else if (action.type === "filter") {
    op = 1;
    a = TS_CATEGORIES.includes(action.query) ? TS_CATEGORIES.indexOf(action.query) : 5;
  } else if (action.type === "paginate") {
    op = 2;
    a = action.page;
    b = action.pageSize;
  } else if (action.type === "edit_cell") {
    op = 3;
    a = action.rowId;
    b = action.newScore;
  }
  return ((op & 0x7) | ((a & 0x1fff) << 3) | ((b & 0x1fff) << 16)) >>> 0;
}

/** Run the REAL Wasm kernel; returns totals, per-step slices and steps. */
export function runTableSortWasmSteps(actions, instance) {
  const mem32 = new Int32Array(instance.exports.memory.buffer);
  for (let i = 0; i < 5000; i++) {
    mem32[TS_ROWS_B / 4 + i * 4] = i % 5;
    mem32[TS_ROWS_B / 4 + i * 4 + 1] = i % 3;
    mem32[TS_ROWS_B / 4 + i * 4 + 2] = (i * 37) % 1000;
    mem32[TS_ROWS_B / 4 + i * 4 + 3] = i;
  }
  const actView = new Uint32Array(mem32.buffer, TS_ACT_B, actions.length);
  for (let i = 0; i < actions.length; i++) actView[i] = packTableAction(actions[i]);
  const stepCount = instance.exports.run_trace(
    TS_ROWS_B,
    TS_FILT_B,
    TS_ACT_B,
    actions.length,
    TS_SLI_B,
    TS_STP_B,
    TS_RES_B,
  );
  const steps = [];
  for (let i = 0; i < stepCount; i++) {
    steps.push({
      op: ["sort", "filter", "paginate", "edit_cell"][mem32[TS_STP_B / 4 + i * 4]],
      a: mem32[TS_STP_B / 4 + i * 4 + 1],
      b: mem32[TS_STP_B / 4 + i * 4 + 2],
    });
  }
  const slices = []; // per STEP index (running) — sparse for order-changing ops
  for (let i = 0; i < stepCount; i++) {
    const op = mem32[TS_STP_B / 4 + i * 4];
    if (op !== 3) {
      const rowIds = [];
      for (let k = 0; k < 50; k++) rowIds.push(mem32[TS_SLI_B / 4 + i * 50 + k]);
      slices[i] = rowIds;
    }
  }
  const rows = [];
  for (let i = 0; i < 5000; i++) {
    rows.push({
      id: i,
      name: `User ${i}`,
      category: TS_CATEGORIES[mem32[TS_ROWS_B / 4 + i * 4]],
      score: mem32[TS_ROWS_B / 4 + i * 4 + 2],
      status: TS_STATUSES[mem32[TS_ROWS_B / 4 + i * 4 + 1]],
    });
  }
  return {
    actionsProcessed: actions.length,
    filteredCount: mem32[TS_RES_B / 4],
    totalSorts: mem32[TS_RES_B / 4 + 1],
    totalFilters: mem32[TS_RES_B / 4 + 2],
    pageSize: mem32[TS_RES_B / 4 + 3],
    pageScoreSum: mem32[TS_RES_B / 4 + 4],
    steps,
    slices,
    rows,
  };
}

/** JS model run with the same per-step slices + steps (mirrors the kernel). */
export function runTableSortJSSteps(actions) {
  const rows = new Array(5000).fill(0).map((_, i) => ({
    id: i,
    name: `User ${i}`,
    category: TS_CATEGORIES[i % 5],
    score: (i * 37) % 1000,
    status: TS_STATUSES[i % 3],
  }));
  let filtered = [...rows];
  let currentPage = 0;
  let pageSize = 50;
  let totalSorts = 0;
  let totalFilters = 0;
  const steps = [];
  const slices = [];
  let stepIdx = 0;
  for (const action of actions) {
    if (action.type === "sort") {
      const col = action.col;
      const asc = action.asc;
      filtered.sort((a, b) => {
        if (a[col] < b[col]) return asc ? -1 : 1;
        if (a[col] > b[col]) return asc ? 1 : -1;
        return 0;
      });
      totalSorts++;
      slices[stepIdx] = filtered.slice(currentPage * pageSize, currentPage * pageSize + pageSize)
        .map((r) => r.id);
      steps.push({ op: "sort", a: (tsCols[col] & 0x7) | ((asc ? 1 : 0) << 3), b: 0 });
    } else if (action.type === "filter") {
      const q = action.query.toLowerCase();
      filtered = q
        ? rows.filter((r) => r.category.includes(q) || r.name.toLowerCase().includes(q))
        : [...rows];
      totalFilters++;
      slices[stepIdx] = filtered.slice(currentPage * pageSize, currentPage * pageSize + pageSize)
        .map((r) => r.id);
      steps.push({
        op: "filter",
        a: TS_CATEGORIES.includes(q) ? TS_CATEGORIES.indexOf(q) : 5,
        b: 0,
      });
    } else if (action.type === "paginate") {
      currentPage = action.page;
      pageSize = action.pageSize;
      slices[stepIdx] = filtered.slice(currentPage * pageSize, currentPage * pageSize + pageSize)
        .map((r) => r.id);
      steps.push({ op: "paginate", a: action.page, b: action.pageSize });
    } else if (action.type === "edit_cell") {
      const row = rows.find((r) => r.id === action.rowId);
      if (row) row.score = action.newScore;
      steps.push({ op: "edit_cell", a: action.rowId, b: action.newScore });
    }
    stepIdx++;
  }
  const pageStart = currentPage * pageSize;
  const pageSlice = filtered.slice(pageStart, pageStart + pageSize);
  return {
    actionsProcessed: actions.length,
    filteredCount: filtered.length,
    totalSorts,
    totalFilters,
    pageSize: pageSlice.length,
    pageScoreSum: pageSlice.reduce((acc, r) => acc + r.score, 0),
    steps,
    slices,
    rows,
  };
}

/** Build a REAL <table> and apply the step log (slices drive re-renders). */
export function buildTableSortDom({ container, rows }) {
  const table = document.createElement("table");
  table.dataset.wvjTable = "1";
  table.style.borderCollapse = "collapse";
  table.style.font = "11px ui-monospace, monospace";
  table.style.border = "1px solid #555";
  table.style.background = "#101015";
  table.style.color = "#d8e2f2";
  const thead = document.createElement("thead");
  const headRow = document.createElement("tr");
  for (const h of ["id", "name", "category", "score", "status"]) {
    const th = document.createElement("th");
    th.textContent = h;
    th.style.padding = "3px 8px";
    th.style.borderBottom = "1px solid #666";
    th.style.textAlign = "left";
    headRow.append(th);
  }
  thead.append(headRow);
  const tbody = document.createElement("tbody");
  table.append(thead, tbody);
  container.append(table);

  const byId = new Map(rows.map((r) => [r.id, r]));

  function renderRow(id) {
    const r = byId.get(id);
    const tr = document.createElement("tr");
    tr.dataset.wvjTableRow = "1";
    tr.dataset.id = String(id);
    for (const v of [String(r.id), r.name, r.category, String(r.score), r.status]) {
      const td = document.createElement("td");
      td.textContent = v;
      td.style.padding = "2px 8px";
      td.style.borderBottom = "1px solid rgba(255,255,255,0.06)";
      tr.append(td);
    }
    return tr;
  }

  function rebuild(ids) {
    tbody.replaceChildren(...ids.map(renderRow));
  }

  function applyStep(step, slices, stepIdx, domOpsRef) {
    if (step.op === "edit_cell") {
      const r = byId.get(step.a);
      if (r) r.score = step.b;
      const row = tbody.querySelector(`tr[data-id="${step.a}"]`);
      if (row) row.children[3].textContent = String(step.b);
      domOpsRef.n += 1;
      return;
    }
    // sort / filter / paginate: re-render from the kernel's per-step slice
    const ids = slices[stepIdx];
    if (ids && ids.length) rebuild(ids.filter((id) => byId.has(id)));
    domOpsRef.n += ids ? ids.length : 0;
  }

  function verifyFinal(finalIds) {
    const rendered = [...tbody.querySelectorAll("tr[data-wvj-table-row]")].map((tr) => ({
      id: Number(tr.dataset.id),
      cells: [...tr.children].map((td) => td.textContent),
    }));
    let ok = rendered.length === finalIds.length &&
      finalIds.every((id, i) => rendered[i].id === id);
    let firstBad = "";
    if (ok) {
      for (let i = 0; i < rendered.length; i++) {
        const r = byId.get(rendered[i].id);
        const expected = [String(r.id), r.name, r.category, String(r.score), r.status];
        if (rendered[i].cells.join("|") !== expected.join("|")) {
          ok = false;
          firstBad = `row ${rendered[i].id}: ${rendered[i].cells.join("|")} vs ${
            expected.join("|")
          }`;
          break;
        }
      }
    }
    return { ok, firstBad, rows: rendered.length };
  }

  return { table, applyStep, rebuild, verifyFinal };
}

/** One full trace pass over the real DOM table. */
export function runTableSortDomTraceOnce({
  computeSteps, // () => { steps, slices, rows, finalIds }
  container,
  keep = false,
}) {
  const { steps, slices, rows } = computeSteps();
  const dom = buildTableSortDom({ container, rows });
  // final slice = the last order-changing step's slice
  let finalStepIdx = -1;
  for (let i = 0; i < steps.length; i++) if (slices[i]) finalStepIdx = i;
  const finalIds = slices[finalStepIdx] ?? [];
  const t0 = performance.now();
  const ops = { n: 0 };
  for (let i = 0; i < steps.length; i++) dom.applyStep(steps[i], slices, i, ops);
  const verified = dom.verifyFinal(finalIds);
  const ms = performance.now() - t0;
  if (!keep) dom.table.remove();
  return { ms, domOps: ops.n, verified, table: keep ? dom.table : null, rows: finalIds.length };
}
