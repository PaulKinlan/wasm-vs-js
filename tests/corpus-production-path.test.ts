import { assertEquals } from "./assert.ts";
import { dryFake } from "../scripts/run-m1-chrome-corpus.ts";

Deno.test("dependency-injected dry corpus traverses production CDP worker evidence path", async () => {
  const result = await dryFake();
  assertEquals(result.collectOwnedBlockEntrypointExercised, true);
  assertEquals(result.browserCdpPathExercised, true);
  assertEquals(result.workerAutoAttachBodiesAndReleaseExercised, true);
  assertEquals(result.committed, 40);
  assertEquals(result.attempted, 40);
  assertEquals(result.noBrowserOrSystemdLaunched, true);
});
