import { assert, assertEquals } from "./assert.ts";

const rootDir = new URL("../", import.meta.url).pathname.replace(/\/$/, "");

const ARTIFACTS = `${rootDir}/public/artifacts/multilang-wasm-benchmark`;

// V8's js-string builtins option is not in the TS WebAssembly types.
const JS_STRING_BUILTINS = { builtins: ["js-string"] } as unknown as WebAssembly.ModuleImports;

async function loadWasm(name: string): Promise<Uint8Array> {
  return await Deno.readFile(`${ARTIFACTS}/${name}`);
}

function expectedSum(values: number[]): number {
  return values.reduce((a, b) => a + b, 0);
}

Deno.test(
  "multilang-wasm-benchmark: correctness across C, C++, AssemblyScript, Rust, WAT, and Dart (sum_u32)",
  async () => {
    const testArr = new Uint32Array([10, 20, 30, 40, 50, 60, 70, 80, 90, 100]);
    const expected = expectedSum([...testArr]);

    // Linear-memory variants (C, C++, AssemblyScript, Rust, WAT)
    const linear = [
      ["sum_c.wasm", "sum_u32", 1024, "C"],
      ["sum_cpp.wasm", "sum_u32", 1024, "C++"],
      ["sum_asc.wasm", "sum_u32", 1024, "AssemblyScript"],
      ["sum_rs.wasm", "sum_u32", 1024, "Rust"],
      ["sum_wat.wasm", "sum_u32", 0, "Raw WAT"],
    ] as const;
    for (const [file, fnName, offset] of linear) {
      const mod = (await WebAssembly.instantiate(await loadWasm(file), {
        env: { abort: () => {} },
      })) as unknown as {
        instance: WebAssembly.Instance;
      };
      const mem = new Uint32Array(
        (mod.instance.exports.memory as WebAssembly.Memory).buffer,
        offset,
        testArr.length,
      );
      mem.set(testArr);
      const res = (mod.instance.exports[fnName] as (p: number, l: number) => number)(
        offset,
        testArr.length,
      );
      assertEquals(res, expected);
    }

    // Dart WasmGC variant (real instantiation via the dart2wasm glue)
    const dartGlue = await import(`file://${ARTIFACTS}/fft_dart.mjs`);
    const dartApp = await dartGlue.compile(await loadWasm("fft_dart.wasm"));
    const dartInst = await dartApp.instantiate({});
    dartInst.invokeMain();
    const kernels = (globalThis as Record<string, unknown>).dartKernels as {
      sum_u32: (arr: Uint32Array) => number;
      fft_butterfly: (real: Float32Array, imag: Float32Array, len: number) => void;
    };
    assert(kernels && typeof kernels.sum_u32 === "function", "dartKernels not published");
    assertEquals(kernels.sum_u32(testArr), expected);
  },
);

Deno.test(
  "multilang-wasm-benchmark: fft_butterfly runs and mutates output for Rust, C, C++, AS, and Dart",
  async () => {
    const FFT_LEN = 512;
    function inputs(): { real: Float32Array; imag: Float32Array } {
      const real = new Float32Array(FFT_LEN);
      const imag = new Float32Array(FFT_LEN);
      for (let i = 0; i < FFT_LEN; i++) {
        real[i] = Math.sin(i * 0.1);
        imag[i] = Math.cos(i * 0.1);
      }
      return { real, imag };
    }

    // Linear-memory variants
    const linear = [
      ["fft_c.wasm", "fft_butterfly", "C"],
      ["fft_cpp.wasm", "fft_butterfly", "C++"],
      ["fft_asc.wasm", "fft_butterfly", "AssemblyScript"],
      ["fft_rs.wasm", "fft_butterfly", "Rust"],
    ] as const;
    let reference: { real: Float32Array; imag: Float32Array } | null = null;
    for (const [file, fnName, label] of linear) {
      const mod = (await WebAssembly.instantiate(await loadWasm(file), {})) as unknown as {
        instance: WebAssembly.Instance;
      };
      const mem = mod.instance.exports.memory as WebAssembly.Memory;
      const real = new Float32Array(mem.buffer, 1024, FFT_LEN);
      const imag = new Float32Array(mem.buffer, 1024 + FFT_LEN * 4, FFT_LEN);
      const { real: srcReal, imag: srcImag } = inputs();
      real.set(srcReal);
      imag.set(srcImag);
      const before = real[17] + imag[29];
      (mod.instance.exports[fnName] as (r: number, i: number, l: number) => void)(
        1024,
        1024 + FFT_LEN * 4,
        FFT_LEN,
      );
      assert(
        Math.abs(before - (real[17] + imag[29])) > 1e-3,
        `${label} fft_butterfly did not transform the spectrum`,
      );
      // "The spectrum changed" was the only assertion here, so an engine
      // computing different mathematics passed: the AssemblyScript kernel
      // called Mathf.sin/cos where every other engine used the C kernel's
      // four-term Taylor series, and the two disagreed by up to 2.25 absolute.
      // Every engine must now agree with the first one bit for bit.
      const output = { real: Float32Array.from(real), imag: Float32Array.from(imag) };
      if (reference === null) {
        reference = output;
      } else {
        for (let i = 0; i < FFT_LEN; i++) {
          assert(
            output.real[i] === reference.real[i] && output.imag[i] === reference.imag[i],
            `${label} disagrees with C at bin ${i}: ` +
              `(${output.real[i]}, ${output.imag[i]}) vs (${reference.real[i]}, ${
                reference.imag[i]
              })`,
          );
        }
      }
    }

    // Dart WasmGC variant
    const dartGlue = await import(`file://${ARTIFACTS}/fft_dart.mjs`);
    const dartApp = await dartGlue.compile(await loadWasm("fft_dart.wasm"));
    const dartInst = await dartApp.instantiate({});
    dartInst.invokeMain();
    const kernels = (globalThis as Record<string, unknown>).dartKernels as {
      fft_butterfly: (real: Float32Array, imag: Float32Array, len: number) => void;
    };
    const { real, imag } = inputs();
    const before = real[17] + imag[29];
    kernels.fft_butterfly(real, imag, FFT_LEN);
    assert(
      Math.abs(before - (real[17] + imag[29])) > 1e-3,
      "Dart fft_butterfly did not transform the spectrum",
    );
  },
);

