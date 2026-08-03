typedef unsigned char u8;
typedef unsigned int u32;
typedef unsigned long long u64;

static u32 g_records, g_input_bytes, g_numeric_values, g_string_values, g_booleans;
static const u8 *input;
static u32 input_len, at;

static int expect_byte(u8 value) {
  if (at >= input_len || input[at] != value) return 0;
  at++;
  return 1;
}
static int expect_ascii(const char *value) {
  for (u32 i = 0; value[i]; i++) if (!expect_byte((u8)value[i])) return 0;
  return 1;
}
static int parse_uint(u64 *out) {
  u32 start = at;
  u64 value = 0;
  while (at < input_len && input[at] >= '0' && input[at] <= '9') {
    if (at > start && input[start] == '0') return 0;
    u64 next = value * 10 + (u64)(input[at] - '0');
    if (next < value) return 0;
    value = next;
    at++;
  }
  if (at == start) return 0;
  *out = value;
  return 1;
}
static int bytes_equal(const u8 *value, u32 length) {
  if (at + length >= input_len) return 0;
  for (u32 i = 0; i < length; i++) if (input[at + i] != value[i]) return 0;
  if (input[at + length] != '"') return 0;
  at += length + 1;
  return 1;
}
static int parse_option(const u8 *const *values, const u32 *lengths, u32 count, u32 *selected) {
  if (!expect_byte('"')) return 0;
  for (u32 i = 0; i < count; i++) {
    u32 saved = at;
    if (bytes_equal(values[i], lengths[i])) { *selected = i; return 1; }
    at = saved;
  }
  return 0;
}
static int parse_boolean(u32 *value) {
  u32 saved = at;
  if (expect_ascii("true")) { *value = 1; return 1; }
  at = saved;
  if (expect_ascii("false")) { *value = 0; return 1; }
  return 0;
}

static const u8 ap[] = {'a','p'}, eu[] = {'e','u'}, na[] = {'n','a'}, sa[] = {'s','a'};
static const u8 click[] = {'c','l','i','c','k'}, purchase[] = {'p','u','r','c','h','a','s','e'}, view[] = {'v','i','e','w'};
static const u8 cafe[] = {'C','a','f',0xc3,0xa9}, tokyo[] = {0xe6,0x9d,0xb1,0xe4,0xba,0xac};
static const u8 arabic[] = {0xd9,0x85,0xd8,0xb1,0xd8,0xad,0xd8,0xa8,0xd8,0xa7}, rocket[] = {0xf0,0x9f,0x9a,0x80};
static const u8 alpha[] = {0xce,0xb1}, data_word[] = {0xe6,0x95,0xb0,0xe6,0x8d,0xae};
static const u8 manana[] = {'m','a',0xc3,0xb1,'a','n','a'}, tube[] = {0xf0,0x9f,0xa7,0xaa};
static const u8 *const regions[] = {ap, eu, na, sa};
static const u32 region_lengths[] = {2,2,2,2};
static const u8 *const kinds[] = {click, purchase, view};
static const u32 kind_lengths[] = {5,8,4};
static const u8 *const labels[] = {cafe, tokyo, arabic, rocket};
static const u32 label_lengths[] = {5,6,10,4};
static const u8 *const tags[] = {alpha, data_word, manana, tube};
static const u32 tag_lengths[] = {2,6,7,4};

static int write_byte(u8 *output, u32 capacity, u32 *position, u8 value) {
  if (*position >= capacity) return 0;
  output[(*position)++] = value;
  return 1;
}
static int write_ascii(u8 *output, u32 capacity, u32 *position, const char *value) {
  for (u32 i = 0; value[i]; i++) if (!write_byte(output, capacity, position, (u8)value[i])) return 0;
  return 1;
}
static int write_uint(u8 *output, u32 capacity, u32 *position, u64 value) {
  u8 digits[20];
  u32 length = 0;
  do { digits[length++] = (u8)('0' + value % 10); value /= 10; } while (value);
  while (length) if (!write_byte(output, capacity, position, digits[--length])) return 0;
  return 1;
}

