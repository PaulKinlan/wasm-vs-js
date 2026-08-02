import { assert, assertEquals, assertRejects } from "./assert.ts";
import {
  CORPUS_OPERATION_FLAGS,
  isPermitConsumingOperation,
  selectCorpusOperation,
} from "../scripts/run-m1-chrome-corpus.ts";

const consuming = new Set(["--consume-permit", "--collect-all", "--collect-one"]);

Deno.test("operation selection accepts each single mode and rejects absence, duplicates, and conflicts", async () => {
  for (const operation of CORPUS_OPERATION_FLAGS) {
    assertEquals(selectCorpusOperation([`--permit=ignored`, operation]), operation);
    await assertRejects(
      () => Promise.resolve().then(() => selectCorpusOperation([operation, operation])),
      "exactly one corpus operation flag required",
    );
  }
  await assertRejects(
    () => Promise.resolve().then(() => selectCorpusOperation([])),
    "exactly one corpus operation flag required",
  );
  for (let left = 0; left < CORPUS_OPERATION_FLAGS.length; left++) {
    for (let right = left + 1; right < CORPUS_OPERATION_FLAGS.length; right++) {
      await assertRejects(
        () =>
          Promise.resolve().then(() =>
            selectCorpusOperation([
              CORPUS_OPERATION_FLAGS[left],
              CORPUS_OPERATION_FLAGS[right],
            ])
          ),
        "exactly one corpus operation flag required",
      );
    }
  }
});

Deno.test("permit-consuming operation classification is exhaustive", () => {
  assertEquals(
    CORPUS_OPERATION_FLAGS.map((operation) => [operation, isPermitConsumingOperation(operation)]),
    CORPUS_OPERATION_FLAGS.map((operation) => [operation, consuming.has(operation)]),
  );
});

async function runWithRestrictedPermissions(argv: readonly string[]) {
  return await new Deno.Command(Deno.execPath(), {
    args: [
      "run",
      "--no-lock",
      "--no-prompt",
      "--allow-env=WASM_VS_JS_COMMIT",
      "--allow-read=.",
      "scripts/run-m1-chrome-corpus.ts",
      ...argv,
    ],
    stdout: "piped",
    stderr: "piped",
  }).output();
}

Deno.test("every duplicate and conflicting operation rejects before preflight or side effects", async () => {
  const invalidSelections: string[][] = [[]];
  for (const operation of CORPUS_OPERATION_FLAGS) {
    invalidSelections.push([operation, operation]);
  }
  for (let left = 0; left < CORPUS_OPERATION_FLAGS.length; left++) {
    for (let right = left + 1; right < CORPUS_OPERATION_FLAGS.length; right++) {
      invalidSelections.push([
        CORPUS_OPERATION_FLAGS[left],
        CORPUS_OPERATION_FLAGS[right],
      ]);
    }
  }

  for (const selection of invalidSelections) {
    const result = await runWithRestrictedPermissions(selection);
    const stderr = new TextDecoder().decode(result.stderr);
    assert(!result.success, `invalid operation selection unexpectedly succeeded: ${selection}`);
    assert(
      stderr.includes("exactly one corpus operation flag required"),
      `selection reached preflight or a side effect (${selection.join(" ")}): ${stderr}`,
    );
  }
});

Deno.test("every permit-consuming mode attests temporary root before preflight and dispatch", async () => {
  for (const operation of consuming) {
    const result = await runWithRestrictedPermissions([operation]);
    const stderr = new TextDecoder().decode(result.stderr);
    assert(!result.success, `${operation} unexpectedly passed without temporary-root access`);
    assert(
      stderr.includes('read access to "/tmp"'),
      `${operation} did not reach the centralized temporary-root guard first: ${stderr}`,
    );
    assert(!stderr.includes("--permit required"), `${operation} dispatched before its guard`);
  }
});
