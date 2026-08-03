function h2Frame(type, flags, stream, payload) {
  const out = new Uint8Array(9 + payload.length);
  out[0] = payload.length >>> 16;
  out[1] = payload.length >>> 8;
  out[2] = payload.length;
  out[3] = type;
  out[4] = flags;
  out[5] = stream >>> 24;
  out[6] = stream >>> 16;
  out[7] = stream >>> 8;
  out[8] = stream;
  out.set(payload, 9);
  return out;
}
function record(protocol, bytes) {
  if (bytes.length > 0xffff) throw new RangeError("record too large");
  const out = new Uint8Array(3 + bytes.length);
  out[0] = protocol;
  out[1] = bytes.length;
  out[2] = bytes.length >>> 8;
  out.set(bytes, 3);
  return out;
}
function concat(...parts) {
  const out = new Uint8Array(parts.reduce((n, p) => n + p.length, 0));
  let at = 0;
  for (const part of parts) {
    out.set(part, at);
    at += part.length;
  }
  return out;
}
function qv(value) {
  if (value < 64) return Uint8Array.of(value);
  if (value < 16384) return Uint8Array.of(0x40 | (value >>> 8), value & 255);
  throw new RangeError("fixture varint exceeds two-byte range");
}

export function makeProtocolTrace() {
  const settings = h2Frame(4, 0, 0, Uint8Array.of(0, 1, 0, 0, 16, 0));
  const hpack = Uint8Array.of(
    0x82,
    0x40,
    0x05,
    0x78,
    0x2d,
    0x72,
    0x75,
    0x6e,
    0x03,
    0x6f,
    0x6e,
    0x65,
    0xbe,
  );
  const headers = h2Frame(1, 0, 1, hpack.subarray(0, 7));
  const continuation = h2Frame(9, 4, 1, hpack.subarray(7));
  const data = h2Frame(0, 1, 1, new TextEncoder().encode("payload"));
  const window = h2Frame(8, 0, 0, Uint8Array.of(0, 0, 4, 0));
  const reset = h2Frame(3, 0, 3, Uint8Array.of(0, 0, 0, 8));

  const qpack = concat(
    Uint8Array.of(0x3f, 0x21),
    Uint8Array.of(0x46),
    new TextEncoder().encode("x-quic"),
    Uint8Array.of(0x03),
    new TextEncoder().encode("two"),
    Uint8Array.of(0x00),
  );
  const qpackStream = concat(Uint8Array.of(0x0a), qv(2), qv(qpack.length), qpack);
  const requestStream = concat(
    Uint8Array.of(0x0f),
    qv(0),
    qv(0),
    qv(5),
    new TextEncoder().encode("hello"),
  );
  const ack = Uint8Array.of(0x02, 5, 0, 0, 0);
  const maxData = concat(Uint8Array.of(0x10), qv(1000));
  const resetStream = Uint8Array.of(0x04, 0, 1, 5);
  const close = concat(
    Uint8Array.of(0x1c),
    qv(0x10),
    qv(0x0a),
    qv(3),
    new TextEncoder().encode("bye"),
  );

  return concat(
    record(1, concat(settings, headers)),
    record(1, concat(continuation, data)),
    record(1, concat(window, reset)),
    record(2, concat(qpackStream, ack)),
    record(2, concat(requestStream, maxData)),
    record(2, concat(resetStream, close)),
  );
}

export function makeMalformedTraces() {
  return [
    Uint8Array.of(1, 9, 0, 0, 0),
    record(1, h2Frame(9, 4, 1, Uint8Array.of(0x82))),
    record(2, Uint8Array.of(0x0a, 2, 10, 1)),
    record(2, Uint8Array.of(0x3f)),
    Uint8Array.of(3, 0, 0),
  ];
}
