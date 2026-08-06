// Multi-language document-pdf-viewer: every kernel variant must be
// bit-identical to the frozen JS oracle (text digest, raster page hashes,
// hit pages, counters) — same contract as tests/base-document-pdf-viewer.test.ts.
import { assert, assertEquals } from "./assert.ts";
import { sha256Hex } from "../lib/canonical.ts";

const pdfRaw = await Deno.readFile(
  new URL("../public/artifacts/document-pdf-viewer/report-100-pages.pdf", import.meta.url),
);
const pdf = new Uint8Array(pdfRaw);
const outManifest = JSON.parse(
  await Deno.readTextFile(
    new URL("../public/artifacts/document-pdf-viewer/output-manifest.json", import.meta.url),
  ),
);
const WIDTH = 1224;
const HEIGHT = 1584;
const RASTER_PAGES = [1, 25, 50, 75, 100];
const EXPECTED_HITS = [10, 20, 30, 40, 50, 60, 70, 80, 90, 100];

interface ParsedOut {
  textSha256: string;
  pageHashes: { page: number; sha256: string }[];
  hits: number[];
  counters: number[];
  pages: number;
}

async function runLinearWasm(
  wasmBytes: Uint8Array<ArrayBuffer>,
  label: string,
): Promise<ParsedOut> {
  const inst = new WebAssembly.Instance(new WebAssembly.Module(wasmBytes), {});
  const api = inst.exports as Record<string, unknown>;
  const mem = inst.exports.memory as WebAssembly.Memory;
  const call = (name: string, ...args: number[]): number => {
    const fn = api[name] as ((n?: number) => number) | undefined;
    if (typeof fn !== "function") throw new Error(`${label}: missing export ${name}`);
    return Number(fn(...args));
  };
  new Uint8Array(mem.buffer as ArrayBuffer, call("input_ptr"), pdf.length).set(pdf);
  const parseErr = call("parse", pdf.length);
  assert(parseErr === 0, `${label}: parse failed (error ${call("error_code")})`);
  const count = call("page_count");
  const textParts: string[] = [];
  for (let page = 0; page < count; page++) {
    const at = call("text_ptr", page);
    const len = call("text_len", page);
    textParts.push(new TextDecoder().decode(new Uint8Array(mem.buffer, at, len)));
  }
  const pageHashes: { page: number; sha256: string }[] = [];
  for (const page of RASTER_PAGES) {
    const r = call("render_page", page);
    assert(r === 0, `${label}: render ${page} failed (error ${call("error_code")})`);
    pageHashes.push({
      page,
      sha256: await sha256Hex(new Uint8Array(mem.buffer, call("rgba_ptr"), WIDTH * HEIGHT * 4)),
    });
  }
  const counters = Array.from(new Uint32Array(mem.buffer, call("counters_ptr"), 9));
  const hits: number[] = [];
  const hitCount = call("hit_count");
  for (let i = 0; i < hitCount; i++) hits.push(call("hit_page", i));
  return {
    textSha256: await sha256Hex(new TextEncoder().encode(textParts.join("\n"))),
    pageHashes,
    hits,
    counters,
    pages: count,
  };
}

async function runDartWasm(): Promise<ParsedOut> {
  const gluePath = new URL(
    "../public/artifacts/multilang-wasm-benchmark/pdf_engine_dart.mjs",
    import.meta.url,
  );
  const wasmPath = new URL(
    "../public/artifacts/multilang-wasm-benchmark/pdf_engine_dart.wasm",
    import.meta.url,
  );
  const glue = await import(gluePath.href);
  const app = await glue.compile(await Deno.readFile(wasmPath));
  const inst = await app.instantiate({});
  inst.invokeMain();
  const k = (globalThis as Record<string, unknown>).dartKernels as {
    parse: (input: ArrayBuffer) => number;
    pageCount: () => number;
    text: (page: number) => string;
    hits: () => Uint32Array;
    counters: () => Uint32Array;
    renderPage: (page: number) => ArrayBuffer;
  };
  if (!k) throw new Error("dartKernels not published");
  const buf = pdf.buffer.slice(pdf.byteOffset, pdf.byteOffset + pdf.byteLength) as ArrayBuffer;
  assert(k.parse(buf) === 0, "dart parse failed");
  const count = k.pageCount();
  const textParts: string[] = [];
  for (let page = 0; page < count; page++) textParts.push(k.text(page));
  const pageHashes: { page: number; sha256: string }[] = [];
  for (const page of RASTER_PAGES) {
    pageHashes.push({ page, sha256: await sha256Hex(new Uint8Array(k.renderPage(page))) });
  }
  const counters = Array.from(k.counters());
  const hits = Array.from(k.hits());
  return {
    textSha256: await sha256Hex(new TextEncoder().encode(textParts.join("\n"))),
    pageHashes,
    hits,
    counters,
    pages: count,
  };
}

