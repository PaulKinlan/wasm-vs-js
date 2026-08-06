// Shared multi-language benchmark runner for wasm-vs-js.
//
// Drives the same kernel across JavaScript, raw WAT, AssemblyScript, C, C++,
// Rust, and Dart (WasmGC) from a per-workload JSON manifest, renders
// side-by-side tables, and keeps the standard shell/controls contract. The
// unified-runner is a binary JS-vs-Wasm harness; this module is the
// multi-engine comparison harness (deviation documented per page).
//
// Manifests: public/benchmarks/multilang-wasm/<id>.manifest.json
//   {
//     "workloadId": "ml.gemm.v1",
//     "kernelLabel": "128x128x128 strict-f32 product",
//     "artifactsBase": "/artifacts/multilang-wasm-benchmark",
//     "engines": [
//       { "key": "js", "label": "JavaScript", "kind": "js" },
//       { "key": "c", "label": "C / Wasm", "kind": "linear", "file": "gemm_c.wasm", "offset": 0 },
//       { "key": "dart", "label": "Dart / WasmGC", "kind": "dart", "file": "gemm_dart.wasm", "glue": "gemm_dart.mjs" }
//     ]
//   }
//
// Per-workload call adapters live in KERNEL_ADAPTERS below (manifests are
// data-only); each adapter exposes the timed callable for its kernel.

