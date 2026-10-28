;; text.diff-patch.v1 — kernel: myers_diff
;; WebAssembly Text (WAT) baseline implementation
;; Exports: myers_diff

(module $myers_diff_c.wasm
  (type $t0 (func))
  (type $t1 (func (param i32 i32 i32 i32 i32 i32 i32 i32 i32 i32 i32 i32) (result i32)))
  (func $__wasm_call_ctors (type $t0))
  (func $myers_diff (type $t1) (param $p0 i32) (param $p1 i32) (param $p2 i32) (param $p3 i32) (param $p4 i32) (param $p5 i32) (param $p6 i32) (param $p7 i32) (param $p8 i32) (param $p9 i32) (param $p10 i32) (param $p11 i32) (result i32)
    (local $l12 i32) (local $l13 i32) (local $l14 i32) (local $l15 i32) (local $l16 i32) (local $l17 i32) (local $l18 i32) (local $l19 i32) (local $l20 i32) (local $l21 i32) (local $l22 i32) (local $l23 i32) (local $l24 i32) (local $l25 i32) (local $l26 i32) (local $l27 i32) (local $l28 i32) (local $l29 i32) (local $l30 i32) (local $l31 i32) (local $l32 i32) (local $l33 i32) (local $l34 i32) (local $l35 i32) (local $l36 i32) (local $l37 i32) (local $l38 i32)
    i32.const 0
    local.set $l12
    i32.const 0
    local.set $l13
    block $B0
      local.get $p1
      local.get $p3
      local.get $p1
      local.get $p3
      i32.lt_u
      select
      local.tee $l14
      i32.eqz
      br_if $B0
      i32.const 0
      local.set $l13
      local.get $p0
      local.set $l15
      local.get $p2
      local.set $l16
      loop $L1
        local.get $l15
        i32.load
        local.get $l16
        i32.load
        i32.ne
        br_if $B0
        local.get $l15
        i32.const 4
        i32.add
        local.set $l15
        local.get $l16
        i32.const 4
        i32.add
        local.set $l16
        local.get $l14
        local.get $l13
        i32.const 1
        i32.add
        local.tee $l13
        i32.ne
        br_if $L1
      end
      local.get $l14
      local.set $l13
    end
    block $B2
      local.get $p1
      local.get $l13
      i32.sub
      local.tee $l17
      local.get $p3
      local.get $l13
      i32.sub
      local.tee $l15
      local.get $l17
      local.get $l15
      i32.lt_u
      select
      local.tee $l14
      i32.eqz
      br_if $B2
      local.get $p1
      i32.const 2
      i32.shl
      local.get $p0
      i32.add
      i32.const -4
      i32.add
      local.set $l15
      local.get $p3
      i32.const 2
      i32.shl
      local.get $p2
      i32.add
      i32.const -4
      i32.add
      local.set $l16
      i32.const 0
      local.set $l12
      loop $L3
        local.get $l15
        i32.load
        local.get $l16
        i32.load
        i32.ne
        br_if $B2
        local.get $l15
        i32.const -4
        i32.add
        local.set $l15
        local.get $l16
        i32.const -4
        i32.add
        local.set $l16
        local.get $l14
        local.get $l12
        i32.const 1
        i32.add
        local.tee $l12
        i32.ne
        br_if $L3
      end
      local.get $l14
      local.set $l12
    end
    local.get $l17
    local.get $l12
    i32.sub
    local.set $l17
    local.get $l13
    local.get $l12
    i32.add
    local.set $l18
    i32.const 0
    local.set $l19
    block $B4
      local.get $l12
      i32.eqz
      br_if $B4
      local.get $p7
      i32.eqz
      br_if $B4
      local.get $l12
      i32.const -1
      i32.add
      local.tee $l15
      local.get $p7
      i32.const -1
      i32.add
      local.tee $l16
      local.get $l15
      local.get $l16
      i32.lt_u
      select
      local.tee $l15
      i32.const 1
      i32.add
      local.set $l19
      i32.const 0
      local.set $l20
      block $B5
        local.get $l15
        i32.eqz
        br_if $B5
        local.get $l19
        i32.const 1
        i32.and
        local.set $l21
        local.get $p1
        i32.const -1
        i32.add
        local.set $l22
        local.get $p3
        i32.const -1
        i32.add
        local.set $l23
        local.get $l19
        i32.const -2
        i32.and
        local.set $l24
        local.get $p6
        local.set $l15
        local.get $p5
        local.set $l16
        local.get $p4
        local.set $l14
        i32.const 0
        local.set $l20
        loop $L6
          local.get $l14
          i32.const 0
          i32.store
          local.get $l16
          local.get $l22
          i32.store
          local.get $l15
          local.get $l23
          i32.store
          local.get $l14
          i32.const 4
          i32.add
          i32.const 0
          i32.store
          local.get $l16
          i32.const 4
          i32.add
          local.get $p1
          local.get $l20
          i32.const -2
          i32.xor
          local.tee $l25
          i32.add
          i32.store
          local.get $l15
          i32.const 4
          i32.add
          local.get $p3
          local.get $l25
          i32.add
          i32.store
          local.get $l22
          i32.const -2
          i32.add
          local.set $l22
          local.get $l23
          i32.const -2
          i32.add
          local.set $l23
          local.get $l15
          i32.const 8
          i32.add
          local.set $l15
          local.get $l16
          i32.const 8
          i32.add
          local.set $l16
          local.get $l14
          i32.const 8
          i32.add
          local.set $l14
          local.get $l24
          local.get $l20
          i32.const 2
          i32.add
          local.tee $l20
          i32.ne
          br_if $L6
        end
        local.get $l21
        i32.eqz
        br_if $B4
      end
      local.get $p4
      local.get $l20
      i32.const 2
      i32.shl
      local.tee $l15
      i32.add
      i32.const 0
      i32.store
      local.get $p5
      local.get $l15
      i32.add
      local.get $p1
      local.get $l20
      i32.const -1
      i32.xor
      local.tee $l16
      i32.add
      i32.store
      local.get $p6
      local.get $l15
      i32.add
      local.get $p3
      local.get $l16
      i32.add
      i32.store
    end
    local.get $p3
    local.get $l18
    i32.sub
    local.set $l20
    block $B7
      block $B8
        local.get $l17
        br_if $B8
        i32.const 0
        local.set $p0
        block $B9
          local.get $l20
          br_if $B9
          local.get $l19
          local.set $l14
          br $B7
        end
        block $B10
          local.get $l19
          local.get $p7
          i32.lt_u
          br_if $B10
          local.get $l19
          local.set $l14
          br $B7
        end
        local.get $p4
        local.get $l19
        i32.const 2
        i32.shl
        local.tee $l15
        i32.add
        local.set $l16
        local.get $p5
        local.get $l15
        i32.add
        local.set $l17
        local.get $p6
        local.get $l15
        i32.add
        local.set $l22
        local.get $l12
        i32.const -1
        i32.xor
        local.get $p3
        i32.add
        local.tee $l23
        local.get $l13
        i32.sub
        local.set $l25
        i32.const 0
        local.set $l15
        block $B11
          loop $L12
            local.get $l16
            i32.const 2
            i32.store
            local.get $l17
            local.get $l13
            i32.store
            local.get $l22
            local.get $l23
            i32.store
            local.get $l15
            i32.const 1
            i32.add
            local.tee $l12
            local.get $l19
            i32.add
            local.set $l14
            local.get $l25
            local.get $l15
            i32.eq
            br_if $B11
            local.get $l23
            i32.const -1
            i32.add
            local.set $l23
            local.get $l16
            i32.const 4
            i32.add
            local.set $l16
            local.get $l17
            i32.const 4
            i32.add
            local.set $l17
            local.get $l22
            i32.const 4
            i32.add
            local.set $l22
            local.get $l12
            local.set $l15
            local.get $l14
            local.get $p7
            i32.lt_u
            br_if $L12
          end
        end
        i32.const 0
        local.set $p0
        br $B7
      end
      block $B13
        local.get $l20
        br_if $B13
        block $B14
          local.get $l19
          local.get $p7
          i32.lt_u
          br_if $B14
          i32.const 0
          local.set $p0
          local.get $l17
          local.set $l20
          local.get $l19
          local.set $l14
          br $B7
        end
        local.get $p4
        local.get $l19
        i32.const 2
        i32.shl
        local.tee $l15
        i32.add
        local.set $l16
        local.get $p5
        local.get $l15
        i32.add
        local.set $l20
        local.get $p6
        local.get $l15
        i32.add
        local.set $l22
        local.get $l12
        i32.const -1
        i32.xor
        local.get $p1
        i32.add
        local.tee $l23
        local.get $l13
        i32.sub
        local.set $l25
        i32.const 0
        local.set $l15
        block $B15
          loop $L16
            local.get $l16
            i32.const 1
            i32.store
            local.get $l20
            local.get $l23
            i32.store
            local.get $l22
            local.get $l13
            i32.store
            local.get $l15
            i32.const 1
            i32.add
            local.tee $l12
            local.get $l19
            i32.add
            local.set $l14
            local.get $l25
            local.get $l15
            i32.eq
            br_if $B15
            local.get $l23
            i32.const -1
            i32.add
            local.set $l23
            local.get $l16
            i32.const 4
            i32.add
            local.set $l16
            local.get $l20
            i32.const 4
            i32.add
            local.set $l20
            local.get $l22
            i32.const 4
            i32.add
            local.set $l22
            local.get $l12
            local.set $l15
            local.get $l14
            local.get $p7
            i32.lt_u
            br_if $L16
          end
        end
        i32.const 0
        local.set $p0
        local.get $l17
        local.set $l20
        br $B7
      end
      local.get $p8
      local.get $l17
      local.get $l20
      i32.add
      local.tee $l26
      i32.const 1
      i32.shl
      local.tee $l27
      i32.const 1
      i32.or
      local.tee $l28
      i32.const 2
      i32.shl
      i32.add
      local.set $l29
      local.get $p8
      local.get $l26
      i32.const 2
      i32.shl
      i32.add
      local.tee $l18
      i32.const 4
      i32.add
      i32.const 0
      i32.store
      local.get $p0
      local.get $l13
      i32.const 2
      i32.shl
      local.tee $l15
      i32.add
      local.set $l30
      local.get $p2
      local.get $l15
      i32.add
      local.set $l31
      local.get $l26
      i32.const 1
      i32.and
      i32.const 1
      i32.shl
      i32.const 1
      i32.or
      local.set $l32
      i32.const 0
      local.get $l26
      i32.const 1
      i32.shl
      i32.const -4
      i32.and
      i32.sub
      local.set $l33
      local.get $p8
      local.get $l26
      i32.const 3
      i32.shl
      local.tee $l24
      i32.const 4
      i32.or
      local.tee $l34
      i32.add
      local.set $l35
      i32.const 1
      local.set $l36
      i32.const 0
      local.set $p0
      i32.const 0
      local.set $l21
      loop $L17
        local.get $l21
        i32.const 1
        i32.shl
        local.set $l37
        local.get $l18
        local.get $l21
        i32.const 2
        i32.shl
        i32.add
        i32.const -4
        i32.add
        local.set $l38
        local.get $l21
        local.set $p2
        local.get $l36
        local.set $l23
        i32.const 0
        local.set $p1
        block $B18
          loop $L19
            local.get $p1
            local.get $l21
            i32.sub
            local.set $p3
            block $B20
              block $B21
                local.get $p1
                br_if $B21
                local.get $l18
                local.get $p3
                i32.const 2
                i32.shl
                i32.add
                i32.const 4
                i32.add
                i32.load
                local.set $l15
                br $B20
              end
              block $B22
                block $B23
                  local.get $p3
                  local.get $l21
                  i32.ne
                  br_if $B23
                  local.get $l38
                  i32.load
                  local.set $l16
                  br $B22
                end
                local.get $l18
                local.get $p3
                i32.const 2
                i32.shl
                i32.add
                local.tee $l15
                i32.const -4
                i32.add
                i32.load
                local.tee $l16
                local.get $l15
                i32.const 4
                i32.add
                i32.load
                local.tee $l15
                i32.lt_u
                br_if $B20
              end
              local.get $l16
              i32.const 1
              i32.add
              local.set $l15
            end
            local.get $p0
            i32.const 1
            i32.add
            local.set $p0
            local.get $l15
            local.get $l17
            i32.lt_u
            local.set $l12
            local.get $l15
            local.get $p3
            i32.sub
            local.tee $l16
            local.get $l20
            i32.lt_u
            local.set $l25
            block $B24
              block $B25
                local.get $l15
                local.get $l17
                i32.ge_u
                br_if $B25
                local.get $l16
                local.get $l20
                i32.ge_u
                br_if $B25
                local.get $l30
                local.get $l15
                i32.const 2
                i32.shl
                i32.add
                local.set $l16
                local.get $l31
                local.get $l15
                local.get $p2
                i32.add
                i32.const 2
                i32.shl
                i32.add
                local.set $l14
                loop $L26
                  block $B27
                    local.get $l16
                    i32.load
                    local.get $l14
                    i32.load
                    i32.eq
                    br_if $B27
                    local.get $l18
                    local.get $p3
                    i32.const 2
                    i32.shl
                    i32.add
                    local.get $l15
                    i32.store
                    br $B24
                  end
                  local.get $l23
                  local.get $l15
                  i32.add
                  local.tee $l22
                  local.get $l20
                  i32.lt_u
                  local.set $l25
                  local.get $l15
                  i32.const 1
                  i32.add
                  local.tee $l15
                  local.get $l17
                  i32.lt_u
                  local.set $l12
                  local.get $l15
                  local.get $l17
                  i32.ge_u
                  br_if $B25
                  local.get $l16
                  i32.const 4
                  i32.add
                  local.set $l16
                  local.get $l14
                  i32.const 4
                  i32.add
                  local.set $l14
                  local.get $l22
                  local.get $l20
                  i32.lt_u
                  br_if $L26
                end
              end
              local.get $l18
              local.get $p3
              i32.const 2
              i32.shl
              i32.add
              local.get $l15
              i32.store
              local.get $l12
              br_if $B24
              local.get $l25
              br_if $B24
              i32.const 0
              local.set $l22
              block $B28
                local.get $l27
                i32.const 3
                i32.lt_u
                br_if $B28
                local.get $l27
                i32.const -4
                i32.and
                local.set $l23
                i32.const 0
                local.set $l14
                i32.const 0
                local.set $l22
                loop $L29
                  local.get $p8
                  local.get $l24
                  i32.add
                  local.tee $l15
                  i32.const 4
                  i32.add
                  local.get $p8
                  local.get $l14
                  i32.add
                  local.tee $l16
                  i32.load
                  i32.store
                  local.get $l15
                  i32.const 8
                  i32.add
                  local.get $l16
                  i32.const 4
                  i32.add
                  i32.load
                  i32.store
                  local.get $l15
                  i32.const 12
                  i32.add
                  local.get $l16
                  i32.const 8
                  i32.add
                  i32.load
                  i32.store
                  local.get $l15
                  i32.const 16
                  i32.add
                  local.get $l16
                  i32.const 12
                  i32.add
                  i32.load
                  i32.store
                  local.get $l24
                  i32.const 16
                  i32.add
                  local.set $l24
                  local.get $l14
                  i32.const 16
                  i32.add
                  local.set $l14
                  local.get $l23
                  local.get $l22
                  i32.const 4
                  i32.add
                  local.tee $l22
                  i32.ne
                  br_if $L29
                end
              end
              local.get $p8
              local.get $l22
              i32.const 2
              i32.shl
              local.tee $l16
              i32.add
              local.set $l15
              local.get $l35
              local.get $l16
              i32.add
              local.set $l16
              local.get $l26
              i32.const 1
              i32.and
              i32.const 1
              i32.shl
              i32.const 1
              i32.or
              local.set $l14
              loop $L30
                local.get $l16
                local.get $l15
                i32.load
                i32.store
                local.get $l15
                i32.const 4
                i32.add
                local.set $l15
                local.get $l16
                i32.const 4
                i32.add
                local.set $l16
                local.get $l14
                i32.const -1
                i32.add
                local.tee $l14
                br_if $L30
              end
              local.get $l21
              i32.eqz
              br_if $B18
              local.get $l13
              i32.const -1
              i32.add
              local.set $l30
              local.get $l21
              local.set $l15
              loop $L31
                local.get $l29
                local.get $l15
                i32.const -1
                i32.add
                local.tee $l37
                local.get $l28
                i32.mul
                i32.const 2
                i32.shl
                i32.add
                local.set $l22
                i32.const 1
                local.set $p8
                i32.const 1
                local.set $l14
                block $B32
                  local.get $l17
                  local.get $l20
                  i32.sub
                  local.tee $l16
                  i32.const 0
                  local.get $l15
                  i32.sub
                  i32.eq
                  br_if $B32
                  block $B33
                    local.get $l16
                    local.get $l15
                    i32.ne
                    br_if $B33
                    i32.const -1
                    local.set $l14
                    i32.const 0
                    local.set $p8
                    br $B32
                  end
                  i32.const 1
                  i32.const -1
                  local.get $l22
                  local.get $l26
                  i32.const 2
                  i32.shl
                  i32.add
                  local.get $l16
                  i32.const 2
                  i32.shl
                  i32.add
                  local.tee $l15
                  i32.const -4
                  i32.add
                  i32.load
                  local.get $l15
                  i32.const 4
                  i32.add
                  i32.load
                  i32.lt_u
                  local.tee $p8
                  select
                  local.set $l14
                end
                block $B34
                  local.get $l17
                  local.get $l22
                  local.get $l26
                  i32.const 2
                  i32.shl
                  i32.add
                  local.get $l14
                  local.get $l16
                  i32.add
                  local.tee $l15
                  i32.const 2
                  i32.shl
                  i32.add
                  i32.load
                  local.tee $l12
                  i32.le_s
                  br_if $B34
                  local.get $l20
                  local.get $l12
                  local.get $l15
                  i32.sub
                  local.tee $p3
                  i32.le_s
                  br_if $B34
                  local.get $l30
                  local.get $l17
                  i32.add
                  local.set $p1
                  local.get $l17
                  i32.const -1
                  i32.add
                  local.set $l24
                  local.get $l30
                  local.get $l20
                  i32.add
                  local.set $p2
                  local.get $l20
                  i32.const -1
                  i32.add
                  local.set $l18
                  local.get $p6
                  local.get $l19
                  i32.const 2
                  i32.shl
                  local.tee $l15
                  i32.add
                  local.set $l16
                  local.get $p5
                  local.get $l15
                  i32.add
                  local.set $l14
                  local.get $p4
                  local.get $l15
                  i32.add
                  local.set $l22
                  local.get $l19
                  local.get $l19
                  local.get $p7
                  local.get $l19
                  local.get $p7
                  i32.gt_u
                  select
                  local.tee $l31
                  i32.sub
                  local.set $l25
                  i32.const 0
                  local.set $l23
                  block $B35
                    loop $L36
                      block $B37
                        local.get $l25
                        local.get $l23
                        local.tee $l15
                        i32.ne
                        br_if $B37
                        local.get $l31
                        local.set $l19
                        br $B35
                      end
                      local.get $l22
                      i32.const 0
                      i32.store
                      local.get $l14
                      local.get $p1
                      local.get $l15
                      i32.add
                      i32.store
                      local.get $l16
                      local.get $p2
                      local.get $l15
                      i32.add
                      i32.store
                      local.get $l19
                      i32.const 1
                      i32.add
                      local.set $l19
                      local.get $l24
                      local.get $l15
                      i32.add
                      local.get $l12
                      i32.le_s
                      br_if $B35
                      local.get $l15
                      i32.const -1
                      i32.add
                      local.set $l23
                      local.get $l16
                      i32.const 4
                      i32.add
                      local.set $l16
                      local.get $l14
                      i32.const 4
                      i32.add
                      local.set $l14
                      local.get $l22
                      i32.const 4
                      i32.add
                      local.set $l22
                      local.get $l18
                      local.get $l15
                      i32.add
                      local.get $p3
                      i32.gt_s
                      br_if $L36
                    end
                  end
                  local.get $l17
                  local.get $l15
                  i32.add
                  i32.const -1
                  i32.add
                  local.set $l17
                  local.get $l20
                  local.get $l15
                  i32.add
                  i32.const -1
                  i32.add
                  local.set $l20
                end
                block $B38
                  block $B39
                    block $B40
                      local.get $p8
                      i32.eqz
                      br_if $B40
                      local.get $l19
                      local.get $p7
                      i32.ge_u
                      br_if $B38
                      local.get $l20
                      i32.const -1
                      i32.add
                      local.set $l20
                      i32.const 2
                      local.set $l16
                      br $B39
                    end
                    local.get $l19
                    local.get $p7
                    i32.ge_u
                    br_if $B38
                    local.get $l17
                    i32.const -1
                    i32.add
                    local.set $l17
                    i32.const 1
                    local.set $l16
                  end
                  local.get $p4
                  local.get $l19
                  i32.const 2
                  i32.shl
                  local.tee $l15
                  i32.add
                  local.get $l16
                  i32.store
                  local.get $p5
                  local.get $l15
                  i32.add
                  local.get $l17
                  local.get $l13
                  i32.add
                  i32.store
                  local.get $p6
                  local.get $l15
                  i32.add
                  local.get $l20
                  local.get $l13
                  i32.add
                  i32.store
                  local.get $l19
                  i32.const 1
                  i32.add
                  local.set $l19
                  local.get $l37
                  local.set $l15
                  local.get $l37
                  br_if $L31
                end
              end
              local.get $l21
              local.set $l20
              local.get $l19
              local.set $l14
              br $B7
            end
            local.get $p2
            i32.const -2
            i32.add
            local.set $p2
            local.get $l23
            i32.const -2
            i32.add
            local.set $l23
            local.get $p1
            i32.const 2
            i32.add
            local.tee $p1
            local.get $l37
            i32.le_u
            br_if $L19
          end
          i32.const 0
          local.set $l15
          block $B41
            local.get $l27
            i32.const 3
            i32.lt_u
            br_if $B41
            i32.const 0
            local.set $l14
            local.get $p8
            local.set $l15
            loop $L42
              local.get $l15
              local.get $l24
              i32.add
              local.tee $l16
              i32.const 4
              i32.add
              local.get $l15
              i32.load
              i32.store
              local.get $l16
              i32.const 8
              i32.add
              local.get $l15
              i32.const 4
              i32.add
              i32.load
              i32.store
              local.get $l16
              i32.const 12
              i32.add
              local.get $l15
              i32.const 8
              i32.add
              i32.load
              i32.store
              local.get $l16
              i32.const 16
              i32.add
              local.get $l15
              i32.const 12
              i32.add
              i32.load
              i32.store
              local.get $l15
              i32.const 16
              i32.add
              local.set $l15
              local.get $l33
              local.get $l14
              i32.const -4
              i32.add
              local.tee $l14
              i32.ne
              br_if $L42
            end
            i32.const 0
            local.get $l14
            i32.sub
            local.set $l15
          end
          local.get $p8
          local.get $l15
          i32.const 2
          i32.shl
          i32.add
          local.set $l15
          local.get $l32
          local.set $l16
          loop $L43
            local.get $l15
            local.get $l24
            i32.add
            i32.const 4
            i32.add
            local.get $l15
            i32.load
            i32.store
            local.get $l15
            i32.const 4
            i32.add
            local.set $l15
            local.get $l16
            i32.const -1
            i32.add
            local.tee $l16
            br_if $L43
          end
          local.get $l36
          i32.const 1
          i32.add
          local.set $l36
          local.get $l24
          local.get $l34
          i32.add
          local.set $l24
          local.get $l35
          local.get $l34
          i32.add
          local.set $l35
          local.get $l21
          i32.const 1
          i32.add
          local.tee $l21
          local.get $l26
          i32.le_u
          br_if $L17
        end
      end
      i32.const 0
      local.set $l20
      local.get $l19
      local.set $l14
    end
    block $B44
      local.get $l13
      i32.eqz
      br_if $B44
      local.get $l14
      local.get $p7
      i32.ge_u
      br_if $B44
      local.get $l13
      i32.const -1
      i32.add
      local.set $l15
      local.get $p4
      local.get $l14
      i32.const 2
      i32.shl
      local.tee $l22
      i32.add
      local.set $l16
      local.get $p5
      local.get $l22
      i32.add
      local.set $l17
      local.get $p6
      local.get $l22
      i32.add
      local.set $l22
      loop $L45
        local.get $l16
        i32.const 0
        i32.store
        local.get $l17
        local.get $l15
        i32.store
        local.get $l22
        local.get $l15
        i32.store
        local.get $l14
        i32.const 1
        i32.add
        local.set $l14
        local.get $l15
        i32.eqz
        br_if $B44
        local.get $l16
        i32.const 4
        i32.add
        local.set $l16
        local.get $l17
        i32.const 4
        i32.add
        local.set $l17
        local.get $l22
        i32.const 4
        i32.add
        local.set $l22
        local.get $l15
        i32.const -1
        i32.add
        local.set $l15
        local.get $l14
        local.get $p7
        i32.lt_u
        br_if $L45
      end
    end
    block $B46
      local.get $l14
      i32.const 1
      i32.shr_u
      local.tee $l17
      i32.eqz
      br_if $B46
      local.get $l14
      i32.const 2
      i32.shl
      i32.const -4
      i32.add
      local.set $l15
      i32.const 0
      local.set $l16
      loop $L47
        local.get $p6
        local.get $l16
        i32.add
        local.tee $l22
        i32.load
        local.set $l23
        local.get $p5
        local.get $l16
        i32.add
        local.tee $l12
        i32.load
        local.set $l25
        local.get $p4
        local.get $l16
        i32.add
        local.tee $l19
        i32.load
        local.set $p3
        local.get $l19
        local.get $p4
        local.get $l15
        i32.add
        local.tee $p1
        i32.load
        i32.store
        local.get $l12
        local.get $p5
        local.get $l15
        i32.add
        local.tee $l19
        i32.load
        i32.store
        local.get $l22
        local.get $p6
        local.get $l15
        i32.add
        local.tee $l12
        i32.load
        i32.store
        local.get $p1
        local.get $p3
        i32.store
        local.get $l19
        local.get $l25
        i32.store
        local.get $l12
        local.get $l23
        i32.store
        local.get $l15
        i32.const -4
        i32.add
        local.set $l15
        local.get $l16
        i32.const 4
        i32.add
        local.set $l16
        local.get $l17
        i32.const -1
        i32.add
        local.tee $l17
        br_if $L47
      end
    end
    local.get $p10
    local.get $l20
    i32.store
    local.get $p11
    local.get $p0
    i32.store
    local.get $l14)
  (memory $memory 256)
  (global $__stack_pointer (mut i32) (i32.const 65536))
  (global $__dso_handle i32 (i32.const 65536))
  (global $__data_end i32 (i32.const 65536))
  (global $__stack_low i32 (i32.const 0))
  (global $__stack_high i32 (i32.const 65536))
  (global $__global_base i32 (i32.const 65536))
  (global $__heap_base i32 (i32.const 65536))
  (global $__heap_end i32 (i32.const 16777216))
  (global $__memory_base i32 (i32.const 0))
  (global $__table_base i32 (i32.const 1))
  (global $__wasm_first_page_end i32 (i32.const 65536))
  (export "memory" (memory $memory))
  (export "__wasm_call_ctors" (func $__wasm_call_ctors))
  (export "__stack_pointer" (global $__stack_pointer))
  (export "myers_diff" (func $myers_diff))
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
