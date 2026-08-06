import Ajv2020Module from "ajv2020";
import addFormatsModule from "ajv-formats";
import {
  acquireOwnedSession,
  assertBrowserCase,
  assertCleanStatus,
  assertExhaustiveNetwork,
  assertFetchedAssets,
  assertOwnedDevToolsListener,
  assertTargetPairings,
  assertVisibleControlOutput,
  assertVisibleControls,
  expectedCaseContracts,
  expectedCounters,
  expectedLifecycleRecords,
  expectedMemoryPages,
  FETCHED_ASSETS,
  lifecycleSemantics,
  refreshOwnedSession,
  visibleControlText,
} from "../scripts/collect-base-crypto-file-integrity-browser-evidence.ts";
import { assert, assertEquals, assertRejects } from "./assert.ts";

const Ajv2020 = (Ajv2020Module as unknown as { default?: typeof Ajv2020Module }).default ??
  Ajv2020Module;
const addFormats = ((addFormatsModule as unknown as {
  default?: (instance: unknown) => void;
}).default ?? addFormatsModule) as unknown as (instance: unknown) => void;
const registration = JSON.parse(
  await Deno.readTextFile("registrations/base/crypto.file-integrity.v1.json"),
);
const schema = JSON.parse(
  await Deno.readTextFile("schemas/base-crypto-file-integrity-browser-evidence.schema.json"),
);
function validatorFor(property: string) {
  const ajv = new (Ajv2020 as unknown as new (
    options: Record<string, unknown>,
  ) => { compile: (schema: unknown) => ((value: unknown) => boolean) & { errors?: unknown } })({
    allErrors: true,
    strict: true,
  });
  addFormats(ajv);
  return ajv.compile({
    $schema: schema.$schema,
    $defs: schema.$defs,
    ...schema.properties[property],
  });
}

Deno.test("crypto Chrome collector freezes the exact 36-case output, counters, and memory contract", async () => {
  const cases = expectedCaseContracts(registration);
  assertEquals(cases.length, 36);
  assertEquals(new Set(cases.map((entry) => entry.id)).size, 36);
  assertEquals(
    cases.filter((entry) => entry.target === "js-controlled").length,
    18,
  );
  assertEquals(
    cases.filter((entry) => entry.target === "wasm-linear-controlled").length,
    18,
  );
  for (const entry of cases) {
    assertEquals(entry.output.digestSha256, entry.expectedDigestSha256);
    assertEquals(
      entry.output.counters,
      expectedCounters(entry.byteLength, entry.schedule, entry.target),
    );
    assertEquals(
      entry.wasmMemoryPages,
      expectedMemoryPages(entry.byteLength, entry.schedule, entry.target),
    );
    assertBrowserCase(entry, entry);
  }
  assertTargetPairings(cases);
  const full = cases.filter((entry) =>
    entry.target === "wasm-linear-controlled" && entry.byteLength === 268_435_456 &&
    entry.schedule === "whole-buffer"
  );
  assertEquals(full.length, 2);
  assert(full.every((entry) => entry.wasmMemoryPages === 4098));
  assertEquals(full[0].output.counters, {
    "input-bytes": 268_435_456,
    "scheduled-chunks": 1,
    "sha256-compression-blocks": 4_194_305,
    "copied-bytes": 268_435_456,
    "boundary-crossings": 3,
    "engine-buffer-allocations": 0,
  });

  const wrongDigest = structuredClone(cases[0]);
  wrongDigest.output.digestSha256 = "0".repeat(64);
  await assertRejects(
    () => Promise.resolve(assertBrowserCase(wrongDigest, cases[0])),
    "browser case mismatch",
  );
  const wrongPages = structuredClone(full[0]);
  wrongPages.wasmMemoryPages = 4099;
  await assertRejects(
    () => Promise.resolve(assertBrowserCase(wrongPages, full[0])),
    "browser case mismatch",
  );
  const unpaired = structuredClone(cases);
  unpaired[1].target = "js-controlled";
  await assertRejects(
    () => Promise.resolve(assertTargetPairings(unpaired)),
    "target pairing mismatch",
  );
  const differentPairDigest = structuredClone(cases);
  differentPairDigest[1].output.digestSha256 = "0".repeat(64);
  await assertRejects(
    () => Promise.resolve(assertTargetPairings(differentPairDigest)),
    "target pairing mismatch",
  );
});

