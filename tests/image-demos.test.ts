import Ajv2020Module from "ajv2020";
import { sha256Hex } from "../lib/canonical.ts";
import { IMAGE_DEMO_ASSET_PATHS, IMAGE_DEMO_ROUTES } from "../lib/image-demo-registry.ts";
import { createHandler } from "../server.ts";
import {
  floodFillWasm,
  instantiateImageEditingWasm,
  lumaGaussianPipelineWasm,
} from "../public/benchmarks/image-demo-engine.js";
import {
  floodFillJavaScript,
  lumaGaussianPipelineJavaScript,
} from "../public/benchmarks/image-demo-js-engine.js";
import {
  clearCanvasPresentation,
  ImageDemoController,
} from "../public/benchmarks/image-demo-controller.js";
import { IMAGE_DEMOS, runImageDemo } from "../public/benchmarks/image-demo-worker-core.js";
import { assert, assertEquals } from "./assert.ts";

type Validator = ((value: unknown) => boolean) & { errors?: unknown };
type AjvConstructor = new (options?: Record<string, unknown>) => {
  compile: (schema: unknown) => Validator;
};
const Ajv2020 = ((Ajv2020Module as unknown as { default?: AjvConstructor }).default ??
  Ajv2020Module) as unknown as AjvConstructor;
const MANIFEST_PATH = "public/artifacts/image-editing-demo/demo-manifest.v1.json";

Deno.test("image demo manifest is closed, exact, reproducible, and bound to the engine commit", async () => {
  const schema = JSON.parse(await Deno.readTextFile("schemas/image-demo-manifest.schema.json"));
  const manifest = JSON.parse(await Deno.readTextFile(MANIFEST_PATH));
  const validate = new Ajv2020({ strict: true, allErrors: true }).compile(schema);
  assert(validate(manifest), JSON.stringify(validate.errors));
  assertEquals(manifest.sourceCommit, "202ec76274e5ad933cf381484cca0053dec127f1");
  assertEquals(manifest.catalogV1Coverage, "0/38");
  assertEquals(manifest.authoritativePerformanceEvidence, false);
  assert(!JSON.stringify(manifest).includes("placeholder"));
  assert(!JSON.stringify(manifest).includes("future runner"));
  assertEquals(manifest.assets.map((asset: { route: string }) => asset.route), [
    ...IMAGE_DEMO_ASSET_PATHS,
  ]);
  for (const record of [...manifest.assets, ...manifest.sources]) {
    const bytes = await Deno.readFile(record.path);
    assertEquals(bytes.byteLength, record.bytes);
    assertEquals(await sha256Hex(bytes), record.sha256);
  }

  const before = await Deno.readFile(MANIFEST_PATH);
  const output = await new Deno.Command(Deno.execPath(), {
    args: [
      "run",
      "--allow-read=.",
      "--allow-write=public/artifacts/image-editing-demo,public/benchmarks/image-demo-js-engine.js",
      "--allow-run",
      "scripts/build-image-demos.ts",
    ],
    stdout: "piped",
    stderr: "piped",
  }).output();
  assert(output.success, new TextDecoder().decode(output.stderr));
  assertEquals(await Deno.readFile(MANIFEST_PATH), before);
  assertEquals(
    await Deno.readFile("public/artifacts/image-editing-demo/image-editing.wasm"),
    await Deno.readFile("benchmarks/image-editing/artifacts/image-editing.wasm"),
  );
});

