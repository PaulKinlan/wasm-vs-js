# Keyword-spotting model provenance

`model-checkpoint.v1.json` is the complete trained checkpoint used by both controlled engines. It is not a random-weight stand-in.

## Architecture

The model follows the MLPerf Tiny keyword-spotting DS-CNN layer family: a 49×10 feature window, a 10×4 stride-2 convolution, four 3×3 depthwise plus 1×1 pointwise blocks, global average pooling, and a 12-class dense head. This independently trained variant uses eight channels so all 3,000 streaming inferences remain bounded in a browser worker. Every weight, bias, Q24 multiplier, normalization lookup, label, and accuracy result is in the checkpoint.

MLPerf Tiny is methodology prior art only. The upstream reference implementation is Apache-2.0 and is documented at <https://github.com/mlcommons/tiny/tree/master/benchmark/training/keyword_spotting>. This checkpoint does not copy or claim the upstream weights or its reported 92% test accuracy.

## Training and accuracy

- Audio: TensorFlow Speech Commands v2 published test archive, SHA-256 `cc2a00c1147c2254e9be3fa0f779d8c17421dc349b86366567a8edfa9acd51df`.
- Feature preparation: `scripts/prepare-base-ml-keyword-spotting-training.ts` under Deno 2.9.0.
- Training: `scripts/train-base-ml-keyword-spotting.py`, Python 3.13.5, NumPy 2.4.3, tinygrad 0.11.0, seed `0x4b575332`.
- Quantization: `scripts/quantize-base-ml-keyword-spotting.py`.
- Split: for each of the 12 archive labels, the last 80 byte-sorted files are held out; 3,930 train and 960 validate.
- Float checkpoint: 71.58% train, 67.29% holdout.
- Committed integer checkpoint: 51.73% train, 49.90% holdout.

These figures establish that the checkpoint was trained and that the committed quantized graph retains learned signal. The archive is the publisher's test distribution, so this project-specific split is not comparable to an MLPerf submission and is not presented as a generalization or production-accuracy claim.

## License

The independently authored training recipes and resulting project checkpoint are released under this repository's MIT license. Speech Commands audio remains download-only under CC BY 4.0 and is never committed. Upstream MLPerf code and model bytes are not redistributed.
