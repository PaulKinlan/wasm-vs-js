import { assert, assertEquals } from "./assert.ts";
import { AUDIO_COUNTERS } from "../lib/audio-workloads.ts";
import type { AudioSlug } from "../benchmarks/audio-shared/constants.ts";

const slugs: AudioSlug[] = ["audio-fft", "audio-fir", "audio-stft"];

Deno.test("audio descriptors exactly bind accepted v2 identities, parameters, variants, counters, and phases", async () => {
  const catalog = JSON.parse(await Deno.readTextFile("catalog/workloads.v2.proposed.json"));
  for (const slug of slugs) {
    const descriptor = JSON.parse(await Deno.readTextFile(`benchmarks/${slug}/benchmark.json`));
    const entry = catalog.entries.find((candidate: { benchmarkSlug: string }) =>
      candidate.benchmarkSlug === slug
    );
    assert(entry, `catalog entry missing for ${slug}`);
    assertEquals(descriptor.entryId, entry.id);
    assertEquals(descriptor.benchmarkSlug, entry.benchmarkSlug);
    assertEquals(descriptor.title, entry.title);
    assertEquals(descriptor.tier, entry.tier);
    assertEquals(descriptor.class, entry.class);
    assertEquals(descriptor.parameters, entry.input.parameters);
    const identity = (variant: {
      id: string;
      target: string;
      track: string;
      algorithmFamilyId: string;
    }) => ({
      id: variant.id,
      target: variant.target,
      track: variant.track,
      algorithmFamilyId: variant.algorithmFamilyId,
    });
    assertEquals(
      descriptor.variants.map(identity),
      entry.tracks.flatMap((track: {
        track: string;
        variants: Array<{ id: string; target: string; algorithmFamilyId: string }>;
      }) => track.variants.map((variant) => identity({ ...variant, track: track.track }))),
    );
    assertEquals(Object.keys(descriptor.workCounters), entry.work.counters);
    assertEquals(descriptor.workCounters, AUDIO_COUNTERS[slug]);
    assertEquals(descriptor.phases, entry.phases);
    assertEquals(
      descriptor.oracle.checks,
      entry.oracle.checks.map((check: { id: string }) => check.id),
    );
    assertEquals(descriptor.performanceClaims, []);
  }
});
