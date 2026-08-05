// crypto-file-integrity Dart WasmGC kernel — mirrors
// benchmarks/base/crypto-file-integrity/sha256.js semantics exactly: FIPS-180-4
// with the same 64-round compression, block buffering, u64 bit length, and
// byte order — bit-identical digests. All u32 arithmetic is masked to 32 bits
// after every op (Dart ints are 64-bit; `& 0xFFFFFFFF` mirrors JS `>>> 0`).
//
// The JS oracle runs on Uint8Array views; the WasmGC kernel takes zero-copy
// JSUint8Array views (dart:js_interop) and writes the 32 digest bytes back
// into a caller-provided JSUint8Array — no linear memory is involved.

import 'dart:js_interop';

const List<int> kSha256 = [
  0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5,
  0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174,
  0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
  0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967,
  0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13, 0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85,
  0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
  0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3,
  0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208, 0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2,
];

int _rotr(int x, int n) => ((x >>> n) | (x << (32 - n))) & 0xFFFFFFFF;

@JSExport()
class Sha256Kernels {
  final List<int> _state = List<int>.filled(8, 0);
  final List<int> _block = List<int>.filled(64, 0);
  int _blockLen = 0;
  int _totalLen = 0;

  @JSExport('sha256_reset')
  void reset() {
    _state.setAll(0, [
      0x6a09e667, 0xbb67ae85, 0x3c6ef372, 0xa54ff53a, 0x510e527f, 0x9b05688c, 0x1f83d9ab,
      0x5be0cd19,
    ]);
    _blockLen = 0;
    _totalLen = 0;
  }

  @JSExport('sha256_update')
  void update(JSUint8Array dataJs, int len) {
    final data = dataJs.toDart;
    _totalLen += len;
    var offset = 0;
    while (offset < len) {
      var take = 64 - _blockLen;
      if (take > len - offset) take = len - offset;
      for (var i = 0; i < take; i++) {
        _block[_blockLen + i] = data[offset + i];
      }
      _blockLen += take;
      offset += take;
      if (_blockLen == 64) {
        _compress();
        _blockLen = 0;
      }
    }
  }

  @JSExport('sha256_finish')
  void finish(JSUint8Array outJs) {
    final bitLen = _totalLen * 8;
    final out = outJs.toDart;
    _block[_blockLen++] = 0x80;
    if (_blockLen > 56) {
      while (_blockLen < 64) {
        _block[_blockLen++] = 0;
      }
      _compress();
      _blockLen = 0;
    }
    while (_blockLen < 56) {
      _block[_blockLen++] = 0;
    }
    for (var i = 0; i < 8; i++) {
      _block[63 - i] = (bitLen >> (i * 8)) & 0xFF;
    }
    _compress();
    for (var i = 0; i < 8; i++) {
      final x = _state[i];
      out[i * 4] = (x >> 24) & 0xFF;
      out[i * 4 + 1] = (x >> 16) & 0xFF;
      out[i * 4 + 2] = (x >> 8) & 0xFF;
      out[i * 4 + 3] = x & 0xFF;
    }
  }

  void _compress() {
    final w = List<int>.filled(64, 0);
    for (var i = 0; i < 16; i++) {
      final j = i * 4;
      w[i] =
          ((_block[j] << 24) | (_block[j + 1] << 16) | (_block[j + 2] << 8) | _block[j + 3]) &
              0xFFFFFFFF;
    }
    for (var i = 16; i < 64; i++) {
      final x = w[i - 15];
      final y = w[i - 2];
      final s0 = _rotr(x, 7) ^ _rotr(x, 18) ^ (x >>> 3);
      final s1 = _rotr(y, 17) ^ _rotr(y, 19) ^ (y >>> 10);
      w[i] = (w[i - 16] + s0 + w[i - 7] + s1) & 0xFFFFFFFF;
    }
    var a = _state[0], b = _state[1], c = _state[2], d = _state[3];
    var e = _state[4], f = _state[5], g = _state[6], h = _state[7];
    for (var i = 0; i < 64; i++) {
      final s1 = _rotr(e, 6) ^ _rotr(e, 11) ^ _rotr(e, 25);
      final ch = (e & f) ^ ((~e) & g);
      final t1 = (h + s1 + ch + kSha256[i] + w[i]) & 0xFFFFFFFF;
      final s0 = _rotr(a, 2) ^ _rotr(a, 13) ^ _rotr(a, 22);
      final maj = (a & b) ^ (a & c) ^ (b & c);
      final t2 = (s0 + maj) & 0xFFFFFFFF;
      h = g;
      g = f;
      f = e;
      e = (d + t1) & 0xFFFFFFFF;
      d = c;
      c = b;
      b = a;
      a = (t1 + t2) & 0xFFFFFFFF;
    }
    _state[0] = (_state[0] + a) & 0xFFFFFFFF;
    _state[1] = (_state[1] + b) & 0xFFFFFFFF;
    _state[2] = (_state[2] + c) & 0xFFFFFFFF;
    _state[3] = (_state[3] + d) & 0xFFFFFFFF;
    _state[4] = (_state[4] + e) & 0xFFFFFFFF;
    _state[5] = (_state[5] + f) & 0xFFFFFFFF;
    _state[6] = (_state[6] + g) & 0xFFFFFFFF;
    _state[7] = (_state[7] + h) & 0xFFFFFFFF;
  }
}

void main() {
  dartKernels = createJSInteropWrapper(Sha256Kernels());
}

@JS('dartKernels')
external set dartKernels(JSObject value);
