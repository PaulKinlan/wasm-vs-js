const CORPUS_SEED = [
  "Cafe\u0301 naïve Ångström ﬁancée Straße",
  "İstanbul IĞDIR ıslak Σίσυφος Μάϊος",
  "東京カタカナ 한글 العربية עִבְרִית",
  "क्\u200dषि বাংলা தமிழ் తెలుగు മലയാളം",
  "👩🏽‍🚀 family 👨‍👩‍👧‍👦 flags 🇬🇧🇯🇵",
  "Z\u0351\u0307\u0323 e\u0301 o\u0308 \u1100\u1161\u11a8",
] as const;

export const CORPUS_CODE_POINTS = 65_536;
export const CORPUS_GENERATOR_REVISION = "unicode-editor-corpus-v1";

export function generateUnicodeEditorCorpus(): string {
  const pattern = [...CORPUS_SEED.join("\n")];
  const output: string[] = [];
  for (let index = 0; index < CORPUS_CODE_POINTS; index += 1) {
    output.push(pattern[index % pattern.length]);
  }
  return output.join("");
}

export function codePointCount(value: string): number {
  return [...value].length;
}
