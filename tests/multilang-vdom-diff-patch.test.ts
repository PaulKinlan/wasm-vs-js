// multilang-vdom-diff-patch.test.ts — every multilang engine's virtual-DOM
// diff compute core must produce the EXACT oracle of the JS model (the frozen
// 1,000-node treeA + treeB from SplitMix64 seed 3976273958 — 100 reorder /
// 100 attr-set / 50 text-update ⇒ 250 patches, mirrors
// benchmarks/vdom-diff-patch-demo/engine.js createVDOMPatches). Each kernel
// writes counters + FNV-1a canonical/patch-stream digests to a fixed memory
// offset; this test computes the same digests in JS from
// generateVDOMFixture + serializeVDOMToCanonicalHTML and asserts bit-identity.
import { assert } from "./assert.ts";

const rootDir = new URL("../", import.meta.url).pathname.replace(/\/$/, "");
const ARTIFACTS = `${rootDir}/public/artifacts/multilang-wasm-benchmark`;
const RES_OFFSET = 16384;

interface Fnv {
  mixByte(b: number): void;
  mixU16(v: number): void;
  mixI16(v: number): void;
  get(): number;
}

function fnv1a(): Fnv {
  let h = 0x811c9dc5 >>> 0;
  return {
    mixByte(b: number) {
      h = Math.imul((h ^ (b & 0xff)) >>> 0, 0x01000193) >>> 0;
    },
    mixU16(v: number) {
      this.mixByte(v & 0xff);
      this.mixByte((v >>> 8) & 0xff);
    },
    mixI16(v: number) {
      const u = v & 0xffff;
      this.mixByte(u & 0xff);
      this.mixByte((u >>> 8) & 0xff);
    },
    get() {
      return h >>> 0;
    },
  };
}

// Compute the expected oracle by running the JS engine.
async function expectedOracle() {
  const engine = await import(
    `${rootDir}/public/benchmarks/vdom-diff-patch-demo/engine.js`
  );
  const fixture = engine.generateVDOMFixture();
  const mapA = new Map(
    fixture.treeA.map((n: {
      id: number;
      tag: number;
      key: number;
      attrKey: number;
      attrVal: number;
      textId: number;
      children: number[];
    }) => [n.id, n]),
  );
  const mapB = new Map(
    fixture.treeB.map((n: {
      id: number;
      tag: number;
      key: number;
      attrKey: number;
      attrVal: number;
      textId: number;
      children: number[];
    }) => [n.id, n]),
  );

  const treeFnv = fnv1a();
  const walk = (id: number) => {
    // deno-lint-ignore no-explicit-any
    const n = mapB.get(id) as any;
    treeFnv.mixU16(n.id);
    treeFnv.mixI16(n.tag);
    treeFnv.mixI16(n.key);
    treeFnv.mixI16(n.attrKey);
    treeFnv.mixI16(n.attrVal);
    treeFnv.mixI16(n.textId);
    treeFnv.mixU16(n.children.length);
    for (const c of n.children) treeFnv.mixU16(c);
    for (const c of n.children) walk(c);
  };
  walk(0);
  const treeBFnv = treeFnv.get();

  // Build the canonical patch stream in the same order the kernels emit it:
  // op 1 (text updates by nodeId asc), then op 2 (attr sets by nodeId asc),
  // then op 6 (child reorders by nodeId asc).
  const op1: { nodeId: number; targetId: number }[] = [];
  const op2: { nodeId: number; attrKey: number; attrVal: number }[] = [];
  const op6: { nodeId: number; childCount: number; childIds: number[] }[] = [];
  // deno-lint-ignore no-explicit-any
  for (const nb of fixture.treeB as any[]) {
    // deno-lint-ignore no-explicit-any
    const na = mapA.get(nb.id) as any;
    if (nb.tag === -1) {
      if (na.textId !== nb.textId) op1.push({ nodeId: nb.id, targetId: nb.textId });
    } else {
      if (na.attrKey !== nb.attrKey || na.attrVal !== nb.attrVal) {
        op2.push({ nodeId: nb.id, attrKey: nb.attrKey, attrVal: nb.attrVal });
      }
      if (JSON.stringify(na.children) !== JSON.stringify(nb.children)) {
        op6.push({
          nodeId: nb.id,
          childCount: nb.children.length,
          childIds: [...nb.children],
        });
      }
    }
  }
  const patchFnv = fnv1a();
  for (const p of op1) {
    patchFnv.mixByte(1);
    patchFnv.mixU16(p.nodeId);
    patchFnv.mixI16(p.targetId);
    patchFnv.mixI16(-1);
    patchFnv.mixI16(-1);
    patchFnv.mixI16(-1);
  }
  for (const p of op2) {
    patchFnv.mixByte(2);
    patchFnv.mixU16(p.nodeId);
    patchFnv.mixI16(-1);
    patchFnv.mixI16(p.attrKey);
    patchFnv.mixI16(p.attrVal);
    patchFnv.mixI16(-1);
  }
  for (const p of op6) {
    patchFnv.mixByte(6);
    patchFnv.mixU16(p.nodeId);
    patchFnv.mixI16(p.childCount);
    patchFnv.mixI16(-1);
    patchFnv.mixI16(-1);
    patchFnv.mixI16(p.childCount);
    patchFnv.mixU16(p.childCount);
    for (const c of p.childIds) patchFnv.mixU16(c);
  }
  return {
    patches: op1.length + op2.length + op6.length,
    op1: op1.length,
    op2: op2.length,
    op6: op6.length,
    treeBFnv,
    patchFnv: patchFnv.get(),
  };
}

