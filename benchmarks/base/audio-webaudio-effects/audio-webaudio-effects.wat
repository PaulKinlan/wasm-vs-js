;; audio.webaudio-effects.v1 controlled scalar linear-Wasm target.
;; The host invokes effects_block once for every sequential 128-frame channel block.
;; Per-channel biquad, envelope, cursor, and convolution history state live in linear
;; memory and are carried across every call. All arithmetic is f32.
(module
  (memory (export "memory") 1024 1024)

  (func $compressor_gain (param $env f32) (result f32)
    (local $target f32) (local $hard f32) (local $t f32) (local $mix f32)
    (if (result f32) (f32.le (local.get $env) (f32.const 0.2))
      (then (f32.const 1))
      (else
        (local.set $target
          (f32.add (f32.const 0.25)
            (f32.mul (f32.sub (local.get $env) (f32.const 0.25)) (f32.const 0.25))))
        (local.set $hard (f32.div (local.get $target) (local.get $env)))
        (if (result f32) (f32.ge (local.get $env) (f32.const 0.3))
          (then (local.get $hard))
          (else
            (local.set $t
              (f32.div (f32.sub (local.get $env) (f32.const 0.2)) (f32.const 0.1)))
            (local.set $mix (f32.mul (local.get $t) (local.get $t)))
            (f32.div
              (f32.add (local.get $env)
                (f32.mul (local.get $mix)
                  (f32.sub (local.get $target) (local.get $env))))
              (local.get $env)))))))

  ;; State layout: z1 f32, z2 f32, envelope f32, cursor i32, then 16 f32 history values.
  (func (export "reset_state") (param $state i32) (param $irLen i32)
    (local $i i32)
    (local.set $i (i32.const 0))
    (block $done
      (loop $clear
        (br_if $done (i32.ge_u (local.get $i) (i32.add (local.get $irLen) (i32.const 4))))
        (i32.store
          (i32.add (local.get $state) (i32.mul (local.get $i) (i32.const 4)))
          (i32.const 0))
        (local.set $i (i32.add (local.get $i) (i32.const 1)))
        (br $clear))))

  (func (export "effects_block")
    (param $input i32) (param $frames i32) (param $ir i32) (param $irLen i32)
    (param $output i32) (param $state i32)
    (local $i i32) (local $tap i32) (local $cursor i32) (local $histIndex i32)
    (local $sample f32) (local $filtered f32) (local $z1 f32) (local $z2 f32)
    (local $env f32) (local $magnitude f32) (local $coefficient f32)
    (local $compressed f32) (local $sum f32)

    (local.set $z1 (f32.load (local.get $state)))
    (local.set $z2 (f32.load offset=4 (local.get $state)))
    (local.set $env (f32.load offset=8 (local.get $state)))
    (local.set $cursor (i32.load offset=12 (local.get $state)))
    (local.set $i (i32.const 0))
    (block $done
      (loop $samples
        (br_if $done (i32.ge_u (local.get $i) (local.get $frames)))
        (local.set $sample
          (f32.load (i32.add (local.get $input) (i32.mul (local.get $i) (i32.const 4)))))
        (local.set $filtered
          (f32.add (f32.mul (f32.const 0.206572083826147) (local.get $sample))
            (local.get $z1)))
        (local.set $z1
          (f32.add
            (f32.sub (f32.mul (f32.const 0.413144167652294) (local.get $sample))
              (f32.mul (f32.const -0.369527377351241) (local.get $filtered)))
            (local.get $z2)))
        (local.set $z2
          (f32.sub (f32.mul (f32.const 0.206572083826147) (local.get $sample))
            (f32.mul (f32.const 0.195815712655833) (local.get $filtered))))
        (local.set $magnitude (f32.abs (local.get $filtered)))
        (local.set $coefficient
          (select (f32.const 0.9) (f32.const 0.9995)
            (f32.gt (local.get $magnitude) (local.get $env))))
        (local.set $env
          (f32.add (f32.mul (local.get $coefficient) (local.get $env))
            (f32.mul (f32.sub (f32.const 1) (local.get $coefficient))
              (local.get $magnitude))))
        (local.set $compressed
          (f32.mul (local.get $filtered) (call $compressor_gain (local.get $env))))
        (f32.store
          (i32.add (i32.add (local.get $state) (i32.const 16))
            (i32.mul (local.get $cursor) (i32.const 4)))
          (local.get $compressed))
        (local.set $sum (f32.const 0))
        (local.set $tap (i32.const 0))
        (local.set $histIndex (local.get $cursor))
        (block $taps_done
          (loop $taps
            (br_if $taps_done (i32.ge_u (local.get $tap) (local.get $irLen)))
            (local.set $sum
              (f32.add (local.get $sum)
                (f32.mul
                  (f32.load
                    (i32.add (i32.add (local.get $state) (i32.const 16))
                      (i32.mul (local.get $histIndex) (i32.const 4))))
                  (f32.load
                    (i32.add (local.get $ir) (i32.mul (local.get $tap) (i32.const 4)))))))
            (local.set $histIndex
              (select (i32.sub (local.get $irLen) (i32.const 1))
                (i32.sub (local.get $histIndex) (i32.const 1))
                (i32.eqz (local.get $histIndex))))
            (local.set $tap (i32.add (local.get $tap) (i32.const 1)))
            (br $taps)))
        (f32.store
          (i32.add (local.get $output) (i32.mul (local.get $i) (i32.const 4)))
          (local.get $sum))
        (local.set $cursor (i32.add (local.get $cursor) (i32.const 1)))
        (if (i32.eq (local.get $cursor) (local.get $irLen))
          (then (local.set $cursor (i32.const 0))))
        (local.set $i (i32.add (local.get $i) (i32.const 1)))
        (br $samples)))
    (f32.store (local.get $state) (local.get $z1))
    (f32.store offset=4 (local.get $state) (local.get $z2))
    (f32.store offset=8 (local.get $state) (local.get $env))
    (i32.store offset=12 (local.get $state) (local.get $cursor)))

  ;; The frozen tail flushes convolution with zeros without updating biquad/compressor state.
  (func (export "flush_tail")
    (param $frames i32) (param $ir i32) (param $irLen i32)
    (param $output i32) (param $state i32)
    (local $i i32) (local $tap i32) (local $cursor i32) (local $histIndex i32)
    (local $sum f32)
    (local.set $cursor (i32.load offset=12 (local.get $state)))
    (local.set $i (i32.const 0))
    (block $done
      (loop $samples
        (br_if $done (i32.ge_u (local.get $i) (local.get $frames)))
        (f32.store
          (i32.add (i32.add (local.get $state) (i32.const 16))
            (i32.mul (local.get $cursor) (i32.const 4)))
          (f32.const 0))
        (local.set $sum (f32.const 0))
        (local.set $tap (i32.const 0))
        (local.set $histIndex (local.get $cursor))
        (block $taps_done
          (loop $taps
            (br_if $taps_done (i32.ge_u (local.get $tap) (local.get $irLen)))
            (local.set $sum
              (f32.add (local.get $sum)
                (f32.mul
                  (f32.load
                    (i32.add (i32.add (local.get $state) (i32.const 16))
                      (i32.mul (local.get $histIndex) (i32.const 4))))
                  (f32.load
                    (i32.add (local.get $ir) (i32.mul (local.get $tap) (i32.const 4)))))))
            (local.set $histIndex
              (select (i32.sub (local.get $irLen) (i32.const 1))
                (i32.sub (local.get $histIndex) (i32.const 1))
                (i32.eqz (local.get $histIndex))))
            (local.set $tap (i32.add (local.get $tap) (i32.const 1)))
            (br $taps)))
        (f32.store
          (i32.add (local.get $output) (i32.mul (local.get $i) (i32.const 4)))
          (local.get $sum))
        (local.set $cursor (i32.add (local.get $cursor) (i32.const 1)))
        (if (i32.eq (local.get $cursor) (local.get $irLen))
          (then (local.set $cursor (i32.const 0))))
        (local.set $i (i32.add (local.get $i) (i32.const 1)))
        (br $samples)))
    (i32.store offset=12 (local.get $state) (local.get $cursor)))
)
