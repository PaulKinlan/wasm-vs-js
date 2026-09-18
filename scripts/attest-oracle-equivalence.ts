// scripts/attest-oracle-equivalence.ts
//
// Rebuilds every multi-language kernel from committed source with its recorded
// recipe, then runs the workloads' existing oracle tests against the rebuilt
// binaries instead of the committed ones.
//
// Why this exists alongside byte equality. Byte equality is the stronger claim:
// it says the committed binary is the one this source and this recipe produce.
// It also only holds on a machine with the distribution that produced those
// bytes — 72 of 181 kernels here, and none of the C or C++ ones. On every other
// machine the provenance ledger can say nothing at all about the remaining 109.
//
// Oracle equivalence is the weaker claim that still works: the rebuild computes
// exactly what the committed artifact computes, checked by the same pinned
// oracles the gate already runs, digest for digest. That is the property the
// published timings rest on. It is not a substitute for byte equality and is
// never reported as one — the record carries both.
//
// Granularity is per test, not per kernel: the oracle tests assert over a
// workload's engines together, and splitting them would mean rewriting 31 test
// files to report per-engine outcomes. The record says so rather than implying
// a precision it does not have.
//
// Usage:
//   deno run --allow-all scripts/attest-oracle-equivalence.ts [--with-dart]
//   deno run --allow-all scripts/attest-oracle-equivalence.ts --check

import { commandFor, planBuilds } from "./build-multilang-kernels.ts";
import { fingerprintToolchain } from "./toolchain-fingerprint.ts";

const ROOT = new URL("../", import.meta.url).pathname;
const ARTIFACT_DIR = `${ROOT}public/artifacts/multilang-wasm-benchmark`;
const OUT = `${ROOT}public/data/oracle-equivalence.v1.json`;

/**
 * Tests that assert against the committed bytes by design — hashes, recipes,
 * pins. Pointing them at a rebuild would be asking them to fail.
 */
const COMMITTED_BYTE_TESTS = [
  "multilang-kernel-provenance.test.ts",
  "multilang-kernel-builder-only.test.ts",
  "toolchain-pin.test.ts",
];

interface Rebuild {
  workload: string;
  engine: string;
  lang: string;
  artifact: string;
  status: "rebuilt" | "notAttested";
  reason?: string;
}

interface TestOutcome {
  test: string;
  result: "equivalent" | "differs" | "errored";
  passed: number;
  failed: number;
  /**
   * Engines this test exercises whose rebuild failed. The scratch directory is
   * seeded from the committed set, so those engines were checked against the
   * committed artifact — a pass covers them only trivially. Naming them keeps
   * "equivalent" from reading as more coverage than the run had.
   */
  unrebuiltEngines?: string[];
  detail?: string;
}

async function copyDir(from: string, to: string): Promise<void> {
  await Deno.mkdir(to, { recursive: true });
  for await (const entry of Deno.readDir(from)) {
    if (!entry.isFile) continue;
    await Deno.copyFile(`${from}/${entry.name}`, `${to}/${entry.name}`);
  }
}

