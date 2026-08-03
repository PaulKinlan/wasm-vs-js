const ENCODER = new TextEncoder();
const DECODER = new TextDecoder("utf-8", { fatal: true });
export const WORKLOAD_ID = "serialization.json-telemetry.v1";
export const VARIANTS = Object.freeze(["js-controlled", "wasm-linear-controlled"]);
export const REGISTERED_COUNTS = Object.freeze([1_000, 100_000, 1_000_000]);
export const GENERATOR_SEED = 0x7e1e2026;
export const GENERATOR_REVISION = "telemetry-generator-v1";
export const MAX_INPUT_BYTES = 192 * 1024 * 1024;
const REGIONS = Object.freeze(["ap", "eu", "na", "sa"]);
const KINDS = Object.freeze(["click", "purchase", "view"]);
const LABELS = Object.freeze(["Café", "東京", "مرحبا", "🚀"]);
const TAGS = Object.freeze(["α", "数据", "mañana", "🧪"]);
// Vocabulary encoding is module initialization work, outside every registered parse/output run.
const encodeVocabulary = (values) => Object.freeze(values.map((value) => ENCODER.encode(value)));
const REGION_BYTES = encodeVocabulary(REGIONS);
const KIND_BYTES = encodeVocabulary(KINDS);
const LABEL_BYTES = encodeVocabulary(LABELS);
const TAG_BYTES = encodeVocabulary(TAGS);
export const CONTROLLED_JS_ALLOCATION_LABELS = Object.freeze([
  "parser-state",
  "kind-count-vector",
  "region-count-vector",
  "summary-aggregate",
  "canonical-summary-text",
  "canonical-summary-bytes",
]);

export function assertControlledJSAllocationTrace(labels) {
  if (
    !Array.isArray(labels) || labels.length !== CONTROLLED_JS_ALLOCATION_LABELS.length ||
    labels.some((label, index) => label !== CONTROLLED_JS_ALLOCATION_LABELS[index])
  ) {
    throw new Error("controlled JavaScript allocation trace mismatch");
  }
}

function allocationProbe(onAllocation) {
  let count = 0;
  return {
    allocate(label, value) {
      if (label !== CONTROLLED_JS_ALLOCATION_LABELS[count]) {
        throw new Error(`allocation ${count} must be ${CONTROLLED_JS_ALLOCATION_LABELS[count]}`);
      }
      count++;
      onAllocation?.(label);
      return value;
    },
    finish() {
      if (count !== CONTROLLED_JS_ALLOCATION_LABELS.length) {
        throw new Error(
          `expected ${CONTROLLED_JS_ALLOCATION_LABELS.length} allocations, observed ${count}`,
        );
      }
      return count;
    },
  };
}

function xorshift32(state) {
  state ^= state << 13;
  state ^= state >>> 17;
  state ^= state << 5;
  return state >>> 0;
}

export function generateTelemetryFixture(recordCount) {
  if (!Number.isInteger(recordCount) || recordCount < 0 || recordCount > 1_000_000) {
    throw new RangeError("record count must be an integer from 0 through 1,000,000");
  }
  const chunks = [ENCODER.encode("[")];
  let chunk = "";
  let state = GENERATOR_SEED;
  for (let id = 0; id < recordCount; id++) {
    state = xorshift32(state);
    const region = REGIONS[state & 3];
    state = xorshift32(state);
    const kind = KINDS[state % 3];
    state = xorshift32(state);
    const ok = (state & 7) !== 0;
    state = xorshift32(state);
    const value = state % 10_000;
    state = xorshift32(state);
    const label = LABELS[state & 3];
    state = xorshift32(state);
    const tag = TAGS[state & 3];
    chunk += `${id === 0 ? "" : ","}{"id":${id},"ts":${
      1_700_000_000 + id
    },"region":"${region}","kind":"${kind}","ok":${
      ok ? "true" : "false"
    },"value":${value},"meta":{"label":"${label}","tag":"${tag}"}}`;
    if (chunk.length >= 1_048_576) {
      chunks.push(ENCODER.encode(chunk));
      chunk = "";
    }
  }
  if (chunk) chunks.push(ENCODER.encode(chunk));
  chunks.push(ENCODER.encode("]"));
  const length = chunks.reduce((total, bytes) => total + bytes.length, 0);
  if (length > MAX_INPUT_BYTES) throw new RangeError("generated fixture exceeds input byte limit");
  const output = new Uint8Array(length);
  let offset = 0;
  for (const bytes of chunks) {
    output.set(bytes, offset);
    offset += bytes.length;
  }
  return output;
}