export const KERNEL_ADAPTERS = { // --- audio-fft: radix-2 FFT butterfly (reuses the multilang-wasm fft kernels)
  "audio.fft.v1": {
    kernels: ["fft"],
    build(mods) {
      const LEN = 512;
      function inputs() {
        const real = new Float32Array(LEN), imag = new Float32Array(LEN);
        for (let i = 0; i < LEN; i++) {
          real[i] = Math.sin(i * 0.1);
          imag[i] = Math.cos(i * 0.1);
        }
        return { real, imag };
      }
      function jsFft(real, imag) {
        for (let step = 1; step < LEN; step <<= 1) {
          const angle = -Math.PI / step, wReal = Math.cos(angle), wImag = Math.sin(angle);
          for (let i = 0; i < LEN; i += step << 1) {
            let cwR = 1.0, cwI = 0.0;
            for (let j = 0; j < step; j++) {
              const u = i + j, v = i + j + step;
              const tr = real[v] * cwR - imag[v] * cwI;
              const ti = real[v] * cwI + imag[v] * cwR;
              real[v] = real[u] - tr;
              imag[v] = imag[u] - ti;
              real[u] += tr;
              imag[u] += ti;
              const nwR = cwR * wReal - cwI * wImag, nwI = cwR * wImag + cwI * wReal;
              cwR = nwR;
              cwI = nwI;
            }
          }
        }
      }
      const callables = {};
      for (const key of ["c", "cpp", "rs"]) {
        const cfg = mods.manifest.engines.find((e) => e.key === key);
        const inst = mods.engines[key].instances.fft.instance;
        const mem = inst.exports.memory;
        callables[key] = {
          fft: () => {
            const { real, imag } = inputs();
            new Float32Array(mem.buffer, cfg.offset, LEN).set(real);
            new Float32Array(mem.buffer, cfg.offset + LEN * 4, LEN).set(imag);
            inst.exports.fft_butterfly(cfg.offset, cfg.offset + LEN * 4, LEN);
          },
        };
      }
      callables.js = {
        fft: () => {
          const { real, imag } = inputs();
          jsFft(real, imag);
        },
      };
      callables.dart = {
        fft: () => {
          const { real, imag } = inputs();
          mods.engines.dart.kernels.fft_butterfly(real, imag, LEN);
        },
      };
      return callables;
    },
  },

  // --- database-olap-chart: OLAP chart aggregation (mirrors workload.js
  //     runOlapJavaScript — region/category filter, stable merge sort, u64
  //     category aggregates, FNV-1a filter digest; 5 queries over 10,000 rows)
  "database.olap-chart.v1": {
    kernels: ["olap"],
    build(mods) {
      const ROWS = 10000, QUERIES = 5, CATEGORIES = 16, TOP = 8, ROW_WORDS = 6, QUERY_WORDS = 6;
      const HEADER_WORDS = 8, OUTPUT_WORDS_PER_QUERY = 112;
      const OUTPUT_WORDS = OUTPUT_WORDS_PER_QUERY * QUERIES;
      const SEED = 0x91e10da5;
      const QUERY_TRACE = [
        [0xff, 0xffff, 0, 0, 0, 1],
        [0x55, 0x0f0f, 30, 1, 0, 2],
        [0xaa, 0xf0f0, 55, 0, 1, 3],
        [0x0f, 0x3333, 20, 1, 1, 4],
        [0xf0, 0xcccc, 70, 0, 0, 5],
      ];
      function next(value) {
        value ^= value << 13;
        value ^= value >>> 17;
        value ^= value << 5;
        return value >>> 0;
      }
      // Bit-exact mirror of generateOlapFixture() (benchmarks/base/database-olap-chart/fixture.js).
      function makeFixture() {
        const words = new Uint32Array(HEADER_WORDS + ROWS * ROW_WORDS + QUERIES * QUERY_WORDS);
        words.set([0x50414c4f, 1, ROWS, QUERIES, CATEGORIES, TOP, ROW_WORDS, QUERY_WORDS]);
        let state = SEED;
        for (let row = 0; row < ROWS; row += 1) {
          state = next(state);
          const region = state & 7;
          const category = (state >>> 4) & 15;
          const year = 2020 + ((state >>> 9) % 5);
          state = next(state);
          const units = 1 + (state % 250);
          state = next(state);
          const revenueCents = (500 + (state % 50000)) * units;
          const values = [row, region, category, year, units, revenueCents >>> 0];
          for (let column = 0; column < ROW_WORDS; column += 1) {
            words[HEADER_WORDS + column * ROWS + row] = values[column];
          }
        }
        let offset = HEADER_WORDS + ROWS * ROW_WORDS;
        for (const query of QUERY_TRACE) {
          words.set(query, offset);
          offset += QUERY_WORDS;
        }
        return new Uint8Array(words.buffer);
      }
      function column(words, columnIndex, row) {
        return words[HEADER_WORDS + columnIndex * ROWS + row];
      }
      function key(words, row, sortColumn) {
        return column(words, sortColumn === 0 ? 5 : 4, row);
      }
      function before(words, left, right, sortColumn, descending) {
        const a = key(words, left, sortColumn), b = key(words, right, sortColumn);
        if (a !== b) return descending ? a > b : a < b;
        return left < right;
      }
      function stableMergeSort(words, indexes, temp, sortColumn, descending, counters) {
        for (let width = 1; width < indexes.length; width *= 2) {
          for (let left = 0; left < indexes.length; left += width * 2) {
            const mid = Math.min(left + width, indexes.length);
            const right = Math.min(left + width * 2, indexes.length);
            let i = left, j = mid, out = left;
            while (i < mid && j < right) {
              counters.sortComparisons += 1;
              if (before(words, indexes[i], indexes[j], sortColumn, descending)) {
                temp[out++] = indexes[i++];
              } else temp[out++] = indexes[j++];
            }
            while (i < mid) temp[out++] = indexes[i++];
            while (j < right) temp[out++] = indexes[j++];
            for (let k = left; k < right; k += 1) indexes[k] = temp[k];
          }
        }
      }
      function add64(lowWords, highWords, index, value) {
        const previous = lowWords[index];
        const next = (previous + (value >>> 0)) >>> 0;
        lowWords[index] = next;
        highWords[index] = (highWords[index] + (next < previous ? 1 : 0)) >>> 0;
      }
      // Bit-exact mirror of runOlapJavaScript(): returns { output, counters }.
      function runOlap(fixture) {
        const words = new Uint32Array(fixture.buffer);
        const output = new Uint32Array(OUTPUT_WORDS);
        const counters = {
          queries: QUERIES,
          rowsVisited: 0,
          predicateChecks: 0,
          matchedRows: 0,
          sortComparisons: 0,
          aggregateRows: 0,
          chartBins: QUERIES * CATEGORIES,
          outputRows: QUERIES * TOP,
          outputWords: OUTPUT_WORDS,
        };
        const queryStart = HEADER_WORDS + ROWS * ROW_WORDS;
        for (let q = 0; q < QUERIES; q += 1) {
          const query = queryStart + q * QUERY_WORDS;
          const regionMask = words[query], categoryMask = words[query + 1];
          const minUnits = words[query + 2], descending = words[query + 3];
          const sortColumn = words[query + 4], controlRevision = words[query + 5];
          const indexes = new Uint32Array(ROWS);
          const temp = new Uint32Array(ROWS);
          let matched = 0;
          const count = new Uint32Array(CATEGORIES);
          const unitsLo = new Uint32Array(CATEGORIES), unitsHi = new Uint32Array(CATEGORIES);
          const revenueLo = new Uint32Array(CATEGORIES), revenueHi = new Uint32Array(CATEGORIES);
          let filterDigest = 0x811c9dc5;
          for (let row = 0; row < ROWS; row += 1) {
            counters.rowsVisited += 1;
            counters.predicateChecks += 3;
            const region = column(words, 1, row), category = column(words, 2, row);
            const units = column(words, 4, row);
            if (
              ((regionMask >>> region) & 1) === 0 || ((categoryMask >>> category) & 1) === 0 ||
              units < minUnits
            ) continue;
            indexes[matched++] = row;
            counters.matchedRows += 1;
            counters.aggregateRows += 1;
            filterDigest = Math.imul((filterDigest ^ (row >>> 0)) >>> 0, 0x01000193) >>> 0;
            count[category] += 1;
            add64(unitsLo, unitsHi, category, units);
            add64(revenueLo, revenueHi, category, column(words, 5, row));
          }
          const selected = indexes.subarray(0, matched);
          stableMergeSort(words, selected, temp, sortColumn, descending !== 0, counters);
          let out = q * OUTPUT_WORDS_PER_QUERY;
          output[out++] = q;
          output[out++] = matched;
          output[out++] = sortColumn;
          output[out++] = descending;
          output[out++] = filterDigest;
          output[out++] = TOP;
          output[out++] = CATEGORIES;
          output[out++] = controlRevision;
          for (let i = 0; i < TOP; i += 1) {
            const row = selected[i];
            output[out++] = row;
            output[out++] = column(words, 4, row);
            output[out++] = column(words, 5, row);
          }
          for (let bin = 0; bin < CATEGORIES; bin += 1) {
            output[out++] = count[bin];
            output[out++] = unitsLo[bin];
            output[out++] = unitsHi[bin];
            output[out++] = revenueLo[bin];
            output[out++] = revenueHi[bin];
          }
        }
        return { output, counters };
      }
      const fixture = makeFixture();
      const fixture32 = new Uint32Array(fixture.buffer);

      const callables = {};
      for (const key of ["c", "cpp", "rs"]) {
        const inst = mods.engines[key].instances.olap.instance;
        const mem = inst.exports.memory;
        callables[key] = {
          olap: () => {
            const inPtr = inst.exports.input_ptr();
            new Uint32Array(mem.buffer, inPtr, fixture32.length).set(fixture32);
            inst.exports.run(fixture.length);
          },
        };
      }
      callables.js = {
        olap: () => {
          runOlap(fixture);
        },
      };
      callables.dart = {
        olap: () => {
          const kernels = mods.engines.dart.kernels;
          const input = new Uint32Array(fixture32.buffer.slice(0));
          const result = new Uint32Array(OUTPUT_WORDS);
          kernels.run(input, result, fixture.length);
        },
      };
      return callables;
    },
  },

  // --- audio-fir: FIR direct convolution (mirrors audio-fir/workload.ts)
  "audio.fir.v1": {
    kernels: ["fir"],
    build(mods) {
      const SAMPLES = 16384, TAPS = 256;
      const xorshift = (state) => {
        state ^= state << 13;
        state >>>= 0;
        state ^= state >>> 17;
        state ^= state << 5;
        state >>>= 0;
        return state;
      };
      function signal() {
        let st = 0xa1b2c3d4;
        const d = new Float32Array(SAMPLES);
        for (let i = 0; i < SAMPLES; i++) {
          st = xorshift(st);
          d[i] = Math.fround((st / 0x1_0000_0000) * 2 - 1);
        }
        return d;
      }
      function taps() {
        const h = new Float32Array(TAPS);
        const fc = 0.25, center = Math.fround((TAPS - 1) / 2);
        for (let i = 0; i < TAPS; i++) {
          const nn = Math.fround(i - center);
          let sinc;
          if (nn === 0) sinc = Math.fround(2 * fc);
          else {
            const arg = Math.fround(Math.fround(2 * Math.PI * fc) * nn);
            sinc = Math.fround(Math.fround(Math.sin(arg)) / Math.fround(Math.PI * nn));
          }
          const w = Math.fround(
            0.5 -
              Math.fround(
                0.5 *
                  Math.fround(
                    Math.cos(Math.fround(Math.fround(2 * Math.PI * i) / Math.fround(TAPS - 1))),
                  ),
              ),
          );
          h[i] = Math.fround(sinc * w);
        }
        return h;
      }
      function jsFir(sig, tp) {
        const out = new Float32Array(sig.length + tp.length - 1);
        for (let i = 0; i < sig.length; i++) {
          const sample = sig[i];
          for (let j = 0; j < tp.length; j++) {
            out[i + j] = Math.fround(out[i + j] + Math.fround(sample * tp[j]));
          }
        }
        return out;
      }
      const callables = {};
      for (const key of ["c", "cpp", "rs"]) {
        const inst = mods.engines[key].instances.fir.instance;
        const mem = inst.exports.memory;
        callables[key] = {
          fir: () => {
            const sig = signal(), tp = taps();
            const inOff = 0, tapsOff = sig.byteLength, outOff = tapsOff + tp.byteLength;
            new Float32Array(mem.buffer, inOff, sig.length).set(sig);
            new Float32Array(mem.buffer, tapsOff, tp.length).set(tp);
            inst.exports.fir(inOff, tapsOff, outOff, sig.length, tp.length);
          },
        };
      }
      callables.js = { fir: () => jsFir(signal(), taps()) };
      callables.dart = {
        fir: () =>
          mods.engines.dart.kernels.fir(
            signal(),
            taps(),
            new Float32Array(SAMPLES + TAPS - 1),
            SAMPLES,
            TAPS,
          ),
      };
      return callables;
    },
  },

  // --- audio-stft: STFT (mirrors audio-stft/workload.ts stftInto + fftRadix2)
  "audio.stft.v1": {
    kernels: ["stft"],
    build(mods) {
      const SAMPLES = 8192, FRAME = 1024, HOP = 256;
      const FRAMES = 1 + Math.floor((SAMPLES - FRAME) / HOP);
      const xorshift = (state) => {
        state ^= state << 13;
        state >>>= 0;
        state ^= state >>> 17;
        state ^= state << 5;
        state >>>= 0;
        return state;
      };
      function signal() {
        let st = 0x13579bdf;
        const d = new Float32Array(SAMPLES);
        for (let i = 0; i < SAMPLES; i++) {
          st = xorshift(st);
          d[i] = Math.fround((st / 0x1_0000_0000) * 2 - 1);
        }
        return d;
      }
      function window() {
        const w = new Float32Array(FRAME);
        for (let i = 0; i < FRAME; i++) {
          w[i] = Math.fround(
            0.5 -
              Math.fround(
                0.5 *
                  Math.fround(
                    Math.cos(Math.fround(Math.fround(2 * Math.PI * i) / Math.fround(FRAME - 1))),
                  ),
              ),
          );
        }
        return w;
      }
      function twiddle() {
        // Mirrors audio-fft generateTwiddleTable: stage-structured entries.
        const stages = Math.log2(FRAME);
        const t = new Float32Array((FRAME - 1) * 2);
        let idx = 0;
        for (let stage = 0; stage < stages; stage++) {
          const halfLen = 1 << stage;
          for (let j = 0; j < halfLen; j++) {
            const angle = -Math.PI * j / halfLen;
            t[idx++] = Math.fround(Math.cos(angle));
            t[idx++] = Math.fround(Math.sin(angle));
          }
        }
        return t;
      }
      function fft(data, n, tw) {
        for (let i = 1, j = 0; i < n; i++) {
          let bit = n >> 1;
          for (; j & bit; bit >>= 1) j ^= bit;
          j ^= bit;
          if (i < j) {
            const ri = i * 2, rj = j * 2;
            let t = data[ri];
            data[ri] = data[rj];
            data[rj] = t;
            t = data[ri + 1];
            data[ri + 1] = data[rj + 1];
            data[rj + 1] = t;
          }
        }
        let twIdx = 0;
        for (let len = 2; len <= n; len <<= 1) {
          const halfLen = len >> 1;
          for (let i = 0; i < n; i += len) {
            let twp = twIdx;
            for (let j = 0; j < halfLen; j++) {
              const wCos = tw[twp], wSin = tw[twp + 1];
              const u = i + j, v = u + halfLen;
              const rv = data[v * 2], iv = data[v * 2 + 1];
              const tr = rv * wCos - iv * wSin;
              const ti = rv * wSin + iv * wCos;
              data[v * 2] = data[u * 2] - tr;
              data[v * 2 + 1] = data[u * 2 + 1] - ti;
              data[u * 2] += tr;
              data[u * 2 + 1] += ti;
              twp += 2;
            }
          }
          twIdx += 2;
        }
      }
      function jsStft(sig, win, tw) {
        const spec = new Float32Array(FRAMES * FRAME * 2);
        const scratch = new Float32Array(FRAME * 2);
        for (let frame = 0; frame < FRAMES; frame++) {
          const offset = frame * HOP;
          for (let i = 0; i < FRAME; i++) {
            scratch[i * 2] = Math.fround(sig[offset + i] * win[i]);
            scratch[i * 2 + 1] = 0;
          }
          fft(scratch, FRAME, tw);
          spec.set(scratch, frame * FRAME * 2);
        }
        return spec;
      }
      const callables = {};
      for (const key of ["c", "cpp", "rs"]) {
        const inst = mods.engines[key].instances.stft.instance;
        const mem = inst.exports.memory;
        callables[key] = {
          stft: () => {
            const sig = signal(), win = window(), tw = twiddle();
            let off = 0;
            const inOff = off;
            off += sig.byteLength;
            const winOff = off;
            off += win.byteLength;
            const twOff = off;
            off += tw.byteLength;
            const scratchOff = off;
            off += FRAME * 2 * 4;
            const specOff = off;
            new Float32Array(mem.buffer, inOff, sig.length).set(sig);
            new Float32Array(mem.buffer, winOff, win.length).set(win);
            new Float32Array(mem.buffer, twOff, tw.length).set(tw);
            inst.exports.stft(inOff, sig.length, FRAME, HOP, winOff, twOff, scratchOff, specOff);
          },
        };
      }
      callables.js = { stft: () => jsStft(signal(), window(), twiddle()) };
      callables.dart = {
        stft: () =>
          mods.engines.dart.kernels.stft(
            signal(),
            signal().length,
            FRAME,
            HOP,
            window(),
            twiddle(),
            new Float32Array(FRAME * 2),
            new Float32Array(FRAMES * FRAME * 2),
          ),
      };
      return callables;
    },
  },

  // --- multilang-wasm reference kernels: sum_u32 + fft_butterfly -----------
  "multilang-wasm": {
    kernels: ["sum", "fft"],
    build(mods) {
      const callables = {};
      for (const key of ["wat", "asc", "c", "cpp", "rs"]) {
        const cfg = mods.manifest.engines.find((e) => e.key === key);
        const { instances } = mods.engines[key];
        const call = {};
        if (instances.sum) {
          call.sum = () => {
            const arr = new Uint32Array(1000);
            for (let i = 0; i < 1000; i++) arr[i] = (i % 100) + 1;
            new Uint32Array(instances.sum.instance.exports.memory.buffer, cfg.offset, 1000).set(
              arr,
            );
            return instances.sum.instance.exports.sum_u32(cfg.offset, 1000);
          };
        }
        if (instances.fft) {
          call.fft = () => {
            const real = new Float32Array(512);
            const imag = new Float32Array(512);
            for (let i = 0; i < 512; i++) {
              real[i] = Math.sin(i * 0.1);
              imag[i] = Math.cos(i * 0.1);
            }
            const mem = instances.fft.instance.exports.memory;
            new Float32Array(mem.buffer, cfg.offset, 512).set(real);
            new Float32Array(mem.buffer, cfg.offset + 512 * 4, 512).set(imag);
            instances.fft.instance.exports.fft_butterfly(cfg.offset, cfg.offset + 512 * 4, 512);
            return real[17] + imag[29];
          };
        }
        callables[key] = call;
      }
      const { kernels } = mods.engines.dart;
      callables.js = {
        sum: () => {
          const arr = new Uint32Array(1000);
          for (let i = 0; i < 1000; i++) arr[i] = (i % 100) + 1;
          let s = 0;
          for (let i = 0; i < 1000; i++) s += arr[i];
          return s;
        },
        fft: () => {
          const real = new Float32Array(512);
          const imag = new Float32Array(512);
          for (let i = 0; i < 512; i++) {
            real[i] = Math.sin(i * 0.1);
            imag[i] = Math.cos(i * 0.1);
          }
          for (let step = 1; step < 512; step <<= 1) {
            const angle = -Math.PI / step;
            const wReal = Math.cos(angle);
            const wImag = Math.sin(angle);
            for (let i = 0; i < 512; i += step << 1) {
              let cwR = 1.0, cwI = 0.0;
              for (let j = 0; j < step; j++) {
                const u = i + j, v = i + j + step;
                const tr = real[v] * cwR - imag[v] * cwI;
                const ti = real[v] * cwI + imag[v] * cwR;
                real[v] = real[u] - tr;
                imag[v] = imag[u] - ti;
                real[u] += tr;
                imag[u] += ti;
                const nwR = cwR * wReal - cwI * wImag;
                const nwI = cwR * wImag + cwI * wReal;
                cwR = nwR;
                cwI = nwI;
              }
            }
          }
          return real[17] + imag[29];
        },
      };
      callables.dart = {
        sum: () => {
          const arr = new Uint32Array(1000);
          for (let i = 0; i < 1000; i++) arr[i] = (i % 100) + 1;
          return kernels.sum_u32(arr);
        },
        fft: () => {
          const real = new Float32Array(512);
          const imag = new Float32Array(512);
          for (let i = 0; i < 512; i++) {
            real[i] = Math.sin(i * 0.1);
            imag[i] = Math.cos(i * 0.1);
          }
          kernels.fft_butterfly(real, imag, 512);
          return real[17] + imag[29];
        },
      };
      return callables;
    },
  },

  // --- text-diff-patch: Myers O(ND) diff (mirrors v2 workload.js myersDiff) ----
  "text.diff-patch.v1": {
    kernels: ["myers_diff"],
    build(mods) {
      const LEN = 512, EDITS = 30;
      function inputs() {
        const base = new Uint32Array(LEN);
        for (let i = 0; i < LEN; i++) base[i] = i;
        const t = [];
        for (let i = 0; i < LEN; i++) t.push(base[i]);
        let st = 0xd1ff2026;
        const rnd = () => {
          st = (st * 1664525 + 1013904223) >>> 0;
          return st / 4294967296;
        };
        for (let e = 0; e < EDITS; e++) {
          const pos = Math.floor(rnd() * (t.length + 1));
          if (rnd() < 0.5) t.splice(pos, 0, 0xffff0000 + e);
          else if (t.length > 0) t.splice(Math.min(pos, t.length - 1), 1);
        }
        const target = new Uint32Array(t.length);
        target.set(t);
        return { base, target };
      }
      function layout(base, target) {
        const max = base.length + target.length;
        const vstride = 2 * max + 1;
        const cap = base.length + target.length + 1;
        return { max, vstride, cap };
      }
      const callables = {};
      for (const key of ["c", "cpp", "rs"]) {
        const inst = mods.engines[key].instances.myers_diff.instance;
        const mem = inst.exports.memory;
        callables[key] = {
          myers_diff: () => {
            const { base, target } = inputs();
            const { max, vstride, cap } = layout(base, target);
            const baseOff = 0, targetOff = 4096, scratchOff = 8192;
            const scratchBytes = vstride * (max + 2) * 4;
            const opOff = scratchOff + scratchBytes;
            const xOff = opOff + cap * 4, yOff = xOff + cap * 4;
            const edOff = yOff + cap * 4, fsOff = edOff + 4;
            new Uint32Array(mem.buffer, baseOff, base.length).set(base);
            new Uint32Array(mem.buffer, targetOff, target.length).set(target);
            inst.exports.myers_diff(
              baseOff,
              base.length,
              targetOff,
              target.length,
              opOff,
              xOff,
              yOff,
              cap,
              scratchOff,
              vstride * (max + 2),
              edOff,
              fsOff,
            );
          },
        };
      }
      callables.js = {
        myers_diff: () => {
          const { base, target } = inputs();
          const { max, cap } = layout(base, target);
          const outOp = new Uint32Array(cap),
            outX = new Uint32Array(cap),
            outY = new Uint32Array(cap);
          const offset = max;
          const v = new Int32Array(2 * max + 1);
          let prefix = 0;
          while (
            prefix < base.length && prefix < target.length && base[prefix] === target[prefix]
          ) prefix++;
          let suffix = 0;
          while (
            suffix < base.length - prefix && suffix < target.length - prefix &&
            base[base.length - 1 - suffix] === target[target.length - 1 - suffix]
          ) suffix++;
          const n = base.length - prefix - suffix, m = target.length - prefix - suffix;
          const rev = [];
          for (let index = 0; index < suffix; index++) {
            rev.push([0, base.length - 1 - index, target.length - 1 - index]);
          }
          let ed = 0;
          if (n === 0) {
            for (let y = m - 1; y >= 0; y--) rev.push([2, prefix, prefix + y]);
            ed = m;
          } else if (m === 0) {
            for (let x = n - 1; x >= 0; x--) rev.push([1, prefix + x, prefix]);
            ed = n;
          } else {
            v[offset + 1] = 0;
            const trace = [];
            outer: for (let d = 0; d <= max; d++) {
              for (let k = -d; k <= d; k += 2) {
                let x = (k === -d || (k !== d && v[offset + k - 1] < v[offset + k + 1]))
                  ? v[offset + k + 1]
                  : v[offset + k - 1] + 1;
                let y = x - k;
                while (x < n && y < m && base[prefix + x] === target[prefix + y]) {
                  x++;
                  y++;
                }
                v[offset + k] = x;
                if (x >= n && y >= m) {
                  trace.push(v.slice());
                  ed = d;
                  break outer;
                }
              }
              trace.push(v.slice());
            }
            let x = n, y = m;
            for (let d = ed; d > 0; d--) {
              const prior = trace[d - 1];
              const k = x - y;
              const down = k === -d || (k !== d && prior[offset + k - 1] < prior[offset + k + 1]);
              const previousK = down ? k + 1 : k - 1;
              const previousX = prior[offset + previousK];
              const previousY = previousX - previousK;
              while (x > previousX && y > previousY) {
                x--;
                y--;
                rev.push([0, prefix + x, prefix + y]);
              }
              if (down) {
                y--;
                rev.push([2, prefix + x, prefix + y]);
              } else {
                x--;
                rev.push([1, prefix + x, prefix + y]);
              }
            }
          }
          for (let index = prefix - 1; index >= 0; index--) rev.push([0, index, index]);
          rev.reverse();
          for (let i = 0; i < rev.length; i++) {
            outOp[i] = rev[i][0];
            outX[i] = rev[i][1];
            outY[i] = rev[i][2];
          }
        },
      };
      callables.dart = {
        myers_diff: () => {
          const { base, target } = inputs();
          const { max, vstride, cap } = layout(base, target);
          mods.engines.dart.kernels.myers_diff(
            base,
            target,
            new Uint32Array(cap),
            new Uint32Array(cap),
            new Uint32Array(cap),
            new Uint32Array(vstride * (max + 2)),
            cap,
            new Uint32Array(1),
            new Uint32Array(1),
          );
        },
      };
      return callables;
    },
  },

  // --- text-regex-log-scan: log pattern matcher (mirrors workload.js scanControlled)
  "text.regex-log-scan.v1": {
    kernels: ["scan_log"],
    build(mods) {
      const RECORDS = 640, EVENT_INTERVAL = 10;
      const PREFIXES = [
        "http://",
        "https://",
        "ws://",
        "wss://",
        "ftp://",
        "asset://",
        "api://",
        "cdn://",
        "ip=",
        "client-ip:",
        "source-ip:",
        "dest-ip:",
        "peer-ip:",
        "origin-ip:",
        "status=",
        "code=",
        "http-status:",
        "response-status:",
        "result-status:",
        "status-code:",
      ];
      const MATCHERS = [1, 1, 1, 1, 1, 1, 1, 1, 2, 2, 2, 2, 2, 2, 3, 3, 3, 3, 3, 3];
      function corpus() {
        const RECORD_BYTES = 256;
        const bytes = new Uint8Array(RECORDS * RECORD_BYTES);
        const filler = new TextEncoder().encode("日志 café 東京 🚀 запись record ");
        bytes.fill(0x20);
        for (let record = 0; record < RECORDS; record++) {
          const offset = record * RECORD_BYTES;
          bytes.set(filler, offset);
          const label = new TextEncoder().encode(String(record).padStart(6, "0"));
          bytes.set(label, offset + filler.byteLength);
          if (record % EVENT_INTERVAL === 0) {
            const eventIndex = record / EVENT_INTERVAL;
            const pi = eventIndex % 20;
            let v = (0x5a17c0de ^ eventIndex ^ Math.imul(pi + 1, 0x9e3779b1)) >>> 0;
            v ^= v << 13;
            v ^= v >>> 17;
            v ^= v << 5;
            v >>>= 0;
            let token;
            if (MATCHERS[pi] === 1) {
              token = `${PREFIXES[pi]}node-${
                v.toString(16).padStart(8, "0")
              }.example.test/path/${eventIndex}`;
            } else if (MATCHERS[pi] === 2) {
              token = `${PREFIXES[pi]}${1 + (v & 0xfe)}.${(v >>> 8) & 0xff}.${(v >>> 16) & 0xff}.${
                (v >>> 24) & 0xff
              }`;
            } else token = `${PREFIXES[pi]}${100 + (v % 500)}`;
            bytes.set(new TextEncoder().encode(token), offset + 64);
          }
          bytes[offset + RECORD_BYTES - 1] = 0x0a;
        }
        return bytes;
      }
      const callables = {};
      const CAP = 5000;
      for (const key of ["c", "cpp", "rs"]) {
        const inst = mods.engines[key].instances.scan_log.instance;
        const mem = inst.exports.memory;
        callables[key] = {
          scan_log: () => {
            const bytes = corpus();
            const dataOff = 4096, scratchOff = 2097152;
            const idOff = scratchOff + 256 * 5 * 4;
            const stOff = idOff + CAP * 4, enOff = stOff + CAP * 4;
            const csOff = enOff + CAP * 4, pcOff = csOff + 4, tcOff = pcOff + 4;
            new Uint8Array(mem.buffer, dataOff, bytes.length).set(bytes);
            inst.exports.scan_log(
              dataOff,
              bytes.length,
              idOff,
              stOff,
              enOff,
              CAP,
              scratchOff,
              csOff,
              pcOff,
              tcOff,
            );
          },
        };
      }
      callables.js = {
        scan_log: () => {
          const bytes = corpus();
          const buckets = Array.from({ length: 256 }, () => []);
          for (let i = 0; i < 20; i++) buckets[PREFIXES[i].charCodeAt(0)].push(i);
          const isUrlTail = (b) =>
            (b >= 97 && b <= 122) || (b >= 48 && b <= 57) || b === 46 || b === 47 || b === 95 ||
            b === 45;
          for (let start = 0; start < bytes.length; start++) {
            for (const pi of buckets[bytes[start]]) {
              const prefix = PREFIXES[pi];
              let matched = true;
              for (let i = 0; i < prefix.length; i++) {
                if (start + i >= bytes.length) {
                  matched = false;
                  break;
                }
                if (bytes[start + i] !== prefix.charCodeAt(i)) {
                  matched = false;
                  break;
                }
              }
              if (!matched) continue;
              const cursor = start + prefix.length;
              let end = -1;
              if (MATCHERS[pi] === 1) {
                const s0 = cursor;
                let c = cursor;
                while (c < bytes.length && c - s0 < 96) {
                  if (!isUrlTail(bytes[c])) break;
                  c++;
                }
                if (c === s0) end = -1;
                else if (c - s0 === 96 && c < bytes.length && isUrlTail(bytes[c])) end = -1;
                else end = c;
              } else if (MATCHERS[pi] === 2) {
                let c = cursor;
                let failed = false;
                for (let octet = 0; octet < 4; octet++) {
                  const s1 = c;
                  let value = 0;
                  while (c < bytes.length && c - s1 < 3) {
                    const b = bytes[c];
                    if (b < 48 || b > 57) break;
                    value = value * 10 + b - 48;
                    c++;
                  }
                  const digits = c - s1;
                  if (digits === 0 || value > 255 || (digits > 1 && bytes[s1] === 48)) {
                    failed = true;
                    break;
                  }
                  if (octet < 3) {
                    if (c >= bytes.length) {
                      failed = true;
                      break;
                    }
                    if (bytes[c] !== 46) {
                      failed = true;
                      break;
                    }
                    c++;
                  }
                }
                if (!failed) {
                  if (c < bytes.length) {
                    if (bytes[c] >= 48 && bytes[c] <= 57 || bytes[c] === 46) end = -1;
                    else end = c;
                  } else end = c;
                }
              } else {
                if (cursor + 3 <= bytes.length) {
                  const value = (bytes[cursor] - 48) * 100 + (bytes[cursor + 1] - 48) * 10 +
                    (bytes[cursor + 2] - 48);
                  if (value >= 100 && value <= 599) {
                    const ep = cursor + 3;
                    if (ep >= bytes.length || bytes[ep] < 48 || bytes[ep] > 57) end = ep;
                  }
                }
              }
              if (end >= 0) { /* counted */ }
            }
          }
        },
      };
      callables.dart = {
        scan_log: () => {
          const bytes = corpus();
          mods.engines.dart.kernels.scan_log(
            bytes,
            bytes.length,
            new Uint32Array(CAP),
            new Uint32Array(CAP),
            new Uint32Array(CAP),
            CAP,
            new Uint32Array(256 * 5),
            new Uint32Array(1),
            new Uint32Array(1),
            new Uint32Array(1),
          );
        },
      };
      return callables;
    },
  },

  // --- serialization-json-telemetry: JSON telemetry parser (mirrors v1 telemetry.c)
  "serialization.json-telemetry.v1": {
    kernels: ["telemetry"],
    build(mods) {
      const RECORDS = 1000;
      const ENC = new TextEncoder();
      const regions = ["ap", "eu", "na", "sa"], kinds = ["click", "purchase", "view"];
      const labels = ["Café", "東京", "مرحبا", "🚀"], tags = ["α", "数据", "mañana", "🧪"];
      const regionBytes = regions.map((x) => ENC.encode(x));
      const kindBytes = kinds.map((x) => ENC.encode(x));
      const labelBytes = labels.map((x) => ENC.encode(x));
      const tagBytes = tags.map((x) => ENC.encode(x));
      function fixture() {
        let st = 0x7e1e2026;
        const xorshift = () => {
          st ^= st << 13;
          st ^= st >>> 17;
          st ^= st << 5;
          return st >>> 0;
        };
        const parts = [];
        let total = 1;
        for (let i = 0; i < RECORDS; i++) {
          const r = regions[xorshift() % 4], k = kinds[xorshift() % 3];
          const ok = (xorshift() & 1) === 1, v = xorshift() % 10000;
          const l = labels[xorshift() % 4], t = tags[xorshift() % 4];
          const s = `${i ? "," : ""}{"id":${i},"ts":${
            1700000000 + i
          },"region":"${r}","kind":"${k}","ok":${ok},"value":${v},"meta":{"label":"${l}","tag":"${t}"}}`;
          const b = ENC.encode(s);
          parts.push(b);
          total += b.length;
        }
        const out = new Uint8Array(total + 1);
        let o = 0;
        out[o++] = 0x5b;
        for (const b of parts) {
          out.set(b, o);
          o += b.length;
        }
        out[o] = 0x5d;
        return out;
      }
      function jsParse(bytes) {
        // Faithful mirror of the C telemetry parser: same fields, same
        // vocabularies, same summary work (id/ts/value uints, region/kind/
        // label/tag options, boolean, counters).
        let at = 0, count = 0, okCount = 0, errCount = 0, valueSum = 0;
        const isDigit = (b) => b >= 0x30 && b <= 0x39;
        const expect = (s) => {
          for (let i = 0; i < s.length; i++) {
            if (bytes[at] !== s.charCodeAt(i)) return false;
            at++;
          }
          return true;
        };
        const uint = () => {
          let v = 0;
          while (at < bytes.length && isDigit(bytes[at])) {
            v = v * 10 + (bytes[at] - 0x30);
            at++;
          }
          return v;
        };
        const opt = (vocab) => {
          at++; // "
          for (let i = 0; i < vocab.length; i++) {
            const saved = at;
            let ok = true;
            for (let j = 0; j < vocab[i].length; j++) {
              if (bytes[at + j] !== vocab[i][j]) {
                ok = false;
                break;
              }
            }
            if (ok && bytes[at + vocab[i].length] === 0x22) {
              at += vocab[i].length + 1;
              return i;
            }
            at = saved;
          }
          return -1;
        };
        at++; // [
        while (at < bytes.length && bytes[at] !== 0x5d) {
          if (count) at++; // ,
          expect('{"id":');
          uint();
          expect(',"ts":');
          uint();
          expect(',"region":');
          opt(regionBytes);
          expect(',"kind":');
          opt(kindBytes);
          expect(',"ok":');
          const ok = bytes[at] === 0x74;
          at += ok ? 4 : 5;
          expect(',"value":');
          valueSum += uint();
          expect(',"meta":{"label":');
          opt(labelBytes);
          expect(',"tag":');
          opt(tagBytes);
          expect("}}");
          count++;
          okCount += ok ? 1 : 0;
          errCount += ok ? 0 : 1;
        }
        return { count, okCount, errCount, valueSum };
      }
      const callables = {};
      for (const key of ["c", "cpp", "rs"]) {
        const inst = mods.engines[key].instances.telemetry.instance;
        const mem = inst.exports.memory;
        callables[key] = {
          telemetry: () => {
            const bytes = fixture();
            const inOff = 0, outOff = bytes.byteLength + 1024, outCap = 4096;
            new Uint8Array(mem.buffer, inOff, bytes.length).set(bytes);
            inst.exports.process(inOff, bytes.length, outOff, outCap);
          },
        };
      }
      callables.js = { telemetry: () => jsParse(fixture()) };
      callables.dart = {
        telemetry: () =>
          mods.engines.dart.kernels.process(fixture(), RECORDS * 100, new Uint8Array(4096), 4096),
      };
      return callables;
    },
  },

  // --- simulation-nbody-cloth: O(N²) gravitational leapfrog (mirrors engine.js simulate)
  "simulation.nbody-cloth.v1": {
    kernels: ["nbody_step"],
    build(mods) {
      // Reduced fixed shape for fast warm medians (full contract is 1024x120).
      const N = 128, STEPS = 30, DT = 0.01, GRAVITY = 0.0001, SOFT2 = 0.0001;
      // First N bodies of the workload's frozen xorshift32(0x31c0ffee) stream
      // (fixture.js mirror): mass, px, py, pz, vx, vy, vz.
      function makeFixture() {
        let state = 0x31c0ffee;
        const xorshift = () => {
          state ^= state << 13;
          state ^= state >>> 17;
          state ^= state << 5;
          return state >>> 0;
        };
        const unit = (v) => v / 0x100000000;
        const mass = new Float64Array(N),
          px = new Float64Array(N),
          py = new Float64Array(N),
          pz = new Float64Array(N),
          vx = new Float64Array(N),
          vy = new Float64Array(N),
          vz = new Float64Array(N);
        for (let i = 0; i < N; i++) {
          state = xorshift();
          mass[i] = 0.5 + unit(state) * 1.5;
          state = xorshift();
          px[i] = unit(state) * 2 - 1;
          state = xorshift();
          py[i] = unit(state) * 2 - 1;
          state = xorshift();
          pz[i] = unit(state) * 2 - 1;
          state = xorshift();
          vx[i] = (unit(state) * 2 - 1) * 0.001;
          state = xorshift();
          vy[i] = (unit(state) * 2 - 1) * 0.001;
          state = xorshift();
          vz[i] = (unit(state) * 2 - 1) * 0.001;
        }
        return { mass, px, py, pz, vx, vy, vz };
      }
      function jsStep(f) {
        const ax = new Float64Array(N), ay = new Float64Array(N), az = new Float64Array(N);
        const accelerations = () => {
          for (let i = 0; i < N; i++) {
            let sx = 0, sy = 0, sz = 0;
            const x = f.px[i], y = f.py[i], z = f.pz[i];
            for (let j = 0; j < N; j++) {
              if (i === j) continue;
              const dx = f.px[j] - x, dy = f.py[j] - y, dz = f.pz[j] - z;
              const inv = 1 / Math.sqrt(dx * dx + dy * dy + dz * dz + SOFT2);
              const scale = GRAVITY * f.mass[j] * inv * inv * inv;
              sx += dx * scale;
              sy += dy * scale;
              sz += dz * scale;
            }
            ax[i] = sx;
            ay[i] = sy;
            az[i] = sz;
          }
        };
        accelerations();
        for (let step = 1; step <= STEPS; step++) {
          for (let i = 0; i < N; i++) {
            f.vx[i] += ax[i] * DT * 0.5;
            f.vy[i] += ay[i] * DT * 0.5;
            f.vz[i] += az[i] * DT * 0.5;
            f.px[i] += f.vx[i] * DT;
            f.py[i] += f.vy[i] * DT;
            f.pz[i] += f.vz[i] * DT;
          }
          accelerations();
          for (let i = 0; i < N; i++) {
            f.vx[i] += ax[i] * DT * 0.5;
            f.vy[i] += ay[i] * DT * 0.5;
            f.vz[i] += az[i] * DT * 0.5;
          }
        }
      }
      const callables = {};
      for (const key of ["c", "cpp", "rs"]) {
        const inst = mods.engines[key].instances.nbody_step.instance;
        const mem = inst.exports.memory;
        const bytesPer = N * 8;
        const off = (k) => k * bytesPer;
        callables[key] = {
          nbody_step: () => {
            const f = makeFixture();
            new Float64Array(mem.buffer, off(0), N).set(f.mass);
            new Float64Array(mem.buffer, off(1), N).set(f.px);
            new Float64Array(mem.buffer, off(2), N).set(f.py);
            new Float64Array(mem.buffer, off(3), N).set(f.pz);
            new Float64Array(mem.buffer, off(4), N).set(f.vx);
            new Float64Array(mem.buffer, off(5), N).set(f.vy);
            new Float64Array(mem.buffer, off(6), N).set(f.vz);
            inst.exports.nbody_step(
              off(0),
              off(1),
              off(2),
              off(3),
              off(4),
              off(5),
              off(6),
              off(7),
              off(8),
              off(9),
              off(10),
              N,
              STEPS,
              DT,
              GRAVITY,
              SOFT2,
            );
          },
        };
      }
      callables.js = {
        nbody_step: () => jsStep(makeFixture()),
      };
      callables.dart = {
        nbody_step: () => {
          const f = makeFixture();
          mods.engines.dart.kernels.nbody_step(
            f.mass,
            f.px,
            f.py,
            f.pz,
            f.vx,
            f.vy,
            f.vz,
            new Float64Array(N),
            new Float64Array(N),
            new Float64Array(N),
            new Float64Array(N * 6),
            N,
            STEPS,
            DT,
            GRAVITY,
            SOFT2,
          );
        },
      };
      return callables;
    },
  },

  // --- game-ecs-frame-update: ECS systems update (mirrors workload.js
  //     runEcsJavaScript — control velocity, wall-bounce movement, 128x128 grid
  //     collision, animation speed-class, FNV-1a state/checkpoint digests)
  "game.ecs-frame-update.v1": {
    kernels: ["ecs_frame_update"],
    build(mods) {
      const ENTITIES = 1024, FRAMES = 300;
      const GRID_WIDTH = 128, GRID_CELLS = 16384, CELL_SHIFT = 9;
      const CHECKPOINT_INTERVAL = 100;
      const ECS_MAGIC = 0x31435345;
      const PRIME = 0x01000193;

      // Seeded fixture generator (mirrors benchmarks/v1/.../fixture.js xorshift32).
      function makeFixture() {
        let state = 0x6ec5f17d >>> 0;
        const xorshift = () => {
          state ^= state << 13;
          state ^= state >>> 17;
          state ^= state << 5;
          return state >>> 0;
        };
        const bytes = new Uint8Array(16 + ENTITIES * 8 + FRAMES);
        const view = new DataView(bytes.buffer);
        view.setUint32(0, ECS_MAGIC, true);
        view.setUint32(4, ENTITIES, true);
        view.setUint32(8, FRAMES, true);
        view.setUint32(12, state >>> 0, true);
        let offset = 16;
        for (let e = 0; e < ENTITIES; e++) {
          state = xorshift();
          view.setUint16(offset, state & 0xffff, true);
          state = xorshift();
          view.setUint16(offset + 2, state & 0xffff, true);
          state = xorshift();
          bytes[offset + 4] = (state % 33) - 16;
          state = xorshift();
          bytes[offset + 5] = (state % 33) - 16;
          state = xorshift();
          bytes[offset + 6] = state & 3;
          state = xorshift();
          bytes[offset + 7] = 1 + (state % 8);
          offset += 8;
        }
        for (let f = 0; f < FRAMES; f++) {
          state = xorshift();
          bytes[16 + ENTITIES * 8 + f] = state & 0xff;
        }
        return bytes;
      }
      const fixture = makeFixture();

      // JS oracle — mirrors benchmarks/v1/game-ecs-frame-update/engine.js
      // runEcsJavaScript EXACTLY (FNV-1a mix, wall-bounce movement, grid
      // collision with the 4 cross-cell neighbours, speed-class animation).
      const mix = (hash, value) => Math.imul((hash ^ (value >>> 0)) >>> 0, PRIME) >>> 0;
      const hex = (v) => (v >>> 0).toString(16).padStart(8, "0");
      const clampVelocity = (v) => (v < -16 ? -16 : v > 16 ? 16 : v);
      const delta = (bits) => (bits === 3 ? 0 : bits - 1);
      function runEcs() {
        const view = new DataView(fixture.buffer, fixture.byteOffset, fixture.byteLength);
        const entities = view.getUint32(4, true);
        const frames = view.getUint32(8, true);
        const xs = new Uint16Array(entities), ys = new Uint16Array(entities);
        const vxs = new Int8Array(entities), vys = new Int8Array(entities);
        const animations = new Uint8Array(entities), radii = new Uint8Array(entities);
        const head = new Int32Array(GRID_CELLS), next = new Int32Array(entities);
        let offset = 16;
        for (let e = 0; e < entities; e++) {
          xs[e] = view.getUint16(offset, true);
          ys[e] = view.getUint16(offset + 2, true);
          vxs[e] = view.getInt8(offset + 4);
          vys[e] = view.getInt8(offset + 5);
          animations[e] = view.getUint8(offset + 6);
          radii[e] = view.getUint8(offset + 7);
          offset += 8;
        }
        const traceOffset = 16 + entities * 8;
        let movementUpdates = 0, controlMutations = 0, pairTests = 0, collisions = 0;
        let animationUpdates = 0, stateMutations = 0, checkpointCount = 0;
        let checkpointDigest = 0x5f356495;
        const processPair = (l, r) => {
          pairTests += 1;
          const reach = radii[l] + radii[r];
          const dx = xs[l] - xs[r], dy = ys[l] - ys[r];
          if (dx < -reach || dx > reach || dy < -reach || dy > reach) return;
          const lvx = vxs[l], lvy = vys[l];
          vxs[l] = vxs[r];
          vys[l] = vys[r];
          vxs[r] = lvx;
          vys[r] = lvy;
          collisions += 1;
          stateMutations += 4;
        };
        const processCrossCells = (lc, rc) => {
          for (let l = head[lc]; l >= 0; l = next[l]) {
            for (let r = head[rc]; r >= 0; r = next[r]) processPair(l, r);
          }
        };
        const canonicalState = () => {
          let digest = 0x7f4a7c15;
          for (let e = 0; e < entities; e++) {
            const values = [
              xs[e],
              ys[e],
              vxs[e] & 0xff,
              vys[e] & 0xff,
              animations[e],
              radii[e],
            ];
            digest = mix(digest, e);
            for (let i = 0; i < 6; i++) digest = mix(digest, values[i]);
          }
          return digest;
        };
        for (let frame = 0; frame < frames; frame++) {
          const control = fixture[traceOffset + frame];
          const sel = frame % 257;
          const cX = delta(control & 3), cY = delta((control >>> 2) & 3);
          for (let e = 0; e < entities; e++) {
            if (e % 257 === sel) {
              vxs[e] = clampVelocity(vxs[e] + cX);
              vys[e] = clampVelocity(vys[e] + cY);
              controlMutations += 2;
              stateMutations += 2;
            }
            let x = xs[e] + vxs[e], y = ys[e] + vys[e];
            if (x < 0) {
              x = -x;
              vxs[e] = -vxs[e];
              stateMutations += 1;
            } else if (x > 0xffff) {
              x = 0x1fffe - x;
              vxs[e] = -vxs[e];
              stateMutations += 1;
            }
            if (y < 0) {
              y = -y;
              vys[e] = -vys[e];
              stateMutations += 1;
            } else if (y > 0xffff) {
              y = 0x1fffe - y;
              vys[e] = -vys[e];
              stateMutations += 1;
            }
            xs[e] = x;
            ys[e] = y;
            movementUpdates += 1;
            stateMutations += 2;
          }
          head.fill(-1);
          for (let e = 0; e < entities; e++) {
            const cell = (ys[e] >>> CELL_SHIFT) * GRID_WIDTH + (xs[e] >>> CELL_SHIFT);
            next[e] = head[cell];
            head[cell] = e;
          }
          for (let cy = 0; cy < GRID_WIDTH; cy++) {
            for (let cx = 0; cx < GRID_WIDTH; cx++) {
              const cell = cy * GRID_WIDTH + cx;
              for (let l = head[cell]; l >= 0; l = next[l]) {
                for (let r = next[l]; r >= 0; r = next[r]) processPair(l, r);
              }
              if (cx + 1 < GRID_WIDTH) processCrossCells(cell, cell + 1);
              if (cy + 1 < GRID_WIDTH && cx > 0) processCrossCells(cell, cell + GRID_WIDTH - 1);
              if (cy + 1 < GRID_WIDTH) processCrossCells(cell, cell + GRID_WIDTH);
              if (cy + 1 < GRID_WIDTH && cx + 1 < GRID_WIDTH) {
                processCrossCells(cell, cell + GRID_WIDTH + 1);
              }
            }
          }
          const cAnim = (control >>> 4) & 1;
          for (let e = 0; e < entities; e++) {
            const speed = (Math.abs(vxs[e]) + Math.abs(vys[e])) & 3;
            animations[e] = (animations[e] + 1 + speed + cAnim) & 0xff;
            animationUpdates += 1;
            stateMutations += 1;
          }
          if ((frame + 1) % CHECKPOINT_INTERVAL === 0 || frame + 1 === frames) {
            const stateDigest = canonicalState();
            checkpointDigest = mix(checkpointDigest, frame + 1);
            checkpointDigest = mix(checkpointDigest, stateDigest);
            checkpointDigest = mix(checkpointDigest, pairTests);
            checkpointCount += 1;
          }
        }
        const stateDigest = canonicalState();
        return {
          stateDigest: hex(stateDigest),
          checkpointDigest: hex(checkpointDigest),
          pairTests,
          collisions,
          animationUpdates,
          controlMutations,
          stateMutations,
        };
      }
      const keyOf = (r) =>
        `${r.stateDigest}:${r.checkpointDigest}:${r.pairTests}:${r.collisions}:` +
        `${r.animationUpdates}:${r.controlMutations}:${r.stateMutations}`;
      const expected = keyOf(runEcs());

      const callables = {};
      for (const key of ["c", "cpp", "rs"]) {
        const inst = mods.engines[key].instances.ecs_frame_update.instance;
        const mem = inst.exports.memory;
        callables[key] = {
          ecs_frame_update: () => {
            const input = new Uint8Array(mem.buffer, inst.exports.input_ptr(), fixture.length);
            input.set(fixture);
            if (inst.exports.run(fixture.length) !== 0) throw new Error(`${key} ecs run failed`);
            const w = new Uint32Array(mem.buffer, inst.exports.result_ptr(), 128);
            return keyOf({
              stateDigest: hex(w[0]),
              checkpointDigest: hex(w[1]),
              pairTests: w[23],
              collisions: w[24],
              animationUpdates: w[25],
              controlMutations: w[27],
              stateMutations: w[28],
            });
          },
        };
      }
      callables.js = {
        ecs_frame_update: () => keyOf(runEcs()),
      };
      callables.dart = {
        ecs_frame_update: () => {
          const result = new Uint32Array(128 + ENTITIES * 6);
          mods.engines.dart.kernels.run(fixture, result);
          return keyOf({
            stateDigest: hex(result[0]),
            checkpointDigest: hex(result[1]),
            pairTests: result[23],
            collisions: result[24],
            animationUpdates: result[25],
            controlMutations: result[27],
            stateMutations: result[28],
          });
        },
      };
      // One-time bit-identity guard: every engine must produce the oracle key
      // or the run fails loudly (no silent exclusion / fabricated equivalence).
      for (const key of Object.keys(callables)) {
        const got = callables[key].ecs_frame_update();
        if (got !== expected) {
          throw new Error(
            `ecs_frame_update ${key} digest mismatch: got=${got} expected=${expected}`,
          );
        }
      }
      return callables;
    },
  },
  // --- ml-dense-mlp: dense MLP forward (mirrors workload.js mlpControlled)
  "ml.dense-mlp.v1": {
    kernels: ["mlp_forward"],
    build(mods) {
      const B = 16, W = 128, HIDDEN = 4, LAYERS = HIDDEN + 1;
      const LN2 = 0.6931471805599453;
      const EXP_COEFFS = [
        1.0,
        1.0,
        0.5,
        0.16666666666666666,
        0.041666666666666664,
        0.008333333333333333,
        0.001388888888888889,
        0.0001984126984126984,
        0.0000248015873015873,
        0.0000027557319223985893,
        0.0000002755731922398589,
        0.000000025052108385441718,
        0.00000000208767569878681,
      ];
      function pow2Exact(k) {
        const b = new DataView(new ArrayBuffer(8));
        b.setUint32(0, 0, true);
        b.setUint32(4, (k + 1023) << 20, true);
        return b.getFloat64(0, true);
      }
      function frozenExp(x) {
        if (Number.isNaN(x)) return x;
        if (x > 709.7827) return Infinity;
        if (x < -708.39) return 0;
        const k = Math.floor(x / LN2 + 0.5);
        const r = x - k * LN2;
        let p = EXP_COEFFS[12];
        for (let i = 11; i >= 0; i--) p = p * r + EXP_COEFFS[i];
        return p * pow2Exact(k);
      }
      function frozenTanh(x) {
        if (Number.isNaN(x)) return x;
        if (x >= 9.011) return 1;
        if (x <= -9.011) return -1;
        return 1 - 2 / (frozenExp(2 * x) + 1);
      }
      function geluFrozen(p) {
        const inner = 0.7978845608028654 * (p + 0.044715 * ((p * p) * p));
        return 0.5 * p * (1 + frozenTanh(inner));
      }
      function inputs() {
        const x = new Float32Array(B * W),
          w = new Float32Array(LAYERS * W * W),
          bias = new Float32Array(LAYERS * W);
        let s = 0x5a17c0de;
        const next = () => {
          s = (s * 1664525 + 1013904223) >>> 0;
          return Math.fround((s / 4294967296) * 2 - 1);
        };
        for (let i = 0; i < x.length; i++) x[i] = next();
        for (let i = 0; i < w.length; i++) w[i] = Math.fround(next() * 0.0625);
        for (let i = 0; i < bias.length; i++) bias[i] = Math.fround(next() * 0.25);
        return { x, w, bias };
      }
      const callables = {};
      for (const key of ["c", "cpp", "rs"]) {
        const inst = mods.engines[key].instances.mlp_forward.instance;
        const mem = inst.exports.memory;
        callables[key] = {
          mlp_forward: () => {
            const { x, w, bias } = inputs();
            const xOff = 0, wOff = xOff + B * W * 4, biasOff = wOff + LAYERS * W * W * 4;
            const sAOff = biasOff + LAYERS * W * 4,
              sBOff = sAOff + B * W * 4,
              yOff = sBOff + B * W * 4;
            new Float32Array(mem.buffer, xOff, B * W).set(x);
            new Float32Array(mem.buffer, wOff, LAYERS * W * W).set(w);
            new Float32Array(mem.buffer, biasOff, LAYERS * W).set(bias);
            inst.exports.mlp_forward(xOff, wOff, biasOff, sAOff, sBOff, yOff, B, W, HIDDEN);
          },
        };
      }
      callables.js = {
        mlp_forward: () => {
          const { x, w, bias } = inputs();
          const sA = new Float32Array(B * W),
            sB = new Float32Array(B * W),
            y = new Float32Array(B * W);
          let input = x;
          for (let layer = 0; layer < LAYERS; layer++) {
            const out = layer === LAYERS - 1 ? y : layer % 2 === 0 ? sA : sB;
            for (let bi = 0; bi < B; bi++) {
              for (let o = 0; o < W; o++) {
                let acc = bias[layer * W + o];
                for (let i = 0; i < W; i++) {
                  acc = Math.fround(
                    acc + Math.fround(input[bi * W + i] * w[layer * W * W + i * W + o]),
                  );
                }
                out[bi * W + o] = acc + 0;
              }
            }
            if (layer < LAYERS - 1) {
              for (let idx = 0; idx < out.length; idx++) {
                out[idx] = Math.fround(geluFrozen(out[idx])) + 0;
              }
            }
            input = out;
          }
        },
      };
      callables.dart = {
        mlp_forward: () => {
          const { x, w, bias } = inputs();
          mods.engines.dart.kernels.mlp_forward(
            x,
            w,
            bias,
            new Float32Array(B * W),
            new Float32Array(B * W),
            new Float32Array(B * W),
            B,
            W,
            HIDDEN,
          );
        },
      };
      return callables;
    },
  },

  // --- image-editing: integer-only pixel kernels (mirrors
  // benchmarks/image-editing: flood fill + luma Gaussian pipeline on the
  // pinned repo fixtures, exact oracle semantics, counters included) -------
  "image-editing.v1": {
    kernels: ["flood_fill", "luma_gaussian_pipeline"],
    build(mods) {
      const FLOOD_W = 64, FLOOD_H = 48, PIPE_W = 40, PIPE_H = 30;
      const SRC = 0, OUT = 16384, MASK = 32768;
      function nextXor(state) {
        state ^= state << 13;
        state ^= state >>> 17;
        state ^= state << 5;
        return state >>> 0;
      }
      function setPx(rgba, width, x, y, r, g, b, a) {
        const o = (y * width + x) * 4;
        rgba[o] = r;
        rgba[o + 1] = g;
        rgba[o + 2] = b;
        rgba[o + 3] = a;
      }
      function floodFixture() {
        const width = FLOOD_W, height = FLOOD_H;
        const rgba = new Uint8Array(width * height * 4);
        let state = 0x34c2a91d;
        for (let y = 0; y < height; y += 1) {
          for (let x = 0; x < width; x += 1) {
            state = nextXor(state);
            const v = state % 9;
            setPx(
              rgba,
              width,
              x,
              y,
              72 + v,
              110 + ((v * 3) % 9),
              144 + ((v * 5) % 9),
              220 + (v % 5),
            );
          }
        }
        for (let x = 5; x < width - 5; x += 1) {
          if (x !== Math.floor(width / 2)) setPx(rgba, width, x, 8, 205, 54, 62, 255);
        }
        for (let y = 8; y < height - 6; y += 1) {
          setPx(rgba, width, 5, y, 205, 54, 62, 255);
          if (y !== Math.floor(height / 2)) setPx(rgba, width, width - 6, y, 205, 54, 62, 255);
        }
        for (let x = 5; x < width - 5; x += 1) setPx(rgba, width, x, height - 7, 205, 54, 62, 255);
        const innerLeft = Math.floor(width / 3), innerRight = width - innerLeft - 1;
        const innerTop = Math.floor(height / 3), innerBottom = height - innerTop - 1;
        for (let x = innerLeft; x <= innerRight; x += 1) {
          if (x !== innerLeft + 2) setPx(rgba, width, x, innerTop, 18, 24, 31, 255);
          setPx(rgba, width, x, innerBottom, 18, 24, 31, 255);
        }
        for (let y = innerTop; y <= innerBottom; y += 1) {
          setPx(rgba, width, innerLeft, y, 18, 24, 31, 255);
          setPx(rgba, width, innerRight, y, 18, 24, 31, 255);
        }
        for (let y = 2; y < Math.min(height - 2, 12); y += 1) {
          for (let x = width - 14; x < width - 2; x += 1) {
            if ((x + y) % 3 === 0) setPx(rgba, width, x, y, 0, 0, 0, 0);
          }
        }
        return rgba;
      }
      function pipeFixture() {
        const width = PIPE_W, height = PIPE_H;
        const rgba = new Uint8Array(width * height * 4);
        let state = 0x8f31d4c7;
        for (let y = 0; y < height; y += 1) {
          for (let x = 0; x < width; x += 1) {
            state = nextXor(state);
            const noise = state & 31;
            setPx(
              rgba,
              width,
              x,
              y,
              (x * 5 + y * 3 + noise) & 255,
              (x * 2 + y * 7 + ((noise * 3) & 63)) & 255,
              (x * 9 + y + ((noise * 5) & 127)) & 255,
              255,
            );
          }
        }
        return rgba;
      }
      const flood = floodFixture();
      const photo = pipeFixture();

      // JS kernels maintain the same ABI work counters as the Wasm variants
      // (exact oracle semantics — the comparison stays apples-to-apples).
      function jsFlood() {
        const width = FLOOD_W, height = FLOOD_H;
        const pixels = width * height;
        const output = new Uint8Array(flood);
        const visited = new Uint8Array(pixels);
        const stack = new Uint32Array(pixels);
        let readBytes = 4, writeBytes = 0, neighborTests = 0;
        let stackPushes = 0, stackPops = 0, maxFrontier = 0, stackSize = 0;
        let visitedPixels = 0, changedPixels = 0, operations = 4;
        const seedIndex = 12 * width + 10;
        const so = seedIndex * 4;
        const seedR = flood[so],
          seedG = flood[so + 1],
          seedB = flood[so + 2],
          seedA = flood[so + 3];
        if (seedR === 34 && seedG === 139 && seedB === 230 && seedA === 191) return output;
        const push = (index) => {
          visited[index] = 1;
          stack[stackSize] = index;
          stackSize += 1;
          stackPushes += 1;
          writeBytes += 5;
          if (stackSize > maxFrontier) maxFrontier = stackSize;
        };
        const tryPush = (index) => {
          neighborTests += 1;
          operations += 1;
          readBytes += 1;
          if (visited[index] === 0) push(index);
        };
        push(seedIndex);
        while (stackSize !== 0) {
          stackSize -= 1;
          const index = stack[stackSize];
          stackPops += 1;
          visitedPixels += 1;
          readBytes += 8;
          const o = index * 4;
          let maximum = Math.abs(flood[o] - seedR);
          let d = Math.abs(flood[o + 1] - seedG);
          if (d > maximum) maximum = d;
          d = Math.abs(flood[o + 2] - seedB);
          if (d > maximum) maximum = d;
          d = Math.abs(flood[o + 3] - seedA);
          if (d > maximum) maximum = d;
          operations += 8;
          if (maximum <= 12) {
            output[o] = 34;
            output[o + 1] = 139;
            output[o + 2] = 230;
            output[o + 3] = 191;
            changedPixels += 1;
            writeBytes += 4;
            const x = index % width, y = Math.floor(index / width);
            if (y > 0) tryPush(index - width);
            if (x + 1 < width) tryPush(index + 1);
            if (y + 1 < height) tryPush(index + width);
            if (x > 0) tryPush(index - 1);
          }
        }
        return output;
      }
      function jsPipeline() {
        const width = PIPE_W, height = PIPE_H;
        const pixels = width * height;
        const output = new Uint8Array(pixels * 4);
        const luma = new Uint8Array(pixels);
        const horizontal = new Uint16Array(pixels);
        for (let index = 0; index < pixels; index += 1) {
          const o = index * 4;
          luma[index] = (77 * photo[o] + 150 * photo[o + 1] + 29 * photo[o + 2] + 128) >> 8;
        }
        for (let index = 0; index < pixels; index += 1) {
          const x = index % width;
          const left = x === 0 ? index : index - 1;
          const right = x + 1 >= width ? index : index + 1;
          horizontal[index] = luma[left] + 2 * luma[index] + luma[right];
        }
        for (let index = 0; index < pixels; index += 1) {
          const y = Math.floor(index / width);
          const top = y === 0 ? index : index - width;
          const bottom = y + 1 >= height ? index : index + width;
          const value = (horizontal[top] + 2 * horizontal[index] + horizontal[bottom] + 8) >> 4;
          const o = index * 4;
          output[o] = value;
          output[o + 1] = value;
          output[o + 2] = value;
          output[o + 3] = photo[o + 3];
        }
        return output;
      }

      const callables = { js: { flood_fill: jsFlood, luma_gaussian_pipeline: jsPipeline } };
      for (const key of ["c", "cpp", "rs", "asc"]) {
        const floodInst = mods.engines[key].instances.flood_fill.instance;
        const pipeInst = mods.engines[key].instances.luma_gaussian_pipeline.instance;
        const floodMem = new Uint8Array(floodInst.exports.memory.buffer);
        const pipeMem = new Uint8Array(pipeInst.exports.memory.buffer);
        callables[key] = {
          flood_fill: () => {
            floodMem.set(flood, SRC);
            floodMem.set(flood, OUT);
            floodMem.fill(0, MASK, MASK + FLOOD_W * FLOOD_H);
            floodInst.exports.flood_fill(FLOOD_W, FLOOD_H, 10, 12);
          },
          luma_gaussian_pipeline: () => {
            pipeMem.set(photo, SRC);
            pipeInst.exports.luma_gaussian_pipeline(PIPE_W, PIPE_H);
          },
        };
      }
      const dk = mods.engines.dart.kernels;
      callables.dart = {
        flood_fill: () => {
          dk.flood_fill(
            flood,
            new Uint8Array(flood),
            new Uint8Array(FLOOD_W * FLOOD_H),
            new Uint32Array(9),
            FLOOD_W,
            FLOOD_H,
            10,
            12,
          );
        },
        luma_gaussian_pipeline: () => {
          dk.luma_gaussian_pipeline(
            photo,
            new Uint8Array(photo.byteLength),
            new Uint8Array(PIPE_W * PIPE_H),
            new Uint16Array(PIPE_W * PIPE_H),
            new Uint32Array(9),
            PIPE_W,
            PIPE_H,
          );
        },
      };
      return callables;
    },
  },

  // --- ml-gemm: strict-f32 GEMM (mirrors benchmarks/v2/ml-gemm) -------------
  "ml.gemm.v1": {
    kernels: ["gemm"],
    build(mods) {
      const M = 128, N = 128, K = 128;
      function inputs() {
        const a = new Float32Array(M * K);
        const b = new Float32Array(K * N);
        const c0 = new Float32Array(M * N);
        let s = 0x91e10da5;
        for (let i = 0; i < a.length; i++) {
          s = (s * 1664525 + 1013904223) >>> 0;
          a[i] = Math.fround((s / 4294967296) * 2 - 1);
        }
        for (let i = 0; i < b.length; i++) {
          s = (s * 1664525 + 1013904223) >>> 0;
          b[i] = Math.fround((s / 4294967296) * 2 - 1);
        }
        for (let i = 0; i < c0.length; i++) {
          s = (s * 1664525 + 1013904223) >>> 0;
          c0[i] = Math.fround((s / 4294967296) * 2 - 1);
        }
        return { a, b, c0 };
      }
      const callables = {};
      for (const key of ["c", "cpp", "rs"]) {
        const inst = mods.engines[key].instances.gemm.instance;
        const mem = inst.exports.memory;
        const aOff = 0, bOff = M * K * 4, c0Off = (M * K + K * N) * 4;
        const outOff = (M * K + K * N + M * N) * 4;
        callables[key] = {
          gemm: () => {
            const { a, b, c0 } = inputs();
            new Float32Array(mem.buffer, aOff, M * K).set(a);
            new Float32Array(mem.buffer, bOff, K * N).set(b);
            new Float32Array(mem.buffer, c0Off, M * N).set(c0);
            inst.exports.gemm(aOff, bOff, c0Off, outOff, M, N, K);
          },
        };
      }
      const jsGemm = (a, b, c0, out) => {
        for (let i = 0; i < M; i++) {
          for (let j = 0; j < N; j++) {
            let acc = c0[i * N + j];
            for (let t = 0; t < K; t++) {
              acc = Math.fround(acc + Math.fround(a[i * K + t] * b[t * N + j]));
            }
            out[i * N + j] = acc + 0;
          }
        }
      };
      callables.js = {
        gemm: () => {
          const { a, b, c0 } = inputs();
          jsGemm(a, b, c0, new Float32Array(M * N));
        },
      };
      callables.dart = {
        gemm: () => {
          const { a, b, c0 } = inputs();
          mods.engines.dart.kernels.gemm(a, b, c0, new Float32Array(M * N), M, N, K);
        },
      };
      return callables;
    },
  },

  // --- crypto.file-integrity.v1 (SHA-256) ----------------------------------
  "crypto.file-integrity.v1": {
    kernels: ["sha256"],
    build(mods) {
      const FIXTURE_BYTES = 1 << 20; // 1 MiB — smallest registered fixture size
      const CHUNK = 65536; // 64 KiB — registered mid schedule
      const FIXTURE_SEED = 0x6d2b79f5;

      // Seeded xorshift generator (mirrors benchmarks/base/crypto-file-integrity/workload.js).
      function makeFixture() {
        const out = new Uint8Array(FIXTURE_BYTES);
        let state = FIXTURE_SEED >>> 0;
        for (let offset = 0; offset < out.length;) {
          state ^= state << 13;
          state ^= state >>> 17;
          state ^= state << 5;
          state >>>= 0;
          for (let i = 0; i < 4 && offset < out.length; i++, offset++) {
            out[offset] = state >>> (i * 8);
          }
        }
        return out;
      }
      const fixture = makeFixture();

      // JS oracle — mirrors benchmarks/base/crypto-file-integrity/sha256.js
      // (ControlledSha256: same K table, block buffering, u64 bit length).
      const K256 = new Uint32Array([
        0x428a2f98,
        0x71374491,
        0xb5c0fbcf,
        0xe9b5dba5,
        0x3956c25b,
        0x59f111f1,
        0x923f82a4,
        0xab1c5ed5,
        0xd807aa98,
        0x12835b01,
        0x243185be,
        0x550c7dc3,
        0x72be5d74,
        0x80deb1fe,
        0x9bdc06a7,
        0xc19bf174,
        0xe49b69c1,
        0xefbe4786,
        0x0fc19dc6,
        0x240ca1cc,
        0x2de92c6f,
        0x4a7484aa,
        0x5cb0a9dc,
        0x76f988da,
        0x983e5152,
        0xa831c66d,
        0xb00327c8,
        0xbf597fc7,
        0xc6e00bf3,
        0xd5a79147,
        0x06ca6351,
        0x14292967,
        0x27b70a85,
        0x2e1b2138,
        0x4d2c6dfc,
        0x53380d13,
        0x650a7354,
        0x766a0abb,
        0x81c2c92e,
        0x92722c85,
        0xa2bfe8a1,
        0xa81a664b,
        0xc24b8b70,
        0xc76c51a3,
        0xd192e819,
        0xd6990624,
        0xf40e3585,
        0x106aa070,
        0x19a4c116,
        0x1e376c08,
        0x2748774c,
        0x34b0bcb5,
        0x391c0cb3,
        0x4ed8aa4a,
        0x5b9cca4f,
        0x682e6ff3,
        0x748f82ee,
        0x78a5636f,
        0x84c87814,
        0x8cc70208,
        0x90befffa,
        0xa4506ceb,
        0xbef9a3f7,
        0xc67178f2,
      ]);
      const rotr = (x, n) => (x >>> n) | (x << (32 - n));
      function jsSha256(bytes) {
        const state = new Uint32Array(8);
        state.set([
          0x6a09e667,
          0xbb67ae85,
          0x3c6ef372,
          0xa54ff53a,
          0x510e527f,
          0x9b05688c,
          0x1f83d9ab,
          0x5be0cd19,
        ]);
        const block = new Uint8Array(64);
        const words = new Uint32Array(64);
        let blockLen = 0;
        let total = 0;
        const compress = () => {
          for (let i = 0; i < 16; i++) {
            const j = i * 4;
            words[i] =
              ((block[j] << 24) | (block[j + 1] << 16) | (block[j + 2] << 8) | block[j + 3]) >>> 0;
          }
          for (let i = 16; i < 64; i++) {
            const x = words[i - 15], y = words[i - 2];
            const s0 = rotr(x, 7) ^ rotr(x, 18) ^ (x >>> 3);
            const s1 = rotr(y, 17) ^ rotr(y, 19) ^ (y >>> 10);
            words[i] = (words[i - 16] + s0 + words[i - 7] + s1) >>> 0;
          }
          let [a, b, c, d, e, f, g, h] = state;
          for (let i = 0; i < 64; i++) {
            const s1 = rotr(e, 6) ^ rotr(e, 11) ^ rotr(e, 25);
            const ch = (e & f) ^ (~e & g);
            const t1 = (h + s1 + ch + K256[i] + words[i]) >>> 0;
            const s0 = rotr(a, 2) ^ rotr(a, 13) ^ rotr(a, 22);
            const maj = (a & b) ^ (a & c) ^ (b & c);
            const t2 = (s0 + maj) >>> 0;
            h = g;
            g = f;
            f = e;
            e = (d + t1) >>> 0;
            d = c;
            c = b;
            b = a;
            a = (t1 + t2) >>> 0;
          }
          state[0] = (state[0] + a) >>> 0;
          state[1] = (state[1] + b) >>> 0;
          state[2] = (state[2] + c) >>> 0;
          state[3] = (state[3] + d) >>> 0;
          state[4] = (state[4] + e) >>> 0;
          state[5] = (state[5] + f) >>> 0;
          state[6] = (state[6] + g) >>> 0;
          state[7] = (state[7] + h) >>> 0;
        };
        for (let off = 0; off < bytes.length; off += CHUNK) {
          const end = Math.min(bytes.length, off + CHUNK);
          total += end - off;
          let offset = off;
          while (offset < end) {
            const take = Math.min(64 - blockLen, end - offset);
            for (let i = 0; i < take; i++) block[blockLen + i] = bytes[offset + i];
            blockLen += take;
            offset += take;
            if (blockLen === 64) {
              compress();
              blockLen = 0;
            }
          }
        }
        const bitLength = BigInt(total) * 8n;
        block[blockLen++] = 0x80;
        if (blockLen > 56) {
          block.fill(0, blockLen);
          compress();
          blockLen = 0;
        }
        block.fill(0, blockLen, 56);
        for (let i = 0; i < 8; i++) block[63 - i] = Number((bitLength >> BigInt(i * 8)) & 255n);
        compress();
        const out = new Uint8Array(32);
        for (let i = 0; i < 8; i++) {
          const x = state[i];
          out[i * 4] = x >>> 24;
          out[i * 4 + 1] = x >>> 16;
          out[i * 4 + 2] = x >>> 8;
          out[i * 4 + 3] = x;
        }
        return out;
      }
      const expected = jsSha256(fixture);
      const hexBytes = (b) => [...b].map((v) => v.toString(16).padStart(2, "0")).join("");
      // Linear engines: input base is probed above each module's statics (rustc
      // places the digest/state near the top of its default 17-page memory, so a
      // fixed low offset would be overwritten by the 1 MiB input — the C/C++
      // modules place statics low and probe to 128 KiB, matching the workload).
      function linearBase(inst) {
        inst.exports.sha256_reset();
        const digestPtr = inst.exports.sha256_finish();
        return Math.ceil((digestPtr + 64) / 65536) * 65536;
      }
      const callables = {};
      for (const key of ["c", "cpp", "rs"]) {
        const inst = mods.engines[key].instances.sha256.instance;
        const mem = inst.exports.memory;
        const base = linearBase(inst);
        callables[key] = {
          sha256: () => {
            if (mem.buffer.byteLength < base + fixture.length) {
              mem.grow(Math.ceil((base + fixture.length - mem.buffer.byteLength) / 65536));
            }
            new Uint8Array(mem.buffer, base, fixture.length).set(fixture);
            inst.exports.sha256_reset();
            for (let off = 0; off < fixture.length; off += CHUNK) {
              inst.exports.sha256_update(base + off, Math.min(CHUNK, fixture.length - off));
            }
            return hexBytes(new Uint8Array(mem.buffer, inst.exports.sha256_finish(), 32));
          },
        };
      }
      callables.js = {
        sha256: () => hexBytes(jsSha256(fixture)),
      };
      callables.dart = {
        sha256: () => {
          const kernels = mods.engines.dart.kernels;
          kernels.sha256_reset();
          for (let off = 0; off < fixture.length; off += CHUNK) {
            kernels.sha256_update(
              fixture.subarray(off, Math.min(off + CHUNK, fixture.length)),
              Math.min(CHUNK, fixture.length - off),
            );
          }
          const out = new Uint8Array(32);
          kernels.sha256_finish(out);
          return hexBytes(out);
        },
      };
      // One-time bit-identity guard: every engine must produce the oracle digest
      // or the run fails loudly (no silent exclusion / fabricated equivalence).
      for (const key of Object.keys(callables)) {
        const got = callables[key].sha256();
        if (got !== hexBytes(expected)) {
          throw new Error(
            `sha256 ${key} digest mismatch: got=${got} expected=${hexBytes(expected)}`,
          );
        }
      }
      return callables;
    },
  },

  // --- numeric.polybench-panel.v1 -------------------------------------------
  "numeric.polybench-panel.v1": {
    kernels: ["polybench"],
    build(mods) {
      const NI = 20, NJ = 25, NK = 30, N_CHOLESKY = 40, N_GRID = 30, STEPS = 20;
      function makeGemmFixture() {
        const a = new Float64Array(NI * NK);
        const b = new Float64Array(NK * NJ);
        const c = new Float64Array(NI * NJ);
        for (let i = 0; i < NI; i++) {
          for (let k = 0; k < NK; k++) a[i * NK + k] = (i * (k + 1) % NK) / NK;
        }
        for (let k = 0; k < NK; k++) {
          for (let j = 0; j < NJ; j++) b[k * NJ + j] = (k * (j + 2) % NJ) / NJ;
        }
        for (let i = 0; i < NI; i++) {
          for (let j = 0; j < NJ; j++) c[i * NJ + j] = (i * j + 1) % NI / NI;
        }
        return { a, b, c, alpha: 1.5, beta: 1.2 };
      }
      function makeCholeskyFixture() {
        const n = N_CHOLESKY;
        const lower = new Float64Array(n * n);
        const a = new Float64Array(n * n);
        for (let i = 0; i < n; i++) {
          for (let j = 0; j <= i; j++) lower[i * n + j] = 1 - (j % n) / n;
          lower[i * n + i] = 1;
        }
        for (let i = 0; i < n; i++) {
          for (let j = 0; j < n; j++) {
            let sum = 0;
            for (let k = 0; k < n; k++) sum += lower[i * n + k] * lower[j * n + k];
            a[i * n + j] = sum;
          }
        }
        return { a, n };
      }
      function makeGridFixture() {
        const n = N_GRID;
        const a = new Float64Array(n * n);
        const b = new Float64Array(n * n);
        for (let i = 0; i < n; i++) {
          for (let j = 0; j < n; j++) {
            a[i * n + j] = (i * (j + 2) + 2) / n;
            b[i * n + j] = (i * (j + 3) + 3) / n;
          }
        }
        return { a, b, n };
      }

      function jsPolybench() {
        const gf = makeGemmFixture();
        const cf = makeCholeskyFixture();
        const jf = makeGridFixture();

        // GEMM
        const gemmOut = gf.c.slice();
        for (let i = 0; i < NI; i++) {
          for (let j = 0; j < NJ; j++) gemmOut[i * NJ + j] *= gf.beta;
          for (let k = 0; k < NK; k++) {
            for (let j = 0; j < NJ; j++) {
              gemmOut[i * NJ + j] += gf.alpha * gf.a[i * NK + k] * gf.b[k * NJ + j];
            }
          }
        }

        // Cholesky
        const cholA = cf.a.slice();
        const n = cf.n;
        for (let i = 0; i < n; i++) {
          for (let j = 0; j <= i; j++) {
            let sum = cholA[i * n + j];
            for (let k = 0; k < j; k++) sum -= cholA[i * n + k] * cholA[j * n + k];
            cholA[i * n + j] = i === j ? Math.sqrt(sum) : sum / cholA[j * n + j];
          }
          for (let j = i + 1; j < n; j++) cholA[i * n + j] = 0;
        }

        // Jacobi2D
        const ja = jf.a.slice();
        const jb = jf.b.slice();
        const jn = jf.n;
        for (let t = 0; t < STEPS; t++) {
          for (let i = 1; i < jn - 1; i++) {
            for (let j = 1; j < jn - 1; j++) {
              const p = i * jn + j;
              jb[p] = 0.2 * (ja[p] + ja[p - 1] + ja[p + 1] + ja[p - jn] + ja[p + jn]);
            }
          }
          for (let i = 1; i < jn - 1; i++) {
            for (let j = 1; j < jn - 1; j++) {
              const p = i * jn + j;
              ja[p] = 0.2 * (jb[p] + jb[p - 1] + jb[p + 1] + jb[p - jn] + jb[p + jn]);
            }
          }
        }
      }

      const callables = {};
      callables.js = { polybench: jsPolybench };

      for (const key of ["c", "cpp", "rs"]) {
        const inst = mods.engines[key].instances.polybench.instance;
        const mem = inst.exports.memory;
        const exports = inst.exports;
        callables[key] = {
          polybench: () => {
            const gf = makeGemmFixture();
            const cf = makeCholeskyFixture();
            const jf = makeGridFixture();

            // GEMM
            const aOff = 0;
            const bOff = gf.a.byteLength;
            const cOff = bOff + gf.b.byteLength;
            new Float64Array(mem.buffer, aOff, gf.a.length).set(gf.a);
            new Float64Array(mem.buffer, bOff, gf.b.length).set(gf.b);
            new Float64Array(mem.buffer, cOff, gf.c.length).set(gf.c);
            exports.gemm(aOff, bOff, cOff, NI, NJ, NK, gf.alpha, gf.beta);

            // Cholesky
            const cholOff = cOff + gf.c.byteLength;
            new Float64Array(mem.buffer, cholOff, cf.a.length).set(cf.a);
            exports.cholesky(cholOff, cf.n);

            // Jacobi2D
            const gridAOff = cholOff + cf.a.byteLength;
            const gridBOff = gridAOff + jf.a.byteLength;
            new Float64Array(mem.buffer, gridAOff, jf.a.length).set(jf.a);
            new Float64Array(mem.buffer, gridBOff, jf.b.length).set(jf.b);
            exports.jacobi2d(gridAOff, gridBOff, jf.n, STEPS);
          },
        };
      }

      callables.dart = {
        polybench: () => {
          const gf = makeGemmFixture();
          const cf = makeCholeskyFixture();
          const jf = makeGridFixture();
          const k = mods.engines.dart.kernels;
          k.gemm(gf.a, gf.b, gf.c, NI, NJ, NK, gf.alpha, gf.beta);
          k.cholesky(cf.a, cf.n);
          k.jacobi2d(jf.a, jf.b, jf.n, STEPS);
        },
      };

      return callables;
    },
  },
  // --- dom.todomvc-journey.v1: TodoMVC 100-item state machine (mirrors engine.js
  //     TodoJsEngine + the frozen todomvc.wat; the engine the homepage suite
  //     runs in a worker — the real DOM journey is the page-level runner) -----
  "dom.todomvc-journey.v1": {
    kernels: ["todomvc_engine"],
    build(mods) {
      const TODO_COUNT = 100;
      const ACTION = { ADD: 1, TOGGLE: 2, FILTER: 3, EDIT: 4, REMOVE: 5 };
      const FILTER = { ALL: 0, ACTIVE: 1, COMPLETED: 2 };
      // Frozen canonical trace (mirror of fixture.js generateActionTrace/
      // encodeActionTrace): 100 adds, 34 toggles, 3 filters, 10 removes, 3 edits.
      function fixture() {
        const actions = [];
        for (let id = 0; id < TODO_COUNT; id += 1) actions.push([ACTION.ADD, id, 0, 0]);
        for (let id = 0; id < TODO_COUNT; id += 3) actions.push([ACTION.TOGGLE, id, 1, 0]);
        actions.push([ACTION.FILTER, 0, FILTER.COMPLETED, 0]);
        actions.push([ACTION.FILTER, 0, FILTER.ACTIVE, 0]);
        actions.push([ACTION.FILTER, 0, FILTER.ALL, 0]);
        for (let id = 0; id < TODO_COUNT; id += 10) actions.push([ACTION.REMOVE, id, 0, 0]);
        actions.push([ACTION.EDIT, 5, 1, 0]);
        actions.push([ACTION.EDIT, 55, 1, 0]);
        actions.push([ACTION.EDIT, 95, 1, 1]);
        const encoded = new Int32Array(actions.length * 4);
        actions.forEach((a, i) => encoded.set(a, i * 4));
        return encoded;
      }
      // Exact mirror of engine.js TodoJsEngine.run/apply.
      function jsEngine(encoded) {
        const flags = new Uint8Array(TODO_COUNT);
        const versions = new Uint8Array(TODO_COUNT);
        let filter = FILTER.ALL;
        const counters = {
          actions: 0,
          adds: 0,
          toggles: 0,
          filters: 0,
          removes: 0,
          edits: 0,
          stateWrites: 0,
          commandsEmitted: 0,
        };
        const commands = new Int32Array(encoded.length);
        for (let offset = 0; offset < encoded.length; offset += 4) {
          const opcode = encoded[offset], id = encoded[offset + 1];
          const value = encoded[offset + 2], focus = encoded[offset + 3];
          if (opcode === ACTION.ADD) {
            if ((flags[id] & 1) !== 0) throw new Error("duplicate add");
            flags[id] = 1;
            versions[id] = 0;
            counters.adds += 1;
            counters.stateWrites += 2;
          } else if (opcode === ACTION.TOGGLE) {
            if ((flags[id] & 1) === 0) throw new Error("toggle missing");
            flags[id] ^= 2;
            counters.toggles += 1;
            counters.stateWrites += 1;
          } else if (opcode === ACTION.FILTER) {
            if (![FILTER.ALL, FILTER.ACTIVE, FILTER.COMPLETED].includes(value)) {
              throw new Error("invalid filter");
            }
            filter = value;
            counters.filters += 1;
            counters.stateWrites += 1;
          } else if (opcode === ACTION.EDIT) {
            if ((flags[id] & 1) === 0 || value !== 1) throw new Error("invalid edit");
            versions[id] = value;
            counters.edits += 1;
            counters.stateWrites += 1;
          } else if (opcode === ACTION.REMOVE) {
            if ((flags[id] & 1) === 0) throw new Error("remove missing");
            flags[id] = 0;
            counters.removes += 1;
            counters.stateWrites += 1;
          } else {
            throw new Error("unknown opcode");
          }
          commands.set([opcode, id, value, focus], offset);
          counters.actions += 1;
          counters.commandsEmitted += 1;
        }
        return { commands, flags, versions, filter, counters };
      }
      const callables = {};
      for (const key of ["c", "cpp", "rs"]) {
        const inst = mods.engines[key].instances.todomvc_engine.instance;
        const mem = inst.exports.memory;
        callables[key] = {
          todomvc_engine: () => {
            const encoded = fixture();
            const count = encoded.length / 4;
            const inOff = 0, cmdOff = encoded.byteLength + 1024;
            const stateOff = cmdOff + encoded.byteLength + 1024;
            new Int32Array(mem.buffer, inOff, encoded.length).set(encoded);
            const ret = inst.exports.run(count, inOff, cmdOff, stateOff);
            if (ret !== count) throw new Error(`todomvc_engine ${key} run failed (${ret})`);
          },
        };
      }
      callables.js = { todomvc_engine: () => jsEngine(fixture()) };
      callables.dart = {
        todomvc_engine: () => {
          const encoded = fixture();
          const count = encoded.length / 4;
          const input = new Uint8Array(encoded.buffer.slice(0));
          const commands = new Uint8Array(encoded.byteLength);
          const state = new Uint8Array(TODO_COUNT * 2 + 1);
          const ret = mods.engines.dart.kernels.run(input, count, commands, state);
          if (ret !== count) throw new Error(`todomvc_engine dart run failed (${ret})`);
        },
      };
      return callables;
    },
  },
  // --- cad-parametric-bracket: B-rep + scan-band tessellation (oracle: engine.js runJavaScript)
  "cad.parametric-bracket.v1": {
    kernels: ["bracket"],
    async build(mods) {
      const INPUT_BYTES = 128;
      function fixture() {
        const bytes = new Uint8Array(INPUT_BYTES);
        const view = new DataView(bytes.buffer);
        view.setUint32(0, 0x31425243, true);
        view.setUint32(4, 1, true);
        view.setUint32(8, 2, true);
        view.setUint32(12, 8, true);
        view.setUint32(16, 32, true);
        view.setFloat64(24, 80, true);
        view.setFloat64(32, 40, true);
        view.setFloat64(40, 12, true);
        view.setFloat64(48, 5, true);
        view.setFloat64(56, 4, true);
        view.setFloat64(64, 20, true);
        view.setFloat64(72, 20, true);
        view.setFloat64(80, 60, true);
        view.setFloat64(88, 20, true);
        return bytes;
      }
      const callables = {};
      for (const key of ["c", "cpp"]) {
        const inst = mods.engines[key].instances.bracket.instance;
        callables[key] = {
          bracket: () => {
            const input = fixture();
            const mem = inst.exports.memory;
            new Uint8Array(mem.buffer, inst.exports.input_ptr(), INPUT_BYTES).set(input);
            inst.exports.run();
          },
        };
      }
      const { runJavaScript } = await import("/benchmarks/base/cad-parametric-bracket/engine.js");
      callables.js = {
        bracket: () => {
          runJavaScript(fixture());
        },
      };
      return callables;
    },
  },
};

