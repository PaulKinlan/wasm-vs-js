// text.diff-patch.v1 controlled engine: UTF-8 line interning, Myers O(ND),
// delete-before-insert tie breaking, canonical script encoding, and apply oracle.

export const BASE_LINES = 100_000;
export const EDIT_DENOMINATORS = [1000, 100, 10];
export const GENERATOR_SEED = 0xd1ff2026;
const encoder = new TextEncoder();
const decoder = new TextDecoder("utf-8", { fatal: true });

function xorshift32(state) {
  state ^= state << 13;
  state ^= state >>> 17;
  state ^= state << 5;
  return state >>> 0;
}

export function generateDiffFixture(lineCount = BASE_LINES) {
  let state = GENERATOR_SEED;
  const base = new Array(lineCount);
  const unicode = ["Café", "東京", "🚀", "e\u0301", "עברית", "naïve"];
  for (let index = 0; index < lineCount; index += 1) {
    state = xorshift32(state);
    base[index] = `${index.toString().padStart(6, "0")} ${unicode[state % unicode.length]} ${
      (state >>> 0).toString(16).padStart(8, "0")
    }`;
  }
  const targets = EDIT_DENOMINATORS.map((denominator, pairIndex) => {
    const removed = Math.max(1, Math.floor(lineCount / denominator));
    const lines = base.slice(0, lineCount - removed);
    // The smallest edit class includes one replacement at the final retained
    // line. This keeps the 100,000-line corpus practical while forcing the
    // frozen full-size run through the non-degenerate Myers frontier.
    if (pairIndex === 0 && lines.length > 0) lines[lines.length - 1] += " edited-🚧";
    return { denominator, removed, lines };
  });
  return { seed: GENERATOR_SEED, base, targets };
}

const DIFF_FRAME_MAGIC = 0x31464454; // "TDF1" as little-endian u32.

function assertScalarText(value) {
  for (let index = 0; index < value.length; index++) {
    const unit = value.charCodeAt(index);
    if (unit >= 0xd800 && unit <= 0xdbff) {
      const next = value.charCodeAt(++index);
      if (!(next >= 0xdc00 && next <= 0xdfff)) {
        throw new Error("line contains an unpaired surrogate");
      }
    } else if (unit >= 0xdc00 && unit <= 0xdfff) {
      throw new Error("line contains an unpaired surrogate");
    }
  }
}

export function serializeDiffPair(base, target) {
  const groups = [base, target];
  const encoded = groups.map((lines) =>
    lines.map((line) => {
      assertScalarText(line);
      return encoder.encode(line);
    })
  );
  const byteLength = 4 + encoded.reduce(
    (total, lines) => total + 4 + lines.reduce((sum, line) => sum + 4 + line.length, 0),
    0,
  );
  const output = new Uint8Array(byteLength);
  const view = new DataView(output.buffer);
  let offset = 0;
  view.setUint32(offset, DIFF_FRAME_MAGIC, true);
  offset += 4;
  for (const lines of encoded) {
    view.setUint32(offset, lines.length, true);
    offset += 4;
    for (const line of lines) {
      view.setUint32(offset, line.length, true);
      offset += 4;
      output.set(line, offset);
      offset += line.length;
    }
  }
  return output;
}

function fnv1a(bytes) {
  let hash = 0x811c9dc5;
  for (const byte of bytes) hash = Math.imul(hash ^ byte, 0x01000193) >>> 0;
  return hash;
}

export function internSerializedDiff(input) {
  const view = new DataView(input.buffer, input.byteOffset, input.byteLength);
  let offset = 0;
  const readU32 = () => {
    if (offset + 4 > input.length) throw new Error("truncated diff frame");
    const value = view.getUint32(offset, true);
    offset += 4;
    return value;
  };
  if (readU32() !== DIFF_FRAME_MAGIC) throw new Error("invalid diff frame magic");
  const counts = [readU32()];
  const descriptors = [];
  for (let group = 0; group < 2; group++) {
    if (group === 1) counts.push(readU32());
    const lines = [];
    for (let index = 0; index < counts[group]; index++) {
      const length = readU32();
      if (offset + length > input.length) throw new Error("truncated diff line");
      lines.push({ offset, length, bytes: input.subarray(offset, offset + length) });
      offset += length;
    }
    descriptors.push(lines);
  }
  if (offset !== input.length) throw new Error("trailing diff frame bytes");
  let capacity = 1;
  while (capacity < (counts[0] + counts[1]) * 2) capacity *= 2;
  const slots = new Int32Array(capacity);
  const table = [];
  const intern = (line) => {
    const hash = fnv1a(line.bytes);
    let slot = hash & (capacity - 1);
    while (slots[slot] !== 0) {
      const prior = table[slots[slot] - 1];
      if (prior.hash === hash && prior.length === line.length) {
        let equal = true;
        for (let index = 0; index < line.length; index++) {
          if (input[prior.offset + index] !== line.bytes[index]) {
            equal = false;
            break;
          }
        }
        if (equal) return slots[slot];
      }
      slot = (slot + 1) & (capacity - 1);
    }
    const id = table.length + 1;
    table.push({ hash, offset: line.offset, length: line.length });
    slots[slot] = id;
    return id;
  };
  return {
    baseIds: Uint32Array.from(descriptors[0], intern),
    targetIds: Uint32Array.from(descriptors[1], intern),
    uniqueLines: table.length,
    tableCapacity: capacity,
  };
}

