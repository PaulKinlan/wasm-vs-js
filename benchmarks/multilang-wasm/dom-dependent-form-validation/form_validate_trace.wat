;; dom.dependent-form-validation.v1 — kernel: form_validate_trace
;; WebAssembly Text (WAT) baseline implementation
;; Exports: form_validate_trace

(module $form_validate_kernel_c.wasm
  (type $t0 (func))
  (type $t1 (func (result i32)))
  (type $t2 (func (param i32 i32) (result i32)))
  (type $t3 (func (param i32) (result i32)))
  (func $__wasm_call_ctors (type $t0))
  (func $form_validate_trace (type $t1) (result i32)
    (local $l0 i32) (local $l1 i32) (local $l2 i32) (local $l3 i32) (local $l4 i32) (local $l5 i32) (local $l6 i32) (local $l7 i32) (local $l8 i32) (local $l9 i32) (local $l10 i32) (local $l11 i32) (local $l12 i32) (local $l13 i32)
    global.get $__stack_pointer
    i32.const 368
    i32.sub
    local.tee $l0
    global.set $__stack_pointer
    i32.const 0
    local.set $l1
    loop $L0
      local.get $l0
      i32.const 48
      i32.add
      local.get $l1
      i32.add
      i64.const 0
      i64.store
      local.get $l1
      i32.const 8
      i32.add
      local.tee $l1
      i32.const 320
      i32.ne
      br_if $L0
    end
    local.get $l0
    i32.const 5
    i32.add
    local.set $l2
    i32.const 610839776
    local.set $l1
    i32.const 0
    local.set $l3
    i32.const 0
    local.set $l4
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
      f64.convert_i32_u
      f64.const 0x1p-32 (;=2.32831e-10;)
      f64.mul
      f64.const 0x1.4p+3 (;=10;)
      f64.mul
      i32.trunc_sat_f64_s
      local.set $l5
      block $B2
        block $B3
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
          local.tee $l6
          f64.convert_i32_u
          f64.const 0x1p-32 (;=2.32831e-10;)
          f64.mul
          f64.const 0x1.ep+3 (;=15;)
          f64.mul
          i32.trunc_sat_f64_s
          local.tee $l7
          i32.const -2
          i32.ge_s
          br_if $B3
          i32.const 0
          local.set $l1
          br $B2
        end
        i32.const 0
        local.set $l1
        local.get $l7
        i32.const 2
        i32.add
        local.tee $l7
        i32.const 0
        local.get $l7
        i32.const 0
        i32.gt_s
        select
        i32.const 1
        i32.add
        local.set $l7
        loop $L4
          local.get $l6
          i32.const 13
          i32.shl
          local.get $l6
          i32.xor
          local.tee $l6
          i32.const 17
          i32.shr_s
          local.get $l6
          i32.xor
          local.tee $l6
          i32.const 5
          i32.shl
          local.get $l6
          i32.xor
          local.set $l6
          block $B5
            local.get $l1
            i32.const 30
            i32.gt_s
            br_if $B5
            local.get $l0
            i32.const 16
            i32.add
            local.get $l1
            i32.add
            local.get $l6
            f64.convert_i32_u
            f64.const 0x1p-32 (;=2.32831e-10;)
            f64.mul
            f64.const 0x1.ap+4 (;=26;)
            f64.mul
            i32.trunc_sat_f64_s
            i32.const 97
            i32.add
            i32.store8
            local.get $l1
            i32.const 1
            i32.add
            local.set $l1
          end
          local.get $l7
          i32.const -1
          i32.add
          local.tee $l7
          br_if $L4
        end
      end
      block $B6
        block $B7
          block $B8
            block $B9
              block $B10
                block $B11
                  local.get $l5
                  br_table $B11 $B6 $B6 $B10 $B6 $B6 $B6 $B9 $B6
                end
                local.get $l1
                i32.const 31
                i32.ge_s
                br_if $B6
                local.get $l0
                i32.const 16
                i32.add
                local.get $l1
                i32.add
                local.tee $l7
                i32.const 64
                i32.store8
                block $B12
                  local.get $l1
                  i32.const 30
                  i32.ne
                  br_if $B12
                  i32.const 31
                  local.set $l1
                  br $B6
                end
                local.get $l7
                i32.const 1
                i32.add
                i32.const 101
                i32.store8
                block $B13
                  local.get $l1
                  i32.const 28
                  i32.le_s
                  br_if $B13
                  i32.const 31
                  local.set $l1
                  br $B6
                end
                local.get $l7
                i32.const 2
                i32.add
                i32.const 120
                i32.store8
                block $B14
                  local.get $l1
                  i32.const 28
                  i32.ne
                  br_if $B14
                  i32.const 31
                  local.set $l1
                  br $B6
                end
                local.get $l7
                i32.const 3
                i32.add
                i32.const 97
                i32.store8
                block $B15
                  local.get $l1
                  i32.const 26
                  i32.le_s
                  br_if $B15
                  i32.const 31
                  local.set $l1
                  br $B6
                end
                local.get $l7
                i32.const 4
                i32.add
                i32.const 109
                i32.store8
                block $B16
                  local.get $l1
                  i32.const 26
                  i32.ne
                  br_if $B16
                  i32.const 31
                  local.set $l1
                  br $B6
                end
                local.get $l7
                i32.const 5
                i32.add
                i32.const 112
                i32.store8
                block $B17
                  local.get $l1
                  i32.const 24
                  i32.le_s
                  br_if $B17
                  i32.const 31
                  local.set $l1
                  br $B6
                end
                local.get $l7
                i32.const 6
                i32.add
                i32.const 108
                i32.store8
                block $B18
                  local.get $l1
                  i32.const 24
                  i32.ne
                  br_if $B18
                  i32.const 31
                  local.set $l1
                  br $B6
                end
                local.get $l7
                i32.const 7
                i32.add
                i32.const 101
                i32.store8
                block $B19
                  local.get $l1
                  i32.const 22
                  i32.le_s
                  br_if $B19
                  i32.const 31
                  local.set $l1
                  br $B6
                end
                local.get $l7
                i32.const 8
                i32.add
                i32.const 46
                i32.store8
                block $B20
                  local.get $l1
                  i32.const 22
                  i32.ne
                  br_if $B20
                  i32.const 31
                  local.set $l1
                  br $B6
                end
                local.get $l7
                i32.const 9
                i32.add
                i32.const 99
                i32.store8
                block $B21
                  local.get $l1
                  i32.const 20
                  i32.le_s
                  br_if $B21
                  i32.const 31
                  local.set $l1
                  br $B6
                end
                local.get $l7
                i32.const 10
                i32.add
                i32.const 111
                i32.store8
                block $B22
                  local.get $l1
                  i32.const 20
                  i32.ne
                  br_if $B22
                  i32.const 31
                  local.set $l1
                  br $B6
                end
                local.get $l7
                i32.const 11
                i32.add
                i32.const 109
                i32.store8
                local.get $l1
                i32.const 12
                i32.add
                local.set $l1
                br $B6
              end
              local.get $l6
              i32.const 13
              i32.shl
              local.get $l6
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
              local.tee $l6
              f64.convert_i32_u
              f64.const 0x1p-32 (;=2.32831e-10;)
              f64.mul
              f64.const 0x1.9p+5 (;=50;)
              f64.mul
              i32.trunc_sat_f64_s
              i32.const 15
              i32.add
              local.set $l7
              i32.const 0
              local.set $l1
              i32.const 1
              local.set $l8
              local.get $l2
              local.set $l9
              loop $L23
                local.get $l0
                i32.const 8
                i32.add
                local.get $l1
                i32.add
                local.get $l7
                local.get $l7
                i32.const 10
                i32.div_s
                local.tee $l10
                i32.const 10
                i32.mul
                i32.sub
                i32.const 48
                i32.add
                i32.store8
                local.get $l8
                local.tee $l11
                i32.const 1
                i32.add
                local.set $l8
                local.get $l9
                local.tee $l12
                i32.const 1
                i32.add
                local.set $l9
                local.get $l1
                i32.const 1
                i32.add
                local.set $l1
                local.get $l7
                i32.const 9
                i32.add
                local.set $l13
                local.get $l10
                local.set $l7
                local.get $l13
                i32.const 18
                i32.gt_u
                br_if $L23
              end
              block $B24
                local.get $l1
                i32.const 4
                i32.ge_u
                br_if $B24
                local.get $l1
                i32.const -1
                i32.add
                local.set $l12
                i32.const 0
                local.set $l9
                br $B7
              end
              local.get $l1
              i32.const 3
              i32.and
              local.set $l10
              local.get $l11
              i32.const -4
              i32.and
              local.set $l8
              i32.const 0
              local.set $l9
              loop $L25
                local.get $l0
                i32.const 16
                i32.add
                local.get $l9
                i32.add
                local.tee $l7
                local.get $l12
                i32.const 3
                i32.add
                i32.load8_u
                i32.store8
                local.get $l7
                i32.const 1
                i32.add
                local.get $l12
                i32.const 2
                i32.add
                i32.load8_u
                i32.store8
                local.get $l7
                i32.const 2
                i32.add
                local.get $l12
                i32.const 1
                i32.add
                i32.load8_u
                i32.store8
                local.get $l7
                i32.const 3
                i32.add
                local.get $l12
                i32.load8_u
                i32.store8
                local.get $l12
                i32.const -4
                i32.add
                local.set $l12
                local.get $l8
                local.get $l9
                i32.const 4
                i32.add
                local.tee $l9
                i32.ne
                br_if $L25
                br $B8
              end
            end
            block $B26
              local.get $l6
              i32.const 13
              i32.shl
              local.get $l6
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
              local.tee $l6
              f64.convert_i32_u
              f64.const 0x1p-32 (;=2.32831e-10;)
              f64.mul
              f64.const 0x1p-1 (;=0.5;)
              f64.gt
              i32.eqz
              br_if $B26
              local.get $l0
              i32.const 1702195828
              i32.store offset=16
              i32.const 4
              local.set $l1
              br $B6
            end
            local.get $l0
            i32.const 101
            i32.store8 offset=20
            local.get $l0
            i32.const 1936482662
            i32.store offset=16
            i32.const 5
            local.set $l1
            br $B6
          end
          local.get $l10
          i32.eqz
          br_if $B6
          local.get $l9
          i32.const -1
          i32.xor
          local.get $l1
          i32.add
          local.set $l12
        end
        local.get $l11
        i32.const 3
        i32.and
        local.set $l8
        local.get $l0
        i32.const 16
        i32.add
        local.get $l9
        i32.add
        local.set $l7
        local.get $l0
        i32.const 8
        i32.add
        local.get $l12
        i32.add
        local.set $l12
        loop $L27
          local.get $l7
          local.get $l12
          i32.load8_u
          i32.store8
          local.get $l7
          i32.const 1
          i32.add
          local.set $l7
          local.get $l12
          i32.const -1
          i32.add
          local.set $l12
          local.get $l8
          i32.const -1
          i32.add
          local.tee $l8
          br_if $L27
        end
      end
      i32.const 0
      local.set $l8
      local.get $l0
      i32.const 16
      i32.add
      local.get $l1
      i32.add
      i32.const 0
      i32.store8
      local.get $l6
      i32.const 13
      i32.shl
      local.get $l6
      i32.xor
      local.tee $l6
      i32.const 17
      i32.shr_s
      local.get $l6
      i32.xor
      local.tee $l9
      i32.const 5
      i32.shl
      local.set $l10
      local.get $l0
      i32.const 48
      i32.add
      local.get $l5
      i32.const 5
      i32.shl
      local.tee $l13
      i32.add
      local.set $l12
      block $B28
        local.get $l1
        i32.const 1
        i32.lt_s
        br_if $B28
        local.get $l1
        i32.const 31
        local.get $l1
        i32.const 31
        i32.lt_s
        select
        local.tee $l8
        i32.const 3
        i32.and
        local.set $l7
        i32.const 0
        local.set $l6
        block $B29
          local.get $l1
          i32.const 4
          i32.lt_s
          br_if $B29
          local.get $l8
          i32.const 28
          i32.and
          local.set $l1
          i32.const 0
          local.set $l6
          loop $L30
            local.get $l12
            local.get $l6
            i32.add
            local.get $l0
            i32.const 16
            i32.add
            local.get $l6
            i32.add
            i32.load
            i32.store
            local.get $l1
            local.get $l6
            i32.const 4
            i32.add
            local.tee $l6
            i32.ne
            br_if $L30
          end
          local.get $l7
          i32.eqz
          br_if $B28
        end
        local.get $l0
        i32.const 48
        i32.add
        local.get $l6
        local.get $l13
        i32.add
        i32.add
        local.set $l1
        local.get $l0
        i32.const 16
        i32.add
        local.get $l6
        i32.add
        local.set $l6
        loop $L31
          local.get $l1
          local.get $l6
          i32.load8_u
          i32.store8
          local.get $l6
          i32.const 1
          i32.add
          local.set $l6
          local.get $l1
          i32.const 1
          i32.add
          local.set $l1
          local.get $l7
          i32.const -1
          i32.add
          local.tee $l7
          br_if $L31
        end
      end
      local.get $l10
      local.get $l9
      i32.xor
      local.set $l1
      local.get $l12
      local.get $l8
      i32.add
      i32.const 0
      i32.store8
      local.get $l0
      i32.const 48
      i32.add
      local.get $l0
      i32.const 8
      i32.add
      call $validate
      local.get $l3
      i32.add
      local.set $l3
      local.get $l4
      i32.const 1
      i32.add
      local.tee $l4
      i32.const 240
      i32.ne
      br_if $L1
    end
    local.get $l0
    i32.const 48
    i32.add
    local.get $l0
    i32.const 8
    i32.add
    call $validate
    local.set $l1
    i32.const 0
    local.get $l3
    i32.store offset=16384
    i32.const 0
    local.get $l1
    i32.store offset=16388
    i32.const 0
    i32.const 240
    i32.store offset=16392
    local.get $l0
    i32.const 368
    i32.add
    global.set $__stack_pointer
    local.get $l3)
  (func $validate (type $t2) (param $p0 i32) (param $p1 i32) (result i32)
    (local $l2 i32) (local $l3 i32) (local $l4 i32) (local $l5 i32) (local $l6 i32) (local $l7 i32) (local $l8 i32)
    local.get $p0
    i32.const 32
    i32.add
    local.set $l2
    block $B0
      block $B1
        local.get $p0
        i32.load8_u
        br_if $B1
        i32.const 0
        local.set $l3
        br $B0
      end
      i32.const -2
      local.set $l4
      loop $L2
        local.get $p0
        local.get $l4
        i32.add
        local.set $l5
        local.get $l4
        i32.const 1
        i32.add
        local.tee $l6
        local.set $l4
        local.get $l5
        i32.const 2
        i32.add
        i32.load8_u
        br_if $L2
      end
      block $B3
        local.get $l6
        i32.const 1
        i32.add
        local.tee $l3
        i32.eqz
        br_if $B3
        i32.const 0
        local.set $l4
        i32.const -1
        local.set $l7
        loop $L4
          block $B5
            block $B6
              local.get $p0
              local.get $l4
              i32.add
              i32.load8_u
              local.tee $l5
              i32.const 64
              i32.eq
              br_if $B6
              local.get $l5
              i32.const -9
              i32.add
              local.tee $l5
              i32.const 23
              i32.gt_u
              br_if $B5
              i32.const 1
              local.get $l5
              i32.shl
              i32.const 8388627
              i32.and
              i32.eqz
              br_if $B5
              br $B3
            end
            local.get $l7
            i32.const -1
            i32.gt_s
            local.set $l5
            local.get $l4
            local.set $l7
            local.get $l5
            br_if $B3
          end
          local.get $l3
          local.get $l4
          i32.const 1
          i32.add
          local.tee $l4
          i32.ne
          br_if $L4
        end
        local.get $l7
        i32.const 1
        i32.lt_s
        br_if $B3
        local.get $l7
        local.get $l6
        i32.ge_s
        br_if $B3
        i32.const -1
        local.set $l5
        local.get $l7
        i32.const 1
        i32.add
        local.tee $l7
        local.set $l4
        loop $L7
          block $B8
            block $B9
              local.get $p0
              local.get $l4
              i32.add
              i32.load8_u
              i32.const -46
              i32.add
              br_table $B9 $B8 $B8 $B8 $B8 $B8 $B8 $B8 $B8 $B8 $B8 $B8 $B8 $B8 $B8 $B8 $B8 $B8 $B3 $B8
            end
            local.get $l4
            local.set $l5
          end
          local.get $l3
          local.get $l4
          i32.const 1
          i32.add
          local.tee $l4
          i32.ne
          br_if $L7
        end
        i32.const 0
        local.set $l3
        local.get $l5
        i32.const 0
        i32.lt_s
        br_if $B3
        local.get $l5
        local.get $l7
        i32.ne
        local.get $l5
        local.get $l6
        i32.ne
        i32.and
        br_if $B0
      end
      i32.const 1
      local.set $l3
    end
    local.get $p0
    i32.const 64
    i32.add
    local.set $l4
    block $B10
      block $B11
        local.get $l2
        i32.load8_u
        br_if $B11
        local.get $l3
        local.set $l7
        br $B10
      end
      block $B12
        local.get $l2
        call $str_len
        i32.const 7
        i32.le_u
        br_if $B12
        local.get $l3
        local.set $l7
        br $B10
      end
      local.get $l3
      i32.const 1
      i32.add
      local.set $l7
      local.get $l3
      i32.const 2
      i32.or
      local.set $l3
    end
    block $B13
      local.get $l4
      i32.load8_u
      i32.eqz
      br_if $B13
      local.get $l4
      local.get $l2
      call $str_equal
      br_if $B13
      local.get $l7
      i32.const 1
      i32.add
      local.set $l7
      local.get $l3
      i32.const 4
      i32.or
      local.set $l3
    end
    block $B14
      local.get $p0
      i32.load8_u offset=96
      local.tee $l5
      i32.eqz
      br_if $B14
      local.get $p0
      i32.const 97
      i32.add
      local.set $l4
      block $B15
        loop $L16
          block $B17
            local.get $l5
            i32.const 255
            i32.and
            local.tee $l6
            i32.const 32
            i32.eq
            br_if $B17
            local.get $l6
            i32.const 9
            i32.ne
            br_if $B15
          end
          local.get $l4
          i32.load8_u
          local.set $l5
          local.get $l4
          i32.const 1
          i32.add
          local.set $l4
          br $L16
        end
      end
      i32.const 0
      local.set $l6
      block $B18
        local.get $l4
        local.get $l5
        i32.const 255
        i32.and
        i32.const 45
        i32.eq
        local.tee $l2
        i32.add
        local.tee $l4
        i32.const -1
        i32.add
        i32.load8_u
        local.tee $l5
        i32.const -58
        i32.add
        i32.const 255
        i32.and
        i32.const 246
        i32.lt_u
        local.tee $l8
        br_if $B18
        i32.const 0
        local.set $l6
        loop $L19
          local.get $l5
          i32.const 255
          i32.and
          local.get $l6
          i32.const 10
          i32.mul
          i32.add
          i32.const -48
          i32.add
          local.set $l6
          local.get $l4
          i32.load8_u
          local.set $l5
          local.get $l4
          i32.const 1
          i32.add
          local.set $l4
          local.get $l5
          i32.const -48
          i32.add
          i32.const 255
          i32.and
          i32.const 10
          i32.lt_u
          br_if $L19
        end
      end
      local.get $l3
      i32.const 8
      i32.or
      local.get $l3
      local.get $l8
      i32.const 0
      local.get $l6
      i32.sub
      local.get $l6
      local.get $l2
      select
      i32.const 18
      i32.lt_s
      i32.or
      local.tee $l4
      select
      local.set $l3
      local.get $l7
      local.get $l4
      i32.add
      local.set $l7
    end
    block $B20
      local.get $p0
      i32.load8_u offset=224
      local.tee $l4
      i32.eqz
      br_if $B20
      block $B21
        local.get $l4
        i32.const 116
        i32.ne
        br_if $B21
        local.get $p0
        i32.load8_u offset=225
        i32.const 114
        i32.ne
        br_if $B21
        local.get $p0
        i32.load8_u offset=226
        i32.const 117
        i32.ne
        br_if $B21
        local.get $p0
        i32.load8_u offset=227
        i32.const 101
        i32.ne
        br_if $B21
        local.get $p0
        i32.load8_u offset=228
        i32.eqz
        br_if $B20
      end
      local.get $l7
      i32.const 1
      i32.add
      local.set $l7
      local.get $l3
      i32.const 16
      i32.or
      local.set $l3
    end
    local.get $p1
    local.get $l3
    i32.store
    local.get $l7)
  (func $str_len (type $t3) (param $p0 i32) (result i32)
    (local $l1 i32) (local $l2 i32) (local $l3 i32)
    i32.const 0
    local.set $l1
    loop $L0
      local.get $p0
      local.get $l1
      i32.add
      local.set $l2
      local.get $l1
      i32.const 1
      i32.add
      local.tee $l3
      local.set $l1
      local.get $l2
      i32.load8_u
      br_if $L0
    end
    local.get $l3
    i32.const -1
    i32.add)
  (func $str_equal (type $t2) (param $p0 i32) (param $p1 i32) (result i32)
    (local $l2 i32) (local $l3 i32) (local $l4 i32)
    i32.const 0
    local.set $l2
    block $B0
      local.get $p0
      i32.load8_u
      local.tee $l3
      local.get $p1
      i32.load8_u
      i32.ne
      br_if $B0
      local.get $p1
      i32.const 1
      i32.add
      local.set $p1
      local.get $p0
      i32.const 1
      i32.add
      local.set $p0
      block $B1
        loop $L2
          local.get $l3
          i32.const 255
          i32.and
          i32.eqz
          br_if $B1
          local.get $p1
          i32.load8_u
          local.set $l4
          local.get $p0
          i32.load8_u
          local.set $l3
          local.get $p1
          i32.const 1
          i32.add
          local.set $p1
          local.get $p0
          i32.const 1
          i32.add
          local.set $p0
          local.get $l3
          local.get $l4
          i32.ne
          br_if $B0
          br $L2
        end
      end
      i32.const 1
      local.set $l2
    end
    local.get $l2)
  (table $__indirect_function_table 1 1 funcref)
  (memory $memory 1)
  (global $__stack_pointer (mut i32) (i32.const 65536))
  (global $__dso_handle i32 (i32.const 65536))
  (global $__data_end i32 (i32.const 65536))
  (global $__stack_low i32 (i32.const 0))
  (global $__stack_high i32 (i32.const 65536))
  (global $__global_base i32 (i32.const 65536))
  (global $__heap_base i32 (i32.const 65536))
  (global $__heap_end i32 (i32.const 65536))
  (global $__memory_base i32 (i32.const 0))
  (global $__table_base i32 (i32.const 1))
  (global $__wasm_first_page_end i32 (i32.const 65536))
  (export "memory" (memory $memory))
  (export "__wasm_call_ctors" (func $__wasm_call_ctors))
  (export "__stack_pointer" (global $__stack_pointer))
  (export "form_validate_trace" (func $form_validate_trace))
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
