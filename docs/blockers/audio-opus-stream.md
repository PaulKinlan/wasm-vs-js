# `audio.opus-stream.v1` blocker

- **Status:** Blocked
- **Frozen-v1 coverage:** No
- **Runnable demo:** Unavailable
- **Performance evidence:** Unavailable

The official RFC 8251 vectors are reproducibly identified, but the controlled JavaScript target is unavailable. The browser packages inspected on 2026-08-03 are libopus builds behind JavaScript APIs:

- `opusscript@0.1.1` describes itself as libopus 1.4 ported with Emscripten. Its package includes a compiled Wasm payload and an optional generated JavaScript build from the same libopus source.
- `opus-decoder@0.7.11` describes itself as a WebAssembly decoder based on libopus.

Either package could exercise libopus in a browser, but neither supplies an independent JavaScript implementation to compare with a libopus-derived linear-Wasm target. Using one would compare the same codec implementation through two wrappers, which violates the controlled-track contract.

## Reproducible fixture recipe

The repository does not contain vector or reference PCM bytes. The recipe pins:

- RFC 8251 vector archive: 74,624,664 bytes, SHA-256 `6b26a22f9ba87b2b836906a9bb7afec5f8e54d49553b1200382520ee6fedfa55`.
- libopus 1.5.2 source: 7,839,412 bytes, SHA-256 `65c1d2f78b9f2fb20082c38cbe47c951ad5839345876e46941612ee87f9a7ce1`.
- Official invocation: `./tests/run_vectors.sh ./ opus_newvectors 48000`.

That runner decodes vectors `01` through `12` as mono and stereo, then requires `opus_compare` to accept each complete PCM output against either its `.dec` or `m.dec` reference. The future controlled pair must preserve decoder state across each framed stream and retain every packet, PCM range, final-range checkpoint, mode, PLC/FEC disposition, and exact counter.

Run the network audit with Deno 2.9.0:

```sh
deno run \
  --allow-net=opus-codec.org,downloads.xiph.org,ftp.osuosl.org,registry.npmjs.org \
  --allow-read --allow-write --allow-run=tar \
  scripts/reproduce-audio-opus-stream-blocker.ts --fetch
```

The machine-readable record is [`independent-js-decoder.v1.json`](../../evidence/blockers/audio-opus-stream/independent-js-decoder.v1.json). It keeps source, artifacts, result records, browser evidence, and performance evidence typed as `unavailable` rather than converting the blocker into coverage.
