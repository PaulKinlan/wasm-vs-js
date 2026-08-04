import { FROZEN_PREREGISTRATION_CANONICAL_SHA256 } from "../lib/preregistration.ts";

const ROOT = new URL("../", import.meta.url);
const schemaUrl = new URL("schemas/corpus.schema.json", ROOT);

export async function buildCorpusSchema(): Promise<string> {
  const schemaText = await Deno.readTextFile(schemaUrl);
  const schema = JSON.parse(schemaText);
  schema.properties.preregistrationSha256.const = FROZEN_PREREGISTRATION_CANONICAL_SHA256;
  return JSON.stringify(schema, null, 2) + "\n";
}

if (import.meta.main) {
  const checkOnly = Deno.args.includes("--check");
  const generated = await buildCorpusSchema();
  const current = await Deno.readTextFile(schemaUrl);

  if (checkOnly) {
    if (generated !== current) {
      console.error(
        "schemas/corpus.schema.json is stale; run deno run --allow-read=. --allow-write=schemas/ scripts/build-schemas.ts",
      );
      Deno.exit(1);
    }
    console.log("schema freshness check ok");
  } else {
    await Deno.writeTextFile(schemaUrl, generated);
    console.log("schemas/corpus.schema.json updated");
  }
}
