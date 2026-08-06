// crypto-authenticated-stream Dart WasmGC kernel — mirrors the controlled C
// target (benchmarks/base/crypto-authenticated-stream/aead.c) exactly:
// ChaCha20 stream + 26-bit-limb Poly1305 (RFC 8439 arithmetic), seal/open
// ABI. Dart ints are 64-bit, so every u32 operation is masked with
// & 0xFFFFFFFF to reproduce C's natural 32-bit wrap — bit-identical.

import 'dart:js_interop';
import 'dart:typed_data';

const int M32 = 0xFFFFFFFF;

int load32(Uint8List p, int o) =>
    (p[o] | (p[o + 1] << 8) | (p[o + 2] << 16) | (p[o + 3] << 24)) & M32;

void store32(Uint8List p, int o, int x) {
  p[o] = x & 0xff;
  p[o + 1] = (x >> 8) & 0xff;
  p[o + 2] = (x >> 16) & 0xff;
  p[o + 3] = (x >> 24) & 0xff;
}

void store64(Uint8List p, int o, int x) {
  for (int i = 0; i < 8; i++) {
    p[o + i] = (x >> (i * 8)) & 0xff;
  }
}

int rotl(int x, int n) => (((x << n) & M32) | (x >> (32 - n))) & M32;

void qr(List<int> x, int a, int b, int c, int d) {
  x[a] = (x[a] + x[b]) & M32;
  x[d] = rotl(x[d] ^ x[a], 16);
  x[c] = (x[c] + x[d]) & M32;
  x[b] = rotl(x[b] ^ x[c], 12);
  x[a] = (x[a] + x[b]) & M32;
  x[d] = rotl(x[d] ^ x[a], 8);
  x[c] = (x[c] + x[d]) & M32;
  x[b] = rotl(x[b] ^ x[c], 7);
}

void chachaBlock(Uint8List key, int counter, Uint8List nonce, Uint8List out) {
  final initial = List<int>.filled(16, 0);
  final x = List<int>.filled(16, 0);
  initial[0] = 0x61707865;
  initial[1] = 0x3320646e;
  initial[2] = 0x79622d32;
  initial[3] = 0x6b206574;
  for (int i = 0; i < 8; i++) {
    initial[4 + i] = load32(key, i * 4);
  }
  initial[12] = counter & M32;
  initial[13] = load32(nonce, 0);
  initial[14] = load32(nonce, 4);
  initial[15] = load32(nonce, 8);
  x.setAll(0, initial);
  for (int i = 0; i < 10; i++) {
    qr(x, 0, 4, 8, 12);
    qr(x, 1, 5, 9, 13);
    qr(x, 2, 6, 10, 14);
    qr(x, 3, 7, 11, 15);
    qr(x, 0, 5, 10, 15);
    qr(x, 1, 6, 11, 12);
    qr(x, 2, 7, 8, 13);
    qr(x, 3, 4, 9, 14);
  }
  for (int i = 0; i < 16; i++) {
    store32(out, i * 4, (x[i] + initial[i]) & M32);
  }
}

void streamXor(Uint8List key, Uint8List nonce, Uint8List input, int len, Uint8List out) {
  final block = Uint8List(64);
  int counter = 1;
  int off = 0;
  while (off < len) {
    chachaBlock(key, counter, nonce, block);
    final n = len - off < 64 ? len - off : 64;
    for (int i = 0; i < n; i++) {
      out[off + i] = input[off + i] ^ block[i];
    }
    off += 64;
    counter += 1;
  }
}

class PolyState {
  int r0 = 0, r1 = 0, r2 = 0, r3 = 0, r4 = 0;
  int s1 = 0, s2 = 0, s3 = 0, s4 = 0;
  int h0 = 0, h1 = 0, h2 = 0, h3 = 0, h4 = 0;
  int pad0 = 0, pad1 = 0, pad2 = 0, pad3 = 0;
}

