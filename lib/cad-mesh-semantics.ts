import { fixtureParameters, generateDirtyStl } from "../benchmarks/base/cad-mesh-repair/fixture.js";
import {
  instantiateMeshWasm,
  quantizeMeshCoordinate,
  repairMeshJavaScript,
  repairMeshWasm,
} from "../benchmarks/base/cad-mesh-repair/engine.js";
import { sha256Hex } from "./canonical.ts";

type JsonObject = Record<string, unknown>;
type FileIdentity = { bytes: number; sha256: string };

export type CadMeshSemanticRecords = {
  contract: unknown;
  buildManifest: unknown;
  evidence: unknown;
};

const SOURCE_REPOSITORY = "https://github.com/PaulKinlan/wasm-vs-js";
const CATALOG_ID = "cad.mesh-repair.v1";
const CONTRACT_PATH = "benchmarks/base/cad-mesh-repair/implementation-contract.v1.json";
const BUILD_PATH = "public/artifacts/cad-mesh-repair-v1/build-manifest.json";
const EVIDENCE_PATH = "public/artifacts/cad-mesh-repair-v1/validation-evidence.json";
const FIXTURE_PATH = "public/artifacts/cad-mesh-repair-v1/dirty-grid.stl";
const ARTIFACT_PATH = "public/artifacts/cad-mesh-repair-v1/mesh-repair.wasm";
const CATALOG_PATH = "catalog/workloads.v1.json";
const CONTRACT_SCHEMA_PATH = "schemas/cad-mesh-repair-contract.schema.json";
const BUILD_SCHEMA_PATH = "schemas/cad-mesh-repair-build-manifest.schema.json";
const EVIDENCE_SCHEMA_PATH = "schemas/cad-mesh-repair-evidence.schema.json";
const BOUNDARY_UNIT =
  "one JavaScript-to-Wasm exported-function call made by repairMeshWasm; each workload run calls input_ptr, run, and output_ptr once and reports three; instantiation is outside the workload run";

const SOURCE_ROLES = [
  ["benchmarks/base/cad-mesh-repair/fixture.js", "fixture-generator"],
  ["benchmarks/base/cad-mesh-repair/engine.js", "javascript-target-and-wasm-adapter"],
  ["benchmarks/base/cad-mesh-repair/mesh-repair.c", "authored-wasm-target"],
  [CONTRACT_PATH, "contract"],
  [CONTRACT_SCHEMA_PATH, "contract-schema"],
  [BUILD_SCHEMA_PATH, "build-schema"],
  [EVIDENCE_SCHEMA_PATH, "evidence-schema"],
  ["lib/cad-mesh-semantics.ts", "semantic-validator"],
  ["scripts/build-cad-mesh-repair.ts", "build-recipe"],
  ["deno.json", "task-and-toolchain-configuration"],
  ["deno.lock", "dependency-lock"],
] as const;

const SOURCE_EDGES = [
  {
    from: "scripts/build-cad-mesh-repair.ts",
    to: "benchmarks/base/cad-mesh-repair/fixture.js",
    relation: "generates-fixture",
  },
  {
    from: "scripts/build-cad-mesh-repair.ts",
    to: "benchmarks/base/cad-mesh-repair/mesh-repair.c",
    relation: "compiles",
  },
  {
    from: "scripts/build-cad-mesh-repair.ts",
    to: "benchmarks/base/cad-mesh-repair/engine.js",
    relation: "validates-target-equivalence",
  },
  {
    from: CONTRACT_PATH,
    to: CONTRACT_SCHEMA_PATH,
    relation: "validated-by",
  },
  {
    from: "lib/cad-mesh-semantics.ts",
    to: CONTRACT_PATH,
    relation: "validates-semantics",
  },
  {
    from: "lib/cad-mesh-semantics.ts",
    to: "benchmarks/base/cad-mesh-repair/engine.js",
    relation: "recomputes-evidence",
  },
  {
    from: "scripts/build-cad-mesh-repair.ts",
    to: "lib/cad-mesh-semantics.ts",
    relation: "validates-package",
  },
] as const;

function object(value: unknown, label: string): JsonObject {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error(`${label} must be an object`);
  }
  return value as JsonObject;
}

function array(value: unknown, label: string): unknown[] {
  if (!Array.isArray(value)) throw new Error(`${label} must be an array`);
  return value;
}

function string(value: unknown, label: string): string {
  if (typeof value !== "string") throw new Error(`${label} must be a string`);
  return value;
}

function exact(label: string, actual: unknown, expected: unknown) {
  if (JSON.stringify(actual) !== JSON.stringify(expected)) {
    throw new Error(`${label} does not match actual CAD evidence`);
  }
}

function same(label: string, actual: unknown, expected: unknown) {
  if (actual !== expected) throw new Error(`${label} does not match actual CAD evidence`);
}

