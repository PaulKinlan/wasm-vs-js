import {
  acquireMediaPhotoFixtures,
  assertFixtureManifest,
  type MediaPhotoFixtureManifest,
} from "../lib/media-photo-thumbnail-fixtures.ts";

const MANIFEST_PATH = "benchmarks/v1/media-photo-thumbnail/fixture-rights-manifest.json";

function outputArgument(args: string[]): string {
  if (args.length !== 2 || args[0] !== "--output" || args[1].trim() === "") {
    throw new Error(
      "Usage: deno run --allow-read=.,<owned-dir> --allow-net=raw.githubusercontent.com --allow-write=<owned-dir> scripts/fetch-media-photo-thumbnail-fixtures.ts --output <owned-dir>",
    );
  }
  return args[1];
}

if (import.meta.main) {
  const output = outputArgument(Deno.args);
  const manifest = JSON.parse(await Deno.readTextFile(MANIFEST_PATH)) as MediaPhotoFixtureManifest;
  assertFixtureManifest(manifest);
  const records = await acquireMediaPhotoFixtures(manifest, output);
  console.log(JSON.stringify({ manifestId: manifest.manifestId, output, files: records }, null, 2));
}
