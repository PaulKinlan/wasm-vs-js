#!/usr/bin/env bash
set -euo pipefail

expected_tar_sha=0f464bccc23409fa64b738e12898cb97de4d23dafc37caa9837acb3a2936e973
expected_input_sha=baa8f91d750a704eb922e69271e776eefb9f6497ea586d7dda2ea158f62db497
expected_frame_sha=6027a209cdcdafbcb87bb962f45a953f9c1e8f3feb789d7d5ad407193dff35bb

[[ "$(deno --version | head -n 1)" == "deno 2.9.0 (stable, release, x86_64-unknown-linux-gnu)" ]] || {
  echo "Deno 2.9.0 x86_64 is required" >&2
  exit 1
}
zstd --version 2>&1 | grep -F "v1.5.7" >/dev/null || {
  echo "Zstandard CLI 1.5.7 is required" >&2
  exit 1
}

work="$(mktemp -d -t wasm-vs-js-zstd-blocker.XXXXXX)"
trap 'rm -rf "$work"' EXIT
cd "$work"
package_archive="$(npm pack zstdify@1.4.0 --silent)"
actual_tar_sha="$(sha256sum "$package_archive" | awk '{print $1}')"
[[ "$actual_tar_sha" == "$expected_tar_sha" ]] || {
  echo "zstdify tarball SHA-256 mismatch: $actual_tar_sha" >&2
  exit 1
}
tar -xzf "$package_archive"

cat > probe.mjs <<'PROBE'
import { compress, decompress } from "./package/dist/index.js";

function hex(bytes) {
  return Array.from(bytes, (value) => value.toString(16).padStart(2, "0")).join("");
}
async function sha256(bytes) {
  return hex(new Uint8Array(await crypto.subtle.digest("SHA-256", bytes)));
}
function equal(left, right) {
  return left.length === right.length && left.every((value, index) => value === right[index]);
}
function binaryProbe() {
  const output = new Uint8Array(32 * 1024);
  const view = new DataView(output.buffer);
  for (let offset = 0, index = 0; offset + 32 <= output.length; offset += 32, index++) {
    view.setUint32(offset, 0x57494445, true);
    view.setUint32(offset + 4, index, true);
    view.setUint32(offset + 8, Math.imul(index, 2654435761) >>> 0, true);
    view.setUint32(offset + 12, index % 4096, true);
    view.setFloat64(offset + 16, Math.sin(index % 1024), true);
    view.setUint32(offset + 24, (index * 17) % 65536, true);
    view.setUint32(offset + 28, 0xdeadbeef, true);
  }
  return output;
}
function jsonProbe() {
  const bytes = 1024 * 1024;
  const encoder = new TextEncoder();
  const prefix = encoder.encode('{"schema":"web-ide-snapshot.v1","records":[],"padding":"');
  const pattern = encoder.encode("0123456789abcdef");
  const suffix = encoder.encode('"}\n');
  const output = new Uint8Array(bytes);
  output.set(prefix);
  for (let offset = prefix.length; offset < bytes - suffix.length; offset += pattern.length) {
    output.set(pattern.subarray(0, Math.min(pattern.length, bytes - suffix.length - offset)), offset);
  }
  output.set(suffix, bytes - suffix.length);
  return output;
}

const input = binaryProbe();
const frame = compress(input, { level: 3, checksum: true });
const restored = decompress(frame, { maxSize: input.length, validateChecksum: true });
if (!equal(input, restored)) throw new Error("zstdify did not self-roundtrip the binary probe");
await Deno.writeFile("candidate.zst", frame);

let jsonObservation = "no-error";
try {
  compress(jsonProbe(), { level: 3, checksum: true });
} catch (error) {
  jsonObservation = String(error?.message ?? error);
}

console.log(JSON.stringify({
  inputSha256: await sha256(input),
  frameSha256: await sha256(frame),
  frameBytes: frame.length,
  candidateSelfRoundtrip: true,
  jsonObservation,
}));
PROBE

deno run --allow-read="$work/package" --allow-write="$work/candidate.zst" probe.mjs > candidate.json
input_sha="$(deno eval 'const x=JSON.parse(await Deno.readTextFile(Deno.args[0])); console.log(x.inputSha256)' candidate.json)"
frame_sha="$(deno eval 'const x=JSON.parse(await Deno.readTextFile(Deno.args[0])); console.log(x.frameSha256)' candidate.json)"
json_observation="$(deno eval 'const x=JSON.parse(await Deno.readTextFile(Deno.args[0])); console.log(x.jsonObservation)' candidate.json)"
[[ "$input_sha" == "$expected_input_sha" ]] || { echo "probe input hash drifted: $input_sha" >&2; exit 1; }
[[ "$frame_sha" == "$expected_frame_sha" ]] || { echo "candidate frame hash drifted: $frame_sha" >&2; exit 1; }
[[ "$json_observation" == "FSE readNCount: truncated input" ]] || {
  echo "JSON failure observation drifted: $json_observation" >&2
  exit 1
}

set +e
zstd -t candidate.zst > decoder.stdout 2> decoder.stderr
decoder_exit=$?
set -e
[[ "$decoder_exit" == 1 ]] || {
  echo "Expected independent decoder rejection, received exit $decoder_exit" >&2
  exit 1
}
grep -F "Data corruption detected" decoder.stderr >/dev/null || {
  echo "Independent decoder rejection changed" >&2
  cat decoder.stderr >&2
  exit 1
}

cat candidate.json
printf '{"independentDecoder":"Zstandard CLI 1.5.7","exitCode":1,"observation":"Data corruption detected"}\n'
