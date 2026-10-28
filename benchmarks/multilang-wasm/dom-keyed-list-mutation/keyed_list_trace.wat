;; dom.keyed-list-mutation.v1 — kernel: keyed_list_trace
;; WebAssembly Text (WAT) baseline implementation
;; Exports: keyed_list_trace

(module $keyed_list_kernel_c.wasm
  (type $t0 (func))
  (type $t1 (func (result i32)))
  (func $__wasm_call_ctors (type $t0))
  (func $keyed_list_trace (type $t1) (result i32)
    (local $l0 i32) (local $l1 i32) (local $l2 i32) (local $l3 i32) (local $l4 i32) (local $l5 i32) (local $l6 i32) (local $l7 i32) (local $l8 i32) (local $l9 i32) (local $l10 i32) (local $l11 i32) (local $l12 i32) (local $l13 i32) (local $l14 i32) (local $l15 i32) (local $l16 i32)
    global.get $__stack_pointer
    i32.const 19600
    i32.sub
    local.tee $l0
    global.set $__stack_pointer
    i32.const 0
    local.set $l1
    local.get $l0
    local.set $l2
    loop $L0
      local.get $l2
      local.get $l1
      i32.store
      local.get $l2
      i32.const 28
      i32.add
      local.get $l1
      i32.const 7
      i32.add
      i32.store
      local.get $l2
      i32.const 24
      i32.add
      local.get $l1
      i32.const 6
      i32.add
      i32.store
      local.get $l2
      i32.const 20
      i32.add
      local.get $l1
      i32.const 5
      i32.add
      i32.store
      local.get $l2
      i32.const 16
      i32.add
      local.get $l1
      i32.const 4
      i32.add
      i32.store
      local.get $l2
      i32.const 12
      i32.add
      local.get $l1
      i32.const 3
      i32.add
      i32.store
      local.get $l2
      i32.const 8
      i32.add
      local.get $l1
      i32.const 2
      i32.add
      i32.store
      local.get $l2
      i32.const 4
      i32.add
      local.get $l1
      i32.const 1
      i32.add
      i32.store
      local.get $l2
      i32.const 32
      i32.add
      local.set $l2
      local.get $l1
      i32.const 8
      i32.add
      local.tee $l1
      i32.const 1000
      i32.ne
      br_if $L0
    end
    local.get $l0
    i32.const -8
    i32.add
    local.set $l3
    i32.const 439041101
    local.set $l1
    i32.const 0
    local.set $l4
    i32.const 1000
    local.set $l5
    i32.const 0
    local.set $l6
    i32.const 0
    local.set $l7
    loop $L1
      local.get $l1
      i32.const 13
      i32.shl
      local.get $l1
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
      local.tee $l9
      i32.const 17
      i32.shr_s
      local.get $l9
      i32.xor
      local.tee $l10
      i32.const 5
      i32.shl
      local.set $l11
      local.get $l8
      f64.convert_i32_u
      f64.const 0x1p-32 (;=2.32831e-10;)
      f64.mul
      f64.const 0x1.f4p+9 (;=1000;)
      f64.mul
      i32.trunc_sat_f64_u
      local.set $l12
      local.get $l2
      f64.convert_i32_u
      f64.const 0x1p-32 (;=2.32831e-10;)
      f64.mul
      f64.const 0x1.f4p+9 (;=1000;)
      f64.mul
      i32.trunc_sat_f64_u
      local.set $l2
      block $B2
        block $B3
          block $B4
            block $B5
              block $B6
                block $B7
                  block $B8
                    block $B9
                      local.get $l1
                      f64.convert_i32_u
                      f64.const 0x1p-32 (;=2.32831e-10;)
                      f64.mul
                      f64.const 0x1.4p+2 (;=5;)
                      f64.mul
                      i32.trunc_sat_f64_u
                      local.tee $l1
                      br_table $B3 $B8 $B7 $B9 $B4
                    end
                    i32.const 0
                    local.set $l9
                    local.get $l5
                    i32.const 1
                    i32.lt_s
                    br_if $B5
                    local.get $l0
                    local.set $l1
                    local.get $l5
                    local.set $l8
                    br $B6
                  end
                  local.get $l5
                  i32.const 1
                  i32.lt_s
                  br_if $B2
                  local.get $l5
                  i32.const 3
                  i32.add
                  local.set $l9
                  i32.const 0
                  local.set $l8
                  local.get $l0
                  local.set $l1
                  loop $L10
                    block $B11
                      local.get $l1
                      i32.load
                      local.get $l2
                      i32.ne
                      br_if $B11
                      block $B12
                        local.get $l8
                        local.get $l5
                        i32.const -1
                        i32.add
                        local.tee $l12
                        i32.ge_s
                        br_if $B12
                        local.get $l5
                        local.get $l8
                        i32.sub
                        local.tee $l2
                        i32.const -2
                        i32.add
                        local.set $l13
                        block $B13
                          local.get $l2
                          i32.const -1
                          i32.add
                          i32.const 3
                          i32.and
                          i32.eqz
                          br_if $B13
                          i32.const 0
                          local.set $l2
                          i32.const 0
                          local.get $l9
                          i32.const 3
                          i32.and
                          i32.sub
                          local.set $l14
                          loop $L14
                            local.get $l1
                            local.get $l1
                            i32.const 4
                            i32.add
                            local.tee $l9
                            i32.load
                            i32.store
                            local.get $l9
                            local.set $l1
                            local.get $l14
                            local.get $l2
                            i32.const -1
                            i32.add
                            local.tee $l2
                            i32.ne
                            br_if $L14
                          end
                          local.get $l8
                          local.get $l2
                          i32.sub
                          local.set $l8
                        end
                        local.get $l13
                        i32.const 3
                        i32.lt_u
                        br_if $B12
                        local.get $l8
                        i32.const -1
                        i32.xor
                        local.get $l5
                        i32.add
                        local.set $l2
                        local.get $l0
                        local.get $l8
                        i32.const 2
                        i32.shl
                        i32.add
                        local.set $l1
                        loop $L15
                          local.get $l1
                          local.get $l1
                          i32.const 4
                          i32.add
                          i64.load align=4
                          i64.store align=4
                          local.get $l1
                          i32.const 8
                          i32.add
                          local.get $l1
                          i32.const 12
                          i32.add
                          i64.load align=4
                          i64.store align=4
                          local.get $l1
                          i32.const 16
                          i32.add
                          local.set $l1
                          local.get $l2
                          i32.const -4
                          i32.add
                          local.tee $l2
                          br_if $L15
                        end
                      end
                      local.get $l4
                      i32.const 1
                      i32.add
                      local.set $l4
                      local.get $l12
                      local.set $l5
                      br $B2
                    end
                    local.get $l9
                    i32.const 3
                    i32.add
                    local.set $l9
                    local.get $l1
                    i32.const 4
                    i32.add
                    local.set $l1
                    local.get $l5
                    local.get $l8
                    i32.const 1
                    i32.add
                    local.tee $l8
                    i32.ne
                    br_if $L10
                    br $B2
                  end
                end
                local.get $l5
                i32.const 2
                i32.lt_s
                br_if $B2
                local.get $l0
                local.get $l2
                local.get $l5
                i32.rem_u
                i32.const 2
                i32.shl
                i32.add
                local.tee $l1
                i32.load
                local.set $l2
                local.get $l1
                local.get $l0
                local.get $l12
                local.get $l5
                i32.rem_u
                i32.const 2
                i32.shl
                i32.add
                local.tee $l8
                i32.load
                i32.store
                local.get $l8
                local.get $l2
                i32.store
                local.get $l4
                i32.const 2
                i32.add
                local.set $l4
                br $B2
              end
              block $B16
                loop $L17
                  local.get $l1
                  i32.load
                  local.get $l2
                  i32.eq
                  br_if $B16
                  local.get $l1
                  i32.const 4
                  i32.add
                  local.set $l1
                  local.get $l8
                  i32.const -1
                  i32.add
                  local.tee $l8
                  i32.eqz
                  br_if $B5
                  br $L17
                end
              end
              i32.const 1
              local.set $l9
            end
            local.get $l9
            local.get $l6
            i32.add
            local.set $l6
            br $B2
          end
          local.get $l1
          i32.const 4
          i32.ne
          br_if $B2
          local.get $l5
          i32.const 2
          i32.lt_s
          br_if $B2
          local.get $l5
          i32.const 3
          i32.add
          local.set $l9
          i32.const 0
          local.set $l8
          local.get $l0
          local.set $l1
          block $B18
            loop $L19
              local.get $l1
              i32.load
              local.get $l2
              i32.eq
              br_if $B18
              local.get $l9
              i32.const 3
              i32.add
              local.set $l9
              local.get $l1
              i32.const 4
              i32.add
              local.set $l1
              local.get $l5
              local.get $l8
              i32.const 1
              i32.add
              local.tee $l8
              i32.ne
              br_if $L19
              br $B2
            end
          end
          block $B20
            local.get $l8
            local.get $l5
            i32.const -1
            i32.add
            local.tee $l14
            i32.ge_s
            br_if $B20
            local.get $l5
            local.get $l8
            i32.sub
            local.tee $l13
            i32.const -2
            i32.add
            local.set $l15
            block $B21
              local.get $l13
              i32.const -1
              i32.add
              i32.const 3
              i32.and
              i32.eqz
              br_if $B21
              i32.const 0
              local.set $l13
              i32.const 0
              local.get $l9
              i32.const 3
              i32.and
              i32.sub
              local.set $l16
              loop $L22
                local.get $l1
                local.get $l1
                i32.const 4
                i32.add
                local.tee $l9
                i32.load
                i32.store
                local.get $l9
                local.set $l1
                local.get $l16
                local.get $l13
                i32.const -1
                i32.add
                local.tee $l13
                i32.ne
                br_if $L22
              end
              local.get $l8
              local.get $l13
              i32.sub
              local.set $l8
            end
            local.get $l15
            i32.const 3
            i32.lt_u
            br_if $B20
            local.get $l8
            i32.const -1
            i32.xor
            local.get $l5
            i32.add
            local.set $l9
            local.get $l0
            local.get $l8
            i32.const 2
            i32.shl
            i32.add
            local.set $l1
            loop $L23
              local.get $l1
              local.get $l1
              i32.const 4
              i32.add
              i64.load align=4
              i64.store align=4
              local.get $l1
              i32.const 8
              i32.add
              local.get $l1
              i32.const 12
              i32.add
              i64.load align=4
              i64.store align=4
              local.get $l1
              i32.const 16
              i32.add
              local.set $l1
              local.get $l9
              i32.const -4
              i32.add
              local.tee $l9
              br_if $L23
            end
          end
          block $B24
            local.get $l14
            local.get $l12
            local.get $l14
            i32.rem_u
            local.tee $l8
            i32.le_s
            br_if $B24
            local.get $l3
            local.get $l5
            i32.const 2
            i32.shl
            i32.add
            local.set $l1
            loop $L25
              local.get $l1
              i32.const 4
              i32.add
              local.get $l1
              i32.load
              i32.store
              local.get $l1
              i32.const -4
              i32.add
              local.set $l1
              local.get $l14
              i32.const -1
              i32.add
              local.tee $l14
              local.get $l8
              i32.gt_s
              br_if $L25
            end
          end
          local.get $l0
          local.get $l8
          i32.const 2
          i32.shl
          i32.add
          local.get $l2
          i32.store
          local.get $l4
          i32.const 1
          i32.add
          local.set $l4
          br $B2
        end
        local.get $l5
        i32.const 4899
        i32.gt_s
        br_if $B2
        local.get $l0
        local.get $l5
        i32.const 2
        i32.shl
        i32.add
        local.get $l2
        i32.store
        local.get $l4
        i32.const 1
        i32.add
        local.set $l4
        local.get $l5
        i32.const 1
        i32.add
        local.set $l5
      end
      local.get $l11
      local.get $l10
      i32.xor
      local.set $l1
      local.get $l7
      i32.const 1
      i32.add
      local.tee $l7
      i32.const 2000
      i32.ne
      br_if $L1
    end
    i32.const 0
    local.set $l2
    block $B26
      local.get $l5
      i32.const 1
      i32.lt_s
      br_if $B26
      local.get $l5
      i32.const 3
      i32.and
      local.set $l8
      i32.const 0
      local.set $l9
      i32.const 0
      local.set $l2
      block $B27
        local.get $l5
        i32.const 4
        i32.lt_u
        br_if $B27
        local.get $l5
        i32.const 2147483644
        i32.and
        local.set $l7
        i32.const 0
        local.set $l9
        local.get $l0
        local.set $l1
        i32.const 0
        local.set $l2
        loop $L28
          local.get $l1
          i32.const 12
          i32.add
          i32.load
          local.get $l1
          i32.const 8
          i32.add
          i32.load
          local.get $l1
          i32.const 4
          i32.add
          i32.load
          local.get $l1
          i32.load
          local.get $l2
          i32.add
          i32.add
          i32.add
          i32.add
          local.set $l2
          local.get $l1
          i32.const 16
          i32.add
          local.set $l1
          local.get $l7
          local.get $l9
          i32.const 4
          i32.add
          local.tee $l9
          i32.ne
          br_if $L28
        end
        local.get $l8
        i32.eqz
        br_if $B26
      end
      local.get $l0
      local.get $l9
      i32.const 2
      i32.shl
      i32.add
      local.set $l1
      loop $L29
        local.get $l1
        i32.load
        local.get $l2
        i32.add
        local.set $l2
        local.get $l1
        i32.const 4
        i32.add
        local.set $l1
        local.get $l8
        i32.const -1
        i32.add
        local.tee $l8
        br_if $L29
      end
    end
    i32.const 0
    local.get $l4
    i32.store offset=16384
    i32.const 0
    local.get $l6
    i32.store offset=16388
    i32.const 0
    local.get $l5
    i32.store offset=16392
    i32.const 0
    local.get $l2
    i32.store offset=16396
    local.get $l0
    i32.const 19600
    i32.add
    global.set $__stack_pointer
    local.get $l2)
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
  (export "keyed_list_trace" (func $keyed_list_trace))
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
