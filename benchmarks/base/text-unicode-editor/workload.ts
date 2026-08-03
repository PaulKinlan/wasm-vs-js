export type NormalizationForm = "NFC" | "NFD" | "NFKC" | "NFKD";
export type FoldMode = "default-full" | "default-simple" | "turkic-full" | "turkic-simple";

type Range = readonly [number, number, string];
type FoldMaps = Record<FoldMode, Map<number, readonly number[]>>;

export interface UnicodeTables {
  readonly unicodeVersion: "15.1.0";
  readonly canonicalDecomposition: ReadonlyMap<number, readonly number[]>;
  readonly compatibilityDecomposition: ReadonlyMap<number, readonly number[]>;
  readonly combiningClass: ReadonlyMap<number, number>;
  readonly composition: ReadonlyMap<string, number>;
  readonly graphemeRanges: readonly Range[];
  readonly extendedPictographicRanges: readonly Range[];
  readonly indicConjunctRanges: readonly Range[];
  readonly folds: FoldMaps;
}

export interface UnicodeSourceTexts {
  UnicodeData: string;
  DerivedNormalizationProps: string;
  GraphemeBreakProperty: string;
  emojiData: string;
  DerivedCoreProperties: string;
  CaseFolding: string;
}

export interface WorkCounters {
  "input-code-points": number;
  "output-code-points": number;
  "normalization-decompositions": number;
  "normalization-compositions": number;
  "combining-reorders": number;
  "grapheme-boundaries": number;
  "case-fold-mappings": number;
  "search-comparisons": number;
  "boundary-crossings": number;
  allocations: number;
}

function scalarValues(value: string): number[] {
  const values: number[] = [];
  for (let index = 0; index < value.length; index += 1) {
    const first = value.charCodeAt(index);
    if (first >= 0xd800 && first <= 0xdbff) {
      const second = value.charCodeAt(index + 1);
      if (!(second >= 0xdc00 && second <= 0xdfff)) throw new Error("lone surrogate denied");
      values.push(0x10000 + ((first - 0xd800) << 10) + second - 0xdc00);
      index += 1;
    } else if (first >= 0xdc00 && first <= 0xdfff) {
      throw new Error("lone surrogate denied");
    } else values.push(first);
  }
  return values;
}

function fromScalars(values: readonly number[]): string {
  return String.fromCodePoint(...values);
}

function parseCodePointList(value: string): number[] {
  return value.trim().split(/\s+/).filter(Boolean).map((part) => Number.parseInt(part, 16));
}

