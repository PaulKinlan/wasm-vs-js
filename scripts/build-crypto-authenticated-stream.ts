import { canonicalize, sha256Hex } from "../lib/canonical.ts";
import { runWorkload } from "../benchmarks/base/crypto-authenticated-stream/workload.js";

const root = new URL("../", import.meta.url);
const sourceDir = new URL("benchmarks/base/crypto-authenticated-stream/", root);
const outputDir = new URL("public/artifacts/crypto-authenticated-stream/", root);
const evidenceDir = new URL("public/evidence/base/crypto-authenticated-stream/", root);
await Deno.mkdir(outputDir, { recursive: true });
await Deno.mkdir(evidenceDir, { recursive: true });

async function command(name: string, args: string[]) {
  const output = await new Deno.Command(name, {
    args,
    cwd: root.pathname,
    stdout: "piped",
    stderr: "piped",
  }).output();
  if (!output.success) throw new Error(new TextDecoder().decode(output.stderr));
  return new TextDecoder().decode(output.stdout).trim();
}

async function commandBytes(name: string, args: string[]) {
  const output = await new Deno.Command(name, {
    args,
    cwd: root.pathname,
    stdout: "piped",
    stderr: "piped",
  }).output();
  if (!output.success) throw new Error(new TextDecoder().decode(output.stderr));
  return output.stdout;
}

const buildDir = new URL(".build/", outputDir).pathname;
await Deno.remove(buildDir, { recursive: true }).catch((error) => {
  if (!(error instanceof Deno.errors.NotFound)) throw error;
});
await Deno.mkdir(buildDir, { recursive: true });
try {
  await command("clang", [
    "--target=wasm32-unknown-unknown",
    "-O3",
    "-nostdlib",
    "-ffreestanding",
    "-fno-builtin",
    "-c",
    new URL("aead.c", sourceDir).pathname,
    "-o",
    `${buildDir}/aead.o`,
  ]);
  await command("wasm-ld", [
    "--no-entry",
    "--export-memory",
    "--export=seal",
    "--export=open",
    "--initial-memory=4194304",
    "--max-memory=4194304",
    "--stack-first",
    `${buildDir}/aead.o`,
    "-o",
    `${buildDir}/crypto-authenticated-stream.wasm`,
  ]);
  await Deno.copyFile(
    `${buildDir}/crypto-authenticated-stream.wasm`,
    new URL("crypto-authenticated-stream.wasm", outputDir),
  );
  await Deno.chmod(
    new URL("crypto-authenticated-stream.wasm", outputDir),
    0o644,
  );
} finally {
  await Deno.remove(buildDir, { recursive: true });
}

