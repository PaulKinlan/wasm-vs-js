#![no_std]

// network-pcap-decode multilang kernel (Rust no_std cdylib).
// Mirrors benchmarks/base/network-pcap-decode/pcap-decode.c exactly:
// same packet parsing, flow tracking, DNS validation, HTTP detection,
// TCP reassembly, insertion sort, and result serialization — bit-identical
// output bytes. No libc, no allocations, no SIMD, no threads.

const MAX_INPUT: usize = 262_144;
const MAX_OUTPUT: usize = 4_096;
const MAX_FLOWS: usize = 16;
const HEADER_WORDS: usize = 16;
const FLOW_WORDS: usize = 9;
const RESULT_MAGIC: u32 = 0x50434150;

#[derive(Clone, Copy)]
struct Flow {
    used: u32, protocol: u32, src: u32, dst: u32, src_port: u32, dst_port: u32,
    packets: u32, payload_bytes: u32, app_kind: u32, app_messages: u32,
    next_sequence: u32, reassembly_len: u32,
    reassembly: [u8; 256],
}

impl Flow {
    const fn zero() -> Self {
        Flow { used: 0, protocol: 0, src: 0, dst: 0, src_port: 0, dst_port: 0,
            packets: 0, payload_bytes: 0, app_kind: 0, app_messages: 0,
            next_sequence: 0, reassembly_len: 0, reassembly: [0; 256] }
    }
}

static mut INPUT_BUFFER: [u8; MAX_INPUT] = [0; MAX_INPUT];
static mut OUTPUT_BUFFER: [u8; MAX_OUTPUT] = [0; MAX_OUTPUT];
static mut FLOWS: [Flow; MAX_FLOWS] = [Flow::zero(); MAX_FLOWS];
static mut PACKET_RECORDS: u32 = 0;
static mut ETHERNET_HEADERS: u32 = 0;
static mut IPV4_HEADERS: u32 = 0;
static mut TCP_HEADERS: u32 = 0;
static mut UDP_HEADERS: u32 = 0;
static mut DNS_MESSAGES: u32 = 0;
static mut HTTP_MESSAGES: u32 = 0;
static mut DNS_POINTERS: u32 = 0;
static mut REASSEMBLY_APPENDS: u32 = 0;
static mut MALFORMED: u32 = 0;
static mut PROBES: u32 = 0;
static mut PACKET_BYTES: u32 = 0;
static mut FLOW_COUNT: u32 = 0;
static mut RESULT_LEN: u32 = 0;

fn be16(bytes: &[u8], o: usize) -> u16 { ((bytes[o] as u16) << 8) | bytes[o + 1] as u16 }
fn be32(bytes: &[u8], o: usize) -> u32 {
    ((bytes[o] as u32) << 24) | ((bytes[o+1] as u32) << 16) | ((bytes[o+2] as u32) << 8) | bytes[o+3] as u32
}
fn le32(bytes: &[u8], o: usize) -> u32 {
    (bytes[o] as u32) | ((bytes[o+1] as u32) << 8) | ((bytes[o+2] as u32) << 16) | ((bytes[o+3] as u32) << 24)
}
fn key_hash(protocol: u32, src: u32, dst: u32, sp: u32, dp: u32) -> u32 {
    let mut h: u32 = 2166136261;
    for &v in &[protocol, src, dst, sp, dp] { h ^= v; h = h.wrapping_mul(16777619); }
    h
}
fn same_flow(f: &Flow, protocol: u32, src: u32, dst: u32, sp: u32, dp: u32) -> bool {
    f.protocol == protocol && f.src == src && f.dst == dst && f.src_port == sp && f.dst_port == dp
}
fn starts(bytes: &[u8], len: usize, text: &[u8]) -> bool {
    if len < text.len() { return false; }
    for i in 0..text.len() { if bytes[i] != text[i] { return false; } }
    true
}
fn flow_less(a: &Flow, b: &Flow) -> bool {
    if a.protocol != b.protocol { return a.protocol < b.protocol; }
    if a.src != b.src { return a.src < b.src; }
    if a.dst != b.dst { return a.dst < b.dst; }
    if a.src_port != b.src_port { return a.src_port < b.src_port; }
    a.dst_port < b.dst_port
}

unsafe fn clear_all() {
    FLOWS = [Flow::zero(); MAX_FLOWS];
    PACKET_RECORDS = 0; ETHERNET_HEADERS = 0; IPV4_HEADERS = 0; TCP_HEADERS = 0; UDP_HEADERS = 0;
    DNS_MESSAGES = 0; HTTP_MESSAGES = 0; DNS_POINTERS = 0; REASSEMBLY_APPENDS = 0;
    MALFORMED = 0; PROBES = 0; PACKET_BYTES = 0; FLOW_COUNT = 0; RESULT_LEN = 0;
}

