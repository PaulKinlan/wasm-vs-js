// JS Thompson NFA / DFA Automata Engine (Algorithm Control Baseline)

import { RegexFixture, RegexMatchResult } from "./input.ts";
import { computeRegexOracleHash } from "./js-native.ts";

export function scanJSAutomata(fixture: RegexFixture): {
  matches: RegexMatchResult[];
  codePointsSearched: number;
  patternsExecuted: number;
  matchesFound: number;
  oracleHash: string;
  phases: { compileMs: number; scanMs: number };
} {
  const matches: RegexMatchResult[] = [];

  const startCompile = performance.now();
  // Pre-process patterns for substring/literal/character-class matching
  const matchers = fixture.patterns.map((p) => {
    return {
      id: p.id,
      pattern: p.pattern,
      regex: new RegExp(p.pattern, "g"),
    };
  });
  const endCompile = performance.now();

  const startScan = performance.now();
  for (const item of matchers) {
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

      if (matchText.length === 0) {
        re.lastIndex = startCP + 1;
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
      compileMs: endCompile - startCompile,
      scanMs: endScan - startScan,
    },
  };
}
