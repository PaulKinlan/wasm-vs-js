// tactics_kernel.rs — multilang compute core for game.dom-tactics-grid.v1.
// Same ABI as tactics_kernel.c: the adapter writes the frozen 7,064-byte
// fixture at FIXTURE_OFFSET and passes the byte length; this kernel runs the
// 60-turn / 240-action loop bit-identical to run_tactics() in
// benchmarks/v2/game-family/game-family.c and tactics() in engine.js, then
// writes counters + digests to RES_OFFSET (via raw pointer).
#![no_std]
#![no_main]
use core::panic::PanicInfo;

#[panic_handler]
fn panic(_info: &PanicInfo) -> ! { loop {} }

// FIXTURE and RES offsets sit past every language's .bss window:
// C/C++ .bss ends well before 1 MiB, Rust's __data_end lands near 2.9 MiB,
// and AS's fixed offsets occupy < 1 MiB. 3 MiB is safely past all three.
const FIXTURE_OFFSET: usize = 3145728;   // 3 MiB
const RES_OFFSET: usize = 3276800;       // 3 MiB + 128 KiB

// Tactics working set (placed in .bss by rustc/lld).
static mut BFS_QUEUE: [u16; 4096] = [0; 4096];
static mut BFS_SEEN: [u16; 4096] = [0; 4096];
static mut BFS_PARENT: [i16; 4096] = [0; 4096];
static mut OCCUPANCY: [i16; 4096] = [0; 4096];
static mut UNIT_HP: [u8; 128] = [0; 128];
static mut UNIT_TEAM: [u8; 128] = [0; 128];
static mut UNIT_POSITION: [u16; 128] = [0; 128];

static mut TACTICS_STAMP: u16 = 0;
static mut TACTICS_STATE: u32 = 0;
static mut TACTICS_EXPANDED: u32 = 0;
static mut TACTICS_LOS: u32 = 0;

fn fixture_at(off: u32) -> u8 {
    unsafe { *((FIXTURE_OFFSET as *const u8).add(off as usize)) }
}
fn read16(at: u32) -> u32 {
    (fixture_at(at) as u32) | ((fixture_at(at + 1) as u32) << 8)
}
fn read32(at: u32) -> u32 { read16(at) | (read16(at + 2) << 16) }
fn mix(h: u32, v: u32) -> u32 { (h ^ v).wrapping_mul(16777619u32) }
fn absolute(v: i32) -> u32 { if v < 0 { (-v) as u32 } else { v as u32 } }

fn tactics_path(start: u32, goal: u32, map_offset: u32) -> bool {
    unsafe {
        TACTICS_STAMP = TACTICS_STAMP.wrapping_add(1);
        let stamp = TACTICS_STAMP;
        let mut head: u32 = 0;
        let mut tail: u32 = 1;
        BFS_QUEUE[0] = start as u16;
        BFS_SEEN[start as usize] = stamp;
        BFS_PARENT[start as usize] = -1;
        while head < tail {
            let node = BFS_QUEUE[head as usize] as u32;
            head += 1;
            TACTICS_EXPANDED += 1;
            if node == goal { break; }
            let x = node & 63;
            let y = node >> 6;
            let candidates: [i32; 4] = [
                if y > 0 { node as i32 - 64 } else { -1 },
                if x > 0 { node as i32 - 1 } else { -1 },
                if x < 63 { node as i32 + 1 } else { -1 },
                if y < 63 { node as i32 + 64 } else { -1 },
            ];
            for i in 0..4 {
                let signed_next = candidates[i];
                if signed_next < 0 { continue; }
                let next = signed_next as u32;
                if BFS_SEEN[next as usize] == stamp
                    || fixture_at(map_offset + next) == 3
                    || (OCCUPANCY[next as usize] >= 0 && next != goal)
                {
                    continue;
                }
                BFS_SEEN[next as usize] = stamp;
                BFS_PARENT[next as usize] = node as i16;
                BFS_QUEUE[tail as usize] = next as u16;
                tail += 1;
            }
        }
        if BFS_SEEN[goal as usize] != stamp { return false; }
        let mut node: i32 = goal as i32;
        while node >= 0 {
            TACTICS_STATE = mix(TACTICS_STATE, node as u32);
            node = BFS_PARENT[node as usize] as i32;
        }
        true
    }
}

