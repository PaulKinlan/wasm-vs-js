// game-ecs-frame-update Dart WasmGC kernel — exact mirror of the C kernel and
// benchmarks/v1 engine.js runEcsJavaScript: per-frame control velocity deltas,
// movement with wall bounce, 128x128 spatial-grid collision, animation
// speed-class update, FNV-1a canonical state + checkpoint digests, full counter
// set. Dart has native ints, so the integer machinery mirrors C exactly
// (32-bit masking where the C semantics wrap); the f32-free integer code means
// no fround emulation is needed — this workload's cost is the grid collision +
// hashing, not float emulation. The result layout is identical to the linear
// kernels: [0]=state digest, [1]=checkpoint digest, [16..28]=counters.

import 'dart:js_interop';
import 'dart:typed_data';

const int MAX_ENTITIES = 10000;
const int MAX_FRAMES = 1000;
const int GRID_WIDTH = 128;
const int GRID_CELLS = GRID_WIDTH * GRID_WIDTH;
const int CELL_SHIFT = 9;
const int CHECKPOINT_INTERVAL = 100;
const int RESULT_STATE_OFFSET = 128;
const int ECS_MAGIC = 0x31435345;
const int PRIME = 16777619;
const int U32 = 0xFFFFFFFF;

int mix(int hash, int value) => ((hash ^ value) & U32) * PRIME & U32;

int clampVelocity(int value) => value < -16 ? -16 : (value > 16 ? 16 : value);

int controlDelta(int bits) => bits == 3 ? 0 : bits - 1;

@JSExport()
class EcsKernels {
  final List<int> xs = List.filled(MAX_ENTITIES, 0);
  final List<int> ys = List.filled(MAX_ENTITIES, 0);
  final List<int> vxs = List.filled(MAX_ENTITIES, 0);
  final List<int> vys = List.filled(MAX_ENTITIES, 0);
  final List<int> anims = List.filled(MAX_ENTITIES, 0);
  final List<int> radii = List.filled(MAX_ENTITIES, 0);
  final List<int> heads = List.filled(GRID_CELLS, 0);
  final List<int> next = List.filled(MAX_ENTITIES, 0);
  int pairTests = 0;
  int collisions = 0;
  int stateMutations = 0;

  int canonicalState(int entities, bool writeState, Uint32List result) {
    var digest = 0x7f4a7c15 & U32;
    for (var entity = 0; entity < entities; entity++) {
      final values = <int>[
        xs[entity],
        ys[entity],
        vxs[entity] & 0xff,
        vys[entity] & 0xff,
        anims[entity],
        radii[entity],
      ];
      digest = mix(digest, entity);
      for (var item = 0; item < 6; item++) {
        digest = mix(digest, values[item]);
        if (writeState) {
          result[RESULT_STATE_OFFSET + entity * 6 + item] = values[item];
        }
      }
    }
    return digest;
  }

  void processPair(int left, int right) {
    pairTests++;
    final reach = radii[left] + radii[right];
    final dx = xs[left] - xs[right];
    final dy = ys[left] - ys[right];
    if (dx < -reach || dx > reach || dy < -reach || dy > reach) return;
    final leftVx = vxs[left], leftVy = vys[left];
    vxs[left] = vxs[right];
    vys[left] = vys[right];
    vxs[right] = leftVx;
    vys[right] = leftVy;
    collisions++;
    stateMutations += 4;
  }

  void processCrossCells(int leftCell, int rightCell) {
    var left = heads[leftCell];
    while (left >= 0) {
      var right = heads[rightCell];
      while (right >= 0) {
        processPair(left, right);
        right = next[right];
      }
      left = next[left];
    }
  }

