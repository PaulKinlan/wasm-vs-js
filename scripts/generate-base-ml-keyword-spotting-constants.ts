const root = new URL("../", import.meta.url);
const checkpoint = JSON.parse(
  await Deno.readTextFile(
    new URL("benchmarks/base/ml-keyword-spotting/model-checkpoint.v1.json", root),
  ),
);
const fftSize = 512;
const windowSamples = 480;
const featureCount = 10;
const constants = {
  schemaVersion: 2,
  fftSize,
  windowSamples,
  featureCount,
  contextFrames: 49,
  hiddenChannels: 8,
  classLabels: checkpoint.labels,
  windowQ15: Array.from(
    { length: windowSamples },
    (_, index) =>
      Math.round(
        (0.5 - 0.5 * Math.cos((2 * Math.PI * index) / (windowSamples - 1))) * 32767,
      ),
  ),
  twiddleRealQ15: Array.from(
    { length: fftSize / 2 },
    (_, index) => Math.round(Math.cos((-2 * Math.PI * index) / fftSize) * 32767),
  ),
  twiddleImagQ15: Array.from(
    { length: fftSize / 2 },
    (_, index) => Math.round(Math.sin((-2 * Math.PI * index) / fftSize) * 32767),
  ),
  dctQ15: Array.from(
    { length: featureCount },
    (_, coefficient) =>
      Array.from(
        { length: featureCount },
        (_, band) =>
          Math.round(
            Math.cos((Math.PI * (band + 0.5) * coefficient) / featureCount) * 32767,
          ),
      ),
  ),
  normalizationLookupI8: checkpoint.normalizationLookupI8,
  layers: checkpoint.layers,
};
function cArray(type: string, name: string, values: number[], width = values.length): string {
  const rows = [];
  for (let offset = 0; offset < values.length; offset += width) {
    rows.push(`  ${values.slice(offset, offset + width).join(", ")}`);
  }
  return `static const ${type} ${name}[${values.length}] = {\n${rows.join(",\n")}\n};\n`;
}
const layerByName = new Map(
  checkpoint.layers.map((layer: { name: string }) => [layer.name, layer]),
);
const header = [
  "#ifndef BASE_ML_KEYWORD_SPOTTING_CONSTANTS_V1_H",
  "#define BASE_ML_KEYWORD_SPOTTING_CONSTANTS_V1_H",
  "#include <stdint.h>",
  cArray("int32_t", "KWS_WINDOW_Q15", constants.windowQ15, 16),
  cArray("int32_t", "KWS_TWIDDLE_REAL_Q15", constants.twiddleRealQ15, 16),
  cArray("int32_t", "KWS_TWIDDLE_IMAG_Q15", constants.twiddleImagQ15, 16),
  cArray("int32_t", "KWS_DCT_Q15", constants.dctQ15.flat(), 10),
  cArray("int8_t", "KWS_NORMALIZATION_I8", checkpoint.normalizationLookupI8.flat(), 16),
  ...checkpoint.layers.flatMap(
    (
      layer: { name: string; weights: number[]; biases: number[]; multiplierQ24: number | null },
    ) => {
      const macro = layer.name.toUpperCase();
      return [
        cArray("int8_t", `KWS_${macro}_WEIGHTS`, layer.weights, 16),
        cArray("int32_t", `KWS_${macro}_BIASES`, layer.biases, 12),
        layer.multiplierQ24 === null
          ? ""
          : `#define KWS_${macro}_MULTIPLIER_Q24 ${layer.multiplierQ24}LL\n`,
      ];
    },
  ),
  "#endif",
  "",
].join("\n");
const js = `export default ${JSON.stringify(constants)};\n`;
const outputArgument = Deno.args.find((value) => value.startsWith("--output-dir="))?.slice(13);
const output = outputArgument
  ? new URL(`${outputArgument.replace(/\/$/, "")}/`, root)
  : new URL("benchmarks/base/ml-keyword-spotting/", root);
await Deno.mkdir(output, { recursive: true });
await Deno.writeTextFile(new URL("constants.v1.js", output), js);
await Deno.writeTextFile(new URL("constants.v1.h", output), header);
console.log(
  JSON.stringify({
    layers: [...layerByName.keys()],
    jsBytes: js.length,
    headerBytes: header.length,
  }),
);
