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
  }
});
