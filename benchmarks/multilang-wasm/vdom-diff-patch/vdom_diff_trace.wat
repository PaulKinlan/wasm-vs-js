;; dom.vdom-diff-patch.v1 — kernel: vdom_diff_trace
;; WebAssembly Text (WAT) baseline implementation
;; Exports: vdom_diff_trace

(module $vdom_kernel_c.wasm
  (type $t0 (func))
  (type $t1 (func (result i32)))
  (type $t2 (func (param i32)))
  (func $__wasm_call_ctors (type $t0))
  (func $vdom_diff_trace (type $t1) (result i32)
    (local $l0 i32) (local $l1 i32) (local $l2 i64) (local $l3 i32) (local $l4 i32) (local $l5 i64) (local $l6 i32) (local $l7 i32) (local $l8 i32) (local $l9 i64) (local $l10 i32) (local $l11 i32) (local $l12 i32) (local $l13 i32) (local $l14 i32) (local $l15 i32) (local $l16 i32) (local $l17 i32)
    global.get $__stack_pointer
    i32.const 16
    i32.sub
    local.tee $l0
    global.set $__stack_pointer
    i32.const -1000
    local.set $l1
    loop $L0
      local.get $l1
      i32.const 67544
      i32.add
      i32.const 0
      i32.store8
      local.get $l1
      i32.const 66536
      i32.add
      i32.const 0
      i32.store16
      local.get $l1
      i32.const 68552
      i32.add
      i32.const 0
      i32.store8
      local.get $l1
      i32.const 67545
      i32.add
      i32.const 0
      i32.store8
      local.get $l1
      i32.const 68553
      i32.add
      i32.const 0
      i32.store8
      local.get $l1
      i32.const 66538
      i32.add
      i32.const 0
      i32.store8
      local.get $l1
      i32.const 67546
      i32.add
      i32.const 0
      i32.store8
      local.get $l1
      i32.const 68554
      i32.add
      i32.const 0
      i32.store8
      local.get $l1
      i32.const 66539
      i32.add
      i32.const 0
      i32.store8
      local.get $l1
      i32.const 67547
      i32.add
      i32.const 0
      i32.store8
      local.get $l1
      i32.const 68555
      i32.add
      i32.const 0
      i32.store8
      local.get $l1
      i32.const 4
      i32.add
      local.tee $l1
      br_if $L0
    end
    i32.const 0
    i32.const 65535
    i32.store16 offset=72576
    i32.const 0
    i32.const 1
    i32.store16 offset=76576
    i32.const 0
    i32.const 65535
    i32.store16 offset=78576
    i32.const 0
    i32.const 0
    i32.store16 offset=68560
    i32.const 0
    i32.const 0
    i32.store16 offset=74576
    i32.const 0
    i32.const 0
    i32.store16 offset=70560
    i64.const 3976273958
    local.set $l2
    i32.const 0
    local.set $l1
    i32.const 1
    local.set $l3
    loop $L1
      local.get $l3
      i32.const -1
      i32.add
      i32.extend16_s
      i32.const 3
      i32.div_s
      local.set $l4
      block $B2
        block $B3
          local.get $l3
          i32.const 334
          i32.lt_u
          br_if $B3
          local.get $l2
          i64.const -7046029254386353131
          i64.add
          local.tee $l2
          i64.const 30
          i64.shr_u
          local.get $l2
          i64.xor
          i64.const -4658895280553007687
          i64.mul
          local.tee $l5
          i64.const 27
          i64.shr_u
          local.get $l5
          i64.xor
          i64.const -7723592293110705685
          i64.mul
          local.tee $l5
          i64.const 31
          i64.shr_u
          local.get $l5
          i64.xor
          i32.wrap_i64
          i32.const 5
          i32.rem_u
          br_if $B3
          i32.const 65535
          local.set $l6
          i32.const 0
          local.set $l7
          br $B2
        end
        local.get $l2
        i64.const -7046029254386353131
        i64.add
        local.tee $l2
        i64.const 30
        i64.shr_u
        local.get $l2
        i64.xor
        i64.const -4658895280553007687
        i64.mul
        local.tee $l5
        i64.const 27
        i64.shr_u
        local.get $l5
        i64.xor
        i64.const -7723592293110705685
        i64.mul
        local.tee $l5
        i64.const 31
        i64.shr_u
        local.get $l5
        i64.xor
        i32.wrap_i64
        i32.const 7
        i32.rem_u
        local.set $l6
        i32.const 1
        local.set $l7
      end
      i32.const 65535
      local.set $l8
      block $B4
        local.get $l2
        i64.const -7046029254386353131
        i64.add
        local.tee $l5
        i64.const 30
        i64.shr_u
        local.get $l5
        i64.xor
        i64.const -4658895280553007687
        i64.mul
        local.tee $l9
        i64.const 27
        i64.shr_u
        local.get $l9
        i64.xor
        i64.const -7723592293110705685
        i64.mul
        local.tee $l9
        i64.const 31
        i64.shr_u
        local.get $l9
        i64.xor
        i32.wrap_i64
        i32.const 5
        i32.rem_u
        br_if $B4
        local.get $l2
        i64.const 4354685564936845354
        i64.add
        local.tee $l5
        i64.const 30
        i64.shr_u
        local.get $l5
        i64.xor
        i64.const -4658895280553007687
        i64.mul
        local.tee $l2
        i64.const 27
        i64.shr_u
        local.get $l2
        i64.xor
        i64.const -7723592293110705685
        i64.mul
        local.tee $l2
        i64.const 31
        i64.shr_u
        local.get $l2
        i64.xor
        i32.wrap_i64
        i32.const 900
        i32.rem_u
        i32.const 100
        i32.add
        local.set $l8
      end
      local.get $l4
      i32.extend16_s
      local.set $l4
      local.get $l5
      i64.const -7046029254386353131
      i64.add
      local.tee $l2
      i64.const 30
      i64.shr_u
      local.get $l2
      i64.xor
      i64.const -4658895280553007687
      i64.mul
      local.tee $l9
      i64.const 27
      i64.shr_u
      local.get $l9
      i64.xor
      i64.const -7723592293110705685
      i64.mul
      local.tee $l9
      i64.const 31
      i64.shr_u
      local.get $l9
      i64.xor
      local.set $l9
      block $B5
        block $B6
          local.get $l7
          i32.eqz
          br_if $B6
          local.get $l5
          i64.const 4354685564936845354
          i64.add
          local.tee $l2
          i64.const 30
          i64.shr_u
          local.get $l2
          i64.xor
          i64.const -4658895280553007687
          i64.mul
          local.tee $l5
          i64.const 27
          i64.shr_u
          local.get $l5
          i64.xor
          i64.const -7723592293110705685
          i64.mul
          local.tee $l5
          i64.const 31
          i64.shr_u
          local.get $l5
          i64.xor
          i32.wrap_i64
          i32.const 51
          i32.rem_u
          local.set $l7
          local.get $l9
          i32.wrap_i64
          i32.const 15
          i32.and
          local.set $l10
          i32.const 65535
          local.set $l11
          br $B5
        end
        local.get $l9
        i32.wrap_i64
        i32.const 101
        i32.rem_u
        local.set $l11
        i32.const 65535
        local.set $l7
        i32.const 65535
        local.set $l10
      end
      local.get $l1
      i32.const 70562
      i32.add
      i32.const 0
      i32.store16
      local.get $l1
      i32.const 72578
      i32.add
      local.get $l8
      i32.store16
      local.get $l1
      i32.const 68562
      i32.add
      local.get $l6
      i32.store16
      local.get $l1
      i32.const 74578
      i32.add
      local.get $l10
      i32.store16
      local.get $l1
      i32.const 76578
      i32.add
      local.get $l7
      i32.store16
      local.get $l1
      i32.const 78578
      i32.add
      local.get $l11
      i32.store16
      local.get $l4
      i32.const 1
      i32.shl
      i32.const 70560
      i32.add
      local.tee $l8
      local.get $l8
      i32.load16_u
      local.tee $l8
      i32.const 1
      i32.add
      i32.store16
      local.get $l4
      i32.const 6
      i32.mul
      local.get $l8
      i32.const 1
      i32.shl
      i32.add
      i32.const 80576
      i32.add
      local.get $l3
      i32.store16
      local.get $l3
      i32.const 1
      i32.add
      local.set $l3
      local.get $l1
      i32.const 2
      i32.add
      local.tee $l1
      i32.const 1998
      i32.ne
      br_if $L1
    end
    i32.const 0
    local.set $l3
    i32.const 70560
    local.set $l1
    i32.const 1
    local.set $l4
    loop $L7
      block $B8
        local.get $l1
        i32.load16_u
        i32.const 2
        i32.lt_u
        br_if $B8
        local.get $l3
        i32.const 1
        i32.shl
        i32.const 86576
        i32.add
        local.get $l4
        i32.const -1
        i32.add
        i32.store16
        local.get $l3
        i32.const 1
        i32.add
        local.set $l3
      end
      block $B9
        local.get $l1
        i32.const 2
        i32.add
        i32.load16_u
        i32.const 2
        i32.lt_u
        br_if $B9
        local.get $l3
        i32.const 1
        i32.shl
        i32.const 86576
        i32.add
        local.get $l4
        i32.store16
        local.get $l3
        i32.const 1
        i32.add
        local.set $l3
      end
      local.get $l1
      i32.const 4
      i32.add
      local.set $l1
      local.get $l4
      i32.const 2
      i32.add
      local.tee $l4
      i32.const 1001
      i32.ne
      br_if $L7
    end
    block $B10
      block $B11
        block $B12
          local.get $l3
          i32.const 2
          i32.lt_s
          br_if $B12
          local.get $l3
          i32.const 1
          i32.shl
          i32.const 86574
          i32.add
          local.set $l1
          local.get $l3
          local.set $l4
          loop $L13
            local.get $l1
            i32.load16_u
            local.set $l8
            local.get $l1
            local.get $l2
            i64.const -7046029254386353131
            i64.add
            local.tee $l2
            i64.const 30
            i64.shr_u
            local.get $l2
            i64.xor
            i64.const -4658895280553007687
            i64.mul
            local.tee $l5
            i64.const 27
            i64.shr_u
            local.get $l5
            i64.xor
            i64.const -7723592293110705685
            i64.mul
            local.tee $l5
            i64.const 31
            i64.shr_u
            local.get $l5
            i64.xor
            i32.wrap_i64
            local.get $l4
            i32.rem_u
            i32.const 1
            i32.shl
            local.tee $l6
            i32.load16_u offset=86576
            i32.store16
            local.get $l6
            local.get $l8
            i32.store16 offset=86576
            local.get $l1
            i32.const -2
            i32.add
            local.set $l1
            local.get $l4
            i32.const 2
            i32.gt_u
            local.set $l8
            local.get $l4
            i32.const -1
            i32.add
            local.set $l4
            local.get $l8
            br_if $L13
          end
          local.get $l3
          i32.const 100
          local.get $l3
          i32.const 100
          i32.lt_u
          select
          local.set $l1
          br $B11
        end
        i32.const 1
        local.set $l1
        local.get $l3
        i32.const 1
        i32.ne
        br_if $B10
      end
      local.get $l1
      i32.const 3
      i32.and
      local.set $l3
      i32.const 0
      local.set $l4
      block $B14
        local.get $l1
        i32.const -1
        i32.add
        i32.const 3
        i32.lt_u
        br_if $B14
        local.get $l1
        i32.const 124
        i32.and
        local.set $l8
        i32.const 0
        local.set $l4
        i32.const 86576
        local.set $l1
        loop $L15
          local.get $l1
          i32.load16_u
          i32.const 1
          i32.store8 offset=65536
          local.get $l1
          i32.const 2
          i32.add
          i32.load16_u
          i32.const 1
          i32.store8 offset=65536
          local.get $l1
          i32.const 4
          i32.add
          i32.load16_u
          i32.const 1
          i32.store8 offset=65536
          local.get $l1
          i32.const 6
          i32.add
          i32.load16_u
          i32.const 1
          i32.store8 offset=65536
          local.get $l1
          i32.const 8
          i32.add
          local.set $l1
          local.get $l8
          local.get $l4
          i32.const 4
          i32.add
          local.tee $l4
          i32.ne
          br_if $L15
        end
        local.get $l3
        i32.eqz
        br_if $B10
      end
      local.get $l4
      i32.const 1
      i32.shl
      i32.const 86576
      i32.add
      local.set $l1
      loop $L16
        local.get $l1
        i32.load16_u
        i32.const 1
        i32.store8 offset=65536
        local.get $l1
        i32.const 2
        i32.add
        local.set $l1
        local.get $l3
        i32.const -1
        i32.add
        local.tee $l3
        br_if $L16
      end
    end
    i32.const 0
    local.set $l3
    i32.const 68560
    local.set $l1
    i32.const 1
    local.set $l4
    loop $L17
      block $B18
        local.get $l1
        i32.load16_u
        i32.const 65535
        i32.eq
        br_if $B18
        local.get $l3
        i32.const 1
        i32.shl
        i32.const 86576
        i32.add
        local.get $l4
        i32.const -1
        i32.add
        i32.store16
        local.get $l3
        i32.const 1
        i32.add
        local.set $l3
      end
      block $B19
        local.get $l1
        i32.const 2
        i32.add
        i32.load16_u
        i32.const 65535
        i32.eq
        br_if $B19
        local.get $l3
        i32.const 1
        i32.shl
        i32.const 86576
        i32.add
        local.get $l4
        i32.store16
        local.get $l3
        i32.const 1
        i32.add
        local.set $l3
      end
      local.get $l1
      i32.const 4
      i32.add
      local.set $l1
      local.get $l4
      i32.const 2
      i32.add
      local.tee $l4
      i32.const 1001
      i32.ne
      br_if $L17
    end
    block $B20
      block $B21
        block $B22
          local.get $l3
          i32.const 2
          i32.lt_s
          br_if $B22
          local.get $l3
          i32.const 1
          i32.shl
          i32.const 86574
          i32.add
          local.set $l1
          local.get $l3
          local.set $l4
          loop $L23
            local.get $l1
            i32.load16_u
            local.set $l8
            local.get $l1
            local.get $l2
            i64.const -7046029254386353131
            i64.add
            local.tee $l2
            i64.const 30
            i64.shr_u
            local.get $l2
            i64.xor
            i64.const -4658895280553007687
            i64.mul
            local.tee $l5
            i64.const 27
            i64.shr_u
            local.get $l5
            i64.xor
            i64.const -7723592293110705685
            i64.mul
            local.tee $l5
            i64.const 31
            i64.shr_u
            local.get $l5
            i64.xor
            i32.wrap_i64
            local.get $l4
            i32.rem_u
            i32.const 1
            i32.shl
            local.tee $l6
            i32.load16_u offset=86576
            i32.store16
            local.get $l6
            local.get $l8
            i32.store16 offset=86576
            local.get $l1
            i32.const -2
            i32.add
            local.set $l1
            local.get $l4
            i32.const 2
            i32.gt_u
            local.set $l8
            local.get $l4
            i32.const -1
            i32.add
            local.set $l4
            local.get $l8
            br_if $L23
          end
          local.get $l3
          i32.const 100
          local.get $l3
          i32.const 100
          i32.lt_u
          select
          local.set $l1
          br $B21
        end
        i32.const 1
        local.set $l1
        local.get $l3
        i32.const 1
        i32.ne
        br_if $B20
      end
      local.get $l1
      i32.const 3
      i32.and
      local.set $l3
      i32.const 0
      local.set $l4
      block $B24
        local.get $l1
        i32.const -1
        i32.add
        i32.const 3
        i32.lt_u
        br_if $B24
        local.get $l1
        i32.const 124
        i32.and
        local.set $l8
        i32.const 0
        local.set $l4
        i32.const 86576
        local.set $l1
        loop $L25
          local.get $l1
          i32.load16_u
          i32.const 1
          i32.store8 offset=66544
          local.get $l1
          i32.const 2
          i32.add
          i32.load16_u
          i32.const 1
          i32.store8 offset=66544
          local.get $l1
          i32.const 4
          i32.add
          i32.load16_u
          i32.const 1
          i32.store8 offset=66544
          local.get $l1
          i32.const 6
          i32.add
          i32.load16_u
          i32.const 1
          i32.store8 offset=66544
          local.get $l1
          i32.const 8
          i32.add
          local.set $l1
          local.get $l8
          local.get $l4
          i32.const 4
          i32.add
          local.tee $l4
          i32.ne
          br_if $L25
        end
        local.get $l3
        i32.eqz
        br_if $B20
      end
      local.get $l4
      i32.const 1
      i32.shl
      i32.const 86576
      i32.add
      local.set $l1
      loop $L26
        local.get $l1
        i32.load16_u
        i32.const 1
        i32.store8 offset=66544
        local.get $l1
        i32.const 2
        i32.add
        local.set $l1
        local.get $l3
        i32.const -1
        i32.add
        local.tee $l3
        br_if $L26
      end
    end
    i32.const 0
    local.set $l4
    i32.const 68560
    local.set $l1
    i32.const 1
    local.set $l3
    loop $L27
      block $B28
        local.get $l1
        i32.load16_u
        i32.const 65535
        i32.ne
        br_if $B28
        local.get $l4
        i32.const 1
        i32.shl
        i32.const 86576
        i32.add
        local.get $l3
        i32.const -1
        i32.add
        i32.store16
        local.get $l4
        i32.const 1
        i32.add
        local.set $l4
      end
      block $B29
        local.get $l1
        i32.const 2
        i32.add
        i32.load16_u
        i32.const 65535
        i32.ne
        br_if $B29
        local.get $l4
        i32.const 1
        i32.shl
        i32.const 86576
        i32.add
        local.get $l3
        i32.store16
        local.get $l4
        i32.const 1
        i32.add
        local.set $l4
      end
      local.get $l1
      i32.const 4
      i32.add
      local.set $l1
      local.get $l3
      i32.const 2
      i32.add
      local.tee $l3
      i32.const 1001
      i32.ne
      br_if $L27
    end
    block $B30
      block $B31
        block $B32
          local.get $l4
          i32.const 2
          i32.lt_s
          br_if $B32
          local.get $l2
          i64.const -7046029254386353131
          i64.add
          local.set $l2
          local.get $l4
          i32.const 1
          i32.shl
          i32.const 86574
          i32.add
          local.set $l1
          local.get $l4
          local.set $l3
          loop $L33
            local.get $l1
            i32.load16_u
            local.set $l8
            local.get $l1
            local.get $l2
            i64.const 30
            i64.shr_u
            local.get $l2
            i64.xor
            i64.const -4658895280553007687
            i64.mul
            local.tee $l5
            i64.const 27
            i64.shr_u
            local.get $l5
            i64.xor
            i64.const -7723592293110705685
            i64.mul
            local.tee $l5
            i64.const 31
            i64.shr_u
            local.get $l5
            i64.xor
            i32.wrap_i64
            local.get $l3
            i32.rem_u
            i32.const 1
            i32.shl
            local.tee $l6
            i32.load16_u offset=86576
            i32.store16
            local.get $l6
            local.get $l8
            i32.store16 offset=86576
            local.get $l2
            i64.const -7046029254386353131
            i64.add
            local.set $l2
            local.get $l1
            i32.const -2
            i32.add
            local.set $l1
            local.get $l3
            i32.const 2
            i32.gt_u
            local.set $l8
            local.get $l3
            i32.const -1
            i32.add
            local.set $l3
            local.get $l8
            br_if $L33
          end
          local.get $l4
          i32.const 50
          local.get $l4
          i32.const 50
          i32.lt_u
          select
          local.set $l1
          br $B31
        end
        i32.const 1
        local.set $l1
        local.get $l4
        i32.const 1
        i32.ne
        br_if $B30
      end
      local.get $l1
      i32.const 3
      i32.and
      local.set $l3
      i32.const 0
      local.set $l4
      block $B34
        local.get $l1
        i32.const -1
        i32.add
        i32.const 3
        i32.lt_u
        br_if $B34
        local.get $l1
        i32.const 60
        i32.and
        local.set $l8
        i32.const 0
        local.set $l4
        i32.const 86576
        local.set $l1
        loop $L35
          local.get $l1
          i32.load16_u
          i32.const 1
          i32.store8 offset=67552
          local.get $l1
          i32.const 2
          i32.add
          i32.load16_u
          i32.const 1
          i32.store8 offset=67552
          local.get $l1
          i32.const 4
          i32.add
          i32.load16_u
          i32.const 1
          i32.store8 offset=67552
          local.get $l1
          i32.const 6
          i32.add
          i32.load16_u
          i32.const 1
          i32.store8 offset=67552
          local.get $l1
          i32.const 8
          i32.add
          local.set $l1
          local.get $l8
          local.get $l4
          i32.const 4
          i32.add
          local.tee $l4
          i32.ne
          br_if $L35
        end
        local.get $l3
        i32.eqz
        br_if $B30
      end
      local.get $l4
      i32.const 1
      i32.shl
      i32.const 86576
      i32.add
      local.set $l1
      loop $L36
        local.get $l1
        i32.load16_u
        i32.const 1
        i32.store8 offset=67552
        local.get $l1
        i32.const 2
        i32.add
        local.set $l1
        local.get $l3
        i32.const -1
        i32.add
        local.tee $l3
        br_if $L36
      end
    end
    i32.const 0
    local.set $l12
    i32.const -2000
    local.set $l3
    i32.const -1000
    local.set $l1
    i32.const 0
    local.set $l13
    i32.const 0
    local.set $l14
    loop $L37
      block $B38
        local.get $l1
        i32.const 68552
        i32.add
        i32.load8_u
        i32.eqz
        br_if $B38
        local.get $l12
        local.get $l3
        i32.const 70560
        i32.add
        i32.load16_u
        i32.const 65535
        i32.eq
        i32.add
        local.set $l12
      end
      block $B39
        local.get $l1
        i32.const 67544
        i32.add
        i32.load8_u
        i32.eqz
        br_if $B39
        local.get $l13
        local.get $l3
        i32.const 70560
        i32.add
        i32.load16_u
        i32.const 65535
        i32.ne
        i32.add
        local.set $l13
      end
      block $B40
        local.get $l1
        i32.const 66536
        i32.add
        i32.load8_u
        i32.eqz
        br_if $B40
        local.get $l14
        local.get $l3
        i32.const 72560
        i32.add
        i32.load16_u
        i32.const 1
        i32.gt_u
        i32.add
        local.set $l14
      end
      local.get $l1
      i32.const 1
      i32.add
      local.set $l1
      local.get $l3
      i32.const 2
      i32.add
      local.tee $l3
      br_if $L37
    end
    i32.const -2128831035
    local.set $l8
    i32.const 0
    i32.const -2128831035
    i32.store offset=72560
    i32.const 0
    call $mix_treeB_dfs
    i32.const 0
    i32.load offset=72560
    local.set $l15
    i32.const 0
    i32.const -2128831035
    i32.store offset=72560
    i32.const -2000
    local.set $l3
    i32.const 0
    local.set $l1
    loop $L41
      block $B42
        local.get $l1
        i32.const 67552
        i32.add
        i32.load8_u
        i32.eqz
        br_if $B42
        local.get $l3
        i32.const 70560
        i32.add
        i32.load16_u
        i32.const 65535
        i32.ne
        br_if $B42
        i32.const 0
        local.get $l3
        i32.const 80576
        i32.add
        i32.load16_s
        i32.const 31
        i32.add
        i32.const 100
        i32.rem_s
        local.tee $l4
        i32.const 255
        i32.and
        local.get $l8
        i32.const 1
        i32.xor
        i32.const 16777619
        i32.mul
        local.get $l1
        i32.const 255
        i32.and
        i32.xor
        i32.const 16777619
        i32.mul
        local.get $l1
        i32.const 8
        i32.shr_u
        i32.xor
        i32.const 16777619
        i32.mul
        i32.xor
        i32.const 16777619
        i32.mul
        local.get $l4
        i32.const 8
        i32.shr_u
        i32.const 255
        i32.and
        i32.xor
        i32.const 16777619
        i32.mul
        i32.const 255
        i32.xor
        i32.const 16777619
        i32.mul
        i32.const 255
        i32.xor
        i32.const 16777619
        i32.mul
        i32.const 255
        i32.xor
        i32.const 16777619
        i32.mul
        i32.const 255
        i32.xor
        i32.const 16777619
        i32.mul
        i32.const 255
        i32.xor
        i32.const 16777619
        i32.mul
        i32.const 255
        i32.xor
        i32.const 16777619
        i32.mul
        local.tee $l8
        i32.store offset=72560
      end
      local.get $l1
      i32.const 1
      i32.add
      local.set $l1
      local.get $l3
      i32.const 2
      i32.add
      local.tee $l3
      br_if $L41
    end
    i32.const 0
    local.set $l3
    i32.const 0
    local.set $l1
    loop $L43
      block $B44
        local.get $l1
        i32.const 66544
        i32.add
        i32.load8_u
        i32.eqz
        br_if $B44
        local.get $l3
        i32.const 68560
        i32.add
        i32.load16_u
        i32.const 65535
        i32.eq
        br_if $B44
        i32.const 0
        local.get $l8
        i32.const 2
        i32.xor
        i32.const 16777619
        i32.mul
        local.get $l1
        i32.const 255
        i32.and
        i32.xor
        i32.const 16777619
        i32.mul
        local.get $l1
        i32.const 8
        i32.shr_u
        i32.xor
        i32.const 16777619
        i32.mul
        i32.const 255
        i32.xor
        i32.const 16777619
        i32.mul
        i32.const 255
        i32.xor
        i32.const 16777619
        i32.mul
        local.get $l3
        i32.const 74576
        i32.add
        i32.load16_u
        local.tee $l4
        i32.const 255
        i32.and
        i32.xor
        i32.const 16777619
        i32.mul
        local.get $l4
        i32.const 8
        i32.shr_u
        i32.xor
        i32.const 16777619
        i32.mul
        local.get $l3
        i32.const 76576
        i32.add
        i32.load16_s
        i32.const 17
        i32.add
        i32.const 100
        i32.rem_s
        local.tee $l4
        i32.const 255
        i32.and
        i32.xor
        i32.const 16777619
        i32.mul
        local.get $l4
        i32.const 8
        i32.shr_u
        i32.const 255
        i32.and
        i32.xor
        i32.const 16777619
        i32.mul
        i32.const 255
        i32.xor
        i32.const 16777619
        i32.mul
        i32.const 255
        i32.xor
        i32.const 16777619
        i32.mul
        local.tee $l8
        i32.store offset=72560
      end
      local.get $l3
      i32.const 2
      i32.add
      local.set $l3
      local.get $l1
      i32.const 1
      i32.add
      local.tee $l1
      i32.const 1000
      i32.ne
      br_if $L43
    end
    i32.const 80576
    local.set $l6
    i32.const 0
    local.set $l10
    loop $L45
      block $B46
        local.get $l10
        i32.load8_u offset=65536
        i32.eqz
        br_if $B46
        local.get $l10
        i32.const 1
        i32.shl
        i32.load16_u offset=70560
        local.tee $l11
        i32.const 2
        i32.lt_u
        br_if $B46
        local.get $l11
        i32.const 3
        i32.and
        local.set $l3
        local.get $l11
        i32.const -1
        i32.add
        local.set $l16
        i32.const 0
        local.set $l7
        block $B47
          block $B48
            local.get $l11
            i32.const 4
            i32.lt_u
            br_if $B48
            local.get $l11
            i32.const 65532
            i32.and
            local.set $l7
            local.get $l11
            i32.const 1
            i32.shl
            i32.const 131064
            i32.and
            local.set $l4
            i32.const 0
            local.set $l1
            loop $L49
              local.get $l0
              i32.const 10
              i32.add
              local.get $l1
              i32.add
              local.get $l6
              local.get $l1
              i32.add
              i64.load align=2
              i64.store align=2
              local.get $l4
              local.get $l1
              i32.const 8
              i32.add
              local.tee $l1
              i32.ne
              br_if $L49
            end
            local.get $l3
            i32.eqz
            br_if $B47
          end
          local.get $l7
          i32.const 1
          i32.shl
          local.set $l1
          loop $L50
            local.get $l0
            i32.const 10
            i32.add
            local.get $l1
            i32.add
            local.get $l6
            local.get $l1
            i32.add
            i32.load16_u
            i32.store16
            local.get $l1
            i32.const 2
            i32.add
            local.set $l1
            local.get $l3
            i32.const -1
            i32.add
            local.tee $l3
            br_if $L50
          end
        end
        local.get $l16
        i32.const 3
        i32.and
        local.set $l3
        i32.const 0
        local.set $l4
        local.get $l0
        i32.load16_u offset=10
        local.set $l17
        block $B51
          block $B52
            local.get $l11
            i32.const -2
            i32.add
            i32.const 65535
            i32.and
            i32.const 3
            i32.lt_u
            br_if $B52
            local.get $l16
            i32.const -4
            i32.and
            local.set $l7
            i32.const 0
            local.set $l4
            local.get $l0
            i32.const 10
            i32.add
            local.set $l1
            loop $L53
              local.get $l1
              local.get $l1
              i32.const 2
              i32.add
              i64.load align=2
              i64.store align=2
              local.get $l1
              i32.const 8
              i32.add
              local.set $l1
              local.get $l7
              local.get $l4
              i32.const 4
              i32.add
              local.tee $l4
              i32.ne
              br_if $L53
            end
            local.get $l3
            i32.eqz
            br_if $B51
          end
          local.get $l0
          i32.const 10
          i32.add
          local.get $l4
          i32.const 1
          i32.shl
          i32.add
          local.set $l1
          loop $L54
            local.get $l1
            local.get $l1
            i32.const 2
            i32.add
            local.tee $l4
            i32.load16_u
            i32.store16
            local.get $l4
            local.set $l1
            local.get $l3
            i32.const -1
            i32.add
            local.tee $l3
            br_if $L54
          end
        end
        local.get $l0
        i32.const 10
        i32.add
        local.get $l11
        i32.const 1
        i32.shl
        i32.add
        i32.const -2
        i32.add
        local.get $l17
        i32.store16
        local.get $l8
        i32.const 6
        i32.xor
        i32.const 16777619
        i32.mul
        local.get $l10
        i32.const 255
        i32.and
        i32.xor
        i32.const 16777619
        i32.mul
        local.get $l10
        i32.const 8
        i32.shr_u
        i32.xor
        i32.const 16777619
        i32.mul
        local.get $l11
        i32.const 255
        i32.and
        local.tee $l1
        i32.xor
        i32.const 16777619
        i32.mul
        local.get $l11
        i32.const 8
        i32.shr_u
        local.tee $l3
        i32.xor
        i32.const 16777619
        i32.mul
        i32.const 255
        i32.xor
        i32.const 16777619
        i32.mul
        i32.const 255
        i32.xor
        i32.const 16777619
        i32.mul
        i32.const 255
        i32.xor
        i32.const 16777619
        i32.mul
        i32.const 255
        i32.xor
        i32.const 16777619
        i32.mul
        local.get $l1
        i32.xor
        i32.const 16777619
        i32.mul
        local.get $l3
        i32.xor
        i32.const 16777619
        i32.mul
        local.get $l1
        i32.xor
        i32.const 16777619
        i32.mul
        local.get $l3
        i32.xor
        i32.const 16777619
        i32.mul
        local.set $l8
        block $B55
          block $B56
            block $B57
              local.get $l16
              br_if $B57
              i32.const 0
              local.set $l3
              br $B56
            end
            local.get $l11
            i32.const 1
            i32.and
            local.set $l16
            local.get $l11
            i32.const 65534
            i32.and
            local.set $l7
            i32.const 0
            local.set $l3
            local.get $l0
            i32.const 10
            i32.add
            local.set $l1
            loop $L58
              local.get $l8
              local.get $l1
              i32.load16_u
              local.tee $l4
              i32.const 255
              i32.and
              i32.xor
              i32.const 16777619
              i32.mul
              local.get $l4
              i32.const 8
              i32.shr_u
              i32.xor
              i32.const 16777619
              i32.mul
              local.get $l1
              i32.const 2
              i32.add
              i32.load16_u
              local.tee $l4
              i32.const 255
              i32.and
              i32.xor
              i32.const 16777619
              i32.mul
              local.get $l4
              i32.const 8
              i32.shr_u
              i32.xor
              i32.const 16777619
              i32.mul
              local.set $l8
              local.get $l1
              i32.const 4
              i32.add
              local.set $l1
              local.get $l7
              local.get $l3
              i32.const 2
              i32.add
              local.tee $l3
              i32.ne
              br_if $L58
            end
            local.get $l16
            i32.eqz
            br_if $B55
          end
          local.get $l8
          local.get $l0
          i32.const 10
          i32.add
          local.get $l3
          i32.const 1
          i32.shl
          i32.add
          i32.load16_u
          local.tee $l1
          i32.const 255
          i32.and
          i32.xor
          i32.const 16777619
          i32.mul
          local.get $l1
          i32.const 8
          i32.shr_u
          i32.xor
          i32.const 16777619
          i32.mul
          local.set $l8
        end
        i32.const 0
        local.get $l8
        i32.store offset=72560
      end
      local.get $l6
      i32.const 6
      i32.add
      local.set $l6
      local.get $l10
      i32.const 1
      i32.add
      local.tee $l10
      i32.const 1000
      i32.ne
      br_if $L45
    end
    i32.const 0
    local.get $l13
    local.get $l14
    i32.add
    local.get $l12
    i32.add
    local.tee $l1
    i32.store offset=16384
    i32.const 0
    local.get $l12
    i32.store offset=16388
    i32.const 0
    local.get $l13
    i32.store offset=16392
    i32.const 0
    local.get $l14
    i32.store offset=16396
    i32.const 0
    local.get $l15
    i32.store offset=16400
    i32.const 0
    local.get $l8
    i32.store offset=16404
    local.get $l0
    i32.const 16
    i32.add
    global.set $__stack_pointer
    local.get $l1)
  (func $mix_treeB_dfs (type $t2) (param $p0 i32)
    (local $l1 i32) (local $l2 i32) (local $l3 i32) (local $l4 i32) (local $l5 i32) (local $l6 i32) (local $l7 i32) (local $l8 i32) (local $l9 i32)
    global.get $__stack_pointer
    i32.const 16
    i32.sub
    local.tee $l1
    global.set $__stack_pointer
    local.get $p0
    i32.const 1
    i32.shl
    local.tee $l2
    i32.load16_s offset=76576
    local.set $l3
    local.get $l2
    i32.load16_s offset=78576
    local.set $l4
    local.get $l2
    i32.load16_u offset=68560
    local.set $l2
    block $B0
      block $B1
        local.get $p0
        i32.load8_u offset=67552
        i32.eqz
        br_if $B1
        local.get $l2
        i32.const 65535
        i32.and
        i32.const 65535
        i32.ne
        br_if $B1
        local.get $l4
        i32.const 31
        i32.add
        i32.const 100
        i32.rem_s
        local.set $l4
        br $B0
      end
      local.get $p0
      i32.load8_u offset=66544
      i32.eqz
      br_if $B0
      local.get $l2
      i32.const 65535
      i32.and
      i32.const 65535
      i32.eq
      br_if $B0
      local.get $l3
      i32.const 17
      i32.add
      i32.const 100
      i32.rem_s
      local.set $l3
    end
    i32.const 0
    local.set $l5
    i32.const 0
    i32.const 0
    i32.load offset=72560
    local.get $p0
    i32.const 255
    i32.and
    i32.xor
    i32.const 16777619
    i32.mul
    local.get $p0
    i32.const 8
    i32.shr_u
    i32.xor
    i32.const 16777619
    i32.mul
    local.get $l2
    i32.const 255
    i32.and
    i32.xor
    i32.const 16777619
    i32.mul
    local.get $l2
    i32.const 65280
    i32.and
    i32.const 8
    i32.shr_u
    i32.xor
    i32.const 16777619
    i32.mul
    local.get $p0
    i32.const 1
    i32.shl
    local.tee $l2
    i32.load16_u offset=72576
    local.tee $l6
    i32.const 255
    i32.and
    i32.xor
    i32.const 16777619
    i32.mul
    local.get $l6
    i32.const 8
    i32.shr_u
    i32.xor
    i32.const 16777619
    i32.mul
    local.get $l2
    i32.load16_u offset=74576
    local.tee $l6
    i32.const 255
    i32.and
    i32.xor
    i32.const 16777619
    i32.mul
    local.get $l6
    i32.const 8
    i32.shr_u
    i32.xor
    i32.const 16777619
    i32.mul
    local.get $l3
    i32.const 255
    i32.and
    i32.xor
    i32.const 16777619
    i32.mul
    local.get $l3
    i32.const 65280
    i32.and
    i32.const 8
    i32.shr_u
    i32.xor
    i32.const 16777619
    i32.mul
    local.get $l4
    i32.const 255
    i32.and
    i32.xor
    i32.const 16777619
    i32.mul
    local.get $l4
    i32.const 65280
    i32.and
    i32.const 8
    i32.shr_u
    i32.xor
    i32.const 16777619
    i32.mul
    local.get $l2
    i32.load16_u offset=70560
    local.tee $l3
    i32.const 255
    i32.and
    i32.xor
    i32.const 16777619
    i32.mul
    local.get $l3
    i32.const 8
    i32.shr_u
    i32.xor
    i32.const 16777619
    i32.mul
    local.tee $l7
    i32.store offset=72560
    block $B2
      local.get $l3
      i32.eqz
      br_if $B2
      local.get $l3
      i32.const 3
      i32.and
      local.set $l6
      local.get $p0
      i32.const 6
      i32.mul
      local.set $l8
      block $B3
        block $B4
          local.get $l3
          i32.const 4
          i32.lt_u
          br_if $B4
          local.get $l8
          i32.const 80576
          i32.add
          local.set $l4
          local.get $l3
          i32.const 65532
          i32.and
          local.set $l5
          local.get $l3
          i32.const 1
          i32.shl
          i32.const 131064
          i32.and
          local.set $l9
          i32.const 0
          local.set $l2
          loop $L5
            local.get $l1
            i32.const 10
            i32.add
            local.get $l2
            i32.add
            local.get $l4
            local.get $l2
            i32.add
            i64.load align=2
            i64.store align=2
            local.get $l9
            local.get $l2
            i32.const 8
            i32.add
            local.tee $l2
            i32.ne
            br_if $L5
          end
          local.get $l6
          i32.eqz
          br_if $B3
        end
        local.get $l8
        local.get $l5
        i32.const 1
        i32.shl
        local.tee $l4
        i32.add
        i32.const 80576
        i32.add
        local.set $l2
        local.get $l1
        i32.const 10
        i32.add
        local.get $l4
        i32.add
        local.set $l4
        loop $L6
          local.get $l4
          local.get $l2
          i32.load16_u
          i32.store16
          local.get $l2
          i32.const 2
          i32.add
          local.set $l2
          local.get $l4
          i32.const 2
          i32.add
          local.set $l4
          local.get $l6
          i32.const -1
          i32.add
          local.tee $l6
          br_if $L6
        end
      end
      block $B7
        local.get $l3
        i32.const 1
        i32.eq
        local.tee $l5
        br_if $B7
        local.get $p0
        i32.load8_u offset=65536
        i32.const 255
        i32.and
        i32.eqz
        br_if $B7
        local.get $l3
        i32.const -1
        i32.add
        local.tee $p0
        i32.const 3
        i32.and
        local.set $l4
        i32.const 0
        local.set $l6
        local.get $l1
        i32.load16_u offset=10
        local.set $l8
        block $B8
          block $B9
            local.get $l3
            i32.const -2
            i32.add
            i32.const 65535
            i32.and
            i32.const 3
            i32.lt_u
            br_if $B9
            local.get $p0
            i32.const -4
            i32.and
            local.set $l9
            i32.const 0
            local.set $l6
            local.get $l1
            i32.const 10
            i32.add
            local.set $l2
            loop $L10
              local.get $l2
              local.get $l2
              i32.const 2
              i32.add
              i64.load align=2
              i64.store align=2
              local.get $l2
              i32.const 8
              i32.add
              local.set $l2
              local.get $l9
              local.get $l6
              i32.const 4
              i32.add
              local.tee $l6
              i32.ne
              br_if $L10
            end
            local.get $l4
            i32.eqz
            br_if $B8
          end
          local.get $l1
          i32.const 10
          i32.add
          local.get $l6
          i32.const 1
          i32.shl
          i32.add
          local.set $l2
          loop $L11
            local.get $l2
            local.get $l2
            i32.const 2
            i32.add
            local.tee $l6
            i32.load16_u
            i32.store16
            local.get $l6
            local.set $l2
            local.get $l4
            i32.const -1
            i32.add
            local.tee $l4
            br_if $L11
          end
        end
        local.get $l1
        i32.const 10
        i32.add
        local.get $p0
        i32.const 1
        i32.shl
        i32.add
        local.get $l8
        i32.store16
      end
      i32.const 0
      local.set $l4
      block $B12
        block $B13
          local.get $l5
          br_if $B13
          local.get $l3
          i32.const 1
          i32.and
          local.set $p0
          local.get $l3
          i32.const 65534
          i32.and
          local.set $l9
          i32.const 0
          local.set $l4
          local.get $l1
          i32.const 10
          i32.add
          local.set $l2
          loop $L14
            local.get $l7
            local.get $l2
            i32.load16_u
            local.tee $l6
            i32.const 255
            i32.and
            i32.xor
            i32.const 16777619
            i32.mul
            local.get $l6
            i32.const 8
            i32.shr_u
            i32.xor
            i32.const 16777619
            i32.mul
            local.get $l2
            i32.const 2
            i32.add
            i32.load16_u
            local.tee $l6
            i32.const 255
            i32.and
            i32.xor
            i32.const 16777619
            i32.mul
            local.get $l6
            i32.const 8
            i32.shr_u
            i32.xor
            i32.const 16777619
            i32.mul
            local.set $l7
            local.get $l2
            i32.const 4
            i32.add
            local.set $l2
            local.get $l9
            local.get $l4
            i32.const 2
            i32.add
            local.tee $l4
            i32.ne
            br_if $L14
          end
          local.get $p0
          i32.eqz
          br_if $B12
        end
        local.get $l7
        local.get $l1
        i32.const 10
        i32.add
        local.get $l4
        i32.const 1
        i32.shl
        i32.add
        i32.load16_u
        local.tee $l2
        i32.const 255
        i32.and
        i32.xor
        i32.const 16777619
        i32.mul
        local.get $l2
        i32.const 8
        i32.shr_u
        i32.xor
        i32.const 16777619
        i32.mul
        local.set $l7
      end
      i32.const 0
      local.get $l7
      i32.store offset=72560
      local.get $l1
      i32.const 10
      i32.add
      local.set $l2
      loop $L15
        local.get $l2
        i32.load16_u
        call $mix_treeB_dfs
        local.get $l2
        i32.const 2
        i32.add
        local.set $l2
        local.get $l3
        i32.const -1
        i32.add
        local.tee $l3
        br_if $L15
      end
    end
    local.get $l1
    i32.const 16
    i32.add
    global.set $__stack_pointer)
  (table $__indirect_function_table 1 1 funcref)
  (memory $memory 2)
  (global $__stack_pointer (mut i32) (i32.const 65536))
  (global $__dso_handle i32 (i32.const 65536))
  (global $__data_end i32 (i32.const 88576))
  (global $__stack_low i32 (i32.const 0))
  (global $__stack_high i32 (i32.const 65536))
  (global $__global_base i32 (i32.const 65536))
  (global $__heap_base i32 (i32.const 88576))
  (global $__heap_end i32 (i32.const 131072))
  (global $__memory_base i32 (i32.const 0))
  (global $__table_base i32 (i32.const 1))
  (global $__wasm_first_page_end i32 (i32.const 65536))
  (export "memory" (memory $memory))
  (export "__wasm_call_ctors" (func $__wasm_call_ctors))
  (export "__stack_pointer" (global $__stack_pointer))
  (export "vdom_diff_trace" (func $vdom_diff_trace))
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
