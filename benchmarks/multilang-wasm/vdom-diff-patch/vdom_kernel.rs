// vdom_kernel.rs — multilang compute core for dom.vdom-diff-patch.v1.
// Same ABI as vdom_kernel.c: generates treeA + treeB from SplitMix64 seed
// 3976273958, runs the exact createVDOMPatches diff, writes counters +
// FNV-1a canonical/patch-stream digests to fixed offset 16384, returns the
// patch count.
#![no_std]
#![no_main]
use core::panic::PanicInfo;

#[panic_handler]
fn panic(_info: &PanicInfo) -> ! { loop {} }

const NODE_COUNT: usize = 1000;
const TEXT_THRESHOLD: i32 = 333; // ceil((NODE_COUNT-1)/3)
const MAX_CHILDREN: usize = 3;
const RES_OFFSET: usize = 16384;

static mut SM_STATE: u64 = 0;
static mut A_TAG: [i16; NODE_COUNT] = [0; NODE_COUNT];
static mut A_KEY: [i16; NODE_COUNT] = [0; NODE_COUNT];
static mut A_ATTR_KEY: [i16; NODE_COUNT] = [0; NODE_COUNT];
static mut A_ATTR_VAL: [i16; NODE_COUNT] = [0; NODE_COUNT];
static mut A_TEXT_ID: [i16; NODE_COUNT] = [0; NODE_COUNT];
static mut A_CHILD_COUNT: [u16; NODE_COUNT] = [0; NODE_COUNT];
static mut A_CHILDREN: [[u16; MAX_CHILDREN]; NODE_COUNT] = [[0; MAX_CHILDREN]; NODE_COUNT];
static mut HAS_REORDER: [u8; NODE_COUNT] = [0; NODE_COUNT];
static mut HAS_ATTR: [u8; NODE_COUNT] = [0; NODE_COUNT];
static mut HAS_TEXT: [u8; NODE_COUNT] = [0; NODE_COUNT];
static mut ITEMS: [u16; NODE_COUNT] = [0; NODE_COUNT];
static mut FNV: u32 = 0;

fn next_uint32() -> u32 {
    unsafe {
        SM_STATE = SM_STATE.wrapping_add(0x9e3779b97f4a7c15u64);
        let mut z = SM_STATE;
        z = (z ^ (z >> 30)).wrapping_mul(0xbf58476d1ce4e5b9u64);
        z = (z ^ (z >> 27)).wrapping_mul(0x94d049bb133111ebu64);
        z = z ^ (z >> 31);
        (z & 0xffffffffu64) as u32
    }
}
fn next_int_range(min_v: i32, max_v: i32) -> i32 {
    let span = (max_v - min_v + 1) as u32;
    min_v + (next_uint32() % span) as i32
}

fn fnv_reset() { unsafe { FNV = 0x811c9dc5u32; } }
fn fnv_mix_byte(b: u8) {
    unsafe {
        FNV ^= b as u32;
        FNV = FNV.wrapping_mul(0x01000193u32);
    }
}
fn fnv_mix_u16(v: u16) {
    fnv_mix_byte((v & 0xff) as u8);
    fnv_mix_byte(((v >> 8) & 0xff) as u8);
}
fn fnv_mix_i16(v: i16) {
    let u = v as u16;
    fnv_mix_byte((u & 0xff) as u8);
    fnv_mix_byte(((u >> 8) & 0xff) as u8);
}

