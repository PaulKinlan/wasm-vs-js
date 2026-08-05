import { assert } from "./assert.ts";
import { ControlledSha256, hex } from "../benchmarks/base/crypto-file-integrity/sha256.js";
import {
  FIXTURE_SEED,
  generateFixture,
} from "../benchmarks/base/crypto-file-integrity/workload.js";

const rootDir = new URL("../", import.meta.url).pathname.replace(/\/$/, "");
const ARTIFACTS = `${rootDir}/public/artifacts/multilang-wasm-benchmark`;

const CHUNK = 65536;

// Exact mirror of the workload's wasm-linear-controlled fixed work: chunked
// reset/update/finish over the seeded fixture.
function oracleDigest(bytes: Uint8Array): string {
  const sha = new ControlledSha256();
  for (let off = 0; off < bytes.length; off += CHUNK) {
    sha.update(bytes, off, Math.min(bytes.length, off + CHUNK));
  }
  return hex(sha.digest());
}

function linearDigest(inst: WebAssembly.Instance, bytes: Uint8Array): string {
  const mem = inst.exports.memory as WebAssembly.Memory;
  // Input base is probed above each module's statics: rustc places digest/state
  // near the top of its default 17-page memory (a 1 MiB input at a fixed low
  // offset would overwrite them), while C/C++ place statics low (128 KiB).
  (inst.exports.sha256_reset as () => void)();
  const digestPtr = (inst.exports.sha256_finish as () => number)();
  const base = Math.ceil((digestPtr + 64) / 65536) * 65536;
  if (mem.buffer.byteLength < base + bytes.length) {
    mem.grow(Math.ceil((base + bytes.length - mem.buffer.byteLength) / 65536));
  }
  new Uint8Array(mem.buffer, base, bytes.length).set(bytes);
  (inst.exports.sha256_reset as () => void)();
  for (let off = 0; off < bytes.length; off += CHUNK) {
    (inst.exports.sha256_update as (p: number, l: number) => void)(
      base + off,
      Math.min(CHUNK, bytes.length - off),
    );
  }
  const p = (inst.exports.sha256_finish as () => number)();
  return hex(new Uint8Array(mem.buffer, p, 32));
}

async function dartDigest(bytes: Uint8Array): Promise<string> {
  const glue = await import(`file://${ARTIFACTS}/sha256_dart.mjs`);
  const app = await glue.compile(await Deno.readFile(`${ARTIFACTS}/sha256_dart.wasm`));
  const inst = await app.instantiate({});
  inst.invokeMain();
  const kernels = (globalThis as Record<string, unknown>).dartKernels as {
    sha256_reset: () => void;
    sha256_update: (data: Uint8Array, len: number) => void;
    sha256_finish: (out: Uint8Array) => void;
  };
  if (!kernels || typeof kernels.sha256_reset !== "function") {
    throw new Error("dartKernels not published by sha256 Dart main()");
  }
  kernels.sha256_reset();
  for (let off = 0; off < bytes.length; off += CHUNK) {
    kernels.sha256_update(
      bytes.subarray(off, Math.min(off + CHUNK, bytes.length)),
      Math.min(CHUNK, bytes.length - off),
    );
  }
  const out = new Uint8Array(32);
  kernels.sha256_finish(out);
  return hex(out);
}

Deno.test(
  "multilang-sha256: C, C++, Rust, and Dart/WasmGC SHA-256 kernels are bit-identical to the oracle digest across padding boundaries and the 1 MiB fixture",
  async () => {
    const fixture = generateFixture("seeded-pseudorandom", 1 << 20, FIXTURE_SEED);
    const cases: Array<[string, Uint8Array]> = [
      ["empty", new Uint8Array(0)],
      ["one-byte", new Uint8Array([0x61])],
      ["pad-55", generateFixture("all-zero", 55, FIXTURE_SEED)],
      ["pad-56", generateFixture("all-zero", 56, FIXTURE_SEED)],
      ["pad-57", generateFixture("all-zero", 57, FIXTURE_SEED)],
      ["block-63", generateFixture("all-zero", 63, FIXTURE_SEED)],
      ["block-64", generateFixture("all-zero", 64, FIXTURE_SEED)],
      ["block-65", generateFixture("all-zero", 65, FIXTURE_SEED)],
      ["fixture-1MiB", fixture],
    ];

    const linearFiles = [
      ["sha256_c.wasm", "C"],
      ["sha256_cpp.wasm", "C++"],
      ["sha256_rs.wasm", "Rust"],
    ] as const;
    const linearInsts = [];
    for (const [file, label] of linearFiles) {
      const { instance } = await WebAssembly.instantiate(
        await Deno.readFile(`${ARTIFACTS}/${file}`),
        {},
      );
      linearInsts.push([instance, label] as const);
    }

    for (const [name, bytes] of cases) {
      const ref = oracleDigest(bytes);
      for (const [inst, label] of linearInsts) {
        const got = linearDigest(inst, bytes);
        assert(
          got === ref,
          `${label} ${name} digest mismatch: got=${got} ref=${ref}`,
        );
      }
      const dart = await dartDigest(bytes);
      assert(dart === ref, `Dart ${name} digest mismatch: got=${dart} ref=${ref}`);
    }
  },
);

Deno.test("multilang-sha256: known SHA-256 test vectors", async () => {
  // FIPS 180-4 / NIST vectors — the kernels must produce the canonical digests.
  const vectors: Array<[string, string]> = [
    ["", "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855"],
    ["abc", "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad"],
    [
      "abcdbcdecdefdefgefghfghighijhijkijkljklmklmnlmnomnopnopq",
      "248d6a61d20638b8e5c026930c3e6039a33ce45964ff2167f6ecedd419db06c1",
    ],
  ];
  for (const [input, expected] of vectors) {
    const bytes = new TextEncoder().encode(input);
    const ref = oracleDigest(bytes);
    assert(ref === expected, `oracle mismatch for ${input}: ${ref}`);
    for (const file of ["sha256_c.wasm", "sha256_cpp.wasm", "sha256_rs.wasm"]) {
      const { instance } = await WebAssembly.instantiate(
        await Deno.readFile(`${ARTIFACTS}/${file}`),
        {},
      );
      assert(
        linearDigest(instance, bytes) === expected,
        `${file} failed NIST vector ${input}`,
      );
    }
    assert(await dartDigest(bytes) === expected, `Dart failed NIST vector ${input}`);
  }
});
