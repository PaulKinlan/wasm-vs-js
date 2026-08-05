import { sha256Hex } from "./canonical.ts";

export const PROTOBUF_SOURCE = {
  commit: "7a30660591956b0db7ba64b2e051ad90344473ac",
  tree: "e2b769d91a5a34e5bc694a221ea76564c5bbe3b5",
  workload: "serialization.protobuf-gateway.v1",
} as const;

export const PROTOBUF_CFT = {
  channel: "chrome-for-testing",
  product: "Chrome/150.0.7871.24",
  version: "150.0.7871.24",
  sourceExecutable: "/home/paulkinlan/.local/bin/google-chrome-stable",
  binarySha256: "dea3ab8fba923b718920ef9d62570824f2dc0ab0c72d66d53f91b41de6570355",
  packageManifestSha256: "e3d5088a5244a494b206819630d4eb2d7e3ee999d1a04cab9d2d95d0daf292db",
  extraArguments: [
    "--enable-automation",
    "--headless=new",
    "--disable-gpu",
    "--hide-scrollbars",
    "--window-size=1440,1200",
  ],
} as const;

export const PROTOBUF_ROUTE_HASHES = {
  "/benchmarks/serialization-protobuf-gateway/":
    "e6ae66ee1267d2ad5d670c850af11728a8ae8b7577c98e18867080859cce2704",
  "/benchmarks/serialization-protobuf-gateway/protobuf-runner.js":
    "79ed576790161631bff18905e8cd9e07286b8b41833187b7622f083edc2bb444",
  "/benchmarks/serialization-protobuf-gateway/protobuf-worker.js":
    "e145533fffcebfc59a2589680f3142d0449e414c1ac86f6a7b8b8fb6abf56705",
  "/benchmarks/base/serialization-protobuf-gateway/workload.js":
    "f344d7a5e084b792a5354f8edd805893377dd65814ba14528f63b10b153b9214",
  "/benchmarks/base/serialization-protobuf-gateway/implementation-contract.v1.json":
    "705729301e84f4aefb0f9f76081c7f20e15ecbb291fe58f7da6d72b646e44cfc",
  "/artifacts/serialization-protobuf-gateway/serialization-protobuf-gateway.wasm":
    "fc1aadc10019f26472b9f0d98d51103cdb86941ed32767189d959a244e6fd938",
  "/artifacts/serialization-protobuf-gateway/fixture-manifest.json":
    "4b71993a213860b1972696a7dbc3d8d51a5984e436c06495acd0952682eee421",
  "/artifacts/serialization-protobuf-gateway/output-manifest.json":
    "cc0a8e47fdac91129fa228ee6a87b38aab61a03ecadbc0d82e7e3563bda01adc",
  "/artifacts/serialization-protobuf-gateway/build-manifest.json":
    "7a477ceec803b3792768bcf0bad10b2bf3a19c8602ea12f671a81ec723c1d440",
  "/styles.css": "70e73af276a14dc39b7863f586ee6aca89c2e986dffed32e71cf799ef35e3a6b",
  "/favicon.ico": "ee6c407626f2432b805e7c07252226f0b7852a591f1562fbbb0f31e0f786dffc",
} as const;

export const PROTOBUF_EXPECTED_COUNTERS = {
  messages: 10_000,
  fields: 170_294,
  varintBytes: 474_984,
  unknownFields: 40_000,
  filteredMessages: 1_703,
  wireBytes: 1_534_122,
  protoJsonBytes: 354_976,
} as const;

export const PROTOBUF_SEMANTIC_CHECKS = [
  "complete-10000-message-framing",
  "ten-byte-negative-int32-unknown-enum",
  "known-positive-enum",
  "unknown-positive-enum",
  "signed-zero-double",
  "signed-zero-float",
  "fractional-double",
  "fractional-float",
  "utf8-map-key-order",
  "json-quote-backslash-newline-escaping",
  "complete-cross-target-byte-identity",
  "exact-counter-and-output-oracle",
] as const;

const OUTPUT_SHA256 = "4539813029587b58d20441ef6b95174dc86c2546b0becbf23ca1b48a6f0c8c9a";
const FIXTURE_SHA256 = "624f17efb27799018a020cec7337c2d365d48a9d2995bf39a2c5bcff325a883a";
const ENUM_COUNTS: Record<string, number> = {
  "-1": 20,
  "0": 2486,
  "1": 2485,
  "2": 2485,
  "3": 2486,
  "99": 38,
};

