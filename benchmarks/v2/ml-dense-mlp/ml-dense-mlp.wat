(module
  (memory (export "memory") 160)

  ;; Frozen f64 exponential for the GELU tanh: round-to-nearest range
  ;; reduction by ln2, degree-12 Taylor polynomial, exponent-bit scaling.
  ;; Accurate domain |x| <= ~708.4 (worst relative error 8e-14, swept in
  ;; tests); the full reachable domain from $tanh_f64 is |x| < 18.022.
  ;; Outside the accurate domain: x > 709.7827 returns +Infinity and
  ;; x < -708.39 returns 0 (absolute error below 2e-308); neither guard is
  ;; reachable through $tanh_f64's +-9.011 saturation. NaN input traps via
  ;; i32.trunc_f64_s -- the contract's NaN policy is reject-at-validation
  ;; with finite generator fixtures, so this is unreachable in-contract; the
  ;; JavaScript target propagates NaN to validation instead, an observable
  ;; failure-mode difference on out-of-contract inputs.
  (func $exp_f64 (export "exp_f64") (param $x f64) (result f64)
    (local $k f64) (local $r f64) (local $p f64)
    (if (f64.ne (local.get $x) (local.get $x)) (then (return (f64.const nan))))
    (if (f64.gt (local.get $x) (f64.const 709.7827)) (then (return (f64.const inf))))
    (if (f64.lt (local.get $x) (f64.const -708.39)) (then (return (f64.const 0))))
    (local.set $k (f64.nearest (f64.mul (local.get $x) (f64.const 1.4426950408889634))))
    (local.set $r
      (f64.sub
        (local.get $x)
        (f64.mul (local.get $k) (f64.const 0.6931471805599453))))
    (local.set $p (f64.const 2.08767569878681e-09))
    (local.set $p (f64.add (f64.mul (local.get $p) (local.get $r)) (f64.const 2.505210838544172e-08)))
    (local.set $p (f64.add (f64.mul (local.get $p) (local.get $r)) (f64.const 2.755731922398589e-07)))
    (local.set $p (f64.add (f64.mul (local.get $p) (local.get $r)) (f64.const 2.7557319223985893e-06)))
    (local.set $p (f64.add (f64.mul (local.get $p) (local.get $r)) (f64.const 2.48015873015873e-05)))
    (local.set $p (f64.add (f64.mul (local.get $p) (local.get $r)) (f64.const 0.0001984126984126984)))
    (local.set $p (f64.add (f64.mul (local.get $p) (local.get $r)) (f64.const 0.001388888888888889)))
    (local.set $p (f64.add (f64.mul (local.get $p) (local.get $r)) (f64.const 0.008333333333333333)))
    (local.set $p (f64.add (f64.mul (local.get $p) (local.get $r)) (f64.const 0.041666666666666664)))
    (local.set $p (f64.add (f64.mul (local.get $p) (local.get $r)) (f64.const 0.16666666666666666)))
    (local.set $p (f64.add (f64.mul (local.get $p) (local.get $r)) (f64.const 0.5)))
    (local.set $p (f64.add (f64.mul (local.get $p) (local.get $r)) (f64.const 1)))
    (local.set $p (f64.add (f64.mul (local.get $p) (local.get $r)) (f64.const 1)))
    (f64.mul
      (local.get $p)
      (f64.reinterpret_i64
        (i64.shl
          (i64.extend_i32_u
            (i32.add (i32.trunc_f64_s (local.get $k)) (i32.const 1023)))
          (i64.const 52)))))

  ;; Frozen f64 hyperbolic tangent: identical algorithm and IEEE 754
  ;; operation order to benchmarks/v2/ml-dense-mlp/frozen-transcendentals.js,
  ;; so both controlled targets are bit-identical for every finite input.
  ;; NaN propagates through $exp_f64's NaN guard (never traps): the
  ;; contract's reject policy is enforced by validation, not by the kernel.
  (func $tanh_f64 (export "tanh_f64") (param $x f64) (result f64)
    (if (f64.ge (local.get $x) (f64.const 9.011)) (then (return (f64.const 1))))
    (if (f64.le (local.get $x) (f64.const -9.011)) (then (return (f64.const -1))))
    (f64.sub
      (f64.const 1)
      (f64.div
        (f64.const 2)
        (f64.add
          (call $exp_f64 (f64.mul (f64.const 2) (local.get $x)))
          (f64.const 1)))))

  ;; Strict f32 linear layer, left-to-right from the bias, +0 signed-zero
  ;; normalization on store. y[bi][o] = bias[o] + sum_i x[bi][i] * W[i][o].
  (func (export "linear_f32")
    (param $x i32) (param $w i32) (param $bias i32) (param $y i32)
    (param $batch i32) (param $width i32)
    (local $bi i32) (local $o i32) (local $i i32)
    (local $acc f32)
    (local $xRow i32) (local $yRow i32) (local $wPtr i32)
    (local.set $xRow (local.get $x))
    (local.set $yRow (local.get $y))
    (block $biDone
      (loop $biLoop
        (br_if $biDone (i32.ge_u (local.get $bi) (local.get $batch)))
        (local.set $o (i32.const 0))
        (block $oDone
          (loop $oLoop
            (br_if $oDone (i32.ge_u (local.get $o) (local.get $width)))
            (local.set $acc
              (f32.load (i32.add (local.get $bias) (i32.mul (local.get $o) (i32.const 4)))))
            (local.set $i (i32.const 0))
            (local.set $wPtr (i32.add (local.get $w) (i32.mul (local.get $o) (i32.const 4))))
            (block $iDone
              (loop $iLoop
                (br_if $iDone (i32.ge_u (local.get $i) (local.get $width)))
                (local.set $acc
                  (f32.add
                    (local.get $acc)
                    (f32.mul
                      (f32.load (i32.add (local.get $xRow) (i32.mul (local.get $i) (i32.const 4))))
                      (f32.load (local.get $wPtr)))))
                (local.set $wPtr (i32.add (local.get $wPtr) (i32.mul (local.get $width) (i32.const 4))))
                (local.set $i (i32.add (local.get $i) (i32.const 1)))
                (br $iLoop)))
            (f32.store
              (i32.add (local.get $yRow) (i32.mul (local.get $o) (i32.const 4)))
              (f32.add (local.get $acc) (f32.const 0)))
            (local.set $o (i32.add (local.get $o) (i32.const 1)))
            (br $oLoop)))
        (local.set $xRow (i32.add (local.get $xRow) (i32.mul (local.get $width) (i32.const 4))))
        (local.set $yRow (i32.add (local.get $yRow) (i32.mul (local.get $width) (i32.const 4))))
        (local.set $bi (i32.add (local.get $bi) (i32.const 1)))
        (br $biLoop))))

  ;; In-place frozen GELU-tanh: promote f32 to f64, apply
  ;; 0.5*p*(1+tanh(0.7978845608028654*(p+0.044715*p^3))), round once on store
  ;; with +0 signed-zero normalization.
  (func (export "gelu_f32")
    (param $ptr i32) (param $len i32)
    (local $index i32) (local $addr i32) (local $p f64) (local $g f64)
    (block $done
      (loop $next
        (br_if $done (i32.ge_u (local.get $index) (local.get $len)))
        (local.set $addr
          (i32.add (local.get $ptr) (i32.mul (local.get $index) (i32.const 4))))
        (local.set $p (f64.promote_f32 (f32.load (local.get $addr))))
        (local.set $g
          (f64.mul
            (f64.mul (f64.const 0.5) (local.get $p))
            (f64.add
              (f64.const 1)
              (call $tanh_f64
                (f64.mul
                  (f64.const 0.7978845608028654)
                  (f64.add
                    (local.get $p)
                    (f64.mul
                      (f64.const 0.044715)
                      (f64.mul (f64.mul (local.get $p) (local.get $p)) (local.get $p)))))))))
        (f32.store (local.get $addr) (f32.add (f32.demote_f64 (local.get $g)) (f32.const 0)))
        (local.set $index (i32.add (local.get $index) (i32.const 1)))
        (br $next))))
)
