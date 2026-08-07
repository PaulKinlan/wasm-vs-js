import 'dart:js_interop';
import 'dart:typed_data';

// Dart/WasmGC port of the frozen document-pdf-viewer C kernel
// (benchmarks/base/document-pdf-viewer/pdf-engine.c). Same algorithm, same
// ABI semantics (parse/counters/text/hits/render), outputs bit-identical to
// the JS oracle. The runner adapter drives it through Dart-level calls.
// @dart=2.12
// ignore_for_file: prefer_final_locals, unnecessary_statements


const int inputCapacity = 1048576;
const int pageCapacity = 128;
const int textCapacity = 96;
const int objectCapacity = 512;
const int width = 1224;
const int height = 1584;
const int rgbaBytes = width * height * 4;

class PdfEngine {
  final Uint8List input = Uint8List(inputCapacity);
  final Uint32List objectOffsets = Uint32List(objectCapacity);
  final Uint32List objectEnds = Uint32List(objectCapacity);
  final List<Uint8List> pageText = List.generate(pageCapacity, (_) => Uint8List(textCapacity));
  final List<Uint8List> pageCodes = List.generate(pageCapacity, (_) => Uint8List(textCapacity));
  final Uint32List pageLengths = Uint32List(pageCapacity);
  final Uint32List pageX = Uint32List(pageCapacity);
  final Uint32List pageY = Uint32List(pageCapacity);
  final Uint32List pageFontSize = Uint32List(pageCapacity);
  final Uint8List unicodeMap = Uint8List(256);
  final Uint8List unicodeValid = Uint8List(256);
  final List<Uint8List> glyphRows = List.generate(256, (_) => Uint8List(7));
  final Uint32List glyphWidths = Uint32List(256);
  final Uint32List hitPages = Uint32List(pageCapacity);
  final Uint32List counters = Uint32List(9);
  final Uint8List rgba = Uint8List(rgbaBytes);

  int inputLength = 0;
  int objectCount = 0;
  int hits = 0;
  int lastError = 0;

  int _inp(int at) => input[at];

  bool _ws(int c) => c == 0 || c == 9 || c == 10 || c == 12 || c == 13 || c == 32;
  bool _digit(int c) => c >= 0x30 && c <= 0x39;
  bool _delimiter(int c) =>
      _ws(c) || c == 0x2f || c == 0x3c || c == 0x3e || c == 0x5b || c == 0x5d ||
      c == 0x28 || c == 0x29 || c == 0x25;
  void _skipWs(IntPtr at, int end) {
    while (at.v < end) {
      if (_ws(_inp(at.v))) {
        at.v++;
        continue;
      }
      if (_inp(at.v) == 0x25) {
        while (at.v < end && _inp(at.v) != 0x0a && _inp(at.v) != 0x0d) at.v++;
        continue;
      }
      break;
    }
  }

  bool _literalAt(int at, int end, Uint8List text) {
    if (at + text.length > end) return false;
    for (int i = 0; i < text.length; i++) {
      if (_inp(at + i) != text[i]) return false;
    }
    return true;
  }

  int _findRange(int at, int end, Uint8List text) {
    final len = text.length;
    while (at + len <= end) {
      if (_literalAt(at, end, text)) return at;
      at++;
    }
    return 0xffffffff;
  }

  bool _readUint(IntPtr at, int end, IntPtr value) {
    _skipWs(at, end);
    if (at.v >= end || !_digit(_inp(at.v))) return false;
    int result = 0;
    while (at.v < end && _digit(_inp(at.v))) {
      final next = result * 10 + (_inp(at.v) - 0x30);
      if (next < result) return false;
      result = next;
      at.v++;
    }
    value.v = result;
    return true;
  }

  bool _readInt(IntPtr at, int end, IntPtr value) {
    _skipWs(at, end);
    bool negative = false;
    if (at.v < end && _inp(at.v) == 0x2d) {
      negative = true;
      at.v++;
    }
    final n = IntPtr(0);
    if (!_readUint(at, end, n) || n.v > 0x7fffffff) return false;
    value.v = negative ? -n.v : n.v;
    return true;
  }

  bool _matchToken(IntPtr at, int end, Uint8List token) {
    _skipWs(at, end);
    if (!_literalAt(at.v, end, token)) return false;
    if (at.v + token.length < end && !_delimiter(_inp(at.v + token.length))) return false;
    at.v += token.length;
    return true;
  }

  bool _keyAt(int at, int end, Uint8List key) =>
      _literalAt(at, end, key) &&
      (at == 0 || _delimiter(_inp(at - 1))) &&
      (at + key.length == end || _delimiter(_inp(at + key.length)));

