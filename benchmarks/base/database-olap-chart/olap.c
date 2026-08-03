#include <stdint.h>

#define ROWS 10000u
#define QUERIES 5u
#define CATEGORIES 16u
#define TOP 8u
#define ROW_WORDS 6u
#define QUERY_WORDS 6u
#define HEADER 8u
#define OUT_PER_QUERY 112u
#define OUTPUT_WORDS (QUERIES * OUT_PER_QUERY)
#define MAGIC 0x50414c4fu

static uint32_t input_words[HEADER + ROWS * ROW_WORDS + QUERIES * QUERY_WORDS];
static uint32_t result_words[OUTPUT_WORDS];
static uint32_t indexes[ROWS];
static uint32_t temporary[ROWS];
static uint32_t counters[9];

uint32_t *input_ptr(void) { return input_words; }
uint32_t *result_ptr(void) { return result_words; }
uint32_t counter(uint32_t index) { return index < 9u ? counters[index] : 0u; }

static uint32_t mix(uint32_t hash, uint32_t value) {
  return (hash ^ value) * 0x01000193u;
}
static uint32_t row_key(uint32_t row, uint32_t column) {
  return input_words[HEADER + row * ROW_WORDS + (column == 0u ? 5u : 4u)];
}
static uint32_t before(uint32_t left, uint32_t right, uint32_t column, uint32_t descending) {
  uint32_t a = row_key(left, column), b = row_key(right, column);
  if (a != b) return descending ? a > b : a < b;
  return left < right;
}
static void stable_sort(uint32_t length, uint32_t column, uint32_t descending) {
  for (uint32_t width = 1u; width < length; width *= 2u) {
    for (uint32_t left = 0u; left < length; left += width * 2u) {
      uint32_t mid = left + width < length ? left + width : length;
      uint32_t right = left + width * 2u < length ? left + width * 2u : length;
      uint32_t i = left, j = mid, out = left;
      while (i < mid && j < right) {
        counters[4]++;
        temporary[out++] = before(indexes[i], indexes[j], column, descending) ? indexes[i++] : indexes[j++];
      }
      while (i < mid) temporary[out++] = indexes[i++];
      while (j < right) temporary[out++] = indexes[j++];
      for (uint32_t k = left; k < right; k++) indexes[k] = temporary[k];
    }
  }
}

uint32_t run(uint32_t byte_length) {
  const uint32_t expected = (HEADER + ROWS * ROW_WORDS + QUERIES * QUERY_WORDS) * 4u;
  if (byte_length != expected || input_words[0] != MAGIC || input_words[1] != 1u ||
      input_words[2] != ROWS || input_words[3] != QUERIES ||
      input_words[4] != CATEGORIES || input_words[5] != TOP ||
      input_words[6] != ROW_WORDS || input_words[7] != QUERY_WORDS) return 0u;
  for (uint32_t i = 0; i < 9u; i++) counters[i] = 0u;
  counters[0] = QUERIES;
  counters[6] = QUERIES * CATEGORIES;
  counters[7] = QUERIES * TOP;
  counters[8] = OUTPUT_WORDS;
  const uint32_t query_start = HEADER + ROWS * ROW_WORDS;
  for (uint32_t q = 0u; q < QUERIES; q++) {
    uint32_t qp = query_start + q * QUERY_WORDS;
    uint32_t region_mask = input_words[qp], category_mask = input_words[qp + 1u];
    uint32_t min_units = input_words[qp + 2u], descending = input_words[qp + 3u];
    uint32_t sort_column = input_words[qp + 4u], revision = input_words[qp + 5u];
    uint32_t count[CATEGORIES];
    uint64_t units[CATEGORIES], revenue[CATEGORIES];
    for (uint32_t b = 0; b < CATEGORIES; b++) { count[b] = 0u; units[b] = 0u; revenue[b] = 0u; }
    uint32_t matched = 0u, filter_digest = 0x811c9dc5u;
    for (uint32_t row = 0u; row < ROWS; row++) {
      uint32_t base = HEADER + row * ROW_WORDS;
      uint32_t region = input_words[base + 1u], category = input_words[base + 2u], amount = input_words[base + 4u];
      counters[1]++; counters[2] += 3u;
      if (((region_mask >> region) & 1u) == 0u || ((category_mask >> category) & 1u) == 0u || amount < min_units) continue;
      indexes[matched++] = row;
      counters[3]++; counters[5]++;
      filter_digest = mix(filter_digest, row);
      count[category]++;
      units[category] += amount;
      revenue[category] += input_words[base + 5u];
    }
    stable_sort(matched, sort_column, descending);
    uint32_t out = q * OUT_PER_QUERY;
    result_words[out++] = q; result_words[out++] = matched; result_words[out++] = sort_column;
    result_words[out++] = descending; result_words[out++] = filter_digest; result_words[out++] = TOP;
    result_words[out++] = CATEGORIES; result_words[out++] = revision;
    for (uint32_t i = 0u; i < TOP; i++) {
      uint32_t row = indexes[i], base = HEADER + row * ROW_WORDS;
      result_words[out++] = row; result_words[out++] = input_words[base + 4u]; result_words[out++] = input_words[base + 5u];
    }
    for (uint32_t b = 0u; b < CATEGORIES; b++) {
      result_words[out++] = count[b];
      result_words[out++] = (uint32_t)units[b]; result_words[out++] = (uint32_t)(units[b] >> 32u);
      result_words[out++] = (uint32_t)revenue[b]; result_words[out++] = (uint32_t)(revenue[b] >> 32u);
    }
  }
  return OUTPUT_WORDS;
}
