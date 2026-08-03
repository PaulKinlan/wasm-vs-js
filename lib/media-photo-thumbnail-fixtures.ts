export interface MediaPhotoFixtureEntry {
  id: string;
  subset: "GB82" | "GB82-SC";
  sourcePath: string;
  downloadUrl: string;
  sha256: string;
  byteLength: number;
  width: number;
  height: number;
  pixelFormat: "rgb8" | "indexed8";
  colorSpace: "sRGB-D65";
  alpha: "opaque";
  exifOrientation: "absent-treat-as-1";
  licenseSpdx: "CC0-1.0";
}

export interface MediaPhotoFixtureManifest {
  schemaVersion: 1;
  manifestId: "media-photo-thumbnail-fixtures-v1";
  catalogWorkloadId: "media.photo-thumbnail.v1";
  catalogSha256: string;
  fixtureState: "frozen-download-recipe";
  distributionMode: "download-recipe-only";
  source: {
    repository: "https://github.com/gianni-rosato/gb82-image-set";
    commit: string;
    commitDate: string;
    readmeSha256: string;
    licensePath: "LICENSE";
    licenseSha256: string;
  };
  rightsAudit: {
    status: "upstream-per-file-scope-confirmed";
    licenseSpdx: "CC0-1.0";
    scopeEvidence: string;
    redistributionPermission: "permitted-by-CC0-1.0";
    caveat: string;
  };
  selection: MediaPhotoFixtureEntry[];
}

const SHA256_RE = /^[0-9a-f]{64}$/;
const COMMIT_RE = /^[0-9a-f]{40}$/;
const SAFE_PATH_RE = /^(png|sc-png)\/[A-Za-z0-9_-]+\.png$/;
const EXPECTED_IDS = new Set([
  "gb82-baby",
  "gb82-night",
  "gb82-grass",
  "gb82-pixel",
  "gb82-sc-graph",
  "gb82-sc-terminal",
]);

export function assertFixtureManifest(value: unknown): asserts value is MediaPhotoFixtureManifest {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error("Fixture manifest must be an object");
  }
  const manifest = value as Record<string, unknown>;
  const exactTopKeys = [
    "catalogSha256",
    "catalogWorkloadId",
    "distributionMode",
    "fixtureState",
    "manifestId",
    "rightsAudit",
    "schemaVersion",
    "selection",
    "source",
  ];
  const actualTopKeys = Object.keys(manifest).sort();
  if (JSON.stringify(actualTopKeys) !== JSON.stringify(exactTopKeys)) {
    throw new Error(`Unexpected fixture manifest keys: ${actualTopKeys.join(",")}`);
  }
  if (
    manifest.schemaVersion !== 1 ||
    manifest.manifestId !== "media-photo-thumbnail-fixtures-v1" ||
    manifest.catalogWorkloadId !== "media.photo-thumbnail.v1" ||
    manifest.fixtureState !== "frozen-download-recipe" ||
    manifest.distributionMode !== "download-recipe-only" ||
    typeof manifest.catalogSha256 !== "string" ||
    !SHA256_RE.test(manifest.catalogSha256)
  ) {
    throw new Error("Fixture manifest identity or state is invalid");
  }

  const source = manifest.source as Record<string, unknown>;
  if (
    !source ||
    source.repository !== "https://github.com/gianni-rosato/gb82-image-set" ||
    typeof source.commit !== "string" ||
    !COMMIT_RE.test(source.commit) ||
    source.licensePath !== "LICENSE" ||
    typeof source.readmeSha256 !== "string" ||
    !SHA256_RE.test(source.readmeSha256) ||
    typeof source.licenseSha256 !== "string" ||
    !SHA256_RE.test(source.licenseSha256)
  ) {
    throw new Error("Fixture source pin is invalid");
  }

  const rights = manifest.rightsAudit as Record<string, unknown>;
  if (
    !rights ||
    rights.status !== "upstream-per-file-scope-confirmed" ||
    rights.licenseSpdx !== "CC0-1.0" ||
    rights.redistributionPermission !== "permitted-by-CC0-1.0" ||
    typeof rights.scopeEvidence !== "string" ||
    rights.scopeEvidence.length === 0 ||
    typeof rights.caveat !== "string" ||
    rights.caveat.length === 0
  ) {
    throw new Error("Fixture rights audit is invalid");
  }

  if (!Array.isArray(manifest.selection) || manifest.selection.length !== 6) {
    throw new Error("Fixture selection must contain exactly six files");
  }
  const ids = new Set<string>();
  const paths = new Set<string>();
  for (const rawEntry of manifest.selection) {
    if (!rawEntry || typeof rawEntry !== "object" || Array.isArray(rawEntry)) {
      throw new Error("Fixture entry must be an object");
    }
    const entry = rawEntry as Record<string, unknown>;
    const id = entry.id;
    const sourcePath = entry.sourcePath;
    if (
      typeof id !== "string" ||
      !EXPECTED_IDS.has(id) ||
      ids.has(id) ||
      typeof sourcePath !== "string" ||
      !SAFE_PATH_RE.test(sourcePath) ||
      paths.has(sourcePath) ||
      typeof entry.downloadUrl !== "string" ||
      entry.downloadUrl !==
        `https://raw.githubusercontent.com/gianni-rosato/gb82-image-set/${source.commit}/${sourcePath}` ||
      typeof entry.sha256 !== "string" ||
      !SHA256_RE.test(entry.sha256) ||
      !Number.isSafeInteger(entry.byteLength) ||
      (entry.byteLength as number) <= 0 ||
      !Number.isSafeInteger(entry.width) ||
      (entry.width as number) <= 0 ||
      !Number.isSafeInteger(entry.height) ||
      (entry.height as number) <= 0 ||
      !["rgb8", "indexed8"].includes(entry.pixelFormat as string) ||
      entry.colorSpace !== "sRGB-D65" ||
      entry.alpha !== "opaque" ||
      entry.exifOrientation !== "absent-treat-as-1" ||
      entry.licenseSpdx !== "CC0-1.0"
    ) {
      throw new Error(`Invalid fixture entry: ${String(id)}`);
    }
    ids.add(id);
    paths.add(sourcePath);
  }
  if (ids.size !== EXPECTED_IDS.size || [...EXPECTED_IDS].some((id) => !ids.has(id))) {
    throw new Error("Fixture selection IDs do not match the frozen selection");
  }
  const subsetCounts = manifest.selection.reduce<Record<string, number>>((counts, entry) => {
    counts[entry.subset] = (counts[entry.subset] ?? 0) + 1;
    return counts;
  }, {});
  if (subsetCounts.GB82 !== 4 || subsetCounts["GB82-SC"] !== 2) {
    throw new Error("Fixture selection must include four GB82 and two GB82-SC files");
  }
}

