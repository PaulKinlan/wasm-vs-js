;; text.regex-log-scan.v1 — kernel: scan_log
;; WebAssembly Text (WAT) baseline implementation
;; Exports: scan_log

(module $scan_log_c.wasm
  (type $t0 (func))
  (type $t1 (func (param i32 i32 i32 i32 i32 i32 i32 i32 i32 i32) (result i32)))
  (func $__wasm_call_ctors (type $t0))
  (func $scan_log (type $t1) (param $p0 i32) (param $p1 i32) (param $p2 i32) (param $p3 i32) (param $p4 i32) (param $p5 i32) (param $p6 i32) (param $p7 i32) (param $p8 i32) (param $p9 i32) (result i32)
    (local $l10 i32) (local $l11 i32) (local $l12 i32) (local $l13 i32) (local $l14 i32) (local $l15 i32) (local $l16 i32) (local $l17 i32) (local $l18 i32) (local $l19 i32) (local $l20 i32) (local $l21 i32) (local $l22 i32) (local $l23 i32) (local $l24 i32) (local $l25 i32) (local $l26 i32) (local $l27 i32) (local $l28 i32)
    i32.const 0
    local.set $l10
    loop $L0
      local.get $p6
      local.get $l10
      i32.add
      local.tee $l11
      i32.const 0
      i32.store
      local.get $l11
      i32.const 60
      i32.add
      i32.const 0
      i32.store
      local.get $l11
      i32.const 40
      i32.add
      i32.const 0
      i32.store
      local.get $l11
      i32.const 20
      i32.add
      i32.const 0
      i32.store
      local.get $l10
      i32.const 80
      i32.add
      local.tee $l10
      i32.const 5120
      i32.ne
      br_if $L0
    end
    local.get $p6
    i32.const 2080
    i32.add
    local.tee $l11
    local.get $p6
    i32.load offset=2080
    local.tee $l10
    i32.const 2
    i32.add
    local.tee $l12
    i32.const 2
    i32.shl
    i32.add
    i32.const 1
    i32.store
    i32.const 0
    local.set $l13
    local.get $l11
    local.get $l10
    i32.const 2
    i32.shl
    i32.add
    i32.const 4
    i32.add
    i32.const 0
    i32.store
    local.get $p6
    local.get $l12
    i32.store offset=2080
    local.get $p6
    i32.const 2380
    i32.add
    local.tee $l10
    local.get $p6
    i32.load offset=2380
    local.tee $l12
    i32.const 2
    i32.add
    local.tee $l14
    i32.const 2
    i32.shl
    i32.add
    i32.const 3
    i32.store
    local.get $l10
    local.get $l12
    i32.const 2
    i32.shl
    i32.add
    i32.const 4
    i32.add
    i32.const 2
    i32.store
    local.get $p6
    local.get $l14
    i32.store offset=2380
    local.get $p6
    i32.const 2040
    i32.add
    local.get $p6
    i32.load offset=2040
    i32.const 1
    i32.add
    local.tee $l10
    i32.const 2
    i32.shl
    i32.add
    i32.const 4
    i32.store
    local.get $p6
    local.get $l10
    i32.store offset=2040
    local.get $p6
    i32.const 1940
    i32.add
    local.tee $l10
    local.get $p6
    i32.load offset=1940
    local.tee $l12
    i32.const 2
    i32.add
    local.tee $l14
    i32.const 2
    i32.shl
    i32.add
    i32.const 6
    i32.store
    local.get $l10
    local.get $l12
    i32.const 2
    i32.shl
    i32.add
    i32.const 4
    i32.add
    i32.const 5
    i32.store
    local.get $p6
    local.get $l14
    i32.store offset=1940
    local.get $p6
    i32.const 1980
    i32.add
    local.tee $l10
    local.get $p6
    i32.load offset=1980
    i32.const 1
    i32.add
    local.tee $l12
    i32.const 2
    i32.shl
    i32.add
    i32.const 7
    i32.store
    local.get $p6
    local.get $l12
    i32.store offset=1980
    local.get $p6
    i32.const 2100
    i32.add
    local.get $p6
    i32.load offset=2100
    i32.const 1
    i32.add
    local.tee $l12
    i32.const 2
    i32.shl
    i32.add
    i32.const 8
    i32.store
    local.get $p6
    local.get $l12
    i32.store offset=2100
    local.get $l10
    local.get $p6
    i32.load offset=1980
    i32.const 1
    i32.add
    local.tee $l12
    i32.const 2
    i32.shl
    i32.add
    i32.const 9
    i32.store
    local.get $p6
    local.get $l12
    i32.store offset=1980
    local.get $p6
    i32.const 2300
    i32.add
    local.tee $l12
    local.get $p6
    i32.load offset=2300
    i32.const 1
    i32.add
    local.tee $l14
    i32.const 2
    i32.shl
    i32.add
    i32.const 10
    i32.store
    local.get $p6
    local.get $l14
    i32.store offset=2300
    local.get $p6
    i32.const 2000
    i32.add
    local.get $p6
    i32.load offset=2000
    i32.const 1
    i32.add
    local.tee $l14
    i32.const 2
    i32.shl
    i32.add
    i32.const 11
    i32.store
    local.get $p6
    local.get $l14
    i32.store offset=2000
    local.get $p6
    i32.const 2240
    i32.add
    local.get $p6
    i32.load offset=2240
    i32.const 1
    i32.add
    local.tee $l14
    i32.const 2
    i32.shl
    i32.add
    i32.const 12
    i32.store
    local.get $p6
    local.get $l14
    i32.store offset=2240
    local.get $p6
    i32.const 2220
    i32.add
    local.get $p6
    i32.load offset=2220
    i32.const 1
    i32.add
    local.tee $l14
    i32.const 2
    i32.shl
    i32.add
    i32.const 13
    i32.store
    local.get $p6
    local.get $l14
    i32.store offset=2220
    local.get $l12
    local.get $p6
    i32.load offset=2300
    i32.const 1
    i32.add
    local.tee $l14
    i32.const 2
    i32.shl
    i32.add
    i32.const 14
    i32.store
    local.get $p6
    local.get $l14
    i32.store offset=2300
    local.get $l10
    local.get $p6
    i32.load offset=1980
    i32.const 1
    i32.add
    local.tee $l14
    i32.const 2
    i32.shl
    i32.add
    i32.const 15
    i32.store
    local.get $p6
    local.get $l14
    i32.store offset=1980
    local.get $l11
    local.get $p6
    i32.load offset=2080
    i32.const 1
    i32.add
    local.tee $l10
    i32.const 2
    i32.shl
    i32.add
    i32.const 16
    i32.store
    local.get $p6
    local.get $l10
    i32.store offset=2080
    local.get $p6
    i32.const 2280
    i32.add
    local.tee $l11
    local.get $p6
    i32.load offset=2280
    local.tee $l10
    i32.const 2
    i32.add
    local.tee $l14
    i32.const 2
    i32.shl
    i32.add
    i32.const 18
    i32.store
    local.get $l11
    local.get $l10
    i32.const 2
    i32.shl
    i32.add
    i32.const 4
    i32.add
    i32.const 17
    i32.store
    local.get $p6
    local.get $l14
    i32.store offset=2280
    local.get $l12
    local.get $p6
    i32.load offset=2300
    i32.const 1
    i32.add
    local.tee $l11
    i32.const 2
    i32.shl
    i32.add
    i32.const 19
    i32.store
    local.get $p6
    local.get $l11
    i32.store offset=2300
    i32.const 0
    local.set $l15
    i32.const 0
    local.set $l16
    i32.const 0
    local.set $l17
    block $B1
      local.get $p1
      i32.eqz
      br_if $B1
      local.get $p0
      local.set $l18
      local.get $p1
      local.set $l10
      i32.const 0
      local.set $l17
      i32.const 0
      local.set $l16
      i32.const 0
      local.set $l15
      i32.const 0
      local.set $l13
      i32.const 0
      local.set $l19
      loop $L2
        block $B3
          local.get $p6
          local.get $p0
          local.get $l19
          i32.add
          i32.load8_u
          i32.const 20
          i32.mul
          i32.add
          local.tee $l20
          i32.load
          local.tee $l21
          i32.eqz
          br_if $B3
          i32.const 0
          local.set $l22
          loop $L4
            local.get $l15
            local.get $l20
            local.get $l22
            i32.const 1
            i32.add
            local.tee $l22
            i32.const 2
            i32.shl
            i32.add
            i32.load
            local.tee $l23
            i32.load8_u offset=65888
            local.tee $l24
            i32.const 1
            local.get $l24
            i32.const 1
            i32.gt_u
            select
            local.tee $l14
            i32.add
            local.set $l25
            local.get $l10
            local.get $l15
            i32.add
            local.set $l26
            local.get $l23
            i32.const 17
            i32.mul
            i32.const 65536
            i32.add
            local.set $l12
            i32.const 0
            local.set $l11
            block $B5
              block $B6
                block $B7
                  block $B8
                    block $B9
                      loop $L10
                        block $B11
                          local.get $l10
                          local.get $l11
                          i32.ne
                          br_if $B11
                          local.get $l26
                          local.set $l15
                          br $B5
                        end
                        local.get $l18
                        local.get $l11
                        i32.add
                        i32.load8_u
                        local.get $l12
                        local.get $l11
                        i32.add
                        i32.load8_u
                        i32.ne
                        br_if $B9
                        local.get $l14
                        local.get $l11
                        i32.const 1
                        i32.add
                        local.tee $l11
                        i32.ne
                        br_if $L10
                      end
                      local.get $l19
                      local.get $l24
                      i32.add
                      local.set $l27
                      block $B12
                        block $B13
                          local.get $l23
                          i32.const 7
                          i32.gt_u
                          br_if $B13
                          i32.const 0
                          local.set $l11
                          block $B14
                            block $B15
                              local.get $l27
                              local.get $p1
                              i32.lt_u
                              br_if $B15
                              local.get $l27
                              local.set $l12
                              br $B14
                            end
                            local.get $p0
                            local.get $l19
                            local.get $l24
                            i32.add
                            local.tee $l24
                            i32.add
                            local.set $l26
                            i32.const 1
                            local.set $l15
                            i32.const 0
                            local.set $l11
                            block $B16
                              block $B17
                                loop $L18
                                  block $B19
                                    local.get $l26
                                    local.get $l11
                                    local.tee $l14
                                    i32.add
                                    i32.load8_u
                                    local.tee $l11
                                    i32.const -97
                                    i32.add
                                    i32.const 255
                                    i32.and
                                    i32.const 26
                                    i32.lt_u
                                    br_if $B19
                                    local.get $l11
                                    i32.const 255
                                    i32.and
                                    i32.const 95
                                    i32.eq
                                    br_if $B19
                                    local.get $l11
                                    i32.const -58
                                    i32.add
                                    i32.const 255
                                    i32.and
                                    i32.const 243
                                    i32.lt_u
                                    br_if $B17
                                  end
                                  local.get $l14
                                  i32.const 1
                                  i32.add
                                  local.tee $l11
                                  local.get $l24
                                  i32.add
                                  local.tee $l12
                                  local.get $p1
                                  i32.lt_u
                                  local.set $l15
                                  local.get $l12
                                  local.get $p1
                                  i32.ge_u
                                  br_if $B16
                                  local.get $l11
                                  i32.const 96
                                  i32.lt_u
                                  br_if $L18
                                  br $B16
                                end
                              end
                              local.get $l24
                              local.get $l14
                              i32.add
                              local.set $l12
                              local.get $l14
                              local.set $l11
                            end
                            local.get $l13
                            local.get $l14
                            i32.add
                            i32.const 1
                            i32.add
                            local.set $l13
                            local.get $l15
                            local.get $l11
                            i32.const 96
                            i32.eq
                            i32.and
                            local.set $l11
                          end
                          block $B20
                            local.get $l12
                            local.get $l27
                            i32.ne
                            br_if $B20
                            local.get $l25
                            local.set $l15
                            br $B5
                          end
                          local.get $l11
                          i32.eqz
                          br_if $B12
                          block $B21
                            local.get $p0
                            local.get $l12
                            i32.add
                            i32.load8_u
                            local.tee $l11
                            i32.const -97
                            i32.add
                            i32.const 255
                            i32.and
                            i32.const 26
                            i32.ge_u
                            br_if $B21
                            i32.const -1
                            local.set $l12
                            local.get $l13
                            i32.const 1
                            i32.add
                            local.set $l13
                            br $B12
                          end
                          local.get $l12
                          i32.const -1
                          local.get $l11
                          i32.const 255
                          i32.and
                          i32.const 95
                          i32.ne
                          local.get $l11
                          i32.const -58
                          i32.add
                          i32.const 255
                          i32.and
                          i32.const 243
                          i32.lt_u
                          i32.and
                          local.tee $l11
                          select
                          local.set $l12
                          local.get $l13
                          local.get $l11
                          i32.const 1
                          i32.xor
                          i32.add
                          local.set $l13
                          br $B12
                        end
                        block $B22
                          local.get $l23
                          i32.const 13
                          i32.gt_u
                          br_if $B22
                          i32.const 0
                          local.set $l11
                          block $B23
                            block $B24
                              local.get $l27
                              local.get $p1
                              i32.lt_u
                              br_if $B24
                              local.get $l27
                              local.set $l12
                              i32.const 0
                              local.set $l15
                              i32.const 0
                              local.set $l24
                              local.get $l13
                              local.set $l14
                              br $B23
                            end
                            i32.const 1
                            local.set $l15
                            local.get $l13
                            i32.const 1
                            i32.add
                            local.set $l14
                            i32.const 0
                            local.set $l11
                            block $B25
                              local.get $p0
                              local.get $l27
                              i32.add
                              i32.load8_u
                              local.tee $l12
                              i32.const -58
                              i32.add
                              i32.const 255
                              i32.and
                              i32.const 246
                              i32.ge_u
                              br_if $B25
                              local.get $l27
                              local.set $l12
                              i32.const 0
                              local.set $l24
                              br $B23
                            end
                            local.get $l12
                            i32.const -48
                            i32.add
                            local.set $l11
                            i32.const 0
                            local.set $l24
                            block $B26
                              local.get $l27
                              i32.const 1
                              i32.add
                              local.tee $l12
                              local.get $p1
                              i32.lt_u
                              br_if $B26
                              i32.const 0
                              local.set $l15
                              br $B23
                            end
                            local.get $l13
                            i32.const 2
                            i32.add
                            local.set $l14
                            local.get $p0
                            local.get $l12
                            i32.add
                            i32.load8_u
                            local.tee $l26
                            i32.const -58
                            i32.add
                            i32.const 255
                            i32.and
                            i32.const 246
                            i32.lt_u
                            br_if $B23
                            local.get $l11
                            i32.const 10
                            i32.mul
                            local.get $l26
                            i32.add
                            i32.const -48
                            i32.add
                            local.set $l11
                            i32.const 1
                            local.set $l24
                            block $B27
                              local.get $l27
                              i32.const 2
                              i32.add
                              local.tee $l12
                              local.get $p1
                              i32.lt_u
                              br_if $B27
                              i32.const 0
                              local.set $l15
                              br $B23
                            end
                            local.get $l13
                            i32.const 3
                            i32.add
                            local.set $l14
                            i32.const 1
                            local.set $l24
                            block $B28
                              local.get $p0
                              local.get $l12
                              i32.add
                              i32.load8_u
                              local.tee $l26
                              i32.const -58
                              i32.add
                              i32.const 255
                              i32.and
                              i32.const 246
                              i32.ge_u
                              br_if $B28
                              i32.const 1
                              local.set $l15
                              br $B23
                            end
                            local.get $l27
                            i32.const 3
                            i32.add
                            local.tee $l12
                            local.get $p1
                            i32.lt_u
                            local.set $l15
                            local.get $l11
                            i32.const 10
                            i32.mul
                            local.get $l26
                            i32.add
                            i32.const -48
                            i32.add
                            local.set $l11
                          end
                          local.get $l12
                          local.get $l27
                          i32.eq
                          br_if $B6
                          local.get $l11
                          i32.const 255
                          i32.gt_u
                          br_if $B6
                          block $B29
                            block $B30
                              local.get $l24
                              i32.eqz
                              br_if $B30
                              local.get $p0
                              local.get $l27
                              i32.add
                              i32.load8_u
                              i32.const 48
                              i32.ne
                              local.get $l15
                              i32.and
                              i32.eqz
                              br_if $B6
                              br $B29
                            end
                            local.get $l15
                            i32.eqz
                            br_if $B6
                          end
                          local.get $l14
                          i32.const 1
                          i32.add
                          local.set $l13
                          block $B31
                            local.get $p0
                            local.get $l12
                            i32.add
                            i32.load8_u
                            i32.const 46
                            i32.eq
                            br_if $B31
                            local.get $l25
                            local.set $l15
                            br $B5
                          end
                          i32.const 0
                          local.set $l24
                          local.get $l12
                          i32.const 1
                          i32.add
                          local.tee $l11
                          local.set $l15
                          i32.const 0
                          local.set $l26
                          i32.const 0
                          local.set $l27
                          block $B32
                            local.get $l11
                            local.get $p1
                            i32.ge_u
                            br_if $B32
                            local.get $l14
                            i32.const 2
                            i32.add
                            local.set $l13
                            i32.const 0
                            local.set $l24
                            i32.const 1
                            local.set $l26
                            block $B33
                              local.get $p0
                              local.get $l11
                              i32.add
                              i32.load8_u
                              local.tee $l15
                              i32.const -58
                              i32.add
                              i32.const 255
                              i32.and
                              i32.const 246
                              i32.ge_u
                              br_if $B33
                              local.get $l11
                              local.set $l15
                              i32.const 0
                              local.set $l27
                              br $B32
                            end
                            local.get $l15
                            i32.const -48
                            i32.add
                            local.set $l24
                            i32.const 0
                            local.set $l27
                            block $B34
                              local.get $l12
                              i32.const 2
                              i32.add
                              local.tee $l15
                              local.get $p1
                              i32.lt_u
                              br_if $B34
                              i32.const 0
                              local.set $l26
                              br $B32
                            end
                            local.get $l14
                            i32.const 3
                            i32.add
                            local.set $l13
                            local.get $p0
                            local.get $l15
                            i32.add
                            i32.load8_u
                            local.tee $l28
                            i32.const -58
                            i32.add
                            i32.const 255
                            i32.and
                            i32.const 246
                            i32.lt_u
                            br_if $B32
                            local.get $l24
                            i32.const 10
                            i32.mul
                            local.get $l28
                            i32.add
                            i32.const -48
                            i32.add
                            local.set $l24
                            i32.const 1
                            local.set $l27
                            block $B35
                              local.get $l12
                              i32.const 3
                              i32.add
                              local.tee $l15
                              local.get $p1
                              i32.lt_u
                              br_if $B35
                              i32.const 0
                              local.set $l26
                              br $B32
                            end
                            local.get $l14
                            i32.const 4
                            i32.add
                            local.set $l13
                            i32.const 1
                            local.set $l27
                            block $B36
                              local.get $p0
                              local.get $l15
                              i32.add
                              i32.load8_u
                              local.tee $l14
                              i32.const -58
                              i32.add
                              i32.const 255
                              i32.and
                              i32.const 246
                              i32.ge_u
                              br_if $B36
                              i32.const 1
                              local.set $l26
                              br $B32
                            end
                            local.get $l12
                            i32.const 4
                            i32.add
                            local.tee $l15
                            local.get $p1
                            i32.lt_u
                            local.set $l26
                            local.get $l24
                            i32.const 10
                            i32.mul
                            local.get $l14
                            i32.add
                            i32.const -48
                            i32.add
                            local.set $l24
                          end
                          block $B37
                            local.get $l15
                            local.get $l11
                            i32.ne
                            br_if $B37
                            local.get $l25
                            local.set $l15
                            br $B5
                          end
                          block $B38
                            local.get $l24
                            i32.const 255
                            i32.le_u
                            br_if $B38
                            local.get $l25
                            local.set $l15
                            br $B5
                          end
                          block $B39
                            block $B40
                              local.get $l27
                              i32.eqz
                              br_if $B40
                              local.get $p0
                              local.get $l11
                              i32.add
                              i32.load8_u
                              i32.const 48
                              i32.ne
                              local.get $l26
                              i32.and
                              br_if $B39
                              local.get $l25
                              local.set $l15
                              br $B5
                            end
                            local.get $l26
                            br_if $B39
                            local.get $l25
                            local.set $l15
                            br $B5
                          end
                          local.get $l13
                          i32.const 1
                          i32.add
                          local.set $l11
                          local.get $p0
                          local.get $l15
                          i32.add
                          i32.load8_u
                          i32.const 46
                          i32.ne
                          br_if $B7
                          i32.const 0
                          local.set $l24
                          local.get $l15
                          i32.const 1
                          i32.add
                          local.tee $l12
                          local.set $l14
                          i32.const 0
                          local.set $l26
                          i32.const 0
                          local.set $l27
                          block $B41
                            local.get $l12
                            local.get $p1
                            i32.ge_u
                            br_if $B41
                            local.get $l13
                            i32.const 2
                            i32.add
                            local.set $l11
                            i32.const 0
                            local.set $l24
                            i32.const 1
                            local.set $l26
                            block $B42
                              local.get $p0
                              local.get $l12
                              i32.add
                              i32.load8_u
                              local.tee $l14
                              i32.const -58
                              i32.add
                              i32.const 255
                              i32.and
                              i32.const 246
                              i32.ge_u
                              br_if $B42
                              local.get $l12
                              local.set $l14
                              i32.const 0
                              local.set $l27
                              br $B41
                            end
                            local.get $l14
                            i32.const -48
                            i32.add
                            local.set $l24
                            i32.const 0
                            local.set $l27
                            block $B43
                              local.get $l15
                              i32.const 2
                              i32.add
                              local.tee $l14
                              local.get $p1
                              i32.lt_u
                              br_if $B43
                              i32.const 0
                              local.set $l26
                              br $B41
                            end
                            local.get $l13
                            i32.const 3
                            i32.add
                            local.set $l11
                            local.get $p0
                            local.get $l14
                            i32.add
                            i32.load8_u
                            local.tee $l28
                            i32.const -58
                            i32.add
                            i32.const 255
                            i32.and
                            i32.const 246
                            i32.lt_u
                            br_if $B41
                            local.get $l24
                            i32.const 10
                            i32.mul
                            local.get $l28
                            i32.add
                            i32.const -48
                            i32.add
                            local.set $l24
                            i32.const 1
                            local.set $l27
                            block $B44
                              local.get $l15
                              i32.const 3
                              i32.add
                              local.tee $l14
                              local.get $p1
                              i32.lt_u
                              br_if $B44
                              i32.const 0
                              local.set $l26
                              br $B41
                            end
                            local.get $l13
                            i32.const 4
                            i32.add
                            local.set $l11
                            i32.const 1
                            local.set $l27
                            block $B45
                              local.get $p0
                              local.get $l14
                              i32.add
                              i32.load8_u
                              local.tee $l13
                              i32.const -58
                              i32.add
                              i32.const 255
                              i32.and
                              i32.const 246
                              i32.ge_u
                              br_if $B45
                              i32.const 1
                              local.set $l26
                              br $B41
                            end
                            local.get $l15
                            i32.const 4
                            i32.add
                            local.tee $l14
                            local.get $p1
                            i32.lt_u
                            local.set $l26
                            local.get $l24
                            i32.const 10
                            i32.mul
                            local.get $l13
                            i32.add
                            i32.const -48
                            i32.add
                            local.set $l24
                          end
                          local.get $l14
                          local.get $l12
                          i32.eq
                          br_if $B7
                          local.get $l24
                          i32.const 255
                          i32.gt_u
                          br_if $B7
                          block $B46
                            block $B47
                              local.get $l27
                              i32.eqz
                              br_if $B47
                              local.get $p0
                              local.get $l12
                              i32.add
                              i32.load8_u
                              i32.const 48
                              i32.ne
                              local.get $l26
                              i32.and
                              i32.eqz
                              br_if $B7
                              br $B46
                            end
                            local.get $l26
                            i32.eqz
                            br_if $B7
                          end
                          local.get $l11
                          i32.const 1
                          i32.add
                          local.set $l13
                          block $B48
                            local.get $p0
                            local.get $l14
                            i32.add
                            i32.load8_u
                            i32.const 46
                            i32.eq
                            br_if $B48
                            local.get $l25
                            local.set $l15
                            br $B5
                          end
                          i32.const 0
                          local.set $l24
                          local.get $l14
                          i32.const 1
                          i32.add
                          local.tee $l15
                          local.set $l12
                          i32.const 0
                          local.set $l27
                          i32.const 0
                          local.set $l26
                          block $B49
                            local.get $l15
                            local.get $p1
                            i32.ge_u
                            br_if $B49
                            local.get $l11
                            i32.const 2
                            i32.add
                            local.set $l13
                            i32.const 0
                            local.set $l24
                            i32.const 1
                            local.set $l27
                            block $B50
                              local.get $p0
                              local.get $l15
                              i32.add
                              i32.load8_u
                              local.tee $l12
                              i32.const -58
                              i32.add
                              i32.const 255
                              i32.and
                              i32.const 246
                              i32.ge_u
                              br_if $B50
                              local.get $l15
                              local.set $l12
                              i32.const 0
                              local.set $l26
                              br $B49
                            end
                            local.get $l12
                            i32.const -48
                            i32.add
                            local.set $l24
                            i32.const 0
                            local.set $l26
                            block $B51
                              local.get $l14
                              i32.const 2
                              i32.add
                              local.tee $l12
                              local.get $p1
                              i32.lt_u
                              br_if $B51
                              i32.const 0
                              local.set $l27
                              br $B49
                            end
                            local.get $l11
                            i32.const 3
                            i32.add
                            local.set $l13
                            local.get $p0
                            local.get $l12
                            i32.add
                            i32.load8_u
                            local.tee $l28
                            i32.const -58
                            i32.add
                            i32.const 255
                            i32.and
                            i32.const 246
                            i32.lt_u
                            br_if $B49
                            local.get $l24
                            i32.const 10
                            i32.mul
                            local.get $l28
                            i32.add
                            i32.const -48
                            i32.add
                            local.set $l24
                            i32.const 1
                            local.set $l26
                            block $B52
                              local.get $l14
                              i32.const 3
                              i32.add
                              local.tee $l12
                              local.get $p1
                              i32.lt_u
                              br_if $B52
                              i32.const 0
                              local.set $l27
                              br $B49
                            end
                            local.get $l11
                            i32.const 4
                            i32.add
                            local.set $l13
                            i32.const 1
                            local.set $l26
                            block $B53
                              local.get $p0
                              local.get $l12
                              i32.add
                              i32.load8_u
                              local.tee $l11
                              i32.const -58
                              i32.add
                              i32.const 255
                              i32.and
                              i32.const 246
                              i32.ge_u
                              br_if $B53
                              i32.const 1
                              local.set $l27
                              br $B49
                            end
                            local.get $l14
                            i32.const 4
                            i32.add
                            local.tee $l12
                            local.get $p1
                            i32.lt_u
                            local.set $l27
                            local.get $l24
                            i32.const 10
                            i32.mul
                            local.get $l11
                            i32.add
                            i32.const -48
                            i32.add
                            local.set $l24
                          end
                          block $B54
                            local.get $l12
                            local.get $l15
                            i32.ne
                            br_if $B54
                            local.get $l25
                            local.set $l15
                            br $B5
                          end
                          block $B55
                            local.get $l24
                            i32.const 255
                            i32.le_u
                            br_if $B55
                            local.get $l25
                            local.set $l15
                            br $B5
                          end
                          block $B56
                            local.get $l26
                            i32.eqz
                            br_if $B56
                            local.get $p0
                            local.get $l15
                            i32.add
                            i32.load8_u
                            i32.const 48
                            i32.ne
                            br_if $B56
                            local.get $l25
                            local.set $l15
                            br $B5
                          end
                          local.get $l27
                          i32.eqz
                          br_if $B12
                          local.get $l13
                          i32.const 1
                          i32.add
                          local.set $l13
                          block $B57
                            local.get $p0
                            local.get $l12
                            i32.add
                            i32.load8_u
                            local.tee $l11
                            i32.const -48
                            i32.add
                            i32.const 255
                            i32.and
                            i32.const 10
                            i32.ge_u
                            br_if $B57
                            local.get $l25
                            local.set $l15
                            br $B5
                          end
                          i32.const -1
                          local.get $l12
                          local.get $l11
                          i32.const 255
                          i32.and
                          i32.const 46
                          i32.eq
                          select
                          local.set $l12
                          br $B12
                        end
                        block $B58
                          local.get $l27
                          i32.const 3
                          i32.add
                          local.tee $l12
                          local.get $p1
                          i32.le_u
                          br_if $B58
                          local.get $l25
                          local.set $l15
                          br $B5
                        end
                        block $B59
                          local.get $p0
                          local.get $l27
                          i32.add
                          local.tee $l11
                          i32.load8_u
                          local.tee $l14
                          i32.const -58
                          i32.add
                          i32.const 255
                          i32.and
                          i32.const 246
                          i32.ge_u
                          br_if $B59
                          local.get $l13
                          i32.const 1
                          i32.add
                          local.set $l13
                          local.get $l25
                          local.set $l15
                          br $B5
                        end
                        block $B60
                          local.get $l11
                          i32.const 1
                          i32.add
                          i32.load8_u
                          local.tee $l15
                          i32.const -58
                          i32.add
                          i32.const 255
                          i32.and
                          i32.const 246
                          i32.ge_u
                          br_if $B60
                          local.get $l13
                          i32.const 2
                          i32.add
                          local.set $l13
                          local.get $l25
                          local.set $l15
                          br $B5
                        end
                        local.get $l13
                        i32.const 3
                        i32.add
                        local.set $l24
                        local.get $l11
                        i32.const 2
                        i32.add
                        i32.load8_u
                        local.tee $l11
                        i32.const -58
                        i32.add
                        i32.const 255
                        i32.and
                        i32.const 246
                        i32.lt_u
                        br_if $B8
                        local.get $l14
                        i32.const 10
                        i32.mul
                        local.get $l15
                        i32.add
                        i32.const 10
                        i32.mul
                        local.get $l11
                        i32.add
                        i32.const -5928
                        i32.add
                        i32.const -500
                        i32.lt_u
                        br_if $B8
                        block $B61
                          local.get $l12
                          local.get $p1
                          i32.lt_u
                          br_if $B61
                          local.get $l24
                          local.set $l13
                          br $B12
                        end
                        i32.const -1
                        local.get $l12
                        local.get $p0
                        local.get $l12
                        i32.add
                        i32.load8_u
                        i32.const -48
                        i32.add
                        i32.const 255
                        i32.and
                        i32.const 10
                        i32.lt_u
                        select
                        local.set $l12
                        local.get $l13
                        i32.const 4
                        i32.add
                        local.set $l13
                      end
                      block $B62
                        local.get $l12
                        i32.const 0
                        i32.ge_s
                        br_if $B62
                        local.get $l25
                        local.set $l15
                        br $B5
                      end
                      block $B63
                        local.get $l17
                        local.get $p5
                        i32.lt_u
                        br_if $B63
                        local.get $l25
                        local.set $l15
                        br $B5
                      end
                      local.get $p2
                      local.get $l17
                      i32.const 2
                      i32.shl
                      local.tee $l11
                      i32.add
                      local.get $l23
                      i32.store
                      local.get $p3
                      local.get $l11
                      i32.add
                      local.get $l19
                      i32.store
                      local.get $p4
                      local.get $l11
                      i32.add
                      local.get $l12
                      i32.store
                      local.get $l17
                      i32.const 1
                      i32.add
                      local.set $l17
                      local.get $l25
                      local.set $l15
                      br $B5
                    end
                    local.get $l15
                    local.get $l11
                    i32.add
                    i32.const 1
                    i32.add
                    local.set $l15
                    br $B5
                  end
                  local.get $l25
                  local.set $l15
                  local.get $l24
                  local.set $l13
                  br $B5
                end
                local.get $l25
                local.set $l15
                local.get $l11
                local.set $l13
                br $B5
              end
              local.get $l25
              local.set $l15
              local.get $l14
              local.set $l13
            end
            local.get $l22
            local.get $l21
            i32.ne
            br_if $L4
          end
          local.get $l16
          local.get $l21
          i32.add
          local.set $l16
        end
        local.get $l18
        i32.const 1
        i32.add
        local.set $l18
        local.get $l10
        i32.const -1
        i32.add
        local.set $l10
        local.get $l19
        i32.const 1
        i32.add
        local.tee $l19
        local.get $p1
        i32.ne
        br_if $L2
      end
    end
    local.get $p7
    local.get $l16
    i32.store
    local.get $p8
    local.get $l15
    i32.store
    local.get $p9
    local.get $l13
    i32.store
    local.get $l17)
  (memory $memory 64)
  (global $__stack_pointer (mut i32) (i32.const 65536))
  (global $__dso_handle i32 (i32.const 65536))
  (global $__data_end i32 (i32.const 65908))
  (global $__stack_low i32 (i32.const 0))
  (global $__stack_high i32 (i32.const 65536))
  (global $__global_base i32 (i32.const 65536))
  (global $__heap_base i32 (i32.const 65920))
  (global $__heap_end i32 (i32.const 4194304))
  (global $__memory_base i32 (i32.const 0))
  (global $__table_base i32 (i32.const 1))
  (global $__wasm_first_page_end i32 (i32.const 65536))
  (export "memory" (memory $memory))
  (export "__wasm_call_ctors" (func $__wasm_call_ctors))
  (export "__stack_pointer" (global $__stack_pointer))
  (export "scan_log" (func $scan_log))
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
  (data $.rodata (i32.const 65536) "http://\00\00\00\00\00\00\00\00\00\00https://\00\00\00\00\00\00\00\00\00ws://\00\00\00\00\00\00\00\00\00\00\00\00wss://\00\00\00\00\00\00\00\00\00\00\00ftp://\00\00\00\00\00\00\00\00\00\00\00asset://\00\00\00\00\00\00\00\00\00api://\00\00\00\00\00\00\00\00\00\00\00cdn://\00\00\00\00\00\00\00\00\00\00\00ip=\00\00\00\00\00\00\00\00\00\00\00\00\00\00client-ip:\00\00\00\00\00\00\00source-ip:\00\00\00\00\00\00\00dest-ip:\00\00\00\00\00\00\00\00\00peer-ip:\00\00\00\00\00\00\00\00\00origin-ip:\00\00\00\00\00\00\00status=\00\00\00\00\00\00\00\00\00\00code=\00\00\00\00\00\00\00\00\00\00\00\00http-status:\00\00\00\00\00response-status:\00result-status:\00\00\00status-code:\00\00\00\00\00\00\00\00\00\00\00\00\00\00\00\00\00\07\08\05\06\06\08\06\06\03\0a\0a\08\08\0a\07\05\0c\10\0e\0c"))
