export const WORKLOAD_ID = "document.pdf-viewer.v1";
export const PAGE_COUNT = 100;
export const RASTER_PAGES = Object.freeze([1, 25, 50, 75, 100]);
export const SEARCH_TERM = "NEEDLE";
export const WIDTH = 1224;
export const HEIGHT = 1584;
export const FONT_BYTES = 128 * 7;

const decoder = new TextDecoder("latin1");
const marker = new TextEncoder().encode("%%PDFBASEFONT\n");

function indexOfBytes(bytes, needle, start = 0) {
  outer: for (let i = start; i <= bytes.length - needle.length; i++) {
    for (let j = 0; j < needle.length; j++) if (bytes[i + j] !== needle[j]) continue outer;
    return i;
  }
  return -1;
}

function countAscii(text, needle) {
  let count = 0;
  for (let at = 0; (at = text.indexOf(needle, at)) >= 0; at += needle.length) count++;
  return count;
}

export function parseReport(bytes) {
  if (!(bytes instanceof Uint8Array)) throw new TypeError("PDF bytes required");
  if (bytes.length < 1024 || decoder.decode(bytes.subarray(0, 8)) !== "%PDF-1.7") {
    throw new Error("unsupported PDF header");
  }
  const source = decoder.decode(bytes);
  if (
    !source.includes("/Type /Catalog") || !source.includes("/Count 100") ||
    !source.includes("startxref")
  ) {
    throw new Error("incomplete PDF structure");
  }
  const objectCount = countAscii(source, " obj\n");
  const fontAt = indexOfBytes(bytes, marker);
  if (fontAt < 0 || fontAt + marker.length + FONT_BYTES > bytes.length) {
    throw new Error("embedded font missing");
  }
  const font = bytes.slice(fontAt + marker.length, fontAt + marker.length + FONT_BYTES);
  const texts = [];
  let cursor = 0;
  const streamMarker = "stream\nBT /F1 18 Tf 36 750 Td (";
  while ((cursor = source.indexOf(streamMarker, cursor)) >= 0) {
    const start = cursor + streamMarker.length;
    const end = source.indexOf(") Tj ET", start);
    if (end < 0) throw new Error("unterminated page text");
    const text = source.slice(start, end);
    if (!/^REPORT PAGE [0-9]{3} DOCUMENT BENCHMARK(?: NEEDLE)?$/.test(text)) {
      throw new Error("page content outside frozen subset");
    }
    texts.push(text);
    cursor = end + 7;
  }
  if (texts.length !== PAGE_COUNT) {
    throw new Error(`expected ${PAGE_COUNT} pages, got ${texts.length}`);
  }
  const hits = [];
  for (let i = 0; i < texts.length; i++) if (texts[i].includes(SEARCH_TERM)) hits.push(i + 1);
  const expected = [10, 20, 30, 40, 50, 60, 70, 80, 90, 100];
  if (JSON.stringify(hits) !== JSON.stringify(expected)) {
    throw new Error("search hit oracle mismatch");
  }
  return {
    texts,
    font,
    hits,
    counters: {
      objects: objectCount,
      pages: texts.length,
      glyphs: texts.reduce((sum, text) => sum + text.length, 0),
      searchComparisons: texts.reduce(
        (sum, text) => sum + Math.max(0, text.length - SEARCH_TERM.length + 1),
        0,
      ),
      rasterizedPages: 0,
      pixels: 0,
      allocations: 3,
      boundaryCrossings: 0,
      peakBytes: bytes.length + FONT_BYTES,
    },
  };
}

export function renderPage(parsed, pageNumber) {
  if (!RASTER_PAGES.includes(pageNumber)) throw new Error("page outside frozen raster set");
  const text = parsed.texts[pageNumber - 1];
  if (!text) throw new Error("page missing");
  const rgba = new Uint8Array(WIDTH * HEIGHT * 4);
  rgba.fill(255);
  const scale = 5;
  let x = 72;
  const y = 100;
  for (let g = 0; g < text.length; g++) {
    const code = text.charCodeAt(g);
    if (code > 127) throw new Error("font code outside subset");
    for (let row = 0; row < 7; row++) {
      const bits = parsed.font[code * 7 + row];
      for (let col = 0; col < 5; col++) {
        if (((bits >> (4 - col)) & 1) === 0) continue;
        for (let dy = 0; dy < scale; dy++) {
          for (let dx = 0; dx < scale; dx++) {
            const px = x + col * scale + dx;
            const py = y + row * scale + dy;
            const at = (py * WIDTH + px) * 4;
            rgba[at] = rgba[at + 1] = rgba[at + 2] = 0;
          }
        }
      }
    }
    x += 6 * scale;
  }
  parsed.counters.rasterizedPages++;
  parsed.counters.pixels += WIDTH * HEIGHT;
  parsed.counters.allocations++;
  parsed.counters.peakBytes = Math.max(parsed.counters.peakBytes, rgba.length);
  return rgba;
}

export async function sha256(bytes) {
  return [...new Uint8Array(await crypto.subtle.digest("SHA-256", bytes))]
    .map((value) => value.toString(16).padStart(2, "0")).join("");
}

export async function runJavaScript(bytes) {
  const parsed = parseReport(bytes);
  const pageHashes = [];
  for (const page of RASTER_PAGES) {
    pageHashes.push({ page, sha256: await sha256(renderPage(parsed, page)) });
  }
  return {
    target: "javascript",
    pageCount: parsed.texts.length,
    hits: parsed.hits,
    textSha256: await sha256(new TextEncoder().encode(parsed.texts.join("\n"))),
    pageHashes,
    counters: parsed.counters,
  };
}

export async function instantiatePdfWasm(wasmBytes) {
  const { instance } = await WebAssembly.instantiate(wasmBytes, {});
  return instance.exports;
}

export async function runWasm(bytes, wasmBytes) {
  const api = await instantiatePdfWasm(wasmBytes);
  if (!(api.memory instanceof WebAssembly.Memory)) throw new Error("Wasm memory missing");
  new Uint8Array(api.memory.buffer, Number(api.input_ptr()), bytes.length).set(bytes);
  if (Number(api.parse(bytes.length)) !== 0) {
    throw new Error(`Wasm PDF parse failed: ${api.error_code()}`);
  }
  const textParts = [];
  for (let page = 0; page < PAGE_COUNT; page++) {
    const at = Number(api.text_ptr(page));
    const length = Number(api.text_len(page));
    textParts.push(new TextDecoder().decode(new Uint8Array(api.memory.buffer, at, length)));
  }
  const pageHashes = [];
  for (const page of RASTER_PAGES) {
    if (Number(api.render_page(page)) !== 0) throw new Error("Wasm raster failed");
    const rgba = new Uint8Array(api.memory.buffer, Number(api.rgba_ptr()), WIDTH * HEIGHT * 4);
    pageHashes.push({ page, sha256: await sha256(rgba) });
  }
  const countersAt = Number(api.counters_ptr());
  const words = new Uint32Array(api.memory.buffer, countersAt, 9);
  return {
    target: "wasm-linear",
    pageCount: Number(api.page_count()),
    hits: Array.from({ length: Number(api.hit_count()) }, (_, i) => Number(api.hit_page(i))),
    textSha256: await sha256(new TextEncoder().encode(textParts.join("\n"))),
    pageHashes,
    counters: {
      objects: words[0],
      pages: words[1],
      glyphs: words[2],
      searchComparisons: words[3],
      rasterizedPages: words[4],
      pixels: words[4] * words[5] * words[6],
      allocations: words[7],
      boundaryCrossings: 6,
      peakBytes: words[8],
    },
  };
}
