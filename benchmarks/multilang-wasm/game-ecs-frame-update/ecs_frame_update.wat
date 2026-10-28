;; game.ecs-frame-update.v1 — kernel: ecs_frame_update
;; WebAssembly Text (WAT) baseline implementation
;; Exports: ecs_frame_update

(module $ecs_frame_update_c.wasm
  (type $t0 (func))
  (type $t1 (func (result i32)))
  (type $t2 (func (param i32) (result i32)))
  (func $__wasm_call_ctors (type $t0))
  (func $input_ptr (type $t1) (result i32)
    i32.const 65536)
  (func $result_ptr (type $t1) (result i32)
    i32.const 147536)
  (func $run (type $t2) (param $p0 i32) (result i32)
    (local $l1 i32) (local $l2 i32) (local $l3 i32) (local $l4 i32) (local $l5 i32) (local $l6 i32) (local $l7 i32) (local $l8 i32) (local $l9 i32) (local $l10 i32) (local $l11 i32) (local $l12 i32) (local $l13 i32) (local $l14 i32) (local $l15 i32) (local $l16 i32) (local $l17 i32) (local $l18 i32) (local $l19 i32) (local $l20 i32) (local $l21 i32) (local $l22 i32) (local $l23 i32) (local $l24 i32) (local $l25 i32) (local $l26 i32) (local $l27 i32) (local $l28 i32)
    i32.const 1
    local.set $l1
    block $B0
      local.get $p0
      i32.const -16
      i32.add
      i32.const 81984
      i32.gt_u
      br_if $B0
      i32.const 0
      i32.load offset=65536
      i32.const 826495813
      i32.ne
      br_if $B0
      i32.const 2
      local.set $l1
      i32.const 0
      i32.load offset=65540
      local.tee $l2
      i32.const -10001
      i32.add
      i32.const -9999
      i32.lt_u
      br_if $B0
      i32.const 0
      i32.load offset=65544
      local.tee $l3
      i32.const -1001
      i32.add
      i32.const -1000
      i32.lt_u
      br_if $B0
      i32.const 3
      local.set $l1
      local.get $p0
      local.get $l2
      i32.const 3
      i32.shl
      i32.const 16
      i32.add
      local.tee $l4
      local.get $l3
      i32.add
      i32.ne
      br_if $B0
      i32.const 0
      local.set $l5
      i32.const 147536
      i32.const 0
      i32.const 240512
      memory.fill
      i32.const 65536
      local.set $l1
      i32.const 0
      local.set $p0
      loop $L1
        local.get $l5
        i32.const 388048
        i32.add
        local.get $l1
        i32.const 16
        i32.add
        i32.load16_u
        i32.store16
        local.get $l5
        i32.const 408048
        i32.add
        local.get $l1
        i32.const 18
        i32.add
        i32.load16_u
        i32.store16
        local.get $p0
        i32.const 428048
        i32.add
        local.get $l1
        i32.const 20
        i32.add
        i32.load8_u
        i32.store8
        local.get $p0
        i32.const 438048
        i32.add
        local.get $l1
        i32.const 21
        i32.add
        i32.load8_u
        i32.store8
        local.get $p0
        i32.const 448048
        i32.add
        local.get $l1
        i32.const 22
        i32.add
        i32.load8_u
        i32.store8
        local.get $p0
        i32.const 458048
        i32.add
        local.get $l1
        i32.const 23
        i32.add
        i32.load8_u
        i32.store8
        local.get $l5
        i32.const 2
        i32.add
        local.set $l5
        local.get $l1
        i32.const 8
        i32.add
        local.set $l1
        local.get $l2
        local.get $p0
        i32.const 1
        i32.add
        local.tee $p0
        i32.ne
        br_if $L1
      end
      local.get $l4
      i32.const 65536
      i32.add
      local.set $l6
      i32.const 1597334677
      local.set $l7
      i32.const 0
      local.set $l8
      i32.const 0
      local.set $l9
      i32.const 0
      local.set $l10
      i32.const 0
      local.set $l5
      i32.const 0
      local.set $p0
      i32.const 0
      local.set $l4
      loop $L2
        i32.const 0
        local.get $l6
        local.get $l10
        i32.add
        i32.load8_u
        local.tee $l11
        i32.const 3
        i32.and
        local.tee $l1
        i32.const -1
        i32.add
        local.get $l1
        i32.const 3
        i32.eq
        select
        local.set $l12
        i32.const 0
        local.get $l11
        i32.const 2
        i32.shr_u
        i32.const 3
        i32.and
        local.tee $l1
        i32.const -1
        i32.add
        local.get $l1
        i32.const 3
        i32.eq
        select
        local.set $l13
        local.get $l10
        local.get $l10
        i32.const 257
        i32.div_u
        i32.const 257
        i32.mul
        i32.sub
        local.set $l14
        i32.const 0
        local.set $l15
        i32.const 0
        local.set $l1
        loop $L3
          local.get $l1
          i32.const 428048
          i32.add
          local.tee $l16
          i32.load8_s
          local.set $l17
          block $B4
            block $B5
              local.get $l14
              local.get $l1
              i32.const 257
              i32.div_u
              i32.const 257
              i32.mul
              i32.add
              local.get $l1
              i32.eq
              br_if $B5
              local.get $l1
              i32.const 438048
              i32.add
              i32.load8_u
              local.set $l18
              br $B4
            end
            local.get $l16
            local.get $l12
            local.get $l17
            i32.add
            local.tee $l19
            i32.const -16
            local.get $l19
            i32.const -16
            i32.gt_s
            select
            local.tee $l19
            i32.const 16
            local.get $l19
            i32.const 16
            i32.lt_s
            select
            local.tee $l17
            i32.store8
            local.get $l1
            i32.const 438048
            i32.add
            local.tee $l19
            local.get $l13
            local.get $l19
            i32.load8_s
            i32.add
            local.tee $l19
            i32.const -16
            local.get $l19
            i32.const -16
            i32.gt_s
            select
            local.tee $l19
            i32.const 16
            local.get $l19
            i32.const 16
            i32.lt_s
            select
            local.tee $l18
            i32.store8
            local.get $l5
            i32.const 2
            i32.add
            local.set $l5
            local.get $l8
            i32.const 2
            i32.add
            local.set $l8
          end
          local.get $l18
          i32.extend8_s
          local.get $l15
          i32.const 408048
          i32.add
          local.tee $l20
          i32.load16_u
          i32.add
          local.set $l19
          i32.const 0
          local.set $l21
          block $B6
            block $B7
              local.get $l17
              i32.extend8_s
              local.get $l15
              i32.const 388048
              i32.add
              local.tee $l22
              i32.load16_u
              i32.add
              local.tee $l23
              i32.const 0
              i32.lt_s
              br_if $B7
              i32.const 131070
              local.set $l21
              local.get $l23
              i32.const 65536
              i32.lt_u
              br_if $B6
            end
            local.get $l16
            i32.const 0
            local.get $l17
            i32.sub
            i32.store8
            local.get $l5
            i32.const 1
            i32.add
            local.set $l5
            local.get $l21
            local.get $l23
            i32.sub
            local.set $l23
          end
          i32.const 0
          local.set $l17
          block $B8
            block $B9
              local.get $l19
              i32.const 0
              i32.lt_s
              br_if $B9
              i32.const 131070
              local.set $l17
              local.get $l19
              i32.const 65536
              i32.lt_u
              br_if $B8
            end
            local.get $l1
            i32.const 438048
            i32.add
            i32.const 0
            local.get $l18
            i32.sub
            i32.store8
            local.get $l5
            i32.const 1
            i32.add
            local.set $l5
            local.get $l17
            local.get $l19
            i32.sub
            local.set $l19
          end
          local.get $l20
          local.get $l19
          i32.store16
          local.get $l22
          local.get $l23
          i32.store16
          local.get $l15
          i32.const 2
          i32.add
          local.set $l15
          local.get $l5
          i32.const 2
          i32.add
          local.set $l5
          local.get $l2
          local.get $l1
          i32.const 1
          i32.add
          local.tee $l1
          i32.ne
          br_if $L3
        end
        i32.const 468048
        i32.const 255
        i32.const 65536
        memory.fill
        i32.const 0
        local.set $l1
        i32.const 533584
        local.set $l19
        i32.const 0
        local.set $l15
        loop $L10
          local.get $l19
          local.get $l1
          i32.const 408048
          i32.add
          i32.load16_u
          i32.const 2
          i32.shr_u
          i32.const 16256
          i32.and
          local.get $l1
          i32.const 388048
          i32.add
          i32.load16_u
          i32.const 9
          i32.shr_u
          i32.or
          i32.const 2
          i32.shl
          local.tee $l23
          i32.load offset=468048
          i32.store
          local.get $l23
          local.get $l15
          i32.store offset=468048
          local.get $l19
          i32.const 4
          i32.add
          local.set $l19
          local.get $l1
          i32.const 2
          i32.add
          local.set $l1
          local.get $l2
          local.get $l15
          i32.const 1
          i32.add
          local.tee $l15
          i32.ne
          br_if $L10
        end
        i32.const 0
        local.set $l24
        loop $L11
          local.get $l24
          i32.const 9
          i32.shl
          i32.const 468048
          i32.add
          local.set $l25
          i32.const 0
          local.set $l12
          loop $L12
            block $B13
              block $B14
                block $B15
                  block $B16
                    block $B17
                      block $B18
                        block $B19
                          block $B20
                            block $B21
                              block $B22
                                local.get $l25
                                local.get $l12
                                i32.const 2
                                i32.shl
                                i32.add
                                local.tee $l26
                                i32.load
                                local.tee $l22
                                i32.const 0
                                i32.lt_s
                                local.tee $l27
                                br_if $B22
                                local.get $l22
                                local.set $l14
                                block $B23
                                  local.get $l22
                                  i32.const 2
                                  i32.shl
                                  i32.load offset=533584
                                  local.tee $l1
                                  i32.const 0
                                  i32.lt_s
                                  br_if $B23
                                  loop $L24
                                    local.get $l14
                                    local.tee $l18
                                    i32.const 1
                                    i32.shl
                                    local.tee $l19
                                    i32.load16_u offset=408048
                                    local.set $l20
                                    local.get $l19
                                    i32.load16_u offset=388048
                                    local.set $l21
                                    local.get $l18
                                    i32.load8_u offset=458048
                                    local.set $l16
                                    local.get $l1
                                    local.tee $l14
                                    local.set $l1
                                    loop $L25
                                      block $B26
                                        local.get $l21
                                        local.get $l1
                                        i32.const 1
                                        i32.shl
                                        local.tee $l23
                                        i32.load16_u offset=388048
                                        i32.sub
                                        local.tee $l15
                                        i32.const 0
                                        local.get $l1
                                        i32.load8_u offset=458048
                                        local.get $l16
                                        i32.add
                                        local.tee $l19
                                        i32.sub
                                        local.tee $l17
                                        i32.lt_s
                                        br_if $B26
                                        local.get $l15
                                        local.get $l19
                                        i32.gt_s
                                        br_if $B26
                                        local.get $l20
                                        local.get $l23
                                        i32.load16_u offset=408048
                                        i32.sub
                                        local.tee $l15
                                        local.get $l17
                                        i32.lt_s
                                        br_if $B26
                                        local.get $l15
                                        local.get $l19
                                        i32.gt_s
                                        br_if $B26
                                        local.get $l18
                                        i32.const 428048
                                        i32.add
                                        local.tee $l19
                                        i32.load8_u
                                        local.set $l15
                                        local.get $l19
                                        local.get $l1
                                        i32.load8_u offset=428048
                                        i32.store8
                                        local.get $l18
                                        i32.const 438048
                                        i32.add
                                        local.tee $l19
                                        i32.load8_u
                                        local.set $l23
                                        local.get $l19
                                        local.get $l1
                                        i32.load8_u offset=438048
                                        i32.store8
                                        local.get $l1
                                        local.get $l15
                                        i32.store8 offset=428048
                                        local.get $l1
                                        local.get $l23
                                        i32.store8 offset=438048
                                        local.get $l5
                                        i32.const 4
                                        i32.add
                                        local.set $l5
                                        local.get $l4
                                        i32.const 1
                                        i32.add
                                        local.set $l4
                                      end
                                      local.get $p0
                                      i32.const 1
                                      i32.add
                                      local.set $p0
                                      local.get $l1
                                      i32.const 2
                                      i32.shl
                                      i32.load offset=533584
                                      local.tee $l1
                                      i32.const -1
                                      i32.gt_s
                                      br_if $L25
                                    end
                                    local.get $l14
                                    i32.const 2
                                    i32.shl
                                    i32.load offset=533584
                                    local.tee $l1
                                    i32.const -1
                                    i32.gt_s
                                    br_if $L24
                                  end
                                end
                                i32.const 1
                                local.set $l28
                                local.get $l12
                                i32.const 127
                                i32.ne
                                br_if $B21
                                i32.const 128
                                local.set $l13
                                br $B20
                              end
                              local.get $l12
                              i32.const 127
                              i32.eq
                              local.set $l28
                              local.get $l12
                              i32.const 1
                              i32.add
                              local.set $l13
                              br $B20
                            end
                            local.get $l12
                            i32.const 1
                            i32.add
                            local.set $l13
                            local.get $l26
                            i32.load offset=4
                            local.tee $l14
                            i32.const 0
                            i32.lt_s
                            br_if $B19
                            local.get $l22
                            local.set $l18
                            loop $L27
                              local.get $l18
                              i32.const 1
                              i32.shl
                              local.tee $l1
                              i32.load16_u offset=408048
                              local.set $l20
                              local.get $l1
                              i32.load16_u offset=388048
                              local.set $l21
                              local.get $l18
                              i32.load8_u offset=458048
                              local.set $l16
                              local.get $l14
                              local.set $l1
                              loop $L28
                                block $B29
                                  local.get $l21
                                  local.get $l1
                                  i32.const 1
                                  i32.shl
                                  local.tee $l23
                                  i32.load16_u offset=388048
                                  i32.sub
                                  local.tee $l15
                                  i32.const 0
                                  local.get $l1
                                  i32.load8_u offset=458048
                                  local.get $l16
                                  i32.add
                                  local.tee $l19
                                  i32.sub
                                  local.tee $l17
                                  i32.lt_s
                                  br_if $B29
                                  local.get $l15
                                  local.get $l19
                                  i32.gt_s
                                  br_if $B29
                                  local.get $l20
                                  local.get $l23
                                  i32.load16_u offset=408048
                                  i32.sub
                                  local.tee $l15
                                  local.get $l17
                                  i32.lt_s
                                  br_if $B29
                                  local.get $l15
                                  local.get $l19
                                  i32.gt_s
                                  br_if $B29
                                  local.get $l18
                                  i32.const 428048
                                  i32.add
                                  local.tee $l19
                                  i32.load8_u
                                  local.set $l15
                                  local.get $l19
                                  local.get $l1
                                  i32.load8_u offset=428048
                                  i32.store8
                                  local.get $l18
                                  i32.const 438048
                                  i32.add
                                  local.tee $l19
                                  i32.load8_u
                                  local.set $l23
                                  local.get $l19
                                  local.get $l1
                                  i32.load8_u offset=438048
                                  i32.store8
                                  local.get $l1
                                  local.get $l15
                                  i32.store8 offset=428048
                                  local.get $l1
                                  local.get $l23
                                  i32.store8 offset=438048
                                  local.get $l5
                                  i32.const 4
                                  i32.add
                                  local.set $l5
                                  local.get $l4
                                  i32.const 1
                                  i32.add
                                  local.set $l4
                                end
                                local.get $p0
                                i32.const 1
                                i32.add
                                local.set $p0
                                local.get $l1
                                i32.const 2
                                i32.shl
                                i32.load offset=533584
                                local.tee $l1
                                i32.const -1
                                i32.gt_s
                                br_if $L28
                              end
                              local.get $l18
                              i32.const 2
                              i32.shl
                              i32.load offset=533584
                              local.tee $l18
                              i32.const -1
                              i32.gt_s
                              br_if $L27
                            end
                            i32.const 0
                            local.set $l28
                          end
                          local.get $l24
                          i32.const 127
                          i32.eq
                          br_if $B17
                          local.get $l12
                          i32.eqz
                          br_if $B17
                          local.get $l13
                          local.set $l12
                          local.get $l27
                          i32.eqz
                          br_if $B18
                          br $B13
                        end
                        local.get $l24
                        i32.const 127
                        i32.eq
                        br_if $B16
                        i32.const 0
                        local.set $l28
                        local.get $l12
                        i32.eqz
                        br_if $B16
                      end
                      local.get $l26
                      i32.load offset=508
                      local.tee $l14
                      i32.const 0
                      i32.lt_s
                      br_if $B15
                      local.get $l22
                      local.set $l18
                      loop $L30
                        local.get $l18
                        i32.const 1
                        i32.shl
                        local.tee $l1
                        i32.load16_u offset=408048
                        local.set $l20
                        local.get $l1
                        i32.load16_u offset=388048
                        local.set $l21
                        local.get $l18
                        i32.load8_u offset=458048
                        local.set $l16
                        local.get $l14
                        local.set $l1
                        loop $L31
                          block $B32
                            local.get $l21
                            local.get $l1
                            i32.const 1
                            i32.shl
                            local.tee $l23
                            i32.load16_u offset=388048
                            i32.sub
                            local.tee $l15
                            i32.const 0
                            local.get $l1
                            i32.load8_u offset=458048
                            local.get $l16
                            i32.add
                            local.tee $l19
                            i32.sub
                            local.tee $l17
                            i32.lt_s
                            br_if $B32
                            local.get $l15
                            local.get $l19
                            i32.gt_s
                            br_if $B32
                            local.get $l20
                            local.get $l23
                            i32.load16_u offset=408048
                            i32.sub
                            local.tee $l15
                            local.get $l17
                            i32.lt_s
                            br_if $B32
                            local.get $l15
                            local.get $l19
                            i32.gt_s
                            br_if $B32
                            local.get $l18
                            i32.const 428048
                            i32.add
                            local.tee $l19
                            i32.load8_u
                            local.set $l15
                            local.get $l19
                            local.get $l1
                            i32.load8_u offset=428048
                            i32.store8
                            local.get $l18
                            i32.const 438048
                            i32.add
                            local.tee $l19
                            i32.load8_u
                            local.set $l23
                            local.get $l19
                            local.get $l1
                            i32.load8_u offset=438048
                            i32.store8
                            local.get $l1
                            local.get $l15
                            i32.store8 offset=428048
                            local.get $l1
                            local.get $l23
                            i32.store8 offset=438048
                            local.get $l5
                            i32.const 4
                            i32.add
                            local.set $l5
                            local.get $l4
                            i32.const 1
                            i32.add
                            local.set $l4
                          end
                          local.get $p0
                          i32.const 1
                          i32.add
                          local.set $p0
                          local.get $l1
                          i32.const 2
                          i32.shl
                          i32.load offset=533584
                          local.tee $l1
                          i32.const -1
                          i32.gt_s
                          br_if $L31
                        end
                        local.get $l18
                        i32.const 2
                        i32.shl
                        i32.load offset=533584
                        local.tee $l18
                        i32.const -1
                        i32.gt_s
                        br_if $L30
                      end
                    end
                    local.get $l24
                    i32.const 127
                    i32.eq
                    br_if $B14
                    local.get $l13
                    local.set $l12
                    local.get $l27
                    br_if $B13
                    br $B15
                  end
                  i32.const 0
                  local.set $l28
                  local.get $l13
                  local.set $l12
                  local.get $l24
                  i32.const 127
                  i32.eq
                  br_if $B13
                end
                block $B33
                  local.get $l26
                  i32.load offset=512
                  local.tee $l14
                  i32.const 0
                  i32.lt_s
                  br_if $B33
                  local.get $l22
                  local.set $l18
                  loop $L34
                    local.get $l18
                    i32.const 1
                    i32.shl
                    local.tee $l1
                    i32.load16_u offset=408048
                    local.set $l20
                    local.get $l1
                    i32.load16_u offset=388048
                    local.set $l21
                    local.get $l18
                    i32.load8_u offset=458048
                    local.set $l16
                    local.get $l14
                    local.set $l1
                    loop $L35
                      block $B36
                        local.get $l21
                        local.get $l1
                        i32.const 1
                        i32.shl
                        local.tee $l23
                        i32.load16_u offset=388048
                        i32.sub
                        local.tee $l15
                        i32.const 0
                        local.get $l1
                        i32.load8_u offset=458048
                        local.get $l16
                        i32.add
                        local.tee $l19
                        i32.sub
                        local.tee $l17
                        i32.lt_s
                        br_if $B36
                        local.get $l15
                        local.get $l19
                        i32.gt_s
                        br_if $B36
                        local.get $l20
                        local.get $l23
                        i32.load16_u offset=408048
                        i32.sub
                        local.tee $l15
                        local.get $l17
                        i32.lt_s
                        br_if $B36
                        local.get $l15
                        local.get $l19
                        i32.gt_s
                        br_if $B36
                        local.get $l18
                        i32.const 428048
                        i32.add
                        local.tee $l19
                        i32.load8_u
                        local.set $l15
                        local.get $l19
                        local.get $l1
                        i32.load8_u offset=428048
                        i32.store8
                        local.get $l18
                        i32.const 438048
                        i32.add
                        local.tee $l19
                        i32.load8_u
                        local.set $l23
                        local.get $l19
                        local.get $l1
                        i32.load8_u offset=438048
                        i32.store8
                        local.get $l1
                        local.get $l15
                        i32.store8 offset=428048
                        local.get $l1
                        local.get $l23
                        i32.store8 offset=438048
                        local.get $l5
                        i32.const 4
                        i32.add
                        local.set $l5
                        local.get $l4
                        i32.const 1
                        i32.add
                        local.set $l4
                      end
                      local.get $p0
                      i32.const 1
                      i32.add
                      local.set $p0
                      local.get $l1
                      i32.const 2
                      i32.shl
                      i32.load offset=533584
                      local.tee $l1
                      i32.const -1
                      i32.gt_s
                      br_if $L35
                    end
                    local.get $l18
                    i32.const 2
                    i32.shl
                    i32.load offset=533584
                    local.tee $l18
                    i32.const -1
                    i32.gt_s
                    br_if $L34
                  end
                end
                local.get $l28
                br_if $B14
                local.get $l26
                i32.load offset=516
                local.tee $l20
                i32.const 0
                i32.lt_s
                br_if $B14
                loop $L37
                  local.get $l22
                  i32.const 1
                  i32.shl
                  local.tee $l1
                  i32.load16_u offset=408048
                  local.set $l16
                  local.get $l1
                  i32.load16_u offset=388048
                  local.set $l18
                  local.get $l22
                  i32.load8_u offset=458048
                  local.set $l21
                  local.get $l20
                  local.set $l1
                  loop $L38
                    block $B39
                      local.get $l18
                      local.get $l1
                      i32.const 1
                      i32.shl
                      local.tee $l23
                      i32.load16_u offset=388048
                      i32.sub
                      local.tee $l15
                      i32.const 0
                      local.get $l1
                      i32.load8_u offset=458048
                      local.get $l21
                      i32.add
                      local.tee $l19
                      i32.sub
                      local.tee $l17
                      i32.lt_s
                      br_if $B39
                      local.get $l15
                      local.get $l19
                      i32.gt_s
                      br_if $B39
                      local.get $l16
                      local.get $l23
                      i32.load16_u offset=408048
                      i32.sub
                      local.tee $l15
                      local.get $l17
                      i32.lt_s
                      br_if $B39
                      local.get $l15
                      local.get $l19
                      i32.gt_s
                      br_if $B39
                      local.get $l22
                      i32.const 428048
                      i32.add
                      local.tee $l19
                      i32.load8_u
                      local.set $l15
                      local.get $l19
                      local.get $l1
                      i32.load8_u offset=428048
                      i32.store8
                      local.get $l22
                      i32.const 438048
                      i32.add
                      local.tee $l19
                      i32.load8_u
                      local.set $l23
                      local.get $l19
                      local.get $l1
                      i32.load8_u offset=438048
                      i32.store8
                      local.get $l1
                      local.get $l15
                      i32.store8 offset=428048
                      local.get $l1
                      local.get $l23
                      i32.store8 offset=438048
                      local.get $l5
                      i32.const 4
                      i32.add
                      local.set $l5
                      local.get $l4
                      i32.const 1
                      i32.add
                      local.set $l4
                    end
                    local.get $p0
                    i32.const 1
                    i32.add
                    local.set $p0
                    local.get $l1
                    i32.const 2
                    i32.shl
                    i32.load offset=533584
                    local.tee $l1
                    i32.const -1
                    i32.gt_s
                    br_if $L38
                  end
                  local.get $l22
                  i32.const 2
                  i32.shl
                  i32.load offset=533584
                  local.tee $l22
                  i32.const -1
                  i32.gt_s
                  br_if $L37
                end
              end
              local.get $l13
              local.set $l12
            end
            local.get $l12
            i32.const 128
            i32.ne
            br_if $L12
          end
          local.get $l24
          i32.const 1
          i32.add
          local.tee $l24
          i32.const 128
          i32.ne
          br_if $L11
        end
        local.get $l11
        i32.const 4
        i32.shr_u
        i32.const 1
        i32.and
        i32.const 1
        i32.add
        local.set $l15
        i32.const 0
        local.set $l1
        loop $L40
          local.get $l1
          i32.const 448048
          i32.add
          local.tee $l19
          local.get $l15
          local.get $l19
          i32.load8_u
          i32.add
          local.get $l1
          i32.const 438048
          i32.add
          i32.load8_u
          local.tee $l19
          local.get $l19
          i32.extend8_s
          i32.const 7
          i32.shr_s
          local.tee $l19
          i32.xor
          local.get $l19
          i32.sub
          local.get $l1
          i32.const 428048
          i32.add
          i32.load8_u
          local.tee $l19
          local.get $l19
          i32.extend8_s
          i32.const 7
          i32.shr_s
          local.tee $l19
          i32.xor
          local.get $l19
          i32.sub
          i32.add
          i32.const 3
          i32.and
          i32.add
          i32.store8
          local.get $l2
          local.get $l1
          i32.const 1
          i32.add
          local.tee $l1
          i32.ne
          br_if $L40
        end
        block $B41
          block $B42
            local.get $l10
            i32.const 1
            i32.add
            local.tee $l10
            i32.const 100
            i32.rem_u
            i32.eqz
            br_if $B42
            local.get $l10
            local.get $l3
            i32.ne
            br_if $B41
          end
          i32.const 2135587861
          local.set $l15
          i32.const 0
          local.set $l19
          i32.const 0
          local.set $l1
          loop $L43
            local.get $l15
            local.get $l1
            i32.xor
            i32.const 16777619
            i32.mul
            local.get $l19
            i32.const 388048
            i32.add
            i32.load16_u
            i32.xor
            i32.const 16777619
            i32.mul
            local.get $l19
            i32.const 408048
            i32.add
            i32.load16_u
            i32.xor
            i32.const 16777619
            i32.mul
            local.get $l1
            i32.const 428048
            i32.add
            i32.load8_u
            i32.xor
            i32.const 16777619
            i32.mul
            local.get $l1
            i32.const 438048
            i32.add
            i32.load8_u
            i32.xor
            i32.const 16777619
            i32.mul
            local.get $l1
            i32.const 448048
            i32.add
            i32.load8_u
            i32.xor
            i32.const 16777619
            i32.mul
            local.get $l1
            i32.const 458048
            i32.add
            i32.load8_u
            i32.xor
            i32.const 16777619
            i32.mul
            local.set $l15
            local.get $l19
            i32.const 2
            i32.add
            local.set $l19
            local.get $l2
            local.get $l1
            i32.const 1
            i32.add
            local.tee $l1
            i32.ne
            br_if $L43
          end
          local.get $l9
          i32.const 12
          i32.mul
          local.tee $l1
          i32.const 147796
          i32.add
          local.get $l15
          i32.store
          local.get $l1
          i32.const 147792
          i32.add
          local.get $l10
          i32.store
          local.get $l1
          i32.const 147800
          i32.add
          local.get $p0
          i32.store
          local.get $l9
          i32.const 2
          i32.shl
          i32.const 147652
          i32.add
          local.get $l4
          i32.store
          local.get $l9
          i32.const 1
          i32.add
          local.set $l9
          local.get $p0
          local.get $l15
          local.get $l10
          local.get $l7
          i32.xor
          i32.const 16777619
          i32.mul
          i32.xor
          i32.const 16777619
          i32.mul
          i32.xor
          i32.const 16777619
          i32.mul
          local.set $l7
        end
        local.get $l2
        local.get $l5
        i32.add
        local.set $l5
        local.get $l10
        local.get $l3
        i32.ne
        br_if $L2
      end
      local.get $l2
      local.get $l3
      i32.mul
      local.set $l14
      i32.const 2135587861
      local.set $l23
      i32.const 0
      local.set $l15
      i32.const 147536
      local.set $l1
      i32.const 0
      local.set $l19
      loop $L44
        local.get $l1
        i32.const 532
        i32.add
        local.get $l19
        i32.const 458048
        i32.add
        i32.load8_u
        local.tee $l17
        i32.store
        local.get $l1
        i32.const 528
        i32.add
        local.get $l19
        i32.const 448048
        i32.add
        i32.load8_u
        local.tee $l18
        i32.store
        local.get $l1
        i32.const 524
        i32.add
        local.get $l19
        i32.const 438048
        i32.add
        i32.load8_u
        local.tee $l21
        i32.store
        local.get $l1
        i32.const 520
        i32.add
        local.get $l19
        i32.const 428048
        i32.add
        i32.load8_u
        local.tee $l16
        i32.store
        local.get $l1
        i32.const 516
        i32.add
        local.get $l15
        i32.const 408048
        i32.add
        i32.load16_u
        local.tee $l20
        i32.store
        local.get $l1
        i32.const 512
        i32.add
        local.get $l15
        i32.const 388048
        i32.add
        i32.load16_u
        local.tee $l22
        i32.store
        local.get $l17
        local.get $l18
        local.get $l21
        local.get $l16
        local.get $l20
        local.get $l22
        local.get $l23
        local.get $l19
        i32.xor
        i32.const 16777619
        i32.mul
        i32.xor
        i32.const 16777619
        i32.mul
        i32.xor
        i32.const 16777619
        i32.mul
        i32.xor
        i32.const 16777619
        i32.mul
        i32.xor
        i32.const 16777619
        i32.mul
        i32.xor
        i32.const 16777619
        i32.mul
        i32.xor
        i32.const 16777619
        i32.mul
        local.set $l23
        local.get $l1
        i32.const 24
        i32.add
        local.set $l1
        local.get $l15
        i32.const 2
        i32.add
        local.set $l15
        local.get $l2
        local.get $l19
        i32.const 1
        i32.add
        local.tee $l19
        i32.ne
        br_if $L44
      end
      i32.const 0
      local.set $l1
      i32.const 0
      local.get $l5
      i32.store offset=147648
      i32.const 0
      local.get $l8
      i32.store offset=147644
      i32.const 0
      local.get $l9
      i32.store offset=147640
      i32.const 0
      local.get $l14
      i32.store offset=147636
      i32.const 0
      local.get $l4
      i32.store offset=147632
      i32.const 0
      local.get $p0
      i32.store offset=147628
      i32.const 0
      local.get $l14
      i32.store offset=147612
      i32.const 0
      local.get $l2
      i32.store offset=147604
      i32.const 0
      local.get $l3
      i32.store offset=147600
      i32.const 0
      local.get $l7
      i32.store offset=147540
      i32.const 0
      local.get $l23
      i32.store offset=147536
      i32.const 0
      local.get $l14
      i32.store offset=147624
      i32.const 0
      local.get $l3
      i32.const 81920
      i32.mul
      i32.store offset=147620
      i32.const 0
      local.get $l3
      i32.const 14
      i32.shl
      i32.store offset=147616
      i32.const 0
      local.get $l3
      i32.const 3
      i32.mul
      i32.store offset=147608
    end
    local.get $l1)
  (table $__indirect_function_table 1 1 funcref)
  (memory $memory 256)
  (global $__stack_pointer (mut i32) (i32.const 65536))
  (global $__dso_handle i32 (i32.const 65536))
  (global $__data_end i32 (i32.const 573584))
  (global $__stack_low i32 (i32.const 0))
  (global $__stack_high i32 (i32.const 65536))
  (global $__global_base i32 (i32.const 65536))
  (global $__heap_base i32 (i32.const 573584))
  (global $__heap_end i32 (i32.const 16777216))
  (global $__memory_base i32 (i32.const 0))
  (global $__table_base i32 (i32.const 1))
  (global $__wasm_first_page_end i32 (i32.const 65536))
  (export "memory" (memory $memory))
  (export "__wasm_call_ctors" (func $__wasm_call_ctors))
  (export "__stack_pointer" (global $__stack_pointer))
  (export "input_ptr" (func $input_ptr))
  (export "result_ptr" (func $result_ptr))
  (export "run" (func $run))
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
