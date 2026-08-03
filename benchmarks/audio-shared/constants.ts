export type AudioSlug = "audio-fft" | "audio-fir" | "audio-stft";

export const AUDIO_FROZEN_HASHES: Record<
  AudioSlug,
  { inputSha256: string; outputSha256: string; referenceSha256: string }
> = {
  "audio-fft": {
    inputSha256: "f312693f97034ff558b541f771564e9adcc077174d84202351199e3d18fc8b01",
    outputSha256: "f6285cd3244f76eed0a041f30dbfa43ef8dc49012ec92b77514edc569aadad6e",
    referenceSha256: "0432b81e06b48343754d26ae074cad984524cdbeb73bea0ba0539d8a726b9498",
  },
  "audio-fir": {
    inputSha256: "b90d5d472e7f58e18d544f32dbc7449143608939f4a8c18641d6e7eae1752b56",
    outputSha256: "e4b89ba6d65fa9ac3aa5f1b30da32343e54cc81a9ee9d6f84eaf8b38e823fb5f",
    referenceSha256: "3146faf58d2eecd43b74d4297fcc575b0a688cb2e2b2d9ab1b1c9f3d1e21a564",
  },
  "audio-stft": {
    inputSha256: "dfabd66f9e5272f76915165b663cb6c5cb37896454eb6ac02ea13d2f241f326a",
    outputSha256: "b06a278c83d9eeff309fafd64b617a54e958665e2ef2d498194da6c1e75d97ba",
    referenceSha256: "3bae7479e79489d8f97d07bcbd31439e338f7f7f2978d6acfc2cc46cb8412d7a",
  },
};

export const AUDIO_MEMORY_PAGES: Record<AudioSlug, number> = {
  "audio-fft": 32,
  "audio-fir": 32,
  "audio-stft": 64,
};
