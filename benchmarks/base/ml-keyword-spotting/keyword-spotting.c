#include <stdint.h>
#include "constants.v1.h"

#define SAMPLE_RATE 16000
#define HOP_SAMPLES 320
#define FFT_SIZE 512
#define HOPS 3000
#define FEATURES 13
#define CONTEXT 3
#define HIDDEN 8
#define CLASSES 4
#define MAX_DETECTIONS HOPS

static int16_t pcm[HOPS * HOP_SAMPLES];
static int16_t all_features[HOPS * FEATURES];
static int32_t all_scores[HOPS * CLASSES];
static int32_t detections[MAX_DETECTIONS * 3];
static int32_t re_buf[FFT_SIZE];
static int32_t im_buf[FFT_SIZE];
static int16_t context[CONTEXT * FEATURES];
static int16_t depthwise[FEATURES];
static int16_t hidden[HIDDEN];
static int32_t detection_count_value;

static int32_t abs32(int32_t x) { return x < 0 ? -x : x; }
static int32_t clamp_i8(int32_t x) { return x < -128 ? -128 : (x > 127 ? 127 : x); }
static int32_t ilog2_u32(uint32_t x) {
  int32_t n = 0;
  while (x > 1u) { x >>= 1u; n++; }
  return n;
}
static uint32_t bit_reverse9(uint32_t x) {
  uint32_t r = 0;
  for (int i = 0; i < 9; i++) { r = (r << 1u) | (x & 1u); x >>= 1u; }
  return r;
}

static void feature_for_hop(int hop, int16_t *out) {
  int base = hop * HOP_SAMPLES;
  for (int i = 0; i < FFT_SIZE; i++) {
    if (i < HOP_SAMPLES) re_buf[i] = ((int32_t)pcm[base + i] * (int32_t)WINDOW_Q15[i]) >> 15;
    else re_buf[i] = 0;
    im_buf[i] = 0;
  }
  for (uint32_t i = 0; i < FFT_SIZE; i++) {
    uint32_t j = bit_reverse9(i);
    if (j > i) {
      int32_t tr = re_buf[i]; re_buf[i] = re_buf[j]; re_buf[j] = tr;
      int32_t ti = im_buf[i]; im_buf[i] = im_buf[j]; im_buf[j] = ti;
    }
  }
  for (int len = 2; len <= FFT_SIZE; len <<= 1) {
    int half = len >> 1;
    int tw_step = FFT_SIZE / len;
    for (int start = 0; start < FFT_SIZE; start += len) {
      for (int j = 0; j < half; j++) {
        int tw = j * tw_step;
        int32_t br = re_buf[start + j + half];
        int32_t bi = im_buf[start + j + half];
        int32_t wr = TW_RE_Q15[tw];
        int32_t wi = TW_IM_Q15[tw];
        int32_t tr = (int32_t)(((int64_t)br * wr - (int64_t)bi * wi) >> 15);
        int32_t ti = (int32_t)(((int64_t)br * wi + (int64_t)bi * wr) >> 15);
        int32_t ar = re_buf[start + j];
        int32_t ai = im_buf[start + j];
        re_buf[start + j] = (ar + tr) >> 1;
        im_buf[start + j] = (ai + ti) >> 1;
        re_buf[start + j + half] = (ar - tr) >> 1;
        im_buf[start + j + half] = (ai - ti) >> 1;
      }
    }
  }
  int32_t bands[FEATURES];
  for (int band = 0; band < FEATURES; band++) {
    int begin = 1 + (band * 256) / FEATURES;
    int end = 1 + ((band + 1) * 256) / FEATURES;
    uint32_t sum = 1;
    for (int bin = begin; bin < end; bin++) sum += (uint32_t)(abs32(re_buf[bin]) + abs32(im_buf[bin]));
    bands[band] = ilog2_u32(sum);
  }
  for (int k = 0; k < FEATURES; k++) {
    int32_t sum = 0;
    for (int n = 0; n < FEATURES; n++) sum += bands[n] * (int32_t)DCT_Q15[k * FEATURES + n];
    int32_t value = sum >> 10;
    out[k] = (int16_t)(value < -32768 ? -32768 : (value > 32767 ? 32767 : value));
  }
}

static void infer_hop(int hop, const int16_t *feature, int32_t *scores) {
  int slot = hop % CONTEXT;
  for (int f = 0; f < FEATURES; f++) context[slot * FEATURES + f] = feature[f];
  for (int f = 0; f < FEATURES; f++) {
    int32_t acc = DW_B[f];
    for (int t = 0; t < CONTEXT; t++) {
      int source_hop = hop - (CONTEXT - 1 - t);
      int16_t value = source_hop < 0 ? 0 : context[(source_hop % CONTEXT) * FEATURES + f];
      acc += (int32_t)value * (int32_t)DW_W[t * FEATURES + f];
    }
    depthwise[f] = (int16_t)clamp_i8(acc >> 5);
  }
  for (int h = 0; h < HIDDEN; h++) {
    int32_t acc = PW_B[h];
    for (int f = 0; f < FEATURES; f++) acc += (int32_t)depthwise[f] * (int32_t)PW_W[f * HIDDEN + h];
    acc >>= 6;
    hidden[h] = (int16_t)(acc < 0 ? 0 : (acc > 127 ? 127 : acc));
  }
  for (int c = 0; c < CLASSES; c++) {
    int32_t acc = OUT_B[c];
    for (int h = 0; h < HIDDEN; h++) acc += (int32_t)hidden[h] * (int32_t)OUT_W[h * CLASSES + c];
    scores[c] = acc >> 4;
  }
}

int run(void) {
  detection_count_value = 0;
  for (int i = 0; i < CONTEXT * FEATURES; i++) context[i] = 0;
  int previous = -1;
  for (int hop = 0; hop < HOPS; hop++) {
    int16_t *feature = &all_features[hop * FEATURES];
    int32_t *scores = &all_scores[hop * CLASSES];
    feature_for_hop(hop, feature);
    infer_hop(hop, feature, scores);
    int best = 0;
    for (int c = 1; c < CLASSES; c++) if (scores[c] > scores[best]) best = c;
    if (best != 0 && best != previous && detection_count_value < MAX_DETECTIONS) {
      int out = detection_count_value * 3;
      detections[out] = hop;
      detections[out + 1] = best;
      detections[out + 2] = scores[best];
      detection_count_value++;
    }
    previous = best;
  }
  return detection_count_value;
}

int16_t *pcm_ptr(void) { return pcm; }
int16_t *features_ptr(void) { return all_features; }
int32_t *scores_ptr(void) { return all_scores; }
int32_t *detections_ptr(void) { return detections; }
int detection_count(void) { return detection_count_value; }
int hop_count(void) { return HOPS; }
int feature_count(void) { return FEATURES; }
int class_count(void) { return CLASSES; }
