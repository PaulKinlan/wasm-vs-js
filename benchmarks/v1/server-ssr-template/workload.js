// Controlled implementation for frozen catalog row server.ssr-template.v1.
// The catalog itself is immutable. This module defines the supplemental exact contract.

export const WORKLOAD_ID = "server.ssr-template.v1";
export const RECORDS = 1_000;
export const GENERATOR_SEED = 0x53535231;
export const FIXTURE_MAGIC = 0x31465353; // SSF1, little endian.
export const OUTPUT_MAGIC = 0x314f5353; // SSO1, little endian.
export const MAX_OUTPUT_BYTES = 4 * 1024 * 1024;
export const TOKEN_COUNT_PER_RESPONSE = 23;
export const COUNTER_NAMES = [
  "responses",
  "parsed-fields",
  "template-tokens",
  "text-escapes",
  "attribute-escapes",
  "url-escapes",
  "integer-formats",
  "date-formats",
  "input-bytes",
  "output-bytes",
  "allocations",
  "boundary-crossings",
];

const encoder = new TextEncoder();
const decoder = new TextDecoder("utf-8", { fatal: true });

function next(state) {
  state ^= state << 13;
  state ^= state >>> 17;
  state ^= state << 5;
  return state >>> 0;
}

const PRODUCT_NAMES = [
  "Café & <東京>",
  'Crème "édition"',
  "Emoji 🚀 collection",
  "e\u0301 and é forms",
  "</h1><script>blocked()</script>",
  "العربية 日本語 हिन्दी",
];
const USER_NAMES = [
  "Ada & Lin",
  'Grace "G"',
  "李 <雷>",
  "Zoë 🚀",
  "O'Reilly",
  "</a><img src=x>",
];
const SLUGS = [
  "cafe 東京",
  "quotes\"and'apostrophe",
  "../escape?x=<script>",
  "emoji-🚀",
  "percent%slash/space ",
  "العربية",
];

class Writer {
  constructor(capacity = MAX_OUTPUT_BYTES) {
    this.bytes = new Uint8Array(capacity);
    this.offset = 0;
  }
  require(length) {
    if (!Number.isSafeInteger(length) || length < 0 || this.offset + length > this.bytes.length) {
      throw new Error("output capacity exceeded");
    }
  }
  u8(value) {
    this.require(1);
    this.bytes[this.offset++] = value;
  }
  u32(value) {
    this.require(4);
    new DataView(this.bytes.buffer).setUint32(this.offset, value >>> 0, true);
    this.offset += 4;
  }
  overwriteU32(offset, value) {
    new DataView(this.bytes.buffer).setUint32(offset, value >>> 0, true);
  }
  raw(bytes) {
    this.require(bytes.length);
    this.bytes.set(bytes, this.offset);
    this.offset += bytes.length;
  }
  literal(value) {
    this.raw(encoder.encode(value));
  }
  finish() {
    return this.bytes.slice(0, this.offset);
  }
}

function fixtureString(writer, value) {
  const bytes = encoder.encode(value);
  writer.u32(bytes.length);
  writer.raw(bytes);
}

export function generateFixture(count = RECORDS) {
  if (count !== RECORDS) throw new Error(`contract requires exactly ${RECORDS} records`);
  const writer = new Writer(1024 * 1024);
  writer.u32(FIXTURE_MAGIC);
  writer.u32(count);
  let state = GENERATOR_SEED;
  for (let index = 0; index < count; index++) {
    state = next(state);
    writer.u32(10_000 + index);
    writer.u32(50_000 + (state % 25_000));
    writer.u32(100 + (state % 999_900));
    const year = 2026 + Math.floor(index / 336);
    const month = 1 + (Math.floor(index / 28) % 12);
    const day = 1 + (index % 28);
    writer.u32(year * 10_000 + month * 100 + day);
    fixtureString(writer, `${PRODUCT_NAMES[index % PRODUCT_NAMES.length]} #${index}`);
    fixtureString(writer, `${USER_NAMES[(state >>> 8) % USER_NAMES.length]} #${index}`);
    fixtureString(writer, `${SLUGS[(state >>> 16) % SLUGS.length]}-${index}`);
  }
  return writer.finish();
}

