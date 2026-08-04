import Ajv2020Module from "ajv2020";
import addFormatsModule from "ajv-formats";
import { assert, assertEquals, assertRejects } from "./assert.ts";
import {
  sha256Hex,
  validateEvidence,
  verifyBytes,
} from "../scripts/reproduce-audio-opus-stream-blocker.ts";

type ValidationError = { instancePath?: string; message?: string };
type Validator = ((value: unknown) => boolean) & { errors?: ValidationError[] | null };
type AjvInstance = { compile: (schema: unknown) => Validator };
type AjvConstructor = new (options?: Record<string, unknown>) => AjvInstance;
type AddFormats = (ajv: AjvInstance) => void;
const Ajv2020 = ((Ajv2020Module as unknown as { default?: AjvConstructor }).default ??
  Ajv2020Module) as unknown as AjvConstructor;
const addFormats = ((addFormatsModule as unknown as { default?: AddFormats }).default ??
  addFormatsModule) as unknown as AddFormats;

const EVIDENCE_PATH = "evidence/blockers/audio-opus-stream/independent-js-decoder.v1.json";
const CATALOG_HASH = "6665664f984683e5b7d3fdc8c1602198124844704c224a526d48be2f02edf9d4";

async function readJson(path: string): Promise<Record<string, unknown>> {
  return JSON.parse(await Deno.readTextFile(path)) as Record<string, unknown>;
}

async function collectFiles(root: string, current = root): Promise<string[]> {
  const files: string[] = [];
  let entries: Deno.DirEntry[];
  try {
    entries = await Array.fromAsync(Deno.readDir(current));
  } catch (error) {
    // Artifact builders scratch in transient dirs (e.g. .build/) inside the
    // walked trees and remove them when finished. A directory that vanishes
    // mid-walk held no committed files, so skipping it cannot hide a
    // recipe-only violation — but an untolerated NotFound flakes the gate.
    if (error instanceof Deno.errors.NotFound) return files;
    throw error;
  }
  for (const entry of entries) {
    const path = `${current}/${entry.name}`;
    if (entry.isDirectory) files.push(...await collectFiles(root, path));
    else if (entry.isFile) files.push(path.slice(root.length + 1));
  }
  return files;
}

Deno.test("Opus blocker evidence validates against its closed schema", async () => {
  const ajv = new Ajv2020({ allErrors: true, strict: false });
  addFormats(ajv);
  const schema = await readJson("schemas/audio-opus-stream-blocker.schema.json");
  const evidence = await readJson(EVIDENCE_PATH);
  const validate = ajv.compile(schema);
  assert(validate(evidence), JSON.stringify(validate.errors));
  validateEvidence(evidence as never);
});

Deno.test("Opus blocker binds the immutable catalog and claims no implementation", async () => {
  const evidence = await readJson(EVIDENCE_PATH) as {
    status: string;
    coverageClaim: boolean;
    interactiveDemo: null;
    catalogBinding: { sha256: string; immutability: string };
    unavailableEvidence: Record<string, string>;
  };
  const catalogBytes = await Deno.readFile("catalog/workloads.v1.json");
  const publicCatalogBytes = await Deno.readFile("public/data/workloads.v1.json");
  assertEquals(await sha256Hex(catalogBytes), CATALOG_HASH);
  assertEquals(await sha256Hex(publicCatalogBytes), CATALOG_HASH);
  assertEquals(catalogBytes, publicCatalogBytes);
  assertEquals(evidence.catalogBinding.sha256, CATALOG_HASH);
  assertEquals(evidence.catalogBinding.immutability, "byte-for-byte");
  assertEquals(evidence.status, "blocked");
  assertEquals(evidence.coverageClaim, false);
  assertEquals(evidence.interactiveDemo, null);
  for (const value of Object.values(evidence.unavailableEvidence)) {
    assertEquals(value, "unavailable");
  }

  const server = await Deno.readTextFile("server.ts");
  assert(!server.includes("audio-opus-stream"), "blocked workload must not add a server route");
  const index = await Deno.readTextFile("public/benchmarks/index.html");
  assert(!index.includes("Opus stream demo"), "blocked workload must not add demo copy");
});

Deno.test("Opus fixture remains recipe-only with complete official vector inventory", async () => {
  const evidence = await readJson(EVIDENCE_PATH) as {
    fixtureRecipe: {
      redistribution: string;
      archive: { sha256: string; bytes: number };
      archiveLayout: {
        entryCountIncludingDirectory: number;
        bitstreams: number;
        referencePcmFiles: number;
      };
      comparisonPolicy: {
        sampleRate: number;
        channelRuns: number[];
        vectorIds: string[];
        acceptance: string;
      };
    };
    reproduction: { committedFixtureBytes: boolean };
  };
  assertEquals(evidence.fixtureRecipe.redistribution, "recipe-only");
  assertEquals(evidence.reproduction.committedFixtureBytes, false);
  assertEquals(evidence.fixtureRecipe.archive.sha256.length, 64);
  assertEquals(evidence.fixtureRecipe.archive.bytes, 74624664);
  assertEquals(evidence.fixtureRecipe.archiveLayout, {
    entryCountIncludingDirectory: 37,
    bitstreams: 12,
    referencePcmFiles: 24,
  });
  assertEquals(evidence.fixtureRecipe.comparisonPolicy.sampleRate, 48000);
  assertEquals(evidence.fixtureRecipe.comparisonPolicy.channelRuns, [1, 2]);
  assertEquals(
    evidence.fixtureRecipe.comparisonPolicy.vectorIds,
    ["01", "02", "03", "04", "05", "06", "07", "08", "09", "10", "11", "12"],
  );
  assert(evidence.fixtureRecipe.comparisonPolicy.acceptance.includes("24 invocations"));

  const trackedRoots = ["benchmarks", "evidence", "public"];
  const forbidden = /\.(?:bit|dec|opus|ogg|pcm|wav)$/i;
  for (const root of trackedRoots) {
    for (const path of await collectFiles(root)) {
      assert(
        !forbidden.test(path),
        `recipe-only Opus fixture byte file was committed: ${root}/${path}`,
      );
    }
  }
});

