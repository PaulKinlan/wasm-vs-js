import { assert, assertEquals } from "./assert.ts";
import { generateRegexFixture } from "../benchmarks/regex-automata-duel/input.ts";
import {
  scanJSAutomata,
  scanNativeRegExp,
  scanWasmAutomata,
} from "../benchmarks/regex-automata-duel/workload.js";
import wabtFactory from "wabt";

Deno.test("regex-automata-duel: corpus generation and engine duel correctness", async () => {
  const fixture1 = generateRegexFixture();
  const fixture2 = generateRegexFixture();

  assertEquals(fixture1.textCodePoints, 1048576);
  assertEquals(fixture1.patterns.length, 20);
  assertEquals(fixture1.textBuffer, fixture2.textBuffer);

  const nativeResult = await scanNativeRegExp(fixture1);
  assert(nativeResult.matchesFound > 0);
  assertEquals(nativeResult.oracleHash.length, 64); // Real 64-char SHA-256 hex string
  assert(nativeResult.phases.compileMs >= 0);
  assert(nativeResult.phases.scanMs >= 0);

  const jsAutomataResult = await scanJSAutomata(fixture1);
  assertEquals(jsAutomataResult.codePointsSearched, nativeResult.codePointsSearched);
  assertEquals(jsAutomataResult.patternsExecuted, nativeResult.patternsExecuted);
  assertEquals(jsAutomataResult.matchesFound, nativeResult.matchesFound);
  assertEquals(jsAutomataResult.oracleHash, nativeResult.oracleHash);

  // Compile Wasm module
  const wat = await Deno.readTextFile("benchmarks/regex-automata-duel/regex-automata.wat");
  const wabt = await wabtFactory();
  const module = wabt.parseWat("regex-automata.wat", wat, {});
  const binary = module.toBinary({ canonicalize_lebs: true });
  module.destroy();

  const wasmBytes = new Uint8Array(binary.buffer);
  const wasmModule = await WebAssembly.compile(wasmBytes);
  const wasmInstance = await WebAssembly.instantiate(wasmModule, {});

  const wasmResult = await scanWasmAutomata(fixture1, wasmInstance);
  assertEquals(wasmResult.codePointsSearched, nativeResult.codePointsSearched);
  assertEquals(wasmResult.patternsExecuted, nativeResult.patternsExecuted);
  assert(wasmResult.matchesFound > 0);
});

Deno.test("regex-automata-duel: source inspectability contract metadata", async () => {
  const manifestText = await Deno.readTextFile(
    "public/artifacts/regex-automata-duel/build-manifest.json",
  );
  const manifest = JSON.parse(manifestText);

  assert(manifest.inspectability !== undefined);
  assertEquals(
    manifest.inspectability.commitPermalinkTemplate,
    "https://github.com/PaulKinlan/wasm-vs-js/tree/{commit}",
  );
  assertEquals(
    manifest.inspectability.executedJsSource.path,
    "benchmarks/regex-automata-duel/workload.js",
  );
  assert(manifest.inspectability.executedJsSource.sha256.length === 64);
  assertEquals(
    manifest.inspectability.authoredWasmSource.path,
    "benchmarks/regex-automata-duel/regex-automata.wat",
  );
  assertEquals(manifest.inspectability.authoredWasmSource.language, "wat");
  assert(manifest.inspectability.authoredWasmSource.sha256.length === 64);
  assertEquals(
    manifest.inspectability.compiledArtifact.downloadRoute,
    "/artifacts/regex-automata-duel/regex-automata-duel.wasm",
  );
  assert(manifest.inspectability.buildRecipe.command === "deno task build");
});
