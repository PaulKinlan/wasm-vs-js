// audio_dsp_kernel.c — multilang compute core for audio.webaudio-effects.v1.

#define FRAMES 48000
#define BLOCK_FRAMES 128
#define IR_LENGTH 16
#define OUTPUT_FRAMES 48015

// Fixed memory offsets
#define FIXTURE_OFFSET 1048576  // 1 MiB (unused here, generated internally)
#define OUTPUT_OFFSET 2097152   // 2 MiB
#define RES_OFFSET 3145728      // 3 MiB

// Constants
#define B0 0.206572083826147f
#define B1 0.413144167652294f
#define B2 0.206572083826147f
#define A1 -0.369527377351241f
#define A2 0.195815712655833f

#define THRESHOLD 0.25f
#define KNEE 0.1f
#define RATIO_RECIPROCAL 0.25f
#define ATTACK 0.9f
#define RELEASE 0.9995f

static const float IR[IR_LENGTH] = {
  0.625f, -0.1875f, 0.140625f, 0.10546875f, -0.0791015625f, 0.059326171875f, -0.04449462890625f,
  0.0333709716796875f, -0.025028228759765625f, 0.01877117156982422f, -0.014078378677368164f,
  0.010558784008026123f, -0.007919088006019592f, 0.005939316004514694f, -0.004454487003386021f,
  0.0033408652525395155f
};

typedef struct {
  float z1;
  float z2;
  float envelope;
  float history[IR_LENGTH];
  int cursor;
} ChannelState;

static float f_abs(float x) {
  union { float f; unsigned int i; } u;
  u.f = x;
  u.i &= 0x7fffffff;
  return u.f;
}

static float compressor_gain(float envelope) {
  float half = KNEE * 0.5f;
  float low = THRESHOLD - half;
  float high = THRESHOLD + half;
  if (envelope <= low) return 1.0f;
  
  float over = envelope - THRESHOLD;
  float target = THRESHOLD + (over * RATIO_RECIPROCAL);
  float hard_gain = target / envelope;
  if (envelope >= high) return hard_gain;
  
  float t = (envelope - low) / KNEE;
  float mix = t * t;
  float effective = envelope + (mix * (target - envelope));
  return effective / envelope;
}

static void convolve_sample(float compressed, float *output, int out_idx, ChannelState *state) {
  state->history[state->cursor] = compressed;
  float sum = 0.0f;
  int hist_idx = state->cursor;
  for (int tap = 0; tap < IR_LENGTH; tap++) {
    sum += state->history[hist_idx] * IR[tap];
    hist_idx = hist_idx == 0 ? IR_LENGTH - 1 : hist_idx - 1;
  }
  output[out_idx] = sum;
  state->cursor++;
  if (state->cursor == IR_LENGTH) state->cursor = 0;
}

static void process_block(float *input, int offset, int frames, float *output, ChannelState *state) {
  for (int i = 0; i < frames; i++) {
    float sample = input[offset + i];
    float filtered = (B0 * sample) + state->z1;
    state->z1 = ((B1 * sample) - (A1 * filtered)) + state->z2;
    state->z2 = (B2 * sample) - (A2 * filtered);
    
    float magnitude = f_abs(filtered);
    float coefficient = magnitude > state->envelope ? ATTACK : RELEASE;
    state->envelope = (coefficient * state->envelope) + ((1.0f - coefficient) * magnitude);
    
    float gain = compressor_gain(state->envelope);
    convolve_sample(filtered * gain, output, offset + i, state);
  }
}

__attribute__((export_name("audio_dsp")))
unsigned int audio_dsp(void) {
  unsigned int *results = (unsigned int *)RES_OFFSET;
  results[0] = 0; // blockInvocations
  results[1] = 0; // stateCarryBoundaries
  results[2] = 0; // tailFlushInvocations
  results[3] = 0; // tailFlushFrames
  
  static float left_in[FRAMES];
  static float right_in[FRAMES];
  static float left_out[OUTPUT_FRAMES];
  static float right_out[OUTPUT_FRAMES];
  
  // 1. Generate fixture
  left_in[0] = 1.0f;
  right_in[0] = -0.75f;
  for (int i = 1; i < FRAMES; i++) {
    if (i < 12000) {
      left_in[i] = 0.10000000149011612f;
      right_in[i] = -0.07500000298023224f;
    } else if (i < 24000) {
      left_in[i] = 0.25f;
      right_in[i] = -0.1875f;
    } else if (i < 36000) {
      left_in[i] = 0.30000001192092896f;
      right_in[i] = -0.22499999403953552f;
    } else {
      left_in[i] = -0.20000000298023224f;
      right_in[i] = 0.15000000596046448f;
    }
  }
  
  // 2. Process Left
  ChannelState state_l = {0};
  int blocks = 0;
  for (int offset = 0; offset < FRAMES; offset += BLOCK_FRAMES) {
    int frames = FRAMES - offset;
    if (frames > BLOCK_FRAMES) frames = BLOCK_FRAMES;
    if (blocks > 0) results[1]++;
    process_block(left_in, offset, frames, left_out, &state_l);
    blocks++;
    results[0]++;
  }
  for (int tail = 0; tail < IR_LENGTH - 1; tail++) {
    convolve_sample(0.0f, left_out, FRAMES + tail, &state_l);
  }
  results[2]++;
  results[3] += IR_LENGTH - 1;

  // 3. Process Right
  ChannelState state_r = {0};
  blocks = 0;
  for (int offset = 0; offset < FRAMES; offset += BLOCK_FRAMES) {
    int frames = FRAMES - offset;
    if (frames > BLOCK_FRAMES) frames = BLOCK_FRAMES;
    if (blocks > 0) results[1]++;
    process_block(right_in, offset, frames, right_out, &state_r);
    blocks++;
    results[0]++;
  }
  for (int tail = 0; tail < IR_LENGTH - 1; tail++) {
    convolve_sample(0.0f, right_out, FRAMES + tail, &state_r);
  }
  results[2]++;
  results[3] += IR_LENGTH - 1;
  
  // 4. Interleave & write to OUTPUT_OFFSET
  float *out_mem = (float *)OUTPUT_OFFSET;
  for (int i = 0; i < OUTPUT_FRAMES; i++) {
    float l = left_out[i];
    if (l == -0.0f) l = 0.0f;
    float r = right_out[i];
    if (r == -0.0f) r = 0.0f;
    out_mem[i * 2] = l;
    out_mem[i * 2 + 1] = r;
  }
  
  // 5. Compute FNV-1a
  unsigned char *bytes = (unsigned char *)OUTPUT_OFFSET;
  unsigned int fnv = 0x811c9dc5;
  for (int i = 0; i < OUTPUT_FRAMES * 8; i++) {
    fnv = (fnv ^ bytes[i]) * 0x01000193;
  }
  results[4] = fnv;
  
  return fnv;
}