export async function sha256Hex(bytes: Uint8Array): Promise<string> {
  const owned = new Uint8Array(bytes.byteLength);
  owned.set(bytes);
  const digest = await crypto.subtle.digest("SHA-256", owned.buffer);
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

async function fetchExact(
  url: string,
  expectedBytes: number | null,
  expectedSha256: string,
  fetcher: typeof fetch,
): Promise<Uint8Array> {
  const response = await fetcher(url, {
    redirect: "error",
    headers: { accept: "application/octet-stream" },
  });
  if (!response.ok) throw new Error(`Fetch failed ${response.status} for ${url}`);
  const bytes = new Uint8Array(await response.arrayBuffer());
  if (expectedBytes !== null && bytes.byteLength !== expectedBytes) {
    throw new Error(`Byte length mismatch for ${url}: ${bytes.byteLength} != ${expectedBytes}`);
  }
  const actualSha256 = await sha256Hex(bytes);
  if (actualSha256 !== expectedSha256) {
    throw new Error(`SHA-256 mismatch for ${url}: ${actualSha256} != ${expectedSha256}`);
  }
  return bytes;
}

export async function acquireMediaPhotoFixtures(
  manifest: MediaPhotoFixtureManifest,
  outputRoot: string,
  fetcher: typeof fetch = fetch,
): Promise<Array<{ path: string; byteLength: number; sha256: string }>> {
  assertFixtureManifest(manifest);
  const root = await Deno.realPath(outputRoot).catch(async () => {
    await Deno.mkdir(outputRoot, { recursive: true, mode: 0o700 });
    return await Deno.realPath(outputRoot);
  });
  const records: Array<{ path: string; byteLength: number; sha256: string }> = [];
  for (const entry of manifest.selection) {
    const bytes = await fetchExact(entry.downloadUrl, entry.byteLength, entry.sha256, fetcher);
    const outputPath = `${root}/${entry.sourcePath}`;
    await Deno.mkdir(outputPath.slice(0, outputPath.lastIndexOf("/")), {
      recursive: true,
      mode: 0o700,
    });
    await Deno.writeFile(outputPath, bytes, { mode: 0o600 });
    records.push({ path: entry.sourcePath, byteLength: bytes.byteLength, sha256: entry.sha256 });
  }

  const rawRoot =
    `https://raw.githubusercontent.com/gianni-rosato/gb82-image-set/${manifest.source.commit}`;
  const license = await fetchExact(
    `${rawRoot}/${manifest.source.licensePath}`,
    null,
    manifest.source.licenseSha256,
    fetcher,
  );
  const readme = await fetchExact(
    `${rawRoot}/README.md`,
    null,
    manifest.source.readmeSha256,
    fetcher,
  );
  await Deno.writeFile(`${root}/LICENSE.CC0-1.0.txt`, license, { mode: 0o600 });
  await Deno.writeFile(`${root}/UPSTREAM-README.md`, readme, { mode: 0o600 });
  return records;
}
