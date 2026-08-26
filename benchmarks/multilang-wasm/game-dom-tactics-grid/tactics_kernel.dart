// game-dom-tactics-grid Dart WasmGC kernel — exact mirror of tactics_kernel.c.
//
// The 60-turn / 240-action tactics loop over the frozen 7,064-byte fixture:
// BFS pathfinding on a 64x64 grid, Bresenham line-of-sight, and the seven
// per-quarter-turn digests. It must land on the same eight digests and five
// counters as the C, C++, Rust and AssemblyScript kernels, which the runner
// checks before any engine is timed.
//
// Two differences from the linear-memory kernels, both mechanical:
//
//  - There is no shared linear memory to read the fixture from, so it arrives
//    as a zero-copy Uint8List view and the results go back through a Uint32List
//    rather than being written at a fixed offset.
//  - Dart ints are 64-bit. Every u32 operation the C performs modulo 2^32 —
//    the FNV mix in particular, whose multiply overflows on nearly every call —
//    is masked explicitly. An unmasked mix diverges on the first action and
//    every digest after it.

import 'dart:js_interop';
import 'dart:typed_data';

const int _gridCells = 4096;
const int _units = 128;
const int _actions = 240;
const int _fixtureBytes = 7064;
const int _mapOffset = 24;
const int _u32 = 0xFFFFFFFF;

@JSExport()
class TacticsKernels {
  final Uint16List _queue = Uint16List(_gridCells);
  final Uint16List _seen = Uint16List(_gridCells);
  final Int16List _parent = Int16List(_gridCells);
  final Int16List _occupancy = Int16List(_gridCells);
  final Uint8List _hp = Uint8List(_units);
  final Uint8List _team = Uint8List(_units);
  final Uint16List _position = Uint16List(_units);

  late Uint8List _fixture;
  int _stamp = 0;
  int _state = 0;
  int _expanded = 0;
  int _los = 0;

  int _read16(int at) => _fixture[at] | (_fixture[at + 1] << 8);
  int _read32(int at) => _read16(at) | (_read16(at + 2) << 16);

  /// FNV-1a step, wrapped to 32 bits. The multiply overflows a 32-bit word on
  /// nearly every call, so the mask is the whole point.
  int _mix(int h, int v) => ((h ^ v) * 16777619) & _u32;

  bool _path(int start, int goal) {
    _stamp = (_stamp + 1) & 0xFFFF;
    var head = 0, tail = 1;
    _queue[0] = start;
    _seen[start] = _stamp;
    _parent[start] = -1;
    while (head < tail) {
      final node = _queue[head++];
      _expanded++;
      if (node == goal) break;
      final x = node & 63, y = node >> 6;
      // Same four candidates in the same order: up, left, right, down.
      for (var i = 0; i < 4; i++) {
        int next;
        switch (i) {
          case 0:
            next = y > 0 ? node - 64 : -1;
            break;
          case 1:
            next = x > 0 ? node - 1 : -1;
            break;
          case 2:
            next = x < 63 ? node + 1 : -1;
            break;
          default:
            next = y < 63 ? node + 64 : -1;
        }
        if (next < 0) continue;
        if (_seen[next] == _stamp ||
            _fixture[_mapOffset + next] == 3 ||
            (_occupancy[next] >= 0 && next != goal)) continue;
        _seen[next] = _stamp;
        _parent[next] = node;
        _queue[tail++] = next;
      }
    }
    if (_seen[goal] != _stamp) return false;
    var node = goal;
    while (node >= 0) {
      _state = _mix(_state, node);
      node = _parent[node];
    }
    return true;
  }

  bool _visible(int start, int goal) {
    var x0 = start & 63, y0 = start >> 6;
    final x1 = goal & 63, y1 = goal >> 6;
    final dx = (x1 - x0).abs(), sx = x0 < x1 ? 1 : -1;
    final dy = -((y1 - y0).abs()), sy = y0 < y1 ? 1 : -1;
    var error = dx + dy;
    for (;;) {
      _los++;
      final node = x0 + y0 * 64;
      if (node != start && node != goal && _fixture[_mapOffset + node] == 3) {
        return false;
      }
      if (x0 == x1 && y0 == y1) return true;
      final twice = 2 * error;
      if (twice >= dy) {
        error += dy;
        x0 += sx;
      }
      if (twice <= dx) {
        error += dx;
        y0 += sy;
      }
    }
  }

