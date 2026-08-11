// markdown_cms_kernel.c — multilang compute core for text.markdown-cms.v1.
//
// Ports the frozen renderMarkdown() (benchmarks/v2/text-markdown-cms/
// workload.js) at the linear-Wasm layer using the shared multilang-wasm
// kernel ABI: the adapter writes the frozen 10,978,068-byte fixture bytes
// (serializeMarkdownCorpus() header 'MCF1' + count + [u32 length, bytes]×500)
// into linear memory at FIXTURE_OFFSET, the kernel parses + renders every
// document byte-for-byte bit-identical to renderMarkdown() into OUTPUT_OFFSET,
// and writes aggregate counters + an FNV-1a digest of the entire concatenated
// output HTML stream to RES_OFFSET. Exports:
//   i32 markdown_cms_render(u32 fixture_len) → 0 ok / negative error code.
//
// Results (u32 words at RES_OFFSET):
//   [0] documents        (=500)         [1] input_bytes    (=10976060)
//   [2] tokens           (=2997)        [3] ast_nodes      (=5996)
//   [4] transforms       (=1001)        [5] sanitizer_ck   (=1000)
//   [6] output_bytes     (=11057325)    [7] rejected       (=499)
//   [8] output_fnv1a     (=0xe5a7f519)  [9] status_code    (0 = ok)

typedef unsigned char u8;
typedef unsigned int u32;
typedef int i32;

// FIXTURE / OUTPUT / AST / RES offsets sit safely past every language's .bss
// window (Rust LLD lands ~1-2.9 MiB). Total peak memory ~28 MiB.
#define FIXTURE_OFFSET 3145728u    // 3 MiB
#define OUTPUT_OFFSET  15728640u   // 15 MiB (leaves 12 MiB for the 10.5 MiB fixture)
#define AST_OFFSET     27262976u   // 26 MiB (small per-document scratch)
#define RES_OFFSET     28311552u   // 27 MiB (leaves 1 MiB for AST scratch)

#define FIXTURE_MAGIC  0x3146434du // "MCF1" LE
#define DOCUMENTS      500u
#define RECORD_FIELDS  6u
#define MAX_RECORDS    4096u       // MAX_NON_EMPTY_LINES per document
#define MAX_INPUT      40960u      // RAW_HTML_LIMIT_BYTES per document

// Record types (mirror workload.js constants).
#define T_H1        1u
#define T_H2        2u
#define T_PARAGRAPH 3u
#define T_LINK      4u
#define T_FIGURE    5u
#define T_RAW       6u

static u8 fixture_at(u32 off) { return *(((u8 *)FIXTURE_OFFSET) + off); }
static u32 read_u32_le(u32 off) {
  return (u32)fixture_at(off) | ((u32)fixture_at(off + 1) << 8) |
    ((u32)fixture_at(off + 2) << 16) | ((u32)fixture_at(off + 3) << 24);
}

// Output stream state.
static u32 out_at;
static u32 fnv;
static void fnv_reset(void) { fnv = 0x811c9dc5u; }
static void fnv_mix_byte(u8 b) { fnv = (fnv ^ (u32)b) * 0x01000193u; }
static void out_byte_raw(u8 v) {
  *(((u8 *)OUTPUT_OFFSET) + out_at) = v;
  out_at++;
}
static void out_byte(u32 v) { out_byte_raw((u8)v); }
static void out_bytes(const u8 *p, u32 n) {
  for (u32 i = 0; i < n; i++) out_byte_raw(p[i]);
}
static void out_fixture_range(u32 off, u32 n) {
  for (u32 i = 0; i < n; i++) out_byte_raw(fixture_at(off + i));
}
#define LIT(s) out_bytes((const u8 *)(s), (u32)(sizeof(s) - 1))

// AST scratch: MAX_RECORDS records × RECORD_FIELDS × u32 = 96 KiB. Stored at
// AST_OFFSET so C/C++/Rust/AS all agree on the same location.
static u32 *ast_ptr(void) { return (u32 *)AST_OFFSET; }

static i32 is_alnum_ascii(u8 c) {
  return (c >= 'A' && c <= 'Z') || (c >= 'a' && c <= 'z') ||
    (c >= '0' && c <= '9');
}
static u8 to_lower_ascii(u8 c) {
  return (c >= 'A' && c <= 'Z') ? (u8)(c + 32) : c;
}

// UTF-8 lead-byte length (1 for ASCII/continuation, 2/3/4 for multibyte). We
// only ever call this on well-formed UTF-8 (fixture bytes are TextEncoder
// output), so we don't need to reject invalid input.
static u32 utf8_len(u8 c) {
  if (c < 0x80u) return 1;
  if ((c & 0xe0u) == 0xc0u) return 2;
  if ((c & 0xf0u) == 0xe0u) return 3;
  if ((c & 0xf8u) == 0xf0u) return 4;
  return 1;
}

