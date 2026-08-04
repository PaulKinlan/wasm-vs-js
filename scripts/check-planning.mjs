const requiredFiles = [
  "AGENTS.md",
  "CLAUDE.md",
  "PLAN.md",
  "README.md",
  "TASKS.md",
  "docs/acceptance/m0.md",
  "docs/m1-local-pilot.md",
  "benchmarks/sum-u32/benchmark.json",
  "public/artifacts/sum-u32/build-manifest.json",
  "public/index.html",
  "schemas/benchmark.schema.json",
  "schemas/run.schema.json",
];

for (const path of requiredFiles) {
  const text = await Deno.readTextFile(path);
  if (!text.trim()) throw new Error(`${path} is empty`);
}

for (const path of ["schemas/benchmark.schema.json", "schemas/run.schema.json"]) {
  const schema = JSON.parse(await Deno.readTextFile(path));
  if (schema.$schema !== "https://json-schema.org/draft/2020-12/schema") {
    throw new Error(`${path} does not declare JSON Schema 2020-12`);
  }
  if (schema.type !== "object" || schema.additionalProperties !== false) {
    throw new Error(`${path} must define a closed object root`);
  }
}

const plan = await Deno.readTextFile("PLAN.md");
for (
  const phrase of [
    "Track A — controlled",
    "Track B — independently optimized",
    "Availability invariant",
    "Definition of done",
    "M1 — one complete vertical slice",
    "Browser, engine, and runtime modes",
    "Default-user mode",
    "Non-default diagnostic mode",
    "Platform-hint mode",
    "M8 — server and standalone runtime family",
    "Node.js",
    "ChromeStatus",
    "not pooled",
  ]
) {
  if (!plan.includes(phrase)) throw new Error(`PLAN.md missing ${phrase}`);
}

const tasks = await Deno.readTextFile("TASKS.md");
for (
  const phrase of [
    "browser-product × engine-family/version matrix",
    "Wasm baseline/optimizing/tiering",
    "JavaScript platform optimization-hint/attribute variants",
    "M8 — server and standalone runtime family",
    "Node.js harness",
    "sequential/concurrent",
  ]
) {
  if (!tasks.includes(phrase)) throw new Error(`TASKS.md missing ${phrase}`);
}

console.log(
  `planning-check: ${requiredFiles.length} files, 2 closed schemas, and later-scope invariants passed`,
);

// The standard repository gate rebuilds the controlled audio-effects package in
// memory and byte-reconciles its committed artifact, manifests, and evidence.
await import("./build-base-audio-webaudio-effects.ts");
