import Ajv2020Module from "ajv2020";
import { sha256Hex } from "../lib/canonical.ts";
import { assert, assertEquals } from "./assert.ts";
import {
  HEIGHT,
  PAGE_COUNT,
  parseReport,
  RASTER_PAGES,
  renderPage,
  runJavaScript,
  runWasm,
  WIDTH,
} from "../benchmarks/base/document-pdf-viewer/engine.js";
import { createHandler } from "../server.ts";

type Validator = ((value: unknown) => boolean) & { errors?: unknown };
type AjvConstructor = new (options?: Record<string, unknown>) => {
  compile: (schema: unknown) => Validator;
};
const Ajv2020 = ((Ajv2020Module as unknown as { default?: AjvConstructor }).default ??
  Ajv2020Module) as unknown as AjvConstructor;

const root = new URL("../", import.meta.url);
const artifactRoot = new URL("public/artifacts/document-pdf-viewer/", root);
const pdf = await Deno.readFile(new URL("report-100-pages.pdf", artifactRoot));
const wasm = await Deno.readFile(new URL("pdf-engine.wasm", artifactRoot));
const fixtureManifest = JSON.parse(
  await Deno.readTextFile(new URL("fixture-manifest.json", artifactRoot)),
);
const outputManifest = JSON.parse(
  await Deno.readTextFile(new URL("output-manifest.json", artifactRoot)),
);
const buildManifest = JSON.parse(
  await Deno.readTextFile(new URL("build-manifest.json", artifactRoot)),
);

function replaceSameLength(bytes: Uint8Array, before: string, after: string) {
  assertEquals(before.length, after.length);
  const result = bytes.slice();
  const needle = new TextEncoder().encode(before);
  outer: for (let at = 0; at <= result.length - needle.length; at++) {
    for (let i = 0; i < needle.length; i++) if (result[at + i] !== needle[i]) continue outer;
    result.set(new TextEncoder().encode(after), at);
    return result;
  }
  throw new Error(`mutation target missing: ${before}`);
}

async function rejects(action: () => unknown | Promise<unknown>) {
  let rejected = false;
  try {
    await action();
  } catch {
    rejected = true;
  }
  assert(rejected);
}

Deno.test("document PDF frozen catalog remains byte-identical and fixture bytes are pinned", async () => {
  assertEquals(
    await sha256Hex(await Deno.readFile(new URL("catalog/workloads.v1.json", root))),
    "6665664f984683e5b7d3fdc8c1602198124844704c224a526d48be2f02edf9d4",
  );
  assertEquals(await sha256Hex(pdf), fixtureManifest.fixture.sha256);
  assertEquals(await sha256Hex(wasm), buildManifest.artifact.sha256);
  assertEquals(fixtureManifest.rights, {
    licenseSpdx: "CC0-1.0",
    redistribution: "permitted",
    externalInputs: [],
  });
});

Deno.test("independent JS and material Wasm parse 100 pages and match complete text/RGBA", async () => {
  const js = await runJavaScript(pdf);
  const wa = await runWasm(pdf, wasm);
  assertEquals(js.pageCount, PAGE_COUNT);
  assertEquals(js.hits, [10, 20, 30, 40, 50, 60, 70, 80, 90, 100]);
  assertEquals(js.textSha256, wa.textSha256);
  assertEquals(js.pageHashes, wa.pageHashes);
  assertEquals(js.pageHashes.length, RASTER_PAGES.length);
  assertEquals(js.counters.pixels, RASTER_PAGES.length * WIDTH * HEIGHT);
  assertEquals(wa.counters.pixels, RASTER_PAGES.length * WIDTH * HEIGHT);
  assertEquals(js.counters.objects, fixtureManifest.pdfSubset.objectCount);
  assertEquals(js.counters.pages, 100);
  assertEquals(js.counters.glyphs, wa.counters.glyphs);
  assertEquals(js.counters.searchComparisons, wa.counters.searchComparisons);
  assertEquals(outputManifest.oracle.textSha256, js.textSha256);
  assertEquals(outputManifest.oracle.rasterPages, js.pageHashes);
  assertEquals(js.counters.allocations, 1);
  assertEquals(wa.counters.allocations, 1);
  assertEquals(wa.counters.boundaryCrossings, 225);
  assertEquals(wa.counters.memoryBytes, 16 * 1024 * 1024);
  assertEquals(js.counters.memoryBytes, WIDTH * HEIGHT * 4);
  assertEquals(wa.counters.copiedBytes, pdf.length + 5 * WIDTH * HEIGHT * 4 + 3470 + 36 + 40);
  assertEquals(js.counters.copiedBytes, 0);
  assertEquals(
    outputManifest.independentReference.rasters.map((entry: { rgbaSha256: string }) =>
      entry.rgbaSha256
    ),
    js.pageHashes.map((entry: { sha256: string }) => entry.sha256),
  );
  assert(
    outputManifest.independentReference.rasters.every(
      (entry: { differingPixels: number; maxChannelDifference: number }) =>
        entry.differingPixels === 0 && entry.maxChannelDifference === 0,
    ),
  );
});

