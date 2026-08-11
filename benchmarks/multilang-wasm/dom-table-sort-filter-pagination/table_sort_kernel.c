// table_sort_kernel.c — multilang compute core for
// dom.table-sort-filter-pagination.v1.
//
// ABI (mirrors benchmarks/multilang-wasm/dom-grid-movement/grid_kernel.c): the
// kernel GENERATES the frozen 120-action trace internally from the pinned
// seed (0x31415926), runs the JS reference model (runTableSortFilterJS: 5,000
// rows with category=i%5, status=i%3, score=(i*37)%1000; stable sort with JS
// string-order ranks for category/status/name; filter resets to id-order;
// edit_cell mutates score at rowId; paginate updates current page/size),
// writes counters to a FIXED memory offset, returns pageScoreSum.
//
// Results (fixed offset 40000):
//   [0] filteredCount [1] totalSorts [2] totalFilters
//   [3] pageSliceCount [4] pageScoreSum
// Exports: i32 table_sort_trace() -> pageScoreSum

#define ROWS 5000
#define PAGE 50
#define ACTIONS 120
#define RES_OFFSET 40000     // u32[5] (past the AS-shared 40000-byte data region)

static unsigned int seed = 0;
static double rand_next(void) {
  seed ^= seed << 13;
  // the engine's JS rand() applies >> 17 to the int32 interpretation
  // (arithmetic, sign-extending) — replicate exactly.
  seed ^= (unsigned int)((int)seed >> 17);
  seed ^= seed << 5;
  return (double)seed / 4294967296.0;
}

// cols: 0 id, 1 name, 2 category, 3 score, 4 status
// JS Array.sort compares as strings for category / status / name (alphabetical
// on the underlying string labels). Fold to arithmetic ranks so we can sort
// integer keys with stable insertion sort.
// categories: alpha(0) < beta(1) < delta(3) < epsilon(4) < gamma(2)
static int cat_rank(int c) {
  if (c == 0) return 0; // alpha
  if (c == 1) return 1; // beta
  if (c == 2) return 4; // gamma
  if (c == 3) return 2; // delta
  return 3;             // epsilon
}
// statuses: active(0) < archived(2) < pending(1)
static int stat_rank(int s) {
  if (s == 0) return 0; // active
  if (s == 1) return 2; // pending
  return 1;             // archived
}

// JS compares names as strings: name = "User " + id. Prefix is common; the
// comparison reduces to lexicographic comparison of the decimal digit string
// of the id (e.g. "User 10" < "User 9" because '1' < '9').
static int cmp_name(int a, int b) {
  char sa[8], sb[8];
  int na = 0, nb = 0;
  int x = a;
  do { sa[na++] = (char)('0' + (x % 10)); x /= 10; } while (x);
  x = b;
  do { sb[nb++] = (char)('0' + (x % 10)); x /= 10; } while (x);
  int i = 0;
  while (i < na && i < nb) {
    const char ca = sa[na - 1 - i];
    const char cb = sb[nb - 1 - i];
    if (ca != cb) return ca < cb ? -1 : 1;
    i++;
  }
  if (na != nb) return na < nb ? -1 : 1;
  return 0;
}

// Returns -1 / 0 / +1 for row a vs row b under the JS comparator (col+asc).
static int cmp_row(const int *scores, int a_id, int b_id, int col, int asc) {
  int cmp = 0;
  if (col == 0) { // id
    cmp = a_id < b_id ? -1 : (a_id > b_id ? 1 : 0);
  } else if (col == 1) { // name
    cmp = cmp_name(a_id, b_id);
  } else if (col == 2) { // category
    const int ra = cat_rank(a_id % 5);
    const int rb = cat_rank(b_id % 5);
    cmp = ra < rb ? -1 : (ra > rb ? 1 : 0);
  } else if (col == 3) { // score
    const int sa = scores[a_id];
    const int sb = scores[b_id];
    cmp = sa < sb ? -1 : (sa > sb ? 1 : 0);
  } else if (col == 4) { // status
    const int ra = stat_rank(a_id % 3);
    const int rb = stat_rank(b_id % 3);
    cmp = ra < rb ? -1 : (ra > rb ? 1 : 0);
  }
  return asc ? cmp : -cmp;
}