const cache = new Map();

async function fetchBytes(base, path) {
  const res = await fetch(`${base}/${path}`, { cache: "no-store" });
  if (!res.ok) throw new Error(`${path} returned ${res.status}`);
  return new Uint8Array(await res.arrayBuffer());
}

export async function loadEngines(manifest) {
  if (cache.has(manifest.workloadId)) return cache.get(manifest.workloadId);
  const out = { manifest, engines: {} };
  const base = manifest.artifactsBase;

  const linear = manifest.engines.filter((e) => e.kind === "linear");
  const byKernel = {};
  for (const engine of linear) {
    byKernel[engine.key] = {};
    // An engine may declare a kernel subset (e.g. WAT is sum-only); default
    // to every kernel in the manifest.
    const kernels = engine.kernels ?? manifest.kernels;
    for (const kernel of kernels) {
      // Linear engines use one wasm per kernel: <kernel>_<lang>.wasm unless the
      // engine pins a file per kernel via engine.files.
      const file = engine.files?.[kernel] ?? `${kernel}_${engine.lang}.wasm`;
      const bytes = await fetchBytes(base, file);
      const instance = new WebAssembly.Instance(new WebAssembly.Module(bytes));
      byKernel[engine.key][kernel] = { instance, bytes };
    }
  }
  for (const engine of linear) {
    out.engines[engine.key] = {
      cfg: engine,
      instances: byKernel[engine.key],
      bytes: byKernel[engine.key][manifest.kernels[0]].bytes,
    };
  }

  for (const engine of manifest.engines.filter((e) => e.kind === "dart")) {
    const bytes = await fetchBytes(base, engine.file);
    const glueText = await (await fetch(`${base}/${engine.glue}`, { cache: "no-store" })).text();
    const url = URL.createObjectURL(new Blob([glueText], { type: "text/javascript" }));
    const glue = await import(url);
    const app = await glue.compile(bytes);
    const inst = await app.instantiate({});
    inst.invokeMain();
    const kernels = globalThis.dartKernels;
    if (!kernels) throw new Error(`${engine.label}: dartKernels not published`);
    out.engines[engine.key] = { cfg: engine, kernels, bytes };
  }

  cache.set(manifest.workloadId, out);
  return out;
}

