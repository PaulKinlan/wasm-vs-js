// dom_form_validate.c — real linear-memory kernel for
// dom.dependent-form-validation.v1.
//
// Mirrors runFormValidationJS exactly (regex email, password length, dependent
// confirm, age, terms — per-rule error state, totalErrors per failing rule per
// action). The kernel maintains the 10-field form state as byte strings and
// emits per-action steps (field, type, errMask); the JS host applies each step
// to a REAL DOM form (input.value + error message elements).
//
// Memory layout (little-endian):
//   fields_ptr : u8[10*32]   field values as NUL-terminated byte strings
//   actions_ptr: u32[240]    packed: fieldIdx(8) | type(8) | len(8) | pad
//   values_ptr : u8[240*32]  per-action value bytes
//   steps_ptr  : u32[4*240]  (fieldIdx, type, errMask, valueId)
//   results    : u32[3]      [0] totalErrors [1] activeErrorCount [2] totalValidations
// Exports: i32 run_trace(...) -> step count (240)

#define FIELDS 10
#define FIELD_CAP 32
#define MAX_ACTIONS 240

// field indices: 0 email, 1 password, 2 confirmPassword, 3 age, 4 country,
//                5 zipCode, 6 phone, 7 agreeTerms, 8 cardNumber, 9 cvv
// error mask bits: 0 email, 1 password, 2 confirm, 3 age, 4 terms

static int has_error(unsigned int mask) { return mask != 0; }

static int email_valid(const unsigned char *v) {
  // ^[^\s@]+@[^\s@]+\.[^\s@]+$
  int len = 0;
  while (v[len]) len++;
  if (len == 0) return 0;
  // find '@' with non-empty local part, no spaces anywhere
  int at = -1;
  for (int i = 0; i < len; i++) {
    if (v[i] == ' ' || v[i] == '\t') return 0;
    if (v[i] == '@') { if (at >= 0) return 0; at = i; }
  }
  if (at <= 0 || at >= len - 1) return 0;
  // domain: after @ there must be a '.' with non-empty parts, no '@' later
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
  // parseInt semantics: leading digits only; NaN if none
  int i = 0;
  while (v[i] == ' ' || v[i] == '\t') i++;
  int sign = 1;
  if (v[i] == '-') { sign = -1; i++; }
  int n = 0;
  int any = 0;
  while (v[i] >= '0' && v[i] <= '9') { n = n * 10 + (v[i] - '0'); any = 1; i++; }
  if (!any) return -1; // NaN sentinel
  return sign * n;
}

static void field_copy(unsigned char *dst, const unsigned char *src, unsigned int len) {
  unsigned int i;
  for (i = 0; i < len && i < FIELD_CAP - 1; i++) dst[i] = src[i];
  dst[i] = 0;
}

__attribute__((export_name("run_trace")))
int run_trace(
    unsigned char *fields,
    const unsigned int *actions,
    const unsigned char *values,
    unsigned int actions_len,
    unsigned int *steps,
    unsigned int *results) {
  unsigned int total_errors = 0;
  unsigned int step_count = 0;

  for (unsigned int a = 0; a < actions_len && a < MAX_ACTIONS; a++) {
    const unsigned int packed = actions[a];
    const unsigned int field = packed & 0xff;
    const unsigned int type = (packed >> 8) & 0xff;
    const unsigned int len = (packed >> 16) & 0xff;
    if (field >= FIELDS) continue;
    const unsigned char *val = &values[a * FIELD_CAP];
    field_copy(&fields[field * FIELD_CAP], val, len);

    // per-rule evaluation (mirrors runFormValidationJS exactly)
    unsigned int mask = 0;
    unsigned int errs = 0;
    // Rule 1: email format
    if (fields[0 * FIELD_CAP] != 0 && !email_valid(&fields[0 * FIELD_CAP])) { mask |= 1; errs++; }
    // Rule 2: password min length 8
    {
      unsigned int plen = 0;
      while (fields[1 * FIELD_CAP + plen]) plen++;
      if (fields[1 * FIELD_CAP] != 0 && plen < 8) { mask |= 2; errs++; }
    }
    // Rule 3: dependent confirm
    {
      unsigned int i = 0;
      while (fields[2 * FIELD_CAP + i] && i < FIELD_CAP - 1) i++;
      unsigned int j = 0;
      while (fields[1 * FIELD_CAP + j] && j < FIELD_CAP - 1) j++;
      int same = (i == j);
      if (same) for (unsigned int k = 0; k < i; k++) if (fields[2 * FIELD_CAP + k] != fields[1 * FIELD_CAP + k]) { same = 0; break; }
      if (fields[2 * FIELD_CAP] != 0 && !same) { mask |= 4; errs++; }
    }
    // Rule 4: age requirement (>= 18)
    if (fields[3 * FIELD_CAP] != 0) {
      const int age = parse_age(&fields[3 * FIELD_CAP]);
      if (age < 0 || age < 18) { mask |= 8; errs++; }
    }
    // Rule 5: terms agreement
    if (fields[7 * FIELD_CAP] != 0 && !(fields[7 * FIELD_CAP] == 't' && fields[7 * FIELD_CAP + 1] == 'r' &&
        fields[7 * FIELD_CAP + 2] == 'u' && fields[7 * FIELD_CAP + 3] == 'e' && fields[7 * FIELD_CAP + 4] == 0)) {
      mask |= 16; errs++;
    }

    total_errors += errs;
    steps[step_count * 4] = field;
    steps[step_count * 4 + 1] = type;
    steps[step_count * 4 + 2] = mask;
    steps[step_count * 4 + 3] = a;
    step_count++;
  }

  // active errors at the end
  unsigned int active = 0;
  if (fields[0] != 0 && !email_valid(fields)) active++;
  {
    unsigned int plen = 0;
    while (fields[FIELD_CAP + plen]) plen++;
    if (fields[FIELD_CAP] != 0 && plen < 8) active++;
  }
  {
    unsigned int i = 0, j = 0;
    while (fields[2 * FIELD_CAP + i] && i < FIELD_CAP - 1) i++;
    while (fields[FIELD_CAP + j] && j < FIELD_CAP - 1) j++;
    int same = (i == j);
    if (same) for (unsigned int k = 0; k < i; k++) if (fields[2 * FIELD_CAP + k] != fields[FIELD_CAP + k]) { same = 0; break; }
    if (fields[2 * FIELD_CAP] != 0 && !same) active++;
  }
  if (fields[3 * FIELD_CAP] != 0) {
    const int age = parse_age(&fields[3 * FIELD_CAP]);
    if (age < 0 || age < 18) active++;
  }
  if (fields[7 * FIELD_CAP] != 0 && !(fields[7 * FIELD_CAP] == 't' && fields[7 * FIELD_CAP + 1] == 'r' &&
      fields[7 * FIELD_CAP + 2] == 'u' && fields[7 * FIELD_CAP + 3] == 'e' && fields[7 * FIELD_CAP + 4] == 0)) {
    active++;
  }

  results[0] = total_errors;
  results[1] = active;
  results[2] = step_count;
  return (int)step_count;
}
