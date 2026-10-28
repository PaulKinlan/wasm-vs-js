;; sum-u32-simd.wat — Handwritten v128 SIMD WebAssembly kernel for sum-u32
(module
  (memory (export "memory") 4)
  (func (export "sum_u32") (param $ptr i32) (param $len i32) (result i32)
    (local $i i32)
    (local $vec v128)
    (local $sum i32)
    (local $limit i32)

    ;; vec = (0, 0, 0, 0)
    (local.set $vec (v128.const i32x4 0 0 0 0))
    (local.set $i (i32.const 0))

    ;; limit = len - (len % 4)
    local.get $len
    local.get $len
    i32.const 3
    i32.and
    i32.sub
    local.set $limit

    ;; 4-way SIMD loop
    (block $break_simd
      (loop $loop_simd
        local.get $i
        local.get $limit
        i32.ge_u
        br_if $break_simd

        local.get $vec
        local.get $ptr
        local.get $i
        i32.const 2
        i32.shl
        i32.add
        v128.load
        i32x4.add
        local.set $vec

        local.get $i
        i32.const 4
        i32.add
        local.set $i
        br $loop_simd
      )
    )

    ;; Horizontal reduction of vec (lane0 + lane1 + lane2 + lane3)
    local.get $vec
    i32x4.extract_lane 0
    local.get $vec
    i32x4.extract_lane 1
    i32.add
    local.get $vec
    i32x4.extract_lane 2
    i32.add
    local.get $vec
    i32x4.extract_lane 3
    i32.add
    local.set $sum

    ;; Remainder loop
    (block $break_rem
      (loop $loop_rem
        local.get $i
        local.get $len
        i32.ge_u
        br_if $break_rem

        local.get $sum
        local.get $ptr
        local.get $i
        i32.const 2
        i32.shl
        i32.add
        i32.load
        i32.add
        local.set $sum

        local.get $i
        i32.const 1
        i32.add
        local.set $i
        br $loop_rem
      )
    )

    local.get $sum
  )
)
