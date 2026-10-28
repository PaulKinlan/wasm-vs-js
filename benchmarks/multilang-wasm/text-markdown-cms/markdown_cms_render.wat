;; text.markdown-cms.v1 — kernel: markdown_cms_render
;; WebAssembly Text (WAT) baseline implementation
;; Exports: markdown_cms_render

(module $markdown_cms_kernel_c.wasm
  (type $t0 (func))
  (type $t1 (func (param i32) (result i32)))
  (type $t2 (func (param i32 i32)))
  (func $__wasm_call_ctors (type $t0))
  (func $markdown_cms_render (type $t1) (param $p0 i32) (result i32)
    (local $l1 i32) (local $l2 i32) (local $l3 i32) (local $l4 i32) (local $l5 i32) (local $l6 i32) (local $l7 i32) (local $l8 i32) (local $l9 i32) (local $l10 i32) (local $l11 i32) (local $l12 i32) (local $l13 i32) (local $l14 i32) (local $l15 i32) (local $l16 i32) (local $l17 i32) (local $l18 i32) (local $l19 i32) (local $l20 i32) (local $l21 i32) (local $l22 i32) (local $l23 i32) (local $l24 i32) (local $l25 i32) (local $l26 i32) (local $l27 i32)
    i32.const 0
    i32.const 0
    i32.store offset=65580
    block $B0
      local.get $p0
      i32.const 8
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
      i32.const 826688333
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
      i32.const 0
      i32.load8_u offset=3145732
      i32.or
      i32.const 0
      i32.load8_u offset=3145734
      i32.const 16
      i32.shl
      i32.or
      i32.const 0
      i32.load8_u offset=3145735
      i32.const 24
      i32.shl
      i32.or
      i32.const 500
      i32.eq
      br_if $B2
      i32.const -3
      return
    end
    i32.const 8
    local.set $l1
    i32.const 0
    local.set $l2
    i32.const 0
    local.set $l3
    i32.const 0
    local.set $l4
    i32.const 0
    local.set $l5
    i32.const 0
    local.set $l6
    i32.const 0
    local.set $l7
    i32.const 0
    local.set $l8
    block $B3
      loop $L4
        block $B5
          local.get $l1
          i32.const 4
          i32.add
          local.tee $l9
          local.get $p0
          i32.le_u
          br_if $B5
          i32.const -4
          return
        end
        block $B6
          local.get $l1
          i32.const 3145728
          i32.add
          local.tee $l10
          i32.load align=1
          local.tee $l11
          local.get $l9
          i32.add
          local.tee $l1
          local.get $p0
          i32.le_u
          br_if $B6
          i32.const -5
          return
        end
        i32.const -6
        local.set $l12
        local.get $l11
        i32.const 40960
        i32.gt_u
        br_if $B3
        local.get $l9
        i32.const 3145728
        i32.add
        local.set $l13
        i32.const 0
        local.set $l14
        i32.const -3
        local.set $l15
        i32.const 0
        local.set $l16
        i32.const 0
        local.set $l17
        i32.const 0
        local.set $l18
        loop $L7
          block $B8
            block $B9
              local.get $l18
              local.tee $l19
              local.get $l11
              i32.eq
              br_if $B9
              local.get $l13
              local.get $l19
              i32.add
              i32.load8_u
              i32.const 10
              i32.ne
              br_if $B8
            end
            block $B10
              local.get $l19
              local.get $l17
              i32.ne
              br_if $B10
              local.get $l17
              i32.const 1
              i32.add
              local.set $l17
              br $B8
            end
            local.get $l16
            i32.const 1
            i32.add
            local.tee $l16
            i32.const 4096
            i32.gt_u
            br_if $B3
            local.get $l13
            local.get $l17
            i32.add
            local.set $l18
            i32.const 0
            local.set $l20
            i32.const 0
            local.set $l21
            block $B11
              local.get $l17
              i32.const 1
              i32.add
              local.get $l19
              i32.ge_u
              br_if $B11
              local.get $l18
              i32.const 1
              i32.add
              i32.load8_u
              local.set $l21
            end
            block $B12
              local.get $l17
              i32.const 2
              i32.add
              local.tee $l22
              local.get $l19
              i32.ge_u
              br_if $B12
              local.get $l18
              i32.const 2
              i32.add
              i32.load8_u
              i32.const 32
              i32.eq
              local.set $l20
            end
            local.get $l18
            i32.load8_u
            local.set $l23
            block $B13
              block $B14
                local.get $l19
                local.get $l17
                i32.sub
                local.tee $l24
                i32.const 3
                i32.lt_u
                br_if $B14
                local.get $l23
                i32.const 35
                i32.ne
                br_if $B14
                local.get $l21
                i32.const 32
                i32.ne
                br_if $B14
                local.get $l24
                i32.const -2
                i32.add
                local.set $l24
                i32.const 0
                local.set $l20
                i32.const 1
                local.set $l25
                local.get $l22
                local.set $l17
                i32.const 0
                local.set $l21
                br $B13
              end
              block $B15
                local.get $l23
                i32.const 255
                i32.and
                local.tee $l18
                i32.const 35
                i32.eq
                local.get $l21
                i32.const 35
                i32.eq
                i32.and
                local.get $l24
                i32.const 3
                i32.gt_u
                i32.and
                local.get $l20
                i32.and
                i32.const 1
                i32.ne
                br_if $B15
                local.get $l24
                i32.const -3
                i32.add
                local.set $l24
                local.get $l17
                i32.const 3
                i32.add
                local.set $l17
                i32.const 0
                local.set $l20
                i32.const 2
                local.set $l25
                i32.const 0
                local.set $l21
                br $B13
              end
              i32.const 0
              local.set $l20
              block $B16
                local.get $l23
                i32.const 60
                i32.ne
                br_if $B16
                i32.const 6
                local.set $l25
                i32.const 0
                local.set $l21
                br $B13
              end
              block $B17
                local.get $l23
                i32.const 91
                i32.eq
                br_if $B17
                i32.const 3
                local.set $l25
                block $B18
                  local.get $l24
                  i32.const 5
                  i32.ge_u
                  br_if $B18
                  i32.const 0
                  local.set $l21
                  br $B13
                end
                block $B19
                  local.get $l23
                  i32.const 33
                  i32.eq
                  br_if $B19
                  i32.const 0
                  local.set $l21
                  br $B13
                end
                local.get $l21
                i32.const 91
                i32.eq
                br_if $B17
                i32.const 0
                local.set $l21
                br $B13
              end
              i32.const 3
              local.set $l25
              block $B20
                local.get $l17
                local.get $l18
                i32.const 33
                i32.eq
                i32.add
                local.tee $l22
                i32.const 2
                i32.add
                local.get $l19
                i32.lt_u
                br_if $B20
                i32.const 0
                local.set $l21
                br $B13
              end
              local.get $l22
              i32.const 1
              i32.add
              local.set $l26
              local.get $l10
              local.get $l22
              i32.add
              local.set $l21
              i32.const 0
              local.set $l18
              block $B21
                loop $L22
                  block $B23
                    local.get $l21
                    local.get $l18
                    i32.add
                    local.tee $l20
                    i32.const 4
                    i32.add
                    i32.load8_u
                    i32.const 93
                    i32.ne
                    br_if $B23
                    local.get $l20
                    i32.const 5
                    i32.add
                    i32.load8_u
                    i32.const 40
                    i32.eq
                    br_if $B21
                  end
                  local.get $l22
                  local.get $l18
                  i32.const 1
                  i32.add
                  local.tee $l18
                  i32.add
                  i32.const 2
                  i32.add
                  local.get $l19
                  i32.lt_u
                  br_if $L22
                end
                i32.const 0
                local.set $l20
                i32.const 0
                local.set $l21
                br $B13
              end
              i32.const 0
              local.set $l20
              block $B24
                local.get $l22
                local.get $l18
                i32.add
                local.tee $l27
                br_if $B24
                i32.const 0
                local.set $l21
                br $B13
              end
              i32.const 0
              local.set $l21
              local.get $l13
              local.get $l19
              i32.add
              i32.const -1
              i32.add
              i32.load8_u
              i32.const 41
              i32.ne
              br_if $B13
              i32.const 5
              i32.const 4
              local.get $l23
              i32.const 33
              i32.eq
              select
              local.set $l25
              local.get $l18
              i32.const -1
              i32.add
              local.set $l24
              local.get $l15
              local.get $l22
              i32.sub
              local.get $l18
              i32.sub
              local.set $l21
              local.get $l27
              i32.const 2
              i32.add
              local.set $l20
              local.get $l26
              local.set $l17
            end
            local.get $l14
            i32.const 24
            i32.mul
            local.tee $l18
            local.get $l17
            local.get $l9
            i32.add
            i32.store offset=27262980
            local.get $l18
            local.get $l25
            i32.store offset=27262976
            local.get $l18
            i32.const 27262996
            i32.add
            i32.const 0
            i32.store
            local.get $l18
            i32.const 27262992
            i32.add
            local.get $l21
            i32.store
            local.get $l18
            i32.const 27262988
            i32.add
            local.get $l20
            local.get $l9
            i32.add
            i32.const 0
            local.get $l20
            select
            i32.store
            local.get $l18
            i32.const 27262984
            i32.add
            local.get $l24
            i32.store
            local.get $l19
            i32.const 1
            i32.add
            local.set $l17
            local.get $l14
            i32.const 1
            i32.add
            local.set $l14
          end
          local.get $l15
          i32.const 1
          i32.add
          local.set $l15
          local.get $l19
          i32.const 1
          i32.add
          local.set $l18
          local.get $l19
          local.get $l11
          i32.ne
          br_if $L7
        end
        local.get $l14
        i32.const 0
        i32.lt_s
        br_if $B3
        i32.const 0
        local.set $l21
        block $B25
          block $B26
            local.get $l14
            br_if $B26
            i32.const 0
            local.set $l16
            i32.const 0
            local.set $l25
            i32.const 0
            local.set $l19
            br $B25
          end
          i32.const 0
          local.set $l13
          i32.const 0
          local.set $l22
          i32.const 0
          local.set $l10
          i32.const 0
          local.set $l16
          i32.const 0
          local.set $l19
          i32.const 0
          local.set $l25
          loop $L27
            block $B28
              block $B29
                local.get $l19
                i32.const 24
                i32.mul
                local.tee $l17
                i32.load offset=27262976
                local.tee $l15
                i32.const -1
                i32.add
                i32.const 1
                i32.gt_u
                br_if $B29
                local.get $l17
                i32.const 27262996
                i32.add
                i32.const 1
                i32.store
                local.get $l21
                i32.const 1
                i32.add
                local.set $l21
                local.get $l13
                i32.const 1
                i32.add
                local.set $l13
                br $B28
              end
              block $B30
                local.get $l15
                i32.const -2
                i32.and
                i32.const 4
                i32.ne
                br_if $B30
                local.get $l16
                i32.const 1
                i32.add
                local.set $l16
                local.get $l21
                i32.const 1
                i32.add
                local.set $l21
                local.get $l22
                local.get $l15
                i32.const 4
                i32.eq
                i32.add
                local.set $l22
                local.get $l10
                local.get $l15
                i32.const 4
                i32.ne
                i32.add
                local.set $l10
                block $B31
                  local.get $l17
                  i32.const 27262992
                  i32.add
                  i32.load
                  local.tee $l9
                  i32.eqz
                  br_if $B31
                  local.get $l17
                  i32.const 27262988
                  i32.add
                  i32.load
                  i32.const 3145728
                  i32.add
                  local.set $l23
                  i32.const 0
                  local.set $l18
                  loop $L32
                    local.get $l23
                    local.get $l18
                    i32.add
                    i32.load8_u
                    local.tee $l24
                    i32.const -33
                    i32.add
                    i32.const 255
                    i32.and
                    i32.const 93
                    i32.gt_u
                    br_if $B31
                    block $B33
                      local.get $l24
                      i32.const 255
                      i32.and
                      local.tee $l24
                      i32.const -34
                      i32.add
                      local.tee $l20
                      i32.const 28
                      i32.gt_u
                      br_if $B33
                      i32.const 1
                      local.get $l20
                      i32.shl
                      i32.const 335544353
                      i32.and
                      br_if $B31
                    end
                    local.get $l24
                    i32.const 92
                    i32.eq
                    br_if $B31
                    local.get $l9
                    local.get $l18
                    i32.const 1
                    i32.add
                    local.tee $l18
                    i32.ne
                    br_if $L32
                  end
                  block $B34
                    local.get $l15
                    i32.const 5
                    i32.ne
                    br_if $B34
                    local.get $l9
                    i32.const 28
                    i32.lt_u
                    br_if $B31
                    local.get $l23
                    i32.load8_u
                    i32.const 104
                    i32.ne
                    br_if $B31
                    local.get $l23
                    i32.const 1
                    i32.add
                    i32.load8_u
                    i32.const 116
                    i32.ne
                    br_if $B31
                    local.get $l23
                    i32.const 2
                    i32.add
                    i32.load8_u
                    i32.const 116
                    i32.ne
                    br_if $B31
                    local.get $l23
                    i32.const 3
                    i32.add
                    i32.load8_u
                    i32.const 112
                    i32.ne
                    br_if $B31
                    local.get $l23
                    i32.const 4
                    i32.add
                    i32.load8_u
                    i32.const 115
                    i32.ne
                    br_if $B31
                    local.get $l23
                    i32.const 5
                    i32.add
                    i32.load8_u
                    i32.const 58
                    i32.ne
                    br_if $B31
                    local.get $l23
                    i32.const 6
                    i32.add
                    i32.load8_u
                    i32.const 47
                    i32.ne
                    br_if $B31
                    local.get $l23
                    i32.const 7
                    i32.add
                    i32.load8_u
                    i32.const 47
                    i32.ne
                    br_if $B31
                    local.get $l23
                    i32.const 8
                    i32.add
                    i32.load8_u
                    i32.const 105
                    i32.ne
                    br_if $B31
                    local.get $l23
                    i32.const 9
                    i32.add
                    i32.load8_u
                    i32.const 109
                    i32.ne
                    br_if $B31
                    local.get $l23
                    i32.const 10
                    i32.add
                    i32.load8_u
                    i32.const 97
                    i32.ne
                    br_if $B31
                    local.get $l23
                    i32.const 11
                    i32.add
                    i32.load8_u
                    i32.const 103
                    i32.ne
                    br_if $B31
                    local.get $l23
                    i32.const 12
                    i32.add
                    i32.load8_u
                    i32.const 101
                    i32.ne
                    br_if $B31
                    local.get $l23
                    i32.const 13
                    i32.add
                    i32.load8_u
                    i32.const 115
                    i32.ne
                    br_if $B31
                    local.get $l23
                    i32.const 14
                    i32.add
                    i32.load8_u
                    i32.const 46
                    i32.ne
                    br_if $B31
                    local.get $l23
                    i32.const 15
                    i32.add
                    i32.load8_u
                    i32.const 101
                    i32.ne
                    br_if $B31
                    local.get $l23
                    i32.const 16
                    i32.add
                    i32.load8_u
                    i32.const 120
                    i32.ne
                    br_if $B31
                    local.get $l23
                    i32.const 17
                    i32.add
                    i32.load8_u
                    i32.const 97
                    i32.ne
                    br_if $B31
                    local.get $l23
                    i32.const 18
                    i32.add
                    i32.load8_u
                    i32.const 109
                    i32.ne
                    br_if $B31
                    local.get $l23
                    i32.const 19
                    i32.add
                    i32.load8_u
                    i32.const 112
                    i32.ne
                    br_if $B31
                    local.get $l23
                    i32.const 20
                    i32.add
                    i32.load8_u
                    i32.const 108
                    i32.ne
                    br_if $B31
                    local.get $l23
                    i32.const 21
                    i32.add
                    i32.load8_u
                    i32.const 101
                    i32.ne
                    br_if $B31
                    local.get $l23
                    i32.const 22
                    i32.add
                    i32.load8_u
                    i32.const 46
                    i32.ne
                    br_if $B31
                    local.get $l23
                    i32.const 23
                    i32.add
                    i32.load8_u
                    i32.const 116
                    i32.ne
                    br_if $B31
                    local.get $l23
                    i32.const 24
                    i32.add
                    i32.load8_u
                    i32.const 101
                    i32.ne
                    br_if $B31
                    local.get $l23
                    i32.const 25
                    i32.add
                    i32.load8_u
                    i32.const 115
                    i32.ne
                    br_if $B31
                    local.get $l23
                    i32.const 26
                    i32.add
                    i32.load8_u
                    i32.const 116
                    i32.ne
                    br_if $B31
                    local.get $l17
                    i32.const 27262996
                    i32.add
                    local.get $l23
                    i32.const 27
                    i32.add
                    i32.load8_u
                    i32.const 255
                    i32.and
                    local.tee $l17
                    i32.const 47
                    i32.eq
                    i32.store
                    local.get $l17
                    i32.const 47
                    i32.eq
                    br_if $B28
                    local.get $l25
                    i32.const 1
                    i32.add
                    local.set $l25
                    br $B28
                  end
                  local.get $l9
                  i32.const 21
                  i32.lt_u
                  br_if $B31
                  local.get $l23
                  i32.load8_u
                  i32.const 104
                  i32.ne
                  br_if $B31
                  local.get $l23
                  i32.const 1
                  i32.add
                  i32.load8_u
                  i32.const 116
                  i32.ne
                  br_if $B31
                  local.get $l23
                  i32.const 2
                  i32.add
                  i32.load8_u
                  i32.const 116
                  i32.ne
                  br_if $B31
                  local.get $l23
                  i32.const 3
                  i32.add
                  i32.load8_u
                  i32.const 112
                  i32.ne
                  br_if $B31
                  local.get $l23
                  i32.const 4
                  i32.add
                  i32.load8_u
                  i32.const 115
                  i32.ne
                  br_if $B31
                  block $B35
                    local.get $l23
                    i32.const 5
                    i32.add
                    local.tee $l18
                    i32.load8_u
                    i32.const 58
                    i32.ne
                    br_if $B35
                    local.get $l23
                    i32.const 6
                    i32.add
                    i32.load8_u
                    i32.const 47
                    i32.ne
                    br_if $B35
                    local.get $l23
                    i32.const 7
                    i32.add
                    i32.load8_u
                    i32.const 47
                    i32.ne
                    br_if $B35
                    local.get $l23
                    i32.const 8
                    i32.add
                    i32.load8_u
                    i32.const 101
                    i32.ne
                    br_if $B35
                    local.get $l23
                    i32.const 9
                    i32.add
                    i32.load8_u
                    i32.const 120
                    i32.ne
                    br_if $B35
                    local.get $l23
                    i32.const 10
                    i32.add
                    i32.load8_u
                    i32.const 97
                    i32.ne
                    br_if $B35
                    local.get $l23
                    i32.const 11
                    i32.add
                    i32.load8_u
                    i32.const 109
                    i32.ne
                    br_if $B35
                    local.get $l23
                    i32.const 12
                    i32.add
                    i32.load8_u
                    i32.const 112
                    i32.ne
                    br_if $B35
                    local.get $l23
                    i32.const 13
                    i32.add
                    i32.load8_u
                    i32.const 108
                    i32.ne
                    br_if $B35
                    local.get $l23
                    i32.const 14
                    i32.add
                    i32.load8_u
                    i32.const 101
                    i32.ne
                    br_if $B35
                    local.get $l23
                    i32.const 15
                    i32.add
                    i32.load8_u
                    i32.const 46
                    i32.ne
                    br_if $B35
                    local.get $l23
                    i32.const 16
                    i32.add
                    i32.load8_u
                    i32.const 116
                    i32.ne
                    br_if $B35
                    local.get $l23
                    i32.const 17
                    i32.add
                    i32.load8_u
                    i32.const 101
                    i32.ne
                    br_if $B35
                    local.get $l23
                    i32.const 18
                    i32.add
                    i32.load8_u
                    i32.const 115
                    i32.ne
                    br_if $B35
                    local.get $l23
                    i32.const 19
                    i32.add
                    i32.load8_u
                    i32.const 116
                    i32.ne
                    br_if $B35
                    local.get $l23
                    i32.const 20
                    i32.add
                    i32.load8_u
                    i32.const 47
                    i32.ne
                    br_if $B35
                    local.get $l17
                    i32.const 27262996
                    i32.add
                    i32.const 1
                    i32.store
                    br $B28
                  end
                  local.get $l9
                  i32.const 26
                  i32.lt_u
                  br_if $B31
                  local.get $l18
                  i32.load8_u
                  i32.const 58
                  i32.ne
                  br_if $B31
                  local.get $l23
                  i32.const 6
                  i32.add
                  i32.load8_u
                  i32.const 47
                  i32.ne
                  br_if $B31
                  local.get $l23
                  i32.const 7
                  i32.add
                  i32.load8_u
                  i32.const 47
                  i32.ne
                  br_if $B31
                  local.get $l23
                  i32.const 8
                  i32.add
                  i32.load8_u
                  i32.const 100
                  i32.ne
                  br_if $B31
                  local.get $l23
                  i32.const 9
                  i32.add
                  i32.load8_u
                  i32.const 111
                  i32.ne
                  br_if $B31
                  local.get $l23
                  i32.const 10
                  i32.add
                  i32.load8_u
                  i32.const 99
                  i32.ne
                  br_if $B31
                  local.get $l23
                  i32.const 11
                  i32.add
                  i32.load8_u
                  i32.const 115
                  i32.ne
                  br_if $B31
                  local.get $l23
                  i32.const 12
                  i32.add
                  i32.load8_u
                  i32.const 46
                  i32.ne
                  br_if $B31
                  local.get $l23
                  i32.const 13
                  i32.add
                  i32.load8_u
                  i32.const 101
                  i32.ne
                  br_if $B31
                  local.get $l23
                  i32.const 14
                  i32.add
                  i32.load8_u
                  i32.const 120
                  i32.ne
                  br_if $B31
                  local.get $l23
                  i32.const 15
                  i32.add
                  i32.load8_u
                  i32.const 97
                  i32.ne
                  br_if $B31
                  local.get $l23
                  i32.const 16
                  i32.add
                  i32.load8_u
                  i32.const 109
                  i32.ne
                  br_if $B31
                  local.get $l23
                  i32.const 17
                  i32.add
                  i32.load8_u
                  i32.const 112
                  i32.ne
                  br_if $B31
                  local.get $l23
                  i32.const 18
                  i32.add
                  i32.load8_u
                  i32.const 108
                  i32.ne
                  br_if $B31
                  local.get $l23
                  i32.const 19
                  i32.add
                  i32.load8_u
                  i32.const 101
                  i32.ne
                  br_if $B31
                  local.get $l23
                  i32.const 20
                  i32.add
                  i32.load8_u
                  i32.const 46
                  i32.ne
                  br_if $B31
                  local.get $l23
                  i32.const 21
                  i32.add
                  i32.load8_u
                  i32.const 116
                  i32.ne
                  br_if $B31
                  local.get $l23
                  i32.const 22
                  i32.add
                  i32.load8_u
                  i32.const 101
                  i32.ne
                  br_if $B31
                  local.get $l23
                  i32.const 23
                  i32.add
                  i32.load8_u
                  i32.const 115
                  i32.ne
                  br_if $B31
                  local.get $l23
                  i32.const 24
                  i32.add
                  i32.load8_u
                  i32.const 116
                  i32.ne
                  br_if $B31
                  local.get $l17
                  i32.const 27262996
                  i32.add
                  local.get $l23
                  i32.const 25
                  i32.add
                  i32.load8_u
                  i32.const 255
                  i32.and
                  i32.const 47
                  i32.eq
                  local.tee $l17
                  i32.store
                  local.get $l17
                  br_if $B28
                  local.get $l25
                  i32.const 1
                  i32.add
                  local.set $l25
                  br $B28
                end
                local.get $l17
                i32.const 27262996
                i32.add
                i32.const 0
                i32.store
                local.get $l25
                i32.const 1
                i32.add
                local.set $l25
                br $B28
              end
              block $B36
                local.get $l15
                i32.const 6
                i32.ne
                br_if $B36
                i32.const 0
                local.set $l18
                block $B37
                  local.get $l17
                  i32.const 27262984
                  i32.add
                  i32.load
                  local.tee $l15
                  i32.const 9
                  i32.lt_u
                  br_if $B37
                  local.get $l17
                  i32.const 27262980
                  i32.add
                  i32.load
                  local.tee $l24
                  i32.const 3145728
                  i32.add
                  i32.load8_u
                  i32.const 60
                  i32.ne
                  br_if $B37
                  block $B38
                    local.get $l24
                    i32.const 3145729
                    i32.add
                    i32.load8_u
                    local.tee $l20
                    i32.const 101
                    i32.ne
                    br_if $B38
                    local.get $l24
                    i32.const 3145730
                    i32.add
                    i32.load8_u
                    i32.const 109
                    i32.ne
                    br_if $B37
                    local.get $l24
                    i32.const 3145731
                    i32.add
                    i32.load8_u
                    i32.const 62
                    i32.ne
                    br_if $B37
                    local.get $l15
                    local.get $l24
                    i32.add
                    local.tee $l20
                    i32.const 3145723
                    i32.add
                    i32.load8_u
                    i32.const 60
                    i32.ne
                    br_if $B37
                    local.get $l20
                    i32.const 3145728
                    i32.add
                    local.tee $l20
                    i32.const -4
                    i32.add
                    i32.load8_u
                    i32.const 47
                    i32.ne
                    br_if $B37
                    local.get $l20
                    i32.const -3
                    i32.add
                    i32.load8_u
                    i32.const 101
                    i32.ne
                    br_if $B37
                    local.get $l20
                    i32.const -2
                    i32.add
                    i32.load8_u
                    i32.const 109
                    i32.ne
                    br_if $B37
                    local.get $l20
                    i32.const -1
                    i32.add
                    i32.load8_u
                    i32.const 62
                    i32.ne
                    br_if $B37
                    block $B39
                      local.get $l15
                      i32.const -5
                      i32.add
                      i32.const 5
                      i32.ge_u
                      br_if $B39
                      i32.const 1
                      local.set $l18
                      br $B37
                    end
                    local.get $l24
                    i32.const 3145732
                    i32.add
                    local.set $l24
                    local.get $l15
                    i32.const -10
                    i32.add
                    local.set $l15
                    loop $L40
                      local.get $l24
                      i32.load8_u
                      i32.const 253
                      i32.and
                      local.tee $l20
                      i32.const 60
                      i32.ne
                      local.set $l18
                      local.get $l20
                      i32.const 60
                      i32.eq
                      br_if $B37
                      local.get $l15
                      i32.const 0
                      i32.ne
                      local.set $l20
                      local.get $l24
                      i32.const 1
                      i32.add
                      local.set $l24
                      local.get $l15
                      i32.const -1
                      i32.add
                      local.set $l15
                      local.get $l20
                      br_if $L40
                      br $B37
                    end
                  end
                  local.get $l15
                  i32.const 17
                  i32.lt_u
                  br_if $B37
                  local.get $l20
                  i32.const 115
                  i32.ne
                  br_if $B37
                  local.get $l24
                  i32.const 3145730
                  i32.add
                  i32.load8_u
                  i32.const 116
                  i32.ne
                  br_if $B37
                  local.get $l24
                  i32.const 3145731
                  i32.add
                  i32.load8_u
                  i32.const 114
                  i32.ne
                  br_if $B37
                  local.get $l24
                  i32.const 3145732
                  i32.add
                  i32.load8_u
                  i32.const 111
                  i32.ne
                  br_if $B37
                  local.get $l24
                  i32.const 3145733
                  i32.add
                  i32.load8_u
                  i32.const 110
                  i32.ne
                  br_if $B37
                  local.get $l24
                  i32.const 3145734
                  i32.add
                  i32.load8_u
                  i32.const 103
                  i32.ne
                  br_if $B37
                  local.get $l24
                  i32.const 3145735
                  i32.add
                  i32.load8_u
                  i32.const 62
                  i32.ne
                  br_if $B37
                  local.get $l15
                  local.get $l24
                  i32.add
                  local.tee $l20
                  i32.const 3145719
                  i32.add
                  i32.load8_u
                  i32.const 60
                  i32.ne
                  br_if $B37
                  local.get $l20
                  i32.const 3145728
                  i32.add
                  local.tee $l20
                  i32.const -8
                  i32.add
                  i32.load8_u
                  i32.const 47
                  i32.ne
                  br_if $B37
                  local.get $l20
                  i32.const -7
                  i32.add
                  i32.load8_u
                  i32.const 115
                  i32.ne
                  br_if $B37
                  local.get $l20
                  i32.const -6
                  i32.add
                  i32.load8_u
                  i32.const 116
                  i32.ne
                  br_if $B37
                  local.get $l20
                  i32.const -5
                  i32.add
                  i32.load8_u
                  i32.const 114
                  i32.ne
                  br_if $B37
                  local.get $l20
                  i32.const -4
                  i32.add
                  i32.load8_u
                  i32.const 111
                  i32.ne
                  br_if $B37
                  local.get $l20
                  i32.const -3
                  i32.add
                  i32.load8_u
                  i32.const 110
                  i32.ne
                  br_if $B37
                  local.get $l20
                  i32.const -2
                  i32.add
                  i32.load8_u
                  i32.const 103
                  i32.ne
                  br_if $B37
                  local.get $l20
                  i32.const -1
                  i32.add
                  i32.load8_u
                  i32.const 62
                  i32.ne
                  br_if $B37
                  block $B41
                    local.get $l15
                    i32.const -9
                    i32.add
                    i32.const 9
                    i32.ge_u
                    br_if $B41
                    i32.const 1
                    local.set $l18
                    br $B37
                  end
                  local.get $l24
                  i32.const 3145736
                  i32.add
                  local.set $l24
                  local.get $l15
                  i32.const -18
                  i32.add
                  local.set $l15
                  loop $L42
                    local.get $l24
                    i32.load8_u
                    i32.const 253
                    i32.and
                    local.tee $l20
                    i32.const 60
                    i32.ne
                    local.set $l18
                    local.get $l20
                    i32.const 60
                    i32.eq
                    br_if $B37
                    local.get $l15
                    i32.const 0
                    i32.ne
                    local.set $l20
                    local.get $l24
                    i32.const 1
                    i32.add
                    local.set $l24
                    local.get $l15
                    i32.const -1
                    i32.add
                    local.set $l15
                    local.get $l20
                    br_if $L42
                  end
                end
                local.get $l16
                i32.const 1
                i32.add
                local.set $l16
                local.get $l17
                i32.const 27262996
                i32.add
                local.get $l18
                i32.store
                local.get $l25
                local.get $l18
                i32.const 1
                i32.xor
                i32.add
                local.set $l25
                br $B28
              end
              local.get $l17
              i32.const 27262996
              i32.add
              i32.const 1
              i32.store
            end
            local.get $l19
            i32.const 1
            i32.add
            local.tee $l19
            local.get $l14
            i32.ne
            br_if $L27
          end
          i32.const 0
          local.set $l17
          i32.const 0
          local.set $l12
          block $B43
            local.get $l13
            i32.eqz
            br_if $B43
            i32.const 0
            i32.load offset=65580
            local.set $l18
            i32.const -40
            local.set $l19
            loop $L44
              local.get $l18
              local.get $l19
              i32.const 65576
              i32.add
              i32.load8_u
              i32.store8 offset=15728640
              i32.const 0
              i32.const 0
              i32.load offset=65580
              local.tee $l18
              i32.const 1
              i32.add
              i32.store offset=65580
              local.get $l18
              i32.const 15728641
              i32.add
              local.get $l19
              i32.const 65577
              i32.add
              i32.load8_u
              i32.store8
              i32.const 0
              i32.const 0
              i32.load offset=65580
              i32.const 1
              i32.add
              local.tee $l18
              i32.store offset=65580
              local.get $l19
              i32.const 2
              i32.add
              local.tee $l19
              br_if $L44
            end
            i32.const 27262976
            local.set $l19
            local.get $l14
            local.set $l15
            loop $L45
              block $B46
                local.get $l19
                i32.load
                i32.const -1
                i32.add
                i32.const 1
                i32.gt_u
                br_if $B46
                local.get $l19
                i32.const 8
                i32.add
                i32.load
                local.set $l24
                local.get $l19
                i32.const 4
                i32.add
                i32.load
                local.set $l20
                local.get $l18
                i32.const 60
                i32.store8 offset=15728640
                i32.const 0
                i32.const 0
                i32.load offset=65580
                local.tee $l18
                i32.const 1
                i32.add
                i32.store offset=65580
                local.get $l18
                i32.const 15728641
                i32.add
                i32.const 108
                i32.store8
                i32.const 0
                i32.const 0
                i32.load offset=65580
                local.tee $l18
                i32.const 1
                i32.add
                i32.store offset=65580
                local.get $l18
                i32.const 15728641
                i32.add
                i32.const 105
                i32.store8
                i32.const 0
                i32.const 0
                i32.load offset=65580
                local.tee $l18
                i32.const 1
                i32.add
                i32.store offset=65580
                local.get $l18
                i32.const 15728641
                i32.add
                i32.const 62
                i32.store8
                i32.const 0
                i32.const 0
                i32.load offset=65580
                local.tee $l18
                i32.const 1
                i32.add
                i32.store offset=65580
                local.get $l18
                i32.const 15728641
                i32.add
                i32.const 60
                i32.store8
                i32.const 0
                i32.const 0
                i32.load offset=65580
                local.tee $l18
                i32.const 1
                i32.add
                i32.store offset=65580
                local.get $l18
                i32.const 15728641
                i32.add
                i32.const 97
                i32.store8
                i32.const 0
                i32.const 0
                i32.load offset=65580
                local.tee $l18
                i32.const 1
                i32.add
                i32.store offset=65580
                local.get $l18
                i32.const 15728641
                i32.add
                i32.const 32
                i32.store8
                i32.const 0
                i32.const 0
                i32.load offset=65580
                local.tee $l18
                i32.const 1
                i32.add
                i32.store offset=65580
                local.get $l18
                i32.const 15728641
                i32.add
                i32.const 104
                i32.store8
                i32.const 0
                i32.const 0
                i32.load offset=65580
                local.tee $l18
                i32.const 1
                i32.add
                i32.store offset=65580
                local.get $l18
                i32.const 15728641
                i32.add
                i32.const 114
                i32.store8
                i32.const 0
                i32.const 0
                i32.load offset=65580
                local.tee $l18
                i32.const 1
                i32.add
                i32.store offset=65580
                local.get $l18
                i32.const 15728641
                i32.add
                i32.const 101
                i32.store8
                i32.const 0
                i32.const 0
                i32.load offset=65580
                local.tee $l18
                i32.const 1
                i32.add
                i32.store offset=65580
                local.get $l18
                i32.const 15728641
                i32.add
                i32.const 102
                i32.store8
                i32.const 0
                i32.const 0
                i32.load offset=65580
                local.tee $l18
                i32.const 1
                i32.add
                i32.store offset=65580
                local.get $l18
                i32.const 15728641
                i32.add
                i32.const 61
                i32.store8
                i32.const 0
                i32.const 0
                i32.load offset=65580
                local.tee $l18
                i32.const 1
                i32.add
                i32.store offset=65580
                local.get $l18
                i32.const 15728641
                i32.add
                i32.const 34
                i32.store8
                i32.const 0
                i32.const 0
                i32.load offset=65580
                local.tee $l18
                i32.const 1
                i32.add
                i32.store offset=65580
                local.get $l18
                i32.const 15728641
                i32.add
                i32.const 35
                i32.store8
                i32.const 0
                i32.const 0
                i32.load offset=65580
                i32.const 1
                i32.add
                i32.store offset=65580
                local.get $l20
                local.get $l24
                call $write_slug
                i32.const 0
                i32.load offset=65580
                i32.const 34
                i32.store8 offset=15728640
                i32.const 0
                i32.const 0
                i32.load offset=65580
                local.tee $l18
                i32.const 1
                i32.add
                i32.store offset=65580
                local.get $l18
                i32.const 15728641
                i32.add
                i32.const 62
                i32.store8
                i32.const 0
                i32.const 0
                i32.load offset=65580
                i32.const 1
                i32.add
                i32.store offset=65580
                local.get $l20
                local.get $l24
                call $write_escaped
                i32.const 0
                i32.load offset=65580
                i32.const 60
                i32.store8 offset=15728640
                i32.const 0
                i32.const 0
                i32.load offset=65580
                local.tee $l18
                i32.const 1
                i32.add
                i32.store offset=65580
                local.get $l18
                i32.const 15728641
                i32.add
                i32.const 47
                i32.store8
                i32.const 0
                i32.const 0
                i32.load offset=65580
                local.tee $l18
                i32.const 1
                i32.add
                i32.store offset=65580
                local.get $l18
                i32.const 15728641
                i32.add
                i32.const 97
                i32.store8
                i32.const 0
                i32.const 0
                i32.load offset=65580
                local.tee $l18
                i32.const 1
                i32.add
                i32.store offset=65580
                local.get $l18
                i32.const 15728641
                i32.add
                i32.const 62
                i32.store8
                i32.const 0
                i32.const 0
                i32.load offset=65580
                local.tee $l18
                i32.const 1
                i32.add
                i32.store offset=65580
                local.get $l18
                i32.const 15728641
                i32.add
                i32.const 60
                i32.store8
                i32.const 0
                i32.const 0
                i32.load offset=65580
                local.tee $l18
                i32.const 1
                i32.add
                i32.store offset=65580
                local.get $l18
                i32.const 15728641
                i32.add
                i32.const 47
                i32.store8
                i32.const 0
                i32.const 0
                i32.load offset=65580
                local.tee $l18
                i32.const 1
                i32.add
                i32.store offset=65580
                local.get $l18
                i32.const 15728641
                i32.add
                i32.const 108
                i32.store8
                i32.const 0
                i32.const 0
                i32.load offset=65580
                local.tee $l18
                i32.const 1
                i32.add
                i32.store offset=65580
                local.get $l18
                i32.const 15728641
                i32.add
                i32.const 105
                i32.store8
                i32.const 0
                i32.const 0
                i32.load offset=65580
                local.tee $l18
                i32.const 1
                i32.add
                i32.store offset=65580
                local.get $l18
                i32.const 15728641
                i32.add
                i32.const 62
                i32.store8
                i32.const 0
                i32.const 0
                i32.load offset=65580
                i32.const 1
                i32.add
                local.tee $l18
                i32.store offset=65580
              end
              local.get $l19
              i32.const 24
              i32.add
              local.set $l19
              local.get $l15
              i32.const -1
              i32.add
              local.tee $l15
              br_if $L45
            end
            local.get $l18
            i32.const 60
            i32.store8 offset=15728640
            i32.const 0
            i32.const 0
            i32.load offset=65580
            local.tee $l19
            i32.const 1
            i32.add
            i32.store offset=65580
            local.get $l19
            i32.const 15728641
            i32.add
            i32.const 47
            i32.store8
            i32.const 0
            i32.const 0
            i32.load offset=65580
            local.tee $l19
            i32.const 1
            i32.add
            i32.store offset=65580
            local.get $l19
            i32.const 15728641
            i32.add
            i32.const 111
            i32.store8
            i32.const 0
            i32.const 0
            i32.load offset=65580
            local.tee $l19
            i32.const 1
            i32.add
            i32.store offset=65580
            local.get $l19
            i32.const 15728641
            i32.add
            i32.const 108
            i32.store8
            i32.const 0
            i32.const 0
            i32.load offset=65580
            local.tee $l19
            i32.const 1
            i32.add
            i32.store offset=65580
            local.get $l19
            i32.const 15728641
            i32.add
            i32.const 62
            i32.store8
            i32.const 0
            i32.const 0
            i32.load offset=65580
            local.tee $l19
            i32.const 1
            i32.add
            i32.store offset=65580
            local.get $l19
            i32.const 15728641
            i32.add
            i32.const 60
            i32.store8
            i32.const 0
            i32.const 0
            i32.load offset=65580
            local.tee $l19
            i32.const 1
            i32.add
            i32.store offset=65580
            local.get $l19
            i32.const 15728641
            i32.add
            i32.const 47
            i32.store8
            i32.const 0
            i32.const 0
            i32.load offset=65580
            local.tee $l19
            i32.const 1
            i32.add
            i32.store offset=65580
            local.get $l19
            i32.const 15728641
            i32.add
            i32.const 110
            i32.store8
            i32.const 0
            i32.const 0
            i32.load offset=65580
            local.tee $l19
            i32.const 1
            i32.add
            i32.store offset=65580
            local.get $l19
            i32.const 15728641
            i32.add
            i32.const 97
            i32.store8
            i32.const 0
            i32.const 0
            i32.load offset=65580
            local.tee $l19
            i32.const 1
            i32.add
            i32.store offset=65580
            local.get $l19
            i32.const 15728641
            i32.add
            i32.const 118
            i32.store8
            i32.const 0
            i32.const 0
            i32.load offset=65580
            local.tee $l19
            i32.const 1
            i32.add
            i32.store offset=65580
            local.get $l19
            i32.const 15728641
            i32.add
            i32.const 62
            i32.store8
            i32.const 0
            i32.const 0
            i32.load offset=65580
            i32.const 1
            i32.add
            i32.store offset=65580
            local.get $l13
            i32.const 1
            i32.shl
            local.set $l12
          end
          loop $L47
            local.get $l17
            i32.const 24
            i32.mul
            local.tee $l19
            i32.load offset=27262980
            local.set $l15
            local.get $l19
            i32.const 27262984
            i32.add
            i32.load
            local.set $l18
            block $B48
              block $B49
                block $B50
                  block $B51
                    block $B52
                      block $B53
                        block $B54
                          local.get $l19
                          i32.load offset=27262976
                          local.tee $l24
                          i32.const -1
                          i32.add
                          br_table $B54 $B53 $B51 $B52
                        end
                        i32.const 0
                        i32.load offset=65580
                        i32.const 60
                        i32.store8 offset=15728640
                        i32.const 0
                        i32.const 0
                        i32.load offset=65580
                        local.tee $l19
                        i32.const 1
                        i32.add
                        i32.store offset=65580
                        i32.const 104
                        local.set $l24
                        local.get $l19
                        i32.const 15728641
                        i32.add
                        i32.const 104
                        i32.store8
                        i32.const 0
                        i32.const 0
                        i32.load offset=65580
                        local.tee $l19
                        i32.const 1
                        i32.add
                        i32.store offset=65580
                        i32.const 49
                        local.set $l20
                        local.get $l19
                        i32.const 15728641
                        i32.add
                        i32.const 49
                        i32.store8
                        i32.const 0
                        i32.const 0
                        i32.load offset=65580
                        local.tee $l19
                        i32.const 1
                        i32.add
                        i32.store offset=65580
                        local.get $l19
                        i32.const 15728641
                        i32.add
                        i32.const 32
                        i32.store8
                        i32.const 0
                        i32.const 0
                        i32.load offset=65580
                        local.tee $l19
                        i32.const 1
                        i32.add
                        i32.store offset=65580
                        local.get $l19
                        i32.const 15728641
                        i32.add
                        i32.const 105
                        i32.store8
                        i32.const 0
                        i32.const 0
                        i32.load offset=65580
                        local.tee $l19
                        i32.const 1
                        i32.add
                        i32.store offset=65580
                        local.get $l19
                        i32.const 15728641
                        i32.add
                        i32.const 100
                        i32.store8
                        i32.const 0
                        i32.const 0
                        i32.load offset=65580
                        local.tee $l19
                        i32.const 1
                        i32.add
                        i32.store offset=65580
                        local.get $l19
                        i32.const 15728641
                        i32.add
                        i32.const 61
                        i32.store8
                        i32.const 0
                        i32.const 0
                        i32.load offset=65580
                        local.tee $l19
                        i32.const 1
                        i32.add
                        i32.store offset=65580
                        local.get $l19
                        i32.const 15728641
                        i32.add
                        i32.const 34
                        i32.store8
                        i32.const 0
                        i32.const 0
                        i32.load offset=65580
                        i32.const 1
                        i32.add
                        i32.store offset=65580
                        local.get $l15
                        local.get $l18
                        call $write_slug
                        i32.const 0
                        i32.load offset=65580
                        i32.const 34
                        i32.store8 offset=15728640
                        i32.const 0
                        i32.const 0
                        i32.load offset=65580
                        local.tee $l19
                        i32.const 1
                        i32.add
                        i32.store offset=65580
                        local.get $l19
                        i32.const 15728641
                        i32.add
                        i32.const 62
                        i32.store8
                        i32.const 0
                        i32.const 0
                        i32.load offset=65580
                        i32.const 1
                        i32.add
                        i32.store offset=65580
                        local.get $l15
                        local.get $l18
                        call $write_escaped
                        i32.const 0
                        i32.load offset=65580
                        i32.const 60
                        i32.store8 offset=15728640
                        i32.const 0
                        i32.load offset=65580
                        i32.const 1
                        i32.add
                        local.set $l19
                        br $B50
                      end
                      i32.const 0
                      i32.load offset=65580
                      i32.const 60
                      i32.store8 offset=15728640
                      i32.const 0
                      i32.const 0
                      i32.load offset=65580
                      local.tee $l19
                      i32.const 1
                      i32.add
                      i32.store offset=65580
                      i32.const 104
                      local.set $l24
                      local.get $l19
                      i32.const 15728641
                      i32.add
                      i32.const 104
                      i32.store8
                      i32.const 0
                      i32.const 0
                      i32.load offset=65580
                      local.tee $l19
                      i32.const 1
                      i32.add
                      i32.store offset=65580
                      i32.const 50
                      local.set $l20
                      local.get $l19
                      i32.const 15728641
                      i32.add
                      i32.const 50
                      i32.store8
                      i32.const 0
                      i32.const 0
                      i32.load offset=65580
                      local.tee $l19
                      i32.const 1
                      i32.add
                      i32.store offset=65580
                      local.get $l19
                      i32.const 15728641
                      i32.add
                      i32.const 32
                      i32.store8
                      i32.const 0
                      i32.const 0
                      i32.load offset=65580
                      local.tee $l19
                      i32.const 1
                      i32.add
                      i32.store offset=65580
                      local.get $l19
                      i32.const 15728641
                      i32.add
                      i32.const 105
                      i32.store8
                      i32.const 0
                      i32.const 0
                      i32.load offset=65580
                      local.tee $l19
                      i32.const 1
                      i32.add
                      i32.store offset=65580
                      local.get $l19
                      i32.const 15728641
                      i32.add
                      i32.const 100
                      i32.store8
                      i32.const 0
                      i32.const 0
                      i32.load offset=65580
                      local.tee $l19
                      i32.const 1
                      i32.add
                      i32.store offset=65580
                      local.get $l19
                      i32.const 15728641
                      i32.add
                      i32.const 61
                      i32.store8
                      i32.const 0
                      i32.const 0
                      i32.load offset=65580
                      local.tee $l19
                      i32.const 1
                      i32.add
                      i32.store offset=65580
                      local.get $l19
                      i32.const 15728641
                      i32.add
                      i32.const 34
                      i32.store8
                      i32.const 0
                      i32.const 0
                      i32.load offset=65580
                      i32.const 1
                      i32.add
                      i32.store offset=65580
                      local.get $l15
                      local.get $l18
                      call $write_slug
                      i32.const 0
                      i32.load offset=65580
                      i32.const 34
                      i32.store8 offset=15728640
                      i32.const 0
                      i32.const 0
                      i32.load offset=65580
                      local.tee $l19
                      i32.const 1
                      i32.add
                      i32.store offset=65580
                      local.get $l19
                      i32.const 15728641
                      i32.add
                      i32.const 62
                      i32.store8
                      i32.const 0
                      i32.const 0
                      i32.load offset=65580
                      i32.const 1
                      i32.add
                      i32.store offset=65580
                      local.get $l15
                      local.get $l18
                      call $write_escaped
                      i32.const 0
                      i32.load offset=65580
                      i32.const 60
                      i32.store8 offset=15728640
                      i32.const 0
                      i32.load offset=65580
                      i32.const 1
                      i32.add
                      local.set $l19
                      br $B50
                    end
                    local.get $l19
                    i32.const 27262996
                    i32.add
                    i32.load
                    local.set $l20
                    block $B55
                      local.get $l24
                      i32.const 4
                      i32.ne
                      br_if $B55
                      local.get $l20
                      i32.eqz
                      br_if $B55
                      i32.const 60
                      local.set $l23
                      i32.const 0
                      i32.load offset=65580
                      i32.const 60
                      i32.store8 offset=15728640
                      i32.const 0
                      i32.const 0
                      i32.load offset=65580
                      local.tee $l24
                      i32.const 1
                      i32.add
                      i32.store offset=65580
                      i32.const 112
                      local.set $l20
                      local.get $l24
                      i32.const 15728641
                      i32.add
                      i32.const 112
                      i32.store8
                      i32.const 0
                      i32.const 0
                      i32.load offset=65580
                      local.tee $l24
                      i32.const 1
                      i32.add
                      i32.store offset=65580
                      local.get $l24
                      i32.const 15728641
                      i32.add
                      i32.const 62
                      i32.store8
                      i32.const 0
                      i32.const 0
                      i32.load offset=65580
                      local.tee $l24
                      i32.const 1
                      i32.add
                      i32.store offset=65580
                      local.get $l24
                      i32.const 15728641
                      i32.add
                      i32.const 60
                      i32.store8
                      i32.const 0
                      i32.const 0
                      i32.load offset=65580
                      local.tee $l24
                      i32.const 1
                      i32.add
                      i32.store offset=65580
                      local.get $l24
                      i32.const 15728641
                      i32.add
                      i32.const 97
                      i32.store8
                      i32.const 0
                      i32.const 0
                      i32.load offset=65580
                      local.tee $l24
                      i32.const 1
                      i32.add
                      i32.store offset=65580
                      local.get $l24
                      i32.const 15728641
                      i32.add
                      i32.const 32
                      i32.store8
                      i32.const 0
                      i32.const 0
                      i32.load offset=65580
                      local.tee $l24
                      i32.const 1
                      i32.add
                      i32.store offset=65580
                      local.get $l24
                      i32.const 15728641
                      i32.add
                      i32.const 104
                      i32.store8
                      i32.const 0
                      i32.const 0
                      i32.load offset=65580
                      local.tee $l24
                      i32.const 1
                      i32.add
                      i32.store offset=65580
                      local.get $l24
                      i32.const 15728641
                      i32.add
                      i32.const 114
                      i32.store8
                      i32.const 0
                      i32.const 0
                      i32.load offset=65580
                      local.tee $l24
                      i32.const 1
                      i32.add
                      i32.store offset=65580
                      local.get $l24
                      i32.const 15728641
                      i32.add
                      i32.const 101
                      i32.store8
                      i32.const 0
                      i32.const 0
                      i32.load offset=65580
                      local.tee $l24
                      i32.const 1
                      i32.add
                      i32.store offset=65580
                      local.get $l24
                      i32.const 15728641
                      i32.add
                      i32.const 102
                      i32.store8
                      i32.const 0
                      i32.const 0
                      i32.load offset=65580
                      local.tee $l24
                      i32.const 1
                      i32.add
                      i32.store offset=65580
                      local.get $l24
                      i32.const 15728641
                      i32.add
                      i32.const 61
                      i32.store8
                      i32.const 0
                      i32.const 0
                      i32.load offset=65580
                      local.tee $l24
                      i32.const 1
                      i32.add
                      i32.store offset=65580
                      local.get $l24
                      i32.const 15728641
                      i32.add
                      i32.const 34
                      i32.store8
                      i32.const 0
                      i32.const 0
                      i32.load offset=65580
                      i32.const 1
                      i32.add
                      i32.store offset=65580
                      local.get $l19
                      i32.const 27262988
                      i32.add
                      i32.load
                      local.get $l19
                      i32.const 27262992
                      i32.add
                      i32.load
                      call $write_escaped
                      i32.const 0
                      i32.load offset=65580
                      i32.const 34
                      i32.store8 offset=15728640
                      i32.const 0
                      i32.const 0
                      i32.load offset=65580
                      local.tee $l19
                      i32.const 1
                      i32.add
                      i32.store offset=65580
                      local.get $l19
                      i32.const 15728641
                      i32.add
                      i32.const 62
                      i32.store8
                      i32.const 0
                      i32.const 0
                      i32.load offset=65580
                      i32.const 1
                      i32.add
                      i32.store offset=65580
                      local.get $l15
                      local.get $l18
                      call $write_escaped
                      i32.const 0
                      i32.load offset=65580
                      i32.const 60
                      i32.store8 offset=15728640
                      i32.const 0
                      i32.const 0
                      i32.load offset=65580
                      local.tee $l19
                      i32.const 1
                      i32.add
                      i32.store offset=65580
                      i32.const 47
                      local.set $l24
                      local.get $l19
                      i32.const 15728641
                      i32.add
                      i32.const 47
                      i32.store8
                      i32.const 0
                      i32.const 0
                      i32.load offset=65580
                      local.tee $l19
                      i32.const 1
                      i32.add
                      i32.store offset=65580
                      local.get $l19
                      i32.const 15728641
                      i32.add
                      i32.const 97
                      i32.store8
                      i32.const 0
                      i32.const 0
                      i32.load offset=65580
                      local.tee $l19
                      i32.const 1
                      i32.add
                      i32.store offset=65580
                      local.get $l19
                      i32.const 15728641
                      i32.add
                      i32.const 62
                      i32.store8
                      i32.const 0
                      i32.const 0
                      i32.load offset=65580
                      i32.const 1
                      i32.add
                      local.tee $l19
                      i32.store offset=65580
                      br $B49
                    end
                    block $B56
                      local.get $l24
                      i32.const 5
                      i32.ne
                      br_if $B56
                      local.get $l20
                      i32.eqz
                      br_if $B56
                      i32.const 0
                      i32.load offset=65580
                      i32.const 60
                      i32.store8 offset=15728640
                      i32.const 0
                      i32.const 0
                      i32.load offset=65580
                      local.tee $l24
                      i32.const 1
                      i32.add
                      i32.store offset=65580
                      local.get $l24
                      i32.const 15728641
                      i32.add
                      i32.const 102
                      i32.store8
                      i32.const 0
                      i32.const 0
                      i32.load offset=65580
                      local.tee $l24
                      i32.const 1
                      i32.add
                      i32.store offset=65580
                      local.get $l24
                      i32.const 15728641
                      i32.add
                      i32.const 105
                      i32.store8
                      i32.const 0
                      i32.const 0
                      i32.load offset=65580
                      local.tee $l24
                      i32.const 1
                      i32.add
                      i32.store offset=65580
                      local.get $l24
                      i32.const 15728641
                      i32.add
                      i32.const 103
                      i32.store8
                      i32.const 0
                      i32.const 0
                      i32.load offset=65580
                      local.tee $l24
                      i32.const 1
                      i32.add
                      i32.store offset=65580
                      i32.const 117
                      local.set $l23
                      local.get $l24
                      i32.const 15728641
                      i32.add
                      i32.const 117
                      i32.store8
                      i32.const 0
                      i32.const 0
                      i32.load offset=65580
                      local.tee $l20
                      i32.const 1
                      i32.add
                      i32.store offset=65580
                      i32.const 114
                      local.set $l24
                      local.get $l20
                      i32.const 15728641
                      i32.add
                      i32.const 114
                      i32.store8
                      i32.const 0
                      i32.const 0
                      i32.load offset=65580
                      local.tee $l9
                      i32.const 1
                      i32.add
                      i32.store offset=65580
                      i32.const 101
                      local.set $l20
                      local.get $l9
                      i32.const 15728641
                      i32.add
                      i32.const 101
                      i32.store8
                      i32.const 0
                      i32.const 0
                      i32.load offset=65580
                      local.tee $l9
                      i32.const 1
                      i32.add
                      i32.store offset=65580
                      local.get $l9
                      i32.const 15728641
                      i32.add
                      i32.const 62
                      i32.store8
                      i32.const 0
                      i32.const 0
                      i32.load offset=65580
                      local.tee $l9
                      i32.const 1
                      i32.add
                      i32.store offset=65580
                      local.get $l9
                      i32.const 15728641
                      i32.add
                      i32.const 60
                      i32.store8
                      i32.const 0
                      i32.const 0
                      i32.load offset=65580
                      local.tee $l9
                      i32.const 1
                      i32.add
                      i32.store offset=65580
                      local.get $l9
                      i32.const 15728641
                      i32.add
                      i32.const 105
                      i32.store8
                      i32.const 0
                      i32.const 0
                      i32.load offset=65580
                      local.tee $l9
                      i32.const 1
                      i32.add
                      i32.store offset=65580
                      local.get $l9
                      i32.const 15728641
                      i32.add
                      i32.const 109
                      i32.store8
                      i32.const 0
                      i32.const 0
                      i32.load offset=65580
                      local.tee $l9
                      i32.const 1
                      i32.add
                      i32.store offset=65580
                      local.get $l9
                      i32.const 15728641
                      i32.add
                      i32.const 103
                      i32.store8
                      i32.const 0
                      i32.const 0
                      i32.load offset=65580
                      local.tee $l9
                      i32.const 1
                      i32.add
                      i32.store offset=65580
                      local.get $l9
                      i32.const 15728641
                      i32.add
                      i32.const 32
                      i32.store8
                      i32.const 0
                      i32.const 0
                      i32.load offset=65580
                      local.tee $l9
                      i32.const 1
                      i32.add
                      i32.store offset=65580
                      local.get $l9
                      i32.const 15728641
                      i32.add
                      i32.const 115
                      i32.store8
                      i32.const 0
                      i32.const 0
                      i32.load offset=65580
                      local.tee $l9
                      i32.const 1
                      i32.add
                      i32.store offset=65580
                      local.get $l9
                      i32.const 15728641
                      i32.add
                      i32.const 114
                      i32.store8
                      i32.const 0
                      i32.const 0
                      i32.load offset=65580
                      local.tee $l9
                      i32.const 1
                      i32.add
                      i32.store offset=65580
                      local.get $l9
                      i32.const 15728641
                      i32.add
                      i32.const 99
                      i32.store8
                      i32.const 0
                      i32.const 0
                      i32.load offset=65580
                      local.tee $l9
                      i32.const 1
                      i32.add
                      i32.store offset=65580
                      local.get $l9
                      i32.const 15728641
                      i32.add
                      i32.const 61
                      i32.store8
                      i32.const 0
                      i32.const 0
                      i32.load offset=65580
                      local.tee $l9
                      i32.const 1
                      i32.add
                      i32.store offset=65580
                      local.get $l9
                      i32.const 15728641
                      i32.add
                      i32.const 34
                      i32.store8
                      i32.const 0
                      i32.const 0
                      i32.load offset=65580
                      i32.const 1
                      i32.add
                      i32.store offset=65580
                      local.get $l19
                      i32.const 27262988
                      i32.add
                      i32.load
                      local.get $l19
                      i32.const 27262992
                      i32.add
                      i32.load
                      call $write_escaped
                      i32.const 0
                      i32.load offset=65580
                      i32.const 34
                      i32.store8 offset=15728640
                      i32.const 0
                      i32.const 0
                      i32.load offset=65580
                      local.tee $l19
                      i32.const 1
                      i32.add
                      i32.store offset=65580
                      local.get $l19
                      i32.const 15728641
                      i32.add
                      i32.const 32
                      i32.store8
                      i32.const 0
                      i32.const 0
                      i32.load offset=65580
                      local.tee $l19
                      i32.const 1
                      i32.add
                      i32.store offset=65580
                      local.get $l19
                      i32.const 15728641
                      i32.add
                      i32.const 97
                      i32.store8
                      i32.const 0
                      i32.const 0
                      i32.load offset=65580
                      local.tee $l19
                      i32.const 1
                      i32.add
                      i32.store offset=65580
                      local.get $l19
                      i32.const 15728641
                      i32.add
                      i32.const 108
                      i32.store8
                      i32.const 0
                      i32.const 0
                      i32.load offset=65580
                      local.tee $l19
                      i32.const 1
                      i32.add
                      i32.store offset=65580
                      local.get $l19
                      i32.const 15728641
                      i32.add
                      i32.const 116
                      i32.store8
                      i32.const 0
                      i32.const 0
                      i32.load offset=65580
                      local.tee $l19
                      i32.const 1
                      i32.add
                      i32.store offset=65580
                      local.get $l19
                      i32.const 15728641
                      i32.add
                      i32.const 61
                      i32.store8
                      i32.const 0
                      i32.const 0
                      i32.load offset=65580
                      local.tee $l19
                      i32.const 1
                      i32.add
                      i32.store offset=65580
                      local.get $l19
                      i32.const 15728641
                      i32.add
                      i32.const 34
                      i32.store8
                      i32.const 0
                      i32.const 0
                      i32.load offset=65580
                      i32.const 1
                      i32.add
                      i32.store offset=65580
                      local.get $l15
                      local.get $l18
                      call $write_escaped
                      i32.const 0
                      i32.load offset=65580
                      i32.const 34
                      i32.store8 offset=15728640
                      i32.const 0
                      i32.const 0
                      i32.load offset=65580
                      local.tee $l19
                      i32.const 1
                      i32.add
                      i32.store offset=65580
                      local.get $l19
                      i32.const 15728641
                      i32.add
                      i32.const 62
                      i32.store8
                      i32.const 0
                      i32.const 0
                      i32.load offset=65580
                      local.tee $l19
                      i32.const 1
                      i32.add
                      i32.store offset=65580
                      local.get $l19
                      i32.const 15728641
                      i32.add
                      i32.const 60
                      i32.store8
                      i32.const 0
                      i32.const 0
                      i32.load offset=65580
                      local.tee $l19
                      i32.const 1
                      i32.add
                      i32.store offset=65580
                      local.get $l19
                      i32.const 15728641
                      i32.add
                      i32.const 47
                      i32.store8
                      i32.const 0
                      i32.const 0
                      i32.load offset=65580
                      local.tee $l19
                      i32.const 1
                      i32.add
                      i32.store offset=65580
                      local.get $l19
                      i32.const 15728641
                      i32.add
                      i32.const 102
                      i32.store8
                      i32.const 0
                      i32.const 0
                      i32.load offset=65580
                      local.tee $l19
                      i32.const 1
                      i32.add
                      i32.store offset=65580
                      local.get $l19
                      i32.const 15728641
                      i32.add
                      i32.const 105
                      i32.store8
                      i32.const 0
                      i32.const 0
                      i32.load offset=65580
                      local.tee $l19
                      i32.const 1
                      i32.add
                      i32.store offset=65580
                      local.get $l19
                      i32.const 15728641
                      i32.add
                      i32.const 103
                      i32.store8
                      i32.const 0
                      i32.const 0
                      i32.load offset=65580
                      i32.const 1
                      i32.add
                      local.tee $l19
                      i32.store offset=65580
                      br $B49
                    end
                    local.get $l24
                    i32.const 6
                    i32.ne
                    br_if $B48
                    local.get $l20
                    i32.eqz
                    br_if $B48
                    local.get $l18
                    i32.eqz
                    br_if $B48
                    local.get $l15
                    i32.const 3145728
                    i32.add
                    local.set $l24
                    i32.const 0
                    local.set $l19
                    i32.const 0
                    i32.load offset=65580
                    local.set $l15
                    block $B57
                      local.get $l18
                      i32.const 1
                      i32.eq
                      br_if $B57
                      local.get $l18
                      i32.const 1
                      i32.and
                      local.set $l23
                      local.get $l18
                      i32.const -2
                      i32.and
                      local.set $l20
                      i32.const 0
                      local.set $l19
                      loop $L58
                        local.get $l15
                        local.get $l24
                        local.get $l19
                        i32.add
                        local.tee $l18
                        i32.load8_u
                        i32.store8 offset=15728640
                        i32.const 0
                        i32.const 0
                        i32.load offset=65580
                        local.tee $l15
                        i32.const 1
                        i32.add
                        i32.store offset=65580
                        local.get $l15
                        i32.const 15728641
                        i32.add
                        local.get $l18
                        i32.const 1
                        i32.add
                        i32.load8_u
                        i32.store8
                        i32.const 0
                        i32.const 0
                        i32.load offset=65580
                        i32.const 1
                        i32.add
                        local.tee $l15
                        i32.store offset=65580
                        local.get $l20
                        local.get $l19
                        i32.const 2
                        i32.add
                        local.tee $l19
                        i32.ne
                        br_if $L58
                      end
                      local.get $l23
                      i32.eqz
                      br_if $B48
                    end
                    local.get $l15
                    local.get $l24
                    local.get $l19
                    i32.add
                    i32.load8_u
                    i32.store8 offset=15728640
                    i32.const 0
                    i32.const 0
                    i32.load offset=65580
                    i32.const 1
                    i32.add
                    i32.store offset=65580
                    br $B48
                  end
                  i32.const 60
                  local.set $l23
                  i32.const 0
                  i32.load offset=65580
                  i32.const 60
                  i32.store8 offset=15728640
                  i32.const 0
                  i32.const 0
                  i32.load offset=65580
                  local.tee $l19
                  i32.const 1
                  i32.add
                  i32.store offset=65580
                  i32.const 112
                  local.set $l20
                  local.get $l19
                  i32.const 15728641
                  i32.add
                  i32.const 112
                  i32.store8
                  i32.const 0
                  i32.const 0
                  i32.load offset=65580
                  local.tee $l19
                  i32.const 1
                  i32.add
                  i32.store offset=65580
                  local.get $l19
                  i32.const 15728641
                  i32.add
                  i32.const 62
                  i32.store8
                  i32.const 0
                  i32.const 0
                  i32.load offset=65580
                  i32.const 1
                  i32.add
                  i32.store offset=65580
                  local.get $l15
                  local.get $l18
                  call $write_escaped
                  i32.const 0
                  i32.load offset=65580
                  local.set $l19
                  i32.const 47
                  local.set $l24
                  br $B49
                end
                i32.const 0
                local.get $l19
                i32.store offset=65580
                i32.const 47
                local.set $l23
              end
              local.get $l19
              local.get $l23
              i32.store8 offset=15728640
              i32.const 0
              i32.const 0
              i32.load offset=65580
              local.tee $l19
              i32.const 1
              i32.add
              i32.store offset=65580
              local.get $l19
              i32.const 15728641
              i32.add
              local.get $l24
              i32.store8
              i32.const 0
              i32.const 0
              i32.load offset=65580
              local.tee $l19
              i32.const 1
              i32.add
              i32.store offset=65580
              local.get $l19
              i32.const 15728641
              i32.add
              local.get $l20
              i32.store8
              i32.const 0
              i32.const 0
              i32.load offset=65580
              local.tee $l19
              i32.const 1
              i32.add
              i32.store offset=65580
              local.get $l19
              i32.const 15728641
              i32.add
              i32.const 62
              i32.store8
              i32.const 0
              i32.const 0
              i32.load offset=65580
              i32.const 1
              i32.add
              i32.store offset=65580
            end
            local.get $l17
            i32.const 1
            i32.add
            local.tee $l17
            local.get $l14
            i32.ne
            br_if $L47
          end
          local.get $l10
          local.get $l14
          i32.add
          local.get $l22
          i32.add
          i32.const 2
          i32.const 0
          local.get $l13
          select
          i32.add
          local.get $l12
          i32.add
          local.set $l19
          local.get $l14
          local.get $l4
          i32.add
          local.set $l4
        end
        local.get $l25
        local.get $l5
        i32.add
        local.set $l5
        local.get $l16
        local.get $l6
        i32.add
        local.set $l6
        local.get $l21
        local.get $l7
        i32.add
        local.set $l7
        local.get $l19
        local.get $l8
        i32.add
        local.set $l8
        local.get $l11
        local.get $l3
        i32.add
        local.set $l3
        local.get $l2
        i32.const 1
        i32.add
        local.tee $l2
        i32.const 500
        i32.ne
        br_if $L4
      end
      block $B59
        local.get $l1
        local.get $p0
        i32.eq
        br_if $B59
        i32.const -7
        return
      end
      i32.const 0
      local.set $l19
      block $B60
        block $B61
          i32.const 0
          i32.load offset=65580
          local.tee $l18
          br_if $B61
          i32.const -2128831035
          local.set $l17
          br $B60
        end
        local.get $l18
        i32.const 3
        i32.and
        local.set $l14
        i32.const -2128831035
        local.set $l17
        block $B62
          local.get $l18
          i32.const 4
          i32.lt_u
          br_if $B62
          local.get $l18
          i32.const -4
          i32.and
          local.set $l18
          i32.const -2128831035
          local.set $l17
          i32.const 0
          local.set $l19
          loop $L63
            local.get $l17
            local.get $l19
            i32.const 15728640
            i32.add
            i32.load8_u
            i32.xor
            i32.const 16777619
            i32.mul
            local.get $l19
            i32.const 15728641
            i32.add
            i32.load8_u
            i32.xor
            i32.const 16777619
            i32.mul
            local.get $l19
            i32.const 15728642
            i32.add
            i32.load8_u
            i32.xor
            i32.const 16777619
            i32.mul
            local.get $l19
            i32.const 15728643
            i32.add
            i32.load8_u
            i32.xor
            i32.const 16777619
            i32.mul
            local.set $l17
            local.get $l18
            local.get $l19
            i32.const 4
            i32.add
            local.tee $l19
            i32.ne
            br_if $L63
          end
          local.get $l14
          i32.eqz
          br_if $B60
        end
        local.get $l19
        i32.const 15728640
        i32.add
        local.set $l19
        loop $L64
          local.get $l17
          local.get $l19
          i32.load8_u
          i32.xor
          i32.const 16777619
          i32.mul
          local.set $l17
          local.get $l19
          i32.const 1
          i32.add
          local.set $l19
          local.get $l14
          i32.const -1
          i32.add
          local.tee $l14
          br_if $L64
        end
      end
      i32.const 0
      local.set $l12
      i32.const 0
      i32.const 500
      i32.store offset=28311552
      i32.const 0
      local.get $l3
      i32.store offset=28311556
      i32.const 0
      local.get $l4
      i32.store offset=28311560
      i32.const 0
      local.get $l8
      i32.store offset=28311564
      i32.const 0
      local.get $l7
      i32.store offset=28311568
      i32.const 0
      local.get $l6
      i32.store offset=28311572
      i32.const 0
      i32.const 0
      i32.load offset=65580
      i32.store offset=28311576
      i32.const 0
      local.get $l5
      i32.store offset=28311580
      i32.const 0
      local.get $l17
      i32.store offset=28311584
      i32.const 0
      i32.const 0
      i32.store offset=28311588
    end
    local.get $l12)
  (func $write_slug (type $t2) (param $p0 i32) (param $p1 i32)
    (local $l2 i32) (local $l3 i32) (local $l4 i32) (local $l5 i32) (local $l6 i32) (local $l7 i32)
    i32.const 0
    i32.load offset=65580
    local.set $l2
    block $B0
      block $B1
        local.get $p1
        i32.eqz
        br_if $B1
        local.get $p0
        i32.const 3145728
        i32.add
        local.set $l3
        local.get $l2
        local.set $l4
        i32.const 0
        local.set $l5
        i32.const 0
        local.set $p0
        loop $L2
          block $B3
            block $B4
              local.get $l3
              local.get $p0
              i32.add
              i32.load8_u
              local.tee $l6
              i32.extend8_s
              local.tee $l7
              i32.const 0
              i32.lt_s
              br_if $B4
              block $B5
                block $B6
                  block $B7
                    block $B8
                      local.get $l7
                      i32.const -58
                      i32.add
                      i32.const 255
                      i32.and
                      i32.const 245
                      i32.gt_u
                      br_if $B8
                      local.get $l7
                      i32.const 95
                      i32.and
                      i32.const -91
                      i32.add
                      i32.const 255
                      i32.and
                      i32.const 230
                      i32.lt_u
                      br_if $B7
                    end
                    local.get $l7
                    i32.const 32
                    i32.add
                    local.get $l7
                    local.get $l7
                    i32.const -65
                    i32.add
                    i32.const 255
                    i32.and
                    i32.const 26
                    i32.lt_u
                    select
                    local.set $l7
                    i32.const 0
                    local.set $l5
                    br $B6
                  end
                  local.get $l4
                  local.get $l2
                  i32.le_u
                  br_if $B5
                  local.get $l5
                  br_if $B5
                  i32.const 1
                  local.set $l5
                  i32.const 45
                  local.set $l7
                end
                local.get $l4
                local.get $l7
                i32.store8 offset=15728640
                i32.const 0
                i32.const 0
                i32.load offset=65580
                i32.const 1
                i32.add
                local.tee $l4
                i32.store offset=65580
              end
              local.get $p0
              i32.const 1
              i32.add
              local.set $p0
              br $B3
            end
            block $B9
              local.get $l4
              local.get $l2
              i32.le_u
              br_if $B9
              local.get $l5
              br_if $B9
              local.get $l4
              i32.const 45
              i32.store8 offset=15728640
              i32.const 1
              local.set $l5
              i32.const 0
              i32.const 0
              i32.load offset=65580
              i32.const 1
              i32.add
              local.tee $l4
              i32.store offset=65580
            end
            block $B10
              block $B11
                local.get $l6
                i32.const 224
                i32.and
                i32.const 192
                i32.ne
                br_if $B11
                i32.const 2
                local.set $l7
                br $B10
              end
              block $B12
                local.get $l6
                i32.const 240
                i32.and
                i32.const 224
                i32.ne
                br_if $B12
                i32.const 3
                local.set $l7
                br $B10
              end
              i32.const 4
              i32.const 1
              local.get $l6
              i32.const 248
              i32.and
              i32.const 240
              i32.eq
              select
              local.set $l7
            end
            local.get $l7
            local.get $p0
            i32.add
            local.set $p0
          end
          local.get $p0
          local.get $p1
          i32.lt_u
          br_if $L2
        end
        block $B13
          local.get $l4
          local.get $l2
          i32.le_u
          br_if $B13
          local.get $l4
          i32.const 15728639
          i32.add
          i32.load8_u
          i32.const 45
          i32.ne
          br_if $B13
          i32.const 0
          local.get $l4
          i32.const -1
          i32.add
          local.tee $l4
          i32.store offset=65580
        end
        local.get $l4
        local.get $l2
        i32.ne
        br_if $B0
      end
      local.get $l2
      i32.const 115
      i32.store8 offset=15728640
      i32.const 0
      i32.const 0
      i32.load offset=65580
      local.tee $p0
      i32.const 1
      i32.add
      i32.store offset=65580
      local.get $p0
      i32.const 15728641
      i32.add
      i32.const 101
      i32.store8
      i32.const 0
      i32.const 0
      i32.load offset=65580
      local.tee $p0
      i32.const 1
      i32.add
      i32.store offset=65580
      local.get $p0
      i32.const 15728641
      i32.add
      i32.const 99
      i32.store8
      i32.const 0
      i32.const 0
      i32.load offset=65580
      local.tee $p0
      i32.const 1
      i32.add
      i32.store offset=65580
      local.get $p0
      i32.const 15728641
      i32.add
      i32.const 116
      i32.store8
      i32.const 0
      i32.const 0
      i32.load offset=65580
      local.tee $p0
      i32.const 1
      i32.add
      i32.store offset=65580
      local.get $p0
      i32.const 15728641
      i32.add
      i32.const 105
      i32.store8
      i32.const 0
      i32.const 0
      i32.load offset=65580
      local.tee $p0
      i32.const 1
      i32.add
      i32.store offset=65580
      local.get $p0
      i32.const 15728641
      i32.add
      i32.const 111
      i32.store8
      i32.const 0
      i32.const 0
      i32.load offset=65580
      local.tee $p0
      i32.const 1
      i32.add
      i32.store offset=65580
      local.get $p0
      i32.const 15728641
      i32.add
      i32.const 110
      i32.store8
      i32.const 0
      i32.const 0
      i32.load offset=65580
      i32.const 1
      i32.add
      i32.store offset=65580
    end)
  (func $write_escaped (type $t2) (param $p0 i32) (param $p1 i32)
    (local $l2 i32) (local $l3 i32)
    block $B0
      local.get $p1
      i32.eqz
      br_if $B0
      local.get $p0
      i32.const 3145728
      i32.add
      local.set $p0
      loop $L1
        i32.const 0
        i32.load offset=65580
        local.set $l2
        block $B2
          block $B3
            block $B4
              block $B5
                block $B6
                  block $B7
                    local.get $p0
                    i32.load8_u
                    local.tee $l3
                    i32.const -34
                    i32.add
                    br_table $B4 $B3 $B3 $B3 $B7 $B3 $B3 $B3 $B3 $B3 $B3 $B3 $B3 $B3 $B3 $B3 $B3 $B3 $B3 $B3 $B3 $B3 $B3 $B3 $B3 $B3 $B6 $B3 $B5 $B3
                  end
                  local.get $l2
                  i32.const 38
                  i32.store8 offset=15728640
                  i32.const 0
                  i32.const 0
                  i32.load offset=65580
                  local.tee $l2
                  i32.const 1
                  i32.add
                  i32.store offset=65580
                  local.get $l2
                  i32.const 15728641
                  i32.add
                  i32.const 97
                  i32.store8
                  i32.const 0
                  i32.const 0
                  i32.load offset=65580
                  local.tee $l2
                  i32.const 1
                  i32.add
                  i32.store offset=65580
                  local.get $l2
                  i32.const 15728641
                  i32.add
                  i32.const 109
                  i32.store8
                  i32.const 0
                  i32.const 0
                  i32.load offset=65580
                  local.tee $l2
                  i32.const 1
                  i32.add
                  i32.store offset=65580
                  local.get $l2
                  i32.const 15728641
                  i32.add
                  i32.const 112
                  i32.store8
                  i32.const 0
                  i32.const 0
                  i32.load offset=65580
                  local.tee $l2
                  i32.const 1
                  i32.add
                  i32.store offset=65580
                  local.get $l2
                  i32.const 15728641
                  i32.add
                  i32.const 59
                  i32.store8
                  br $B2
                end
                local.get $l2
                i32.const 38
                i32.store8 offset=15728640
                i32.const 0
                i32.const 0
                i32.load offset=65580
                local.tee $l2
                i32.const 1
                i32.add
                i32.store offset=65580
                local.get $l2
                i32.const 15728641
                i32.add
                i32.const 108
                i32.store8
                i32.const 0
                i32.const 0
                i32.load offset=65580
                local.tee $l2
                i32.const 1
                i32.add
                i32.store offset=65580
                local.get $l2
                i32.const 15728641
                i32.add
                i32.const 116
                i32.store8
                i32.const 0
                i32.const 0
                i32.load offset=65580
                local.tee $l2
                i32.const 1
                i32.add
                i32.store offset=65580
                local.get $l2
                i32.const 15728641
                i32.add
                i32.const 59
                i32.store8
                br $B2
              end
              local.get $l2
              i32.const 38
              i32.store8 offset=15728640
              i32.const 0
              i32.const 0
              i32.load offset=65580
              local.tee $l2
              i32.const 1
              i32.add
              i32.store offset=65580
              local.get $l2
              i32.const 15728641
              i32.add
              i32.const 103
              i32.store8
              i32.const 0
              i32.const 0
              i32.load offset=65580
              local.tee $l2
              i32.const 1
              i32.add
              i32.store offset=65580
              local.get $l2
              i32.const 15728641
              i32.add
              i32.const 116
              i32.store8
              i32.const 0
              i32.const 0
              i32.load offset=65580
              local.tee $l2
              i32.const 1
              i32.add
              i32.store offset=65580
              local.get $l2
              i32.const 15728641
              i32.add
              i32.const 59
              i32.store8
              br $B2
            end
            local.get $l2
            i32.const 38
            i32.store8 offset=15728640
            i32.const 0
            i32.const 0
            i32.load offset=65580
            local.tee $l2
            i32.const 1
            i32.add
            i32.store offset=65580
            local.get $l2
            i32.const 15728641
            i32.add
            i32.const 113
            i32.store8
            i32.const 0
            i32.const 0
            i32.load offset=65580
            local.tee $l2
            i32.const 1
            i32.add
            i32.store offset=65580
            local.get $l2
            i32.const 15728641
            i32.add
            i32.const 117
            i32.store8
            i32.const 0
            i32.const 0
            i32.load offset=65580
            local.tee $l2
            i32.const 1
            i32.add
            i32.store offset=65580
            local.get $l2
            i32.const 15728641
            i32.add
            i32.const 111
            i32.store8
            i32.const 0
            i32.const 0
            i32.load offset=65580
            local.tee $l2
            i32.const 1
            i32.add
            i32.store offset=65580
            local.get $l2
            i32.const 15728641
            i32.add
            i32.const 116
            i32.store8
            i32.const 0
            i32.const 0
            i32.load offset=65580
            local.tee $l2
            i32.const 1
            i32.add
            i32.store offset=65580
            local.get $l2
            i32.const 15728641
            i32.add
            i32.const 59
            i32.store8
            br $B2
          end
          local.get $l2
          local.get $l3
          i32.store8 offset=15728640
        end
        i32.const 0
        i32.const 0
        i32.load offset=65580
        i32.const 1
        i32.add
        i32.store offset=65580
        local.get $p0
        i32.const 1
        i32.add
        local.set $p0
        local.get $p1
        i32.const -1
        i32.add
        local.tee $p1
        br_if $L1
      end
    end)
  (table $__indirect_function_table 1 1 funcref)
  (memory $memory 512)
  (global $__stack_pointer (mut i32) (i32.const 65536))
  (global $__dso_handle i32 (i32.const 65536))
  (global $__data_end i32 (i32.const 65584))
  (global $__stack_low i32 (i32.const 0))
  (global $__stack_high i32 (i32.const 65536))
  (global $__global_base i32 (i32.const 65536))
  (global $__heap_base i32 (i32.const 65584))
  (global $__heap_end i32 (i32.const 33554432))
  (global $__memory_base i32 (i32.const 0))
  (global $__table_base i32 (i32.const 1))
  (global $__wasm_first_page_end i32 (i32.const 65536))
  (export "memory" (memory $memory))
  (export "__wasm_call_ctors" (func $__wasm_call_ctors))
  (export "__stack_pointer" (global $__stack_pointer))
  (export "markdown_cms_render" (func $markdown_cms_render))
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
  (data $.rodata (i32.const 65536) "<nav aria-label=\22Table of contents\22><ol>\00"))