  int _findKey(int start, int end, Uint8List key) {
    var at = start;
    while (at + key.length <= end) {
      if (_keyAt(at, end, key)) return at;
      at++;
    }
    return 0xffffffff;
  }

  int _findDirectKey(int start, int end, Uint8List key) {
    final cur = IntPtr(start);
    _skipWs(cur, end);
    if (!_literalAt(cur.v, end, _ls)) return 0xffffffff;
    var depth = 0;
    while (cur.v < end) {
      if (_inp(cur.v) == 0x25) {
        while (cur.v < end && _inp(cur.v) != 0x0a && _inp(cur.v) != 0x0d) cur.v++;
        continue;
      }
      if (_inp(cur.v) == 0x28) {
        var stringDepth = 1;
        cur.v++;
        while (cur.v < end && stringDepth != 0) {
          if (_inp(cur.v) == 0x5c) {
            cur.v += cur.v + 1 < end ? 2 : 1;
            continue;
          }
          if (_inp(cur.v) == 0x28) stringDepth++;
          else if (_inp(cur.v) == 0x29) stringDepth--;
          cur.v++;
        }
        if (stringDepth != 0) return 0xffffffff;
        continue;
      }
      if (_literalAt(cur.v, end, _ls)) {
        depth++;
        cur.v += 2;
        continue;
      }
      if (_literalAt(cur.v, end, _rs)) {
        if (depth == 0) return 0xffffffff;
        depth--;
        cur.v += 2;
        if (depth == 0) return 0xffffffff;
        continue;
      }
      if (depth == 1 && _keyAt(cur.v, end, key)) return cur.v;
      cur.v++;
    }
    return 0xffffffff;
  }

  bool _dictionaryAfter(int start, int end, Uint8List key, IntPtr ds, IntPtr de) {
    var at = _findDirectKey(start, end, key);
    if (at == 0xffffffff) return false;
    final cur = IntPtr(at + key.length);
    _skipWs(cur, end);
    if (!_literalAt(cur.v, end, _ls)) return false;
    ds.v = cur.v;
    var depth = 0;
    while (cur.v < end) {
      if (_inp(cur.v) == 0x28) {
        var stringDepth = 1;
        cur.v++;
        while (cur.v < end && stringDepth != 0) {
          if (_inp(cur.v) == 0x5c) {
            cur.v += cur.v + 1 < end ? 2 : 1;
            continue;
          }
          if (_inp(cur.v) == 0x28) stringDepth++;
          else if (_inp(cur.v) == 0x29) stringDepth--;
          cur.v++;
        }
        if (stringDepth != 0) return false;
        continue;
      }
      if (_literalAt(cur.v, end, _ls)) {
        depth++;
        cur.v += 2;
        continue;
      }
      if (_literalAt(cur.v, end, _rs)) {
        if (depth == 0) return false;
        depth--;
        cur.v += 2;
        if (depth == 0) {
          de.v = cur.v;
          return true;
        }
        continue;
      }
      cur.v++;
    }
    return false;
  }

  bool _directRefAfter(int start, int end, Uint8List key, IntPtr id) {
    var at = _findDirectKey(start, end, key);
    if (at == 0xffffffff) return false;
    final cur = IntPtr(at + key.length);
    final gen = IntPtr(0);
    return _readUint(cur, end, id) && _readUint(cur, end, gen) &&
        gen.v == 0 && _matchToken(cur, end, _r);
  }

  bool _refAfter(int start, int end, Uint8List key, IntPtr id) {
    var at = _findKey(start, end, key);
    if (at == 0xffffffff) return false;
    final cur = IntPtr(at + key.length);
    final gen = IntPtr(0);
    return _readUint(cur, end, id) && _readUint(cur, end, gen) &&
        gen.v == 0 && _matchToken(cur, end, _r);
  }

  bool _objectRange(int id, IntPtr start, IntPtr end) {
    if (id == 0 || id > objectCount) return false;
    final off = objectOffsets[id];
    final e = objectEnds[id];
    if (off == 0 || e <= off) return false;
    start.v = off;
    end.v = e;
    return true;
  }

  bool _objectHas(int id, Uint8List key, Uint8List name) {
    final s = IntPtr(0), e = IntPtr(0);
    if (!_objectRange(id, s, e)) return false;
    var at = _findKey(s.v, e.v, key);
    if (at == 0xffffffff) return false;
    final cur = IntPtr(at + key.length);
    _skipWs(cur, e.v);
    return _keyAt(cur.v, e.v, name);
  }