function equal(actual: unknown, expected: unknown, label: string): void {
  if (JSON.stringify(actual) !== JSON.stringify(expected)) throw new Error(`${label} mismatch`);
}

function readVarint(bytes: Uint8Array, start: number): [bigint, number, number] {
  let value = 0n;
  for (let i = 0; i < 10; i++) {
    if (start + i >= bytes.length) throw new Error("parent oracle truncated varint");
    const byte = bytes[start + i];
    value |= BigInt(byte & 0x7f) << BigInt(i * 7);
    if ((byte & 0x80) === 0) {
      if (i === 9 && byte > 1) throw new Error("parent oracle varint overflow");
      return [value, start + i + 1, i + 1];
    }
  }
  throw new Error("parent oracle unterminated varint");
}

function inspectEnumWire(
  fixture: Uint8Array,
): { counts: Record<string, number>; negativeWidths: number[] } {
  if (fixture.byteLength < 4) throw new Error("parent oracle fixture framing truncated");
  const view = new DataView(fixture.buffer, fixture.byteOffset, fixture.byteLength);
  const messages = view.getUint32(0, true);
  if (messages !== 10_000) throw new Error("parent oracle message count mismatch");
  let frameAt = 4;
  const counts: Record<string, number> = {};
  const negativeWidths: number[] = [];
  for (let message = 0; message < messages; message++) {
    if (frameAt + 4 > fixture.length) throw new Error("parent oracle frame length truncated");
    const length = view.getUint32(frameAt, true);
    frameAt += 4;
    const end = frameAt + length;
    if (end > fixture.length) throw new Error("parent oracle message truncated");
    let at = frameAt;
    while (at < end) {
      const [tag, afterTag] = readVarint(fixture.subarray(0, end), at);
      at = afterTag;
      const field = Number(tag >> 3n), wire = Number(tag & 7n);
      if (wire === 0) {
        const [raw, next, width] = readVarint(fixture.subarray(0, end), at);
        if (field === 5) {
          const value = Number(BigInt.asIntN(32, raw));
          counts[String(value)] = (counts[String(value)] ?? 0) + 1;
          if (value < 0) negativeWidths.push(width);
        }
        at = next;
      } else if (wire === 1) at += 8;
      else if (wire === 2) {
        const [lengthValue, next] = readVarint(fixture.subarray(0, end), at);
        at = next + Number(lengthValue);
      } else if (wire === 5) at += 4;
      else throw new Error("parent oracle unsupported wire type");
      if (at > end) throw new Error("parent oracle field exceeded message");
    }
    frameAt = end;
  }
  if (frameAt !== fixture.length) throw new Error("parent oracle trailing fixture bytes");
  return { counts, negativeWidths };
}

type WorkResult = {
  text: string;
  bytes: Uint8Array;
  counters: Record<string, number>;
};

