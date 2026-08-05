// TodoMVC 100-item state machine — identical body to todomvc_engine.c in an
// extern "C" translation unit (same ABI, same semantics, bit-identical
// output). See todomvc_engine.c for the full doc comment.
extern "C" {
typedef unsigned char u8;
typedef unsigned int u32;

#define TODO_COUNT 100

static u32 g_actions, g_adds, g_toggles, g_filters, g_removes, g_edits;
static u32 g_state_writes, g_commands_emitted;

static int alive(const u8 *state, u32 id) {
  return (state[id] & 1) != 0;
}

static int apply(u8 *state, u32 opcode, u32 id, u32 value, u32 focus, u32 *out) {
  if (id >= TODO_COUNT || focus > 1) return 0;
  if (opcode == 1) {
    if (alive(state, id)) return 0;
    state[id] = 1;
    state[100 + id] = 0;
    g_adds++;
    g_state_writes += 2;
  } else if (opcode == 2) {
    if (!alive(state, id)) return 0;
    state[id] ^= 2;
    g_toggles++;
    g_state_writes++;
  } else if (opcode == 3) {
    if (value > 2) return 0;
    state[200] = (u8)value;
    g_filters++;
    g_state_writes++;
  } else if (opcode == 4) {
    if (!alive(state, id) || value != 1) return 0;
    state[100 + id] = (u8)value;
    g_edits++;
    g_state_writes++;
  } else if (opcode == 5) {
    if (!alive(state, id)) return 0;
    state[id] = 0;
    g_removes++;
    g_state_writes++;
  } else {
    return 0;
  }
  out[0] = opcode;
  out[1] = id;
  out[2] = value;
  out[3] = focus;
  g_actions++;
  g_commands_emitted++;
  return 1;
}

__attribute__((export_name("run")))
int run(u32 count, u32 input_ptr, u32 command_ptr, u32 state_ptr) {
  if (count > 150) return -1;
  const u32 *input = (const u32 *)(unsigned long)input_ptr;
  u32 *commands = (u32 *)(unsigned long)command_ptr;
  u8 *state = (u8 *)(unsigned long)state_ptr;
  for (u32 i = 0; i < 201; i++) state[i] = 0;
  g_actions = g_adds = g_toggles = g_filters = g_removes = g_edits = 0;
  g_state_writes = g_commands_emitted = 0;
  for (u32 i = 0; i < count; i++) {
    if (!apply(state, input[i * 4], input[i * 4 + 1], input[i * 4 + 2], input[i * 4 + 3],
               &commands[i * 4])) {
      return -1;
    }
  }
  return (int)count;
}

__attribute__((export_name("counter_actions"))) u32 counter_actions(void) { return g_actions; }
__attribute__((export_name("counter_adds"))) u32 counter_adds(void) { return g_adds; }
__attribute__((export_name("counter_toggles"))) u32 counter_toggles(void) { return g_toggles; }
__attribute__((export_name("counter_filters"))) u32 counter_filters(void) { return g_filters; }
__attribute__((export_name("counter_removes"))) u32 counter_removes(void) { return g_removes; }
__attribute__((export_name("counter_edits"))) u32 counter_edits(void) { return g_edits; }
__attribute__((export_name("counter_state_writes"))) u32 counter_state_writes(void) {
  return g_state_writes;
}
__attribute__((export_name("counter_commands_emitted"))) u32 counter_commands_emitted(void) {
  return g_commands_emitted;
}
}
