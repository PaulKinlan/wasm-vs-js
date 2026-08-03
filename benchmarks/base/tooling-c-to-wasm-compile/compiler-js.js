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

function createCounters(sourceBytes, headerBytes) {
  return {
    sourceBytes,
    headerBytes,
    tokens: 0,
    astNodes: 0,
    functions: 0,
    instructions: 0,
    linkSections: 0,
    vfsReads: 0,
    allocations: 0,
    boundaryCrossings: 0,
    outputBytes: 0,
  };
}

function allocateBuffer(counters) {
  counters.allocations += 1;
  return [];
}

function emitUnsignedLeb(out, value) {
  do {
    let byte = value & 0x7f;
    value >>>= 7;
    if (value !== 0) byte |= 0x80;
    out.push(byte);
  } while (value !== 0);
}

function emitSignedLeb(out, value) {
  value |= 0;
  let more = true;
  while (more) {
    let byte = value & 0x7f;
    value >>= 7;
    const sign = (byte & 0x40) !== 0;
    more = !((value === 0 && !sign) || (value === -1 && sign));
    if (more) byte |= 0x80;
    out.push(byte);
  }
}

function emitSection(out, counters, id, emitPayload) {
  const lengthOffset = out.length;
  out.push(id, 0);
  const payloadStart = out.length;
  emitPayload();
  const payloadLength = out.length - payloadStart;
  if (payloadLength >= 128) {
    if (payloadLength >= 16_384) throw new Error("section exceeds admitted compiler bound");
    out.push(0);
    for (let index = out.length - 1; index > lengthOffset + 2; index -= 1) {
      out[index] = out[index - 1];
    }
    out[lengthOffset + 1] = (payloadLength & 0x7f) | 0x80;
    out[lengthOffset + 2] = payloadLength >>> 7;
  } else {
    out[lengthOffset + 1] = payloadLength;
  }
  counters.linkSections += 1;
}

function isIdentifierContinue(code) {
  return (code >= 65 && code <= 90) || (code >= 97 && code <= 122) ||
    (code >= 48 && code <= 57) || code === 95;
}

function tokenize(source, counters) {
  const tokens = allocateBuffer(counters);
  let cursor = 0;
  while (cursor < source.length) {
    const code = source.charCodeAt(cursor);
    if (code === 9 || code === 10 || code === 13 || code === 32) {
      cursor += 1;
      continue;
    }
    const pair = source.slice(cursor, cursor + 2);
    if (pair === "<<" || pair === ">>") {
      tokens.push(pair);
      counters.tokens += 1;
      cursor += 2;
      continue;
    }
    const ch = source[cursor];
    if ("(){};+-*&|^".includes(ch)) {
      tokens.push(ch);
      counters.tokens += 1;
      cursor += 1;
      continue;
    }
    if (code >= 48 && code <= 57) {
      const start = cursor;
      do cursor += 1; while (
        cursor < source.length && source.charCodeAt(cursor) >= 48 &&
        source.charCodeAt(cursor) <= 57
      );
      tokens.push(source.slice(start, cursor));
      counters.tokens += 1;
      continue;
    }
    if ((code >= 65 && code <= 90) || (code >= 97 && code <= 122) || code === 95) {
      const start = cursor;
      do cursor += 1; while (
        cursor < source.length && isIdentifierContinue(source.charCodeAt(cursor))
      );
      tokens.push(source.slice(start, cursor));
      counters.tokens += 1;
      continue;
    }
    throw new Error(`unsupported C byte at ${cursor}`);
  }
  return tokens;
}

