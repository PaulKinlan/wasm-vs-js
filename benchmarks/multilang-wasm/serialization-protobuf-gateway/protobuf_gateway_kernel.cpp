// protobuf_gateway_kernel.cpp — multilang compute core for
// serialization.protobuf-gateway.v1. Same ABI + oracle as
// protobuf_gateway_kernel.c. See the C file for the ABI docs.

using u8 = unsigned char;
using u32 = unsigned int;
using i32 = int;
using u64 = unsigned long long;

constexpr u32 FIXTURE_OFFSET = 3145728u;
constexpr u32 RES_OFFSET = 6291456u;
constexpr u32 MESSAGE_COUNT = 10000u;

static u8 fixture_at(u32 off) {
  return *(reinterpret_cast<u8 *>(FIXTURE_OFFSET) + off);
}
static u32 read_u32_le(u32 off) {
  return static_cast<u32>(fixture_at(off)) |
    (static_cast<u32>(fixture_at(off + 1)) << 8) |
    (static_cast<u32>(fixture_at(off + 2)) << 16) |
    (static_cast<u32>(fixture_at(off + 3)) << 24);
}

static u32 fnv;
static void fnv_reset() { fnv = 0x811c9dc5u; }
static void fnv_mix_byte(u8 b) { fnv = (fnv ^ static_cast<u32>(b)) * 0x01000193u; }
static void fnv_mix_u32(u32 v) {
  fnv_mix_byte(static_cast<u8>(v & 0xffu));
  fnv_mix_byte(static_cast<u8>((v >> 8) & 0xffu));
  fnv_mix_byte(static_cast<u8>((v >> 16) & 0xffu));
  fnv_mix_byte(static_cast<u8>((v >> 24) & 0xffu));
}

static i32 read_varint(u32 *cur, u32 end, u32 *lo, u32 *hi, u32 *used) {
  u64 value = 0;
  u32 shift = 0;
  u32 bytes = 0;
  for (u32 i = 0; i < 10u; i++) {
    if (*cur >= end) return -1;
    u8 b = fixture_at(*cur);
    (*cur)++;
    bytes++;
    value |= (static_cast<u64>(b & 0x7fu)) << shift;
    if (!(b & 0x80u)) {
      *lo = static_cast<u32>(value & 0xffffffffu);
      *hi = static_cast<u32>(value >> 32);
      *used = bytes;
      return 0;
    }
    shift += 7u;
  }
  return -2;
}

static i32 skip_field(u32 *cur, u32 end, u32 wire, u32 *varint_bytes_out) {
  *varint_bytes_out = 0;
  if (wire == 0u) {
    u32 lo, hi, used;
    if (read_varint(cur, end, &lo, &hi, &used) != 0) return -1;
    *varint_bytes_out = used;
    return 0;
  }
  if (wire == 1u) {
    if (*cur > end || end - *cur < 8u) return -1;
    *cur += 8u;
    return 0;
  }
  if (wire == 2u) {
    u32 lo, hi, used;
    if (read_varint(cur, end, &lo, &hi, &used) != 0) return -1;
    if (hi != 0 || lo > end - *cur) return -1;
    *cur += lo;
    *varint_bytes_out = used;
    return 0;
  }
  if (wire == 5u) {
    if (*cur > end || end - *cur < 4u) return -1;
    *cur += 4u;
    return 0;
  }
  return -1;
}

static i32 parse_map_entry(u32 start, u32 end, u32 *count) {
  u32 cur = start;
  while (cur < end) {
    u32 tag_lo, tag_hi, used;
    if (read_varint(&cur, end, &tag_lo, &tag_hi, &used) != 0) return -1;
    u32 wire = tag_lo & 7u;
    u32 vb;
    if (skip_field(&cur, end, wire, &vb) != 0) return -1;
  }
  (*count)++;
  return 0;
}

static u32 m_id_lo, m_id_hi;
static u32 m_active;
static u32 m_status;
static u32 m_name_len;
static u32 m_tag_count;
static u32 m_map_count;
static u32 m_payload_len;
static u32 m_choice_kind;
static u32 m_note_len;
static u32 m_code;

static void reset_message() {
  m_id_lo = 0;
  m_id_hi = 0;
  m_active = 0;
  m_status = 0;
  m_name_len = 0;
  m_tag_count = 0;
  m_map_count = 0;
  m_payload_len = 0;
  m_choice_kind = 0;
  m_note_len = 0;
  m_code = 0;
}

