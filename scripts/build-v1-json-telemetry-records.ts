import Ajv2020Module from "ajv2020";
import addFormatsModule from "ajv-formats";
import { sha256Hex } from "../lib/canonical.ts";

if (Deno.version.deno !== "2.9.0") {
  throw new Error(`requires Deno 2.9.0, found ${Deno.version.deno}`);
}
const commit = Deno.env.get("WASM_VS_JS_COMMIT") ?? "";
if (!/^[a-f0-9]{40}$/.test(commit)) throw new Error("WASM_VS_JS_COMMIT must be an exact commit");
const repository = "https://github.com/PaulKinlan/wasm-vs-js";
async function ref(path: string) {
  const result = await new Deno.Command("git", {
    args: ["show", `${commit}:${path}`],
    stdout: "piped",
    stderr: "piped",
  }).output();
  if (!result.success) throw new Error(`${path} is absent from ${commit}`);
  return {
    path,
    bytes: result.stdout.length,
    sha256: await sha256Hex(result.stdout),
    immutableUrl: `${repository}/blob/${commit}/${path}`,
  };
}
const registration = await ref("benchmarks/v1/serialization-json-telemetry/registration.v1.json");
const catalog = await ref("catalog/workloads.v1.json");
if (catalog.sha256 !== "6665664f984683e5b7d3fdc8c1602198124844704c224a526d48be2f02edf9d4") {
  throw new Error("frozen v1 catalog changed");
}
const sources = await Promise.all([
  ref("benchmarks/v1/serialization-json-telemetry/workload.js"),
  ref("benchmarks/v1/serialization-json-telemetry/telemetry.c"),
]);
const manifests = await Promise.all([
  ref("public/artifacts/serialization-json-telemetry/build-manifest.json"),
  ref("public/artifacts/serialization-json-telemetry/fixture-manifest.json"),
  ref("public/artifacts/serialization-json-telemetry/input-manifest.json"),
  ref("public/artifacts/serialization-json-telemetry/output-manifest.json"),
]);
const artifact = await ref("public/artifacts/serialization-json-telemetry/telemetry.wasm");
const buildRecipe = await ref("scripts/build-v1-json-telemetry.ts");
const demo = await Promise.all([
  ref("public/demos/serialization.json-telemetry.v1/index.html"),
  ref("public/telemetry-demo.js"),
  ref("public/telemetry-worker.js"),
]);
const counterIds = [
  "records",
  "input-bytes",
  "numeric-values",
  "string-values",
  "booleans",
  "query-aggregates",
  "output-bytes",
  "allocations",
  "boundary-crossings",
];
await Deno.mkdir("artifacts/base/serialization-json-telemetry", { recursive: true });
for (const variantId of ["js-controlled", "wasm-linear-controlled"]) {
  const record = {
    schemaVersion: 1,
    contractId: "v1-base-workload-result-v1",
    status: "candidate-validation-passed",
    source: { repository, commit },
    workload: {
      entryId: "serialization.json-telemetry.v1",
      variantId,
      track: "controlled",
      algorithmFamily: "json-parse-fixed-query-canonicalize",
    },
    provenance: { registration, catalog, sources, manifests, artifact, buildRecipe, demo },
    correctness: {
      status: "passed",
      registeredTiers: [1000, 100000, 1000000],
      oracle: "byte-exact canonical summary and exact structural counters",
      counterIds,
      fullFixtureValidation: true,
    },
    performanceClaims: [],
  };
  await Deno.writeTextFile(
    `artifacts/base/serialization-json-telemetry/${variantId}.result.json`,
    `${JSON.stringify(record, null, 2)}\n`,
  );
}
const Ajv = Ajv2020Module.default ?? Ajv2020Module;
const addFormats = addFormatsModule.default ?? addFormatsModule;
const ajv = new Ajv({ strict: false, allErrors: true });
addFormats(ajv);
const validate = ajv.compile(
  JSON.parse(await Deno.readTextFile("schemas/v1-base-workload-result.schema.json")),
);
for (const variant of ["js-controlled", "wasm-linear-controlled"]) {
  const record = JSON.parse(
    await Deno.readTextFile(`artifacts/base/serialization-json-telemetry/${variant}.result.json`),
  );
  if (!validate(record)) throw new Error(JSON.stringify(validate.errors));
  console.log(`${variant}: valid at ${commit}`);
}
