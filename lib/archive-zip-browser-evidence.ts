export const ARCHIVE_ZIP_BROWSER_POLICY = Object.freeze(
  {
    channel: "chrome-for-testing",
    productName: "Google Chrome for Testing",
    version: "150.0.7871.24",
    cdpProduct: "Chrome/150.0.7871.24",
    sourceBinary: "/home/paulkinlan/.local/bin/google-chrome-stable",
    binarySha256: "dea3ab8fba923b718920ef9d62570824f2dc0ab0c72d66d53f91b41de6570355",
    packageManifestSha256: "e3d5088a5244a494b206819630d4eb2d7e3ee999d1a04cab9d2d95d0daf292db",
    extraArguments: [
      "--enable-automation",
      "--headless=new",
      "--no-sandbox",
      "--disable-gpu",
      "--disable-background-networking",
      "--disable-component-update",
      "--disable-default-apps",
      "--disable-extensions",
      "--metrics-recording-only",
      "--hide-scrollbars",
      "--window-size=1440,1200",
    ],
  } as const,
);

export const ARCHIVE_ZIP_SOURCE_PATHS = Object.freeze(
  [
    "scripts/collect-archive-zip-browser-evidence.ts",
    "lib/archive-zip-browser-evidence.ts",
    "lib/canonical.ts",
    "lib/cdp-client.ts",
    "lib/chrome-stage.ts",
    "lib/owned-chrome.ts",
    "lib/process-ledger.ts",
    "lib/stage-lifecycle.ts",
    "public/archive-zip-demo.js",
    "public/archive-zip-worker.js",
    "public/benchmarks/archive-zip-workspace-v1/index.html",
    "public/benchmarks/v1/archive-zip-workspace/engine.js",
    "public/artifacts/archive-zip-workspace-v1/archive-zip-workspace.wasm",
    "public/artifacts/archive-zip-workspace-v1/build-manifest.json",
    "public/artifacts/archive-zip-workspace-v1/fixture-manifest.json",
    "public/artifacts/archive-zip-workspace-v1/output-manifest.json",
    "schemas/archive-zip-browser-evidence.schema.json",
  ] as const,
);

export const ARCHIVE_ZIP_SCENARIOS = Object.freeze(
  [
    { id: "full-javascript", kind: "complete", target: "javascript", mode: "full" },
    { id: "full-wasm", kind: "complete", target: "wasm", mode: "full" },
    { id: "bounded-javascript", kind: "complete", target: "javascript", mode: "bounded" },
    { id: "bounded-wasm", kind: "complete", target: "wasm", mode: "bounded" },
    { id: "wrong-token", kind: "wrong-token", target: "javascript", mode: "bounded" },
    { id: "stale-completion", kind: "stale", target: "javascript", mode: "bounded" },
    { id: "restart", kind: "restart", target: "wasm", mode: "bounded" },
    { id: "timeout", kind: "timeout", target: "javascript", mode: "bounded" },
    { id: "cancel", kind: "cancel", target: "javascript", mode: "bounded" },
    { id: "pagehide", kind: "pagehide", target: "wasm", mode: "bounded" },
    { id: "unknown-target", kind: "closed-negative", target: "unknown", mode: "bounded" },
    { id: "unknown-mode", kind: "closed-negative", target: "javascript", mode: "unknown" },
  ] as const,
);

const FULL_HASHES = Object.freeze({
  archiveSha256: "5838f8e2ebe9db24e2c21131425d8bd7de517c1263b45090947d87c28b7afee8",
  listingSha256: "0fe8c100fe59cef8c3120a200f57101cc9ea9a6a77672bd8e35cddd483424478",
  extractedSha256: "d91c23bc264f65c087bc9b848b8becee1424decbcfb5c92fd26aa669328bfb4c",
});
const FULL_COUNTERS = Object.freeze({
  javascript: Object.freeze({
    entries: 10_000,
    inputBytes: 1_038_404,
    crcBytes: 1_038_404,
    deflateLiterals: 427_105,
    deflateMatches: 7_501,
    deflateMatchedBytes: 611_299,
    deflateEndSymbols: 10_000,
    localHeaders: 10_000,
    centralHeaders: 10_000,
    zip64Records: 0,
    listedEntries: 10_000,
    extractedEntries: 10,
    extractedBytes: 905,
    boundaryCrossings: 0,
  }),
  wasm: Object.freeze({
    entries: 10_000,
    inputBytes: 1_038_404,
    crcBytes: 1_038_404,
    deflateLiterals: 427_105,
    deflateMatches: 7_501,
    deflateMatchedBytes: 611_299,
    deflateEndSymbols: 10_000,
    localHeaders: 10_000,
    centralHeaders: 10_000,
    zip64Records: 0,
    listedEntries: 10_000,
    extractedEntries: 10,
    extractedBytes: 905,
    boundaryCrossings: 3,
    zipBytes: 1_710_792,
  }),
});

