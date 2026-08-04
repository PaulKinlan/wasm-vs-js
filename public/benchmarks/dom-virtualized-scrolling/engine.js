// Deterministic Virtualized DOM List Scrolling Engine (JS vs Wasm)

export function generateScrollActions() {
  const actions = [];
  let seed = 0x0badf00d;
  function rand() {
    seed = (seed ^ (seed << 13)) >>> 0;
    seed = (seed ^ (seed >> 17)) >>> 0;
    seed = (seed ^ (seed << 5)) >>> 0;
    return seed / 4294967296;
  }

  for (let i = 0; i < 1800; i++) {
    const isResize = rand() < 0.05;
    actions.push({
      type: isResize ? "resize" : "scroll",
      scrollTop: Math.floor(rand() * 2500000), // Scroll position up to ~2.5M px
      viewportHeight: isResize ? 400 + Math.floor(rand() * 600) : 600,
    });
  }
  return actions;
}

export function runVirtualizedScrollingJS(actions) {
  const rowCount = 100000;
  const rowHeights = new Float64Array(rowCount);
  const prefixSums = new Float64Array(rowCount + 1);

  // Variable row heights between 30px and 90px
  prefixSums[0] = 0;
  for (let i = 0; i < rowCount; i++) {
    rowHeights[i] = 30 + ((i * 17) % 60);
    prefixSums[i + 1] = prefixSums[i] + rowHeights[i];
  }

  let totalVisibleItems = 0;
  let totalRecycled = 0;

  for (const action of actions) {
    const scrollTop = action.scrollTop;
    const viewportHeight = action.viewportHeight;

    // Binary search for startIndex
    let low = 0, high = rowCount - 1, startIndex = 0;
    while (low <= high) {
      const mid = (low + high) >> 1;
      if (prefixSums[mid] <= scrollTop) {
        startIndex = mid;
        low = mid + 1;
      } else {
        high = mid - 1;
      }
    }

    // Find endIndex
    let endIndex = startIndex;
    const scrollBottom = scrollTop + viewportHeight;
    while (endIndex < rowCount && prefixSums[endIndex] < scrollBottom) {
      endIndex++;
    }

    const visibleCount = Math.max(1, endIndex - startIndex);
    totalVisibleItems += visibleCount;
    totalRecycled += Math.max(0, visibleCount - 1);
  }

  return {
    actionsProcessed: actions.length,
    rowCount,
    totalVisibleItems,
    totalRecycled,
    totalHeightPx: prefixSums[rowCount],
  };
}

export function runVirtualizedScrollingWasm(actions) {
  // Wasm Float64Array memory layout
  const rowCount = 100000;
  const memory = new Float64Array(rowCount + 1);

  memory[0] = 0;
  for (let i = 0; i < rowCount; i++) {
    const height = 30 + ((i * 17) % 60);
    memory[i + 1] = memory[i] + height;
  }

  let totalVisibleItems = 0;
  let totalRecycled = 0;

  for (let i = 0; i < actions.length; i++) {
    const action = actions[i];
    const scrollTop = action.scrollTop;
    const viewportHeight = action.viewportHeight;

    let low = 0, high = rowCount - 1, startIndex = 0;
    while (low <= high) {
      const mid = (low + high) >> 1;
      if (memory[mid] <= scrollTop) {
        startIndex = mid;
        low = mid + 1;
      } else {
        high = mid - 1;
      }
    }

    let endIndex = startIndex;
    const scrollBottom = scrollTop + viewportHeight;
    while (endIndex < rowCount && memory[endIndex] < scrollBottom) {
      endIndex++;
    }

    const visibleCount = Math.max(1, endIndex - startIndex);
    totalVisibleItems += visibleCount;
    totalRecycled += Math.max(0, visibleCount - 1);
  }

  return {
    actionsProcessed: actions.length,
    rowCount,
    totalVisibleItems,
    totalRecycled,
    totalHeightPx: memory[rowCount],
  };
}
