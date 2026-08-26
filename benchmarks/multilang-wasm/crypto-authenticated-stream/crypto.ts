// crypto.ts — AssemblyScript multilang kernel for
// crypto.authenticated-stream.v1.
//
// Mirrors crypto.c exactly: ChaCha20 with the RFC 8439 quarter-round schedule
// and a counter starting at 1 for the payload, plus the 26-bit-limb Poly1305
// with the same carry propagation, the same constant-time final reduction, and
// the same AAD/ciphertext/lengths MAC order. Every value is u32 or u64 with
// wrapping semantics, matching the C.
//
// Scratch (the ChaCha working state, the Poly1305 state, the block buffers)
// lives at fixed low offsets rather than in AssemblyScript arrays: a
// heap-allocated array would sit where the caller places its buffers.

// ── Scratch layout ────────────────────────────────────────────────────────
// Placed on page 1 and above. The caller owns the low region: key at 0, nonce
// at 64, AAD at 96, plaintext at 256, ciphertext at 8192 and tag at 16384, so
// scratch at offset 0 would be overwritten by the key on every call.
const SCRATCH_BASE: usize = 65536;
const X_OFF: usize = SCRATCH_BASE; // u32[16] ChaCha working state
const INITIAL_OFF: usize = SCRATCH_BASE + 64; // u32[16] ChaCha initial state
const BLOCK_OFF: usize = SCRATCH_BASE + 128; // u8[64] keystream block
const POLY_OFF: usize = SCRATCH_BASE + 192; // u32[18] Poly1305 state
const PAD_BLOCK_OFF: usize = SCRATCH_BASE + 264; // u8[16] partial-block padding
const LENGTHS_OFF: usize = SCRATCH_BASE + 280; // u8[16] AAD/ciphertext lengths
const EXPECTED_OFF: usize = SCRATCH_BASE + 296; // u8[16] recomputed tag
const SCRATCH_END: usize = SCRATCH_BASE + 320;

// Poly1305 state field indices within POLY_OFF.
const R0 = 0, R1 = 1, R2 = 2, R3 = 3, R4 = 4;
const S1 = 5, S2 = 6, S3 = 7, S4 = 8;
const H0 = 9, H1 = 10, H2 = 11, H3 = 12, H4 = 13;
const PAD0 = 14, PAD1 = 15, PAD2 = 16, PAD3 = 17;

function ps(i: i32): u32 {
  return load<u32>(POLY_OFF + (<usize> i) * 4);
}

function setPs(i: i32, v: u32): void {
  store<u32>(POLY_OFF + (<usize> i) * 4, v);
}

function load32(p: usize): u32 {
  return <u32> load<u8>(p) | (<u32> load<u8>(p + 1) << 8) |
    (<u32> load<u8>(p + 2) << 16) | (<u32> load<u8>(p + 3) << 24);
}

function store32(p: usize, x: u32): void {
  store<u8>(p, <u8> x);
  store<u8>(p + 1, <u8> (x >> 8));
  store<u8>(p + 2, <u8> (x >> 16));
  store<u8>(p + 3, <u8> (x >> 24));
}

function store64(p: usize, x0: u64): void {
  let x: u64 = x0;
  for (let i: u32 = 0; i < 8; i++) {
    store<u8>(p + <usize> i, <u8> x);
    x >>= 8;
  }
}

function rotl(x: u32, n: u32): u32 {
  return (x << n) | (x >> (32 - n));
}

function xget(i: i32): u32 {
  return load<u32>(X_OFF + (<usize> i) * 4);
}

function xset(i: i32, v: u32): void {
  store<u32>(X_OFF + (<usize> i) * 4, v);
}

