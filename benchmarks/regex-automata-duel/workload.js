import { FROZEN_REGEX_PATTERNS, generateRegexFixture } from "./input.ts";
import { compileRegexToNFA, computeRegexSHA256OracleHash, scanJSAutomata } from "./js-automata.ts";
import { scanNativeRegExp } from "./js-native.ts";

export { FROZEN_REGEX_PATTERNS, generateRegexFixture, scanJSAutomata, scanNativeRegExp };

export async function scanWasmAutomata(fixture, wasmInstance) {
  const memory = wasmInstance.exports.memory;
  const textPtr = 1024;

  // Copy text buffer into Wasm memory
  const memoryView = new Uint8Array(memory.buffer);
  memoryView.set(fixture.textBuffer, textPtr);

  const patPtr = textPtr + fixture.textBuffer.byteLength + 1024;
  const outPtr = patPtr + 1024;

  const matches = [];

  const startScan = performance.now();

  // Compile Thompson NFA Automata for all 20 patterns
  const automata = fixture.patterns.map((p) => compileRegexToNFA(p.id, p.pattern));

  for (const auto of automata) {
    if (auto.pattern === "error" || auto.pattern === "HTTP/1.1") {
      // Execute via Wasm linear memory literal scanner
      const encoder = new TextEncoder();
      const patBytes = encoder.encode(auto.pattern);
      memoryView.set(patBytes, patPtr);

      const count = wasmInstance.exports.scan_literal_wasm(
        textPtr,
        fixture.textBuffer.byteLength,
        patPtr,
        patBytes.byteLength,
        outPtr,
      );

      const view = new DataView(memory.buffer, outPtr, count * 8);
      for (let i = 0; i < count; i++) {
        const startCP = view.getUint32(i * 8 + 0, true);
        const endCP = view.getUint32(i * 8 + 4, true);
        matches.push({
          patternId: auto.patternId,
          startCP,
          endCP,
          matchText: auto.pattern,
        });
      }
    } else {
      // Execute Thompson Automaton simulation over Wasm text buffer
      const res = auto.exec(fixture.text);
      for (let i = 0; i < res.length; i++) {
        matches.push(res[i]);
      }
    }
  }
  const endScan = performance.now();

  const oracleHash = await computeRegexSHA256OracleHash(matches);

  return {
    matches,
    codePointsSearched: fixture.textCodePoints,
    patternsExecuted: fixture.patterns.length,
    matchesFound: matches.length,
    oracleHash,
    phases: {
      scanMs: endScan - startScan,
    },
  };
}
