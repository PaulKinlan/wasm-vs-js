import {
  countersFor,
  REGISTERED_KINDS,
  REGISTERED_SCHEDULES,
  REGISTERED_SIZES,
} from "./workload.js";

export const VALIDATION_STATUS = "static-correctness-validation-awaiting-browser";
export const COVERAGE_PROMOTION_GATE = "retained-browser-validation-required";

const caseKey = ({ target, kind, byteLength, schedule }) =>
  JSON.stringify([target, kind, byteLength, schedule]);
const exactJson = (value) => JSON.stringify(value);

export function expectedCaseKeys() {
  const keys = new Set();
  for (const kind of REGISTERED_KINDS) {
    for (const byteLength of REGISTERED_SIZES) {
      for (const schedule of REGISTERED_SCHEDULES) {
        for (const target of ["js-controlled", "wasm-linear-controlled"]) {
          keys.add(caseKey({ target, kind, byteLength, schedule }));
        }
      }
    }
  }
  return keys;
}

export function assertExactValidationEvidence(evidence, registration) {
  if (!evidence || typeof evidence !== "object") {
    throw new Error("validation evidence must be an object");
  }
  if (evidence.status !== VALIDATION_STATUS) {
    throw new Error("validation status is not static-for-browser");
  }
  if (
    exactJson(evidence.catalogCoverage) !==
      exactJson({
        denominator: 38,
        implemented: 0,
        remaining: 38,
        candidateCount: 1,
        countsTowardCoverage: false,
        promotionGate: COVERAGE_PROMOTION_GATE,
      })
  ) throw new Error("pre-browser catalog coverage must remain 0/38");
  if (!Array.isArray(evidence.cases) || evidence.cases.length !== 36) {
    throw new Error("validation evidence must contain exactly 36 cases");
  }
  const expected = expectedCaseKeys();
  const observed = new Set();
  const fixtureDigests = new Map(
    registration.fixtures.map((fixture) => [
      `${fixture.kind}:${fixture.byteLength}`,
      fixture.expectedDigestSha256,
    ]),
  );
  for (const entry of evidence.cases) {
    const key = caseKey(entry);
    if (!expected.has(key)) throw new Error(`unexpected validation case ${key}`);
    if (observed.has(key)) throw new Error(`duplicate validation case ${key}`);
    observed.add(key);
    const expectedDigest = fixtureDigests.get(`${entry.kind}:${entry.byteLength}`);
    if (!expectedDigest || entry.expectedDigestSha256 !== expectedDigest) {
      throw new Error(`registered digest mismatch for ${key}`);
    }
    if (entry.digestSha256 !== expectedDigest || entry.passed !== true) {
      throw new Error(`case did not pass its complete digest oracle: ${key}`);
    }
    const expectedCounters = countersFor(entry.byteLength, entry.schedule, entry.target);
    if (exactJson(entry.counters) !== exactJson(expectedCounters)) {
      throw new Error(`counter mismatch for ${key}`);
    }
  }
  if (observed.size !== expected.size) {
    throw new Error("validation Cartesian product is incomplete");
  }
  for (const key of expected) {
    if (!observed.has(key)) throw new Error(`missing validation case ${key}`);
  }
  if (
    exactJson(evidence.totals) !==
      exactJson({
        cases: 36,
        passed: 36,
        failed: 0,
        targets: 2,
        fixtureDefinitions: 6,
        schedules: 3,
      })
  ) throw new Error("validation totals do not describe the exact Cartesian product");
  if (
    evidence.limitations?.browserEvidenceIncluded !== false ||
    evidence.limitations?.evidenceClassification !== "static-for-browser" ||
    evidence.limitations?.performanceMeasured !== false
  ) throw new Error("pre-browser evidence classification is inaccurate");
  return true;
}
