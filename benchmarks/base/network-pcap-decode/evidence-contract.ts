// deno-lint-ignore-file no-explicit-any
import { sha256Hex } from "../../../lib/canonical.ts";

export interface PcapEvidenceBundle {
  benchmark: Record<string, any>;
  registration: Record<string, any>;
  fixture: Record<string, any>;
  output: Record<string, any>;
  build: Record<string, any>;
  records: Record<string, Record<string, any>>;
}

const WORKLOAD_ID = "network.pcap-decode.v1";
const BUILD_PATH = "public/artifacts/base-network-pcap-decode/build-manifest.json";
const FIXTURE_PATH = "public/artifacts/base-network-pcap-decode/fixture.pcap";
const OUTPUT_PATH = "public/artifacts/base-network-pcap-decode/reference-output.bin";
const VARIANTS = ["js-controlled", "wasm-linear-controlled"] as const;
const TARGETS = { "js-controlled": "javascript", "wasm-linear-controlled": "wasm-linear" };
const COMPILER_ARGS = [
  "--target=wasm32-unknown-unknown",
  "-O3",
  "-nostdlib",
  "-ffreestanding",
  "-fno-builtin",
  "-c",
  "benchmarks/base/network-pcap-decode/pcap-decode.c",
  "-o",
  "public/artifacts/base-network-pcap-decode/.build/pcap-decode.o",
];
const LINKER_ARGS = [
  "--no-entry",
  "--export-memory",
  "--export=input_ptr",
  "--export=output_ptr",
  "--export=output_len",
  "--export=run",
  "--initial-memory=1048576",
  "--max-memory=1048576",
  "--stack-first",
  "public/artifacts/base-network-pcap-decode/.build/pcap-decode.o",
  "-o",
  "public/artifacts/base-network-pcap-decode/.build/pcap-decode.wasm",
];
const BUILD_COMMANDS = [
  `clang ${COMPILER_ARGS.join(" ")}`,
  `wasm-ld ${LINKER_ARGS.join(" ")}`,
];

function ordered(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(ordered);
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>).sort(([left], [right]) =>
        left.localeCompare(right)
      ).map(([key, child]) => [key, ordered(child)]),
    );
  }
  return value;
}

function same(left: unknown, right: unknown): boolean {
  return JSON.stringify(ordered(left)) === JSON.stringify(ordered(right));
}

