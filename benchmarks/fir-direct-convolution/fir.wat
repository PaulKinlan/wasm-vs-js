;; FIR direct-form convolution (NOT overlap-add)
;; Params: inPtr, inLen, tapPtr, tapLen, outPtr
(module
  (memory (export "memory") 256)
  (func (export "fir_direct") (param $inPtr i32) (param $inLen i32) (param $tapPtr i32) (param $tapLen i32) (param $outPtr i32)
    (local $i i32) (local $j i32) (local $sample f32) (local $off i32)
    (local $outLen i32)
    (local.set $outLen (i32.sub (i32.add (local.get $inLen) (local.get $tapLen)) (i32.const 1)))
    ;; Zero output
    (local.set $i (i32.const 0))
    (block $z_done (loop $z_loop local.get $i local.get $outLen i32.ge_u br_if $z_done
      (f32.store (i32.add (local.get $outPtr) (i32.mul (local.get $i) (i32.const 4))) (f32.const 0.0))
      (local.set $i (i32.add (local.get $i) (i32.const 1))) br $z_loop))
    ;; Convolution
    (local.set $i (i32.const 0))
    (block $c_done (loop $c_loop local.get $i local.get $inLen i32.ge_u br_if $c_done
      (local.set $sample (f32.load (i32.add (local.get $inPtr) (i32.mul (local.get $i) (i32.const 4)))))
      (local.set $j (i32.const 0))
      (block $t_done (loop $t_loop local.get $j local.get $tapLen i32.ge_u br_if $t_done
        (local.set $off (i32.mul (i32.add (local.get $i) (local.get $j)) (i32.const 4)))
        (f32.store (i32.add (local.get $outPtr) (local.get $off))
          (f32.add (f32.load (i32.add (local.get $outPtr) (local.get $off)))
            (f32.mul (local.get $sample) (f32.load (i32.add (local.get $tapPtr) (i32.mul (local.get $j) (i32.const 4)))))))
        (local.set $j (i32.add (local.get $j) (i32.const 1))) br $t_loop))
      (local.set $i (i32.add (local.get $i) (i32.const 1))) br $c_loop))))
