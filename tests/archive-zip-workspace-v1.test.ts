import Ajv2020Module from "ajv2020";
import { inflateRawSync } from "node:zlib";
import { sha256Hex } from "../lib/canonical.ts";
import {
  BOUNDED_ENTRY_COUNT,
  contentFor,
  ENTRY_COUNT,
  inspectArchive,
  pathFor,
  runJavaScript,
  SELECTED_INDICES,
  ZIP_POLICY,
} from "../benchmarks/v1/archive-zip-workspace/engine.js";
import { createHandler } from "../server.ts";
import { assert, assertEquals } from "./assert.ts";

function u16(bytes: Uint8Array, offset: number) {
  return bytes[offset] | (bytes[offset + 1] << 8);
}
function u32(bytes: Uint8Array, offset: number) {
  return (bytes[offset] | (bytes[offset + 1] << 8) | (bytes[offset + 2] << 16) |
    (bytes[offset + 3] << 24)) >>> 0;
}
function set16(bytes: Uint8Array, offset: number, value: number) {
  bytes[offset] = value & 255;
  bytes[offset + 1] = value >>> 8;
}
function locateEocd(bytes: Uint8Array) {
  for (let offset = bytes.length - 22; offset >= 0; offset--) {
    if (u32(bytes, offset) === 0x06054b50) return offset;
  }
  throw new Error("EOCD missing");
}
function equalBytes(left: Uint8Array, right: Uint8Array) {
  return left.length === right.length && left.every((value, index) => value === right[index]);
}

Deno.test("archive v1 build reproduces byte-identical artifact, manifests and records", async () => {
  const paths = [
    "public/artifacts/archive-zip-workspace-v1/archive-zip-workspace.wasm",
    "public/artifacts/archive-zip-workspace-v1/build-manifest.json",
    "public/artifacts/archive-zip-workspace-v1/fixture-manifest.json",
    "public/artifacts/archive-zip-workspace-v1/output-manifest.json",
    "catalog/v1-implementations/archive-zip-workspace.v1.json",
    "public/evidence/v1-implementations/archive-zip-workspace-v1/js-controlled.json",
    "public/evidence/v1-implementations/archive-zip-workspace-v1/wasm-linear-controlled.json",
  ];
  const before = await Promise.all(
    paths.map(async (path) => await sha256Hex(await Deno.readFile(path))),
  );
  const result = await new Deno.Command(Deno.execPath(), {
    args: [
      "run",
      "--allow-read=.",
      "--allow-write=public/artifacts,public/evidence,catalog/v1-implementations",
      "--allow-run=clang,wasm-ld",
      "scripts/build-v1-archive.ts",
    ],
    stdout: "piped",
    stderr: "piped",
  }).output();
  assert(result.success, new TextDecoder().decode(result.stderr));
  const after = await Promise.all(
    paths.map(async (path) => await sha256Hex(await Deno.readFile(path))),
  );
  assertEquals(after, before);
});

Deno.test("archive v1 frozen generator creates exactly 10,000 safe unique NFC paths", () => {
  const paths = new Set<string>();
  let contentBytes = 0;
  for (let index = 0; index < ENTRY_COUNT; index++) {
    const path = pathFor(index);
    assertEquals(path.normalize("NFC"), path);
    assert(!path.startsWith("/") && !path.includes("\\") && !path.split("/").includes(".."));
    paths.add(path);
    const content = contentFor(index);
    assert(content.length >= 48 && content.length <= 160);
    contentBytes += content.length;
  }
  assertEquals(paths.size, 10_000);
  assertEquals(contentBytes, 1_038_404);
  assertEquals([...paths].filter((path) => path.endsWith(".ts")).length, 2_500);
  assertEquals([...paths].filter((path) => path.endsWith(".json")).length, 2_500);
  assertEquals([...paths].filter((path) => path.endsWith(".bin")).length, 2_500);
  assertEquals([...paths].filter((path) => path.endsWith(".md")).length, 2_500);
  assertEquals(ZIP_POLICY.zip64, "forbidden-under-frozen-bounds");
});

Deno.test("archive v1 JavaScript and material Wasm produce identical complete outputs and counters", async () => {
  const js = runJavaScript();
  const wasmBytes = await Deno.readFile(
    "public/artifacts/archive-zip-workspace-v1/archive-zip-workspace.wasm",
  );
  const { instance } = await WebAssembly.instantiate(wasmBytes);
  const exports = instance.exports as Record<string, WebAssembly.ExportValue>;
  assertEquals((exports.archive_run as () => number)(), 0);
  const memory = new Uint8Array((exports.memory as WebAssembly.Memory).buffer);
  const read = (pointer: string, length: string) => {
    const start = (exports[pointer] as () => number)();
    return memory.slice(start, start + (exports[length] as () => number)());
  };
  const wasmArchive = read("archive_ptr", "archive_length");
  const wasmListing = read("listing_ptr", "listing_length");
  const wasmExtracted = read("extracted_ptr", "extracted_length");
  assert(equalBytes(js.archive, wasmArchive));
  assert(equalBytes(js.listing, wasmListing));
  assert(equalBytes(js.extracted, wasmExtracted));
  const values = [
    ...new Uint32Array(
      (exports.memory as WebAssembly.Memory).buffer,
      (exports.counters_ptr as () => number)(),
      15,
    ),
  ];
  assertEquals(values, [
    10_000,
    1_038_404,
    1_038_404,
    427_105,
    7_501,
    611_299,
    10_000,
    10_000,
    10_000,
    0,
    10_000,
    10,
    905,
    3,
    js.archive.length,
  ]);
  const output = JSON.parse(
    await Deno.readTextFile("public/artifacts/archive-zip-workspace-v1/output-manifest.json"),
  );
  assertEquals(await sha256Hex(js.archive), output.outputs.archiveSha256);
  assertEquals(await sha256Hex(js.listing), output.outputs.listingSha256);
  assertEquals(await sha256Hex(js.extracted), output.outputs.extractedSha256);
});

