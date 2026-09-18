// scripts/toolchain-fingerprint.ts
//
// Identifies the compiler toolchain a build ran on, precisely enough that two
// machines can be told apart in the provenance ledger.
//
// Why a fingerprint and not a version string: the ledger pinned
// `clang version 22.1.8`, and this machine's clang reports
// `Homebrew clang version 22.1.8`. Textually it satisfies the pin. It does not
// produce the same bytes: all 10 C and all 10 C++ artifacts differ under it,
// along with the four Rust artifacts whose link step goes through wasm-ld.
// A version number is not an identity.
//
// The identity hash covers what a compiler reports about itself — version,
// target triple, backend version. It deliberately excludes install paths, so
// the same distribution unpacked in two places is one toolchain, while two
// distributions of the same release stay distinct.
//
// A tool that is not installed is recorded as the string "unavailable" with a
// reason. It is never an empty string and never a zero: an absent compiler is
// an absent measurement, not a measurement of nothing.

export interface ToolIdentity {
  /** The tool's self-reported version, or "unavailable". */
  version: string;
  /** Why `version` is "unavailable". Absent when the tool answered. */
  unavailableReason?: string;
  /** Further identity the tool reports about itself. */
  detail?: Record<string, string>;
}

export interface ToolchainFingerprint {
  /** `tc-` plus 12 hex of the sha256 over the identity fields. */
  id: string;
  os: string;
  arch: string;
  tools: Record<string, ToolIdentity>;
  /**
   * Recorded for debugging, excluded from `id`: install locations and host
   * details that vary between two installs of the same distribution.
   */
  host: Record<string, string>;
}

const UNAVAILABLE = "unavailable";

async function run(
  cmd: string,
  args: string[],
  env?: Record<string, string>,
): Promise<string | null> {
  try {
    const out = await new Deno.Command(cmd, {
      args,
      env,
      stdout: "piped",
      stderr: "piped",
    }).output();
    if (!out.success) return null;
    return new TextDecoder().decode(out.stdout).trim();
  } catch {
    return null;
  }
}

function missing(reason: string): ToolIdentity {
  return { version: UNAVAILABLE, unavailableReason: reason };
}

/** `clang --version` reports the vendor prefix that distinguishes distributions. */
async function clangIdentity(
  binary: string,
  env?: Record<string, string>,
): Promise<{ tool: ToolIdentity; host: Record<string, string> }> {
  const text = await run(binary, ["--version"], env);
  if (text === null) {
    return { tool: missing(`${binary} is not on PATH`), host: {} };
  }
  const lines = text.split("\n").map((l) => l.trim());
  const detail: Record<string, string> = {};
  const host: Record<string, string> = {};
  for (const line of lines.slice(1)) {
    const at = line.indexOf(":");
    if (at < 0) continue;
    const key = line.slice(0, at).trim();
    const value = line.slice(at + 1).trim();
    // Target decides codegen, so it is identity. InstalledDir and the
    // configuration file path are where this copy happens to live.
    if (key === "Target" || key === "Thread model") detail[key] = value;
    else host[`${binary}.${key}`] = value;
  }
  return { tool: { version: lines[0], detail }, host };
}

/** `rustc -vV` reports the commit and the LLVM it was built against. */
async function rustcIdentity(env?: Record<string, string>): Promise<ToolIdentity> {
  const text = await run("rustc", ["--version", "--verbose"], env);
  if (text === null) return missing("rustc is not on PATH");
  const lines = text.split("\n");
  const detail: Record<string, string> = {};
  for (const line of lines.slice(1)) {
    const at = line.indexOf(":");
    if (at < 0) continue;
    const key = line.slice(0, at).trim();
    const value = line.slice(at + 1).trim();
    if (key === "commit-hash" || key === "host" || key === "LLVM version") {
      detail[key] = value;
    }
  }
  return { version: lines[0].trim(), detail };
}

async function simpleIdentity(
  binary: string,
  args: string[],
  env: Record<string, string> | undefined,
  absentReason: string,
): Promise<ToolIdentity> {
  const text = await run(binary, args, env);
  if (text === null) return missing(absentReason);
  return { version: text.split("\n")[0].trim() };
}

/**
 * Probes every compiler that can decide an artifact's bytes.
 *
 * `asc` is resolved through npx, which reaches the network on a cold cache, so
 * it is probed last and its absence is recorded rather than thrown.
 */
export async function fingerprintToolchain(
  env?: Record<string, string>,
  options: { probeAsc?: boolean } = {},
): Promise<ToolchainFingerprint> {
  const tools: Record<string, ToolIdentity> = {};
  const host: Record<string, string> = {};

  for (const binary of ["clang", "clang++"]) {
    const { tool, host: h } = await clangIdentity(binary, env);
    tools[binary] = tool;
    Object.assign(host, h);
  }
  tools["wasm-ld"] = await simpleIdentity(
    "wasm-ld",
    ["--version"],
    env,
    "wasm-ld is not on PATH; Homebrew ships lld as a separate formula",
  );
  tools.rustc = await rustcIdentity(env);
  tools.dart = await simpleIdentity("dart", ["--version"], env, "the Dart SDK is not on PATH");
  tools.node = await simpleIdentity("node", ["--version"], env, "node is not on PATH");
  tools.asc = options.probeAsc
    ? await simpleIdentity(
      "npx",
      ["--yes", "-p", "assemblyscript", "asc", "--version"],
      env,
      "npx could not resolve the assemblyscript package",
    )
    : missing("not probed: asc is resolved per build through npx");

  host.denoVersion = Deno.version.deno;
  try {
    host.osRelease = Deno.osRelease();
  } catch {
    host.osRelease = UNAVAILABLE;
  }
  for (const binary of ["clang", "rustc", "dart", "wasm-ld"]) {
    const which = await run(Deno.build.os === "windows" ? "where" : "which", [binary], env);
    host[`${binary}.path`] = which === null ? UNAVAILABLE : which.split("\n")[0].trim();
  }

  const identity = {
    os: Deno.build.os,
    arch: Deno.build.arch,
    tools: Object.fromEntries(
      Object.keys(tools).sort().map((
        k,
      ) => [k, { version: tools[k].version, detail: tools[k].detail ?? {} }]),
    ),
  };
  const digest = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(JSON.stringify(identity)),
  );
  const id = "tc-" +
    [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, "0")).join("").slice(0, 12);

  return { id, os: Deno.build.os, arch: Deno.build.arch, tools, host };
}

if (import.meta.main) {
  const fingerprint = await fingerprintToolchain(undefined, {
    probeAsc: Deno.args.includes("--probe-asc"),
  });
  console.log(JSON.stringify(fingerprint, null, 2));
}