function median(values) {
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.floor(sorted.length / 2)];
}

function benchmarkOne(fn, iterations) {
  for (let i = 0; i < 50; i++) fn(); // warm-up (JIT + wasm tiering)
  const samples = [];
  for (let i = 0; i < iterations; i++) {
    const t0 = performance.now();
    fn();
    samples.push(performance.now() - t0);
  }
  return {
    medianMs: median(samples),
    minMs: Math.min(...samples),
    maxMs: Math.max(...samples),
  };
}

// Source-size lookup: each kernel's source file (e.g. <kernel>.c) lives either
// flat in benchmarks/multilang-wasm/ (sum/fft) or in a per-workload subdir
// (<dir>/<kernel>.c). Try both; return bytes or 0 (kept honest as "—").
const sourceSizeCache = new Map();
async function kernelSourceBytes(manifest, kernel, lang) {
  const ext = lang === "js" ? "ts" : lang;
  const dir = (manifest._path ?? "").split("/").pop()?.replace(/\.manifest\.json$/, "") ?? "";
  const candidates = [
    `/benchmarks/multilang-wasm/${kernel}.${ext}`,
    dir ? `/benchmarks/multilang-wasm/${dir}/${kernel}.${ext}` : "",
  ].filter(Boolean);
  for (const path of candidates) {
    if (sourceSizeCache.has(path)) {
      const n = sourceSizeCache.get(path);
      if (n > 0) return n;
      continue;
    }
    try {
      const resp = await fetch(path, { cache: "no-store" });
      if (resp.ok) {
        const bytes = (await resp.arrayBuffer()).byteLength;
        sourceSizeCache.set(path, bytes);
        return bytes;
      }
      sourceSizeCache.set(path, 0);
    } catch {
      sourceSizeCache.set(path, 0);
    }
  }
  return 0;
}

