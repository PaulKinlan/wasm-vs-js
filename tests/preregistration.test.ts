// deno-lint-ignore-file no-explicit-any
import { validatePreregistration } from "../lib/preregistration.ts";
import { assert, assertEquals } from "./assert.ts";

async function fixture(): Promise<Record<string, any>> {
  return JSON.parse(
    await Deno.readTextFile("experiments/m1-chrome-sum-u32-v1/preregistration.json"),
  );
}

async function rejects(mutate: (value: Record<string, any>) => void, label: string): Promise<void> {
  const value = structuredClone(await fixture());
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
  assertEquals(value.pairing.schedule.length, 120);
  assertEquals(value.strata.map((entry: any) => entry.fixedCapAttemptedLaunches), [60, 60]);
});

Deno.test("all experiment, source, input, oracle, variant, browser, and origin identities are immutable", async () => {
  const mutations: Array<[string, (value: Record<string, any>) => void]> = [
    ["experiment", (value) => value.experimentId = "other"],
    ["source commit", (value) => value.source.measurementSourceCommit = "b".repeat(40)],
    ["benchmark path", (value) => value.source.benchmark.path = "other.json"],
    ["benchmark hash", (value) => value.source.benchmark.sha256 = "b".repeat(64)],
    ["manifest path", (value) => value.source.buildManifest.path = "other.json"],
    ["input hash", (value) => value.source.input.sha256 = "b".repeat(64)],
    ["input bytes", (value) => value.source.input.bytes = 1],
    ["input items", (value) => value.source.input.items = 1],
    ["input seed", (value) => value.source.input.seed = "0x0"],
    ["oracle value", (value) => value.source.oracle.value = 0],
    ["oracle kind", (value) => value.source.oracle.kind = "approximate"],
    ["JS target", (value) => value.source.variants[0].target = "host"],
    ["JS path", (value) => value.source.variants[0].artifact = "other.js"],
    ["Wasm hash", (value) => value.source.variants[1].sha256 = "b".repeat(64)],
    ["browser path", (value) => value.browserPolicy.executablePath = "/tmp/chrome"],
    ["browser hash", (value) => value.browserPolicy.executableSha256 = "b".repeat(64)],
    ["browser version", (value) => value.browserPolicy.version = "150.0.0.0"],
    ["browser flags", (value) => value.browserPolicy.requiredLaunchArguments.push("--foo")],
    ["origin", (value) => value.originPolicy.exactOrigin = "http://127.0.0.1:9999"],
  ];
  for (const [label, mutate] of mutations) await rejects(mutate, label);
});

Deno.test("strata, attempted checkpoints, complete global schedule, and cache evidence are immutable", async () => {
  const mutations: Array<[string, (value: Record<string, any>) => void]> = [
    ["minimum committed", (value) => value.strata[0].minimumCommittedPairsForAnalysis = 10],
    ["attempt cap", (value) => value.strata[0].fixedCapAttemptedLaunches = 61],
    ["checkpoint", (value) => value.strata[1].attemptCheckpoints[0] = 19],
    ["cache requirement", (value) => value.strata[0].evidenceRequirements[0] = "trust assertion"],
    ["schedule row", (value) => value.pairing.schedule[0].order.reverse()],
    ["schedule global order", (value) => value.pairing.schedule.reverse()],
    ["short schedule", (value) => value.pairing.schedule.pop()],
    ["commit rule", (value) => value.pairing.commitRule = "commit anything"],
    ["retry", (value) => value.pairing.retriesAllowed = true],
    ["pooling", (value) => value.pairing.strataPoolingAllowed = true],
  ];
  for (const [label, mutate] of mutations) await rejects(mutate, label);
});

Deno.test("estimators, exact interval, descriptive bootstrap, precision and stopping are immutable", async () => {
  const mutations: Array<[string, (value: Record<string, any>) => void]> = [
    ["within statistic", (value) => value.statistics.withinLaunchVariantStatistic = "mean"],
    ["point estimator", (value) => value.statistics.pairedEstimator.point = "mean"],
    [
      "absolute estimator",
      (value) => value.statistics.pairedEstimator.absoluteEffect.point = "mean",
    ],
    ["interval algorithm", (value) => value.statistics.confidenceInterval.algorithm = "bootstrap"],
    [
      "interval alpha",
      (value) => value.statistics.confidenceInterval.twoSidedAlphaPerAttemptLook = 0.05,
    ],
    ["bootstrap seed", (value) => value.statistics.descriptiveBootstrap.baseSeed = "0x0"],
    [
      "bootstrap transition",
      (value) => value.statistics.descriptiveBootstrap.stateTransition = "random",
    ],
    ["bootstrap role", (value) => value.statistics.descriptiveBootstrap.role = "confidence"],
    [
      "checkpoint rule",
      (value) => value.statistics.sequentialProtection.analysisAtCheckpoint = "peek anytime",
    ],
    ["precision", (value) => value.statistics.precision.targetMaximum = 0.05],
    ["stop rule", (value) => value.statistics.stopRules[2] = "retry until complete"],
  ];
  for (const [label, mutate] of mutations) await rejects(mutate, label);
});

Deno.test("accounting, instrumentation, permit, and authorization wording are immutable", async () => {
  const mutations: Array<[string, (value: Record<string, any>) => void]> = [
    ["status", (value) => value.accounting.statuses[0] = "ignored"],
    ["account reconciliation", (value) => value.accounting.checkpointAccounting = "omit failures"],
    ["terminal label", (value) => value.accounting.terminalLabels[1] = "pass"],
    ["unavailable zero", (value) => value.accounting.unavailableMetricPolicy = "zero"],
    ["headline profiler", (value) => value.instrumentation.headline.profilerEnabled = true],
    [
      "diagnostic headline",
      (value) => value.instrumentation.diagnostics.neverEnterHeadlineCells = false,
    ],
    ["permit state", (value) => value.permitEnvelope.state = "authorized-and-consumed"],
    ["permit bound", (value) => value.permitEnvelope.maximumOwnedBrowserLaunches = 121],
    [
      "authorization wording",
      (value) => value.permitEnvelope.authorizationStatement = "authorized and consumed",
    ],
    ["publication", (value) => value.publication.missingEvidenceNeverPasses = false],
  ];
  for (const [label, mutate] of mutations) await rejects(mutate, label);
});

Deno.test("closed const schema rejects undeclared fields", async () => {
  await rejects((value) => value.statistics.secret = "not allowed", "additional field");
});
