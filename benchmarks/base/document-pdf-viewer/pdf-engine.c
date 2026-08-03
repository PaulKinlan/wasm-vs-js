#include <stdint.h>

#define INPUT_CAPACITY 1048576u
#define PAGE_CAPACITY 128u
#define TEXT_CAPACITY 96u
#define OBJECT_CAPACITY 512u
#define WIDTH 1224u
#define HEIGHT 1584u
#define RGBA_BYTES (WIDTH * HEIGHT * 4u)

static uint8_t input_bytes[INPUT_CAPACITY];
static uint32_t input_length;
static uint32_t object_offsets[OBJECT_CAPACITY];
static uint32_t object_ends[OBJECT_CAPACITY];
static uint32_t object_count;
static uint8_t page_text[PAGE_CAPACITY][TEXT_CAPACITY];
static uint8_t page_codes[PAGE_CAPACITY][TEXT_CAPACITY];
static uint32_t page_lengths[PAGE_CAPACITY];
static uint32_t page_x[PAGE_CAPACITY], page_y[PAGE_CAPACITY], page_font_size[PAGE_CAPACITY];
static uint8_t unicode_map[256], unicode_valid[256];
static uint8_t glyph_rows[256][7];
static uint32_t glyph_widths[256];
static uint32_t hit_pages[PAGE_CAPACITY], hits;
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
__attribute__((export_name("text_ptr"))) uint32_t text_ptr(uint32_t page) { return page < counters[1] ? (uint32_t)(uintptr_t)page_text[page] : 0; }
__attribute__((export_name("text_len"))) uint32_t text_len(uint32_t page) { return page < counters[1] ? page_lengths[page] : 0; }

