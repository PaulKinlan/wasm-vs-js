import Ajv2020Module from "ajv2020";
import addFormatsModule from "ajv-formats";

type ValidationError = { instancePath?: string; message?: string };
type Validator = ((value: unknown) => boolean) & { errors?: ValidationError[] | null };
type AjvInstance = { compile: (schema: unknown) => Validator };
type AjvConstructor = new (options?: Record<string, unknown>) => AjvInstance;
type AddFormats = (ajv: AjvInstance) => void;

const Ajv2020 = ((Ajv2020Module as unknown as { default?: AjvConstructor }).default ??
  Ajv2020Module) as unknown as AjvConstructor;
const addFormats = ((addFormatsModule as unknown as { default?: AddFormats }).default ??
  addFormatsModule) as unknown as AddFormats;
const ajv = new Ajv2020({ allErrors: true, strict: false });
addFormats(ajv);
const catalogSchema = JSON.parse(
  await Deno.readTextFile(new URL("../schemas/workload-catalog.schema.json", import.meta.url)),
);
const validateSchema = ajv.compile(catalogSchema);

export type CatalogEntry = {
  id: string;
  status: string;
  priority: string;
  domain: string;
  oracle: { equivalenceClass: string; algorithmFamily: string };
  inputs: Array<{
    fixtureState: string;
    rightsStatus: string;
    provenanceStatus: string;
    redistribution: string;
    sha256: string | null;
  }>;
};

export type WorkloadCatalog = {
  publishedCount: number;
  implementationCoverage: { implementedCatalogEntries: number };
  entries: CatalogEntry[];
};

function errors(): string[] {
  return (validateSchema.errors ?? []).map((error) =>
    `${error.instancePath || "/"} ${error.message || "invalid"}`
  );
}

export function validateCatalog(value: unknown): { ok: boolean; errors: string[] } {
  if (!validateSchema(value)) return { ok: false, errors: errors() };
  const catalog = value as WorkloadCatalog;
  const semanticErrors: string[] = [];
  const ids = catalog.entries.map((entry) => entry.id);
  if (new Set(ids).size !== ids.length) semanticErrors.push("duplicate workload id");
  if (JSON.stringify(ids) !== JSON.stringify([...ids].sort())) {
    semanticErrors.push("workload ids must be deterministically sorted");
  }
  if (catalog.entries.length !== catalog.publishedCount) {
    semanticErrors.push("published count does not match entries");
  }
  const priorityCounts = Object.fromEntries(
    ["P0", "P1", "P2"].map((priority) => [
      priority,
      catalog.entries.filter((entry) => entry.priority === priority).length,
    ]),
  );
  if (priorityCounts.P0 !== 12 || priorityCounts.P1 !== 12 || priorityCounts.P2 !== 14) {
    semanticErrors.push("priority denominator must remain P0=12, P1=12, P2=14");
  }
  const implemented = catalog.entries.filter((entry) => entry.status === "implemented").length;
  if (implemented !== catalog.implementationCoverage.implementedCatalogEntries) {
    semanticErrors.push("implemented catalog coverage does not reconcile");
  }
  for (const entry of catalog.entries) {
    for (const input of entry.inputs) {
      if (
        input.fixtureState === "frozen" &&
        (input.rightsStatus !== "audited" || input.provenanceStatus !== "verified" ||
          !["allowed", "allowed-after-attribution"].includes(input.redistribution) ||
          !/^[a-f0-9]{64}$/.test(input.sha256 ?? ""))
      ) {
        semanticErrors.push(
          `${entry.id} freezes input without audited rights, provenance, and hash`,
        );
      }
    }
  }
  return { ok: semanticErrors.length === 0, errors: semanticErrors };
}

export function assertAggregationComparable(entries: CatalogEntry[]): void {
  if (entries.length < 2) return;
  const family = entries[0].oracle.algorithmFamily;
  for (const entry of entries) {
    if (entry.oracle.equivalenceClass === "semantic-product-choice") {
      throw new Error(`product-choice workload cannot enter algorithm aggregate: ${entry.id}`);
    }
    if (entry.oracle.algorithmFamily !== family) {
      throw new Error(`algorithm-family mismatch: ${family} vs ${entry.oracle.algorithmFamily}`);
    }
  }
}
