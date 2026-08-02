export const INPUT_LENGTH = 65_536;
export const INPUT_SEED = 0x6d2b79f5;

export function generateInput(length = INPUT_LENGTH, seed = INPUT_SEED) {
  if (!Number.isSafeInteger(length) || length < 1) throw new Error("invalid input length");
  let state = seed >>> 0;
  const input = new Uint32Array(length);
  for (let index = 0; index < input.length; index += 1) {
    state ^= state << 13;
    state ^= state >>> 17;
    state ^= state << 5;
    input[index] = state >>> 0;
  }
  return input;
}

export function sumU32(input) {
  let sum = 0;
  for (let index = 0; index < input.length; index += 1) {
    sum = (sum + input[index]) >>> 0;
  }
  return sum;
}
