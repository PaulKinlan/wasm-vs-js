// Common-subset regular-expression parser, Thompson compiler, and NFA simulator.
// This module deliberately does not call RegExp; native RegExp is a separate variant.

import type { RegexFixture, RegexMatchResult } from "./input.ts";
import { sha256Hex } from "../../lib/canonical.ts";

interface CharRange {
  min: number;
  max: number;
}

type Ast =
  | { kind: "empty" }
  | { kind: "chars"; ranges: CharRange[] }
  | { kind: "concat"; parts: Ast[] }
  | { kind: "alt"; parts: Ast[] }
  | { kind: "repeat"; child: Ast; min: number; max: number | null };

export interface NFAState {
  epsilon: number[];
  transitions: Array<{ ranges: CharRange[]; target: number }>;
  accept: boolean;
}

export interface CompiledDFA {
  stateCount: number;
  startState: number;
  transitions: Int16Array;
  accepting: Uint8Array;
  commitBefore: Uint8Array;
}

const ASCII_WORD: CharRange[] = [
  { min: 48, max: 57 },
  { min: 65, max: 90 },
  { min: 95, max: 95 },
  { min: 97, max: 122 },
];
const JS_WHITESPACE: CharRange[] = [
  { min: 9, max: 13 },
  { min: 32, max: 32 },
  { min: 160, max: 160 },
  { min: 5760, max: 5760 },
  { min: 8192, max: 8202 },
  { min: 8232, max: 8233 },
  { min: 8239, max: 8239 },
  { min: 8287, max: 8287 },
  { min: 12288, max: 12288 },
  { min: 65279, max: 65279 },
];

class Parser {
  private position = 0;
  public captureGroups = 0;

  constructor(private readonly source: string) {}

  parse(): Ast {
    const ast = this.parseAlternation();
    if (this.position !== this.source.length) {
      throw new Error(`unsupported regex token at ${this.position}: ${this.source}`);
    }
    return ast;
  }

  private parseAlternation(): Ast {
    const parts = [this.parseConcatenation()];
    while (this.peek() === "|") {
      this.position++;
      parts.push(this.parseConcatenation());
    }
    return parts.length === 1 ? parts[0] : { kind: "alt", parts };
  }

  private parseConcatenation(): Ast {
    const parts: Ast[] = [];
    while (this.position < this.source.length && this.peek() !== ")" && this.peek() !== "|") {
      parts.push(this.parseQuantified());
    }
    if (parts.length === 0) return { kind: "empty" };
    return parts.length === 1 ? parts[0] : { kind: "concat", parts };
  }

  private parseQuantified(): Ast {
    let child = this.parseAtom();
    const token = this.peek();
    if (token === "*" || token === "+" || token === "?") {
      this.position++;
      child = {
        kind: "repeat",
        child,
        min: token === "+" ? 1 : 0,
        max: token === "?" ? 1 : null,
      };
    } else if (token === "{") {
      const close = this.source.indexOf("}", this.position);
      if (close < 0) throw new Error(`unterminated quantifier: ${this.source}`);
      const spec = this.source.slice(this.position + 1, close);
      const comma = spec.indexOf(",");
      const minimumText = comma < 0 ? spec : spec.slice(0, comma);
      const maximumText = comma < 0 ? undefined : spec.slice(comma + 1);
      const decimal = (value: string) =>
        value.length > 0 && [...value].every((character) => character >= "0" && character <= "9");
      if (
        !decimal(minimumText) ||
        (maximumText !== undefined && maximumText !== "" && !decimal(maximumText)) ||
        (comma >= 0 && spec.indexOf(",", comma + 1) >= 0)
      ) {
        throw new Error(`unsupported quantifier {${spec}}`);
      }
      const min = Number(minimumText);
      const max = maximumText === undefined ? min : maximumText === "" ? null : Number(maximumText);
      if (max !== null && max < min) throw new Error(`invalid quantifier {${spec}}`);
      this.position = close + 1;
      child = { kind: "repeat", child, min, max };
    }
    // The frozen common subset contains greedy quantifiers only.
    if (this.peek() === "?") throw new Error(`lazy quantifiers are outside the common subset`);
    return child;
  }

