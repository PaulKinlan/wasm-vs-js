import { sha256Hex } from "../lib/canonical.ts";
import { fixtureParameters, generateDirtyStl } from "../benchmarks/base/cad-mesh-repair/fixture.js";
import {
  instantiateMeshWasm,
  quantizeMeshCoordinate,
  repairMeshJavaScript,
  repairMeshWasm,
} from "../benchmarks/base/cad-mesh-repair/engine.js";

const root = new URL("../", import.meta.url);
const out = new URL("public/artifacts/cad-mesh-repair-v1/", root);
const sourceCommit = Deno.args.find((argument) => argument.startsWith("--source-commit="))?.slice(
  16,
);
if (!sourceCommit || !/^[a-f0-9]{40}$/.test(sourceCommit)) {
  throw new Error("--source-commit must be an exact 40-character Git commit");
}
await Deno.mkdir(out, { recursive: true });

async function cmd(name: string, args: string[]) {
  const result = await new Deno.Command(name, {
    args,
    cwd: root.pathname,
    stdout: "piped",
    stderr: "piped",
  }).output();
  if (!result.success) throw new Error(new TextDecoder().decode(result.stderr));
  return new TextDecoder().decode(result.stdout).trim();
}

const sourceNodes = [
  ["benchmarks/base/cad-mesh-repair/fixture.js", "fixture-generator"],
  ["benchmarks/base/cad-mesh-repair/engine.js", "javascript-target-and-wasm-adapter"],
  ["benchmarks/base/cad-mesh-repair/mesh-repair.c", "authored-wasm-target"],
  ["benchmarks/base/cad-mesh-repair/implementation-contract.v1.json", "contract"],
  ["schemas/cad-mesh-repair-contract.schema.json", "contract-schema"],
  ["schemas/cad-mesh-repair-build-manifest.schema.json", "build-schema"],
  ["schemas/cad-mesh-repair-evidence.schema.json", "evidence-schema"],
  ["scripts/build-cad-mesh-repair.ts", "build-recipe"],
  ["deno.json", "task-and-toolchain-configuration"],
  ["deno.lock", "dependency-lock"],
] as const;
const sources = [];
for (const [path, role] of sourceNodes) {
  const local = await Deno.readFile(new URL(path, root));
  const committed = await new Deno.Command("git", {
    args: ["show", `${sourceCommit}:${path}`],
    cwd: root.pathname,
    stdout: "piped",
    stderr: "piped",
  }).output();
  if (!committed.success || await sha256Hex(committed.stdout) !== await sha256Hex(local)) {
    throw new Error(`${path} does not match source commit ${sourceCommit}`);
  }
  sources.push({ path, role, bytes: local.length, sha256: await sha256Hex(local) });
}

const object = new URL("mesh-repair.o", out).pathname;
const temporaryWasmPath = new URL(".mesh-repair.build.wasm", out).pathname;
const wasmUrl = new URL("mesh-repair.wasm", out);
await cmd("clang", [
  "--target=wasm32-unknown-unknown",
  "-O3",
  "-nostdlib",
  "-ffreestanding",
  "-fno-builtin",
  "-fno-fast-math",
  "-c",
  "benchmarks/base/cad-mesh-repair/mesh-repair.c",
  "-o",
  object,
]);
await cmd("wasm-ld", [
  "--no-entry",
  "--export-memory",
  "--export=input_ptr",
  "--export=output_ptr",
  "--export=run",
  "--initial-memory=1048576",
  "--max-memory=1048576",
  "--stack-first",
  object,
  "-o",
  temporaryWasmPath,
]);
await Deno.remove(object);
const fixture = generateDirtyStl();
await Deno.writeFile(new URL("dirty-grid.stl", out), fixture);
const wasm = await Deno.readFile(temporaryWasmPath);
await Deno.remove(temporaryWasmPath);
await Deno.writeFile(wasmUrl, wasm);
const js = repairMeshJavaScript(fixture);
const runtime = await instantiateMeshWasm(wasm);
const wr = repairMeshWasm(runtime, fixture);
if (await sha256Hex(js.bytes) !== await sha256Hex(wr.bytes)) {
  throw new Error("complete JS/Wasm output mismatch");
}
const contractBytes = await Deno.readFile(
  new URL("benchmarks/base/cad-mesh-repair/implementation-contract.v1.json", root),
);
const buildSchemaBytes = await Deno.readFile(
  new URL("schemas/cad-mesh-repair-build-manifest.schema.json", root),
);
const contractSchemaBytes = await Deno.readFile(
  new URL("schemas/cad-mesh-repair-contract.schema.json", root),
);
const evidenceSchemaBytes = await Deno.readFile(
  new URL("schemas/cad-mesh-repair-evidence.schema.json", root),
);
const sourceRepository = "https://github.com/PaulKinlan/wasm-vs-js";
const buildCommand =
  `deno run --allow-read=. --allow-write=public/artifacts --allow-run=clang,wasm-ld,git scripts/build-cad-mesh-repair.ts --source-commit=${sourceCommit}`;
