import { assert, assertEquals } from "./assert.ts";
import {
  FROZEN_REGEX_PATTERNS,
  generateRegexFixture,
  type RegexFixture,
} from "../benchmarks/regex-automata-duel/input.ts";
import {
  scanJSAutomata,
  scanNativeRegExp,
  scanWasmAutomata,
} from "../benchmarks/regex-automata-duel/workload.js";
import wabtFactory from "wabt";

async function compileRegexWasm(): Promise<WebAssembly.Instance> {
  const wat = await Deno.readTextFile("benchmarks/regex-automata-duel/regex-automata.wat");
  const wabt = await wabtFactory();
  const module = wabt.parseWat("regex-automata.wat", wat, {});
  const binary = module.toBinary({ canonicalize_lebs: true });
  module.destroy();
  return await WebAssembly.instantiate(
    await WebAssembly.compile(new Uint8Array(binary.buffer)),
    {},
  );
}

function patternFixture(pattern: string, text: string): RegexFixture {
  return {
    seed: 0,
    text,
    textCodePoints: text.length,
    patterns: [{ id: 0, pattern, isLiteral: false, description: "adversarial semantics" }],
    textBuffer: new TextEncoder().encode(text),
  };
}

function onePatternFixture(patternId: number, text: string): RegexFixture {
  return {
    seed: 0,
    text,
    textCodePoints: text.length,
    patterns: [FROZEN_REGEX_PATTERNS[patternId]],
    textBuffer: new TextEncoder().encode(text),
  };
}

async function assertThreeWay(fixture: RegexFixture, wasm: WebAssembly.Instance) {
  const native = await scanNativeRegExp(fixture);
  const js = await scanJSAutomata(fixture);
  const wasmResult = await scanWasmAutomata(fixture, wasm);
  assertEquals(js.matches, native.matches);
  assertEquals(wasmResult.matches, native.matches);
  assertEquals(js.oracleHash, native.oracleHash);
  assertEquals(wasmResult.oracleHash, native.oracleHash);
  assertEquals(js.matchesFound, native.matchesFound);
  assertEquals(wasmResult.matchesFound, native.matchesFound);
  assertEquals(js.capturesExtracted, native.capturesExtracted);
  assertEquals(wasmResult.capturesExtracted, native.capturesExtracted);
  assertEquals(js.patternsExecuted, fixture.patterns.length);
  assertEquals(wasmResult.patternsExecuted, fixture.patterns.length);
  const expectedCodePoints = fixture.textCodePoints * fixture.patterns.length;
  assertEquals(native.codePointsSearched, expectedCodePoints);
  assertEquals(js.codePointsSearched, expectedCodePoints);
  assertEquals(wasmResult.codePointsSearched, expectedCodePoints);
  assertEquals(js.boundaryCrossings, 0);
  assertEquals(wasmResult.boundaryCrossings, fixture.patterns.length);
  for (const result of [native, js, wasmResult]) {
    assert(result.phases.compileMs >= 0);
    assert(result.phases.scanMs >= 0);
  }
}

Deno.test("regex-automata-duel: frozen 1 MiB oracle and all counters are exactly equivalent", async () => {
  const fixture1 = generateRegexFixture();
  const fixture2 = generateRegexFixture();
  assertEquals(fixture1.textCodePoints, 1048576);
  assertEquals(fixture1.patterns.length, 20);
  assertEquals(fixture1.textBuffer, fixture2.textBuffer);
  await assertThreeWay(fixture1, await compileRegexWasm());
});

Deno.test("regex-automata-duel: every common-subset construct executes in JS NFA and Wasm automata", async () => {
  const examples = [
    "error",
    "HTTP/1.1",
    "DELETE",
    "Az_9-",
    "255.1.20.003",
    "a_b@c9.example",
    "https://a-b.example",
    "GET /resource HTTP/1.1",
    "00:1a:2b:3c:4d:5e",
    "[2026-08-03T04:05:06]",
    "status=404",
    "user_12345678",
    "session-0123456789abcdef",
    "latency_123ms",
    "ip_192_168_1_10",
    "token_0123456789abcdefghijklmnopqrstuv",
    "cache_miss",
    "retry_12",
    "version_v12.3.456",
    "build_20260803",
  ];
  const wasm = await compileRegexWasm();
  for (let patternId = 0; patternId < examples.length; patternId++) {
    const fixture = onePatternFixture(patternId, examples[patternId]);
    await assertThreeWay(fixture, wasm);
    assert((await scanWasmAutomata(fixture, wasm)).matchesFound > 0);
  }
});

Deno.test("regex-automata-duel: adversarial anchors, classes, bounds, and case semantics", async () => {
  const wasm = await compileRegexWasm();
  const cases = [
    onePatternFixture(7, "prefix\nGET /x HTTP/1.1"), // no implicit multiline flag
    onePatternFixture(8, "AA:BB:CC:DD:EE:FF"), // lowercase class is case-sensitive
    onePatternFixture(12, "session-ABCDEF0123456789"),
    onePatternFixture(15, "token_0123456789abcde_ghijklmnopqrstuv"), // underscore excluded
    onePatternFixture(11, "user_123456789"), // greedy upper bound is exactly eight
    onePatternFixture(5, "under_score@word_2.tld"), // JS \w includes underscore
  ];
  for (const fixture of cases) await assertThreeWay(fixture, wasm);
});

Deno.test("regex-automata-duel: ordered leftmost-first alternation matches native RegExp", async () => {
  const wasm = await compileRegexWasm();
  const cases = [
    { pattern: "a|ab", text: "ab", expected: "a" },
    { pattern: "ab|a", text: "ab", expected: "ab" },
    { pattern: "a+", text: "aaab", expected: "aaa" },
    { pattern: "(a|ab)c", text: "abc", expected: "abc" },
  ];
  for (const { pattern, text, expected } of cases) {
    const fixture = patternFixture(pattern, text);
    await assertThreeWay(fixture, wasm);
    assertEquals((await scanJSAutomata(fixture)).matches[0]?.matchText, expected);
    assertEquals((await scanWasmAutomata(fixture, wasm)).matches[0]?.matchText, expected);
  }
});

Deno.test("regex-automata-duel: source inspectability contract metadata", async () => {
  const manifest = JSON.parse(
    await Deno.readTextFile("public/artifacts/regex-automata-duel/build-manifest.json"),
  );
  assert(manifest.inspectability !== undefined);
  assertEquals(
    manifest.inspectability.commitPermalinkTemplate,
    "https://github.com/PaulKinlan/wasm-vs-js/tree/{commit}",
  );
  assertEquals(
    manifest.inspectability.executedJsSource.path,
    "benchmarks/regex-automata-duel/workload.js",
  );
  assertEquals(
    manifest.inspectability.authoredWasmSource.path,
    "benchmarks/regex-automata-duel/regex-automata.wat",
  );
  assertEquals(
    manifest.inspectability.compiledArtifact.downloadRoute,
    "/artifacts/regex-automata-duel/regex-automata-duel.wasm",
  );
  assertEquals(
    manifest.inspectability.buildRecipe.command,
    "deno run --allow-read=. --allow-write=public/artifacts scripts/build-traditional-web.ts",
  );
});
