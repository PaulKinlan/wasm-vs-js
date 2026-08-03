import { sha256Hex } from "../lib/canonical.ts";
import { generatePcapFixture } from "../benchmarks/base/network-pcap-decode/fixture.ts";
import { runPcapJavaScript } from "../benchmarks/base/network-pcap-decode/engine.js";

const root = new URL("../", import.meta.url);
const repository = "https://github.com/PaulKinlan/wasm-vs-js";
const sourceDir = "benchmarks/base/network-pcap-decode";
const checkMode = Deno.args.includes("--check");
const generatedRoot = checkMode
  ? new URL(`file://${await Deno.makeTempDir({ prefix: "pcap-build-check-" })}/`)
  : root;
const artifactDir = new URL("public/artifacts/base-network-pcap-decode/", generatedRoot);
const evidenceDir = new URL("public/evidence/base-v1/network-pcap-decode/", generatedRoot);
const buildManifestUrl = new URL("build-manifest.json", artifactDir);
const publishedBuildManifestUrl = new URL(
  "public/artifacts/base-network-pcap-decode/build-manifest.json",
  root,
);
const sourceCommitArgument = Deno.args.find((argument) => argument.startsWith("--source-commit="));
let sourceCommit = sourceCommitArgument?.slice("--source-commit=".length) ?? "";
if (!sourceCommit) {
  try {
    sourceCommit = JSON.parse(await Deno.readTextFile(publishedBuildManifestUrl)).sourceCommit ??
      "";
  } catch {
    // A first build must supply the implementation commit explicitly.
  }
}
if (!/^[a-f0-9]{40}$/.test(sourceCommit)) {
  throw new Error(
    "--source-commit=<40 lowercase hex Git commit> is required until a build manifest pins it",
  );
}
const commitProbe = await new Deno.Command("git", {
  args: ["cat-file", "-e", `${sourceCommit}^{commit}`],
  cwd: root.pathname,
  stdout: "null",
  stderr: "piped",
}).output();
if (!commitProbe.success) {
  throw new Error(`source commit is not locally resolvable: ${sourceCommit}`);
}

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
  return new TextDecoder().decode(result.stdout).trim();
}
async function writeJson(url: URL, value: unknown): Promise<Uint8Array> {
  const bytes = new TextEncoder().encode(`${JSON.stringify(value, null, 2)}\n`);
  await Deno.writeFile(url, bytes);
  return bytes;
}
async function fileIdentity(path: string, base = root) {
  const bytes = await Deno.readFile(new URL(path, base));
  return { path, bytes: bytes.length, sha256: await sha256Hex(bytes) };
}

const sourcePaths = [
  `${sourceDir}/fixture.ts`,
  `${sourceDir}/engine.js`,
  `${sourceDir}/pcap-decode.c`,
  `${sourceDir}/benchmark.json`,
  `${sourceDir}/implementation-contract.v1.json`,
  `${sourceDir}/RIGHTS.md`,
  `${sourceDir}/evidence-contract.ts`,
  "scripts/build-base-network-pcap-decode.ts",
  "lib/canonical.ts",
  "deno.json",
  "deno.lock",
  "schemas/base-network-pcap-registration.schema.json",
  "schemas/base-network-pcap-fixture-manifest.schema.json",
  "schemas/base-network-pcap-output-manifest.schema.json",
  "schemas/base-network-pcap-build-manifest.schema.json",
  "schemas/base-network-pcap-correctness-record.schema.json",
] as const;
const sourceGraph = await Promise.all(sourcePaths.map(async (path) => {
  const current = await fileIdentity(path);
  const committed = await new Deno.Command("git", {
    args: ["show", `${sourceCommit}:${path}`],
    cwd: root.pathname,
    stdout: "piped",
    stderr: "piped",
  }).output();
  if (!committed.success || await sha256Hex(committed.stdout) !== current.sha256) {
    throw new Error(`working source does not match ${sourceCommit}:${path}`);
  }
  return current;
}));
const sourceIdentity = sourceGraph.map(({ path, sha256 }) => `${path}\0${sha256}\n`).join("");
const sourceSha256 = await sha256Hex(sourceIdentity);
const lockSha256 = sourceGraph.find((source) => source.path === "deno.lock")!.sha256;

