// scripts/build-multilang-kernels.ts
//
// Compiles every multi-language kernel that a workload manifest declares, and
// records how it was built.
//
// Why this exists: 135 of the 176 committed .wasm artifacts under
// public/artifacts/multilang-wasm-benchmark/ had no build step anywhere in the
// repository, no entry in any build manifest, and no recorded compiler flags.
// They are binaries of unknown origin driving published language comparisons.
// PLAN.md requires every variant to record its build recipe; these did not, and
// the committed bytes could not be reproduced from the committed sources.
//
// The per-workload manifests under public/benchmarks/multilang-wasm/ already
// name each engine's source file and artifact, so they are the input here
// rather than a second hand-maintained list that could drift from them.
//
// Usage:
//   deno run --allow-all scripts/build-multilang-kernels.ts [--only <workload>]
//   deno run --allow-all scripts/build-multilang-kernels.ts --check
//   deno run --allow-all scripts/build-multilang-kernels.ts --with-dart
//
// Not part of `deno task check`: compiling 159 kernels takes minutes and its
// CPU load perturbs the gate's carefully phased writer/reader stages.
// tests/multilang-kernel-provenance.test.ts holds the record complete and
// honest on every gate run; this script refreshes it.
//
// By default only MISSING artifacts are written. A recipe that has not been
// shown to produce an oracle-passing artifact must not silently replace a
// committed one: rebuilding every kernel with these flags regressed twelve
// oracle tests, mostly Rust, because the recorded recipe is not yet the recipe
// the committed bytes were built with. --force overwrites anyway, for when a
// recipe has been verified for that lane.
//
// --check rebuilds into a temporary directory and reports which committed
// artifacts the recorded recipe does not reproduce. That count IS the
// provenance gap, stated rather than hidden.

const ROOT = new URL("../", import.meta.url).pathname;
const MANIFEST_DIR = `${ROOT}public/benchmarks/multilang-wasm`;
const ARTIFACT_DIR = `${ROOT}public/artifacts/multilang-wasm-benchmark`;
const PROVENANCE = `${ARTIFACT_DIR}/kernel-build-provenance.v1.json`;

const CARGO_BIN = "/home/paulkinlan/.cargo/bin";
const DART_BIN = "/home/paulkinlan/.local/share/dart-sdk/bin";

/**
 * Built lazily: reading the environment at module load would make merely
 * importing planBuilds() require --allow-env, and the gate grants only a
 * scoped set of variables to its test stages.
 */
function buildEnv(): Record<string, string> {
  return {
    ...Deno.env.toObject(),
    PATH: `${CARGO_BIN}:${DART_BIN}:${Deno.env.get("PATH") ?? ""}`,
  };
}

/** Default linear-memory size, in bytes, for the C/C++/Rust builds. */
const DEFAULT_INITIAL_MEMORY = 16_777_216;

export interface EngineBuild {
  workload: string;
  engineKey: string;
  lang: string;
  source: string;
  artifact: string;
  /** Bytes of linear memory the module starts with. */
  initialMemoryBytes: number;
}

interface Manifest {
  workloadId?: string;
  kernels?: string[];
  engines?: Array<{
    key?: string;
    kind?: string;
    lang?: string;
    source?: string;
    file?: string;
    files?: Record<string, string>;
    initialMemoryBytes?: number;
  }>;
}

function artifactOf(
  manifest: Manifest,
  engine: NonNullable<Manifest["engines"]>[number],
): string | null {
  if (engine.file) return engine.file;
  if (engine.files) {
    const first = Object.values(engine.files)[0];
    if (first) return first;
  }
  const kernel = manifest.kernels?.[0];
  if (kernel && engine.lang) return `${kernel}_${engine.lang}.wasm`;
  return null;
}