__attribute__((export_name("process")))
int process(u32 input_offset, u32 length, u32 output_offset, u32 output_capacity) {
  input = (const u8 *)(unsigned long)input_offset;
  input_len = length;
  at = 0;
  g_records = 0;
  g_input_bytes = length;
  g_numeric_values = 0;
  g_string_values = 0;
  g_booleans = 0;
  u32 region_counts[4] = {0,0,0,0}, kind_counts[3] = {0,0,0};
  u32 ok_count = 0, error_count = 0;
  u64 value_sum = 0;
  if (!expect_byte('[')) return -1;
  while (at < input_len && input[at] != ']') {
    if (g_records && !expect_byte(',')) return -2;
    if (!expect_ascii("{\"id\":")) return -3;
    u64 id, timestamp, value;
    if (!parse_uint(&id) || id != g_records) return -4;
    if (!expect_ascii(",\"ts\":") || !parse_uint(&timestamp) || timestamp != 1700000000ULL + id) return -5;
    if (!expect_ascii(",\"region\":")) return -6;
    u32 region, kind, ok, ignored;
    if (!parse_option(regions, region_lengths, 4, &region)) return -7;
    if (!expect_ascii(",\"kind\":") || !parse_option(kinds, kind_lengths, 3, &kind)) return -8;
    if (!expect_ascii(",\"ok\":") || !parse_boolean(&ok)) return -9;
    if (!expect_ascii(",\"value\":") || !parse_uint(&value) || value > 9999) return -10;
    if (!expect_ascii(",\"meta\":{\"label\":") || !parse_option(labels, label_lengths, 4, &ignored)) return -11;
    if (!expect_ascii(",\"tag\":") || !parse_option(tags, tag_lengths, 4, &ignored)) return -12;
    if (!expect_ascii("}}")) return -13;
    g_records++;
    g_numeric_values += 3;
    g_string_values += 4;
    g_booleans++;
    region_counts[region]++;
    kind_counts[kind]++;
    ok_count += ok;
    error_count += !ok;
    value_sum += value;
  }
  if (!expect_byte(']') || at != input_len) return -14;
  u8 *output = (u8 *)(unsigned long)output_offset;
  u32 p = 0;
#define W(text) if (!write_ascii(output, output_capacity, &p, text)) return -15
#define N(value) if (!write_uint(output, output_capacity, &p, value)) return -15
  W("{\"count\":"); N(g_records); W(",\"errorCount\":"); N(error_count);
  W(",\"kind\":{\"click\":"); N(kind_counts[0]); W(",\"purchase\":"); N(kind_counts[1]); W(",\"view\":"); N(kind_counts[2]);
  W("},\"okCount\":"); N(ok_count); W(",\"region\":{\"ap\":"); N(region_counts[0]); W(",\"eu\":"); N(region_counts[1]);
  W(",\"na\":"); N(region_counts[2]); W(",\"sa\":"); N(region_counts[3]); W("},\"valueSum\":"); N(value_sum); W("}");
#undef W
#undef N
  return (int)p;
}

__attribute__((export_name("get_records"))) u32 get_records(void) { return g_records; }
__attribute__((export_name("get_input_bytes"))) u32 get_input_bytes(void) { return g_input_bytes; }
__attribute__((export_name("get_numeric_values"))) u32 get_numeric_values(void) { return g_numeric_values; }
__attribute__((export_name("get_string_values"))) u32 get_string_values(void) { return g_string_values; }
__attribute__((export_name("get_booleans"))) u32 get_booleans(void) { return g_booleans; }
__attribute__((export_name("get_query_aggregates"))) u32 get_query_aggregates(void) { return 11; }
__attribute__((export_name("get_allocations"))) u32 get_allocations(void) { return 0; }
