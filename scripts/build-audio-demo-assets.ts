// Build browser-servable JavaScript modules for the audio demo routes from
// the EXACT repository engine sources. Nothing is hand-copied: every emitted
// file is a deterministic TypeScript-strip of the source module, and the
// emitted manifest records source path, source hash, output path, and output
// hash so the provenance chain is machine-checkable (tests/audio-demo.test.ts
// rebuilds and requires byte-identical output).

// The transpiler is loaded through a non-literal dynamic specifier with
// --no-lock so this build leaves deno.json and deno.lock byte-identical:
// the frozen M1 build-manifest pins the exact lockfile hash, and `deno task
// check` must keep regenerating byte-identical artifacts. A literal npm:
// specifier would be resolved by `deno check` and rewrite the lock. The
// version pin lives in the specifier and the emitted manifest, and the
// reproducibility test requires byte-identical output across rebuilds.
const TYPESCRIPT_SPECIFIER = "npm:typescript@5.9.2";
interface Transpiler {
  transpileModule(
    source: string,
    options: { compilerOptions: Record<string, unknown>; fileName: string },
  ): { outputText: string };
  ScriptTarget: { ES2022: unknown };
  ModuleKind: { ES2022: unknown };
}
const { default: ts } = (await import(TYPESCRIPT_SPECIFIER)) as { default: Transpiler };

const ROOT = new URL("../", import.meta.url);
const OUTPUT_BASE = "public/demo-assets/audio";

// The closed module set the demo worker may execute. Order is fixed.
const MODULES = [
  "benchmarks/audio-fft/workload.ts",
  "benchmarks/audio-fir/workload.ts",
  "benchmarks/audio-stft/workload.ts",
  "benchmarks/audio-shared/canonical.ts",
  "benchmarks/audio-shared/constants.ts",
  "benchmarks/audio-shared/oracle.ts",
  "lib/audio-workloads.ts",
] as const;

async function sha256Hex(bytes: Uint8Array): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", bytes.buffer as ArrayBuffer);
  return [...new Uint8Array(digest)].map((value) => value.toString(16).padStart(2, "0")).join("");
}

const encoder = new TextEncoder();

const files = [];
for (const sourcePath of MODULES) {
  const sourceBytes = await Deno.readFile(new URL(sourcePath, ROOT));
  const sourceText = new TextDecoder().decode(sourceBytes);
  const transpiled = ts.transpileModule(sourceText, {
    compilerOptions: {
      target: ts.ScriptTarget.ES2022,
      module: ts.ModuleKind.ES2022,
      removeComments: false,
    },
    fileName: sourcePath,
  }).outputText;
  // Rewrite relative .ts specifiers to the emitted .js names. All imports in
  // the module set are relative; fail closed on anything else.
  if (/from\s+["'](?!\.)/.test(transpiled)) {
    throw new Error(`${sourcePath}: non-relative import in demo module set`);
  }
  const outputText = transpiled.replace(
    /(from\s+["'][^"']+)\.ts(["'])/g,
    "$1.js$2",
  );
  if (/\.ts["']/.test(outputText)) {
    throw new Error(`${sourcePath}: unresolved .ts specifier after rewrite`);
  }
  const outputPath = `${OUTPUT_BASE}/${sourcePath.replace(/\.ts$/, ".js")}`;
  await Deno.mkdir(new URL(outputPath, ROOT).pathname.split("/").slice(0, -1).join("/"), {
    recursive: true,
  });
  await Deno.writeFile(new URL(outputPath, ROOT), encoder.encode(outputText));
  files.push({
    source: sourcePath,
    sourceSha256: await sha256Hex(sourceBytes),
    output: outputPath,
    outputSha256: "",
    bytes: 0,
  });
}

// Format the emitted modules with the same toolchain that gates the repo so
// `deno fmt --check` stays green and rebuilds remain byte-stable. Hash the
// FORMATTED bytes so the manifest matches what is committed.
const fmt = new Deno.Command(Deno.execPath(), {
  args: ["fmt", `${OUTPUT_BASE}/`],
  cwd: new URL(".", ROOT).pathname,
  stdout: "piped",
  stderr: "piped",
}).outputSync();
if (!fmt.success) {
  throw new Error(`deno fmt on demo assets failed: ${new TextDecoder().decode(fmt.stderr)}`);
}
for (const file of files) {
  const formatted = await Deno.readFile(new URL(file.output, ROOT));
  file.outputSha256 = await sha256Hex(formatted);
  file.bytes = formatted.byteLength;
}

const manifest = {
  schemaVersion: 1,
  contractId: "audio-demo-assets-manifest-v1",
  generator: "scripts/build-audio-demo-assets.ts",
  typescript: "5.9.2",
  moduleCount: files.length,
  files,
};
const manifestText = JSON.stringify(manifest, null, 2) + "\n";
await Deno.writeFile(new URL(`${OUTPUT_BASE}/manifest.json`, ROOT), encoder.encode(manifestText));
console.log(`audio demo assets: ${files.length} modules transpiled`);
