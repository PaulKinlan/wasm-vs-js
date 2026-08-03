export const ENTRY_COUNT = 10_000;
export const BOUNDED_ENTRY_COUNT = 1_000;
export const SELECTED_INDICES = Object.freeze([0, 1, 17, 997, 2048, 4096, 7001, 8191, 9998, 9999]);
export const ZIP_POLICY = Object.freeze({
  algorithmFamily: "zip-fixed-deflate-metadata",
  compressionMethod: 8,
  deflateBlockType: "fixed-huffman",
  lzPolicy: "greedy-nearest-match, 1,024-byte search window, 3..258-byte matches",
  level: 1,
  utf8Flag: 0x0800,
  dosTime: 0,
  dosDate: 0x21,
  creatorVersion: 0x0314,
  extractVersion: 20,
  unixMode: 0o100644,
  zip64: "forbidden-under-frozen-bounds",
});

const encoder = new TextEncoder();

function invariant(value, message) {
  if (!value) throw new Error(message);
}

class Writer {
  constructor(capacity = 1024) {
    this.bytes = new Uint8Array(capacity);
    this.length = 0;
  }
  ensure(additional) {
    const needed = this.length + additional;
    if (needed <= this.bytes.length) return;
    let capacity = this.bytes.length;
    while (capacity < needed) capacity *= 2;
    const next = new Uint8Array(capacity);
    next.set(this.bytes.subarray(0, this.length));
    this.bytes = next;
  }
  u8(value) {
    this.ensure(1);
    this.bytes[this.length++] = value & 255;
  }
  u16(value) {
    this.ensure(2);
    this.bytes[this.length++] = value & 255;
    this.bytes[this.length++] = (value >>> 8) & 255;
  }
  u32(value) {
    this.ensure(4);
    this.bytes[this.length++] = value & 255;
    this.bytes[this.length++] = (value >>> 8) & 255;
    this.bytes[this.length++] = (value >>> 16) & 255;
    this.bytes[this.length++] = (value >>> 24) & 255;
  }
  append(value) {
    this.ensure(value.length);
    this.bytes.set(value, this.length);
    this.length += value.length;
  }
  finish() {
    return this.bytes.slice(0, this.length);
  }
}

function u16(bytes, offset) {
  return bytes[offset] | (bytes[offset + 1] << 8);
}
function u32(bytes, offset) {
  return (bytes[offset] | (bytes[offset + 1] << 8) | (bytes[offset + 2] << 16) |
    (bytes[offset + 3] << 24)) >>> 0;
}

function reverseBits(value, width) {
  let result = 0;
  for (let i = 0; i < width; i++) result = (result << 1) | ((value >>> i) & 1);
  return result >>> 0;
}

function fixedCode(symbol) {
  if (symbol <= 143) return [reverseBits(0x30 + symbol, 8), 8];
  if (symbol <= 255) return [reverseBits(0x190 + symbol - 144, 9), 9];
  if (symbol <= 279) return [reverseBits(symbol - 256, 7), 7];
  return [reverseBits(0xc0 + symbol - 280, 8), 8];
}

const LENGTH_BASE = [
  3,
  4,
  5,
  6,
  7,
  8,
  9,
  10,
  11,
  13,
  15,
  17,
  19,
  23,
  27,
  31,
  35,
  43,
  51,
  59,
  67,
  83,
  99,
  115,
  131,
  163,
  195,
  227,
  258,
];
const LENGTH_EXTRA = [
  0,
  0,
  0,
  0,
  0,
  0,
  0,
  0,
  1,
  1,
  1,
  1,
  2,
  2,
  2,
  2,
  3,
  3,
  3,
  3,
  4,
  4,
  4,
  4,
  5,
  5,
  5,
  5,
  0,
];
const DIST_BASE = [
  1,
  2,
  3,
  4,
  5,
  7,
  9,
  13,
  17,
  25,
  33,
  49,
  65,
  97,
  129,
  193,
  257,
  385,
  513,
  769,
  1025,
  1537,
  2049,
  3073,
  4097,
  6145,
  8193,
  12289,
  16385,
  24577,
];
const DIST_EXTRA = [
  0,
  0,
  0,
  0,
  1,
  1,
  2,
  2,
  3,
  3,
  4,
  4,
  5,
  5,
  6,
  6,
  7,
  7,
  8,
  8,
  9,
  9,
  10,
  10,
  11,
  11,
  12,
  12,
  13,
  13,
];

