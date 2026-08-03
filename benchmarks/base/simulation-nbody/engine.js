import {
  BODY_COUNT,
  CHECKPOINT_STEPS,
  COUNTERS,
  DT,
  ENERGY_RELATIVE_TOLERANCE,
  GRAVITY,
  INPUT_BYTES,
  INPUT_MAGIC,
  OUTPUT_BYTES,
  OUTPUT_HEADER_BYTES,
  OUTPUT_MAGIC,
  QUANTIZATION,
  SOFTENING_SQUARED,
  STATE_VALUES,
  TIMESTEPS,
  VARIANTS,
  WORKLOAD_ID,
} from "./contract.js";
import { generateFixture } from "./fixture.js";

const U64_FIELDS = [
  "forceEvaluations",
  "pairInteractions",
  "halfKicks",
  "positionUpdates",
  "accelerationWrites",
  "checkpointValues",
  "inputBytes",
  "outputBytes",
  "energyPairChecks",
  "kineticEnergyTerms",
];
function validateInput(input) {
  if (!(input instanceof Uint8Array) || input.byteLength !== INPUT_BYTES) {
    throw new Error("nbody fixture byte length mismatch");
  }
  const v = new DataView(input.buffer, input.byteOffset, input.byteLength);
  if (
    v.getUint32(0, true) !== INPUT_MAGIC || v.getUint32(4, true) !== 1 ||
    v.getUint32(8, true) !== BODY_COUNT || v.getUint32(12, true) !== TIMESTEPS
  ) throw new Error("nbody fixture identity mismatch");
}
function arraysFromInput(input) {
  const copied = input.slice();
  return {
    copied,
    arrays: Array.from(
      { length: 7 },
      (_, i) => new Float64Array(copied.buffer, 64 + i * BODY_COUNT * 8, BODY_COUNT),
    ),
  };
}
function accelerations(mass, px, py, pz, ax, ay, az) {
  for (let i = 0; i < BODY_COUNT; i++) {
    let sx = 0, sy = 0, sz = 0;
    const x = px[i], y = py[i], z = pz[i];
    for (let j = 0; j < BODY_COUNT; j++) {
      if (i === j) continue;
      const dx = px[j] - x, dy = py[j] - y, dz = pz[j] - z;
      const inv = 1 / Math.sqrt(dx * dx + dy * dy + dz * dz + SOFTENING_SQUARED);
      const scale = GRAVITY * mass[j] * inv * inv * inv;
      sx += dx * scale;
      sy += dy * scale;
      sz += dz * scale;
    }
    ax[i] = sx;
    ay[i] = sy;
    az[i] = sz;
  }
}
function energy(mass, px, py, pz, vx, vy, vz) {
  let kinetic = 0, potential = 0;
  for (let i = 0; i < BODY_COUNT; i++) {
    kinetic += 0.5 * mass[i] * (vx[i] * vx[i] + vy[i] * vy[i] + vz[i] * vz[i]);
    for (let j = i + 1; j < BODY_COUNT; j++) {
      const dx = px[j] - px[i], dy = py[j] - py[i], dz = pz[j] - pz[i];
      potential -= GRAVITY * mass[i] * mass[j] /
        Math.sqrt(dx * dx + dy * dy + dz * dz + SOFTENING_SQUARED);
    }
  }
  return kinetic + potential;
}
function writeState(output, offset, arrays) {
  const target = new Float64Array(output.buffer, output.byteOffset + offset, STATE_VALUES);
  let cursor = 0;
  for (const array of arrays) {
    target.set(array, cursor);
    cursor += BODY_COUNT;
  }
}
function simulate(input) {
  validateInput(input);
  const { arrays } = arraysFromInput(input);
  const [mass, px, py, pz, vx, vy, vz] = arrays;
  const ax = new Float64Array(BODY_COUNT),
    ay = new Float64Array(BODY_COUNT),
    az = new Float64Array(BODY_COUNT);
  const output = new Uint8Array(OUTPUT_BYTES);
  const header = new DataView(output.buffer);
  header.setUint32(0, OUTPUT_MAGIC, true);
  header.setUint32(4, 1, true);
  header.setUint32(8, BODY_COUNT, true);
  header.setUint32(12, TIMESTEPS, true);
  header.setUint32(16, CHECKPOINT_STEPS.length, true);
  let counterOffset = 24;
  for (const field of U64_FIELDS) {
    header.setBigUint64(counterOffset, BigInt(COUNTERS[field]), true);
    counterOffset += 8;
  }
  const initialEnergy = energy(mass, px, py, pz, vx, vy, vz);
  header.setFloat64(104, initialEnergy, true);
  accelerations(mass, px, py, pz, ax, ay, az);
  let checkpointIndex = 0;
  for (let step = 1; step <= TIMESTEPS; step++) {
    for (let i = 0; i < BODY_COUNT; i++) {
      vx[i] += ax[i] * DT * 0.5;
      vy[i] += ay[i] * DT * 0.5;
      vz[i] += az[i] * DT * 0.5;
      px[i] += vx[i] * DT;
      py[i] += vy[i] * DT;
      pz[i] += vz[i] * DT;
    }
    accelerations(mass, px, py, pz, ax, ay, az);
    for (let i = 0; i < BODY_COUNT; i++) {
      vx[i] += ax[i] * DT * 0.5;
      vy[i] += ay[i] * DT * 0.5;
      vz[i] += az[i] * DT * 0.5;
    }
    if (step === CHECKPOINT_STEPS[checkpointIndex]) {
      writeState(output, OUTPUT_HEADER_BYTES + STATE_VALUES * 8 * (1 + checkpointIndex), [
        px,
        py,
        pz,
        vx,
        vy,
        vz,
      ]);
      checkpointIndex++;
    }
  }
  writeState(output, OUTPUT_HEADER_BYTES, [px, py, pz, vx, vy, vz]);
  const finalEnergy = energy(mass, px, py, pz, vx, vy, vz);
  header.setFloat64(112, finalEnergy, true);
  header.setFloat64(120, Math.abs((finalEnergy - initialEnergy) / initialEnergy), true);
  return output;
}
function fnv64(bytes) {
  let h = 0xcbf29ce484222325n;
  for (const b of bytes) {
    h ^= BigInt(b);
    h = BigInt.asUintN(64, h * 0x100000001b3n);
  }
  return h.toString(16).padStart(16, "0");
}
function quantizedDigest(output) {
  const values = new Float64Array(
    output.buffer,
    output.byteOffset + OUTPUT_HEADER_BYTES,
    (output.byteLength - OUTPUT_HEADER_BYTES) / 8,
  );
  const encoded = new Uint8Array(values.length * 8);
  const view = new DataView(encoded.buffer);
  for (let i = 0; i < values.length; i++) {
    view.setBigInt64(i * 8, BigInt(Math.trunc(values[i] / QUANTIZATION)), true);
  }
  return fnv64(encoded);
}
export function decodeResult(output, variantId) {
  if (!(output instanceof Uint8Array) || output.byteLength !== OUTPUT_BYTES) {
    throw new Error("nbody output byte length mismatch");
  }
  const h = new DataView(output.buffer, output.byteOffset, output.byteLength);
  if (h.getUint32(0, true) !== OUTPUT_MAGIC || h.getUint32(4, true) !== 1) {
    throw new Error("nbody output identity mismatch");
  }
  const counters = { bodies: BODY_COUNT, timesteps: TIMESTEPS };
  let offset = 24;
  for (const field of U64_FIELDS) {
    counters[field] = Number(h.getBigUint64(offset, true));
    offset += 8;
  }
  const energy = {
    initial: h.getFloat64(104, true),
    final: h.getFloat64(112, true),
    relativeDrift: h.getFloat64(120, true),
    tolerance: ENERGY_RELATIVE_TOLERANCE,
  };
  if (!Number.isFinite(energy.relativeDrift) || energy.relativeDrift > ENERGY_RELATIVE_TOLERANCE) {
    throw new Error("nbody energy envelope exceeded");
  }
  return {
    workloadId: WORKLOAD_ID,
    variantId,
    output,
    completeOutputDigest: fnv64(output),
    quantizedStateDigest: quantizedDigest(output),
    energy,
    counters: {
      ...counters,
      allocations: variantId === "js-controlled" ? 5 : 0,
      boundaryCrossings: variantId === "js-controlled" ? 0 : 2,
    },
    checkpoints: CHECKPOINT_STEPS.slice(),
  };
}
export function runJavaScript(input = generateFixture()) {
  return decodeResult(simulate(input), "js-controlled");
}
export async function instantiateNbodyWasm(bytes) {
  const { instance } = await WebAssembly.instantiate(bytes, {});
  return instance.exports;
}
export function runWasm(exports, input = generateFixture()) {
  validateInput(input);
  const memory = exports.memory;
  const inputPtr = exports.input_ptr();
  const outputPtr = exports.output_ptr();
  new Uint8Array(memory.buffer, inputPtr, INPUT_BYTES).set(input);
  const written = exports.run();
  if (written !== OUTPUT_BYTES) throw new Error("nbody Wasm output length mismatch");
  return decodeResult(
    new Uint8Array(memory.buffer, outputPtr, OUTPUT_BYTES).slice(),
    "wasm-linear-controlled",
  );
}
export function assertEquivalent(a, b, tolerance = 1e-12) {
  const av = new Float64Array(
    a.output.buffer,
    a.output.byteOffset + OUTPUT_HEADER_BYTES,
    (OUTPUT_BYTES - OUTPUT_HEADER_BYTES) / 8,
  );
  const bv = new Float64Array(
    b.output.buffer,
    b.output.byteOffset + OUTPUT_HEADER_BYTES,
    av.length,
  );
  let maxAbs = 0;
  for (let i = 0; i < av.length; i++) {
    const d = Math.abs(av[i] - bv[i]);
    if (!Number.isFinite(d)) throw new Error(`non-finite difference at ${i}`);
    maxAbs = Math.max(maxAbs, d);
  }
  if (maxAbs > tolerance || a.quantizedStateDigest !== b.quantizedStateDigest) {
    throw new Error(`nbody target mismatch: ${maxAbs}`);
  }
  return { maxAbsoluteDifference: maxAbs, tolerance, quantizedStateDigest: a.quantizedStateDigest };
}
export function runSmallJavaScript(
  parts,
  steps,
  dt = DT,
  gravity = GRAVITY,
  softeningSquared = SOFTENING_SQUARED,
) {
  const count = parts[0].length;
  if (
    count < 2 || count > 16 || !Number.isSafeInteger(steps) || steps < 0 || steps > 8 ||
    parts.length !== 7 || parts.some((part) => part.length !== count)
  ) throw new Error("invalid small nbody system");
  const [mass, px, py, pz, vx, vy, vz] = parts.map((part) => Float64Array.from(part));
  const ax = new Float64Array(count), ay = new Float64Array(count), az = new Float64Array(count);
  const accelerate = () => {
    for (let i = 0; i < count; i++) {
      let sx = 0, sy = 0, sz = 0;
      for (let j = 0; j < count; j++) {
        if (i !== j) {
          const dx = px[j] - px[i], dy = py[j] - py[i], dz = pz[j] - pz[i];
          const inv = 1 / Math.sqrt(dx * dx + dy * dy + dz * dz + softeningSquared);
          const scale = gravity * mass[j] * inv * inv * inv;
          sx += dx * scale;
          sy += dy * scale;
          sz += dz * scale;
        }
      }
      ax[i] = sx;
      ay[i] = sy;
      az[i] = sz;
    }
  };
  accelerate();
  for (let step = 0; step < steps; step++) {
    for (let i = 0; i < count; i++) {
      vx[i] += ax[i] * dt * 0.5;
      vy[i] += ay[i] * dt * 0.5;
      vz[i] += az[i] * dt * 0.5;
      px[i] += vx[i] * dt;
      py[i] += vy[i] * dt;
      pz[i] += vz[i] * dt;
    }
    accelerate();
    for (let i = 0; i < count; i++) {
      vx[i] += ax[i] * dt * 0.5;
      vy[i] += ay[i] * dt * 0.5;
      vz[i] += az[i] * dt * 0.5;
    }
  }
  return [px, py, pz, vx, vy, vz];
}
export function runSmallWasm(
  exports,
  parts,
  steps,
  dt = DT,
  gravity = GRAVITY,
  softeningSquared = SOFTENING_SQUARED,
) {
  const count = parts[0].length;
  const input = new Float64Array(exports.memory.buffer, exports.input_ptr(), count * 7);
  let cursor = 0;
  for (const part of parts) {
    input.set(part, cursor);
    cursor += count;
  }
  const bytes = exports.run_small(count, steps, dt, gravity, softeningSquared);
  if (bytes !== count * 6 * 8) throw new Error("small Wasm run failed");
  const output = new Float64Array(exports.memory.buffer, exports.output_ptr(), count * 6).slice();
  return Array.from({ length: 6 }, (_, index) => output.slice(index * count, (index + 1) * count));
}
export { simulate as runControlledCore, VARIANTS };
