;; game.dom-tactics-grid.v1 — kernel: tactics_trace
;; WebAssembly Text (WAT) baseline implementation
;; Exports: tactics_trace

(module $tactics_kernel_c.wasm
  (type $t0 (func))
  (type $t1 (func (param i32) (result i32)))
  (func $__wasm_call_ctors (type $t0))
  (func $tactics_trace (type $t1) (param $p0 i32) (result i32)
    (local $l1 i32) (local $l2 i32) (local $l3 i32) (local $l4 i32) (local $l5 i32) (local $l6 i32) (local $l7 i32) (local $l8 i32) (local $l9 i32) (local $l10 i32) (local $l11 i32) (local $l12 i32) (local $l13 i32) (local $l14 i32) (local $l15 i32) (local $l16 i32) (local $l17 i32) (local $l18 i32) (local $l19 i32) (local $l20 i32) (local $l21 i32) (local $l22 i32) (local $l23 i32) (local $l24 i32) (local $l25 i32) (local $l26 i32) (local $l27 i32) (local $l28 i32) (local $l29 i32) (local $l30 i32) (local $l31 i32) (local $l32 i32) (local $l33 i32) (local $l34 i32)
    i32.const 1
    local.set $l1
    block $B0
      local.get $p0
      i32.const 7064
      i32.ne
      br_if $B0
      i32.const 2
      local.set $l1
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
      i32.const 64
      i32.ne
      br_if $B0
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
      i32.const 128
      i32.ne
      br_if $B0
      i32.const -8192
      local.set $l1
      loop $L1
        local.get $l1
        i32.const 81920
        i32.add
        i32.const 65535
        i32.store16
        local.get $l1
        i32.const 73728
        i32.add
        i32.const 0
        i32.store
        local.get $l1
        i32.const 81922
        i32.add
        i32.const 65535
        i32.store16
        local.get $l1
        i32.const 73732
        i32.add
        i32.const 0
        i32.store16
        local.get $l1
        i32.const 81924
        i32.add
        i32.const 65535
        i32.store16
        local.get $l1
        i32.const 73734
        i32.add
        i32.const 0
        i32.store16
        local.get $l1
        i32.const 81926
        i32.add
        i32.const 65535
        i32.store16
        local.get $l1
        i32.const 8
        i32.add
        local.tee $l1
        br_if $L1
      end
      i32.const 0
      local.set $l1
      i32.const 81920
      local.set $l2
      i32.const 0
      local.set $p0
      loop $L2
        local.get $l2
        local.get $l1
        i32.const 3149851
        i32.add
        i32.load8_u
        i32.const 14
        i32.shl
        local.get $l1
        i32.const 3149850
        i32.add
        i32.load8_u
        i32.const 6
        i32.shl
        i32.or
        local.get $l1
        i32.const 3149848
        i32.add
        i32.load16_u
        i32.add
        local.tee $l3
        i32.store16
        local.get $p0
        i32.const 82176
        i32.add
        local.get $l1
        i32.const 3149852
        i32.add
        i32.load8_u
        i32.store8
        local.get $p0
        i32.const 82304
        i32.add
        local.get $l1
        i32.const 3149853
        i32.add
        i32.load8_u
        i32.const 1
        i32.and
        i32.store8
        block $B3
          local.get $l3
          i32.const 65535
          i32.and
          i32.const 1
          i32.shl
          local.tee $l3
          i32.load16_s offset=73728
          i32.const -1
          i32.gt_s
          br_if $B3
          local.get $l3
          i32.const 73728
          i32.add
          local.get $p0
          i32.store16
        end
        local.get $l2
        i32.const 2
        i32.add
        local.set $l2
        local.get $p0
        i32.const 1
        i32.add
        local.set $p0
        local.get $l1
        i32.const 8
        i32.add
        local.tee $l1
        i32.const 1024
        i32.ne
        br_if $L2
      end
      i32.const 0
      i32.load16_u offset=81920
      local.set $l4
      i32.const 1567758767
      local.set $l5
      i32.const 0
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
      i32.const 0
      local.set $l12
      i32.const 0
      local.set $l13
      i32.const 0
      local.set $l14
      i32.const 0
      local.set $l15
      i32.const 0
      local.set $l16
      i32.const 0
      local.set $l17
      i32.const 0
      local.set $l18
      i32.const 0
      local.set $l19
      i32.const 0
      local.set $l20
      loop $L4
        local.get $l11
        local.get $l17
        i32.const 3
        i32.shl
        local.tee $l1
        i32.const 3150878
        i32.add
        i32.load8_u
        local.tee $p0
        i32.const 7
        i32.mul
        i32.const 127
        i32.and
        local.get $l17
        i32.const 3
        i32.and
        local.tee $l2
        select
        local.set $l21
        local.get $l1
        i32.const 3150879
        i32.add
        i32.load8_u
        i32.const 8
        i32.shl
        local.get $p0
        i32.or
        local.set $l22
        local.get $l1
        i32.const 3150877
        i32.add
        i32.load8_u
        i32.const 8
        i32.shl
        local.get $l1
        i32.const 3150876
        i32.add
        i32.load8_u
        local.tee $l23
        i32.or
        local.set $l24
        local.get $l1
        i32.const 3150875
        i32.add
        i32.load8_u
        local.set $l25
        local.get $l1
        i32.const 3150874
        i32.add
        i32.load8_u
        local.set $l26
        local.get $l10
        local.get $l2
        i32.eqz
        local.tee $l27
        i32.add
        local.set $l28
        local.get $l1
        i32.const 3150873
        i32.add
        i32.load8_u
        local.set $l29
        block $B5
          block $B6
            block $B7
              block $B8
                local.get $l1
                i32.const 3150872
                i32.add
                i32.load8_u
                local.tee $l30
                br_table $B8 $B7 $B6
              end
              local.get $l28
              i32.const 2
              i32.add
              local.set $l28
              local.get $l9
              i32.const 1
              i32.add
              local.set $l9
              local.get $l29
              i32.const 1
              i32.shl
              i32.load16_u offset=81920
              local.set $l4
              br $B5
            end
            i32.const 1
            local.set $l11
            i32.const 0
            local.set $l1
            i32.const 0
            local.get $l29
            i32.const 1
            i32.shl
            local.tee $p0
            i32.load16_u offset=81920
            local.tee $l10
            i32.store16 offset=82432
            local.get $l10
            i32.const 1
            i32.shl
            local.tee $l2
            local.get $l20
            i32.const 1
            i32.add
            local.tee $l20
            i32.store16 offset=65536
            local.get $l2
            i32.const 65535
            i32.store16 offset=90624
            local.get $p0
            i32.const 81920
            i32.add
            local.set $l31
            i32.const 82432
            local.set $l2
            block $B9
              loop $L10
                local.get $l1
                local.set $l32
                local.get $l24
                local.get $l2
                i32.load16_u
                local.tee $l1
                i32.eq
                br_if $B9
                local.get $l1
                i32.const -1
                i32.add
                i32.const -1
                local.get $l1
                i32.const 63
                i32.and
                local.tee $l33
                select
                local.set $p0
                block $B11
                  i32.const -1
                  local.get $l1
                  i32.const -64
                  i32.add
                  local.get $l1
                  i32.const 64
                  i32.lt_u
                  select
                  local.tee $l3
                  i32.const 0
                  i32.lt_s
                  br_if $B11
                  local.get $l3
                  i32.const 1
                  i32.shl
                  local.tee $l34
                  i32.load16_u offset=65536
                  local.get $l20
                  i32.const 65535
                  i32.and
                  i32.eq
                  br_if $B11
                  local.get $l3
                  i32.load8_u offset=3145752
                  i32.const 3
                  i32.eq
                  br_if $B11
                  block $B12
                    local.get $l3
                    local.get $l24
                    i32.eq
                    br_if $B12
                    local.get $l34
                    i32.load16_s offset=73728
                    i32.const -1
                    i32.gt_s
                    br_if $B11
                  end
                  local.get $l34
                  i32.const 65536
                  i32.add
                  local.get $l20
                  i32.store16
                  local.get $l34
                  local.get $l1
                  i32.store16 offset=90624
                  local.get $l11
                  i32.const 1
                  i32.shl
                  local.get $l3
                  i32.store16 offset=82432
                  local.get $l11
                  i32.const 1
                  i32.add
                  local.set $l11
                end
                block $B13
                  local.get $p0
                  i32.const 0
                  i32.lt_s
                  br_if $B13
                  local.get $p0
                  i32.const 1
                  i32.shl
                  local.tee $l3
                  i32.load16_u offset=65536
                  local.get $l20
                  i32.const 65535
                  i32.and
                  i32.eq
                  br_if $B13
                  local.get $p0
                  i32.load8_u offset=3145752
                  i32.const 3
                  i32.eq
                  br_if $B13
                  block $B14
                    local.get $p0
                    local.get $l24
                    i32.eq
                    br_if $B14
                    local.get $l3
                    i32.load16_s offset=73728
                    i32.const -1
                    i32.gt_s
                    br_if $B13
                  end
                  local.get $l3
                  i32.const 65536
                  i32.add
                  local.get $l20
                  i32.store16
                  local.get $l3
                  local.get $l1
                  i32.store16 offset=90624
                  local.get $l11
                  i32.const 1
                  i32.shl
                  local.get $p0
                  i32.store16 offset=82432
                  local.get $l11
                  i32.const 1
                  i32.add
                  local.set $l11
                end
                block $B15
                  local.get $l33
                  i32.const 63
                  i32.eq
                  br_if $B15
                  local.get $l1
                  i32.const 1
                  i32.add
                  local.tee $p0
                  i32.const 1
                  i32.shl
                  local.tee $l3
                  i32.load16_u offset=65536
                  local.get $l20
                  i32.const 65535
                  i32.and
                  i32.eq
                  br_if $B15
                  local.get $p0
                  i32.load8_u offset=3145752
                  i32.const 3
                  i32.eq
                  br_if $B15
                  block $B16
                    local.get $p0
                    local.get $l24
                    i32.eq
                    br_if $B16
                    local.get $l3
                    i32.load16_s offset=73728
                    i32.const -1
                    i32.gt_s
                    br_if $B15
                  end
                  local.get $l3
                  i32.const 65536
                  i32.add
                  local.get $l20
                  i32.store16
                  local.get $l3
                  local.get $l1
                  i32.store16 offset=90624
                  local.get $l11
                  i32.const 1
                  i32.shl
                  local.get $p0
                  i32.store16 offset=82432
                  local.get $l11
                  i32.const 1
                  i32.add
                  local.set $l11
                end
                block $B17
                  local.get $l1
                  i32.const 4031
                  i32.gt_u
                  br_if $B17
                  local.get $l1
                  i32.const 64
                  i32.add
                  local.tee $p0
                  i32.const 1
                  i32.shl
                  local.tee $l3
                  i32.load16_u offset=65536
                  local.get $l20
                  i32.const 65535
                  i32.and
                  i32.eq
                  br_if $B17
                  local.get $p0
                  i32.load8_u offset=3145752
                  i32.const 3
                  i32.eq
                  br_if $B17
                  block $B18
                    local.get $p0
                    local.get $l24
                    i32.eq
                    br_if $B18
                    local.get $l3
                    i32.load16_s offset=73728
                    i32.const -1
                    i32.gt_s
                    br_if $B17
                  end
                  local.get $l3
                  i32.const 65536
                  i32.add
                  local.get $l20
                  i32.store16
                  local.get $l3
                  local.get $l1
                  i32.store16 offset=90624
                  local.get $l11
                  i32.const 1
                  i32.shl
                  local.get $p0
                  i32.store16 offset=82432
                  local.get $l11
                  i32.const 1
                  i32.add
                  local.set $l11
                end
                local.get $l2
                i32.const 2
                i32.add
                local.set $l2
                local.get $l32
                i32.const 1
                i32.add
                local.tee $l1
                local.get $l11
                i32.lt_u
                br_if $L10
              end
            end
            local.get $l7
            local.get $l32
            i32.add
            i32.const 1
            i32.add
            local.set $l7
            local.get $l24
            i32.const 1
            i32.shl
            local.tee $p0
            i32.load16_u offset=65536
            local.get $l20
            i32.const 65535
            i32.and
            i32.ne
            br_if $B6
            local.get $l24
            local.set $l1
            loop $L19
              local.get $l5
              local.get $l1
              i32.xor
              i32.const 16777619
              i32.mul
              local.set $l5
              local.get $l1
              i32.const 1
              i32.shl
              i32.load16_s offset=90624
              local.tee $l1
              i32.const -1
              i32.gt_s
              br_if $L19
            end
            block $B20
              local.get $p0
              i32.load16_s offset=73728
              local.tee $l1
              i32.const 0
              i32.lt_s
              br_if $B20
              local.get $l1
              local.get $l29
              i32.ne
              br_if $B6
            end
            local.get $p0
            i32.const 73728
            i32.add
            local.set $l1
            block $B21
              local.get $l10
              i32.const 1
              i32.shl
              local.tee $p0
              i32.load16_s offset=73728
              local.get $l29
              i32.ne
              br_if $B21
              local.get $p0
              i32.const 73728
              i32.add
              i32.const 65535
              i32.store16
            end
            local.get $l1
            local.get $l29
            i32.store16
            local.get $l31
            local.get $l24
            i32.store16
            local.get $l28
            i32.const 3
            i32.add
            local.set $l28
            local.get $l9
            i32.const 1
            i32.add
            local.set $l9
            local.get $l24
            local.set $l4
          end
          block $B22
            local.get $l30
            i32.const -2
            i32.add
            br_table $B22 $B5 $B22 $B5
          end
          local.get $l23
          i32.const 63
          i32.and
          local.tee $l31
          local.get $l26
          i32.const 63
          i32.and
          local.tee $p0
          i32.sub
          local.tee $l1
          local.get $l1
          i32.const 31
          i32.shr_s
          local.tee $l1
          i32.xor
          local.get $l1
          i32.sub
          local.tee $l32
          local.get $l24
          i32.const 6
          i32.shr_u
          local.tee $l11
          local.get $l25
          i32.const 8
          i32.shl
          local.get $l26
          i32.or
          local.tee $l34
          i32.const 6
          i32.shr_u
          local.tee $l1
          i32.sub
          local.tee $l2
          local.get $l2
          i32.const 31
          i32.shr_s
          local.tee $l2
          i32.xor
          local.get $l2
          i32.sub
          local.tee $l26
          i32.sub
          local.set $l2
          i32.const 0
          local.get $l26
          i32.sub
          local.set $l10
          i32.const 1
          i32.const -1
          local.get $l11
          local.get $l1
          i32.gt_u
          select
          local.set $l23
          i32.const 1
          i32.const -1
          local.get $l31
          local.get $p0
          i32.gt_u
          select
          local.set $l25
          local.get $l6
          i32.const 1
          i32.add
          local.set $l6
          loop $L23
            block $B24
              local.get $p0
              local.get $l1
              i32.const 6
              i32.shl
              i32.add
              local.tee $l3
              local.get $l34
              i32.eq
              br_if $B24
              local.get $l3
              local.get $l24
              i32.eq
              br_if $B24
              local.get $l3
              i32.const 3145752
              i32.add
              i32.load8_u
              i32.const 3
              i32.eq
              br_if $B5
            end
            block $B25
              block $B26
                local.get $l1
                local.get $l11
                i32.ne
                br_if $B26
                local.get $p0
                local.get $l31
                i32.eq
                br_if $B25
              end
              local.get $l2
              i32.const 0
              local.get $l26
              local.get $l2
              i32.const 1
              i32.shl
              local.tee $l3
              local.get $l10
              i32.lt_s
              local.tee $l33
              select
              i32.sub
              i32.const 0
              local.get $l32
              local.get $l3
              local.get $l32
              i32.gt_s
              local.tee $l3
              select
              i32.add
              local.set $l2
              local.get $l6
              i32.const 1
              i32.add
              local.set $l6
              i32.const 0
              local.get $l23
              local.get $l3
              select
              local.get $l1
              i32.add
              local.set $l1
              i32.const 0
              local.get $l25
              local.get $l33
              select
              local.get $p0
              i32.add
              local.set $p0
              br $L23
            end
          end
          local.get $l24
          i32.const 1
          i32.shl
          i32.load16_s offset=73728
          local.tee $l1
          i32.const 0
          i32.lt_s
          br_if $B5
          local.get $l1
          local.get $l1
          i32.load8_u offset=82176
          local.tee $p0
          i32.const 3
          i32.const 1
          local.get $l30
          i32.const 4
          i32.eq
          select
          local.tee $l2
          i32.sub
          i32.const 0
          local.get $p0
          local.get $l2
          i32.gt_u
          select
          i32.store8 offset=82176
          local.get $l28
          i32.const 1
          i32.add
          local.set $l28
          local.get $l9
          i32.const 1
          i32.add
          local.set $l9
        end
        local.get $l21
        i32.const 1
        i32.add
        i32.const 127
        i32.and
        local.get $l21
        local.get $l30
        i32.const 3
        i32.eq
        local.tee $l1
        select
        local.set $l11
        local.get $l22
        local.get $l5
        i32.xor
        local.get $l29
        i32.const 1
        i32.shl
        i32.load16_u offset=81920
        local.get $l30
        local.get $l29
        i32.load8_u offset=82176
        i32.xor
        local.get $l29
        i32.xor
        i32.const 255
        i32.and
        i32.xor
        i32.const 65535
        i32.and
        i32.xor
        local.get $l4
        i32.xor
        i32.const 16777619
        i32.mul
        local.set $l5
        local.get $l28
        local.get $l1
        i32.add
        local.set $l10
        block $B27
          local.get $l17
          i32.const 1
          i32.add
          local.tee $l17
          i32.const 3
          i32.and
          br_if $B27
          local.get $l11
          i32.const -785314906
          i32.xor
          i32.const 16777619
          i32.mul
          local.set $l14
          i32.const -1843997223
          local.set $l12
          i32.const 0
          local.set $l1
          i32.const 81920
          local.set $p0
          i32.const 0
          local.set $l34
          i32.const 0
          local.set $l26
          loop $L28
            local.get $l1
            i32.const 82304
            i32.add
            i32.load8_u
            local.tee $l18
            i32.const 8
            i32.shl
            local.get $l1
            i32.const 82176
            i32.add
            i32.load8_u
            local.tee $l16
            i32.or
            local.get $l1
            local.get $l12
            i32.xor
            i32.const 16777619
            i32.mul
            local.get $p0
            i32.load16_u
            local.tee $l2
            i32.xor
            i32.const 16777619
            i32.mul
            i32.xor
            local.set $l3
            local.get $l11
            local.get $l1
            i32.add
            i32.const 127
            i32.and
            local.get $l14
            i32.xor
            local.set $l13
            block $B29
              local.get $l2
              i32.load8_u offset=3145752
              i32.const 2
              i32.ne
              br_if $B29
              local.get $l16
              i32.eqz
              br_if $B29
              block $B30
                local.get $l18
                i32.eqz
                br_if $B30
                local.get $l34
                i32.const 1
                i32.add
                local.set $l34
                br $B29
              end
              local.get $l26
              i32.const 1
              i32.add
              local.set $l26
            end
            local.get $l3
            i32.const 16777619
            i32.mul
            local.set $l12
            local.get $p0
            i32.const 2
            i32.add
            local.set $p0
            local.get $l13
            i32.const 16777619
            i32.mul
            local.set $l14
            local.get $l1
            i32.const 1
            i32.add
            local.tee $l1
            i32.const 128
            i32.ne
            br_if $L28
          end
          i32.const -1988494565
          local.set $l13
          i32.const 805139163
          local.set $l16
          i32.const -1193168915
          local.set $l18
          i32.const 73728
          local.set $l2
          i32.const 0
          local.set $l1
          loop $L31
            i32.const 131072
            i32.const 0
            local.get $l4
            local.get $l1
            i32.eq
            local.tee $l32
            select
            i32.const 65536
            i32.const 0
            local.get $l4
            local.get $l1
            i32.eq
            local.tee $l33
            select
            i32.or
            local.get $l2
            i32.load16_s
            local.tee $p0
            i32.const 1
            i32.add
            i32.xor
            local.get $l1
            local.get $l16
            i32.xor
            i32.const 16777619
            i32.mul
            local.get $l1
            i32.const 3145752
            i32.add
            i32.load8_u
            i32.xor
            i32.const 16777619
            i32.mul
            i32.xor
            local.set $l16
            i32.const -1
            local.get $p0
            local.get $p0
            i32.const 0
            i32.lt_s
            local.tee $l24
            select
            local.get $l13
            i32.xor
            local.set $l13
            i32.const 0
            local.set $l3
            block $B32
              local.get $l24
              br_if $B32
              local.get $p0
              i32.load8_u offset=82304
              i32.const 10
              i32.shl
              local.get $p0
              i32.load8_u offset=82176
              i32.const 2
              i32.shl
              i32.or
              local.set $l3
            end
            local.get $l16
            i32.const 16777619
            i32.mul
            local.set $l16
            local.get $l13
            i32.const 16777619
            i32.mul
            local.set $l13
            i32.const 2
            i32.const 0
            local.get $l32
            select
            local.get $l33
            i32.or
            local.get $l18
            i32.const 1735551332
            i32.xor
            i32.const 16777619
            i32.mul
            i32.xor
            local.get $l3
            i32.xor
            i32.const 16777619
            i32.mul
            local.set $l18
            local.get $l2
            i32.const 2
            i32.add
            local.set $l2
            local.get $l1
            i32.const 1
            i32.add
            local.tee $l1
            i32.const 4096
            i32.ne
            br_if $L31
          end
          local.get $l13
          local.get $l12
          local.get $l5
          i32.xor
          i32.const 16777619
          i32.mul
          i32.xor
          i32.const 16777619
          i32.mul
          local.get $l14
          i32.xor
          i32.const 16777619
          i32.mul
          local.get $l26
          i32.const -1730169428
          i32.xor
          i32.const 16777619
          i32.mul
          local.get $l34
          i32.xor
          i32.const 16777619
          i32.mul
          local.tee $l15
          i32.xor
          i32.const 16777619
          i32.mul
          local.get $l16
          i32.xor
          i32.const 16777619
          i32.mul
          local.get $l4
          i32.const -803545161
          i32.xor
          i32.const 16777619
          i32.mul
          local.tee $l19
          i32.xor
          i32.const 16777619
          i32.mul
          local.get $l18
          i32.xor
          i32.const 16777619
          i32.mul
          local.set $l5
          local.get $l10
          i32.const 2
          i32.add
          local.set $l10
        end
        local.get $l8
        local.get $l27
        i32.add
        local.set $l8
        local.get $l17
        i32.const 240
        i32.ne
        br_if $L4
      end
      i32.const 0
      local.set $l1
      i32.const 0
      local.get $l5
      i32.store offset=3276800
      i32.const 0
      local.get $l12
      i32.store offset=3276804
      i32.const 0
      local.get $l13
      i32.store offset=3276808
      i32.const 0
      local.get $l14
      i32.store offset=3276812
      i32.const 0
      local.get $l15
      i32.store offset=3276816
      i32.const 0
      local.get $l16
      i32.store offset=3276820
      i32.const 0
      local.get $l19
      i32.store offset=3276824
      i32.const 0
      local.get $l18
      i32.store offset=3276828
      i32.const 0
      local.get $l8
      i32.store offset=3276832
      i32.const 0
      local.get $l7
      i32.store offset=3276836
      i32.const 0
      local.get $l6
      i32.store offset=3276840
      i32.const 0
      local.get $l9
      i32.store offset=3276844
      i32.const 0
      local.get $l10
      i32.store offset=3276848
    end
    local.get $l1)
  (table $__indirect_function_table 1 1 funcref)
  (memory $memory 64)
  (global $__stack_pointer (mut i32) (i32.const 65536))
  (global $__dso_handle i32 (i32.const 65536))
  (global $__data_end i32 (i32.const 98816))
  (global $__stack_low i32 (i32.const 0))
  (global $__stack_high i32 (i32.const 65536))
  (global $__global_base i32 (i32.const 65536))
  (global $__heap_base i32 (i32.const 98816))
  (global $__heap_end i32 (i32.const 4194304))
  (global $__memory_base i32 (i32.const 0))
  (global $__table_base i32 (i32.const 1))
  (global $__wasm_first_page_end i32 (i32.const 65536))
  (export "memory" (memory $memory))
  (export "__wasm_call_ctors" (func $__wasm_call_ctors))
  (export "__stack_pointer" (global $__stack_pointer))
  (export "tactics_trace" (func $tactics_trace))
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