static i32 decode_message(
  u32 start, u32 end,
  u32 *fields_out, u32 *varint_bytes_out, u32 *unknown_fields_out
) {
  reset_message();
  u32 cur = start;
  u32 fields = 0;
  u32 varint_bytes = 0;
  u32 unknown_fields = 0;
  while (cur < end) {
    u32 tag_lo, tag_hi, used;
    if (read_varint(&cur, end, &tag_lo, &tag_hi, &used) != 0) return -1;
    if (tag_hi != 0) return -2;
    u32 field = tag_lo >> 3;
    u32 wire = tag_lo & 7u;
    if (field == 0) return -3;
    fields++;
    varint_bytes += used;
    if (field == 1u && wire == 0u) {
      u32 lo, hi, u2;
      if (read_varint(&cur, end, &lo, &hi, &u2) != 0) return -4;
      m_id_lo = lo;
      m_id_hi = hi;
      varint_bytes += u2;
    } else if (field == 2u && wire == 2u) {
      u32 lo, hi, u2;
      if (read_varint(&cur, end, &lo, &hi, &u2) != 0) return -5;
      if (hi != 0 || lo > end - cur) return -6;
      m_name_len = lo;
      cur += lo;
      varint_bytes += u2;
    } else if (field == 3u && wire == 0u) {
      u32 lo, hi, u2;
      if (read_varint(&cur, end, &lo, &hi, &u2) != 0) return -7;
      m_active = (lo != 0u || hi != 0u) ? 1u : 0u;
      varint_bytes += u2;
    } else if (field == 4u && wire == 1u) {
      if (end - cur < 8u) return -8;
      cur += 8u;
    } else if (field == 5u && wire == 0u) {
      u32 lo, hi, u2;
      if (read_varint(&cur, end, &lo, &hi, &u2) != 0) return -9;
      m_status = lo;
      varint_bytes += u2;
    } else if (field == 6u && wire == 2u) {
      u32 lo, hi, u2;
      if (read_varint(&cur, end, &lo, &hi, &u2) != 0) return -10;
      if (hi != 0 || lo > end - cur) return -11;
      cur += lo;
      m_tag_count++;
      varint_bytes += u2;
    } else if (field == 7u && wire == 2u) {
      u32 lo, hi, u2;
      if (read_varint(&cur, end, &lo, &hi, &u2) != 0) return -12;
      if (hi != 0 || lo > end - cur) return -13;
      if (parse_map_entry(cur, cur + lo, &m_map_count) != 0) return -14;
      cur += lo;
      varint_bytes += u2;
    } else if (field == 8u && wire == 2u) {
      u32 lo, hi, u2;
      if (read_varint(&cur, end, &lo, &hi, &u2) != 0) return -15;
      if (hi != 0 || lo > end - cur) return -16;
      m_payload_len = lo;
      cur += lo;
      varint_bytes += u2;
    } else if (field == 9u && wire == 2u) {
      u32 lo, hi, u2;
      if (read_varint(&cur, end, &lo, &hi, &u2) != 0) return -17;
      if (hi != 0 || lo > end - cur) return -18;
      m_note_len = lo;
      m_choice_kind = 9u;
      cur += lo;
      varint_bytes += u2;
    } else if (field == 10u && wire == 0u) {
      u32 lo, hi, u2;
      if (read_varint(&cur, end, &lo, &hi, &u2) != 0) return -19;
      m_code = lo;
      m_choice_kind = 10u;
      varint_bytes += u2;
    } else if (field == 11u && wire == 5u) {
      if (end - cur < 4u) return -20;
      cur += 4u;
    } else {
      u32 vb = 0;
      if (skip_field(&cur, end, wire, &vb) != 0) return -21;
      unknown_fields++;
      varint_bytes += vb;
    }
  }
  if (cur != end) return -22;
  *fields_out = fields;
  *varint_bytes_out = varint_bytes;
  *unknown_fields_out = unknown_fields;
  return 0;
}

static u32 mod3_u64(u32 lo, u32 hi) {
  u32 r = 0;
  for (i32 i = 31; i >= 0; i--) {
    r = (r << 1) | ((hi >> i) & 1u);
    if (r >= 3u) r -= 3u;
  }
  for (i32 i = 31; i >= 0; i--) {
    r = (r << 1) | ((lo >> i) & 1u);
    if (r >= 3u) r -= 3u;
  }
  return r;
}

extern "C" __attribute__((export_name("protobuf_gateway")))
i32 protobuf_gateway(u32 fixture_len) {
  fnv_reset();
  if (fixture_len < 4u) return -1;
  u32 count = read_u32_le(0);
  if (count != MESSAGE_COUNT) return -2;
  u32 cur = 4u;
  u32 c_messages = 0;
  u32 c_fields = 0;
  u32 c_varint_bytes = 0;
  u32 c_unknown_fields = 0;
  u32 c_filtered = 0;
  for (u32 i = 0; i < MESSAGE_COUNT; i++) {
    if (cur + 4u > fixture_len) return -3;
    u32 n = read_u32_le(cur);
    cur += 4u;
    if (cur + n > fixture_len) return -4;
    u32 f = 0, vb = 0, uf = 0;
    if (decode_message(cur, cur + n, &f, &vb, &uf) != 0) return -5;
    cur += n;
    c_messages++;
    c_fields += f;
    c_varint_bytes += vb;
    c_unknown_fields += uf;
    u32 pass = (m_active && m_status != 3u && mod3_u64(m_id_lo, m_id_hi) == 0u)
      ? 1u : 0u;
    if (pass) c_filtered++;
    fnv_mix_u32(m_id_lo);
    fnv_mix_u32(m_id_hi);
    fnv_mix_u32(m_active);
    fnv_mix_u32(m_status);
    fnv_mix_u32(m_name_len);
    fnv_mix_u32(m_tag_count);
    fnv_mix_u32(m_map_count);
    fnv_mix_u32(m_payload_len);
    fnv_mix_u32(m_choice_kind);
    fnv_mix_u32(m_note_len);
    fnv_mix_u32(m_code);
    fnv_mix_u32(pass);
  }
  if (cur != fixture_len) return -6;

  u32 *results = reinterpret_cast<u32 *>(RES_OFFSET);
  results[0] = c_messages;
  results[1] = c_fields;
  results[2] = c_varint_bytes;
  results[3] = c_unknown_fields;
  results[4] = c_filtered;
  results[5] = fixture_len;
  results[6] = fnv;
  results[7] = 0;
  return 0;
}