const { parseReport, renderPage } = await import(
  "../benchmarks/base/document-pdf-viewer/engine.js"
) as {
  parseReport: (
    bytes: Uint8Array<ArrayBuffer>,
  ) => { texts: string[]; hits: number[]; counters: Record<string, number> };
  renderPage: (parsed: unknown, pageNumber: number, target: Uint8Array<ArrayBuffer>) => void;
};

async function runJsOracle(): Promise<ParsedOut> {
  const parsed = parseReport(pdf);
  const rgba = new Uint8Array(WIDTH * HEIGHT * 4);
  const pageHashes: { page: number; sha256: string }[] = [];
  for (const page of RASTER_PAGES) {
    renderPage(parsed, page, rgba);
    pageHashes.push({ page, sha256: await sha256Hex(rgba) });
  }
  return {
    textSha256: await sha256Hex(new TextEncoder().encode(parsed.texts.join("\n"))),
    pageHashes,
    hits: parsed.hits,
    counters: [
      parsed.counters.objects,
      parsed.counters.pages,
      parsed.counters.glyphs,
      parsed.counters.searchComparisons,
      0,
      WIDTH,
      HEIGHT,
      1,
      WIDTH * HEIGHT * 4,
    ],
    pages: parsed.texts.length,
  };
}

function assertMatchesOracle(_label: string, out: ParsedOut) {
  assertEquals(out.hits, EXPECTED_HITS);
  assertEquals(out.counters[0], 233);
  assertEquals(out.counters[1], 100);
  assertEquals(out.pages, 100);
  assertEquals(out.counters[2], 3470);
  assertEquals(out.counters[3], 2970);
  // text digest + raster hashes are byte-pinned by the frozen oracle manifest
  assertEquals(out.textSha256, outManifest.oracle.textSha256);
  assertEquals(out.pageHashes, outManifest.oracle.rasterPages);
}

Deno.test("pdf multilang: JS oracle counters + hits match the frozen contract", async () => {
  assertMatchesOracle("js", await runJsOracle());
});

Deno.test("pdf multilang: C kernel bit-identical to the oracle", async () => {
  const wasm = await Deno.readFile(
    new URL("../public/artifacts/multilang-wasm-benchmark/pdf_engine_c.wasm", import.meta.url),
  );
  assertMatchesOracle("c", await runLinearWasm(wasm, "c"));
});

Deno.test("pdf multilang: C++ kernel bit-identical to the oracle", async () => {
  const wasm = await Deno.readFile(
    new URL("../public/artifacts/multilang-wasm-benchmark/pdf_engine_cpp.wasm", import.meta.url),
  );
  assertMatchesOracle("cpp", await runLinearWasm(wasm, "cpp"));
});

Deno.test("pdf multilang: Rust kernel bit-identical to the oracle", async () => {
  const wasm = await Deno.readFile(
    new URL("../public/artifacts/multilang-wasm-benchmark/pdf_engine_rs.wasm", import.meta.url),
  );
  assertMatchesOracle("rs", await runLinearWasm(wasm, "rs"));
});

Deno.test("pdf multilang: Dart/WasmGC kernel bit-identical to the oracle", async () => {
  assertMatchesOracle("dart", await runDartWasm());
});