  private parseAtom(): Ast {
    const token = this.peek();
    if (token === "(") {
      this.position++;
      if (this.source.startsWith("?:", this.position)) {
        this.position += 2;
      } else {
        this.captureGroups++;
      }
      const child = this.parseAlternation();
      if (this.peek() !== ")") throw new Error(`unterminated group: ${this.source}`);
      this.position++;
      return child;
    }
    if (token === "[") return { kind: "chars", ranges: this.parseClass() };
    if (token === "\\") {
      this.position++;
      return { kind: "chars", ranges: this.parseEscape(false) };
    }
    if (token === ".") {
      this.position++;
      return { kind: "chars", ranges: complement([{ min: 10, max: 10 }, { min: 13, max: 13 }]) };
    }
    if (token === "^" || token === "$") {
      throw new Error(`anchors are supported only at pattern boundaries: ${this.source}`);
    }
    if (token === undefined || token === ")" || token === "|") {
      throw new Error(`expected regex atom at ${this.position}: ${this.source}`);
    }
    this.position++;
    return { kind: "chars", ranges: [{ min: token.charCodeAt(0), max: token.charCodeAt(0) }] };
  }

  private parseClass(): CharRange[] {
    this.position++; // [
    const negate = this.peek() === "^";
    if (negate) this.position++;
    const ranges: CharRange[] = [];
    while (this.position < this.source.length && this.peek() !== "]") {
      let first: CharRange[];
      if (this.peek() === "\\") {
        this.position++;
        first = this.parseEscape(true);
      } else {
        const code = this.source.charCodeAt(this.position++);
        first = [{ min: code, max: code }];
      }
      if (
        first.length === 1 && this.peek() === "-" &&
        this.position + 1 < this.source.length && this.source[this.position + 1] !== "]"
      ) {
        this.position++;
        let last: CharRange[];
        if (this.peek() === "\\") {
          this.position++;
          last = this.parseEscape(true);
        } else {
          const code = this.source.charCodeAt(this.position++);
          last = [{ min: code, max: code }];
        }
        if (last.length !== 1 || first[0].min > last[0].min) {
          throw new Error(`unsupported character-class range: ${this.source}`);
        }
        ranges.push({ min: first[0].min, max: last[0].min });
      } else {
        ranges.push(...first);
      }
    }
    if (this.peek() !== "]") throw new Error(`unterminated character class: ${this.source}`);
    this.position++;
    const normalized = normalizeRanges(ranges);
    return negate ? complement(normalized) : normalized;
  }

  private parseEscape(_insideClass: boolean): CharRange[] {
    const escaped = this.source[this.position++];
    if (escaped === undefined) throw new Error(`trailing escape: ${this.source}`);
    if (escaped === "d") return [{ min: 48, max: 57 }];
    if (escaped === "D") return complement([{ min: 48, max: 57 }]);
    if (escaped === "w") return ASCII_WORD.map((range) => ({ ...range }));
    if (escaped === "W") return complement(ASCII_WORD);
    if (escaped === "s") return JS_WHITESPACE.map((range) => ({ ...range }));
    if (escaped === "S") return complement(JS_WHITESPACE);
    if (escaped === "t") return [{ min: 9, max: 9 }];
    if (escaped === "n") return [{ min: 10, max: 10 }];
    if (escaped === "v") return [{ min: 11, max: 11 }];
    if (escaped === "f") return [{ min: 12, max: 12 }];
    if (escaped === "r") return [{ min: 13, max: 13 }];
    return [{ min: escaped.charCodeAt(0), max: escaped.charCodeAt(0) }];
  }

  private peek(): string | undefined {
    return this.source[this.position];
  }
}

function normalizeRanges(input: CharRange[]): CharRange[] {
  const sorted = input.map((range) => ({ ...range })).sort((a, b) =>
    a.min - b.min || a.max - b.max
  );
  const output: CharRange[] = [];
  for (const range of sorted) {
    const last = output.at(-1);
    if (last && range.min <= last.max + 1) last.max = Math.max(last.max, range.max);
    else output.push(range);
  }
  return output;
}

function complement(input: CharRange[]): CharRange[] {
  const output: CharRange[] = [];
  let cursor = 0;
  for (const range of normalizeRanges(input)) {
    if (cursor < range.min) output.push({ min: cursor, max: range.min - 1 });
    cursor = range.max + 1;
  }
  if (cursor <= 0xffff) output.push({ min: cursor, max: 0xffff });
  return output;
}

export class CompiledNFA {
  public readonly states: NFAState[] = [];
  public readonly startState: number;
  public readonly acceptState: number;

  constructor(
    public readonly patternId: number,
    public readonly pattern: string,
    ast: Ast,
    public readonly captureGroups: number,
    public readonly anchorStart: boolean,
    public readonly anchorEnd: boolean,
  ) {
    const fragment = this.compile(ast);
    this.startState = fragment.start;
    this.acceptState = fragment.end;
    this.states[this.acceptState].accept = true;
  }

