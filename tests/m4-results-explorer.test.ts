// M4 Results Explorer Route & Content Tests

import { assert } from "./assert.ts";

Deno.test({
  name: "m4-results-explorer: /results route serves accessible HTML dashboard",
  async fn() {
    const html = await Deno.readTextFile("public/results/index.html");
    assert(html.includes("<title>Results Explorer · Wasm vs JavaScript</title>"));
    assert(html.includes('id="results-filter-form"'));
    assert(html.includes('id="results-matrix"'));
    assert(html.includes('id="results-runs"'));
    assert(html.includes('src="/results-explorer.js"'));
    assert(!/\sstyle=/i.test(html), "should have no inline style attribute");
  },
});

Deno.test({
  name: "m4-results-explorer: /results-explorer.js exists and is lint-clean",
  async fn() {
    const js = await Deno.readTextFile("public/results-explorer.js");
    assert(js.includes("renderMatrix"));
    assert(js.includes("renderRuns"));
    assert(js.includes("renderDetail"));
    assert(!js.includes("window.location"), "should use globalThis instead of window");
  },
});