void polyInit(PolyState st, Uint8List key) {
  final t0=load32(key,0),t1=load32(key,4),t2=load32(key,8),t3=load32(key,12);
  st.r0=t0&0x3ffffff; st.r1=((t0>>26)|((t1<<6)&M32))&0x3ffff03;
  st.r2=((t1>>20)|((t2<<12)&M32))&0x3ffc0ff; st.r3=((t2>>14)|((t3<<18)&M32))&0x3f03fff;
  st.r4=(t3>>8)&0x00fffff; st.s1=(st.r1*5)&M32; st.s2=(st.r2*5)&M32; st.s3=(st.r3*5)&M32; st.s4=(st.r4*5)&M32;
  st.pad0=load32(key,16); st.pad1=load32(key,20); st.pad2=load32(key,24); st.pad3=load32(key,28);
}

void polyBlock(PolyState st, Uint8List m, int hibit) {
  final t0=load32(m,0),t1=load32(m,4),t2=load32(m,8),t3=load32(m,12);
  final h0=(st.h0+(t0&0x3ffffff))&M32;
  final h1=(st.h1+(((t0>>26)|((t1<<6)&M32))&0x3ffffff))&M32;
  final h2=(st.h2+(((t1>>20)|((t2<<12)&M32))&0x3ffffff))&M32;
  final h3=(st.h3+(((t2>>14)|((t3<<18)&M32))&0x3ffffff))&M32;
  final h4=(st.h4+(t3>>8)+hibit)&M32;
  final d0=h0*st.r0+h1*st.s4+h2*st.s3+h3*st.s2+h4*st.s1;
  final d1=h0*st.r1+h1*st.r0+h2*st.s4+h3*st.s3+h4*st.s2;
  final d2=h0*st.r2+h1*st.r1+h2*st.r0+h3*st.s4+h4*st.s3;
  final d3=h0*st.r3+h1*st.r2+h2*st.r1+h3*st.r0+h4*st.s4;
  final d4=h0*st.r4+h1*st.r3+h2*st.r2+h3*st.r1+h4*st.r0;
  var c=(d0>>26)&M32;
  var nh0=d0&0x3ffffff;
  var dd1=d1+c; c=(dd1>>26)&M32;
  var nh1=dd1&0x3ffffff;
  var dd2=d2+c; c=(dd2>>26)&M32;
  var nh2=dd2&0x3ffffff;
  var dd3=d3+c; c=(dd3>>26)&M32;
  var nh3=dd3&0x3ffffff;
  var dd4=d4+c; c=(dd4>>26)&M32;
  var nh4=dd4&0x3ffffff;
  nh0=(nh0+(c*5))&M32;
  c=(nh0>>26)&M32;
  nh0&=0x3ffffff;
  nh1=(nh1+c)&M32;
  st.h0=nh0;st.h1=nh1;st.h2=nh2;st.h3=nh3;st.h4=nh4;
}

void polyUpdate(PolyState st, Uint8List m, int len) {
  var mp=0; var rem=len;
  while(rem>=16){ polyBlock(st, m.sublist(mp), 1<<24); mp+=16; rem-=16; }
  if(rem>0){ final b=Uint8List(16); for(int i=0;i<rem;i++) b[i]=m[mp+i]; b[rem]=1; polyBlock(st,b,0); }
}

