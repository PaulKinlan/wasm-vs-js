import Ajv2020Module from "ajv2020";
import addFormatsModule from "ajv-formats";
import { sha256Hex as canonicalSha256Hex } from "../lib/canonical.ts";
import {
  acquireMediaPhotoFixtures,
  assertFixtureManifest,
  type MediaPhotoFixtureManifest,
  sha256Hex,
} from "../lib/media-photo-thumbnail-fixtures.ts";
import { assert, assertEquals, assertRejects } from "./assert.ts";

type Validator = ((value: unknown) => boolean) & { errors?: unknown };
type Ajv = { compile(schema: unknown): Validator };
type AjvConstructor = new (options?: Record<string, unknown>) => Ajv;
type AddFormats = (ajv: Ajv) => void;
const Ajv2020 = ((Ajv2020Module as unknown as { default?: AjvConstructor }).default ??
  Ajv2020Module) as unknown as AjvConstructor;
const addFormats = ((addFormatsModule as unknown as { default?: AddFormats }).default ??
  addFormatsModule) as unknown as AddFormats;

const ROOT = "benchmarks/v1/media-photo-thumbnail";
const MANIFEST_PATH = `${ROOT}/fixture-rights-manifest.json`;
const CONTRACT_PATH = `${ROOT}/pipeline-contract.json`;
const AUDIT_PATH = `${ROOT}/engine-candidate-audit.json`;
const STATUS_PATH = `${ROOT}/implementation-status.json`;

async function json(path: string): Promise<Record<string, unknown>> {
  return JSON.parse(await Deno.readTextFile(path)) as Record<string, unknown>;
}

async function fileSha256(path: string): Promise<string> {
  return await canonicalSha256Hex(await Deno.readFile(path));
}

async function filesBelow(path: string): Promise<string[]> {
  const output: string[] = [];
  for await (const entry of Deno.readDir(path)) {
    const child = `${path}/${entry.name}`;
    if (entry.isDirectory) output.push(...await filesBelow(child));
    else if (entry.isFile) output.push(child);
  }
  return output;
}

function object(value: unknown): Record<string, unknown> {
  assert(value !== null && typeof value === "object" && !Array.isArray(value));
  return value as Record<string, unknown>;
}

Deno.test("media photo fixture manifest is closed, catalog-bound, rights-scoped, and schema valid", async () => {
  const manifest = await json(MANIFEST_PATH) as unknown as MediaPhotoFixtureManifest;
  assertFixtureManifest(manifest);
  const schema = await json("schemas/media-photo-thumbnail-fixture-rights.schema.json");
  const ajv = new Ajv2020({ strict: true, allErrors: true });
  addFormats(ajv);
  const validate = ajv.compile(schema);
  assert(validate(manifest), JSON.stringify(validate.errors));

  assertEquals(await fileSha256("catalog/workloads.v1.json"), manifest.catalogSha256);
  assertEquals(await fileSha256("public/data/workloads.v1.json"), manifest.catalogSha256);
  const catalog = await json("catalog/workloads.v1.json") as { entries?: unknown[] };
  assertEquals(catalog.entries?.length, 38);
  assertEquals(manifest.selection.map((entry) => entry.id), [
    "gb82-baby",
    "gb82-night",
    "gb82-grass",
    "gb82-pixel",
    "gb82-sc-graph",
    "gb82-sc-terminal",
  ]);
  assertEquals(
    manifest.selection.reduce((sum, entry) => sum + entry.byteLength, 0),
    1_530_854,
  );
  assertEquals(manifest.rightsAudit.licenseSpdx, "CC0-1.0");
  assertEquals(manifest.rightsAudit.redistributionPermission, "permitted-by-CC0-1.0");
  assert(manifest.rightsAudit.caveat.includes("third-party"));
});

Deno.test("media photo fixture acquisition fails closed before writing changed upstream bytes", async () => {
  const manifest = await json(MANIFEST_PATH) as unknown as MediaPhotoFixtureManifest;
  const output = await Deno.makeTempDir({ prefix: "media-photo-fixture-reject-" });
  let requests = 0;
  const fetcher = ((_input: string | URL | Request) => {
    requests++;
    return Promise.resolve(new Response(new Uint8Array([0]), { status: 200 }));
  }) as typeof fetch;
  await assertRejects(
    () => acquireMediaPhotoFixtures(manifest, output, fetcher),
    "Byte length mismatch",
  );
  assertEquals(requests, 1);
  assertEquals(await filesBelow(output), []);
  await Deno.remove(output, { recursive: true });
});

Deno.test("media photo fixture hashing uses raw bytes", async () => {
  assertEquals(
    await sha256Hex(new TextEncoder().encode("abc")),
    "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad",
  );
});

