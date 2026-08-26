// Every workload is served from one page. /demos/<slug>/ used to carry a
// second page per workload — thirteen of the sixteen never loaded a runner at
// all — so a fix had to land twice and a reader arriving at a demo route saw a
// workload running without being told the measured page existed.
//
// The demo routes now redirect permanently to their /benchmarks/ twin. This
// test holds that migration in place: every redirect must resolve to a page
// that exists and actually runs the workload.

import { assert } from "./assert.ts";
import { createHandler } from "../server.ts";

interface CoveragePage {
  route: string;
  pathKey: string;
  measured: boolean;
  standardRunner: boolean;
}

const coverage: { pages: CoveragePage[] } = JSON.parse(
  await Deno.readTextFile(new URL("../public/data/coverage.v1.json", import.meta.url)),
);

const demoPages = coverage.pages.filter((p) => p.route.startsWith("/demos/"));
const benchmarkPages = coverage.pages.filter((p) => p.route.startsWith("/benchmarks/"));

function twinOf(page: CoveragePage): CoveragePage | undefined {
  return benchmarkPages.find((b) => b.pathKey === page.pathKey);
}

Deno.test("every demo page has a benchmark twin that measures the workload", () => {
  assert(demoPages.length > 0, "coverage lists no demo pages");
  for (const page of demoPages) {
    const twin = twinOf(page);
    assert(twin, `${page.route} has no /benchmarks/ twin`);
    assert(twin.measured, `${twin.route} does not measure its workload`);
    assert(
      twin.standardRunner,
      `${twin.route} does not use the standard runner, so it cannot be canonical`,
    );
  }
});

Deno.test("every demo route redirects permanently to its canonical benchmark", async () => {
  const handler = createHandler(null, "public", null);
  for (const page of demoPages) {
    const twin = twinOf(page)!;
    for (const path of [page.route, page.route.replace(/\/$/, "")]) {
      const response = await handler(new Request(`http://localhost${path}`));
      await response.body?.cancel();
      assert(response.status === 301, `${path} returned ${response.status}, not a redirect`);
      assert(
        response.headers.get("location") === twin.route,
        `${path} redirected to ${response.headers.get("location")}, want ${twin.route}`,
      );
    }
  }
});

Deno.test("every redirect target is a live page", async () => {
  const handler = createHandler(null, "public", null);
  const seen = new Set<string>();
  for (const page of demoPages) {
    const twin = twinOf(page)!;
    if (seen.has(twin.route)) continue;
    seen.add(twin.route);
    const response = await handler(new Request(`http://localhost${twin.route}`));
    assert(response.status === 200, `${twin.route} returned ${response.status}`);
    const body = await response.text();
    assert(
      body.includes("/unified-runner.js"),
      `${twin.route} does not load the standard runner`,
    );
  }
});

Deno.test("demo asset routes keep working — manifests and evidence reference them", async () => {
  // Only the pages moved. Sibling assets stay addressable because build
  // manifests and retained browser evidence pin those exact URLs.
  const handler = createHandler(null, "public", null);
  for (const path of ["/demos/game-family/demo.js", "/demos/game-family/worker.js"]) {
    const response = await handler(new Request(`http://localhost${path}`));
    await response.body?.cancel();
    assert(response.status === 200, `${path} returned ${response.status}`);
  }
});

Deno.test("no page links to a demo route any more", async () => {
  // A link to a redirect is a link to the wrong place: it costs a round trip
  // and tells the reader the demo page is a separate thing.
  const offenders: string[] = [];
  async function scan(dir: string) {
    for await (const entry of Deno.readDir(dir)) {
      const full = `${dir}/${entry.name}`;
      if (entry.isDirectory) {
        await scan(full);
      } else if (entry.name.endsWith(".html")) {
        const html = await Deno.readTextFile(full);
        if (/href="\/demos\/[^"]*\/"/.test(html)) offenders.push(full);
      }
    }
  }
  await scan(new URL("../public", import.meta.url).pathname);
  assert(
    offenders.length === 0,
    `pages still linking to a redirecting demo route: ${offenders.join(", ")}`,
  );
});
