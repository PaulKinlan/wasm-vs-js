// arcade_kernel.rs — multilang compute core for game.canvas-arcade.v1.
// Same ABI as arcade_kernel.c: the adapter writes the frozen 14,424-byte
// arcade fixture at FIXTURE_OFFSET and passes the byte length; this kernel
// replays the 3,600-frame arcade engine (bit-identical to run_arcade() in
// benchmarks/v2/game-family/game-family.c and arcade() in engine.js) and
// writes counters + digests to RES_OFFSET (via raw pointer).
#![no_std]
#![no_main]
use core::panic::PanicInfo;

#[panic_handler]
fn panic(_info: &PanicInfo) -> ! { loop {} }

const FIXTURE_OFFSET: usize = 65536;
const RES_OFFSET: usize = 131072;

fn fixture_at(off: u32) -> u8 {
    unsafe { *((FIXTURE_OFFSET as *const u8).add(off as usize)) }
}
fn read16(at: u32) -> u32 {
    (fixture_at(at) as u32) | ((fixture_at(at + 1) as u32) << 8)
}
fn read32(at: u32) -> u32 { read16(at) | (read16(at + 2) << 16) }
fn mix(h: u32, v: u32) -> u32 { (h ^ v).wrapping_mul(16777619u32) }

#[unsafe(no_mangle)]
pub extern "C" fn arcade_trace(fixture_len: u32) -> i32 {
    if fixture_len != 14424 { return 1; }
    if read32(0) != 3600 { return 2; }

    let mut state: u32 = 0x54a1c9e7;
    let mut draw: u32 = 0x9e3779b9;
    let mut audio: u32 = 0x243f6a88;
    let mut x: i32 = 640;
    let mut y: i32 = 600;
    let mut score: u32 = 0;
    let mut lives: u32 = 3;
    let mut entity_updates: u32 = 0;
    let mut collision_tests: u32 = 0;
    let mut draw_commands: u32 = 0;
    let mut audio_events: u32 = 0;

    for frame in 0u32..3600 {
        let control = read32(24 + frame * 4);
        let dx: i32 = if (control & 1) != 0 { -7 } else { 0 }
            + if (control & 2) != 0 { 7 } else { 0 };
        x = (x + dx + 1280).rem_euclid(1280);
        let dy: i32 = if (control & 4) != 0 { -5 } else { 0 }
            + if (control & 8) != 0 { 5 } else { 0 };
        y += dy;
        if y < 0 { y = 0; }
        if y > 719 { y = 719; }
        let active = 32u32 + ((control >> 8) & 31);
        draw = mix(mix(mix(draw, 0), frame), 0x050002d0);
        draw_commands += 1;
        for entity in 0u32..active {
            state = mix(state, frame.wrapping_mul(131)
                .wrapping_add(entity.wrapping_mul(17))
                .wrapping_add(control));
            entity_updates += 1;
            state = mix(state, ((x + y) as u32).wrapping_add(entity));
            collision_tests += 1;
            draw = mix(mix(mix(mix(draw, 2), frame), entity), state);
            draw_commands += 1;
            if (state & 2047) == 0 {
                score += 10;
                audio = mix(mix(mix(audio, 1), frame), entity);
                audio_events += 1;
            }
        }
        draw = mix(mix(mix(mix(draw, 1), frame), x as u32), y as u32);
        draw = mix(mix(mix(draw, 3), score), lives);
        draw_commands += 2;
        if (control & 0xff00) == 0xff00 && lives > 0 {
            lives -= 1;
            audio = mix(mix(mix(audio, 2), frame), lives);
            audio_events += 1;
        }
        state = mix(state, (x as u32) ^ ((y as u32) << 11) ^ score ^ lives);
    }

    let semantic = mix(mix(state, draw), audio);
    unsafe {
        let results = RES_OFFSET as *mut u32;
        results.write_volatile(semantic);
        results.add(1).write_volatile(state);
        results.add(2).write_volatile(draw);
        results.add(3).write_volatile(audio);
        results.add(4).write_volatile(entity_updates);
        results.add(5).write_volatile(collision_tests);
        results.add(6).write_volatile(draw_commands);
        results.add(7).write_volatile(audio_events);
    }
    0
}
