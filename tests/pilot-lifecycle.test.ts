import { assertEquals, assertRejects } from "./assert.ts";
import { validatePermit } from "../lib/browser-permit.ts";
import { StagedChrome } from "../lib/chrome-stage.ts";
import { FrozenCollectionManifests, verifyCollectorOrigin } from "../lib/collection-preflight.ts";
import { StageCleanupLifecycle } from "../lib/stage-lifecycle.ts";
import { collectAll, prepareCollectionInvocation } from "../scripts/run-m1-chrome-corpus.ts";
import {
  assertCheckoutStatus,
  assertGeneratedTreeSafe,
  COLLECTOR_ROUTES,
  collectorRouteHashes,
} from "../lib/source-identity.ts";

function permit() {
  const now = Date.now();
  return validatePermit({
    schemaVersion: 1,
    permitId: `test-${crypto.randomUUID()}`,
    experimentId: "m1-chrome-sum-u32-v1",
    operation: "pilot-m1-corpus",
    sourceCommit: Deno.env.get("WASM_VS_JS_COMMIT") ?? "a".repeat(40),
    chromeBinary: "/home/paulkinlan/.local/bin/google-chrome-stable",
    chromeSha256: "dea3ab8fba923b718920ef9d62570824f2dc0ab0c72d66d53f91b41de6570355",
    chromePackageManifestSha256: "b".repeat(64),
    origin: "http://127.0.0.1:8787",
    strata: ["cold", "warm"],
    maximumLaunches: 1,
    profileRoot: `/tmp/wasm-vs-js-owned-profiles/test-${crypto.randomUUID()}`,
    issuedAt: new Date(now - 1_000).toISOString(),
    expiresAt: new Date(now + 60_000).toISOString(),
    authorizationReference: "unit-test-no-browser-no-permit-file",
    retryOf: null,
  });
}

function frozen(): FrozenCollectionManifests {
  const schedule = Array.from({ length: 120 }, (_, index) => ({
    blockId: `block-${String(index).padStart(3, "0")}`,
    stratum: (index % 2 === 0 ? "cold" : "warm") as "cold" | "warm",
    order: (index % 2 === 0
      ? ["js-controlled", "wasm-linear-controlled"]
      : ["wasm-linear-controlled", "js-controlled"]) as FrozenCollectionManifests["schedule"][
        number
      ]["order"],
  }));
  return {
    preregistration: { experimentId: "m1-chrome-sum-u32-v1" },
    schedule,
    collectorHashes: {},
  };
}

function fakeStage(p = permit()): StagedChrome {
  return {
    schemaVersion: 2,
    stageId: p.permitId,
    permitId: p.permitId,
    sourceCommit: p.sourceCommit,
    cleanupLifecycle: "ready-no-owned-launch",
    root: `/tmp/wasm-vs-js-staged-chrome/${p.permitId}`,
    binary: `/tmp/wasm-vs-js-staged-chrome/${p.permitId}/chrome`,
    binaryRelativePath: "chrome",
    binarySha256: p.chromeSha256,
    manifestSha256: p.chromePackageManifestSha256,
    files: { chrome: p.chromeSha256 },
    sourceFileModes: { chrome: 0o755 },
    stagedFileModes: { chrome: 0o500 },
    sourceDirectoryModes: { ".": 0o700 },
    stagedDirectoryModes: { ".": 0o500 },
    rootDev: 1,
    rootIno: 2,
    ownerManifestPath: `/tmp/wasm-vs-js-staged-chrome/${p.permitId}.owner.json`,
    ownerManifestSha256: "c".repeat(64),
    ownerDev: 1,
    ownerIno: 3,
  };
}

Deno.test("permit consumption is last after source/server/asset, launch-manifest, and stage gates", async () => {
  const p = permit(), f = frozen(), stage = fakeStage(p);
  const calls: string[] = [];
  const dependencies = {
    verifyEnvironment: () => {
      calls.push("origin-and-assets");
      return Promise.resolve();
    },
    stage: () => {
      calls.push("stage");
      return Promise.resolve(stage);
    },
    verifyStage: () => {
      calls.push("stage-manifest");
      return Promise.resolve();
    },
    removeStage: () => {
      calls.push("remove-stage");
      return Promise.resolve();
    },
    consume: () => {
      calls.push("consume");
      return Promise.resolve({ permit: p, digest: "d".repeat(64), receiptPath: "unused" });
    },
  };
  await prepareCollectionInvocation("unused", p, f, undefined, dependencies);
  assertEquals(calls, ["origin-and-assets", "stage", "stage-manifest", "consume"]);

  calls.length = 0;
  await assertRejects(
    () =>
      prepareCollectionInvocation("unused", p, f, undefined, {
        ...dependencies,
        verifyEnvironment: () => {
          calls.push("origin-and-assets");
          return Promise.reject(new Error("collector asset identity mismatch"));
        },
      }),
    "collector asset identity mismatch",
  );
  assertEquals(calls, ["origin-and-assets"]);

  calls.length = 0;
  await assertRejects(
    () =>
      prepareCollectionInvocation("unused", p, f, undefined, {
        ...dependencies,
        verifyStage: () => {
          calls.push("stage-manifest");
          return Promise.reject(new Error("stage package identity mismatch"));
        },
      }),
    "stage package identity mismatch",
  );
  assertEquals(calls, ["origin-and-assets", "stage", "stage-manifest", "remove-stage"]);
});

