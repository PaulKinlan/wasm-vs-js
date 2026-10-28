;; network.pcap-decode.v1 — kernel: pcap_decode
;; WebAssembly Text (WAT) baseline implementation
;; Exports: pcap_decode

(module $pcap_decode_c.wasm
  (type $t0 (func))
  (type $t1 (func (result i32)))
  (type $t2 (func (param i32) (result i32)))
  (type $t3 (func (param i32 i32) (result i32)))
  (func $__wasm_call_ctors (type $t0))
  (func $input_ptr (type $t1) (result i32)
    i32.const 65536)
  (func $output_ptr (type $t1) (result i32)
    i32.const 327680)
  (func $output_len (type $t1) (result i32)
    i32.const 0
    i32.load offset=331776)
  (func $run (type $t2) (param $p0 i32) (result i32)
    (local $l1 i32) (local $l2 i32) (local $l3 i32) (local $l4 i32) (local $l5 i32) (local $l6 i32) (local $l7 i32) (local $l8 i32) (local $l9 i32) (local $l10 i32) (local $l11 i32) (local $l12 i32) (local $l13 i32) (local $l14 i32) (local $l15 i32) (local $l16 i32) (local $l17 i32) (local $l18 i32) (local $l19 i32) (local $l20 i32) (local $l21 i32) (local $l22 i32) (local $l23 i32) (local $l24 i32) (local $l25 i32) (local $l26 i32) (local $l27 i32) (local $l28 i32) (local $l29 i32) (local $l30 i32) (local $l31 i32) (local $l32 i32) (local $l33 i32) (local $l34 i32)
    global.get $__stack_pointer
    i32.const 5152
    i32.sub
    local.tee $l1
    global.set $__stack_pointer
    i32.const 331792
    i32.const 0
    i32.const 4864
    memory.fill
    i32.const 0
    i32.const 0
    i32.store offset=331776
    i32.const 0
    i32.const 0
    i32.store offset=336656
    block $B0
      block $B1
        local.get $p0
        i32.const 262144
        i32.le_u
        br_if $B1
        i32.const -5
        local.set $l2
        br $B0
      end
      i32.const -1
      local.set $l2
      local.get $p0
      i32.const 24
      i32.lt_u
      br_if $B0
      i32.const 0
      i32.load offset=65536
      i32.const -1582119980
      i32.ne
      br_if $B0
      i32.const 0
      i32.load8_u offset=65540
      i32.const 255
      i32.and
      i32.const 2
      i32.ne
      br_if $B0
      i32.const 0
      i32.load8_u offset=65541
      i32.const 255
      i32.and
      br_if $B0
      i32.const 0
      i32.load8_u offset=65542
      i32.const 255
      i32.and
      i32.const 4
      i32.ne
      br_if $B0
      i32.const 0
      i32.load8_u offset=65543
      i32.const 255
      i32.and
      br_if $B0
      i32.const 0
      i32.load offset=65556
      i32.const 1
      i32.ne
      br_if $B0
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
      block $B2
        local.get $p0
        i32.const 24
        i32.eq
        br_if $B2
        i32.const 0
        local.set $l14
        i32.const 0
        local.set $l5
        i32.const 24
        local.set $l15
        i32.const 0
        local.set $l16
        i32.const 0
        local.set $l12
        i32.const 0
        local.set $l4
        i32.const 0
        local.set $l11
        i32.const 0
        local.set $l10
        i32.const 0
        local.set $l13
        i32.const 0
        local.set $l8
        i32.const 0
        local.set $l9
        i32.const 0
        local.set $l17
        i32.const 0
        local.set $l7
        i32.const 0
        local.set $l6
        loop $L3
          local.get $l16
          local.set $l18
          local.get $l14
          local.set $l19
          block $B4
            local.get $l15
            local.tee $l20
            i32.const 16
            i32.add
            local.tee $l21
            local.get $p0
            i32.le_u
            br_if $B4
            i32.const -2
            local.set $l2
            br $B0
          end
          i32.const -7
          local.set $l2
          local.get $l20
          i32.load offset=65540 align=1
          local.tee $l16
          i32.const 999999
          i32.gt_u
          br_if $B0
          local.get $l20
          i32.load offset=65536 align=1
          local.tee $l14
          local.get $l19
          i32.lt_u
          br_if $B0
          block $B5
            local.get $l14
            local.get $l19
            i32.ne
            br_if $B5
            local.get $l16
            local.get $l18
            i32.lt_u
            br_if $B0
          end
          i32.const -3
          local.set $l2
          local.get $l20
          i32.const 65544
          i32.add
          i32.load align=1
          local.tee $l19
          local.get $l20
          i32.const 65548
          i32.add
          i32.load align=1
          i32.ne
          br_if $B0
          local.get $l19
          local.get $l21
          i32.add
          local.tee $l15
          local.get $p0
          i32.gt_u
          br_if $B0
          block $B6
            block $B7
              local.get $l19
              i32.const 13
              i32.le_u
              br_if $B7
              local.get $l11
              i32.const 1
              i32.add
              local.set $l11
              local.get $l19
              i32.const 34
              i32.lt_u
              br_if $B7
              local.get $l21
              i32.const 65536
              i32.add
              local.tee $l2
              i32.load16_u offset=12 align=1
              local.tee $l21
              i32.const 8
              i32.shl
              local.get $l21
              i32.const 8
              i32.shr_u
              i32.or
              i32.const 65535
              i32.and
              i32.const 2048
              i32.ne
              br_if $B7
              local.get $l10
              i32.const 1
              i32.add
              local.set $l10
              local.get $l2
              i32.load8_u offset=14
              i32.const 69
              i32.ne
              br_if $B7
              local.get $l2
              i32.load8_u offset=16
              i32.const 8
              i32.shl
              local.get $l2
              i32.const 17
              i32.add
              i32.load8_u
              i32.or
              i32.const 65535
              i32.and
              local.tee $l21
              i32.const 20
              i32.lt_u
              br_if $B7
              local.get $l21
              i32.const 14
              i32.add
              local.tee $l18
              local.get $l19
              i32.gt_u
              br_if $B7
              local.get $l2
              i32.load8_u offset=20
              i32.const 8
              i32.shl
              i32.const 16128
              i32.and
              local.get $l2
              i32.const 21
              i32.add
              i32.load8_u
              i32.or
              br_if $B7
              local.get $l2
              i32.load offset=30 align=1
              local.set $l22
              local.get $l2
              i32.load offset=26 align=1
              local.set $l23
              block $B8
                block $B9
                  local.get $l2
                  i32.load8_u offset=23
                  local.tee $l24
                  i32.const 6
                  i32.ne
                  local.tee $l25
                  br_if $B9
                  local.get $l21
                  i32.const 39
                  i32.le_u
                  br_if $B7
                  local.get $l2
                  i32.load8_u offset=46
                  i32.const 240
                  i32.and
                  i32.const 80
                  i32.ne
                  br_if $B7
                  local.get $l2
                  i32.load8_u offset=36
                  i32.const 8
                  i32.shl
                  local.get $l2
                  i32.const 37
                  i32.add
                  i32.load8_u
                  i32.or
                  local.set $l26
                  local.get $l2
                  i32.load8_u offset=34
                  i32.const 8
                  i32.shl
                  local.get $l2
                  i32.const 35
                  i32.add
                  i32.load8_u
                  i32.or
                  local.set $l27
                  local.get $l2
                  i32.load offset=38 align=1
                  local.tee $l28
                  i32.const 16711935
                  i32.and
                  i32.const 8
                  i32.rotr
                  local.get $l28
                  i32.const 24
                  i32.rotr
                  i32.const 16711935
                  i32.and
                  i32.or
                  local.set $l29
                  local.get $l9
                  i32.const 1
                  i32.add
                  local.set $l9
                  i32.const 54
                  local.set $l30
                  br $B8
                end
                local.get $l24
                i32.const 17
                i32.ne
                br_if $B7
                local.get $l21
                i32.const 27
                i32.le_u
                br_if $B7
                local.get $l2
                i32.load16_u offset=38 align=1
                local.tee $l28
                i32.const 8
                i32.shl
                local.get $l28
                i32.const 8
                i32.shr_u
                i32.or
                i32.const 65535
                i32.and
                local.tee $l28
                i32.const 8
                i32.lt_u
                br_if $B7
                local.get $l28
                i32.const 20
                i32.add
                local.get $l21
                i32.ne
                br_if $B7
                local.get $l2
                i32.load8_u offset=36
                i32.const 8
                i32.shl
                local.get $l2
                i32.const 37
                i32.add
                i32.load8_u
                i32.or
                local.set $l26
                local.get $l2
                i32.load8_u offset=34
                i32.const 8
                i32.shl
                local.get $l2
                i32.const 35
                i32.add
                i32.load8_u
                i32.or
                local.set $l27
                local.get $l8
                i32.const 1
                i32.add
                local.set $l8
                i32.const 0
                local.set $l29
                i32.const 42
                local.set $l30
              end
              local.get $l2
              local.get $l30
              i32.add
              local.set $l31
              local.get $l18
              local.get $l30
              i32.sub
              local.set $l32
              local.get $l27
              local.get $l22
              i32.const 16711935
              i32.and
              i32.const 8
              i32.rotr
              local.get $l22
              i32.const 24
              i32.rotr
              i32.const 16711935
              i32.and
              i32.or
              local.tee $l33
              local.get $l23
              i32.const 16711935
              i32.and
              i32.const 8
              i32.rotr
              local.get $l23
              i32.const 24
              i32.rotr
              i32.const 16711935
              i32.and
              i32.or
              local.tee $l34
              local.get $l24
              i32.const -2128831035
              i32.xor
              i32.const 16777619
              i32.mul
              i32.xor
              i32.const 16777619
              i32.mul
              i32.xor
              i32.const 3
              i32.mul
              i32.xor
              i32.const 3
              i32.mul
              local.get $l26
              i32.xor
              i32.const 3
              i32.mul
              local.set $l22
              i32.const -1
              local.set $l23
              block $B10
                loop $L11
                  local.get $l22
                  i32.const 15
                  i32.and
                  local.tee $l28
                  i32.const 304
                  i32.mul
                  local.tee $l22
                  i32.const 331792
                  i32.add
                  local.set $l2
                  block $B12
                    local.get $l22
                    i32.load offset=331792
                    br_if $B12
                    local.get $l2
                    local.get $l29
                    i32.store offset=40
                    local.get $l2
                    local.get $l26
                    i32.store offset=20
                    local.get $l2
                    local.get $l27
                    i32.store offset=16
                    local.get $l2
                    local.get $l33
                    i32.store offset=12
                    local.get $l2
                    local.get $l34
                    i32.store offset=8
                    local.get $l2
                    local.get $l24
                    i32.store offset=4
                    local.get $l2
                    i32.const 1
                    i32.store
                    local.get $l17
                    i32.const 1
                    i32.add
                    local.set $l17
                    br $B10
                  end
                  block $B13
                    local.get $l2
                    i32.load offset=4
                    local.get $l24
                    i32.ne
                    br_if $B13
                    local.get $l2
                    i32.load offset=8
                    local.get $l34
                    i32.ne
                    br_if $B13
                    local.get $l2
                    i32.load offset=12
                    local.get $l33
                    i32.ne
                    br_if $B13
                    local.get $l2
                    i32.load offset=16
                    local.get $l27
                    i32.ne
                    br_if $B13
                    local.get $l2
                    i32.load offset=20
                    local.get $l26
                    i32.eq
                    br_if $B10
                  end
                  local.get $l28
                  i32.const 1
                  i32.add
                  local.set $l22
                  i32.const -8
                  local.set $l2
                  local.get $l23
                  i32.const -1
                  i32.add
                  local.tee $l23
                  i32.const -17
                  i32.ne
                  br_if $L11
                  br $B0
                end
              end
              local.get $l2
              local.get $l2
              i32.load offset=24
              local.tee $l24
              i32.const 1
              i32.add
              local.tee $l28
              i32.store offset=24
              local.get $l2
              local.get $l2
              i32.load offset=28
              local.tee $l34
              local.get $l32
              i32.add
              i32.store offset=28
              local.get $l5
              local.get $l23
              i32.sub
              local.set $l5
              block $B14
                local.get $l25
                br_if $B14
                block $B15
                  local.get $l28
                  i32.const 2
                  i32.lt_u
                  br_if $B15
                  local.get $l29
                  local.get $l2
                  i32.load offset=40
                  i32.eq
                  br_if $B15
                  local.get $l2
                  local.get $l34
                  i32.store offset=28
                  local.get $l2
                  local.get $l24
                  i32.store offset=24
                  br $B7
                end
                local.get $l2
                local.get $l29
                local.get $l32
                i32.add
                i32.store offset=40
                block $B16
                  local.get $l2
                  i32.load offset=44
                  local.get $l32
                  i32.add
                  local.tee $l23
                  i32.const 256
                  i32.le_u
                  br_if $B16
                  i32.const -4
                  local.set $l2
                  br $B0
                end
                block $B17
                  local.get $l18
                  local.get $l30
                  i32.eq
                  br_if $B17
                  local.get $l32
                  i32.const 3
                  i32.and
                  local.set $l23
                  i32.const 0
                  local.set $l18
                  block $B18
                    block $B19
                      local.get $l21
                      local.get $l30
                      i32.sub
                      i32.const 13
                      i32.add
                      i32.const 3
                      i32.lt_u
                      br_if $B19
                      local.get $l32
                      i32.const -4
                      i32.and
                      local.set $l28
                      local.get $l20
                      local.get $l30
                      i32.add
                      i32.const 65536
                      i32.add
                      local.set $l24
                      i32.const 0
                      local.set $l18
                      loop $L20
                        local.get $l2
                        local.get $l18
                        local.get $l2
                        i32.load offset=44
                        i32.add
                        i32.add
                        i32.const 48
                        i32.add
                        local.get $l24
                        local.get $l18
                        i32.add
                        local.tee $l21
                        i32.const 16
                        i32.add
                        i32.load8_u
                        i32.store8
                        local.get $l2
                        local.get $l18
                        local.get $l2
                        i32.load offset=44
                        i32.add
                        i32.add
                        i32.const 49
                        i32.add
                        local.get $l21
                        i32.const 17
                        i32.add
                        i32.load8_u
                        i32.store8
                        local.get $l2
                        local.get $l18
                        local.get $l2
                        i32.load offset=44
                        i32.add
                        i32.add
                        i32.const 50
                        i32.add
                        local.get $l21
                        i32.const 18
                        i32.add
                        i32.load8_u
                        i32.store8
                        local.get $l2
                        local.get $l18
                        local.get $l2
                        i32.load offset=44
                        i32.add
                        i32.add
                        i32.const 51
                        i32.add
                        local.get $l21
                        i32.const 19
                        i32.add
                        i32.load8_u
                        i32.store8
                        local.get $l28
                        local.get $l18
                        i32.const 4
                        i32.add
                        local.tee $l18
                        i32.ne
                        br_if $L20
                      end
                      local.get $l23
                      i32.eqz
                      br_if $B18
                    end
                    local.get $l20
                    local.get $l18
                    i32.add
                    local.get $l30
                    i32.add
                    i32.const 65552
                    i32.add
                    local.set $l20
                    local.get $l18
                    local.get $l22
                    i32.add
                    i32.const 331840
                    i32.add
                    local.set $l21
                    loop $L21
                      local.get $l21
                      local.get $l2
                      i32.load offset=44
                      i32.add
                      local.get $l20
                      i32.load8_u
                      i32.store8
                      local.get $l20
                      i32.const 1
                      i32.add
                      local.set $l20
                      local.get $l21
                      i32.const 1
                      i32.add
                      local.set $l21
                      local.get $l23
                      i32.const -1
                      i32.add
                      local.tee $l23
                      br_if $L21
                    end
                  end
                  local.get $l2
                  i32.load offset=44
                  local.get $l32
                  i32.add
                  local.set $l23
                end
                local.get $l2
                local.get $l23
                i32.store offset=44
                local.get $l6
                i32.const 1
                i32.add
                local.set $l6
                br $B6
              end
              block $B22
                local.get $l26
                i32.const 53
                i32.eq
                br_if $B22
                local.get $l27
                i32.const 53
                i32.ne
                br_if $B7
              end
              local.get $l31
              local.get $l32
              call $dns_valid
              i32.eqz
              br_if $B7
              local.get $l2
              i32.const 2
              i32.store offset=32
              local.get $l2
              local.get $l2
              i32.load offset=36
              i32.const 1
              i32.add
              i32.store offset=36
              local.get $l7
              i32.const 1
              i32.add
              local.set $l7
              br $B6
            end
            local.get $l13
            i32.const 1
            i32.add
            local.set $l13
          end
          local.get $l4
          local.get $l19
          i32.add
          local.set $l4
          local.get $l12
          i32.const 1
          i32.add
          local.set $l12
          local.get $l15
          local.get $p0
          i32.lt_u
          br_if $L3
        end
      end
      i32.const 0
      local.set $p0
      i32.const 0
      local.set $l23
      loop $L23
        block $B24
          local.get $p0
          i32.const 331792
          i32.add
          local.tee $l2
          i32.load
          i32.eqz
          br_if $B24
          block $B25
            local.get $p0
            i32.const 331796
            i32.add
            i32.load
            i32.const 6
            i32.ne
            br_if $B25
            block $B26
              local.get $p0
              i32.const 331836
              i32.add
              i32.load
              local.tee $l20
              i32.const 4
              i32.lt_u
              br_if $B26
              block $B27
                block $B28
                  local.get $p0
                  i32.const 331840
                  i32.add
                  i32.load8_u
                  local.tee $l19
                  i32.const 71
                  i32.ne
                  br_if $B28
                  local.get $p0
                  i32.const 331841
                  i32.add
                  i32.load8_u
                  i32.const 69
                  i32.ne
                  br_if $B28
                  local.get $p0
                  i32.const 331842
                  i32.add
                  i32.load8_u
                  i32.const 84
                  i32.ne
                  br_if $B28
                  local.get $p0
                  i32.const 331843
                  i32.add
                  i32.load8_u
                  i32.const 32
                  i32.eq
                  br_if $B27
                end
                local.get $l20
                i32.const 4
                i32.eq
                br_if $B26
                local.get $l19
                i32.const 72
                i32.ne
                br_if $B26
                local.get $p0
                i32.const 331841
                i32.add
                i32.load8_u
                i32.const 84
                i32.ne
                br_if $B26
                local.get $p0
                i32.const 331842
                i32.add
                i32.load8_u
                i32.const 84
                i32.ne
                br_if $B26
                local.get $p0
                i32.const 331843
                i32.add
                i32.load8_u
                i32.const 80
                i32.ne
                br_if $B26
                local.get $p0
                i32.const 331844
                i32.add
                i32.load8_u
                i32.const 47
                i32.ne
                br_if $B26
              end
              local.get $p0
              i32.const 331824
              i32.add
              i64.const 4294967297
              i64.store
              local.get $l23
              i32.const 1
              i32.add
              local.set $l23
              br $B25
            end
            local.get $l13
            i32.const 1
            i32.add
            local.set $l13
          end
          local.get $l1
          i32.const 288
          i32.add
          local.get $l3
          i32.const 304
          i32.mul
          i32.add
          local.get $l2
          i32.const 304
          memory.copy
          local.get $l3
          i32.const 1
          i32.add
          local.set $l3
        end
        local.get $p0
        i32.const 304
        i32.add
        local.tee $p0
        i32.const 4864
        i32.ne
        br_if $L23
      end
      block $B29
        local.get $l3
        i32.const 2
        i32.lt_u
        br_if $B29
        local.get $l1
        i32.const 288
        i32.add
        local.set $l18
        i32.const 1
        local.set $l21
        loop $L30
          local.get $l1
          i32.const 288
          i32.add
          local.get $l21
          i32.const 304
          i32.mul
          i32.add
          local.tee $p0
          i32.load offset=20
          local.set $l17
          local.get $p0
          i32.load offset=16
          local.set $l16
          local.get $p0
          i32.load offset=12
          local.set $l15
          local.get $p0
          i32.load offset=8
          local.set $l14
          local.get $p0
          i32.load offset=4
          local.set $l20
          local.get $p0
          i32.load
          local.set $l22
          local.get $l1
          i32.const 8
          i32.add
          local.get $p0
          i32.const 24
          i32.add
          i32.const 280
          memory.copy
          local.get $l18
          local.set $p0
          local.get $l21
          local.set $l2
          block $B31
            loop $L32
              block $B33
                block $B34
                  local.get $l20
                  local.get $p0
                  i32.const 4
                  i32.add
                  i32.load
                  local.tee $l19
                  i32.eq
                  br_if $B34
                  local.get $l20
                  local.get $l19
                  i32.lt_u
                  br_if $B33
                  br $B31
                end
                block $B35
                  local.get $l14
                  local.get $p0
                  i32.const 8
                  i32.add
                  i32.load
                  local.tee $l19
                  i32.ne
                  br_if $B35
                  block $B36
                    local.get $l15
                    local.get $p0
                    i32.const 12
                    i32.add
                    i32.load
                    local.tee $l19
                    i32.eq
                    br_if $B36
                    local.get $l15
                    local.get $l19
                    i32.lt_u
                    br_if $B33
                    br $B31
                  end
                  block $B37
                    local.get $l16
                    local.get $p0
                    i32.const 16
                    i32.add
                    i32.load
                    local.tee $l19
                    i32.eq
                    br_if $B37
                    local.get $l16
                    local.get $l19
                    i32.lt_u
                    br_if $B33
                    br $B31
                  end
                  local.get $l17
                  local.get $p0
                  i32.const 20
                  i32.add
                  i32.load
                  i32.lt_u
                  br_if $B33
                  br $B31
                end
                local.get $l14
                local.get $l19
                i32.ge_u
                br_if $B31
              end
              local.get $p0
              i32.const 304
              i32.add
              local.get $p0
              i32.const 304
              memory.copy
              local.get $p0
              i32.const -304
              i32.add
              local.set $p0
              local.get $l2
              i32.const -1
              i32.add
              local.tee $l2
              br_if $L32
            end
            i32.const 0
            local.set $l2
          end
          local.get $l1
          i32.const 288
          i32.add
          local.get $l2
          i32.const 304
          i32.mul
          i32.add
          local.tee $p0
          local.get $l17
          i32.store offset=20
          local.get $p0
          local.get $l16
          i32.store offset=16
          local.get $p0
          local.get $l15
          i32.store offset=12
          local.get $p0
          local.get $l14
          i32.store offset=8
          local.get $p0
          local.get $l20
          i32.store offset=4
          local.get $p0
          local.get $l22
          i32.store
          local.get $p0
          i32.const 24
          i32.add
          local.get $l1
          i32.const 8
          i32.add
          i32.const 280
          memory.copy
          local.get $l18
          i32.const 304
          i32.add
          local.set $l18
          local.get $l21
          i32.const 1
          i32.add
          local.tee $l21
          local.get $l3
          i32.ne
          br_if $L30
        end
      end
      i32.const 0
      local.get $l3
      i32.const 9
      i32.mul
      i32.const 16
      i32.add
      local.tee $l20
      i32.const 2
      i32.shl
      local.tee $p0
      i32.store offset=331776
      i32.const -6
      local.set $l2
      local.get $p0
      i32.const 4096
      i32.gt_u
      br_if $B0
      i32.const 0
      local.get $l20
      i32.store offset=327740
      i32.const 0
      local.get $l4
      i32.store offset=327736
      i32.const 0
      local.get $l5
      i32.store offset=327732
      i32.const 0
      local.get $l3
      i32.store offset=327728
      i32.const 0
      local.get $l13
      i32.store offset=327724
      i32.const 0
      local.get $l6
      i32.store offset=327720
      i32.const 0
      local.get $l23
      i32.store offset=327712
      i32.const 0
      local.get $l7
      i32.store offset=327708
      i32.const 0
      local.get $l8
      i32.store offset=327704
      i32.const 0
      local.get $l9
      i32.store offset=327700
      i32.const 0
      local.get $l10
      i32.store offset=327696
      i32.const 0
      local.get $l11
      i32.store offset=327692
      i32.const 0
      local.get $l12
      i32.store offset=327688
      i32.const 0
      i64.const 5641552208
      i64.store offset=327680
      i32.const 0
      i32.const 0
      i32.load offset=336656
      i32.store offset=327716
      block $B38
        local.get $l3
        i32.eqz
        br_if $B38
        i32.const 327680
        local.set $p0
        local.get $l1
        i32.const 288
        i32.add
        local.set $l2
        loop $L39
          local.get $p0
          i32.const 64
          i32.add
          local.get $l2
          i32.const 4
          i32.add
          i32.load
          i32.store
          local.get $p0
          i32.const 68
          i32.add
          local.get $l2
          i32.const 8
          i32.add
          i64.load
          i64.store align=4
          local.get $p0
          i32.const 76
          i32.add
          local.get $l2
          i32.const 16
          i32.add
          i64.load
          i64.store align=4
          local.get $p0
          i32.const 84
          i32.add
          local.get $l2
          i32.const 24
          i32.add
          i64.load
          i64.store align=4
          local.get $p0
          i32.const 92
          i32.add
          local.get $l2
          i32.const 32
          i32.add
          i64.load
          i64.store align=4
          local.get $l2
          i32.const 304
          i32.add
          local.set $l2
          local.get $p0
          i32.const 36
          i32.add
          local.set $p0
          local.get $l3
          i32.const -1
          i32.add
          local.tee $l3
          br_if $L39
        end
      end
      i32.const 0
      local.set $l2
    end
    local.get $l1
    i32.const 5152
    i32.add
    global.set $__stack_pointer
    local.get $l2)
  (func $dns_valid (type $t3) (param $p0 i32) (param $p1 i32) (result i32)
    (local $l2 i32) (local $l3 i32) (local $l4 i32) (local $l5 i32) (local $l6 i32) (local $l7 i32)
    i32.const 0
    local.set $l2
    block $B0
      local.get $p1
      i32.const 12
      i32.lt_u
      br_if $B0
      local.get $p0
      i32.load16_u offset=4 align=1
      local.tee $l3
      i32.const 8
      i32.shl
      local.get $l3
      i32.const 8
      i32.shr_u
      i32.or
      i32.const 65535
      i32.and
      i32.const 1
      i32.ne
      br_if $B0
      local.get $p0
      i32.load16_u offset=6 align=1
      local.tee $l3
      i32.const 8
      i32.shl
      local.get $l3
      i32.const 8
      i32.shr_u
      i32.or
      local.tee $l4
      i32.const 65535
      i32.and
      i32.const 1
      i32.gt_u
      br_if $B0
      i32.const 12
      local.set $l3
      i32.const 0
      local.set $l2
      i32.const 0
      local.set $l5
      loop $L1
        local.get $l3
        local.get $p1
        i32.ge_u
        br_if $B0
        local.get $l3
        i32.const 1
        i32.add
        local.set $l6
        block $B2
          local.get $p0
          local.get $l3
          i32.add
          i32.load8_u
          local.tee $l7
          i32.eqz
          br_if $B2
          local.get $l7
          i32.const 63
          i32.gt_u
          br_if $B0
          local.get $l6
          local.get $l7
          i32.add
          local.tee $l3
          local.get $p1
          i32.gt_u
          br_if $B0
          local.get $l5
          i32.const 15
          i32.gt_u
          local.set $l7
          local.get $l5
          i32.const 1
          i32.add
          local.set $l5
          local.get $l7
          i32.eqz
          br_if $L1
          br $B0
        end
      end
      local.get $l3
      i32.const 5
      i32.add
      local.tee $l7
      local.get $p1
      i32.gt_u
      br_if $B0
      local.get $p0
      local.get $l6
      i32.add
      local.tee $l6
      i32.load16_u align=1
      local.tee $l5
      i32.const 8
      i32.shl
      local.get $l5
      i32.const 8
      i32.shr_u
      i32.or
      i32.const 65535
      i32.and
      i32.const 1
      i32.ne
      br_if $B0
      local.get $l6
      i32.load16_u offset=2 align=1
      local.tee $l5
      i32.const 8
      i32.shl
      local.get $l5
      i32.const 8
      i32.shr_u
      i32.or
      i32.const 65535
      i32.and
      i32.const 1
      i32.ne
      br_if $B0
      block $B3
        local.get $l4
        i32.const 65535
        i32.and
        i32.const 1
        i32.ne
        br_if $B3
        local.get $l3
        i32.const 17
        i32.add
        local.get $p1
        i32.gt_u
        br_if $B0
        local.get $p0
        local.get $l7
        i32.add
        i32.load8_u
        local.tee $l7
        i32.const 192
        i32.and
        i32.const 192
        i32.ne
        br_if $B0
        local.get $l7
        i32.const 8
        i32.shl
        i32.const 16128
        i32.and
        local.get $l6
        i32.const 5
        i32.add
        i32.load8_u
        i32.or
        i32.const 12
        i32.ne
        br_if $B0
        local.get $l6
        i32.const 6
        i32.add
        i32.load16_u align=1
        local.tee $l7
        i32.const 8
        i32.shl
        local.get $l7
        i32.const 8
        i32.shr_u
        i32.or
        i32.const 65535
        i32.and
        i32.const 1
        i32.ne
        br_if $B0
        local.get $l3
        i32.const 21
        i32.add
        local.get $p1
        i32.ne
        br_if $B0
        local.get $l6
        i32.const 8
        i32.add
        i32.load16_u align=1
        local.tee $l3
        i32.const 8
        i32.shl
        local.get $l3
        i32.const 8
        i32.shr_u
        i32.or
        i32.const 65535
        i32.and
        i32.const 1
        i32.ne
        br_if $B0
        local.get $l6
        i32.const 14
        i32.add
        i32.load16_u align=1
        local.tee $l3
        i32.const 8
        i32.shl
        local.get $l3
        i32.const 8
        i32.shr_u
        i32.or
        i32.const 65535
        i32.and
        i32.const 4
        i32.ne
        br_if $B0
        i32.const 0
        i32.const 0
        i32.load offset=336656
        i32.const 1
        i32.add
        i32.store offset=336656
        i32.const 1
        return
      end
      local.get $l7
      local.get $p1
      i32.eq
      local.set $l2
    end
    local.get $l2)
  (table $__indirect_function_table 1 1 funcref)
  (memory $memory 16)
  (global $__stack_pointer (mut i32) (i32.const 65536))
  (global $__dso_handle i32 (i32.const 65536))
  (global $__data_end i32 (i32.const 336660))
  (global $__stack_low i32 (i32.const 0))
  (global $__stack_high i32 (i32.const 65536))
  (global $__global_base i32 (i32.const 65536))
  (global $__heap_base i32 (i32.const 336672))
  (global $__heap_end i32 (i32.const 1048576))
  (global $__memory_base i32 (i32.const 0))
  (global $__table_base i32 (i32.const 1))
  (global $__wasm_first_page_end i32 (i32.const 65536))
  (export "memory" (memory $memory))
  (export "__wasm_call_ctors" (func $__wasm_call_ctors))
  (export "__stack_pointer" (global $__stack_pointer))
  (export "input_ptr" (func $input_ptr))
  (export "output_ptr" (func $output_ptr))
  (export "output_len" (func $output_len))
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
