import Ajv2020Module from "ajv2020";
import { assert, assertEquals, assertRejects } from "./assert.ts";
import { sha256Hex } from "../lib/canonical.ts";
import { ControlledSha256 } from "../benchmarks/base/crypto-file-integrity/sha256.js";
import {
  assertExactValidationEvidence,
  expectedCaseKeys,
} from "../benchmarks/base/crypto-file-integrity/validation.js";
import {
  countersFor,
  generateFixture,
  instantiateWasm,
  resolveChunkSize,
  runJavaScript,
  runWasm,
} from "../benchmarks/base/crypto-file-integrity/workload.js";
import { handler } from "../server.ts";

const Ajv2020 = (Ajv2020Module as unknown as { default?: typeof Ajv2020Module }).default ??
  Ajv2020Module;
const registration = JSON.parse(
  await Deno.readTextFile("registrations/base/crypto.file-integrity.v1.json"),
);
const evidence = JSON.parse(
  await Deno.readTextFile("evidence/base/crypto.file-integrity.v1/validation.json"),
);
const ledger = JSON.parse(await Deno.readTextFile("catalog/base-implementation-status.v1.json"));
const wasmBytes = await Deno.readFile(
  "public/artifacts/crypto-file-integrity/crypto-file-integrity.wasm",
);

Deno.test("base crypto supplement preserves frozen catalog bytes and remains 0/38 before browser evidence", async () => {
  assertEquals(
    await sha256Hex(await Deno.readFile("catalog/workloads.v1.json")),
    "6665664f984683e5b7d3fdc8c1602198124844704c224a526d48be2f02edf9d4",
  );
  assertEquals(
    await Deno.readFile("catalog/workloads.v1.json"),
    await Deno.readFile("public/data/workloads.v1.json"),
  );
  assertEquals(ledger.counts, {
    denominator: 38,
    implemented: 0,
    remaining: 38,
    staticForBrowserCandidates: 1,
  });
  assertEquals(ledger.implemented, []);
  assertEquals(ledger.staticForBrowserCandidates.map((entry: { id: string }) => entry.id), [
    "crypto.file-integrity.v1",
  ]);
  assertEquals(ledger.staticForBrowserCandidates[0].status, "static-for-browser");
  assertEquals(ledger.staticForBrowserCandidates[0].countsTowardCoverage, false);
  assertEquals(ledger.remainingIds.length, 38);
  assert(ledger.remainingIds.includes("crypto.file-integrity.v1"));
  assertEquals(
    await Deno.readTextFile("catalog/base-implementation-status.v1.json"),
    await Deno.readTextFile("public/data/base-implementation-status.v1.json"),
  );
  const schema = JSON.parse(
    await Deno.readTextFile("schemas/base-implementation-status.schema.json"),
  );
  const validate = new (Ajv2020 as unknown as new (
    options: Record<string, unknown>,
  ) => { compile: (schema: unknown) => ((value: unknown) => boolean) & { errors?: unknown } })({
    allErrors: true,
    strict: false,
  }).compile(schema);
  assert(validate(ledger), JSON.stringify(validate.errors));
  const premature = structuredClone(ledger);
  premature.counts.implemented = 1;
  premature.counts.remaining = 37;
  premature.implemented = [structuredClone(premature.staticForBrowserCandidates[0])];
  assert(!validate(premature), "schema accepted premature 1/38 accounting");
});

Deno.test("registration is the exact 2 by 3 by 3 by 2 frozen contract", () => {
  assertEquals(registration.catalogContract.fixtures.kinds, ["seeded-pseudorandom", "all-zero"]);
  assertEquals(registration.catalogContract.fixtures.sizesBytes, [1048576, 16777216, 268435456]);
  assertEquals(registration.catalogContract.schedulesBytes, [1024, 65536, "whole-buffer"]);
  assertEquals(registration.catalogContract.variants, ["js-controlled", "wasm-linear-controlled"]);
  assertEquals(registration.fixtures.length, 6);
  assertEquals(registration.fixedWork.casesPerTarget, 18);
  for (const fixture of registration.fixtures) {
    assert(/^[a-f0-9]{64}$/.test(fixture.expectedDigestSha256));
  }
});

