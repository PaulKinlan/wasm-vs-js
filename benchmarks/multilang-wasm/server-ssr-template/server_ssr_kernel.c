// server_ssr_kernel.c — multilang compute core for server.ssr-template.v1.
//
// Ports the frozen renderJavaScript() (benchmarks/v1/server-ssr-template/
// workload.js) at the linear-Wasm layer using the shared multilang-wasm
// kernel ABI: the adapter writes the frozen 91,442-byte fixture bytes into
// linear memory at FIXTURE_OFFSET (byte length passed in), the kernel parses
// the 1,000 catalog records + renders every response body byte-for-byte
// bit-identical to renderJavaScript() into OUTPUT_OFFSET, and writes work
// counters + an FNV-1a digest of the entire framed output stream to
// RES_OFFSET. Exports: i32 ssr_render(u32 fixture_len) → 0 ok / negative
// error code.
//
// Results (u32 words at RES_OFFSET):
//   [0] responses (=1000)             [1] parsed_fields (=7000)
//   [2] template_tokens (=23000)      [3] text_escapes (=2000)
//   [4] attribute_escapes (=1000)     [5] url_escapes (=2000)
//   [6] integer_formats (=4000)       [7] date_formats (=2000)
//   [8] input_bytes (=91442)          [9] output_bytes (=426192)
//   [10] output_fnv1a (=0x7c5fa247)   [11] status_code (0 = ok)

typedef unsigned char u8;
typedef unsigned int u32;
typedef int i32;

// FIXTURE / OUTPUT / RES offsets sit past every language's .bss window. Rust
// and AS place their static tables in the low 128 KiB; C/C++ have no static
// tables here at all. 3 MiB for the fixture is safely past LLD's data_end.
#define FIXTURE_OFFSET 3145728u   // 3 MiB
#define OUTPUT_OFFSET  3407872u   // 3 MiB + 256 KiB (space for 91,442-byte fixture window)
#define RES_OFFSET     3932160u   // 3.75 MiB (space for 426,192-byte output window)

#define FIXTURE_MAGIC 0x31465353u
#define OUTPUT_MAGIC  0x314f5353u
#define RECORDS       1000u
#define TOKENS_PER_RESPONSE 23u

static u8 fixture_at(u32 off) { return *(((u8 *)FIXTURE_OFFSET) + off); }
static u32 read_u32_le(u32 off) {
  return (u32)fixture_at(off) | ((u32)fixture_at(off + 1) << 8) |
    ((u32)fixture_at(off + 2) << 16) | ((u32)fixture_at(off + 3) << 24);
}

static u32 out_at;
static u32 out_failed;
static u32 fnv;
static u32 c_text_escapes;
static u32 c_attribute_escapes;
static u32 c_url_escapes;
static u32 c_integer_formats;
static u32 c_date_formats;

static void fnv_reset(void) { fnv = 0x811c9dc5u; }
static void fnv_mix_byte(u8 b) { fnv = (fnv ^ (u32)b) * 0x01000193u; }

static void out_byte(u32 v) {
  if (out_failed) return;
  *(((u8 *)OUTPUT_OFFSET) + out_at) = (u8)v;
  fnv_mix_byte((u8)v);
  out_at++;
}
static void out_bytes(const u8 *p, u32 n) {
  if (out_failed) return;
  for (u32 i = 0; i < n; i++) out_byte(p[i]);
}
static void out_fixture_range(u32 off, u32 n) {
  if (out_failed) return;
  for (u32 i = 0; i < n; i++) out_byte(fixture_at(off + i));
}
static void out_u32_le(u32 v) {
  out_byte(v & 0xffu);
  out_byte((v >> 8) & 0xffu);
  out_byte((v >> 16) & 0xffu);
  out_byte((v >> 24) & 0xffu);
}
// Overwrite (u32 little-endian) at OUTPUT_OFFSET + at. FNV is *not* remixed
// here because the framing length is included by design (we bake the length
// into the FNV mix immediately after decoding the record; see below).
static void out_overwrite_u32_le(u32 at, u32 v) {
  u8 *out = ((u8 *)OUTPUT_OFFSET) + at;
  out[0] = (u8)(v & 0xffu);
  out[1] = (u8)((v >> 8) & 0xffu);
  out[2] = (u8)((v >> 16) & 0xffu);
  out[3] = (u8)((v >> 24) & 0xffu);
}
// Literal writes — bakes the ASCII bytes of the string into the output stream.
#define LIT(s) out_lit((const u8 *)(s), (u32)(sizeof(s) - 1))
static void out_lit(const u8 *p, u32 n) { out_bytes(p, n); }

