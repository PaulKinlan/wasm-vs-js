#![no_std]

#[panic_handler]
fn panic(_info: &core::panic::PanicInfo) -> ! {
    core::arch::wasm32::unreachable()
}

// text-regex-log-scan multilang kernel — exact mirror of the C scan_log:
// same 20 SAFE_PATTERNS, same first-byte dispatch buckets, same
// url-tail/ipv4/status matchers, same counters. Pure raw-pointer arithmetic
// (no slice bounds checks) to match the C semantics exactly.

const PATTERN_COUNT: u32 = 20;
const MAX_BUCKET: u32 = 4;
// matcher ids: 1 = url-tail, 2 = ipv4, 3 = status
// Flat prefix bytes (each row zero-padded to 16) + per-pattern lens.
static PATTERN_PREFIX_BYTES: [u8; 320] = [
        b'h', b't', b't', b'p', b':', b'/', b'/', 0, 0, 0, 0, 0, 0, 0, 0, 0,
        b'h', b't', b't', b'p', b's', b':', b'/', b'/', 0, 0, 0, 0, 0, 0, 0, 0,
        b'w', b's', b':', b'/', b'/', 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0,
        b'w', b's', b's', b':', b'/', b'/', 0, 0, 0, 0, 0, 0, 0, 0, 0, 0,
        b'f', b't', b'p', b':', b'/', b'/', 0, 0, 0, 0, 0, 0, 0, 0, 0, 0,
        b'a', b's', b's', b'e', b't', b':', b'/', b'/', 0, 0, 0, 0, 0, 0, 0, 0,
        b'a', b'p', b'i', b':', b'/', b'/', 0, 0, 0, 0, 0, 0, 0, 0, 0, 0,
        b'c', b'd', b'n', b':', b'/', b'/', 0, 0, 0, 0, 0, 0, 0, 0, 0, 0,
        b'i', b'p', b'=', 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0,
        b'c', b'l', b'i', b'e', b'n', b't', b'-', b'i', b'p', b':', 0, 0, 0, 0, 0, 0,
        b's', b'o', b'u', b'r', b'c', b'e', b'-', b'i', b'p', b':', 0, 0, 0, 0, 0, 0,
        b'd', b'e', b's', b't', b'-', b'i', b'p', b':', 0, 0, 0, 0, 0, 0, 0, 0,
        b'p', b'e', b'e', b'r', b'-', b'i', b'p', b':', 0, 0, 0, 0, 0, 0, 0, 0,
        b'o', b'r', b'i', b'g', b'i', b'n', b'-', b'i', b'p', b':', 0, 0, 0, 0, 0, 0,
        b's', b't', b'a', b't', b'u', b's', b'=', 0, 0, 0, 0, 0, 0, 0, 0, 0,
        b'c', b'o', b'd', b'e', b'=', 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0,
        b'h', b't', b't', b'p', b'-', b's', b't', b'a', b't', b'u', b's', b':', 0, 0, 0, 0,
        b'r', b'e', b's', b'p', b'o', b'n', b's', b'e', b'-', b's', b't', b'a', b't', b'u', b's', b':',
        b'r', b'e', b's', b'u', b'l', b't', b'-', b's', b't', b'a', b't', b'u', b's', b':', 0, 0,
        b's', b't', b'a', b't', b'u', b's', b'-', b'c', b'o', b'd', b'e', b':', 0, 0, 0, 0,
];
static PATTERN_LENS: [u8; 20] = [
    7, 8, 5, 6, 6, 8, 6, 6, 3, 10, 10, 8, 8, 10, 7, 5, 12, 16, 14, 12,
];
static PATTERN_MATCHERS: [u8; 20] = [
    1, 1, 1, 1, 1, 1, 1, 1, 2, 2, 2, 2, 2, 2, 3, 3, 3, 3, 3, 3,
];

#[inline(always)]
unsafe fn prefix_ptr(p: u32) -> (*const u8, u32) {
    (
        PATTERN_PREFIX_BYTES.as_ptr().add((p * 16) as usize),
        PATTERN_LENS[p as usize] as u32,
    )
}

#[inline(always)]
fn is_url_tail(byte: u8) -> bool {
    (byte >= 97 && byte <= 122) || (byte >= 48 && byte <= 57)
        || byte == 46 || byte == 47 || byte == 95 || byte == 45
}

