import { canonicalize, sha256Hex } from "../lib/canonical.ts";
import { TRADITIONAL_DEMO_ASSET_PATHS } from "../lib/traditional-demo-registry.ts";

const root = new URL("../", import.meta.url);
const manifestPath = new URL("public/artifacts/traditional-demos/demo-manifest.v1.json", root);
await Deno.mkdir(new URL("public/artifacts/traditional-demos/", root), { recursive: true });
const sourceArgument = Deno.args.length === 1 && Deno.args[0].startsWith("--source-commit=")
  ? Deno.args[0].slice("--source-commit=".length)
  : "";
if (!/^[a-f0-9]{40}$/.test(sourceArgument)) {
  throw new Error("exactly one --source-commit=<40 lowercase hex> argument is required");
}
const sourceCommit = sourceArgument;
async function gitText(args: string[]): Promise<string> {
  const result = await new Deno.Command("git", {
    cwd: new URL(".", root),
    args,
    stdout: "piped",
    stderr: "piped",
  }).output();
  if (!result.success) {
    throw new Error(new TextDecoder().decode(result.stderr) || `git ${args.join(" ")} failed`);
  }
  return new TextDecoder().decode(result.stdout).trim();
}
const sourceTree = await gitText(["rev-parse", `${sourceCommit}^{tree}`]);
if (!/^[a-f0-9]{40}$/.test(sourceTree)) throw new Error("invalid demo source tree");

const bundles = [
  {
    entry: "benchmarks/regex-automata-duel/workload.js",
    output: "public/benchmarks/regex-automata-duel-demo/engine.js",
  },
  {
    entry: "benchmarks/vdom-diff-patch/workload.js",
    output: "public/benchmarks/vdom-diff-patch-demo/engine.js",
  },
] as const;
for (const bundle of bundles) {
  const result = await new Deno.Command(Deno.execPath(), {
    cwd: new URL(".", root),
    args: [
      "bundle",
      "--platform",
      "browser",
      "--format",
      "esm",
      "--no-remote",
      "--frozen",
      bundle.entry,
      "--output",
      bundle.output,
    ],
    stdout: "piped",
    stderr: "piped",
  }).output();
  if (!result.success) {
    throw new Error(new TextDecoder().decode(result.stderr) || `bundle failed: ${bundle.entry}`);
  }
  const outputUrl = new URL(bundle.output, root);
  let browserModule = (await Deno.readTextFile(outputUrl)).replace(/^var /gm, "const ");
  if (bundle.entry === "benchmarks/regex-automata-duel/workload.js") {
    const spread = "matches.push(...found);";
    if (!browserModule.includes(spread)) {
      throw new Error("regex browser compatibility site changed");
    }
    browserModule = browserModule.replace(
      spread,
      "for (const match of found) matches.push(match);",
    );
  }
  await Deno.writeTextFile(outputUrl, browserModule);
  const format = await new Deno.Command(Deno.execPath(), {
    cwd: new URL(".", root),
    args: ["fmt", bundle.output],
    stdout: "piped",
    stderr: "piped",
  }).output();
  if (!format.success) {
    throw new Error(new TextDecoder().decode(format.stderr) || `format failed: ${bundle.output}`);
  }
}

const routeToPath = new Map([
  ["/benchmarks/traditional-demo.css", "public/benchmarks/traditional-demo.css"],
  ["/benchmarks/traditional-demo.js", "public/benchmarks/traditional-demo.js"],
  [
    "/benchmarks/regex-automata-duel-demo/worker.js",
    "public/benchmarks/regex-automata-duel-demo/worker.js",
  ],
  [
    "/benchmarks/regex-automata-duel-demo/engine.js",
    "public/benchmarks/regex-automata-duel-demo/engine.js",
  ],
  [
    "/benchmarks/vdom-diff-patch-demo/worker.js",
    "public/benchmarks/vdom-diff-patch-demo/worker.js",
  ],
  [
    "/benchmarks/vdom-diff-patch-demo/engine.js",
    "public/benchmarks/vdom-diff-patch-demo/engine.js",
  ],
  [
    "/artifacts/regex-automata-duel/regex-automata-duel.wasm",
    "public/artifacts/regex-automata-duel/regex-automata-duel.wasm",
  ],
  [
    "/artifacts/vdom-diff-patch/vdom-diff-patch.wasm",
    "public/artifacts/vdom-diff-patch/vdom-diff-patch.wasm",
  ],
]);
const assets = [];
for (const route of TRADITIONAL_DEMO_ASSET_PATHS) {
  const path = routeToPath.get(route);
  if (!path) throw new Error(`demo asset route is not build-bound: ${route}`);
  const bytes = await Deno.readFile(new URL(path, root));
  assets.push({ path, route, bytes: bytes.byteLength, sha256: await sha256Hex(bytes) });
}

