// pathfinding_kernel.rs — multilang compute core for
// game.canvas-entity-pathfinding.v1. Same ABI as pathfinding_kernel.c: the
// adapter writes the frozen 106,552-byte fixture at FIXTURE_OFFSET and passes
// the byte length; this kernel runs 128 A* requests + 1,800-frame ECS loop
// bit-identical to run_pathfinding() in benchmarks/v2/game-family/
// game-family.c and pathfinding() in engine.js, then writes counters + digests
// to RES_OFFSET (via raw pointer).
#![no_std]
#![no_main]
use core::panic::PanicInfo;

#[panic_handler]
fn panic(_info: &PanicInfo) -> ! { loop {} }

// FIXTURE and RES offsets sit past every language's .bss window:
// C/C++ .bss ends around 1.9 MiB, Rust's __data_end lands near 2.9 MiB, and
// AS's fixed-offset arrays occupy < 1.9 MiB. 3 MiB is safely past all three.
const FIXTURE_OFFSET: usize = 3145728;   // 3 MiB
const RES_OFFSET: usize = 3276800;       // 3 MiB + 128 KiB
const HEAP_CAPACITY: usize = 131072;

// A* + heap + entity working set (placed in .bss by rustc/lld).
static mut ASTAR_G: [i32; 65536] = [0; 65536];
static mut ASTAR_PARENT: [i32; 65536] = [0; 65536];
static mut ASTAR_SEEN: [u16; 65536] = [0; 65536];
static mut ASTAR_CLOSED: [u16; 65536] = [0; 65536];
static mut HEAP_NODE: [u32; HEAP_CAPACITY] = [0; HEAP_CAPACITY];
static mut HEAP_F: [u32; HEAP_CAPACITY] = [0; HEAP_CAPACITY];
static mut HEAP_LENGTH: u32 = 0;
static mut ENTITY_X: [u16; 4096] = [0; 4096];
static mut ENTITY_Y: [u16; 4096] = [0; 4096];
static mut ENTITY_VX: [i8; 4096] = [0; 4096];
static mut ENTITY_VY: [i8; 4096] = [0; 4096];

fn fixture_at(off: u32) -> u8 {
    unsafe { *((FIXTURE_OFFSET as *const u8).add(off as usize)) }
}
fn read16(at: u32) -> u32 {
    (fixture_at(at) as u32) | ((fixture_at(at + 1) as u32) << 8)
}
fn read32(at: u32) -> u32 { read16(at) | (read16(at + 2) << 16) }
fn mix(h: u32, v: u32) -> u32 { (h ^ v).wrapping_mul(16777619u32) }
fn absolute(v: i32) -> u32 { if v < 0 { (-v) as u32 } else { v as u32 } }

fn heap_less(af: u32, an: u32, bf: u32, bn: u32) -> bool {
    if af != bf { af < bf } else { an < bn }
}
fn heap_push(node: u32, f: u32, operations: &mut u32) -> bool {
    unsafe {
        if HEAP_LENGTH as usize >= HEAP_CAPACITY { return false; }
        *operations += 1;
        let mut index = HEAP_LENGTH as usize;
        HEAP_LENGTH += 1;
        while index > 0 {
            let up = (index - 1) >> 1;
            if !heap_less(f, node, HEAP_F[up], HEAP_NODE[up]) { break; }
            HEAP_F[index] = HEAP_F[up];
            HEAP_NODE[index] = HEAP_NODE[up];
            index = up;
        }
        HEAP_F[index] = f;
        HEAP_NODE[index] = node;
        true
    }
}
fn heap_pop(f_out: &mut u32, operations: &mut u32) -> u32 {
    unsafe {
        *operations += 1;
        let first_node = HEAP_NODE[0];
        *f_out = HEAP_F[0];
        HEAP_LENGTH -= 1;
        let last_index = HEAP_LENGTH as usize;
        if HEAP_LENGTH > 0 {
            let last_node = HEAP_NODE[last_index];
            let last_f = HEAP_F[last_index];
            let mut index = 0usize;
            loop {
                let left = index * 2 + 1;
                if left >= HEAP_LENGTH as usize { break; }
                let right = left + 1;
                let mut child = left;
                if right < HEAP_LENGTH as usize &&
                    heap_less(HEAP_F[right], HEAP_NODE[right], HEAP_F[left], HEAP_NODE[left]) {
                    child = right;
                }
                if !heap_less(HEAP_F[child], HEAP_NODE[child], last_f, last_node) { break; }
                HEAP_F[index] = HEAP_F[child];
                HEAP_NODE[index] = HEAP_NODE[child];
                index = child;
            }
            HEAP_F[index] = last_f;
            HEAP_NODE[index] = last_node;
        }
        first_node
    }
}