function deflateFixed(input) {
  const out = [];
  let accumulator = 0;
  let bits = 0;
  let literals = 0;
  let matches = 0;
  let matchedBytes = 0;
  const writeBits = (value, width) => {
    accumulator |= value << bits;
    bits += width;
    while (bits >= 8) {
      out.push(accumulator & 255);
      accumulator >>>= 8;
      bits -= 8;
    }
  };
  const writeSymbol = (symbol) => {
    const [code, width] = fixedCode(symbol);
    writeBits(code, width);
  };
  writeBits(1, 1);
  writeBits(1, 2);
  let position = 0;
  while (position < input.length) {
    let bestLength = 0;
    let bestDistance = 0;
    const earliest = Math.max(0, position - 1024);
    for (let candidate = position - 1; candidate >= earliest; candidate--) {
      let length = 0;
      while (
        length < 258 && position + length < input.length &&
        input[candidate + length] === input[position + length]
      ) length++;
      if (length >= 3 && length > bestLength) {
        bestLength = length;
        bestDistance = position - candidate;
      }
    }
    if (bestLength >= 3) {
      let lengthIndex = LENGTH_BASE.length - 1;
      for (let index = 0; index < LENGTH_BASE.length; index++) {
        const maximum = LENGTH_BASE[index] + ((1 << LENGTH_EXTRA[index]) - 1);
        if (bestLength <= maximum) {
          lengthIndex = index;
          break;
        }
      }
      writeSymbol(257 + lengthIndex);
      if (LENGTH_EXTRA[lengthIndex]) {
        writeBits(bestLength - LENGTH_BASE[lengthIndex], LENGTH_EXTRA[lengthIndex]);
      }
      let distanceIndex = 0;
      while (distanceIndex + 1 < DIST_BASE.length && bestDistance >= DIST_BASE[distanceIndex + 1]) {
        distanceIndex++;
      }
      writeBits(reverseBits(distanceIndex, 5), 5);
      if (DIST_EXTRA[distanceIndex]) {
        writeBits(bestDistance - DIST_BASE[distanceIndex], DIST_EXTRA[distanceIndex]);
      }
      matches++;
      matchedBytes += bestLength;
      position += bestLength;
    } else {
      writeSymbol(input[position++]);
      literals++;
    }
  }
  writeSymbol(256);
  if (bits > 0) out.push(accumulator & 255);
  return { bytes: Uint8Array.from(out), literals, matches, matchedBytes };
}

function decodeFixedSymbol(readBits) {
  let code = 0;
  for (let width = 1; width <= 9; width++) {
    code |= readBits(1) << (width - 1);
    for (let symbol = 0; symbol <= 287; symbol++) {
      const [candidate, candidateWidth] = fixedCode(symbol);
      if (candidateWidth === width && candidate === code) return symbol;
    }
  }
  throw new Error("invalid fixed-Huffman code");
}

function inflateFixedLiterals(input, expectedLength) {
  let offset = 0;
  let accumulator = 0;
  let bits = 0;
  const readBits = (width) => {
    while (bits < width) {
      invariant(offset < input.length, "truncated deflate stream");
      accumulator |= input[offset++] << bits;
      bits += 8;
    }
    const mask = (1 << width) - 1;
    const value = accumulator & mask;
    accumulator >>>= width;
    bits -= width;
    return value;
  };
  invariant(readBits(1) === 1, "multi-block deflate is outside the frozen family");
  invariant(readBits(2) === 1, "non-fixed deflate is outside the frozen family");
  const output = new Uint8Array(expectedLength);
  let written = 0;
  while (true) {
    const symbol = decodeFixedSymbol(readBits);
    if (symbol === 256) break;
    if (symbol < 256) {
      invariant(written < output.length, "inflated output overflow");
      output[written++] = symbol;
      continue;
    }
    invariant(symbol >= 257 && symbol <= 285, "invalid length symbol");
    const lengthIndex = symbol - 257;
    const length = LENGTH_BASE[lengthIndex] + readBits(LENGTH_EXTRA[lengthIndex]);
    const distanceCode = reverseBits(readBits(5), 5);
    invariant(distanceCode < DIST_BASE.length, "invalid distance symbol");
    const distance = DIST_BASE[distanceCode] + readBits(DIST_EXTRA[distanceCode]);
    invariant(distance <= written && written + length <= output.length, "invalid LZ match bounds");
    for (let index = 0; index < length; index++) {
      output[written] = output[written - distance];
      written++;
    }
  }
  invariant(written === expectedLength, "inflated length mismatch");
  return output;
}

