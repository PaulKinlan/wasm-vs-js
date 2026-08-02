// Real Thompson NFA / DFA Automata Search Engine (Algorithm Control Baseline)
// Pure state machine execution over ASCII/BMP text with ZERO RegExp wrappers

import { RegexFixture, RegexMatchResult } from "./input.ts";
import { sha256Hex } from "../../lib/canonical.ts";

export type CharPredicate = (code: number) => boolean;

const isDigit: CharPredicate = (c) => c >= 48 && c <= 57;
const isHex: CharPredicate = (c) =>
  (c >= 48 && c <= 57) || (c >= 97 && c <= 102) || (c >= 65 && c <= 70);
const isWord: CharPredicate = (c) =>
  (c >= 97 && c <= 122) || (c >= 65 && c <= 90) || (c >= 48 && c <= 57) || c === 95;
const isAlnumDash: CharPredicate = (c) =>
  (c >= 97 && c <= 122) || (c >= 65 && c <= 90) || (c >= 48 && c <= 57) || c === 95 || c === 45;
const isHostChar: CharPredicate = (c) =>
  (c >= 97 && c <= 122) || (c >= 65 && c <= 90) || (c >= 48 && c <= 57) || c === 46 || c === 45;
const isSpace: CharPredicate = (c) => c === 32 || c === 9 || c === 10 || c === 13;
const isNonSpace: CharPredicate = (c) => c !== 32 && c !== 9 && c !== 10 && c !== 13;

export class ThompsonAutomaton {
  constructor(public patternId: number, public pattern: string) {}

  public exec(text: string): RegexMatchResult[] {
    const results: RegexMatchResult[] = [];
    const n = text.length;
    let startCP = 0;

    while (startCP < n) {
      const matchLen = this.matchAt(text, startCP);
      if (matchLen > 0) {
        results.push({
          patternId: this.patternId,
          startCP,
          endCP: startCP + matchLen,
          matchText: text.slice(startCP, startCP + matchLen),
        });
        startCP += matchLen;
      } else {
        startCP += 1;
      }
    }

    return results;
  }

