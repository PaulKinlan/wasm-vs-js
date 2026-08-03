import { canonicalize, sha256Hex } from "../lib/canonical.ts";
import {
  generateFixture,
  GRID_TRACE_LIFECYCLE,
  instantiateGridWasm,
  normalizeForEquivalence,
  runJavaScript,
  runWasm,
} from "../benchmarks/base/dom-virtualized-grid/engine.js";

const root = new URL("../", import.meta.url);
const output = new URL("public/artifacts/dom-virtualized-grid-v1/", root);
await Deno.mkdir(output, { recursive: true });

async function run(name: string, args: string[]) {
  const result = await new Deno.Command(name, {
    cwd: root,
    args,
    stdout: "piped",
    stderr: "piped",
  }).output();
  if (!result.success) throw new Error(new TextDecoder().decode(result.stderr));
  return new TextDecoder().decode(result.stdout).trim();
}

const buildDir = new URL(".build/", output).pathname;
await Deno.remove(buildDir, { recursive: true }).catch((error) => {
  if (!(error instanceof Deno.errors.NotFound)) throw error;
});
await Deno.mkdir(buildDir, { recursive: true });
try {
  await run("clang", [
    "--target=wasm32-unknown-unknown",
    "-O3",
    "-nostdlib",
    "-ffreestanding",
    "-fno-builtin",
    "-c",
    "benchmarks/base/dom-virtualized-grid/grid.c",
    "-o",
    `${buildDir}grid.o`,
  ]);
  await run("wasm-ld", [
    "--no-entry",
    "--export-memory",
    "--export=input_ptr",
    "--export=result_ptr",
    "--export=prepare",
    "--export=run_event",
    "--export=finish",
    "--initial-memory=16777216",
    "--max-memory=16777216",
    "--stack-first",
    `${buildDir}grid.o`,
    "-o",
    `${buildDir}grid.wasm`,
  ]);
  await Deno.writeFile(new URL("grid.wasm", output), await Deno.readFile(`${buildDir}grid.wasm`));
} finally {
  await Deno.remove(buildDir, { recursive: true });
}

const fixture = generateFixture();
await Deno.writeFile(new URL("fixture.bin", output), fixture);
await Deno.copyFile(
  new URL("benchmarks/base/dom-virtualized-grid/implementation-contract.v1.json", root),
  new URL("implementation-contract.v1.json", output),
);
const wasmBytes = await Deno.readFile(new URL("grid.wasm", output));
const js = runJavaScript(fixture);
const wasm = runWasm(await instantiateGridWasm(wasmBytes), fixture);
if (js.commandDigest !== wasm.commandDigest || js.commands.length !== wasm.commands.length) {
  throw new Error("JavaScript/Wasm complete command output mismatch");
}
for (let index = 0; index < js.commands.length; index += 1) {
  if (js.commands[index] !== wasm.commands[index]) throw new Error(`command mismatch at ${index}`);
}
const left = normalizeForEquivalence(js);
const right = normalizeForEquivalence(wasm);
for (const key of Object.keys(left.counters)) {
  if (left.counters[key] !== right.counters[key]) throw new Error(`counter mismatch: ${key}`);
}
if (canonicalize(left.checkpoints) !== canonicalize(right.checkpoints)) {
  throw new Error("checkpoint mismatch");
}

