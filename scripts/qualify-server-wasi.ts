const CONTRACT_PATH = "benchmarks/base/server-wasi-request-handler/implementation-contract.v1.json";

export const INDEPENDENT_JAVASCRIPT_SQLITE_CANDIDATES = [
  {
    id: "repository-entrypoint",
    path: "benchmarks/base/server-wasi-request-handler/javascript-sqlite.ts",
  },
  {
    id: "vendored-javascript-source",
    path: "benchmarks/base/server-wasi-request-handler/vendor/sqlite.js",
  },
  {
    id: "vendored-typescript-source",
    path: "benchmarks/base/server-wasi-request-handler/vendor/sqlite.ts",
  },
] as const;

type IndependentJavaScriptSqliteCandidate = {
  id: string;
  path: string;
};

export type IndependentJavaScriptSqliteCandidateProbe = IndependentJavaScriptSqliteCandidate & {
  available: boolean;
};

export type QualificationProbe = {
  deno: string;
  hostSqliteCliObserved: string | null;
  wasiSdkClangAtOptPathAvailable: boolean;
  wasiSysrootAtUsrSharePathAvailable: boolean;
  rustWasip1StandardLibraryAvailable: boolean;
  repositoryPinnedSqliteSourceAvailable: boolean;
  repositoryPinnedSqliteWasiArtifactAvailable: boolean;
  independentJavaScriptSqliteCandidates: IndependentJavaScriptSqliteCandidateProbe[];
  independentJavaScriptSqliteAvailable: boolean;
};

async function exists(path: string): Promise<boolean> {
  try {
    await Deno.stat(path);
    return true;
  } catch (error) {
    if (error instanceof Deno.errors.NotFound) return false;
    throw error;
  }
}

async function commandFirstLine(command: string, args: string[]): Promise<string | null> {
  try {
    const result = await new Deno.Command(command, { args, stdout: "piped", stderr: "null" })
      .output();
    if (!result.success) return null;
    return new TextDecoder().decode(result.stdout).trim().split(/\s+/)[0] ?? null;
  } catch (error) {
    if (error instanceof Deno.errors.NotFound) return null;
    throw error;
  }
}

async function rustWasip1StdAvailable(): Promise<boolean> {
  const sysrootResult = await new Deno.Command("rustc", {
    args: ["--print", "sysroot"],
    stdout: "piped",
    stderr: "null",
  }).output().catch(() => null);
  if (!sysrootResult?.success) return false;
  const sysroot = new TextDecoder().decode(sysrootResult.stdout).trim();
  return await exists(`${sysroot}/lib/rustlib/wasm32-wasip1/lib`);
}

export async function probeIndependentJavaScriptSqliteCandidates(
  candidates: readonly IndependentJavaScriptSqliteCandidate[] =
    INDEPENDENT_JAVASCRIPT_SQLITE_CANDIDATES,
): Promise<IndependentJavaScriptSqliteCandidateProbe[]> {
  return await Promise.all(
    candidates.map(async (candidate) => ({
      ...candidate,
      available: await exists(candidate.path),
    })),
  );
}

export async function probeQualification(): Promise<QualificationProbe> {
  const sqliteVersion = await commandFirstLine("sqlite3", ["--version"]);
  const independentJavaScriptSqliteCandidates = await probeIndependentJavaScriptSqliteCandidates();
  return {
    deno: Deno.version.deno,
    hostSqliteCliObserved: sqliteVersion,
    wasiSdkClangAtOptPathAvailable: await exists("/opt/wasi-sdk/bin/clang"),
    wasiSysrootAtUsrSharePathAvailable: await exists("/usr/share/wasi-sysroot"),
    rustWasip1StandardLibraryAvailable: await rustWasip1StdAvailable(),
    repositoryPinnedSqliteSourceAvailable: await exists(
      "benchmarks/base/server-wasi-request-handler/vendor/sqlite3.c",
    ),
    repositoryPinnedSqliteWasiArtifactAvailable: await exists(
      "public/artifacts/server-wasi-request-handler/sqlite3.wasm",
    ),
    independentJavaScriptSqliteCandidates,
    independentJavaScriptSqliteAvailable: independentJavaScriptSqliteCandidates.some((candidate) =>
      candidate.available
    ),
  };
}

export async function verifyRecordedQualification(): Promise<QualificationProbe> {
  const contract = JSON.parse(await Deno.readTextFile(CONTRACT_PATH));
  const observed = await probeQualification();
  const expected = contract.qualification;
  const checks: Array<[string, unknown, unknown]> = [
    ["Deno version", observed.deno, expected.deno],
    ["host SQLite CLI", observed.hostSqliteCliObserved, expected.hostSqliteCliObserved],
    [
      "wasi-sdk clang at /opt/wasi-sdk/bin/clang",
      observed.wasiSdkClangAtOptPathAvailable,
      expected.wasiSdkClangAtOptPathAvailable,
    ],
    [
      "WASI sysroot at /usr/share/wasi-sysroot",
      observed.wasiSysrootAtUsrSharePathAvailable,
      expected.wasiSysrootAtUsrSharePathAvailable,
    ],
    [
      "Rust wasm32-wasip1 standard library",
      observed.rustWasip1StandardLibraryAvailable,
      expected.rustWasip1StandardLibraryAvailable,
    ],
    [
      "pinned SQLite source",
      observed.repositoryPinnedSqliteSourceAvailable,
      expected.repositoryPinnedSqliteSourceAvailable,
    ],
    [
      "pinned SQLite WASI artifact",
      observed.repositoryPinnedSqliteWasiArtifactAvailable,
      expected.repositoryPinnedSqliteWasiArtifactAvailable,
    ],
    [
      "independent JavaScript SQLite candidate audit",
      JSON.stringify(observed.independentJavaScriptSqliteCandidates),
      JSON.stringify(expected.independentJavaScriptSqliteAudit.inspectedCandidates),
    ],
    [
      "independent JavaScript SQLite availability",
      observed.independentJavaScriptSqliteAvailable,
      expected.independentJavaScriptSqliteAvailable,
    ],
  ];
  const mismatches = checks.filter(([, actual, wanted]) => actual !== wanted);
  if (mismatches.length > 0) {
    throw new Error(
      mismatches.map(([label, actual, wanted]) =>
        `${label}: observed ${actual}, recorded ${wanted}`
      )
        .join("\n"),
    );
  }
  if (expected.identicalSqliteRuntimeEstablished !== false || contract.coverage.counted !== false) {
    throw new Error("Blocked qualification must not establish a runtime or count catalog coverage");
  }
  return observed;
}

if (import.meta.main) {
  const observed = await verifyRecordedQualification();
  console.log(JSON.stringify({ status: "blocked-before-implementation", observed }, null, 2));
}