  bool _streamRange(int id, IntPtr start, IntPtr end) {
    final os = IntPtr(0), oe = IntPtr(0), at = IntPtr(0), length = IntPtr(0);
    if (!_objectRange(id, os, oe)) return false;
    final lengthAt = _findKey(os.v, oe.v, _length);
    final streamAt = _findRange(os.v, oe.v, _stream);
    if (lengthAt == 0xffffffff || streamAt == 0xffffffff) return false;
    at.v = lengthAt + 7;
    if (!_readUint(at, oe.v, length)) return false;
    at.v = streamAt + 6;
    if (at.v < oe.v && _inp(at.v) == 0x0d) at.v++;
    if (at.v >= oe.v || _inp(at.v) != 0x0a || at.v + length.v > oe.v) return false;
    at.v++; // C: input_bytes[at++] != '\n' — increment on success too
    start.v = at.v;
    end.v = at.v + length.v;
    at.v += length.v;
    if (at.v < oe.v && _inp(at.v) == 0x0d) at.v++;
    if (at.v < oe.v && _inp(at.v) == 0x0a) at.v++;
    return _literalAt(at.v, oe.v, _endstream);
  }

  int _hexValue(int c) {
    if (c >= 0x30 && c <= 0x39) return c - 0x30;
    if (c >= 0x61 && c <= 0x66) return c - 0x61 + 10;
    if (c >= 0x41 && c <= 0x46) return c - 0x41 + 10;
    return -1;
  }

  bool _parseToUnicode(int id) {
    final s = IntPtr(0), e = IntPtr(0);
    if (!_streamRange(id, s, e) || _findRange(s.v, e.v, _begincmap) == 0xffffffff ||
        _findRange(s.v, e.v, _endcmap) == 0xffffffff) {
      return false;
    }
    var at = s.v;
    final end = e.v;
    var mappings = 0;
    while (at + 11 <= end) {
      if (_inp(at) != 0x3c || _inp(at + 3) != 0x3e) {
        at++;
        continue;
      }
      final a = _hexValue(_inp(at + 1));
      final b = _hexValue(_inp(at + 2));
      final p = IntPtr(at + 4);
      _skipWs(p, end);
      if (a < 0 || b < 0 || p.v + 6 > end || _inp(p.v) != 0x3c || _inp(p.v + 5) != 0x3e) {
        at++;
        continue;
      }
      final h0 = _hexValue(_inp(p.v + 1));
      final h1 = _hexValue(_inp(p.v + 2));
      final h2 = _hexValue(_inp(p.v + 3));
      final h3 = _hexValue(_inp(p.v + 4));
      final code = a * 16 + b;
      final scalar = h0 * 4096 + h1 * 256 + h2 * 16 + h3;
      if (h0 < 0 || h1 < 0 || h2 < 0 || h3 < 0 || scalar > 127 || unicodeValid[code] != 0) {
        return false;
      }
      unicodeMap[code] = scalar;
      unicodeValid[code] = 1;
      mappings++;
      at = p.v + 6;
    }
    return mappings > 0;
  }

  bool _sameName(int at, int length, int other, int otherLength) {
    if (length != otherLength) return false;
    for (var i = 0; i < length; i++) {
      if (_inp(at + i) != _inp(other + i)) return false;
    }
    return true;
  }

  bool _charprocRef(int cpStart, int cpEnd, int nameAt, int nameLength, IntPtr id) {
    final cur = IntPtr(cpStart);
    while (cur.v < cpEnd) {
      _skipWs(cur, cpEnd);
      if (cur.v >= cpEnd || _inp(cur.v) != 0x2f) return false;
      cur.v++;
      final start = cur.v;
      while (cur.v < cpEnd && !_delimiter(_inp(cur.v))) cur.v++;
      final length = cur.v - start;
      final object = IntPtr(0), gen = IntPtr(0);
      if (!_readUint(cur, cpEnd, object) || !_readUint(cur, cpEnd, gen) ||
          gen.v != 0 || !_matchToken(cur, cpEnd, _r)) {
        return false;
      }
      if (_sameName(start, length, nameAt, nameLength)) {
        id.v = object.v;
        return true;
      }
    }
    return false;
  }

  bool _parseCharproc(int id, int code) {
    final s = IntPtr(0), e = IntPtr(0), at = IntPtr(0);
    if (!_streamRange(id, s, e)) return false;
    at.v = s.v;
    final end = e.v;
    final number = IntPtr(0);
    for (var i = 0; i < 6; i++) {
      if (!_readInt(at, end, number)) return false;
    }
    if (!_matchToken(at, end, _d1)) return false;
    while (true) {
      _skipWs(at, end);
      if (at.v == end) return true;
      final x = IntPtr(0), y = IntPtr(0), w = IntPtr(0), h = IntPtr(0);
      if (!_readInt(at, end, x) || !_readInt(at, end, y) || !_readInt(at, end, w) ||
          !_readInt(at, end, h) || !_matchToken(at, end, _re) || !_matchToken(at, end, _f)) {
        return false;
      }
      if (x.v < 0 || x.v > 4 || y.v < 0 || y.v > 6 || w.v != 1 || h.v != 1) return false;
      glyphRows[code][6 - y.v] |= 1 << (4 - x.v);
    }
  }