Deno.test("archive v1 bounded JavaScript and Wasm demos produce identical 1,000-entry outputs", async () => {
  const js = runJavaScript(BOUNDED_ENTRY_COUNT);
  assertEquals(js.counters.entries, 1_000);
  assertEquals(js.counters.listedEntries, 1_000);
  assertEquals(js.counters.extractedEntries, 4);

  const wasmBytes = await Deno.readFile(
    "public/artifacts/archive-zip-workspace-v1/archive-zip-workspace.wasm",
  );
  const { instance } = await WebAssembly.instantiate(wasmBytes);
  const exports = instance.exports as Record<string, WebAssembly.ExportValue>;
  assertEquals((exports.archive_run_bounded as () => number)(), 0);
  const memory = new Uint8Array((exports.memory as WebAssembly.Memory).buffer);
  const read = (pointer: string, length: string) => {
    const start = (exports[pointer] as () => number)();
    return memory.slice(start, start + (exports[length] as () => number)());
  };
  assert(equalBytes(js.archive, read("archive_ptr", "archive_length")));
  assert(equalBytes(js.listing, read("listing_ptr", "listing_length")));
  assert(equalBytes(js.extracted, read("extracted_ptr", "extracted_length")));
});

Deno.test("archive v1 selected entries interoperate with independent zlib inflate", () => {
  const { archive } = runJavaScript();
  const eocd = locateEocd(archive);
  let cursor = u32(archive, eocd + 16);
  const selected = new Set(SELECTED_INDICES);
  let checked = 0;
  for (let index = 0; index < ENTRY_COUNT; index++) {
    assertEquals(u32(archive, cursor), 0x02014b50);
    const compressedSize = u32(archive, cursor + 20);
    const size = u32(archive, cursor + 24);
    const nameLength = u16(archive, cursor + 28);
    const localOffset = u32(archive, cursor + 42);
    if (selected.has(index)) {
      const localNameLength = u16(archive, localOffset + 26);
      const dataOffset = localOffset + 30 + localNameLength;
      const plain = new Uint8Array(
        inflateRawSync(archive.subarray(dataOffset, dataOffset + compressedSize)),
      );
      assertEquals(plain.length, size);
      assert(equalBytes(plain, contentFor(index)));
      checked++;
    }
    cursor += 46 + nameLength;
  }
  assertEquals(checked, 10);
});

Deno.test("archive v1 rejects unsafe names and changed ZIP metadata in both engines", async () => {
  const { archive } = runJavaScript();
  const eocd = locateEocd(archive);
  const centralOffset = u32(archive, eocd + 16);
  const localOffset = u32(archive, centralOffset + 42);
  const malformed: Array<{ name: string; bytes: Uint8Array }> = [];
  const mutate = (name: string, offset: number, value: number) => {
    const bytes = archive.slice();
    bytes[offset] = value;
    malformed.push({ name, bytes });
  };

  malformed.push({ name: "truncated EOCD", bytes: archive.slice(0, archive.length - 1) });
  const centralTraversal = archive.slice();
  centralTraversal.set(new TextEncoder().encode("../"), centralOffset + 46);
  malformed.push({ name: "central traversal path", bytes: centralTraversal });
  const localTraversal = archive.slice();
  localTraversal.set(new TextEncoder().encode("../"), centralOffset + 46);
  localTraversal.set(new TextEncoder().encode("../"), localOffset + 30);
  malformed.push({ name: "matching local and central traversal paths", bytes: localTraversal });
  mutate("local and central name mismatch", localOffset + 30, "x".charCodeAt(0));
  mutate("central creator version", centralOffset + 4, 0);
  mutate("central extract version", centralOffset + 6, 0);
  mutate("central compression method", centralOffset + 10, 0);
  mutate("central DOS time", centralOffset + 12, 1);
  mutate("central DOS date", centralOffset + 14, 0);
  mutate("central disk start", centralOffset + 34, 1);
  mutate("central internal attributes", centralOffset + 36, 1);
  mutate("local extract version", localOffset + 4, 0);
  mutate("local DOS time", localOffset + 10, 1);
  mutate("local DOS date", localOffset + 12, 0);
  const zip64 = archive.slice();
  set16(zip64, eocd + 8, 0xffff);
  set16(zip64, eocd + 10, 0xffff);
  malformed.push({ name: "Zip64 marker", bytes: zip64 });

  for (const { name, bytes } of malformed) {
    let rejected = false;
    try {
      inspectArchive(bytes);
    } catch {
      rejected = true;
    }
    assert(rejected, `JavaScript parser accepted malformed ZIP: ${name}`);
  }

  const wasmBytes = await Deno.readFile(
    "public/artifacts/archive-zip-workspace-v1/archive-zip-workspace.wasm",
  );
  const { instance } = await WebAssembly.instantiate(wasmBytes);
  const exports = instance.exports as Record<string, WebAssembly.ExportValue>;
  const memory = new Uint8Array((exports.memory as WebAssembly.Memory).buffer);
  const pointer = (exports.archive_ptr as () => number)();
  for (const { name, bytes } of malformed) {
    assertEquals((exports.archive_run as () => number)(), 0);
    memory.set(bytes, pointer);
    assert(
      (exports.archive_validate as (length: number) => number)(bytes.length) === 0,
      `Wasm parser accepted malformed ZIP: ${name}`,
    );
  }
});

