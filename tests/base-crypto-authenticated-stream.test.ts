import { createCipheriv } from "node:crypto";
import { sha256Hex } from "../lib/canonical.ts";
import { assert, assertEquals } from "./assert.ts";
import {
  bytesEqual,
  instantiateAeadWasm,
  openJavaScript,
  openWasm,
  sealJavaScript,
  sealWasm,
} from "../benchmarks/base/crypto-authenticated-stream/engine.js";
import {
  FRAME_COUNT,
  frameAt,
  KEY,
  runWorkload,
} from "../benchmarks/base/crypto-authenticated-stream/workload.js";
import { createHandler } from "../server.ts";

const root = new URL("../", import.meta.url);
const artifactPath = new URL(
  "public/artifacts/crypto-authenticated-stream/crypto-authenticated-stream.wasm",
  root,
);
const EXPECTED_CIPHER = "06b75286641e962d781a1c3e541fdf0b7c94d64cf928b8574c5045ca6c5a9ab3";
const EXPECTED_PLAIN = "8c22c94117cb9191cac679e502e65548a6e7f1eb6cf15a2e234702cacb2728ae";

Deno.test("crypto authenticated stream leaves frozen catalog v1 byte-identical", async () => {
  const catalog = await Deno.readFile(new URL("catalog/workloads.v1.json", root));
  const derivative = await Deno.readFile(new URL("public/data/workloads.v1.json", root));
  assertEquals(
    await sha256Hex(catalog),
    "6665664f984683e5b7d3fdc8c1602198124844704c224a526d48be2f02edf9d4",
  );
  assert(bytesEqual(catalog, derivative));
});

Deno.test("controlled JavaScript and Wasm agree with independent Node ChaCha20-Poly1305", async () => {
  const wasm = await instantiateAeadWasm(await Deno.readFile(artifactPath));
  for (const index of [0, 1, 15, 16, 17, 31, 32, 63, 64, 65, 127, 128, 255, 256, 511, 9999]) {
    const frame = frameAt(index);
    const js = sealJavaScript(KEY, frame.nonce, frame.aad, frame.plaintext);
    const linear = sealWasm(wasm, KEY, frame.nonce, frame.aad, frame.plaintext);
    const native = createCipheriv("chacha20-poly1305", KEY, frame.nonce, { authTagLength: 16 });
    native.setAAD(frame.aad, { plaintextLength: frame.plaintext.length });
    const nativeCipher = new Uint8Array(
      Buffer.concat([native.update(frame.plaintext), native.final()]),
    );
    const nativeTag = new Uint8Array(native.getAuthTag());
    assert(bytesEqual(js.ciphertext, nativeCipher), `JS ciphertext ${index}`);
    assert(bytesEqual(js.tag, nativeTag), `JS tag ${index}`);
    assert(bytesEqual(linear.ciphertext, nativeCipher), `Wasm ciphertext ${index}`);
    assert(bytesEqual(linear.tag, nativeTag), `Wasm tag ${index}`);
    assert(
      bytesEqual(
        openJavaScript(KEY, frame.nonce, frame.aad, js.ciphertext, js.tag)!,
        frame.plaintext,
      ),
    );
    assert(
      bytesEqual(
        openWasm(wasm, KEY, frame.nonce, frame.aad, linear.ciphertext, linear.tag)!,
        frame.plaintext,
      ),
    );
  }
});

