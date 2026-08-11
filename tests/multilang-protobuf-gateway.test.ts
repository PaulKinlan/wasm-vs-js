// multilang-protobuf-gateway.test.ts — every multilang engine's
// serialization.protobuf-gateway.v1 compute core must produce the EXACT
// oracle of a wire-level record-oriented JS decoder (mirrors
// decodeMessage() in benchmarks/base/serialization-protobuf-gateway/
// workload.js at the wire layer — no JS Map deduplication semantics) on the
// frozen 1,534,122-byte fixture at
// public/artifacts/serialization-protobuf-gateway-multilang/fixture.bin:
// messages=10000, fields=170294, varint-bytes=474984, unknown-fields=40000,
// filtered=1703, wire-bytes=1534122, summary FNV-1a=0xea8c453e.
//
// The JS reference oracle also asserts that the on-disk fixture bytes match
// generateFixture() from workload.js so JS decoder aggregate counters
// (messages/fields/varintBytes/unknownFields/filteredMessages) match the JS
// engine's runJavaScript() on the same corpus.
import { assert } from "./assert.ts";

const rootDir = new URL("../", import.meta.url).pathname.replace(/\/$/, "");
const ARTIFACTS = `${rootDir}/public/artifacts/multilang-wasm-benchmark`;
const FIXTURE_PATH =
  `${rootDir}/public/artifacts/serialization-protobuf-gateway-multilang/fixture.bin`;
const FIXTURE_OFFSET = 3145728;
const RES_OFFSET = 6291456;

const ORACLE = Object.freeze({
  messages: 10000,
  fields: 170294,
  varintBytes: 474984,
  unknownFields: 40000,
  filtered: 1703,
  wireBytes: 1534122,
  summaryFnv1a: 0x184d983e,
});

async function readFixture(): Promise<Uint8Array> {
  return await Deno.readFile(FIXTURE_PATH);
}

async function loadWasm(file: string, imports: WebAssembly.Imports = {}) {
  const bytes = await Deno.readFile(`${ARTIFACTS}/${file}`);
  const { instance } = await WebAssembly.instantiate(bytes, imports);
  return instance;
}

function runKernel(instance: WebAssembly.Instance, fixture: Uint8Array) {
  const exports = instance.exports as Record<string, unknown>;
  const mem = new Uint8Array((exports.memory as WebAssembly.Memory).buffer);
  mem.set(fixture, FIXTURE_OFFSET);
  const ret = Number(
    (exports.protobuf_gateway as (n: number) => number)(fixture.byteLength),
  );
  const view = new Uint32Array((exports.memory as WebAssembly.Memory).buffer);
  const base = RES_OFFSET / 4;
  return {
    ret,
    messages: view[base],
    fields: view[base + 1],
    varintBytes: view[base + 2],
    unknownFields: view[base + 3],
    filtered: view[base + 4],
    wireBytes: view[base + 5],
    summaryFnv1a: view[base + 6] >>> 0,
    status: view[base + 7],
  };
}

function assertOracle(label: string, r: ReturnType<typeof runKernel>) {
  assert(r.ret === 0, `${label} run returned non-zero status ${r.ret}`);
  assert(
    r.summaryFnv1a === ORACLE.summaryFnv1a,
    `${label} summary FNV-1a ${r.summaryFnv1a.toString(16)} != ${ORACLE.summaryFnv1a.toString(16)}`,
  );
  const counterFields: Array<
    [keyof typeof ORACLE, keyof ReturnType<typeof runKernel>]
  > = [
    ["messages", "messages"],
    ["fields", "fields"],
    ["varintBytes", "varintBytes"],
    ["unknownFields", "unknownFields"],
    ["filtered", "filtered"],
    ["wireBytes", "wireBytes"],
  ];
  for (const [expectedKey, actualKey] of counterFields) {
    const expected = ORACLE[expectedKey] as number;
    const actual = r[actualKey] as number;
    assert(
      actual === expected,
      `${label} ${String(actualKey)} ${actual} != ${expected}`,
    );
  }
}

// Wire-level record-oriented JS decoder (matches the kernels' summary
// semantics — no JS Map deduplication).
function readVarintLoHi(
  bytes: Uint8Array,
  at: number,
): { lo: number; hi: number; used: number; next: number } {
  let lo = 0n, hi = 0n;
  let shift = 0n;
  let used = 0;
  for (let i = 0; i < 10; i++) {
    const b = bytes[at++];
    used++;
    if (shift < 32n) {
      const contrib = BigInt(b & 0x7f) << shift;
      lo |= contrib & 0xffffffffn;
      hi |= (contrib >> 32n) & 0xffffffffn;
    } else {
      hi |= (BigInt(b & 0x7f) << (shift - 32n)) & 0xffffffffn;
    }
    if (!(b & 0x80)) {
      return { lo: Number(lo), hi: Number(hi), used, next: at };
    }
    shift += 7n;
  }
  throw new Error("varint overflow");
}

