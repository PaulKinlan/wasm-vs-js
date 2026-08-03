import Ajv2020Module from "ajv2020";
import addFormatsModule from "ajv-formats";
import {
  ACCEPTED_STATIC_COMMIT,
  assertEvidenceSemantics,
  EXPECTED_ASSETS,
  EXPECTED_CHROME_PRODUCT,
  EXPECTED_CHROME_SHA256,
  expectedCounters,
  ORACLE,
  OUTPUT_SHA256,
  proveDevToolsListenerOwned,
  SCENARIOS,
  validateCompleteResult,
  waitDevToolsActivePort,
} from "../scripts/collect-base-audio-webaudio-effects-browser-evidence.ts";
import {
  prepareProfile,
  removeOwnedProfile,
  setProfileRemovalRaceHookForTest,
} from "../lib/process-ledger.ts";
import { assert, assertEquals, assertRejects } from "./assert.ts";

type Validator = ((value: unknown) => boolean) & { errors?: unknown };
type AjvConstructor = new (options?: Record<string, unknown>) => {
  compile: (schema: unknown) => Validator;
};
const Ajv2020 = ((Ajv2020Module as unknown as { default?: AjvConstructor }).default ??
  Ajv2020Module) as unknown as AjvConstructor;
const addFormats = ((addFormatsModule as unknown as { default?: (ajv: unknown) => void }).default ??
  addFormatsModule) as unknown as (ajv: unknown) => void;
const H40 = "a".repeat(40);
const H64 = "b".repeat(64);
const ABC_SHA256 = "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad";