Deno.test("browser image engines retain exact JavaScript and Wasm pixels, masks, bounds, counters, and hashes", async () => {
  const wasmBytes = await Deno.readFile("public/artifacts/image-editing-demo/image-editing.wasm");
  const floodFixture = await Deno.readFile(
    "public/artifacts/image-editing-demo/generated-map-64x48.rgba",
  );
  const floodJavaScript = floodFillJavaScript(floodFixture, 64, 48, 10, 12);
  const floodWasm = floodFillWasm(
    await instantiateImageEditingWasm(wasmBytes),
    floodFixture,
    64,
    48,
    10,
    12,
  );
  assertEquals(floodWasm.output, floodJavaScript.output);
  assertEquals(floodWasm.visitedMask, floodJavaScript.visitedMask);
  assertEquals(floodWasm.changedBounds, floodJavaScript.changedBounds);
  assertEquals(floodWasm.counters, floodJavaScript.counters);
  assertEquals(
    await sha256Hex(floodJavaScript.output),
    "898507f255796bd6c3edfa4d938d369ceb3cf1c744f0554f8118949182e4f559",
  );
  assertEquals(
    await sha256Hex(floodJavaScript.visitedMask),
    "f40ae0b5c3ef9b289d6ae6643c8432e77994ad72118031aa7a28aa1357efd88c",
  );
  assertEquals(floodJavaScript.changedBounds, { minX: 0, minY: 0, maxX: 63, maxY: 47 });
  assertEquals(floodJavaScript.counters.changedPixels, 2_795);
  const noOp = floodFillJavaScript(new Uint8Array([34, 139, 230, 191]), 1, 1, 0, 0);
  assertEquals(noOp.visitedMask, new Uint8Array([0]));
  assertEquals(noOp.counters.operations, 4);
  assertEquals(noOp.counters.visitedPixels, 0);

  const pipelineFixture = await Deno.readFile(
    "public/artifacts/image-editing-demo/generated-photo-40x30.rgba",
  );
  const pipelineJavaScript = lumaGaussianPipelineJavaScript(pipelineFixture, 40, 30);
  const pipelineWasm = lumaGaussianPipelineWasm(
    await instantiateImageEditingWasm(wasmBytes),
    pipelineFixture,
    40,
    30,
  );
  assertEquals(pipelineWasm.output, pipelineJavaScript.output);
  assertEquals(pipelineWasm.counters, pipelineJavaScript.counters);
  assertEquals(
    await sha256Hex(pipelineJavaScript.output),
    "286f9422579da9052de00c67ced53dd547fed6be27b21e608d286674dbb4006c",
  );
  assertEquals(pipelineJavaScript.counters.operations, 22_800);
});

Deno.test("image demo routes are an exact read-only allowlist", async () => {
  const expected = [
    "/benchmarks/image-flood-fill-demo",
    "/benchmarks/image-flood-fill-demo/",
    "/benchmarks/image-editing-demo",
    "/benchmarks/image-editing-demo/",
    "/benchmarks/image-demo.css",
    "/benchmarks/image-demo.js",
    "/benchmarks/image-demo-worker.js",
    "/benchmarks/image-demo-worker-core.js",
    "/benchmarks/image-demo-controller.js",
    "/benchmarks/image-demo-js-engine.js",
    "/benchmarks/image-demo-engine.js",
    "/benchmarks/image-editing/js.ts",
    "/benchmarks/image-editing/wasm.ts",
    "/benchmarks/image-editing/contract.ts",
    "/benchmarks/image-editing/image-editing.wat",
    "/artifacts/image-editing-demo/image-editing.wasm",
    "/artifacts/image-editing-demo/generated-map-64x48.rgba",
    "/artifacts/image-editing-demo/generated-photo-40x30.rgba",
    "/artifacts/image-editing-demo/demo-manifest.v1.json",
    "/data/image-demo-manifest.schema.json",
  ];
  assertEquals(IMAGE_DEMO_ROUTES.map((route) => route.path), expected);
  assertEquals(new Set(expected).size, expected.length);
  assert(
    IMAGE_DEMO_ROUTES.every((route) => !route.path.includes("*") && !route.path.includes("..")),
  );

  const handler = createHandler(null, "public");
  for (const route of IMAGE_DEMO_ROUTES) {
    const response = await handler(new Request(`http://127.0.0.1${route.path}`));
    assertEquals(response.status, 200);
    assertEquals(response.headers.get("content-type"), route.contentType);
    assertEquals(
      (await handler(new Request(`http://127.0.0.1${route.path}`, { method: "HEAD" }))).status,
      200,
    );
    assertEquals(
      (await handler(new Request(`http://127.0.0.1${route.path}`, { method: "POST" }))).status,
      403,
    );
  }
  for (
    const denied of [
      "/benchmarks/image-editing/fixtures.ts",
      "/benchmarks/image-editing/benchmark.json",
      "/artifacts/image-editing-demo/unknown.bin",
      "/artifacts/image-editing-demo%2F..%2Fsum-u32%2Fsum-u32.wasm",
    ]
  ) {
    assertEquals((await handler(new Request(`http://127.0.0.1${denied}`))).status, 404);
  }
});

