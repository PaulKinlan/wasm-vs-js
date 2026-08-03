export type TodoNetworkRecord = {
  sessionId: string;
  requestId: string;
  url: string;
  method: string;
  status: number | null;
  mimeType: string;
  fromDiskCache: boolean;
  fromServiceWorker: boolean;
  failed: boolean;
  completed: boolean;
  errorText: string | null;
};

function recordKey(sessionId: string, requestId: string): string {
  return `${sessionId}\u0000${requestId}`;
}

export class TodoNetworkLedger {
  #records = new Map<string, TodoNetworkRecord>();
  #eventErrors: string[] = [];

  request(sessionId: string, params: Record<string, unknown>): void {
    const requestId = String(params.requestId);
    const request = params.request as Record<string, unknown>;
    const key = recordKey(sessionId, requestId);
    if (this.#records.has(key)) {
      this.#eventErrors.push(`duplicate network request identity: ${key}`);
      return;
    }
    this.#records.set(key, {
      sessionId,
      requestId,
      url: String(request.url),
      method: String(request.method),
      status: null,
      mimeType: "",
      fromDiskCache: false,
      fromServiceWorker: false,
      failed: false,
      completed: false,
      errorText: null,
    });
  }

  response(sessionId: string, params: Record<string, unknown>): void {
    const record = this.#required(sessionId, String(params.requestId), "response");
    if (!record) return;
    const response = params.response as Record<string, unknown>;
    record.status = Number(response.status);
    record.mimeType = String(response.mimeType);
    record.fromDiskCache = Boolean(response.fromDiskCache);
    record.fromServiceWorker = Boolean(response.fromServiceWorker);
  }

  finished(sessionId: string, params: Record<string, unknown>): void {
    const record = this.#required(sessionId, String(params.requestId), "loadingFinished");
    if (record) record.completed = true;
  }

  failed(sessionId: string, params: Record<string, unknown>): void {
    const record = this.#required(sessionId, String(params.requestId), "loadingFailed");
    if (!record) return;
    record.failed = true;
    record.completed = true;
    record.errorText = String(params.errorText ?? "unknown network failure");
  }

  snapshot(): TodoNetworkRecord[] {
    return [...this.#records.values()].map((record) => ({ ...record }));
  }

  eventErrors(): string[] {
    return [...this.#eventErrors];
  }

  #required(sessionId: string, requestId: string, event: string): TodoNetworkRecord | null {
    const key = recordKey(sessionId, requestId);
    const record = this.#records.get(key);
    if (!record) {
      this.#eventErrors.push(`${event} without request identity: ${key}`);
      return null;
    }
    return record;
  }
}

const PAGE_ROSTER = Object.freeze([
  "/benchmarks/base-dom-todomvc-journey/",
  "/benchmarks/base-dom-todomvc-journey/controller.js",
  "/benchmarks/base-dom-todomvc-journey/styles.css",
  "/benchmarks/base/dom-todomvc-journey/fixture.js",
]);
const RUN_ROSTER = Object.freeze([
  "/benchmarks/base-dom-todomvc-journey/worker.js",
  "/data/base-dom-todomvc-journey.v1.json",
  "/data/workloads.v1.json",
  "/benchmarks/base/dom-todomvc-journey/engine.js",
  "/benchmarks/base/dom-todomvc-journey/fixture.js",
  "/artifacts/base-dom-todomvc-journey/runtime.js",
  "/artifacts/base-dom-todomvc-journey/todomvc.wasm",
  "/artifacts/base-dom-todomvc-journey/fixture.json",
  "/artifacts/base-dom-todomvc-journey/output-manifest.json",
  "/artifacts/base-dom-todomvc-journey/build-manifest.json",
]);

export function expectedTodoRequestRoster(workerRuns: number): Map<string, number> {
  if (!Number.isInteger(workerRuns) || workerRuns < 1 || workerRuns > 2) {
    throw new Error("worker run count outside TodoMVC scenario contract");
  }
  const roster = new Map<string, number>();
  const add = (path: string) => roster.set(path, (roster.get(path) ?? 0) + 1);
  PAGE_ROSTER.forEach(add);
  for (let run = 0; run < workerRuns; run += 1) RUN_ROSTER.forEach(add);
  return roster;
}

type WaitDependencies = {
  now?: () => number;
  sleep?: (milliseconds: number) => Promise<void>;
  failures?: () => string[];
  timeoutMs?: number;
  pollMs?: number;
};

function closureState(
  records: TodoNetworkRecord[],
  origin: string,
  expected: Map<string, number>,
) {
  const observed = new Map<string, number>();
  for (const record of records) {
    let url: URL;
    try {
      url = new URL(record.url);
    } catch {
      continue;
    }
    if (url.origin === origin) {
      observed.set(url.pathname, (observed.get(url.pathname) ?? 0) + 1);
    }
  }
  const missing = [...expected].flatMap(([path, count]) => {
    const absent = count - (observed.get(path) ?? 0);
    return absent > 0 ? [`${path} (${absent} missing)`] : [];
  });
  const incomplete = records.filter((record) => !record.completed).map((record) =>
    `${record.sessionId}:${record.requestId}:${record.url}`
  );
  const failed = records.filter((record) => record.failed).map((record) =>
    `${record.sessionId}:${record.requestId}:${record.url}:${record.errorText}`
  );
  return { missing, incomplete, failed };
}

export async function waitForTodoNetworkClosure(
  ledger: TodoNetworkLedger,
  origin: string,
  workerRuns: number,
  dependencies: WaitDependencies = {},
): Promise<TodoNetworkRecord[]> {
  const now = dependencies.now ?? Date.now;
  const sleep = dependencies.sleep ??
    ((milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds)));
  const timeoutMs = dependencies.timeoutMs ?? 10_000;
  const pollMs = dependencies.pollMs ?? 25;
  const deadline = now() + timeoutMs;
  const expected = expectedTodoRequestRoster(workerRuns);
  let state = closureState(ledger.snapshot(), origin, expected);
  state.failed.push(...ledger.eventErrors(), ...(dependencies.failures?.() ?? []));
  while (true) {
    if (state.failed.length) throw new Error(`network request failed: ${state.failed.join(", ")}`);
    if (!state.missing.length && !state.incomplete.length) return ledger.snapshot();
    if (now() >= deadline) {
      throw new Error(`network closure timeout: ${JSON.stringify(state)}`);
    }
    await sleep(pollMs);
    state = closureState(ledger.snapshot(), origin, expected);
    state.failed.push(...ledger.eventErrors(), ...(dependencies.failures?.() ?? []));
  }
}
