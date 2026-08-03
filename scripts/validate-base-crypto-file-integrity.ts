import { sha256Hex } from "../lib/canonical.ts";
import {
  generateFixture,
  instantiateWasm,
  REGISTERED_KINDS,
  REGISTERED_SCHEDULES,
  REGISTERED_SIZES,
  runJavaScript,
  runWasm,
} from "../benchmarks/base/crypto-file-integrity/workload.js";

const root = new URL("../", import.meta.url);
const registrationPath = new URL("registrations/base/crypto.file-integrity.v1.json", root);
const buildManifestPath = new URL(
  "public/artifacts/crypto-file-integrity/build-manifest.json",
  root,
);
const artifactPath = new URL(
  "public/artifacts/crypto-file-integrity/crypto-file-integrity.wasm",
  root,
);
const registrationBytes = await Deno.readFile(registrationPath);
const buildManifestBytes = await Deno.readFile(buildManifestPath);
const artifactBytes = await Deno.readFile(artifactPath);
const registration = JSON.parse(new TextDecoder().decode(registrationBytes));
const buildManifest = JSON.parse(new TextDecoder().decode(buildManifestBytes));
if (await sha256Hex(artifactBytes) !== buildManifest.artifact.sha256) {
  throw new Error("artifact bytes do not match build manifest");
}
const expected = new Map(
  registration.fixtures.map((
    fixture: { kind: string; byteLength: number; expectedDigestSha256: string },
  ) => [`${fixture.kind}:${fixture.byteLength}`, fixture.expectedDigestSha256]),
);
const wasm = await instantiateWasm(artifactBytes);
const cases = [];
for (const kind of REGISTERED_KINDS) {
  for (const byteLength of REGISTERED_SIZES) {
    const fixture = generateFixture(kind, byteLength);
    for (const schedule of REGISTERED_SCHEDULES) {
      for (const target of ["js-controlled", "wasm-linear-controlled"] as const) {
        const result = target === "js-controlled"
          ? runJavaScript(fixture, schedule)
          : runWasm(wasm, fixture, schedule);
        const expectedDigest = expected.get(`${kind}:${byteLength}`);
        const passed = result.digest === expectedDigest;
        cases.push({
          target,
          kind,
          byteLength,
          schedule,
          digestSha256: result.digest,
          expectedDigestSha256: expectedDigest,
          counters: result.counters,
          passed,
        });
        console.log(target, kind, byteLength, schedule, passed ? "PASS" : "FAIL");
        if (!passed) {
          throw new Error(`digest mismatch: ${target} ${kind} ${byteLength} ${schedule}`);
        }
      }
    }
  }
}
const sourceRevision = Deno.env.get("SOURCE_REVISION") ?? buildManifest.sourceRevision;
const evidence = {
  schemaVersion: 1,
  workloadId: "crypto.file-integrity.v1",
  status: "complete-correctness-validation",
  sourceRevision,
  runtime: { deno: Deno.version.deno, v8: Deno.version.v8, typescript: Deno.version.typescript },
  exactInputs: {
    registrationRawSha256: await sha256Hex(registrationBytes),
    buildManifestRawSha256: await sha256Hex(buildManifestBytes),
    artifactRawSha256: await sha256Hex(artifactBytes),
  },
  oracle: {
    implementation: "independent node:crypto registration step",
    kind: "exact-sha256",
    allCasesMatched: true,
  },
  cases,
  totals: {
    cases: cases.length,
    passed: cases.filter((entry) => entry.passed).length,
    failed: cases.filter((entry) => !entry.passed).length,
    targets: 2,
    fixtureDefinitions: 6,
    schedules: 3,
  },
  limitations: {
    performanceMeasured: false,
    browserEvidenceIncluded: false,
    hostIntrinsicCompared: false,
  },
};
const privateOutput = new URL("evidence/base/crypto.file-integrity.v1/validation.json", root);
const publicOutput = new URL("public/evidence/base/crypto.file-integrity.v1/validation.json", root);
await Deno.mkdir(new URL("./", privateOutput), { recursive: true });
await Deno.mkdir(new URL("./", publicOutput), { recursive: true });
const encoded = `${JSON.stringify(evidence, null, 2)}\n`;
await Deno.writeTextFile(privateOutput, encoded);
await Deno.writeTextFile(publicOutput, encoded);
