export const OLAP = Object.freeze({
  workloadId: "database.olap-chart.v1",
  seed: 0x91e10da5,
  rows: 10_000,
  queries: 5,
  categories: 16,
  topRows: 8,
  rowWords: 6,
  queryWords: 6,
  magic: 0x50414c4f,
});

const QUERY_TRACE = Object.freeze([
  Object.freeze([0xff, 0xffff, 0, 0, 0, 1]),
  Object.freeze([0x55, 0x0f0f, 30, 1, 0, 2]),
  Object.freeze([0xaa, 0xf0f0, 55, 0, 1, 3]),
  Object.freeze([0x0f, 0x3333, 20, 1, 1, 4]),
  Object.freeze([0xf0, 0xcccc, 70, 0, 0, 5]),
]);

function next(value) {
  value ^= value << 13;
  value ^= value >>> 17;
  value ^= value << 5;
  return value >>> 0;
}

export function generateOlapFixture() {
  const headerWords = 8;
  const words = new Uint32Array(
    headerWords + OLAP.rows * OLAP.rowWords + OLAP.queries * OLAP.queryWords,
  );
  words.set([
    OLAP.magic,
    1,
    OLAP.rows,
    OLAP.queries,
    OLAP.categories,
    OLAP.topRows,
    OLAP.rowWords,
    OLAP.queryWords,
  ]);
  let state = OLAP.seed;
  for (let row = 0; row < OLAP.rows; row += 1) {
    state = next(state);
    const region = state & 7;
    const category = (state >>> 4) & 15;
    const year = 2020 + ((state >>> 9) % 5);
    state = next(state);
    const units = 1 + (state % 250);
    state = next(state);
    const revenueCents = (500 + (state % 50_000)) * units;
    const values = [row, region, category, year, units, revenueCents >>> 0];
    for (let column = 0; column < OLAP.rowWords; column += 1) {
      words[headerWords + column * OLAP.rows + row] = values[column];
    }
  }
  let offset = headerWords + OLAP.rows * OLAP.rowWords;
  for (const query of QUERY_TRACE) {
    words.set(query, offset);
    offset += OLAP.queryWords;
  }
  return new Uint8Array(words.buffer);
}

export function fixtureWords(bytes) {
  if (!(bytes instanceof Uint8Array) || bytes.byteOffset % 4 !== 0 || bytes.byteLength % 4 !== 0) {
    throw new Error("fixture must be an aligned Uint8Array of u32 words");
  }
  const words = new Uint32Array(bytes.buffer, bytes.byteOffset, bytes.byteLength / 4);
  const expected = generateOlapFixture();
  if (bytes.byteLength !== expected.byteLength) throw new Error("fixture length mismatch");
  const canonical = new Uint32Array(expected.buffer);
  for (let i = 0; i < words.length; i += 1) {
    if (words[i] !== canonical[i]) throw new Error(`fixture mismatch at word ${i}`);
  }
  return words;
}
