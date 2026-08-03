import {
  extractOneSecondTrainingFeatures,
  sha256Hex,
} from "../benchmarks/base/ml-keyword-spotting/engine.js";

const archive = Deno.args.find((value) => value.startsWith("--archive="))?.slice(10) ?? "";
const outputFeatures = Deno.args.find((value) => value.startsWith("--features="))?.slice(11) ?? "";
const outputLabels = Deno.args.find((value) => value.startsWith("--labels="))?.slice(9) ?? "";
if (!archive || !outputFeatures || !outputLabels) {
  throw new Error(
    "--archive=<Speech Commands test tar.gz> --features=<path> --labels=<path> required",
  );
}
const archiveBytes = await Deno.readFile(archive);
if (archiveBytes.length !== 112563277) {
  throw new Error("Speech Commands archive byte length mismatch");
}
if (
  await sha256Hex(archiveBytes) !==
    "cc2a00c1147c2254e9be3fa0f779d8c17421dc349b86366567a8edfa9acd51df"
) {
  throw new Error("Speech Commands archive SHA-256 mismatch");
}
const labels = [
  "down",
  "go",
  "left",
  "no",
  "off",
  "on",
  "right",
  "stop",
  "up",
  "yes",
  "_silence_",
  "_unknown_",
];
function parseWav(bytes: Uint8Array): Int16Array {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const decoder = new TextDecoder();
  if (
    decoder.decode(bytes.subarray(0, 4)) !== "RIFF" ||
    decoder.decode(bytes.subarray(8, 12)) !== "WAVE"
  ) {
    throw new Error("training input is not RIFF/WAVE");
  }
  let offset = 12;
  let validFormat = false;
  let data: Uint8Array | null = null;
  while (offset + 8 <= bytes.length) {
    const id = decoder.decode(bytes.subarray(offset, offset + 4));
    const length = view.getUint32(offset + 4, true);
    const body = offset + 8;
    if (body + length > bytes.length) throw new Error("truncated WAV chunk");
    if (id === "fmt ") {
      validFormat = view.getUint16(body, true) === 1 && view.getUint16(body + 2, true) === 1 &&
        view.getUint32(body + 4, true) === 16000 && view.getUint16(body + 14, true) === 16;
    }
    if (id === "data") data = bytes.subarray(body, body + length);
    offset = body + length + (length & 1);
  }
  if (!validFormat || data === null) throw new Error("training WAV must be mono PCM16 at 16000 Hz");
  const pcm = new Int16Array(16000);
  const available = Math.min(16000, Math.floor(data.byteLength / 2));
  for (let index = 0; index < available; index += 1) {
    pcm[index] = new DataView(data.buffer, data.byteOffset, data.byteLength).getInt16(
      index * 2,
      true,
    );
  }
  return pcm;
}
const extracted = await Deno.makeTempDir({ prefix: "kws-training-" });
try {
  const extraction = await new Deno.Command("tar", {
    args: ["-xzf", archive, "-C", extracted],
    stdout: "null",
    stderr: "piped",
  }).output();
  if (!extraction.success) throw new Error(new TextDecoder().decode(extraction.stderr));
  const examples: Int8Array[] = [];
  const labelIndexes: number[] = [];
  for (let labelIndex = 0; labelIndex < labels.length; labelIndex += 1) {
    const names = [];
    for await (const entry of Deno.readDir(`${extracted}/${labels[labelIndex]}`)) {
      if (entry.isFile && entry.name.endsWith(".wav")) names.push(entry.name);
    }
    names.sort();
    if (names.length < 81) throw new Error(`insufficient examples for ${labels[labelIndex]}`);
    for (const name of names) {
      const wav = await Deno.readFile(`${extracted}/${labels[labelIndex]}/${name}`);
      examples.push(extractOneSecondTrainingFeatures(parseWav(wav)));
      labelIndexes.push(labelIndex);
    }
  }
  const featureBytes = new Int8Array(examples.length * 49 * 10);
  for (let index = 0; index < examples.length; index += 1) {
    featureBytes.set(examples[index], index * 490);
  }
  await Deno.writeFile(outputFeatures, new Uint8Array(featureBytes.buffer));
  await Deno.writeFile(outputLabels, new Uint8Array(labelIndexes));
  console.log(JSON.stringify({ examples: examples.length, featureBytes: featureBytes.byteLength }));
} finally {
  await Deno.remove(extracted, { recursive: true });
}