Deno.test("Opus JavaScript audit rejects libopus-derived facades", async () => {
  const evidence = await readJson(EVIDENCE_PATH) as {
    controlledJavaScriptAudit: {
      requiredIndependence: string;
      searchDisposition: string;
      candidates: Array<{
        package: string;
        version: string;
        download: { sha256: string; bytes: number };
        observedMarkers: string[];
        disposition: string;
      }>;
    };
  };
  const audit = evidence.controlledJavaScriptAudit;
  assertEquals(
    audit.requiredIndependence,
    "not-libopus-derived-and-not-wasm-native-or-webcodecs-facade",
  );
  assertEquals(audit.searchDisposition, "no-qualifying-candidate");
  assertEquals(audit.candidates.map((candidate) => candidate.package), [
    "opusscript",
    "opus-decoder",
  ]);
  for (const candidate of audit.candidates) {
    assertEquals(candidate.download.sha256.length, 64);
    assert(candidate.download.bytes > 0);
    assert(candidate.observedMarkers.some((marker) => /libopus/i.test(marker)));
    assertEquals(candidate.disposition, "rejected-same-libopus-lineage-or-wasm-facade");
  }
});

Deno.test("Opus blocker pins complete output and exact counter requirements", async () => {
  const evidence = await readJson(EVIDENCE_PATH) as {
    requiredContract: {
      fixedWork: string;
      decodeSemantics: string[];
      outputs: string[];
      counters: string[];
      lifecycle: string[];
    };
  };
  const contract = evidence.requiredContract;
  for (const required of ["all 12", "mono and stereo", "exactly once", "24 dispositions"]) {
    assert(contract.fixedWork.includes(required), `fixed work omits ${required}`);
  }
  for (const required of ["SILK", "CELT", "hybrid", "packet-loss concealment", "in-band FEC"]) {
    assert(
      contract.decodeSemantics.some((line) => line.includes(required)),
      `decode semantics omit ${required}`,
    );
  }
  for (const required of ["Complete signed-16 PCM", "final-range checkpoints", "opus_compare"]) {
    assert(contract.outputs.some((line) => line.includes(required)), `outputs omit ${required}`);
  }
  assertEquals(contract.counters, [
    "vector-invocations",
    "packets",
    "input-bytes",
    "decoded-samples",
    "decoded-sample-values",
    "silk-packets",
    "celt-packets",
    "hybrid-packets",
    "plc-frames",
    "fec-frames",
    "range-state-checks",
    "allocations",
    "boundary-crossings",
    "output-bytes",
  ]);
  for (
    const required of [
      "acquisition status",
      "fresh module worker",
      "Cancel",
      "pagehide",
      "must not upload",
    ]
  ) {
    assert(
      contract.lifecycle.some((line) => line.includes(required)),
      `lifecycle omits ${required}`,
    );
  }
});

Deno.test("Opus blocker verifier fails closed on byte or evidence mutation", async () => {
  const bytes = new TextEncoder().encode("abc");
  const expected = {
    url: "https://example.test/abc",
    sha256: "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad",
    bytes: 3,
  };
  await verifyBytes("fixture", bytes, expected);
  await assertRejects(
    () => verifyBytes("fixture", bytes, { ...expected, bytes: 4 }),
    "byte length",
  );
  await assertRejects(
    () => verifyBytes("fixture", bytes, { ...expected, sha256: "0".repeat(64) }),
    "SHA-256",
  );

  const evidence = await readJson(EVIDENCE_PATH);
  const falseCoverage = structuredClone(evidence) as Record<string, unknown>;
  falseCoverage.coverageClaim = true;
  let rejected = false;
  try {
    validateEvidence(falseCoverage as never);
  } catch (error) {
    rejected = error instanceof Error && error.message.includes("must not claim");
  }
  assert(rejected, "coverage mutation must fail closed");
});

Deno.test("Opus blocker audit-only command is deterministic on Deno 2.9.0", async () => {
  assertEquals(Deno.version.deno, "2.9.0");
  const result = await new Deno.Command(Deno.execPath(), {
    args: [
      "run",
      "--allow-read=.",
      "scripts/reproduce-audio-opus-stream-blocker.ts",
    ],
    cwd: Deno.cwd(),
    stdout: "piped",
    stderr: "piped",
  }).output();
  assert(result.success, new TextDecoder().decode(result.stderr));
  const output = JSON.parse(new TextDecoder().decode(result.stdout));
  assertEquals(output, {
    workloadId: "audio.opus-stream.v1",
    status: "blocked",
    coverageClaim: false,
    fixtureRecipeVerified: false,
    controlledJavaScriptDisposition: "no-qualifying-candidate",
  });
});
