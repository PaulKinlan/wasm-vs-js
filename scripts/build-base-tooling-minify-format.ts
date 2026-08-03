import {
  CATALOG_SHA256,
  FIXTURE_BYTES,
  LANGUAGES,
  OPERATIONS,
  POLICY,
  TOTAL_BYTES,
} from "../benchmarks/base/tooling-minify-format/contract.ts";
import { generateAllFixtures } from "../benchmarks/base/tooling-minify-format/generator.ts";
import { transformJs } from "../benchmarks/base/tooling-minify-format/engine.ts";
import { instantiateToolingWasm } from "../benchmarks/base/tooling-minify-format/wasm.ts";

const root = new URL("../", import.meta.url);
const artifactDir = new URL("public/artifacts/base-tooling-minify-format/", root);
await Deno.mkdir(artifactDir, { recursive: true });
const wasmPath = new URL("tooling-minify-format.wasm", artifactDir);
const args = [
  "--target=wasm32",
  "-O3",
  "-nostdlib",
  "-Wl,--no-entry",
  "-Wl,--export-memory",
  "-Wl,--initial-memory=33554432",
  "-Wl,--max-memory=33554432",
  "-Wl,--strip-all",
  "-o",
  wasmPath.pathname,
  new URL("benchmarks/base/tooling-minify-format/tooling_minify_format.c", root).pathname,
];
const built = await new Deno.Command("clang", { args, stdout: "piped", stderr: "piped" }).output();
if (!built.success) throw new Error(new TextDecoder().decode(built.stderr));
await Deno.chmod(wasmPath, 0o644);
const bundle = await new Deno.Command("deno", {
  args: [
    "bundle",
    "--platform",
    "browser",
    "--format",
    "esm",
    "--no-remote",
    "--frozen",
    "benchmarks/base/tooling-minify-format/browser-entry.ts",
    "--output",
    "public/benchmarks/tooling-minify-format-v1/engine.js",
  ],
  stdout: "piped",
  stderr: "piped",
}).output();
if (!bundle.success) throw new Error(new TextDecoder().decode(bundle.stderr));
const bundledPath = new URL("public/benchmarks/tooling-minify-format-v1/engine.js", root);
const bundledText = (await Deno.readTextFile(bundledPath)).replace(/^var /gm, "const ").replace(
  "const TOTAL_BYTES =",
  "const _TOTAL_BYTES =",
);
await Deno.writeTextFile(bundledPath, bundledText);
const formatted = await new Deno.Command("deno", {
  args: [
    "fmt",
    "public/benchmarks/tooling-minify-format-v1/engine.js",
    "public/benchmarks/tooling-minify-format-v1/index.html",
  ],
  stdout: "piped",
  stderr: "piped",
}).output();
if (!formatted.success) throw new Error(new TextDecoder().decode(formatted.stderr));
async function hash(bytes: Uint8Array): Promise<string> {
  return Array.from(
    new Uint8Array(await crypto.subtle.digest("SHA-256", Uint8Array.from(bytes))),
    (b) => b.toString(16).padStart(2, "0"),
  ).join("");
}
async function file(path: string) {
  const bytes = await Deno.readFile(new URL(path, root));
  return { path, bytes: bytes.byteLength, sha256: await hash(bytes) };
}
function json(value: unknown): string {
  return JSON.stringify(value, null, 2) + "\n";
}
const fixtures = generateAllFixtures();
const fixtureRecords = [];
const outputRecords = [];
for (const language of LANGUAGES) {
  fixtureRecords.push({
    language,
    bytes: fixtures[language].byteLength,
    sha256: await hash(fixtures[language]),
  });
  for (const operation of OPERATIONS) {
    const result = transformJs(fixtures[language], language, operation);
    outputRecords.push({
      language,
      operation,
      bytes: result.output.byteLength,
      sha256: await hash(result.output),
      counters: result.counters,
    });
  }
}
const runWasm = await instantiateToolingWasm(await Deno.readFile(wasmPath));
for (const language of LANGUAGES) {
  for (const operation of OPERATIONS) {
    const js = transformJs(fixtures[language], language, operation);
    const wasm = runWasm(fixtures[language], language, operation);
    if (
      js.output.byteLength !== wasm.output.byteLength ||
      !js.output.every((b, i) => b === wasm.output[i])
    ) throw new Error(`${language}/${operation} JS/Wasm output mismatch`);
    if (
      js.counters.tokens !== wasm.counters.tokens || js.counters.nodes !== wasm.counters.nodes ||
      js.counters.transforms !== wasm.counters.transforms
    ) throw new Error(`${language}/${operation} counter mismatch`);
  }
}
const fixtureManifest = {
  schemaVersion: 1,
  baseWorkloadId: "tooling.minify-format.v1",
  generator: "owned-generated-three-language-v1",
  seed: 0,
  licenseSpdx: "CC0-1.0",
  redistribution: "project-generated",
  totalBytes: TOTAL_BYTES,
  fixtureBytes: FIXTURE_BYTES,
  policy: POLICY,
  fixtures: fixtureRecords,
};
await Deno.writeTextFile(new URL("fixture-manifest.json", artifactDir), json(fixtureManifest));
const sourcePaths = [
  "benchmarks/base/tooling-minify-format/contract.ts",
  "benchmarks/base/tooling-minify-format/generator.ts",
  "benchmarks/base/tooling-minify-format/engine.ts",
  "benchmarks/base/tooling-minify-format/wasm.ts",
  "benchmarks/base/tooling-minify-format/tooling_minify_format.c",
  "benchmarks/base/tooling-minify-format/browser-entry.ts",
  "public/benchmarks/tooling-minify-format-v1/index.html",
  "public/benchmarks/tooling-minify-format-v1/demo.js",
  "public/benchmarks/tooling-minify-format-v1/worker.js",
  "schemas/base-tooling-minify-format-validation.schema.json",
  "scripts/build-base-tooling-minify-format.ts",
  "server.ts",
  "deno.json",
  "deno.lock",
];
const manifest = {
  schemaVersion: 1,
  baseWorkloadId: "tooling.minify-format.v1",
  catalogV1Sha256: CATALOG_SHA256,
  catalogImmutable: true,
  toolchain: {
    deno: "2.9.0",
    clang: "22.1.8",
    target: "wasm32",
    command: `clang ${
      args.slice(0, -1).join(" ")
    } benchmarks/base/tooling-minify-format/tooling_minify_format.c`,
  },
  sources: await Promise.all(sourcePaths.map(file)),
  artifact: await file("public/artifacts/base-tooling-minify-format/tooling-minify-format.wasm"),
  fixtureManifest: await file("public/artifacts/base-tooling-minify-format/fixture-manifest.json"),
  outputs: outputRecords,
};
await Deno.writeTextFile(new URL("build-manifest.json", artifactDir), json(manifest));
const registration = {
  schemaVersion: 1,
  registrationId: "base-tooling-minify-format-controlled-v1",
  baseWorkloadId: "tooling.minify-format.v1",
  status: "implementation-candidate",
  authoritativePerformanceEvidence: false,
  frozenCatalog: { path: "catalog/workloads.v1.json", sha256: CATALOG_SHA256, mutation: "none" },
  fixedWork: {
    totalInputBytes: TOTAL_BYTES,
    languages: [...LANGUAGES],
    operations: [...OPERATIONS],
    sourceMaps: false,
  },
  equivalence: {
    class: "semantic-product-choice",
    controlledFamily: POLICY.version,
    rule:
      "Each target must pass its own canonical output and semantic round-trip; cross-product output identity is not generalized to unrelated tools.",
  },
  targets: ["javascript-controlled", "linear-wasm-controlled"],
  routes: {
    demo: "/benchmarks/tooling-minify-format-v1/",
    artifact: "/artifacts/base-tooling-minify-format/tooling-minify-format.wasm",
  },
  manifests: {
    fixture: "/artifacts/base-tooling-minify-format/fixture-manifest.json",
    build: "/artifacts/base-tooling-minify-format/build-manifest.json",
  },
};
await Deno.writeTextFile(
  new URL("catalog/base-implementations/tooling.minify-format.v1.json", root),
  json(registration),
);
const evidenceDir = new URL("public/evidence/base/tooling-minify-format/", root);
await Deno.mkdir(evidenceDir, { recursive: true });
for (const target of ["javascript-controlled", "linear-wasm-controlled"]) {
  const record = {
    schemaVersion: 1,
    recordId: `tooling-minify-format-${target}-validation-v1`,
    baseWorkloadId: "tooling.minify-format.v1",
    target,
    status: "validation-package",
    authoritativePerformanceEvidence: false,
    catalogV1Sha256: CATALOG_SHA256,
    fixtureManifestSha256: manifest.fixtureManifest.sha256,
    artifactSha256: target === "linear-wasm-controlled" ? manifest.artifact.sha256 : null,
    cells: outputRecords.map((cell) => ({
      language: cell.language,
      operation: cell.operation,
      inputBytes: FIXTURE_BYTES[cell.language as keyof typeof FIXTURE_BYTES],
      outputBytes: cell.bytes,
      outputSha256: cell.sha256,
      counters: {
        ...cell.counters,
        allocations: target === "linear-wasm-controlled" ? 0 : 2,
        boundaryCrossings: target === "linear-wasm-controlled" ? 1 : 0,
      },
    })),
  };
  await Deno.writeTextFile(new URL(`${target}.json`, evidenceDir), json(record));
}
console.log(
  `built ${manifest.artifact.sha256} with ${fixtureRecords.length} fixtures and ${outputRecords.length} canonical outputs`,
);