function base64File(path: string): string {
  const bytes = Deno.readFileSync(path);
  let binary = "";
  for (let offset = 0; offset < bytes.length; offset += 0x8000) {
    binary += String.fromCharCode(...bytes.subarray(offset, offset + 0x8000));
  }
  return btoa(binary);
}
function validator(schema: unknown): Validator {
  const ajv = new Ajv2020({ strict: false, allErrors: true });
  addFormats(ajv);
  return ajv.compile(schema);
}
function process(pid: number) {
  return {
    pid,
    parentPid: pid - 1,
    startTimeTicks: String(pid * 100),
    executable:
      "/home/paulkinlan/.cache/puppeteer/chrome/linux-150.0.7871.24/chrome-linux64/chrome",
  };
}
function success() {
  return { outcome: "success", checkedAt: "2026-08-03T12:01:00Z", remaining: [] };
}
function assets() {
  return Object.entries(EXPECTED_ASSETS).map(([route, sourcePath]) => ({
    route,
    sourcePath,
    bytes: 100,
    sha256: H64,
    gitBlob: H40,
  }));
}
function targetIdentity(index: number) {
  return { targetId: `target-${index}`, sessionId: `session-${index}` };
}
function network(index: number) {
  return {
    context: index % 2 ? "worker" : "page",
    sessionId: `session-${index}`,
    requestId: `request-${index}`,
    url: `http://127.0.0.1:8123/${index}.js`,
    method: "GET",
    resourceType: "Script",
    status: 200,
    mimeType: "text/javascript",
    fromDiskCache: false,
    fromServiceWorker: false,
    failed: false,
    responseBody: {
      status: "supported",
      bytes: 3,
      sha256: ABC_SHA256,
      base64: "YWJj",
      sourcePath: "public/base-audio-effects-worker.js",
      gitBlob: H40,
    },
  };
}
function executed(index: number) {
  return {
    context: index ? "worker" : "page",
    sessionId: `session-${index}`,
    route: index ? "/base-audio-effects-worker.js" : "/base-audio-effects-demo.js",
    sourcePath: index ? "public/base-audio-effects-worker.js" : "public/base-audio-effects-demo.js",
    bytes: 3,
    sha256: ABC_SHA256,
    base64: "YWJj",
    gitBlob: H40,
  };
}
function common(id: string, action: string, target: "javascript" | "wasm-linear") {
  const workerCount = ["stale-restart", "restart"].includes(action) ? 2 : 1;
  const lifecycleStatus: Record<string, string> = {
    "wrong-token": "Cancelled. No result was retained.",
    "stale-restart": "Cancelled. No result was retained.",
    restart: "Cancelled. No result was retained.",
    cancel: "Cancelled. No result was retained.",
    timeout: "Stopped: the 120-second validation timeout expired.",
    pagehide: "Page hidden; active work was terminated.",
  };
  return {
    id,
    action,
    target,
    pageTarget: targetIdentity(0),
    workerTargets: Array.from({ length: workerCount }, (_, index) => targetIdentity(index + 1)),
    statusHistory: ["Ready.", action === "complete" ? "Complete." : "Cancelled."],
    finalState: {
      status: action === "complete"
        ? "Complete. The full output matched the committed oracle."
        : lifecycleStatus[action],
      output: action === "complete" ? `Target: ${target}` : "",
      progress: action === "complete" ? 4 : 0,
      startDisabled: false,
      cancelDisabled: true,
    },
    network: [network(0), network(1), network(2), network(3)],
    executedScripts: [executed(0), executed(1)],
    console: [],
    exceptions: [],
    accessibility: {
      bodyText:
        "Complete 60-second stereo effects rack No performance claim. JavaScript strict f32 Linear Wasm strict f32 Correctness result",
      statusText: action === "complete"
        ? "Complete. The full output matched the committed oracle."
        : lifecycleStatus[action],
      resultText: action === "complete" ? `Target: ${target}` : "",
      axControls: [
        {
          role: "heading",
          name: "Complete 60-second stereo effects rack",
          relationships: [],
        },
        {
          role: "combobox",
          name: "Engine",
          relationships: [{
            type: "label",
            targets: [{ backendDOMNodeId: 10, text: "Engine" }],
          }],
        },
        { role: "button", name: "Start full validation", relationships: [] },
        { role: "button", name: "Cancel", relationships: [] },
        { role: "progressbar", name: "Validation phase", relationships: [] },
      ],
    },
    screenshot: { file: `screenshots/${id}.png`, bytes: 100, sha256: H64 },
  };
}
function observations(target: "javascript" | "wasm-linear") {
  return {
    blocksPerChannel: [22_500, 22_500],
    blockInvocations: 45_000,
    stateCarryBoundaries: 44_998,
    tailFlushInvocations: 2,
    tailFlushFrames: 30,
    processingBoundaryCrossings: target === "wasm-linear" ? 45_002 : 0,
  };
}
function complete(id: string, target: "javascript" | "wasm-linear") {
  return {
    ...common(id, "complete", target),
    result: {
      target,
      completeOutputSha256: OUTPUT_SHA256,
      completeOutputBytes: 23_040_120,
      observations: observations(target),
      counters: expectedCounters(target),
      oracle: ORACLE,
      passed: true,
    },
    execution: {
      workloadBlob: {
        objectUrl: "blob:http://127.0.0.1:8123/workload",
        mimeType: "text/javascript",
        bytes: 10_477,
        sha256: "61d09e66febd9fa65916472219198306aa43e4d7a9095c8d94aa1daa6f6b4174",
        base64: base64File("benchmarks/base/audio-webaudio-effects/workload.js"),
      },
      wasmModules: target === "wasm-linear"
        ? [{
          bytes: 784,
          sha256: "495d214fd2b8970cd212de10346ba97a6f50813aa9735e85cc51f6e202935328",
          base64: base64File(
            "public/artifacts/base-audio-webaudio-effects-v1/audio-webaudio-effects.wasm",
          ),
        }]
        : [],
      completedWorkerImportedBlob: true,
    },
  };
}
function lifecycle(id: string, action: string, target: "javascript" | "wasm-linear") {
  const checks: Record<string, string> = {
    "wrong-token": "wrong-token completion was ignored without visible mutation",
    "stale-restart": "stale prior-worker error was ignored after a fresh restart",
    restart: "cancel then restart replaced the exact prior worker and token",
    cancel: "visible Cancel terminated the active worker and retained no result",
    timeout: "the registered 120-second timeout path terminated the active worker",
    pagehide: "pagehide terminated the active worker and reset visible controls",
  };
  return {
    ...common(id, action, target),
    lifecycle: { checks: [checks[id]] },
  };
}
function fixture() {
  const launchArguments = [
    "--user-data-dir=/tmp/wasm-vs-js-owned-profiles/audio-effects-abcdef/launch",
    "--remote-debugging-port=0",
    "--remote-debugging-address=127.0.0.1",
    "--headless=new",
    "--no-sandbox",
    "--disable-gpu",
    "--disable-background-networking",
    "--disable-component-update",
    "--disable-default-apps",
    "--disable-extensions",
    "--disable-sync",
    "--disable-crash-reporter",
    "--disable-breakpad",
    "--metrics-recording-only",
    "--no-first-run",
    "--no-default-browser-check",
    "--hide-scrollbars",
    "--enable-automation",
    "--window-size=1440,1200",
    "about:blank",
  ];
  return {
    schemaVersion: 1,
    workload: "audio.webaudio-effects.v1",
    evidenceId: "audio-webaudio-effects-browser-aaaaaaaaaaaa",
    collectedAt: "2026-08-03T12:00:00Z",
    acceptedStaticCommit: ACCEPTED_STATIC_COMMIT,
    source: {
      start: { commit: H40, tree: H40, cleanStatus: "clean" },
      end: { commit: H40, tree: H40, cleanStatus: "clean" },
      unchanged: true,
      root: "/source/wasm-vs-js",
      assets: assets(),
    },
    collector: {
      script: "scripts/collect-base-audio-webaudio-effects-browser-evidence.ts",
      bytes: 50_000,
      sha256: H64,
      command: ["deno", "run", "-A", "script", "--chrome=path", "--output=path"],
      denoVersion: "2.9.0",
    },
    browser: {
      product: EXPECTED_CHROME_PRODUCT,
      revision: "revision",
      userAgent: "agent",
      jsVersion: "15.0",
      executable:
        "/home/paulkinlan/.cache/puppeteer/chrome/linux-150.0.7871.24/chrome-linux64/chrome",
      executableBytes: 281_758_968,
      executableSha256: EXPECTED_CHROME_SHA256,
      executableDevice: 56,
      executableInode: 2_998_549,
      launchArguments,
      effectiveArguments: [...launchArguments],
      headless: true,
      protocol: "Chrome DevTools Protocol",
      profile: {
        path: "/tmp/wasm-vs-js-owned-profiles/audio-effects-abcdef/launch",
        device: 56,
        inode: 9_999,
        mode: 448,
        createdEmpty: true,
      },
      cgroup: {
        unit: "wasm-audio-effects-abcdef0123456789.service",
        controlGroup: "/user.slice/exact.service",
        path: "/sys/fs/cgroup/user.slice/exact.service",
        device: 1,
        inode: 2,
        invocationId: "c".repeat(32),
        mainPid: 100,
        memberSnapshots: [
          { at: "2026-08-03T12:00:01Z", pids: [100] },
          { at: "2026-08-03T12:00:02Z", pids: [] },
        ],
        listenerAssertions: [
          {
            at: "2026-08-03T12:00:01Z",
            port: 9222,
            socketInode: "12345",
            ownerPid: 100,
            ownerFd: "9",
            cgroupPids: [100],
          },
          {
            at: "2026-08-03T12:00:02Z",
            port: 9222,
            socketInode: "12345",
            ownerPid: 100,
            ownerFd: "9",
            cgroupPids: [100],
          },
        ],
      },
      processes: [process(100), process(101)],
    },
    server: {
      origin: "http://127.0.0.1:8123",
      mode: "public",
      launcher: process(200),
    },
    contract: {
      seconds: 60,
      channels: 2,
      frames: 2_880_000,
      outputFrames: 2_880_015,
      outputBytes: 23_040_120,
      outputSha256: OUTPUT_SHA256,
      targets: ["javascript", "wasm-linear"],
      blocksPerChannel: 22_500,
      blockInvocations: 45_000,
      stateCarryBoundaries: 44_998,
      oracle: ORACLE,
      performanceClaim: false,
    },
    scenarios: [
      complete("javascript-complete", "javascript"),
      complete("wasm-linear-complete", "wasm-linear"),
      lifecycle("wrong-token", "wrong-token", "javascript"),
      lifecycle("stale-restart", "stale-restart", "javascript"),
      lifecycle("restart", "restart", "wasm-linear"),
      lifecycle("cancel", "cancel", "javascript"),
      lifecycle("timeout", "timeout", "wasm-linear"),
      lifecycle("pagehide", "pagehide", "javascript"),
    ],
    cleanup: {
      browserProcesses: success(),
      cgroup: success(),
      profile: success(),
      server: success(),
    },
  };
}
function assertInvalid(validate: Validator, mutate: (record: ReturnType<typeof fixture>) => void) {
  const value = structuredClone(fixture());
  mutate(value);
  assert(!validate(value), `negative unexpectedly passed: ${JSON.stringify(validate.errors)}`);
}
function assertThrows(fn: () => unknown, includes: string) {
  try {
    fn();
  } catch (error) {
    assert(error instanceof Error && error.message.includes(includes), String(error));
    return;
  }
  throw new Error("expected function to throw");
}

