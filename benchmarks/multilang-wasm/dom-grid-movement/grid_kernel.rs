// grid_kernel.rs — multilang compute core for dom.grid-movement.v1.
// Same ABI: generates the frozen 3,600-action trace from seed 0xc001d00d,
// runs the 128-entity / 64x64 model, writes counters to fixed offset 16384
// (via raw pointer), returns finalPosSum.
#![no_std]
#![no_main]
use core::panic::PanicInfo;

#[panic_handler]
fn panic(_info: &PanicInfo) -> ! { loop {} }

const GRID_W: i32 = 64;
const GRID_H: i32 = 64;
const ENTITIES: usize = 128;
const ACTIONS: usize = 3600;
const RES_OFFSET: usize = 16384;

static mut SEED: u32 = 0xc001d00d;

fn next_rand() -> u32 {
    unsafe {
        SEED ^= SEED << 13;
        SEED ^= ((SEED as i32) >> 17) as u32;
        SEED ^= SEED << 5;
        SEED
    }
}

fn generate_actions(actions: &mut [u32]) {
    unsafe { SEED = 0xc001d00d; }
    for i in 0..ACTIONS {
        let r = next_rand();
        let r2 = next_rand();
        let entity = (r >> 25) & 0x7f as u32;
        let dir = (r2 >> 30);
        actions[i] = (dir << 8) | entity;
    }
}

#[unsafe(no_mangle)]
pub extern "C" fn grid_trace() -> i32 {
    let mut entities = [0i32; ENTITIES * 2];
    let mut actions = [0u32; ACTIONS];
    for i in 0..ENTITIES {
        entities[i * 2] = ((i * 3) % GRID_W as usize) as i32;
        entities[i * 2 + 1] = ((i * 3) / GRID_W as usize) as i32;
    }
    generate_actions(&mut actions);

    let mut total_moves: u32 = 0;
    let mut collisions: u32 = 0;
    for a in 0..ACTIONS {
        let entity_id = (actions[a] & 0xff) as usize;
        let dir = (actions[a] >> 8) & 0xff;
        let mut new_x = entities[entity_id * 2];
        let mut new_y = entities[entity_id * 2 + 1];
        match dir {
            0 => { if new_y > 0 { new_y -= 1; } }
            1 => { if new_y < GRID_H - 1 { new_y += 1; } }
            2 => { if new_x > 0 { new_x -= 1; } }
            3 => { if new_x < GRID_W - 1 { new_x += 1; } }
            _ => {}
        }
        let mut occupied = false;
        for j in 0..ENTITIES {
            if j == entity_id { continue; }
            if entities[j * 2] == new_x && entities[j * 2 + 1] == new_y {
                occupied = true;
                collisions += 1;
                break;
            }
        }
        if !occupied {
            entities[entity_id * 2] = new_x;
            entities[entity_id * 2 + 1] = new_y;
            total_moves += 1;
        }
    }
    let mut final_pos_sum: i32 = 0;
    for i in 0..ENTITIES {
        final_pos_sum += entities[i * 2] + entities[i * 2 + 1] * GRID_W;
    }
    // write counters to the fixed result offset
    unsafe {
        let results = RES_OFFSET as *mut u32;
        results.write_volatile(total_moves);
        results.add(1).write_volatile(collisions);
        results.add(2).write_volatile(final_pos_sum as u32);
    }
    final_pos_sum
}