Deno.test("independent parsers fail closed on header, xref, trailer root, page tree and truncation", async () => {
  const header = pdf.slice();
  header[1] = 0x58;
  const xref = replaceSameLength(pdf, "0000000035 00000 n", "0000000036 00000 n");
  const root = replaceSameLength(pdf, "/Root 1 0 R", "/Root 9 0 R");
  const parent = replaceSameLength(pdf, "/Parent 4 0 R", "/Parent 9 0 R");
  for (const bytes of [header, xref, root, parent, pdf.slice(0, pdf.length - 100)]) {
    await rejects(() => parseReport(bytes));
    await rejects(() => runWasm(bytes, wasm));
  }
});

Deno.test("ToUnicode and Type3 same-length mutations change both independent targets", async () => {
  const unicode = replaceSameLength(pdf, "<4e> <004e>", "<4e> <0058>");
  const unicodeJs = await runJavaScript(unicode);
  const unicodeWasm = await runWasm(unicode, wasm);
  assertEquals(unicodeJs.hits, []);
  assertEquals(unicodeWasm.hits, []);
  assertEquals(unicodeJs.textSha256, unicodeWasm.textSha256);
  assert(unicodeJs.textSha256 !== outputManifest.oracle.textSha256);

  const type3 = replaceSameLength(
    pdf,
    "230 0 obj\n<< /Length 249 >>\nstream\n6 0 0 0 6 7 d1\n0 6 1 1 re f",
    "230 0 obj\n<< /Length 249 >>\nstream\n6 0 0 0 6 7 d1\n4 6 1 1 re f",
  );
  const original = renderPage(parseReport(pdf), 1);
  const changed = renderPage(parseReport(type3), 1);
  assert((await sha256Hex(original)) !== (await sha256Hex(changed)));
  const type3Js = await runJavaScript(type3);
  const type3Wasm = await runWasm(type3, wasm);
  assertEquals(type3Js.pageHashes, type3Wasm.pageHashes);
  assert(type3Js.pageHashes[0].sha256 !== outputManifest.oracle.rasterPages[0].sha256);
});

Deno.test("Wasm parser independently rejects malformed PDF bytes", async () => {
  const { instance } = await WebAssembly.instantiate(wasm, {});
  const api = instance.exports as Record<string, CallableFunction | WebAssembly.Memory>;
  const memory = api.memory as WebAssembly.Memory;
  const pointer = Number((api.input_ptr as CallableFunction)());
  for (
    const mutate of [
      (bytes: Uint8Array) => {
        bytes[1] = 0x58;
      },
      (bytes: Uint8Array) => {
        bytes.fill(0, bytes.length - 32);
      },
    ]
  ) {
    const bytes = pdf.slice();
    mutate(bytes);
    new Uint8Array(memory.buffer, pointer, bytes.length).set(bytes);
    assert(Number((api.parse as CallableFunction)(bytes.length)) !== 0);
  }
});

