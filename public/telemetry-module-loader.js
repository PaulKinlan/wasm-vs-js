export async function sha256Hex(bytes) {
  return Array.from(
    new Uint8Array(await crypto.subtle.digest("SHA-256", bytes)),
    (byte) => byte.toString(16).padStart(2, "0"),
  ).join("");
}

export async function loadVerifiedModule({
  route,
  expectedSha256,
  fetchImpl = fetch,
  importImpl = (url) => import(url),
  createObjectURL = (blob) => URL.createObjectURL(blob),
  revokeObjectURL = (url) => URL.revokeObjectURL(url),
}) {
  if (!/^\/[A-Za-z0-9._/-]+$/.test(route)) throw new Error("module route denied");
  if (!/^[a-f0-9]{64}$/.test(expectedSha256)) throw new Error("module SHA-256 denied");
  const response = await fetchImpl(route, { cache: "no-store" });
  if (!response.ok) throw new Error(`${route} returned ${response.status}`);
  const sourceBytes = new Uint8Array(await response.arrayBuffer());
  const sourceSha256 = await sha256Hex(sourceBytes);
  if (sourceSha256 !== expectedSha256) {
    throw new Error("executed workload module identity mismatch");
  }
  const objectUrl = createObjectURL(new Blob([sourceBytes], { type: "text/javascript" }));
  try {
    // The imported module is constructed from the exact byte array hashed above.
    const module = await importImpl(objectUrl);
    return { module, sourceBytes, sourceSha256, route };
  } finally {
    revokeObjectURL(objectUrl);
  }
}
