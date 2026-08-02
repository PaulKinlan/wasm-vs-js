import { assertEquals, assertRejects } from "./assert.ts";
import {
  inspectChromePackage,
  stageChromePackage,
  verifyStagedChrome,
} from "../lib/chrome-stage.ts";
import { sha256Hex } from "../lib/canonical.ts";

Deno.test("staged Chrome package is immutable and independent from original bytes", async () => {
  const source = await Deno.makeTempDir(), binary = `${source}/chrome`;
  await Deno.writeTextFile(binary, "original-binary");
  await Deno.writeTextFile(`${source}/resource.pak`, "resource");
  await Deno.mkdir(`${source}/PrivacySandboxAttestationsPreloaded`);
  await Deno.writeTextFile(
    `${source}/PrivacySandboxAttestationsPreloaded/manifest.json`,
    "nested-resource",
  );
  const hash = await sha256Hex(await Deno.readFile(binary));
  const inspected = await inspectChromePackage(binary, hash);
  const stage = await stageChromePackage(binary, hash, `test-${crypto.randomUUID()}`);
  assertEquals(stage.manifestSha256, inspected.manifestSha256);
  try {
    await Deno.writeTextFile(binary, "mutated-original");
    await verifyStagedChrome(stage);
    assertEquals(await Deno.readTextFile(stage.binary), "original-binary");
    assertEquals(
      await Deno.readTextFile(`${stage.root}/PrivacySandboxAttestationsPreloaded/manifest.json`),
      "nested-resource",
    );
    await Deno.chmod(stage.binary, 0o700);
    await Deno.writeTextFile(stage.binary, "mutated-stage");
    await Deno.chmod(stage.binary, 0o500);
    await assertRejects(() => verifyStagedChrome(stage), "manifest changed");
  } finally {
    await Deno.chmod(stage.binary, 0o500).catch(() => {});
    await Deno.chmod(stage.root, 0o700).catch(() => {});
    await Deno.chmod(`${stage.root}/PrivacySandboxAttestationsPreloaded`, 0o700).catch(() => {});
    await Deno.remove(stage.root, { recursive: true }).catch(() => {});
    await Deno.remove(source, { recursive: true });
  }
});
