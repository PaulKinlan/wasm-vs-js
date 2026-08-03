import { sha256Hex } from "../lib/canonical.ts";
import { fixtureParameters, generateDirtyStl } from "../benchmarks/base/cad-mesh-repair/fixture.js";
import {
  instantiateMeshWasm,
  repairMeshJavaScript,
  repairMeshWasm,
} from "../benchmarks/base/cad-mesh-repair/engine.js";

const root = new URL("../", import.meta.url);
const out = new URL("public/artifacts/cad-mesh-repair-v1/", root);
await Deno.mkdir(out, { recursive: true });
async function cmd(name: string, args: string[]) {
  const r = await new Deno.Command(name, {
    args,
    cwd: root.pathname,
    stdout: "piped",
    stderr: "piped",
  }).output();
  if (!r.success) throw new Error(new TextDecoder().decode(r.stderr));
  return new TextDecoder().decode(r.stdout).trim();
}
const object = new URL("mesh-repair.o", out).pathname;
const temporaryWasmPath = new URL(".mesh-repair.build.wasm", out).pathname;
const wasmUrl = new URL("mesh-repair.wasm", out);
await cmd("clang", [
  "--target=wasm32-unknown-unknown",
  "-O3",
  "-nostdlib",
  "-ffreestanding",
  "-fno-builtin",
  "-fno-fast-math",
  "-c",
  "benchmarks/base/cad-mesh-repair/mesh-repair.c",
  "-o",
  object,
]);
await cmd("wasm-ld", [
  "--no-entry",
  "--export-memory",
  "--export=input_ptr",
  "--export=output_ptr",
  "--export=run",
  "--initial-memory=1048576",
  "--max-memory=1048576",
  "--stack-first",
  object,
  "-o",
  temporaryWasmPath,
]);
await Deno.remove(object);
const fixture = generateDirtyStl();
await Deno.writeFile(new URL("dirty-grid.stl", out), fixture);
const wasm = await Deno.readFile(temporaryWasmPath);
await Deno.remove(temporaryWasmPath);
await Deno.writeFile(wasmUrl, wasm);
const js = repairMeshJavaScript(fixture);
const runtime = await instantiateMeshWasm(wasm);
const wr = repairMeshWasm(runtime, fixture);
if (await sha256Hex(js.bytes) !== await sha256Hex(wr.bytes)) {
  throw new Error("complete JS/Wasm output mismatch");
}
const contractBytes = await Deno.readFile(
  new URL("benchmarks/base/cad-mesh-repair/implementation-contract.v1.json", root),
);
const sourcePaths = [
  "benchmarks/base/cad-mesh-repair/fixture.js",
  "benchmarks/base/cad-mesh-repair/engine.js",
  "benchmarks/base/cad-mesh-repair/mesh-repair.c",
  "benchmarks/base/cad-mesh-repair/implementation-contract.v1.json",
  "scripts/build-cad-mesh-repair.ts",
  "deno.json",
  "deno.lock",
];
const sources = [];
for (const path of sourcePaths) {
  const bytes = await Deno.readFile(new URL(path, root));
  sources.push({ path, bytes: bytes.length, sha256: await sha256Hex(bytes) });
}
const manifest = {
  schemaVersion: 1,
  catalogId: "cad.mesh-repair.v1",
  status: "supplemental-validation-package",
  frozenCatalog: {
    path: "catalog/workloads.v1.json",
    sha256: "6665664f984683e5b7d3fdc8c1602198124844704c224a526d48be2f02edf9d4",
    immutability: "byte-for-byte",
  },
  fixture: {
    path: "public/artifacts/cad-mesh-repair-v1/dirty-grid.stl",
    bytes: fixture.length,
    sha256: await sha256Hex(fixture),
    parameters: fixtureParameters,
    rights: {
      license: "CC0-1.0",
      redistribution: "permitted",
      origin: "generated solely by fixture.js",
    },
  },
  artifact: {
    path: "public/artifacts/cad-mesh-repair-v1/mesh-repair.wasm",
    bytes: wasm.length,
    sha256: await sha256Hex(wasm),
    memory: { initialPages: 16, maximumPages: 16 },
  },
  contract: {
    path: "benchmarks/base/cad-mesh-repair/implementation-contract.v1.json",
    bytes: contractBytes.length,
    sha256: await sha256Hex(contractBytes),
  },
  build: {
    deno: "2.9.0",
    clang: await cmd("clang", ["--version"]).then((x) => x.split("\n")[0]),
    linker: await cmd("wasm-ld", ["--version"]),
    command:
      "deno run --allow-read=. --allow-write=public/artifacts --allow-run=clang,wasm-ld scripts/build-cad-mesh-repair.ts",
    flags: [
      "--target=wasm32-unknown-unknown",
      "-O3",
      "-nostdlib",
      "-ffreestanding",
      "-fno-builtin",
      "-fno-fast-math",
      "fixed memory 16 pages",
    ],
  },
  sources,
  oracle: {
    completeOutputSha256: await sha256Hex(js.bytes),
    bytes: js.bytes.length,
    invariants: js.invariants,
    jsCounters: js.counters,
    wasmCounters: wr.counters,
    crossTargetCompleteBytesEqual: true,
  },
  performanceClaims: [],
};
await Deno.writeTextFile(
  new URL("build-manifest.json", out),
  `${JSON.stringify(manifest, null, 2)}\n`,
);
console.log(
  `cad mesh: ${fixture.length} input bytes, ${wasm.length} Wasm bytes, ${js.bytes.length} output bytes, ${manifest.oracle.completeOutputSha256}`,
);