Deno.test("both controlled targets execute exact 10,000-frame contract", async () => {
  const wasmBytes = await Deno.readFile(artifactPath);
  const js = await runWorkload("js-controlled", wasmBytes, FRAME_COUNT);
  const linear = await runWorkload("wasm-linear-controlled", wasmBytes, FRAME_COUNT);
  for (const result of [js, linear]) {
    assertEquals(result.cipherTranscriptSha256, EXPECTED_CIPHER);
    assertEquals(result.plaintextTranscriptSha256, EXPECTED_PLAIN);
    assertEquals(result.counters.frames, 10000);
    assertEquals(result.counters.payloadBytes, 1628125);
    assertEquals(result.counters.chacha20Blocks, 77500);
    assertEquals(result.counters.poly1305Blocks, 267500);
    assertEquals(result.counters.tamperRejections, 12);
    assertEquals(result.oracle.nonceReuse, 0);
    assert(result.oracle.allTagsVerifiedBeforeOpen);
  }
  assertEquals(js.counters.boundaryCrossings, 0);
  assertEquals(linear.counters.boundaryCrossings, 20012);
  assertEquals(js.cipherTranscriptSha256, linear.cipherTranscriptSha256);
});

Deno.test("changed ciphertext, tag, AAD, nonce, and key are rejected", async () => {
  const wasm = await instantiateAeadWasm(await Deno.readFile(artifactPath));
  const frame = frameAt(511);
  const sealed = sealJavaScript(KEY, frame.nonce, frame.aad, frame.plaintext);
  const cases = [
    {
      key: KEY,
      nonce: frame.nonce,
      aad: frame.aad,
      cipher: sealed.ciphertext,
      tag: sealed.tag,
      field: "tag",
    },
    {
      key: KEY,
      nonce: frame.nonce,
      aad: frame.aad,
      cipher: sealed.ciphertext,
      tag: sealed.tag,
      field: "cipher",
    },
    {
      key: KEY,
      nonce: frame.nonce,
      aad: frame.aad,
      cipher: sealed.ciphertext,
      tag: sealed.tag,
      field: "aad",
    },
    {
      key: KEY,
      nonce: frame.nonce,
      aad: frame.aad,
      cipher: sealed.ciphertext,
      tag: sealed.tag,
      field: "nonce",
    },
    {
      key: KEY,
      nonce: frame.nonce,
      aad: frame.aad,
      cipher: sealed.ciphertext,
      tag: sealed.tag,
      field: "key",
    },
  ];
  for (const testCase of cases) {
    const key = testCase.key.slice(), nonce = testCase.nonce.slice(), aad = testCase.aad.slice();
    const cipher = testCase.cipher.slice(), tag = testCase.tag.slice();
    const target = { key, nonce, aad, cipher, tag }[testCase.field as "key"];
    if (target.length) target[0] ^= 1;
    else tag[0] ^= 1;
    assertEquals(openJavaScript(key, nonce, aad, cipher, tag), null);
    assertEquals(openWasm(wasm, key, nonce, aad, cipher, tag), null);
  }
});

Deno.test("registration uses download-only RFC provenance and generated redistributable fixtures", async () => {
  const registration = JSON.parse(
    await Deno.readTextFile(
      new URL("benchmarks/base/crypto-authenticated-stream/registration.v1.json", root),
    ),
  );
  assertEquals(registration.catalogMutation, false);
  assertEquals(registration.fixedWork.frames, 10000);
  assertEquals(registration.fixtureRights.standardsVectors.bundled, false);
  assertEquals(registration.fixtureRights.standardsVectors.redistribution, "download-recipe-only");
  assertEquals(
    registration.fixtureRights.standardsVectors.sourceSha256,
    "25bef70fbf7a07ff45c2fe4cb7c6ce954eac687413d8610603268b4e4415324c",
  );
  assertEquals(registration.fixtureRights.generatedPayloads.licenseSpdx, "CC0-1.0");
});

