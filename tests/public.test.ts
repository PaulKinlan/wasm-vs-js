import { assert } from "./assert.ts";

Deno.test("results and runner pages expose evidence limits and accessible controls", async () => {
  const index = await Deno.readTextFile("public/index.html");
  const runner = await Deno.readTextFile("public/run.html");
  const css = await Deno.readTextFile("public/styles.css");
  assert(index.includes("No accepted result"));
  assert(index.includes("Raw run inspector"));
  assert(index.includes("Complete trajectories"));
  assert(index.includes("<caption>"));
  assert(runner.includes("Pilot tool, not accepted evidence"));
  assert(runner.includes("Exact environment JSON"));
  assert(runner.includes('aria-live="polite"'));
  assert(css.includes("prefers-reduced-motion"));
  assert(css.includes("forced-colors"));
  assert(css.includes("overflow-x: auto"));
  assert(!index.includes("Wasm wins"));
});

Deno.test("public pages contain no inline script, inline style, or remote asset", async () => {
  for (const path of ["public/index.html", "public/run.html"]) {
    const html = await Deno.readTextFile(path);
    assert(!/<script(?![^>]*\bsrc=)/i.test(html), `${path} has inline script`);
    assert(!/\sstyle=/i.test(html), `${path} has inline style`);
    assert(
      !/https?:\/\//i.test(
        html.replaceAll("https://github.com/PaulKinlan/wasm-vs-js/blob/main/PLAN.md", ""),
      ),
      `${path} has unexpected remote asset`,
    );
  }
});
