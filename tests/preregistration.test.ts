import { validatePreregistration } from "../lib/preregistration.ts";
import { assert, assertEquals } from "./assert.ts";

async function fixture(): Promise<Record<string, unknown>> {
  return JSON.parse(
    await Deno.readTextFile("experiments/m1-chrome-sum-u32-v1/preregistration.json"),
  );
}

type MutablePreregistration = Record<string, unknown> & {
  source: {
    measurementSourceCommit: string;
    benchmark: Record<string, unknown>;
    buildManifest: Record<string, unknown>;
    input: Record<string, unknown>;
    variants: Array<Record<string, unknown>>;
  };
  strata: Array<Record<string, unknown>>;
  pairing: Record<string, unknown> & {
    schedule: Array<Record<string, unknown> & { order: string[] }>;
  };
  statistics: Record<string, unknown> & {
    sequentialProtection: Record<string, unknown>;
    bootstrap: Record<string, unknown>;
  };
  accounting: Record<string, unknown>;
  instrumentation: {
    headline: Record<string, unknown>;
    diagnostics: Record<string, unknown>;
  };
  permitEnvelope: Record<string, unknown>;
};

async function rejects(
  mutate: (value: MutablePreregistration) => void,
  label: string,
): Promise<void> {
  const value = structuredClone(await fixture()) as MutablePreregistration;
  mutate(value);
  const result = await validatePreregistration(value);
  assert(!result.ok, `${label}: ${result.errors.join("; ")}`);
}

Deno.test("frozen M1 preregistration validates and public copy is exact", async () => {
  const value = await fixture();
  const result = await validatePreregistration(value);
  assert(result.ok, result.errors.join("; "));
  assertEquals(
    await Deno.readTextFile("experiments/m1-chrome-sum-u32-v1/preregistration.json"),
    await Deno.readTextFile("public/experiments/m1-chrome-sum-u32-v1.json"),
  );
  assertEquals((value.pairing as MutablePreregistration["pairing"]).schedule.length, 120);
});

Deno.test("preregistration rejects changed source, build, artifact, and input hashes", async () => {
  const mutations: Array<(value: MutablePreregistration) => void> = [
    (value) => value.source.measurementSourceCommit = "b".repeat(40),
    (value) => value.source.benchmark.sha256 = "b".repeat(64),
    (value) => value.source.buildManifest.sha256 = "b".repeat(64),
    (value) => value.source.input.sha256 = "b".repeat(64),
    (value) => value.source.variants[0].sha256 = "b".repeat(64),
    (value) => value.source.variants[1].sha256 = "b".repeat(64),
  ];
  for (const mutate of mutations) await rejects(mutate, "identity mutation");
});

Deno.test("preregistration rejects missing caps, pooled strata, and invalid schedules", async () => {
  await rejects((value) => delete value.strata[0].fixedCapPairedLaunches, "missing cap");
  await rejects((value) => value.pairing.strataPoolingAllowed = true, "pooled strata");
  await rejects((value) => value.pairing.schedule[0].order.reverse(), "wrong order");
  await rejects((value) => value.pairing.schedule.pop(), "short schedule");
  await rejects((value) => value.strata[1].minimumPairedLaunches = 10, "weaker floor");
});

Deno.test("preregistration rejects weaker confidence, retries, and substitutions", async () => {
  await rejects(
    (value) => value.statistics.sequentialProtection.twoSidedConfidenceLevelPerLook = 0.95,
    "weaker confidence",
  );
  await rejects((value) => value.statistics.bootstrap.resamples = 9999, "bootstrap mutation");
  await rejects((value) => value.pairing.retriesAllowed = true, "retry enabled");
  await rejects((value) => value.pairing.substitutionsAllowed = true, "substitution enabled");
});

Deno.test("preregistration rejects unavailable-as-zero and diagnostics in headline cells", async () => {
  await rejects(
    (value) => value.accounting.unavailableMetricPolicy = "zero",
    "unavailable normalized to zero",
  );
  await rejects(
    (value) => value.instrumentation.diagnostics.unavailableMetricPolicy = "zero",
    "diagnostic unavailable normalized to zero",
  );
  await rejects(
    (value) => value.instrumentation.headline.profilerEnabled = true,
    "profiled headline",
  );
  await rejects(
    (value) => value.instrumentation.diagnostics.neverEnterHeadlineCells = false,
    "diagnostic entered headline",
  );
});

Deno.test("preregistration permit remains bounded, single-use, and uninstantiated", async () => {
  await rejects((value) => value.permitEnvelope.state = "authorized", "implicit authorization");
  await rejects((value) => value.permitEnvelope.singleUse = false, "reusable permit");
  await rejects((value) => value.permitEnvelope.maximumOwnedBrowserLaunches = 121, "wider permit");
  await rejects((value) => value.permitEnvelope.deadlineRequired = false, "missing deadline");
  await rejects(
    (value) => value.permitEnvelope.exactOrigin = "http://127.0.0.1:9999",
    "origin drift",
  );
  await rejects((value) => value.permitEnvelope.exactBinarySha256 = "b".repeat(64), "binary drift");
});

Deno.test("closed preregistration schema rejects undeclared fields", async () => {
  await rejects((value) => value.statistics.secret = "not allowed", "additional field");
});