export async function runWorkload(manifest, kernel, iterations, onProgress) {
  const mods = await loadEngines(manifest);
  const adapter = KERNEL_ADAPTERS[manifest.workloadId];
  if (!adapter || !adapter.kernels.includes(kernel)) {
    throw new Error(`no adapter for ${manifest.workloadId}/${kernel}`);
  }
  const callables = await adapter.build(mods);
  const results = [];
  for (const engine of manifest.engines) {
    const fn = callables[engine.key]?.[kernel];
    if (!fn) continue; // engine not applicable to this kernel (e.g. WAT sum-only)
    onProgress(`${engine.label}: ${kernel}...`);
    const stats = benchmarkOne(fn, iterations);
    const bytes = mods.engines[engine.key]?.bytes?.byteLength ?? 0;
    const sourceBytes = await kernelSourceBytes(manifest, kernel, engine.lang ?? engine.key);
    results.push({
      key: engine.key,
      label: engine.label,
      bytes,
      sourceBytes,
      ...stats,
    });
  }
  return results;
}

function renderTables(container, manifest, resultsByKernel, iterations) {
  const tables = manifest.kernels.map((kernel) => {
    const results = resultsByKernel[kernel];
    const js = results.find((r) => r.key === "js");
    const jsMs = js ? js.medianMs : Math.max(...results.map((r) => r.medianMs));
    const max = Math.max(...results.map((r) => r.medianMs), 1);
    const rows = results
      .map((r) => {
        const ratio = (r.medianMs / jsMs).toFixed(2);
        const pct = Math.max(2, (r.medianMs / max) * 100);
        const wasmSize = r.bytes > 0 ? `${r.bytes} B` : "";
        const srcSize = r.sourceBytes > 0 ? `src ${r.sourceBytes} B` : "";
        const size = [wasmSize, srcSize].filter(Boolean).join(" · ") || "—";
        return `
        <tr>
          <td><strong>${r.label}</strong></td>
          <td>${size}</td>
          <td>${r.medianMs.toFixed(3)} ms</td>
          <td>${ratio}×</td>
          <td><div class="perf-bar-track"><div class="perf-bar multilang-bar" data-pct="${pct}" title="${
          r.medianMs.toFixed(3)
        } ms"></div></div></td>
        </tr>`;
      })
      .join("");
    const kernelLabel = manifest.kernelLabels?.[kernel] ?? kernel;
    return `
      <div class="table-wrap">
        <table class="results-table">
          <caption>${kernelLabel} — ${iterations}× warm loop, local run</caption>
          <thead><tr><th>Implementation</th><th>Binary Size</th><th>Warm Median</th><th>vs JS</th><th></th></tr></thead>
          <tbody>${rows}</tbody>
        </table>
      </div>`;
  });
  container.innerHTML = tables.join("") +
    `<p class="notice">All timings are measured in this browser tab for this session. They are
      exploratory and depend on engine, device, and load. Per-variant arithmetic semantics are
      disclosed in the report.</p>`;
  container.querySelectorAll(".perf-bar[data-pct]").forEach((bar) => {
    bar.style.width = `${bar.dataset.pct}%`; // CSSOM — CSP style-src 'self'
  });
  container.hidden = false;
}

