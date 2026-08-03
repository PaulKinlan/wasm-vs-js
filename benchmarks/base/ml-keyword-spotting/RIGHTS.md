# Speech Commands v2 fixture rights and provenance

The benchmark does not redistribute Speech Commands audio. The committed manifest pins the TensorFlow test archive URL, byte length, SHA-256, exact 60-file selection, each WAV hash, normalization rule, and each normalized PCM hash. The acquisition script writes derived PCM only to an operator-supplied path outside the repository.

Dataset attribution: Pete Warden, “Speech Commands: A Dataset for Limited-Vocabulary Speech Recognition,” 2018. TensorFlow describes the dataset under Creative Commons Attribution 4.0. This repository keeps the frozen v1 catalog's conservative `recipe-only` distribution rule.

The controlled DS-CNN model uses project-generated weights and authored implementations. MLPerf Tiny is cited as methodology prior art under Apache-2.0; no MLPerf source or weights are copied.