Deno.test("raw image demo HTML freezes reduced scope and accessible textual output", async () => {
  for (
    const path of [
      "public/benchmarks/image-flood-fill-demo/index.html",
      "public/benchmarks/image-editing-demo/index.html",
    ]
  ) {
    const html = await Deno.readTextFile(path);
    assert(html.includes("Reduced out-of-catalog fixture"));
    assert(html.includes("fresh module worker"));
    assert(html.includes('id="start"'));
    assert(html.includes('id="cancel"'));
    assert(html.includes('aria-live="polite"'));
    assert(html.includes("Exact textual"));
    assert(html.includes("raw HTML response"));
    assert(html.includes("no timing evidence or comparative performance claim"));
  }
  const flood = await Deno.readTextFile(
    "public/benchmarks/image-flood-fill-demo/index.html",
  );
  assert(flood.includes("64 × 48"));
  assert(flood.includes("image.flood-fill.v1"));
  const pipeline = await Deno.readTextFile("public/benchmarks/image-editing-demo/index.html");
  assert(pipeline.includes("40 × 30"));
  assert(pipeline.includes("image.editing-pipeline.v1"));
});

async function demoAsset(url: string): Promise<Uint8Array> {
  const files: Record<string, string> = {
    "/artifacts/image-editing-demo/generated-map-64x48.rgba":
      "public/artifacts/image-editing-demo/generated-map-64x48.rgba",
    "/artifacts/image-editing-demo/generated-photo-40x30.rgba":
      "public/artifacts/image-editing-demo/generated-photo-40x30.rgba",
    "/artifacts/image-editing-demo/image-editing.wasm":
      "public/artifacts/image-editing-demo/image-editing.wasm",
  };
  const path = files[url];
  if (!path) throw new Error(`test denied unexpected demo asset: ${url}`);
  return await Deno.readFile(path);
}

async function assertRejectsMutation(
  execute: () => Promise<unknown>,
  label: string,
): Promise<void> {
  let rejected = false;
  try {
    await execute();
  } catch (error) {
    rejected = error instanceof Error && error.message.includes("mismatch");
  }
  assert(rejected, `${label} mutation was accepted`);
}

Deno.test("live worker core rejects every bounds and counter mutation for each route and target", async () => {
  const demoIds = ["image-flood-fill-demo", "image-editing-demo"] as const;
  const targets = ["javascript", "wasm-linear"] as const;
  for (const demoId of demoIds) {
    for (const target of targets) {
      const request = { demoId, target };
      const baseline = await runImageDemo(request, { loadBytes: demoAsset });
      assertEquals(baseline.validation, "exact-match");
      const oracle = IMAGE_DEMOS[demoId].oracles[target];
      for (const counter of Object.keys(oracle.counters)) {
        await assertRejectsMutation(
          () =>
            runImageDemo(request, {
              loadBytes: demoAsset,
              afterExecute: (result: { counters: Record<string, number> }) => ({
                ...result,
                counters: { ...result.counters, [counter]: result.counters[counter] + 1 },
              }),
            }),
          `${demoId}/${target}/${counter}`,
        );
      }
      await assertRejectsMutation(
        () =>
          runImageDemo(request, {
            loadBytes: demoAsset,
            afterExecute: (result: { counters: Record<string, number> }) => ({
              ...result,
              counters: { ...result.counters, undeclaredCounter: 1 },
            }),
          }),
        `${demoId}/${target}/extra-counter`,
      );
      if (oracle.changedBounds) {
        for (const coordinate of Object.keys(oracle.changedBounds)) {
          await assertRejectsMutation(
            () =>
              runImageDemo(request, {
                loadBytes: demoAsset,
                afterExecute: (
                  result: { changedBounds: Record<string, number> },
                ) => ({
                  ...result,
                  changedBounds: {
                    ...result.changedBounds,
                    [coordinate]: result.changedBounds[coordinate] + 1,
                  },
                }),
              }),
            `${demoId}/${target}/changedBounds.${coordinate}`,
          );
        }
      } else {
        await assertRejectsMutation(
          () =>
            runImageDemo(request, {
              loadBytes: demoAsset,
              afterExecute: (result: Record<string, unknown>) => ({
                ...result,
                changedBounds: { minX: 0, minY: 0, maxX: 39, maxY: 29 },
              }),
            }),
          `${demoId}/${target}/unexpected-bounds`,
        );
      }
    }
  }
});