// Run every engine in a multilang manifest and render the comparison tables.
// Used both by initMultilangRunner (form-bound standalone pages) and by the
// unified composed runner (unified-runner.js sequences this after the primary
// JS-vs-Wasm stage so ONE run control drives everything).
export async function runMultilangComparison(manifestPath, {
  iterations = 30,
  onStatus = () => {},
  shouldCancel = () => false,
  reportingEl = null,
} = {}) {
  const manifest = await (await fetch(manifestPath, { cache: "no-store" })).json();
  manifest._path = manifestPath;
  await loadEngines(manifest);
  const results = {};
  for (const kernel of KERNEL_ADAPTERS[manifest.workloadId].kernels) {
    if (shouldCancel()) throw new Error("cancelled");
    onStatus(`Running ${kernel} (${iterations}× loop)...`);
    results[kernel] = await runWorkload(manifest, kernel, iterations, onStatus);
    if (shouldCancel()) throw new Error("cancelled");
  }
  if (reportingEl) {
    reportingEl.hidden = false;
    renderTables(reportingEl, manifest, results, iterations);
  }
  return results;
}

// The unified composed runner (unified-runner.js) sets data-unified-runner-active
// on pages that load the primary JS-vs-Wasm runner. On those pages the multilang
// stage is sequenced by the primary run control, so the multilang runner must NOT
// auto-bind a second form.
export function shouldAutoBindMultilang(meta = {}) {
  if (meta.unifiedRunnerActive) return false;
  return Boolean(meta.multilangManifest);
}