/** Every engine row across every manifest that names a source we can compile. */
export async function planBuilds(
  withDart = false,
): Promise<{ builds: EngineBuild[]; skipped: string[] }> {
  const builds: EngineBuild[] = [];
  const skipped: string[] = [];
  for await (const entry of Deno.readDir(MANIFEST_DIR)) {
    if (!entry.isFile || !entry.name.endsWith(".manifest.json")) continue;
    const workload = entry.name.replace(".manifest.json", "");
    let manifest: Manifest;
    try {
      manifest = JSON.parse(await Deno.readTextFile(`${MANIFEST_DIR}/${entry.name}`));
    } catch (error) {
      skipped.push(`${workload}: unreadable manifest (${error})`);
      continue;
    }
    for (const engine of manifest.engines ?? []) {
      const key = engine.key ?? "";
      if (key === "js" || key === "wat" || key === "kt") continue;
      // Dart is skipped unless asked for. The committed dart2wasm glue is
      // lint-clean; a newer SDK emits `var` and unused helpers, so
      // regenerating it fails the gate's lint stage while changing nothing
      // about what the kernel computes.
      if ((engine.kind === "dart" || engine.lang === "dart") && !withDart) continue;
      const source = engine.source;
      const artifact = artifactOf(manifest, engine);
      if (!source || !artifact) {
        skipped.push(`${workload}/${key}: manifest names no ${source ? "artifact" : "source"}`);
        continue;
      }
      const sourcePath = `${ROOT}${source}`;
      try {
        await Deno.stat(sourcePath);
      } catch {
        skipped.push(`${workload}/${key}: source ${source} does not exist`);
        continue;
      }
      const lang = engine.lang ?? (engine.kind === "dart" ? "dart" : key);
      builds.push({
        workload,
        engineKey: key,
        lang,
        source,
        artifact,
        initialMemoryBytes: engine.initialMemoryBytes ?? DEFAULT_INITIAL_MEMORY,
      });
    }
  }
  builds.sort((a, b) =>
    a.workload.localeCompare(b.workload) || a.engineKey.localeCompare(b.engineKey)
  );
  return { builds, skipped };
}

/** The exact command for one build. Recorded verbatim in the provenance file. */
export function commandFor(build: EngineBuild, outDir: string): [string, string[]] | null {
  const src = `${ROOT}${build.source}`;
  const out = `${outDir}/${build.artifact}`;
  const pages = Math.max(1, Math.ceil(build.initialMemoryBytes / 65536));
  switch (build.lang) {
    case "c":
      return ["clang", [
        "--target=wasm32",
        "-O3",
        "-nostdlib",
        // Several kernels hand-write strlen/strcmp so no libc is needed; at
        // -O3 clang otherwise recognises the pattern and emits a call to the
        // libc symbol that -nostdlib cannot resolve.
        "-ffreestanding",
        "-ffp-contract=off",
        "-Wl,--no-entry",
        "-Wl,--export-all",
        `-Wl,--initial-memory=${build.initialMemoryBytes}`,
        "-o",
        out,
        src,
      ]];
    case "cpp":
      return ["clang++", [
        "--target=wasm32",
        "-O3",
        "-nostdlib",
        "-fno-exceptions",
        "-ffreestanding",
        "-ffp-contract=off",
        "-Wl,--no-entry",
        "-Wl,--export-all",
        `-Wl,--initial-memory=${build.initialMemoryBytes}`,
        "-o",
        out,
        src,
      ]];
    case "rs":
      return ["rustc", [
        "--target=wasm32-unknown-unknown",
        "-O",
        "--crate-type",
        "cdylib",
        "-o",
        out,
        src,
      ]];
    case "asc":
    case "as":
      return ["npx", [
        "--yes",
        "-p",
        "assemblyscript",
        "asc",
        src,
        "-O3",
        "--bindings",
        "none",
        "--noAssert",
        "--initialMemory",
        String(pages),
        "-o",
        out,
      ]];
    case "dart":
      return ["dart", [
        "compile",
        "wasm",
        "--no-source-maps",
        src,
        "-o",
        out,
      ]];
    default:
      return null;
  }
}

async function sha256Hex(bytes: Uint8Array): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", bytes as Uint8Array<ArrayBuffer>);
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

