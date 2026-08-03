export const WORKLOAD_ID = "simulation.nbody-cloth.v1";
export const VARIANTS = ["js-controlled", "wasm-linear-controlled"];
export const BODY_COUNT = 1024;
export const TIMESTEPS = 120;
export const SEED = 0x31c0ffee;
export const DT = 0.01;
export const GRAVITY = 0.0001;
export const SOFTENING_SQUARED = 0.0001;
export const CHECKPOINT_STEPS = [1, 30, 60, 90, 120];
export const QUANTIZATION = 1e-9;
export const ENERGY_RELATIVE_TOLERANCE = 1.2e-6;
export const INPUT_HEADER_BYTES = 64;
export const INPUT_BYTES = INPUT_HEADER_BYTES + BODY_COUNT * 7 * 8;
export const OUTPUT_HEADER_BYTES = 128;
export const STATE_VALUES = BODY_COUNT * 6;
export const OUTPUT_BYTES = OUTPUT_HEADER_BYTES + STATE_VALUES * 8 * (1 + CHECKPOINT_STEPS.length);
export const INPUT_MAGIC = 0x3144424e;
export const OUTPUT_MAGIC = 0x314f424e;
export const FORCE_EVALUATIONS = TIMESTEPS + 1;
export const PAIR_INTERACTIONS = FORCE_EVALUATIONS * BODY_COUNT * (BODY_COUNT - 1);
export const COUNTERS = Object.freeze({
  bodies: BODY_COUNT,
  timesteps: TIMESTEPS,
  forceEvaluations: FORCE_EVALUATIONS,
  pairInteractions: PAIR_INTERACTIONS,
  halfKicks: TIMESTEPS * BODY_COUNT * 2,
  positionUpdates: TIMESTEPS * BODY_COUNT,
  accelerationWrites: FORCE_EVALUATIONS * BODY_COUNT * 3,
  checkpointValues: CHECKPOINT_STEPS.length * STATE_VALUES,
  energyPairChecks: BODY_COUNT * (BODY_COUNT - 1),
  kineticEnergyTerms: BODY_COUNT * 2,
  inputBytes: INPUT_BYTES,
  outputBytes: OUTPUT_BYTES,
});