Deno.test("media photo retained download verification covers every exact selected byte", async () => {
  const manifest = await json(MANIFEST_PATH) as unknown as MediaPhotoFixtureManifest;
  const evidence = await json(
    "evidence/fixtures/media-photo-thumbnail-download-verification.json",
  ) as {
    result: string;
    sourceCommit: string;
    fixtureManifestSha256: string;
    licenseSha256: string;
    readmeSha256: string;
    files: Array<{ path: string; byteLength: number; sha256: string }>;
    fixtureBytesCommitted: boolean;
    temporaryDirectoryRemoved: boolean;
  };
  assertEquals(evidence.result, "passed");
  assertEquals(evidence.sourceCommit, manifest.source.commit);
  assertEquals(evidence.fixtureManifestSha256, await fileSha256(MANIFEST_PATH));
  assertEquals(evidence.licenseSha256, manifest.source.licenseSha256);
  assertEquals(evidence.readmeSha256, manifest.source.readmeSha256);
  assertEquals(
    evidence.files,
    manifest.selection.map((entry) => ({
      path: entry.sourcePath,
      byteLength: entry.byteLength,
      sha256: entry.sha256,
    })),
  );
  assertEquals(evidence.fixtureBytesCommitted, false);
  assertEquals(evidence.temporaryDirectoryRemoved, true);
});

Deno.test("media photo pipeline freezes complete stages, dimensions, policy, oracle, and unavailable counters", async () => {
  const contract = await json(CONTRACT_PATH);
  assertEquals(contract.status, "frozen-preimplementation-contract");
  const fixedWork = contract.fixedWork as {
    images: number;
    passesPerImage: string[];
    outputDimensions: Record<string, number[]>;
  };
  assertEquals(fixedWork.images, 6);
  assertEquals(fixedWork.passesPerImage.length, 8);
  assertEquals(fixedWork.outputDimensions["gb82-sc-graph"], [1280, 773]);
  assertEquals(fixedWork.outputDimensions["gb82-sc-terminal"], [1280, 826]);
  assertEquals(
    (contract.decode as { hostDecoderControlledTarget: boolean }).hostDecoderControlledTarget,
    false,
  );
  assert((contract.orientation as { policy: string }).policy.includes("values 1 through 8"));
  assertEquals((contract.webp as { quality: number }).quality, 80);
  assertEquals((contract.webp as { byteIdentityRequired: boolean }).byteIdentityRequired, false);
  assertEquals(
    (contract.counters as { availability: string }).availability,
    "unavailable-until-controlled-engine-pair",
  );
  assertEquals((contract.counters as { required: string[] }).required.length, 15);
  assertEquals((contract.lifecycle as { persistence: boolean }).persistence, false);
  assertEquals((contract.lifecycle as { upload: boolean }).upload, false);
  assertEquals((contract.lifecycle as { performanceRanking: boolean }).performanceRanking, false);
});

Deno.test("media photo engine audit is closed and rejects fact or prose mutations", async () => {
  const audit = await json(AUDIT_PATH);
  const schema = await json("schemas/media-photo-thumbnail-engine-candidate-audit.schema.json");
  const validate = new Ajv2020({ strict: true, allErrors: true }).compile(schema);
  assert(validate(audit), JSON.stringify(validate.errors));

  const mutations: Array<[string, (value: Record<string, unknown>) => void]> = [
    ["unknown top-level field", (value) => value.unattested = true],
    ["unknown nested field", (value) => {
      object(value.controlledLinearWasm).unattested = true;
    }],
    ["missing source assertion", (value) => {
      delete object(object(value.controlledJavaScript).decoderCandidate).sourceCommit;
    }],
    ["changed package hash", (value) => {
      object(object(value.controlledLinearWasm).candidate).wasmSha256 = "0".repeat(64);
    }],
    ["changed source repository", (value) => {
      object(object(value.controlledJavaScript).encoderCandidate).sourceRepository =
        "https://example.com/unattested";
    }],
    ["widened scalar claim", (value) => {
      const linearWasm = object(value.controlledLinearWasm);
      const blockers = linearWasm.blockers as string[];
      blockers[1] = "No reproducible scalar single-thread artifact exists.";
    }],
    ["added conclusion", (value) => {
      const conclusion = object(value.conclusion);
      (conclusion.reasonCodes as string[]).push("unattested-conclusion");
    }],
  ];
  for (const [label, mutate] of mutations) {
    const changed = structuredClone(audit);
    mutate(changed);
    assert(!validate(changed), `${label} mutation was accepted`);
  }
});

