export function fft_butterfly(realPtr: usize, imagPtr: usize, len: i32): void {
  for (let step: i32 = 1; step < len; step <<= 1) {
    const angle: f32 = -3.14159265358979323846 / f32(step);
    const w_real: f32 = Mathf.cos(angle);
    const w_imag: f32 = Mathf.sin(angle);
    for (let i: i32 = 0; i < len; i += step << 1) {
      let cur_w_real: f32 = 1.0;
      let cur_w_imag: f32 = 0.0;
      for (let j: i32 = 0; j < step; j++) {
        const u: i32 = i + j;
        const v: i32 = i + j + step;
        const u_offset: usize = realPtr + (u << 2);
        const v_offset: usize = realPtr + (v << 2);
        const u_imag_offset: usize = imagPtr + (u << 2);
        const v_imag_offset: usize = imagPtr + (v << 2);

        const real_u = load<f32>(u_offset);
        const real_v = load<f32>(v_offset);
        const imag_u = load<f32>(u_imag_offset);
        const imag_v = load<f32>(v_imag_offset);

        const tr: f32 = real_v * cur_w_real - imag_v * cur_w_imag;
        const ti: f32 = real_v * cur_w_imag + imag_v * cur_w_real;

        store<f32>(v_offset, real_u - tr);
        store<f32>(v_imag_offset, imag_u - ti);
        store<f32>(u_offset, real_u + tr);
        store<f32>(u_imag_offset, imag_u + ti);

        const next_w_real = cur_w_real * w_real - cur_w_imag * w_imag;
        const next_w_imag = cur_w_real * w_imag + cur_w_imag * w_real;
        cur_w_real = next_w_real;
        cur_w_imag = next_w_imag;
      }
    }
  }
}
