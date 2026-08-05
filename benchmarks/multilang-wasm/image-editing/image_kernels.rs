#![no_std]

#[panic_handler]
fn panic(_info: &core::panic::PanicInfo) -> ! {
    core::arch::wasm32::unreachable()
}

// image-editing multilang kernels — exact mirror of the pinned proposal WAT
// (benchmarks/image-editing/image-editing.wat) and image_kernels.c. Fixed
// layout (bytes): source = 0, output = 16384, visited/luma = 32768,
// stack/horizontal = 36864, nine u32 counters = 49152. Integer-only.
//
// No `static` state anywhere: linear memory below the counters region is the
// host's fixture/scratch ABI, so a Rust bss/data write would clobber fixture
// pixels mid-run. All counter state is function-local and threaded by &mut.

const SRC: usize = 0;
const OUT: usize = 16384;
const MASK_LUMA: usize = 32768;
const STACK_HORIZ: usize = 36864;
const COUNTERS: usize = 49152;
const FLOOD_THRESHOLD: u32 = 12;

struct Counters {
    operations: u32,
    read_bytes: u32,
    write_bytes: u32,
    visited_pixels: u32,
    changed_pixels: u32,
    neighbor_tests: u32,
    stack_pushes: u32,
    stack_pops: u32,
    max_frontier: u32,
    stack_size: u32,
}

impl Counters {
    #[inline(always)]
    fn new() -> Self {
        Counters {
            operations: 0,
            read_bytes: 0,
            write_bytes: 0,
            visited_pixels: 0,
            changed_pixels: 0,
            neighbor_tests: 0,
            stack_pushes: 0,
            stack_pops: 0,
            max_frontier: 0,
            stack_size: 0,
        }
    }
    #[inline(always)]
    fn write(&self) {
        store32(COUNTERS, self.operations);
        store32(COUNTERS + 4, self.read_bytes);
        store32(COUNTERS + 8, self.write_bytes);
        store32(COUNTERS + 12, self.visited_pixels);
        store32(COUNTERS + 16, self.changed_pixels);
        store32(COUNTERS + 20, self.neighbor_tests);
        store32(COUNTERS + 24, self.stack_pushes);
        store32(COUNTERS + 28, self.stack_pops);
        store32(COUNTERS + 32, self.max_frontier);
    }
}

#[inline(always)]
fn load8(addr: usize) -> u8 {
    unsafe { core::ptr::read_volatile(addr as *const u8) }
}
#[inline(always)]
fn store8(addr: usize, v: u8) {
    unsafe { core::ptr::write_volatile(addr as *mut u8, v) };
}
#[inline(always)]
fn load16(addr: usize) -> u16 {
    unsafe { core::ptr::read_volatile(addr as *const u16) }
}
#[inline(always)]
fn store16(addr: usize, v: u16) {
    unsafe { core::ptr::write_volatile(addr as *mut u16, v) };
}
#[inline(always)]
fn load32(addr: usize) -> u32 {
    unsafe { core::ptr::read_volatile(addr as *const u32) }
}
#[inline(always)]
fn store32(addr: usize, v: u32) {
    unsafe { core::ptr::write_volatile(addr as *mut u32, v) };
}

#[inline(always)]
fn absdiff(left: u32, right: u32) -> u32 {
    if left >= right { left - right } else { right - left }
}

#[inline(always)]
fn push(c: &mut Counters, index: u32) {
    store8(MASK_LUMA + index as usize, 1);
    store32(STACK_HORIZ + c.stack_size as usize * 4, index);
    c.stack_size += 1;
    c.stack_pushes += 1;
    c.write_bytes += 5;
    if c.stack_size > c.max_frontier {
        c.max_frontier = c.stack_size;
    }
}

#[inline(always)]
fn try_push(c: &mut Counters, index: u32) {
    c.neighbor_tests += 1;
    c.operations += 1;
    c.read_bytes += 1;
    if load8(MASK_LUMA + index as usize) == 0 {
        push(c, index);
    }
}

