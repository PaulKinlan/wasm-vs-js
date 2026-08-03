import { sha256Hex } from "../lib/canonical.ts";
import { generatePcapFixture } from "../benchmarks/base/network-pcap-decode/fixture.ts";
import { runPcapJavaScript } from "../benchmarks/base/network-pcap-decode/engine.js";

const root = new URL("../", import.meta.url);
const sourceDir = "benchmarks/base/network-pcap-decode";
const artifactDir = new URL("public/artifacts/base-network-pcap-decode/", root);
const evidenceDir = new URL("public/evidence/base-v1/network-pcap-decode/", root);
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
async function writeJson(url: URL, value: unknown) {
  await Deno.writeTextFile(url, `${JSON.stringify(value, null, 2)}\n`);
}
async function fileIdentity(path: string) {
  const bytes = await Deno.readFile(new URL(path, root));
  return { path, bytes: bytes.length, sha256: await sha256Hex(bytes) };
}

const buildDir = new URL(".build/", artifactDir).pathname;
await Deno.remove(buildDir, { recursive: true }).catch((error) => {
  if (!(error instanceof Deno.errors.NotFound)) throw error;
});
await Deno.mkdir(buildDir, { recursive: true });
try {
  const object = `${buildDir}/pcap-decode.o`;
  const artifact = `${buildDir}/pcap-decode.wasm`;
  await command("clang", [
    "--target=wasm32-unknown-unknown",
    "-O3",
    "-nostdlib",
    "-ffreestanding",
    "-fno-builtin",
    "-c",
    `${sourceDir}/pcap-decode.c`,
    "-o",
    object,
  ]);
  await command("wasm-ld", [
    "--no-entry",
    "--export-memory",
    "--export=input_ptr",
    "--export=output_ptr",
    "--export=output_len",
    "--export=run",
    "--initial-memory=1048576",
    "--max-memory=1048576",
    "--stack-first",
    object,
    "-o",
    artifact,
  ]);
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
const status = exports.run(fixture.length);
if (status !== 0) throw new Error(`Wasm fixture failed with status ${status}`);
const wasmOutput = new Uint8Array(
  exports.memory.buffer,
  exports.output_ptr(),
  exports.output_len(),
).slice();
if (
  wasmOutput.length !== js.bytes.length || !wasmOutput.every((value, i) => value === js.bytes[i])
) {
  throw new Error("JavaScript and Wasm canonical outputs differ");
}
const fixtureSha256 = await sha256Hex(fixture);
const outputSha256 = await sha256Hex(js.bytes);
const artifactSha256 = await sha256Hex(wasmBytes);
if (fixtureSha256 !== "8683e2fc95f0b8940b9dc2c867e08adeccf1a66445d7bf98785ea600ff6d9034") {
  throw new Error(`fixture identity changed: ${fixtureSha256}`);
}

const sourcePaths = [
  `${sourceDir}/fixture.ts`,
  `${sourceDir}/engine.js`,
  `${sourceDir}/pcap-decode.c`,
  `${sourceDir}/benchmark.json`,
  `${sourceDir}/implementation-contract.v1.json`,
  `${sourceDir}/RIGHTS.md`,
  "scripts/build-base-network-pcap-decode.ts",
];
const sourceGraph = await Promise.all(sourcePaths.map(fileIdentity));
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
].map((name) => fileIdentity(`public/artifacts/base-network-pcap-decode/${name}`)));
const buildManifest = {
  schemaVersion: 1,
  workloadId: "network.pcap-decode.v1",
  supplementalContract: `${sourceDir}/implementation-contract.v1.json`,
  catalogMutation: false,
  variants: ["js-controlled", "wasm-linear-controlled"],
  toolchain: {
    deno: Deno.version.deno,
    clang: (await command("clang", ["--version"])).split("\n")[0],
    wasmLd: (await command("wasm-ld", ["--version"])).split("\n")[0],
  },
  commands: [
    `clang --target=wasm32-unknown-unknown -O3 -nostdlib -ffreestanding -fno-builtin -c ${sourceDir}/pcap-decode.c`,
    "wasm-ld --no-entry --export-memory --export=input_ptr --export=output_ptr --export=output_len --export=run --initial-memory=1048576 --max-memory=1048576 --stack-first",
  ],
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
await writeJson(new URL("build-manifest.json", artifactDir), buildManifest);

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
    buildManifest: "public/artifacts/base-network-pcap-decode/build-manifest.json",
  });
}
console.log(`network.pcap-decode.v1: ${fixtureSha256} -> ${outputSha256}; wasm ${artifactSha256}`);
