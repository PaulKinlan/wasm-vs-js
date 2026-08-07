#![no_std]

#[panic_handler]
fn panic(_info: &core::panic::PanicInfo) -> ! {
    core::arch::wasm32::unreachable()
}

// crypto-authenticated-stream multilang Rust kernel — mirrors the controlled
// C target (benchmarks/base/crypto-authenticated-stream/aead.c) exactly:
// ChaCha20 stream + 26-bit-limb Poly1305 (RFC 8439 arithmetic), seal/open
// ABI. Rust u32/u64 wrap like C — bit-identical.

type U8 = u8;
type U32 = u32;
type U64 = u64;

fn load32(p: *const U8) -> U32 {
    // SAFETY: caller provides 4 readable bytes.
    unsafe {
        (*p as U32) | ((*p.add(1) as U32) << 8) | ((*p.add(2) as U32) << 16) | ((*p.add(3) as U32) << 24)
    }
}
fn store32(p: *mut U8, x: U32) {
    // SAFETY: caller provides 4 writable bytes.
    unsafe {
        *p = x as U8;
        *p.add(1) = (x >> 8) as U8;
        *p.add(2) = (x >> 16) as U8;
        *p.add(3) = (x >> 24) as U8;
    }
}
fn store64(p: *mut U8, x: U64) {
    // SAFETY: caller provides 8 writable bytes.
    unsafe {
        for i in 0..8 {
            *p.add(i) = (x >> (i * 8)) as U8;
        }
    }
}
fn rotl(x: U32, n: U32) -> U32 {
    (x << n) | (x >> (32 - n))
}
#[inline(always)]
fn qr(x: &mut [U32; 16], a: usize, b: usize, c: usize, d: usize) {
    x[a] = x[a].wrapping_add(x[b]);
    x[d] = rotl(x[d] ^ x[a], 16);
    x[c] = x[c].wrapping_add(x[d]);
    x[b] = rotl(x[b] ^ x[c], 12);
    x[a] = x[a].wrapping_add(x[b]);
    x[d] = rotl(x[d] ^ x[a], 8);
    x[c] = x[c].wrapping_add(x[d]);
    x[b] = rotl(x[b] ^ x[c], 7);
}

fn chacha_block(key: *const U8, counter: U32, nonce: *const U8, out: *mut U8) {
    let mut x = [0u32; 16];
    let mut initial = [0u32; 16];
    initial[0] = 0x6170_7865u32;
    initial[1] = 0x3320_646e;
    initial[2] = 0x7962_2d32;
    initial[3] = 0x6b20_6574;
    // SAFETY: caller provides a 32-byte key + a 12-byte nonce.
    unsafe {
        for i in 0..8 {
            initial[4 + i] = load32(key.add(i * 4));
        }
    }
    initial[12] = counter;
    // SAFETY: caller provides a 12-byte nonce.
    unsafe {
        initial[13] = load32(nonce);
        initial[14] = load32(nonce.add(4));
        initial[15] = load32(nonce.add(8));
    }
    x.copy_from_slice(&initial);
    for _ in 0..10 {
        qr(&mut x, 0, 4, 8, 12);
        qr(&mut x, 1, 5, 9, 13);
        qr(&mut x, 2, 6, 10, 14);
        qr(&mut x, 3, 7, 11, 15);
        qr(&mut x, 0, 5, 10, 15);
        qr(&mut x, 1, 6, 11, 12);
        qr(&mut x, 2, 7, 8, 13);
        qr(&mut x, 3, 4, 9, 14);
    }
    // SAFETY: caller provides a 64-byte out buffer.
    unsafe {
        for i in 0..16 {
            store32(out.add(i * 4), x[i].wrapping_add(initial[i]));
        }
    }
}

