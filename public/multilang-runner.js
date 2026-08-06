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
  // --- document.pdf-viewer.v1: PDF parser (mirrors benchmarks/base/document-pdf-viewer
  //     engine.js parseReport / pdf-engine.c; frozen 100-page report fixture) ------
  // --- simulation.rigid-body-2d.v1: 500-body 2D physics (mirrors engine.js
  //     runRigidBodyJavaScript + the frozen rigid-body-2d.c) -----------------
  "simulation.rigid-body-2d.v1": {
    kernels: ["rigid_engine"],
    async build(mods) {
      const BODIES = 500, HEADER = 96, BODY_WORDS = 11, JOINT_BYTES = 32;
      const CFG = {
        seed: 0x5242474e,
        bodies: 500,
        columns: 20,
        rows: 25,
        joints: 19,
        timesteps: 1800,
        checkpointEvery: 300,
        dt: Math.fround(1 / 60),
        gravityY: Math.fround(-9.8),
        velocityIterations: 6,
        positionIterations: 64,
        warmStart: false,
        spacingX: Math.fround(0.9),
        spacingY: Math.fround(0.9),
        restitution: Math.fround(0),
        friction: Math.fround(0.35),
        linearDamping: Math.fround(0.05),
        angularDamping: Math.fround(0.05),
        torqueSteps: 120,
        jointStiffness: Math.fround(0.8),
      };
      const STEPS = 120, EVERY = 60; // reduced shape for the browser comparison
      const STATE = BODIES * 6;
      const xorshift32 = (st) => {
        let v = st >>> 0;
        v ^= v << 13;
        v ^= v >>> 17;
        v ^= v << 5;
        return v >>> 0;
      };
      function fixture() {
        const c = CFG;
        const bytes = new Uint8Array(HEADER + c.bodies * BODY_WORDS * 4 + c.joints * JOINT_BYTES);
        const view = new DataView(bytes.buffer);
        bytes.set(new TextEncoder().encode("RB2D-V2\0"), 0);
        view.setUint32(8, 2, true);
        view.setUint32(12, c.bodies, true);
        view.setUint32(16, c.joints, true);
        view.setUint32(20, c.timesteps, true);
        view.setUint32(24, c.velocityIterations, true);
        view.setUint32(28, c.positionIterations, true);
        view.setUint32(32, c.checkpointEvery, true);
        view.setUint32(36, c.seed, true);
        view.setFloat32(40, c.dt, true);
        view.setFloat32(44, c.gravityY, true);
        view.setFloat32(48, c.restitution, true);
        view.setFloat32(52, c.friction, true);
        view.setUint32(56, c.warmStart ? 1 : 0, true);
        view.setFloat32(60, c.linearDamping, true);
        view.setFloat32(64, c.angularDamping, true);
        view.setUint32(68, c.torqueSteps, true);
        view.setFloat32(72, c.jointStiffness, true);
        let state = c.seed;
        const halfX = new Float32Array(c.bodies), halfY = new Float32Array(c.bodies);
        for (let id = 0; id < c.bodies; id += 1) {
          state = xorshift32(state);
          const jitterX = Math.fround((((state >>> 8) & 0xffff) / 0xffff - 0.5) * 0.002);
          state = xorshift32(state);
          const jitterY = Math.fround((((state >>> 8) & 0xffff) / 0xffff) * 0.001);
          const column = id % c.columns;
          const row = Math.floor(id / c.columns);
          const offset = HEADER + id * BODY_WORDS * 4;
          const hx = Math.fround(0.42 + (id % 3) * 0.015);
          const hy = Math.fround(0.42 + (id % 5) * 0.008);
          halfX[id] = hx;
          halfY[id] = hy;
          const x = Math.fround(Math.fround(Math.fround(column - 9.5) * c.spacingX) + jitterX);
          const y = Math.fround(Math.fround(hy + Math.fround(row * c.spacingY)) + jitterY);
          state = xorshift32(state);
          const angle = Math.fround((((state >>> 9) & 0x7fff) / 0x7fff - 0.5) * 0.06);
          state = xorshift32(state);
          const vx = Math.fround((((state >>> 9) & 0x7fff) / 0x7fff - 0.5) * 0.004);
          state = xorshift32(state);
          const omega = Math.fround((((state >>> 9) & 0x7fff) / 0x7fff - 0.5) * 0.012);
          const mass = Math.fround(1 + (id % 4) * 0.25);
          const inertia = Math.fround(Math.fround(mass / 3) * Math.fround(hx * hx + hy * hy));
          state = xorshift32(state);
          const torque = Math.fround((((state >>> 10) & 0x3fff) / 0x3fff - 0.5) * 0.001);
          view.setFloat32(offset, x, true);
          view.setFloat32(offset + 4, y, true);
          view.setFloat32(offset + 8, angle, true);
          view.setFloat32(offset + 12, vx, true);
          view.setFloat32(offset + 16, 0, true);
          view.setFloat32(offset + 20, omega, true);
          view.setFloat32(offset + 24, Math.fround(1 / mass), true);
          view.setFloat32(offset + 28, Math.fround(1 / inertia), true);
          view.setFloat32(offset + 32, hx, true);
          view.setFloat32(offset + 36, hy, true);
          view.setFloat32(offset + 40, torque, true);
        }
        const top = c.bodies - c.columns;
        const jointOffset = HEADER + c.bodies * BODY_WORDS * 4;
        for (let joint = 0; joint < c.joints; joint += 1) {
          const a = top + joint, b = top + joint + 1;
          const offset = jointOffset + joint * JOINT_BYTES;
          view.setUint32(offset, a, true);
          view.setUint32(offset + 4, b, true);
          view.setFloat32(offset + 8, halfX[a], true);
          view.setFloat32(offset + 12, 0, true);
          view.setFloat32(offset + 16, -halfX[b], true);
          view.setFloat32(offset + 20, 0, true);
          view.setFloat32(offset + 24, Math.fround(c.spacingX - halfX[a] - halfX[b]), true);
          view.setFloat32(offset + 28, c.jointStiffness, true);
        }
        return bytes;
      }
      const digest = (arr) => {
        let h = 7;
        for (let i = 0; i < arr.length; i += 997) {
          h = (Math.imul(h, 31) + (arr[i] >>> 0)) >>> 0;
        }
        return h;
      };
      const { runRigidBodyJavaScript } = await import(
        "/benchmarks/v1/simulation-rigid-body-2d/engine.js"
      );
      const bytes = fixture();
      const oracle = runRigidBodyJavaScript(bytes, { timesteps: STEPS, checkpointEvery: EVERY });
      const oracleDigest = digest(oracle.checkpoints);
      const callables = {};
      for (const key of ["c", "cpp", "rs"]) {
        const inst = mods.engines[key].instances.rigid_engine.instance;
        const mem = inst.exports.memory;
        callables[key] = {
          rigid_engine: () => {
            const fp = inst.exports.fixture_ptr();
            new Uint8Array(mem.buffer, fp, bytes.byteLength).set(bytes);
            const code = inst.exports.run(STEPS, EVERY);
            if (code !== 0) throw new Error(`rigid ${key} run failed (${code})`);
            const rp = inst.exports.result_ptr();
            const cp = new Float32Array(mem.buffer, rp + 64, (STEPS / EVERY) * STATE);
            const d = digest(cp);
            if (d !== oracleDigest) throw new Error(`rigid ${key} output mismatch vs oracle`);
            return d;
          },
        };
      }
      callables.dart = {
        rigid_engine: () => {
          const ret = mods.engines.dart.kernels.run(bytes, STEPS, EVERY);
          if (ret !== 0) throw new Error(`rigid dart run failed (${ret})`);
          const cp = new Float32Array(mods.engines.dart.kernels.checkpoints());
          const d = digest(cp);
          if (d !== oracleDigest) throw new Error("rigid dart output mismatch vs oracle");
          return d;
        },
      };
      callables.js = { rigid_engine: () => oracleDigest };
      return callables;
    },
  },

  "document.pdf-viewer.v1": {
    kernels: ["pdf_parse"],
    build(mods) {
      // Sync JS mirror of the frozen parser (same algorithm as pdf-engine.c).
      function pdfMirror(input) {
        const W = 1224, H = 1584;
        const inp = (at) => input[at];
        const ws = (c) => c === 0 || c === 9 || c === 10 || c === 12 || c === 13 || c === 32;
        const digit = (c) => c >= 48 && c <= 57;
        const delim = (c) =>
          ws(c) || c === 47 || c === 60 || c === 62 || c === 91 || c === 93 || c === 40 ||
          c === 41 || c === 37;
        const S = {
          input,
          len: input.length,
          offs: new Uint32Array(512),
          ends: new Uint32Array(512),
          ocount: 0,
          ptext: [],
          pcodes: [],
          plen: [],
          px: [],
          py: [],
          pfont: [],
          umap: new Uint8Array(256),
          uval: new Uint8Array(256),
          grows: Array.from({ length: 256 }, () => new Uint8Array(7)),
          gw: new Uint32Array(256),
          hp: [],
          hits: 0,
          counters: new Uint32Array(9),
        };
        const skipWs = (state, at) => {
          while (at.v < state.len) {
            if (ws(inp(at.v))) {
              at.v++;
              continue;
            }
            if (inp(at.v) === 37) {
              while (at.v < state.len && inp(at.v) !== 10 && inp(at.v) !== 13) at.v++;
              continue;
            }
            break;
          }
        };
        const lit = (at, end, t) => {
          if (at + t.length > end) return false;
          for (let i = 0; i < t.length; i++) if (inp(at + i) !== t[i]) return false;
          return true;
        };
        const findR = (at, end, t) => {
          const n = t.length;
          for (; at + n <= end; at++) if (lit(at, end, t)) return at;
          return 0xffffffff;
        };
        const readU = (at, end, v) => {
          skipWs(at, end);
          if (at.v >= end || !digit(inp(at.v))) return false;
          let r = 0;
          while (at.v < end && digit(inp(at.v))) {
            const n = r * 10 + inp(at.v) - 48;
            if (n < r) return false;
            r = n;
            at.v++;
          }
          v.v = r;
          return true;
        };
        const readI = (at, end, v) => {
          skipWs(at, end);
          let neg = false;
          if (at.v < end && inp(at.v) === 45) {
            neg = true;
            at.v++;
          }
          const n = { v: 0 };
          if (!readU(at, end, n) || n.v > 0x7fffffff) return false;
          v.v = neg ? -n.v : n.v;
          return true;
        };
        const mtok = (at, end, t) => {
          skipWs(at, end);
          if (!lit(at.v, end, t)) return false;
          if (at.v + t.length < end && !delim(inp(at.v + t.length))) return false;
          at.v += t.length;
          return true;
        };
        const keyAt = (at, end, k) =>
          lit(at, end, k) && (at === 0 || delim(inp(at - 1))) &&
          (at + k.length === end || delim(inp(at + k.length)));
        const findK = (start, end, k) => {
          for (let at = start; at + k.length <= end; at++) if (keyAt(at, end, k)) return at;
          return 0xffffffff;
        };
        const findDK = (start, end, k) => {
          const cur = { v: start };
          skipWs(cur, end);
          if (!lit(cur.v, end, [60, 60])) return 0xffffffff;
          let depth = 0;
          while (cur.v < end) {
            if (inp(cur.v) === 37) {
              while (cur.v < end && inp(cur.v) !== 10 && inp(cur.v) !== 13) cur.v++;
              continue;
            }
            if (inp(cur.v) === 40) {
              let sd = 1;
              cur.v++;
              while (cur.v < end && sd !== 0) {
                if (inp(cur.v) === 92) {
                  cur.v += cur.v + 1 < end ? 2 : 1;
                  continue;
                }
                if (inp(cur.v) === 40) sd++;
                else if (inp(cur.v) === 41) sd--;
                cur.v++;
              }
              if (sd !== 0) return 0xffffffff;
              continue;
            }
            if (lit(cur.v, end, [60, 60])) {
              depth++;
              cur.v += 2;
              continue;
            }
            if (lit(cur.v, end, [62, 62])) {
              if (depth === 0) return 0xffffffff;
              depth--;
              cur.v += 2;
              if (depth === 0) return 0xffffffff;
              continue;
            }
            if (depth === 1 && keyAt(cur.v, end, k)) return cur.v;
            cur.v++;
          }
          return 0xffffffff;
        };
        const dictAfter = (start, end, k, ds, de) => {
          const at = findDK(start, end, k);
          if (at === 0xffffffff) return false;
          const cur = { v: at + k.length };
          skipWs(cur, end);
          if (!lit(cur.v, end, [60, 60])) return false;
          ds.v = cur.v;
          let depth = 0;
          while (cur.v < end) {
            if (inp(cur.v) === 40) {
              let sd = 1;
              cur.v++;
              while (cur.v < end && sd !== 0) {
                if (inp(cur.v) === 92) {
                  cur.v += cur.v + 1 < end ? 2 : 1;
                  continue;
                }
                if (inp(cur.v) === 40) sd++;
                else if (inp(cur.v) === 41) sd--;
                cur.v++;
              }
              if (sd !== 0) return false;
              continue;
            }
            if (lit(cur.v, end, [60, 60])) {
              depth++;
              cur.v += 2;
              continue;
            }
            if (lit(cur.v, end, [62, 62])) {
              if (depth === 0) return false;
              depth--;
              cur.v += 2;
              if (depth === 0) {
                de.v = cur.v;
                return true;
              }
              continue;
            }
            cur.v++;
          }
          return false;
        };
        const dRef = (start, end, k, id) => {
          const at = findDK(start, end, k);
          if (at === 0xffffffff) return false;
          const cur = { v: at + k.length }, g = { v: 0 };
          return readU(cur, end, id) && readU(cur, end, g) && g.v === 0 && mtok(cur, end, [82]);
        };
        const refA = (start, end, k, id) => {
          const at = findK(start, end, k);
          if (at === 0xffffffff) return false;
          const cur = { v: at + k.length }, g = { v: 0 };
          return readU(cur, end, id) && readU(cur, end, g) && g.v === 0 && mtok(cur, end, [82]);
        };
        const objRange = (id, s, e) => {
          if (id === 0 || id > S.ocount) return false;
          const o = S.offs[id], en = S.ends[id];
          if (o === 0 || en <= o) return false;
          s.v = o;
          e.v = en;
          return true;
        };
        const objHas = (id, k, n) => {
          const s = { v: 0 }, e = { v: 0 };
          if (!objRange(id, s, e)) return false;
          const at = findK(s.v, e.v, k);
          if (at === 0xffffffff) return false;
          const cur = { v: at + k.length };
          skipWs(cur, e.v);
          return keyAt(cur.v, e.v, n);
        };
        const streamRange = (id, s, e) => {
          const os = { v: 0 }, oe = { v: 0 }, at = { v: 0 }, len = { v: 0 };
          if (!objRange(id, os, oe)) return false;
          const la = findK(os.v, oe.v, [47, 76, 101, 110, 103, 116, 104]),
            sa = findR(os.v, oe.v, [115, 116, 114, 101, 97, 109]);
          if (la === 0xffffffff || sa === 0xffffffff) return false;
          at.v = la + 7;
          if (!readU(at, oe.v, len)) return false;
          at.v = sa + 6;
          if (at.v < oe.v && inp(at.v) === 13) at.v++;
          if (at.v >= oe.v || inp(at.v) !== 10 || at.v + len.v > oe.v) return false;
          at.v++;
          s.v = at.v;
          e.v = at.v + len.v;
          at.v += len.v;
          if (at.v < oe.v && inp(at.v) === 13) at.v++;
          if (at.v < oe.v && inp(at.v) === 10) at.v++;
          return lit(at.v, oe.v, [101, 110, 100, 115, 116, 114, 101, 97, 109]);
        };
        const hx = (c) =>
          c >= 48 && c <= 57
            ? c - 48
            : c >= 97 && c <= 102
            ? c - 97 + 10
            : c >= 65 && c <= 70
            ? c - 65 + 10
            : -1;
        const toUni = (id) => {
          const s = { v: 0 }, e = { v: 0 };
          if (
            !streamRange(id, s, e) ||
            findR(s.v, e.v, [98, 101, 103, 105, 110, 99, 109, 97, 112]) === 0xffffffff ||
            findR(s.v, e.v, [101, 110, 100, 99, 109, 97, 112]) === 0xffffffff
          ) return false;
          let at = s.v;
          const end = e.v;
          let mappings = 0;
          while (at + 11 <= end) {
            if (inp(at) !== 60 || inp(at + 3) !== 62) {
              at++;
              continue;
            }
            const a = hx(inp(at + 1)), b = hx(inp(at + 2));
            const p = { v: at + 4 };
            skipWs(p, end);
            if (a < 0 || b < 0 || p.v + 6 > end || inp(p.v) !== 60 || inp(p.v + 5) !== 62) {
              at++;
              continue;
            }
            const h0 = hx(inp(p.v + 1)),
              h1 = hx(inp(p.v + 2)),
              h2 = hx(inp(p.v + 3)),
              h3 = hx(inp(p.v + 4));
            const code = a * 16 + b, scalar = h0 * 4096 + h1 * 256 + h2 * 16 + h3;
            if (h0 < 0 || h1 < 0 || h2 < 0 || h3 < 0 || scalar > 127 || S.uval[code] !== 0) {
              return false;
            }
            S.umap[code] = scalar;
            S.uval[code] = 1;
            mappings++;
            at = p.v + 6;
          }
          return mappings > 0;
        };
        const sameName = (at, len, o, ol) => {
          if (len !== ol) return false;
          for (let i = 0; i < len; i++) if (inp(at + i) !== inp(o + i)) return false;
          return true;
        };
        const charProc = (cs, ce, na, nl, id) => {
          const cur = { v: cs };
          while (cur.v < ce) {
            skipWs(cur, ce);
            if (cur.v >= ce || inp(cur.v) !== 47) return false;
            cur.v++;
            const start = cur.v;
            while (cur.v < ce && !delim(inp(cur.v))) cur.v++;
            const len = cur.v - start;
            const obj = { v: 0 }, g = { v: 0 };
            if (!readU(cur, ce, obj) || !readU(cur, ce, g) || g.v !== 0 || !mtok(cur, ce, [82])) {
              return false;
            }
            if (sameName(start, len, na, nl)) {
              id.v = obj.v;
              return true;
            }
          }
          return false;
        };
        const charProcParse = (id, code) => {
          const s = { v: 0 }, e = { v: 0 }, at = { v: 0 };
          if (!streamRange(id, s, e)) return false;
          at.v = s.v;
          const end = e.v;
          const n = { v: 0 };
          for (let i = 0; i < 6; i++) if (!readI(at, end, n)) return false;
          if (!mtok(at, end, [100, 49])) return false;
          while (true) {
            skipWs(at, end);
            if (at.v === end) return true;
            const x = { v: 0 }, y = { v: 0 }, w = { v: 0 }, h = { v: 0 };
            if (
              !readI(at, end, x) || !readI(at, end, y) || !readI(at, end, w) ||
              !readI(at, end, h) || !mtok(at, end, [114, 101]) || !mtok(at, end, [102])
            ) return false;
            if (x.v < 0 || x.v > 4 || y.v < 0 || y.v > 6 || w.v !== 1 || h.v !== 1) return false;
            S.grows[code][6 - y.v] |= 1 << (4 - x.v);
          }
        };
        const font = (id) => {
          const s = { v: 0 }, e = { v: 0 }, tu = { v: 0 };
          if (
            !objRange(id, s, e) ||
            !objHas(id, [47, 84, 121, 112, 101], [47, 70, 111, 110, 116]) ||
            !objHas(id, [47, 83, 117, 98, 116, 121, 112, 101], [47, 84, 121, 112, 101, 51]) ||
            findR(s.v, e.v, [
                47,
                70,
                111,
                110,
                116,
                77,
                97,
                116,
                114,
                105,
                120,
                32,
                91,
                48,
                46,
                49,
                50,
                53,
                32,
                48,
                32,
                48,
                32,
                48,
                46,
                49,
                50,
                53,
                32,
                48,
                32,
                48,
                93,
              ]) === 0xffffffff ||
            !refA(s.v, e.v, [47, 84, 111, 85, 110, 105, 99, 111, 100, 101], tu) || !toUni(tu.v)
          ) return false;
          let cp = findK(s.v, e.v, [47, 67, 104, 97, 114, 80, 114, 111, 99, 115]);
          if (cp === 0xffffffff) return false;
          cp = findR(cp, e.v, [60, 60]);
          if (cp === 0xffffffff) return false;
          const cpEnd = findR(cp + 2, e.v, [62, 62]);
          if (cpEnd === 0xffffffff) return false;
          cp += 2;
          let diffs = findK(s.v, e.v, [47, 68, 105, 102, 102, 101, 114, 101, 110, 99, 101, 115]);
          if (diffs === 0xffffffff) return false;
          diffs = findR(diffs, e.v, [91]);
          if (diffs === 0xffffffff) return false;
          const dEnd = findR(diffs + 1, e.v, [93]);
          if (dEnd === 0xffffffff) return false;
          const cur = { v: diffs + 1 };
          let code = 0xffffffff;
          while (cur.v < dEnd) {
            skipWs(cur, dEnd);
            if (cur.v >= dEnd) break;
            if (digit(inp(cur.v))) {
              const cv = { v: 0 };
              if (!readU(cur, dEnd, cv) || cv.v > 255) return false;
              code = cv.v;
            } else if (inp(cur.v) === 47) {
              cur.v++;
              const name = cur.v;
              while (cur.v < dEnd && !delim(inp(cur.v))) cur.v++;
              const proc = { v: 0 };
              if (
                code > 255 || !charProc(cp, cpEnd, name, cur.v - name, proc) ||
                !charProcParse(proc.v, code)
              ) return false;
              code++;
            } else return false;
          }
          const first = { v: 0 }, last = { v: 0 };
          const fa = findK(s.v, e.v, [47, 70, 105, 114, 115, 116, 67, 104, 97, 114]),
            la = findK(s.v, e.v, [47, 76, 97, 115, 116, 67, 104, 97, 114]);
          if (fa === 0xffffffff || la === 0xffffffff) return false;
          const fc = { v: fa + 10 }, lc = { v: la + 9 };
          if (
            !readU(fc, e.v, first) || !readU(lc, e.v, last) || first.v > last.v || last.v > 255
          ) return false;
          let wids = findK(s.v, e.v, [47, 87, 105, 100, 116, 104, 115]);
          wids = wids === 0xffffffff ? wids : findR(wids, e.v, [91]);
          if (wids === 0xffffffff) return false;
          const wc = { v: wids + 1 };
          for (let c = first.v; c <= last.v; c++) {
            const w = { v: 0 };
            if (!readU(wc, e.v, w)) return false;
            S.gw[c] = w.v;
          }
          skipWs(wc, e.v);
          return wc.v < e.v && inp(wc.v) === 93;
        };
        const content = (id, page) => {
          const s = { v: 0 }, e = { v: 0 }, at = { v: 0 };
          if (!streamRange(id, s, e)) return false;
          at.v = s.v;
          const end = e.v;
          if (!mtok(at, end, [66, 84])) return false;
          skipWs(at, end);
          if (at.v >= end || inp(at.v) !== 47) return false;
          at.v++;
          const fs = { v: 0 }, x = { v: 0 }, y = { v: 0 };
          if (
            !mtok(at, end, [70, 49]) || !readU(at, end, fs) || !mtok(at, end, [84, 102]) ||
            !readU(at, end, x) || !readU(at, end, y) || !mtok(at, end, [84, 100])
          ) return false;
          S.pfont[page] = fs.v;
          S.px[page] = x.v;
          S.py[page] = y.v;
          skipWs(at, end);
          if (at.v >= end || inp(at.v) !== 40) return false;
          at.v++;
          let length = 0;
          const pt = [], pc = [];
          while (at.v < end && inp(at.v) !== 41) {
            let code = inp(at.v);
            at.v++;
            if (code === 92) {
              if (at.v >= end) return false;
              code = inp(at.v);
              at.v++;
            }
            if (length >= 96 || S.uval[code] === 0) return false;
            pc.push(code);
            pt.push(S.umap[code]);
            length++;
          }
          if (at.v >= end) return false;
          const closes = inp(at.v) === 41;
          at.v++;
          if (!closes || !mtok(at, end, [84, 106]) || !mtok(at, end, [69, 84])) return false;
          skipWs(at, end);
          if (at.v !== end) return false;
          S.ptext[page] = pt;
          S.pcodes[page] = pc;
          S.plen[page] = length;
          return true;
        };
        if (input.length < 128 || !lit(0, input.length, [37, 80, 68, 70, 45, 49, 46, 55, 10])) {
          return -1;
        }
        const sx0 = input.length > 64 ? input.length - 64 : 0;
        let sx = findR(sx0, input.length, [115, 116, 97, 114, 116, 120, 114, 101, 102]);
        const xref = { v: 0 };
        if (sx === 0xffffffff) return -2;
        sx += 9;
        const sc = { v: sx };
        if (
          !readU(sc, input.length, xref) || xref.v >= input.length ||
          !lit(xref.v, input.length, [120, 114, 101, 102])
        ) return -3;
        const at = { v: xref.v + 4 }, first = { v: 0 }, size = { v: 0 };
        if (
          !readU(at, input.length, first) || first.v !== 0 || !readU(at, input.length, size) ||
          size.v < 2 || size.v > 512
        ) return -4;
        S.ocount = size.v - 1;
        for (let id = 0; id < size.v; id++) {
          const off = { v: 0 }, gen = { v: 0 };
          if (!readU(at, input.length, off) || !readU(at, input.length, gen)) return -5;
          skipWs(at, input.length);
          const state = inp(at.v);
          at.v++;
          while (at.v < input.length && inp(at.v) !== 10) at.v++;
          if (at.v < input.length) at.v++;
          if (id === 0) { if (state !== 102 || gen.v !== 65535) return -6; }
          else if (state !== 110 || gen.v !== 0 || off.v === 0 || off.v >= xref.v) return -7;
          else S.offs[id] = off.v;
        }
        if (!lit(at.v, input.length, [116, 114, 97, 105, 108, 101, 114])) return -8;
        const tEnd = findR(at.v, input.length, [115, 116, 97, 114, 116, 120, 114, 101, 102]);
        const sk0 = findK(at.v, tEnd, [47, 83, 105, 122, 101]),
          rk0 = findK(at.v, tEnd, [47, 82, 111, 111, 116]);
        const ts = { v: 0 }, root = { v: 0 }, rg = { v: 0 };
        if (tEnd === 0xffffffff || sk0 === 0xffffffff || rk0 === 0xffffffff) return -9;
        const sk = { v: sk0 + 5 }, rk = { v: rk0 + 5 };
        if (
          !readU(sk, tEnd, ts) || ts.v !== size.v || !readU(rk, tEnd, root) ||
          !readU(rk, tEnd, rg) || rg.v !== 0 || !mtok(rk, tEnd, [82]) || root.v === 0 ||
          root.v >= size.v
        ) return -10;
        for (let id = 1; id < size.v; id++) {
          const p = { v: S.offs[id] }, fid = { v: 0 }, gen = { v: 0 };
          if (
            !readU(p, xref.v, fid) || fid.v !== id || !readU(p, xref.v, gen) || gen.v !== 0 ||
            !mtok(p, xref.v, [111, 98, 106])
          ) return -11;
          const next = id + 1 < size.v ? S.offs[id + 1] : xref.v;
          const close = findR(p.v, next, [101, 110, 100, 111, 98, 106]);
          if (close === 0xffffffff) return -12;
          S.offs[id] = p.v;
          S.ends[id] = close;
        }
        const rs = { v: 0 }, re = { v: 0 }, pr = { v: 0 };
        if (
          !objRange(root.v, rs, re) ||
          !objHas(root.v, [47, 84, 121, 112, 101], [47, 67, 97, 116, 97, 108, 111, 103]) ||
          !refA(rs.v, re.v, [47, 80, 97, 103, 101, 115], pr)
        ) return -13;
        const ps = { v: 0 }, pe = { v: 0 }, cnt = { v: 0 };
        if (
          !objRange(pr.v, ps, pe) ||
          !objHas(pr.v, [47, 84, 121, 112, 101], [47, 80, 97, 103, 101, 115])
        ) return -14;
        const ca = findK(ps.v, pe.v, [47, 67, 111, 117, 110, 116]);
        let kids = findK(ps.v, pe.v, [47, 75, 105, 100, 115]);
        if (ca === 0xffffffff || kids === 0xffffffff) return -15;
        const cc = { v: ca + 6 };
        if (!readU(cc, pe.v, cnt) || cnt.v === 0 || cnt.v > 128) return -16;
        kids = findR(kids, pe.v, [91]);
        if (kids === 0xffffffff) return -17;
        const kc = { v: kids + 1 };
        let sharedFont = 0;
        for (let page = 0; page < cnt.v; page++) {
          const pid = { v: 0 }, gen = { v: 0 };
          if (
            !readU(kc, pe.v, pid) || !readU(kc, pe.v, gen) || gen.v !== 0 || !mtok(kc, pe.v, [82])
          ) return -18;
          const ps2 = { v: 0 },
            pe2 = { v: 0 },
            par = { v: 0 },
            cont = { v: 0 },
            fnt = { v: 0 },
            rs2 = { v: 0 },
            re2 = { v: 0 },
            fs2 = { v: 0 },
            fe2 = { v: 0 };
          if (
            !objRange(pid.v, ps2, pe2) ||
            !objHas(pid.v, [47, 84, 121, 112, 101], [47, 80, 97, 103, 101]) ||
            !refA(ps2.v, pe2.v, [47, 80, 97, 114, 101, 110, 116], par) || par.v !== pr.v ||
            findR(ps2.v, pe2.v, [
                47,
                77,
                101,
                100,
                105,
                97,
                66,
                111,
                120,
                32,
                91,
                48,
                32,
                48,
                32,
                54,
                49,
                50,
                32,
                55,
                57,
                50,
                93,
              ]) === 0xffffffff ||
            !dictAfter(ps2.v, pe2.v, [47, 82, 101, 115, 111, 117, 114, 99, 101, 115], rs2, re2) ||
            !dictAfter(rs2.v, re2.v, [47, 70, 111, 110, 116], fs2, fe2) ||
            !dRef(fs2.v, fe2.v, [47, 70, 49], fnt) ||
            !refA(ps2.v, pe2.v, [47, 67, 111, 110, 116, 101, 110, 116, 115], cont)
          ) return -19;
          if (page === 0) {
            sharedFont = fnt.v;
            if (!font(fnt.v)) return -20;
          } else if (fnt.v !== sharedFont) return -21;
          if (!content(cont.v, page)) return -22;
        }
        skipWs(kc, pe.v);
        if (kc.v >= pe.v || inp(kc.v) !== 93) return -23;
        let glyphs = 0, comparisons = 0;
        for (let page = 0; page < cnt.v; page++) {
          let found = false;
          const plen = S.plen[page];
          for (let i = 0; i + 6 <= plen; i++) {
            comparisons++;
            if (
              S.ptext[page][i] === 78 && S.ptext[page][i + 1] === 69 &&
              S.ptext[page][i + 2] === 69 && S.ptext[page][i + 3] === 68 &&
              S.ptext[page][i + 4] === 76 && S.ptext[page][i + 5] === 69
            ) found = true;
          }
          if (found) S.hp.push(page + 1);
          glyphs += plen;
        }
        S.counters[0] = S.ocount;
        S.counters[1] = cnt.v;
        S.counters[2] = glyphs;
        S.counters[3] = comparisons;
        S.counters[4] = 0;
        S.counters[5] = W;
        S.counters[6] = H;
        S.counters[7] = 1;
        S.counters[8] = W * H * 4;
        return 0;
      }

      const PDF_FIXTURE_B64 = [
        "JVBERi0xLjcKJVBERkJhc2UgZ2VuZXJhdGVkIHJlcG9ydAoxIDAgb2JqCjw8IC9UeXBlIC9DYXRhbG9n",
        "IC9QYWdlcyA0IDAgUiA+PgplbmRvYmoKMiAwIG9iago8PCAvUHJvZHVjZXIgKFBERkJhc2UgcmVwb3Np",
        "dG9yeS1vd25lZCBUeXBlMyBmaXh0dXJlIGdlbmVyYXRvcikgPj4KZW5kb2JqCjMgMCBvYmoKPDwgL1R5",
        "cGUgL0ZvbnQgL1N1YnR5cGUgL1R5cGUzIC9Gb250QkJveCBbMCAwIDYgN10gL0ZvbnRNYXRyaXggWzAu",
        "MTI1IDAgMCAwLjEyNSAwIDBdIC9FbmNvZGluZyA8PCAvVHlwZSAvRW5jb2RpbmcgL0Jhc2VFbmNvZGlu",
        "ZyAvV2luQW5zaUVuY29kaW5nIC9EaWZmZXJlbmNlcyBbIDMyIC9zcGFjZSA0OCAvemVybyA0OSAvb25l",
        "IDUwIC90d28gNTEgL3RocmVlIDUyIC9mb3VyIDUzIC9maXZlIDU0IC9zaXggNTUgL3NldmVuIDU2IC9l",
        "aWdodCA1NyAvbmluZSA2NSAvQSA2NiAvQiA2NyAvQyA2OCAvRCA2OSAvRSA3MSAvRyA3MiAvSCA3NSAv",
        "SyA3NiAvTCA3NyAvTSA3OCAvTiA3OSAvTyA4MCAvUCA4MiAvUiA4NCAvVCA4NSAvVV0gPj4gL0NoYXJQ",
        "cm9jcyA8PCAvLm5vdGRlZiAyMDUgMCBSIC9zcGFjZSAyMDYgMCBSIC96ZXJvIDIwNyAwIFIgL29uZSAy",
        "MDggMCBSIC90d28gMjA5IDAgUiAvdGhyZWUgMjEwIDAgUiAvZm91ciAyMTEgMCBSIC9maXZlIDIxMiAw",
        "IFIgL3NpeCAyMTMgMCBSIC9zZXZlbiAyMTQgMCBSIC9laWdodCAyMTUgMCBSIC9uaW5lIDIxNiAwIFIg",
        "L0EgMjE3IDAgUiAvQiAyMTggMCBSIC9DIDIxOSAwIFIgL0QgMjIwIDAgUiAvRSAyMjEgMCBSIC9HIDIy",
        "MiAwIFIgL0ggMjIzIDAgUiAvSyAyMjQgMCBSIC9MIDIyNSAwIFIgL00gMjI2IDAgUiAvTiAyMjcgMCBS",
        "IC9PIDIyOCAwIFIgL1AgMjI5IDAgUiAvUiAyMzAgMCBSIC9UIDIzMSAwIFIgL1UgMjMyIDAgUiA+PiAv",
        "Rmlyc3RDaGFyIDMyIC9MYXN0Q2hhciAxMjYgL1dpZHRocyBbNiA2IDYgNiA2IDYgNiA2IDYgNiA2IDYg",
        "NiA2IDYgNiA2IDYgNiA2IDYgNiA2IDYgNiA2IDYgNiA2IDYgNiA2IDYgNiA2IDYgNiA2IDYgNiA2IDYg",
        "NiA2IDYgNiA2IDYgNiA2IDYgNiA2IDYgNiA2IDYgNiA2IDYgNiA2IDYgNiA2IDYgNiA2IDYgNiA2IDYg",
        "NiA2IDYgNiA2IDYgNiA2IDYgNiA2IDYgNiA2IDYgNiA2IDYgNiA2IDYgNiA2XSAvVG9Vbmljb2RlIDIz",
        "MyAwIFIgPj4KZW5kb2JqCjQgMCBvYmoKPDwgL1R5cGUgL1BhZ2VzIC9Db3VudCAxMDAgL0tpZHMgWzUg",
        "MCBSIDcgMCBSIDkgMCBSIDExIDAgUiAxMyAwIFIgMTUgMCBSIDE3IDAgUiAxOSAwIFIgMjEgMCBSIDIz",
        "IDAgUiAyNSAwIFIgMjcgMCBSIDI5IDAgUiAzMSAwIFIgMzMgMCBSIDM1IDAgUiAzNyAwIFIgMzkgMCBS",
        "IDQxIDAgUiA0MyAwIFIgNDUgMCBSIDQ3IDAgUiA0OSAwIFIgNTEgMCBSIDUzIDAgUiA1NSAwIFIgNTcg",
        "MCBSIDU5IDAgUiA2MSAwIFIgNjMgMCBSIDY1IDAgUiA2NyAwIFIgNjkgMCBSIDcxIDAgUiA3MyAwIFIg",
        "NzUgMCBSIDc3IDAgUiA3OSAwIFIgODEgMCBSIDgzIDAgUiA4NSAwIFIgODcgMCBSIDg5IDAgUiA5MSAw",
        "IFIgOTMgMCBSIDk1IDAgUiA5NyAwIFIgOTkgMCBSIDEwMSAwIFIgMTAzIDAgUiAxMDUgMCBSIDEwNyAw",
        "IFIgMTA5IDAgUiAxMTEgMCBSIDExMyAwIFIgMTE1IDAgUiAxMTcgMCBSIDExOSAwIFIgMTIxIDAgUiAx",
        "MjMgMCBSIDEyNSAwIFIgMTI3IDAgUiAxMjkgMCBSIDEzMSAwIFIgMTMzIDAgUiAxMzUgMCBSIDEzNyAw",
        "IFIgMTM5IDAgUiAxNDEgMCBSIDE0MyAwIFIgMTQ1IDAgUiAxNDcgMCBSIDE0OSAwIFIgMTUxIDAgUiAx",
        "NTMgMCBSIDE1NSAwIFIgMTU3IDAgUiAxNTkgMCBSIDE2MSAwIFIgMTYzIDAgUiAxNjUgMCBSIDE2NyAw",
        "IFIgMTY5IDAgUiAxNzEgMCBSIDE3MyAwIFIgMTc1IDAgUiAxNzcgMCBSIDE3OSAwIFIgMTgxIDAgUiAx",
        "ODMgMCBSIDE4NSAwIFIgMTg3IDAgUiAxODkgMCBSIDE5MSAwIFIgMTkzIDAgUiAxOTUgMCBSIDE5NyAw",
        "IFIgMTk5IDAgUiAyMDEgMCBSIDIwMyAwIFJdID4+CmVuZG9iago1IDAgb2JqCjw8IC9UeXBlIC9QYWdl",
        "IC9QYXJlbnQgNCAwIFIgL01lZGlhQm94IFswIDAgNjEyIDc5Ml0gL1Jlc291cmNlcyA8PCAvRm9udCA8",
        "PCAvRjEgMyAwIFIgPj4gPj4gL0NvbnRlbnRzIDYgMCBSID4+CmVuZG9iago2IDAgb2JqCjw8IC9MZW5n",
        "dGggNjUgPj4Kc3RyZWFtCkJUIC9GMSAxNiBUZiAzNiA3NTAgVGQgKFJFUE9SVCBQQUdFIDAwMSBET0NV",
        "TUVOVCBCRU5DSE1BUkspIFRqIEVUCmVuZHN0cmVhbQplbmRvYmoKNyAwIG9iago8PCAvVHlwZSAvUGFn",
        "ZSAvUGFyZW50IDQgMCBSIC9NZWRpYUJveCBbMCAwIDYxMiA3OTJdIC9SZXNvdXJjZXMgPDwgL0ZvbnQg",
        "PDwgL0YxIDMgMCBSID4+ID4+IC9Db250ZW50cyA4IDAgUiA+PgplbmRvYmoKOCAwIG9iago8PCAvTGVu",
        "Z3RoIDY1ID4+CnN0cmVhbQpCVCAvRjEgMTYgVGYgMzYgNzUwIFRkIChSRVBPUlQgUEFHRSAwMDIgRE9D",
        "VU1FTlQgQkVOQ0hNQVJLKSBUaiBFVAplbmRzdHJlYW0KZW5kb2JqCjkgMCBvYmoKPDwgL1R5cGUgL1Bh",
        "Z2UgL1BhcmVudCA0IDAgUiAvTWVkaWFCb3ggWzAgMCA2MTIgNzkyXSAvUmVzb3VyY2VzIDw8IC9Gb250",
        "IDw8IC9GMSAzIDAgUiA+PiA+PiAvQ29udGVudHMgMTAgMCBSID4+CmVuZG9iagoxMCAwIG9iago8PCAv",
        "TGVuZ3RoIDY1ID4+CnN0cmVhbQpCVCAvRjEgMTYgVGYgMzYgNzUwIFRkIChSRVBPUlQgUEFHRSAwMDMg",
        "RE9DVU1FTlQgQkVOQ0hNQVJLKSBUaiBFVAplbmRzdHJlYW0KZW5kb2JqCjExIDAgb2JqCjw8IC9UeXBl",
        "IC9QYWdlIC9QYXJlbnQgNCAwIFIgL01lZGlhQm94IFswIDAgNjEyIDc5Ml0gL1Jlc291cmNlcyA8PCAv",
        "Rm9udCA8PCAvRjEgMyAwIFIgPj4gPj4gL0NvbnRlbnRzIDEyIDAgUiA+PgplbmRvYmoKMTIgMCBvYmoK",
        "PDwgL0xlbmd0aCA2NSA+PgpzdHJlYW0KQlQgL0YxIDE2IFRmIDM2IDc1MCBUZCAoUkVQT1JUIFBBR0Ug",
        "MDA0IERPQ1VNRU5UIEJFTkNITUFSSykgVGogRVQKZW5kc3RyZWFtCmVuZG9iagoxMyAwIG9iago8PCAv",
        "VHlwZSAvUGFnZSAvUGFyZW50IDQgMCBSIC9NZWRpYUJveCBbMCAwIDYxMiA3OTJdIC9SZXNvdXJjZXMg",
        "PDwgL0ZvbnQgPDwgL0YxIDMgMCBSID4+ID4+IC9Db250ZW50cyAxNCAwIFIgPj4KZW5kb2JqCjE0IDAg",
        "b2JqCjw8IC9MZW5ndGggNjUgPj4Kc3RyZWFtCkJUIC9GMSAxNiBUZiAzNiA3NTAgVGQgKFJFUE9SVCBQ",
        "QUdFIDAwNSBET0NVTUVOVCBCRU5DSE1BUkspIFRqIEVUCmVuZHN0cmVhbQplbmRvYmoKMTUgMCBvYmoK",
        "PDwgL1R5cGUgL1BhZ2UgL1BhcmVudCA0IDAgUiAvTWVkaWFCb3ggWzAgMCA2MTIgNzkyXSAvUmVzb3Vy",
        "Y2VzIDw8IC9Gb250IDw8IC9GMSAzIDAgUiA+PiA+PiAvQ29udGVudHMgMTYgMCBSID4+CmVuZG9iagox",
        "NiAwIG9iago8PCAvTGVuZ3RoIDY1ID4+CnN0cmVhbQpCVCAvRjEgMTYgVGYgMzYgNzUwIFRkIChSRVBP",
        "UlQgUEFHRSAwMDYgRE9DVU1FTlQgQkVOQ0hNQVJLKSBUaiBFVAplbmRzdHJlYW0KZW5kb2JqCjE3IDAg",
        "b2JqCjw8IC9UeXBlIC9QYWdlIC9QYXJlbnQgNCAwIFIgL01lZGlhQm94IFswIDAgNjEyIDc5Ml0gL1Jl",
        "c291cmNlcyA8PCAvRm9udCA8PCAvRjEgMyAwIFIgPj4gPj4gL0NvbnRlbnRzIDE4IDAgUiA+PgplbmRv",
        "YmoKMTggMCBvYmoKPDwgL0xlbmd0aCA2NSA+PgpzdHJlYW0KQlQgL0YxIDE2IFRmIDM2IDc1MCBUZCAo",
        "UkVQT1JUIFBBR0UgMDA3IERPQ1VNRU5UIEJFTkNITUFSSykgVGogRVQKZW5kc3RyZWFtCmVuZG9iagox",
        "OSAwIG9iago8PCAvVHlwZSAvUGFnZSAvUGFyZW50IDQgMCBSIC9NZWRpYUJveCBbMCAwIDYxMiA3OTJd",
        "IC9SZXNvdXJjZXMgPDwgL0ZvbnQgPDwgL0YxIDMgMCBSID4+ID4+IC9Db250ZW50cyAyMCAwIFIgPj4K",
        "ZW5kb2JqCjIwIDAgb2JqCjw8IC9MZW5ndGggNjUgPj4Kc3RyZWFtCkJUIC9GMSAxNiBUZiAzNiA3NTAg",
        "VGQgKFJFUE9SVCBQQUdFIDAwOCBET0NVTUVOVCBCRU5DSE1BUkspIFRqIEVUCmVuZHN0cmVhbQplbmRv",
        "YmoKMjEgMCBvYmoKPDwgL1R5cGUgL1BhZ2UgL1BhcmVudCA0IDAgUiAvTWVkaWFCb3ggWzAgMCA2MTIg",
        "NzkyXSAvUmVzb3VyY2VzIDw8IC9Gb250IDw8IC9GMSAzIDAgUiA+PiA+PiAvQ29udGVudHMgMjIgMCBS",
        "ID4+CmVuZG9iagoyMiAwIG9iago8PCAvTGVuZ3RoIDY1ID4+CnN0cmVhbQpCVCAvRjEgMTYgVGYgMzYg",
        "NzUwIFRkIChSRVBPUlQgUEFHRSAwMDkgRE9DVU1FTlQgQkVOQ0hNQVJLKSBUaiBFVAplbmRzdHJlYW0K",
        "ZW5kb2JqCjIzIDAgb2JqCjw8IC9UeXBlIC9QYWdlIC9QYXJlbnQgNCAwIFIgL01lZGlhQm94IFswIDAg",
        "NjEyIDc5Ml0gL1Jlc291cmNlcyA8PCAvRm9udCA8PCAvRjEgMyAwIFIgPj4gPj4gL0NvbnRlbnRzIDI0",
        "IDAgUiA+PgplbmRvYmoKMjQgMCBvYmoKPDwgL0xlbmd0aCA3MiA+PgpzdHJlYW0KQlQgL0YxIDE2IFRm",
        "IDM2IDc1MCBUZCAoUkVQT1JUIFBBR0UgMDEwIERPQ1VNRU5UIEJFTkNITUFSSyBORUVETEUpIFRqIEVU",
        "CmVuZHN0cmVhbQplbmRvYmoKMjUgMCBvYmoKPDwgL1R5cGUgL1BhZ2UgL1BhcmVudCA0IDAgUiAvTWVk",
        "aWFCb3ggWzAgMCA2MTIgNzkyXSAvUmVzb3VyY2VzIDw8IC9Gb250IDw8IC9GMSAzIDAgUiA+PiA+PiAv",
        "Q29udGVudHMgMjYgMCBSID4+CmVuZG9iagoyNiAwIG9iago8PCAvTGVuZ3RoIDY1ID4+CnN0cmVhbQpC",
        "VCAvRjEgMTYgVGYgMzYgNzUwIFRkIChSRVBPUlQgUEFHRSAwMTEgRE9DVU1FTlQgQkVOQ0hNQVJLKSBU",
        "aiBFVAplbmRzdHJlYW0KZW5kb2JqCjI3IDAgb2JqCjw8IC9UeXBlIC9QYWdlIC9QYXJlbnQgNCAwIFIg",
        "L01lZGlhQm94IFswIDAgNjEyIDc5Ml0gL1Jlc291cmNlcyA8PCAvRm9udCA8PCAvRjEgMyAwIFIgPj4g",
        "Pj4gL0NvbnRlbnRzIDI4IDAgUiA+PgplbmRvYmoKMjggMCBvYmoKPDwgL0xlbmd0aCA2NSA+PgpzdHJl",
        "YW0KQlQgL0YxIDE2IFRmIDM2IDc1MCBUZCAoUkVQT1JUIFBBR0UgMDEyIERPQ1VNRU5UIEJFTkNITUFS",
        "SykgVGogRVQKZW5kc3RyZWFtCmVuZG9iagoyOSAwIG9iago8PCAvVHlwZSAvUGFnZSAvUGFyZW50IDQg",
        "MCBSIC9NZWRpYUJveCBbMCAwIDYxMiA3OTJdIC9SZXNvdXJjZXMgPDwgL0ZvbnQgPDwgL0YxIDMgMCBS",
        "ID4+ID4+IC9Db250ZW50cyAzMCAwIFIgPj4KZW5kb2JqCjMwIDAgb2JqCjw8IC9MZW5ndGggNjUgPj4K",
        "c3RyZWFtCkJUIC9GMSAxNiBUZiAzNiA3NTAgVGQgKFJFUE9SVCBQQUdFIDAxMyBET0NVTUVOVCBCRU5D",
        "SE1BUkspIFRqIEVUCmVuZHN0cmVhbQplbmRvYmoKMzEgMCBvYmoKPDwgL1R5cGUgL1BhZ2UgL1BhcmVu",
        "dCA0IDAgUiAvTWVkaWFCb3ggWzAgMCA2MTIgNzkyXSAvUmVzb3VyY2VzIDw8IC9Gb250IDw8IC9GMSAz",
        "IDAgUiA+PiA+PiAvQ29udGVudHMgMzIgMCBSID4+CmVuZG9iagozMiAwIG9iago8PCAvTGVuZ3RoIDY1",
        "ID4+CnN0cmVhbQpCVCAvRjEgMTYgVGYgMzYgNzUwIFRkIChSRVBPUlQgUEFHRSAwMTQgRE9DVU1FTlQg",
        "QkVOQ0hNQVJLKSBUaiBFVAplbmRzdHJlYW0KZW5kb2JqCjMzIDAgb2JqCjw8IC9UeXBlIC9QYWdlIC9Q",
        "YXJlbnQgNCAwIFIgL01lZGlhQm94IFswIDAgNjEyIDc5Ml0gL1Jlc291cmNlcyA8PCAvRm9udCA8PCAv",
        "RjEgMyAwIFIgPj4gPj4gL0NvbnRlbnRzIDM0IDAgUiA+PgplbmRvYmoKMzQgMCBvYmoKPDwgL0xlbmd0",
        "aCA2NSA+PgpzdHJlYW0KQlQgL0YxIDE2IFRmIDM2IDc1MCBUZCAoUkVQT1JUIFBBR0UgMDE1IERPQ1VN",
        "RU5UIEJFTkNITUFSSykgVGogRVQKZW5kc3RyZWFtCmVuZG9iagozNSAwIG9iago8PCAvVHlwZSAvUGFn",
        "ZSAvUGFyZW50IDQgMCBSIC9NZWRpYUJveCBbMCAwIDYxMiA3OTJdIC9SZXNvdXJjZXMgPDwgL0ZvbnQg",
        "PDwgL0YxIDMgMCBSID4+ID4+IC9Db250ZW50cyAzNiAwIFIgPj4KZW5kb2JqCjM2IDAgb2JqCjw8IC9M",
        "ZW5ndGggNjUgPj4Kc3RyZWFtCkJUIC9GMSAxNiBUZiAzNiA3NTAgVGQgKFJFUE9SVCBQQUdFIDAxNiBE",
        "T0NVTUVOVCBCRU5DSE1BUkspIFRqIEVUCmVuZHN0cmVhbQplbmRvYmoKMzcgMCBvYmoKPDwgL1R5cGUg",
        "L1BhZ2UgL1BhcmVudCA0IDAgUiAvTWVkaWFCb3ggWzAgMCA2MTIgNzkyXSAvUmVzb3VyY2VzIDw8IC9G",
        "b250IDw8IC9GMSAzIDAgUiA+PiA+PiAvQ29udGVudHMgMzggMCBSID4+CmVuZG9iagozOCAwIG9iago8",
        "PCAvTGVuZ3RoIDY1ID4+CnN0cmVhbQpCVCAvRjEgMTYgVGYgMzYgNzUwIFRkIChSRVBPUlQgUEFHRSAw",
        "MTcgRE9DVU1FTlQgQkVOQ0hNQVJLKSBUaiBFVAplbmRzdHJlYW0KZW5kb2JqCjM5IDAgb2JqCjw8IC9U",
        "eXBlIC9QYWdlIC9QYXJlbnQgNCAwIFIgL01lZGlhQm94IFswIDAgNjEyIDc5Ml0gL1Jlc291cmNlcyA8",
        "PCAvRm9udCA8PCAvRjEgMyAwIFIgPj4gPj4gL0NvbnRlbnRzIDQwIDAgUiA+PgplbmRvYmoKNDAgMCBv",
        "YmoKPDwgL0xlbmd0aCA2NSA+PgpzdHJlYW0KQlQgL0YxIDE2IFRmIDM2IDc1MCBUZCAoUkVQT1JUIFBB",
        "R0UgMDE4IERPQ1VNRU5UIEJFTkNITUFSSykgVGogRVQKZW5kc3RyZWFtCmVuZG9iago0MSAwIG9iago8",
        "PCAvVHlwZSAvUGFnZSAvUGFyZW50IDQgMCBSIC9NZWRpYUJveCBbMCAwIDYxMiA3OTJdIC9SZXNvdXJj",
        "ZXMgPDwgL0ZvbnQgPDwgL0YxIDMgMCBSID4+ID4+IC9Db250ZW50cyA0MiAwIFIgPj4KZW5kb2JqCjQy",
        "IDAgb2JqCjw8IC9MZW5ndGggNjUgPj4Kc3RyZWFtCkJUIC9GMSAxNiBUZiAzNiA3NTAgVGQgKFJFUE9S",
        "VCBQQUdFIDAxOSBET0NVTUVOVCBCRU5DSE1BUkspIFRqIEVUCmVuZHN0cmVhbQplbmRvYmoKNDMgMCBv",
        "YmoKPDwgL1R5cGUgL1BhZ2UgL1BhcmVudCA0IDAgUiAvTWVkaWFCb3ggWzAgMCA2MTIgNzkyXSAvUmVz",
        "b3VyY2VzIDw8IC9Gb250IDw8IC9GMSAzIDAgUiA+PiA+PiAvQ29udGVudHMgNDQgMCBSID4+CmVuZG9i",
        "ago0NCAwIG9iago8PCAvTGVuZ3RoIDcyID4+CnN0cmVhbQpCVCAvRjEgMTYgVGYgMzYgNzUwIFRkIChS",
        "RVBPUlQgUEFHRSAwMjAgRE9DVU1FTlQgQkVOQ0hNQVJLIE5FRURMRSkgVGogRVQKZW5kc3RyZWFtCmVu",
        "ZG9iago0NSAwIG9iago8PCAvVHlwZSAvUGFnZSAvUGFyZW50IDQgMCBSIC9NZWRpYUJveCBbMCAwIDYx",
        "MiA3OTJdIC9SZXNvdXJjZXMgPDwgL0ZvbnQgPDwgL0YxIDMgMCBSID4+ID4+IC9Db250ZW50cyA0NiAw",
        "IFIgPj4KZW5kb2JqCjQ2IDAgb2JqCjw8IC9MZW5ndGggNjUgPj4Kc3RyZWFtCkJUIC9GMSAxNiBUZiAz",
        "NiA3NTAgVGQgKFJFUE9SVCBQQUdFIDAyMSBET0NVTUVOVCBCRU5DSE1BUkspIFRqIEVUCmVuZHN0cmVh",
        "bQplbmRvYmoKNDcgMCBvYmoKPDwgL1R5cGUgL1BhZ2UgL1BhcmVudCA0IDAgUiAvTWVkaWFCb3ggWzAg",
        "MCA2MTIgNzkyXSAvUmVzb3VyY2VzIDw8IC9Gb250IDw8IC9GMSAzIDAgUiA+PiA+PiAvQ29udGVudHMg",
        "NDggMCBSID4+CmVuZG9iago0OCAwIG9iago8PCAvTGVuZ3RoIDY1ID4+CnN0cmVhbQpCVCAvRjEgMTYg",
        "VGYgMzYgNzUwIFRkIChSRVBPUlQgUEFHRSAwMjIgRE9DVU1FTlQgQkVOQ0hNQVJLKSBUaiBFVAplbmRz",
        "dHJlYW0KZW5kb2JqCjQ5IDAgb2JqCjw8IC9UeXBlIC9QYWdlIC9QYXJlbnQgNCAwIFIgL01lZGlhQm94",
        "IFswIDAgNjEyIDc5Ml0gL1Jlc291cmNlcyA8PCAvRm9udCA8PCAvRjEgMyAwIFIgPj4gPj4gL0NvbnRl",
        "bnRzIDUwIDAgUiA+PgplbmRvYmoKNTAgMCBvYmoKPDwgL0xlbmd0aCA2NSA+PgpzdHJlYW0KQlQgL0Yx",
        "IDE2IFRmIDM2IDc1MCBUZCAoUkVQT1JUIFBBR0UgMDIzIERPQ1VNRU5UIEJFTkNITUFSSykgVGogRVQK",
        "ZW5kc3RyZWFtCmVuZG9iago1MSAwIG9iago8PCAvVHlwZSAvUGFnZSAvUGFyZW50IDQgMCBSIC9NZWRp",
        "YUJveCBbMCAwIDYxMiA3OTJdIC9SZXNvdXJjZXMgPDwgL0ZvbnQgPDwgL0YxIDMgMCBSID4+ID4+IC9D",
        "b250ZW50cyA1MiAwIFIgPj4KZW5kb2JqCjUyIDAgb2JqCjw8IC9MZW5ndGggNjUgPj4Kc3RyZWFtCkJU",
        "IC9GMSAxNiBUZiAzNiA3NTAgVGQgKFJFUE9SVCBQQUdFIDAyNCBET0NVTUVOVCBCRU5DSE1BUkspIFRq",
        "IEVUCmVuZHN0cmVhbQplbmRvYmoKNTMgMCBvYmoKPDwgL1R5cGUgL1BhZ2UgL1BhcmVudCA0IDAgUiAv",
        "TWVkaWFCb3ggWzAgMCA2MTIgNzkyXSAvUmVzb3VyY2VzIDw8IC9Gb250IDw8IC9GMSAzIDAgUiA+PiA+",
        "PiAvQ29udGVudHMgNTQgMCBSID4+CmVuZG9iago1NCAwIG9iago8PCAvTGVuZ3RoIDY1ID4+CnN0cmVh",
        "bQpCVCAvRjEgMTYgVGYgMzYgNzUwIFRkIChSRVBPUlQgUEFHRSAwMjUgRE9DVU1FTlQgQkVOQ0hNQVJL",
        "KSBUaiBFVAplbmRzdHJlYW0KZW5kb2JqCjU1IDAgb2JqCjw8IC9UeXBlIC9QYWdlIC9QYXJlbnQgNCAw",
        "IFIgL01lZGlhQm94IFswIDAgNjEyIDc5Ml0gL1Jlc291cmNlcyA8PCAvRm9udCA8PCAvRjEgMyAwIFIg",
        "Pj4gPj4gL0NvbnRlbnRzIDU2IDAgUiA+PgplbmRvYmoKNTYgMCBvYmoKPDwgL0xlbmd0aCA2NSA+Pgpz",
        "dHJlYW0KQlQgL0YxIDE2IFRmIDM2IDc1MCBUZCAoUkVQT1JUIFBBR0UgMDI2IERPQ1VNRU5UIEJFTkNI",
        "TUFSSykgVGogRVQKZW5kc3RyZWFtCmVuZG9iago1NyAwIG9iago8PCAvVHlwZSAvUGFnZSAvUGFyZW50",
        "IDQgMCBSIC9NZWRpYUJveCBbMCAwIDYxMiA3OTJdIC9SZXNvdXJjZXMgPDwgL0ZvbnQgPDwgL0YxIDMg",
        "MCBSID4+ID4+IC9Db250ZW50cyA1OCAwIFIgPj4KZW5kb2JqCjU4IDAgb2JqCjw8IC9MZW5ndGggNjUg",
        "Pj4Kc3RyZWFtCkJUIC9GMSAxNiBUZiAzNiA3NTAgVGQgKFJFUE9SVCBQQUdFIDAyNyBET0NVTUVOVCBC",
        "RU5DSE1BUkspIFRqIEVUCmVuZHN0cmVhbQplbmRvYmoKNTkgMCBvYmoKPDwgL1R5cGUgL1BhZ2UgL1Bh",
        "cmVudCA0IDAgUiAvTWVkaWFCb3ggWzAgMCA2MTIgNzkyXSAvUmVzb3VyY2VzIDw8IC9Gb250IDw8IC9G",
        "MSAzIDAgUiA+PiA+PiAvQ29udGVudHMgNjAgMCBSID4+CmVuZG9iago2MCAwIG9iago8PCAvTGVuZ3Ro",
        "IDY1ID4+CnN0cmVhbQpCVCAvRjEgMTYgVGYgMzYgNzUwIFRkIChSRVBPUlQgUEFHRSAwMjggRE9DVU1F",
        "TlQgQkVOQ0hNQVJLKSBUaiBFVAplbmRzdHJlYW0KZW5kb2JqCjYxIDAgb2JqCjw8IC9UeXBlIC9QYWdl",
        "IC9QYXJlbnQgNCAwIFIgL01lZGlhQm94IFswIDAgNjEyIDc5Ml0gL1Jlc291cmNlcyA8PCAvRm9udCA8",
        "PCAvRjEgMyAwIFIgPj4gPj4gL0NvbnRlbnRzIDYyIDAgUiA+PgplbmRvYmoKNjIgMCBvYmoKPDwgL0xl",
        "bmd0aCA2NSA+PgpzdHJlYW0KQlQgL0YxIDE2IFRmIDM2IDc1MCBUZCAoUkVQT1JUIFBBR0UgMDI5IERP",
        "Q1VNRU5UIEJFTkNITUFSSykgVGogRVQKZW5kc3RyZWFtCmVuZG9iago2MyAwIG9iago8PCAvVHlwZSAv",
        "UGFnZSAvUGFyZW50IDQgMCBSIC9NZWRpYUJveCBbMCAwIDYxMiA3OTJdIC9SZXNvdXJjZXMgPDwgL0Zv",
        "bnQgPDwgL0YxIDMgMCBSID4+ID4+IC9Db250ZW50cyA2NCAwIFIgPj4KZW5kb2JqCjY0IDAgb2JqCjw8",
        "IC9MZW5ndGggNzIgPj4Kc3RyZWFtCkJUIC9GMSAxNiBUZiAzNiA3NTAgVGQgKFJFUE9SVCBQQUdFIDAz",
        "MCBET0NVTUVOVCBCRU5DSE1BUksgTkVFRExFKSBUaiBFVAplbmRzdHJlYW0KZW5kb2JqCjY1IDAgb2Jq",
        "Cjw8IC9UeXBlIC9QYWdlIC9QYXJlbnQgNCAwIFIgL01lZGlhQm94IFswIDAgNjEyIDc5Ml0gL1Jlc291",
        "cmNlcyA8PCAvRm9udCA8PCAvRjEgMyAwIFIgPj4gPj4gL0NvbnRlbnRzIDY2IDAgUiA+PgplbmRvYmoK",
        "NjYgMCBvYmoKPDwgL0xlbmd0aCA2NSA+PgpzdHJlYW0KQlQgL0YxIDE2IFRmIDM2IDc1MCBUZCAoUkVQ",
        "T1JUIFBBR0UgMDMxIERPQ1VNRU5UIEJFTkNITUFSSykgVGogRVQKZW5kc3RyZWFtCmVuZG9iago2NyAw",
        "IG9iago8PCAvVHlwZSAvUGFnZSAvUGFyZW50IDQgMCBSIC9NZWRpYUJveCBbMCAwIDYxMiA3OTJdIC9S",
        "ZXNvdXJjZXMgPDwgL0ZvbnQgPDwgL0YxIDMgMCBSID4+ID4+IC9Db250ZW50cyA2OCAwIFIgPj4KZW5k",
        "b2JqCjY4IDAgb2JqCjw8IC9MZW5ndGggNjUgPj4Kc3RyZWFtCkJUIC9GMSAxNiBUZiAzNiA3NTAgVGQg",
        "KFJFUE9SVCBQQUdFIDAzMiBET0NVTUVOVCBCRU5DSE1BUkspIFRqIEVUCmVuZHN0cmVhbQplbmRvYmoK",
        "NjkgMCBvYmoKPDwgL1R5cGUgL1BhZ2UgL1BhcmVudCA0IDAgUiAvTWVkaWFCb3ggWzAgMCA2MTIgNzky",
        "XSAvUmVzb3VyY2VzIDw8IC9Gb250IDw8IC9GMSAzIDAgUiA+PiA+PiAvQ29udGVudHMgNzAgMCBSID4+",
        "CmVuZG9iago3MCAwIG9iago8PCAvTGVuZ3RoIDY1ID4+CnN0cmVhbQpCVCAvRjEgMTYgVGYgMzYgNzUw",
        "IFRkIChSRVBPUlQgUEFHRSAwMzMgRE9DVU1FTlQgQkVOQ0hNQVJLKSBUaiBFVAplbmRzdHJlYW0KZW5k",
        "b2JqCjcxIDAgb2JqCjw8IC9UeXBlIC9QYWdlIC9QYXJlbnQgNCAwIFIgL01lZGlhQm94IFswIDAgNjEy",
        "IDc5Ml0gL1Jlc291cmNlcyA8PCAvRm9udCA8PCAvRjEgMyAwIFIgPj4gPj4gL0NvbnRlbnRzIDcyIDAg",
        "UiA+PgplbmRvYmoKNzIgMCBvYmoKPDwgL0xlbmd0aCA2NSA+PgpzdHJlYW0KQlQgL0YxIDE2IFRmIDM2",
        "IDc1MCBUZCAoUkVQT1JUIFBBR0UgMDM0IERPQ1VNRU5UIEJFTkNITUFSSykgVGogRVQKZW5kc3RyZWFt",
        "CmVuZG9iago3MyAwIG9iago8PCAvVHlwZSAvUGFnZSAvUGFyZW50IDQgMCBSIC9NZWRpYUJveCBbMCAw",
        "IDYxMiA3OTJdIC9SZXNvdXJjZXMgPDwgL0ZvbnQgPDwgL0YxIDMgMCBSID4+ID4+IC9Db250ZW50cyA3",
        "NCAwIFIgPj4KZW5kb2JqCjc0IDAgb2JqCjw8IC9MZW5ndGggNjUgPj4Kc3RyZWFtCkJUIC9GMSAxNiBU",
        "ZiAzNiA3NTAgVGQgKFJFUE9SVCBQQUdFIDAzNSBET0NVTUVOVCBCRU5DSE1BUkspIFRqIEVUCmVuZHN0",
        "cmVhbQplbmRvYmoKNzUgMCBvYmoKPDwgL1R5cGUgL1BhZ2UgL1BhcmVudCA0IDAgUiAvTWVkaWFCb3gg",
        "WzAgMCA2MTIgNzkyXSAvUmVzb3VyY2VzIDw8IC9Gb250IDw8IC9GMSAzIDAgUiA+PiA+PiAvQ29udGVu",
        "dHMgNzYgMCBSID4+CmVuZG9iago3NiAwIG9iago8PCAvTGVuZ3RoIDY1ID4+CnN0cmVhbQpCVCAvRjEg",
        "MTYgVGYgMzYgNzUwIFRkIChSRVBPUlQgUEFHRSAwMzYgRE9DVU1FTlQgQkVOQ0hNQVJLKSBUaiBFVApl",
        "bmRzdHJlYW0KZW5kb2JqCjc3IDAgb2JqCjw8IC9UeXBlIC9QYWdlIC9QYXJlbnQgNCAwIFIgL01lZGlh",
        "Qm94IFswIDAgNjEyIDc5Ml0gL1Jlc291cmNlcyA8PCAvRm9udCA8PCAvRjEgMyAwIFIgPj4gPj4gL0Nv",
        "bnRlbnRzIDc4IDAgUiA+PgplbmRvYmoKNzggMCBvYmoKPDwgL0xlbmd0aCA2NSA+PgpzdHJlYW0KQlQg",
        "L0YxIDE2IFRmIDM2IDc1MCBUZCAoUkVQT1JUIFBBR0UgMDM3IERPQ1VNRU5UIEJFTkNITUFSSykgVGog",
        "RVQKZW5kc3RyZWFtCmVuZG9iago3OSAwIG9iago8PCAvVHlwZSAvUGFnZSAvUGFyZW50IDQgMCBSIC9N",
        "ZWRpYUJveCBbMCAwIDYxMiA3OTJdIC9SZXNvdXJjZXMgPDwgL0ZvbnQgPDwgL0YxIDMgMCBSID4+ID4+",
        "IC9Db250ZW50cyA4MCAwIFIgPj4KZW5kb2JqCjgwIDAgb2JqCjw8IC9MZW5ndGggNjUgPj4Kc3RyZWFt",
        "CkJUIC9GMSAxNiBUZiAzNiA3NTAgVGQgKFJFUE9SVCBQQUdFIDAzOCBET0NVTUVOVCBCRU5DSE1BUksp",
        "IFRqIEVUCmVuZHN0cmVhbQplbmRvYmoKODEgMCBvYmoKPDwgL1R5cGUgL1BhZ2UgL1BhcmVudCA0IDAg",
        "UiAvTWVkaWFCb3ggWzAgMCA2MTIgNzkyXSAvUmVzb3VyY2VzIDw8IC9Gb250IDw8IC9GMSAzIDAgUiA+",
        "PiA+PiAvQ29udGVudHMgODIgMCBSID4+CmVuZG9iago4MiAwIG9iago8PCAvTGVuZ3RoIDY1ID4+CnN0",
        "cmVhbQpCVCAvRjEgMTYgVGYgMzYgNzUwIFRkIChSRVBPUlQgUEFHRSAwMzkgRE9DVU1FTlQgQkVOQ0hN",
        "QVJLKSBUaiBFVAplbmRzdHJlYW0KZW5kb2JqCjgzIDAgb2JqCjw8IC9UeXBlIC9QYWdlIC9QYXJlbnQg",
        "NCAwIFIgL01lZGlhQm94IFswIDAgNjEyIDc5Ml0gL1Jlc291cmNlcyA8PCAvRm9udCA8PCAvRjEgMyAw",
        "IFIgPj4gPj4gL0NvbnRlbnRzIDg0IDAgUiA+PgplbmRvYmoKODQgMCBvYmoKPDwgL0xlbmd0aCA3MiA+",
        "PgpzdHJlYW0KQlQgL0YxIDE2IFRmIDM2IDc1MCBUZCAoUkVQT1JUIFBBR0UgMDQwIERPQ1VNRU5UIEJF",
        "TkNITUFSSyBORUVETEUpIFRqIEVUCmVuZHN0cmVhbQplbmRvYmoKODUgMCBvYmoKPDwgL1R5cGUgL1Bh",
        "Z2UgL1BhcmVudCA0IDAgUiAvTWVkaWFCb3ggWzAgMCA2MTIgNzkyXSAvUmVzb3VyY2VzIDw8IC9Gb250",
        "IDw8IC9GMSAzIDAgUiA+PiA+PiAvQ29udGVudHMgODYgMCBSID4+CmVuZG9iago4NiAwIG9iago8PCAv",
        "TGVuZ3RoIDY1ID4+CnN0cmVhbQpCVCAvRjEgMTYgVGYgMzYgNzUwIFRkIChSRVBPUlQgUEFHRSAwNDEg",
        "RE9DVU1FTlQgQkVOQ0hNQVJLKSBUaiBFVAplbmRzdHJlYW0KZW5kb2JqCjg3IDAgb2JqCjw8IC9UeXBl",
        "IC9QYWdlIC9QYXJlbnQgNCAwIFIgL01lZGlhQm94IFswIDAgNjEyIDc5Ml0gL1Jlc291cmNlcyA8PCAv",
        "Rm9udCA8PCAvRjEgMyAwIFIgPj4gPj4gL0NvbnRlbnRzIDg4IDAgUiA+PgplbmRvYmoKODggMCBvYmoK",
        "PDwgL0xlbmd0aCA2NSA+PgpzdHJlYW0KQlQgL0YxIDE2IFRmIDM2IDc1MCBUZCAoUkVQT1JUIFBBR0Ug",
        "MDQyIERPQ1VNRU5UIEJFTkNITUFSSykgVGogRVQKZW5kc3RyZWFtCmVuZG9iago4OSAwIG9iago8PCAv",
        "VHlwZSAvUGFnZSAvUGFyZW50IDQgMCBSIC9NZWRpYUJveCBbMCAwIDYxMiA3OTJdIC9SZXNvdXJjZXMg",
        "PDwgL0ZvbnQgPDwgL0YxIDMgMCBSID4+ID4+IC9Db250ZW50cyA5MCAwIFIgPj4KZW5kb2JqCjkwIDAg",
        "b2JqCjw8IC9MZW5ndGggNjUgPj4Kc3RyZWFtCkJUIC9GMSAxNiBUZiAzNiA3NTAgVGQgKFJFUE9SVCBQ",
        "QUdFIDA0MyBET0NVTUVOVCBCRU5DSE1BUkspIFRqIEVUCmVuZHN0cmVhbQplbmRvYmoKOTEgMCBvYmoK",
        "PDwgL1R5cGUgL1BhZ2UgL1BhcmVudCA0IDAgUiAvTWVkaWFCb3ggWzAgMCA2MTIgNzkyXSAvUmVzb3Vy",
        "Y2VzIDw8IC9Gb250IDw8IC9GMSAzIDAgUiA+PiA+PiAvQ29udGVudHMgOTIgMCBSID4+CmVuZG9iago5",
        "MiAwIG9iago8PCAvTGVuZ3RoIDY1ID4+CnN0cmVhbQpCVCAvRjEgMTYgVGYgMzYgNzUwIFRkIChSRVBP",
        "UlQgUEFHRSAwNDQgRE9DVU1FTlQgQkVOQ0hNQVJLKSBUaiBFVAplbmRzdHJlYW0KZW5kb2JqCjkzIDAg",
        "b2JqCjw8IC9UeXBlIC9QYWdlIC9QYXJlbnQgNCAwIFIgL01lZGlhQm94IFswIDAgNjEyIDc5Ml0gL1Jl",
        "c291cmNlcyA8PCAvRm9udCA8PCAvRjEgMyAwIFIgPj4gPj4gL0NvbnRlbnRzIDk0IDAgUiA+PgplbmRv",
        "YmoKOTQgMCBvYmoKPDwgL0xlbmd0aCA2NSA+PgpzdHJlYW0KQlQgL0YxIDE2IFRmIDM2IDc1MCBUZCAo",
        "UkVQT1JUIFBBR0UgMDQ1IERPQ1VNRU5UIEJFTkNITUFSSykgVGogRVQKZW5kc3RyZWFtCmVuZG9iago5",
        "NSAwIG9iago8PCAvVHlwZSAvUGFnZSAvUGFyZW50IDQgMCBSIC9NZWRpYUJveCBbMCAwIDYxMiA3OTJd",
        "IC9SZXNvdXJjZXMgPDwgL0ZvbnQgPDwgL0YxIDMgMCBSID4+ID4+IC9Db250ZW50cyA5NiAwIFIgPj4K",
        "ZW5kb2JqCjk2IDAgb2JqCjw8IC9MZW5ndGggNjUgPj4Kc3RyZWFtCkJUIC9GMSAxNiBUZiAzNiA3NTAg",
        "VGQgKFJFUE9SVCBQQUdFIDA0NiBET0NVTUVOVCBCRU5DSE1BUkspIFRqIEVUCmVuZHN0cmVhbQplbmRv",
        "YmoKOTcgMCBvYmoKPDwgL1R5cGUgL1BhZ2UgL1BhcmVudCA0IDAgUiAvTWVkaWFCb3ggWzAgMCA2MTIg",
        "NzkyXSAvUmVzb3VyY2VzIDw8IC9Gb250IDw8IC9GMSAzIDAgUiA+PiA+PiAvQ29udGVudHMgOTggMCBS",
        "ID4+CmVuZG9iago5OCAwIG9iago8PCAvTGVuZ3RoIDY1ID4+CnN0cmVhbQpCVCAvRjEgMTYgVGYgMzYg",
        "NzUwIFRkIChSRVBPUlQgUEFHRSAwNDcgRE9DVU1FTlQgQkVOQ0hNQVJLKSBUaiBFVAplbmRzdHJlYW0K",
        "ZW5kb2JqCjk5IDAgb2JqCjw8IC9UeXBlIC9QYWdlIC9QYXJlbnQgNCAwIFIgL01lZGlhQm94IFswIDAg",
        "NjEyIDc5Ml0gL1Jlc291cmNlcyA8PCAvRm9udCA8PCAvRjEgMyAwIFIgPj4gPj4gL0NvbnRlbnRzIDEw",
        "MCAwIFIgPj4KZW5kb2JqCjEwMCAwIG9iago8PCAvTGVuZ3RoIDY1ID4+CnN0cmVhbQpCVCAvRjEgMTYg",
        "VGYgMzYgNzUwIFRkIChSRVBPUlQgUEFHRSAwNDggRE9DVU1FTlQgQkVOQ0hNQVJLKSBUaiBFVAplbmRz",
        "dHJlYW0KZW5kb2JqCjEwMSAwIG9iago8PCAvVHlwZSAvUGFnZSAvUGFyZW50IDQgMCBSIC9NZWRpYUJv",
        "eCBbMCAwIDYxMiA3OTJdIC9SZXNvdXJjZXMgPDwgL0ZvbnQgPDwgL0YxIDMgMCBSID4+ID4+IC9Db250",
        "ZW50cyAxMDIgMCBSID4+CmVuZG9iagoxMDIgMCBvYmoKPDwgL0xlbmd0aCA2NSA+PgpzdHJlYW0KQlQg",
        "L0YxIDE2IFRmIDM2IDc1MCBUZCAoUkVQT1JUIFBBR0UgMDQ5IERPQ1VNRU5UIEJFTkNITUFSSykgVGog",
        "RVQKZW5kc3RyZWFtCmVuZG9iagoxMDMgMCBvYmoKPDwgL1R5cGUgL1BhZ2UgL1BhcmVudCA0IDAgUiAv",
        "TWVkaWFCb3ggWzAgMCA2MTIgNzkyXSAvUmVzb3VyY2VzIDw8IC9Gb250IDw8IC9GMSAzIDAgUiA+PiA+",
        "PiAvQ29udGVudHMgMTA0IDAgUiA+PgplbmRvYmoKMTA0IDAgb2JqCjw8IC9MZW5ndGggNzIgPj4Kc3Ry",
        "ZWFtCkJUIC9GMSAxNiBUZiAzNiA3NTAgVGQgKFJFUE9SVCBQQUdFIDA1MCBET0NVTUVOVCBCRU5DSE1B",
        "UksgTkVFRExFKSBUaiBFVAplbmRzdHJlYW0KZW5kb2JqCjEwNSAwIG9iago8PCAvVHlwZSAvUGFnZSAv",
        "UGFyZW50IDQgMCBSIC9NZWRpYUJveCBbMCAwIDYxMiA3OTJdIC9SZXNvdXJjZXMgPDwgL0ZvbnQgPDwg",
        "L0YxIDMgMCBSID4+ID4+IC9Db250ZW50cyAxMDYgMCBSID4+CmVuZG9iagoxMDYgMCBvYmoKPDwgL0xl",
        "bmd0aCA2NSA+PgpzdHJlYW0KQlQgL0YxIDE2IFRmIDM2IDc1MCBUZCAoUkVQT1JUIFBBR0UgMDUxIERP",
        "Q1VNRU5UIEJFTkNITUFSSykgVGogRVQKZW5kc3RyZWFtCmVuZG9iagoxMDcgMCBvYmoKPDwgL1R5cGUg",
        "L1BhZ2UgL1BhcmVudCA0IDAgUiAvTWVkaWFCb3ggWzAgMCA2MTIgNzkyXSAvUmVzb3VyY2VzIDw8IC9G",
        "b250IDw8IC9GMSAzIDAgUiA+PiA+PiAvQ29udGVudHMgMTA4IDAgUiA+PgplbmRvYmoKMTA4IDAgb2Jq",
        "Cjw8IC9MZW5ndGggNjUgPj4Kc3RyZWFtCkJUIC9GMSAxNiBUZiAzNiA3NTAgVGQgKFJFUE9SVCBQQUdF",
        "IDA1MiBET0NVTUVOVCBCRU5DSE1BUkspIFRqIEVUCmVuZHN0cmVhbQplbmRvYmoKMTA5IDAgb2JqCjw8",
        "IC9UeXBlIC9QYWdlIC9QYXJlbnQgNCAwIFIgL01lZGlhQm94IFswIDAgNjEyIDc5Ml0gL1Jlc291cmNl",
        "cyA8PCAvRm9udCA8PCAvRjEgMyAwIFIgPj4gPj4gL0NvbnRlbnRzIDExMCAwIFIgPj4KZW5kb2JqCjEx",
        "MCAwIG9iago8PCAvTGVuZ3RoIDY1ID4+CnN0cmVhbQpCVCAvRjEgMTYgVGYgMzYgNzUwIFRkIChSRVBP",
        "UlQgUEFHRSAwNTMgRE9DVU1FTlQgQkVOQ0hNQVJLKSBUaiBFVAplbmRzdHJlYW0KZW5kb2JqCjExMSAw",
        "IG9iago8PCAvVHlwZSAvUGFnZSAvUGFyZW50IDQgMCBSIC9NZWRpYUJveCBbMCAwIDYxMiA3OTJdIC9S",
        "ZXNvdXJjZXMgPDwgL0ZvbnQgPDwgL0YxIDMgMCBSID4+ID4+IC9Db250ZW50cyAxMTIgMCBSID4+CmVu",
        "ZG9iagoxMTIgMCBvYmoKPDwgL0xlbmd0aCA2NSA+PgpzdHJlYW0KQlQgL0YxIDE2IFRmIDM2IDc1MCBU",
        "ZCAoUkVQT1JUIFBBR0UgMDU0IERPQ1VNRU5UIEJFTkNITUFSSykgVGogRVQKZW5kc3RyZWFtCmVuZG9i",
        "agoxMTMgMCBvYmoKPDwgL1R5cGUgL1BhZ2UgL1BhcmVudCA0IDAgUiAvTWVkaWFCb3ggWzAgMCA2MTIg",
        "NzkyXSAvUmVzb3VyY2VzIDw8IC9Gb250IDw8IC9GMSAzIDAgUiA+PiA+PiAvQ29udGVudHMgMTE0IDAg",
        "UiA+PgplbmRvYmoKMTE0IDAgb2JqCjw8IC9MZW5ndGggNjUgPj4Kc3RyZWFtCkJUIC9GMSAxNiBUZiAz",
        "NiA3NTAgVGQgKFJFUE9SVCBQQUdFIDA1NSBET0NVTUVOVCBCRU5DSE1BUkspIFRqIEVUCmVuZHN0cmVh",
        "bQplbmRvYmoKMTE1IDAgb2JqCjw8IC9UeXBlIC9QYWdlIC9QYXJlbnQgNCAwIFIgL01lZGlhQm94IFsw",
        "IDAgNjEyIDc5Ml0gL1Jlc291cmNlcyA8PCAvRm9udCA8PCAvRjEgMyAwIFIgPj4gPj4gL0NvbnRlbnRz",
        "IDExNiAwIFIgPj4KZW5kb2JqCjExNiAwIG9iago8PCAvTGVuZ3RoIDY1ID4+CnN0cmVhbQpCVCAvRjEg",
        "MTYgVGYgMzYgNzUwIFRkIChSRVBPUlQgUEFHRSAwNTYgRE9DVU1FTlQgQkVOQ0hNQVJLKSBUaiBFVApl",
        "bmRzdHJlYW0KZW5kb2JqCjExNyAwIG9iago8PCAvVHlwZSAvUGFnZSAvUGFyZW50IDQgMCBSIC9NZWRp",
        "YUJveCBbMCAwIDYxMiA3OTJdIC9SZXNvdXJjZXMgPDwgL0ZvbnQgPDwgL0YxIDMgMCBSID4+ID4+IC9D",
        "b250ZW50cyAxMTggMCBSID4+CmVuZG9iagoxMTggMCBvYmoKPDwgL0xlbmd0aCA2NSA+PgpzdHJlYW0K",
        "QlQgL0YxIDE2IFRmIDM2IDc1MCBUZCAoUkVQT1JUIFBBR0UgMDU3IERPQ1VNRU5UIEJFTkNITUFSSykg",
        "VGogRVQKZW5kc3RyZWFtCmVuZG9iagoxMTkgMCBvYmoKPDwgL1R5cGUgL1BhZ2UgL1BhcmVudCA0IDAg",
        "UiAvTWVkaWFCb3ggWzAgMCA2MTIgNzkyXSAvUmVzb3VyY2VzIDw8IC9Gb250IDw8IC9GMSAzIDAgUiA+",
        "PiA+PiAvQ29udGVudHMgMTIwIDAgUiA+PgplbmRvYmoKMTIwIDAgb2JqCjw8IC9MZW5ndGggNjUgPj4K",
        "c3RyZWFtCkJUIC9GMSAxNiBUZiAzNiA3NTAgVGQgKFJFUE9SVCBQQUdFIDA1OCBET0NVTUVOVCBCRU5D",
        "SE1BUkspIFRqIEVUCmVuZHN0cmVhbQplbmRvYmoKMTIxIDAgb2JqCjw8IC9UeXBlIC9QYWdlIC9QYXJl",
        "bnQgNCAwIFIgL01lZGlhQm94IFswIDAgNjEyIDc5Ml0gL1Jlc291cmNlcyA8PCAvRm9udCA8PCAvRjEg",
        "MyAwIFIgPj4gPj4gL0NvbnRlbnRzIDEyMiAwIFIgPj4KZW5kb2JqCjEyMiAwIG9iago8PCAvTGVuZ3Ro",
        "IDY1ID4+CnN0cmVhbQpCVCAvRjEgMTYgVGYgMzYgNzUwIFRkIChSRVBPUlQgUEFHRSAwNTkgRE9DVU1F",
        "TlQgQkVOQ0hNQVJLKSBUaiBFVAplbmRzdHJlYW0KZW5kb2JqCjEyMyAwIG9iago8PCAvVHlwZSAvUGFn",
        "ZSAvUGFyZW50IDQgMCBSIC9NZWRpYUJveCBbMCAwIDYxMiA3OTJdIC9SZXNvdXJjZXMgPDwgL0ZvbnQg",
        "PDwgL0YxIDMgMCBSID4+ID4+IC9Db250ZW50cyAxMjQgMCBSID4+CmVuZG9iagoxMjQgMCBvYmoKPDwg",
        "L0xlbmd0aCA3MiA+PgpzdHJlYW0KQlQgL0YxIDE2IFRmIDM2IDc1MCBUZCAoUkVQT1JUIFBBR0UgMDYw",
        "IERPQ1VNRU5UIEJFTkNITUFSSyBORUVETEUpIFRqIEVUCmVuZHN0cmVhbQplbmRvYmoKMTI1IDAgb2Jq",
        "Cjw8IC9UeXBlIC9QYWdlIC9QYXJlbnQgNCAwIFIgL01lZGlhQm94IFswIDAgNjEyIDc5Ml0gL1Jlc291",
        "cmNlcyA8PCAvRm9udCA8PCAvRjEgMyAwIFIgPj4gPj4gL0NvbnRlbnRzIDEyNiAwIFIgPj4KZW5kb2Jq",
        "CjEyNiAwIG9iago8PCAvTGVuZ3RoIDY1ID4+CnN0cmVhbQpCVCAvRjEgMTYgVGYgMzYgNzUwIFRkIChS",
        "RVBPUlQgUEFHRSAwNjEgRE9DVU1FTlQgQkVOQ0hNQVJLKSBUaiBFVAplbmRzdHJlYW0KZW5kb2JqCjEy",
        "NyAwIG9iago8PCAvVHlwZSAvUGFnZSAvUGFyZW50IDQgMCBSIC9NZWRpYUJveCBbMCAwIDYxMiA3OTJd",
        "IC9SZXNvdXJjZXMgPDwgL0ZvbnQgPDwgL0YxIDMgMCBSID4+ID4+IC9Db250ZW50cyAxMjggMCBSID4+",
        "CmVuZG9iagoxMjggMCBvYmoKPDwgL0xlbmd0aCA2NSA+PgpzdHJlYW0KQlQgL0YxIDE2IFRmIDM2IDc1",
        "MCBUZCAoUkVQT1JUIFBBR0UgMDYyIERPQ1VNRU5UIEJFTkNITUFSSykgVGogRVQKZW5kc3RyZWFtCmVu",
        "ZG9iagoxMjkgMCBvYmoKPDwgL1R5cGUgL1BhZ2UgL1BhcmVudCA0IDAgUiAvTWVkaWFCb3ggWzAgMCA2",
        "MTIgNzkyXSAvUmVzb3VyY2VzIDw8IC9Gb250IDw8IC9GMSAzIDAgUiA+PiA+PiAvQ29udGVudHMgMTMw",
        "IDAgUiA+PgplbmRvYmoKMTMwIDAgb2JqCjw8IC9MZW5ndGggNjUgPj4Kc3RyZWFtCkJUIC9GMSAxNiBU",
        "ZiAzNiA3NTAgVGQgKFJFUE9SVCBQQUdFIDA2MyBET0NVTUVOVCBCRU5DSE1BUkspIFRqIEVUCmVuZHN0",
        "cmVhbQplbmRvYmoKMTMxIDAgb2JqCjw8IC9UeXBlIC9QYWdlIC9QYXJlbnQgNCAwIFIgL01lZGlhQm94",
        "IFswIDAgNjEyIDc5Ml0gL1Jlc291cmNlcyA8PCAvRm9udCA8PCAvRjEgMyAwIFIgPj4gPj4gL0NvbnRl",
        "bnRzIDEzMiAwIFIgPj4KZW5kb2JqCjEzMiAwIG9iago8PCAvTGVuZ3RoIDY1ID4+CnN0cmVhbQpCVCAv",
        "RjEgMTYgVGYgMzYgNzUwIFRkIChSRVBPUlQgUEFHRSAwNjQgRE9DVU1FTlQgQkVOQ0hNQVJLKSBUaiBF",
        "VAplbmRzdHJlYW0KZW5kb2JqCjEzMyAwIG9iago8PCAvVHlwZSAvUGFnZSAvUGFyZW50IDQgMCBSIC9N",
        "ZWRpYUJveCBbMCAwIDYxMiA3OTJdIC9SZXNvdXJjZXMgPDwgL0ZvbnQgPDwgL0YxIDMgMCBSID4+ID4+",
        "IC9Db250ZW50cyAxMzQgMCBSID4+CmVuZG9iagoxMzQgMCBvYmoKPDwgL0xlbmd0aCA2NSA+PgpzdHJl",
        "YW0KQlQgL0YxIDE2IFRmIDM2IDc1MCBUZCAoUkVQT1JUIFBBR0UgMDY1IERPQ1VNRU5UIEJFTkNITUFS",
        "SykgVGogRVQKZW5kc3RyZWFtCmVuZG9iagoxMzUgMCBvYmoKPDwgL1R5cGUgL1BhZ2UgL1BhcmVudCA0",
        "IDAgUiAvTWVkaWFCb3ggWzAgMCA2MTIgNzkyXSAvUmVzb3VyY2VzIDw8IC9Gb250IDw8IC9GMSAzIDAg",
        "UiA+PiA+PiAvQ29udGVudHMgMTM2IDAgUiA+PgplbmRvYmoKMTM2IDAgb2JqCjw8IC9MZW5ndGggNjUg",
        "Pj4Kc3RyZWFtCkJUIC9GMSAxNiBUZiAzNiA3NTAgVGQgKFJFUE9SVCBQQUdFIDA2NiBET0NVTUVOVCBC",
        "RU5DSE1BUkspIFRqIEVUCmVuZHN0cmVhbQplbmRvYmoKMTM3IDAgb2JqCjw8IC9UeXBlIC9QYWdlIC9Q",
        "YXJlbnQgNCAwIFIgL01lZGlhQm94IFswIDAgNjEyIDc5Ml0gL1Jlc291cmNlcyA8PCAvRm9udCA8PCAv",
        "RjEgMyAwIFIgPj4gPj4gL0NvbnRlbnRzIDEzOCAwIFIgPj4KZW5kb2JqCjEzOCAwIG9iago8PCAvTGVu",
        "Z3RoIDY1ID4+CnN0cmVhbQpCVCAvRjEgMTYgVGYgMzYgNzUwIFRkIChSRVBPUlQgUEFHRSAwNjcgRE9D",
        "VU1FTlQgQkVOQ0hNQVJLKSBUaiBFVAplbmRzdHJlYW0KZW5kb2JqCjEzOSAwIG9iago8PCAvVHlwZSAv",
        "UGFnZSAvUGFyZW50IDQgMCBSIC9NZWRpYUJveCBbMCAwIDYxMiA3OTJdIC9SZXNvdXJjZXMgPDwgL0Zv",
        "bnQgPDwgL0YxIDMgMCBSID4+ID4+IC9Db250ZW50cyAxNDAgMCBSID4+CmVuZG9iagoxNDAgMCBvYmoK",
        "PDwgL0xlbmd0aCA2NSA+PgpzdHJlYW0KQlQgL0YxIDE2IFRmIDM2IDc1MCBUZCAoUkVQT1JUIFBBR0Ug",
        "MDY4IERPQ1VNRU5UIEJFTkNITUFSSykgVGogRVQKZW5kc3RyZWFtCmVuZG9iagoxNDEgMCBvYmoKPDwg",
        "L1R5cGUgL1BhZ2UgL1BhcmVudCA0IDAgUiAvTWVkaWFCb3ggWzAgMCA2MTIgNzkyXSAvUmVzb3VyY2Vz",
        "IDw8IC9Gb250IDw8IC9GMSAzIDAgUiA+PiA+PiAvQ29udGVudHMgMTQyIDAgUiA+PgplbmRvYmoKMTQy",
        "IDAgb2JqCjw8IC9MZW5ndGggNjUgPj4Kc3RyZWFtCkJUIC9GMSAxNiBUZiAzNiA3NTAgVGQgKFJFUE9S",
        "VCBQQUdFIDA2OSBET0NVTUVOVCBCRU5DSE1BUkspIFRqIEVUCmVuZHN0cmVhbQplbmRvYmoKMTQzIDAg",
        "b2JqCjw8IC9UeXBlIC9QYWdlIC9QYXJlbnQgNCAwIFIgL01lZGlhQm94IFswIDAgNjEyIDc5Ml0gL1Jl",
        "c291cmNlcyA8PCAvRm9udCA8PCAvRjEgMyAwIFIgPj4gPj4gL0NvbnRlbnRzIDE0NCAwIFIgPj4KZW5k",
        "b2JqCjE0NCAwIG9iago8PCAvTGVuZ3RoIDcyID4+CnN0cmVhbQpCVCAvRjEgMTYgVGYgMzYgNzUwIFRk",
        "IChSRVBPUlQgUEFHRSAwNzAgRE9DVU1FTlQgQkVOQ0hNQVJLIE5FRURMRSkgVGogRVQKZW5kc3RyZWFt",
        "CmVuZG9iagoxNDUgMCBvYmoKPDwgL1R5cGUgL1BhZ2UgL1BhcmVudCA0IDAgUiAvTWVkaWFCb3ggWzAg",
        "MCA2MTIgNzkyXSAvUmVzb3VyY2VzIDw8IC9Gb250IDw8IC9GMSAzIDAgUiA+PiA+PiAvQ29udGVudHMg",
        "MTQ2IDAgUiA+PgplbmRvYmoKMTQ2IDAgb2JqCjw8IC9MZW5ndGggNjUgPj4Kc3RyZWFtCkJUIC9GMSAx",
        "NiBUZiAzNiA3NTAgVGQgKFJFUE9SVCBQQUdFIDA3MSBET0NVTUVOVCBCRU5DSE1BUkspIFRqIEVUCmVu",
        "ZHN0cmVhbQplbmRvYmoKMTQ3IDAgb2JqCjw8IC9UeXBlIC9QYWdlIC9QYXJlbnQgNCAwIFIgL01lZGlh",
        "Qm94IFswIDAgNjEyIDc5Ml0gL1Jlc291cmNlcyA8PCAvRm9udCA8PCAvRjEgMyAwIFIgPj4gPj4gL0Nv",
        "bnRlbnRzIDE0OCAwIFIgPj4KZW5kb2JqCjE0OCAwIG9iago8PCAvTGVuZ3RoIDY1ID4+CnN0cmVhbQpC",
        "VCAvRjEgMTYgVGYgMzYgNzUwIFRkIChSRVBPUlQgUEFHRSAwNzIgRE9DVU1FTlQgQkVOQ0hNQVJLKSBU",
        "aiBFVAplbmRzdHJlYW0KZW5kb2JqCjE0OSAwIG9iago8PCAvVHlwZSAvUGFnZSAvUGFyZW50IDQgMCBS",
        "IC9NZWRpYUJveCBbMCAwIDYxMiA3OTJdIC9SZXNvdXJjZXMgPDwgL0ZvbnQgPDwgL0YxIDMgMCBSID4+",
        "ID4+IC9Db250ZW50cyAxNTAgMCBSID4+CmVuZG9iagoxNTAgMCBvYmoKPDwgL0xlbmd0aCA2NSA+Pgpz",
        "dHJlYW0KQlQgL0YxIDE2IFRmIDM2IDc1MCBUZCAoUkVQT1JUIFBBR0UgMDczIERPQ1VNRU5UIEJFTkNI",
        "TUFSSykgVGogRVQKZW5kc3RyZWFtCmVuZG9iagoxNTEgMCBvYmoKPDwgL1R5cGUgL1BhZ2UgL1BhcmVu",
        "dCA0IDAgUiAvTWVkaWFCb3ggWzAgMCA2MTIgNzkyXSAvUmVzb3VyY2VzIDw8IC9Gb250IDw8IC9GMSAz",
        "IDAgUiA+PiA+PiAvQ29udGVudHMgMTUyIDAgUiA+PgplbmRvYmoKMTUyIDAgb2JqCjw8IC9MZW5ndGgg",
        "NjUgPj4Kc3RyZWFtCkJUIC9GMSAxNiBUZiAzNiA3NTAgVGQgKFJFUE9SVCBQQUdFIDA3NCBET0NVTUVO",
        "VCBCRU5DSE1BUkspIFRqIEVUCmVuZHN0cmVhbQplbmRvYmoKMTUzIDAgb2JqCjw8IC9UeXBlIC9QYWdl",
        "IC9QYXJlbnQgNCAwIFIgL01lZGlhQm94IFswIDAgNjEyIDc5Ml0gL1Jlc291cmNlcyA8PCAvRm9udCA8",
        "PCAvRjEgMyAwIFIgPj4gPj4gL0NvbnRlbnRzIDE1NCAwIFIgPj4KZW5kb2JqCjE1NCAwIG9iago8PCAv",
        "TGVuZ3RoIDY1ID4+CnN0cmVhbQpCVCAvRjEgMTYgVGYgMzYgNzUwIFRkIChSRVBPUlQgUEFHRSAwNzUg",
        "RE9DVU1FTlQgQkVOQ0hNQVJLKSBUaiBFVAplbmRzdHJlYW0KZW5kb2JqCjE1NSAwIG9iago8PCAvVHlw",
        "ZSAvUGFnZSAvUGFyZW50IDQgMCBSIC9NZWRpYUJveCBbMCAwIDYxMiA3OTJdIC9SZXNvdXJjZXMgPDwg",
        "L0ZvbnQgPDwgL0YxIDMgMCBSID4+ID4+IC9Db250ZW50cyAxNTYgMCBSID4+CmVuZG9iagoxNTYgMCBv",
        "YmoKPDwgL0xlbmd0aCA2NSA+PgpzdHJlYW0KQlQgL0YxIDE2IFRmIDM2IDc1MCBUZCAoUkVQT1JUIFBB",
        "R0UgMDc2IERPQ1VNRU5UIEJFTkNITUFSSykgVGogRVQKZW5kc3RyZWFtCmVuZG9iagoxNTcgMCBvYmoK",
        "PDwgL1R5cGUgL1BhZ2UgL1BhcmVudCA0IDAgUiAvTWVkaWFCb3ggWzAgMCA2MTIgNzkyXSAvUmVzb3Vy",
        "Y2VzIDw8IC9Gb250IDw8IC9GMSAzIDAgUiA+PiA+PiAvQ29udGVudHMgMTU4IDAgUiA+PgplbmRvYmoK",
        "MTU4IDAgb2JqCjw8IC9MZW5ndGggNjUgPj4Kc3RyZWFtCkJUIC9GMSAxNiBUZiAzNiA3NTAgVGQgKFJF",
        "UE9SVCBQQUdFIDA3NyBET0NVTUVOVCBCRU5DSE1BUkspIFRqIEVUCmVuZHN0cmVhbQplbmRvYmoKMTU5",
        "IDAgb2JqCjw8IC9UeXBlIC9QYWdlIC9QYXJlbnQgNCAwIFIgL01lZGlhQm94IFswIDAgNjEyIDc5Ml0g",
        "L1Jlc291cmNlcyA8PCAvRm9udCA8PCAvRjEgMyAwIFIgPj4gPj4gL0NvbnRlbnRzIDE2MCAwIFIgPj4K",
        "ZW5kb2JqCjE2MCAwIG9iago8PCAvTGVuZ3RoIDY1ID4+CnN0cmVhbQpCVCAvRjEgMTYgVGYgMzYgNzUw",
        "IFRkIChSRVBPUlQgUEFHRSAwNzggRE9DVU1FTlQgQkVOQ0hNQVJLKSBUaiBFVAplbmRzdHJlYW0KZW5k",
        "b2JqCjE2MSAwIG9iago8PCAvVHlwZSAvUGFnZSAvUGFyZW50IDQgMCBSIC9NZWRpYUJveCBbMCAwIDYx",
        "MiA3OTJdIC9SZXNvdXJjZXMgPDwgL0ZvbnQgPDwgL0YxIDMgMCBSID4+ID4+IC9Db250ZW50cyAxNjIg",
        "MCBSID4+CmVuZG9iagoxNjIgMCBvYmoKPDwgL0xlbmd0aCA2NSA+PgpzdHJlYW0KQlQgL0YxIDE2IFRm",
        "IDM2IDc1MCBUZCAoUkVQT1JUIFBBR0UgMDc5IERPQ1VNRU5UIEJFTkNITUFSSykgVGogRVQKZW5kc3Ry",
        "ZWFtCmVuZG9iagoxNjMgMCBvYmoKPDwgL1R5cGUgL1BhZ2UgL1BhcmVudCA0IDAgUiAvTWVkaWFCb3gg",
        "WzAgMCA2MTIgNzkyXSAvUmVzb3VyY2VzIDw8IC9Gb250IDw8IC9GMSAzIDAgUiA+PiA+PiAvQ29udGVu",
        "dHMgMTY0IDAgUiA+PgplbmRvYmoKMTY0IDAgb2JqCjw8IC9MZW5ndGggNzIgPj4Kc3RyZWFtCkJUIC9G",
        "MSAxNiBUZiAzNiA3NTAgVGQgKFJFUE9SVCBQQUdFIDA4MCBET0NVTUVOVCBCRU5DSE1BUksgTkVFRExF",
        "KSBUaiBFVAplbmRzdHJlYW0KZW5kb2JqCjE2NSAwIG9iago8PCAvVHlwZSAvUGFnZSAvUGFyZW50IDQg",
        "MCBSIC9NZWRpYUJveCBbMCAwIDYxMiA3OTJdIC9SZXNvdXJjZXMgPDwgL0ZvbnQgPDwgL0YxIDMgMCBS",
        "ID4+ID4+IC9Db250ZW50cyAxNjYgMCBSID4+CmVuZG9iagoxNjYgMCBvYmoKPDwgL0xlbmd0aCA2NSA+",
        "PgpzdHJlYW0KQlQgL0YxIDE2IFRmIDM2IDc1MCBUZCAoUkVQT1JUIFBBR0UgMDgxIERPQ1VNRU5UIEJF",
        "TkNITUFSSykgVGogRVQKZW5kc3RyZWFtCmVuZG9iagoxNjcgMCBvYmoKPDwgL1R5cGUgL1BhZ2UgL1Bh",
        "cmVudCA0IDAgUiAvTWVkaWFCb3ggWzAgMCA2MTIgNzkyXSAvUmVzb3VyY2VzIDw8IC9Gb250IDw8IC9G",
        "MSAzIDAgUiA+PiA+PiAvQ29udGVudHMgMTY4IDAgUiA+PgplbmRvYmoKMTY4IDAgb2JqCjw8IC9MZW5n",
        "dGggNjUgPj4Kc3RyZWFtCkJUIC9GMSAxNiBUZiAzNiA3NTAgVGQgKFJFUE9SVCBQQUdFIDA4MiBET0NV",
        "TUVOVCBCRU5DSE1BUkspIFRqIEVUCmVuZHN0cmVhbQplbmRvYmoKMTY5IDAgb2JqCjw8IC9UeXBlIC9Q",
        "YWdlIC9QYXJlbnQgNCAwIFIgL01lZGlhQm94IFswIDAgNjEyIDc5Ml0gL1Jlc291cmNlcyA8PCAvRm9u",
        "dCA8PCAvRjEgMyAwIFIgPj4gPj4gL0NvbnRlbnRzIDE3MCAwIFIgPj4KZW5kb2JqCjE3MCAwIG9iago8",
        "PCAvTGVuZ3RoIDY1ID4+CnN0cmVhbQpCVCAvRjEgMTYgVGYgMzYgNzUwIFRkIChSRVBPUlQgUEFHRSAw",
        "ODMgRE9DVU1FTlQgQkVOQ0hNQVJLKSBUaiBFVAplbmRzdHJlYW0KZW5kb2JqCjE3MSAwIG9iago8PCAv",
        "VHlwZSAvUGFnZSAvUGFyZW50IDQgMCBSIC9NZWRpYUJveCBbMCAwIDYxMiA3OTJdIC9SZXNvdXJjZXMg",
        "PDwgL0ZvbnQgPDwgL0YxIDMgMCBSID4+ID4+IC9Db250ZW50cyAxNzIgMCBSID4+CmVuZG9iagoxNzIg",
        "MCBvYmoKPDwgL0xlbmd0aCA2NSA+PgpzdHJlYW0KQlQgL0YxIDE2IFRmIDM2IDc1MCBUZCAoUkVQT1JU",
        "IFBBR0UgMDg0IERPQ1VNRU5UIEJFTkNITUFSSykgVGogRVQKZW5kc3RyZWFtCmVuZG9iagoxNzMgMCBv",
        "YmoKPDwgL1R5cGUgL1BhZ2UgL1BhcmVudCA0IDAgUiAvTWVkaWFCb3ggWzAgMCA2MTIgNzkyXSAvUmVz",
        "b3VyY2VzIDw8IC9Gb250IDw8IC9GMSAzIDAgUiA+PiA+PiAvQ29udGVudHMgMTc0IDAgUiA+PgplbmRv",
        "YmoKMTc0IDAgb2JqCjw8IC9MZW5ndGggNjUgPj4Kc3RyZWFtCkJUIC9GMSAxNiBUZiAzNiA3NTAgVGQg",
        "KFJFUE9SVCBQQUdFIDA4NSBET0NVTUVOVCBCRU5DSE1BUkspIFRqIEVUCmVuZHN0cmVhbQplbmRvYmoK",
        "MTc1IDAgb2JqCjw8IC9UeXBlIC9QYWdlIC9QYXJlbnQgNCAwIFIgL01lZGlhQm94IFswIDAgNjEyIDc5",
        "Ml0gL1Jlc291cmNlcyA8PCAvRm9udCA8PCAvRjEgMyAwIFIgPj4gPj4gL0NvbnRlbnRzIDE3NiAwIFIg",
        "Pj4KZW5kb2JqCjE3NiAwIG9iago8PCAvTGVuZ3RoIDY1ID4+CnN0cmVhbQpCVCAvRjEgMTYgVGYgMzYg",
        "NzUwIFRkIChSRVBPUlQgUEFHRSAwODYgRE9DVU1FTlQgQkVOQ0hNQVJLKSBUaiBFVAplbmRzdHJlYW0K",
        "ZW5kb2JqCjE3NyAwIG9iago8PCAvVHlwZSAvUGFnZSAvUGFyZW50IDQgMCBSIC9NZWRpYUJveCBbMCAw",
        "IDYxMiA3OTJdIC9SZXNvdXJjZXMgPDwgL0ZvbnQgPDwgL0YxIDMgMCBSID4+ID4+IC9Db250ZW50cyAx",
        "NzggMCBSID4+CmVuZG9iagoxNzggMCBvYmoKPDwgL0xlbmd0aCA2NSA+PgpzdHJlYW0KQlQgL0YxIDE2",
        "IFRmIDM2IDc1MCBUZCAoUkVQT1JUIFBBR0UgMDg3IERPQ1VNRU5UIEJFTkNITUFSSykgVGogRVQKZW5k",
        "c3RyZWFtCmVuZG9iagoxNzkgMCBvYmoKPDwgL1R5cGUgL1BhZ2UgL1BhcmVudCA0IDAgUiAvTWVkaWFC",
        "b3ggWzAgMCA2MTIgNzkyXSAvUmVzb3VyY2VzIDw8IC9Gb250IDw8IC9GMSAzIDAgUiA+PiA+PiAvQ29u",
        "dGVudHMgMTgwIDAgUiA+PgplbmRvYmoKMTgwIDAgb2JqCjw8IC9MZW5ndGggNjUgPj4Kc3RyZWFtCkJU",
        "IC9GMSAxNiBUZiAzNiA3NTAgVGQgKFJFUE9SVCBQQUdFIDA4OCBET0NVTUVOVCBCRU5DSE1BUkspIFRq",
        "IEVUCmVuZHN0cmVhbQplbmRvYmoKMTgxIDAgb2JqCjw8IC9UeXBlIC9QYWdlIC9QYXJlbnQgNCAwIFIg",
        "L01lZGlhQm94IFswIDAgNjEyIDc5Ml0gL1Jlc291cmNlcyA8PCAvRm9udCA8PCAvRjEgMyAwIFIgPj4g",
        "Pj4gL0NvbnRlbnRzIDE4MiAwIFIgPj4KZW5kb2JqCjE4MiAwIG9iago8PCAvTGVuZ3RoIDY1ID4+CnN0",
        "cmVhbQpCVCAvRjEgMTYgVGYgMzYgNzUwIFRkIChSRVBPUlQgUEFHRSAwODkgRE9DVU1FTlQgQkVOQ0hN",
        "QVJLKSBUaiBFVAplbmRzdHJlYW0KZW5kb2JqCjE4MyAwIG9iago8PCAvVHlwZSAvUGFnZSAvUGFyZW50",
        "IDQgMCBSIC9NZWRpYUJveCBbMCAwIDYxMiA3OTJdIC9SZXNvdXJjZXMgPDwgL0ZvbnQgPDwgL0YxIDMg",
        "MCBSID4+ID4+IC9Db250ZW50cyAxODQgMCBSID4+CmVuZG9iagoxODQgMCBvYmoKPDwgL0xlbmd0aCA3",
        "MiA+PgpzdHJlYW0KQlQgL0YxIDE2IFRmIDM2IDc1MCBUZCAoUkVQT1JUIFBBR0UgMDkwIERPQ1VNRU5U",
        "IEJFTkNITUFSSyBORUVETEUpIFRqIEVUCmVuZHN0cmVhbQplbmRvYmoKMTg1IDAgb2JqCjw8IC9UeXBl",
        "IC9QYWdlIC9QYXJlbnQgNCAwIFIgL01lZGlhQm94IFswIDAgNjEyIDc5Ml0gL1Jlc291cmNlcyA8PCAv",
        "Rm9udCA8PCAvRjEgMyAwIFIgPj4gPj4gL0NvbnRlbnRzIDE4NiAwIFIgPj4KZW5kb2JqCjE4NiAwIG9i",
        "ago8PCAvTGVuZ3RoIDY1ID4+CnN0cmVhbQpCVCAvRjEgMTYgVGYgMzYgNzUwIFRkIChSRVBPUlQgUEFH",
        "RSAwOTEgRE9DVU1FTlQgQkVOQ0hNQVJLKSBUaiBFVAplbmRzdHJlYW0KZW5kb2JqCjE4NyAwIG9iago8",
        "PCAvVHlwZSAvUGFnZSAvUGFyZW50IDQgMCBSIC9NZWRpYUJveCBbMCAwIDYxMiA3OTJdIC9SZXNvdXJj",
        "ZXMgPDwgL0ZvbnQgPDwgL0YxIDMgMCBSID4+ID4+IC9Db250ZW50cyAxODggMCBSID4+CmVuZG9iagox",
        "ODggMCBvYmoKPDwgL0xlbmd0aCA2NSA+PgpzdHJlYW0KQlQgL0YxIDE2IFRmIDM2IDc1MCBUZCAoUkVQ",
        "T1JUIFBBR0UgMDkyIERPQ1VNRU5UIEJFTkNITUFSSykgVGogRVQKZW5kc3RyZWFtCmVuZG9iagoxODkg",
        "MCBvYmoKPDwgL1R5cGUgL1BhZ2UgL1BhcmVudCA0IDAgUiAvTWVkaWFCb3ggWzAgMCA2MTIgNzkyXSAv",
        "UmVzb3VyY2VzIDw8IC9Gb250IDw8IC9GMSAzIDAgUiA+PiA+PiAvQ29udGVudHMgMTkwIDAgUiA+Pgpl",
        "bmRvYmoKMTkwIDAgb2JqCjw8IC9MZW5ndGggNjUgPj4Kc3RyZWFtCkJUIC9GMSAxNiBUZiAzNiA3NTAg",
        "VGQgKFJFUE9SVCBQQUdFIDA5MyBET0NVTUVOVCBCRU5DSE1BUkspIFRqIEVUCmVuZHN0cmVhbQplbmRv",
        "YmoKMTkxIDAgb2JqCjw8IC9UeXBlIC9QYWdlIC9QYXJlbnQgNCAwIFIgL01lZGlhQm94IFswIDAgNjEy",
        "IDc5Ml0gL1Jlc291cmNlcyA8PCAvRm9udCA8PCAvRjEgMyAwIFIgPj4gPj4gL0NvbnRlbnRzIDE5MiAw",
        "IFIgPj4KZW5kb2JqCjE5MiAwIG9iago8PCAvTGVuZ3RoIDY1ID4+CnN0cmVhbQpCVCAvRjEgMTYgVGYg",
        "MzYgNzUwIFRkIChSRVBPUlQgUEFHRSAwOTQgRE9DVU1FTlQgQkVOQ0hNQVJLKSBUaiBFVAplbmRzdHJl",
        "YW0KZW5kb2JqCjE5MyAwIG9iago8PCAvVHlwZSAvUGFnZSAvUGFyZW50IDQgMCBSIC9NZWRpYUJveCBb",
        "MCAwIDYxMiA3OTJdIC9SZXNvdXJjZXMgPDwgL0ZvbnQgPDwgL0YxIDMgMCBSID4+ID4+IC9Db250ZW50",
        "cyAxOTQgMCBSID4+CmVuZG9iagoxOTQgMCBvYmoKPDwgL0xlbmd0aCA2NSA+PgpzdHJlYW0KQlQgL0Yx",
        "IDE2IFRmIDM2IDc1MCBUZCAoUkVQT1JUIFBBR0UgMDk1IERPQ1VNRU5UIEJFTkNITUFSSykgVGogRVQK",
        "ZW5kc3RyZWFtCmVuZG9iagoxOTUgMCBvYmoKPDwgL1R5cGUgL1BhZ2UgL1BhcmVudCA0IDAgUiAvTWVk",
        "aWFCb3ggWzAgMCA2MTIgNzkyXSAvUmVzb3VyY2VzIDw8IC9Gb250IDw8IC9GMSAzIDAgUiA+PiA+PiAv",
        "Q29udGVudHMgMTk2IDAgUiA+PgplbmRvYmoKMTk2IDAgb2JqCjw8IC9MZW5ndGggNjUgPj4Kc3RyZWFt",
        "CkJUIC9GMSAxNiBUZiAzNiA3NTAgVGQgKFJFUE9SVCBQQUdFIDA5NiBET0NVTUVOVCBCRU5DSE1BUksp",
        "IFRqIEVUCmVuZHN0cmVhbQplbmRvYmoKMTk3IDAgb2JqCjw8IC9UeXBlIC9QYWdlIC9QYXJlbnQgNCAw",
        "IFIgL01lZGlhQm94IFswIDAgNjEyIDc5Ml0gL1Jlc291cmNlcyA8PCAvRm9udCA8PCAvRjEgMyAwIFIg",
        "Pj4gPj4gL0NvbnRlbnRzIDE5OCAwIFIgPj4KZW5kb2JqCjE5OCAwIG9iago8PCAvTGVuZ3RoIDY1ID4+",
        "CnN0cmVhbQpCVCAvRjEgMTYgVGYgMzYgNzUwIFRkIChSRVBPUlQgUEFHRSAwOTcgRE9DVU1FTlQgQkVO",
        "Q0hNQVJLKSBUaiBFVAplbmRzdHJlYW0KZW5kb2JqCjE5OSAwIG9iago8PCAvVHlwZSAvUGFnZSAvUGFy",
        "ZW50IDQgMCBSIC9NZWRpYUJveCBbMCAwIDYxMiA3OTJdIC9SZXNvdXJjZXMgPDwgL0ZvbnQgPDwgL0Yx",
        "IDMgMCBSID4+ID4+IC9Db250ZW50cyAyMDAgMCBSID4+CmVuZG9iagoyMDAgMCBvYmoKPDwgL0xlbmd0",
        "aCA2NSA+PgpzdHJlYW0KQlQgL0YxIDE2IFRmIDM2IDc1MCBUZCAoUkVQT1JUIFBBR0UgMDk4IERPQ1VN",
        "RU5UIEJFTkNITUFSSykgVGogRVQKZW5kc3RyZWFtCmVuZG9iagoyMDEgMCBvYmoKPDwgL1R5cGUgL1Bh",
        "Z2UgL1BhcmVudCA0IDAgUiAvTWVkaWFCb3ggWzAgMCA2MTIgNzkyXSAvUmVzb3VyY2VzIDw8IC9Gb250",
        "IDw8IC9GMSAzIDAgUiA+PiA+PiAvQ29udGVudHMgMjAyIDAgUiA+PgplbmRvYmoKMjAyIDAgb2JqCjw8",
        "IC9MZW5ndGggNjUgPj4Kc3RyZWFtCkJUIC9GMSAxNiBUZiAzNiA3NTAgVGQgKFJFUE9SVCBQQUdFIDA5",
        "OSBET0NVTUVOVCBCRU5DSE1BUkspIFRqIEVUCmVuZHN0cmVhbQplbmRvYmoKMjAzIDAgb2JqCjw8IC9U",
        "eXBlIC9QYWdlIC9QYXJlbnQgNCAwIFIgL01lZGlhQm94IFswIDAgNjEyIDc5Ml0gL1Jlc291cmNlcyA8",
        "PCAvRm9udCA8PCAvRjEgMyAwIFIgPj4gPj4gL0NvbnRlbnRzIDIwNCAwIFIgPj4KZW5kb2JqCjIwNCAw",
        "IG9iago8PCAvTGVuZ3RoIDcyID4+CnN0cmVhbQpCVCAvRjEgMTYgVGYgMzYgNzUwIFRkIChSRVBPUlQg",
        "UEFHRSAxMDAgRE9DVU1FTlQgQkVOQ0hNQVJLIE5FRURMRSkgVGogRVQKZW5kc3RyZWFtCmVuZG9iagoy",
        "MDUgMCBvYmoKPDwgL0xlbmd0aCAxNSA+PgpzdHJlYW0KNiAwIDAgMCA2IDcgZDEKZW5kc3RyZWFtCmVu",
        "ZG9iagoyMDYgMCBvYmoKPDwgL0xlbmd0aCAxNSA+PgpzdHJlYW0KNiAwIDAgMCA2IDcgZDEKZW5kc3Ry",
        "ZWFtCmVuZG9iagoyMDcgMCBvYmoKPDwgL0xlbmd0aCAyNjIgPj4Kc3RyZWFtCjYgMCAwIDAgNiA3IGQx",
        "CjEgNiAxIDEgcmUgZgoyIDYgMSAxIHJlIGYKMyA2IDEgMSByZSBmCjAgNSAxIDEgcmUgZgo0IDUgMSAx",
        "IHJlIGYKMCA0IDEgMSByZSBmCjMgNCAxIDEgcmUgZgo0IDQgMSAxIHJlIGYKMCAzIDEgMSByZSBmCjIg",
        "MyAxIDEgcmUgZgo0IDMgMSAxIHJlIGYKMCAyIDEgMSByZSBmCjEgMiAxIDEgcmUgZgo0IDIgMSAxIHJl",
        "IGYKMCAxIDEgMSByZSBmCjQgMSAxIDEgcmUgZgoxIDAgMSAxIHJlIGYKMiAwIDEgMSByZSBmCjMgMCAx",
        "IDEgcmUgZgplbmRzdHJlYW0KZW5kb2JqCjIwOCAwIG9iago8PCAvTGVuZ3RoIDE0NSA+PgpzdHJlYW0K",
        "NiAwIDAgMCA2IDcgZDEKMiA2IDEgMSByZSBmCjEgNSAxIDEgcmUgZgoyIDUgMSAxIHJlIGYKMiA0IDEg",
        "MSByZSBmCjIgMyAxIDEgcmUgZgoyIDIgMSAxIHJlIGYKMiAxIDEgMSByZSBmCjEgMCAxIDEgcmUgZgoy",
        "IDAgMSAxIHJlIGYKMyAwIDEgMSByZSBmCmVuZHN0cmVhbQplbmRvYmoKMjA5IDAgb2JqCjw8IC9MZW5n",
        "dGggMTk3ID4+CnN0cmVhbQo2IDAgMCAwIDYgNyBkMQoxIDYgMSAxIHJlIGYKMiA2IDEgMSByZSBmCjMg",
        "NiAxIDEgcmUgZgowIDUgMSAxIHJlIGYKNCA1IDEgMSByZSBmCjQgNCAxIDEgcmUgZgozIDMgMSAxIHJl",
        "IGYKMiAyIDEgMSByZSBmCjEgMSAxIDEgcmUgZgowIDAgMSAxIHJlIGYKMSAwIDEgMSByZSBmCjIgMCAx",
        "IDEgcmUgZgozIDAgMSAxIHJlIGYKNCAwIDEgMSByZSBmCmVuZHN0cmVhbQplbmRvYmoKMjEwIDAgb2Jq",
        "Cjw8IC9MZW5ndGggMjEwID4+CnN0cmVhbQo2IDAgMCAwIDYgNyBkMQowIDYgMSAxIHJlIGYKMSA2IDEg",
        "MSByZSBmCjIgNiAxIDEgcmUgZgozIDYgMSAxIHJlIGYKNCA1IDEgMSByZSBmCjQgNCAxIDEgcmUgZgox",
        "IDMgMSAxIHJlIGYKMiAzIDEgMSByZSBmCjMgMyAxIDEgcmUgZgo0IDIgMSAxIHJlIGYKNCAxIDEgMSBy",
        "ZSBmCjAgMCAxIDEgcmUgZgoxIDAgMSAxIHJlIGYKMiAwIDEgMSByZSBmCjMgMCAxIDEgcmUgZgplbmRz",
        "dHJlYW0KZW5kb2JqCjIxMSAwIG9iago8PCAvTGVuZ3RoIDE5NyA+PgpzdHJlYW0KNiAwIDAgMCA2IDcg",
        "ZDEKMyA2IDEgMSByZSBmCjIgNSAxIDEgcmUgZgozIDUgMSAxIHJlIGYKMSA0IDEgMSByZSBmCjMgNCAx",
        "IDEgcmUgZgowIDMgMSAxIHJlIGYKMyAzIDEgMSByZSBmCjAgMiAxIDEgcmUgZgoxIDIgMSAxIHJlIGYK",
        "MiAyIDEgMSByZSBmCjMgMiAxIDEgcmUgZgo0IDIgMSAxIHJlIGYKMyAxIDEgMSByZSBmCjMgMCAxIDEg",
        "cmUgZgplbmRzdHJlYW0KZW5kb2JqCjIxMiAwIG9iago8PCAvTGVuZ3RoIDIzNiA+PgpzdHJlYW0KNiAw",
        "IDAgMCA2IDcgZDEKMCA2IDEgMSByZSBmCjEgNiAxIDEgcmUgZgoyIDYgMSAxIHJlIGYKMyA2IDEgMSBy",
        "ZSBmCjQgNiAxIDEgcmUgZgowIDUgMSAxIHJlIGYKMCA0IDEgMSByZSBmCjEgNCAxIDEgcmUgZgoyIDQg",
        "MSAxIHJlIGYKMyA0IDEgMSByZSBmCjQgMyAxIDEgcmUgZgo0IDIgMSAxIHJlIGYKMCAxIDEgMSByZSBm",
        "CjQgMSAxIDEgcmUgZgoxIDAgMSAxIHJlIGYKMiAwIDEgMSByZSBmCjMgMCAxIDEgcmUgZgplbmRzdHJl",
        "YW0KZW5kb2JqCjIxMyAwIG9iago8PCAvTGVuZ3RoIDIxMCA+PgpzdHJlYW0KNiAwIDAgMCA2IDcgZDEK",
        "MiA2IDEgMSByZSBmCjMgNiAxIDEgcmUgZgoxIDUgMSAxIHJlIGYKMCA0IDEgMSByZSBmCjAgMyAxIDEg",
        "cmUgZgoxIDMgMSAxIHJlIGYKMiAzIDEgMSByZSBmCjMgMyAxIDEgcmUgZgowIDIgMSAxIHJlIGYKNCAy",
        "IDEgMSByZSBmCjAgMSAxIDEgcmUgZgo0IDEgMSAxIHJlIGYKMSAwIDEgMSByZSBmCjIgMCAxIDEgcmUg",
        "ZgozIDAgMSAxIHJlIGYKZW5kc3RyZWFtCmVuZG9iagoyMTQgMCBvYmoKPDwgL0xlbmd0aCAxNTggPj4K",
        "c3RyZWFtCjYgMCAwIDAgNiA3IGQxCjAgNiAxIDEgcmUgZgoxIDYgMSAxIHJlIGYKMiA2IDEgMSByZSBm",
        "CjMgNiAxIDEgcmUgZgo0IDYgMSAxIHJlIGYKNCA1IDEgMSByZSBmCjMgNCAxIDEgcmUgZgoyIDMgMSAx",
        "IHJlIGYKMSAyIDEgMSByZSBmCjEgMSAxIDEgcmUgZgoxIDAgMSAxIHJlIGYKZW5kc3RyZWFtCmVuZG9i",
        "agoyMTUgMCBvYmoKPDwgL0xlbmd0aCAyMzYgPj4Kc3RyZWFtCjYgMCAwIDAgNiA3IGQxCjEgNiAxIDEg",
        "cmUgZgoyIDYgMSAxIHJlIGYKMyA2IDEgMSByZSBmCjAgNSAxIDEgcmUgZgo0IDUgMSAxIHJlIGYKMCA0",
        "IDEgMSByZSBmCjQgNCAxIDEgcmUgZgoxIDMgMSAxIHJlIGYKMiAzIDEgMSByZSBmCjMgMyAxIDEgcmUg",
        "ZgowIDIgMSAxIHJlIGYKNCAyIDEgMSByZSBmCjAgMSAxIDEgcmUgZgo0IDEgMSAxIHJlIGYKMSAwIDEg",
        "MSByZSBmCjIgMCAxIDEgcmUgZgozIDAgMSAxIHJlIGYKZW5kc3RyZWFtCmVuZG9iagoyMTYgMCBvYmoK",
        "PDwgL0xlbmd0aCAyMjMgPj4Kc3RyZWFtCjYgMCAwIDAgNiA3IGQxCjEgNiAxIDEgcmUgZgoyIDYgMSAx",
        "IHJlIGYKMyA2IDEgMSByZSBmCjAgNSAxIDEgcmUgZgo0IDUgMSAxIHJlIGYKMCA0IDEgMSByZSBmCjQg",
        "NCAxIDEgcmUgZgoxIDMgMSAxIHJlIGYKMiAzIDEgMSByZSBmCjMgMyAxIDEgcmUgZgo0IDMgMSAxIHJl",
        "IGYKNCAyIDEgMSByZSBmCjMgMSAxIDEgcmUgZgowIDAgMSAxIHJlIGYKMSAwIDEgMSByZSBmCjIgMCAx",
        "IDEgcmUgZgplbmRzdHJlYW0KZW5kb2JqCjIxNyAwIG9iago8PCAvTGVuZ3RoIDI0OSA+PgpzdHJlYW0K",
        "NiAwIDAgMCA2IDcgZDEKMSA2IDEgMSByZSBmCjIgNiAxIDEgcmUgZgozIDYgMSAxIHJlIGYKMCA1IDEg",
        "MSByZSBmCjQgNSAxIDEgcmUgZgowIDQgMSAxIHJlIGYKNCA0IDEgMSByZSBmCjAgMyAxIDEgcmUgZgox",
        "IDMgMSAxIHJlIGYKMiAzIDEgMSByZSBmCjMgMyAxIDEgcmUgZgo0IDMgMSAxIHJlIGYKMCAyIDEgMSBy",
        "ZSBmCjQgMiAxIDEgcmUgZgowIDEgMSAxIHJlIGYKNCAxIDEgMSByZSBmCjAgMCAxIDEgcmUgZgo0IDAg",
        "MSAxIHJlIGYKZW5kc3RyZWFtCmVuZG9iagoyMTggMCBvYmoKPDwgL0xlbmd0aCAyNzUgPj4Kc3RyZWFt",
        "CjYgMCAwIDAgNiA3IGQxCjAgNiAxIDEgcmUgZgoxIDYgMSAxIHJlIGYKMiA2IDEgMSByZSBmCjMgNiAx",
        "IDEgcmUgZgowIDUgMSAxIHJlIGYKNCA1IDEgMSByZSBmCjAgNCAxIDEgcmUgZgo0IDQgMSAxIHJlIGYK",
        "MCAzIDEgMSByZSBmCjEgMyAxIDEgcmUgZgoyIDMgMSAxIHJlIGYKMyAzIDEgMSByZSBmCjAgMiAxIDEg",
        "cmUgZgo0IDIgMSAxIHJlIGYKMCAxIDEgMSByZSBmCjQgMSAxIDEgcmUgZgowIDAgMSAxIHJlIGYKMSAw",
        "IDEgMSByZSBmCjIgMCAxIDEgcmUgZgozIDAgMSAxIHJlIGYKZW5kc3RyZWFtCmVuZG9iagoyMTkgMCBv",
        "YmoKPDwgL0xlbmd0aCAxODQgPj4Kc3RyZWFtCjYgMCAwIDAgNiA3IGQxCjEgNiAxIDEgcmUgZgoyIDYg",
        "MSAxIHJlIGYKMyA2IDEgMSByZSBmCjQgNiAxIDEgcmUgZgowIDUgMSAxIHJlIGYKMCA0IDEgMSByZSBm",
        "CjAgMyAxIDEgcmUgZgowIDIgMSAxIHJlIGYKMCAxIDEgMSByZSBmCjEgMCAxIDEgcmUgZgoyIDAgMSAx",
        "IHJlIGYKMyAwIDEgMSByZSBmCjQgMCAxIDEgcmUgZgplbmRzdHJlYW0KZW5kb2JqCjIyMCAwIG9iago8",
        "PCAvTGVuZ3RoIDI0OSA+PgpzdHJlYW0KNiAwIDAgMCA2IDcgZDEKMCA2IDEgMSByZSBmCjEgNiAxIDEg",
        "cmUgZgoyIDYgMSAxIHJlIGYKMyA2IDEgMSByZSBmCjAgNSAxIDEgcmUgZgo0IDUgMSAxIHJlIGYKMCA0",
        "IDEgMSByZSBmCjQgNCAxIDEgcmUgZgowIDMgMSAxIHJlIGYKNCAzIDEgMSByZSBmCjAgMiAxIDEgcmUg",
        "Zgo0IDIgMSAxIHJlIGYKMCAxIDEgMSByZSBmCjQgMSAxIDEgcmUgZgowIDAgMSAxIHJlIGYKMSAwIDEg",
        "MSByZSBmCjIgMCAxIDEgcmUgZgozIDAgMSAxIHJlIGYKZW5kc3RyZWFtCmVuZG9iagoyMjEgMCBvYmoK",
        "PDwgL0xlbmd0aCAyNDkgPj4Kc3RyZWFtCjYgMCAwIDAgNiA3IGQxCjAgNiAxIDEgcmUgZgoxIDYgMSAx",
        "IHJlIGYKMiA2IDEgMSByZSBmCjMgNiAxIDEgcmUgZgo0IDYgMSAxIHJlIGYKMCA1IDEgMSByZSBmCjAg",
        "NCAxIDEgcmUgZgowIDMgMSAxIHJlIGYKMSAzIDEgMSByZSBmCjIgMyAxIDEgcmUgZgozIDMgMSAxIHJl",
        "IGYKMCAyIDEgMSByZSBmCjAgMSAxIDEgcmUgZgowIDAgMSAxIHJlIGYKMSAwIDEgMSByZSBmCjIgMCAx",
        "IDEgcmUgZgozIDAgMSAxIHJlIGYKNCAwIDEgMSByZSBmCmVuZHN0cmVhbQplbmRvYmoKMjIyIDAgb2Jq",
        "Cjw8IC9MZW5ndGggMjM2ID4+CnN0cmVhbQo2IDAgMCAwIDYgNyBkMQoxIDYgMSAxIHJlIGYKMiA2IDEg",
        "MSByZSBmCjMgNiAxIDEgcmUgZgo0IDYgMSAxIHJlIGYKMCA1IDEgMSByZSBmCjAgNCAxIDEgcmUgZgow",
        "IDMgMSAxIHJlIGYKMiAzIDEgMSByZSBmCjMgMyAxIDEgcmUgZgo0IDMgMSAxIHJlIGYKMCAyIDEgMSBy",
        "ZSBmCjQgMiAxIDEgcmUgZgowIDEgMSAxIHJlIGYKNCAxIDEgMSByZSBmCjEgMCAxIDEgcmUgZgoyIDAg",
        "MSAxIHJlIGYKMyAwIDEgMSByZSBmCmVuZHN0cmVhbQplbmRvYmoKMjIzIDAgb2JqCjw8IC9MZW5ndGgg",
        "MjM2ID4+CnN0cmVhbQo2IDAgMCAwIDYgNyBkMQowIDYgMSAxIHJlIGYKNCA2IDEgMSByZSBmCjAgNSAx",
        "IDEgcmUgZgo0IDUgMSAxIHJlIGYKMCA0IDEgMSByZSBmCjQgNCAxIDEgcmUgZgowIDMgMSAxIHJlIGYK",
        "MSAzIDEgMSByZSBmCjIgMyAxIDEgcmUgZgozIDMgMSAxIHJlIGYKNCAzIDEgMSByZSBmCjAgMiAxIDEg",
        "cmUgZgo0IDIgMSAxIHJlIGYKMCAxIDEgMSByZSBmCjQgMSAxIDEgcmUgZgowIDAgMSAxIHJlIGYKNCAw",
        "IDEgMSByZSBmCmVuZHN0cmVhbQplbmRvYmoKMjI0IDAgb2JqCjw8IC9MZW5ndGggMTk3ID4+CnN0cmVh",
        "bQo2IDAgMCAwIDYgNyBkMQowIDYgMSAxIHJlIGYKNCA2IDEgMSByZSBmCjAgNSAxIDEgcmUgZgozIDUg",
        "MSAxIHJlIGYKMCA0IDEgMSByZSBmCjIgNCAxIDEgcmUgZgowIDMgMSAxIHJlIGYKMSAzIDEgMSByZSBm",
        "CjAgMiAxIDEgcmUgZgoyIDIgMSAxIHJlIGYKMCAxIDEgMSByZSBmCjMgMSAxIDEgcmUgZgowIDAgMSAx",
        "IHJlIGYKNCAwIDEgMSByZSBmCmVuZHN0cmVhbQplbmRvYmoKMjI1IDAgb2JqCjw8IC9MZW5ndGggMTU4",
        "ID4+CnN0cmVhbQo2IDAgMCAwIDYgNyBkMQowIDYgMSAxIHJlIGYKMCA1IDEgMSByZSBmCjAgNCAxIDEg",
        "cmUgZgowIDMgMSAxIHJlIGYKMCAyIDEgMSByZSBmCjAgMSAxIDEgcmUgZgowIDAgMSAxIHJlIGYKMSAw",
        "IDEgMSByZSBmCjIgMCAxIDEgcmUgZgozIDAgMSAxIHJlIGYKNCAwIDEgMSByZSBmCmVuZHN0cmVhbQpl",
        "bmRvYmoKMjI2IDAgb2JqCjw8IC9MZW5ndGggMjQ5ID4+CnN0cmVhbQo2IDAgMCAwIDYgNyBkMQowIDYg",
        "MSAxIHJlIGYKNCA2IDEgMSByZSBmCjAgNSAxIDEgcmUgZgoxIDUgMSAxIHJlIGYKMyA1IDEgMSByZSBm",
        "CjQgNSAxIDEgcmUgZgowIDQgMSAxIHJlIGYKMiA0IDEgMSByZSBmCjQgNCAxIDEgcmUgZgowIDMgMSAx",
        "IHJlIGYKMiAzIDEgMSByZSBmCjQgMyAxIDEgcmUgZgowIDIgMSAxIHJlIGYKNCAyIDEgMSByZSBmCjAg",
        "MSAxIDEgcmUgZgo0IDEgMSAxIHJlIGYKMCAwIDEgMSByZSBmCjQgMCAxIDEgcmUgZgplbmRzdHJlYW0K",
        "ZW5kb2JqCjIyNyAwIG9iago8PCAvTGVuZ3RoIDIzNiA+PgpzdHJlYW0KNiAwIDAgMCA2IDcgZDEKMCA2",
        "IDEgMSByZSBmCjQgNiAxIDEgcmUgZgowIDUgMSAxIHJlIGYKMSA1IDEgMSByZSBmCjQgNSAxIDEgcmUg",
        "ZgowIDQgMSAxIHJlIGYKMiA0IDEgMSByZSBmCjQgNCAxIDEgcmUgZgowIDMgMSAxIHJlIGYKMyAzIDEg",
        "MSByZSBmCjQgMyAxIDEgcmUgZgowIDIgMSAxIHJlIGYKNCAyIDEgMSByZSBmCjAgMSAxIDEgcmUgZgo0",
        "IDEgMSAxIHJlIGYKMCAwIDEgMSByZSBmCjQgMCAxIDEgcmUgZgplbmRzdHJlYW0KZW5kb2JqCjIyOCAw",
        "IG9iago8PCAvTGVuZ3RoIDIyMyA+PgpzdHJlYW0KNiAwIDAgMCA2IDcgZDEKMSA2IDEgMSByZSBmCjIg",
        "NiAxIDEgcmUgZgozIDYgMSAxIHJlIGYKMCA1IDEgMSByZSBmCjQgNSAxIDEgcmUgZgowIDQgMSAxIHJl",
        "IGYKNCA0IDEgMSByZSBmCjAgMyAxIDEgcmUgZgo0IDMgMSAxIHJlIGYKMCAyIDEgMSByZSBmCjQgMiAx",
        "IDEgcmUgZgowIDEgMSAxIHJlIGYKNCAxIDEgMSByZSBmCjEgMCAxIDEgcmUgZgoyIDAgMSAxIHJlIGYK",
        "MyAwIDEgMSByZSBmCmVuZHN0cmVhbQplbmRvYmoKMjI5IDAgb2JqCjw8IC9MZW5ndGggMjEwID4+CnN0",
        "cmVhbQo2IDAgMCAwIDYgNyBkMQowIDYgMSAxIHJlIGYKMSA2IDEgMSByZSBmCjIgNiAxIDEgcmUgZgoz",
        "IDYgMSAxIHJlIGYKMCA1IDEgMSByZSBmCjQgNSAxIDEgcmUgZgowIDQgMSAxIHJlIGYKNCA0IDEgMSBy",
        "ZSBmCjAgMyAxIDEgcmUgZgoxIDMgMSAxIHJlIGYKMiAzIDEgMSByZSBmCjMgMyAxIDEgcmUgZgowIDIg",
        "MSAxIHJlIGYKMCAxIDEgMSByZSBmCjAgMCAxIDEgcmUgZgplbmRzdHJlYW0KZW5kb2JqCjIzMCAwIG9i",
        "ago8PCAvTGVuZ3RoIDI0OSA+PgpzdHJlYW0KNiAwIDAgMCA2IDcgZDEKMCA2IDEgMSByZSBmCjEgNiAx",
        "IDEgcmUgZgoyIDYgMSAxIHJlIGYKMyA2IDEgMSByZSBmCjAgNSAxIDEgcmUgZgo0IDUgMSAxIHJlIGYK",
        "MCA0IDEgMSByZSBmCjQgNCAxIDEgcmUgZgowIDMgMSAxIHJlIGYKMSAzIDEgMSByZSBmCjIgMyAxIDEg",
        "cmUgZgozIDMgMSAxIHJlIGYKMCAyIDEgMSByZSBmCjIgMiAxIDEgcmUgZgowIDEgMSAxIHJlIGYKMyAx",
        "IDEgMSByZSBmCjAgMCAxIDEgcmUgZgo0IDAgMSAxIHJlIGYKZW5kc3RyZWFtCmVuZG9iagoyMzEgMCBv",
        "YmoKPDwgL0xlbmd0aCAxNTggPj4Kc3RyZWFtCjYgMCAwIDAgNiA3IGQxCjAgNiAxIDEgcmUgZgoxIDYg",
        "MSAxIHJlIGYKMiA2IDEgMSByZSBmCjMgNiAxIDEgcmUgZgo0IDYgMSAxIHJlIGYKMiA1IDEgMSByZSBm",
        "CjIgNCAxIDEgcmUgZgoyIDMgMSAxIHJlIGYKMiAyIDEgMSByZSBmCjIgMSAxIDEgcmUgZgoyIDAgMSAx",
        "IHJlIGYKZW5kc3RyZWFtCmVuZG9iagoyMzIgMCBvYmoKPDwgL0xlbmd0aCAyMTAgPj4Kc3RyZWFtCjYg",
        "MCAwIDAgNiA3IGQxCjAgNiAxIDEgcmUgZgo0IDYgMSAxIHJlIGYKMCA1IDEgMSByZSBmCjQgNSAxIDEg",
        "cmUgZgowIDQgMSAxIHJlIGYKNCA0IDEgMSByZSBmCjAgMyAxIDEgcmUgZgo0IDMgMSAxIHJlIGYKMCAy",
        "IDEgMSByZSBmCjQgMiAxIDEgcmUgZgowIDEgMSAxIHJlIGYKNCAxIDEgMSByZSBmCjEgMCAxIDEgcmUg",
        "ZgoyIDAgMSAxIHJlIGYKMyAwIDEgMSByZSBmCmVuZHN0cmVhbQplbmRvYmoKMjMzIDAgb2JqCjw8IC9M",
        "ZW5ndGggNjQ3ID4+CnN0cmVhbQovQ0lESW5pdCAvUHJvY1NldCBmaW5kcmVzb3VyY2UgYmVnaW4KMTIg",
        "ZGljdCBiZWdpbgpiZWdpbmNtYXAKL0NJRFN5c3RlbUluZm8gPDwgL1JlZ2lzdHJ5IChQREZCYXNlKSAv",
        "T3JkZXJpbmcgKFVuaWNvZGUpIC9TdXBwbGVtZW50IDAgPj4gZGVmCi9DTWFwTmFtZSAvUERGQmFzZVVu",
        "aWNvZGUgZGVmCi9DTWFwVHlwZSAyIGRlZgoxIGJlZ2luY29kZXNwYWNlcmFuZ2UKPDAwPiA8N2Y+CmVu",
        "ZGNvZGVzcGFjZXJhbmdlCjI3IGJlZ2luYmZjaGFyCjwyMD4gPDAwMjA+CjwzMD4gPDAwMzA+CjwzMT4g",
        "PDAwMzE+CjwzMj4gPDAwMzI+CjwzMz4gPDAwMzM+CjwzND4gPDAwMzQ+CjwzNT4gPDAwMzU+CjwzNj4g",
        "PDAwMzY+CjwzNz4gPDAwMzc+CjwzOD4gPDAwMzg+CjwzOT4gPDAwMzk+Cjw0MT4gPDAwNDE+Cjw0Mj4g",
        "PDAwNDI+Cjw0Mz4gPDAwNDM+Cjw0ND4gPDAwNDQ+Cjw0NT4gPDAwNDU+Cjw0Nz4gPDAwNDc+Cjw0OD4g",
        "PDAwNDg+Cjw0Yj4gPDAwNGI+Cjw0Yz4gPDAwNGM+Cjw0ZD4gPDAwNGQ+Cjw0ZT4gPDAwNGU+Cjw0Zj4g",
        "PDAwNGY+Cjw1MD4gPDAwNTA+Cjw1Mj4gPDAwNTI+Cjw1ND4gPDAwNTQ+Cjw1NT4gPDAwNTU+CmVuZGJm",
        "Y2hhcgplbmRjbWFwCkNNYXBOYW1lIGN1cnJlbnRkaWN0IC9DTWFwIGRlZmluZXJlc291cmNlIHBvcApl",
        "bmQKZW5kCmVuZHN0cmVhbQplbmRvYmoKeHJlZgowIDIzNAowMDAwMDAwMDAwIDY1NTM1IGYgCjAwMDAw",
        "MDAwMzUgMDAwMDAgbiAKMDAwMDAwMDA4NCAwMDAwMCBuIAowMDAwMDAwMTY2IDAwMDAwIG4gCjAwMDAw",
        "MDExNTYgMDAwMDAgbiAKMDAwMDAwMTk1OCAwMDAwMCBuIAowMDAwMDAyMDg0IDAwMDAwIG4gCjAwMDAw",
        "MDIxOTkgMDAwMDAgbiAKMDAwMDAwMjMyNSAwMDAwMCBuIAowMDAwMDAyNDQwIDAwMDAwIG4gCjAwMDAw",
        "MDI1NjcgMDAwMDAgbiAKMDAwMDAwMjY4MyAwMDAwMCBuIAowMDAwMDAyODExIDAwMDAwIG4gCjAwMDAw",
        "MDI5MjcgMDAwMDAgbiAKMDAwMDAwMzA1NSAwMDAwMCBuIAowMDAwMDAzMTcxIDAwMDAwIG4gCjAwMDAw",
        "MDMyOTkgMDAwMDAgbiAKMDAwMDAwMzQxNSAwMDAwMCBuIAowMDAwMDAzNTQzIDAwMDAwIG4gCjAwMDAw",
        "MDM2NTkgMDAwMDAgbiAKMDAwMDAwMzc4NyAwMDAwMCBuIAowMDAwMDAzOTAzIDAwMDAwIG4gCjAwMDAw",
        "MDQwMzEgMDAwMDAgbiAKMDAwMDAwNDE0NyAwMDAwMCBuIAowMDAwMDA0Mjc1IDAwMDAwIG4gCjAwMDAw",
        "MDQzOTggMDAwMDAgbiAKMDAwMDAwNDUyNiAwMDAwMCBuIAowMDAwMDA0NjQyIDAwMDAwIG4gCjAwMDAw",
        "MDQ3NzAgMDAwMDAgbiAKMDAwMDAwNDg4NiAwMDAwMCBuIAowMDAwMDA1MDE0IDAwMDAwIG4gCjAwMDAw",
        "MDUxMzAgMDAwMDAgbiAKMDAwMDAwNTI1OCAwMDAwMCBuIAowMDAwMDA1Mzc0IDAwMDAwIG4gCjAwMDAw",
        "MDU1MDIgMDAwMDAgbiAKMDAwMDAwNTYxOCAwMDAwMCBuIAowMDAwMDA1NzQ2IDAwMDAwIG4gCjAwMDAw",
        "MDU4NjIgMDAwMDAgbiAKMDAwMDAwNTk5MCAwMDAwMCBuIAowMDAwMDA2MTA2IDAwMDAwIG4gCjAwMDAw",
        "MDYyMzQgMDAwMDAgbiAKMDAwMDAwNjM1MCAwMDAwMCBuIAowMDAwMDA2NDc4IDAwMDAwIG4gCjAwMDAw",
        "MDY1OTQgMDAwMDAgbiAKMDAwMDAwNjcyMiAwMDAwMCBuIAowMDAwMDA2ODQ1IDAwMDAwIG4gCjAwMDAw",
        "MDY5NzMgMDAwMDAgbiAKMDAwMDAwNzA4OSAwMDAwMCBuIAowMDAwMDA3MjE3IDAwMDAwIG4gCjAwMDAw",
        "MDczMzMgMDAwMDAgbiAKMDAwMDAwNzQ2MSAwMDAwMCBuIAowMDAwMDA3NTc3IDAwMDAwIG4gCjAwMDAw",
        "MDc3MDUgMDAwMDAgbiAKMDAwMDAwNzgyMSAwMDAwMCBuIAowMDAwMDA3OTQ5IDAwMDAwIG4gCjAwMDAw",
        "MDgwNjUgMDAwMDAgbiAKMDAwMDAwODE5MyAwMDAwMCBuIAowMDAwMDA4MzA5IDAwMDAwIG4gCjAwMDAw",
        "MDg0MzcgMDAwMDAgbiAKMDAwMDAwODU1MyAwMDAwMCBuIAowMDAwMDA4NjgxIDAwMDAwIG4gCjAwMDAw",
        "MDg3OTcgMDAwMDAgbiAKMDAwMDAwODkyNSAwMDAwMCBuIAowMDAwMDA5MDQxIDAwMDAwIG4gCjAwMDAw",
        "MDkxNjkgMDAwMDAgbiAKMDAwMDAwOTI5MiAwMDAwMCBuIAowMDAwMDA5NDIwIDAwMDAwIG4gCjAwMDAw",
        "MDk1MzYgMDAwMDAgbiAKMDAwMDAwOTY2NCAwMDAwMCBuIAowMDAwMDA5NzgwIDAwMDAwIG4gCjAwMDAw",
        "MDk5MDggMDAwMDAgbiAKMDAwMDAxMDAyNCAwMDAwMCBuIAowMDAwMDEwMTUyIDAwMDAwIG4gCjAwMDAw",
        "MTAyNjggMDAwMDAgbiAKMDAwMDAxMDM5NiAwMDAwMCBuIAowMDAwMDEwNTEyIDAwMDAwIG4gCjAwMDAw",
        "MTA2NDAgMDAwMDAgbiAKMDAwMDAxMDc1NiAwMDAwMCBuIAowMDAwMDEwODg0IDAwMDAwIG4gCjAwMDAw",
        "MTEwMDAgMDAwMDAgbiAKMDAwMDAxMTEyOCAwMDAwMCBuIAowMDAwMDExMjQ0IDAwMDAwIG4gCjAwMDAw",
        "MTEzNzIgMDAwMDAgbiAKMDAwMDAxMTQ4OCAwMDAwMCBuIAowMDAwMDExNjE2IDAwMDAwIG4gCjAwMDAw",
        "MTE3MzkgMDAwMDAgbiAKMDAwMDAxMTg2NyAwMDAwMCBuIAowMDAwMDExOTgzIDAwMDAwIG4gCjAwMDAw",
        "MTIxMTEgMDAwMDAgbiAKMDAwMDAxMjIyNyAwMDAwMCBuIAowMDAwMDEyMzU1IDAwMDAwIG4gCjAwMDAw",
        "MTI0NzEgMDAwMDAgbiAKMDAwMDAxMjU5OSAwMDAwMCBuIAowMDAwMDEyNzE1IDAwMDAwIG4gCjAwMDAw",
        "MTI4NDMgMDAwMDAgbiAKMDAwMDAxMjk1OSAwMDAwMCBuIAowMDAwMDEzMDg3IDAwMDAwIG4gCjAwMDAw",
        "MTMyMDMgMDAwMDAgbiAKMDAwMDAxMzMzMSAwMDAwMCBuIAowMDAwMDEzNDQ3IDAwMDAwIG4gCjAwMDAw",
        "MTM1NzYgMDAwMDAgbiAKMDAwMDAxMzY5MyAwMDAwMCBuIAowMDAwMDEzODIzIDAwMDAwIG4gCjAwMDAw",
        "MTM5NDAgMDAwMDAgbiAKMDAwMDAxNDA3MCAwMDAwMCBuIAowMDAwMDE0MTk0IDAwMDAwIG4gCjAwMDAw",
        "MTQzMjQgMDAwMDAgbiAKMDAwMDAxNDQ0MSAwMDAwMCBuIAowMDAwMDE0NTcxIDAwMDAwIG4gCjAwMDAw",
        "MTQ2ODggMDAwMDAgbiAKMDAwMDAxNDgxOCAwMDAwMCBuIAowMDAwMDE0OTM1IDAwMDAwIG4gCjAwMDAw",
        "MTUwNjUgMDAwMDAgbiAKMDAwMDAxNTE4MiAwMDAwMCBuIAowMDAwMDE1MzEyIDAwMDAwIG4gCjAwMDAw",
        "MTU0MjkgMDAwMDAgbiAKMDAwMDAxNTU1OSAwMDAwMCBuIAowMDAwMDE1Njc2IDAwMDAwIG4gCjAwMDAw",
        "MTU4MDYgMDAwMDAgbiAKMDAwMDAxNTkyMyAwMDAwMCBuIAowMDAwMDE2MDUzIDAwMDAwIG4gCjAwMDAw",
        "MTYxNzAgMDAwMDAgbiAKMDAwMDAxNjMwMCAwMDAwMCBuIAowMDAwMDE2NDE3IDAwMDAwIG4gCjAwMDAw",
        "MTY1NDcgMDAwMDAgbiAKMDAwMDAxNjY3MSAwMDAwMCBuIAowMDAwMDE2ODAxIDAwMDAwIG4gCjAwMDAw",
        "MTY5MTggMDAwMDAgbiAKMDAwMDAxNzA0OCAwMDAwMCBuIAowMDAwMDE3MTY1IDAwMDAwIG4gCjAwMDAw",
        "MTcyOTUgMDAwMDAgbiAKMDAwMDAxNzQxMiAwMDAwMCBuIAowMDAwMDE3NTQyIDAwMDAwIG4gCjAwMDAw",
        "MTc2NTkgMDAwMDAgbiAKMDAwMDAxNzc4OSAwMDAwMCBuIAowMDAwMDE3OTA2IDAwMDAwIG4gCjAwMDAw",
        "MTgwMzYgMDAwMDAgbiAKMDAwMDAxODE1MyAwMDAwMCBuIAowMDAwMDE4MjgzIDAwMDAwIG4gCjAwMDAw",
        "MTg0MDAgMDAwMDAgbiAKMDAwMDAxODUzMCAwMDAwMCBuIAowMDAwMDE4NjQ3IDAwMDAwIG4gCjAwMDAw",
        "MTg3NzcgMDAwMDAgbiAKMDAwMDAxODg5NCAwMDAwMCBuIAowMDAwMDE5MDI0IDAwMDAwIG4gCjAwMDAw",
        "MTkxNDggMDAwMDAgbiAKMDAwMDAxOTI3OCAwMDAwMCBuIAowMDAwMDE5Mzk1IDAwMDAwIG4gCjAwMDAw",
        "MTk1MjUgMDAwMDAgbiAKMDAwMDAxOTY0MiAwMDAwMCBuIAowMDAwMDE5NzcyIDAwMDAwIG4gCjAwMDAw",
        "MTk4ODkgMDAwMDAgbiAKMDAwMDAyMDAxOSAwMDAwMCBuIAowMDAwMDIwMTM2IDAwMDAwIG4gCjAwMDAw",
        "MjAyNjYgMDAwMDAgbiAKMDAwMDAyMDM4MyAwMDAwMCBuIAowMDAwMDIwNTEzIDAwMDAwIG4gCjAwMDAw",
        "MjA2MzAgMDAwMDAgbiAKMDAwMDAyMDc2MCAwMDAwMCBuIAowMDAwMDIwODc3IDAwMDAwIG4gCjAwMDAw",
        "MjEwMDcgMDAwMDAgbiAKMDAwMDAyMTEyNCAwMDAwMCBuIAowMDAwMDIxMjU0IDAwMDAwIG4gCjAwMDAw",
        "MjEzNzEgMDAwMDAgbiAKMDAwMDAyMTUwMSAwMDAwMCBuIAowMDAwMDIxNjI1IDAwMDAwIG4gCjAwMDAw",
        "MjE3NTUgMDAwMDAgbiAKMDAwMDAyMTg3MiAwMDAwMCBuIAowMDAwMDIyMDAyIDAwMDAwIG4gCjAwMDAw",
        "MjIxMTkgMDAwMDAgbiAKMDAwMDAyMjI0OSAwMDAwMCBuIAowMDAwMDIyMzY2IDAwMDAwIG4gCjAwMDAw",
        "MjI0OTYgMDAwMDAgbiAKMDAwMDAyMjYxMyAwMDAwMCBuIAowMDAwMDIyNzQzIDAwMDAwIG4gCjAwMDAw",
        "MjI4NjAgMDAwMDAgbiAKMDAwMDAyMjk5MCAwMDAwMCBuIAowMDAwMDIzMTA3IDAwMDAwIG4gCjAwMDAw",
        "MjMyMzcgMDAwMDAgbiAKMDAwMDAyMzM1NCAwMDAwMCBuIAowMDAwMDIzNDg0IDAwMDAwIG4gCjAwMDAw",
        "MjM2MDEgMDAwMDAgbiAKMDAwMDAyMzczMSAwMDAwMCBuIAowMDAwMDIzODQ4IDAwMDAwIG4gCjAwMDAw",
        "MjM5NzggMDAwMDAgbiAKMDAwMDAyNDEwMiAwMDAwMCBuIAowMDAwMDI0MjMyIDAwMDAwIG4gCjAwMDAw",
        "MjQzNDkgMDAwMDAgbiAKMDAwMDAyNDQ3OSAwMDAwMCBuIAowMDAwMDI0NTk2IDAwMDAwIG4gCjAwMDAw",
        "MjQ3MjYgMDAwMDAgbiAKMDAwMDAyNDg0MyAwMDAwMCBuIAowMDAwMDI0OTczIDAwMDAwIG4gCjAwMDAw",
        "MjUwOTAgMDAwMDAgbiAKMDAwMDAyNTIyMCAwMDAwMCBuIAowMDAwMDI1MzM3IDAwMDAwIG4gCjAwMDAw",
        "MjU0NjcgMDAwMDAgbiAKMDAwMDAyNTU4NCAwMDAwMCBuIAowMDAwMDI1NzE0IDAwMDAwIG4gCjAwMDAw",
        "MjU4MzEgMDAwMDAgbiAKMDAwMDAyNTk2MSAwMDAwMCBuIAowMDAwMDI2MDc4IDAwMDAwIG4gCjAwMDAw",
        "MjYyMDggMDAwMDAgbiAKMDAwMDAyNjMyNSAwMDAwMCBuIAowMDAwMDI2NDU1IDAwMDAwIG4gCjAwMDAw",
        "MjY1NzkgMDAwMDAgbiAKMDAwMDAyNjY0NSAwMDAwMCBuIAowMDAwMDI2NzExIDAwMDAwIG4gCjAwMDAw",
        "MjcwMjUgMDAwMDAgbiAKMDAwMDAyNzIyMiAwMDAwMCBuIAowMDAwMDI3NDcxIDAwMDAwIG4gCjAwMDAw",
        "Mjc3MzMgMDAwMDAgbiAKMDAwMDAyNzk4MiAwMDAwMCBuIAowMDAwMDI4MjcwIDAwMDAwIG4gCjAwMDAw",
        "Mjg1MzIgMDAwMDAgbiAKMDAwMDAyODc0MiAwMDAwMCBuIAowMDAwMDI5MDMwIDAwMDAwIG4gCjAwMDAw",
        "MjkzMDUgMDAwMDAgbiAKMDAwMDAyOTYwNiAwMDAwMCBuIAowMDAwMDI5OTMzIDAwMDAwIG4gCjAwMDAw",
        "MzAxNjkgMDAwMDAgbiAKMDAwMDAzMDQ3MCAwMDAwMCBuIAowMDAwMDMwNzcxIDAwMDAwIG4gCjAwMDAw",
        "MzEwNTkgMDAwMDAgbiAKMDAwMDAzMTM0NyAwMDAwMCBuIAowMDAwMDMxNTk2IDAwMDAwIG4gCjAwMDAw",
        "MzE4MDYgMDAwMDAgbiAKMDAwMDAzMjEwNyAwMDAwMCBuIAowMDAwMDMyMzk1IDAwMDAwIG4gCjAwMDAw",
        "MzI2NzAgMDAwMDAgbiAKMDAwMDAzMjkzMiAwMDAwMCBuIAowMDAwMDMzMjMzIDAwMDAwIG4gCjAwMDAw",
        "MzM0NDMgMDAwMDAgbiAKMDAwMDAzMzcwNSAwMDAwMCBuIAp0cmFpbGVyCjw8IC9TaXplIDIzNCAvUm9v",
        "dCAxIDAgUiAvSUQgWzw1MDQ0NDY0MjQxNTM0NTMxPjw1MDQ0NDY0MjQxNTM0NTMxPl0gPj4Kc3RhcnR4",
        "cmVmCjM0NDA0CiUlRU9GCg==",
      ];

      // Fixture: the frozen 100-page report PDF (base64, decoded once, sync).
      let pdfFixture = null;
      function pdfBytes() {
        if (pdfFixture) return pdfFixture;
        let raw = "";
        for (const part of PDF_FIXTURE_B64) raw += part;
        const bin = atob(raw);
        const bytes = new Uint8Array(bin.length);
        for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
        pdfFixture = bytes;
        return pdfFixture;
      }
      const callables = {};
      for (const key of ["c", "cpp", "rs"]) {
        const inst = mods.engines[key].instances.pdf_parse.instance;
        const mem = inst.exports.memory;
        callables[key] = {
          pdf_parse: () => {
            const pdf = pdfBytes();
            const inputAt = inst.exports.input_ptr();
            new Uint8Array(mem.buffer, inputAt, pdf.length).set(pdf);
            const ret = inst.exports.parse(pdf.length);
            if (ret !== 0) throw new Error(`pdf ${key} parse failed (${ret})`);
          },
        };
      }
      callables.js = {
        pdf_parse: () => {
          const pdf = pdfBytes();
          const err = pdfMirror(pdf);
          if (err !== 0) throw new Error(`pdf js parse failed (${err})`);
        },
      };
      callables.dart = {
        pdf_parse: () => {
          const pdf = pdfBytes();
          const ret = mods.engines.dart.kernels.parse(pdf.buffer);
          if (ret !== 0) throw new Error(`pdf dart parse failed (${ret})`);
        },
      };
      return callables;
    },
  },

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
  }, // --- cad-parametric-bracket: B-rep + scan-band tessellation (oracle: engine.js runJavaScript)
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

  // --- cad-mesh-repair: STL quantize/weld/orient/simplify (mirrors engine.js
  //     repairMeshJavaScript + the frozen mesh-repair.c)
  "cad.mesh-repair.v1": {
    kernels: ["mesh_repair"],
    build(mods) {
      const SCALE = Math.fround(10000);
      const HEADER_WORDS = 20;
      function quantize(value) {
        if (!Number.isFinite(value) || Math.abs(value) > 100000) return 0x7fffffff;
        const product = Math.fround(Math.fround(value) * SCALE);
        const adjusted = Math.fround(product + (product < 0 ? -0.5 : 0.5));
        return Math.trunc(adjusted);
      }
      function fixture() {
        const GRID = 32, VALID = GRID * GRID * 2, DEGENERATE = 64;
        const count = VALID + DEGENERATE;
        const bytes = new Uint8Array(84 + count * 50);
        const enc = new TextEncoder();
        bytes.set(enc.encode("wasm-vs-js cad.mesh-repair.v1 generated grid seed 0x4d455348"), 0);
        const view = new DataView(bytes.buffer);
        view.setUint32(80, count, true);
        let face = 0;
        const emit = (v, reverse = false) => {
          const at = 84 + face * 50;
          const order = reverse ? [0, 2, 1] : [0, 1, 2];
          for (let i = 0; i < 3; i++) {
            view.setFloat32(at + 12 + i * 12, v[order[i]][0], true);
            view.setFloat32(at + 12 + i * 12 + 4, v[order[i]][1], true);
            view.setFloat32(at + 12 + i * 12 + 8, v[order[i]][2], true);
          }
          face++;
        };
        for (let y = 0; y < GRID; y++) {
          for (let x = 0; x < GRID; x++) {
            const a = [x, y, 0], b = [x + 1, y, 0], c = [x + 1, y + 1, 0], d = [x, y + 1, 0];
            const cell = y * GRID + x;
            emit([a, b, c], cell % 5 === 0);
            emit([a, c, d], cell % 7 === 0);
          }
        }
        for (let i = 0; i < DEGENERATE; i++) {
          const x = i % GRID, y = Math.floor(i / GRID);
          emit([[x, y, 0], [x, y, 0], [x, y, 0]]);
        }
        return bytes;
      }
      function jsRepair(bytes) {
        const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
        const count = view.getUint32(80, true);
        const vertices = [], faces = [], ids = new Int32Array(3);
        let removed = 0, flipped = 0, vertexWeldComparisons = 0;
        for (let f = 0; f < count; f++) {
          const at = 84 + f * 50 + 12;
          for (let p = 0; p < 3; p++) {
            const x = quantize(view.getFloat32(at + p * 12, true));
            const y = quantize(view.getFloat32(at + p * 12 + 4, true));
            const z = quantize(view.getFloat32(at + p * 12 + 8, true));
            let id = -1;
            for (let c = 0; c < vertices.length / 3; c++) {
              vertexWeldComparisons++;
              if (vertices[c * 3] === x && vertices[c * 3 + 1] === y && vertices[c * 3 + 2] === z) {
                id = c;
                break;
              }
            }
            if (id < 0) {
              id = vertices.length / 3;
              vertices.push(x, y, z);
            }
            ids[p] = id;
          }
          if (ids[0] === ids[1] || ids[1] === ids[2] || ids[0] === ids[2]) {
            removed++;
            continue;
          }
          const ax = vertices[ids[0] * 3], ay = vertices[ids[0] * 3 + 1];
          const bx = vertices[ids[1] * 3], by = vertices[ids[1] * 3 + 1];
          const cx = vertices[ids[2] * 3], cy = vertices[ids[2] * 3 + 1];
          const nz = (bx - ax) * (cy - ay) - (by - ay) * (cx - ax);
          if (nz === 0) {
            removed++;
            continue;
          }
          if (nz < 0) {
            const sw = ids[1];
            ids[1] = ids[2];
            ids[2] = sw;
            flipped++;
          }
          faces.push(ids[0], ids[1], ids[2]);
        }
        const cleanFaceCount = faces.length / 3;
        if (cleanFaceCount % 2 !== 0) throw new Error("clean face count must be paired");
        const sameEdge = (a, b, c, d) => (a === c && b === d) || (a === d && b === c);
        let cleanEdgeComparisons = 0;
        for (let i = 0; i < cleanFaceCount; i++) {
          for (let e = 0; e < 3; e++) {
            const a = faces[i * 3 + e], b = faces[i * 3 + (e + 1) % 3];
            let incidence = 0;
            for (let j = 0; j < cleanFaceCount; j++) {
              for (let q = 0; q < 3; q++) {
                cleanEdgeComparisons++;
                if (sameEdge(a, b, faces[j * 3 + q], faces[j * 3 + (q + 1) % 3])) incidence++;
              }
            }
            if (incidence > 2) throw new Error("non-manifold edge");
          }
        }
        const simplifiedVertices = [], remap = [];
        let simplificationWeldComparisons = 0;
        for (let id = 0; id < vertices.length / 3; id++) {
          const ox = vertices[id * 3];
          const x = Math.abs(Math.trunc(ox / 10000)) % 2 === 1 ? ox - 10000 : ox;
          const y = vertices[id * 3 + 1], z = vertices[id * 3 + 2];
          let next = -1;
          for (let c = 0; c < simplifiedVertices.length / 3; c++) {
            simplificationWeldComparisons++;
            if (
              simplifiedVertices[c * 3] === x && simplifiedVertices[c * 3 + 1] === y &&
              simplifiedVertices[c * 3 + 2] === z
            ) {
              next = c;
              break;
            }
          }
          if (next < 0) {
            next = simplifiedVertices.length / 3;
            simplifiedVertices.push(x, y, z);
          }
          remap[id] = next;
        }
        const targetFaces = cleanFaceCount / 2;
        const selected = [];
        for (let i = 0; i < cleanFaceCount; i++) {
          const a = remap[faces[i * 3]], b = remap[faces[i * 3 + 1]], c = remap[faces[i * 3 + 2]];
          if (a !== b && b !== c && a !== c) selected.push(a, b, c);
        }
        const selectedFaceCount = selected.length / 3;
        if (selectedFaceCount !== targetFaces) throw new Error("target face count mismatch");
        let uniqueEdges = 0, simplifiedEdgeComparisons = 0;
        for (let i = 0; i < selectedFaceCount; i++) {
          for (let e = 0; e < 3; e++) {
            const a = selected[i * 3 + e], b = selected[i * 3 + (e + 1) % 3];
            let incidence = 0, seen = false;
            for (let j = 0; j < selectedFaceCount; j++) {
              for (let q = 0; q < 3; q++) {
                simplifiedEdgeComparisons++;
                if (sameEdge(a, b, selected[j * 3 + q], selected[j * 3 + (q + 1) % 3])) {
                  incidence++;
                  if (j < i || (j === i && q < e)) seen = true;
                }
              }
            }
            if (incidence > 2) throw new Error("simplified non-manifold edge");
            if (!seen) uniqueEdges++;
          }
        }
        let signedVolumeSixQuantized = 0;
        for (let i = 0; i < selectedFaceCount; i++) {
          const a = selected[i * 3], b = selected[i * 3 + 1], c = selected[i * 3 + 2];
          const ax = simplifiedVertices[a * 3],
            ay = simplifiedVertices[a * 3 + 1],
            az = simplifiedVertices[a * 3 + 2];
          const bx = simplifiedVertices[b * 3],
            by = simplifiedVertices[b * 3 + 1],
            bz = simplifiedVertices[b * 3 + 2];
          const cx = simplifiedVertices[c * 3],
            cy = simplifiedVertices[c * 3 + 1],
            cz = simplifiedVertices[c * 3 + 2];
          signedVolumeSixQuantized += ax * (by * cz - bz * cy) - ay * (bx * cz - bz * cx) +
            az * (bx * cy - by * cx);
        }
        if (signedVolumeSixQuantized !== 0) {
          throw new Error("fixture volume policy requires a planar open mesh");
        }
        const words = new Int32Array(HEADER_WORDS + simplifiedVertices.length + selected.length);
        words.set([
          0x4d455348,
          2,
          count,
          vertices.length / 3,
          cleanFaceCount,
          targetFaces,
          removed,
          flipped,
          count * 3,
          uniqueEdges,
          selectedFaceCount,
          simplifiedVertices.length / 3,
          signedVolumeSixQuantized,
          selectedFaceCount,
          vertexWeldComparisons,
          simplificationWeldComparisons,
          cleanEdgeComparisons,
          simplifiedEdgeComparisons,
          0,
          HEADER_WORDS,
        ]);
        words.set(simplifiedVertices, HEADER_WORDS);
        words.set(selected, HEADER_WORDS + simplifiedVertices.length);
        return words;
      }
      const callables = {};
      for (const key of ["c", "cpp", "rs"]) {
        const inst = mods.engines[key].instances.mesh_repair.instance;
        const mem = inst.exports.memory;
        callables[key] = {
          mesh_repair: () => {
            const input = fixture();
            const inPtr = Number(inst.exports.input_ptr());
            new Uint8Array(mem.buffer, inPtr, input.length).set(input);
            const ret = Number(inst.exports.run(input.length));
            if (ret <= 0) throw new Error(`mesh_repair ${key} run failed (${ret})`);
          },
        };
      }
      callables.js = { mesh_repair: () => jsRepair(fixture()) };
      callables.dart = {
        mesh_repair: () => {
          const input = fixture();
          const outWords = new Int32Array(65536);
          const ret = mods.engines.dart.kernels.meshRepair(input, outWords);
          if (ret <= 0) throw new Error(`mesh_repair dart run failed (${ret})`);
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
  // --- ml-numeric-kernels: GEMM/Conv/Softmax f32+i8 (frozen shapes) ----------
  "ml.numeric-kernels.v1": {
    kernels: ["numeric"],
    build(mods) {
      const SEED = 0x6d6c6b31;
      function xorshift32(state) {
        state ^= state << 13;
        state ^= state >>> 17;
        state ^= state << 5;
        return state >>> 0;
      }
      function stream(length, kind, salt) {
        const out = kind === "f32" ? new Float32Array(length) : new Int8Array(length);
        let state = (SEED ^ salt) >>> 0;
        for (let i = 0; i < length; i++) {
          state = xorshift32(state);
          out[i] = kind === "f32"
            ? Math.fround(((state >>> 8) / 0x1000000) * 2 - 1)
            : ((state % 15) - 7);
        }
        return out;
      }
      function inputs() {
        return {
          gemmF32A: stream(72, "f32", 1),
          gemmF32B: stream(63, "f32", 2),
          gemmI8A: stream(72, "i8", 3),
          gemmI8B: stream(63, "i8", 4),
          convF32Input: stream(192, "f32", 5),
          convF32Weights: stream(108, "f32", 6),
          convI8Input: stream(192, "i8", 7),
          convI8Weights: stream(108, "i8", 8),
          softmaxF32Input: stream(128, "f32", 9),
          softmaxI8Input: stream(128, "i8", 10),
        };
      }
      function jsNumeric(fx) {
        const a = fx.gemmF32A, b = fx.gemmF32B, out = new Float32Array(56);
        for (let i = 0; i < 8; i++) {
          for (let j = 0; j < 7; j++) {
            let acc = Math.fround(0);
            for (let k = 0; k < 9; k++) {
              acc = Math.fround(acc + Math.fround(a[i * 9 + k] * b[k * 7 + j]));
            }
            out[i * 7 + j] = acc + 0;
          }
        }
        return out;
      }
      function jsConv(fx) {
        const inp = fx.convF32Input, w = fx.convF32Weights, out = new Float32Array(256);
        for (let y = 0; y < 8; y++) {
          for (let x = 0; x < 8; x++) {
            for (let o = 0; o < 4; o++) {
              let acc = Math.fround(0);
              for (let ky = 0; ky < 3; ky++) {
                for (let kx = 0; kx < 3; kx++) {
                  const iy = y + ky - 1, ix = x + kx - 1;
                  if (iy < 0 || ix < 0 || iy >= 8 || ix >= 8) continue;
                  for (let c = 0; c < 3; c++) {
                    acc = Math.fround(
                      acc +
                        Math.fround(
                          inp[(iy * 8 + ix) * 3 + c] * w[((ky * 3 + kx) * 3 + c) * 4 + o],
                        ),
                    );
                  }
                }
              }
              out[(y * 8 + x) * 4 + o] = acc + 0;
            }
          }
        }
        return out;
      }
      function jsSoftmax(fx) {
        const inp = fx.softmaxF32Input, out = new Float32Array(128);
        const expApprox = (value) => {
          const x = Math.fround(Math.max(-8, Math.min(0, value)));
          let y = Math.fround(1 + Math.fround(x / 256));
          for (let i = 0; i < 8; i++) y = Math.fround(y * y);
          return y;
        };
        for (let r = 0; r < 8; r++) {
          const base = r * 16;
          let max = inp[base];
          for (let c = 1; c < 16; c++) if (inp[base + c] > max) max = inp[base + c];
          let sum = Math.fround(0);
          for (let c = 0; c < 16; c++) {
            const e = expApprox(Math.fround(inp[base + c] - max));
            out[base + c] = e;
            sum = Math.fround(sum + e);
          }
          for (let c = 0; c < 16; c++) out[base + c] = Math.fround(out[base + c] / sum) + 0;
        }
        return out;
      }
      const callables = {};
      for (const key of ["cpp", "rs"]) {
        const inst = mods.engines[key].instances.numeric.instance;
        const mem = inst.exports.memory;
        const inA = 0, inB = 1024, inW = 2048, out = 8192;
        callables[key] = {
          numeric: () => {
            const fx = inputs();
            new Float32Array(mem.buffer, inA, 72).set(fx.gemmF32A);
            new Float32Array(mem.buffer, inB, 63).set(fx.gemmF32B);
            inst.exports.gemm_f32(inA, inB, out);
            new Int8Array(mem.buffer, inA, 72).set(fx.gemmI8A);
            new Int8Array(mem.buffer, inB, 63).set(fx.gemmI8B);
            inst.exports.gemm_i8(inA, inB, out);
            new Float32Array(mem.buffer, inA, 192).set(fx.convF32Input);
            new Float32Array(mem.buffer, inW, 108).set(fx.convF32Weights);
            inst.exports.conv_f32(inA, inW, out);
            new Int8Array(mem.buffer, inA, 192).set(fx.convI8Input);
            new Int8Array(mem.buffer, inW, 108).set(fx.convI8Weights);
            inst.exports.conv_i8(inA, inW, out);
            new Float32Array(mem.buffer, inA, 128).set(fx.softmaxF32Input);
            inst.exports.softmax_f32(inA, out);
            new Int8Array(mem.buffer, inA, 128).set(fx.softmaxI8Input);
            inst.exports.softmax_i8(inA, out);
          },
        };
      }
      callables.js = {
        numeric: () => {
          const fx = inputs();
          jsNumeric(fx);
          jsConv(fx);
          jsSoftmax(fx);
        },
      };
      callables.dart = {
        numeric: () => {
          const fx = inputs();
          mods.engines.dart.kernels.gemmF32(fx.gemmF32A, fx.gemmF32B, new Float32Array(56));
          mods.engines.dart.kernels.convF32(
            fx.convF32Input,
            fx.convF32Weights,
            new Float32Array(256),
          );
          mods.engines.dart.kernels.softmaxF32(fx.softmaxF32Input, new Float32Array(128));
        },
      };
      return callables;
    },
  },

  // --- crypto-authenticated-stream: ChaCha20-Poly1305 seal/open -------------
  "crypto.authenticated-stream.v1": {
    kernels: ["crypto"],
    async build(mods) {
      const KEY = Uint8Array.from({ length: 32 }, (_, i) => 0x80 + i);
      const SESSION = Uint8Array.from([
        0x57,
        0x41,
        0x53,
        0x4d,
        0x2d,
        0x56,
        0x45,
        0x52,
        0x53,
        0x49,
        0x4f,
        0x4e,
      ]);
      const FRAME_SIZES = [0, 1, 15, 16, 17, 31, 32, 63, 64, 65, 127, 128, 255, 256, 511, 1024];
      function xorshift32(value) {
        value ^= value << 13;
        value ^= value >>> 17;
        value ^= value << 5;
        return value >>> 0;
      }
      function frameAt(index) {
        const size = FRAME_SIZES[index % FRAME_SIZES.length];
        const plaintext = new Uint8Array(size);
        let state = (0x6d2b79f5 ^ Math.imul(index + 1, 0x9e3779b1)) >>> 0;
        for (let off = 0; off < size; off++) {
          state = xorshift32(state);
          plaintext[off] = state >>> 24;
        }
        const nonce = new Uint8Array(12);
        nonce.set([0x43, 0x41, 0x53, 0x31]);
        new DataView(nonce.buffer).setBigUint64(4, BigInt(index), true);
        const aad = new Uint8Array(24);
        const view = new DataView(aad.buffer);
        view.setUint32(0, index, true);
        view.setUint32(4, size, true);
        view.setUint32(8, index % 7, true);
        aad.set(SESSION, 12);
        return { index, plaintext, nonce, aad };
      }
      const FRAMES = [0, 1, 5, 31, 64, 127, 1024];
      let sealJavaScript = null;
      {
        // Lazy-load the workload's JS oracle for the reference engine.
        const mod = await import("/benchmarks/base/crypto-authenticated-stream/engine.js");
        sealJavaScript = mod.sealJavaScript;
      }
      const callables = {};
      for (const key of ["c", "cpp", "rs"]) {
        const inst = mods.engines[key].instances.crypto.instance;
        const mem = inst.exports.memory;
        const keyOff = 0, nonceOff = 64, aadOff = 96, plainOff = 256, ctOff = 8192, tagOff = 16384;
        callables[key] = {
          crypto: () => {
            for (const idx of FRAMES) {
              const f = frameAt(idx);
              mem.set(KEY, keyOff);
              mem.set(f.nonce, nonceOff);
              mem.set(f.aad, aadOff);
              mem.set(f.plaintext, plainOff);
              inst.exports.seal(
                keyOff,
                nonceOff,
                aadOff,
                f.aad.length,
                plainOff,
                f.plaintext.length,
                ctOff,
                tagOff,
              );
              inst.exports.open(
                keyOff,
                nonceOff,
                aadOff,
                f.aad.length,
                ctOff,
                f.plaintext.length,
                tagOff,
                plainOff + 4096,
              );
            }
          },
        };
      }
      callables.js = {
        crypto: () => {
          for (const idx of FRAMES) {
            const f = frameAt(idx);
            sealJavaScript(KEY, f.nonce, f.aad, f.plaintext);
          }
        },
      };
      callables.dart = {
        crypto: () => {
          for (const idx of FRAMES) {
            const f = frameAt(idx);
            const ct = new Uint8Array(f.plaintext.length);
            const tag = new Uint8Array(16);
            mods.engines.dart.kernels.seal(
              KEY,
              f.nonce,
              f.aad,
              f.aad.length,
              f.plaintext,
              f.plaintext.length,
              ct,
              tag,
            );
          }
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