Deno.test("controlled JavaScript and material Wasm match standard and boundary vectors", async () => {
  const wasm = await instantiateWasm(wasmBytes);
  const vectors = [
    [new Uint8Array(), "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855"],
    [
      new TextEncoder().encode("abc"),
      "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad",
    ],
    [new Uint8Array(55).fill(0xa5), ""],
    [new Uint8Array(56).fill(0xa5), ""],
    [new Uint8Array(64).fill(0xa5), ""],
    [new Uint8Array(65).fill(0xa5), ""],
  ] as Array<[Uint8Array, string]>;
  for (const [bytes, known] of vectors) {
    const host = await sha256Hex(bytes);
    if (known) assertEquals(host, known);
    for (const schedule of [1024, 65536, "whole-buffer"] as const) {
      assertEquals(runJavaScript(bytes, schedule).digest, host);
      assertEquals(runWasm(wasm, bytes, schedule).digest, host);
    }
  }
});

Deno.test("generator, schedules, counters, and malformed requests are closed", async () => {
  assertEquals(Array.from(generateFixture("seeded-pseudorandom", 8)), [
    31,
    199,
    174,
    64,
    25,
    12,
    224,
    145,
  ]);
  assertEquals(Array.from(generateFixture("all-zero", 8)), [0, 0, 0, 0, 0, 0, 0, 0]);
  assertEquals(resolveChunkSize("whole-buffer", 17), 17);
  assertEquals(countersFor(1048576, 1024, "wasm-linear-controlled"), {
    "input-bytes": 1048576,
    "scheduled-chunks": 1024,
    "sha256-compression-blocks": 16385,
    "copied-bytes": 1048576,
    "boundary-crossings": 1026,
    "engine-buffer-allocations": 0,
  });
  await assertRejects(() => Promise.resolve(generateFixture("unknown", 1)), "unknown fixture kind");
  await assertRejects(
    () => Promise.resolve(generateFixture("all-zero", -1)),
    "invalid fixture byte length",
  );
  await assertRejects(() => Promise.resolve(resolveChunkSize(7, 10)), "unknown chunk schedule");
  await assertRejects(
    () => Promise.resolve(new ControlledSha256().update(new Uint8Array(2), 2, 1)),
    "update range is invalid",
  );
});

Deno.test("retained full validation proves all 36 registered cases and exact counters", async () => {
  const schema = JSON.parse(
    await Deno.readTextFile("schemas/base-crypto-file-integrity-validation.schema.json"),
  );
  const validate = new (Ajv2020 as unknown as new (
    options: Record<string, unknown>,
  ) => { compile: (schema: unknown) => ((value: unknown) => boolean) & { errors?: unknown } })({
    allErrors: true,
    strict: false,
  }).compile(schema);
  assert(validate(evidence), JSON.stringify(validate.errors));
  assertExactValidationEvidence(evidence, registration);
  assertEquals(evidence.status, "static-correctness-validation-awaiting-browser");
  assertEquals(evidence.catalogCoverage, {
    denominator: 38,
    implemented: 0,
    remaining: 38,
    candidateCount: 1,
    countsTowardCoverage: false,
    promotionGate: "retained-browser-validation-required",
  });
  assertEquals(evidence.totals, {
    cases: 36,
    passed: 36,
    failed: 0,
    targets: 2,
    fixtureDefinitions: 6,
    schedules: 3,
  });
  const observedKeys = new Set(
    evidence.cases.map((
      entry: { target: string; kind: string; byteLength: number; schedule: number | string },
    ) => JSON.stringify([entry.target, entry.kind, entry.byteLength, entry.schedule])),
  );
  assertEquals(observedKeys, expectedCaseKeys());
  for (const entry of evidence.cases) {
    assertEquals(entry.digestSha256, entry.expectedDigestSha256);
    assertEquals(entry.passed, true);
    assertEquals(entry.counters, countersFor(entry.byteLength, entry.schedule, entry.target));
  }
});

