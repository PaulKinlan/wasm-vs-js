// Every workload is served from one page. /demos/<slug>/ used to carry a
// second page per workload — thirteen of the sixteen never loaded a runner at
// all — so a fix had to land twice and a reader arriving at a demo route saw a
// workload running without being told the measured page existed.
//
// The demo routes now redirect permanently to their /benchmarks/ twin. This
// test holds that migration in place: every redirect must resolve to a page
// that exists and actually runs the workload.
//
// It is driven by the redirect table itself rather than by the coverage
// report. The report no longer lists the retired routes — they are stubs the
// server never serves, and counting them made it claim eight benchmarks
// measured nothing. The table is what the server acts on, so the table is what
// gets checked.

import { assert } from "./assert.ts";
import { createHandler } from "../server.ts";
import { CANONICAL_DEMO_REDIRECTS } from "../lib/canonical-demo-redirects.ts";

interface CoveragePage {
  route: string;
  pathKey: string;
  measured: boolean;
  standardRunner: boolean;
}

const coverage: { pages: CoveragePage[] } = JSON.parse(
  await Deno.readTextFile(new URL("../public/data/coverage.v1.json", import.meta.url)),
);

const benchmarkPages = coverage.pages.filter((p) => p.route.startsWith("/benchmarks/"));
/** Every retired route paired with the benchmark route it redirects to. */
const REDIRECTS = [...CANONICAL_DEMO_REDIRECTS];

function targetPage(route: string): CoveragePage | undefined {
  return benchmarkPages.find((b) => b.route === route);
}

Deno.test("every redirect lands on a page that measures the workload", () => {
  assert(REDIRECTS.length > 0, "the redirect table is empty");
  for (const [from, to] of REDIRECTS) {
    const page = targetPage(to);
    assert(page, `${from} redirects to ${to}, which is not a coverage page`);
    assert(page.measured, `${to} does not measure its workload`);
    assert(
      page.standardRunner,
      `${to} does not use the standard runner, so it cannot be canonical`,
    );
  }
});

Deno.test("the coverage report does not count retired routes as pages", () => {
  const stubs = coverage.pages.filter((p) => p.route.startsWith("/demos/"));
  assert(
    stubs.length === 0,
    `coverage lists ${stubs.length} retired /demos/ route(s) as pages: ` +
      stubs.map((p) => p.route).join(", "),
  );
});

Deno.test("every demo route redirects permanently to its canonical benchmark", async () => {
  const handler = createHandler(null, "public", null);
  for (const [from, to] of REDIRECTS) {
    const response = await handler(new Request(`http://localhost${from}`));
    await response.body?.cancel();
    assert(response.status === 301, `${from} returned ${response.status}, not a redirect`);
    assert(
      response.headers.get("location") === to,
      `${from} redirected to ${response.headers.get("location")}, want ${to}`,
    );
  }
});

Deno.test("every redirect target is a live page", async () => {
  const handler = createHandler(null, "public", null);
  for (const to of new Set(REDIRECTS.map(([, target]) => target))) {
    const response = await handler(new Request(`http://localhost${to}`));
    assert(response.status === 200, `${to} returned ${response.status}`);
    const body = await response.text();
    assert(
      body.includes("/unified-runner.js"),
      `${to} does not load the standard runner`,
    );
  }
});

Deno.test("a redirecting route still denies mutation methods", async () => {
  // A 301 answered for POST would let a mutation attempt past the method
  // check every other route enforces.
  const handler = createHandler(null, "public", null);
  for (const [from] of REDIRECTS) {
    for (const method of ["POST", "PUT", "DELETE"]) {
      const response = await handler(
        new Request(`http://localhost${from}`, { method }),
      );
      await response.body?.cancel();
      assert(
        [403, 405].includes(response.status),
        `${method} ${from} returned ${response.status}`,
      );
    }
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