static void write_decimal(u32 value, u32 minimum) {
  u8 digits[10];
  u32 n = 0;
  do {
    digits[n++] = (u8)(48u + (value % 10u));
    value /= 10u;
  } while (value || n < minimum);
  while (n > 0) out_byte(digits[--n]);
}

static void write_text_escaped(u32 off, u32 n) {
  for (u32 i = 0; i < n; i++) {
    u8 c = fixture_at(off + i);
    if (c == 38u) LIT("&amp;");
    else if (c == 60u) LIT("&lt;");
    else if (c == 62u) LIT("&gt;");
    else out_byte(c);
  }
}
static void write_attr_escaped(u32 off, u32 n) {
  for (u32 i = 0; i < n; i++) {
    u8 c = fixture_at(off + i);
    if (c == 38u) LIT("&amp;");
    else if (c == 60u) LIT("&lt;");
    else if (c == 62u) LIT("&gt;");
    else if (c == 34u) LIT("&quot;");
    else if (c == 39u) LIT("&#39;");
    else out_byte(c);
  }
}
static i32 is_unreserved(u8 c) {
  return (c >= 65 && c <= 90) || (c >= 97 && c <= 122) ||
    (c >= 48 && c <= 57) || c == 45 || c == 46 || c == 95 || c == 126;
}
static void write_url_component(u32 off, u32 n) {
  static const u8 hex[] = "0123456789ABCDEF";
  for (u32 i = 0; i < n; i++) {
    u8 c = fixture_at(off + i);
    if (is_unreserved(c)) out_byte(c);
    else {
      out_byte(37);
      out_byte(hex[c >> 4]);
      out_byte(hex[c & 15]);
    }
  }
}
static i32 write_date(u32 ymd) {
  u32 year = ymd / 10000u, month = (ymd / 100u) % 100u, day = ymd % 100u;
  if (year < 2026u || year > 9999u || month < 1u || month > 12u ||
      day < 1u || day > 28u) {
    return 0;
  }
  write_decimal(year, 4);
  out_byte(45);
  write_decimal(month, 2);
  out_byte(45);
  write_decimal(day, 2);
  return 1;
}
static void write_price(u32 cents) {
  write_decimal(cents / 100u, 1);
  out_byte(46);
  write_decimal(cents % 100u, 2);
}

// UTF-8 validation (mirrors the JS Fatal TextDecoder check on every parsed
// string field). Returns 0 on invalid input.
static i32 valid_utf8(u32 off, u32 n) {
  u32 i = 0;
  while (i < n) {
    u32 c = fixture_at(off + i);
    i++;
    if (c < 0x80u) continue;
    u32 need = 0, min = 0, value = 0;
    if ((c & 0xe0u) == 0xc0u) { need = 1; min = 0x80u; value = c & 0x1fu; }
    else if ((c & 0xf0u) == 0xe0u) { need = 2; min = 0x800u; value = c & 0x0fu; }
    else if ((c & 0xf8u) == 0xf0u) { need = 3; min = 0x10000u; value = c & 0x07u; }
    else return 0;
    if (i + need > n) return 0;
    for (u32 j = 0; j < need; j++) {
      u32 d = fixture_at(off + i);
      i++;
      if ((d & 0xc0u) != 0x80u) return 0;
      value = (value << 6) | (d & 0x3fu);
    }
    if (value < min || value > 0x10ffffu ||
        (value >= 0xd800u && value <= 0xdfffu)) {
      return 0;
    }
  }
  return 1;
}

// Cursor: parsing offset into fixture bytes.
static u32 cur;
static i32 cur_failed;

static u32 parse_u32(u32 end) {
  if (cur_failed || cur > end || end - cur < 4u) { cur_failed = 1; return 0; }
  u32 v = read_u32_le(cur);
  cur += 4;
  return v;
}
// parse_string returns (off, n). Advances cursor by 4 + n.
static void parse_string(u32 end, u32 *off_out, u32 *n_out) {
  u32 length = parse_u32(end);
  if (cur_failed || length > 65536u || cur > end || length > end - cur) {
    cur_failed = 1;
    return;
  }
  if (!valid_utf8(cur, length)) { cur_failed = 1; return; }
  *off_out = cur;
  *n_out = length;
  cur += length;
}