#[no_mangle]
pub extern "C" fn flood_fill(width: u32, height: u32, seed_x: u32, seed_y: u32) {
    let mut c = Counters::new();
    let seed_index = seed_y * width + seed_x;
    let seed_offset = (seed_index * 4) as usize;
    let seed_r = load8(SRC + seed_offset) as u32;
    let seed_g = load8(SRC + seed_offset + 1) as u32;
    let seed_b = load8(SRC + seed_offset + 2) as u32;
    let seed_a = load8(SRC + seed_offset + 3) as u32;
    c.read_bytes = 4;
    c.operations = 4;

    if seed_r == 34 && seed_g == 139 && seed_b == 230 && seed_a == 191 {
        c.write();
        return;
    }

    push(&mut c, seed_index);
    while c.stack_size != 0 {
        c.stack_size -= 1;
        let index = load32(STACK_HORIZ + c.stack_size as usize * 4);
        c.stack_pops += 1;
        c.visited_pixels += 1;
        c.read_bytes += 8;
        let offset = (index * 4) as usize;

        let mut maximum = absdiff(load8(SRC + offset) as u32, seed_r);
        let mut difference = absdiff(load8(SRC + offset + 1) as u32, seed_g);
        if difference > maximum {
            maximum = difference;
        }
        difference = absdiff(load8(SRC + offset + 2) as u32, seed_b);
        if difference > maximum {
            maximum = difference;
        }
        difference = absdiff(load8(SRC + offset + 3) as u32, seed_a);
        if difference > maximum {
            maximum = difference;
        }
        c.operations += 8;

        if maximum <= FLOOD_THRESHOLD {
            store8(OUT + offset, 34);
            store8(OUT + offset + 1, 139);
            store8(OUT + offset + 2, 230);
            store8(OUT + offset + 3, 191);
            c.changed_pixels += 1;
            c.write_bytes += 4;

            let x = index % width;
            let y = index / width;
            if y > 0 {
                try_push(&mut c, index - width);
            }
            if x + 1 < width {
                try_push(&mut c, index + 1);
            }
            if y + 1 < height {
                try_push(&mut c, index + width);
            }
            if x > 0 {
                try_push(&mut c, index - 1);
            }
        }
    }
    c.write();
}

#[no_mangle]
pub extern "C" fn luma_gaussian_pipeline(width: u32, height: u32) {
    let c = Counters::new();
    let pixels = width * height;

    // Integer luma: (77R + 150G + 29B + 128) >> 8.
    for index in 0..pixels {
        let offset = (index * 4) as usize;
        let value = (77 * load8(SRC + offset) as u32 + 150 * load8(SRC + offset + 1) as u32
            + 29 * load8(SRC + offset + 2) as u32
            + 128) >> 8;
        store8(MASK_LUMA + index as usize, value as u8);
    }

    for index in 0..pixels {
        let x = index % width;
        let left = if x == 0 { index } else { index - 1 };
        let right = if x + 1 >= width { index } else { index + 1 };
        let value = load8(MASK_LUMA + left as usize) as u16
            + 2 * load8(MASK_LUMA + index as usize) as u16
            + load8(MASK_LUMA + right as usize) as u16;
        store16(STACK_HORIZ + index as usize * 2, value);
    }

    for index in 0..pixels {
        let y = index / width;
        let top = if y == 0 { index } else { index - width };
        let bottom = if y + 1 >= height { index } else { index + width };
        let value = (load16(STACK_HORIZ + top as usize * 2) as u32
            + 2 * load16(STACK_HORIZ + index as usize * 2) as u32
            + load16(STACK_HORIZ + bottom as usize * 2) as u32
            + 8) >> 4;
        let offset = (index * 4) as usize;
        store8(OUT + offset, value as u8);
        store8(OUT + offset + 1, value as u8);
        store8(OUT + offset + 2, value as u8);
        store8(OUT + offset + 3, load8(SRC + offset + 3));
    }

    let c = Counters {
        operations: pixels * 19,
        read_bytes: pixels * 13,
        write_bytes: pixels * 7,
        visited_pixels: pixels,
        ..c
    };
    c.write();
}