class Cursor {
  constructor(bytes) {
    if (!(bytes instanceof Uint8Array)) throw new TypeError("fixture must be Uint8Array");
    if (bytes.length > MAX_INPUT_BYTES) throw new RangeError("fixture exceeds input byte limit");
    // Exact UTF-8 vocabulary matching validates every non-ASCII sequence during the single parse pass.
    this.bytes = bytes;
    this.i = 0;
  }
  byte(value) {
    if (this.bytes[this.i++] !== value) throw new SyntaxError(`unexpected byte at ${this.i - 1}`);
  }
  ascii(value) {
    for (let i = 0; i < value.length; i++) this.byte(value.charCodeAt(i));
  }
  uint() {
    const start = this.i;
    let value = 0;
    while (this.i < this.bytes.length) {
      const digit = this.bytes[this.i] - 48;
      if (digit < 0 || digit > 9) break;
      if (this.i > start && this.bytes[start] === 48) throw new SyntaxError("leading zero denied");
      value = value * 10 + digit;
      if (!Number.isSafeInteger(value)) throw new RangeError("integer exceeds safe range");
      this.i++;
    }
    if (this.i === start) throw new SyntaxError("unsigned integer required");
    return value;
  }
  oneOfBytes(values) {
    this.byte(34);
    for (let index = 0; index < values.length; index++) {
      const candidate = values[index];
      let matches = this.i + candidate.length < this.bytes.length;
      for (let j = 0; matches && j < candidate.length; j++) {
        matches = this.bytes[this.i + j] === candidate[j];
      }
      if (matches && this.bytes[this.i + candidate.length] === 34) {
        this.i += candidate.length + 1;
        return index;
      }
    }
    throw new SyntaxError(`string outside frozen vocabulary at ${this.i}`);
  }
  boolean() {
    if (this.bytes[this.i] === 116) {
      this.ascii("true");
      return true;
    }
    this.ascii("false");
    return false;
  }
  done() {
    if (this.i !== this.bytes.length) throw new SyntaxError(`trailing bytes at ${this.i}`);
  }
}

function canonicalSummary(summary) {
  return `{"count":${summary.count},"errorCount":${summary.errorCount},"kind":{"click":${
    summary.kind[0]
  },"purchase":${summary.kind[1]},"view":${
    summary.kind[2]
  }},"okCount":${summary.okCount},"region":{"ap":${summary.region[0]},"eu":${
    summary.region[1]
  },"na":${summary.region[2]},"sa":${summary.region[3]}},"valueSum":${summary.valueSum}}`;
}

