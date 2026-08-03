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
  const targets = EDIT_DENOMINATORS.map((denominator) => {
    const removed = Math.max(1, Math.floor(lineCount / denominator));
    return { denominator, removed, lines: base.slice(0, lineCount - removed) };
  });
  return { seed: GENERATOR_SEED, base, targets };
}

export function internLinePairs(base, targets) {
  const table = [];
  const ids = new Map();
  const intern = (line) => {
    let id = ids.get(line);
    if (id === undefined) {
      id = table.length + 1;
      ids.set(line, id);
      table.push(line);
    }
    return id;
  };
  return {
    table,
    baseIds: Uint32Array.from(base, intern),
    targetIds: targets.map((target) => Uint32Array.from(target, intern)),
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
  const { baseIds, targetIds } = internLinePairs(baseLines, [targetLines]);
  const result = myersDiff(baseIds, targetIds[0]);
  const applied = applyScript(baseIds, result.operations);
  if (
    applied.length !== targetIds[0].length ||
    applied.some((value, index) => value !== targetIds[0][index])
  ) throw new Error("apply oracle failed");
  const inputBytes =
    encoder.encode(`${baseLines.join("\n")}\n${targetLines.join("\n")}`).byteLength;
  const output = encodeScript(result.operations);
  return {
    operations: result.operations,
    digestSha256: await sha256Hex(output),
    counters: {
      "document-pairs": 1,
      "input-lines": baseLines.length + targetLines.length,
      "edit-distance": result.editDistance,
      "frontier-steps": result.frontierSteps,
      "script-operations": result.operations.length,
      "input-bytes": inputBytes,
      "output-bytes": output.byteLength,
      "boundary-crossings": 0,
    },
  };
}

export async function runDiffWasm(baseLines, targetLines, wasmBytes) {
  const { baseIds, targetIds } = internLinePairs(baseLines, [targetLines]);
  const target = targetIds[0];
  const { instance } = await WebAssembly.instantiate(wasmBytes);
  const { memory, diff_myers: diffMyers } = instance.exports;
  if (!(memory instanceof WebAssembly.Memory) || typeof diffMyers !== "function") {
    throw new Error("diff Wasm exports missing");
  }
  let prefix = 0;
  while (prefix < baseIds.length && prefix < target.length && baseIds[prefix] === target[prefix]) {
    prefix++;
  }
  let suffix = 0;
  while (
    suffix < baseIds.length - prefix && suffix < target.length - prefix &&
    baseIds[baseIds.length - 1 - suffix] === target[target.length - 1 - suffix]
  ) suffix++;
  const n = baseIds.length - prefix - suffix;
  const m = target.length - prefix - suffix;
  const max = n + m;
  const width = 2 * max + 1;
  let pointer = 1024;
  const aPtr = pointer;
  pointer += baseIds.byteLength;
  const bPtr = (pointer + 7) & ~7;
  pointer = bPtr + target.byteLength;
  const outPtr = (pointer + 7) & ~7;
  pointer = outPtr + (baseIds.length + target.length) * 16;
  const frontierPtr = (pointer + 7) & ~7;
  pointer = frontierPtr + Math.max(width * 4, 16);
  const tracePtr = (pointer + 7) & ~7;
  if (n > 0 && m > 0) pointer = tracePtr + (max + 1) * width * 4;
  const metaPtr = (pointer + 7) & ~7;
  pointer = metaPtr + 12;
  const requiredPages = Math.ceil(pointer / 65536);
  if (requiredPages > memory.buffer.byteLength / 65536) {
    memory.grow(requiredPages - memory.buffer.byteLength / 65536);
  }
  new Uint32Array(memory.buffer, aPtr, baseIds.length).set(baseIds);
  new Uint32Array(memory.buffer, bPtr, target.length).set(target);
  const count = diffMyers(
    aPtr,
    baseIds.length,
    bPtr,
    target.length,
    outPtr,
    frontierPtr,
    tracePtr,
    metaPtr,
  );
  const view = new DataView(memory.buffer);
  const operations = Array.from(
    { length: count },
    (_, index) =>
      [0, 1, 2, 3].map((field) => view.getUint32(outPtr + index * 16 + field * 4, true)),
  );
  const applied = applyScript(baseIds, operations);
  if (applied.length !== target.length || applied.some((value, index) => value !== target[index])) {
    throw new Error("Wasm apply oracle failed");
  }
  const output = new Uint8Array(memory.buffer.slice(outPtr, outPtr + count * 16));
  const inputBytes =
    encoder.encode(`${baseLines.join("\n")}\n${targetLines.join("\n")}`).byteLength;
  return {
    operations,
    digestSha256: await sha256Hex(output),
    counters: {
      "document-pairs": 1,
      "input-lines": baseLines.length + targetLines.length,
      "edit-distance": view.getUint32(metaPtr, true),
      "frontier-steps": view.getUint32(metaPtr + 4, true),
      "script-operations": count,
      "input-bytes": inputBytes,
      "output-bytes": output.byteLength,
      "boundary-crossings": 1,
    },
  };
}

export function decodeUtf8(bytes) {
  return decoder.decode(bytes);
}
