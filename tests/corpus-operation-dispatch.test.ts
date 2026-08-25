import { assert, assertEquals, assertRejects } from "./assert.ts";
import {
  CORPUS_OPERATION_FLAGS,
  CorpusOperation,
  isPermitConsumingOperation,
  selectCorpusOperation,
} from "../scripts/run-m1-chrome-corpus.ts";

const consuming = ["--consume-permit", "--collect-all", "--collect-one"] as const;
const consumingSet: ReadonlySet<CorpusOperation> = new Set(consuming);

function orderedDistinctModePairs(): Array<[CorpusOperation, CorpusOperation]> {
  const pairs: Array<[CorpusOperation, CorpusOperation]> = [];
  for (const first of CORPUS_OPERATION_FLAGS) {
    for (const second of CORPUS_OPERATION_FLAGS) {
      if (first !== second) pairs.push([first, second]);
    }
  }
  return pairs;
}

Deno.test("operation selection accepts each single mode and rejects absence, duplicates, and all ordered conflicts", async () => {
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
  const pairs = orderedDistinctModePairs();
  assertEquals(pairs.length, 42);
  for (const pair of pairs) {
    await assertRejects(
      () => Promise.resolve().then(() => selectCorpusOperation(pair)),
      "exactly one corpus operation flag required",
    );
  }
});

Deno.test("operation selection rejects unknown and empty named arguments", async () => {
  for (const argument of ["--unknown", "--permit=", "--manifest=", "positional"]) {
    await assertRejects(
      () => Promise.resolve().then(() => selectCorpusOperation(["--preflight", argument])),
      "unknown corpus argument denied",
    );
  }
  assertEquals(selectCorpusOperation(["--preflight", "--manifest=known"]), "--preflight");
});

Deno.test("permit-consuming operation classification is exhaustive", () => {
  assertEquals(
    CORPUS_OPERATION_FLAGS.map((operation) => [operation, isPermitConsumingOperation(operation)]),
    CORPUS_OPERATION_FLAGS.map((operation) => [operation, consumingSet.has(operation)]),
  );
});

type ChildOptions = { readPaths?: string[]; allowPreflight?: boolean };
async function runWithRestrictedPermissions(
  argv: readonly string[],
  { readPaths = ["."], allowPreflight = false }: ChildOptions = {},
) {
  const permissionArgs = [
    `--allow-read=${readPaths.join(",")}`,
    "--allow-env=WASM_VS_JS_COMMIT",
  ];
  if (allowPreflight) {
    permissionArgs.push("--allow-run=git,/usr/bin/git,uname,/usr/bin/uname");
  }
  return await new Deno.Command(Deno.execPath(), {
    args: [
      "run",
      "--no-lock",
      "--no-prompt",
      ...permissionArgs,
      "scripts/run-m1-chrome-corpus.ts",
      ...argv,
    ],
    stdout: "piped",
    stderr: "piped",
  }).output();
}

Deno.test("every duplicate and all 42 ordered conflicting operations reject before preflight or side effects", async () => {
  const invalidSelections: string[][] = [[]];
  for (const operation of CORPUS_OPERATION_FLAGS) {
    invalidSelections.push([operation, operation]);
  }
  invalidSelections.push(...orderedDistinctModePairs());
  assertEquals(invalidSelections.length, 50);

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

Deno.test("unknown arguments reject in a subprocess before preflight", async () => {
  for (const argument of ["--unknown", "--permit=", "unexpected"]) {
    const result = await runWithRestrictedPermissions(["--preflight", argument]);
    const stderr = new TextDecoder().decode(result.stderr);
    assert(!result.success, `unknown argument unexpectedly succeeded: ${argument}`);
    assert(
      stderr.includes("unknown corpus argument denied"),
      `unknown argument reached preflight: ${stderr}`,
    );
  }
});

function consumingArguments(operation: typeof consuming[number], permitPath: string): string[] {
  const argv = [operation, `--permit=${permitPath}`];
  if (operation === "--collect-one") argv.push(`--manifest=${permitPath}`);
  return argv;
}

Deno.test("every permit-consuming mode revokes broad /tmp while retaining an explicit child grant", async () => {
  const root = await Deno.makeTempDir({ prefix: "wasm-vs-js-dispatch-" });
  const ownedRoot = `${root}/explicit-owned`;
  const broadPermit = `${root}/broad-permit.json`;
  const ownedPermit = `${ownedRoot}/owned-permit.json`;
  await Deno.mkdir(ownedRoot, { mode: 0o700 });
  await Deno.writeTextFile(broadPermit, "{}\n");
  await Deno.writeTextFile(ownedPermit, "{}\n");
  try {
    for (const operation of consuming) {
      const broadResult = await runWithRestrictedPermissions(
        consumingArguments(operation, broadPermit),
        { readPaths: [".", "/tmp"], allowPreflight: true },
      );
      const broadError = new TextDecoder().decode(broadResult.stderr);
      assert(!broadResult.success, `${operation} unexpectedly retained broad /tmp access`);
      assert(
        broadError.includes(`read access to "${broadPermit}"`),
        `${operation} did not revoke broad /tmp before permit access: ${broadError}`,
      );
      assert(!broadError.toLowerCase().includes("prompt"), `${operation} attempted a prompt`);

      const ownedResult = await runWithRestrictedPermissions(
        consumingArguments(operation, ownedPermit),
        { readPaths: [".", "/tmp", ownedRoot], allowPreflight: true },
      );
      const ownedError = new TextDecoder().decode(ownedResult.stderr);
      assert(!ownedResult.success, `${operation} unexpectedly accepted an invalid test permit`);
      assert(
        ownedError.includes("browser-permit schema invalid"),
        `${operation} lost its explicit child grant or bypassed permit validation: ${ownedError}`,
      );
      assert(!ownedError.includes("read access to"), `${operation} lost explicit child access`);
      assert(!ownedError.toLowerCase().includes("prompt"), `${operation} attempted a prompt`);
    }
  } finally {
    await Deno.remove(root, { recursive: true });
  }
});
