export const WORKLOAD_ID = "document.pdf-viewer.v1";
export const PAGE_COUNT = 100;
export const RASTER_PAGES = Object.freeze([1, 25, 50, 75, 100]);
export const SEARCH_TERM = "NEEDLE";
export const WIDTH = 1224;
export const HEIGHT = 1584;

const latin1 = new TextDecoder("latin1");
const utf8 = new TextEncoder();

class Ref {
  constructor(object, generation) {
    this.object = object;
    this.generation = generation;
  }
}

class ValueParser {
  constructor(source, at = 0) {
    this.source = source;
    this.at = at;
  }
  whitespace() {
    while (this.at < this.source.length) {
      const c = this.source[this.at];
      if (/\s/.test(c)) this.at++;
      else if (c === "%") {
        while (this.at < this.source.length && !/[\r\n]/.test(this.source[this.at])) this.at++;
      } else break;
    }
  }
  token() {
    this.whitespace();
    const start = this.at;
    while (this.at < this.source.length && !/[\s<>\[\]()/%]/.test(this.source[this.at])) this.at++;
    if (start === this.at) throw new Error(`PDF token expected at ${this.at}`);
    return this.source.slice(start, this.at);
  }
  value() {
    this.whitespace();
    if (this.source.startsWith("<<", this.at)) {
      this.at += 2;
      const result = new Map();
      while (true) {
        this.whitespace();
        if (this.source.startsWith(">>", this.at)) {
          this.at += 2;
          return result;
        }
        const name = this.name();
        if (result.has(name)) throw new Error(`duplicate PDF dictionary key /${name}`);
        result.set(name, this.value());
      }
    }
    if (this.source[this.at] === "[") {
      this.at++;
      const result = [];
      while (true) {
        this.whitespace();
        if (this.source[this.at] === "]") {
          this.at++;
          return result;
        }
        result.push(this.value());
      }
    }
    if (this.source[this.at] === "/") return { name: this.name() };
    if (this.source[this.at] === "(") return this.string();
    if (this.source[this.at] === "<") {
      const end = this.source.indexOf(">", ++this.at);
      if (end < 0) throw new Error("unterminated PDF hex string");
      const value = this.source.slice(this.at, end);
      if (!/^(?:[a-fA-F0-9]{2})*$/.test(value)) throw new Error("invalid PDF hex string");
      this.at = end + 1;
      return { hex: value.toLowerCase() };
    }
    const first = this.token();
    if (/^[+-]?(?:\d+\.?\d*|\.\d+)$/.test(first)) {
      const number = Number(first);
      const saved = this.at;
      this.whitespace();
      const secondAt = this.at;
      let second = "";
      try {
        second = this.token();
      } catch {
        this.at = saved;
        return number;
      }
      if (/^\d+$/.test(first) && /^\d+$/.test(second)) {
        this.whitespace();
        if (this.source[this.at] === "R") {
          this.at++;
          return new Ref(number, Number(second));
        }
      }
      this.at = secondAt;
      return number;
    }
    if (first === "true") return true;
    if (first === "false") return false;
    if (first === "null") return null;
    throw new Error(`unsupported PDF value ${first}`);
  }
  name() {
    this.whitespace();
    if (this.source[this.at++] !== "/") throw new Error("PDF name expected");
    return this.token();
  }
  string() {
    if (this.source[this.at++] !== "(") throw new Error("PDF string expected");
    let result = "", depth = 1;
    while (this.at < this.source.length && depth) {
      const c = this.source[this.at++];
      if (c === "\\") {
        if (this.at >= this.source.length) throw new Error("unterminated PDF escape");
        const escaped = this.source[this.at++];
        const simple = { n: "\n", r: "\r", t: "\t", b: "\b", f: "\f" }[escaped];
        result += simple ?? escaped;
      } else if (c === "(") {
        depth++;
        result += c;
      } else if (c === ")") {
        if (--depth) result += c;
      } else result += c;
    }
    if (depth) throw new Error("unterminated PDF string");
    return { string: result };
  }
}

function named(value, expected) {
  if (!value || value.name !== expected) throw new Error(`expected PDF name /${expected}`);
}
function ref(value, label) {
  if (!(value instanceof Ref) || value.generation !== 0) {
    throw new Error(`${label} reference missing`);
  }
  return value.object;
}
function integer(value, label) {
  if (!Number.isSafeInteger(value) || value < 0) throw new Error(`${label} integer missing`);
  return value;
}

