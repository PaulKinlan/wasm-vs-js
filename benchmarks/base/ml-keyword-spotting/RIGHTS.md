# Speech Commands v2 fixture rights and provenance

The benchmark originally did not redistribute Speech Commands audio. The committed manifest pins the TensorFlow test archive URL, byte length, SHA-256, exact 60-file selection, each WAV hash, normalization rule, and each normalized PCM hash. The acquisition script can still write derived PCM to an operator-supplied path outside the repository.

Dataset attribution: Pete Warden, “Speech Commands: A Dataset for Limited-Vocabulary Speech Recognition,” 2018. TensorFlow describes the dataset under Creative Commons Attribution 4.0.

**Policy change, 2026-08-04 (owner-approved):** the frozen v1 catalog's conservative `recipe-only` distribution rule is relaxed for the pinned fixture. CC BY 4.0 permits redistribution with attribution, so the exact normalized 60-second PCM fixture (SHA-256 pinned in the manifest, transitively binding all 60 source WAVs through the pinned normalization rule) is now bundled at `public/artifacts/base-ml-keyword-spotting/fixture.pcm16le` with attribution, so the demo and playground can run unattended. The upstream WAVs themselves are still not committed.

The controlled DS-CNN checkpoint is independently trained by this project with the committed recipes and released under the repository's MIT license. Its architecture follows the MLPerf Tiny keyword-spotting layer family, cited as Apache-2.0 methodology prior art. No upstream MLPerf source, checkpoint, or reported accuracy is copied or claimed; see `MODEL.md` for the exact split, versions, and measured project accuracy.
