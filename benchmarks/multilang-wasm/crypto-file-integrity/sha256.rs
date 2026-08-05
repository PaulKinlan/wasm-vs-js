#![no_std]

// crypto-file-integrity multilang SHA-256 kernel (no_std cdylib).
// Mirrors benchmarks/base/crypto-file-integrity/sha256.c semantics exactly:
// FIPS-180-4 with the same 64-round compression, block buffering, u64 bit
// length, and byte-order — bit-identical digests. All arithmetic uses
// wrapping u32 ops (release build has overflow checks off; wrapping_add keeps
// it exact regardless of profile).

#[panic_handler]
fn panic(_info: &core::panic::PanicInfo) -> ! {
    core::arch::wasm32::unreachable()
}

const K: [u32; 64] = [
    0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5,
    0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174,
    0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
    0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967,
    0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13, 0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85,
    0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
    0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3,
    0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208, 0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2,
];

static mut STATE: [u32; 8] = [0; 8];
static mut BLOCK: [u8; 64] = [0; 64];
static mut BLOCK_LEN: u32 = 0;
static mut TOTAL_LEN: u64 = 0;
static mut DIGEST: [u8; 32] = [0; 32];

fn rotr(x: u32, n: u32) -> u32 {
    (x >> n) | (x << (32u32.wrapping_sub(n)))
}

unsafe fn load_be(p: *const u8) -> u32 {
    let b = core::slice::from_raw_parts(p, 4);
    ((b[0] as u32) << 24) | ((b[1] as u32) << 16) | ((b[2] as u32) << 8) | (b[3] as u32)
}

unsafe fn store_be(p: *mut u8, x: u32) {
    let b = core::slice::from_raw_parts_mut(p, 4);
    b[0] = (x >> 24) as u8;
    b[1] = (x >> 16) as u8;
    b[2] = (x >> 8) as u8;
    b[3] = x as u8;
}

unsafe fn compress(p: *const u8) {
    let mut w = [0u32; 64];
    for i in 0..16 {
        w[i] = load_be(p.add(i * 4));
    }
    for i in 16..64 {
        let s0 = rotr(w[i - 15], 7) ^ rotr(w[i - 15], 18) ^ (w[i - 15] >> 3);
        let s1 = rotr(w[i - 2], 17) ^ rotr(w[i - 2], 19) ^ (w[i - 2] >> 10);
        w[i] = w[i - 16].wrapping_add(s0).wrapping_add(w[i - 7]).wrapping_add(s1);
    }
    let mut a = STATE[0];
    let mut b = STATE[1];
    let mut c = STATE[2];
    let mut d = STATE[3];
    let mut e = STATE[4];
    let mut f = STATE[5];
    let mut g = STATE[6];
    let mut h = STATE[7];
    for i in 0..64 {
        let s1 = rotr(e, 6) ^ rotr(e, 11) ^ rotr(e, 25);
        let ch = (e & f) ^ ((!e) & g);
        let t1 = h.wrapping_add(s1).wrapping_add(ch).wrapping_add(K[i]).wrapping_add(w[i]);
        let s0 = rotr(a, 2) ^ rotr(a, 13) ^ rotr(a, 22);
        let maj = (a & b) ^ (a & c) ^ (b & c);
        let t2 = s0.wrapping_add(maj);
        h = g;
        g = f;
        f = e;
        e = d.wrapping_add(t1);
        d = c;
        c = b;
        b = a;
        a = t1.wrapping_add(t2);
    }
    STATE[0] = STATE[0].wrapping_add(a);
    STATE[1] = STATE[1].wrapping_add(b);
    STATE[2] = STATE[2].wrapping_add(c);
    STATE[3] = STATE[3].wrapping_add(d);
    STATE[4] = STATE[4].wrapping_add(e);
    STATE[5] = STATE[5].wrapping_add(f);
    STATE[6] = STATE[6].wrapping_add(g);
    STATE[7] = STATE[7].wrapping_add(h);
}

#[no_mangle]
pub extern "C" fn sha256_reset() {
    unsafe {
        STATE = [
            0x6a09e667, 0xbb67ae85, 0x3c6ef372, 0xa54ff53a, 0x510e527f, 0x9b05688c, 0x1f83d9ab,
            0x5be0cd19,
        ];
        BLOCK_LEN = 0;
        TOTAL_LEN = 0;
    }
}

#[no_mangle]
pub unsafe extern "C" fn sha256_update(data: *const u8, len: u32) {
    let mut data = data;
    let mut len = len;
    TOTAL_LEN = TOTAL_LEN.wrapping_add(len as u64);
    while len > 0 {
        let mut take = 64u32 - BLOCK_LEN;
        if take > len {
            take = len;
        }
        for i in 0..take {
            BLOCK[(BLOCK_LEN + i) as usize] = *data.add(i as usize);
        }
        BLOCK_LEN += take;
        data = data.add(take as usize);
        len -= take;
        if BLOCK_LEN == 64 {
            compress(BLOCK.as_ptr());
            BLOCK_LEN = 0;
        }
    }
}

#[no_mangle]
pub unsafe extern "C" fn sha256_finish() -> u32 {
    let bit_len = TOTAL_LEN.wrapping_mul(8);
    BLOCK[BLOCK_LEN as usize] = 0x80;
    BLOCK_LEN += 1;
    if BLOCK_LEN > 56 {
        while BLOCK_LEN < 64 {
            BLOCK[BLOCK_LEN as usize] = 0;
            BLOCK_LEN += 1;
        }
        compress(BLOCK.as_ptr());
        BLOCK_LEN = 0;
    }
    while BLOCK_LEN < 56 {
        BLOCK[BLOCK_LEN as usize] = 0;
        BLOCK_LEN += 1;
    }
    for i in 0..8u32 {
        BLOCK[(63 - i) as usize] = ((bit_len >> (i * 8)) & 0xff) as u8;
    }
    compress(BLOCK.as_ptr());
    for i in 0..8 {
        store_be(DIGEST.as_mut_ptr().add(i * 4), STATE[i]);
    }
    DIGEST.as_ptr() as u32
}
