import { assertEquals, sha256File } from "./ml-neural-shared.ts";

Deno.test("pinned build reproduces byte-identical artifacts AND result records", async () => {
  // Fail closed: the reproducibility gate requires the pinned toolchain,
  // exactly like the build itself. Running the gate on any other Deno is a
  // gate failure, never a skip-pass.
  const PINNED = "2.9.0";
  if (Deno.version.deno !== PINNED) {
    throw new Error(
      `pinned toolchain violation: reproducibility gate requires Deno ${PINNED}, found ${Deno.version.deno}`,
    );
  }
  const paths = [
    "artifacts/v2/ml-gemm/ml-gemm.wasm",
    "artifacts/v2/ml-gemm/fixture-manifest.json",
    "artifacts/v2/ml-gemm/input-manifest.json",
    "artifacts/v2/ml-gemm/output-manifest.json",
    "artifacts/v2/ml-gemm/reference.f64",
    "artifacts/v2/ml-gemm/bounds.f32",
    "artifacts/v2/ml-dense-mlp/ml-dense-mlp.wasm",
    "artifacts/v2/ml-dense-mlp/fixture-manifest.json",
    "artifacts/v2/ml-dense-mlp/input-manifest.json",
    "artifacts/v2/ml-dense-mlp/output-manifest.json",
    "artifacts/v2/ml-dense-mlp/reference.f64",
    "artifacts/v2/ml-dense-mlp/bounds.f32",
  ];
  const recordPaths = [
    "artifacts/v2/ml-gemm/js-controlled.result.json",
    "artifacts/v2/ml-gemm/wasm-linear-controlled.result.json",
    "artifacts/v2/ml-dense-mlp/js-controlled.result.json",
    "artifacts/v2/ml-dense-mlp/wasm-linear-controlled.result.json",
  ];
  const before: string[] = [];
  for (const path of [...paths, ...recordPaths]) before.push(await sha256File(path));
  const record = JSON.parse(
    await Deno.readTextFile("artifacts/v2/ml-gemm/js-controlled.result.json"),
  );
  const baseArgs = [
    "run",
    "--allow-read=.",
    "--allow-write=artifacts",
    "--allow-env=WASM_VS_JS_COMMIT",
    "--allow-run",
    "scripts/build-v2-neural.ts",
  ];
  for (const mode of ["artifacts", "records"]) {
    const command = new Deno.Command(Deno.execPath(), {
      args: [...baseArgs, mode],
      env: { WASM_VS_JS_COMMIT: record.source.commit },
      stdout: "piped",
      stderr: "piped",
    });
    const result = await command.output();
    if (!result.success) throw new Error(new TextDecoder().decode(result.stderr));
  }
  const allPaths = [...paths, ...recordPaths];
  for (let index = 0; index < allPaths.length; index += 1) {
    assertEquals(await sha256File(allPaths[index]), before[index]);
  }
});
