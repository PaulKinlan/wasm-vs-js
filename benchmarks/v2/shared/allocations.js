// Counting allocation factory for workload-owned allocations. The v2
// catalog's exact "allocations" counter is scoped to WORKLOAD-OWNED
// allocations: every typed array, typed-array view, and plain data object
// (arrays and object literals) the workload source creates. Function
// objects/closures and opaque engine internals (hidden classes, JIT state,
// strings) are out of scope by definition. Routing every in-scope creation
// through createF32/createF64/countValue makes the counter operative
// evidence instead of source inference: initialization allocations are
// counted exactly, and a compute path that allocates nothing is proven by
// a zero delta rather than by regex.

let count = 0;

export function createF32(length) {
  count += 1;
  return new Float32Array(length);
}

export function createF64(length) {
  count += 1;
  return new Float64Array(length);
}

// Current total of workload-owned typed-array allocations since the last
// reset. Monotonic within a measurement window.
export function allocationsCreated() {
  return count;
}

export function resetAllocationCount() {
  count = 0;
}

// Counts one workload-owned object or view allocation (runner instances,
// linear-memory views) without changing the value.
export function countValue(value) {
  count += 1;
  return value;
}

// Runs fn and returns the number of workload-owned allocations it caused.
export async function countAllocations(fn) {
  const before = count;
  await fn();
  return count - before;
}
