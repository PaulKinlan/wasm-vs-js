import Ajv2020Module from "ajv2020";
import { sha256Hex } from "../lib/canonical.ts";
import { createHandler } from "../server.ts";
import { assert, assertEquals, assertRejects } from "./assert.ts";
import {
  COUNTER_NAMES,
  generateFixture,
  instantiateSsrWasm,
  parseOutput,
  RECORDS,
  renderJavaScript,
  renderWasm,
  TOKEN_COUNT_PER_RESPONSE,
} from "../benchmarks/v1/server-ssr-template/workload.js";

type Validator = ((value: unknown) => boolean) & { errors?: unknown };
type AjvInstance = { compile: (schema: unknown) => Validator };
type AjvConstructor = new (options?: Record<string, unknown>) => AjvInstance;
const Ajv2020 = Ajv2020Module as unknown as AjvConstructor;
const decoder = new TextDecoder("utf-8", { fatal: true });
const wasmBytes = await Deno.readFile(
  "public/artifacts/base-server-ssr-template/server-ssr-template.wasm",
);

Deno.test("server SSR supplemental registration preserves frozen catalog and validates schema", async () => {
  const expected = "6665664f984683e5b7d3fdc8c1602198124844704c224a526d48be2f02edf9d4";
  assertEquals(await sha256Hex(await Deno.readFile("catalog/workloads.v1.json")), expected);
  assertEquals(await sha256Hex(await Deno.readFile("public/data/workloads.v1.json")), expected);
  const registration = JSON.parse(
    await Deno.readTextFile(
      "catalog/v1-implementation-registrations/server.ssr-template.v1.json",
    ),
  );
  const schema = JSON.parse(
    await Deno.readTextFile("schemas/v1-implementation-registration.schema.json"),
  );
  const validate = new Ajv2020({ strict: true }).compile(schema);
  assert(validate(registration), JSON.stringify(validate.errors));
  assertEquals(registration.workloadId, "server.ssr-template.v1");
  assert(/^[a-f0-9]{40}$/.test(registration.sourceCommit));
  assertEquals(registration.status, "candidate-pending-independent-review");
  assertEquals(
    registration.equivalence.aggregation,
    "excluded-from-algorithm-equivalent-aggregate",
  );
  assertEquals(registration.fixedWork.responses, 1_000);
  assertEquals(registration.fixedWork.grammar.startsWith("23-token"), true);
  assertEquals(
    registration.limitations.some((value: string) => value.includes("no performance")),
    true,
  );
});

Deno.test("server SSR generator is deterministic, framed, multilingual, and fully frozen", async () => {
  const first = generateFixture();
  const second = generateFixture();
  assertEquals([...first], [...second]);
  assertEquals(new DataView(first.buffer).getUint32(0, true), 0x31465353);
  assertEquals(new DataView(first.buffer).getUint32(4, true), RECORDS);
  const manifest = JSON.parse(
    await Deno.readTextFile("public/artifacts/base-server-ssr-template/fixture-manifest.json"),
  );
  assertEquals(first.length, manifest.fixture.bytes);
  assertEquals(await sha256Hex(first), manifest.fixture.sha256);
  assertEquals(manifest.rights.licenseSpdx, "CC0-1.0");
  assertEquals(manifest.rights.redistribution, "permitted");
  const searchable = new TextDecoder().decode(first);
  assert(searchable.includes("東京"));
  assert(searchable.includes("العربية"));
  assert(searchable.includes("<script>blocked()"));
});

Deno.test("server SSR JavaScript and material Wasm render all 1,000 responses byte-identically", async () => {
  const fixture = generateFixture();
  const js = renderJavaScript(fixture);
  const linear = renderWasm(await instantiateSsrWasm(wasmBytes), fixture);
  assertEquals([...linear.output], [...js.output]);
  const responses = parseOutput(js.output);
  assertEquals(responses.length, RECORDS);
  assert(responses.every((value) => value.length > 250));
  const manifest = JSON.parse(
    await Deno.readTextFile("public/artifacts/base-server-ssr-template/output-manifest.json"),
  );
  assertEquals(await sha256Hex(js.output), manifest.reference.sha256);
  assertEquals(js.output.length, manifest.reference.bytes);
  assertEquals(js.counters.responses, 1_000);
  assertEquals(js.counters["parsed-fields"], 7_000);
  assertEquals(js.counters["template-tokens"], RECORDS * TOKEN_COUNT_PER_RESPONSE);
  assertEquals(linear.counters, { ...js.counters, "boundary-crossings": 1 });
  assertEquals(Object.keys(js.counters), COUNTER_NAMES);
});

Deno.test("server SSR contextual escaping prevents markup and URL injection in every response", () => {
  const responses = parseOutput(renderJavaScript(generateFixture()).output).map((value) =>
    decoder.decode(value)
  );
  for (const html of responses) {
    assert(html.startsWith('<!doctype html><html lang="en">'));
    assert(html.endsWith("</article></body></html>"));
    assert(!html.includes("<script>"));
    assert(!html.includes("<img src=x>"));
    assert(!html.includes('aria-label="Catalog for </'));
    const href = html.match(/<a href="([^"]+)">Open<\/a>/u)?.[1] ?? "";
    assert(href.startsWith("/catalog/"));
    assert(!href.includes("<"));
    assert(!href.includes(">"));
    assert(!href.includes(" "));
  }
  const joined = responses.join("\n");
  assert(joined.includes("&lt;script&gt;blocked()&lt;/script&gt;"));
  assert(joined.includes("&quot;"));
  assert(joined.includes("&#39;"));
  assert(joined.includes("%F0%9F%9A%80"));
});