__attribute__((export_name("table_sort_trace")))
int table_sort_trace(void) {
  int scores[ROWS];
  int filt[ROWS];
  unsigned int *results = (unsigned int *)RES_OFFSET;

  for (int i = 0; i < ROWS; i++) {
    scores[i] = (i * 37) % 1000;
    filt[i] = i;
  }
  int filtered_count = ROWS;
  int current_page = 0;
  int page_size = PAGE;
  unsigned int total_sorts = 0;
  unsigned int total_filters = 0;

  seed = 0x31415926;
  for (int a = 0; a < ACTIONS; a++) {
    const double op_type = rand_next();
    if (op_type < 0.35) { // sort
      // JS generator: col index = floor(rand()*5), asc = rand() > 0.5
      const int col = (int)(rand_next() * 5.0);
      const int asc = rand_next() > 0.5 ? 1 : 0;
      // stable insertion sort over filt[0..filtered_count) using cmp_row
      for (int i = 1; i < filtered_count; i++) {
        const int key = filt[i];
        int j = i - 1;
        while (j >= 0 && cmp_row(scores, key, filt[j], col, asc) < 0) {
          filt[j + 1] = filt[j];
          j--;
        }
        filt[j + 1] = key;
      }
      total_sorts++;
    } else if (op_type < 0.70) { // filter
      // JS generator: filter index = floor(rand()*6); filters =
      //   ["alpha","beta","gamma","delta","epsilon",""]. Empty query resets to
      //   all rows (in id order); named query keeps rows whose category matches.
      const int f_idx = (int)(rand_next() * 6.0);
      int out = 0;
      if (f_idx == 5) {
        for (int i = 0; i < ROWS; i++) filt[out++] = i;
      } else {
        // filters[f_idx] maps to category code by name — but the JS filter is
        // `r.category.includes(q) || r.name.toLowerCase().includes(q)`. For
        // the 5 real categories the substring `q === r.category`, and the
        // name "user N" never contains any of these queries. So filter by
        // exact category-code equality:
        //   filters[0]="alpha"→cat 0, [1]="beta"→1, [2]="gamma"→2,
        //   [3]="delta"→3, [4]="epsilon"→4.
        const int target_cat = f_idx;
        for (int i = 0; i < ROWS; i++) {
          if ((i % 5) == target_cat) filt[out++] = i;
        }
      }
      filtered_count = out;
      total_filters++;
    } else if (op_type < 0.90) { // paginate
      // JS generator: page = floor(rand()*20), pageSize = 50
      const int page = (int)(rand_next() * 20.0);
      current_page = page;
      page_size = PAGE;
      (void)current_page;
    } else { // edit_cell
      const int row_id = (int)(rand_next() * 5000.0);
      const int new_score = (int)(rand_next() * 1000.0);
      if (row_id >= 0 && row_id < ROWS) scores[row_id] = new_score;
    }
  }

  // Compute final page slice
  const int page_start = current_page * page_size;
  int page_end = page_start + page_size;
  if (page_end > filtered_count) page_end = filtered_count;
  int slice_len = page_end - page_start;
  if (slice_len < 0) slice_len = 0;
  unsigned int page_score_sum = 0;
  for (int i = page_start; i < page_end; i++) {
    page_score_sum += (unsigned int)scores[filt[i]];
  }

  results[0] = (unsigned int)filtered_count;
  results[1] = total_sorts;
  results[2] = total_filters;
  results[3] = (unsigned int)slice_len;
  results[4] = page_score_sum;
  return (int)page_score_sum;
}
