// Where the multi-language kernel tests read .wasm artifacts from.
//
// Normally the committed directory. Overridable so the same oracle checks can
// be pointed at a freshly compiled set of artifacts without duplicating a
// single assertion.
//
// That override is the whole point of the oracle-equivalence attestation. Byte
// equality between a rebuild and the committed binary is the stronger claim,
// but it only holds on a machine with the distribution that produced those
// bytes — currently 47 of 181 kernels here, and none of the C or C++ ones. A
// rebuild that fails byte equality can still be shown to compute exactly what
// the committed artifact computes, and that is the property the published
// timings actually rest on. Both are recorded; neither is presented as the
// other.
//
// scripts/attest-oracle-equivalence.ts sets WASM_VS_JS_ARTIFACT_DIR to a
// scratch directory of rebuilt kernels and re-runs these tests against it.

const DEFAULT = new URL("../public/artifacts/multilang-wasm-benchmark/", import.meta.url).pathname;

/**
 * Absolute path, with a trailing slash. Reading the environment is guarded so
 * a test run without --allow-env still works against the committed artifacts.
 */
export const ARTIFACT_DIR: string = (() => {
  let override: string | undefined;
  try {
    override = Deno.env.get("WASM_VS_JS_ARTIFACT_DIR");
  } catch {
    override = undefined;
  }
  if (!override) return DEFAULT;
  return override.endsWith("/") ? override : `${override}/`;
})();

/** The same path without the trailing slash, for callers that add their own. */
export const ARTIFACT_ROOT: string = ARTIFACT_DIR.slice(0, -1);

/** True when the tests are reading rebuilt artifacts rather than committed ones. */
export const IS_REBUILD: boolean = ARTIFACT_DIR !== DEFAULT;
