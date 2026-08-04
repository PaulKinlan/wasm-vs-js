import Ajv2020Module from "ajv2020";
import addFormatsModule from "ajv-formats";
import { assert, assertEquals } from "./assert.ts";
import { sha256Hex } from "../lib/canonical.ts";
import { validateProposalProvenanceSemantics } from "../benchmarks/v2/shared/provenance-contract.js";
import { validateAudioManifestSemantics } from "../benchmarks/audio-shared/manifest-contract.ts";
import { LocalRunStore } from "../lib/run-store.ts";
import { createHandler } from "../server.ts";

const slugs = ["audio-fft", "audio-fir", "audio-stft"] as const;
type Validator = ((value: unknown) => boolean) & { errors?: unknown };
type Ajv = { compile(schema: unknown): Validator };
type AjvConstructor = new (options?: Record<string, unknown>) => Ajv;
type AddFormats = (ajv: Ajv) => void;
const Ajv2020 = ((Ajv2020Module as unknown as { default?: AjvConstructor }).default ??
  Ajv2020Module) as unknown as AjvConstructor;
const addFormats = ((addFormatsModule as unknown as { default?: AddFormats }).default ??
  addFormatsModule) as unknown as AddFormats;

async function gitBytes(commit: string, path: string): Promise<Uint8Array> {
  const result = await new Deno.Command("git", {
    args: ["show", `${commit}:${path}`],
    stdout: "piped",
    stderr: "piped",
  }).output();
  if (!result.success) throw new Error(new TextDecoder().decode(result.stderr));
  return result.stdout;
}

Deno.test("audio build is reproducible with exact source graph, toolchain, lock, flags, and fixed memory", async () => {
  const before = new Map<string, Uint8Array>();
  let implementationCommit = "";
  const manifests = [];
  for (const slug of slugs) {
    for (
      const name of [
        `${slug}.wasm`,
        "fixture-manifest.json",
        "input-manifest.json",
        "reference-output.f32le",
        "reference-manifest.json",
        "output-manifest.json",
        "build-manifest.json",
      ]
    ) {
      const path = `public/artifacts/${slug}/${name}`;
      before.set(path, await Deno.readFile(path));
    }
    const manifest = JSON.parse(
      await Deno.readTextFile(`public/artifacts/${slug}/build-manifest.json`),
    );
    manifests.push(manifest);
    implementationCommit ||= manifest.sourceCommit;
    assertEquals(manifest.sourceCommit, implementationCommit);
    assertEquals(manifest.build.toolchain.map((tool: { name: string }) => tool.name), [
      "deno",
      "typescript",
      "wabt",
      "node-zlib",
    ]);
    assertEquals(manifest.build.toolchain[0].version, "2.9.0");
    assert(manifest.build.flags.runtime.includes("fixed initial=max memory"));
    assert(manifest.build.flags.runtime.includes("memory.grow unavailable"));
    assertEquals(
      manifest.variants["wasm-linear-controlled"].features.initialPages,
      manifest.variants["wasm-linear-controlled"].features.maximumPages,
    );
    assertEquals(manifest.variants["wasm-linear-controlled"].features.memoryGrowth, false);
  }

  // Artifact snapshot is complete; everything the builder rewrites has been
  // captured. Spawn the builder, then verify the source graph while it works:
  // git show reads the object store and the graphed paths are all source
  // files (verified: none live under public/artifacts or public/evidence),
  // so neither side can observe the other's writes.
  const build = new Deno.Command(Deno.execPath(), {
    args: [
      "run",
      "--allow-read=.",
      "--allow-write=public/artifacts/audio-fft,public/artifacts/audio-fir,public/artifacts/audio-stft",
      "--allow-run=git",
      "scripts/build-audio.ts",
      `--source-commit=${implementationCommit}`,
    ],
    stdout: "piped",
    stderr: "piped",
  }).spawn();
  await Promise.all(
    manifests.flatMap((manifest) =>
      manifest.fullSourceGraph.map(async (source: { path: string; sha256: string }) => {
        assertEquals(
          await sha256Hex(await gitBytes(implementationCommit, source.path)),
          source.sha256,
        );
        assertEquals(await sha256Hex(await Deno.readFile(source.path)), source.sha256);
      })
    ),
  );
  const result = await build.output();
  assert(result.success, new TextDecoder().decode(result.stderr));
  for (const [path, expected] of before) {
    assertEquals(await sha256Hex(await Deno.readFile(path)), await sha256Hex(expected));
  }
});

