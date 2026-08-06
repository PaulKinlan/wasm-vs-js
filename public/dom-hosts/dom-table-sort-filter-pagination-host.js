// Real-DOM host for the DOM Table Sort/Filter/Pagination workload (iframe orchestration).
//
// Renders the engine's 5,000-row seeded dataset as real <table> rows and
// applies the frozen 120-action stream to the DOM, mirroring the engine's
// filter/sort/page semantics (same seeded data, same predicates, same page
// slice). The rendered visible row count and score sum are verified against a
// plain-data replay of the workload's intended semantics.

import { createModelDomHost } from "./dom-host-factory.js";

const ROWS = 5000;
const CATEGORIES = ["alpha", "beta", "gamma", "delta", "epsilon"];
const STATUSES = ["active", "pending", "archived"];
const PAGE_SIZE = 50;

function seededRows() {
  return new Array(ROWS).fill(0).map((_, i) => ({
    id: i,
    name: `User ${i}`,
    category: CATEGORIES[i % 5],
    score: (i * 37) % 1000,
    status: STATUSES[i % 3],
  }));
}

export async function createTodomvcHost() {
  return createModelDomHost({
    slug: "dom-table-sort-filter-pagination",
    label: "DOM Table Sort/Filter/Pagination Engine",
    loadEngine: () => import("/benchmarks/dom-table-sort-filter-pagination/engine.js"),
    generateActions: (engine) => engine.generateTableActions(),

    renderDom: () => {
      const data = seededRows();
      const root = document.createElement("div");
      root.id = "wvj-table-host";
      root.className = "wvj-table-app";
      const table = document.createElement("table");
      const thead = document.createElement("thead");
      const headRow = document.createElement("tr");
      for (const col of ["id", "name", "category", "score", "status"]) {
        const th = document.createElement("th");
        th.dataset.col = col;
        th.textContent = col;
        headRow.append(th);
      }
      thead.append(headRow);
      const tbody = document.createElement("tbody");
      tbody.id = "wvj-table-body";
      table.append(thead, tbody);
      root.append(table);
      document.body.append(root);

      const rowEls = new Map();
      let filtered = [...data];
      let currentPage = 0;
      let pageSize = PAGE_SIZE;

      const applyVisibility = () => {
        const start = currentPage * pageSize;
        const end = start + pageSize;
        const pageIds = new Set(filtered.slice(start, end).map((r) => r.id));
        for (const r of data) {
          rowEls.get(r.id).classList.toggle("wvj-hidden", !pageIds.has(r.id));
        }
      };

      const reset = () => {
        tbody.replaceChildren();
        rowEls.clear();
        filtered = [...data];
        currentPage = 0;
        pageSize = PAGE_SIZE;
        for (const r of data) {
          const tr = document.createElement("tr");
          tr.dataset.rowId = String(r.id);
          for (const col of ["id", "name", "category", "score", "status"]) {
            const td = document.createElement("td");
            td.dataset.col = col;
            td.textContent = String(r[col]);
            tr.append(td);
          }
          tbody.append(tr);
          rowEls.set(r.id, tr);
        }
        applyVisibility();
      };
      reset();
      return {
        root, table, tbody, data, rowEls,
        state: () => ({ filtered, currentPage, pageSize }),
        reset, applyVisibility,
      };
    },

    applyAction: (dom, action) => {
      const { data, rowEls } = dom;
      if (action.type === "sort") {
        dom.state().filtered.sort((a, b) => {
          if (a[action.col] < b[action.col]) return action.asc ? -1 : 1;
          if (a[action.col] > b[action.col]) return action.asc ? 1 : -1;
          return 0;
        });
      } else if (action.type === "filter") {
        const q = action.query.toLowerCase();
        dom.state().filtered = q
          ? data.filter((r) => r.category.includes(q) || r.name.toLowerCase().includes(q))
          : [...data];
      } else if (action.type === "paginate") {
        dom.state().currentPage = action.page;
        dom.state().pageSize = action.pageSize;
      } else if (action.type === "edit_cell") {
        const row = data.find((r) => r.id === action.rowId);
        if (row) {
          row.score = action.newScore;
          const td = rowEls.get(action.rowId)?.querySelector('td[data-col="score"]');
          if (td) td.textContent = String(action.newScore);
        }
      }
      dom.applyVisibility();
    },

    computeReference: (actions) => {
      const data = seededRows();
      let filtered = [...data];
      let currentPage = 0;
      let pageSize = PAGE_SIZE;
      for (const a of actions) {
        if (a.type === "sort") {
          filtered.sort((x, y) => {
            if (x[a.col] < y[a.col]) return a.asc ? -1 : 1;
            if (x[a.col] > y[a.col]) return a.asc ? 1 : -1;
            return 0;
          });
        } else if (a.type === "filter") {
          const q = a.query.toLowerCase();
          filtered = q
            ? data.filter((r) => r.category.includes(q) || r.name.toLowerCase().includes(q))
            : [...data];
        } else if (a.type === "paginate") {
          currentPage = a.page;
          pageSize = a.pageSize;
        } else if (a.type === "edit_cell") {
          const row = data.find((r) => r.id === a.rowId);
          if (row) row.score = a.newScore;
        }
      }
      const pageSlice = filtered.slice(currentPage * pageSize, currentPage * pageSize + pageSize);
      return {
        pageSize: pageSlice.length,
        pageScoreSum: pageSlice.reduce((acc, r) => acc + r.score, 0),
      };
    },

    readDomState: (dom) => {
      const visible = [...dom.tbody.querySelectorAll("tr")].filter(
        (tr) => !tr.classList.contains("wvj-hidden"),
      );
      const scoreSum = visible.reduce(
        (acc, tr) => acc + Number(tr.querySelector('td[data-col="score"]').textContent),
        0,
      );
      return { pageSize: visible.length, pageScoreSum: scoreSum };
    },

    verifyDom: (state, reference) => {
      if (state.pageSize !== reference.pageSize) {
        throw new Error(`table DOM drift: ${state.pageSize} visible != reference ${reference.pageSize}`);
      }
      if (state.pageScoreSum !== reference.pageScoreSum) {
        throw new Error(`table DOM drift: page score sum ${state.pageScoreSum} != reference ${reference.pageScoreSum}`);
      }
    },

    runModel: (engine, actions, target) =>
      target === "wasm" ? engine.runTableSortFilterWasm(actions) : engine.runTableSortFilterJS(actions),
  });
}
