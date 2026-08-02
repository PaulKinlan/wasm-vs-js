export function assert(condition: unknown, message = "assertion failed"): asserts condition {
  if (!condition) throw new Error(message);
}

export function assertEquals(actual: unknown, expected: unknown): void {
  if (JSON.stringify(actual) !== JSON.stringify(expected)) {
    throw new Error(`not equal: ${JSON.stringify(actual)} != ${JSON.stringify(expected)}`);
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
