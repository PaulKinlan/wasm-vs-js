import { FIXTURE_BYTES, type Language, LANGUAGES, TOTAL_BYTES } from "./contract.ts";
const enc = new TextEncoder();
function unit(language: Language, i: number): string {
  const u = `東京${i % 97}🚀`;
  if (language === "javascript") {
    return `/*g${i}*/ const v${i} = "${u}"; function f${i}(x){ return x + ${i % 997}; } //e\n`;
  }
  if (language === "css") {
    return `/*g${i}*/ .c${i}{ color: rgb(${i % 255}, ${(i * 3) % 255}, ${
      (i * 7) % 255
    }); content: "${u}"; margin: ${i % 13}px; }\n`;
  }
  return `<!--g${i}--><section data-id="${i}"><h2>${u}</h2><p>safe &amp; text ${i}</p></section>\n`;
}
function padding(language: Language, bytes: number): string {
  if (language === "html") {
    if (bytes < 7) throw new Error("html padding too short");
    return `<!--${"x".repeat(bytes - 7)}-->`;
  }
  if (bytes < 4) throw new Error("comment padding too short");
  return `/*${"x".repeat(bytes - 4)}*/`;
}
export function generateFixture(language: Language): Uint8Array {
  const target = FIXTURE_BYTES[language];
  const parts: string[] = [];
  let length = 0;
  for (let i = 0;; i++) {
    const next = unit(language, i);
    const size = enc.encode(next).byteLength;
    if (length + size + (language === "html" ? 7 : 4) > target) break;
    parts.push(next);
    length += size;
  }
  parts.push(padding(language, target - length));
  const bytes = enc.encode(parts.join(""));
  if (bytes.byteLength !== target) {
    throw new Error(`${language} fixture length ${bytes.byteLength}`);
  }
  return bytes;
}
export function generateAllFixtures(): Record<Language, Uint8Array> {
  const result = Object.fromEntries(LANGUAGES.map((l) => [l, generateFixture(l)])) as Record<
    Language,
    Uint8Array
  >;
  if (Object.values(result).reduce((n, b) => n + b.byteLength, 0) !== TOTAL_BYTES) {
    throw new Error("fixture total mismatch");
  }
  return result;
}
