;; dom.nested-tree-mutation.v1 — kernel: nested_tree_trace
;; WebAssembly Text (WAT) baseline implementation
;; Exports: nested_tree_trace

(module $nested_tree_kernel_c.wasm
  (type $t0 (func))
  (type $t1 (func (result i32)))
  (func $__wasm_call_ctors (type $t0))
  (func $nested_tree_trace (type $t1) (result i32)
    (local $l0 i32) (local $l1 i32) (local $l2 i32) (local $l3 i32) (local $l4 i32) (local $l5 i32) (local $l6 i32) (local $l7 i32) (local $l8 i32) (local $l9 i32)
    global.get $__stack_pointer
    i32.const 8000
    i32.sub
    local.tee $l0
    global.set $__stack_pointer
    i32.const 0
    local.set $l1
    loop $L0
      local.get $l0
      local.get $l1
      i32.add
      local.tee $l2
      i64.const -4294967298
      i64.store
      local.get $l2
      i32.const 24
      i32.add
      i64.const -4294967298
      i64.store
      local.get $l2
      i32.const 16
      i32.add
      i64.const -4294967298
      i64.store
      local.get $l2
      i32.const 8
      i32.add
      i64.const -4294967298
      i64.store
      local.get $l1
      i32.const 32
      i32.add
      local.tee $l1
      i32.const 8000
      i32.ne
      br_if $L0
    end
    local.get $l0
    i32.const -1
    i32.store
    local.get $l0
    i32.const 8
    i32.or
    local.set $l1
    i32.const 2
    local.set $l2
    loop $L1 (result i32)
      local.get $l1
      i32.const -4
      i32.add
      local.get $l2
      i32.const -2
      i32.add
      i32.const 65535
      i32.and
      i32.const 3
      i32.div_u
      i32.store
      block $B2
        local.get $l2
        i32.const 500
        i32.ne
        br_if $B2
        i32.const 1584363400
        local.set $l2
        i32.const 0
        local.set $l3
        i32.const 500
        local.set $l4
        i32.const 2000
        local.set $l5
        i32.const 0
        local.set $l6
        loop $L3
          local.get $l2
          i32.const 13
          i32.shl
          local.get $l2
          i32.xor
          local.tee $l2
          i32.const 17
          i32.shr_s
          local.get $l2
          i32.xor
          local.tee $l2
          i32.const 5
          i32.shl
          local.get $l2
          i32.xor
          local.tee $l2
          i32.const 13
          i32.shl
          local.get $l2
          i32.xor
          local.tee $l1
          i32.const 17
          i32.shr_s
          local.get $l1
          i32.xor
          local.tee $l1
          i32.const 5
          i32.shl
          local.get $l1
          i32.xor
          local.tee $l1
          i32.const 13
          i32.shl
          local.get $l1
          i32.xor
          local.tee $l7
          i32.const 17
          i32.shr_s
          local.get $l7
          i32.xor
          local.tee $l7
          i32.const 5
          i32.shl
          local.get $l7
          i32.xor
          local.tee $l7
          i32.const 13
          i32.shl
          local.get $l7
          i32.xor
          local.tee $l8
          i32.const 17
          i32.shr_s
          local.get $l8
          i32.xor
          local.tee $l8
          i32.const 5
          i32.shl
          local.get $l8
          i32.xor
          local.tee $l8
          i32.const 13
          i32.shl
          local.get $l8
          i32.xor
          local.tee $l8
          i32.const 17
          i32.shr_s
          local.get $l8
          i32.xor
          local.tee $l8
          i32.const 5
          i32.shl
          local.set $l9
          local.get $l7
          f64.convert_i32_u
          f64.const 0x1p-32 (;=2.32831e-10;)
          f64.mul
          f64.const 0x1.9p+8 (;=400;)
          f64.mul
          i32.trunc_sat_f64_u
          local.set $l7
          local.get $l1
          f64.convert_i32_u
          f64.const 0x1p-32 (;=2.32831e-10;)
          f64.mul
          f64.const 0x1.9p+8 (;=400;)
          f64.mul
          i32.trunc_sat_f64_u
          local.set $l1
          block $B4
            block $B5
              block $B6
                block $B7
                  block $B8
                    block $B9
                      local.get $l2
                      f64.convert_i32_u
                      f64.const 0x1p-32 (;=2.32831e-10;)
                      f64.mul
                      f64.const 0x1.4p+2 (;=5;)
                      f64.mul
                      i32.trunc_sat_f64_u
                      br_table $B9 $B8 $B7 $B6 $B5 $B4
                    end
                    local.get $l7
                    i32.const 1999
                    i32.gt_u
                    br_if $B4
                    local.get $l0
                    local.get $l7
                    i32.const 2
                    i32.shl
                    i32.add
                    i32.load
                    i32.const -2
                    i32.eq
                    br_if $B4
                    local.get $l0
                    local.get $l5
                    i32.add
                    local.tee $l2
                    i32.load
                    i32.const -2
                    i32.ne
                    br_if $B4
                    local.get $l2
                    local.get $l7
                    i32.store
                    local.get $l3
                    i32.const 1
                    i32.add
                    local.set $l3
                    local.get $l4
                    i32.const 1
                    i32.add
                    local.set $l4
                    br $B4
                  end
                  local.get $l1
                  i32.const -1
                  i32.add
                  i32.const 1998
                  i32.gt_u
                  br_if $B4
                  local.get $l0
                  local.get $l1
                  i32.const 2
                  i32.shl
                  i32.add
                  local.tee $l2
                  i32.load
                  i32.const -2
                  i32.eq
                  br_if $B4
                  local.get $l2
                  i32.const -2
                  i32.store
                  local.get $l3
                  i32.const 1
                  i32.add
                  local.set $l3
                  local.get $l4
                  i32.const -1
                  i32.add
                  local.set $l4
                  br $B4
                end
                local.get $l1
                i32.const -1
                i32.add
                i32.const 1998
                i32.gt_u
                br_if $B4
                local.get $l0
                local.get $l1
                i32.const 2
                i32.shl
                i32.add
                local.tee $l2
                i32.load
                i32.const -2
                i32.eq
                br_if $B4
                local.get $l7
                i32.const 1999
                i32.gt_u
                br_if $B4
                local.get $l0
                local.get $l7
                i32.const 2
                i32.shl
                i32.add
                i32.load
                i32.const -2
                i32.eq
                br_if $B4
                local.get $l1
                local.get $l7
                i32.eq
                br_if $B4
                local.get $l2
                local.get $l7
                i32.store
                local.get $l3
                i32.const 1
                i32.add
                local.set $l3
                br $B4
              end
              local.get $l1
              i32.const 1999
              i32.gt_u
              br_if $B4
              local.get $l6
              local.get $l0
              local.get $l1
              i32.const 2
              i32.shl
              i32.add
              i32.load
              i32.const -2
              i32.ne
              i32.add
              local.set $l6
              br $B4
            end
            local.get $l1
            i32.const -1
            i32.add
            i32.const 1998
            i32.gt_u
            br_if $B4
            local.get $l3
            local.get $l0
            local.get $l1
            i32.const 2
            i32.shl
            i32.add
            i32.load
            i32.const -2
            i32.ne
            i32.add
            local.set $l3
          end
          local.get $l9
          local.get $l8
          i32.xor
          local.set $l2
          local.get $l5
          i32.const 4
          i32.add
          local.tee $l5
          i32.const 6800
          i32.ne
          br_if $L3
        end
        local.get $l0
        local.set $l2
        i32.const 0
        local.set $l1
        i32.const 0
        local.set $l7
        loop $L10
          i32.const 0
          local.get $l1
          i32.const 3
          i32.add
          local.get $l2
          i32.const 12
          i32.add
          i32.load
          i32.const -2
          i32.eq
          select
          i32.const 0
          local.get $l1
          i32.const 2
          i32.add
          local.get $l2
          i32.const 8
          i32.add
          i32.load
          i32.const -2
          i32.eq
          select
          i32.const 0
          local.get $l1
          i32.const 1
          i32.add
          local.get $l2
          i32.const 4
          i32.add
          i32.load
          i32.const -2
          i32.eq
          select
          i32.const 0
          local.get $l1
          local.get $l2
          i32.load
          i32.const -2
          i32.eq
          select
          local.get $l7
          i32.add
          i32.add
          i32.add
          i32.add
          local.set $l7
          local.get $l2
          i32.const 16
          i32.add
          local.set $l2
          local.get $l1
          i32.const 4
          i32.add
          local.tee $l1
          i32.const 2000
          i32.ne
          br_if $L10
        end
        i32.const 0
        local.get $l3
        i32.store offset=16384
        i32.const 0
        local.get $l6
        i32.store offset=16388
        i32.const 0
        local.get $l4
        i32.store offset=16392
        i32.const 0
        local.get $l7
        i32.store offset=16396
        local.get $l0
        i32.const 8000
        i32.add
        global.set $__stack_pointer
        local.get $l7
        return
      end
      local.get $l1
      local.get $l2
      i32.const -1
      i32.add
      i32.const 65535
      i32.and
      i32.const 3
      i32.div_u
      i32.store
      local.get $l2
      i32.const 2
      i32.add
      local.set $l2
      local.get $l1
      i32.const 8
      i32.add
      local.set $l1
      br $L1
    end)
  (table $__indirect_function_table 1 1 funcref)
  (memory $memory 2)
  (global $__stack_pointer (mut i32) (i32.const 65536))
  (global $__dso_handle i32 (i32.const 65536))
  (global $__data_end i32 (i32.const 65536))
  (global $__stack_low i32 (i32.const 0))
  (global $__stack_high i32 (i32.const 65536))
  (global $__global_base i32 (i32.const 65536))
  (global $__heap_base i32 (i32.const 65536))
  (global $__heap_end i32 (i32.const 131072))
  (global $__memory_base i32 (i32.const 0))
  (global $__table_base i32 (i32.const 1))
  (global $__wasm_first_page_end i32 (i32.const 65536))
  (export "memory" (memory $memory))
  (export "__wasm_call_ctors" (func $__wasm_call_ctors))
  (export "__stack_pointer" (global $__stack_pointer))
  (export "nested_tree_trace" (func $nested_tree_trace))
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