// escapeHtml: & → &amp;, < → &lt;, > → &gt;, " → &quot;.
static void write_escaped(u32 off, u32 n) {
  for (u32 i = 0; i < n; i++) {
    u8 c = fixture_at(off + i);
    if (c == 38u) LIT("&amp;");
    else if (c == 60u) LIT("&lt;");
    else if (c == 62u) LIT("&gt;");
    else if (c == 34u) LIT("&quot;");
    else out_byte_raw(c);
  }
}

// slug(): iterate CODE POINTS. For each ASCII alnum: append lowercase byte;
// for anything else (including multibyte codepoints and non-alnum ASCII):
// append a single '-' unless result is empty or last byte is already '-'.
// After the loop, strip one trailing '-'. If empty, emit "section".
static void write_slug(u32 off, u32 n) {
  u32 start_at = out_at;
  u32 dash = 0;
  u32 i = 0;
  while (i < n) {
    u8 c = fixture_at(off + i);
    if (c < 0x80u) {
      if (is_alnum_ascii(c)) {
        out_byte_raw(to_lower_ascii(c));
        dash = 0;
      } else if (out_at > start_at && !dash) {
        out_byte_raw('-');
        dash = 1;
      }
      i++;
    } else {
      // Non-ASCII codepoint — never alnum in [A-Za-z0-9]. Emit dash if not
      // already trailing. Skip continuation bytes.
      if (out_at > start_at && !dash) {
        out_byte_raw('-');
        dash = 1;
      }
      i += utf8_len(c);
    }
  }
  // Trim one trailing '-'.
  if (out_at > start_at && *(((u8 *)OUTPUT_OFFSET) + out_at - 1) == '-') {
    out_at--;
  }
  if (out_at == start_at) LIT("section");
}

// allowedRaw byte-level test:
//   ^<em>[^<>]*</em>$  or  ^<strong>[^<>]*</strong>$
static i32 allowed_raw(u32 off, u32 n) {
  // <em>...</em> case (open 4, close 5, total >= 9).
  if (n >= 9u &&
      fixture_at(off) == 60u && fixture_at(off + 1) == 'e' &&
      fixture_at(off + 2) == 'm' && fixture_at(off + 3) == 62u &&
      fixture_at(off + n - 5) == 60u && fixture_at(off + n - 4) == 47u &&
      fixture_at(off + n - 3) == 'e' && fixture_at(off + n - 2) == 'm' &&
      fixture_at(off + n - 1) == 62u) {
    for (u32 i = 4u; i < n - 5u; i++) {
      u8 c = fixture_at(off + i);
      if (c == 60u || c == 62u) return 0;
    }
    return 1;
  }
  // <strong>...</strong> case (open 8, close 9, total >= 17).
  if (n >= 17u &&
      fixture_at(off) == 60u && fixture_at(off + 1) == 's' &&
      fixture_at(off + 2) == 't' && fixture_at(off + 3) == 'r' &&
      fixture_at(off + 4) == 'o' && fixture_at(off + 5) == 'n' &&
      fixture_at(off + 6) == 'g' && fixture_at(off + 7) == 62u &&
      fixture_at(off + n - 9) == 60u && fixture_at(off + n - 8) == 47u &&
      fixture_at(off + n - 7) == 's' && fixture_at(off + n - 6) == 't' &&
      fixture_at(off + n - 5) == 'r' && fixture_at(off + n - 4) == 'o' &&
      fixture_at(off + n - 3) == 'n' && fixture_at(off + n - 2) == 'g' &&
      fixture_at(off + n - 1) == 62u) {
    for (u32 i = 8u; i < n - 9u; i++) {
      u8 c = fixture_at(off + i);
      if (c == 60u || c == 62u) return 0;
    }
    return 1;
  }
  return 0;
}

// safeUrlBytes: reject any byte <= 32, >= 127, or in {" ' < > \}. Then a byte
// prefix check against the allowlisted origins (image = images subdomain).
static i32 safe_url(u32 off, u32 n, u32 image) {
  for (u32 i = 0; i < n; i++) {
    u8 c = fixture_at(off + i);
    if (c <= 32u || c >= 127u || c == 34u || c == 39u ||
        c == 60u || c == 62u || c == 92u) {
      return 0;
    }
  }
  if (image) {
    const u8 prefix[] = "https://images.example.test/";
    u32 plen = sizeof(prefix) - 1;
    if (n < plen) return 0;
    for (u32 i = 0; i < plen; i++) {
      if (fixture_at(off + i) != prefix[i]) return 0;
    }
    return 1;
  }
  const u8 a[] = "https://example.test/";
  const u8 b[] = "https://docs.example.test/";
  u32 alen = sizeof(a) - 1, blen = sizeof(b) - 1;
  if (n >= alen) {
    u32 ok = 1;
    for (u32 i = 0; i < alen; i++) {
      if (fixture_at(off + i) != a[i]) { ok = 0; break; }
    }
    if (ok) return 1;
  }
  if (n >= blen) {
    u32 ok = 1;
    for (u32 i = 0; i < blen; i++) {
      if (fixture_at(off + i) != b[i]) { ok = 0; break; }
    }
    if (ok) return 1;
  }
  return 0;
}

