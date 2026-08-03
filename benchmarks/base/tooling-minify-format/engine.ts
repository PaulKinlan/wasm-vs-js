import type { Language, Operation } from "./contract.ts";

export interface Counters {
  inputBytes: number;
  outputBytes: number;
  tokens: number;
  nodes: number;
  transforms: number;
  allocations: number;
  boundaryCrossings: number;
}
export interface TransformResult {
  output: Uint8Array;
  counters: Counters;
}
const SPACE = 32, LF = 10;
function word(b: number): boolean {
  return b >= 128 || b >= 48 && b <= 57 || b >= 65 && b <= 90 || b >= 97 && b <= 122 || b === 95 ||
    b === 36 || b === 45;
}
function whitespace(b: number): boolean {
  return b === 32 || b === 9 || b === 10 || b === 13;
}
function starts(bytes: Uint8Array, i: number, text: string): boolean {
  for (let j = 0; j < text.length; j++) if (bytes[i + j] !== text.charCodeAt(j)) return false;
  return true;
}
function cleanSource(
  input: Uint8Array,
  language: Language,
): { bytes: Uint8Array; tokens: number; nodes: number; transforms: number } {
  const out: number[] = [];
  let quote = 0,
    escaped = false,
    pendingSpace = false,
    tokens = 0,
    nodes = 0,
    transforms = 0,
    braces = 0;
  let inWord = false;
  for (let i = 0; i < input.length;) {
    const b = input[i];
    if (quote) {
      out.push(b);
      if (escaped) escaped = false;
      else if (b === 92) escaped = true;
      else if (b === quote) quote = 0;
      i++;
      continue;
    }
    if (language === "html" && starts(input, i, "<!--")) {
      const end = input.indexOf(45, i + 4);
      let j = end;
      while (j >= 0 && j + 2 < input.length && !starts(input, j, "-->")) {
        j = input.indexOf(45, j + 1);
      }
      if (j < 0) throw new Error("unterminated HTML comment");
      i = j + 3;
      transforms++;
      pendingSpace = true;
      continue;
    }
    if (language !== "html" && b === 47 && input[i + 1] === 42) {
      let j = i + 2;
      while (j + 1 < input.length && !(input[j] === 42 && input[j + 1] === 47)) j++;
      if (j + 1 >= input.length) throw new Error("unterminated block comment");
      i = j + 2;
      transforms++;
      pendingSpace = true;
      continue;
    }
    if (language === "javascript" && b === 47 && input[i + 1] === 47) {
      i += 2;
      while (i < input.length && input[i] !== LF) i++;
      transforms++;
      pendingSpace = true;
      continue;
    }
    if (whitespace(b)) {
      pendingSpace = true;
      i++;
      continue;
    }
    const currentWord = word(b);
    if (pendingSpace && out.length && word(out[out.length - 1]) && currentWord) out.push(SPACE);
    pendingSpace = false;
    if (b === 34 || b === 39 || language === "javascript" && b === 96) {
      quote = b;
      tokens++;
      inWord = false;
    } else if (currentWord) {
      if (!inWord) tokens++;
      inWord = true;
    } else {
      tokens++;
      inWord = false;
    }
    if (language !== "html") {
      if (b === 123) {
        braces++;
        nodes++;
      } else if (b === 125) {
        if (--braces < 0) throw new Error("unbalanced brace");
        nodes++;
      } else if (b === 59) nodes++;
    } else if (b === 60) nodes++;
    out.push(b);
    i++;
  }
  if (quote) throw new Error("unterminated quote");
  if (braces) throw new Error("unbalanced brace");
  const bytes = Uint8Array.from(out);
  if (language === "html") validateHtmlStructure(bytes);
  return { bytes, tokens, nodes, transforms };
}
function validateHtmlStructure(clean: Uint8Array): void {
  let depth = 0;
  for (let i = 0; i < clean.length;) {
    if (clean[i] !== 60) {
      i++;
      continue;
    }
    let j = i;
    while (j < clean.length && clean[j] !== 62) j++;
    if (j === clean.length) throw new Error("unterminated HTML tag");
    const closing = clean[i + 1] === 47, declaration = clean[i + 1] === 33;
    let selfClosing = clean[j - 1] === 47 || declaration;
    const tag = new TextDecoder().decode(clean.slice(i + (closing ? 2 : 1), j)).split(
      /[\s/>]/,
      1,
    )[0].toLowerCase();
    if (["meta", "link", "img", "br", "hr", "input"].includes(tag)) selfClosing = true;
    if (closing && --depth < 0) throw new Error("unbalanced HTML tag");
    if (!closing && !selfClosing) depth++;
    i = j + 1;
  }
  if (depth) throw new Error("unbalanced HTML tag");
}
function indent(out: number[], depth: number): void {
  for (let i = 0; i < depth * 2; i++) out.push(SPACE);
}
function formatBraced(clean: Uint8Array): Uint8Array {
  const out: number[] = [];
  let depth = 0, lineStart = true, quote = 0, escaped = false;
  const emitIndent = () => {
    if (lineStart) {
      indent(out, depth);
      lineStart = false;
    }
  };
  const newline = () => {
    while (out[out.length - 1] === SPACE) out.pop();
    if (out[out.length - 1] !== LF) out.push(LF);
    lineStart = true;
  };
  for (const b of clean) {
    if (quote) {
      emitIndent();
      out.push(b);
      if (escaped) escaped = false;
      else if (b === 92) escaped = true;
      else if (b === quote) quote = 0;
      continue;
    }
    if (b === 34 || b === 39 || b === 96) {
      emitIndent();
      quote = b;
      out.push(b);
    } else if (b === 123) {
      emitIndent();
      if (out.length && out[out.length - 1] !== SPACE) out.push(SPACE);
      out.push(b);
      depth++;
      newline();
    } else if (b === 125) {
      depth--;
      newline();
      emitIndent();
      out.push(b);
      newline();
    } else if (b === 59) {
      emitIndent();
      out.push(b);
      newline();
    } else {
      emitIndent();
      out.push(b);
    }
  }
  while (out[out.length - 1] === LF) out.pop();
  out.push(LF);
  return Uint8Array.from(out);
}
function formatHtml(clean: Uint8Array): Uint8Array {
  const out: number[] = [];
  let i = 0, depth = 0;
  while (i < clean.length) {
    if (clean[i] !== 60) {
      let j = i;
      while (j < clean.length && clean[j] !== 60) j++;
      const text = clean.slice(i, j);
      if (text.length) {
        indent(out, depth);
        out.push(...text, LF);
      }
      i = j;
      continue;
    }
    let j = i;
    while (j < clean.length && clean[j] !== 62) j++;
    if (j === clean.length) throw new Error("unterminated HTML tag");
    const closing = clean[i + 1] === 47;
    const declaration = clean[i + 1] === 33;
    let selfClosing = clean[j - 1] === 47 || declaration;
    const tag = new TextDecoder().decode(clean.slice(i + (closing ? 2 : 1), j)).split(
      /[\s/>]/,
      1,
    )[0].toLowerCase();
    if (["meta", "link", "img", "br", "hr", "input"].includes(tag)) selfClosing = true;
    if (closing) { if (--depth < 0) throw new Error("unbalanced HTML tag"); }
    indent(out, depth);
    out.push(...clean.slice(i, j + 1), LF);
    if (!closing && !selfClosing) depth++;
    i = j + 1;
  }
  if (depth) throw new Error("unbalanced HTML tag");
  return Uint8Array.from(out);
}
export function transformJs(
  input: Uint8Array,
  language: Language,
  operation: Operation,
): TransformResult {
  const clean = cleanSource(input, language);
  const output = operation === "minify"
    ? clean.bytes
    : language === "html"
    ? formatHtml(clean.bytes)
    : formatBraced(clean.bytes);
  return {
    output,
    counters: {
      inputBytes: input.byteLength,
      outputBytes: output.byteLength,
      tokens: clean.tokens,
      nodes: clean.nodes,
      transforms: clean.transforms + (operation === "format" ? clean.nodes : 0),
      allocations: 2,
      boundaryCrossings: 0,
    },
  };
}