const CRC_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let i = 0; i < 256; i++) {
    let value = i;
    for (let bit = 0; bit < 8; bit++) {
      value = (value & 1) ? (0xedb88320 ^ (value >>> 1)) : (value >>> 1);
    }
    table[i] = value >>> 0;
  }
  return table;
})();

export function crc32(bytes) {
  let crc = 0xffffffff;
  for (const byte of bytes) crc = CRC_TABLE[(crc ^ byte) & 255] ^ (crc >>> 8);
  return (crc ^ 0xffffffff) >>> 0;
}

export function pathFor(index) {
  invariant(
    Number.isInteger(index) && index >= 0 && index < ENTRY_COUNT,
    "path index out of range",
  );
  const group = String(Math.floor(index / 100)).padStart(3, "0");
  const leaf = String(index).padStart(5, "0");
  const families = [
    ["src", "module", "ts"],
    ["data", "event", "json"],
    ["assets", "blob", "bin"],
    ["docs", "note", "md"],
  ];
  const [base, stem, extension] = families[index & 3];
  const prefix = index % 997 === 0
    ? `${base}/caf\u00e9`
    : index % 991 === 0
    ? `${base}/\u6771\u4eac`
    : base;
  return `${prefix}/${group}/${stem}-${leaf}.${extension}`;
}

export function contentFor(index) {
  const length = 48 + (index % 113);
  const bytes = new Uint8Array(length);
  let state = (0x9e3779b9 ^ index) >>> 0;
  const templates = [
    "export const value = ",
    '{"event":"workspace","value":',
    "",
    "# Workspace note ",
  ];
  const template = encoder.encode(templates[index & 3]);
  for (let i = 0; i < length; i++) {
    state ^= state << 13;
    state ^= state >>> 17;
    state ^= state << 5;
    bytes[i] = (index & 3) === 2 ? ((state >>> 24) ^ (index & 255)) : template[i % template.length];
  }
  return bytes;
}

function safePath(name) {
  invariant(name.length > 0 && !name.startsWith("/") && !name.includes("\\"), "unsafe ZIP path");
  invariant(
    !name.split("/").some((part) => part === "" || part === "." || part === ".."),
    "unsafe ZIP path",
  );
  invariant(name.normalize("NFC") === name, "ZIP path is not NFC");
}