Deno.test("WebAudio browser schema accepts exactly two full targets and six causal lifecycle probes", async () => {
  const schema = JSON.parse(
    await Deno.readTextFile("schemas/base-audio-webaudio-effects-browser-evidence.schema.json"),
  );
  const validate = validator(schema);
  const value = fixture();
  assert(validate(value), JSON.stringify(validate.errors));
  assertEquals(
    value.scenarios.map((scenario) => scenario.id),
    SCENARIOS.map((scenario) => scenario.id),
  );
  assertEquals(value.source.assets.length, 8);
  assertEquals(value.browser.launchArguments.includes("--enable-automation"), true);
});

Deno.test("WebAudio browser schema rejects semantic counter, provenance, raw-byte, lifecycle, and cleanup substitutions", async () => {
  const schema = JSON.parse(
    await Deno.readTextFile("schemas/base-audio-webaudio-effects-browser-evidence.schema.json"),
  );
  const validate = validator(schema);
  assertInvalid(validate, (value) => Object.assign(value, { unexpected: true }));
  assertInvalid(validate, (value) => value.acceptedStaticCommit = H40);
  assertInvalid(validate, (value) => value.source.unchanged = false);
  assertInvalid(validate, (value) => value.scenarios[0].accessibility.axControls[1].name = "");
  assertInvalid(validate, (value) => value.source.assets.pop());
  assertInvalid(validate, (value) => value.browser.product = "Chromium/150.0.7871.24");
  assertInvalid(validate, (value) => value.browser.executableSha256 = H64);
  assertInvalid(validate, (value) => {
    value.browser.launchArguments = value.browser.launchArguments.filter((entry) =>
      entry !== "--enable-automation"
    );
  });
  assertInvalid(validate, (value) => value.browser.cgroup.memberSnapshots = []);
  assertInvalid(validate, (value) => value.scenarios.pop());
  assertInvalid(validate, (value) => {
    [value.scenarios[0], value.scenarios[1]] = [value.scenarios[1], value.scenarios[0]];
  });
  assertInvalid(validate, (value) => {
    const scenario = value.scenarios[0] as unknown as ReturnType<typeof complete>;
    scenario.result.counters["block-invocations"] = 1;
  });
  assertInvalid(validate, (value) => {
    const scenario = value.scenarios[0] as unknown as ReturnType<typeof complete>;
    scenario.result.counters["state-carry-boundaries"] = 0;
  });
  assertInvalid(validate, (value) => {
    const scenario = value.scenarios[1] as unknown as ReturnType<typeof complete>;
    scenario.result.observations.blocksPerChannel.pop();
  });
  assertInvalid(validate, (value) => {
    const scenario = value.scenarios[1] as unknown as ReturnType<typeof complete>;
    scenario.execution.wasmModules = [];
  });
  assertInvalid(validate, (value) => {
    const scenario = value.scenarios[0] as unknown as ReturnType<typeof complete>;
    scenario.execution.wasmModules = [{
      bytes: 784,
      sha256: "495d214fd2b8970cd212de10346ba97a6f50813aa9735e85cc51f6e202935328",
      base64: "AGFzbQ==",
    }];
  });
  assertInvalid(validate, (value) => value.scenarios[0].network[0].responseBody = null!);
  assertInvalid(validate, (value) => value.scenarios[0].exceptions = [{ text: "boom" }] as never[]);
  assertInvalid(validate, (value) => {
    const scenario = value.scenarios[2] as unknown as ReturnType<typeof lifecycle>;
    scenario.lifecycle.checks = ["arbitrary lifecycle prose"];
  });
  assertInvalid(validate, (value) => {
    const scenario = value.scenarios[0] as unknown as ReturnType<typeof complete>;
    scenario.execution.workloadBlob.base64 = "YWJj";
  });
  assertInvalid(validate, (value) => value.cleanup.cgroup.outcome = "failure");
});