#[no_mangle]
pub extern "C" fn scan_log(
    bytes: *const u8,
    len: u32,
    out_id: *mut u32,
    out_start: *mut u32,
    out_end: *mut u32,
    out_cap: u32,
    scratch: *mut u32,
    out_candidate_starts: *mut u32,
    out_prefix_comparisons: *mut u32,
    out_tail_comparisons: *mut u32,
) -> u32 {
    unsafe {
        // Dispatch buckets: scratch[b * 5] = count, then indices.
        for b in 0..256u32 {
            *scratch.add((b * 5) as usize) = 0;
        }
        for p in 0..PATTERN_COUNT {
            let (prefix_p, _) = prefix_ptr(p);
            let first = *prefix_p as u32;
            let slot = scratch.add((first * (MAX_BUCKET + 1)) as usize);
            let count = *slot;
            *slot.add(1 + count as usize) = p;
            *slot = count + 1;
        }

        let mut match_count: u32 = 0;
        let mut candidate_starts: u32 = 0;
        let mut prefix_comparisons: u32 = 0;
        let mut tail_comparisons: u32 = 0;

        let mut start: u32 = 0;
        while start < len {
            let b = *bytes.add(start as usize);
            let slot = scratch.add((b as u32 * (MAX_BUCKET + 1)) as usize);
            let count = *slot;
            let mut bi: u32 = 0;
            while bi < count {
                let pattern_index = *slot.add(1 + bi as usize);
                candidate_starts += 1;
                let (prefix, plen) = prefix_ptr(pattern_index);
                let mut matched = true;
                let mut index: u32 = 0;
                while index < plen {
                    if start + index >= len {
                        matched = false;
                        break;
                    }
                    prefix_comparisons += 1;
                    if *bytes.add((start + index) as usize) != *prefix.add(index as usize) {
                        matched = false;
                        break;
                    }
                    index += 1;
                }
                if !matched {
                    bi += 1;
                    continue;
                }
                let cursor = start + plen;
                let mut end: i64 = -1;
                match PATTERN_MATCHERS[pattern_index as usize] {
                    1 => {
                        // url-tail
                        let s0 = cursor;
                        let mut c = cursor;
                        while c < len && c - s0 < 96 {
                            tail_comparisons += 1;
                            if !is_url_tail(*bytes.add(c as usize)) {
                                break;
                            }
                            c += 1;
                        }
                        if c == s0 {
                            end = -1;
                        } else if c - s0 == 96 && c < len && is_url_tail(*bytes.add(c as usize)) {
                            tail_comparisons += 1;
                            end = -1;
                        } else {
                            end = c as i64;
                        }
                    }
                    2 => {
                        // ipv4
                        let mut c = cursor;
                        let mut failed = false;
                        let mut octet: u32 = 0;
                        while octet < 4 {
                            let s1 = c;
                            let mut value: u32 = 0;
                            while c < len && c - s1 < 3 {
                                let byte = *bytes.add(c as usize);
                                tail_comparisons += 1;
                                if byte < 48 || byte > 57 {
                                    break;
                                }
                                value = value * 10 + byte as u32 - 48;
                                c += 1;
                            }
                            let digits = c - s1;
                            if digits == 0 || value > 255 || (digits > 1 && *bytes.add(s1 as usize) == 48) {
                                failed = true;
                                break;
                            }
                            if octet < 3 {
                                if c >= len {
                                    failed = true;
                                    break;
                                }
                                tail_comparisons += 1;
                                if *bytes.add(c as usize) != 46 {
                                    failed = true;
                                    break;
                                }
                                c += 1;
                            }
                            octet += 1;
                        }
                        if !failed {
                            if c < len {
                                tail_comparisons += 1;
                                if *bytes.add(c as usize) >= 48 && *bytes.add(c as usize) <= 57 {
                                    end = -1;
                                } else if *bytes.add(c as usize) == 46 {
                                    end = -1;
                                } else {
                                    end = c as i64;
                                }
                            } else {
                                end = c as i64;
                            }
                        }
                    }
                    _ => {
                        // status
                        if cursor + 3 > len {
                            end = -1;
                        } else {
                            let mut value: u32 = 0;
                            let mut ok = true;
                            let mut index: u32 = 0;
                            while index < 3 {
                                let byte = *bytes.add((cursor + index) as usize);
                                tail_comparisons += 1;
                                if byte < 48 || byte > 57 {
                                    ok = false;
                                    break;
                                }
                                value = value * 10 + byte as u32 - 48;
                                index += 1;
                            }
                            if ok && (value < 100 || value > 599) {
                                ok = false;
                            }
                            if !ok {
                                end = -1;
                            } else {
                                let endp = cursor + 3;
                                if endp < len {
                                    tail_comparisons += 1;
                                    if *bytes.add(endp as usize) >= 48 && *bytes.add(endp as usize) <= 57 {
                                        end = -1;
                                    } else {
                                        end = endp as i64;
                                    }
                                } else {
                                    end = endp as i64;
                                }
                            }
                        }
                    }
                }
                if end >= 0 && match_count < out_cap {
                    *out_id.add(match_count as usize) = pattern_index;
                    *out_start.add(match_count as usize) = start;
                    *out_end.add(match_count as usize) = end as u32;
                    match_count += 1;
                }
                bi += 1;
            }
            start += 1;
        }
        *out_candidate_starts = candidate_starts;
        *out_prefix_comparisons = prefix_comparisons;
        *out_tail_comparisons = tail_comparisons;
        match_count
    }
}
