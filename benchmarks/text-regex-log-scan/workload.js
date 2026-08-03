import { CORPUS_BYTES, SAFE_PATTERNS } from "./input.js";

const encoder = new TextEncoder();
const CLASS_ID = { "url-tail": 1, ipv4: 2, status: 3 };

function isUrlTail(byte) {
  return (byte >= 97 && byte <= 122) || (byte >= 48 && byte <= 57) ||
    byte === 46 || byte === 47 || byte === 95 || byte === 45;
}

function buildDispatch(patterns) {
  const buckets = Array.from({ length: 256 }, () => []);
  const prefixes = patterns.map((pattern) => encoder.encode(pattern.prefix));
  for (let index = 0; index < patterns.length; index++) buckets[prefixes[index][0]].push(index);
  return { buckets, prefixes };
}

function matchIpv4(bytes, cursor, counters) {
  for (let octet = 0; octet < 4; octet++) {
    const start = cursor;
    let value = 0;
    while (cursor < bytes.length && cursor - start < 3) {
      const byte = bytes[cursor];
      counters.tailComparisons++;
      if (byte < 48 || byte > 57) break;
      value = value * 10 + byte - 48;
      cursor++;
    }
    const digits = cursor - start;
    if (digits === 0 || value > 255 || (digits > 1 && bytes[start] === 48)) return -1;
    if (octet < 3) {
      if (cursor >= bytes.length) return -1;
      counters.tailComparisons++;
      if (bytes[cursor] !== 46) return -1;
      cursor++;
    }
  }
  if (cursor < bytes.length) {
    counters.tailComparisons++;
    if (bytes[cursor] >= 48 && bytes[cursor] <= 57) return -1;
    if (bytes[cursor] === 46) return -1;
  }
  return cursor;
}

function matchStatus(bytes, cursor, counters) {
  if (cursor + 3 > bytes.length) return -1;
  let value = 0;
  for (let index = 0; index < 3; index++) {
    const byte = bytes[cursor + index];
    counters.tailComparisons++;
    if (byte < 48 || byte > 57) return -1;
    value = value * 10 + byte - 48;
  }
  if (value < 100 || value > 599) return -1;
  const end = cursor + 3;
  if (end < bytes.length) {
    counters.tailComparisons++;
    if (bytes[end] >= 48 && bytes[end] <= 57) return -1;
  }
  return end;
}

function matchUrl(bytes, cursor, counters) {
  const start = cursor;
  while (cursor < bytes.length && cursor - start < 96) {
    const byte = bytes[cursor];
    counters.tailComparisons++;
    if (!isUrlTail(byte)) break;
    cursor++;
  }
  if (cursor === start) return -1;
  if (cursor - start === 96 && cursor < bytes.length && isUrlTail(bytes[cursor])) {
    counters.tailComparisons++;
    return -1;
  }
  return cursor;
}

function scanControlled(bytes, patterns = SAFE_PATTERNS) {
  const { buckets, prefixes } = buildDispatch(patterns);
  const matches = [];
  const counters = { candidateStarts: 0, prefixComparisons: 0, tailComparisons: 0 };
  for (let start = 0; start < bytes.length; start++) {
    for (const patternIndex of buckets[bytes[start]]) {
      counters.candidateStarts++;
      const prefix = prefixes[patternIndex];
      let matched = true;
      for (let index = 0; index < prefix.length; index++) {
        if (start + index >= bytes.length) {
          matched = false;
          break;
        }
        counters.prefixComparisons++;
        if (bytes[start + index] !== prefix[index]) {
          matched = false;
          break;
        }
      }
      if (!matched) continue;
      const pattern = patterns[patternIndex];
      const cursor = start + prefix.length;
      const end = pattern.matcher === "url-tail"
        ? matchUrl(bytes, cursor, counters)
        : pattern.matcher === "ipv4"
        ? matchIpv4(bytes, cursor, counters)
        : matchStatus(bytes, cursor, counters);
      if (end >= 0) matches.push({ patternId: pattern.id, start, end });
    }
  }
  return { matches, ...counters };
}

export function canonicalOutput(matches, input) {
  let length = 0;
  for (const match of matches) length += 16 + match.end - match.start;
  const output = new Uint8Array(length);
  const view = new DataView(output.buffer);
  let cursor = 0;
  for (const match of matches) {
    const matchLength = match.end - match.start;
    view.setUint32(cursor, match.patternId, true);
    view.setUint32(cursor + 4, match.start, true);
    view.setUint32(cursor + 8, match.end, true);
    view.setUint32(cursor + 12, matchLength, true);
    output.set(input.subarray(match.start, match.end), cursor + 16);
    cursor += 16 + matchLength;
  }
  return output;
}

