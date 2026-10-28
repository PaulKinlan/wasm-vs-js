;; fft_kernel.wat — Handwritten WebAssembly Text kernel for Radix-2 FFT
(module
  (memory (export "memory") 1)

  (func $sinf_custom (param $x f32) (result f32)
    (local $x2 f32)
    (local $x3 f32)
    (local $x5 f32)
    (local $x7 f32)

    ;; while (x > 3.14159265f) x -= 6.2831853f;
    (block $b1
      (loop $l1
        local.get $x
        f32.const 3.14159265358979323846
        f32.gt
        i32.eqz
        br_if $b1
        local.get $x
        f32.const 6.28318530717958647692
        f32.sub
        local.set $x
        br $l1
      )
    )

    ;; while (x < -3.14159265f) x += 6.2831853f;
    (block $b2
      (loop $l2
        local.get $x
        f32.const -3.14159265358979323846
        f32.lt
        i32.eqz
        br_if $b2
        local.get $x
        f32.const 6.28318530717958647692
        f32.add
        local.set $x
        br $l2
      )
    )

    local.get $x
    local.get $x
    f32.mul
    local.tee $x2
    local.get $x
    f32.mul
    local.tee $x3
    local.get $x2
    f32.mul
    local.tee $x5
    local.get $x2
    f32.mul
    local.set $x7

    ;; return x - (x3 / 6.0f) + (x5 / 120.0f) - (x7 / 5040.0f);
    local.get $x
    local.get $x3
    f32.const 6.0
    f32.div
    f32.sub
    local.get $x5
    f32.const 120.0
    f32.div
    f32.add
    local.get $x7
    f32.const 5040.0
    f32.div
    f32.sub
  )

  (func $cosf_custom (param $x f32) (result f32)
    local.get $x
    f32.const 1.57079632679489661923
    f32.add
    call $sinf_custom
  )

  (func $fft_butterfly (export "fft_butterfly") (param $real i32) (param $imag i32) (param $len i32)
    (local $step i32)
    (local $angle f32)
    (local $w_real f32)
    (local $w_imag f32)
    (local $i i32)
    (local $cur_w_real f32)
    (local $cur_w_imag f32)
    (local $j i32)
    (local $u i32)
    (local $v i32)
    (local $tr f32)
    (local $ti f32)
    (local $ru f32)
    (local $iu f32)
    (local $rv f32)
    (local $iv f32)
    (local $u_off i32)
    (local $v_off i32)
    (local $next_w_real f32)
    (local $next_w_imag f32)

    (local.set $step (i32.const 1))
    (block $break_step
      (loop $loop_step
        local.get $step
        local.get $len
        i32.ge_u
        br_if $break_step

        ;; angle = -3.14159265f / (float)step
        f32.const -3.14159265358979323846
        local.get $step
        f32.convert_i32_u
        f32.div
        local.tee $angle
        call $cosf_custom
        local.set $w_real
        local.get $angle
        call $sinf_custom
        local.set $w_imag

        ;; for (i = 0; i < len; i += (step << 1))
        (local.set $i (i32.const 0))
        (block $break_i
          (loop $loop_i
            local.get $i
            local.get $len
            i32.ge_u
            br_if $break_i

            (local.set $cur_w_real (f32.const 1.0))
            (local.set $cur_w_imag (f32.const 0.0))

            ;; for (j = 0; j < step; j++)
            (local.set $j (i32.const 0))
            (block $break_j
              (loop $loop_j
                local.get $j
                local.get $step
                i32.ge_u
                br_if $break_j

                local.get $i
                local.get $j
                i32.add
                local.set $u

                local.get $u
                local.get $step
                i32.add
                local.set $v

                ;; u_off = u * 4, v_off = v * 4
                local.get $u
                i32.const 2
                i32.shl
                local.set $u_off

                local.get $v
                i32.const 2
                i32.shl
                local.set $v_off

                local.get $real
                local.get $v_off
                i32.add
                f32.load
                local.set $rv

                local.get $imag
                local.get $v_off
                i32.add
                f32.load
                local.set $iv

                local.get $real
                local.get $u_off
                i32.add
                f32.load
                local.set $ru

                local.get $imag
                local.get $u_off
                i32.add
                f32.load
                local.set $iu

                ;; tr = rv * cur_w_real - iv * cur_w_imag
                local.get $rv
                local.get $cur_w_real
                f32.mul
                local.get $iv
                local.get $cur_w_imag
                f32.mul
                f32.sub
                local.set $tr

                ;; ti = rv * cur_w_imag + iv * cur_w_real
                local.get $rv
                local.get $cur_w_imag
                f32.mul
                local.get $iv
                local.get $cur_w_real
                f32.mul
                f32.add
                local.set $ti

                ;; real[v] = ru - tr; imag[v] = iu - ti;
                local.get $real
                local.get $v_off
                i32.add
                local.get $ru
                local.get $tr
                f32.sub
                f32.store

                local.get $imag
                local.get $v_off
                i32.add
                local.get $iu
                local.get $ti
                f32.sub
                f32.store

                ;; real[u] = ru + tr; imag[u] = iu + ti;
                local.get $real
                local.get $u_off
                i32.add
                local.get $ru
                local.get $tr
                f32.add
                f32.store

                local.get $imag
                local.get $u_off
                i32.add
                local.get $iu
                local.get $ti
                f32.add
                f32.store

                ;; next_w_real = cur_w_real * w_real - cur_w_imag * w_imag
                local.get $cur_w_real
                local.get $w_real
                f32.mul
                local.get $cur_w_imag
                local.get $w_imag
                f32.mul
                f32.sub
                local.set $next_w_real

                ;; next_w_imag = cur_w_real * w_imag + cur_w_imag * w_real
                local.get $cur_w_real
                local.get $w_imag
                f32.mul
                local.get $cur_w_imag
                local.get $w_real
                f32.mul
                f32.add
                local.set $next_w_imag

                local.get $next_w_real
                local.set $cur_w_real
                local.get $next_w_imag
                local.set $cur_w_imag

                local.get $j
                i32.const 1
                i32.add
                local.set $j
                br $loop_j
              )
            )

            ;; i += (step << 1)
            local.get $i
            local.get $step
            i32.const 1
            i32.shl
            i32.add
            local.set $i
            br $loop_i
          )
        )

        ;; step <<= 1
        local.get $step
        i32.const 1
        i32.shl
        local.set $step
        br $loop_step
      )
    )
  )
)