  exec(text: string): RegexMatchResult[] {
    const matches: RegexMatchResult[] = [];
    const stateCount = this.states.length;
    const marks = new Int32Array(stateCount);
    let generation = 0;

    const closure = (seeds: number[]): number[] => {
      generation++;
      if (generation === 0x7fffffff) {
        marks.fill(0);
        generation = 1;
      }
      const list: number[] = [];
      const visit = (stateId: number): void => {
        if (marks[stateId] === generation) return;
        marks[stateId] = generation;
        const state = this.states[stateId];
        if (state.accept || state.transitions.length > 0) list.push(stateId);
        for (const target of state.epsilon) visit(target);
      };
      for (const seed of seeds) visit(seed);
      return list;
    };

    const validEnd = (end: number) =>
      !this.anchorEnd || end === text.length ||
      (end === text.length - 1 && (text.charCodeAt(end) === 10 || text.charCodeAt(end) === 13)) ||
      (end === text.length - 2 && text.charCodeAt(end) === 13 && text.charCodeAt(end + 1) === 10);

    let searchStart = 0;
    const finalStart = this.anchorStart ? 0 : text.length;
    while (searchStart <= finalStart) {
      let active = closure([this.startState]);
      let cursor = searchStart;
      let bestEnd = -1;
      while (active.length > 0) {
        const acceptIndex = active.indexOf(this.acceptState);
        const validAccept = acceptIndex >= 0 && validEnd(cursor);
        if (validAccept) {
          bestEnd = cursor;
          if (cursor === text.length) break;
          const code = text.charCodeAt(cursor);
          const higherPriorityCanConsume = active.slice(0, acceptIndex).some((stateId) =>
            this.states[stateId].transitions.some((transition) =>
              transition.ranges.some((range) => code >= range.min && code <= range.max)
            )
          );
          if (!higherPriorityCanConsume) break;
        }
        if (cursor === text.length) break;
        const code = text.charCodeAt(cursor);
        const targets: number[] = [];
        const limit = validAccept ? acceptIndex : active.length;
        for (let index = 0; index < limit; index++) {
          for (const transition of this.states[active[index]].transitions) {
            if (transition.ranges.some((range) => code >= range.min && code <= range.max)) {
              targets.push(transition.target);
            }
          }
        }
        if (targets.length === 0) break;
        active = closure(targets);
        cursor++;
      }
      if (bestEnd >= searchStart) {
        const matchText = text.slice(searchStart, bestEnd);
        matches.push({
          patternId: this.patternId,
          startCP: searchStart,
          endCP: bestEnd,
          matchText,
        });
        searchStart = bestEnd > searchStart ? bestEnd : searchStart + 1;
      } else if (this.anchorStart) {
        break;
      } else {
        searchStart++;
      }
    }
    return matches;
  }

  toAsciiDFA(): CompiledDFA {
    const closure = (seed: number[]): number[] => {
      const seen = new Set<number>();
      const list: number[] = [];
      const visit = (stateId: number): void => {
        if (seen.has(stateId)) return;
        seen.add(stateId);
        const state = this.states[stateId];
        if (state.accept || state.transitions.length > 0) list.push(stateId);
        for (const target of state.epsilon) visit(target);
      };
      for (const stateId of seed) visit(stateId);
      return list;
    };
    const key = (states: number[]) => states.join(",");
    const start = closure([this.startState]);
    const dfaStates: number[][] = [start];
    const indexes = new Map([[key(start), 0]]);
    const rows: number[][] = [];
    const commitRows: number[][] = [];
    for (let index = 0; index < dfaStates.length; index++) {
      const row = new Array<number>(128).fill(-1);
      const commitRow = new Array<number>(128).fill(0);
      const acceptIndex = dfaStates[index].indexOf(this.acceptState);
      for (let code = 0; code < 128; code++) {
        const targets: number[] = [];
        const limit = acceptIndex >= 0 ? acceptIndex : dfaStates[index].length;
        for (let stateIndex = 0; stateIndex < limit; stateIndex++) {
          for (const transition of this.states[dfaStates[index][stateIndex]].transitions) {
            if (transition.ranges.some((range) => code >= range.min && code <= range.max)) {
              targets.push(transition.target);
            }
          }
        }
        if (acceptIndex >= 0 && targets.length === 0) commitRow[code] = 1;
        if (targets.length === 0) continue;
        const next = closure(targets);
        const nextKey = key(next);
        let target = indexes.get(nextKey);
        if (target === undefined) {
          target = dfaStates.length;
          indexes.set(nextKey, target);
          dfaStates.push(next);
        }
        row[code] = target;
      }
      rows.push(row);
      commitRows.push(commitRow);
    }
    const transitions = new Int16Array(dfaStates.length * 128);
    transitions.fill(-1);
    rows.forEach((row, index) => transitions.set(row, index * 128));
    const accepting = new Uint8Array(dfaStates.length);
    dfaStates.forEach((states, index) =>
      accepting[index] = states.includes(this.acceptState) ? 1 : 0
    );
    const commitBefore = new Uint8Array(dfaStates.length * 128);
    commitRows.forEach((row, index) => commitBefore.set(row, index * 128));
    return { stateCount: dfaStates.length, startState: 0, transitions, accepting, commitBefore };
  }