fn tactics_los_visible(start: u32, goal: u32, map_offset: u32) -> bool {
    let mut x0: i32 = (start & 63) as i32;
    let mut y0: i32 = (start >> 6) as i32;
    let x1: i32 = (goal & 63) as i32;
    let y1: i32 = (goal >> 6) as i32;
    let dx: i32 = absolute(x1 - x0) as i32;
    let sx: i32 = if x0 < x1 { 1 } else { -1 };
    let dy: i32 = -(absolute(y1 - y0) as i32);
    let sy: i32 = if y0 < y1 { 1 } else { -1 };
    let mut error: i32 = dx + dy;
    loop {
        unsafe { TACTICS_LOS += 1; }
        let node = (x0 + y0 * 64) as u32;
        if node != start && node != goal && fixture_at(map_offset + node) == 3 {
            return false;
        }
        if x0 == x1 && y0 == y1 { return true; }
        let twice = 2 * error;
        if twice >= dy { error += dy; x0 += sx; }
        if twice <= dx { error += dx; y0 += sy; }
    }
}

#[unsafe(no_mangle)]
pub extern "C" fn tactics_trace(fixture_len: u32) -> i32 {
    if fixture_len != 7064 { return 1; }
    if read32(0) != 64 || read32(8) != 128 { return 2; }

    unsafe {
        for cell in 0..4096 {
            BFS_SEEN[cell] = 0;
            OCCUPANCY[cell] = -1;
        }
    }

    let map_offset: u32 = 24;
    let unit_offset: u32 = map_offset + 4096;
    let action_offset: u32 = unit_offset + 128 * 8;

    unsafe {
        for unit in 0u32..128 {
            let at = unit_offset + unit * 8;
            UNIT_POSITION[unit as usize] = (read16(at) + read16(at + 2) * 64) as u16;
            UNIT_HP[unit as usize] = fixture_at(at + 4);
            UNIT_TEAM[unit as usize] = fixture_at(at + 5) & 1;
            let pos = UNIT_POSITION[unit as usize] as usize;
            if OCCUPANCY[pos] < 0 { OCCUPANCY[pos] = unit as i16; }
        }

        TACTICS_STAMP = 0;
        TACTICS_STATE = 0x5d7219af;
        TACTICS_EXPANDED = 0;
        TACTICS_LOS = 0;
    }
    let mut turns: u32 = 0;
    let mut updates: u32 = 0;
    let mut mutations: u32 = 0;
    let mut selected: u32 = unsafe { UNIT_POSITION[0] } as u32;
    let mut focused: u32 = selected;
    let mut initiative: u32 = 0;

    let mut final_unit_digest: u32 = 0;
    let mut final_occupancy_digest: u32 = 0;
    let mut final_initiative_digest: u32 = 0;
    let mut final_objective_digest: u32 = 0;
    let mut final_dom_digest: u32 = 0;
    let mut final_focus_digest: u32 = 0;
    let mut final_accessibility_digest: u32 = 0;

    for action in 0u32..240 {
        let at = action_offset + action * 8;
        let ty = fixture_at(at) as u32;
        let unit = fixture_at(at + 1) as u32;
        let from = read16(at + 2);
        let target = read16(at + 4);
        let turn_id = read16(at + 6);

        if action % 4 == 0 {
            turns += 1;
            initiative = (turn_id * 7) & 127;
            mutations += 1;
        }
        if ty == 0 {
            selected = unsafe { UNIT_POSITION[unit as usize] } as u32;
            focused = selected;
            updates += 1;
            mutations += 2;
        }
        if ty == 1 {
            let pos = unsafe { UNIT_POSITION[unit as usize] } as u32;
            let path_ok = tactics_path(pos, target, map_offset);
            let occ_target = unsafe { OCCUPANCY[target as usize] };
            if path_ok && (occ_target < 0 || occ_target == unit as i16) {
                unsafe {
                    let old = UNIT_POSITION[unit as usize] as usize;
                    if OCCUPANCY[old] == unit as i16 { OCCUPANCY[old] = -1; }
                    UNIT_POSITION[unit as usize] = target as u16;
                    OCCUPANCY[target as usize] = unit as i16;
                }
                selected = target;
                focused = target;
                updates += 1;
                mutations += 3;
            }
        }
        if (ty == 2 || ty == 4) && tactics_los_visible(from, target, map_offset) {
            let target_unit = unsafe { OCCUPANCY[target as usize] } as i32;
            if target_unit >= 0 {
                let damage: u32 = if ty == 4 { 3 } else { 1 };
                unsafe {
                    let hp = UNIT_HP[target_unit as usize] as u32;
                    UNIT_HP[target_unit as usize] = if hp > damage { (hp - damage) as u8 } else { 0 };
                }
                updates += 1;
                mutations += 1;
            }
        }
        if ty == 3 {
            initiative = (initiative + 1) & 127;
            mutations += 1;
        }

        let hp_unit = unsafe { UNIT_HP[unit as usize] } as u32;
        let pos_unit = unsafe { UNIT_POSITION[unit as usize] } as u32;
        unsafe {
            TACTICS_STATE = mix(
                TACTICS_STATE,
                ty ^ unit ^ hp_unit ^ pos_unit ^ selected ^ turn_id,
            );
        }

        if (action + 1) % 4 == 0 {
            let mut unit_digest: u32 = 0x9216d5d9;
            let mut occupancy_digest: u32 = 0x8979fb1b;
            let mut initiative_digest: u32 = mix(0xd1310ba6, initiative);
            let mut objective_digest: u32 = 0x98dfb5ac;
            let mut dom_digest: u32 = 0x2ffd72db;
            let focus_digest: u32 = mix(0xd01adfb7, focused);
            let mut accessibility_digest: u32 = 0xb8e1afed;
            let mut objectives0: u32 = 0;
            let mut objectives1: u32 = 0;

            for i in 0u32..128 {
                unsafe {
                    unit_digest = mix(
                        mix(mix(unit_digest, i), UNIT_POSITION[i as usize] as u32),
                        UNIT_HP[i as usize] as u32 ^ ((UNIT_TEAM[i as usize] as u32) << 8),
                    );
                    initiative_digest = mix(initiative_digest, (i + initiative) & 127);
                    if fixture_at(map_offset + UNIT_POSITION[i as usize] as u32) == 2
                        && UNIT_HP[i as usize] > 0
                    {
                        if UNIT_TEAM[i as usize] != 0 { objectives1 += 1; } else { objectives0 += 1; }
                    }
                }
            }
            objective_digest = mix(mix(objective_digest, objectives0), objectives1);
            for cell in 0u32..4096 {
                let occupant: i32 = unsafe { OCCUPANCY[cell as usize] } as i32;
                let is_selected: u32 = if cell == selected { 1 } else { 0 };
                let is_focused: u32 = if cell == focused { 1 } else { 0 };
                occupancy_digest = mix(
                    occupancy_digest,
                    if occupant < 0 { 0xffffffff } else { occupant as u32 },
                );
                dom_digest = mix(
                    mix(mix(dom_digest, cell), fixture_at(map_offset + cell) as u32),
                    ((occupant + 1) as u32) ^ (is_selected << 16) ^ (is_focused << 17),
                );
                let unit_state: u32 = if occupant < 0 {
                    0
                } else {
                    unsafe {
                        UNIT_HP[occupant as usize] as u32
                            ^ ((UNIT_TEAM[occupant as usize] as u32) << 8)
                    }
                };
                accessibility_digest = mix(
                    mix(accessibility_digest, 0x67726964),
                    is_selected ^ (is_focused << 1) ^ (unit_state << 2),
                );
            }

            unsafe {
                TACTICS_STATE = mix(TACTICS_STATE, unit_digest);
                TACTICS_STATE = mix(TACTICS_STATE, occupancy_digest);
                TACTICS_STATE = mix(TACTICS_STATE, initiative_digest);
                TACTICS_STATE = mix(TACTICS_STATE, objective_digest);
                TACTICS_STATE = mix(TACTICS_STATE, dom_digest);
                TACTICS_STATE = mix(TACTICS_STATE, focus_digest);
                TACTICS_STATE = mix(TACTICS_STATE, accessibility_digest);
            }
            mutations += 2;

            final_unit_digest = unit_digest;
            final_occupancy_digest = occupancy_digest;
            final_initiative_digest = initiative_digest;
            final_objective_digest = objective_digest;
            final_dom_digest = dom_digest;
            final_focus_digest = focus_digest;
            final_accessibility_digest = accessibility_digest;
        }
    }

    unsafe {
        let results = RES_OFFSET as *mut u32;
        results.write_volatile(TACTICS_STATE);
        results.add(1).write_volatile(final_unit_digest);
        results.add(2).write_volatile(final_occupancy_digest);
        results.add(3).write_volatile(final_initiative_digest);
        results.add(4).write_volatile(final_objective_digest);
        results.add(5).write_volatile(final_dom_digest);
        results.add(6).write_volatile(final_focus_digest);
        results.add(7).write_volatile(final_accessibility_digest);
        results.add(8).write_volatile(turns);
        results.add(9).write_volatile(TACTICS_EXPANDED);
        results.add(10).write_volatile(TACTICS_LOS);
        results.add(11).write_volatile(updates);
        results.add(12).write_volatile(mutations);
    }
    0
}