Deno.test(
  "multilang-wasm-benchmark: Dart artifact is a WasmGC module (gc sections present, js-string builtins)",
  async () => {
    const bytes = await loadWasm("fft_dart.wasm");
    // Requires the js-string builtins to compile — matches the generated glue.
    const mod =
      new (WebAssembly.Module as unknown as new (b: Uint8Array, o?: unknown) => WebAssembly.Module)(
        bytes,
        JS_STRING_BUILTINS,
      );
    const imports = WebAssembly.Module.imports(mod).map((i) => i.module);
    assert(
      imports.includes("dart2wasm"),
      "Dart module should import from the dart2wasm runtime namespace",
    );
    // WasmGC evidence: the type section payload must contain GC composite
    // form opcodes (0x5f struct, 0x5e array) or rec/sub markers (0x4e/0x50)
    // used by the draft-2023-12 GC encodings. Anchor: dart2wasm import above.
    assert(
      typeSectionContainsGcForms(bytes),
      "Dart module type section should contain GC struct/array forms",
    );
  },
);

/** Returns the payload of the type section (section id 1), or null. */
function readU32Leb(bytes: Uint8Array, start: number): { value: number; offset: number } {
  let result = 0;
  let shift = 0;
  let offset = start;
  while (true) {
    const byte = bytes[offset++];
    result |= (byte & 0x7f) << shift;
    if ((byte & 0x80) === 0) break;
    shift += 7;
  }
  return { value: result >>> 0, offset };
}

function typeSectionPayload(bytes: Uint8Array): Uint8Array | null {
  if (bytes[0] !== 0x00 || bytes[1] !== 0x61 || bytes[2] !== 0x73 || bytes[3] !== 0x6d) {
    throw new Error("not a wasm binary");
  }
  let offset = 8; // magic + version
  while (offset < bytes.length) {
    const id = bytes[offset++];
    const size = readU32Leb(bytes, offset);
    offset = size.offset;
    if (id === 1) return bytes.slice(offset, offset + size.value);
    offset += size.value;
  }
  return null;
}

function typeSectionContainsGcForms(bytes: Uint8Array): boolean {
  const payload = typeSectionPayload(bytes);
  if (!payload) return false;
  // GC composite/rec/sub form opcodes (draft-2023-12): struct 0x5f,
  // array 0x5e, rec 0x4e, sub 0x50.
  return [0x5f, 0x5e, 0x4e, 0x50].some((op) => payload.includes(op));
}

Deno.test("multilang-wasm-benchmark: JSON report passes schema validation and contains key insights", async () => {
  const reportText = await Deno.readTextFile(
    `${rootDir}/public/data/multilang-wasm-benchmark-report.v1.json`,
  );
  const report = JSON.parse(reportText);

  assertEquals(report.schemaVersion, "1.0.0");
  assert(report.workloads.length > 0, "workloads empty");
  assert(report.summary.totalVariantsTested >= 15, "fewer than 15 variants tested");
  assert(report.summary.keyInsights.length > 0, "no key insights");

  const languages = new Set<string>();
  for (const workload of report.workloads) {
    for (const variant of workload.variants) languages.add(variant.language);
  }
  for (const expected of ["Rust / Wasm", "Dart / WasmGC", "C / Wasm", "C++ / Wasm", "Raw WAT"]) {
    assert(languages.has(expected), `report missing ${expected}`);
  }
  const sumWorkload = report.workloads.find((w: { name: string }) => w.name === "sum-u32");
  assert(sumWorkload, "sum-u32 workload missing");
  for (const variant of sumWorkload.variants) {
    assert(
      typeof variant.warmExecutionMs === "number",
      `sum-u32 ${variant.language} warmExecutionMs must be a real number`,
    );
  }
});
