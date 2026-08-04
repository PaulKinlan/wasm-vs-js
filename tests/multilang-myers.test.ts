import { assert } from "./assert.ts";

const rootDir = new URL("../", import.meta.url).pathname.replace(/\/$/, "");
const ARTIFACTS = `${rootDir}/public/artifacts/multilang-wasm-benchmark`;

// V8's js-string builtins option is not in the TS WebAssembly types.
const JS_STRING_BUILTINS = { builtins: ["js-string"] } as unknown as WebAssembly.ModuleImports;

let seed = 0xd1ff2026;
function rnd(): number {
  seed = (seed * 1664525 + 1013904223) >>> 0;
  return seed / 4294967296;
}

function genPair(len: number, edits: number) {
  const base = new Uint32Array(len);
  for (let i = 0; i < len; i++) base[i] = i;
  const t: number[] = [];
  for (let i = 0; i < len; i++) t.push(base[i]);
  for (let e = 0; e < edits; e++) {
    const pos = Math.floor(rnd() * (t.length + 1));
    if (rnd() < 0.5) t.splice(pos, 0, 0xffff0000 + e);
    else if (t.length > 0) t.splice(Math.min(pos, t.length - 1), 1);
  }
  const target = new Uint32Array(t.length);
  target.set(t);
  return { base, target };
}

// Exact mirror of benchmarks/v2/text-diff-patch/workload.js myersDiff.
function oracleJS(
  base: Uint32Array, target: Uint32Array,
  outOp: Uint32Array, outX: Uint32Array, outY: Uint32Array,
): { count: number; editDistance: number; frontierSteps: number } {
  let prefix = 0;
  while (prefix < base.length && prefix < target.length && base[prefix] === target[prefix]) prefix++;
  let suffix = 0;
  while (suffix < base.length - prefix && suffix < target.length - prefix &&
    base[base.length - 1 - suffix] === target[target.length - 1 - suffix]) suffix++;
  const n = base.length - prefix - suffix;
  const m = target.length - prefix - suffix;
  const reverse: Array<[number, number, number]> = [];
  for (let index = 0; index < suffix; index++) {
    reverse.push([0, base.length - 1 - index, target.length - 1 - index]);
  }
  let frontierSteps = 0, editDistance = 0;
  if (n === 0) {
    for (let y = m - 1; y >= 0; y--) reverse.push([2, prefix, prefix + y]);
    editDistance = m;
  } else if (m === 0) {
    for (let x = n - 1; x >= 0; x--) reverse.push([1, prefix + x, prefix]);
    editDistance = n;
  } else {
    const max = n + m, offset = max;
    const v = new Int32Array(2 * max + 1);
    v[offset + 1] = 0;
    const trace: Int32Array[] = [];
    outer: for (let d = 0; d <= max; d++) {
      for (let k = -d; k <= d; k += 2) {
        frontierSteps++;
        let x: number;
        if (k === -d || (k !== d && v[offset + k - 1] < v[offset + k + 1])) x = v[offset + k + 1];
        else x = v[offset + k - 1] + 1;
        let y = x - k;
        while (x < n && y < m && base[prefix + x] === target[prefix + y]) { x++; y++; }
        v[offset + k] = x;
        if (x >= n && y >= m) { trace.push(v.slice()); editDistance = d; break outer; }
      }
      trace.push(v.slice());
    }
    let x = n, y = m;
    for (let d = editDistance; d > 0; d--) {
      const prior = trace[d - 1];
      const k = x - y;
      const down = k === -d || (k !== d && prior[offset + k - 1] < prior[offset + k + 1]);
      const previousK = down ? k + 1 : k - 1;
      const previousX = prior[offset + previousK];
      const previousY = previousX - previousK;
      while (x > previousX && y > previousY) {
        x--; y--;
        reverse.push([0, prefix + x, prefix + y]);
      }
      if (down) { y--; reverse.push([2, prefix + x, prefix + y]); }
      else { x--; reverse.push([1, prefix + x, prefix + y]); }
    }
  }
  for (let index = prefix - 1; index >= 0; index--) reverse.push([0, index, index]);
  const ops = reverse.reverse();
  for (let i = 0; i < ops.length; i++) {
    outOp[i] = ops[i][0]; outX[i] = ops[i][1]; outY[i] = ops[i][2];
  }
  return { count: ops.length, editDistance, frontierSteps };
}

function assertBitIdentical(
  label: string,
  got: Array<[number, number, number]>, ed: number, fs: number,
  ref: { count: number; editDistance: number; frontierSteps: number },
  refOps: Array<[number, number, number]>,
): void {
  assert(ed === ref.editDistance, `${label} editDistance mismatch`);
  assert(fs === ref.frontierSteps, `${label} frontierSteps mismatch`);
  assert(got.length === ref.count, `${label} op count mismatch`);
  for (let i = 0; i < got.length; i++) {
    assert(
      got[i][0] === refOps[i][0] && got[i][1] === refOps[i][1] && got[i][2] === refOps[i][2],
      `${label} op ${i} mismatch: ${JSON.stringify(got[i])} vs ${JSON.stringify(refOps[i])}`,
    );
  }
}

