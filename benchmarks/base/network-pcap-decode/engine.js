export const RESULT_MAGIC = 0x50434150;
export const RESULT_HEADER_WORDS = 16;
export const RESULT_FLOW_WORDS = 9;
export const MAX_FLOWS = 16;

function u16be(bytes, offset) {
  return (bytes[offset] << 8) | bytes[offset + 1];
}
function u32be(bytes, offset) {
  return ((bytes[offset] << 24) | (bytes[offset + 1] << 16) | (bytes[offset + 2] << 8) |
    bytes[offset + 3]) >>> 0;
}
function u32le(bytes, offset) {
  return (bytes[offset] | (bytes[offset + 1] << 8) | (bytes[offset + 2] << 16) |
    (bytes[offset + 3] << 24)) >>> 0;
}
function keyHash(protocol, src, dst, srcPort, dstPort) {
  let hash = 2166136261 >>> 0;
  hash = Math.imul(hash ^ protocol, 16777619) >>> 0;
  hash = Math.imul(hash ^ src, 16777619) >>> 0;
  hash = Math.imul(hash ^ dst, 16777619) >>> 0;
  hash = Math.imul(hash ^ srcPort, 16777619) >>> 0;
  return Math.imul(hash ^ dstPort, 16777619) >>> 0;
}
function compareFlow(a, b) {
  for (const key of ["protocol", "src", "dst", "srcPort", "dstPort"]) {
    if (a[key] !== b[key]) return a[key] < b[key] ? -1 : 1;
  }
  return 0;
}
function sameFlow(flow, protocol, src, dst, srcPort, dstPort) {
  return flow.protocol === protocol && flow.src === src && flow.dst === dst &&
    flow.srcPort === srcPort && flow.dstPort === dstPort;
}
function startsAscii(bytes, text) {
  if (bytes.length < text.length) return false;
  for (let i = 0; i < text.length; i++) if (bytes[i] !== text.charCodeAt(i)) return false;
  return true;
}

function validateDns(payload, counters) {
  if (payload.length < 12) return false;
  const qd = u16be(payload, 4);
  const an = u16be(payload, 6);
  if (qd !== 1 || an > 1) return false;
  let offset = 12;
  let labels = 0;
  while (true) {
    if (offset >= payload.length) return false;
    const length = payload[offset++];
    if (length === 0) break;
    if ((length & 0xc0) !== 0 || length > 63 || offset + length > payload.length) return false;
    offset += length;
    if (++labels > 16) return false;
  }
  if (
    offset + 4 > payload.length || u16be(payload, offset) !== 1 ||
    u16be(payload, offset + 2) !== 1
  ) return false;
  offset += 4;
  if (an === 1) {
    if (offset + 12 > payload.length) return false;
    if ((payload[offset] & 0xc0) !== 0xc0) return false;
    const pointerTarget = ((payload[offset] & 0x3f) << 8) | payload[offset + 1];
    if (pointerTarget !== 12) return false;
    offset += 2;
    const rdLength = u16be(payload, offset + 8);
    if (
      u16be(payload, offset) !== 1 || u16be(payload, offset + 2) !== 1 ||
      rdLength !== 4
    ) return false;
    offset += 10;
    if (offset + rdLength !== payload.length) return false;
    counters.dnsCompressionPointers++;
  } else if (offset !== payload.length) return false;
  return true;
}

