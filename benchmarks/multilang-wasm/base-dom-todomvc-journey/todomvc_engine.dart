// TodoMVC 100-item state machine Dart WasmGC kernel — exact mirror of the C
// todomvc_engine.c / engine.js: same validation guards, same counters, same
// typed-command emission. Input is the frozen 150-action trace (4 i32 fields
// per action, little-endian) passed as a byte view; commands and the
// flags/versions/filter state are written to caller-provided byte views.

import 'dart:js_interop';
import 'dart:typed_data';

const TODO_COUNT = 100;

@JSExport()
class TodoEngineKernels {
  int actions = 0;
  int adds = 0;
  int toggles = 0;
  int filters = 0;
  int removes = 0;
  int edits = 0;
  int stateWrites = 0;
  int commandsEmitted = 0;

  bool _alive(Uint8List state, int id) => (state[id] & 1) != 0;

  bool _apply(Uint8List state, int opcode, int id, int value, int focus, ByteData out, int outOff) {
    if (id >= TODO_COUNT || focus > 1) return false;
    if (opcode == 1) {
      // ADD
      if (_alive(state, id)) return false;
      state[id] = 1;
      state[100 + id] = 0;
      adds++;
      stateWrites += 2;
    } else if (opcode == 2) {
      // TOGGLE
      if (!_alive(state, id)) return false;
      state[id] ^= 2;
      toggles++;
      stateWrites++;
    } else if (opcode == 3) {
      // FILTER
      if (value > 2) return false;
      state[200] = value;
      filters++;
      stateWrites++;
    } else if (opcode == 4) {
      // EDIT
      if (!_alive(state, id) || value != 1) return false;
      state[100 + id] = value;
      edits++;
      stateWrites++;
    } else if (opcode == 5) {
      // REMOVE
      if (!_alive(state, id)) return false;
      state[id] = 0;
      removes++;
      stateWrites++;
    } else {
      return false;
    }
    out.setInt32(outOff, opcode, Endian.little);
    out.setInt32(outOff + 4, id, Endian.little);
    out.setInt32(outOff + 8, value, Endian.little);
    out.setInt32(outOff + 12, focus, Endian.little);
    actions++;
    commandsEmitted++;
    return true;
  }

  @JSExport('run')
  int run(
    JSUint8Array inputJs,
    int count,
    JSUint8Array commandsJs,
    JSUint8Array stateJs,
  ) {
    final input = inputJs.toDart; // zero-copy byte view on the Int32Array
    final commands = commandsJs.toDart;
    final state = stateJs.toDart;
    if (count > 150) return -1;
    final inputData = ByteData.sublistView(input);
    final outData = ByteData.sublistView(commands);
    actions = adds = toggles = filters = removes = edits = 0;
    stateWrites = commandsEmitted = 0;
    for (var i = 0; i < 201; i++) {
      state[i] = 0;
    }
    for (var i = 0; i < count; i++) {
      final base = i * 16;
      final ok = _apply(
        state,
        inputData.getInt32(base, Endian.little),
        inputData.getInt32(base + 4, Endian.little),
        inputData.getInt32(base + 8, Endian.little),
        inputData.getInt32(base + 12, Endian.little),
        outData,
        base,
      );
      if (!ok) return -1;
    }
    return count;
  }

  @JSExport('counter_actions')
  int getCounterActions() => actions;
  @JSExport('counter_adds')
  int getCounterAdds() => adds;
  @JSExport('counter_toggles')
  int getCounterToggles() => toggles;
  @JSExport('counter_filters')
  int getCounterFilters() => filters;
  @JSExport('counter_removes')
  int getCounterRemoves() => removes;
  @JSExport('counter_edits')
  int getCounterEdits() => edits;
  @JSExport('counter_state_writes')
  int getCounterStateWrites() => stateWrites;
  @JSExport('counter_commands_emitted')
  int getCounterCommandsEmitted() => commandsEmitted;
}

void main() {
  dartKernels = createJSInteropWrapper(TodoEngineKernels());
}

@JS('dartKernels')
external set dartKernels(JSObject value);
