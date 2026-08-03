// text.markdown-cms.v1 controlled project grammar and canonical serializer.
// Raw HTML allowlist: only attribute-free em and strong elements. Links are
// limited to https://example.test/ and https://docs.example.test/; figures to
// https://images.example.test/. Everything else is omitted, never executed.

export const DOCUMENTS = 500;
export const MINIMUM_BYTES = 2048;
export const MAXIMUM_BYTES = 40960;
export const GENERATOR_SEED = 0xc05c0de1;
export const RAW_HTML_LIMIT_BYTES = 40_960;
const encoder = new TextEncoder();
const decoder = new TextDecoder("utf-8", { fatal: true });

function next(state) {
  state ^= state << 13;
  state ^= state >>> 17;
  state ^= state << 5;
  return state >>> 0;
}

export function generateMarkdownFixture(count = DOCUMENTS) {
  let state = GENERATOR_SEED;
  const documents = [];
  for (let index = 0; index < count; index += 1) {
    state = next(state);
    const wanted = MINIMUM_BYTES + (state % (MAXIMUM_BYTES - MINIMUM_BYTES + 1));
    let prefix;
    if (index === 0) {
      const shell = `![](https://images.example.test/0.png)\n`;
      prefix = `![${
        "p".repeat(wanted - encoder.encode(shell).length)
      }](https://images.example.test/0.png)\n`;
    } else if (index === 1) {
      const shell = `[link](https://docs.example.test/)\n`;
      prefix = `[link](https://docs.example.test/${
        "p".repeat(wanted - encoder.encode(shell).length)
      })\n`;
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

function safeUrl(url, image) {
  if (/[\s"'<>\\]/u.test(url)) return false;
  return image
    ? url.startsWith("https://images.example.test/")
    : url.startsWith("https://example.test/") || url.startsWith("https://docs.example.test/");
}

export function parseMarkdown(source) {
  const nodes = [];
  for (const line of source.split("\n")) {
    if (line === "") continue;
    if (line.startsWith("## ")) nodes.push({ type: "heading2", text: line.slice(3) });
    else if (line.startsWith("# ")) nodes.push({ type: "heading1", text: line.slice(2) });
    else {
      const figure = /^!\[([^\]]*)\]\(([^)]*)\)$/u.exec(line);
      const link = /^\[([^\]]*)\]\(([^)]*)\)$/u.exec(line);
      if (figure) nodes.push({ type: "figure", text: figure[1], url: figure[2] });
      else if (link) nodes.push({ type: "link", text: link[1], url: link[2] });
      else if (line.startsWith("<")) nodes.push({ type: "raw", text: line });
      else nodes.push({ type: "paragraph", text: line });
    }
  }
  return nodes;
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
  const ast = parseMarkdown(source);
  const headings = ast.filter((node) => node.type === "heading1" || node.type === "heading2");
  let html = "";
  if (headings.length) {
    html += '<nav aria-label="Table of contents"><ol>';
    for (const node of headings) {
      html += `<li><a href="#${slug(node.text)}">${escapeHtml(node.text)}</a></li>`;
    }
    html += "</ol></nav>";
  }
  let rejected = 0;
  let sanitizerChecks = 0;
  let transforms = 0;
  let linkCount = 0;
  let figureCount = 0;
  for (const node of ast) {
    if (node.type === "heading1" || node.type === "heading2") {
      transforms++;
      const level = node.type === "heading1" ? 1 : 2;
      html += `<h${level} id="${slug(node.text)}">${escapeHtml(node.text)}</h${level}>`;
    } else if (node.type === "paragraph") html += `<p>${escapeHtml(node.text)}</p>`;
    else if (node.type === "link") {
      transforms++;
      linkCount++;
      sanitizerChecks++;
      if (safeUrl(node.url, false)) {
        html += `<p><a href="${escapeHtml(node.url)}">${escapeHtml(node.text)}</a></p>`;
      } else rejected++;
    } else if (node.type === "figure") {
      transforms++;
      figureCount++;
      sanitizerChecks++;
      if (safeUrl(node.url, true)) {
        html += `<figure><img src="${escapeHtml(node.url)}" alt="${
          escapeHtml(node.text)
        }"></figure>`;
      } else rejected++;
    } else {
      sanitizerChecks++;
      if (allowedRaw(node.text)) html += node.text;
      else rejected++;
    }
  }
  const inputBytes = encoder.encode(source).length;
  const outputBytes = encoder.encode(html);
  const astNodes = ast.length + headings.length * 2 + (headings.length ? 2 : 0) + linkCount +
    figureCount;
  return {
    ast,
    html,
    outputBytes,
    rejected,
    counters: {
      documents: 1,
      "input-bytes": inputBytes,
      tokens: ast.length,
      "ast-nodes": astNodes,
      transforms,
      "sanitizer-checks": sanitizerChecks,
      "output-bytes": outputBytes.length,
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
  if (input.length > RAW_HTML_LIMIT_BYTES) {
    throw new Error(`input exceeds ${RAW_HTML_LIMIT_BYTES} UTF-8 bytes`);
  }
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
  const nodeCount = parse(inputPtr, input.length, astPtr, 4096);
  transform(inputPtr, astPtr, nodeCount, metaPtr);
  sanitize(inputPtr, astPtr, nodeCount, metaPtr);
  const outputLength = render(inputPtr, astPtr, nodeCount, outputPtr, outputCap, metaPtr);
  const htmlBytes = new Uint8Array(memory.buffer.slice(outputPtr, outputPtr + outputLength));
  const view = new DataView(memory.buffer);
  return {
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
      "boundary-crossings": 4,
    },
  };
}
