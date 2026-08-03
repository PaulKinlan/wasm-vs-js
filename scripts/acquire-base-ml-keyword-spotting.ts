import { sha256Hex } from "../benchmarks/base/ml-keyword-spotting/engine.js";

const root = new URL("../", import.meta.url);
const outputPath = Deno.args.find((value) => value.startsWith("--output="))?.slice(9) ?? "";
const archivePath = Deno.args.find((value) => value.startsWith("--archive="))?.slice(10) ?? "";
if (!outputPath) throw new Error("--output=<outside-repository PCM path> required");
const manifest = JSON.parse(
  await Deno.readTextFile(
    new URL("benchmarks/base/ml-keyword-spotting/speech-commands-subset.v1.json", root),
  ),
);
let archive: string;
if (archivePath) {
  archive = archivePath;
} else {
  const temp = await Deno.makeTempFile({ suffix: ".tar.gz" });
  const response = await fetch(manifest.archive.url);
  if (!response.ok || !response.body) {
    throw new Error(`archive download failed: ${response.status}`);
  }
  await Deno.writeFile(temp, response.body);
  archive = temp;
}
const archiveBytes = await Deno.readFile(archive);
if (
  archiveBytes.length !== manifest.archive.bytes ||
  await sha256Hex(archiveBytes) !== manifest.archive.sha256
) {
  throw new Error("Speech Commands archive bytes do not match frozen recipe");
}
function pcmFromWav(bytes: Uint8Array) {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  if (
    new TextDecoder().decode(bytes.subarray(0, 4)) !== "RIFF" ||
    new TextDecoder().decode(bytes.subarray(8, 12)) !== "WAVE"
  ) throw new Error("not RIFF/WAVE");
  let offset = 12;
  let format = null;
  let data = null;
  while (offset + 8 <= bytes.length) {
    const id = new TextDecoder().decode(bytes.subarray(offset, offset + 4));
    const length = view.getUint32(offset + 4, true);
    const body = offset + 8;
    if (id === "fmt ") {
      format = {
        tag: view.getUint16(body, true),
        channels: view.getUint16(body + 2, true),
        rate: view.getUint32(body + 4, true),
        bits: view.getUint16(body + 14, true),
      };
    }
    if (id === "data") data = bytes.slice(body, body + length);
    offset = body + length + (length & 1);
  }
  if (
    !format || format.tag !== 1 || format.channels !== 1 || format.rate !== 16000 ||
    format.bits !== 16 || !data
  ) throw new Error("WAV must be mono PCM16 at 16000 Hz");
  const normalized = new Uint8Array(32000);
  normalized.set(data.subarray(0, normalized.length));
  return normalized;
}
const combined = new Uint8Array(60 * 32000);
let combinedOffset = 0;
for (const entry of manifest.files) {
  const result = await new Deno.Command("tar", {
    args: ["-xOzf", archive, `./${entry.path}`],
    stdout: "piped",
    stderr: "piped",
  }).output();
  if (!result.success) throw new Error(new TextDecoder().decode(result.stderr));
  if (
    await sha256Hex(result.stdout) !== entry.wavSha256 || result.stdout.length !== entry.wavBytes
  ) throw new Error(`WAV mismatch: ${entry.path}`);
  const pcm = pcmFromWav(result.stdout);
  if (await sha256Hex(pcm) !== entry.normalizedPcmSha256) {
    throw new Error(`normalized PCM mismatch: ${entry.path}`);
  }
  combined.set(pcm, combinedOffset);
  combinedOffset += pcm.length;
}
if (await sha256Hex(combined) !== manifest.normalizedPcmSha256) {
  throw new Error("combined PCM mismatch");
}
await Deno.writeFile(outputPath, combined);
console.log(`wrote ${combined.length} recipe-only PCM bytes to ${outputPath}`);