async function load(file: string, imports: WebAssembly.Imports = {}) {
  const bytes = await Deno.readFile(`${ARTIFACTS}/${file}`);
  const { instance } = await WebAssembly.instantiate(bytes, imports);
  return instance;
}

function runKernel(instance: WebAssembly.Instance) {
  const exports = instance.exports as Record<string, unknown>;
  const mem = (exports.memory as WebAssembly.Memory).buffer;
  const ret = (exports.vdom_diff_trace as () => number)();
  const view = new Uint32Array(mem);
  const base = RES_OFFSET / 4;
  return {
    ret,
    patches: view[base],
    op1: view[base + 1],
    op2: view[base + 2],
    op6: view[base + 3],
    treeBFnv: view[base + 4],
    patchFnv: view[base + 5],
  };
}

// Independent oracle: pinned reference SHA-256 constants from the traditional-web
// build (public/artifacts/vdom-diff-patch/build-manifest.json). These are the
// authoritative treeB canonical + patch-stream digests. The JS-model test below
// asserts the engine still produces those exact strings before comparing FNVs.
const PINNED = Object.freeze({
  canonicalHtmlSha256: "172478394b1ba6762f0b8804fe00d5d3b1a1bf52df1c56f5efefa7523e9d1d1c",
  patchDigestSha256: "d56d2533821727e9b23af28622fb25b3e26011e2858eb7ab98232e81fafb3afd",
  patches: 250,
  op1: 50,
  op2: 100,
  op6: 100,
});

async function sha256Hex(bytes: Uint8Array): Promise<string> {
  const copy = new Uint8Array(bytes.byteLength);
  copy.set(bytes);
  const digest = new Uint8Array(await crypto.subtle.digest("SHA-256", copy.buffer));
  return [...digest].map((b) => b.toString(16).padStart(2, "0")).join("");
}

Deno.test("multilang vdom-diff-patch: JS model reproduces the pinned SHA-256 oracle", async () => {
  const engine = await import(
    `${rootDir}/public/benchmarks/vdom-diff-patch-demo/engine.js`
  );
  const fixture = engine.generateVDOMFixture();
  const result = await engine.runVdomJS(fixture);
  assert(
    result.patchesGenerated === PINNED.patches,
    `JS patchesGenerated ${result.patchesGenerated} != ${PINNED.patches}`,
  );
  assert(
    result.patchDigestSha256 === PINNED.patchDigestSha256,
    `JS patchDigest ${result.patchDigestSha256} != ${PINNED.patchDigestSha256}`,
  );
  const targetHtml = engine.serializeVDOMToCanonicalHTML(fixture.treeB);
  const targetHash = await sha256Hex(new TextEncoder().encode(targetHtml));
  assert(
    targetHash === PINNED.canonicalHtmlSha256,
    `JS canonicalHtml ${targetHash} != ${PINNED.canonicalHtmlSha256}`,
  );
});