fn stream_xor(key: *const U8, nonce: *const U8, input: *const U8, len: U32, out: *mut U8) {
    let mut block = [0u8; 64];
    let mut counter: U32 = 1;
    let mut off: U32 = 0;
    while off < len {
        chacha_block(key, counter, nonce, block.as_mut_ptr());
        let n = if len - off < 64 { len - off } else { 64 };
        // SAFETY: caller provides len-byte in/out buffers.
        unsafe {
            for i in 0..n {
                *out.add((off + i) as usize) = *input.add((off + i) as usize) ^ block[i as usize];
            }
        }
        off += 64;
        counter += 1;
    }
}

#[derive(Clone, Copy, Default)]
struct PolyState {
    r0: U32, r1: U32, r2: U32, r3: U32, r4: U32,
    s1: U32, s2: U32, s3: U32, s4: U32,
    h0: U32, h1: U32, h2: U32, h3: U32, h4: U32,
    pad0: U32, pad1: U32, pad2: U32, pad3: U32,
}

fn poly_init(st: &mut PolyState, key: *const U8) {
    // SAFETY: caller provides a 32-byte key.
    unsafe {
        let t0 = load32(key);
        let t1 = load32(key.add(4));
        let t2 = load32(key.add(8));
        let t3 = load32(key.add(12));
        st.r0 = t0 & 0x3ff_ffff;
        st.r1 = ((t0 >> 26) | (t1 << 6)) & 0x3ff_ff03;
        st.r2 = ((t1 >> 20) | (t2 << 12)) & 0x3ffc_0ff;
        st.r3 = ((t2 >> 14) | (t3 << 18)) & 0x3f03_fff;
        st.r4 = (t3 >> 8) & 0x0f_ffff;
        st.s1 = st.r1.wrapping_mul(5);
        st.s2 = st.r2.wrapping_mul(5);
        st.s3 = st.r3.wrapping_mul(5);
        st.s4 = st.r4.wrapping_mul(5);
        st.h0 = 0; st.h1 = 0; st.h2 = 0; st.h3 = 0; st.h4 = 0;
        st.pad0 = load32(key.add(16));
        st.pad1 = load32(key.add(20));
        st.pad2 = load32(key.add(24));
        st.pad3 = load32(key.add(28));
    }
}