async function identity(root: URL, path: string): Promise<FileIdentity> {
  const bytes = await Deno.readFile(new URL(path, root));
  return { bytes: bytes.length, sha256: await sha256Hex(bytes) };
}

function fileRecord(
  label: string,
  value: unknown,
  expectedPath: string,
  actual: FileIdentity,
  includeBytes: boolean,
) {
  const record = object(value, label);
  same(`${label}.path`, record.path, expectedPath);
  same(`${label}.sha256`, record.sha256, actual.sha256);
  if (includeBytes) same(`${label}.bytes`, record.bytes, actual.bytes);
}

export async function createCadMeshSemanticValidator(root: URL) {
  const officialManifestBytes = await Deno.readFile(new URL(BUILD_PATH, root));
  const officialManifest = object(
    JSON.parse(new TextDecoder().decode(officialManifestBytes)),
    "published build manifest",
  );
  const officialSource = object(officialManifest.source, "published build source");
  const sourceCommit = string(officialSource.commit, "published build source commit");
  if (!/^[a-f0-9]{40}$/.test(sourceCommit)) throw new Error("published source commit is invalid");

  const identities = new Map<string, FileIdentity>();
  for (
    const path of [
      CATALOG_PATH,
      FIXTURE_PATH,
      ARTIFACT_PATH,
      CONTRACT_PATH,
      CONTRACT_SCHEMA_PATH,
      BUILD_SCHEMA_PATH,
      EVIDENCE_SCHEMA_PATH,
    ]
  ) identities.set(path, await identity(root, path));

  const sourceNodes: Array<{
    path: string;
    role: string;
    bytes: number;
    sha256: string;
  }> = [];
  for (const [path, role] of SOURCE_ROLES) {
    const local = await Deno.readFile(new URL(path, root));
    const committed = await new Deno.Command("git", {
      args: ["show", `${sourceCommit}:${path}`],
      cwd: root.pathname,
      stdout: "piped",
      stderr: "piped",
    }).output();
    if (!committed.success || await sha256Hex(committed.stdout) !== await sha256Hex(local)) {
      throw new Error(`${path} is not bound to source commit ${sourceCommit}`);
    }
    sourceNodes.push({ path, role, bytes: local.length, sha256: await sha256Hex(local) });
  }

  const fixture = await Deno.readFile(new URL(FIXTURE_PATH, root));
  exact("generated fixture bytes", fixture, generateDirtyStl());
  const wasmBytes = await Deno.readFile(new URL(ARTIFACT_PATH, root));
  const js = repairMeshJavaScript(fixture);
  const wasm = repairMeshWasm(await instantiateMeshWasm(wasmBytes), fixture);
  exact("cross-target complete output", js.bytes, wasm.bytes);
  const completeOutputSha256 = await sha256Hex(js.bytes);
  const buildManifestSha256 = await sha256Hex(officialManifestBytes);
  const negativeHalf = Math.fround(-0.00004999999873689376);

  return (records: CadMeshSemanticRecords): void => {
    const contract = object(records.contract, "contract");
    const manifest = object(records.buildManifest, "build manifest");
    const evidence = object(records.evidence, "evidence");

    same("contract catalog identity", contract.catalogId, CATALOG_ID);
    same("build catalog identity", manifest.catalogId, CATALOG_ID);
    same("contract/build catalog identity", contract.catalogId, manifest.catalogId);
    same(
      "contract frozen catalog hash",
      contract.frozenCatalogSha256,
      identities.get(CATALOG_PATH)?.sha256,
    );
    exact("contract targets", contract.targets, ["js-controlled", "wasm-linear-controlled"]);
    const contractFixture = object(contract.fixture, "contract.fixture");
    same(
      "contract fixture source faces",
      contractFixture.sourceFaces,
      fixtureParameters.sourceFaces,
    );
    same("contract fixture valid faces", contractFixture.validFaces, fixtureParameters.validFaces);
    same(
      "contract fixture degenerate faces",
      contractFixture.degenerateFaces,
      fixtureParameters.degenerateFaces,
    );
    const work = object(contract.work, "contract.work");
    same("contract boundary crossing unit", work.boundaryCrossingUnit, BOUNDARY_UNIT);

    const source = object(manifest.source, "build.source");
    same("build source repository", source.repository, SOURCE_REPOSITORY);
    same("build source commit", source.commit, sourceCommit);
    same("build source URL", source.commitUrl, `${SOURCE_REPOSITORY}/commit/${sourceCommit}`);
    const sourceGraph = object(manifest.sourceGraph, "build.sourceGraph");
    exact("build source graph nodes", sourceGraph.nodes, sourceNodes);
    exact("build source graph edges", sourceGraph.edges, SOURCE_EDGES);

    const frozenCatalog = object(manifest.frozenCatalog, "build.frozenCatalog");
    same("build frozen catalog path", frozenCatalog.path, CATALOG_PATH);
    same(
      "build frozen catalog hash",
      frozenCatalog.sha256,
      identities.get(CATALOG_PATH)?.sha256,
    );
    fileRecord(
      "build.fixture",
      manifest.fixture,
      FIXTURE_PATH,
      identities.get(FIXTURE_PATH)!,
      true,
    );
    exact(
      "build fixture parameters",
      object(manifest.fixture, "build.fixture").parameters,
      fixtureParameters,
    );
    fileRecord(
      "build.artifact",
      manifest.artifact,
      ARTIFACT_PATH,
      identities.get(ARTIFACT_PATH)!,
      true,
    );
    fileRecord(
      "build.contract",
      manifest.contract,
      CONTRACT_PATH,
      identities.get(CONTRACT_PATH)!,
      true,
    );
    fileRecord(
      "build contract schema",
      object(manifest.contract, "build.contract").schema,
      CONTRACT_SCHEMA_PATH,
      identities.get(CONTRACT_SCHEMA_PATH)!,
      false,
    );
    const buildEvidence = object(manifest.evidence, "build.evidence");
    same("build evidence path", buildEvidence.path, EVIDENCE_PATH);
    fileRecord(
      "build evidence schema",
      buildEvidence.schema,
      EVIDENCE_SCHEMA_PATH,
      identities.get(EVIDENCE_SCHEMA_PATH)!,
      false,
    );
    fileRecord(
      "build manifest schema",
      object(manifest.build, "build.build").schema,
      BUILD_SCHEMA_PATH,
      identities.get(BUILD_SCHEMA_PATH)!,
      false,
    );
    const buildCommand = string(object(manifest.build, "build.build").command, "build command");
    if (!buildCommand.endsWith(`--source-commit=${sourceCommit}`)) {
      throw new Error("build command does not bind the actual source commit");
    }

    same("evidence identity", evidence.evidenceId, "cad-mesh-repair-v1-correctness");
    fileRecord(
      "evidence.buildManifest",
      evidence.buildManifest,
      BUILD_PATH,
      { bytes: officialManifestBytes.length, sha256: buildManifestSha256 },
      false,
    );
    fileRecord(
      "evidence.contract",
      evidence.contract,
      CONTRACT_PATH,
      identities.get(CONTRACT_PATH)!,
      false,
    );
    fileRecord(
      "evidence.fixture",
      evidence.fixture,
      FIXTURE_PATH,
      identities.get(FIXTURE_PATH)!,
      false,
    );
    fileRecord(
      "evidence.artifact",
      evidence.artifact,
      ARTIFACT_PATH,
      identities.get(ARTIFACT_PATH)!,
      false,
    );

    const oracle = object(evidence.oracle, "evidence.oracle");
    same("evidence complete output hash", oracle.completeOutputSha256, completeOutputSha256);
    same("evidence complete output bytes", oracle.bytes, js.bytes.length);
    exact("evidence invariants", oracle.invariants, js.invariants);
    exact("evidence JavaScript counters", oracle.jsCounters, js.counters);
    exact("evidence Wasm counters", oracle.wasmCounters, wasm.counters);
    const equivalentNames = array(work.equivalentCounters, "contract equivalent counters");
    exact("evidence equivalent counter names", oracle.equivalentCounterNames, equivalentNames);
    const jsCounters = object(oracle.jsCounters, "evidence JavaScript counters");
    const wasmCounters = object(oracle.wasmCounters, "evidence Wasm counters");
    for (const nameValue of equivalentNames) {
      const name = string(nameValue, "equivalent counter name");
      same(`cross-target counter ${name}`, jsCounters[name], wasmCounters[name]);
    }
    same("evidence complete-byte equality", oracle.crossTargetCompleteBytesEqual, true);
    const adversarial = object(oracle.negativeHalfAdversarial, "negative-half evidence");
    same("negative-half stored f32", adversarial.storedF32, negativeHalf);
    same(
      "negative-half quantized result",
      adversarial.quantizedI32,
      quantizeMeshCoordinate(negativeHalf),
    );
    same("negative-half expected result", adversarial.expectedI32, -1);
  };
}

export async function validatePublishedCadMeshSemantics(root: URL): Promise<void> {
  const records = {
    contract: JSON.parse(await Deno.readTextFile(new URL(CONTRACT_PATH, root))),
    buildManifest: JSON.parse(await Deno.readTextFile(new URL(BUILD_PATH, root))),
    evidence: JSON.parse(await Deno.readTextFile(new URL(EVIDENCE_PATH, root))),
  };
  const validate = await createCadMeshSemanticValidator(root);
  validate(records);
}