Deno.test("browser evidence schema closes every case and lifecycle control without retaining authored evidence", async () => {
  const validateCases = validatorFor("cases");
  const cases = expectedCaseContracts(registration);
  assert(validateCases(cases), JSON.stringify(validateCases.errors));

  const duplicateCombination = structuredClone(cases);
  duplicateCombination[35] = structuredClone(duplicateCombination[0]);
  duplicateCombination[35].id = "different-id-does-not-change-the-Cartesian-case";
  assert(!validateCases(duplicateCombination), "schema accepted a duplicate Cartesian case");
  const missing = structuredClone(cases);
  missing.pop();
  assert(!validateCases(missing), "schema accepted 35/36 cases");
  const extraProperty = structuredClone(cases);
  (extraProperty[0] as Record<string, unknown>).timingMs = 0;
  assert(!validateCases(extraProperty), "schema accepted an unregistered timing field");
  const impossiblePages = structuredClone(cases);
  impossiblePages.find((entry) => entry.wasmMemoryPages === 4098)!.wasmMemoryPages = 4099;
  assert(!validateCases(impossiblePages), "schema accepted 4,099 Wasm pages");

  const lifecycle = expectedLifecycleRecords();
  lifecycleSemantics(lifecycle);
  const validateLifecycle = validatorFor("lifecycle");
  assert(validateLifecycle(lifecycle), JSON.stringify(validateLifecycle.errors));
  const duplicate = structuredClone(lifecycle);
  duplicate[5] = structuredClone(duplicate[3]);
  assert(!validateLifecycle(duplicate), "schema accepted missing pagehide and duplicate cancel");
  const fabricatedState = structuredClone(lifecycle);
  (fabricatedState[0].stateBeforeCleanup as Record<string, unknown>).status = "fabricated";
  assert(!validateLifecycle(fabricatedState), "schema accepted a fabricated lifecycle state");
  await assertRejects(
    () => Promise.resolve(lifecycleSemantics(fabricatedState)),
    "lifecycle corpus semantics",
  );
  const runningWorker = structuredClone(lifecycle);
  (runningWorker[4].workers as Array<Record<string, unknown>>)[0].terminated = false;
  assert(!validateLifecycle(runningWorker), "schema accepted an unterminated lifecycle worker");
});

