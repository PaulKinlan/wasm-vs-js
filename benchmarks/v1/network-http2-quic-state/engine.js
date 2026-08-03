export const STATE_WORDS = 64;

const S = Object.freeze({
  schema: 0,
  records: 1,
  bytes: 2,
  h2Frames: 3,
  h2Settings: 4,
  h2Headers: 5,
  h2Continuation: 6,
  h2Data: 7,
  h2WindowUpdate: 8,
  h2Rst: 9,
  hpackStaticHits: 10,
  hpackDynamicInserts: 11,
  hpackDynamicHits: 12,
  hpackDynamicBytes: 13,
  h2Open: 14,
  h2Closed: 15,
  h2DataBytes: 16,
  h2Window: 17,
  quicFrames: 18,
  quicStream: 19,
  quicAck: 20,
  quicMaxData: 21,
  quicReset: 22,
  quicClose: 23,
  qpackCapacity: 24,
  qpackInserts: 25,
  qpackDuplicates: 26,
  qpackDynamicBytes: 27,
  quicStreamBytes: 28,
  quicMaxDataValue: 29,
  events: 30,
  errors: 31,
  eventBase: 32,
});

function pushEvent(out, code) {
  const index = out[S.events]++;
  if (index < STATE_WORDS - S.eventBase) out[S.eventBase + index] = code;
}

function fail(out, code) {
  out[S.errors]++;
  pushEvent(out, 0x8000 | code);
}

function u24(b, p) {
  return (b[p] << 16) | (b[p + 1] << 8) | b[p + 2];
}
function u32(b, p) {
  return ((b[p] << 24) | (b[p + 1] << 16) | (b[p + 2] << 8) | b[p + 3]) >>> 0;
}

function prefixed(bytes, p, prefix) {
  if (p >= bytes.length) return null;
  const mask = (1 << prefix) - 1;
  let value = bytes[p] & mask;
  p++;
  if (value < mask) return [value, p];
  let shift = 0;
  while (p < bytes.length && shift <= 28) {
    const octet = bytes[p++];
    value += (octet & 0x7f) << shift;
    if ((octet & 0x80) === 0) return [value >>> 0, p];
    shift += 7;
  }
  return null;
}

function parseHpack(block, out) {
  let p = 0;
  while (p < block.length) {
    const first = block[p];
    if (first & 0x80) {
      const got = prefixed(block, p, 7);
      if (!got || got[0] === 0) return fail(out, 11);
      const [index, next] = got;
      p = next;
      if (index <= 61) out[S.hpackStaticHits]++;
      else if (index <= 61 + out[S.hpackDynamicInserts]) out[S.hpackDynamicHits]++;
      else fail(out, 12);
      pushEvent(out, 0x1100 | (index & 0xff));
      continue;
    }
    if (first & 0x40) {
      const nameIndex = prefixed(block, p, 6);
      if (!nameIndex) return fail(out, 13);
      p = nameIndex[1];
      let nameLen = 0;
      if (nameIndex[0] === 0) {
        const got = prefixed(block, p, 7);
        if (!got) return fail(out, 14);
        nameLen = got[0];
        p = got[1];
        if (p + nameLen > block.length) return fail(out, 15);
        p += nameLen;
      } else if (nameIndex[0] <= 61) out[S.hpackStaticHits]++;
      const value = prefixed(block, p, 7);
      if (!value) return fail(out, 16);
      const valueLen = value[0];
      p = value[1];
      if (p + valueLen > block.length) return fail(out, 17);
      p += valueLen;
      out[S.hpackDynamicInserts]++;
      out[S.hpackDynamicBytes] += nameLen + valueLen + 32;
      pushEvent(out, 0x1200 | (out[S.hpackDynamicInserts] & 0xff));
      continue;
    }
    fail(out, 18);
    return;
  }
}

function parseH2(bytes, out, pending) {
  let p = 0;
  while (p < bytes.length) {
    if (p + 9 > bytes.length) return fail(out, 1);
    const len = u24(bytes, p);
    const type = bytes[p + 3];
    const flags = bytes[p + 4];
    const stream = u32(bytes, p + 5) & 0x7fffffff;
    p += 9;
    if (p + len > bytes.length) return fail(out, 2);
    const payload = bytes.subarray(p, p + len);
    p += len;
    out[S.h2Frames]++;
    if (type === 4) {
      if (stream !== 0 || len % 6 !== 0) fail(out, 3);
      else out[S.h2Settings]++;
      pushEvent(out, 0x0104);
    } else if (type === 1) {
      if (stream === 0) fail(out, 4);
      out[S.h2Headers]++;
      out[S.h2Open] = stream;
      pending.length = 0;
      pending.push(...payload);
      if (flags & 4) {
        parseHpack(Uint8Array.from(pending), out);
        pending.length = 0;
      }
      pushEvent(out, 0x0101);
    } else if (type === 9) {
      out[S.h2Continuation]++;
      if (pending.length === 0 || stream !== out[S.h2Open]) fail(out, 5);
      pending.push(...payload);
      if (flags & 4) {
        parseHpack(Uint8Array.from(pending), out);
        pending.length = 0;
      }
      pushEvent(out, 0x0109);
    } else if (type === 0) {
      out[S.h2Data]++;
      out[S.h2DataBytes] += len;
      if (flags & 1) out[S.h2Closed] = stream;
      pushEvent(out, 0x0100);
    } else if (type === 8) {
      out[S.h2WindowUpdate]++;
      if (len !== 4) fail(out, 6);
      else out[S.h2Window] += u32(payload, 0) & 0x7fffffff;
      pushEvent(out, 0x0108);
    } else if (type === 3) {
      out[S.h2Rst]++;
      if (len !== 4 || stream === 0) fail(out, 7);
      else out[S.h2Closed] = stream;
      pushEvent(out, 0x0103);
    } else fail(out, 8);
  }
}