const commandBytes = new Uint8Array(
  js.commands.buffer,
  js.commands.byteOffset,
  js.commands.byteLength,
);
const sourcePaths = [
  "benchmarks/base/dom-virtualized-grid/implementation-contract.v1.json",
  "benchmarks/base/dom-virtualized-grid/engine.js",
  "benchmarks/base/dom-virtualized-grid/grid.c",
  "scripts/build-dom-virtualized-grid.ts",
  "public/benchmarks/index.html",
  "public/benchmarks/dom-virtualized-grid-v1/index.html",
  "public/benchmarks/dom-virtualized-grid-v1/grid.css",
  "public/benchmarks/dom-virtualized-grid-v1/grid-runner.js",
  "public/benchmarks/dom-virtualized-grid-v1/grid-worker.js",
  "scripts/validate-dom-virtualized-grid-browser.ts",
  "schemas/base-implementation-candidate.schema.json",
  "tests/base/dom-virtualized-grid.test.ts",
  "catalog/base-implementation-candidates.v1.json",
  "server.ts",
  "deno.json",
  "deno.lock",
];
const sources = [];
for (const path of sourcePaths) {
  const bytes = await Deno.readFile(new URL(path, root));
  sources.push({ path, bytes: bytes.byteLength, sha256: await sha256Hex(bytes) });
}
const contractBytes = await Deno.readFile(new URL("implementation-contract.v1.json", output));
const fixtureManifest = {
  schemaVersion: 1,
  workloadId: "dom.virtualized-grid.v1",
  immutable: true,
  licenseSpdx: "CC0-1.0",
  redistribution: "permitted",
  provenance: "Generated entirely by benchmarks/base/dom-virtualized-grid/engine.js.",
  generator: { id: "xorshift32-v1", seed: 0x6d2b79f5, rows: 100000, actions: 300 },
  fixture: {
    path: "public/artifacts/dom-virtualized-grid-v1/fixture.bin",
    bytes: fixture.byteLength,
    sha256: await sha256Hex(fixture),
  },
};
await Deno.writeTextFile(
  new URL("fixture-manifest.json", output),
  `${canonicalize(fixtureManifest)}\n`,
);
function browserDomOracle(commands: Uint32Array) {
  const slots: Array<
    null | {
      id: string;
      rowId: number;
      score: number;
      rowIndex: number;
      selected: boolean;
      text: string;
      role: string;
      tabIndex: number;
    }
  > = Array(28).fill(null);
  const order: number[] = [];
  let activeDescendant: string | null = null;
  for (let at = 0; at < commands.length; at += 6) {
    const [op, slot, b, c, d, e] = commands.subarray(at, at + 6);
    if (op === 1 || op === 2 || op === 3) {
      slots[slot] = {
        id: `grid-row-${b}`,
        rowId: b,
        score: d | 0,
        rowIndex: c + 1,
        selected: Boolean(e),
        text: `Row ${b} · score ${d | 0} · position ${c + 1}`,
        role: "row",
        tabIndex: -1,
      };
    } else if (op === 4) {
      const previous = order.indexOf(slot);
      if (previous >= 0) order.splice(previous, 1);
      order.push(slot);
    } else if (op === 5) {
      const previous = order.indexOf(slot);
      if (previous >= 0) order.splice(previous, 1);
      if (activeDescendant === slots[slot]?.id) activeDescendant = null;
    } else if (op === 6) {
      activeDescendant = slots[slot]?.id ?? null;
    }
  }
  const rows = order.map((slot) => slots[slot]);
  return {
    role: "grid",
    rowCount: 100000,
    activeDescendant,
    activeElement: activeDescendant,
    selectedRow: rows.find((row) => row?.selected)?.rowId ?? null,
    rows,
  };
}

function traceOracle(fixtureBytes: Uint8Array, commands: Uint32Array) {
  const view = new DataView(
    fixtureBytes.buffer,
    fixtureBytes.byteOffset,
    fixtureBytes.byteLength,
  );
  const filteredLengths: number[] = [];
  for (let at = 0; at < commands.length; at += 6) {
    if (commands[at] === 7) filteredLengths.push(commands[at + 5]);
  }
  const scheduledOffsetsMs: number[] = [];
  const scrollOffsetsCssPx: number[] = [];
  let scrollOffset = 0;
  for (let action = 0; action < 300; action += 1) {
    const at = 64 + 100_000 * 16 + action * 16;
    const eventType = view.getUint32(at + 4, true);
    const a = view.getUint32(at + 8, true);
    if (eventType === 0) {
      scrollOffset = Math.min(a, Math.max(0, filteredLengths[action] - 20) * 24);
    } else if (eventType === 1) {
      scrollOffset = 0;
    }
    scheduledOffsetsMs.push(action * 100);
    scrollOffsetsCssPx.push(scrollOffset);
  }
  return { scheduledOffsetsMs, scrollOffsetsCssPx };
}