fn poly_block(st: &mut PolyState, m: *const U8, hibit: U32) {
    // SAFETY: caller provides a 16-byte block.
    unsafe {
        let t0 = load32(m);
        let t1 = load32(m.add(4));
        let t2 = load32(m.add(8));
        let t3 = load32(m.add(12));
        let mut h0 = st.h0.wrapping_add(t0 & 0x3ff_ffff);
        let mut h1 = st.h1.wrapping_add(((t0 >> 26) | (t1 << 6)) & 0x3ff_ffff);
        let mut h2 = st.h2.wrapping_add(((t1 >> 20) | (t2 << 12)) & 0x3ff_ffff);
        let mut h3 = st.h3.wrapping_add(((t2 >> 14) | (t3 << 18)) & 0x3ff_ffff);
        let mut h4 = st.h4.wrapping_add((t3 >> 8) + hibit);
        let d0 = (h0 as U64).wrapping_mul(st.r0 as U64)
            .wrapping_add((h1 as U64).wrapping_mul(st.s4 as U64))
            .wrapping_add((h2 as U64).wrapping_mul(st.s3 as U64))
            .wrapping_add((h3 as U64).wrapping_mul(st.s2 as U64))
            .wrapping_add((h4 as U64).wrapping_mul(st.s1 as U64));
        let d1 = (h0 as U64).wrapping_mul(st.r1 as U64)
            .wrapping_add((h1 as U64).wrapping_mul(st.r0 as U64))
            .wrapping_add((h2 as U64).wrapping_mul(st.s4 as U64))
            .wrapping_add((h3 as U64).wrapping_mul(st.s3 as U64))
            .wrapping_add((h4 as U64).wrapping_mul(st.s2 as U64));
        let d2 = (h0 as U64).wrapping_mul(st.r2 as U64)
            .wrapping_add((h1 as U64).wrapping_mul(st.r1 as U64))
            .wrapping_add((h2 as U64).wrapping_mul(st.r0 as U64))
            .wrapping_add((h3 as U64).wrapping_mul(st.s4 as U64))
            .wrapping_add((h4 as U64).wrapping_mul(st.s3 as U64));
        let d3 = (h0 as U64).wrapping_mul(st.r3 as U64)
            .wrapping_add((h1 as U64).wrapping_mul(st.r2 as U64))
            .wrapping_add((h2 as U64).wrapping_mul(st.r1 as U64))
            .wrapping_add((h3 as U64).wrapping_mul(st.r0 as U64))
            .wrapping_add((h4 as U64).wrapping_mul(st.s4 as U64));
        let d4 = (h0 as U64).wrapping_mul(st.r4 as U64)
            .wrapping_add((h1 as U64).wrapping_mul(st.r3 as U64))
            .wrapping_add((h2 as U64).wrapping_mul(st.r2 as U64))
            .wrapping_add((h3 as U64).wrapping_mul(st.r1 as U64))
            .wrapping_add((h4 as U64).wrapping_mul(st.r0 as U64));
        let mut c = (d0 >> 26) as U32;
        h0 = (d0 as U32) & 0x3ff_ffff;
        let dd1 = d1.wrapping_add(c as U64);
        c = (dd1 >> 26) as U32;
        h1 = (dd1 as U32) & 0x3ff_ffff;
        let dd2 = d2.wrapping_add(c as U64);
        c = (dd2 >> 26) as U32;
        h2 = (dd2 as U32) & 0x3ff_ffff;
        let dd3 = d3.wrapping_add(c as U64);
        c = (dd3 >> 26) as U32;
        h3 = (dd3 as U32) & 0x3ff_ffff;
        let dd4 = d4.wrapping_add(c as U64);
        c = (dd4 >> 26) as U32;
        h4 = (dd4 as U32) & 0x3ff_ffff;
        h0 = h0.wrapping_add(c.wrapping_mul(5));
        c = h0 >> 26;
        h0 &= 0x3ff_ffff;
        h1 = h1.wrapping_add(c);
        st.h0 = h0; st.h1 = h1; st.h2 = h2; st.h3 = h3; st.h4 = h4;
    }
}

fn poly_update(st: &mut PolyState, m: *const U8, len: U32) {
    let mut m = m;
    let mut len = len;
    while len >= 16 {
        poly_block(st, m, 1 << 24);
        // SAFETY: caller provides len readable bytes.
        unsafe {
            m = m.add(16);
        }
        len -= 16;
    }
    if len > 0 {
        let mut block = [0u8; 16];
        // SAFETY: caller provides len readable bytes.
        unsafe {
            for i in 0..len as usize {
                block[i] = *m.add(i);
            }
        }
        block[len as usize] = 1;
        poly_block(st, block.as_mut_ptr(), 0);
    }
}

