import Ajv2020Module from "ajv2020";
import addFormatsModule from "ajv-formats";
import {
  inspectabilityFromResultRecord,
  inspectabilityRows,
  validateInspectabilityManifest,
} from "../public/inspectability.js";
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
const ajv = new Ajv2020({ allErrors: true, strict: false });
addFormats(ajv);
const schema = JSON.parse(
  await Deno.readTextFile("schemas/public-inspectability.schema.json"),
);
const validateSchema = ajv.compile(schema);
const manifest = JSON.parse(
  await Deno.readTextFile("public/data/sum-u32-inspectability.v1.json"),
);

async function sha256(bytes: Uint8Array): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", bytes.slice().buffer as ArrayBuffer);
  return [...new Uint8Array(digest)].map((value) => value.toString(16).padStart(2, "0")).join("");
}

async function committedBytes(commit: string, path: string): Promise<Uint8Array> {
  const output = await new Deno.Command("git", {
    args: ["show", `${commit}:${path}`],
    stdout: "piped",
    stderr: "piped",
  }).output();
  assert(output.success, new TextDecoder().decode(output.stderr));
  return output.stdout;
}

Deno.test("public inspectability manifest is closed, semantic, and bound to exact committed bytes", async () => {
  assert(validateSchema(manifest), JSON.stringify(validateSchema.errors));
  const semantic = validateInspectabilityManifest(manifest);
  assert(semantic.ok, semantic.errors.join("; "));
  for (const resource of manifest.resources) {
    assertEquals(
      await sha256(await committedBytes(manifest.source.commit, resource.path)),
      resource.sha256,
    );
    if (resource.localDownloadRoute) {
      const localPath = resource.localDownloadRoute === "/artifacts/sum-u32/sum-u32.wasm"
        ? "public/artifacts/sum-u32/sum-u32.wasm"
        : "public/artifacts/sum-u32/build-manifest.9c309c49.json";
      assertEquals(await sha256(await Deno.readFile(localPath)), resource.sha256);
    }
  }
});

Deno.test("inspectability schema preserves unavailable data as a typed state", () => {
  const unavailable = structuredClone(manifest);
  const source = unavailable.resources[0];
  source.availability = {
    state: "unavailable",
    reason: "not-published",
    detail: "Fixture source is intentionally absent.",
  };
  delete source.path;
  delete source.sha256;
  delete source.mediaType;
  delete source.immutableUrl;
  assert(validateSchema(unavailable), JSON.stringify(validateSchema.errors));
  assert(validateInspectabilityManifest(unavailable).ok);

  source.sha256 = "0".repeat(64);
  assert(!validateSchema(unavailable), "unavailable resource retained a fabricated hash");
});