/** RFC 8439 quarter round on four working-state indices. */
function qr(ai: i32, bi: i32, ci: i32, di: i32): void {
  let a: u32 = xget(ai), b: u32 = xget(bi), c: u32 = xget(ci), d: u32 = xget(di);
  a += b;
  d = rotl(d ^ a, 16);
  c += d;
  b = rotl(b ^ c, 12);
  a += b;
  d = rotl(d ^ a, 8);
  c += d;
  b = rotl(b ^ c, 7);
  xset(ai, a);
  xset(bi, b);
  xset(ci, c);
  xset(di, d);
}

function chachaBlock(key: usize, counter: u32, nonce: usize, out: usize): void {
  store<u32>(INITIAL_OFF, 0x61707865);
  store<u32>(INITIAL_OFF + 4, 0x3320646e);
  store<u32>(INITIAL_OFF + 8, 0x79622d32);
  store<u32>(INITIAL_OFF + 12, 0x6b206574);
  for (let i: u32 = 0; i < 8; i++) {
    store<u32>(INITIAL_OFF + (<usize> (4 + i)) * 4, load32(key + (<usize> i) * 4));
  }
  store<u32>(INITIAL_OFF + 12 * 4, counter);
  store<u32>(INITIAL_OFF + 13 * 4, load32(nonce));
  store<u32>(INITIAL_OFF + 14 * 4, load32(nonce + 4));
  store<u32>(INITIAL_OFF + 15 * 4, load32(nonce + 8));
  for (let i: i32 = 0; i < 16; i++) {
    xset(i, load<u32>(INITIAL_OFF + (<usize> i) * 4));
  }
  for (let i: u32 = 0; i < 10; i++) {
    qr(0, 4, 8, 12);
    qr(1, 5, 9, 13);
    qr(2, 6, 10, 14);
    qr(3, 7, 11, 15);
    qr(0, 5, 10, 15);
    qr(1, 6, 11, 12);
    qr(2, 7, 8, 13);
    qr(3, 4, 9, 14);
  }
  for (let i: i32 = 0; i < 16; i++) {
    store32(out + (<usize> i) * 4, xget(i) + load<u32>(INITIAL_OFF + (<usize> i) * 4));
  }
}

function streamXor(key: usize, nonce: usize, input: usize, len: u32, out: usize): void {
  let counter: u32 = 1;
  for (let off: u32 = 0; off < len; off += 64, counter++) {
    chachaBlock(key, counter, nonce, BLOCK_OFF);
    const n: u32 = len - off < 64 ? len - off : 64;
    for (let i: u32 = 0; i < n; i++) {
      store<u8>(
        out + <usize> (off + i),
        load<u8>(input + <usize> (off + i)) ^ load<u8>(BLOCK_OFF + <usize> i),
      );
    }
  }
}

function polyInit(key: usize): void {
  const t0: u32 = load32(key), t1: u32 = load32(key + 4);
  const t2: u32 = load32(key + 8), t3: u32 = load32(key + 12);
  setPs(R0, t0 & 0x3ffffff);
  setPs(R1, ((t0 >> 26) | (t1 << 6)) & 0x3ffff03);
  setPs(R2, ((t1 >> 20) | (t2 << 12)) & 0x3ffc0ff);
  setPs(R3, ((t2 >> 14) | (t3 << 18)) & 0x3f03fff);
  setPs(R4, (t3 >> 8) & 0x00fffff);
  setPs(S1, ps(R1) * 5);
  setPs(S2, ps(R2) * 5);
  setPs(S3, ps(R3) * 5);
  setPs(S4, ps(R4) * 5);
  setPs(H0, 0);
  setPs(H1, 0);
  setPs(H2, 0);
  setPs(H3, 0);
  setPs(H4, 0);
  setPs(PAD0, load32(key + 16));
  setPs(PAD1, load32(key + 20));
  setPs(PAD2, load32(key + 24));
  setPs(PAD3, load32(key + 28));
}

