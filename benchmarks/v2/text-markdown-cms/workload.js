// text.markdown-cms.v1 controlled project grammar and canonical serializer.
// Raw HTML allowlist: only attribute-free em and strong elements. Links are
// limited to https://example.test/ and https://docs.example.test/; figures to
// https://images.example.test/. Everything else is omitted, never executed.

export const DOCUMENTS = 500;
export const MINIMUM_BYTES = 2048;
export const MAXIMUM_BYTES = 40960;
export const GENERATOR_SEED = 0xc05c0de1;
export const RAW_HTML_LIMIT_BYTES = 40_960;
export const MAX_NON_EMPTY_LINES = 4096;
const encoder = new TextEncoder();
const decoder = new TextDecoder("utf-8", { fatal: true });

function next(state) {
  state ^= state << 13;
  state ^= state >>> 17;
  state ^= state << 5;
  return state >>> 0;
}

export function serializeMarkdownCorpus(documents) {
  const encoded = documents.map((document) => encoder.encode(document));
  const byteLength = 8 + encoded.reduce((total, document) => total + 4 + document.length, 0);
  const output = new Uint8Array(byteLength);
  const view = new DataView(output.buffer);
  view.setUint32(0, 0x3146434d, true); // "MCF1" as little-endian u32.
  view.setUint32(4, encoded.length, true);
  let offset = 8;
  for (const document of encoded) {
    view.setUint32(offset, document.length, true);
    offset += 4;
    output.set(document, offset);
    offset += document.length;
  }
  return output;
}

export function generateMarkdownFixture(count = DOCUMENTS) {
  let state = GENERATOR_SEED;
  const documents = [];
  for (let index = 0; index < count; index += 1) {
    state = next(state);
    const wanted = MINIMUM_BYTES + (state % (MAXIMUM_BYTES - MINIMUM_BYTES + 1));
    let prefix;
    if (index === 0) {
      prefix =
        "# Mixed blocks\n[x](https://docs.example.test/ok)\n![a](https://images.example.test/0.png)\n<em>trusted</em>\n";
    } else if (index === 1) {
      prefix =
        "# Unicode URL whitespace\n[nbsp](https://docs.example.test/a b)\nParagraph remains\n";
    } else {
      prefix =
        `# Café 東京 ${index}\n## Section 🚀\n<em>trusted</em>\n<script>alert(${index})</script>\nParagraph é ${
          state.toString(16)
        }\n`;
    }
    const prefixBytes = encoder.encode(prefix);
    if (prefixBytes.length > wanted) throw new Error("fixture prefix exceeds target");
    const remaining = wanted - prefixBytes.length;
    documents.push(prefix + (remaining ? `${"p".repeat(Math.max(0, remaining - 1))}\n` : ""));
    if (encoder.encode(documents.at(-1)).length !== wanted) {
      throw new Error("fixture byte length mismatch");
    }
  }
  return { seed: GENERATOR_SEED, documents };
}

const H1 = 1, H2 = 2, PARAGRAPH = 3, LINK = 4, FIGURE = 5, RAW = 6;
const RECORD_FIELDS = 6;

function validateMarkdownBounds(input) {
  if (input.length > RAW_HTML_LIMIT_BYTES) {
    throw new Error(`input exceeds ${RAW_HTML_LIMIT_BYTES} UTF-8 bytes`);
  }
  let nonEmpty = 0;
  let start = 0;
  for (let index = 0; index <= input.length; index++) {
    if (index === input.length || input[index] === 10) {
      if (index > start) nonEmpty++;
      start = index + 1;
    }
  }
  if (nonEmpty > MAX_NON_EMPTY_LINES) {
    throw new Error(`input exceeds ${MAX_NON_EMPTY_LINES} non-empty lines`);
  }
}

function safeUrlBytes(input, start, length, image) {
  for (let index = start; index < start + length; index++) {
    const byte = input[index];
    if (
      byte <= 32 || byte >= 127 || byte === 34 || byte === 39 || byte === 60 || byte === 62 ||
      byte === 92
    ) return false;
  }
  const url = decoder.decode(input.subarray(start, start + length));
  return image
    ? url.startsWith("https://images.example.test/")
    : url.startsWith("https://example.test/") || url.startsWith("https://docs.example.test/");
}