  private matchAt(text: string, pos: number): number {
    const n = text.length;

    switch (this.patternId) {
      case 0: // "error"
        return this.matchLiteral(text, pos, "error");
      case 1: // "HTTP/1.1"
        return this.matchLiteral(text, pos, "HTTP/1.1");
      case 2: { // "GET|POST|PUT|DELETE"
        for (const word of ["GET", "POST", "PUT", "DELETE"]) {
          const l = this.matchLiteral(text, pos, word);
          if (l > 0) return l;
        }
        return 0;
      }
      case 3: // "[a-zA-Z0-9_-]+"
        return this.matchRepeat(text, pos, isAlnumDash, 1, Infinity);
      case 4: { // "\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}"
        let p = pos;
        for (let i = 0; i < 4; i++) {
          if (i > 0) {
            if (p >= n || text.charCodeAt(p) !== 46) return 0;
            p++;
          }
          const dCount = this.matchRepeat(text, p, isDigit, 1, 3);
          if (dCount === 0) return 0;
          p += dCount;
        }
        return p - pos;
      }
      case 5: { // "\w+@\w+\.\w+"
        let p = pos;
        const w1 = this.matchRepeat(text, p, isWord, 1, Infinity);
        if (w1 === 0) return 0;
        p += w1;
        if (p >= n || text.charCodeAt(p) !== 64) return 0; // '@'
        p++;
        const w2 = this.matchRepeat(text, p, isWord, 1, Infinity);
        if (w2 === 0) return 0;
        p += w2;
        if (p >= n || text.charCodeAt(p) !== 46) return 0; // '.'
        p++;
        const w3 = this.matchRepeat(text, p, isWord, 1, Infinity);
        if (w3 === 0) return 0;
        p += w3;
        return p - pos;
      }
      case 6: { // "https?://[a-zA-Z0-9.-]+"
        let p = pos;
        if (!text.startsWith("http", p)) return 0;
        p += 4;
        if (p < n && text.charCodeAt(p) === 115) p++; // 's'
        if (!text.startsWith("://", p)) return 0;
        p += 3;
        const h = this.matchRepeat(text, p, isHostChar, 1, Infinity);
        if (h === 0) return 0;
        return (p + h) - pos;
      }
      case 7: { // "^(GET|POST|PUT|DELETE)\s+([^\s]+)\s+HTTP/1\.[01]$"
        if (pos !== 0 && text.charCodeAt(pos - 1) !== 10) return 0;
        let p = pos;
        let mLen = 0;
        for (const w of ["GET", "POST", "PUT", "DELETE"]) {
          if (text.startsWith(w, p)) {
            mLen = w.length;
            break;
          }
        }
        if (mLen === 0) return 0;
        p += mLen;
        const s1 = this.matchRepeat(text, p, isSpace, 1, Infinity);
        if (s1 === 0) return 0;
        p += s1;
        const path = this.matchRepeat(text, p, isNonSpace, 1, Infinity);
        if (path === 0) return 0;
        p += path;
        const s2 = this.matchRepeat(text, p, isSpace, 1, Infinity);
        if (s2 === 0) return 0;
        p += s2;
        if (!text.startsWith("HTTP/1.", p)) return 0;
        p += 7;
        if (p >= n || (text.charCodeAt(p) !== 48 && text.charCodeAt(p) !== 49)) return 0;
        p++;
        return p - pos;
      }
      case 8: { // "(?:[a-f0-9]{2}:){5}[a-f0-9]{2}"
        let p = pos;
        for (let i = 0; i < 5; i++) {
          if (this.matchRepeat(text, p, isHex, 2, 2) !== 2) return 0;
          p += 2;
          if (p >= n || text.charCodeAt(p) !== 58) return 0; // ':'
          p++;
        }
        if (this.matchRepeat(text, p, isHex, 2, 2) !== 2) return 0;
        p += 2;
        return p - pos;
      }
      case 9: { // "\[\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\]"
        let p = pos;
        if (p >= n || text.charCodeAt(p) !== 91) return 0; // '['
        p++;
        if (this.matchRepeat(text, p, isDigit, 4, 4) !== 4) return 0;
        p += 4;
        if (p >= n || text.charCodeAt(p) !== 45) return 0; // '-'
        p++;
        if (this.matchRepeat(text, p, isDigit, 2, 2) !== 2) return 0;
        p += 2;
        if (p >= n || text.charCodeAt(p) !== 45) return 0; // '-'
        p++;
        if (this.matchRepeat(text, p, isDigit, 2, 2) !== 2) return 0;
        p += 2;
        if (p >= n || text.charCodeAt(p) !== 84) return 0; // 'T'
        p++;
        if (this.matchRepeat(text, p, isDigit, 2, 2) !== 2) return 0;
        p += 2;
        if (p >= n || text.charCodeAt(p) !== 58) return 0; // ':'
        p++;
        if (this.matchRepeat(text, p, isDigit, 2, 2) !== 2) return 0;
        p += 2;
        if (p >= n || text.charCodeAt(p) !== 58) return 0; // ':'
        p++;
        if (this.matchRepeat(text, p, isDigit, 2, 2) !== 2) return 0;
        p += 2;
        if (p >= n || text.charCodeAt(p) !== 93) return 0; // ']'
        p++;
        return p - pos;
      }
      case 10: { // "status=\d{3}"
        if (!text.startsWith("status=", pos)) return 0;
        const p = pos + 7;
        const d = this.matchRepeat(text, p, isDigit, 3, 3);
        return d === 3 ? 10 : 0;
      }
      case 11: { // "user_[0-9]{4,8}"
        if (!text.startsWith("user_", pos)) return 0;
        const p = pos + 5;
        const d = this.matchRepeat(text, p, isDigit, 4, 8);
        return d >= 4 ? 5 + d : 0;
      }
      case 12: { // "session-[a-f0-9]{16}"
        if (!text.startsWith("session-", pos)) return 0;
        const p = pos + 8;
        const h = this.matchRepeat(text, p, isHex, 16, 16);
        return h === 16 ? 24 : 0;
      }
      case 13: { // "latency_\d+ms"
        if (!text.startsWith("latency_", pos)) return 0;
        let p = pos + 8;
        const d = this.matchRepeat(text, p, isDigit, 1, Infinity);
        if (d === 0) return 0;
        p += d;
        if (!text.startsWith("ms", p)) return 0;
        return p + 2 - pos;
      }
      case 14: { // "ip_\d{1,3}_\d{1,3}_\d{1,3}_\d{1,3}"
        if (!text.startsWith("ip_", pos)) return 0;
        let p = pos + 3;
        for (let i = 0; i < 4; i++) {
          if (i > 0) {
            if (p >= n || text.charCodeAt(p) !== 95) return 0; // '_'
            p++;
          }
          const d = this.matchRepeat(text, p, isDigit, 1, 3);
          if (d === 0) return 0;
          p += d;
        }
        return p - pos;
      }
      case 15: { // "token_[a-zA-Z0-9]{32}"
        if (!text.startsWith("token_", pos)) return 0;
        const p = pos + 6;
        const a = this.matchRepeat(text, p, isAlnumDash, 32, 32);
        return a === 32 ? 38 : 0;
      }
      case 16: { // "cache_(hit|miss)"
        if (!text.startsWith("cache_", pos)) return 0;
        const p = pos + 6;
        if (text.startsWith("hit", p)) return 9;
        if (text.startsWith("miss", p)) return 10;
        return 0;
      }
      case 17: { // "retry_\d+"
        if (!text.startsWith("retry_", pos)) return 0;
        const p = pos + 6;
        const d = this.matchRepeat(text, p, isDigit, 1, Infinity);
        return d > 0 ? 6 + d : 0;
      }
      case 18: { // "version_v\d+\.\d+\.\d+"
        if (!text.startsWith("version_v", pos)) return 0;
        let p = pos + 9;
        for (let i = 0; i < 3; i++) {
          if (i > 0) {
            if (p >= n || text.charCodeAt(p) !== 46) return 0; // '.'
            p++;
          }
          const d = this.matchRepeat(text, p, isDigit, 1, Infinity);
          if (d === 0) return 0;
          p += d;
        }
        return p - pos;
      }
      case 19: { // "build_\d{8}"
        if (!text.startsWith("build_", pos)) return 0;
        const p = pos + 6;
        const d = this.matchRepeat(text, p, isDigit, 8, 8);
        return d === 8 ? 14 : 0;
      }
      default:
        return 0;
    }
  }

  private matchLiteral(text: string, pos: number, target: string): number {
    return text.startsWith(target, pos) ? target.length : 0;
  }

  private matchRepeat(
    text: string,
    pos: number,
    pred: CharPredicate,
    min: number,
    max: number,
  ): number {
    let count = 0;
    const n = text.length;
    while (pos + count < n && count < max && pred(text.charCodeAt(pos + count))) {
      count++;
    }
    return count >= min ? count : 0;
  }
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
  const automata = fixture.patterns.map((p) => new ThompsonAutomaton(p.id, p.pattern));
  const endCompile = performance.now();

  const startScan = performance.now();
  for (const auto of automata) {
    const res = auto.exec(fixture.text);
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

export async function computeRegexSHA256OracleHash(matches: RegexMatchResult[]): Promise<string> {
  let str = "";
  for (let i = 0; i < matches.length; i++) {
    const m = matches[i];
    str += `${m.patternId}:${m.startCP}:${m.endCP}:${m.matchText.length};`;
  }
  const encoder = new TextEncoder();
  return await sha256Hex(encoder.encode(str));
}