function polyBlock(m: usize, hibit: u32): void {
  const t0: u32 = load32(m), t1: u32 = load32(m + 4);
  const t2: u32 = load32(m + 8), t3: u32 = load32(m + 12);
  let h0: u32 = ps(H0) + (t0 & 0x3ffffff);
  let h1: u32 = ps(H1) + (((t0 >> 26) | (t1 << 6)) & 0x3ffffff);
  let h2: u32 = ps(H2) + (((t1 >> 20) | (t2 << 12)) & 0x3ffffff);
  let h3: u32 = ps(H3) + (((t2 >> 14) | (t3 << 18)) & 0x3ffffff);
  let h4: u32 = ps(H4) + (t3 >> 8) + hibit;
  let d0: u64 = <u64> h0 * ps(R0) + <u64> h1 * ps(S4) + <u64> h2 * ps(S3) +
    <u64> h3 * ps(S2) + <u64> h4 * ps(S1);
  let d1: u64 = <u64> h0 * ps(R1) + <u64> h1 * ps(R0) + <u64> h2 * ps(S4) +
    <u64> h3 * ps(S3) + <u64> h4 * ps(S2);
  let d2: u64 = <u64> h0 * ps(R2) + <u64> h1 * ps(R1) + <u64> h2 * ps(R0) +
    <u64> h3 * ps(S4) + <u64> h4 * ps(S3);
  let d3: u64 = <u64> h0 * ps(R3) + <u64> h1 * ps(R2) + <u64> h2 * ps(R1) +
    <u64> h3 * ps(R0) + <u64> h4 * ps(S4);
  let d4: u64 = <u64> h0 * ps(R4) + <u64> h1 * ps(R3) + <u64> h2 * ps(R2) +
    <u64> h3 * ps(R1) + <u64> h4 * ps(R0);
  let c: u32 = <u32> (d0 >> 26);
  h0 = <u32> d0 & 0x3ffffff;
  d1 += <u64> c;
  c = <u32> (d1 >> 26);
  h1 = <u32> d1 & 0x3ffffff;
  d2 += <u64> c;
  c = <u32> (d2 >> 26);
  h2 = <u32> d2 & 0x3ffffff;
  d3 += <u64> c;
  c = <u32> (d3 >> 26);
  h3 = <u32> d3 & 0x3ffffff;
  d4 += <u64> c;
  c = <u32> (d4 >> 26);
  h4 = <u32> d4 & 0x3ffffff;
  h0 += c * 5;
  c = h0 >> 26;
  h0 &= 0x3ffffff;
  h1 += c;
  setPs(H0, h0);
  setPs(H1, h1);
  setPs(H2, h2);
  setPs(H3, h3);
  setPs(H4, h4);
}

function polyUpdate(m0: usize, len0: u32): void {
  let m: usize = m0, len: u32 = len0;
  while (len >= 16) {
    polyBlock(m, 1 << 24);
    m += 16;
    len -= 16;
  }
  if (len) {
    let i: u32 = 0;
    for (; i < len; i++) store<u8>(PAD_BLOCK_OFF + <usize> i, load<u8>(m + <usize> i));
    store<u8>(PAD_BLOCK_OFF + <usize> i, 1);
    i++;
    for (; i < 16; i++) store<u8>(PAD_BLOCK_OFF + <usize> i, 0);
    polyBlock(PAD_BLOCK_OFF, 0);
  }
}

function polyPadded(m0: usize, len0: u32): void {
  let m: usize = m0, len: u32 = len0;
  while (len >= 16) {
    polyBlock(m, 1 << 24);
    m += 16;
    len -= 16;
  }
  if (len) {
    let i: u32 = 0;
    for (; i < len; i++) store<u8>(PAD_BLOCK_OFF + <usize> i, load<u8>(m + <usize> i));
    for (; i < 16; i++) store<u8>(PAD_BLOCK_OFF + <usize> i, 0);
    polyBlock(PAD_BLOCK_OFF, 1 << 24);
  }
}

