import { assertEquals } from "./assert.ts";

Deno.test("pinned build reproduces byte-identical Wasm and manifest", async () => {
  const beforeWasm = await Deno.readFile("public/artifacts/sum-u32/sum-u32.wasm");
  const beforeManifest = await Deno.readTextFile("public/artifacts/sum-u32/build-manifest.json");
  const command = new Deno.Command(Deno.execPath(), {
    args: ["task", "build"],
    stdout: "piped",
    stderr: "piped",
  });
  const result = await command.output();
  if (!result.success) throw new Error(new TextDecoder().decode(result.stderr));
  assertEquals([...await Deno.readFile("public/artifacts/sum-u32/sum-u32.wasm")], [...beforeWasm]);
  assertEquals(
    await Deno.readTextFile("public/artifacts/sum-u32/build-manifest.json"),
    beforeManifest,
  );
});
