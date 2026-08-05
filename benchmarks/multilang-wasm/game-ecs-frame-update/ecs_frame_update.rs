#![no_std]
#![no_main]

// game-ecs-frame-update multilang kernel — Rust no_std cdylib mirroring the C
// kernel and benchmarks/v1 engine.js runEcsJavaScript EXACTLY: per-frame control
// velocity deltas, movement with wall bounce, 128x128 spatial-grid collision,
// animation speed-class update, FNV-1a (PRIME 0x01000193) canonical state +
// checkpoint digests, full counter set. All integer math wraps u32 exactly as
// C (and Math.imul) does.

use core::panic::PanicInfo;

const MAX_ENTITIES: usize = 10000;
const MAX_FRAMES: u32 = 1000;
const INPUT_CAPACITY: usize = 82000;
const GRID_WIDTH: u32 = 128;
const GRID_CELLS: usize = 16384;
const CELL_SHIFT: u32 = 9;
const CHECKPOINT_INTERVAL: u32 = 100;
const RESULT_STATE_OFFSET: usize = 128;
const RESULT_WORDS: usize = RESULT_STATE_OFFSET + MAX_ENTITIES * 6;
const ECS_MAGIC: u32 = 0x3143_5345;
const PRIME: u32 = 16_777_619;

#[panic_handler]
fn panic(_info: &PanicInfo) -> ! {
    loop {}
}

static mut INPUT_BYTES: [u8; INPUT_CAPACITY] = [0u8; INPUT_CAPACITY];
static mut RESULT_WORDS_BUF: [u32; RESULT_WORDS] = [0u32; RESULT_WORDS];

static mut XS: [u16; MAX_ENTITIES] = [0u16; MAX_ENTITIES];
static mut YS: [u16; MAX_ENTITIES] = [0u16; MAX_ENTITIES];
static mut VXS: [i8; MAX_ENTITIES] = [0i8; MAX_ENTITIES];
static mut VYS: [i8; MAX_ENTITIES] = [0i8; MAX_ENTITIES];
static mut ANIMS: [u8; MAX_ENTITIES] = [0u8; MAX_ENTITIES];
static mut RADII: [u8; MAX_ENTITIES] = [0u8; MAX_ENTITIES];
static mut HEADS: [i32; GRID_CELLS] = [-1i32; GRID_CELLS];
static mut NEXT: [i32; MAX_ENTITIES] = [-1i32; MAX_ENTITIES];

static mut PAIR_TESTS: u32 = 0;
static mut COLLISIONS: u32 = 0;
static mut STATE_MUTATIONS: u32 = 0;

#[inline(always)]
fn mix(hash: u32, value: u32) -> u32 {
    (hash ^ value).wrapping_mul(PRIME)
}

#[inline(always)]
fn clamp_velocity(value: i32) -> i8 {
    if value < -16 {
        -16
    } else if value > 16 {
        16
    } else {
        value as i8
    }
}

#[inline(always)]
fn control_delta(bits: u32) -> i32 {
    if bits == 3 {
        0
    } else {
        bits as i32 - 1
    }
}

unsafe fn read32(at: usize) -> u32 {
    u32::from_le_bytes([
        INPUT_BYTES[at],
        INPUT_BYTES[at + 1],
        INPUT_BYTES[at + 2],
        INPUT_BYTES[at + 3],
    ])
}

unsafe fn canonical_state(entities: usize, write_state: bool) -> u32 {
    let mut digest: u32 = 0x7f4a_7c15;
    for entity in 0..entities {
        let values = [
            XS[entity] as u32,
            YS[entity] as u32,
            VXS[entity] as u8 as u32,
            VYS[entity] as u8 as u32,
            ANIMS[entity] as u32,
            RADII[entity] as u32,
        ];
        digest = mix(digest, entity as u32);
        for item in 0..6usize {
            digest = mix(digest, values[item]);
            if write_state {
                RESULT_WORDS_BUF[RESULT_STATE_OFFSET + entity * 6 + item] = values[item];
            }
        }
    }
    digest
}

