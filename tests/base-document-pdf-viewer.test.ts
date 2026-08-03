import Ajv2020Module from "ajv2020";
import { sha256Hex } from "../lib/canonical.ts";
import { assert, assertEquals } from "./assert.ts";
import {
  HEIGHT,
  PAGE_COUNT,
  parseReport,
  RASTER_PAGES,
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
});

Deno.test("parser rejects malformed header, missing embedded font, bad page text and truncation", () => {
  const cases: Uint8Array[] = [];
  const header = pdf.slice();
  header[1] = 0x58;
  cases.push(header);
  const font = pdf.slice();
  const fontNeedle = new TextEncoder().encode("%%PDFBASEFONT");
  let fontAt = -1;
  outer: for (let i = 0; i <= font.length - fontNeedle.length; i++) {
    for (let j = 0; j < fontNeedle.length; j++) if (font[i + j] !== fontNeedle[j]) continue outer;
    fontAt = i;
    break;
  }
  assert(fontAt >= 0);
  font[fontAt] = 0x58;
  cases.push(font);
  const badText = pdf.slice();
  const pageNeedle = new TextEncoder().encode("REPORT PAGE 001");
  let pageAt = -1;
  outer2: for (let i = 0; i <= badText.length - pageNeedle.length; i++) {
    for (let j = 0; j < pageNeedle.length; j++) {
      if (badText[i + j] !== pageNeedle[j]) continue outer2;
    }
    pageAt = i;
    break;
  }
  assert(pageAt >= 0);
  badText[pageAt] = 0x58;
  cases.push(badText);
  cases.push(pdf.slice(0, pdf.length - 100));
  for (const bytes of cases) {
    let rejected = false;
    try {
      parseReport(bytes);
    } catch {
      rejected = true;
    }
    assert(rejected);
  }
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

Deno.test("static validation record satisfies its closed schema", async () => {
  const schema = JSON.parse(
    await Deno.readTextFile(
      new URL("schemas/base-document-pdf-viewer-validation.schema.json", root),
    ),
  );
  const record = JSON.parse(
    await Deno.readTextFile(
      new URL("public/evidence/base/document-pdf-viewer/validation.json", root),
    ),
  );
  const validate = new Ajv2020({ strict: true }).compile(schema);
  assert(validate(record), JSON.stringify(validate.errors));
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
    "pdfbase-5x7-v1.bin",
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
      "--allow-read=.",
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
  assertEquals(buildManifest.font.sha256, fixtureManifest.font.sha256);
  assert(buildManifest.toolchain.poppler.includes("pdfinfo version"));
  assertEquals(outputManifest.independentReference.pageCount, 100);
  assertEquals(outputManifest.independentReference.searchHits, 10);
  assertEquals(outputManifest.independentReference.rasters.length, 5);
  assert(
    outputManifest.independentReference.rasters.every((entry: { nonWhitePixels: number }) =>
      entry.nonWhitePixels > 0
    ),
  );
});