Deno.test("individual v1 and accepted v2 records retain distinct commits, hashes, and unavailable fields", () => {
  const repository = "https://github.com/PaulKinlan/wasm-vs-js";
  const firstCommit = "a".repeat(40);
  const secondCommit = "b".repeat(40);
  const firstHash = "1".repeat(64);
  const secondHash = "2".repeat(64);
  const ref = (commit: string, path: string, sha256: string, extra = {}) => ({
    path,
    sha256,
    immutableUrl: `${repository}/blob/${commit}/${path}`,
    ...extra,
  });
  const v1 = inspectabilityFromResultRecord({
    runId: "first-run",
    benchmark: { id: "sum-u32" },
    build: {
      sourceRepository: repository,
      sourceCommit: firstCommit,
      artifacts: [{ name: "benchmarks/sum-u32/workload.js", sha256: firstHash }],
      lockfiles: [{ name: "deno.lock", sha256: "3".repeat(64) }],
      command: "deno task build",
      toolchains: ["Deno 2.9.0"],
      flags: [],
    },
  });
  const v2 = inspectabilityFromResultRecord({
    contractId: "workload-result-v2-proposal-v1",
    source: { repository, commit: secondCommit },
    workload: { entryId: "dom.vdom-diff-patch.v1" },
    provenance: {
      sources: [
        {
          role: "javascript-authored",
          ...ref(secondCommit, "benchmarks/v2/dom/workload.js", secondHash),
        },
        {
          role: "wasm-authored",
          ...ref(secondCommit, "benchmarks/v2/dom/workload.wat", "4".repeat(64)),
        },
      ],
      build: {
        recipe: ref(secondCommit, "scripts/build-v2.ts", "5".repeat(64)),
        locks: [ref(secondCommit, "deno.lock", "6".repeat(64))],
        command: ["deno", "task", "build-v2"],
        toolchain: [{ name: "deno", version: "2.9.0" }],
        flags: { compiler: ["-O3"], linker: [], runtime: [] },
      },
      artifacts: [
        ref(secondCommit, "public/artifacts/v2/workload.wasm", "7".repeat(64), {
          mediaType: "application/wasm",
        }),
      ],
    },
  });
  for (const normalized of [v1, v2]) {
    assert(validateSchema(normalized), JSON.stringify(validateSchema.errors));
    assert(validateInspectabilityManifest(normalized).ok);
  }
  const firstRows = inspectabilityRows(v1);
  const secondRows = inspectabilityRows(v2);
  const firstHrefs = firstRows.flatMap((row) =>
    row.links.map((item: { href: string }) => item.href)
  );
  const secondHrefs = secondRows.flatMap((row) =>
    row.links.map((item: { href: string }) => item.href)
  );
  assert(firstHrefs.every((href) => href.includes(firstCommit)));
  assert(secondHrefs.every((href) => href.includes(secondCommit)));
  assert(firstHrefs.every((href) => !href.includes(secondCommit)));
  assert(secondHrefs.every((href) => !href.includes(firstCommit)));
  assert(firstRows.some((row) => row.code === firstHash));
  assert(secondRows.some((row) => row.code === secondHash));
  assert(
    v1.resources.some((resource: { role: string; availability: { state: string } }) =>
      resource.role === "authored-wasm" && resource.availability.state === "unavailable"
    ),
  );
  assert(
    v2.resources.some((resource: { role: string; availability: { state: string } }) =>
      resource.role === "build-manifest" && resource.availability.state === "unavailable"
    ),
  );
});

Deno.test("all six audio records expose build manifests and every recorded artifact", async () => {
  for (const slug of ["audio-fft", "audio-fir", "audio-stft"]) {
    for (const variant of ["js-controlled", "wasm-linear-controlled"]) {
      const record = JSON.parse(
        await Deno.readTextFile(`public/evidence/v2-proposals/${slug}/${variant}.json`),
      );
      const normalized = inspectabilityFromResultRecord(record);
      assert(validateSchema(normalized), JSON.stringify(validateSchema.errors));
      const semantic = validateInspectabilityManifest(normalized);
      assert(semantic.ok, semantic.errors.join("; "));
      const buildManifest = normalized.resources.find(
        (resource: { role: string }) => resource.role === "build-manifest",
      );
      assertEquals(buildManifest.availability.state, "available");
      assertEquals(buildManifest.path, record.provenance.manifests.build.path);
      assertEquals(buildManifest.sha256, record.provenance.manifests.build.sha256);
      assertEquals(buildManifest.localDownloadRoute, `/artifacts/${slug}/build-manifest.json`);

      const exposedArtifacts = normalized.resources.filter(
        (resource: { role: string; availability: { state: string } }) =>
          ["compiled-wasm", "result-artifact"].includes(resource.role) &&
          resource.availability.state === "available",
      );
      assertEquals(exposedArtifacts.length, record.provenance.artifacts.length);
      for (const artifact of record.provenance.artifacts) {
        const exposed = exposedArtifacts.find(
          (resource: { path?: string; sha256?: string }) => resource.path === artifact.path,
        );
        assert(exposed, `${slug}/${variant} omitted ${artifact.path}`);
        assertEquals(exposed.sha256, artifact.sha256);
        if (artifact.path.startsWith("public/artifacts/")) {
          assertEquals(exposed.localDownloadRoute, artifact.path.slice("public".length));
        } else {
          assertEquals("localDownloadRoute" in exposed, false);
        }
      }
      const immutableLinks = inspectabilityRows(normalized).flatMap((row) =>
        row.links.map((item: { href: string }) => item.href)
      ).filter((href) => href.startsWith("https://github.com/"));
      assert(immutableLinks.every((href) => href.includes(record.source.commit)));
    }
  }
});