export async function validatePcapEvidenceSemantics(
  bundle: PcapEvidenceBundle,
  options: { repoRoot?: string; readFile?: (path: string) => Promise<Uint8Array> } = {},
): Promise<{ ok: boolean; errors: string[] }> {
  const errors: string[] = [];
  const { benchmark, registration, fixture, output, build, records } = bundle;
  const benchmarkVariants = Object.fromEntries(
    (benchmark.variants ?? []).map((variant: Record<string, unknown>) => [variant.id, variant]),
  );
  const registeredVariants = Object.fromEntries(
    (registration.variants ?? []).map((variant: Record<string, unknown>) => [variant.id, variant]),
  );

  if (
    benchmark.id !== "network-pcap-decode-v1-controlled" || benchmark.version !== 1 ||
    benchmark.inputs?.manifestSha256 !== fixture.sha256 ||
    registration.frozenCatalogReference?.id !== WORKLOAD_ID ||
    registration.fixture?.sha256 !== fixture.sha256 ||
    registration.fixture?.packetCount !== fixture.packetCount ||
    registration.fixedOracle?.outputBytes !== output.bytes
  ) {
    errors.push("registration, benchmark, fixture, or output identity contradicts the package");
  }
  for (const variantId of VARIANTS) {
    if (
      benchmarkVariants[variantId]?.target !== TARGETS[variantId] ||
      benchmarkVariants[variantId]?.buildManifest !== BUILD_PATH ||
      registeredVariants[variantId]?.target !== TARGETS[variantId]
    ) {
      errors.push(`${variantId} registration contradicts the controlled benchmark`);
    }
  }

  if (
    build.workloadId !== WORKLOAD_ID ||
    build.sourceRepository !== "https://github.com/PaulKinlan/wasm-vs-js" ||
    !/^[a-f0-9]{40}$/.test(build.sourceCommit ?? "") ||
    !same(build.variants, [...VARIANTS]) ||
    build.fixture?.path !== FIXTURE_PATH || build.fixture?.sha256 !== fixture.sha256 ||
    build.referenceOutput?.path !== OUTPUT_PATH || build.referenceOutput?.sha256 !== output.sha256
  ) {
    errors.push("build provenance contradicts registered package identities");
  }
  const sourcePaths = (build.fullSourceGraph ?? []).map((source: Record<string, unknown>) =>
    source.path
  );
  if (new Set(sourcePaths).size !== sourcePaths.length) {
    errors.push("build source graph contains duplicate paths");
  }
  const requiredSources = [
    "benchmarks/base/network-pcap-decode/fixture.ts",
    "benchmarks/base/network-pcap-decode/engine.js",
    "benchmarks/base/network-pcap-decode/pcap-decode.c",
    "benchmarks/base/network-pcap-decode/benchmark.json",
    "benchmarks/base/network-pcap-decode/implementation-contract.v1.json",
    "benchmarks/base/network-pcap-decode/RIGHTS.md",
    "benchmarks/base/network-pcap-decode/evidence-contract.ts",
    "scripts/build-base-network-pcap-decode.ts",
    "lib/canonical.ts",
    "deno.json",
    "deno.lock",
    "schemas/base-network-pcap-registration.schema.json",
    "schemas/base-network-pcap-fixture-manifest.schema.json",
    "schemas/base-network-pcap-output-manifest.schema.json",
    "schemas/base-network-pcap-build-manifest.schema.json",
    "schemas/base-network-pcap-correctness-record.schema.json",
  ];
  if (!same(sourcePaths, requiredSources)) {
    errors.push("build source graph is incomplete or reordered");
  }
  const sourceIdentity = (build.fullSourceGraph ?? []).map(
    (source: Record<string, unknown>) => `${source.path}\0${source.sha256}\n`,
  ).join("");
  if (build.sourceSha256 !== await sha256Hex(sourceIdentity)) {
    errors.push("build aggregate source hash contradicts its source graph");
  }
  const lockSource = (build.fullSourceGraph ?? []).find(
    (source: Record<string, unknown>) => source.path === "deno.lock",
  );
  if (
    !lockSource ||
    !same(build.build?.lockfiles, [{ path: "deno.lock", sha256: lockSource.sha256 }])
  ) {
    errors.push("build lockfile identity contradicts its source graph");
  }
  if (
    !same(build.build?.commands, BUILD_COMMANDS) ||
    !same(build.build?.flags?.compiler, COMPILER_ARGS.slice(0, 5)) ||
    !same(build.build?.flags?.linker, LINKER_ARGS.slice(0, 9)) ||
    !same(build.build?.flags?.runtime, [
      "scalar Wasm",
      "fixed initial=max memory",
      "memory.grow unavailable",
    ])
  ) {
    errors.push("build commands or flags contradict the exact compile and link recipe");
  }

  const expectedCounters = {
    packetRecords: 8,
    ethernetHeaders: 7,
    ipv4Headers: 7,
    tcpHeaders: 3,
    udpHeaders: 2,
    dnsMessages: 2,
    httpMessages: 2,
    dnsCompressionPointers: 1,
    tcpReassemblyAppends: 3,
    malformedPackets: 3,
    flowTableProbes: 6,
    packetBytes: 511,
    flows: 4,
    outputBytes: 208,
  };
  for (const variantId of VARIANTS) {
    const record = records[variantId];
    const expected = {
      ...expectedCounters,
      allocations: variantId === "js-controlled" ? 14 : 0,
      boundaryCrossings: variantId === "js-controlled" ? 0 : 1,
    };
    if (
      !record || record.workloadId !== WORKLOAD_ID || record.variantId !== variantId ||
      record.target !== TARGETS[variantId] || record.sourceCommit !== build.sourceCommit ||
      record.input?.sha256 !== fixture.sha256 || record.input?.bytes !== fixture.bytes ||
      record.completeOutput?.sha256 !== output.sha256 ||
      record.completeOutput?.bytes !== output.bytes || !same(record.counters, expected) ||
      record.buildManifest?.path !== BUILD_PATH
    ) {
      errors.push(`${variantId} correctness record contradicts its manifests`);
    }
  }

  const readFile = options.readFile ?? ((path: string) => Deno.readFile(path));
  const root = String(options.repoRoot ?? ".").replace(/\/$/, "");
  try {
    const buildBytes = await readFile(`${root}/${BUILD_PATH}`);
    const buildSha256 = await sha256Hex(buildBytes);
    for (const variantId of VARIANTS) {
      if (records[variantId]?.buildManifest?.sha256 !== buildSha256) {
        errors.push(`${variantId} correctness record does not hash the build manifest`);
      }
    }
    for (
      const identity of [
        build.wasm,
        build.fixture,
        build.referenceOutput,
        ...(build.manifests ?? []),
      ]
    ) {
      const bytes = await readFile(`${root}/${identity.path}`);
      if (bytes.byteLength !== identity.bytes || await sha256Hex(bytes) !== identity.sha256) {
        errors.push(`persisted file contradicts build identity: ${identity.path}`);
      }
    }
    for (const source of build.fullSourceGraph ?? []) {
      const bytes = await readFile(`${root}/${source.path}`);
      if (bytes.byteLength !== source.bytes || await sha256Hex(bytes) !== source.sha256) {
        errors.push(`working source contradicts build identity: ${source.path}`);
      }
    }
  } catch (error) {
    errors.push(
      `PCAP evidence file is unreadable: ${error instanceof Error ? error.message : error}`,
    );
  }

  return { ok: errors.length === 0, errors };
}
