// multilang-gc-document-edit.test.ts — every multilang engine's
// text.gc-document-edit.v1 compute core must produce the EXACT oracle of the
// JS model (benchmarks/v1/text-gc-document-edit/workload.js executeFixture on
// the frozen 10,000-edit fixture.v1.txt — 3,334 inserts / 3,333 deletes /
// 3,333 reparents / 257 final nodes / 6,922 child-insertions / 6,666
// child-removals / 10,255 parent-writes, plus a deterministic FNV-1a canonical
// digest 0x6acfb345 over DFS(id + label-bytes + child-count)).
import { assert } from "./assert.ts";

const rootDir = new URL("../", import.meta.url).pathname.replace(/\/$/, "");
const ARTIFACTS = `${rootDir}/public/artifacts/multilang-wasm-benchmark`;
const FIXTURE_PATH = `${rootDir}/public/artifacts/text-gc-document-edit/fixture.v1.txt`;
const REFERENCE_PATH = `${rootDir}/public/artifacts/text-gc-document-edit/reference.json`;
const FIXTURE_OFFSET = 196608;
const RES_OFFSET = 524288;

// Pinned counters from public/artifacts/text-gc-document-edit/reference.json.
const ORACLE = Object.freeze({
  inserts: 3334,
  deletes: 3333,
  reparents: 3333,
  finalNodes: 257,
  childInsertions: 6922,
  childRemovals: 6666,
  parentWrites: 10255,
  // Kernel FNV-1a digest (DFS over id + label-bytes + child-count).
  canonicalFnv: 0x6acfb345,
  canonicalSha256: "40e55287bfd9486ef258602766e7c839e2ad77ba7f52b843117607132a6fd0c4",
});

async function readFixture(): Promise<{ text: string; bytes: Uint8Array }> {
  const bytes = await Deno.readFile(FIXTURE_PATH);
  const text = new TextDecoder().decode(bytes);
  return { text, bytes };
}

async function sha256Hex(bytes: Uint8Array): Promise<string> {
  const copy = new Uint8Array(bytes.byteLength);
  copy.set(bytes);
  const digest = new Uint8Array(await crypto.subtle.digest("SHA-256", copy.buffer));
  return [...digest].map((b) => b.toString(16).padStart(2, "0")).join("");
}

async function loadWasm(file: string, imports: WebAssembly.Imports = {}) {
  const bytes = await Deno.readFile(`${ARTIFACTS}/${file}`);
  const { instance } = await WebAssembly.instantiate(bytes, imports);
  return instance;
}

function runKernel(instance: WebAssembly.Instance, fixture: Uint8Array) {
  const exports = instance.exports as Record<string, unknown>;
  const mem = new Uint8Array((exports.memory as WebAssembly.Memory).buffer);
  mem.set(fixture, FIXTURE_OFFSET);
  const ret = Number((exports.gc_document_edit_trace as (n: number) => number)(fixture.byteLength));
  const view = new Uint32Array((exports.memory as WebAssembly.Memory).buffer);
  const base = RES_OFFSET / 4;
  return {
    ret,
    inserts: view[base],
    deletes: view[base + 1],
    reparents: view[base + 2],
    finalNodes: view[base + 3],
    childInsertions: view[base + 4],
    childRemovals: view[base + 5],
    parentWrites: view[base + 6],
    canonicalFnv: view[base + 7] >>> 0,
  };
}

function assertOracle(label: string, r: ReturnType<typeof runKernel>) {
  assert(r.inserts === ORACLE.inserts, `${label} inserts ${r.inserts} != ${ORACLE.inserts}`);
  assert(r.deletes === ORACLE.deletes, `${label} deletes ${r.deletes} != ${ORACLE.deletes}`);
  assert(
    r.reparents === ORACLE.reparents,
    `${label} reparents ${r.reparents} != ${ORACLE.reparents}`,
  );
  assert(
    r.finalNodes === ORACLE.finalNodes,
    `${label} final-nodes ${r.finalNodes} != ${ORACLE.finalNodes}`,
  );
  assert(
    r.childInsertions === ORACLE.childInsertions,
    `${label} child-insertions ${r.childInsertions} != ${ORACLE.childInsertions}`,
  );
  assert(
    r.childRemovals === ORACLE.childRemovals,
    `${label} child-removals ${r.childRemovals} != ${ORACLE.childRemovals}`,
  );
  assert(
    r.parentWrites === ORACLE.parentWrites,
    `${label} parent-writes ${r.parentWrites} != ${ORACLE.parentWrites}`,
  );
  assert(
    r.canonicalFnv === ORACLE.canonicalFnv,
    `${label} canonical FNV ${r.canonicalFnv.toString(16)} != ${ORACLE.canonicalFnv.toString(16)}`,
  );
  assert(
    r.ret === ORACLE.finalNodes,
    `${label} return ${r.ret} != ${ORACLE.finalNodes}`,
  );
}

