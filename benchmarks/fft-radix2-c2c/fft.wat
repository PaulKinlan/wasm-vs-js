;; FFT radix-2 using frozen twiddle table (no trig in butterfly loop)
;; Layout: data at ptr (2N f32 complex interleaved), twiddle at twPtr
;; Params: ptr, n, twPtr
(module
  (memory (export "memory") 64)
  (func (export "fft_radix2") (param $ptr i32) (param $n i32) (param $twPtr i32)
    (local $i i32) (local $j i32) (local $bit i32)
    (local $len i32) (local $halfLen i32)
    (local $twIdx i32) (local $tw i32)
    (local $evenRe f32) (local $evenIm f32) (local $oddRe f32) (local $oddIm f32)
    (local $tRe f32) (local $ti f32) (local $wCos f32) (local $wSin f32)
    (local $off1 i32) (local $off2 i32)

    ;; Bit reversal
    (local.set $i (i32.const 1))
    (local.set $j (i32.const 0))
    (block $br_done (loop $br_loop
      local.get $i local.get $n i32.ge_u br_if $br_done
      (local.set $bit (i32.shr_u (local.get $n) (i32.const 1)))
      (block $bit_done (loop $bit_loop
        local.get $j local.get $bit i32.and i32.eqz br_if $bit_done
        (local.set $j (i32.xor (local.get $j) (local.get $bit)))
        (local.set $bit (i32.shr_u (local.get $bit) (i32.const 1)))
        br $bit_loop))
      (local.set $j (i32.xor (local.get $j) (local.get $bit)))
      local.get $i local.get $j i32.lt_u
      (if (then
        (local.set $off1 (i32.mul (local.get $i) (i32.const 8)))
        (local.set $off2 (i32.mul (local.get $j) (i32.const 8)))
        (local.set $evenRe (f32.load (i32.add (local.get $ptr) (local.get $off1))))
        (f32.store (i32.add (local.get $ptr) (local.get $off1)) (f32.load (i32.add (local.get $ptr) (local.get $off2))))
        (f32.store (i32.add (local.get $ptr) (local.get $off2)) (local.get $evenRe))
        (local.set $off1 (i32.add (local.get $off1) (i32.const 4)))
        (local.set $off2 (i32.add (local.get $off2) (i32.const 4)))
        (local.set $evenRe (f32.load (i32.add (local.get $ptr) (local.get $off1))))
        (f32.store (i32.add (local.get $ptr) (local.get $off1)) (f32.load (i32.add (local.get $ptr) (local.get $off2))))
        (f32.store (i32.add (local.get $ptr) (local.get $off2)) (local.get $evenRe))))
      (local.set $i (i32.add (local.get $i) (i32.const 1)))
      br $br_loop))

    ;; Butterfly stages using frozen twiddle table
    (local.set $len (i32.const 2))
    (local.set $twIdx (local.get $twPtr))
    (block $stage_done (loop $stage_loop
      local.get $len local.get $n i32.gt_u br_if $stage_done
      (local.set $halfLen (i32.shr_u (local.get $len) (i32.const 1)))
      (local.set $i (i32.const 0))
      (block $i_done (loop $i_loop
        local.get $i local.get $n i32.ge_u br_if $i_done
        (local.set $tw (local.get $twIdx))
        (local.set $j (i32.const 0))
        (block $j_done (loop $j_loop
          local.get $j local.get $halfLen i32.ge_u br_if $j_done
          (local.set $wCos (f32.load (local.get $tw)))
          (local.set $wSin (f32.load (i32.add (local.get $tw) (i32.const 4))))
          (local.set $tw (i32.add (local.get $tw) (i32.const 8)))
          (local.set $off1 (i32.mul (i32.add (local.get $i) (local.get $j)) (i32.const 8)))
          (local.set $off2 (i32.mul (i32.add (i32.add (local.get $i) (local.get $j)) (local.get $halfLen)) (i32.const 8)))
          (local.set $evenRe (f32.load (i32.add (local.get $ptr) (local.get $off1))))
          (local.set $evenIm (f32.load (i32.add (local.get $ptr) (i32.add (local.get $off1) (i32.const 4)))))
          (local.set $oddRe (f32.load (i32.add (local.get $ptr) (local.get $off2))))
          (local.set $oddIm (f32.load (i32.add (local.get $ptr) (i32.add (local.get $off2) (i32.const 4)))))
          (local.set $tRe (f32.sub (f32.mul (local.get $wCos) (local.get $oddRe)) (f32.mul (local.get $wSin) (local.get $oddIm))))
          (local.set $ti (f32.add (f32.mul (local.get $wCos) (local.get $oddIm)) (f32.mul (local.get $wSin) (local.get $oddRe))))
          (f32.store (i32.add (local.get $ptr) (local.get $off1)) (f32.add (local.get $evenRe) (local.get $tRe)))
          (f32.store (i32.add (local.get $ptr) (i32.add (local.get $off1) (i32.const 4))) (f32.add (local.get $evenIm) (local.get $ti)))
          (f32.store (i32.add (local.get $ptr) (local.get $off2)) (f32.sub (local.get $evenRe) (local.get $tRe)))
          (f32.store (i32.add (local.get $ptr) (i32.add (local.get $off2) (i32.const 4))) (f32.sub (local.get $evenIm) (local.get $ti)))
          (local.set $j (i32.add (local.get $j) (i32.const 1)))
          br $j_loop))
        (local.set $i (i32.add (local.get $i) (local.get $len)))
        br $i_loop))
      (local.set $twIdx (i32.add (local.get $twIdx) (i32.mul (local.get $halfLen) (i32.const 8))))
      (local.set $len (i32.shl (local.get $len) (i32.const 1)))
      br $stage_loop))))
