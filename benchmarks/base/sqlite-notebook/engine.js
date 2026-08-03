let CONTRACT = null;

export function bindContract(contract) {
  contract.assertContract();
  CONTRACT = contract;
}

function contract() {
  if (!CONTRACT) throw new Error("SQLite notebook contract is not bound");
  return CONTRACT;
}

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
  await Promise.all(
    contract().IMPORT_ORDER.map(async (table) => {
      const response = await fetch(`${baseUrl}${table}.csv`);
      if (!response.ok) throw new Error(`${table}.csv returned ${response.status}`);
      result[table] = parseCsv(await response.text(), table);
    }),
  );
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

function createCounterLedger(boundaryCrossings) {
  return {
    imports: 0,
    "imported-rows": 0,
    queries: 0,
    scans: 0,
    joins: 0,
    groups: 0,
    windows: 0,
    sorts: 0,
    allocations: 1,
    "boundary-crossings": boundaryCrossings,
  };
}

function recordSchemaAndImports(counters, fixture, executeSchema, executeIndex, executeInsert) {
  const { IMPORT_ORDER, INDEXES, SCHEMA } = contract();
  for (const statement of SCHEMA) {
    executeSchema(statement);
    counters.allocations++;
  }
  for (const statement of INDEXES) {
    executeIndex(statement);
    counters.allocations++;
  }
  for (const table of IMPORT_ORDER) {
    const statement = insertSql(table);
    counters.imports++;
    counters.allocations++;
    for (const row of fixture[table]) {
      executeInsert(statement, row);
      counters["imported-rows"]++;
    }
  }
}

function recordQuery(counters, query) {
  const joins = query.features.reduce(
    (count, feature) => count + (feature === "join" ? 1 : feature === "two-joins" ? 2 : 0),
    0,
  );
  counters.queries++;
  counters.scans += 1 + joins;
  counters.joins += joins;
  counters.groups += query.features.includes("group-by") ? 1 : 0;
  counters.windows += query.features.some((feature) => feature.startsWith("window-")) ? 1 : 0;
  counters.sorts += query.features.includes("sort") ? 1 : 0;
}

function assertFullCounters(counters, selectedQueryId) {
  if (selectedQueryId !== null) return;
  const { EXPECTED_COUNTERS } = contract();
  const expected = {
    imports: EXPECTED_COUNTERS.imports,
    "imported-rows": EXPECTED_COUNTERS.importedRows,
    queries: EXPECTED_COUNTERS.queries,
    scans: EXPECTED_COUNTERS.scans,
    joins: EXPECTED_COUNTERS.joins,
    groups: EXPECTED_COUNTERS.groups,
    windows: EXPECTED_COUNTERS.windows,
    sorts: EXPECTED_COUNTERS.sorts,
    allocations: EXPECTED_COUNTERS.allocations,
  };
  for (const [name, value] of Object.entries(expected)) {
    if (counters[name] !== value) throw new Error(`${name} counter mismatch`);
  }
}

export async function runAlaSql(alasql, fixture, selectedQueryId = null) {
  const { assertContract, PRODUCT_CONFIG, QUERIES } = contract();
  assertContract();
  const expectedEngine = PRODUCT_CONFIG["javascript-controlled"];
  if (alasql.version !== expectedEngine.version || alasql.build !== expectedEngine.build) {
    throw new Error(
      `AlaSQL runtime identity mismatch: ${alasql.version ?? "unknown"} ${
        alasql.build ?? "unknown"
      }`,
    );
  }
  const counters = createCounterLedger(0);
  const db = new alasql.Database(`sqlite_notebook_${crypto.randomUUID()}`);
  recordSchemaAndImports(
    counters,
    fixture,
    (statement) => db.exec(statement),
    (statement) => db.exec(statement),
    (statement, row) => db.exec(statement, row),
  );
  const selected = selectedQueryId
    ? QUERIES.filter((query) => query.id === selectedQueryId)
    : QUERIES;
  if (selected.length === 0) throw new Error(`Unknown query: ${selectedQueryId}`);
  counters.allocations++;
  const results = selected.map(({ id, sql, ...query }) => {
    const contract = { id, sql, ...query };
    recordQuery(counters, contract);
    return { id, rows: canonicalizeRows(db.exec(sql)) };
  });
  assertFullCounters(counters, selectedQueryId);
  const output = await canonicalResults(results);
  return {
    variant: "javascript-controlled",
    engine: PRODUCT_CONFIG["javascript-controlled"],
    results,
    ...output,
    counters,
  };
}

export async function runSqlite(sqlite3, fixture, selectedQueryId = null) {
  const { assertContract, PRODUCT_CONFIG, QUERIES } = contract();
  assertContract();
  const counters = createCounterLedger(2);
  const db = new sqlite3.oo1.DB(":memory:", "c");
  try {
    for (const statement of PRODUCT_CONFIG["linear-wasm-controlled"].pragmas) db.exec(statement);
    db.exec("BEGIN");
    recordSchemaAndImports(
      counters,
      fixture,
      (statement) => db.exec(statement),
      (statement) => db.exec(statement),
      (statement, row) => db.exec({ sql: statement, bind: row }),
    );
    db.exec("COMMIT");
    const selected = selectedQueryId
      ? QUERIES.filter((query) => query.id === selectedQueryId)
      : QUERIES;
    if (selected.length === 0) throw new Error(`Unknown query: ${selectedQueryId}`);
    counters.allocations++;
    const results = selected.map(({ id, sql, ...query }) => {
      const contract = { id, sql, ...query };
      recordQuery(counters, contract);
      return {
        id,
        rows: canonicalizeRows(
          db.exec({ sql, rowMode: "object", returnValue: "resultRows" }),
        ),
      };
    });
    assertFullCounters(counters, selectedQueryId);
    const output = await canonicalResults(results);
    return {
      variant: "linear-wasm-controlled",
      engine: PRODUCT_CONFIG["linear-wasm-controlled"],
      results,
      ...output,
      counters,
    };
  } finally {
    db.close();
  }
}
