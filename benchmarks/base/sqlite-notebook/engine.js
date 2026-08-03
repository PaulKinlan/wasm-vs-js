import {
  assertContract,
  EXPECTED_COUNTERS,
  IMPORT_ORDER,
  INDEXES,
  PRODUCT_CONFIG,
  QUERIES,
  SCHEMA,
} from "./contract.js";

const TABLE_COLUMNS = Object.freeze({
  customers: ["id", "name", "region"],
  products: ["id", "name", "category"],
  sales: [
    "id",
    "customer_id",
    "product_id",
    "sale_month",
    "sale_day",
    "quantity",
    "unit_cents",
    "discount_bps",
    "coupon_code",
  ],
});
const NUMERIC_COLUMNS = new Set([
  "id",
  "customer_id",
  "product_id",
  "sale_month",
  "sale_day",
  "quantity",
  "unit_cents",
  "discount_bps",
]);

export function parseCsv(text, table) {
  const lines = text.trimEnd().split("\n");
  const columns = TABLE_COLUMNS[table];
  if (!columns) throw new Error(`Unknown table: ${table}`);
  const header = lines.shift()?.split(",");
  if (JSON.stringify(header) !== JSON.stringify(columns)) {
    throw new Error(`${table} header mismatch`);
  }
  return lines.map((line, rowIndex) => {
    const values = line.split(",");
    if (values.length !== columns.length) {
      throw new Error(`${table} row ${rowIndex + 1} has ${values.length} fields`);
    }
    return columns.map((column, index) => {
      if (table === "sales" && column === "coupon_code" && values[index] === "") {
        return null;
      }
      if (NUMERIC_COLUMNS.has(column)) {
        const parsed = Number(values[index]);
        if (!Number.isSafeInteger(parsed)) throw new Error(`${table}.${column} is not an integer`);
        return parsed;
      }
      return values[index];
    });
  });
}

export async function fetchFixture(baseUrl = "/assets/sqlite-notebook/fixtures/") {
  const result = {};
  await Promise.all(IMPORT_ORDER.map(async (table) => {
    const response = await fetch(`${baseUrl}${table}.csv`);
    if (!response.ok) throw new Error(`${table}.csv returned ${response.status}`);
    result[table] = parseCsv(await response.text(), table);
  }));
  return result;
}

function insertSql(table) {
  const columns = TABLE_COLUMNS[table];
  return `INSERT INTO ${table} (${columns.join(",")}) VALUES (${columns.map(() => "?").join(",")})`;
}

function canonicalValue(value) {
  if (value === null) return null;
  if (typeof value === "number") {
    if (!Number.isFinite(value)) throw new Error("Non-finite SQL output");
    if (!Number.isSafeInteger(value)) throw new Error(`Non-integer SQL output: ${value}`);
    return value;
  }
  if (typeof value === "bigint") {
    const number = Number(value);
    if (!Number.isSafeInteger(number)) throw new Error("Unsafe bigint SQL output");
    return number;
  }
  if (typeof value === "string") return value;
  throw new Error(`Unsupported SQL output type: ${typeof value}`);
}

export function canonicalizeRows(rows) {
  return rows.map((row) => {
    const entries = Object.entries(row).map(([key, value]) => [key, canonicalValue(value)]);
    return Object.fromEntries(entries);
  });
}

export async function sha256Text(text) {
  const bytes = new TextEncoder().encode(text);
  return [...new Uint8Array(await crypto.subtle.digest("SHA-256", bytes))]
    .map((value) => value.toString(16).padStart(2, "0")).join("");
}

export async function canonicalResults(results) {
  const canonical = `${JSON.stringify(results)}\n`;
  return { canonical, sha256: await sha256Text(canonical) };
}

export async function runAlaSql(alasql, fixture, selectedQueryId = null) {
  assertContract();
  const db = new alasql.Database(`sqlite_notebook_${crypto.randomUUID()}`);
  for (const statement of SCHEMA) db.exec(statement);
  for (const statement of INDEXES) db.exec(statement);
  for (const table of IMPORT_ORDER) {
    const statement = insertSql(table);
    for (const row of fixture[table]) db.exec(statement, row);
  }
  const selected = selectedQueryId
    ? QUERIES.filter((query) => query.id === selectedQueryId)
    : QUERIES;
  if (selected.length === 0) throw new Error(`Unknown query: ${selectedQueryId}`);
  const results = selected.map(({ id, sql }) => ({ id, rows: canonicalizeRows(db.exec(sql)) }));
  const output = await canonicalResults(results);
  return {
    variant: "javascript-controlled",
    engine: PRODUCT_CONFIG["javascript-controlled"],
    results,
    ...output,
    counters: makeCounters(selected, 0),
  };
}

export async function runSqlite(sqlite3, fixture, selectedQueryId = null) {
  assertContract();
  const db = new sqlite3.oo1.DB(":memory:", "c");
  try {
    for (const statement of PRODUCT_CONFIG["linear-wasm-controlled"].pragmas) db.exec(statement);
    for (const statement of SCHEMA) db.exec(statement);
    for (const statement of INDEXES) db.exec(statement);
    db.exec("BEGIN");
    for (const table of IMPORT_ORDER) {
      const statement = insertSql(table);
      for (const row of fixture[table]) db.exec({ sql: statement, bind: row });
    }
    db.exec("COMMIT");
    const selected = selectedQueryId
      ? QUERIES.filter((query) => query.id === selectedQueryId)
      : QUERIES;
    if (selected.length === 0) throw new Error(`Unknown query: ${selectedQueryId}`);
    const results = selected.map(({ id, sql }) => ({
      id,
      rows: canonicalizeRows(db.exec({ sql, rowMode: "object", returnValue: "resultRows" })),
    }));
    const output = await canonicalResults(results);
    return {
      variant: "linear-wasm-controlled",
      engine: PRODUCT_CONFIG["linear-wasm-controlled"],
      results,
      ...output,
      counters: makeCounters(selected, 2),
    };
  } finally {
    db.close();
  }
}

function makeCounters(selected, boundaryCrossings) {
  const features = selected.flatMap((query) => query.features);
  return {
    imports: EXPECTED_COUNTERS.imports,
    "imported-rows": EXPECTED_COUNTERS.importedRows,
    queries: selected.length,
    joins: features.reduce(
      (count, feature) => count + (feature === "join" ? 1 : feature === "two-joins" ? 2 : 0),
      0,
    ),
    groups: features.filter((feature) => feature === "group-by").length,
    windows: features.filter((feature) => feature.startsWith("window-")).length,
    sorts: features.filter((feature) => feature === "sort").length,
    allocations: EXPECTED_COUNTERS.allocations,
    "boundary-crossings": boundaryCrossings,
  };
}
