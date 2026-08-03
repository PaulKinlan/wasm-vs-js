#!/usr/bin/env bash
set -euo pipefail

[[ "$(deno --version | head -n 1)" == "deno 2.9.0 (stable, release, x86_64-unknown-linux-gnu)" ]] || {
  echo "Deno 2.9.0 x86_64 is required" >&2
  exit 1
}
[[ "$(npm --version)" == "11.13.0" ]] || {
  echo "npm 11.13.0 is required" >&2
  exit 1
}
[[ "$(pkg-config --modversion vpx)" == "1.16.0" ]] || {
  echo "libvpx 1.16.0 is required" >&2
  exit 1
}
[[ "$(sha256sum /usr/bin/vpxenc | awk '{print $1}')" == "70ae42b3b09df9d8be1cf444265a389628e112704b465bf6595e0d60a7b8a46f" ]] || {
  echo "vpxenc probe binary changed" >&2
  exit 1
}

work="$(mktemp -d -t wasm-vs-js-video-blocker.XXXXXX)"
trap 'rm -rf "$work"' EXIT
cd "$work"

pack_and_check() {
  local spec="$1" expected="$2" target="$3"
  local archive
  archive="$(npm pack "$spec" --silent)"
  local actual
  actual="$(sha256sum "$archive" | awk '{print $1}')"
  [[ "$actual" == "$expected" ]] || {
    echo "$spec tarball SHA-256 mismatch: $actual" >&2
    exit 1
  }
  mkdir "$target"
  tar -xzf "$archive" -C "$target"
}

pack_and_check whammy@0.0.1 \
  08ced27aa6091a77d22e52c73742d460ed28510b7b3e44f77f0a564360931c13 whammy
pack_and_check webm-writer@1.0.0 \
  ee48cafe6f9a2d87e8e87ec93660847a6a572d868cbb8bafc5bb2cfe78d59d47 webm-writer
pack_and_check @ffmpeg/ffmpeg@0.12.15 \
  c8a23365fb39b46d3d1d9baa2e74b522d00ce5d57e8b20471ad2665eaad38e3e ffmpeg
pack_and_check @webav/av-cliper@1.2.8 \
  6016c72f68a6e4d729a2b9461631c423669be388c4e7f472c1ecdedd60f3258d webav
pack_and_check libvpx@1.0.0 \
  a8f4aad068ee17361874abbff1075efa537c00d01dbca2bae4f916fff893eb3b libvpx-npm

grep -F "frame.toDataURL('image/webp'" whammy/package/whammy.js >/dev/null
grep -F '"data": "V_VP8"' whammy/package/whammy.js >/dev/null
! grep -F 'V_VP9' whammy/package/whammy.js >/dev/null

grep -F "relies on Chrome's WebP encoder" webm-writer/package/Readme.md >/dev/null
grep -F "canvas.toDataURL('image/webp'" webm-writer/package/WebMWriter.js >/dev/null
grep -F '"data": "V_VP8"' webm-writer/package/WebMWriter.js >/dev/null
! grep -F 'V_VP9' webm-writer/package/WebMWriter.js >/dev/null

grep -F 'createFFmpegCore' ffmpeg/package/dist/esm/worker.js >/dev/null
grep -F 'wasmURL' ffmpeg/package/dist/esm/worker.js >/dev/null

grep -F 'VideoEncoder.isConfigSupported' webav/package/dist/av-cliper.js >/dev/null
grep -F 'VideoDecoder.isConfigSupported' webav/package/dist/av-cliper.js >/dev/null

[[ "$(find libvpx-npm/package -type f | wc -l)" -eq 1 ]]
[[ "$(wc -c < libvpx-npm/package/package.json)" -eq 38 ]]
[[ "$(cat libvpx-npm/package/package.json)" == '{"name": "libvpx","version": "1.0.0"}' ]]

cat <<'JSON'
{
  "status": "blocked",
  "reasonCode": "controlled-javascript-vp9-encoder-unavailable",
  "candidateChecks": 5,
  "denoVersion": "2.9.0",
  "npmVersion": "11.13.0",
  "libvpxVersion": "1.16.0",
  "observations": [
    "whammy delegates VP8 encoding to Canvas WebP",
    "webm-writer delegates VP8 encoding to Chrome WebP",
    "@ffmpeg/ffmpeg loads a WebAssembly core",
    "@webav/av-cliper delegates to WebCodecs",
    "the libvpx npm tarball contains no implementation"
  ]
}
JSON
