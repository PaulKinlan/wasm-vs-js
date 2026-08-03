import { sha256Hex } from "../lib/canonical.ts";
import Ajv2020Module from "ajv2020";
import addFormatsModule from "ajv-formats";
import { validateProposalProvenanceSemantics } from "../benchmarks/v2/shared/provenance-contract.js";
const commit = Deno.env.get("WASM_VS_JS_COMMIT") ?? "",
  repo = "https://github.com/PaulKinlan/wasm-vs-js";
if (!/^[a-f0-9]{40}$/.test(commit)) {
  throw new Error("WASM_VS_JS_COMMIT must be the exact source commit");
}
async function bytes(path: string) {
  const r = await new Deno.Command("git", { args: ["show", `${commit}:${path}`], stdout: "piped" })
    .output();
  if (!r.success) throw new Error(path);
  return r.stdout;
}
async function ref(path: string) {
  return {
    path,
    sha256: await sha256Hex(await bytes(path)),
    immutableUrl: `${repo}/blob/${commit}/${path}`,
  };
}
const catalog = JSON.parse(await Deno.readTextFile("catalog/workloads.v2.proposed.json"));
for (
  const [id, slug] of [["text.diff-patch.v1", "text-diff-patch"], [
    "text.markdown-cms.v1",
    "text-markdown-cms",
  ]]
) {
  const entry = catalog.entries.find((e: { id: string }) => e.id === id),
    js = `benchmarks/v2/${slug}/workload.js`,
    wat = `benchmarks/v2/${slug}/${slug}.wat`,
    artifactScript = "scripts/build-v2-text.ts",
    script = "scripts/build-v2-text-records.ts",
    fixture = `public/artifacts/${slug}/fixture-manifest.json`,
    output = `public/artifacts/${slug}/output-manifest.json`,
    build = `public/artifacts/${slug}/build-manifest.json`,
    wasm = `public/artifacts/${slug}/${slug}.wasm`;
  const refs = {
    catalog: await ref("catalog/workloads.v2.proposed.json"),
    workload: await ref("benchmarks/v2/shared/workload-contract.js"),
    schema: await ref("schemas/workload-result-v2-proposal.schema.json"),
    js: await ref(js),
    wat: await ref(wat),
    script: await ref(script),
    artifactScript: await ref(artifactScript),
    fixture: await ref(fixture),
    output: await ref(output),
    build: await ref(build),
    wasm: await ref(wasm),
    deno: await ref("deno.json"),
    lock: await ref("deno.lock"),
  };
  for (const variant of entry.tracks[0].variants) {
    const artifacts = [{
      id: `${slug}-javascript-source`,
      ...refs.js,
      mediaType: "text/javascript",
    }, { id: `${slug}-wasm-artifact`, ...refs.wasm, mediaType: "application/wasm" }];
    const sources = [
      { role: "javascript-authored", ...refs.js },
      { role: "wasm-authored", ...refs.wat },
      { role: "shared-support", ...refs.artifactScript },
      { role: "shared-support", ...refs.script },
      { role: "shared-support", ...refs.deno },
    ];
    const provenance = {
      sources,
      generator: refs.js,
      reference: refs.js,
      oracle: refs.output,
      manifests: {
        fixture: refs.fixture,
        input: refs.fixture,
        output: refs.output,
        build: refs.build,
      },
      build: {
        recipe: refs.script,
        cwd: ".",
        command: [
          "deno",
          "run",
          "--allow-read=.",
          "--allow-write=artifacts",
          "--allow-env=WASM_VS_JS_COMMIT",
          "--allow-run=git",
          "scripts/build-v2-text-records.ts",
        ],
        locks: [refs.lock],
        toolchain: [{ name: "deno", version: "2.9.0" }, { name: "wabt", version: "1.0.37" }],
        flags: {
          compiler: [
            "canonicalize_lebs=true",
            "write_debug_names=false",
            "simd=false",
            "threads=false",
            "exceptions=false",
          ],
          linker: [],
          runtime: [
            "--allow-read=.",
            "--allow-write=artifacts",
            "--allow-env=WASM_VS_JS_COMMIT",
            "--allow-run=git",
          ],
        },
        environment: [{ name: "WASM_VS_JS_COMMIT", value: commit }],
      },
      artifacts,
    };
    const paths = [
      ...new Set([
        refs.catalog.path,
        refs.workload.path,
        refs.schema.path,
        ...sources.map((x) => x.path),
        refs.js.path,
        refs.output.path,
        refs.fixture.path,
        refs.build.path,
        refs.script.path,
        refs.lock.path,
        ...artifacts.map((x) => x.path),
      ]),
    ];
    const record = {
      schemaVersion: 1,
      contractId: "workload-result-v2-proposal-v1",
      status: "proposal-validation-only",
      workloadCatalog: { catalogId: catalog.catalogId, file: refs.catalog },
      workloadContract: { contractId: catalog.workloadContract.contractId, file: refs.workload },
      resultContract: { contractId: catalog.resultContract.contractId, file: refs.schema },
      source: { repository: repo, commit },
      workload: { entryId: id, benchmarkSlug: slug, variant: { ...variant, track: "controlled" } },
      provenance,
      semanticCoverage: {
        inputParameterIds: entry.input.parameters.map((x: { name: string }) => x.name),
        oracleCheckIds: entry.oracle.checks.map((x: { id: string }) => x.id),
        workCounterIds: entry.work.counters,
        phaseIds: Object.keys(entry.phases),
        missingCellIds: entry.missingCells.map((x: { cell: string }) => x.cell),
      },
      collisionGuards: {
        workloadVariantKey: `${id}/${variant.id}`,
        algorithmIdentityKey: variant.algorithmFamilyId,
        resourcePaths: paths,
        artifactIds: artifacts.map((x) => x.id),
      },
      correctness: {
        status: "passed",
        oracleCheckIds: entry.oracle.checks.map((x: { id: string }) => x.id),
        outputManifestSha256: refs.output.sha256,
      },
      performanceClaims: [],
    };
    await Deno.writeTextFile(
      `artifacts/v2/${slug}/${variant.id}.result.json`,
      `${JSON.stringify(record, null, 2)}\n`,
    );
  }
}
const Ajv = Ajv2020Module.default ?? Ajv2020Module,
  add = addFormatsModule.default ?? addFormatsModule,
  ajv = new Ajv({ allErrors: true, strict: false });
add(ajv);
const validate = ajv.compile(
  JSON.parse(await Deno.readTextFile("schemas/workload-result-v2-proposal.schema.json")),
);
for (const slug of ["text-diff-patch", "text-markdown-cms"]) {
  for (const variant of ["js-controlled", "wasm-linear-controlled"]) {
    const r = JSON.parse(await Deno.readTextFile(`artifacts/v2/${slug}/${variant}.result.json`));
    if (!validate(r)) {
      throw new Error(JSON.stringify(validate.errors));
    }
    const s = await validateProposalProvenanceSemantics(r, catalog, {
      requireLocalFiles: true,
      expectedSourceCommit: commit,
    });
    if (!s.ok) throw new Error(s.errors.join("\n"));
    console.log(slug, variant, "valid");
  }
}
