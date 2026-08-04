import { formatTargetPayload, WORKLOAD_CONFIGS } from "../public/unified-runner.js";
import { LocalRunStore } from "../lib/run-store.ts";
import { createHandler } from "../server.ts";
import { assert } from "./assert.ts";

interface WorkloadConfig {
  workerScript: string;
  protocol: string;
  workerType?: "classic" | "module";
  tokenType?: "string" | "number";
  ackEvents?: boolean;
  iterationTimeoutMs?: number;
  workloadId?: string;
  prepared?: Record<string, unknown>;
}

const configsMap = WORKLOAD_CONFIGS as Record<string, WorkloadConfig>;

async function withLocalServer<T>(fn: (origin: string) => Promise<T>): Promise<T> {
  const tempDir = await Deno.makeTempDir();
  try {
    const store = new LocalRunStore(tempDir);
    await store.initialize();
    const handler = createHandler(store, "local");
    const server = Deno.serve({ port: 0, handler });
    const addr = server.addr as Deno.NetAddr;
    const origin = `http://127.0.0.1:${addr.port}`;
    try {
      return await fn(origin);
    } finally {
      await server.shutdown();
    }
  } finally {
    await Deno.remove(tempDir, { recursive: true }).catch(() => {});
  }
}

Deno.test("runner-worker contract: WORKLOAD_CONFIGS is complete and structured", () => {
  const keys = Object.keys(configsMap);
  assert(keys.length >= 38, `expected at least 38 workload configs, got ${keys.length}`);
  for (const [slug, config] of Object.entries(configsMap)) {
    assert(typeof config.workerScript === "string", `${slug}: workerScript must be a string`);
    assert(config.workerScript.startsWith("/"), `${slug}: workerScript must start with /`);
    assert(typeof config.protocol === "string", `${slug}: protocol must be a string`);
  }
});

for (const [slug, config] of Object.entries(configsMap)) {
  Deno.test(`runner-worker contract: ${slug}`, async () => {
    // 1. Static Contract Checks
    const relativePath = config.workerScript.startsWith("/")
      ? `public${config.workerScript}`
      : `public/${config.workerScript}`;
    const workerBytes = await Deno.readFile(relativePath);
    assert(workerBytes.length > 0, `${slug}: worker script is empty`);

    const workerCode = new TextDecoder().decode(workerBytes);
    const hasHandler = workerCode.includes("onmessage") ||
      workerCode.includes("addEventListener");
    assert(hasHandler, `${slug}: worker script lacks a message handler`);

    const jsPayload = formatTargetPayload(slug, "js");
    const wasmPayload = formatTargetPayload(slug, "wasm");

    assert(jsPayload && typeof jsPayload === "object", `${slug}: js formatTargetPayload failed`);
    assert(
      wasmPayload && typeof wasmPayload === "object",
      `${slug}: wasm formatTargetPayload failed`,
    );

    // 2. Dynamic Worker Round-Trip (Skip classic workers in module Worker environment)
    if (config.workerType === "classic") {
      return;
    }

    await withLocalServer(async (serverOrigin) => {
      for (const target of ["js", "wasm"] as const) {
        const payload = target === "js" ? jsPayload : wasmPayload;
        const token = config.tokenType === "string"
          ? `test-token-${slug}-${target}`
          : Math.floor(Math.random() * 1000000);
        const msg = { token, ...payload, ...(config.prepared || {}) };
        const workerUrl = `${serverOrigin}${config.workerScript}`;

        const res = await new Promise<{ ok: boolean; data?: unknown; error?: string }>(
          (resolve) => {
            let worker: Worker | null = null;
            const timer = setTimeout(() => {
              if (worker) worker.terminate();
              resolve({
                ok: false,
                error: `${slug}[${target}] timed out waiting for worker message`,
              });
            }, 5000);

            try {
              worker = new Worker(workerUrl, { type: "module" });

              worker.addEventListener("error", (e: ErrorEvent) => {
                e.preventDefault();
                clearTimeout(timer);
                worker?.terminate();
                resolve({ ok: false, error: e.message || "worker error event" });
              });

              worker.addEventListener("message", (e: MessageEvent) => {
                clearTimeout(timer);
                const msgData = e.data as { type?: string; actionIndex?: number } | undefined;
                if (
                  config.ackEvents && msgData?.type === "event" &&
                  msgData?.actionIndex !== undefined
                ) {
                  worker?.postMessage({ type: "ack", token, actionIndex: msgData.actionIndex });
                }
                worker?.terminate();
                resolve({ ok: true, data: e.data });
              });

              worker.postMessage(msg);
            } catch (err: unknown) {
              clearTimeout(timer);
              if (worker) worker.terminate();
              const errorMsg = err instanceof Error ? err.message : String(err);
              resolve({ ok: false, error: errorMsg });
            }
          },
        );

        assert(res.ok, `${slug}[${target}]: ${res.error}`);
      }
    });
  });
}
