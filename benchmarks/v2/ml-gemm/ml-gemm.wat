(module
  (memory (export "memory") 256)

  ;; One row-major NN matrix product, strict f32 left-to-right accumulation in
  ;; frozen ascending i/j/k order. C is preallocated and preloaded with the
  ;; initial C0 values; the kernel reads acc = C[i][j], accumulates, and stores
  ;; back with a +0 signed-zero normalization. One call per matrix product,
  ;; per the ml.gemm.v1 controlled-track contract.
  (func (export "gemm_f32")
    (param $a i32) (param $b i32) (param $c i32)
    (param $m i32) (param $n i32) (param $k i32)
    (local $i i32) (local $j i32) (local $kk i32)
    (local $acc f32)
    (local $aRow i32) (local $cRow i32) (local $bPtr i32) (local $cPtr i32)
    (local.set $aRow (local.get $a))
    (local.set $cRow (local.get $c))
    (block $iDone
      (loop $iLoop
        (br_if $iDone (i32.ge_u (local.get $i) (local.get $m)))
        (local.set $j (i32.const 0))
        (block $jDone
          (loop $jLoop
            (br_if $jDone (i32.ge_u (local.get $j) (local.get $n)))
            (local.set $cPtr (i32.add (local.get $cRow) (i32.mul (local.get $j) (i32.const 4))))
            (local.set $acc (f32.load (local.get $cPtr)))
            (local.set $kk (i32.const 0))
            (local.set $bPtr (i32.add (local.get $b) (i32.mul (local.get $j) (i32.const 4))))
            (block $kDone
              (loop $kLoop
                (br_if $kDone (i32.ge_u (local.get $kk) (local.get $k)))
                (local.set $acc
                  (f32.add
                    (local.get $acc)
                    (f32.mul
                      (f32.load (i32.add (local.get $aRow) (i32.mul (local.get $kk) (i32.const 4))))
                      (f32.load (local.get $bPtr)))))
                (local.set $bPtr (i32.add (local.get $bPtr) (i32.mul (local.get $n) (i32.const 4))))
                (local.set $kk (i32.add (local.get $kk) (i32.const 1)))
                (br $kLoop)))
            (f32.store (local.get $cPtr) (f32.add (local.get $acc) (f32.const 0)))
            (local.set $j (i32.add (local.get $j) (i32.const 1)))
            (br $jLoop)))
        (local.set $aRow (i32.add (local.get $aRow) (i32.mul (local.get $k) (i32.const 4))))
        (local.set $cRow (i32.add (local.get $cRow) (i32.mul (local.get $n) (i32.const 4))))
        (local.set $i (i32.add (local.get $i) (i32.const 1)))
        (br $iLoop)))))
