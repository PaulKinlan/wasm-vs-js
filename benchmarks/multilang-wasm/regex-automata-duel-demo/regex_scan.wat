;; regex-automata-duel-demo — kernel: regex_scan
;; WebAssembly Text (WAT) baseline implementation
;; Exports: regex_scan

(module $regex_scan_kernel_c.wasm
  (type $t0 (func))
  (type $t1 (func (param i32) (result i32)))
  (func $__wasm_call_ctors (type $t0))
  (func $regex_scan (type $t1) (param $p0 i32) (result i32)
    (local $l1 i32) (local $l2 i32) (local $l3 i32) (local $l4 i32) (local $l5 i32) (local $l6 i32) (local $l7 i32) (local $l8 i32) (local $l9 i32) (local $l10 i32) (local $l11 i32) (local $l12 i32) (local $l13 i32) (local $l14 i32) (local $l15 i32) (local $l16 i32) (local $l17 i32) (local $l18 i32) (local $l19 i32) (local $l20 i32) (local $l21 i32) (local $l22 i32) (local $l23 i32) (local $l24 i32) (local $l25 i32) (local $l26 i32) (local $l27 i32) (local $l28 i32) (local $l29 i32) (local $l30 i32) (local $l31 i32) (local $l32 i32) (local $l33 i32) (local $l34 i32)
    block $B0
      local.get $p0
      i32.const 12
      i32.ge_u
      br_if $B0
      i32.const -1
      return
    end
    block $B1
      i32.const 0
      i32.load8_u offset=3145729
      i32.const 8
      i32.shl
      i32.const 0
      i32.load8_u offset=3145728
      i32.or
      i32.const 0
      i32.load8_u offset=3145730
      i32.const 16
      i32.shl
      i32.or
      i32.const 0
      i32.load8_u offset=3145731
      i32.const 24
      i32.shl
      i32.or
      i32.const 826366034
      i32.eq
      br_if $B1
      i32.const -2
      return
    end
    block $B2
      i32.const 0
      i32.load8_u offset=3145733
      i32.const 8
      i32.shl
      local.tee $l1
      i32.const 0
      i32.load8_u offset=3145732
      local.tee $l2
      i32.or
      i32.const 0
      i32.load8_u offset=3145734
      i32.const 16
      i32.shl
      local.tee $l3
      i32.or
      i32.const 0
      i32.load8_u offset=3145735
      i32.const 24
      i32.shl
      local.tee $l4
      i32.or
      local.tee $l5
      local.get $p0
      i32.const -8
      i32.add
      i32.le_u
      br_if $B2
      i32.const -3
      return
    end
    block $B3
      block $B4
        local.get $l5
        i32.const 15
        i32.add
        i32.const -8
        i32.and
        local.tee $l6
        i32.const 3145728
        i32.add
        i32.load
        local.tee $l7
        br_if $B4
        i32.const -2128831035
        local.set $l8
        i32.const 0
        local.set $l9
        i32.const 0
        local.set $l10
        br $B3
      end
      local.get $l5
      i32.const -2
      i32.add
      local.set $l11
      local.get $l5
      i32.const -1
      i32.add
      local.set $l12
      local.get $l6
      i32.const 4
      i32.or
      local.set $l13
      i32.const 3
      local.get $l2
      local.get $l1
      i32.add
      local.get $l3
      i32.add
      local.get $l4
      i32.add
      local.tee $l1
      i32.sub
      local.set $l14
      i32.const 2
      local.get $l1
      i32.sub
      local.set $l15
      i32.const 1
      local.get $l1
      i32.sub
      local.set $l16
      i32.const -2128831035
      local.set $l8
      i32.const 0
      local.set $l10
      i32.const 0
      local.set $l9
      i32.const 0
      local.set $l17
      loop $L5
        block $B6
          local.get $l13
          i32.const 12
          i32.add
          local.get $p0
          i32.le_u
          br_if $B6
          i32.const -4
          return
        end
        block $B7
          local.get $l13
          i32.const 3145728
          i32.add
          i32.load16_u align=1
          local.get $l13
          i32.const 3145730
          i32.add
          i32.load8_u
          i32.const 16
          i32.shl
          i32.or
          local.tee $l2
          i32.const 8
          i32.shl
          local.tee $l3
          local.get $p0
          local.get $l13
          i32.const 13
          i32.add
          i32.const -2
          i32.and
          local.tee $l1
          i32.sub
          i32.le_u
          br_if $B7
          i32.const -5
          return
        end
        block $B8
          local.get $l2
          local.get $l13
          i32.const 3145731
          i32.add
          i32.load8_u
          i32.const 24
          i32.shl
          i32.or
          local.tee $l2
          local.get $p0
          local.get $l3
          local.get $l1
          i32.add
          local.tee $l3
          i32.sub
          i32.le_u
          br_if $B8
          i32.const -6
          return
        end
        block $B9
          local.get $l2
          i32.const 7
          i32.shl
          local.tee $l4
          local.get $p0
          local.get $l3
          local.get $l2
          i32.add
          local.tee $l2
          i32.sub
          i32.le_u
          br_if $B9
          i32.const -7
          return
        end
        local.get $l13
        i32.const 3145739
        i32.add
        i32.load8_u
        local.set $l18
        local.get $l13
        i32.const 3145738
        i32.add
        i32.load8_u
        local.set $l19
        local.get $l13
        i32.const 3145737
        i32.add
        i32.load8_u
        local.set $l20
        local.get $l13
        i32.const 3145736
        i32.add
        i32.load8_u
        local.set $l21
        local.get $l13
        i32.const 3145734
        i32.add
        i32.load8_u
        local.set $l22
        local.get $l13
        i32.const 3145732
        i32.add
        local.set $l6
        local.get $l13
        i32.const 3145733
        i32.add
        i32.load8_u
        local.set $l23
        local.get $l1
        i32.const 3145728
        i32.add
        local.set $l24
        local.get $l2
        i32.const 3145728
        i32.add
        local.set $l25
        local.get $l3
        i32.const 3145728
        i32.add
        local.set $l26
        local.get $l17
        i32.const 1
        i32.add
        local.set $l17
        local.get $l2
        local.get $l4
        i32.add
        i32.const 7
        i32.add
        i32.const -8
        i32.and
        local.set $l13
        i32.const 0
        local.set $l1
        local.get $l6
        i32.load8_u
        i32.const 255
        i32.and
        local.set $l27
        i32.const 0
        local.set $l28
        block $B10
          loop $L11
            block $B12
              local.get $l27
              i32.eqz
              br_if $B12
              local.get $l1
              br_if $B10
            end
            local.get $l1
            i32.const -1
            local.get $l26
            i32.load8_u
            local.tee $l3
            select
            local.set $l2
            block $B13
              local.get $l3
              i32.eqz
              br_if $B13
              local.get $l23
              i32.const 255
              i32.and
              i32.eqz
              br_if $B13
              block $B14
                local.get $l1
                local.get $l5
                i32.eq
                br_if $B14
                block $B15
                  local.get $l1
                  local.get $l12
                  i32.ne
                  br_if $B15
                  local.get $l12
                  i32.load8_u offset=3145736
                  i32.const -10
                  i32.add
                  br_table $B14 $B15 $B15 $B14 $B15
                end
                i32.const -1
                local.set $l2
                local.get $l5
                i32.const 2
                i32.lt_u
                br_if $B13
                local.get $l1
                local.get $l11
                i32.ne
                br_if $B13
                local.get $l11
                i32.load8_u offset=3145736
                i32.const 13
                i32.ne
                br_if $B13
                local.get $l11
                i32.load8_u offset=3145737
                i32.const 10
                i32.ne
                br_if $B13
              end
              local.get $l1
              local.set $l2
            end
            block $B16
              local.get $l1
              local.get $l5
              i32.ge_u
              br_if $B16
              block $B17
                local.get $l23
                i32.const 255
                i32.and
                i32.eqz
                br_if $B17
                local.get $l14
                local.get $l1
                i32.add
                local.set $l29
                local.get $l15
                local.get $l1
                i32.add
                local.set $l30
                local.get $l16
                local.get $l1
                i32.add
                local.set $l31
                i32.const 3145728
                local.set $l4
                i32.const 0
                local.set $l3
                i32.const 0
                local.set $l6
                loop $L18
                  local.get $l4
                  local.get $l1
                  i32.add
                  local.tee $l32
                  i32.const 8
                  i32.add
                  i32.load8_s
                  local.tee $l33
                  i32.const 0
                  i32.lt_s
                  br_if $B16
                  local.get $l33
                  i32.const 255
                  i32.and
                  local.set $l33
                  block $B19
                    local.get $l1
                    local.get $l3
                    i32.add
                    local.tee $l34
                    local.get $l2
                    i32.ne
                    br_if $B19
                    local.get $l25
                    local.get $l6
                    i32.const 7
                    i32.shl
                    i32.add
                    local.get $l33
                    i32.add
                    i32.load8_u
                    br_if $B16
                  end
                  local.get $l24
                  local.get $l6
                  i32.const 8
                  i32.shl
                  i32.add
                  local.get $l33
                  i32.const 1
                  i32.shl
                  i32.add
                  local.tee $l6
                  i32.const 1
                  i32.add
                  i32.load8_u
                  i32.const 8
                  i32.shl
                  local.tee $l33
                  i32.extend16_s
                  i32.const 0
                  i32.lt_s
                  br_if $B16
                  block $B20
                    local.get $l26
                    local.get $l33
                    local.get $l6
                    i32.load8_u
                    i32.or
                    i32.extend16_s
                    local.tee $l6
                    i32.add
                    i32.load8_u
                    i32.eqz
                    br_if $B20
                    block $B21
                      local.get $l31
                      local.get $l3
                      i32.add
                      i32.eqz
                      br_if $B21
                      block $B22
                        local.get $l30
                        local.get $l3
                        i32.add
                        br_if $B22
                        local.get $l32
                        i32.const 9
                        i32.add
                        i32.load8_u
                        i32.const -10
                        i32.add
                        br_table $B21 $B22 $B22 $B21 $B22
                      end
                      local.get $l5
                      i32.const 2
                      i32.lt_u
                      br_if $B20
                      local.get $l29
                      local.get $l3
                      i32.add
                      br_if $B20
                      local.get $l32
                      i32.const 9
                      i32.add
                      i32.load8_u
                      i32.const 13
                      i32.ne
                      br_if $B20
                      local.get $l32
                      i32.const 10
                      i32.add
                      i32.load8_u
                      i32.const 10
                      i32.ne
                      br_if $B20
                    end
                    local.get $l34
                    i32.const 1
                    i32.add
                    local.set $l2
                  end
                  local.get $l4
                  i32.const 1
                  i32.add
                  local.set $l4
                  local.get $l1
                  local.get $l3
                  i32.const 1
                  i32.add
                  local.tee $l3
                  i32.add
                  local.get $l5
                  i32.lt_u
                  br_if $L18
                  br $B16
                end
              end
              i32.const 0
              local.set $l4
              local.get $l1
              local.set $l3
              loop $L23
                local.get $l3
                i32.const 3145736
                i32.add
                i32.load8_s
                local.tee $l6
                i32.const 0
                i32.lt_s
                br_if $B16
                local.get $l6
                i32.const 255
                i32.and
                local.set $l6
                block $B24
                  local.get $l3
                  local.get $l2
                  i32.ne
                  br_if $B24
                  local.get $l25
                  local.get $l4
                  i32.const 7
                  i32.shl
                  i32.add
                  local.get $l6
                  i32.add
                  i32.load8_u
                  br_if $B16
                end
                local.get $l24
                local.get $l4
                i32.const 8
                i32.shl
                i32.add
                local.get $l6
                i32.const 1
                i32.shl
                i32.add
                local.tee $l4
                i32.const 1
                i32.add
                i32.load8_u
                i32.const 8
                i32.shl
                i32.extend16_s
                local.tee $l6
                i32.const 0
                i32.lt_s
                br_if $B16
                local.get $l3
                i32.const 1
                i32.add
                local.tee $l3
                local.get $l2
                local.get $l26
                local.get $l6
                local.get $l4
                i32.load8_u
                i32.or
                i32.const 65535
                i32.and
                local.tee $l4
                i32.add
                i32.load8_u
                select
                local.set $l2
                local.get $l3
                local.get $l5
                i32.lt_u
                br_if $L23
              end
            end
            block $B25
              block $B26
                local.get $l2
                local.get $l1
                i32.lt_s
                br_if $B26
                local.get $l8
                local.get $l21
                i32.xor
                i32.const 16777619
                i32.mul
                local.get $l20
                i32.xor
                i32.const 16777619
                i32.mul
                local.get $l19
                i32.xor
                i32.const 16777619
                i32.mul
                local.get $l18
                i32.xor
                i32.const 16777619
                i32.mul
                local.get $l1
                i32.const 255
                i32.and
                i32.xor
                i32.const 16777619
                i32.mul
                local.get $l1
                i32.const 8
                i32.shr_u
                i32.const 255
                i32.and
                i32.xor
                i32.const 16777619
                i32.mul
                local.get $l1
                i32.const 16
                i32.shr_u
                i32.const 255
                i32.and
                i32.xor
                i32.const 16777619
                i32.mul
                local.get $l1
                i32.const 24
                i32.shr_u
                i32.xor
                i32.const 16777619
                i32.mul
                local.get $l2
                i32.const 255
                i32.and
                i32.xor
                i32.const 16777619
                i32.mul
                local.get $l2
                i32.const 8
                i32.shr_u
                i32.const 255
                i32.and
                i32.xor
                i32.const 16777619
                i32.mul
                local.get $l2
                i32.const 16
                i32.shr_u
                i32.const 255
                i32.and
                i32.xor
                i32.const 16777619
                i32.mul
                local.get $l2
                i32.const 24
                i32.shr_u
                i32.xor
                i32.const 16777619
                i32.mul
                local.set $l8
                local.get $l28
                i32.const 1
                i32.add
                local.set $l28
                local.get $l10
                i32.const 1
                i32.add
                local.set $l10
                local.get $l2
                local.get $l1
                i32.const 1
                i32.add
                local.tee $l1
                local.get $l2
                local.get $l1
                i32.gt_u
                select
                local.set $l1
                br $B25
              end
              local.get $l27
              br_if $B10
              local.get $l1
              i32.const 1
              i32.add
              local.set $l1
            end
            local.get $l1
            local.get $l5
            i32.le_u
            br_if $L11
          end
        end
        local.get $l28
        local.get $l22
        i32.mul
        local.get $l9
        i32.add
        local.set $l9
        local.get $l17
        local.get $l7
        i32.ne
        br_if $L5
      end
    end
    i32.const 0
    local.get $l10
    i32.store offset=5242880
    i32.const 0
    local.get $l7
    i32.store offset=5242884
    i32.const 0
    local.get $l7
    local.get $l5
    i32.mul
    i32.store offset=5242888
    i32.const 0
    local.get $l9
    i32.store offset=5242892
    i32.const 0
    local.get $l7
    i32.store offset=5242896
    i32.const 0
    local.get $p0
    i32.store offset=5242900
    i32.const 0
    local.get $l5
    i32.store offset=5242904
    i32.const 0
    local.get $l8
    i32.store offset=5242908
    i32.const 0
    i32.const 0
    i32.store offset=5242912
    i32.const 0)
  (table $__indirect_function_table 1 1 funcref)
  (memory $memory 128)
  (global $__stack_pointer (mut i32) (i32.const 65536))
  (global $__dso_handle i32 (i32.const 65536))
  (global $__data_end i32 (i32.const 65536))
  (global $__stack_low i32 (i32.const 0))
  (global $__stack_high i32 (i32.const 65536))
  (global $__global_base i32 (i32.const 65536))
  (global $__heap_base i32 (i32.const 65536))
  (global $__heap_end i32 (i32.const 8388608))
  (global $__memory_base i32 (i32.const 0))
  (global $__table_base i32 (i32.const 1))
  (global $__wasm_first_page_end i32 (i32.const 65536))
  (export "memory" (memory $memory))
  (export "__wasm_call_ctors" (func $__wasm_call_ctors))
  (export "__stack_pointer" (global $__stack_pointer))
  (export "regex_scan" (func $regex_scan))
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
