// text-gc-document-edit Dart WasmGC kernel — computes the same counters and
// the same canonical FNV-1a digest as gc_document_kernel.{c,cpp,rs,ts} and as
// executeFixture() in benchmarks/v1/text-gc-document-edit/workload.js. The
// oracle is the pinned one (public/artifacts/text-gc-document-edit/
// reference.json); this kernel mirrors it and does not define its own.
//
// Representation, and why it differs from the linear-memory kernels
// -----------------------------------------------------------------
// The C, C++, Rust and AssemblyScript kernels hold the document as parallel
// slot arrays in linear memory (PARENT_OF / FIRST_CHILD_OF / ... indexed by
// node id) and never allocate: a deleted node's slot is marked free and
// reused. That is the fastest way to express this workload without a GC, and
// it is the right thing for those languages to do.
//
// This kernel holds the document as what it actually is: a graph of _Node
// objects linked by object references, on the WasmGC managed heap. A delete
// drops the last strong reference to a node and the object becomes garbage.
// Over the frozen trace that is 3,590 node allocations (256 initial + 3,334
// inserted) of which 3,333 are dropped, with a live set that never exceeds a
// few hundred nodes.
//
// So the Dart row is NOT the same data structure as the C row. It is the same
// *work* — identical parse, identical edit semantics, identical traversal,
// bit-identical counters and digest — expressed the way the language expresses
// it. Read the Dart-versus-C delta on this page as "managed object graph
// versus hand-rolled slot table", not as "Dart is slower than C at array
// indexing". The workload exists to make that specific cost visible.
//
// Labels are kept as (offset, hex length) spans into the fixture bytes and
// decoded during the traversal, exactly as the other kernels do, so no kernel
// decodes more hex than another. Slot lookup uses a 4,096-entry
// List<_Node?> handle table: node ids are dense and the fixture addresses
// nodes by id, so every kernel needs an id -> node map. The entries are object
// references, not packed fields.
//
// Arithmetic note: Dart ints are 64-bit, so every u32 operation is masked with
// `& 0xFFFFFFFF` to mirror JavaScript's `>>> 0` and the u32 wraparound the
// other kernels get for free.

import 'dart:js_interop';
import 'dart:typed_data';

const int _maxSlots = 4096;

/// A document node. Children form a doubly linked sibling list, matching the
/// linear-memory kernels' FIRST_CHILD / PREV_SIBLING / NEXT_SIBLING layout —
/// but as object references rather than i32 slot indices.
class _Node {
  final int id;
  final int labelOff;
  final int labelHexLen;
  _Node? parent;
  _Node? firstChild;
  _Node? prevSibling;
  _Node? nextSibling;
  int childCount = 0;

  _Node(this.id, this.labelOff, this.labelHexLen);
}

@JSExport()
class GcDocumentKernels {
  late Uint8List _fixture;
  int _off = 0;
  int _end = 0;
  int _fnv = 0;
  final List<_Node?> _slots = List<_Node?>.filled(_maxSlots, null);

  // --- FNV-1a 32-bit -------------------------------------------------------

  void _fnvMixByte(int b) {
    _fnv = ((_fnv ^ b) * 0x01000193) & 0xFFFFFFFF;
  }

  void _fnvMixU32(int v) {
    _fnvMixByte(v & 0xff);
    _fnvMixByte((v >>> 8) & 0xff);
    _fnvMixByte((v >>> 16) & 0xff);
    _fnvMixByte((v >>> 24) & 0xff);
  }

  // --- Fixture scanning ----------------------------------------------------

  bool _isDigit(int c) => c >= 0x30 && c <= 0x39;

  int _hexVal(int c) {
    if (c >= 0x30 && c <= 0x39) return c - 0x30;
    if (c >= 0x61 && c <= 0x66) return c - 0x61 + 10;
    return c - 0x41 + 10;
  }

  /// Reads a signed decimal integer at [_off] and advances past it.
  int _readInt() {
    var neg = false;
    if (_off < _end && _fixture[_off] == 0x2d /* '-' */) {
      neg = true;
      _off++;
    }
    var v = 0;
    while (_off < _end && _isDigit(_fixture[_off])) {
      v = v * 10 + (_fixture[_off] - 0x30);
      _off++;
    }
    return neg ? -v : v;
  }

  void _skipLine() {
    while (_off < _end && _fixture[_off] != 0x0a /* '\n' */) {
      _off++;
    }
    if (_off < _end) _off++;
  }

  /// Reads a `<name>\t<count>\n` header row and returns the count.
  int _readHeaderCount() {
    while (_off < _end && _fixture[_off] != 0x09 /* '\t' */) {
      _off++;
    }
    if (_off < _end) _off++;
    final c = _readInt();
    _skipLine();
    return c;
  }

  /// Advances [_off] to the end of a tab- or newline-terminated hex span.
  void _readHexSpanEnd() {
    while (_off < _end &&
        _fixture[_off] != 0x09 /* '\t' */ &&
        _fixture[_off] != 0x0a /* '\n' */) {
      _off++;
    }
  }

  // --- Sibling list maintenance -------------------------------------------

  void _linkAfter(_Node parent, _Node? anchor, _Node node) {
    if (anchor == null) {
      final oldHead = parent.firstChild;
      node.nextSibling = oldHead;
      node.prevSibling = null;
      if (oldHead != null) oldHead.prevSibling = node;
      parent.firstChild = node;
    } else {
      final oldNext = anchor.nextSibling;
      node.nextSibling = oldNext;
      node.prevSibling = anchor;
      if (oldNext != null) oldNext.prevSibling = node;
      anchor.nextSibling = node;
    }
    parent.childCount++;
  }