Deno.test("pinned source graph and builder reproduce every public artifact byte", async () => {
  const manifestPath = new URL(
    "public/artifacts/crypto-authenticated-stream/build-manifest.json",
    root,
  );
  const manifest = JSON.parse(await Deno.readTextFile(manifestPath));
  assertEquals(manifest.sourceCommit, "955b845f46c882b0897df352c29dd76dbb340005");
  for (const source of manifest.sources) {
    const output = await new Deno.Command("git", {
      args: ["show", `${manifest.sourceCommit}:${source.path}`],
      cwd: root.pathname,
      stdout: "piped",
      stderr: "piped",
    }).output();
    assert(output.success, `missing source at pinned commit: ${source.path}`);
    assertEquals(await sha256Hex(output.stdout), source.sha256);
  }
  const paths = [
    "public/artifacts/crypto-authenticated-stream/crypto-authenticated-stream.wasm",
    "public/artifacts/crypto-authenticated-stream/build-manifest.json",
    "public/artifacts/crypto-authenticated-stream/fixture-manifest.json",
    "public/artifacts/crypto-authenticated-stream/output-manifest.json",
    "public/evidence/base/crypto-authenticated-stream/js-controlled.json",
    "public/evidence/base/crypto-authenticated-stream/wasm-linear-controlled.json",
  ];
  const before = await Promise.all(
    paths.map(async (path) => sha256Hex(await Deno.readFile(new URL(path, root)))),
  );
  const result = await new Deno.Command(Deno.execPath(), {
    args: [
      "run",
      "--allow-read=.",
      "--allow-write=public/artifacts/crypto-authenticated-stream,public/evidence/base/crypto-authenticated-stream",
      "--allow-run=clang,wasm-ld",
      "scripts/build-crypto-authenticated-stream.ts",
    ],
    cwd: root.pathname,
    stdout: "piped",
    stderr: "piped",
  }).output();
  assert(result.success, new TextDecoder().decode(result.stderr));
  await Deno.chmod(
    new URL("public/artifacts/crypto-authenticated-stream/crypto-authenticated-stream.wasm", root),
    0o644,
  );
  const after = await Promise.all(
    paths.map(async (path) => sha256Hex(await Deno.readFile(new URL(path, root)))),
  );
  assertEquals(after, before);
});

Deno.test("public routes are closed, read-only, and content typed", async () => {
  const handler = createHandler(null, "public");
  for (
    const [path, contentType] of [
      ["/benchmarks/crypto-authenticated-stream/", "text/html; charset=utf-8"],
      ["/crypto-authenticated-stream-demo.js", "text/javascript; charset=utf-8"],
      ["/crypto-authenticated-stream-worker.js", "text/javascript; charset=utf-8"],
      [
        "/benchmarks/base/crypto-authenticated-stream/workload.js",
        "text/javascript; charset=utf-8",
      ],
      [
        "/artifacts/crypto-authenticated-stream/crypto-authenticated-stream.wasm",
        "application/wasm",
      ],
      [
        "/artifacts/crypto-authenticated-stream/build-manifest.json",
        "application/json; charset=utf-8",
      ],
    ]
  ) {
    const response = await handler(new Request(`http://local.test${path}`));
    assertEquals(response.status, 200);
    assertEquals(response.headers.get("content-type"), contentType);
  }
  assertEquals(
    (await handler(
      new Request("http://local.test/benchmarks/crypto-authenticated-stream/", { method: "POST" }),
    )).status,
    403,
  );
  assertEquals(
    (await handler(
      new Request("http://local.test/artifacts/crypto-authenticated-stream/not-listed"),
    )).status,
    404,
  );
});

Deno.test("demo lifecycle uses fresh workers, tokens, timeout, cancellation and pagehide cleanup", async () => {
  const runner = await Deno.readTextFile(
    new URL("public/crypto-authenticated-stream-demo.js", root),
  );
  assert(
    runner.includes('new Worker("/crypto-authenticated-stream-worker.js", { type: "module" })'),
  );
  assert(runner.includes("event.data?.token !== active.token"));
  assert(runner.includes("setTimeout"));
  assert(runner.includes("worker.terminate()"));
  assert(runner.includes('addEventListener("pagehide"'));
  const page = await Deno.readTextFile(
    new URL("public/benchmarks/crypto-authenticated-stream/index.html", root),
  );
  assert(page.includes('role="status"'));
  assert(page.includes("No performance or constant-time claim."));
  assert(page.includes("stores and uploads nothing"));
});