static int ws(uint8_t c) { return c == 0 || c == 9 || c == 10 || c == 12 || c == 13 || c == 32; }
static int digit(uint8_t c) { return c >= '0' && c <= '9'; }
static int delimiter(uint8_t c) { return ws(c) || c == '/' || c == '<' || c == '>' || c == '[' || c == ']' || c == '(' || c == ')' || c == '%'; }
static void skip_ws(uint32_t *at, uint32_t end) {
  while (*at < end) {
    if (ws(input_bytes[*at])) { (*at)++; continue; }
    if (input_bytes[*at] == '%') { while (*at < end && input_bytes[*at] != '\n' && input_bytes[*at] != '\r') (*at)++; continue; }
    break;
  }
}
static int literal_at(uint32_t at, uint32_t end, const char *text, uint32_t length) {
  if (at + length > end) return 0;
  for (uint32_t i = 0; i < length; i++) if (input_bytes[at + i] != (uint8_t)text[i]) return 0;
  return 1;
}
static uint32_t find_range(uint32_t at, uint32_t end, const char *text, uint32_t length) {
  for (; at + length <= end; at++) if (literal_at(at, end, text, length)) return at;
  return 0xffffffffu;
}
static int read_uint(uint32_t *at, uint32_t end, uint32_t *value) {
  skip_ws(at, end);
  if (*at >= end || !digit(input_bytes[*at])) return 0;
  uint32_t result = 0;
  while (*at < end && digit(input_bytes[*at])) {
    uint32_t next = result * 10u + (uint32_t)(input_bytes[*at] - '0');
    if (next < result) return 0;
    result = next; (*at)++;
  }
  *value = result; return 1;
}
static int read_int(uint32_t *at, uint32_t end, int32_t *value) {
  skip_ws(at, end);
  int negative = 0;
  if (*at < end && input_bytes[*at] == '-') { negative = 1; (*at)++; }
  uint32_t n;
  if (!read_uint(at, end, &n) || n > 0x7fffffffu) return 0;
  *value = negative ? -(int32_t)n : (int32_t)n; return 1;
}
static int match_token(uint32_t *at, uint32_t end, const char *token, uint32_t length) {
  skip_ws(at, end);
  if (!literal_at(*at, end, token, length)) return 0;
  if (*at + length < end && !delimiter(input_bytes[*at + length])) return 0;
  *at += length; return 1;
}
static int key_at(uint32_t at, uint32_t end, const char *key, uint32_t length) {
  return literal_at(at, end, key, length) && (at == 0 || delimiter(input_bytes[at - 1])) &&
    (at + length == end || delimiter(input_bytes[at + length]));
}
static uint32_t find_key(uint32_t start, uint32_t end, const char *key, uint32_t length) {
  for (uint32_t at = start; at + length <= end; at++) if (key_at(at, end, key, length)) return at;
  return 0xffffffffu;
}
static uint32_t find_direct_key(uint32_t start, uint32_t end, const char *key, uint32_t length) {
  skip_ws(&start, end);
  if (!literal_at(start, end, "<<", 2u)) return 0xffffffffu;
  uint32_t depth = 0;
  for (uint32_t at = start; at < end;) {
    if (input_bytes[at] == '%') {
      while (at < end && input_bytes[at] != '\n' && input_bytes[at] != '\r') at++;
      continue;
    }
    if (input_bytes[at] == '(') {
      uint32_t string_depth = 1u; at++;
      while (at < end && string_depth) {
        if (input_bytes[at] == '\\') { at += at + 1u < end ? 2u : 1u; continue; }
        if (input_bytes[at] == '(') string_depth++;
        else if (input_bytes[at] == ')') string_depth--;
        at++;
      }
      if (string_depth) return 0xffffffffu;
      continue;
    }
    if (literal_at(at, end, "<<", 2u)) { depth++; at += 2u; continue; }
    if (literal_at(at, end, ">>", 2u)) {
      if (depth == 0u) return 0xffffffffu;
      depth--; at += 2u;
      if (depth == 0u) return 0xffffffffu;
      continue;
    }
    if (depth == 1u && key_at(at, end, key, length)) return at;
    at++;
  }
  return 0xffffffffu;
}
static int dictionary_after(uint32_t start, uint32_t end, const char *key, uint32_t length, uint32_t *dict_start, uint32_t *dict_end) {
  uint32_t at = find_direct_key(start, end, key, length);
  if (at == 0xffffffffu) return 0;
  at += length; skip_ws(&at, end);
  if (!literal_at(at, end, "<<", 2u)) return 0;
  *dict_start = at;
  uint32_t depth = 0;
  for (; at < end;) {
    if (input_bytes[at] == '(') {
      uint32_t string_depth = 1u; at++;
      while (at < end && string_depth) {
        if (input_bytes[at] == '\\') { at += at + 1u < end ? 2u : 1u; continue; }
        if (input_bytes[at] == '(') string_depth++;
        else if (input_bytes[at] == ')') string_depth--;
        at++;
      }
      if (string_depth) return 0;
      continue;
    }
    if (literal_at(at, end, "<<", 2u)) { depth++; at += 2u; continue; }
    if (literal_at(at, end, ">>", 2u)) {
      if (depth == 0u) return 0;
      depth--; at += 2u;
      if (depth == 0u) { *dict_end = at; return 1; }
      continue;
    }
    at++;
  }
  return 0;
}
static int direct_ref_after(uint32_t start, uint32_t end, const char *key, uint32_t length, uint32_t *id) {
  uint32_t at = find_direct_key(start, end, key, length), generation;
  if (at == 0xffffffffu) return 0;
  at += length;
  return read_uint(&at, end, id) && read_uint(&at, end, &generation) && generation == 0u && match_token(&at, end, "R", 1u);
}
static int ref_after(uint32_t start, uint32_t end, const char *key, uint32_t length, uint32_t *id) {
  uint32_t at = find_key(start, end, key, length), generation;
  if (at == 0xffffffffu) return 0;
  at += length;
  return read_uint(&at, end, id) && read_uint(&at, end, &generation) && generation == 0u && match_token(&at, end, "R", 1u);
}
static int object_range(uint32_t id, uint32_t *start, uint32_t *end) {
  if (id == 0 || id > object_count || object_offsets[id] == 0 || object_ends[id] <= object_offsets[id]) return 0;
  *start = object_offsets[id]; *end = object_ends[id]; return 1;
}
static int object_has(uint32_t id, const char *key, uint32_t klen, const char *name, uint32_t nlen) {
  uint32_t start, end;
  if (!object_range(id, &start, &end)) return 0;
  uint32_t at = find_key(start, end, key, klen);
  if (at == 0xffffffffu) return 0;
  at += klen; skip_ws(&at, end);
  return key_at(at, end, name, nlen);
}
static int stream_range(uint32_t id, uint32_t *start, uint32_t *end) {
  uint32_t os, oe, length, at;
  if (!object_range(id, &os, &oe)) return 0;
  uint32_t length_at = find_key(os, oe, "/Length", 7u);
  uint32_t stream_at = find_range(os, oe, "stream", 6u);
  if (length_at == 0xffffffffu || stream_at == 0xffffffffu) return 0;
  at = length_at + 7u;
  if (!read_uint(&at, oe, &length)) return 0;
  at = stream_at + 6u;
  if (at < oe && input_bytes[at] == '\r') at++;
  if (at >= oe || input_bytes[at++] != '\n' || at + length > oe) return 0;
  *start = at; *end = at + length;
  at += length;
  if (at < oe && input_bytes[at] == '\r') at++;
  if (at < oe && input_bytes[at] == '\n') at++;
  return literal_at(at, oe, "endstream", 9u);
}
static int hex_value(uint8_t c) {
  if (c >= '0' && c <= '9') return c - '0';
  if (c >= 'a' && c <= 'f') return c - 'a' + 10;
  if (c >= 'A' && c <= 'F') return c - 'A' + 10;
  return -1;
}
static int parse_to_unicode(uint32_t id) {
  uint32_t at, end;
  if (!stream_range(id, &at, &end) || find_range(at, end, "begincmap", 9u) == 0xffffffffu ||
      find_range(at, end, "endcmap", 7u) == 0xffffffffu) return 0;
  uint32_t mappings = 0;
  while (at + 11u <= end) {
    if (input_bytes[at] != '<' || input_bytes[at + 3u] != '>') { at++; continue; }
    int a = hex_value(input_bytes[at + 1u]), b = hex_value(input_bytes[at + 2u]);
    uint32_t p = at + 4u; skip_ws(&p, end);
    if (a < 0 || b < 0 || p + 6u > end || input_bytes[p] != '<' || input_bytes[p + 5u] != '>') { at++; continue; }
    int h0 = hex_value(input_bytes[p + 1u]), h1 = hex_value(input_bytes[p + 2u]);
    int h2 = hex_value(input_bytes[p + 3u]), h3 = hex_value(input_bytes[p + 4u]);
    uint32_t code = (uint32_t)(a * 16 + b), scalar = (uint32_t)(h0 * 4096 + h1 * 256 + h2 * 16 + h3);
    if (h0 < 0 || h1 < 0 || h2 < 0 || h3 < 0 || scalar > 127u || unicode_valid[code]) return 0;
    unicode_map[code] = (uint8_t)scalar; unicode_valid[code] = 1; mappings++; at = p + 6u;
  }
  return mappings > 0;
}
static int same_name(uint32_t at, uint32_t length, uint32_t other, uint32_t other_length) {
  if (length != other_length) return 0;
  for (uint32_t i = 0; i < length; i++) if (input_bytes[at + i] != input_bytes[other + i]) return 0;
  return 1;
}
static int charproc_ref(uint32_t cp_start, uint32_t cp_end, uint32_t name_at, uint32_t name_length, uint32_t *id) {
  uint32_t at = cp_start;
  while (at < cp_end) {
    skip_ws(&at, cp_end);
    if (at >= cp_end || input_bytes[at++] != '/') return 0;
    uint32_t start = at;
    while (at < cp_end && !delimiter(input_bytes[at])) at++;
    uint32_t length = at - start, object, generation;
    if (!read_uint(&at, cp_end, &object) || !read_uint(&at, cp_end, &generation) || generation != 0u || !match_token(&at, cp_end, "R", 1u)) return 0;
    if (same_name(start, length, name_at, name_length)) { *id = object; return 1; }
  }
  return 0;
}
static int parse_charproc(uint32_t id, uint32_t code) {
  uint32_t at, end;
  if (!stream_range(id, &at, &end)) return 0;
  int32_t number;
  for (uint32_t i = 0; i < 6u; i++) if (!read_int(&at, end, &number)) return 0;
  if (!match_token(&at, end, "d1", 2u)) return 0;
  while (1) {
    skip_ws(&at, end);
    if (at == end) return 1;
    int32_t x, y, w, h;
    if (!read_int(&at, end, &x) || !read_int(&at, end, &y) || !read_int(&at, end, &w) || !read_int(&at, end, &h) ||
        !match_token(&at, end, "re", 2u) || !match_token(&at, end, "f", 1u)) return 0;
    if (x < 0 || x > 4 || y < 0 || y > 6 || w != 1 || h != 1) return 0;
    glyph_rows[code][6u - (uint32_t)y] |= (uint8_t)(1u << (4u - (uint32_t)x));
  }
}
static int parse_font(uint32_t id) {
  uint32_t start, end, to_unicode;
  if (!object_range(id, &start, &end) || !object_has(id, "/Type", 5u, "/Font", 5u) ||
      !object_has(id, "/Subtype", 8u, "/Type3", 6u) ||
      find_range(start, end, "/FontMatrix [0.125 0 0 0.125 0 0]", 33u) == 0xffffffffu ||
      !ref_after(start, end, "/ToUnicode", 10u, &to_unicode) || !parse_to_unicode(to_unicode)) return 0;
  uint32_t cp = find_key(start, end, "/CharProcs", 10u);
  if (cp == 0xffffffffu) return 0;
  cp = find_range(cp, end, "<<", 2u);
  if (cp == 0xffffffffu) return 0;
  uint32_t cp_end = find_range(cp + 2u, end, ">>", 2u);
  if (cp_end == 0xffffffffu) return 0;
  cp += 2u;
  uint32_t differences = find_key(start, end, "/Differences", 12u);
  if (differences == 0xffffffffu) return 0;
  differences = find_range(differences, end, "[", 1u);
  uint32_t diff_end = find_range(differences + 1u, end, "]", 1u);
  if (differences == 0xffffffffu || diff_end == 0xffffffffu) return 0;
  uint32_t at = differences + 1u, code = 0xffffffffu;
  while (at < diff_end) {
    skip_ws(&at, diff_end);
    if (at >= diff_end) break;
    if (digit(input_bytes[at])) {
      if (!read_uint(&at, diff_end, &code) || code > 255u) return 0;
    } else if (input_bytes[at] == '/') {
      uint32_t name = ++at;
      while (at < diff_end && !delimiter(input_bytes[at])) at++;
      uint32_t proc;
      if (code > 255u || !charproc_ref(cp, cp_end, name, at - name, &proc) || !parse_charproc(proc, code)) return 0;
      code++;
    } else return 0;
  }
  uint32_t first, last;
  uint32_t first_at = find_key(start, end, "/FirstChar", 10u), last_at = find_key(start, end, "/LastChar", 9u);
  if (first_at == 0xffffffffu || last_at == 0xffffffffu) return 0;
  first_at += 10u; last_at += 9u;
  if (!read_uint(&first_at, end, &first) || !read_uint(&last_at, end, &last) || first > last || last > 255u) return 0;
  uint32_t widths = find_key(start, end, "/Widths", 7u);
  widths = widths == 0xffffffffu ? widths : find_range(widths, end, "[", 1u);
  if (widths == 0xffffffffu) return 0;
  at = widths + 1u;
  for (uint32_t c = first; c <= last; c++) if (!read_uint(&at, end, &glyph_widths[c])) return 0;
  skip_ws(&at, end);
  return at < end && input_bytes[at] == ']';
}
static int parse_content(uint32_t id, uint32_t page) {
  uint32_t at, end;
  if (!stream_range(id, &at, &end) || !match_token(&at, end, "BT", 2u)) return 0;
  skip_ws(&at, end);
  if (at >= end || input_bytes[at++] != '/' || !match_token(&at, end, "F1", 2u) ||
      !read_uint(&at, end, &page_font_size[page]) || !match_token(&at, end, "Tf", 2u) ||
      !read_uint(&at, end, &page_x[page]) || !read_uint(&at, end, &page_y[page]) || !match_token(&at, end, "Td", 2u)) return 0;
  skip_ws(&at, end);
  if (at >= end || input_bytes[at++] != '(') return 0;
  uint32_t length = 0;
  while (at < end && input_bytes[at] != ')') {
    uint8_t code = input_bytes[at++];
    if (code == '\\') {
      if (at >= end) return 0;
      code = input_bytes[at++];
    }
    if (length >= TEXT_CAPACITY || !unicode_valid[code]) return 0;
    page_codes[page][length] = code;
    page_text[page][length++] = unicode_map[code];
  }
  if (at >= end || input_bytes[at++] != ')' || !match_token(&at, end, "Tj", 2u) || !match_token(&at, end, "ET", 2u)) return 0;
  skip_ws(&at, end);
  if (at != end) return 0;
  page_lengths[page] = length;
  return 1;
}

