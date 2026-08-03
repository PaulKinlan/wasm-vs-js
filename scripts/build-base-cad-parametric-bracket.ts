import { sha256Hex } from "../lib/canonical.ts";
import { generateFixture } from "../benchmarks/base/cad-parametric-bracket/fixture.js";
import {
  assertEquivalent,
  instantiateBracketWasm,
  runJavaScript,
  runWasm,
} from "../benchmarks/base/cad-parametric-bracket/engine.js";

if (Deno.version.deno !== "2.9.0") {
  throw new Error(`Deno 2.9.0 required, found ${Deno.version.deno}`);
}
const root = new URL("../", import.meta.url);
const artifactDir = new URL("public/artifacts/base-cad-parametric-bracket/", root);
const evidenceDir = new URL("public/evidence/base-catalog/cad-parametric-bracket/", root);
await Deno.mkdir(artifactDir, { recursive: true });
await Deno.mkdir(evidenceDir, { recursive: true });
async function command(name: string, args: string[]) {
  const result = await new Deno.Command(name, {
    args,
    cwd: root.pathname,
    stdout: "piped",
    stderr: "piped",
  }).output();
  if (!result.success) throw new Error(new TextDecoder().decode(result.stderr));
  return result.stdout;
}
const buildDir = new URL(".build/", artifactDir);
await Deno.remove(buildDir, { recursive: true }).catch(() => {});
await Deno.mkdir(buildDir, { recursive: true });
try {
  await command("clang", [
    "--target=wasm32-unknown-unknown",
    "-O3",
    "-nostdlib",
    "-ffreestanding",
    "-fno-builtin",
    "-ffp-contract=off",
    "-c",
    "benchmarks/base/cad-parametric-bracket/bracket.c",
    "-o",
    `${buildDir.pathname}bracket.o`,
  ]);
  await command("wasm-ld", [
    "--no-entry",
    "--export-memory",
    "--export=input_ptr",
    "--export=output_ptr",
    "--export=run",
    "--initial-memory=8388608",
    "--max-memory=8388608",
    "--stack-first",
    `${buildDir.pathname}bracket.o`,
    "-o",
    `${buildDir.pathname}bracket.wasm`,
  ]);
  await Deno.writeFile(
    new URL("bracket.wasm", artifactDir),
    await Deno.readFile(`${buildDir.pathname}bracket.wasm`),
  );
} finally {
  await Deno.remove(buildDir, { recursive: true });
}
const fixture = generateFixture();
await Deno.writeFile(new URL("fixture.bin", artifactDir), fixture);
const js = runJavaScript(fixture);
await Deno.writeFile(new URL("reference-output.bin", artifactDir), js.output);
const wasmBytes = await Deno.readFile(new URL("bracket.wasm", artifactDir));
const wasm = runWasm(await instantiateBracketWasm(wasmBytes), fixture);
const equivalence = assertEquivalent(js, wasm);
async function ref(path: string) {
  const bytes = await Deno.readFile(new URL(path, root));
  return { path, bytes: bytes.byteLength, sha256: await sha256Hex(bytes) };
}
const sourcePaths = [
  "benchmarks/base/cad-parametric-bracket/contract.js",
  "benchmarks/base/cad-parametric-bracket/fixture.js",
  "benchmarks/base/cad-parametric-bracket/engine.js",
  "benchmarks/base/cad-parametric-bracket/bracket.c",
  "catalog/base-implementations.v1/cad.parametric-bracket.v1.json",
  "schemas/cad-parametric-bracket-validation.schema.json",
  "scripts/build-base-cad-parametric-bracket.ts",
  "public/demos/cad-parametric-bracket/index.html",
  "public/demos/cad-parametric-bracket/demo.js",
  "public/demos/cad-parametric-bracket/worker.js",
  "tests/base/cad-parametric-bracket.test.ts",
  "server.ts",
  "deno.json",
  "deno.lock",
];
const sourceFiles = await Promise.all(sourcePaths.map(ref));
const sourceBundleParts: string[] = [];
for (const file of sourceFiles) {
  const content = await Deno.readTextFile(new URL(file.path, root));
  sourceBundleParts.push(
    `===== BEGIN ${file.path} sha256=${file.sha256} =====\n${content}${
      content.endsWith("\n") ? "" : "\n"
    }===== END ${file.path} =====\n`,
  );
}
const sourceBundle = new TextEncoder().encode(sourceBundleParts.join(""));
const sourceCommit = Deno.args.find((arg) => arg.startsWith("--source-commit="))?.slice(16) ??
  "source-tree-not-yet-committed";