const manifest = {
  schemaVersion: 1,
  catalogId: "cad.mesh-repair.v1",
  status: "supplemental-validation-package",
  source: {
    repository: sourceRepository,
    commit: sourceCommit,
    commitUrl: `${sourceRepository}/commit/${sourceCommit}`,
  },
  sourceGraph: {
    nodes: sources,
    edges: [
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
        from: "benchmarks/base/cad-mesh-repair/implementation-contract.v1.json",
        to: "schemas/cad-mesh-repair-contract.schema.json",
        relation: "validated-by",
      },
    ],
  },
  frozenCatalog: {
    path: "catalog/workloads.v1.json",
    sha256: "6665664f984683e5b7d3fdc8c1602198124844704c224a526d48be2f02edf9d4",
    immutability: "byte-for-byte",
  },
  fixture: {
    path: "public/artifacts/cad-mesh-repair-v1/dirty-grid.stl",
    bytes: fixture.length,
    sha256: await sha256Hex(fixture),
    parameters: fixtureParameters,
    rights: {
      license: "CC0-1.0",
      redistribution: "permitted",
      origin: "generated solely by fixture.js",
    },
  },
  artifact: {
    path: "public/artifacts/cad-mesh-repair-v1/mesh-repair.wasm",
    bytes: wasm.length,
    sha256: await sha256Hex(wasm),
    memory: { initialPages: 16, maximumPages: 16 },
  },
  contract: {
    path: "benchmarks/base/cad-mesh-repair/implementation-contract.v1.json",
    bytes: contractBytes.length,
    sha256: await sha256Hex(contractBytes),
    schema: {
      path: "schemas/cad-mesh-repair-contract.schema.json",
      sha256: await sha256Hex(contractSchemaBytes),
    },
  },
  evidence: {
    path: "public/artifacts/cad-mesh-repair-v1/validation-evidence.json",
    schema: {
      path: "schemas/cad-mesh-repair-evidence.schema.json",
      sha256: await sha256Hex(evidenceSchemaBytes),
    },
  },
  build: {
    deno: "2.9.0",
    clang: await cmd("clang", ["--version"]).then((value) => value.split("\n")[0]),
    linker: await cmd("wasm-ld", ["--version"]),
    command: buildCommand,
    flags: [
      "--target=wasm32-unknown-unknown",
      "-O3",
      "-nostdlib",
      "-ffreestanding",
      "-fno-builtin",
      "-fno-fast-math",
      "fixed memory 16 pages",
    ],
    schema: {
      path: "schemas/cad-mesh-repair-build-manifest.schema.json",
      sha256: await sha256Hex(buildSchemaBytes),
    },
  },
  performanceClaims: [],
};
const manifestText = `${JSON.stringify(manifest, null, 2)}\n`;
await Deno.writeTextFile(new URL("build-manifest.json", out), manifestText);
const evidence = {
  schemaVersion: 1,
  evidenceId: "cad-mesh-repair-v1-correctness",
  status: "proposal-validation-only",
  buildManifest: {
    path: "public/artifacts/cad-mesh-repair-v1/build-manifest.json",
    sha256: await sha256Hex(new TextEncoder().encode(manifestText)),
  },
  contract: {
    path: "benchmarks/base/cad-mesh-repair/implementation-contract.v1.json",
    sha256: await sha256Hex(contractBytes),
  },
  fixture: {
    path: "public/artifacts/cad-mesh-repair-v1/dirty-grid.stl",
    sha256: await sha256Hex(fixture),
  },
  artifact: {
    path: "public/artifacts/cad-mesh-repair-v1/mesh-repair.wasm",
    sha256: await sha256Hex(wasm),
  },
  oracle: {
    completeOutputSha256: await sha256Hex(js.bytes),
    bytes: js.bytes.length,
    invariants: js.invariants,
    jsCounters: js.counters,
    wasmCounters: wr.counters,
    equivalentCounterNames:
      JSON.parse(new TextDecoder().decode(contractBytes)).work.equivalentCounters,
    crossTargetCompleteBytesEqual: true,
    negativeHalfAdversarial: {
      storedF32: Math.fround(-0.00004999999873689376),
      quantizedI32: quantizeMeshCoordinate(-0.00004999999873689376),
      expectedI32: -1,
    },
  },
  performanceClaims: [],
};
await Deno.writeTextFile(
  new URL("validation-evidence.json", out),
  `${JSON.stringify(evidence, null, 2)}\n`,
);
console.log(
  `cad mesh: ${fixture.length} input bytes, ${wasm.length} Wasm bytes, ${js.bytes.length} output bytes, ${evidence.oracle.completeOutputSha256}`,
);
