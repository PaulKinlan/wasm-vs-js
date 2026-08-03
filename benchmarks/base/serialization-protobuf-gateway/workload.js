// Controlled protobuf wire decoder, filter, and canonical ProtoJSON serializer.
// No JSON.parse/stringify, native protobuf, or host reducer is used.
export const MESSAGE_COUNT = 10_000;
export const FIXTURE_SEED = 0x28a11ce5;
export const STATUS = ["STATUS_UNSPECIFIED", "ACTIVE", "PAUSED", "DISABLED"];
const te = new TextEncoder();
const td = new TextDecoder("utf-8", { fatal: true });

function next(state) {
  state ^= state << 13;
  state ^= state >>> 17;
  state ^= state << 5;
  return state >>> 0;
}
function pushVarint(out, value) {
  let v = BigInt.asUintN(64, BigInt(value));
  while (v >= 128n) {
    out.push(Number(v & 127n) | 128);
    v >>= 7n;
  }
  out.push(Number(v));
}
function pushKey(out, field, wire) {
  pushVarint(out, BigInt(field * 8 + wire));
}
function pushFixed32(out, value) {
  const bytes = new Uint8Array(4);
  new DataView(bytes.buffer).setUint32(0, value >>> 0, true);
  out.push(...bytes);
}
function pushFloat(out, value) {
  const bytes = new Uint8Array(4);
  new DataView(bytes.buffer).setFloat32(0, value, true);
  out.push(...bytes);
}
function pushDouble(out, value) {
  const bytes = new Uint8Array(8);
  new DataView(bytes.buffer).setFloat64(0, value, true);
  out.push(...bytes);
}
function pushBytes(out, field, bytes) {
  pushKey(out, field, 2);
  pushVarint(out, bytes.length);
  out.push(...bytes);
}
function pushString(out, field, value) {
  pushBytes(out, field, te.encode(value));
}
function zigzag(value) {
  const v = BigInt(value);
  return BigInt.asUintN(64, (v << 1n) ^ (v >> 63n));
}
function mapEntry(key, value) {
  const out = [];
  pushString(out, 1, key);
  pushKey(out, 2, 0);
  pushVarint(out, zigzag(value));
  return out;
}
function frame(messages) {
  const size = 4 + messages.reduce((n, m) => n + 4 + m.length, 0);
  const out = new Uint8Array(size);
  const view = new DataView(out.buffer);
  view.setUint32(0, messages.length, true);
  let p = 4;
  for (const message of messages) {
    view.setUint32(p, message.length, true);
    p += 4;
    out.set(message, p);
    p += message.length;
  }
  return out;
}

export function generateFixture(count = MESSAGE_COUNT) {
  let state = FIXTURE_SEED;
  const messages = [];
  for (let i = 0; i < count; i++) {
    state = next(state);
    const out = [];
    const id = (BigInt(state) << 32n) | BigInt(i + 1);
    pushKey(out, 1, 0);
    pushVarint(out, id);
    pushString(out, 2, `café-${i}-東京-${state.toString(16)}`);
    if (i % 97 === 0) pushString(out, 2, `last-${i}`); // duplicate singular: last wins
    pushKey(out, 3, 0);
    pushVarint(out, i % 2 === 0 ? 1 : 0);
    pushKey(out, 4, 1);
    pushDouble(out, i % 991 === 0 ? Infinity : i);
    pushKey(out, 5, 0);
    pushVarint(out, i % 4);
    pushString(out, 6, `tag-${i % 7}`);
    pushString(out, 6, `é-${i % 5}`);
    pushBytes(out, 7, mapEntry("alpha", BigInt((i % 101) - 50)));
    pushBytes(out, 7, mapEntry("βeta", BigInt(i % 37)));
    if (i % 101 === 0) pushBytes(out, 7, mapEntry("alpha", 999n)); // duplicate map key: last wins
    pushBytes(out, 8, new Uint8Array([i & 255, (i >>> 8) & 255, 0, 255]));
    if (i % 2 === 0) {
      pushString(out, 9, `note-${i}`);
      pushKey(out, 10, 0);
      pushVarint(out, i);
    } else {
      pushKey(out, 10, 0);
      pushVarint(out, i);
      pushString(out, 9, `note-${i}`);
    }
    pushKey(out, 11, 5);
    pushFloat(out, i % 997 === 0 ? NaN : i % 983 === 0 ? -Infinity : i % 1000);
    // Unknown fields exercise every admitted wire type and are discarded by ProtoJSON.
    pushKey(out, 90, 0);
    pushVarint(out, state);
    pushKey(out, 91, 1);
    pushDouble(out, i + 0.5);
    pushBytes(out, 92, te.encode(`unknown-${i}`));
    pushKey(out, 93, 5);
    pushFixed32(out, state);
    messages.push(new Uint8Array(out));
  }
  return frame(messages);
}