  bool _parseFont(int id) {
    final s = IntPtr(0), e = IntPtr(0), tu = IntPtr(0);
    if (!_objectRange(id, s, e) || !_objectHas(id, _type, _font) || !_objectHas(id, _subtype, _type3) ||
        _findRange(s.v, e.v, _fontMatrix) == 0xffffffff || !_refAfter(s.v, e.v, _toUnicode, tu) ||
        !_parseToUnicode(tu.v)) {
      return false;
    }
    var cp = _findKey(s.v, e.v, _charProcs);
    if (cp == 0xffffffff) return false;
    cp = _findRange(cp, e.v, _ls);
    if (cp == 0xffffffff) return false;
    final cpEnd = _findRange(cp + 2, e.v, _rs);
    if (cpEnd == 0xffffffff) return false;
    cp += 2;
    var differences = _findKey(s.v, e.v, _differences);
    if (differences == 0xffffffff) return false;
    differences = _findRange(differences, e.v, _lb);
    if (differences == 0xffffffff) return false;
    final diffEnd = _findRange(differences + 1, e.v, _rb);
    if (diffEnd == 0xffffffff) return false;
    final cur = IntPtr(differences + 1);
    var code = 0xffffffff;
    while (cur.v < diffEnd) {
      _skipWs(cur, diffEnd);
      if (cur.v >= diffEnd) break;
      if (_digit(_inp(cur.v))) {
        final cv = IntPtr(0);
        if (!_readUint(cur, diffEnd, cv) || cv.v > 255) return false;
        code = cv.v;
      } else if (_inp(cur.v) == 0x2f) {
        cur.v++;
        final name = cur.v;
        while (cur.v < diffEnd && !_delimiter(_inp(cur.v))) cur.v++;
        final proc = IntPtr(0);
        if (code > 255 || !_charprocRef(cp, cpEnd, name, cur.v - name, proc) ||
            !_parseCharproc(proc.v, code)) {
          return false;
        }
        code++;
      } else {
        return false;
      }
    }
    final first = IntPtr(0), last = IntPtr(0);
    var firstAt = _findKey(s.v, e.v, _firstChar);
    var lastAt = _findKey(s.v, e.v, _lastChar);
    if (firstAt == 0xffffffff || lastAt == 0xffffffff) return false;
    firstAt += 10;
    lastAt += 9;
    final fCur = IntPtr(firstAt), lCur = IntPtr(lastAt);
    if (!_readUint(fCur, e.v, first) || !_readUint(lCur, e.v, last) ||
        first.v > last.v || last.v > 255) {
      return false;
    }
    var widths = _findKey(s.v, e.v, _widths);
    widths = widths == 0xffffffff ? widths : _findRange(widths, e.v, _lb);
    if (widths == 0xffffffff) return false;
    final wcur = IntPtr(widths + 1);
    for (var c = first.v; c <= last.v; c++) {
      final w = IntPtr(0);
      if (!_readUint(wcur, e.v, w)) return false;
      glyphWidths[c] = w.v;
    }
    _skipWs(wcur, e.v);
    return wcur.v < e.v && _inp(wcur.v) == 0x5d;
  }

  bool _parseContent(int id, int page) {
    final s = IntPtr(0), e = IntPtr(0), at = IntPtr(0);
    if (!_streamRange(id, s, e)) return false;
    at.v = s.v;
    final end = e.v;
    if (!_matchToken(at, end, _bt)) return false;
    _skipWs(at, end);
    if (at.v >= end || _inp(at.v) != 0x2f) return false;
    at.v++;
    final fs = IntPtr(0), x = IntPtr(0), y = IntPtr(0);
    if (!_matchToken(at, end, _f1) || !_readUint(at, end, fs) || !_matchToken(at, end, _tf) ||
        !_readUint(at, end, x) || !_readUint(at, end, y) || !_matchToken(at, end, _td)) {
      return false;
    }
    pageFontSize[page] = fs.v;
    pageX[page] = x.v;
    pageY[page] = y.v;
    _skipWs(at, end);
    if (at.v >= end || _inp(at.v) != 0x28) return false;
    at.v++;
    var length = 0;
    while (at.v < end && _inp(at.v) != 0x29) {
      var code = _inp(at.v);
      at.v++;
      if (code == 0x5c) {
        if (at.v >= end) return false;
        code = _inp(at.v);
        at.v++;
      }
      if (length >= textCapacity || unicodeValid[code] == 0) return false;
      pageCodes[page][length] = code;
      pageText[page][length] = unicodeMap[code];
      length++;
    }
    if (at.v >= end) return false;
    final closes = _inp(at.v) == 0x29;
    at.v++; // C: input_bytes[at++] != ')' — increment during the read
    if (!closes || !_matchToken(at, end, _tj) || !_matchToken(at, end, _et)) return false;
    _skipWs(at, end);
    if (at.v != end) return false;
    pageLengths[page] = length;
    return true;
  }