unsafe fn dns_valid(payload: &[u8], len: usize) -> bool {
    if len < 12 { return false; }
    let qd = be16(payload, 4); let an = be16(payload, 6);
    if qd != 1 || an > 1 { return false; }
    let mut o = 12; let mut labels = 0;
    loop {
        if o >= len { return false; }
        let n = payload[o] as usize; o += 1;
        if n == 0 { break; }
        if (n & 0xc0) != 0 || n > 63 || o + n > len { return false; }
        o += n;
        labels += 1;
        if labels > 16 { return false; }
    }
    if o + 4 > len || be16(payload, o) != 1 || be16(payload, o + 2) != 1 { return false; }
    o += 4;
    if an == 1 {
        if o + 12 > len || (payload[o] & 0xc0) != 0xc0 { return false; }
        let ptr_target = (((payload[o] as u32) & 0x3f) << 8) | payload[o + 1] as u32;
        if ptr_target != 12 { return false; }
        o += 2;
        let rdlen = be16(payload, o + 8) as u32;
        if be16(payload, o) != 1 || be16(payload, o + 2) != 1 || rdlen != 4 || o + 10 + rdlen as usize != len { return false; }
        DNS_POINTERS += 1;
        return true;
    }
    o == len
}

#[no_mangle]
pub extern "C" fn input_ptr() -> u32 { unsafe { INPUT_BUFFER.as_ptr() as u32 } }
#[no_mangle]
pub extern "C" fn output_ptr() -> u32 { unsafe { OUTPUT_BUFFER.as_ptr() as u32 } }
#[no_mangle]
pub extern "C" fn output_len() -> u32 { unsafe { RESULT_LEN } }