Deno.test("visible output, controls, console, and network schemas reject semantic contradictions", async () => {
  const cases = expectedCaseContracts(registration);
  const digest = async (path: string) => {
    const bytes = await Deno.readFile(path);
    return Array.from(
      new Uint8Array(await crypto.subtle.digest("SHA-256", bytes)),
      (value) => value.toString(16).padStart(2, "0"),
    ).join("");
  };
  const exactContract = {
    registrationSha256: await digest("registrations/base/crypto.file-integrity.v1.json"),
    buildManifestSha256: await digest(
      "public/artifacts/crypto-file-integrity/build-manifest.json",
    ),
    artifactSha256: await digest(
      "public/artifacts/crypto-file-integrity/crypto-file-integrity.wasm",
    ),
  };
  const output = {
    workloadId: "crypto.file-integrity.v1",
    target: cases[0].target,
    kind: cases[0].kind,
    byteLength: cases[0].byteLength,
    schedule: cases[0].schedule,
    digestSha256: cases[0].output.digestSha256,
    counters: cases[0].output.counters,
    exactContract: { ...exactContract, sourceHashesMatched: true },
    performanceClaim: null,
  };
  assertVisibleControlOutput(output, cases[0], exactContract);
  const visible = {
    caseId: cases[0].id,
    finalStatus: "Complete. Exact digest and work counters passed.",
    output,
    passed: true,
  };
  const validateVisible = validatorFor("visibleControlRun");
  assert(validateVisible(visible), JSON.stringify(validateVisible.errors));
  for (const field of ["digestSha256", "counters", "exactContract"] as const) {
    const mutated = structuredClone(visible);
    if (field === "digestSha256") mutated.output.digestSha256 = "0".repeat(64);
    else if (field === "counters") mutated.output.counters["input-bytes"] = 1;
    else mutated.output.exactContract.artifactSha256 = "0".repeat(64);
    assert(!validateVisible(mutated), `schema accepted wrong visible ${field}`);
  }

  const controls = [
    { id: "target", text: "Engine", disabled: false },
    { id: "kind", text: "Generated fixture", disabled: false },
    { id: "size", text: "Exact size", disabled: false },
    { id: "schedule", text: "Chunk schedule", disabled: false },
    { id: "start", text: "Start", disabled: false },
    { id: "cancel", text: "Cancel", disabled: true },
  ];
  assertVisibleControls(controls);

  const html = await Deno.readTextFile("public/benchmarks/crypto.file-integrity.v1/index.html");
  const wrappedTargetLabel = (html.match(/<label\s+for="target">[\s\S]*?<\/label>/g) ?? []).find(
    (label) => label.includes("Engine<select"),
  ) ?? "";
  assert(
    wrappedTargetLabel.includes("Engine<select") &&
      wrappedTargetLabel.includes("Hand-written JavaScript SHA-256") &&
      wrappedTargetLabel.includes("Authored linear-Wasm SHA-256"),
    "real demo target label no longer wraps the select and its options",
  );
  const wrappedOptionText = "Hand-written JavaScript SHA-256Authored linear-Wasm SHA-256";
  const directLabelText = "Engine";
  const realDomEquivalentControl = {
    textContent: wrappedOptionText,
    labels: [{
      textContent: `${directLabelText}${wrappedOptionText}`,
      cloneNode: () => {
        let controlPresent = true;
        return {
          get textContent() {
            return `${directLabelText}${controlPresent ? wrappedOptionText : ""}`;
          },
          querySelector: (selector: string) =>
            selector === "select,button" ? { remove: () => controlPresent = false } : null,
        };
      },
    }],
  };
  assertEquals(
    realDomEquivalentControl.labels[0].textContent,
    "EngineHand-written JavaScript SHA-256Authored linear-Wasm SHA-256",
  );
  assertEquals(visibleControlText(realDomEquivalentControl), "Engine");

  const duplicateControls = structuredClone(controls);
  duplicateControls[5] = structuredClone(duplicateControls[0]);
  await assertRejects(
    () => Promise.resolve(assertVisibleControls(duplicateControls)),
    `visible controls mismatch: actual=${JSON.stringify(duplicateControls)} expected=`,
  );
  const concatenatedLabelControls = structuredClone(controls);
  concatenatedLabelControls[0].text = realDomEquivalentControl.labels[0].textContent;
  await assertRejects(
    () => Promise.resolve(assertVisibleControls(concatenatedLabelControls)),
    `actual=${JSON.stringify(concatenatedLabelControls)} expected=${JSON.stringify(controls)}`,
  );
  const validateAccessibility = validatorFor("accessibility");
  const accessibility = {
    lang: "en",
    title: "SHA-256 file integrity demo | Wasm versus JavaScript",
    live: "polite",
    outputTabIndex: 0,
    bodyTextSha256: "0".repeat(64),
    requiredText: [
      "No performance claim.",
      "The page uploads and stores nothing.",
      "2 fixture kinds × 3 sizes × 3 schedules × 2 targets.",
      "256 MiB whole-buffer Wasm case may grow linear memory to 4,098 pages.",
      "Every run stops after 180 seconds.",
    ],
    controls,
    axNodes: Array.from({ length: 6 }, (_, index) => ({ role: "button", name: `control${index}` })),
    passed: true,
  };
  assert(validateAccessibility(accessibility), JSON.stringify(validateAccessibility.errors));
  accessibility.controls = duplicateControls;
  assert(!validateAccessibility(accessibility), "schema accepted duplicate controls");

  const validateConsole = validatorFor("console");
  assert(validateConsole({ messages: [], exceptions: [] }), JSON.stringify(validateConsole.errors));
  assert(
    !validateConsole({ messages: [{ type: "error", arguments: ["boom"] }], exceptions: [] }),
    "schema accepted a console error",
  );

  const network = [{
    requestId: "1",
    sessionId: "session",
    targetId: "target",
    targetType: "page" as const,
    url: "http://127.0.0.1:8000/styles.css",
    method: "GET",
    resourceType: "Stylesheet",
    status: 200,
    mimeType: "text/css",
    fromDiskCache: false,
    fromServiceWorker: false,
    failed: false,
    errorText: null,
    bodyBytes: 1,
    bodySha256: "0".repeat(64),
  }];
  assertExhaustiveNetwork(network, "http://127.0.0.1:8000", new Set(["/styles.css"]));
  const external = structuredClone(network);
  external[0].url = "https://example.com/escaped";
  await assertRejects(
    () =>
      Promise.resolve(assertExhaustiveNetwork(
        external,
        "http://127.0.0.1:8000",
        new Set(["/styles.css"]),
      )),
    "network request denied",
  );
  const unpairedNetwork = structuredClone(network);
  unpairedNetwork[0].targetId = "";
  await assertRejects(
    () =>
      Promise.resolve(assertExhaustiveNetwork(
        unpairedNetwork,
        "http://127.0.0.1:8000",
        new Set(["/styles.css"]),
      )),
    "network request denied",
  );
});