function parsePdf(bytes) {
  if (!(bytes instanceof Uint8Array)) throw new TypeError("PDF bytes required");
  const source = latin1.decode(bytes);
  if (!source.startsWith("%PDF-1.7\n")) throw new Error("unsupported PDF header");
  const startMatch = /startxref\s+(\d+)\s+%%EOF\s*$/.exec(source);
  if (!startMatch) throw new Error("PDF startxref missing");
  const xrefAt = Number(startMatch[1]);
  if (!Number.isSafeInteger(xrefAt) || !source.startsWith("xref", xrefAt)) {
    throw new Error("PDF xref offset invalid");
  }
  let at = xrefAt + 4;
  const line = () => {
    if (source[at] === "\r") at++;
    if (source[at] === "\n") at++;
    const end = source.indexOf("\n", at);
    if (end < 0) throw new Error("truncated PDF xref");
    const value = source.slice(at, end).replace(/\r$/, "");
    at = end + 1;
    return value;
  };
  const subsection = line().match(/^(\d+) (\d+)$/);
  if (!subsection || Number(subsection[1]) !== 0) {
    throw new Error("unsupported PDF xref subsection");
  }
  const size = Number(subsection[2]);
  if (!Number.isSafeInteger(size) || size < 2 || size > 1000) {
    throw new Error("PDF xref size invalid");
  }
  const offsets = new Array(size).fill(null);
  for (let id = 0; id < size; id++) {
    const entry = line().match(/^(\d{10}) (\d{5}) ([fn]) $/);
    if (!entry) throw new Error("malformed PDF xref entry");
    if (id === 0) {
      if (entry[3] !== "f" || entry[2] !== "65535") throw new Error("invalid free xref entry");
    } else {
      if (entry[3] !== "n" || entry[2] !== "00000") throw new Error("unsupported xref entry");
      offsets[id] = Number(entry[1]);
    }
  }
  if (!source.startsWith("trailer", at)) throw new Error("PDF trailer missing");
  const trailerParser = new ValueParser(source, at + 7);
  const trailer = trailerParser.value();
  if (!(trailer instanceof Map) || integer(trailer.get("Size"), "trailer Size") !== size) {
    throw new Error("PDF trailer Size mismatch");
  }
  const rootId = ref(trailer.get("Root"), "trailer Root");
  const objects = new Map();
  for (let id = 1; id < size; id++) {
    const offset = offsets[id];
    if (!Number.isSafeInteger(offset) || offset <= 0 || offset >= xrefAt) {
      throw new Error("xref offset range");
    }
    const header = new RegExp(`^${id} 0 obj(?:\\r?\\n|\\s)`).exec(source.slice(offset));
    if (!header) throw new Error(`xref object ${id} header mismatch`);
    const parser = new ValueParser(source, offset + header[0].length);
    const value = parser.value();
    parser.whitespace();
    let stream = null;
    if (source.startsWith("stream", parser.at)) {
      if (!(value instanceof Map)) throw new Error("PDF stream dictionary missing");
      parser.at += 6;
      if (source.startsWith("\r\n", parser.at)) parser.at += 2;
      else if (source[parser.at++] !== "\n") throw new Error("PDF stream EOL missing");
      const length = integer(value.get("Length"), "stream Length");
      const end = parser.at + length;
      if (end > bytes.length) throw new Error("PDF stream out of range");
      stream = bytes.subarray(parser.at, end);
      parser.at = end;
      if (source.startsWith("\r\n", parser.at)) parser.at += 2;
      else if (source[parser.at] === "\n") parser.at++;
      if (!source.startsWith("endstream", parser.at)) throw new Error("PDF endstream missing");
      parser.at += 9;
      parser.whitespace();
    }
    if (!source.startsWith("endobj", parser.at)) throw new Error(`PDF object ${id} not closed`);
    objects.set(id, { value, stream });
  }
  const get = (id) => {
    const object = objects.get(id);
    if (!object) throw new Error(`PDF object ${id} missing`);
    return object;
  };
  const root = get(rootId).value;
  if (!(root instanceof Map)) throw new Error("catalog dictionary missing");
  named(root.get("Type"), "Catalog");
  const pagesRootId = ref(root.get("Pages"), "catalog Pages");
  return { source, objects, get, pagesRootId, objectCount: size - 1 };
}

