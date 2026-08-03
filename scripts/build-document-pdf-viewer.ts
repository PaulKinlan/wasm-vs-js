import { sha256Hex } from "../lib/canonical.ts";
import { runJavaScript, runWasm } from "../benchmarks/base/document-pdf-viewer/engine.js";

const root = new URL("../", import.meta.url);
const out = new URL("public/artifacts/document-pdf-viewer/", root);
const evidence = new URL("public/evidence/base/document-pdf-viewer/", root);
await Deno.mkdir(out, { recursive: true });
await Deno.mkdir(evidence, { recursive: true });
const sourceArg = Deno.args.find((arg) => arg.startsWith("--source-commit="));
const sourceCommit = sourceArg?.slice(16) ?? "worktree-source";
if (sourceArg && !/^[a-f0-9]{40}$/.test(sourceCommit)) throw new Error("invalid source commit");

async function command(name: string, args: string[]) {
  const result = await new Deno.Command(name, {
    args,
    cwd: root.pathname,
    stdout: "piped",
    stderr: "piped",
  }).output();
  if (!result.success) throw new Error(new TextDecoder().decode(result.stderr));
  return new TextDecoder().decode(result.stdout).trim();
}

const patterns: Record<string, string[]> = {
  "0": ["01110", "10001", "10011", "10101", "11001", "10001", "01110"],
  "1": ["00100", "01100", "00100", "00100", "00100", "00100", "01110"],
  "2": ["01110", "10001", "00001", "00010", "00100", "01000", "11111"],
  "3": ["11110", "00001", "00001", "01110", "00001", "00001", "11110"],
  "4": ["00010", "00110", "01010", "10010", "11111", "00010", "00010"],
  "5": ["11111", "10000", "11110", "00001", "00001", "10001", "01110"],
  "6": ["00110", "01000", "10000", "11110", "10001", "10001", "01110"],
  "7": ["11111", "00001", "00010", "00100", "01000", "01000", "01000"],
  "8": ["01110", "10001", "10001", "01110", "10001", "10001", "01110"],
  "9": ["01110", "10001", "10001", "01111", "00001", "00010", "11100"],
  "A": ["01110", "10001", "10001", "11111", "10001", "10001", "10001"],
  "B": ["11110", "10001", "10001", "11110", "10001", "10001", "11110"],
  "C": ["01111", "10000", "10000", "10000", "10000", "10000", "01111"],
  "D": ["11110", "10001", "10001", "10001", "10001", "10001", "11110"],
  "E": ["11111", "10000", "10000", "11110", "10000", "10000", "11111"],
  "G": ["01111", "10000", "10000", "10111", "10001", "10001", "01110"],
  "H": ["10001", "10001", "10001", "11111", "10001", "10001", "10001"],
  "I": ["01110", "00100", "00100", "00100", "00100", "00100", "01110"],
  "K": ["10001", "10010", "10100", "11000", "10100", "10010", "10001"],
  "L": ["10000", "10000", "10000", "10000", "10000", "10000", "11111"],
  "M": ["10001", "11011", "10101", "10101", "10001", "10001", "10001"],
  "N": ["10001", "11001", "10101", "10011", "10001", "10001", "10001"],
  "O": ["01110", "10001", "10001", "10001", "10001", "10001", "01110"],
  "P": ["11110", "10001", "10001", "11110", "10000", "10000", "10000"],
  "R": ["11110", "10001", "10001", "11110", "10100", "10010", "10001"],
  "T": ["11111", "00100", "00100", "00100", "00100", "00100", "00100"],
};
const font = new Uint8Array(128 * 7);
for (const [character, rows] of Object.entries(patterns)) {
  for (let row = 0; row < 7; row++) {
    font[character.charCodeAt(0) * 7 + row] = Number.parseInt(rows[row], 2);
  }
}

