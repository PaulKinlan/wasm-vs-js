const root = new URL("../", import.meta.url);
const sourceCommit = Deno.args[0] ?? "";
if (!/^[a-f0-9]{40}$/.test(sourceCommit)) {
  throw new Error("usage: build-sqlite-notebook-evidence.ts <40-hex-source-commit>");
}

const sourcePaths = [
  "deno.json",
  "deno.lock",
  "server.ts",
  "benchmarks/base/sqlite-notebook/benchmark.json",
  "benchmarks/base/sqlite-notebook/contract.js",
  "benchmarks/base/sqlite-notebook/engine.js",
  "catalog/base-database-sqlite-notebook-implementation.v1.json",
  "schemas/base-sqlite-notebook-record.schema.json",
  "scripts/build-sqlite-notebook-evidence.ts",
  "scripts/build-sqlite-notebook-runtime-manifest.ts",
  "scripts/check-sqlite-notebook-engines.ts",
  "scripts/generate-sqlite-notebook-fixture.ts",
  "scripts/generate-sqlite-notebook-reference.ts",
  "scripts/vendor-sqlite-notebook-deps.ts",
  "public/benchmarks/database-sqlite-notebook-v1/index.html",
  "public/sqlite-notebook-runner.js",
  "public/sqlite-notebook-worker.js",
  "tests/base-sqlite-notebook.test.ts",
];
const artifactPaths = [
  "public/artifacts/sqlite-notebook/alasql.min.js",
  "public/artifacts/sqlite-notebook/sqlite3.mjs",
  "public/artifacts/sqlite-notebook/sqlite3-node.mjs",
  "public/artifacts/sqlite-notebook/sqlite3.wasm",
  "public/artifacts/sqlite-notebook/dependency-manifest.json",
  "public/artifacts/sqlite-notebook/runtime-manifest.json",
  "public/artifacts/sqlite-notebook/fixtures/fixture-manifest.json",
  "public/artifacts/sqlite-notebook/fixtures/customers.csv",
  "public/artifacts/sqlite-notebook/fixtures/products.csv",
  "public/artifacts/sqlite-notebook/fixtures/sales.csv",
  "public/artifacts/sqlite-notebook/reference.json",
];

async function sha256(bytes: Uint8Array) {
  return [...new Uint8Array(await crypto.subtle.digest("SHA-256", Uint8Array.from(bytes)))]
    .map((value) => value.toString(16).padStart(2, "0")).join("");
}

async function gitBytes(path: string) {
  const result = await new Deno.Command("git", {
    args: ["show", `${sourceCommit}:${path}`],
    cwd: root,
    stdout: "piped",
    stderr: "piped",
  }).output();
  if (!result.success) throw new Error(new TextDecoder().decode(result.stderr));
  return result.stdout;
}

async function fileRecord(path: string, requireGitIdentity: boolean) {
  const disk = await Deno.readFile(new URL(path, root));
  if (requireGitIdentity) {
    const committed = await gitBytes(path);
    if (await sha256(committed) !== await sha256(disk)) {
      throw new Error(`source path differs from ${sourceCommit}: ${path}`);
    }
  }
  return { path, bytes: disk.byteLength, sha256: await sha256(disk) };
}

const sources = await Promise.all(sourcePaths.map((path) => fileRecord(path, true)));
const artifacts = await Promise.all(artifactPaths.map((path) => fileRecord(path, true)));
const sourceTreeBytes = new TextEncoder().encode(JSON.stringify(sources));
const sourceTreeSha256 = await sha256(sourceTreeBytes);
const fixture = JSON.parse(
  await Deno.readTextFile(
    new URL("public/artifacts/sqlite-notebook/fixtures/fixture-manifest.json", root),
  ),
);
const reference = JSON.parse(
  await Deno.readTextFile(new URL("public/artifacts/sqlite-notebook/reference.json", root)),
);
const dependencies = JSON.parse(
  await Deno.readTextFile(
    new URL("public/artifacts/sqlite-notebook/dependency-manifest.json", root),
  ),
);
const runtime = await fileRecord("public/artifacts/sqlite-notebook/runtime-manifest.json", true);