  int run_(Uint8List input, Uint32List result) {
    final len = input.length;
    if (len < 16 || len > 82000) return 1;
    int read32(int at) =>
        input[at] | (input[at + 1] << 8) | (input[at + 2] << 16) | (input[at + 3] << 24);
    if (read32(0) != ECS_MAGIC) return 1;
    final entities = read32(4);
    final frames = read32(8);
    if (entities < 2 || entities > MAX_ENTITIES || frames < 1 || frames > MAX_FRAMES) return 2;
    if (len != 16 + entities * 8 + frames) return 3;
    for (var i = 0; i < result.length; i++) {
      result[i] = 0;
    }
    var offset = 16;
    for (var entity = 0; entity < entities; entity++) {
      xs[entity] = input[offset] | (input[offset + 1] << 8);
      ys[entity] = input[offset + 2] | (input[offset + 3] << 8);
      vxs[entity] = input[offset + 4].toSigned(8);
      vys[entity] = input[offset + 5].toSigned(8);
      anims[entity] = input[offset + 6];
      radii[entity] = input[offset + 7];
      offset += 8;
    }
    final traceOffset = 16 + entities * 8;
    var movementUpdates = 0;
    var controlMutations = 0;
    var animationUpdates = 0;
    var checkpointCount = 0;
    var checkpointDigest = 0x5f356495 & U32;
    pairTests = 0;
    collisions = 0;
    stateMutations = 0;
    for (var frame = 0; frame < frames; frame++) {
      final control = input[traceOffset + frame];
      final selectedRemainder = frame % 257;
      final controlX = controlDelta(control & 3);
      final controlY = controlDelta((control >> 2) & 3);
      for (var entity = 0; entity < entities; entity++) {
        if (entity % 257 == selectedRemainder) {
          vxs[entity] = clampVelocity(vxs[entity] + controlX);
          vys[entity] = clampVelocity(vys[entity] + controlY);
          controlMutations += 2;
          stateMutations += 2;
        }
        var x = xs[entity] + vxs[entity];
        var y = ys[entity] + vys[entity];
        if (x < 0) {
          x = -x;
          vxs[entity] = -vxs[entity];
          stateMutations += 1;
        } else if (x > 0xffff) {
          x = 0x1fffe - x;
          vxs[entity] = -vxs[entity];
          stateMutations += 1;
        }
        if (y < 0) {
          y = -y;
          vys[entity] = -vys[entity];
          stateMutations += 1;
        } else if (y > 0xffff) {
          y = 0x1fffe - y;
          vys[entity] = -vys[entity];
          stateMutations += 1;
        }
        xs[entity] = x & 0xffff;
        ys[entity] = y & 0xffff;
        movementUpdates += 1;
        stateMutations += 2;
      }
      for (var cell = 0; cell < GRID_CELLS; cell++) {
        heads[cell] = -1;
      }
      for (var entity = 0; entity < entities; entity++) {
        final cell = (ys[entity] >> CELL_SHIFT) * GRID_WIDTH + (xs[entity] >> CELL_SHIFT);
        next[entity] = heads[cell];
        heads[cell] = entity;
      }
      for (var cellY = 0; cellY < GRID_WIDTH; cellY++) {
        for (var cellX = 0; cellX < GRID_WIDTH; cellX++) {
          final cell = cellY * GRID_WIDTH + cellX;
          var left = heads[cell];
          while (left >= 0) {
            var right = next[left];
            while (right >= 0) {
              processPair(left, right);
              right = next[right];
            }
            left = next[left];
          }
          if (cellX + 1 < GRID_WIDTH) processCrossCells(cell, cell + 1);
          if (cellY + 1 < GRID_WIDTH && cellX > 0) {
            processCrossCells(cell, cell + GRID_WIDTH - 1);
          }
          if (cellY + 1 < GRID_WIDTH) processCrossCells(cell, cell + GRID_WIDTH);
          if (cellY + 1 < GRID_WIDTH && cellX + 1 < GRID_WIDTH) {
            processCrossCells(cell, cell + GRID_WIDTH + 1);
          }
        }
      }
      final controlAnimation = (control >> 4) & 1;
      for (var entity = 0; entity < entities; entity++) {
        final speedClass = (vxs[entity].abs() + vys[entity].abs()) & 3;
        anims[entity] = (anims[entity] + 1 + speedClass + controlAnimation) & 0xff;
        animationUpdates += 1;
        stateMutations += 1;
      }
      if ((frame + 1) % CHECKPOINT_INTERVAL == 0 || frame + 1 == frames) {
        final stateDigest = canonicalState(entities, false, result);
        final at = 64 + checkpointCount * 3;
        result[at] = frame + 1;
        result[at + 1] = stateDigest;
        result[at + 2] = pairTests;
        result[29 + checkpointCount] = collisions;
        checkpointDigest = mix(checkpointDigest, frame + 1);
        checkpointDigest = mix(checkpointDigest, stateDigest);
        checkpointDigest = mix(checkpointDigest, pairTests);
        checkpointCount += 1;
      }
    }
    result[0] = canonicalState(entities, true, result);
    result[1] = checkpointDigest;
    result[16] = frames;
    result[17] = entities;
    result[18] = frames * 3;
    result[19] = movementUpdates;
    result[20] = frames * GRID_CELLS;
    result[21] = frames * GRID_CELLS * 5;
    result[22] = frames * entities;
    result[23] = pairTests;
    result[24] = collisions;
    result[25] = animationUpdates;
    result[26] = checkpointCount;
    result[27] = controlMutations;
    result[28] = stateMutations;
    return 0;
  }

  void run(JSUint8Array fixtureJs, JSUint32Array resultJs) {
    final fixture = fixtureJs.toDart; // zero-copy Uint8List view
    final result = resultJs.toDart; // zero-copy Uint32List view
    run_(fixture, result);
  }
}

void main() {
  dartKernels = createJSInteropWrapper(EcsKernels());
}

@JS('dartKernels')
external set dartKernels(JSObject value);
