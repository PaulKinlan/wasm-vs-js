// dom_table_sort.c — real linear-memory kernel for dom.table-sort-filter-pagination.v1.
//
// Mirrors runTableSortFilterJS exactly: 5,000 rows, 120 frozen actions
// (sort/filter/paginate/edit_cell). The kernel maintains the rows + filtered
// index list + page state in linear memory and writes, per order-changing
// action, the resulting page-slice row ids; the JS host renders the page
// slice as a REAL <table> (tbody rebuilt / one cell updated per action).
//
// Memory layout (little-endian):
//   rows_ptr   : i32[5000*4]  per row: (cat, status, score, nameHash) — name
//                              is "User <i>" and compares lexicographically.
//   filt_ptr   : i32[5000]    filtered row ids (index list)
//   actions_ptr: u32[120]     packed: op(3b) | a(13b) | b(13b) | c(3b)
//                              sort:(col, asc) filter:(qIdx) paginate:(page) edit:(rowId, newScore)
//   slices_ptr : u32[120*50]  per order-changing action, the page-slice row ids
//   steps_ptr  : u32[4*120]   (op, a, b, c) — same fields as the action
//   results    : u32[5]       [0] filteredCount [1] totalSorts [2] totalFilters
//                             [3] pageSliceCount [4] pageScoreSum
// Exports: i32 run_trace(...) -> number of steps (order-changing actions)

#define ROWS 5000
#define PAGE 50
#define MAX_ACTIONS 120

// ops: 0 sort, 1 filter, 2 paginate, 3 edit_cell
// cols: 0 id, 1 name, 2 category, 3 score, 4 status
static int less(const int *rows, int a_id, int b_id, unsigned int col, unsigned int asc);
static void emit_slice(int *filt, int filtered_count, unsigned int page, unsigned int page_size,
                       unsigned int *slices, unsigned int step_count, int *rows);
static int cmp_name(int a, int b);
static int cat_rank(int c);
static int stat_rank(int s);

__attribute__((export_name("run_trace")))
int run_trace(
    int *rows,          // per row: cat, status, score, nameHash (unused)
    int *filt,          // filtered row ids
    const unsigned int *actions,
    unsigned int actions_len,
    unsigned int *slices,
    unsigned int *steps,
    unsigned int *results) {
  int filtered_count = ROWS;
  for (int i = 0; i < ROWS; i++) filt[i] = i;
  unsigned int current_page = 0;
  unsigned int page_size = PAGE;
  unsigned int total_sorts = 0;
  unsigned int total_filters = 0;
  unsigned int step_count = 0;

  for (unsigned int a = 0; a < actions_len; a++) {
    const unsigned int packed = actions[a];
    const unsigned int op = packed & 0x7;
    const unsigned int pa = (packed >> 3) & 0x1fff;
    const unsigned int pb = (packed >> 16) & 0x1fff;

    if (op == 0) { // sort
      const unsigned int col = pa & 0x7;
      const unsigned int asc = (pa >> 3) & 0x1;
      // stable insertion sort over filt[] using the row values
      for (int i = 1; i < filtered_count; i++) {
        const int key = filt[i];
        int j = i - 1;
        // shift elements while key < filt[j] (ascending stable insertion)
        while (j >= 0 && less(rows, key, filt[j], col, asc)) {
          filt[j + 1] = filt[j];
          j--;
        }
        filt[j + 1] = key;
      }
      total_sorts++;
      emit_slice(filt, filtered_count, current_page, page_size, slices, step_count, rows);
      steps[step_count * 4] = 0; steps[step_count * 4 + 1] = pa;
      steps[step_count * 4 + 2] = 0; steps[step_count * 4 + 3] = 0;
      step_count++;
    } else if (op == 1) { // filter: keep rows whose category == qIdx (name never matches)
      const unsigned int q_idx = pa;
      int out = 0;
      if (q_idx == 5) { // empty query -> all rows
        for (int i = 0; i < ROWS; i++) filt[out++] = i;
      } else {
        for (int i = 0; i < ROWS; i++) {
          if ((unsigned int)rows[i * 4] == q_idx) filt[out++] = i;
        }
      }
      filtered_count = out;
      total_filters++;
      emit_slice(filt, filtered_count, current_page, page_size, slices, step_count, rows);
      steps[step_count * 4] = 1; steps[step_count * 4 + 1] = q_idx;
      steps[step_count * 4 + 2] = 0; steps[step_count * 4 + 3] = 0;
      step_count++;
    } else if (op == 2) { // paginate
      current_page = pa;
      page_size = PAGE;
      emit_slice(filt, filtered_count, current_page, page_size, slices, step_count, rows);
      steps[step_count * 4] = 2; steps[step_count * 4 + 1] = pa;
      steps[step_count * 4 + 2] = 0; steps[step_count * 4 + 3] = 0;
      step_count++;
    } else if (op == 3) { // edit_cell: rows[rowId].score = newScore
      const unsigned int row_id = pa;
      const unsigned int new_score = pb;
      if (row_id < ROWS) rows[row_id * 4 + 2] = (int)new_score;
      steps[step_count * 4] = 3; steps[step_count * 4 + 1] = row_id;
      steps[step_count * 4 + 2] = new_score; steps[step_count * 4 + 3] = 0;
      step_count++;
    }
  }
  results[0] = (unsigned int)filtered_count;
  results[1] = total_sorts;
  results[2] = total_filters;
  // final slice
  const unsigned int start = current_page * page_size;
  unsigned int slice_len = 0;
  unsigned int score_sum = 0;
  for (unsigned int i = start; i < (unsigned int)filtered_count && i < start + page_size; i++) {
    const int id = filt[i];
    score_sum += (unsigned int)rows[id * 4 + 2];
    slice_len++;
  }
  results[3] = slice_len;
  results[4] = score_sum;
  return (int)step_count;
}

