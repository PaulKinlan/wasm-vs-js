// @ts-ignore Browser same-origin route, mapped by server.ts.
import { ControlledSha256, hex } from "/benchmarks/base/crypto-file-integrity/sha256.js";
// @ts-ignore Browser same-origin route, mapped by server.ts.
import {
  generateFixture,
  instantiateWasm,
  REGISTERED_KINDS,
  REGISTERED_SCHEDULES,
  REGISTERED_SIZES,
  runJavaScript,
  runWasm,
} from "/benchmarks/base/crypto-file-integrity/workload.js";

const sha = (bytes) => hex(new ControlledSha256().update(bytes).digest());
async function fetchBytes(path) {
  const response = await fetch(path, { cache: "no-store" });
  if (!response.ok) throw new Error(`${path} returned ${response.status}`);
  return new Uint8Array(await response.arrayBuffer());
}
const decode = (bytes) => JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(bytes));

self.onmessage = async (event) => {
  const token = event.data?.token;
  let target = event.data?.target || "js-controlled";
  if (target === "wasm" || target === "wasm-linear") target = "wasm-linear-controlled";
  if (target === "javascript" || target === "js") target = "js-controlled";
  const kind = event.data?.kind || "dense-high-entropy";
  const byteLength = event.data?.byteLength || 65536;
  const schedule = event.data?.schedule || 8192;
  try {
    if (
      !Number.isSafeInteger(token) ||
      !["js-controlled", "wasm-linear-controlled"].includes(target) ||
      !REGISTERED_KINDS.includes(kind) || !REGISTERED_SIZES.includes(byteLength) ||
      !REGISTERED_SCHEDULES.includes(schedule)
    ) throw new Error("closed demo request rejected");
    self.postMessage({ token, type: "progress", phase: "Verifying registered bytes" });
    const ledgerBytes = await fetchBytes("/data/base-implementation-status.v1.json");
    const ledger = decode(ledgerBytes);
    if (ledger.counts?.implemented !== 0 || ledger.counts?.denominator !== 38) {
      throw new Error("pre-browser catalog coverage is not 0/38");
    }
    const entry = ledger.staticForBrowserCandidates.find((item) =>
      item.id === "crypto.file-integrity.v1"
    );
    if (
      !entry || entry.status !== "static-for-browser" || entry.countsTowardCoverage !== false ||
      entry.promotionGate !== "retained-browser-validation-required"
    ) throw new Error("base status does not register a static-for-browser candidate");
    const [registrationBytes, buildBytes, artifactBytes, jsBytes, workloadBytes] = await Promise
      .all([
        fetchBytes(entry.registration),
        fetchBytes(entry.buildManifest),
        fetchBytes("/artifacts/crypto-file-integrity/crypto-file-integrity.wasm"),
        fetchBytes("/benchmarks/base/crypto-file-integrity/sha256.js"),
        fetchBytes("/benchmarks/base/crypto-file-integrity/workload.js"),
      ]);
    if (
      sha(registrationBytes) !== entry.registrationSha256 ||
      sha(buildBytes) !== entry.buildManifestSha256
    ) throw new Error("registered manifest bytes changed");
    const registration = decode(registrationBytes);
    const build = decode(buildBytes);
    if (sha(artifactBytes) !== build.artifact.sha256) {
      throw new Error("Wasm artifact bytes changed");
    }
    const sourceByPath = new Map(build.sources.map((source) => [source.path, source.sha256]));
    if (
      sha(jsBytes) !== sourceByPath.get("benchmarks/base/crypto-file-integrity/sha256.js") ||
      sha(workloadBytes) !== sourceByPath.get("benchmarks/base/crypto-file-integrity/workload.js")
    ) throw new Error("served controlled source bytes changed");
    const fixtureRecord = registration.fixtures.find((item) =>
      item.kind === kind && item.byteLength === byteLength
    );
    if (!fixtureRecord) throw new Error("fixture is not registered");
    self.postMessage({
      token,
      type: "progress",
      phase: `Generating ${byteLength} registered bytes`,
    });
    const fixture = generateFixture(kind, byteLength);
    self.postMessage({ token, type: "progress", phase: `Hashing with ${target}` });
    const result = target === "js-controlled"
      ? runJavaScript(fixture, schedule)
      : runWasm(await instantiateWasm(artifactBytes), fixture, schedule);
    if (result.digest !== fixtureRecord.expectedDigestSha256) {
      throw new Error("complete digest did not match registered oracle");
    }
    self.postMessage({
      token,
      type: "complete",
      result: {
        workloadId: "crypto.file-integrity.v1",
        target,
        kind,
        byteLength,
        schedule,
        digestSha256: result.digest,
        counters: result.counters,
        exactContract: {
          registrationSha256: entry.registrationSha256,
          buildManifestSha256: entry.buildManifestSha256,
          artifactSha256: build.artifact.sha256,
          sourceHashesMatched: true,
        },
        performanceClaim: null,
      },
    });
  } catch (error) {
    self.postMessage({
      token,
      type: "error",
      message: error instanceof Error ? error.message : String(error),
    });
  }
};
