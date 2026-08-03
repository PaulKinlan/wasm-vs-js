import { sha256Hex } from "../lib/canonical.ts";
import { GAME_IDS, generateFixture } from "../benchmarks/v2/game-family/fixtures.js";
import {
  instantiateGameWasm,
  runGameJavaScript,
  runGameWasm,
} from "../benchmarks/v2/game-family/engine.js";

const root = new URL("../", import.meta.url);
const repository = "https://github.com/PaulKinlan/wasm-vs-js";
const artifactDir = new URL("public/artifacts/game-v2-controlled-family/", root);
const evidenceDir = new URL("public/evidence/v2-proposals/games/", root);
const sourceOnly = Deno.args.includes("--source-only");
const sourceArgument = Deno.args.find((value) => value.startsWith("--source-commit="));
const sourceCommit = sourceArgument?.slice("--source-commit=".length) ?? "";
if (!sourceOnly && !/^[a-f0-9]{40}$/.test(sourceCommit)) {
  throw new Error("--source-commit=<40 lowercase hex Git commit> is required");
}
await Deno.mkdir(artifactDir, { recursive: true });
await Deno.mkdir(evidenceDir, { recursive: true });

async function command(name: string, args: string[], cwd = root.pathname) {
  const result = await new Deno.Command(name, {
    args,
    cwd,
    stdout: "piped",
    stderr: "piped",
  }).output();
  if (!result.success) throw new Error(new TextDecoder().decode(result.stderr));
  return result.stdout;
}

const buildDir = new URL(".build/", artifactDir).pathname;
await Deno.remove(buildDir, { recursive: true }).catch((error) => {
  if (!(error instanceof Deno.errors.NotFound)) throw error;
});
await Deno.mkdir(buildDir, { recursive: true });
try {
  const objectPath = `${buildDir}game-family.o`;
  const wasmPath = `${buildDir}game-family.wasm`;
  await command("clang", [
    "--target=wasm32-unknown-unknown",
    "-O3",
    "-nostdlib",
    "-ffreestanding",
    "-fno-builtin",
    "-c",
    "benchmarks/v2/game-family/game-family.c",
    "-o",
    objectPath,
  ]);
  await command("wasm-ld", [
    "--no-entry",
    "--export-memory",
    "--export=input_ptr",
    "--export=result_ptr",
    "--export=run",
    "--initial-memory=4194304",
    "--max-memory=4194304",
    "--stack-first",
    objectPath,
    "-o",
    wasmPath,
  ]);
  await Deno.writeFile(new URL("game-family.wasm", artifactDir), await Deno.readFile(wasmPath));
} finally {
  await Deno.remove(buildDir, { recursive: true });
}

const wasm = await Deno.readFile(new URL("game-family.wasm", artifactDir));
const runtime = await instantiateGameWasm(wasm);
const fixtures = [];
const outputs: Record<string, unknown> = {};
for (const id of GAME_IDS) {
  const fixture = generateFixture(id);
  const slug = id.replaceAll(".", "-");
  const path = `public/artifacts/game-v2-controlled-family/${slug}.bin`;
  await Deno.writeFile(new URL(`${slug}.bin`, artifactDir), fixture);
  const sha256 = await sha256Hex(fixture);
  fixtures.push({
    workloadId: id,
    path,
    bytes: fixture.length,
    sha256,
    generator: "xorshift32 with the catalog seed and canonical little-endian serialization",
  });
  const js = runGameJavaScript(id, fixture);
  const wasmResult = runGameWasm(id, runtime, fixture);
  const normalize = (result: Record<string, unknown>) => ({
    ...result,
    variantId: null,
    executionTarget: null,
  });
  if (JSON.stringify(normalize(js)) !== JSON.stringify(normalize(wasmResult))) {
    throw new Error(`${id} JavaScript/Wasm complete output mismatch`);
  }
  outputs[id] = {
    input: { bytes: fixture.length, sha256 },
    variants: {
      "js-controlled": {
        status: "passed",
        executionTarget: "javascript",
        oracleChecks: {
          "complete-output": { status: "passed", digest: js.digest, oracle: js.oracle },
          "structural-invariants": { status: "passed", replay: js.replay },
          "work-counters": { status: "passed", counters: js.counters },
        },
      },
      "wasm-linear-controlled": {
        status: "passed",
        executionTarget: "wasm-linear",
        oracleChecks: {
          "complete-output": {
            status: "passed",
            digest: wasmResult.digest,
            oracle: wasmResult.oracle,
          },
          "structural-invariants": { status: "passed", replay: wasmResult.replay },
          "work-counters": { status: "passed", counters: wasmResult.counters },
        },
      },
    },
  };
}