Deno.test("archive v1 supplemental registration preserves frozen catalog bytes and remains non-authoritative", async () => {
  const [catalog, publicCatalog] = await Promise.all([
    Deno.readFile("catalog/workloads.v1.json"),
    Deno.readFile("public/data/workloads.v1.json"),
  ]);
  assert(equalBytes(catalog, publicCatalog));
  assertEquals(
    await sha256Hex(catalog),
    "6665664f984683e5b7d3fdc8c1602198124844704c224a526d48be2f02edf9d4",
  );
  const registration = JSON.parse(
    await Deno.readTextFile("catalog/v1-implementations/archive-zip-workspace.v1.json"),
  );
  assertEquals(registration.workloadId, "archive.zip-workspace.v1");
  assertEquals(registration.countsTowardCoverage, false);
  assertEquals(registration.status, "candidate-implementation-awaiting-independent-review");
  const schema = JSON.parse(
    await Deno.readTextFile("schemas/v1-supplemental-implementation.schema.json"),
  );
  const Ajv2020 = (Ajv2020Module as unknown as { default?: typeof Ajv2020Module }).default ??
    Ajv2020Module;
  const validator = new (Ajv2020 as unknown as new (options: Record<string, unknown>) => {
    compile: (schema: unknown) => ((value: unknown) => boolean) & { errors?: unknown };
  })({ allErrors: true, strict: false }).compile(schema);
  assert(validator(registration), JSON.stringify(validator.errors));
});

Deno.test("archive v1 public routes are explicit, readable and mutation-closed", async () => {
  const handler = createHandler(null, "public");
  const routes = [
    ["/benchmarks/archive-zip-workspace-v1/", "text/html"],
    ["/archive-zip-demo.js", "text/javascript"],
    ["/archive-zip-worker.js", "text/javascript"],
    ["/benchmarks/v1/archive-zip-workspace/engine.js", "text/javascript"],
    ["/artifacts/archive-zip-workspace-v1/archive-zip-workspace.wasm", "application/wasm"],
    ["/artifacts/archive-zip-workspace-v1/build-manifest.json", "application/json"],
    ["/artifacts/archive-zip-workspace-v1/fixture-manifest.json", "application/json"],
    ["/artifacts/archive-zip-workspace-v1/output-manifest.json", "application/json"],
  ];
  for (const [path, contentType] of routes) {
    const response = await handler(new Request(`http://127.0.0.1${path}`));
    assertEquals(response.status, 200);
    assert(response.headers.get("content-type")?.startsWith(contentType));
  }
  const denied = await handler(
    new Request("http://127.0.0.1/benchmarks/archive-zip-workspace-v1/", { method: "POST" }),
  );
  assertEquals(denied.status, 403);
  const unknown = await handler(
    new Request("http://127.0.0.1/artifacts/archive-zip-workspace-v1/private.bin"),
  );
  assertEquals(unknown.status, 404);
  const html =
    await (await handler(new Request("http://127.0.0.1/benchmarks/archive-zip-workspace-v1/")))
      .text();
  assert(html.includes("10,000-file ZIP"));
  assert(html.includes("No performance claim"));
  assert(html.includes("Bounded: 1,000 entries"));
  assert(html.includes("Full contract: exactly 10,000 entries"));
  assert(html.includes("does not count"));
  assert(!/<script(?![^>]*\bsrc=)[^>]*>/i.test(html), "page must not contain inline scripts");
  const worker = await Deno.readTextFile("public/archive-zip-worker.js");
  assert(worker.includes('mode !== "bounded" && mode !== "full"'));
  assert(worker.includes('mode === "full" ? ENTRY_COUNT : BOUNDED_ENTRY_COUNT'));
  const response = await handler(
    new Request("http://127.0.0.1/benchmarks/archive-zip-workspace-v1/"),
  );
  assert(response.headers.get("content-security-policy")?.includes("script-src 'self'"));
});
