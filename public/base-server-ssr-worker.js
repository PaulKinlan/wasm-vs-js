// @ts-ignore Browser same-origin route, mapped by server.ts.
import {
  generateFixture,
  instantiateSsrWasm,
  parseOutput,
  renderJavaScript,
  renderWasm,
} from "/benchmarks/v1/server-ssr-template/workload.js";

const decoder = new TextDecoder("utf-8", { fatal: true });

async function sha256(bytes) {
  return Array.from(new Uint8Array(await crypto.subtle.digest("SHA-256", bytes)))
    .map((value) => value.toString(16).padStart(2, "0")).join("");
}

async function fetchBytes(path) {
  const response = await fetch(`/${path}`);
  if (!response.ok) throw new Error(`${path} returned ${response.status}`);
  return new Uint8Array(await response.arrayBuffer());
}

async function fetchJsonWithBytes(path) {
  const bytes = await fetchBytes(path);
  return { bytes, json: JSON.parse(decoder.decode(bytes)) };
}

function equalCounters(actual, expected, target) {
  for (const [name, value] of Object.entries(expected)) {
    const wanted = name === "boundary-crossings" ? value[target] : value;
    if (actual[name] !== wanted) {
      throw new Error(`counter ${name}: expected ${wanted}, got ${actual[name]}`);
    }
  }
}

self.addEventListener("message", async (event) => {
  const { token, target } = event.data ?? {};
  try {
    if (target !== "js-controlled" && target !== "wasm-linear-controlled") {
      throw new Error("unknown controlled target");
    }
    const registrationResult = await fetchJsonWithBytes(
      "data/v1-implementation-registrations/server.ssr-template.v1.json",
    );
    const registration = registrationResult.json;
    if (
      registration.workloadId !== "server.ssr-template.v1" ||
      registration.fixedWork.responses !== 1_000
    ) {
      throw new Error("supplemental registration identity mismatch");
    }
    const manifestEntries = Object.values(registration.artifacts);
    const manifests = {};
    for (const entry of manifestEntries) {
      const result = await fetchJsonWithBytes(entry.path);
      if (await sha256(result.bytes) !== entry.sha256) {
        throw new Error(`${entry.path} byte hash mismatch`);
      }
      manifests[entry.path] = result.json;
    }
    const fixtureManifest = manifests[registration.artifacts.fixtureManifest.path];
    const outputManifest = manifests[registration.artifacts.outputManifest.path];
    const buildManifest = manifests[registration.artifacts.buildManifest.path];
    if (
      fixtureManifest.workloadId !== registration.workloadId ||
      outputManifest.workloadId !== registration.workloadId ||
      buildManifest.workloadId !== registration.workloadId ||
      buildManifest.sourceCommit !== fixtureManifest.generator.revision
    ) throw new Error("manifest relationship mismatch");
    const generated = generateFixture();
    const fixture = await fetchBytes(fixtureManifest.fixture.path);
    if (await sha256(fixture) !== fixtureManifest.fixture.sha256) {
      throw new Error("fixture hash mismatch");
    }
    if (await sha256(generated) !== fixtureManifest.fixture.sha256) {
      throw new Error("fixture generator mismatch");
    }
    let result;
    if (target === "js-controlled") {
      const source = await fetchBytes(buildManifest.variants[target].source);
      if (await sha256(source) !== buildManifest.variants[target].sha256) {
        throw new Error("JavaScript source hash mismatch");
      }
      result = renderJavaScript(fixture);
    } else {
      const artifact = await fetchBytes(buildManifest.variants[target].artifact);
      if (await sha256(artifact) !== buildManifest.variants[target].sha256) {
        throw new Error("Wasm artifact hash mismatch");
      }
      result = renderWasm(await instantiateSsrWasm(artifact), fixture);
    }
    const digest = await sha256(result.output);
    if (
      digest !== registration.oracle.completeOutputSha256 ||
      digest !== outputManifest.reference.sha256
    ) {
      throw new Error("complete output oracle mismatch");
    }
    const responses = parseOutput(result.output);
    if (responses.length !== 1_000) throw new Error("response framing count mismatch");
    equalCounters(
      result.counters,
      registration.counters.expected,
      target === "js-controlled" ? "javascript" : "wasm",
    );
    const first = decoder.decode(responses[0]);
    const last = decoder.decode(responses.at(-1));
    const text = [
      `Target: ${target}`,
      `Responses: ${responses.length}`,
      `Complete output SHA-256: ${digest}`,
      `Registration SHA-256: ${await sha256(registrationResult.bytes)}`,
      `Source commit: ${buildManifest.sourceCommit}`,
      `Counters: ${JSON.stringify(result.counters, null, 2)}`,
      "",
      `First canonical response (${responses[0].length} bytes):`,
      first,
      "",
      `Last canonical response (${responses.at(-1).length} bytes):`,
      last,
    ].join("\n");
    self.postMessage({ type: "complete", token, text });
  } catch (error) {
    self.postMessage({
      type: "error",
      token,
      message: error instanceof Error ? error.message : String(error),
    });
  }
});