export async function buildProtobufParentOracle(
  fixture: Uint8Array,
  javascript: WorkResult,
  wasm: WorkResult,
): Promise<Record<string, unknown>> {
  if (await sha256Hex(fixture) !== FIXTURE_SHA256 || fixture.byteLength !== 1_534_122) {
    throw new Error("parent oracle fixture identity mismatch");
  }
  const wire = inspectEnumWire(fixture);
  equal(wire.counts, ENUM_COUNTS, "parent oracle enum counts");
  if (wire.negativeWidths.length !== 20 || wire.negativeWidths.some((width) => width !== 10)) {
    throw new Error("parent oracle negative enum is not ten-byte int32 wire encoding");
  }
  if (javascript.text !== wasm.text || javascript.bytes.byteLength !== wasm.bytes.byteLength) {
    throw new Error("parent oracle cross-target output mismatch");
  }
  const jsHash = await sha256Hex(javascript.bytes), wasmHash = await sha256Hex(wasm.bytes);
  if (
    jsHash !== OUTPUT_SHA256 || wasmHash !== OUTPUT_SHA256 ||
    javascript.bytes.byteLength !== 354_976
  ) throw new Error("parent oracle output identity mismatch");
  for (const [key, value] of Object.entries(PROTOBUF_EXPECTED_COUNTERS)) {
    if (javascript.counters[key] !== value || wasm.counters[key] !== value) {
      throw new Error(`parent oracle counter mismatch: ${key}`);
    }
  }
  if (javascript.counters.boundaryCrossings !== 0 || wasm.counters.boundaryCrossings !== 1) {
    throw new Error("parent oracle boundary counter mismatch");
  }
  if (javascript.counters.allocations !== 41_705 || wasm.counters.allocations !== 0) {
    throw new Error("parent oracle allocation counter mismatch");
  }
  const text = javascript.text;
  for (
    const fragment of [
      '"status":99',
      '"status":-1',
      '"score":-0',
      '"ratio":-0',
      '"score":26.5',
      '"ratio":34.25',
      '"metrics":{"alpha":"-8","βeta":"2","":"1","𐀀":"2"}',
      'escaped-\\"\\\\-line\\n-',
    ]
  ) {
    if (!text.includes(fragment)) {
      throw new Error(`parent oracle semantic fragment absent: ${fragment}`);
    }
  }
  return {
    fixture: { messages: 10_000, bytes: fixture.byteLength, sha256: FIXTURE_SHA256 },
    output: { bytes: javascript.bytes.byteLength, sha256: OUTPUT_SHA256 },
    enumWireCounts: wire.counts,
    negativeUnknownEnum: { value: -1, occurrences: 20, varintBytesEach: 10 },
    counters: PROTOBUF_EXPECTED_COUNTERS,
    targetBoundaryCrossings: { javascript: 0, wasm: 1 },
    targetAllocations: { javascript: 41_705, wasm: 0 },
    checks: [...PROTOBUF_SEMANTIC_CHECKS],
  };
}

function scenarioTargets(evidence: Record<string, unknown>): string[] {
  const scenarios = evidence.scenarios as Array<Record<string, unknown>>;
  return scenarios.map((scenario) => String(scenario.target));
}

