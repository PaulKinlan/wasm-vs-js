// toolchain-pin.json names the compiler distributions this repository builds
// against, by download URL and sha256.
//
// The pin it replaces was a version string. `clang version 22.1.8` is satisfied
// by Homebrew's `Homebrew clang version 22.1.8`, which reproduces none of the
// 10 C or 10 C++ artifacts and none of the 4 Rust artifacts linked through
// wasm-ld. A release number identifies a source tree; only a hash identifies a
// binary.
//
// This test holds the pin complete: every distribution is pinned by a hash or
// is listed as deliberately unpinned with a reason, and the version strings the
// pin declares are the ones the provenance ledger reports as its reference.

import { assert, assertEquals } from "./assert.ts";

const ROOT = new URL("../", import.meta.url).pathname;

interface Platform {
  url: string;
  sha256: string;
  bytes?: number;
}

interface Distribution {
  version: string;
  hashSource?: string;
  platforms?: Record<string, Platform>;
  channelManifest?: { url: string; sha256: string };
  registry?: string;
  integrity?: string;
  expectedVersionString?: string;
}

interface Pin {
  schemaVersion: number;
  claimBoundary: string;
  distributions: Record<string, Distribution>;
  deliberatelyUnpinned: Record<string, string>;
}

const pin: Pin = JSON.parse(await Deno.readTextFile(`${ROOT}toolchain-pin.json`));

const SHA256 = /^[0-9a-f]{64}$/;

Deno.test("every pinned distribution carries a hash, not just a version", () => {
  assertEquals(pin.schemaVersion, 1);
  const names = Object.keys(pin.distributions);
  assert(names.length > 0, "the pin lists no distributions");
  for (const [name, dist] of Object.entries(pin.distributions)) {
    assert(dist.version.length > 0, `${name}: no version`);
    assert(
      (dist.hashSource ?? "").length > 0,
      `${name}: no hashSource — a hash with no stated origin cannot be re-verified`,
    );
    const pinnedBy = [
      dist.platforms ? "platforms" : null,
      dist.channelManifest ? "channelManifest" : null,
      dist.integrity ? "integrity" : null,
    ].filter(Boolean);
    assert(
      pinnedBy.length > 0,
      `${name}: pinned by nothing — needs per-platform hashes, a channel manifest, or a ` +
        `registry integrity hash`,
    );
    for (const [platform, entry] of Object.entries(dist.platforms ?? {})) {
      assert(
        entry.url.startsWith("https://"),
        `${name}/${platform}: download URL is not https`,
      );
      assert(SHA256.test(entry.sha256), `${name}/${platform}: sha256 is not 64 hex characters`);
    }
    if (dist.channelManifest) {
      assert(
        dist.channelManifest.url.startsWith("https://"),
        `${name}: channel manifest URL is not https`,
      );
      assert(SHA256.test(dist.channelManifest.sha256), `${name}: channel manifest sha256 is bad`);
    }
    if (dist.integrity) {
      assert(
        /^sha(256|512)-[A-Za-z0-9+/]+=*$/.test(dist.integrity),
        `${name}: integrity is not a Subresource Integrity digest`,
      );
      assert((dist.registry ?? "").startsWith("https://"), `${name}: no registry URL`);
    }
  }
});

Deno.test("anything left unpinned says why", () => {
  const entries = Object.entries(pin.deliberatelyUnpinned ?? {});
  assert(entries.length > 0, "nothing is recorded as unpinned, which is unlikely to be true");
  for (const [name, reason] of entries) {
    // A one-word reason is an omission wearing a label.
    assert(reason.split(/\s+/).length >= 8, `${name}: unpinned with no real reason given`);
  }
});

Deno.test("the pin does not claim the committed artifacts came from it", () => {
  // The distributions that built the committed bytes were never recorded, so
  // the pin describes what happens from now on. Saying otherwise would be a
  // provenance claim the project cannot support.
  assert(
    /not evidence|not proof/i.test(pin.claimBoundary),
    "the pin must state that it is not evidence about the committed artifacts",
  );
});

Deno.test("the ledger's reference toolchain is the pinned one", async () => {
  const ledger = JSON.parse(
    await Deno.readTextFile(
      `${ROOT}public/artifacts/multilang-wasm-benchmark/kernel-build-provenance.v1.json`,
    ),
  ) as { toolchain: Record<string, string> };
  assertEquals(ledger.toolchain.clang, pin.distributions.llvm.expectedVersionString);
  assertEquals(ledger.toolchain.rustc, pin.distributions.rust.expectedVersionString);
  assertEquals(ledger.toolchain.dart, pin.distributions.dart.expectedVersionString);
});

Deno.test("the builder finds compilers without one contributor's home directory", async () => {
  // The build PATH was two absolute paths under /home/paulkinlan. On every
  // other machine they resolved to nothing and the build silently fell through
  // to whatever the ambient PATH held — which is exactly how a build ends up
  // using a compiler nobody recorded.
  const source = await Deno.readTextFile(`${ROOT}scripts/build-multilang-kernels.ts`);
  const hardcoded = source.match(/["'`](\/home\/[a-z]+|\/Users\/[a-z]+)\//gi) ?? [];
  assertEquals(hardcoded, [], `the builder hard-codes a home directory: ${hardcoded.join(", ")}`);
  assert(
    source.includes("WASM_VS_JS_TOOL_PATH"),
    "the build PATH must be overridable for machines that install compilers elsewhere",
  );
});
