import { canonicalize, sha256Hex } from "../lib/canonical.ts";
import { executeFixture } from "../benchmarks/v1/text-gc-document-edit/workload.js";
import * as kotlinModule from "../public/artifacts/text-gc-document-edit/text-gc-document-edit.mjs";

const runDocumentFixture = kotlinModule.runDocumentFixture as unknown as (input: string) => string;
const wasmGcFeatureProof = kotlinModule.wasmGcFeatureProof as unknown as () => string;
const root = new URL("../", import.meta.url);
const artifactRoot = new URL("public/artifacts/text-gc-document-edit/", root);
const evidenceRoot = new URL("public/evidence/v1-base/text-gc-document-edit/", root);
await Deno.mkdir(evidenceRoot, { recursive: true });
const fixtureBytes = await Deno.readFile(new URL("fixture.v1.txt", artifactRoot));
const fixtureText = new TextDecoder("utf-8", { fatal: true }).decode(fixtureBytes);
const fixtureManifestBytes = await Deno.readFile(new URL("fixture-manifest.json", artifactRoot));
const buildManifestBytes = await Deno.readFile(new URL("build-manifest.json", artifactRoot));
const referenceBytes = await Deno.readFile(new URL("reference.json", artifactRoot));
const fixtureManifest = JSON.parse(new TextDecoder().decode(fixtureManifestBytes));
const reference = JSON.parse(new TextDecoder().decode(referenceBytes));
const jsResult = executeFixture(fixtureText, "js-controlled");
const wasmGcResult = JSON.parse(runDocumentFixture(fixtureText));
if (wasmGcFeatureProof() !== "0:array-backed child:1") {
  throw new Error("WasmGC feature proof failed");
}
for (const [name, result] of [["JavaScript", jsResult], ["WasmGC", wasmGcResult]] as const) {
  const bytes = new TextEncoder().encode(result.canonical);
  const hash = await sha256Hex(bytes);
  if (hash !== reference.canonicalSha256) throw new Error(`${name} output hash mismatch`);
  if (bytes.length !== reference.canonicalBytes) {
    throw new Error(`${name} output byte length mismatch`);
  }
  const expectedCounters = {
    ...reference.counters,
    "boundary-crossings": name === "WasmGC" ? 2 : 0,
  };
  if (canonicalize(result.counters) !== canonicalize(expectedCounters)) {
    throw new Error(`${name} counters mismatch`);
  }
  if (canonicalize(result.identity) !== canonicalize(reference.identity)) {
    throw new Error(`${name} identity mismatch`);
  }
}
if (jsResult.canonical !== wasmGcResult.canonical) throw new Error("target outputs differ");

const anchors = {
  fixtureSha256: await sha256Hex(fixtureBytes),
  fixtureManifestSha256: await sha256Hex(fixtureManifestBytes),
  buildManifestSha256: await sha256Hex(buildManifestBytes),
  referenceSha256: await sha256Hex(referenceBytes),
};
if (anchors.fixtureSha256 !== fixtureManifest.fixture.sha256) {
  throw new Error("fixture anchor mismatch");
}
const common = {
  schemaVersion: 1,
  registrationId: "text.gc-document-edit.v1-supplemental-registration-v1",
  workloadId: "text.gc-document-edit.v1",
  status: "correctness-validation-candidate-not-performance-result",
  fixedWork: {
    initialNodes: 256,
    operations: 10_000,
    inserts: 3_334,
    deletes: 3_333,
    reparents: 3_333,
  },
  oracle: {
    kind: "canonical-semantic",
    equivalenceClass: "semantic-product-choice",
    algorithmFamily: "document-tree-fixed-edit-trace",
    canonicalSha256: reference.canonicalSha256,
    canonicalBytes: reference.canonicalBytes,
    fullOutputCompared: true,
    allNodeIdsAndParentChildLinksChecked: true,
  },
  anchors,
  gcDiagnostics: {
    status: "unavailable",
    reason:
      "Portable GC events and runtime-internal allocation counts are not exposed by the Web platform.",
  },
  performanceClaim: null,
};
for (
  const [variant, result] of [["js-controlled", jsResult], [
    "wasmgc-controlled",
    wasmGcResult,
  ]] as const
) {
  await Deno.writeTextFile(
    new URL(`${variant}.json`, evidenceRoot),
    `${
      JSON.stringify(
        {
          ...common,
          variant,
          target: variant === "js-controlled" ? "javascript" : "wasmgc",
          passed: true,
          counters: result.counters,
          identity: result.identity,
          wasmGcFeatureProof: variant === "wasmgc-controlled"
            ? {
              executed: true,
              result: "0:array-backed child:1",
              export: "wasmGcFeatureProof",
              compilerTarget: "Kotlin 2.3.21 wasmJs production executable",
            }
            : null,
        },
        null,
        2,
      )
    }\n`,
  );
}

const status = {
  schemaVersion: 1,
  ledgerId: "frozen-v1-supplemental-implementation-status",
  status: "descriptive-candidate-status-not-accepted-catalog",
  frozenCatalog: {
    path: "catalog/workloads.v1.json",
    publicPath: "public/data/workloads.v1.json",
    sha256: "6665664f984683e5b7d3fdc8c1602198124844704c224a526d48be2f02edf9d4",
    immutable: "byte-for-byte",
    entryCount: 38,
  },
  coverage: {
    acceptedImplementedEntries: 0,
    denominator: 38,
    candidatePackages: 1,
    statement:
      "This candidate does not change 0/38 until exact-commit independent review and retained browser acceptance pass.",
  },
  entries: [{
    id: "text.gc-document-edit.v1",
    registrationId: common.registrationId,
    maturity: "complete-local-correctness-candidate-awaiting-browser-and-independent-review",
    targets: ["javascript", "wasmgc"],
    fixedWork: common.fixedWork,
    fixture: {
      path: "public/artifacts/text-gc-document-edit/fixture.v1.txt",
      manifest: "public/artifacts/text-gc-document-edit/fixture-manifest.json",
      sha256: anchors.fixtureSha256,
    },
    buildManifest: {
      path: "public/artifacts/text-gc-document-edit/build-manifest.json",
      sha256: anchors.buildManifestSha256,
    },
    records: [
      "public/evidence/v1-base/text-gc-document-edit/js-controlled.json",
      "public/evidence/v1-base/text-gc-document-edit/wasmgc-controlled.json",
    ],
    interactiveDemo: {
      route: "/demos/text.gc-document-edit.v1/",
      status: "implemented-awaiting-browser-evidence",
    },
    browserEvidence: {
      status: "unavailable",
      reason:
        "Delegated implementation scope explicitly prohibited Chrome; browser evidence must be collected by the authoritative controller.",
    },
  }],
};
await Deno.writeTextFile(
  new URL("catalog/v1-base-implementation-status.v1.json", root),
  `${JSON.stringify(status, null, 2)}\n`,
);
await Deno.mkdir(new URL("public/data/", root), { recursive: true });
await Deno.writeTextFile(
  new URL("public/data/v1-base-implementation-status.v1.json", root),
  `${JSON.stringify(status, null, 2)}\n`,
);
console.log(
  `text.gc-document-edit: JS/WasmGC exact output ${reference.canonicalSha256}; 10,000 edits`,
);