function parseToUnicode(stream) {
  if (!stream) throw new Error("ToUnicode stream missing");
  const source = latin1.decode(stream);
  if (!/begincmap[\s\S]*endcmap/.test(source)) throw new Error("ToUnicode CMap malformed");
  const map = new Map();
  for (const match of source.matchAll(/<([a-fA-F0-9]{2})>\s*<([a-fA-F0-9]{4})>/g)) {
    const code = Number.parseInt(match[1], 16);
    const scalar = Number.parseInt(match[2], 16);
    if (map.has(code) || scalar > 0x7f) throw new Error("unsupported ToUnicode mapping");
    map.set(code, String.fromCodePoint(scalar));
  }
  if (!map.size) throw new Error("empty ToUnicode CMap");
  return map;
}

function contentTokens(stream) {
  if (!stream) throw new Error("page content stream missing");
  const parser = new ValueParser(latin1.decode(stream));
  const tokens = [];
  while (true) {
    parser.whitespace();
    if (parser.at >= parser.source.length) return tokens;
    const c = parser.source[parser.at];
    if (c === "/" || c === "(" || c === "[" || c === "<" || /[+\-.0-9]/.test(c)) {
      tokens.push(parser.value());
    } else tokens.push({ operator: parser.token() });
  }
}

function parseType3(pdf, fontId) {
  const font = pdf.get(fontId).value;
  if (!(font instanceof Map)) throw new Error("font dictionary missing");
  named(font.get("Type"), "Font");
  named(font.get("Subtype"), "Type3");
  const matrix = font.get("FontMatrix");
  if (!Array.isArray(matrix) || matrix.length !== 6 || matrix.some((v) => typeof v !== "number")) {
    throw new Error("Type3 FontMatrix missing");
  }
  const encoding = font.get("Encoding");
  if (!(encoding instanceof Map)) throw new Error("Type3 Encoding missing");
  const differences = encoding.get("Differences");
  if (!Array.isArray(differences)) throw new Error("Type3 Differences missing");
  const names = new Map();
  let code = -1;
  for (const value of differences) {
    if (Number.isInteger(value)) code = value;
    else {
      if (code < 0 || code > 255 || !value?.name) throw new Error("Type3 Differences malformed");
      names.set(code++, value.name);
    }
  }
  const charProcs = font.get("CharProcs");
  if (!(charProcs instanceof Map)) throw new Error("Type3 CharProcs missing");
  const glyphs = new Map();
  for (const [characterCode, name] of names) {
    const stream = pdf.get(ref(charProcs.get(name), `CharProc ${name}`)).stream;
    const tokens = contentTokens(stream);
    const rectangles = [];
    let operand = [];
    for (const token of tokens) {
      if (!token.operator) {
        if (typeof token !== "number") throw new Error("unsupported Type3 operand");
        operand.push(token);
        continue;
      }
      if (token.operator === "d1") {
        if (operand.length !== 6) throw new Error("Type3 d1 operands malformed");
      } else if (token.operator === "re") {
        if (operand.length !== 4) throw new Error("Type3 rectangle operands malformed");
        rectangles.push(operand.slice());
      } else if (token.operator !== "f" || operand.length !== 0) {
        throw new Error(`unsupported Type3 operator ${token.operator}`);
      }
      operand = [];
    }
    if (operand.length) throw new Error("unterminated Type3 operands");
    glyphs.set(characterCode, rectangles);
  }
  const unicode = parseToUnicode(pdf.get(ref(font.get("ToUnicode"), "font ToUnicode")).stream);
  const widths = font.get("Widths");
  const first = integer(font.get("FirstChar"), "font FirstChar");
  if (!Array.isArray(widths) || widths.some((v) => typeof v !== "number")) {
    throw new Error("Type3 Widths missing");
  }
  return { matrix, glyphs, unicode, widths, first };
}