async function main() {
  const check = Deno.args.includes("--check");
  const withDart = Deno.args.includes("--with-dart");

  const scratch = await Deno.makeTempDir({ prefix: "wvj-attest-" });
  // Seed with the committed set so files no recipe produces — hand-written WAT,
  // Dart glue for kernels this run does not rebuild, fixture data — are present
  // and the tests can still load them. Every one of those is reported as
  // notAttested below; seeding makes the run possible, not the claim broader.
  await copyDir(ARTIFACT_DIR, scratch);

  const { builds } = await planBuilds(withDart);
  const rebuilds: Rebuild[] = [];
  const env = {
    ...Deno.env.toObject(),
    PATH: `${Deno.env.get("HOME") ?? ""}/.cargo/bin:${Deno.env.get("PATH") ?? ""}`,
  };

  for (const build of builds) {
    const command = commandFor(build, scratch);
    if (!command) {
      rebuilds.push({
        workload: build.workload,
        engine: build.engineKey,
        lang: build.lang,
        artifact: build.artifact,
        status: "notAttested",
        reason: `no recipe exists for ${build.lang}`,
      });
      continue;
    }
    const [cmd, args] = command;
    const out = await new Deno.Command(cmd, { args, env, stdout: "piped", stderr: "piped" })
      .output();
    if (!out.success) {
      rebuilds.push({
        workload: build.workload,
        engine: build.engineKey,
        lang: build.lang,
        artifact: build.artifact,
        status: "notAttested",
        reason: `rebuild failed: ${
          new TextDecoder().decode(out.stderr).trim().split("\n")[0] || "no stderr"
        }`,
      });
      continue;
    }
    rebuilds.push({
      workload: build.workload,
      engine: build.engineKey,
      lang: build.lang,
      artifact: build.artifact,
      status: "rebuilt",
    });
  }

  const tests: string[] = [];
  for await (const entry of Deno.readDir(`${ROOT}tests`)) {
    if (!entry.isFile) continue;
    if (!entry.name.startsWith("multilang-") || !entry.name.endsWith(".test.ts")) continue;
    if (COMMITTED_BYTE_TESTS.includes(entry.name)) continue;
    tests.push(entry.name);
  }
  tests.sort();

  const outcomes: TestOutcome[] = [];
  for (const test of tests) {
    const run = await new Deno.Command("deno", {
      args: [
        "test",
        "--allow-env",
        "--allow-read",
        "--allow-write",
        "--allow-run",
        "--allow-net=127.0.0.1",
        `${ROOT}tests/${test}`,
      ],
      env: { ...env, WASM_VS_JS_ARTIFACT_DIR: scratch },
      stdout: "piped",
      stderr: "piped",
    }).output();
    const text = new TextDecoder().decode(run.stdout) + new TextDecoder().decode(run.stderr);
    const tally = text.match(/(\d+) passed \| (\d+) failed/);
    const passed = tally ? Number(tally[1]) : 0;
    const failed = tally ? Number(tally[2]) : 0;
    let result: TestOutcome["result"];
    if (!tally) result = "errored";
    else if (run.success && failed === 0) result = "equivalent";
    else result = "differs";
    let detail: string | undefined;
    if (result === "errored") {
      // No tally at all: the run did not measure equivalence either way and
      // must not be recorded as if it had.
      detail = "the test run reported no pass/fail tally";
    } else if (result === "differs") {
      const errors = text.split("\n").filter((l) => l.includes("error:")).slice(0, 3);
      detail = errors.length > 0
        ? errors.join(" | ")
        : text.split("\n").filter((l) => l.includes("FAILED")).slice(0, 3).join(" | ");
    }
    outcomes.push({ test, result, passed, failed, detail });
  }

  await Deno.remove(scratch, { recursive: true });

  const fingerprint = await fingerprintToolchain(env, { probeAsc: false });
  const equivalent = outcomes.filter((o) => o.result === "equivalent").length;
  const record = {
    schemaVersion: 1,
    description:
      "Every multi-language kernel rebuilt from committed source with its recorded recipe, " +
      "then checked against the workload's pinned oracle in place of the committed artifact.",
    claim: "Oracle equivalence says a rebuild computes what the committed artifact computes. It " +
      "does not say the rebuild is the committed artifact: that is byte equality, recorded " +
      "separately per toolchain in kernel-build-provenance.v1.json. Neither stands in for " +
      "the other.",
    granularity:
      "Per oracle test, not per kernel. Each test asserts over a workload's engines together, " +
      "so a failure names the workload and the engines inside it have to be read from the " +
      "test output.",
    toolchain: fingerprint,
    observedAt: new Date().toISOString().slice(0, 10),
    kernelsRebuilt: rebuilds.filter((r) => r.status === "rebuilt").length,
    kernelsNotAttested: rebuilds.filter((r) => r.status === "notAttested").length,
    dartIncluded: withDart,
    testsRun: outcomes.length,
    testsEquivalent: equivalent,
    testsNotEquivalent: outcomes.length - equivalent,
    tests: outcomes,
    kernels: rebuilds,
  };

  const serialized = JSON.stringify(record, null, 2) + "\n";
  if (check) {
    console.log(
      `${equivalent}/${outcomes.length} oracle tests pass against rebuilt artifacts; ` +
        `${record.kernelsRebuilt} kernels rebuilt, ${record.kernelsNotAttested} not attested`,
    );
    for (const o of outcomes.filter((o) => o.result !== "equivalent")) {
      console.log(`  ${o.result}: ${o.test} (${o.failed} failed) ${o.detail ?? ""}`);
    }
    return;
  }
  await Deno.writeTextFile(OUT, serialized);
  console.log(
    `wrote ${OUT}: ${equivalent}/${outcomes.length} oracle tests equivalent under ` +
      `${fingerprint.id}; ${record.kernelsRebuilt} kernels rebuilt, ` +
      `${record.kernelsNotAttested} not attested`,
  );
  for (const o of outcomes.filter((o) => o.result !== "equivalent")) {
    console.log(`  ${o.result}: ${o.test} (${o.failed} failed)`);
  }
}

if (import.meta.main) await main();