function readU32(bytes, state) {
  if (state.offset + 4 > bytes.length) throw new Error("truncated u32 field");
  const value = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength).getUint32(
    state.offset,
    true,
  );
  state.offset += 4;
  return value;
}

function readBytes(bytes, state) {
  const length = readU32(bytes, state);
  if (length > 65_536 || state.offset + length > bytes.length) {
    throw new Error("truncated or oversized string field");
  }
  const value = bytes.subarray(state.offset, state.offset + length);
  decoder.decode(value); // Fatal UTF-8 validation is part of the parse contract.
  state.offset += length;
  return value;
}

function readRecord(bytes, state) {
  const productId = readU32(bytes, state);
  const userId = readU32(bytes, state);
  const priceCents = readU32(bytes, state);
  const dateYmd = readU32(bytes, state);
  const productName = readBytes(bytes, state);
  const userName = readBytes(bytes, state);
  const slug = readBytes(bytes, state);
  return { productId, userId, priceCents, dateYmd, productName, userName, slug };
}

const TEXT_ESCAPES = new Map([
  [38, "&amp;"],
  [60, "&lt;"],
  [62, "&gt;"],
]);
const ATTRIBUTE_ESCAPES = new Map([
  ...TEXT_ESCAPES,
  [34, "&quot;"],
  [39, "&#39;"],
]);

function escaped(writer, bytes, table) {
  for (const byte of bytes) {
    const replacement = table.get(byte);
    if (replacement) writer.literal(replacement);
    else writer.u8(byte);
  }
}

function urlComponent(writer, bytes) {
  const hex = "0123456789ABCDEF";
  for (const byte of bytes) {
    const unreserved = (byte >= 65 && byte <= 90) || (byte >= 97 && byte <= 122) ||
      (byte >= 48 && byte <= 57) || byte === 45 || byte === 46 || byte === 95 || byte === 126;
    if (unreserved) writer.u8(byte);
    else {
      writer.u8(37);
      writer.u8(hex.charCodeAt(byte >>> 4));
      writer.u8(hex.charCodeAt(byte & 15));
    }
  }
}

function decimal(writer, value, minimum = 1) {
  if (!Number.isSafeInteger(value) || value < 0 || value > 0xffff_ffff) {
    throw new Error("integer outside unsigned 32-bit contract");
  }
  const digits = [];
  do {
    digits.push(48 + (value % 10));
    value = Math.floor(value / 10);
  } while (value || digits.length < minimum);
  for (let index = digits.length - 1; index >= 0; index--) writer.u8(digits[index]);
}

function date(writer, ymd) {
  const year = Math.floor(ymd / 10_000);
  const month = Math.floor(ymd / 100) % 100;
  const day = ymd % 100;
  if (year < 2026 || year > 9999 || month < 1 || month > 12 || day < 1 || day > 28) {
    throw new Error("date outside frozen Gregorian subset");
  }
  decimal(writer, year, 4);
  writer.u8(45);
  decimal(writer, month, 2);
  writer.u8(45);
  decimal(writer, day, 2);
}

function price(writer, cents) {
  decimal(writer, Math.floor(cents / 100));
  writer.u8(46);
  decimal(writer, cents % 100, 2);
}

