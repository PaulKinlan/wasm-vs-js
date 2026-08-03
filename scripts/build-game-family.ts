import wabtFactory from "wabt";
import { canonicalize, sha256Hex } from "../lib/canonical.ts";
import { GAME_IDS, generateFixture } from "../benchmarks/v2/game-family/fixtures.js";
import {
  instantiateGameWasm,
  runGameJavaScript,
  runGameWasmHybrid,
} from "../benchmarks/v2/game-family/engine.js";

const root = new URL("../", import.meta.url);
const artifactDir = new URL("public/artifacts/game-v2-controlled-family/", root);
const evidenceDir = new URL("public/evidence/v2-proposals/games/", root);
await Deno.mkdir(artifactDir, { recursive: true });
await Deno.mkdir(evidenceDir, { recursive: true });

const watPath = "benchmarks/v2/game-family/game-family.wat";
const wat = await Deno.readTextFile(new URL(watPath, root));
const wabt = await wabtFactory();
const module = wabt.parseWat("game-family.wat", wat, {
  exceptions: false,
  threads: false,
  simd: false,
});
module.resolveNames();
module.validate();
const binary = module.toBinary({
  canonicalize_lebs: true,
  relocatable: false,
  write_debug_names: false,
});
module.destroy();
const wasm = new Uint8Array(binary.buffer);
await Deno.writeFile(new URL("game-family.wasm", artifactDir), wasm);

const sources = [];
for (
  const path of [
    "benchmarks/v2/game-family/fixtures.js",
    "benchmarks/v2/game-family/engine.js",
    watPath,
    "benchmarks/v2/game-family/implementation-contract.v1.json",
    "scripts/build-game-family.ts",
    "deno.lock",
  ]
) {
  const bytes = await Deno.readFile(new URL(path, root));
  sources.push({ path, bytes: bytes.byteLength, sha256: await sha256Hex(bytes) });
}
const fixtures = [];
const runtime = await instantiateGameWasm(wasm);
const records = [];
for (const id of GAME_IDS) {
  const fixture = generateFixture(id);
  const slug = id.replaceAll(".", "-");
  await Deno.writeFile(new URL(`${slug}.bin`, artifactDir), fixture);
  const fixtureSha256 = await sha256Hex(fixture);
  fixtures.push({
    workloadId: id,
    path: `/artifacts/game-v2-controlled-family/${slug}.bin`,
    bytes: fixture.byteLength,
    sha256: fixtureSha256,
    generation: "xorshift32 with the ID's frozen seed and canonical little-endian serialization",
  });
  const js = runGameJavaScript(id, fixture);
  const wasmResult = runGameWasmHybrid(id, runtime, fixture);
  if (
    canonicalize({ ...js, variantId: null, executionTarget: null }) !==
      canonicalize({ ...wasmResult, variantId: null, executionTarget: null })
  ) throw new Error(`${id} target mismatch`);
  for (const result of [js, wasmResult]) {
    const record = {
      schemaVersion: 1,
      status: "proposal-validation-only",
      workload: { entryId: id, familyId: "game-v2-controlled-family" },
      variant: { id: result.variantId, executionTarget: result.executionTarget },
      input: { bytes: fixture.byteLength, sha256: fixtureSha256 },
      oracle: {
        policy: "exact",
        digest: result.digest,
        fixtureDigest: result.fixtureDigest.toString(16).padStart(8, "0"),
        semanticDigest: result.semanticDigest.toString(16).padStart(8, "0"),
        checkpoints: result.checkpoints,
        visual: result.visual,
      },
      counters: result.counters,
      validation: {
        completeOutput: "pass",
        structuralInvariants: "pass",
        workCounters: "pass",
        crossTargetEquivalence: "pass",
      },
      timing: {
        status: "not-collected",
        reason: "This deterministic proposal-validation record does not collect durations.",
      },
      performanceClaims: [],
    };
    const name = `${slug}-${result.variantId}.json`;
    const recordText = `${JSON.stringify(record, null, 2)}\n`;
    await Deno.writeTextFile(new URL(name, evidenceDir), recordText);
    records.push({
      workloadId: id,
      variantId: result.variantId,
      path: `/evidence/v2-proposals/games/${name}`,
      sha256: await sha256Hex(recordText),
    });
  }
}
const manifest = {
  schemaVersion: 1,
  familyId: "game-v2-controlled-family",
  sourceRepository: "https://github.com/PaulKinlan/wasm-vs-js",
  sourceRevision: "bound by the immutable implementation inventory link",
  reproducibleCommand: "deno task build:games",
  toolchain: [`Deno ${Deno.version.deno}`, "wabt 1.0.37"],
  flags: [
    "scalar",
    "threads=false",
    "simd=false",
    "fixed memory initial=4 maximum=4",
    "canonicalize_lebs=true",
    "write_debug_names=false",
  ],
  wasm: {
    path: "/artifacts/game-v2-controlled-family/game-family.wasm",
    bytes: wasm.byteLength,
    sha256: await sha256Hex(wasm),
    features: { linearMemory: true, threads: false, simd: false, memoryGrowth: false },
  },
  fixtures,
  validationRecords: records,
  sources,
  sourceSha256: await sha256Hex(
    sources.map((source) => `${source.path}\0${source.sha256}\n`).join(""),
  ),
  performanceClaims: [],
};
await Deno.writeTextFile(
  new URL("build-manifest.json", artifactDir),
  `${canonicalize(manifest)}\n`,
);
console.log(
  `build: game family ${wasm.byteLength} byte Wasm, ${fixtures.length} fixtures, ${records.length} validation records`,
);
