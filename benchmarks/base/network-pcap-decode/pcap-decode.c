#include <stdint.h>

#define MAX_INPUT 262144u
#define MAX_OUTPUT 4096u
#define MAX_FLOWS 16u
#define HEADER_WORDS 16u
#define FLOW_WORDS 9u
#define RESULT_MAGIC 0x50434150u

typedef struct {
  uint32_t used, protocol, src, dst, src_port, dst_port;
  uint32_t packets, payload_bytes, app_kind, app_messages;
  uint32_t next_sequence, reassembly_len;
  uint8_t reassembly[256];
} Flow;

static uint8_t input_buffer[MAX_INPUT];
static uint8_t output_buffer[MAX_OUTPUT];
static Flow flows[MAX_FLOWS];
static uint32_t packet_records, ethernet_headers, ipv4_headers, tcp_headers, udp_headers;
static uint32_t dns_messages, http_messages, dns_pointers, reassembly_appends;
static uint32_t malformed, probes, packet_bytes, flow_count, result_len;

static uint16_t be16(const uint8_t *p) { return (uint16_t)(((uint16_t)p[0] << 8) | p[1]); }
static uint32_t be32(const uint8_t *p) {
  return ((uint32_t)p[0] << 24) | ((uint32_t)p[1] << 16) | ((uint32_t)p[2] << 8) | p[3];
}
static uint32_t le32(const uint8_t *p) {
  return (uint32_t)p[0] | ((uint32_t)p[1] << 8) | ((uint32_t)p[2] << 16) | ((uint32_t)p[3] << 24);
}
static uint32_t key_hash(uint32_t protocol, uint32_t src, uint32_t dst, uint32_t sp, uint32_t dp) {
  uint32_t h = 2166136261u;
  uint32_t values[5] = {protocol, src, dst, sp, dp};
  for (uint32_t i = 0; i < 5; i++) { h ^= values[i]; h *= 16777619u; }
  return h;
}
static int same_flow(const Flow *f, uint32_t protocol, uint32_t src, uint32_t dst, uint32_t sp, uint32_t dp) {
  return f->protocol == protocol && f->src == src && f->dst == dst && f->src_port == sp && f->dst_port == dp;
}
static int starts(const uint8_t *bytes, uint32_t len, const char *text, uint32_t text_len) {
  if (len < text_len) return 0;
  for (uint32_t i = 0; i < text_len; i++) if (bytes[i] != (uint8_t)text[i]) return 0;
  return 1;
}
static int dns_valid(const uint8_t *payload, uint32_t len) {
  if (len < 12) return 0;
  uint32_t qd = be16(payload + 4), an = be16(payload + 6);
  if (qd != 1 || an > 1) return 0;
  uint32_t o = 12, labels = 0;
  while (1) {
    if (o >= len) return 0;
    uint32_t n = payload[o++];
    if (n == 0) break;
    if ((n & 0xc0u) != 0 || n > 63 || o + n > len) return 0;
    o += n;
    if (++labels > 16) return 0;
  }
  if (o + 4 > len || be16(payload + o) != 1 || be16(payload + o + 2) != 1) return 0;
  o += 4;
  if (an == 1) {
    if (o + 12 > len || (payload[o] & 0xc0u) != 0xc0u) return 0;
    uint32_t pointer_target = ((uint32_t)(payload[o] & 0x3fu) << 8) | payload[o + 1];
    if (pointer_target != 12) return 0;
    o += 2;
    uint32_t rdlen = be16(payload + o + 8);
    if (be16(payload + o) != 1 || be16(payload + o + 2) != 1 || rdlen != 4 || o + 10 + rdlen != len) return 0;
    dns_pointers++;
    return 1;
  }
  return o == len;
}
static int flow_less(const Flow *a, const Flow *b) {
  if (a->protocol != b->protocol) return a->protocol < b->protocol;
  if (a->src != b->src) return a->src < b->src;
  if (a->dst != b->dst) return a->dst < b->dst;
  if (a->src_port != b->src_port) return a->src_port < b->src_port;
  return a->dst_port < b->dst_port;
}
static void clear_all(void) {
  uint8_t *raw = (uint8_t *)flows;
  for (uint32_t i = 0; i < sizeof(flows); i++) raw[i] = 0;
  packet_records = ethernet_headers = ipv4_headers = tcp_headers = udp_headers = 0;
  dns_messages = http_messages = dns_pointers = reassembly_appends = 0;
  malformed = probes = packet_bytes = flow_count = result_len = 0;
}

__attribute__((export_name("input_ptr"))) uint32_t input_ptr(void) { return (uint32_t)(uintptr_t)input_buffer; }
__attribute__((export_name("output_ptr"))) uint32_t output_ptr(void) { return (uint32_t)(uintptr_t)output_buffer; }
__attribute__((export_name("output_len"))) uint32_t output_len(void) { return result_len; }

