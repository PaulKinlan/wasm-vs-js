const SQLITE_PACKAGE = "@sqlite.org/sqlite-wasm@3.53.0-build1";
const SQLITE_TARBALL =
  "https://registry.npmjs.org/@sqlite.org/sqlite-wasm/-/sqlite-wasm-3.53.0-build1.tgz";
const SQLITE_TARBALL_SHA256 = "fbbd5c542fad22ce1d90df1533025903a00a593f461f4a43b1e43e9897dfad9c";
const ALASQL_PACKAGE = "alasql@4.17.3";
const ALASQL_TARBALL = "https://registry.npmjs.org/alasql/-/alasql-4.17.3.tgz";
const ALASQL_TARBALL_SHA256 = "64bb8f63574b42f377ca1d4911c26505a48e668c64112af48b9af9100adb7b88";

const root = new URL("../", import.meta.url);
const output = new URL("../public/artifacts/sqlite-notebook/", import.meta.url);
const temp = await Deno.makeTempDir({ prefix: "sqlite-notebook-vendor-" });

async function sha256(bytes: Uint8Array): Promise<string> {
  return [...new Uint8Array(await crypto.subtle.digest("SHA-256", Uint8Array.from(bytes)))]
    .map((value) => value.toString(16).padStart(2, "0")).join("");
}

async function fetchChecked(url: string, expected: string, name: string) {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`${name} download failed: ${response.status}`);
  const bytes = new Uint8Array(await response.arrayBuffer());
  const actual = await sha256(bytes);
  if (actual !== expected) {
    throw new Error(`${name} tarball SHA-256 mismatch: ${actual}`);
  }
  return bytes;
}

async function extract(bytes: Uint8Array, directory: string) {
  const archive = `${directory}/package.tgz`;
  await Deno.writeFile(archive, bytes);
  const command = new Deno.Command("tar", {
    args: ["xzf", archive, "-C", directory],
    stdout: "piped",
    stderr: "piped",
  });
  const result = await command.output();
  if (!result.success) throw new Error(new TextDecoder().decode(result.stderr));
}

try {
  await Deno.mkdir(output, { recursive: true });
  const sqliteDir = `${temp}/sqlite`;
  const alasqlDir = `${temp}/alasql`;
  await Deno.mkdir(sqliteDir);
  await Deno.mkdir(alasqlDir);
  const [sqliteBytes, alasqlBytes] = await Promise.all([
    fetchChecked(SQLITE_TARBALL, SQLITE_TARBALL_SHA256, SQLITE_PACKAGE),
    fetchChecked(ALASQL_TARBALL, ALASQL_TARBALL_SHA256, ALASQL_PACKAGE),
  ]);
  await extract(sqliteBytes, sqliteDir);
  await extract(alasqlBytes, alasqlDir);

  const textCopies = [
    [`${sqliteDir}/package/dist/index.mjs`, new URL("sqlite3.mjs", output)],
    [`${sqliteDir}/package/dist/node.mjs`, new URL("sqlite3-node.mjs", output)],
    [`${alasqlDir}/package/dist/alasql.min.js`, new URL("alasql.min.js", output)],
  ] as const;
  for (const [source, destination] of textCopies) {
    const upstream = await Deno.readTextFile(source);
    const normalized = upstream.replaceAll("\r\n", "\n").replace(/[ \t]+$/gm, "").replace(
      / +\t/g,
      "\t",
    );
    await Deno.writeTextFile(destination, `// deno-lint-ignore-file\n${normalized}`);
  }
  await Deno.copyFile(
    `${sqliteDir}/package/dist/sqlite3.wasm`,
    new URL("sqlite3.wasm", output),
  );
  const alasqlLicense = (await Deno.readTextFile(`${alasqlDir}/package/LICENSE`))
    .replaceAll("\r\n", "\n").replace(/[ \t]+$/gm, "");
  await Deno.writeTextFile(
    new URL("ALASQL-LICENSE.txt", output),
    alasqlLicense,
  );

  const manifest: Record<string, unknown> = {
    schemaVersion: 1,
    generatedBy: "scripts/vendor-sqlite-notebook-deps.ts",
    packages: [
      {
        identity: SQLITE_PACKAGE,
        tarball: SQLITE_TARBALL,
        tarballSha256: SQLITE_TARBALL_SHA256,
        licenseSpdx: "Apache-2.0 AND blessing",
        upstream: "https://github.com/sqlite/sqlite-wasm",
      },
      {
        identity: ALASQL_PACKAGE,
        tarball: ALASQL_TARBALL,
        tarballSha256: ALASQL_TARBALL_SHA256,
        licenseSpdx: "MIT",
        upstream: "https://github.com/AlaSQL/alasql",
      },
    ],
    files: {},
  };
  const files = manifest.files as Record<string, { bytes: number; sha256: string }>;
  const vendoredNames = [
    "sqlite3.mjs",
    "sqlite3-node.mjs",
    "sqlite3.wasm",
    "alasql.min.js",
    "ALASQL-LICENSE.txt",
  ];
  for (const name of vendoredNames) {
    const bytes = await Deno.readFile(new URL(name, output));
    files[name] = { bytes: bytes.byteLength, sha256: await sha256(bytes) };
  }
  await Deno.writeTextFile(
    new URL("dependency-manifest.json", output),
    `${JSON.stringify(manifest, null, 2)}\n`,
  );
  console.log(`Vendored SQLite notebook dependencies in ${output.pathname}`);
} finally {
  await Deno.remove(temp, { recursive: true }).catch(() => {});
}

void root;
