import { sha256Hex } from "../lib/canonical.ts";
import { generateFixture } from "../benchmarks/base/cad-parametric-bracket/fixture.js";
import {
  assertEquivalent,
  instantiateBracketWasm,
  runJavaScript,
  runWasm,
} from "../benchmarks/base/cad-parametric-bracket/engine.js";

const PINNED_TOOLCHAIN = {
  deno: "2.9.0",
  clang: "clang version 22.1.8",
  linker: "LLD 22.1.8",
};
const EXPECTED = {
  fixture: "69db74cd284702632eb67d52fc6f00c18a101afc8c671badb6097a7921e74922",
  wasm: "82166df411845eeb1014b3c42e0751276c2d77815383ea5ed55a572ed4ab2ff1",
  output: "a1b9fe34b51782221b30aadd54b36aa6a45ba38846d6b44cca2669b75993b39f",
  digest: "d60fbade9eff2ffb",
};

if (Deno.version.deno !== PINNED_TOOLCHAIN.deno) {
  throw new Error(`${PINNED_TOOLCHAIN.deno} required, found Deno ${Deno.version.deno}`);
}

const root = new URL("../", import.meta.url);
const outputDir = new URL("reproduced/base-cad-parametric-bracket/", root);
const buildDir = new URL(".build/", outputDir);
const decoder = new TextDecoder();

async function command(name: string, args: string[]): Promise<Uint8Array> {
  const result = await new Deno.Command(name, {
    args,
    cwd: root.pathname,
    stdout: "piped",
    stderr: "piped",
  }).output();
  if (!result.success) throw new Error(decoder.decode(result.stderr));
  return result.stdout;
}

const clang = decoder.decode(await command("clang", ["--version"])).split("\n")[0];
const linker = decoder.decode(await command("wasm-ld", ["--version"])).trim();
if (clang !== PINNED_TOOLCHAIN.clang || linker !== PINNED_TOOLCHAIN.linker) {
  throw new Error(
    `pinned toolchain required: ${PINNED_TOOLCHAIN.clang}, ${PINNED_TOOLCHAIN.linker}; ` +
      `found ${clang}, ${linker}`,
  );
}

await Deno.remove(outputDir, { recursive: true }).catch(() => {});
await Deno.mkdir(buildDir, { recursive: true });
try {
  await command("clang", [
    "--target=wasm32-unknown-unknown",
    "-O3",
    "-nostdlib",
    "-ffreestanding",
    "-fno-builtin",
    "-ffp-contract=off",
    "-c",
    "benchmarks/base/cad-parametric-bracket/bracket.c",
    "-o",
    `${buildDir.pathname}bracket.o`,
  ]);
  await command("wasm-ld", [
    "--no-entry",
    "--export-memory",
    "--export=input_ptr",
    "--export=output_ptr",
    "--export=run",
    "--initial-memory=8388608",
    "--max-memory=8388608",
    "--stack-first",
    `${buildDir.pathname}bracket.o`,
    "-o",
    `${buildDir.pathname}bracket.wasm`,
  ]);
  await Deno.writeFile(
    new URL("bracket.wasm", outputDir),
    await Deno.readFile(new URL("bracket.wasm", buildDir)),
  );
} finally {
  await Deno.remove(buildDir, { recursive: true });
}

const fixture = generateFixture();
const js = runJavaScript(fixture);
const wasmBytes = await Deno.readFile(new URL("bracket.wasm", outputDir));
const wasm = runWasm(await instantiateBracketWasm(wasmBytes), fixture);
const equivalence = assertEquivalent(js, wasm);
if (!equivalence.exactBytes || equivalence.completeOutputDigest !== EXPECTED.digest) {
  throw new Error("cross-target output equivalence failed");
}

await Deno.writeFile(new URL("fixture.bin", outputDir), fixture);
await Deno.writeFile(new URL("reference-output.bin", outputDir), js.output);
const hashes = {
  fixture: await sha256Hex(fixture),
  wasm: await sha256Hex(wasmBytes),
  output: await sha256Hex(js.output),
};
for (const key of ["fixture", "wasm", "output"] as const) {
  if (hashes[key] !== EXPECTED[key]) {
    throw new Error(`${key} hash mismatch: expected ${EXPECTED[key]}, found ${hashes[key]}`);
  }
}

console.log(
  JSON.stringify({
    workloadId: "cad.parametric-bracket.v1",
    toolchain: PINNED_TOOLCHAIN,
    hashes,
    completeOutputDigest: equivalence.completeOutputDigest,
    exactCrossTargetBytes: equivalence.exactBytes,
  }),
);