#[no_mangle]
pub extern "C" fn run(length: u32) -> i32 {
    unsafe {
        clear_all();
        if length as usize > MAX_INPUT { return -5; }
        let bytes = &INPUT_BUFFER[..length as usize];
        let length = length as usize;
        if length < 24 || le32(bytes, 0) != 0xa1b2c3d4 || bytes[4] != 2 || bytes[5] != 0 || bytes[6] != 4 || bytes[7] != 0 || le32(bytes, 20) != 1 { return -1; }
        let mut offset = 24; let mut prev_s = 0; let mut prev_m = 0;
        while offset < length {
            if offset + 16 > length { return -2; }
            let seconds = le32(bytes, offset); let micros = le32(bytes, offset + 4);
            if micros >= 1000000 || seconds < prev_s || (seconds == prev_s && micros < prev_m) { return -7; }
            prev_s = seconds; prev_m = micros;
            let incl = le32(bytes, offset + 8); let orig = le32(bytes, offset + 12);
            offset += 16;
            if incl != orig || offset + incl as usize > length { return -3; }
            let pkt_start = offset; let incl = incl as usize;
            offset += incl;
            PACKET_RECORDS += 1; PACKET_BYTES += incl as u32;
            if incl < 14 { MALFORMED += 1; continue; }
            ETHERNET_HEADERS += 1;
            if be16(bytes, pkt_start + 12) != 0x0800 || incl < 34 { MALFORMED += 1; continue; }
            let ip = 14; let ihl = ((bytes[pkt_start + ip] & 15) as usize) * 4;
            IPV4_HEADERS += 1;
            let total = be16(bytes, pkt_start + ip + 2) as usize;
            if (bytes[pkt_start + ip] >> 4) != 4 || ihl != 20 || total < ihl || ip + total > incl { MALFORMED += 1; continue; }
            if (be16(bytes, pkt_start + ip + 6) & 0x3fff) != 0 { MALFORMED += 1; continue; }
            let protocol = bytes[pkt_start + ip + 9] as u32;
            let src = be32(bytes, pkt_start + ip + 12);
            let dst = be32(bytes, pkt_start + ip + 16);
            let transport = ip + ihl;
            let sp; let dp; let payload_offset; let sequence;
            if protocol == 6 {
                if transport + 20 > ip + total { MALFORMED += 1; continue; }
                let tcp_len = ((bytes[pkt_start + transport + 12] >> 4) as usize) * 4;
                if tcp_len != 20 || transport + tcp_len > ip + total { MALFORMED += 1; continue; }
                TCP_HEADERS += 1;
                sp = be16(bytes, pkt_start + transport) as u32;
                dp = be16(bytes, pkt_start + transport + 2) as u32;
                sequence = be32(bytes, pkt_start + transport + 4);
                payload_offset = transport + tcp_len;
            } else if protocol == 17 {
                if transport + 8 > ip + total { MALFORMED += 1; continue; }
                let udp_len = be16(bytes, pkt_start + transport + 4) as usize;
                if udp_len < 8 || transport + udp_len != ip + total { MALFORMED += 1; continue; }
                UDP_HEADERS += 1;
                sp = be16(bytes, pkt_start + transport) as u32;
                dp = be16(bytes, pkt_start + transport + 2) as u32;
                payload_offset = transport + 8;
                sequence = 0;
            } else { MALFORMED += 1; continue; }
            let payload_len = ip + total - payload_offset;
            let mut slot = (key_hash(protocol, src, dst, sp, dp) & (MAX_FLOWS as u32 - 1)) as usize;
            let mut found: Option<usize> = None;
            for _ in 0..MAX_FLOWS {
                PROBES += 1;
                if FLOWS[slot].used == 0 {
                    FLOWS[slot].used = 1; FLOWS[slot].protocol = protocol;
                    FLOWS[slot].src = src; FLOWS[slot].dst = dst;
                    FLOWS[slot].src_port = sp; FLOWS[slot].dst_port = dp;
                    FLOWS[slot].next_sequence = sequence;
                    FLOW_COUNT += 1;
                    found = Some(slot);
                    break;
                }
                if same_flow(&FLOWS[slot], protocol, src, dst, sp, dp) { found = Some(slot); break; }
                slot = (slot + 1) & (MAX_FLOWS - 1);
            }
            let fidx = match found { Some(i) => i, None => return -8 };
            FLOWS[fidx].packets += 1;
            FLOWS[fidx].payload_bytes += payload_len as u32;
            if protocol == 6 {
                if FLOWS[fidx].packets > 1 && sequence != FLOWS[fidx].next_sequence {
                    MALFORMED += 1; FLOWS[fidx].packets -= 1;
                    FLOWS[fidx].payload_bytes -= payload_len as u32;
                    continue;
                }
                FLOWS[fidx].next_sequence = sequence.wrapping_add(payload_len as u32);
                if FLOWS[fidx].reassembly_len as usize + payload_len > 256 { return -4; }
                for i in 0..payload_len {
                    FLOWS[fidx].reassembly[FLOWS[fidx].reassembly_len as usize + i] = bytes[pkt_start + payload_offset + i];
                }
                FLOWS[fidx].reassembly_len += payload_len as u32;
                REASSEMBLY_APPENDS += 1;
            } else if (sp == 53 || dp == 53) && dns_valid(&bytes[pkt_start + payload_offset..], payload_len) {
                FLOWS[fidx].app_kind = 2; FLOWS[fidx].app_messages += 1; DNS_MESSAGES += 1;
            } else { MALFORMED += 1; }
        }
        // Collect and sort flows
        let mut ordered: [Flow; MAX_FLOWS] = [Flow::zero(); MAX_FLOWS];
        let mut count = 0;
        for i in 0..MAX_FLOWS {
            if FLOWS[i].used == 0 { continue; }
            if FLOWS[i].protocol == 6 {
                if starts(&FLOWS[i].reassembly, FLOWS[i].reassembly_len as usize, b"GET ")
                    || starts(&FLOWS[i].reassembly, FLOWS[i].reassembly_len as usize, b"HTTP/") {
                    FLOWS[i].app_kind = 1; FLOWS[i].app_messages = 1; HTTP_MESSAGES += 1;
                } else { MALFORMED += 1; }
            }
            ordered[count] = FLOWS[i]; count += 1;
        }
        // Insertion sort
        for i in 1..count {
            let val = ordered[i]; let mut j = i;
            while j > 0 && flow_less(&val, &ordered[j - 1]) { ordered[j] = ordered[j - 1]; j -= 1; }
            ordered[j] = val;
        }
        // Serialize result
        RESULT_LEN = ((HEADER_WORDS + count * FLOW_WORDS) * 4) as u32;
        if RESULT_LEN as usize > MAX_OUTPUT { return -6; }
        let out = &mut OUTPUT_BUFFER;
        let header: [u32; HEADER_WORDS] = [
            RESULT_MAGIC, 1, PACKET_RECORDS, ETHERNET_HEADERS, IPV4_HEADERS,
            TCP_HEADERS, UDP_HEADERS, DNS_MESSAGES, HTTP_MESSAGES, DNS_POINTERS,
            REASSEMBLY_APPENDS, MALFORMED, count as u32, PROBES, PACKET_BYTES,
            (HEADER_WORDS + count * FLOW_WORDS) as u32,
        ];
        for i in 0..HEADER_WORDS {
            let off = i * 4;
            out[off] = (header[i] & 0xff) as u8;
            out[off+1] = ((header[i] >> 8) & 0xff) as u8;
            out[off+2] = ((header[i] >> 16) & 0xff) as u8;
            out[off+3] = ((header[i] >> 24) & 0xff) as u8;
        }
        for i in 0..count {
            let f = &ordered[i];
            let vals = [f.protocol, f.src, f.dst, f.src_port, f.dst_port,
                        f.packets, f.payload_bytes, f.app_kind, f.app_messages];
            for j in 0..FLOW_WORDS {
                let off = (HEADER_WORDS + i * FLOW_WORDS + j) * 4;
                out[off] = (vals[j] & 0xff) as u8;
                out[off+1] = ((vals[j] >> 8) & 0xff) as u8;
                out[off+2] = ((vals[j] >> 16) & 0xff) as u8;
                out[off+3] = ((vals[j] >> 24) & 0xff) as u8;
            }
        }
        0
    }
}