if (import.meta.main) {
  const check = Deno.args.includes("--check");
  const force = Deno.args.includes("--force");
  const onlyIndex = Deno.args.indexOf("--only");
  const only = onlyIndex >= 0 ? Deno.args[onlyIndex + 1] : null;

  const withDart = Deno.args.includes("--with-dart");
  const { builds: allBuilds, skipped } = await planBuilds(withDart);
  const builds = only ? allBuilds.filter((b) => b.workload === only) : allBuilds;

  let scratchDir: string | null = null;
  let env0: Record<string, string> | null = null;
  const records: Record<string, unknown>[] = [];
  const failures: string[] = [];
  const differs: string[] = [];

  let reproduced = 0;
  const written: string[] = [];
  for (const build of builds) {
    // Existing artifacts are rebuilt into a scratch directory so the recipe can
    // be compared without replacing bytes that currently pass their oracle.
    let committed: Uint8Array | null = null;
    try {
      committed = await Deno.readFile(`${ARTIFACT_DIR}/${build.artifact}`);
    } catch {
      committed = null;
    }
    const writeDirect = check ? false : (force || committed === null);
    const buildDir = writeDirect ? ARTIFACT_DIR : (scratchDir ??= await Deno.makeTempDir({
      prefix: "wvj-kernels-",
    }));
    const command = commandFor(build, buildDir);
    if (!command) {
      skipped.push(`${build.workload}/${build.engineKey}: no recipe for lang ${build.lang}`);
      continue;
    }
    const [cmd, args] = command;
    const env = env0 ??= buildEnv();
    const result = await new Deno.Command(cmd, { args, env, stderr: "piped", stdout: "piped" })
      .output();
    if (!result.success) {
      failures.push(
        `${build.workload}/${build.engineKey}: ${new TextDecoder().decode(result.stderr).trim()}`,
      );
      continue;
    }
    const built = await Deno.readFile(`${buildDir}/${build.artifact}`);
    const sourceBytes = await Deno.readFile(`${ROOT}${build.source}`);
    const builtHash = await sha256Hex(built);
    const committedHash = committed === null ? null : await sha256Hex(committed);
    if (writeDirect) written.push(build.artifact);
    if (committed === null) {
      differs.push(`${build.workload}/${build.engineKey} (${build.artifact}: was not committed)`);
    } else if (committedHash === builtHash) {
      reproduced++;
    } else {
      differs.push(`${build.workload}/${build.engineKey} (${build.artifact})`);
    }
    records.push({
      workload: build.workload,
      engine: build.engineKey,
      lang: build.lang,
      source: build.source,
      sourceSha256: await sha256Hex(sourceBytes),
      artifact: build.artifact,
      artifactSha256: builtHash,
      artifactBytes: built.byteLength,
      reproducesCommittedBytes: committedHash !== null && committedHash === builtHash,
      // Recorded relative to the repository root so the recipe is readable and
      // re-runnable without the absolute paths of whoever built it.
      command: [cmd, ...args.map((a) => a.replace(ROOT, "").replace(buildDir, "<out>"))].join(" "),
    });
  }

  if (scratchDir) await Deno.remove(scratchDir, { recursive: true });

  if (check) {
    console.log(
      `${records.length} kernels rebuilt from their recorded recipe; ` +
        `${reproduced} reproduce the committed bytes exactly, ` +
        `${differs.length} do not.`,
    );
    for (const d of differs.slice(0, 20)) console.log(`  differs: ${d}`);
    for (const f of failures.slice(0, 20)) console.log(`  FAILED:  ${f}`);
    if (failures.length > 0) Deno.exit(1);
  } else {
    records.sort((a, b) => String(a.artifact).localeCompare(String(b.artifact)));
    await Deno.writeTextFile(
      PROVENANCE,
      JSON.stringify(
        {
          schemaVersion: 1,
          description:
            "Build recipe and content hashes for every multi-language kernel artifact compiled " +
            "from a source named by a workload manifest.",
          toolchain: {
            clang: new TextDecoder().decode(
              (await new Deno.Command("clang", {
                args: ["--version"],
                stdout: "piped",
                env: buildEnv(),
              }).output())
                .stdout,
            ).split("\n")[0],
            rustc: new TextDecoder().decode(
              (await new Deno.Command("rustc", {
                args: ["--version"],
                stdout: "piped",
                env: buildEnv(),
              }).output())
                .stdout,
            ).trim(),
          },
          kernelCount: records.length,
          // How far the recorded recipes actually go. A kernel that does not
          // reproduce its committed bytes still has a readable recipe and a
          // source hash, but the committed binary was built some other way and
          // that recipe is not recoverable — stated here rather than implied.
          reproducesCommittedBytes: reproduced,
          doesNotReproduceCommittedBytes: differs.length,
          kernels: records,
        },
        null,
        2,
      ) + "\n",
    );
    console.log(
      `${records.length} kernels have a recorded recipe; ${reproduced} reproduce their committed ` +
        `bytes exactly, ${differs.length} do not; wrote ${written.length} artifact(s); ` +
        `${failures.length} failed, ${skipped.length} skipped`,
    );
    for (const w of written) console.log(`  wrote: ${w}`);
    for (const f of failures.slice(0, 20)) console.log(`  FAILED: ${f}`);
    if (failures.length > 0) Deno.exit(1);
  }
}