export function runPcapJavaScript(input) {
  const bytes = input instanceof Uint8Array ? input : new Uint8Array(input);
  const counters = {
    packetRecords: 0,
    ethernetHeaders: 0,
    ipv4Headers: 0,
    tcpHeaders: 0,
    udpHeaders: 0,
    dnsMessages: 0,
    httpMessages: 0,
    dnsCompressionPointers: 0,
    tcpReassemblyAppends: 0,
    malformedPackets: 0,
    flowTableProbes: 0,
    packetBytes: 0,
    allocations: 0,
    boundaryCrossings: 0,
  };
  if (
    bytes.length < 24 || u32le(bytes, 0) !== 0xa1b2c3d4 || u16be(bytes, 4) !== 0x0200 ||
    u32le(bytes, 20) !== 1
  ) throw new Error("unsupported classic PCAP header");
  // Version fields are little-endian bytes 02 00 04 00.
  if (bytes[4] !== 2 || bytes[5] !== 0 || bytes[6] !== 4 || bytes[7] !== 0) {
    throw new Error("unsupported PCAP version");
  }
  const slots = new Array(MAX_FLOWS).fill(null);
  counters.allocations++;
  let offset = 24;
  let previousSeconds = 0;
  let previousMicros = 0;
  while (offset < bytes.length) {
    if (offset + 16 > bytes.length) throw new Error("truncated PCAP record header");
    const seconds = u32le(bytes, offset);
    const micros = u32le(bytes, offset + 4);
    if (
      micros >= 1_000_000 || seconds < previousSeconds ||
      (seconds === previousSeconds && micros < previousMicros)
    ) throw new Error("invalid PCAP timestamp");
    previousSeconds = seconds;
    previousMicros = micros;
    const inclLen = u32le(bytes, offset + 8);
    const origLen = u32le(bytes, offset + 12);
    offset += 16;
    if (inclLen !== origLen || offset + inclLen > bytes.length) {
      throw new Error("invalid PCAP record length");
    }
    const packet = bytes.subarray(offset, offset + inclLen);
    offset += inclLen;
    counters.packetRecords++;
    counters.packetBytes += inclLen;
    if (packet.length < 14) {
      counters.malformedPackets++;
      continue;
    }
    counters.ethernetHeaders++;
    if (u16be(packet, 12) !== 0x0800 || packet.length < 34) {
      counters.malformedPackets++;
      continue;
    }
    const ip = 14;
    const ihl = (packet[ip] & 15) * 4;
    counters.ipv4Headers++;
    const totalLength = u16be(packet, ip + 2);
    if (
      (packet[ip] >>> 4) !== 4 || ihl !== 20 || totalLength < ihl ||
      ip + totalLength > packet.length
    ) {
      counters.malformedPackets++;
      continue;
    }
    const flagsOffset = u16be(packet, ip + 6);
    if ((flagsOffset & 0x3fff) !== 0) {
      counters.malformedPackets++;
      continue;
    }
    const protocol = packet[ip + 9];
    const src = u32be(packet, ip + 12);
    const dst = u32be(packet, ip + 16);
    const transport = ip + ihl;
    let srcPort;
    let dstPort;
    let payloadOffset;
    let sequence = 0;
    if (protocol === 6) {
      if (transport + 20 > ip + totalLength) {
        counters.malformedPackets++;
        continue;
      }
      const tcpLength = (packet[transport + 12] >>> 4) * 4;
      if (tcpLength !== 20 || transport + tcpLength > ip + totalLength) {
        counters.malformedPackets++;
        continue;
      }
      counters.tcpHeaders++;
      srcPort = u16be(packet, transport);
      dstPort = u16be(packet, transport + 2);
      sequence = u32be(packet, transport + 4);
      payloadOffset = transport + tcpLength;
    } else if (protocol === 17) {
      if (transport + 8 > ip + totalLength) {
        counters.malformedPackets++;
        continue;
      }
      const udpLength = u16be(packet, transport + 4);
      if (udpLength < 8 || transport + udpLength !== ip + totalLength) {
        counters.malformedPackets++;
        continue;
      }
      counters.udpHeaders++;
      srcPort = u16be(packet, transport);
      dstPort = u16be(packet, transport + 2);
      payloadOffset = transport + 8;
    } else {
      counters.malformedPackets++;
      continue;
    }
    const payload = packet.subarray(payloadOffset, ip + totalLength);
    let slot = keyHash(protocol, src, dst, srcPort, dstPort) & (MAX_FLOWS - 1);
    let flow = null;
    for (let attempt = 0; attempt < MAX_FLOWS; attempt++) {
      counters.flowTableProbes++;
      const existing = slots[slot];
      if (!existing) {
        flow = {
          protocol,
          src,
          dst,
          srcPort,
          dstPort,
          packets: 0,
          payloadBytes: 0,
          appKind: 0,
          appMessages: 0,
          reassembly: [],
          nextSequence: sequence,
        };
        slots[slot] = flow;
        // One retained flow record and one retained reassembly array.
        counters.allocations += 2;
        break;
      }
      if (sameFlow(existing, protocol, src, dst, srcPort, dstPort)) {
        flow = existing;
        break;
      }
      slot = (slot + 1) & (MAX_FLOWS - 1);
    }
    if (!flow) throw new Error("flow table capacity exceeded");
    flow.packets++;
    flow.payloadBytes += payload.length;
    if (protocol === 6) {
      if (flow.packets > 1 && sequence !== flow.nextSequence) {
        counters.malformedPackets++;
        flow.packets--;
        flow.payloadBytes -= payload.length;
        continue;
      }
      flow.nextSequence = (sequence + payload.length) >>> 0;
      if (flow.reassembly.length + payload.length > 256) {
        throw new Error("TCP reassembly bound exceeded");
      }
      flow.reassembly.push(...payload);
      counters.tcpReassemblyAppends++;
    } else if ((srcPort === 53 || dstPort === 53) && validateDns(payload, counters)) {
      flow.appKind = 2;
      flow.appMessages++;
      counters.dnsMessages++;
    } else {
      counters.malformedPackets++;
    }
  }
  const flows = slots.filter(Boolean);
  counters.allocations++;
  for (const flow of flows) {
    if (flow.protocol === 6) {
      const aggregate = Uint8Array.from(flow.reassembly);
      counters.allocations++;
      if (startsAscii(aggregate, "GET ") || startsAscii(aggregate, "HTTP/")) {
        flow.appKind = 1;
        flow.appMessages = 1;
        counters.httpMessages++;
      } else counters.malformedPackets++;
    }
  }
  flows.sort(compareFlow);
  const words = new Uint32Array(RESULT_HEADER_WORDS + flows.length * RESULT_FLOW_WORDS);
  counters.allocations++;
  words.set([
    RESULT_MAGIC,
    1,
    counters.packetRecords,
    counters.ethernetHeaders,
    counters.ipv4Headers,
    counters.tcpHeaders,
    counters.udpHeaders,
    counters.dnsMessages,
    counters.httpMessages,
    counters.dnsCompressionPointers,
    counters.tcpReassemblyAppends,
    counters.malformedPackets,
    flows.length,
    counters.flowTableProbes,
    counters.packetBytes,
    words.length,
  ]);
  flows.forEach((flow, index) => {
    words.set([
      flow.protocol,
      flow.src,
      flow.dst,
      flow.srcPort,
      flow.dstPort,
      flow.packets,
      flow.payloadBytes,
      flow.appKind,
      flow.appMessages,
    ], RESULT_HEADER_WORDS + index * RESULT_FLOW_WORDS);
  });
  const output = new Uint8Array(words.buffer);
  counters.allocations++;
  return {
    bytes: output,
    counters: { ...counters, flows: flows.length, outputBytes: words.byteLength },
  };
}
