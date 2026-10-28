;; dom.virtualized-grid.v1 — kernel: grid_trace
;; WebAssembly Text (WAT) baseline implementation
;; Exports: grid_trace

(module $grid_trace_kernel_c.wasm
  (type $t0 (func))
  (type $t1 (func (param i32) (result i32)))
  (func $__wasm_call_ctors (type $t0))
  (func $grid_trace (type $t1) (param $p0 i32) (result i32)
    (local $l1 i32) (local $l2 i32) (local $l3 i32) (local $l4 i32) (local $l5 i32) (local $l6 i32) (local $l7 i32) (local $l8 i32) (local $l9 i32) (local $l10 i32) (local $l11 i32) (local $l12 i32) (local $l13 i32) (local $l14 i32) (local $l15 i32) (local $l16 i32) (local $l17 i32) (local $l18 i32) (local $l19 i32) (local $l20 i32) (local $l21 i32) (local $l22 i32) (local $l23 i32) (local $l24 i32) (local $l25 i32) (local $l26 i32) (local $l27 i32) (local $l28 i32) (local $l29 i32) (local $l30 i32) (local $l31 i32) (local $l32 i32) (local $l33 i32) (local $l34 i32) (local $l35 i32) (local $l36 i32) (local $l37 i32) (local $l38 i32) (local $l39 i32) (local $l40 i32) (local $l41 i32) (local $l42 i32) (local $l43 i32) (local $l44 i32) (local $l45 i32) (local $l46 i32) (local $l47 i32) (local $l48 i32)
    global.get $__stack_pointer
    i32.const 224
    i32.sub
    local.tee $l1
    global.set $__stack_pointer
    block $B0
      block $B1
        local.get $p0
        i32.const 1604864
        i32.eq
        br_if $B1
        i32.const 1
        local.set $p0
        br $B0
      end
      i32.const 2
      local.set $p0
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
      i32.const 826561095
      i32.ne
      br_if $B0
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
      i32.const 1
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
      i32.const 100000
      i32.ne
      br_if $B0
      i32.const 0
      i32.load8_u offset=3145741
      i32.const 8
      i32.shl
      i32.const 0
      i32.load8_u offset=3145740
      i32.or
      i32.const 0
      i32.load8_u offset=3145742
      i32.const 16
      i32.shl
      i32.or
      i32.const 0
      i32.load8_u offset=3145743
      i32.const 24
      i32.shl
      i32.or
      i32.const 300
      i32.ne
      br_if $B0
      i32.const -112
      local.set $p0
      loop $L2
        local.get $p0
        i32.const 65760
        i32.add
        i32.const -1
        i32.store
        local.get $p0
        i32.const 65648
        i32.add
        i64.const -1
        i64.store
        local.get $p0
        i32.const 65872
        i32.add
        i32.const -1
        i32.store
        local.get $p0
        i32.const 65984
        i32.add
        i32.const 0
        i32.store
        local.get $p0
        i32.const 66096
        i32.add
        i32.const 0
        i32.store
        local.get $p0
        i32.const 65764
        i32.add
        i32.const -1
        i32.store
        local.get $p0
        i32.const 65876
        i32.add
        i32.const -1
        i32.store
        local.get $p0
        i32.const 65988
        i32.add
        i32.const 0
        i32.store
        local.get $p0
        i32.const 66100
        i32.add
        i32.const 0
        i32.store
        local.get $p0
        i32.const 8
        i32.add
        local.tee $p0
        br_if $L2
      end
      i32.const -1600000
      local.set $l2
      i32.const 0
      local.set $p0
      i32.const 0
      local.set $l3
      loop $L3
        block $B4
          local.get $l3
          local.get $l2
          i32.const 4745792
          i32.add
          i32.load
          i32.eq
          br_if $B4
          i32.const 3
          local.set $p0
          br $B0
        end
        local.get $p0
        i32.const 66096
        i32.add
        local.get $l2
        i32.const 4745796
        i32.add
        i32.load
        i32.store
        local.get $l2
        i32.const 4745800
        i32.add
        i32.load
        local.set $l4
        local.get $p0
        i32.const 866096
        i32.add
        local.get $l3
        i32.store
        local.get $p0
        i32.const 466096
        i32.add
        local.get $l4
        i32.store
        local.get $p0
        i32.const 1266096
        i32.add
        local.get $l3
        i32.store
        local.get $p0
        i32.const 4
        i32.add
        local.set $p0
        local.get $l3
        i32.const 1
        i32.add
        local.set $l3
        local.get $l2
        i32.const 16
        i32.add
        local.tee $l2
        br_if $L3
      end
      i32.const -2128831035
      local.set $l5
      i32.const -1
      local.set $l6
      i32.const -1
      local.set $l7
      i32.const 100000
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
      i32.const -1
      local.set $l21
      i32.const -1
      local.set $l22
      i32.const 0
      local.set $l23
      i32.const 0
      local.set $l24
      i32.const 0
      local.set $l25
      i32.const 0
      local.set $l26
      i32.const 0
      local.set $l27
      i32.const 0
      local.set $l28
      i32.const 0
      local.set $l29
      i32.const 0
      local.set $l30
      i32.const 0
      local.set $l31
      loop $L5
        block $B6
          local.get $l19
          i32.const 4
          i32.shl
          local.tee $l3
          i32.const 4745792
          i32.add
          i32.load
          local.get $l19
          i32.const 100
          i32.mul
          i32.eq
          br_if $B6
          i32.const 4
          local.set $p0
          br $B0
        end
        local.get $l3
        i32.const 4745801
        i32.add
        i32.load8_u
        i32.const 8
        i32.shl
        local.get $l3
        i32.const 4745802
        i32.add
        i32.load8_u
        i32.const 16
        i32.shl
        i32.or
        local.get $l3
        i32.const 4745803
        i32.add
        i32.load8_u
        i32.const 24
        i32.shl
        i32.or
        local.get $l3
        i32.const 4745800
        i32.add
        i32.load8_u
        local.tee $l4
        i32.or
        local.set $l2
        i32.const 7
        local.set $p0
        block $B7
          block $B8
            block $B9
              block $B10
                block $B11
                  block $B12
                    local.get $l3
                    i32.const 4745796
                    i32.add
                    i32.load
                    br_table $B10 $B12 $B11 $B8 $B9 $B0
                  end
                  block $B13
                    block $B14
                      local.get $l2
                      i32.const -1
                      i32.eq
                      br_if $B14
                      i32.const 0
                      local.set $l8
                      i32.const -400000
                      local.set $p0
                      loop $L15
                        block $B16
                          local.get $p0
                          i32.const 1266096
                          i32.add
                          i32.load
                          local.tee $l3
                          i32.const 2
                          i32.shl
                          i32.load offset=466096
                          local.get $l2
                          i32.ne
                          br_if $B16
                          local.get $l8
                          i32.const 2
                          i32.shl
                          local.get $l3
                          i32.store offset=1266096
                          local.get $l8
                          i32.const 1
                          i32.add
                          local.set $l8
                        end
                        block $B17
                          local.get $p0
                          i32.const 1266100
                          i32.add
                          i32.load
                          local.tee $l3
                          i32.const 2
                          i32.shl
                          i32.load offset=466096
                          local.get $l2
                          i32.ne
                          br_if $B17
                          local.get $l8
                          i32.const 2
                          i32.shl
                          local.get $l3
                          i32.store offset=1266096
                          local.get $l8
                          i32.const 1
                          i32.add
                          local.set $l8
                        end
                        local.get $p0
                        i32.const 8
                        i32.add
                        local.tee $p0
                        br_if $L15
                        br $B13
                      end
                    end
                    i32.const 0
                    local.set $p0
                    loop $L18
                      local.get $p0
                      i32.const 1266096
                      i32.add
                      local.get $p0
                      i32.const 866096
                      i32.add
                      i32.load
                      i32.store
                      local.get $p0
                      i32.const 1266100
                      i32.add
                      local.get $p0
                      i32.const 866100
                      i32.add
                      i32.load
                      i32.store
                      local.get $p0
                      i32.const 1266104
                      i32.add
                      local.get $p0
                      i32.const 866104
                      i32.add
                      i32.load
                      i32.store
                      local.get $p0
                      i32.const 1266108
                      i32.add
                      local.get $p0
                      i32.const 866108
                      i32.add
                      i32.load
                      i32.store
                      local.get $p0
                      i32.const 1266112
                      i32.add
                      local.get $p0
                      i32.const 866112
                      i32.add
                      i32.load
                      i32.store
                      local.get $p0
                      i32.const 20
                      i32.add
                      local.tee $p0
                      i32.const 400000
                      i32.ne
                      br_if $L18
                    end
                    i32.const 100000
                    local.set $l8
                  end
                  local.get $l17
                  i32.const 100000
                  i32.add
                  local.set $l17
                  i32.const 0
                  local.set $l20
                  local.get $l2
                  local.set $l22
                  br $B7
                end
                i32.const 1
                local.set $l32
                local.get $l4
                i32.const 1
                i32.and
                local.set $l33
                i32.const 1666112
                local.set $l34
                i32.const 866096
                local.set $p0
                loop $L19
                  local.get $p0
                  local.set $l35
                  local.get $l32
                  i32.const 3
                  i32.shl
                  local.set $l36
                  i32.const 0
                  local.set $l37
                  local.get $l34
                  local.set $l38
                  local.get $l32
                  i32.const 1
                  i32.shl
                  local.tee $l39
                  local.set $l40
                  local.get $l32
                  local.set $l41
                  loop $L20
                    local.get $l37
                    local.tee $l42
                    local.get $l32
                    i32.add
                    local.tee $p0
                    i32.const 100000
                    local.get $p0
                    i32.const 100000
                    i32.lt_u
                    select
                    local.set $l43
                    block $B21
                      block $B22
                        local.get $p0
                        local.get $l42
                        local.get $l39
                        i32.add
                        local.tee $l37
                        i32.const 100000
                        local.get $l37
                        i32.const 100000
                        i32.lt_u
                        local.tee $l44
                        select
                        local.tee $l8
                        i32.lt_u
                        br_if $B22
                        local.get $l42
                        local.set $p0
                        local.get $l43
                        local.set $l3
                        br $B21
                      end
                      i32.const 0
                      local.set $l45
                      local.get $l38
                      local.set $l4
                      local.get $l43
                      local.set $l3
                      local.get $l42
                      local.set $p0
                      loop $L23
                        block $B24
                          block $B25
                            block $B26
                              block $B27
                                block $B28
                                  local.get $l35
                                  local.get $p0
                                  i32.const 2
                                  i32.shl
                                  i32.add
                                  i32.load
                                  local.tee $l2
                                  i32.const 2
                                  i32.shl
                                  i32.load offset=66096
                                  local.tee $l46
                                  local.get $l35
                                  local.get $l3
                                  i32.const 2
                                  i32.shl
                                  i32.add
                                  i32.load
                                  local.tee $l47
                                  i32.const 2
                                  i32.shl
                                  i32.load offset=66096
                                  local.tee $l48
                                  i32.eq
                                  br_if $B28
                                  local.get $l48
                                  local.get $l46
                                  i32.sub
                                  local.get $l46
                                  local.get $l48
                                  i32.sub
                                  local.get $l33
                                  select
                                  local.set $l46
                                  br $B27
                                end
                                local.get $l2
                                local.get $l47
                                i32.lt_u
                                br_if $B26
                                local.get $l2
                                local.get $l47
                                i32.gt_u
                                local.set $l46
                              end
                              local.get $l46
                              i32.const 0
                              i32.gt_s
                              br_if $B25
                            end
                            local.get $p0
                            i32.const 1
                            i32.add
                            local.set $p0
                            br $B24
                          end
                          local.get $l3
                          i32.const 1
                          i32.add
                          local.set $l3
                          local.get $l47
                          local.set $l2
                        end
                        local.get $l4
                        local.get $l2
                        i32.store
                        local.get $l45
                        i32.const 1
                        i32.add
                        local.set $l45
                        block $B29
                          local.get $p0
                          local.get $l43
                          i32.ge_u
                          br_if $B29
                          local.get $l4
                          i32.const 4
                          i32.add
                          local.set $l4
                          local.get $l3
                          local.get $l8
                          i32.lt_u
                          br_if $L23
                        end
                      end
                      local.get $l42
                      local.get $l45
                      i32.add
                      local.set $l42
                      local.get $l23
                      local.get $l45
                      i32.add
                      local.tee $l16
                      local.set $l23
                    end
                    block $B30
                      block $B31
                        local.get $p0
                        local.get $l43
                        i32.lt_u
                        br_if $B31
                        local.get $l42
                        local.set $l45
                        br $B30
                      end
                      local.get $l42
                      local.set $l45
                      block $B32
                        local.get $l41
                        i32.const 100000
                        local.get $l41
                        i32.const 100000
                        i32.lt_u
                        select
                        local.tee $l46
                        local.get $p0
                        i32.sub
                        local.tee $l48
                        i32.const 3
                        i32.and
                        local.tee $l47
                        i32.eqz
                        br_if $B32
                        local.get $l42
                        local.get $l47
                        i32.add
                        local.set $l45
                        local.get $l35
                        local.get $p0
                        i32.const 2
                        i32.shl
                        i32.add
                        local.set $l2
                        local.get $l34
                        local.get $l42
                        i32.const 2
                        i32.shl
                        i32.add
                        local.set $l4
                        loop $L33
                          local.get $l4
                          local.get $l2
                          i32.load
                          i32.store
                          local.get $l2
                          i32.const 4
                          i32.add
                          local.set $l2
                          local.get $l4
                          i32.const 4
                          i32.add
                          local.set $l4
                          local.get $l47
                          i32.const -1
                          i32.add
                          local.tee $l47
                          br_if $L33
                        end
                      end
                      local.get $p0
                      local.get $l46
                      i32.sub
                      i32.const -4
                      i32.gt_u
                      br_if $B30
                      local.get $l46
                      local.get $p0
                      local.get $l48
                      i32.const 3
                      i32.and
                      local.tee $l2
                      i32.add
                      local.tee $l47
                      i32.sub
                      local.set $l4
                      local.get $l34
                      local.get $l42
                      local.get $l2
                      i32.add
                      i32.const 2
                      i32.shl
                      i32.add
                      local.set $p0
                      local.get $l35
                      local.get $l47
                      i32.const 2
                      i32.shl
                      i32.add
                      local.set $l2
                      loop $L34
                        local.get $p0
                        local.get $l2
                        i64.load align=4
                        i64.store align=4
                        local.get $p0
                        i32.const 8
                        i32.add
                        local.get $l2
                        i32.const 8
                        i32.add
                        i64.load align=4
                        i64.store align=4
                        local.get $p0
                        i32.const 16
                        i32.add
                        local.set $p0
                        local.get $l2
                        i32.const 16
                        i32.add
                        local.set $l2
                        local.get $l45
                        i32.const 4
                        i32.add
                        local.set $l45
                        local.get $l4
                        i32.const -4
                        i32.add
                        local.tee $l4
                        br_if $L34
                      end
                    end
                    block $B35
                      local.get $l3
                      local.get $l8
                      i32.ge_u
                      br_if $B35
                      block $B36
                        local.get $l40
                        i32.const 100000
                        local.get $l40
                        i32.const 100000
                        i32.lt_u
                        select
                        local.tee $l46
                        local.get $l3
                        i32.sub
                        i32.const 3
                        i32.and
                        local.tee $l47
                        i32.eqz
                        br_if $B36
                        local.get $l35
                        local.get $l3
                        i32.const 2
                        i32.shl
                        i32.add
                        local.set $p0
                        local.get $l34
                        local.get $l45
                        i32.const 2
                        i32.shl
                        i32.add
                        local.set $l2
                        local.get $l47
                        i32.const 2
                        i32.shl
                        local.set $l4
                        loop $L37
                          local.get $l2
                          local.get $p0
                          i32.load
                          i32.store
                          local.get $p0
                          i32.const 4
                          i32.add
                          local.set $p0
                          local.get $l2
                          i32.const 4
                          i32.add
                          local.set $l2
                          local.get $l4
                          i32.const -4
                          i32.add
                          local.tee $l4
                          br_if $L37
                        end
                      end
                      local.get $l3
                      local.get $l46
                      i32.sub
                      i32.const -4
                      i32.gt_u
                      br_if $B35
                      local.get $l46
                      local.get $l3
                      local.get $l47
                      i32.add
                      local.tee $l2
                      i32.sub
                      local.set $l3
                      local.get $l34
                      local.get $l45
                      local.get $l47
                      i32.add
                      i32.const 2
                      i32.shl
                      i32.add
                      local.set $p0
                      local.get $l35
                      local.get $l2
                      i32.const 2
                      i32.shl
                      i32.add
                      local.set $l2
                      loop $L38
                        local.get $p0
                        local.get $l2
                        i64.load align=4
                        i64.store align=4
                        local.get $p0
                        i32.const 8
                        i32.add
                        local.get $l2
                        i32.const 8
                        i32.add
                        i64.load align=4
                        i64.store align=4
                        local.get $p0
                        i32.const 16
                        i32.add
                        local.set $p0
                        local.get $l2
                        i32.const 16
                        i32.add
                        local.set $l2
                        local.get $l3
                        i32.const -4
                        i32.add
                        local.tee $l3
                        br_if $L38
                      end
                    end
                    local.get $l38
                    local.get $l36
                    i32.add
                    local.set $l38
                    local.get $l40
                    local.get $l39
                    i32.add
                    local.set $l40
                    local.get $l41
                    local.get $l39
                    i32.add
                    local.set $l41
                    local.get $l44
                    br_if $L20
                  end
                  local.get $l32
                  i32.const 50000
                  i32.lt_u
                  local.set $l2
                  local.get $l34
                  local.set $p0
                  local.get $l35
                  local.set $l34
                  local.get $l39
                  local.set $l32
                  local.get $l2
                  br_if $L19
                end
                i32.const 0
                local.set $p0
                loop $L39
                  local.get $p0
                  i32.const 866096
                  i32.add
                  local.get $p0
                  i32.const 1666112
                  i32.add
                  i32.load
                  i32.store
                  local.get $p0
                  i32.const 866100
                  i32.add
                  local.get $p0
                  i32.const 1666116
                  i32.add
                  i32.load
                  i32.store
                  local.get $p0
                  i32.const 866104
                  i32.add
                  local.get $p0
                  i32.const 1666120
                  i32.add
                  i32.load
                  i32.store
                  local.get $p0
                  i32.const 866108
                  i32.add
                  local.get $p0
                  i32.const 1666124
                  i32.add
                  i32.load
                  i32.store
                  local.get $p0
                  i32.const 866112
                  i32.add
                  local.get $p0
                  i32.const 1666128
                  i32.add
                  i32.load
                  i32.store
                  local.get $p0
                  i32.const 20
                  i32.add
                  local.tee $p0
                  i32.const 400000
                  i32.ne
                  br_if $L39
                end
                block $B40
                  block $B41
                    local.get $l22
                    i32.const -1
                    i32.eq
                    br_if $B41
                    i32.const 0
                    local.set $l8
                    i32.const -400000
                    local.set $p0
                    loop $L42
                      block $B43
                        local.get $p0
                        i32.const 1266096
                        i32.add
                        i32.load
                        local.tee $l2
                        i32.const 2
                        i32.shl
                        i32.load offset=466096
                        local.get $l22
                        i32.ne
                        br_if $B43
                        local.get $l8
                        i32.const 2
                        i32.shl
                        local.get $l2
                        i32.store offset=1266096
                        local.get $l8
                        i32.const 1
                        i32.add
                        local.set $l8
                      end
                      block $B44
                        local.get $p0
                        i32.const 1266100
                        i32.add
                        i32.load
                        local.tee $l2
                        i32.const 2
                        i32.shl
                        i32.load offset=466096
                        local.get $l22
                        i32.ne
                        br_if $B44
                        local.get $l8
                        i32.const 2
                        i32.shl
                        local.get $l2
                        i32.store offset=1266096
                        local.get $l8
                        i32.const 1
                        i32.add
                        local.set $l8
                      end
                      local.get $p0
                      i32.const 8
                      i32.add
                      local.tee $p0
                      br_if $L42
                      br $B40
                    end
                  end
                  i32.const 0
                  local.set $p0
                  loop $L45
                    local.get $p0
                    i32.const 1266096
                    i32.add
                    local.get $p0
                    i32.const 866096
                    i32.add
                    i32.load
                    i32.store
                    local.get $p0
                    i32.const 1266100
                    i32.add
                    local.get $p0
                    i32.const 866100
                    i32.add
                    i32.load
                    i32.store
                    local.get $p0
                    i32.const 1266104
                    i32.add
                    local.get $p0
                    i32.const 866104
                    i32.add
                    i32.load
                    i32.store
                    local.get $p0
                    i32.const 1266108
                    i32.add
                    local.get $p0
                    i32.const 866108
                    i32.add
                    i32.load
                    i32.store
                    local.get $p0
                    i32.const 1266112
                    i32.add
                    local.get $p0
                    i32.const 866112
                    i32.add
                    i32.load
                    i32.store
                    local.get $p0
                    i32.const 20
                    i32.add
                    local.tee $p0
                    i32.const 400000
                    i32.ne
                    br_if $L45
                  end
                  i32.const 100000
                  local.set $l8
                end
                local.get $l17
                i32.const 100000
                i32.add
                local.set $l17
                br $B7
              end
              local.get $l2
              local.get $l8
              i32.const 24
              i32.mul
              i32.const -480
              i32.add
              local.tee $p0
              local.get $l2
              local.get $p0
              i32.lt_u
              select
              i32.const 0
              local.get $l8
              i32.const 20
              i32.gt_u
              select
              local.set $l20
              br $B7
            end
            block $B46
              local.get $l2
              i32.const -1
              i32.ne
              br_if $B46
              local.get $l20
              i32.const 24
              i32.div_u
              i32.const 5
              i32.add
              local.tee $p0
              local.get $l8
              i32.const -1
              i32.add
              local.get $p0
              local.get $l8
              i32.lt_u
              select
              i32.const 2
              i32.shl
              i32.load offset=1266096
              local.tee $l6
              local.set $l7
              local.get $l6
              local.set $l21
              br $B7
            end
            local.get $l2
            local.set $l6
            local.get $l2
            local.set $l7
            local.get $l2
            local.set $l21
            local.get $l2
            i32.const 99999
            i32.le_u
            br_if $B7
            i32.const 6
            local.set $p0
            br $B0
          end
          block $B47
            local.get $l2
            i32.const 99999
            i32.le_u
            br_if $B47
            i32.const 5
            local.set $p0
            br $B0
          end
          local.get $l2
          i32.const 2
          i32.shl
          local.get $l3
          i32.const 4745804
          i32.add
          i32.load
          i32.store offset=66096
          local.get $l2
          local.set $l6
        end
        local.get $l1
        i64.const 0
        i64.store offset=104
        local.get $l1
        i64.const 0
        i64.store offset=96
        local.get $l1
        i64.const 0
        i64.store offset=88
        local.get $l1
        i64.const 0
        i64.store offset=80
        local.get $l1
        i64.const 0
        i64.store offset=72
        local.get $l1
        i64.const 0
        i64.store offset=64
        local.get $l1
        i64.const 0
        i64.store offset=56
        local.get $l1
        i64.const 0
        i64.store offset=48
        local.get $l1
        i64.const 0
        i64.store offset=40
        local.get $l1
        i64.const 0
        i64.store offset=32
        local.get $l1
        i64.const 0
        i64.store offset=24
        local.get $l1
        i64.const 0
        i64.store offset=16
        local.get $l1
        i64.const 0
        i64.store offset=8
        local.get $l1
        i64.const 0
        i64.store
        local.get $l8
        local.get $l20
        i32.const 24
        i32.div_u
        local.tee $p0
        local.get $l8
        local.get $p0
        i32.lt_u
        select
        local.tee $l35
        i32.const 24
        i32.add
        local.tee $p0
        local.get $l8
        local.get $p0
        local.get $l8
        i32.lt_u
        select
        local.tee $l39
        i32.const 0
        local.get $l35
        i32.const -4
        i32.add
        local.tee $p0
        local.get $p0
        local.get $l35
        i32.gt_u
        select
        local.tee $l33
        i32.sub
        local.set $l46
        block $B48
          block $B49
            block $B50
              local.get $l39
              local.get $l33
              i32.ne
              br_if $B50
              local.get $l29
              local.set $l4
              br $B49
            end
            local.get $l46
            i32.const 3
            i32.and
            local.set $l48
            i32.const 0
            local.set $l2
            block $B51
              block $B52
                local.get $l35
                i32.const -1
                i32.xor
                local.get $l35
                i32.const 4
                local.get $l35
                i32.const 4
                i32.lt_u
                select
                local.tee $l43
                local.get $l39
                i32.add
                i32.add
                i32.const 3
                i32.lt_u
                br_if $B52
                local.get $l33
                i32.const 2
                i32.shl
                i32.const 1266096
                i32.add
                local.set $l47
                local.get $l46
                i32.const -4
                i32.and
                local.set $l45
                i32.const 0
                local.set $p0
                i32.const 0
                local.set $l2
                loop $L53
                  local.get $l1
                  i32.const 112
                  i32.add
                  local.get $p0
                  i32.add
                  local.tee $l3
                  local.get $l47
                  local.get $p0
                  i32.add
                  local.tee $l4
                  i64.load align=4
                  i64.store
                  local.get $l3
                  i32.const 8
                  i32.add
                  local.get $l4
                  i32.const 8
                  i32.add
                  i64.load align=4
                  i64.store
                  local.get $p0
                  i32.const 16
                  i32.add
                  local.set $p0
                  local.get $l45
                  local.get $l2
                  i32.const 4
                  i32.add
                  local.tee $l2
                  i32.ne
                  br_if $L53
                end
                local.get $l48
                i32.eqz
                br_if $B51
              end
              local.get $l2
              i32.const 2
              i32.shl
              local.tee $l2
              local.get $l35
              i32.const 2
              i32.shl
              i32.add
              local.get $l43
              i32.const 2
              i32.shl
              i32.sub
              i32.const 1266096
              i32.add
              local.set $p0
              local.get $l48
              i32.const 2
              i32.shl
              local.set $l3
              local.get $l1
              i32.const 112
              i32.add
              local.get $l2
              i32.add
              local.set $l2
              loop $L54
                local.get $l2
                local.get $p0
                i32.load
                i32.store
                local.get $p0
                i32.const 4
                i32.add
                local.set $p0
                local.get $l2
                i32.const 4
                i32.add
                local.set $l2
                local.get $l3
                i32.const -4
                i32.add
                local.tee $l3
                br_if $L54
              end
            end
            i32.const 0
            local.set $l48
            local.get $l29
            local.set $l4
            loop $L55
              local.get $l1
              i32.const 112
              i32.add
              local.get $l48
              i32.const 2
              i32.shl
              i32.add
              i32.load
              local.set $l45
              block $B56
                block $B57
                  block $B58
                    block $B59
                      block $B60
                        block $B61
                          block $B62
                            local.get $l4
                            i32.eqz
                            br_if $B62
                            i32.const 0
                            local.set $l2
                            i32.const 0
                            local.set $p0
                            loop $L63
                              local.get $p0
                              i32.const 65536
                              i32.add
                              i32.load
                              local.get $l45
                              i32.eq
                              br_if $B60
                              local.get $p0
                              i32.const 4
                              i32.add
                              local.set $p0
                              local.get $l4
                              local.get $l2
                              i32.const 1
                              i32.add
                              local.tee $l2
                              i32.ne
                              br_if $L63
                            end
                            local.get $l45
                            local.get $l6
                            i32.eq
                            local.set $l43
                            i32.const 0
                            local.set $l47
                            loop $L64
                              local.get $l47
                              i32.const 2
                              i32.shl
                              local.tee $l35
                              i32.load offset=65536
                              local.set $l3
                              local.get $l1
                              i32.const 112
                              i32.add
                              local.set $p0
                              local.get $l46
                              local.set $l2
                              block $B65
                                loop $L66
                                  local.get $p0
                                  i32.load
                                  local.get $l3
                                  i32.eq
                                  br_if $B65
                                  local.get $p0
                                  i32.const 4
                                  i32.add
                                  local.set $p0
                                  local.get $l2
                                  i32.const -1
                                  i32.add
                                  local.tee $l2
                                  br_if $L66
                                end
                                local.get $l1
                                local.get $l35
                                i32.add
                                i32.load
                                i32.eqz
                                br_if $B59
                              end
                              local.get $l47
                              i32.const 1
                              i32.add
                              local.tee $l47
                              local.get $l4
                              i32.ne
                              br_if $L64
                            end
                            local.get $l4
                            i32.const 27
                            i32.le_u
                            br_if $B61
                            br $B48
                          end
                          local.get $l45
                          local.get $l6
                          i32.eq
                          local.set $l43
                        end
                        local.get $l45
                        i32.const 2
                        i32.shl
                        i32.load offset=66096
                        local.tee $p0
                        i32.const 255
                        i32.and
                        local.get $l45
                        i32.const 255
                        i32.and
                        local.get $l5
                        i32.const 1
                        i32.xor
                        i32.const 1345077009
                        i32.mul
                        local.get $l4
                        i32.xor
                        i32.const 1345077009
                        i32.mul
                        i32.xor
                        i32.const 16777619
                        i32.mul
                        local.get $l45
                        i32.const 8
                        i32.shr_u
                        i32.const 255
                        i32.and
                        i32.xor
                        i32.const 16777619
                        i32.mul
                        local.get $l45
                        i32.const 16
                        i32.shr_u
                        i32.const 255
                        i32.and
                        i32.xor
                        i32.const 16777619
                        i32.mul
                        local.get $l45
                        i32.const 24
                        i32.shr_u
                        i32.xor
                        i32.const 16777619
                        i32.mul
                        local.get $l48
                        local.get $l33
                        i32.add
                        local.tee $l3
                        i32.const 255
                        i32.and
                        i32.xor
                        i32.const 16777619
                        i32.mul
                        local.get $l3
                        i32.const 8
                        i32.shr_u
                        i32.const 255
                        i32.and
                        i32.xor
                        i32.const 16777619
                        i32.mul
                        local.get $l3
                        i32.const 16
                        i32.shr_u
                        i32.const 255
                        i32.and
                        i32.xor
                        i32.const 16777619
                        i32.mul
                        local.get $l3
                        i32.const 24
                        i32.shr_u
                        i32.xor
                        i32.const 16777619
                        i32.mul
                        i32.xor
                        i32.const 16777619
                        i32.mul
                        local.get $p0
                        i32.const 8
                        i32.shr_u
                        i32.const 255
                        i32.and
                        i32.xor
                        i32.const 16777619
                        i32.mul
                        local.get $p0
                        i32.const 16
                        i32.shr_u
                        i32.const 255
                        i32.and
                        i32.xor
                        i32.const 16777619
                        i32.mul
                        local.get $p0
                        i32.const 24
                        i32.shr_u
                        i32.xor
                        i32.const 16777619
                        i32.mul
                        local.get $l43
                        i32.xor
                        local.set $l35
                        local.get $l25
                        i32.const 1
                        i32.add
                        local.tee $l15
                        local.set $l25
                        local.get $l4
                        i32.const 1
                        i32.add
                        local.tee $l29
                        local.set $l42
                        br $B58
                      end
                      local.get $l45
                      local.get $l6
                      i32.eq
                      local.set $l43
                      block $B67
                        block $B68
                          local.get $p0
                          i32.const 65984
                          i32.add
                          local.tee $l35
                          i32.load
                          local.get $l45
                          i32.const 2
                          i32.shl
                          i32.load offset=66096
                          local.tee $l47
                          i32.eq
                          br_if $B68
                          local.get $l48
                          local.get $l33
                          i32.add
                          local.set $l3
                          br $B67
                        end
                        local.get $p0
                        i32.const 65648
                        i32.add
                        i32.load
                        local.get $l48
                        local.get $l33
                        i32.add
                        local.tee $l3
                        i32.ne
                        br_if $B67
                        local.get $p0
                        i32.const 65872
                        i32.add
                        i32.load
                        local.get $l43
                        i32.eq
                        br_if $B56
                      end
                      local.get $l35
                      local.get $l47
                      i32.store
                      local.get $l3
                      i32.const 255
                      i32.and
                      local.get $l2
                      i32.const 255
                      i32.and
                      local.get $l5
                      i32.const 3
                      i32.xor
                      i32.const 1345077009
                      i32.mul
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
                      local.get $l45
                      i32.const 255
                      i32.and
                      i32.xor
                      i32.const 16777619
                      i32.mul
                      local.get $l45
                      i32.const 8
                      i32.shr_u
                      i32.const 255
                      i32.and
                      i32.xor
                      i32.const 16777619
                      i32.mul
                      local.get $l45
                      i32.const 16
                      i32.shr_u
                      i32.const 255
                      i32.and
                      i32.xor
                      i32.const 16777619
                      i32.mul
                      local.get $l45
                      i32.const 24
                      i32.shr_u
                      i32.xor
                      i32.const 16777619
                      i32.mul
                      i32.xor
                      i32.const 16777619
                      i32.mul
                      local.get $l3
                      i32.const 8
                      i32.shr_u
                      i32.const 255
                      i32.and
                      i32.xor
                      i32.const 16777619
                      i32.mul
                      local.get $l3
                      i32.const 16
                      i32.shr_u
                      i32.const 255
                      i32.and
                      i32.xor
                      i32.const 16777619
                      i32.mul
                      local.get $l3
                      i32.const 24
                      i32.shr_u
                      i32.xor
                      i32.const 16777619
                      i32.mul
                      local.get $l47
                      i32.const 255
                      i32.and
                      i32.xor
                      i32.const 16777619
                      i32.mul
                      local.get $l47
                      i32.const 8
                      i32.shr_u
                      i32.const 255
                      i32.and
                      i32.xor
                      i32.const 16777619
                      i32.mul
                      local.get $l47
                      i32.const 16
                      i32.shr_u
                      i32.const 255
                      i32.and
                      i32.xor
                      i32.const 16777619
                      i32.mul
                      local.get $l47
                      i32.const 24
                      i32.shr_u
                      i32.xor
                      i32.const 16777619
                      i32.mul
                      local.get $l43
                      i32.xor
                      local.set $l35
                      local.get $l27
                      i32.const 1
                      i32.add
                      local.tee $l13
                      local.set $l27
                      br $B57
                    end
                    local.get $l45
                    i32.const 2
                    i32.shl
                    i32.load offset=66096
                    local.tee $p0
                    i32.const 255
                    i32.and
                    local.get $l47
                    i32.const 255
                    i32.and
                    local.get $l5
                    i32.const 2
                    i32.xor
                    i32.const 1345077009
                    i32.mul
                    i32.xor
                    i32.const 16777619
                    i32.mul
                    local.get $l47
                    i32.const 8
                    i32.shr_u
                    i32.const 255
                    i32.and
                    i32.xor
                    i32.const 16777619
                    i32.mul
                    local.get $l47
                    i32.const 16
                    i32.shr_u
                    i32.const 255
                    i32.and
                    i32.xor
                    i32.const 16777619
                    i32.mul
                    local.get $l47
                    i32.const 24
                    i32.shr_u
                    i32.xor
                    i32.const 16777619
                    i32.mul
                    local.get $l45
                    i32.const 255
                    i32.and
                    i32.xor
                    i32.const 16777619
                    i32.mul
                    local.get $l45
                    i32.const 8
                    i32.shr_u
                    i32.const 255
                    i32.and
                    i32.xor
                    i32.const 16777619
                    i32.mul
                    local.get $l45
                    i32.const 16
                    i32.shr_u
                    i32.const 255
                    i32.and
                    i32.xor
                    i32.const 16777619
                    i32.mul
                    local.get $l45
                    i32.const 24
                    i32.shr_u
                    i32.xor
                    i32.const 16777619
                    i32.mul
                    local.get $l48
                    local.get $l33
                    i32.add
                    local.tee $l3
                    i32.const 255
                    i32.and
                    i32.xor
                    i32.const 16777619
                    i32.mul
                    local.get $l3
                    i32.const 8
                    i32.shr_u
                    i32.const 255
                    i32.and
                    i32.xor
                    i32.const 16777619
                    i32.mul
                    local.get $l3
                    i32.const 16
                    i32.shr_u
                    i32.const 255
                    i32.and
                    i32.xor
                    i32.const 16777619
                    i32.mul
                    local.get $l3
                    i32.const 24
                    i32.shr_u
                    i32.xor
                    i32.const 16777619
                    i32.mul
                    i32.xor
                    i32.const 16777619
                    i32.mul
                    local.get $p0
                    i32.const 8
                    i32.shr_u
                    i32.const 255
                    i32.and
                    i32.xor
                    i32.const 16777619
                    i32.mul
                    local.get $p0
                    i32.const 16
                    i32.shr_u
                    i32.const 255
                    i32.and
                    i32.xor
                    i32.const 16777619
                    i32.mul
                    local.get $p0
                    i32.const 24
                    i32.shr_u
                    i32.xor
                    i32.const 16777619
                    i32.mul
                    local.get $l43
                    i32.xor
                    local.set $l35
                    local.get $l26
                    i32.const 1
                    i32.add
                    local.tee $l14
                    local.set $l26
                    local.get $l4
                    local.set $l42
                    local.get $l47
                    local.set $l4
                  end
                  local.get $l4
                  i32.const 2
                  i32.shl
                  local.tee $l2
                  local.get $p0
                  i32.store offset=65984
                  local.get $l2
                  local.get $l45
                  i32.store offset=65536
                  local.get $l4
                  local.set $l2
                  local.get $l42
                  local.set $l4
                end
                local.get $l2
                i32.const 2
                i32.shl
                local.tee $p0
                local.get $l43
                i32.store offset=65872
                local.get $p0
                local.get $l3
                i32.store offset=65648
                local.get $l35
                i32.const 1345077009
                i32.mul
                local.set $l5
                local.get $l28
                i32.const 1
                i32.add
                local.tee $l18
                local.set $l28
              end
              local.get $l1
              local.get $l2
              i32.const 2
              i32.shl
              local.tee $p0
              i32.add
              i32.const 1
              i32.store
              block $B69
                local.get $p0
                i32.load offset=65760
                local.get $l48
                i32.eq
                br_if $B69
                local.get $p0
                i32.const 65760
                i32.add
                local.get $l48
                i32.store
                local.get $l2
                i32.const 255
                i32.and
                local.get $l5
                i32.const 4
                i32.xor
                i32.const 1345077009
                i32.mul
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
                local.get $l48
                i32.const 255
                i32.and
                i32.xor
                i32.const 16777619
                i32.mul
                local.get $l48
                i32.const 8
                i32.shr_u
                i32.const 255
                i32.and
                i32.xor
                i32.const 16777619
                i32.mul
                local.get $l48
                i32.const 16
                i32.shr_u
                i32.const 255
                i32.and
                i32.xor
                i32.const 16777619
                i32.mul
                local.get $l48
                i32.const 24
                i32.shr_u
                i32.xor
                i32.const 16777619
                i32.mul
                local.get $l45
                i32.const 255
                i32.and
                i32.xor
                i32.const 16777619
                i32.mul
                local.get $l45
                i32.const 8
                i32.shr_u
                i32.const 255
                i32.and
                i32.xor
                i32.const 16777619
                i32.mul
                local.get $l45
                i32.const 16
                i32.shr_u
                i32.const 255
                i32.and
                i32.xor
                i32.const 16777619
                i32.mul
                local.get $l45
                i32.const 24
                i32.shr_u
                i32.xor
                i32.const 16777619
                i32.mul
                local.get $l48
                local.get $l33
                i32.add
                local.tee $p0
                i32.const 255
                i32.and
                i32.xor
                i32.const 16777619
                i32.mul
                local.get $p0
                i32.const 8
                i32.shr_u
                i32.const 255
                i32.and
                i32.xor
                i32.const 16777619
                i32.mul
                local.get $p0
                i32.const 16
                i32.shr_u
                i32.const 255
                i32.and
                i32.xor
                i32.const 16777619
                i32.mul
                local.get $p0
                i32.const 24
                i32.shr_u
                i32.xor
                i32.const 1185368003
                i32.mul
                local.set $l5
                local.get $l28
                i32.const 1
                i32.add
                local.tee $l18
                local.set $l28
                local.get $l24
                i32.const 1
                i32.add
                local.tee $l12
                local.set $l24
              end
              local.get $l48
              i32.const 1
              i32.add
              local.tee $l48
              local.get $l46
              i32.ne
              br_if $L55
            end
          end
          block $B70
            local.get $l4
            i32.eqz
            br_if $B70
            i32.const 0
            local.set $p0
            i32.const 0
            local.set $l2
            loop $L71
              block $B72
                local.get $l1
                local.get $p0
                i32.add
                i32.load
                br_if $B72
                local.get $p0
                i32.const 65536
                i32.add
                local.tee $l47
                i32.load
                local.tee $l3
                i32.const -1
                i32.eq
                br_if $B72
                local.get $p0
                i32.const 65760
                i32.add
                i32.const -1
                i32.store
                local.get $l47
                i32.const -1
                i32.store
                local.get $l3
                i32.const 255
                i32.and
                local.get $l5
                i32.const 5
                i32.xor
                i32.const 1345077009
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
                i32.xor
                i32.const 16777619
                i32.mul
                local.get $l3
                i32.const 8
                i32.shr_u
                i32.const 255
                i32.and
                i32.xor
                i32.const 16777619
                i32.mul
                local.get $l3
                i32.const 16
                i32.shr_u
                i32.const 255
                i32.and
                i32.xor
                i32.const 16777619
                i32.mul
                local.get $l3
                i32.const 24
                i32.shr_u
                i32.xor
                i32.const 924097827
                i32.mul
                local.set $l5
                local.get $l28
                i32.const 1
                i32.add
                local.set $l28
                local.get $l30
                i32.const 1
                i32.add
                local.tee $l11
                local.set $l30
              end
              local.get $p0
              i32.const 4
              i32.add
              local.set $p0
              local.get $l4
              local.get $l2
              i32.const 1
              i32.add
              local.tee $l2
              i32.ne
              br_if $L71
            end
            i32.const 0
            local.set $l2
            i32.const 65536
            local.set $p0
            loop $L73
              block $B74
                local.get $p0
                i32.load
                local.get $l21
                i32.ne
                br_if $B74
                local.get $l2
                i32.const 255
                i32.and
                local.get $l5
                i32.const 6
                i32.xor
                i32.const 1345077009
                i32.mul
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
                local.get $l21
                i32.const 255
                i32.and
                i32.xor
                i32.const 16777619
                i32.mul
                local.get $l21
                i32.const 8
                i32.shr_u
                i32.const 255
                i32.and
                i32.xor
                i32.const 16777619
                i32.mul
                local.get $l21
                i32.const 16
                i32.shr_u
                i32.const 255
                i32.and
                i32.xor
                i32.const 16777619
                i32.mul
                local.get $l21
                i32.const 24
                i32.shr_u
                i32.xor
                i32.const 924097827
                i32.mul
                local.set $l5
                local.get $l10
                i32.const 1
                i32.add
                local.set $l10
                local.get $l28
                i32.const 1
                i32.add
                local.set $l28
                br $B70
              end
              local.get $p0
              i32.const 4
              i32.add
              local.set $p0
              local.get $l4
              local.get $l2
              i32.const 1
              i32.add
              local.tee $l2
              i32.ne
              br_if $L73
            end
          end
          i32.const 0
          local.get $l39
          i32.store offset=1666100
          i32.const 0
          local.get $l33
          i32.store offset=1666096
          i32.const 0
          local.get $l46
          i32.store offset=1666104
          local.get $l5
          i32.const 7
          i32.xor
          i32.const 1345077009
          i32.mul
          local.get $l19
          i32.const 255
          i32.and
          i32.xor
          i32.const 16777619
          i32.mul
          local.get $l19
          i32.const 8
          i32.shr_u
          i32.xor
          i32.const 1055306571
          i32.mul
          local.get $l46
          i32.const 255
          i32.and
          i32.xor
          i32.const 16777619
          i32.mul
          local.get $l46
          i32.const 8
          i32.shr_u
          i32.const 255
          i32.and
          i32.xor
          i32.const 16777619
          i32.mul
          local.get $l46
          i32.const 16
          i32.shr_u
          i32.const 255
          i32.and
          i32.xor
          i32.const 16777619
          i32.mul
          local.get $l46
          i32.const 24
          i32.shr_u
          i32.xor
          i32.const 16777619
          i32.mul
          local.get $l33
          i32.const 255
          i32.and
          i32.xor
          i32.const 16777619
          i32.mul
          local.get $l33
          i32.const 8
          i32.shr_u
          i32.const 255
          i32.and
          i32.xor
          i32.const 16777619
          i32.mul
          local.get $l33
          i32.const 16
          i32.shr_u
          i32.const 255
          i32.and
          i32.xor
          i32.const 16777619
          i32.mul
          local.get $l33
          i32.const 24
          i32.shr_u
          i32.xor
          i32.const 16777619
          i32.mul
          local.get $l39
          i32.const 255
          i32.and
          i32.xor
          i32.const 16777619
          i32.mul
          local.get $l39
          i32.const 8
          i32.shr_u
          i32.const 255
          i32.and
          i32.xor
          i32.const 16777619
          i32.mul
          local.get $l39
          i32.const 16
          i32.shr_u
          i32.const 255
          i32.and
          i32.xor
          i32.const 16777619
          i32.mul
          local.get $l39
          i32.const 24
          i32.shr_u
          i32.xor
          i32.const 16777619
          i32.mul
          local.get $l8
          i32.const 255
          i32.and
          i32.xor
          i32.const 16777619
          i32.mul
          local.get $l8
          i32.const 8
          i32.shr_u
          i32.const 255
          i32.and
          i32.xor
          i32.const 16777619
          i32.mul
          local.get $l8
          i32.const 16
          i32.shr_u
          i32.const 255
          i32.and
          i32.xor
          i32.const 16777619
          i32.mul
          local.get $l8
          i32.const 24
          i32.shr_u
          i32.xor
          i32.const 16777619
          i32.mul
          local.set $l5
          local.get $l31
          i32.const 1
          i32.add
          local.tee $l9
          local.set $l31
          local.get $l28
          i32.const 1
          i32.add
          local.tee $l18
          local.set $l28
        end
        local.get $l19
        i32.const 1
        i32.add
        local.tee $l19
        i32.const 300
        i32.ne
        br_if $L5
      end
      i32.const 0
      local.set $p0
      i32.const 0
      local.get $l5
      i32.store offset=5242880
      i32.const 0
      local.get $l17
      i32.store offset=5242884
      i32.const 0
      local.get $l16
      i32.store offset=5242888
      i32.const 0
      local.get $l19
      i32.store offset=5242892
      i32.const 0
      local.get $l18
      i32.store offset=5242896
      i32.const 0
      local.get $l15
      i32.store offset=5242900
      i32.const 0
      local.get $l14
      i32.store offset=5242904
      i32.const 0
      local.get $l13
      i32.store offset=5242908
      i32.const 0
      local.get $l12
      i32.store offset=5242912
      i32.const 0
      local.get $l11
      i32.store offset=5242916
      i32.const 0
      local.get $l10
      i32.store offset=5242920
      i32.const 0
      local.get $l9
      i32.store offset=5242924
      i32.const 0
      i32.const 0
      i32.load offset=1666096
      i32.store offset=5242928
      i32.const 0
      i32.const 0
      i32.load offset=1666100
      i32.store offset=5242932
      i32.const 0
      i32.const 0
      i32.load offset=1666104
      i32.store offset=5242936
      i32.const 0
      local.get $l7
      i32.store offset=5242940
      i32.const 0
      local.get $l6
      i32.store offset=5242944
      i32.const 0
      local.get $l8
      i32.store offset=5242948
    end
    local.get $l1
    i32.const 224
    i32.add
    global.set $__stack_pointer
    local.get $p0)
  (table $__indirect_function_table 1 1 funcref)
  (memory $memory 96)
  (global $__stack_pointer (mut i32) (i32.const 65536))
  (global $__dso_handle i32 (i32.const 65536))
  (global $__data_end i32 (i32.const 2066112))
  (global $__stack_low i32 (i32.const 0))
  (global $__stack_high i32 (i32.const 65536))
  (global $__global_base i32 (i32.const 65536))
  (global $__heap_base i32 (i32.const 2066112))
  (global $__heap_end i32 (i32.const 6291456))
  (global $__memory_base i32 (i32.const 0))
  (global $__table_base i32 (i32.const 1))
  (global $__wasm_first_page_end i32 (i32.const 65536))
  (export "memory" (memory $memory))
  (export "__wasm_call_ctors" (func $__wasm_call_ctors))
  (export "__stack_pointer" (global $__stack_pointer))
  (export "grid_trace" (func $grid_trace))
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
