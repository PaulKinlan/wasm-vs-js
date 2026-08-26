// sha256.ts — AssemblyScript multilang SHA-256 kernel for
// crypto.file-integrity.v1.
//
// Mirrors sha256.c exactly: same FIPS-180-4 compression, same streaming
// reset/update/finish ABI over raw linear memory, same padding boundaries.
// All arithmetic is u32 with wrapping semantics, matching the C kernel's
// unsigned overflow.
//
// State lives at fixed low offsets rather than in AssemblyScript globals so
// the layout is explicit and the digest pointer returned by sha256_finish is
// stable — the adapter probes it to place the input buffer safely above the
// module's statics.

const STATE_OFF: usize = 0; // u32[8]
const BLOCK_OFF: usize = 64; // u8[64]
const DIGEST_OFF: usize = 128; // u8[32]
const K_OFF: usize = 192; // u32[64]

let blockLen: u32 = 0;
let totalLen: u64 = 0;

const K: u32[] = [
  0x428a2f98,
  0x71374491,
  0xb5c0fbcf,
  0xe9b5dba5,
  0x3956c25b,
  0x59f111f1,
  0x923f82a4,
  0xab1c5ed5,
  0xd807aa98,
  0x12835b01,
  0x243185be,
  0x550c7dc3,
  0x72be5d74,
  0x80deb1fe,
  0x9bdc06a7,
  0xc19bf174,
  0xe49b69c1,
  0xefbe4786,
  0x0fc19dc6,
  0x240ca1cc,
  0x2de92c6f,
  0x4a7484aa,
  0x5cb0a9dc,
  0x76f988da,
  0x983e5152,
  0xa831c66d,
  0xb00327c8,
  0xbf597fc7,
  0xc6e00bf3,
  0xd5a79147,
  0x06ca6351,
  0x14292967,
  0x27b70a85,
  0x2e1b2138,
  0x4d2c6dfc,
  0x53380d13,
  0x650a7354,
  0x766a0abb,
  0x81c2c92e,
  0x92722c85,
  0xa2bfe8a1,
  0xa81a664b,
  0xc24b8b70,
  0xc76c51a3,
  0xd192e819,
  0xd6990624,
  0xf40e3585,
  0x106aa070,
  0x19a4c116,
  0x1e376c08,
  0x2748774c,
  0x34b0bcb5,
  0x391c0cb3,
  0x4ed8aa4a,
  0x5b9cca4f,
  0x682e6ff3,
  0x748f82ee,
  0x78a5636f,
  0x84c87814,
  0x8cc70208,
  0x90befffa,
  0xa4506ceb,
  0xbef9a3f7,
  0xc67178f2,
];

let kReady: bool = false;

/** Copy the round constants into linear memory once. */
function ensureK(): void {
  if (kReady) return;
  for (let i = 0; i < 64; i++) {
    store<u32>(K_OFF + (<usize> i) * 4, unchecked(K[i]));
  }
  kReady = true;
}

function rotr(x: u32, n: u32): u32 {
  return (x >> n) | (x << (32 - n));
}

function loadBe(p: usize): u32 {
  return (<u32> load<u8>(p) << 24) | (<u32> load<u8>(p + 1) << 16) |
    (<u32> load<u8>(p + 2) << 8) | <u32> load<u8>(p + 3);
}

function storeBe(p: usize, x: u32): void {
  store<u8>(p, <u8> (x >> 24));
  store<u8>(p + 1, <u8> (x >> 16));
  store<u8>(p + 2, <u8> (x >> 8));
  store<u8>(p + 3, <u8> x);
}

// Scratch message schedule, above the round constants.
const W_OFF: usize = 448; // u32[64]