static void emit_slice(int *filt, int filtered_count, unsigned int page, unsigned int page_size,
                       unsigned int *slices, unsigned int step_count, int *rows) {
  const unsigned int start = page * page_size;
  unsigned int n = 0;
  for (unsigned int i = start; i < (unsigned int)filtered_count && i < start + page_size; i++) {
    slices[step_count * PAGE + n++] = (unsigned int)filt[i];
  }
  (void)rows;
}

static int less(const int *rows, int a_id, int b_id, unsigned int col, unsigned int asc) {
  const int *a = &rows[a_id * 4];
  const int *b = &rows[b_id * 4];
  int cmp = 0;
  switch (col) {
    case 0: cmp = a_id < b_id ? -1 : (a_id > b_id ? 1 : 0); break;
    case 1: cmp = cmp_name(a_id, b_id); break;
    case 2: cmp = cat_rank(a[0]) < cat_rank(b[0]) ? -1 : (cat_rank(a[0]) > cat_rank(b[0]) ? 1 : 0); break;
    case 3: cmp = a[2] < b[2] ? -1 : (a[2] > b[2] ? 1 : 0); break;
    case 4: cmp = stat_rank(a[1]) < stat_rank(b[1]) ? -1 : (stat_rank(a[1]) > stat_rank(b[1]) ? 1 : 0); break;
  }
  if (cmp == 0) return 0;
  return asc ? (cmp < 0) : (cmp > 0);
}

// JS compares category/status as STRINGS (alphabetical): category rank
// {alpha:0, beta:1, delta:3, epsilon:4, gamma:2}; status rank
// {active:0, archived:2, pending:1}. Folds to arithmetic (no static data).
static int cat_rank(int c) {
  if (c == 0) return 0; if (c == 1) return 1; if (c == 2) return 3;
  if (c == 3) return 4; return 2;
}
static int stat_rank(int s) {
  if (s == 0) return 0; if (s == 1) return 2; return 1;
}
static int cmp_name(int a, int b) {
  // plain lexicographic compare of the decimal digit strings (matches JS
  // string comparison: "User 10" < "User 9" because '1' < '9')
  char sa[8], sb[8];
  int na = 0, nb = 0;
  int x = a; do { sa[na++] = '0' + (x % 10); x /= 10; } while (x);
  x = b; do { sb[nb++] = '0' + (x % 10); x /= 10; } while (x);
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