unsafe fn process_pair(left: u32, right: u32) {
    PAIR_TESTS += 1;
    let reach = RADII[left as usize] as i32 + RADII[right as usize] as i32;
    let dx = XS[left as usize] as i32 - XS[right as usize] as i32;
    let dy = YS[left as usize] as i32 - YS[right as usize] as i32;
    if dx < -reach || dx > reach || dy < -reach || dy > reach {
        return;
    }
    let left_vx = VXS[left as usize];
    let left_vy = VYS[left as usize];
    VXS[left as usize] = VXS[right as usize];
    VYS[left as usize] = VYS[right as usize];
    VXS[right as usize] = left_vx;
    VYS[right as usize] = left_vy;
    COLLISIONS += 1;
    STATE_MUTATIONS += 4;
}

unsafe fn process_cross_cells(left_cell: usize, right_cell: usize) {
    let mut left = HEADS[left_cell];
    while left >= 0 {
        let mut right = HEADS[right_cell];
        while right >= 0 {
            process_pair(left as u32, right as u32);
            right = NEXT[right as usize];
        }
        left = NEXT[left as usize];
    }
}

#[no_mangle]
pub extern "C" fn input_ptr() -> u32 {
    unsafe { INPUT_BYTES.as_ptr() as u32 }
}

#[no_mangle]
pub extern "C" fn result_ptr() -> u32 {
    unsafe { RESULT_WORDS_BUF.as_ptr() as u32 }
}