static i32 render_record(
  u32 product_id, u32 user_id, u32 price_cents, u32 date_ymd,
  u32 name_off, u32 name_n, u32 user_off, u32 user_n,
  u32 slug_off, u32 slug_n
) {
  LIT("<!doctype html><html lang=\"en\"><body><article data-product=\"");
  write_decimal(product_id, 1);
  c_integer_formats++;
  LIT("\"><h1>");
  write_text_escaped(name_off, name_n);
  c_text_escapes++;
  LIT("</h1><p data-user=\"");
  write_decimal(user_id, 1);
  c_integer_formats++;
  LIT("\" aria-label=\"Catalog for ");
  write_attr_escaped(user_off, user_n);
  c_attribute_escapes++;
  LIT("\">Hello, ");
  write_text_escaped(user_off, user_n);
  c_text_escapes++;
  LIT(".</p><p class=\"price\" data-cents=\"");
  write_decimal(price_cents, 1);
  c_integer_formats++;
  LIT("\">USD ");
  write_price(price_cents);
  c_integer_formats++;
  LIT("</p><a href=\"/catalog/");
  write_url_component(slug_off, slug_n);
  c_url_escapes++;
  LIT("?for=");
  write_url_component(user_off, user_n);
  c_url_escapes++;
  LIT("\">Open</a><time datetime=\"");
  if (!write_date(date_ymd)) return 0;
  c_date_formats++;
  LIT("\">");
  if (!write_date(date_ymd)) return 0;
  c_date_formats++;
  LIT("</time></article></body></html>");
  return out_failed ? 0 : 1;
}

__attribute__((export_name("ssr_render")))
i32 ssr_render(u32 fixture_len) {
  out_at = 0;
  out_failed = 0;
  cur = 0;
  cur_failed = 0;
  c_text_escapes = 0;
  c_attribute_escapes = 0;
  c_url_escapes = 0;
  c_integer_formats = 0;
  c_date_formats = 0;
  fnv_reset();

  if (fixture_len < 8u) return -1;
  if (parse_u32(fixture_len) != FIXTURE_MAGIC || cur_failed) return -2;
  if (parse_u32(fixture_len) != RECORDS || cur_failed) return -3;

  out_u32_le(OUTPUT_MAGIC);
  out_u32_le(RECORDS);
  if (out_failed) return -4;

  for (u32 index = 0; index < RECORDS; index++) {
    u32 product_id = parse_u32(fixture_len);
    u32 user_id = parse_u32(fixture_len);
    u32 price_cents = parse_u32(fixture_len);
    u32 date_ymd = parse_u32(fixture_len);
    u32 name_off = 0, name_n = 0, user_off = 0, user_n = 0, slug_off = 0, slug_n = 0;
    parse_string(fixture_len, &name_off, &name_n);
    parse_string(fixture_len, &user_off, &user_n);
    parse_string(fixture_len, &slug_off, &slug_n);
    if (cur_failed) return -5;

    // Length placeholder (u32 LE) — patched after the record body is written.
    u32 length_at = out_at;
    out_u32_le(0);
    u32 start = out_at;
    if (
      !render_record(
        product_id, user_id, price_cents, date_ymd,
        name_off, name_n, user_off, user_n, slug_off, slug_n
      )
    ) return -6;
    u32 body_len = out_at - start;
    out_overwrite_u32_le(length_at, body_len);
    // Also mix the framing length into the FNV stream at the same position
    // the length bytes appear in the framed output (already mixed as 0's; the
    // renderer's oracle FNV is computed over the *final* stream, so we must
    // reset FNV and remix the framed output at the end).
  }
  if (cur_failed || cur != fixture_len) return -7;
  if (out_failed) return -8;

  // Rewrite FNV over the final framed output stream (since we couldn't
  // patch the length placeholder in the streamed FNV mix above).
  fnv_reset();
  {
    u8 *out = (u8 *)OUTPUT_OFFSET;
    for (u32 i = 0; i < out_at; i++) fnv_mix_byte(out[i]);
  }

  u32 *results = (u32 *)RES_OFFSET;
  results[0] = RECORDS;
  results[1] = RECORDS * 7u;
  results[2] = RECORDS * TOKENS_PER_RESPONSE;
  results[3] = c_text_escapes;
  results[4] = c_attribute_escapes;
  results[5] = c_url_escapes;
  results[6] = c_integer_formats;
  results[7] = c_date_formats;
  results[8] = fixture_len;
  results[9] = out_at;
  results[10] = fnv;
  results[11] = 0;
  return 0;
}
