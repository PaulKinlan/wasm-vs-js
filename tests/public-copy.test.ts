import { assert } from "./assert.ts";

const publicCopyFiles = [
  "README.md",
  "public/index.html",
  "public/run/index.html",
  "public/evidence/index.html",
  "public/evidence/v2-proposals/index.html",
  "public/benchmarks/index.html",
  "public/experiments/index.html",
  "public/app.js",
  "public/inspectability.js",
  "public/v2-results.js",
  "public/hosted-runner.js",
  "public/workload-catalog.js",
];

const stockPhrases = [
  "in today's rapidly evolving landscape",
  "in the realm of",
  "when it comes to",
  "at its core",
  "let's dive into",
  "it's worth noting that",
  "it's important to note that",
  "a testament to",
  "not just ",
  "not only ",
  "this is where ",
  "whether you're ",
  "despite ongoing challenges",
  "looking ahead",
  "in conclusion",
  "overall",
  "ultimately",
  "i hope this helps",
];

Deno.test("public prose avoids stock AI-writing phrases", async () => {
  for (const path of publicCopyFiles) {
    const copy = (await Deno.readTextFile(path)).toLocaleLowerCase();
    for (const phrase of stockPhrases) {
      assert(!copy.includes(phrase), `${path} contains stock phrase: ${phrase}`);
    }
  }
});

Deno.test("public prose retains the benchmark's current evidence limits", async () => {
  const home = await Deno.readTextFile("public/index.html");
  const runner = await Deno.readTextFile("public/run/index.html");
  const evidence = await Deno.readTextFile("public/evidence/index.html");
  const proposalEvidence = await Deno.readTextFile("public/evidence/v2-proposals/index.html");
  const catalog = await Deno.readTextFile("public/benchmarks/index.html");
  const experiment = await Deno.readTextFile("public/experiments/index.html");
  const readme = await Deno.readTextFile("README.md");
  const runnerScript = await Deno.readTextFile("public/hosted-runner.js");

  assert(home.includes("Accepted performance corpus: none"));
  assert(home.includes("unverified and supplies no timing evidence"));
  assert(runner.includes("The page does not upload or save the result"));
  assert(runner.includes("Its durations do not enter the accepted corpus"));
  assert(evidence.includes("Accepted performance corpus: none"));
  assert(evidence.includes("Chrome 150 attestation: unverified"));
  assert(proposalEvidence.includes("Performance claims: none."));
  assert(catalog.includes("38 proposed workloads; 0 implemented"));
  assert(catalog.includes("Coverage is 0/38"));
  assert(experiment.includes("Corpus status: not collected"));
  assert(experiment.includes("grants no browser authorization"));
  assert(readme.includes("Catalog implementation coverage is **0/38**"));
  assert(readme.includes("The page uploads and stores nothing"));
  assert(readme.includes("no accepted performance corpus or performance conclusion"));
  assert(readme.includes("Inspectability files use exact route entries."));
  assert(
    readme.includes("Each of `audio-fft`, `audio-fir`, and `audio-stft` exposes exactly five"),
  );
  assert(readme.includes("no wildcard source, artifact, manifest, or result path handler"));
  assert(readme.includes("no public mutation or ingestion route is available"));
  assert(!readme.includes("Local downloads are limited to"));
  assert(runnerScript.includes("Status: exploratory"));
  assert(runnerScript.includes("remains in this tab and was not uploaded or saved"));
});