  @JSExport('tactics_trace')
  int tactics_trace(JSUint8Array fixtureJs, JSUint32Array resultsJs, int fixtureLen) {
    _fixture = fixtureJs.toDart;
    final results = resultsJs.toDart;
    if (fixtureLen != _fixtureBytes) return 1;
    if (_read32(0) != 64 || _read32(8) != 128) return 2;

    for (var cell = 0; cell < _gridCells; cell++) {
      _seen[cell] = 0;
      _occupancy[cell] = -1;
    }

    final unitOffset = _mapOffset + _gridCells;
    final actionOffset = unitOffset + _units * 8;

    for (var unit = 0; unit < _units; unit++) {
      final at = unitOffset + unit * 8;
      _position[unit] = _read16(at) + _read16(at + 2) * 64;
      _hp[unit] = _fixture[at + 4];
      _team[unit] = _fixture[at + 5] & 1;
      if (_occupancy[_position[unit]] < 0) _occupancy[_position[unit]] = unit;
    }

    _stamp = 0;
    _state = 0x5d7219af;
    _expanded = 0;
    _los = 0;
    var turns = 0, updates = 0, mutations = 0;
    var selected = _position[0], focused = selected, initiative = 0;

    var finalUnit = 0, finalOccupancy = 0, finalInitiative = 0, finalObjective = 0;
    var finalDom = 0, finalFocus = 0, finalAccessibility = 0;

    for (var action = 0; action < _actions; action++) {
      final at = actionOffset + action * 8;
      final type = _fixture[at], unit = _fixture[at + 1];
      final from = _read16(at + 2);
      final target = _read16(at + 4);
      final turnId = _read16(at + 6);

      if (action % 4 == 0) {
        turns++;
        initiative = (turnId * 7) & 127;
        mutations++;
      }
      if (type == 0) {
        selected = _position[unit];
        focused = selected;
        updates++;
        mutations += 2;
      }
      if (type == 1 &&
          _path(_position[unit], target) &&
          (_occupancy[target] < 0 || _occupancy[target] == unit)) {
        if (_occupancy[_position[unit]] == unit) _occupancy[_position[unit]] = -1;
        _position[unit] = target;
        _occupancy[target] = unit;
        selected = target;
        focused = target;
        updates++;
        mutations += 3;
      }
      if ((type == 2 || type == 4) && _visible(from, target)) {
        final targetUnit = _occupancy[target];
        if (targetUnit >= 0) {
          final damage = type == 4 ? 3 : 1;
          _hp[targetUnit] = _hp[targetUnit] > damage ? _hp[targetUnit] - damage : 0;
          updates++;
          mutations++;
        }
      }
      if (type == 3) {
        initiative = (initiative + 1) & 127;
        mutations++;
      }
      _state = _mix(
        _state,
        type ^ unit ^ _hp[unit] ^ _position[unit] ^ selected ^ turnId,
      );

      if ((action + 1) % 4 == 0) {
        var unitDigest = 0x9216d5d9;
        var occupancyDigest = 0x8979fb1b;
        var initiativeDigest = _mix(0xd1310ba6, initiative);
        var objectiveDigest = 0x98dfb5ac;
        var domDigest = 0x2ffd72db;
        final focusDigest = _mix(0xd01adfb7, focused);
        var accessibilityDigest = 0xb8e1afed;
        var objectives0 = 0, objectives1 = 0;
        for (var i = 0; i < _units; i++) {
          unitDigest = _mix(
            _mix(_mix(unitDigest, i), _position[i]),
            _hp[i] ^ (_team[i] << 8),
          );
          initiativeDigest = _mix(initiativeDigest, (i + initiative) & 127);
          if (_fixture[_mapOffset + _position[i]] == 2 && _hp[i] > 0) {
            if (_team[i] != 0) {
              objectives1++;
            } else {
              objectives0++;
            }
          }
        }
        objectiveDigest = _mix(_mix(objectiveDigest, objectives0), objectives1);
        for (var cell = 0; cell < _gridCells; cell++) {
          final occupant = _occupancy[cell];
          final isSelected = cell == selected ? 1 : 0;
          final isFocused = cell == focused ? 1 : 0;
          occupancyDigest = _mix(
            occupancyDigest,
            occupant < 0 ? 0xffffffff : occupant,
          );
          domDigest = _mix(
            _mix(_mix(domDigest, cell), _fixture[_mapOffset + cell]),
            (occupant + 1) ^ (isSelected << 16) ^ (isFocused << 17),
          );
          final unitState =
              occupant < 0 ? 0 : (_hp[occupant] ^ (_team[occupant] << 8));
          accessibilityDigest = _mix(
            _mix(accessibilityDigest, 0x67726964),
            isSelected ^ (isFocused << 1) ^ (unitState << 2),
          );
        }

        _state = _mix(_state, unitDigest);
        _state = _mix(_state, occupancyDigest);
        _state = _mix(_state, initiativeDigest);
        _state = _mix(_state, objectiveDigest);
        _state = _mix(_state, domDigest);
        _state = _mix(_state, focusDigest);
        _state = _mix(_state, accessibilityDigest);
        mutations += 2;

        finalUnit = unitDigest;
        finalOccupancy = occupancyDigest;
        finalInitiative = initiativeDigest;
        finalObjective = objectiveDigest;
        finalDom = domDigest;
        finalFocus = focusDigest;
        finalAccessibility = accessibilityDigest;
      }
    }

    results[0] = _state;
    results[1] = finalUnit;
    results[2] = finalOccupancy;
    results[3] = finalInitiative;
    results[4] = finalObjective;
    results[5] = finalDom;
    results[6] = finalFocus;
    results[7] = finalAccessibility;
    results[8] = turns;
    results[9] = _expanded;
    results[10] = _los;
    results[11] = updates;
    results[12] = mutations;
    return 0;
  }
}

void main() {
  dartKernels = createJSInteropWrapper(TacticsKernels());
}

@JS('dartKernels')
external set dartKernels(JSObject value);