Deno.test("closed audio manifest schemas and semantics reject identity, oracle, and build contradictions", async () => {
  const ajv = new Ajv2020({ allErrors: true, strict: false });
  const schemaNames = ["fixture", "input", "reference", "output", "build"];
  const validators = Object.fromEntries(
    await Promise.all(schemaNames.map(async (name) => [
      name,
      ajv.compile(
        JSON.parse(await Deno.readTextFile(`schemas/audio-${name}-manifest.schema.json`)),
      ),
    ])),
  ) as Record<string, Validator>;
  const catalog = JSON.parse(await Deno.readTextFile("catalog/workloads.v2.proposed.json"));

  for (const slug of slugs) {
    const bundle = Object.fromEntries(
      await Promise.all(schemaNames.map(async (name) => [
        name,
        JSON.parse(await Deno.readTextFile(`public/artifacts/${slug}/${name}-manifest.json`)),
      ])),
    ) as Record<string, Record<string, unknown>>;
    for (const name of schemaNames) {
      assert(
        validators[name](bundle[name]),
        `${slug}/${name}: ${JSON.stringify(validators[name].errors)}`,
      );
    }
    const semantic = await validateAudioManifestSemantics(slug, bundle as never, catalog);
    assert(semantic.ok, semantic.errors.join("; "));

    const undeclared = structuredClone(bundle.fixture);
    undeclared.unreviewed = true;
    assert(!validators.fixture(undeclared), "closed fixture schema accepted undeclared state");

    for (
      const mutate of [
        (
          value: typeof bundle,
        ) => ((value.fixture.generator as Record<string, unknown>).seed = "0x00000000"),
        (value: typeof bundle) => (value.input.sha256 = "0".repeat(64)),
        (value: typeof bundle) => (value.reference.sha256 = "0".repeat(64)),
        (value: typeof bundle) => {
          const variants = value.output.variants as Record<string, unknown>;
          const controlled = variants["js-controlled"] as Record<string, unknown>;
          const checks = controlled.oracleChecks as Record<string, unknown>;
          delete checks["complete-output-bound"];
        },
        (value: typeof bundle) => {
          const variants = value.build.variants as Record<string, unknown>;
          const controlled = variants["wasm-linear-controlled"] as Record<string, unknown>;
          const features = controlled.features as Record<string, number>;
          features.maximumPages = features.initialPages === 32 ? 64 : 32;
        },
      ]
    ) {
      const poisoned = structuredClone(bundle);
      mutate(poisoned);
      const rejected = await validateAudioManifestSemantics(slug, poisoned as never, catalog);
      assert(!rejected.ok, `${slug} semantic validator accepted contradictory manifests`);
    }
  }
});

Deno.test("audio result evidence and fixed artifacts are public while benchmark definitions stay local", async () => {
  const temp = await Deno.makeTempDir();
  try {
    const store = new LocalRunStore(temp);
    await store.initialize();
    const local = createHandler(store, "local");
    const publicHandler = createHandler(null, "public");
    const publicPaths = slugs.flatMap((slug) => [
      `/artifacts/${slug}/${slug}.wasm`,
      `/artifacts/${slug}/fixture-manifest.json`,
      `/artifacts/${slug}/input-manifest.json`,
      `/artifacts/${slug}/reference-output.f32le`,
      `/artifacts/${slug}/reference-manifest.json`,
      `/artifacts/${slug}/output-manifest.json`,
      `/artifacts/${slug}/build-manifest.json`,
      `/evidence/v2-proposals/${slug}/js-controlled.json`,
      `/evidence/v2-proposals/${slug}/wasm-linear-controlled.json`,
    ]);
    for (const path of publicPaths) {
      assertEquals((await local(new Request(`http://127.0.0.1${path}`))).status, 200);
      assertEquals((await publicHandler(new Request(`http://127.0.0.1${path}`))).status, 200);
    }
    for (const slug of slugs) {
      const path = `/benchmarks/${slug}/benchmark.json`;
      assertEquals((await local(new Request(`http://127.0.0.1${path}`))).status, 200);
      assertEquals((await publicHandler(new Request(`http://127.0.0.1${path}`))).status, 404);
    }
  } finally {
    await Deno.remove(temp, { recursive: true });
  }
});

Deno.test("six audio records satisfy the closed v2 provenance schema and immutable-link semantics", async () => {
  const schema = JSON.parse(
    await Deno.readTextFile("schemas/workload-result-v2-proposal.schema.json"),
  );
  const catalog = JSON.parse(await Deno.readTextFile("catalog/workloads.v2.proposed.json"));
  const ajv = new Ajv2020({ allErrors: true, strict: false });
  addFormats(ajv);
  const validate = ajv.compile(schema);
  const sourceCommits = new Set<string>();
  for (const slug of slugs) {
    for (const variant of ["js-controlled", "wasm-linear-controlled"]) {
      const path = `public/evidence/v2-proposals/${slug}/${variant}.json`;
      const record = JSON.parse(await Deno.readTextFile(path));
      assert(validate(record), JSON.stringify(validate.errors));
      sourceCommits.add(record.source.commit);
      const semantic = await validateProposalProvenanceSemantics(record, catalog, {
        repoRoot: ".",
        expectedSourceCommit: record.source.commit,
        requireLocalFiles: true,
      });
      assert(semantic.ok, semantic.errors.join("; "));
      if (slug === "audio-fft" && variant === "js-controlled") {
        const missingBuild = structuredClone(record);
        delete missingBuild.provenance.manifests.build;
        const rejectedBuild = await validateProposalProvenanceSemantics(missingBuild, catalog);
        assert(!rejectedBuild.ok, "audio provenance accepted a missing immutable build manifest");

        const missingReference = structuredClone(record);
        missingReference.provenance.artifacts = missingReference.provenance.artifacts.filter(
          (artifact: { id: string }) => !artifact.id.endsWith("pinned-f64-reference"),
        );
        const rejectedReference = await validateProposalProvenanceSemantics(
          missingReference,
          catalog,
        );
        assert(!rejectedReference.ok, "audio provenance accepted a missing pinned reference");
      }
      assertEquals(record.status, "proposal-validation-only");
      assertEquals(record.performanceClaims, []);
      for (const resourcePath of record.collisionGuards.resourcePaths) {
        const committed = await gitBytes(record.source.commit, resourcePath);
        assert(committed.byteLength > 0, `${resourcePath} is absent from immutable source commit`);
      }
    }
  }
  assertEquals(sourceCommits.size, 1);
});
