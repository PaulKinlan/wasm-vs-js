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
source_commit="${TEXT_GC_SOURCE_COMMIT:-}"
[[ "$source_commit" =~ ^[0-9a-f]{40}$ ]] || {
  echo "TEXT_GC_SOURCE_COMMIT must be the exact 40-hex source commit" >&2
  exit 1
}
git -C "$root" cat-file -e "$source_commit^{commit}"

java_home=/usr/lib/jvm/java-26-openjdk
java_bin="$java_home/bin/java"
[[ "$(sha256sum "$java_bin" | cut -d' ' -f1)" == "0868c4200b2f78fc9e767841cc63200350303519eec74b9458031ee234e5bcb9" ]] || {
  echo "Pinned JDK executable hash mismatch" >&2
  exit 1
}
[[ "$(sha256sum "$java_home/release" | cut -d' ' -f1)" == "4b67a4f6526d3a2d82edca270da64ac3f560fb6a1340bfbc9ad72ae08666cd44" ]] || {
  echo "Pinned JDK release identity hash mismatch" >&2
  exit 1
}
grep -qx 'IMPLEMENTOR="Arch Linux"' "$java_home/release"
grep -qx 'JAVA_RUNTIME_VERSION="26.0.1"' "$java_home/release"
"$java_bin" -version 2>&1 | grep -qx 'openjdk version "26.0.1" 2026-04-21'
export JAVA_HOME="$java_home"
export PATH="$java_home/bin:$PATH"

source_paths=(
  benchmarks/v1/text-gc-document-edit/kotlin/settings.gradle.kts
  benchmarks/v1/text-gc-document-edit/kotlin/build.gradle.kts
  benchmarks/v1/text-gc-document-edit/kotlin/gradle.properties
  benchmarks/v1/text-gc-document-edit/kotlin/gradle.lockfile
  benchmarks/v1/text-gc-document-edit/kotlin/gradle/verification-metadata.xml
  benchmarks/v1/text-gc-document-edit/kotlin/toolchain.lock.json
  benchmarks/v1/text-gc-document-edit/kotlin/src/wasmJsMain/kotlin/Main.kt
  benchmarks/v1/text-gc-document-edit/workload.js
  scripts/build-text-gc-document-edit-fixture.ts
  scripts/build-text-gc-document-edit-wasmgc.sh
  scripts/finalize-text-gc-document-edit-wasmgc.ts
  deno.json
  deno.lock
)
for path in "${source_paths[@]}"; do
  committed_blob="$(git -C "$root" rev-parse "$source_commit:$path")"
  working_blob="$(git -C "$root" hash-object "$root/$path")"
  [[ "$committed_blob" == "$working_blob" ]] || {
    echo "Source bytes differ from $source_commit: $path" >&2
    exit 1
  }
done

mkdir -p "$cache"
if [[ ! -f "$archive" ]]; then curl --fail --location --silent --show-error "$url" --output "$archive"; fi
actual="$(sha256sum "$archive" | cut -d' ' -f1)"
[[ "$actual" == "$sha" ]] || { echo "Gradle archive hash mismatch: $actual" >&2; exit 1; }
if [[ ! -x "$dist/bin/gradle" ]]; then
  rm -rf "$dist" "$cache/gradle-$version"
  unzip -q "$archive" -d "$cache"
fi
cd "$project"
"$dist/bin/gradle" wasmJsProductionExecutableCompileSync --no-daemon --dependency-verification strict
cd "$root"
TEXT_GC_SOURCE_COMMIT="$source_commit" deno run \
  --allow-env=TEXT_GC_SOURCE_COMMIT \
  --allow-run=git \
  --allow-read=. \
  --allow-write=public/artifacts/text-gc-document-edit \
  scripts/finalize-text-gc-document-edit-wasmgc.ts