  int parse(Uint8List bytes) {
    lastError = 0;
    input.setAll(0, bytes);
    inputLength = bytes.length;
    hits = 0;
    for (var i = 0; i < 9; i++) {
      counters[i] = 0;
    }
    for (var i = 0; i < objectCapacity; i++) {
      objectOffsets[i] = 0;
      objectEnds[i] = 0;
    }
    for (var i = 0; i < 256; i++) {
      unicodeMap[i] = 0;
      unicodeValid[i] = 0;
      glyphWidths[i] = 0;
      for (var r = 0; r < 7; r++) {
        glyphRows[i][r] = 0;
      }
    }
    final length = bytes.length;
    if (length < 128 || length > inputCapacity || !_literalAt(0, length, _pdfHeader)) return _err(1);
    final sx0 = length > 64 ? length - 64 : 0;
    var sx = _findRange(sx0, length, _startxref);
    final xref = IntPtr(0);
    if (sx == 0xffffffff) return _err(2);
    sx += 9;
    final sxCur = IntPtr(sx);
    if (!_readUint(sxCur, length, xref) || xref.v >= length || !_literalAt(xref.v, length, _xref)) {
      return _err(3);
    }
    final at = IntPtr(xref.v + 4);
    final first = IntPtr(0), size = IntPtr(0);
    if (!_readUint(at, length, first) || first.v != 0 || !_readUint(at, length, size) ||
        size.v < 2 || size.v > objectCapacity) {
      return _err(4);
    }
    objectCount = size.v - 1;
    for (var id = 0; id < size.v; id++) {
      final offset = IntPtr(0), generation = IntPtr(0);
      if (!_readUint(at, length, offset) || !_readUint(at, length, generation)) return _err(5);
      _skipWs(at, length);
      final state = _inp(at.v);
      at.v++;
      while (at.v < length && _inp(at.v) != 0x0a) at.v++;
      if (at.v < length) at.v++;
      if (id == 0) {
        if (state != 0x66 || generation.v != 65535) return _err(6);
      } else if (state != 0x6e || generation.v != 0 || offset.v == 0 || offset.v >= xref.v) {
        return _err(7);
      } else {
        objectOffsets[id] = offset.v;
      }
    }
    if (!_literalAt(at.v, length, _trailer)) return _err(8);
    final trailerEnd = _findRange(at.v, length, _startxref);
    final sizeKey0 = _findKey(at.v, trailerEnd, _size);
    final rootKey0 = _findKey(at.v, trailerEnd, _root);
    final trailerSize = IntPtr(0), root = IntPtr(0), rootGen = IntPtr(0);
    if (trailerEnd == 0xffffffff || sizeKey0 == 0xffffffff || rootKey0 == 0xffffffff) return _err(9);
    final sizeKey = IntPtr(sizeKey0 + 5);
    final rootKey = IntPtr(rootKey0 + 5);
    if (!_readUint(sizeKey, trailerEnd, trailerSize) || trailerSize.v != size.v ||
        !_readUint(rootKey, trailerEnd, root) || !_readUint(rootKey, trailerEnd, rootGen) ||
        rootGen.v != 0 || !_matchToken(rootKey, trailerEnd, _r) || root.v == 0 || root.v >= size.v) {
      return _err(10);
    }
    for (var id = 1; id < size.v; id++) {
      final p = IntPtr(objectOffsets[id]);
      final foundId = IntPtr(0), generation = IntPtr(0);
      if (!_readUint(p, xref.v, foundId) || foundId.v != id || !_readUint(p, xref.v, generation) ||
          generation.v != 0 || !_matchToken(p, xref.v, _obj)) {
        return _err(11);
      }
      final next = id + 1 < size.v ? objectOffsets[id + 1] : xref.v;
      final close = _findRange(p.v, next, _endobj);
      if (close == 0xffffffff) return _err(12);
      objectOffsets[id] = p.v;
      objectEnds[id] = close;
    }
    final rs = IntPtr(0), re = IntPtr(0), pagesRoot = IntPtr(0);
    if (!_objectRange(root.v, rs, re) || !_objectHas(root.v, _type, _catalog) ||
        !_refAfter(rs.v, re.v, _pages, pagesRoot)) {
      return _err(13);
    }
    final ps = IntPtr(0), pe = IntPtr(0), count = IntPtr(0);
    if (!_objectRange(pagesRoot.v, ps, pe) || !_objectHas(pagesRoot.v, _type, _pagesTok)) return _err(14);
    var countAt = _findKey(ps.v, pe.v, _count);
    var kids = _findKey(ps.v, pe.v, _kids);
    if (countAt == 0xffffffff || kids == 0xffffffff) return _err(15);
    countAt += 6;
    final countCur = IntPtr(countAt);
    if (!_readUint(countCur, pe.v, count) || count.v == 0 || count.v > pageCapacity) {
      return _err(16);
    }
    kids = _findRange(kids, pe.v, _lb);
    if (kids == 0xffffffff) return _err(17);
    kids++;
    final kidsCur = IntPtr(kids);
    var sharedFont = 0;
    for (var page = 0; page < count.v; page++) {
      final pageId = IntPtr(0), generation = IntPtr(0);
      if (!_readUint(kidsCur, pe.v, pageId) || !_readUint(kidsCur, pe.v, generation) ||
          generation.v != 0 || !_matchToken(kidsCur, pe.v, _r)) {
        return _err(18);
      }
      final ps2 = IntPtr(0), pe2 = IntPtr(0), parent = IntPtr(0), contents = IntPtr(0);
      final font = IntPtr(0), rs2 = IntPtr(0), re2 = IntPtr(0), fs2 = IntPtr(0), fe2 = IntPtr(0);
      if (!_objectRange(pageId.v, ps2, pe2) || !_objectHas(pageId.v, _type, _page) ||
          !_refAfter(ps2.v, pe2.v, _parent, parent) || parent.v != pagesRoot.v ||
          _findRange(ps2.v, pe2.v, _mediaBox) == 0xffffffff ||
          !_dictionaryAfter(ps2.v, pe2.v, _resources, rs2, re2) ||
          !_dictionaryAfter(rs2.v, re2.v, _font, fs2, fe2) ||
          !_directRefAfter(fs2.v, fe2.v, _f1, font) || !_refAfter(ps2.v, pe2.v, _contents, contents)) {
        return _err(19);
      }
      if (page == 0) {
        sharedFont = font.v;
        if (!_parseFont(font.v)) return _err(20);
      } else if (font.v != sharedFont) {
        return _err(21);
      }
      if (!_parseContent(contents.v, page)) return _err(22);
    }
    _skipWs(kidsCur, pe.v);
    if (kidsCur.v >= pe.v || _inp(kidsCur.v) != 0x5d) return _err(23);
    var glyphs = 0;
    var comparisons = 0;
    for (var page = 0; page < count.v; page++) {
      var found = false;
      final plen = pageLengths[page];
      for (var i = 0; i + 6 <= plen; i++) {
        comparisons++;
        if (pageText[page][i] == 0x4e && pageText[page][i + 1] == 0x45 && pageText[page][i + 2] == 0x45 &&
            pageText[page][i + 3] == 0x44 && pageText[page][i + 4] == 0x4c && pageText[page][i + 5] == 0x45) {
          found = true;
        }
      }
      if (found) {
        hitPages[hits++] = page + 1;
      }
      glyphs += plen;
    }
    counters[0] = objectCount;
    counters[1] = count.v;
    counters[2] = glyphs;
    counters[3] = comparisons;
    counters[4] = 0;
    counters[5] = width;
    counters[6] = height;
    counters[7] = 1;
    counters[8] = rgbaBytes;
    return 0;
  }

