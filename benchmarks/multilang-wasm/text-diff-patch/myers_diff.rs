#![no_std]

#[panic_handler]
fn panic(_info: &core::panic::PanicInfo) -> ! {
    core::arch::wasm32::unreachable()
}

// text-diff-patch multilang kernel — exact mirror of the C/JS myersDiff:
// prefix/suffix trim, O(ND) forward pass with per-d trace snapshots, same
// backtrack, same op emission order, same counters. Inputs are interned line
// IDs (u32). Emits (op, x, y) triples; values are derivable from base/target.

#[no_mangle]
pub extern "C" fn myers_diff(
    base: *const u32,
    base_len: u32,
    target: *const u32,
    target_len: u32,
    out_op: *mut u32,
    out_x: *mut u32,
    out_y: *mut u32,
    out_cap: u32,
    scratch: *mut u32,
    scratch_u32: u32,
    out_edit_distance: *mut u32,
    out_frontier_steps: *mut u32,
) -> u32 {
    unsafe {
        let base_slice = core::slice::from_raw_parts(base, base_len as usize);
        let target_slice = core::slice::from_raw_parts(target, target_len as usize);

        let mut prefix: u32 = 0;
        while prefix < base_len && prefix < target_len
            && base_slice[prefix as usize] == target_slice[prefix as usize]
        {
            prefix += 1;
        }
        let mut suffix: u32 = 0;
        while suffix < base_len - prefix && suffix < target_len - prefix
            && base_slice[(base_len - 1 - suffix) as usize]
                == target_slice[(target_len - 1 - suffix) as usize]
        {
            suffix += 1;
        }
        let n = base_len - prefix - suffix;
        let m = target_len - prefix - suffix;
        let max = n + m;
        let vstride = (2 * max + 1) as usize;
        let v = core::slice::from_raw_parts_mut(scratch, vstride);
        let trace = core::slice::from_raw_parts_mut(scratch.add(vstride), vstride * (max + 1) as usize);

        let mut count: u32 = 0;
        let mut edit_distance: u32 = 0;
        let mut frontier_steps: u32 = 0;

        // Suffix equal ops first (JS push order).
        for index in 0..suffix {
            if count >= out_cap { break; }
            *out_op.add(count as usize) = 0;
            *out_x.add(count as usize) = base_len - 1 - index;
            *out_y.add(count as usize) = target_len - 1 - index;
            count += 1;
        }

        if n == 0 {
            for y in (0..m).rev() {
                if count >= out_cap { break; }
                *out_op.add(count as usize) = 2;
                *out_x.add(count as usize) = prefix;
                *out_y.add(count as usize) = prefix + y;
                count += 1;
            }
            edit_distance = m;
        } else if m == 0 {
            for x in (0..n).rev() {
                if count >= out_cap { break; }
                *out_op.add(count as usize) = 1;
                *out_x.add(count as usize) = prefix + x;
                *out_y.add(count as usize) = prefix;
                count += 1;
            }
            edit_distance = n;
        } else {
            let offset = max as isize;
            v[(offset + 1) as usize] = 0;
            let mut d: u32 = 0;
            let mut done = false;
            while d <= max && !done {
                let mut kk: u32 = 0;
                while kk <= 2 * d && !done {
                    let k = kk as isize - d as isize;
                    frontier_steps += 1;
                    let mut x: isize = if k == -(d as isize)
                        || (k != d as isize
                            && v[(offset + k - 1) as usize] < v[(offset + k + 1) as usize])
                    {
                        v[(offset + k + 1) as usize] as isize
                    } else {
                        v[(offset + k - 1) as usize] as isize + 1
                    };
                    let mut y = x - k;
                    while (x as u32) < n
                        && (y as u32) < m
                        && base_slice[(prefix + x as u32) as usize]
                            == target_slice[(prefix + y as u32) as usize]
                    {
                        x += 1;
                        y += 1;
                    }
                    v[(offset + k) as usize] = x as u32;
                    if (x as u32) >= n && (y as u32) >= m {
                        trace[(d as usize) * vstride..(d as usize) * vstride + vstride].copy_from_slice(v);
                        edit_distance = d;
                        done = true;
                        break;
                    }
                    kk += 2;
                }
                if !done {
                    trace[(d as usize) * vstride..(d as usize) * vstride + vstride].copy_from_slice(v);
                }
                d += 1;
            }

            let mut x = n as isize;
            let mut y = m as isize;
            let mut d = edit_distance;
            while d > 0 {
                let prior = &trace[((d - 1) as usize) * vstride..((d - 1) as usize) * vstride + vstride];
                let k = x - y;
                let down = k == -(d as isize)
                    || (k != d as isize && prior[(offset + k - 1) as usize] < prior[(offset + k + 1) as usize]);
                let previous_k = if down { k + 1 } else { k - 1 };
                let previous_x = prior[(offset + previous_k) as usize] as isize;
                let previous_y = previous_x - previous_k;
                while x > previous_x && y > previous_y {
                    x -= 1;
                    y -= 1;
                    if count >= out_cap { break; }
                    *out_op.add(count as usize) = 0;
                    *out_x.add(count as usize) = prefix + x as u32;
                    *out_y.add(count as usize) = prefix + y as u32;
                    count += 1;
                }
                if down {
                    y -= 1;
                    if count >= out_cap { break; }
                    *out_op.add(count as usize) = 2;
                    *out_x.add(count as usize) = prefix + x as u32;
                    *out_y.add(count as usize) = prefix + y as u32;
                    count += 1;
                } else {
                    x -= 1;
                    if count >= out_cap { break; }
                    *out_op.add(count as usize) = 1;
                    *out_x.add(count as usize) = prefix + x as u32;
                    *out_y.add(count as usize) = prefix + y as u32;
                    count += 1;
                }
                d -= 1;
            }
        }
        // Prefix equal ops.
        for index in (0..prefix).rev() {
            if count >= out_cap { break; }
            *out_op.add(count as usize) = 0;
            *out_x.add(count as usize) = index;
            *out_y.add(count as usize) = index;
            count += 1;
        }
        // Reverse the whole script (JS reverse.reverse()).
        for i in 0..count / 2 {
            let j = count - 1 - i;
            let (to, tx, ty) = (
                *out_op.add(i as usize),
                *out_x.add(i as usize),
                *out_y.add(i as usize),
            );
            *out_op.add(i as usize) = *out_op.add(j as usize);
            *out_x.add(i as usize) = *out_x.add(j as usize);
            *out_y.add(i as usize) = *out_y.add(j as usize);
            *out_op.add(j as usize) = to;
            *out_x.add(j as usize) = tx;
            *out_y.add(j as usize) = ty;
        }

        *out_edit_distance = edit_distance;
        *out_frontier_steps = frontier_steps;
        count
    }
}