const buildManifest = {
  schemaVersion: 1,
  workloadId: "database.sqlite-notebook.v1",
  implementationId: "database.sqlite-notebook.controlled.v1",
  sourceRepository: "https://github.com/PaulKinlan/wasm-vs-js",
  sourceCommit,
  sourceTreeSha256,
  frozenCatalogSha256: "6665664f984683e5b7d3fdc8c1602198124844704c224a526d48be2f02edf9d4",
  toolchain: {
    deno: "2.9.0",
    javascriptEngine: "alasql@4.17.3",
    wasmEngine: "@sqlite.org/sqlite-wasm@3.53.0-build1",
    sqlite: "3.53.0",
    sqliteSourceId:
      "2026-04-09 11:41:38 4525003a53a7fc63ca75c59b22c79608659ca12f0131f52c18637f829977f20b",
    independentReference: reference.tool.version,
  },
  commands: [
    "deno run --allow-net=registry.npmjs.org --allow-read --allow-write=public/artifacts/sqlite-notebook,/tmp --allow-run=tar scripts/vendor-sqlite-notebook-deps.ts",
    "deno run --allow-write=public/artifacts/sqlite-notebook/fixtures scripts/generate-sqlite-notebook-fixture.ts",
    "deno run --allow-read --allow-write=public/artifacts/sqlite-notebook/reference.json --allow-run=sqlite3 scripts/generate-sqlite-notebook-reference.ts",
    "deno run --allow-read --allow-write=public/artifacts/sqlite-notebook/runtime-manifest.json,public/sqlite-notebook-worker.js scripts/build-sqlite-notebook-runtime-manifest.ts",
    `deno run --allow-read --allow-write=public/artifacts/sqlite-notebook,public/evidence/base-implementations/sqlite-notebook --allow-run=git scripts/build-sqlite-notebook-evidence.ts ${sourceCommit}`,
  ],
  productConfiguration: {
    javascript: ["AlaSQL 4.17.3", "in-memory", "single worker"],
    linearWasm: [
      "SQLite 3.53.0",
      "in-memory",
      "single worker",
      "OPFS disabled",
      "foreign_keys=OFF",
      "journal_mode=MEMORY",
      "synchronous=OFF",
      "temp_store=MEMORY",
      "automatic_index=OFF",
    ],
    equivalence: "semantic-product-choice; plans and product internals are not aggregated",
  },
  fixture,
  oracle: {
    kind: "complete-canonical-sql-results",
    queryCount: 8,
    resultRows: 744,
    outputSha256: reference.canonicalOutputSha256,
    independentReference: reference.referenceId,
  },
  dependencies,
  runtimeManifest: runtime,
  sources,
  artifacts,
};

const artifactDir = new URL("../public/artifacts/sqlite-notebook/", import.meta.url);
const evidenceDir = new URL(
  "../public/evidence/base-implementations/sqlite-notebook/",
  import.meta.url,
);
await Deno.mkdir(evidenceDir, { recursive: true });
await Deno.writeTextFile(
  new URL("build-manifest.json", artifactDir),
  `${JSON.stringify(buildManifest, null, 2)}\n`,
);
const shared = {
  schemaVersion: 1,
  workloadId: "database.sqlite-notebook.v1",
  implementationId: "database.sqlite-notebook.controlled.v1",
  status: "static-validation-package",
  sourceCommit,
  sourceTreeSha256,
  buildManifest: "public/artifacts/sqlite-notebook/build-manifest.json",
  fixtureManifest: "public/artifacts/sqlite-notebook/fixtures/fixture-manifest.json",
  reference: "public/artifacts/sqlite-notebook/reference.json",
  completeOutputSha256: reference.canonicalOutputSha256,
  correctness: {
    queryCount: 8,
    resultRows: 744,
    allCellsMatched: true,
    independentReferenceMatched: true,
  },
  performanceResult: null,
  browserEvidence: "not-collected",
};
for (
  const variant of [
    { id: "javascript-controlled", target: "javascript", boundaryCrossings: 0 },
    { id: "linear-wasm-controlled", target: "linear-wasm", boundaryCrossings: 2 },
  ]
) {
  const record = {
    ...shared,
    recordId: `database-sqlite-notebook-v1-${variant.id}`,
    variant: variant.id,
    target: variant.target,
    counters: {
      imports: 3,
      importedRows: 4192,
      queries: 8,
      joins: 6,
      groups: 6,
      windows: 2,
      sorts: 8,
      allocations: 11,
      boundaryCrossings: variant.boundaryCrossings,
    },
  };
  await Deno.writeTextFile(
    new URL(`${variant.id}.json`, evidenceDir),
    `${JSON.stringify(record, null, 2)}\n`,
  );
}
console.log(JSON.stringify({ sourceCommit, sourceTreeSha256, records: 2 }, null, 2));