Deno.test("local downloads require an exact real path and hash pair", async () => {
  const record = JSON.parse(
    await Deno.readTextFile("public/evidence/v2-proposals/audio-fft/wasm-linear-controlled.json"),
  );
  const exact = inspectabilityFromResultRecord(record);
  const exactWasm = exact.resources.find(
    (resource: { role: string }) => resource.role === "compiled-wasm",
  );
  assertEquals(exactWasm.localDownloadRoute, "/artifacts/audio-fft/audio-fft.wasm");

  const wrongHashRecord = structuredClone(record);
  wrongHashRecord.provenance.artifacts[0].sha256 = "f".repeat(64);
  const wrongHash = inspectabilityFromResultRecord(wrongHashRecord).resources.find(
    (resource: { role: string }) => resource.role === "compiled-wasm",
  );
  assertEquals("localDownloadRoute" in wrongHash, false);

  const collision = structuredClone(exact);
  const collisionWasm = collision.resources.find(
    (resource: { role: string }) => resource.role === "compiled-wasm",
  );
  collisionWasm.path = "public/artifacts/audio-fir/audio-fir.wasm";
  collisionWasm.immutableUrl =
    `${collision.source.repository}/blob/${collision.source.commit}/${collisionWasm.path}`;
  assert(!validateInspectabilityManifest(collision).ok, "path/hash collision retained a route");
});

Deno.test("inspectability validation rejects mutable links, traversal, route widening, and missing roles", () => {
  const mutations = [
    (value: typeof manifest) => {
      value.resources[0].immutableUrl = value.resources[0].immutableUrl.replace(
        manifest.source.commit,
        "main",
      );
    },
    (value: typeof manifest) => {
      value.resources[0].path = "../server.ts";
    },
    (value: typeof manifest) => {
      value.resources[0].localDownloadRoute = "/source/server.ts";
    },
    (value: typeof manifest) => {
      value.resources.pop();
    },
    (value: typeof manifest) => {
      value.source.treeUrl = `${value.source.repository}/tree/main`;
    },
  ];
  for (const mutate of mutations) {
    const invalid = structuredClone(manifest);
    mutate(invalid);
    const schemaAccepted = validateSchema(invalid);
    const semanticAccepted = validateInspectabilityManifest(invalid).ok;
    assert(!schemaAccepted || !semanticAccepted, "inspectability mutation was accepted");
  }
});

Deno.test("inspectability UI uses accessible native links and no HTML injection sink", async () => {
  const script = await Deno.readTextFile("public/inspectability.js");
  const home = await Deno.readTextFile("public/index.html");
  const evidence = await Deno.readTextFile("public/evidence/index.html");
  assert(script.includes('element("a", text)'));
  assert(script.includes("textContent"));
  assert(script.includes("replaceChildren"));
  assert(script.includes("localDownloadRoute"));
  assert(script.includes("inspectabilityFromResultRecord"));
  assert(script.includes("Source and build evidence unavailable"));
  assert(!script.includes("innerHTML"));
  assert(!script.includes("insertAdjacentHTML"));
  assert(evidence.includes('aria-labelledby="inspectability-title"'));
  assert(evidence.includes('data-inspectability-src="/data/sum-u32-inspectability.v1.json"'));
  assert(evidence.includes('<script type="module" src="/inspectability.js"></script>'));
  assert(evidence.includes("Open the source/build manifest without JavaScript"));
  assert(home.includes('<script type="module" src="/app.js"></script>'));
  assert(!home.includes('data-inspectability-src="/data/sum-u32-inspectability.v1.json"'));
  for (const page of [home, evidence]) {
    assert(!/<script(?![^>]*\bsrc=)/i.test(page));
    assert(!/\sstyle=/i.test(page));
  }
});