Deno.test("owned launch session retains reparented identities and owns the CDP listener", async () => {
  const root = await Deno.makeTempDir();
  const procRoot = `${root}/proc`;
  const chrome = `${root}/chrome`;
  await Deno.writeTextFile(chrome, "pinned chrome fixture");
  const writeProcess = async (
    pid: number,
    parentPid: number,
    processGroupId: number,
    sessionId: number,
    startTime: number,
    executable: string,
  ) => {
    await Deno.mkdir(`${procRoot}/${pid}/fd`, { recursive: true });
    const fields = [
      "S",
      String(parentPid),
      String(processGroupId),
      String(sessionId),
      ...Array(15).fill("0"),
      String(startTime),
    ];
    await Deno.writeTextFile(`${procRoot}/${pid}/stat`, `${pid} (fixture) ${fields.join(" ")}\n`);
    await Deno.symlink(executable, `${procRoot}/${pid}/exe`);
  };
  try {
    await Deno.mkdir(`${procRoot}/net`, { recursive: true });
    await writeProcess(700, 1, 600, 600, 10, "/usr/bin/setsid");
    await writeProcess(701, 700, 701, 701, 20, chrome);
    let ledger = await acquireOwnedSession(700, chrome, 100, procRoot);
    assertEquals(ledger.sessionId, 701);
    assertEquals(ledger.identities.map((identity) => identity.pid), [700, 701]);

    await Deno.remove(`${procRoot}/701/stat`);
    const fields = ["S", "1", "701", "701", ...Array(15).fill("0"), "20"];
    await Deno.writeTextFile(`${procRoot}/701/stat`, `701 (fixture) ${fields.join(" ")}\n`);
    await writeProcess(702, 1, 701, 701, 30, chrome);
    ledger = await refreshOwnedSession(ledger, procRoot);
    assertEquals(ledger.identities.map((identity) => identity.pid), [700, 701, 702]);
    assertEquals(ledger.identities.find((identity) => identity.pid === 701)?.parentPid, 700);

    await Deno.writeTextFile(
      `${procRoot}/net/tcp`,
      "sl local_address rem_address st tx_queue tr tm->when retrnsmt uid timeout inode\n" +
        "0: 0100007F:241E 00000000:0000 0A 0:0 00:0 0 0 0 4242\n",
    );
    await Deno.writeTextFile(`${procRoot}/net/tcp6`, "header\n");
    await Deno.symlink("socket:[4242]", `${procRoot}/702/fd/9`);
    const owned = await assertOwnedDevToolsListener(9246, ledger, procRoot);
    assertEquals(owned.owner.pid, 702);
  } finally {
    await Deno.remove(root, { recursive: true });
  }
});

