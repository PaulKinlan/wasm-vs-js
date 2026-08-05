#include <stdint.h>

// image-editing multilang kernels — exact mirror of the pinned proposal WAT
// (benchmarks/image-editing/image-editing.wat), which is the oracle sibling of
// benchmarks/image-editing/js.ts. Fixed one-page layout (bytes):
//   source RGBA = 0, output RGBA = 16384, visited mask / luma = 32768,
//   stack / horizontal u16 = 36864, nine u32 counters = 49152.
// Host contract: source and output are pre-loaded with the fixture bytes and
// the mask region is zeroed before flood_fill; both kernels are integer-only
// (no floating-point anywhere in either controlled algorithm).

#define SRC 0
#define OUT 16384
#define MASK_LUMA 32768
#define STACK_HORIZ 36864
#define COUNTERS 49152

#define FLOOD_THRESHOLD 12
// FLOOD_REPLACEMENT = 34, 139, 230, 191 (contract.ts).

static uint32_t g_operations, g_read_bytes, g_write_bytes, g_visited_pixels,
  g_changed_pixels, g_neighbor_tests, g_stack_pushes, g_stack_pops, g_max_frontier;
static uint32_t g_stack_size;

static uint8_t load8(uint32_t addr) { return *(volatile uint8_t*)(uintptr_t)addr; }
static void store8(uint32_t addr, uint8_t v) { *(volatile uint8_t*)(uintptr_t)addr = v; }
static uint16_t load16(uint32_t addr) { return *(volatile uint16_t*)(uintptr_t)addr; }
static void store16(uint32_t addr, uint16_t v) { *(volatile uint16_t*)(uintptr_t)addr = v; }
static uint32_t load32(uint32_t addr) { return *(volatile uint32_t*)(uintptr_t)addr; }
static void store32(uint32_t addr, uint32_t v) { *(volatile uint32_t*)(uintptr_t)addr = v; }

static void reset_counters(void) {
  g_stack_size = 0;
  g_operations = 0;
  g_read_bytes = 0;
  g_write_bytes = 0;
  g_visited_pixels = 0;
  g_changed_pixels = 0;
  g_neighbor_tests = 0;
  g_stack_pushes = 0;
  g_stack_pops = 0;
  g_max_frontier = 0;
}

static void write_counters(void) {
  store32(COUNTERS + 0, g_operations);
  store32(COUNTERS + 4, g_read_bytes);
  store32(COUNTERS + 8, g_write_bytes);
  store32(COUNTERS + 12, g_visited_pixels);
  store32(COUNTERS + 16, g_changed_pixels);
  store32(COUNTERS + 20, g_neighbor_tests);
  store32(COUNTERS + 24, g_stack_pushes);
  store32(COUNTERS + 28, g_stack_pops);
  store32(COUNTERS + 32, g_max_frontier);
}

static uint32_t absdiff(uint32_t left, uint32_t right) {
  return left >= right ? left - right : right - left;
}

static void push(uint32_t index) {
  store8(MASK_LUMA + index, 1);
  store32(STACK_HORIZ + g_stack_size * 4, index);
  g_stack_size += 1;
  g_stack_pushes += 1;
  g_write_bytes += 5;
  if (g_stack_size > g_max_frontier) g_max_frontier = g_stack_size;
}

static void try_push(uint32_t index) {
  g_neighbor_tests += 1;
  g_operations += 1;
  g_read_bytes += 1;
  if (load8(MASK_LUMA + index) == 0) push(index);
}

__attribute__((export_name("flood_fill")))
void flood_fill(uint32_t width, uint32_t height, uint32_t seed_x, uint32_t seed_y) {
  reset_counters();
  const uint32_t seed_index = seed_y * width + seed_x;
  const uint32_t seed_offset = seed_index * 4;
  const uint32_t seed_r = load8(SRC + seed_offset);
  const uint32_t seed_g = load8(SRC + seed_offset + 1);
  const uint32_t seed_b = load8(SRC + seed_offset + 2);
  const uint32_t seed_a = load8(SRC + seed_offset + 3);
  g_read_bytes = 4;
  g_operations = 4;

  if (seed_r == 34 && seed_g == 139 && seed_b == 230 && seed_a == 191) {
    write_counters();
    return;
  }

  push(seed_index);
  while (g_stack_size != 0) {
    g_stack_size -= 1;
    const uint32_t index = load32(STACK_HORIZ + g_stack_size * 4);
    g_stack_pops += 1;
    g_visited_pixels += 1;
    g_read_bytes += 8;
    const uint32_t offset = index * 4;

    uint32_t maximum = absdiff(load8(SRC + offset), seed_r);
    uint32_t difference = absdiff(load8(SRC + offset + 1), seed_g);
    if (difference > maximum) maximum = difference;
    difference = absdiff(load8(SRC + offset + 2), seed_b);
    if (difference > maximum) maximum = difference;
    difference = absdiff(load8(SRC + offset + 3), seed_a);
    if (difference > maximum) maximum = difference;
    g_operations += 8;

    if (maximum <= FLOOD_THRESHOLD) {
      store8(OUT + offset, 34);
      store8(OUT + offset + 1, 139);
      store8(OUT + offset + 2, 230);
      store8(OUT + offset + 3, 191);
      g_changed_pixels += 1;
      g_write_bytes += 4;

      const uint32_t x = index % width;
      const uint32_t y = index / width;
      if (y > 0) try_push(index - width);
      if (x + 1 < width) try_push(index + 1);
      if (y + 1 < height) try_push(index + width);
      if (x > 0) try_push(index - 1);
    }
  }
  write_counters();
}

__attribute__((export_name("luma_gaussian_pipeline")))
void luma_gaussian_pipeline(uint32_t width, uint32_t height) {
  reset_counters();
  const uint32_t pixels = width * height;

  // Integer luma: (77R + 150G + 29B + 128) >> 8.
  for (uint32_t index = 0; index < pixels; index += 1) {
    const uint32_t offset = index * 4;
    store8(
      MASK_LUMA + index,
      (uint8_t)((77 * load8(SRC + offset) + 150 * load8(SRC + offset + 1) +
                  29 * load8(SRC + offset + 2) + 128) >> 8));
  }

  for (uint32_t index = 0; index < pixels; index += 1) {
    const uint32_t x = index % width;
    const uint32_t left = x == 0 ? index : index - 1;
    const uint32_t right = x + 1 >= width ? index : index + 1;
    store16(
      STACK_HORIZ + index * 2,
      (uint16_t)(load8(MASK_LUMA + left) + 2 * load8(MASK_LUMA + index) +
        load8(MASK_LUMA + right)));
  }

  for (uint32_t index = 0; index < pixels; index += 1) {
    const uint32_t y = index / width;
    const uint32_t top = y == 0 ? index : index - width;
    const uint32_t bottom = y + 1 >= height ? index : index + width;
    const uint32_t value = (load16(STACK_HORIZ + top * 2) +
                             2 * load16(STACK_HORIZ + index * 2) +
                             load16(STACK_HORIZ + bottom * 2) + 8) >> 4;
    const uint32_t offset = index * 4;
    store8(OUT + offset, (uint8_t)value);
    store8(OUT + offset + 1, (uint8_t)value);
    store8(OUT + offset + 2, (uint8_t)value);
    store8(OUT + offset + 3, load8(SRC + offset + 3));
  }

  g_operations = pixels * 19;
  g_read_bytes = pixels * 13;
  g_write_bytes = pixels * 7;
  g_visited_pixels = pixels;
  write_counters();
}
