import { assert, assertEquals } from "./assert.ts";

Deno.test("actual public task starts without commit env permission and ignores spoofed labels", async () => {
  const probe = Deno.listen({ hostname: "127.0.0.1", port: 0 });
  const port = (probe.addr as Deno.NetAddr).port;
  probe.close();
  const child = new Deno.Command(Deno.execPath(), {
    args: ["task", "public"],
    cwd: Deno.cwd(),
    env: {
      PORT: String(port),
      HOST: "127.0.0.1",
      WASM_VS_JS_COMMIT: "f".repeat(40),
    },
    stdout: "piped",
    stderr: "piped",
  }).spawn();
  try {
    let response: Response | undefined;
    for (let attempt = 0; attempt < 50; attempt += 1) {
      try {
        response = await fetch(`http://127.0.0.1:${port}/healthz`);
        break;
      } catch {
        await new Promise((resolve) => setTimeout(resolve, 50));
      }
    }
    assert(response, "public task did not start");
    assertEquals(response.status, 200);
    const health = await response.json();
    assertEquals(health.mode, "public-read-only");
    assertEquals(
      health.acceptedImplementationCommit,
      "9c309c4941d1b8550c15f8549f95a5636a634ef6",
    );
    assertEquals("localCheckoutCommit" in health, false);
    const denied = await fetch(`http://127.0.0.1:${port}/api/runs`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: "{}",
    });
    assertEquals(denied.status, 403);
  } finally {
    child.kill("SIGTERM");
    await child.status;
  }
});
