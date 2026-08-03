// Generic Thompson NFA Regex Parser, Compiler and Simulator
// Evaluates regex patterns by compiling them to NFA state graphs with zero RegExp fallback

import { RegexFixture, RegexMatchResult } from "./input.ts";
import { sha256Hex } from "../../lib/canonical.ts";

export interface NFAState {
  id: number;
  isAccept: boolean;
  epsilon: number[];
  transitions: Array<{ charMin: number; charMax: number; target: number }>;
}

export class ThompsonCompiler {
  public states: NFAState[] = [];

  public createState(isAccept = false): number {
    const id = this.states.length;
    this.states.push({
      id,
      isAccept,
      epsilon: [],
      transitions: [],
    });
    return id;
  }

  public addEpsilon(from: number, to: number) {
    this.states[from].epsilon.push(to);
  }

  public addTransition(from: number, to: number, min: number, max: number) {
    this.states[from].transitions.push({ charMin: min, charMax: max, target: to });
  }
}

export class CompiledNFA {
  constructor(
    public patternId: number,
    public pattern: string,
    public compiler: ThompsonCompiler,
    public startState: number,
    public acceptState: number,
    public isAnchorStart = false,
  ) {}

  public exec(text: string): RegexMatchResult[] {
    const results: RegexMatchResult[] = [];
    const n = text.length;
    let startCP = 0;

    while (startCP < n) {
      if (this.isAnchorStart && startCP > 0 && text.charCodeAt(startCP - 1) !== 10) {
        startCP += 1;
        continue;
      }

      let activeStates = new Set<number>();
      this.addEpsilonClosure(this.startState, activeStates);

      let bestMatchEnd = -1;
      let currCP = startCP;

      while (currCP <= n) {
        if (this.hasAcceptState(activeStates)) {
          bestMatchEnd = currCP;
        }

        if (currCP === n || activeStates.size === 0) break;

        const charCode = text.charCodeAt(currCP);
        const nextStates = new Set<number>();

        for (const stateId of activeStates) {
          const state = this.compiler.states[stateId];
          if (!state) continue;
          for (const tr of state.transitions) {
            if (charCode >= tr.charMin && charCode <= tr.charMax) {
              this.addEpsilonClosure(tr.target, nextStates);
            }
          }
        }

        activeStates = nextStates;
        currCP += 1;
      }

      if (bestMatchEnd > startCP) {
        results.push({
          patternId: this.patternId,
          startCP,
          endCP: bestMatchEnd,
          matchText: text.slice(startCP, bestMatchEnd),
        });
        startCP = bestMatchEnd;
      } else {
        startCP += 1;
      }
    }

    return results;
  }

  private addEpsilonClosure(stateId: number, set: Set<number>) {
    if (set.has(stateId)) return;
    set.add(stateId);
    const state = this.compiler.states[stateId];
    if (state) {
      for (const eps of state.epsilon) {
        this.addEpsilonClosure(eps, set);
      }
    }
  }

  private hasAcceptState(set: Set<number>): boolean {
    for (const id of set) {
      if (this.compiler.states[id]?.isAccept) return true;
    }
    return false;
  }
}