__attribute__((export_name("run"))) int32_t run(uint32_t length) {
  clear_all();
  if (length > MAX_INPUT) return -5;
  const uint8_t *bytes = input_buffer;
  if (length < 24 || le32(bytes) != 0xa1b2c3d4u || bytes[4] != 2 || bytes[5] != 0 || bytes[6] != 4 || bytes[7] != 0 || le32(bytes + 20) != 1) return -1;
  uint32_t offset = 24, previous_seconds = 0, previous_micros = 0;
  while (offset < length) {
    if (offset + 16 > length) return -2;
    uint32_t seconds = le32(bytes + offset), micros = le32(bytes + offset + 4);
    if (micros >= 1000000u || seconds < previous_seconds || (seconds == previous_seconds && micros < previous_micros)) return -7;
    previous_seconds = seconds; previous_micros = micros;
    uint32_t incl = le32(bytes + offset + 8), orig = le32(bytes + offset + 12);
    offset += 16;
    if (incl != orig || offset + incl > length) return -3;
    const uint8_t *packet = bytes + offset;
    offset += incl;
    packet_records++; packet_bytes += incl;
    if (incl < 14) { malformed++; continue; }
    ethernet_headers++;
    if (be16(packet + 12) != 0x0800u || incl < 34) { malformed++; continue; }
    uint32_t ip = 14, ihl = (packet[ip] & 15u) * 4u;
    ipv4_headers++;
    uint32_t total = be16(packet + ip + 2);
    if ((packet[ip] >> 4) != 4 || ihl != 20 || total < ihl || ip + total > incl) { malformed++; continue; }
    if ((be16(packet + ip + 6) & 0x3fffu) != 0) { malformed++; continue; }
    uint32_t protocol = packet[ip + 9], src = be32(packet + ip + 12), dst = be32(packet + ip + 16);
    uint32_t transport = ip + ihl, sp, dp, payload_offset, sequence = 0;
    if (protocol == 6) {
      if (transport + 20 > ip + total) { malformed++; continue; }
      uint32_t tcp_len = (packet[transport + 12] >> 4) * 4u;
      if (tcp_len != 20 || transport + tcp_len > ip + total) { malformed++; continue; }
      tcp_headers++; sp = be16(packet + transport); dp = be16(packet + transport + 2);
      sequence = be32(packet + transport + 4); payload_offset = transport + tcp_len;
    } else if (protocol == 17) {
      if (transport + 8 > ip + total) { malformed++; continue; }
      uint32_t udp_len = be16(packet + transport + 4);
      if (udp_len < 8 || transport + udp_len != ip + total) { malformed++; continue; }
      udp_headers++; sp = be16(packet + transport); dp = be16(packet + transport + 2); payload_offset = transport + 8;
    } else { malformed++; continue; }
    uint32_t payload_len = ip + total - payload_offset;
    const uint8_t *payload = packet + payload_offset;
    uint32_t slot = key_hash(protocol, src, dst, sp, dp) & (MAX_FLOWS - 1u);
    Flow *f = 0;
    for (uint32_t attempt = 0; attempt < MAX_FLOWS; attempt++) {
      probes++;
      if (!flows[slot].used) {
        f = &flows[slot];
        f->used = 1; f->protocol = protocol; f->src = src; f->dst = dst; f->src_port = sp; f->dst_port = dp; f->next_sequence = sequence;
        flow_count++;
        break;
      }
      if (same_flow(&flows[slot], protocol, src, dst, sp, dp)) { f = &flows[slot]; break; }
      slot = (slot + 1u) & (MAX_FLOWS - 1u);
    }
    if (!f) return -8;
    f->packets++; f->payload_bytes += payload_len;
    if (protocol == 6) {
      if (f->packets > 1 && sequence != f->next_sequence) { malformed++; f->packets--; f->payload_bytes -= payload_len; continue; }
      f->next_sequence = sequence + payload_len;
      if (f->reassembly_len + payload_len > 256) return -4;
      for (uint32_t i = 0; i < payload_len; i++) f->reassembly[f->reassembly_len + i] = payload[i];
      f->reassembly_len += payload_len; reassembly_appends++;
    } else if ((sp == 53 || dp == 53) && dns_valid(payload, payload_len)) {
      f->app_kind = 2; f->app_messages++; dns_messages++;
    } else malformed++;
  }
  Flow ordered[MAX_FLOWS];
  uint32_t count = 0;
  for (uint32_t i = 0; i < MAX_FLOWS; i++) {
    if (!flows[i].used) continue;
    if (flows[i].protocol == 6) {
      if (starts(flows[i].reassembly, flows[i].reassembly_len, "GET ", 4) || starts(flows[i].reassembly, flows[i].reassembly_len, "HTTP/", 5)) {
        flows[i].app_kind = 1; flows[i].app_messages = 1; http_messages++;
      } else malformed++;
    }
    ordered[count++] = flows[i];
  }
  for (uint32_t i = 1; i < count; i++) {
    Flow value = ordered[i];
    uint32_t j = i;
    while (j > 0 && flow_less(&value, &ordered[j - 1])) { ordered[j] = ordered[j - 1]; j--; }
    ordered[j] = value;
  }
  uint32_t *out = (uint32_t *)(void *)output_buffer;
  result_len = (HEADER_WORDS + count * FLOW_WORDS) * 4u;
  if (result_len > MAX_OUTPUT) return -6;
  uint32_t header[HEADER_WORDS] = {RESULT_MAGIC, 1, packet_records, ethernet_headers, ipv4_headers, tcp_headers, udp_headers, dns_messages, http_messages, dns_pointers, reassembly_appends, malformed, count, probes, packet_bytes, HEADER_WORDS + count * FLOW_WORDS};
  for (uint32_t i = 0; i < HEADER_WORDS; i++) out[i] = header[i];
  for (uint32_t i = 0; i < count; i++) {
    uint32_t *r = out + HEADER_WORDS + i * FLOW_WORDS;
    r[0] = ordered[i].protocol; r[1] = ordered[i].src; r[2] = ordered[i].dst; r[3] = ordered[i].src_port; r[4] = ordered[i].dst_port;
    r[5] = ordered[i].packets; r[6] = ordered[i].payload_bytes; r[7] = ordered[i].app_kind; r[8] = ordered[i].app_messages;
  }
  return 0;
}