function skipReturn(
  bytes: Uint8Array,
  at: number,
  wire: number,
): { next: number; used: number } {
  if (wire === 0) {
    const v = readVarintLoHi(bytes, at);
    return { next: v.next, used: v.used };
  }
  if (wire === 1) return { next: at + 8, used: 0 };
  if (wire === 2) {
    const v = readVarintLoHi(bytes, at);
    return { next: v.next + v.lo, used: v.used };
  }
  if (wire === 5) return { next: at + 4, used: 0 };
  throw new Error(`bad wire ${wire}`);
}

interface Decoded {
  idLo: number;
  idHi: number;
  active: number;
  status: number;
  nameLen: number;
  tagCount: number;
  mapCount: number;
  payloadLen: number;
  choiceKind: number;
  noteLen: number;
  code: number;
  fields: number;
  varintBytes: number;
  unknownFields: number;
}

function decodeForKernel(bytes: Uint8Array): Decoded {
  let cur = 0;
  const end = bytes.length;
  const r: Decoded = {
    idLo: 0,
    idHi: 0,
    active: 0,
    status: 0,
    nameLen: 0,
    tagCount: 0,
    mapCount: 0,
    payloadLen: 0,
    choiceKind: 0,
    noteLen: 0,
    code: 0,
    fields: 0,
    varintBytes: 0,
    unknownFields: 0,
  };
  while (cur < end) {
    const t = readVarintLoHi(bytes, cur);
    if (t.hi !== 0) throw new Error("tag hi != 0");
    cur = t.next;
    const field = t.lo >>> 3;
    const wire = t.lo & 7;
    if (field === 0) throw new Error("field 0");
    r.fields++;
    r.varintBytes += t.used;
    if (field === 1 && wire === 0) {
      const v = readVarintLoHi(bytes, cur);
      r.idLo = v.lo;
      r.idHi = v.hi;
      cur = v.next;
      r.varintBytes += v.used;
    } else if (field === 2 && wire === 2) {
      const v = readVarintLoHi(bytes, cur);
      r.nameLen = v.lo;
      cur = v.next + v.lo;
      r.varintBytes += v.used;
    } else if (field === 3 && wire === 0) {
      const v = readVarintLoHi(bytes, cur);
      r.active = v.lo !== 0 || v.hi !== 0 ? 1 : 0;
      cur = v.next;
      r.varintBytes += v.used;
    } else if (field === 4 && wire === 1) cur += 8;
    else if (field === 5 && wire === 0) {
      const v = readVarintLoHi(bytes, cur);
      r.status = v.lo >>> 0;
      cur = v.next;
      r.varintBytes += v.used;
    } else if (field === 6 && wire === 2) {
      const v = readVarintLoHi(bytes, cur);
      cur = v.next + v.lo;
      r.tagCount++;
      r.varintBytes += v.used;
    } else if (field === 7 && wire === 2) {
      const v = readVarintLoHi(bytes, cur);
      cur = v.next + v.lo;
      r.mapCount++;
      r.varintBytes += v.used;
    } else if (field === 8 && wire === 2) {
      const v = readVarintLoHi(bytes, cur);
      r.payloadLen = v.lo;
      cur = v.next + v.lo;
      r.varintBytes += v.used;
    } else if (field === 9 && wire === 2) {
      const v = readVarintLoHi(bytes, cur);
      r.noteLen = v.lo;
      r.choiceKind = 9;
      cur = v.next + v.lo;
      r.varintBytes += v.used;
    } else if (field === 10 && wire === 0) {
      const v = readVarintLoHi(bytes, cur);
      r.code = v.lo;
      r.choiceKind = 10;
      cur = v.next;
      r.varintBytes += v.used;
    } else if (field === 11 && wire === 5) cur += 4;
    else {
      const s = skipReturn(bytes, cur, wire);
      cur = s.next;
      r.unknownFields++;
      r.varintBytes += s.used;
    }
  }
  return r;
}

function mod3u64(lo: number, hi: number): number {
  let r = 0;
  for (let i = 31; i >= 0; i--) {
    r = ((r << 1) | ((hi >>> i) & 1)) >>> 0;
    if (r >= 3) r -= 3;
  }
  for (let i = 31; i >= 0; i--) {
    r = ((r << 1) | ((lo >>> i) & 1)) >>> 0;
    if (r >= 3) r -= 3;
  }
  return r;
}

