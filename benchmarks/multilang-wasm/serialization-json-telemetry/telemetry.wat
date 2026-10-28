;; serialization.json-telemetry.v1 — kernel: telemetry
;; WebAssembly Text (WAT) baseline implementation
;; Exports: telemetry

(module $telemetry_c.wasm
  (type $t0 (func))
  (type $t1 (func (param i32 i32 i32 i32) (result i32)))
  (type $t2 (func (param i32) (result i32)))
  (type $t3 (func (param i32 i32 i32 i64) (result i32)))
  (type $t4 (func (result i32)))
  (func $__wasm_call_ctors (type $t0))
  (func $process (type $t1) (param $p0 i32) (param $p1 i32) (param $p2 i32) (param $p3 i32) (result i32)
    (local $l4 i32) (local $l5 i32) (local $l6 i64) (local $l7 i32) (local $l8 i32) (local $l9 i32) (local $l10 i32) (local $l11 i32) (local $l12 i32) (local $l13 i32) (local $l14 i32) (local $l15 i32) (local $l16 i64) (local $l17 i64) (local $l18 i64) (local $l19 i32) (local $l20 i32)
    global.get $__stack_pointer
    i32.const 80
    i32.sub
    local.tee $l4
    global.set $__stack_pointer
    i32.const 0
    local.get $p1
    i32.store offset=65696
    i32.const 0
    local.get $p0
    i32.store offset=65692
    i32.const 0
    local.get $p1
    i32.store offset=65708
    i32.const 0
    i32.const 0
    i32.store offset=65700
    i32.const 0
    i32.const 0
    i32.store offset=65704
    i32.const 0
    i32.const 0
    i32.store offset=65712
    i32.const 0
    i32.const 0
    i32.store offset=65716
    i32.const 0
    i32.const 0
    i32.store offset=65720
    local.get $l4
    i32.const 0
    i32.store offset=32
    local.get $l4
    i32.const 0
    i32.store offset=28
    local.get $l4
    i32.const 0
    i32.store offset=24
    local.get $l4
    i32.const 0
    i32.store offset=20
    local.get $l4
    i32.const 0
    i32.store offset=16
    local.get $l4
    i32.const 0
    i32.store offset=12
    local.get $l4
    i32.const 0
    i32.store offset=8
    i32.const -1
    local.set $l5
    block $B0
      local.get $p1
      i32.eqz
      br_if $B0
      local.get $p0
      i32.load8_u
      i32.const 91
      i32.ne
      br_if $B0
      i32.const 0
      i32.const 1
      i32.store offset=65700
      block $B1
        local.get $p1
        i32.const 1
        i32.ne
        br_if $B1
        i32.const -14
        local.set $l5
        br $B0
      end
      i64.const 0
      local.set $l6
      i32.const 1
      local.set $l7
      i32.const 0
      local.set $l8
      i32.const 0
      local.set $l9
      i32.const 0
      local.set $l10
      i32.const 0
      local.set $l11
      i32.const 0
      local.set $l12
      block $B2
        loop $L3
          local.get $p0
          local.get $l7
          i32.add
          i32.load8_u
          local.tee $l5
          i32.const 93
          i32.eq
          br_if $B2
          block $B4
            local.get $l10
            i32.eqz
            br_if $B4
            block $B5
              local.get $l5
              i32.const 44
              i32.eq
              br_if $B5
              i32.const -2
              local.set $l5
              br $B0
            end
            i32.const 0
            local.get $l7
            i32.const 1
            i32.add
            local.tee $l7
            i32.store offset=65700
          end
          i32.const -3
          local.set $l5
          local.get $p1
          local.get $l7
          i32.le_u
          br_if $B0
          local.get $p0
          local.get $l7
          i32.add
          i32.load8_u
          i32.const 123
          i32.ne
          br_if $B0
          i32.const 0
          local.get $l7
          i32.const 1
          i32.add
          local.tee $l13
          i32.store offset=65700
          i32.const 0
          local.get $p1
          local.get $l7
          i32.sub
          local.tee $l14
          local.get $l14
          local.get $p1
          i32.gt_u
          select
          local.tee $l14
          i32.const 1
          i32.eq
          br_if $B0
          local.get $p0
          local.get $l13
          i32.add
          i32.load8_u
          i32.const 34
          i32.ne
          br_if $B0
          i32.const 0
          local.get $l7
          i32.const 2
          i32.add
          local.tee $l13
          i32.store offset=65700
          local.get $l14
          i32.const 2
          i32.eq
          br_if $B0
          local.get $p0
          local.get $l13
          i32.add
          i32.load8_u
          i32.const 105
          i32.ne
          br_if $B0
          i32.const 0
          local.get $l7
          i32.const 3
          i32.add
          local.tee $l13
          i32.store offset=65700
          local.get $l14
          i32.const 3
          i32.eq
          br_if $B0
          local.get $p0
          local.get $l13
          i32.add
          i32.load8_u
          i32.const 100
          i32.ne
          br_if $B0
          i32.const 0
          local.get $l7
          i32.const 4
          i32.add
          local.tee $l13
          i32.store offset=65700
          local.get $l14
          i32.const 4
          i32.eq
          br_if $B0
          local.get $p0
          local.get $l13
          i32.add
          i32.load8_u
          i32.const 34
          i32.ne
          br_if $B0
          i32.const 0
          local.get $l7
          i32.const 5
          i32.add
          local.tee $l13
          i32.store offset=65700
          local.get $l14
          i32.const 5
          i32.eq
          br_if $B0
          local.get $p0
          local.get $l13
          i32.add
          i32.load8_u
          i32.const 58
          i32.ne
          br_if $B0
          i32.const 0
          local.get $l7
          i32.const 6
          i32.add
          local.tee $l13
          i32.store offset=65700
          i32.const -4
          local.set $l5
          local.get $l13
          local.get $p1
          i32.ge_u
          br_if $B0
          local.get $p0
          local.get $l13
          i32.add
          local.set $l15
          i64.const 0
          local.set $l16
          local.get $l13
          local.set $l7
          block $B6
            loop $L7
              local.get $p0
              local.get $l7
              i32.add
              i32.load8_u
              local.tee $l14
              i32.const -48
              i32.add
              i32.const 255
              i32.and
              i32.const 9
              i32.gt_u
              br_if $B6
              block $B8
                local.get $l7
                local.get $l13
                i32.le_u
                br_if $B8
                local.get $l15
                i32.load8_u
                i32.const 48
                i32.eq
                br_if $B0
              end
              local.get $l16
              i64.const 10
              i64.mul
              local.get $l14
              i64.extend_i32_u
              i64.const 255
              i64.and
              i64.add
              i64.const -48
              i64.add
              local.tee $l17
              local.get $l16
              i64.lt_u
              br_if $B0
              i32.const 0
              local.get $l7
              i32.const 1
              i32.add
              local.tee $l7
              i32.store offset=65700
              local.get $l17
              local.set $l16
              local.get $p1
              local.get $l7
              i32.ne
              br_if $L7
            end
            local.get $p1
            local.set $l7
            local.get $l17
            local.set $l16
          end
          local.get $l16
          local.get $l10
          i64.extend_i32_u
          i64.ne
          br_if $B0
          local.get $l7
          local.get $l13
          i32.eq
          br_if $B0
          i32.const -5
          local.set $l5
          local.get $p1
          local.get $l7
          i32.le_u
          br_if $B0
          local.get $p0
          local.get $l7
          i32.add
          i32.load8_u
          i32.const 44
          i32.ne
          br_if $B0
          i32.const 0
          local.get $l7
          i32.const 1
          i32.add
          local.tee $l13
          i32.store offset=65700
          i32.const 0
          local.get $p1
          local.get $l7
          i32.sub
          local.tee $l14
          local.get $l14
          local.get $p1
          i32.gt_u
          select
          local.tee $l14
          i32.const 1
          i32.eq
          br_if $B0
          local.get $p0
          local.get $l13
          i32.add
          i32.load8_u
          i32.const 34
          i32.ne
          br_if $B0
          i32.const 0
          local.get $l7
          i32.const 2
          i32.add
          local.tee $l13
          i32.store offset=65700
          local.get $l14
          i32.const 2
          i32.eq
          br_if $B0
          local.get $p0
          local.get $l13
          i32.add
          i32.load8_u
          i32.const 116
          i32.ne
          br_if $B0
          i32.const 0
          local.get $l7
          i32.const 3
          i32.add
          local.tee $l13
          i32.store offset=65700
          local.get $l14
          i32.const 3
          i32.eq
          br_if $B0
          local.get $p0
          local.get $l13
          i32.add
          i32.load8_u
          i32.const 115
          i32.ne
          br_if $B0
          i32.const 0
          local.get $l7
          i32.const 4
          i32.add
          local.tee $l13
          i32.store offset=65700
          local.get $l14
          i32.const 4
          i32.eq
          br_if $B0
          local.get $p0
          local.get $l13
          i32.add
          i32.load8_u
          i32.const 34
          i32.ne
          br_if $B0
          i32.const 0
          local.get $l7
          i32.const 5
          i32.add
          local.tee $l13
          i32.store offset=65700
          local.get $l14
          i32.const 5
          i32.eq
          br_if $B0
          local.get $p0
          local.get $l13
          i32.add
          i32.load8_u
          i32.const 58
          i32.ne
          br_if $B0
          i32.const 0
          local.get $l7
          i32.const 6
          i32.add
          local.tee $l13
          i32.store offset=65700
          local.get $l13
          local.get $p1
          i32.ge_u
          br_if $B0
          local.get $p0
          local.get $l13
          i32.add
          local.set $l15
          i64.const 0
          local.set $l17
          local.get $l13
          local.set $l7
          block $B9
            loop $L10
              local.get $p0
              local.get $l7
              i32.add
              i32.load8_u
              local.tee $l14
              i32.const -48
              i32.add
              i32.const 255
              i32.and
              i32.const 9
              i32.gt_u
              br_if $B9
              block $B11
                local.get $l7
                local.get $l13
                i32.le_u
                br_if $B11
                local.get $l15
                i32.load8_u
                i32.const 48
                i32.eq
                br_if $B0
              end
              local.get $l17
              i64.const 10
              i64.mul
              local.get $l14
              i64.extend_i32_u
              i64.const 255
              i64.and
              i64.add
              i64.const -48
              i64.add
              local.tee $l18
              local.get $l17
              i64.lt_u
              br_if $B0
              i32.const 0
              local.get $l7
              i32.const 1
              i32.add
              local.tee $l7
              i32.store offset=65700
              local.get $l18
              local.set $l17
              local.get $p1
              local.get $l7
              i32.ne
              br_if $L10
            end
            local.get $p1
            local.set $l7
            local.get $l18
            local.set $l17
          end
          local.get $l17
          local.get $l16
          i64.const 1700000000
          i64.add
          i64.ne
          br_if $B0
          local.get $l7
          local.get $l13
          i32.eq
          br_if $B0
          i32.const -6
          local.set $l5
          local.get $p1
          local.get $l7
          i32.le_u
          br_if $B0
          local.get $p0
          local.get $l7
          i32.add
          i32.load8_u
          i32.const 44
          i32.ne
          br_if $B0
          i32.const 0
          local.get $l7
          i32.const 1
          i32.add
          local.tee $l13
          i32.store offset=65700
          i32.const 0
          local.get $p1
          local.get $l7
          i32.sub
          local.tee $l14
          local.get $l14
          local.get $p1
          i32.gt_u
          select
          local.tee $l14
          i32.const 1
          i32.eq
          br_if $B0
          local.get $p0
          local.get $l13
          i32.add
          i32.load8_u
          i32.const 34
          i32.ne
          br_if $B0
          i32.const 0
          local.get $l7
          i32.const 2
          i32.add
          local.tee $l13
          i32.store offset=65700
          local.get $l14
          i32.const 2
          i32.eq
          br_if $B0
          local.get $p0
          local.get $l13
          i32.add
          i32.load8_u
          i32.const 114
          i32.ne
          br_if $B0
          i32.const 0
          local.get $l7
          i32.const 3
          i32.add
          local.tee $l13
          i32.store offset=65700
          local.get $l14
          i32.const 3
          i32.eq
          br_if $B0
          local.get $p0
          local.get $l13
          i32.add
          i32.load8_u
          i32.const 101
          i32.ne
          br_if $B0
          i32.const 0
          local.get $l7
          i32.const 4
          i32.add
          local.tee $l13
          i32.store offset=65700
          local.get $l14
          i32.const 4
          i32.eq
          br_if $B0
          local.get $p0
          local.get $l13
          i32.add
          i32.load8_u
          i32.const 103
          i32.ne
          br_if $B0
          i32.const 0
          local.get $l7
          i32.const 5
          i32.add
          local.tee $l13
          i32.store offset=65700
          local.get $l14
          i32.const 5
          i32.eq
          br_if $B0
          local.get $p0
          local.get $l13
          i32.add
          i32.load8_u
          i32.const 105
          i32.ne
          br_if $B0
          i32.const 0
          local.get $l7
          i32.const 6
          i32.add
          local.tee $l13
          i32.store offset=65700
          local.get $l14
          i32.const 6
          i32.eq
          br_if $B0
          local.get $p0
          local.get $l13
          i32.add
          i32.load8_u
          i32.const 111
          i32.ne
          br_if $B0
          i32.const 0
          local.get $l7
          i32.const 7
          i32.add
          local.tee $l13
          i32.store offset=65700
          local.get $l14
          i32.const 7
          i32.eq
          br_if $B0
          local.get $p0
          local.get $l13
          i32.add
          i32.load8_u
          i32.const 110
          i32.ne
          br_if $B0
          i32.const 0
          local.get $l7
          i32.const 8
          i32.add
          local.tee $l13
          i32.store offset=65700
          local.get $l14
          i32.const 8
          i32.eq
          br_if $B0
          local.get $p0
          local.get $l13
          i32.add
          i32.load8_u
          i32.const 34
          i32.ne
          br_if $B0
          i32.const 0
          local.get $l7
          i32.const 9
          i32.add
          local.tee $l13
          i32.store offset=65700
          local.get $l14
          i32.const 9
          i32.eq
          br_if $B0
          local.get $p0
          local.get $l13
          i32.add
          i32.load8_u
          i32.const 58
          i32.ne
          br_if $B0
          i32.const 0
          local.get $l7
          i32.const 10
          i32.add
          local.tee $l14
          i32.store offset=65700
          i32.const -7
          local.set $l5
          local.get $l14
          local.get $p1
          i32.ge_u
          br_if $B0
          local.get $p0
          local.get $l14
          i32.add
          i32.load8_u
          i32.const 34
          i32.ne
          br_if $B0
          local.get $l7
          i32.const 11
          i32.add
          local.set $l13
          block $B12
            block $B13
              local.get $l7
              i32.const 13
              i32.add
              local.get $p1
              i32.ge_u
              br_if $B13
              block $B14
                block $B15
                  local.get $p0
                  local.get $l13
                  i32.add
                  local.tee $l14
                  i32.load8_u
                  i32.const 97
                  i32.ne
                  br_if $B15
                  local.get $l14
                  i32.const 1
                  i32.add
                  i32.load8_u
                  i32.const 112
                  i32.ne
                  br_if $B15
                  local.get $l14
                  i32.const 2
                  i32.add
                  i32.load8_u
                  i32.const 34
                  i32.ne
                  br_if $B15
                  local.get $l4
                  i32.const 32
                  i32.add
                  local.set $l15
                  br $B14
                end
                i32.const 0
                local.get $l13
                i32.store offset=65700
                block $B16
                  local.get $l14
                  i32.load8_u
                  i32.const 101
                  i32.ne
                  br_if $B16
                  local.get $l14
                  i32.const 1
                  i32.add
                  i32.load8_u
                  i32.const 117
                  i32.ne
                  br_if $B16
                  local.get $l14
                  i32.const 2
                  i32.add
                  i32.load8_u
                  i32.const 34
                  i32.ne
                  br_if $B16
                  local.get $l4
                  i32.const 28
                  i32.add
                  local.set $l15
                  br $B14
                end
                block $B17
                  local.get $l14
                  i32.load8_u
                  i32.const 110
                  i32.ne
                  br_if $B17
                  local.get $l14
                  i32.const 1
                  i32.add
                  i32.load8_u
                  i32.const 97
                  i32.ne
                  br_if $B17
                  local.get $l14
                  i32.const 2
                  i32.add
                  i32.load8_u
                  i32.const 34
                  i32.ne
                  br_if $B17
                  local.get $l4
                  i32.const 24
                  i32.add
                  local.set $l15
                  br $B14
                end
                local.get $l14
                i32.load8_u
                i32.const 115
                i32.ne
                br_if $B13
                local.get $l14
                i32.const 1
                i32.add
                i32.load8_u
                i32.const 97
                i32.ne
                br_if $B13
                local.get $l14
                i32.const 2
                i32.add
                i32.load8_u
                i32.const 34
                i32.ne
                br_if $B13
                local.get $l4
                i32.const 20
                i32.add
                local.set $l15
              end
              i32.const 0
              local.get $l7
              i32.const 14
              i32.add
              local.tee $l14
              i32.store offset=65700
              i32.const -8
              local.set $l5
              local.get $p1
              local.get $l14
              i32.le_u
              br_if $B0
              local.get $p0
              local.get $l14
              i32.add
              i32.load8_u
              i32.const 44
              i32.ne
              br_if $B0
              i32.const 0
              local.get $l7
              i32.const 15
              i32.add
              local.tee $l13
              i32.store offset=65700
              i32.const 0
              local.get $p1
              local.get $l14
              i32.sub
              local.tee $l14
              local.get $l14
              local.get $p1
              i32.gt_u
              select
              local.tee $l14
              i32.const 1
              i32.eq
              br_if $B0
              local.get $p0
              local.get $l13
              i32.add
              i32.load8_u
              i32.const 34
              i32.ne
              br_if $B0
              i32.const 0
              local.get $l7
              i32.const 16
              i32.add
              local.tee $l13
              i32.store offset=65700
              local.get $l14
              i32.const 2
              i32.eq
              br_if $B0
              local.get $p0
              local.get $l13
              i32.add
              i32.load8_u
              i32.const 107
              i32.ne
              br_if $B0
              i32.const 0
              local.get $l7
              i32.const 17
              i32.add
              local.tee $l13
              i32.store offset=65700
              local.get $l14
              i32.const 3
              i32.eq
              br_if $B0
              local.get $p0
              local.get $l13
              i32.add
              i32.load8_u
              i32.const 105
              i32.ne
              br_if $B0
              i32.const 0
              local.get $l7
              i32.const 18
              i32.add
              local.tee $l13
              i32.store offset=65700
              local.get $l14
              i32.const 4
              i32.eq
              br_if $B0
              local.get $p0
              local.get $l13
              i32.add
              i32.load8_u
              i32.const 110
              i32.ne
              br_if $B0
              i32.const 0
              local.get $l7
              i32.const 19
              i32.add
              local.tee $l13
              i32.store offset=65700
              local.get $l14
              i32.const 5
              i32.eq
              br_if $B0
              local.get $p0
              local.get $l13
              i32.add
              i32.load8_u
              i32.const 100
              i32.ne
              br_if $B0
              i32.const 0
              local.get $l7
              i32.const 20
              i32.add
              local.tee $l13
              i32.store offset=65700
              local.get $l14
              i32.const 6
              i32.eq
              br_if $B0
              local.get $p0
              local.get $l13
              i32.add
              i32.load8_u
              i32.const 34
              i32.ne
              br_if $B0
              i32.const 0
              local.get $l7
              i32.const 21
              i32.add
              local.tee $l13
              i32.store offset=65700
              local.get $l14
              i32.const 7
              i32.eq
              br_if $B0
              local.get $p0
              local.get $l13
              i32.add
              i32.load8_u
              i32.const 58
              i32.ne
              br_if $B0
              i32.const 0
              local.get $l7
              i32.const 22
              i32.add
              local.tee $l14
              i32.store offset=65700
              local.get $l14
              local.get $p1
              i32.ge_u
              br_if $B0
              local.get $p0
              local.get $l14
              i32.add
              i32.load8_u
              i32.const 34
              i32.ne
              br_if $B0
              local.get $p0
              local.get $l7
              i32.const 23
              i32.add
              local.tee $l19
              i32.add
              local.set $l13
              block $B18
                block $B19
                  local.get $l7
                  i32.const 28
                  i32.add
                  local.tee $l14
                  local.get $p1
                  i32.ge_u
                  br_if $B19
                  local.get $l13
                  i32.load8_u
                  i32.const 99
                  i32.ne
                  br_if $B19
                  local.get $l13
                  i32.const 1
                  i32.add
                  i32.load8_u
                  i32.const 108
                  i32.ne
                  br_if $B19
                  local.get $l13
                  i32.const 2
                  i32.add
                  i32.load8_u
                  i32.const 105
                  i32.ne
                  br_if $B19
                  local.get $l13
                  i32.const 3
                  i32.add
                  i32.load8_u
                  i32.const 99
                  i32.ne
                  br_if $B19
                  local.get $l13
                  i32.const 4
                  i32.add
                  i32.load8_u
                  i32.const 107
                  i32.ne
                  br_if $B19
                  local.get $l13
                  i32.const 5
                  i32.add
                  i32.load8_u
                  i32.const 34
                  i32.ne
                  br_if $B19
                  local.get $l4
                  i32.const 16
                  i32.add
                  local.set $l19
                  br $B18
                end
                i32.const 0
                local.get $l19
                i32.store offset=65700
                block $B20
                  local.get $l7
                  i32.const 31
                  i32.add
                  local.tee $l14
                  local.get $p1
                  i32.ge_u
                  br_if $B20
                  local.get $l13
                  i32.load8_u
                  i32.const 112
                  i32.ne
                  br_if $B20
                  local.get $l13
                  i32.const 1
                  i32.add
                  i32.load8_u
                  i32.const 117
                  i32.ne
                  br_if $B20
                  local.get $l13
                  i32.const 2
                  i32.add
                  i32.load8_u
                  i32.const 114
                  i32.ne
                  br_if $B20
                  local.get $l13
                  i32.const 3
                  i32.add
                  i32.load8_u
                  i32.const 99
                  i32.ne
                  br_if $B20
                  local.get $l13
                  i32.const 4
                  i32.add
                  i32.load8_u
                  i32.const 104
                  i32.ne
                  br_if $B20
                  local.get $l13
                  i32.const 5
                  i32.add
                  i32.load8_u
                  i32.const 97
                  i32.ne
                  br_if $B20
                  local.get $l13
                  i32.const 6
                  i32.add
                  i32.load8_u
                  i32.const 115
                  i32.ne
                  br_if $B20
                  local.get $l13
                  i32.const 7
                  i32.add
                  i32.load8_u
                  i32.const 101
                  i32.ne
                  br_if $B20
                  local.get $l13
                  i32.const 8
                  i32.add
                  i32.load8_u
                  i32.const 34
                  i32.ne
                  br_if $B20
                  local.get $l4
                  i32.const 12
                  i32.add
                  local.set $l19
                  br $B18
                end
                local.get $l7
                i32.const 27
                i32.add
                local.tee $l14
                local.get $p1
                i32.ge_u
                br_if $B0
                local.get $l13
                i32.load8_u
                i32.const 118
                i32.ne
                br_if $B0
                local.get $l13
                i32.const 1
                i32.add
                i32.load8_u
                i32.const 105
                i32.ne
                br_if $B0
                local.get $l13
                i32.const 2
                i32.add
                i32.load8_u
                i32.const 101
                i32.ne
                br_if $B0
                local.get $l13
                i32.const 3
                i32.add
                i32.load8_u
                i32.const 119
                i32.ne
                br_if $B0
                local.get $l13
                i32.const 4
                i32.add
                i32.load8_u
                i32.const 34
                i32.ne
                br_if $B0
                local.get $l4
                i32.const 8
                i32.add
                local.set $l19
              end
              i32.const 0
              local.get $l14
              i32.const 1
              i32.add
              local.tee $l7
              i32.store offset=65700
              i32.const -9
              local.set $l5
              local.get $p1
              local.get $l7
              i32.le_u
              br_if $B0
              local.get $p0
              local.get $l7
              i32.add
              i32.load8_u
              i32.const 44
              i32.ne
              br_if $B0
              i32.const 0
              local.get $l14
              i32.const 2
              i32.add
              local.tee $l13
              i32.store offset=65700
              i32.const 0
              local.get $p1
              local.get $l7
              i32.sub
              local.tee $l7
              local.get $l7
              local.get $p1
              i32.gt_u
              select
              local.tee $l7
              i32.const 1
              i32.eq
              br_if $B0
              local.get $p0
              local.get $l13
              i32.add
              i32.load8_u
              i32.const 34
              i32.ne
              br_if $B0
              i32.const 0
              local.get $l14
              i32.const 3
              i32.add
              local.tee $l13
              i32.store offset=65700
              local.get $l7
              i32.const 2
              i32.eq
              br_if $B0
              local.get $p0
              local.get $l13
              i32.add
              i32.load8_u
              i32.const 111
              i32.ne
              br_if $B0
              i32.const 0
              local.get $l14
              i32.const 4
              i32.add
              local.tee $l13
              i32.store offset=65700
              local.get $l7
              i32.const 3
              i32.eq
              br_if $B0
              local.get $p0
              local.get $l13
              i32.add
              i32.load8_u
              i32.const 107
              i32.ne
              br_if $B0
              i32.const 0
              local.get $l14
              i32.const 5
              i32.add
              local.tee $l13
              i32.store offset=65700
              local.get $l7
              i32.const 4
              i32.eq
              br_if $B0
              local.get $p0
              local.get $l13
              i32.add
              i32.load8_u
              i32.const 34
              i32.ne
              br_if $B0
              i32.const 0
              local.get $l14
              i32.const 6
              i32.add
              local.tee $l13
              i32.store offset=65700
              local.get $l7
              i32.const 5
              i32.eq
              br_if $B0
              local.get $p0
              local.get $l13
              i32.add
              i32.load8_u
              i32.const 58
              i32.ne
              br_if $B0
              i32.const 0
              local.get $l14
              i32.const 7
              i32.add
              local.tee $l7
              i32.store offset=65700
              local.get $p1
              local.get $l7
              i32.le_u
              br_if $B0
              i32.const 0
              local.get $p1
              local.get $l7
              i32.sub
              local.tee $l13
              local.get $l13
              local.get $p1
              i32.gt_u
              select
              local.set $l13
              block $B21
                block $B22
                  block $B23
                    local.get $p0
                    local.get $l7
                    i32.add
                    local.tee $l20
                    i32.load8_u
                    i32.const -102
                    i32.add
                    br_table $B22 $B0 $B0 $B0 $B0 $B0 $B0 $B0 $B0 $B0 $B0 $B0 $B0 $B0 $B23 $B0
                  end
                  local.get $l13
                  i32.const 1
                  i32.eq
                  br_if $B0
                  local.get $l13
                  i32.const 2
                  i32.eq
                  br_if $B0
                  local.get $l20
                  i32.load8_u offset=1
                  i32.const 255
                  i32.and
                  i32.const 114
                  i32.ne
                  br_if $B0
                  local.get $l13
                  i32.const 3
                  i32.eq
                  br_if $B0
                  local.get $l20
                  i32.load8_u offset=2
                  i32.const 255
                  i32.and
                  i32.const 117
                  i32.ne
                  br_if $B0
                  local.get $l20
                  i32.load8_u offset=3
                  i32.const 101
                  i32.ne
                  br_if $B0
                  i32.const 1
                  local.set $l14
                  i32.const 0
                  local.set $l13
                  i32.const 4
                  local.set $l5
                  br $B21
                end
                i32.const 0
                local.get $l14
                i32.const 8
                i32.add
                local.tee $l20
                i32.store offset=65700
                local.get $l13
                i32.const 1
                i32.eq
                br_if $B0
                local.get $p0
                local.get $l20
                i32.add
                i32.load8_u
                i32.const 97
                i32.ne
                br_if $B0
                i32.const 0
                local.get $l14
                i32.const 9
                i32.add
                local.tee $l20
                i32.store offset=65700
                local.get $l13
                i32.const 2
                i32.eq
                br_if $B0
                local.get $p0
                local.get $l20
                i32.add
                i32.load8_u
                i32.const 108
                i32.ne
                br_if $B0
                i32.const 0
                local.get $l14
                i32.const 10
                i32.add
                local.tee $l20
                i32.store offset=65700
                local.get $l13
                i32.const 3
                i32.eq
                br_if $B0
                local.get $p0
                local.get $l20
                i32.add
                i32.load8_u
                i32.const 115
                i32.ne
                br_if $B0
                i32.const 0
                local.get $l14
                i32.const 11
                i32.add
                local.tee $l14
                i32.store offset=65700
                local.get $l13
                i32.const 4
                i32.eq
                br_if $B0
                local.get $p0
                local.get $l14
                i32.add
                i32.load8_u
                i32.const 101
                i32.ne
                br_if $B0
                i32.const 0
                local.set $l14
                i32.const 1
                local.set $l13
                i32.const 5
                local.set $l5
              end
              i32.const 0
              local.get $l5
              local.get $l7
              i32.add
              i32.store offset=65700
              i32.const -10
              local.set $l5
              i32.const 65565
              call $expect_ascii
              i32.eqz
              br_if $B0
              local.get $l4
              i32.const 48
              i32.add
              call $parse_uint
              i32.eqz
              br_if $B0
              local.get $l4
              i64.load offset=48
              local.tee $l16
              i64.const 9999
              i64.gt_u
              br_if $B0
              i32.const -11
              local.set $l5
              i32.const 65539
              call $expect_ascii
              i32.eqz
              br_if $B0
              i32.const 65584
              i32.const 65600
              i32.const 4
              local.get $l4
              i32.const 4
              i32.add
              call $parse_option
              i32.eqz
              br_if $B0
              i32.const -12
              local.set $l5
              i32.const 65557
              call $expect_ascii
              i32.eqz
              br_if $B0
              i32.const 65616
              i32.const 65632
              i32.const 4
              local.get $l4
              i32.const 4
              i32.add
              call $parse_option
              i32.eqz
              br_if $B0
              i32.const 65536
              call $expect_ascii
              br_if $B12
              i32.const -13
              local.set $l5
              br $B0
            end
            i32.const 0
            local.get $l13
            i32.store offset=65700
            br $B0
          end
          i32.const 0
          local.get $l11
          i32.const 3
          i32.add
          local.tee $l11
          i32.store offset=65712
          i32.const 0
          local.get $l10
          i32.const 1
          i32.add
          local.tee $l10
          i32.store offset=65704
          i32.const 0
          local.get $l12
          i32.const 4
          i32.add
          local.tee $l12
          i32.store offset=65716
          i32.const 0
          local.get $l10
          i32.store offset=65720
          local.get $l15
          local.get $l15
          i32.load
          i32.const 1
          i32.add
          i32.store
          local.get $l19
          local.get $l19
          i32.load
          i32.const 1
          i32.add
          i32.store
          local.get $l16
          local.get $l6
          i64.add
          local.set $l6
          local.get $l13
          local.get $l8
          i32.add
          local.set $l8
          local.get $l14
          local.get $l9
          i32.add
          local.set $l9
          i32.const 0
          i32.load offset=65700
          local.tee $l7
          local.get $p1
          i32.lt_u
          br_if $L3
        end
        i32.const -14
        local.set $l5
        br $B0
      end
      i32.const 0
      local.get $l7
      i32.const 1
      i32.add
      local.tee $p0
      i32.store offset=65700
      i32.const -14
      local.set $l5
      local.get $p0
      local.get $p1
      i32.ne
      br_if $B0
      i32.const -15
      local.set $l5
      local.get $p3
      i32.eqz
      br_if $B0
      local.get $p2
      i32.const 123
      i32.store8
      local.get $p3
      i32.const 1
      i32.eq
      br_if $B0
      local.get $p2
      i32.const 34
      i32.store8 offset=1
      local.get $p3
      i32.const 2
      i32.eq
      br_if $B0
      local.get $p2
      i32.const 99
      i32.store8 offset=2
      local.get $p3
      i32.const 3
      i32.eq
      br_if $B0
      local.get $p2
      i32.const 111
      i32.store8 offset=3
      local.get $p3
      i32.const 4
      i32.eq
      br_if $B0
      local.get $p2
      i32.const 117
      i32.store8 offset=4
      local.get $p3
      i32.const 5
      i32.eq
      br_if $B0
      local.get $p2
      i32.const 110
      i32.store8 offset=5
      local.get $p3
      i32.const 6
      i32.eq
      br_if $B0
      local.get $p2
      i32.const 116
      i32.store8 offset=6
      local.get $p3
      i32.const 7
      i32.eq
      br_if $B0
      local.get $p2
      i32.const 34
      i32.store8 offset=7
      local.get $p3
      i32.const 8
      i32.eq
      br_if $B0
      local.get $p2
      i32.const 58
      i32.store8 offset=8
      i32.const 0
      local.set $p1
      i32.const 0
      i64.load32_u offset=65704
      local.set $l16
      loop $L24
        local.get $l4
        i32.const 48
        i32.add
        local.get $p1
        i32.add
        local.get $l16
        local.get $l16
        i64.const 10
        i64.div_u
        local.tee $l17
        i64.const 10
        i64.mul
        i64.sub
        i32.wrap_i64
        i32.const 48
        i32.or
        i32.store8
        local.get $p1
        i32.const 1
        i32.add
        local.set $p1
        local.get $l16
        i64.const 9
        i64.gt_u
        local.set $p0
        local.get $l17
        local.set $l16
        local.get $p0
        br_if $L24
      end
      block $B25
        block $B26
          local.get $p1
          br_if $B26
          i32.const 9
          local.set $p1
          br $B25
        end
        local.get $p3
        i32.const -9
        i32.add
        local.set $l14
        local.get $p2
        i32.const 9
        i32.add
        local.set $l13
        local.get $l4
        i32.const 48
        i32.add
        i32.const -1
        i32.add
        local.set $l7
        i32.const 0
        local.set $p0
        loop $L27
          local.get $l14
          local.get $p0
          i32.eq
          br_if $B0
          local.get $l13
          local.get $p0
          i32.add
          local.get $l7
          local.get $p1
          i32.add
          i32.load8_u
          i32.store8
          local.get $l7
          i32.const -1
          i32.add
          local.set $l7
          local.get $p1
          local.get $p0
          i32.const 1
          i32.add
          local.tee $p0
          i32.ne
          br_if $L27
        end
        local.get $l4
        local.get $p0
        i32.const 9
        i32.add
        local.tee $p1
        i32.store offset=4
      end
      local.get $p3
      local.get $p1
      i32.le_u
      br_if $B0
      local.get $p2
      local.get $p1
      i32.add
      local.tee $l7
      i32.const 44
      i32.store8
      i32.const 0
      local.get $p3
      local.get $p1
      i32.sub
      local.tee $p0
      local.get $p0
      local.get $p3
      i32.gt_u
      select
      local.tee $p0
      i32.const 1
      i32.eq
      br_if $B0
      local.get $l7
      i32.const 34
      i32.store8 offset=1
      local.get $p0
      i32.const 2
      i32.eq
      br_if $B0
      local.get $l7
      i32.const 101
      i32.store8 offset=2
      local.get $p0
      i32.const 3
      i32.eq
      br_if $B0
      local.get $l7
      i32.const 114
      i32.store8 offset=3
      local.get $p0
      i32.const 4
      i32.eq
      br_if $B0
      local.get $l7
      i32.const 114
      i32.store8 offset=4
      local.get $p0
      i32.const 5
      i32.eq
      br_if $B0
      local.get $l7
      i32.const 111
      i32.store8 offset=5
      local.get $p0
      i32.const 6
      i32.eq
      br_if $B0
      local.get $l7
      i32.const 114
      i32.store8 offset=6
      local.get $p0
      i32.const 7
      i32.eq
      br_if $B0
      local.get $l7
      i32.const 67
      i32.store8 offset=7
      local.get $p0
      i32.const 8
      i32.eq
      br_if $B0
      local.get $l7
      i32.const 111
      i32.store8 offset=8
      local.get $p0
      i32.const 9
      i32.eq
      br_if $B0
      local.get $l7
      i32.const 117
      i32.store8 offset=9
      local.get $p0
      i32.const 10
      i32.eq
      br_if $B0
      local.get $l7
      i32.const 110
      i32.store8 offset=10
      local.get $p0
      i32.const 11
      i32.eq
      br_if $B0
      local.get $l7
      i32.const 116
      i32.store8 offset=11
      local.get $p0
      i32.const 12
      i32.eq
      br_if $B0
      local.get $l7
      i32.const 34
      i32.store8 offset=12
      local.get $p0
      i32.const 13
      i32.eq
      br_if $B0
      local.get $l7
      i32.const 58
      i32.store8 offset=13
      local.get $p1
      i32.const 14
      i32.add
      local.set $l7
      local.get $l8
      i64.extend_i32_u
      local.set $l16
      i32.const 0
      local.set $p1
      loop $L28
        local.get $l4
        i32.const 48
        i32.add
        local.get $p1
        i32.add
        local.get $l16
        local.get $l16
        i64.const 10
        i64.div_u
        local.tee $l17
        i64.const 10
        i64.mul
        i64.sub
        i32.wrap_i64
        i32.const 48
        i32.or
        i32.store8
        local.get $p1
        i32.const 1
        i32.add
        local.set $p1
        local.get $l16
        i64.const 9
        i64.gt_u
        local.set $p0
        local.get $l17
        local.set $l16
        local.get $p0
        br_if $L28
      end
      block $B29
        local.get $p1
        i32.eqz
        br_if $B29
        local.get $l7
        local.get $p3
        local.get $l7
        local.get $p3
        i32.gt_u
        select
        local.set $p0
        local.get $l4
        i32.const 48
        i32.add
        i32.const -1
        i32.add
        local.set $l14
        loop $L30
          local.get $p0
          local.get $l7
          i32.eq
          br_if $B0
          local.get $p2
          local.get $l7
          i32.add
          local.get $l14
          local.get $p1
          i32.add
          i32.load8_u
          i32.store8
          local.get $l7
          i32.const 1
          i32.add
          local.set $l7
          local.get $p1
          i32.const -1
          i32.add
          local.tee $p1
          br_if $L30
        end
        local.get $l4
        local.get $l7
        i32.store offset=4
      end
      local.get $p3
      local.get $l7
      i32.le_u
      br_if $B0
      local.get $p2
      local.get $l7
      i32.add
      local.tee $p0
      i32.const 44
      i32.store8
      i32.const 0
      local.get $p3
      local.get $l7
      i32.sub
      local.tee $p1
      local.get $p1
      local.get $p3
      i32.gt_u
      select
      local.tee $p1
      i32.const 1
      i32.eq
      br_if $B0
      local.get $p0
      i32.const 34
      i32.store8 offset=1
      local.get $p1
      i32.const 2
      i32.eq
      br_if $B0
      local.get $p0
      i32.const 107
      i32.store8 offset=2
      local.get $p1
      i32.const 3
      i32.eq
      br_if $B0
      local.get $p0
      i32.const 105
      i32.store8 offset=3
      local.get $p1
      i32.const 4
      i32.eq
      br_if $B0
      local.get $p0
      i32.const 110
      i32.store8 offset=4
      local.get $p1
      i32.const 5
      i32.eq
      br_if $B0
      local.get $p0
      i32.const 100
      i32.store8 offset=5
      local.get $p1
      i32.const 6
      i32.eq
      br_if $B0
      local.get $p0
      i32.const 34
      i32.store8 offset=6
      local.get $p1
      i32.const 7
      i32.eq
      br_if $B0
      local.get $p0
      i32.const 58
      i32.store8 offset=7
      local.get $p1
      i32.const 8
      i32.eq
      br_if $B0
      local.get $p0
      i32.const 123
      i32.store8 offset=8
      local.get $p1
      i32.const 9
      i32.eq
      br_if $B0
      local.get $p0
      i32.const 34
      i32.store8 offset=9
      local.get $p1
      i32.const 10
      i32.eq
      br_if $B0
      local.get $p0
      i32.const 99
      i32.store8 offset=10
      local.get $p1
      i32.const 11
      i32.eq
      br_if $B0
      local.get $p0
      i32.const 108
      i32.store8 offset=11
      local.get $p1
      i32.const 12
      i32.eq
      br_if $B0
      local.get $p0
      i32.const 105
      i32.store8 offset=12
      local.get $p1
      i32.const 13
      i32.eq
      br_if $B0
      local.get $p0
      i32.const 99
      i32.store8 offset=13
      local.get $p1
      i32.const 14
      i32.eq
      br_if $B0
      local.get $p0
      i32.const 107
      i32.store8 offset=14
      local.get $p1
      i32.const 15
      i32.eq
      br_if $B0
      local.get $p0
      i32.const 34
      i32.store8 offset=15
      local.get $p1
      i32.const 16
      i32.eq
      br_if $B0
      local.get $p0
      i32.const 58
      i32.store8 offset=16
      local.get $l4
      local.get $l7
      i32.const 17
      i32.add
      i32.store offset=4
      local.get $p2
      local.get $p3
      local.get $l4
      i32.const 4
      i32.add
      local.get $l4
      i64.load32_u offset=16
      call $write_uint
      i32.eqz
      br_if $B0
      local.get $p3
      local.get $l4
      i32.load offset=4
      local.tee $p1
      i32.le_u
      br_if $B0
      local.get $p2
      local.get $p1
      i32.add
      local.tee $p0
      i32.const 44
      i32.store8
      i32.const 0
      local.get $p3
      local.get $p1
      i32.sub
      local.tee $l7
      local.get $l7
      local.get $p3
      i32.gt_u
      select
      local.tee $l7
      i32.const 1
      i32.eq
      br_if $B0
      local.get $p0
      i32.const 34
      i32.store8 offset=1
      local.get $l7
      i32.const 2
      i32.eq
      br_if $B0
      local.get $p0
      i32.const 112
      i32.store8 offset=2
      local.get $l7
      i32.const 3
      i32.eq
      br_if $B0
      local.get $p0
      i32.const 117
      i32.store8 offset=3
      local.get $l7
      i32.const 4
      i32.eq
      br_if $B0
      local.get $p0
      i32.const 114
      i32.store8 offset=4
      local.get $l7
      i32.const 5
      i32.eq
      br_if $B0
      local.get $p0
      i32.const 99
      i32.store8 offset=5
      local.get $l7
      i32.const 6
      i32.eq
      br_if $B0
      local.get $p0
      i32.const 104
      i32.store8 offset=6
      local.get $l7
      i32.const 7
      i32.eq
      br_if $B0
      local.get $p0
      i32.const 97
      i32.store8 offset=7
      local.get $l7
      i32.const 8
      i32.eq
      br_if $B0
      local.get $p0
      i32.const 115
      i32.store8 offset=8
      local.get $l7
      i32.const 9
      i32.eq
      br_if $B0
      local.get $p0
      i32.const 101
      i32.store8 offset=9
      local.get $l7
      i32.const 10
      i32.eq
      br_if $B0
      local.get $p0
      i32.const 34
      i32.store8 offset=10
      local.get $l7
      i32.const 11
      i32.eq
      br_if $B0
      local.get $p0
      i32.const 58
      i32.store8 offset=11
      local.get $l4
      local.get $p1
      i32.const 12
      i32.add
      i32.store offset=4
      local.get $p2
      local.get $p3
      local.get $l4
      i32.const 4
      i32.add
      local.get $l4
      i64.load32_u offset=12
      call $write_uint
      i32.eqz
      br_if $B0
      local.get $p3
      local.get $l4
      i32.load offset=4
      local.tee $l7
      i32.le_u
      br_if $B0
      local.get $p2
      local.get $l7
      i32.add
      local.tee $p1
      i32.const 44
      i32.store8
      i32.const 0
      local.get $p3
      local.get $l7
      i32.sub
      local.tee $p0
      local.get $p0
      local.get $p3
      i32.gt_u
      select
      local.tee $p0
      i32.const 1
      i32.eq
      br_if $B0
      local.get $p1
      i32.const 34
      i32.store8 offset=1
      local.get $p0
      i32.const 2
      i32.eq
      br_if $B0
      local.get $p1
      i32.const 118
      i32.store8 offset=2
      local.get $p0
      i32.const 3
      i32.eq
      br_if $B0
      local.get $p1
      i32.const 105
      i32.store8 offset=3
      local.get $p0
      i32.const 4
      i32.eq
      br_if $B0
      local.get $p1
      i32.const 101
      i32.store8 offset=4
      local.get $p0
      i32.const 5
      i32.eq
      br_if $B0
      local.get $p1
      i32.const 119
      i32.store8 offset=5
      local.get $p0
      i32.const 6
      i32.eq
      br_if $B0
      local.get $p1
      i32.const 34
      i32.store8 offset=6
      local.get $p0
      i32.const 7
      i32.eq
      br_if $B0
      local.get $p1
      i32.const 58
      i32.store8 offset=7
      local.get $l4
      local.get $l7
      i32.const 8
      i32.add
      i32.store offset=4
      local.get $p2
      local.get $p3
      local.get $l4
      i32.const 4
      i32.add
      local.get $l4
      i64.load32_u offset=8
      call $write_uint
      i32.eqz
      br_if $B0
      local.get $p3
      local.get $l4
      i32.load offset=4
      local.tee $l7
      i32.le_u
      br_if $B0
      local.get $p2
      local.get $l7
      i32.add
      local.tee $p1
      i32.const 125
      i32.store8
      i32.const 0
      local.get $p3
      local.get $l7
      i32.sub
      local.tee $p0
      local.get $p0
      local.get $p3
      i32.gt_u
      select
      local.tee $p0
      i32.const 1
      i32.eq
      br_if $B0
      local.get $p1
      i32.const 44
      i32.store8 offset=1
      local.get $p0
      i32.const 2
      i32.eq
      br_if $B0
      local.get $p1
      i32.const 34
      i32.store8 offset=2
      local.get $p0
      i32.const 3
      i32.eq
      br_if $B0
      local.get $p1
      i32.const 111
      i32.store8 offset=3
      local.get $p0
      i32.const 4
      i32.eq
      br_if $B0
      local.get $p1
      i32.const 107
      i32.store8 offset=4
      local.get $p0
      i32.const 5
      i32.eq
      br_if $B0
      local.get $p1
      i32.const 67
      i32.store8 offset=5
      local.get $p0
      i32.const 6
      i32.eq
      br_if $B0
      local.get $p1
      i32.const 111
      i32.store8 offset=6
      local.get $p0
      i32.const 7
      i32.eq
      br_if $B0
      local.get $p1
      i32.const 117
      i32.store8 offset=7
      local.get $p0
      i32.const 8
      i32.eq
      br_if $B0
      local.get $p1
      i32.const 110
      i32.store8 offset=8
      local.get $p0
      i32.const 9
      i32.eq
      br_if $B0
      local.get $p1
      i32.const 116
      i32.store8 offset=9
      local.get $p0
      i32.const 10
      i32.eq
      br_if $B0
      local.get $p1
      i32.const 34
      i32.store8 offset=10
      local.get $p0
      i32.const 11
      i32.eq
      br_if $B0
      local.get $p1
      i32.const 58
      i32.store8 offset=11
      local.get $l4
      local.get $l7
      i32.const 12
      i32.add
      i32.store offset=4
      local.get $p2
      local.get $p3
      local.get $l4
      i32.const 4
      i32.add
      local.get $l9
      i64.extend_i32_u
      call $write_uint
      i32.eqz
      br_if $B0
      local.get $p3
      local.get $l4
      i32.load offset=4
      local.tee $l7
      i32.le_u
      br_if $B0
      local.get $p2
      local.get $l7
      i32.add
      local.tee $p1
      i32.const 44
      i32.store8
      i32.const 0
      local.get $p3
      local.get $l7
      i32.sub
      local.tee $p0
      local.get $p0
      local.get $p3
      i32.gt_u
      select
      local.tee $p0
      i32.const 1
      i32.eq
      br_if $B0
      local.get $p1
      i32.const 34
      i32.store8 offset=1
      local.get $p0
      i32.const 2
      i32.eq
      br_if $B0
      local.get $p1
      i32.const 114
      i32.store8 offset=2
      local.get $p0
      i32.const 3
      i32.eq
      br_if $B0
      local.get $p1
      i32.const 101
      i32.store8 offset=3
      local.get $p0
      i32.const 4
      i32.eq
      br_if $B0
      local.get $p1
      i32.const 103
      i32.store8 offset=4
      local.get $p0
      i32.const 5
      i32.eq
      br_if $B0
      local.get $p1
      i32.const 105
      i32.store8 offset=5
      local.get $p0
      i32.const 6
      i32.eq
      br_if $B0
      local.get $p1
      i32.const 111
      i32.store8 offset=6
      local.get $p0
      i32.const 7
      i32.eq
      br_if $B0
      local.get $p1
      i32.const 110
      i32.store8 offset=7
      local.get $p0
      i32.const 8
      i32.eq
      br_if $B0
      local.get $p1
      i32.const 34
      i32.store8 offset=8
      local.get $p0
      i32.const 9
      i32.eq
      br_if $B0
      local.get $p1
      i32.const 58
      i32.store8 offset=9
      local.get $p0
      i32.const 10
      i32.eq
      br_if $B0
      local.get $p1
      i32.const 123
      i32.store8 offset=10
      local.get $p0
      i32.const 11
      i32.eq
      br_if $B0
      local.get $p1
      i32.const 34
      i32.store8 offset=11
      local.get $p0
      i32.const 12
      i32.eq
      br_if $B0
      local.get $p1
      i32.const 97
      i32.store8 offset=12
      local.get $p0
      i32.const 13
      i32.eq
      br_if $B0
      local.get $p1
      i32.const 112
      i32.store8 offset=13
      local.get $p0
      i32.const 14
      i32.eq
      br_if $B0
      local.get $p1
      i32.const 34
      i32.store8 offset=14
      local.get $p0
      i32.const 15
      i32.eq
      br_if $B0
      local.get $p1
      i32.const 58
      i32.store8 offset=15
      local.get $l4
      local.get $l7
      i32.const 16
      i32.add
      i32.store offset=4
      local.get $p2
      local.get $p3
      local.get $l4
      i32.const 4
      i32.add
      local.get $l4
      i64.load32_u offset=32
      call $write_uint
      i32.eqz
      br_if $B0
      local.get $p3
      local.get $l4
      i32.load offset=4
      local.tee $l7
      i32.le_u
      br_if $B0
      local.get $p2
      local.get $l7
      i32.add
      local.tee $p1
      i32.const 44
      i32.store8
      i32.const 0
      local.get $p3
      local.get $l7
      i32.sub
      local.tee $p0
      local.get $p0
      local.get $p3
      i32.gt_u
      select
      local.tee $p0
      i32.const 1
      i32.eq
      br_if $B0
      local.get $p1
      i32.const 34
      i32.store8 offset=1
      local.get $p0
      i32.const 2
      i32.eq
      br_if $B0
      local.get $p1
      i32.const 101
      i32.store8 offset=2
      local.get $p0
      i32.const 3
      i32.eq
      br_if $B0
      local.get $p1
      i32.const 117
      i32.store8 offset=3
      local.get $p0
      i32.const 4
      i32.eq
      br_if $B0
      local.get $p1
      i32.const 34
      i32.store8 offset=4
      local.get $p0
      i32.const 5
      i32.eq
      br_if $B0
      local.get $p1
      i32.const 58
      i32.store8 offset=5
      local.get $l4
      local.get $l7
      i32.const 6
      i32.add
      i32.store offset=4
      local.get $p2
      local.get $p3
      local.get $l4
      i32.const 4
      i32.add
      local.get $l4
      i64.load32_u offset=28
      call $write_uint
      i32.eqz
      br_if $B0
      local.get $p3
      local.get $l4
      i32.load offset=4
      local.tee $l7
      i32.le_u
      br_if $B0
      local.get $p2
      local.get $l7
      i32.add
      local.tee $p1
      i32.const 44
      i32.store8
      i32.const 0
      local.get $p3
      local.get $l7
      i32.sub
      local.tee $p0
      local.get $p0
      local.get $p3
      i32.gt_u
      select
      local.tee $p0
      i32.const 1
      i32.eq
      br_if $B0
      local.get $p1
      i32.const 34
      i32.store8 offset=1
      local.get $p0
      i32.const 2
      i32.eq
      br_if $B0
      local.get $p1
      i32.const 110
      i32.store8 offset=2
      local.get $p0
      i32.const 3
      i32.eq
      br_if $B0
      local.get $p1
      i32.const 97
      i32.store8 offset=3
      local.get $p0
      i32.const 4
      i32.eq
      br_if $B0
      local.get $p1
      i32.const 34
      i32.store8 offset=4
      local.get $p0
      i32.const 5
      i32.eq
      br_if $B0
      local.get $p1
      i32.const 58
      i32.store8 offset=5
      local.get $l4
      local.get $l7
      i32.const 6
      i32.add
      i32.store offset=4
      local.get $p2
      local.get $p3
      local.get $l4
      i32.const 4
      i32.add
      local.get $l4
      i64.load32_u offset=24
      call $write_uint
      i32.eqz
      br_if $B0
      local.get $p3
      local.get $l4
      i32.load offset=4
      local.tee $l7
      i32.le_u
      br_if $B0
      local.get $p2
      local.get $l7
      i32.add
      local.tee $p1
      i32.const 44
      i32.store8
      i32.const 0
      local.get $p3
      local.get $l7
      i32.sub
      local.tee $p0
      local.get $p0
      local.get $p3
      i32.gt_u
      select
      local.tee $p0
      i32.const 1
      i32.eq
      br_if $B0
      local.get $p1
      i32.const 34
      i32.store8 offset=1
      local.get $p0
      i32.const 2
      i32.eq
      br_if $B0
      local.get $p1
      i32.const 115
      i32.store8 offset=2
      local.get $p0
      i32.const 3
      i32.eq
      br_if $B0
      local.get $p1
      i32.const 97
      i32.store8 offset=3
      local.get $p0
      i32.const 4
      i32.eq
      br_if $B0
      local.get $p1
      i32.const 34
      i32.store8 offset=4
      local.get $p0
      i32.const 5
      i32.eq
      br_if $B0
      local.get $p1
      i32.const 58
      i32.store8 offset=5
      local.get $l4
      local.get $l7
      i32.const 6
      i32.add
      i32.store offset=4
      local.get $p2
      local.get $p3
      local.get $l4
      i32.const 4
      i32.add
      local.get $l4
      i64.load32_u offset=20
      call $write_uint
      i32.eqz
      br_if $B0
      local.get $p3
      local.get $l4
      i32.load offset=4
      local.tee $l7
      i32.le_u
      br_if $B0
      local.get $p2
      local.get $l7
      i32.add
      local.tee $p1
      i32.const 125
      i32.store8
      i32.const 0
      local.get $p3
      local.get $l7
      i32.sub
      local.tee $p0
      local.get $p0
      local.get $p3
      i32.gt_u
      select
      local.tee $p0
      i32.const 1
      i32.eq
      br_if $B0
      local.get $p1
      i32.const 44
      i32.store8 offset=1
      local.get $p0
      i32.const 2
      i32.eq
      br_if $B0
      local.get $p1
      i32.const 34
      i32.store8 offset=2
      local.get $p0
      i32.const 3
      i32.eq
      br_if $B0
      local.get $p1
      i32.const 118
      i32.store8 offset=3
      local.get $p0
      i32.const 4
      i32.eq
      br_if $B0
      local.get $p1
      i32.const 97
      i32.store8 offset=4
      local.get $p0
      i32.const 5
      i32.eq
      br_if $B0
      local.get $p1
      i32.const 108
      i32.store8 offset=5
      local.get $p0
      i32.const 6
      i32.eq
      br_if $B0
      local.get $p1
      i32.const 117
      i32.store8 offset=6
      local.get $p0
      i32.const 7
      i32.eq
      br_if $B0
      local.get $p1
      i32.const 101
      i32.store8 offset=7
      local.get $p0
      i32.const 8
      i32.eq
      br_if $B0
      local.get $p1
      i32.const 83
      i32.store8 offset=8
      local.get $p0
      i32.const 9
      i32.eq
      br_if $B0
      local.get $p1
      i32.const 117
      i32.store8 offset=9
      local.get $p0
      i32.const 10
      i32.eq
      br_if $B0
      local.get $p1
      i32.const 109
      i32.store8 offset=10
      local.get $p0
      i32.const 11
      i32.eq
      br_if $B0
      local.get $p1
      i32.const 34
      i32.store8 offset=11
      local.get $p0
      i32.const 12
      i32.eq
      br_if $B0
      local.get $p1
      i32.const 58
      i32.store8 offset=12
      local.get $l4
      local.get $l7
      i32.const 13
      i32.add
      i32.store offset=4
      local.get $p2
      local.get $p3
      local.get $l4
      i32.const 4
      i32.add
      local.get $l6
      call $write_uint
      i32.eqz
      br_if $B0
      local.get $l4
      i32.load offset=4
      local.tee $p1
      local.get $p3
      i32.ge_u
      br_if $B0
      local.get $p2
      local.get $p1
      i32.add
      i32.const 125
      i32.store8
      local.get $p1
      i32.const 1
      i32.add
      local.set $l5
    end
    local.get $l4
    i32.const 80
    i32.add
    global.set $__stack_pointer
    local.get $l5)
  (func $expect_ascii (type $t2) (param $p0 i32) (result i32)
    (local $l1 i32) (local $l2 i32) (local $l3 i32) (local $l4 i32)
    block $B0
      local.get $p0
      i32.load8_u
      local.tee $l1
      br_if $B0
      i32.const 1
      return
    end
    i32.const 0
    i32.const 0
    i32.load offset=65696
    local.tee $l2
    i32.const 0
    i32.load offset=65700
    local.tee $l3
    i32.sub
    local.tee $l4
    local.get $l4
    local.get $l2
    i32.gt_u
    select
    local.set $l2
    local.get $p0
    i32.const 1
    i32.add
    local.set $p0
    i32.const 0
    i32.load offset=65692
    local.set $l4
    loop $L1
      block $B2
        local.get $l2
        br_if $B2
        i32.const 0
        return
      end
      block $B3
        local.get $l4
        local.get $l3
        i32.add
        i32.load8_u
        local.get $l1
        i32.const 255
        i32.and
        i32.eq
        br_if $B3
        i32.const 0
        return
      end
      i32.const 0
      local.get $l3
      i32.const 1
      i32.add
      local.tee $l3
      i32.store offset=65700
      local.get $l2
      i32.const -1
      i32.add
      local.set $l2
      local.get $p0
      i32.load8_u
      local.set $l1
      local.get $p0
      i32.const 1
      i32.add
      local.set $p0
      local.get $l1
      br_if $L1
    end
    i32.const 1)
  (func $parse_uint (type $t2) (param $p0 i32) (result i32)
    (local $l1 i32) (local $l2 i32) (local $l3 i32) (local $l4 i32) (local $l5 i32) (local $l6 i64) (local $l7 i32) (local $l8 i64)
    i32.const 0
    local.set $l1
    block $B0
      i32.const 0
      i32.load offset=65700
      local.tee $l2
      i32.const 0
      i32.load offset=65696
      local.tee $l3
      i32.ge_u
      br_if $B0
      i32.const 0
      i32.load offset=65692
      local.tee $l4
      local.get $l2
      i32.add
      local.set $l5
      i64.const 0
      local.set $l6
      local.get $l2
      local.set $l1
      block $B1
        loop $L2
          local.get $l4
          local.get $l1
          i32.add
          i32.load8_u
          local.tee $l7
          i32.const -48
          i32.add
          i32.const 255
          i32.and
          i32.const 9
          i32.gt_u
          br_if $B1
          block $B3
            local.get $l1
            local.get $l2
            i32.le_u
            br_if $B3
            local.get $l5
            i32.load8_u
            i32.const 48
            i32.ne
            br_if $B3
            i32.const 0
            return
          end
          block $B4
            local.get $l6
            i64.const 10
            i64.mul
            local.get $l7
            i64.extend_i32_u
            i64.const 255
            i64.and
            i64.add
            i64.const -48
            i64.add
            local.tee $l8
            local.get $l6
            i64.ge_u
            br_if $B4
            i32.const 0
            return
          end
          i32.const 0
          local.get $l1
          i32.const 1
          i32.add
          local.tee $l1
          i32.store offset=65700
          local.get $l8
          local.set $l6
          local.get $l3
          local.get $l1
          i32.ne
          br_if $L2
        end
        local.get $l8
        local.set $l6
        local.get $l3
        local.set $l1
      end
      block $B5
        local.get $l1
        local.get $l2
        i32.ne
        br_if $B5
        i32.const 0
        return
      end
      local.get $p0
      local.get $l6
      i64.store
      i32.const 1
      local.set $l1
    end
    local.get $l1)
  (func $parse_option (type $t1) (param $p0 i32) (param $p1 i32) (param $p2 i32) (param $p3 i32) (result i32)
    (local $l4 i32) (local $l5 i32) (local $l6 i32) (local $l7 i32) (local $l8 i32) (local $l9 i32) (local $l10 i32) (local $l11 i32)
    i32.const 0
    local.set $l4
    block $B0
      block $B1
        i32.const 0
        i32.load offset=65700
        local.tee $l5
        i32.const 0
        i32.load offset=65696
        local.tee $l6
        i32.ge_u
        br_if $B1
        i32.const 0
        local.set $l4
        i32.const 0
        i32.load offset=65692
        local.tee $l7
        local.get $l5
        i32.add
        i32.load8_u
        i32.const 34
        i32.ne
        br_if $B1
        local.get $l7
        local.get $l5
        i32.const 1
        i32.add
        local.tee $l8
        i32.add
        local.set $l9
        block $B2
          block $B3
            local.get $p1
            i32.load
            local.tee $l10
            local.get $l8
            i32.add
            local.tee $l11
            local.get $l6
            i32.ge_u
            br_if $B3
            block $B4
              local.get $l10
              i32.eqz
              br_if $B4
              local.get $p0
              i32.load
              local.set $l4
              local.get $l9
              local.set $l5
              local.get $l10
              local.set $l7
              loop $L5
                local.get $l5
                i32.load8_u
                local.get $l4
                i32.load8_u
                i32.ne
                br_if $B3
                local.get $l5
                i32.const 1
                i32.add
                local.set $l5
                local.get $l4
                i32.const 1
                i32.add
                local.set $l4
                local.get $l7
                i32.const -1
                i32.add
                local.tee $l7
                br_if $L5
              end
            end
            local.get $l9
            local.get $l10
            i32.add
            i32.load8_u
            i32.const 34
            i32.ne
            br_if $B3
            i32.const 0
            local.set $l5
            br $B2
          end
          i32.const 0
          local.get $l8
          i32.store offset=65700
          block $B6
            local.get $p1
            i32.load offset=4
            local.tee $l10
            local.get $l8
            i32.add
            local.tee $l11
            local.get $l6
            i32.ge_u
            br_if $B6
            block $B7
              local.get $l10
              i32.eqz
              br_if $B7
              local.get $p0
              i32.load offset=4
              local.set $l4
              local.get $l9
              local.set $l5
              local.get $l10
              local.set $l7
              loop $L8
                local.get $l5
                i32.load8_u
                local.get $l4
                i32.load8_u
                i32.ne
                br_if $B6
                local.get $l5
                i32.const 1
                i32.add
                local.set $l5
                local.get $l4
                i32.const 1
                i32.add
                local.set $l4
                local.get $l7
                i32.const -1
                i32.add
                local.tee $l7
                br_if $L8
              end
            end
            local.get $l9
            local.get $l10
            i32.add
            i32.load8_u
            i32.const 34
            i32.ne
            br_if $B6
            i32.const 1
            local.set $l5
            br $B2
          end
          i32.const 0
          local.get $l8
          i32.store offset=65700
          block $B9
            local.get $p1
            i32.load offset=8
            local.tee $l10
            local.get $l8
            i32.add
            local.tee $l11
            local.get $l6
            i32.ge_u
            br_if $B9
            block $B10
              local.get $l10
              i32.eqz
              br_if $B10
              local.get $p0
              i32.load offset=8
              local.set $l4
              local.get $l9
              local.set $l5
              local.get $l10
              local.set $l7
              loop $L11
                local.get $l5
                i32.load8_u
                local.get $l4
                i32.load8_u
                i32.ne
                br_if $B9
                local.get $l5
                i32.const 1
                i32.add
                local.set $l5
                local.get $l4
                i32.const 1
                i32.add
                local.set $l4
                local.get $l7
                i32.const -1
                i32.add
                local.tee $l7
                br_if $L11
              end
            end
            local.get $l9
            local.get $l10
            i32.add
            i32.load8_u
            i32.const 34
            i32.ne
            br_if $B9
            i32.const 2
            local.set $l5
            br $B2
          end
          i32.const 0
          local.set $l4
          i32.const 0
          local.get $l8
          i32.store offset=65700
          local.get $p2
          i32.const 3
          i32.eq
          br_if $B1
          local.get $p1
          i32.load offset=12
          local.tee $p1
          local.get $l8
          i32.add
          local.tee $l11
          local.get $l6
          i32.ge_u
          br_if $B0
          block $B12
            local.get $p1
            i32.eqz
            br_if $B12
            local.get $p0
            i32.load offset=12
            local.set $l4
            local.get $l9
            local.set $l5
            local.get $p1
            local.set $l7
            loop $L13
              local.get $l5
              i32.load8_u
              local.get $l4
              i32.load8_u
              i32.ne
              br_if $B0
              local.get $l5
              i32.const 1
              i32.add
              local.set $l5
              local.get $l4
              i32.const 1
              i32.add
              local.set $l4
              local.get $l7
              i32.const -1
              i32.add
              local.tee $l7
              br_if $L13
            end
          end
          local.get $l9
          local.get $p1
          i32.add
          i32.load8_u
          i32.const 34
          i32.ne
          br_if $B0
          i32.const 3
          local.set $l5
        end
        i32.const 1
        local.set $l4
        i32.const 0
        local.get $l11
        i32.const 1
        i32.add
        i32.store offset=65700
        local.get $p3
        local.get $l5
        i32.store
      end
      local.get $l4
      return
    end
    i32.const 0
    local.get $l8
    i32.store offset=65700
    i32.const 0)
  (func $write_uint (type $t3) (param $p0 i32) (param $p1 i32) (param $p2 i32) (param $p3 i64) (result i32)
    (local $l4 i32) (local $l5 i32) (local $l6 i64) (local $l7 i32)
    global.get $__stack_pointer
    i32.const 32
    i32.sub
    local.set $l4
    i32.const 0
    local.set $l5
    loop $L0
      local.get $l4
      local.get $l5
      i32.add
      local.get $p3
      local.get $p3
      i64.const 10
      i64.div_u
      local.tee $l6
      i64.const 10
      i64.mul
      i64.sub
      i32.wrap_i64
      i32.const 48
      i32.or
      i32.store8
      local.get $l5
      i32.const 1
      i32.add
      local.set $l5
      local.get $p3
      i64.const 9
      i64.gt_u
      local.set $l7
      local.get $l6
      local.set $p3
      local.get $l7
      br_if $L0
    end
    block $B1
      local.get $l5
      br_if $B1
      i32.const 1
      return
    end
    local.get $l4
    i32.const -1
    i32.add
    local.set $l4
    loop $L2
      block $B3
        local.get $p2
        i32.load
        local.tee $l7
        local.get $p1
        i32.lt_u
        br_if $B3
        i32.const 0
        return
      end
      local.get $p2
      local.get $l7
      i32.const 1
      i32.add
      i32.store
      local.get $p0
      local.get $l7
      i32.add
      local.get $l4
      local.get $l5
      i32.add
      i32.load8_u
      i32.store8
      local.get $l5
      i32.const -1
      i32.add
      local.tee $l5
      br_if $L2
    end
    i32.const 1)
  (func $get_records (type $t4) (result i32)
    i32.const 0
    i32.load offset=65704)
  (func $get_input_bytes (type $t4) (result i32)
    i32.const 0
    i32.load offset=65708)
  (func $get_numeric_values (type $t4) (result i32)
    i32.const 0
    i32.load offset=65712)
  (func $get_string_values (type $t4) (result i32)
    i32.const 0
    i32.load offset=65716)
  (func $get_booleans (type $t4) (result i32)
    i32.const 0
    i32.load offset=65720)
  (func $get_query_aggregates (type $t4) (result i32)
    i32.const 11)
  (func $get_allocations (type $t4) (result i32)
    i32.const 0)
  (table $__indirect_function_table 1 1 funcref)
  (memory $memory 16)
  (global $__stack_pointer (mut i32) (i32.const 65536))
  (global $__dso_handle i32 (i32.const 65536))
  (global $__data_end i32 (i32.const 65724))
  (global $__stack_low i32 (i32.const 0))
  (global $__stack_high i32 (i32.const 65536))
  (global $__global_base i32 (i32.const 65536))
  (global $__heap_base i32 (i32.const 65728))
  (global $__heap_end i32 (i32.const 1048576))
  (global $__memory_base i32 (i32.const 0))
  (global $__table_base i32 (i32.const 1))
  (global $__wasm_first_page_end i32 (i32.const 65536))
  (export "memory" (memory $memory))
  (export "__wasm_call_ctors" (func $__wasm_call_ctors))
  (export "__stack_pointer" (global $__stack_pointer))
  (export "process" (func $process))
  (export "get_records" (func $get_records))
  (export "get_input_bytes" (func $get_input_bytes))
  (export "get_numeric_values" (func $get_numeric_values))
  (export "get_string_values" (func $get_string_values))
  (export "get_booleans" (func $get_booleans))
  (export "get_query_aggregates" (func $get_query_aggregates))
  (export "get_allocations" (func $get_allocations))
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
  (data $.rodata (i32.const 65536) "}}\00,\22meta\22:{\22label\22:\00,\22tag\22:\00,\22value\22:\00\00\00\00\00\00\00\00\00\00p\00\01\00u\00\01\00{\00\01\00\85\00\01\00\05\00\00\00\06\00\00\00\0a\00\00\00\04\00\00\00\89\00\01\00\8b\00\01\00\91\00\01\00\98\00\01\00\02\00\00\00\06\00\00\00\07\00\00\00\04\00\00\00Caf\c3\a9\e6\9d\b1\e4\ba\ac\d9\85\d8\b1\d8\ad\d8\a8\d8\a7\f0\9f\9a\80\ce\b1\e6\95\b0\e6\8d\aema\c3\b1ana\f0\9f\a7\aa"))
