export const BASE_ID = "tooling.minify-format.v1";
export const CATALOG_SHA256 = "6665664f984683e5b7d3fdc8c1602198124844704c224a526d48be2f02edf9d4";
export const TOTAL_BYTES = 5 * 1024 * 1024;
export const LANGUAGES = ["javascript", "css", "html"] as const;
export const OPERATIONS = ["minify", "format"] as const;
export type Language = typeof LANGUAGES[number];
export type Operation = typeof OPERATIONS[number];
export const LANGUAGE_CODE: Record<Language, number> = { javascript: 1, css: 2, html: 3 };
export const OPERATION_CODE: Record<Operation, number> = { minify: 1, format: 2 };
export const FIXTURE_BYTES: Record<Language, number> = {
  javascript: 1_747_626,
  css: 1_747_626,
  html: 1_747_628,
};
export const POLICY = {
  version: "owned-three-language-token-policy-v1",
  admittedGrammar: {
    javascript:
      "program := (comment | const-declaration | single-argument-function)*; expressions := identifier | decimal-integer | quoted-utf8-string | binary-plus; no regex literals, ASI, modules, classes or template interpolation",
    css:
      "stylesheet := (comment | class-rule)*; declarations := color-rgb | quoted-content | integer-px-margin; no at-rules, escapes outside strings, nesting or custom-property token streams",
    html:
      "document := (comment | section)*; section := section[data-id] containing h2 and p text; text admits UTF-8 scalars and literal &amp; entity; no raw-text elements, optional end tags, namespaces or malformed recovery",
  },
  unicode:
    "UTF-8 scalar text is opaque outside ASCII syntax; invalid UTF-8 rejected by host decoder",
  comments: "JS/CSS line and block comments removed; HTML comments removed",
  whitespace:
    "collapsed between word tokens; removed around punctuation; strings preserved byte-for-byte",
  strings: "single/double/backtick quotes with backslash escapes; unterminated strings reject",
  formatting:
    "JS/CSS braces and semicolons create two-space-indented lines; HTML tags create deterministic depth-indented lines",
  sourceMaps: "disabled",
  malformed: "unterminated quote/comment and unbalanced braces/tags reject",
} as const;
