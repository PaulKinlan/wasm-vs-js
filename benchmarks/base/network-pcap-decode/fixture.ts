const encoder = new TextEncoder();

function be16(value: number): number[] {
  return [(value >>> 8) & 255, value & 255];
}

function be32(value: number): number[] {
  return [(value >>> 24) & 255, (value >>> 16) & 255, (value >>> 8) & 255, value & 255];
}

function ethernet(payload: number[]): Uint8Array {
  return Uint8Array.from([
    0x02,
    0,
    0,
    0,
    0,
    2,
    0x02,
    0,
    0,
    0,
    0,
    1,
    0x08,
    0x00,
    ...payload,
  ]);
}

function ipv4(
  protocol: number,
  src: number[],
  dst: number[],
  payload: number[],
  flagsOffset = 0,
): number[] {
  const totalLength = 20 + payload.length;
  return [
    0x45,
    0,
    ...be16(totalLength),
    0x12,
    0x34,
    ...be16(flagsOffset),
    64,
    protocol,
    0,
    0,
    ...src,
    ...dst,
    ...payload,
  ];
}

function tcp(srcPort: number, dstPort: number, sequence: number, payload: Uint8Array): number[] {
  return [
    ...be16(srcPort),
    ...be16(dstPort),
    ...be32(sequence),
    0,
    0,
    0,
    0,
    0x50,
    0x18,
    0x20,
    0,
    0,
    0,
    0,
    0,
    ...payload,
  ];
}

function udp(srcPort: number, dstPort: number, payload: Uint8Array): number[] {
  return [...be16(srcPort), ...be16(dstPort), ...be16(8 + payload.length), 0, 0, ...payload];
}

function dnsName(...labels: string[]): number[] {
  const out: number[] = [];
  for (const label of labels) out.push(label.length, ...encoder.encode(label));
  out.push(0);
  return out;
}

function dnsQuery(): Uint8Array {
  return Uint8Array.from([
    0x12,
    0x34,
    0x01,
    0,
    0,
    1,
    0,
    0,
    0,
    0,
    0,
    0,
    ...dnsName("example", "test"),
    0,
    1,
    0,
    1,
  ]);
}

function dnsResponse(): Uint8Array {
  return Uint8Array.from([
    0x12,
    0x34,
    0x81,
    0x80,
    0,
    1,
    0,
    1,
    0,
    0,
    0,
    0,
    ...dnsName("example", "test"),
    0,
    1,
    0,
    1,
    0xc0,
    0x0c,
    0,
    1,
    0,
    1,
    0,
    0,
    0,
    60,
    0,
    4,
    192,
    0,
    2,
    1,
  ]);
}

function writeU32LE(out: number[], value: number) {
  out.push(value & 255, (value >>> 8) & 255, (value >>> 16) & 255, (value >>> 24) & 255);
}

export const FIXTURE_VERSION = "pcap-project-generated-v1";
export const FIXED_PACKET_COUNT = 8;

export function generatePcapFixture(): Uint8Array {
  const client = [192, 0, 2, 10];
  const server = [198, 51, 100, 20];
  const resolver = [203, 0, 113, 53];
  const requestA = encoder.encode("GET /index HTTP/1.1\r\nHost:");
  const requestB = encoder.encode(" example.test\r\n\r\n");
  const response = encoder.encode("HTTP/1.1 200 OK\r\nContent-Length: 2\r\n\r\nOK");
  const packets: Uint8Array[] = [
    ethernet(ipv4(6, client, server, tcp(49152, 80, 1, requestA))),
    ethernet(ipv4(6, client, server, tcp(49152, 80, 1 + requestA.length, requestB))),
    ethernet(ipv4(6, server, client, tcp(80, 49152, 7, response))),
    ethernet(ipv4(17, client, resolver, udp(53000, 53, dnsQuery()))),
    ethernet(ipv4(17, resolver, client, udp(53, 53000, dnsResponse()))),
    Uint8Array.from([0x02, 0, 0, 0, 0, 2, 0x02, 0, 0, 0]),
    ethernet(ipv4(6, client, server, tcp(49153, 80, 1, encoder.encode("fragment")), 0x2000)),
    ethernet([
      0x45,
      0,
      0x0f,
      0xa0,
      0,
      1,
      0,
      0,
      64,
      6,
      0,
      0,
      ...client,
      ...server,
    ]),
  ];

  const out: number[] = [];
  // Classic PCAP, little-endian, microsecond timestamps, Ethernet link type.
  out.push(0xd4, 0xc3, 0xb2, 0xa1, 2, 0, 4, 0);
  writeU32LE(out, 0);
  writeU32LE(out, 0);
  writeU32LE(out, 65_535);
  writeU32LE(out, 1);
  packets.forEach((packet, index) => {
    writeU32LE(out, 1_700_000_000 + index);
    writeU32LE(out, index * 1_000);
    writeU32LE(out, packet.length);
    writeU32LE(out, packet.length);
    out.push(...packet);
  });
  return Uint8Array.from(out);
}
