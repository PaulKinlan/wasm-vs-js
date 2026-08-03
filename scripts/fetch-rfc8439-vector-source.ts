import { sha256Hex } from "../lib/canonical.ts";

const url = "https://www.rfc-editor.org/rfc/rfc8439.txt";
const expected = "25bef70fbf7a07ff45c2fe4cb7c6ce954eac687413d8610603268b4e4415324c";
const output = Deno.args[0];
if (!output) throw new Error("usage: fetch-rfc8439-vector-source.ts <private-output-path>");
const response = await fetch(url, { redirect: "error" });
if (!response.ok) throw new Error(`RFC download failed: ${response.status}`);
const bytes = new Uint8Array(await response.arrayBuffer());
const actual = await sha256Hex(bytes);
if (actual !== expected) throw new Error(`RFC byte hash mismatch: ${actual}`);
await Deno.writeFile(output, bytes, { create: true });
console.log(`verified RFC 8439 ${bytes.length} bytes sha256=${actual}; private output=${output}`);
