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
