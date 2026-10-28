;; serialization.protobuf-gateway.v1 — kernel: protobuf_gateway
;; WebAssembly Text (WAT) baseline implementation
;; Exports: protobuf_gateway

(module $protobuf_gateway_kernel_c.wasm
  (type $t0 (func))
  (type $t1 (func (param i32) (result i32)))
  (type $t2 (func (param i32 i32 i32 i32 i32) (result i32)))
  (type $t3 (func (param i32 i32 i32 i32) (result i32)))
  (func $__wasm_call_ctors (type $t0))
  (func $protobuf_gateway (type $t1) (param $p0 i32) (result i32)
    (local $l1 i32) (local $l2 i32) (local $l3 i32) (local $l4 i32) (local $l5 i32) (local $l6 i32) (local $l7 i32) (local $l8 i32) (local $l9 i32) (local $l10 i32) (local $l11 i32) (local $l12 i32) (local $l13 i32) (local $l14 i32) (local $l15 i32) (local $l16 i32) (local $l17 i32) (local $l18 i32) (local $l19 i32) (local $l20 i32) (local $l21 i32) (local $l22 i32) (local $l23 i32) (local $l24 i32) (local $l25 i32) (local $l26 i32) (local $l27 i32) (local $l28 i32) (local $l29 i32) (local $l30 i32) (local $l31 i32)
    global.get $__stack_pointer
    i32.const 48
    i32.sub
    local.tee $l1
    global.set $__stack_pointer
    block $B0
      block $B1
        local.get $p0
        i32.const 4
        i32.ge_u
        br_if $B1
        i32.const -1
        local.set $l2
        br $B0
      end
      block $B2
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
        i32.const 10000
        i32.eq
        br_if $B2
        i32.const -2
        local.set $l2
        br $B0
      end
      i32.const -2128831035
      local.set $l3
      i32.const -3
      local.set $l2
      i32.const 4
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
      block $B3
        loop $L4
          local.get $l4
          i32.const 4
          i32.add
          local.tee $l10
          local.get $p0
          i32.gt_u
          br_if $B0
          block $B5
            local.get $l4
            i32.const 3145728
            i32.add
            i32.load align=1
            local.get $l10
            i32.add
            local.tee $l4
            local.get $p0
            i32.le_u
            br_if $B5
            i32.const -4
            local.set $l2
            br $B0
          end
          local.get $l1
          local.get $l10
          i32.store offset=24
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
          i32.const 0
          local.set $l21
          i32.const 0
          local.set $l22
          i32.const 0
          local.set $l23
          i32.const 0
          local.set $l24
          block $B6
            local.get $l10
            local.get $l4
            i32.ge_u
            br_if $B6
            i32.const 0
            local.set $l11
            i32.const 0
            local.set $l12
            i32.const 0
            local.set $l13
            i32.const 0
            local.set $l14
            i32.const 0
            local.set $l17
            i32.const 0
            local.set $l18
            i32.const 0
            local.set $l19
            i32.const 0
            local.set $l20
            i32.const 0
            local.set $l21
            i32.const 0
            local.set $l16
            i32.const 0
            local.set $l15
            i32.const 0
            local.set $l24
            i32.const 0
            local.set $l23
            i32.const 0
            local.set $l22
            loop $L7
              local.get $l1
              i32.const 24
              i32.add
              local.get $l4
              local.get $l1
              i32.const 20
              i32.add
              local.get $l1
              i32.const 16
              i32.add
              local.get $l1
              i32.const 12
              i32.add
              call $read_varint
              local.get $l1
              i32.load offset=16
              i32.or
              br_if $B3
              local.get $l1
              i32.load offset=20
              local.tee $l25
              i32.const 3
              i32.shr_u
              local.tee $l10
              i32.eqz
              br_if $B3
              local.get $l25
              i32.const 7
              i32.and
              local.set $l25
              local.get $l1
              i32.load offset=12
              local.get $l22
              i32.add
              local.set $l22
              block $B8
                block $B9
                  local.get $l10
                  i32.const 1
                  i32.ne
                  br_if $B9
                  local.get $l25
                  br_if $B9
                  local.get $l1
                  i32.const 24
                  i32.add
                  local.get $l4
                  local.get $l1
                  i32.const 44
                  i32.add
                  local.get $l1
                  i32.const 40
                  i32.add
                  local.get $l1
                  i32.const 36
                  i32.add
                  call $read_varint
                  br_if $B3
                  local.get $l1
                  i32.load offset=36
                  local.get $l22
                  i32.add
                  local.set $l22
                  local.get $l1
                  i32.load offset=40
                  local.set $l20
                  local.get $l1
                  i32.load offset=44
                  local.set $l21
                  br $B8
                end
                block $B10
                  local.get $l10
                  i32.const 2
                  i32.ne
                  br_if $B10
                  local.get $l25
                  i32.const 2
                  i32.ne
                  br_if $B10
                  local.get $l1
                  i32.const 24
                  i32.add
                  local.get $l4
                  local.get $l1
                  i32.const 44
                  i32.add
                  local.get $l1
                  i32.const 40
                  i32.add
                  local.get $l1
                  i32.const 36
                  i32.add
                  call $read_varint
                  local.get $l1
                  i32.load offset=40
                  i32.or
                  br_if $B3
                  local.get $l1
                  i32.load offset=44
                  local.tee $l17
                  local.get $l4
                  local.get $l1
                  i32.load offset=24
                  local.tee $l10
                  i32.sub
                  i32.gt_u
                  br_if $B3
                  local.get $l1
                  local.get $l10
                  local.get $l17
                  i32.add
                  i32.store offset=24
                  local.get $l1
                  i32.load offset=36
                  local.get $l22
                  i32.add
                  local.set $l22
                  br $B8
                end
                block $B11
                  local.get $l10
                  i32.const 3
                  i32.ne
                  br_if $B11
                  local.get $l25
                  br_if $B11
                  local.get $l1
                  i32.const 24
                  i32.add
                  local.get $l4
                  local.get $l1
                  i32.const 44
                  i32.add
                  local.get $l1
                  i32.const 40
                  i32.add
                  local.get $l1
                  i32.const 36
                  i32.add
                  call $read_varint
                  br_if $B3
                  local.get $l1
                  i32.load offset=36
                  local.get $l22
                  i32.add
                  local.set $l22
                  local.get $l1
                  i32.load offset=44
                  local.get $l1
                  i32.load offset=40
                  i32.or
                  i32.const 0
                  i32.ne
                  local.set $l19
                  br $B8
                end
                block $B12
                  local.get $l10
                  i32.const 4
                  i32.ne
                  br_if $B12
                  local.get $l25
                  i32.const 1
                  i32.ne
                  br_if $B12
                  local.get $l4
                  local.get $l1
                  i32.load offset=24
                  local.tee $l10
                  i32.sub
                  i32.const 8
                  i32.lt_u
                  br_if $B3
                  local.get $l1
                  local.get $l10
                  i32.const 8
                  i32.add
                  i32.store offset=24
                  br $B8
                end
                block $B13
                  local.get $l10
                  i32.const 5
                  i32.ne
                  br_if $B13
                  local.get $l25
                  br_if $B13
                  local.get $l1
                  i32.const 24
                  i32.add
                  local.get $l4
                  local.get $l1
                  i32.const 44
                  i32.add
                  local.get $l1
                  i32.const 40
                  i32.add
                  local.get $l1
                  i32.const 36
                  i32.add
                  call $read_varint
                  br_if $B3
                  local.get $l1
                  i32.load offset=36
                  local.get $l22
                  i32.add
                  local.set $l22
                  local.get $l1
                  i32.load offset=44
                  local.set $l18
                  br $B8
                end
                block $B14
                  local.get $l10
                  i32.const 6
                  i32.ne
                  br_if $B14
                  local.get $l25
                  i32.const 2
                  i32.ne
                  br_if $B14
                  local.get $l1
                  i32.const 24
                  i32.add
                  local.get $l4
                  local.get $l1
                  i32.const 44
                  i32.add
                  local.get $l1
                  i32.const 40
                  i32.add
                  local.get $l1
                  i32.const 36
                  i32.add
                  call $read_varint
                  local.get $l1
                  i32.load offset=40
                  i32.or
                  br_if $B3
                  local.get $l1
                  i32.load offset=44
                  local.tee $l10
                  local.get $l4
                  local.get $l1
                  i32.load offset=24
                  local.tee $l25
                  i32.sub
                  i32.gt_u
                  br_if $B3
                  local.get $l1
                  local.get $l25
                  local.get $l10
                  i32.add
                  i32.store offset=24
                  local.get $l1
                  i32.load offset=36
                  local.get $l22
                  i32.add
                  local.set $l22
                  local.get $l16
                  i32.const 1
                  i32.add
                  local.set $l16
                  br $B8
                end
                block $B15
                  block $B16
                    local.get $l10
                    i32.const 7
                    i32.ne
                    br_if $B16
                    local.get $l25
                    i32.const 2
                    i32.ne
                    br_if $B16
                    local.get $l1
                    i32.const 24
                    i32.add
                    local.get $l4
                    local.get $l1
                    i32.const 8
                    i32.add
                    local.get $l1
                    i32.const 4
                    i32.add
                    local.get $l1
                    call $read_varint
                    local.get $l1
                    i32.load offset=4
                    i32.or
                    br_if $B3
                    local.get $l1
                    i32.load offset=8
                    local.tee $l25
                    local.get $l4
                    local.get $l1
                    i32.load offset=24
                    local.tee $l10
                    i32.sub
                    i32.gt_u
                    br_if $B3
                    local.get $l1
                    local.get $l10
                    i32.store offset=44
                    local.get $l10
                    local.get $l25
                    i32.add
                    local.set $l10
                    loop $L17
                      local.get $l1
                      i32.load offset=44
                      local.get $l10
                      i32.ge_u
                      br_if $B15
                      local.get $l1
                      i32.const 44
                      i32.add
                      local.get $l10
                      local.get $l1
                      i32.const 40
                      i32.add
                      local.get $l1
                      i32.const 36
                      i32.add
                      local.get $l1
                      i32.const 32
                      i32.add
                      call $read_varint
                      br_if $B3
                      local.get $l1
                      i32.const 44
                      i32.add
                      local.get $l10
                      local.get $l1
                      i32.load offset=40
                      i32.const 7
                      i32.and
                      local.get $l1
                      i32.const 28
                      i32.add
                      call $skip_field
                      i32.eqz
                      br_if $L17
                      br $B3
                    end
                  end
                  block $B18
                    local.get $l10
                    i32.const 8
                    i32.ne
                    br_if $B18
                    local.get $l25
                    i32.const 2
                    i32.ne
                    br_if $B18
                    local.get $l1
                    i32.const 24
                    i32.add
                    local.get $l4
                    local.get $l1
                    i32.const 44
                    i32.add
                    local.get $l1
                    i32.const 40
                    i32.add
                    local.get $l1
                    i32.const 36
                    i32.add
                    call $read_varint
                    local.get $l1
                    i32.load offset=40
                    i32.or
                    br_if $B3
                    local.get $l1
                    i32.load offset=44
                    local.tee $l14
                    local.get $l4
                    local.get $l1
                    i32.load offset=24
                    local.tee $l10
                    i32.sub
                    i32.gt_u
                    br_if $B3
                    local.get $l1
                    local.get $l10
                    local.get $l14
                    i32.add
                    i32.store offset=24
                    local.get $l1
                    i32.load offset=36
                    local.get $l22
                    i32.add
                    local.set $l22
                    br $B8
                  end
                  block $B19
                    local.get $l10
                    i32.const 9
                    i32.ne
                    br_if $B19
                    local.get $l25
                    i32.const 2
                    i32.ne
                    br_if $B19
                    local.get $l1
                    i32.const 24
                    i32.add
                    local.get $l4
                    local.get $l1
                    i32.const 44
                    i32.add
                    local.get $l1
                    i32.const 40
                    i32.add
                    local.get $l1
                    i32.const 36
                    i32.add
                    call $read_varint
                    local.get $l1
                    i32.load offset=40
                    i32.or
                    br_if $B3
                    local.get $l1
                    i32.load offset=44
                    local.tee $l12
                    local.get $l4
                    local.get $l1
                    i32.load offset=24
                    local.tee $l10
                    i32.sub
                    i32.gt_u
                    br_if $B3
                    local.get $l1
                    local.get $l10
                    local.get $l12
                    i32.add
                    i32.store offset=24
                    local.get $l1
                    i32.load offset=36
                    local.get $l22
                    i32.add
                    local.set $l22
                    i32.const 9
                    local.set $l13
                    br $B8
                  end
                  block $B20
                    local.get $l10
                    i32.const 10
                    i32.ne
                    br_if $B20
                    local.get $l25
                    br_if $B20
                    local.get $l1
                    i32.const 24
                    i32.add
                    local.get $l4
                    local.get $l1
                    i32.const 44
                    i32.add
                    local.get $l1
                    i32.const 40
                    i32.add
                    local.get $l1
                    i32.const 36
                    i32.add
                    call $read_varint
                    br_if $B3
                    local.get $l1
                    i32.load offset=36
                    local.get $l22
                    i32.add
                    local.set $l22
                    local.get $l1
                    i32.load offset=44
                    local.set $l11
                    i32.const 10
                    local.set $l13
                    br $B8
                  end
                  block $B21
                    local.get $l10
                    i32.const 11
                    i32.ne
                    br_if $B21
                    local.get $l25
                    i32.const 5
                    i32.ne
                    br_if $B21
                    local.get $l4
                    local.get $l1
                    i32.load offset=24
                    local.tee $l10
                    i32.sub
                    i32.const 4
                    i32.lt_u
                    br_if $B3
                    local.get $l1
                    local.get $l10
                    i32.const 4
                    i32.add
                    i32.store offset=24
                    br $B8
                  end
                  local.get $l1
                  i32.const 24
                  i32.add
                  local.get $l4
                  local.get $l25
                  local.get $l1
                  i32.const 44
                  i32.add
                  call $skip_field
                  br_if $B3
                  local.get $l23
                  i32.const 1
                  i32.add
                  local.set $l23
                  local.get $l1
                  i32.load offset=44
                  local.get $l22
                  i32.add
                  local.set $l22
                  br $B8
                end
                local.get $l1
                local.get $l10
                i32.store offset=24
                local.get $l1
                i32.load
                local.get $l22
                i32.add
                local.set $l22
                local.get $l15
                i32.const 1
                i32.add
                local.set $l15
              end
              local.get $l24
              i32.const 1
              i32.add
              local.set $l24
              local.get $l1
              i32.load offset=24
              local.tee $l10
              local.get $l4
              i32.lt_u
              br_if $L7
            end
          end
          local.get $l10
          local.get $l4
          i32.ne
          br_if $B3
          block $B22
            block $B23
              block $B24
                local.get $l19
                i32.eqz
                br_if $B24
                local.get $l18
                i32.const 3
                i32.ne
                br_if $B23
              end
              local.get $l20
              i32.const 24
              i32.shr_u
              local.set $l10
              local.get $l20
              i32.const 16
              i32.shr_u
              local.set $l25
              local.get $l20
              i32.const 8
              i32.shr_u
              local.set $l26
              local.get $l21
              i32.const 24
              i32.shr_u
              local.set $l27
              local.get $l21
              i32.const 16
              i32.shr_u
              local.set $l28
              local.get $l21
              i32.const 8
              i32.shr_u
              local.set $l29
              i32.const 0
              local.set $l30
              br $B22
            end
            local.get $l6
            i32.const 0
            local.get $l20
            i32.const 30
            i32.shr_u
            local.tee $l10
            i32.const 1
            i32.shl
            local.get $l10
            i32.const 3
            i32.eq
            select
            local.get $l20
            i32.const 29
            i32.shr_u
            i32.const 1
            i32.and
            i32.or
            local.tee $l10
            i32.const 1
            i32.shl
            local.tee $l25
            i32.const -6
            i32.add
            local.get $l25
            local.get $l10
            i32.const 2
            i32.gt_u
            select
            local.get $l20
            i32.const 28
            i32.shr_u
            i32.const 1
            i32.and
            i32.or
            local.tee $l10
            i32.const 1
            i32.shl
            local.tee $l25
            i32.const -6
            i32.add
            local.get $l25
            local.get $l10
            i32.const 2
            i32.gt_u
            select
            local.get $l20
            i32.const 27
            i32.shr_u
            i32.const 1
            i32.and
            i32.or
            local.tee $l10
            i32.const 1
            i32.shl
            local.tee $l25
            i32.const -6
            i32.add
            local.get $l25
            local.get $l10
            i32.const 2
            i32.gt_u
            select
            local.get $l20
            i32.const 26
            i32.shr_u
            i32.const 1
            i32.and
            i32.or
            local.tee $l10
            i32.const 1
            i32.shl
            local.tee $l25
            i32.const -6
            i32.add
            local.get $l25
            local.get $l10
            i32.const 2
            i32.gt_u
            select
            local.get $l20
            i32.const 25
            i32.shr_u
            i32.const 1
            i32.and
            i32.or
            local.tee $l10
            i32.const 1
            i32.shl
            local.tee $l25
            i32.const -6
            i32.add
            local.get $l25
            local.get $l10
            i32.const 2
            i32.gt_u
            select
            local.get $l20
            i32.const 24
            i32.shr_u
            local.tee $l10
            i32.const 1
            i32.and
            i32.or
            local.tee $l25
            i32.const 1
            i32.shl
            local.tee $l26
            i32.const -6
            i32.add
            local.get $l26
            local.get $l25
            i32.const 2
            i32.gt_u
            select
            local.get $l20
            i32.const 23
            i32.shr_u
            i32.const 1
            i32.and
            i32.or
            local.tee $l25
            i32.const 1
            i32.shl
            local.tee $l26
            i32.const -6
            i32.add
            local.get $l26
            local.get $l25
            i32.const 2
            i32.gt_u
            select
            local.get $l20
            i32.const 22
            i32.shr_u
            i32.const 1
            i32.and
            i32.or
            local.tee $l25
            i32.const 1
            i32.shl
            local.tee $l26
            i32.const -6
            i32.add
            local.get $l26
            local.get $l25
            i32.const 2
            i32.gt_u
            select
            local.get $l20
            i32.const 21
            i32.shr_u
            i32.const 1
            i32.and
            i32.or
            local.tee $l25
            i32.const 1
            i32.shl
            local.tee $l26
            i32.const -6
            i32.add
            local.get $l26
            local.get $l25
            i32.const 2
            i32.gt_u
            select
            local.get $l20
            i32.const 20
            i32.shr_u
            i32.const 1
            i32.and
            i32.or
            local.tee $l25
            i32.const 1
            i32.shl
            local.tee $l26
            i32.const -6
            i32.add
            local.get $l26
            local.get $l25
            i32.const 2
            i32.gt_u
            select
            local.get $l20
            i32.const 19
            i32.shr_u
            i32.const 1
            i32.and
            i32.or
            local.tee $l25
            i32.const 1
            i32.shl
            local.tee $l26
            i32.const -6
            i32.add
            local.get $l26
            local.get $l25
            i32.const 2
            i32.gt_u
            select
            local.get $l20
            i32.const 18
            i32.shr_u
            i32.const 1
            i32.and
            i32.or
            local.tee $l25
            i32.const 1
            i32.shl
            local.tee $l26
            i32.const -6
            i32.add
            local.get $l26
            local.get $l25
            i32.const 2
            i32.gt_u
            select
            local.get $l20
            i32.const 17
            i32.shr_u
            i32.const 1
            i32.and
            i32.or
            local.tee $l25
            i32.const 1
            i32.shl
            local.tee $l26
            i32.const -6
            i32.add
            local.get $l26
            local.get $l25
            i32.const 2
            i32.gt_u
            select
            local.get $l20
            i32.const 16
            i32.shr_u
            local.tee $l25
            i32.const 1
            i32.and
            i32.or
            local.tee $l26
            i32.const 1
            i32.shl
            local.tee $l27
            i32.const -6
            i32.add
            local.get $l27
            local.get $l26
            i32.const 2
            i32.gt_u
            select
            local.get $l20
            i32.const 15
            i32.shr_u
            i32.const 1
            i32.and
            i32.or
            local.tee $l26
            i32.const 1
            i32.shl
            local.tee $l27
            i32.const -6
            i32.add
            local.get $l27
            local.get $l26
            i32.const 2
            i32.gt_u
            select
            local.get $l20
            i32.const 14
            i32.shr_u
            i32.const 1
            i32.and
            i32.or
            local.tee $l26
            i32.const 1
            i32.shl
            local.tee $l27
            i32.const -6
            i32.add
            local.get $l27
            local.get $l26
            i32.const 2
            i32.gt_u
            select
            local.get $l20
            i32.const 13
            i32.shr_u
            i32.const 1
            i32.and
            i32.or
            local.tee $l26
            i32.const 1
            i32.shl
            local.tee $l27
            i32.const -6
            i32.add
            local.get $l27
            local.get $l26
            i32.const 2
            i32.gt_u
            select
            local.get $l20
            i32.const 12
            i32.shr_u
            i32.const 1
            i32.and
            i32.or
            local.tee $l26
            i32.const 1
            i32.shl
            local.tee $l27
            i32.const -6
            i32.add
            local.get $l27
            local.get $l26
            i32.const 2
            i32.gt_u
            select
            local.get $l20
            i32.const 11
            i32.shr_u
            i32.const 1
            i32.and
            i32.or
            local.tee $l26
            i32.const 1
            i32.shl
            local.tee $l27
            i32.const -6
            i32.add
            local.get $l27
            local.get $l26
            i32.const 2
            i32.gt_u
            select
            local.get $l20
            i32.const 10
            i32.shr_u
            i32.const 1
            i32.and
            i32.or
            local.tee $l26
            i32.const 1
            i32.shl
            local.tee $l27
            i32.const -6
            i32.add
            local.get $l27
            local.get $l26
            i32.const 2
            i32.gt_u
            select
            local.get $l20
            i32.const 9
            i32.shr_u
            i32.const 1
            i32.and
            i32.or
            local.tee $l26
            i32.const 1
            i32.shl
            local.tee $l27
            i32.const -6
            i32.add
            local.get $l27
            local.get $l26
            i32.const 2
            i32.gt_u
            select
            local.get $l20
            i32.const 8
            i32.shr_u
            local.tee $l26
            i32.const 1
            i32.and
            i32.or
            local.tee $l27
            i32.const 1
            i32.shl
            local.tee $l28
            i32.const -6
            i32.add
            local.get $l28
            local.get $l27
            i32.const 2
            i32.gt_u
            select
            local.get $l20
            i32.const 7
            i32.shr_u
            i32.const 1
            i32.and
            i32.or
            local.tee $l27
            i32.const 1
            i32.shl
            local.tee $l28
            i32.const -6
            i32.add
            local.get $l28
            local.get $l27
            i32.const 2
            i32.gt_u
            select
            local.get $l20
            i32.const 6
            i32.shr_u
            i32.const 1
            i32.and
            i32.or
            local.tee $l27
            i32.const 1
            i32.shl
            local.tee $l28
            i32.const -6
            i32.add
            local.get $l28
            local.get $l27
            i32.const 2
            i32.gt_u
            select
            local.get $l20
            i32.const 5
            i32.shr_u
            i32.const 1
            i32.and
            i32.or
            local.tee $l27
            i32.const 1
            i32.shl
            local.tee $l28
            i32.const -6
            i32.add
            local.get $l28
            local.get $l27
            i32.const 2
            i32.gt_u
            select
            local.get $l20
            i32.const 4
            i32.shr_u
            i32.const 1
            i32.and
            i32.or
            local.tee $l27
            i32.const 1
            i32.shl
            local.tee $l28
            i32.const -6
            i32.add
            local.get $l28
            local.get $l27
            i32.const 2
            i32.gt_u
            select
            local.get $l20
            i32.const 3
            i32.shr_u
            i32.const 1
            i32.and
            i32.or
            local.tee $l27
            i32.const 1
            i32.shl
            local.tee $l28
            i32.const -6
            i32.add
            local.get $l28
            local.get $l27
            i32.const 2
            i32.gt_u
            select
            local.get $l20
            i32.const 2
            i32.shr_u
            i32.const 1
            i32.and
            i32.or
            local.tee $l27
            i32.const 1
            i32.shl
            local.tee $l28
            i32.const -6
            i32.add
            local.get $l28
            local.get $l27
            i32.const 2
            i32.gt_u
            select
            local.get $l20
            i32.const 1
            i32.shr_u
            i32.const 1
            i32.and
            i32.or
            local.tee $l27
            i32.const 1
            i32.shl
            local.tee $l28
            i32.const -6
            i32.add
            local.get $l28
            local.get $l27
            i32.const 2
            i32.gt_u
            select
            local.get $l20
            i32.const 1
            i32.and
            i32.or
            local.tee $l27
            i32.const 1
            i32.shl
            local.tee $l28
            i32.const -6
            i32.add
            local.get $l28
            local.get $l27
            i32.const 2
            i32.gt_u
            select
            local.get $l21
            i32.const 31
            i32.shr_u
            i32.or
            local.tee $l27
            i32.const 1
            i32.shl
            local.tee $l28
            i32.const -6
            i32.add
            local.get $l28
            local.get $l27
            i32.const 2
            i32.gt_u
            select
            local.get $l21
            i32.const 30
            i32.shr_u
            i32.const 1
            i32.and
            i32.or
            local.tee $l27
            i32.const 1
            i32.shl
            local.tee $l28
            i32.const -6
            i32.add
            local.get $l28
            local.get $l27
            i32.const 2
            i32.gt_u
            select
            local.get $l21
            i32.const 29
            i32.shr_u
            i32.const 1
            i32.and
            i32.or
            local.tee $l27
            i32.const 1
            i32.shl
            local.tee $l28
            i32.const -6
            i32.add
            local.get $l28
            local.get $l27
            i32.const 2
            i32.gt_u
            select
            local.get $l21
            i32.const 28
            i32.shr_u
            i32.const 1
            i32.and
            i32.or
            local.tee $l27
            i32.const 1
            i32.shl
            local.tee $l28
            i32.const -6
            i32.add
            local.get $l28
            local.get $l27
            i32.const 2
            i32.gt_u
            select
            local.get $l21
            i32.const 27
            i32.shr_u
            i32.const 1
            i32.and
            i32.or
            local.tee $l27
            i32.const 1
            i32.shl
            local.tee $l28
            i32.const -6
            i32.add
            local.get $l28
            local.get $l27
            i32.const 2
            i32.gt_u
            select
            local.get $l21
            i32.const 26
            i32.shr_u
            i32.const 1
            i32.and
            i32.or
            local.tee $l27
            i32.const 1
            i32.shl
            local.tee $l28
            i32.const -6
            i32.add
            local.get $l28
            local.get $l27
            i32.const 2
            i32.gt_u
            select
            local.get $l21
            i32.const 25
            i32.shr_u
            i32.const 1
            i32.and
            i32.or
            local.tee $l27
            i32.const 1
            i32.shl
            local.tee $l28
            i32.const -6
            i32.add
            local.get $l28
            local.get $l27
            i32.const 2
            i32.gt_u
            select
            local.get $l21
            i32.const 24
            i32.shr_u
            local.tee $l27
            i32.const 1
            i32.and
            i32.or
            local.tee $l28
            i32.const 1
            i32.shl
            local.tee $l29
            i32.const -6
            i32.add
            local.get $l29
            local.get $l28
            i32.const 2
            i32.gt_u
            select
            local.get $l21
            i32.const 23
            i32.shr_u
            i32.const 1
            i32.and
            i32.or
            local.tee $l28
            i32.const 1
            i32.shl
            local.tee $l29
            i32.const -6
            i32.add
            local.get $l29
            local.get $l28
            i32.const 2
            i32.gt_u
            select
            local.get $l21
            i32.const 22
            i32.shr_u
            i32.const 1
            i32.and
            i32.or
            local.tee $l28
            i32.const 1
            i32.shl
            local.tee $l29
            i32.const -6
            i32.add
            local.get $l29
            local.get $l28
            i32.const 2
            i32.gt_u
            select
            local.get $l21
            i32.const 21
            i32.shr_u
            i32.const 1
            i32.and
            i32.or
            local.tee $l28
            i32.const 1
            i32.shl
            local.tee $l29
            i32.const -6
            i32.add
            local.get $l29
            local.get $l28
            i32.const 2
            i32.gt_u
            select
            local.get $l21
            i32.const 20
            i32.shr_u
            i32.const 1
            i32.and
            i32.or
            local.tee $l28
            i32.const 1
            i32.shl
            local.tee $l29
            i32.const -6
            i32.add
            local.get $l29
            local.get $l28
            i32.const 2
            i32.gt_u
            select
            local.get $l21
            i32.const 19
            i32.shr_u
            i32.const 1
            i32.and
            i32.or
            local.tee $l28
            i32.const 1
            i32.shl
            local.tee $l29
            i32.const -6
            i32.add
            local.get $l29
            local.get $l28
            i32.const 2
            i32.gt_u
            select
            local.get $l21
            i32.const 18
            i32.shr_u
            i32.const 1
            i32.and
            i32.or
            local.tee $l28
            i32.const 1
            i32.shl
            local.tee $l29
            i32.const -6
            i32.add
            local.get $l29
            local.get $l28
            i32.const 2
            i32.gt_u
            select
            local.get $l21
            i32.const 17
            i32.shr_u
            i32.const 1
            i32.and
            i32.or
            local.tee $l28
            i32.const 1
            i32.shl
            local.tee $l29
            i32.const -6
            i32.add
            local.get $l29
            local.get $l28
            i32.const 2
            i32.gt_u
            select
            local.get $l21
            i32.const 16
            i32.shr_u
            local.tee $l28
            i32.const 1
            i32.and
            i32.or
            local.tee $l29
            i32.const 1
            i32.shl
            local.tee $l30
            i32.const -6
            i32.add
            local.get $l30
            local.get $l29
            i32.const 2
            i32.gt_u
            select
            local.get $l21
            i32.const 15
            i32.shr_u
            i32.const 1
            i32.and
            i32.or
            local.tee $l29
            i32.const 1
            i32.shl
            local.tee $l30
            i32.const -6
            i32.add
            local.get $l30
            local.get $l29
            i32.const 2
            i32.gt_u
            select
            local.get $l21
            i32.const 14
            i32.shr_u
            i32.const 1
            i32.and
            i32.or
            local.tee $l29
            i32.const 1
            i32.shl
            local.tee $l30
            i32.const -6
            i32.add
            local.get $l30
            local.get $l29
            i32.const 2
            i32.gt_u
            select
            local.get $l21
            i32.const 13
            i32.shr_u
            i32.const 1
            i32.and
            i32.or
            local.tee $l29
            i32.const 1
            i32.shl
            local.tee $l30
            i32.const -6
            i32.add
            local.get $l30
            local.get $l29
            i32.const 2
            i32.gt_u
            select
            local.get $l21
            i32.const 12
            i32.shr_u
            i32.const 1
            i32.and
            i32.or
            local.tee $l29
            i32.const 1
            i32.shl
            local.tee $l30
            i32.const -6
            i32.add
            local.get $l30
            local.get $l29
            i32.const 2
            i32.gt_u
            select
            local.get $l21
            i32.const 11
            i32.shr_u
            i32.const 1
            i32.and
            i32.or
            local.tee $l29
            i32.const 1
            i32.shl
            local.tee $l30
            i32.const -6
            i32.add
            local.get $l30
            local.get $l29
            i32.const 2
            i32.gt_u
            select
            local.get $l21
            i32.const 10
            i32.shr_u
            i32.const 1
            i32.and
            i32.or
            local.tee $l29
            i32.const 1
            i32.shl
            local.tee $l30
            i32.const -6
            i32.add
            local.get $l30
            local.get $l29
            i32.const 2
            i32.gt_u
            select
            local.get $l21
            i32.const 9
            i32.shr_u
            i32.const 1
            i32.and
            i32.or
            local.tee $l29
            i32.const 1
            i32.shl
            local.tee $l30
            i32.const -6
            i32.add
            local.get $l30
            local.get $l29
            i32.const 2
            i32.gt_u
            select
            local.get $l21
            i32.const 8
            i32.shr_u
            local.tee $l29
            i32.const 1
            i32.and
            i32.or
            local.tee $l30
            i32.const 1
            i32.shl
            local.tee $l31
            i32.const -6
            i32.add
            local.get $l31
            local.get $l30
            i32.const 2
            i32.gt_u
            select
            local.get $l21
            i32.const 7
            i32.shr_u
            i32.const 1
            i32.and
            i32.or
            local.tee $l30
            i32.const 1
            i32.shl
            local.tee $l31
            i32.const -6
            i32.add
            local.get $l31
            local.get $l30
            i32.const 2
            i32.gt_u
            select
            local.get $l21
            i32.const 6
            i32.shr_u
            i32.const 1
            i32.and
            i32.or
            local.tee $l30
            i32.const 1
            i32.shl
            local.tee $l31
            i32.const -6
            i32.add
            local.get $l31
            local.get $l30
            i32.const 2
            i32.gt_u
            select
            local.get $l21
            i32.const 5
            i32.shr_u
            i32.const 1
            i32.and
            i32.or
            local.tee $l30
            i32.const 1
            i32.shl
            local.tee $l31
            i32.const -6
            i32.add
            local.get $l31
            local.get $l30
            i32.const 2
            i32.gt_u
            select
            local.get $l21
            i32.const 4
            i32.shr_u
            i32.const 1
            i32.and
            i32.or
            local.tee $l30
            i32.const 1
            i32.shl
            local.tee $l31
            i32.const -6
            i32.add
            local.get $l31
            local.get $l30
            i32.const 2
            i32.gt_u
            select
            local.get $l21
            i32.const 3
            i32.shr_u
            i32.const 1
            i32.and
            i32.or
            local.tee $l30
            i32.const 1
            i32.shl
            local.tee $l31
            i32.const -6
            i32.add
            local.get $l31
            local.get $l30
            i32.const 2
            i32.gt_u
            select
            local.get $l21
            i32.const 2
            i32.shr_u
            i32.const 1
            i32.and
            i32.or
            local.tee $l30
            i32.const 1
            i32.shl
            local.tee $l31
            i32.const -6
            i32.add
            local.get $l31
            local.get $l30
            i32.const 2
            i32.gt_u
            select
            local.get $l21
            i32.const 1
            i32.shr_u
            i32.const 1
            i32.and
            i32.or
            local.tee $l30
            i32.const 1
            i32.shl
            local.tee $l31
            i32.const -6
            i32.add
            local.get $l31
            local.get $l30
            i32.const 2
            i32.gt_u
            select
            local.get $l21
            i32.const 1
            i32.and
            i32.or
            local.tee $l30
            i32.const -3
            i32.add
            local.get $l30
            local.get $l30
            i32.const 2
            i32.gt_u
            select
            i32.eqz
            local.tee $l30
            i32.add
            local.set $l6
          end
          local.get $l23
          local.get $l7
          i32.add
          local.set $l7
          local.get $l22
          local.get $l8
          i32.add
          local.set $l8
          local.get $l24
          local.get $l9
          i32.add
          local.set $l9
          local.get $l3
          local.get $l21
          i32.const 255
          i32.and
          i32.xor
          i32.const 16777619
          i32.mul
          local.get $l29
          i32.const 255
          i32.and
          i32.xor
          i32.const 16777619
          i32.mul
          local.get $l28
          i32.const 255
          i32.and
          i32.xor
          i32.const 16777619
          i32.mul
          local.get $l27
          i32.xor
          i32.const 16777619
          i32.mul
          local.get $l20
          i32.const 255
          i32.and
          i32.xor
          i32.const 16777619
          i32.mul
          local.get $l26
          i32.const 255
          i32.and
          i32.xor
          i32.const 16777619
          i32.mul
          local.get $l25
          i32.const 255
          i32.and
          i32.xor
          i32.const 16777619
          i32.mul
          local.get $l10
          i32.xor
          i32.const 16777619
          i32.mul
          local.get $l19
          i32.xor
          i32.const 1345077009
          i32.mul
          local.get $l18
          i32.const 255
          i32.and
          i32.xor
          i32.const 16777619
          i32.mul
          local.get $l18
          i32.const 8
          i32.shr_u
          i32.const 255
          i32.and
          i32.xor
          i32.const 16777619
          i32.mul
          local.get $l18
          i32.const 16
          i32.shr_u
          i32.const 255
          i32.and
          i32.xor
          i32.const 16777619
          i32.mul
          local.get $l18
          i32.const 24
          i32.shr_u
          i32.xor
          i32.const 16777619
          i32.mul
          local.get $l17
          i32.const 255
          i32.and
          i32.xor
          i32.const 16777619
          i32.mul
          local.get $l17
          i32.const 8
          i32.shr_u
          i32.const 255
          i32.and
          i32.xor
          i32.const 16777619
          i32.mul
          local.get $l17
          i32.const 16
          i32.shr_u
          i32.const 255
          i32.and
          i32.xor
          i32.const 16777619
          i32.mul
          local.get $l17
          i32.const 24
          i32.shr_u
          i32.xor
          i32.const 16777619
          i32.mul
          local.get $l16
          i32.const 255
          i32.and
          i32.xor
          i32.const 16777619
          i32.mul
          local.get $l16
          i32.const 8
          i32.shr_u
          i32.const 255
          i32.and
          i32.xor
          i32.const 16777619
          i32.mul
          local.get $l16
          i32.const 16
          i32.shr_u
          i32.const 255
          i32.and
          i32.xor
          i32.const 16777619
          i32.mul
          local.get $l16
          i32.const 24
          i32.shr_u
          i32.xor
          i32.const 16777619
          i32.mul
          local.get $l15
          i32.const 255
          i32.and
          i32.xor
          i32.const 16777619
          i32.mul
          local.get $l15
          i32.const 8
          i32.shr_u
          i32.const 255
          i32.and
          i32.xor
          i32.const 16777619
          i32.mul
          local.get $l15
          i32.const 16
          i32.shr_u
          i32.const 255
          i32.and
          i32.xor
          i32.const 16777619
          i32.mul
          local.get $l15
          i32.const 24
          i32.shr_u
          i32.xor
          i32.const 16777619
          i32.mul
          local.get $l14
          i32.const 255
          i32.and
          i32.xor
          i32.const 16777619
          i32.mul
          local.get $l14
          i32.const 8
          i32.shr_u
          i32.const 255
          i32.and
          i32.xor
          i32.const 16777619
          i32.mul
          local.get $l14
          i32.const 16
          i32.shr_u
          i32.const 255
          i32.and
          i32.xor
          i32.const 16777619
          i32.mul
          local.get $l14
          i32.const 24
          i32.shr_u
          i32.xor
          i32.const 16777619
          i32.mul
          local.get $l13
          i32.xor
          i32.const 1345077009
          i32.mul
          local.get $l12
          i32.const 255
          i32.and
          i32.xor
          i32.const 16777619
          i32.mul
          local.get $l12
          i32.const 8
          i32.shr_u
          i32.const 255
          i32.and
          i32.xor
          i32.const 16777619
          i32.mul
          local.get $l12
          i32.const 16
          i32.shr_u
          i32.const 255
          i32.and
          i32.xor
          i32.const 16777619
          i32.mul
          local.get $l12
          i32.const 24
          i32.shr_u
          i32.xor
          i32.const 16777619
          i32.mul
          local.get $l11
          i32.const 255
          i32.and
          i32.xor
          i32.const 16777619
          i32.mul
          local.get $l11
          i32.const 8
          i32.shr_u
          i32.const 255
          i32.and
          i32.xor
          i32.const 16777619
          i32.mul
          local.get $l11
          i32.const 16
          i32.shr_u
          i32.const 255
          i32.and
          i32.xor
          i32.const 16777619
          i32.mul
          local.get $l11
          i32.const 24
          i32.shr_u
          i32.xor
          i32.const 16777619
          i32.mul
          local.get $l30
          i32.xor
          i32.const 1345077009
          i32.mul
          local.set $l3
          local.get $l5
          i32.const 1
          i32.add
          local.tee $l5
          i32.const 10000
          i32.ne
          br_if $L4
        end
        block $B25
          local.get $l4
          local.get $p0
          i32.eq
          br_if $B25
          i32.const -6
          local.set $l2
          br $B0
        end
        i32.const 0
        local.set $l2
        i32.const 0
        i32.const 10000
        i32.store offset=6291456
        i32.const 0
        local.get $l9
        i32.store offset=6291460
        i32.const 0
        local.get $l8
        i32.store offset=6291464
        i32.const 0
        local.get $l7
        i32.store offset=6291468
        i32.const 0
        local.get $l6
        i32.store offset=6291472
        i32.const 0
        local.get $p0
        i32.store offset=6291476
        i32.const 0
        local.get $l3
        i32.store offset=6291480
        i32.const 0
        i32.const 0
        i32.store offset=6291484
        br $B0
      end
      i32.const -5
      local.set $l2
    end
    local.get $l1
    i32.const 48
    i32.add
    global.set $__stack_pointer
    local.get $l2)
  (func $read_varint (type $t2) (param $p0 i32) (param $p1 i32) (param $p2 i32) (param $p3 i32) (param $p4 i32) (result i32)
    (local $l5 i32) (local $l6 i32) (local $l7 i32) (local $l8 i32) (local $l9 i64)
    i32.const -1
    local.set $l5
    block $B0
      block $B1
        local.get $p1
        local.get $p0
        i32.load
        local.tee $l6
        i32.le_u
        br_if $B1
        i32.const 1
        local.set $l7
        local.get $l6
        i32.load8_s offset=3145728
        local.set $l8
        local.get $p0
        local.get $l6
        i32.const 1
        i32.add
        i32.store
        local.get $l8
        i32.const 127
        i32.and
        i64.extend_i32_u
        local.set $l9
        local.get $l8
        i32.const 0
        i32.ge_s
        br_if $B0
        i32.const 0
        local.get $p1
        local.get $l6
        i32.sub
        local.tee $l8
        local.get $l8
        local.get $p1
        i32.gt_u
        select
        local.tee $l8
        i32.const 1
        i32.eq
        br_if $B1
        local.get $l6
        i32.const 3145729
        i32.add
        i32.load8_s
        local.set $p1
        i32.const 2
        local.set $l7
        local.get $p0
        local.get $l6
        i32.const 2
        i32.add
        i32.store
        local.get $p1
        i32.const 127
        i32.and
        i64.extend_i32_u
        i64.const 7
        i64.shl
        local.get $l9
        i64.or
        local.set $l9
        i32.const -1
        local.set $l5
        local.get $p1
        i32.const -1
        i32.gt_s
        br_if $B0
        local.get $l8
        i32.const 2
        i32.eq
        br_if $B1
        local.get $l6
        i32.const 3145730
        i32.add
        i32.load8_s
        local.set $p1
        i32.const 3
        local.set $l7
        local.get $p0
        local.get $l6
        i32.const 3
        i32.add
        i32.store
        local.get $p1
        i32.const 127
        i32.and
        i64.extend_i32_u
        i64.const 14
        i64.shl
        local.get $l9
        i64.or
        local.set $l9
        i32.const -1
        local.set $l5
        local.get $p1
        i32.const -1
        i32.gt_s
        br_if $B0
        local.get $l8
        i32.const 3
        i32.eq
        br_if $B1
        local.get $l6
        i32.const 3145731
        i32.add
        i32.load8_s
        local.set $p1
        i32.const 4
        local.set $l7
        local.get $p0
        local.get $l6
        i32.const 4
        i32.add
        i32.store
        local.get $p1
        i32.const 127
        i32.and
        i64.extend_i32_u
        i64.const 21
        i64.shl
        local.get $l9
        i64.or
        local.set $l9
        i32.const -1
        local.set $l5
        local.get $p1
        i32.const -1
        i32.gt_s
        br_if $B0
        local.get $l8
        i32.const 4
        i32.eq
        br_if $B1
        local.get $l6
        i32.const 3145732
        i32.add
        i32.load8_s
        local.set $p1
        i32.const 5
        local.set $l7
        local.get $p0
        local.get $l6
        i32.const 5
        i32.add
        i32.store
        local.get $p1
        i32.const 127
        i32.and
        i64.extend_i32_u
        i64.const 28
        i64.shl
        local.get $l9
        i64.or
        local.set $l9
        i32.const -1
        local.set $l5
        local.get $p1
        i32.const -1
        i32.gt_s
        br_if $B0
        local.get $l8
        i32.const 5
        i32.eq
        br_if $B1
        local.get $l6
        i32.const 3145733
        i32.add
        i32.load8_s
        local.set $p1
        i32.const 6
        local.set $l7
        local.get $p0
        local.get $l6
        i32.const 6
        i32.add
        i32.store
        local.get $p1
        i32.const 127
        i32.and
        i64.extend_i32_u
        i64.const 35
        i64.shl
        local.get $l9
        i64.or
        local.set $l9
        i32.const -1
        local.set $l5
        local.get $p1
        i32.const -1
        i32.gt_s
        br_if $B0
        local.get $l8
        i32.const 6
        i32.eq
        br_if $B1
        local.get $l6
        i32.const 3145734
        i32.add
        i32.load8_s
        local.set $p1
        i32.const 7
        local.set $l7
        local.get $p0
        local.get $l6
        i32.const 7
        i32.add
        i32.store
        local.get $p1
        i32.const 127
        i32.and
        i64.extend_i32_u
        i64.const 42
        i64.shl
        local.get $l9
        i64.or
        local.set $l9
        i32.const -1
        local.set $l5
        local.get $p1
        i32.const -1
        i32.gt_s
        br_if $B0
        local.get $l8
        i32.const 7
        i32.eq
        br_if $B1
        local.get $l6
        i32.const 3145735
        i32.add
        i32.load8_s
        local.set $p1
        i32.const 8
        local.set $l7
        local.get $p0
        local.get $l6
        i32.const 8
        i32.add
        i32.store
        local.get $p1
        i32.const 127
        i32.and
        i64.extend_i32_u
        i64.const 49
        i64.shl
        local.get $l9
        i64.or
        local.set $l9
        i32.const -1
        local.set $l5
        local.get $p1
        i32.const -1
        i32.gt_s
        br_if $B0
        local.get $l8
        i32.const 8
        i32.eq
        br_if $B1
        local.get $l6
        i32.const 3145736
        i32.add
        i32.load8_s
        local.set $p1
        i32.const 9
        local.set $l7
        local.get $p0
        local.get $l6
        i32.const 9
        i32.add
        i32.store
        local.get $p1
        i32.const 127
        i32.and
        i64.extend_i32_u
        i64.const 56
        i64.shl
        local.get $l9
        i64.or
        local.set $l9
        i32.const -1
        local.set $l5
        local.get $p1
        i32.const -1
        i32.gt_s
        br_if $B0
        local.get $l8
        i32.const 9
        i32.eq
        br_if $B1
        local.get $l6
        i32.const 3145737
        i32.add
        i32.load8_s
        local.set $p1
        i32.const 10
        local.set $l7
        local.get $p0
        local.get $l6
        i32.const 10
        i32.add
        i32.store
        block $B2
          local.get $p1
          i32.const -1
          i32.le_s
          br_if $B2
          local.get $p1
          i64.extend_i32_u
          i64.const 63
          i64.shl
          local.get $l9
          i64.or
          local.set $l9
          br $B0
        end
        i32.const -2
        local.set $l5
      end
      local.get $l5
      return
    end
    local.get $p2
    local.get $l9
    i64.store32
    local.get $p3
    local.get $l9
    i64.const 32
    i64.shr_u
    i64.store32
    local.get $p4
    local.get $l7
    i32.store
    i32.const 0)
  (func $skip_field (type $t3) (param $p0 i32) (param $p1 i32) (param $p2 i32) (param $p3 i32) (result i32)
    (local $l4 i32) (local $l5 i32) (local $l6 i32)
    global.get $__stack_pointer
    i32.const 16
    i32.sub
    local.tee $l4
    global.set $__stack_pointer
    local.get $p3
    i32.const 0
    i32.store
    i32.const -1
    local.set $l5
    block $B0
      block $B1
        block $B2
          block $B3
            block $B4
              block $B5
                local.get $p2
                br_table $B5 $B4 $B3 $B0 $B0 $B2 $B0
              end
              i32.const -1
              local.set $l5
              local.get $p0
              local.get $p1
              local.get $l4
              i32.const 12
              i32.add
              local.get $l4
              i32.const 8
              i32.add
              local.get $l4
              i32.const 4
              i32.add
              call $read_varint
              br_if $B0
              local.get $p3
              local.get $l4
              i32.load offset=4
              i32.store
              br $B1
            end
            local.get $p1
            local.get $p0
            i32.load
            local.tee $p3
            i32.lt_u
            br_if $B0
            local.get $p1
            local.get $p3
            i32.sub
            i32.const 8
            i32.lt_u
            br_if $B0
            local.get $p0
            local.get $p3
            i32.const 8
            i32.add
            i32.store
            br $B1
          end
          i32.const -1
          local.set $l5
          local.get $p0
          local.get $p1
          local.get $l4
          i32.const 12
          i32.add
          local.get $l4
          i32.const 8
          i32.add
          local.get $l4
          i32.const 4
          i32.add
          call $read_varint
          local.get $l4
          i32.load offset=8
          i32.or
          br_if $B0
          local.get $l4
          i32.load offset=12
          local.tee $p2
          local.get $p1
          local.get $p0
          i32.load
          local.tee $l6
          i32.sub
          i32.gt_u
          br_if $B0
          local.get $p0
          local.get $l6
          local.get $p2
          i32.add
          i32.store
          local.get $p3
          local.get $l4
          i32.load offset=4
          i32.store
          br $B1
        end
        local.get $p1
        local.get $p0
        i32.load
        local.tee $p3
        i32.lt_u
        br_if $B0
        local.get $p1
        local.get $p3
        i32.sub
        i32.const 4
        i32.lt_u
        br_if $B0
        local.get $p0
        local.get $p3
        i32.const 4
        i32.add
        i32.store
      end
      i32.const 0
      local.set $l5
    end
    local.get $l4
    i32.const 16
    i32.add
    global.set $__stack_pointer
    local.get $l5)
  (table $__indirect_function_table 1 1 funcref)
  (memory $memory 128)
  (global $__stack_pointer (mut i32) (i32.const 65536))
  (global $__dso_handle i32 (i32.const 65536))
  (global $__data_end i32 (i32.const 65536))
  (global $__stack_low i32 (i32.const 0))
  (global $__stack_high i32 (i32.const 65536))
  (global $__global_base i32 (i32.const 65536))
  (global $__heap_base i32 (i32.const 65536))
  (global $__heap_end i32 (i32.const 8388608))
  (global $__memory_base i32 (i32.const 0))
  (global $__table_base i32 (i32.const 1))
  (global $__wasm_first_page_end i32 (i32.const 65536))
  (export "memory" (memory $memory))
  (export "__wasm_call_ctors" (func $__wasm_call_ctors))
  (export "__stack_pointer" (global $__stack_pointer))
  (export "protobuf_gateway" (func $protobuf_gateway))
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