Deno.test(
  "multilang-myers: C, C++, Rust, and Dart/WasmGC myers_diff kernels are bit-identical to the JS oracle",
  async () => {
    const { base, target } = genPair(64, 9);
    const cap = base.length + target.length + 1;
    const outOp = new Uint32Array(cap), outX = new Uint32Array(cap), outY = new Uint32Array(cap);
    const ref = oracleJS(base, target, outOp, outX, outY);
    const refOps: Array<[number, number, number]> = [];
    for (let i = 0; i < ref.count; i++) refOps.push([outOp[i], outX[i], outY[i]]);

    const linear = [
      ["myers_diff_c.wasm", "C"],
      ["myers_diff_cpp.wasm", "C++"],
      ["myers_diff_rs.wasm", "Rust"],
    ] as const;
    for (const [file, label] of linear) {
      const mod = (await WebAssembly.instantiate(
        await Deno.readFile(`${ARTIFACTS}/${file}`), {},
      )) as unknown as { instance: WebAssembly.Instance };
      const mem = mod.instance.exports.memory as WebAssembly.Memory;
      const max = base.length + target.length;
      const vstride = 2 * max + 1;
      const scratchBytes = vstride * (max + 2) * 4;
      const baseOff = 0, targetOff = 4096, scratchOff = 8192;
      const opOff = scratchOff + scratchBytes;
      const xOff = opOff + cap * 4, yOff = xOff + cap * 4;
      const edOff = yOff + cap * 4, fsOff = edOff + 4;
      new Uint32Array(mem.buffer, baseOff, base.length).set(base);
      new Uint32Array(mem.buffer, targetOff, target.length).set(target);
      const count = (mod.instance.exports.myers_diff as (
        b: number, bl: number, t: number, tl: number, o: number, x: number, y: number,
        c: number, s: number, su: number, ed: number, fs: number,
      ) => number)(baseOff, base.length, targetOff, target.length, opOff, xOff, yOff, cap,
        scratchOff, vstride * (max + 2), edOff, fsOff);
      const op = new Uint32Array(mem.buffer, opOff, cap);
      const gx = new Uint32Array(mem.buffer, xOff, cap);
      const gy = new Uint32Array(mem.buffer, yOff, cap);
      const got: Array<[number, number, number]> = [];
      for (let i = 0; i < count; i++) got.push([op[i], gx[i], gy[i]]);
      const ed = new Uint32Array(mem.buffer, edOff, 1)[0];
      const fs = new Uint32Array(mem.buffer, fsOff, 1)[0];
      assertBitIdentical(label, got, ed, fs, ref, refOps);
    }

    // Dart/WasmGC
    const dartGlue = await import(`file://${ARTIFACTS}/myers_diff_dart.mjs`);
    const dartApp = await dartGlue.compile(await Deno.readFile(`${ARTIFACTS}/myers_diff_dart.wasm`));
    const dartInst = await dartApp.instantiate({});
    dartInst.invokeMain();
    const kernels = (globalThis as Record<string, unknown>).dartKernels as {
      myers_diff: (
        base: Uint32Array, target: Uint32Array,
        outOp: Uint32Array, outX: Uint32Array, outY: Uint32Array,
        scratch: Uint32Array, cap: number, ed: Uint32Array, fs: Uint32Array,
      ) => number;
    };
    assert(kernels && typeof kernels.myers_diff === "function", "dartKernels not published");
    const max = base.length + target.length;
    const vstride = 2 * max + 1;
    const dOp = new Uint32Array(cap), dX = new Uint32Array(cap), dY = new Uint32Array(cap);
    const dEd = new Uint32Array(1), dFs = new Uint32Array(1);
    const dCount = kernels.myers_diff(
      base, target, dOp, dX, dY, new Uint32Array(vstride * (max + 2)), cap, dEd, dFs,
    );
    const dGot: Array<[number, number, number]> = [];
    for (let i = 0; i < dCount; i++) dGot.push([dOp[i], dX[i], dY[i]]);
    assertBitIdentical("Dart/WasmGC", dGot, dEd[0], dFs[0], ref, refOps);
  },
);

Deno.test("multilang-myers: Dart artifact is a WasmGC module", async () => {
  const bytes = await Deno.readFile(`${ARTIFACTS}/myers_diff_dart.wasm`);
  const mod = new (WebAssembly.Module as unknown as new (b: Uint8Array, o?: unknown) => WebAssembly.Module)(bytes, JS_STRING_BUILTINS);
  assert(
    WebAssembly.Module.imports(mod).some((i) => i.module === "dart2wasm"),
    "missing dart2wasm runtime imports",
  );
  let offset = 8;
  while (offset < bytes.length) {
    const id = bytes[offset++];
    let size = 0, shift = 0;
    while (true) {
      const byte = bytes[offset++];
      size |= (byte & 0x7f) << shift;
      if ((byte & 0x80) === 0) break;
      shift += 7;
    }
    if (id === 1) {
      const payload = bytes.slice(offset, offset + size);
      assert(
        [0x5f, 0x5e, 0x4e, 0x50].some((op) => payload.includes(op)),
        "type section lacks GC struct/array/rec/sub forms",
      );
      return;
    }
    offset += size;
  }
  assert(false, "no type section found");
});

Deno.test("multilang-myers: report contains a measured text-diff-patch workload with 5+ variants", async () => {
  const report = JSON.parse(
    await Deno.readTextFile(`${rootDir}/public/data/multilang-wasm-benchmark-report.v1.json`),
  );
  const wl = report.workloads.find((w: { name: string }) => w.name === "text-diff-patch");
  assert(wl, "text-diff-patch workload missing from report");
  assert(wl.variants.length >= 5, "text-diff-patch needs 5+ variants");
  for (const variant of wl.variants) {
    assert(typeof variant.warmExecutionMs === "number", `${variant.language} must be measured`);
  }
  const languages = wl.variants.map((v: { language: string }) => v.language);
  for (const expected of ["Rust / Wasm", "Dart / WasmGC", "C / Wasm", "C++ / Wasm", "JavaScript"]) {
    assert(languages.includes(expected), `text-diff-patch missing ${expected}`);
  }
});
