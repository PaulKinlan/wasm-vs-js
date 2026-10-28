;; network.http2-quic-state.v1 — protocol state machine
;; WebAssembly Text (WAT) baseline for HTTP/2 & QUIC stream state tracking

(module
  (type $t0 (func (param i32 i32 i32) (result i32)))
  (type $t1 (func (param i32 i32 i32)))
  (func $run_trace (type $t0) (param $p0 i32) (param $p1 i32) (param $p2 i32) (result i32)
    (local $l3 i32) (local $l4 i32) (local $l5 i32) (local $l6 i32) (local $l7 i32) (local $l8 i32) (local $l9 i32) (local $l10 i32) (local $l11 i32) (local $l12 i32) (local $l13 i32) (local $l14 i32) (local $l15 i32) (local $l16 i32) (local $l17 i32) (local $l18 i32) (local $l19 i32) (local $l20 i32)
    global.get $g0
    i32.const 1024
    i32.sub
    local.tee $l3
    global.set $g0
    local.get $p2
    i32.const 4
    i32.add
    i32.const 0
    i32.const 252
    memory.fill
    local.get $p2
    local.get $p1
    i32.store offset=8
    local.get $p2
    i32.const 1
    i32.store
    block $B0
      block $B1
        block $B2
          local.get $p1
          i32.eqz
          br_if $B2
          local.get $p0
          i32.const 3
          i32.add
          local.set $l4
          i32.const 0
          local.set $l5
          i32.const 0
          local.set $l6
          i32.const 0
          local.set $l7
          block $B3
            loop $L4
              block $B5
                block $B6
                  block $B7
                    block $B8
                      local.get $l6
                      local.tee $l8
                      i32.const 3
                      i32.add
                      local.tee $l9
                      local.get $p1
                      i32.le_u
                      br_if $B8
                      local.get $p2
                      local.get $l5
                      i32.const 1
                      i32.add
                      local.tee $l9
                      i32.store offset=120
                      local.get $p2
                      local.get $p2
                      i32.load offset=124
                      i32.const 1
                      i32.add
                      i32.store offset=124
                      local.get $l5
                      i32.const 32
                      i32.ge_u
                      br_if $B6
                      i32.const 32808
                      local.set $l8
                      br $B7
                    end
                    local.get $p0
                    local.get $l8
                    i32.add
                    local.tee $l10
                    i32.const 1
                    i32.add
                    i32.load16_u align=1
                    local.tee $l11
                    local.get $l9
                    i32.add
                    local.tee $l6
                    local.get $p1
                    i32.le_u
                    br_if $B5
                    local.get $p2
                    local.get $l5
                    i32.const 1
                    i32.add
                    local.tee $l9
                    i32.store offset=120
                    local.get $p2
                    local.get $p2
                    i32.load offset=124
                    i32.const 1
                    i32.add
                    i32.store offset=124
                    local.get $l5
                    i32.const 32
                    i32.ge_u
                    br_if $B6
                    i32.const 32809
                    local.set $l8
                  end
                  local.get $p2
                  local.get $l5
                  i32.const 2
                  i32.shl
                  i32.add
                  local.get $l8
                  i32.store offset=128
                end
                local.get $l9
                local.set $l5
                br $B3
              end
              local.get $l10
              i32.load8_u
              local.set $l12
              local.get $p2
              local.get $p2
              i32.load offset=4
              i32.const 1
              i32.add
              i32.store offset=4
              block $B9
                block $B10
                  block $B11
                    block $B12
                      block $B13
                        local.get $l12
                        i32.const -1
                        i32.add
                        br_table $B13 $B11 $B12
                      end
                      local.get $l11
                      i32.eqz
                      br_if $B9
                      local.get $p0
                      local.get $l9
                      i32.add
                      local.set $l13
                      i32.const 0
                      local.set $l12
                      loop $L14
                        local.get $l5
                        local.set $l14
                        block $B15
                          local.get $l12
                          local.tee $l15
                          i32.const 9
                          i32.add
                          local.tee $l8
                          local.get $l11
                          i32.le_u
                          br_if $B15
                          local.get $p2
                          local.get $l14
                          i32.const 1
                          i32.add
                          local.tee $l5
                          i32.store offset=120
                          local.get $p2
                          local.get $p2
                          i32.load offset=124
                          i32.const 1
                          i32.add
                          i32.store offset=124
                          local.get $l14
                          i32.const 32
                          i32.ge_u
                          br_if $B9
                          i32.const 32769
                          local.set $l9
                          br $B10
                        end
                        block $B16
                          local.get $l13
                          local.get $l15
                          i32.add
                          local.tee $l5
                          i32.load8_u offset=1
                          i32.const 8
                          i32.shl
                          local.get $l5
                          i32.load8_u
                          i32.const 16
                          i32.shl
                          i32.or
                          local.get $l5
                          i32.load8_u offset=2
                          i32.or
                          local.tee $l9
                          local.get $l8
                          i32.add
                          local.tee $l12
                          local.get $l11
                          i32.le_u
                          br_if $B16
                          local.get $p2
                          local.get $l14
                          i32.const 1
                          i32.add
                          local.tee $l5
                          i32.store offset=120
                          local.get $p2
                          local.get $p2
                          i32.load offset=124
                          i32.const 1
                          i32.add
                          i32.store offset=124
                          local.get $l14
                          i32.const 32
                          i32.ge_u
                          br_if $B9
                          i32.const 32770
                          local.set $l9
                          br $B10
                        end
                        local.get $l5
                        i32.load8_u offset=6
                        i32.const 16
                        i32.shl
                        local.get $l5
                        i32.load8_u offset=5
                        i32.const 24
                        i32.shl
                        i32.const 2130706432
                        i32.and
                        i32.or
                        local.get $l5
                        i32.load8_u offset=7
                        i32.const 8
                        i32.shl
                        i32.or
                        local.get $l5
                        i32.load8_u offset=8
                        i32.or
                        local.set $l16
                        local.get $l5
                        i32.load8_u offset=4
                        local.set $l17
                        local.get $l5
                        i32.load8_u offset=3
                        local.set $l18
                        local.get $p2
                        local.get $p2
                        i32.load offset=12
                        i32.const 1
                        i32.add
                        i32.store offset=12
                        local.get $l13
                        local.get $l8
                        i32.add
                        local.set $l5
                        block $B17
                          block $B18
                            block $B19
                              block $B20
                                block $B21
                                  block $B22
                                    block $B23
                                      block $B24
                                        block $B25
                                          block $B26
                                            block $B27
                                              block $B28
                                                local.get $l18
                                                br_table $B22 $B27 $B25 $B24 $B28 $B25 $B25 $B25 $B23 $B26 $B25
                                              end
                                              block $B29
                                                block $B30
                                                  local.get $l16
                                                  local.get $l9
                                                  i32.const 6
                                                  i32.rem_u
                                                  i32.or
                                                  i32.eqz
                                                  br_if $B30
                                                  local.get $p2
                                                  local.get $p2
                                                  i32.load offset=124
                                                  i32.const 1
                                                  i32.add
                                                  i32.store offset=124
                                                  local.get $l14
                                                  i32.const 1
                                                  i32.add
                                                  local.set $l18
                                                  local.get $l14
                                                  i32.const 31
                                                  i32.gt_u
                                                  br_if $B29
                                                  local.get $p2
                                                  local.get $l14
                                                  i32.const 2
                                                  i32.shl
                                                  i32.add
                                                  i32.const 32771
                                                  i32.store offset=128
                                                  br $B29
                                                end
                                                local.get $p2
                                                local.get $p2
                                                i32.load offset=16
                                                i32.const 1
                                                i32.add
                                                i32.store offset=16
                                                local.get $l14
                                                local.set $l18
                                              end
                                              local.get $p2
                                              local.get $l18
                                              i32.const 1
                                              i32.add
                                              local.tee $l5
                                              i32.store offset=120
                                              local.get $l18
                                              i32.const 32
                                              i32.ge_u
                                              br_if $B17
                                              i32.const 260
                                              local.set $l9
                                              br $B18
                                            end
                                            block $B31
                                              block $B32
                                                local.get $l16
                                                i32.eqz
                                                br_if $B32
                                                local.get $l14
                                                local.set $l18
                                                br $B31
                                              end
                                              local.get $p2
                                              local.get $l14
                                              i32.const 1
                                              i32.add
                                              local.tee $l18
                                              i32.store offset=120
                                              local.get $p2
                                              local.get $p2
                                              i32.load offset=124
                                              i32.const 1
                                              i32.add
                                              i32.store offset=124
                                              local.get $l14
                                              i32.const 31
                                              i32.gt_u
                                              br_if $B31
                                              local.get $p2
                                              local.get $l14
                                              i32.const 2
                                              i32.shl
                                              i32.add
                                              i32.const 32772
                                              i32.store offset=128
                                            end
                                            local.get $p2
                                            local.get $l16
                                            i32.store offset=56
                                            local.get $p2
                                            local.get $p2
                                            i32.load offset=20
                                            i32.const 1
                                            i32.add
                                            i32.store offset=20
                                            block $B33
                                              local.get $l9
                                              br_if $B33
                                              i32.const 0
                                              local.set $l9
                                              br $B19
                                            end
                                            local.get $l10
                                            local.get $l15
                                            i32.add
                                            local.set $l15
                                            i32.const 0
                                            local.set $l8
                                            i32.const -1024
                                            local.set $l5
                                            loop $L34
                                              block $B35
                                                local.get $l5
                                                br_if $B35
                                                i32.const 1024
                                                local.set $l9
                                                br $B19
                                              end
                                              local.get $l3
                                              local.get $l5
                                              i32.add
                                              local.tee $l14
                                              i32.const 1024
                                              i32.add
                                              local.get $l15
                                              local.get $l5
                                              i32.add
                                              local.tee $l7
                                              i32.const 1036
                                              i32.add
                                              i32.load8_u
                                              i32.store8
                                              local.get $l8
                                              i32.const 1
                                              i32.or
                                              local.get $l9
                                              i32.eq
                                              br_if $B19
                                              local.get $l14
                                              i32.const 1025
                                              i32.add
                                              local.get $l7
                                              i32.const 1037
                                              i32.add
                                              i32.load8_u
                                              i32.store8
                                              local.get $l8
                                              i32.const 2
                                              i32.or
                                              local.get $l9
                                              i32.eq
                                              br_if $B19
                                              local.get $l14
                                              i32.const 1026
                                              i32.add
                                              local.get $l7
                                              i32.const 1038
                                              i32.add
                                              i32.load8_u
                                              i32.store8
                                              local.get $l8
                                              i32.const 3
                                              i32.or
                                              local.get $l9
                                              i32.eq
                                              br_if $B19
                                              local.get $l14
                                              i32.const 1027
                                              i32.add
                                              local.get $l7
                                              i32.const 1039
                                              i32.add
                                              i32.load8_u
                                              i32.store8
                                              local.get $l5
                                              i32.const 4
                                              i32.add
                                              local.set $l5
                                              local.get $l8
                                              i32.const 4
                                              i32.add
                                              local.tee $l8
                                              local.get $l9
                                              i32.ne
                                              br_if $L34
                                              br $B19
                                            end
                                          end
                                          local.get $p2
                                          local.get $p2
                                          i32.load offset=24
                                          i32.const 1
                                          i32.add
                                          i32.store offset=24
                                          block $B36
                                            block $B37
                                              local.get $l7
                                              i32.eqz
                                              br_if $B37
                                              local.get $l16
                                              local.get $p2
                                              i32.load offset=56
                                              i32.ne
                                              br_if $B37
                                              local.get $l14
                                              local.set $l18
                                              br $B36
                                            end
                                            local.get $p2
                                            local.get $l14
                                            i32.const 1
                                            i32.add
                                            local.tee $l18
                                            i32.store offset=120
                                            local.get $p2
                                            local.get $p2
                                            i32.load offset=124
                                            i32.const 1
                                            i32.add
                                            i32.store offset=124
                                            local.get $l14
                                            i32.const 31
                                            i32.gt_u
                                            br_if $B36
                                            local.get $p2
                                            local.get $l14
                                            i32.const 2
                                            i32.shl
                                            i32.add
                                            i32.const 32773
                                            i32.store offset=128
                                          end
                                          local.get $l9
                                          i32.eqz
                                          br_if $B20
                                          local.get $l7
                                          i32.const 1024
                                          local.get $l7
                                          i32.const 1024
                                          i32.lt_u
                                          select
                                          i32.const -1024
                                          i32.add
                                          local.set $l8
                                          loop $L38
                                            local.get $l8
                                            i32.eqz
                                            br_if $B20
                                            local.get $l3
                                            local.get $l7
                                            i32.add
                                            local.get $l5
                                            i32.load8_u
                                            i32.store8
                                            local.get $l8
                                            i32.const 1
                                            i32.add
                                            local.set $l8
                                            local.get $l5
                                            i32.const 1
                                            i32.add
                                            local.set $l5
                                            local.get $l7
                                            i32.const 1
                                            i32.add
                                            local.set $l7
                                            local.get $l9
                                            i32.const -1
                                            i32.add
                                            local.tee $l9
                                            br_if $L38
                                            br $B20
                                          end
                                        end
                                        local.get $p2
                                        local.get $l14
                                        i32.const 1
                                        i32.add
                                        local.tee $l5
                                        i32.store offset=120
                                        local.get $p2
                                        local.get $p2
                                        i32.load offset=124
                                        i32.const 1
                                        i32.add
                                        i32.store offset=124
                                        local.get $l14
                                        i32.const 31
                                        i32.gt_u
                                        br_if $B17
                                        i32.const 32776
                                        local.set $l9
                                        br $B21
                                      end
                                      local.get $p2
                                      local.get $p2
                                      i32.load offset=36
                                      i32.const 1
                                      i32.add
                                      i32.store offset=36
                                      block $B39
                                        block $B40
                                          block $B41
                                            local.get $l9
                                            i32.const 4
                                            i32.ne
                                            br_if $B41
                                            local.get $l16
                                            br_if $B40
                                          end
                                          local.get $p2
                                          local.get $p2
                                          i32.load offset=124
                                          i32.const 1
                                          i32.add
                                          i32.store offset=124
                                          local.get $l14
                                          i32.const 1
                                          i32.add
                                          local.set $l18
                                          local.get $l14
                                          i32.const 31
                                          i32.gt_u
                                          br_if $B39
                                          local.get $p2
                                          local.get $l14
                                          i32.const 2
                                          i32.shl
                                          i32.add
                                          i32.const 32775
                                          i32.store offset=128
                                          br $B39
                                        end
                                        local.get $p2
                                        local.get $l16
                                        i32.store offset=60
                                        local.get $l14
                                        local.set $l18
                                      end
                                      local.get $p2
                                      local.get $l18
                                      i32.const 1
                                      i32.add
                                      local.tee $l5
                                      i32.store offset=120
                                      local.get $l18
                                      i32.const 32
                                      i32.ge_u
                                      br_if $B17
                                      i32.const 259
                                      local.set $l9
                                      br $B18
                                    end
                                    local.get $p2
                                    local.get $p2
                                    i32.load offset=32
                                    i32.const 1
                                    i32.add
                                    i32.store offset=32
                                    block $B42
                                      block $B43
                                        local.get $l9
                                        i32.const 4
                                        i32.eq
                                        br_if $B43
                                        local.get $p2
                                        local.get $p2
                                        i32.load offset=124
                                        i32.const 1
                                        i32.add
                                        i32.store offset=124
                                        local.get $l14
                                        i32.const 1
                                        i32.add
                                        local.set $l18
                                        local.get $l14
                                        i32.const 31
                                        i32.gt_u
                                        br_if $B42
                                        local.get $p2
                                        local.get $l14
                                        i32.const 2
                                        i32.shl
                                        i32.add
                                        i32.const 32774
                                        i32.store offset=128
                                        br $B42
                                      end
                                      local.get $p2
                                      local.get $l5
                                      i32.load8_u offset=1
                                      i32.const 16
                                      i32.shl
                                      local.get $l5
                                      i32.load8_u
                                      i32.const 24
                                      i32.shl
                                      i32.const 2130706432
                                      i32.and
                                      i32.or
                                      local.get $l5
                                      i32.load8_u offset=2
                                      i32.const 8
                                      i32.shl
                                      i32.or
                                      local.get $l5
                                      i32.load8_u offset=3
                                      i32.or
                                      local.get $p2
                                      i32.load offset=68
                                      i32.add
                                      i32.store offset=68
                                      local.get $l14
                                      local.set $l18
                                    end
                                    local.get $p2
                                    local.get $l18
                                    i32.const 1
                                    i32.add
                                    local.tee $l5
                                    i32.store offset=120
                                    local.get $l18
                                    i32.const 32
                                    i32.ge_u
                                    br_if $B17
                                    i32.const 264
                                    local.set $l9
                                    br $B18
                                  end
                                  local.get $p2
                                  local.get $p2
                                  i32.load offset=28
                                  i32.const 1
                                  i32.add
                                  i32.store offset=28
                                  local.get $p2
                                  local.get $p2
                                  i32.load offset=64
                                  local.get $l9
                                  i32.add
                                  i32.store offset=64
                                  block $B44
                                    local.get $l17
                                    i32.const 1
                                    i32.and
                                    i32.eqz
                                    br_if $B44
                                    local.get $p2
                                    local.get $l16
                                    i32.store offset=60
                                  end
                                  local.get $p2
                                  local.get $l14
                                  i32.const 1
                                  i32.add
                                  local.tee $l5
                                  i32.store offset=120
                                  local.get $l14
                                  i32.const 32
                                  i32.ge_u
                                  br_if $B17
                                  i32.const 256
                                  local.set $l9
                                end
                                local.get $l14
                                local.set $l18
                                br $B18
                              end
                              block $B45
                                local.get $l17
                                i32.const 4
                                i32.and
                                i32.eqz
                                br_if $B45
                                local.get $l3
                                local.get $l7
                                local.get $p2
                                call $f1
                                local.get $p2
                                i32.load offset=120
                                local.set $l18
                                i32.const 0
                                local.set $l7
                              end
                              local.get $p2
                              local.get $l18
                              i32.const 1
                              i32.add
                              local.tee $l5
                              i32.store offset=120
                              local.get $l18
                              i32.const 32
                              i32.ge_u
                              br_if $B17
                              i32.const 265
                              local.set $l9
                              br $B18
                            end
                            block $B46
                              block $B47
                                local.get $l17
                                i32.const 4
                                i32.and
                                br_if $B47
                                local.get $l9
                                local.set $l7
                                br $B46
                              end
                              local.get $l3
                              local.get $l9
                              local.get $p2
                              call $f1
                              local.get $p2
                              i32.load offset=120
                              local.set $l18
                              i32.const 0
                              local.set $l7
                            end
                            local.get $p2
                            local.get $l18
                            i32.const 1
                            i32.add
                            local.tee $l5
                            i32.store offset=120
                            local.get $l18
                            i32.const 32
                            i32.ge_u
                            br_if $B17
                            i32.const 257
                            local.set $l9
                          end
                          local.get $p2
                          local.get $l18
                          i32.const 2
                          i32.shl
                          i32.add
                          local.get $l9
                          i32.store offset=128
                        end
                        local.get $l12
                        local.get $l11
                        i32.lt_u
                        br_if $L14
                        br $B9
                      end
                    end
                    local.get $p2
                    local.get $l5
                    i32.const 1
                    i32.add
                    local.tee $l8
                    i32.store offset=120
                    local.get $p2
                    local.get $p2
                    i32.load offset=124
                    i32.const 1
                    i32.add
                    i32.store offset=124
                    block $B48
                      local.get $l5
                      i32.const 31
                      i32.le_u
                      br_if $B48
                      local.get $l8
                      local.set $l5
                      br $B9
                    end
                    i32.const 32810
                    local.set $l9
                    local.get $l5
                    local.set $l14
                    local.get $l8
                    local.set $l5
                    br $B10
                  end
                  local.get $l11
                  i32.eqz
                  br_if $B9
                  local.get $p0
                  local.get $l9
                  i32.add
                  local.set $l13
                  local.get $l4
                  local.get $l8
                  i32.add
                  local.set $l17
                  i32.const 0
                  local.set $l12
                  loop $L49
                    local.get $l5
                    local.set $l14
                    block $B50
                      block $B51
                        block $B52
                          block $B53
                            block $B54
                              block $B55
                                block $B56
                                  block $B57
                                    local.get $l13
                                    local.get $l12
                                    i32.add
                                    i32.load8_u
                                    local.tee $l9
                                    i32.const 6
                                    i32.shr_u
                                    local.tee $l5
                                    i32.const 3
                                    i32.eq
                                    br_if $B57
                                    i32.const 1
                                    local.get $l5
                                    i32.shl
                                    local.tee $l8
                                    local.get $l12
                                    i32.add
                                    local.get $l11
                                    i32.gt_u
                                    br_if $B57
                                    local.get $l12
                                    i32.const 1
                                    i32.add
                                    local.set $l18
                                    local.get $l9
                                    i32.const 63
                                    i32.and
                                    local.set $l9
                                    block $B58
                                      local.get $l5
                                      i32.eqz
                                      br_if $B58
                                      local.get $l8
                                      i32.const 2
                                      local.get $l8
                                      i32.const 2
                                      i32.gt_u
                                      select
                                      local.tee $l15
                                      i32.const -1
                                      i32.add
                                      local.set $l8
                                      block $B59
                                        local.get $l15
                                        i32.const -2
                                        i32.add
                                        i32.const 3
                                        i32.lt_u
                                        br_if $B59
                                        local.get $l8
                                        i32.const -4
                                        i32.and
                                        local.set $l9
                                        local.get $l12
                                        local.set $l5
                                        loop $L60
                                          local.get $l5
                                          i32.const 4
                                          i32.add
                                          local.set $l5
                                          local.get $l9
                                          i32.const -4
                                          i32.add
                                          local.tee $l9
                                          br_if $L60
                                        end
                                        local.get $l10
                                        local.get $l5
                                        i32.add
                                        i32.load align=1
                                        local.tee $l9
                                        i32.const 16711935
                                        i32.and
                                        i32.const 8
                                        i32.rotr
                                        local.get $l9
                                        i32.const 24
                                        i32.rotr
                                        i32.const 16711935
                                        i32.and
                                        i32.or
                                        local.set $l9
                                        local.get $l5
                                        i32.const 1
                                        i32.add
                                        local.set $l18
                                      end
                                      local.get $l8
                                      i32.const 3
                                      i32.and
                                      local.set $l8
                                      local.get $l17
                                      local.get $l18
                                      i32.add
                                      local.set $l5
                                      loop $L61
                                        local.get $l9
                                        i32.const 8
                                        i32.shl
                                        local.get $l5
                                        i32.load8_u
                                        i32.or
                                        local.set $l9
                                        local.get $l5
                                        i32.const 1
                                        i32.add
                                        local.set $l5
                                        local.get $l8
                                        i32.const -1
                                        i32.add
                                        local.tee $l8
                                        br_if $L61
                                      end
                                      local.get $l15
                                      local.get $l12
                                      i32.add
                                      local.set $l18
                                    end
                                    local.get $p2
                                    local.get $p2
                                    i32.load offset=72
                                    i32.const 1
                                    i32.add
                                    i32.store offset=72
                                    local.get $l9
                                    i32.const 248
                                    i32.and
                                    i32.const 8
                                    i32.ne
                                    br_if $B52
                                    local.get $l18
                                    local.get $l11
                                    i32.ge_u
                                    br_if $B56
                                    local.get $l13
                                    local.get $l18
                                    i32.add
                                    i32.load8_u
                                    local.tee $l8
                                    i32.const 6
                                    i32.shr_u
                                    local.tee $l5
                                    i32.const 3
                                    i32.eq
                                    br_if $B56
                                    i32.const 1
                                    local.get $l5
                                    i32.shl
                                    local.tee $l12
                                    local.get $l18
                                    i32.add
                                    local.get $l11
                                    i32.gt_u
                                    br_if $B56
                                    local.get $l18
                                    i32.const 1
                                    i32.add
                                    local.set $l15
                                    local.get $l8
                                    i32.const 63
                                    i32.and
                                    local.set $l8
                                    block $B62
                                      local.get $l5
                                      i32.eqz
                                      br_if $B62
                                      local.get $l12
                                      i32.const 2
                                      local.get $l12
                                      i32.const 2
                                      i32.gt_u
                                      select
                                      local.tee $l16
                                      i32.const -1
                                      i32.add
                                      local.set $l12
                                      block $B63
                                        local.get $l16
                                        i32.const -2
                                        i32.add
                                        i32.const 3
                                        i32.lt_u
                                        br_if $B63
                                        local.get $l12
                                        i32.const -4
                                        i32.and
                                        local.set $l8
                                        local.get $l18
                                        local.set $l5
                                        loop $L64
                                          local.get $l5
                                          i32.const 4
                                          i32.add
                                          local.set $l5
                                          local.get $l8
                                          i32.const -4
                                          i32.add
                                          local.tee $l8
                                          br_if $L64
                                        end
                                        local.get $l10
                                        local.get $l5
                                        i32.add
                                        i32.load align=1
                                        local.tee $l8
                                        i32.const 16711935
                                        i32.and
                                        i32.const 8
                                        i32.rotr
                                        local.get $l8
                                        i32.const 24
                                        i32.rotr
                                        i32.const 16711935
                                        i32.and
                                        i32.or
                                        local.set $l8
                                        local.get $l5
                                        i32.const 1
                                        i32.add
                                        local.set $l15
                                      end
                                      local.get $l12
                                      i32.const 3
                                      i32.and
                                      local.set $l12
                                      local.get $l17
                                      local.get $l15
                                      i32.add
                                      local.set $l5
                                      loop $L65
                                        local.get $l8
                                        i32.const 8
                                        i32.shl
                                        local.get $l5
                                        i32.load8_u
                                        i32.or
                                        local.set $l8
                                        local.get $l5
                                        i32.const 1
                                        i32.add
                                        local.set $l5
                                        local.get $l12
                                        i32.const -1
                                        i32.add
                                        local.tee $l12
                                        br_if $L65
                                      end
                                      local.get $l16
                                      local.get $l18
                                      i32.add
                                      local.set $l15
                                    end
                                    local.get $l9
                                    i32.const 4
                                    i32.and
                                    i32.eqz
                                    br_if $B53
                                    local.get $l15
                                    local.get $l11
                                    i32.ge_u
                                    br_if $B55
                                    local.get $l13
                                    local.get $l15
                                    i32.add
                                    i32.load8_u
                                    i32.const 6
                                    i32.shr_u
                                    local.tee $l5
                                    i32.const 3
                                    i32.eq
                                    br_if $B55
                                    i32.const 1
                                    local.get $l5
                                    i32.shl
                                    local.tee $l12
                                    local.get $l15
                                    i32.add
                                    local.get $l11
                                    i32.gt_u
                                    br_if $B55
                                    local.get $l5
                                    br_if $B54
                                    local.get $l15
                                    i32.const 1
                                    i32.add
                                    local.set $l15
                                    br $B53
                                  end
                                  local.get $p2
                                  local.get $l14
                                  i32.const 1
                                  i32.add
                                  local.tee $l5
                                  i32.store offset=120
                                  local.get $p2
                                  local.get $p2
                                  i32.load offset=124
                                  i32.const 1
                                  i32.add
                                  i32.store offset=124
                                  local.get $l14
                                  i32.const 32
                                  i32.ge_u
                                  br_if $B9
                                  i32.const 32788
                                  local.set $l9
                                  br $B10
                                end
                                local.get $p2
                                local.get $l14
                                i32.const 1
                                i32.add
                                local.tee $l5
                                i32.store offset=120
                                local.get $p2
                                local.get $p2
                                i32.load offset=124
                                i32.const 1
                                i32.add
                                i32.store offset=124
                                local.get $l14
                                i32.const 32
                                i32.ge_u
                                br_if $B9
                                i32.const 32789
                                local.set $l9
                                br $B10
                              end
                              local.get $p2
                              local.get $l14
                              i32.const 1
                              i32.add
                              local.tee $l5
                              i32.store offset=120
                              local.get $p2
                              local.get $p2
                              i32.load offset=124
                              i32.const 1
                              i32.add
                              i32.store offset=124
                              local.get $l14
                              i32.const 32
                              i32.ge_u
                              br_if $B9
                              i32.const 32790
                              local.set $l9
                              br $B10
                            end
                            local.get $l12
                            i32.const 2
                            local.get $l12
                            i32.const 2
                            i32.gt_u
                            select
                            local.get $l15
                            i32.add
                            local.set $l15
                          end
                          block $B66
                            block $B67
                              block $B68
                                block $B69
                                  local.get $l9
                                  i32.const 2
                                  i32.and
                                  br_if $B69
                                  local.get $l11
                                  local.get $l15
                                  i32.sub
                                  local.set $l5
                                  br $B68
                                end
                                local.get $l11
                                local.get $l15
                                i32.le_u
                                br_if $B67
                                local.get $l13
                                local.get $l15
                                i32.add
                                i32.load8_u
                                local.tee $l5
                                i32.const 6
                                i32.shr_u
                                local.tee $l12
                                i32.const 3
                                i32.eq
                                br_if $B67
                                i32.const 1
                                local.get $l12
                                i32.shl
                                local.tee $l18
                                local.get $l15
                                i32.add
                                local.get $l11
                                i32.gt_u
                                br_if $B67
                                local.get $l15
                                i32.const 1
                                i32.add
                                local.set $l16
                                local.get $l5
                                i32.const 63
                                i32.and
                                local.set $l5
                                block $B70
                                  local.get $l12
                                  br_if $B70
                                  local.get $l16
                                  local.set $l15
                                  br $B68
                                end
                                local.get $l18
                                i32.const 2
                                local.get $l18
                                i32.const 2
                                i32.gt_u
                                select
                                local.tee $l19
                                i32.const -1
                                i32.add
                                local.set $l18
                                block $B71
                                  local.get $l19
                                  i32.const -2
                                  i32.add
                                  i32.const 3
                                  i32.lt_u
                                  br_if $B71
                                  local.get $l18
                                  i32.const -4
                                  i32.and
                                  local.set $l5
                                  local.get $l15
                                  local.set $l12
                                  loop $L72
                                    local.get $l12
                                    i32.const 4
                                    i32.add
                                    local.set $l12
                                    local.get $l5
                                    i32.const -4
                                    i32.add
                                    local.tee $l5
                                    br_if $L72
                                  end
                                  local.get $l10
                                  local.get $l12
                                  i32.add
                                  i32.load align=1
                                  local.tee $l5
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
                                  local.set $l5
                                  local.get $l12
                                  i32.const 1
                                  i32.add
                                  local.set $l16
                                end
                                local.get $l18
                                i32.const 3
                                i32.and
                                local.set $l18
                                local.get $l17
                                local.get $l16
                                i32.add
                                local.set $l12
                                loop $L73
                                  local.get $l5
                                  i32.const 8
                                  i32.shl
                                  local.get $l12
                                  i32.load8_u
                                  i32.or
                                  local.set $l5
                                  local.get $l12
                                  i32.const 1
                                  i32.add
                                  local.set $l12
                                  local.get $l18
                                  i32.const -1
                                  i32.add
                                  local.tee $l18
                                  br_if $L73
                                end
                                local.get $l19
                                local.get $l15
                                i32.add
                                local.set $l15
                              end
                              local.get $l15
                              local.get $l5
                              i32.add
                              local.tee $l12
                              local.get $l11
                              i32.le_u
                              br_if $B66
                              local.get $p2
                              local.get $l14
                              i32.const 1
                              i32.add
                              local.tee $l5
                              i32.store offset=120
                              local.get $p2
                              local.get $p2
                              i32.load offset=124
                              i32.const 1
                              i32.add
                              i32.store offset=124
                              local.get $l14
                              i32.const 32
                              i32.ge_u
                              br_if $B9
                              i32.const 32792
                              local.set $l9
                              br $B10
                            end
                            local.get $p2
                            local.get $l14
                            i32.const 1
                            i32.add
                            local.tee $l5
                            i32.store offset=120
                            local.get $p2
                            local.get $p2
                            i32.load offset=124
                            i32.const 1
                            i32.add
                            i32.store offset=124
                            local.get $l14
                            i32.const 32
                            i32.ge_u
                            br_if $B9
                            i32.const 32791
                            local.set $l9
                            br $B10
                          end
                          local.get $p2
                          local.get $p2
                          i32.load offset=76
                          i32.const 1
                          i32.add
                          i32.store offset=76
                          local.get $p2
                          local.get $p2
                          i32.load offset=112
                          local.get $l5
                          i32.add
                          i32.store offset=112
                          block $B74
                            local.get $l8
                            i32.const 2
                            i32.ne
                            br_if $B74
                            local.get $l5
                            i32.eqz
                            br_if $B74
                            local.get $l13
                            local.get $l15
                            i32.add
                            local.set $l15
                            i32.const 0
                            local.set $l8
                            block $B75
                              block $B76
                                loop $L77
                                  block $B78
                                    block $B79
                                      block $B80
                                        block $B81
                                          block $B82
                                            block $B83
                                              local.get $l15
                                              local.get $l8
                                              i32.add
                                              i32.load8_u
                                              local.tee $l18
                                              i32.const 224
                                              i32.and
                                              local.tee $l16
                                              i32.const 32
                                              i32.ne
                                              br_if $B83
                                              local.get $l8
                                              i32.const 1
                                              i32.add
                                              local.set $l16
                                              block $B84
                                                local.get $l18
                                                i32.const 31
                                                i32.and
                                                local.tee $l18
                                                i32.const 31
                                                i32.eq
                                                br_if $B84
                                                local.get $l16
                                                local.set $l8
                                                br $B81
                                              end
                                              local.get $l16
                                              local.get $l5
                                              i32.lt_u
                                              br_if $B82
                                              br $B80
                                            end
                                            block $B85
                                              local.get $l18
                                              i32.const 192
                                              i32.and
                                              i32.const 64
                                              i32.ne
                                              br_if $B85
                                              local.get $l8
                                              i32.const 1
                                              i32.add
                                              local.set $l19
                                              block $B86
                                                local.get $l18
                                                i32.const 31
                                                i32.and
                                                local.tee $l16
                                                i32.const 31
                                                i32.ne
                                                br_if $B86
                                                block $B87
                                                  block $B88
                                                    local.get $l19
                                                    local.get $l5
                                                    i32.ge_u
                                                    br_if $B88
                                                    local.get $l8
                                                    i32.const 2
                                                    i32.add
                                                    local.set $l18
                                                    local.get $l15
                                                    local.get $l19
                                                    i32.add
                                                    i32.load8_s
                                                    local.tee $l19
                                                    i32.const 127
                                                    i32.and
                                                    i32.const 31
                                                    i32.add
                                                    local.set $l16
                                                    local.get $l19
                                                    i32.const 0
                                                    i32.ge_s
                                                    br_if $B87
                                                    local.get $l18
                                                    local.get $l5
                                                    i32.ge_u
                                                    br_if $B88
                                                    local.get $l8
                                                    i32.const 3
                                                    i32.add
                                                    local.set $l19
                                                    local.get $l15
                                                    local.get $l18
                                                    i32.add
                                                    i32.load8_s
                                                    local.tee $l18
                                                    i32.const 127
                                                    i32.and
                                                    i32.const 7
                                                    i32.shl
                                                    local.get $l16
                                                    i32.add
                                                    local.set $l16
                                                    local.get $l18
                                                    i32.const -1
                                                    i32.gt_s
                                                    br_if $B86
                                                    local.get $l19
                                                    local.get $l5
                                                    i32.ge_u
                                                    br_if $B88
                                                    local.get $l8
                                                    i32.const 4
                                                    i32.add
                                                    local.set $l18
                                                    local.get $l15
                                                    local.get $l19
                                                    i32.add
                                                    i32.load8_s
                                                    local.tee $l19
                                                    i32.const 127
                                                    i32.and
                                                    i32.const 14
                                                    i32.shl
                                                    local.get $l16
                                                    i32.add
                                                    local.set $l16
                                                    block $B89
                                                      local.get $l19
                                                      i32.const -1
                                                      i32.le_s
                                                      br_if $B89
                                                      local.get $l18
                                                      local.set $l19
                                                      br $B86
                                                    end
                                                    local.get $l18
                                                    local.get $l5
                                                    i32.ge_u
                                                    br_if $B88
                                                    local.get $l8
                                                    i32.const 5
                                                    i32.add
                                                    local.set $l19
                                                    local.get $l15
                                                    local.get $l18
                                                    i32.add
                                                    i32.load8_s
                                                    local.tee $l18
                                                    i32.const 127
                                                    i32.and
                                                    i32.const 21
                                                    i32.shl
                                                    local.get $l16
                                                    i32.add
                                                    local.set $l16
                                                    local.get $l18
                                                    i32.const -1
                                                    i32.gt_s
                                                    br_if $B86
                                                    local.get $l19
                                                    local.get $l5
                                                    i32.ge_u
                                                    br_if $B88
                                                    local.get $l15
                                                    local.get $l19
                                                    i32.add
                                                    i32.load8_s
                                                    local.tee $l18
                                                    i32.const 0
                                                    i32.lt_s
                                                    br_if $B88
                                                    local.get $l8
                                                    i32.const 6
                                                    i32.add
                                                    local.set $l19
                                                    local.get $l18
                                                    i32.const 28
                                                    i32.shl
                                                    local.get $l16
                                                    i32.add
                                                    local.set $l16
                                                    br $B86
                                                  end
                                                  local.get $p2
                                                  local.get $p2
                                                  i32.load offset=124
                                                  i32.const 1
                                                  i32.add
                                                  i32.store offset=124
                                                  local.get $l14
                                                  i32.const 1
                                                  i32.add
                                                  local.set $l5
                                                  local.get $l14
                                                  i32.const 32
                                                  i32.ge_u
                                                  br_if $B75
                                                  i32.const 32800
                                                  local.set $l8
                                                  br $B76
                                                end
                                                local.get $l18
                                                local.set $l19
                                              end
                                              block $B90
                                                local.get $l16
                                                local.get $l19
                                                i32.add
                                                local.tee $l8
                                                local.get $l5
                                                i32.le_u
                                                br_if $B90
                                                local.get $p2
                                                local.get $p2
                                                i32.load offset=124
                                                i32.const 1
                                                i32.add
                                                i32.store offset=124
                                                local.get $l14
                                                i32.const 1
                                                i32.add
                                                local.set $l5
                                                local.get $l14
                                                i32.const 32
                                                i32.ge_u
                                                br_if $B75
                                                i32.const 32801
                                                local.set $l8
                                                br $B76
                                              end
                                              block $B91
                                                block $B92
                                                  block $B93
                                                    local.get $l8
                                                    local.get $l5
                                                    i32.ge_u
                                                    br_if $B93
                                                    local.get $l8
                                                    i32.const 1
                                                    i32.add
                                                    local.set $l18
                                                    local.get $l15
                                                    local.get $l8
                                                    i32.add
                                                    i32.load8_u
                                                    i32.const 127
                                                    i32.and
                                                    local.tee $l19
                                                    i32.const 127
                                                    i32.ne
                                                    br_if $B91
                                                    local.get $l18
                                                    local.get $l5
                                                    i32.ge_u
                                                    br_if $B93
                                                    local.get $l8
                                                    i32.const 2
                                                    i32.add
                                                    local.set $l20
                                                    local.get $l15
                                                    local.get $l18
                                                    i32.add
                                                    i32.load8_s
                                                    local.tee $l18
                                                    i32.const 127
                                                    i32.and
                                                    i32.const 127
                                                    i32.add
                                                    local.set $l19
                                                    local.get $l18
                                                    i32.const 0
                                                    i32.ge_s
                                                    br_if $B92
                                                    local.get $l20
                                                    local.get $l5
                                                    i32.ge_u
                                                    br_if $B93
                                                    local.get $l8
                                                    i32.const 3
                                                    i32.add
                                                    local.set $l18
                                                    local.get $l15
                                                    local.get $l20
                                                    i32.add
                                                    i32.load8_s
                                                    local.tee $l20
                                                    i32.const 127
                                                    i32.and
                                                    i32.const 7
                                                    i32.shl
                                                    local.get $l19
                                                    i32.add
                                                    local.set $l19
                                                    local.get $l20
                                                    i32.const -1
                                                    i32.gt_s
                                                    br_if $B91
                                                    local.get $l18
                                                    local.get $l5
                                                    i32.ge_u
                                                    br_if $B93
                                                    local.get $l8
                                                    i32.const 4
                                                    i32.add
                                                    local.set $l20
                                                    local.get $l15
                                                    local.get $l18
                                                    i32.add
                                                    i32.load8_s
                                                    local.tee $l18
                                                    i32.const 127
                                                    i32.and
                                                    i32.const 14
                                                    i32.shl
                                                    local.get $l19
                                                    i32.add
                                                    local.set $l19
                                                    block $B94
                                                      local.get $l18
                                                      i32.const -1
                                                      i32.le_s
                                                      br_if $B94
                                                      local.get $l20
                                                      local.set $l18
                                                      br $B91
                                                    end
                                                    local.get $l20
                                                    local.get $l5
                                                    i32.ge_u
                                                    br_if $B93
                                                    local.get $l8
                                                    i32.const 5
                                                    i32.add
                                                    local.set $l18
                                                    local.get $l15
                                                    local.get $l20
                                                    i32.add
                                                    i32.load8_s
                                                    local.tee $l20
                                                    i32.const 127
                                                    i32.and
                                                    i32.const 21
                                                    i32.shl
                                                    local.get $l19
                                                    i32.add
                                                    local.set $l19
                                                    local.get $l20
                                                    i32.const -1
                                                    i32.gt_s
                                                    br_if $B91
                                                    local.get $l18
                                                    local.get $l5
                                                    i32.ge_u
                                                    br_if $B93
                                                    local.get $l15
                                                    local.get $l18
                                                    i32.add
                                                    i32.load8_s
                                                    local.tee $l20
                                                    i32.const 0
                                                    i32.lt_s
                                                    br_if $B93
                                                    local.get $l8
                                                    i32.const 6
                                                    i32.add
                                                    local.set $l18
                                                    local.get $l20
                                                    i32.const 28
                                                    i32.shl
                                                    local.get $l19
                                                    i32.add
                                                    local.set $l19
                                                    br $B91
                                                  end
                                                  local.get $p2
                                                  local.get $p2
                                                  i32.load offset=124
                                                  i32.const 1
                                                  i32.add
                                                  i32.store offset=124
                                                  local.get $l14
                                                  i32.const 1
                                                  i32.add
                                                  local.set $l5
                                                  local.get $l14
                                                  i32.const 32
                                                  i32.ge_u
                                                  br_if $B75
                                                  i32.const 32802
                                                  local.set $l8
                                                  br $B76
                                                end
                                                local.get $l20
                                                local.set $l18
                                              end
                                              block $B95
                                                local.get $l19
                                                local.get $l18
                                                i32.add
                                                local.tee $l8
                                                local.get $l5
                                                i32.le_u
                                                br_if $B95
                                                local.get $p2
                                                local.get $p2
                                                i32.load offset=124
                                                i32.const 1
                                                i32.add
                                                i32.store offset=124
                                                local.get $l14
                                                i32.const 1
                                                i32.add
                                                local.set $l5
                                                local.get $l14
                                                i32.const 32
                                                i32.ge_u
                                                br_if $B75
                                                i32.const 32803
                                                local.set $l8
                                                br $B76
                                              end
                                              local.get $p2
                                              local.get $l14
                                              i32.const 1
                                              i32.add
                                              local.tee $l18
                                              i32.store offset=120
                                              local.get $p2
                                              local.get $p2
                                              i32.load offset=100
                                              i32.const 1
                                              i32.add
                                              i32.store offset=100
                                              local.get $p2
                                              local.get $l16
                                              local.get $l19
                                              i32.add
                                              local.get $p2
                                              i32.load offset=108
                                              i32.add
                                              i32.const 32
                                              i32.add
                                              i32.store offset=108
                                              local.get $l14
                                              i32.const 32
                                              i32.ge_u
                                              br_if $B78
                                              i32.const 8706
                                              local.set $l16
                                              br $B79
                                            end
                                            block $B96
                                              block $B97
                                                block $B98
                                                  block $B99
                                                    block $B100
                                                      block $B101
                                                        local.get $l16
                                                        br_if $B101
                                                        local.get $l8
                                                        i32.const 1
                                                        i32.add
                                                        local.set $l16
                                                        block $B102
                                                          local.get $l18
                                                          i32.const 31
                                                          i32.eq
                                                          br_if $B102
                                                          local.get $l16
                                                          local.set $l8
                                                          br $B99
                                                        end
                                                        local.get $l16
                                                        local.get $l5
                                                        i32.lt_u
                                                        br_if $B100
                                                        br $B98
                                                      end
                                                      local.get $p2
                                                      local.get $p2
                                                      i32.load offset=124
                                                      i32.const 1
                                                      i32.add
                                                      i32.store offset=124
                                                      local.get $l14
                                                      i32.const 1
                                                      i32.add
                                                      local.set $l5
                                                      local.get $l14
                                                      i32.const 32
                                                      i32.ge_u
                                                      br_if $B75
                                                      i32.const 32806
                                                      local.set $l8
                                                      br $B76
                                                    end
                                                    local.get $l8
                                                    i32.const 2
                                                    i32.add
                                                    local.set $l19
                                                    local.get $l15
                                                    local.get $l16
                                                    i32.add
                                                    i32.load8_s
                                                    local.tee $l16
                                                    i32.const 127
                                                    i32.and
                                                    i32.const 31
                                                    i32.add
                                                    local.set $l18
                                                    block $B103
                                                      local.get $l16
                                                      i32.const 0
                                                      i32.lt_s
                                                      br_if $B103
                                                      local.get $l19
                                                      local.set $l8
                                                      br $B99
                                                    end
                                                    local.get $l19
                                                    local.get $l5
                                                    i32.ge_u
                                                    br_if $B98
                                                    local.get $l8
                                                    i32.const 3
                                                    i32.add
                                                    local.set $l16
                                                    local.get $l15
                                                    local.get $l19
                                                    i32.add
                                                    i32.load8_s
                                                    local.tee $l19
                                                    i32.const 127
                                                    i32.and
                                                    i32.const 7
                                                    i32.shl
                                                    local.get $l18
                                                    i32.add
                                                    local.set $l18
                                                    block $B104
                                                      local.get $l19
                                                      i32.const -1
                                                      i32.le_s
                                                      br_if $B104
                                                      local.get $l16
                                                      local.set $l8
                                                      br $B99
                                                    end
                                                    local.get $l16
                                                    local.get $l5
                                                    i32.ge_u
                                                    br_if $B98
                                                    local.get $l8
                                                    i32.const 4
                                                    i32.add
                                                    local.set $l19
                                                    local.get $l15
                                                    local.get $l16
                                                    i32.add
                                                    i32.load8_s
                                                    local.tee $l16
                                                    i32.const 127
                                                    i32.and
                                                    i32.const 14
                                                    i32.shl
                                                    local.get $l18
                                                    i32.add
                                                    local.set $l18
                                                    block $B105
                                                      local.get $l16
                                                      i32.const -1
                                                      i32.le_s
                                                      br_if $B105
                                                      local.get $l19
                                                      local.set $l8
                                                      br $B99
                                                    end
                                                    local.get $l19
                                                    local.get $l5
                                                    i32.ge_u
                                                    br_if $B98
                                                    local.get $l8
                                                    i32.const 5
                                                    i32.add
                                                    local.set $l16
                                                    local.get $l15
                                                    local.get $l19
                                                    i32.add
                                                    i32.load8_s
                                                    local.tee $l19
                                                    i32.const 127
                                                    i32.and
                                                    i32.const 21
                                                    i32.shl
                                                    local.get $l18
                                                    i32.add
                                                    local.set $l18
                                                    block $B106
                                                      local.get $l19
                                                      i32.const -1
                                                      i32.le_s
                                                      br_if $B106
                                                      local.get $l16
                                                      local.set $l8
                                                      br $B99
                                                    end
                                                    local.get $l16
                                                    local.get $l5
                                                    i32.ge_u
                                                    br_if $B98
                                                    local.get $l15
                                                    local.get $l16
                                                    i32.add
                                                    i32.load8_s
                                                    local.tee $l16
                                                    i32.const 0
                                                    i32.lt_s
                                                    br_if $B98
                                                    local.get $l8
                                                    i32.const 6
                                                    i32.add
                                                    local.set $l8
                                                    local.get $l16
                                                    i32.const 28
                                                    i32.shl
                                                    local.get $l18
                                                    i32.add
                                                    local.set $l18
                                                  end
                                                  local.get $l18
                                                  local.get $p2
                                                  i32.load offset=100
                                                  i32.lt_u
                                                  br_if $B97
                                                  local.get $p2
                                                  local.get $p2
                                                  i32.load offset=124
                                                  i32.const 1
                                                  i32.add
                                                  i32.store offset=124
                                                  local.get $l14
                                                  i32.const 1
                                                  i32.add
                                                  local.set $l19
                                                  local.get $l14
                                                  i32.const 31
                                                  i32.gt_u
                                                  br_if $B96
                                                  local.get $p2
                                                  local.get $l14
                                                  i32.const 2
                                                  i32.shl
                                                  i32.add
                                                  i32.const 32805
                                                  i32.store offset=128
                                                  br $B96
                                                end
                                                local.get $p2
                                                local.get $p2
                                                i32.load offset=124
                                                i32.const 1
                                                i32.add
                                                i32.store offset=124
                                                local.get $l14
                                                i32.const 1
                                                i32.add
                                                local.set $l5
                                                local.get $l14
                                                i32.const 32
                                                i32.ge_u
                                                br_if $B75
                                                i32.const 32804
                                                local.set $l8
                                                br $B76
                                              end
                                              local.get $p2
                                              local.get $p2
                                              i32.load offset=104
                                              i32.const 1
                                              i32.add
                                              i32.store offset=104
                                              local.get $p2
                                              local.get $p2
                                              i32.load offset=108
                                              i32.const 1
                                              i32.shl
                                              i32.store offset=108
                                              local.get $l14
                                              local.set $l19
                                            end
                                            local.get $p2
                                            local.get $l19
                                            i32.const 1
                                            i32.add
                                            local.tee $l18
                                            i32.store offset=120
                                            local.get $l19
                                            i32.const 32
                                            i32.ge_u
                                            br_if $B78
                                            i32.const 8707
                                            local.set $l16
                                            local.get $l19
                                            local.set $l14
                                            br $B79
                                          end
                                          local.get $l8
                                          i32.const 2
                                          i32.add
                                          local.set $l19
                                          local.get $l15
                                          local.get $l16
                                          i32.add
                                          i32.load8_s
                                          local.tee $l16
                                          i32.const 127
                                          i32.and
                                          i32.const 31
                                          i32.add
                                          local.set $l18
                                          block $B107
                                            local.get $l16
                                            i32.const 0
                                            i32.lt_s
                                            br_if $B107
                                            local.get $l19
                                            local.set $l8
                                            br $B81
                                          end
                                          local.get $l19
                                          local.get $l5
                                          i32.ge_u
                                          br_if $B80
                                          local.get $l8
                                          i32.const 3
                                          i32.add
                                          local.set $l16
                                          local.get $l15
                                          local.get $l19
                                          i32.add
                                          i32.load8_s
                                          local.tee $l19
                                          i32.const 127
                                          i32.and
                                          i32.const 7
                                          i32.shl
                                          local.get $l18
                                          i32.add
                                          local.set $l18
                                          block $B108
                                            local.get $l19
                                            i32.const -1
                                            i32.le_s
                                            br_if $B108
                                            local.get $l16
                                            local.set $l8
                                            br $B81
                                          end
                                          local.get $l16
                                          local.get $l5
                                          i32.ge_u
                                          br_if $B80
                                          local.get $l8
                                          i32.const 4
                                          i32.add
                                          local.set $l19
                                          local.get $l15
                                          local.get $l16
                                          i32.add
                                          i32.load8_s
                                          local.tee $l16
                                          i32.const 127
                                          i32.and
                                          i32.const 14
                                          i32.shl
                                          local.get $l18
                                          i32.add
                                          local.set $l18
                                          block $B109
                                            local.get $l16
                                            i32.const -1
                                            i32.le_s
                                            br_if $B109
                                            local.get $l19
                                            local.set $l8
                                            br $B81
                                          end
                                          local.get $l19
                                          local.get $l5
                                          i32.ge_u
                                          br_if $B80
                                          local.get $l8
                                          i32.const 5
                                          i32.add
                                          local.set $l16
                                          local.get $l15
                                          local.get $l19
                                          i32.add
                                          i32.load8_s
                                          local.tee $l19
                                          i32.const 127
                                          i32.and
                                          i32.const 21
                                          i32.shl
                                          local.get $l18
                                          i32.add
                                          local.set $l18
                                          block $B110
                                            local.get $l19
                                            i32.const -1
                                            i32.le_s
                                            br_if $B110
                                            local.get $l16
                                            local.set $l8
                                            br $B81
                                          end
                                          local.get $l16
                                          local.get $l5
                                          i32.ge_u
                                          br_if $B80
                                          local.get $l15
                                          local.get $l16
                                          i32.add
                                          i32.load8_s
                                          local.tee $l16
                                          i32.const 0
                                          i32.lt_s
                                          br_if $B80
                                          local.get $l8
                                          i32.const 6
                                          i32.add
                                          local.set $l8
                                          local.get $l16
                                          i32.const 28
                                          i32.shl
                                          local.get $l18
                                          i32.add
                                          local.set $l18
                                        end
                                        local.get $p2
                                        local.get $l18
                                        i32.store offset=96
                                        local.get $p2
                                        local.get $l14
                                        i32.const 1
                                        i32.add
                                        local.tee $l18
                                        i32.store offset=120
                                        local.get $l14
                                        i32.const 32
                                        i32.ge_u
                                        br_if $B78
                                        i32.const 8705
                                        local.set $l16
                                        br $B79
                                      end
                                      local.get $p2
                                      local.get $p2
                                      i32.load offset=124
                                      i32.const 1
                                      i32.add
                                      i32.store offset=124
                                      local.get $l14
                                      i32.const 1
                                      i32.add
                                      local.set $l5
                                      local.get $l14
                                      i32.const 32
                                      i32.ge_u
                                      br_if $B75
                                      i32.const 32799
                                      local.set $l8
                                      br $B76
                                    end
                                    local.get $p2
                                    local.get $l14
                                    i32.const 2
                                    i32.shl
                                    i32.add
                                    local.get $l16
                                    i32.store offset=128
                                  end
                                  local.get $l18
                                  local.set $l14
                                  local.get $l8
                                  local.get $l5
                                  i32.lt_u
                                  br_if $L77
                                  br $B74
                                end
                              end
                              local.get $p2
                              local.get $l14
                              i32.const 2
                              i32.shl
                              i32.add
                              local.get $l8
                              i32.store offset=128
                            end
                            local.get $l5
                            local.set $l14
                          end
                          local.get $p2
                          local.get $l14
                          i32.const 1
                          i32.add
                          local.tee $l5
                          i32.store offset=120
                          local.get $l14
                          i32.const 31
                          i32.gt_u
                          br_if $B50
                          local.get $l9
                          i32.const 7
                          i32.and
                          i32.const 520
                          i32.or
                          local.set $l9
                          br $B51
                        end
                        block $B111
                          block $B112
                            block $B113
                              block $B114
                                block $B115
                                  block $B116
                                    block $B117
                                      block $B118
                                        local.get $l9
                                        i32.const -2
                                        i32.add
                                        br_table $B118 $B114 $B116 $B114 $B114 $B114 $B114 $B114 $B114 $B114 $B114 $B114 $B114 $B114 $B117 $B114 $B114 $B114 $B114 $B114 $B114 $B114 $B114 $B114 $B114 $B114 $B115 $B114
                                      end
                                      local.get $l18
                                      local.get $l11
                                      i32.ge_u
                                      br_if $B111
                                      local.get $l13
                                      local.get $l18
                                      i32.add
                                      i32.load8_u
                                      i32.const 6
                                      i32.shr_u
                                      local.tee $l5
                                      i32.const 3
                                      i32.eq
                                      br_if $B111
                                      i32.const 1
                                      local.get $l5
                                      i32.shl
                                      local.tee $l9
                                      local.get $l18
                                      i32.add
                                      local.get $l11
                                      i32.gt_u
                                      br_if $B111
                                      local.get $l9
                                      i32.const 2
                                      local.get $l9
                                      i32.const 2
                                      i32.gt_u
                                      select
                                      i32.const 1
                                      local.get $l5
                                      select
                                      local.get $l18
                                      i32.add
                                      local.tee $l5
                                      local.get $l11
                                      i32.ge_u
                                      br_if $B111
                                      local.get $l13
                                      local.get $l5
                                      i32.add
                                      i32.load8_u
                                      i32.const 6
                                      i32.shr_u
                                      local.tee $l9
                                      i32.const 3
                                      i32.eq
                                      br_if $B111
                                      i32.const 1
                                      local.get $l9
                                      i32.shl
                                      local.tee $l8
                                      local.get $l5
                                      i32.add
                                      local.get $l11
                                      i32.gt_u
                                      br_if $B111
                                      local.get $l8
                                      i32.const 2
                                      local.get $l8
                                      i32.const 2
                                      i32.gt_u
                                      select
                                      i32.const 1
                                      local.get $l9
                                      select
                                      local.get $l5
                                      i32.add
                                      local.tee $l5
                                      local.get $l11
                                      i32.ge_u
                                      br_if $B111
                                      local.get $l13
                                      local.get $l5
                                      i32.add
                                      i32.load8_u
                                      i32.const 6
                                      i32.shr_u
                                      local.tee $l9
                                      i32.const 3
                                      i32.eq
                                      br_if $B111
                                      i32.const 1
                                      local.get $l9
                                      i32.shl
                                      local.tee $l8
                                      local.get $l5
                                      i32.add
                                      local.get $l11
                                      i32.gt_u
                                      br_if $B111
                                      local.get $l8
                                      i32.const 2
                                      local.get $l8
                                      i32.const 2
                                      i32.gt_u
                                      select
                                      i32.const 1
                                      local.get $l9
                                      select
                                      local.get $l5
                                      i32.add
                                      local.tee $l9
                                      local.get $l11
                                      i32.ge_u
                                      br_if $B111
                                      local.get $l13
                                      local.get $l9
                                      i32.add
                                      i32.load8_u
                                      i32.const 6
                                      i32.shr_u
                                      local.tee $l8
                                      i32.const 3
                                      i32.eq
                                      br_if $B111
                                      i32.const 1
                                      local.get $l8
                                      i32.shl
                                      local.tee $l12
                                      local.get $l9
                                      i32.add
                                      local.get $l11
                                      i32.gt_u
                                      br_if $B111
                                      local.get $p2
                                      local.get $l14
                                      i32.const 1
                                      i32.add
                                      local.tee $l5
                                      i32.store offset=120
                                      local.get $p2
                                      local.get $p2
                                      i32.load offset=80
                                      i32.const 1
                                      i32.add
                                      i32.store offset=80
                                      local.get $l12
                                      i32.const 2
                                      local.get $l12
                                      i32.const 2
                                      i32.gt_u
                                      select
                                      i32.const 1
                                      local.get $l8
                                      select
                                      local.get $l9
                                      i32.add
                                      local.set $l12
                                      local.get $l14
                                      i32.const 32
                                      i32.ge_u
                                      br_if $B50
                                      i32.const 514
                                      local.set $l9
                                      br $B51
                                    end
                                    block $B119
                                      local.get $l18
                                      local.get $l11
                                      i32.ge_u
                                      br_if $B119
                                      local.get $l13
                                      local.get $l18
                                      i32.add
                                      i32.load8_u
                                      local.tee $l9
                                      i32.const 6
                                      i32.shr_u
                                      local.tee $l5
                                      i32.const 3
                                      i32.eq
                                      br_if $B119
                                      i32.const 1
                                      local.get $l5
                                      i32.shl
                                      local.tee $l8
                                      local.get $l18
                                      i32.add
                                      local.get $l11
                                      i32.gt_u
                                      br_if $B119
                                      local.get $l18
                                      i32.const 1
                                      i32.add
                                      local.set $l12
                                      local.get $l9
                                      i32.const 63
                                      i32.and
                                      local.set $l9
                                      block $B120
                                        local.get $l5
                                        i32.eqz
                                        br_if $B120
                                        local.get $l8
                                        i32.const 2
                                        local.get $l8
                                        i32.const 2
                                        i32.gt_u
                                        select
                                        local.tee $l15
                                        i32.const -1
                                        i32.add
                                        local.set $l8
                                        block $B121
                                          local.get $l15
                                          i32.const -2
                                          i32.add
                                          i32.const 3
                                          i32.lt_u
                                          br_if $B121
                                          local.get $l8
                                          i32.const -4
                                          i32.and
                                          local.set $l9
                                          local.get $l18
                                          local.set $l5
                                          loop $L122
                                            local.get $l5
                                            i32.const 4
                                            i32.add
                                            local.set $l5
                                            local.get $l9
                                            i32.const -4
                                            i32.add
                                            local.tee $l9
                                            br_if $L122
                                          end
                                          local.get $l10
                                          local.get $l5
                                          i32.add
                                          i32.load align=1
                                          local.tee $l9
                                          i32.const 16711935
                                          i32.and
                                          i32.const 8
                                          i32.rotr
                                          local.get $l9
                                          i32.const 24
                                          i32.rotr
                                          i32.const 16711935
                                          i32.and
                                          i32.or
                                          local.set $l9
                                          local.get $l5
                                          i32.const 1
                                          i32.add
                                          local.set $l12
                                        end
                                        local.get $l8
                                        i32.const 3
                                        i32.and
                                        local.set $l8
                                        local.get $l17
                                        local.get $l12
                                        i32.add
                                        local.set $l5
                                        loop $L123
                                          local.get $l9
                                          i32.const 8
                                          i32.shl
                                          local.get $l5
                                          i32.load8_u
                                          i32.or
                                          local.set $l9
                                          local.get $l5
                                          i32.const 1
                                          i32.add
                                          local.set $l5
                                          local.get $l8
                                          i32.const -1
                                          i32.add
                                          local.tee $l8
                                          br_if $L123
                                        end
                                        local.get $l15
                                        local.get $l18
                                        i32.add
                                        local.set $l12
                                      end
                                      local.get $p2
                                      local.get $l9
                                      i32.store offset=116
                                      local.get $p2
                                      local.get $l14
                                      i32.const 1
                                      i32.add
                                      local.tee $l5
                                      i32.store offset=120
                                      local.get $p2
                                      local.get $p2
                                      i32.load offset=84
                                      i32.const 1
                                      i32.add
                                      i32.store offset=84
                                      local.get $l14
                                      i32.const 32
                                      i32.ge_u
                                      br_if $B50
                                      i32.const 528
                                      local.set $l9
                                      br $B51
                                    end
                                    local.get $p2
                                    local.get $l14
                                    i32.const 1
                                    i32.add
                                    local.tee $l5
                                    i32.store offset=120
                                    local.get $p2
                                    local.get $p2
                                    i32.load offset=124
                                    i32.const 1
                                    i32.add
                                    i32.store offset=124
                                    local.get $l14
                                    i32.const 32
                                    i32.ge_u
                                    br_if $B9
                                    i32.const 32794
                                    local.set $l9
                                    br $B10
                                  end
                                  local.get $l18
                                  local.get $l11
                                  i32.ge_u
                                  br_if $B112
                                  local.get $l13
                                  local.get $l18
                                  i32.add
                                  i32.load8_u
                                  i32.const 6
                                  i32.shr_u
                                  local.tee $l5
                                  i32.const 3
                                  i32.eq
                                  br_if $B112
                                  i32.const 1
                                  local.get $l5
                                  i32.shl
                                  local.tee $l9
                                  local.get $l18
                                  i32.add
                                  local.get $l11
                                  i32.gt_u
                                  br_if $B112
                                  local.get $l9
                                  i32.const 2
                                  local.get $l9
                                  i32.const 2
                                  i32.gt_u
                                  select
                                  i32.const 1
                                  local.get $l5
                                  select
                                  local.get $l18
                                  i32.add
                                  local.tee $l5
                                  local.get $l11
                                  i32.ge_u
                                  br_if $B112
                                  local.get $l13
                                  local.get $l5
                                  i32.add
                                  i32.load8_u
                                  i32.const 6
                                  i32.shr_u
                                  local.tee $l9
                                  i32.const 3
                                  i32.eq
                                  br_if $B112
                                  i32.const 1
                                  local.get $l9
                                  i32.shl
                                  local.tee $l8
                                  local.get $l5
                                  i32.add
                                  local.get $l11
                                  i32.gt_u
                                  br_if $B112
                                  local.get $l8
                                  i32.const 2
                                  local.get $l8
                                  i32.const 2
                                  i32.gt_u
                                  select
                                  i32.const 1
                                  local.get $l9
                                  select
                                  local.get $l5
                                  i32.add
                                  local.tee $l9
                                  local.get $l11
                                  i32.ge_u
                                  br_if $B112
                                  local.get $l13
                                  local.get $l9
                                  i32.add
                                  i32.load8_u
                                  i32.const 6
                                  i32.shr_u
                                  local.tee $l8
                                  i32.const 3
                                  i32.eq
                                  br_if $B112
                                  i32.const 1
                                  local.get $l8
                                  i32.shl
                                  local.tee $l12
                                  local.get $l9
                                  i32.add
                                  local.get $l11
                                  i32.gt_u
                                  br_if $B112
                                  local.get $p2
                                  local.get $l14
                                  i32.const 1
                                  i32.add
                                  local.tee $l5
                                  i32.store offset=120
                                  local.get $p2
                                  local.get $p2
                                  i32.load offset=88
                                  i32.const 1
                                  i32.add
                                  i32.store offset=88
                                  local.get $l12
                                  i32.const 2
                                  local.get $l12
                                  i32.const 2
                                  i32.gt_u
                                  select
                                  i32.const 1
                                  local.get $l8
                                  select
                                  local.get $l9
                                  i32.add
                                  local.set $l12
                                  local.get $l14
                                  i32.const 32
                                  i32.ge_u
                                  br_if $B50
                                  i32.const 516
                                  local.set $l9
                                  br $B51
                                end
                                local.get $l18
                                local.get $l11
                                i32.ge_u
                                br_if $B113
                                local.get $l13
                                local.get $l18
                                i32.add
                                i32.load8_u
                                i32.const 6
                                i32.shr_u
                                local.tee $l5
                                i32.const 3
                                i32.eq
                                br_if $B113
                                i32.const 1
                                local.get $l5
                                i32.shl
                                local.tee $l9
                                local.get $l18
                                i32.add
                                local.get $l11
                                i32.gt_u
                                br_if $B113
                                local.get $l9
                                i32.const 2
                                local.get $l9
                                i32.const 2
                                i32.gt_u
                                select
                                i32.const 1
                                local.get $l5
                                select
                                local.get $l18
                                i32.add
                                local.tee $l5
                                local.get $l11
                                i32.ge_u
                                br_if $B113
                                local.get $l13
                                local.get $l5
                                i32.add
                                i32.load8_u
                                i32.const 6
                                i32.shr_u
                                local.tee $l9
                                i32.const 3
                                i32.eq
                                br_if $B113
                                i32.const 1
                                local.get $l9
                                i32.shl
                                local.tee $l8
                                local.get $l5
                                i32.add
                                local.get $l11
                                i32.gt_u
                                br_if $B113
                                block $B124
                                  block $B125
                                    local.get $l8
                                    i32.const 2
                                    local.get $l8
                                    i32.const 2
                                    i32.gt_u
                                    select
                                    i32.const 1
                                    local.get $l9
                                    select
                                    local.get $l5
                                    i32.add
                                    local.tee $l12
                                    local.get $l11
                                    i32.ge_u
                                    br_if $B125
                                    local.get $l13
                                    local.get $l12
                                    i32.add
                                    i32.load8_u
                                    local.tee $l9
                                    i32.const 6
                                    i32.shr_u
                                    local.tee $l5
                                    i32.const 3
                                    i32.eq
                                    br_if $B125
                                    i32.const 1
                                    local.get $l5
                                    i32.shl
                                    local.tee $l8
                                    local.get $l12
                                    i32.add
                                    local.get $l11
                                    i32.gt_u
                                    br_if $B125
                                    local.get $l12
                                    i32.const 1
                                    i32.add
                                    local.set $l18
                                    local.get $l9
                                    i32.const 63
                                    i32.and
                                    local.set $l9
                                    block $B126
                                      local.get $l5
                                      i32.eqz
                                      br_if $B126
                                      local.get $l8
                                      i32.const 2
                                      local.get $l8
                                      i32.const 2
                                      i32.gt_u
                                      select
                                      local.tee $l15
                                      i32.const -1
                                      i32.add
                                      local.set $l8
                                      block $B127
                                        local.get $l15
                                        i32.const -2
                                        i32.add
                                        i32.const 3
                                        i32.lt_u
                                        br_if $B127
                                        local.get $l8
                                        i32.const -4
                                        i32.and
                                        local.set $l9
                                        local.get $l12
                                        local.set $l5
                                        loop $L128
                                          local.get $l5
                                          i32.const 4
                                          i32.add
                                          local.set $l5
                                          local.get $l9
                                          i32.const -4
                                          i32.add
                                          local.tee $l9
                                          br_if $L128
                                        end
                                        local.get $l10
                                        local.get $l5
                                        i32.add
                                        i32.load align=1
                                        local.tee $l9
                                        i32.const 16711935
                                        i32.and
                                        i32.const 8
                                        i32.rotr
                                        local.get $l9
                                        i32.const 24
                                        i32.rotr
                                        i32.const 16711935
                                        i32.and
                                        i32.or
                                        local.set $l9
                                        local.get $l5
                                        i32.const 1
                                        i32.add
                                        local.set $l18
                                      end
                                      local.get $l8
                                      i32.const 3
                                      i32.and
                                      local.set $l8
                                      local.get $l17
                                      local.get $l18
                                      i32.add
                                      local.set $l5
                                      loop $L129
                                        local.get $l9
                                        i32.const 8
                                        i32.shl
                                        local.get $l5
                                        i32.load8_u
                                        i32.or
                                        local.set $l9
                                        local.get $l5
                                        i32.const 1
                                        i32.add
                                        local.set $l5
                                        local.get $l8
                                        i32.const -1
                                        i32.add
                                        local.tee $l8
                                        br_if $L129
                                      end
                                      local.get $l15
                                      local.get $l12
                                      i32.add
                                      local.set $l18
                                    end
                                    local.get $l14
                                    i32.const 1
                                    i32.add
                                    local.set $l5
                                    local.get $l9
                                    local.get $l18
                                    i32.add
                                    local.tee $l12
                                    local.get $l11
                                    i32.le_u
                                    br_if $B124
                                    local.get $p2
                                    local.get $l5
                                    i32.store offset=120
                                    local.get $p2
                                    local.get $p2
                                    i32.load offset=124
                                    i32.const 1
                                    i32.add
                                    i32.store offset=124
                                    local.get $l14
                                    i32.const 32
                                    i32.ge_u
                                    br_if $B9
                                    i32.const 32798
                                    local.set $l9
                                    br $B10
                                  end
                                  local.get $p2
                                  local.get $l14
                                  i32.const 1
                                  i32.add
                                  local.tee $l5
                                  i32.store offset=120
                                  local.get $p2
                                  local.get $p2
                                  i32.load offset=124
                                  i32.const 1
                                  i32.add
                                  i32.store offset=124
                                  local.get $l14
                                  i32.const 32
                                  i32.ge_u
                                  br_if $B9
                                  i32.const 32797
                                  local.set $l9
                                  br $B10
                                end
                                local.get $p2
                                local.get $l5
                                i32.store offset=120
                                local.get $p2
                                local.get $p2
                                i32.load offset=92
                                i32.const 1
                                i32.add
                                i32.store offset=92
                                local.get $l14
                                i32.const 32
                                i32.ge_u
                                br_if $B50
                                i32.const 540
                                local.set $l9
                                br $B51
                              end
                              local.get $p2
                              local.get $l14
                              i32.const 1
                              i32.add
                              local.tee $l5
                              i32.store offset=120
                              local.get $p2
                              local.get $p2
                              i32.load offset=124
                              i32.const 1
                              i32.add
                              i32.store offset=124
                              local.get $l14
                              i32.const 32
                              i32.ge_u
                              br_if $B9
                              i32.const 32807
                              local.set $l9
                              br $B10
                            end
                            local.get $p2
                            local.get $l14
                            i32.const 1
                            i32.add
                            local.tee $l5
                            i32.store offset=120
                            local.get $p2
                            local.get $p2
                            i32.load offset=124
                            i32.const 1
                            i32.add
                            i32.store offset=124
                            local.get $l14
                            i32.const 32
                            i32.ge_u
                            br_if $B9
                            i32.const 32796
                            local.set $l9
                            br $B10
                          end
                          local.get $p2
                          local.get $l14
                          i32.const 1
                          i32.add
                          local.tee $l5
                          i32.store offset=120
                          local.get $p2
                          local.get $p2
                          i32.load offset=124
                          i32.const 1
                          i32.add
                          i32.store offset=124
                          local.get $l14
                          i32.const 32
                          i32.ge_u
                          br_if $B9
                          i32.const 32795
                          local.set $l9
                          br $B10
                        end
                        local.get $p2
                        local.get $l14
                        i32.const 1
                        i32.add
                        local.tee $l5
                        i32.store offset=120
                        local.get $p2
                        local.get $p2
                        i32.load offset=124
                        i32.const 1
                        i32.add
                        i32.store offset=124
                        local.get $l14
                        i32.const 32
                        i32.ge_u
                        br_if $B9
                        i32.const 32793
                        local.set $l9
                        br $B10
                      end
                      local.get $p2
                      local.get $l14
                      i32.const 2
                      i32.shl
                      i32.add
                      local.get $l9
                      i32.store offset=128
                    end
                    local.get $l12
                    local.get $l11
                    i32.lt_u
                    br_if $L49
                    br $B9
                  end
                end
                local.get $p2
                local.get $l14
                i32.const 2
                i32.shl
                i32.add
                local.get $l9
                i32.store offset=128
              end
              local.get $l6
              local.get $p1
              i32.lt_u
              br_if $L4
            end
          end
          local.get $l7
          br_if $B1
        end
        local.get $p2
        i32.load offset=124
        local.set $l9
        br $B0
      end
      local.get $p2
      local.get $l5
      i32.const 1
      i32.add
      i32.store offset=120
      local.get $p2
      local.get $p2
      i32.load offset=124
      i32.const 1
      i32.add
      local.tee $l9
      i32.store offset=124
      local.get $l5
      i32.const 31
      i32.gt_u
      br_if $B0
      local.get $p2
      local.get $l5
      i32.const 2
      i32.shl
      i32.add
      i32.const 32811
      i32.store offset=128
    end
    local.get $l3
    i32.const 1024
    i32.add
    global.set $g0
    local.get $l9)
  (func $f1 (type $t1) (param $p0 i32) (param $p1 i32) (param $p2 i32)
    (local $l3 i32) (local $l4 i32) (local $l5 i32) (local $l6 i32) (local $l7 i32)
    block $B0
      local.get $p1
      i32.eqz
      br_if $B0
      i32.const 0
      local.set $l3
      block $B1
        loop $L2
          block $B3
            block $B4
              block $B5
                block $B6
                  block $B7
                    block $B8
                      block $B9
                        local.get $p0
                        local.get $l3
                        i32.add
                        i32.load8_s
                        local.tee $l4
                        i32.const -1
                        i32.gt_s
                        br_if $B9
                        local.get $l3
                        i32.const 1
                        i32.add
                        local.set $l5
                        block $B10
                          local.get $l4
                          i32.const 127
                          i32.and
                          local.tee $l6
                          i32.const 127
                          i32.eq
                          br_if $B10
                          local.get $l5
                          local.set $l3
                          br $B7
                        end
                        local.get $l5
                        local.get $p1
                        i32.ge_u
                        br_if $B6
                        local.get $l3
                        i32.const 2
                        i32.add
                        local.set $l4
                        local.get $p0
                        local.get $l5
                        i32.add
                        i32.load8_s
                        local.tee $l5
                        i32.const 127
                        i32.and
                        i32.const 127
                        i32.add
                        local.set $l6
                        local.get $l5
                        i32.const 0
                        i32.lt_s
                        br_if $B8
                        local.get $l4
                        local.set $l3
                        br $B7
                      end
                      block $B11
                        local.get $l4
                        i32.const 64
                        i32.lt_u
                        br_if $B11
                        local.get $l3
                        i32.const 1
                        i32.add
                        local.set $l6
                        block $B12
                          local.get $l4
                          i32.const 63
                          i32.and
                          local.tee $l4
                          i32.const 63
                          i32.ne
                          br_if $B12
                          block $B13
                            block $B14
                              local.get $l6
                              local.get $p1
                              i32.ge_u
                              br_if $B14
                              local.get $l3
                              i32.const 2
                              i32.add
                              local.set $l5
                              local.get $p0
                              local.get $l6
                              i32.add
                              i32.load8_s
                              local.tee $l6
                              i32.const 127
                              i32.and
                              i32.const 63
                              i32.add
                              local.set $l4
                              local.get $l6
                              i32.const 0
                              i32.ge_s
                              br_if $B13
                              local.get $l5
                              local.get $p1
                              i32.ge_u
                              br_if $B14
                              local.get $l3
                              i32.const 3
                              i32.add
                              local.set $l6
                              local.get $p0
                              local.get $l5
                              i32.add
                              i32.load8_s
                              local.tee $l5
                              i32.const 127
                              i32.and
                              i32.const 7
                              i32.shl
                              local.get $l4
                              i32.add
                              local.set $l4
                              local.get $l5
                              i32.const -1
                              i32.gt_s
                              br_if $B12
                              local.get $l6
                              local.get $p1
                              i32.ge_u
                              br_if $B14
                              local.get $l3
                              i32.const 4
                              i32.add
                              local.set $l5
                              local.get $p0
                              local.get $l6
                              i32.add
                              i32.load8_s
                              local.tee $l6
                              i32.const 127
                              i32.and
                              i32.const 14
                              i32.shl
                              local.get $l4
                              i32.add
                              local.set $l4
                              block $B15
                                local.get $l6
                                i32.const -1
                                i32.le_s
                                br_if $B15
                                local.get $l5
                                local.set $l6
                                br $B12
                              end
                              local.get $l5
                              local.get $p1
                              i32.ge_u
                              br_if $B14
                              local.get $l3
                              i32.const 5
                              i32.add
                              local.set $l6
                              local.get $p0
                              local.get $l5
                              i32.add
                              i32.load8_s
                              local.tee $l5
                              i32.const 127
                              i32.and
                              i32.const 21
                              i32.shl
                              local.get $l4
                              i32.add
                              local.set $l4
                              local.get $l5
                              i32.const -1
                              i32.gt_s
                              br_if $B12
                              local.get $l6
                              local.get $p1
                              i32.ge_u
                              br_if $B14
                              local.get $p0
                              local.get $l6
                              i32.add
                              i32.load8_s
                              local.tee $l5
                              i32.const 0
                              i32.lt_s
                              br_if $B14
                              local.get $l3
                              i32.const 6
                              i32.add
                              local.set $l6
                              local.get $l5
                              i32.const 28
                              i32.shl
                              local.get $l4
                              i32.add
                              local.set $l4
                              br $B12
                            end
                            local.get $p2
                            local.get $p2
                            i32.load offset=124
                            i32.const 1
                            i32.add
                            i32.store offset=124
                            local.get $p2
                            local.get $p2
                            i32.load offset=120
                            local.tee $l6
                            i32.const 1
                            i32.add
                            i32.store offset=120
                            local.get $l6
                            i32.const 32
                            i32.ge_u
                            br_if $B0
                            i32.const 32781
                            local.set $l3
                            br $B1
                          end
                          local.get $l5
                          local.set $l6
                        end
                        block $B16
                          block $B17
                            local.get $l4
                            br_if $B17
                            block $B18
                              block $B19
                                block $B20
                                  local.get $l6
                                  local.get $p1
                                  i32.ge_u
                                  br_if $B20
                                  local.get $l6
                                  i32.const 1
                                  i32.add
                                  local.set $l3
                                  local.get $p0
                                  local.get $l6
                                  i32.add
                                  i32.load8_u
                                  i32.const 127
                                  i32.and
                                  local.tee $l7
                                  i32.const 127
                                  i32.ne
                                  br_if $B18
                                  local.get $l3
                                  local.get $p1
                                  i32.ge_u
                                  br_if $B20
                                  local.get $l6
                                  i32.const 2
                                  i32.add
                                  local.set $l4
                                  local.get $p0
                                  local.get $l3
                                  i32.add
                                  i32.load8_s
                                  local.tee $l3
                                  i32.const 127
                                  i32.and
                                  i32.const 127
                                  i32.add
                                  local.set $l7
                                  local.get $l3
                                  i32.const 0
                                  i32.ge_s
                                  br_if $B19
                                  local.get $l4
                                  local.get $p1
                                  i32.ge_u
                                  br_if $B20
                                  local.get $l6
                                  i32.const 3
                                  i32.add
                                  local.set $l3
                                  local.get $p0
                                  local.get $l4
                                  i32.add
                                  i32.load8_s
                                  local.tee $l4
                                  i32.const 127
                                  i32.and
                                  i32.const 7
                                  i32.shl
                                  local.get $l7
                                  i32.add
                                  local.set $l7
                                  local.get $l4
                                  i32.const -1
                                  i32.gt_s
                                  br_if $B18
                                  local.get $l3
                                  local.get $p1
                                  i32.ge_u
                                  br_if $B20
                                  local.get $l6
                                  i32.const 4
                                  i32.add
                                  local.set $l4
                                  local.get $p0
                                  local.get $l3
                                  i32.add
                                  i32.load8_s
                                  local.tee $l3
                                  i32.const 127
                                  i32.and
                                  i32.const 14
                                  i32.shl
                                  local.get $l7
                                  i32.add
                                  local.set $l7
                                  block $B21
                                    local.get $l3
                                    i32.const -1
                                    i32.le_s
                                    br_if $B21
                                    local.get $l4
                                    local.set $l3
                                    br $B18
                                  end
                                  local.get $l4
                                  local.get $p1
                                  i32.ge_u
                                  br_if $B20
                                  local.get $l6
                                  i32.const 5
                                  i32.add
                                  local.set $l3
                                  local.get $p0
                                  local.get $l4
                                  i32.add
                                  i32.load8_s
                                  local.tee $l4
                                  i32.const 127
                                  i32.and
                                  i32.const 21
                                  i32.shl
                                  local.get $l7
                                  i32.add
                                  local.set $l7
                                  local.get $l4
                                  i32.const -1
                                  i32.gt_s
                                  br_if $B18
                                  local.get $l3
                                  local.get $p1
                                  i32.ge_u
                                  br_if $B20
                                  local.get $p0
                                  local.get $l3
                                  i32.add
                                  i32.load8_s
                                  local.tee $l4
                                  i32.const 0
                                  i32.lt_s
                                  br_if $B20
                                  local.get $l6
                                  i32.const 6
                                  i32.add
                                  local.set $l3
                                  local.get $l4
                                  i32.const 28
                                  i32.shl
                                  local.get $l7
                                  i32.add
                                  local.set $l7
                                  br $B18
                                end
                                local.get $p2
                                local.get $p2
                                i32.load offset=124
                                i32.const 1
                                i32.add
                                i32.store offset=124
                                local.get $p2
                                local.get $p2
                                i32.load offset=120
                                local.tee $l6
                                i32.const 1
                                i32.add
                                i32.store offset=120
                                local.get $l6
                                i32.const 32
                                i32.ge_u
                                br_if $B0
                                i32.const 32782
                                local.set $l3
                                br $B1
                              end
                              local.get $l4
                              local.set $l3
                            end
                            local.get $l7
                            local.get $l3
                            i32.add
                            local.tee $l6
                            local.get $p1
                            i32.le_u
                            br_if $B16
                            local.get $p2
                            local.get $p2
                            i32.load offset=124
                            i32.const 1
                            i32.add
                            i32.store offset=124
                            local.get $p2
                            local.get $p2
                            i32.load offset=120
                            local.tee $l6
                            i32.const 1
                            i32.add
                            i32.store offset=120
                            local.get $l6
                            i32.const 32
                            i32.ge_u
                            br_if $B0
                            i32.const 32783
                            local.set $l3
                            br $B1
                          end
                          i32.const 0
                          local.set $l7
                          local.get $l4
                          i32.const 61
                          i32.gt_u
                          br_if $B16
                          local.get $p2
                          local.get $p2
                          i32.load offset=40
                          i32.const 1
                          i32.add
                          i32.store offset=40
                        end
                        block $B22
                          block $B23
                            block $B24
                              local.get $l6
                              local.get $p1
                              i32.ge_u
                              br_if $B24
                              local.get $l6
                              i32.const 1
                              i32.add
                              local.set $l3
                              local.get $p0
                              local.get $l6
                              i32.add
                              i32.load8_u
                              i32.const 127
                              i32.and
                              local.tee $l5
                              i32.const 127
                              i32.ne
                              br_if $B22
                              local.get $l3
                              local.get $p1
                              i32.ge_u
                              br_if $B24
                              local.get $l6
                              i32.const 2
                              i32.add
                              local.set $l4
                              local.get $p0
                              local.get $l3
                              i32.add
                              i32.load8_s
                              local.tee $l3
                              i32.const 127
                              i32.and
                              i32.const 127
                              i32.add
                              local.set $l5
                              local.get $l3
                              i32.const 0
                              i32.ge_s
                              br_if $B23
                              local.get $l4
                              local.get $p1
                              i32.ge_u
                              br_if $B24
                              local.get $l6
                              i32.const 3
                              i32.add
                              local.set $l3
                              local.get $p0
                              local.get $l4
                              i32.add
                              i32.load8_s
                              local.tee $l4
                              i32.const 127
                              i32.and
                              i32.const 7
                              i32.shl
                              local.get $l5
                              i32.add
                              local.set $l5
                              local.get $l4
                              i32.const -1
                              i32.gt_s
                              br_if $B22
                              local.get $l3
                              local.get $p1
                              i32.ge_u
                              br_if $B24
                              local.get $l6
                              i32.const 4
                              i32.add
                              local.set $l4
                              local.get $p0
                              local.get $l3
                              i32.add
                              i32.load8_s
                              local.tee $l3
                              i32.const 127
                              i32.and
                              i32.const 14
                              i32.shl
                              local.get $l5
                              i32.add
                              local.set $l5
                              block $B25
                                local.get $l3
                                i32.const -1
                                i32.le_s
                                br_if $B25
                                local.get $l4
                                local.set $l3
                                br $B22
                              end
                              local.get $l4
                              local.get $p1
                              i32.ge_u
                              br_if $B24
                              local.get $l6
                              i32.const 5
                              i32.add
                              local.set $l3
                              local.get $p0
                              local.get $l4
                              i32.add
                              i32.load8_s
                              local.tee $l4
                              i32.const 127
                              i32.and
                              i32.const 21
                              i32.shl
                              local.get $l5
                              i32.add
                              local.set $l5
                              local.get $l4
                              i32.const -1
                              i32.gt_s
                              br_if $B22
                              local.get $l3
                              local.get $p1
                              i32.ge_u
                              br_if $B24
                              local.get $p0
                              local.get $l3
                              i32.add
                              i32.load8_s
                              local.tee $l4
                              i32.const 0
                              i32.lt_s
                              br_if $B24
                              local.get $l6
                              i32.const 6
                              i32.add
                              local.set $l3
                              local.get $l4
                              i32.const 28
                              i32.shl
                              local.get $l5
                              i32.add
                              local.set $l5
                              br $B22
                            end
                            local.get $p2
                            local.get $p2
                            i32.load offset=124
                            i32.const 1
                            i32.add
                            i32.store offset=124
                            local.get $p2
                            local.get $p2
                            i32.load offset=120
                            local.tee $l6
                            i32.const 1
                            i32.add
                            i32.store offset=120
                            local.get $l6
                            i32.const 32
                            i32.ge_u
                            br_if $B0
                            i32.const 32784
                            local.set $l3
                            br $B1
                          end
                          local.get $l4
                          local.set $l3
                        end
                        block $B26
                          local.get $l5
                          local.get $l3
                          i32.add
                          local.tee $l3
                          local.get $p1
                          i32.le_u
                          br_if $B26
                          local.get $p2
                          local.get $p2
                          i32.load offset=124
                          i32.const 1
                          i32.add
                          i32.store offset=124
                          local.get $p2
                          local.get $p2
                          i32.load offset=120
                          local.tee $l6
                          i32.const 1
                          i32.add
                          i32.store offset=120
                          local.get $l6
                          i32.const 32
                          i32.ge_u
                          br_if $B0
                          i32.const 32785
                          local.set $l3
                          br $B1
                        end
                        local.get $p2
                        local.get $p2
                        i32.load offset=44
                        i32.const 1
                        i32.add
                        local.tee $l6
                        i32.store offset=44
                        local.get $p2
                        local.get $p2
                        i32.load offset=120
                        local.tee $l4
                        i32.const 1
                        i32.add
                        i32.store offset=120
                        local.get $p2
                        local.get $l7
                        local.get $l5
                        i32.add
                        local.get $p2
                        i32.load offset=52
                        i32.add
                        i32.const 32
                        i32.add
                        i32.store offset=52
                        local.get $l4
                        i32.const 32
                        i32.ge_u
                        br_if $B3
                        i32.const 4608
                        local.set $l5
                        br $B4
                      end
                      local.get $p2
                      local.get $p2
                      i32.load offset=124
                      i32.const 1
                      i32.add
                      i32.store offset=124
                      local.get $p2
                      local.get $p2
                      i32.load offset=120
                      local.tee $l6
                      i32.const 1
                      i32.add
                      i32.store offset=120
                      local.get $l6
                      i32.const 32
                      i32.ge_u
                      br_if $B0
                      i32.const 32786
                      local.set $l3
                      br $B1
                    end
                    local.get $l4
                    local.get $p1
                    i32.ge_u
                    br_if $B6
                    local.get $l3
                    i32.const 3
                    i32.add
                    local.set $l5
                    local.get $p0
                    local.get $l4
                    i32.add
                    i32.load8_s
                    local.tee $l4
                    i32.const 127
                    i32.and
                    i32.const 7
                    i32.shl
                    local.get $l6
                    i32.add
                    local.set $l6
                    block $B27
                      local.get $l4
                      i32.const -1
                      i32.le_s
                      br_if $B27
                      local.get $l5
                      local.set $l3
                      br $B7
                    end
                    local.get $l5
                    local.get $p1
                    i32.ge_u
                    br_if $B6
                    local.get $l3
                    i32.const 4
                    i32.add
                    local.set $l4
                    local.get $p0
                    local.get $l5
                    i32.add
                    i32.load8_s
                    local.tee $l5
                    i32.const 127
                    i32.and
                    i32.const 14
                    i32.shl
                    local.get $l6
                    i32.add
                    local.set $l6
                    block $B28
                      local.get $l5
                      i32.const -1
                      i32.le_s
                      br_if $B28
                      local.get $l4
                      local.set $l3
                      br $B7
                    end
                    local.get $l4
                    local.get $p1
                    i32.ge_u
                    br_if $B6
                    local.get $l3
                    i32.const 5
                    i32.add
                    local.set $l5
                    local.get $p0
                    local.get $l4
                    i32.add
                    i32.load8_s
                    local.tee $l4
                    i32.const 127
                    i32.and
                    i32.const 21
                    i32.shl
                    local.get $l6
                    i32.add
                    local.set $l6
                    block $B29
                      local.get $l4
                      i32.const -1
                      i32.le_s
                      br_if $B29
                      local.get $l5
                      local.set $l3
                      br $B7
                    end
                    local.get $l5
                    local.get $p1
                    i32.ge_u
                    br_if $B6
                    local.get $p0
                    local.get $l5
                    i32.add
                    i32.load8_s
                    local.tee $l4
                    i32.const 0
                    i32.lt_s
                    br_if $B6
                    local.get $l3
                    i32.const 6
                    i32.add
                    local.set $l3
                    local.get $l4
                    i32.const 28
                    i32.shl
                    local.get $l6
                    i32.add
                    local.set $l6
                  end
                  local.get $l6
                  br_if $B5
                end
                local.get $p2
                local.get $p2
                i32.load offset=124
                i32.const 1
                i32.add
                i32.store offset=124
                local.get $p2
                local.get $p2
                i32.load offset=120
                local.tee $l6
                i32.const 1
                i32.add
                i32.store offset=120
                local.get $l6
                i32.const 32
                i32.ge_u
                br_if $B0
                i32.const 32779
                local.set $l3
                br $B1
              end
              block $B30
                block $B31
                  block $B32
                    local.get $l6
                    i32.const 61
                    i32.gt_u
                    br_if $B32
                    local.get $p2
                    local.get $p2
                    i32.load offset=40
                    i32.const 1
                    i32.add
                    i32.store offset=40
                    br $B31
                  end
                  block $B33
                    local.get $l6
                    local.get $p2
                    i32.load offset=44
                    i32.const 61
                    i32.add
                    i32.gt_u
                    br_if $B33
                    local.get $p2
                    local.get $p2
                    i32.load offset=48
                    i32.const 1
                    i32.add
                    i32.store offset=48
                    br $B31
                  end
                  local.get $p2
                  local.get $p2
                  i32.load offset=124
                  i32.const 1
                  i32.add
                  i32.store offset=124
                  local.get $p2
                  local.get $p2
                  i32.load offset=120
                  local.tee $l5
                  i32.const 1
                  i32.add
                  local.tee $l4
                  i32.store offset=120
                  local.get $l5
                  i32.const 31
                  i32.gt_u
                  br_if $B30
                  local.get $p2
                  local.get $l5
                  i32.const 2
                  i32.shl
                  i32.add
                  i32.const 32780
                  i32.store offset=128
                end
                local.get $p2
                i32.load offset=120
                local.set $l4
              end
              local.get $p2
              local.get $l4
              i32.const 1
              i32.add
              i32.store offset=120
              local.get $l4
              i32.const 32
              i32.ge_u
              br_if $B3
              i32.const 4352
              local.set $l5
            end
            local.get $p2
            local.get $l4
            i32.const 2
            i32.shl
            i32.add
            local.get $l6
            i32.const 255
            i32.and
            local.get $l5
            i32.or
            i32.store offset=128
          end
          local.get $l3
          local.get $p1
          i32.lt_u
          br_if $L2
          br $B0
        end
      end
      local.get $p2
      local.get $l6
      i32.const 2
      i32.shl
      i32.add
      local.get $l3
      i32.store offset=128
    end)
  (table $T0 1 1 funcref)
  (memory $memory 4 4)
  (global $g0 (mut i32) (i32.const 65536))
  (export "memory" (memory $memory))
  (export "run_trace" (func $run_trace)))
