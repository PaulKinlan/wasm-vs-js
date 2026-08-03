#include <stdint.h>

#define INPUT_CAPACITY 1048576u
#define PAGE_COUNT 100u
#define TEXT_CAPACITY 64u
#define FONT_BYTES 896u
#define WIDTH 1224u
#define HEIGHT 1584u
#define RGBA_BYTES (WIDTH * HEIGHT * 4u)

static uint8_t input_bytes[INPUT_CAPACITY];
static uint8_t font_bytes[FONT_BYTES];
static uint8_t page_text[PAGE_COUNT][TEXT_CAPACITY];
static uint32_t page_lengths[PAGE_COUNT];
static uint32_t hit_pages[PAGE_COUNT];
static uint32_t hits;
static uint32_t counters[9];
static uint8_t rgba[RGBA_BYTES];
static uint32_t last_error;

__attribute__((export_name("input_ptr"))) uint32_t input_ptr(void) { return (uint32_t)(uintptr_t)input_bytes; }
__attribute__((export_name("rgba_ptr"))) uint32_t rgba_ptr(void) { return (uint32_t)(uintptr_t)rgba; }
__attribute__((export_name("counters_ptr"))) uint32_t counters_ptr(void) { return (uint32_t)(uintptr_t)counters; }
__attribute__((export_name("error_code"))) uint32_t error_code(void) { return last_error; }
__attribute__((export_name("page_count"))) uint32_t page_count(void) { return counters[1]; }
__attribute__((export_name("hit_count"))) uint32_t hit_count(void) { return hits; }
__attribute__((export_name("hit_page"))) uint32_t hit_page(uint32_t index) { return index < hits ? hit_pages[index] : 0; }
__attribute__((export_name("text_ptr"))) uint32_t text_ptr(uint32_t page) { return page < PAGE_COUNT ? (uint32_t)(uintptr_t)page_text[page] : 0; }
__attribute__((export_name("text_len"))) uint32_t text_len(uint32_t page) { return page < PAGE_COUNT ? page_lengths[page] : 0; }

static int bytes_equal(uint32_t at, uint32_t length, const char *needle, uint32_t nlen) {
  if (at + nlen > length) return 0;
  for (uint32_t i = 0; i < nlen; i++) if (input_bytes[at + i] != (uint8_t)needle[i]) return 0;
  return 1;
}
static uint32_t find(uint32_t start, uint32_t length, const char *needle, uint32_t nlen) {
  for (uint32_t at = start; at + nlen <= length; at++) if (bytes_equal(at, length, needle, nlen)) return at;
  return 0xffffffffu;
}
static int text_equal(uint8_t *text, uint32_t at, const char *needle, uint32_t nlen) {
  for (uint32_t i = 0; i < nlen; i++) if (text[at + i] != (uint8_t)needle[i]) return 0;
  return 1;
}
static int valid_page_text(uint8_t *text, uint32_t length) {
  const char prefix[] = "REPORT PAGE ";
  const char suffix[] = " DOCUMENT BENCHMARK";
  if (length != 34u && length != 41u) return 0;
  for (uint32_t i = 0; i < 12u; i++) if (text[i] != (uint8_t)prefix[i]) return 0;
  for (uint32_t i = 12u; i < 15u; i++) if (text[i] < '0' || text[i] > '9') return 0;
  for (uint32_t i = 0; i < 19u; i++) if (text[15u + i] != (uint8_t)suffix[i]) return 0;
  if (length == 41u) {
    const char needle[] = " NEEDLE";
    for (uint32_t i = 0; i < 7u; i++) if (text[34u + i] != (uint8_t)needle[i]) return 0;
  }
  return 1;
}