// parseMarkdown into ast[] (relative offsets converted to absolute-in-fixture
// offsets by the caller). doc_off is the absolute fixture offset of the
// document's first byte; doc_len is the byte length. Returns node count
// (records / RECORD_FIELDS), or a negative value on validation failure.
static i32 parse_markdown(u32 doc_off, u32 doc_len) {
  if (doc_len > MAX_INPUT) return -1;
  u32 *ast = ast_ptr();
  u32 node_count = 0;
  u32 non_empty = 0;
  u32 start = 0;
  for (u32 end = 0; end <= doc_len; end++) {
    if (end != doc_len && fixture_at(doc_off + end) != 10u) continue;
    if (end == start) { start = end + 1; continue; }
    non_empty++;
    if (non_empty > MAX_RECORDS) return -2;
    u32 type = T_PARAGRAPH;
    u32 text_start = start;
    u32 text_length = end - start;
    u32 url_start = 0, url_length = 0;
    u8 s0 = fixture_at(doc_off + start);
    u8 s1 = (start + 1 < end) ? fixture_at(doc_off + start + 1) : 0;
    u8 s2 = (start + 2 < end) ? fixture_at(doc_off + start + 2) : 0;
    if (text_length >= 3u && s0 == '#' && s1 == ' ') {
      type = T_H1;
      text_start = start + 2;
      text_length -= 2;
    } else if (text_length >= 4u && s0 == '#' && s1 == '#' && s2 == ' ') {
      type = T_H2;
      text_start = start + 3;
      text_length -= 3;
    } else if (s0 == 60u) {
      type = T_RAW;
    } else if (s0 == 91u || (text_length >= 5u && s0 == 33u && s1 == 91u)) {
      u32 image = (s0 == 33u) ? 1u : 0u;
      u32 cursor = start + (image ? 1u : 0u);
      u32 candidate_text_start = cursor + 1u;
      u32 close = 0;
      for (; cursor + 2 < end; cursor++) {
        if (fixture_at(doc_off + cursor) == 93u &&
            fixture_at(doc_off + cursor + 1) == 40u) {
          close = cursor;
          break;
        }
      }
      if (close != 0 && fixture_at(doc_off + end - 1) == 41u) {
        type = image ? T_FIGURE : T_LINK;
        text_start = candidate_text_start;
        text_length = close - candidate_text_start;
        url_start = close + 2u;
        url_length = end - url_start - 1u;
      }
    }
    ast[node_count * RECORD_FIELDS + 0] = type;
    ast[node_count * RECORD_FIELDS + 1] = doc_off + text_start;
    ast[node_count * RECORD_FIELDS + 2] = text_length;
    ast[node_count * RECORD_FIELDS + 3] = url_start ? doc_off + url_start : 0u;
    ast[node_count * RECORD_FIELDS + 4] = url_length;
    ast[node_count * RECORD_FIELDS + 5] = 0u;
    node_count++;
    start = end + 1;
  }
  return (i32)node_count;
}

// Transform pass — mutates the flag column. Returns aggregate stats via
// out-params.
static void transform_ast(
  u32 node_count,
  u32 *headings_out, u32 *links_out, u32 *figures_out,
  u32 *transforms_out, u32 *sanitizer_out, u32 *rejected_out
) {
  u32 *ast = ast_ptr();
  u32 headings = 0, links = 0, figures = 0;
  u32 transforms = 0, sanitizer = 0, rejected = 0;
  for (u32 i = 0; i < node_count; i++) {
    u32 base = i * RECORD_FIELDS;
    u32 type = ast[base];
    if (type == T_H1 || type == T_H2) {
      headings++;
      transforms++;
      ast[base + 5] = 1;
    } else if (type == T_LINK || type == T_FIGURE) {
      if (type == T_LINK) links++;
      else figures++;
      transforms++;
      sanitizer++;
      u32 image = (type == T_FIGURE) ? 1u : 0u;
      i32 ok = safe_url(ast[base + 3], ast[base + 4], image);
      ast[base + 5] = ok ? 1u : 0u;
      if (!ok) rejected++;
    } else if (type == T_RAW) {
      sanitizer++;
      i32 ok = allowed_raw(ast[base + 1], ast[base + 2]);
      ast[base + 5] = ok ? 1u : 0u;
      if (!ok) rejected++;
    } else {
      ast[base + 5] = 1;
    }
  }
  *headings_out = headings;
  *links_out = links;
  *figures_out = figures;
  *transforms_out = transforms;
  *sanitizer_out = sanitizer;
  *rejected_out = rejected;
}

