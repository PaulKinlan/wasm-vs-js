// scripts/build-all-wasm.ts
//
// Master inspector, verifier, and build orchestrator for all 50 benchmark tests
// and all 300 committed WebAssembly (.wasm) binaries in the repository.
//
// Usage:
//   deno run --allow-read scripts/build-all-wasm.ts --list
//   deno run --allow-read scripts/build-all-wasm.ts --verify
//   deno run --allow-all scripts/build-all-wasm.ts --lane baseline
//   deno run --allow-all scripts/build-all-wasm.ts --lane wat-multilang
//   deno run --allow-all scripts/build-all-wasm.ts --lane multilang-compilers [--with-dart] [--force]
//   deno run --allow-all scripts/build-all-wasm.ts --lane dom-inline-c
//   deno run --allow-all scripts/build-all-wasm.ts --only <slug-or-id> [--include-multilang]

import {
  BENCHMARK_BUILD_SPECS,
  type BenchmarkBuildSpec,
  DOM_INLINE_C_BUILDS,
  findBuildSpec,
  toServedUrl,
  TRACK_B_STANDALONE_BUILDS,
  WASM_BUILD_LANES,
} from "./wasm-build-registry.ts";

export interface WasmInventoryVerification {
  ok: boolean;
  specCount: number;
  wasmFilesFound: number;
  accountedWasmFiles: number;
  missingPaths: string[];
  unaccountedWasmFiles: string[];
}

const AUXILIARY_ACCOUNTED_WASM = new Map<string, string>([
  [
    "public/artifacts/numeric-polybench-panel/reference-oracle.wasm",
    "scripts/build-base-polybench.ts (C reference oracle module)",
  ],
  [
    "public/artifacts/base-gltf-viewer/draco_decoder_gltf.wasm",
    "Pinned Draco glTF mesh decoder (vendored upstream binary)",
  ],
  [
    "benchmarks/image-editing/artifacts/image-editing.wasm",
    "scripts/build-image-editing.ts (intermediate WAT build output)",
  ],
]);

async function exists(path: string): Promise<boolean> {
  try {
    await Deno.stat(path);
    return true;
  } catch {
    return false;
  }
}

async function collectWasmFiles(dir: string, out: string[]): Promise<void> {
  if (!(await exists(dir))) return;
  for await (const entry of Deno.readDir(dir)) {
    const full = `${dir}/${entry.name}`;
    if (entry.isDirectory) {
      if (entry.name === "node_modules" || entry.name === ".gradle" || entry.name === "build") {
        continue;
      }
      await collectWasmFiles(full, out);
    } else if (entry.isFile && entry.name.endsWith(".wasm")) {
      out.push(full);
    }
  }
}