Deno.test("media photo engine audit pins candidate sources and package bytes", async () => {
  const audit = await json(AUDIT_PATH);
  const javascript = object(audit.controlledJavaScript);
  const decoder = object(javascript.decoderCandidate);
  const encoder = object(javascript.encoderCandidate);
  const wasm = object(object(audit.controlledLinearWasm).candidate);

  assertEquals(
    {
      package: decoder.package,
      sourceRepository: decoder.sourceRepository,
      sourceCommit: decoder.sourceCommit,
      npmIntegrity: decoder.npmIntegrity,
      tarballSha256: decoder.tarballSha256,
      entrySha256: decoder.entrySha256,
      licenseSha256: decoder.licenseSha256,
    },
    {
      package: "fast-png@8.0.0",
      sourceRepository: "https://github.com/image-js/fast-png",
      sourceCommit: "27478a456c70494ca1a54d3537c355344f8ffef1",
      npmIntegrity:
        "sha512-gCysNasJ8KEMgfdYIKd/wTDo6ENK1PWT0RJO7O+0pgmuHPw2O6tA1WvdxFRJoLf9V8yFYpG0FA1YgI8X97OhJA==",
      tarballSha256: "dfdd8a277295bbd8a8e354a6e048c7d1c323ab5d1c620a0d462105617635c0fe",
      entrySha256: "228f83228c2ac8d29072b278d46bad45a2f4b7343a10029c7a453ab8d2de4ca6",
      licenseSha256: "47ec9747cf2c470a505fcb20f3ec2ff2e60ea4febaf2e1e7041a24fc369fac3c",
    },
  );
  assertEquals(
    {
      package: encoder.package,
      sourceRepository: encoder.sourceRepository,
      sourceTag: encoder.sourceTag,
      sourceCommit: encoder.sourceCommit,
      npmIntegrity: encoder.npmIntegrity,
      tarballSha256: encoder.tarballSha256,
      entrySha256: encoder.entrySha256,
    },
    {
      package: "@stacksjs/ts-webp@0.1.2",
      sourceRepository: "https://github.com/stacksjs/ts-webp",
      sourceTag: "v0.1.2",
      sourceCommit: "952ac317f8350c7426f050fa499534b852903472",
      npmIntegrity:
        "sha512-Wefb+axmDV5cC6gO0VtW7yldPBB9IcqNoywrj4r+5g6t95ciRhZAqU/+Ho6/n7vb4kSPTzlET/YSbr5O9/wM7w==",
      tarballSha256: "73f9618c4cc6ef27e5b2c4b6cffd65beda986b030375f362124fb91488d8e125",
      entrySha256: "97d407858763e41ca1ce0353bb975ababeefccc7c39d38afadaa316548a208ea",
    },
  );
  assertEquals(
    {
      package: wasm.package,
      sourceRepository: wasm.sourceRepository,
      sourceTag: wasm.sourceTag,
      sourceCommit: wasm.sourceCommit,
      npmIntegrity: wasm.npmIntegrity,
      tarballSha256: wasm.tarballSha256,
      wasmSha256: wasm.wasmSha256,
      glueSha256: wasm.glueSha256,
      licenseSha256: wasm.licenseSha256,
      thirdPartyNoticesSha256: wasm.thirdPartyNoticesSha256,
      versionsSha256: wasm.versionsSha256,
    },
    {
      package: "wasm-vips@0.0.18",
      sourceRepository: "https://github.com/kleisauke/wasm-vips",
      sourceTag: "v0.0.18",
      sourceCommit: "1740576a2cdcdd3a31ed6c4a370cd4e357554819",
      npmIntegrity:
        "sha512-AJyCvxZj/3qceKNnh+YyEobu/IaJFoPN7x7SxyyHmYBS3kASMqJqxQEuN0ZHKQDWsCJ8armfx4Tq3uKrNc+nMA==",
      tarballSha256: "6c5bebc60ea897678d9df319ced29b6ac6ea20f4f2d42bb6031e8f3f02faac36",
      wasmSha256: "7ca144fb2db374b456059ca3891b762e19f713f6d230747a9f97953ebeb9bbfb",
      glueSha256: "6ddcbfc8f79476a8c775dce772d846d9b7f67a557caf30a870810ce541b62f09",
      licenseSha256: "9cbb5847deb22dffbdd860fe659a122d61c144e52cbd3a97d4bb858c5fb9cef6",
      thirdPartyNoticesSha256: "0f52de00dd217125646ae85177def3e144de48d11f76368f257ba6468d3f7d8d",
      versionsSha256: "b992dc3626a0ea998881dd1f61d04150e6b1b2251a2c77b51e4bdf9ebad6f009",
    },
  );
  assertEquals(
    encoder.licenseEvidence,
    "blocked: neither the v0.1.2 source tree nor npm tarball contains a LICENSE file",
  );
  assert(
    (encoder.codecScope as string).includes(
      "cannot express the frozen libwebp 1.6.0 q=80 settings",
    ),
  );
  assertEquals(wasm.toolchain, "Emscripten 6.0.0");
  assertEquals(wasm.vips, "8.18.3");
  assertEquals(wasm.webp, "1.6.0");
  assertEquals(wasm.png, "1.6.58");
});