#[unsafe(no_mangle)]
pub extern "C" fn pathfinding_trace(fixture_len: u32) -> i32 {
    if fixture_len != 106552 { return 1; }
    if read32(0) != 256 || read32(8) != 4096 { return 2; }

    unsafe {
        for node in 0..65536 {
            ASTAR_SEEN[node] = 0;
            ASTAR_CLOSED[node] = 0;
        }
    }

    let map_offset: u32 = 24;
    let entity_offset: u32 = map_offset + 65536;
    let path_offset: u32 = entity_offset + 4096 * 8;
    let control_offset: u32 = path_offset + 128 * 8;

    let mut stamp: u16 = 0;
    let mut state: u32 = 0xa1427b39;
    let mut path_digest: u32 = 0x13198a2e;
    let mut tie_digest: u32 = 0x03707344;
    let mut expanded: u32 = 0;
    let mut frontier_operations: u32 = 0;
    let mut system_updates: u32 = 0;
    let mut draw_commands: u32 = 0;
    let mut audio_events: u32 = 0;

    for request in 0u32..128 {
        stamp = stamp.wrapping_add(1);
        unsafe { HEAP_LENGTH = 0; }
        let start = read16(path_offset + request * 8) +
            read16(path_offset + request * 8 + 2) * 256;
        let goal = read16(path_offset + request * 8 + 4) +
            read16(path_offset + request * 8 + 6) * 256;
        let gx = goal & 255;
        let gy = goal >> 8;
        unsafe {
            ASTAR_SEEN[start as usize] = stamp;
            ASTAR_G[start as usize] = 0;
            ASTAR_PARENT[start as usize] = -1;
        }
        let heuristic = absolute((start & 255) as i32 - gx as i32) +
            absolute((start >> 8) as i32 - gy as i32);
        if !heap_push(start, heuristic, &mut frontier_operations) { return 3; }
        let mut request_tie: u32 = 0x85a308d3;
        loop {
            if unsafe { HEAP_LENGTH } == 0 { break; }
            let mut f: u32 = 0;
            let node = heap_pop(&mut f, &mut frontier_operations);
            if unsafe { ASTAR_CLOSED[node as usize] } == stamp { continue; }
            request_tie = mix(mix(request_tie, f), node);
            unsafe { ASTAR_CLOSED[node as usize] = stamp; }
            expanded += 1;
            let g_node = unsafe { ASTAR_G[node as usize] } as u32;
            state = mix(state, node ^ (request << 16) ^ g_node);
            if node == goal { break; }
            let x = node & 255;
            let y = node >> 8;
            let candidates: [i32; 4] = [
                if y > 0 { node as i32 - 256 } else { -1 },
                if x > 0 { node as i32 - 1 } else { -1 },
                if x < 255 { node as i32 + 1 } else { -1 },
                if y < 255 { node as i32 + 256 } else { -1 },
            ];
            for i in 0..4 {
                let signed_next = candidates[i];
                if signed_next < 0 { continue; }
                let next = signed_next as u32;
                if fixture_at(map_offset + next) != 0 ||
                    unsafe { ASTAR_CLOSED[next as usize] } == stamp {
                    continue;
                }
                let cost = unsafe { ASTAR_G[node as usize] } + 1;
                let seen_val = unsafe { ASTAR_SEEN[next as usize] };
                let existing = unsafe { ASTAR_G[next as usize] };
                if seen_val != stamp || cost < existing {
                    unsafe {
                        ASTAR_SEEN[next as usize] = stamp;
                        ASTAR_G[next as usize] = cost;
                        ASTAR_PARENT[next as usize] = node as i32;
                    }
                    let estimate = cost as u32 +
                        absolute((next & 255) as i32 - gx as i32) +
                        absolute((next >> 8) as i32 - gy as i32);
                    if !heap_push(next, estimate, &mut frontier_operations) { return 3; }
                }
            }
        }
        let mut request_path: u32 = 0xa4093822;
        if unsafe { ASTAR_CLOSED[goal as usize] } == stamp {
            let mut node = goal as i32;
            while node >= 0 {
                request_path = mix(request_path, node as u32);
                node = unsafe { ASTAR_PARENT[node as usize] };
            }
        } else {
            request_path = mix(request_path, 0xffffffff);
        }
        path_digest = mix(mix(path_digest, request), request_path);
        tie_digest = mix(mix(tie_digest, request), request_tie);
    }

    for entity in 0u32..4096 {
        let at = entity_offset + entity * 8;
        unsafe {
            ENTITY_X[entity as usize] = read16(at) as u16;
            ENTITY_Y[entity as usize] = read16(at + 2) as u16;
            ENTITY_VX[entity as usize] = (read16(at + 4) as i32 - 3) as i8;
            ENTITY_VY[entity as usize] = (read16(at + 6) as i32 - 3) as i8;
        }
    }

    let mut ecs: u32 = 0x299f31d0;
    let mut animation: u32 = 0x082efa98;
    let mut draw: u32 = 0xec4e6c89;
    let mut audio: u32 = 0x452821e6;

    for frame in 0u32..1800 {
        let control = read32(control_offset + frame * 4);
        for entity in 0u32..4096 {
            let ex = unsafe { ENTITY_X[entity as usize] } as i32;
            let ey = unsafe { ENTITY_Y[entity as usize] } as i32;
            let vx = unsafe { ENTITY_VX[entity as usize] } as i32;
            let vy = unsafe { ENTITY_VY[entity as usize] } as i32;
            let nx = ((ex + vx + (control & 1) as i32 + 256) & 255) as u16;
            let ny = ((ey + vy + ((control >> 1) & 1) as i32 + 256) & 255) as u16;
            unsafe {
                ENTITY_X[entity as usize] = nx;
                ENTITY_Y[entity as usize] = ny;
            }
            let packed = (nx as u32) ^ ((ny as u32) << 8) ^ entity ^ control;
            ecs = mix(ecs, packed);
            state = mix(state, packed);
            system_updates += 1;
            animation = mix(animation, entity ^ (frame << 12) ^ ((control >> 16) & 15));
            draw = mix(mix(mix(draw, entity), nx as u32), ny as u32);
            draw_commands += 1;
        }
        if (control & 1023) == 0 {
            audio = mix(mix(audio, frame), control);
            audio_events += 1;
        }
    }

    let mut semantic = state;
    semantic = mix(semantic, path_digest);
    semantic = mix(semantic, tie_digest);
    semantic = mix(semantic, ecs);
    semantic = mix(semantic, animation);
    semantic = mix(semantic, draw);
    semantic = mix(semantic, audio);

    unsafe {
        let results = RES_OFFSET as *mut u32;
        results.write_volatile(semantic);
        results.add(1).write_volatile(path_digest);
        results.add(2).write_volatile(tie_digest);
        results.add(3).write_volatile(ecs);
        results.add(4).write_volatile(animation);
        results.add(5).write_volatile(draw);
        results.add(6).write_volatile(audio);
        results.add(7).write_volatile(system_updates);
        results.add(8).write_volatile(expanded);
        results.add(9).write_volatile(frontier_operations);
        results.add(10).write_volatile(draw_commands);
        results.add(11).write_volatile(audio_events);
    }
    0
}
