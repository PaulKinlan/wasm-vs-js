// benchmarks/regex-automata-duel/input.ts
const SplitMix64 = class {
  state;
  constructor(seed) {
    this.state = seed;
  }
  nextUint32() {
    this.state = this.state + 0x9e3779b97f4a7c15n & 0xffffffffffffffffn;
    let z = this.state;
    z = (z ^ z >> 30n) * 0xbf58476d1ce4e5b9n & 0xffffffffffffffffn;
    z = (z ^ z >> 27n) * 0x94d049bb133111ebn & 0xffffffffffffffffn;
    return Number((z ^ z >> 31n) & 0xffffffffn) >>> 0;
  }
  nextIntRange(min, max) {
    const span = max - min + 1;
    return min + this.nextUint32() % span;
  }
};
const REGEX_SEED = 3976339494;
const REGEX_CORPUS_SIZE = 1024 * 1024;
const FROZEN_REGEX_PATTERNS = [
  {
    id: 0,
    pattern: "error",
    isLiteral: true,
    description: "Simple literal string match",
  },
  {
    id: 1,
    pattern: "HTTP/1.1",
    isLiteral: true,
    description: "HTTP protocol string",
  },
  {
    id: 2,
    pattern: "GET|POST|PUT|DELETE",
    isLiteral: false,
    description: "HTTP method alternation",
  },
  {
    id: 3,
    pattern: "[a-zA-Z0-9_-]+",
    isLiteral: false,
    description: "Identifier character class",
  },
  {
    id: 4,
    pattern: "\\d{1,3}\\.\\d{1,3}\\.\\d{1,3}\\.\\d{1,3}",
    isLiteral: false,
    description: "IPv4 address regex",
  },
  {
    id: 5,
    pattern: "\\w+@\\w+\\.\\w+",
    isLiteral: false,
    description: "Simple email pattern",
  },
  {
    id: 6,
    pattern: "https?://[a-zA-Z0-9.-]+",
    isLiteral: false,
    description: "URL host pattern",
  },
  {
    id: 7,
    pattern: "^(GET|POST|PUT|DELETE)\\s+([^\\s]+)\\s+HTTP/1\\.[01]$",
    isLiteral: false,
    description: "HTTP request line",
  },
  {
    id: 8,
    pattern: "(?:[a-f0-9]{2}:){5}[a-f0-9]{2}",
    isLiteral: false,
    description: "MAC address pattern",
  },
  {
    id: 9,
    pattern: "\\[\\d{4}-\\d{2}-\\d{2}T\\d{2}:\\d{2}:\\d{2}\\]",
    isLiteral: false,
    description: "ISO timestamp",
  },
  {
    id: 10,
    pattern: "status=\\d{3}",
    isLiteral: false,
    description: "HTTP status code parameter",
  },
  {
    id: 11,
    pattern: "user_[0-9]{4,8}",
    isLiteral: false,
    description: "User ID token",
  },
  {
    id: 12,
    pattern: "session-[a-f0-9]{16}",
    isLiteral: false,
    description: "Session hash token",
  },
  {
    id: 13,
    pattern: "latency_\\d+ms",
    isLiteral: false,
    description: "Latency metric token",
  },
  {
    id: 14,
    pattern: "ip_\\d{1,3}_\\d{1,3}_\\d{1,3}_\\d{1,3}",
    isLiteral: false,
    description: "Sanitized IP string",
  },
  {
    id: 15,
    pattern: "token_[a-zA-Z0-9]{32}",
    isLiteral: false,
    description: "Bearer token pattern",
  },
  {
    id: 16,
    pattern: "cache_(hit|miss)",
    isLiteral: false,
    description: "Cache status tag",
  },
  {
    id: 17,
    pattern: "retry_\\d+",
    isLiteral: false,
    description: "Retry count tag",
  },
  {
    id: 18,
    pattern: "version_v\\d+\\.\\d+\\.\\d+",
    isLiteral: false,
    description: "Semantic version tag",
  },
  {
    id: 19,
    pattern: "build_\\d{8}",
    isLiteral: false,
    description: "Build date tag",
  },
];
function generateRegexFixture(seed = REGEX_SEED, sizeBytes = REGEX_CORPUS_SIZE) {
  const prng = new SplitMix64(BigInt(seed));
  const chars = [];
  const ALPHABET = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789 _-./:=[]";
  const INJECTIONS = [
    "[2026-08-02T22:15:00] GET /api/v1/user_1024 HTTP/1.1 status=200 latency_12ms ip_192_168_1_10 token_a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6 cache_hit session-9f8e7d6c5b4a3f2e",
    "[2026-08-02T22:15:01] POST /auth/login HTTP/1.1 status=401 error latency_45ms ip_10_0_0_15 cache_miss retry_2 version_v2.1.0 build_20260802",
    "mac_address=00:1a:2b:3c:4d:5e url=https://example.com/checkout user_9981 status=500",
  ];
  let currentBytes = 0;
  while (currentBytes < sizeBytes) {
    if (prng.nextIntRange(0, 9) === 0) {
      const inject = INJECTIONS[prng.nextIntRange(0, INJECTIONS.length - 1)];
      chars.push(inject + "\n");
      currentBytes += inject.length + 1;
    } else {
      const len = prng.nextIntRange(10, 60);
      let chunk = "";
      for (let i = 0; i < len; i++) {
        chunk += ALPHABET[prng.nextUint32() % ALPHABET.length];
      }
      chars.push(chunk + "\n");
      currentBytes += chunk.length + 1;
    }
  }
  let text = chars.join("");
  if (text.length > sizeBytes) {
    text = text.slice(0, sizeBytes);
  }
  const encoder2 = new TextEncoder();
  const textBuffer = encoder2.encode(text);
  return {
    seed,
    text,
    textCodePoints: text.length,
    patterns: FROZEN_REGEX_PATTERNS,
    textBuffer,
  };
}

