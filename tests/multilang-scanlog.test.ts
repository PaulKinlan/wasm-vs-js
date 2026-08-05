import { assert } from "./assert.ts";

const rootDir = new URL("../", import.meta.url).pathname.replace(/\/$/, "");
const ARTIFACTS = `${rootDir}/public/artifacts/multilang-wasm-benchmark`;

// V8's js-string builtins option is not in the TS WebAssembly types.

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

function makeCorpus(records = 40): Uint8Array {
  const RECORD_BYTES = 256, EVENT_INTERVAL = 10;
  const corpus = new Uint8Array(records * RECORD_BYTES);
  const filler = new TextEncoder().encode("日志 café 東京 🚀 запись record ");
  corpus.fill(0x20);
  for (let record = 0; record < records; record++) {
    const offset = record * RECORD_BYTES;
    corpus.set(filler, offset);
    const label = new TextEncoder().encode(String(record).padStart(6, "0"));
    corpus.set(label, offset + filler.byteLength);
    if (record % EVENT_INTERVAL === 0) {
      const eventIndex = record / EVENT_INTERVAL;
      const pi = eventIndex % 20;
      let v = (0x5a17c0de ^ eventIndex ^ Math.imul(pi + 1, 0x9e3779b1)) >>> 0;
      v ^= v << 13;
      v ^= v >>> 17;
      v ^= v << 5;
      v >>>= 0;
      let token: string;
      if (MATCHERS[pi] === 1) {
        token = `${PREFIXES[pi]}node-${
          v.toString(16).padStart(8, "0")
        }.example.test/path/${eventIndex}`;
      } else if (MATCHERS[pi] === 2) {
        token = `${PREFIXES[pi]}${1 + (v & 0xfe)}.${(v >>> 8) & 0xff}.${(v >>> 16) & 0xff}.${
          (v >>> 24) & 0xff
        }`;
      } else {
        token = `${PREFIXES[pi]}${100 + (v % 500)}`;
      }
      corpus.set(new TextEncoder().encode(token), offset + 64);
    }
    corpus[offset + RECORD_BYTES - 1] = 0x0a;
  }
  return corpus;
}

function isUrlTail(b: number): boolean {
  return (b >= 97 && b <= 122) || (b >= 48 && b <= 57) || b === 46 || b === 47 || b === 95 ||
    b === 45;
}

// Exact mirror of workload.js scanControlled for the 20 fixed patterns.
function oracleJS(bytes: Uint8Array): {
  matches: Array<[number, number, number]>;
  cs: number;
  pc: number;
  tc: number;
} {
  const buckets: number[][] = Array.from({ length: 256 }, () => []);
  for (let i = 0; i < 20; i++) buckets[PREFIXES[i].charCodeAt(0)].push(i);
  const matches: Array<[number, number, number]> = [];
  let cs = 0, pc = 0, tc = 0;
  for (let start = 0; start < bytes.length; start++) {
    for (const pi of buckets[bytes[start]]) {
      cs++;
      const prefix = PREFIXES[pi];
      let matched = true;
      for (let i = 0; i < prefix.length; i++) {
        if (start + i >= bytes.length) {
          matched = false;
          break;
        }
        pc++;
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
          tc++;
          if (!isUrlTail(bytes[c])) break;
          c++;
        }
        if (c === s0) end = -1;
        else if (c - s0 === 96 && c < bytes.length && isUrlTail(bytes[c])) {
          tc++;
          end = -1;
        } else end = c;
      } else if (MATCHERS[pi] === 2) {
        let c = cursor;
        let failed = false;
        for (let octet = 0; octet < 4; octet++) {
          const s1 = c;
          let value = 0;
          while (c < bytes.length && c - s1 < 3) {
            const b = bytes[c];
            tc++;
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
            tc++;
            if (bytes[c] !== 46) {
              failed = true;
              break;
            }
            c++;
          }
        }
        if (!failed) {
          if (c < bytes.length) {
            tc++;
            if (bytes[c] >= 48 && bytes[c] <= 57) end = -1;
            else if (bytes[c] === 46) end = -1;
            else end = c;
          } else end = c;
        }
      } else {
        if (cursor + 3 > bytes.length) end = -1;
        else {
          let value = 0;
          let ok = true;
          for (let i = 0; i < 3; i++) {
            const b = bytes[cursor + i];
            tc++;
            if (b < 48 || b > 57) {
              ok = false;
              break;
            }
            value = value * 10 + b - 48;
          }
          if (ok && (value < 100 || value > 599)) ok = false;
          if (!ok) end = -1;
          else {
            const ep = cursor + 3;
            if (ep < bytes.length) {
              tc++;
              if (bytes[ep] >= 48 && bytes[ep] <= 57) end = -1;
              else end = ep;
            } else end = ep;
          }
        }
      }
      if (end >= 0) matches.push([pi, start, end]);
    }
  }
  return { matches, cs, pc, tc };
}

