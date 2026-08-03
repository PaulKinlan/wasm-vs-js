import {
  IMPORT_ORDER,
  INDEXES,
  PRODUCT_CONFIG,
  QUERIES,
  SCHEMA,
} from "../benchmarks/base/sqlite-notebook/contract.js";
import {
  canonicalizeRows,
  canonicalResults,
  parseCsv,
} from "../benchmarks/base/sqlite-notebook/engine.js";

function sqlLiteral(value: unknown): string {
  if (value === null) return "NULL";
  if (typeof value === "number" && Number.isSafeInteger(value)) return String(value);
  if (typeof value === "string") return `'${value.replaceAll("'", "''")}'`;
  throw new Error(`Unsupported SQL literal: ${String(value)}`);
}

const root = new URL("../", import.meta.url);
const fixture: Record<string, unknown[][]> = {};
for (const table of IMPORT_ORDER) {
  fixture[table] = parseCsv(
    await Deno.readTextFile(
      new URL(`public/artifacts/sqlite-notebook/fixtures/${table}.csv`, root),
    ),
    table,
  );
}
const statements = [
  ...PRODUCT_CONFIG["linear-wasm-controlled"].pragmas,
  ...SCHEMA,
  ...INDEXES,
  "BEGIN",
];
for (const table of IMPORT_ORDER) {
  for (const row of fixture[table]) {
    statements.push(`INSERT INTO ${table} VALUES (${row.map(sqlLiteral).join(",")})`);
  }
}
statements.push("COMMIT", ...QUERIES.map((query) => query.sql));
const input = `.mode json\n.bail on\n${statements.join(";\n")};\n`;
const result = await new Deno.Command("sqlite3", {
  args: [":memory:"],
  stdin: "piped",
  stdout: "piped",
  stderr: "piped",
}).spawn();
const writer = result.stdin.getWriter();
await writer.write(new TextEncoder().encode(input));
await writer.close();
const output = await result.output();
if (!output.success) throw new Error(new TextDecoder().decode(output.stderr));
const resultTexts = new TextDecoder().decode(output.stdout).trim().split(/\n(?=\[)/);
if (resultTexts.length === QUERIES.length + 1) {
  const pragma = JSON.parse(resultTexts.shift()!);
  if (pragma?.[0]?.journal_mode !== "memory") throw new Error("Unexpected journal_mode result");
}
if (resultTexts.length !== QUERIES.length) {
  throw new Error(`Independent sqlite3 emitted ${resultTexts.length} query result sets`);
}
const results = resultTexts.map((text, index) => ({
  id: QUERIES[index].id,
  rows: canonicalizeRows(JSON.parse(text)),
}));
const canonical = await canonicalResults(results);
const versionOutput = await new Deno.Command("sqlite3", {
  args: ["--version"],
  stdout: "piped",
}).output();
const record = {
  schemaVersion: 1,
  workloadId: "database.sqlite-notebook.v1",
  referenceId: "system-sqlite-independent-v1",
  generatedBy: "scripts/generate-sqlite-notebook-reference.ts",
  tool: {
    command: "sqlite3 :memory:",
    version: new TextDecoder().decode(versionOutput.stdout).trim(),
    relationship: "independent untimed correctness reference; not a benchmark target",
  },
  queryCount: QUERIES.length,
  rowCounts: Object.fromEntries(results.map((entry) => [entry.id, entry.rows.length])),
  canonicalOutputSha256: canonical.sha256,
  results,
};
await Deno.writeTextFile(
  new URL("public/artifacts/sqlite-notebook/reference.json", root),
  `${JSON.stringify(record, null, 2)}\n`,
);
console.log(JSON.stringify({ sha256: canonical.sha256, rowCounts: record.rowCounts }, null, 2));