Deno.test("multilang protobuf-gateway: JS wire-level decoder matches the oracle exactly", async () => {
  const fixture = await readFixture();
  const { generateFixture, runJavaScript } = await import(
    `${rootDir}/benchmarks/base/serialization-protobuf-gateway/workload.js`
  );
  const generated = generateFixture();
  assert(
    generated.byteLength === fixture.byteLength,
    `generated fixture length ${generated.byteLength} != on-disk ${fixture.byteLength}`,
  );
  for (let i = 0; i < generated.byteLength; i++) {
    if (generated[i] !== fixture[i]) {
      throw new Error(`generated fixture mismatch at byte ${i}`);
    }
  }

  // Cross-check aggregate counters against runJavaScript()'s counters on
  // the same corpus — the wire-record decoder must agree on messages,
  // fields, varint-bytes, unknown-fields, filtered-messages, and wire-bytes.
  const refRun = runJavaScript(fixture);
  assert(
    refRun.counters.messages === ORACLE.messages,
    `runJavaScript messages ${refRun.counters.messages} != ${ORACLE.messages}`,
  );
  assert(
    refRun.counters.fields === ORACLE.fields,
    `runJavaScript fields ${refRun.counters.fields} != ${ORACLE.fields}`,
  );
  assert(
    refRun.counters.varintBytes === ORACLE.varintBytes,
    `runJavaScript varintBytes ${refRun.counters.varintBytes} != ${ORACLE.varintBytes}`,
  );
  assert(
    refRun.counters.unknownFields === ORACLE.unknownFields,
    `runJavaScript unknownFields ${refRun.counters.unknownFields} != ${ORACLE.unknownFields}`,
  );
  assert(
    refRun.counters.filteredMessages === ORACLE.filtered,
    `runJavaScript filteredMessages ${refRun.counters.filteredMessages} != ${ORACLE.filtered}`,
  );
  assert(
    refRun.counters.wireBytes === ORACLE.wireBytes,
    `runJavaScript wireBytes ${refRun.counters.wireBytes} != ${ORACLE.wireBytes}`,
  );

  // Now compute the kernel-shaped summary digest via the wire-level decoder.
  const view = new DataView(
    fixture.buffer,
    fixture.byteOffset,
    fixture.byteLength,
  );
  const count = view.getUint32(0, true);
  assert(count === ORACLE.messages, `count ${count} != ${ORACLE.messages}`);
  let fnv = 0x811c9dc5 >>> 0;
  const mixU32 = (v: number) => {
    fnv = (fnv ^ (v & 0xff)) >>> 0;
    fnv = Math.imul(fnv, 0x01000193) >>> 0;
    fnv = (fnv ^ ((v >>> 8) & 0xff)) >>> 0;
    fnv = Math.imul(fnv, 0x01000193) >>> 0;
    fnv = (fnv ^ ((v >>> 16) & 0xff)) >>> 0;
    fnv = Math.imul(fnv, 0x01000193) >>> 0;
    fnv = (fnv ^ ((v >>> 24) & 0xff)) >>> 0;
    fnv = Math.imul(fnv, 0x01000193) >>> 0;
  };
  let p = 4;
  let messages = 0;
  let fields = 0;
  let varintBytes = 0;
  let unknownFields = 0;
  let filtered = 0;
  for (let i = 0; i < count; i++) {
    const n = view.getUint32(p, true);
    p += 4;
    const m = decodeForKernel(fixture.subarray(p, p + n));
    fields += m.fields;
    varintBytes += m.varintBytes;
    unknownFields += m.unknownFields;
    const pass = m.active && m.status !== 3 && mod3u64(m.idLo, m.idHi) === 0 ? 1 : 0;
    if (pass) filtered++;
    mixU32(m.idLo);
    mixU32(m.idHi);
    mixU32(m.active);
    mixU32(m.status);
    mixU32(m.nameLen);
    mixU32(m.tagCount);
    mixU32(m.mapCount);
    mixU32(m.payloadLen);
    mixU32(m.choiceKind);
    mixU32(m.noteLen);
    mixU32(m.code);
    mixU32(pass);
    messages++;
    p += n;
  }
  assert(messages === ORACLE.messages, `messages ${messages}`);
  assert(fields === ORACLE.fields, `fields ${fields}`);
  assert(varintBytes === ORACLE.varintBytes, `varintBytes ${varintBytes}`);
  assert(
    unknownFields === ORACLE.unknownFields,
    `unknownFields ${unknownFields}`,
  );
  assert(filtered === ORACLE.filtered, `filtered ${filtered}`);
  assert(
    fnv === ORACLE.summaryFnv1a,
    `JS summary FNV-1a ${fnv.toString(16)} != ${ORACLE.summaryFnv1a.toString(16)}`,
  );
});

Deno.test("multilang protobuf-gateway: C kernel matches the JS oracle exactly", async () => {
  const fixture = await readFixture();
  const r = runKernel(
    await loadWasm("protobuf_gateway_kernel_c.wasm"),
    fixture,
  );
  assertOracle("C", r);
});

Deno.test("multilang protobuf-gateway: C++ kernel matches the JS oracle exactly", async () => {
  const fixture = await readFixture();
  const r = runKernel(
    await loadWasm("protobuf_gateway_kernel_cpp.wasm"),
    fixture,
  );
  assertOracle("C++", r);
});

Deno.test("multilang protobuf-gateway: Rust kernel matches the JS oracle exactly", async () => {
  const fixture = await readFixture();
  const r = runKernel(
    await loadWasm("protobuf_gateway_kernel_rs.wasm"),
    fixture,
  );
  assertOracle("Rust", r);
});

Deno.test("multilang protobuf-gateway: AssemblyScript kernel matches the JS oracle exactly", async () => {
  const fixture = await readFixture();
  const r = runKernel(
    await loadWasm("protobuf_gateway_kernel_asc.wasm", {
      env: { abort: () => {} },
    }),
    fixture,
  );
  assertOracle("AS", r);
});