fn poly_finish(st: &mut PolyState, tag: *mut U8) {
    let mut h0 = st.h0; let mut h1 = st.h1; let mut h2 = st.h2;
    let mut h3 = st.h3; let mut h4 = st.h4;
    let mut c = h1 >> 26; h1 &= 0x3ff_ffff; h2 = h2.wrapping_add(c);
    c = h2 >> 26; h2 &= 0x3ff_ffff; h3 = h3.wrapping_add(c);
    c = h3 >> 26; h3 &= 0x3ff_ffff; h4 = h4.wrapping_add(c);
    c = h4 >> 26; h4 &= 0x3ff_ffff; h0 = h0.wrapping_add(c.wrapping_mul(5));
    c = h0 >> 26; h0 &= 0x3ff_ffff; h1 = h1.wrapping_add(c);
    let mut g0 = h0.wrapping_add(5); c = g0 >> 26; g0 &= 0x3ff_ffff;
    let mut g1 = h1.wrapping_add(c); c = g1 >> 26; g1 &= 0x3ff_ffff;
    let mut g2 = h2.wrapping_add(c); c = g2 >> 26; g2 &= 0x3ff_ffff;
    let mut g3 = h3.wrapping_add(c); c = g3 >> 26; g3 &= 0x3ff_ffff;
    let g4 = h4.wrapping_add(c).wrapping_sub(1 << 26);
    let mask = (g4 >> 31).wrapping_sub(1);
    let nmask = !mask;
    h0 = (h0 & nmask) | (g0 & mask);
    h1 = (h1 & nmask) | (g1 & mask);
    h2 = (h2 & nmask) | (g2 & mask);
    h3 = (h3 & nmask) | (g3 & mask);
    h4 = (h4 & nmask) | (g4 & mask);
    let f0 = ((h0 | (h1 << 26)) as U64).wrapping_add(st.pad0 as U64);
    let f1 = (((h1 >> 6) | (h2 << 20)) as U64).wrapping_add(st.pad1 as U64).wrapping_add(f0 >> 32);
    let f2 = (((h2 >> 12) | (h3 << 14)) as U64).wrapping_add(st.pad2 as U64).wrapping_add(f1 >> 32);
    let f3 = (((h3 >> 18) | (h4 << 8)) as U64).wrapping_add(st.pad3 as U64).wrapping_add(f2 >> 32);
    // SAFETY: caller provides a 16-byte tag buffer.
    unsafe {
        store32(tag, f0 as U32);
        store32(tag.add(4), f1 as U32);
        store32(tag.add(8), f2 as U32);
        store32(tag.add(12), f3 as U32);
    }
}

fn poly_padded(st: &mut PolyState, m: *const U8, len: U32) {
    let mut m = m;
    let mut len = len;
    while len >= 16 {
        poly_block(st, m, 1 << 24);
        // SAFETY: caller provides len readable bytes.
        unsafe {
            m = m.add(16);
        }
        len -= 16;
    }
    if len > 0 {
        let mut block = [0u8; 16];
        // SAFETY: caller provides len readable bytes.
        unsafe {
            for i in 0..len as usize {
                block[i] = *m.add(i);
            }
        }
        poly_block(st, block.as_mut_ptr(), 1 << 24);
    }
}

fn aead_tag(key: *const U8, nonce: *const U8, aad: *const U8, aad_len: U32, ct: *const U8, len: U32, tag: *mut U8) {
    let mut block = [0u8; 64];
    let mut lengths = [0u8; 16];
    chacha_block(key, 0, nonce, block.as_mut_ptr());
    let mut st = PolyState::default();
    poly_init(&mut st, block.as_mut_ptr());
    poly_padded(&mut st, aad, aad_len);
    poly_padded(&mut st, ct, len);
    // SAFETY: lengths is a local buffer.
    unsafe {
        store64(lengths.as_mut_ptr(), aad_len as U64);
        store64(lengths.as_mut_ptr().add(8), len as U64);
    }
    poly_update(&mut st, lengths.as_mut_ptr(), 16);
    poly_finish(&mut st, tag);
}

#[no_mangle]
pub extern "C" fn seal(
    key: *const U8,
    nonce: *const U8,
    aad: *const U8,
    aad_len: U32,
    plain: *const U8,
    len: U32,
    out: *mut U8,
    tag: *mut U8,
) -> i32 {
    stream_xor(key, nonce, plain, len, out);
    aead_tag(key, nonce, aad, aad_len, out, len, tag);
    len as i32
}

#[no_mangle]
pub extern "C" fn open(
    key: *const U8,
    nonce: *const U8,
    aad: *const U8,
    aad_len: U32,
    ct: *const U8,
    len: U32,
    tag: *const U8,
    out: *mut U8,
) -> i32 {
    let mut expected = [0u8; 16];
    aead_tag(key, nonce, aad, aad_len, ct, len, expected.as_mut_ptr());
    let mut diff: U32 = 0;
    // SAFETY: caller provides a 16-byte tag.
    unsafe {
        for i in 0..16 {
            diff |= (*tag.add(i) as U32) ^ (expected[i] as U32);
        }
    }
    if diff != 0 {
        return -1;
    }
    stream_xor(key, nonce, ct, len, out);
    len as i32
}
