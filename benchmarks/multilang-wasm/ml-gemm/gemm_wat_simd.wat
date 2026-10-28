;; gemm_wat_simd.wat — Handwritten v128 SIMD i/k/j matrix multiplication kernel
(module
  (memory (export "memory") 4)
  ;; gemm(aOff, bOff, c0Off, outOff, M, N, K)
  (func (export "gemm") (param $aOff i32) (param $bOff i32) (param $c0Off i32) (param $outOff i32) (param $M i32) (param $N i32) (param $K i32)
    (local $i i32)
    (local $k i32)
    (local $j i32)
    (local $iOff i32)
    (local $kOff i32)
    (local $aik f32)
    (local $aikVec v128)
    (local $outAddr i32)
    (local $bAddr i32)

    ;; Copy c0 to out: 128*128*4 = 65536 bytes (4096 16-byte SIMD copies)
    (local.set $j (i32.const 0))
    (block $break_copy
      (loop $loop_copy
        local.get $j
        i32.const 65536
        i32.ge_u
        br_if $break_copy

        local.get $outOff
        local.get $j
        i32.add
        local.get $c0Off
        local.get $j
        i32.add
        v128.load
        v128.store

        local.get $j
        i32.const 16
        i32.add
        local.set $j
        br $loop_copy
      )
    )

    ;; Triple loop i / k / j (with j stepping by 4 using f32x4)
    (local.set $i (i32.const 0))
    (block $break_i
      (loop $loop_i
        local.get $i
        local.get $M
        i32.ge_s
        br_if $break_i

        local.get $i
        local.get $N
        i32.mul
        i32.const 2
        i32.shl
        local.set $iOff

        (local.set $k (i32.const 0))
        (block $break_k
          (loop $loop_k
            local.get $k
            local.get $K
            i32.ge_s
            br_if $break_k

            ;; aik = a[i * K + k]
            local.get $aOff
            local.get $i
            local.get $K
            i32.mul
            local.get $k
            i32.add
            i32.const 2
            i32.shl
            i32.add
            f32.load
            local.tee $aik
            f32x4.splat
            local.set $aikVec

            local.get $k
            local.get $N
            i32.mul
            i32.const 2
            i32.shl
            local.set $kOff

            (local.set $j (i32.const 0))
            (block $break_j
              (loop $loop_j
                local.get $j
                local.get $N
                i32.ge_s
                br_if $break_j

                local.get $outOff
                local.get $iOff
                i32.add
                local.get $j
                i32.const 2
                i32.shl
                i32.add
                local.tee $outAddr

                local.get $outAddr
                v128.load

                local.get $bOff
                local.get $kOff
                i32.add
                local.get $j
                i32.const 2
                i32.shl
                i32.add
                v128.load
                local.get $aikVec
                f32x4.mul

                f32x4.add
                v128.store

                local.get $j
                i32.const 4
                i32.add
                local.set $j
                br $loop_j
              )
            )

            local.get $k
            i32.const 1
            i32.add
            local.set $k
            br $loop_k
          )
        )

        local.get $i
        i32.const 1
        i32.add
        local.set $i
        br $loop_i
      )
    )
  )
)