#[no_mangle]
pub extern "C" fn run(length: u32) -> i32 {
    unsafe {
        let len = length as usize;
        if len < 16 || len > INPUT_CAPACITY || read32(0) != ECS_MAGIC {
            return 1;
        }
        let entities = read32(4) as usize;
        let frames = read32(8);
        if entities < 2 || entities > MAX_ENTITIES || frames < 1 || frames > MAX_FRAMES {
            return 2;
        }
        if len != 16 + entities * 8 + frames as usize {
            return 3;
        }
        RESULT_WORDS_BUF.iter_mut().for_each(|w| *w = 0);
        let mut offset = 16usize;
        for entity in 0..entities {
            XS[entity] = u16::from_le_bytes([INPUT_BYTES[offset], INPUT_BYTES[offset + 1]]);
            YS[entity] = u16::from_le_bytes([INPUT_BYTES[offset + 2], INPUT_BYTES[offset + 3]]);
            VXS[entity] = INPUT_BYTES[offset + 4] as i8;
            VYS[entity] = INPUT_BYTES[offset + 5] as i8;
            ANIMS[entity] = INPUT_BYTES[offset + 6];
            RADII[entity] = INPUT_BYTES[offset + 7];
            offset += 8;
        }
        let trace_offset = 16usize + entities * 8;
        let mut movement_updates: u32 = 0;
        let mut control_mutations: u32 = 0;
        let mut animation_updates: u32 = 0;
        let mut checkpoint_count: u32 = 0;
        let mut checkpoint_digest: u32 = 0x5f35_6495;
        PAIR_TESTS = 0;
        COLLISIONS = 0;
        STATE_MUTATIONS = 0;
        for frame in 0..frames {
            let control = INPUT_BYTES[trace_offset + frame as usize] as u32;
            let selected_remainder = frame % 257;
            let control_x = control_delta(control & 3);
            let control_y = control_delta((control >> 2) & 3);
            for entity in 0..entities {
                if (entity as u32) % 257 == selected_remainder {
                    VXS[entity] = clamp_velocity(VXS[entity] as i32 + control_x);
                    VYS[entity] = clamp_velocity(VYS[entity] as i32 + control_y);
                    control_mutations += 2;
                    STATE_MUTATIONS += 2;
                }
                let mut x = XS[entity] as i32 + VXS[entity] as i32;
                let mut y = YS[entity] as i32 + VYS[entity] as i32;
                if x < 0 {
                    x = -x;
                    VXS[entity] = -VXS[entity];
                    STATE_MUTATIONS += 1;
                } else if x > 65535 {
                    x = 131070 - x;
                    VXS[entity] = -VXS[entity];
                    STATE_MUTATIONS += 1;
                }
                if y < 0 {
                    y = -y;
                    VYS[entity] = -VYS[entity];
                    STATE_MUTATIONS += 1;
                } else if y > 65535 {
                    y = 131070 - y;
                    VYS[entity] = -VYS[entity];
                    STATE_MUTATIONS += 1;
                }
                XS[entity] = x as u16;
                YS[entity] = y as u16;
                movement_updates += 1;
                STATE_MUTATIONS += 2;
            }
            HEADS.iter_mut().for_each(|h| *h = -1);
            for entity in 0..entities {
                let cell = ((YS[entity] as u32) >> CELL_SHIFT) * GRID_WIDTH
                    + ((XS[entity] as u32) >> CELL_SHIFT);
                NEXT[entity] = HEADS[cell as usize];
                HEADS[cell as usize] = entity as i32;
            }
            for cell_y in 0..GRID_WIDTH {
                for cell_x in 0..GRID_WIDTH {
                    let cell = (cell_y * GRID_WIDTH + cell_x) as usize;
                    let mut left = HEADS[cell];
                    while left >= 0 {
                        let mut right = NEXT[left as usize];
                        while right >= 0 {
                            process_pair(left as u32, right as u32);
                            right = NEXT[right as usize];
                        }
                        left = NEXT[left as usize];
                    }
                    if cell_x + 1 < GRID_WIDTH {
                        process_cross_cells(cell, cell + 1);
                    }
                    if cell_y + 1 < GRID_WIDTH && cell_x > 0 {
                        process_cross_cells(cell, cell + GRID_WIDTH as usize - 1);
                    }
                    if cell_y + 1 < GRID_WIDTH {
                        process_cross_cells(cell, cell + GRID_WIDTH as usize);
                    }
                    if cell_y + 1 < GRID_WIDTH && cell_x + 1 < GRID_WIDTH {
                        process_cross_cells(cell, cell + GRID_WIDTH as usize + 1);
                    }
                }
            }
            let control_animation = (control >> 4) & 1;
            for entity in 0..entities {
                let speed_class = (VXS[entity].unsigned_abs() as u32 + VYS[entity].unsigned_abs() as u32) & 3;
                ANIMS[entity] = (ANIMS[entity] as u32 + 1 + speed_class + control_animation) as u8;
                animation_updates += 1;
                STATE_MUTATIONS += 1;
            }
            if (frame + 1) % CHECKPOINT_INTERVAL == 0 || frame + 1 == frames {
                let state_digest = canonical_state(entities, false);
                let at = 64usize + checkpoint_count as usize * 3;
                RESULT_WORDS_BUF[at] = frame + 1;
                RESULT_WORDS_BUF[at + 1] = state_digest;
                RESULT_WORDS_BUF[at + 2] = PAIR_TESTS;
                RESULT_WORDS_BUF[29 + checkpoint_count as usize] = COLLISIONS;
                checkpoint_digest = mix(checkpoint_digest, frame + 1);
                checkpoint_digest = mix(checkpoint_digest, state_digest);
                checkpoint_digest = mix(checkpoint_digest, PAIR_TESTS);
                checkpoint_count += 1;
            }
        }
        RESULT_WORDS_BUF[0] = canonical_state(entities, true);
        RESULT_WORDS_BUF[1] = checkpoint_digest;
        RESULT_WORDS_BUF[16] = frames;
        RESULT_WORDS_BUF[17] = entities as u32;
        RESULT_WORDS_BUF[18] = frames * 3;
        RESULT_WORDS_BUF[19] = movement_updates;
        RESULT_WORDS_BUF[20] = frames * GRID_CELLS as u32;
        RESULT_WORDS_BUF[21] = frames * (GRID_CELLS as u32) * 5;
        RESULT_WORDS_BUF[22] = frames * entities as u32;
        RESULT_WORDS_BUF[23] = PAIR_TESTS;
        RESULT_WORDS_BUF[24] = COLLISIONS;
        RESULT_WORDS_BUF[25] = animation_updates;
        RESULT_WORDS_BUF[26] = checkpoint_count;
        RESULT_WORDS_BUF[27] = control_mutations;
        RESULT_WORDS_BUF[28] = STATE_MUTATIONS;
        0
    }
}
