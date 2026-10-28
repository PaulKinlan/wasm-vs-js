;; simulation.rigid-body-2d.v1 — kernel: rigid_engine
;; WebAssembly Text (WAT) baseline implementation
;; Exports: rigid_engine

(module $rigid_c.wasm
  (type $t0 (func))
  (type $t1 (func (result i32)))
  (type $t2 (func (param i32 i32) (result i32)))
  (type $t3 (func (param i32 i32 i32) (result i32)))
  (func $__wasm_call_ctors (type $t0))
  (func $fixture_ptr (type $t1) (result i32)
    i32.const 65536)
  (func $result_ptr (type $t1) (result i32)
    i32.const 88240)
  (func $run (type $t2) (param $p0 i32) (param $p1 i32) (result i32)
    (local $l2 i32) (local $l3 i32) (local $l4 i32) (local $l5 i32) (local $l6 f32) (local $l7 f32) (local $l8 f32) (local $l9 f32) (local $l10 f32) (local $l11 f32) (local $l12 i32) (local $l13 i32) (local $l14 i32) (local $l15 i32) (local $l16 i32) (local $l17 f32) (local $l18 f32) (local $l19 f32) (local $l20 i32) (local $l21 i32) (local $l22 i32) (local $l23 i32) (local $l24 f32) (local $l25 i32) (local $l26 i32) (local $l27 i32) (local $l28 i32) (local $l29 i32) (local $l30 i32) (local $l31 f32) (local $l32 f32) (local $l33 f32) (local $l34 f32) (local $l35 f32) (local $l36 f32) (local $l37 f32) (local $l38 f32) (local $l39 f32) (local $l40 f32) (local $l41 f32) (local $l42 f32) (local $l43 f32) (local $l44 f32) (local $l45 i32) (local $l46 i32) (local $l47 i32) (local $l48 f32) (local $l49 f32) (local $l50 i32) (local $l51 i32) (local $l52 i32)
    global.get $__stack_pointer
    i32.const 32
    i32.sub
    local.tee $l2
    global.set $__stack_pointer
    i32.const 1
    local.set $l3
    block $B0
      i32.const 0
      i32.load offset=65544
      i32.const 2
      i32.ne
      br_if $B0
      i32.const 0
      i32.load offset=65548
      i32.const 500
      i32.ne
      br_if $B0
      local.get $p1
      i32.eqz
      br_if $B0
      local.get $p0
      i32.const -1801
      i32.add
      i32.const -1800
      i32.lt_u
      br_if $B0
      i32.const 0
      i32.load offset=65552
      local.tee $l4
      i32.const 19
      i32.gt_u
      br_if $B0
      local.get $p0
      local.get $p1
      i32.add
      i32.const -1
      i32.add
      local.get $p1
      i32.div_u
      i32.const 6
      i32.gt_u
      br_if $B0
      i32.const 0
      local.set $l5
      i32.const 0
      i64.const 0
      i64.store offset=88240 align=4
      i32.const 0
      i64.const 0
      i64.store offset=88248 align=4
      i32.const 0
      i64.const 0
      i64.store offset=88256 align=4
      i32.const 0
      i64.const 0
      i64.store offset=88264 align=4
      i32.const 0
      i64.const 0
      i64.store offset=88272 align=4
      i32.const 0
      i64.const 0
      i64.store offset=88280 align=4
      i32.const 0
      i64.const 0
      i64.store offset=88288 align=4
      i32.const 0
      i64.const 0
      i64.store offset=88296 align=4
      i32.const 0
      f32.load offset=65600
      local.set $l6
      i32.const 0
      f32.load offset=65596
      local.set $l7
      i32.const 0
      f32.load offset=65588
      local.set $l8
      i32.const 0
      f32.load offset=65584
      local.set $l9
      i32.const 0
      f32.load offset=65580
      local.set $l10
      i32.const 0
      f32.load offset=65576
      local.set $l11
      i32.const 0
      i32.load offset=65604
      local.set $l12
      i32.const 0
      i32.load offset=65564
      local.set $l13
      i32.const 0
      i32.load offset=65560
      local.set $l14
      i32.const 65536
      local.set $l15
      i32.const 0
      local.set $l16
      loop $L1
        local.get $l5
        i32.const 160304
        i32.add
        local.get $l15
        i32.const 96
        i32.add
        f32.load
        f32.store
        local.get $l5
        i32.const 162304
        i32.add
        local.get $l15
        i32.const 100
        i32.add
        f32.load
        f32.store
        local.get $l5
        i32.const 164304
        i32.add
        local.get $l15
        i32.const 104
        i32.add
        f32.load
        f32.store
        local.get $l5
        i32.const 166304
        i32.add
        local.get $l15
        i32.const 108
        i32.add
        f32.load
        f32.store
        local.get $l5
        i32.const 168304
        i32.add
        local.get $l15
        i32.const 112
        i32.add
        f32.load
        f32.store
        local.get $l5
        i32.const 170304
        i32.add
        local.get $l15
        i32.const 116
        i32.add
        f32.load
        f32.store
        local.get $l5
        i32.const 172304
        i32.add
        local.get $l15
        i32.const 120
        i32.add
        f32.load
        f32.store
        local.get $l5
        i32.const 174304
        i32.add
        local.get $l15
        i32.const 124
        i32.add
        f32.load
        f32.store
        local.get $l5
        i32.const 176304
        i32.add
        local.get $l15
        i32.const 128
        i32.add
        f32.load
        f32.store
        local.get $l5
        i32.const 178304
        i32.add
        local.get $l15
        i32.const 132
        i32.add
        f32.load
        f32.store
        local.get $l5
        i32.const 182304
        i32.add
        local.get $l16
        i32.store
        local.get $l5
        i32.const 180304
        i32.add
        local.get $l15
        i32.const 136
        i32.add
        f32.load
        f32.store
        local.get $l15
        i32.const 44
        i32.add
        local.set $l15
        local.get $l16
        i32.const 1
        i32.add
        local.set $l16
        local.get $l5
        i32.const 4
        i32.add
        local.tee $l5
        i32.const 2000
        i32.ne
        br_if $L1
      end
      block $B2
        local.get $l4
        i32.eqz
        br_if $B2
        i32.const 65536
        local.set $l5
        i32.const 0
        local.set $l15
        local.get $l4
        local.set $l16
        loop $L3
          local.get $l15
          i32.const 184304
          i32.add
          local.get $l5
          i32.const 22096
          i32.add
          i32.load
          i32.store
          local.get $l15
          i32.const 184384
          i32.add
          local.get $l5
          i32.const 22100
          i32.add
          i32.load
          i32.store
          local.get $l15
          i32.const 184464
          i32.add
          local.get $l5
          i32.const 22104
          i32.add
          f32.load
          f32.store
          local.get $l15
          i32.const 184544
          i32.add
          local.get $l5
          i32.const 22108
          i32.add
          f32.load
          f32.store
          local.get $l15
          i32.const 184624
          i32.add
          local.get $l5
          i32.const 22112
          i32.add
          f32.load
          f32.store
          local.get $l15
          i32.const 184704
          i32.add
          local.get $l5
          i32.const 22116
          i32.add
          f32.load
          f32.store
          local.get $l15
          i32.const 184784
          i32.add
          local.get $l5
          i32.const 22120
          i32.add
          f32.load
          f32.store
          local.get $l15
          i32.const 184864
          i32.add
          local.get $l5
          i32.const 22124
          i32.add
          f32.load
          f32.store
          local.get $l15
          i32.const 4
          i32.add
          local.set $l15
          local.get $l5
          i32.const 32
          i32.add
          local.set $l5
          local.get $l16
          i32.const -1
          i32.add
          local.tee $l16
          br_if $L3
        end
      end
      local.get $l11
      local.get $l10
      f32.mul
      local.set $l17
      local.get $l9
      f32.const 0x1p+0 (;=1;)
      f32.add
      f32.neg
      local.set $l18
      local.get $l8
      f32.neg
      local.set $l19
      i32.const 0
      local.set $l20
      i32.const 0
      local.set $l21
      loop $L4
        i32.const 0
        i32.load offset=88276
        local.set $l22
        local.get $l20
        local.get $l12
        i32.ge_u
        local.set $l23
        i32.const 0
        local.set $l15
        loop $L5
          local.get $l15
          i32.const 2
          i32.shl
          local.tee $l5
          i32.const 168304
          i32.add
          local.set $l16
          local.get $l17
          local.get $l5
          f32.load offset=168304
          f32.add
          local.set $l9
          block $B6
            local.get $l23
            br_if $B6
            local.get $l5
            f32.load offset=180304
            local.tee $l10
            f32.const 0x0p+0 (;=0;)
            f32.eq
            br_if $B6
            i32.const 0
            local.get $l22
            i32.const 1
            i32.add
            local.tee $l22
            i32.store offset=88276
            local.get $l5
            local.get $l5
            f32.load offset=170304
            local.get $l11
            local.get $l10
            local.get $l5
            f32.load offset=174304
            f32.mul
            f32.mul
            f32.add
            f32.store offset=170304
          end
          local.get $l16
          local.get $l7
          local.get $l9
          f32.mul
          local.tee $l9
          f32.store
          local.get $l5
          local.get $l7
          local.get $l5
          f32.load offset=166304
          f32.mul
          local.tee $l10
          f32.store offset=166304
          local.get $l5
          local.get $l6
          local.get $l5
          f32.load offset=170304
          f32.mul
          local.tee $l24
          f32.store offset=170304
          local.get $l5
          local.get $l11
          local.get $l9
          f32.mul
          local.get $l5
          f32.load offset=162304
          f32.add
          f32.store offset=162304
          local.get $l5
          local.get $l11
          local.get $l10
          f32.mul
          local.get $l5
          f32.load offset=160304
          f32.add
          f32.store offset=160304
          block $B7
            local.get $l11
            local.get $l24
            f32.mul
            local.get $l5
            f32.load offset=164304
            f32.add
            local.tee $l9
            f32.const 0x1.921fb6p+1 (;=3.14159;)
            f32.gt
            i32.eqz
            br_if $B7
            loop $L8
              local.get $l9
              f32.const -0x1.921fb6p+2 (;=-6.28319;)
              f32.add
              local.tee $l9
              f32.const 0x1.921fb6p+1 (;=3.14159;)
              f32.gt
              br_if $L8
            end
          end
          local.get $l5
          i32.const 164304
          i32.add
          local.set $l5
          block $B9
            local.get $l9
            f32.const -0x1.921fb6p+1 (;=-3.14159;)
            f32.lt
            i32.eqz
            br_if $B9
            loop $L10
              local.get $l9
              f32.const 0x1.921fb6p+2 (;=6.28319;)
              f32.add
              local.tee $l9
              f32.const -0x1.921fb6p+1 (;=-3.14159;)
              f32.lt
              br_if $L10
            end
          end
          local.get $l5
          local.get $l9
          f32.store
          local.get $l15
          i32.const 1
          i32.add
          local.tee $l15
          i32.const 500
          i32.ne
          br_if $L5
        end
        call $quantize_state
        i32.const 2
        local.set $l3
        call $build_pairs
        local.tee $l25
        i32.const -1
        i32.eq
        br_if $B0
        block $B11
          local.get $l14
          i32.eqz
          br_if $B11
          i32.const 0
          local.set $l26
          loop $L12
            i32.const 0
            i32.const 0
            i32.load offset=88280
            i32.const 1
            i32.add
            i32.store offset=88280
            call $update_basis
            i32.const 0
            i32.load offset=88264
            local.set $l27
            i32.const 0
            i32.load offset=88268
            local.set $l28
            i32.const 0
            i32.load offset=88260
            local.set $l29
            i32.const 0
            i32.load offset=88256
            local.set $l22
            i32.const 0
            i32.load offset=88252
            local.set $l30
            local.get $l2
            f32.load offset=28
            local.set $l31
            local.get $l2
            f32.load offset=24
            local.set $l32
            local.get $l2
            f32.load offset=20
            local.set $l33
            local.get $l2
            f32.load offset=16
            local.set $l34
            local.get $l2
            f32.load offset=12
            local.set $l35
            i32.const 0
            local.set $l5
            loop $L13
              block $B14
                local.get $l5
                i32.const 162304
                i32.add
                f32.load
                local.tee $l36
                local.get $l5
                i32.const 256480
                i32.add
                f32.load
                local.tee $l9
                local.get $l5
                i32.const 176304
                i32.add
                f32.load
                local.tee $l10
                f32.neg
                local.get $l10
                local.get $l9
                f32.const 0x0p+0 (;=0;)
                f32.gt
                select
                local.tee $l37
                f32.mul
                local.get $l5
                i32.const 254480
                i32.add
                f32.load
                local.tee $l10
                local.get $l5
                i32.const 178304
                i32.add
                f32.load
                local.tee $l24
                f32.neg
                local.get $l24
                local.get $l10
                f32.const 0x0p+0 (;=0;)
                f32.gt
                select
                local.tee $l24
                f32.mul
                f32.add
                f32.add
                local.tee $l38
                f32.const 0x0p+0 (;=0;)
                f32.ge
                br_if $B14
                i32.const 0
                local.get $l22
                i32.const 1
                i32.add
                local.tee $l22
                i32.store offset=88256
                i32.const 0
                local.get $l30
                i32.const 1
                i32.add
                local.tee $l30
                i32.store offset=88252
                f32.const 0x0p+0 (;=0;)
                local.set $l31
                local.get $l38
                f32.neg
                local.set $l33
                f32.const -0x1p+0 (;=-1;)
                local.set $l34
                block $B15
                  f32.const 0x0p+0 (;=0;)
                  local.get $l36
                  f32.sub
                  local.tee $l35
                  local.get $l5
                  i32.const 170304
                  i32.add
                  local.tee $l15
                  f32.load
                  local.tee $l36
                  f32.mul
                  local.get $l5
                  i32.const 166304
                  i32.add
                  local.tee $l16
                  f32.load
                  local.tee $l39
                  f32.sub
                  f32.const 0x0p+0 (;=0;)
                  f32.add
                  local.tee $l40
                  f32.const 0x0p+0 (;=0;)
                  f32.mul
                  f32.const 0x0p+0 (;=0;)
                  local.get $l5
                  i32.const 168304
                  i32.add
                  local.tee $l23
                  f32.load
                  local.tee $l41
                  local.get $l10
                  local.get $l37
                  f32.mul
                  local.get $l9
                  local.get $l24
                  f32.mul
                  f32.sub
                  local.get $l5
                  i32.const 160304
                  i32.add
                  f32.load
                  local.tee $l9
                  f32.add
                  local.tee $l32
                  local.get $l9
                  f32.sub
                  local.tee $l37
                  local.get $l36
                  f32.mul
                  f32.add
                  f32.sub
                  local.tee $l42
                  f32.sub
                  local.tee $l24
                  f32.const 0x0p+0 (;=0;)
                  f32.ge
                  br_if $B15
                  local.get $l5
                  i32.const 172304
                  i32.add
                  f32.load
                  local.tee $l9
                  local.get $l5
                  i32.const 174304
                  i32.add
                  f32.load
                  local.tee $l38
                  local.get $l37
                  f32.neg
                  local.get $l35
                  f32.const 0x0p+0 (;=0;)
                  f32.mul
                  f32.sub
                  local.tee $l10
                  local.get $l10
                  f32.mul
                  f32.mul
                  f32.add
                  local.tee $l43
                  f32.const 0x0p+0 (;=0;)
                  f32.le
                  br_if $B15
                  i32.const 0
                  local.get $l29
                  i32.const 1
                  i32.add
                  local.tee $l29
                  i32.store offset=88260
                  local.get $l41
                  local.get $l24
                  local.get $l18
                  f32.mul
                  local.get $l43
                  f32.div
                  local.tee $l24
                  local.get $l9
                  f32.mul
                  f32.add
                  local.set $l41
                  local.get $l36
                  local.get $l38
                  local.get $l10
                  local.get $l24
                  f32.mul
                  f32.mul
                  f32.sub
                  local.set $l36
                  local.get $l39
                  local.get $l9
                  local.get $l24
                  f32.const 0x0p+0 (;=0;)
                  f32.mul
                  f32.mul
                  f32.sub
                  local.set $l39
                  block $B16
                    local.get $l10
                    f32.const 0x0p+0 (;=0;)
                    f32.eq
                    br_if $B16
                    i32.const 0
                    local.get $l28
                    i32.const 1
                    i32.add
                    local.tee $l28
                    i32.store offset=88268
                  end
                  i32.const 0
                  local.get $l27
                  i32.const 1
                  i32.add
                  local.tee $l27
                  i32.store offset=88264
                  f32.const 0x0p+0 (;=0;)
                  local.set $l31
                  local.get $l16
                  local.get $l39
                  local.get $l9
                  local.get $l24
                  local.get $l19
                  f32.mul
                  local.tee $l43
                  local.get $l8
                  local.get $l24
                  f32.mul
                  local.tee $l44
                  local.get $l42
                  f32.const 0x0p+0 (;=0;)
                  f32.mul
                  local.get $l40
                  f32.add
                  f32.neg
                  local.get $l9
                  local.get $l38
                  local.get $l37
                  f32.const 0x0p+0 (;=0;)
                  f32.mul
                  local.get $l35
                  f32.sub
                  local.tee $l10
                  local.get $l10
                  f32.mul
                  f32.mul
                  f32.add
                  f32.div
                  local.tee $l24
                  local.get $l24
                  local.get $l44
                  f32.gt
                  select
                  local.get $l24
                  local.get $l43
                  f32.lt
                  select
                  local.tee $l24
                  f32.mul
                  f32.sub
                  f32.store
                  local.get $l23
                  local.get $l41
                  local.get $l9
                  local.get $l24
                  f32.const 0x0p+0 (;=0;)
                  f32.mul
                  f32.mul
                  f32.sub
                  f32.store
                  local.get $l15
                  local.get $l36
                  local.get $l38
                  local.get $l10
                  local.get $l24
                  f32.mul
                  f32.mul
                  f32.sub
                  f32.store
                end
                f32.const 0x0p+0 (;=0;)
                local.set $l35
              end
              local.get $l5
              i32.const 4
              i32.add
              local.tee $l5
              i32.const 2000
              i32.ne
              br_if $L13
            end
            local.get $l2
            local.get $l31
            f32.store offset=28
            local.get $l2
            local.get $l32
            f32.store offset=24
            local.get $l2
            local.get $l33
            f32.store offset=20
            local.get $l2
            local.get $l34
            f32.store offset=16
            local.get $l2
            local.get $l35
            f32.store offset=12
            block $B17
              local.get $l25
              i32.eqz
              br_if $B17
              i32.const 0
              local.set $l15
              i32.const 0
              i32.load offset=88248
              i32.const 1
              i32.add
              local.set $l23
              local.get $l25
              local.set $l45
              loop $L18
                i32.const 0
                local.get $l23
                i32.store offset=88248
                block $B19
                  local.get $l15
                  i32.const 184944
                  i32.add
                  i32.load
                  local.tee $l5
                  local.get $l15
                  i32.const 217712
                  i32.add
                  i32.load
                  local.tee $l16
                  local.get $l2
                  i32.const 12
                  i32.add
                  call $sat
                  i32.eqz
                  br_if $B19
                  i32.const 0
                  local.get $l22
                  i32.const 1
                  i32.add
                  local.tee $l22
                  i32.store offset=88256
                  i32.const 0
                  local.get $l30
                  i32.const 1
                  i32.add
                  local.tee $l30
                  i32.store offset=88252
                  local.get $l2
                  f32.load offset=24
                  local.tee $l36
                  local.get $l5
                  i32.const 2
                  i32.shl
                  local.tee $l5
                  f32.load offset=160304
                  f32.sub
                  local.tee $l42
                  local.get $l5
                  f32.load offset=170304
                  local.tee $l43
                  f32.mul
                  local.set $l9
                  local.get $l5
                  f32.load offset=168304
                  local.set $l32
                  local.get $l2
                  f32.load offset=28
                  local.tee $l35
                  local.get $l5
                  f32.load offset=162304
                  f32.sub
                  local.tee $l33
                  local.get $l43
                  f32.mul
                  local.set $l10
                  local.get $l5
                  f32.load offset=166304
                  local.set $l34
                  f32.const 0x0p+0 (;=0;)
                  local.set $l38
                  f32.const 0x0p+0 (;=0;)
                  local.set $l31
                  f32.const 0x0p+0 (;=0;)
                  local.set $l39
                  f32.const 0x0p+0 (;=0;)
                  local.set $l40
                  f32.const 0x0p+0 (;=0;)
                  local.set $l41
                  local.get $l5
                  f32.load offset=172304
                  local.tee $l24
                  local.set $l37
                  block $B20
                    local.get $l16
                    i32.const 0
                    i32.lt_s
                    local.tee $l46
                    br_if $B20
                    local.get $l16
                    i32.const 2
                    i32.shl
                    local.tee $l47
                    f32.load offset=168304
                    local.get $l36
                    local.get $l47
                    f32.load offset=160304
                    f32.sub
                    local.tee $l41
                    local.get $l47
                    f32.load offset=170304
                    local.tee $l36
                    f32.mul
                    f32.add
                    local.set $l31
                    local.get $l47
                    f32.load offset=166304
                    local.get $l35
                    local.get $l47
                    f32.load offset=162304
                    f32.sub
                    local.tee $l40
                    local.get $l36
                    f32.mul
                    f32.sub
                    local.set $l39
                    local.get $l24
                    local.get $l47
                    f32.load offset=172304
                    f32.add
                    local.set $l37
                  end
                  local.get $l32
                  local.get $l9
                  f32.add
                  local.set $l48
                  local.get $l34
                  local.get $l10
                  f32.sub
                  local.set $l49
                  local.get $l37
                  local.get $l5
                  f32.load offset=174304
                  local.tee $l44
                  local.get $l42
                  local.get $l2
                  f32.load offset=16
                  local.tee $l9
                  f32.mul
                  local.get $l33
                  local.get $l2
                  f32.load offset=12
                  local.tee $l10
                  f32.mul
                  f32.sub
                  local.tee $l35
                  local.get $l35
                  f32.mul
                  f32.mul
                  f32.add
                  local.set $l36
                  block $B21
                    local.get $l46
                    br_if $B21
                    local.get $l36
                    local.get $l41
                    local.get $l9
                    f32.mul
                    local.get $l40
                    local.get $l10
                    f32.mul
                    f32.sub
                    local.tee $l38
                    local.get $l38
                    f32.mul
                    local.get $l16
                    i32.const 2
                    i32.shl
                    f32.load offset=174304
                    f32.mul
                    f32.add
                    local.set $l36
                  end
                  local.get $l39
                  local.get $l49
                  f32.sub
                  local.tee $l39
                  local.get $l10
                  f32.mul
                  local.get $l31
                  local.get $l48
                  f32.sub
                  local.tee $l31
                  local.get $l9
                  f32.mul
                  f32.add
                  local.tee $l48
                  f32.const 0x0p+0 (;=0;)
                  f32.ge
                  br_if $B19
                  local.get $l36
                  f32.const 0x0p+0 (;=0;)
                  f32.le
                  br_if $B19
                  local.get $l5
                  i32.const 168304
                  i32.add
                  local.tee $l47
                  local.get $l32
                  local.get $l24
                  local.get $l9
                  local.get $l48
                  local.get $l18
                  f32.mul
                  local.get $l36
                  f32.div
                  local.tee $l36
                  f32.mul
                  local.tee $l48
                  f32.mul
                  f32.sub
                  f32.store
                  local.get $l5
                  i32.const 166304
                  i32.add
                  local.tee $l50
                  local.get $l34
                  local.get $l24
                  local.get $l10
                  local.get $l36
                  f32.mul
                  local.tee $l32
                  f32.mul
                  f32.sub
                  f32.store
                  local.get $l5
                  i32.const 170304
                  i32.add
                  local.tee $l51
                  local.get $l43
                  local.get $l44
                  local.get $l35
                  local.get $l36
                  f32.mul
                  f32.mul
                  f32.sub
                  f32.store
                  block $B22
                    local.get $l46
                    br_if $B22
                    local.get $l16
                    i32.const 2
                    i32.shl
                    local.tee $l5
                    local.get $l5
                    f32.load offset=166304
                    local.get $l32
                    local.get $l5
                    f32.load offset=172304
                    local.tee $l43
                    f32.mul
                    f32.add
                    f32.store offset=166304
                    local.get $l5
                    local.get $l48
                    local.get $l43
                    f32.mul
                    local.get $l5
                    f32.load offset=168304
                    f32.add
                    f32.store offset=168304
                    local.get $l5
                    local.get $l5
                    f32.load offset=170304
                    local.get $l38
                    local.get $l36
                    f32.mul
                    local.get $l5
                    f32.load offset=174304
                    f32.mul
                    f32.add
                    f32.store offset=170304
                  end
                  i32.const 0
                  local.get $l29
                  i32.const 1
                  i32.add
                  local.tee $l29
                  i32.store offset=88260
                  local.get $l28
                  local.get $l35
                  f32.const 0x0p+0 (;=0;)
                  f32.ne
                  local.tee $l5
                  i32.add
                  local.get $l16
                  i32.const -1
                  i32.gt_s
                  local.get $l38
                  f32.const 0x0p+0 (;=0;)
                  f32.ne
                  i32.and
                  local.tee $l52
                  i32.add
                  local.set $l28
                  block $B23
                    block $B24
                      local.get $l5
                      br_if $B24
                      local.get $l52
                      i32.eqz
                      br_if $B23
                    end
                    i32.const 0
                    local.get $l28
                    i32.store offset=88268
                  end
                  local.get $l37
                  local.get $l44
                  local.get $l42
                  local.get $l10
                  f32.mul
                  local.get $l33
                  local.get $l9
                  f32.mul
                  f32.add
                  local.tee $l38
                  local.get $l38
                  f32.mul
                  f32.mul
                  f32.add
                  local.set $l37
                  local.get $l9
                  f32.neg
                  local.set $l42
                  block $B25
                    block $B26
                      local.get $l46
                      i32.eqz
                      br_if $B26
                      f32.const 0x0p+0 (;=0;)
                      local.set $l35
                      br $B25
                    end
                    local.get $l37
                    local.get $l41
                    local.get $l10
                    f32.mul
                    local.get $l40
                    local.get $l9
                    f32.mul
                    f32.add
                    local.tee $l35
                    local.get $l35
                    f32.mul
                    local.get $l16
                    i32.const 2
                    i32.shl
                    f32.load offset=174304
                    f32.mul
                    f32.add
                    local.set $l37
                  end
                  local.get $l50
                  local.get $l50
                  f32.load
                  local.get $l24
                  local.get $l36
                  local.get $l19
                  f32.mul
                  local.tee $l40
                  local.get $l8
                  local.get $l36
                  f32.mul
                  local.tee $l36
                  local.get $l31
                  local.get $l10
                  f32.mul
                  local.get $l39
                  local.get $l9
                  f32.mul
                  f32.sub
                  f32.neg
                  local.get $l37
                  f32.div
                  local.tee $l9
                  local.get $l9
                  local.get $l36
                  f32.gt
                  select
                  local.get $l9
                  local.get $l40
                  f32.lt
                  select
                  local.tee $l9
                  local.get $l42
                  f32.mul
                  local.tee $l36
                  f32.mul
                  f32.sub
                  f32.store
                  local.get $l47
                  local.get $l47
                  f32.load
                  local.get $l24
                  local.get $l10
                  local.get $l9
                  f32.mul
                  local.tee $l10
                  f32.mul
                  f32.sub
                  f32.store
                  local.get $l51
                  local.get $l51
                  f32.load
                  local.get $l44
                  local.get $l38
                  local.get $l9
                  f32.mul
                  f32.mul
                  f32.sub
                  f32.store
                  block $B27
                    local.get $l46
                    br_if $B27
                    local.get $l16
                    i32.const 2
                    i32.shl
                    local.tee $l5
                    local.get $l5
                    f32.load offset=166304
                    local.get $l36
                    local.get $l5
                    f32.load offset=172304
                    local.tee $l24
                    f32.mul
                    f32.add
                    f32.store offset=166304
                    local.get $l5
                    local.get $l10
                    local.get $l24
                    f32.mul
                    local.get $l5
                    f32.load offset=168304
                    f32.add
                    f32.store offset=168304
                    local.get $l5
                    local.get $l5
                    f32.load offset=170304
                    local.get $l35
                    local.get $l9
                    f32.mul
                    local.get $l5
                    f32.load offset=174304
                    f32.mul
                    f32.add
                    f32.store offset=170304
                  end
                  i32.const 0
                  local.get $l27
                  i32.const 1
                  i32.add
                  local.tee $l27
                  i32.store offset=88264
                end
                local.get $l23
                i32.const 1
                i32.add
                local.set $l23
                local.get $l15
                i32.const 4
                i32.add
                local.set $l15
                local.get $l45
                i32.const -1
                i32.add
                local.tee $l45
                br_if $L18
              end
            end
            block $B28
              local.get $l4
              i32.eqz
              br_if $B28
              i32.const 0
              local.set $l16
              i32.const 0
              i32.load offset=88272
              local.set $l30
              local.get $l4
              local.set $l23
              loop $L29
                block $B30
                  local.get $l16
                  i32.const 184384
                  i32.add
                  i32.load
                  i32.const 2
                  i32.shl
                  local.tee $l5
                  f32.load offset=174304
                  local.tee $l41
                  local.get $l16
                  i32.const 184624
                  i32.add
                  f32.load
                  local.tee $l9
                  local.get $l5
                  f32.load offset=254480
                  local.tee $l10
                  f32.mul
                  local.get $l16
                  i32.const 184704
                  i32.add
                  f32.load
                  local.tee $l24
                  local.get $l5
                  f32.load offset=256480
                  local.tee $l37
                  f32.mul
                  f32.sub
                  local.tee $l36
                  local.get $l10
                  local.get $l24
                  f32.mul
                  local.get $l9
                  local.get $l37
                  f32.mul
                  f32.add
                  local.tee $l37
                  local.get $l5
                  f32.load offset=162304
                  f32.add
                  local.get $l16
                  i32.const 184304
                  i32.add
                  i32.load
                  i32.const 2
                  i32.shl
                  local.tee $l15
                  f32.load offset=254480
                  local.tee $l10
                  local.get $l16
                  i32.const 184544
                  i32.add
                  f32.load
                  local.tee $l24
                  f32.mul
                  local.get $l16
                  i32.const 184464
                  i32.add
                  f32.load
                  local.tee $l35
                  local.get $l15
                  f32.load offset=256480
                  local.tee $l31
                  f32.mul
                  f32.add
                  local.tee $l38
                  local.get $l15
                  f32.load offset=162304
                  f32.add
                  f32.sub
                  local.tee $l9
                  local.get $l36
                  local.get $l5
                  f32.load offset=160304
                  f32.add
                  local.get $l35
                  local.get $l10
                  f32.mul
                  local.get $l24
                  local.get $l31
                  f32.mul
                  f32.sub
                  local.tee $l35
                  local.get $l15
                  f32.load offset=160304
                  f32.add
                  f32.sub
                  local.tee $l10
                  local.get $l10
                  f32.mul
                  local.get $l9
                  local.get $l9
                  f32.mul
                  f32.add
                  f32.sqrt
                  local.tee $l9
                  f32.div
                  f32.const 0x0p+0 (;=0;)
                  local.get $l9
                  f32.const 0x1.0c6f7ap-20 (;=1e-06;)
                  f32.gt
                  local.tee $l22
                  select
                  local.tee $l24
                  f32.mul
                  local.get $l37
                  local.get $l10
                  local.get $l9
                  f32.div
                  f32.const 0x1p+0 (;=1;)
                  local.get $l22
                  select
                  local.tee $l9
                  f32.mul
                  f32.sub
                  local.tee $l10
                  local.get $l10
                  f32.mul
                  f32.mul
                  local.get $l15
                  f32.load offset=172304
                  local.tee $l39
                  local.get $l5
                  f32.load offset=172304
                  local.tee $l40
                  f32.add
                  local.get $l15
                  f32.load offset=174304
                  local.tee $l42
                  local.get $l35
                  local.get $l24
                  f32.mul
                  local.get $l38
                  local.get $l9
                  f32.mul
                  f32.sub
                  local.tee $l31
                  local.get $l31
                  f32.mul
                  f32.mul
                  f32.add
                  f32.add
                  local.tee $l43
                  f32.const 0x0p+0 (;=0;)
                  f32.le
                  br_if $B30
                  local.get $l15
                  local.get $l15
                  f32.load offset=170304
                  local.tee $l32
                  local.get $l42
                  local.get $l31
                  local.get $l9
                  local.get $l5
                  f32.load offset=166304
                  local.get $l37
                  local.get $l5
                  f32.load offset=170304
                  local.tee $l33
                  f32.mul
                  f32.sub
                  local.get $l15
                  f32.load offset=166304
                  local.tee $l37
                  local.get $l38
                  local.get $l32
                  f32.mul
                  f32.sub
                  f32.sub
                  f32.mul
                  local.get $l24
                  local.get $l5
                  f32.load offset=168304
                  local.get $l36
                  local.get $l33
                  f32.mul
                  f32.add
                  local.get $l15
                  f32.load offset=168304
                  local.tee $l38
                  local.get $l35
                  local.get $l32
                  f32.mul
                  f32.add
                  f32.sub
                  f32.mul
                  f32.add
                  f32.neg
                  local.get $l43
                  f32.div
                  local.tee $l36
                  f32.mul
                  f32.mul
                  f32.sub
                  f32.store offset=170304
                  local.get $l15
                  local.get $l38
                  local.get $l39
                  local.get $l24
                  local.get $l36
                  f32.mul
                  local.tee $l24
                  f32.mul
                  f32.sub
                  f32.store offset=168304
                  local.get $l15
                  local.get $l37
                  local.get $l39
                  local.get $l9
                  local.get $l36
                  f32.mul
                  local.tee $l9
                  f32.mul
                  f32.sub
                  f32.store offset=166304
                  i32.const 0
                  local.get $l30
                  i32.const 1
                  i32.add
                  local.tee $l30
                  i32.store offset=88272
                  local.get $l5
                  local.get $l41
                  local.get $l10
                  local.get $l36
                  f32.mul
                  f32.mul
                  local.get $l5
                  f32.load offset=170304
                  f32.add
                  f32.store offset=170304
                  local.get $l5
                  local.get $l5
                  f32.load offset=168304
                  local.get $l40
                  local.get $l24
                  f32.mul
                  f32.add
                  f32.store offset=168304
                  local.get $l5
                  local.get $l5
                  f32.load offset=166304
                  local.get $l40
                  local.get $l9
                  f32.mul
                  f32.add
                  f32.store offset=166304
                end
                local.get $l16
                i32.const 4
                i32.add
                local.set $l16
                local.get $l23
                i32.const -1
                i32.add
                local.tee $l23
                br_if $L29
              end
            end
            call $quantize_state
            local.get $l26
            i32.const 1
            i32.add
            local.tee $l26
            local.get $l14
            i32.ne
            br_if $L12
          end
        end
        block $B31
          local.get $l13
          i32.eqz
          br_if $B31
          i32.const 0
          local.set $l45
          loop $L32
            i32.const 0
            i32.const 0
            i32.load offset=88284
            i32.const 1
            i32.add
            i32.store offset=88284
            call $build_pairs
            local.tee $l22
            i32.const -1
            i32.eq
            br_if $B0
            i32.const 0
            i32.load offset=88256
            local.set $l16
            i32.const 0
            i32.load offset=88252
            local.set $l23
            i32.const -2000
            local.set $l5
            local.get $l2
            f32.load offset=28
            local.set $l35
            local.get $l2
            f32.load offset=24
            local.set $l31
            local.get $l2
            f32.load offset=20
            local.set $l39
            local.get $l2
            f32.load offset=16
            local.set $l40
            local.get $l2
            f32.load offset=12
            local.set $l41
            loop $L33
              block $B34
                local.get $l5
                i32.const 164304
                i32.add
                local.tee $l15
                f32.load
                local.tee $l38
                local.get $l5
                i32.const 258480
                i32.add
                f32.load
                local.tee $l9
                local.get $l5
                i32.const 178304
                i32.add
                f32.load
                local.tee $l10
                f32.neg
                local.get $l10
                local.get $l9
                f32.const 0x0p+0 (;=0;)
                f32.gt
                select
                local.tee $l36
                f32.mul
                local.get $l5
                i32.const 256480
                i32.add
                f32.load
                local.tee $l10
                local.get $l5
                i32.const 180304
                i32.add
                f32.load
                local.tee $l24
                f32.neg
                local.get $l24
                local.get $l10
                f32.const 0x0p+0 (;=0;)
                f32.gt
                select
                local.tee $l37
                f32.mul
                f32.add
                f32.add
                local.tee $l24
                f32.const 0x0p+0 (;=0;)
                f32.ge
                br_if $B34
                i32.const 0
                local.get $l16
                i32.const 1
                i32.add
                local.tee $l16
                i32.store offset=88256
                i32.const 0
                local.get $l23
                i32.const 1
                i32.add
                local.tee $l23
                i32.store offset=88252
                local.get $l10
                local.get $l36
                f32.mul
                local.get $l9
                local.get $l37
                f32.mul
                f32.sub
                local.get $l5
                i32.const 162304
                i32.add
                local.tee $l30
                f32.load
                local.tee $l9
                f32.add
                local.set $l31
                f32.const 0x0p+0 (;=0;)
                local.set $l35
                local.get $l24
                f32.neg
                local.set $l39
                f32.const -0x1p+0 (;=-1;)
                local.set $l40
                block $B35
                  f32.const -0x1.0624dep-10 (;=-0.001;)
                  local.get $l24
                  f32.sub
                  local.tee $l10
                  f32.const 0x0p+0 (;=0;)
                  f32.le
                  br_if $B35
                  f32.const 0x0p+0 (;=0;)
                  local.set $l35
                  local.get $l5
                  i32.const 174304
                  i32.add
                  f32.load
                  local.tee $l24
                  f32.const 0x0p+0 (;=0;)
                  f32.le
                  br_if $B35
                  local.get $l15
                  local.get $l38
                  local.get $l10
                  local.get $l24
                  f32.div
                  local.tee $l10
                  local.get $l24
                  f32.mul
                  f32.add
                  f32.store
                  f32.const 0x0p+0 (;=0;)
                  local.set $l35
                  local.get $l30
                  local.get $l9
                  local.get $l24
                  local.get $l10
                  f32.const 0x0p+0 (;=0;)
                  f32.mul
                  f32.mul
                  f32.sub
                  f32.store
                end
                f32.const 0x0p+0 (;=0;)
                local.set $l41
              end
              local.get $l5
              i32.const 4
              i32.add
              local.tee $l5
              br_if $L33
            end
            local.get $l2
            local.get $l35
            f32.store offset=28
            local.get $l2
            local.get $l31
            f32.store offset=24
            local.get $l2
            local.get $l39
            f32.store offset=20
            local.get $l2
            local.get $l40
            f32.store offset=16
            local.get $l2
            local.get $l41
            f32.store offset=12
            block $B36
              local.get $l22
              i32.eqz
              br_if $B36
              i32.const 0
              local.set $l5
              i32.const 0
              i32.load offset=88248
              i32.const 1
              i32.add
              local.set $l15
              loop $L37
                i32.const 0
                local.get $l15
                i32.store offset=88248
                block $B38
                  local.get $l5
                  i32.const 184944
                  i32.add
                  i32.load
                  local.tee $l47
                  local.get $l5
                  i32.const 217712
                  i32.add
                  i32.load
                  local.tee $l30
                  local.get $l2
                  i32.const 12
                  i32.add
                  call $sat
                  i32.eqz
                  br_if $B38
                  i32.const 0
                  local.get $l16
                  i32.const 1
                  i32.add
                  local.tee $l16
                  i32.store offset=88256
                  i32.const 0
                  local.get $l23
                  i32.const 1
                  i32.add
                  local.tee $l23
                  i32.store offset=88252
                  local.get $l2
                  f32.load offset=20
                  f32.const -0x1.0624dep-10 (;=-0.001;)
                  f32.add
                  local.tee $l9
                  f32.const 0x0p+0 (;=0;)
                  f32.le
                  br_if $B38
                  local.get $l47
                  i32.const 2
                  i32.shl
                  local.tee $l47
                  f32.load offset=172304
                  local.set $l10
                  block $B39
                    block $B40
                      local.get $l30
                      i32.const 0
                      i32.lt_s
                      local.tee $l46
                      i32.eqz
                      br_if $B40
                      f32.const 0x0p+0 (;=0;)
                      local.set $l24
                      br $B39
                    end
                    local.get $l30
                    i32.const 2
                    i32.shl
                    f32.load offset=172304
                    local.set $l24
                  end
                  local.get $l10
                  local.get $l24
                  f32.add
                  local.tee $l24
                  f32.const 0x0p+0 (;=0;)
                  f32.le
                  br_if $B38
                  local.get $l47
                  local.get $l47
                  f32.load offset=160304
                  local.get $l10
                  local.get $l9
                  local.get $l9
                  f32.const 0x1.99999ap-5 (;=0.05;)
                  local.get $l9
                  f32.const 0x1.99999ap-5 (;=0.05;)
                  f32.lt
                  select
                  local.get $l46
                  select
                  local.get $l24
                  f32.div
                  local.tee $l9
                  local.get $l2
                  f32.load offset=12
                  f32.mul
                  local.tee $l24
                  f32.mul
                  f32.sub
                  f32.store offset=160304
                  local.get $l47
                  local.get $l47
                  f32.load offset=162304
                  local.get $l10
                  local.get $l9
                  local.get $l2
                  f32.load offset=16
                  f32.mul
                  local.tee $l9
                  f32.mul
                  f32.sub
                  f32.store offset=162304
                  local.get $l46
                  br_if $B38
                  local.get $l30
                  i32.const 2
                  i32.shl
                  local.tee $l30
                  local.get $l30
                  f32.load offset=160304
                  local.get $l24
                  local.get $l30
                  f32.load offset=172304
                  local.tee $l10
                  f32.mul
                  f32.add
                  f32.store offset=160304
                  local.get $l30
                  local.get $l9
                  local.get $l10
                  f32.mul
                  local.get $l30
                  f32.load offset=162304
                  f32.add
                  f32.store offset=162304
                end
                local.get $l15
                i32.const 1
                i32.add
                local.set $l15
                local.get $l5
                i32.const 4
                i32.add
                local.set $l5
                local.get $l22
                i32.const -1
                i32.add
                local.tee $l22
                br_if $L37
              end
            end
            call $update_basis
            block $B41
              local.get $l4
              i32.eqz
              br_if $B41
              i32.const 0
              local.set $l5
              i32.const 0
              i32.load offset=88272
              local.set $l22
              local.get $l4
              local.set $l23
              loop $L42
                block $B43
                  local.get $l5
                  i32.const 184304
                  i32.add
                  i32.load
                  i32.const 2
                  i32.shl
                  local.tee $l16
                  f32.load offset=172304
                  local.tee $l9
                  local.get $l5
                  i32.const 184384
                  i32.add
                  i32.load
                  i32.const 2
                  i32.shl
                  local.tee $l15
                  f32.load offset=172304
                  local.tee $l10
                  f32.add
                  local.tee $l36
                  f32.const 0x0p+0 (;=0;)
                  f32.le
                  br_if $B43
                  local.get $l16
                  local.get $l16
                  f32.load offset=162304
                  local.tee $l24
                  local.get $l9
                  local.get $l15
                  f32.load offset=254480
                  local.tee $l37
                  local.get $l5
                  i32.const 184704
                  i32.add
                  f32.load
                  local.tee $l38
                  f32.mul
                  local.get $l5
                  i32.const 184624
                  i32.add
                  f32.load
                  local.tee $l35
                  local.get $l15
                  f32.load offset=256480
                  local.tee $l31
                  f32.mul
                  f32.add
                  local.get $l15
                  f32.load offset=162304
                  f32.add
                  local.get $l24
                  local.get $l16
                  f32.load offset=254480
                  local.tee $l39
                  local.get $l5
                  i32.const 184544
                  i32.add
                  f32.load
                  local.tee $l40
                  f32.mul
                  local.get $l5
                  i32.const 184464
                  i32.add
                  f32.load
                  local.tee $l41
                  local.get $l16
                  f32.load offset=256480
                  local.tee $l42
                  f32.mul
                  f32.add
                  f32.add
                  f32.sub
                  local.tee $l24
                  local.get $l15
                  f32.load offset=160304
                  local.get $l35
                  local.get $l37
                  f32.mul
                  local.get $l38
                  local.get $l31
                  f32.mul
                  f32.sub
                  f32.add
                  local.get $l16
                  f32.load offset=160304
                  local.tee $l35
                  local.get $l41
                  local.get $l39
                  f32.mul
                  local.get $l40
                  local.get $l42
                  f32.mul
                  f32.sub
                  f32.add
                  f32.sub
                  local.tee $l37
                  local.get $l37
                  f32.mul
                  local.get $l24
                  local.get $l24
                  f32.mul
                  f32.add
                  f32.sqrt
                  local.tee $l24
                  f32.div
                  f32.const 0x0p+0 (;=0;)
                  local.get $l24
                  f32.const 0x1.0c6f7ap-20 (;=1e-06;)
                  f32.gt
                  local.tee $l30
                  select
                  local.get $l5
                  i32.const 184864
                  i32.add
                  f32.load
                  f32.const -0x1.99999ap-5 (;=-0.05;)
                  f32.const 0x1.99999ap-5 (;=0.05;)
                  local.get $l24
                  local.get $l5
                  i32.const 184784
                  i32.add
                  f32.load
                  f32.sub
                  local.tee $l38
                  local.get $l38
                  f32.const 0x1.99999ap-5 (;=0.05;)
                  f32.gt
                  select
                  local.get $l38
                  f32.const -0x1.99999ap-5 (;=-0.05;)
                  f32.lt
                  select
                  f32.mul
                  local.get $l36
                  f32.div
                  local.tee $l36
                  f32.mul
                  local.tee $l38
                  f32.mul
                  f32.add
                  f32.store offset=162304
                  local.get $l16
                  local.get $l35
                  local.get $l9
                  local.get $l37
                  local.get $l24
                  f32.div
                  f32.const 0x1p+0 (;=1;)
                  local.get $l30
                  select
                  local.get $l36
                  f32.mul
                  local.tee $l24
                  f32.mul
                  f32.add
                  f32.store offset=160304
                  local.get $l15
                  local.get $l15
                  f32.load offset=162304
                  local.get $l10
                  local.get $l38
                  f32.mul
                  f32.sub
                  f32.store offset=162304
                  local.get $l15
                  local.get $l15
                  f32.load offset=160304
                  local.get $l10
                  local.get $l24
                  f32.mul
                  f32.sub
                  f32.store offset=160304
                  i32.const 0
                  local.get $l22
                  i32.const 1
                  i32.add
                  local.tee $l22
                  i32.store offset=88272
                end
                local.get $l5
                i32.const 4
                i32.add
                local.set $l5
                local.get $l23
                i32.const -1
                i32.add
                local.tee $l23
                br_if $L42
              end
            end
            call $update_basis
            i32.const 0
            i32.load offset=88256
            local.set $l16
            i32.const 0
            i32.load offset=88252
            local.set $l23
            i32.const -2000
            local.set $l5
            local.get $l2
            f32.load offset=28
            local.set $l35
            local.get $l2
            f32.load offset=24
            local.set $l31
            local.get $l2
            f32.load offset=20
            local.set $l39
            local.get $l2
            f32.load offset=16
            local.set $l40
            local.get $l2
            f32.load offset=12
            local.set $l41
            loop $L44
              block $B45
                local.get $l5
                i32.const 164304
                i32.add
                local.tee $l15
                f32.load
                local.tee $l38
                local.get $l5
                i32.const 258480
                i32.add
                f32.load
                local.tee $l9
                local.get $l5
                i32.const 178304
                i32.add
                f32.load
                local.tee $l10
                f32.neg
                local.get $l10
                local.get $l9
                f32.const 0x0p+0 (;=0;)
                f32.gt
                select
                local.tee $l36
                f32.mul
                local.get $l5
                i32.const 256480
                i32.add
                f32.load
                local.tee $l10
                local.get $l5
                i32.const 180304
                i32.add
                f32.load
                local.tee $l24
                f32.neg
                local.get $l24
                local.get $l10
                f32.const 0x0p+0 (;=0;)
                f32.gt
                select
                local.tee $l37
                f32.mul
                f32.add
                f32.add
                local.tee $l24
                f32.const 0x0p+0 (;=0;)
                f32.ge
                br_if $B45
                i32.const 0
                local.get $l16
                i32.const 1
                i32.add
                local.tee $l16
                i32.store offset=88256
                i32.const 0
                local.get $l23
                i32.const 1
                i32.add
                local.tee $l23
                i32.store offset=88252
                local.get $l10
                local.get $l36
                f32.mul
                local.get $l9
                local.get $l37
                f32.mul
                f32.sub
                local.get $l5
                i32.const 162304
                i32.add
                local.tee $l22
                f32.load
                local.tee $l9
                f32.add
                local.set $l31
                f32.const 0x0p+0 (;=0;)
                local.set $l35
                local.get $l24
                f32.neg
                local.set $l39
                f32.const -0x1p+0 (;=-1;)
                local.set $l40
                block $B46
                  f32.const -0x1.0624dep-10 (;=-0.001;)
                  local.get $l24
                  f32.sub
                  local.tee $l10
                  f32.const 0x0p+0 (;=0;)
                  f32.le
                  br_if $B46
                  f32.const 0x0p+0 (;=0;)
                  local.set $l35
                  local.get $l5
                  i32.const 174304
                  i32.add
                  f32.load
                  local.tee $l24
                  f32.const 0x0p+0 (;=0;)
                  f32.le
                  br_if $B46
                  local.get $l15
                  local.get $l38
                  local.get $l10
                  local.get $l24
                  f32.div
                  local.tee $l10
                  local.get $l24
                  f32.mul
                  f32.add
                  f32.store
                  f32.const 0x0p+0 (;=0;)
                  local.set $l35
                  local.get $l22
                  local.get $l9
                  local.get $l24
                  local.get $l10
                  f32.const 0x0p+0 (;=0;)
                  f32.mul
                  f32.mul
                  f32.sub
                  f32.store
                end
                f32.const 0x0p+0 (;=0;)
                local.set $l41
              end
              local.get $l5
              i32.const 4
              i32.add
              local.tee $l5
              br_if $L44
            end
            local.get $l2
            local.get $l35
            f32.store offset=28
            local.get $l2
            local.get $l31
            f32.store offset=24
            local.get $l2
            local.get $l39
            f32.store offset=20
            local.get $l2
            local.get $l40
            f32.store offset=16
            local.get $l2
            local.get $l41
            f32.store offset=12
            call $quantize_state
            local.get $l45
            i32.const 1
            i32.add
            local.tee $l45
            local.get $l13
            i32.ne
            br_if $L32
          end
        end
        i32.const 0
        i32.const 0
        i32.load offset=88240
        i32.const 1
        i32.add
        i32.store offset=88240
        local.get $l20
        i32.const 1
        i32.add
        local.tee $l20
        local.get $p1
        i32.rem_u
        local.set $l5
        block $B47
          block $B48
            local.get $l20
            local.get $p0
            i32.eq
            br_if $B48
            local.get $l5
            br_if $B47
          end
          local.get $l21
          i32.const 12000
          i32.mul
          i32.const 88240
          i32.add
          local.set $l5
          i32.const 0
          local.set $l15
          loop $L49
            local.get $l5
            i32.const 64
            i32.add
            local.get $l15
            i32.const 160304
            i32.add
            f32.load
            f32.store
            local.get $l5
            i32.const 68
            i32.add
            local.get $l15
            i32.const 162304
            i32.add
            f32.load
            f32.store
            local.get $l5
            i32.const 72
            i32.add
            local.get $l15
            i32.const 164304
            i32.add
            f32.load
            f32.store
            local.get $l5
            i32.const 76
            i32.add
            local.get $l15
            i32.const 166304
            i32.add
            f32.load
            f32.store
            local.get $l5
            i32.const 80
            i32.add
            local.get $l15
            i32.const 168304
            i32.add
            f32.load
            f32.store
            local.get $l5
            i32.const 84
            i32.add
            local.get $l15
            i32.const 170304
            i32.add
            f32.load
            f32.store
            local.get $l5
            i32.const 24
            i32.add
            local.set $l5
            local.get $l15
            i32.const 4
            i32.add
            local.tee $l15
            i32.const 2000
            i32.ne
            br_if $L49
          end
          local.get $l21
          i32.const 1
          i32.add
          local.set $l21
        end
        local.get $l20
        local.get $p0
        i32.ne
        br_if $L4
      end
      i32.const 0
      local.set $l3
      i32.const 0
      local.get $l21
      i32.const 3000
      i32.mul
      i32.store offset=88288
    end
    local.get $l2
    i32.const 32
    i32.add
    global.set $__stack_pointer
    local.get $l3)
  (func $quantize_state (type $t0)
    (local $l0 i32) (local $l1 i32) (local $l2 f32) (local $l3 i32)
    i32.const 0
    local.set $l0
    loop $L0
      local.get $l0
      i32.const 2
      i32.shl
      local.tee $l1
      local.get $l1
      f32.load offset=160304
      f32.const 0x1.f4p+9 (;=1000;)
      f32.mul
      local.tee $l2
      f32.const -0x1p-1 (;=-0.5;)
      f32.const 0x1p-1 (;=0.5;)
      local.get $l2
      f32.const 0x0p+0 (;=0;)
      f32.lt
      select
      f32.add
      i32.trunc_sat_f32_s
      f32.convert_i32_s
      f32.const 0x1.f4p+9 (;=1000;)
      f32.div
      f32.store offset=160304
      local.get $l1
      local.get $l1
      f32.load offset=162304
      f32.const 0x1.f4p+9 (;=1000;)
      f32.mul
      local.tee $l2
      f32.const -0x1p-1 (;=-0.5;)
      f32.const 0x1p-1 (;=0.5;)
      local.get $l2
      f32.const 0x0p+0 (;=0;)
      f32.lt
      select
      f32.add
      i32.trunc_sat_f32_s
      f32.convert_i32_s
      f32.const 0x1.f4p+9 (;=1000;)
      f32.div
      f32.store offset=162304
      block $B1
        local.get $l1
        f32.load offset=164304
        local.tee $l2
        f32.const 0x1.921fb6p+1 (;=3.14159;)
        f32.gt
        i32.eqz
        br_if $B1
        loop $L2
          local.get $l2
          f32.const -0x1.921fb6p+2 (;=-6.28319;)
          f32.add
          local.tee $l2
          f32.const 0x1.921fb6p+1 (;=3.14159;)
          f32.gt
          br_if $L2
        end
      end
      local.get $l1
      i32.const 164304
      i32.add
      local.set $l3
      block $B3
        local.get $l2
        f32.const -0x1.921fb6p+1 (;=-3.14159;)
        f32.lt
        i32.eqz
        br_if $B3
        loop $L4
          local.get $l2
          f32.const 0x1.921fb6p+2 (;=6.28319;)
          f32.add
          local.tee $l2
          f32.const -0x1.921fb6p+1 (;=-3.14159;)
          f32.lt
          br_if $L4
        end
      end
      local.get $l3
      local.get $l2
      f32.const 0x1.f4p+9 (;=1000;)
      f32.mul
      local.tee $l2
      f32.const -0x1p-1 (;=-0.5;)
      f32.const 0x1p-1 (;=0.5;)
      local.get $l2
      f32.const 0x0p+0 (;=0;)
      f32.lt
      select
      f32.add
      i32.trunc_sat_f32_s
      f32.convert_i32_s
      f32.const 0x1.f4p+9 (;=1000;)
      f32.div
      f32.store
      local.get $l1
      local.get $l1
      f32.load offset=166304
      f32.const 0x1.f4p+9 (;=1000;)
      f32.mul
      local.tee $l2
      f32.const -0x1p-1 (;=-0.5;)
      f32.const 0x1p-1 (;=0.5;)
      local.get $l2
      f32.const 0x0p+0 (;=0;)
      f32.lt
      select
      f32.add
      i32.trunc_sat_f32_s
      f32.convert_i32_s
      f32.const 0x1.f4p+9 (;=1000;)
      f32.div
      f32.store offset=166304
      local.get $l1
      local.get $l1
      f32.load offset=168304
      f32.const 0x1.f4p+9 (;=1000;)
      f32.mul
      local.tee $l2
      f32.const -0x1p-1 (;=-0.5;)
      f32.const 0x1p-1 (;=0.5;)
      local.get $l2
      f32.const 0x0p+0 (;=0;)
      f32.lt
      select
      f32.add
      i32.trunc_sat_f32_s
      f32.convert_i32_s
      f32.const 0x1.f4p+9 (;=1000;)
      f32.div
      f32.store offset=168304
      local.get $l1
      local.get $l1
      f32.load offset=170304
      f32.const 0x1.f4p+9 (;=1000;)
      f32.mul
      local.tee $l2
      f32.const -0x1p-1 (;=-0.5;)
      f32.const 0x1p-1 (;=0.5;)
      local.get $l2
      f32.const 0x0p+0 (;=0;)
      f32.lt
      select
      f32.add
      i32.trunc_sat_f32_s
      f32.convert_i32_s
      f32.const 0x1.f4p+9 (;=1000;)
      f32.div
      f32.store offset=170304
      local.get $l0
      i32.const 1
      i32.add
      local.tee $l0
      i32.const 500
      i32.ne
      br_if $L0
    end)
  (func $build_pairs (type $t1) (result i32)
    (local $l0 i32) (local $l1 i32) (local $l2 i32) (local $l3 i32) (local $l4 f32) (local $l5 i32) (local $l6 i32) (local $l7 i32) (local $l8 f32) (local $l9 i32) (local $l10 i32) (local $l11 i32) (local $l12 i32)
    call $update_basis
    i32.const 182304
    local.set $l0
    i32.const 1
    local.set $l1
    loop $L0
      local.get $l1
      i32.const 2
      i32.shl
      i32.load offset=182304
      local.tee $l2
      i32.const 2
      i32.shl
      local.tee $l3
      f32.load offset=160304
      local.get $l3
      f32.load offset=250480
      f32.sub
      local.set $l4
      local.get $l0
      local.set $l3
      local.get $l1
      local.set $l5
      block $B1
        loop $L2
          local.get $l3
          i32.load
          local.tee $l6
          i32.const 2
          i32.shl
          local.tee $l7
          f32.load offset=160304
          local.get $l7
          f32.load offset=250480
          f32.sub
          local.tee $l8
          local.get $l4
          f32.lt
          br_if $B1
          block $B3
            local.get $l6
            local.get $l2
            i32.ge_u
            br_if $B3
            local.get $l8
            local.get $l4
            f32.eq
            br_if $B1
          end
          local.get $l3
          i32.const 4
          i32.add
          local.get $l6
          i32.store
          local.get $l3
          i32.const -4
          i32.add
          local.set $l3
          local.get $l5
          i32.const -1
          i32.add
          local.tee $l5
          br_if $L2
        end
        i32.const 0
        local.set $l5
      end
      local.get $l5
      i32.const 2
      i32.shl
      local.get $l2
      i32.store offset=182304
      local.get $l0
      i32.const 4
      i32.add
      local.set $l0
      local.get $l1
      i32.const 1
      i32.add
      local.tee $l1
      i32.const 500
      i32.ne
      br_if $L0
    end
    i32.const 0
    i32.load offset=88244
    local.set $l0
    i32.const 182308
    local.set $l9
    i32.const 0
    local.set $l2
    i32.const 0
    local.set $l7
    loop $L4
      block $B5
        local.get $l2
        i32.const 498
        i32.gt_u
        br_if $B5
        local.get $l2
        i32.const 2
        i32.shl
        i32.load offset=182304
        local.tee $l10
        i32.const 2
        i32.shl
        local.tee $l3
        f32.load offset=160304
        local.get $l3
        f32.load offset=250480
        f32.add
        local.set $l4
        local.get $l3
        i32.const 252480
        i32.add
        local.set $l11
        local.get $l3
        i32.const 162304
        i32.add
        local.set $l12
        i32.const 0
        local.set $l6
        local.get $l9
        local.set $l5
        block $B6
          loop $L7
            local.get $l5
            i32.load
            local.tee $l1
            i32.const 2
            i32.shl
            local.tee $l3
            f32.load offset=160304
            local.get $l3
            f32.load offset=250480
            f32.sub
            local.get $l4
            f32.gt
            br_if $B6
            i32.const 0
            local.get $l0
            local.get $l6
            i32.add
            i32.const 1
            i32.add
            i32.store offset=88244
            block $B8
              local.get $l3
              f32.load offset=162304
              local.get $l12
              f32.load
              f32.sub
              f32.abs
              local.get $l11
              f32.load
              local.get $l3
              f32.load offset=252480
              f32.add
              f32.le
              i32.eqz
              br_if $B8
              block $B9
                local.get $l7
                i32.const 8191
                i32.le_u
                br_if $B9
                i32.const -1
                return
              end
              local.get $l7
              i32.const 2
              i32.shl
              local.tee $l3
              local.get $l1
              i32.store offset=217712
              local.get $l3
              local.get $l10
              i32.store offset=184944
              local.get $l7
              i32.const 1
              i32.add
              local.set $l7
            end
            local.get $l5
            i32.const 4
            i32.add
            local.set $l5
            local.get $l2
            local.get $l6
            i32.const 1
            i32.add
            local.tee $l6
            i32.add
            i32.const 499
            i32.ne
            br_if $L7
          end
        end
        local.get $l0
        local.get $l6
        i32.add
        local.set $l0
      end
      local.get $l9
      i32.const 4
      i32.add
      local.set $l9
      local.get $l2
      i32.const 1
      i32.add
      local.tee $l2
      i32.const 500
      i32.ne
      br_if $L4
    end
    local.get $l7)
  (func $update_basis (type $t0)
    (local $l0 i32) (local $l1 i32) (local $l2 f32) (local $l3 f32) (local $l4 i32) (local $l5 f32) (local $l6 f32)
    i32.const 0
    local.set $l0
    loop $L0
      local.get $l0
      i32.const 2
      i32.shl
      local.tee $l1
      f32.load offset=164304
      local.tee $l2
      local.set $l3
      block $B1
        local.get $l2
        f32.const 0x1.921fb6p+1 (;=3.14159;)
        f32.gt
        local.tee $l4
        i32.eqz
        br_if $B1
        loop $L2
          local.get $l3
          f32.const -0x1.921fb6p+2 (;=-6.28319;)
          f32.add
          local.tee $l3
          f32.const 0x1.921fb6p+1 (;=3.14159;)
          f32.gt
          br_if $L2
        end
      end
      block $B3
        local.get $l3
        f32.const -0x1.921fb6p+1 (;=-3.14159;)
        f32.lt
        i32.eqz
        br_if $B3
        loop $L4
          local.get $l3
          f32.const 0x1.921fb6p+2 (;=6.28319;)
          f32.add
          local.tee $l3
          f32.const -0x1.921fb6p+1 (;=-3.14159;)
          f32.lt
          br_if $L4
        end
      end
      local.get $l3
      local.get $l3
      f32.mul
      local.tee $l3
      local.get $l3
      local.get $l3
      f32.const -0x1.6c16c2p-10 (;=-0.00138889;)
      f32.mul
      f32.const 0x1.555556p-5 (;=0.0416667;)
      f32.add
      f32.mul
      f32.const -0x1p-1 (;=-0.5;)
      f32.add
      f32.mul
      local.set $l3
      block $B5
        local.get $l4
        i32.eqz
        br_if $B5
        loop $L6
          local.get $l2
          f32.const -0x1.921fb6p+2 (;=-6.28319;)
          f32.add
          local.tee $l2
          f32.const 0x1.921fb6p+1 (;=3.14159;)
          f32.gt
          br_if $L6
        end
      end
      local.get $l3
      f32.const 0x1p+0 (;=1;)
      f32.add
      local.set $l3
      block $B7
        local.get $l2
        f32.const -0x1.921fb6p+1 (;=-3.14159;)
        f32.lt
        i32.eqz
        br_if $B7
        loop $L8
          local.get $l2
          f32.const 0x1.921fb6p+2 (;=6.28319;)
          f32.add
          local.tee $l2
          f32.const -0x1.921fb6p+1 (;=-3.14159;)
          f32.lt
          br_if $L8
        end
      end
      local.get $l1
      local.get $l3
      f32.store offset=254480
      local.get $l1
      local.get $l2
      local.get $l2
      local.get $l2
      local.get $l2
      f32.mul
      local.tee $l5
      f32.mul
      local.get $l5
      local.get $l5
      f32.const -0x1.a01a02p-13 (;=-0.000198413;)
      f32.mul
      f32.const 0x1.111112p-7 (;=0.00833333;)
      f32.add
      f32.mul
      f32.const -0x1.555556p-3 (;=-0.166667;)
      f32.add
      f32.mul
      f32.add
      local.tee $l2
      f32.store offset=256480
      local.get $l1
      local.get $l3
      f32.neg
      local.get $l3
      local.get $l3
      f32.const 0x0p+0 (;=0;)
      f32.lt
      select
      local.tee $l3
      local.get $l1
      f32.load offset=176304
      local.tee $l5
      f32.mul
      local.get $l1
      f32.load offset=178304
      local.tee $l6
      local.get $l2
      f32.neg
      local.get $l2
      local.get $l2
      f32.const 0x0p+0 (;=0;)
      f32.lt
      select
      local.tee $l2
      f32.mul
      f32.add
      f32.store offset=250480
      local.get $l1
      local.get $l3
      local.get $l6
      f32.mul
      local.get $l5
      local.get $l2
      f32.mul
      f32.add
      f32.store offset=252480
      local.get $l0
      i32.const 1
      i32.add
      local.tee $l0
      i32.const 500
      i32.ne
      br_if $L0
    end)
  (func $sat (type $t3) (param $p0 i32) (param $p1 i32) (param $p2 i32) (result i32)
    (local $l3 i32) (local $l4 f32) (local $l5 f32) (local $l6 f32) (local $l7 f32) (local $l8 f32) (local $l9 f32) (local $l10 f32) (local $l11 f32) (local $l12 f32) (local $l13 f32) (local $l14 f32) (local $l15 f32) (local $l16 f32) (local $l17 f32) (local $l18 f32) (local $l19 f32) (local $l20 f32) (local $l21 f32) (local $l22 f32) (local $l23 f32) (local $l24 f32) (local $l25 f32) (local $l26 f32) (local $l27 f32) (local $l28 f32) (local $l29 f32) (local $l30 f32) (local $l31 i32)
    i32.const 0
    local.set $l3
    block $B0
      local.get $p1
      i32.const 2
      i32.shl
      local.tee $p1
      f32.load offset=178304
      local.tee $l4
      local.get $p1
      f32.load offset=254480
      local.tee $l5
      local.get $p0
      i32.const 2
      i32.shl
      local.tee $p0
      f32.load offset=256480
      local.tee $l6
      f32.mul
      local.tee $l7
      local.get $p1
      f32.load offset=256480
      local.tee $l8
      local.get $p0
      f32.load offset=254480
      local.tee $l9
      f32.mul
      local.tee $l10
      f32.sub
      local.tee $l11
      f32.neg
      local.tee $l12
      local.get $l11
      local.get $l11
      f32.const 0x0p+0 (;=0;)
      f32.lt
      select
      f32.mul
      local.get $p1
      f32.load offset=176304
      local.tee $l13
      local.get $l5
      local.get $l9
      f32.mul
      local.get $l8
      local.get $l6
      f32.mul
      f32.add
      local.tee $l14
      f32.neg
      local.tee $l15
      local.get $l14
      local.get $l14
      f32.const 0x0p+0 (;=0;)
      f32.lt
      select
      local.tee $l16
      f32.mul
      local.get $p0
      f32.load offset=176304
      local.tee $l17
      local.get $l9
      local.get $l9
      f32.mul
      local.get $l6
      local.get $l6
      f32.mul
      f32.add
      local.tee $l18
      f32.mul
      local.get $p0
      f32.load offset=178304
      local.tee $l19
      local.get $l9
      local.get $l6
      f32.mul
      local.tee $l20
      local.get $l20
      f32.sub
      local.tee $l20
      f32.neg
      local.get $l20
      local.get $l20
      f32.const 0x0p+0 (;=0;)
      f32.lt
      select
      local.tee $l21
      f32.mul
      f32.add
      f32.add
      f32.add
      local.get $p1
      f32.load offset=160304
      local.tee $l22
      local.get $p0
      f32.load offset=160304
      local.tee $l23
      f32.sub
      local.tee $l24
      local.get $l9
      f32.mul
      local.get $p1
      f32.load offset=162304
      local.tee $l25
      local.get $p0
      f32.load offset=162304
      local.tee $l26
      f32.sub
      local.tee $l27
      local.get $l6
      f32.mul
      f32.add
      local.tee $l20
      f32.neg
      local.get $l20
      local.get $l20
      f32.const 0x0p+0 (;=0;)
      f32.lt
      select
      f32.sub
      local.tee $l28
      f32.const 0x0p+0 (;=0;)
      f32.le
      br_if $B0
      local.get $l4
      local.get $l16
      f32.mul
      local.get $l13
      local.get $l10
      local.get $l7
      f32.sub
      local.tee $l7
      f32.neg
      local.tee $l29
      local.get $l7
      local.get $l7
      f32.const 0x0p+0 (;=0;)
      f32.lt
      select
      f32.mul
      local.get $l17
      local.get $l21
      f32.mul
      local.get $l19
      local.get $l18
      f32.mul
      f32.add
      f32.add
      f32.add
      local.get $l27
      local.get $l9
      f32.mul
      local.get $l6
      local.get $l24
      f32.mul
      f32.sub
      local.tee $l10
      f32.neg
      local.get $l10
      local.get $l10
      f32.const 0x0p+0 (;=0;)
      f32.lt
      select
      f32.sub
      local.tee $l21
      f32.const 0x0p+0 (;=0;)
      f32.le
      br_if $B0
      local.get $l4
      local.get $l5
      local.get $l8
      f32.mul
      local.tee $l18
      local.get $l18
      f32.sub
      local.tee $l18
      f32.neg
      local.get $l18
      local.get $l18
      f32.const 0x0p+0 (;=0;)
      f32.lt
      select
      local.tee $l18
      f32.mul
      local.get $l13
      local.get $l5
      local.get $l5
      f32.mul
      local.get $l8
      local.get $l8
      f32.mul
      f32.add
      local.tee $l30
      f32.mul
      local.get $l17
      local.get $l16
      f32.mul
      local.get $l19
      local.get $l29
      local.get $l7
      local.get $l7
      f32.const 0x0p+0 (;=0;)
      f32.lt
      select
      f32.mul
      f32.add
      f32.add
      f32.add
      local.get $l24
      local.get $l5
      f32.mul
      local.get $l27
      local.get $l8
      f32.mul
      f32.add
      local.tee $l7
      f32.neg
      local.get $l7
      local.get $l7
      f32.const 0x0p+0 (;=0;)
      f32.lt
      select
      f32.sub
      local.tee $l16
      f32.const 0x0p+0 (;=0;)
      f32.le
      br_if $B0
      local.get $l4
      local.get $l30
      f32.mul
      local.get $l13
      local.get $l18
      f32.mul
      local.get $l17
      local.get $l12
      local.get $l11
      local.get $l11
      f32.const 0x0p+0 (;=0;)
      f32.lt
      select
      f32.mul
      local.get $l19
      local.get $l15
      local.get $l14
      local.get $l14
      f32.const 0x0p+0 (;=0;)
      f32.lt
      select
      f32.mul
      f32.add
      f32.add
      f32.add
      local.get $l27
      local.get $l5
      f32.mul
      local.get $l8
      local.get $l24
      f32.mul
      f32.sub
      local.tee $l11
      f32.neg
      local.get $l11
      local.get $l11
      f32.const 0x0p+0 (;=0;)
      f32.lt
      select
      f32.sub
      local.tee $l14
      f32.const 0x0p+0 (;=0;)
      f32.le
      br_if $B0
      local.get $p2
      local.get $l14
      local.get $l16
      local.get $l21
      local.get $l28
      f32.const 0x1.fffffap+127 (;=3.40282e+38;)
      local.get $l28
      f32.const 0x1.fffffap+127 (;=3.40282e+38;)
      f32.lt
      local.tee $p1
      select
      local.tee $l24
      local.get $l21
      local.get $l24
      f32.lt
      local.tee $p0
      select
      local.tee $l24
      local.get $l16
      local.get $l24
      f32.lt
      local.tee $l3
      select
      local.tee $l24
      local.get $l14
      local.get $l24
      f32.lt
      local.tee $l31
      select
      f32.store offset=8
      local.get $p2
      local.get $l5
      f32.const -0x1p+0 (;=-1;)
      f32.const 0x1p+0 (;=1;)
      local.get $l11
      f32.const 0x0p+0 (;=0;)
      f32.lt
      select
      local.tee $l14
      f32.mul
      local.get $l8
      f32.const -0x1p+0 (;=-1;)
      f32.const 0x1p+0 (;=1;)
      local.get $l7
      f32.const 0x0p+0 (;=0;)
      f32.lt
      select
      local.tee $l7
      f32.mul
      local.get $l9
      f32.const -0x1p+0 (;=-1;)
      f32.const 0x1p+0 (;=1;)
      local.get $l10
      f32.const 0x0p+0 (;=0;)
      f32.lt
      select
      local.tee $l24
      f32.mul
      local.get $l6
      f32.const -0x1p+0 (;=-1;)
      f32.const 0x1p+0 (;=1;)
      local.get $l20
      f32.const 0x0p+0 (;=0;)
      f32.lt
      select
      local.tee $l20
      f32.mul
      f32.const 0x0p+0 (;=0;)
      local.get $p1
      select
      local.get $p0
      select
      local.get $l3
      select
      local.get $l31
      select
      local.tee $l11
      f32.store offset=4
      local.get $p2
      local.get $l14
      local.get $l8
      f32.neg
      f32.mul
      local.get $l5
      local.get $l7
      f32.mul
      local.get $l24
      local.get $l6
      f32.neg
      f32.mul
      local.get $l9
      local.get $l20
      f32.mul
      f32.const 0x0p+0 (;=0;)
      local.get $p1
      select
      local.get $p0
      select
      local.get $l3
      select
      local.get $l31
      select
      local.tee $l14
      f32.store
      local.get $p2
      local.get $l26
      local.get $l6
      local.get $l17
      f32.neg
      local.get $l17
      local.get $l6
      local.get $l11
      f32.mul
      local.get $l9
      local.get $l14
      f32.mul
      f32.add
      f32.const 0x0p+0 (;=0;)
      f32.lt
      select
      local.tee $l20
      f32.mul
      f32.add
      local.get $l9
      local.get $l19
      f32.neg
      local.get $l19
      local.get $l9
      local.get $l11
      f32.mul
      local.get $l6
      local.get $l14
      f32.mul
      f32.lt
      select
      local.tee $l17
      f32.mul
      f32.add
      local.get $l25
      local.get $l8
      local.get $l13
      f32.neg
      local.get $l13
      local.get $l8
      local.get $l11
      f32.neg
      f32.mul
      local.get $l5
      local.get $l14
      f32.mul
      f32.lt
      select
      local.tee $l13
      f32.mul
      f32.add
      local.get $l5
      local.get $l4
      f32.neg
      local.get $l4
      local.get $l8
      local.get $l14
      f32.mul
      local.get $l5
      local.get $l11
      f32.mul
      f32.lt
      select
      local.tee $l11
      f32.mul
      f32.add
      f32.add
      f32.const 0x1p-1 (;=0.5;)
      f32.mul
      f32.store offset=16
      local.get $p2
      local.get $l23
      local.get $l9
      local.get $l20
      f32.mul
      f32.add
      local.get $l6
      local.get $l17
      f32.mul
      f32.sub
      local.get $l22
      local.get $l5
      local.get $l13
      f32.mul
      f32.add
      local.get $l8
      local.get $l11
      f32.mul
      f32.sub
      f32.add
      f32.const 0x1p-1 (;=0.5;)
      f32.mul
      f32.store offset=12
      i32.const 1
      local.set $l3
    end
    local.get $l3)
  (memory $memory 256)
  (global $__stack_pointer (mut i32) (i32.const 65536))
  (global $__dso_handle i32 (i32.const 65536))
  (global $__data_end i32 (i32.const 258480))
  (global $__stack_low i32 (i32.const 0))
  (global $__stack_high i32 (i32.const 65536))
  (global $__global_base i32 (i32.const 65536))
  (global $__heap_base i32 (i32.const 258480))
  (global $__heap_end i32 (i32.const 16777216))
  (global $__memory_base i32 (i32.const 0))
  (global $__table_base i32 (i32.const 1))
  (global $__wasm_first_page_end i32 (i32.const 65536))
  (export "memory" (memory $memory))
  (export "__wasm_call_ctors" (func $__wasm_call_ctors))
  (export "__stack_pointer" (global $__stack_pointer))
  (export "fixture_ptr" (func $fixture_ptr))
  (export "result_ptr" (func $result_ptr))
  (export "run" (func $run))
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