export function buildArchive(entryCount = ENTRY_COUNT) {
  invariant(
    Number.isInteger(entryCount) && entryCount > 0 && entryCount <= ENTRY_COUNT,
    "entry count outside demo bounds",
  );
  const archive = new Writer(2 * 1024 * 1024);
  const entries = [];
  let inputBytes = 0;
  const counters = { deflateLiterals: 0, deflateMatches: 0, deflateMatchedBytes: 0 };
  for (let index = 0; index < entryCount; index++) {
    const nameText = pathFor(index);
    safePath(nameText);
    const name = encoder.encode(nameText);
    const content = contentFor(index);
    const deflated = deflateFixed(content);
    const compressed = deflated.bytes;
    const crc = crc32(content);
    const localOffset = archive.length;
    archive.u32(0x04034b50);
    archive.u16(ZIP_POLICY.extractVersion);
    archive.u16(ZIP_POLICY.utf8Flag);
    archive.u16(ZIP_POLICY.compressionMethod);
    archive.u16(ZIP_POLICY.dosTime);
    archive.u16(ZIP_POLICY.dosDate);
    archive.u32(crc);
    archive.u32(compressed.length);
    archive.u32(content.length);
    archive.u16(name.length);
    archive.u16(0);
    archive.append(name);
    archive.append(compressed);
    entries.push({
      name,
      crc,
      compressedSize: compressed.length,
      size: content.length,
      localOffset,
    });
    inputBytes += content.length;
    counters.deflateLiterals += deflated.literals;
    counters.deflateMatches += deflated.matches;
    counters.deflateMatchedBytes += deflated.matchedBytes;
  }
  const centralOffset = archive.length;
  for (const entry of entries) {
    archive.u32(0x02014b50);
    archive.u16(ZIP_POLICY.creatorVersion);
    archive.u16(ZIP_POLICY.extractVersion);
    archive.u16(ZIP_POLICY.utf8Flag);
    archive.u16(ZIP_POLICY.compressionMethod);
    archive.u16(ZIP_POLICY.dosTime);
    archive.u16(ZIP_POLICY.dosDate);
    archive.u32(entry.crc);
    archive.u32(entry.compressedSize);
    archive.u32(entry.size);
    archive.u16(entry.name.length);
    archive.u16(0);
    archive.u16(0);
    archive.u16(0);
    archive.u16(0);
    archive.u32(ZIP_POLICY.unixMode << 16);
    archive.u32(entry.localOffset);
    archive.append(entry.name);
  }
  const centralSize = archive.length - centralOffset;
  invariant(
    archive.length < 0xffffffff && centralOffset < 0xffffffff && entries.length < 0xffff,
    "Zip64 required",
  );
  archive.u32(0x06054b50);
  archive.u16(0);
  archive.u16(0);
  archive.u16(entries.length);
  archive.u16(entries.length);
  archive.u32(centralSize);
  archive.u32(centralOffset);
  archive.u16(0);
  return {
    archive: archive.finish(),
    counters: {
      entries: entryCount,
      inputBytes,
      crcBytes: inputBytes,
      deflateLiterals: counters.deflateLiterals,
      deflateMatches: counters.deflateMatches,
      deflateMatchedBytes: counters.deflateMatchedBytes,
      deflateEndSymbols: entryCount,
      localHeaders: entryCount,
      centralHeaders: entryCount,
      zip64Records: 0,
      boundaryCrossings: 0,
    },
  };
}

function locateEocd(bytes) {
  invariant(bytes.length >= 22, "truncated ZIP");
  const start = Math.max(0, bytes.length - 65_557);
  for (let offset = bytes.length - 22; offset >= start; offset--) {
    if (u32(bytes, offset) === 0x06054b50) return offset;
  }
  throw new Error("EOCD not found");
}