function parser(tokens, base, expression, counters) {
  let cursor = 0;
  const expect = (token) => {
    if (tokens[cursor] !== token) throw new Error(`expected ${token} at token ${cursor}`);
    cursor += 1;
  };
  const primary = () => {
    if (tokens[cursor] === "(") {
      cursor += 1;
      const value = bitOr();
      expect(")");
      return value;
    }
    if (tokens[cursor] === "-") {
      cursor += 1;
      expression.push(0x41, 0x00);
      counters.instructions += 1;
      const value = primary();
      expression.push(0x6b);
      counters.astNodes += 1;
      counters.instructions += 1;
      return (-value) | 0;
    }
    const token = tokens[cursor++];
    let value;
    if (token === "BASE") {
      value = base;
    } else {
      if (!/^\d+$/.test(token ?? "")) {
        throw new Error(`integer expression required at token ${cursor - 1}`);
      }
      value = Number(token);
      if (!Number.isSafeInteger(value) || value > 0x7fffffff) {
        throw new Error("i32 literal out of range");
      }
    }
    expression.push(0x41);
    emitSignedLeb(expression, value);
    counters.astNodes += 1;
    counters.instructions += 1;
    return value | 0;
  };
  const binary = (next, operators, evaluate) => () => {
    let value = next();
    while (operators.includes(tokens[cursor])) {
      const operator = tokens[cursor++];
      const right = next();
      if ((operator === "<<" || operator === ">>") && (right < 0 || right >= 32)) {
        throw new Error(`shift count ${right} outside 0..31`);
      }
      expression.push(OPCODES[operator]);
      counters.astNodes += 1;
      counters.instructions += 1;
      value = evaluate(operator, value, right);
    }
    return value;
  };
  const multiply = binary(primary, ["*"], (_operator, left, right) => Math.imul(left, right));
  const add = binary(
    multiply,
    ["+", "-"],
    (operator, left, right) => operator === "+" ? (left + right) | 0 : (left - right) | 0,
  );
  const shift = binary(
    add,
    ["<<", ">>"],
    (operator, left, right) => operator === "<<" ? left << right : left >> right,
  );
  const bitAnd = binary(shift, ["&"], (_operator, left, right) => left & right);
  const bitXor = binary(bitAnd, ["^"], (_operator, left, right) => left ^ right);
  const bitOr = binary(bitXor, ["|"], (_operator, left, right) => left | right);

  expect("int");
  expect("test");
  expect("(");
  expect("void");
  expect(")");
  expect("{");
  expect("return");
  bitOr();
  expect(";");
  expect("}");
  if (cursor !== tokens.length) throw new Error("trailing C tokens denied");
  counters.astNodes += 2;
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
  const counters = createCounters(source.length, header.length);
  counters.vfsReads += 1;
  const include = '#include "fixture.h"';
  if (!source.startsWith(`${include}\n`)) throw new Error("fixture.h include required first");
  counters.vfsReads += 1;
  const headerMatch = header.match(/^#define BASE (-?\d+)\n$/);
  if (!headerMatch) throw new Error("fixture.h must define one BASE i32");
  const base = Number(headerMatch[1]);
  if (!Number.isSafeInteger(base) || base < -0x80000000 || base > 0x7fffffff) {
    throw new Error("BASE out of i32 range");
  }

  const tokens = tokenize(source.slice(include.length + 1), counters);
  const expression = allocateBuffer(counters);
  parser(tokens, base, expression, counters);
  const moduleBytes = allocateBuffer(counters);
  moduleBytes.push(0x00, 0x61, 0x73, 0x6d, 0x01, 0x00, 0x00, 0x00);
  emitSection(moduleBytes, counters, 1, () => moduleBytes.push(0x01, 0x60, 0x00, 0x01, 0x7f));
  emitSection(moduleBytes, counters, 3, () => {
    moduleBytes.push(0x01, 0x00);
    counters.functions += 1;
  });
  emitSection(
    moduleBytes,
    counters,
    7,
    () => moduleBytes.push(0x01, 0x04, 0x74, 0x65, 0x73, 0x74, 0x00, 0x00),
  );
  emitSection(moduleBytes, counters, 10, () => {
    moduleBytes.push(0x01);
    emitUnsignedLeb(moduleBytes, expression.length + 2);
    moduleBytes.push(0x00, ...expression, 0x0b);
  });
  counters.allocations += 1;
  const bytes = new Uint8Array(moduleBytes);
  counters.outputBytes = bytes.byteLength;
  return { bytes, counters };
}
