typedef unsigned char u8;
typedef unsigned int u32;
typedef int i32;

static const u8 *g_src;
static u32 g_len;
static u32 g_pos;
static u32 g_base;
static u8 g_expr[2048];
static u32 g_expr_len;
static u32 g_source_bytes;
static u32 g_header_bytes;
static u32 g_tokens;
static u32 g_ast;
static u32 g_functions;
static u32 g_instructions;
static u32 g_link_sections;
static u32 g_vfs_reads;
static u32 g_allocations;
static u32 g_boundary_crossings;
static u32 g_output_bytes;
static i32 g_error;

static int is_space(u8 c) { return c == 9 || c == 10 || c == 13 || c == 32; }
static int is_alpha(u8 c) { return (c >= 'A' && c <= 'Z') || (c >= 'a' && c <= 'z') || c == '_'; }
static int is_digit(u8 c) { return c >= '0' && c <= '9'; }
static int is_ascii(u8 c) { return c == 9 || c == 10 || c == 13 || (c >= 32 && c <= 126); }
static int equal(const u8 *a, const char *b, u32 n) {
  for (u32 i = 0; i < n; i++) if (a[i] != (u8)b[i]) return 0;
  return 1;
}
static void skip(void) { while (g_pos < g_len && is_space(g_src[g_pos])) g_pos++; }
static int consume_char(u8 c) {
  skip();
  if (g_pos >= g_len || g_src[g_pos] != c) return 0;
  g_pos++; g_tokens++; return 1;
}
static int consume_pair(u8 a, u8 b) {
  skip();
  if (g_pos + 1 >= g_len || g_src[g_pos] != a || g_src[g_pos + 1] != b) return 0;
  g_pos += 2; g_tokens++; return 1;
}
static int consume_word(const char *word, u32 n) {
  skip();
  if (g_pos + n > g_len || !equal(g_src + g_pos, word, n)) return 0;
  if (g_pos + n < g_len && (is_alpha(g_src[g_pos + n]) || is_digit(g_src[g_pos + n]))) return 0;
  g_pos += n; g_tokens++; return 1;
}
static void emit(u8 value) { if (g_expr_len < sizeof(g_expr)) g_expr[g_expr_len++] = value; else g_error = -20; }
static void emit_sleb(i32 value) {
  int more = 1;
  while (more) {
    u8 byte = (u8)(value & 0x7f);
    value >>= 7;
    int sign = (byte & 0x40) != 0;
    more = !((value == 0 && !sign) || (value == -1 && sign));
    if (more) byte |= 0x80;
    emit(byte);
  }
}
static void emit_const(u32 value) { emit(0x41); emit_sleb((i32)value); g_ast++; g_instructions++; }
static u32 signed_right(u32 value, u32 count) {
  if (count == 0) return value;
  if ((value & 0x80000000u) == 0) return value >> count;
  return (value >> count) | (~0u << (32 - count));
}

static int parse_or(u32 *value);
static int parse_primary(u32 *value) {
  skip();
  if (consume_char('(')) {
    if (!parse_or(value) || !consume_char(')')) return 0;
    return 1;
  }
  if (consume_char('-')) {
    emit(0x41); emit(0x00); g_instructions++;
    if (!parse_primary(value)) return 0;
    emit(0x6b); g_ast++; g_instructions++;
    *value = 0u - *value;
    return 1;
  }
  u32 start = g_pos;
  if (start < g_len && is_digit(g_src[start])) {
    u32 parsed = 0;
    while (g_pos < g_len && is_digit(g_src[g_pos])) {
      u32 digit = (u32)(g_src[g_pos++] - '0');
      if (parsed > 214748364u || (parsed == 214748364u && digit > 7u)) return 0;
      parsed = parsed * 10u + digit;
    }
    g_tokens++; emit_const(parsed); *value = parsed; return 1;
  }
  if (consume_word("BASE", 4)) { emit_const(g_base); *value = g_base; return 1; }
  return 0;
}
static int parse_mul(u32 *value) {
  if (!parse_primary(value)) return 0;
  while (consume_char('*')) {
    u32 right;
    if (!parse_primary(&right)) return 0;
    emit(0x6c); g_ast++; g_instructions++; *value = *value * right;
  }
  return 1;
}
static int parse_add(u32 *value) {
  if (!parse_mul(value)) return 0;
  for (;;) {
    skip();
    u8 op = g_pos < g_len ? g_src[g_pos] : 0;
    if (op != '+' && op != '-') break;
    g_pos++; g_tokens++;
    u32 right;
    if (!parse_mul(&right)) return 0;
    emit(op == '+' ? 0x6a : 0x6b); g_ast++; g_instructions++;
    *value = op == '+' ? *value + right : *value - right;
  }
  return 1;
}
static int parse_shift(u32 *value) {
  if (!parse_add(value)) return 0;
  for (;;) {
    u8 opcode;
    if (consume_pair('<', '<')) opcode = 0x74;
    else if (consume_pair('>', '>')) opcode = 0x75;
    else break;
    u32 right;
    if (!parse_add(&right) || right >= 32u) return 0;
    emit(opcode); g_ast++; g_instructions++;
    *value = opcode == 0x74 ? *value << right : signed_right(*value, right);
  }
  return 1;
}
static int parse_and(u32 *value) {
  if (!parse_shift(value)) return 0;
  while (consume_char('&')) {
    u32 right;
    if (!parse_shift(&right)) return 0;
    emit(0x71); g_ast++; g_instructions++; *value &= right;
  }
  return 1;
}
static int parse_xor(u32 *value) {
  if (!parse_and(value)) return 0;
  while (consume_char('^')) {
    u32 right;
    if (!parse_and(&right)) return 0;
    emit(0x73); g_ast++; g_instructions++; *value ^= right;
  }
  return 1;
}
static int parse_or(u32 *value) {
  if (!parse_xor(value)) return 0;
  while (consume_char('|')) {
    u32 right;
    if (!parse_xor(&right)) return 0;
    emit(0x72); g_ast++; g_instructions++; *value |= right;
  }
  return 1;
}