function readVarint(bytes, cursor) {
  let value = 0n, shift = 0n, at = cursor;
  for (let i = 0; i < 10; i++) {
    if (at >= bytes.length) throw new Error("truncated varint");
    const b = bytes[at++];
    value |= BigInt(b & 127) << shift;
    if (!(b & 128)) {
      if (i === 9 && b > 1) throw new Error("varint overflow");
      return [value, at, i + 1];
    }
    shift += 7n;
  }
  throw new Error("varint overflow");
}
function readLength(bytes, cursor) {
  const [n, at, used] = readVarint(bytes, cursor);
  if (n > BigInt(bytes.length - at)) throw new Error("truncated length");
  return [Number(n), at, used];
}
function skip(bytes, cursor, wire) {
  if (wire === 0) {
    const [, at, used] = readVarint(bytes, cursor);
    return [at, used];
  }
  if (wire === 1) {
    if (cursor + 8 > bytes.length) throw new Error("truncated fixed64");
    return [cursor + 8, 0];
  }
  if (wire === 2) {
    const [n, at, used] = readLength(bytes, cursor);
    return [at + n, used];
  }
  if (wire === 5) {
    if (cursor + 4 > bytes.length) throw new Error("truncated fixed32");
    return [cursor + 4, 0];
  }
  throw new Error(`unsupported wire type ${wire}`);
}
function decodeZigzag(value) {
  return (value >> 1n) ^ -(value & 1n);
}
function parseMap(bytes) {
  let p = 0, key = "", value = 0n;
  while (p < bytes.length) {
    const [tag, at] = readVarint(bytes, p);
    p = at;
    const field = Number(tag >> 3n), wire = Number(tag & 7n);
    if (field === 1 && wire === 2) {
      const [n, q] = readLength(bytes, p);
      key = td.decode(bytes.subarray(q, q + n));
      p = q + n;
    } else if (field === 2 && wire === 0) {
      const [v, q] = readVarint(bytes, p);
      value = decodeZigzag(v);
      p = q;
    } else [p] = skip(bytes, p, wire);
  }
  return [key, value];
}
function emptyMessage() {
  return {
    id: 0n,
    name: "",
    active: false,
    score: 0,
    status: 0,
    tags: [],
    metrics: new Map(),
    payload: new Uint8Array(),
    choiceKind: 0,
    note: "",
    code: 0,
    ratio: 0,
  };
}

