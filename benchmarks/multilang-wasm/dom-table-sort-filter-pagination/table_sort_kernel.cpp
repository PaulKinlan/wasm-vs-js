// table_sort_kernel.cpp — multilang compute core for
// dom.table-sort-filter-pagination.v1.
//
// Same ABI as table_sort_kernel.c: generates the frozen 120-action trace from
// seed 0x31415926, runs the JS reference model (5,000 rows,
// runTableSortFilterJS), writes counters to fixed offset 16384 ([0]
// filteredCount [1] totalSorts [2] totalFilters [3] pageSliceCount [4]
// pageScoreSum), returns pageScoreSum.

constexpr int ROWS = 5000;
constexpr int PAGE = 50;
constexpr int ACTIONS = 120;
constexpr int RES_OFFSET = 40000; // past the AS-shared 40000-byte data region

static unsigned int seed = 0;
static double rand_next() {
  seed ^= seed << 13;
  seed ^= static_cast<unsigned int>(static_cast<int>(seed) >> 17);
  seed ^= seed << 5;
  return static_cast<double>(seed) / 4294967296.0;
}

static int cat_rank(int c) {
  if (c == 0) return 0;
  if (c == 1) return 1;
  if (c == 2) return 4;
  if (c == 3) return 2;
  return 3;
}
static int stat_rank(int s) {
  if (s == 0) return 0;
  if (s == 1) return 2;
  return 1;
}
static int cmp_name(int a, int b) {
  char sa[8], sb[8];
  int na = 0, nb = 0;
  int x = a;
  do { sa[na++] = static_cast<char>('0' + (x % 10)); x /= 10; } while (x);
  x = b;
  do { sb[nb++] = static_cast<char>('0' + (x % 10)); x /= 10; } while (x);
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
static int cmp_row(const int *scores, int a_id, int b_id, int col, int asc) {
  int cmp = 0;
  if (col == 0) {
    cmp = a_id < b_id ? -1 : (a_id > b_id ? 1 : 0);
  } else if (col == 1) {
    cmp = cmp_name(a_id, b_id);
  } else if (col == 2) {
    const int ra = cat_rank(a_id % 5);
    const int rb = cat_rank(b_id % 5);
    cmp = ra < rb ? -1 : (ra > rb ? 1 : 0);
  } else if (col == 3) {
    const int sa = scores[a_id];
    const int sb = scores[b_id];
    cmp = sa < sb ? -1 : (sa > sb ? 1 : 0);
  } else if (col == 4) {
    const int ra = stat_rank(a_id % 3);
    const int rb = stat_rank(b_id % 3);
    cmp = ra < rb ? -1 : (ra > rb ? 1 : 0);
  }
  return asc ? cmp : -cmp;
}

extern "C" __attribute__((export_name("table_sort_trace")))
int table_sort_trace() {
  int scores[ROWS];
  int filt[ROWS];
  unsigned int *results = reinterpret_cast<unsigned int *>(RES_OFFSET);

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
    if (op_type < 0.35) {
      const int col = static_cast<int>(rand_next() * 5.0);
      const int asc = rand_next() > 0.5 ? 1 : 0;
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
    } else if (op_type < 0.70) {
      const int f_idx = static_cast<int>(rand_next() * 6.0);
      int out = 0;
      if (f_idx == 5) {
        for (int i = 0; i < ROWS; i++) filt[out++] = i;
      } else {
        const int target_cat = f_idx;
        for (int i = 0; i < ROWS; i++) {
          if ((i % 5) == target_cat) filt[out++] = i;
        }
      }
      filtered_count = out;
      total_filters++;
    } else if (op_type < 0.90) {
      const int page = static_cast<int>(rand_next() * 20.0);
      current_page = page;
      page_size = PAGE;
    } else {
      const int row_id = static_cast<int>(rand_next() * 5000.0);
      const int new_score = static_cast<int>(rand_next() * 1000.0);
      if (row_id >= 0 && row_id < ROWS) scores[row_id] = new_score;
    }
  }

  const int page_start = current_page * page_size;
  int page_end = page_start + page_size;
  if (page_end > filtered_count) page_end = filtered_count;
  int slice_len = page_end - page_start;
  if (slice_len < 0) slice_len = 0;
  unsigned int page_score_sum = 0;
  for (int i = page_start; i < page_end; i++) {
    page_score_sum += static_cast<unsigned int>(scores[filt[i]]);
  }

  results[0] = static_cast<unsigned int>(filtered_count);
  results[1] = total_sorts;
  results[2] = total_filters;
  results[3] = static_cast<unsigned int>(slice_len);
  results[4] = page_score_sum;
  return static_cast<int>(page_score_sum);
}
