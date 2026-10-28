;; archive.zip-workspace.v1 — kernel: zip_build
;; WebAssembly Text (WAT) baseline implementation
;; Exports: zip_build

(module $zip_kernel_c.wasm
  (type $t0 (func))
  (type $t1 (func (result i32)))
  (type $t2 (func (param i32 i32) (result i32)))
  (type $t3 (func (param i32) (result i32)))
  (type $t4 (func (param i32 i32 i32 i32) (result i32)))
  (func $__wasm_call_ctors (type $t0))
  (func $zip_build (type $t1) (result i32)
    (local $l0 i32) (local $l1 i32) (local $l2 i32) (local $l3 i32) (local $l4 i32) (local $l5 i32) (local $l6 i32) (local $l7 i32) (local $l8 i32) (local $l9 i32) (local $l10 i32) (local $l11 i32) (local $l12 i32) (local $l13 i32) (local $l14 i32) (local $l15 i32) (local $l16 i32) (local $l17 i32) (local $l18 i32) (local $l19 i32) (local $l20 i32) (local $l21 i32) (local $l22 i32) (local $l23 i32) (local $l24 i32) (local $l25 i32)
    global.get $__stack_pointer
    i32.const 592
    i32.sub
    local.tee $l0
    global.set $__stack_pointer
    i32.const 0
    i32.const 0
    i32.store offset=3145728
    i32.const 0
    i32.const 0
    i32.store offset=3145732
    i32.const 0
    i32.const 0
    i32.store offset=3145736
    i32.const 0
    i32.const 0
    i32.store offset=3145740
    i32.const 0
    i32.const 0
    i32.store offset=3145744
    i32.const 0
    i32.const 0
    i32.store offset=3145748
    i32.const 0
    i32.const 0
    i32.store offset=3145752
    i32.const 0
    i32.const 0
    i32.store offset=3145756
    i32.const 0
    i32.const 0
    i32.store offset=3145760
    i32.const 0
    i32.const 0
    i32.store offset=3145764
    i32.const 0
    i32.const 0
    i32.store offset=3145768
    i32.const 0
    i32.const 0
    i32.store offset=3145772
    i32.const 0
    i32.const 0
    i32.store offset=3145776
    i32.const 0
    i32.const 0
    i32.store offset=3145780
    i32.const 0
    i32.const 0
    i32.store offset=3145784
    local.get $l0
    i32.const 0
    i32.store offset=76
    local.get $l0
    i32.const 0
    i32.store offset=72
    local.get $l0
    i32.const 336
    i32.add
    i32.const -1
    i32.add
    local.set $l1
    i32.const 0
    local.set $l2
    i32.const 48
    local.set $l3
    i32.const 0
    local.set $l4
    i32.const 0
    local.set $l5
    i32.const 0
    local.set $l6
    i32.const 0
    local.set $l7
    block $B0
      loop $L1
        local.get $l7
        local.set $l8
        local.get $l5
        i32.const 65535
        i32.and
        local.tee $l7
        i32.const 113
        i32.rem_u
        i32.const 48
        i32.add
        local.set $l9
        local.get $l3
        local.get $l2
        i32.const 65535
        i32.and
        i32.const 113
        i32.div_u
        i32.const 113
        i32.mul
        i32.sub
        local.tee $l10
        i32.const 65534
        i32.and
        local.set $l11
        local.get $l10
        i32.const 65535
        i32.and
        local.set $l12
        local.get $l5
        i32.const 3
        i32.and
        local.tee $l13
        i32.const 2
        i32.shl
        i32.load offset=65712
        local.set $l14
        local.get $l5
        local.get $l0
        i32.const 528
        i32.add
        call $path_for
        local.set $l15
        i32.const 0
        local.set $l10
        loop $L2
          local.get $l14
          local.get $l10
          i32.add
          local.set $l16
          local.get $l10
          i32.const 1
          i32.add
          local.tee $l17
          local.set $l10
          local.get $l16
          i32.load8_u
          br_if $L2
        end
        local.get $l7
        i32.const 113
        i32.rem_u
        local.set $l7
        block $B3
          block $B4
            local.get $l13
            i32.const 2
            i32.eq
            br_if $B4
            local.get $l17
            i32.const -1
            i32.add
            local.set $l16
            i32.const 0
            local.set $l10
            block $B5
              local.get $l9
              i32.const 1
              i32.eq
              br_if $B5
              local.get $l9
              i32.const 1
              i32.and
              local.set $l13
              i32.const 0
              local.set $l10
              loop $L6
                local.get $l0
                i32.const 336
                i32.add
                local.get $l10
                i32.add
                local.tee $l17
                local.get $l14
                local.get $l10
                local.get $l16
                i32.rem_u
                i32.add
                i32.load8_u
                i32.store8
                local.get $l17
                i32.const 1
                i32.add
                local.get $l14
                local.get $l10
                i32.const 1
                i32.add
                local.get $l16
                i32.rem_u
                i32.add
                i32.load8_u
                i32.store8
                local.get $l11
                local.get $l10
                i32.const 2
                i32.add
                local.tee $l10
                i32.ne
                br_if $L6
              end
              local.get $l13
              i32.eqz
              br_if $B3
            end
            local.get $l0
            i32.const 336
            i32.add
            local.get $l10
            i32.add
            local.get $l14
            local.get $l10
            local.get $l16
            i32.rem_u
            i32.add
            i32.load8_u
            i32.store8
            br $B3
          end
          local.get $l5
          i32.const -1640531527
          i32.xor
          local.set $l10
          i32.const 0
          local.set $l16
          block $B7
            local.get $l9
            i32.const 1
            i32.eq
            br_if $B7
            local.get $l9
            i32.const 1
            i32.and
            local.set $l17
            i32.const 0
            local.set $l16
            loop $L8
              local.get $l0
              i32.const 336
              i32.add
              local.get $l16
              i32.add
              local.tee $l14
              local.get $l10
              i32.const 13
              i32.shl
              local.get $l10
              i32.xor
              local.tee $l10
              i32.const 17
              i32.shr_u
              local.get $l10
              i32.xor
              local.tee $l10
              i32.const 5
              i32.shl
              local.get $l10
              i32.xor
              local.tee $l10
              i32.const 24
              i32.shr_u
              local.get $l5
              i32.xor
              i32.store8
              local.get $l14
              i32.const 1
              i32.add
              local.get $l10
              i32.const 13
              i32.shl
              local.get $l10
              i32.xor
              local.tee $l10
              i32.const 17
              i32.shr_u
              local.get $l10
              i32.xor
              local.tee $l10
              i32.const 5
              i32.shl
              local.get $l10
              i32.xor
              local.tee $l10
              i32.const 24
              i32.shr_u
              local.get $l5
              i32.xor
              i32.store8
              local.get $l11
              local.get $l16
              i32.const 2
              i32.add
              local.tee $l16
              i32.ne
              br_if $L8
            end
            local.get $l17
            i32.eqz
            br_if $B3
          end
          local.get $l0
          i32.const 336
          i32.add
          local.get $l16
          i32.add
          local.get $l10
          i32.const 13
          i32.shl
          local.get $l10
          i32.xor
          local.tee $l10
          i32.const 5
          i32.shl
          local.get $l10
          i32.xor
          i32.const 24
          i32.shr_u
          local.get $l5
          i32.xor
          i32.store8
        end
        local.get $l7
        i32.const 48
        i32.add
        local.set $l18
        i32.const 3
        local.set $l19
        i32.const 0
        local.set $l20
        i32.const 3
        local.set $l21
        i32.const 0
        local.set $l22
        loop $L9
          block $B10
            block $B11
              block $B12
                block $B13
                  local.get $l20
                  i32.eqz
                  br_if $B13
                  i32.const 0
                  local.set $l7
                  i32.const 0
                  local.get $l12
                  local.get $l20
                  i32.sub
                  local.tee $l10
                  local.get $l10
                  local.get $l12
                  i32.gt_u
                  select
                  local.set $l17
                  i32.const 0
                  local.get $l18
                  local.get $l20
                  i32.sub
                  local.tee $l10
                  local.get $l10
                  local.get $l18
                  i32.gt_u
                  select
                  local.set $l23
                  local.get $l1
                  local.get $l20
                  i32.add
                  local.set $l16
                  local.get $l0
                  i32.const 336
                  i32.add
                  local.get $l20
                  i32.add
                  local.set $l14
                  local.get $l20
                  local.set $l13
                  i32.const 0
                  local.set $l24
                  loop $L14
                    local.get $l23
                    local.set $l10
                    block $B15
                      local.get $l20
                      local.get $l18
                      i32.ge_u
                      br_if $B15
                      i32.const 0
                      local.set $l10
                      loop $L16
                        local.get $l16
                        local.get $l10
                        i32.add
                        i32.load8_u
                        local.get $l14
                        local.get $l10
                        i32.add
                        i32.load8_u
                        i32.ne
                        br_if $B15
                        local.get $l17
                        local.get $l10
                        i32.const 1
                        i32.add
                        local.tee $l10
                        i32.ne
                        br_if $L16
                      end
                      local.get $l23
                      local.set $l10
                    end
                    local.get $l10
                    local.get $l7
                    local.get $l10
                    i32.const 2
                    i32.gt_u
                    local.get $l10
                    local.get $l7
                    i32.gt_u
                    i32.and
                    local.tee $l25
                    select
                    local.set $l7
                    local.get $l20
                    local.get $l13
                    i32.const -1
                    i32.add
                    local.tee $l13
                    i32.sub
                    local.get $l24
                    local.get $l25
                    select
                    local.set $l24
                    local.get $l16
                    i32.const -1
                    i32.add
                    local.set $l16
                    local.get $l13
                    br_if $L14
                  end
                  local.get $l7
                  i32.const 3
                  i32.lt_u
                  br_if $B13
                  block $B17
                    local.get $l7
                    i32.const 3
                    i32.ne
                    br_if $B17
                    i32.const 0
                    local.set $l13
                    br $B12
                  end
                  block $B18
                    local.get $l7
                    i32.const 5
                    i32.ge_u
                    br_if $B18
                    i32.const 1
                    local.set $l13
                    br $B12
                  end
                  block $B19
                    local.get $l7
                    i32.const 5
                    i32.ne
                    br_if $B19
                    i32.const 2
                    local.set $l13
                    br $B12
                  end
                  block $B20
                    local.get $l7
                    i32.const 7
                    i32.ge_u
                    br_if $B20
                    i32.const 3
                    local.set $l13
                    br $B12
                  end
                  block $B21
                    local.get $l7
                    i32.const 7
                    i32.ne
                    br_if $B21
                    i32.const 4
                    local.set $l13
                    br $B12
                  end
                  block $B22
                    local.get $l7
                    i32.const 9
                    i32.ge_u
                    br_if $B22
                    i32.const 5
                    local.set $l13
                    br $B12
                  end
                  block $B23
                    local.get $l7
                    i32.const 9
                    i32.ne
                    br_if $B23
                    i32.const 6
                    local.set $l13
                    br $B12
                  end
                  block $B24
                    local.get $l7
                    i32.const 11
                    i32.ge_u
                    br_if $B24
                    i32.const 7
                    local.set $l13
                    br $B12
                  end
                  block $B25
                    local.get $l7
                    i32.const 13
                    i32.ge_u
                    br_if $B25
                    i32.const 8
                    local.set $l13
                    br $B12
                  end
                  block $B26
                    local.get $l7
                    i32.const 15
                    i32.ge_u
                    br_if $B26
                    i32.const 9
                    local.set $l13
                    br $B12
                  end
                  block $B27
                    local.get $l7
                    i32.const 17
                    i32.ge_u
                    br_if $B27
                    i32.const 10
                    local.set $l13
                    br $B12
                  end
                  block $B28
                    local.get $l7
                    i32.const 19
                    i32.ge_u
                    br_if $B28
                    i32.const 11
                    local.set $l13
                    br $B12
                  end
                  block $B29
                    local.get $l7
                    i32.const 23
                    i32.ge_u
                    br_if $B29
                    i32.const 12
                    local.set $l13
                    br $B12
                  end
                  block $B30
                    local.get $l7
                    i32.const 27
                    i32.ge_u
                    br_if $B30
                    i32.const 13
                    local.set $l13
                    br $B12
                  end
                  block $B31
                    local.get $l7
                    i32.const 31
                    i32.ge_u
                    br_if $B31
                    i32.const 14
                    local.set $l13
                    br $B12
                  end
                  block $B32
                    local.get $l7
                    i32.const 35
                    i32.ge_u
                    br_if $B32
                    i32.const 15
                    local.set $l13
                    br $B12
                  end
                  block $B33
                    local.get $l7
                    i32.const 43
                    i32.ge_u
                    br_if $B33
                    i32.const 16
                    local.set $l13
                    br $B12
                  end
                  block $B34
                    local.get $l7
                    i32.const 51
                    i32.ge_u
                    br_if $B34
                    i32.const 17
                    local.set $l13
                    br $B12
                  end
                  block $B35
                    local.get $l7
                    i32.const 59
                    i32.ge_u
                    br_if $B35
                    i32.const 18
                    local.set $l13
                    br $B12
                  end
                  block $B36
                    local.get $l7
                    i32.const 67
                    i32.ge_u
                    br_if $B36
                    i32.const 19
                    local.set $l13
                    br $B12
                  end
                  block $B37
                    local.get $l7
                    i32.const 83
                    i32.ge_u
                    br_if $B37
                    i32.const 20
                    local.set $l13
                    br $B12
                  end
                  block $B38
                    local.get $l7
                    i32.const 99
                    i32.ge_u
                    br_if $B38
                    i32.const 21
                    local.set $l13
                    br $B12
                  end
                  block $B39
                    local.get $l7
                    i32.const 115
                    i32.ge_u
                    br_if $B39
                    i32.const 22
                    local.set $l13
                    br $B12
                  end
                  block $B40
                    block $B41
                      local.get $l7
                      i32.const 131
                      i32.ge_u
                      br_if $B41
                      i32.const 23
                      local.set $l13
                      br $B40
                    end
                    block $B42
                      local.get $l7
                      i32.const 163
                      i32.ge_u
                      br_if $B42
                      i32.const 24
                      local.set $l13
                      br $B40
                    end
                    block $B43
                      local.get $l7
                      i32.const 195
                      i32.ge_u
                      br_if $B43
                      i32.const 25
                      local.set $l13
                      br $B40
                    end
                    block $B44
                      local.get $l7
                      i32.const 227
                      i32.ge_u
                      br_if $B44
                      i32.const 26
                      local.set $l13
                      br $B40
                    end
                    i32.const 28
                    i32.const 27
                    local.get $l7
                    i32.const 258
                    i32.gt_u
                    select
                    local.set $l13
                  end
                  i32.const 8
                  local.set $l14
                  local.get $l13
                  i32.const 1
                  i32.add
                  i32.const 8
                  i32.rotr
                  local.tee $l10
                  i32.const 5
                  i32.shl
                  i32.const 1073741824
                  i32.and
                  local.get $l10
                  i32.const 2
                  i32.shl
                  i32.const 268435456
                  i32.and
                  local.get $l10
                  i32.const 4
                  i32.shr_u
                  i32.const 50331648
                  i32.and
                  local.get $l10
                  i32.const 4
                  i32.shl
                  i32.or
                  i32.const 2
                  i32.shl
                  i32.or
                  i32.const 1342177280
                  i32.and
                  i32.const 1
                  i32.shl
                  i32.or
                  i32.const 24
                  i32.shr_u
                  i32.const 3
                  i32.or
                  local.set $l10
                  br $B11
                end
                block $B45
                  block $B46
                    local.get $l0
                    i32.const 336
                    i32.add
                    local.get $l20
                    i32.add
                    i32.load8_u
                    local.tee $l10
                    i32.const 143
                    i32.gt_u
                    br_if $B46
                    i32.const 8
                    local.set $l14
                    local.get $l10
                    i32.const 48
                    i32.add
                    local.tee $l16
                    i32.const 5
                    i32.shr_u
                    local.tee $l17
                    i32.const 2
                    i32.and
                    local.get $l16
                    i32.const 7
                    i32.shr_u
                    i32.add
                    local.get $l10
                    i32.const 3
                    i32.shl
                    i32.const 8
                    i32.and
                    local.get $l10
                    i32.const 1
                    i32.shl
                    i32.const 4
                    i32.and
                    i32.or
                    local.get $l10
                    i32.const 1
                    i32.shr_u
                    i32.const 2
                    i32.and
                    i32.or
                    local.get $l10
                    i32.const 8
                    i32.and
                    i32.const 3
                    i32.shr_u
                    i32.or
                    i32.const 2
                    i32.shl
                    local.get $l16
                    i32.const 3
                    i32.shr_u
                    i32.const 2
                    i32.and
                    i32.or
                    local.get $l17
                    i32.const 1
                    i32.and
                    i32.or
                    i32.const 2
                    i32.shl
                    i32.add
                    local.set $l10
                    br $B45
                  end
                  local.get $l10
                  i32.const 8
                  i32.rotr
                  local.tee $l10
                  i32.const 4
                  i32.shr_u
                  i32.const 251658240
                  i32.and
                  local.get $l10
                  i32.const 4
                  i32.shl
                  i32.or
                  local.tee $l10
                  i32.const 2
                  i32.shr_u
                  i32.const 855638016
                  i32.and
                  local.get $l10
                  i32.const 855638016
                  i32.and
                  i32.const 2
                  i32.shl
                  i32.or
                  local.tee $l10
                  i32.const 1
                  i32.shr_u
                  i32.const 1409286144
                  i32.and
                  local.get $l10
                  i32.const 1426063360
                  i32.and
                  i32.const 1
                  i32.shl
                  i32.or
                  i32.const 23
                  i32.shr_u
                  i32.const 3
                  i32.or
                  local.set $l10
                  i32.const 9
                  local.set $l14
                end
                local.get $l10
                local.get $l21
                i32.shl
                local.get $l19
                i32.or
                local.set $l19
                i32.const 1
                local.set $l7
                local.get $l0
                i32.const 76
                i32.add
                local.set $l16
                block $B47
                  local.get $l14
                  local.get $l21
                  i32.add
                  local.tee $l21
                  i32.const 8
                  i32.ge_u
                  br_if $B47
                  i32.const 1
                  local.set $l14
                  br $B10
                end
                local.get $l22
                i32.const 256
                local.get $l22
                i32.const 256
                i32.gt_u
                select
                local.set $l10
                loop $L48
                  block $B49
                    local.get $l10
                    local.get $l22
                    i32.ne
                    br_if $B49
                    i32.const 0
                    local.set $l14
                    local.get $l10
                    local.set $l22
                    br $B10
                  end
                  local.get $l0
                  i32.const 80
                  i32.add
                  local.get $l22
                  i32.add
                  local.get $l19
                  i32.store8
                  local.get $l19
                  i32.const 8
                  i32.shr_u
                  local.set $l19
                  i32.const 1
                  local.set $l14
                  local.get $l22
                  i32.const 1
                  i32.add
                  local.set $l22
                  local.get $l21
                  i32.const -8
                  i32.add
                  local.tee $l21
                  i32.const 7
                  i32.gt_u
                  br_if $L48
                end
                i32.const 1
                local.set $l7
                br $B10
              end
              local.get $l13
              i32.const 1
              i32.add
              local.tee $l10
              i32.const 3
              i32.shl
              i32.const 8
              i32.and
              local.get $l10
              i32.const 1
              i32.shl
              i32.const 4
              i32.and
              i32.or
              local.get $l10
              i32.const 1
              i32.shr_u
              i32.const 2
              i32.and
              i32.or
              local.get $l10
              i32.const 8
              i32.and
              i32.const 3
              i32.shr_u
              i32.or
              i32.const 3
              i32.shl
              local.get $l10
              i32.const 2
              i32.shr_u
              i32.const 12
              i32.and
              i32.or
              local.set $l10
              i32.const 7
              local.set $l14
            end
            local.get $l10
            local.get $l21
            i32.shl
            local.get $l19
            i32.or
            local.set $l16
            block $B50
              block $B51
                local.get $l14
                local.get $l21
                i32.add
                local.tee $l17
                i32.const 8
                i32.ge_u
                br_if $B51
                i32.const 1
                local.set $l14
                br $B50
              end
              local.get $l22
              i32.const 256
              local.get $l22
              i32.const 256
              i32.gt_u
              select
              local.set $l10
              loop $L52
                block $B53
                  local.get $l10
                  local.get $l22
                  i32.ne
                  br_if $B53
                  i32.const 0
                  local.set $l14
                  local.get $l10
                  local.set $l22
                  br $B50
                end
                local.get $l0
                i32.const 80
                i32.add
                local.get $l22
                i32.add
                local.get $l16
                i32.store8
                local.get $l16
                i32.const 8
                i32.shr_u
                local.set $l16
                i32.const 1
                local.set $l14
                local.get $l22
                i32.const 1
                i32.add
                local.set $l22
                local.get $l17
                i32.const -8
                i32.add
                local.tee $l17
                i32.const 7
                i32.gt_u
                br_if $L52
              end
            end
            block $B54
              block $B55
                local.get $l13
                i32.const -28
                i32.add
                i32.const -20
                i32.lt_u
                br_if $B55
                local.get $l7
                local.get $l13
                i32.const 1
                i32.shl
                i32.load16_u offset=65728
                i32.sub
                local.get $l17
                i32.shl
                local.get $l16
                i32.or
                local.set $l16
                local.get $l17
                local.get $l13
                i32.load8_u offset=65792
                i32.add
                local.tee $l17
                i32.const 8
                i32.lt_u
                br_if $B55
                local.get $l22
                i32.const 256
                local.get $l22
                i32.const 256
                i32.gt_u
                select
                local.set $l10
                loop $L56
                  block $B57
                    local.get $l10
                    local.get $l22
                    i32.ne
                    br_if $B57
                    i32.const 0
                    local.set $l14
                    br $B54
                  end
                  local.get $l0
                  i32.const 80
                  i32.add
                  local.get $l22
                  i32.add
                  local.get $l16
                  i32.store8
                  local.get $l16
                  i32.const 8
                  i32.shr_u
                  local.set $l16
                  local.get $l22
                  i32.const 1
                  i32.add
                  local.set $l22
                  local.get $l17
                  i32.const -8
                  i32.add
                  local.tee $l17
                  i32.const 7
                  i32.gt_u
                  br_if $L56
                end
              end
              local.get $l22
              local.set $l10
            end
            block $B58
              block $B59
                local.get $l24
                i32.const 2
                i32.ge_u
                br_if $B59
                i32.const 0
                local.set $l13
                i32.const 1
                local.set $l22
                br $B58
              end
              i32.const 1
              local.set $l22
              i32.const 1
              local.set $l13
              local.get $l24
              i32.const 2
              i32.eq
              br_if $B58
              i32.const 1
              local.set $l22
              block $B60
                local.get $l24
                i32.const 4
                i32.ge_u
                br_if $B60
                i32.const 2
                local.set $l13
                br $B58
              end
              block $B61
                local.get $l24
                i32.const 4
                i32.ne
                br_if $B61
                i32.const 3
                local.set $l13
                br $B58
              end
              i32.const 0
              local.set $l22
              block $B62
                local.get $l24
                i32.const 7
                i32.ge_u
                br_if $B62
                i32.const 4
                local.set $l13
                br $B58
              end
              block $B63
                local.get $l24
                i32.const 9
                i32.ge_u
                br_if $B63
                i32.const 5
                local.set $l13
                br $B58
              end
              block $B64
                local.get $l24
                i32.const 13
                i32.ge_u
                br_if $B64
                i32.const 6
                local.set $l13
                br $B58
              end
              block $B65
                local.get $l24
                i32.const 17
                i32.ge_u
                br_if $B65
                i32.const 7
                local.set $l13
                br $B58
              end
              block $B66
                local.get $l24
                i32.const 25
                i32.ge_u
                br_if $B66
                i32.const 8
                local.set $l13
                br $B58
              end
              block $B67
                local.get $l24
                i32.const 33
                i32.ge_u
                br_if $B67
                i32.const 9
                local.set $l13
                br $B58
              end
              block $B68
                local.get $l24
                i32.const 49
                i32.ge_u
                br_if $B68
                i32.const 10
                local.set $l13
                br $B58
              end
              block $B69
                local.get $l24
                i32.const 65
                i32.ge_u
                br_if $B69
                i32.const 11
                local.set $l13
                br $B58
              end
              block $B70
                local.get $l24
                i32.const 97
                i32.ge_u
                br_if $B70
                i32.const 12
                local.set $l13
                br $B58
              end
              block $B71
                local.get $l24
                i32.const 129
                i32.ge_u
                br_if $B71
                i32.const 13
                local.set $l13
                br $B58
              end
              block $B72
                local.get $l24
                i32.const 193
                i32.ge_u
                br_if $B72
                i32.const 14
                local.set $l13
                br $B58
              end
              block $B73
                local.get $l24
                i32.const 257
                i32.ge_u
                br_if $B73
                i32.const 15
                local.set $l13
                br $B58
              end
              block $B74
                local.get $l24
                i32.const 385
                i32.ge_u
                br_if $B74
                i32.const 16
                local.set $l13
                br $B58
              end
              block $B75
                local.get $l24
                i32.const 513
                i32.ge_u
                br_if $B75
                i32.const 17
                local.set $l13
                br $B58
              end
              block $B76
                local.get $l24
                i32.const 769
                i32.ge_u
                br_if $B76
                i32.const 18
                local.set $l13
                br $B58
              end
              block $B77
                local.get $l24
                i32.const 1025
                i32.ge_u
                br_if $B77
                i32.const 19
                local.set $l13
                br $B58
              end
              block $B78
                local.get $l24
                i32.const 1537
                i32.ge_u
                br_if $B78
                i32.const 20
                local.set $l13
                br $B58
              end
              block $B79
                local.get $l24
                i32.const 2049
                i32.ge_u
                br_if $B79
                i32.const 21
                local.set $l13
                br $B58
              end
              block $B80
                local.get $l24
                i32.const 3073
                i32.ge_u
                br_if $B80
                i32.const 22
                local.set $l13
                br $B58
              end
              block $B81
                local.get $l24
                i32.const 4097
                i32.ge_u
                br_if $B81
                i32.const 23
                local.set $l13
                br $B58
              end
              block $B82
                local.get $l24
                i32.const 6145
                i32.ge_u
                br_if $B82
                i32.const 24
                local.set $l13
                br $B58
              end
              block $B83
                local.get $l24
                i32.const 8193
                i32.ge_u
                br_if $B83
                i32.const 25
                local.set $l13
                br $B58
              end
              block $B84
                local.get $l24
                i32.const 12289
                i32.ge_u
                br_if $B84
                i32.const 26
                local.set $l13
                br $B58
              end
              block $B85
                local.get $l24
                i32.const 16385
                i32.ge_u
                br_if $B85
                i32.const 27
                local.set $l13
                br $B58
              end
              i32.const 28
              i32.const 29
              local.get $l24
              i32.const 24577
              i32.lt_u
              select
              local.set $l13
            end
            local.get $l13
            i32.const 3
            i32.shl
            i32.const 8
            i32.and
            local.get $l13
            i32.const 1
            i32.shl
            local.tee $l25
            i32.const 4
            i32.and
            i32.or
            local.get $l13
            i32.const 1
            i32.shr_u
            i32.const 2
            i32.and
            i32.or
            local.get $l13
            i32.const 8
            i32.and
            i32.const 3
            i32.shr_u
            i32.or
            i32.const 1
            i32.shl
            local.get $l13
            i32.const 4
            i32.shr_u
            i32.or
            local.get $l17
            i32.shl
            local.get $l16
            i32.or
            local.set $l19
            block $B86
              block $B87
                local.get $l17
                i32.const 5
                i32.add
                local.tee $l21
                i32.const 8
                i32.lt_u
                br_if $B87
                local.get $l10
                i32.const 256
                local.get $l10
                i32.const 256
                i32.gt_u
                select
                local.set $l16
                loop $L88
                  block $B89
                    local.get $l16
                    local.get $l10
                    i32.ne
                    br_if $B89
                    i32.const 0
                    local.set $l14
                    br $B86
                  end
                  local.get $l0
                  i32.const 80
                  i32.add
                  local.get $l10
                  i32.add
                  local.get $l19
                  i32.store8
                  local.get $l19
                  i32.const 8
                  i32.shr_u
                  local.set $l19
                  local.get $l10
                  i32.const 1
                  i32.add
                  local.set $l10
                  local.get $l21
                  i32.const -8
                  i32.add
                  local.tee $l21
                  i32.const 7
                  i32.gt_u
                  br_if $L88
                end
              end
              local.get $l10
              local.set $l16
            end
            block $B90
              block $B91
                local.get $l22
                br_if $B91
                local.get $l24
                local.get $l25
                i32.load16_u offset=65824
                i32.sub
                local.get $l21
                i32.shl
                local.get $l19
                i32.or
                local.set $l19
                local.get $l21
                local.get $l13
                i32.load8_u offset=65888
                i32.add
                local.tee $l21
                i32.const 8
                i32.lt_u
                br_if $B91
                local.get $l16
                i32.const 256
                local.get $l16
                i32.const 256
                i32.gt_u
                select
                local.set $l22
                loop $L92
                  block $B93
                    local.get $l22
                    local.get $l16
                    i32.ne
                    br_if $B93
                    i32.const 0
                    local.set $l14
                    br $B90
                  end
                  local.get $l0
                  i32.const 80
                  i32.add
                  local.get $l16
                  i32.add
                  local.get $l19
                  i32.store8
                  local.get $l19
                  i32.const 8
                  i32.shr_u
                  local.set $l19
                  local.get $l16
                  i32.const 1
                  i32.add
                  local.set $l16
                  local.get $l21
                  i32.const -8
                  i32.add
                  local.tee $l21
                  i32.const 7
                  i32.gt_u
                  br_if $L92
                end
              end
              local.get $l16
              local.set $l22
            end
            local.get $l6
            i32.const 1
            i32.add
            local.set $l6
            local.get $l0
            i32.const 72
            i32.add
            local.set $l16
          end
          local.get $l16
          local.get $l16
          i32.load
          local.get $l7
          i32.add
          i32.store
          block $B94
            local.get $l7
            local.get $l20
            i32.add
            local.tee $l20
            local.get $l18
            i32.ge_u
            br_if $B94
            local.get $l14
            br_if $L9
          end
        end
        block $B95
          block $B96
            block $B97
              local.get $l21
              i32.const 7
              i32.add
              local.tee $l10
              i32.const 8
              i32.lt_u
              br_if $B97
              local.get $l22
              i32.const 256
              local.get $l22
              i32.const 256
              i32.gt_u
              select
              local.set $l16
              loop $L98
                local.get $l16
                local.get $l22
                i32.eq
                br_if $B96
                local.get $l0
                i32.const 80
                i32.add
                local.get $l22
                i32.add
                local.get $l19
                i32.store8
                local.get $l19
                i32.const 8
                i32.shr_u
                local.set $l19
                local.get $l22
                i32.const 1
                i32.add
                local.set $l22
                local.get $l10
                i32.const -8
                i32.add
                local.tee $l10
                i32.const 7
                i32.gt_u
                br_if $L98
              end
            end
            block $B99
              local.get $l10
              i32.eqz
              br_if $B99
              local.get $l14
              i32.eqz
              br_if $B99
              local.get $l22
              i32.const 255
              i32.gt_u
              br_if $B95
              local.get $l0
              i32.const 80
              i32.add
              local.get $l22
              i32.add
              local.get $l19
              i32.store8
              local.get $l22
              i32.const 1
              i32.add
              local.set $l22
              br $B95
            end
            local.get $l14
            br_if $B95
          end
          i32.const 0
          local.set $l22
        end
        block $B100
          block $B101
            block $B102
              local.get $l9
              i32.const 1
              i32.ne
              br_if $B102
              i32.const -1
              local.set $l10
              i32.const 0
              local.set $l16
              br $B101
            end
            local.get $l9
            i32.const 1
            i32.and
            local.set $l17
            i32.const -1
            local.set $l10
            i32.const 0
            local.set $l16
            loop $L103
              local.get $l0
              i32.const 336
              i32.add
              local.get $l16
              i32.add
              local.tee $l14
              i32.const 1
              i32.add
              i32.load8_u
              local.get $l14
              i32.load8_u
              local.get $l10
              i32.xor
              i32.const 255
              i32.and
              i32.const 2
              i32.shl
              i32.load offset=65920
              local.get $l10
              i32.const 8
              i32.shr_u
              i32.xor
              local.tee $l10
              i32.xor
              i32.const 255
              i32.and
              i32.const 2
              i32.shl
              i32.load offset=65920
              local.get $l10
              i32.const 8
              i32.shr_u
              i32.xor
              local.set $l10
              local.get $l11
              local.get $l16
              i32.const 2
              i32.add
              local.tee $l16
              i32.ne
              br_if $L103
            end
            local.get $l17
            i32.eqz
            br_if $B100
          end
          local.get $l0
          i32.const 336
          i32.add
          local.get $l16
          i32.add
          i32.load8_u
          local.get $l10
          i32.xor
          i32.const 255
          i32.and
          i32.const 2
          i32.shl
          i32.load offset=65920
          local.get $l10
          i32.const 8
          i32.shr_u
          i32.xor
          local.set $l10
        end
        block $B104
          local.get $l22
          br_if $B104
          i32.const 1
          local.set $l13
          br $B0
        end
        i32.const 2
        local.set $l13
        local.get $l5
        i32.const 2
        i32.shl
        local.tee $l16
        local.get $l18
        i32.store offset=5254880
        local.get $l16
        local.get $l22
        i32.store offset=5250880
        local.get $l16
        local.get $l10
        i32.const -1
        i32.xor
        local.tee $l10
        i32.store offset=5246880
        local.get $l16
        local.get $l8
        i32.store offset=5242880
        local.get $l5
        i32.const 1
        i32.shl
        local.get $l15
        i32.store16 offset=5258880
        local.get $l8
        i32.const 1048572
        i32.gt_u
        br_if $B0
        local.get $l8
        i32.const 67324752
        i32.store offset=1048576 align=1
        local.get $l8
        i32.const 1048570
        i32.gt_u
        br_if $B0
        local.get $l8
        i32.const 20
        i32.store16 offset=1048580 align=1
        local.get $l8
        i32.const 1048568
        i32.gt_u
        br_if $B0
        local.get $l8
        i32.const 2048
        i32.store16 offset=1048582 align=1
        local.get $l8
        i32.const 1048566
        i32.gt_u
        br_if $B0
        local.get $l8
        i32.const 8
        i32.store16 offset=1048584 align=1
        local.get $l8
        i32.const 1048564
        i32.gt_u
        br_if $B0
        local.get $l8
        i32.const 0
        i32.store16 offset=1048586 align=1
        local.get $l8
        i32.const 1048562
        i32.gt_u
        br_if $B0
        local.get $l8
        i32.const 33
        i32.store16 offset=1048588 align=1
        local.get $l8
        i32.const 1048558
        i32.gt_u
        br_if $B0
        local.get $l8
        local.get $l10
        i32.store offset=1048590 align=1
        local.get $l8
        i32.const 1048554
        i32.gt_u
        br_if $B0
        local.get $l8
        local.get $l22
        i32.store offset=1048594 align=1
        local.get $l8
        i32.const 1048550
        i32.gt_u
        br_if $B0
        local.get $l8
        local.get $l18
        i32.store offset=1048598 align=1
        local.get $l8
        i32.const 1048548
        i32.gt_u
        br_if $B0
        local.get $l8
        local.get $l15
        i32.store16 offset=1048602 align=1
        local.get $l8
        i32.const 1048546
        i32.gt_u
        br_if $B0
        local.get $l8
        i32.const 0
        i32.store16 offset=1048604 align=1
        local.get $l8
        local.get $l15
        i32.add
        local.tee $l20
        i32.const 30
        i32.add
        local.tee $l7
        i32.const 1048576
        i32.gt_u
        br_if $B0
        block $B105
          local.get $l15
          i32.eqz
          br_if $B105
          local.get $l15
          i32.const 3
          i32.and
          local.set $l14
          i32.const 0
          local.set $l16
          block $B106
            local.get $l15
            i32.const 4
            i32.lt_u
            br_if $B106
            local.get $l8
            i32.const 1048576
            i32.add
            local.set $l10
            local.get $l15
            i32.const -4
            i32.and
            local.set $l17
            i32.const 0
            local.set $l16
            loop $L107
              local.get $l10
              local.get $l16
              i32.add
              i32.const 30
              i32.add
              local.get $l0
              i32.const 528
              i32.add
              local.get $l16
              i32.add
              i32.load
              i32.store align=1
              local.get $l17
              local.get $l16
              i32.const 4
              i32.add
              local.tee $l16
              i32.ne
              br_if $L107
            end
            local.get $l14
            i32.eqz
            br_if $B105
          end
          local.get $l16
          local.get $l8
          i32.add
          i32.const 1048606
          i32.add
          local.set $l10
          local.get $l0
          i32.const 528
          i32.add
          local.get $l16
          i32.add
          local.set $l16
          loop $L108
            local.get $l10
            local.get $l16
            i32.load8_u
            i32.store8
            local.get $l16
            i32.const 1
            i32.add
            local.set $l16
            local.get $l10
            i32.const 1
            i32.add
            local.set $l10
            local.get $l14
            i32.const -1
            i32.add
            local.tee $l14
            br_if $L108
          end
        end
        local.get $l22
        local.get $l7
        i32.add
        local.tee $l7
        i32.const 1048576
        i32.gt_u
        br_if $B0
        local.get $l22
        i32.const 3
        i32.and
        local.set $l14
        i32.const 0
        local.set $l16
        block $B109
          block $B110
            local.get $l22
            i32.const 4
            i32.lt_u
            br_if $B110
            local.get $l22
            i32.const -4
            i32.and
            local.set $l10
            local.get $l20
            i32.const 1048576
            i32.add
            local.set $l17
            i32.const 0
            local.set $l16
            loop $L111
              local.get $l17
              local.get $l16
              i32.add
              i32.const 30
              i32.add
              local.get $l0
              i32.const 80
              i32.add
              local.get $l16
              i32.add
              i32.load
              i32.store align=1
              local.get $l10
              local.get $l16
              i32.const 4
              i32.add
              local.tee $l16
              i32.ne
              br_if $L111
            end
            local.get $l14
            i32.eqz
            br_if $B109
          end
          local.get $l15
          local.get $l16
          i32.add
          local.get $l8
          i32.add
          i32.const 1048606
          i32.add
          local.set $l10
          local.get $l0
          i32.const 80
          i32.add
          local.get $l16
          i32.add
          local.set $l16
          loop $L112
            local.get $l10
            local.get $l16
            i32.load8_u
            i32.store8
            local.get $l16
            i32.const 1
            i32.add
            local.set $l16
            local.get $l10
            i32.const 1
            i32.add
            local.set $l10
            local.get $l14
            i32.const -1
            i32.add
            local.tee $l14
            br_if $L112
          end
        end
        local.get $l2
        i32.const 1
        i32.add
        local.set $l2
        local.get $l3
        i32.const 1
        i32.add
        local.set $l3
        local.get $l4
        local.get $l18
        i32.add
        local.set $l4
        local.get $l5
        i32.const 1
        i32.add
        local.tee $l5
        i32.const 1000
        i32.ne
        br_if $L1
      end
      i32.const 3
      local.set $l13
      i32.const 0
      local.set $l24
      local.get $l7
      local.set $l22
      loop $L113
        local.get $l24
        local.get $l0
        i32.const 528
        i32.add
        call $path_for
        local.set $l20
        local.get $l22
        local.tee $l10
        i32.const 1048572
        i32.gt_u
        br_if $B0
        local.get $l10
        i32.const 1048576
        i32.add
        local.tee $l17
        i32.const 33639248
        i32.store align=1
        local.get $l10
        i32.const 1048570
        i32.gt_u
        br_if $B0
        local.get $l10
        i32.const 1048580
        i32.add
        i32.const 788
        i32.store16 align=1
        local.get $l10
        i32.const 1048568
        i32.gt_u
        br_if $B0
        local.get $l10
        i32.const 1048582
        i32.add
        i32.const 20
        i32.store16 align=1
        local.get $l10
        i32.const 1048566
        i32.gt_u
        br_if $B0
        local.get $l10
        i32.const 1048584
        i32.add
        i32.const 2048
        i32.store16 align=1
        local.get $l10
        i32.const 1048564
        i32.gt_u
        br_if $B0
        local.get $l10
        i32.const 1048586
        i32.add
        i32.const 8
        i32.store16 align=1
        local.get $l10
        i32.const 1048562
        i32.gt_u
        br_if $B0
        local.get $l10
        i32.const 1048588
        i32.add
        i32.const 0
        i32.store16 align=1
        local.get $l10
        i32.const 1048560
        i32.gt_u
        br_if $B0
        local.get $l10
        i32.const 1048590
        i32.add
        i32.const 33
        i32.store16 align=1
        local.get $l10
        i32.const 1048556
        i32.gt_u
        br_if $B0
        local.get $l10
        i32.const 1048592
        i32.add
        local.get $l24
        i32.const 2
        i32.shl
        local.tee $l16
        i32.load offset=5246880
        i32.store align=1
        local.get $l10
        i32.const 1048552
        i32.gt_u
        br_if $B0
        local.get $l10
        i32.const 1048596
        i32.add
        local.get $l16
        i32.load offset=5250880
        i32.store align=1
        local.get $l10
        i32.const 1048548
        i32.gt_u
        br_if $B0
        local.get $l10
        i32.const 1048600
        i32.add
        local.get $l16
        i32.load offset=5254880
        i32.store align=1
        local.get $l10
        i32.const 1048546
        i32.gt_u
        br_if $B0
        local.get $l10
        i32.const 1048604
        i32.add
        local.get $l20
        i32.store16 align=1
        local.get $l10
        i32.const 1048544
        i32.gt_u
        br_if $B0
        local.get $l10
        i32.const 1048606
        i32.add
        i32.const 0
        i32.store16 align=1
        local.get $l10
        i32.const 1048542
        i32.gt_u
        br_if $B0
        local.get $l10
        i32.const 1048608
        i32.add
        i32.const 0
        i32.store16 align=1
        local.get $l10
        i32.const 1048540
        i32.gt_u
        br_if $B0
        local.get $l10
        i32.const 1048610
        i32.add
        i32.const 0
        i32.store16 align=1
        local.get $l10
        i32.const 1048538
        i32.gt_u
        br_if $B0
        local.get $l10
        i32.const 1048612
        i32.add
        i32.const 0
        i32.store16 align=1
        local.get $l10
        i32.const 1048534
        i32.gt_u
        br_if $B0
        local.get $l10
        i32.const 1048614
        i32.add
        i32.const -2119958528
        i32.store align=1
        local.get $l10
        i32.const 1048530
        i32.gt_u
        br_if $B0
        local.get $l10
        i32.const 1048618
        i32.add
        local.get $l16
        i32.load offset=5242880
        i32.store align=1
        local.get $l10
        local.get $l20
        i32.add
        local.tee $l25
        i32.const 46
        i32.add
        local.tee $l22
        i32.const 1048576
        i32.gt_u
        br_if $B0
        block $B114
          local.get $l20
          i32.eqz
          br_if $B114
          local.get $l20
          i32.const 3
          i32.and
          local.set $l14
          i32.const 0
          local.set $l16
          block $B115
            local.get $l20
            i32.const 4
            i32.lt_u
            br_if $B115
            local.get $l20
            i32.const -4
            i32.and
            local.set $l20
            i32.const 0
            local.set $l16
            loop $L116
              local.get $l17
              local.get $l16
              i32.add
              i32.const 46
              i32.add
              local.get $l0
              i32.const 528
              i32.add
              local.get $l16
              i32.add
              i32.load
              i32.store align=1
              local.get $l20
              local.get $l16
              i32.const 4
              i32.add
              local.tee $l16
              i32.ne
              br_if $L116
            end
            local.get $l14
            i32.eqz
            br_if $B114
          end
          local.get $l10
          local.get $l16
          i32.add
          i32.const 1048622
          i32.add
          local.set $l10
          local.get $l0
          i32.const 528
          i32.add
          local.get $l16
          i32.add
          local.set $l16
          loop $L117
            local.get $l10
            local.get $l16
            i32.load8_u
            i32.store8
            local.get $l16
            i32.const 1
            i32.add
            local.set $l16
            local.get $l10
            i32.const 1
            i32.add
            local.set $l10
            local.get $l14
            i32.const -1
            i32.add
            local.tee $l14
            br_if $L117
          end
        end
        local.get $l24
        i32.const 1
        i32.add
        local.tee $l24
        i32.const 1000
        i32.ne
        br_if $L113
      end
      i32.const 4
      local.set $l13
      local.get $l22
      i32.const 1048572
      i32.gt_u
      br_if $B0
      local.get $l22
      i32.const 1048576
      i32.add
      i32.const 101010256
      i32.store align=1
      local.get $l22
      i32.const 1048570
      i32.gt_u
      br_if $B0
      local.get $l22
      i32.const 1048580
      i32.add
      i32.const 0
      i32.store16 align=1
      local.get $l22
      i32.const 1048568
      i32.gt_u
      br_if $B0
      local.get $l22
      i32.const 1048582
      i32.add
      i32.const 0
      i32.store16 align=1
      local.get $l22
      i32.const 1048566
      i32.gt_u
      br_if $B0
      local.get $l22
      i32.const 1048584
      i32.add
      i32.const 1000
      i32.store16 align=1
      local.get $l22
      i32.const 1048564
      i32.gt_u
      br_if $B0
      local.get $l22
      i32.const 1048586
      i32.add
      i32.const 1000
      i32.store16 align=1
      local.get $l22
      i32.const 1048560
      i32.gt_u
      br_if $B0
      local.get $l22
      i32.const 1048588
      i32.add
      local.get $l22
      local.get $l7
      i32.sub
      i32.store align=1
      local.get $l22
      i32.const 1048556
      i32.gt_u
      br_if $B0
      local.get $l22
      i32.const 1048592
      i32.add
      local.tee $l10
      local.get $l7
      i32.store align=1
      local.get $l22
      i32.const 1048554
      i32.gt_u
      br_if $B0
      i32.const 0
      local.set $l7
      local.get $l22
      i32.const 1048596
      i32.add
      i32.const 0
      i32.store16 align=1
      i32.const 0
      i32.const 1000
      i32.store offset=3145728
      i32.const 0
      local.get $l4
      i32.store offset=3145732
      i32.const 0
      local.get $l4
      i32.store offset=3145736
      i32.const 0
      local.get $l0
      i32.load offset=76
      i32.store offset=3145740
      i32.const 0
      local.get $l6
      i32.store offset=3145744
      i32.const 0
      local.get $l0
      i32.load offset=72
      i32.store offset=3145748
      i32.const 0
      i32.const 1000
      i32.store offset=3145752
      i32.const 0
      i32.const 1000
      i32.store offset=3145756
      i32.const 0
      i32.const 1000
      i32.store offset=3145760
      i32.const 0
      i32.const 0
      i32.store offset=3145764
      i32.const 0
      local.set $l20
      i32.const 0
      local.set $l1
      block $B118
        local.get $l22
        i32.const 1048584
        i32.add
        i32.load16_u align=1
        local.tee $l9
        i32.eqz
        br_if $B118
        local.get $l10
        i32.load align=1
        local.set $l19
        i32.const 0
        local.set $l12
        i32.const 0
        local.set $l1
        i32.const 0
        local.set $l11
        i32.const 0
        local.set $l18
        loop $L119
          local.get $l19
          i32.const 1048605
          i32.add
          i32.load8_u
          local.set $l16
          local.get $l19
          i32.load offset=1048618 align=1
          local.set $l15
          local.get $l19
          i32.load offset=1048600 align=1
          local.set $l21
          local.get $l19
          i32.load offset=1048596 align=1
          local.set $l8
          local.get $l19
          i32.load offset=1048592 align=1
          local.set $l6
          local.get $l19
          i32.load8_u offset=1048604
          local.set $l10
          local.get $l12
          local.get $l0
          call $path_for
          drop
          block $B120
            local.get $l18
            i32.const -1048575
            i32.add
            i32.const -1048577
            i32.ge_u
            br_if $B120
            i32.const 5
            local.set $l13
            br $B0
          end
          local.get $l18
          local.get $l16
          i32.store8 offset=4194305
          local.get $l18
          local.get $l10
          i32.store8 offset=4194304
          block $B121
            local.get $l18
            local.get $l16
            i32.const 8
            i32.shl
            local.tee $l14
            local.get $l10
            i32.or
            local.tee $l5
            i32.add
            i32.const 2
            i32.add
            local.tee $l23
            i32.const 1048576
            i32.le_u
            br_if $B121
            i32.const 5
            local.set $l13
            br $B0
          end
          block $B122
            local.get $l5
            i32.eqz
            br_if $B122
            local.get $l10
            i32.const 3
            i32.and
            local.set $l17
            i32.const 0
            local.set $l16
            block $B123
              local.get $l14
              local.get $l10
              i32.add
              local.tee $l10
              i32.const -1
              i32.add
              i32.const 3
              i32.lt_u
              br_if $B123
              local.get $l19
              i32.const 1048576
              i32.add
              local.set $l13
              local.get $l18
              i32.const 4194304
              i32.add
              local.set $l20
              local.get $l10
              local.get $l17
              i32.sub
              local.set $l24
              i32.const 0
              local.set $l16
              loop $L124
                local.get $l20
                local.get $l16
                i32.add
                local.tee $l10
                i32.const 2
                i32.add
                local.get $l13
                local.get $l16
                i32.add
                local.tee $l14
                i32.const 46
                i32.add
                i32.load8_u
                i32.store8
                local.get $l10
                i32.const 3
                i32.add
                local.get $l14
                i32.const 47
                i32.add
                i32.load8_u
                i32.store8
                local.get $l10
                i32.const 4
                i32.add
                local.get $l14
                i32.const 48
                i32.add
                i32.load8_u
                i32.store8
                local.get $l10
                i32.const 5
                i32.add
                local.get $l14
                i32.const 49
                i32.add
                i32.load8_u
                i32.store8
                local.get $l24
                local.get $l16
                i32.const 4
                i32.add
                local.tee $l16
                i32.ne
                br_if $L124
              end
              local.get $l17
              i32.eqz
              br_if $B122
            end
            local.get $l19
            local.get $l16
            i32.add
            i32.const 1048622
            i32.add
            local.set $l10
            local.get $l18
            local.get $l16
            i32.add
            i32.const 4194306
            i32.add
            local.set $l16
            loop $L125
              local.get $l16
              local.get $l10
              i32.load8_u
              i32.store8
              local.get $l10
              i32.const 1
              i32.add
              local.set $l10
              local.get $l16
              i32.const 1
              i32.add
              local.set $l16
              local.get $l17
              i32.const -1
              i32.add
              local.tee $l17
              br_if $L125
            end
          end
          block $B126
            local.get $l23
            i32.const 1048572
            i32.le_u
            br_if $B126
            i32.const 5
            local.set $l13
            br $B0
          end
          local.get $l23
          local.get $l21
          i32.store offset=4194304 align=1
          block $B127
            local.get $l23
            i32.const 1048568
            i32.le_u
            br_if $B127
            i32.const 5
            local.set $l13
            br $B0
          end
          local.get $l23
          local.get $l8
          i32.store offset=4194308 align=1
          block $B128
            local.get $l23
            i32.const 1048564
            i32.le_u
            br_if $B128
            i32.const 5
            local.set $l13
            br $B0
          end
          local.get $l23
          local.get $l6
          i32.store offset=4194312 align=1
          block $B129
            block $B130
              local.get $l12
              call $selected_slot
              i32.const 0
              i32.ge_s
              br_if $B130
              local.get $l11
              local.set $l20
              br $B129
            end
            block $B131
              local.get $l15
              local.get $l5
              i32.add
              i32.const 1048606
              i32.add
              local.get $l8
              local.get $l0
              i32.const 336
              i32.add
              local.get $l21
              call $inflate_fixed
              br_if $B131
              i32.const 6
              local.set $l13
              br $B0
            end
            i32.const 7
            local.set $l13
            local.get $l11
            i32.const 1048572
            i32.gt_u
            br_if $B0
            local.get $l11
            i32.const 2097152
            i32.add
            local.tee $l10
            local.get $l12
            i32.store align=1
            local.get $l11
            i32.const 1048568
            i32.gt_u
            br_if $B0
            local.get $l11
            i32.const 2097156
            i32.add
            local.get $l21
            i32.store align=1
            local.get $l11
            local.get $l21
            i32.add
            i32.const 8
            i32.add
            local.tee $l20
            i32.const 1048576
            i32.gt_u
            br_if $B0
            block $B132
              local.get $l21
              i32.eqz
              br_if $B132
              local.get $l21
              i32.const 3
              i32.and
              local.set $l14
              i32.const 0
              local.set $l16
              block $B133
                local.get $l21
                i32.const 4
                i32.lt_u
                br_if $B133
                local.get $l21
                i32.const -4
                i32.and
                local.set $l17
                i32.const 0
                local.set $l16
                loop $L134
                  local.get $l10
                  local.get $l16
                  i32.add
                  i32.const 8
                  i32.add
                  local.get $l0
                  i32.const 336
                  i32.add
                  local.get $l16
                  i32.add
                  i32.load
                  i32.store align=1
                  local.get $l17
                  local.get $l16
                  i32.const 4
                  i32.add
                  local.tee $l16
                  i32.ne
                  br_if $L134
                end
                local.get $l14
                i32.eqz
                br_if $B132
              end
              local.get $l11
              local.get $l16
              i32.add
              i32.const 2097160
              i32.add
              local.set $l10
              local.get $l0
              i32.const 336
              i32.add
              local.get $l16
              i32.add
              local.set $l16
              loop $L135
                local.get $l10
                local.get $l16
                i32.load8_u
                i32.store8
                local.get $l16
                i32.const 1
                i32.add
                local.set $l16
                local.get $l10
                i32.const 1
                i32.add
                local.set $l10
                local.get $l14
                i32.const -1
                i32.add
                local.tee $l14
                br_if $L135
              end
            end
            local.get $l21
            local.get $l1
            i32.add
            local.set $l1
            local.get $l20
            local.set $l11
          end
          local.get $l23
          i32.const 12
          i32.add
          local.set $l18
          local.get $l19
          local.get $l5
          i32.add
          i32.const 46
          i32.add
          local.set $l19
          local.get $l12
          i32.const 1
          i32.add
          local.tee $l12
          local.get $l9
          i32.ne
          br_if $L119
        end
      end
      i32.const 0
      local.get $l9
      i32.store offset=3145768
      i32.const 0
      local.get $l9
      call $selected_count
      i32.store offset=3145772
      i32.const 0
      local.get $l1
      i32.store offset=3145776
      i32.const 0
      i32.const 0
      i32.store offset=3145780
      i32.const 0
      i32.const 0
      i32.store offset=3145784
      local.get $l22
      i32.const 22
      i32.add
      local.tee $l16
      i32.const 3
      i32.and
      local.set $l14
      i32.const -2128831035
      local.set $l10
      block $B136
        block $B137
          local.get $l25
          i32.const 67
          i32.add
          i32.const 3
          i32.lt_u
          br_if $B137
          local.get $l16
          i32.const 2097148
          i32.and
          local.set $l16
          i32.const -2128831035
          local.set $l10
          i32.const 0
          local.set $l7
          loop $L138
            local.get $l10
            local.get $l7
            i32.const 1048576
            i32.add
            i32.load8_u
            i32.xor
            i32.const 16777619
            i32.mul
            local.get $l7
            i32.const 1048577
            i32.add
            i32.load8_u
            i32.xor
            i32.const 16777619
            i32.mul
            local.get $l7
            i32.const 1048578
            i32.add
            i32.load8_u
            i32.xor
            i32.const 16777619
            i32.mul
            local.get $l7
            i32.const 1048579
            i32.add
            i32.load8_u
            i32.xor
            i32.const 16777619
            i32.mul
            local.set $l10
            local.get $l16
            local.get $l7
            i32.const 4
            i32.add
            local.tee $l7
            i32.ne
            br_if $L138
          end
          local.get $l14
          i32.eqz
          br_if $B136
        end
        local.get $l7
        i32.const 1048576
        i32.add
        local.set $l16
        loop $L139
          local.get $l10
          local.get $l16
          i32.load8_u
          i32.xor
          i32.const 16777619
          i32.mul
          local.set $l10
          local.get $l16
          i32.const 1
          i32.add
          local.set $l16
          local.get $l14
          i32.const -1
          i32.add
          local.tee $l14
          br_if $L139
        end
      end
      i32.const 0
      local.set $l16
      i32.const 0
      local.get $l10
      i32.store offset=3145788
      block $B140
        block $B141
          local.get $l20
          br_if $B141
          i32.const -2128831035
          local.set $l10
          br $B140
        end
        local.get $l20
        i32.const 3
        i32.and
        local.set $l14
        i32.const -2128831035
        local.set $l10
        block $B142
          local.get $l20
          i32.const 4
          i32.lt_u
          br_if $B142
          local.get $l20
          i32.const -4
          i32.and
          local.set $l17
          i32.const -2128831035
          local.set $l10
          i32.const 0
          local.set $l16
          loop $L143
            local.get $l10
            local.get $l16
            i32.const 2097152
            i32.add
            i32.load8_u
            i32.xor
            i32.const 16777619
            i32.mul
            local.get $l16
            i32.const 2097153
            i32.add
            i32.load8_u
            i32.xor
            i32.const 16777619
            i32.mul
            local.get $l16
            i32.const 2097154
            i32.add
            i32.load8_u
            i32.xor
            i32.const 16777619
            i32.mul
            local.get $l16
            i32.const 2097155
            i32.add
            i32.load8_u
            i32.xor
            i32.const 16777619
            i32.mul
            local.set $l10
            local.get $l17
            local.get $l16
            i32.const 4
            i32.add
            local.tee $l16
            i32.ne
            br_if $L143
          end
          local.get $l14
          i32.eqz
          br_if $B140
        end
        local.get $l16
        i32.const 2097152
        i32.add
        local.set $l16
        loop $L144
          local.get $l10
          local.get $l16
          i32.load8_u
          i32.xor
          i32.const 16777619
          i32.mul
          local.set $l10
          local.get $l16
          i32.const 1
          i32.add
          local.set $l16
          local.get $l14
          i32.const -1
          i32.add
          local.tee $l14
          br_if $L144
        end
      end
      i32.const 0
      local.set $l13
      i32.const 0
      local.get $l10
      i32.store offset=3145792
    end
    local.get $l0
    i32.const 592
    i32.add
    global.set $__stack_pointer
    local.get $l13)
  (func $path_for (type $t2) (param $p0 i32) (param $p1 i32) (result i32)
    (local $l2 i32) (local $l3 i32) (local $l4 i32) (local $l5 i32) (local $l6 i32) (local $l7 i32) (local $l8 i32) (local $l9 i32)
    block $B0
      block $B1
        local.get $p0
        i32.const 3
        i32.and
        local.tee $l2
        i32.const 2
        i32.shl
        i32.load offset=65664
        local.tee $l3
        i32.load8_u
        local.tee $l4
        br_if $B1
        i32.const 0
        local.set $l5
        br $B0
      end
      local.get $l3
      i32.const 1
      i32.add
      local.set $l6
      i32.const 0
      local.set $l5
      loop $L2
        local.get $p1
        local.get $l5
        local.tee $l3
        i32.add
        local.get $l4
        i32.store8
        local.get $l3
        i32.const 1
        i32.add
        local.set $l5
        local.get $l6
        local.get $l3
        i32.add
        i32.load8_u
        local.tee $l4
        br_if $L2
      end
    end
    block $B3
      block $B4
        local.get $p0
        i32.const 65535
        i32.and
        local.tee $l3
        i32.const 997
        i32.rem_u
        br_if $B4
        local.get $p1
        local.get $l5
        i32.add
        local.tee $l3
        i32.const 1717658415
        i32.store align=1
        local.get $l3
        i32.const 4
        i32.add
        i32.const 43459
        i32.store16 align=1
        local.get $l5
        i32.const 6
        i32.add
        local.set $l5
        br $B3
      end
      local.get $l3
      i32.const 991
      i32.rem_u
      br_if $B3
      local.get $p1
      local.get $l5
      i32.add
      local.tee $l3
      i32.const -1315051985
      i32.store align=1
      local.get $l3
      i32.const 6
      i32.add
      i32.const 172
      i32.store8
      local.get $l3
      i32.const 4
      i32.add
      i32.const 47844
      i32.store16 align=1
      local.get $l5
      i32.const 7
      i32.add
      local.set $l5
    end
    local.get $p1
    local.get $l5
    i32.add
    local.tee $l3
    i32.const 47
    i32.store8
    local.get $l3
    i32.const 4
    i32.add
    i32.const 47
    i32.store8
    local.get $l3
    i32.const 1
    i32.add
    local.get $p0
    i32.const 65535
    i32.and
    local.tee $l6
    i32.const 10000
    i32.div_u
    i32.const 48
    i32.or
    local.tee $l7
    i32.store8
    local.get $l3
    i32.const 3
    i32.add
    local.get $l6
    i32.const 100
    i32.div_u
    i32.const 10
    i32.rem_u
    i32.const 48
    i32.or
    local.tee $l8
    i32.store8
    local.get $l3
    i32.const 2
    i32.add
    local.get $l6
    i32.const 1000
    i32.div_u
    i32.const 10
    i32.rem_u
    i32.const 48
    i32.or
    local.tee $l9
    i32.store8
    local.get $l5
    i32.const 5
    i32.add
    local.set $l3
    block $B5
      local.get $l2
      i32.const 2
      i32.shl
      local.tee $l2
      i32.load offset=65680
      local.tee $l4
      i32.load8_u
      local.tee $l5
      i32.eqz
      br_if $B5
      local.get $l4
      i32.const 1
      i32.add
      local.set $l4
      loop $L6
        local.get $p1
        local.get $l3
        i32.add
        local.get $l5
        i32.store8
        local.get $l3
        i32.const 1
        i32.add
        local.set $l3
        local.get $l4
        i32.load8_u
        local.set $l5
        local.get $l4
        i32.const 1
        i32.add
        local.set $l4
        local.get $l5
        br_if $L6
      end
    end
    local.get $p1
    local.get $l3
    i32.add
    local.tee $l5
    i32.const 45
    i32.store8
    local.get $l5
    i32.const 6
    i32.add
    i32.const 46
    i32.store8
    local.get $l5
    i32.const 3
    i32.add
    local.get $l8
    i32.store8
    local.get $l5
    i32.const 2
    i32.add
    local.get $l9
    i32.store8
    local.get $l5
    i32.const 1
    i32.add
    local.get $l7
    i32.store8
    local.get $l5
    i32.const 4
    i32.add
    local.get $l6
    i32.const 10
    i32.div_u
    local.tee $l4
    i32.const 10
    i32.rem_u
    i32.const 48
    i32.or
    i32.store8
    local.get $l5
    i32.const 5
    i32.add
    local.get $p0
    local.get $l4
    i32.const 10
    i32.mul
    i32.sub
    i32.const 48
    i32.or
    i32.store8
    local.get $l3
    i32.const 7
    i32.add
    local.set $l3
    block $B7
      local.get $l2
      i32.load offset=65696
      local.tee $l4
      i32.load8_u
      local.tee $l5
      i32.eqz
      br_if $B7
      local.get $l4
      i32.const 1
      i32.add
      local.set $l4
      loop $L8
        local.get $p1
        local.get $l3
        i32.add
        local.get $l5
        i32.store8
        local.get $l3
        i32.const 1
        i32.add
        local.set $l3
        local.get $l4
        i32.load8_u
        local.set $l5
        local.get $l4
        i32.const 1
        i32.add
        local.set $l4
        local.get $l5
        br_if $L8
      end
    end
    local.get $l3)
  (func $selected_slot (type $t3) (param $p0 i32) (result i32)
    block $B0
      block $B1
        block $B2
          block $B3
            block $B4
              block $B5
                block $B6
                  block $B7
                    block $B8
                      block $B9
                        block $B10
                          local.get $p0
                          i32.const 4095
                          i32.gt_s
                          br_if $B10
                          block $B11
                            local.get $p0
                            br_table $B2 $B9 $B0 $B0 $B0 $B0 $B0 $B0 $B0 $B0 $B0 $B0 $B0 $B0 $B0 $B0 $B0 $B8 $B11
                          end
                          local.get $p0
                          i32.const 997
                          i32.eq
                          br_if $B7
                          local.get $p0
                          i32.const 2048
                          i32.ne
                          br_if $B0
                          i32.const 4
                          return
                        end
                        local.get $p0
                        i32.const 9997
                        i32.gt_s
                        br_if $B3
                        local.get $p0
                        i32.const 4096
                        i32.eq
                        br_if $B6
                        local.get $p0
                        i32.const 7001
                        i32.eq
                        br_if $B5
                        local.get $p0
                        i32.const 8191
                        i32.eq
                        br_if $B4
                        br $B0
                      end
                      i32.const 1
                      return
                    end
                    i32.const 2
                    return
                  end
                  i32.const 3
                  return
                end
                i32.const 5
                return
              end
              i32.const 6
              return
            end
            i32.const 7
            return
          end
          block $B12
            local.get $p0
            i32.const -9998
            i32.add
            br_table $B1 $B12 $B0
          end
          i32.const 9
          local.set $p0
        end
        local.get $p0
        return
      end
      i32.const 8
      return
    end
    i32.const -1)
  (func $inflate_fixed (type $t4) (param $p0 i32) (param $p1 i32) (param $p2 i32) (param $p3 i32) (result i32)
    (local $l4 i32) (local $l5 i32) (local $l6 i32) (local $l7 i32) (local $l8 i32) (local $l9 i32) (local $l10 i32) (local $l11 i32) (local $l12 i32) (local $l13 i32) (local $l14 i32) (local $l15 i32) (local $l16 i32)
    i32.const 0
    local.set $l4
    block $B0
      local.get $p1
      i32.eqz
      br_if $B0
      local.get $p0
      i32.load8_u
      local.tee $l5
      i32.const 7
      i32.and
      i32.const 3
      i32.ne
      br_if $B0
      local.get $l5
      i32.const 3
      i32.shr_u
      local.set $l6
      i32.const 0
      local.set $l7
      i32.const 5
      local.set $l8
      i32.const 1
      local.set $l9
      block $B1
        loop $L2
          i32.const 1
          local.set $l10
          i32.const 0
          local.set $l11
          block $B3
            block $B4
              block $B5
                loop $L6
                  block $B7
                    block $B8
                      local.get $l8
                      i32.eqz
                      br_if $B8
                      local.get $l8
                      i32.const -1
                      i32.add
                      local.set $l8
                      br $B7
                    end
                    block $B9
                      local.get $l9
                      local.get $p1
                      i32.lt_u
                      br_if $B9
                      i32.const 0
                      return
                    end
                    local.get $l6
                    local.get $p0
                    local.get $l9
                    i32.add
                    i32.load8_u
                    i32.or
                    local.set $l6
                    i32.const 7
                    local.set $l8
                    local.get $l9
                    i32.const 1
                    i32.add
                    local.set $l9
                  end
                  local.get $l6
                  i32.const 1
                  i32.and
                  local.get $l10
                  i32.const -1
                  i32.add
                  i32.shl
                  local.get $l11
                  i32.or
                  local.set $l11
                  local.get $l6
                  i32.const 1
                  i32.shr_u
                  local.set $l6
                  i32.const -288
                  local.set $l12
                  i32.const 65214
                  local.set $l13
                  block $B10
                    loop $L11
                      block $B12
                        block $B13
                          local.get $l12
                          i32.const 288
                          i32.add
                          local.tee $l5
                          i32.const 143
                          i32.gt_u
                          br_if $B13
                          i32.const 8
                          local.set $l14
                          local.get $l12
                          i32.const 336
                          i32.add
                          local.tee $l15
                          i32.const 5
                          i32.shr_u
                          local.tee $l4
                          i32.const 2
                          i32.and
                          local.get $l15
                          i32.const 7
                          i32.shr_u
                          i32.add
                          local.get $l5
                          i32.const 3
                          i32.shl
                          i32.const 8
                          i32.and
                          local.get $l5
                          i32.const 1
                          i32.shl
                          i32.const 4
                          i32.and
                          i32.or
                          local.get $l5
                          i32.const 1
                          i32.shr_u
                          i32.const 2
                          i32.and
                          i32.or
                          local.get $l5
                          i32.const 8
                          i32.and
                          i32.const 3
                          i32.shr_u
                          i32.or
                          i32.const 2
                          i32.shl
                          local.get $l15
                          i32.const 3
                          i32.shr_u
                          i32.const 2
                          i32.and
                          i32.or
                          local.get $l4
                          i32.const 1
                          i32.and
                          i32.or
                          i32.const 2
                          i32.shl
                          i32.add
                          local.set $l15
                          br $B12
                        end
                        block $B14
                          local.get $l5
                          i32.const 255
                          i32.gt_u
                          br_if $B14
                          local.get $l5
                          i32.const 16711935
                          i32.and
                          i32.const 8
                          i32.rotr
                          local.get $l5
                          i32.const 24
                          i32.rotr
                          i32.const 16711935
                          i32.and
                          i32.or
                          local.tee $l14
                          i32.const 4
                          i32.shr_u
                          i32.const 252645135
                          i32.and
                          local.get $l14
                          i32.const 252645135
                          i32.and
                          i32.const 4
                          i32.shl
                          i32.or
                          local.tee $l14
                          i32.const 2
                          i32.shr_u
                          i32.const 858993459
                          i32.and
                          local.get $l14
                          i32.const 858993459
                          i32.and
                          i32.const 2
                          i32.shl
                          i32.or
                          local.tee $l14
                          i32.const 1
                          i32.shr_u
                          i32.const 1409286144
                          i32.and
                          local.get $l14
                          i32.const 1426063360
                          i32.and
                          i32.const 1
                          i32.shl
                          i32.or
                          i32.const 23
                          i32.shr_u
                          i32.const 3
                          i32.or
                          local.set $l15
                          i32.const 9
                          local.set $l14
                          br $B12
                        end
                        block $B15
                          local.get $l5
                          i32.const 279
                          i32.gt_u
                          br_if $B15
                          local.get $l5
                          i32.const 3
                          i32.shl
                          i32.const 8
                          i32.and
                          local.get $l5
                          i32.const 1
                          i32.shl
                          i32.const 4
                          i32.and
                          i32.or
                          local.get $l5
                          i32.const 1
                          i32.shr_u
                          i32.const 2
                          i32.and
                          i32.or
                          local.get $l5
                          i32.const 8
                          i32.and
                          i32.const 3
                          i32.shr_u
                          i32.or
                          i32.const 3
                          i32.shl
                          local.get $l12
                          i32.const 32
                          i32.add
                          i32.const 2
                          i32.shr_u
                          i32.const 1073741820
                          i32.and
                          i32.or
                          local.set $l15
                          i32.const 7
                          local.set $l14
                          br $B12
                        end
                        i32.const 8
                        local.set $l14
                        local.get $l5
                        i32.const 16711935
                        i32.and
                        i32.const 8
                        i32.rotr
                        local.tee $l15
                        i32.const 5
                        i32.shl
                        i32.const 1073741824
                        i32.and
                        local.get $l15
                        local.get $l5
                        i32.const 24
                        i32.rotr
                        i32.const 16711935
                        i32.and
                        i32.or
                        local.tee $l15
                        i32.const 4
                        i32.shr_u
                        i32.const 252645135
                        i32.and
                        local.get $l15
                        i32.const 252645135
                        i32.and
                        i32.const 4
                        i32.shl
                        i32.or
                        local.tee $l15
                        i32.const 2
                        i32.shr_u
                        local.get $l15
                        i32.const 268435456
                        i32.and
                        i32.const 2
                        i32.shl
                        i32.or
                        i32.const 1342177280
                        i32.and
                        i32.const 1
                        i32.shl
                        i32.or
                        i32.const 24
                        i32.shr_u
                        i32.const 3
                        i32.or
                        local.set $l15
                      end
                      block $B16
                        block $B17
                          local.get $l14
                          local.get $l10
                          i32.ne
                          br_if $B17
                          local.get $l15
                          local.get $l11
                          i32.eq
                          br_if $B16
                        end
                        local.get $l13
                        i32.const 2
                        i32.add
                        local.set $l13
                        local.get $l12
                        i32.const 1
                        i32.add
                        local.tee $l12
                        i32.eqz
                        br_if $B10
                        br $L11
                      end
                    end
                    local.get $l12
                    i32.const -32
                    i32.eq
                    br_if $B1
                    local.get $l5
                    i32.const 255
                    i32.gt_u
                    br_if $B4
                    local.get $l7
                    local.get $p3
                    i32.lt_u
                    br_if $B5
                    i32.const 0
                    return
                  end
                  local.get $l10
                  i32.const 1
                  i32.add
                  local.tee $l10
                  i32.const 10
                  i32.ne
                  br_if $L6
                end
                i32.const 0
                return
              end
              local.get $p2
              local.get $l7
              i32.add
              local.get $l5
              i32.store8
              i32.const 1
              local.set $l10
              local.get $l7
              i32.const 1
              i32.add
              local.set $l7
              br $B3
            end
            i32.const 0
            local.set $l4
            local.get $l5
            i32.const 285
            i32.gt_u
            br_if $B0
            block $B18
              block $B19
                block $B20
                  local.get $l8
                  local.get $l12
                  i32.const 65823
                  i32.add
                  i32.load8_u
                  local.tee $l5
                  i32.lt_u
                  br_if $B20
                  local.get $l9
                  local.set $l14
                  br $B19
                end
                local.get $l9
                local.get $p1
                local.get $l9
                local.get $p1
                i32.gt_u
                select
                local.set $l15
                loop $L21
                  block $B22
                    local.get $l15
                    local.get $l9
                    i32.ne
                    br_if $B22
                    i32.const 0
                    local.set $l10
                    local.get $l6
                    local.set $l12
                    local.get $l15
                    local.set $l14
                    i32.const 0
                    local.set $l15
                    br $B18
                  end
                  local.get $p0
                  local.get $l9
                  i32.add
                  i32.load8_u
                  local.get $l8
                  i32.shl
                  local.get $l6
                  i32.or
                  local.set $l6
                  local.get $l9
                  i32.const 1
                  i32.add
                  local.tee $l14
                  local.set $l9
                  local.get $l8
                  i32.const 8
                  i32.add
                  local.tee $l8
                  local.get $l5
                  i32.lt_u
                  br_if $L21
                end
              end
              local.get $l8
              local.get $l5
              i32.sub
              local.set $l8
              local.get $l6
              local.get $l5
              i32.shr_u
              local.set $l12
              local.get $l6
              i32.const -1
              local.get $l5
              i32.shl
              i32.const -1
              i32.xor
              i32.and
              local.set $l15
              i32.const 1
              local.set $l10
            end
            local.get $l13
            i32.load16_u
            local.set $l11
            block $B23
              block $B24
                block $B25
                  local.get $l8
                  i32.const 4
                  i32.le_u
                  br_if $B25
                  local.get $l14
                  local.set $l5
                  local.get $l12
                  local.set $l13
                  local.get $l8
                  local.set $l9
                  br $B24
                end
                i32.const 0
                local.set $l13
                block $B26
                  local.get $l14
                  local.get $p1
                  i32.lt_u
                  br_if $B26
                  i32.const 0
                  local.set $l9
                  i32.const 0
                  local.set $l10
                  local.get $l14
                  local.set $l5
                  br $B23
                end
                local.get $l8
                i32.const 8
                i32.or
                local.set $l9
                local.get $l14
                i32.const 1
                i32.add
                local.set $l5
                local.get $p0
                local.get $l14
                i32.add
                i32.load8_u
                local.get $l8
                i32.shl
                local.get $l12
                i32.or
                local.set $l13
              end
              local.get $l13
              i32.const 15
              i32.and
              i32.const 15
              i32.eq
              br_if $B0
              local.get $l9
              i32.const -5
              i32.add
              local.set $l8
              local.get $l13
              i32.const 5
              i32.shr_u
              local.set $l12
              local.get $l13
              i32.const 31
              i32.and
              local.set $l9
            end
            local.get $l9
            i32.const 4
            i32.shr_u
            local.get $l13
            i32.const 3
            i32.shl
            i32.const 8
            i32.and
            local.get $l13
            i32.const 1
            i32.shl
            i32.const 4
            i32.and
            i32.or
            local.get $l13
            i32.const 1
            i32.shr_u
            i32.const 2
            i32.and
            i32.or
            local.get $l13
            i32.const 8
            i32.and
            i32.const 3
            i32.shr_u
            i32.or
            i32.const 1
            i32.shl
            i32.or
            local.tee $l13
            i32.const 1
            i32.shl
            i32.load16_u offset=65824
            local.set $l16
            block $B27
              block $B28
                block $B29
                  local.get $l8
                  local.get $l13
                  i32.load8_u offset=65888
                  local.tee $l13
                  i32.lt_u
                  br_if $B29
                  local.get $l5
                  local.set $l9
                  br $B28
                end
                local.get $l5
                local.get $p1
                local.get $l5
                local.get $p1
                i32.gt_u
                select
                local.set $l14
                loop $L30
                  block $B31
                    local.get $l14
                    local.get $l5
                    i32.ne
                    br_if $B31
                    i32.const 0
                    local.set $l10
                    local.get $l12
                    local.set $l6
                    local.get $l14
                    local.set $l9
                    i32.const 0
                    local.set $l5
                    br $B27
                  end
                  local.get $p0
                  local.get $l5
                  i32.add
                  i32.load8_u
                  local.get $l8
                  i32.shl
                  local.get $l12
                  i32.or
                  local.set $l12
                  local.get $l5
                  i32.const 1
                  i32.add
                  local.tee $l9
                  local.set $l5
                  local.get $l8
                  i32.const 8
                  i32.add
                  local.tee $l8
                  local.get $l13
                  i32.lt_u
                  br_if $L30
                end
              end
              local.get $l8
              local.get $l13
              i32.sub
              local.set $l8
              local.get $l12
              local.get $l13
              i32.shr_u
              local.set $l6
              local.get $l12
              i32.const -1
              local.get $l13
              i32.shl
              i32.const -1
              i32.xor
              i32.and
              local.set $l5
            end
            local.get $l5
            local.get $l16
            i32.add
            local.tee $l13
            local.get $l7
            i32.gt_u
            br_if $B0
            local.get $l15
            local.get $l11
            i32.add
            local.tee $l5
            local.get $l7
            i32.add
            local.tee $l11
            local.get $p3
            i32.gt_u
            br_if $B0
            local.get $l5
            i32.eqz
            br_if $B3
            local.get $l5
            i32.const -1
            i32.add
            local.set $l14
            block $B32
              local.get $l5
              i32.const 3
              i32.and
              local.tee $l5
              i32.eqz
              br_if $B32
              local.get $p2
              local.get $l13
              i32.sub
              local.set $l12
              loop $L33
                local.get $p2
                local.get $l7
                i32.add
                local.get $l12
                local.get $l7
                i32.add
                i32.load8_u
                i32.store8
                local.get $l7
                i32.const 1
                i32.add
                local.set $l7
                local.get $l5
                i32.const -1
                i32.add
                local.tee $l5
                br_if $L33
              end
            end
            block $B34
              local.get $l14
              i32.const 3
              i32.lt_u
              br_if $B34
              local.get $p2
              local.get $l13
              i32.sub
              local.set $l13
              local.get $p2
              local.set $l14
              local.get $l11
              local.set $l15
              loop $L35
                local.get $l14
                local.get $l7
                i32.add
                local.tee $l5
                local.get $l13
                local.get $l7
                i32.add
                local.tee $l12
                i32.load8_u
                i32.store8
                local.get $l5
                i32.const 1
                i32.add
                local.get $l12
                i32.const 1
                i32.add
                i32.load8_u
                i32.store8
                local.get $l5
                i32.const 2
                i32.add
                local.get $l12
                i32.const 2
                i32.add
                i32.load8_u
                i32.store8
                local.get $l5
                i32.const 3
                i32.add
                local.get $l12
                i32.const 3
                i32.add
                i32.load8_u
                i32.store8
                local.get $l13
                i32.const 4
                i32.add
                local.set $l13
                local.get $l14
                i32.const 4
                i32.add
                local.set $l14
                local.get $l7
                local.get $l15
                i32.const -4
                i32.add
                local.tee $l15
                i32.ne
                br_if $L35
              end
            end
            local.get $l11
            local.set $l7
          end
          local.get $l10
          br_if $L2
        end
        i32.const 0
        return
      end
      local.get $l7
      local.get $p3
      i32.eq
      local.set $l4
    end
    local.get $l4)
  (func $selected_count (type $t3) (param $p0 i32) (result i32)
    local.get $p0
    i32.const 0
    i32.ne
    local.get $p0
    i32.const 1
    i32.gt_u
    i32.add
    local.get $p0
    i32.const 17
    i32.gt_u
    i32.add
    local.get $p0
    i32.const 997
    i32.gt_u
    i32.add
    local.get $p0
    i32.const 2048
    i32.gt_u
    i32.add
    local.get $p0
    i32.const 4096
    i32.gt_u
    i32.add
    local.get $p0
    i32.const 7001
    i32.gt_u
    i32.add
    local.get $p0
    i32.const 8191
    i32.gt_u
    i32.add
    local.get $p0
    i32.const 9998
    i32.gt_u
    i32.add
    local.get $p0
    i32.const 9999
    i32.gt_u
    i32.add)
  (table $__indirect_function_table 1 1 funcref)
  (memory $memory 112)
  (global $__stack_pointer (mut i32) (i32.const 65536))
  (global $__dso_handle i32 (i32.const 65536))
  (global $__data_end i32 (i32.const 66944))
  (global $__stack_low i32 (i32.const 0))
  (global $__stack_high i32 (i32.const 65536))
  (global $__global_base i32 (i32.const 65536))
  (global $__heap_base i32 (i32.const 66944))
  (global $__heap_end i32 (i32.const 7340032))
  (global $__memory_base i32 (i32.const 0))
  (global $__table_base i32 (i32.const 1))
  (global $__wasm_first_page_end i32 (i32.const 65536))
  (export "memory" (memory $memory))
  (export "__wasm_call_ctors" (func $__wasm_call_ctors))
  (export "__stack_pointer" (global $__stack_pointer))
  (export "zip_build" (func $zip_build))
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
  (data $.rodata (i32.const 65536) "event\00assets\00docs\00json\00bin\00note\00module\00md\00src\00blob\00data\00{\22event\22:\22workspace\22,\22value\22:\00# Workspace note \00export const value = \00\00\00*\00\01\003\00\01\00\06\00\01\00\0d\00\01\00 \00\01\00\00\00\01\00.\00\01\00\1b\00\01\00\0a\00\01\00\12\00\01\00\17\00\01\00'\00\01\00h\00\01\008\00\01\00}\00\01\00V\00\01\00\03\00\04\00\05\00\06\00\07\00\08\00\09\00\0a\00\0b\00\0d\00\0f\00\11\00\13\00\17\00\1b\00\1f\00#\00+\003\00;\00C\00S\00c\00s\00\83\00\a3\00\c3\00\e3\00\02\01\00\00\00\00\00\00\00\00\00\00\00\00\00\00\01\01\01\01\02\02\02\02\03\03\03\03\04\04\04\04\05\05\05\05\00\00\00\00\01\00\02\00\03\00\04\00\05\00\07\00\09\00\0d\00\11\00\19\00!\001\00A\00a\00\81\00\c1\00\01\01\81\01\01\02\01\03\01\04\01\06\01\08\01\0c\01\10\01\18\01 \010\01@\01`\00\00\00\00\00\00\00\00\01\01\02\02\03\03\04\04\05\05\06\06\07\07\08\08\09\09\0a\0a\0b\0b\0c\0c\0d\0d\00\00\00\00\00\00\960\07w,a\0e\ee\baQ\09\99\19\c4m\07\8f\f4jp5\a5c\e9\a3\95d\9e2\88\db\0e\a4\b8\dcy\1e\e9\d5\e0\88\d9\d2\97+L\b6\09\bd|\b1~\07-\b8\e7\91\1d\bf\90d\10\b7\1d\f2 \b0jHq\b9\f3\deA\be\84}\d4\da\1a\eb\e4\ddmQ\b5\d4\f4\c7\85\d3\83V\98l\13\c0\a8kdz\f9b\fd\ec\c9e\8aO\5c\01\14\d9l\06cc=\0f\fa\f5\0d\08\8d\c8 n;^\10iL\e4A`\d5rqg\a2\d1\e4\03<G\d4\04K\fd\85\0d\d2k\b5\0a\a5\fa\a8\b55l\98\b2B\d6\c9\bb\db@\f9\bc\ac\e3l\d82u\5c\dfE\cf\0d\d6\dcY=\d1\ab\ac0\d9&:\00\deQ\80Q\d7\c8\16a\d0\bf\b5\f4\b4!#\c4\b3V\99\95\ba\cf\0f\a5\bd\b8\9e\b8\02(\08\88\05_\b2\d9\0c\c6$\e9\0b\b1\87|o/\11LhX\ab\1da\c1=-f\b6\90A\dcv\06q\db\01\bc \d2\98*\10\d5\ef\89\85\b1q\1f\b5\b6\06\a5\e4\bf\9f3\d4\b8\e8\a2\c9\07x4\f9\00\0f\8e\a8\09\96\18\98\0e\e1\bb\0dj\7f-=m\08\97ld\91\01\5cc\e6\f4Qkkbal\1c\d80e\85N\00b\f2\ed\95\06l{\a5\01\1b\c1\f4\08\82W\c4\0f\f5\c6\d9\b0eP\e9\b7\12\ea\b8\be\8b|\88\b9\fc\df\1d\ddbI-\da\15\f3|\d3\8ceL\d4\fbXa\b2M\ceQ\b5:t\00\bc\a3\e20\bb\d4A\a5\dfJ\d7\95\d8=m\c4\d1\a4\fb\f4\d6\d3j\e9iC\fc\d9n4F\88g\ad\d0\b8`\das-\04D\e5\1d\033_L\0a\aa\c9|\0d\dd<q\05P\aaA\02'\10\10\0b\be\86 \0c\c9%\b5hW\b3\85o \09\d4f\b9\9f\e4a\ce\0e\f9\de^\98\c9\d9)\22\98\d0\b0\b4\a8\d7\c7\17=\b3Y\81\0d\b4.;\5c\bd\b7\adl\ba\c0 \83\b8\ed\b6\b3\bf\9a\0c\e2\b6\03\9a\d2\b1t9G\d5\ea\afw\d2\9d\15&\db\04\83\16\dcs\12\0bc\e3\84;d\94>jm\0d\a8Zjz\0b\cf\0e\e4\9d\ff\09\93'\ae\00\0a\b1\9e\07}D\93\0f\f0\d2\a3\08\87h\f2\01\1e\fe\c2\06i]Wb\f7\cbge\80q6l\19\e7\06knv\1b\d4\fe\e0+\d3\89Zz\da\10\ccJ\ddgo\df\b9\f9\f9\ef\be\8eC\be\b7\17\d5\8e\b0`\e8\a3\d6\d6~\93\d1\a1\c4\c2\d88R\f2\dfO\f1g\bb\d1gW\bc\a6\dd\06\b5?K6\b2H\da+\0d\d8L\1b\0a\af\f6J\036`z\04A\c3\ef`\dfU\dfg\a8\ef\8en1y\beiF\8c\b3a\cb\1a\83f\bc\a0\d2o%6\e2hR\95w\0c\cc\03G\0b\bb\b9\16\02\22/&\05U\be;\ba\c5(\0b\bd\b2\92Z\b4+\04j\b3\5c\a7\ff\d7\c21\cf\d0\b5\8b\9e\d9,\1d\ae\de[\b0\c2d\9b&\f2c\ec\9c\a3ju\0a\93m\02\a9\06\09\9c?6\0e\eb\85g\07r\13W\00\05\82J\bf\95\14z\b8\e2\ae+\b1{8\1b\b6\0c\9b\8e\d2\92\0d\be\d5\e5\b7\ef\dc|!\df\db\0b\d4\d2\d3\86B\e2\d4\f1\f8\b3\ddhn\83\da\1f\cd\16\be\81[&\b9\f6\e1w\b0owG\b7\18\e6Z\08\88pj\0f\ff\ca;\06f\5c\0b\01\11\ff\9ee\8fi\aeb\f8\d3\ffkaE\cfl\16x\e2\0a\a0\ee\d2\0d\d7T\83\04N\c2\b3\039a&g\a7\f7\16`\d0MGiI\dbwn>Jj\d1\ae\dcZ\d6\d9f\0b\df@\f0;\d87S\ae\bc\a9\c5\9e\bb\de\7f\cf\b2G\e9\ff\b50\1c\f2\bd\bd\8a\c2\ba\ca0\93\b3S\a6\a3\b4$\056\d0\ba\93\06\d7\cd)W\deT\bfg\d9#.zf\b3\b8Ja\c4\02\1bh]\94+o*7\be\0b\b4\a1\8e\0c\c3\1b\df\05Z\8d\ef\02-"))
