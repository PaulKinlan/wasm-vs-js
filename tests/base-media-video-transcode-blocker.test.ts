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

const schema = JSON.parse(
  await Deno.readTextFile("schemas/base-video-transcode-blocker.schema.json"),
);
const blocker = JSON.parse(
  await Deno.readTextFile("artifacts/base-v1/media-video-transcode/blocker.v1.json"),
);

Deno.test("base video blocker is closed-schema evidence and preserves frozen coverage", async () => {
  const ajv = new Ajv2020({ allErrors: true, strict: false });
  addFormats(ajv);
  const validate = ajv.compile(schema);
  assert(validate(blocker), JSON.stringify(validate.errors));
  assertEquals(blocker.catalogWorkloadId, "media.video-transcode.v1");
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

Deno.test("base video blocker records why each JavaScript candidate is ineligible", () => {
  const dispositions = new Map(
    blocker.controlledJavaScriptCandidates.map(
      (candidate: { name: string; disposition: string }) => [candidate.name, candidate.disposition],
    ),
  );
  assertEquals(dispositions.size, 5);
  assertEquals(dispositions.get("whammy"), "host-vp8");
  assertEquals(dispositions.get("webm-writer"), "host-vp8");
  assertEquals(dispositions.get("@ffmpeg/ffmpeg"), "wasm-backed");
  assertEquals(dispositions.get("@webav/av-cliper"), "host-webcodecs");
  assertEquals(dispositions.get("libvpx"), "empty-package");

  assertEquals(blocker.materialWasmCandidate.disposition, "credible-unbuilt-wasm-source");
  assertEquals(blocker.materialWasmCandidate.version, "1.16.0");
  assertEquals(blocker.reproduction.candidateChecks, 5);
  assert(blocker.unresolvedRequirements.length >= 4);
});

Deno.test("base video blocker reproduction pins mechanisms and executable evidence", async () => {
  const script = await Deno.readTextFile(blocker.reproduction.script);
  for (const candidate of blocker.controlledJavaScriptCandidates) {
    assert(script.includes(candidate.version), `script does not pin ${candidate.name}`);
    assert(
      script.includes(candidate.packageTarballSha256),
      `script does not pin tarball for ${candidate.name}`,
    );
  }
  assert(script.includes("VideoEncoder.isConfigSupported"));
  assert(script.includes("createFFmpegCore"));
  assert(script.includes("V_VP8"));
  assert(script.includes(blocker.materialWasmCandidate.nativeProbeSha256));
  const stat = await Deno.stat(blocker.reproduction.script);
  assert(stat.mode !== null && (stat.mode & 0o111) !== 0, "reproduction script is not executable");
});

Deno.test("blocked base video workload exposes no implementation or demo surface", async () => {
  const paths = [
    "benchmarks/v1/media-video-transcode",
    "public/artifacts/media-video-transcode",
    "public/demos/media.video-transcode.v1",
    "public/benchmarks/media-video-transcode-v1",
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
