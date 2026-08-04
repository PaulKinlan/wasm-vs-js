import { assert } from "./assert.ts";
import { GENERATED_ROUTES } from "../routes.generated.ts";

// Route-codegen gate: the generated tables are fresh, every discovered page is
// served, card-registry routes resolve, and catalog links resolve — over HTTP
// against the real server, so server.ts merge semantics (duplicate-throw) are
// exercised too.

async function withServer<T>(fn: (base: string) => Promise<T>): Promise<T> {
  const probe = Deno.listen({ hostname: "127.0.0.1", port: 0 });
  const port = (probe.addr as Deno.NetAddr).port;
  probe.close();
  const server = new Deno.Command(Deno.execPath(), {
    args: ["task", "public"],
    env: { PORT: String(port), HOST: "127.0.0.1" },
    stdout: "null",
    stderr: "piped",
  }).spawn();
  const base = `http://127.0.0.1:${port}`;
  try {
    const deadline = Date.now() + 15000;
    for (;;) {
      try {
        if ((await fetch(`${base}/healthz`)).status === 200) break;
      } catch { /* not up yet */ }
      if (Date.now() > deadline) throw new Error("server did not start");
      await new Promise((r) => setTimeout(r, 200));
    }
    return await fn(base);
  } finally {
    try {
      server.kill("SIGTERM");
      await server.status;
    } catch { /* already exited */ }
    const err = await server.stderr
      ? new TextDecoder().decode(
        await server.stderr.getReader().read().then((r) => r.value ?? new Uint8Array()),
      )
      : "";
    if (err.trim()) console.error("[server stderr tail]", err.split("\n").slice(-6).join("\n"));
  }
}

async function fetchAll(
  base: string,
  paths: string[],
): Promise<string[]> {
  const bad: string[] = [];
  for (const p of paths) {
    try {
      const res = await fetch(`${base}${p}`, { redirect: "follow" });
      await res.arrayBuffer();
      if (res.status !== 200) bad.push(`${p} -> ${res.status}`);
    } catch (err) {
      bad.push(`${p} -> ${err}`);
    }
  }
  return bad;
}

Deno.test("generated worker anchors are fresh (build-worker-anchors --check)", async () => {
  const out = await new Deno.Command(Deno.execPath(), {
    args: [
      "run",
      "--allow-read=.",
      "scripts/build-worker-anchors.ts",
      "--check",
    ],
    stdout: "piped",
    stderr: "piped",
  }).output();
  assert(
    out.success,
    `generated worker anchors drifted: ${new TextDecoder().decode(out.stderr)}`,
  );
});

Deno.test("generated route tables are fresh (build-routes --check)", async () => {
  const out = await new Deno.Command(Deno.execPath(), {
    args: [
      "run",
      "--allow-read=.",
      "scripts/build-routes.ts",
      "--check",
    ],
    stdout: "piped",
    stderr: "piped",
  }).output();
  assert(
    out.success,
    `generated route tables drifted: ${new TextDecoder().decode(out.stderr)}`,
  );
});

Deno.test("every generated route serves 200 with an existing file", async () => {
  for (const [path, value] of GENERATED_ROUTES) {
    const file = value[0];
    try {
      await Deno.stat(file);
    } catch {
      throw new Error(`generated route ${path} references missing file ${file}`);
    }
  }
  await withServer(async (base) => {
    const paths = GENERATED_ROUTES.map(([p]) => p);
    const bad = await fetchAll(base, paths);
    assert(bad.length === 0, `generated routes not serving: ${bad.join("; ")}`);
  });
});

Deno.test("card registry routes and catalog links resolve over HTTP", async () => {
  const playground = await Deno.readTextFile("public/playground.js");
  const cardRoutes = [...playground.matchAll(/route:\s*"([^"]+)"/g)].map((m) => m[1]);
  assert(cardRoutes.length >= 49, "card registry parse regressed");
  const catalogModule = await Deno.readTextFile(
    "public/workload-catalog-routes.generated.js",
  );
  const catalogRoutes = [...catalogModule.matchAll(/"([^"]+)":\s*"([^"]+)"/g)]
    .filter((m) => m[1].includes("."))
    .map((m) => m[2]);

  // Catalog keys must be real catalog ids (v1 ∪ v2)
  const ids = new Set<string>();
  for (const p of ["catalog/workloads.v1.json", "catalog/workloads.v2.proposed.json"]) {
    const data = JSON.parse(await Deno.readTextFile(p));
    for (const e of data.entries ?? data.proposals ?? []) ids.add(e.id);
  }
  for (const m of catalogModule.matchAll(/^\s{2}"([^"]+)":/gm)) {
    assert(ids.has(m[1]), `WORKLOAD_DEMO_ROUTES key ${m[1]} is not a catalog id`);
  }

  await withServer(async (base) => {
    const bad = await fetchAll(base, [...cardRoutes, ...catalogRoutes]);
    assert(bad.length === 0, `card/catalog routes not serving: ${bad.join("; ")}`);
  });
});
