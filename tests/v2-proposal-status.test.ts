import Ajv2020Module from "ajv2020";
import { assert, assertEquals } from "./assert.ts";
import { sha256Hex } from "../lib/canonical.ts";

const Ajv2020 = (Ajv2020Module as unknown as { default?: typeof Ajv2020Module }).default ??
  Ajv2020Module;
const ledgerPath = "catalog/v2-proposal-implementation-status.v1.json";
const publicLedgerPath = "public/data/v2-proposal-implementation-status.v1.json";
const schemaPath = "schemas/v2-proposal-implementation-status.schema.json";
const publicSchemaPath = "public/data/v2-proposal-implementation-status.schema.json";
const ledger = JSON.parse(await Deno.readTextFile(ledgerPath));
const catalog = JSON.parse(await Deno.readTextFile("catalog/workloads.v2.proposed.json"));
const v1Catalog = JSON.parse(await Deno.readTextFile("catalog/workloads.v1.json"));
const schema = JSON.parse(await Deno.readTextFile(schemaPath));

type RepositoryLink = { label: string; path: string; url: string };
type StatusEntry = {
  id: string;
  title: string;
  maturity: string;
  definitionSource: RepositoryLink;
  engine: {
    status: string;
    sourceLinks: RepositoryLink[];
    unavailableReason: { code: string } | null;
  };
  artifacts: {
    status: string;
    repositoryLinks: RepositoryLink[];
    publicLinks: Array<{ label: string; url: string }>;
    unavailableReason: { code: string } | null;
  };
  validationResults: {
    status: string;
    recordCount: number;
    repositoryLinks: RepositoryLink[];
    publicEvidenceLinks: Array<{ label: string; url: string }>;
    unavailableReason: { code: string } | null;
    publicEvidenceUnavailableReason: { code: string } | null;
  };
  interactiveDemo: {
    status: string;
    route: string | null;
    unavailableReason: { code: string } | null;
  };
  authoritativePerformanceResults: {
    status: string;
    unavailableReason: { code: string };
  };
};

const entries = ledger.entries as StatusEntry[];
const byId = new Map(entries.map((entry) => [entry.id, entry]));
const expectedMaturity = {
  "complete-public-proposal-validation-package": [
    "audio.fft.v1",
    "audio.fir.v1",
    "audio.stft.v1",
    "game.canvas-arcade.v1",
    "game.canvas-entity-pathfinding.v1",
    "game.dom-tactics-grid.v1",
  ],
  "complete-local-only-proposal-validation-package": [
    "ml.dense-mlp.v1",
    "ml.gemm.v1",
    "text.diff-patch.v1",
    "text.markdown-cms.v1",
  ],
  "tested-image-engine-no-result-records": [
    "image.editing-pipeline.v1",
    "image.flood-fill.v1",
  ],
  "tested-reduced-conformance-slice": [
    "dom.vdom-diff-patch.v1",
    "text.regex-engine-duel.v1",
  ],
};
const testedIds = Object.values(expectedMaturity).flat();

function validator() {
  const ajv = new (Ajv2020 as unknown as new (options: Record<string, unknown>) => {
    compile: (schema: unknown) => ((value: unknown) => boolean) & { errors?: unknown };
  })({ allErrors: true, strict: false });
  return ajv.compile(schema);
}

async function fileExists(path: string): Promise<boolean> {
  try {
    return (await Deno.stat(path)).isFile;
  } catch (error) {
    if (error instanceof Deno.errors.NotFound) return false;
    throw error;
  }
}

function allRepositoryLinks(entry: StatusEntry): RepositoryLink[] {
  return [
    entry.definitionSource,
    ...entry.engine.sourceLinks,
    ...entry.artifacts.repositoryLinks,
    ...entry.validationResults.repositoryLinks,
  ];
}

Deno.test("v2 implementation ledger is closed, canonical, and publicly byte-identical", async () => {
  const validate = validator();
  assert(validate(ledger), JSON.stringify(validate.errors));
  assertEquals(await Deno.readTextFile(publicLedgerPath), await Deno.readTextFile(ledgerPath));
  assertEquals(await Deno.readTextFile(publicSchemaPath), await Deno.readTextFile(schemaPath));
  assertEquals(await Deno.readTextFile(ledgerPath), `${JSON.stringify(ledger, null, 2)}\n`);

  const poisoned = structuredClone(ledger);
  poisoned.entries[0].inventedTiming = 1;
  assert(!validate(poisoned), "closed status schema accepted an undeclared field");
});