const expectedBrowserDom = browserDomOracle(js.commands);
const expectedTrace = traceOracle(fixture, js.commands);
const phaseTopology = {
  manifestDecodePhase: "transfer",
  javascript: {
    loadLabels: [
      "/artifacts/dom-virtualized-grid-v1/build-manifest.json:request",
      "build-manifest:parse",
      "/artifacts/dom-virtualized-grid-v1/fixture.bin:request",
      "fixture:sha256",
      "build-manifest:sha256",
    ],
    transferLabels: [
      "/artifacts/dom-virtualized-grid-v1/build-manifest.json:body",
      "build-manifest:decode",
      "/artifacts/dom-virtualized-grid-v1/fixture.bin:body",
    ],
    instantiateLabels: [],
  },
  wasmLinear: {
    loadLabels: [
      "/artifacts/dom-virtualized-grid-v1/build-manifest.json:request",
      "build-manifest:parse",
      "/artifacts/dom-virtualized-grid-v1/fixture.bin:request",
      "fixture:sha256",
      "/artifacts/dom-virtualized-grid-v1/grid.wasm:request",
      "wasm:sha256",
      "build-manifest:sha256",
    ],
    transferLabels: [
      "/artifacts/dom-virtualized-grid-v1/build-manifest.json:body",
      "build-manifest:decode",
      "/artifacts/dom-virtualized-grid-v1/fixture.bin:body",
      "/artifacts/dom-virtualized-grid-v1/grid.wasm:body",
    ],
    instantiateLabels: ["wasm:instantiate"],
  },
};
const expectedBrowserDomSha256 = await sha256Hex(
  new TextEncoder().encode(JSON.stringify(expectedBrowserDom)),
);
const outputManifest = {
  schemaVersion: 1,
  workloadId: "dom.virtualized-grid.v1",
  status: "implementation-candidate",
  oracle: "complete exact typed command stream plus checkpoints and operative counters",
  commandStream: {
    words: js.commands.length,
    commands: js.counters.commands,
    fnv1a32: js.commandDigest,
    sha256: await sha256Hex(commandBytes),
  },
  checkpoints: js.checkpoints,
  counters: { javascript: js.counters, wasmLinear: wasm.counters },
  fixture: js.fixture,
  final: js.final,
  structural: { maximumMountedRows: 28, commandWidthU32: 6, events: 300, rows: 100000 },
  browserDom: { state: expectedBrowserDom, jsonSha256: expectedBrowserDomSha256 },
  phaseTopology,
  trace: {
    ...expectedTrace,
    lifecycle: GRID_TRACE_LIFECYCLE,
  },
  performanceClaims: [],
};
await Deno.writeTextFile(
  new URL("output-manifest.json", output),
  `${canonicalize(outputManifest)}\n`,
);
const fixtureManifestBytes = await Deno.readFile(new URL("fixture-manifest.json", output));
const outputManifestBytes = await Deno.readFile(new URL("output-manifest.json", output));
const buildManifest = {
  schemaVersion: 1,
  registrationId: "base-dom-virtualized-grid-controlled-v1",
  workloadId: "dom.virtualized-grid.v1",
  frozenCatalog: {
    path: "catalog/workloads.v1.json",
    sha256: "6665664f984683e5b7d3fdc8c1602198124844704c224a526d48be2f02edf9d4",
    mutation: "none",
  },
  source: {
    repository: "https://github.com/PaulKinlan/wasm-vs-js",
    binding: "complete content-hashed source graph",
    files: sources,
  },
  build: {
    command:
      "deno run --allow-read=. --allow-write=public/artifacts/dom-virtualized-grid-v1 --allow-run=clang,wasm-ld scripts/build-dom-virtualized-grid.ts",
    deno: Deno.version.deno,
    clang: (await run("clang", ["--version"])).split("\n")[0],
    linker: await run("wasm-ld", ["--version"]),
    compilerFlags: [
      "--target=wasm32-unknown-unknown",
      "-O3",
      "-nostdlib",
      "-ffreestanding",
      "-fno-builtin",
    ],
    linkerFlags: [
      "--no-entry",
      "--initial-memory=16777216",
      "--max-memory=16777216",
      "--stack-first",
    ],
  },
  artifacts: {
    wasm: {
      path: "public/artifacts/dom-virtualized-grid-v1/grid.wasm",
      bytes: wasmBytes.byteLength,
      sha256: await sha256Hex(wasmBytes),
    },
    fixture: {
      path: "public/artifacts/dom-virtualized-grid-v1/fixture.bin",
      bytes: fixture.byteLength,
      sha256: await sha256Hex(fixture),
    },
    contract: {
      path: "public/artifacts/dom-virtualized-grid-v1/implementation-contract.v1.json",
      bytes: contractBytes.byteLength,
      sha256: await sha256Hex(contractBytes),
    },
    fixtureManifest: {
      path: "public/artifacts/dom-virtualized-grid-v1/fixture-manifest.json",
      bytes: fixtureManifestBytes.byteLength,
      sha256: await sha256Hex(fixtureManifestBytes),
    },
    outputManifest: {
      path: "public/artifacts/dom-virtualized-grid-v1/output-manifest.json",
      bytes: outputManifestBytes.byteLength,
      sha256: await sha256Hex(outputManifestBytes),
    },
  },
  features: {
    simd: false,
    threads: false,
    exceptions: false,
    memoryGrowth: false,
    initialMemoryBytes: 16777216,
    maximumMemoryBytes: 16777216,
  },
};
await Deno.writeTextFile(
  new URL("build-manifest.json", output),
  `${canonicalize(buildManifest)}\n`,
);
console.log(
  `grid: ${fixture.byteLength} fixture bytes; ${wasmBytes.byteLength} Wasm bytes; ${js.counters.commands} exact DOM commands`,
);
