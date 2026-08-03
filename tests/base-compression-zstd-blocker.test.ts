import Ajv2020Module from "ajv2020";
import addFormatsModule from "ajv-formats";
import { assert, assertEquals } from "./assert.ts";

type ValidationError = { instancePath?: string; message?: string };
type Validator = ((value: unknown) => boolean) & { errors?: ValidationError[] | null };
type AjvInstance = { compile: (schema: unknown) => Validator };
type AjvConstructor = new (options?: Record<string, unknown>) => AjvInstance;
type AddFormats = (ajv: AjvInstance) => void;

const Ajv2020 = ((Ajv2020Module as unknown as { default?: AjvConstructor }).default ??
  Ajv2020Module) as unknown as AjvConstructor;
const addFormats = ((addFormatsModule as unknown as { default?: AddFormats }).default ??
  addFormatsModule) as unknown as AddFormats;

async function sha256(bytes: Uint8Array) {
  const digest = await crypto.subtle.digest("SHA-256", bytes.slice().buffer as ArrayBuffer);
  return Array.from(new Uint8Array(digest), (value) => value.toString(16).padStart(2, "0")).join(
    "",
  );
}

const schema = JSON.parse(await Deno.readTextFile("schemas/base-workload-blocker.schema.json"));
const blocker = JSON.parse(
  await Deno.readTextFile(
    "artifacts/base-v1/compression-zstd-roundtrip/blocker.v1.json",
  ),
);

Deno.test("base zstd blocker is closed-schema evidence and does not claim coverage", async () => {
  const ajv = new Ajv2020({ allErrors: true, strict: false });
  addFormats(ajv);
  const validate = ajv.compile(schema);
  assert(validate(blocker), JSON.stringify(validate.errors));
  assertEquals(blocker.catalogWorkloadId, "compression.zstd-gzip-roundtrip.v1");
  assertEquals(blocker.status, "blocked");
  assertEquals(blocker.implementationCoverage, false);

  const catalogBytes = await Deno.readFile("catalog/workloads.v1.json");
  const derivativeBytes = await Deno.readFile("public/data/workloads.v1.json");
  assertEquals(await sha256(catalogBytes), blocker.catalogSha256);
  assertEquals(await sha256(derivativeBytes), blocker.catalogSha256);
  assertEquals(
    blocker.catalogSha256,
    "6665664f984683e5b7d3fdc8c1602198124844704c224a526d48be2f02edf9d4",
  );
});

Deno.test("base zstd blocker records the controlled-JS exclusions and independent failure", async () => {
  const dispositions = new Map(
    blocker.candidates.map((candidate: { name: string; disposition: string }) => [
      candidate.name,
      candidate.disposition,
    ]),
  );
  assertEquals(dispositions.get("fzstd"), "decode-only");
  assertEquals(dispositions.get("zstdify"), "interop-failure");
  assertEquals(
    dispositions.get("@foxglove/wasm-zstd and equivalent browser packages"),
    "wasm-backed",
  );
  assertEquals(dispositions.get("zstd.ts and native Node bindings"), "native-process");
  assertEquals(blocker.reproduction.candidateSelfRoundtrip, true);
  assertEquals(blocker.reproduction.independentDecoderExitCode, 1);
  assert(blocker.reproduction.independentDecoderObservation.includes("Data corruption detected"));

  const script = await Deno.readTextFile(blocker.reproduction.script);
  assert(script.includes("zstdify@1.4.0"));
  assert(script.includes(blocker.reproduction.probeInputSha256));
  assert(script.includes(blocker.reproduction.candidateFrameSha256));
  const stat = await Deno.stat(blocker.reproduction.script);
  assert(stat.mode !== null && (stat.mode & 0o111) !== 0, "reproduction script is not executable");
});

Deno.test("blocked base zstd workload exposes no implementation or demo surface", async () => {
  const paths = [
    "benchmarks/v1/compression-zstd-roundtrip",
    "public/artifacts/compression-zstd-roundtrip",
    "public/demos/compression.zstd-gzip-roundtrip.v1",
  ];
  for (const path of paths) {
    let exists = true;
    try {
      await Deno.stat(path);
    } catch (error) {
      if (error instanceof Deno.errors.NotFound) exists = false;
      else throw error;
    }
    assert(!exists, `${path} must not imply implementation coverage`);
  }
});
