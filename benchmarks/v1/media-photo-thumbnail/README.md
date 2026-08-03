# `media.photo-thumbnail.v1` implementation status

This directory freezes the fixture recipe and image-processing contract for frozen catalog row `media.photo-thumbnail.v1`. It does not contain an implementation or performance result.

## Fixture selection

The manifest selects six files from `gianni-rosato/gb82-image-set` commit `502f9f94cb73d1ad5c89ce06fe6b100d0a27df8f`: four GB82 photographs/graphics and two GB82-SC files. Every path, byte length, PNG property, raw URL, and SHA-256 is fixed in `fixture-rights-manifest.json`.

The pinned upstream README says all GB82 and GB82-SC images are CC0. The pinned root license is CC0 1.0 with SHA-256 `a2010f343487d3f7618affe54f789f5487602331c0a8d03f49e9a7c547cf0499`. The repository keeps a download recipe rather than copying the images because CC0 does not clear third-party trademark, privacy, or publicity rights. The two GB82-SC choices avoid chat logs and branded desktop screenshots.

Fetch and verify the selected bytes into an owned, untracked directory:

```sh
deno run \
  --allow-read=.,/tmp/media-photo-thumbnail-fixtures \
  --allow-net=raw.githubusercontent.com \
  --allow-write=/tmp/media-photo-thumbnail-fixtures \
  scripts/fetch-media-photo-thumbnail-fixtures.ts \
  --output /tmp/media-photo-thumbnail-fixtures
```

The command rejects redirects, unexpected paths, byte-length changes, and SHA-256 changes.

## Frozen pipeline

`pipeline-contract.json` fixes the complete path: PNG decode, orientation inspection, linear-light premultiplied Lanczos3 resize to a 1,280-pixel long edge, a fixed unsharp mask, straight RGBA8 conversion, and lossy VP8 WebP encoding at quality 80. It also fixes color/alpha handling, output dimensions, codec settings, complete-pixel PSNR/SSIM checks, lifecycle behavior, and the counters that both targets must produce.

All selected PNGs lack EXIF orientation, so the benchmark corpus executes the orientation-1 branch. A future implementation still has to pass synthetic tests for orientations 1–8 and malformed metadata before it can run.

## Why implementation is blocked

The audited pure-JavaScript WebP candidate uses a different, smaller VP8 encoder policy and cannot express the frozen libwebp settings. Its source tag and npm package also omit the declared MIT license text. The inspected wasm-vips 0.0.18 release artifact uses WebAssembly SIMD and `SharedArrayBuffer`; those are separate variants, not the scalar controlled baseline. That release publishes no scalar single-thread artifact, and this repository does not pin its Emscripten 6.0.0 toolchain for a reproducible build.

Consequently, complete output checks, physical counters, worker lifecycle evidence, and timing are unavailable. `implementation-status.json` keeps coverage false and lists every prohibited claim. A host `createImageBitmap`, Canvas, or WebCodecs pipeline would be a product-choice baseline and cannot close this controlled workload.
