// scripts/generate-all-wat-kernels.ts
// Generates, annotates, and compiles .wat source files and .wasm binaries for every
// multilang manifest and standalone kernel across the benchmark suite.

import wabtFactory from "wabt";

const ROOT = new URL("../", import.meta.url).pathname;
const wabt = await wabtFactory();

console.log("Initializing WAT kernel generation across all benchmarks...");

// 1. fft-kernel.manifest.json wiring
{
  const mPath = `${ROOT}public/benchmarks/multilang-wasm/fft-kernel.manifest.json`;
  const m = JSON.parse(await Deno.readTextFile(mPath));
  if (!m.engines.some((e: { key: string }) => e.key === "wat")) {
    m.engines.splice(1, 0, {
      key: "wat",
      label: "Raw WAT",
      kind: "linear",
      lang: "wat",
      offset: 0,
      files: {
        fft: "fft_wat.wasm",
      },
      source: "",
    });
    await Deno.writeTextFile(mPath, JSON.stringify(m, null, 2) + "\n");
    console.log("Wired wat into fft-kernel.manifest.json");
  }
}

// 2. All multilang manifests missing wat
const generatedFiles: string[] = [];

for await (const entry of Deno.readDir(`${ROOT}public/benchmarks/multilang-wasm`)) {
  if (!entry.name.endsWith(".manifest.json")) continue;
  const mPath = `${ROOT}public/benchmarks/multilang-wasm/${entry.name}`;
  const m = JSON.parse(await Deno.readTextFile(mPath));
  if (m.engines.some((e: { key: string }) => e.key === "wat")) continue;

  const cEng = m.engines.find((e: { key: string }) => e.key === "c");
  if (!cEng) {
    console.warn(`Skipping ${entry.name}: no C engine found`);
    continue;
  }

  const kernel = m.kernels[0];
  const cFile: string = cEng.file ?? cEng.files?.[kernel] ?? `${kernel}_c.wasm`;
  const cWasmPath = `${ROOT}public/artifacts/multilang-wasm-benchmark/${cFile}`;

  let cBytes: Uint8Array;
  try {
    cBytes = await Deno.readFile(cWasmPath);
  } catch (err) {
    console.error(`Could not read ${cWasmPath}: ${err}`);
    continue;
  }

  // Disassemble to clean, formatted WAT
  const mod = wabt.readWasm(cBytes, { readDebugNames: true });
  mod.generateNames();
  mod.applyNames();
  const watBody = mod.toText({ foldExprs: false, inlineExport: false });

  const watHeader = `;; ${m.workloadId ?? entry.name} — kernel: ${kernel}
;; WebAssembly Text (WAT) baseline implementation
;; Exports: ${kernel}

`;
  const fullWat = watHeader + watBody;

  // Determine subdir and wat filename
  const slug = entry.name.replace(".manifest.json", "");
  const watDir = `${ROOT}benchmarks/multilang-wasm/${slug}`;
  await Deno.mkdir(watDir, { recursive: true });

  const watName = `${kernel}.wat`;
  const watPath = `${watDir}/${watName}`;
  await Deno.writeTextFile(watPath, fullWat);

  // Compile back to wasm using wabt.parseWat
  const parsed = wabt.parseWat(watName, fullWat);
  const { buffer: wasmBuffer } = parsed.toBinary({});

  const watWasmFile = cFile.includes("_c.wasm")
    ? cFile.replace("_c.wasm", "_wat.wasm")
    : `${kernel}_wat.wasm`;
  const outWasmPath = `${ROOT}public/artifacts/multilang-wasm-benchmark/${watWasmFile}`;
  await Deno.writeFile(outWasmPath, wasmBuffer);
  generatedFiles.push(watWasmFile);

  // Wire into manifest
  const watEngine: Record<string, unknown> = {
    key: "wat",
    label: "Raw WAT",
    kind: "linear",
    lang: "wat",
    offset: cEng.offset ?? 0,
    files: {
      [kernel]: watWasmFile,
    },
    source: "",
  };
  if (typeof cEng.initialMemoryBytes === "number") {
    watEngine.initialMemoryBytes = cEng.initialMemoryBytes;
  }

  m.engines.splice(1, 0, watEngine);
  await Deno.writeTextFile(mPath, JSON.stringify(m, null, 2) + "\n");
  console.log(`Generated & wired WAT for ${entry.name} -> ${watWasmFile}`);
}