function renderRecord(writer, record) {
  writer.literal('<!doctype html><html lang="en"><body><article data-product="');
  decimal(writer, record.productId);
  writer.literal('"><h1>');
  escaped(writer, record.productName, TEXT_ESCAPES);
  writer.literal('</h1><p data-user="');
  decimal(writer, record.userId);
  writer.literal('" aria-label="Catalog for ');
  escaped(writer, record.userName, ATTRIBUTE_ESCAPES);
  writer.literal('">Hello, ');
  escaped(writer, record.userName, TEXT_ESCAPES);
  writer.literal('.</p><p class="price" data-cents="');
  decimal(writer, record.priceCents);
  writer.literal('">USD ');
  price(writer, record.priceCents);
  writer.literal('</p><a href="/catalog/');
  urlComponent(writer, record.slug);
  writer.literal("?for=");
  urlComponent(writer, record.userName);
  writer.literal('">Open</a><time datetime="');
  date(writer, record.dateYmd);
  writer.literal('">');
  date(writer, record.dateYmd);
  writer.literal("</time></article></body></html>");
}

export function renderJavaScript(fixture) {
  if (!(fixture instanceof Uint8Array)) throw new TypeError("fixture must be Uint8Array");
  const state = { offset: 0 };
  if (readU32(fixture, state) !== FIXTURE_MAGIC) throw new Error("fixture magic mismatch");
  if (readU32(fixture, state) !== RECORDS) throw new Error("fixture record count mismatch");
  const writer = new Writer();
  writer.u32(OUTPUT_MAGIC);
  writer.u32(RECORDS);
  for (let index = 0; index < RECORDS; index++) {
    const record = readRecord(fixture, state);
    const lengthOffset = writer.offset;
    writer.u32(0);
    const start = writer.offset;
    renderRecord(writer, record);
    writer.overwriteU32(lengthOffset, writer.offset - start);
  }
  if (state.offset !== fixture.length) throw new Error("fixture has trailing bytes");
  const output = writer.finish();
  return {
    output,
    counters: {
      responses: RECORDS,
      "parsed-fields": RECORDS * 7,
      "template-tokens": RECORDS * TOKEN_COUNT_PER_RESPONSE,
      "text-escapes": RECORDS * 2,
      "attribute-escapes": RECORDS,
      "url-escapes": RECORDS * 2,
      "integer-formats": RECORDS * 4,
      "date-formats": RECORDS * 2,
      "input-bytes": fixture.length,
      "output-bytes": output.length,
      allocations: 1,
      "boundary-crossings": 0,
    },
  };
}

export function parseOutput(output) {
  const state = { offset: 0 };
  if (readU32(output, state) !== OUTPUT_MAGIC) throw new Error("output magic mismatch");
  if (readU32(output, state) !== RECORDS) throw new Error("output record count mismatch");
  const responses = [];
  for (let index = 0; index < RECORDS; index++) responses.push(readBytes(output, state));
  if (state.offset !== output.length) throw new Error("output has trailing bytes");
  return responses;
}

export async function instantiateSsrWasm(bytes) {
  const result = await WebAssembly.instantiate(bytes, {});
  const exports = result.instance.exports;
  for (const name of ["memory", "input_ptr", "output_ptr", "counters_ptr", "render_corpus"]) {
    if (!(name in exports)) throw new Error(`missing Wasm export ${name}`);
  }
  return exports;
}

export function renderWasm(exports, fixture) {
  const inputPtr = exports.input_ptr();
  const outputPtr = exports.output_ptr();
  const countersPtr = exports.counters_ptr();
  const memory = new Uint8Array(exports.memory.buffer);
  if (inputPtr + fixture.length > memory.length) throw new Error("fixture exceeds Wasm memory");
  memory.set(fixture, inputPtr);
  const length = exports.render_corpus(
    inputPtr,
    fixture.length,
    outputPtr,
    MAX_OUTPUT_BYTES,
    countersPtr,
  );
  if (length < 0) throw new Error(`Wasm rejected fixture with code ${length}`);
  const output = memory.slice(outputPtr, outputPtr + length);
  const counterView = new DataView(exports.memory.buffer, countersPtr, COUNTER_NAMES.length * 4);
  const counters = Object.fromEntries(
    COUNTER_NAMES.map((name, index) => [name, counterView.getUint32(index * 4, true)]),
  );
  return { output, counters };
}
