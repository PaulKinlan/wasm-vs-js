;; audio-fir: direct 256-tap convolution, increasing tap order
;; params: inPtr, inLen, tapPtr, tapLen, outPtr
(module
  (memory (export "memory") 1024)  ;; 64MB for 131072×4 + 256×4 + 131327×4 ≈ 1.05MB
  (func (export "fir_direct") (param $inPtr i32) (param $inLen i32) (param $tapPtr i32) (param $tapLen i32) (param $outPtr i32)
    (local $i i32) (local $j i32) (local $sample f32) (local $off i32) (local $outLen i32)
    (local.set $outLen (i32.sub (i32.add (local.get $inLen) (local.get $tapLen)) (i32.const 1)))
    ;; Zero output
    (local.set $i (i32.const 0))
    (block $zd (loop $zl local.get $i local.get $outLen i32.ge_u br_if $zd
      (f32.store (i32.add (local.get $outPtr) (i32.mul (local.get $i) (i32.const 4))) (f32.const 0.0))
      (local.set $i (i32.add (local.get $i) (i32.const 1))) br $zl))
    ;; Convolution: increasing tap order (j=0,1,...,tapLen-1)
    (local.set $i (i32.const 0))
    (block $cd (loop $cl local.get $i local.get $inLen i32.ge_u br_if $cd
      (local.set $sample (f32.load (i32.add (local.get $inPtr) (i32.mul (local.get $i) (i32.const 4)))))
      (local.set $j (i32.const 0))
      (block $td (loop $tl local.get $j local.get $tapLen i32.ge_u br_if $td
        (local.set $off (i32.mul (i32.add (local.get $i) (local.get $j)) (i32.const 4)))
        (f32.store (i32.add (local.get $outPtr) (local.get $off))
          (f32.add (f32.load (i32.add (local.get $outPtr) (local.get $off)))
            (f32.mul (local.get $sample) (f32.load (i32.add (local.get $tapPtr) (i32.mul (local.get $j) (i32.const 4)))))))
        (local.set $j (i32.add (local.get $j) (i32.const 1))) br $tl))
      (local.set $i (i32.add (local.get $i) (i32.const 1))) br $cl))))