export function parseReport(bytes) {
  const pdf = parsePdf(bytes);
  const pagesRoot = pdf.get(pdf.pagesRootId).value;
  if (!(pagesRoot instanceof Map)) throw new Error("page tree dictionary missing");
  named(pagesRoot.get("Type"), "Pages");
  const kids = pagesRoot.get("Kids");
  const declaredCount = integer(pagesRoot.get("Count"), "page tree Count");
  if (!Array.isArray(kids) || kids.length !== declaredCount) {
    throw new Error("page tree count mismatch");
  }
  const pages = [];
  let sharedFontId = null;
  let font = null;
  for (const kid of kids) {
    const page = pdf.get(ref(kid, "page tree Kid")).value;
    if (!(page instanceof Map)) throw new Error("page dictionary missing");
    named(page.get("Type"), "Page");
    if (ref(page.get("Parent"), "page Parent") !== pdf.pagesRootId) {
      throw new Error("page parent mismatch");
    }
    const mediaBox = page.get("MediaBox");
    if (!Array.isArray(mediaBox) || mediaBox.join(" ") !== "0 0 612 792") {
      throw new Error("page MediaBox mismatch");
    }
    const resources = page.get("Resources");
    const fonts = resources instanceof Map ? resources.get("Font") : null;
    if (!(fonts instanceof Map)) throw new Error("page font resources missing");
    const fontId = ref(fonts.get("F1"), "page F1");
    if (sharedFontId === null) {
      sharedFontId = fontId;
      font = parseType3(pdf, fontId);
    } else if (fontId !== sharedFontId) throw new Error("page font resource changed");
    const tokens = contentTokens(pdf.get(ref(page.get("Contents"), "page Contents")).stream);
    const stack = [];
    let inText = false, activeFont = null, fontSize = 0, x = 0, y = 0, encoded = null;
    for (const token of tokens) {
      if (!token.operator) {
        stack.push(token);
        continue;
      }
      switch (token.operator) {
        case "BT":
          if (inText || stack.length) throw new Error("malformed BT");
          inText = true;
          break;
        case "Tf":
          if (
            !inText || stack.length !== 2 || stack[0]?.name !== "F1" || typeof stack[1] !== "number"
          ) throw new Error("malformed Tf");
          activeFont = font;
          fontSize = stack[1];
          stack.length = 0;
          break;
        case "Td":
          if (!inText || stack.length !== 2 || stack.some((v) => typeof v !== "number")) {
            throw new Error("malformed Td");
          }
          [x, y] = stack;
          stack.length = 0;
          break;
        case "Tj":
          if (
            !inText || !activeFont || stack.length !== 1 || typeof stack[0]?.string !== "string"
          ) throw new Error("malformed Tj");
          encoded = stack[0].string;
          stack.length = 0;
          break;
        case "ET":
          if (!inText || stack.length || encoded === null) throw new Error("malformed ET");
          inText = false;
          break;
        default:
          throw new Error(`unsupported page operator ${token.operator}`);
      }
    }
    if (inText || stack.length || encoded === null) throw new Error("incomplete page text object");
    let text = "";
    for (let i = 0; i < encoded.length; i++) {
      const mapped = font.unicode.get(encoded.charCodeAt(i));
      if (mapped === undefined) throw new Error("text code absent from ToUnicode");
      text += mapped;
    }
    pages.push({ text, encoded, font, fontSize, x, y });
  }
  const texts = pages.map((page) => page.text);
  const hits = [];
  let comparisons = 0;
  for (let p = 0; p < texts.length; p++) {
    const text = texts[p];
    let found = false;
    for (let i = 0; i + SEARCH_TERM.length <= text.length; i++) {
      comparisons++;
      if (text.slice(i, i + SEARCH_TERM.length) === SEARCH_TERM) found = true;
    }
    if (found) hits.push(p + 1);
  }
  return {
    pages,
    texts,
    hits,
    counters: {
      objects: pdf.objectCount,
      pages: pages.length,
      glyphs: texts.reduce((sum, text) => sum + text.length, 0),
      searchComparisons: comparisons,
      rasterizedPages: 0,
      pixels: 0,
      allocations: 0,
      boundaryCrossings: 0,
      copiedBytes: 0,
      peakBytes: 0,
      memoryBytes: 0,
    },
  };
}

