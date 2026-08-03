import {
  makeMalformedTraces,
  makeProtocolTrace,
} from "../benchmarks/v1/network-http2-quic-state/fixture.js";
import { runProtocolTrace } from "../benchmarks/v1/network-http2-quic-state/engine.js";

const root = new URL("../", import.meta.url);
const artifactDir = new URL("public/artifacts/network-http2-quic-state/", root);
await Deno.mkdir(artifactDir, { recursive: true });

const clangArgs = [
  "--target=wasm32-unknown-unknown",
  "-O3",
  "-nostdlib",
  "-Wl,--no-entry",
  "-Wl,--export-memory",
  "-Wl,--initial-memory=262144",
  "-Wl,--max-memory=262144",
  "-Wl,--strip-all",
  "-o",
  "public/artifacts/network-http2-quic-state/network-http2-quic-state.wasm",
  "benchmarks/v1/network-http2-quic-state/network-http2-quic-state.c",
];
const command = new Deno.Command("clang", { cwd: root, args: clangArgs });
const result = await command.output();
if (!result.success) throw new Error(new TextDecoder().decode(result.stderr));
await Deno.chmod(new URL("network-http2-quic-state.wasm", artifactDir), 0o644);

const fixture = makeProtocolTrace();
const expected = runProtocolTrace(fixture);
await Deno.writeFile(new URL("trace.bin", artifactDir), fixture);
await Deno.writeFile(new URL("expected-state.u32le", artifactDir), new Uint8Array(expected.buffer));

async function hash(bytes: Uint8Array) {
  return Array.from(new Uint8Array(await crypto.subtle.digest("SHA-256", bytes.slice().buffer)))
    .map((value) => value.toString(16).padStart(2, "0")).join("");
}
async function file(path: string) {
  const bytes = await Deno.readFile(new URL(path, root));
  return { path, bytes: bytes.length, sha256: await hash(bytes) };
}
const manifest = {
  schemaVersion: 1,
  workloadId: "network.http2-quic-state.v1",
  status: "implementation-candidate-unreviewed",
  toolchain: {
    deno: Deno.version.deno,
    clang: "22.1.8",
    lld: "22.1.8",
    command: ["clang", ...clangArgs].join(" "),
    target: "wasm32-unknown-unknown",
    optimization: "-O3",
    initialMemoryBytes: 262144,
    maximumMemoryBytes: 262144,
  },
  catalogAnchor: await file("catalog/workloads.v1.json"),
  sources: await Promise.all([
    file("benchmarks/v1/network-http2-quic-state/engine.js"),
    file("benchmarks/v1/network-http2-quic-state/fixture.js"),
    file("benchmarks/v1/network-http2-quic-state/network-http2-quic-state.c"),
    file("scripts/build-network-http2-quic-state.ts"),
  ]),
  artifacts: await Promise.all([
    file("public/artifacts/network-http2-quic-state/network-http2-quic-state.wasm"),
    file("public/artifacts/network-http2-quic-state/trace.bin"),
    file("public/artifacts/network-http2-quic-state/expected-state.u32le"),
  ]),
  malformedFixtures: await Promise.all(
    makeMalformedTraces().map(async (bytes, index) => ({
      id: `malformed-${index + 1}`,
      bytes: bytes.length,
      sha256: await hash(bytes),
      expectedErrors: runProtocolTrace(bytes)[31],
    })),
  ),
};
await Deno.writeTextFile(
  new URL("build-manifest.json", artifactDir),
  JSON.stringify(manifest, null, 2) + "\n",
);
console.log(
  JSON.stringify({
    fixtureBytes: fixture.length,
    expectedEvents: expected[30],
    errors: expected[31],
  }),
);
