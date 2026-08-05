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

export const KERNEL_ADAPTERS = {
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
};

const cache = new Map();

async function fetchBytes(base, path) {
  const res = await fetch(`${base}/${path}`, { cache: "no-store" });
  if (!res.ok) throw new Error(`${path} returned ${res.status}`);
  return new Uint8Array(await res.arrayBuffer());
}

async function loadEngines(manifest) {
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

async function runWorkload(manifest, kernel, iterations, onProgress) {
  const mods = await loadEngines(manifest);
  const adapter = KERNEL_ADAPTERS[manifest.workloadId];
  if (!adapter || !adapter.kernels.includes(kernel)) {
    throw new Error(`no adapter for ${manifest.workloadId}/${kernel}`);
  }
  const callables = adapter.build(mods);
  const results = [];
  for (const engine of manifest.engines) {
    const fn = callables[engine.key]?.[kernel];
    if (!fn) continue; // engine not applicable to this kernel (e.g. WAT sum-only)
    onProgress(`${engine.label}: ${kernel}...`);
    const stats = benchmarkOne(fn, iterations);
    results.push({
      key: engine.key,
      label: engine.label,
      bytes: mods.engines[engine.key]?.bytes?.byteLength ?? 0,
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
        const size = r.key === "js" ? "n/a (source)" : `${r.bytes} B`;
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

export async function initMultilangRunner(manifestPath, opts = {}) {
  const form = opts.form ?? document.querySelector("#demo-form");
  const iterationsSelect = opts.iterations ?? document.querySelector("#iterations");
  const startBtn = opts.start ?? document.querySelector("#start");
  const cancelBtn = opts.cancel ?? document.querySelector("#cancel");
  const statusEl = opts.status ?? document.querySelector("#status");
  const reportingEl = opts.reporting ?? document.querySelector("#perf-reporting");
  if (!form || !startBtn || !statusEl || !reportingEl) return;

  const manifest = await (await fetch(manifestPath, { cache: "no-store" })).json();
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
      statusEl.textContent = "Loading engines...";
      await loadEngines(manifest);

      const results = {};
      for (const kernel of KERNEL_ADAPTERS[manifest.workloadId].kernels) {
        statusEl.textContent = `Running ${kernel} (${iterations}× loop)...`;
        results[kernel] = await runWorkload(manifest, kernel, iterations, (m) => {
          statusEl.textContent = m;
        });
        if (cancelled) throw new Error("cancelled");
      }
      statusEl.textContent = "✓ Benchmark suite completed.";
      renderTables(reportingEl, manifest, results, iterations);
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
  const init = () =>
    initMultilangRunner(document.body.dataset.multilangManifest, {
      form: document.querySelector(document.body.dataset.multilangForm || "#demo-form") ||
        undefined,
      start: document.querySelector(document.body.dataset.multilangStart || "#start") || undefined,
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
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
}
