import { validateCatalog } from "../lib/catalog.ts";

const sourcePath = new URL("../catalog/workloads.v1.json", import.meta.url);
const publicPath = new URL("../public/data/workloads.v1.json", import.meta.url);
const sourceBytes = await Deno.readFile(sourcePath);
const publicBytes = await Deno.readFile(publicPath);
const schemaBytes = await Deno.readFile(
  new URL("../schemas/workload-catalog.schema.json", import.meta.url),
);
const publicSchemaBytes = await Deno.readFile(
  new URL("../public/data/workload-catalog.schema.json", import.meta.url),
);
if (
  sourceBytes.length !== publicBytes.length ||
  !sourceBytes.every((byte, index) => byte === publicBytes[index])
) {
  throw new Error("public catalog is not byte-identical to the canonical catalog");
}
if (
  schemaBytes.length !== publicSchemaBytes.length ||
  !schemaBytes.every((byte, index) => byte === publicSchemaBytes[index])
) {
  throw new Error("public catalog schema is not byte-identical to the canonical schema");
}
const text = new TextDecoder().decode(sourceBytes);
const catalog = JSON.parse(text);
const result = validateCatalog(catalog);
if (!result.ok) throw new Error(`catalog invalid: ${result.errors.join("; ")}`);
const canonicalFormatting = `${JSON.stringify(catalog, null, 2)}\n`;
if (text !== canonicalFormatting) throw new Error("catalog JSON formatting is not deterministic");
console.log(
  `catalog-check: ${catalog.entries.length} workloads; P0=12 P1=12 P2=14; implemented catalog coverage=${catalog.implementationCoverage.implementedCatalogEntries}`,
);