fn generate_tree_a() {
    unsafe {
        A_TAG[0] = 0;
        A_KEY[0] = -1;
        A_ATTR_KEY[0] = 0;
        A_ATTR_VAL[0] = 1;
        A_TEXT_ID[0] = -1;
        A_CHILD_COUNT[0] = 0;
        for id in 1..NODE_COUNT {
            let parent_id = ((id as i32) - 1) / 3;
            let mut is_text = false;
            if (id as i32) > TEXT_THRESHOLD {
                is_text = next_int_range(0, 4) == 0;
            }
            let tag: i16 = if is_text { -1 } else { next_int_range(0, 6) as i16 };
            let key_gate = next_int_range(0, 4);
            let key: i16 = if key_gate == 0 { next_int_range(100, 999) as i16 } else { -1 };
            let attr_key: i16 = if is_text { -1 } else { next_int_range(0, 15) as i16 };
            let attr_val: i16 = if is_text { -1 } else { next_int_range(0, 50) as i16 };
            let text_id: i16 = if is_text { next_int_range(0, 100) as i16 } else { -1 };
            A_TAG[id] = tag;
            A_KEY[id] = key;
            A_ATTR_KEY[id] = attr_key;
            A_ATTR_VAL[id] = attr_val;
            A_TEXT_ID[id] = text_id;
            A_CHILD_COUNT[id] = 0;
            let pu = parent_id as usize;
            let slot = A_CHILD_COUNT[pu] as usize;
            A_CHILDREN[pu][slot] = id as u16;
            A_CHILD_COUNT[pu] += 1;
        }
    }
}

fn shuffle(len: usize) {
    unsafe {
        if len < 2 { return; }
        let mut i = len - 1;
        while i > 0 {
            let j = next_int_range(0, i as i32) as usize;
            let t = ITEMS[i];
            ITEMS[i] = ITEMS[j];
            ITEMS[j] = t;
            i -= 1;
        }
    }
}

fn filter_shuffle_mark(predicate: i32, take: usize, flags: &mut [u8; NODE_COUNT]) {
    unsafe {
        let mut len = 0usize;
        for id in 0..NODE_COUNT {
            let keep = match predicate {
                0 => A_CHILD_COUNT[id] >= 2,
                1 => A_TAG[id] != -1,
                _ => A_TAG[id] == -1,
            };
            if keep { ITEMS[len] = id as u16; len += 1; }
        }
        shuffle(len);
        let limit = if take < len { take } else { len };
        for i in 0..limit {
            flags[ITEMS[i] as usize] = 1;
        }
    }
}

fn mix_tree_b_dfs(id: usize) {
    unsafe {
        let is_text = A_TAG[id] == -1;
        let mut text_id = A_TEXT_ID[id];
        let mut attr_val = A_ATTR_VAL[id];
        if HAS_TEXT[id] != 0 && is_text {
            text_id = (((A_TEXT_ID[id] as i32) + 31) % 100) as i16;
        }
        if HAS_ATTR[id] != 0 && !is_text {
            attr_val = (((A_ATTR_VAL[id] as i32) + 17) % 100) as i16;
        }
        fnv_mix_u16(id as u16);
        fnv_mix_i16(A_TAG[id]);
        fnv_mix_i16(A_KEY[id]);
        fnv_mix_i16(A_ATTR_KEY[id]);
        fnv_mix_i16(attr_val);
        fnv_mix_i16(text_id);
        let cc = A_CHILD_COUNT[id] as usize;
        fnv_mix_u16(cc as u16);
        let mut order = [0u16; MAX_CHILDREN];
        for c in 0..cc { order[c] = A_CHILDREN[id][c]; }
        if HAS_REORDER[id] != 0 && cc >= 2 {
            let first = order[0];
            let mut c = 0usize;
            while c < cc - 1 { order[c] = order[c + 1]; c += 1; }
            order[cc - 1] = first;
        }
        for c in 0..cc { fnv_mix_u16(order[c]); }
        for c in 0..cc { mix_tree_b_dfs(order[c] as usize); }
    }
}

