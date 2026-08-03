export const WORKLOAD_ID = "database.sqlite-notebook.v1";
export const IMPLEMENTATION_ID = "database.sqlite-notebook.controlled.v1";
export const FIXTURE_SEED = 0x0051a17e;
export const COUNTS = Object.freeze({ customers: 64, products: 32, sales: 4096 });
export const IMPORT_ORDER = Object.freeze(["customers", "products", "sales"]);

export const SCHEMA = Object.freeze([
  "CREATE TABLE customers (id INTEGER NOT NULL PRIMARY KEY, name TEXT NOT NULL, region TEXT NOT NULL)",
  "CREATE TABLE products (id INTEGER NOT NULL PRIMARY KEY, name TEXT NOT NULL, category TEXT NOT NULL)",
  "CREATE TABLE sales (id INTEGER NOT NULL PRIMARY KEY, customer_id INTEGER NOT NULL, product_id INTEGER NOT NULL, sale_month INTEGER NOT NULL, sale_day INTEGER NOT NULL, quantity INTEGER NOT NULL, unit_cents INTEGER NOT NULL, discount_bps INTEGER NOT NULL, coupon_code TEXT NULL)",
]);

export const INDEXES = Object.freeze([
  "CREATE INDEX sales_customer_idx ON sales(customer_id)",
  "CREATE INDEX sales_product_idx ON sales(product_id)",
  "CREATE INDEX sales_month_idx ON sales(sale_month)",
]);

export const PRODUCT_CONFIG = Object.freeze({
  "javascript-controlled": {
    engine: "AlaSQL",
    version: "4.17.3",
    settings: ["case-sensitive identifiers", "in-memory database", "single worker"],
  },
  "linear-wasm-controlled": {
    engine: "SQLite",
    version: "3.53.0",
    sourceId:
      "2026-04-09 11:41:38 4525003a53a7fc63ca75c59b22c79608659ca12f0131f52c18637f829977f20b",
    pragmas: [
      "PRAGMA foreign_keys=OFF",
      "PRAGMA journal_mode=MEMORY",
      "PRAGMA synchronous=OFF",
      "PRAGMA temp_store=MEMORY",
      "PRAGMA automatic_index=OFF",
    ],
    settings: ["in-memory database", "single worker", "OPFS disabled"],
  },
});

export const QUERIES = Object.freeze([
  {
    id: "q1-region-revenue",
    features: ["join", "group-by", "sort"],
    sql:
      "SELECT c.region AS region, SUM(s.quantity * s.unit_cents) AS gross_cents, COUNT(*) AS sale_count FROM sales AS s JOIN customers AS c ON c.id = s.customer_id GROUP BY c.region ORDER BY gross_cents DESC, region ASC",
  },
  {
    id: "q2-category-units",
    features: ["join", "group-by", "sort"],
    sql:
      "SELECT p.category AS category, SUM(s.quantity) AS units, COUNT(*) AS sale_count FROM sales AS s JOIN products AS p ON p.id = s.product_id GROUP BY p.category ORDER BY units DESC, category ASC",
  },
  {
    id: "q3-region-category-cube",
    features: ["two-joins", "group-by", "sort"],
    sql:
      "SELECT c.region AS region, p.category AS category, SUM(s.quantity * s.unit_cents) AS gross_cents FROM sales AS s JOIN customers AS c ON c.id = s.customer_id JOIN products AS p ON p.id = s.product_id GROUP BY c.region, p.category ORDER BY region ASC, category ASC",
  },
  {
    id: "q4-top-products",
    features: ["join", "where", "group-by", "sort", "limit"],
    sql:
      "SELECT p.id AS product_id, p.name AS product_name, SUM(s.quantity * s.unit_cents) AS gross_cents FROM sales AS s JOIN products AS p ON p.id = s.product_id WHERE s.sale_month BETWEEN 202504 AND 202509 GROUP BY p.id, p.name ORDER BY gross_cents DESC, product_id ASC LIMIT 10",
  },
  {
    id: "q5-customer-purchase-sequence",
    features: ["window-row-number", "partition", "sort", "null"],
    sql:
      "SELECT id AS sale_id, customer_id, sale_day, coupon_code, ROW_NUMBER() OVER (PARTITION BY customer_id ORDER BY id ASC) AS purchase_number FROM sales WHERE id <= 512 ORDER BY customer_id ASC, purchase_number ASC",
  },
  {
    id: "q6-product-partition-total",
    features: ["window-sum", "partition", "sort"],
    sql:
      "SELECT id AS sale_id, product_id, quantity, SUM(quantity) OVER (PARTITION BY product_id) AS product_units FROM sales WHERE id <= 512 AND product_id <= 8 ORDER BY product_id ASC, sale_id ASC",
  },
  {
    id: "q7-null-coupon-groups",
    features: ["null", "group-by", "sort"],
    sql:
      "SELECT coupon_code, COUNT(*) AS sale_count, SUM(quantity) AS units FROM sales GROUP BY coupon_code ORDER BY coupon_code ASC",
  },
  {
    id: "q8-monthly-region-orders",
    features: ["join", "where", "group-by", "sort"],
    sql:
      "SELECT s.sale_month, c.region AS region, COUNT(*) AS sale_count, SUM(s.quantity) AS units FROM sales AS s JOIN customers AS c ON c.id = s.customer_id WHERE s.discount_bps IN (0, 500, 1000, 1500) GROUP BY s.sale_month, c.region ORDER BY s.sale_month ASC, region ASC",
  },
]);

export const EXPECTED_COUNTERS = Object.freeze({
  imports: 3,
  importedRows: COUNTS.customers + COUNTS.products + COUNTS.sales,
  queries: 8,
  scans: 14,
  joins: 6,
  groups: 6,
  windows: 2,
  sorts: 8,
  allocations: 11,
});

export function assertContract() {
  if (QUERIES.length !== 8) throw new Error("Contract must contain exactly eight queries");
  if (new Set(QUERIES.map((query) => query.id)).size !== 8) {
    throw new Error("Query identifiers must be unique");
  }
  if (!QUERIES.every((query) => /ORDER BY/.test(query.sql))) {
    throw new Error("Every query must freeze result order");
  }
}
