import { attestAndRestrictTemporaryRoot } from "../lib/process-ledger.ts";

const [unrelated, owned] = Deno.args;
if (!unrelated || !owned) throw new Error("two paths required");
await attestAndRestrictTemporaryRoot();
if (await Deno.readTextFile(owned) !== "owned") throw new Error("owned read grant was revoked");
try {
  await Deno.readTextFile(unrelated);
  throw new Error("unrelated temporary file remained readable");
} catch (error) {
  if (!(error instanceof Deno.errors.NotCapable)) throw error;
}