export function assertProtobufBrowserEvidenceSemantics(evidence: unknown): void {
  if (!evidence || typeof evidence !== "object" || Array.isArray(evidence)) {
    throw new Error("protobuf browser evidence must be an object");
  }
  const value = evidence as Record<string, unknown>;
  equal(value.source, {
    ...PROTOBUF_SOURCE,
    routeHashes: PROTOBUF_ROUTE_HASHES,
  }, "protobuf evidence source");
  const browser = value.browser as Record<string, unknown>;
  if (
    browser.channel !== PROTOBUF_CFT.channel || browser.product !== PROTOBUF_CFT.product ||
    browser.version !== PROTOBUF_CFT.version ||
    browser.binarySha256 !== PROTOBUF_CFT.binarySha256 ||
    browser.packageManifestSha256 !== PROTOBUF_CFT.packageManifestSha256
  ) throw new Error("protobuf evidence exact CfT identity mismatch");
  const launchArguments = browser.launchArguments as string[];
  for (const argument of PROTOBUF_CFT.extraArguments) {
    if (!launchArguments.includes(argument)) {
      throw new Error(`protobuf launch argument absent: ${argument}`);
    }
  }
  for (
    const argument of [
      "--remote-debugging-port=0",
      "--no-first-run",
      "--no-default-browser-check",
      "--disable-sync",
      "--disable-crash-reporter",
      "--disable-breakpad",
      "about:blank",
    ]
  ) {
    if (!launchArguments.includes(argument)) {
      throw new Error(`protobuf base launch argument absent: ${argument}`);
    }
  }
  if (
    launchArguments.filter((argument) => argument.startsWith("--user-data-dir=")).length !== 1 ||
    !launchArguments.some((argument) =>
      argument.startsWith("--user-data-dir=/tmp/wasm-vs-js-owned-profiles/")
    )
  ) throw new Error("protobuf owned profile launch argument mismatch");
  const effectiveArguments = browser.effectiveArguments as string[];
  if (
    !Array.isArray(effectiveArguments) ||
    !launchArguments.every((argument) => effectiveArguments.includes(argument))
  ) throw new Error("protobuf effective launch arguments mismatch");
  const parentOracle = value.parentOracle as Record<string, unknown>;
  equal(
    parentOracle.fixture,
    { messages: 10_000, bytes: 1_534_122, sha256: FIXTURE_SHA256 },
    "fixture oracle",
  );
  equal(parentOracle.output, { bytes: 354_976, sha256: OUTPUT_SHA256 }, "output oracle");
  equal(parentOracle.enumWireCounts, ENUM_COUNTS, "enum wire counts");
  equal(parentOracle.negativeUnknownEnum, {
    value: -1,
    occurrences: 20,
    varintBytesEach: 10,
  }, "negative enum oracle");
  equal(parentOracle.counters, PROTOBUF_EXPECTED_COUNTERS, "counter oracle");
  equal(parentOracle.targetBoundaryCrossings, { javascript: 0, wasm: 1 }, "boundary oracle");
  equal(parentOracle.targetAllocations, { javascript: 41_705, wasm: 0 }, "allocation oracle");
  equal(parentOracle.checks, PROTOBUF_SEMANTIC_CHECKS, "semantic checks");
  equal(scenarioTargets(value), ["javascript", "wasm"], "scenario target denominator");
  for (const scenario of value.scenarios as Array<Record<string, unknown>>) {
    if (scenario.mode !== "exact" || scenario.finalStatus !== "complete") {
      throw new Error("protobuf scenario did not complete exact mode");
    }
    equal(scenario.lifecycle, ["ready", "running", "complete", "worker-absent"], "lifecycle");
    const result = scenario.result as Record<string, unknown>;
    if (
      result.target !== scenario.target || result.mode !== scenario.mode ||
      result.digest !== OUTPUT_SHA256 || result.outputBytes !== 354_976 ||
      (result.exact as Record<string, unknown>)?.verifiedRawBytes !== 6
    ) throw new Error("protobuf end-result oracle mismatch");
    const counters = result.counters as Record<string, unknown>;
    const own = counters[scenario.target as string] as Record<string, number>;
    const other = counters[scenario.target === "javascript" ? "wasm" : "javascript"];
    if (other !== null) throw new Error("protobuf single-target scenario executed foreign target");
    for (const [key, expected] of Object.entries(PROTOBUF_EXPECTED_COUNTERS)) {
      if (own[key] !== expected) throw new Error(`protobuf browser counter mismatch: ${key}`);
    }
    if (own.boundaryCrossings !== (scenario.target === "javascript" ? 0 : 1)) {
      throw new Error("protobuf browser boundary counter mismatch");
    }
    if (own.allocations !== (scenario.target === "javascript" ? 41_705 : 0)) {
      throw new Error("protobuf browser allocation counter mismatch");
    }
    const network = scenario.network as Array<Record<string, unknown>>;
    if (!network.length || network.some((record) => record.failed === true)) {
      throw new Error("protobuf network denominator incomplete");
    }
    const observed = new Set(network.map((record) => String(record.path)));
    for (const path of Object.keys(PROTOBUF_ROUTE_HASHES)) {
      if (path === "/favicon.ico") continue;
      if (!observed.has(path)) {
        throw new Error(`protobuf route absent from network evidence: ${path}`);
      }
    }
    for (const record of network) {
      const path = String(record.path) as keyof typeof PROTOBUF_ROUTE_HASHES;
      if (
        !(path in PROTOBUF_ROUTE_HASHES) ||
        record.responseBodySha256 !== PROTOBUF_ROUTE_HASHES[path]
      ) {
        throw new Error("protobuf browser raw response trust mismatch");
      }
    }
    if (
      (scenario.console as unknown[]).length || (scenario.exceptions as unknown[]).length ||
      (scenario.logs as Array<Record<string, unknown>>).some((log) => log.level === "error")
    ) {
      throw new Error("protobuf browser console/exception evidence is not clean");
    }
    const screenshot = scenario.screenshot as Record<string, unknown>;
    const accessibility = scenario.accessibility as Record<string, unknown>;
    if (
      Number(screenshot.bytes) < 8 || Number(accessibility.bytes) < 2 ||
      Number(accessibility.nodeCount) < 1
    ) {
      throw new Error("protobuf screenshot/accessibility evidence absent");
    }
  }
  const ownership = value.ownership as Record<string, unknown>;
  if (!(ownership.members as number[]).includes(Number(ownership.mainPid))) {
    throw new Error("protobuf main process is absent from owned cgroup evidence");
  }
  const cleanup = value.cleanup as Record<string, unknown>;
  if (
    cleanup.browserCgroupEmpty !== true || cleanup.profileAbsent !== true ||
    cleanup.chromeStageAbsent !== true || cleanup.serverStopped !== true ||
    cleanup.sourceCheckoutAbsent !== true
  ) throw new Error("protobuf protected cleanup incomplete");
}