Deno.test("collector health and every served asset byte must match the exact local origin", async () => {
  const p = permit(), hashes = await collectorRouteHashes();
  const health = {
    status: "ok",
    mode: "local-m1-pilot",
    schemaVersion: 1,
    acceptedImplementationCommit: "a".repeat(40),
    localCheckoutCommit: p.sourceCommit,
    collectorAssets: hashes,
  };
  const fetcher = ((input: string | URL | Request) => {
    const url = String(input), route = new URL(url).pathname;
    const body = route === "/healthz"
      ? new TextEncoder().encode(JSON.stringify(health))
      : Deno.readFileSync(COLLECTOR_ROUTES[route]);
    return Promise.resolve({
      ok: true,
      url,
      json: () => Promise.resolve(structuredClone(health)),
      arrayBuffer: () =>
        Promise.resolve(body.buffer.slice(body.byteOffset, body.byteOffset + body.byteLength)),
    } as Response);
  }) as typeof fetch;
  await verifyCollectorOrigin(p, hashes, fetcher);

  await assertRejects(
    () =>
      verifyCollectorOrigin(
        p,
        hashes,
        ((input: string | URL | Request) => {
          const url = String(input), route = new URL(url).pathname;
          if (route === "/healthz") {
            return Promise.resolve({
              ok: true,
              url,
              json: () => Promise.resolve(health),
            } as Response);
          }
          const body = route === "/corpus-run"
            ? new TextEncoder().encode("tampered")
            : Deno.readFileSync(COLLECTOR_ROUTES[route]);
          return Promise.resolve({
            ok: true,
            url,
            arrayBuffer: () =>
              Promise.resolve(
                body.buffer.slice(body.byteOffset, body.byteOffset + body.byteLength),
              ),
          } as Response);
        }) as typeof fetch,
      ),
    "collector asset identity mismatch",
  );
});

Deno.test("stage disposition is a typed cleanup lifecycle and unresolved cleanup retains the stage", () => {
  const lifecycle = new StageCleanupLifecycle();
  assertEquals(lifecycle.disposition, "remove-stage");
  lifecycle.launchBegan();
  assertEquals(lifecycle.disposition, "retain-stage-unresolved-cleanup");
  lifecycle.cleanupVerified();
  assertEquals(lifecycle.disposition, "remove-stage");
  lifecycle.launchBegan();
  lifecycle.cleanupUnresolved();
  assertEquals(lifecycle.state, "cleanup-unresolved");
  assertEquals(lifecycle.disposition, "retain-stage-unresolved-cleanup");
});

Deno.test("prelaunch failures are persisted separately and do not increment attempted", async () => {
  const root = await Deno.makeTempDir(), p = permit(), lifecycle = new StageCleanupLifecycle();
  try {
    const result = await collectAll(
      p,
      "d".repeat(64),
      {
        sourceCommit: p.sourceCommit,
        experimentId: "m1-chrome-sum-u32-v1",
        plannedLaunches: 120,
        hostFields: 1,
        sourceManifestSha256: "e".repeat(64),
        sourceFiles: { "server.ts": "f".repeat(64) },
        frozen: null,
      },
      () => Promise.reject(new Error("prelaunch fixture failure")),
      `${root}/corpora`,
      fakeStage(p),
      lifecycle,
    );
    assertEquals(result.attempted, 0);
    assertEquals(result.blocks, []);
    const failures = result.prelaunchFailures as Array<Record<string, unknown>>;
    assertEquals(failures.length, 1);
    assertEquals(failures[0].attempted, false);
    assertEquals(failures[0].cleanupLifecycle, "verified-no-owned-launch");
    const files = [...Deno.readDirSync(`${root}/corpora/m1-${p.permitId}/prelaunch-failures`)];
    assertEquals(files.length, 1);
  } finally {
    await Deno.remove(root, { recursive: true });
  }
});

Deno.test("clean-source status allows only generated permit/corpus roots and rejects symlinks", async () => {
  assertCheckoutStatus("!! raw/permits/\0!! raw/corpora/\0");
  for (const status of ["?? other.txt\0", " M server.ts\0", "!! .env\0", "!! raw/runs/x.json\0"]) {
    await assertRejects(
      () => Promise.resolve().then(() => assertCheckoutStatus(status)),
      "clean checkout",
    );
  }
  const root = await Deno.makeTempDir(), outside = await Deno.makeTempFile();
  try {
    await Deno.symlink(outside, `${root}/escape`);
    await assertRejects(() => assertGeneratedTreeSafe(root), "unsafe generated raw entry");
  } finally {
    await Deno.remove(root, { recursive: true });
    await Deno.remove(outside);
  }
});
