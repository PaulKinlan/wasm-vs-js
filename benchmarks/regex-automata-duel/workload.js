import { FROZEN_REGEX_PATTERNS, generateRegexFixture } from "./input.ts";
import { compileRegexToNFA, computeRegexSHA256OracleHash, scanJSAutomata } from "./js-automata.ts";
import { scanNativeRegExp } from "./js-native.ts";

export { FROZEN_REGEX_PATTERNS, generateRegexFixture, scanJSAutomata, scanNativeRegExp };

/** Execute every frozen pattern in WebAssembly. JS compiles Thompson NFAs and
 * determinizes them into portable tables; Wasm alone scans the corpus and emits
 * every match tuple. There is no native-RegExp or JS matching fallback. */
export async function scanWasmAutomata(fixture, wasmInstance) {
  const memory = wasmInstance.exports.memory;
  const scanDfa = wasmInstance.exports.scan_dfa;
  if (!(memory instanceof WebAssembly.Memory) || typeof scanDfa !== "function") {
    throw new Error("regex automata Wasm exports are incomplete");
  }

  const startCompile = performance.now();
  const automata = fixture.patterns.map((pattern) => {
    const nfa = compileRegexToNFA(pattern.id, pattern.pattern);
    return { nfa, dfa: nfa.toAsciiDFA() };
  });
  const endCompile = performance.now();

  const bytes = new Uint8Array(memory.buffer);
  const textPtr = 1024;
  bytes.set(fixture.textBuffer, textPtr);
  let cursor = (textPtr + fixture.textBuffer.byteLength + 7) & ~7;
  const matches = [];
  let capturesExtracted = 0;
  let boundaryCrossings = 0;

  const startScan = performance.now();
  for (const { nfa, dfa } of automata) {
    const tablePtr = cursor;
    new Int16Array(memory.buffer, tablePtr, dfa.transitions.length).set(dfa.transitions);
    cursor = (tablePtr + dfa.transitions.byteLength + 7) & ~7;
    const acceptPtr = cursor;
    bytes.set(dfa.accepting, acceptPtr);
    cursor = (acceptPtr + dfa.accepting.byteLength + 7) & ~7;
    const commitPtr = cursor;
    bytes.set(dfa.commitBefore, commitPtr);
    cursor = (commitPtr + dfa.commitBefore.byteLength + 7) & ~7;
    const outPtr = cursor;
    const outCapacity = Math.floor((memory.buffer.byteLength - outPtr) / 8);
    if (outCapacity <= 0) throw new Error("regex automata Wasm memory has no match capacity");

    const matchCount = scanDfa(
      textPtr,
      fixture.textBuffer.byteLength,
      tablePtr,
      acceptPtr,
      commitPtr,
      nfa.anchorStart ? 1 : 0,
      nfa.anchorEnd ? 1 : 0,
      outPtr,
      outCapacity,
    );
    boundaryCrossings++;
    if (matchCount > outCapacity) {
      throw new Error(`regex pattern ${nfa.patternId} exceeded bounded Wasm output capacity`);
    }
    const output = new DataView(memory.buffer, outPtr, matchCount * 8);
    for (let index = 0; index < matchCount; index++) {
      const startCP = output.getUint32(index * 8, true);
      const endCP = output.getUint32(index * 8 + 4, true);
      matches.push({
        patternId: nfa.patternId,
        startCP,
        endCP,
        matchText: fixture.text.slice(startCP, endCP),
      });
    }
    capturesExtracted += matchCount * nfa.captureGroups;
  }
  const endScan = performance.now();

  return {
    matches,
    codePointsSearched: fixture.textCodePoints * automata.length,
    patternsExecuted: automata.length,
    matchesFound: matches.length,
    capturesExtracted,
    boundaryCrossings,
    oracleHash: await computeRegexSHA256OracleHash(matches),
    phases: {
      compileMs: endCompile - startCompile,
      scanMs: endScan - startScan,
    },
  };
}