Deno.test("multilang vdom-diff-patch: JS FNV-1a oracle matches counters", async () => {
  const o = await expectedOracle();
  assert(o.patches === PINNED.patches, `patches ${o.patches} != ${PINNED.patches}`);
  assert(o.op1 === PINNED.op1, `op1 ${o.op1} != ${PINNED.op1}`);
  assert(o.op2 === PINNED.op2, `op2 ${o.op2} != ${PINNED.op2}`);
  assert(o.op6 === PINNED.op6, `op6 ${o.op6} != ${PINNED.op6}`);
});

Deno.test("multilang vdom-diff-patch: C kernel matches the JS oracle exactly", async () => {
  const oracle = await expectedOracle();
  const r = runKernel(await load("vdom_kernel_c.wasm"));
  assert(r.ret === oracle.patches, `C return ${r.ret} != ${oracle.patches}`);
  assert(r.patches === oracle.patches, `C patches ${r.patches} != ${oracle.patches}`);
  assert(r.op1 === oracle.op1, `C op1 ${r.op1} != ${oracle.op1}`);
  assert(r.op2 === oracle.op2, `C op2 ${r.op2} != ${oracle.op2}`);
  assert(r.op6 === oracle.op6, `C op6 ${r.op6} != ${oracle.op6}`);
  assert(
    r.treeBFnv === oracle.treeBFnv,
    `C treeBFnv ${r.treeBFnv.toString(16)} != ${oracle.treeBFnv.toString(16)}`,
  );
  assert(
    r.patchFnv === oracle.patchFnv,
    `C patchFnv ${r.patchFnv.toString(16)} != ${oracle.patchFnv.toString(16)}`,
  );
});

Deno.test("multilang vdom-diff-patch: C++ kernel matches the JS oracle exactly", async () => {
  const oracle = await expectedOracle();
  const r = runKernel(await load("vdom_kernel_cpp.wasm"));
  assert(r.patches === oracle.patches, `C++ patches ${r.patches} != ${oracle.patches}`);
  assert(r.op1 === oracle.op1, `C++ op1 ${r.op1} != ${oracle.op1}`);
  assert(r.op2 === oracle.op2, `C++ op2 ${r.op2} != ${oracle.op2}`);
  assert(r.op6 === oracle.op6, `C++ op6 ${r.op6} != ${oracle.op6}`);
  assert(r.treeBFnv === oracle.treeBFnv, `C++ treeBFnv mismatch`);
  assert(r.patchFnv === oracle.patchFnv, `C++ patchFnv mismatch`);
});

Deno.test("multilang vdom-diff-patch: Rust kernel matches the JS oracle exactly", async () => {
  const oracle = await expectedOracle();
  const r = runKernel(await load("vdom_kernel_rs.wasm"));
  assert(r.patches === oracle.patches, `Rust patches ${r.patches} != ${oracle.patches}`);
  assert(r.op1 === oracle.op1, `Rust op1 ${r.op1} != ${oracle.op1}`);
  assert(r.op2 === oracle.op2, `Rust op2 ${r.op2} != ${oracle.op2}`);
  assert(r.op6 === oracle.op6, `Rust op6 ${r.op6} != ${oracle.op6}`);
  assert(r.treeBFnv === oracle.treeBFnv, `Rust treeBFnv mismatch`);
  assert(r.patchFnv === oracle.patchFnv, `Rust patchFnv mismatch`);
});

Deno.test("multilang vdom-diff-patch: AssemblyScript kernel matches the JS oracle exactly", async () => {
  const oracle = await expectedOracle();
  const r = runKernel(await load("vdom_kernel_asc.wasm", { env: { abort: () => {} } }));
  assert(r.patches === oracle.patches, `AS patches ${r.patches} != ${oracle.patches}`);
  assert(r.op1 === oracle.op1, `AS op1 ${r.op1} != ${oracle.op1}`);
  assert(r.op2 === oracle.op2, `AS op2 ${r.op2} != ${oracle.op2}`);
  assert(r.op6 === oracle.op6, `AS op6 ${r.op6} != ${oracle.op6}`);
  assert(r.treeBFnv === oracle.treeBFnv, `AS treeBFnv mismatch`);
  assert(r.patchFnv === oracle.patchFnv, `AS patchFnv mismatch`);
});