function exactKeysAndValues(
  actual: Record<string, unknown>,
  expected: Record<string, unknown>,
  label: string,
): void {
  const actualKeys = Object.keys(actual).sort();
  const expectedKeys = Object.keys(expected).sort();
  if (JSON.stringify(actualKeys) !== JSON.stringify(expectedKeys)) {
    throw new Error(`${label} key set mismatch`);
  }
  for (const key of expectedKeys) {
    if (actual[key] !== expected[key]) throw new Error(`${label}.${key} mismatch`);
  }
}

export function assertArchiveZipScenarioSemantics(value: Record<string, unknown>): void {
  const browser = value.browser as Record<string, unknown>;
  if (
    browser?.channel !== ARCHIVE_ZIP_BROWSER_POLICY.channel ||
    browser?.version !== ARCHIVE_ZIP_BROWSER_POLICY.version ||
    browser?.cdpProduct !== ARCHIVE_ZIP_BROWSER_POLICY.cdpProduct ||
    browser?.binarySha256 !== ARCHIVE_ZIP_BROWSER_POLICY.binarySha256 ||
    browser?.packageManifestSha256 !== ARCHIVE_ZIP_BROWSER_POLICY.packageManifestSha256
  ) throw new Error("browser policy mismatch");
  const requested = browser.requestedArguments as string[];
  const profileArgument = requested?.find((argument) => argument.startsWith("--user-data-dir="));
  const exactRequested = [
    profileArgument,
    "--remote-debugging-port=0",
    "--no-first-run",
    "--no-default-browser-check",
    "--disable-sync",
    "--disable-crash-reporter",
    "--disable-breakpad",
    ...ARCHIVE_ZIP_BROWSER_POLICY.extraArguments,
    "about:blank",
  ];
  if (
    !profileArgument?.startsWith("--user-data-dir=/tmp/wasm-vs-js-owned-profiles/") ||
    JSON.stringify(requested) !== JSON.stringify(exactRequested) ||
    !(browser.effectiveArguments as string[])?.includes("--enable-automation")
  ) throw new Error("browser launch argument mismatch");
  const serverOrigin = String((value.server as Record<string, unknown>)?.origin ?? "");
  const scenarios = value.scenarios as Array<Record<string, unknown>>;
  if (!Array.isArray(scenarios)) throw new Error("scenarios missing");
  const expectedIds = ARCHIVE_ZIP_SCENARIOS.map((scenario) => scenario.id);
  if (JSON.stringify(scenarios.map((scenario) => scenario.id)) !== JSON.stringify(expectedIds)) {
    throw new Error("scenario order/denominator mismatch");
  }
  const checkpointLabels: Record<string, string[]> = {
    complete: ["ready", "started", "completed"],
    "wrong-token": ["ready", "started", "wrong-token-ignored", "wrong-token-cleanup"],
    stale: ["ready", "started", "stale-completion-ignored", "stale-cleanup"],
    restart: ["ready", "started", "restart-replaced-worker", "restart-cleanup"],
    timeout: ["ready", "started", "timeout-terminated"],
    cancel: ["ready", "started", "cancel-terminated"],
    pagehide: ["ready", "started", "pagehide-terminated"],
    "closed-negative": ["ready", "closed-negative-rejected"],
  };
  for (let index = 0; index < scenarios.length; index++) {
    const actual = scenarios[index];
    const expected = ARCHIVE_ZIP_SCENARIOS[index];
    for (const key of ["id", "kind", "target", "mode"] as const) {
      if (actual[key] !== expected[key]) throw new Error(`${expected.id}.${key} mismatch`);
    }
    const checkpoints = actual.checkpoints as Array<Record<string, unknown>>;
    if (
      !Array.isArray(checkpoints) ||
      JSON.stringify(checkpoints.map((checkpoint) => checkpoint.label)) !==
        JSON.stringify(checkpointLabels[expected.kind])
    ) throw new Error(`${expected.id} causal checkpoint contract mismatch`);
    for (let checkpoint = 1; checkpoint < checkpoints.length; checkpoint++) {
      if (Number(checkpoints[checkpoint].sequence) !== checkpoint) {
        throw new Error(`${expected.id} checkpoint sequence mismatch`);
      }
      if (
        Number(checkpoints[checkpoint].monotonicMs) <
          Number(checkpoints[checkpoint - 1].monotonicMs)
      ) {
        throw new Error(`${expected.id} checkpoint time regressed`);
      }
    }
    if (expected.kind === "complete") {
      const result = actual.result as Record<string, unknown>;
      if (!result || result.target !== expected.target || result.mode !== expected.mode) {
        throw new Error(`${expected.id} result identity mismatch`);
      }
      const wantedEntries = expected.mode === "full" ? 10_000 : 1_000;
      const wantedExtractions = expected.mode === "full" ? 10 : 4;
      const counters = result.counters as Record<string, unknown>;
      if (
        result.entryCount !== wantedEntries || counters.entries !== wantedEntries ||
        counters.listedEntries !== wantedEntries || counters.extractedEntries !== wantedExtractions
      ) throw new Error(`${expected.id} fixed work mismatch`);
      if (expected.mode === "full") {
        exactKeysAndValues(
          result.hashes as Record<string, unknown>,
          FULL_HASHES,
          `${expected.id}.hashes`,
        );
        exactKeysAndValues(
          counters,
          FULL_COUNTERS[expected.target as "javascript" | "wasm"],
          `${expected.id}.counters`,
        );
      }
    } else {
      if (actual.result !== null) throw new Error(`${expected.id} retained a semantic result`);
      const causal = (checkpoints.at(-2) ?? checkpoints.at(-1))!;
      const end = checkpoints.at(-1)!;
      if (
        ["stale", "restart"].includes(expected.kind) &&
        (Number(causal.workerCount) !== 2 || Number(causal.terminatedWorkers) !== 1)
      ) throw new Error(`${expected.id} replacement causality mismatch`);
      if (
        ["timeout", "cancel", "pagehide"].includes(expected.kind) &&
        Number(end.terminatedWorkers) !== 1
      ) throw new Error(`${expected.id} termination causality mismatch`);
      if (
        expected.kind === "wrong-token" &&
        !String(causal.status).startsWith("Running ")
      ) throw new Error("wrong-token was not ignored while active");
      if (expected.kind === "closed-negative") {
        const wanted = expected.id === "unknown-target" ? "unknown target" : "unknown demo mode";
        if (end.output !== wanted) throw new Error(`${expected.id} semantic rejection mismatch`);
      }
    }
    const network = actual.network as Array<Record<string, unknown>>;
    if (!Array.isArray(network) || !network.length) {
      throw new Error(`${expected.id} network absent`);
    }
    for (const request of network) {
      const response = request.response as Record<string, unknown>;
      const end = request.end as Record<string, unknown>;
      const raw = request.raw as Record<string, unknown>;
      if (
        response?.status !== 200 || end?.failed !== false || request.method !== "GET" ||
        new URL(String(request.url)).origin !== serverOrigin ||
        !Number.isInteger(raw?.bytes) || Number(raw.bytes) < 0 ||
        !/^[a-f0-9]{64}$/.test(String(raw?.sha256 ?? ""))
      ) throw new Error(`${expected.id} network response incomplete`);
    }
    if ((actual.exceptions as unknown[])?.length !== 0) {
      throw new Error(`${expected.id} retained an exception`);
    }
    if (
      (actual.console as Array<Record<string, unknown>>)?.some((entry) => entry.type === "error")
    ) {
      throw new Error(`${expected.id} retained a console error`);
    }
  }
}

export function parseArchiveZipVisibleResult(text: string): Record<string, unknown> {
  const lines = text.split("\n");
  const field = (label: string) => {
    const line = lines.find((candidate) => candidate.startsWith(`${label}: `));
    if (!line) throw new Error(`visible result omitted ${label}`);
    return line.slice(label.length + 2);
  };
  const countersAt = text.indexOf("Counters: ");
  if (countersAt < 0) throw new Error("visible result omitted counters");
  return {
    mode: field("Mode"),
    target: field("Target"),
    entryCount: Number(field("Entries")),
    hashes: {
      archiveSha256: field("Archive SHA-256"),
      listingSha256: field("Listing SHA-256"),
      extractedSha256: field("Extracted SHA-256"),
    },
    counters: JSON.parse(text.slice(countersAt + "Counters: ".length)),
  };
}
