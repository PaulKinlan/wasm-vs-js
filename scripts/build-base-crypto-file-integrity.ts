import { sha256Hex } from "../lib/canonical.ts";

const root = new URL("../", import.meta.url);
const sourceDir = new URL("benchmarks/base/crypto-file-integrity/", root);
const outputDir = new URL("public/artifacts/crypto-file-integrity/", root);
await Deno.mkdir(outputDir, { recursive: true });
const sourceRevision = Deno.env.get("SOURCE_REVISION") ?? "WORKTREE-CANDIDATE";
if (sourceRevision !== "WORKTREE-CANDIDATE" && !/^[a-f0-9]{40}$/.test(sourceRevision)) {
  throw new Error("SOURCE_REVISION must be a full Git commit");
}

const clang = new Deno.Command("clang", { args: ["--version"], stdout: "piped" });
const clangVersion = new TextDecoder().decode((await clang.output()).stdout).split("\n")[0];
if (clangVersion !== "clang version 22.1.8") throw new Error(`unexpected clang: ${clangVersion}`);
const sourcePath = new URL("sha256.c", sourceDir).pathname;
const wasmPath = new URL("crypto-file-integrity.wasm", outputDir).pathname;
const command = [
  "clang",
  "--target=wasm32-unknown-unknown",
  "-O3",
  "-nostdlib",
  "-Wl,--no-entry",
  "-Wl,--export-memory",
  "-Wl,--initial-memory=196608",
  "-Wl,--max-memory=285343744",
  "-Wl,--strip-all",
  "-o",
  wasmPath,
  sourcePath,
];
const result = await new Deno.Command(command[0], {
  args: command.slice(1),
  stdout: "inherit",
  stderr: "inherit",
}).output();
if (!result.success) throw new Error(`clang exited ${result.code}`);

const relativeSources = [
  "benchmarks/base/crypto-file-integrity/sha256.c",
  "benchmarks/base/crypto-file-integrity/sha256.js",
  "benchmarks/base/crypto-file-integrity/workload.js",
  "benchmarks/base/crypto-file-integrity/validation.js",
];
const sources = [];
for (const path of relativeSources) {
  sources.push({ path, sha256: await sha256Hex(await Deno.readFile(new URL(path, root))) });
}
const artifactBytes = await Deno.readFile(wasmPath);
const manifest = {
  schemaVersion: 1,
  workloadId: "crypto.file-integrity.v1",
  sourceRevision,
  toolchain: { deno: "2.9.0", clang: "22.1.8", lld: "22.1.8", target: "wasm32-unknown-unknown" },
  build: {
    command: command.join(" ").replaceAll(root.pathname, "./"),
    reproducible: true,
    optimization: "-O3",
    simd: false,
    threads: false,
    memory: { initialPages: 3, maximumPages: 4354, growth: "schedule-dependent" },
  },
  sources,
  artifact: {
    path: "public/artifacts/crypto-file-integrity/crypto-file-integrity.wasm",
    byteLength: artifactBytes.length,
    sha256: await sha256Hex(artifactBytes),
  },
};
await Deno.writeTextFile(
  new URL("build-manifest.json", outputDir),
  `${JSON.stringify(manifest, null, 2)}\n`,
);
console.log(JSON.stringify(manifest));
