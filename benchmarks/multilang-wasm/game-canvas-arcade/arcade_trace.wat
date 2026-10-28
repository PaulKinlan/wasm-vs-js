;; game.canvas-arcade.v1 — kernel: arcade_trace
;; WebAssembly Text (WAT) baseline implementation
;; Exports: arcade_trace

(module $arcade_kernel_c.wasm
  (type $t0 (func))
  (type $t1 (func (param i32) (result i32)))
  (func $__wasm_call_ctors (type $t0))
  (func $arcade_trace (type $t1) (param $p0 i32) (result i32)
    (local $l1 i32) (local $l2 i32) (local $l3 i32) (local $l4 i32) (local $l5 i32) (local $l6 i32) (local $l7 i32) (local $l8 i32) (local $l9 i32) (local $l10 i32) (local $l11 i32) (local $l12 i32) (local $l13 i32) (local $l14 i32) (local $l15 i32) (local $l16 i32) (local $l17 i32) (local $l18 i32) (local $l19 i32)
    block $B0
      local.get $p0
      i32.const 14424
      i32.eq
      br_if $B0
      i32.const 1
      return
    end
    i32.const 0
    local.set $l1
    block $B1
      i32.const 0
      i32.load8_u offset=65537
      i32.const 8
      i32.shl
      i32.const 0
      i32.load8_u offset=65536
      i32.or
      i32.const 0
      i32.load8_u offset=65538
      i32.const 16
      i32.shl
      i32.or
      i32.const 0
      i32.load8_u offset=65539
      i32.const 24
      i32.shl
      i32.or
      i32.const 3600
      i32.eq
      br_if $B1
      i32.const 2
      return
    end
    i32.const 640
    local.set $l2
    i32.const 600
    local.set $l3
    i32.const 608135816
    local.set $l4
    i32.const -1640531527
    local.set $l5
    i32.const 1419889127
    local.set $l6
    i32.const 0
    local.set $l7
    i32.const 0
    local.set $l8
    i32.const 0
    local.set $l9
    i32.const 0
    local.set $l10
    i32.const 0
    local.set $l11
    i32.const 3
    local.set $l12
    i32.const 0
    local.set $l13
    loop $L2
      i32.const 0
      local.set $p0
      local.get $l2
      i32.const 1280
      i32.add
      local.tee $l14
      local.get $l7
      i32.const 2
      i32.shl
      local.tee $l15
      i32.load8_u offset=65560
      local.tee $l16
      i32.const 30
      i32.shl
      i32.const 31
      i32.shr_s
      i32.const 7
      i32.and
      local.tee $l17
      i32.const 0
      local.get $l16
      i32.const 1
      i32.and
      i32.sub
      i32.const -7
      i32.and
      local.tee $l2
      i32.add
      i32.add
      local.get $l16
      i32.const 28
      i32.shl
      i32.const 31
      i32.shr_s
      i32.const 5
      i32.and
      local.get $l3
      i32.add
      local.get $l16
      i32.const 29
      i32.shl
      i32.const 31
      i32.shr_s
      i32.const -5
      i32.and
      i32.add
      local.tee $l3
      i32.const 0
      local.get $l3
      i32.const 0
      i32.gt_s
      select
      local.tee $l3
      i32.const 719
      local.get $l3
      i32.const 719
      i32.lt_s
      select
      local.tee $l3
      i32.add
      local.get $l14
      local.get $l2
      i32.add
      local.get $l17
      i32.add
      local.tee $l17
      i32.const 1280
      i32.div_u
      i32.const 1280
      i32.mul
      i32.sub
      local.set $l14
      local.get $l1
      local.get $l15
      i32.load8_u offset=65563
      i32.const 24
      i32.shl
      i32.add
      local.get $l15
      i32.load8_u offset=65562
      i32.const 16
      i32.shl
      i32.add
      local.get $l15
      i32.load8_u offset=65561
      local.tee $l18
      i32.const 8
      i32.shl
      i32.add
      local.get $l16
      i32.add
      local.set $l16
      local.get $l17
      i32.const 1280
      i32.rem_u
      local.set $l2
      local.get $l18
      i32.const 31
      i32.and
      local.tee $l19
      i32.const 32
      i32.or
      local.set $l17
      local.get $l5
      i32.const 16777619
      i32.mul
      local.get $l7
      i32.xor
      i32.const 16777619
      i32.mul
      i32.const 83886800
      i32.xor
      i32.const 16777619
      i32.mul
      local.set $l15
      loop $L3
        local.get $l16
        local.get $l6
        i32.xor
        i32.const 16777619
        i32.mul
        local.get $l14
        local.get $p0
        i32.add
        i32.xor
        i32.const 16777619
        i32.mul
        local.tee $l6
        local.get $l15
        i32.const 2
        i32.xor
        i32.const 16777619
        i32.mul
        local.get $l7
        i32.xor
        i32.const 16777619
        i32.mul
        local.get $p0
        i32.xor
        i32.const 16777619
        i32.mul
        i32.xor
        local.set $l15
        block $B4
          local.get $l6
          i32.const 2047
          i32.and
          br_if $B4
          local.get $l8
          i32.const 1
          i32.add
          local.set $l8
          local.get $l13
          i32.const 10
          i32.add
          local.set $l13
          local.get $l4
          i32.const 1
          i32.xor
          i32.const 16777619
          i32.mul
          local.get $l7
          i32.xor
          i32.const 16777619
          i32.mul
          local.get $p0
          i32.xor
          i32.const 16777619
          i32.mul
          local.set $l4
        end
        local.get $l16
        i32.const 17
        i32.add
        local.set $l16
        local.get $l15
        i32.const 16777619
        i32.mul
        local.set $l15
        local.get $l17
        local.get $p0
        i32.const 1
        i32.add
        local.tee $p0
        i32.ne
        br_if $L3
      end
      local.get $l9
      local.get $l19
      i32.add
      local.set $p0
      local.get $l10
      local.get $l19
      i32.add
      local.set $l16
      local.get $l11
      local.get $l19
      i32.add
      local.set $l14
      local.get $l15
      i32.const 1
      i32.xor
      i32.const 16777619
      i32.mul
      local.get $l7
      i32.xor
      i32.const 16777619
      i32.mul
      local.get $l2
      i32.xor
      i32.const 16777619
      i32.mul
      local.get $l3
      i32.xor
      i32.const 16777619
      i32.mul
      i32.const 3
      i32.xor
      i32.const 16777619
      i32.mul
      local.get $l13
      i32.xor
      i32.const 16777619
      i32.mul
      local.get $l12
      i32.xor
      local.set $l15
      block $B5
        local.get $l12
        i32.eqz
        br_if $B5
        local.get $l18
        i32.const 255
        i32.ne
        br_if $B5
        local.get $l4
        i32.const 2
        i32.xor
        i32.const 16777619
        i32.mul
        local.get $l7
        i32.xor
        i32.const 16777619
        i32.mul
        local.get $l12
        i32.const -1
        i32.add
        local.tee $l12
        i32.xor
        i32.const 16777619
        i32.mul
        local.set $l4
        local.get $l8
        i32.const 1
        i32.add
        local.set $l8
      end
      local.get $p0
      i32.const 35
      i32.add
      local.set $l9
      local.get $l16
      i32.const 32
      i32.add
      local.set $l10
      local.get $l14
      i32.const 32
      i32.add
      local.set $l11
      local.get $l15
      i32.const 16777619
      i32.mul
      local.set $l5
      local.get $l1
      i32.const 131
      i32.add
      local.set $l1
      local.get $l13
      local.get $l3
      i32.const 11
      i32.shl
      local.get $l2
      i32.or
      i32.xor
      local.get $l6
      i32.xor
      local.get $l12
      i32.xor
      i32.const 16777619
      i32.mul
      local.set $l6
      local.get $l7
      i32.const 1
      i32.add
      local.tee $l7
      i32.const 3600
      i32.ne
      br_if $L2
    end
    i32.const 0
    local.get $l6
    local.get $l5
    i32.xor
    i32.const 16777619
    i32.mul
    local.get $l4
    i32.xor
    i32.const 16777619
    i32.mul
    i32.store offset=131072
    i32.const 0
    local.get $l6
    i32.store offset=131076
    i32.const 0
    local.get $l5
    i32.store offset=131080
    i32.const 0
    local.get $l4
    i32.store offset=131084
    i32.const 0
    local.get $l11
    i32.store offset=131088
    i32.const 0
    local.get $l10
    i32.store offset=131092
    i32.const 0
    local.get $l9
    i32.store offset=131096
    i32.const 0
    local.get $l8
    i32.store offset=131100
    i32.const 0)
  (table $__indirect_function_table 1 1 funcref)
  (memory $memory 3)
  (global $__stack_pointer (mut i32) (i32.const 65536))
  (global $__dso_handle i32 (i32.const 65536))
  (global $__data_end i32 (i32.const 65536))
  (global $__stack_low i32 (i32.const 0))
  (global $__stack_high i32 (i32.const 65536))
  (global $__global_base i32 (i32.const 65536))
  (global $__heap_base i32 (i32.const 65536))
  (global $__heap_end i32 (i32.const 196608))
  (global $__memory_base i32 (i32.const 0))
  (global $__table_base i32 (i32.const 1))
  (global $__wasm_first_page_end i32 (i32.const 65536))
  (export "memory" (memory $memory))
  (export "__wasm_call_ctors" (func $__wasm_call_ctors))
  (export "__stack_pointer" (global $__stack_pointer))
  (export "arcade_trace" (func $arcade_trace))
  (export "__indirect_function_table" (table $__indirect_function_table))
  (export "__dso_handle" (global $__dso_handle))
  (export "__data_end" (global $__data_end))
  (export "__stack_low" (global $__stack_low))
  (export "__stack_high" (global $__stack_high))
  (export "__global_base" (global $__global_base))
  (export "__heap_base" (global $__heap_base))
  (export "__heap_end" (global $__heap_end))
  (export "__memory_base" (global $__memory_base))
  (export "__table_base" (global $__table_base))
  (export "__wasm_first_page_end" (global $__wasm_first_page_end)))