Deno.test("v2 ledger covers the exact 20-ID proposal roster without changing frozen v1", async () => {
  assertEquals(
    entries.map((entry) => entry.id),
    catalog.entries.map((entry: { id: string }) => entry.id),
  );
  assertEquals(
    entries.map((entry) => entry.title),
    catalog.entries.map((entry: { title: string }) => entry.title),
  );
  assertEquals(new Set(entries.map((entry) => entry.id)).size, 20);
  assertEquals(ledger.frozenV1Coverage.entryCount, 38);
  assertEquals(ledger.frozenV1Coverage.implementedCatalogEntries, 0);
  assertEquals(ledger.frozenV1Coverage.v2EntriesCounted, false);
  assertEquals(v1Catalog.entries.length, 38);
  assertEquals(v1Catalog.implementationCoverage.implementedCatalogEntries, 0);
  assertEquals(
    await sha256Hex(await Deno.readFile("catalog/workloads.v1.json")),
    ledger.frozenV1Coverage.catalogSha256,
  );
  assertEquals(
    await sha256Hex(await Deno.readFile("schemas/workload-catalog.schema.json")),
    ledger.frozenV1Coverage.schemaSha256,
  );
  assertEquals(
    await Deno.readFile("catalog/workloads.v1.json"),
    await Deno.readFile("public/data/workloads.v1.json"),
  );
});

Deno.test("v2 ledger counts reconcile to ten validation packages, two engine-only images, two reduced slices, and six definitions", () => {
  for (const [maturity, ids] of Object.entries(expectedMaturity)) {
    assertEquals(
      entries.filter((entry) => entry.maturity === maturity).map((entry) => entry.id),
      ids,
    );
  }
  const definitionOnly = entries.filter((entry) => entry.maturity === "proposal-definition-only");
  assertEquals(
    entries.filter((entry) => entry.engine.status === "tested-js-and-linear-wasm").length,
    14,
  );
  assertEquals(definitionOnly.length, 6);
  assertEquals(
    entries.filter((entry) => entry.validationResults.status === "complete-public").length,
    6,
  );
  assertEquals(
    entries.filter((entry) => entry.validationResults.status === "complete-local-only").length,
    4,
  );
  assertEquals(entries.reduce((sum, entry) => sum + entry.validationResults.recordCount, 0), 20);
  assertEquals(ledger.counts.publicValidationRecords, 12);
  assertEquals(ledger.counts.localOnlyValidationRecords, 8);
  assertEquals(entries.filter((entry) => entry.interactiveDemo.status !== "unavailable").length, 8);
  assertEquals(
    entries.filter((entry) => entry.authoritativePerformanceResults.status !== "unavailable")
      .length,
    0,
  );

  for (const entry of definitionOnly) {
    assertEquals(entry.engine.unavailableReason?.code, "definition-only");
    assertEquals(entry.artifacts.unavailableReason?.code, "definition-only");
    assertEquals(entry.validationResults.unavailableReason?.code, "no-validation-record");
  }
  for (const id of expectedMaturity["tested-reduced-conformance-slice"]) {
    const entry = byId.get(id);
    assert(entry, `${id} missing from ledger`);
    assertEquals(entry.artifacts.status, "reproducible-repository-only");
    assertEquals(entry.artifacts.publicLinks, []);
  }
  assertEquals(
    entries.filter((entry) => entry.artifacts.publicLinks.length > 0).map((entry) => entry.id),
    [
      ...expectedMaturity["complete-public-proposal-validation-package"],
      "text.diff-patch.v1",
      "text.markdown-cms.v1",
    ],
  );
  for (const entry of entries) {
    if (entry.interactiveDemo.status === "unavailable") {
      assertEquals(entry.interactiveDemo.unavailableReason?.code, "no-interactive-demo");
      assertEquals(entry.interactiveDemo.route, null);
    } else {
      assert(
        /^\/(?:demos\/[a-z0-9.-]+|benchmarks\/audio-(?:fft|fir|stft))\/$/.test(
          entry.interactiveDemo.route ?? "",
        ),
      );
      assertEquals(entry.interactiveDemo.unavailableReason, null);
    }
    assertEquals(
      entry.authoritativePerformanceResults.unavailableReason.code,
      "no-authoritative-performance-results",
    );
  }
});

Deno.test("every immutable v2 source, artifact, and result link resolves to worktree evidence", async () => {
  const revisionPrefix = `https://github.com/PaulKinlan/wasm-vs-js/blob/${ledger.sourceRevision}/`;
  const catalogLines = (await Deno.readTextFile("catalog/workloads.v2.proposed.json")).split("\n");
  for (const entry of entries) {
    const idLine = catalogLines.findIndex((line) => line.includes(`\"id\": \"${entry.id}\"`)) + 1;
    assert(idLine > 0, `${entry.id} has no definition line`);
    assert(
      entry.definitionSource.url.startsWith(
        `${revisionPrefix}catalog/workloads.v2.proposed.json#L${idLine}`,
      ),
      `${entry.id} definition link does not point at its exact line`,
    );
    for (const link of allRepositoryLinks(entry)) {
      assert(await fileExists(link.path), `${entry.id} link path does not exist: ${link.path}`);
      assert(
        link.url.startsWith(`${revisionPrefix}${link.path}`),
        `${entry.id} link is not immutable: ${link.url}`,
      );
    }
  }
});