function parseRanges(text: string, expectedProperty?: string): Range[] {
  const ranges: Range[] = [];
  for (const raw of text.split("\n")) {
    const line = raw.replace(/#.*/, "").trim();
    if (!line) continue;
    const fields = line.split(";").map((field) => field.trim());
    if (fields.length < 2) continue;
    const property = expectedProperty && fields[1] === expectedProperty ? fields[2] : fields[1];
    if (expectedProperty && fields[1] !== expectedProperty) continue;
    const [first, last = first] = fields[0].split("..");
    ranges.push([Number.parseInt(first, 16), Number.parseInt(last, 16), property]);
  }
  return ranges.sort((a, b) => a[0] - b[0]);
}

function rangeProperty(ranges: readonly Range[], codePoint: number, fallback: string): string {
  let low = 0;
  let high = ranges.length - 1;
  while (low <= high) {
    const middle = (low + high) >>> 1;
    const range = ranges[middle];
    if (codePoint < range[0]) high = middle - 1;
    else if (codePoint > range[1]) low = middle + 1;
    else return range[2];
  }
  return fallback;
}

export function parseUnicodeTables(sources: UnicodeSourceTexts): UnicodeTables {
  const canonical = new Map<number, readonly number[]>();
  const compatibility = new Map<number, readonly number[]>();
  const combining = new Map<number, number>();
  for (const raw of sources.UnicodeData.split("\n")) {
    if (!raw.trim()) continue;
    const fields = raw.split(";");
    if (fields.length < 6) throw new Error("malformed UnicodeData row");
    const codePoint = Number.parseInt(fields[0], 16);
    const ccc = Number.parseInt(fields[3], 10);
    if (ccc) combining.set(codePoint, ccc);
    const decomposition = fields[5].trim();
    if (!decomposition) continue;
    if (decomposition.startsWith("<")) {
      compatibility.set(codePoint, parseCodePointList(decomposition.replace(/^<[^>]+>\s*/, "")));
    } else {
      const values = parseCodePointList(decomposition);
      canonical.set(codePoint, values);
      compatibility.set(codePoint, values);
    }
  }
  const exclusions = new Set<number>();
  for (const raw of sources.DerivedNormalizationProps.split("\n")) {
    const line = raw.replace(/#.*/, "").trim();
    if (!line) continue;
    const [range, property] = line.split(";").map((field) => field.trim());
    if (property !== "Full_Composition_Exclusion") continue;
    const [first, last = first] = range.split("..").map((value) => Number.parseInt(value, 16));
    for (let codePoint = first; codePoint <= last; codePoint += 1) exclusions.add(codePoint);
  }
  const composition = new Map<string, number>();
  for (const [composite, values] of canonical) {
    if (values.length !== 2 || exclusions.has(composite) || (combining.get(values[0]) ?? 0) !== 0) {
      continue;
    }
    composition.set(`${values[0]},${values[1]}`, composite);
  }

  const common = new Map<number, readonly number[]>();
  const full = new Map<number, readonly number[]>();
  const simple = new Map<number, readonly number[]>();
  const turkic = new Map<number, readonly number[]>();
  for (const raw of sources.CaseFolding.split("\n")) {
    const line = raw.replace(/#.*/, "").trim();
    if (!line) continue;
    const [code, status, mapping] = line.split(";").map((field) => field.trim());
    const codePoint = Number.parseInt(code, 16);
    const values = parseCodePointList(mapping);
    if (status === "C") common.set(codePoint, values);
    else if (status === "F") full.set(codePoint, values);
    else if (status === "S") simple.set(codePoint, values);
    else if (status === "T") turkic.set(codePoint, values);
  }
  function foldMap(kind: "full" | "simple", useTurkic: boolean): Map<number, readonly number[]> {
    const map = new Map(common);
    const selected = kind === "full" ? full : simple;
    for (const [key, value] of selected) map.set(key, value);
    if (useTurkic) { for (const [key, value] of turkic) map.set(key, value); }
    return map;
  }
  return {
    unicodeVersion: "15.1.0",
    canonicalDecomposition: canonical,
    compatibilityDecomposition: compatibility,
    combiningClass: combining,
    composition,
    graphemeRanges: parseRanges(sources.GraphemeBreakProperty),
    extendedPictographicRanges: parseRanges(sources.emojiData).filter((range) =>
      range[2] === "Extended_Pictographic"
    ),
    indicConjunctRanges: parseRanges(sources.DerivedCoreProperties, "InCB"),
    folds: {
      "default-full": foldMap("full", false),
      "default-simple": foldMap("simple", false),
      "turkic-full": foldMap("full", true),
      "turkic-simple": foldMap("simple", true),
    },
  };
}

function hangulDecompose(codePoint: number): number[] | null {
  const sBase = 0xac00, lBase = 0x1100, vBase = 0x1161, tBase = 0x11a7;
  const lCount = 19, vCount = 21, tCount = 28, nCount = vCount * tCount;
  const sIndex = codePoint - sBase;
  if (sIndex < 0 || sIndex >= lCount * nCount) return null;
  const l = lBase + Math.floor(sIndex / nCount);
  const v = vBase + Math.floor((sIndex % nCount) / tCount);
  const t = tBase + (sIndex % tCount);
  return t === tBase ? [l, v] : [l, v, t];
}

function hangulCompose(first: number, second: number): number | null {
  const sBase = 0xac00, lBase = 0x1100, vBase = 0x1161, tBase = 0x11a7;
  const lCount = 19, vCount = 21, tCount = 28, nCount = vCount * tCount;
  if (first >= lBase && first < lBase + lCount && second >= vBase && second < vBase + vCount) {
    return sBase + (first - lBase) * nCount + (second - vBase) * tCount;
  }
  const sIndex = first - sBase;
  if (
    sIndex >= 0 && sIndex < lCount * nCount && sIndex % tCount === 0 && second > tBase &&
    second < tBase + tCount
  ) {
    return first + second - tBase;
  }
  return null;
}

function decomposeOne(
  codePoint: number,
  compatibility: boolean,
  tables: UnicodeTables,
  output: number[],
  counters?: WorkCounters,
): void {
  const hangul = hangulDecompose(codePoint);
  const mapping = hangul ??
    (compatibility
      ? tables.compatibilityDecomposition.get(codePoint)
      : tables.canonicalDecomposition.get(codePoint));
  if (!mapping) {
    output.push(codePoint);
    return;
  }
  if (counters) counters["normalization-decompositions"] += 1;
  for (const value of mapping) decomposeOne(value, compatibility, tables, output, counters);
}

function canonicalOrder(values: number[], tables: UnicodeTables, counters?: WorkCounters): void {
  for (let index = 1; index < values.length; index += 1) {
    const ccc = tables.combiningClass.get(values[index]) ?? 0;
    if (ccc === 0) continue;
    let cursor = index;
    while (cursor > 0) {
      const previous = tables.combiningClass.get(values[cursor - 1]) ?? 0;
      if (previous === 0 || previous <= ccc) break;
      [values[cursor - 1], values[cursor]] = [values[cursor], values[cursor - 1]];
      cursor -= 1;
      if (counters) counters["combining-reorders"] += 1;
    }
  }
}

function compose(
  values: readonly number[],
  tables: UnicodeTables,
  counters?: WorkCounters,
): number[] {
  if (values.length === 0) return [];
  const output = [values[0]];
  let starterIndex = 0;
  let starter = values[0];
  let previousCcc = 0;
  for (let index = 1; index < values.length; index += 1) {
    const value = values[index];
    const ccc = tables.combiningClass.get(value) ?? 0;
    const composite = hangulCompose(starter, value) ??
      tables.composition.get(`${starter},${value}`);
    if (composite !== undefined && composite !== null && (previousCcc < ccc || previousCcc === 0)) {
      output[starterIndex] = composite;
      starter = composite;
      if (counters) counters["normalization-compositions"] += 1;
    } else {
      if (ccc === 0) {
        starterIndex = output.length;
        starter = value;
      }
      output.push(value);
      previousCcc = ccc;
    }
  }
  return output;
}

export function normalize(
  value: string,
  form: NormalizationForm,
  tables: UnicodeTables,
  counters?: WorkCounters,
): string {
  const compatibility = form === "NFKC" || form === "NFKD";
  const decomposed: number[] = [];
  for (const codePoint of scalarValues(value)) {
    decomposeOne(codePoint, compatibility, tables, decomposed, counters);
  }
  canonicalOrder(decomposed, tables, counters);
  return fromScalars(
    form === "NFC" || form === "NFKC" ? compose(decomposed, tables, counters) : decomposed,
  );
}

export function caseFold(
  value: string,
  mode: FoldMode,
  tables: UnicodeTables,
  counters?: WorkCounters,
): string {
  const output: number[] = [];
  const map = tables.folds[mode];
  for (const codePoint of scalarValues(value)) {
    const mapping = map.get(codePoint);
    if (mapping) {
      output.push(...mapping);
      if (counters) counters["case-fold-mappings"] += 1;
    } else output.push(codePoint);
  }
  return fromScalars(output);
}

export function graphemeBoundaries(value: string, tables: UnicodeTables): number[] {
  const codePoints = scalarValues(value);
  const properties = codePoints.map((codePoint) =>
    rangeProperty(tables.graphemeRanges, codePoint, "Other")
  );
  const indic = codePoints.map((codePoint) =>
    rangeProperty(tables.indicConjunctRanges, codePoint, "None")
  );
  const pictographic = codePoints.map((codePoint) =>
    rangeProperty(tables.extendedPictographicRanges, codePoint, "No") === "Extended_Pictographic"
  );
  const boundaries = [0];
  for (let index = 1; index < codePoints.length; index += 1) {
    const before = properties[index - 1], after = properties[index];
    let shouldBreak = true;
    if (before === "CR" && after === "LF") shouldBreak = false;
    else if (["Control", "CR", "LF"].includes(before) || ["Control", "CR", "LF"].includes(after)) {
      shouldBreak = true;
    } else if (before === "L" && ["L", "V", "LV", "LVT"].includes(after)) shouldBreak = false;
    else if (["LV", "V"].includes(before) && ["V", "T"].includes(after)) shouldBreak = false;
    else if (["LVT", "T"].includes(before) && after === "T") shouldBreak = false;
    else if (["Extend", "ZWJ"].includes(after) || after === "SpacingMark") shouldBreak = false;
    else if (before === "Prepend") shouldBreak = false;
    else if (indic[index] === "Consonant") {
      let cursor = index - 1;
      let sawLinker = false;
      while (cursor >= 0 && ["Extend", "Linker"].includes(indic[cursor])) {
        if (indic[cursor] === "Linker") sawLinker = true;
        cursor -= 1;
      }
      if (sawLinker && cursor >= 0 && indic[cursor] === "Consonant") shouldBreak = false;
    }
    if (shouldBreak && pictographic[index] && before === "ZWJ") {
      let cursor = index - 2;
      while (cursor >= 0 && properties[cursor] === "Extend") cursor -= 1;
      if (cursor >= 0 && pictographic[cursor]) shouldBreak = false;
    }
    if (shouldBreak && before === "Regional_Indicator" && after === "Regional_Indicator") {
      let count = 0;
      for (
        let cursor = index - 1;
        cursor >= 0 && properties[cursor] === "Regional_Indicator";
        cursor -= 1
      ) count += 1;
      if (count % 2 === 1) shouldBreak = false;
    }
    if (shouldBreak) boundaries.push(index);
  }
  boundaries.push(codePoints.length);
  return boundaries;
}

function emptyCounters(): WorkCounters {
  return {
    "input-code-points": 0,
    "output-code-points": 0,
    "normalization-decompositions": 0,
    "normalization-compositions": 0,
    "combining-reorders": 0,
    "grapheme-boundaries": 0,
    "case-fold-mappings": 0,
    "search-comparisons": 0,
    "boundary-crossings": 0,
    allocations: 6,
  };
}

export function runUnicodeEditor(
  document: string,
  query: string,
  tables: UnicodeTables,
  foldMode: FoldMode = "default-full",
) {
  const counters = emptyCounters();
  counters["input-code-points"] = scalarValues(document).length + scalarValues(query).length;
  const normalized = normalize(document, "NFC", tables, counters);
  const boundaries = graphemeBoundaries(normalized, tables);
  counters["grapheme-boundaries"] = boundaries.length;
  const searchable = normalize(
    caseFold(normalized, foldMode, tables, counters),
    "NFKC",
    tables,
    counters,
  );
  const needle = normalize(caseFold(query, foldMode, tables, counters), "NFKC", tables, counters);
  const haystack = scalarValues(searchable), target = scalarValues(needle);
  const matches: number[] = [];
  for (let index = 0; index + target.length <= haystack.length; index += 1) {
    let matched = true;
    for (let offset = 0; offset < target.length; offset += 1) {
      counters["search-comparisons"] += 1;
      if (haystack[index + offset] !== target[offset]) {
        matched = false;
        break;
      }
    }
    if (matched) matches.push(index);
  }
  counters["output-code-points"] = scalarValues(normalized).length + haystack.length +
    matches.length + boundaries.length;
  return { normalized, searchable, boundaries, matches, counters };
}
