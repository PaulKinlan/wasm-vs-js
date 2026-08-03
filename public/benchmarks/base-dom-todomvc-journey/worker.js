const REGISTRATION_ROUTE = "/data/base-dom-todomvc-journey.v1.json";
const REQUIRED_ROUTES = Object.freeze([
  "/data/workloads.v1.json",
  "/benchmarks/base/dom-todomvc-journey/engine.js",
  "/benchmarks/base/dom-todomvc-journey/fixture.js",
  "/artifacts/base-dom-todomvc-journey/runtime.js",
  "/artifacts/base-dom-todomvc-journey/todomvc.wasm",
  "/artifacts/base-dom-todomvc-journey/fixture.json",
  "/artifacts/base-dom-todomvc-journey/output-manifest.json",
  "/artifacts/base-dom-todomvc-journey/build-manifest.json",
]);

async function sha256(bytes) {
  return [...new Uint8Array(await crypto.subtle.digest("SHA-256", bytes))]
    .map((value) => value.toString(16).padStart(2, "0")).join("");
}

async function fetchBytes(route) {
  const response = await fetch(route, { cache: "no-store" });
  if (!response.ok) throw new Error(`${route} returned ${response.status}`);
  return new Uint8Array(await response.arrayBuffer());
}

async function loadExactPackage() {
  const registrationBytes = await fetchBytes(REGISTRATION_ROUTE);
  const registration = JSON.parse(new TextDecoder().decode(registrationBytes));
  if (registration.status !== "implementation-candidate") {
    throw new Error("registration status changed");
  }
  const byRoute = new Map(registration.artifacts.map((artifact) => [artifact.route, artifact]));
  byRoute.set(registration.fixture.route, registration.fixture);
  byRoute.set(registration.oracle.route, registration.oracle);
  const fetched = new Map();
  for (const route of REQUIRED_ROUTES) {
    const expected = route === "/data/workloads.v1.json"
      ? { sha256: registration.frozenCatalog.sha256 }
      : byRoute.get(route);
    if (!expected) throw new Error(`registration omits ${route}`);
    const bytes = await fetchBytes(route);
    if (await sha256(bytes) !== expected.sha256) {
      throw new Error(`raw byte hash mismatch: ${route}`);
    }
    fetched.set(route, bytes);
  }
  const build = JSON.parse(new TextDecoder().decode(
    fetched.get("/artifacts/base-dom-todomvc-journey/build-manifest.json"),
  ));
  if (build.sourceCommit !== registration.sourceCommit || build.sourceCommit.length !== 40) {
    throw new Error("accepted source root mismatch");
  }
  const runtimeBytes = fetched.get("/artifacts/base-dom-todomvc-journey/runtime.js");
  const runtimeUrl = URL.createObjectURL(new Blob([runtimeBytes], { type: "text/javascript" }));
  try {
    return { fetched, runtime: await import(runtimeUrl) };
  } finally {
    URL.revokeObjectURL(runtimeUrl);
  }
}

self.onmessage = async ({ data }) => {
  if (!data || data.type !== "start" || !Number.isSafeInteger(data.token)) return;
  const { token, variantId } = data;
  if (!["js-controlled", "wasm-linear-controlled"].includes(variantId)) {
    self.postMessage({ type: "error", token, message: "Variant is outside the fixed allowlist." });
    return;
  }
  try {
    const { fetched, runtime } = await loadExactPackage();
    const encoded = runtime.encodeActionTrace();
    const result = variantId === "js-controlled" ? runtime.runJavaScript(encoded) : runtime.runWasm(
      await runtime.instantiateTodoWasm(
        fetched.get("/artifacts/base-dom-todomvc-journey/todomvc.wasm"),
      ),
      encoded,
    );
    if (variantId === "wasm-linear-controlled") {
      runtime.assertEquivalent(runtime.runJavaScript(encoded), result);
    }
    self.postMessage({ type: "result", token, result });
  } catch (error) {
    self.postMessage({
      type: "error",
      token,
      message: error instanceof Error ? error.message : "Worker failed.",
    });
  }
};
