import { assert } from "./assert.ts";
import { collectHostProvenance, collectProcessMemory } from "../lib/host-provenance.ts";
Deno.test("host provenance is source/scope/time labelled and never substitutes unavailable numeric zero", async () => {
  const evidence = await collectHostProvenance();
  for (const [name, field] of Object.entries(evidence)) {
    assert(typeof field.source === "string" && field.source.length > 0, `${name} source`);
    assert(typeof field.scope === "string" && field.scope.length > 0, `${name} scope`);
    assert(Number.isFinite(Date.parse(field.collectedAt)), `${name} timestamp`);
    if (field.status === "unavailable") assert(!("value" in field), `${name} unavailable value`);
  }
  const cgroup = evidence.cgroup.value as Record<string, Record<string, unknown>>;
  for (const field of Object.values(cgroup)) {
    assert(field.status === "supported-value" || field.status === "unavailable");
    assert(
      field.status === "supported-value"
        ? typeof field.value === "string"
        : typeof field.reason === "string",
    );
  }
  for (const key of ["logicalProcessors", "physicalCores", "totalRamBytes"]) {
    const field = evidence[key];
    if (field.status === "supported-value") {
      assert(typeof field.value === "number" && field.value > 0, `${key} positive`);
    }
  }
  const process = await collectProcessMemory([Deno.pid]);
  assert(process.status === "supported-value", "owned process memory status");
  const row = (process.value as Array<Record<string, unknown>>)[0];
  assert(row.pid === Deno.pid && (row.rssBytes === null || Number(row.rssBytes) > 0));
});