if (sourceCommit !== "source-tree-not-yet-committed" && !/^[a-f0-9]{40}$/.test(sourceCommit)) {
  throw new Error("invalid --source-commit");
}
if (/^[a-f0-9]{40}$/.test(sourceCommit)) {
  for (const file of sourceFiles) {
    const committed = await command("git", ["show", `${sourceCommit}:${file.path}`]);
    if (await sha256Hex(committed) !== file.sha256) {
      throw new Error(`source commit mismatch: ${file.path}`);
    }
  }
}
await Deno.writeFile(new URL("source-bundle.txt", artifactDir), sourceBundle);
const sourceBundleRef = await ref(
  "public/artifacts/base-cad-parametric-bracket/source-bundle.txt",
);
const fixtureRef = await ref("public/artifacts/base-cad-parametric-bracket/fixture.bin");
const wasmRef = await ref("public/artifacts/base-cad-parametric-bracket/bracket.wasm");
const outputRef = await ref("public/artifacts/base-cad-parametric-bracket/reference-output.bin");
const jsRef = await ref("benchmarks/base/cad-parametric-bracket/engine.js");
const completeOutputSha256 = await sha256Hex(js.output);
await Deno.writeTextFile(
  new URL("fixture-manifest.json", artifactDir),
  `${
    JSON.stringify(
      {
        schemaVersion: 1,
        workloadId: "cad.parametric-bracket.v1",
        immutable: true,
        generator: {
          path: "benchmarks/base/cad-parametric-bracket/fixture.js",
          featureTree:
            "box + two through cylinders + ordered cuts + four r5 fillets + tessellation",
        },
        rights: {
          license: "CC0-1.0",
          redistribution: "permitted",
          provenance:
            "Project-generated dimensions and feature tree; no external geometry or user data.",
        },
        fixture: fixtureRef,
      },
      null,
      2,
    )
  }\n`,
);
const clang = new TextDecoder().decode(await command("clang", ["--version"])).split("\n")[0];
const linker = new TextDecoder().decode(await command("wasm-ld", ["--version"])).trim();
await Deno.writeTextFile(
  new URL("build-manifest.json", artifactDir),
  `${
    JSON.stringify(
      {
        schemaVersion: 1,
        workloadId: "cad.parametric-bracket.v1",
        source: {
          repository: "https://github.com/PaulKinlan/wasm-vs-js",
          commit: sourceCommit,
          sourceBundle: sourceBundleRef,
          sourceBundleSha256: await sha256Hex(sourceBundle),
          files: sourceFiles,
        },
        build: {
          command:
            "deno run --allow-read=. --allow-write=public/artifacts/base-cad-parametric-bracket,public/evidence/base-catalog/cad-parametric-bracket --allow-run=git,clang,wasm-ld scripts/build-base-cad-parametric-bracket.ts --source-commit=<commit>",
          toolchain: { deno: Deno.version.deno, clang, linker },
          compilerFlags: [
            "--target=wasm32-unknown-unknown",
            "-O3",
            "-nostdlib",
            "-ffreestanding",
            "-fno-builtin",
            "-ffp-contract=off",
          ],
          linkerFlags: [
            "--no-entry",
            "--export-memory",
            "--initial-memory=8388608",
            "--max-memory=8388608",
            "--stack-first",
          ],
          features: {
            simd: false,
            threads: false,
            exceptions: false,
            tailCalls: false,
            memoryGrowth: false,
          },
          fixedMemory: { initialPages: 128, maximumPages: 128 },
        },
        artifacts: { fixture: fixtureRef, wasm: wasmRef, referenceOutput: outputRef },
        performanceClaims: [],
      },
      null,
      2,
    )
  }\n`,
);
await Deno.writeTextFile(
  new URL("output-manifest.json", artifactDir),
  `${
    JSON.stringify(
      {
        schemaVersion: 1,
        workloadId: "cad.parametric-bracket.v1",
        completeOutputSha256,
        completeOutputDigest: js.completeOutputDigest,
        exactCrossTargetBytes: equivalence.exactBytes,
        topology: js.topology,
        triangleCount: js.triangleCount,
        counters: js.counters,
        performanceClaims: [],
      },
      null,
      2,
    )
  }\n`,
);
for (
  const [variantId, executionTarget, artifact, result] of [
    ["js-controlled", "javascript", jsRef, js],
    ["wasm-linear-controlled", "wasm-linear", wasmRef, wasm],
  ] as const
) {
  await Deno.writeTextFile(
    new URL(`${variantId}.json`, evidenceDir),
    `${
      JSON.stringify(
        {
          schemaVersion: 1,
          catalogId: "workload-catalog-v1",
          workloadId: "cad.parametric-bracket.v1",
          status: "implementation-candidate",
          variantId,
          executionTarget,
          sourceCommit,
          source: sourceBundleRef,
          fixture: fixtureRef,
          artifact,
          oracle: {
            completeOutputSha256: await sha256Hex(result.output),
            completeOutputDigest: result.completeOutputDigest,
            exactCrossTargetBytes: true,
            topology: result.topology,
            triangleCount: result.triangleCount,
          },
          counters: result.counters,
          performanceClaims: [],
        },
        null,
        2,
      )
    }\n`,
  );
}
console.log(
  `built cad.parametric-bracket.v1: ${completeOutputSha256}, ${js.triangleCount} triangles`,
);
