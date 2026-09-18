export function assert(condition: unknown, message = "assertion failed"): asserts condition {
  if (!condition) throw new Error(message);
}

export function assertEquals(actual: unknown, expected: unknown, message?: string): void {
  if (JSON.stringify(actual) !== JSON.stringify(expected)) {
    const detail = `not equal: ${JSON.stringify(actual)} != ${JSON.stringify(expected)}`;
    // Over a ledger of 181 records, the values alone do not say which record
    // failed.
    throw new Error(message ? `${message} (${detail})` : detail);
  }
}

export async function assertRejects(fn: () => Promise<unknown>, includes: string): Promise<void> {
  try {
    await fn();
  } catch (error) {
    if (error instanceof Error && error.message.includes(includes)) return;
    throw error;
  }
  throw new Error("expected rejection");
}
