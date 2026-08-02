const requiredFiles = [
  "AGENTS.md",
  "CLAUDE.md",
  "PLAN.md",
  "README.md",
  "TASKS.md",
  "docs/acceptance/m0.md",
  "schemas/benchmark.schema.json",
  "schemas/run.schema.json",
];

for (const path of requiredFiles) {
  const text = await Deno.readTextFile(path);
  if (!text.trim()) throw new Error(`${path} is empty`);
}

for (const path of requiredFiles.filter((path) => path.endsWith(".json"))) {
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
  ]
) {
  if (!plan.includes(phrase)) throw new Error(`PLAN.md missing ${phrase}`);
}

console.log(`planning-check: ${requiredFiles.length} files and 2 closed schemas passed`);