Deno.test("browser evidence semantics bind source identity and every retained base64 byte/hash", async () => {
  const valid = fixture();
  await assertEvidenceSemantics(valid);
  const changedSource = structuredClone(valid);
  changedSource.source.end.commit = "c".repeat(40);
  await assertRejects(
    () => assertEvidenceSemantics(changedSource),
    "source start/end commit and tree are not semantically unchanged",
  );
  const changedPayload = structuredClone(valid);
  const scenario = changedPayload.scenarios[0] as unknown as ReturnType<typeof complete>;
  scenario.execution.workloadBlob.base64 = `${
    scenario.execution.workloadBlob.base64.slice(0, -4)
  }AAAA`;
  await assertRejects(
    () => assertEvidenceSemantics(changedPayload),
    "workload Blob base64 bytes/hash mismatch",
  );
  const changedListener = structuredClone(valid);
  changedListener.browser.cgroup.listenerAssertions[1].socketInode = "99999";
  await assertRejects(
    () => assertEvidenceSemantics(changedListener),
    "DevTools listener before/after ownership proof mismatch",
  );
  const changedLifecycle = structuredClone(valid);
  (changedLifecycle.scenarios[2] as unknown as ReturnType<typeof lifecycle>).lifecycle.checks = [
    "arbitrary lifecycle prose",
  ];
  await assertRejects(
    () => assertEvidenceSemantics(changedLifecycle),
    "lifecycle assertion is not causal",
  );
});

