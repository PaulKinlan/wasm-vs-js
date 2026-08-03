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
    for (
      const path of [
        "/run",
        "/run/",
        "/hosted-runner.js",
        "/provenance-probes.js",
        "/hosted-runner-core.js",
        "/hosted-runner-worker.js",
        "/inspectability.js",
        "/v2-results.js",
        "/data/sum-u32-inspectability.v1.json",
        "/data/v2-proposal-implementation-status.v1.json",
        "/data/v2-proposal-implementation-status.schema.json",
        "/evidence/v2-proposals/",
        "/evidence/v2-proposals/audio-fft/js-controlled.json",
        "/evidence/v2-proposals/audio-fft/wasm-linear-controlled.json",
        "/artifacts/audio-fft/build-manifest.json",
        "/artifacts/audio-fft/audio-fft.wasm",
        "/artifacts/audio-fft/reference-output.f32le",
        "/benchmarks/sum-u32/workload.js",
        "/artifacts/sum-u32/build-manifest.9c309c49.json",
        "/artifacts/sum-u32/sum-u32.wasm",
      ]
    ) {
      assertEquals((await fetch(`http://127.0.0.1:${port}${path}`)).status, 200);
    }
    const ledger = JSON.parse(
      await Deno.readTextFile("catalog/v2-proposal-implementation-status.v1.json"),
    );
    const publicPaths = new Set<string>();
    for (const entry of ledger.entries) {
      for (const link of entry.artifacts.publicLinks) publicPaths.add(link.url);
      for (const link of entry.validationResults.publicEvidenceLinks) {
        publicPaths.add(link.url);
      }
    }
    assertEquals(publicPaths.size, 13);
    for (const path of publicPaths) {
      assertEquals((await fetch(`http://127.0.0.1:${port}${path}`)).status, 200);
    }
    for (
      const path of [
        "/artifacts/audio-fft/unknown.json",
        "/artifacts/audio-fft/../audio-fir/not-allowlisted.wasm",
        "/artifacts/vdom-diff-patch/build-manifest.json",
        "/artifacts/regex-automata-duel/build-manifest.json",
      ]
    ) {
      assertEquals((await fetch(`http://127.0.0.1:${port}${path}`)).status, 404);
    }
    const publicPath = [...publicPaths][0];
    for (const method of ["POST", "PUT", "PATCH", "DELETE", "OPTIONS"]) {
      assertEquals(
        (await fetch(`http://127.0.0.1:${port}${publicPath}`, { method })).status,
        403,
      );
    }

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