export function encodeAst(ast) {
  const bytes = new Uint8Array(ast.length * 4);
  const view = new DataView(bytes.buffer);
  ast.forEach((value, index) => view.setUint32(index * 4, value, true));
  return bytes;
}

export function parseMarkdown(source) {
  const input = encoder.encode(source);
  validateMarkdownBounds(input);
  const records = [];
  let start = 0;
  for (let end = 0; end <= input.length; end++) {
    if (end !== input.length && input[end] !== 10) continue;
    if (end === start) {
      start = end + 1;
      continue;
    }
    let type = PARAGRAPH, textStart = start, textLength = end - start, urlStart = 0, urlLength = 0;
    if (textLength >= 3 && input[start] === 35 && input[start + 1] === 32) {
      type = H1;
      textStart = start + 2;
      textLength -= 2;
    } else if (
      textLength >= 4 && input[start] === 35 && input[start + 1] === 35 && input[start + 2] === 32
    ) {
      type = H2;
      textStart = start + 3;
      textLength -= 3;
    } else if (input[start] === 60) type = RAW;
    else if (
      input[start] === 91 || (textLength >= 5 && input[start] === 33 && input[start + 1] === 91)
    ) {
      const image = input[start] === 33;
      let cursor = start + (image ? 1 : 0);
      const candidateTextStart = cursor + 1;
      let close = 0;
      for (; cursor < end - 2; cursor++) {
        if (input[cursor] === 93 && input[cursor + 1] === 40) {
          close = cursor;
          break;
        }
      }
      if (close !== 0 && input[end - 1] === 41) {
        type = image ? FIGURE : LINK;
        textStart = candidateTextStart;
        textLength = close - candidateTextStart;
        urlStart = close + 2;
        urlLength = end - urlStart - 1;
      }
    }
    records.push(type, textStart, textLength, urlStart, urlLength, 0);
    start = end + 1;
  }
  return { input, ast: Uint32Array.from(records) };
}

function escapeHtml(value) {
  return value.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll(
    '"',
    "&quot;",
  );
}
function slug(value) {
  let result = "";
  let dash = false;
  for (const char of value) {
    if (/[A-Za-z0-9]/u.test(char)) {
      result += char.toLowerCase();
      dash = false;
    } else if (result && !dash) {
      result += "-";
      dash = true;
    }
  }
  return result.replace(/-$/u, "") || "section";
}
function allowedRaw(value) {
  return (/^<em>[^<>]*<\/em>$/u.test(value) || /^<strong>[^<>]*<\/strong>$/u.test(value));
}