Deno.test("media photo blocker prose stays within inspected candidate and repository evidence", async () => {
  const audit = await json(AUDIT_PATH);
  const status = await json(STATUS_PATH);
  const readme = await Deno.readTextFile(`${ROOT}/README.md`);
  const wasmBlockers = object(audit.controlledLinearWasm).blockers as string[];
  const statusReason = object(object(status.targets).linearWasmControlled).reason as string;
  const prose = [...wasmBlockers, statusReason, readme].join("\n");

  assert(wasmBlockers[0].startsWith("The inspected wasm-vips 0.0.18 artifact"));
  assert(wasmBlockers[1].startsWith("The inspected wasm-vips 0.0.18 package"));
  assert(wasmBlockers[2].startsWith("This repository does not pin"));
  assert(statusReason.includes("The inspected wasm-vips 0.0.18 release artifact"));
  assert(statusReason.includes("this repository does not pin its Emscripten 6.0.0 toolchain"));
  assert(readme.includes("The inspected wasm-vips 0.0.18 release artifact"));
  assert(
    !prose.includes(
      "no reproducible scalar single-thread artifact exists for the controlled baseline",
    ),
  );
  assert(
    !prose.includes(
      "No reproducible scalar single-thread artifact is available in the current repository toolchain",
    ),
  );

  assertEquals((audit.controlledJavaScript as { status: string }).status, "blocked");
  assertEquals((audit.controlledLinearWasm as { status: string }).status, "blocked");
  assertEquals(
    (audit.hostBaselines as { allowedAsControlledTargets: boolean }).allowedAsControlledTargets,
    false,
  );
  const conclusion = audit.conclusion as {
    status: string;
    reasonCodes: string[];
    coverageCounted: boolean;
    performanceTimingPermitted: boolean;
    interactiveDemoPermitted: boolean;
  };
  assertEquals(conclusion.status, "blocked-before-engine-implementation");
  assertEquals(conclusion.reasonCodes.length, 5);
  assertEquals(conclusion.coverageCounted, false);
  assertEquals(conclusion.performanceTimingPermitted, false);
  assertEquals(conclusion.interactiveDemoPermitted, false);
  assert(!JSON.stringify(audit).includes('"status":"passed"'));
});

Deno.test("media photo status binds raw manifests and reports missing evidence as unavailable", async () => {
  const status = await json(STATUS_PATH);
  const statusSchema = await json(
    "schemas/media-photo-thumbnail-implementation-status.schema.json",
  );
  const validate = new Ajv2020({ strict: true, allErrors: true }).compile(statusSchema);
  assert(validate(status), JSON.stringify(validate.errors));
  assertEquals(status.maturity, "blocked-before-implementation");
  assertEquals(status.coverageCounted, false);
  assertEquals(
    (status.catalog as { sha256: string }).sha256,
    await fileSha256("catalog/workloads.v1.json"),
  );
  assertEquals(
    (status.fixture as { manifestSha256: string }).manifestSha256,
    await fileSha256(MANIFEST_PATH),
  );
  assertEquals((status.contract as { sha256: string }).sha256, await fileSha256(CONTRACT_PATH));
  assertEquals((status.engineAudit as { sha256: string }).sha256, await fileSha256(AUDIT_PATH));
  const validation = status.validation as Record<string, string>;
  assertEquals(validation.completeOutputOracle, "unavailable");
  assertEquals(validation.counterEvidence, "unavailable");
  assertEquals(validation.browserEvidence, "uncollected");
  assertEquals(validation.performanceEvidence, "not-permitted");
  assertEquals((status.unimplementedRequirements as string[]).length, 6);
  assertEquals((status.prohibitedClaims as string[]).length, 5);
  assert(!JSON.stringify(status).includes('"implementedCatalogEntries":1'));
});

Deno.test("media photo package does not redistribute fixture or claim a runnable demo", async () => {
  const files = await filesBelow(ROOT);
  assertEquals(files.filter((path) => /\.(png|webp|jpg|jpeg)$/i.test(path)), []);
  assertEquals(files.includes(`${ROOT}/implementation-status.json`), true);
  const server = await Deno.readTextFile("server.ts");
  assert(!server.includes("media-photo-thumbnail-v1"));
  const publicIndex = await Deno.readTextFile("public/benchmarks/index.html");
  assert(publicIndex.includes("38 proposed workloads; 28 runnable implementations"));
});