Deno.test("the fourteen engine statuses bind real JavaScript, linear-Wasm, artifact, and result boundaries", async () => {
  const requiredSourceSuffixes: Record<string, [string, string]> = {
    "audio.fft.v1": ["benchmarks/audio-fft/js.ts", "benchmarks/audio-fft/audio-fft.wat"],
    "audio.fir.v1": ["benchmarks/audio-fir/js.ts", "benchmarks/audio-fir/audio-fir.wat"],
    "audio.stft.v1": ["benchmarks/audio-stft/js.ts", "benchmarks/audio-stft/audio-stft.wat"],
    "dom.vdom-diff-patch.v1": [
      "benchmarks/vdom-diff-patch/js.ts",
      "benchmarks/vdom-diff-patch/vdom-diff-patch.wat",
    ],
    "image.editing-pipeline.v1": [
      "benchmarks/image-editing/js.ts",
      "benchmarks/image-editing/image-editing.wat",
    ],
    "image.flood-fill.v1": [
      "benchmarks/image-editing/js.ts",
      "benchmarks/image-editing/image-editing.wat",
    ],
    "game.canvas-arcade.v1": [
      "benchmarks/v2/game-family/engine.js",
      "benchmarks/v2/game-family/game-family.c",
    ],
    "game.canvas-entity-pathfinding.v1": [
      "benchmarks/v2/game-family/engine.js",
      "benchmarks/v2/game-family/game-family.c",
    ],
    "game.dom-tactics-grid.v1": [
      "benchmarks/v2/game-family/engine.js",
      "benchmarks/v2/game-family/game-family.c",
    ],
    "ml.dense-mlp.v1": [
      "benchmarks/v2/ml-dense-mlp/workload.js",
      "benchmarks/v2/ml-dense-mlp/ml-dense-mlp.wat",
    ],
    "ml.gemm.v1": ["benchmarks/v2/ml-gemm/workload.js", "benchmarks/v2/ml-gemm/ml-gemm.wat"],
    "text.diff-patch.v1": [
      "benchmarks/v2/text-diff-patch/workload.js",
      "benchmarks/v2/text-diff-patch/text-diff-patch.wat",
    ],
    "text.markdown-cms.v1": [
      "benchmarks/v2/text-markdown-cms/workload.js",
      "benchmarks/v2/text-markdown-cms/text-markdown-cms.wat",
    ],
    "text.regex-engine-duel.v1": [
      "benchmarks/regex-automata-duel/js-automata.ts",
      "benchmarks/regex-automata-duel/regex-automata.wat",
    ],
  };
  assertEquals(Object.keys(requiredSourceSuffixes).sort(), [...testedIds].sort());
  for (const [id, requiredPaths] of Object.entries(requiredSourceSuffixes)) {
    const entry = byId.get(id);
    assert(entry, `${id} missing from ledger`);
    const paths = entry.engine.sourceLinks.map((link) => link.path);
    for (const path of requiredPaths) assert(paths.includes(path), `${id} omits ${path}`);
    assert(entry.artifacts.status !== "unavailable", `${id} lacks artifact status`);
  }

  for (const entry of entries.filter((item) => item.validationResults.recordCount === 2)) {
    for (const link of entry.validationResults.repositoryLinks) {
      const result = JSON.parse(await Deno.readTextFile(link.path));
      assertEquals(result.status, "proposal-validation-only");
      assertEquals(result.workload.entryId, entry.id);
      assertEquals(result.performanceClaims, []);
    }
  }

  for (
    const [id, slug] of [
      ["dom.vdom-diff-patch.v1", "vdom-diff-patch"],
      ["text.regex-engine-duel.v1", "regex-automata-duel"],
    ]
  ) {
    const benchmark = JSON.parse(await Deno.readTextFile(`benchmarks/${slug}/benchmark.json`));
    assertEquals(benchmark.extensions.reducedHarness.catalogCoverage, false);
    assertEquals(benchmark.extensions.reducedHarness.acceptedProductionContract.id, id);
    assertEquals(
      benchmark.extensions.reducedHarness.acceptedProductionContract.status,
      "not-implemented",
    );
  }
  const imageContract = JSON.parse(
    await Deno.readTextFile("benchmarks/image-editing/measurement-contract.json"),
  );
  assertEquals(imageContract.status, "proposal-out-of-catalog");
  assertEquals(imageContract.authoritativePerformanceEvidence, false);
});

Deno.test("benchmarks page exposes the complete v2 inventory in raw HTML", async () => {
  const page = await Deno.readTextFile("public/benchmarks/index.html");
  assert(page.includes("38 proposed workloads; 0 implemented"));
  assert(page.includes("Coverage is 0/38"));
  assert(page.includes("v2 proposal implementation inventory"));
  assert(page.includes("Runnable demos: 12"));
  assert(page.includes("8 full proposal-validation routes and 4 reduced-fixture routes"));
  assert(page.includes("No v2 package contains authoritative performance results"));
  assert(page.includes("not the full proposal contract"));
  assert(page.includes('href="/data/v2-proposal-implementation-status.v1.json"'));
  assertEquals(page.match(/data-v2-id=/g)?.length, 20);
  for (const entry of entries) assert(page.includes(`data-v2-id="${entry.id}"`));
  assert(!page.includes("v2 status loading"));
});