export function runTelemetryJS(bytes, options = {}) {
  const probe = allocationProbe(options.onAllocation);
  const c = probe.allocate("parser-state", new Cursor(bytes));
  const kind = probe.allocate("kind-count-vector", [0, 0, 0]);
  const regionCounts = probe.allocate("region-count-vector", [0, 0, 0, 0]);
  const summary = probe.allocate("summary-aggregate", {
    count: 0,
    errorCount: 0,
    kind,
    okCount: 0,
    region: regionCounts,
    valueSum: 0,
  });
  c.byte(91);
  while (c.bytes[c.i] !== 93) {
    if (summary.count) c.byte(44);
    c.ascii('{"id":');
    const id = c.uint();
    if (id !== summary.count) throw new SyntaxError("record id is not contiguous");
    c.ascii(',"ts":');
    const timestamp = c.uint();
    if (timestamp !== 1_700_000_000 + id) {
      throw new SyntaxError("timestamp does not match frozen sequence");
    }
    c.ascii(',"region":');
    const region = c.oneOfBytes(REGION_BYTES);
    c.ascii(',"kind":');
    const kind = c.oneOfBytes(KIND_BYTES);
    c.ascii(',"ok":');
    const ok = c.boolean();
    c.ascii(',"value":');
    const value = c.uint();
    if (value > 9_999) throw new RangeError("value exceeds frozen range");
    c.ascii(',"meta":{"label":');
    c.oneOfBytes(LABEL_BYTES);
    c.ascii(',"tag":');
    c.oneOfBytes(TAG_BYTES);
    c.ascii("}}");
    summary.count++;
    summary.region[region]++;
    summary.kind[kind]++;
    summary.okCount += ok ? 1 : 0;
    summary.errorCount += ok ? 0 : 1;
    summary.valueSum += value;
  }
  c.byte(93);
  c.done();
  const summaryText = probe.allocate("canonical-summary-text", canonicalSummary(summary));
  const outputBytes = probe.allocate("canonical-summary-bytes", ENCODER.encode(summaryText));
  const allocations = probe.finish();
  return {
    outputBytes,
    text: summaryText,
    summary,
    counters: Object.freeze({
      records: summary.count,
      "input-bytes": bytes.length,
      "numeric-values": summary.count * 3,
      "string-values": summary.count * 4,
      booleans: summary.count,
      "query-aggregates": 11,
      "output-bytes": outputBytes.length,
      allocations,
      "boundary-crossings": 0,
    }),
  };
}

export async function runTelemetryWasm(bytes, wasmBytes) {
  if (!(wasmBytes instanceof Uint8Array)) throw new TypeError("wasmBytes must be Uint8Array");
  const { instance } = await WebAssembly.instantiate(wasmBytes, {});
  const exports = instance.exports;
  const memory = exports.memory;
  if (!(memory instanceof WebAssembly.Memory)) throw new Error("Wasm memory export missing");
  // Place caller-owned bytes after the linked module's complete initial image and stack.
  const inputOffset = memory.buffer.byteLength;
  const outputOffset = inputOffset + bytes.length + 16;
  const requiredPages = Math.ceil((outputOffset + 512) / 65_536);
  if (requiredPages > 4096) {
    throw new RangeError("fixture exceeds fixed 256 MiB Wasm memory maximum");
  }
  const currentPages = memory.buffer.byteLength / 65_536;
  if (requiredPages > currentPages) memory.grow(requiredPages - currentPages);
  new Uint8Array(memory.buffer, inputOffset, bytes.length).set(bytes);
  const outputLength = exports.process(inputOffset, bytes.length, outputOffset, 512);
  if (outputLength < 0) {
    throw new SyntaxError(`Wasm parser rejected fixture with code ${outputLength}`);
  }
  const outputBytes = new Uint8Array(outputLength);
  outputBytes.set(new Uint8Array(memory.buffer, outputOffset, outputLength));
  const text = DECODER.decode(outputBytes);
  const summary = parseCanonicalSummary(text);
  const records = Number(exports.get_records());
  return {
    outputBytes,
    text,
    summary,
    counters: Object.freeze({
      records,
      "input-bytes": Number(exports.get_input_bytes()),
      "numeric-values": Number(exports.get_numeric_values()),
      "string-values": Number(exports.get_string_values()),
      booleans: Number(exports.get_booleans()),
      "query-aggregates": Number(exports.get_query_aggregates()),
      "output-bytes": outputLength,
      allocations: Number(exports.get_allocations()),
      "boundary-crossings": 2,
    }),
  };
}

function parseCanonicalSummary(text) {
  // Summary decoding is outside controlled computation; enforce exact canonical form after decode.
  const value = JSON.parse(text);
  const summary = {
    count: value.count,
    errorCount: value.errorCount,
    kind: [value.kind.click, value.kind.purchase, value.kind.view],
    okCount: value.okCount,
    region: [value.region.ap, value.region.eu, value.region.na, value.region.sa],
    valueSum: value.valueSum,
  };
  if (canonicalSummary(summary) !== text) {
    throw new SyntaxError("non-canonical Wasm summary denied");
  }
  return summary;
}

export async function sha256Hex(bytes) {
  return Array.from(
    new Uint8Array(await crypto.subtle.digest("SHA-256", bytes)),
    (byte) => byte.toString(16).padStart(2, "0"),
  ).join("");
}
