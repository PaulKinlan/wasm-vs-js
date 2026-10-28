;; tooling.c-to-wasm-compile.v1 — compiler
;; WebAssembly Text (WAT) baseline for C-to-Wasm compiler

(module
  (type $t0 (func (param i32 i32 i32 i32 i32 i32) (result i32)))
  (type $t1 (func (param i32 i32) (result i32)))
  (type $t2 (func (param i32) (result i32)))
  (type $t3 (func (result i32)))
  (func $compile_c (type $t0) (param $p0 i32) (param $p1 i32) (param $p2 i32) (param $p3 i32) (param $p4 i32) (param $p5 i32) (result i32)
    (local $l6 i32) (local $l7 i32) (local $l8 i32) (local $l9 i32) (local $l10 i32) (local $l11 i32) (local $l12 i32)
    global.get $g0
    i32.const 16
    i32.sub
    local.tee $l6
    global.set $g0
    i32.const 0
    local.set $l7
    i32.const 0
    local.get $p1
    i32.store offset=67684
    i32.const 0
    local.get $p3
    i32.store offset=67688
    i32.const 0
    i32.const 2
    i32.store offset=67696
    i32.const 0
    i32.const 1
    i32.store offset=65584
    i32.const 0
    i32.const 1
    i32.store offset=65588
    i32.const 0
    i32.const 0
    i32.store offset=65612
    i32.const 0
    i32.const 0
    i32.store8 offset=65608
    i32.const 0
    i32.const 0
    i32.store offset=67692
    i32.const 0
    i32.const 0
    i32.store8 offset=65620
    i32.const 0
    i32.const 0
    i32.store offset=67700
    i32.const 0
    i32.const 0
    i32.store8 offset=65616
    i32.const 0
    i32.const 0
    i32.store offset=67680
    i32.const -1
    local.set $l8
    block $B0
      local.get $p1
      i32.eqz
      br_if $B0
      loop $L1
        block $B2
          block $B3
            local.get $p0
            local.get $l7
            i32.add
            i32.load8_u
            local.tee $l9
            i32.const 13
            i32.gt_u
            br_if $B3
            i32.const 1
            local.get $l9
            i32.shl
            i32.const 9728
            i32.and
            br_if $B2
          end
          local.get $l9
          i32.const -127
          i32.add
          i32.const 255
          i32.and
          i32.const 161
          i32.ge_u
          br_if $B2
          i32.const -9
          local.set $l8
          br $B0
        end
        local.get $p1
        local.get $l7
        i32.const 1
        i32.add
        local.tee $l7
        i32.ne
        br_if $L1
      end
      local.get $p1
      i32.const 21
      i32.lt_u
      br_if $B0
      local.get $p0
      i32.load8_u
      i32.const 35
      i32.ne
      br_if $B0
      local.get $p0
      i32.load8_u offset=1
      i32.const 105
      i32.ne
      br_if $B0
      local.get $p0
      i32.load8_u offset=2
      i32.const 110
      i32.ne
      br_if $B0
      local.get $p0
      i32.load8_u offset=3
      i32.const 99
      i32.ne
      br_if $B0
      local.get $p0
      i32.load8_u offset=4
      i32.const 108
      i32.ne
      br_if $B0
      local.get $p0
      i32.load8_u offset=5
      i32.const 117
      i32.ne
      br_if $B0
      local.get $p0
      i32.load8_u offset=6
      i32.const 100
      i32.ne
      br_if $B0
      local.get $p0
      i32.load8_u offset=7
      i32.const 101
      i32.ne
      br_if $B0
      local.get $p0
      i32.load8_u offset=8
      i32.const 32
      i32.ne
      br_if $B0
      local.get $p0
      i32.load8_u offset=9
      i32.const 34
      i32.ne
      br_if $B0
      local.get $p0
      i32.load8_u offset=10
      i32.const 102
      i32.ne
      br_if $B0
      local.get $p0
      i32.load8_u offset=11
      i32.const 105
      i32.ne
      br_if $B0
      local.get $p0
      i32.load8_u offset=12
      i32.const 120
      i32.ne
      br_if $B0
      local.get $p0
      i32.load8_u offset=13
      i32.const 116
      i32.ne
      br_if $B0
      local.get $p0
      i32.load8_u offset=14
      i32.const 117
      i32.ne
      br_if $B0
      local.get $p0
      i32.load8_u offset=15
      i32.const 114
      i32.ne
      br_if $B0
      local.get $p0
      i32.load8_u offset=16
      i32.const 101
      i32.ne
      br_if $B0
      local.get $p0
      i32.load8_u offset=17
      i32.const 46
      i32.ne
      br_if $B0
      local.get $p0
      i32.load8_u offset=18
      i32.const 104
      i32.ne
      br_if $B0
      local.get $p0
      i32.load8_u offset=19
      i32.const 34
      i32.ne
      br_if $B0
      local.get $p0
      i32.load8_u offset=20
      i32.const 10
      i32.ne
      br_if $B0
      i32.const 0
      local.set $l7
      i32.const 0
      i32.const 2
      i32.store offset=65588
      i32.const -2
      local.set $l8
      local.get $p3
      i32.eqz
      br_if $B0
      loop $L4
        block $B5
          block $B6
            local.get $p2
            local.get $l7
            i32.add
            i32.load8_u
            local.tee $l9
            i32.const 13
            i32.gt_u
            br_if $B6
            i32.const 1
            local.get $l9
            i32.shl
            i32.const 9728
            i32.and
            br_if $B5
          end
          local.get $l9
          i32.const -127
          i32.add
          i32.const 255
          i32.and
          i32.const 161
          i32.ge_u
          br_if $B5
          i32.const -10
          local.set $l8
          br $B0
        end
        local.get $p3
        local.get $l7
        i32.const 1
        i32.add
        local.tee $l7
        i32.ne
        br_if $L4
      end
      local.get $p3
      i32.const 15
      i32.lt_u
      br_if $B0
      local.get $p2
      i32.load8_u
      i32.const 35
      i32.ne
      br_if $B0
      local.get $p2
      i32.load8_u offset=1
      i32.const 100
      i32.ne
      br_if $B0
      local.get $p2
      i32.load8_u offset=2
      i32.const 101
      i32.ne
      br_if $B0
      local.get $p2
      i32.load8_u offset=3
      i32.const 102
      i32.ne
      br_if $B0
      local.get $p2
      i32.load8_u offset=4
      i32.const 105
      i32.ne
      br_if $B0
      local.get $p2
      i32.load8_u offset=5
      i32.const 110
      i32.ne
      br_if $B0
      local.get $p2
      i32.load8_u offset=6
      i32.const 101
      i32.ne
      br_if $B0
      local.get $p2
      i32.load8_u offset=7
      i32.const 32
      i32.ne
      br_if $B0
      local.get $p2
      i32.load8_u offset=8
      i32.const 66
      i32.ne
      br_if $B0
      local.get $p2
      i32.load8_u offset=9
      i32.const 65
      i32.ne
      br_if $B0
      local.get $p2
      i32.load8_u offset=10
      i32.const 83
      i32.ne
      br_if $B0
      local.get $p2
      i32.load8_u offset=11
      i32.const 69
      i32.ne
      br_if $B0
      local.get $p2
      i32.load8_u offset=12
      i32.const 32
      i32.ne
      br_if $B0
      local.get $p2
      local.get $p3
      i32.const -1
      i32.add
      local.tee $l7
      i32.add
      i32.load8_u
      i32.const 10
      i32.ne
      br_if $B0
      i32.const -3
      local.set $l8
      i32.const 14
      i32.const 13
      local.get $p2
      i32.load8_u offset=13
      local.tee $l10
      i32.const 45
      i32.eq
      select
      local.tee $l11
      local.get $l7
      i32.ge_u
      br_if $B0
      local.get $p2
      local.get $l11
      i32.add
      local.tee $l9
      i32.load8_u
      i32.const -58
      i32.add
      i32.const 255
      i32.and
      i32.const 246
      i32.lt_u
      br_if $B0
      i32.const 8
      i32.const 7
      local.get $l10
      i32.const 45
      i32.eq
      select
      local.set $l12
      local.get $l11
      i32.const -1
      i32.xor
      local.get $p3
      i32.add
      local.set $p2
      i32.const 0
      local.set $l7
      block $B7
        block $B8
          loop $L9
            local.get $l9
            i32.load8_u
            local.tee $p3
            i32.const -58
            i32.add
            i32.const 255
            i32.and
            i32.const 246
            i32.lt_u
            br_if $B8
            i32.const -4
            local.set $l8
            local.get $l7
            i32.const 214748364
            i32.gt_u
            br_if $B0
            local.get $p3
            i32.const -48
            i32.add
            local.set $p3
            block $B10
              local.get $l7
              i32.const 214748364
              i32.ne
              br_if $B10
              local.get $p3
              local.get $l12
              i32.gt_u
              br_if $B0
            end
            local.get $l9
            i32.const 1
            i32.add
            local.set $l9
            local.get $p3
            local.get $l7
            i32.const 10
            i32.mul
            i32.add
            local.set $l7
            local.get $p2
            i32.const -1
            i32.add
            local.tee $p2
            br_if $L9
            br $B7
          end
        end
        local.get $p2
        i32.eqz
        br_if $B7
        i32.const -5
        local.set $l8
        br $B0
      end
      i32.const 0
      local.get $p0
      i32.const 21
      i32.add
      local.tee $p0
      i32.store offset=65596
      i32.const 0
      local.get $p1
      i32.const -21
      i32.add
      local.tee $l9
      i32.store offset=65600
      i32.const 0
      i32.const 0
      local.get $l7
      i32.sub
      local.get $l7
      local.get $l10
      i32.const 45
      i32.eq
      select
      i32.store offset=65592
      i32.const 0
      i32.const 0
      i32.store offset=65604
      i32.const -6
      local.set $l8
      i32.const 65541
      i32.const 3
      call $f1
      i32.eqz
      br_if $B0
      i32.const 65536
      i32.const 4
      call $f1
      i32.eqz
      br_if $B0
      i32.const 40
      call $f2
      i32.eqz
      br_if $B0
      i32.const 65552
      i32.const 4
      call $f1
      i32.eqz
      br_if $B0
      i32.const 41
      call $f2
      i32.eqz
      br_if $B0
      i32.const 123
      call $f2
      i32.eqz
      br_if $B0
      i32.const 65545
      i32.const 6
      call $f1
      i32.eqz
      br_if $B0
      local.get $l6
      i32.const 12
      i32.add
      call $f3
      i32.eqz
      br_if $B0
      i32.const 59
      call $f2
      i32.eqz
      br_if $B0
      i32.const 125
      call $f2
      i32.eqz
      br_if $B0
      block $B11
        i32.const 0
        i32.load offset=65604
        local.tee $l7
        local.get $l9
        i32.ge_u
        br_if $B11
        loop $L12
          local.get $p0
          local.get $l7
          i32.add
          i32.load8_u
          i32.const -9
          i32.add
          local.tee $p1
          i32.const 23
          i32.gt_u
          br_if $B11
          i32.const 1
          local.get $p1
          i32.shl
          i32.const 8388627
          i32.and
          i32.eqz
          br_if $B11
          i32.const 0
          local.get $l7
          i32.const 1
          i32.add
          local.tee $l7
          i32.store offset=65604
          local.get $l9
          local.get $l7
          i32.ne
          br_if $L12
        end
        local.get $l9
        local.set $l7
      end
      i32.const -7
      local.set $l8
      local.get $l7
      local.get $l9
      i32.ne
      br_if $B0
      i32.const 0
      i32.load8_u offset=65608
      i32.const 1
      i32.and
      br_if $B0
      i32.const -8
      local.set $l8
      local.get $p5
      i32.const 31
      i32.const 32
      i32.const 2
      i32.const 3
      i32.const 0
      i32.load offset=65612
      local.tee $p3
      i32.const 126
      i32.lt_u
      select
      local.get $p3
      i32.const 2
      i32.add
      local.tee $p1
      i32.add
      local.tee $l9
      i32.const 128
      i32.lt_u
      select
      local.get $l9
      i32.add
      i32.lt_u
      br_if $B0
      local.get $p4
      i32.const 8
      i32.add
      i32.const 0
      i32.load offset=65557 align=1
      i32.store align=1
      local.get $p4
      i32.const 15
      i32.add
      i32.const 66051
      i32.store align=1
      local.get $p4
      i64.const 6131245312
      i64.store align=1
      local.get $p4
      i32.const 10
      i32.store8 offset=29
      local.get $p4
      i32.const 11
      i32.add
      i32.const 0
      i32.load offset=65560 align=1
      i32.store align=1
      local.get $p4
      i32.const 19
      i32.add
      i32.const 0
      i64.load offset=65564 align=1
      i64.store align=1
      local.get $p4
      i32.const 27
      i32.add
      i32.const 0
      i32.load16_u offset=65572 align=1
      i32.store16 align=1
      i32.const 0
      i32.const 1
      i32.store8 offset=65620
      local.get $p4
      i32.const 30
      i32.add
      local.set $l8
      i32.const 0
      local.set $l7
      loop $L13
        local.get $l8
        local.get $l7
        i32.add
        i32.const -128
        i32.const 0
        local.get $l9
        i32.const 7
        i32.shr_u
        local.tee $p0
        select
        local.get $l9
        i32.const 127
        i32.and
        i32.or
        i32.store8
        local.get $l7
        i32.const 1
        i32.add
        local.set $l7
        local.get $p0
        local.set $l9
        local.get $p0
        br_if $L13
      end
      local.get $p4
      local.get $l7
      i32.add
      i32.const 30
      i32.add
      i32.const 1
      i32.store8
      loop $L14
        local.get $p4
        local.get $l7
        i32.add
        i32.const 31
        i32.add
        i32.const -128
        i32.const 0
        local.get $p1
        i32.const 7
        i32.shr_u
        local.tee $l9
        select
        local.get $p1
        i32.const 127
        i32.and
        i32.or
        i32.store8
        local.get $l7
        i32.const 1
        i32.add
        local.set $l7
        local.get $l9
        local.set $p1
        local.get $l9
        br_if $L14
      end
      i32.const 0
      local.set $l9
      local.get $p4
      local.get $l7
      i32.add
      local.tee $p0
      i32.const 31
      i32.add
      i32.const 0
      i32.store8
      local.get $l7
      i32.const 32
      i32.add
      local.set $p1
      block $B15
        local.get $p3
        i32.eqz
        br_if $B15
        local.get $p3
        i32.const 3
        i32.and
        local.set $l8
        block $B16
          local.get $p3
          i32.const 4
          i32.lt_u
          br_if $B16
          local.get $p4
          local.get $l7
          i32.add
          local.set $p1
          local.get $p3
          i32.const -4
          i32.and
          local.set $p3
          i32.const 0
          local.set $l9
          loop $L17
            local.get $p1
            local.get $l9
            i32.add
            i32.const 32
            i32.add
            local.get $l9
            i32.const 65632
            i32.add
            i32.load8_u
            i32.store8
            local.get $p0
            i32.const 33
            i32.add
            local.get $l9
            i32.const 65633
            i32.add
            i32.load8_u
            i32.store8
            local.get $p0
            i32.const 34
            i32.add
            local.get $l9
            i32.const 65634
            i32.add
            i32.load8_u
            i32.store8
            local.get $p0
            i32.const 35
            i32.add
            local.get $l9
            i32.const 65635
            i32.add
            i32.load8_u
            i32.store8
            local.get $p0
            i32.const 4
            i32.add
            local.set $p0
            local.get $p3
            local.get $l9
            i32.const 4
            i32.add
            local.tee $l9
            i32.ne
            br_if $L17
          end
          local.get $l7
          local.get $l9
          i32.add
          i32.const 32
          i32.add
          local.set $p1
          local.get $l8
          i32.eqz
          br_if $B15
        end
        local.get $l9
        i32.const 65632
        i32.add
        local.set $l7
        loop $L18
          local.get $p4
          local.get $p1
          i32.add
          local.get $l7
          i32.load8_u
          i32.store8
          local.get $l7
          i32.const 1
          i32.add
          local.set $l7
          local.get $p1
          i32.const 1
          i32.add
          local.set $p1
          local.get $l8
          i32.const -1
          i32.add
          local.tee $l8
          br_if $L18
        end
      end
      local.get $p4
      local.get $p1
      i32.add
      i32.const 11
      i32.store8
      i32.const 0
      local.get $p1
      i32.const 1
      i32.add
      local.tee $l8
      i32.store offset=67680
      i32.const 0
      i32.const 1
      i32.store8 offset=65616
      i32.const 0
      i32.const 2
      i32.store offset=65584
    end
    local.get $l6
    i32.const 16
    i32.add
    global.set $g0
    local.get $l8)
  (func $f1 (type $t1) (param $p0 i32) (param $p1 i32) (result i32)
    (local $l2 i32) (local $l3 i32) (local $l4 i32) (local $l5 i32) (local $l6 i32)
    i32.const 0
    local.set $l2
    block $B0
      i32.const 0
      i32.load offset=65604
      local.tee $l3
      i32.const 0
      i32.load offset=65600
      local.tee $l4
      i32.ge_u
      br_if $B0
      i32.const 0
      i32.load offset=65596
      local.set $l5
      loop $L1
        local.get $l5
        local.get $l3
        i32.add
        i32.load8_u
        i32.const -9
        i32.add
        local.tee $l6
        i32.const 23
        i32.gt_u
        br_if $B0
        i32.const 1
        local.get $l6
        i32.shl
        i32.const 8388627
        i32.and
        i32.eqz
        br_if $B0
        i32.const 0
        local.get $l3
        i32.const 1
        i32.add
        local.tee $l3
        i32.store offset=65604
        local.get $l4
        local.get $l3
        i32.ne
        br_if $L1
      end
      local.get $l4
      local.set $l3
    end
    block $B2
      local.get $l3
      local.get $p1
      i32.add
      local.tee $l6
      local.get $l4
      i32.gt_u
      br_if $B2
      i32.const 0
      local.set $l2
      i32.const 0
      i32.load offset=65596
      local.tee $l5
      local.get $l3
      i32.add
      local.tee $l3
      i32.load8_u
      local.get $p0
      i32.load8_u
      i32.ne
      br_if $B2
      local.get $l3
      i32.load8_u offset=1
      local.get $p0
      i32.load8_u offset=1
      i32.ne
      br_if $B2
      local.get $l3
      i32.load8_u offset=2
      local.get $p0
      i32.load8_u offset=2
      i32.ne
      br_if $B2
      block $B3
        local.get $p1
        i32.const 3
        i32.eq
        br_if $B3
        local.get $l3
        i32.load8_u offset=3
        local.get $p0
        i32.load8_u offset=3
        i32.ne
        br_if $B2
        local.get $p1
        i32.const 4
        i32.eq
        br_if $B3
        local.get $l3
        i32.load8_u offset=4
        local.get $p0
        i32.load8_u offset=4
        i32.ne
        br_if $B2
        local.get $p1
        i32.const 5
        i32.eq
        br_if $B3
        local.get $l3
        i32.load8_u offset=5
        local.get $p0
        i32.load8_u offset=5
        i32.ne
        br_if $B2
      end
      block $B4
        local.get $l6
        local.get $l4
        i32.ge_u
        br_if $B4
        local.get $l5
        local.get $l6
        i32.add
        i32.load8_u
        local.tee $l4
        i32.const 95
        i32.eq
        br_if $B2
        local.get $l4
        i32.const 223
        i32.and
        i32.const -91
        i32.add
        i32.const 255
        i32.and
        i32.const 229
        i32.gt_u
        br_if $B2
        local.get $l3
        local.get $p1
        i32.add
        i32.load8_u
        i32.const -58
        i32.add
        i32.const 255
        i32.and
        i32.const 245
        i32.gt_u
        br_if $B2
      end
      i32.const 0
      local.get $l6
      i32.store offset=65604
      i32.const 1
      local.set $l2
      i32.const 0
      i32.const 0
      i32.load offset=67692
      i32.const 1
      i32.add
      i32.store offset=67692
    end
    local.get $l2)
  (func $f2 (type $t2) (param $p0 i32) (result i32)
    (local $l1 i32) (local $l2 i32) (local $l3 i32) (local $l4 i32)
    block $B0
      block $B1
        i32.const 0
        i32.load offset=65604
        local.tee $l1
        i32.const 0
        i32.load offset=65600
        local.tee $l2
        i32.ge_u
        br_if $B1
        i32.const 0
        i32.load offset=65596
        local.set $l3
        loop $L2
          local.get $l3
          local.get $l1
          i32.add
          i32.load8_u
          i32.const -9
          i32.add
          local.tee $l4
          i32.const 23
          i32.gt_u
          br_if $B1
          i32.const 1
          local.get $l4
          i32.shl
          i32.const 8388627
          i32.and
          i32.eqz
          br_if $B1
          i32.const 0
          local.set $l4
          i32.const 0
          local.get $l1
          i32.const 1
          i32.add
          local.tee $l1
          i32.store offset=65604
          local.get $l2
          local.get $l1
          i32.ne
          br_if $L2
          br $B0
        end
      end
      i32.const 0
      local.set $l4
      local.get $l1
      local.get $l2
      i32.ge_u
      br_if $B0
      i32.const 0
      local.set $l4
      i32.const 0
      i32.load offset=65596
      local.get $l1
      i32.add
      i32.load8_u
      local.get $p0
      i32.ne
      br_if $B0
      i32.const 1
      local.set $l4
      i32.const 0
      local.get $l1
      i32.const 1
      i32.add
      i32.store offset=65604
      i32.const 0
      i32.const 0
      i32.load offset=67692
      i32.const 1
      i32.add
      i32.store offset=67692
    end
    local.get $l4)
  (func $f3 (type $t2) (param $p0 i32) (result i32)
    (local $l1 i32) (local $l2 i32) (local $l3 i32) (local $l4 i32) (local $l5 i32) (local $l6 i32)
    global.get $g0
    i32.const 16
    i32.sub
    local.tee $l1
    global.set $g0
    block $B0
      block $B1
        local.get $p0
        call $f4
        i32.eqz
        br_if $B1
        i32.const 0
        i32.load offset=65596
        local.set $l2
        i32.const 0
        i32.load offset=65600
        local.set $l3
        block $B2
          loop $L3
            block $B4
              i32.const 0
              i32.load offset=65604
              local.tee $l4
              local.get $l3
              i32.ge_u
              br_if $B4
              loop $L5
                local.get $l2
                local.get $l4
                i32.add
                i32.load8_u
                i32.const -9
                i32.add
                local.tee $l5
                i32.const 23
                i32.gt_u
                br_if $B4
                i32.const 1
                local.get $l5
                i32.shl
                i32.const 8388627
                i32.and
                i32.eqz
                br_if $B4
                i32.const 0
                local.get $l4
                i32.const 1
                i32.add
                local.tee $l4
                i32.store offset=65604
                local.get $l3
                local.get $l4
                i32.ne
                br_if $L5
              end
              local.get $l3
              local.set $l4
              br $B2
            end
            local.get $l4
            local.get $l3
            i32.ge_u
            br_if $B2
            local.get $l2
            local.get $l4
            i32.add
            i32.load8_u
            i32.const 94
            i32.ne
            br_if $B2
            i32.const 0
            local.get $l4
            i32.const 1
            i32.add
            i32.store offset=65604
            i32.const 0
            i32.const 0
            i32.load offset=67692
            i32.const 1
            i32.add
            i32.store offset=67692
            local.get $l1
            i32.const 8
            i32.add
            call $f4
            i32.eqz
            br_if $B1
            block $B6
              block $B7
                i32.const 0
                i32.load offset=65612
                local.tee $l4
                i32.const 2047
                i32.gt_u
                br_if $B7
                local.get $l4
                i32.const 115
                i32.store8 offset=65632
                i32.const 0
                local.get $l4
                i32.const 1
                i32.add
                i32.store offset=65612
                br $B6
              end
              i32.const 0
              i32.const 1
              i32.store8 offset=65608
            end
            i32.const 0
            i32.const 0
            i32.load offset=67696
            i32.const 1
            i32.add
            i32.store offset=67696
            i32.const 0
            i32.const 0
            i32.load offset=67700
            i32.const 1
            i32.add
            i32.store offset=67700
            local.get $p0
            local.get $p0
            i32.load
            local.get $l1
            i32.load offset=8
            i32.xor
            i32.store
            br $L3
          end
        end
        loop $L8
          block $B9
            local.get $l4
            local.get $l3
            i32.ge_u
            br_if $B9
            loop $L10
              local.get $l2
              local.get $l4
              i32.add
              i32.load8_u
              i32.const -9
              i32.add
              local.tee $l5
              i32.const 23
              i32.gt_u
              br_if $B9
              i32.const 1
              local.get $l5
              i32.shl
              i32.const 8388627
              i32.and
              i32.eqz
              br_if $B9
              i32.const 1
              local.set $l5
              i32.const 0
              local.get $l4
              i32.const 1
              i32.add
              local.tee $l4
              i32.store offset=65604
              local.get $l3
              local.get $l4
              i32.ne
              br_if $L10
              br $B0
            end
          end
          i32.const 1
          local.set $l5
          local.get $l4
          local.get $l3
          i32.ge_u
          br_if $B0
          local.get $l2
          local.get $l4
          i32.add
          i32.load8_u
          i32.const 124
          i32.ne
          br_if $B0
          i32.const 0
          local.get $l4
          i32.const 1
          i32.add
          i32.store offset=65604
          i32.const 0
          i32.const 0
          i32.load offset=67692
          i32.const 1
          i32.add
          i32.store offset=67692
          local.get $l1
          i32.const 4
          i32.add
          call $f4
          i32.eqz
          br_if $B1
          local.get $l1
          i32.load offset=4
          local.set $l6
          block $B11
            loop $L12
              block $B13
                i32.const 0
                i32.load offset=65604
                local.tee $l4
                local.get $l3
                i32.ge_u
                br_if $B13
                loop $L14
                  local.get $l2
                  local.get $l4
                  i32.add
                  i32.load8_u
                  i32.const -9
                  i32.add
                  local.tee $l5
                  i32.const 23
                  i32.gt_u
                  br_if $B13
                  i32.const 1
                  local.get $l5
                  i32.shl
                  i32.const 8388627
                  i32.and
                  i32.eqz
                  br_if $B13
                  i32.const 0
                  local.get $l4
                  i32.const 1
                  i32.add
                  local.tee $l4
                  i32.store offset=65604
                  local.get $l3
                  local.get $l4
                  i32.ne
                  br_if $L14
                end
                local.get $l3
                local.set $l4
                br $B11
              end
              local.get $l4
              local.get $l3
              i32.ge_u
              br_if $B11
              local.get $l2
              local.get $l4
              i32.add
              i32.load8_u
              i32.const 94
              i32.ne
              br_if $B11
              i32.const 0
              local.get $l4
              i32.const 1
              i32.add
              i32.store offset=65604
              i32.const 0
              i32.const 0
              i32.load offset=67692
              i32.const 1
              i32.add
              i32.store offset=67692
              local.get $l1
              i32.const 12
              i32.add
              call $f4
              i32.eqz
              br_if $B1
              block $B15
                block $B16
                  i32.const 0
                  i32.load offset=65612
                  local.tee $l4
                  i32.const 2047
                  i32.gt_u
                  br_if $B16
                  local.get $l4
                  i32.const 115
                  i32.store8 offset=65632
                  i32.const 0
                  local.get $l4
                  i32.const 1
                  i32.add
                  i32.store offset=65612
                  br $B15
                end
                i32.const 0
                i32.const 1
                i32.store8 offset=65608
              end
              i32.const 0
              i32.const 0
              i32.load offset=67696
              i32.const 1
              i32.add
              i32.store offset=67696
              i32.const 0
              i32.const 0
              i32.load offset=67700
              i32.const 1
              i32.add
              i32.store offset=67700
              local.get $l6
              local.get $l1
              i32.load offset=12
              i32.xor
              local.set $l6
              br $L12
            end
          end
          block $B17
            block $B18
              i32.const 0
              i32.load offset=65612
              local.tee $l5
              i32.const 2047
              i32.gt_u
              br_if $B18
              local.get $l5
              i32.const 114
              i32.store8 offset=65632
              i32.const 0
              local.get $l5
              i32.const 1
              i32.add
              i32.store offset=65612
              br $B17
            end
            i32.const 0
            i32.const 1
            i32.store8 offset=65608
          end
          i32.const 0
          i32.const 0
          i32.load offset=67696
          i32.const 1
          i32.add
          i32.store offset=67696
          i32.const 0
          i32.const 0
          i32.load offset=67700
          i32.const 1
          i32.add
          i32.store offset=67700
          local.get $p0
          local.get $p0
          i32.load
          local.get $l6
          i32.or
          i32.store
          br $L8
        end
      end
      i32.const 0
      local.set $l5
    end
    local.get $l1
    i32.const 16
    i32.add
    global.set $g0
    local.get $l5)
  (func $f4 (type $t2) (param $p0 i32) (result i32)
    (local $l1 i32) (local $l2 i32) (local $l3 i32) (local $l4 i32) (local $l5 i32)
    global.get $g0
    i32.const 16
    i32.sub
    local.tee $l1
    global.set $g0
    block $B0
      block $B1
        local.get $p0
        call $f16
        br_if $B1
        i32.const 0
        local.set $l2
        br $B0
      end
      i32.const 0
      i32.load offset=65596
      local.set $l3
      i32.const 0
      i32.load offset=65600
      local.set $l4
      loop $L2
        block $B3
          i32.const 0
          i32.load offset=65604
          local.tee $l5
          local.get $l4
          i32.ge_u
          br_if $B3
          loop $L4
            local.get $l3
            local.get $l5
            i32.add
            i32.load8_u
            i32.const -9
            i32.add
            local.tee $l2
            i32.const 23
            i32.gt_u
            br_if $B3
            i32.const 1
            local.get $l2
            i32.shl
            i32.const 8388627
            i32.and
            i32.eqz
            br_if $B3
            i32.const 1
            local.set $l2
            i32.const 0
            local.get $l5
            i32.const 1
            i32.add
            local.tee $l5
            i32.store offset=65604
            local.get $l4
            local.get $l5
            i32.ne
            br_if $L4
            br $B0
          end
        end
        i32.const 1
        local.set $l2
        local.get $l5
        local.get $l4
        i32.ge_u
        br_if $B0
        local.get $l3
        local.get $l5
        i32.add
        i32.load8_u
        i32.const 38
        i32.ne
        br_if $B0
        i32.const 0
        local.get $l5
        i32.const 1
        i32.add
        i32.store offset=65604
        i32.const 0
        i32.const 0
        i32.load offset=67692
        i32.const 1
        i32.add
        i32.store offset=67692
        block $B5
          local.get $l1
          i32.const 12
          i32.add
          call $f16
          br_if $B5
          i32.const 0
          local.set $l2
          br $B0
        end
        block $B6
          block $B7
            i32.const 0
            i32.load offset=65612
            local.tee $l5
            i32.const 2047
            i32.gt_u
            br_if $B7
            local.get $l5
            i32.const 113
            i32.store8 offset=65632
            i32.const 0
            local.get $l5
            i32.const 1
            i32.add
            i32.store offset=65612
            br $B6
          end
          i32.const 0
          i32.const 1
          i32.store8 offset=65608
        end
        i32.const 0
        i32.const 0
        i32.load offset=67696
        i32.const 1
        i32.add
        i32.store offset=67696
        i32.const 0
        i32.const 0
        i32.load offset=67700
        i32.const 1
        i32.add
        i32.store offset=67700
        local.get $p0
        local.get $p0
        i32.load
        local.get $l1
        i32.load offset=12
        i32.and
        i32.store
        br $L2
      end
    end
    local.get $l1
    i32.const 16
    i32.add
    global.set $g0
    local.get $l2)
  (func $counter_source_bytes (type $t3) (result i32)
    i32.const 0
    i32.load offset=67684)
  (func $counter_header_bytes (type $t3) (result i32)
    i32.const 0
    i32.load offset=67688)
  (func $counter_tokens (type $t3) (result i32)
    i32.const 0
    i32.load offset=67692)
  (func $counter_ast_nodes (type $t3) (result i32)
    i32.const 0
    i32.load offset=67696)
  (func $counter_functions (type $t3) (result i32)
    i32.const 0
    i32.load8_u offset=65620)
  (func $counter_instructions (type $t3) (result i32)
    i32.const 0
    i32.load offset=67700)
  (func $counter_link_sections (type $t3) (result i32)
    i32.const 4
    i32.const 0
    i32.const 0
    i32.load8_u offset=65616
    select)
  (func $counter_vfs_reads (type $t3) (result i32)
    i32.const 0
    i32.load offset=65588)
  (func $counter_allocations (type $t3) (result i32)
    i32.const 0)
  (func $counter_boundary_crossings (type $t3) (result i32)
    i32.const 0
    i32.load offset=65584)
  (func $counter_output_bytes (type $t3) (result i32)
    i32.const 0
    i32.load offset=67680)
  (func $f16 (type $t2) (param $p0 i32) (result i32)
    (local $l1 i32) (local $l2 i32) (local $l3 i32) (local $l4 i32) (local $l5 i32) (local $l6 i32) (local $l7 i32)
    global.get $g0
    i32.const 16
    i32.sub
    local.tee $l1
    global.set $g0
    block $B0
      block $B1
        local.get $p0
        call $f17
        i32.eqz
        br_if $B1
        i32.const 0
        i32.load offset=65596
        local.set $l2
        i32.const 0
        i32.load offset=65600
        local.set $l3
        loop $L2
          block $B3
            i32.const 0
            i32.load offset=65604
            local.tee $l4
            local.get $l3
            i32.ge_u
            br_if $B3
            loop $L4
              local.get $l2
              local.get $l4
              i32.add
              i32.load8_u
              i32.const -9
              i32.add
              local.tee $l5
              i32.const 23
              i32.gt_u
              br_if $B3
              i32.const 1
              local.get $l5
              i32.shl
              i32.const 8388627
              i32.and
              i32.eqz
              br_if $B3
              i32.const 0
              local.get $l4
              i32.const 1
              i32.add
              local.tee $l4
              i32.store offset=65604
              local.get $l3
              local.get $l4
              i32.ne
              br_if $L4
            end
            local.get $l3
            local.set $l4
          end
          block $B5
            block $B6
              local.get $l4
              i32.const 1
              i32.add
              local.tee $l5
              local.get $l3
              i32.ge_u
              br_if $B6
              local.get $l2
              local.get $l4
              i32.add
              i32.load8_u
              i32.const 60
              i32.ne
              br_if $B6
              local.get $l2
              local.get $l5
              i32.add
              i32.load8_u
              i32.const 60
              i32.ne
              br_if $B6
              i32.const 116
              local.set $l6
              i32.const 0
              local.set $l7
              br $B5
            end
            block $B7
              local.get $l4
              local.get $l3
              i32.ge_u
              br_if $B7
              block $B8
                loop $L9
                  local.get $l2
                  local.get $l4
                  i32.add
                  i32.load8_u
                  i32.const -9
                  i32.add
                  local.tee $l5
                  i32.const 23
                  i32.gt_u
                  br_if $B8
                  i32.const 1
                  local.get $l5
                  i32.shl
                  i32.const 8388627
                  i32.and
                  i32.eqz
                  br_if $B8
                  i32.const 0
                  local.get $l4
                  i32.const 1
                  i32.add
                  local.tee $l4
                  i32.store offset=65604
                  local.get $l3
                  local.get $l4
                  i32.ne
                  br_if $L9
                end
                local.get $l3
                local.set $l4
              end
              local.get $l4
              i32.const 1
              i32.add
              local.set $l5
            end
            i32.const 1
            local.set $l7
            local.get $l5
            local.get $l3
            i32.ge_u
            br_if $B0
            local.get $l2
            local.get $l4
            i32.add
            i32.load8_u
            i32.const 62
            i32.ne
            br_if $B0
            i32.const 1
            local.set $l7
            local.get $l2
            local.get $l5
            i32.add
            i32.load8_u
            i32.const 62
            i32.ne
            br_if $B0
            i32.const 117
            local.set $l6
          end
          i32.const 0
          local.get $l4
          i32.const 2
          i32.add
          i32.store offset=65604
          i32.const 0
          i32.const 0
          i32.load offset=67692
          i32.const 1
          i32.add
          i32.store offset=67692
          local.get $l1
          i32.const 12
          i32.add
          call $f17
          i32.eqz
          br_if $B1
          local.get $l1
          i32.load offset=12
          local.tee $l5
          i32.const 32
          i32.ge_u
          br_if $B1
          block $B10
            block $B11
              i32.const 0
              i32.load offset=65612
              local.tee $l4
              i32.const 2047
              i32.gt_u
              br_if $B11
              local.get $l4
              local.get $l6
              i32.store8 offset=65632
              i32.const 0
              local.get $l4
              i32.const 1
              i32.add
              i32.store offset=65612
              br $B10
            end
            i32.const 0
            i32.const 1
            i32.store8 offset=65608
          end
          i32.const 0
          i32.const 0
          i32.load offset=67696
          i32.const 1
          i32.add
          i32.store offset=67696
          i32.const 0
          i32.const 0
          i32.load offset=67700
          i32.const 1
          i32.add
          i32.store offset=67700
          local.get $p0
          i32.load
          local.set $l4
          block $B12
            local.get $l7
            br_if $B12
            local.get $p0
            local.get $l4
            local.get $l5
            i32.shl
            i32.store
            br $L2
          end
          block $B13
            local.get $l5
            i32.eqz
            br_if $B13
            local.get $l4
            local.get $l5
            i32.shr_u
            local.set $l7
            block $B14
              local.get $l4
              i32.const -1
              i32.le_s
              br_if $B14
              local.get $p0
              local.get $l7
              i32.store
              br $L2
            end
            local.get $l7
            i32.const -1
            i32.const 32
            local.get $l5
            i32.sub
            i32.shl
            i32.or
            local.set $l4
          end
          local.get $p0
          local.get $l4
          i32.store
          br $L2
        end
      end
      i32.const 0
      local.set $l7
    end
    local.get $l1
    i32.const 16
    i32.add
    global.set $g0
    local.get $l7)
  (func $f17 (type $t2) (param $p0 i32) (result i32)
    (local $l1 i32) (local $l2 i32) (local $l3 i32) (local $l4 i32) (local $l5 i32) (local $l6 i32) (local $l7 i32)
    global.get $g0
    i32.const 16
    i32.sub
    local.tee $l1
    global.set $g0
    block $B0
      block $B1
        local.get $p0
        call $f18
        i32.eqz
        br_if $B1
        i32.const 0
        i32.load offset=65596
        local.set $l2
        i32.const 0
        i32.load offset=65600
        local.set $l3
        block $B2
          loop $L3
            block $B4
              i32.const 0
              i32.load offset=65604
              local.tee $l4
              local.get $l3
              i32.ge_u
              br_if $B4
              loop $L5
                local.get $l2
                local.get $l4
                i32.add
                i32.load8_u
                i32.const -9
                i32.add
                local.tee $l5
                i32.const 23
                i32.gt_u
                br_if $B4
                i32.const 1
                local.get $l5
                i32.shl
                i32.const 8388627
                i32.and
                i32.eqz
                br_if $B4
                i32.const 0
                local.get $l4
                i32.const 1
                i32.add
                local.tee $l4
                i32.store offset=65604
                local.get $l3
                local.get $l4
                i32.ne
                br_if $L5
              end
              local.get $l3
              local.set $l4
              br $B2
            end
            local.get $l4
            local.get $l3
            i32.ge_u
            br_if $B2
            local.get $l2
            local.get $l4
            i32.add
            i32.load8_u
            i32.const 42
            i32.ne
            br_if $B2
            i32.const 0
            local.get $l4
            i32.const 1
            i32.add
            i32.store offset=65604
            i32.const 0
            i32.const 0
            i32.load offset=67692
            i32.const 1
            i32.add
            i32.store offset=67692
            local.get $l1
            i32.const 8
            i32.add
            call $f18
            i32.eqz
            br_if $B1
            block $B6
              block $B7
                i32.const 0
                i32.load offset=65612
                local.tee $l4
                i32.const 2047
                i32.gt_u
                br_if $B7
                local.get $l4
                i32.const 108
                i32.store8 offset=65632
                i32.const 0
                local.get $l4
                i32.const 1
                i32.add
                i32.store offset=65612
                br $B6
              end
              i32.const 0
              i32.const 1
              i32.store8 offset=65608
            end
            i32.const 0
            i32.const 0
            i32.load offset=67696
            i32.const 1
            i32.add
            i32.store offset=67696
            i32.const 0
            i32.const 0
            i32.load offset=67700
            i32.const 1
            i32.add
            i32.store offset=67700
            local.get $p0
            local.get $l1
            i32.load offset=8
            local.get $p0
            i32.load
            i32.mul
            i32.store
            br $L3
          end
        end
        loop $L8
          block $B9
            local.get $l4
            local.get $l3
            i32.ge_u
            br_if $B9
            loop $L10
              local.get $l2
              local.get $l4
              i32.add
              i32.load8_u
              i32.const -9
              i32.add
              local.tee $l5
              i32.const 23
              i32.gt_u
              br_if $B9
              i32.const 1
              local.get $l5
              i32.shl
              i32.const 8388627
              i32.and
              i32.eqz
              br_if $B9
              i32.const 1
              local.set $l5
              i32.const 0
              local.get $l4
              i32.const 1
              i32.add
              local.tee $l4
              i32.store offset=65604
              local.get $l3
              local.get $l4
              i32.ne
              br_if $L10
              br $B0
            end
          end
          i32.const 1
          local.set $l5
          local.get $l4
          local.get $l3
          i32.ge_u
          br_if $B0
          block $B11
            local.get $l2
            local.get $l4
            i32.add
            i32.load8_u
            local.tee $l6
            i32.const -43
            i32.add
            br_table $B11 $B0 $B11 $B0
          end
          i32.const 0
          local.get $l4
          i32.const 1
          i32.add
          i32.store offset=65604
          i32.const 0
          i32.const 0
          i32.load offset=67692
          i32.const 1
          i32.add
          i32.store offset=67692
          local.get $l1
          i32.const 4
          i32.add
          call $f18
          i32.eqz
          br_if $B1
          local.get $l1
          i32.load offset=4
          local.set $l7
          block $B12
            loop $L13
              block $B14
                i32.const 0
                i32.load offset=65604
                local.tee $l4
                local.get $l3
                i32.ge_u
                br_if $B14
                loop $L15
                  local.get $l2
                  local.get $l4
                  i32.add
                  i32.load8_u
                  i32.const -9
                  i32.add
                  local.tee $l5
                  i32.const 23
                  i32.gt_u
                  br_if $B14
                  i32.const 1
                  local.get $l5
                  i32.shl
                  i32.const 8388627
                  i32.and
                  i32.eqz
                  br_if $B14
                  i32.const 0
                  local.get $l4
                  i32.const 1
                  i32.add
                  local.tee $l4
                  i32.store offset=65604
                  local.get $l3
                  local.get $l4
                  i32.ne
                  br_if $L15
                end
                local.get $l3
                local.set $l4
                br $B12
              end
              local.get $l4
              local.get $l3
              i32.ge_u
              br_if $B12
              local.get $l2
              local.get $l4
              i32.add
              i32.load8_u
              i32.const 42
              i32.ne
              br_if $B12
              i32.const 0
              local.get $l4
              i32.const 1
              i32.add
              i32.store offset=65604
              i32.const 0
              i32.const 0
              i32.load offset=67692
              i32.const 1
              i32.add
              i32.store offset=67692
              local.get $l1
              i32.const 12
              i32.add
              call $f18
              i32.eqz
              br_if $B1
              block $B16
                block $B17
                  i32.const 0
                  i32.load offset=65612
                  local.tee $l4
                  i32.const 2047
                  i32.gt_u
                  br_if $B17
                  local.get $l4
                  i32.const 108
                  i32.store8 offset=65632
                  i32.const 0
                  local.get $l4
                  i32.const 1
                  i32.add
                  i32.store offset=65612
                  br $B16
                end
                i32.const 0
                i32.const 1
                i32.store8 offset=65608
              end
              i32.const 0
              i32.const 0
              i32.load offset=67696
              i32.const 1
              i32.add
              i32.store offset=67696
              i32.const 0
              i32.const 0
              i32.load offset=67700
              i32.const 1
              i32.add
              i32.store offset=67700
              local.get $l1
              i32.load offset=12
              local.get $l7
              i32.mul
              local.set $l7
              br $L13
            end
          end
          block $B18
            block $B19
              i32.const 0
              i32.load offset=65612
              local.tee $l5
              i32.const 2047
              i32.gt_u
              br_if $B19
              i32.const 0
              local.get $l5
              i32.const 1
              i32.add
              i32.store offset=65612
              local.get $l5
              i32.const 106
              i32.const 107
              local.get $l6
              i32.const 43
              i32.eq
              select
              i32.store8 offset=65632
              br $B18
            end
            i32.const 0
            i32.const 1
            i32.store8 offset=65608
          end
          i32.const 0
          i32.const 0
          i32.load offset=67696
          i32.const 1
          i32.add
          i32.store offset=67696
          i32.const 0
          i32.const 0
          i32.load offset=67700
          i32.const 1
          i32.add
          i32.store offset=67700
          local.get $p0
          local.get $p0
          i32.load
          local.get $l7
          i32.const 0
          local.get $l7
          i32.sub
          local.get $l6
          i32.const 43
          i32.eq
          select
          i32.add
          i32.store
          br $L8
        end
      end
      i32.const 0
      local.set $l5
    end
    local.get $l1
    i32.const 16
    i32.add
    global.set $g0
    local.get $l5)
  (func $f18 (type $t2) (param $p0 i32) (result i32)
    (local $l1 i32) (local $l2 i32) (local $l3 i32) (local $l4 i32) (local $l5 i32) (local $l6 i32)
    block $B0
      block $B1
        block $B2
          block $B3
            i32.const 0
            i32.load offset=65604
            local.tee $l1
            i32.const 0
            i32.load offset=65600
            local.tee $l2
            i32.ge_u
            br_if $B3
            i32.const 0
            i32.load offset=65596
            local.set $l3
            loop $L4
              local.get $l3
              local.get $l1
              i32.add
              i32.load8_u
              i32.const -9
              i32.add
              local.tee $l4
              i32.const 23
              i32.gt_u
              br_if $B3
              i32.const 1
              local.get $l4
              i32.shl
              i32.const 8388627
              i32.and
              i32.eqz
              br_if $B3
              i32.const 0
              local.get $l1
              i32.const 1
              i32.add
              local.tee $l1
              i32.store offset=65604
              local.get $l2
              local.get $l1
              i32.ne
              br_if $L4
              br $B2
            end
          end
          block $B5
            local.get $l1
            local.get $l2
            i32.ge_u
            br_if $B5
            i32.const 0
            i32.load offset=65596
            local.set $l3
            loop $L6
              local.get $l3
              local.get $l1
              i32.add
              i32.load8_u
              i32.const -9
              i32.add
              local.tee $l4
              i32.const 23
              i32.gt_u
              br_if $B5
              i32.const 1
              local.get $l4
              i32.shl
              i32.const 8388627
              i32.and
              i32.eqz
              br_if $B5
              i32.const 0
              local.get $l1
              i32.const 1
              i32.add
              local.tee $l1
              i32.store offset=65604
              local.get $l2
              local.get $l1
              i32.eq
              br_if $B2
              br $L6
            end
          end
          block $B7
            local.get $l1
            local.get $l2
            i32.ge_u
            local.tee $l5
            br_if $B7
            i32.const 0
            local.set $l4
            i32.const 0
            i32.load offset=65596
            local.tee $l3
            local.get $l1
            i32.add
            i32.load8_u
            i32.const 40
            i32.ne
            br_if $B7
            i32.const 0
            local.get $l1
            i32.const 1
            i32.add
            i32.store offset=65604
            i32.const 0
            i32.const 0
            i32.load offset=67692
            i32.const 1
            i32.add
            i32.store offset=67692
            local.get $p0
            call $f3
            i32.eqz
            br_if $B0
            block $B8
              i32.const 0
              i32.load offset=65604
              local.tee $l1
              local.get $l2
              i32.ge_u
              br_if $B8
              loop $L9
                local.get $l3
                local.get $l1
                i32.add
                i32.load8_u
                i32.const -9
                i32.add
                local.tee $l4
                i32.const 23
                i32.gt_u
                br_if $B8
                i32.const 1
                local.get $l4
                i32.shl
                i32.const 8388627
                i32.and
                i32.eqz
                br_if $B8
                i32.const 0
                local.set $l4
                i32.const 0
                local.get $l1
                i32.const 1
                i32.add
                local.tee $l1
                i32.store offset=65604
                local.get $l2
                local.get $l1
                i32.ne
                br_if $L9
                br $B0
              end
            end
            block $B10
              local.get $l1
              local.get $l2
              i32.lt_u
              br_if $B10
              i32.const 0
              return
            end
            i32.const 0
            local.set $l4
            local.get $l3
            local.get $l1
            i32.add
            i32.load8_u
            i32.const 41
            i32.ne
            br_if $B0
            i32.const 0
            local.get $l1
            i32.const 1
            i32.add
            i32.store offset=65604
            i32.const 0
            i32.const 0
            i32.load offset=67692
            i32.const 1
            i32.add
            i32.store offset=67692
            i32.const 1
            return
          end
          block $B11
            local.get $l5
            br_if $B11
            i32.const 0
            i32.load offset=65596
            local.set $l3
            loop $L12
              local.get $l3
              local.get $l1
              i32.add
              i32.load8_u
              i32.const -9
              i32.add
              local.tee $l4
              i32.const 23
              i32.gt_u
              br_if $B11
              i32.const 1
              local.get $l4
              i32.shl
              i32.const 8388627
              i32.and
              i32.eqz
              br_if $B11
              i32.const 0
              local.get $l1
              i32.const 1
              i32.add
              local.tee $l1
              i32.store offset=65604
              local.get $l2
              local.get $l1
              i32.eq
              br_if $B2
              br $L12
            end
          end
          block $B13
            local.get $l1
            local.get $l2
            i32.ge_u
            local.tee $l4
            br_if $B13
            i32.const 0
            i32.load offset=65596
            local.get $l1
            i32.add
            i32.load8_u
            i32.const 45
            i32.ne
            br_if $B13
            i32.const 0
            local.get $l1
            i32.const 1
            i32.add
            i32.store offset=65604
            i32.const 0
            i32.const 0
            i32.load offset=67692
            i32.const 1
            i32.add
            i32.store offset=67692
            block $B14
              block $B15
                i32.const 0
                i32.load offset=65612
                local.tee $l1
                i32.const 2047
                i32.gt_u
                br_if $B15
                local.get $l1
                i32.const 65
                i32.store8 offset=65632
                i32.const 0
                local.get $l1
                i32.const 1
                i32.add
                i32.store offset=65612
                local.get $l1
                i32.const 2047
                i32.eq
                br_if $B15
                local.get $l1
                i32.const 65633
                i32.add
                i32.const 0
                i32.store8
                i32.const 0
                local.get $l1
                i32.const 2
                i32.add
                i32.store offset=65612
                br $B14
              end
              i32.const 0
              i32.const 1
              i32.store8 offset=65608
            end
            i32.const 0
            local.set $l4
            i32.const 0
            i32.const 0
            i32.load offset=67700
            i32.const 1
            i32.add
            i32.store offset=67700
            local.get $p0
            call $f18
            i32.eqz
            br_if $B0
            block $B16
              block $B17
                i32.const 0
                i32.load offset=65612
                local.tee $l1
                i32.const 2047
                i32.gt_u
                br_if $B17
                local.get $l1
                i32.const 107
                i32.store8 offset=65632
                i32.const 0
                local.get $l1
                i32.const 1
                i32.add
                i32.store offset=65612
                br $B16
              end
              i32.const 0
              i32.const 1
              i32.store8 offset=65608
            end
            i32.const 0
            i32.const 0
            i32.load offset=67696
            i32.const 1
            i32.add
            i32.store offset=67696
            i32.const 0
            i32.const 0
            i32.load offset=67700
            i32.const 1
            i32.add
            i32.store offset=67700
            local.get $p0
            i32.const 0
            local.get $p0
            i32.load
            i32.sub
            i32.store
            i32.const 1
            return
          end
          local.get $l4
          br_if $B1
          i32.const 0
          local.set $l5
          block $B18
            i32.const 0
            i32.load offset=65596
            local.tee $l3
            local.get $l1
            i32.add
            i32.load8_u
            i32.const -58
            i32.add
            i32.const 255
            i32.and
            i32.const 246
            i32.ge_u
            br_if $B18
            loop $L19
              local.get $l3
              local.get $l1
              i32.add
              i32.load8_u
              i32.const -9
              i32.add
              local.tee $l4
              i32.const 23
              i32.gt_u
              br_if $B1
              i32.const 1
              local.get $l4
              i32.shl
              i32.const 8388627
              i32.and
              i32.eqz
              br_if $B1
              i32.const 0
              local.get $l1
              i32.const 1
              i32.add
              local.tee $l1
              i32.store offset=65604
              local.get $l2
              local.get $l1
              i32.eq
              br_if $B2
              br $L19
            end
          end
          block $B20
            loop $L21
              local.get $l3
              local.get $l1
              i32.add
              i32.load8_u
              local.tee $l6
              i32.const -58
              i32.add
              i32.const 255
              i32.and
              i32.const 246
              i32.lt_u
              br_if $B20
              i32.const 0
              local.set $l4
              i32.const 0
              local.get $l1
              i32.const 1
              i32.add
              local.tee $l1
              i32.store offset=65604
              local.get $l5
              i32.const 214748364
              i32.gt_u
              br_if $B0
              block $B22
                local.get $l5
                i32.const 214748364
                i32.ne
                br_if $B22
                local.get $l6
                i32.const 55
                i32.gt_u
                br_if $B0
              end
              local.get $l6
              i32.const -48
              i32.add
              local.get $l5
              i32.const 10
              i32.mul
              i32.add
              local.set $l5
              local.get $l2
              local.get $l1
              i32.ne
              br_if $L21
            end
          end
          i32.const 0
          i32.const 0
          i32.load offset=67692
          i32.const 1
          i32.add
          i32.store offset=67692
          block $B23
            block $B24
              i32.const 0
              i32.load offset=65612
              local.tee $l3
              i32.const 2047
              i32.gt_u
              br_if $B24
              local.get $l3
              i32.const 65
              i32.store8 offset=65632
              i32.const 0
              local.get $l3
              i32.const 1
              i32.add
              local.tee $l3
              i32.store offset=65612
              br $B23
            end
            i32.const 0
            i32.const 1
            i32.store8 offset=65608
          end
          local.get $l5
          local.set $l1
          loop $L25
            local.get $l1
            i32.const 127
            i32.and
            local.set $l2
            block $B26
              block $B27
                local.get $l1
                i32.const 7
                i32.shr_s
                local.tee $l4
                local.get $l1
                i32.const 64
                i32.and
                local.tee $l1
                i32.or
                br_if $B27
                i32.const 1
                local.set $l6
                br $B26
              end
              i32.const 0
              i32.const -128
              local.get $l4
              i32.const -1
              i32.eq
              local.get $l1
              i32.const 0
              i32.ne
              i32.and
              local.tee $l6
              i32.const 1
              i32.and
              select
              local.get $l2
              i32.or
              local.set $l2
            end
            block $B28
              block $B29
                local.get $l3
                i32.const 2047
                i32.gt_u
                br_if $B29
                local.get $l3
                local.get $l2
                i32.store8 offset=65632
                i32.const 0
                local.get $l3
                i32.const 1
                i32.add
                local.tee $l3
                i32.store offset=65612
                br $B28
              end
              i32.const 0
              i32.const 1
              i32.store8 offset=65608
            end
            local.get $l4
            local.set $l1
            local.get $l6
            i32.const 1
            i32.and
            i32.eqz
            br_if $L25
          end
          i32.const 0
          i32.const 0
          i32.load offset=67696
          i32.const 1
          i32.add
          i32.store offset=67696
          i32.const 0
          i32.const 0
          i32.load offset=67700
          i32.const 1
          i32.add
          i32.store offset=67700
          local.get $p0
          local.get $l5
          i32.store
          i32.const 1
          return
        end
        local.get $l2
        local.set $l1
      end
      i32.const 0
      local.set $l4
      local.get $l1
      i32.const 4
      i32.add
      local.tee $l3
      local.get $l2
      i32.gt_u
      br_if $B0
      i32.const 0
      local.set $l4
      i32.const 0
      i32.load offset=65596
      local.tee $l5
      local.get $l1
      i32.add
      local.tee $l1
      i32.load8_u
      i32.const 66
      i32.ne
      br_if $B0
      local.get $l1
      i32.load8_u offset=1
      i32.const 65
      i32.ne
      br_if $B0
      local.get $l1
      i32.load8_u offset=2
      i32.const 83
      i32.ne
      br_if $B0
      local.get $l1
      i32.load8_u offset=3
      i32.const 69
      i32.ne
      br_if $B0
      block $B30
        local.get $l3
        local.get $l2
        i32.ge_u
        br_if $B30
        local.get $l5
        local.get $l3
        i32.add
        i32.load8_u
        local.tee $l1
        i32.const 95
        i32.eq
        br_if $B0
        local.get $l1
        i32.const 223
        i32.and
        i32.const -91
        i32.add
        i32.const 255
        i32.and
        i32.const 229
        i32.gt_u
        br_if $B0
        local.get $l1
        i32.const -58
        i32.add
        i32.const 255
        i32.and
        i32.const 245
        i32.gt_u
        br_if $B0
      end
      i32.const 0
      local.get $l3
      i32.store offset=65604
      i32.const 0
      i32.const 0
      i32.load offset=67692
      i32.const 1
      i32.add
      i32.store offset=67692
      block $B31
        block $B32
          i32.const 0
          i32.load offset=65612
          local.tee $l3
          i32.const 2047
          i32.gt_u
          br_if $B32
          local.get $l3
          i32.const 65
          i32.store8 offset=65632
          i32.const 0
          local.get $l3
          i32.const 1
          i32.add
          local.tee $l3
          i32.store offset=65612
          br $B31
        end
        i32.const 0
        i32.const 1
        i32.store8 offset=65608
      end
      i32.const 0
      i32.load offset=65592
      local.tee $l6
      local.set $l1
      loop $L33
        local.get $l1
        i32.const 127
        i32.and
        local.set $l2
        block $B34
          block $B35
            local.get $l1
            i32.const 7
            i32.shr_s
            local.tee $l4
            local.get $l1
            i32.const 64
            i32.and
            local.tee $l1
            i32.or
            br_if $B35
            i32.const 1
            local.set $l5
            br $B34
          end
          i32.const 0
          i32.const -128
          local.get $l4
          i32.const -1
          i32.eq
          local.get $l1
          i32.const 0
          i32.ne
          i32.and
          local.tee $l5
          i32.const 1
          i32.and
          select
          local.get $l2
          i32.or
          local.set $l2
        end
        block $B36
          block $B37
            local.get $l3
            i32.const 2047
            i32.gt_u
            br_if $B37
            local.get $l3
            local.get $l2
            i32.store8 offset=65632
            i32.const 0
            local.get $l3
            i32.const 1
            i32.add
            local.tee $l3
            i32.store offset=65612
            br $B36
          end
          i32.const 0
          i32.const 1
          i32.store8 offset=65608
        end
        local.get $l4
        local.set $l1
        local.get $l5
        i32.const 1
        i32.and
        i32.eqz
        br_if $L33
      end
      i32.const 1
      local.set $l4
      i32.const 0
      i32.const 0
      i32.load offset=67696
      i32.const 1
      i32.add
      i32.store offset=67696
      i32.const 0
      i32.const 0
      i32.load offset=67700
      i32.const 1
      i32.add
      i32.store offset=67700
      local.get $p0
      local.get $l6
      i32.store
    end
    local.get $l4)
  (table $T0 1 1 funcref)
  (memory $memory 4 4)
  (global $g0 (mut i32) (i32.const 65536))
  (export "memory" (memory $memory))
  (export "compile_c" (func $compile_c))
  (export "counter_source_bytes" (func $counter_source_bytes))
  (export "counter_header_bytes" (func $counter_header_bytes))
  (export "counter_tokens" (func $counter_tokens))
  (export "counter_ast_nodes" (func $counter_ast_nodes))
  (export "counter_functions" (func $counter_functions))
  (export "counter_instructions" (func $counter_instructions))
  (export "counter_link_sections" (func $counter_link_sections))
  (export "counter_vfs_reads" (func $counter_vfs_reads))
  (export "counter_allocations" (func $counter_allocations))
  (export "counter_boundary_crossings" (func $counter_boundary_crossings))
  (export "counter_output_bytes" (func $counter_output_bytes))
  (data $d0 (i32.const 65536) "test\00int\00return\00void\00\01\05\01`\00\01\7f\07\08\01\04test\00\00"))
