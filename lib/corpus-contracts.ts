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

const names = [
  "attempt-record",
  "browser-permit",
  "collection-stop",
  "corpus",
  "launch-evidence",
  "network-attestation",
  "paired-block",
  "source-manifest",
] as const;
const validators = Object.fromEntries(
  await Promise.all(names.map(async (name) => {
    const schema = JSON.parse(
      await Deno.readTextFile(new URL(`../schemas/${name}.schema.json`, import.meta.url)),
    );
    return [name, ajv.compile(schema)];
  })),
) as Record<typeof names[number], Validator>;

function assertSchema(name: typeof names[number], value: unknown): void {
  const validator = validators[name];
  if (!validator(value)) {
    const detail = validator.errors?.map((error) =>
      `${error.instancePath || "/"} ${error.message || "invalid"}`
    ).join("; ");
    throw new Error(`${name} schema invalid: ${detail || "unknown error"}`);
  }
}

export const assertAttemptRecordSchema = (value: unknown) => assertSchema("attempt-record", value);
export const assertBrowserPermitSchema = (value: unknown) => assertSchema("browser-permit", value);
export const assertCollectionStopSchema = (value: unknown) =>
  assertSchema("collection-stop", value);
export const assertCorpusSchema = (value: unknown) => assertSchema("corpus", value);
export const assertLaunchEvidenceSchema = (value: unknown) =>
  assertSchema("launch-evidence", value);
export const assertNetworkAttestationSchema = (value: unknown) =>
  assertSchema("network-attestation", value);
export const assertPairedBlockSchema = (value: unknown) => assertSchema("paired-block", value);
export const assertSourceManifestSchema = (value: unknown) =>
  assertSchema("source-manifest", value);