export async function sha256Hex(bytes) {
  return [...new Uint8Array(await crypto.subtle.digest("SHA-256", bytes))]
    .map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

async function resultEnvelope(variant, input, scan, boundaryCrossings) {
  const output = canonicalOutput(scan.matches, input);
  const perPattern = new Array(SAFE_PATTERNS.length).fill(0);
  for (const match of scan.matches) perPattern[match.patternId]++;
  return {
    workloadId: "text.regex-log-scan.v1",
    variant,
    outputSha256: await sha256Hex(output),
    inputSha256: await sha256Hex(input),
    matches: scan.matches,
    counters: {
      inputBytes: input.byteLength,
      patternsExecuted: SAFE_PATTERNS.length,
      logicalPatternBytes: input.byteLength * SAFE_PATTERNS.length,
      matchesFound: scan.matches.length,
      capturesExtracted: scan.matches.length,
      canonicalOutputBytes: output.byteLength,
      candidateStarts: scan.candidateStarts,
      prefixByteComparisons: scan.prefixComparisons,
      tailByteComparisons: scan.tailComparisons,
      boundaryCrossings,
      perPattern,
    },
  };
}

export async function scanJsControlled(input) {
  return await resultEnvelope("js-controlled", input, scanControlled(input), 0);
}

function align(value, alignment = 8) {
  return (value + alignment - 1) & ~(alignment - 1);
}

function prepareWasmTables(memory, input) {
  const bytes = new Uint8Array(memory.buffer);
  const view = new DataView(memory.buffer);
  const inputPtr = 4096;
  if (inputPtr + input.byteLength >= bytes.byteLength) throw new Error("Wasm memory is too small");
  bytes.set(input, inputPtr);
  let cursor = align(inputPtr + input.byteLength);
  const descPtr = cursor;
  cursor += SAFE_PATTERNS.length * 16;
  const prefixBytes = SAFE_PATTERNS.map((pattern) => encoder.encode(pattern.prefix));
  for (let index = 0; index < SAFE_PATTERNS.length; index++) {
    const prefixPtr = cursor;
    bytes.set(prefixBytes[index], prefixPtr);
    cursor += prefixBytes[index].byteLength;
    const base = descPtr + index * 16;
    view.setUint32(base, SAFE_PATTERNS[index].id, true);
    view.setUint32(base + 4, prefixPtr, true);
    view.setUint32(base + 8, prefixBytes[index].byteLength, true);
    view.setUint32(base + 12, CLASS_ID[SAFE_PATTERNS[index].matcher], true);
  }
  cursor = align(cursor);
  const dispatchOffsetPtr = cursor;
  cursor += 256 * 4;
  const dispatchCountPtr = cursor;
  cursor += 256 * 4;
  const dispatchItemsPtr = cursor;
  const { buckets } = buildDispatch(SAFE_PATTERNS);
  let item = 0;
  for (let byte = 0; byte < 256; byte++) {
    view.setUint32(dispatchOffsetPtr + byte * 4, item, true);
    view.setUint32(dispatchCountPtr + byte * 4, buckets[byte].length, true);
    for (const patternIndex of buckets[byte]) {
      view.setUint32(dispatchItemsPtr + item * 4, patternIndex, true);
      item++;
    }
  }
  cursor = align(dispatchItemsPtr + item * 4);
  const outPtr = cursor;
  const outCapacity = Math.floor((memory.buffer.byteLength - outPtr - 16) / 12);
  return {
    inputPtr,
    descPtr,
    dispatchOffsetPtr,
    dispatchCountPtr,
    dispatchItemsPtr,
    outPtr,
    outCapacity,
  };
}

export async function scanWasmControlled(input, instance) {
  const { memory, scan_patterns: scanPatterns } = instance.exports;
  if (!(memory instanceof WebAssembly.Memory) || typeof scanPatterns !== "function") {
    throw new Error("text regex Wasm exports are incomplete");
  }
  const layout = prepareWasmTables(memory, input);
  const matchCount = scanPatterns(
    layout.inputPtr,
    input.byteLength,
    layout.descPtr,
    SAFE_PATTERNS.length,
    layout.dispatchOffsetPtr,
    layout.dispatchCountPtr,
    layout.dispatchItemsPtr,
    layout.outPtr,
    layout.outCapacity,
  );
  if (matchCount > layout.outCapacity) throw new Error("Wasm output capacity exceeded");
  const view = new DataView(memory.buffer);
  const headerCount = view.getUint32(layout.outPtr, true);
  if (headerCount !== matchCount) throw new Error("Wasm match count header mismatch");
  const scan = {
    matches: [],
    candidateStarts: view.getUint32(layout.outPtr + 4, true),
    prefixComparisons: view.getUint32(layout.outPtr + 8, true),
    tailComparisons: view.getUint32(layout.outPtr + 12, true),
  };
  for (let index = 0; index < matchCount; index++) {
    const base = layout.outPtr + 16 + index * 12;
    scan.matches.push({
      patternId: view.getUint32(base, true),
      start: view.getUint32(base + 4, true),
      end: view.getUint32(base + 8, true),
    });
  }
  return await resultEnvelope("wasm-linear-controlled", input, scan, 1);
}

export function assertFullContract(result) {
  if (result.counters.inputBytes !== CORPUS_BYTES) throw new Error("not the 100 MiB contract");
  if (result.counters.patternsExecuted !== 20) throw new Error("not the 20-pattern contract");
  if (result.counters.logicalPatternBytes !== CORPUS_BYTES * 20) {
    throw new Error("logical pattern-byte work mismatch");
  }
}
