import { assert } from "./assert.ts";

Deno.test("production corpus tasks authorize only the current user app-slice for cgroup writes", async () => {
  const config = JSON.parse(await Deno.readTextFile("deno.corpus.json"));
  for (const task of ["corpus:collect-one", "corpus:collect-all"]) {
    const command = String(config.tasks[task]);
    assert(
      command.includes(
        "/sys/fs/cgroup/user.slice/user-$(id -u).slice/user@$(id -u).service/app.slice",
      ),
      `${task} must authorize its authenticated cgroup.kill descriptor`,
    );
    assert(!command.includes("--allow-write=/sys/fs/cgroup"), `${task} cgroup write is too broad`);
    assert(command.includes("deno run --no-lock --no-prompt"), `${task} must disable prompts`);
    assert(
      command.includes("--allow-read=.,/proc,/etc/os-release,/sys/fs/cgroup,/tmp,"),
      `${task} must be able to attest the /tmp parent before creating an owned profile`,
    );
  }
});

Deno.test("collector revokes broad temporary reads while retaining owned-path access", async () => {
  const id = crypto.randomUUID();
  const unrelated = `/tmp/wasm-vs-js-unrelated-${id}`;
  const ownedRoot = `/tmp/wasm-vs-js-revocation-${id}`;
  const owned = `${ownedRoot}/owned.txt`;
  await Deno.writeTextFile(unrelated, "private");
  await Deno.mkdir(ownedRoot, { mode: 0o700 });
  await Deno.writeTextFile(owned, "owned");
  try {
    const result = await new Deno.Command(Deno.execPath(), {
      args: [
        "run",
        "--no-lock",
        `--allow-read=/tmp,${ownedRoot}`,
        "tests/tmp-read-revocation-probe.ts",
        unrelated,
        owned,
      ],
    }).output();
    assert(result.success, new TextDecoder().decode(result.stderr));
  } finally {
    await Deno.remove(unrelated).catch(() => {});
    await Deno.remove(ownedRoot, { recursive: true }).catch(() => {});
  }
});
