// form_validate_kernel.ts — AssemblyScript multilang compute core for
// dom.dependent-form-validation.v1. Same ABI as the C kernel: generates the
// frozen 240-action trace from seed 0x2468ace0, runs the 10-field JS reference
// model, writes counters to a fixed offset, returns totalErrors. Raw
// linear-memory access only (no heap allocation, no runtime imports).

const FIELDS = 10;
const FIELD_CAP = 32;
const ACTIONS = 240;

// Memory layout:
//   fields:  u8[10*32] at 0    → bytes 0..320
//   val:     u8[32]    at 320  → bytes 320..352 (per-action scratch buffer)
//   results: u32[3]    at 16384
const FIELDS_OFFSET: usize = 0;
const VAL_OFFSET: usize = 320;
// 8-byte scratch buffer for decimal-string formatting of the age value.
const AGE_BUF_OFFSET: usize = 352;
// 12-byte static "@example.com" suffix rendered into linear memory.
const EMAIL_SUFFIX_OFFSET: usize = 384;
const RESULTS_OFFSET: usize = 16384;

let seed: u32 = 0;

function randNext(): f64 {
  seed ^= seed << 13;
  // replicate the JS engine's rand(): >> 17 applies to the int32
  // interpretation (arithmetic, sign-extending).
  seed ^= (<i32> seed >> 17) as u32;
  seed ^= seed << 5;
  return (<f64> seed) / 4294967296.0;
}

function fieldByte(field: i32, i: i32): u8 {
  return load<u8>(FIELDS_OFFSET + <usize> field * FIELD_CAP + <usize> i);
}
function fieldLen(field: i32): i32 {
  let i = 0;
  while (i < FIELD_CAP && fieldByte(field, i) !== 0) i++;
  return i;
}
function emailValid(field: i32): bool {
  const len = fieldLen(field);
  if (len === 0) return false;
  let at: i32 = -1;
  for (let i = 0; i < len; i++) {
    const c = fieldByte(field, i);
    if (c === 0x20 || c === 0x09 || c === 0x0a || c === 0x0d) return false;
    if (c === 0x40) {
      if (at >= 0) return false;
      at = i;
    }
  }
  if (at <= 0 || at >= len - 1) return false;
  let dot: i32 = -1;
  for (let i = at + 1; i < len; i++) {
    const c = fieldByte(field, i);
    if (c === 0x40) return false;
    if (c === 0x2e) dot = i;
  }
  if (dot < 0) return false;
  if (dot === at + 1 || dot === len - 1) return false;
  return true;
}
function parseAge(field: i32): i32 {
  let i = 0;
  while (i < FIELD_CAP) {
    const c = fieldByte(field, i);
    if (c !== 0x20 && c !== 0x09) break;
    i++;
  }
  let neg = false;
  if (i < FIELD_CAP && fieldByte(field, i) === 0x2d) {
    neg = true;
    i++;
  }
  let n: i32 = 0;
  let any = false;
  while (i < FIELD_CAP) {
    const c = fieldByte(field, i);
    if (c < 0x30 || c > 0x39) break;
    n = n * 10 + (c - 0x30);
    any = true;
    i++;
  }
  if (!any) return -1;
  return neg ? -n : n;
}
function fieldsEqual(a: i32, b: i32): bool {
  let i = 0;
  while (i < FIELD_CAP) {
    const ca = fieldByte(a, i);
    const cb = fieldByte(b, i);
    if (ca !== cb) return false;
    if (ca === 0) return true;
    i++;
  }
  return true;
}
function isTermsTrue(field: i32): bool {
  return fieldByte(field, 0) === 0x74 && fieldByte(field, 1) === 0x72 &&
    fieldByte(field, 2) === 0x75 && fieldByte(field, 3) === 0x65 &&
    fieldByte(field, 4) === 0;
}
function validate(): u32 {
  let errs: u32 = 0;
  if (fieldByte(0, 0) !== 0 && !emailValid(0)) errs++;
  if (fieldByte(1, 0) !== 0 && fieldLen(1) < 8) errs++;
  if (fieldByte(2, 0) !== 0 && !fieldsEqual(2, 1)) errs++;
  if (fieldByte(3, 0) !== 0) {
    const a = parseAge(3);
    if (a < 0 || a < 18) errs++;
  }
  if (fieldByte(7, 0) !== 0 && !isTermsTrue(7)) errs++;
  return errs;
}