export function inspectArchive(
  bytes,
  selected = SELECTED_INDICES,
  expectedEntryCount = ENTRY_COUNT,
) {
  invariant(
    Number.isInteger(expectedEntryCount) && expectedEntryCount > 0 &&
      expectedEntryCount <= ENTRY_COUNT,
    "entry count outside demo bounds",
  );
  const expectedSelected = SELECTED_INDICES.filter((index) => index < expectedEntryCount);
  invariant(
    selected.length === expectedSelected.length &&
      selected.every((index, position) => index === expectedSelected[position]),
    "selected path contract mismatch",
  );
  const eocd = locateEocd(bytes);
  invariant(eocd + 22 === bytes.length && u16(bytes, eocd + 20) === 0, "EOCD metadata mismatch");
  invariant(u16(bytes, eocd + 4) === 0 && u16(bytes, eocd + 6) === 0, "multi-disk ZIP forbidden");
  const count = u16(bytes, eocd + 10);
  invariant(count === u16(bytes, eocd + 8), "entry count mismatch");
  invariant(count === expectedEntryCount, "entry count mismatch");
  const centralSize = u32(bytes, eocd + 12);
  const centralOffset = u32(bytes, eocd + 16);
  invariant(
    centralSize !== 0xffffffff && centralOffset !== 0xffffffff && count !== 0xffff,
    "Zip64 forbidden by frozen bounds",
  );
  invariant(centralOffset + centralSize === eocd, "central-directory bounds mismatch");
  const listing = new Writer(512 * 1024);
  const extracted = new Writer(4096);
  const selectedSet = new Set(selected);
  let cursor = centralOffset;
  let extractedBytes = 0;
  for (let index = 0; index < count; index++) {
    invariant(cursor + 46 <= eocd && u32(bytes, cursor) === 0x02014b50, "invalid central header");
    const creatorVersion = u16(bytes, cursor + 4);
    const extractVersion = u16(bytes, cursor + 6);
    const flags = u16(bytes, cursor + 8);
    const method = u16(bytes, cursor + 10);
    const dosTime = u16(bytes, cursor + 12);
    const dosDate = u16(bytes, cursor + 14);
    const crc = u32(bytes, cursor + 16);
    const compressedSize = u32(bytes, cursor + 20);
    const size = u32(bytes, cursor + 24);
    const nameLength = u16(bytes, cursor + 28);
    const extraLength = u16(bytes, cursor + 30);
    const commentLength = u16(bytes, cursor + 32);
    const diskStart = u16(bytes, cursor + 34);
    const internal = u16(bytes, cursor + 36);
    const external = u32(bytes, cursor + 38);
    const localOffset = u32(bytes, cursor + 42);
    invariant(
      creatorVersion === ZIP_POLICY.creatorVersion &&
        extractVersion === ZIP_POLICY.extractVersion &&
        flags === ZIP_POLICY.utf8Flag && method === ZIP_POLICY.compressionMethod &&
        dosTime === ZIP_POLICY.dosTime && dosDate === ZIP_POLICY.dosDate &&
        extraLength === 0 && commentLength === 0 && diskStart === 0 && internal === 0,
      "metadata policy mismatch",
    );
    invariant(external === ((ZIP_POLICY.unixMode << 16) >>> 0), "platform attributes mismatch");
    invariant(cursor + 46 + nameLength <= eocd, "central name overflow");
    const nameBytes = bytes.slice(cursor + 46, cursor + 46 + nameLength);
    const name = new TextDecoder("utf-8", { fatal: true }).decode(nameBytes);
    safePath(name);
    invariant(name === pathFor(index), "path order mismatch");
    listing.u16(nameBytes.length);
    listing.append(nameBytes);
    listing.u32(size);
    listing.u32(compressedSize);
    listing.u32(crc);
    invariant(
      localOffset + 30 <= centralOffset && u32(bytes, localOffset) === 0x04034b50,
      "invalid local header",
    );
    invariant(
      u16(bytes, localOffset + 4) === ZIP_POLICY.extractVersion &&
        u16(bytes, localOffset + 6) === flags && u16(bytes, localOffset + 8) === method &&
        u16(bytes, localOffset + 10) === dosTime && u16(bytes, localOffset + 12) === dosDate,
      "local metadata mismatch",
    );
    invariant(
      u32(bytes, localOffset + 14) === crc && u32(bytes, localOffset + 18) === compressedSize &&
        u32(bytes, localOffset + 22) === size,
      "local sizes mismatch",
    );
    const localNameLength = u16(bytes, localOffset + 26);
    const localExtraLength = u16(bytes, localOffset + 28);
    invariant(
      localExtraLength === 0 && localNameLength === nameLength,
      "local name metadata mismatch",
    );
    const dataOffset = localOffset + 30 + localNameLength;
    invariant(dataOffset + compressedSize <= centralOffset, "compressed data overflow");
    const localNameBytes = bytes.slice(localOffset + 30, dataOffset);
    invariant(
      localNameBytes.every((value, position) => value === nameBytes[position]),
      "local and central names differ",
    );
    const localName = new TextDecoder("utf-8", { fatal: true }).decode(localNameBytes);
    safePath(localName);
    if (selectedSet.has(index)) {
      const plain = inflateFixedLiterals(
        bytes.subarray(dataOffset, dataOffset + compressedSize),
        size,
      );
      invariant(crc32(plain) === crc, "CRC mismatch");
      const expected = contentFor(index);
      invariant(
        expected.length === plain.length && expected.every((value, i) => value === plain[i]),
        "extracted content mismatch",
      );
      extracted.u32(index);
      extracted.u32(plain.length);
      extracted.append(plain);
      extractedBytes += plain.length;
    }
    cursor += 46 + nameLength;
  }
  invariant(cursor === eocd, "central directory trailing bytes");
  invariant(selectedSet.size === selected.length, "selected path contract mismatch");
  return {
    listing: listing.finish(),
    extracted: extracted.finish(),
    counters: {
      listedEntries: count,
      extractedEntries: selected.length,
      extractedBytes,
      boundaryCrossings: 0,
    },
  };
}

export function runJavaScript(entryCount = ENTRY_COUNT) {
  const selected = SELECTED_INDICES.filter((index) => index < entryCount);
  const built = buildArchive(entryCount);
  const inspected = inspectArchive(built.archive, selected, entryCount);
  return {
    variant: "js-controlled",
    archive: built.archive,
    listing: inspected.listing,
    extracted: inspected.extracted,
    counters: { ...built.counters, ...inspected.counters },
  };
}
