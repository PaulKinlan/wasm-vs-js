export function canonicalF32Bytes(values: Float32Array): Uint8Array {
  const bytes = new Uint8Array(values.length * 4);
  const view = new DataView(bytes.buffer);
  for (let index = 0; index < values.length; index++) {
    const value = Object.is(values[index], -0) ? 0 : values[index];
    if (!Number.isFinite(value)) throw new Error(`non-finite f32 at index ${index}`);
    view.setFloat32(index * 4, value, true);
  }
  return bytes;
}

export function concatBytes(parts: readonly Uint8Array[]): Uint8Array {
  const result = new Uint8Array(parts.reduce((sum, part) => sum + part.byteLength, 0));
  let offset = 0;
  for (const part of parts) {
    result.set(part, offset);
    offset += part.byteLength;
  }
  return result;
}

export function canonicalF32Fields(fields: readonly Float32Array[]): Uint8Array {
  return concatBytes(fields.map(canonicalF32Bytes));
}

export async function sha256Hex(bytes: Uint8Array): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", Uint8Array.from(bytes));
  return [...new Uint8Array(digest)].map((value) => value.toString(16).padStart(2, "0")).join("");
}
