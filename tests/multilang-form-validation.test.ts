// multilang-form-validation.test.ts — every multilang engine's
// dependent-form-validation compute core must produce the EXACT oracle of the
// JS model (frozen 240-action trace from seed 0x2468ace0, 10 fields, per-rule
// email/password/confirm/age/terms validation):
//   totalErrors 449 / activeErrorCount 1 / totalValidations 240.
import { assert } from "./assert.ts";

const rootDir = new URL("../", import.meta.url).pathname.replace(/\/$/, "");
const ARTIFACTS = `${rootDir}/public/artifacts/multilang-wasm-benchmark`;
const RES_OFFSET = 16384;

const ORACLE = Object.freeze({
  totalErrors: 449,
  activeErrorCount: 1,
  totalValidations: 240,
});

async function load(file: string, imports: WebAssembly.Imports = {}) {
  const bytes = await Deno.readFile(`${ARTIFACTS}/${file}`);
  const { instance } = await WebAssembly.instantiate(bytes, imports);
  return instance;
}

function runKernel(instance: WebAssembly.Instance) {
  const exports = instance.exports as Record<string, unknown>;
  const mem = (exports.memory as WebAssembly.Memory).buffer;
  const ret = (exports.form_validate_trace as () => number)();
  const view = new Int32Array(mem);
  return {
    ret,
    totalErrors: view[RES_OFFSET / 4],
    activeErrorCount: view[RES_OFFSET / 4 + 1],
    totalValidations: view[RES_OFFSET / 4 + 2],
  };
}

Deno.test("multilang form-validation: JS model reproduces the frozen oracle", async () => {
  const { generateFormActions, runFormValidationJS } = await import(
    `${rootDir}/public/benchmarks/dom-dependent-form-validation/engine.js`
  );
  const r = runFormValidationJS(generateFormActions());
  assert(
    r.totalErrors === ORACLE.totalErrors,
    `JS totalErrors ${r.totalErrors} != ${ORACLE.totalErrors}`,
  );
  assert(
    r.activeErrorCount === ORACLE.activeErrorCount,
    `JS activeErrorCount ${r.activeErrorCount} != ${ORACLE.activeErrorCount}`,
  );
  assert(
    r.totalValidations === ORACLE.totalValidations,
    `JS totalValidations ${r.totalValidations} != ${ORACLE.totalValidations}`,
  );
});

Deno.test("multilang form-validation: C kernel matches the JS oracle exactly", async () => {
  const instance = await load("form_validate_kernel_c.wasm");
  const r = runKernel(instance);
  assert(
    r.totalErrors === ORACLE.totalErrors,
    `C totalErrors ${r.totalErrors} != ${ORACLE.totalErrors}`,
  );
  assert(
    r.activeErrorCount === ORACLE.activeErrorCount,
    `C activeErrorCount ${r.activeErrorCount} != ${ORACLE.activeErrorCount}`,
  );
  assert(
    r.totalValidations === ORACLE.totalValidations,
    `C totalValidations ${r.totalValidations} != ${ORACLE.totalValidations}`,
  );
  assert(r.ret === ORACLE.totalErrors, `C return ${r.ret} != ${ORACLE.totalErrors}`);
});

Deno.test("multilang form-validation: C++ kernel matches the JS oracle exactly", async () => {
  const instance = await load("form_validate_kernel_cpp.wasm");
  const r = runKernel(instance);
  assert(
    r.totalErrors === ORACLE.totalErrors,
    `C++ totalErrors ${r.totalErrors} != ${ORACLE.totalErrors}`,
  );
  assert(
    r.activeErrorCount === ORACLE.activeErrorCount,
    `C++ activeErrorCount ${r.activeErrorCount} != ${ORACLE.activeErrorCount}`,
  );
  assert(
    r.totalValidations === ORACLE.totalValidations,
    `C++ totalValidations ${r.totalValidations} != ${ORACLE.totalValidations}`,
  );
});

Deno.test("multilang form-validation: Rust kernel matches the JS oracle exactly", async () => {
  const instance = await load("form_validate_kernel_rs.wasm");
  const r = runKernel(instance);
  assert(
    r.totalErrors === ORACLE.totalErrors,
    `Rust totalErrors ${r.totalErrors} != ${ORACLE.totalErrors}`,
  );
  assert(
    r.activeErrorCount === ORACLE.activeErrorCount,
    `Rust activeErrorCount ${r.activeErrorCount} != ${ORACLE.activeErrorCount}`,
  );
  assert(
    r.totalValidations === ORACLE.totalValidations,
    `Rust totalValidations ${r.totalValidations} != ${ORACLE.totalValidations}`,
  );
});

Deno.test("multilang form-validation: AssemblyScript kernel matches the JS oracle exactly", async () => {
  const instance = await load("form_validate_kernel_asc.wasm");
  const r = runKernel(instance);
  assert(
    r.totalErrors === ORACLE.totalErrors,
    `AS totalErrors ${r.totalErrors} != ${ORACLE.totalErrors}`,
  );
  assert(
    r.activeErrorCount === ORACLE.activeErrorCount,
    `AS activeErrorCount ${r.activeErrorCount} != ${ORACLE.activeErrorCount}`,
  );
  assert(
    r.totalValidations === ORACLE.totalValidations,
    `AS totalValidations ${r.totalValidations} != ${ORACLE.totalValidations}`,
  );
});