const sourceCommitPath = new URL("source-commit.txt", outputDir);
let sourceCommit = "working-tree-uncommitted";
try {
  sourceCommit = (await Deno.readTextFile(sourceCommitPath)).trim();
} catch (error) {
  if (!(error instanceof Deno.errors.NotFound)) throw error;
}
if (sourceCommit !== "working-tree-uncommitted" && !/^[a-f0-9]{40}$/.test(sourceCommit)) {
  throw new Error("invalid source-commit.txt");
}
const sourcePaths = [
  "benchmarks/base/crypto-authenticated-stream/aead.c",
  "benchmarks/base/crypto-authenticated-stream/engine.js",
  "benchmarks/base/crypto-authenticated-stream/workload.js",
  "benchmarks/base/crypto-authenticated-stream/registration.v1.json",
  "scripts/build-crypto-authenticated-stream.ts",
  "scripts/fetch-rfc8439-vector-source.ts",
  "deno.json",
  "deno.lock",
];
const sources = await Promise.all(sourcePaths.map(async (path) => {
  const bytes = sourceCommit !== "working-tree-uncommitted"
    ? await commandBytes("git", ["show", `${sourceCommit}:${path}`])
    : await Deno.readFile(new URL(path, root));
  return { path, bytes: bytes.length, sha256: await sha256Hex(bytes) };
}));
const wasm = await Deno.readFile(new URL("crypto-authenticated-stream.wasm", outputDir));
const js = await runWorkload("js-controlled", wasm);
const linearWasm = await runWorkload("wasm-linear-controlled", wasm);
if (
  js.cipherTranscriptSha256 !== linearWasm.cipherTranscriptSha256 ||
  js.plaintextTranscriptSha256 !== linearWasm.plaintextTranscriptSha256
) {
  throw new Error("complete JavaScript/Wasm transcript mismatch");
}
const fixtureManifest = {
  schemaVersion: 1,
  workloadId: "crypto.authenticated-stream.v1",
  generated: true,
  redistributedExternalBytes: false,
  frameCount: 10000,
  sizes: [0, 1, 15, 16, 17, 31, 32, 63, 64, 65, 127, 128, 255, 256, 511, 1024],
  generator: sources.find(({ path }) => path.endsWith("workload.js")),
  rights: { licenseSpdx: "CC0-1.0", redistribution: "permitted" },
  standardsVectorRecipe: {
    bundled: false,
    url: "https://www.rfc-editor.org/rfc/rfc8439.txt",
    sha256: "25bef70fbf7a07ff45c2fe4cb7c6ce954eac687413d8610603268b4e4415324c",
    command:
      "deno run --allow-net=www.rfc-editor.org --allow-write=<private-path> scripts/fetch-rfc8439-vector-source.ts <private-path>",
  },
};
const outputManifest = {
  schemaVersion: 1,
  workloadId: "crypto.authenticated-stream.v1",
  equivalence: "byte-identical complete ciphertext/tag and recovered-plaintext transcript hashes",
  oracle: {
    cipherTranscriptSha256: js.cipherTranscriptSha256,
    plaintextTranscriptSha256: js.plaintextTranscriptSha256,
  },
  variants: { "js-controlled": js, "wasm-linear-controlled": linearWasm },
  performanceClaims: [],
};
await Deno.writeTextFile(
  new URL("fixture-manifest.json", outputDir),
  `${canonicalize(fixtureManifest)}\n`,
);
await Deno.writeTextFile(
  new URL("output-manifest.json", outputDir),
  `${canonicalize(outputManifest)}\n`,
);
const subordinate = await Promise.all(
  ["fixture-manifest.json", "output-manifest.json"].map(async (path) => ({
    path: `public/artifacts/crypto-authenticated-stream/${path}`,
    sha256: await sha256Hex(await Deno.readFile(new URL(path, outputDir))),
  })),
);
const clangVersion = (await command("clang", ["--version"])).split("\n")[0];
const linkerVersion = await command("wasm-ld", ["--version"]);
const buildManifest = {
  schemaVersion: 1,
  workloadId: "crypto.authenticated-stream.v1",
  sourceCommit,
  sourceRepository: "https://github.com/PaulKinlan/wasm-vs-js",
  sources,
  artifact: {
    path: "public/artifacts/crypto-authenticated-stream/crypto-authenticated-stream.wasm",
    bytes: wasm.length,
    sha256: await sha256Hex(wasm),
    memory: { initialBytes: 4194304, maximumBytes: 4194304, growth: false },
    exports: ["memory", "seal", "open"],
  },
  manifests: subordinate,
  toolchain: {
    deno: Deno.version.deno,
    clang: clangVersion,
    linker: linkerVersion,
    command:
      "clang --target=wasm32-unknown-unknown -O3 -nostdlib -ffreestanding -fno-builtin -c aead.c; wasm-ld --no-entry --export-memory --export=seal --export=open --initial-memory=4194304 --max-memory=4194304 --stack-first",
  },
  features: { simd: false, threads: false, exceptions: false, memoryGrowth: false },
};
await Deno.writeTextFile(
  new URL("build-manifest.json", outputDir),
  `${canonicalize(buildManifest)}\n`,
);
const buildManifestSha256 = await sha256Hex(
  await Deno.readFile(new URL("build-manifest.json", outputDir)),
);
for (const result of [js, linearWasm]) {
  const record = {
    schemaVersion: 1,
    status: "implementation-validation",
    workloadId: "crypto.authenticated-stream.v1",
    variantId: result.variant,
    sourceCommit,
    buildManifest: {
      path: "public/artifacts/crypto-authenticated-stream/build-manifest.json",
      sha256: buildManifestSha256,
    },
    result,
    retainedEvidence:
      "static-and-test evidence only; owned browser evidence is required before acceptance",
    performanceClaims: [],
  };
  await Deno.writeTextFile(
    new URL(`${result.variant}.json`, evidenceDir),
    `${JSON.stringify(record, null, 2)}\n`,
  );
}
console.log(
  `build: crypto.authenticated-stream.v1 ${wasm.length} bytes; exact 10000-frame transcripts match`,
);