const sourcePaths = [
  "public/benchmarks/index.html",
  "public/benchmarks/regex-automata-duel-demo/index.html",
  "public/benchmarks/vdom-diff-patch-demo/index.html",
  "public/benchmarks/traditional-demo.css",
  "public/benchmarks/traditional-demo.js",
  "public/benchmarks/regex-automata-duel-demo/worker.js",
  "public/benchmarks/vdom-diff-patch-demo/worker.js",
  "benchmarks/regex-automata-duel/benchmark.json",
  "benchmarks/regex-automata-duel/workload.js",
  "benchmarks/regex-automata-duel/input.ts",
  "benchmarks/regex-automata-duel/js-native.ts",
  "benchmarks/regex-automata-duel/js-automata.ts",
  "benchmarks/regex-automata-duel/regex-automata.wat",
  "benchmarks/vdom-diff-patch/benchmark.json",
  "benchmarks/vdom-diff-patch/workload.js",
  "benchmarks/vdom-diff-patch/input.ts",
  "benchmarks/vdom-diff-patch/js.ts",
  "benchmarks/vdom-diff-patch/vdom-diff-patch.wat",
  "public/artifacts/regex-automata-duel/build-manifest.json",
  "public/artifacts/vdom-diff-patch/build-manifest.json",
  "lib/traditional-demo-registry.ts",
  "schemas/traditional-demo-manifest.schema.json",
  "schemas/traditional-demo-browser-evidence.schema.json",
  "scripts/build-traditional-demos.ts",
  "scripts/collect-traditional-demo-evidence.ts",
  "deno.json",
  "deno.lock",
];
const sources = [];
for (const path of sourcePaths) {
  const bytes = await Deno.readFile(new URL(path, root));
  const committed = await new Deno.Command("git", {
    cwd: new URL(".", root),
    args: ["show", `${sourceCommit}:${path}`],
    stdout: "piped",
    stderr: "piped",
  }).output();
  if (!committed.success) throw new Error(`${path} is absent from source commit ${sourceCommit}`);
  if (await sha256Hex(committed.stdout) !== await sha256Hex(bytes)) {
    throw new Error(`${path} differs from recorded source commit ${sourceCommit}`);
  }
  sources.push({ path, bytes: bytes.byteLength, sha256: await sha256Hex(bytes) });
}

const regexJsCounters = {
  codePointsSearched: 20_971_520,
  patternsExecuted: 20,
  matchesFound: 141_605,
  capturesExtracted: 1_623,
  boundaryCrossings: 0,
};
const vdomJsCounters = {
  nodesVisited: 4_000,
  patchesGenerated: 250,
  domMutations: 250,
  boundaryCrossings: 0,
};
const manifest = {
  schemaVersion: 1,
  manifestId: "reduced-traditional-web-demos-v1",
  status: "reduced-out-of-catalog-fixtures",
  catalogV1Coverage: "0/38",
  authoritativePerformanceEvidence: false,
  sourceRepository: "https://github.com/PaulKinlan/wasm-vs-js",
  sourceCommit,
  sourceTree,
  build: {
    command:
      `deno run --allow-read=. --allow-write=public/benchmarks/regex-automata-duel-demo,public/benchmarks/vdom-diff-patch-demo,public/artifacts/traditional-demos --allow-run scripts/build-traditional-demos.ts --source-commit=${sourceCommit}`,
    toolchains: [`Deno ${Deno.version.deno}`],
    reproducible: true,
  },
  demos: [
    {
      demoId: "regex-automata-duel-demo",
      route: "/benchmarks/regex-automata-duel-demo/",
      fixture: {
        corpusBytes: 1_048_576,
        patterns: 20,
        inputSha256: "511c892cd731b740afae39f7c053be4455a6c1cd4a7dd7ac4fc09f92859d072e",
      },
      targets: [
        "js-native-controlled",
        "js-automata-controlled",
        "wasm-automata-controlled",
      ],
      oracle: {
        orderedMatchTupleSha256: "09034692437c8a59f1c82015c0b4e3483de7124ced5d56f1de44eac989b4b3c0",
        countersByTarget: {
          "js-native-controlled": regexJsCounters,
          "js-automata-controlled": regexJsCounters,
          "wasm-automata-controlled": { ...regexJsCounters, boundaryCrossings: 20 },
        },
      },
      fullContract: {
        id: "text.regex-engine-duel.v1",
        status: "unavailable",
        reasonCode: "full-contract-not-implemented",
        requiredCorpusBytes: 33_554_432,
        requiredPatterns: 40,
      },
    },
    {
      demoId: "vdom-diff-patch-demo",
      route: "/benchmarks/vdom-diff-patch-demo/",
      fixture: {
        nodes: 1_000,
        edits: 250,
        inputSha256: "e0cd8896cbcac384c7ca9d2c0bb97d0d15685c5c19038a1f5010159f77a08563",
      },
      targets: ["js-controlled", "wasm-linear-controlled"],
      oracle: {
        patchDigestSha256: "d56d2533821727e9b23af28622fb25b3e26011e2858eb7ab98232e81fafb3afd",
        canonicalHtmlSha256: "172478394b1ba6762f0b8804fe00d5d3b1a1bf52df1c56f5efefa7523e9d1d1c",
        countersByTarget: {
          "js-controlled": vdomJsCounters,
          "wasm-linear-controlled": { ...vdomJsCounters, boundaryCrossings: 1 },
        },
      },
      fullContract: {
        id: "dom.vdom-diff-patch.v1",
        status: "unavailable",
        reasonCode: "full-contract-not-implemented",
        requiredNodes: 10_000,
        requiredEdits: 2_000,
      },
    },
  ],
  assets,
  sources,
  limitations: [
    "These are reduced conformance fixtures, not the full text.regex-engine-duel.v1 or dom.vdom-diff-patch.v1 contracts.",
    "Regex work is fixed at 1 MiB and 20 patterns; virtual-DOM work is fixed at 1,000 nodes and 250 effective edits.",
    "Full-contract availability is typed unavailable with exact unmet 32 MiB/40-pattern and 10,000-node/2,000-edit requirements.",
    "The pages accept no input, persist no data, and expose no upload or mutation route.",
    "The demos publish no durations, performance ranking, accepted corpus result, or general comparative claim.",
  ],
};
await Deno.writeTextFile(manifestPath, `${canonicalize(manifest)}\n`);
console.log(`build:traditional-demos ${assets.length} exact allowlisted assets`);