void polyFinish(PolyState st, Uint8List tag) {
  var h0=st.h0,h1=st.h1,h2=st.h2,h3=st.h3,h4=st.h4;
  var c=h1>>26; h1&=0x3ffffff; h2=(h2+c)&M32;
  c=h2>>26; h2&=0x3ffffff; h3=(h3+c)&M32;
  c=h3>>26; h3&=0x3ffffff; h4=(h4+c)&M32;
  c=h4>>26; h4&=0x3ffffff; h0=(h0+(c*5))&M32;
  c=h0>>26; h0&=0x3ffffff; h1=(h1+c)&M32;
  var g0=(h0+5)&M32; c=g0>>26; g0&=0x3ffffff;
  var g1=(h1+c)&M32; c=g1>>26; g1&=0x3ffffff;
  var g2=(h2+c)&M32; c=g2>>26; g2&=0x3ffffff;
  var g3=(h3+c)&M32; c=g3>>26; g3&=0x3ffffff;
  var g4=(h4+c-(1<<26))&M32;
  final mask=(g4>>31)-1; final nmask=(~mask)&M32;
  h0=(h0&nmask)|(g0&mask); h1=(h1&nmask)|(g1&mask); h2=(h2&nmask)|(g2&mask); h3=(h3&nmask)|(g3&mask); h4=(h4&nmask)|(g4&mask);
  final f0=((h0|(h1<<26))&M32)+st.pad0;
  final f1=(((h1>>6)|((h2<<20)&M32))&M32)+st.pad1+(f0>>32);
  final f2=(((h2>>12)|((h3<<14)&M32))&M32)+st.pad2+(f1>>32);
  final f3=(((h3>>18)|((h4<<8)&M32))&M32)+st.pad3+(f2>>32);
  store32(tag,0,f0&M32); store32(tag,4,f1&M32); store32(tag,8,f2&M32); store32(tag,12,f3&M32);
}

void polyPadded(PolyState st, Uint8List m, int len) {
  var mp=0; var rem=len;
  while(rem>=16){ polyBlock(st, m.sublist(mp), 1<<24); mp+=16; rem-=16; }
  if(rem>0){ final b=Uint8List(16); for(int i=0;i<rem;i++) b[i]=m[mp+i]; polyBlock(st,b,1<<24); }
}

void aeadTag(Uint8List key, Uint8List nonce, Uint8List aad, int aadLen, Uint8List ct, int len, Uint8List tag) {
  final block = Uint8List(64);
  final lengths = Uint8List(16);
  chachaBlock(key, 0, nonce, block);
  final st = PolyState();
  polyInit(st, block);
  polyPadded(st, aad, aadLen);
  polyPadded(st, ct, len);
  store64(lengths, 0, aadLen);
  store64(lengths, 8, len);
  polyUpdate(st, lengths, 16);
  polyFinish(st, tag);
}

@JSExport()
class CryptoKernels {
  @JSExport('seal')
  int seal(
    JSUint8Array keyJs, JSUint8Array nonceJs, JSUint8Array aadJs, int aadLen,
    JSUint8Array plainJs, int len, JSUint8Array outJs, JSUint8Array tagJs,
  ) {
    final key = keyJs.toDart;
    final nonce = nonceJs.toDart;
    final aad = aadJs.toDart;
    final plain = plainJs.toDart;
    final out = outJs.toDart;
    final tag = tagJs.toDart;
    streamXor(key, nonce, plain, len, out);
    aeadTag(key, nonce, aad, aadLen, out, len, tag);
    return len;
  }

  @JSExport('open')
  int open(
    JSUint8Array keyJs, JSUint8Array nonceJs, JSUint8Array aadJs, int aadLen,
    JSUint8Array ctJs, int len, JSUint8Array tagJs, JSUint8Array outJs,
  ) {
    final key = keyJs.toDart;
    final nonce = nonceJs.toDart;
    final aad = aadJs.toDart;
    final ct = ctJs.toDart;
    final tag = tagJs.toDart;
    final out = outJs.toDart;
    final expected = Uint8List(16);
    aeadTag(key, nonce, aad, aadLen, ct, len, expected);
    var diff = 0;
    for (int i = 0; i < 16; i++) {
      diff |= tag[i] ^ expected[i];
    }
    if (diff != 0) return -1;
    streamXor(key, nonce, ct, len, out);
    return len;
  }
}

void main() {
  dartKernels = createJSInteropWrapper(CryptoKernels());
}

@JS('dartKernels')
external set dartKernels(JSObject value);