  private createState(): number {
    this.states.push({ epsilon: [], transitions: [], accept: false });
    return this.states.length - 1;
  }

  private compile(ast: Ast): { start: number; end: number } {
    if (ast.kind === "empty") {
      const start = this.createState();
      const end = this.createState();
      this.states[start].epsilon.push(end);
      return { start, end };
    }
    if (ast.kind === "chars") {
      const start = this.createState();
      const end = this.createState();
      this.states[start].transitions.push({ ranges: ast.ranges, target: end });
      return { start, end };
    }
    if (ast.kind === "concat") {
      const fragments = ast.parts.map((part) => this.compile(part));
      for (let i = 0; i + 1 < fragments.length; i++) {
        this.states[fragments[i].end].epsilon.push(fragments[i + 1].start);
      }
      return { start: fragments[0].start, end: fragments.at(-1)!.end };
    }
    if (ast.kind === "alt") {
      const start = this.createState();
      const end = this.createState();
      for (const part of ast.parts) {
        const fragment = this.compile(part);
        this.states[start].epsilon.push(fragment.start);
        this.states[fragment.end].epsilon.push(end);
      }
      return { start, end };
    }
    const start = this.createState();
    let cursor = start;
    for (let i = 0; i < ast.min; i++) {
      const fragment = this.compile(ast.child);
      this.states[cursor].epsilon.push(fragment.start);
      cursor = fragment.end;
    }
    const end = this.createState();
    if (ast.max === null) {
      const fragment = this.compile(ast.child);
      this.states[cursor].epsilon.push(fragment.start, end);
      this.states[fragment.end].epsilon.push(cursor);
    } else {
      for (let i = ast.min; i < ast.max; i++) {
        const fragment = this.compile(ast.child);
        this.states[cursor].epsilon.push(fragment.start, end);
        cursor = fragment.end;
      }
      this.states[cursor].epsilon.push(end);
    }
    return { start, end };
  }
}

export function compileRegexToNFA(patternId: number, pattern: string): CompiledNFA {
  const anchorStart = pattern.startsWith("^");
  const anchorEnd = pattern.endsWith("$") && !pattern.endsWith("\\$");
  const source = pattern.slice(anchorStart ? 1 : 0, anchorEnd ? -1 : undefined);
  const parser = new Parser(source);
  const ast = parser.parse();
  return new CompiledNFA(patternId, pattern, ast, parser.captureGroups, anchorStart, anchorEnd);
}

export async function scanJSAutomata(fixture: RegexFixture) {
  const startCompile = performance.now();
  const automata = fixture.patterns.map((pattern) =>
    compileRegexToNFA(pattern.id, pattern.pattern)
  );
  const endCompile = performance.now();
  const matches: RegexMatchResult[] = [];
  let capturesExtracted = 0;
  const startScan = performance.now();
  for (const automaton of automata) {
    const found = automaton.exec(fixture.text);
    matches.push(...found);
    capturesExtracted += found.length * automaton.captureGroups;
  }
  const endScan = performance.now();
  return {
    matches,
    codePointsSearched: fixture.textCodePoints * automata.length,
    patternsExecuted: automata.length,
    matchesFound: matches.length,
    capturesExtracted,
    boundaryCrossings: 0,
    oracleHash: await computeRegexSHA256OracleHash(matches),
    phases: { compileMs: endCompile - startCompile, scanMs: endScan - startScan },
  };
}

export async function computeRegexSHA256OracleHash(matches: RegexMatchResult[]): Promise<string> {
  const tuples = matches.map((match) => [
    match.patternId,
    match.startCP,
    match.endCP,
    match.endCP - match.startCP,
  ]);
  return await sha256Hex(new TextEncoder().encode(JSON.stringify(tuples)));
}