export function internLinePairs(base, targets) {
  const results = targets.map((target) => internSerializedDiff(serializeDiffPair(base, target)));
  return {
    baseIds: results[0]?.baseIds ?? new Uint32Array(),
    targetIds: results.map((item) => item.targetIds),
  };
}

// Canonical operation tuples: [kind, baseIndex, targetIndex, lineId], where
// kind 0=equal, 1=delete, 2=insert. One tuple is emitted per line.
export function myersDiff(base, target) {
  let prefix = 0;
  while (prefix < base.length && prefix < target.length && base[prefix] === target[prefix]) {
    prefix++;
  }
  let suffix = 0;
  while (
    suffix < base.length - prefix && suffix < target.length - prefix &&
    base[base.length - 1 - suffix] === target[target.length - 1 - suffix]
  ) suffix++;
  const n = base.length - prefix - suffix;
  const m = target.length - prefix - suffix;
  const reverse = [];
  for (let index = 0; index < suffix; index++) {
    const ai = base.length - 1 - index;
    const bi = target.length - 1 - index;
    reverse.push([0, ai, bi, base[ai]]);
  }
  let frontierSteps = 0;
  let editDistance = 0;
  if (n === 0) {
    for (let y = m - 1; y >= 0; y--) reverse.push([2, prefix, prefix + y, target[prefix + y]]);
    editDistance = m;
  } else if (m === 0) {
    for (let x = n - 1; x >= 0; x--) reverse.push([1, prefix + x, prefix, base[prefix + x]]);
    editDistance = n;
  } else {
    const max = n + m;
    const offset = max;
    const v = new Int32Array(2 * max + 1);
    v[offset + 1] = 0;
    const trace = [];
    outer: for (let d = 0; d <= max; d++) {
      for (let k = -d; k <= d; k += 2) {
        frontierSteps++;
        let x;
        if (k === -d || (k !== d && v[offset + k - 1] < v[offset + k + 1])) x = v[offset + k + 1];
        else x = v[offset + k - 1] + 1;
        let y = x - k;
        while (x < n && y < m && base[prefix + x] === target[prefix + y]) {
          x++;
          y++;
        }
        v[offset + k] = x;
        if (x >= n && y >= m) {
          trace.push(v.slice());
          editDistance = d;
          break outer;
        }
      }
      trace.push(v.slice());
    }
    let x = n;
    let y = m;
    for (let d = editDistance; d > 0; d--) {
      const prior = trace[d - 1];
      const k = x - y;
      const down = k === -d || (k !== d && prior[offset + k - 1] < prior[offset + k + 1]);
      const previousK = down ? k + 1 : k - 1;
      const previousX = prior[offset + previousK];
      const previousY = previousX - previousK;
      while (x > previousX && y > previousY) {
        x--;
        y--;
        reverse.push([0, prefix + x, prefix + y, base[prefix + x]]);
      }
      if (down) {
        y--;
        reverse.push([2, prefix + x, prefix + y, target[prefix + y]]);
      } else {
        x--;
        reverse.push([1, prefix + x, prefix + y, base[prefix + x]]);
      }
    }
  }
  for (let index = prefix - 1; index >= 0; index--) reverse.push([0, index, index, base[index]]);
  return { operations: reverse.reverse(), editDistance, frontierSteps };
}

export function applyScript(base, script) {
  const output = [];
  let cursor = 0;
  for (const [kind, baseIndex, _targetIndex, lineId] of script) {
    if (kind === 0) {
      if (baseIndex !== cursor || base[cursor] !== lineId) {
        throw new Error("invalid equal operation");
      }
      output.push(lineId);
      cursor++;
    } else if (kind === 1) {
      if (baseIndex !== cursor || base[cursor] !== lineId) {
        throw new Error("invalid delete operation");
      }
      cursor++;
    } else if (kind === 2) output.push(lineId);
    else throw new Error("invalid operation kind");
  }
  if (cursor !== base.length) throw new Error("script did not consume base");
  return Uint32Array.from(output);
}