class FakeWorker {
  terminated = false;
  posted: unknown = null;
  listeners: Record<string, Array<(event: { data?: unknown }) => void>> = {};

  addEventListener(type: string, listener: (event: { data?: unknown }) => void): void {
    (this.listeners[type] ??= []).push(listener);
  }

  postMessage(message: unknown): void {
    this.posted = message;
  }

  terminate(): void {
    this.terminated = true;
  }

  emit(type: string, data?: unknown): void {
    for (const listener of this.listeners[type] ?? []) listener({ data });
  }
}

Deno.test("controller executes fresh-worker cleanup and cannot resurrect stale canvas pixels", () => {
  const workers: FakeWorker[] = [];
  const timers: Array<() => void> = [];
  const states: string[] = [];
  let clearCalls = 0;
  const canvas = {
    width: 64,
    height: 48,
    hidden: false,
    getContext: () => ({
      clearRect: () => {
        clearCalls += 1;
      },
    }),
  };
  const controller = new ImageDemoController({
    createWorker: () => {
      const worker = new FakeWorker();
      workers.push(worker);
      return worker;
    },
    createToken: (sequence: number) => `token-${sequence}`,
    setTimer: (callback: () => void) => {
      timers.push(callback);
      return timers.length;
    },
    clearTimer: () => {},
    onPresentation: (payload: unknown) => {
      if (!payload) clearCanvasPresentation(canvas);
      else {
        canvas.width = 64;
        canvas.height = 48;
        canvas.hidden = false;
      }
    },
    onState: (event: { state: string }) => states.push(event.state),
  });

  const firstToken = controller.start({ demoId: "image-flood-fill-demo", target: "javascript" });
  workers[0].emit("message", {
    type: "result",
    token: firstToken,
    result: { output: new Uint8Array([1]) },
  });
  assert(controller.getLastResult());
  assertEquals(canvas.hidden, false);

  const secondToken = controller.start({ demoId: "image-flood-fill-demo", target: "wasm-linear" });
  assert(workers[0].terminated);
  assertEquals(controller.getLastResult(), null);
  assertEquals(canvas.hidden, true);
  assertEquals(canvas.width, 1);
  assertEquals(canvas.height, 1);
  workers[0].emit("message", {
    type: "result",
    token: firstToken,
    result: { output: new Uint8Array([9]) },
  });
  assertEquals(controller.getLastResult(), null);
  assert(controller.cancel());
  assert(workers[1].terminated);
  assertEquals(controller.getLastResult(), null);
  workers[1].emit("message", {
    type: "result",
    token: secondToken,
    result: { output: new Uint8Array([8]) },
  });
  assertEquals(controller.getLastResult(), null);

  controller.start({ demoId: "image-editing-demo", target: "javascript" });
  workers[2].emit("error");
  assertEquals(controller.getLastResult(), null);
  assertEquals(canvas.hidden, true);

  controller.start({ demoId: "image-editing-demo", target: "wasm-linear" });
  timers.at(-1)?.();
  assert(workers[3].terminated);
  assertEquals(controller.getLastResult(), null);
  assertEquals(canvas.hidden, true);
  assert(states.includes("completed"));
  assert(states.includes("canceled"));
  assert(states.includes("error"));
  assert(states.includes("timeout"));
  assert(clearCalls >= 5);
});
