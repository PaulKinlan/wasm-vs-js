import Ajv2020Module from "ajv2020";
import addFormatsModule from "ajv-formats";
import { validateInspectabilityManifest } from "../public/inspectability.js";
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
  assert(script.includes("Source and build evidence unavailable"));
  assert(!script.includes("innerHTML"));
  assert(!script.includes("insertAdjacentHTML"));
  for (const page of [home, evidence]) {
    assert(page.includes('aria-labelledby="inspectability-title"'));
    assert(page.includes('data-inspectability-src="/data/sum-u32-inspectability.v1.json"'));
    assert(page.includes('<script type="module" src="/inspectability.js"></script>'));
    assert(!/<script(?![^>]*\bsrc=)/i.test(page));
    assert(!/\sstyle=/i.test(page));
  }
});