function compress(p: usize): void {
  for (let i: u32 = 0; i < 16; i++) {
    store<u32>(W_OFF + (<usize> i) * 4, loadBe(p + (<usize> i) * 4));
  }
  for (let i: u32 = 16; i < 64; i++) {
    const w15: u32 = load<u32>(W_OFF + (<usize> (i - 15)) * 4);
    const w2: u32 = load<u32>(W_OFF + (<usize> (i - 2)) * 4);
    const s0: u32 = rotr(w15, 7) ^ rotr(w15, 18) ^ (w15 >> 3);
    const s1: u32 = rotr(w2, 17) ^ rotr(w2, 19) ^ (w2 >> 10);
    const v: u32 = load<u32>(W_OFF + (<usize> (i - 16)) * 4) + s0 +
      load<u32>(W_OFF + (<usize> (i - 7)) * 4) + s1;
    store<u32>(W_OFF + (<usize> i) * 4, v);
  }
  let a: u32 = load<u32>(STATE_OFF);
  let b: u32 = load<u32>(STATE_OFF + 4);
  let c: u32 = load<u32>(STATE_OFF + 8);
  let d: u32 = load<u32>(STATE_OFF + 12);
  let e: u32 = load<u32>(STATE_OFF + 16);
  let f: u32 = load<u32>(STATE_OFF + 20);
  let g: u32 = load<u32>(STATE_OFF + 24);
  let h: u32 = load<u32>(STATE_OFF + 28);
  for (let i: u32 = 0; i < 64; i++) {
    const s1: u32 = rotr(e, 6) ^ rotr(e, 11) ^ rotr(e, 25);
    const ch: u32 = (e & f) ^ (~e & g);
    const t1: u32 = h + s1 + ch + load<u32>(K_OFF + (<usize> i) * 4) +
      load<u32>(W_OFF + (<usize> i) * 4);
    const s0: u32 = rotr(a, 2) ^ rotr(a, 13) ^ rotr(a, 22);
    const maj: u32 = (a & b) ^ (a & c) ^ (b & c);
    const t2: u32 = s0 + maj;
    h = g;
    g = f;
    f = e;
    e = d + t1;
    d = c;
    c = b;
    b = a;
    a = t1 + t2;
  }
  store<u32>(STATE_OFF, load<u32>(STATE_OFF) + a);
  store<u32>(STATE_OFF + 4, load<u32>(STATE_OFF + 4) + b);
  store<u32>(STATE_OFF + 8, load<u32>(STATE_OFF + 8) + c);
  store<u32>(STATE_OFF + 12, load<u32>(STATE_OFF + 12) + d);
  store<u32>(STATE_OFF + 16, load<u32>(STATE_OFF + 16) + e);
  store<u32>(STATE_OFF + 20, load<u32>(STATE_OFF + 20) + f);
  store<u32>(STATE_OFF + 24, load<u32>(STATE_OFF + 24) + g);
  store<u32>(STATE_OFF + 28, load<u32>(STATE_OFF + 28) + h);
}

export function sha256_reset(): void {
  ensureK();
  store<u32>(STATE_OFF, 0x6a09e667);
  store<u32>(STATE_OFF + 4, 0xbb67ae85);
  store<u32>(STATE_OFF + 8, 0x3c6ef372);
  store<u32>(STATE_OFF + 12, 0xa54ff53a);
  store<u32>(STATE_OFF + 16, 0x510e527f);
  store<u32>(STATE_OFF + 20, 0x9b05688c);
  store<u32>(STATE_OFF + 24, 0x1f83d9ab);
  store<u32>(STATE_OFF + 28, 0x5be0cd19);
  blockLen = 0;
  totalLen = 0;
}

export function sha256_update(data: usize, len: u32): void {
  totalLen += <u64> len;
  let p: usize = data;
  let remaining: u32 = len;
  while (remaining) {
    let take: u32 = 64 - blockLen;
    if (take > remaining) take = remaining;
    for (let i: u32 = 0; i < take; i++) {
      store<u8>(BLOCK_OFF + <usize> (blockLen + i), load<u8>(p + <usize> i));
    }
    blockLen += take;
    p += <usize> take;
    remaining -= take;
    if (blockLen == 64) {
      compress(BLOCK_OFF);
      blockLen = 0;
    }
  }
}

export function sha256_finish(): u32 {
  const bitLen: u64 = totalLen * 8;
  store<u8>(BLOCK_OFF + <usize> blockLen, 0x80);
  blockLen++;
  if (blockLen > 56) {
    while (blockLen < 64) {
      store<u8>(BLOCK_OFF + <usize> blockLen, 0);
      blockLen++;
    }
    compress(BLOCK_OFF);
    blockLen = 0;
  }
  while (blockLen < 56) {
    store<u8>(BLOCK_OFF + <usize> blockLen, 0);
    blockLen++;
  }
  for (let i: u32 = 0; i < 8; i++) {
    store<u8>(BLOCK_OFF + <usize> (63 - i), <u8> (bitLen >> (i * 8)));
  }
  compress(BLOCK_OFF);
  for (let i: u32 = 0; i < 8; i++) {
    storeBe(DIGEST_OFF + (<usize> i) * 4, load<u32>(STATE_OFF + (<usize> i) * 4));
  }
  return <u32> DIGEST_OFF;
}
