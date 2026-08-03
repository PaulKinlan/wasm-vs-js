import sqlite3InitModule from "../public/artifacts/sqlite-notebook/sqlite3-node.mjs";
import { parseCsv, runAlaSql, runSqlite } from "../benchmarks/base/sqlite-notebook/engine.js";
import { IMPORT_ORDER } from "../benchmarks/base/sqlite-notebook/contract.js";

const alasqlSource = await Deno.readTextFile(
  new URL("../public/artifacts/sqlite-notebook/alasql.min.js", import.meta.url),
);
const alasql = new Function(`${alasqlSource}\nreturn this.alasql;`).call(globalThis);
if (typeof alasql !== "function") throw new Error("Vendored AlaSQL did not initialize");

const fixture: Record<string, unknown[]> = {};
for (const table of IMPORT_ORDER) {
  fixture[table] = parseCsv(
    await Deno.readTextFile(
      new URL(`../public/artifacts/sqlite-notebook/fixtures/${table}.csv`, import.meta.url),
    ),
    table,
  );
}
const sqlite3 = await sqlite3InitModule({ print: () => {}, printErr: () => {} });
const [js, wasm] = await Promise.all([
  runAlaSql(alasql, fixture),
  runSqlite(sqlite3, fixture),
]);
if (js.canonical !== wasm.canonical) {
  await Deno.writeTextFile("/tmp/sqlite-notebook-js.json", js.canonical);
  await Deno.writeTextFile("/tmp/sqlite-notebook-wasm.json", wasm.canonical);
  throw new Error(`Engine mismatch: JS ${js.sha256}, Wasm ${wasm.sha256}`);
}
console.log(
  JSON.stringify(
    {
      sha256: js.sha256,
      queries: js.results.map((entry) => ({ id: entry.id, rows: entry.rows.length })),
    },
    null,
    2,
  ),
);
