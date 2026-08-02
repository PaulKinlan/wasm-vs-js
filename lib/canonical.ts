const encoder = new TextEncoder();

function assertUnicodeScalarString(value: string): void {
  for (let index = 0; index < value.length; index += 1) {
    const unit = value.charCodeAt(index);
    if (unit >= 0xd800 && unit <= 0xdbff) {
      const next = value.charCodeAt(index + 1);
      if (!Number.isInteger(next) || next < 0xdc00 || next > 0xdfff) {
        throw new Error("lone surrogate denied");
      }
      index += 1;
    } else if (unit >= 0xdc00 && unit <= 0xdfff) {
      throw new Error("lone surrogate denied");
    }
  }
}

export function canonicalize(value: unknown): string {
  if (value === null) return "null";
  if (typeof value === "string") {
    assertUnicodeScalarString(value);
    return JSON.stringify(value);
  }
  if (typeof value === "boolean") return value ? "true" : "false";
  if (typeof value === "number") {
    if (!Number.isFinite(value)) throw new Error("non-finite number denied");
    return JSON.stringify(value);
  }
  if (Array.isArray(value)) {
    for (let index = 0; index < value.length; index += 1) {
      if (!Object.hasOwn(value, index)) throw new Error("sparse array denied");
    }
    if (Object.keys(value).length !== value.length) throw new Error("array property denied");
    return `[${value.map(canonicalize).join(",")}]`;
  }
  if (typeof value !== "object") throw new Error("non-JSON value denied");
  const object = value as Record<string, unknown>;
  if (
    Object.getPrototypeOf(object) !== Object.prototype && Object.getPrototypeOf(object) !== null
  ) {
    throw new Error("non-plain object denied");
  }
  const entries = Object.keys(object).sort().map((key) => {
    assertUnicodeScalarString(key);
    return `${JSON.stringify(key)}:${canonicalize(object[key])}`;
  });
  return `{${entries.join(",")}}`;
}

export async function sha256Hex(value: Uint8Array | string): Promise<string> {
  const source = typeof value === "string" ? encoder.encode(value) : value;
  const bytes = new Uint8Array(source.byteLength);
  bytes.set(source);
  const digest = new Uint8Array(await crypto.subtle.digest("SHA-256", bytes));
  return [...digest].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

export async function hashCanonicalEnvelope(value: Record<string, unknown>): Promise<string> {
  const copy = { ...value };
  delete copy.payloadSha256;
  return await sha256Hex(canonicalize(copy));
}