static u32 put_uleb(u8 *out, u32 pos, u32 value) {
  do { u8 b = (u8)(value & 0x7f); value >>= 7; if (value) b |= 0x80; out[pos++] = b; } while (value);
  return pos;
}
static u32 put(u8 *out, u32 pos, u8 value) { out[pos] = value; return pos + 1; }
static u32 put_bytes(u8 *out, u32 pos, const u8 *values, u32 count) {
  for (u32 i = 0; i < count; i++) out[pos++] = values[i];
  return pos;
}
static void reset_counters(u32 source_len, u32 header_len) {
  g_error = 0; g_expr_len = 0; g_source_bytes = source_len; g_header_bytes = header_len;
  g_tokens = 0; g_ast = 2; g_functions = 0; g_instructions = 0; g_link_sections = 0;
  g_vfs_reads = 0; g_allocations = 0; g_boundary_crossings = 0; g_output_bytes = 0;
}

__attribute__((export_name("compile_c")))
i32 compile_c(const u8 *source, u32 source_len, const u8 *header, u32 header_len, u8 *out, u32 capacity) {
  const char include[] = "#include \"fixture.h\"\n";
  const char define[] = "#define BASE ";
  reset_counters(source_len, header_len);
  g_boundary_crossings++;
  g_vfs_reads++;
  for (u32 i = 0; i < source_len; i++) if (!is_ascii(source[i])) return -9;
  if (source_len < 21 || !equal(source, include, 21)) return -1;
  g_vfs_reads++;
  for (u32 i = 0; i < header_len; i++) if (!is_ascii(header[i])) return -10;
  if (header_len < 15 || !equal(header, define, 13) || header[header_len - 1] != '\n') return -2;
  u32 hp = 13; int negative = 0;
  if (header[hp] == '-') { negative = 1; hp++; }
  if (hp >= header_len - 1 || !is_digit(header[hp])) return -3;
  u32 base = 0;
  while (hp < header_len - 1 && is_digit(header[hp])) {
    u32 digit = (u32)(header[hp++] - '0');
    if (base > 214748364u || (base == 214748364u && digit > (negative ? 8u : 7u))) return -4;
    base = base * 10u + digit;
  }
  if (hp != header_len - 1) return -5;
  g_base = negative ? 0u - base : base;
  g_src = source + 21; g_len = source_len - 21; g_pos = 0;
  u32 expression_value;
  if (!consume_word("int", 3) || !consume_word("test", 4) || !consume_char('(') ||
      !consume_word("void", 4) || !consume_char(')') || !consume_char('{') ||
      !consume_word("return", 6) || !parse_or(&expression_value) || !consume_char(';') || !consume_char('}')) return -6;
  skip(); if (g_pos != g_len || g_error) return -7;
  u32 body_len = 1 + g_expr_len + 1;
  u32 body_leb_len = body_len < 128 ? 1 : 2;
  u32 code_payload_len = 1 + body_leb_len + body_len;
  u32 total = 8 + 7 + 4 + 10 + 1 + (code_payload_len < 128 ? 1 : 2) + code_payload_len;
  if (capacity < total) return -8;
  u32 p = 0;
  const u8 magic[8] = {0,97,115,109,1,0,0,0};
  p = put_bytes(out, p, magic, 8);
  const u8 type_sec[7] = {1,5,1,0x60,0,1,0x7f};
  p = put_bytes(out, p, type_sec, 7); g_link_sections++;
  const u8 func_sec[4] = {3,2,1,0};
  p = put_bytes(out, p, func_sec, 4); g_link_sections++; g_functions++;
  const u8 export_sec[10] = {7,8,1,4,'t','e','s','t',0,0};
  p = put_bytes(out, p, export_sec, 10); g_link_sections++;
  p = put(out, p, 10); p = put_uleb(out, p, code_payload_len); p = put(out, p, 1);
  p = put_uleb(out, p, body_len); p = put(out, p, 0);
  p = put_bytes(out, p, g_expr, g_expr_len); p = put(out, p, 0x0b); g_link_sections++;
  g_output_bytes = p;
  g_boundary_crossings++;
  return (i32)p;
}

__attribute__((export_name("counter_source_bytes"))) u32 counter_source_bytes(void) { return g_source_bytes; }
__attribute__((export_name("counter_header_bytes"))) u32 counter_header_bytes(void) { return g_header_bytes; }
__attribute__((export_name("counter_tokens"))) u32 counter_tokens(void) { return g_tokens; }
__attribute__((export_name("counter_ast_nodes"))) u32 counter_ast_nodes(void) { return g_ast; }
__attribute__((export_name("counter_functions"))) u32 counter_functions(void) { return g_functions; }
__attribute__((export_name("counter_instructions"))) u32 counter_instructions(void) { return g_instructions; }
__attribute__((export_name("counter_link_sections"))) u32 counter_link_sections(void) { return g_link_sections; }
__attribute__((export_name("counter_vfs_reads"))) u32 counter_vfs_reads(void) { return g_vfs_reads; }
__attribute__((export_name("counter_allocations"))) u32 counter_allocations(void) { return g_allocations; }
__attribute__((export_name("counter_boundary_crossings"))) u32 counter_boundary_crossings(void) { return g_boundary_crossings; }
__attribute__((export_name("counter_output_bytes"))) u32 counter_output_bytes(void) { return g_output_bytes; }
