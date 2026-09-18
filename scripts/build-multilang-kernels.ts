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
//   deno run --allow-all scripts/build-multilang-kernels.ts [--only <filter>]
//     where <filter> is a comma-separated list of workloads ("ml-gemm") or
//     individual engines ("ml-gemm/asc-ikj")
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

import { fingerprintToolchain } from "./toolchain-fingerprint.ts";

const ROOT = new URL("../", import.meta.url).pathname;
const MANIFEST_DIR = `${ROOT}public/benchmarks/multilang-wasm`;
const ARTIFACT_DIR = `${ROOT}public/artifacts/multilang-wasm-benchmark`;
const PROVENANCE = `${ARTIFACT_DIR}/kernel-build-provenance.v1.json`;
const TOOLCHAIN_PIN = `${ROOT}toolchain-pin.json`;

/**
 * Toolchains that recorded observations before observations carried an
 * identity. Their version strings survive; nothing else about them does.
 */
const UNRECORDED_TOOLCHAIN = "tc-unrecorded";

/** One machine's answer to "does this recipe rebuild the committed bytes?". */
export interface Reproduction {
  toolchain: string;
  result: "identical" | "differs" | "notCommitted";
  /** What that machine's compiler actually emitted. */
  artifactSha256: string;
  firstObserved: string;
  lastObserved: string;
}

export interface LedgerRecord {
  workload: string;
  engine: string;
  lang: string;
  source: string;
  sourceSha256: string;
  artifact: string;
  /** The committed artifact's hash, not any particular rebuild's. */
  artifactSha256: string;
  artifactBytes: number;
  command: string;
  reproducesCommittedBytes: boolean;
  reproductions: Reproduction[];
}

interface PriorLedger {
  kernels?: (LedgerRecord & { reproductions?: Reproduction[] })[];
  toolchain?: Record<string, string>;
  toolchains?: Record<string, unknown>;
}

/**
 * A schema v1 entry states a verdict with no owner. Turning it into an
 * observation attributed to an unidentified machine keeps the information and
 * stops it being re-attributed to whoever runs the builder next.
 */
function migrate(entry: LedgerRecord & { reproductions?: Reproduction[] }): LedgerRecord {
  if (entry.reproductions) return entry as LedgerRecord;
  return {
    ...entry,
    reproductions: [{
      toolchain: UNRECORDED_TOOLCHAIN,
      result: entry.reproducesCommittedBytes ? "identical" : "differs",
      artifactSha256: entry.artifactSha256,
      firstObserved: "unrecorded",
      lastObserved: "unrecorded",
    }],
  };
}

/**
 * Extra directories searched for compilers, colon-separated. rustup and the
 * Dart SDK install outside the default PATH of a non-login shell; this used to
 * be two absolute paths under one contributor's Linux home directory, which
 * found nothing on any other machine and silently fell through to whatever the
 * ambient PATH happened to hold.
 */
function extraToolPaths(): string {
  const declared = Deno.env.get("WASM_VS_JS_TOOL_PATH");
  if (declared) return declared;
  const home = Deno.env.get("HOME") ?? "";
  return [
    `${home}/.cargo/bin`,
    `${home}/.local/share/dart-sdk/bin`,
    `${home}/.local/toolchains/dart-sdk/bin`,
  ].join(":");
}

/**
 * Built lazily: reading the environment at module load would make merely
 * importing planBuilds() require --allow-env, and the gate grants only a
 * scoped set of variables to its test stages.
 */