export function form_validate_trace(): i32 {
  // Clear all field slots.
  for (let i = 0; i < FIELDS * FIELD_CAP; i++) {
    store<u8>(FIELDS_OFFSET + <usize> i, 0);
  }
  // Populate the "@example.com" suffix scratch region (idempotent).
  store<u8>(EMAIL_SUFFIX_OFFSET + 0, 0x40); // '@'
  store<u8>(EMAIL_SUFFIX_OFFSET + 1, 0x65); // 'e'
  store<u8>(EMAIL_SUFFIX_OFFSET + 2, 0x78); // 'x'
  store<u8>(EMAIL_SUFFIX_OFFSET + 3, 0x61); // 'a'
  store<u8>(EMAIL_SUFFIX_OFFSET + 4, 0x6d); // 'm'
  store<u8>(EMAIL_SUFFIX_OFFSET + 5, 0x70); // 'p'
  store<u8>(EMAIL_SUFFIX_OFFSET + 6, 0x6c); // 'l'
  store<u8>(EMAIL_SUFFIX_OFFSET + 7, 0x65); // 'e'
  store<u8>(EMAIL_SUFFIX_OFFSET + 8, 0x2e); // '.'
  store<u8>(EMAIL_SUFFIX_OFFSET + 9, 0x63); // 'c'
  store<u8>(EMAIL_SUFFIX_OFFSET + 10, 0x6f); // 'o'
  store<u8>(EMAIL_SUFFIX_OFFSET + 11, 0x6d); // 'm'

  seed = 0x2468ace0;
  let totalErrors: u32 = 0;
  let totalValidations: u32 = 0;

  for (let a = 0; a < ACTIONS; a++) {
    const field = <i32> (randNext() * 10.0);
    const valLenAlpha = 3 + <i32> (randNext() * 15.0);
    let vlen: i32 = 0;
    for (let j = 0; j < valLenAlpha; j++) {
      const c = <i32> (randNext() * 26.0);
      if (vlen < FIELD_CAP - 1) {
        store<u8>(VAL_OFFSET + <usize> vlen, <u8> (0x61 + c));
        vlen++;
      }
    }
    if (field === 0) {
      // "@example.com" — read from the pre-initialized scratch region.
      for (let j = 0; j < 12; j++) {
        if (vlen < FIELD_CAP - 1) {
          store<u8>(VAL_OFFSET + <usize> vlen, load<u8>(EMAIL_SUFFIX_OFFSET + <usize> j));
          vlen++;
        }
      }
    } else if (field === 3) {
      const age = 15 + <i32> (randNext() * 50.0);
      vlen = 0;
      let nb: i32 = 0;
      let x = age;
      do {
        store<u8>(AGE_BUF_OFFSET + <usize> nb, <u8> (0x30 + (x % 10)));
        nb++;
        x = (x / 10) as i32;
      } while (x !== 0);
      let j = nb - 1;
      while (j >= 0) {
        store<u8>(VAL_OFFSET + <usize> vlen, load<u8>(AGE_BUF_OFFSET + <usize> j));
        vlen++;
        j--;
      }
    } else if (field === 7) {
      const truthy = randNext() > 0.5;
      vlen = 0;
      if (truthy) {
        store<u8>(VAL_OFFSET + 0, 0x74);
        store<u8>(VAL_OFFSET + 1, 0x72);
        store<u8>(VAL_OFFSET + 2, 0x75);
        store<u8>(VAL_OFFSET + 3, 0x65);
        vlen = 4;
      } else {
        store<u8>(VAL_OFFSET + 0, 0x66);
        store<u8>(VAL_OFFSET + 1, 0x61);
        store<u8>(VAL_OFFSET + 2, 0x6c);
        store<u8>(VAL_OFFSET + 3, 0x73);
        store<u8>(VAL_OFFSET + 4, 0x65);
        vlen = 5;
      }
    }
    // Consume the type rand regardless (input/blur).
    randNext();
    if (vlen < FIELD_CAP) store<u8>(VAL_OFFSET + <usize> vlen, 0);

    // Copy scratch into fields[field] (truncated to FIELD_CAP-1).
    if (field >= 0 && field < FIELDS) {
      const dstBase: usize = FIELDS_OFFSET + <usize> field * FIELD_CAP;
      let cp: i32 = 0;
      while (cp < vlen && cp < FIELD_CAP - 1) {
        store<u8>(dstBase + <usize> cp, load<u8>(VAL_OFFSET + <usize> cp));
        cp++;
      }
      store<u8>(dstBase + <usize> cp, 0);
    }
    totalValidations++;

    totalErrors += validate();
  }

  const active = validate();
  store<u32>(RESULTS_OFFSET, totalErrors);
  store<u32>(RESULTS_OFFSET + 4, active);
  store<u32>(RESULTS_OFFSET + 8, totalValidations);
  return <i32> totalErrors;
}
