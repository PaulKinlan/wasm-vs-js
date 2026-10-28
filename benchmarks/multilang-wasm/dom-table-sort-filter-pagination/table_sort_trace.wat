;; dom.table-sort-filter-pagination.v1 — kernel: table_sort_trace
;; WebAssembly Text (WAT) baseline implementation
;; Exports: table_sort_trace

(module $table_sort_kernel_c.wasm
  (type $t0 (func))
  (type $t1 (func (result i32)))
  (func $__wasm_call_ctors (type $t0))
  (func $table_sort_trace (type $t1) (result i32)
    (local $l0 i32) (local $l1 i32) (local $l2 i32) (local $l3 i32) (local $l4 i32) (local $l5 i32) (local $l6 i32) (local $l7 i32) (local $l8 i32) (local $l9 i32) (local $l10 i32) (local $l11 i32) (local $l12 f64) (local $l13 i32) (local $l14 i32) (local $l15 i32) (local $l16 i32) (local $l17 i32) (local $l18 i32) (local $l19 i32) (local $l20 i32) (local $l21 i32) (local $l22 i32) (local $l23 i32) (local $l24 i32) (local $l25 i32) (local $l26 i32) (local $l27 f64)
    global.get $__stack_pointer
    i32.const 40016
    i32.sub
    local.tee $l0
    global.set $__stack_pointer
    i32.const 37
    local.set $l1
    local.get $l0
    i32.const 20000
    i32.add
    local.set $l2
    local.get $l0
    local.set $l3
    i32.const 0
    local.set $l4
    i32.const 0
    local.set $l5
    loop $L0
      local.get $l3
      local.get $l5
      i32.store
      local.get $l2
      local.get $l4
      i32.const 1000
      i32.rem_u
      i32.store
      local.get $l2
      i32.const 4
      i32.add
      local.get $l1
      i32.const 1000
      i32.rem_u
      i32.store
      local.get $l3
      i32.const 4
      i32.add
      local.get $l5
      i32.const 1
      i32.add
      i32.store
      local.get $l4
      i32.const 74
      i32.add
      local.set $l4
      local.get $l3
      i32.const 8
      i32.add
      local.set $l3
      local.get $l2
      i32.const 8
      i32.add
      local.set $l2
      local.get $l1
      i32.const 74
      i32.add
      local.set $l1
      local.get $l5
      i32.const 2
      i32.add
      local.tee $l5
      i32.const 5000
      i32.ne
      br_if $L0
    end
    i32.const 826366246
    local.set $l6
    i32.const 5000
    local.set $l7
    i32.const 0
    local.set $l8
    i32.const 0
    local.set $l9
    i32.const 0
    local.set $l10
    i32.const 0
    local.set $l11
    loop $L1
      block $B2
        block $B3
          local.get $l6
          i32.const 13
          i32.shl
          local.get $l6
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
          f64.convert_i32_u
          f64.const 0x1p-32 (;=2.32831e-10;)
          f64.mul
          local.tee $l12
          f64.const 0x1.6666666666666p-2 (;=0.35;)
          f64.lt
          i32.eqz
          br_if $B3
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
          local.tee $l3
          i32.const 17
          i32.shr_s
          local.get $l3
          i32.xor
          local.tee $l3
          i32.const 5
          i32.shl
          local.get $l3
          i32.xor
          local.set $l6
          block $B4
            local.get $l7
            i32.const 2
            i32.lt_s
            br_if $B4
            local.get $l6
            f64.convert_i32_u
            f64.const 0x1p-32 (;=2.32831e-10;)
            f64.mul
            local.set $l12
            local.get $l2
            f64.convert_i32_u
            f64.const 0x1p-32 (;=2.32831e-10;)
            f64.mul
            f64.const 0x1.4p+2 (;=5;)
            f64.mul
            i32.trunc_sat_f64_s
            local.set $l13
            i32.const 1
            local.set $l14
            loop $L5
              i32.const 2
              i32.const 1
              local.get $l0
              local.get $l14
              i32.const 2
              i32.shl
              i32.add
              i32.load
              local.tee $l15
              i32.const 3
              i32.rem_s
              local.tee $l2
              i32.const 1
              i32.eq
              select
              i32.const 0
              local.get $l2
              select
              local.set $l16
              local.get $l15
              i32.const 5
              i32.rem_s
              local.tee $l17
              i32.const 2
              i32.shl
              i32.const 65536
              i32.add
              local.set $l18
              local.get $l0
              i32.const 20000
              i32.add
              local.get $l15
              i32.const 2
              i32.shl
              i32.add
              local.set $l19
              local.get $l14
              local.set $l20
              block $B6
                loop $L7
                  local.get $l0
                  local.get $l20
                  i32.const -1
                  i32.add
                  local.tee $l21
                  i32.const 2
                  i32.shl
                  i32.add
                  i32.load
                  local.set $l22
                  i32.const 0
                  local.set $l2
                  block $B8
                    block $B9
                      block $B10
                        block $B11
                          block $B12
                            block $B13
                              local.get $l13
                              br_table $B13 $B12 $B11 $B10 $B9 $B8
                            end
                            local.get $l15
                            local.get $l22
                            i32.gt_s
                            local.get $l15
                            local.get $l22
                            i32.lt_s
                            i32.sub
                            local.set $l2
                            br $B8
                          end
                          i32.const 0
                          local.set $l5
                          local.get $l0
                          i32.const 40008
                          i32.add
                          local.set $l4
                          local.get $l15
                          local.set $l2
                          loop $L14
                            local.get $l0
                            i32.const 40008
                            i32.add
                            local.get $l5
                            local.tee $l1
                            i32.add
                            local.get $l2
                            local.get $l2
                            i32.const 10
                            i32.div_s
                            local.tee $l23
                            i32.const 10
                            i32.mul
                            i32.sub
                            i32.const 48
                            i32.add
                            i32.store8
                            local.get $l4
                            local.tee $l3
                            i32.const 1
                            i32.add
                            local.set $l4
                            local.get $l1
                            i32.const 1
                            i32.add
                            local.set $l5
                            local.get $l2
                            i32.const 9
                            i32.add
                            local.set $l24
                            local.get $l23
                            local.set $l2
                            local.get $l24
                            i32.const 18
                            i32.gt_u
                            br_if $L14
                          end
                          i32.const 0
                          local.set $l23
                          local.get $l0
                          i32.const 40000
                          i32.add
                          local.set $l24
                          local.get $l22
                          local.set $l2
                          loop $L15
                            local.get $l0
                            i32.const 40000
                            i32.add
                            local.get $l23
                            local.tee $l4
                            i32.add
                            local.get $l2
                            local.get $l2
                            i32.const 10
                            i32.div_s
                            local.tee $l25
                            i32.const 10
                            i32.mul
                            i32.sub
                            i32.const 48
                            i32.add
                            i32.store8
                            local.get $l24
                            local.tee $l5
                            i32.const 1
                            i32.add
                            local.set $l24
                            local.get $l4
                            i32.const 1
                            i32.add
                            local.set $l23
                            local.get $l2
                            i32.const 9
                            i32.add
                            local.set $l26
                            local.get $l25
                            local.set $l2
                            local.get $l26
                            i32.const 18
                            i32.gt_u
                            br_if $L15
                          end
                          local.get $l1
                          local.get $l4
                          local.get $l1
                          local.get $l4
                          i32.lt_u
                          local.tee $l25
                          select
                          i32.const 1
                          i32.add
                          local.set $l2
                          block $B16
                            loop $L17
                              local.get $l2
                              i32.eqz
                              br_if $B16
                              local.get $l2
                              i32.const -1
                              i32.add
                              local.set $l2
                              local.get $l5
                              i32.load8_u
                              local.set $l23
                              local.get $l3
                              i32.load8_u
                              local.set $l24
                              local.get $l5
                              i32.const -1
                              i32.add
                              local.set $l5
                              local.get $l3
                              i32.const -1
                              i32.add
                              local.set $l3
                              local.get $l24
                              local.get $l23
                              i32.eq
                              br_if $L17
                            end
                            i32.const -1
                            i32.const 1
                            local.get $l24
                            i32.extend8_s
                            local.get $l23
                            i32.extend8_s
                            i32.lt_s
                            select
                            local.set $l2
                            br $B8
                          end
                          i32.const 0
                          local.set $l2
                          local.get $l4
                          local.get $l1
                          i32.eq
                          br_if $B8
                          i32.const -1
                          i32.const 1
                          local.get $l25
                          select
                          local.set $l2
                          br $B8
                        end
                        i32.const 3
                        local.set $l2
                        i32.const 3
                        local.set $l3
                        block $B18
                          local.get $l17
                          i32.const 3
                          i32.gt_u
                          br_if $B18
                          local.get $l18
                          i32.load
                          local.set $l3
                        end
                        block $B19
                          local.get $l22
                          i32.const 5
                          i32.rem_s
                          local.tee $l5
                          i32.const 3
                          i32.gt_u
                          br_if $B19
                          local.get $l5
                          i32.const 2
                          i32.shl
                          i32.load offset=65536
                          local.set $l2
                        end
                        local.get $l3
                        local.get $l2
                        i32.gt_u
                        local.get $l3
                        local.get $l2
                        i32.lt_u
                        i32.sub
                        local.set $l2
                        br $B8
                      end
                      local.get $l19
                      i32.load
                      local.tee $l2
                      local.get $l0
                      i32.const 20000
                      i32.add
                      local.get $l22
                      i32.const 2
                      i32.shl
                      i32.add
                      i32.load
                      local.tee $l3
                      i32.gt_s
                      local.get $l2
                      local.get $l3
                      i32.lt_s
                      i32.sub
                      local.set $l2
                      br $B8
                    end
                    local.get $l16
                    i32.const 2
                    i32.const 1
                    local.get $l22
                    i32.const 3
                    i32.rem_s
                    local.tee $l2
                    i32.const 1
                    i32.eq
                    select
                    i32.const 0
                    local.get $l2
                    select
                    local.tee $l2
                    i32.gt_u
                    local.get $l16
                    local.get $l2
                    i32.lt_u
                    i32.sub
                    local.set $l2
                  end
                  local.get $l2
                  i32.const 0
                  local.get $l2
                  i32.sub
                  local.get $l12
                  f64.const 0x1p-1 (;=0.5;)
                  f64.gt
                  select
                  i32.const -1
                  i32.gt_s
                  br_if $B6
                  local.get $l0
                  local.get $l20
                  i32.const 2
                  i32.shl
                  i32.add
                  local.get $l22
                  i32.store
                  local.get $l20
                  i32.const 1
                  i32.gt_s
                  local.set $l2
                  local.get $l21
                  local.set $l20
                  local.get $l2
                  br_if $L7
                end
                i32.const 0
                local.set $l20
              end
              local.get $l0
              local.get $l20
              i32.const 2
              i32.shl
              i32.add
              local.get $l15
              i32.store
              local.get $l14
              i32.const 1
              i32.add
              local.tee $l14
              local.get $l7
              i32.ne
              br_if $L5
            end
          end
          local.get $l9
          i32.const 1
          i32.add
          local.set $l9
          br $B2
        end
        block $B20
          local.get $l12
          f64.const 0x1.6666666666666p-1 (;=0.7;)
          f64.lt
          i32.eqz
          br_if $B20
          block $B21
            block $B22
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
              local.tee $l6
              f64.convert_i32_u
              f64.const 0x1p-32 (;=2.32831e-10;)
              f64.mul
              f64.const 0x1.8p+2 (;=6;)
              f64.mul
              i32.trunc_sat_f64_s
              local.tee $l3
              i32.const 5
              i32.eq
              br_if $B22
              i32.const 0
              local.set $l7
              i32.const 1
              local.set $l2
              loop $L23
                block $B24
                  local.get $l2
                  i32.const -1
                  i32.add
                  local.tee $l5
                  i32.const 65535
                  i32.and
                  i32.const 5
                  i32.rem_u
                  local.get $l3
                  i32.ne
                  br_if $B24
                  local.get $l0
                  local.get $l7
                  i32.const 2
                  i32.shl
                  i32.add
                  local.get $l5
                  i32.store
                  local.get $l7
                  i32.const 1
                  i32.add
                  local.set $l7
                end
                block $B25
                  local.get $l2
                  i32.const 65535
                  i32.and
                  i32.const 5
                  i32.rem_u
                  local.get $l3
                  i32.ne
                  br_if $B25
                  local.get $l0
                  local.get $l7
                  i32.const 2
                  i32.shl
                  i32.add
                  local.get $l2
                  i32.store
                  local.get $l7
                  i32.const 1
                  i32.add
                  local.set $l7
                end
                local.get $l2
                i32.const 2
                i32.add
                local.tee $l2
                i32.const 5001
                i32.ne
                br_if $L23
                br $B21
              end
            end
            i32.const 0
            local.set $l2
            local.get $l0
            local.set $l3
            loop $L26
              local.get $l3
              local.get $l2
              i32.store
              local.get $l3
              i32.const 28
              i32.add
              local.get $l2
              i32.const 7
              i32.add
              i32.store
              local.get $l3
              i32.const 24
              i32.add
              local.get $l2
              i32.const 6
              i32.add
              i32.store
              local.get $l3
              i32.const 20
              i32.add
              local.get $l2
              i32.const 5
              i32.add
              i32.store
              local.get $l3
              i32.const 16
              i32.add
              local.get $l2
              i32.const 4
              i32.add
              i32.store
              local.get $l3
              i32.const 12
              i32.add
              local.get $l2
              i32.const 3
              i32.add
              i32.store
              local.get $l3
              i32.const 8
              i32.add
              local.get $l2
              i32.const 2
              i32.add
              i32.store
              local.get $l3
              i32.const 4
              i32.add
              local.get $l2
              i32.const 1
              i32.add
              i32.store
              local.get $l3
              i32.const 32
              i32.add
              local.set $l3
              i32.const 5000
              local.set $l7
              local.get $l2
              i32.const 8
              i32.add
              local.tee $l2
              i32.const 5000
              i32.ne
              br_if $L26
            end
          end
          local.get $l10
          i32.const 1
          i32.add
          local.set $l10
          br $B2
        end
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
        local.tee $l6
        f64.convert_i32_u
        f64.const 0x1p-32 (;=2.32831e-10;)
        f64.mul
        local.set $l27
        block $B27
          local.get $l12
          f64.const 0x1.ccccccccccccdp-1 (;=0.9;)
          f64.lt
          i32.eqz
          br_if $B27
          local.get $l27
          f64.const 0x1.4p+4 (;=20;)
          f64.mul
          i32.trunc_sat_f64_s
          local.set $l8
          br $B2
        end
        local.get $l6
        i32.const 13
        i32.shl
        local.get $l6
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
        local.set $l6
        local.get $l27
        f64.const 0x1.388p+12 (;=5000;)
        f64.mul
        i32.trunc_sat_f64_s
        local.tee $l2
        i32.const 4999
        i32.gt_u
        br_if $B2
        local.get $l0
        i32.const 20000
        i32.add
        local.get $l2
        i32.const 2
        i32.shl
        i32.add
        local.get $l6
        f64.convert_i32_u
        f64.const 0x1p-32 (;=2.32831e-10;)
        f64.mul
        f64.const 0x1.f4p+9 (;=1000;)
        f64.mul
        i32.trunc_sat_f64_s
        i32.store
      end
      local.get $l11
      i32.const 1
      i32.add
      local.tee $l11
      i32.const 120
      i32.ne
      br_if $L1
    end
    local.get $l8
    i32.const 50
    i32.mul
    local.tee $l4
    i32.const 50
    i32.add
    local.tee $l2
    local.get $l7
    local.get $l2
    local.get $l7
    i32.lt_s
    select
    local.set $l1
    i32.const 0
    local.set $l3
    block $B28
      local.get $l7
      local.get $l4
      i32.le_s
      br_if $B28
      local.get $l0
      local.get $l8
      i32.const 200
      i32.mul
      i32.add
      local.set $l2
      i32.const 0
      local.set $l3
      local.get $l4
      local.set $l5
      loop $L29
        local.get $l0
        i32.const 20000
        i32.add
        local.get $l2
        i32.load
        i32.const 2
        i32.shl
        i32.add
        i32.load
        local.get $l3
        i32.add
        local.set $l3
        local.get $l2
        i32.const 4
        i32.add
        local.set $l2
        local.get $l5
        i32.const 1
        i32.add
        local.tee $l5
        local.get $l1
        i32.lt_s
        br_if $L29
      end
    end
    i32.const 0
    local.get $l7
    i32.store offset=40000
    i32.const 0
    local.get $l9
    i32.store offset=40004
    i32.const 0
    local.get $l10
    i32.store offset=40008
    i32.const 0
    local.get $l1
    local.get $l4
    i32.sub
    local.tee $l2
    i32.const 0
    local.get $l2
    i32.const 0
    i32.gt_s
    select
    i32.store offset=40012
    i32.const 0
    local.get $l3
    i32.store offset=40016
    local.get $l0
    i32.const 40016
    i32.add
    global.set $__stack_pointer
    local.get $l3)
  (table $__indirect_function_table 1 1 funcref)
  (memory $memory 2)
  (global $__stack_pointer (mut i32) (i32.const 65536))
  (global $__dso_handle i32 (i32.const 65536))
  (global $__data_end i32 (i32.const 65552))
  (global $__stack_low i32 (i32.const 0))
  (global $__stack_high i32 (i32.const 65536))
  (global $__global_base i32 (i32.const 65536))
  (global $__heap_base i32 (i32.const 65552))
  (global $__heap_end i32 (i32.const 131072))
  (global $__memory_base i32 (i32.const 0))
  (global $__table_base i32 (i32.const 1))
  (global $__wasm_first_page_end i32 (i32.const 65536))
  (export "memory" (memory $memory))
  (export "__wasm_call_ctors" (func $__wasm_call_ctors))
  (export "__stack_pointer" (global $__stack_pointer))
  (export "table_sort_trace" (func $table_sort_trace))
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
  (export "__wasm_first_page_end" (global $__wasm_first_page_end))
  (data $.rodata (i32.const 65536) "\00\00\00\00\01\00\00\00\04\00\00\00\02\00\00\00"))
