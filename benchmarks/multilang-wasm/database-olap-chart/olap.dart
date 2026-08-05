// database-olap-chart Dart WasmGC kernel — exact mirror of the C olap.c:
// u32/u64 OLAP aggregation over zero-copy Uint32Array views. No f32 issues;
// Dart ints are 64-bit, so the u64 units/revenue accumulation is native.

import 'dart:js_interop';
import 'dart:typed_data';

const ROWS = 10000, QUERIES = 5, CATEGORIES = 16, TOP = 8;
const ROW_WORDS = 6, QUERY_WORDS = 6, HEADER = 8;
const OUT_PER_QUERY = 112, OUTPUT_WORDS = QUERIES * OUT_PER_QUERY;

@JSExport()
class OlapKernels {
  final List<int> counters = List<int>.filled(9, 0);

  int _columnValue(Uint32List input, int column, int row) {
    return input[HEADER + column * ROWS + row];
  }

  int _rowKey(Uint32List input, int row, int column) {
    return _columnValue(input, column == 0 ? 5 : 4, row);
  }

  bool _before(Uint32List input, int left, int right, int column, bool descending) {
    final a = _rowKey(input, left, column);
    final b = _rowKey(input, right, column);
    if (a != b) return descending ? a > b : a < b;
    return left < right;
  }

  void _stableSort(
    Uint32List input,
    List<int> indexes,
    List<int> temporary,
    int length,
    int column,
    bool descending,
  ) {
    for (var width = 1; width < length; width *= 2) {
      for (var left = 0; left < length; left += width * 2) {
        final mid = left + width < length ? left + width : length;
        final right = left + width * 2 < length ? left + width * 2 : length;
        var i = left, j = mid, out = left;
        while (i < mid && j < right) {
          counters[4]++;
          if (_before(input, indexes[i], indexes[j], column, descending)) {
            temporary[out++] = indexes[i++];
          } else {
            temporary[out++] = indexes[j++];
          }
        }
        while (i < mid) temporary[out++] = indexes[i++];
        while (j < right) temporary[out++] = indexes[j++];
        for (var k = left; k < right; k++) indexes[k] = temporary[k];
      }
    }
  }

  @JSExport('run')
  int run(JSUint32Array inputJs, JSUint32Array resultJs, int byteLength) {
    final input = inputJs.toDart; // zero-copy Uint32List views on Wasm
    final result = resultJs.toDart;
    final expected = (HEADER + ROWS * ROW_WORDS + QUERIES * QUERY_WORDS) * 4;
    if (byteLength != expected ||
        input[0] != 0x50414c4f ||
        input[1] != 1 ||
        input[2] != ROWS ||
        input[3] != QUERIES ||
        input[4] != CATEGORIES ||
        input[5] != TOP ||
        input[6] != ROW_WORDS ||
        input[7] != QUERY_WORDS) {
      return 0;
    }
    for (var i = 0; i < 9; i++) {
      counters[i] = 0;
    }
    counters[0] = QUERIES;
    counters[6] = QUERIES * CATEGORIES;
    counters[7] = QUERIES * TOP;
    counters[8] = OUTPUT_WORDS;
    final indexes = List<int>.filled(ROWS, 0);
    final temporary = List<int>.filled(ROWS, 0);
    final queryStart = HEADER + ROWS * ROW_WORDS;
    for (var q = 0; q < QUERIES; q++) {
      final qp = queryStart + q * QUERY_WORDS;
      final regionMask = input[qp];
      final categoryMask = input[qp + 1];
      final minUnits = input[qp + 2];
      final descending = input[qp + 3] != 0;
      final sortColumn = input[qp + 4];
      final revision = input[qp + 5];
      final count = List<int>.filled(CATEGORIES, 0);
      final units = List<int>.filled(CATEGORIES, 0);
      final revenue = List<int>.filled(CATEGORIES, 0);
      var matched = 0;
      var filterDigest = 0x811c9dc5;
      for (var row = 0; row < ROWS; row++) {
        final region = _columnValue(input, 1, row);
        final category = _columnValue(input, 2, row);
        final amount = _columnValue(input, 4, row);
        counters[1]++;
        counters[2] += 3;
        if (((regionMask >> region) & 1) == 0 ||
            ((categoryMask >> category) & 1) == 0 ||
            amount < minUnits) {
          continue;
        }
        indexes[matched++] = row;
        counters[3]++;
        counters[5]++;
        filterDigest = (filterDigest ^ row) * 0x01000193;
        count[category]++;
        units[category] += amount;
        revenue[category] += _columnValue(input, 5, row);
      }
      _stableSort(input, indexes, temporary, matched, sortColumn, descending);
      var out = q * OUT_PER_QUERY;
      result[out++] = q;
      result[out++] = matched;
      result[out++] = sortColumn;
      result[out++] = descending ? 1 : 0;
      result[out++] = filterDigest;
      result[out++] = TOP;
      result[out++] = CATEGORIES;
      result[out++] = revision;
      for (var i = 0; i < TOP; i++) {
        final row = indexes[i];
        result[out++] = row;
        result[out++] = _columnValue(input, 4, row);
        result[out++] = _columnValue(input, 5, row);
      }
      for (var b = 0; b < CATEGORIES; b++) {
        result[out++] = count[b];
        result[out++] = units[b] & 0xffffffff;
        result[out++] = (units[b] >> 32) & 0xffffffff;
        result[out++] = revenue[b] & 0xffffffff;
        result[out++] = (revenue[b] >> 32) & 0xffffffff;
      }
    }
    return OUTPUT_WORDS;
  }

  @JSExport('counter')
  int counter(int index) => index < 9 ? counters[index] : 0;
}

void main() {
  dartKernels = createJSInteropWrapper(OlapKernels());
}

@JS('dartKernels')
external set dartKernels(JSObject value);
