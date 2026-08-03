import { sha256Hex } from "../lib/canonical.ts";
const root = new URL("../", import.meta.url);
const catalogBytes = await Deno.readFile(new URL("catalog/workloads.v1.json", root));
const catalog = JSON.parse(new TextDecoder().decode(catalogBytes));
const implementedId = "crypto.file-integrity.v1";
if (!catalog.entries.some((entry: { id: string }) => entry.id === implementedId)) {
  throw new Error("implemented ID is not in frozen catalog");
}
const ledger = {
  schemaVersion: 1,
  catalogId: catalog.catalogId,
  catalogSha256: await sha256Hex(catalogBytes),
  counts: {
    denominator: catalog.entries.length,
    implemented: 1,
    remaining: catalog.entries.length - 1,
  },
  implemented: [{
    id: implementedId,
    registration: "/registrations/base/crypto.file-integrity.v1.json",
    registrationSha256: await sha256Hex(
      await Deno.readFile(new URL("registrations/base/crypto.file-integrity.v1.json", root)),
    ),
    buildManifest: "/artifacts/crypto-file-integrity/build-manifest.json",
    buildManifestSha256: await sha256Hex(
      await Deno.readFile(
        new URL("public/artifacts/crypto-file-integrity/build-manifest.json", root),
      ),
    ),
    validation: "/evidence/base/crypto.file-integrity.v1/validation.json",
    validationSha256: await sha256Hex(
      await Deno.readFile(
        new URL("public/evidence/base/crypto.file-integrity.v1/validation.json", root),
      ),
    ),
    demoRoute: "/demos/crypto.file-integrity.v1/",
    performanceStatus: "unavailable-not-collected",
  }],
  remainingIds: catalog.entries.map((entry: { id: string }) => entry.id).filter((id: string) =>
    id !== implementedId
  ),
};
const encoded = `${JSON.stringify(ledger, null, 2)}\n`;
await Deno.writeTextFile(new URL("catalog/base-implementation-status.v1.json", root), encoded);
await Deno.mkdir(new URL("public/data/", root), { recursive: true });
await Deno.writeTextFile(new URL("public/data/base-implementation-status.v1.json", root), encoded);
await Deno.writeTextFile(
  new URL("public/data/base-implementation-status.schema.json", root),
  await Deno.readTextFile(new URL("schemas/base-implementation-status.schema.json", root)),
);