__attribute__((export_name("parse"))) uint32_t parse(uint32_t length) {
  last_error = 0; hits = 0;
  for (uint32_t i = 0; i < 9u; i++) counters[i] = 0;
  if (length < 1024u || length > INPUT_CAPACITY || !bytes_equal(0, length, "%PDF-1.7", 8u)) return last_error = 1;
  if (find(0, length, "/Type /Catalog", 14u) == 0xffffffffu ||
      find(0, length, "/Count 100", 10u) == 0xffffffffu ||
      find(0, length, "startxref", 9u) == 0xffffffffu) return last_error = 2;
  uint32_t at = 0;
  while ((at = find(at, length, " obj\n", 5u)) != 0xffffffffu) { counters[0]++; at += 5u; }
  const char font_marker[] = "%%PDFBASEFONT\n";
  uint32_t font_at = find(0, length, font_marker, 14u);
  if (font_at == 0xffffffffu || font_at + 14u + FONT_BYTES > length) return last_error = 3;
  for (uint32_t i = 0; i < FONT_BYTES; i++) font_bytes[i] = input_bytes[font_at + 14u + i];

  const char stream_marker[] = "stream\nBT /F1 18 Tf 36 750 Td (";
  uint32_t cursor = 0, pages = 0, glyphs = 0, comparisons = 0;
  while ((cursor = find(cursor, length, stream_marker, 31u)) != 0xffffffffu) {
    if (pages >= PAGE_COUNT) return last_error = 4;
    uint32_t start = cursor + 31u;
    uint32_t end = find(start, length, ") Tj ET", 7u);
    if (end == 0xffffffffu || end - start >= TEXT_CAPACITY) return last_error = 5;
    uint32_t text_length = end - start;
    for (uint32_t i = 0; i < text_length; i++) page_text[pages][i] = input_bytes[start + i];
    page_lengths[pages] = text_length;
    if (!valid_page_text(page_text[pages], text_length)) return last_error = 6;
    uint32_t found = 0;
    if (text_length >= 6u) for (uint32_t i = 0; i + 6u <= text_length; i++) {
      comparisons++;
      if (text_equal(page_text[pages], i, "NEEDLE", 6u)) found = 1;
    }
    if (found) hit_pages[hits++] = pages + 1u;
    glyphs += text_length; pages++; cursor = end + 7u;
  }
  if (pages != PAGE_COUNT || hits != 10u) return last_error = 7;
  for (uint32_t i = 0; i < hits; i++) if (hit_pages[i] != (i + 1u) * 10u) return last_error = 8;
  counters[1] = pages; counters[2] = glyphs; counters[3] = comparisons;
  counters[4] = 0; counters[5] = WIDTH; counters[6] = HEIGHT; counters[7] = 3;
  counters[8] = RGBA_BYTES > length ? RGBA_BYTES : length;
  return 0;
}

static int raster_page_allowed(uint32_t page) {
  return page == 1u || page == 25u || page == 50u || page == 75u || page == 100u;
}
__attribute__((export_name("render_page"))) uint32_t render_page(uint32_t page) {
  if (!raster_page_allowed(page) || counters[1] != PAGE_COUNT) return last_error = 9;
  for (uint32_t i = 0; i < RGBA_BYTES; i++) rgba[i] = 255u;
  uint32_t x = 72u, y = 100u, scale = 4u;
  uint8_t *text = page_text[page - 1u];
  for (uint32_t g = 0; g < page_lengths[page - 1u]; g++) {
    uint32_t code = text[g];
    if (code > 127u) return last_error = 10;
    for (uint32_t row = 0; row < 7u; row++) {
      uint8_t bits = font_bytes[code * 7u + row];
      for (uint32_t col = 0; col < 5u; col++) if ((bits >> (4u - col)) & 1u) {
        for (uint32_t dy = 0; dy < scale; dy++) for (uint32_t dx = 0; dx < scale; dx++) {
          uint32_t px = x + col * scale + dx, py = y + row * scale + dy;
          uint32_t out = (py * WIDTH + px) * 4u;
          rgba[out] = rgba[out + 1u] = rgba[out + 2u] = 0u;
        }
      }
    }
    x += 6u * scale;
  }
  counters[4]++; counters[7]++;
  return 0;
}
