// form_validate_kernel.cpp — multilang compute core for
// dom.dependent-form-validation.v1.
//
// Same ABI as form_validate_kernel.c: generates the frozen 240-action trace
// from seed 0x2468ace0, runs the JS reference model (runFormValidationJS —
// 10 fields, per-rule email/password/confirm/age/terms validation), writes
// counters to fixed offset 16384 ([0] totalErrors [1] activeErrorCount
// [2] totalValidations), returns totalErrors.

constexpr int FIELDS = 10;
constexpr int FIELD_CAP = 32;
constexpr int ACTIONS = 240;
constexpr int RES_OFFSET = 16384;

static unsigned int seed = 0;
static double rand_next() {
  seed ^= seed << 13;
  seed ^= static_cast<unsigned int>(static_cast<int>(seed) >> 17);
  seed ^= seed << 5;
  return static_cast<double>(seed) / 4294967296.0;
}

static int email_valid(const unsigned char *v) {
  int len = 0;
  while (v[len]) len++;
  if (len == 0) return 0;
  int at = -1;
  for (int i = 0; i < len; i++) {
    if (v[i] == ' ' || v[i] == '\t' || v[i] == '\n' || v[i] == '\r') return 0;
    if (v[i] == '@') { if (at >= 0) return 0; at = i; }
  }
  if (at <= 0 || at >= len - 1) return 0;
  int dot = -1;
  for (int i = at + 1; i < len; i++) {
    if (v[i] == '@') return 0;
    if (v[i] == '.') dot = i;
  }
  if (dot < 0) return 0;
  if (dot == at + 1 || dot == len - 1) return 0;
  return 1;
}

static int parse_age(const unsigned char *v) {
  int i = 0;
  while (v[i] == ' ' || v[i] == '\t') i++;
  int neg = 0;
  if (v[i] == '-') { neg = 1; i++; }
  int n = 0;
  int any = 0;
  while (v[i] >= '0' && v[i] <= '9') { n = n * 10 + (v[i] - '0'); any = 1; i++; }
  if (!any) return -1;
  return neg ? -n : n;
}

static __attribute__((noinline)) unsigned int str_len(const unsigned char *v) {
  unsigned int i = 0;
  while (v[i] != 0) i++;
  return i;
}

static __attribute__((noinline)) int str_equal(const unsigned char *a, const unsigned char *b) {
  unsigned int i = 0;
  for (;;) {
    if (a[i] != b[i]) return 0;
    if (a[i] == 0) return 1;
    i++;
  }
}

static unsigned int validate(const unsigned char *fields, unsigned int *mask) {
  unsigned int m = 0;
  unsigned int errs = 0;
  const unsigned char *email = &fields[0 * FIELD_CAP];
  const unsigned char *password = &fields[1 * FIELD_CAP];
  const unsigned char *confirm = &fields[2 * FIELD_CAP];
  const unsigned char *age = &fields[3 * FIELD_CAP];
  const unsigned char *terms = &fields[7 * FIELD_CAP];
  if (email[0] != 0 && !email_valid(email)) { m |= 1; errs++; }
  if (password[0] != 0 && str_len(password) < 8) { m |= 2; errs++; }
  if (confirm[0] != 0 && !str_equal(confirm, password)) { m |= 4; errs++; }
  if (age[0] != 0) {
    const int aval = parse_age(age);
    if (aval < 0 || aval < 18) { m |= 8; errs++; }
  }
  if (terms[0] != 0 &&
      !(terms[0] == 't' && terms[1] == 'r' && terms[2] == 'u' && terms[3] == 'e' && terms[4] == 0)) {
    m |= 16; errs++;
  }
  *mask = m;
  return errs;
}

extern "C" __attribute__((export_name("form_validate_trace")))
int form_validate_trace() {
  unsigned char fields[FIELDS * FIELD_CAP];
  unsigned char val[FIELD_CAP];
  unsigned int *results = reinterpret_cast<unsigned int *>(RES_OFFSET);
  for (unsigned int i = 0; i < FIELDS * FIELD_CAP; i++) fields[i] = 0;

  seed = 0x2468ace0;
  unsigned int total_errors = 0;
  unsigned int total_validations = 0;

  for (int a = 0; a < ACTIONS; a++) {
    const int field = static_cast<int>(rand_next() * 10.0);
    const int val_len_alpha = 3 + static_cast<int>(rand_next() * 15.0);
    int vlen = 0;
    for (int j = 0; j < val_len_alpha; j++) {
      const int c = static_cast<int>(rand_next() * 26.0);
      if (vlen < FIELD_CAP - 1) val[vlen++] = static_cast<unsigned char>('a' + c);
    }
    if (field == 0) {
      const char suffix[] = "@example.com";
      for (int j = 0; j < 12; j++) {
        if (vlen < FIELD_CAP - 1) val[vlen++] = static_cast<unsigned char>(suffix[j]);
      }
    } else if (field == 3) {
      const int age = 15 + static_cast<int>(rand_next() * 50.0);
      vlen = 0;
      char buf[8];
      int nb = 0;
      int x = age;
      do { buf[nb++] = static_cast<char>('0' + (x % 10)); x /= 10; } while (x);
      for (int j = nb - 1; j >= 0; j--) val[vlen++] = static_cast<unsigned char>(buf[j]);
    } else if (field == 7) {
      const int truthy = rand_next() > 0.5 ? 1 : 0;
      vlen = 0;
      if (truthy) {
        val[vlen++] = 't'; val[vlen++] = 'r'; val[vlen++] = 'u'; val[vlen++] = 'e';
      } else {
        val[vlen++] = 'f'; val[vlen++] = 'a'; val[vlen++] = 'l'; val[vlen++] = 's';
        val[vlen++] = 'e';
      }
    }
    (void)rand_next();
    val[vlen] = 0;

    unsigned char *dst = &fields[field * FIELD_CAP];
    int cp = 0;
    while (cp < vlen && cp < FIELD_CAP - 1) { dst[cp] = val[cp]; cp++; }
    dst[cp] = 0;
    total_validations++;

    unsigned int mask = 0;
    total_errors += validate(fields, &mask);
  }

  unsigned int mask = 0;
  const unsigned int active = validate(fields, &mask);
  results[0] = total_errors;
  results[1] = active;
  results[2] = total_validations;
  return static_cast<int>(total_errors);
}