const fixtureManifest = {
  schemaVersion: 1,
  familyId: "game-v2-controlled-family",
  immutable: true,
  rights: {
    license: "CC0-1.0",
    redistribution: "permitted",
    provenance:
      "Generated entirely by benchmarks/v2/game-family/fixtures.js; no external media or user data.",
  },
  fixtures,
};
const inputManifest = {
  schemaVersion: 1,
  familyId: "game-v2-controlled-family",
  serialization: "canonical little-endian integer fields",
  fixtures: fixtures.map(({ workloadId, path, bytes, sha256 }) => ({
    workloadId,
    path,
    bytes,
    sha256,
  })),
};
const outputManifest = {
  schemaVersion: 1,
  status: "proposal-validation-only",
  familyId: "game-v2-controlled-family",
  equivalence: "complete exact cross-target equality",
  workloads: outputs,
  performanceClaims: [],
};
for (
  const [name, value] of [
    ["fixture-manifest.json", fixtureManifest],
    ["input-manifest.json", inputManifest],
    ["output-manifest.json", outputManifest],
  ] as const
) {
  await Deno.writeTextFile(new URL(name, artifactDir), `${JSON.stringify(value, null, 2)}\n`);
}
if (sourceOnly) {
  console.log(`build: source artifacts ${wasm.length} byte Wasm, 3 fixtures, exact output oracle`);
  Deno.exit(0);
}

async function gitBytes(path: string) {
  return await command("git", ["show", `${sourceCommit}:${path}`]);
}
async function ref(path: string) {
  const disk = await Deno.readFile(new URL(path, root));
  const tree = await gitBytes(path);
  if (await sha256Hex(disk) !== await sha256Hex(tree)) {
    throw new Error(`source tree mismatch at ${path}`);
  }
  return {
    path,
    sha256: await sha256Hex(tree),
    immutableUrl: `${repository}/blob/${sourceCommit}/${path}`,
  };
}
function uniquePaths(references: Array<{ path: string }>) {
  return [...new Set(references.map(({ path }) => path))].sort();
}

const sourcePaths = [
  "benchmarks/v2/game-family/engine.js",
  "benchmarks/v2/game-family/fixtures.js",
  "benchmarks/v2/game-family/game-family.c",
  "benchmarks/v2/game-family/implementation-contract.v1.json",
  "scripts/build-game-family.ts",
  "benchmarks/v2/shared/workload-contract.js",
  "benchmarks/v2/shared/provenance-contract.js",
  "catalog/workloads.v2.proposed.json",
  "schemas/workload-result-v2-proposal.schema.json",
  "deno.json",
  "deno.lock",
];
const sourceReferences = await Promise.all(sourcePaths.map(async (path) => ({
  role: path.endsWith("engine.js")
    ? "javascript-authored"
    : path.endsWith("game-family.c")
    ? "wasm-authored"
    : "shared-support",
  ...await ref(path),
})));
const catalog = JSON.parse(
  await Deno.readTextFile(new URL("catalog/workloads.v2.proposed.json", root)),
);
const workloadCatalog = await ref("catalog/workloads.v2.proposed.json");
const workloadContract = await ref("benchmarks/v2/shared/workload-contract.js");
const resultContract = await ref("schemas/workload-result-v2-proposal.schema.json");
const generator = await ref("scripts/build-game-family.ts");
const reference = await ref("benchmarks/v2/game-family/engine.js");
const oracle = await ref("public/artifacts/game-v2-controlled-family/output-manifest.json");
const fixtureManifestReference = await ref(
  "public/artifacts/game-v2-controlled-family/fixture-manifest.json",
);
const inputManifestReference = await ref(
  "public/artifacts/game-v2-controlled-family/input-manifest.json",
);
const outputManifestReference = await ref(
  "public/artifacts/game-v2-controlled-family/output-manifest.json",
);
const recipe = await ref("scripts/build-game-family.ts");
const lock = await ref("deno.lock");
const wasmArtifact = await ref("public/artifacts/game-v2-controlled-family/game-family.wasm");
const clangVersion = new TextDecoder().decode(await command("clang", ["--version"])).split("\n")[0];
const linkerVersion = new TextDecoder().decode(await command("wasm-ld", ["--version"])).trim();
const build = {
  recipe,
  cwd: ".",
  command: [
    "deno",
    "run",
    "--allow-read=.",
    "--allow-write=public/artifacts/game-v2-controlled-family,public/evidence/v2-proposals/games",
    "--allow-run=git,clang,wasm-ld",
    "scripts/build-game-family.ts",
    `--source-commit=${sourceCommit}`,
  ],
  locks: [lock],
  toolchain: [
    { name: "deno", version: Deno.version.deno },
    { name: "clang", version: clangVersion },
    { name: "wasm-ld", version: linkerVersion },
  ],
  flags: {
    compiler: [
      "--target=wasm32-unknown-unknown",
      "-O3",
      "-nostdlib",
      "-ffreestanding",
      "-fno-builtin",
    ],
    linker: [
      "--no-entry",
      "--export-memory",
      "--initial-memory=4194304",
      "--max-memory=4194304",
      "--stack-first",
    ],
    runtime: [
      "fixed initial=max linear memory",
      "integer-only controlled reducers",
      "JavaScript host copies input and decodes output only",
    ],
  },
  environment: [{ name: "GAME_EVIDENCE_STATUS", value: "proposal-validation-only" }],
};

