import {
  expectedTodoRequestRoster,
  TodoNetworkLedger,
  waitForTodoNetworkClosure,
} from "../lib/base-todomvc-network.ts";
import { assert, assertEquals, assertRejects } from "./assert.ts";

const origin = "http://127.0.0.1:8123";

type PopulateOptions = {
  leaveIncomplete?: string;
  fail?: string;
};

function populate(
  ledger: TodoNetworkLedger,
  workerRuns = 1,
  options: PopulateOptions = {},
) {
  let sequence = 0;
  let incomplete: { sessionId: string; requestId: string } | null = null;
  for (const [path, count] of expectedTodoRequestRoster(workerRuns)) {
    for (let occurrence = 0; occurrence < count; occurrence += 1) {
      sequence += 1;
      const requestId = `request-${sequence}`;
      const sessionId = path.startsWith("/data/") || path.startsWith("/artifacts/") ||
          path.endsWith("/engine.js")
        ? `worker-session-${occurrence + 1}`
        : "page-session";
      ledger.request(sessionId, {
        requestId,
        request: { url: `${origin}${path}`, method: "GET" },
      });
      ledger.response(sessionId, {
        requestId,
        response: {
          status: 200,
          mimeType: path.endsWith(".wasm") ? "application/wasm" : "text/javascript",
          fromDiskCache: false,
          fromServiceWorker: false,
        },
      });
      if (path === options.fail) {
        ledger.failed(sessionId, { requestId, errorText: "net::ERR_FAILED" });
      } else if (path === options.leaveIncomplete && incomplete === null) {
        incomplete = { sessionId, requestId };
      } else {
        ledger.finished(sessionId, { requestId });
      }
    }
  }
  return incomplete;
}

Deno.test("TodoMVC network closure deterministically awaits delayed loadingFinished", async () => {
  const ledger = new TodoNetworkLedger();
  const delayed = populate(ledger, 1, {
    leaveIncomplete: "/benchmarks/base-dom-todomvc-journey/worker.js",
  });
  assert(delayed);
  let now = 0;
  let sleeps = 0;
  const records = await waitForTodoNetworkClosure(ledger, origin, 1, {
    now: () => now,
    timeoutMs: 100,
    pollMs: 5,
    sleep: async (milliseconds) => {
      await Promise.resolve();
      now += milliseconds;
      sleeps += 1;
      ledger.finished(delayed.sessionId, { requestId: delayed.requestId });
    },
  });
  assertEquals(sleeps, 1);
  assert(records.every(({ completed }) => completed));
});

Deno.test("TodoMVC network ledger retains worker sessions and duplicate request IDs by session", () => {
  const lifecycleRoster = expectedTodoRequestRoster(2);
  assertEquals(lifecycleRoster.get("/benchmarks/base-dom-todomvc-journey/worker.js"), 2);
  assertEquals(lifecycleRoster.get("/benchmarks/base/dom-todomvc-journey/fixture.js"), 3);
  const ledger = new TodoNetworkLedger();
  for (
    const [sessionId, path] of [
      ["page-session", "/benchmarks/base-dom-todomvc-journey/worker.js"],
      ["worker-session", "/data/base-dom-todomvc-journey.v1.json"],
    ]
  ) {
    ledger.request(sessionId, {
      requestId: "duplicate-id",
      request: { url: `${origin}${path}`, method: "GET" },
    });
    ledger.response(sessionId, {
      requestId: "duplicate-id",
      response: {
        status: 200,
        mimeType: "text/javascript",
        fromDiskCache: false,
        fromServiceWorker: false,
      },
    });
    ledger.finished(sessionId, { requestId: "duplicate-id" });
  }
  const records = ledger.snapshot();
  assertEquals(records.length, 2);
  assertEquals(records.map(({ sessionId }) => sessionId), ["page-session", "worker-session"]);
  assert(records.every(({ requestId }) => requestId === "duplicate-id"));
});

Deno.test("TodoMVC network closure rejects failed requests with retained identity and detail", async () => {
  const ledger = new TodoNetworkLedger();
  populate(ledger, 1, { fail: "/artifacts/base-dom-todomvc-journey/runtime.js" });
  await assertRejects(
    () => waitForTodoNetworkClosure(ledger, origin, 1),
    "worker-session-1:request-10:http://127.0.0.1:8123/artifacts/base-dom-todomvc-journey/runtime.js:net::ERR_FAILED",
  );
});

Deno.test("TodoMVC network closure times out with missing roster and incomplete identities", async () => {
  const ledger = new TodoNetworkLedger();
  ledger.request("page-session", {
    requestId: "stalled",
    request: { url: `${origin}/benchmarks/base-dom-todomvc-journey/`, method: "GET" },
  });
  let now = 0;
  await assertRejects(
    () =>
      waitForTodoNetworkClosure(ledger, origin, 1, {
        now: () => now,
        timeoutMs: 10,
        pollMs: 5,
        sleep: async (milliseconds) => {
          await Promise.resolve();
          now += milliseconds;
        },
      }),
    "network closure timeout",
  );
  await assertRejects(
    () =>
      waitForTodoNetworkClosure(ledger, origin, 1, {
        now: () => now,
        timeoutMs: 0,
      }),
    "page-session:stalled",
  );
});