Deno.test("complete-result validator requires exact 60-second output and every observed fixed-block counter", () => {
  const text = [
    "Target: javascript",
    `Complete output SHA-256: ${OUTPUT_SHA256}`,
    "Frames: 2880000",
    "Blocks per channel: 22500",
    "Block invocations: 45000",
    "Output samples: 5760030",
    "Convolution MACs: 92160480",
    "Boundary crossings: 0",
  ].join("\n");
  const result = validateCompleteResult("javascript", text, observations("javascript"));
  assertEquals(result.counters, expectedCounters("javascript"));
  assertEquals(result.oracle, ORACLE);
  const altered = observations("javascript");
  altered.stateCarryBoundaries--;
  assertThrows(
    () => validateCompleteResult("javascript", text, altered),
    "observed block/state/tail execution mismatch",
  );
  assertThrows(
    () =>
      validateCompleteResult(
        "javascript",
        text.replace(OUTPUT_SHA256, H64),
        observations("javascript"),
      ),
    "visible complete-output contract mismatch",
  );
  assertThrows(
    () => validateCompleteResult("wasm-linear", text, observations("wasm-linear")),
    "visible complete-output contract mismatch",
  );
});

Deno.test("collector rejects symlink DevToolsActivePort and proves its listener inode owner twice", async () => {
  const profile = await Deno.makeTempDir();
  const foreign = await Deno.makeTempFile();
  const procRoot = await Deno.makeTempDir();
  const cgroupPath = await Deno.makeTempDir();
  try {
    await Deno.writeTextFile(foreign, "9222\n/devtools/browser/owned\n");
    await Deno.symlink(foreign, `${profile}/DevToolsActivePort`);
    await assertRejects(
      () => waitDevToolsActivePort(profile, 50),
      "unsafe DevToolsActivePort",
    );
    await Deno.remove(`${profile}/DevToolsActivePort`);
    await Deno.writeTextFile(`${profile}/DevToolsActivePort`, "9222\n/devtools/browser/owned\n");
    assertEquals(await waitDevToolsActivePort(profile, 50), {
      port: 9222,
      browserPath: "/devtools/browser/owned",
    });

    await Deno.mkdir(`${procRoot}/net`, { recursive: true });
    await Deno.writeTextFile(
      `${procRoot}/net/tcp`,
      "sl local_address rem_address st tx_queue rx_queue tr tm->when retrnsmt uid timeout inode\n" +
        "0: 0100007F:2406 00000000:0000 0A 00000000:00000000 00:00000000 00000000 1000 0 12345 1\n",
    );
    await Deno.mkdir(`${procRoot}/700/fd`, { recursive: true });
    await Deno.symlink("socket:[12345]", `${procRoot}/700/fd/9`);
    await Deno.writeTextFile(`${cgroupPath}/cgroup.procs`, "700\n");
    const info = await Deno.lstat(cgroupPath);
    const cgroup = {
      path: cgroupPath,
      device: Number(info.dev),
      inode: Number(info.ino),
    };
    const before = await proveDevToolsListenerOwned(9222, cgroup, procRoot);
    const after = await proveDevToolsListenerOwned(9222, cgroup, procRoot);
    assertEquals(before.socketInode, "12345");
    assertEquals(before.ownerPid, 700);
    assertEquals(after.ownerPid, 700);
  } finally {
    await Deno.remove(profile, { recursive: true });
    await Deno.remove(foreign).catch(() => {});
    await Deno.remove(procRoot, { recursive: true });
    await Deno.remove(cgroupPath, { recursive: true });
  }
});