export function renderPage(parsed, pageNumber, target) {
  if (!RASTER_PAGES.includes(pageNumber)) throw new Error("page outside frozen raster set");
  const page = parsed.pages[pageNumber - 1];
  if (!page) throw new Error("page missing");
  const rgba = target ?? new Uint8Array(WIDTH * HEIGHT * 4);
  if (!(rgba instanceof Uint8Array) || rgba.length !== WIDTH * HEIGHT * 4) {
    throw new Error("RGBA target size mismatch");
  }
  rgba.fill(255);
  const [a, b, c, d, e, f] = page.font.matrix;
  if (b !== 0 || c !== 0 || e !== 0 || f !== 0 || a <= 0 || d <= 0) {
    throw new Error("unsupported Type3 transform");
  }
  const dpiScale = 2;
  let textX = page.x;
  for (let g = 0; g < page.encoded.length; g++) {
    const code = page.encoded.charCodeAt(g);
    const rectangles = page.font.glyphs.get(code);
    if (!rectangles) throw new Error("Type3 glyph program missing");
    for (const [gx, gy, gw, gh] of rectangles) {
      const left = Math.round((textX + gx * a * page.fontSize) * dpiScale);
      const right = Math.round((textX + (gx + gw) * a * page.fontSize) * dpiScale);
      const top = Math.round(HEIGHT - (page.y + (gy + gh) * d * page.fontSize) * dpiScale);
      const bottom = Math.round(HEIGHT - (page.y + gy * d * page.fontSize) * dpiScale);
      if (left < 0 || top < 0 || right >= WIDTH || bottom >= HEIGHT) {
        throw new Error("Type3 glyph outside page");
      }
      for (let py = top; py <= bottom; py++) {
        for (let px = left; px <= right; px++) {
          const out = (py * WIDTH + px) * 4;
          rgba[out] = rgba[out + 1] = rgba[out + 2] = 0;
        }
      }
    }
    const width = page.font.widths[code - page.font.first];
    if (typeof width !== "number") throw new Error("Type3 glyph width missing");
    textX += width * a * page.fontSize;
  }
  parsed.counters.rasterizedPages++;
  parsed.counters.pixels += WIDTH * HEIGHT;
  return rgba;
}

export async function sha256(bytes) {
  return [...new Uint8Array(await crypto.subtle.digest("SHA-256", bytes))]
    .map((value) => value.toString(16).padStart(2, "0")).join("");
}

export async function runJavaScript(bytes) {
  const parsed = parseReport(bytes);
  const rgba = new Uint8Array(WIDTH * HEIGHT * 4);
  parsed.counters.allocations = 1;
  parsed.counters.peakBytes = rgba.byteLength;
  parsed.counters.memoryBytes = rgba.byteLength;
  const pageHashes = [];
  for (const page of RASTER_PAGES) {
    pageHashes.push({ page, sha256: await sha256(renderPage(parsed, page, rgba)) });
  }
  return {
    target: "javascript",
    pageCount: parsed.texts.length,
    hits: parsed.hits,
    textSha256: await sha256(utf8.encode(parsed.texts.join("\n"))),
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
  let crossings = 0;
  const call = (name, ...args) => {
    const fn = api[name];
    if (typeof fn !== "function") throw new Error(`Wasm export ${name} missing`);
    crossings++;
    return Number(fn(...args));
  };
  const inputAt = call("input_ptr");
  new Uint8Array(api.memory.buffer, inputAt, bytes.length).set(bytes);
  if (call("parse", bytes.length) !== 0) {
    throw new Error(`Wasm PDF parse failed: ${call("error_code")}`);
  }
  const count = call("page_count");
  const textParts = [];
  let outputReadBytes = 0;
  for (let page = 0; page < count; page++) {
    const at = call("text_ptr", page), length = call("text_len", page);
    outputReadBytes += length;
    textParts.push(new TextDecoder().decode(new Uint8Array(api.memory.buffer, at, length)));
  }
  const pageHashes = [];
  for (const page of RASTER_PAGES) {
    if (call("render_page", page) !== 0) {
      throw new Error(`Wasm raster failed: ${call("error_code")}`);
    }
    const rgba = new Uint8Array(api.memory.buffer, call("rgba_ptr"), WIDTH * HEIGHT * 4);
    outputReadBytes += rgba.byteLength;
    pageHashes.push({ page, sha256: await sha256(rgba) });
  }
  const countersAt = call("counters_ptr");
  const words = new Uint32Array(api.memory.buffer, countersAt, 9);
  const hitCount = call("hit_count");
  const hits = [];
  for (let i = 0; i < hitCount; i++) hits.push(call("hit_page", i));
  outputReadBytes += words.byteLength + hits.length * 4;
  return {
    target: "wasm-linear",
    pageCount: count,
    hits,
    textSha256: await sha256(utf8.encode(textParts.join("\n"))),
    pageHashes,
    counters: {
      objects: words[0],
      pages: words[1],
      glyphs: words[2],
      searchComparisons: words[3],
      rasterizedPages: words[4],
      pixels: words[4] * words[5] * words[6],
      allocations: words[7],
      boundaryCrossings: crossings,
      copiedBytes: bytes.byteLength + outputReadBytes,
      peakBytes: words[8],
      memoryBytes: api.memory.buffer.byteLength,
    },
  };
}
