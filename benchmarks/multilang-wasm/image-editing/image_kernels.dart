// image-editing multilang kernels (Dart WasmGC) — exact mirror of the pinned
// proposal WAT (benchmarks/image-editing/image-editing.wat) and
// image_kernels.c. Integer-only, so Dart's arithmetic is natively identical;
// the host passes typed-array views (source pre-loaded into output, mask
// zeroed) exactly as the linear-memory host pre-stages the fixed offsets.
// Counters are written into the supplied Uint32List in the canonical
// COUNTER_NAMES order (operations … maxFrontier).

import 'dart:js_interop';
import 'dart:typed_data';

const int floodThreshold = 12;
// FLOOD_REPLACEMENT = 34, 139, 230, 191 (contract.ts).

int absdiff(int left, int right) => left >= right ? left - right : right - left;

@JSExport()
class ImageKernels {
  @JSExport('flood_fill')
  void floodFill(
    JSUint8Array sourceJs,
    JSUint8Array outputJs,
    JSUint8Array maskJs,
    JSUint32Array countersJs,
    int width,
    int height,
    int seedX,
    int seedY,
  ) {
    final source = sourceJs.toDart;
    final output = outputJs.toDart;
    final mask = maskJs.toDart;
    final counters = countersJs.toDart;
    for (int i = 0; i < 9; i++) {
      counters[i] = 0;
    }
    var operations = 0, readBytes = 0, writeBytes = 0;
    var visitedPixels = 0, changedPixels = 0, neighborTests = 0;
    var stackPushes = 0, stackPops = 0, maxFrontier = 0, stackSize = 0;

    final pixels = width * height;
    final stack = Uint32List(pixels);

    final seedIndex = seedY * width + seedX;
    final seedOffset = seedIndex * 4;
    final seedR = source[seedOffset];
    final seedG = source[seedOffset + 1];
    final seedB = source[seedOffset + 2];
    final seedA = source[seedOffset + 3];
    readBytes = 4;
    operations = 4;

    if (seedR != 34 || seedG != 139 || seedB != 230 || seedA != 191) {
      void push(int index) {
        mask[index] = 1;
        stack[stackSize] = index;
        stackSize += 1;
        stackPushes += 1;
        writeBytes += 5;
        if (stackSize > maxFrontier) maxFrontier = stackSize;
      }

      void tryPush(int index) {
        neighborTests += 1;
        operations += 1;
        readBytes += 1;
        if (mask[index] == 0) push(index);
      }

      push(seedIndex);
      while (stackSize != 0) {
        stackSize -= 1;
        final index = stack[stackSize];
        stackPops += 1;
        visitedPixels += 1;
        readBytes += 8;
        final offset = index * 4;

        var maximum = absdiff(source[offset], seedR);
        var difference = absdiff(source[offset + 1], seedG);
        if (difference > maximum) maximum = difference;
        difference = absdiff(source[offset + 2], seedB);
        if (difference > maximum) maximum = difference;
        difference = absdiff(source[offset + 3], seedA);
        if (difference > maximum) maximum = difference;
        operations += 8;

        if (maximum <= floodThreshold) {
          output[offset] = 34;
          output[offset + 1] = 139;
          output[offset + 2] = 230;
          output[offset + 3] = 191;
          changedPixels += 1;
          writeBytes += 4;

          final x = index % width;
          final y = index ~/ width;
          if (y > 0) tryPush(index - width);
          if (x + 1 < width) tryPush(index + 1);
          if (y + 1 < height) tryPush(index + width);
          if (x > 0) tryPush(index - 1);
        }
      }
    }

    counters[0] = operations;
    counters[1] = readBytes;
    counters[2] = writeBytes;
    counters[3] = visitedPixels;
    counters[4] = changedPixels;
    counters[5] = neighborTests;
    counters[6] = stackPushes;
    counters[7] = stackPops;
    counters[8] = maxFrontier;
  }

  @JSExport('luma_gaussian_pipeline')
  void lumaGaussianPipeline(
    JSUint8Array sourceJs,
    JSUint8Array outputJs,
    JSUint8Array lumaJs,
    JSUint16Array horizontalJs,
    JSUint32Array countersJs,
    int width,
    int height,
  ) {
    final source = sourceJs.toDart;
    final output = outputJs.toDart;
    final luma = lumaJs.toDart;
    final horizontal = horizontalJs.toDart;
    final counters = countersJs.toDart;
    for (int i = 0; i < 9; i++) {
      counters[i] = 0;
    }

    final pixels = width * height;

    // Integer luma: (77R + 150G + 29B + 128) >> 8.
    for (var index = 0; index < pixels; index += 1) {
      final offset = index * 4;
      luma[index] =
          (77 * source[offset] + 150 * source[offset + 1] + 29 * source[offset + 2] + 128) >>
              8;
    }

    for (var index = 0; index < pixels; index += 1) {
      final x = index % width;
      final left = x == 0 ? index : index - 1;
      final right = x + 1 >= width ? index : index + 1;
      horizontal[index] = luma[left] + 2 * luma[index] + luma[right];
    }

    for (var index = 0; index < pixels; index += 1) {
      final y = index ~/ width;
      final top = y == 0 ? index : index - width;
      final bottom = y + 1 >= height ? index : index + width;
      final value = (horizontal[top] + 2 * horizontal[index] + horizontal[bottom] + 8) >> 4;
      final offset = index * 4;
      output[offset] = value;
      output[offset + 1] = value;
      output[offset + 2] = value;
      output[offset + 3] = source[offset + 3];
    }

    counters[0] = pixels * 19;
    counters[1] = pixels * 13;
    counters[2] = pixels * 7;
    counters[3] = pixels;
  }
}

void main() {
  dartKernels = createJSInteropWrapper(ImageKernels());
}

@JS('dartKernels')
external set dartKernels(JSObject value);
