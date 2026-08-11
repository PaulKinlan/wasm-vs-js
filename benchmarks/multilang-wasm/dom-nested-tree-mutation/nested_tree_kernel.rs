// nested_tree_kernel.rs — multilang compute core for
// dom.nested-tree-mutation.v1. Same ABI: generates the frozen 1,200-action
// trace from seed 0x5e6f7788, runs the 500-node JS reference model, writes
// counters to fixed offset 16384 (via raw pointer), returns finalNodeIdSum.
#![no_std]
#![no_main]
use core::panic::PanicInfo;

#[panic_handler]
fn panic(_info: &PanicInfo) -> ! { loop {} }

const INITIAL_NODES: usize = 500;
const ACTIONS: usize = 1200;
const MAX_NODES: usize = 2000;
const PARENT_MISSING: i32 = -2;
const PARENT_ROOT: i32 = -1;
const RES_OFFSET: usize = 16384;

static mut SEED: u32 = 0x5e6f7788;

fn rand_next() -> f64 {
    unsafe {
        SEED ^= SEED << 13;
        SEED ^= ((SEED as i32) >> 17) as u32;
        SEED ^= SEED << 5;
        (SEED as f64) / 4294967296.0
    }
}

#[unsafe(no_mangle)]
pub extern "C" fn nested_tree_trace() -> i32 {
    let mut parent = [PARENT_MISSING; MAX_NODES];
    parent[0] = PARENT_ROOT;
    for i in 1..INITIAL_NODES {
        parent[i] = ((i - 1) / 3) as i32;
    }
    let mut node_count: i32 = INITIAL_NODES as i32;

    unsafe { SEED = 0x5e6f7788; }
    let mut total_mutations: u32 = 0;
    let mut attr_updates: u32 = 0;
    for a in 0..ACTIONS {
        let op = (rand_next() * 5.0) as u32;
        let target_id = (rand_next() * 400.0) as u32;
        let parent_id = (rand_next() * 400.0) as u32;
        let _ = rand_next();
        let _ = rand_next();
        let action_id = (a as u32) + 500;

        if op == 0 {
            if (parent_id as usize) < MAX_NODES && parent[parent_id as usize] != PARENT_MISSING {
                if (action_id as usize) < MAX_NODES
                    && parent[action_id as usize] == PARENT_MISSING
                {
                    parent[action_id as usize] = parent_id as i32;
                    node_count += 1;
                    total_mutations += 1;
                }
            }
        } else if op == 1 {
            if target_id > 0 && (target_id as usize) < MAX_NODES
                && parent[target_id as usize] != PARENT_MISSING
            {
                parent[target_id as usize] = PARENT_MISSING;
                node_count -= 1;
                total_mutations += 1;
            }
        } else if op == 2 {
            if target_id > 0 && (target_id as usize) < MAX_NODES
                && parent[target_id as usize] != PARENT_MISSING
                && (parent_id as usize) < MAX_NODES
                && parent[parent_id as usize] != PARENT_MISSING
                && target_id != parent_id
            {
                parent[target_id as usize] = parent_id as i32;
                total_mutations += 1;
            }
        } else if op == 3 {
            if (target_id as usize) < MAX_NODES && parent[target_id as usize] != PARENT_MISSING {
                attr_updates += 1;
            }
        } else if op == 4 {
            if target_id > 0 && (target_id as usize) < MAX_NODES
                && parent[target_id as usize] != PARENT_MISSING
            {
                total_mutations += 1;
            }
        }
    }

    let mut id_sum: u32 = 0;
    for i in 0..MAX_NODES {
        if parent[i] != PARENT_MISSING {
            id_sum = id_sum.wrapping_add(i as u32);
        }
    }
    unsafe {
        let results = RES_OFFSET as *mut u32;
        results.write_volatile(total_mutations);
        results.add(1).write_volatile(attr_updates);
        results.add(2).write_volatile(node_count as u32);
        results.add(3).write_volatile(id_sum);
    }
    id_sum as i32
}