Deno.test("collector profile cleanup rejects final replacement window without following it", async () => {
  const root = `/tmp/wasm-vs-js-owned-profiles/audio-effects-test-${crypto.randomUUID()}/launch`;
  const outside = await Deno.makeTempDir();
  const profile = await prepareProfile(root);
  await Deno.writeTextFile(`${outside}/keep`, "foreign");
  let replaced = false;
  setProfileRemovalRaceHookForTest(async (path) => {
    if (replaced || path !== root) return;
    replaced = true;
    await Deno.rename(root, `${profile.ownershipRoot}/held`);
    await Deno.symlink(outside, root);
  });
  try {
    await assertRejects(() => removeOwnedProfile(profile), "fd-relative profile removal failed");
    assertEquals(await Deno.readTextFile(`${outside}/keep`), "foreign");
  } finally {
    setProfileRemovalRaceHookForTest();
    await Deno.remove(profile.ownershipRoot, { recursive: true }).catch(() => {});
    await Deno.remove(outside, { recursive: true });
  }
});

Deno.test("collector source freezes exact CfT, parent cgroup/session ownership, trust chain, causal lifecycle, diagnostics, and protected cleanup without Chrome", async () => {
  const source = await Deno.readTextFile(
    "scripts/collect-base-audio-webaudio-effects-browser-evidence.ts",
  );
  for (
    const required of [
      EXPECTED_CHROME_PRODUCT,
      EXPECTED_CHROME_SHA256,
      '"--enable-automation"',
      '"status",\n    "--porcelain=v1"',
      '"rev-parse", "HEAD^{tree}"',
      "accepted static WebAudio commit is not an ancestor",
      "raw response differs from frozen source",
      "executed script differs from frozen source",
      "executed Blob bytes differ from frozen workload source",
      "executed Wasm module bytes differ from the frozen artifact",
      "source commit/tree/status changed during browser collection",
      "Target.setAutoAttach",
      "Runtime.consoleAPICalled",
      "Runtime.exceptionThrown",
      "Network.getResponseBody",
      "Debugger.getScriptSource",
      "Accessibility.getFullAXTree",
      "AX Engine combobox omitted its label relationship",
      "Page.captureScreenshot",
      'id: "wrong-token"',
      'id: "stale-restart"',
      'id: "restart"',
      'id: "cancel"',
      'id: "timeout"',
      'id: "pagehide"',
      "cgroup.kill",
      "unsafe DevToolsActivePort",
      "DevTools listener inode has no owner in exact Chrome cgroup",
      "O_DIRECTORY|O_NOFOLLOW",
      "removeOwnedProfile(ownedProfile)",
      "profile retained because process containment cleanup did not succeed",
    ]
  ) assert(source.includes(required), `collector omitted ${required}`);
  for (const forbidden of ["pkill", "killall", "Deno.kill(-1", "performanceClaim: true"]) {
    assert(!source.includes(forbidden), `collector contains forbidden ${forbidden}`);
  }
});

Deno.test("every material object in the WebAudio browser schema is closed", async () => {
  const schema = JSON.parse(
    await Deno.readTextFile("schemas/base-audio-webaudio-effects-browser-evidence.schema.json"),
  );
  const open: string[] = [];
  function visit(value: unknown, path: string): void {
    if (!value || typeof value !== "object") return;
    if (Array.isArray(value)) {
      value.forEach((entry, index) => visit(entry, `${path}/${index}`));
      return;
    }
    const record = value as Record<string, unknown>;
    if (record.type === "object" && record.required && record.additionalProperties !== false) {
      open.push(path);
    }
    for (const [key, entry] of Object.entries(record)) visit(entry, `${path}/${key}`);
  }
  visit(schema, "#");
  assertEquals(open, []);
});