const manifestSources = await Promise.all(sourcePaths.map((path) => ref(path)));
const buildManifest = {
  schemaVersion: 1,
  familyId: "game-v2-controlled-family",
  source: { repository, commit: sourceCommit },
  sourceTree: manifestSources,
  build,
  wasm: {
    ...wasmArtifact,
    bytes: wasm.length,
    mediaType: "application/wasm",
    fixedMemory: { initialPages: 64, maximumPages: 64, growth: false },
  },
  fixtures,
  manifests: {
    fixture: fixtureManifestReference,
    input: inputManifestReference,
    output: outputManifestReference,
  },
  performanceClaims: [],
};
await Deno.writeTextFile(
  new URL("build-manifest.json", artifactDir),
  `${JSON.stringify(buildManifest, null, 2)}\n`,
);

for (const id of GAME_IDS) {
  const entry = catalog.entries.find((item: { id: string }) => item.id === id);
  if (!entry) throw new Error(`${id} missing from catalog`);
  const slug = id.replaceAll(".", "-");
  const fixtureArtifact = await ref(`public/artifacts/game-v2-controlled-family/${slug}.bin`);
  const variants = [
    {
      id: "js-controlled",
      target: "javascript",
      artifact: await ref("benchmarks/v2/game-family/engine.js"),
      mediaType: "text/javascript",
    },
    {
      id: "wasm-linear-controlled",
      target: "wasm-linear",
      artifact: wasmArtifact,
      mediaType: "application/wasm",
    },
  ];
  for (const variant of variants) {
    const track = entry.tracks.find((item: { variants: Array<{ id: string }> }) =>
      item.variants.some((candidate) => candidate.id === variant.id)
    );
    const catalogVariant = track.variants.find((candidate: { id: string }) =>
      candidate.id === variant.id
    );
    if (catalogVariant.target !== variant.target) {
      throw new Error(`${id}/${variant.id} target mismatch`);
    }
    const artifactId = `${entry.benchmarkSlug}-${variant.id}`;
    const artifacts = [
      { id: artifactId, ...variant.artifact, mediaType: variant.mediaType },
      {
        id: `${entry.benchmarkSlug}-fixture`,
        ...fixtureArtifact,
        mediaType: "application/octet-stream",
      },
    ];
    const references = [
      workloadCatalog,
      workloadContract,
      resultContract,
      ...sourceReferences,
      generator,
      reference,
      oracle,
      fixtureManifestReference,
      inputManifestReference,
      outputManifestReference,
      recipe,
      lock,
      ...artifacts,
    ];
    const record = {
      schemaVersion: 1,
      contractId: "workload-result-v2-proposal-v1",
      status: "proposal-validation-only",
      workloadCatalog: { catalogId: catalog.catalogId, file: workloadCatalog },
      workloadContract: { contractId: catalog.workloadContract.contractId, file: workloadContract },
      resultContract: { contractId: catalog.resultContract.contractId, file: resultContract },
      source: { repository, commit: sourceCommit },
      workload: {
        entryId: id,
        benchmarkSlug: entry.benchmarkSlug,
        variant: {
          id: variant.id,
          target: variant.target,
          track: track.track,
          algorithmFamilyId: catalogVariant.algorithmFamilyId,
        },
      },
      provenance: {
        sources: sourceReferences,
        generator,
        reference,
        oracle,
        manifests: {
          fixture: fixtureManifestReference,
          input: inputManifestReference,
          output: outputManifestReference,
        },
        build,
        artifacts,
      },
      semanticCoverage: {
        inputParameterIds: entry.input.parameters.map((item: { name: string }) => item.name),
        oracleCheckIds: entry.oracle.checks.map((item: { id: string }) => item.id),
        workCounterIds: entry.work.counters,
        phaseIds: Object.keys(entry.phases),
        missingCellIds: entry.missingCells.map((item: { cell: string }) => item.cell),
      },
      collisionGuards: {
        workloadVariantKey: `${id}/${variant.id}`,
        algorithmIdentityKey: catalogVariant.algorithmFamilyId,
        resourcePaths: uniquePaths(references),
        artifactIds: artifacts.map(({ id }) => id),
      },
      correctness: {
        status: "passed",
        oracleCheckIds: entry.oracle.checks.map((item: { id: string }) => item.id),
        outputManifestSha256: outputManifestReference.sha256,
      },
      performanceClaims: [],
    };
    await Deno.writeTextFile(
      new URL(`${slug}-${variant.id}.json`, evidenceDir),
      `${JSON.stringify(record, null, 2)}\n`,
    );
  }
}
console.log(
  `build: ${wasm.length} byte full-game Wasm, exact source ${sourceCommit}, 6 closed records`,
);