// Render pass — appends this document's HTML bytes to the shared output
// stream starting at OUTPUT_OFFSET. Uses the same TOC-first / body-second
// ordering as renderMarkdown().
static void render_ast(u32 node_count, u32 headings) {
  u32 *ast = ast_ptr();
  if (headings) {
    LIT("<nav aria-label=\"Table of contents\"><ol>");
    for (u32 i = 0; i < node_count; i++) {
      u32 base = i * RECORD_FIELDS;
      u32 type = ast[base];
      if (type == T_H1 || type == T_H2) {
        u32 t_off = ast[base + 1], t_len = ast[base + 2];
        LIT("<li><a href=\"#");
        write_slug(t_off, t_len);
        LIT("\">");
        write_escaped(t_off, t_len);
        LIT("</a></li>");
      }
    }
    LIT("</ol></nav>");
  }
  for (u32 i = 0; i < node_count; i++) {
    u32 base = i * RECORD_FIELDS;
    u32 type = ast[base];
    u32 flag = ast[base + 5];
    u32 t_off = ast[base + 1], t_len = ast[base + 2];
    if (type == T_H1) {
      LIT("<h1 id=\"");
      write_slug(t_off, t_len);
      LIT("\">");
      write_escaped(t_off, t_len);
      LIT("</h1>");
    } else if (type == T_H2) {
      LIT("<h2 id=\"");
      write_slug(t_off, t_len);
      LIT("\">");
      write_escaped(t_off, t_len);
      LIT("</h2>");
    } else if (type == T_PARAGRAPH) {
      LIT("<p>");
      write_escaped(t_off, t_len);
      LIT("</p>");
    } else if (type == T_LINK && flag) {
      LIT("<p><a href=\"");
      write_escaped(ast[base + 3], ast[base + 4]);
      LIT("\">");
      write_escaped(t_off, t_len);
      LIT("</a></p>");
    } else if (type == T_FIGURE && flag) {
      LIT("<figure><img src=\"");
      write_escaped(ast[base + 3], ast[base + 4]);
      LIT("\" alt=\"");
      write_escaped(t_off, t_len);
      LIT("\"></figure>");
    } else if (type == T_RAW && flag) {
      out_fixture_range(t_off, t_len);
    }
  }
}

__attribute__((export_name("markdown_cms_render")))
i32 markdown_cms_render(u32 fixture_len) {
  out_at = 0;
  fnv_reset();
  if (fixture_len < 8u) return -1;
  if (read_u32_le(0) != FIXTURE_MAGIC) return -2;
  if (read_u32_le(4) != DOCUMENTS) return -3;
  u32 cur = 8;
  u32 c_docs = 0;
  u32 c_input_bytes = 0;
  u32 c_tokens = 0;
  u32 c_ast_nodes = 0;
  u32 c_transforms = 0;
  u32 c_sanitizer = 0;
  u32 c_rejected = 0;
  for (u32 d = 0; d < DOCUMENTS; d++) {
    if (cur + 4u > fixture_len) return -4;
    u32 doc_len = read_u32_le(cur);
    cur += 4;
    if (cur + doc_len > fixture_len) return -5;
    i32 node_count = parse_markdown(cur, doc_len);
    if (node_count < 0) return -6;
    u32 nc = (u32)node_count;
    u32 headings = 0, links = 0, figures = 0;
    u32 transforms = 0, sanitizer = 0, rejected = 0;
    transform_ast(nc, &headings, &links, &figures, &transforms, &sanitizer, &rejected);
    render_ast(nc, headings);
    c_docs++;
    c_input_bytes += doc_len;
    c_tokens += nc;
    c_ast_nodes += nc + headings * 2u + (headings ? 2u : 0u) + links + figures;
    c_transforms += transforms;
    c_sanitizer += sanitizer;
    c_rejected += rejected;
    cur += doc_len;
  }
  if (cur != fixture_len) return -7;

  // Compute FNV-1a over the entire concatenated output HTML stream.
  fnv_reset();
  {
    u8 *out = (u8 *)OUTPUT_OFFSET;
    for (u32 i = 0; i < out_at; i++) fnv_mix_byte(out[i]);
  }

  u32 *results = (u32 *)RES_OFFSET;
  results[0] = c_docs;
  results[1] = c_input_bytes;
  results[2] = c_tokens;
  results[3] = c_ast_nodes;
  results[4] = c_transforms;
  results[5] = c_sanitizer;
  results[6] = out_at;
  results[7] = c_rejected;
  results[8] = fnv;
  results[9] = 0;
  return 0;
}
