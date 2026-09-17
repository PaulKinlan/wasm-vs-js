// A workload manifest names the engines its page compares. The adapter in
// multilang-runner.js decides which of them actually get a timed callable, and
// runWorkload skips any engine without one — silently:
//
//   const fn = callables[engine.key]?.[kernel];
//   if (!fn) continue;
//
// So a manifest could list Rust, the page could show Rust in its engine list,
// and Rust could never run. cad-parametric-bracket did exactly that, and
// audio-fft did it for AssemblyScript.
//
// This test reads both sides and requires them to agree.

import { assert } from "./assert.ts";

const ROOT = new URL("../", import.meta.url).pathname;
const RUNNER = await Deno.readTextFile(`${ROOT}public/multilang-runner.js`);

const ALIAS: Record<string, string> = { as: "asc", assemblyscript: "asc" };

interface Manifest {
  workloadId?: string;
  engines?: Array<{ key?: string; kind?: string }>;
}

/** Slice multilang-runner.js into one segment per adapter, keyed by workloadId. */
function adapterBlocks(): Map<string, string> {
  const out = new Map<string, string>();
  const marks: Array<[number, string]> = [];
  const pattern = /"([a-z0-9.\-]+\.v\d+)":\s*\{\s*\n\s*kernels:/g;
  let match: RegExpExecArray | null;
  while ((match = pattern.exec(RUNNER)) !== null) marks.push([match.index, match[1]]);
  for (let i = 0; i < marks.length; i++) {
    const end = i + 1 < marks.length ? marks[i + 1][0] : RUNNER.length;
    out.set(marks[i][1], RUNNER.slice(marks[i][0], end));
  }
  return out;
}

/** Engine keys the adapter builds a callable for, or null if it enumerates. */
function builtEngines(
  segment: string,
  engines: Array<{ key?: string; kind?: string }>,
): Set<string> | null {
  // An adapter that walks mods.engines covers whatever the manifest declares.
  if (segment.includes("Object.keys(mods.engines)")) return null;
  const built = new Set<string>();
  for (const m of segment.matchAll(/for \(const key of \[([^\]]+)\]\)/g)) {
    for (const k of m[1].matchAll(/"([a-z]+)"/g)) built.add(ALIAS[k[1]] ?? k[1]);
  }
  for (const m of segment.matchAll(/callables\.([a-z]+)\s*=/g)) built.add(ALIAS[m[1]] ?? m[1]);
  for (const m of segment.matchAll(/callables\["([a-z]+)"\]\s*=/g)) built.add(ALIAS[m[1]] ?? m[1]);
  // An adapter may also walk the loaded engine map filtered by kind, e.g.
  //   for (const [key, loaded] of Object.entries(mods.engines)) {
  //     if (loaded?.cfg?.kind !== "dart") continue;
  // That covers every manifest engine of that kind, including Track B variants
  // such as dart-o3. Resolve it against the manifest instead of exempting the
  // whole adapter, so its other literal engine lists stay checked.
  for (const m of segment.matchAll(/cfg\?\.kind !== "([a-z]+)"/g)) {
    const kind = m[1];
    for (const engine of engines) {
      if (engine.kind === kind && engine.key) built.add(ALIAS[engine.key] ?? engine.key);
    }
  }
  return built;
}

Deno.test("no manifest declares an engine its adapter never runs", async () => {
  const blocks = adapterBlocks();
  assert(blocks.size > 0, "no adapters found in multilang-runner.js");
  const offenders: string[] = [];
  let checked = 0;

  for await (const entry of Deno.readDir(`${ROOT}public/benchmarks/multilang-wasm`)) {
    if (!entry.isFile || !entry.name.endsWith(".manifest.json")) continue;
    const manifest: Manifest = JSON.parse(
      await Deno.readTextFile(`${ROOT}public/benchmarks/multilang-wasm/${entry.name}`),
    );
    const segment = manifest.workloadId ? blocks.get(manifest.workloadId) : undefined;
    if (!segment) continue; // no adapter: the page has no in-browser comparison
    const built = builtEngines(segment, manifest.engines ?? []);
    if (built === null) continue;
    checked++;
    for (const engine of manifest.engines ?? []) {
      const key = ALIAS[engine.key ?? ""] ?? engine.key ?? "";
      if (!key || built.has(key)) continue;
      offenders.push(`${entry.name.replace(".manifest.json", "")} declares "${key}"`);
    }
  }

  assert(checked > 0, "no adapter used a literal engine list — the check would be vacuous");
  assert(
    offenders.length === 0,
    `manifests declaring an engine the adapter never builds: ${offenders.join("; ")}`,
  );
});