export function initMultilangRunner(manifestPath, opts = {}) {
  const form = opts.form ?? document.querySelector("#demo-form");
  const iterationsSelect = opts.iterations ?? document.querySelector("#iterations");
  const startBtn = opts.start ?? document.querySelector("#start");
  const cancelBtn = opts.cancel ?? document.querySelector("#cancel");
  const statusEl = opts.status ?? document.querySelector("#status");
  const reportingEl = opts.reporting ?? document.querySelector("#perf-reporting");
  if (!form || !startBtn || !statusEl || !reportingEl) return;

  let active = false;
  let cancelled = false;

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    if (active) return;
    active = true;
    cancelled = false;
    startBtn.disabled = true;
    if (iterationsSelect) iterationsSelect.disabled = true;
    cancelBtn.disabled = false;
    reportingEl.hidden = true;

    const iterations = parseInt(iterationsSelect?.value ?? "30", 10);

    try {
      await runMultilangComparison(manifestPath, {
        iterations,
        onStatus: (m) => {
          statusEl.textContent = m;
        },
        shouldCancel: () => cancelled,
        reportingEl,
      });
      statusEl.textContent = "✓ Benchmark suite completed.";
    } catch (err) {
      if (err.message !== "cancelled") {
        statusEl.textContent = `Error: ${err.message || String(err)}`;
      }
    } finally {
      active = false;
      startBtn.disabled = false;
      if (iterationsSelect) iterationsSelect.disabled = false;
      cancelBtn.disabled = true;
      if (cancelled) statusEl.textContent = "Run cancelled by user.";
    }
  });

  cancelBtn.addEventListener("click", () => {
    cancelled = true;
    statusEl.textContent = "Cancelling after current sample...";
  });

  startBtn.disabled = false;
  statusEl.textContent = "Ready. Select loop iterations, then click Start.";
}

if (typeof document !== "undefined" && document.body?.dataset?.multilangManifest) {
  const init = () => {
    // Pages with the unified composed runner (primary JS-vs-Wasm + sequenced
    // multilang + Track B stages from ONE run control) must not double-bind a
    // second multilang form. The composed runner drives the multilang stage.
    if (
      shouldAutoBindMultilang({
        unifiedRunnerActive: Boolean(document.body?.dataset?.unifiedRunnerActive),
        multilangManifest: document.body?.dataset?.multilangManifest,
      })
    ) {
      initMultilangRunner(document.body.dataset.multilangManifest, {
        form: document.querySelector(document.body.dataset.multilangForm || "#demo-form") ||
          undefined,
        start: document.querySelector(document.body.dataset.multilangStart || "#start") ||
          undefined,
        cancel: document.querySelector(document.body.dataset.multilangCancel || "#cancel") ||
          undefined,
        status: document.querySelector(document.body.dataset.multilangStatus || "#status") ||
          undefined,
        reporting:
          document.querySelector(document.body.dataset.multilangReporting || "#perf-reporting") ||
          undefined,
        iterations:
          document.querySelector(document.body.dataset.multilangIterations || "#iterations") ||
          undefined,
      });
    }
  };
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
}