  int _err(int code) {
    lastError = code;
    return code;
  }

  bool _rasterPageAllowed(int page) => page == 1 || page == 25 || page == 50 || page == 75 || page == 100;

  Uint8List renderPage(int page) {
    if (!_rasterPageAllowed(page) || page > counters[1]) {
      lastError = 24;
      return Uint8List(0);
    }
    rgba.fillRange(0, rgbaBytes, 255);
    final index = page - 1;
    if (pageFontSize[index] != 16) {
      lastError = 25;
      return Uint8List(0);
    }
    var x = pageX[index] * 2;
    for (var g = 0; g < pageLengths[index]; g++) {
      final code = pageCodes[index][g];
      if (unicodeValid[code] == 0 || glyphWidths[code] == 0) {
        lastError = 26;
        return Uint8List(0);
      }
      for (var row = 0; row < 7; row++) {
        for (var col = 0; col < 5; col++) {
          if ((glyphRows[code][row] >> (4 - col)) & 1 != 0) {
            final left = x + col * 4;
            final top = height - pageY[index] * 2 - 28 + row * 4;
            if (left + 4 >= width || top + 4 >= height) {
              lastError = 27;
              return Uint8List(0);
            }
            for (var dy = 0; dy <= 4; dy++) {
              for (var dx = 0; dx <= 4; dx++) {
                final out = ((top + dy) * width + left + dx) * 4;
                rgba[out] = 0;
                rgba[out + 1] = 0;
                rgba[out + 2] = 0;
              }
            }
          }
        }
      }
      x += glyphWidths[code] * 4;
    }
    counters[4]++;
    return rgba;
  }

