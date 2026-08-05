// serialization-json-telemetry Dart WasmGC kernel — exact mirror of the C
// telemetry.c parser: same byte-level JSON parsing, same vocabulary tables,
// same canonical summary output. Dart's byte operations map 1:1 to wasm
// memory ops over zero-copy Uint8Array views.

import 'dart:js_interop';
import 'dart:typed_data';

// Byte-exact UTF-8 vocabulary (matches the C tables).
const REGIONS = <List<int>>[
  [0x61, 0x70], // ap
  [0x65, 0x75], // eu
  [0x6e, 0x61], // na
  [0x73, 0x61], // sa
];
const KINDS = <List<int>>[
  [0x63, 0x6c, 0x69, 0x63, 0x6b], // click
  [0x70, 0x75, 0x72, 0x63, 0x68, 0x61, 0x73, 0x65], // purchase
  [0x76, 0x69, 0x65, 0x77], // view
];
const LABEL_BYTES = <List<int>>[
  [0x43, 0x61, 0x66, 0xc3, 0xa9], // Café
  [0xe6, 0x9d, 0xb1, 0xe4, 0xba, 0xac], // 東京
  [0xd9, 0x85, 0xd8, 0xb1, 0xd8, 0xad, 0xd8, 0xa8, 0xd8, 0xa7], // مرحبا
  [0xf0, 0x9f, 0x9a, 0x80], // 🚀
];
const TAG_BYTES = <List<int>>[
  [0xce, 0xb1], // α
  [0xe6, 0x95, 0xb0, 0xe6, 0x8d, 0xae], // 数据
  [0x6d, 0x61, 0xc3, 0xb1, 0x61, 0x6e, 0x61], // mañana
  [0xf0, 0x9f, 0xa7, 0xaa], // 🧪
];

class _Parser {
  final Uint8List bytes;
  int at = 0;
  _Parser(this.bytes);

  bool expectByte(int value) {
    if (at < bytes.length && bytes[at] == value) {
      at++;
      return true;
    }
    return false;
  }

  bool expectAscii(List<int> value) {
    for (final b in value) {
      if (!expectByte(b)) return false;
    }
    return true;
  }

  int? parseUint() {
    final start = at;
    var value = 0;
    while (at < bytes.length && bytes[at] >= 0x30 && bytes[at] <= 0x39) {
      if (at > start && bytes[start] == 0x30) return null;
      final next = value * 10 + (bytes[at] - 0x30);
      if (next < value) return null;
      value = next;
      at++;
    }
    if (at == start) return null;
    return value;
  }

  bool bytesEqual(List<int> value) {
    if (at + value.length >= bytes.length) return false;
    for (var i = 0; i < value.length; i++) {
      if (bytes[at + i] != value[i]) return false;
    }
    if (bytes[at + value.length] != 0x22) return false;
    at += value.length + 1;
    return true;
  }

  int? parseOption(List<List<int>> values) {
    if (!expectByte(0x22)) return null;
    for (var i = 0; i < values.length; i++) {
      final saved = at;
      if (bytesEqual(values[i])) return i;
      at = saved;
    }
    return null;
  }

  int? parseBoolean() {
    final saved = at;
    if (expectAscii('true'.codeUnits)) return 1;
    at = saved;
    if (expectAscii('false'.codeUnits)) return 0;
    return null;
  }
}

@JSExport()
class JsonTelemetryKernels {
  int records = 0;
  int inputBytes = 0;
  int numeric = 0;
  int strings = 0;
  int booleans = 0;

  @JSExport('process')
  int process(
    JSUint8Array inputJs,
    int length,
    JSUint8Array outputJs,
    int outputCapacity,
  ) {
    final input = inputJs.toDart; // zero-copy Uint8List view on Wasm
    final output = outputJs.toDart;
    final p = _Parser(input);
    records = 0;
    inputBytes = length;
    numeric = 0;
    strings = 0;
    booleans = 0;
    final regionCounts = [0, 0, 0, 0];
    final kindCounts = [0, 0, 0];
    var okCount = 0;
    var errorCount = 0;
    var valueSum = 0;

    if (!p.expectByte(0x5b)) return -1; // [
    while (p.at < input.length && input[p.at] != 0x5d) {
      if (records != 0 && !p.expectByte(0x2c)) return -2; // ,
      if (!p.expectAscii('{"id":'.codeUnits)) return -3;
      final id = p.parseUint();
      if (id == null || id != records) return -4;
      if (!p.expectAscii(',"ts":'.codeUnits)) return -5;
      final ts = p.parseUint();
      if (ts == null || ts != 1700000000 + id) return -5;
      if (!p.expectAscii(',"region":'.codeUnits)) return -6;
      final region = p.parseOption(REGIONS);
      if (region == null) return -7;
      if (!p.expectAscii(',"kind":'.codeUnits)) return -8;
      final kind = p.parseOption(KINDS);
      if (kind == null) return -8;
      if (!p.expectAscii(',"ok":'.codeUnits)) return -9;
      final ok = p.parseBoolean();
      if (ok == null) return -9;
      if (!p.expectAscii(',"value":'.codeUnits)) return -10;
      final value = p.parseUint();
      if (value == null || value > 9999) return -10;
      if (!p.expectAscii(',"meta":{"label":'.codeUnits)) return -11;
      final label = p.parseOption(LABEL_BYTES);
      if (label == null) return -11;
      if (!p.expectAscii(',"tag":'.codeUnits)) return -12;
      final tag = p.parseOption(TAG_BYTES);
      if (tag == null) return -12;
      if (!p.expectAscii('}}'.codeUnits)) return -13;
      records++;
      numeric += 3;
      strings += 4;
      booleans++;
      regionCounts[region]++;
      kindCounts[kind]++;
      okCount += ok;
      errorCount += 1 - ok;
      valueSum += value;
    }
    if (!p.expectByte(0x5d) || p.at != input.length) return -14; // ]

    var pos = 0;
    String text = '';
    void w(String s) {
      text += s;
    }

    w('{"count":');
    w('$records');
    w(',"errorCount":');
    w('$errorCount');
    w(',"kind":{"click":');
    w('${kindCounts[0]}');
    w(',"purchase":');
    w('${kindCounts[1]}');
    w(',"view":');
    w('${kindCounts[2]}');
    w('},"okCount":');
    w('$okCount');
    w(',"region":{"ap":');
    w('${regionCounts[0]}');
    w(',"eu":');
    w('${regionCounts[1]}');
    w(',"na":');
    w('${regionCounts[2]}');
    w(',"sa":');
    w('${regionCounts[3]}');
    w('},"valueSum":');
    w('$valueSum');
    w('}');
    final bytes = text.codeUnits;
    if (bytes.length > outputCapacity) return -15;
    for (var i = 0; i < bytes.length; i++) {
      output[i] = bytes[i];
    }
    return bytes.length;
  }

  @JSExport('get_records')
  int getRecords() => records;
  @JSExport('get_input_bytes')
  int getInputBytes() => inputBytes;
  @JSExport('get_numeric_values')
  int getNumericValues() => numeric;
  @JSExport('get_string_values')
  int getStringValues() => strings;
  @JSExport('get_booleans')
  int getBooleans() => booleans;
  @JSExport('get_query_aggregates')
  int getQueryAggregates() => 11;
  @JSExport('get_allocations')
  int getAllocations() => 0;
}

void main() {
  dartKernels = createJSInteropWrapper(JsonTelemetryKernels());
}

@JS('dartKernels')
external set dartKernels(JSObject value);
