// Native JS RegExp Search Engine

import { RegexFixture, RegexMatchResult } from "./input.ts";

export interface RegexScanResult {
  matches: RegexMatchResult[];
  codePointsSearched: number;
  patternsExecuted: number;
  matchesFound: number;
  capturesExtracted: number;
  oracleHash: string;
  phases: {
    compileMs: number;
    scanMs: number;
  };
}

export function scanNativeRegExp(fixture: RegexFixture): RegexScanResult {
  const matches: RegexMatchResult[] = [];
  let capturesExtracted = 0;

  const startCompile = performance.now();
  const compiledRegexes = fixture.patterns.map((p) => ({
    id: p.id,
    regex: new RegExp(p.pattern, "g"),
  }));
  const endCompile = performance.now();

  const startScan = performance.now();
  for (const item of compiledRegexes) {
    const re = item.regex;
    re.lastIndex = 0;
    let match: RegExpExecArray | null;

    while ((match = re.exec(fixture.text)) !== null) {
      const startCP = match.index;
      const matchText = match[0];
      const endCP = startCP + matchText.length;

      matches.push({
        patternId: item.id,
        startCP,
        endCP,
        matchText,
      });

      if (match.length > 1) {
        capturesExtracted += match.length - 1;
      }

      // Empty-match advancement rule: advance lastIndex by 1 code point if zero-width match
      if (matchText.length === 0) {
        re.lastIndex = startCP + 1;
      }
    }
  }
  const endScan = performance.now();

  const oracleHash = computeRegexOracleHash(matches);

  return {
    matches,
    codePointsSearched: fixture.textCodePoints,
    patternsExecuted: fixture.patterns.length,
    matchesFound: matches.length,
    capturesExtracted,
    oracleHash,
    phases: {
      compileMs: endCompile - startCompile,
      scanMs: endScan - startScan,
    },
  };
}

export function computeRegexOracleHash(matches: RegexMatchResult[]): string {
  // Compute deterministic string digest over ordered (patternId, startCP, endCP, matchText)
  let str = "";
  for (let i = 0; i < matches.length; i++) {
    const m = matches[i];
    str += `${m.patternId}:${m.startCP}:${m.endCP}:${m.matchText.length};`;
  }

  // Simple fast hash algorithm (FNV-1a 32-bit hex string)
  let hash = 0x811c9dc5;
  for (let i = 0; i < str.length; i++) {
    hash ^= str.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return (hash >>> 0).toString(16).padStart(8, "0");
}