  // Read-only getters for the adapter.
  int get pageCount => counters[1];
  List<int> get hitList {
    final out = <int>[];
    for (var i = 0; i < hits; i++) {
      out.add(hitPages[i]);
    }
    return out;
  }

  String textOf(int page) {
    final len = pageLengths[page];
    final buf = StringBuffer();
    for (var i = 0; i < len; i++) {
      buf.writeCharCode(pageText[page][i]);
    }
    return buf.toString();
  }

  List<int> get countersList => List<int>.generate(9, (i) => counters[i]);

  // Token constants (Uint8List byte mirrors of the C string literals).
  static final Uint8List _ls = Uint8List.fromList([0x3c, 0x3c]);
  static final Uint8List _rs = Uint8List.fromList([0x3e, 0x3e]);
  static final Uint8List _r = Uint8List.fromList([0x52]);
  static final Uint8List _length = Uint8List.fromList([0x2f, 0x4c, 0x65, 0x6e, 0x67, 0x74, 0x68]);
  static final Uint8List _stream = Uint8List.fromList([0x73, 0x74, 0x72, 0x65, 0x61, 0x6d]);
  static final Uint8List _endstream = Uint8List.fromList([0x65, 0x6e, 0x64, 0x73, 0x74, 0x72, 0x65, 0x61, 0x6d]);
  static final Uint8List _begincmap = Uint8List.fromList([0x62, 0x65, 0x67, 0x69, 0x6e, 0x63, 0x6d, 0x61, 0x70]);
  static final Uint8List _endcmap = Uint8List.fromList([0x65, 0x6e, 0x64, 0x63, 0x6d, 0x61, 0x70]);
  static final Uint8List _d1 = Uint8List.fromList([0x64, 0x31]);
  static final Uint8List _re = Uint8List.fromList([0x72, 0x65]);
  static final Uint8List _f = Uint8List.fromList([0x66]);
  static final Uint8List _type = Uint8List.fromList([0x2f, 0x54, 0x79, 0x70, 0x65]);
  static final Uint8List _font = Uint8List.fromList([0x2f, 0x46, 0x6f, 0x6e, 0x74]);
  static final Uint8List _subtype = Uint8List.fromList([0x2f, 0x53, 0x75, 0x62, 0x74, 0x79, 0x70, 0x65]);
  static final Uint8List _type3 = Uint8List.fromList([0x2f, 0x54, 0x79, 0x70, 0x65, 0x33]);
  static final Uint8List _fontMatrix = Uint8List.fromList(
      [0x2f, 0x46, 0x6f, 0x6e, 0x74, 0x4d, 0x61, 0x74, 0x72, 0x69, 0x78, 0x20, 0x5b, 0x30, 0x2e, 0x31, 0x32,
        0x35, 0x20, 0x30, 0x20, 0x30, 0x20, 0x30, 0x2e, 0x31, 0x32, 0x35, 0x20, 0x30, 0x20, 0x30, 0x5d]);
  static final Uint8List _toUnicode = Uint8List.fromList([0x2f, 0x54, 0x6f, 0x55, 0x6e, 0x69, 0x63, 0x6f, 0x64, 0x65]);
  static final Uint8List _charProcs = Uint8List.fromList([0x2f, 0x43, 0x68, 0x61, 0x72, 0x50, 0x72, 0x6f, 0x63, 0x73]);
  static final Uint8List _differences = Uint8List.fromList([0x2f, 0x44, 0x69, 0x66, 0x66, 0x65, 0x72, 0x65, 0x6e, 0x63, 0x65, 0x73]);
  static final Uint8List _firstChar = Uint8List.fromList([0x2f, 0x46, 0x69, 0x72, 0x73, 0x74, 0x43, 0x68, 0x61, 0x72]);
  static final Uint8List _lastChar = Uint8List.fromList([0x2f, 0x4c, 0x61, 0x73, 0x74, 0x43, 0x68, 0x61, 0x72]);
  static final Uint8List _widths = Uint8List.fromList([0x2f, 0x57, 0x69, 0x64, 0x74, 0x68, 0x73]);
  static final Uint8List _bt = Uint8List.fromList([0x42, 0x54]);
  static final Uint8List _f1 = Uint8List.fromList([0x46, 0x31]);
  static final Uint8List _tf = Uint8List.fromList([0x54, 0x66]);
  static final Uint8List _td = Uint8List.fromList([0x54, 0x64]);
  static final Uint8List _tj = Uint8List.fromList([0x54, 0x6a]);
  static final Uint8List _et = Uint8List.fromList([0x45, 0x54]);
  static final Uint8List _pdfHeader = Uint8List.fromList([0x25, 0x50, 0x44, 0x46, 0x2d, 0x31, 0x2e, 0x37, 0x0a]);
  static final Uint8List _startxref = Uint8List.fromList([0x73, 0x74, 0x61, 0x72, 0x74, 0x78, 0x72, 0x65, 0x66]);
  static final Uint8List _xref = Uint8List.fromList([0x78, 0x72, 0x65, 0x66]);
  static final Uint8List _trailer = Uint8List.fromList([0x74, 0x72, 0x61, 0x69, 0x6c, 0x65, 0x72]);
  static final Uint8List _size = Uint8List.fromList([0x2f, 0x53, 0x69, 0x7a, 0x65]);
  static final Uint8List _root = Uint8List.fromList([0x2f, 0x52, 0x6f, 0x6f, 0x74]);
  static final Uint8List _obj = Uint8List.fromList([0x6f, 0x62, 0x6a]);
  static final Uint8List _endobj = Uint8List.fromList([0x65, 0x6e, 0x64, 0x6f, 0x62, 0x6a]);
  static final Uint8List _catalog = Uint8List.fromList([0x2f, 0x43, 0x61, 0x74, 0x61, 0x6c, 0x6f, 0x67]);
  static final Uint8List _pages = Uint8List.fromList([0x2f, 0x50, 0x61, 0x67, 0x65, 0x73]);
  static final Uint8List _pagesTok = Uint8List.fromList([0x2f, 0x50, 0x61, 0x67, 0x65, 0x73]);
  static final Uint8List _count = Uint8List.fromList([0x2f, 0x43, 0x6f, 0x75, 0x6e, 0x74]);
  static final Uint8List _kids = Uint8List.fromList([0x2f, 0x4b, 0x69, 0x64, 0x73]);
  static final Uint8List _page = Uint8List.fromList([0x2f, 0x50, 0x61, 0x67, 0x65]);
  static final Uint8List _parent = Uint8List.fromList([0x2f, 0x50, 0x61, 0x72, 0x65, 0x6e, 0x74]);
  static final Uint8List _mediaBox = Uint8List.fromList(
      [0x2f, 0x4d, 0x65, 0x64, 0x69, 0x61, 0x42, 0x6f, 0x78, 0x20, 0x5b, 0x30, 0x20, 0x30, 0x20, 0x36,
        0x31, 0x32, 0x20, 0x37, 0x39, 0x32, 0x5d]);
  static final Uint8List _resources = Uint8List.fromList([0x2f, 0x52, 0x65, 0x73, 0x6f, 0x75, 0x72, 0x63, 0x65, 0x73]);
  static final Uint8List _contents = Uint8List.fromList([0x2f, 0x43, 0x6f, 0x6e, 0x74, 0x65, 0x6e, 0x74, 0x73]);
  static final Uint8List _lb = Uint8List.fromList([0x5b]);
  static final Uint8List _rb = Uint8List.fromList([0x5d]);
}

// Mutable pointer-ish holders so the port reads like the C code.
class IntPtr {
  IntPtr(this.v);
  int v;
}

@JS('dartKernels')
external set dartKernels(JSObject value);

@JSExport()
class PdfEngineExport {
  PdfEngineExport(this.engine);
  final PdfEngine engine;

  @JSExport('parse')
  int parse(JSArrayBuffer input) {
    final buf = input.toDart;
    final bytes = buf is ByteBuffer ? Uint8List.view(buf) : Uint8List(0);
    return engine.parse(bytes);
  }

  @JSExport('pageCount')
  int pageCount() => engine.pageCount;

  @JSExport('hits')
  JSUint32Array hits() => Uint32List.fromList(engine.hitList).toJS;

  @JSExport('counters')
  JSUint32Array counters() => Uint32List.fromList(engine.countersList).toJS;

  @JSExport('text')
  String text(int page) => engine.textOf(page);

  @JSExport('renderPage')
  JSArrayBuffer renderPage(int page) {
    final rgba = engine.renderPage(page);
    return rgba.buffer.toJS;
  }

  @JSExport('lastError')
  int lastError() => engine.lastError;



}

void main() {
  dartKernels = createJSInteropWrapper(PdfEngineExport(PdfEngine()));
}