Deno.test("demo routes are closed, typed and read-only", async () => {
  const handler = createHandler(null, "public", null);
  const expected = new Map([
    ["/benchmarks/document-pdf-viewer-v1/", "text/html"],
    ["/benchmarks/document-pdf-viewer-v1/runner.js", "text/javascript"],
    ["/benchmarks/document-pdf-viewer-v1/worker.js", "text/javascript"],
    ["/benchmarks/base/document-pdf-viewer/engine.js", "text/javascript"],
    ["/artifacts/document-pdf-viewer/report-100-pages.pdf", "application/pdf"],
    ["/artifacts/document-pdf-viewer/pdf-engine.wasm", "application/wasm"],
    ["/evidence/base/document-pdf-viewer/validation.json", "application/json"],
  ]);
  for (const [path, contentType] of expected) {
    const response = await handler(new Request(`http://fixture.test${path}`));
    assertEquals(response.status, 200);
    assert((response.headers.get("content-type") ?? "").includes(contentType), path);
  }
  assertEquals(
    (await handler(new Request("http://fixture.test/artifacts/document-pdf-viewer/private.bin")))
      .status,
    404,
  );
  assertEquals(
    (await handler(
      new Request("http://fixture.test/benchmarks/document-pdf-viewer-v1/", { method: "POST" }),
    )).status,
    403,
  );
});

Deno.test("worker demo has fresh-worker cancellation, stale, timeout and pagehide lifecycle", async () => {
  const runner = await Deno.readTextFile(
    new URL("public/benchmarks/document-pdf-viewer-v1/runner.js", root),
  );
  const worker = await Deno.readTextFile(
    new URL("public/benchmarks/document-pdf-viewer-v1/worker.js", root),
  );
  for (
    const text of [
      "new Worker",
      ".terminate()",
      "runToken !== token",
      "60_000",
      "pagehide",
      "aria-live",
    ]
  ) {
    assert(
      runner.includes(text) ||
        (await Deno.readTextFile(
          new URL("public/benchmarks/document-pdf-viewer-v1/index.html", root),
        )).includes(text),
    );
  }
  assert(worker.includes("runJavaScript"));
  assert(worker.includes("runWasm"));
  assert(!worker.includes("canvas"));
  assert(!worker.includes("PDFViewer"));
});

Deno.test("closed output and validation schemas reject omitted, null and extra evidence", async () => {
  const validationSchema = JSON.parse(
    await Deno.readTextFile(
      new URL("schemas/base-document-pdf-viewer-validation.schema.json", root),
    ),
  );
  const outputSchema = JSON.parse(
    await Deno.readTextFile(new URL("schemas/base-document-pdf-viewer-output.schema.json", root)),
  );
  const record = JSON.parse(
    await Deno.readTextFile(
      new URL("public/evidence/base/document-pdf-viewer/validation.json", root),
    ),
  );
  const validation = new Ajv2020({ strict: true }).compile(validationSchema);
  const output = new Ajv2020({ strict: true }).compile(outputSchema);
  assert(validation(record), JSON.stringify(validation.errors));
  assert(output(outputManifest), JSON.stringify(output.errors));
  for (
    const mutate of [
      (value: Record<string, unknown>) => value.output = {},
      (value: Record<string, unknown>) => {
        const reference = value.independentReference as { rasters: unknown[] };
        reference.rasters[0] = null;
      },
      (value: Record<string, unknown>) => value.undeclaredEvidence = true,
    ]
  ) {
    const changed = structuredClone(record);
    mutate(changed);
    assert(!validation(changed), "validation schema accepted mutated evidence");
  }
  for (
    const mutate of [
      (value: Record<string, unknown>) => {
        const variants = value.variants as { "js-controlled": { pageHashes: unknown[] } };
        variants["js-controlled"].pageHashes[0] = null;
      },
      (value: Record<string, unknown>) => {
        const variants = value.variants as {
          "wasm-linear-controlled": { counters: Record<string, unknown> };
        };
        delete variants["wasm-linear-controlled"].counters.boundaryCrossings;
      },
      (value: Record<string, unknown>) => {
        const reference = value.independentReference as { rasters: unknown[] };
        [reference.rasters[0], reference.rasters[1]] = [
          reference.rasters[1],
          reference.rasters[0],
        ];
      },
      (value: Record<string, unknown>) => value.undeclaredEvidence = true,
    ]
  ) {
    const changed = structuredClone(outputManifest);
    mutate(changed);
    assert(!output(changed), "output schema accepted mutated result");
  }
});