export function encodeScript(script) {
  const bytes = new Uint8Array(script.length * 16);
  const view = new DataView(bytes.buffer);
  script.forEach((operation, index) =>
    operation.forEach((value, field) => view.setUint32(index * 16 + field * 4, value, true))
  );
  return bytes;
}

export async function sha256Hex(bytes) {
  const digest = new Uint8Array(await crypto.subtle.digest("SHA-256", bytes));
  return [...digest].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

export async function runDiffJS(baseLines, targetLines) {
  const input = serializeDiffPair(baseLines, targetLines);
  const { baseIds, targetIds, uniqueLines } = internSerializedDiff(input);
  const result = myersDiff(baseIds, targetIds);
  const applied = applyScript(baseIds, result.operations);
  if (
    applied.length !== targetIds.length ||
    applied.some((value, index) => value !== targetIds[index])
  ) {
    throw new Error("apply oracle failed");
  }
  const output = encodeScript(result.operations);
  return {
    operations: result.operations,
    digestSha256: await sha256Hex(output),
    inputSha256: await sha256Hex(input),
    counters: {
      "document-pairs": 1,
      "input-lines": baseLines.length + targetLines.length,
      "interned-lines": uniqueLines,
      "edit-distance": result.editDistance,
      "frontier-steps": result.frontierSteps,
      "script-operations": result.operations.length,
      "input-bytes": input.byteLength,
      "output-bytes": output.byteLength,
      allocations: 5,
      "boundary-crossings": 0,
    },
  };
}

export async function runDiffWasm(baseLines, targetLines, wasmBytes) {
  const input = serializeDiffPair(baseLines, targetLines);
  const { instance } = await WebAssembly.instantiate(wasmBytes);
  const { memory, intern_diff_apply_validate: run } = instance.exports;
  if (!(memory instanceof WebAssembly.Memory) || typeof run !== "function") {
    throw new Error("complete diff Wasm exports missing");
  }
  const totalLines = baseLines.length + targetLines.length;
  let tableCapacity = 1;
  while (tableCapacity < totalLines * 2) tableCapacity *= 2;
  let pointer = 1024;
  const inputPtr = pointer;
  pointer += input.byteLength;
  const basePtr = (pointer + 7) & ~7;
  pointer = basePtr + baseLines.length * 4;
  const targetPtr = (pointer + 7) & ~7;
  pointer = targetPtr + targetLines.length * 4;
  const tablePtr = (pointer + 7) & ~7;
  pointer = tablePtr + tableCapacity * 16;
  const outPtr = (pointer + 7) & ~7;
  pointer = outPtr + totalLines * 16;
  const applyPtr = (pointer + 7) & ~7;
  pointer = applyPtr + targetLines.length * 4;
  const frontierPtr = (pointer + 7) & ~7;
  pointer = frontierPtr + Math.max((totalLines * 2 + 1) * 4, 16);
  const tracePtr = (pointer + 7) & ~7;
  const traceBytes = Math.max(16 * 1024 * 1024, (Math.min(totalLines, 2048) + 1) ** 2 * 8);
  pointer = tracePtr + traceBytes;
  const metaPtr = (pointer + 7) & ~7;
  pointer = metaPtr + 24;
  const requiredPages = Math.ceil(pointer / 65536);
  if (requiredPages > memory.buffer.byteLength / 65536) {
    memory.grow(requiredPages - memory.buffer.byteLength / 65536);
  }
  new Uint8Array(memory.buffer, inputPtr, input.byteLength).set(input);
  const count = run(
    inputPtr,
    input.byteLength,
    basePtr,
    targetPtr,
    tablePtr,
    tableCapacity,
    outPtr,
    applyPtr,
    frontierPtr,
    tracePtr,
    traceBytes,
    metaPtr,
  );
  const view = new DataView(memory.buffer);
  if (view.getUint32(metaPtr + 12, true) !== 1) {
    throw new Error("Wasm apply/validation oracle failed");
  }
  const operations = Array.from(
    { length: count },
    (_, index) =>
      [0, 1, 2, 3].map((field) => view.getUint32(outPtr + index * 16 + field * 4, true)),
  );
  const output = new Uint8Array(memory.buffer.slice(outPtr, outPtr + count * 16));
  return {
    operations,
    digestSha256: await sha256Hex(output),
    inputSha256: await sha256Hex(input),
    counters: {
      "document-pairs": 1,
      "input-lines": totalLines,
      "interned-lines": view.getUint32(metaPtr + 16, true),
      "edit-distance": view.getUint32(metaPtr, true),
      "frontier-steps": view.getUint32(metaPtr + 4, true),
      "script-operations": count,
      "input-bytes": input.byteLength,
      "output-bytes": output.byteLength,
      allocations: view.getUint32(metaPtr + 20, true),
      "boundary-crossings": 1,
    },
  };
}

export function decodeUtf8(bytes) {
  return decoder.decode(bytes);
}