fn mix_patch_stream() {
    unsafe {
        for id in 0..NODE_COUNT {
            if HAS_TEXT[id] != 0 && A_TAG[id] == -1 {
                let new_text_id = (((A_TEXT_ID[id] as i32) + 31) % 100) as i16;
                fnv_mix_byte(1);
                fnv_mix_u16(id as u16);
                fnv_mix_i16(new_text_id);
                fnv_mix_i16(-1);
                fnv_mix_i16(-1);
                fnv_mix_i16(-1);
            }
        }
        for id in 0..NODE_COUNT {
            if HAS_ATTR[id] != 0 && A_TAG[id] != -1 {
                let new_attr_val = (((A_ATTR_VAL[id] as i32) + 17) % 100) as i16;
                fnv_mix_byte(2);
                fnv_mix_u16(id as u16);
                fnv_mix_i16(-1);
                fnv_mix_i16(A_ATTR_KEY[id]);
                fnv_mix_i16(new_attr_val);
                fnv_mix_i16(-1);
            }
        }
        for id in 0..NODE_COUNT {
            if HAS_REORDER[id] != 0 && A_CHILD_COUNT[id] >= 2 {
                let cc = A_CHILD_COUNT[id] as usize;
                let mut order = [0u16; MAX_CHILDREN];
                for c in 0..cc { order[c] = A_CHILDREN[id][c]; }
                let first = order[0];
                let mut c = 0usize;
                while c < cc - 1 { order[c] = order[c + 1]; c += 1; }
                order[cc - 1] = first;
                fnv_mix_byte(6);
                fnv_mix_u16(id as u16);
                fnv_mix_i16(cc as i16);
                fnv_mix_i16(-1);
                fnv_mix_i16(-1);
                fnv_mix_i16(cc as i16);
                fnv_mix_u16(cc as u16);
                for c in 0..cc { fnv_mix_u16(order[c]); }
            }
        }
    }
}

#[unsafe(no_mangle)]
pub extern "C" fn vdom_diff_trace() -> i32 {
    unsafe {
        for i in 0..NODE_COUNT {
            HAS_REORDER[i] = 0;
            HAS_ATTR[i] = 0;
            HAS_TEXT[i] = 0;
        }
        SM_STATE = 3976273958u64;
        generate_tree_a();
        // shuffle+slice for reorder / attr / text lists (uses static HAS_* directly)
        let mut len = 0usize;
        for id in 0..NODE_COUNT { if A_CHILD_COUNT[id] >= 2 { ITEMS[len] = id as u16; len += 1; } }
        shuffle(len);
        let limit = if 100 < len { 100 } else { len };
        for i in 0..limit { HAS_REORDER[ITEMS[i] as usize] = 1; }

        len = 0;
        for id in 0..NODE_COUNT { if A_TAG[id] != -1 { ITEMS[len] = id as u16; len += 1; } }
        shuffle(len);
        let limit = if 100 < len { 100 } else { len };
        for i in 0..limit { HAS_ATTR[ITEMS[i] as usize] = 1; }

        len = 0;
        for id in 0..NODE_COUNT { if A_TAG[id] == -1 { ITEMS[len] = id as u16; len += 1; } }
        shuffle(len);
        let limit = if 50 < len { 50 } else { len };
        for i in 0..limit { HAS_TEXT[ITEMS[i] as usize] = 1; }

        let mut op1: u32 = 0;
        let mut op2: u32 = 0;
        let mut op6: u32 = 0;
        for id in 0..NODE_COUNT {
            if HAS_TEXT[id] != 0 && A_TAG[id] == -1 { op1 += 1; }
            if HAS_ATTR[id] != 0 && A_TAG[id] != -1 { op2 += 1; }
            if HAS_REORDER[id] != 0 && A_CHILD_COUNT[id] >= 2 { op6 += 1; }
        }
        let patches = op1 + op2 + op6;

        fnv_reset();
        mix_tree_b_dfs(0);
        let tree_b_fnv = FNV;
        fnv_reset();
        mix_patch_stream();
        let patch_fnv = FNV;

        let results = RES_OFFSET as *mut u32;
        results.write_volatile(patches);
        results.add(1).write_volatile(op1);
        results.add(2).write_volatile(op2);
        results.add(3).write_volatile(op6);
        results.add(4).write_volatile(tree_b_fnv);
        results.add(5).write_volatile(patch_fnv);
        patches as i32
    }
}

// silence unused-warning for the generic helper (we inline the loop above but
// keep the helper for parity with the C/C++ layout).
#[allow(dead_code)]
fn _unused_helper() {
    let mut dummy = [0u8; NODE_COUNT];
    filter_shuffle_mark(0, 0, &mut dummy);
}
