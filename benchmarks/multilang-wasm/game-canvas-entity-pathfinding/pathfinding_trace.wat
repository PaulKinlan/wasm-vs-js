;; game.canvas-entity-pathfinding.v1 — kernel: pathfinding_trace
;; WebAssembly Text (WAT) baseline implementation
;; Exports: pathfinding_trace

(module $pathfinding_kernel_c.wasm
  (type $t0 (func))
  (type $t1 (func (param i32) (result i32)))
  (func $__wasm_call_ctors (type $t0))
  (func $pathfinding_trace (type $t1) (param $p0 i32) (result i32)
    (local $l1 i32) (local $l2 i32) (local $l3 i32) (local $l4 i32) (local $l5 i32) (local $l6 i32) (local $l7 i32) (local $l8 i32) (local $l9 i32) (local $l10 i32) (local $l11 i32) (local $l12 i32) (local $l13 i32) (local $l14 i32) (local $l15 i32) (local $l16 i32) (local $l17 i32) (local $l18 i32) (local $l19 i32) (local $l20 i32) (local $l21 i32) (local $l22 i32) (local $l23 i32)
    block $B0
      local.get $p0
      i32.const 106552
      i32.eq
      br_if $B0
      i32.const 1
      return
    end
    i32.const 2
    local.set $p0
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
      i32.const 256
      i32.ne
      br_if $B1
      i32.const 0
      i32.load8_u offset=3145737
      i32.const 8
      i32.shl
      i32.const 0
      i32.load8_u offset=3145736
      i32.or
      i32.const 0
      i32.load8_u offset=3145738
      i32.const 16
      i32.shl
      i32.or
      i32.const 0
      i32.load8_u offset=3145739
      i32.const 24
      i32.shl
      i32.or
      i32.const 4096
      i32.ne
      br_if $B1
      i32.const -131072
      local.set $p0
      loop $L2
        local.get $p0
        i32.const 327680
        i32.add
        i32.const 0
        i32.store16
        local.get $p0
        i32.const 196608
        i32.add
        i32.const 0
        i32.store
        local.get $p0
        i32.const 327682
        i32.add
        i32.const 0
        i32.store16
        local.get $p0
        i32.const 196612
        i32.add
        i32.const 0
        i32.store16
        local.get $p0
        i32.const 327684
        i32.add
        i32.const 0
        i32.store16
        local.get $p0
        i32.const 196614
        i32.add
        i32.const 0
        i32.store16
        local.get $p0
        i32.const 327686
        i32.add
        i32.const 0
        i32.store16
        local.get $p0
        i32.const 8
        i32.add
        local.tee $p0
        br_if $L2
      end
      i32.const 57701188
      local.set $l1
      i32.const 320440878
      local.set $l2
      i32.const -1589478599
      local.set $l3
      i32.const 0
      local.set $l4
      i32.const 0
      local.set $l5
      i32.const 0
      local.set $l6
      i32.const 0
      local.set $l7
      loop $L3
        local.get $l6
        i32.const 3
        i32.shl
        local.tee $p0
        i32.const 3244063
        i32.add
        i32.load8_u
        local.set $l8
        local.get $p0
        i32.const 3244062
        i32.add
        i32.load8_u
        local.set $l9
        local.get $p0
        i32.const 3244060
        i32.add
        i32.load8_u
        local.set $l10
        local.get $p0
        i32.const 3244061
        i32.add
        i32.load8_u
        local.set $l11
        i32.const 0
        local.get $p0
        i32.const 3244059
        i32.add
        i32.load8_u
        i32.const 16
        i32.shl
        local.get $p0
        i32.const 3244058
        i32.add
        i32.load8_u
        i32.const 8
        i32.shl
        i32.or
        local.get $p0
        i32.const 3244057
        i32.add
        i32.load8_u
        i32.const 8
        i32.shl
        local.get $p0
        i32.const 3244056
        i32.add
        i32.load8_u
        local.tee $l12
        i32.or
        i32.add
        local.tee $p0
        i32.store offset=1400832
        local.get $p0
        i32.const 2
        i32.shl
        local.tee $l13
        i32.const 0
        i32.store offset=327680
        local.get $p0
        i32.const 1
        i32.shl
        local.get $l4
        i32.const 1
        i32.add
        local.tee $l4
        i32.store16 offset=65536
        local.get $l13
        i32.const -1
        i32.store offset=589824
        i32.const 0
        local.get $p0
        i32.const 8
        i32.shr_u
        local.get $l8
        i32.const 16
        i32.shl
        local.get $l9
        i32.const 8
        i32.shl
        i32.or
        local.get $l10
        local.get $l11
        i32.const 8
        i32.shl
        i32.or
        i32.add
        local.tee $l14
        i32.const 8
        i32.shr_u
        local.tee $l15
        i32.sub
        local.tee $p0
        local.get $p0
        i32.const 31
        i32.shr_s
        local.tee $p0
        i32.xor
        local.get $p0
        i32.sub
        local.get $l12
        local.get $l10
        i32.sub
        local.tee $p0
        local.get $p0
        i32.const 31
        i32.shr_s
        local.tee $p0
        i32.xor
        local.get $p0
        i32.sub
        i32.add
        i32.store offset=876544
        local.get $l6
        i32.const 16
        i32.shl
        local.set $l16
        local.get $l7
        i32.const 1
        i32.add
        local.set $l7
        i32.const -2052912941
        local.set $l17
        local.get $l4
        i32.const 65535
        i32.and
        local.set $l18
        i32.const 1
        local.set $l19
        loop $L4
          i32.const 0
          i32.load offset=876544
          local.set $l20
          i32.const 0
          i32.load offset=1400832
          local.set $l21
          block $B5
            local.get $l19
            i32.const -1
            i32.add
            local.tee $l9
            i32.eqz
            br_if $B5
            local.get $l9
            i32.const 2
            i32.shl
            local.tee $p0
            i32.load offset=876544
            local.set $l11
            local.get $p0
            i32.load offset=1400832
            local.set $l22
            i32.const 0
            local.set $p0
            block $B6
              local.get $l9
              i32.const 1
              i32.eq
              br_if $B6
              i32.const 0
              local.set $l12
              i32.const 1
              local.set $l8
              i32.const 0
              local.set $l13
              loop $L7
                block $B8
                  block $B9
                    local.get $l13
                    i32.const 2
                    i32.add
                    local.tee $p0
                    local.get $l9
                    i32.lt_u
                    br_if $B9
                    local.get $l8
                    local.set $p0
                    br $B8
                  end
                  local.get $l8
                  local.get $p0
                  local.get $p0
                  i32.const 2
                  i32.shl
                  local.tee $l13
                  i32.load offset=1400832
                  local.get $l8
                  i32.const 2
                  i32.shl
                  local.tee $l23
                  i32.load offset=1400832
                  i32.ge_u
                  local.get $l13
                  i32.load offset=876544
                  local.tee $l13
                  local.get $l23
                  i32.load offset=876544
                  local.tee $l23
                  i32.ge_u
                  local.get $l13
                  local.get $l23
                  i32.eq
                  select
                  select
                  local.set $p0
                end
                block $B10
                  local.get $p0
                  i32.const 2
                  i32.shl
                  local.tee $l8
                  i32.load offset=1400832
                  local.tee $l13
                  local.get $l22
                  i32.ge_u
                  local.get $l8
                  i32.load offset=876544
                  local.tee $l8
                  local.get $l11
                  i32.ge_u
                  local.get $l8
                  local.get $l11
                  i32.eq
                  select
                  i32.eqz
                  br_if $B10
                  local.get $l12
                  local.set $p0
                  br $B6
                end
                local.get $l12
                i32.const 2
                i32.shl
                local.tee $l12
                local.get $l13
                i32.store offset=1400832
                local.get $l12
                local.get $l8
                i32.store offset=876544
                local.get $p0
                local.set $l12
                local.get $p0
                i32.const 1
                i32.shl
                local.tee $l13
                i32.const 1
                i32.or
                local.tee $l8
                local.get $l9
                i32.lt_u
                br_if $L7
              end
            end
            local.get $p0
            i32.const 2
            i32.shl
            local.tee $p0
            local.get $l22
            i32.store offset=1400832
            local.get $p0
            local.get $l11
            i32.store offset=876544
          end
          local.get $l7
          i32.const 1
          i32.add
          local.set $p0
          block $B11
            block $B12
              block $B13
                local.get $l21
                i32.const 1
                i32.shl
                local.tee $l8
                i32.load16_u offset=196608
                local.get $l18
                i32.ne
                br_if $B13
                local.get $l9
                local.set $l19
                local.get $p0
                local.set $l7
                br $B12
              end
              local.get $l8
              i32.const 196608
              i32.add
              local.get $l4
              i32.store16
              local.get $l5
              i32.const 1
              i32.add
              local.set $l5
              local.get $l20
              local.get $l17
              i32.xor
              i32.const 16777619
              i32.mul
              local.get $l21
              i32.xor
              i32.const 16777619
              i32.mul
              local.set $l17
              local.get $l16
              local.get $l21
              i32.const 2
              i32.shl
              local.tee $l11
              i32.load offset=327680
              local.tee $l13
              i32.xor
              local.get $l3
              i32.xor
              local.get $l21
              i32.xor
              i32.const 16777619
              i32.mul
              local.set $l3
              block $B14
                local.get $l21
                local.get $l14
                i32.ne
                br_if $B14
                local.get $p0
                local.set $l7
                br $B11
              end
              block $B15
                block $B16
                  local.get $l21
                  i32.const 255
                  local.get $l21
                  i32.const 255
                  i32.gt_u
                  select
                  local.tee $l8
                  i32.const 256
                  i32.ge_s
                  br_if $B16
                  local.get $l9
                  local.set $l19
                  br $B15
                end
                block $B17
                  local.get $l8
                  i32.const -256
                  i32.add
                  local.tee $l12
                  i32.load8_u offset=3145752
                  i32.eqz
                  br_if $B17
                  local.get $l9
                  local.set $l19
                  br $B15
                end
                block $B18
                  local.get $l12
                  i32.const 1
                  i32.shl
                  local.tee $l22
                  i32.load16_u offset=196608
                  local.get $l18
                  i32.ne
                  br_if $B18
                  local.get $l9
                  local.set $l19
                  br $B15
                end
                local.get $l13
                i32.const 1
                i32.add
                local.set $l13
                block $B19
                  local.get $l22
                  i32.load16_u offset=65536
                  local.get $l18
                  i32.ne
                  br_if $B19
                  local.get $l13
                  local.get $l12
                  i32.const 2
                  i32.shl
                  i32.load offset=327680
                  i32.lt_s
                  br_if $B19
                  local.get $l9
                  local.set $l19
                  br $B15
                end
                local.get $l22
                i32.const 65536
                i32.add
                local.get $l4
                i32.store16
                local.get $l12
                i32.const 2
                i32.shl
                local.tee $p0
                local.get $l13
                i32.store offset=327680
                local.get $p0
                local.get $l21
                i32.store offset=589824
                block $B20
                  local.get $l9
                  i32.const 131071
                  i32.le_u
                  br_if $B20
                  i32.const 3
                  return
                end
                local.get $l12
                i32.const 8
                i32.shr_u
                local.get $l15
                i32.sub
                local.tee $p0
                local.get $p0
                i32.const 31
                i32.shr_s
                local.tee $p0
                i32.xor
                local.get $p0
                i32.sub
                local.get $l8
                i32.const 255
                i32.and
                local.get $l10
                i32.sub
                local.tee $p0
                local.get $p0
                i32.const 31
                i32.shr_s
                local.tee $p0
                i32.xor
                local.get $p0
                i32.sub
                i32.add
                local.get $l13
                i32.add
                local.set $l13
                i32.const 0
                local.set $l23
                block $B21
                  local.get $l9
                  i32.eqz
                  br_if $B21
                  loop $L22
                    block $B23
                      local.get $l12
                      local.get $l9
                      i32.const -1
                      i32.add
                      i32.const 1
                      i32.shr_u
                      local.tee $l8
                      i32.const 2
                      i32.shl
                      local.tee $p0
                      i32.load offset=1400832
                      local.tee $l22
                      i32.ge_u
                      local.get $l13
                      local.get $p0
                      i32.load offset=876544
                      local.tee $p0
                      i32.ge_u
                      local.get $l13
                      local.get $p0
                      i32.eq
                      select
                      i32.eqz
                      br_if $B23
                      local.get $l9
                      local.set $l23
                      br $B21
                    end
                    local.get $l9
                    i32.const 2
                    i32.shl
                    local.tee $l9
                    local.get $l22
                    i32.store offset=1400832
                    local.get $l9
                    local.get $p0
                    i32.store offset=876544
                    local.get $l8
                    local.set $l9
                    local.get $l8
                    br_if $L22
                  end
                end
                local.get $l7
                i32.const 2
                i32.add
                local.set $p0
                local.get $l23
                i32.const 2
                i32.shl
                local.tee $l8
                local.get $l12
                i32.store offset=1400832
                local.get $l8
                local.get $l13
                i32.store offset=876544
              end
              local.get $l11
              i32.const 327680
              i32.add
              local.set $l20
              block $B24
                local.get $l21
                i32.const -1
                i32.add
                i32.const -1
                local.get $l21
                i32.const 255
                i32.and
                local.tee $l13
                select
                local.tee $l8
                i32.const 0
                i32.lt_s
                br_if $B24
                local.get $l8
                i32.load8_u offset=3145752
                br_if $B24
                local.get $l8
                i32.const 1
                i32.shl
                local.tee $l9
                i32.load16_u offset=196608
                local.get $l18
                i32.eq
                br_if $B24
                local.get $l20
                i32.load
                i32.const 1
                i32.add
                local.set $l11
                block $B25
                  local.get $l9
                  i32.load16_u offset=65536
                  local.get $l18
                  i32.ne
                  br_if $B25
                  local.get $l11
                  local.get $l8
                  i32.const 2
                  i32.shl
                  i32.load offset=327680
                  i32.ge_s
                  br_if $B24
                end
                local.get $l9
                i32.const 65536
                i32.add
                local.get $l4
                i32.store16
                local.get $l8
                i32.const 2
                i32.shl
                local.tee $l9
                local.get $l11
                i32.store offset=327680
                local.get $l9
                local.get $l21
                i32.store offset=589824
                block $B26
                  local.get $l19
                  i32.const 131071
                  i32.le_u
                  br_if $B26
                  i32.const 3
                  return
                end
                local.get $l8
                i32.const 8
                i32.shr_u
                local.get $l15
                i32.sub
                local.tee $l9
                local.get $l9
                i32.const 31
                i32.shr_s
                local.tee $l9
                i32.xor
                local.get $l9
                i32.sub
                local.get $l8
                i32.const 255
                i32.and
                local.get $l10
                i32.sub
                local.tee $l9
                local.get $l9
                i32.const 31
                i32.shr_s
                local.tee $l9
                i32.xor
                local.get $l9
                i32.sub
                i32.add
                local.get $l11
                i32.add
                local.set $l22
                i32.const 0
                local.set $l7
                block $B27
                  local.get $l19
                  i32.eqz
                  br_if $B27
                  local.get $l19
                  local.set $l9
                  loop $L28
                    block $B29
                      local.get $l8
                      local.get $l9
                      i32.const -1
                      i32.add
                      i32.const 1
                      i32.shr_u
                      local.tee $l12
                      i32.const 2
                      i32.shl
                      local.tee $l11
                      i32.load offset=1400832
                      local.tee $l23
                      i32.ge_u
                      local.get $l22
                      local.get $l11
                      i32.load offset=876544
                      local.tee $l11
                      i32.ge_u
                      local.get $l22
                      local.get $l11
                      i32.eq
                      select
                      i32.eqz
                      br_if $B29
                      local.get $l9
                      local.set $l7
                      br $B27
                    end
                    local.get $l9
                    i32.const 2
                    i32.shl
                    local.tee $l9
                    local.get $l23
                    i32.store offset=1400832
                    local.get $l9
                    local.get $l11
                    i32.store offset=876544
                    local.get $l12
                    local.set $l9
                    local.get $l12
                    br_if $L28
                  end
                end
                local.get $l19
                i32.const 1
                i32.add
                local.set $l19
                local.get $p0
                i32.const 1
                i32.add
                local.set $p0
                local.get $l7
                i32.const 2
                i32.shl
                local.tee $l9
                local.get $l8
                i32.store offset=1400832
                local.get $l9
                local.get $l22
                i32.store offset=876544
              end
              block $B30
                block $B31
                  i32.const -1
                  local.get $l21
                  i32.const 1
                  i32.add
                  local.get $l13
                  i32.const 255
                  i32.eq
                  select
                  local.tee $l8
                  i32.const 0
                  i32.ge_s
                  br_if $B31
                  local.get $p0
                  local.set $l7
                  br $B30
                end
                block $B32
                  local.get $l8
                  i32.load8_u offset=3145752
                  i32.eqz
                  br_if $B32
                  local.get $p0
                  local.set $l7
                  br $B30
                end
                block $B33
                  local.get $l8
                  i32.const 1
                  i32.shl
                  local.tee $l9
                  i32.load16_u offset=196608
                  local.get $l18
                  i32.ne
                  br_if $B33
                  local.get $p0
                  local.set $l7
                  br $B30
                end
                local.get $l20
                i32.load
                i32.const 1
                i32.add
                local.set $l11
                block $B34
                  local.get $l9
                  i32.load16_u offset=65536
                  local.get $l18
                  i32.ne
                  br_if $B34
                  local.get $l11
                  local.get $l8
                  i32.const 2
                  i32.shl
                  i32.load offset=327680
                  i32.lt_s
                  br_if $B34
                  local.get $p0
                  local.set $l7
                  br $B30
                end
                local.get $l9
                i32.const 65536
                i32.add
                local.get $l4
                i32.store16
                local.get $l8
                i32.const 2
                i32.shl
                local.tee $l9
                local.get $l11
                i32.store offset=327680
                local.get $l9
                local.get $l21
                i32.store offset=589824
                block $B35
                  local.get $l19
                  i32.const 131071
                  i32.le_u
                  br_if $B35
                  i32.const 3
                  return
                end
                local.get $l8
                i32.const 8
                i32.shr_u
                local.get $l15
                i32.sub
                local.tee $l9
                local.get $l9
                i32.const 31
                i32.shr_s
                local.tee $l9
                i32.xor
                local.get $l9
                i32.sub
                local.get $l8
                i32.const 255
                i32.and
                local.get $l10
                i32.sub
                local.tee $l9
                local.get $l9
                i32.const 31
                i32.shr_s
                local.tee $l9
                i32.xor
                local.get $l9
                i32.sub
                i32.add
                local.get $l11
                i32.add
                local.set $l13
                i32.const 0
                local.set $l23
                block $B36
                  local.get $l19
                  i32.eqz
                  br_if $B36
                  local.get $l19
                  local.set $l9
                  loop $L37
                    block $B38
                      local.get $l8
                      local.get $l9
                      i32.const -1
                      i32.add
                      i32.const 1
                      i32.shr_u
                      local.tee $l12
                      i32.const 2
                      i32.shl
                      local.tee $l11
                      i32.load offset=1400832
                      local.tee $l22
                      i32.ge_u
                      local.get $l13
                      local.get $l11
                      i32.load offset=876544
                      local.tee $l11
                      i32.ge_u
                      local.get $l13
                      local.get $l11
                      i32.eq
                      select
                      i32.eqz
                      br_if $B38
                      local.get $l9
                      local.set $l23
                      br $B36
                    end
                    local.get $l9
                    i32.const 2
                    i32.shl
                    local.tee $l9
                    local.get $l22
                    i32.store offset=1400832
                    local.get $l9
                    local.get $l11
                    i32.store offset=876544
                    local.get $l12
                    local.set $l9
                    local.get $l12
                    br_if $L37
                  end
                end
                local.get $l19
                i32.const 1
                i32.add
                local.set $l19
                local.get $p0
                i32.const 1
                i32.add
                local.set $l7
                local.get $l23
                i32.const 2
                i32.shl
                local.tee $p0
                local.get $l8
                i32.store offset=1400832
                local.get $p0
                local.get $l13
                i32.store offset=876544
              end
              local.get $l21
              i32.const 256
              i32.add
              i32.const -1
              local.get $l21
              i32.const 65280
              i32.lt_u
              select
              local.tee $p0
              i32.const 0
              i32.lt_s
              br_if $B12
              local.get $p0
              i32.load8_u offset=3145752
              br_if $B12
              local.get $p0
              i32.const 1
              i32.shl
              local.tee $l8
              i32.load16_u offset=196608
              local.get $l18
              i32.eq
              br_if $B12
              local.get $l20
              i32.load
              i32.const 1
              i32.add
              local.set $l9
              block $B39
                local.get $l8
                i32.load16_u offset=65536
                local.get $l18
                i32.ne
                br_if $B39
                local.get $l9
                local.get $p0
                i32.const 2
                i32.shl
                i32.load offset=327680
                i32.ge_s
                br_if $B12
              end
              local.get $l8
              i32.const 65536
              i32.add
              local.get $l4
              i32.store16
              local.get $p0
              i32.const 2
              i32.shl
              local.tee $l8
              local.get $l9
              i32.store offset=327680
              local.get $l8
              local.get $l21
              i32.store offset=589824
              block $B40
                local.get $l19
                i32.const 131071
                i32.le_u
                br_if $B40
                i32.const 3
                return
              end
              local.get $p0
              i32.const 8
              i32.shr_u
              local.get $l15
              i32.sub
              local.tee $l8
              local.get $l8
              i32.const 31
              i32.shr_s
              local.tee $l8
              i32.xor
              local.get $l8
              i32.sub
              local.get $p0
              i32.const 255
              i32.and
              local.get $l10
              i32.sub
              local.tee $l8
              local.get $l8
              i32.const 31
              i32.shr_s
              local.tee $l8
              i32.xor
              local.get $l8
              i32.sub
              i32.add
              local.get $l9
              i32.add
              local.set $l12
              i32.const 0
              local.set $l21
              block $B41
                local.get $l19
                i32.eqz
                br_if $B41
                local.get $l19
                local.set $l8
                loop $L42
                  block $B43
                    local.get $p0
                    local.get $l8
                    i32.const -1
                    i32.add
                    i32.const 1
                    i32.shr_u
                    local.tee $l11
                    i32.const 2
                    i32.shl
                    local.tee $l9
                    i32.load offset=1400832
                    local.tee $l13
                    i32.ge_u
                    local.get $l12
                    local.get $l9
                    i32.load offset=876544
                    local.tee $l9
                    i32.ge_u
                    local.get $l12
                    local.get $l9
                    i32.eq
                    select
                    i32.eqz
                    br_if $B43
                    local.get $l8
                    local.set $l21
                    br $B41
                  end
                  local.get $l8
                  i32.const 2
                  i32.shl
                  local.tee $l8
                  local.get $l13
                  i32.store offset=1400832
                  local.get $l8
                  local.get $l9
                  i32.store offset=876544
                  local.get $l11
                  local.set $l8
                  local.get $l11
                  br_if $L42
                end
              end
              local.get $l19
              i32.const 1
              i32.add
              local.set $l19
              local.get $l7
              i32.const 1
              i32.add
              local.set $l7
              local.get $l21
              i32.const 2
              i32.shl
              local.tee $l8
              local.get $p0
              i32.store offset=1400832
              local.get $l8
              local.get $l12
              i32.store offset=876544
            end
            local.get $l19
            br_if $L4
          end
        end
        i32.const -1568890649
        local.set $p0
        block $B44
          local.get $l14
          i32.const 1
          i32.shl
          i32.load16_u offset=196608
          local.get $l18
          i32.ne
          br_if $B44
          i32.const -1542899678
          local.set $p0
          loop $L45
            local.get $l14
            local.get $p0
            i32.xor
            i32.const 16777619
            i32.mul
            local.set $p0
            local.get $l14
            i32.const 2
            i32.shl
            i32.load offset=589824
            local.tee $l14
            i32.const -1
            i32.gt_s
            br_if $L45
          end
        end
        local.get $l17
        local.get $l1
        local.get $l6
        i32.xor
        i32.const 16777619
        i32.mul
        i32.xor
        i32.const 16777619
        i32.mul
        local.set $l1
        local.get $p0
        local.get $l2
        local.get $l6
        i32.xor
        i32.const 16777619
        i32.mul
        i32.xor
        i32.const 16777619
        i32.mul
        local.set $l2
        local.get $l6
        i32.const 1
        i32.add
        local.tee $l6
        i32.const 128
        i32.ne
        br_if $L3
      end
      i32.const 0
      local.set $l8
      i32.const 0
      local.set $p0
      i32.const 0
      local.set $l9
      loop $L46
        local.get $l8
        i32.const 851968
        i32.add
        local.get $p0
        i32.const 3211288
        i32.add
        i32.load16_u
        i32.store16
        local.get $l8
        i32.const 860160
        i32.add
        local.get $p0
        i32.const 3211290
        i32.add
        i32.load16_u
        i32.store16
        local.get $l9
        i32.const 868352
        i32.add
        local.get $p0
        i32.const 3211292
        i32.add
        i32.load8_u
        i32.const -3
        i32.add
        i32.store8
        local.get $l9
        i32.const 872448
        i32.add
        local.get $p0
        i32.const 3211294
        i32.add
        i32.load8_u
        i32.const -3
        i32.add
        i32.store8
        local.get $l8
        i32.const 2
        i32.add
        local.set $l8
        local.get $l9
        i32.const 1
        i32.add
        local.set $l9
        local.get $p0
        i32.const 8
        i32.add
        local.tee $p0
        i32.const 32768
        i32.ne
        br_if $L46
      end
      i32.const 698298832
      local.set $l11
      i32.const 137296536
      local.set $l12
      i32.const -330404727
      local.set $l13
      i32.const 1160258022
      local.set $l16
      i32.const 0
      local.set $l23
      i32.const 0
      local.set $l17
      i32.const 0
      local.set $l10
      loop $L47
        local.get $l17
        i32.const 2
        i32.shl
        local.tee $p0
        i32.const 3245082
        i32.add
        i32.load8_u
        local.tee $l8
        i32.const 16
        i32.shl
        local.get $p0
        i32.const 3245083
        i32.add
        i32.load8_u
        i32.const 24
        i32.shl
        i32.or
        local.get $p0
        i32.const 3245081
        i32.add
        i32.load8_u
        i32.const 8
        i32.shl
        local.get $p0
        i32.const 3245080
        i32.add
        i32.load8_u
        local.tee $p0
        i32.or
        local.tee $l4
        i32.or
        local.set $l19
        local.get $l8
        i32.const 15
        i32.and
        local.set $l14
        local.get $p0
        i32.const 1
        i32.and
        local.set $l18
        local.get $p0
        i32.const 1
        i32.shr_u
        i32.const 1
        i32.and
        local.set $l20
        i32.const 0
        local.set $l8
        i32.const 0
        local.set $p0
        loop $L48
          local.get $l8
          i32.const 851968
          i32.add
          local.tee $l9
          local.get $l18
          local.get $l9
          i32.load16_u
          i32.add
          local.get $p0
          i32.const 868352
          i32.add
          i32.load8_u
          i32.add
          i32.const 255
          i32.and
          local.tee $l9
          i32.store16
          local.get $l8
          i32.const 860160
          i32.add
          local.tee $l21
          local.get $l20
          local.get $l21
          i32.load16_u
          i32.add
          local.get $p0
          i32.const 872448
          i32.add
          i32.load8_u
          i32.add
          local.tee $l21
          i32.const 255
          i32.and
          local.tee $l22
          i32.store16
          local.get $l22
          local.get $l9
          local.get $p0
          local.get $l13
          i32.xor
          i32.const 16777619
          i32.mul
          i32.xor
          i32.const 16777619
          i32.mul
          i32.xor
          i32.const 16777619
          i32.mul
          local.set $l13
          local.get $l19
          local.get $l21
          i32.const 8
          i32.shl
          i32.const 65280
          i32.and
          local.get $l9
          i32.or
          i32.xor
          local.get $p0
          i32.xor
          local.tee $l9
          local.get $l3
          i32.xor
          i32.const 16777619
          i32.mul
          local.set $l3
          local.get $l9
          local.get $l11
          i32.xor
          i32.const 16777619
          i32.mul
          local.set $l11
          local.get $l12
          local.get $l14
          i32.xor
          local.get $l23
          local.get $p0
          i32.add
          i32.xor
          i32.const 16777619
          i32.mul
          local.set $l12
          local.get $l8
          i32.const 2
          i32.add
          local.set $l8
          local.get $p0
          i32.const 1
          i32.add
          local.tee $p0
          i32.const 4096
          i32.ne
          br_if $L48
        end
        block $B49
          local.get $l4
          i32.const 1023
          i32.and
          br_if $B49
          local.get $l10
          i32.const 1
          i32.add
          local.set $l10
          local.get $l19
          local.get $l17
          local.get $l16
          i32.xor
          i32.const 16777619
          i32.mul
          i32.xor
          i32.const 16777619
          i32.mul
          local.set $l16
        end
        local.get $l23
        i32.const 4096
        i32.add
        local.set $l23
        local.get $l17
        i32.const 1
        i32.add
        local.tee $l17
        i32.const 1800
        i32.ne
        br_if $L47
      end
      i32.const 0
      local.set $p0
      i32.const 0
      local.get $l3
      local.get $l2
      i32.xor
      i32.const 16777619
      i32.mul
      local.get $l1
      i32.xor
      i32.const 16777619
      i32.mul
      local.get $l11
      i32.xor
      i32.const 16777619
      i32.mul
      local.get $l12
      i32.xor
      i32.const 16777619
      i32.mul
      local.get $l13
      i32.xor
      i32.const 16777619
      i32.mul
      local.get $l16
      i32.xor
      i32.const 16777619
      i32.mul
      i32.store offset=3276800
      i32.const 0
      local.get $l2
      i32.store offset=3276804
      i32.const 0
      local.get $l1
      i32.store offset=3276808
      i32.const 0
      local.get $l11
      i32.store offset=3276812
      i32.const 0
      local.get $l12
      i32.store offset=3276816
      i32.const 0
      local.get $l13
      i32.store offset=3276820
      i32.const 0
      local.get $l16
      i32.store offset=3276824
      i32.const 0
      i32.const 7372800
      i32.store offset=3276828
      i32.const 0
      local.get $l5
      i32.store offset=3276832
      i32.const 0
      local.get $l7
      i32.store offset=3276836
      i32.const 0
      i32.const 7372800
      i32.store offset=3276840
      i32.const 0
      local.get $l10
      i32.store offset=3276844
    end
    local.get $p0)
  (table $__indirect_function_table 1 1 funcref)
  (memory $memory 52)
  (global $__stack_pointer (mut i32) (i32.const 65536))
  (global $__dso_handle i32 (i32.const 65536))
  (global $__data_end i32 (i32.const 1925120))
  (global $__stack_low i32 (i32.const 0))
  (global $__stack_high i32 (i32.const 65536))
  (global $__global_base i32 (i32.const 65536))
  (global $__heap_base i32 (i32.const 1925120))
  (global $__heap_end i32 (i32.const 3407872))
  (global $__memory_base i32 (i32.const 0))
  (global $__table_base i32 (i32.const 1))
  (global $__wasm_first_page_end i32 (i32.const 65536))
  (export "memory" (memory $memory))
  (export "__wasm_call_ctors" (func $__wasm_call_ctors))
  (export "__stack_pointer" (global $__stack_pointer))
  (export "pathfinding_trace" (func $pathfinding_trace))
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
