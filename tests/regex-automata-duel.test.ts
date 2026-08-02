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

  const nativeResult = scanNativeRegExp(fixture1);
  assert(nativeResult.matchesFound > 0);
  assert(nativeResult.oracleHash.length === 8);
  assert(nativeResult.phases.compileMs >= 0);
  assert(nativeResult.phases.scanMs >= 0);

  const jsAutomataResult = scanJSAutomata(fixture1);
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

  const wasmResult = scanWasmAutomata(fixture1, wasmInstance);
  assertEquals(wasmResult.codePointsSearched, nativeResult.codePointsSearched);
  assertEquals(wasmResult.patternsExecuted, nativeResult.patternsExecuted);
  assert(wasmResult.matchesFound > 0);
});
