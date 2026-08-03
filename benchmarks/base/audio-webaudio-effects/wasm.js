import { CONTRACT, freezeObservations, IR } from "./workload.js";

function align(value, boundary = 16) {
  return Math.ceil(value / boundary) * boundary;
}

export function controlledMemoryLayout(frames, irLength = CONTRACT.irLength) {
  const outputFrames = frames + irLength - 1;
  const stateBytes = align(16 + irLength * 4);
  const leftIn = 0;
  const rightIn = align(leftIn + frames * 4);
  const ir = align(rightIn + frames * 4);
  const leftOut = align(ir + irLength * 4);
  const rightOut = align(leftOut + outputFrames * 4);
  const leftState = align(rightOut + outputFrames * 4);
  const rightState = leftState + stateBytes;
  const bytes = align(rightState + stateBytes);
  return { leftIn, rightIn, ir, leftOut, rightOut, leftState, rightState, bytes, outputFrames };
}

export function processWasm(instance, fixture, irValues = IR) {
  const memory = instance?.exports?.memory;
  const resetState = instance?.exports?.reset_state;
  const effectsBlock = instance?.exports?.effects_block;
  const flushTail = instance?.exports?.flush_tail;
  if (
    !(memory instanceof WebAssembly.Memory) || typeof resetState !== "function" ||
    typeof effectsBlock !== "function" || typeof flushTail !== "function"
  ) {
    throw new Error("audio effects Wasm exports are incomplete");
  }
  if (!(fixture?.left instanceof Float32Array) || !(fixture?.right instanceof Float32Array)) {
    throw new TypeError("stereo Float32Array fixture required");
  }
  if (fixture.left.length !== fixture.right.length) throw new Error("stereo length mismatch");
  if (!(irValues instanceof Float32Array) || irValues.length !== CONTRACT.irLength) {
    throw new Error("frozen impulse response required");
  }
  const layout = controlledMemoryLayout(fixture.left.length, irValues.length);
  if (layout.bytes > memory.buffer.byteLength) throw new Error("fixed Wasm memory is too small");
  new Float32Array(memory.buffer, layout.leftIn, fixture.left.length).set(fixture.left);
  new Float32Array(memory.buffer, layout.rightIn, fixture.right.length).set(fixture.right);
  new Float32Array(memory.buffer, layout.ir, irValues.length).set(irValues);

  const observed = {
    blocksPerChannel: [],
    blockInvocations: 0,
    stateCarryBoundaries: 0,
    tailFlushInvocations: 0,
    tailFlushFrames: 0,
    processingBoundaryCrossings: 0,
  };
  for (
    const [input, output, state] of [
      [layout.leftIn, layout.leftOut, layout.leftState],
      [layout.rightIn, layout.rightOut, layout.rightState],
    ]
  ) {
    resetState(state, irValues.length);
    let blocksForChannel = 0;
    for (let offset = 0; offset < fixture.left.length; offset += CONTRACT.blockFrames) {
      const frames = Math.min(CONTRACT.blockFrames, fixture.left.length - offset);
      if (blocksForChannel > 0) observed.stateCarryBoundaries++;
      effectsBlock(
        input + offset * 4,
        frames,
        layout.ir,
        irValues.length,
        output + offset * 4,
        state,
      );
      blocksForChannel++;
      observed.blockInvocations++;
      observed.processingBoundaryCrossings++;
    }
    observed.blocksPerChannel.push(blocksForChannel);
    flushTail(
      irValues.length - 1,
      layout.ir,
      irValues.length,
      output + fixture.left.length * 4,
      state,
    );
    observed.tailFlushInvocations++;
    observed.tailFlushFrames += irValues.length - 1;
    observed.processingBoundaryCrossings++;
  }
  return {
    left: new Float32Array(memory.buffer, layout.leftOut, layout.outputFrames).slice(),
    right: new Float32Array(memory.buffer, layout.rightOut, layout.outputFrames).slice(),
    observations: freezeObservations(observed),
  };
}