// lib/canonical.ts
const encoder = new TextEncoder();
async function sha256Hex(value) {
  const source = typeof value === "string" ? encoder.encode(value) : value;
  const bytes = new Uint8Array(source.byteLength);
  bytes.set(source);
  const digest = new Uint8Array(await crypto.subtle.digest("SHA-256", bytes));
  return [
    ...digest,
  ].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

// benchmarks/regex-automata-duel/js-automata.ts
const ASCII_WORD = [
  {
    min: 48,
    max: 57,
  },
  {
    min: 65,
    max: 90,
  },
  {
    min: 95,
    max: 95,
  },
  {
    min: 97,
    max: 122,
  },
];
const JS_WHITESPACE = [
  {
    min: 9,
    max: 13,
  },
  {
    min: 32,
    max: 32,
  },
  {
    min: 160,
    max: 160,
  },
  {
    min: 5760,
    max: 5760,
  },
  {
    min: 8192,
    max: 8202,
  },
  {
    min: 8232,
    max: 8233,
  },
  {
    min: 8239,
    max: 8239,
  },
  {
    min: 8287,
    max: 8287,
  },
  {
    min: 12288,
    max: 12288,
  },
  {
    min: 65279,
    max: 65279,
  },
];
const Parser = class {
  source;
  position;
  captureGroups;
  constructor(source) {
    this.source = source;
    this.position = 0;
    this.captureGroups = 0;
  }
  parse() {
    const ast = this.parseAlternation();
    if (this.position !== this.source.length) {
      throw new Error(`unsupported regex token at ${this.position}: ${this.source}`);
    }
    return ast;
  }
  parseAlternation() {
    const parts = [
      this.parseConcatenation(),
    ];
    while (this.peek() === "|") {
      this.position++;
      parts.push(this.parseConcatenation());
    }
    return parts.length === 1 ? parts[0] : {
      kind: "alt",
      parts,
    };
  }
  parseConcatenation() {
    const parts = [];
    while (this.position < this.source.length && this.peek() !== ")" && this.peek() !== "|") {
      parts.push(this.parseQuantified());
    }
    if (parts.length === 0) {
      return {
        kind: "empty",
      };
    }
    return parts.length === 1 ? parts[0] : {
      kind: "concat",
      parts,
    };
  }
  parseQuantified() {
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
      const maximumText = comma < 0 ? void 0 : spec.slice(comma + 1);
      const decimal = (value) =>
        value.length > 0 && [
          ...value,
        ].every((character) => character >= "0" && character <= "9");
      if (
        !decimal(minimumText) ||
        maximumText !== void 0 && maximumText !== "" && !decimal(maximumText) ||
        comma >= 0 && spec.indexOf(",", comma + 1) >= 0
      ) {
        throw new Error(`unsupported quantifier {${spec}}`);
      }
      const min = Number(minimumText);
      const max = maximumText === void 0 ? min : maximumText === "" ? null : Number(maximumText);
      if (max !== null && max < min) throw new Error(`invalid quantifier {${spec}}`);
      this.position = close + 1;
      child = {
        kind: "repeat",
        child,
        min,
        max,
      };
    }
    if (this.peek() === "?") throw new Error(`lazy quantifiers are outside the common subset`);
    return child;
  }
  parseAtom() {
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
    if (token === "[") {
      return {
        kind: "chars",
        ranges: this.parseClass(),
      };
    }
    if (token === "\\") {
      this.position++;
      return {
        kind: "chars",
        ranges: this.parseEscape(false),
      };
    }
    if (token === ".") {
      this.position++;
      return {
        kind: "chars",
        ranges: complement([
          {
            min: 10,
            max: 10,
          },
          {
            min: 13,
            max: 13,
          },
        ]),
      };
    }
    if (token === "^" || token === "$") {
      throw new Error(`anchors are supported only at pattern boundaries: ${this.source}`);
    }
    if (token === void 0 || token === ")" || token === "|") {
      throw new Error(`expected regex atom at ${this.position}: ${this.source}`);
    }
    this.position++;
    return {
      kind: "chars",
      ranges: [
        {
          min: token.charCodeAt(0),
          max: token.charCodeAt(0),
        },
      ],
    };
  }
  parseClass() {
    this.position++;
    const negate = this.peek() === "^";
    if (negate) this.position++;
    const ranges = [];
    while (this.position < this.source.length && this.peek() !== "]") {
      let first;
      if (this.peek() === "\\") {
        this.position++;
        first = this.parseEscape(true);
      } else {
        const code = this.source.charCodeAt(this.position++);
        first = [
          {
            min: code,
            max: code,
          },
        ];
      }
      if (
        first.length === 1 && this.peek() === "-" && this.position + 1 < this.source.length &&
        this.source[this.position + 1] !== "]"
      ) {
        this.position++;
        let last;
        if (this.peek() === "\\") {
          this.position++;
          last = this.parseEscape(true);
        } else {
          const code = this.source.charCodeAt(this.position++);
          last = [
            {
              min: code,
              max: code,
            },
          ];
        }
        if (last.length !== 1 || first[0].min > last[0].min) {
          throw new Error(`unsupported character-class range: ${this.source}`);
        }
        ranges.push({
          min: first[0].min,
          max: last[0].min,
        });
      } else {
        ranges.push(...first);
      }
    }
    if (this.peek() !== "]") throw new Error(`unterminated character class: ${this.source}`);
    this.position++;
    const normalized = normalizeRanges(ranges);
    return negate ? complement(normalized) : normalized;
  }
  parseEscape(_insideClass) {
    const escaped = this.source[this.position++];
    if (escaped === void 0) throw new Error(`trailing escape: ${this.source}`);
    if (escaped === "d") {
      return [
        {
          min: 48,
          max: 57,
        },
      ];
    }
    if (escaped === "D") {
      return complement([
        {
          min: 48,
          max: 57,
        },
      ]);
    }
    if (escaped === "w") {
      return ASCII_WORD.map((range) => ({
        ...range,
      }));
    }
    if (escaped === "W") return complement(ASCII_WORD);
    if (escaped === "s") {
      return JS_WHITESPACE.map((range) => ({
        ...range,
      }));
    }
    if (escaped === "S") return complement(JS_WHITESPACE);
    if (escaped === "t") {
      return [
        {
          min: 9,
          max: 9,
        },
      ];
    }
    if (escaped === "n") {
      return [
        {
          min: 10,
          max: 10,
        },
      ];
    }
    if (escaped === "v") {
      return [
        {
          min: 11,
          max: 11,
        },
      ];
    }
    if (escaped === "f") {
      return [
        {
          min: 12,
          max: 12,
        },
      ];
    }
    if (escaped === "r") {
      return [
        {
          min: 13,
          max: 13,
        },
      ];
    }
    return [
      {
        min: escaped.charCodeAt(0),
        max: escaped.charCodeAt(0),
      },
    ];
  }
  peek() {
    return this.source[this.position];
  }
};
function normalizeRanges(input) {
  const sorted = input.map((range) => ({
    ...range,
  })).sort((a, b) => a.min - b.min || a.max - b.max);
  const output = [];
  for (const range of sorted) {
    const last = output.at(-1);
    if (last && range.min <= last.max + 1) last.max = Math.max(last.max, range.max);
    else output.push(range);
  }
  return output;
}
function complement(input) {
  const output = [];
  let cursor = 0;
  for (const range of normalizeRanges(input)) {
    if (cursor < range.min) {
      output.push({
        min: cursor,
        max: range.min - 1,
      });
    }
    cursor = range.max + 1;
  }
  if (cursor <= 65535) {
    output.push({
      min: cursor,
      max: 65535,
    });
  }
  return output;
}
const CompiledNFA = class {
  patternId;
  pattern;
  captureGroups;
  anchorStart;
  anchorEnd;
  states;
  startState;
  acceptState;
  constructor(patternId, pattern, ast, captureGroups, anchorStart, anchorEnd) {
    this.patternId = patternId;
    this.pattern = pattern;
    this.captureGroups = captureGroups;
    this.anchorStart = anchorStart;
    this.anchorEnd = anchorEnd;
    this.states = [];
    const fragment = this.compile(ast);
    this.startState = fragment.start;
    this.acceptState = fragment.end;
    this.states[this.acceptState].accept = true;
  }
  exec(text) {
    const matches = [];
    const stateCount = this.states.length;
    const marks = new Int32Array(stateCount);
    let generation = 0;
    const closure = (seeds) => {
      generation++;
      if (generation === 2147483647) {
        marks.fill(0);
        generation = 1;
      }
      const list = [];
      const visit = (stateId) => {
        if (marks[stateId] === generation) return;
        marks[stateId] = generation;
        const state = this.states[stateId];
        if (state.accept || state.transitions.length > 0) list.push(stateId);
        for (const target of state.epsilon) visit(target);
      };
      for (const seed of seeds) visit(seed);
      return list;
    };
    const validEnd = (end) =>
      !this.anchorEnd || end === text.length ||
      end === text.length - 1 && (text.charCodeAt(end) === 10 || text.charCodeAt(end) === 13) ||
      end === text.length - 2 && text.charCodeAt(end) === 13 && text.charCodeAt(end + 1) === 10;
    let searchStart = 0;
    const finalStart = this.anchorStart ? 0 : text.length;
    while (searchStart <= finalStart) {
      let active = closure([
        this.startState,
      ]);
      let cursor = searchStart;
      let bestEnd = -1;
      while (active.length > 0) {
        const acceptIndex = active.indexOf(this.acceptState);
        const validAccept = acceptIndex >= 0 && validEnd(cursor);
        if (validAccept) {
          bestEnd = cursor;
          if (cursor === text.length) break;
          const code2 = text.charCodeAt(cursor);
          const higherPriorityCanConsume = active.slice(0, acceptIndex).some((stateId) =>
            this.states[stateId].transitions.some((transition) =>
              transition.ranges.some((range) => code2 >= range.min && code2 <= range.max)
            )
          );
          if (!higherPriorityCanConsume) break;
        }
        if (cursor === text.length) break;
        const code = text.charCodeAt(cursor);
        const targets = [];
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
  toAsciiDFA() {
    const closure = (seed) => {
      const seen = /* @__PURE__ */ new Set();
      const list = [];
      const visit = (stateId) => {
        if (seen.has(stateId)) return;
        seen.add(stateId);
        const state = this.states[stateId];
        if (state.accept || state.transitions.length > 0) list.push(stateId);
        for (const target of state.epsilon) visit(target);
      };
      for (const stateId of seed) visit(stateId);
      return list;
    };
    const key = (states) => states.join(",");
    const start = closure([
      this.startState,
    ]);
    const dfaStates = [
      start,
    ];
    const indexes = /* @__PURE__ */ new Map([
      [
        key(start),
        0,
      ],
    ]);
    const rows = [];
    const commitRows = [];
    for (let index = 0; index < dfaStates.length; index++) {
      const row = new Array(128).fill(-1);
      const commitRow = new Array(128).fill(0);
      const acceptIndex = dfaStates[index].indexOf(this.acceptState);
      for (let code = 0; code < 128; code++) {
        const targets = [];
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
        if (target === void 0) {
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
    return {
      stateCount: dfaStates.length,
      startState: 0,
      transitions,
      accepting,
      commitBefore,
    };
  }
  createState() {
    this.states.push({
      epsilon: [],
      transitions: [],
      accept: false,
    });
    return this.states.length - 1;
  }
  compile(ast) {
    if (ast.kind === "empty") {
      const start2 = this.createState();
      const end2 = this.createState();
      this.states[start2].epsilon.push(end2);
      return {
        start: start2,
        end: end2,
      };
    }
    if (ast.kind === "chars") {
      const start2 = this.createState();
      const end2 = this.createState();
      this.states[start2].transitions.push({
        ranges: ast.ranges,
        target: end2,
      });
      return {
        start: start2,
        end: end2,
      };
    }
    if (ast.kind === "concat") {
      const fragments = ast.parts.map((part) => this.compile(part));
      for (let i = 0; i + 1 < fragments.length; i++) {
        this.states[fragments[i].end].epsilon.push(fragments[i + 1].start);
      }
      return {
        start: fragments[0].start,
        end: fragments.at(-1).end,
      };
    }
    if (ast.kind === "alt") {
      const start2 = this.createState();
      const end2 = this.createState();
      for (const part of ast.parts) {
        const fragment = this.compile(part);
        this.states[start2].epsilon.push(fragment.start);
        this.states[fragment.end].epsilon.push(end2);
      }
      return {
        start: start2,
        end: end2,
      };
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
    return {
      start,
      end,
    };
  }
};
function compileRegexToNFA(patternId, pattern) {
  const anchorStart = pattern.startsWith("^");
  const anchorEnd = pattern.endsWith("$") && !pattern.endsWith("\\$");
  const source = pattern.slice(anchorStart ? 1 : 0, anchorEnd ? -1 : void 0);
  const parser = new Parser(source);
  const ast = parser.parse();
  return new CompiledNFA(patternId, pattern, ast, parser.captureGroups, anchorStart, anchorEnd);
}
async function scanJSAutomata(fixture) {
  const startCompile = performance.now();
  const automata = fixture.patterns.map((pattern) =>
    compileRegexToNFA(pattern.id, pattern.pattern)
  );
  const endCompile = performance.now();
  const matches = [];
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
    phases: {
      compileMs: endCompile - startCompile,
      scanMs: endScan - startScan,
    },
  };
}
async function computeRegexSHA256OracleHash(matches) {
  const tuples = matches.map((match) => [
    match.patternId,
    match.startCP,
    match.endCP,
    match.endCP - match.startCP,
  ]);
  return await sha256Hex(new TextEncoder().encode(JSON.stringify(tuples)));
}

// benchmarks/regex-automata-duel/js-native.ts
async function scanNativeRegExp(fixture) {
  const matches = [];
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
    let match;
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
      if (matchText.length === 0) {
        re.lastIndex = startCP + 1;
      }
    }
  }
  const endScan = performance.now();
  const oracleHash = await computeRegexSHA256OracleHash(matches);
  return {
    matches,
    codePointsSearched: fixture.textCodePoints * fixture.patterns.length,
    patternsExecuted: fixture.patterns.length,
    matchesFound: matches.length,
    capturesExtracted,
    boundaryCrossings: 0,
    oracleHash,
    phases: {
      compileMs: endCompile - startCompile,
      scanMs: endScan - startScan,
    },
  };
}

// benchmarks/regex-automata-duel/workload.js
async function scanWasmAutomata(fixture, wasmInstance) {
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
  let cursor = textPtr + fixture.textBuffer.byteLength + 7 & ~7;
  const matches = [];
  let capturesExtracted = 0;
  let boundaryCrossings = 0;
  const startScan = performance.now();
  for (const { nfa, dfa } of automata) {
    const tablePtr = cursor;
    new Int16Array(memory.buffer, tablePtr, dfa.transitions.length).set(dfa.transitions);
    cursor = tablePtr + dfa.transitions.byteLength + 7 & ~7;
    const acceptPtr = cursor;
    bytes.set(dfa.accepting, acceptPtr);
    cursor = acceptPtr + dfa.accepting.byteLength + 7 & ~7;
    const commitPtr = cursor;
    bytes.set(dfa.commitBefore, commitPtr);
    cursor = commitPtr + dfa.commitBefore.byteLength + 7 & ~7;
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
export {
  FROZEN_REGEX_PATTERNS,
  generateRegexFixture,
  scanJSAutomata,
  scanNativeRegExp,
  scanWasmAutomata,
};