__attribute__((export_name("parse"))) uint32_t parse(uint32_t length) {
  last_error = 0; input_length = length; hits = 0;
  for (uint32_t i = 0; i < 9u; i++) counters[i] = 0;
  for (uint32_t i = 0; i < OBJECT_CAPACITY; i++) object_offsets[i] = object_ends[i] = 0;
  for (uint32_t i = 0; i < 256u; i++) {
    unicode_map[i] = unicode_valid[i] = 0; glyph_widths[i] = 0;
    for (uint32_t r = 0; r < 7u; r++) glyph_rows[i][r] = 0;
  }
  if (length < 128u || length > INPUT_CAPACITY || !literal_at(0, length, "%PDF-1.7\n", 9u)) return last_error = 1;
  uint32_t sx = find_range(length > 64u ? length - 64u : 0u, length, "startxref", 9u), xref;
  if (sx == 0xffffffffu) return last_error = 2;
  sx += 9u;
  if (!read_uint(&sx, length, &xref) || xref >= length || !literal_at(xref, length, "xref", 4u)) return last_error = 3;
  uint32_t at = xref + 4u, first, size;
  if (!read_uint(&at, length, &first) || first != 0u || !read_uint(&at, length, &size) || size < 2u || size > OBJECT_CAPACITY) return last_error = 4;
  object_count = size - 1u;
  for (uint32_t id = 0; id < size; id++) {
    uint32_t offset, generation;
    if (!read_uint(&at, length, &offset) || !read_uint(&at, length, &generation)) return last_error = 5;
    skip_ws(&at, length);
    uint8_t state = input_bytes[at++];
    while (at < length && input_bytes[at] != '\n') at++;
    if (at < length) at++;
    if (id == 0u) { if (state != 'f' || generation != 65535u) return last_error = 6; }
    else {
      if (state != 'n' || generation != 0u || offset == 0u || offset >= xref) return last_error = 7;
      object_offsets[id] = offset;
    }
  }
  if (!literal_at(at, length, "trailer", 7u)) return last_error = 8;
  uint32_t trailer_end = find_range(at, length, "startxref", 9u), trailer_size, root, root_generation;
  uint32_t size_key = find_key(at, trailer_end, "/Size", 5u), root_key = find_key(at, trailer_end, "/Root", 5u);
  if (trailer_end == 0xffffffffu || size_key == 0xffffffffu || root_key == 0xffffffffu) return last_error = 9;
  size_key += 5u; root_key += 5u;
  if (!read_uint(&size_key, trailer_end, &trailer_size) || trailer_size != size ||
      !read_uint(&root_key, trailer_end, &root) || !read_uint(&root_key, trailer_end, &root_generation) || root_generation != 0u ||
      !match_token(&root_key, trailer_end, "R", 1u) || root == 0u || root >= size) return last_error = 10;
  for (uint32_t id = 1; id < size; id++) {
    uint32_t p = object_offsets[id], found_id, generation;
    if (!read_uint(&p, xref, &found_id) || found_id != id || !read_uint(&p, xref, &generation) || generation != 0u || !match_token(&p, xref, "obj", 3u)) return last_error = 11;
    uint32_t next = id + 1u < size ? object_offsets[id + 1u] : xref;
    uint32_t close = find_range(p, next, "endobj", 6u);
    if (close == 0xffffffffu) return last_error = 12;
    object_offsets[id] = p; object_ends[id] = close;
  }
  uint32_t root_start, root_end, pages_root;
  if (!object_range(root, &root_start, &root_end) || !object_has(root, "/Type", 5u, "/Catalog", 8u) ||
      !ref_after(root_start, root_end, "/Pages", 6u, &pages_root)) return last_error = 13;
  uint32_t pages_start, pages_end, count;
  if (!object_range(pages_root, &pages_start, &pages_end) || !object_has(pages_root, "/Type", 5u, "/Pages", 6u)) return last_error = 14;
  uint32_t count_at = find_key(pages_start, pages_end, "/Count", 6u), kids = find_key(pages_start, pages_end, "/Kids", 5u);
  if (count_at == 0xffffffffu || kids == 0xffffffffu) return last_error = 15;
  count_at += 6u;
  if (!read_uint(&count_at, pages_end, &count) || count == 0u || count > PAGE_CAPACITY) return last_error = 16;
  kids = find_range(kids, pages_end, "[", 1u);
  if (kids == 0xffffffffu) return last_error = 17;
  kids++;
  uint32_t shared_font = 0;
  for (uint32_t page = 0; page < count; page++) {
    uint32_t page_id, generation;
    if (!read_uint(&kids, pages_end, &page_id) || !read_uint(&kids, pages_end, &generation) || generation != 0u || !match_token(&kids, pages_end, "R", 1u)) return last_error = 18;
    uint32_t ps, pe, parent, contents, font, resources_start, resources_end, fonts_start, fonts_end;
    if (!object_range(page_id, &ps, &pe) || !object_has(page_id, "/Type", 5u, "/Page", 5u) ||
        !ref_after(ps, pe, "/Parent", 7u, &parent) || parent != pages_root ||
        find_range(ps, pe, "/MediaBox [0 0 612 792]", 23u) == 0xffffffffu ||
        !dictionary_after(ps, pe, "/Resources", 10u, &resources_start, &resources_end) ||
        !dictionary_after(resources_start, resources_end, "/Font", 5u, &fonts_start, &fonts_end) ||
        !direct_ref_after(fonts_start, fonts_end, "/F1", 3u, &font) ||
        !ref_after(ps, pe, "/Contents", 9u, &contents)) return last_error = 19;
    if (page == 0u) { shared_font = font; if (!parse_font(font)) return last_error = 20; }
    else if (font != shared_font) return last_error = 21;
    if (!parse_content(contents, page)) return last_error = 22;
  }
  skip_ws(&kids, pages_end);
  if (kids >= pages_end || input_bytes[kids] != ']') return last_error = 23;
  uint32_t glyphs = 0, comparisons = 0;
  for (uint32_t page = 0; page < count; page++) {
    uint32_t found = 0;
    for (uint32_t i = 0; i + 6u <= page_lengths[page]; i++) {
      comparisons++;
      if (page_text[page][i] == 'N' && page_text[page][i + 1u] == 'E' && page_text[page][i + 2u] == 'E' &&
          page_text[page][i + 3u] == 'D' && page_text[page][i + 4u] == 'L' && page_text[page][i + 5u] == 'E') found = 1;
    }
    if (found) hit_pages[hits++] = page + 1u;
    glyphs += page_lengths[page];
  }
  counters[0] = object_count; counters[1] = count; counters[2] = glyphs; counters[3] = comparisons;
  counters[4] = 0; counters[5] = WIDTH; counters[6] = HEIGHT; counters[7] = 1; counters[8] = RGBA_BYTES;
  return 0;
}