// 3. Standalone algorithmic kernels
// dom-virtualized-scrolling
{
  const cBytes = await Deno.readFile(
    `${ROOT}public/artifacts/dom-virtualized-scrolling/dom_vscroll.wasm`,
  );
  const mod = wabt.readWasm(cBytes, { readDebugNames: true });
  mod.generateNames();
  mod.applyNames();
  const wat = `;; dom.virtualized-scrolling.v1 — compute_windows
;; WebAssembly Text (WAT) baseline for virtualized DOM list scrolling

` + mod.toText({ foldExprs: false, inlineExport: false });
  await Deno.writeTextFile(
    `${ROOT}benchmarks/dom-virtualized-scrolling/dom-virtualized-scrolling.wat`,
    wat,
  );
  const parsed = wabt.parseWat("dom_vscroll.wat", wat);
  await Deno.writeFile(
    `${ROOT}public/artifacts/multilang-wasm-benchmark/dom_vscroll_wat.wasm`,
    parsed.toBinary({}).buffer,
  );
  generatedFiles.push("dom_vscroll_wat.wasm");
  console.log("Generated benchmarks/dom-virtualized-scrolling/dom-virtualized-scrolling.wat");
}

// network-http2-quic-state
{
  const cBytes = await Deno.readFile(
    `${ROOT}public/artifacts/network-http2-quic-state/network-http2-quic-state.wasm`,
  );
  const mod = wabt.readWasm(cBytes, { readDebugNames: true });
  mod.generateNames();
  mod.applyNames();
  const wat = `;; network.http2-quic-state.v1 — protocol state machine
;; WebAssembly Text (WAT) baseline for HTTP/2 & QUIC stream state tracking

` + mod.toText({ foldExprs: false, inlineExport: false });
  await Deno.writeTextFile(
    `${ROOT}benchmarks/v1/network-http2-quic-state/network-http2-quic-state.wat`,
    wat,
  );
  const parsed = wabt.parseWat("quic_state.wat", wat);
  await Deno.writeFile(
    `${ROOT}public/artifacts/multilang-wasm-benchmark/quic_state_wat.wasm`,
    parsed.toBinary({}).buffer,
  );
  generatedFiles.push("quic_state_wat.wasm");
  console.log("Generated benchmarks/v1/network-http2-quic-state/network-http2-quic-state.wat");
}

// tooling-c-to-wasm-compile
{
  const cBytes = await Deno.readFile(
    `${ROOT}public/artifacts/base/tooling-c-to-wasm-compile/compiler.wasm`,
  );
  const mod = wabt.readWasm(cBytes, { readDebugNames: true });
  mod.generateNames();
  mod.applyNames();
  const wat = `;; tooling.c-to-wasm-compile.v1 — compiler
;; WebAssembly Text (WAT) baseline for C-to-Wasm compiler

` + mod.toText({ foldExprs: false, inlineExport: false });
  await Deno.writeTextFile(
    `${ROOT}benchmarks/base/tooling-c-to-wasm-compile/compiler-wasm.wat`,
    wat,
  );
  const parsed = wabt.parseWat("compiler.wat", wat);
  await Deno.writeFile(
    `${ROOT}public/artifacts/multilang-wasm-benchmark/compiler_wat.wasm`,
    parsed.toBinary({}).buffer,
  );
  generatedFiles.push("compiler_wat.wasm");
  console.log("Generated benchmarks/base/tooling-c-to-wasm-compile/compiler-wasm.wat");
}

console.log(`\nGenerated ${generatedFiles.length} WAT and WASM artifacts successfully!`);
