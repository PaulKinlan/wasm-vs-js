// Native JS RegExp Search Engine

import { RegexFixture, RegexMatchResult } from "./input.ts";
import { computeRegexSHA256OracleHash } from "./js-automata.ts";

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

export async function scanNativeRegExp(fixture: RegexFixture): Promise<RegexScanResult> {
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

  const oracleHash = await computeRegexSHA256OracleHash(matches);

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