export function renderMarkdown(source) {
  const { input, ast } = parseMarkdown(source);
  const parsedAstBytes = encodeAst(ast);
  const transformed = ast.slice();
  let headings = 0, links = 0, figures = 0, transforms = 0, sanitizerChecks = 0, rejected = 0;
  const text = (record, field = 1) => {
    const start = transformed[record + field];
    const length = transformed[record + field + 1];
    return decoder.decode(input.subarray(start, start + length));
  };
  for (let record = 0; record < transformed.length; record += RECORD_FIELDS) {
    const type = transformed[record];
    if (type === H1 || type === H2) {
      headings++;
      transforms++;
      transformed[record + 5] = 1;
    } else if (type === LINK || type === FIGURE) {
      if (type === LINK) links++;
      else figures++;
      transforms++;
      sanitizerChecks++;
      const ok = safeUrlBytes(
        input,
        transformed[record + 3],
        transformed[record + 4],
        type === FIGURE,
      );
      transformed[record + 5] = ok ? 1 : 0;
      if (!ok) rejected++;
    } else if (type === RAW) {
      sanitizerChecks++;
      const ok = allowedRaw(text(record));
      transformed[record + 5] = ok ? 1 : 0;
      if (!ok) rejected++;
    } else transformed[record + 5] = 1;
  }
  const transformedAstBytes = encodeAst(transformed);
  let html = "";
  if (headings) {
    html += '<nav aria-label="Table of contents"><ol>';
    for (let record = 0; record < transformed.length; record += RECORD_FIELDS) {
      if (transformed[record] === H1 || transformed[record] === H2) {
        const value = text(record);
        html += `<li><a href="#${slug(value)}">${escapeHtml(value)}</a></li>`;
      }
    }
    html += "</ol></nav>";
  }
  for (let record = 0; record < transformed.length; record += RECORD_FIELDS) {
    const type = transformed[record], value = text(record);
    if (type === H1 || type === H2) {
      const level = type === H1 ? 1 : 2;
      html += `<h${level} id="${slug(value)}">${escapeHtml(value)}</h${level}>`;
    } else if (type === PARAGRAPH) html += `<p>${escapeHtml(value)}</p>`;
    else if (type === LINK && transformed[record + 5]) {
      html += `<p><a href="${escapeHtml(text(record, 3))}">${escapeHtml(value)}</a></p>`;
    } else if (type === FIGURE && transformed[record + 5]) {
      html += `<figure><img src="${escapeHtml(text(record, 3))}" alt="${
        escapeHtml(value)
      }"></figure>`;
    } else if (type === RAW && transformed[record + 5]) html += value;
  }
  const outputBytes = encoder.encode(html);
  const nodeCount = ast.length / RECORD_FIELDS;
  return {
    ast: parsedAstBytes,
    transformedAst: transformedAstBytes,
    html,
    outputBytes,
    rejected,
    counters: {
      documents: 1,
      "input-bytes": input.length,
      tokens: nodeCount,
      "ast-nodes": nodeCount + headings * 2 + (headings ? 2 : 0) + links + figures,
      transforms,
      "sanitizer-checks": sanitizerChecks,
      "output-bytes": outputBytes.length,
      allocations: 4,
      "boundary-crossings": 0,
    },
  };
}

export async function sha256Hex(bytes) {
  const digest = new Uint8Array(await crypto.subtle.digest("SHA-256", bytes));
  return [...digest].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

export async function renderMarkdownWasm(source, wasmBytes) {
  const input = encoder.encode(source);
  validateMarkdownBounds(input);
  const { instance } = await WebAssembly.instantiate(wasmBytes);
  const { memory, parse, transform_with_input: transform, sanitize, render } = instance.exports;
  if (
    !(memory instanceof WebAssembly.Memory) ||
    [parse, transform, sanitize, render].some((fn) => typeof fn !== "function")
  ) throw new Error("Markdown Wasm exports missing");
  const inputPtr = 4096;
  const astPtr = 65536;
  const outputPtr = 2 * 1024 * 1024;
  const metaPtr = 3_900_000;
  const outputCap = metaPtr - outputPtr;
  new Uint8Array(memory.buffer, inputPtr, input.length).set(input);
  const nodeCount = parse(inputPtr, input.length, astPtr, MAX_NON_EMPTY_LINES);
  const astBytes = new Uint8Array(memory.buffer.slice(astPtr, astPtr + nodeCount * 24));
  transform(inputPtr, astPtr, nodeCount, metaPtr);
  sanitize(inputPtr, astPtr, nodeCount, metaPtr);
  const transformedAstBytes = new Uint8Array(
    memory.buffer.slice(astPtr, astPtr + nodeCount * 24),
  );
  const outputLength = render(inputPtr, astPtr, nodeCount, outputPtr, outputCap, metaPtr);
  const htmlBytes = new Uint8Array(memory.buffer.slice(outputPtr, outputPtr + outputLength));
  const view = new DataView(memory.buffer);
  return {
    ast: astBytes,
    transformedAst: transformedAstBytes,
    html: decoder.decode(htmlBytes),
    outputBytes: htmlBytes,
    rejected: view.getUint32(metaPtr + 20, true),
    counters: {
      documents: 1,
      "input-bytes": input.length,
      tokens: nodeCount,
      "ast-nodes": view.getUint32(metaPtr + 12, true),
      transforms: view.getUint32(metaPtr, true),
      "sanitizer-checks": view.getUint32(metaPtr + 4, true),
      "output-bytes": outputLength,
      allocations: view.getUint32(metaPtr + 24, true),
      "boundary-crossings": 4,
    },
  };
}