Deno.test("server SSR both targets reject malformed framing, UTF-8, dates, and trailing bytes", async () => {
  const base = generateFixture();
  const cases = [];
  cases.push(base.slice(0, base.length - 1));
  const magic = base.slice();
  magic[0] ^= 0xff;
  cases.push(magic);
  const count = base.slice();
  new DataView(count.buffer).setUint32(4, 999, true);
  cases.push(count);
  const utf8 = base.slice();
  utf8[28] = 0xff;
  cases.push(utf8);
  const badDate = base.slice();
  new DataView(badDate.buffer).setUint32(20, 20261301, true);
  cases.push(badDate);
  const trailing = new Uint8Array(base.length + 1);
  trailing.set(base);
  cases.push(trailing);
  for (const fixture of cases) {
    await assertRejects(() => Promise.resolve(renderJavaScript(fixture)), "");
    const exports = await instantiateSsrWasm(wasmBytes);
    await assertRejects(() => Promise.resolve(renderWasm(exports, fixture)), "");
  }
});

Deno.test("server SSR generated manifest bytes and source/artifact hashes are operative", async () => {
  const registration = JSON.parse(
    await Deno.readTextFile(
      "catalog/v1-implementation-registrations/server.ssr-template.v1.json",
    ),
  );
  for (
    const artifact of Object.values(registration.artifacts) as Array<
      { path: string; sha256: string }
    >
  ) {
    assertEquals(await sha256Hex(await Deno.readFile(artifact.path)), artifact.sha256);
  }
  const build = JSON.parse(
    await Deno.readTextFile("public/artifacts/base-server-ssr-template/build-manifest.json"),
  );
  assert(/^[a-f0-9]{40}$/.test(build.sourceCommit));
  assert(build.sourceCommit !== "0000000000000000000000000000000000000000");
  for (const source of build.sources) {
    const disk = await Deno.readFile(source.path);
    assertEquals(await sha256Hex(disk), source.sha256);
    const tree = await new Deno.Command("git", {
      args: ["show", `${build.sourceCommit}:${source.path}`],
      stdout: "piped",
      stderr: "piped",
    }).output();
    assert(tree.success, `${source.path} absent from source commit`);
    assertEquals(await sha256Hex(tree.stdout), source.sha256);
  }
  assertEquals(await sha256Hex(wasmBytes), build.variants["wasm-linear-controlled"].sha256);
  assertEquals(build.build.deno, "2.9.0");
  assert(build.build.clang.startsWith("clang version 22.1.8"));
});

Deno.test("server SSR public routes are closed, typed, and read-only", async () => {
  const handler = createHandler(null, "public", null);
  const routes = [
    ["/demos/server.ssr-template.v1/", "text/html"],
    ["/base-server-ssr-demo.js", "text/javascript"],
    ["/base-server-ssr-worker.js", "text/javascript"],
    ["/benchmarks/v1/server-ssr-template/workload.js", "text/javascript"],
    ["/data/v1-implementation-registrations/server.ssr-template.v1.json", "application/json"],
    ["/artifacts/base-server-ssr-template/server-ssr-template.wasm", "application/wasm"],
    ["/artifacts/base-server-ssr-template/fixture.bin", "application/octet-stream"],
    ["/artifacts/base-server-ssr-template/reference-output.bin", "application/octet-stream"],
  ];
  for (const [path, type] of routes) {
    const response = await handler(new Request(`http://localhost${path}`));
    assert(response.status === 200, `${path} returned ${response.status}`);
    assert(response.headers.get("content-type")?.startsWith(type), path);
  }
  assertEquals(
    (await handler(
      new Request("http://localhost/demos/server.ssr-template.v1/", { method: "POST" }),
    )).status,
    403,
  );
  assertEquals(
    (await handler(new Request("http://localhost/artifacts/base-server-ssr-template/unknown")))
      .status,
    404,
  );
});

Deno.test("server SSR demo lifecycle uses a fresh worker and handles stale, timeout, cancel, and pagehide", async () => {
  const runner = await Deno.readTextFile("public/base-server-ssr-demo.js");
  const worker = await Deno.readTextFile("public/base-server-ssr-worker.js");
  assert(runner.includes("new Worker"));
  assert(runner.includes("active !== run"));
  assert(runner.includes("30 second exact-run timeout"));
  assert(runner.includes("Cancelled. No result was retained."));
  assert(runner.includes('addEventListener("pagehide"'));
  assert(worker.includes("complete output oracle mismatch"));
  assert(worker.includes("counter ${name}"));
  const page = await Deno.readTextFile("public/demos/server.ssr-template.v1/index.html");
  assert(page.includes('role="status"'));
  assert(page.includes("never uploaded or stored"));
  assert(page.includes("No performance claim."));
});