static int raster_page_allowed(uint32_t page) { return page == 1u || page == 25u || page == 50u || page == 75u || page == 100u; }
__attribute__((export_name("render_page"))) uint32_t render_page(uint32_t page) {
  if (!raster_page_allowed(page) || page > counters[1]) return last_error = 24;
  for (uint32_t i = 0; i < RGBA_BYTES; i++) rgba[i] = 255u;
  uint32_t index = page - 1u;
  if (page_font_size[index] != 16u) return last_error = 25;
  uint32_t x = page_x[index] * 2u;
  for (uint32_t g = 0; g < page_lengths[index]; g++) {
    uint32_t code = page_codes[index][g];
    if (!unicode_valid[code] || glyph_widths[code] == 0u) return last_error = 26;
    for (uint32_t row = 0; row < 7u; row++) for (uint32_t col = 0; col < 5u; col++) if ((glyph_rows[code][row] >> (4u - col)) & 1u) {
      uint32_t left = x + col * 4u, top = HEIGHT - page_y[index] * 2u - 28u + row * 4u;
      if (left + 4u >= WIDTH || top + 4u >= HEIGHT) return last_error = 27;
      for (uint32_t dy = 0; dy <= 4u; dy++) for (uint32_t dx = 0; dx <= 4u; dx++) {
        uint32_t out = ((top + dy) * WIDTH + left + dx) * 4u;
        rgba[out] = rgba[out + 1u] = rgba[out + 2u] = 0u;
      }
    }
    x += glyph_widths[code] * 4u;
  }
  counters[4]++;
  return 0;
}
