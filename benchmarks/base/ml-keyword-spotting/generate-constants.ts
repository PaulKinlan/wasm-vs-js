export function generateKeywordSpottingConstants() {
  const fftSize = 512;
  const windowQ15 = Array.from(
    { length: 320 },
    (_, index) =>
      Math.round(
        (0.5 - 0.5 * Math.cos((2 * Math.PI * index) / 319)) * 32767,
      ),
  );
  const twiddleRealQ15 = Array.from(
    { length: fftSize / 2 },
    (_, index) => Math.round(Math.cos((-2 * Math.PI * index) / fftSize) * 32767),
  );
  const twiddleImagQ15 = Array.from(
    { length: fftSize / 2 },
    (_, index) => Math.round(Math.sin((-2 * Math.PI * index) / fftSize) * 32767),
  );
  const dctQ15 = Array.from(
    { length: 13 },
    (_, coefficient) =>
      Array.from(
        { length: 13 },
        (_, band) =>
          Math.round(
            Math.cos((Math.PI * (band + 0.5) * coefficient) / 13) * 32767,
          ),
      ),
  );
  let state = 0x4b575331;
  function random() {
    state ^= state << 13;
    state ^= state >>> 17;
    state ^= state << 5;
    state >>>= 0;
    return state;
  }
  const weights = (length: number) =>
    Array.from(
      { length },
      () => (random() % 15) - 7,
    );
  return {
    schemaVersion: 1,
    fftSize,
    windowSamples: 320,
    featureCount: 13,
    contextFrames: 3,
    hiddenChannels: 8,
    classLabels: ["silence", "yes", "no", "other"],
    windowQ15,
    twiddleRealQ15,
    twiddleImagQ15,
    dctQ15,
    depthwiseWeightsI8: weights(3 * 13),
    depthwiseBiasI32: weights(13),
    pointwiseWeightsI8: weights(13 * 8),
    pointwiseBiasI32: weights(8),
    outputWeightsI8: weights(8 * 4),
    outputBiasI32: weights(4),
    quantization: {
      windowShift: 15,
      fftStageShift: 1,
      mfccDctShift: 10,
      depthwiseShift: 5,
      pointwiseShift: 6,
      outputShift: 4,
    },
    seed: "0x4b575331",
  };
}
