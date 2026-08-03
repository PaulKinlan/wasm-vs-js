// Deterministic Multilingual Text Corpus & Regex Pattern Suite
// Seed: 0xREGEX2026 (3990888486) using SplitMix64 PRNG

export interface RegexPatternSpec {
  id: number;
  pattern: string;
  isLiteral: boolean;
  description: string;
}

export interface RegexMatchResult {
  patternId: number;
  startCP: number;
  endCP: number;
  matchText: string;
}

export interface RegexFixture {
  seed: number;
  text: string;
  textCodePoints: number;
  patterns: RegexPatternSpec[];
  textBuffer: Uint8Array;
}

class SplitMix64 {
  private state: bigint;

  constructor(seed: bigint) {
    this.state = seed;
  }

  nextUint32(): number {
    this.state = (this.state + 0x9e3779b97f4a7c15n) & 0xffffffffffffffffn;
    let z = this.state;
    z = ((z ^ (z >> 30n)) * 0xbf58476d1ce4e5b9n) & 0xffffffffffffffffn;
    z = ((z ^ (z >> 27n)) * 0x94d049bb133111ebn) & 0xffffffffffffffffn;
    return Number((z ^ (z >> 31n)) & 0xffffffffn) >>> 0;
  }

  nextIntRange(min: number, max: number): number {
    const span = max - min + 1;
    return min + (this.nextUint32() % span);
  }
}

export const REGEX_SEED = 0xed022026;
export const REGEX_CORPUS_SIZE = 1024 * 1024; // 1 MiB BMP text corpus

export const FROZEN_REGEX_PATTERNS: RegexPatternSpec[] = [
  { id: 0, pattern: "error", isLiteral: true, description: "Simple literal string match" },
  { id: 1, pattern: "HTTP/1.1", isLiteral: true, description: "HTTP protocol string" },
  {
    id: 2,
    pattern: "GET|POST|PUT|DELETE",
    isLiteral: false,
    description: "HTTP method alternation",
  },
  { id: 3, pattern: "[a-zA-Z0-9_-]+", isLiteral: false, description: "Identifier character class" },
  {
    id: 4,
    pattern: "\\d{1,3}\\.\\d{1,3}\\.\\d{1,3}\\.\\d{1,3}",
    isLiteral: false,
    description: "IPv4 address regex",
  },
  { id: 5, pattern: "\\w+@\\w+\\.\\w+", isLiteral: false, description: "Simple email pattern" },
  { id: 6, pattern: "https?://[a-zA-Z0-9.-]+", isLiteral: false, description: "URL host pattern" },
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
  { id: 10, pattern: "status=\\d{3}", isLiteral: false, description: "HTTP status code parameter" },
  { id: 11, pattern: "user_[0-9]{4,8}", isLiteral: false, description: "User ID token" },
  { id: 12, pattern: "session-[a-f0-9]{16}", isLiteral: false, description: "Session hash token" },
  { id: 13, pattern: "latency_\\d+ms", isLiteral: false, description: "Latency metric token" },
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
  { id: 16, pattern: "cache_(hit|miss)", isLiteral: false, description: "Cache status tag" },
  { id: 17, pattern: "retry_\\d+", isLiteral: false, description: "Retry count tag" },
  {
    id: 18,
    pattern: "version_v\\d+\\.\\d+\\.\\d+",
    isLiteral: false,
    description: "Semantic version tag",
  },
  { id: 19, pattern: "build_\\d{8}", isLiteral: false, description: "Build date tag" },
];

export function generateRegexFixture(
  seed = REGEX_SEED,
  sizeBytes = REGEX_CORPUS_SIZE,
): RegexFixture {
  const prng = new SplitMix64(BigInt(seed));
  const chars: string[] = [];

  const ALPHABET = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789 _-./:=[]";

  // Embedded log fragments to inject
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
  const encoder = new TextEncoder();
  const textBuffer = encoder.encode(text);

  return {
    seed,
    text,
    textCodePoints: text.length, // BMP constrained
    patterns: FROZEN_REGEX_PATTERNS,
    textBuffer,
  };
}