Deno.test("multilang gc-document-edit: reference.json matches pinned oracle constants", async () => {
  const referenceText = await Deno.readTextFile(REFERENCE_PATH);
  const reference = JSON.parse(referenceText);
  assert(
    reference.counters.inserts === ORACLE.inserts,
    `reference.inserts drift ${reference.counters.inserts}`,
  );
  assert(
    reference.counters.deletes === ORACLE.deletes,
    `reference.deletes drift ${reference.counters.deletes}`,
  );
  assert(
    reference.counters.reparents === ORACLE.reparents,
    `reference.reparents drift ${reference.counters.reparents}`,
  );
  assert(
    reference.counters["final-nodes"] === ORACLE.finalNodes,
    `reference.final-nodes drift ${reference.counters["final-nodes"]}`,
  );
  assert(
    reference.counters["child-insertions"] === ORACLE.childInsertions,
    `reference.child-insertions drift ${reference.counters["child-insertions"]}`,
  );
  assert(
    reference.counters["child-removals"] === ORACLE.childRemovals,
    `reference.child-removals drift ${reference.counters["child-removals"]}`,
  );
  assert(
    reference.counters["parent-writes"] === ORACLE.parentWrites,
    `reference.parent-writes drift ${reference.counters["parent-writes"]}`,
  );
  assert(
    reference.canonicalSha256 === ORACLE.canonicalSha256,
    `reference.canonicalSha256 drift ${reference.canonicalSha256}`,
  );
});

Deno.test("multilang gc-document-edit: JS workload executeFixture matches the oracle exactly", async () => {
  const { text } = await readFixture();
  const workload = await import(
    `${rootDir}/benchmarks/v1/text-gc-document-edit/workload.js`
  );
  const result = workload.executeFixture(text, "js-controlled");
  assert(
    result.counters.inserts === ORACLE.inserts,
    `JS inserts ${result.counters.inserts} != ${ORACLE.inserts}`,
  );
  assert(
    result.counters.deletes === ORACLE.deletes,
    `JS deletes ${result.counters.deletes} != ${ORACLE.deletes}`,
  );
  assert(
    result.counters.reparents === ORACLE.reparents,
    `JS reparents ${result.counters.reparents} != ${ORACLE.reparents}`,
  );
  assert(
    result.counters["final-nodes"] === ORACLE.finalNodes,
    `JS final-nodes ${result.counters["final-nodes"]} != ${ORACLE.finalNodes}`,
  );
  assert(
    result.counters["child-insertions"] === ORACLE.childInsertions,
    `JS child-insertions ${result.counters["child-insertions"]} != ${ORACLE.childInsertions}`,
  );
  assert(
    result.counters["child-removals"] === ORACLE.childRemovals,
    `JS child-removals ${result.counters["child-removals"]} != ${ORACLE.childRemovals}`,
  );
  assert(
    result.counters["parent-writes"] === ORACLE.parentWrites,
    `JS parent-writes ${result.counters["parent-writes"]} != ${ORACLE.parentWrites}`,
  );
  const canonicalHash = await sha256Hex(new TextEncoder().encode(result.canonical));
  assert(
    canonicalHash === ORACLE.canonicalSha256,
    `JS canonical SHA-256 ${canonicalHash} != ${ORACLE.canonicalSha256}`,
  );
});

Deno.test("multilang gc-document-edit: C kernel matches the JS oracle exactly", async () => {
  const { bytes } = await readFixture();
  const r = runKernel(await loadWasm("gc_document_kernel_c.wasm"), bytes);
  assertOracle("C", r);
});

Deno.test("multilang gc-document-edit: C++ kernel matches the JS oracle exactly", async () => {
  const { bytes } = await readFixture();
  const r = runKernel(await loadWasm("gc_document_kernel_cpp.wasm"), bytes);
  assertOracle("C++", r);
});

Deno.test("multilang gc-document-edit: Rust kernel matches the JS oracle exactly", async () => {
  const { bytes } = await readFixture();
  const r = runKernel(await loadWasm("gc_document_kernel_rs.wasm"), bytes);
  assertOracle("Rust", r);
});

Deno.test("multilang gc-document-edit: AssemblyScript kernel matches the JS oracle exactly", async () => {
  const { bytes } = await readFixture();
  const r = runKernel(
    await loadWasm("gc_document_kernel_asc.wasm", { env: { abort: () => {} } }),
    bytes,
  );
  assertOracle("AS", r);
});