function buildEnv(): Record<string, string> {
  return {
    ...Deno.env.toObject(),
    PATH: `${extraToolPaths()}:${Deno.env.get("PATH") ?? ""}`,
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
  /** dart2wasm optimization level, when the engine row declares one. */
  optimizationLevel?: string;
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
    optimizationLevel?: string;
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
        optimizationLevel: engine.optimizationLevel,
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
      // dart2wasm defaults to -O1. The optimization-level variants are the same
      // source at a different level, so a recipe without the flag rebuilds the
      // baseline and is recorded as failing to reproduce a variant it was never
      // the recipe for.
      return ["dart", [
        "compile",
        "wasm",
        ...(build.optimizationLevel ? [`-O${build.optimizationLevel}`] : []),
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
  // Entries are either a whole workload ("ml-gemm") or a single engine within
  // one ("ml-gemm/asc-ikj"). Engine granularity matters: recording a newly
  // added kernel should not re-record its neighbours' artifact hashes under
  // whatever clang the current machine has, which silently replaces another
  // machine's measurements with this one's.
  const only = onlyIndex >= 0
    ? new Set(Deno.args[onlyIndex + 1].split(",").map((w) => w.trim()).filter(Boolean))
    : null;

  const matchesOnly = (b: EngineBuild): boolean =>
    only!.has(b.workload) || only!.has(`${b.workload}/${b.engineKey}`);

  const withDart = Deno.args.includes("--with-dart");
  const { builds: allBuilds, skipped } = await planBuilds(withDart);
  const builds = only ? allBuilds.filter(matchesOnly) : allBuilds;
  if (only) {
    // A filter that matches nothing used to run zero builds and then write a
    // ledger holding zero kernels, deleting every recipe in it. Refuse instead.
    const unmatched = [...only].filter((w) =>
      !allBuilds.some((b) => b.workload === w || `${b.workload}/${b.engineKey}` === w)
    );
    if (unmatched.length > 0) {
      console.error(
        `--only matched no build for: ${unmatched.join(", ")}\n` +
          `known workloads: ${[...new Set(allBuilds.map((b) => b.workload))].sort().join(", ")}`,
      );
      Deno.exit(1);
    }
  }

  let scratchDir: string | null = null;
  let env0: Record<string, string> | null = null;
  const records: {
    workload: string;
    engine: string;
    result: Reproduction["result"];
    builtSha256: string;
    record: Omit<LedgerRecord, "reproductions">;
  }[] = [];
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
    let outcome: Reproduction["result"];
    if (committed === null) {
      // Nothing to compare against yet. Not a failure to reproduce — there was
      // no committed artifact to reproduce.
      outcome = "notCommitted";
      differs.push(`${build.workload}/${build.engineKey} (${build.artifact}: was not committed)`);
    } else if (committedHash === builtHash) {
      outcome = "identical";
      reproduced++;
    } else {
      outcome = "differs";
      differs.push(`${build.workload}/${build.engineKey} (${build.artifact})`);
    }
    records.push({
      workload: build.workload,
      engine: build.engineKey,
      result: outcome,
      builtSha256: builtHash,
      record: {
        workload: build.workload,
        engine: build.engineKey,
        lang: build.lang,
        source: build.source,
        sourceSha256: await sha256Hex(sourceBytes),
        artifact: build.artifact,
        artifactSha256: committedHash ?? builtHash,
        artifactBytes: committed?.byteLength ?? built.byteLength,
        reproducesCommittedBytes: outcome === "identical",
        // Recorded relative to the repository root so the recipe is readable
        // and re-runnable without the absolute paths of whoever built it.
        command: [cmd, ...args.map((a) => a.replace(ROOT, "").replace(buildDir, "<out>"))]
          .join(" "),
      },
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
    // A filtered run rebuilds a subset, so it may only update that subset's
    // entries — writing `records` alone would drop every recipe it did not
    // rebuild. Carry the untouched entries forward and recount from the merged
    // set, so the summary describes the ledger rather than this run.
    let prior: PriorLedger = {};
    try {
      prior = JSON.parse(await Deno.readTextFile(PROVENANCE));
    } catch {
      prior = {};
    }

    const fingerprint = await fingerprintToolchain(env0 ?? buildEnv(), { probeAsc: false });
    const today = new Date().toISOString().slice(0, 10);

    // The singular block names the toolchain the project targets, read from the
    // committed pin. It used to be whatever compiler the last run happened to
    // have, which relabelled 154 entries every time someone new built two of
    // them. What each machine actually observed lives in `toolchains`.
    const pin = JSON.parse(await Deno.readTextFile(TOOLCHAIN_PIN)) as {
      distributions: Record<string, { expectedVersionString?: string }>;
    };
    const referenceToolchain = {
      clang: pin.distributions.llvm?.expectedVersionString ?? "unrecorded",
      rustc: pin.distributions.rust?.expectedVersionString ?? "unrecorded",
      dart: pin.distributions.dart?.expectedVersionString ?? "unrecorded",
      source: "toolchain-pin.json",
    };

    const toolchains: Record<string, unknown> = { ...(prior.toolchains ?? {}) };
    // Schema v1 named one toolchain for the whole ledger and attached no
    // identity to any individual observation. Those version strings are all
    // that is known about the machines behind the pre-existing entries, so they
    // are carried forward under an id that says so rather than being silently
    // re-attributed to whoever runs this next.
    if (!toolchains[UNRECORDED_TOOLCHAIN] && (prior.kernels ?? []).length > 0) {
      toolchains[UNRECORDED_TOOLCHAIN] = {
        id: UNRECORDED_TOOLCHAIN,
        os: "unrecorded",
        arch: "unrecorded",
        tools: Object.fromEntries(
          Object.entries(prior.toolchain ?? {}).map(([k, v]) => [k, { version: v }]),
        ),
        note:
          "Schema v1 recorded one global toolchain block for the whole ledger and no identity " +
          "per observation. These are those version strings. Everything else about the machines " +
          "that produced these observations is unrecorded and not recoverable.",
      };
    }
    toolchains[fingerprint.id] = fingerprint;

    const merged = new Map<string, LedgerRecord>();
    for (const entry of prior.kernels ?? []) {
      merged.set(`${entry.workload}/${entry.engine}`, migrate(entry));
    }
    for (const record of records) {
      const key = `${record.workload}/${record.engine}`;
      const existing = merged.get(key);
      const reproductions = [...(existing?.reproductions ?? [])];
      const at = reproductions.findIndex((r) => r.toolchain === fingerprint.id);
      const observation: Reproduction = {
        toolchain: fingerprint.id,
        result: record.result,
        artifactSha256: record.builtSha256,
        firstObserved: at >= 0 ? reproductions[at].firstObserved : today,
        lastObserved: today,
      };
      if (at >= 0) reproductions[at] = observation;
      else reproductions.push(observation);
      merged.set(key, { ...record.record, reproductions });
    }

    // Under v1 `artifactSha256` held whatever the last run compiled, so for the
    // entries that do not reproduce it did not describe the committed file it
    // sat next to. It is the published artifact's hash; what a given machine
    // compiled belongs in that machine's observation.
    for (const [, entry] of merged) {
      try {
        entry.artifactSha256 = await sha256Hex(
          await Deno.readFile(`${ARTIFACT_DIR}/${entry.artifact}`),
        );
      } catch {
        // No committed artifact: the recorded hash is the only one there is.
      }
      entry.reproducesCommittedBytes = entry.reproductions.some((r) => r.result === "identical");
    }

    const kernels = [...merged.values()].sort((a, b) => a.artifact.localeCompare(b.artifact));
    const reproducedCount = kernels.filter((k) => k.reproducesCommittedBytes).length;

    const byToolchain: Record<string, Record<string, number>> = {};
    for (const id of Object.keys(toolchains)) {
      const tally = { identical: 0, differs: 0, notCommitted: 0, notObserved: 0 };
      for (const k of kernels) {
        const seen = k.reproductions.find((r) => r.toolchain === id);
        if (!seen) tally.notObserved++;
        else tally[seen.result]++;
      }
      byToolchain[id] = tally;
    }

    await Deno.writeTextFile(
      PROVENANCE,
      JSON.stringify(
        {
          schemaVersion: 2,
          description:
            "Build recipe and content hashes for every multi-language kernel artifact compiled " +
            "from a source named by a workload manifest, with one reproduction observation per " +
            "toolchain that has run the recipe.",
          reproducibilityIsAMeasurement:
            "Whether a recipe rebuilds the committed bytes is a property of the machine that " +
            "ran it, not of the artifact. Observations are appended under the fingerprint of " +
            "the toolchain that made them and are never overwritten by another machine. " +
            "reproducesCommittedBytes means at least one recorded toolchain reproduced the " +
            "bytes; reproductionsByToolchain gives the per-machine breakdown.",
          toolchain: referenceToolchain,
          toolchains,
          kernelCount: kernels.length,
          reproducesCommittedBytes: reproducedCount,
          doesNotReproduceCommittedBytes: kernels.length - reproducedCount,
          reproductionsByToolchain: byToolchain,
          kernels,
        },
        null,
        2,
      ) + "\n",
    );
    console.log(
      `${kernels.length} kernels have a recorded recipe; ${reproducedCount} reproduce their ` +
        `committed bytes under at least one recorded toolchain, ` +
        `${kernels.length - reproducedCount} under none; this run was ${fingerprint.id} ` +
        `(${JSON.stringify(byToolchain[fingerprint.id])}); wrote ${written.length} artifact(s); ` +
        `${failures.length} failed, ${skipped.length} skipped`,
    );
    for (const w of written) console.log(`  wrote: ${w}`);
    for (const f of failures.slice(0, 20)) console.log(`  FAILED: ${f}`);
    if (failures.length > 0) Deno.exit(1);
  }
}