Deno.test("pinned source graph and builder reproduce every generated byte", async () => {
  for (
    const source of buildManifest.sources as Array<
      { path: string; sha256: string; immutableUrl: string }
    >
  ) {
    const tree = await new Deno.Command("git", {
      args: ["show", `${buildManifest.sourceCommit}:${source.path}`],
      cwd: root.pathname,
      stdout: "piped",
      stderr: "piped",
    }).output();
    assert(tree.success, new TextDecoder().decode(tree.stderr));
    assertEquals(await sha256Hex(tree.stdout), source.sha256);
    assertEquals(await sha256Hex(await Deno.readFile(new URL(source.path, root))), source.sha256);
    assert(source.immutableUrl.endsWith(`/${source.path}`));
  }
  const generated = [
    "report-100-pages.pdf",
    "pdf-engine.wasm",
    "implementation-contract.v1.json",
    "fixture-manifest.json",
    "output-manifest.json",
    "build-manifest.json",
  ];
  const before = await Promise.all(
    generated.map(async (name) =>
      await sha256Hex(await Deno.readFile(new URL(name, artifactRoot)))
    ),
  );
  const result = await new Deno.Command(Deno.execPath(), {
    args: [
      "run",
      "--frozen",
      "--allow-read=.,/tmp,/usr/bin/pdfinfo,/usr/bin/pdftotext,/usr/bin/pdftoppm",
      "--allow-write=public/artifacts,public/evidence,/tmp",
      "--allow-run=clang,wasm-ld,git,pdfinfo,pdftotext,pdftoppm",
      "scripts/build-document-pdf-viewer.ts",
      `--source-commit=${buildManifest.sourceCommit}`,
    ],
    cwd: root.pathname,
    stdout: "piped",
    stderr: "piped",
  }).output();
  assert(result.success, new TextDecoder().decode(result.stderr));
  const after = await Promise.all(
    generated.map(async (name) =>
      await sha256Hex(await Deno.readFile(new URL(name, artifactRoot)))
    ),
  );
  assertEquals(after, before);
});

Deno.test("build provenance pins source, compiler, linker, artifacts and zero external inputs", () => {
  assertEquals(buildManifest.workloadId, "document.pdf-viewer.v1");
  assertEquals(buildManifest.toolchain.deno, "2.9.0");
  assert(buildManifest.toolchain.clang.includes("clang version"));
  assert(buildManifest.toolchain.wasmLd.includes("LLD"));
  assert(
    buildManifest.sources.some((entry: { path: string }) => entry.path.endsWith("pdf-engine.c")),
  );
  assert(buildManifest.sources.some((entry: { path: string }) => entry.path.endsWith("engine.js")));
  assertEquals(buildManifest.fixture.sha256, fixtureManifest.fixture.sha256);
  assert(buildManifest.toolchain.poppler.includes("pdfinfo version"));
  assertEquals(outputManifest.independentReference.executables, [
    {
      name: "pdfinfo",
      path: "/usr/bin/pdfinfo",
      sha256: "dbd8d0d6d07ee4e31069736a05e922e4f66741120622e180d638a4eef4acf94a",
    },
    {
      name: "pdftotext",
      path: "/usr/bin/pdftotext",
      sha256: "b818789548c7432844009e9e137576c9e692143a1b704df884f927d2ea320bda",
    },
    {
      name: "pdftoppm",
      path: "/usr/bin/pdftoppm",
      sha256: "dcccbc24c3bdea27f5b0b2acc1f7ea3f64619c96a537a20ff3e558c968803033",
    },
  ]);
  assertEquals(outputManifest.independentReference.pageCount, 100);
  assertEquals(outputManifest.independentReference.searchHits, 10);
  assertEquals(outputManifest.independentReference.rasters.length, 5);
  assert(
    outputManifest.independentReference.rasters.every(
      (entry: { nonWhitePixels: number; differingPixels: number }) =>
        entry.nonWhitePixels > 0 && entry.differingPixels === 0,
    ),
  );
});