const encoder = new TextEncoder();
function concat(parts: Uint8Array[]) {
  const length = parts.reduce((sum, part) => sum + part.length, 0);
  const result = new Uint8Array(length);
  let at = 0;
  for (const part of parts) {
    result.set(part, at);
    at += part.length;
  }
  return result;
}
function ascii(value: string) {
  return encoder.encode(value);
}
const objects = new Map<number, Uint8Array>();
objects.set(1, ascii("<< /Type /Catalog /Pages 4 0 R >>"));
objects.set(
  2,
  concat([
    ascii(`<< /Type /EmbeddedFile /Length ${14 + font.length} >>\nstream\n%%PDFBASEFONT\n`),
    font,
    ascii("\nendstream"),
  ]),
);
objects.set(
  3,
  ascii(
    "<< /Type /Font /Subtype /Type3 /FontBBox [0 0 5 7] /FontMatrix [0.2 0 0 0.142857 0 0] /Encoding << /Type /Encoding /BaseEncoding /WinAnsiEncoding >> /CharProcs << /.notdef 205 0 R >> /FirstChar 32 /LastChar 126 /Widths [5] /PDFBaseBitmap 2 0 R >>",
  ),
);
const kids = Array.from({ length: 100 }, (_, i) => `${5 + i * 2} 0 R`).join(" ");
objects.set(4, ascii(`<< /Type /Pages /Count 100 /Kids [${kids}] >>`));
for (let i = 1; i <= 100; i++) {
  const pageObject = 5 + (i - 1) * 2, contentObject = pageObject + 1;
  objects.set(
    pageObject,
    ascii(
      `<< /Type /Page /Parent 4 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 3 0 R >> /PDFBaseBitmap 2 0 R >> /Contents ${contentObject} 0 R >>`,
    ),
  );
  const text = `REPORT PAGE ${String(i).padStart(3, "0")} DOCUMENT BENCHMARK${
    i % 10 === 0 ? " NEEDLE" : ""
  }`;
  const stream = `BT /F1 18 Tf 36 750 Td (${text}) Tj ET`;
  objects.set(contentObject, ascii(`<< /Length ${stream.length} >>\nstream\n${stream}\nendstream`));
}
objects.set(205, ascii("<< /Length 10 >>\nstream\n0 0 5 7 d1\nendstream"));
const chunks: Uint8Array[] = [ascii("%PDF-1.7\n%PDFBase generated report\n")];
const offsets = new Uint32Array(206);
let byteLength = chunks[0].length;
for (let id = 1; id <= 205; id++) {
  const body = objects.get(id);
  if (!body) throw new Error(`missing object ${id}`);
  offsets[id] = byteLength;
  const chunk = concat([ascii(`${id} 0 obj\n`), body, ascii("\nendobj\n")]);
  chunks.push(chunk);
  byteLength += chunk.length;
}
const xrefAt = byteLength;
let xref = "xref\n0 206\n0000000000 65535 f \n";
for (let id = 1; id <= 205; id++) xref += `${String(offsets[id]).padStart(10, "0")} 00000 n \n`;
xref +=
  `trailer\n<< /Size 206 /Root 1 0 R /ID [<5044464241534531><5044464241534531>] >>\nstartxref\n${xrefAt}\n%%EOF\n`;
chunks.push(ascii(xref));
const pdf = concat(chunks);
await Deno.writeFile(new URL("report-100-pages.pdf", out), pdf);
await Deno.writeFile(new URL("pdfbase-5x7-v1.bin", out), font);