function assertBitIdentical(
  label: string,
  matches: Array<[number, number, number]>,
  cs: number,
  pc: number,
  tc: number,
  ref: { matches: Array<[number, number, number]>; cs: number; pc: number; tc: number },
): void {
  assert(cs === ref.cs, `${label} candidateStarts mismatch`);
  assert(pc === ref.pc, `${label} prefixComparisons mismatch`);
  assert(tc === ref.tc, `${label} tailComparisons mismatch`);
  assert(matches.length === ref.matches.length, `${label} match count mismatch`);
  for (let i = 0; i < matches.length; i++) {
    assert(
      matches[i][0] === ref.matches[i][0] && matches[i][1] === ref.matches[i][1] &&
        matches[i][2] === ref.matches[i][2],
      `${label} match ${i} mismatch: ${JSON.stringify(matches[i])} vs ${
        JSON.stringify(ref.matches[i])
      }`,
    );
  }
}

Deno.test(
  "multilang-scanlog: C, C++, and Dart/WasmGC scan_log kernels are bit-identical to the JS oracle",
  async () => {
    const corpus = makeCorpus(40);
    const ref = oracleJS(corpus);

    const linear = [
      ["scan_log_c.wasm", "C"],
      ["scan_log_cpp.wasm", "C++"],
    ] as const;
    for (const [file, label] of linear) {
      const mod = (await WebAssembly.instantiate(
        await Deno.readFile(`${ARTIFACTS}/${file}`),
        {},
      )) as unknown as { instance: WebAssembly.Instance };
      const mem = mod.instance.exports.memory as WebAssembly.Memory;
      const dataOff = 4096, scratchOff = 1 << 20;
      const cap = 1000;
      const idOff = scratchOff + 256 * 5 * 4;
      const stOff = idOff + cap * 4, enOff = stOff + cap * 4;
      const csOff = enOff + cap * 4, pcOff = csOff + 4, tcOff = pcOff + 4;
      new Uint8Array(mem.buffer, dataOff, corpus.length).set(corpus);
      const count = (mod.instance.exports.scan_log as (
        b: number,
        l: number,
        i: number,
        s: number,
        e: number,
        c: number,
        sc: number,
        cs: number,
        pc: number,
        tc: number,
      ) => number)(
        dataOff,
        corpus.length,
        idOff,
        stOff,
        enOff,
        cap,
        scratchOff,
        csOff,
        pcOff,
        tcOff,
      );
      const ids = new Uint32Array(mem.buffer, idOff, cap);
      const sts = new Uint32Array(mem.buffer, stOff, cap);
      const ends = new Uint32Array(mem.buffer, enOff, cap);
      const matches: Array<[number, number, number]> = [];
      for (let i = 0; i < count; i++) matches.push([ids[i], sts[i], ends[i]]);
      const cs = new Uint32Array(mem.buffer, csOff, 1)[0];
      const pc = new Uint32Array(mem.buffer, pcOff, 1)[0];
      const tc = new Uint32Array(mem.buffer, tcOff, 1)[0];
      assertBitIdentical(label, matches, cs, pc, tc, ref);
    }

    // Dart/WasmGC
    const dartGlue = await import(`file://${ARTIFACTS}/scan_log_dart.mjs`);
    const dartApp = await dartGlue.compile(await Deno.readFile(`${ARTIFACTS}/scan_log_dart.wasm`));
    const dartInst = await dartApp.instantiate({});
    dartInst.invokeMain();
    const kernels = (globalThis as Record<string, unknown>).dartKernels as {
      scan_log: (
        bytes: Uint8Array,
        len: number,
        ids: Uint32Array,
        sts: Uint32Array,
        ends: Uint32Array,
        cap: number,
        scratch: Uint32Array,
        cs: Uint32Array,
        pc: Uint32Array,
        tc: Uint32Array,
      ) => number;
    };
    assert(kernels && typeof kernels.scan_log === "function", "dartKernels not published");
    const cap = 1000;
    const ids = new Uint32Array(cap), sts = new Uint32Array(cap), ends = new Uint32Array(cap);
    const cs = new Uint32Array(1), pc = new Uint32Array(1), tc = new Uint32Array(1);
    const dCount = kernels.scan_log(
      corpus,
      corpus.length,
      ids,
      sts,
      ends,
      cap,
      new Uint32Array(256 * 5),
      cs,
      pc,
      tc,
    );
    const matches: Array<[number, number, number]> = [];
    for (let i = 0; i < dCount; i++) matches.push([ids[i], sts[i], ends[i]]);
    assertBitIdentical("Dart/WasmGC", matches, cs[0], pc[0], tc[0], ref);
  },
);

Deno.test("multilang-scanlog: report contains a measured text-regex-log-scan workload with 4+ variants", async () => {
  const report = JSON.parse(
    await Deno.readTextFile(`${rootDir}/public/data/multilang-wasm-benchmark-report.v1.json`),
  );
  const wl = report.workloads.find((w: { name: string }) => w.name === "text-regex-log-scan");
  assert(wl, "text-regex-log-scan workload missing from report");
  assert(wl.variants.length >= 4, "text-regex-log-scan needs 4+ variants");
  for (const variant of wl.variants) {
    assert(typeof variant.warmExecutionMs === "number", `${variant.language} must be measured`);
  }
  const languages = wl.variants.map((v: { language: string }) => v.language);
  for (const expected of ["Dart / WasmGC", "C / Wasm", "C++ / Wasm", "JavaScript"]) {
    assert(languages.includes(expected), `text-regex-log-scan missing ${expected}`);
  }
});
