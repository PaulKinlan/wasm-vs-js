// dom_vscroll.c — real linear-memory kernel for dom.virtualized-scrolling.v1.
//
// The workload: 1,800 frozen scroll/viewport actions over 100,000
// variable-height rows. The Wasm kernel computes the visible-window indices
// (binary search over Float64 prefix sums); the JS host applies those windows
// to a REAL virtualized DOM list (createElement/appendChild/recycling).
//
// Memory layout (all little-endian):
//   prefix_ptr   : Float64[100001]  prefix sums of row heights (30 + ((i*17)%60))
//   actions_ptr  : u32 pairs        (scrollTop, viewportHeight), actions_len of them
//   results_ptr  : u32 triples      (startIndex, endIndex, visibleCount) per action
//
// Exports:
//   i32 compute_windows(i32 prefix_ptr, i32 actions_ptr, i32 actions_len, i32 results_ptr)
//     returns the total number of visible items summed over all actions.

#define ROW_COUNT 100000

__attribute__((export_name("compute_windows")))
int compute_windows(
    const double *prefix_ptr,
    const unsigned int *actions_ptr,
    unsigned int actions_len,
    unsigned int *results_ptr) {
  unsigned int total_visible = 0;
  for (unsigned int a = 0; a < actions_len; a++) {
    const unsigned int scroll_top = actions_ptr[a * 2];
    const unsigned int viewport_height = actions_ptr[a * 2 + 1];

    // Binary search: greatest index whose prefix sum <= scrollTop.
    unsigned int lo = 0, hi = ROW_COUNT - 1, start_index = 0;
    while (lo <= hi) {
      const unsigned int mid = (lo + hi) >> 1;
      if (prefix_ptr[mid] <= (double)scroll_top) {
        start_index = mid;
        lo = mid + 1;
      } else {
        hi = mid - 1;
      }
    }

    // Scan forward for the visible end index.
    unsigned int end_index = start_index;
    const double scroll_bottom = (double)scroll_top + (double)viewport_height;
    while (end_index < ROW_COUNT && prefix_ptr[end_index] < scroll_bottom) {
      end_index++;
    }

    unsigned int visible_count = end_index - start_index;
    if (visible_count < 1) visible_count = 1;

    results_ptr[a * 3] = start_index;
    results_ptr[a * 3 + 1] = end_index;
    results_ptr[a * 3 + 2] = visible_count;
    total_visible += visible_count;
  }
  return (int)total_visible;
}