export async function verifyWasmInventory(): Promise<WasmInventoryVerification> {
  const missingPaths: string[] = [];
  const check = async (label: string, path: string) => {
    if (!(await exists(path))) {
      missingPaths.push(`${label}: ${path}`);
    }
  };

  const accounted = new Map<string, string>();
  for (const [k, v] of AUXILIARY_ACCOUNTED_WASM) {
    accounted.set(k, v);
  }

  for (const spec of BENCHMARK_BUILD_SPECS) {
    await check(`${spec.slug}.routeHtml`, `public${spec.route}index.html`);
    await check(`${spec.slug}.jsSource`, spec.jsSource);
    await check(`${spec.slug}.wasmSource`, spec.wasmSource);
    await check(`${spec.slug}.wasmArtifact`, spec.wasmArtifact);
    await check(`${spec.slug}.buildScript`, spec.buildScript);
    if (spec.manifest) {
      await check(`${spec.slug}.manifest`, `public${spec.manifest}`);
    }
    for (const testPath of spec.oracleTests) {
      await check(`${spec.slug}.oracleTest`, testPath);
    }
    accounted.set(spec.wasmArtifact, `${spec.buildScript} (${spec.id})`);
  }

  for (const domBuild of DOM_INLINE_C_BUILDS) {
    await check(`${domBuild.slug}.domCSource`, domBuild.source);
    await check(`${domBuild.slug}.domWasmArtifact`, domBuild.artifact);
    accounted.set(domBuild.artifact, `DOM_INLINE_C_BUILDS (${domBuild.slug})`);
  }

  for (const tb of TRACK_B_STANDALONE_BUILDS) {
    await check(`${tb.key}.trackBSource`, tb.source);
    await check(`${tb.key}.trackBArtifact`, tb.artifact);
    accounted.set(tb.artifact, `TRACK_B_STANDALONE_BUILDS (${tb.key})`);
  }

  // Account for every multi-language, handwritten WAT, and Track B .wasm under
  // public/artifacts/multilang-wasm-benchmark/ via manifests, provenance, WAT generator, or Track B builders.
  const provenanceRaw = JSON.parse(
    await Deno.readTextFile(
      "public/artifacts/multilang-wasm-benchmark/kernel-build-provenance.v1.json",
    ),
  );
  for (const k of provenanceRaw.kernels ?? []) {
    if (typeof k.artifact === "string" && k.artifact.length > 0) {
      accounted.set(
        `public/artifacts/multilang-wasm-benchmark/${k.artifact}`,
        `kernel-build-provenance (${k.manifest}:${k.engineKey})`,
      );
    }
  }

  const manifestDir = "public/benchmarks/multilang-wasm";
  for await (const entry of Deno.readDir(manifestDir)) {
    if (!entry.isFile || !entry.name.endsWith(".manifest.json")) continue;
    const m = JSON.parse(await Deno.readTextFile(`${manifestDir}/${entry.name}`));
    const rawBase = typeof m.artifactsBase === "string"
      ? `public${m.artifactsBase}`
      : "public/artifacts/multilang-wasm-benchmark";
    const base = rawBase.endsWith("/") ? rawBase : `${rawBase}/`;
    for (const eng of m.engines ?? []) {
      if (typeof eng.url === "string" && eng.url.endsWith(".wasm")) {
        const uPath = eng.url.startsWith("/artifacts/v2/") ? eng.url.slice(1) : `public${eng.url}`;
        accounted.set(uPath, `manifest ${entry.name} (${eng.key})`);
      }
      for (const field of [eng.wasm, eng.file, eng.files]) {
        if (typeof field === "string") {
          const wPath = field.startsWith("/") ? `public${field}` : `${base}${field}`;
          accounted.set(wPath, `manifest ${entry.name} (${eng.key})`);
        } else if (field && typeof field === "object") {
          for (const wasmFile of Object.values(field)) {
            if (typeof wasmFile === "string") {
              const wPath = wasmFile.startsWith("/") ? `public${wasmFile}` : `${base}${wasmFile}`;
              accounted.set(wPath, `manifest ${entry.name} (${eng.key})`);
            }
          }
        }
      }
      if (typeof eng.source === "string" && eng.source.length > 0) {
        const clean = eng.source.replace(/^\//, "");
        if (!(await exists(clean)) && !(await exists(`public/${clean}`))) {
          missingPaths.push(`manifest:${entry.name}:${eng.key}.source: ${eng.source}`);
        }
      }
    }
  }

  const watGenSrc = await Deno.readTextFile("scripts/generate-all-wat-kernels.ts");
  for (const match of watGenSrc.matchAll(/([a-z0-9_]+_wat\.wasm)/g)) {
    accounted.set(
      `public/artifacts/multilang-wasm-benchmark/${match[1]}`,
      "scripts/generate-all-wat-kernels.ts",
    );
  }

  for (
    const optScript of [
      "scripts/build-multilang-asc-opt.ts",
      "scripts/build-multilang-dart-opt.ts",
      "scripts/build-multilang-dart-gc-document.ts",
      "scripts/build-multilang-wasm-benchmark.ts",
    ]
  ) {
    if (!(await exists(optScript))) continue;
    const src = await Deno.readTextFile(optScript);
    for (const match of src.matchAll(/([a-z0-9_]+\.wasm)/g)) {
      const candidate = `public/artifacts/multilang-wasm-benchmark/${match[1]}`;
      if (!accounted.has(candidate)) {
        accounted.set(candidate, optScript);
      }
    }
  }

  // Account for isolated Track B Auto-Research SIMD128 binaries (public/artifacts/autoresearch/).
  if (await exists("public/data/autoresearch-log.v1.json")) {
    const autoLog = JSON.parse(await Deno.readTextFile("public/data/autoresearch-log.v1.json"));
    for (const w of autoLog.workloads ?? []) {
      const art = w.simdArtifact?.artifact;
      if (typeof art === "string" && art.length > 0) {
        await check(`autoresearch:${w.manifestSlug}`, art);
        accounted.set(art, `scripts/run-autoresearch.ts (${w.manifestSlug})`);
      }
    }
  }

  const wasmFiles: string[] = [];
  await collectWasmFiles("public/artifacts", wasmFiles);
  await collectWasmFiles("artifacts/v2", wasmFiles);
  await collectWasmFiles("benchmarks", wasmFiles);
  wasmFiles.sort();

  const unaccountedWasmFiles = wasmFiles.filter((f) => !accounted.has(f));

  return {
    ok: missingPaths.length === 0 && unaccountedWasmFiles.length === 0,
    specCount: BENCHMARK_BUILD_SPECS.length,
    wasmFilesFound: wasmFiles.length,
    accountedWasmFiles: wasmFiles.length - unaccountedWasmFiles.length,
    missingPaths,
    unaccountedWasmFiles,
  };
}

function buildEnv(): Record<string, string> {
  const env = Deno.env.toObject();
  const extra = env.WASM_VS_JS_TOOL_PATH;
  if (extra) {
    env.PATH = `${extra}:${env.PATH ?? ""}`;
  }
  return env;
}

async function runShell(command: string): Promise<void> {
  console.log(`$ ${command}`);
  const status = await new Deno.Command("bash", {
    args: ["-euo", "pipefail", "-c", command],
    env: buildEnv(),
    stdout: "inherit",
    stderr: "inherit",
  }).spawn().status;
  if (!status.success) {
    throw new Error(`Command failed (exit ${status.code}): ${command}`);
  }
}

async function buildDomInlineC(filterSlug?: string): Promise<void> {
  const items = filterSlug
    ? DOM_INLINE_C_BUILDS.filter((d) => d.slug === filterSlug)
    : DOM_INLINE_C_BUILDS;
  for (const item of items) {
    const cmd = [
      "clang",
      "--target=wasm32",
      "-O3",
      "-nostdlib",
      "-ffreestanding",
      "-Wl,--no-entry",
      "-Wl,--export-all",
      "-Wl,--initial-memory=16777216",
      "-o",
      item.artifact,
      item.source,
    ].join(" ");
    await runShell(cmd);
  }
}

async function buildTrackBStandalone(): Promise<void> {
  for (const item of TRACK_B_STANDALONE_BUILDS) {
    if (item.kind === "c" || item.kind === "c-simd") {
      const simdFlag = item.kind === "c-simd" ? "-msimd128 " : "";
      await runShell(
        `clang --target=wasm32 -O3 ${simdFlag}-nostdlib -ffreestanding -ffp-contract=off -Wl,--no-entry -Wl,--export-all -Wl,--initial-memory=4194304 -o ${item.artifact} ${item.source}`,
      );
    }
  }
}

export function renderWasmBuildDocumentation(): string {
  const lines: string[] = [];
  lines.push("# WebAssembly Build Reference & Output Equivalence Guide");
  lines.push("");
  lines.push(
    "This document specifies how every WebAssembly (`.wasm`) binary in `wasm-vs-js` is built from source, the exact commands to rebuild all 345 committed `.wasm` artifacts across 9 build lanes (300 baseline/multi-language/static Track B binaries plus 45 isolated `public/artifacts/autoresearch/` SIMD128 binaries), how each of the 50 benchmark tests maps to its JavaScript and WebAssembly sources, and how output consistency is verified before and during benchmark execution.",
  );
  lines.push("");
  lines.push("## 1. Toolchain Requirements & Environment Setup");
  lines.push("");
  lines.push(
    "Toolchain pins are recorded in `toolchain-pin.json` and explained in `docs/toolchain-provenance.md`. Local builds prepend `WASM_VS_JS_TOOL_PATH` ahead of `PATH`:",
  );
  lines.push("");
  lines.push("```bash");
  lines.push(
    'export WASM_VS_JS_TOOL_PATH="/opt/homebrew/opt/llvm@22/bin:$HOME/.cargo/bin:$HOME/.local/toolchains/dart-sdk/bin"',
  );
  lines.push("deno run --allow-read --allow-run --allow-env scripts/toolchain-fingerprint.ts");
  lines.push("```");
  lines.push("");
  lines.push(
    "| Compiler / Assembler / Linker | Target / Invocation | Pinned Distribution (`toolchain-pin.json` / `deno.lock`) |",
  );
  lines.push("| --- | --- | --- |");
  lines.push(
    "| `wabt` (npm package in `deno.lock`) | WebAssembly Text (`.wat`) → `.wasm` | `1.0.37` (`npm:wabt@1.0.37`) |",
  );
  lines.push(
    "| `clang` / `clang++` + `wasm-ld` | `--target=wasm32 -O3 -nostdlib -ffreestanding -ffp-contract=off -Wl,--no-entry` | LLVM `22.1.8` (`sha256:f260f4f7c0d4…` macOS ARM64 / `Homebrew clang version 22.1.8` + `Homebrew LLD 22.1.8`) |",
  );
  lines.push(
    "| `rustc` | `--target wasm32-unknown-unknown -O --crate-type cdylib` | `1.97.1 (8bab26f4f 2026-07-14)` (channel manifest `sha256:03569b1886ce…`, LLVM `22.1.6`) |",
  );
  lines.push(
    "| `asc` (AssemblyScript) | `npx --yes -p assemblyscript asc -O3 --runtime stub` | `0.28.20` (`sha512-5PM7GZpvcLyp…`) |",
  );
  lines.push(
    "| `dart compile wasm` | `dart compile wasm --no-source-maps` (Track B also tests `-O2`, `-O3`, `-O4`) | Dart SDK `3.12.2` (`sha256:cd8753928e77…` macOS ARM64) |",
  );
  lines.push(
    "| Kotlin/Wasm (`wasmJs`) | Gradle `wasmJsBrowserDistribution` (`text.gc-document-edit.v1`) | Gradle `9.6.1` + OpenJDK `26.0.1` |",
  );
  lines.push("");
  lines.push("Exact build and host infrastructure is logged across four machine-readable ledgers:");
  lines.push("");
  lines.push(
    "- **`toolchain-pin.json`** — upstream compiler release URLs and archive SHA-256/SHA-512 hashes.",
  );
  lines.push(
    "- **`public/artifacts/multilang-wasm-benchmark/kernel-build-provenance.v1.json`** — content-addressed toolchain fingerprints (`tc-*`), compiler target/thread/LLVM details, OS/arch, and per-kernel SHA-256 reproduction status across 210 multi-language kernels.",
  );
  lines.push(
    "- **`public/data/autoresearch-log.v1.json` (`buildInfrastructure`)** — full CPU model and core topology, physical RAM, OS/kernel build, Deno/V8/TypeScript/Node versions, `clang`/`clang++`/`wasm-ld`/`rustc`/`dart`/`asc`/`wabt` versions, `toolchain-pin.json` & `deno.lock` SHA-256 digests, and per-binary SHA-256 hashes for all 45 isolated SIMD128 artifacts.",
  );
  lines.push(
    "- **Per-workload `public/artifacts/<workload>/build-manifest.json`** — `sourceCommit`, compiler flags, and source/binary SHA-256 digests for primary worker artifacts.",
  );
  lines.push(
    "- **`public/data/worker-lifecycle.v1.json` & [`docs/worker-lifecycle-audit.md`](/docs/worker-lifecycle-audit.md)** — source-audited per-test Web Worker task-pipeline lifecycle classification (`symmetric-warm`, `asymmetric-wasm-cold-per-task`, `per-task-verified-bundle`, `symmetric-cold-isolate`, `in-page-kernel-only`), worker SHA-256 digests, and per-task `no-store` / `SHA-256` / `WebAssembly.instantiate` flags across all 50 tests.",
  );
  lines.push("");
  lines.push("## 2. Commands to Build All WebAssembly (`.wasm`) Files");
  lines.push("");
  lines.push(
    "Inspect or verify the entire 345-binary `.wasm` inventory and 50-test registry at any time with:",
  );
  lines.push("");
  lines.push("```bash");
  lines.push("# Print all 9 build lanes and all 50 per-test build commands");
  lines.push("deno run --allow-read scripts/build-all-wasm.ts --list");
  lines.push("");
  lines.push(
    "# Verify all 50 benchmark specs, source files, routes, oracle tests, and 345/345 .wasm artifacts",
  );
  lines.push("deno run --allow-read scripts/build-all-wasm.ts --verify");
  lines.push("```");
  lines.push("");
  lines.push("### Master Build Commands by Lane");
  lines.push("");
  for (const lane of WASM_BUILD_LANES) {
    lines.push(`#### Lane \`${lane.id}\` — ${lane.title}`);
    lines.push("");
    lines.push(lane.description);
    lines.push("");
    lines.push(`- **Toolchain flags**: \`${lane.compilerSummary}\``);
    lines.push(`- **Output directory**: \`${lane.outputDir}\``);
    lines.push("");
    lines.push("```bash");
    lines.push(`deno run --allow-all scripts/build-all-wasm.ts --lane ${lane.id}`);
    lines.push("# Direct command:");
    lines.push(lane.command);
    if (lane.checkCommand) {
      lines.push("# Non-destructive provenance check:");
      lines.push(lane.checkCommand);
    }
    lines.push("```");
    lines.push("");
  }
  lines.push("### Rebuilding a Single Benchmark Test");
  lines.push("");
  lines.push("```bash");
  lines.push("# Rebuild primary .wasm for one test by slug or workload ID:");
  lines.push("deno run --allow-all scripts/build-all-wasm.ts --only ml-gemm");
  lines.push("");
  lines.push("# Rebuild both primary .wasm and all multi-language .wasm kernels for one test:");
  lines.push("deno run --allow-all scripts/build-all-wasm.ts --only ml-gemm --include-multilang");
  lines.push("");
  lines.push(
    "# Overwrite committed multi-language .wasm artifacts (by default existing bytes are preserved):",
  );
  lines.push(
    "deno run --allow-all scripts/build-multilang-kernels.ts --only ml-gemm --with-dart --force",
  );
  lines.push("```");
  lines.push("");
  lines.push("### Rebinding Commit-Pinned Manifests After Changing Primary Artifacts");
  lines.push("");
  lines.push(
    "Several primary workload manifests record `sourceCommit` and SHA-256 digests of the compiled `.wasm` and worker sources. After modifying source files on a commit-bound workload: (1) commit the source change, (2) run the workload's builder with `--source-commit=$(git rev-parse HEAD)` (and `deno run --allow-all scripts/build-routes.ts`), and (3) run `deno task check`.",
  );
  lines.push("");
  lines.push("## 3. How Output Consistency (Algorithmic Equivalence) Is Verified");
  lines.push("");
  lines.push(
    "Timing comparisons are invalid if two engines compute different functions or silently drop work. Every benchmark enforces output consistency across five layers:",
  );
  lines.push("");
  lines.push(
    "1. **Pre-timing in-browser engine agreement (`public/multilang-runner.js`)**: All 43 multi-language kernel adapters run a deterministic verification probe before recording any timing iteration. Twenty-two adapters call `requireEngineAgreement(label, probes, expected)` to hash each engine's output buffer with 32-bit FNV-1a (`hashBytes`, `hashF32Quantized`, `hashF64Quantized`, or `hashI32Words`); the remaining 21 adapters assert exact FNV-1a digests, SHA-256 digests, or frozen multi-field state tuples inline. Any mismatch throws immediately and halts timing. Verified per-engine digests are rendered in the **Output Consistency** banner and **Output** column on every benchmark page.",
  );
  lines.push(
    "2. **Worker pipeline JS-vs-Wasm verification (`public/unified-runner.js`)**: Dedicated JS and Wasm Web Workers execute the identical fixed input fixture and return structured output digests (`outputSha256`, `checksum`, `fnv1a`, `sum`, or DOM state counters). The unified runner compares JS and Wasm pipeline digests and displays the verified value in the results explorer and playground cards.",
  );
  lines.push(
    '3. **Controlled Track A (`bit-identical`) vs Optimized Track B (`reassociated`)**: Track A engines compile with `-ffp-contract=off` and follow identical reduction order to match the JS reference bit-for-bit (`equivalence: "bit-identical"`). Track B variants (`public/data/track-b.v1.json`) that apply loop interchange, tiling, or SIMD128 horizontal reductions declare `equivalence: "reassociated"` and a numeric `declaredTolerance` (for example `1e-5` on `ml.gemm.v1` and `1e-9` on `numeric.polybench-panel.v1`). Each reassociated variant is checked against `maxRelativeDeviation <= declaredTolerance` before timing and labeled with its tolerance in the UI.',
  );
  lines.push(
    "4. **Real-DOM final state & node-reuse assertions (`tests/dom-conformance.test.ts`)**: All 11 DOM-family workloads apply their frozen command stream to a live iframe DOM via `/dom-hosts/*.js` and verify rendered node counts, text, focus/selection state, and keyed element identity against the workload oracle.",
  );
  lines.push(
    "5. **Offline source-rebuild oracle attestation (`public/data/oracle-equivalence.v1.json`)**: `scripts/attest-oracle-equivalence.ts` recompiles kernel sources into temporary `.wasm` binaries and verifies their outputs against the canonical JavaScript reference oracles (`deno test --allow-read tests/oracle-equivalence.test.ts`).",
  );
  lines.push("");
  lines.push("Run the cross-suite equivalence gates directly with:");
  lines.push("");
  lines.push("```bash");
  lines.push("deno test --allow-read tests/multilang-adapter-verifies-output.test.ts");
  lines.push("deno test --allow-read tests/multilang-engine-agreement.test.ts");
  lines.push("deno test --allow-read tests/oracle-equivalence.test.ts");
  lines.push("deno test --allow-all tests/dom-conformance.test.ts");
  lines.push("```");
  lines.push("");
  let workerLifecycleMap = new Map<
    string,
    {
      workerScript: string | null;
      lifecycleClass: string;
      perTaskWasmInstantiate: boolean;
    }
  >();
  try {
    const wlLedger = JSON.parse(Deno.readTextFileSync("public/data/worker-lifecycle.v1.json"));
    workerLifecycleMap = new Map(
      (wlLedger.entries ?? []).map((
        e: {
          slug: string;
          workerScript: string | null;
          lifecycleClass: string;
          perTaskWasmInstantiate: boolean;
        },
      ) => [e.slug, e]),
    );
  } catch {
    // Fallback if worker-lifecycle.v1.json has not been generated yet.
  }

  lines.push("## 4. Per-Benchmark Build, Source & Equivalence Reference (All 50 Tests)");
  lines.push("");
  lines.push(
    "Every source path listed below is served directly by the web server (for example `/benchmarks/multilang-wasm/ml-gemm/gemm.c`) and linked to GitHub from each benchmark page, the `/benchmarks/` catalog, and the `/` homepage cards. The **Worker Pipeline Lifecycle** column records whether each test's Web Worker keeps a warm `WebAssembly.Instance` across steady-state iterations or re-instantiates `.wasm` per message (full audit in [`/docs/worker-lifecycle-audit.md`](/docs/worker-lifecycle-audit.md)).",
  );
  lines.push("");
  lines.push(
    "| # | Workload ID & Route | JS Source | Primary Wasm Source | Worker Pipeline Lifecycle | Output `.wasm` & Compiler | Build Command | Oracle Equivalence Tests |",
  );
  lines.push("| --- | --- | --- | --- | --- | --- | --- | --- |");
  for (const s of BENCHMARK_BUILD_SPECS) {
    const jsUrl = toServedUrl(s.jsSource);
    const wasmSrcUrl = toServedUrl(s.wasmSource);
    const testsCode = s.oracleTests.map((t) => `\`${t}\``).join(", ");
    const buildCmds = s.multilangBuildCommand
      ? `\`${s.buildCommand}\`<br>Multilang: \`${s.multilangBuildCommand}\``
      : `\`${s.buildCommand}\``;
    const wl = workerLifecycleMap.get(s.slug);
    const wlCell = wl
      ? (wl.workerScript
        ? `[\`${wl.workerScript}\`](${wl.workerScript})<br>\`${wl.lifecycleClass}\` (${
          wl.perTaskWasmInstantiate ? "per-task instantiate" : "warm Wasm instance"
        })`
        : `\`${wl.lifecycleClass}\``)
      : "—";
    lines.push(
      `| ${s.index} | \`${s.id}\`<br>[${s.route}](${s.route}) | [\`${s.jsSource}\`](${jsUrl}) | [\`${s.wasmSource}\`](${wasmSrcUrl}) | ${wlCell} | [\`${s.wasmArtifactUrl}\`](${s.wasmArtifactUrl})<br>${s.compiler} (\`${s.compilerFlags}\`) | ${buildCmds} | ${testsCode} |`,
    );
  }
  lines.push("");
  lines.push("### Real-DOM Linear-Memory C Kernels (`DOM_INLINE_C_BUILDS`)");
  lines.push("");
  lines.push("| Workload Slug | C Source | Output `.wasm` | Compile Command |");
  lines.push("| --- | --- | --- | --- |");
  for (const d of DOM_INLINE_C_BUILDS) {
    lines.push(
      `| \`${d.slug}\` | [\`${d.source}\`](/${d.source}) | \`/${
        d.artifact.replace(/^public\//, "")
      }\` | \`clang --target=wasm32 -O3 -nostdlib -ffreestanding -Wl,--no-entry -Wl,--export-all -Wl,--initial-memory=16777216 -o ${d.artifact} ${d.source}\` |`,
    );
  }
  lines.push("");
  lines.push("### Standalone Multi-Language & Track B Kernels (`TRACK_B_STANDALONE_BUILDS`)");
  lines.push("");
  lines.push("| Kernel Key | Source | Output `.wasm` | Lane |");
  lines.push("| --- | --- | --- | --- |");
  for (const t of TRACK_B_STANDALONE_BUILDS) {
    lines.push(
      `| \`${t.key}\` | [\`${t.source}\`](/${t.source}) | \`/${
        t.artifact.replace(/^public\//, "")
      }\` | \`${t.kind}\` |`,
    );
  }
  lines.push("");
  return lines.join("\n");
}

function printList(): void {
  console.log(`=== WebAssembly Build Lanes (${WASM_BUILD_LANES.length}) ===\n`);
  for (const lane of WASM_BUILD_LANES) {
    console.log(`[${lane.id}] ${lane.title}`);
    console.log(`  Toolchain : ${lane.compilerSummary}`);
    console.log(`  Output    : ${lane.outputDir}`);
    console.log(`  Command   : ${lane.command}`);
    if (lane.checkCommand) {
      console.log(`  Check     : ${lane.checkCommand}`);
    }
    console.log("");
  }

  console.log(
    `=== Per-Benchmark Build & Equivalence Specs (${BENCHMARK_BUILD_SPECS.length}) ===\n`,
  );
  for (const spec of BENCHMARK_BUILD_SPECS) {
    console.log(
      `${String(spec.index).padStart(2, "0")}. ${spec.id} (${spec.slug}) -> ${spec.route}`,
    );
    console.log(`    JS Source     : ${spec.jsSource}`);
    console.log(`    Wasm Source   : ${spec.wasmSource}`);
    console.log(`    Wasm Artifact : ${spec.wasmArtifact} (${spec.compiler})`);
    console.log(`    Build Command : ${spec.buildCommand}`);
    if (spec.multilangBuildCommand) {
      console.log(`    Multilang Cmd : ${spec.multilangBuildCommand}`);
    }
    console.log(`    Oracle Tests  : deno test --allow-all ${spec.oracleTests.join(" ")}`);
  }
}

async function runSpecBuild(spec: BenchmarkBuildSpec, includeMultilang: boolean): Promise<void> {
  if (spec.buildScript === "scripts/build-all-wasm.ts") {
    await buildDomInlineC(spec.slug);
  } else {
    await runShell(spec.buildCommand);
  }
  if (includeMultilang && spec.multilangBuildCommand) {
    await runShell(spec.multilangBuildCommand);
  }
}

export async function formatMarkdown(md: string): Promise<string> {
  const child = new Deno.Command(Deno.execPath(), {
    args: ["fmt", "--ext=md", "-"],
    stdin: "piped",
    stdout: "piped",
    stderr: "piped",
  }).spawn();
  const writer = child.stdin.getWriter();
  await writer.write(new TextEncoder().encode(md));
  await writer.close();
  const out = await child.output();
  if (!out.success) {
    throw new Error(`deno fmt failed: ${new TextDecoder().decode(out.stderr)}`);
  }
  return new TextDecoder().decode(out.stdout);
}

if (import.meta.main) {
  const args = Deno.args;
  if (
    args.length === 0 || args.includes("--list") || args.includes("--help") || args.includes("-h")
  ) {
    printList();
    Deno.exit(0);
  }

  if (args.includes("--write-doc")) {
    const doc = await formatMarkdown(renderWasmBuildDocumentation());
    await Deno.writeTextFile("docs/wasm-build-and-equivalence.md", doc);
    console.log("Wrote docs/wasm-build-and-equivalence.md");
    Deno.exit(0);
  }

  if (args.includes("--verify")) {
    const res = await verifyWasmInventory();
    console.log(
      `Verified ${res.specCount} benchmark build specs and ${res.accountedWasmFiles}/${res.wasmFilesFound} .wasm files.`,
    );
    if (!res.ok) {
      for (const m of res.missingPaths) console.error(`  MISSING: ${m}`);
      for (const u of res.unaccountedWasmFiles) console.error(`  UNACCOUNTED WASM: ${u}`);
      Deno.exit(1);
    }
    Deno.exit(0);
  }

  const onlyIdx = args.indexOf("--only");
  if (onlyIdx !== -1) {
    const key = args[onlyIdx + 1];
    if (!key) {
      console.error("Missing value for --only <slug-or-id>");
      Deno.exit(2);
    }
    const spec = findBuildSpec(key);
    if (!spec) {
      console.error(`Unknown benchmark slug or id: ${key}`);
      Deno.exit(2);
    }
    await runSpecBuild(spec, args.includes("--include-multilang"));
    Deno.exit(0);
  }

  const laneIdx = args.indexOf("--lane");
  if (laneIdx !== -1) {
    const laneId = args[laneIdx + 1];
    const lane = WASM_BUILD_LANES.find((l) => l.id === laneId);
    if (!lane) {
      console.error(
        `Unknown --lane ${laneId}. Valid lanes: ${WASM_BUILD_LANES.map((l) => l.id).join(", ")}`,
      );
      Deno.exit(2);
    }
    if (lane.id === "dom-inline-c") {
      await buildDomInlineC();
    } else if (lane.id === "primary-workloads") {
      const seenCommands = new Set<string>();
      for (const spec of BENCHMARK_BUILD_SPECS) {
        if (spec.buildScript === "scripts/build-all-wasm.ts") continue;
        if (spec.buildScript === "scripts/build-text-gc-document-edit-wasmgc.sh") continue;
        if (seenCommands.has(spec.buildCommand)) continue;
        seenCommands.add(spec.buildCommand);
        await runShell(spec.buildCommand);
      }
    } else if (lane.id === "multilang-compilers") {
      const extraFlags: string[] = [];
      if (args.includes("--with-dart")) extraFlags.push("--with-dart");
      if (args.includes("--force")) extraFlags.push("--force");
      const cmd = `deno run --allow-all scripts/build-multilang-kernels.ts ${extraFlags.join(" ")}`
        .trim();
      await runShell(cmd);
    } else if (lane.id === "track-b") {
      await buildTrackBStandalone();
      await runShell(lane.command);
    } else {
      await runShell(lane.command);
    }
    Deno.exit(0);
  }

  console.error(`Unrecognized arguments: ${args.join(" ")}. Run with --help for usage.`);
  Deno.exit(2);
}
