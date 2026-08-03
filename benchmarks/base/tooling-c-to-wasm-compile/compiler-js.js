const encoder = new TextEncoder();

const OPCODES = Object.freeze({
  "+": 0x6a,
  "-": 0x6b,
  "*": 0x6c,
  "&": 0x71,
  "|": 0x72,
  "^": 0x73,
  "<<": 0x74,
  ">>": 0x75,
});

function unsignedLeb(value) {
  const bytes = [];
  do {
    let byte = value & 0x7f;
    value >>>= 7;
    if (value !== 0) byte |= 0x80;
    bytes.push(byte);
  } while (value !== 0);
  return bytes;
}

function signedLeb(value) {
  const bytes = [];
  value |= 0;
  let more = true;
  while (more) {
    let byte = value & 0x7f;
    value >>= 7;
    const sign = (byte & 0x40) !== 0;
    more = !((value === 0 && !sign) || (value === -1 && sign));
    if (more) byte |= 0x80;
    bytes.push(byte);
  }
  return bytes;
}

function section(id, payload) {
  return [id, ...unsignedLeb(payload.length), ...payload];
}

function tokenize(source) {
  const tokens = [];
  let cursor = 0;
  while (cursor < source.length) {
    const ch = source[cursor];
    if (/\s/.test(ch)) {
      cursor += 1;
      continue;
    }
    const pair = source.slice(cursor, cursor + 2);
    if (pair === "<<" || pair === ">>") {
      tokens.push(pair);
      cursor += 2;
      continue;
    }
    if ("(){};+-*&|^".includes(ch)) {
      tokens.push(ch);
      cursor += 1;
      continue;
    }
    const number = source.slice(cursor).match(/^\d+/)?.[0];
    if (number) {
      tokens.push(number);
      cursor += number.length;
      continue;
    }
    const identifier = source.slice(cursor).match(/^[A-Za-z_][A-Za-z0-9_]*/)?.[0];
    if (identifier) {
      tokens.push(identifier);
      cursor += identifier.length;
      continue;
    }
    throw new Error(`unsupported C byte at ${cursor}`);
  }
  return tokens;
}

function parser(tokens, base) {
  let cursor = 0;
  let astNodes = 0;
  let instructions = 0;
  const expect = (token) => {
    if (tokens[cursor] !== token) throw new Error(`expected ${token} at token ${cursor}`);
    cursor += 1;
  };
  const primary = () => {
    if (tokens[cursor] === "(") {
      cursor += 1;
      const code = bitOr();
      expect(")");
      return code;
    }
    if (tokens[cursor] === "-") {
      cursor += 1;
      const code = primary();
      astNodes += 1;
      instructions += 2;
      return [0x41, 0x00, ...code, 0x6b];
    }
    const token = tokens[cursor++];
    if (token === "BASE") {
      astNodes += 1;
      instructions += 1;
      return [0x41, ...signedLeb(base)];
    }
    if (!/^\d+$/.test(token ?? "")) {
      throw new Error(`integer expression required at token ${cursor - 1}`);
    }
    const value = Number(token);
    if (!Number.isSafeInteger(value) || value > 0x7fffffff) {
      throw new Error("i32 literal out of range");
    }
    astNodes += 1;
    instructions += 1;
    return [0x41, ...signedLeb(value)];
  };
  const binary = (next, operators) => () => {
    let code = next();
    while (operators.includes(tokens[cursor])) {
      const operator = tokens[cursor++];
      const right = next();
      code = [...code, ...right, OPCODES[operator]];
      astNodes += 1;
      instructions += 1;
    }
    return code;
  };
  const multiply = binary(primary, ["*"]);
  const add = binary(multiply, ["+", "-"]);
  const shift = binary(add, ["<<", ">>"]);
  const bitAnd = binary(shift, ["&"]);
  const bitXor = binary(bitAnd, ["^"]);
  const bitOr = binary(bitXor, ["|"]);

  expect("int");
  expect("test");
  expect("(");
  expect("void");
  expect(")");
  expect("{");
  expect("return");
  const expression = bitOr();
  expect(";");
  expect("}");
  if (cursor !== tokens.length) throw new Error("trailing C tokens denied");
  return { expression, astNodes, instructions };
}

export function compileC(source, header) {
  if (typeof source !== "string" || typeof header !== "string") {
    throw new TypeError("source/header strings required");
  }
  for (const value of source + header) {
    const code = value.charCodeAt(0);
    if (code !== 9 && code !== 10 && code !== 13 && (code < 32 || code > 126)) {
      throw new Error("ASCII C subset required");
    }
  }
  const include = '#include "fixture.h"';
  if (!source.startsWith(`${include}\n`)) throw new Error("fixture.h include required first");
  const headerMatch = header.match(/^#define BASE (-?\d+)\n$/);
  if (!headerMatch) throw new Error("fixture.h must define one BASE i32");
  const base = Number(headerMatch[1]);
  if (!Number.isSafeInteger(base) || base < -0x80000000 || base > 0x7fffffff) {
    throw new Error("BASE out of i32 range");
  }
  const body = source.slice(include.length + 1);
  const tokens = tokenize(body);
  const parsed = parser(tokens, base);
  const functionBody = [0x00, ...parsed.expression, 0x0b];
  const codePayload = [0x01, ...unsignedLeb(functionBody.length), ...functionBody];
  const bytes = new Uint8Array([
    0x00,
    0x61,
    0x73,
    0x6d,
    0x01,
    0x00,
    0x00,
    0x00,
    ...section(1, [0x01, 0x60, 0x00, 0x01, 0x7f]),
    ...section(3, [0x01, 0x00]),
    ...section(7, [0x01, 0x04, 0x74, 0x65, 0x73, 0x74, 0x00, 0x00]),
    ...section(10, codePayload),
  ]);
  return {
    bytes,
    counters: {
      sourceBytes: encoder.encode(source).byteLength,
      headerBytes: encoder.encode(header).byteLength,
      tokens: tokens.length,
      astNodes: parsed.astNodes + 2,
      functions: 1,
      instructions: parsed.instructions,
      linkSections: 4,
      vfsReads: 2,
      allocations: 4,
      boundaryCrossings: 0,
      outputBytes: bytes.byteLength,
    },
  };
}
