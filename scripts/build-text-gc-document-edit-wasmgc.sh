#!/usr/bin/env bash
set -euo pipefail
root="$(cd "$(dirname "$0")/.." && pwd)"
project="$root/benchmarks/v1/text-gc-document-edit/kotlin"
cache="${XDG_CACHE_HOME:-$HOME/.cache}/wasm-vs-js/toolchains"
version=9.6.1
archive="$cache/gradle-$version-bin.zip"
dist="$cache/gradle-$version"
url=https://services.gradle.org/distributions/gradle-$version-bin.zip
sha=9c0f7faeeb306cb14e4279a3e084ca6b596894089a0638e68a07c945a32c9e14
mkdir -p "$cache"
if [[ ! -f "$archive" ]]; then curl --fail --location --silent --show-error "$url" --output "$archive"; fi
actual="$(sha256sum "$archive" | cut -d' ' -f1)"
[[ "$actual" == "$sha" ]] || { echo "Gradle archive hash mismatch: $actual" >&2; exit 1; }
if [[ ! -x "$dist/bin/gradle" ]]; then
  rm -rf "$dist" "$cache/gradle-$version"
  unzip -q "$archive" -d "$cache"
fi
cd "$project"
"$dist/bin/gradle" wasmJsProductionExecutableCompileSync --no-daemon
cd "$root"
deno run --allow-read=. --allow-write=public/artifacts/text-gc-document-edit scripts/finalize-text-gc-document-edit-wasmgc.ts