export function decodeMessage(bytes, counters = null) {
  const m = emptyMessage();
  let p = 0;
  while (p < bytes.length) {
    const [tag, at, varints] = readVarint(bytes, p);
    p = at;
    const field = Number(tag >> 3n), wire = Number(tag & 7n);
    if (!field) throw new Error("field zero");
    if (counters) {
      counters.fields++;
      counters.varintBytes += varints;
    }
    if (field === 1 && wire === 0) {
      const [v, q, n] = readVarint(bytes, p);
      m.id = v;
      p = q;
      if (counters) counters.varintBytes += n;
    } else if (field === 2 && wire === 2) {
      const [n, q, u] = readLength(bytes, p);
      m.name = td.decode(bytes.subarray(q, q + n));
      p = q + n;
      if (counters) counters.varintBytes += u;
    } else if (field === 3 && wire === 0) {
      const [v, q, n] = readVarint(bytes, p);
      m.active = v !== 0n;
      p = q;
      if (counters) counters.varintBytes += n;
    } else if (field === 4 && wire === 1) {
      if (p + 8 > bytes.length) throw new Error("score truncated");
      m.score = new DataView(bytes.buffer, bytes.byteOffset + p, 8).getFloat64(0, true);
      p += 8;
    } else if (field === 5 && wire === 0) {
      const [v, q, n] = readVarint(bytes, p);
      m.status = Number(v);
      p = q;
      if (counters) counters.varintBytes += n;
    } else if (field === 6 && wire === 2) {
      const [n, q, u] = readLength(bytes, p);
      m.tags.push(td.decode(bytes.subarray(q, q + n)));
      p = q + n;
      if (counters) counters.varintBytes += u;
    } else if (field === 7 && wire === 2) {
      const [n, q, u] = readLength(bytes, p);
      const [k, v] = parseMap(bytes.subarray(q, q + n));
      m.metrics.set(k, v);
      p = q + n;
      if (counters) counters.varintBytes += u;
    } else if (field === 8 && wire === 2) {
      const [n, q, u] = readLength(bytes, p);
      m.payload = bytes.slice(q, q + n);
      p = q + n;
      if (counters) counters.varintBytes += u;
    } else if (field === 9 && wire === 2) {
      const [n, q, u] = readLength(bytes, p);
      m.note = td.decode(bytes.subarray(q, q + n));
      m.choiceKind = 9;
      p = q + n;
      if (counters) counters.varintBytes += u;
    } else if (field === 10 && wire === 0) {
      const [v, q, n] = readVarint(bytes, p);
      m.code = Number(BigInt.asIntN(32, v));
      m.choiceKind = 10;
      p = q;
      if (counters) counters.varintBytes += n;
    } else if (field === 11 && wire === 5) {
      if (p + 4 > bytes.length) throw new Error("ratio truncated");
      m.ratio = new DataView(bytes.buffer, bytes.byteOffset + p, 4).getFloat32(0, true);
      p += 4;
    } else {
      const [q, n] = skip(bytes, p, wire);
      p = q;
      if (counters) {
        counters.unknownFields++;
        counters.varintBytes += n;
      }
    }
  }
  return m;
}
function quote(value) {
  let out = '"';
  for (const ch of value) {
    const cp = ch.codePointAt(0);
    if (ch === '"') out += '\\"';
    else if (ch === "\\") out += "\\\\";
    else if (cp === 8) out += "\\b";
    else if (cp === 9) out += "\\t";
    else if (cp === 10) out += "\\n";
    else if (cp === 12) out += "\\f";
    else if (cp === 13) out += "\\r";
    else if (cp < 32) out += `\\u00${cp.toString(16).padStart(2, "0")}`;
    else out += ch;
  }
  return out + '"';
}
function base64(bytes) {
  const abc = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
  let out = "";
  for (let i = 0; i < bytes.length; i += 3) {
    const a = bytes[i], b = bytes[i + 1], c = bytes[i + 2];
    out += abc[a >> 2] + abc[((a & 3) << 4) | ((b ?? 0) >> 4)] +
      (b === undefined ? "=" : abc[((b & 15) << 2) | ((c ?? 0) >> 6)]) +
      (c === undefined ? "=" : abc[c & 63]);
  }
  return out;
}
function number(value) {
  if (Number.isNaN(value)) return '"NaN"';
  if (value === Infinity) return '"Infinity"';
  if (value === -Infinity) return '"-Infinity"';
  if (Object.is(value, -0)) return "-0";
  return String(value);
}
export function protoJson(m) {
  const fields = [];
  if (m.id !== 0n) fields.push(`"id":"${m.id}"`);
  if (m.name) fields.push(`"name":${quote(m.name)}`);
  if (m.active) fields.push('"active":true');
  if (m.score !== 0) fields.push(`"score":${number(m.score)}`);
  if (m.status !== 0) fields.push(`"status":${quote(STATUS[m.status] ?? String(m.status))}`);
  if (m.tags.length) fields.push(`"tags":[${m.tags.map(quote).join(",")}]`);
  if (m.metrics.size) {
    fields.push(
      `"metrics":{${
        [...m.metrics].sort(([a], [b]) => a < b ? -1 : a > b ? 1 : 0).map(([k, v]) =>
          `${quote(k)}:${quote(String(v))}`
        ).join(",")
      }}`,
    );
  }
  if (m.payload.length) fields.push(`"payload":${quote(base64(m.payload))}`);
  if (m.choiceKind === 9) fields.push(`"note":${quote(m.note)}`);
  else if (m.choiceKind === 10) fields.push(`"code":${m.code}`);
  if (m.ratio !== 0) fields.push(`"ratio":${number(m.ratio)}`);
  return `{${fields.join(",")}}`;
}
export function runJavaScript(input) {
  const view = new DataView(input.buffer, input.byteOffset, input.byteLength);
  if (input.length < 4) throw new Error("frame truncated");
  const count = view.getUint32(0, true);
  if (count !== MESSAGE_COUNT) throw new Error(`expected ${MESSAGE_COUNT} messages`);
  let p = 4;
  const output = [];
  const counters = {
    messages: 0,
    fields: 0,
    varintBytes: 0,
    unknownFields: 0,
    filteredMessages: 0,
    wireBytes: input.length,
    protoJsonBytes: 0,
    allocations: 2,
    boundaryCrossings: 0,
  };
  for (let i = 0; i < count; i++) {
    if (p + 4 > input.length) throw new Error("message frame truncated");
    const n = view.getUint32(p, true);
    p += 4;
    if (p + n > input.length) throw new Error("message truncated");
    const m = decodeMessage(input.subarray(p, p + n), counters);
    p += n;
    counters.messages++;
    counters.allocations += 4;
    if (m.active && m.status !== 3 && m.id % 3n === 0n) {
      output.push(protoJson(m));
      counters.filteredMessages++;
      counters.allocations++;
    }
  }
  if (p !== input.length) throw new Error("trailing frame bytes");
  const text = `[${output.join(",")}]`;
  const bytes = te.encode(text);
  counters.protoJsonBytes = bytes.length;
  return { bytes, text, counters };
}
export async function sha256Hex(bytes) {
  return [...new Uint8Array(await crypto.subtle.digest("SHA-256", bytes))].map((b) =>
    b.toString(16).padStart(2, "0")
  ).join("");
}

export async function runWasm(input, wasmBytes) {
  const instance = await WebAssembly.instantiate(wasmBytes, {});
  const { memory, process } = instance.instance.exports;
  const inputPtr = 1024 * 1024,
    outputPtr = (inputPtr + input.length + 65535) & ~65535,
    outputCap = 16 * 1024 * 1024,
    countersPtr = outputPtr + outputCap;
  if (countersPtr + 40 > memory.buffer.byteLength) throw new Error("Wasm memory too small");
  new Uint8Array(memory.buffer, inputPtr, input.length).set(input);
  const len = process(inputPtr, input.length, outputPtr, outputCap, countersPtr);
  if (len < 0) throw new Error(`Wasm protobuf error ${len}`);
  const bytes = new Uint8Array(memory.buffer, outputPtr, len).slice();
  const c = new Uint32Array(memory.buffer, countersPtr, 10);
  return {
    bytes,
    text: td.decode(bytes),
    counters: {
      messages: c[0],
      fields: c[1],
      varintBytes: c[2],
      unknownFields: c[3],
      filteredMessages: c[4],
      wireBytes: c[5],
      protoJsonBytes: c[6],
      allocations: c[7],
      boundaryCrossings: c[8],
    },
  };
}
