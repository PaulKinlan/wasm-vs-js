import {
  FROZEN_V1_SHA256,
  REQUIRED_FORMATS,
  validateMediaImageDecodeBatchBlocker,
} from "../lib/media-image-decode-batch-blocker.ts";

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

Deno.test("media image decode batch remains an explicit non-coverage blocker", async () => {
  const result = await validateMediaImageDecodeBatchBlocker();
  assert(result.catalogSha256 === FROZEN_V1_SHA256, "catalog hash differs");
  assert(result.publicCatalogSha256 === FROZEN_V1_SHA256, "public catalog hash differs");
  assert(result.expectedImages === 125, "expected image count differs");
  assert(result.pinnedImages === 0, "blocked package must not claim fixtures");
  assert(result.rawSha256Count === 0, "blocked package must not claim hashes");
  assert(
    result.blockerCodes.includes("fixture-rights-and-selection-unresolved"),
    "rights blocker missing",
  );
  assert(
    result.blockerCodes.includes("genuine-javascript-jxl-decoder-unavailable"),
    "JavaScript JXL blocker missing",
  );
});

Deno.test("media image decode batch requires all five formats without substitutions", async () => {
  const audit = JSON.parse(
    await Deno.readTextFile(
      new URL(
        "../benchmarks/v1/media-image-decode-batch/fixture-rights-audit.v1.json",
        import.meta.url,
      ),
    ),
  ) as {
    selectionPolicy: {
      formats: string[];
      imagesPerFormat: number;
      mixedRightsHeicExcluded: boolean;
      substitutionsAllowed: boolean;
    };
    formatSets: Array<{ format: string; expectedCount: number; rawSha256: string[] }>;
  };
  assert(
    JSON.stringify(audit.selectionPolicy.formats) === JSON.stringify(REQUIRED_FORMATS),
    "formats differ",
  );
  assert(audit.selectionPolicy.imagesPerFormat === 25, "per-format count differs");
  assert(audit.selectionPolicy.mixedRightsHeicExcluded, "HEIC exclusion missing");
  assert(!audit.selectionPolicy.substitutionsAllowed, "substitutions must be forbidden");
  assert(audit.formatSets.every((set) => set.expectedCount === 25), "format count differs");
  assert(audit.formatSets.every((set) => set.rawSha256.length === 0), "hashes were fabricated");
});

Deno.test("media image decode batch rejects Wasm-backed JavaScript and native baselines", async () => {
  const audit = JSON.parse(
    await Deno.readTextFile(
      new URL(
        "../benchmarks/v1/media-image-decode-batch/codec-feasibility-audit.v1.json",
        import.meta.url,
      ),
    ),
  ) as {
    controlledTargets: { javascript: { status: string; blockingFormat: string } };
    candidateChecks: Array<{
      name: string;
      executionTechnology: string;
      javascriptTargetEligible: boolean | string;
    }>;
    hostBaseline: { controlledJavaScriptEligible: boolean };
  };
  assert(audit.controlledTargets.javascript.status === "blocked", "JavaScript target must block");
  assert(audit.controlledTargets.javascript.blockingFormat === "jxl", "blocking format differs");
  for (const name of ["icodec", "jxl.js", "avif.js"]) {
    const candidate = audit.candidateChecks.find((item) => item.name === name);
    assert(candidate, `${name} audit missing`);
    assert(candidate.javascriptTargetEligible === false, `${name} must not count as JavaScript`);
  }
  assert(!audit.hostBaseline.controlledJavaScriptEligible, "native decode must stay separate");
});