Deno.test("collector binds clean source, exact fetched bytes, Chrome identity, loopback, and owned cleanup", async () => {
  assertCleanStatus("");
  await assertRejects(
    () => Promise.resolve(assertCleanStatus("?? evidence.json\0")),
    "exact clean HEAD",
  );
  assertEquals(Object.keys(FETCHED_ASSETS).length, 10);
  assertEquals(
    FETCHED_ASSETS["/benchmarks/crypto.file-integrity.v1/"],
    "public/benchmarks/crypto.file-integrity.v1/index.html",
  );
  assertEquals(
    FETCHED_ASSETS["/artifacts/crypto-file-integrity/crypto-file-integrity.wasm"],
    "public/artifacts/crypto-file-integrity/crypto-file-integrity.wasm",
  );
  const expected = await Promise.all(
    Object.entries(FETCHED_ASSETS).map(async ([route, path]) => {
      const bytes = await Deno.readFile(path);
      const digest = new Uint8Array(await crypto.subtle.digest("SHA-256", bytes));
      return {
        route,
        bytes: bytes.byteLength,
        sha256: Array.from(digest, (value) => value.toString(16).padStart(2, "0")).join(""),
      };
    }),
  );
  const observations = expected.map((entry) => ({
    ...entry,
    observedResponses: [{ requestId: "unit-contract-only" }],
  }));
  assertFetchedAssets(observations, expected);
  const missing = structuredClone(observations);
  missing[0].observedResponses = [];
  await assertRejects(
    () => Promise.resolve(assertFetchedAssets(missing, expected)),
    "fetched asset mismatch",
  );

  const collector = await Deno.readTextFile(
    "scripts/collect-base-crypto-file-integrity-browser-evidence.ts",
  );
  for (
    const required of [
      'git", ["rev-parse", "HEAD"]',
      'git", ["rev-parse", "HEAD^{tree}"]',
      "assertCleanStatus(new TextDecoder().decode(status.stdout))",
      "Chrome hash mismatch",
      '"--enable-automation"',
      'new Deno.Command("/usr/bin/setsid"',
      "acquireOwnedSession",
      "assertOwnedDevToolsListener",
      "Browser.getVersion",
      "Browser.getBrowserCommandLine",
      "127.0.0.1",
      "remote-debugging-address=127.0.0.1",
      "wasm-crypto-file-integrity-chrome-",
      "Network.getResponseBody",
      "Accessibility.getFullAXTree",
      "Page.captureScreenshot",
      "wrong-token",
      "stale-error",
      "restart",
      "cancel",
      "timeout",
      "pagehide",
      "wasmMemoryPages !== 4098",
      "Browser.close",
      "assertExhaustiveNetwork(networkRecords",
      "const endSource = await assertExactSourceRoot",
      "identityStillRunning",
      "owned Chrome processes survived cleanup",
      "owned Chrome profile survived cleanup",
      "owned loopback server survived cleanup",
    ]
  ) assert(collector.includes(required), `collector contract missing: ${required}`);
  assert(!collector.includes("puppeteer"));
  assert(!collector.includes("playwright"));
  assert(!collector.includes("evidence = JSON.parse"));
});

Deno.test("browser evidence schema is closed at every declared object boundary", () => {
  const ajv = new (Ajv2020 as unknown as new (
    options: Record<string, unknown>,
  ) => { compile: (schema: unknown) => unknown })({ allErrors: true, strict: true });
  addFormats(ajv);
  ajv.compile(schema);
  const seen = new Set<unknown>();
  function visit(value: unknown, path: string): void {
    if (!value || typeof value !== "object" || seen.has(value)) return;
    seen.add(value);
    const record = value as Record<string, unknown>;
    if (record.type === "object") {
      if (!path.endsWith("/contains")) {
        assert(record.additionalProperties === false, `${path} is not closed`);
      }
      assert(Array.isArray(record.required), `${path} omits required fields`);
    }
    for (const [key, child] of Object.entries(record)) visit(child, `${path}/${key}`);
  }
  visit(schema, "schema");
  assertEquals(schema.properties.cases.minItems, 36);
  assertEquals(schema.properties.cases.maxItems, 36);
  assertEquals(schema.properties.cases.allOf.length, 36);
  assertEquals(schema.properties.lifecycle.minItems, 6);
  assertEquals(schema.properties.lifecycle.maxItems, 6);
  assertEquals(schema.properties.lifecycle.allOf.length, 6);
  assertEquals(schema.properties.fetchedAssets.minItems, 10);
  assertEquals(schema.properties.fetchedAssets.maxItems, 10);
});
