import { FROZEN_REGEX_PATTERNS, generateRegexFixture } from "./input.ts";
import { computeRegexOracleHash, scanNativeRegExp } from "./js-native.ts";
import { scanJSAutomata } from "./js-automata.ts";

export { FROZEN_REGEX_PATTERNS, generateRegexFixture, scanJSAutomata, scanNativeRegExp };

export function scanWasmAutomata(fixture, wasmInstance) {
  const memory = wasmInstance.exports.memory;
  const textPtr = 1024;

  // Copy text buffer into Wasm memory
  const memoryView = new Uint8Array(memory.buffer);
  memoryView.set(fixture.textBuffer, textPtr);

  const patPtr = textPtr + fixture.textBuffer.byteLength + 1024;
  const outPtr = patPtr + 1024;

  const matches = [];
  const encoder = new TextEncoder();

  const startScan = performance.now();
  for (const item of fixture.patterns) {
    if (item.isLiteral) {
      const patBytes = encoder.encode(item.pattern);
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
          patternId: item.id,
          startCP,
          endCP,
          matchText: item.pattern,
        });
      }
    } else {
      // Fallback for non-literal regex in hybrid execution
      const re = new RegExp(item.pattern, "g");
      let m;
      while ((m = re.exec(fixture.text)) !== null) {
        matches.push({
          patternId: item.id,
          startCP: m.index,
          endCP: m.index + m[0].length,
          matchText: m[0],
        });
        if (m[0].length === 0) re.lastIndex = m.index + 1;
      }
    }
  }
  const endScan = performance.now();

  return {
    matches,
    codePointsSearched: fixture.textCodePoints,
    patternsExecuted: fixture.patterns.length,
    matchesFound: matches.length,
    oracleHash: computeRegexOracleHash(matches),
    phases: {
      scanMs: endScan - startScan,
    },
  };
}
