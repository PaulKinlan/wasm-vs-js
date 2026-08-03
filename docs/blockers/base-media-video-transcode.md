# Blocker: controlled JavaScript VP9 transcode

`media.video-transcode.v1` remains unimplemented. The frozen catalog files remain byte-identical, and this package does not add a route, engine, artifact, validation record, or implementation numerator.

## Required controlled pair

The catalog requires a deterministic 10-second 720p clip to be encoded as VP9/WebM and decoded for complete-frame and fixed-thumbnail validation. The controlled JavaScript target must perform VP9 encoding, WebM muxing, VP9 decoding, WebM demuxing, and thumbnail extraction in JavaScript. Calling WebCodecs, Canvas/WebP, MediaRecorder, a native program, or a Wasm codec would move the work outside that target.

The linear-Wasm target has a credible source route through BSD-licensed libvpx and an audited minimal FFmpeg/WebM wrapper. It has not been built because the controlled comparison cannot pass while the JavaScript target is absent. Toolchain revision, Emscripten flags, VP9 patent configuration, codec notices, VFS, memory, SIMD, threads, artifact hashes, and build reproduction therefore remain unavailable.

## Candidate inspection

[`reproduce-base-video-js-blocker.sh`](../../scripts/reproduce-base-video-js-blocker.sh) downloads and hashes five exact npm tarballs before checking their shipped code:

- `whammy@0.0.1` calls `canvas.toDataURL('image/webp')`, extracts the host-produced bitstream, and emits `V_VP8`.
- `webm-writer@1.0.0` states that Chrome's WebP encoder performs the compression; it also emits `V_VP8`.
- `@ffmpeg/ffmpeg@0.12.15` loads `ffmpeg-core` and a `.wasm` payload.
- `@webav/av-cliper@1.2.8` calls `VideoEncoder` and `VideoDecoder` from WebCodecs.
- `libvpx@1.0.0` contains only a 38-byte `package.json` and no codec implementation.

The first two candidates use VP8 rather than the registered VP9 family and delegate encoding to a browser image codec. The next two are useful product baselines, but neither executes a controlled JavaScript codec. The package named `libvpx` has no executable code.

## Contract work held behind the blocker

A complete package must freeze project-generated CC0 Y4M bytes, fps, pixel format, audio policy, bitrate, preset, GOP, one thread, WebM metadata and timestamps, and thumbnail times. Its oracle must inspect every container element, decode every frame, enforce pinned PSNR/SSIM bounds, and compare every thumbnail pixel. Frame, block, transform, bit, copy, allocation, and boundary counters must come from the executed implementations.

Those fields are not filled with guessed values while one controlled target is missing. A reduced clip, VP8 substitution, host encode, facade over Wasm, checksum-only result, or decoder-only package would not implement the catalog row.

## Reproduce

Run:

```sh
./scripts/reproduce-base-video-js-blocker.sh
```

The script requires Deno 2.9.0, npm 11.13.0, npm access, and the locally recorded libvpx 1.16.0 probe. It verifies all package hashes and fails if a candidate's relevant mechanism changes. The closed machine-readable record is [`blocker.v1.json`](../../artifacts/base-v1/media-video-transcode/blocker.v1.json).

## Unblock condition

Re-open implementation when a pinned, license-compatible independent JavaScript VP9/WebM encode-decode pipeline passes official VP9 interoperability vectors and the complete registered clip against a separately built libvpx/FFmpeg linear-Wasm target. Until then, coverage stays zero.
