const root = Deno.args[0];
if (!root?.startsWith("/tmp/wasm-vs-js-cgroup-permission-probe/")) {
  throw new Error("exact fake cgroup root required");
}
const handle = await Deno.open(`${root}/cgroup.kill`, { write: true });
try {
  await handle.write(new TextEncoder().encode("1"));
} finally {
  handle.close();
}
if ((await Deno.readTextFile(`${root}/cgroup.kill`)) !== "1") {
  throw new Error("authenticated cgroup.kill write was not retained");
}
console.log("cgroup.kill permission probe passed");