const buildDir = new URL(".build/", artifactDir).pathname;
const artifact = `${buildDir}/pcap-decode.wasm`;
const compilerArgs = [
  "--target=wasm32-unknown-unknown",
  "-O3",
  "-nostdlib",
  "-ffreestanding",
  "-fno-builtin",
  "-c",
  `${sourceDir}/pcap-decode.c`,
  "-o",
  "public/artifacts/base-network-pcap-decode/.build/pcap-decode.o",
];
const linkerArgs = [
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
const compilerExecutionArgs = [...compilerArgs];
compilerExecutionArgs[compilerExecutionArgs.length - 1] = `${buildDir}/pcap-decode.o`;
const linkerExecutionArgs = [...linkerArgs];
linkerExecutionArgs[linkerExecutionArgs.length - 3] = `${buildDir}/pcap-decode.o`;
linkerExecutionArgs[linkerExecutionArgs.length - 1] = artifact;
await Deno.remove(buildDir, { recursive: true }).catch((error) => {
  if (!(error instanceof Deno.errors.NotFound)) throw error;
});
await Deno.mkdir(buildDir, { recursive: true });
try {
  await command("clang", compilerExecutionArgs);
  await command("wasm-ld", linkerExecutionArgs);
  await Deno.writeFile(new URL("pcap-decode.wasm", artifactDir), await Deno.readFile(artifact));
} finally {
  await Deno.remove(buildDir, { recursive: true });
}

const fixture = generatePcapFixture();
await Deno.writeFile(new URL("fixture.pcap", artifactDir), fixture);
const js = runPcapJavaScript(fixture);
await Deno.writeFile(new URL("reference-output.bin", artifactDir), js.bytes);
const wasmBytes = await Deno.readFile(new URL("pcap-decode.wasm", artifactDir));
const instantiated = await WebAssembly.instantiate(wasmBytes);
const exports = instantiated.instance.exports as unknown as {
  memory: WebAssembly.Memory;
  input_ptr(): number;
  output_ptr(): number;
  output_len(): number;
  run(length: number): number;
};
new Uint8Array(exports.memory.buffer, exports.input_ptr(), fixture.length).set(fixture);
if (exports.run(fixture.length) !== 0) throw new Error("Wasm fixture failed");
const wasmOutput = new Uint8Array(
  exports.memory.buffer,
  exports.output_ptr(),
  exports.output_len(),
).slice();
if (
  wasmOutput.length !== js.bytes.length || !wasmOutput.every((value, i) => value === js.bytes[i])
) throw new Error("JavaScript and Wasm canonical outputs differ");

const fixtureSha256 = await sha256Hex(fixture);
const outputSha256 = await sha256Hex(js.bytes);
const artifactSha256 = await sha256Hex(wasmBytes);
if (fixtureSha256 !== "8683e2fc95f0b8940b9dc2c867e08adeccf1a66445d7bf98785ea600ff6d9034") {
  throw new Error(`fixture identity changed: ${fixtureSha256}`);
}
const fixtureManifest = {
  schemaVersion: 1,
  fixtureId: "network-pcap-decode-project-generated-v1",
  frozenCatalogId: "network.pcap-decode.v1",
  generator: `${sourceDir}/fixture.ts`,
  generatorVersion: "pcap-project-generated-v1",
  packetCount: 8,
  bytes: fixture.length,
  sha256: fixtureSha256,
  rights: {
    license: "CC0-1.0",
    redistribution: "permitted",
    provenance: "project-generated reserved-address traffic; no external or sensitive captures",
    grant: `${sourceDir}/RIGHTS.md`,
  },
};
const outputManifest = {
  schemaVersion: 1,
  oracle: "complete canonical flow-table bytes plus exact structural counters",
  bytes: js.bytes.length,
  sha256: outputSha256,
  expectedWords: Array.from(new Uint32Array(js.bytes.buffer)),
  counters: js.counters,
};
await writeJson(new URL("fixture-manifest.json", artifactDir), fixtureManifest);
await writeJson(new URL("output-manifest.json", artifactDir), outputManifest);
const subordinate = await Promise.all([
  "fixture-manifest.json",
  "output-manifest.json",
].map((name) => fileIdentity(`public/artifacts/base-network-pcap-decode/${name}`, generatedRoot)));
const buildManifest = {
  schemaVersion: 1,
  workloadId: "network.pcap-decode.v1",
  supplementalContract: `${sourceDir}/implementation-contract.v1.json`,
  catalogMutation: false,
  sourceRepository: repository,
  sourceCommit,
  sourceSha256,
  variants: ["js-controlled", "wasm-linear-controlled"],
  build: {
    cwd: ".",
    reproductionCommand: "deno task check",
    commands: [`clang ${compilerArgs.join(" ")}`, `wasm-ld ${linkerArgs.join(" ")}`],
    toolchain: [
      { name: "deno", version: Deno.version.deno },
      { name: "clang", version: (await command("clang", ["--version"])).split("\n")[0] },
      { name: "wasm-ld", version: (await command("wasm-ld", ["--version"])).split("\n")[0] },
    ],
    flags: {
      compiler: compilerArgs.slice(0, 5),
      linker: linkerArgs.slice(0, 9),
      runtime: ["scalar Wasm", "fixed initial=max memory", "memory.grow unavailable"],
    },
    lockfiles: [{ path: "deno.lock", sha256: lockSha256 }],
    environment: [],
  },
  wasm: {
    path: "public/artifacts/base-network-pcap-decode/pcap-decode.wasm",
    bytes: wasmBytes.length,
    sha256: artifactSha256,
    initialMemoryBytes: 1_048_576,
    maximumMemoryBytes: 1_048_576,
    simd: false,
    threads: false,
    memoryGrowth: false,
  },
  fixture: {
    path: "public/artifacts/base-network-pcap-decode/fixture.pcap",
    bytes: fixture.length,
    sha256: fixtureSha256,
  },
  referenceOutput: {
    path: "public/artifacts/base-network-pcap-decode/reference-output.bin",
    bytes: js.bytes.length,
    sha256: outputSha256,
  },
  manifests: subordinate,
  fullSourceGraph: sourceGraph,
};
const buildManifestBytes = await writeJson(buildManifestUrl, buildManifest);
const buildManifestSha256 = await sha256Hex(buildManifestBytes);

for (
  const [variantId, target, counters] of [
    ["js-controlled", "javascript", { ...js.counters, boundaryCrossings: 0 }],
    ["wasm-linear-controlled", "wasm-linear", {
      ...js.counters,
      allocations: 0,
      boundaryCrossings: 1,
    }],
  ] as const
) {
  await writeJson(new URL(`${variantId}.json`, evidenceDir), {
    schemaVersion: 1,
    status: "supplemental-base-v1-correctness-validation-candidate",
    workloadId: "network.pcap-decode.v1",
    variantId,
    target,
    sourceCommit,
    performanceClaims: [],
    input: { bytes: fixture.length, sha256: fixtureSha256 },
    completeOutput: { bytes: js.bytes.length, sha256: outputSha256, equality: "byte-exact" },
    structuralChecks: {
      packetRecords: 8,
      protocolsMateriallyExercised: ["Ethernet", "IPv4", "TCP", "UDP", "DNS", "HTTP/1.1"],
      malformedCases: ["truncated Ethernet", "IPv4 fragmentation", "IPv4 total-length overrun"],
      tcpReassembly: "two contiguous request segments",
      dnsCompressionPointers: 1,
      canonicalFlows: 4,
    },
    counters,
    buildManifest: {
      path: "public/artifacts/base-network-pcap-decode/build-manifest.json",
      sha256: buildManifestSha256,
    },
  });
}
const generatedPaths = [
  "public/artifacts/base-network-pcap-decode/pcap-decode.wasm",
  "public/artifacts/base-network-pcap-decode/fixture.pcap",
  "public/artifacts/base-network-pcap-decode/reference-output.bin",
  "public/artifacts/base-network-pcap-decode/fixture-manifest.json",
  "public/artifacts/base-network-pcap-decode/output-manifest.json",
  "public/artifacts/base-network-pcap-decode/build-manifest.json",
  "public/evidence/base-v1/network-pcap-decode/js-controlled.json",
  "public/evidence/base-v1/network-pcap-decode/wasm-linear-controlled.json",
];
if (checkMode) {
  try {
    for (const path of generatedPaths) {
      const generated = await Deno.readFile(new URL(path, generatedRoot));
      const published = await Deno.readFile(new URL(path, root));
      if (
        generated.byteLength !== published.byteLength ||
        await sha256Hex(generated) !== await sha256Hex(published)
      ) throw new Error(`PCAP reproduction drift: ${path}`);
    }
  } finally {
    await Deno.remove(generatedRoot, { recursive: true });
  }
}
console.log(
  `network.pcap-decode.v1: ${fixtureSha256} -> ${outputSha256}; wasm ${artifactSha256}${
    checkMode ? "; 8 files reproduced" : ""
  }`,
);
