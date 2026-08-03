function equal(left: unknown, right: unknown): boolean {
  return JSON.stringify(left) === JSON.stringify(right);
}

export type NetworkRecord = {
  url: string;
  method: string;
  status: number | null;
  failed: boolean;
  completed: boolean;
};

export function assertCompleteTodoEvidence(
  result: Record<string, unknown>,
  ax: unknown,
  oracle: Record<string, unknown>,
  variantId: string,
): void {
  if (result.variantId !== variantId) throw new Error("variant result mismatch");
  const assertions = result.assertions;
  if (
    !assertions || typeof assertions !== "object" ||
    !Object.values(assertions as Record<string, unknown>).every((value) => value === true)
  ) throw new Error("controller semantic assertion failed");
  if (!equal(result.summary, oracle.finalState)) throw new Error("semantic summary mismatch");
  if (!equal(result.canonicalDom, oracle.canonicalDom)) throw new Error("canonical DOM mismatch");
  const variants = oracle.variants as Record<string, { counters: unknown }>;
  if (!variants?.[variantId] || !equal(result.counters, variants[variantId].counters)) {
    throw new Error("operative counter mismatch");
  }
  if (!equal(ax, oracle.canonicalAx)) throw new Error("CDP AX-tree mismatch");
}

export function assertCompleteNetwork(records: NetworkRecord[]): void {
  if (records.length === 0) throw new Error("network evidence absent");
  for (const record of records) {
    if (
      !record.url.startsWith("http://127.0.0.1:") || record.method !== "GET" ||
      record.status !== 200 || record.failed || !record.completed
    ) throw new Error(`network request incomplete or failed: ${record.url}`);
  }
}

export function assertLifecycleEvidence(
  action: string,
  lifecycle: Record<string, boolean>,
): void {
  const expected = action === "complete"
    ? {
      cancelled: false,
      staleIgnored: false,
      workerAbsentAfterCancel: false,
      restartCompleted: false,
      workerAbsentAfterPagehide: false,
    }
    : action === "lifecycle"
    ? {
      cancelled: true,
      staleIgnored: true,
      workerAbsentAfterCancel: true,
      restartCompleted: true,
      workerAbsentAfterPagehide: false,
    }
    : action === "pagehide"
    ? {
      cancelled: false,
      staleIgnored: false,
      workerAbsentAfterCancel: false,
      restartCompleted: false,
      workerAbsentAfterPagehide: true,
    }
    : null;
  if (!expected || !equal(lifecycle, expected)) throw new Error("lifecycle gate failed");
}
