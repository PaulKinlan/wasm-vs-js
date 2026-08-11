// keyed_list_kernel.rs — multilang compute core for dom.keyed-list-mutation.v1.
// Same ABI: generates the frozen 2,000-action trace from seed 0x1a2b3c4d,
// runs the 1,000-item JS reference model, writes counters to fixed offset
// 16384 (via raw pointer), returns finalKeySum.
#![no_std]
#![no_main]
use core::panic::PanicInfo;

#[panic_handler]
fn panic(_info: &PanicInfo) -> ! { loop {} }

const INITIAL_ITEMS: usize = 1000;
const ACTIONS: usize = 2000;
const ITEMS_MAX: usize = 4900;
const RES_OFFSET: usize = 16384;

static mut SEED: u32 = 0x1a2b3c4d;

fn rand_next() -> f64 {
    unsafe {
        SEED ^= SEED << 13;
        SEED ^= ((SEED as i32) >> 17) as u32;
        SEED ^= SEED << 5;
        (SEED as f64) / 4294967296.0
    }
}

#[unsafe(no_mangle)]
pub extern "C" fn keyed_list_trace() -> i32 {
    let mut items = [0i32; ITEMS_MAX];
    let mut count: usize = INITIAL_ITEMS;
    for i in 0..INITIAL_ITEMS {
        items[i] = i as i32;
    }

    unsafe { SEED = 0x1a2b3c4d; }
    let mut patches: u32 = 0;
    let mut text_mutations: u32 = 0;
    for _ in 0..ACTIONS {
        let op = (rand_next() * 5.0) as u32;
        let key = (rand_next() * 1000.0) as u32;
        let target_key = (rand_next() * 1000.0) as u32;
        let _ = rand_next();

        if op == 0 {
            if count < ITEMS_MAX {
                items[count] = key as i32;
                count += 1;
                patches += 1;
            }
        } else if op == 1 {
            let mut idx: i32 = -1;
            for i in 0..count {
                if items[i] == key as i32 { idx = i as i32; break; }
            }
            if idx >= 0 {
                let idx = idx as usize;
                for i in idx..count - 1 { items[i] = items[i + 1]; }
                count -= 1;
                patches += 1;
            }
        } else if op == 2 {
            if count >= 2 {
                let idx1 = (key as usize) % count;
                let idx2 = (target_key as usize) % count;
                let tmp = items[idx1];
                items[idx1] = items[idx2];
                items[idx2] = tmp;
                patches += 2;
            }
        } else if op == 3 {
            let mut idx: i32 = -1;
            for i in 0..count {
                if items[i] == key as i32 { idx = i as i32; break; }
            }
            if idx >= 0 {
                text_mutations += 1;
            }
        } else if op == 4 {
            if count >= 2 {
                let mut idx: i32 = -1;
                for i in 0..count {
                    if items[i] == key as i32 { idx = i as i32; break; }
                }
                if idx >= 0 {
                    let idx = idx as usize;
                    let moved = items[idx];
                    for i in idx..count - 1 { items[i] = items[i + 1]; }
                    count -= 1;
                    let target_idx = (target_key as usize) % count;
                    let mut i = count;
                    while i > target_idx {
                        items[i] = items[i - 1];
                        i -= 1;
                    }
                    items[target_idx] = moved;
                    count += 1;
                    patches += 1;
                }
            }
        }
    }

    let mut key_sum: u32 = 0;
    for i in 0..count {
        key_sum = key_sum.wrapping_add(items[i] as u32);
    }
    unsafe {
        let results = RES_OFFSET as *mut u32;
        results.write_volatile(patches);
        results.add(1).write_volatile(text_mutations);
        results.add(2).write_volatile(count as u32);
        results.add(3).write_volatile(key_sum);
    }
    key_sum as i32
}