  void _insertAtPosition(_Node parent, int position, _Node node) {
    if (position == 0) {
      _linkAfter(parent, null, node);
      return;
    }
    var cur = parent.firstChild;
    var k = 0;
    while (k < position - 1 && cur != null) {
      cur = cur.nextSibling;
      k++;
    }
    _linkAfter(parent, cur, node);
  }

  void _spliceOut(_Node node) {
    final par = node.parent!;
    final p = node.prevSibling;
    final n = node.nextSibling;
    if (p == null) {
      par.firstChild = n;
    } else {
      p.nextSibling = n;
    }
    if (n != null) n.prevSibling = p;
    node.prevSibling = null;
    node.nextSibling = null;
    par.childCount--;
  }

  // --- Canonical traversal -------------------------------------------------

  void _dfsMix(_Node node) {
    _fnvMixU32(node.id);
    final byteLen = node.labelHexLen ~/ 2;
    _fnvMixU32(byteLen);
    final off = node.labelOff;
    for (var i = 0; i < byteLen; i++) {
      final hi = _fixture[off + i * 2];
      final lo = _fixture[off + i * 2 + 1];
      _fnvMixByte(((_hexVal(hi) << 4) | _hexVal(lo)) & 0xff);
    }
    _fnvMixU32(node.childCount);
    var c = node.firstChild;
    while (c != null) {
      _dfsMix(c);
      c = c.nextSibling;
    }
  }

  // --- Entry point ---------------------------------------------------------

  /// Runs the frozen document-edit trace. [fixtureJs] is the fixture text as
  /// UTF-8 bytes; [outJs] receives 8 u32 counters (inserts, deletes,
  /// reparents, nodeCount, childInsertions, childRemovals, parentWrites,
  /// canonicalFnv). Returns the final node count.
  @JSExport('gc_document_edit_trace')
  int gcDocumentEditTrace(
    JSUint8Array fixtureJs,
    int fixtureLen,
    JSUint32Array outJs,
  ) {
    _fixture = fixtureJs.toDart; // zero-copy Uint8List view
    final out = outJs.toDart;
    _off = 0;
    _end = fixtureLen;

    // Drop every node from any previous run: the handle table is the only
    // root, so clearing it makes the whole previous document garbage.
    _slots.fillRange(0, _maxSlots, null);

    _skipLine(); // format line
    final initialCount = _readHeaderCount();
    _readHeaderCount(); // operations count: parser trusts the frozen fixture

    var childInsertions = 0;
    var childRemovals = 0;
    var parentWrites = 0;
    var nodeCount = 0;

    // Initial rows: "N\t<id>\t<parentId>\t<position>\t<hexLabel>\n"
    for (var i = 0; i < initialCount; i++) {
      _off += 2; // skip 'N' + '\t'
      final id = _readInt();
      _off++; // skip '\t'
      final parentId = _readInt();
      _off++; // skip '\t'
      final position = _readInt();
      _off++; // skip '\t'
      final labelOff = _off;
      _readHexSpanEnd();
      final labelHexLen = _off - labelOff;
      _skipLine();

      final node = _Node(id, labelOff, labelHexLen);
      _slots[id] = node;
      if (parentId != -1) {
        final parent = _slots[parentId]!;
        node.parent = parent;
        _insertAtPosition(parent, position, node);
        childInsertions++;
        parentWrites++;
      }
      nodeCount++;
    }

    var inserts = 0;
    var deletes = 0;
    var reparents = 0;

    while (_off < _end) {
      final tag = _fixture[_off];
      if (tag == 0x0a /* '\n' */) {
        _off++;
        continue;
      }
      _off += 2; // skip tag + '\t'
      if (tag == 0x49 /* 'I' */) {
        final id = _readInt();
        _off++;
        final parentId = _readInt();
        _off++;
        final position = _readInt();
        _off++;
        final labelOff = _off;
        _readHexSpanEnd();
        final labelHexLen = _off - labelOff;
        _skipLine();

        final parent = _slots[parentId]!;
        final node = _Node(id, labelOff, labelHexLen);
        node.parent = parent;
        _slots[id] = node;
        _insertAtPosition(parent, position, node);
        inserts++;
        childInsertions++;
        parentWrites++;
        nodeCount++;
      } else if (tag == 0x44 /* 'D' */) {
        final id = _readInt();
        _skipLine();
        final node = _slots[id]!;
        _spliceOut(node);
        node.parent = null;
        // Last strong reference dropped: the node object is now garbage.
        _slots[id] = null;
        deletes++;
        childRemovals++;
        parentWrites++;
        nodeCount--;
      } else if (tag == 0x52 /* 'R' */) {
        final id = _readInt();
        _off++;
        final parentId = _readInt();
        _off++;
        final position = _readInt();
        _skipLine();
        final node = _slots[id]!;
        final parent = _slots[parentId]!;
        _spliceOut(node);
        node.parent = parent;
        _insertAtPosition(parent, position, node);
        reparents++;
        childInsertions++;
        childRemovals++;
        parentWrites++;
      } else {
        _skipLine();
      }
    }

    _fnv = 0x811c9dc5;
    _dfsMix(_slots[0]!);

    out[0] = inserts;
    out[1] = deletes;
    out[2] = reparents;
    out[3] = nodeCount;
    out[4] = childInsertions;
    out[5] = childRemovals;
    out[6] = parentWrites;
    out[7] = _fnv;
    return nodeCount;
  }
}

void main() {
  dartKernels = createJSInteropWrapper(GcDocumentKernels());
}

@JS('dartKernels')
external set dartKernels(JSObject value);
