import { CONTRACT, IR } from "./workload.js";

function align(value, boundary = 16) {
  return Math.ceil(value / boundary) * boundary;
}

export function controlledMemoryLayout(frames, irLength = CONTRACT.irLength) {
  const outputFrames = frames + irLength - 1;
  const leftIn = 0;
  const rightIn = align(leftIn + frames * 4);
  const ir = align(rightIn + frames * 4);
  const leftOut = align(ir + irLength * 4);
  const rightOut = align(leftOut + outputFrames * 4);
  const history = align(rightOut + outputFrames * 4);
  const bytes = align(history + irLength * 8);
  return { leftIn, rightIn, ir, leftOut, rightOut, history, bytes, outputFrames };
}

export function processWasm(instance, fixture, irValues = IR) {
  const memory = instance?.exports?.memory;
  const effects = instance?.exports?.effects_chain;
  if (!(memory instanceof WebAssembly.Memory) || typeof effects !== "function") {
    throw new Error("audio effects Wasm exports are incomplete");
  }
  if (!(fixture?.left instanceof Float32Array) || !(fixture?.right instanceof Float32Array)) {
    throw new TypeError("stereo Float32Array fixture required");
  }
  if (fixture.left.length !== fixture.right.length) throw new Error("stereo length mismatch");
  const layout = controlledMemoryLayout(fixture.left.length, irValues.length);
  if (layout.bytes > memory.buffer.byteLength) throw new Error("fixed Wasm memory is too small");
  new Float32Array(memory.buffer, layout.leftIn, fixture.left.length).set(fixture.left);
  new Float32Array(memory.buffer, layout.rightIn, fixture.right.length).set(fixture.right);
  new Float32Array(memory.buffer, layout.ir, irValues.length).set(irValues);
  effects(
    layout.leftIn,
    layout.rightIn,
    fixture.left.length,
    layout.ir,
    irValues.length,
    layout.leftOut,
    layout.rightOut,
    layout.history,
  );
  return {
    left: new Float32Array(memory.buffer, layout.leftOut, layout.outputFrames).slice(),
    right: new Float32Array(memory.buffer, layout.rightOut, layout.outputFrames).slice(),
  };
}