Deno.test("validation schema and semantic gate reject duplicate and missing Cartesian cases", async () => {
  const schema = JSON.parse(
    await Deno.readTextFile("schemas/base-crypto-file-integrity-validation.schema.json"),
  );
  const validate = new (Ajv2020 as unknown as new (
    options: Record<string, unknown>,
  ) => { compile: (schema: unknown) => ((value: unknown) => boolean) & { errors?: unknown } })({
    allErrors: true,
    strict: false,
  }).compile(schema);

  const exactDuplicate = structuredClone(evidence);
  exactDuplicate.cases[35] = structuredClone(exactDuplicate.cases[0]);
  assert(!validate(exactDuplicate), "schema accepted an exact duplicate case");
  await assertRejects(
    () => Promise.resolve(assertExactValidationEvidence(exactDuplicate, registration)),
    "duplicate validation case",
  );

  const semanticDuplicate = structuredClone(evidence);
  semanticDuplicate.cases[35] = structuredClone(semanticDuplicate.cases[0]);
  semanticDuplicate.cases[35].digestSha256 = "0".repeat(64);
  assert(!validate(semanticDuplicate), "schema accepted a duplicate Cartesian combination");
  await assertRejects(
    () => Promise.resolve(assertExactValidationEvidence(semanticDuplicate, registration)),
    "duplicate validation case",
  );

  const missing = structuredClone(evidence);
  missing.cases.pop();
  assert(!validate(missing), "schema accepted a missing Cartesian case");
  await assertRejects(
    () => Promise.resolve(assertExactValidationEvidence(missing, registration)),
    "exactly 36 cases",
  );
});

Deno.test("artifact rebuild is byte-identical under pinned Clang and LLD", async () => {
  const temp = await Deno.makeTempDir();
  try {
    const output = `${temp}/crypto.wasm`;
    const args = [
      "--target=wasm32-unknown-unknown",
      "-O3",
      "-nostdlib",
      "-Wl,--no-entry",
      "-Wl,--export-memory",
      "-Wl,--initial-memory=196608",
      "-Wl,--max-memory=285343744",
      "-Wl,--strip-all",
      "-o",
      output,
      "benchmarks/base/crypto-file-integrity/sha256.c",
    ];
    const result = await new Deno.Command("clang", { args }).output();
    assert(result.success, new TextDecoder().decode(result.stderr));
    assertEquals(await Deno.readFile(output), wasmBytes);
  } finally {
    await Deno.remove(temp, { recursive: true });
  }
});

Deno.test("public server exposes only read-only registered crypto routes", async () => {
  const routes = [
    "/benchmarks/crypto.file-integrity.v1/",
    "/crypto-file-integrity-demo.js",
    "/crypto-file-integrity-worker.js",
    "/benchmarks/base/crypto-file-integrity/sha256.js",
    "/benchmarks/base/crypto-file-integrity/workload.js",
    "/artifacts/crypto-file-integrity/crypto-file-integrity.wasm",
    "/artifacts/crypto-file-integrity/build-manifest.json",
    "/registrations/base/crypto.file-integrity.v1.json",
    "/evidence/base/crypto.file-integrity.v1/validation.json",
    "/evidence/base/crypto.file-integrity.v1/validation.schema.json",
    "/data/base-implementation-status.v1.json",
  ];
  for (const route of routes) {
    const status = (await handler(new Request(`http://127.0.0.1${route}`))).status;
    assert(status === 200, `${route} returned ${status}`);
  }
  assert(
    [403, 405].includes(
      (await handler(
        new Request("http://127.0.0.1/demos/crypto.file-integrity.v1/", { method: "POST" }),
      )).status,
    ),
  );
  assertEquals(
    (await handler(new Request("http://127.0.0.1/artifacts/crypto-file-integrity/not-listed.wasm")))
      .status,
    404,
  );
});

Deno.test("demo lifecycle is fresh-worker, cancellable, bounded, stale-safe, and non-persistent", async () => {
  const page = await Deno.readTextFile("public/demos/crypto.file-integrity.v1/index.html");
  const runner = await Deno.readTextFile("public/crypto-file-integrity-demo.js");
  const worker = await Deno.readTextFile("public/crypto-file-integrity-worker.js");
  for (
    const text of [
      "No performance claim",
      "uploads and stores nothing",
      'aria-live="polite"',
      "Start",
      "Cancel",
      "256 MiB",
      "4,098 pages",
    ]
  ) assert(page.includes(text), text);
  assert(!page.includes("4,099 pages"));
  for (
    const text of ["new Worker", "worker.terminate()", "runToken !== token", "pagehide", "180000"]
  ) assert(runner.includes(text), text);
  assert(
    !`${page}${runner}${worker}`.match(
      /localStorage|indexedDB|fetch\([^)]*,\s*\{[^}]*method:\s*["']POST/i,
    ),
  );
});
