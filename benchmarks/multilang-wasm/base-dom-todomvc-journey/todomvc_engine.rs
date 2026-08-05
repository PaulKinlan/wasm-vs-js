//! TodoMVC 100-item state machine — exact mirror of
//! benchmarks/base/dom-todomvc-journey/engine.js and the frozen todomvc.wat,
//! in Rust (no_std cdylib). Same ABI as todomvc_engine.c:
//! `run(count, input_ptr, command_ptr, state_ptr) -> i32` plus the
//! `counter_*` getters. Bit-identical command + state output on the frozen
//! 150-action trace.

#![no_std]

#[panic_handler]
fn panic(_info: &core::panic::PanicInfo) -> ! {
    core::arch::wasm32::unreachable()
}

const TODO_COUNT: u32 = 100;

static mut G_ACTIONS: u32 = 0;
static mut G_ADDS: u32 = 0;
static mut G_TOGGLES: u32 = 0;
static mut G_FILTERS: u32 = 0;
static mut G_REMOVES: u32 = 0;
static mut G_EDITS: u32 = 0;
static mut G_STATE_WRITES: u32 = 0;
static mut G_COMMANDS_EMITTED: u32 = 0;

#[inline(never)]
fn alive(state: *const u8, id: u32) -> bool {
    unsafe { (*(state.add(id as usize)) & 1) != 0 }
}

// Mirrors engine.js apply(): validates, mutates, counts, emits the command.
fn apply(state: *mut u8, opcode: u32, id: u32, value: u32, focus: u32, out: *mut u32) -> bool {
    if id >= TODO_COUNT || focus > 1 {
        return false;
    }
    if opcode == 1 {
        // ADD
        if alive(state, id) {
            return false;
        }
        unsafe {
            *state.add(id as usize) = 1;
            *state.add(100 + id as usize) = 0;
            G_ADDS += 1;
            G_STATE_WRITES += 2;
        }
    } else if opcode == 2 {
        // TOGGLE
        if !alive(state, id) {
            return false;
        }
        unsafe {
            *state.add(id as usize) ^= 2;
            G_TOGGLES += 1;
            G_STATE_WRITES += 1;
        }
    } else if opcode == 3 {
        // FILTER
        if value > 2 {
            return false;
        }
        unsafe {
            *state.add(200) = value as u8;
            G_FILTERS += 1;
            G_STATE_WRITES += 1;
        }
    } else if opcode == 4 {
        // EDIT
        if !alive(state, id) || value != 1 {
            return false;
        }
        unsafe {
            *state.add(100 + id as usize) = value as u8;
            G_EDITS += 1;
            G_STATE_WRITES += 1;
        }
    } else if opcode == 5 {
        // REMOVE
        if !alive(state, id) {
            return false;
        }
        unsafe {
            *state.add(id as usize) = 0;
            G_REMOVES += 1;
            G_STATE_WRITES += 1;
        }
    } else {
        return false;
    }
    unsafe {
        *out.add(0) = opcode;
        *out.add(1) = id;
        *out.add(2) = value;
        *out.add(3) = focus;
        G_ACTIONS += 1;
        G_COMMANDS_EMITTED += 1;
    }
    true
}

#[no_mangle]
pub extern "C" fn run(count: u32, input_ptr: u32, command_ptr: u32, state_ptr: u32) -> i32 {
    if count > 150 {
        return -1;
    }
    let input = input_ptr as *const u32;
    let commands = command_ptr as *mut u32;
    let state = state_ptr as *mut u8;
    unsafe {
        for i in 0..201 {
            *state.add(i as usize) = 0;
        }
        G_ACTIONS = 0;
        G_ADDS = 0;
        G_TOGGLES = 0;
        G_FILTERS = 0;
        G_REMOVES = 0;
        G_EDITS = 0;
        G_STATE_WRITES = 0;
        G_COMMANDS_EMITTED = 0;
        for i in 0..count {
            let base = (i * 4) as usize;
            let ok = apply(
                state,
                *input.add(base),
                *input.add(base + 1),
                *input.add(base + 2),
                *input.add(base + 3),
                commands.add(base),
            );
            if !ok {
                return -1;
            }
        }
    }
    count as i32
}

#[no_mangle]
pub extern "C" fn counter_actions() -> u32 {
    unsafe { G_ACTIONS }
}
#[no_mangle]
pub extern "C" fn counter_adds() -> u32 {
    unsafe { G_ADDS }
}
#[no_mangle]
pub extern "C" fn counter_toggles() -> u32 {
    unsafe { G_TOGGLES }
}
#[no_mangle]
pub extern "C" fn counter_filters() -> u32 {
    unsafe { G_FILTERS }
}
#[no_mangle]
pub extern "C" fn counter_removes() -> u32 {
    unsafe { G_REMOVES }
}
#[no_mangle]
pub extern "C" fn counter_edits() -> u32 {
    unsafe { G_EDITS }
}
#[no_mangle]
pub extern "C" fn counter_state_writes() -> u32 {
    unsafe { G_STATE_WRITES }
}
#[no_mangle]
pub extern "C" fn counter_commands_emitted() -> u32 {
    unsafe { G_COMMANDS_EMITTED }
}