function polyFinish(tag: usize): void {
  let h0: u32 = ps(H0), h1: u32 = ps(H1), h2: u32 = ps(H2);
  let h3: u32 = ps(H3), h4: u32 = ps(H4);
  let c: u32 = h1 >> 26;
  h1 &= 0x3ffffff;
  h2 += c;
  c = h2 >> 26;
  h2 &= 0x3ffffff;
  h3 += c;
  c = h3 >> 26;
  h3 &= 0x3ffffff;
  h4 += c;
  c = h4 >> 26;
  h4 &= 0x3ffffff;
  h0 += c * 5;
  c = h0 >> 26;
  h0 &= 0x3ffffff;
  h1 += c;
  let g0: u32 = h0 + 5;
  c = g0 >> 26;
  g0 &= 0x3ffffff;
  let g1: u32 = h1 + c;
  c = g1 >> 26;
  g1 &= 0x3ffffff;
  let g2: u32 = h2 + c;
  c = g2 >> 26;
  g2 &= 0x3ffffff;
  let g3: u32 = h3 + c;
  c = g3 >> 26;
  g3 &= 0x3ffffff;
  const g4: u32 = h4 + c - (1 << 26);
  const mask: u32 = (g4 >> 31) - 1;
  const nmask: u32 = ~mask;
  h0 = (h0 & nmask) | (g0 & mask);
  h1 = (h1 & nmask) | (g1 & mask);
  h2 = (h2 & nmask) | (g2 & mask);
  h3 = (h3 & nmask) | (g3 & mask);
  h4 = (h4 & nmask) | (g4 & mask);
  const f0: u64 = <u64> (h0 | (h1 << 26)) + <u64> ps(PAD0);
  const f1: u64 = <u64> ((h1 >> 6) | (h2 << 20)) + <u64> ps(PAD1) + (f0 >> 32);
  const f2: u64 = <u64> ((h2 >> 12) | (h3 << 14)) + <u64> ps(PAD2) + (f1 >> 32);
  const f3: u64 = <u64> ((h3 >> 18) | (h4 << 8)) + <u64> ps(PAD3) + (f2 >> 32);
  store32(tag, <u32> f0);
  store32(tag + 4, <u32> f1);
  store32(tag + 8, <u32> f2);
  store32(tag + 12, <u32> f3);
}

function aeadTag(
  key: usize,
  nonce: usize,
  aad: usize,
  aadLen: u32,
  ct: usize,
  len: u32,
  tag: usize,
): void {
  chachaBlock(key, 0, nonce, BLOCK_OFF);
  polyInit(BLOCK_OFF);
  polyPadded(aad, aadLen);
  polyPadded(ct, len);
  store64(LENGTHS_OFF, <u64> aadLen);
  store64(LENGTHS_OFF + 8, <u64> len);
  polyUpdate(LENGTHS_OFF, 16);
  polyFinish(tag);
}

export function seal(
  key: usize,
  nonce: usize,
  aad: usize,
  aadLen: u32,
  plain: usize,
  len: u32,
  out: usize,
  tag: usize,
): i32 {
  streamXor(key, nonce, plain, len, out);
  aeadTag(key, nonce, aad, aadLen, out, len, tag);
  return <i32> len;
}

export function open(
  key: usize,
  nonce: usize,
  aad: usize,
  aadLen: u32,
  ct: usize,
  len: u32,
  tag: usize,
  out: usize,
): i32 {
  aeadTag(key, nonce, aad, aadLen, ct, len, EXPECTED_OFF);
  let diff: u32 = 0;
  for (let i: u32 = 0; i < 16; i++) {
    diff |= <u32> load<u8>(EXPECTED_OFF + <usize> i) ^ <u32> load<u8>(tag + <usize> i);
  }
  if (diff) return -1;
  streamXor(key, nonce, ct, len, out);
  return <i32> len;
}

/** First byte the caller may use; everything below is kernel scratch. */
export function scratch_end(): u32 {
  return <u32> SCRATCH_END;
}
