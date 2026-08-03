export type AudioSlug = "audio-fft" | "audio-fir" | "audio-stft";

export const AUDIO_FROZEN_HASHES: Record<
  AudioSlug,
  { inputSha256: string; outputSha256: string }
> = {
  "audio-fft": {
    inputSha256: "56a844c73dbb33c2ac426ce012b0d953f54270c8acd1bc90a4b058147a810ee0",
    outputSha256: "8394fb237d8e085dcee070c9c1835bdaa831f6f6cec5c84aff50e85180fa0cd9",
  },
  "audio-fir": {
    inputSha256: "b90d5d472e7f58e18d544f32dbc7449143608939f4a8c18641d6e7eae1752b56",
    outputSha256: "e4b89ba6d65fa9ac3aa5f1b30da32343e54cc81a9ee9d6f84eaf8b38e823fb5f",
  },
  "audio-stft": {
    inputSha256: "324551444ff689a77c896f413421b1c65a41577389d48b5709558f138319d617",
    outputSha256: "a9f31f5ddc547961586f7f0b7cecd746f47897e82d6ecd697778d6ce53107fc8",
  },
};

export const AUDIO_MEMORY_PAGES: Record<AudioSlug, number> = {
  "audio-fft": 32,
  "audio-fir": 32,
  "audio-stft": 64,
};