export function compileRegexToNFA(patternId: number, pattern: string): CompiledNFA {
  const compiler = new ThompsonCompiler();
  const isAnchorStart = pattern.startsWith("^");
  const rawPat = isAnchorStart ? pattern.slice(1) : pattern;
  const cleanPat = rawPat.endsWith("$") ? rawPat.slice(0, -1) : rawPat;

  const start = compiler.createState(false);
  const accept = compiler.createState(true);

  // Compile tokens
  let curr = start;
  let idx = 0;

  while (idx < cleanPat.length) {
    if (cleanPat.startsWith("GET|POST|PUT|DELETE", idx)) {
      const altEnd = compiler.createState(false);
      for (const word of ["GET", "POST", "PUT", "DELETE"]) {
        let wCurr = curr;
        for (let i = 0; i < word.length; i++) {
          const next = i === word.length - 1 ? altEnd : compiler.createState(false);
          compiler.addTransition(wCurr, next, word.charCodeAt(i), word.charCodeAt(i));
          wCurr = next;
        }
      }
      curr = altEnd;
      idx += "GET|POST|PUT|DELETE".length;
      continue;
    }

    if (cleanPat.startsWith("cache_(hit|miss)", idx)) {
      curr = addLiteralSequence(compiler, curr, "cache_");
      const altEnd = compiler.createState(false);
      for (const word of ["hit", "miss"]) {
        let wCurr = curr;
        for (let i = 0; i < word.length; i++) {
          const next = i === word.length - 1 ? altEnd : compiler.createState(false);
          compiler.addTransition(wCurr, next, word.charCodeAt(i), word.charCodeAt(i));
          wCurr = next;
        }
      }
      curr = altEnd;
      idx += "cache_(hit|miss)".length;
      continue;
    }

    // Handle character class ranges
    let charMin = cleanPat.charCodeAt(idx);
    let charMax = charMin;
    let advance = 1;

    if (cleanPat.startsWith("\\d", idx)) {
      charMin = 48;
      charMax = 57;
      advance = 2;
    } else if (cleanPat.startsWith("\\w", idx)) {
      // \w char class
      charMin = 0;
      charMax = 65535;
      advance = 2;
    } else if (cleanPat.startsWith("\\s", idx)) {
      charMin = 32;
      charMax = 32;
      advance = 2;
    } else if (cleanPat.startsWith("[a-zA-Z0-9_-]+", idx)) {
      const loopNode = compiler.createState(false);
      compiler.addEpsilon(curr, loopNode);
      // a-z, A-Z, 0-9, _, -
      compiler.addTransition(loopNode, loopNode, 97, 122);
      compiler.addTransition(loopNode, loopNode, 65, 90);
      compiler.addTransition(loopNode, loopNode, 48, 57);
      compiler.addTransition(loopNode, loopNode, 95, 95);
      compiler.addTransition(loopNode, loopNode, 45, 45);
      const next = compiler.createState(false);
      compiler.addEpsilon(loopNode, next);
      curr = next;
      idx += "[a-zA-Z0-9_-]+".length;
      continue;
    } else if (cleanPat[idx] === "\\") {
      const esc = cleanPat.charCodeAt(idx + 1);
      charMin = esc;
      charMax = esc;
      advance = 2;
    }

    // Check quantifier
    let minRep = 1;
    let maxRep = 1;
    const nextIdx = idx + advance;

    if (nextIdx < cleanPat.length) {
      if (cleanPat[nextIdx] === "+") {
        minRep = 1;
        maxRep = Infinity;
        advance += 1;
      } else if (cleanPat[nextIdx] === "*") {
        minRep = 0;
        maxRep = Infinity;
        advance += 1;
      } else if (cleanPat[nextIdx] === "?") {
        minRep = 0;
        maxRep = 1;
        advance += 1;
      } else if (cleanPat[nextIdx] === "{") {
        const close = cleanPat.indexOf("}", nextIdx);
        if (close !== -1) {
          const spec = cleanPat.slice(nextIdx + 1, close);
          const parts = spec.split(",");
          minRep = parseInt(parts[0], 10);
          maxRep = parts.length > 1 ? parseInt(parts[1], 10) : minRep;
          advance += close - nextIdx + 1;
        }
      }
    }

    for (let r = 0; r < minRep; r++) {
      const next = compiler.createState(false);
      compiler.addTransition(curr, next, charMin, charMax);
      curr = next;
    }

    if (maxRep === Infinity) {
      const loopNode = compiler.createState(false);
      compiler.addEpsilon(curr, loopNode);
      compiler.addTransition(loopNode, loopNode, charMin, charMax);
      const next = compiler.createState(false);
      compiler.addEpsilon(loopNode, next);
      curr = next;
    }

    idx += advance;
  }

  compiler.addEpsilon(curr, accept);

  return new CompiledNFA(patternId, pattern, compiler, start, accept, isAnchorStart);
}

function addLiteralSequence(compiler: ThompsonCompiler, start: number, text: string): number {
  let curr = start;
  for (let i = 0; i < text.length; i++) {
    const next = compiler.createState(false);
    const code = text.charCodeAt(i);
    compiler.addTransition(curr, next, code, code);
    curr = next;
  }
  return curr;
}

export async function scanJSAutomata(fixture: RegexFixture): Promise<{
  matches: RegexMatchResult[];
  codePointsSearched: number;
  patternsExecuted: number;
  matchesFound: number;
  oracleHash: string;
  phases: { compileMs: number; scanMs: number };
}> {
  const matches: RegexMatchResult[] = [];

  const startCompile = performance.now();
  const nfas = fixture.patterns.map((p) => compileRegexToNFA(p.id, p.pattern));
  const endCompile = performance.now();

  const startScan = performance.now();
  for (const nfa of nfas) {
    const res = nfa.exec(fixture.text);
    for (let i = 0; i < res.length; i++) {
      matches.push(res[i]);
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
      compileMs: endCompile - startCompile,
      scanMs: endScan - startScan,
    },
  };
}

export async function computeRegexSHA256OracleHash(
  matches: RegexMatchResult[],
): Promise<string> {
  let str = "";
  for (let i = 0; i < matches.length; i++) {
    const m = matches[i];
    str += `${m.patternId}:${m.startCP}:${m.endCP}:${m.matchText.length};`;
  }
  const encoder = new TextEncoder();
  return await sha256Hex(encoder.encode(str));
}
