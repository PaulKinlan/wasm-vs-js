#![no_std]

#[panic_handler]
fn panic(_info: &core::panic::PanicInfo) -> ! {
    core::arch::wasm32::unreachable()
}

// Mirrors benchmarks/multilang-wasm/sum_u32.c: identical u32 reduction semantics.
#[no_mangle]
pub extern "C" fn sum_u32(ptr: *const u32, len: u32) -> u32 {
    let slice = unsafe { core::slice::from_raw_parts(ptr, len as usize) };
    slice.iter().fold(0u32, |acc, &x| acc.wrapping_add(x))
}