function quicVarint(bytes, p) {
  if (p >= bytes.length) return null;
  const first = bytes[p];
  const n = 1 << (first >> 6);
  if (p + n > bytes.length || n > 4) return null;
  let value = first & 0x3f;
  for (let i = 1; i < n; i++) value = value * 256 + bytes[p + i];
  return [value >>> 0, p + n];
}

function parseQpack(bytes, out) {
  let p = 0;
  while (p < bytes.length) {
    const first = bytes[p];
    if ((first & 0xe0) === 0x20) {
      const got = prefixed(bytes, p, 5);
      if (!got) return fail(out, 31);
      out[S.qpackCapacity] = got[0];
      p = got[1];
      pushEvent(out, 0x2201);
    } else if ((first & 0xc0) === 0x40) {
      const name = prefixed(bytes, p, 5);
      if (!name) return fail(out, 32);
      p = name[1];
      if (p + name[0] > bytes.length) return fail(out, 33);
      p += name[0];
      const value = prefixed(bytes, p, 7);
      if (!value) return fail(out, 34);
      p = value[1];
      if (p + value[0] > bytes.length) return fail(out, 35);
      p += value[0];
      out[S.qpackInserts]++;
      out[S.qpackDynamicBytes] += name[0] + value[0] + 32;
      pushEvent(out, 0x2202);
    } else if ((first & 0xe0) === 0) {
      const dup = prefixed(bytes, p, 5);
      if (!dup) return fail(out, 36);
      p = dup[1];
      if (dup[0] >= out[S.qpackInserts]) fail(out, 37);
      else {
        out[S.qpackDuplicates]++;
        out[S.qpackDynamicBytes] *= 2;
      }
      pushEvent(out, 0x2203);
    } else return fail(out, 38);
  }
}

function parseQuic(bytes, out) {
  let p = 0;
  while (p < bytes.length) {
    const typeGot = quicVarint(bytes, p);
    if (!typeGot) return fail(out, 20);
    const type = typeGot[0];
    p = typeGot[1];
    out[S.quicFrames]++;
    if ((type & 0xf8) === 0x08) {
      const streamGot = quicVarint(bytes, p);
      if (!streamGot) return fail(out, 21);
      const stream = streamGot[0];
      p = streamGot[1];
      if (type & 4) {
        const off = quicVarint(bytes, p);
        if (!off) return fail(out, 22);
        p = off[1];
      }
      let len = bytes.length - p;
      if (type & 2) {
        const got = quicVarint(bytes, p);
        if (!got) return fail(out, 23);
        len = got[0];
        p = got[1];
      }
      if (p + len > bytes.length) return fail(out, 24);
      const data = bytes.subarray(p, p + len);
      p += len;
      out[S.quicStream]++;
      out[S.quicStreamBytes] += len;
      if (stream === 2) parseQpack(data, out);
      pushEvent(out, 0x0208 | (type & 7));
    } else if (type === 0x02) {
      for (let i = 0; i < 4; i++) {
        const got = quicVarint(bytes, p);
        if (!got) return fail(out, 25);
        p = got[1];
      }
      out[S.quicAck]++;
      pushEvent(out, 0x0202);
    } else if (type === 0x10) {
      const got = quicVarint(bytes, p);
      if (!got) return fail(out, 26);
      p = got[1];
      out[S.quicMaxData]++;
      out[S.quicMaxDataValue] = got[0];
      pushEvent(out, 0x0210);
    } else if (type === 0x04) {
      for (let i = 0; i < 3; i++) {
        const got = quicVarint(bytes, p);
        if (!got) return fail(out, 27);
        p = got[1];
      }
      out[S.quicReset]++;
      pushEvent(out, 0x0204);
    } else if (type === 0x1c) {
      for (let i = 0; i < 2; i++) {
        const got = quicVarint(bytes, p);
        if (!got) return fail(out, 28);
        p = got[1];
      }
      const reason = quicVarint(bytes, p);
      if (!reason) return fail(out, 29);
      p = reason[1];
      if (p + reason[0] > bytes.length) return fail(out, 30);
      p += reason[0];
      out[S.quicClose]++;
      pushEvent(out, 0x021c);
    } else return fail(out, 39);
  }
}

export function runProtocolTrace(input) {
  const bytes = input instanceof Uint8Array ? input : new Uint8Array(input);
  const out = new Uint32Array(STATE_WORDS);
  out[S.schema] = 1;
  out[S.bytes] = bytes.length;
  const pending = [];
  let p = 0;
  while (p < bytes.length) {
    if (p + 3 > bytes.length) {
      fail(out, 40);
      break;
    }
    const protocol = bytes[p++];
    const len = bytes[p] | (bytes[p + 1] << 8);
    p += 2;
    if (p + len > bytes.length) {
      fail(out, 41);
      break;
    }
    const record = bytes.subarray(p, p + len);
    p += len;
    out[S.records]++;
    if (protocol === 1) parseH2(record, out, pending);
    else if (protocol === 2) parseQuic(record, out);
    else fail(out, 42);
  }
  if (pending.length) fail(out, 43);
  return out;
}