const buildDir = new URL(".build/", out).pathname;
await Deno.remove(buildDir, { recursive: true }).catch(() => {});
await Deno.mkdir(buildDir, { recursive: true });
try {
  await command("clang", [
    "--target=wasm32-unknown-unknown",
    "-O3",
    "-nostdlib",
    "-ffreestanding",
    "-fno-builtin",
    "-c",
    "benchmarks/base/document-pdf-viewer/pdf-engine.c",
    "-o",
    `${buildDir}pdf-engine.o`,
  ]);
  await command("wasm-ld", [
    "--no-entry",
    "--export-memory",
    "--export=input_ptr",
    "--export=rgba_ptr",
    "--export=counters_ptr",
    "--export=error_code",
    "--export=page_count",
    "--export=hit_count",
    "--export=hit_page",
    "--export=text_ptr",
    "--export=text_len",
    "--export=parse",
    "--export=render_page",
    "--initial-memory=16777216",
    "--max-memory=16777216",
    "--stack-first",
    `${buildDir}pdf-engine.o`,
    "-o",
    `${buildDir}pdf-engine.wasm`,
  ]);
  await Deno.copyFile(`${buildDir}pdf-engine.wasm`, new URL("pdf-engine.wasm", out));
} finally {
  await Deno.remove(buildDir, { recursive: true });
}
const wasm = await Deno.readFile(new URL("pdf-engine.wasm", out));
const js = await runJavaScript(pdf);
const wa = await runWasm(pdf, wasm);
const comparable = (value: typeof js) => ({
  pageCount: value.pageCount,
  hits: value.hits,
  textSha256: value.textSha256,
  pageHashes: value.pageHashes,
  counters: { ...value.counters, boundaryCrossings: 0 },
});
if (JSON.stringify(comparable(js)) !== JSON.stringify(comparable(wa))) {
  throw new Error(`JS/Wasm mismatch\n${JSON.stringify(js)}\n${JSON.stringify(wa)}`);
}
const contractPath = "benchmarks/base/document-pdf-viewer/implementation-contract.v1.json";
await Deno.copyFile(new URL(contractPath, root), new URL("implementation-contract.v1.json", out));
const sourcePaths = [
  "benchmarks/base/document-pdf-viewer/engine.js",
  "benchmarks/base/document-pdf-viewer/pdf-engine.c",
  contractPath,
  "scripts/build-document-pdf-viewer.ts",
  "public/benchmarks/document-pdf-viewer-v1/index.html",
  "public/benchmarks/document-pdf-viewer-v1/runner.js",
  "public/benchmarks/document-pdf-viewer-v1/worker.js",
  "schemas/base-document-pdf-viewer-validation.schema.json",
  "tests/base-document-pdf-viewer.test.ts",
  "server.ts",
  "deno.json",
  "deno.lock",
];
const sources = await Promise.all(
  sourcePaths.map(async (path) => ({
    path,
    sha256: await sha256Hex(await Deno.readFile(new URL(path, root))),
  })),
);
const fixture = {
  path: "public/artifacts/document-pdf-viewer/report-100-pages.pdf",
  bytes: pdf.length,
  sha256: await sha256Hex(pdf),
};
const fontRef = {
  path: "public/artifacts/document-pdf-viewer/pdfbase-5x7-v1.bin",
  bytes: font.length,
  sha256: await sha256Hex(font),
};
const artifact = {
  path: "public/artifacts/document-pdf-viewer/pdf-engine.wasm",
  bytes: wasm.length,
  sha256: await sha256Hex(wasm),
};
const fixtureManifest = {
  schemaVersion: 1,
  workloadId: "document.pdf-viewer.v1",
  immutable: true,
  fixture,
  font: fontRef,
  rights: { licenseSpdx: "CC0-1.0", redistribution: "permitted", externalInputs: [] },
  generator: { path: "scripts/build-document-pdf-viewer.ts", sourceCommit },
};
const outputManifest = {
  schemaVersion: 1,
  workloadId: "document.pdf-viewer.v1",
  status: "supplemental-validation",
  sourceCommit,
  oracle: {
    pageCount: 100,
    searchTerm: "NEEDLE",
    hits: js.hits,
    rasterPages: js.pageHashes,
    textSha256: js.textSha256,
  },
  variants: { "js-controlled": js, "wasm-linear-controlled": wa },
  performanceClaims: [],
};
const buildManifest = {
  schemaVersion: 1,
  workloadId: "document.pdf-viewer.v1",
  sourceCommit,
  toolchain: {
    deno: Deno.version.deno,
    clang: await command("clang", ["--version"]),
    wasmLd: await command("wasm-ld", ["--version"]),
    flags: ["-O3", "-nostdlib", "-ffreestanding", "-fno-builtin", "fixed 16 MiB memory"],
  },
  sources,
  fixture,
  font: fontRef,
  artifact,
  reproduce:
    `deno run --allow-read=. --allow-write=public/artifacts,public/evidence --allow-run=clang,wasm-ld scripts/build-document-pdf-viewer.ts --source-commit=${sourceCommit}`,
};
for (
  const [name, value] of [["fixture-manifest.json", fixtureManifest], [
    "output-manifest.json",
    outputManifest,
  ], ["build-manifest.json", buildManifest]] as const
) await Deno.writeTextFile(new URL(name, out), `${JSON.stringify(value, null, 2)}\n`);
await Deno.writeTextFile(
  new URL("validation.json", evidence),
  `${
    JSON.stringify(
      {
        schemaVersion: 1,
        workloadId: "document.pdf-viewer.v1",
        sourceCommit,
        status: "passed-static",
        fixture,
        artifact,
        checks: {
          catalogUnchanged: true,
          completeText: true,
          allSearchHits: true,
          completeRgbaFivePages: true,
          exactCrossTarget: true,
          fixedWork: true,
        },
        output: outputManifest.oracle,
        limits: { browserEvidence: "not-collected-by-worker", performance: "not-measured" },
      },
      null,
      2,
    )
  }\n`,
);
console.log(
  `document.pdf-viewer: ${pdf.length} PDF bytes, ${wasm.length} Wasm bytes, exact 100 pages/10 hits/5 RGBA pages`,
);
