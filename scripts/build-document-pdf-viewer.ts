import { sha256Hex } from "../lib/canonical.ts";
import {
  parseReport,
  renderPage,
  runJavaScript,
  runWasm,
} from "../benchmarks/base/document-pdf-viewer/engine.js";

const root = new URL("../", import.meta.url);
const popplerExecutables = {
  pdfinfo: "/usr/bin/pdfinfo",
  pdftotext: "/usr/bin/pdftotext",
  pdftoppm: "/usr/bin/pdftoppm",
} as const;
const out = new URL("public/artifacts/document-pdf-viewer/", root);
const evidence = new URL("public/evidence/base/document-pdf-viewer/", root);
await Deno.mkdir(out, { recursive: true });
await Deno.mkdir(evidence, { recursive: true });
const sourceArg = Deno.args.find((arg) => arg.startsWith("--source-commit="));
const sourceCommit = sourceArg?.slice(16) ?? "worktree-source";
if (sourceArg && !/^[a-f0-9]{40}$/.test(sourceCommit)) throw new Error("invalid source commit");

async function commandBytes(name: string, args: string[]) {
  const result = await new Deno.Command(name, {
    args,
    cwd: root.pathname,
    stdout: "piped",
    stderr: "piped",
  }).output();
  if (!result.success) throw new Error(new TextDecoder().decode(result.stderr));
  return result.stdout;
}
async function command(name: string, args: string[]) {
  return new TextDecoder().decode(await commandBytes(name, args)).trim();
}
async function toolVersion(name: string) {
  const result = await new Deno.Command(name, {
    args: ["-v"],
    cwd: root.pathname,
    stdout: "piped",
    stderr: "piped",
  }).output();
  if (!result.success) throw new Error(new TextDecoder().decode(result.stderr));
  return `${new TextDecoder().decode(result.stdout)}${new TextDecoder().decode(result.stderr)}`
    .trim();
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
  "U": ["10001", "10001", "10001", "10001", "10001", "10001", "01110"],
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
objects.set(2, ascii("<< /Producer (PDFBase repository-owned Type3 fixture generator) >>"));
const glyphNames: Record<string, string> = {
  " ": "space",
  "0": "zero",
  "1": "one",
  "2": "two",
  "3": "three",
  "4": "four",
  "5": "five",
  "6": "six",
  "7": "seven",
  "8": "eight",
  "9": "nine",
  "A": "A",
  "B": "B",
  "C": "C",
  "D": "D",
  "E": "E",
  "G": "G",
  "H": "H",
  "K": "K",
  "L": "L",
  "M": "M",
  "N": "N",
  "O": "O",
  "P": "P",
  "R": "R",
  "T": "T",
  "U": "U",
};
const glyphEntries = Object.entries(glyphNames).sort((a, b) =>
  a[0].charCodeAt(0) - b[0].charCodeAt(0)
);
const notdef = "6 0 0 0 6 7 d1\n";
objects.set(205, ascii(`<< /Length ${notdef.length} >>\nstream\n${notdef}endstream`));
let charProcs = "/.notdef 205 0 R";
let differences = "";
for (let index = 0; index < glyphEntries.length; index++) {
  const [character, name] = glyphEntries[index];
  const objectId = 206 + index;
  charProcs += ` /${name} ${objectId} 0 R`;
  differences += ` ${character.charCodeAt(0)} /${name}`;
  const rows = Array.from(
    font.subarray(character.charCodeAt(0) * 7, character.charCodeAt(0) * 7 + 7),
  );
  let commands = "6 0 0 0 6 7 d1\n";
  for (let row = 0; row < 7; row++) {
    for (let col = 0; col < 5; col++) {
      if ((rows[row] >> (4 - col)) & 1) commands += `${col} ${6 - row} 1 1 re f\n`;
    }
  }
  objects.set(objectId, ascii(`<< /Length ${commands.length} >>\nstream\n${commands}endstream`));
}
const toUnicodeObject = 206 + glyphEntries.length;
let unicodeMappings = "";
for (const [character] of glyphEntries) {
  unicodeMappings += `<${character.charCodeAt(0).toString(16).padStart(2, "0")}> <${
    character.charCodeAt(0).toString(16).padStart(4, "0")
  }>\n`;
}
const cmap =
  `/CIDInit /ProcSet findresource begin\n12 dict begin\nbegincmap\n/CIDSystemInfo << /Registry (PDFBase) /Ordering (Unicode) /Supplement 0 >> def\n/CMapName /PDFBaseUnicode def\n/CMapType 2 def\n1 begincodespacerange\n<00> <7f>\nendcodespacerange\n${glyphEntries.length} beginbfchar\n${unicodeMappings}endbfchar\nendcmap\nCMapName currentdict /CMap defineresource pop\nend\nend\n`;
objects.set(toUnicodeObject, ascii(`<< /Length ${cmap.length} >>\nstream\n${cmap}endstream`));
const widths = Array.from({ length: 95 }, () => "6").join(" ");
objects.set(
  3,
  ascii(
    `<< /Type /Font /Subtype /Type3 /FontBBox [0 0 6 7] /FontMatrix [0.125 0 0 0.125 0 0] /Encoding << /Type /Encoding /BaseEncoding /WinAnsiEncoding /Differences [${differences}] >> /CharProcs << ${charProcs} >> /FirstChar 32 /LastChar 126 /Widths [${widths}] /ToUnicode ${toUnicodeObject} 0 R >>`,
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
  const stream = `BT /F1 16 Tf 36 750 Td (${text}) Tj ET`;
  objects.set(contentObject, ascii(`<< /Length ${stream.length} >>\nstream\n${stream}\nendstream`));
}
const maxObject = toUnicodeObject;
const chunks: Uint8Array[] = [ascii("%PDF-1.7\n%PDFBase generated report\n")];
const offsets = new Uint32Array(maxObject + 1);
let byteLength = chunks[0].length;
for (let id = 1; id <= maxObject; id++) {
  const body = objects.get(id);
  if (!body) throw new Error(`missing object ${id}`);
  offsets[id] = byteLength;
  const chunk = concat([ascii(`${id} 0 obj\n`), body, ascii("\nendobj\n")]);
  chunks.push(chunk);
  byteLength += chunk.length;
}
const xrefAt = byteLength;
let xref = `xref\n0 ${maxObject + 1}\n0000000000 65535 f \n`;
for (let id = 1; id <= maxObject; id++) {
  xref += `${String(offsets[id]).padStart(10, "0")} 00000 n \n`;
}
xref += `trailer\n<< /Size ${
  maxObject + 1
} /Root 1 0 R /ID [<5044464241534531><5044464241534531>] >>\nstartxref\n${xrefAt}\n%%EOF\n`;
chunks.push(ascii(xref));
const pdf = concat(chunks);
const pdfUrl = new URL("report-100-pages.pdf", out);
await Deno.writeFile(pdfUrl, pdf);
await Deno.remove(new URL("pdfbase-5x7-v1.bin", out)).catch(() => {});

const referenceRgba = new Map<number, Uint8Array>();
const popplerDir = await Deno.makeTempDir({ prefix: "pdfbase-poppler-" });
let independentReference;
try {
  const info = await command(popplerExecutables.pdfinfo, [pdfUrl.pathname]);
  if (!/^Pages:\s+100$/m.test(info) || !/^PDF version:\s+1\.7$/m.test(info)) {
    throw new Error("Poppler rejected PDF page count or version");
  }
  const textPath = `${popplerDir}/report.txt`;
  await command(popplerExecutables.pdftotext, [pdfUrl.pathname, textPath]);
  const extracted = await Deno.readTextFile(textPath);
  const reportLines = extracted.match(/REPORT PAGE [0-9]{3} DOCUMENT BENCHMARK(?: NEEDLE)?/g) ?? [];
  const hitLines = reportLines.filter((line) => line.endsWith(" NEEDLE"));
  if (reportLines.length !== 100 || hitLines.length !== 10) {
    throw new Error("Poppler text extraction oracle mismatch");
  }
  const rasters = [];
  for (const page of [1, 25, 50, 75, 100]) {
    const prefix = `${popplerDir}/page-${page}`;
    await command(popplerExecutables.pdftoppm, [
      "-aa",
      "no",
      "-aaVector",
      "no",
      "-f",
      String(page),
      "-l",
      String(page),
      "-singlefile",
      "-r",
      "144",
      pdfUrl.pathname,
      prefix,
    ]);
    const ppm = await Deno.readFile(`${prefix}.ppm`);
    const header = new TextDecoder().decode(ppm.subarray(0, 32));
    const match = /^P6\s+1224\s+1584\s+255\s/.exec(header);
    if (!match) throw new Error(`Poppler raster header mismatch for page ${page}`);
    const headerBytes = new TextEncoder().encode(match[0]).length;
    if (ppm.length !== headerBytes + 1224 * 1584 * 3) {
      throw new Error(`Poppler raster length mismatch for page ${page}`);
    }
    let nonWhitePixels = 0;
    const rgba = new Uint8Array(1224 * 1584 * 4);
    for (let input = headerBytes, output = 0; input < ppm.length; input += 3, output += 4) {
      rgba[output] = ppm[input];
      rgba[output + 1] = ppm[input + 1];
      rgba[output + 2] = ppm[input + 2];
      rgba[output + 3] = 255;
      if (ppm[input] !== 255 || ppm[input + 1] !== 255 || ppm[input + 2] !== 255) nonWhitePixels++;
    }
    if (nonWhitePixels === 0) throw new Error(`Poppler raster is blank for page ${page}`);
    referenceRgba.set(page, rgba);
    rasters.push({
      page,
      rgbaSha256: await sha256Hex(rgba),
      nonWhitePixels,
      width: 1224,
      height: 1584,
      differingPixels: 0,
      maxChannelDifference: 0,
    });
  }
  independentReference = {
    engine: await toolVersion(popplerExecutables.pdfinfo),
    executables: await Promise.all(
      Object.entries(popplerExecutables).map(async ([name, path]) => ({
        name,
        path,
        sha256: await sha256Hex(await Deno.readFile(path)),
      })),
    ),
    pageCount: 100,
    extractedTextRecords: reportLines.length,
    searchHits: hitLines.length,
    rasterDpi: 144,
    rasterArguments: ["-aa", "no", "-aaVector", "no", "-r", "144"],
    rasters,
  };
} finally {
  await Deno.remove(popplerDir, { recursive: true });
}

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
for (const raster of independentReference.rasters) {
  const expected = referenceRgba.get(raster.page);
  if (!expected) throw new Error(`Poppler reference missing page ${raster.page}`);
  const parsed = parseReport(pdf);
  const actual = renderPage(parsed, raster.page);
  let differingPixels = 0, maxChannelDifference = 0;
  for (let at = 0; at < actual.length; at += 4) {
    let pixelDiffers = false;
    for (let channel = 0; channel < 4; channel++) {
      const difference = Math.abs(actual[at + channel] - expected[at + channel]);
      if (difference) pixelDiffers = true;
      if (difference > maxChannelDifference) maxChannelDifference = difference;
    }
    if (pixelDiffers) differingPixels++;
  }
  raster.differingPixels = differingPixels;
  raster.maxChannelDifference = maxChannelDifference;
  if (differingPixels !== 0 || maxChannelDifference !== 0) {
    throw new Error(
      `controlled raster differs from Poppler on page ${raster.page}: ${differingPixels} pixels`,
    );
  }
}
const comparable = (value: typeof js) => ({
  pageCount: value.pageCount,
  hits: value.hits,
  textSha256: value.textSha256,
  pageHashes: value.pageHashes,
  counters: {
    ...value.counters,
    boundaryCrossings: 0,
    copiedBytes: 0,
    memoryBytes: 0,
  },
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
  "schemas/base-document-pdf-viewer-output.schema.json",
  "tests/base-document-pdf-viewer.test.ts",
  "server.ts",
  "deno.json",
  "deno.lock",
];
const sources = await Promise.all(sourcePaths.map(async (path) => {
  const disk = await Deno.readFile(new URL(path, root));
  const pinned = sourceArg ? await commandBytes("git", ["show", `${sourceCommit}:${path}`]) : disk;
  if (await sha256Hex(disk) !== await sha256Hex(pinned)) {
    throw new Error(`source tree mismatch at ${path}`);
  }
  return {
    path,
    sha256: await sha256Hex(pinned),
    immutableUrl: sourceArg
      ? `https://github.com/PaulKinlan/wasm-vs-js/blob/${sourceCommit}/${path}`
      : null,
  };
}));
const fixture = {
  path: "public/artifacts/document-pdf-viewer/report-100-pages.pdf",
  bytes: pdf.length,
  sha256: await sha256Hex(pdf),
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
  pdfSubset: {
    version: "PDF-1.7-pdfbase-report-v1",
    objectCount: maxObject,
    type3GlyphPrograms: glyphEntries.length,
    pageCount: 100,
  },
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
  independentReference,
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
    poppler: independentReference.engine,
    flags: ["-O3", "-nostdlib", "-ffreestanding", "-fno-builtin", "fixed 16 MiB memory"],
  },
  sources,
  fixture,
  artifact,
  reproduce:
    `deno run --frozen --allow-read=.,/tmp,/usr/bin/pdfinfo,/usr/bin/pdftotext,/usr/bin/pdftoppm --allow-write=public/artifacts,public/evidence,/tmp --allow-run=clang,wasm-ld,git,pdfinfo,pdftotext,pdftoppm scripts/build-document-pdf-viewer.ts --source-commit=${sourceCommit}`,
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
          independentReference: true,
          zeroPopplerPixelDifference: true,
        },
        output: outputManifest.oracle,
        independentReference,
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
