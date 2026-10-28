;; cad.parametric-bracket.v1 — kernel: bracket
;; WebAssembly Text (WAT) baseline implementation
;; Exports: bracket

(module $bracket_c.wasm
  (type $t0 (func (result i32)))
  (type $t1 (func (param f64 f64 f64)))
  (type $t2 (func (param f64 f64 f64 f64)))
  (type $t3 (func (param f64 f64 f64 i32) (result i32)))
  (type $t4 (func (param f64 f64 f64 f64) (result i32)))
  (type $t5 (func (param i32 i32) (result i32)))
  (type $t6 (func (param i32 f64 i32 i32 i32) (result i32)))
  (type $t7 (func (param i32 i32 i32 i32 i32)))
  (func $input_ptr (type $t0) (result i32)
    i32.const 66112)
  (func $output_ptr (type $t0) (result i32)
    i32.const 66240)
  (func $run (type $t0) (result i32)
    (local $l0 i32) (local $l1 i32) (local $l2 i32) (local $l3 f64) (local $l4 f64) (local $l5 f64) (local $l6 f64) (local $l7 f64) (local $l8 f64) (local $l9 f64) (local $l10 f64) (local $l11 i32) (local $l12 f64) (local $l13 i32) (local $l14 i32) (local $l15 i32) (local $l16 i32) (local $l17 i32) (local $l18 i32) (local $l19 i64) (local $l20 i32) (local $l21 i32) (local $l22 i32)
    global.get $__stack_pointer
    i32.const 48
    i32.sub
    local.tee $l0
    global.set $__stack_pointer
    i32.const 0
    local.set $l1
    block $B0
      i32.const 0
      i32.load offset=66112
      i32.const 826430019
      i32.ne
      br_if $B0
      i32.const 0
      i32.load offset=66116
      i32.const 1
      i32.ne
      br_if $B0
      i32.const 0
      local.set $l1
      i32.const 0
      i32.load offset=66120
      local.tee $l2
      i32.const 2
      i32.gt_u
      br_if $B0
      i32.const 0
      i32.load offset=66124
      i32.const 8
      i32.ne
      br_if $B0
      i32.const 0
      i32.load offset=66128
      i32.const 32
      i32.ne
      br_if $B0
      i32.const 0
      local.set $l1
      i32.const 0
      f64.load offset=66136
      local.tee $l3
      f64.abs
      f64.const 0x1.fffffffffffffp+1023 (;=1.79769e+308;)
      f64.le
      i32.eqz
      br_if $B0
      i32.const 0
      f64.load offset=66144
      local.tee $l4
      f64.abs
      f64.const 0x1.fffffffffffffp+1023 (;=1.79769e+308;)
      f64.le
      i32.eqz
      br_if $B0
      i32.const 0
      f64.load offset=66152
      local.tee $l5
      f64.abs
      f64.const 0x1.fffffffffffffp+1023 (;=1.79769e+308;)
      f64.le
      i32.eqz
      br_if $B0
      i32.const 0
      f64.load offset=66160
      local.tee $l6
      f64.abs
      f64.const 0x1.fffffffffffffp+1023 (;=1.79769e+308;)
      f64.le
      i32.eqz
      br_if $B0
      i32.const 0
      f64.load offset=66168
      local.tee $l7
      f64.abs
      f64.const 0x1.fffffffffffffp+1023 (;=1.79769e+308;)
      f64.le
      i32.eqz
      br_if $B0
      local.get $l3
      f64.const 0x0p+0 (;=0;)
      f64.gt
      i32.eqz
      br_if $B0
      local.get $l4
      f64.const 0x0p+0 (;=0;)
      f64.gt
      i32.eqz
      br_if $B0
      local.get $l5
      f64.const 0x0p+0 (;=0;)
      f64.gt
      i32.eqz
      br_if $B0
      local.get $l6
      f64.const 0x0p+0 (;=0;)
      f64.ge
      i32.eqz
      br_if $B0
      local.get $l7
      f64.const 0x0p+0 (;=0;)
      f64.gt
      i32.eqz
      br_if $B0
      local.get $l6
      local.get $l6
      f64.add
      local.get $l3
      local.get $l4
      local.get $l3
      local.get $l4
      f64.lt
      select
      f64.lt
      i32.eqz
      br_if $B0
      block $B1
        block $B2
          local.get $l2
          br_if $B2
          local.get $l3
          local.get $l4
          local.get $l5
          call $make_box_solid
          local.get $l0
          i64.const 0
          i64.store offset=40
          br $B1
        end
        i32.const 0
        local.set $l1
        i32.const 0
        f64.load offset=66176
        f64.abs
        f64.const 0x1.fffffffffffffp+1023 (;=1.79769e+308;)
        f64.le
        i32.eqz
        br_if $B0
        i32.const 0
        local.set $l1
        i32.const 0
        f64.load offset=66184
        f64.abs
        f64.const 0x1.fffffffffffffp+1023 (;=1.79769e+308;)
        f64.le
        i32.eqz
        br_if $B0
        block $B3
          local.get $l2
          i32.const 1
          i32.eq
          br_if $B3
          i32.const 0
          local.set $l1
          i32.const 0
          f64.load offset=66192
          f64.abs
          f64.const 0x1.fffffffffffffp+1023 (;=1.79769e+308;)
          f64.le
          i32.eqz
          br_if $B0
          i32.const 0
          local.set $l1
          i32.const 0
          f64.load offset=66200
          f64.abs
          f64.const 0x1.fffffffffffffp+1023 (;=1.79769e+308;)
          f64.le
          i32.eqz
          br_if $B0
        end
        local.get $l7
        local.get $l7
        f64.const 0x1p+2 (;=4;)
        f64.mul
        f64.mul
        local.set $l8
        i32.const 0
        local.set $l1
        i32.const 0
        f64.load offset=66200
        local.set $l9
        i32.const 0
        f64.load offset=66192
        local.set $l10
        i32.const 66184
        local.set $l11
        block $B4
          block $B5
            loop $L6
              block $B7
                local.get $l1
                i32.const 1
                i32.add
                local.tee $l1
                local.get $l2
                i32.ge_u
                br_if $B7
                local.get $l11
                i32.const -8
                i32.add
                f64.load
                local.get $l10
                f64.sub
                local.tee $l12
                local.get $l12
                f64.mul
                local.get $l11
                f64.load
                local.get $l9
                f64.sub
                local.tee $l12
                local.get $l12
                f64.mul
                f64.add
                local.get $l8
                f64.le
                br_if $B5
              end
              local.get $l11
              i32.const 16
              i32.add
              local.set $l11
              local.get $l2
              local.get $l1
              i32.eq
              br_if $B4
              br $L6
            end
          end
          i32.const 0
          local.set $l1
          br $B0
        end
        local.get $l3
        local.get $l4
        local.get $l5
        call $make_box_solid
        local.get $l0
        i64.const 0
        i64.store offset=40
        i32.const 66184
        local.set $l1
        local.get $l2
        local.set $l11
        block $B8
          loop $L9
            local.get $l1
            i32.const -8
            i32.add
            f64.load
            local.get $l1
            f64.load
            local.get $l7
            local.get $l5
            call $make_cylinder_solid
            local.get $l3
            local.get $l4
            local.get $l6
            local.get $l0
            i32.const 40
            i32.add
            call $boolean_cut
            i32.eqz
            br_if $B8
            local.get $l1
            i32.const 16
            i32.add
            local.set $l1
            local.get $l11
            i32.const -1
            i32.add
            local.tee $l11
            i32.eqz
            br_if $B1
            br $L9
          end
        end
        i32.const 0
        local.set $l1
        br $B0
      end
      block $B10
        local.get $l3
        local.get $l4
        local.get $l5
        local.get $l6
        call $fillet_vertical_edges
        br_if $B10
        i32.const 0
        local.set $l1
        br $B0
      end
      i32.const 0
      local.set $l1
      i32.const 0
      i32.const 0
      i64.load offset=2169304
      i64.const 1
      i64.add
      i64.store offset=2169304
      i32.const 2163392
      local.get $l0
      i32.const 24
      i32.add
      call $validate_brep
      i32.eqz
      br_if $B0
      local.get $l0
      i32.load offset=32
      local.get $l2
      i32.ne
      br_if $B0
      call $construct_face_loops_from_brep
      local.tee $l13
      i32.eqz
      br_if $B0
      local.get $l0
      i64.const 0
      i64.store offset=16
      local.get $l0
      i64.const 0
      i64.store offset=8
      local.get $l0
      i64.const 0
      i64.store
      block $B11
        local.get $l13
        local.get $l5
        local.get $l0
        i32.const 16
        i32.add
        local.get $l0
        i32.const 8
        i32.add
        local.get $l0
        call $tessellate_faces
        local.tee $l14
        br_if $B11
        i32.const 0
        local.set $l1
        br $B0
      end
      local.get $l13
      i32.const 3
      i32.and
      local.set $l15
      i32.const 0
      local.set $l16
      i32.const 0
      local.set $l11
      block $B12
        block $B13
          local.get $l13
          i32.const 4
          i32.lt_u
          br_if $B13
          local.get $l13
          i32.const -4
          i32.and
          local.set $l17
          i32.const 0
          local.set $l16
          i32.const 2175296
          local.set $l1
          i32.const 0
          local.set $l11
          loop $L14
            local.get $l1
            i32.load
            local.get $l1
            i32.const 4
            i32.add
            i32.load
            i32.add
            local.get $l1
            i32.const 8
            i32.add
            i32.load
            i32.add
            local.get $l1
            i32.const 12
            i32.add
            i32.load
            i32.add
            i32.const 1
            i32.shl
            local.get $l11
            i32.add
            local.set $l11
            local.get $l1
            i32.const 16
            i32.add
            local.set $l1
            local.get $l17
            local.get $l16
            i32.const 4
            i32.add
            local.tee $l16
            i32.ne
            br_if $L14
          end
          local.get $l15
          i32.eqz
          br_if $B12
        end
        local.get $l16
        i32.const 2
        i32.shl
        i32.const 2175296
        i32.add
        local.set $l1
        loop $L15
          local.get $l1
          i32.load
          i32.const 1
          i32.shl
          local.get $l11
          i32.add
          local.set $l11
          local.get $l1
          i32.const 4
          i32.add
          local.set $l1
          local.get $l15
          i32.const -1
          i32.add
          local.tee $l15
          br_if $L15
        end
      end
      i32.const 256
      local.set $l17
      block $B16
        local.get $l14
        i32.const 72
        i32.mul
        local.get $l11
        i32.const 3
        i32.shl
        i32.add
        i32.const 256
        i32.add
        local.tee $l1
        i32.const 2097152
        i32.le_u
        br_if $B16
        i32.const 0
        local.set $l1
        br $B0
      end
      i32.const 0
      local.set $l18
      i32.const 66400
      i32.const 0
      i32.const 96
      memory.fill
      i32.const 0
      i64.const 9417216578
      i64.store offset=66240
      i32.const 0
      local.get $l14
      i32.store offset=66260
      i32.const 0
      i32.const 32
      i32.store offset=66256
      i32.const 0
      local.get $l2
      i32.store offset=66252
      i32.const 0
      local.get $l2
      i32.store offset=66276
      i32.const 0
      i32.const 0
      i32.load offset=2175296
      i32.store offset=66248
      i32.const 0
      i32.const 0
      i32.load offset=2169288
      i32.store offset=66264
      i32.const 0
      local.get $l0
      i32.load offset=36
      i32.store offset=66288
      i32.const 0
      local.get $l0
      i32.load offset=24
      i32.store offset=66292
      i32.const 0
      i32.const 0
      i64.load offset=2169280
      i64.const 32
      i64.rotl
      i64.store offset=66268 align=4
      i32.const 0
      i32.const 0
      i64.load offset=2169292 align=4
      i64.const 32
      i64.rotl
      i64.store offset=66280
      i32.const 0
      local.get $l0
      i32.load offset=28
      i32.store offset=66296
      i32.const 0
      local.get $l1
      i64.extend_i32_u
      i64.store offset=66400
      i32.const 0
      i64.const 128
      i64.store offset=66392
      i32.const 0
      local.get $l14
      i64.extend_i32_u
      local.tee $l19
      i64.const 3
      i64.mul
      i64.store offset=66384
      i32.const 0
      local.get $l19
      i64.store offset=66376
      i32.const 0
      local.get $l0
      i64.load
      i64.store offset=66368
      i32.const 0
      local.get $l0
      i64.load offset=8
      i64.store offset=66360
      i32.const 0
      local.get $l0
      i64.load offset=16
      i64.store offset=66352
      i32.const 0
      local.get $l0
      i64.load offset=40
      i64.store offset=66344
      i32.const 0
      i32.const 0
      i64.load offset=2169336
      i64.store offset=66336
      i32.const 0
      i32.const 0
      i64.load offset=2169328
      i64.store offset=66328
      i32.const 0
      i32.const 0
      i64.load offset=2169320
      i64.store offset=66320
      i32.const 0
      i32.const 0
      i64.load offset=2169312
      i64.store offset=66312
      i32.const 0
      i32.const 0
      i64.load offset=2169304
      i64.store offset=66304
      i32.const 0
      i32.const 0
      i32.store offset=66300
      i32.const 2175312
      local.set $l20
      loop $L17
        block $B18
          local.get $l18
          i32.const 2
          i32.shl
          i32.load offset=2175296
          local.tee $l2
          i32.eqz
          br_if $B18
          i32.const 0
          local.set $l16
          block $B19
            local.get $l2
            i32.const 1
            i32.eq
            br_if $B19
            local.get $l2
            i32.const 1
            i32.and
            local.set $l21
            local.get $l2
            i32.const -2
            i32.and
            local.set $l22
            i32.const 0
            local.set $l16
            i32.const 0
            local.set $l2
            loop $L20
              local.get $l17
              local.get $l2
              i32.add
              local.tee $l11
              i32.const 66240
              i32.add
              local.get $l20
              local.get $l2
              i32.add
              local.tee $l15
              f64.load
              f64.store align=1
              local.get $l11
              i32.const 66248
              i32.add
              local.get $l15
              i32.const 8
              i32.add
              f64.load
              f64.store align=1
              local.get $l11
              i32.const 66256
              i32.add
              local.get $l15
              i32.const 16
              i32.add
              f64.load
              f64.store align=1
              local.get $l11
              i32.const 66264
              i32.add
              local.get $l15
              i32.const 24
              i32.add
              f64.load
              f64.store align=1
              local.get $l2
              i32.const 32
              i32.add
              local.set $l2
              local.get $l22
              local.get $l16
              i32.const 2
              i32.add
              local.tee $l16
              i32.ne
              br_if $L20
            end
            local.get $l17
            local.get $l2
            i32.add
            local.set $l17
            local.get $l21
            i32.eqz
            br_if $B18
          end
          local.get $l17
          i32.const 66240
          i32.add
          local.get $l18
          i32.const 640
          i32.mul
          i32.const 2175312
          i32.add
          local.get $l16
          i32.const 4
          i32.shl
          i32.add
          local.tee $l2
          f64.load
          f64.store align=1
          local.get $l17
          i32.const 66248
          i32.add
          local.get $l2
          f64.load offset=8
          f64.store align=1
          local.get $l17
          i32.const 16
          i32.add
          local.set $l17
        end
        local.get $l20
        i32.const 640
        i32.add
        local.set $l20
        local.get $l18
        i32.const 1
        i32.add
        local.tee $l18
        local.get $l13
        i32.ne
        br_if $L17
      end
      local.get $l14
      i32.const 72
      i32.mul
      local.tee $l2
      i32.eqz
      br_if $B0
      local.get $l17
      i32.const 66240
      i32.add
      i32.const 2177232
      local.get $l2
      memory.copy
    end
    local.get $l0
    i32.const 48
    i32.add
    global.set $__stack_pointer
    local.get $l1)
  (func $make_box_solid (type $t1) (param $p0 f64) (param $p1 f64) (param $p2 f64)
    (local $l3 i32)
    global.get $__stack_pointer
    i32.const 48
    i32.sub
    local.tee $l3
    global.set $__stack_pointer
    i32.const 0
    i32.const 0
    i32.store offset=2166720
    i32.const 0
    i32.const 0
    i32.store offset=2166672
    i32.const 0
    i32.const 0
    i32.store offset=2166624
    i32.const 0
    i32.const 0
    i32.store offset=2166576
    i32.const 0
    i32.const 0
    i32.store offset=2166528
    i32.const 0
    i32.const 0
    i32.store offset=2166480
    i32.const 0
    i32.const 0
    i32.store offset=2166432
    i32.const 0
    i32.const 0
    i32.store offset=2166384
    i32.const 0
    i32.const 0
    i32.store offset=2166336
    i32.const 0
    i32.const 0
    i32.store offset=2166288
    i32.const 0
    i32.const 0
    i32.store offset=2165956
    i32.const 0
    i32.const 0
    i32.store offset=2165900
    i32.const 0
    i32.const 0
    i32.store offset=2165844
    i32.const 0
    i32.const 0
    i32.store offset=2165788
    i32.const 0
    i32.const 0
    i32.store offset=2165732
    i32.const 0
    i32.const 0
    i32.store offset=2165676
    i32.const 0
    i32.const 0
    i32.store offset=2165620
    i32.const 0
    i32.const 0
    i32.store offset=2165564
    i32.const 0
    i32.const 0
    i32.store offset=2165508
    i32.const 0
    i32.const 0
    i32.store offset=2165452
    i32.const 0
    i32.const 0
    i32.store offset=2165396
    i32.const 0
    i32.const 0
    i32.store offset=2165340
    i32.const 0
    i32.const 0
    i32.store offset=2165284
    i32.const 0
    i32.const 0
    i32.store offset=2165228
    i32.const 0
    i32.const 0
    i32.store offset=2165172
    i32.const 0
    i32.const 0
    i32.store offset=2165116
    i32.const 0
    i32.const 0
    i32.store offset=2165060
    i32.const 0
    i32.const 0
    i32.store offset=2165004
    i32.const 0
    i32.const 0
    i32.store offset=2164948
    i32.const 0
    i32.const 0
    i32.store offset=2164892
    i32.const 0
    i32.const 0
    i32.store offset=2164836
    i32.const 0
    i32.const 0
    i32.store offset=2164780
    i32.const 0
    i32.const 0
    i32.store offset=2164724
    i32.const 0
    i32.const 0
    i32.store offset=2164668
    i32.const 0
    i32.const 0
    i32.store offset=2164612
    i32.const 0
    i32.const 0
    i32.store offset=2164556
    i32.const 0
    i32.const 0
    i32.store offset=2164500
    i32.const 0
    i32.const 0
    i32.store offset=2164444
    i32.const 0
    i32.const 0
    i32.store offset=2164388
    i32.const 0
    i32.const 0
    i32.store offset=2164332
    i32.const 0
    i32.const 0
    i32.store offset=2164276
    i32.const 0
    i32.const 0
    i32.store offset=2164220
    i32.const 0
    i32.const 0
    i32.store offset=2164164
    i32.const 0
    i32.const 0
    i32.store offset=2164108
    i32.const 0
    i32.const 0
    i32.store offset=2164052
    i32.const 0
    i32.const 0
    i32.store offset=2163996
    i32.const 0
    i64.const 0
    i64.store offset=2169336
    i32.const 0
    i64.const 0
    i64.store offset=2169328
    i32.const 0
    i64.const 0
    i64.store offset=2169320
    i32.const 0
    i64.const 0
    i64.store offset=2169312
    i32.const 0
    i64.const 0
    i64.store offset=2169304
    i32.const 0
    i64.const 0
    i64.store offset=2169296
    i32.const 0
    i64.const 0
    i64.store offset=2169288
    i32.const 0
    i64.const 0
    i64.store offset=2169280
    i32.const 0
    i64.const 0
    i64.store offset=2163408
    i32.const 0
    i64.const 0
    i64.store offset=2163400
    i32.const 0
    i64.const 0
    i64.store offset=2163392
    i32.const 0
    local.get $p0
    f64.store offset=2163416
    i32.const 0
    i64.const 0
    i64.store offset=2163432
    i32.const 0
    i64.const 0
    i64.store offset=2163424
    i32.const 0
    local.get $p1
    f64.store offset=2163448
    i32.const 0
    local.get $p0
    f64.store offset=2163440
    i32.const 0
    i64.const 0
    i64.store offset=2163456
    i32.const 0
    i64.const 0
    i64.store offset=2163464
    i32.const 0
    local.get $p1
    f64.store offset=2163472
    i32.const 0
    i64.const 0
    i64.store offset=2163496
    i32.const 0
    i64.const 0
    i64.store offset=2163488
    i32.const 0
    i64.const 0
    i64.store offset=2163480
    i32.const 0
    i32.const 8
    i32.store offset=2169280
    i32.const 0
    local.get $p2
    f64.store offset=2163576
    i32.const 0
    local.get $p1
    f64.store offset=2163568
    i32.const 0
    i64.const 0
    i64.store offset=2163560
    i32.const 0
    local.get $p2
    f64.store offset=2163552
    i32.const 0
    local.get $p1
    f64.store offset=2163544
    i32.const 0
    local.get $p0
    f64.store offset=2163536
    i32.const 0
    local.get $p2
    f64.store offset=2163528
    i32.const 0
    i64.const 0
    i64.store offset=2163520
    i32.const 0
    local.get $p0
    f64.store offset=2163512
    i32.const 0
    local.get $p2
    f64.store offset=2163504
    i32.const 0
    i32.const 1
    i32.store offset=2165984
    i32.const 0
    i32.const 0
    i32.store offset=2166000
    i32.const 0
    i64.const 0
    i64.store offset=2166024
    i32.const 0
    i64.const 0
    i64.store offset=2166016
    i32.const 0
    i64.const 0
    i64.store offset=2166008
    i32.const 0
    i32.const 1
    i32.store offset=2166032
    i32.const 0
    i32.const 0
    i32.store offset=2166048
    i32.const 0
    i64.const 0
    i64.store offset=2166072
    i32.const 0
    i64.const 0
    i64.store offset=2166064
    i32.const 0
    i64.const 0
    i64.store offset=2166056
    i32.const 0
    i32.const 1
    i32.store offset=2166080
    i32.const 0
    i32.const 0
    i32.store offset=2166096
    i32.const 0
    i64.const 0
    i64.store offset=2166120
    i32.const 0
    i64.const 0
    i64.store offset=2166112
    i32.const 0
    i64.const 0
    i64.store offset=2166104
    i32.const 0
    i32.const 1
    i32.store offset=2166128
    i32.const 0
    i32.const 0
    i32.store offset=2166144
    i32.const 0
    i64.const 0
    i64.store offset=2166168
    i32.const 0
    i64.const 0
    i64.store offset=2166160
    i32.const 0
    i64.const 0
    i64.store offset=2166152
    i32.const 0
    i32.const 1
    i32.store offset=2166176
    i32.const 0
    i32.const 0
    i32.store offset=2166192
    i32.const 0
    i64.const 0
    i64.store offset=2166216
    i32.const 0
    i64.const 0
    i64.store offset=2166208
    i32.const 0
    i64.const 0
    i64.store offset=2166200
    i32.const 0
    i32.const 1
    i32.store offset=2166224
    i32.const 0
    i32.const 0
    i32.store offset=2166240
    i32.const 0
    i64.const 0
    i64.store offset=2166264
    i32.const 0
    i64.const 0
    i64.store offset=2166256
    i32.const 0
    i64.const 0
    i64.store offset=2166248
    i32.const 0
    i32.const 6
    i32.store offset=2169288
    i32.const 0
    i64.const 1
    i64.store offset=2163976
    i32.const 0
    i64.const 1
    i64.store offset=2163968
    i32.const 0
    i64.const 0
    i64.store offset=2164012 align=4
    i32.const 0
    i64.const 0
    i64.store offset=2164004 align=4
    i32.const 0
    i64.const 0
    i64.store offset=2163996 align=4
    i32.const 0
    i64.const 5
    i64.store offset=2164032
    i32.const 0
    i64.const 17179869185
    i64.store offset=2164024
    i32.const 0
    i64.const 0
    i64.store offset=2164068 align=4
    i32.const 0
    i64.const 0
    i64.store offset=2164060 align=4
    i32.const 0
    i64.const 0
    i64.store offset=2164052 align=4
    i32.const 0
    i64.const 4
    i64.store offset=2164088
    i32.const 0
    i64.const 1
    i64.store offset=2164080
    i32.const 0
    i32.const 0
    i32.store offset=2163984
    i32.const 0
    i32.const 0
    i32.store offset=2164020
    i32.const 0
    i32.const 0
    i32.store offset=2164040
    i32.const 0
    i32.const 0
    i32.store offset=2164076
    local.get $l3
    i32.const 1
    i32.store offset=32
    i32.const 0
    i32.const 0
    i32.store offset=2164096
    i32.const 0
    i64.const 0
    i64.store offset=2164124 align=4
    i32.const 0
    i64.const 0
    i64.store offset=2164116 align=4
    i32.const 0
    i64.const 0
    i64.store offset=2164108 align=4
    i32.const 0
    i32.const 0
    i32.store offset=2164132
    i32.const 0
    i64.const 2
    i64.store offset=2164144
    i32.const 0
    i64.const 4294967297
    i64.store offset=2164136
    i32.const 0
    i32.const 0
    i32.store offset=2164152
    i32.const 0
    i64.const 0
    i64.store offset=2164180 align=4
    i32.const 0
    i64.const 0
    i64.store offset=2164172 align=4
    i32.const 0
    i64.const 0
    i64.store offset=2164164 align=4
    i32.const 0
    i32.const 0
    i32.store offset=2164188
    i32.const 0
    i64.const 6
    i64.store offset=2164200
    i32.const 0
    i64.const 21474836481
    i64.store offset=2164192
    i32.const 0
    i32.const 0
    i32.store offset=2164208
    i32.const 0
    i64.const 0
    i64.store offset=2164236 align=4
    i32.const 0
    i64.const 0
    i64.store offset=2164228 align=4
    i32.const 0
    i64.const 0
    i64.store offset=2164220 align=4
    i32.const 0
    i32.const 0
    i32.store offset=2164244
    local.get $l3
    i32.const 4
    i32.store offset=36
    i32.const 0
    i64.const 5
    i64.store offset=2164256
    i32.const 0
    i64.const 4294967297
    i64.store offset=2164248
    i32.const 0
    i32.const 0
    i32.store offset=2164264
    i32.const 0
    i64.const 0
    i64.store offset=2164292 align=4
    i32.const 0
    i64.const 0
    i64.store offset=2164284 align=4
    i32.const 0
    i64.const 0
    i64.store offset=2164276 align=4
    i32.const 0
    i32.const 0
    i32.store offset=2164300
    i32.const 0
    i64.const 3
    i64.store offset=2164312
    i32.const 0
    i64.const 8589934593
    i64.store offset=2164304
    i32.const 0
    i32.const 0
    i32.store offset=2164320
    i32.const 0
    i64.const 0
    i64.store offset=2164348 align=4
    i32.const 0
    i64.const 0
    i64.store offset=2164340 align=4
    i32.const 0
    i64.const 0
    i64.store offset=2164332 align=4
    i32.const 0
    i32.const 0
    i32.store offset=2164356
    i32.const 0
    i64.const 7
    i64.store offset=2164368
    i32.const 0
    i64.const 25769803777
    i64.store offset=2164360
    i32.const 0
    i32.const 0
    i32.store offset=2164376
    i32.const 0
    i64.const 0
    i64.store offset=2164404 align=4
    i32.const 0
    i64.const 0
    i64.store offset=2164396 align=4
    i32.const 0
    i64.const 0
    i64.store offset=2164388 align=4
    i32.const 0
    i32.const 0
    i32.store offset=2164412
    local.get $l3
    i32.const 7
    i32.store offset=40
    i32.const 0
    i64.const 6
    i64.store offset=2164424
    i32.const 0
    i64.const 8589934593
    i64.store offset=2164416
    i32.const 0
    i32.const 0
    i32.store offset=2164432
    i32.const 0
    i64.const 0
    i64.store offset=2164460 align=4
    i32.const 0
    i64.const 0
    i64.store offset=2164452 align=4
    i32.const 0
    i64.const 0
    i64.store offset=2164444 align=4
    i32.const 0
    i32.const 0
    i32.store offset=2164468
    i32.const 0
    i64.const 0
    i64.store offset=2164480
    i32.const 0
    i64.const 12884901889
    i64.store offset=2164472
    i32.const 0
    i32.const 0
    i32.store offset=2164488
    i32.const 0
    i64.const 0
    i64.store offset=2164516 align=4
    i32.const 0
    i64.const 0
    i64.store offset=2164508 align=4
    i32.const 0
    i64.const 0
    i64.store offset=2164500 align=4
    i32.const 0
    i32.const 0
    i32.store offset=2164524
    i32.const 0
    i64.const 4
    i64.store offset=2164536
    i32.const 0
    i64.const 30064771073
    i64.store offset=2164528
    i32.const 0
    i32.const 0
    i32.store offset=2164544
    i32.const 0
    i64.const 0
    i64.store offset=2164572 align=4
    i32.const 0
    i64.const 0
    i64.store offset=2164564 align=4
    i32.const 0
    i64.const 0
    i64.store offset=2164556 align=4
    i32.const 0
    i32.const 0
    i32.store offset=2164580
    local.get $l3
    i32.const 10
    i32.store offset=44
    i32.const 0
    i64.const 7
    i64.store offset=2164592
    i32.const 0
    i64.const 12884901889
    i64.store offset=2164584
    i32.const 0
    i32.const 0
    i32.store offset=2164600
    i32.const 0
    i64.const 0
    i64.store offset=2164628 align=4
    i32.const 0
    i64.const 0
    i64.store offset=2164620 align=4
    i32.const 0
    i64.const 0
    i64.store offset=2164612 align=4
    i32.const 0
    i32.const 0
    i32.store offset=2164636
    i32.const 0
    i32.const 12
    i32.store offset=2169284
    local.get $l3
    i64.const 3
    i64.store offset=24
    local.get $l3
    i64.const 25769803785
    i64.store offset=16
    i32.const 2163392
    i32.const 0
    local.get $l3
    i32.const 16
    i32.add
    i32.const 65536
    i32.const 4
    call $add_loop
    i32.const 2163392
    i32.const 1
    local.get $l3
    i32.const 32
    i32.add
    i32.const 65552
    i32.const 4
    call $add_loop
    local.get $l3
    i64.const 8589934593
    i64.store offset=8
    local.get $l3
    i64.const 21474836480
    i64.store
    i32.const 2163392
    i32.const 2
    local.get $l3
    i32.const 66080
    i32.const 4
    call $add_loop
    local.get $l3
    i64.const 21474836484
    i64.store offset=8
    local.get $l3
    i64.const 34359738371
    i64.store
    i32.const 2163392
    i32.const 3
    local.get $l3
    i32.const 66080
    i32.const 4
    call $add_loop
    local.get $l3
    i64.const 34359738375
    i64.store offset=8
    local.get $l3
    i64.const 47244640262
    i64.store
    i32.const 2163392
    i32.const 4
    local.get $l3
    i32.const 66080
    i32.const 4
    call $add_loop
    local.get $l3
    i64.const 47244640266
    i64.store offset=8
    local.get $l3
    i64.const 8589934601
    i64.store
    i32.const 2163392
    i32.const 5
    local.get $l3
    i32.const 66080
    i32.const 4
    call $add_loop
    i32.const 0
    i32.const 0
    i64.load offset=2169304
    i64.const 1
    i64.add
    i64.store offset=2169304
    i32.const 0
    i32.const 0
    i64.load offset=2169312
    i64.const 1
    i64.add
    i64.store offset=2169312
    local.get $l3
    i32.const 48
    i32.add
    global.set $__stack_pointer)
  (func $make_cylinder_solid (type $t2) (param $p0 f64) (param $p1 f64) (param $p2 f64) (param $p3 f64)
    (local $l4 i32) (local $l5 f64)
    global.get $__stack_pointer
    i32.const 16
    i32.sub
    local.tee $l4
    global.set $__stack_pointer
    i32.const 0
    i32.const 0
    i32.store offset=2172672
    i32.const 0
    i32.const 0
    i32.store offset=2172624
    i32.const 0
    i32.const 0
    i32.store offset=2172576
    i32.const 0
    i32.const 0
    i32.store offset=2172528
    i32.const 0
    i32.const 0
    i32.store offset=2172480
    i32.const 0
    i32.const 0
    i32.store offset=2172432
    i32.const 0
    i32.const 0
    i32.store offset=2172384
    i32.const 0
    i32.const 0
    i32.store offset=2172336
    i32.const 0
    i32.const 0
    i32.store offset=2172288
    i32.const 0
    i32.const 0
    i32.store offset=2172240
    i32.const 0
    i32.const 0
    i32.store offset=2172192
    i32.const 0
    i32.const 0
    i32.store offset=2172144
    i32.const 0
    i32.const 0
    i32.store offset=2172096
    i32.const 0
    i32.const 0
    i32.store offset=2171908
    i32.const 0
    i32.const 0
    i32.store offset=2171852
    i32.const 0
    i32.const 0
    i32.store offset=2171796
    i32.const 0
    i32.const 0
    i32.store offset=2171740
    i32.const 0
    i32.const 0
    i32.store offset=2171684
    i32.const 0
    i32.const 0
    i32.store offset=2171628
    i32.const 0
    i32.const 0
    i32.store offset=2171572
    i32.const 0
    i32.const 0
    i32.store offset=2171516
    i32.const 0
    i32.const 0
    i32.store offset=2171460
    i32.const 0
    i32.const 0
    i32.store offset=2171404
    i32.const 0
    i32.const 0
    i32.store offset=2171348
    i32.const 0
    i32.const 0
    i32.store offset=2171292
    i32.const 0
    i32.const 0
    i32.store offset=2171236
    i32.const 0
    i32.const 0
    i32.store offset=2171180
    i32.const 0
    i32.const 0
    i32.store offset=2171124
    i32.const 0
    i32.const 0
    i32.store offset=2171068
    i32.const 0
    i32.const 0
    i32.store offset=2171012
    i32.const 0
    i32.const 0
    i32.store offset=2170956
    i32.const 0
    i32.const 0
    i32.store offset=2170900
    i32.const 0
    i32.const 0
    i32.store offset=2170844
    i32.const 0
    i32.const 0
    i32.store offset=2170788
    i32.const 0
    i32.const 0
    i32.store offset=2170732
    i32.const 0
    i32.const 0
    i32.store offset=2170676
    i32.const 0
    i32.const 0
    i32.store offset=2170620
    i32.const 0
    i32.const 0
    i32.store offset=2170564
    i32.const 0
    i32.const 0
    i32.store offset=2170508
    i32.const 0
    i32.const 0
    i32.store offset=2170452
    i32.const 0
    i32.const 0
    i32.store offset=2170396
    i32.const 0
    i32.const 0
    i32.store offset=2170340
    i32.const 0
    i32.const 0
    i32.store offset=2170284
    i32.const 0
    i32.const 0
    i32.store offset=2170228
    i32.const 0
    i32.const 0
    i32.store offset=2170172
    i32.const 0
    i32.const 0
    i32.store offset=2170116
    i32.const 0
    i32.const 0
    i32.store offset=2170060
    i32.const 0
    i64.const 0
    i64.store offset=2175288
    i32.const 0
    i64.const 0
    i64.store offset=2175280
    i32.const 0
    i64.const 0
    i64.store offset=2175272
    i32.const 0
    i64.const 0
    i64.store offset=2175264
    i32.const 0
    i64.const 0
    i64.store offset=2175256
    i32.const 0
    i64.const 0
    i64.store offset=2175248
    i32.const 0
    i64.const 0
    i64.store offset=2169360
    i32.const 0
    i32.const 2
    i32.store offset=2175232
    i32.const 0
    local.get $p1
    f64.store offset=2169352
    i32.const 0
    local.get $p0
    local.get $p2
    f64.add
    local.tee $l5
    f64.store offset=2169344
    i32.const 0
    local.get $l5
    f64.store offset=2169368
    i32.const 0
    local.get $p1
    f64.store offset=2169376
    i32.const 0
    local.get $p3
    f64.store offset=2169384
    i32.const 0
    i32.const 1
    i32.store offset=2171936
    i32.const 0
    i64.const 0
    i64.store offset=2171960
    i32.const 0
    i64.const 0
    i64.store offset=2171968
    i32.const 0
    i64.const 0
    i64.store offset=2171976
    i32.const 0
    i32.const 1
    i32.store offset=2171984
    i32.const 0
    i64.const 0
    i64.store offset=2172024
    i32.const 0
    i64.const 0
    i64.store offset=2172016
    i32.const 0
    i64.const 0
    i64.store offset=2172008
    i32.const 0
    i32.const 3
    i32.store offset=2175240
    i32.const 0
    local.get $p2
    f64.store offset=2172072
    i32.const 0
    local.get $p1
    f64.store offset=2172064
    i32.const 0
    local.get $p0
    f64.store offset=2172056
    i32.const 0
    i32.const 2
    i32.store offset=2172032
    i32.const 0
    i32.const 0
    i32.store offset=2172048
    i32.const 0
    local.get $p2
    f64.store offset=2169968
    i32.const 0
    local.get $p1
    f64.store offset=2169960
    i32.const 0
    local.get $p0
    f64.store offset=2169952
    i32.const 0
    i64.const 2
    i64.store offset=2169920
    i32.const 0
    i32.const 0
    i32.store offset=2169928
    i32.const 0
    local.get $p2
    f64.store offset=2170024
    i32.const 0
    local.get $p1
    f64.store offset=2170016
    i32.const 0
    local.get $p0
    f64.store offset=2170008
    i32.const 0
    i32.const 1
    i32.store offset=2169984
    i32.const 0
    i64.const 4294967298
    i64.store offset=2169976
    i32.const 0
    i64.const 137438953472
    i64.store offset=2169932 align=4
    i32.const 0
    i32.const 3
    i32.store offset=2175236
    i32.const 0
    i64.const 137438953472
    i64.store offset=2169988 align=4
    i32.const 0
    i64.const 1
    i64.store offset=2170040
    i32.const 0
    i64.const 1
    i64.store offset=2170032
    i32.const 0
    i32.const 0
    i32.store offset=2170048
    i32.const 0
    i64.const 0
    i64.store offset=2170076 align=4
    i32.const 0
    i64.const 0
    i64.store offset=2170068 align=4
    i32.const 0
    i64.const 0
    i64.store offset=2170060 align=4
    i32.const 0
    i32.const 0
    i32.store offset=2170084
    i32.const 0
    i32.const 1
    i32.store offset=2172740
    i32.const 0
    i32.const 0
    i32.store offset=2172704
    i32.const 0
    i32.const 1
    i32.store offset=2171952
    i32.const 0
    i32.const -1
    i32.store offset=2173524
    i32.const 0
    i64.const 0
    i64.store offset=2173504
    i32.const 0
    i32.const 0
    i32.store offset=2173512
    i32.const 0
    i32.const 0
    i32.store offset=2171940
    i32.const 0
    i32.const 0
    i32.store offset=2172708
    i32.const 0
    i32.const 1
    i32.store offset=2169948
    i32.const 0
    i32.const 0
    i32.store offset=2173520
    i32.const 0
    i32.const 0
    i32.store offset=2169940
    i32.const 0
    i32.const 2
    i32.store offset=2175244
    i32.const 0
    i32.const 0
    i32.store offset=2173516
    i32.const 0
    i32.const 1
    i32.store offset=2172780
    i32.const 0
    i32.const 1
    i32.store offset=2172744
    i32.const 0
    i32.const 1
    i32.store offset=2172000
    i32.const 0
    i32.const 2
    i32.store offset=2175248
    i32.const 0
    i32.const 1
    i32.store offset=2171988
    i32.const 0
    i32.const 1
    i32.store offset=2173548
    i32.const 0
    i32.const 1
    i32.store offset=2173536
    i32.const 0
    i64.const 4294967297
    i64.store offset=2173528
    i32.const 0
    i32.const 1
    i32.store offset=2172748
    i32.const 0
    i32.const 1
    i32.store offset=2170004
    i32.const 0
    i32.const 1
    i32.store offset=2173544
    i32.const 0
    i32.const 1
    i32.store offset=2169996
    i32.const 0
    i32.const 1
    i32.store offset=2173540
    local.get $l4
    i64.const 8589934593
    i64.store offset=8
    local.get $l4
    i64.const 8589934592
    i64.store
    i32.const 2169344
    i32.const 2
    local.get $l4
    i32.const 66080
    i32.const 4
    call $add_loop
    i32.const 0
    i32.const 0
    i64.load offset=2175256
    i64.const 1
    i64.add
    i64.store offset=2175256
    i32.const 0
    i32.const 0
    i64.load offset=2175272
    i64.const 1
    i64.add
    i64.store offset=2175272
    local.get $l4
    i32.const 16
    i32.add
    global.set $__stack_pointer)
  (func $boolean_cut (type $t3) (param $p0 f64) (param $p1 f64) (param $p2 f64) (param $p3 i32) (result i32)
    (local $l4 i32) (local $l5 i32) (local $l6 f64) (local $l7 f64) (local $l8 i64) (local $l9 i64) (local $l10 f64) (local $l11 f64) (local $l12 f64) (local $l13 f64) (local $l14 f64) (local $l15 f64) (local $l16 f64) (local $l17 f64) (local $l18 i32) (local $l19 i32) (local $l20 i32) (local $l21 i32) (local $l22 i32) (local $l23 i32) (local $l24 i32)
    global.get $__stack_pointer
    i32.const 48
    i32.sub
    local.tee $l4
    global.set $__stack_pointer
    i32.const 0
    local.set $l5
    block $B0
      i32.const 2169344
      local.get $l4
      i32.const 32
      i32.add
      call $validate_brep
      i32.eqz
      br_if $B0
      local.get $l4
      i32.load offset=40
      br_if $B0
      local.get $p1
      local.get $p2
      f64.sub
      local.set $l6
      local.get $p0
      local.get $p2
      f64.sub
      local.set $l7
      local.get $p3
      i64.load
      local.tee $l8
      i64.const 1
      i64.add
      local.set $l9
      local.get $l8
      i64.const 32
      i64.add
      local.set $l8
      local.get $p2
      local.get $p2
      f64.mul
      f64.const 0x1.203af9ee75616p-50 (;=1e-15;)
      f64.add
      local.set $l10
      i32.const 0
      f64.load offset=2172072
      local.set $l11
      i32.const 0
      f64.load offset=2172064
      local.set $l12
      i32.const 0
      f64.load offset=2172056
      local.set $l13
      i32.const -256
      local.set $l5
      block $B1
        loop $L2
          local.get $l11
          local.get $l5
          i32.const 66080
          i32.add
          f64.load
          f64.mul
          local.get $l12
          f64.add
          local.set $l14
          block $B3
            block $B4
              local.get $l11
              local.get $l5
              i32.const 65824
              i32.add
              f64.load
              f64.mul
              local.get $l13
              f64.add
              local.tee $l15
              local.get $p2
              f64.lt
              i32.eqz
              br_if $B4
              local.get $p2
              local.get $l15
              f64.sub
              local.set $l16
              br $B3
            end
            f64.const 0x0p+0 (;=0;)
            local.set $l16
            local.get $l15
            local.get $l7
            f64.gt
            i32.eqz
            br_if $B3
            local.get $l15
            local.get $l7
            f64.sub
            local.set $l16
          end
          block $B5
            block $B6
              local.get $l14
              local.get $p2
              f64.lt
              i32.eqz
              br_if $B6
              local.get $p2
              local.get $l14
              f64.sub
              local.set $l17
              br $B5
            end
            f64.const 0x0p+0 (;=0;)
            local.set $l17
            local.get $l14
            local.get $l6
            f64.gt
            i32.eqz
            br_if $B5
            local.get $l14
            local.get $l6
            f64.sub
            local.set $l17
          end
          block $B7
            local.get $l15
            f64.const 0x0p+0 (;=0;)
            f64.lt
            br_if $B7
            local.get $l15
            local.get $p0
            f64.gt
            br_if $B7
            local.get $l14
            f64.const 0x0p+0 (;=0;)
            f64.lt
            br_if $B7
            local.get $l14
            local.get $p1
            f64.gt
            br_if $B7
            local.get $l16
            local.get $l16
            f64.mul
            local.get $l17
            local.get $l17
            f64.mul
            f64.add
            local.get $l10
            f64.gt
            br_if $B7
            local.get $l9
            i64.const 1
            i64.add
            local.set $l9
            local.get $l5
            i32.const 8
            i32.add
            local.tee $l5
            i32.eqz
            br_if $B1
            br $L2
          end
        end
        local.get $p3
        local.get $l9
        i64.store
        i32.const 0
        local.set $l5
        br $B0
      end
      local.get $p3
      local.get $l8
      i64.store
      i32.const 0
      i32.const 0
      i32.load offset=2169280
      local.tee $p3
      i32.const 2
      i32.add
      i32.store offset=2169280
      local.get $p3
      i32.const 24
      i32.mul
      local.tee $l5
      i32.const 0
      f64.load offset=2169360
      f64.store offset=2163408
      local.get $l5
      i32.const 0
      f64.load offset=2169352
      f64.store offset=2163400
      local.get $l5
      i32.const 0
      f64.load offset=2169344
      f64.store offset=2163392
      i32.const 0
      i32.const 0
      i32.load offset=2169288
      local.tee $l18
      i32.const 1
      i32.add
      i32.store offset=2169288
      local.get $l18
      i32.const 48
      i32.mul
      local.tee $l19
      i32.const 2
      i32.store offset=2165984
      local.get $l19
      local.get $l13
      f64.store offset=2166008
      local.get $l19
      local.get $l12
      f64.store offset=2166016
      local.get $l19
      local.get $l11
      f64.store offset=2166024
      local.get $l5
      i32.const 2163432
      i32.add
      i32.const 0
      f64.load offset=2169384
      f64.store
      local.get $l5
      i32.const 2163424
      i32.add
      i32.const 0
      f64.load offset=2169376
      f64.store
      local.get $l5
      i32.const 2163416
      i32.add
      i32.const 0
      f64.load offset=2169368
      f64.store
      local.get $l19
      i32.const 0
      i32.store offset=2166000
      i32.const 0
      i32.const 0
      i32.load offset=2169284
      local.tee $l19
      i32.const 3
      i32.add
      i32.store offset=2169284
      local.get $l19
      i32.const 56
      i32.mul
      local.tee $l5
      local.get $p3
      i32.store offset=2163972
      local.get $l5
      i32.const 2
      i32.store offset=2163968
      local.get $l5
      local.get $l13
      f64.store offset=2164000
      local.get $l5
      local.get $l12
      f64.store offset=2164008
      local.get $l5
      local.get $l11
      f64.store offset=2164016
      local.get $l5
      local.get $p3
      i32.store offset=2163976
      local.get $l5
      i32.const 0
      i32.store offset=2163996
      local.get $l5
      i64.const 137438953472
      i64.store offset=2163980 align=4
      local.get $l5
      i32.const 2164072
      i32.add
      local.get $l11
      f64.store
      local.get $l5
      i32.const 2164064
      i32.add
      local.get $l12
      f64.store
      local.get $l5
      i32.const 2164056
      i32.add
      local.get $l13
      f64.store
      local.get $l5
      i32.const 2164032
      i32.add
      local.get $p3
      i32.const 1
      i32.add
      local.tee $l20
      i32.store
      local.get $l5
      i32.const 2164028
      i32.add
      local.get $l20
      i32.store
      local.get $l5
      i32.const 2164024
      i32.add
      local.tee $l21
      i32.const 2
      i32.store
      local.get $l5
      i32.const 2164052
      i32.add
      local.tee $l22
      i32.const 0
      i32.store
      local.get $l5
      i32.const 2164036
      i32.add
      i64.const 137438953472
      i64.store align=4
      local.get $l5
      i32.const 2164132
      i32.add
      i32.const 0
      i32.store
      local.get $l5
      i32.const 2164124
      i32.add
      i64.const 0
      i64.store align=4
      local.get $l5
      i32.const 2164116
      i32.add
      i64.const 0
      i64.store align=4
      local.get $l5
      i32.const 2164108
      i32.add
      i64.const 0
      i64.store align=4
      local.get $l5
      i32.const 2164092
      i32.add
      i64.const 0
      i64.store align=4
      local.get $l5
      i32.const 2164088
      i32.add
      local.get $l20
      i32.store
      local.get $l5
      i32.const 2164084
      i32.add
      local.get $p3
      i32.store
      local.get $l5
      i32.const 2164080
      i32.add
      i32.const 1
      i32.store
      i32.const 0
      i32.const 0
      i32.load offset=2166000
      local.tee $l23
      i32.const 1
      i32.add
      i32.store offset=2166000
      i32.const 0
      i32.const 0
      i32.load offset=2169292
      local.tee $p3
      i32.const 1
      i32.add
      i32.store offset=2169292
      local.get $p3
      i32.const 40
      i32.mul
      local.tee $l20
      i32.const 1
      i32.store offset=2166788
      local.get $l20
      i32.const 0
      i32.store offset=2166752
      local.get $l23
      i32.const 2
      i32.shl
      local.get $p3
      i32.store offset=2165988
      i32.const 0
      i32.load offset=2169296
      local.tee $l23
      i32.const 24
      i32.mul
      local.tee $l24
      i32.const 1
      i32.store offset=2167572
      local.get $l24
      i32.const 0
      i32.store offset=2167556
      local.get $l20
      local.get $l23
      i32.store offset=2166756
      local.get $l24
      local.get $p3
      i32.store offset=2167560
      local.get $l24
      local.get $l19
      i32.store offset=2167552
      i32.const 0
      local.get $l23
      i32.const 1
      i32.add
      i32.store offset=2169296
      local.get $l5
      local.get $l5
      i32.load offset=2163996
      local.tee $p3
      i32.const 1
      i32.add
      i32.store offset=2163996
      local.get $l5
      i32.const 2163968
      i32.add
      local.get $p3
      i32.const 2
      i32.shl
      i32.add
      local.get $l23
      i32.store offset=20
      local.get $l20
      i32.load offset=2166756
      local.tee $l5
      i32.const 24
      i32.mul
      local.tee $p3
      local.get $l5
      i32.store offset=2167568
      local.get $p3
      local.get $l5
      i32.store offset=2167564
      i32.const 0
      i32.const 0
      i32.load offset=2169292
      local.tee $l5
      i32.const 1
      i32.add
      i32.store offset=2169292
      local.get $l5
      i32.const 40
      i32.mul
      local.tee $p3
      i32.const 1
      i32.store offset=2166788
      local.get $p3
      i32.const 1
      i32.store offset=2166752
      i32.const 0
      i32.const 0
      i32.load offset=2166048
      local.tee $l20
      i32.const 1
      i32.add
      i32.store offset=2166048
      local.get $l20
      i32.const 2
      i32.shl
      local.get $l5
      i32.store offset=2166036
      i32.const 0
      i32.load offset=2169296
      local.tee $l20
      i32.const 24
      i32.mul
      local.tee $l23
      i32.const -1
      i32.store offset=2167572
      local.get $l23
      i32.const 1
      i32.store offset=2167556
      local.get $p3
      local.get $l20
      i32.store offset=2166756
      local.get $l23
      local.get $l5
      i32.store offset=2167560
      local.get $l23
      local.get $l19
      i32.const 1
      i32.add
      local.tee $l24
      i32.store offset=2167552
      i32.const 0
      local.get $l20
      i32.const 1
      i32.add
      i32.store offset=2169296
      local.get $l22
      local.get $l22
      i32.load
      local.tee $l5
      i32.const 1
      i32.add
      i32.store
      local.get $l21
      local.get $l5
      i32.const 2
      i32.shl
      i32.add
      local.get $l20
      i32.store offset=20
      local.get $p3
      i32.load offset=2166756
      local.tee $l5
      i32.const 24
      i32.mul
      local.tee $p3
      local.get $l5
      i32.store offset=2167568
      local.get $p3
      local.get $l5
      i32.store offset=2167564
      local.get $l4
      local.get $l19
      i32.const 2
      i32.add
      local.tee $l5
      i32.store offset=28
      local.get $l4
      local.get $l24
      i32.store offset=24
      local.get $l4
      local.get $l5
      i32.store offset=20
      local.get $l4
      local.get $l19
      i32.store offset=16
      i32.const 2163392
      local.get $l18
      local.get $l4
      i32.const 16
      i32.add
      i32.const 66096
      i32.const 4
      call $add_loop
      i32.const 0
      i32.const 0
      i32.load offset=2169300
      i32.const 1
      i32.add
      i32.store offset=2169300
      i32.const 0
      i32.const 0
      i64.load offset=2169304
      i64.const 2
      i64.add
      i64.store offset=2169304
      i32.const 0
      i32.const 0
      i64.load offset=2169320
      i64.const 1
      i64.add
      i64.store offset=2169320
      i32.const 0
      i32.const 0
      i64.load offset=2169328
      i64.const 1
      i64.add
      i64.store offset=2169328
      i32.const 2163392
      local.get $l4
      call $validate_brep
      local.set $l5
    end
    local.get $l4
    i32.const 48
    i32.add
    global.set $__stack_pointer
    local.get $l5)
  (func $fillet_vertical_edges (type $t4) (param $p0 f64) (param $p1 f64) (param $p2 f64) (param $p3 f64) (result i32)
    (local $l4 i32) (local $l5 i32) (local $l6 i32) (local $l7 i32) (local $l8 f64) (local $l9 f64) (local $l10 i32) (local $l11 i32) (local $l12 i64) (local $l13 i64) (local $l14 i32) (local $l15 i32) (local $l16 i32) (local $l17 i32) (local $l18 i32) (local $l19 i32) (local $l20 i32) (local $l21 i32) (local $l22 i32) (local $l23 i32) (local $l24 i32) (local $l25 i32) (local $l26 i32) (local $l27 i32) (local $l28 i32) (local $l29 i32) (local $l30 i32)
    global.get $__stack_pointer
    i32.const 144
    i32.sub
    local.tee $l4
    global.set $__stack_pointer
    i32.const 1
    local.set $l5
    block $B0
      local.get $p3
      f64.const 0x0p+0 (;=0;)
      f64.eq
      br_if $B0
      i32.const 0
      local.set $l5
      i32.const 0
      i32.load offset=2169280
      local.tee $l6
      i32.const 24
      i32.mul
      local.tee $l7
      i64.const 0
      i64.store offset=2163400
      local.get $l7
      local.get $p0
      local.get $p3
      f64.sub
      local.tee $l8
      f64.store offset=2163392
      local.get $l7
      i64.const 0
      i64.store offset=2163408
      local.get $l7
      i32.const 2163432
      i32.add
      local.get $p2
      f64.store
      local.get $l7
      i32.const 2163424
      i32.add
      i64.const 0
      i64.store
      local.get $l7
      i32.const 2163416
      i32.add
      local.get $l8
      f64.store
      local.get $l7
      i32.const 2163456
      i32.add
      i64.const 0
      i64.store
      local.get $l7
      i32.const 2163448
      i32.add
      local.get $p1
      local.get $p3
      f64.sub
      local.tee $l9
      f64.store
      local.get $l7
      i32.const 2163440
      i32.add
      local.get $p0
      f64.store
      local.get $l7
      i32.const 2163480
      i32.add
      local.get $p2
      f64.store
      local.get $l7
      i32.const 2163472
      i32.add
      local.get $l9
      f64.store
      local.get $l7
      i32.const 2163464
      i32.add
      local.get $p0
      f64.store
      local.get $l7
      i32.const 2163504
      i32.add
      i64.const 0
      i64.store
      local.get $l7
      i32.const 2163496
      i32.add
      local.get $p1
      f64.store
      local.get $l7
      i32.const 2163488
      i32.add
      local.get $p3
      f64.store
      local.get $l7
      i32.const 2163528
      i32.add
      local.get $p2
      f64.store
      local.get $l7
      i32.const 2163520
      i32.add
      local.get $p1
      f64.store
      local.get $l7
      i32.const 2163512
      i32.add
      local.get $p3
      f64.store
      i32.const 0
      i32.load offset=2169300
      local.set $l10
      local.get $l7
      i32.const 2163544
      i32.add
      local.get $p3
      f64.store
      local.get $l7
      i32.const 2163568
      i32.add
      local.get $p3
      f64.store
      local.get $l7
      i32.const 2163576
      i32.add
      local.get $p2
      f64.store
      local.get $l7
      i32.const 2163560
      i32.add
      i64.const 0
      i64.store
      local.get $l7
      i32.const 2163552
      i32.add
      i64.const 0
      i64.store
      local.get $l7
      i32.const 2163536
      i32.add
      i64.const 0
      i64.store
      i32.const 0
      local.get $l6
      i32.const 8
      i32.add
      i32.store offset=2169280
      i32.const 0
      i64.const 0
      i64.store offset=2163496
      i32.const 0
      local.get $p3
      f64.store offset=2163520
      i32.const 0
      local.get $p3
      f64.store offset=2163424
      i32.const 0
      local.get $p1
      f64.store offset=2163544
      i32.const 0
      i64.const 0
      i64.store offset=2163400
      i32.const 0
      i64.const 0
      i64.store offset=2163408
      i32.const 0
      local.get $p2
      f64.store offset=2163504
      i32.const 0
      local.get $p2
      f64.store offset=2163528
      i32.const 0
      i64.const 0
      i64.store offset=2163432
      i32.const 0
      local.get $p2
      f64.store offset=2163552
      i32.const 0
      i64.const 0
      i64.store offset=2163456
      i32.const 0
      local.get $p1
      f64.store offset=2163448
      i32.const 0
      local.get $p3
      f64.store offset=2163392
      i32.const 0
      local.get $p3
      f64.store offset=2163488
      i32.const 0
      local.get $p0
      f64.store offset=2163416
      i32.const 0
      local.get $p0
      f64.store offset=2163512
      i32.const 0
      local.get $l8
      f64.store offset=2163440
      i32.const 0
      local.get $l8
      f64.store offset=2163536
      i32.const 0
      i64.const 0
      i64.store offset=2163480
      i32.const 0
      local.get $p2
      f64.store offset=2163576
      i32.const 0
      local.get $l9
      f64.store offset=2163568
      i32.const 0
      i64.const 0
      i64.store offset=2163560
      i32.const 0
      local.get $l9
      f64.store offset=2163472
      i32.const 0
      i64.const 0
      i64.store offset=2163464
      i32.const 0
      i64.const 1
      i64.store offset=2163968
      i32.const 0
      i64.const 0
      i64.store offset=2164000
      i32.const 0
      i64.const 0
      i64.store offset=2164008
      i32.const 0
      local.get $l6
      i32.store offset=2163976
      i32.const 0
      local.get $p3
      f64.store offset=2164016
      i32.const 0
      i64.const 17179869185
      i64.store offset=2164192
      i32.const 0
      i64.const 0
      i64.store offset=2163980 align=4
      i32.const 0
      local.get $l6
      i32.const 1
      i32.add
      local.tee $l11
      i32.store offset=2164200
      i32.const 0
      i64.const 0
      i64.store offset=2164232
      i32.const 0
      i64.const 0
      i64.store offset=2164224
      i32.const 0
      local.get $p3
      f64.store offset=2164240
      local.get $l4
      i32.const 4
      i32.store offset=112
      i32.const 0
      i32.const 0
      i32.store offset=2163996
      i32.const 0
      i64.load offset=2169304
      local.set $l12
      i32.const 0
      i64.load offset=2169336
      local.set $l13
      i32.const 0
      i32.load offset=2169288
      local.set $l14
      i32.const 0
      i32.load offset=2169284
      local.set $l15
      i32.const 0
      i32.const 1
      i32.store offset=2164416
      i32.const 0
      i64.const 0
      i64.store offset=2164204 align=4
      i32.const 0
      i32.const 0
      i32.store offset=2164220
      i32.const 0
      i32.const 0
      i32.store offset=2164420
      i32.const 0
      i32.const 4
      i32.store offset=2164424
      i32.const 0
      i32.const 0
      i32.store offset=2164428
      i32.const 0
      i32.const 0
      i32.store offset=2164432
      i32.const 0
      i64.const 0
      i64.store offset=2164460 align=4
      i32.const 0
      i64.const 0
      i64.store offset=2164452 align=4
      i32.const 0
      i64.const 0
      i64.store offset=2164444 align=4
      i32.const 0
      i32.const 0
      i32.store offset=2164468
      i32.const 0
      i32.const 1
      i32.store offset=2166080
      local.get $l15
      i32.const 56
      i32.mul
      local.tee $l7
      i32.const 2
      i32.store offset=2163968
      local.get $l7
      local.get $l6
      i32.store offset=2163972
      local.get $l7
      i32.const 1
      i32.store offset=2163976
      local.get $l7
      i32.const 24
      i32.store offset=2163980
      local.get $l7
      i32.const 8
      i32.store offset=2163984
      local.get $l7
      local.get $p3
      f64.store offset=2164016
      local.get $l7
      local.get $l8
      f64.store offset=2164000
      local.get $l7
      i32.const 0
      i32.store offset=2163996
      local.get $l7
      i32.const 2164072
      i32.add
      local.get $p3
      f64.store
      local.get $l7
      i32.const 2164064
      i32.add
      local.get $p3
      f64.store
      local.get $l7
      i32.const 2164056
      i32.add
      local.get $l8
      f64.store
      local.get $l7
      i32.const 2164032
      i32.add
      i32.const 5
      i32.store
      local.get $l7
      i32.const 2164028
      i32.add
      local.get $l11
      i32.store
      local.get $l7
      i32.const 2164024
      i32.add
      i32.const 2
      i32.store
      local.get $l7
      i32.const 2164052
      i32.add
      i32.const 0
      i32.store
      local.get $l7
      i32.const 2164036
      i32.add
      i64.const 34359738392
      i64.store align=4
      local.get $l7
      local.get $p3
      f64.store offset=2164008
      local.get $l7
      i32.const 2164088
      i32.add
      local.get $l11
      i32.store
      local.get $l7
      i32.const 2164084
      i32.add
      local.get $l6
      i32.store
      local.get $l7
      i32.const 2164092
      i32.add
      i64.const 0
      i64.store align=4
      local.get $l7
      i32.const 2164080
      i32.add
      i32.const 1
      i32.store
      local.get $l7
      i32.const 2164108
      i32.add
      i64.const 0
      i64.store align=4
      local.get $l7
      i32.const 2164116
      i32.add
      i64.const 0
      i64.store align=4
      local.get $l7
      i32.const 2164124
      i32.add
      i64.const 0
      i64.store align=4
      local.get $l7
      i32.const 2164132
      i32.add
      i32.const 0
      i32.store
      i32.const 0
      i64.const 0
      i64.store offset=2164056
      i32.const 0
      i64.const 0
      i64.store offset=2164064
      i32.const 0
      i64.const 0
      i64.store offset=2164288
      i32.const 0
      i64.const 0
      i64.store offset=2164280
      i32.const 0
      i64.const 21474836481
      i64.store offset=2164248
      i32.const 0
      i64.const 0
      i64.store offset=2164036 align=4
      i32.const 0
      i64.const 4294967297
      i64.store offset=2164024
      i32.const 0
      local.get $l6
      i32.const 2
      i32.add
      local.tee $l16
      i32.store offset=2164032
      i32.const 0
      local.get $l6
      i32.const 3
      i32.add
      local.tee $l17
      i32.store offset=2164256
      local.get $l14
      i32.const 48
      i32.mul
      local.tee $l11
      local.get $p3
      f64.store offset=2166024
      local.get $l11
      local.get $p3
      f64.store offset=2166016
      local.get $l11
      local.get $l8
      f64.store offset=2166008
      local.get $l11
      i32.const 0
      i32.store offset=2166000
      i32.const 0
      local.get $p3
      f64.store offset=2164296
      i32.const 0
      local.get $p3
      f64.store offset=2164072
      local.get $l11
      i32.const 2
      i32.store offset=2165984
      local.get $l4
      local.get $l15
      i32.const 1
      i32.add
      local.tee $l18
      i32.store offset=116
      local.get $l4
      i32.const 5
      i32.store offset=120
      i32.const 0
      i32.const 0
      i32.store offset=2164052
      i32.const 0
      i64.const 5
      i64.store offset=2164480
      i32.const 0
      i64.const 4294967297
      i64.store offset=2164472
      i32.const 0
      i64.const 0
      i64.store offset=2164260 align=4
      i32.const 0
      i64.const 0
      i64.store offset=2164516 align=4
      i32.const 0
      i64.const 0
      i64.store offset=2164508 align=4
      i32.const 0
      i64.const 0
      i64.store offset=2164500 align=4
      i32.const 0
      i32.const 1
      i32.store offset=2166128
      i32.const 0
      i32.const 0
      i32.store offset=2164524
      local.get $l7
      i32.const 2164184
      i32.add
      local.get $p3
      f64.store
      local.get $l7
      i32.const 2164176
      i32.add
      local.get $l9
      f64.store
      local.get $l7
      i32.const 2164168
      i32.add
      local.get $l8
      f64.store
      local.get $l7
      i32.const 2164144
      i32.add
      i32.const 2
      i32.store
      local.get $l7
      i32.const 2164140
      i32.add
      local.get $l16
      i32.store
      local.get $l7
      i32.const 2164136
      i32.add
      i32.const 2
      i32.store
      i32.const 0
      i32.const 0
      i32.store offset=2164276
      local.get $l7
      i32.const 2164164
      i32.add
      i32.const 0
      i32.store
      local.get $l7
      i32.const 2164240
      i32.add
      local.get $p3
      f64.store
      local.get $l7
      i32.const 2164232
      i32.add
      local.get $l9
      f64.store
      local.get $l7
      i32.const 2164224
      i32.add
      local.get $l8
      f64.store
      local.get $l7
      i32.const 2164200
      i32.add
      i32.const 6
      i32.store
      local.get $l7
      i32.const 2164196
      i32.add
      local.get $l17
      i32.store
      local.get $l7
      i32.const 2164192
      i32.add
      i32.const 2
      i32.store
      local.get $l7
      i32.const 2164220
      i32.add
      i32.const 0
      i32.store
      i32.const 0
      i32.const 0
      i32.store offset=2164488
      local.get $l7
      i32.const 2164148
      i32.add
      i64.const 34359738368
      i64.store align=4
      local.get $l7
      i32.const 2164204
      i32.add
      i64.const 34359738368
      i64.store align=4
      local.get $l7
      i32.const 2164260
      i32.add
      i64.const 0
      i64.store align=4
      local.get $l7
      i32.const 2164276
      i32.add
      i64.const 0
      i64.store align=4
      local.get $l7
      i32.const 2164284
      i32.add
      i64.const 0
      i64.store align=4
      local.get $l7
      i32.const 2164292
      i32.add
      i64.const 0
      i64.store align=4
      local.get $l7
      i32.const 2164300
      i32.add
      i32.const 0
      i32.store
      local.get $l7
      i32.const 2164256
      i32.add
      local.get $l17
      i32.store
      local.get $l7
      i32.const 2164252
      i32.add
      local.get $l16
      i32.store
      local.get $l7
      i32.const 2164248
      i32.add
      i32.const 1
      i32.store
      local.get $l11
      i32.const 2166064
      i32.add
      local.get $l9
      f64.store
      local.get $l11
      i32.const 2166032
      i32.add
      i32.const 2
      i32.store
      local.get $l11
      i32.const 2166048
      i32.add
      i32.const 0
      i32.store
      local.get $l11
      i32.const 2166072
      i32.add
      local.get $p3
      f64.store
      local.get $l11
      i32.const 2166056
      i32.add
      local.get $l8
      f64.store
      i32.const 0
      i64.const 25769803777
      i64.store offset=2164304
      i32.const 0
      i64.const 0
      i64.store offset=2164092 align=4
      i32.const 0
      i64.const 8589934593
      i64.store offset=2164080
      i32.const 0
      local.get $l6
      i32.const 4
      i32.add
      local.tee $l16
      i32.store offset=2164088
      i32.const 0
      local.get $l6
      i32.const 5
      i32.add
      local.tee $l17
      i32.store offset=2164312
      i32.const 0
      local.get $p3
      f64.store offset=2164352
      i32.const 0
      local.get $p3
      f64.store offset=2164128
      i32.const 0
      i64.const 0
      i64.store offset=2164112
      i32.const 0
      i64.const 0
      i64.store offset=2164336
      i32.const 0
      i64.const 0
      i64.store offset=2164120
      i32.const 0
      i64.const 0
      i64.store offset=2164344
      i32.const 0
      i64.const 8589934593
      i64.store offset=2164528
      i32.const 0
      i64.const 0
      i64.store offset=2164316 align=4
      i32.const 0
      i64.const 6
      i64.store offset=2164536
      local.get $l4
      local.get $l15
      i32.const 4
      i32.add
      local.tee $l19
      i32.store offset=124
      local.get $l4
      i32.const 6
      i32.store offset=128
      i32.const 0
      i32.const 0
      i32.store offset=2164108
      i32.const 0
      i64.const 0
      i64.store offset=2164556 align=4
      i32.const 0
      i64.const 0
      i64.store offset=2164564 align=4
      i32.const 0
      i64.const 0
      i64.store offset=2164572 align=4
      i32.const 0
      i32.const 0
      i32.store offset=2164580
      local.get $l7
      i32.const 2164352
      i32.add
      local.get $p3
      f64.store
      local.get $l7
      i32.const 2164344
      i32.add
      local.get $l9
      f64.store
      local.get $l7
      i32.const 2164336
      i32.add
      local.get $p3
      f64.store
      local.get $l7
      i32.const 2164312
      i32.add
      i32.const 3
      i32.store
      local.get $l7
      i32.const 2164308
      i32.add
      local.get $l16
      i32.store
      local.get $l7
      i32.const 2164304
      i32.add
      i32.const 2
      i32.store
      i32.const 0
      i32.const 0
      i32.store offset=2164332
      local.get $l7
      i32.const 2164332
      i32.add
      i32.const 0
      i32.store
      local.get $l7
      i32.const 2164408
      i32.add
      local.get $p3
      f64.store
      local.get $l7
      i32.const 2164400
      i32.add
      local.get $l9
      f64.store
      local.get $l7
      i32.const 2164392
      i32.add
      local.get $p3
      f64.store
      local.get $l7
      i32.const 2164368
      i32.add
      i32.const 7
      i32.store
      local.get $l7
      i32.const 2164364
      i32.add
      local.get $l17
      i32.store
      local.get $l7
      i32.const 2164360
      i32.add
      i32.const 2
      i32.store
      local.get $l7
      i32.const 2164388
      i32.add
      i32.const 0
      i32.store
      i32.const 0
      i32.const 0
      i32.store offset=2164544
      i32.const 0
      i32.const 1
      i32.store offset=2166176
      local.get $l7
      i32.const 2164316
      i32.add
      i64.const 34359738376
      i64.store align=4
      local.get $l7
      i32.const 2164372
      i32.add
      i64.const 34359738376
      i64.store align=4
      local.get $l7
      i32.const 2164428
      i32.add
      i64.const 0
      i64.store align=4
      local.get $l7
      i32.const 2164444
      i32.add
      i64.const 0
      i64.store align=4
      local.get $l7
      i32.const 2164452
      i32.add
      i64.const 0
      i64.store align=4
      local.get $l7
      i32.const 2164460
      i32.add
      i64.const 0
      i64.store align=4
      local.get $l7
      i32.const 2164468
      i32.add
      i32.const 0
      i32.store
      local.get $l7
      i32.const 2164424
      i32.add
      local.get $l17
      i32.store
      local.get $l7
      i32.const 2164420
      i32.add
      local.get $l16
      i32.store
      local.get $l7
      i32.const 2164416
      i32.add
      i32.const 1
      i32.store
      local.get $l11
      i32.const 2166120
      i32.add
      local.get $p3
      f64.store
      local.get $l11
      i32.const 2166104
      i32.add
      local.get $p3
      f64.store
      local.get $l11
      i32.const 2166096
      i32.add
      i32.const 0
      i32.store
      local.get $l11
      i32.const 2166112
      i32.add
      local.get $l9
      f64.store
      local.get $l11
      i32.const 2166080
      i32.add
      i32.const 2
      i32.store
      i32.const 0
      i64.const 30064771073
      i64.store offset=2164360
      i32.const 0
      i64.const 0
      i64.store offset=2164148 align=4
      i32.const 0
      i64.const 12884901889
      i64.store offset=2164136
      i32.const 0
      local.get $l6
      i32.const 6
      i32.add
      local.tee $l16
      i32.store offset=2164144
      i32.const 0
      local.get $l6
      i32.const 7
      i32.add
      local.tee $l6
      i32.store offset=2164368
      i32.const 0
      local.get $p3
      f64.store offset=2164408
      i32.const 0
      local.get $p3
      f64.store offset=2164184
      i32.const 0
      i64.const 0
      i64.store offset=2164392
      i32.const 0
      i64.const 0
      i64.store offset=2164168
      i32.const 0
      i64.const 0
      i64.store offset=2164176
      i32.const 0
      i64.const 0
      i64.store offset=2164400
      i32.const 0
      i64.const 12884901889
      i64.store offset=2164584
      i32.const 0
      i64.const 0
      i64.store offset=2164372 align=4
      i32.const 0
      i64.const 7
      i64.store offset=2164592
      local.get $l4
      local.get $l15
      i32.const 7
      i32.add
      local.tee $l17
      i32.store offset=132
      local.get $l4
      i32.const 7
      i32.store offset=136
      i32.const 0
      i32.const 0
      i32.store offset=2164164
      i32.const 0
      i64.const 0
      i64.store offset=2164612 align=4
      i32.const 0
      i64.const 0
      i64.store offset=2164628 align=4
      i32.const 0
      i64.const 0
      i64.store offset=2164620 align=4
      i32.const 0
      i32.const 0
      i32.store offset=2164636
      local.get $l7
      i32.const 2164520
      i32.add
      local.get $p3
      f64.store
      local.get $l7
      i32.const 2164512
      i32.add
      local.get $p3
      f64.store
      local.get $l7
      i32.const 2164504
      i32.add
      local.get $p3
      f64.store
      local.get $l7
      i32.const 2164480
      i32.add
      i32.const 0
      i32.store
      local.get $l7
      i32.const 2164476
      i32.add
      local.get $l16
      i32.store
      local.get $l7
      i32.const 2164472
      i32.add
      i32.const 2
      i32.store
      i32.const 0
      i32.const 0
      i32.store offset=2164388
      local.get $l7
      i32.const 2164500
      i32.add
      i32.const 0
      i32.store
      local.get $l7
      i32.const 2164576
      i32.add
      local.get $p3
      f64.store
      local.get $l7
      i32.const 2164568
      i32.add
      local.get $p3
      f64.store
      local.get $l7
      i32.const 2164560
      i32.add
      local.get $p3
      f64.store
      local.get $l7
      i32.const 2164536
      i32.add
      i32.const 4
      i32.store
      local.get $l7
      i32.const 2164532
      i32.add
      local.get $l6
      i32.store
      local.get $l7
      i32.const 2164528
      i32.add
      i32.const 2
      i32.store
      local.get $l7
      i32.const 2164556
      i32.add
      i32.const 0
      i32.store
      i32.const 0
      i32.const 0
      i32.store offset=2164600
      i32.const 0
      i32.const 1
      i32.store offset=2166224
      local.get $l7
      i32.const 2164484
      i32.add
      i64.const 34359738384
      i64.store align=4
      local.get $l7
      i32.const 2164540
      i32.add
      i64.const 34359738384
      i64.store align=4
      i32.const 0
      local.get $l15
      i32.const 12
      i32.add
      i32.store offset=2169284
      local.get $l7
      i32.const 2164636
      i32.add
      i32.const 0
      i32.store
      local.get $l7
      i32.const 2164628
      i32.add
      i64.const 0
      i64.store align=4
      local.get $l7
      i32.const 2164620
      i32.add
      i64.const 0
      i64.store align=4
      local.get $l7
      i32.const 2164612
      i32.add
      i64.const 0
      i64.store align=4
      local.get $l7
      i32.const 2164596
      i32.add
      i64.const 0
      i64.store align=4
      local.get $l7
      i32.const 2164584
      i32.add
      i32.const 1
      i32.store
      local.get $l7
      i32.const 2164588
      i32.add
      local.get $l16
      i32.store
      local.get $l7
      i32.const 2164592
      i32.add
      local.get $l6
      i32.store
      local.get $l11
      i32.const 2166168
      i32.add
      local.get $p3
      f64.store
      local.get $l11
      i32.const 2166144
      i32.add
      i32.const 0
      i32.store
      i32.const 0
      local.get $l13
      i64.const 4
      i64.add
      i64.store offset=2169336
      i32.const 0
      local.get $l12
      i64.const 4
      i64.add
      i64.store offset=2169304
      local.get $l11
      i32.const 2166160
      i32.add
      local.get $p3
      f64.store
      local.get $l11
      i32.const 2166152
      i32.add
      local.get $p3
      f64.store
      local.get $l11
      i32.const 2166128
      i32.add
      i32.const 2
      i32.store
      i32.const 0
      local.get $l14
      i32.const 4
      i32.add
      i32.store offset=2169288
      local.get $l4
      local.get $l15
      i32.const 10
      i32.add
      local.tee $l16
      i32.store offset=140
      i32.const 0
      i32.load offset=2169280
      local.get $l10
      i32.const 1
      i32.shl
      i32.const 16
      i32.add
      i32.ne
      br_if $B0
      i32.const 0
      local.set $l5
      i32.const 0
      i32.load offset=2169284
      local.tee $l7
      local.get $l10
      i32.const 3
      i32.mul
      i32.const 24
      i32.add
      i32.ne
      br_if $B0
      i32.const 0
      local.set $l5
      i32.const 0
      i32.load offset=2169288
      local.tee $l20
      local.get $l10
      i32.const 10
      i32.add
      i32.ne
      br_if $B0
      i32.const 0
      local.set $l6
      i32.const 0
      i64.const 0
      i64.store offset=2169292 align=4
      block $B1
        local.get $l7
        i32.eqz
        br_if $B1
        local.get $l7
        i32.const 7
        i32.and
        local.set $l11
        block $B2
          local.get $l7
          i32.const 8
          i32.lt_u
          br_if $B2
          local.get $l7
          i32.const -8
          i32.and
          local.set $l5
          i32.const 2163392
          local.set $l7
          i32.const 0
          local.set $l6
          loop $L3
            local.get $l7
            i32.const 996
            i32.add
            i32.const 0
            i32.store
            local.get $l7
            i32.const 940
            i32.add
            i32.const 0
            i32.store
            local.get $l7
            i32.const 884
            i32.add
            i32.const 0
            i32.store
            local.get $l7
            i32.const 828
            i32.add
            i32.const 0
            i32.store
            local.get $l7
            i32.const 772
            i32.add
            i32.const 0
            i32.store
            local.get $l7
            i32.const 716
            i32.add
            i32.const 0
            i32.store
            local.get $l7
            i32.const 660
            i32.add
            i32.const 0
            i32.store
            local.get $l7
            i32.const 604
            i32.add
            i32.const 0
            i32.store
            local.get $l7
            i32.const 448
            i32.add
            local.set $l7
            local.get $l5
            local.get $l6
            i32.const 8
            i32.add
            local.tee $l6
            i32.ne
            br_if $L3
          end
          local.get $l11
          i32.eqz
          br_if $B1
        end
        local.get $l6
        i32.const 56
        i32.mul
        i32.const 2163996
        i32.add
        local.set $l7
        loop $L4
          local.get $l7
          i32.const 0
          i32.store
          local.get $l7
          i32.const 56
          i32.add
          local.set $l7
          local.get $l11
          i32.const -1
          i32.add
          local.tee $l11
          br_if $L4
        end
      end
      local.get $l15
      i32.const 11
      i32.add
      local.set $l21
      local.get $l14
      i32.const 3
      i32.add
      local.set $l22
      local.get $l15
      i32.const 9
      i32.add
      local.set $l23
      local.get $l15
      i32.const 8
      i32.add
      local.set $l24
      local.get $l14
      i32.const 2
      i32.add
      local.set $l25
      local.get $l15
      i32.const 6
      i32.add
      local.set $l26
      local.get $l15
      i32.const 5
      i32.add
      local.set $l27
      local.get $l14
      i32.const 1
      i32.add
      local.set $l28
      local.get $l15
      i32.const 3
      i32.add
      local.set $l29
      local.get $l15
      i32.const 2
      i32.add
      local.set $l30
      block $B5
        local.get $l20
        i32.eqz
        br_if $B5
        local.get $l20
        i32.const 7
        i32.and
        local.set $l11
        i32.const 0
        local.set $l6
        block $B6
          local.get $l20
          i32.const 8
          i32.lt_u
          br_if $B6
          local.get $l20
          i32.const -8
          i32.and
          local.set $l5
          i32.const 2163392
          local.set $l7
          i32.const 0
          local.set $l6
          loop $L7
            local.get $l7
            i32.const 2944
            i32.add
            i32.const 0
            i32.store
            local.get $l7
            i32.const 2896
            i32.add
            i32.const 0
            i32.store
            local.get $l7
            i32.const 2848
            i32.add
            i32.const 0
            i32.store
            local.get $l7
            i32.const 2800
            i32.add
            i32.const 0
            i32.store
            local.get $l7
            i32.const 2752
            i32.add
            i32.const 0
            i32.store
            local.get $l7
            i32.const 2704
            i32.add
            i32.const 0
            i32.store
            local.get $l7
            i32.const 2656
            i32.add
            i32.const 0
            i32.store
            local.get $l7
            i32.const 2608
            i32.add
            i32.const 0
            i32.store
            local.get $l7
            i32.const 384
            i32.add
            local.set $l7
            local.get $l5
            local.get $l6
            i32.const 8
            i32.add
            local.tee $l6
            i32.ne
            br_if $L7
          end
          local.get $l11
          i32.eqz
          br_if $B5
        end
        local.get $l6
        i32.const 48
        i32.mul
        i32.const 2166000
        i32.add
        local.set $l7
        loop $L8
          local.get $l7
          i32.const 0
          i32.store
          local.get $l7
          i32.const 48
          i32.add
          local.set $l7
          local.get $l11
          i32.const -1
          i32.add
          local.tee $l11
          br_if $L8
        end
      end
      local.get $l4
      local.get $l23
      i32.store offset=80
      local.get $l4
      i32.const 3
      i32.store offset=84
      local.get $l4
      local.get $l26
      i32.store offset=88
      local.get $l4
      i32.const 2
      i32.store offset=92
      local.get $l4
      local.get $l29
      i32.store offset=96
      local.get $l4
      i32.const 1
      i32.store offset=100
      local.get $l4
      local.get $l15
      i32.store offset=104
      local.get $l4
      i32.const 0
      i32.store offset=108
      local.get $l4
      i64.const -1
      i64.store offset=48
      local.get $l4
      i64.const -1
      i64.store offset=56
      local.get $l4
      i64.const -1
      i64.store offset=64
      local.get $l4
      i64.const -1
      i64.store offset=72
      local.get $l4
      i32.const 1
      i32.store offset=16
      local.get $l4
      i64.const 4294967297
      i64.store offset=20 align=4
      local.get $l4
      i64.const 4294967297
      i64.store offset=28 align=4
      local.get $l4
      i64.const 4294967297
      i64.store offset=36 align=4
      local.get $l4
      i32.const 1
      i32.store offset=44
      i32.const 2163392
      i32.const 0
      local.get $l4
      i32.const 80
      i32.add
      local.get $l4
      i32.const 48
      i32.add
      i32.const 8
      call $add_loop
      i32.const 2163392
      i32.const 1
      local.get $l4
      i32.const 112
      i32.add
      local.get $l4
      i32.const 16
      i32.add
      i32.const 8
      call $add_loop
      local.get $l4
      i64.const 34359738372
      i64.store offset=8
      local.get $l4
      local.get $l30
      i32.store offset=4
      local.get $l4
      i32.const 0
      i32.store
      i32.const 2163392
      i32.const 2
      local.get $l4
      i32.const 66080
      i32.const 4
      call $add_loop
      local.get $l4
      local.get $l30
      i32.store offset=12
      local.get $l4
      local.get $l18
      i32.store offset=8
      local.get $l4
      i32.const 9
      i32.store offset=4
      local.get $l4
      local.get $l15
      i32.store
      i32.const 2163392
      local.get $l14
      local.get $l4
      i32.const 66080
      i32.const 4
      call $add_loop
      local.get $l4
      i64.const 38654705669
      i64.store offset=8
      local.get $l4
      local.get $l27
      i32.store offset=4
      local.get $l4
      i32.const 1
      i32.store
      i32.const 2163392
      i32.const 3
      local.get $l4
      i32.const 66080
      i32.const 4
      call $add_loop
      local.get $l4
      local.get $l27
      i32.store offset=12
      local.get $l4
      local.get $l19
      i32.store offset=8
      local.get $l4
      i32.const 10
      i32.store offset=4
      local.get $l4
      local.get $l29
      i32.store
      i32.const 2163392
      local.get $l28
      local.get $l4
      i32.const 66080
      i32.const 4
      call $add_loop
      local.get $l4
      i64.const 42949672966
      i64.store offset=8
      local.get $l4
      local.get $l24
      i32.store offset=4
      local.get $l4
      i32.const 2
      i32.store
      i32.const 2163392
      i32.const 4
      local.get $l4
      i32.const 66080
      i32.const 4
      call $add_loop
      local.get $l4
      local.get $l24
      i32.store offset=12
      local.get $l4
      local.get $l17
      i32.store offset=8
      local.get $l4
      i32.const 11
      i32.store offset=4
      local.get $l4
      local.get $l26
      i32.store
      i32.const 2163392
      local.get $l25
      local.get $l4
      i32.const 66080
      i32.const 4
      call $add_loop
      local.get $l4
      i64.const 47244640263
      i64.store offset=8
      local.get $l4
      local.get $l21
      i32.store offset=4
      local.get $l4
      i32.const 3
      i32.store
      i32.const 2163392
      i32.const 5
      local.get $l4
      i32.const 66080
      i32.const 4
      call $add_loop
      local.get $l4
      local.get $l21
      i32.store offset=12
      local.get $l4
      local.get $l16
      i32.store offset=8
      local.get $l4
      i32.const 8
      i32.store offset=4
      local.get $l4
      local.get $l23
      i32.store
      i32.const 2163392
      local.get $l22
      local.get $l4
      i32.const 66080
      i32.const 4
      call $add_loop
      block $B9
        local.get $l10
        i32.eqz
        br_if $B9
        i32.const 14
        local.set $l7
        i32.const 2163392
        local.set $l11
        i32.const 0
        local.set $l16
        loop $L10
          i32.const 0
          i32.load offset=2169292
          local.tee $l6
          i32.const 40
          i32.mul
          local.tee $l15
          i32.const 1
          i32.store offset=2166788
          local.get $l15
          i32.const 0
          i32.store offset=2166752
          i32.const 0
          local.get $l6
          i32.const 1
          i32.add
          i32.store offset=2169292
          i32.const 0
          i32.const 0
          i32.load offset=2166000
          local.tee $l5
          i32.const 1
          i32.add
          i32.store offset=2166000
          local.get $l5
          i32.const 2
          i32.shl
          local.get $l6
          i32.store offset=2165988
          i32.const 0
          i32.load offset=2169296
          local.tee $l5
          i32.const 24
          i32.mul
          local.tee $l14
          i32.const 1
          i32.store offset=2167572
          local.get $l14
          i32.const 0
          i32.store offset=2167556
          local.get $l15
          local.get $l5
          i32.store offset=2166756
          local.get $l14
          local.get $l6
          i32.store offset=2167560
          local.get $l14
          local.get $l7
          i32.const -2
          i32.add
          local.tee $l17
          i32.store offset=2167552
          i32.const 0
          local.get $l5
          i32.const 1
          i32.add
          i32.store offset=2169296
          local.get $l11
          i32.const 1276
          i32.add
          local.tee $l6
          local.get $l6
          i32.load
          local.tee $l6
          i32.const 1
          i32.add
          i32.store
          local.get $l11
          local.get $l6
          i32.const 2
          i32.shl
          i32.add
          i32.const 1268
          i32.add
          local.get $l5
          i32.store
          local.get $l15
          i32.load offset=2166756
          local.tee $l6
          i32.const 24
          i32.mul
          local.tee $l15
          local.get $l6
          i32.store offset=2167568
          local.get $l15
          local.get $l6
          i32.store offset=2167564
          i32.const 0
          i32.const 0
          i32.load offset=2169292
          local.tee $l6
          i32.const 1
          i32.add
          i32.store offset=2169292
          local.get $l6
          i32.const 40
          i32.mul
          local.tee $l15
          i32.const 1
          i32.store offset=2166788
          local.get $l15
          i32.const 1
          i32.store offset=2166752
          i32.const 0
          i32.const 0
          i32.load offset=2166048
          local.tee $l5
          i32.const 1
          i32.add
          i32.store offset=2166048
          local.get $l5
          i32.const 2
          i32.shl
          local.get $l6
          i32.store offset=2166036
          i32.const 0
          i32.load offset=2169296
          local.tee $l5
          i32.const 24
          i32.mul
          local.tee $l14
          i32.const -1
          i32.store offset=2167572
          local.get $l14
          i32.const 1
          i32.store offset=2167556
          local.get $l15
          local.get $l5
          i32.store offset=2166756
          local.get $l14
          local.get $l6
          i32.store offset=2167560
          local.get $l14
          local.get $l7
          i32.const -1
          i32.add
          local.tee $l18
          i32.store offset=2167552
          i32.const 0
          local.get $l5
          i32.const 1
          i32.add
          i32.store offset=2169296
          local.get $l11
          i32.const 1332
          i32.add
          local.tee $l6
          local.get $l6
          i32.load
          local.tee $l6
          i32.const 1
          i32.add
          i32.store
          local.get $l11
          local.get $l6
          i32.const 2
          i32.shl
          i32.add
          i32.const 1324
          i32.add
          local.get $l5
          i32.store
          local.get $l15
          i32.load offset=2166756
          local.tee $l6
          i32.const 24
          i32.mul
          local.tee $l15
          local.get $l6
          i32.store offset=2167568
          local.get $l15
          local.get $l6
          i32.store offset=2167564
          local.get $l4
          local.get $l7
          i32.store offset=12
          local.get $l4
          local.get $l18
          i32.store offset=8
          local.get $l4
          local.get $l7
          i32.store offset=4
          local.get $l4
          local.get $l17
          i32.store
          i32.const 2163392
          local.get $l16
          i32.const 6
          i32.add
          local.get $l4
          i32.const 66096
          i32.const 4
          call $add_loop
          local.get $l11
          i32.const 168
          i32.add
          local.set $l11
          local.get $l7
          i32.const 3
          i32.add
          local.set $l7
          local.get $l10
          local.get $l16
          i32.const 1
          i32.add
          local.tee $l16
          i32.ne
          br_if $L10
        end
      end
      i32.const 2163392
      local.get $l4
      call $validate_brep
      local.set $l5
    end
    local.get $l4
    i32.const 144
    i32.add
    global.set $__stack_pointer
    local.get $l5)
  (func $validate_brep (type $t5) (param $p0 i32) (param $p1 i32) (result i32)
    (local $l2 i32) (local $l3 i32) (local $l4 i32) (local $l5 i32) (local $l6 i32) (local $l7 i32) (local $l8 i32) (local $l9 i32) (local $l10 i32) (local $l11 i32) (local $l12 i32) (local $l13 i32) (local $l14 i32) (local $l15 i32) (local $l16 i32) (local $l17 i32) (local $l18 i32) (local $l19 i32) (local $l20 i32)
    global.get $__stack_pointer
    i32.const 128
    i32.sub
    local.set $l2
    block $B0
      local.get $p0
      i32.load offset=5896
      local.tee $l3
      br_if $B0
      i32.const 0
      return
    end
    block $B1
      block $B2
        local.get $p0
        i32.load offset=5892
        local.tee $l4
        i32.eqz
        br_if $B2
        local.get $p0
        i32.const 604
        i32.add
        local.set $l5
        local.get $p0
        i32.const 4160
        i32.add
        local.set $l6
        local.get $p0
        i32.load offset=5888
        local.set $l7
        i32.const 0
        local.set $l8
        loop $L3
          block $B4
            local.get $l5
            i32.const -24
            i32.add
            i32.load
            local.get $l7
            i32.lt_u
            br_if $B4
            i32.const 0
            return
          end
          block $B5
            local.get $l5
            i32.const -20
            i32.add
            i32.load
            local.get $l7
            i32.lt_u
            br_if $B5
            i32.const 0
            return
          end
          block $B6
            local.get $l5
            i32.load
            i32.const 2
            i32.eq
            br_if $B6
            i32.const 0
            return
          end
          block $B7
            local.get $l8
            local.get $l6
            local.get $l5
            i32.const -8
            i32.add
            i32.load
            i32.const 24
            i32.mul
            i32.add
            local.tee $l9
            i32.load
            i32.eq
            br_if $B7
            i32.const 0
            return
          end
          block $B8
            local.get $l8
            local.get $l6
            local.get $l5
            i32.const -4
            i32.add
            i32.load
            i32.const 24
            i32.mul
            i32.add
            local.tee $l10
            i32.load
            i32.eq
            br_if $B8
            i32.const 0
            return
          end
          i32.const 0
          local.set $l11
          local.get $l9
          i32.load offset=20
          i32.const 0
          local.get $l10
          i32.load offset=20
          i32.sub
          i32.ne
          br_if $B1
          local.get $l5
          i32.const 56
          i32.add
          local.set $l5
          local.get $l4
          local.get $l8
          i32.const 1
          i32.add
          local.tee $l8
          i32.ne
          br_if $L3
        end
      end
      local.get $p0
      i32.const 4160
      i32.add
      local.set $l10
      local.get $p0
      i32.const 3360
      i32.add
      local.set $l12
      local.get $p0
      i32.const 2592
      i32.add
      local.set $l13
      i32.const 0
      local.set $l14
      loop $L9
        block $B10
          local.get $l13
          local.get $l14
          i32.const 48
          i32.mul
          i32.add
          local.tee $l5
          i32.load offset=16
          local.tee $l15
          br_if $B10
          i32.const 0
          return
        end
        local.get $l5
        i32.const 4
        i32.add
        local.set $l16
        local.get $p0
        i32.load offset=5900
        local.set $l17
        i32.const 0
        local.set $l18
        loop $L11
          block $B12
            local.get $l16
            local.get $l18
            i32.const 2
            i32.shl
            i32.add
            i32.load
            local.tee $l19
            local.get $l17
            i32.lt_u
            br_if $B12
            i32.const 0
            return
          end
          block $B13
            local.get $l12
            local.get $l19
            i32.const 40
            i32.mul
            i32.add
            local.tee $l7
            i32.load
            local.get $l14
            i32.eq
            br_if $B13
            i32.const 0
            return
          end
          block $B14
            local.get $l7
            i32.load offset=36
            local.tee $l5
            br_if $B14
            i32.const 0
            return
          end
          local.get $p0
          i32.load offset=5904
          local.set $l20
          i32.const 0
          local.set $l8
          local.get $l7
          i32.const 4
          i32.add
          local.tee $l9
          local.set $l6
          block $B15
            loop $L16
              local.get $l5
              local.get $l8
              i32.eq
              br_if $B15
              i32.const 0
              local.set $l11
              local.get $l6
              i32.load
              local.tee $l7
              local.get $l20
              i32.ge_u
              br_if $B1
              local.get $l10
              local.get $l7
              i32.const 24
              i32.mul
              i32.add
              local.tee $l7
              i32.load offset=4
              local.get $l14
              i32.ne
              br_if $B1
              local.get $l7
              i32.load offset=8
              local.get $l19
              i32.ne
              br_if $B1
              local.get $l7
              i32.load offset=16
              local.get $l9
              local.get $l5
              local.get $l8
              i32.add
              i32.const -1
              i32.add
              local.get $l5
              i32.rem_u
              i32.const 2
              i32.shl
              i32.add
              i32.load
              i32.ne
              br_if $B1
              local.get $l6
              i32.const 4
              i32.add
              local.set $l6
              local.get $l7
              i32.load offset=12
              local.get $l9
              local.get $l8
              i32.const 1
              i32.add
              local.tee $l8
              local.get $l5
              i32.rem_u
              i32.const 2
              i32.shl
              i32.add
              i32.load
              i32.eq
              br_if $L16
              br $B1
            end
          end
          local.get $l18
          i32.const 1
          i32.add
          local.tee $l18
          local.get $l15
          i32.ne
          br_if $L11
        end
        local.get $l14
        i32.const 1
        i32.add
        local.tee $l14
        local.get $l3
        i32.ne
        br_if $L9
      end
      local.get $l2
      i64.const 0
      i64.store offset=120
      local.get $l2
      i64.const 0
      i64.store offset=112
      local.get $l2
      i64.const 0
      i64.store offset=104
      local.get $l2
      i64.const 0
      i64.store offset=96
      local.get $l2
      i64.const 0
      i64.store offset=88
      local.get $l2
      i64.const 0
      i64.store offset=80
      local.get $l2
      i64.const 0
      i64.store offset=72
      local.get $l2
      i64.const 0
      i64.store offset=64
      block $B17
        block $B18
          local.get $l4
          i32.eqz
          br_if $B18
          local.get $p0
          i32.const 600
          i32.add
          local.set $l19
          i32.const 0
          local.set $l18
          i32.const 0
          local.set $l20
          loop $L19
            block $B20
              local.get $l2
              i32.const 64
              i32.add
              local.get $l20
              i32.const 2
              i32.shl
              i32.add
              local.tee $l5
              i32.load
              br_if $B20
              i32.const 1
              local.set $l9
              local.get $l5
              i32.const 1
              i32.store
              local.get $l2
              local.get $l20
              i32.store
              i32.const 0
              local.set $l14
              loop $L21
                local.get $l2
                local.get $l14
                i32.const 2
                i32.shl
                i32.add
                i32.load
                local.set $l8
                local.get $l19
                local.set $l5
                local.get $l4
                local.set $l7
                loop $L22
                  block $B23
                    local.get $l10
                    local.get $l5
                    i32.load
                    i32.const 24
                    i32.mul
                    i32.add
                    i32.load offset=4
                    local.tee $l6
                    local.get $l10
                    local.get $l5
                    i32.const -4
                    i32.add
                    i32.load
                    i32.const 24
                    i32.mul
                    i32.add
                    i32.load offset=4
                    local.tee $l11
                    i32.const 16
                    local.get $l6
                    local.get $l8
                    i32.eq
                    select
                    local.get $l11
                    local.get $l8
                    i32.eq
                    select
                    local.tee $l6
                    local.get $l3
                    i32.ge_u
                    br_if $B23
                    local.get $l2
                    i32.const 64
                    i32.add
                    local.get $l6
                    i32.const 2
                    i32.shl
                    i32.add
                    local.tee $l11
                    i32.load
                    br_if $B23
                    local.get $l11
                    i32.const 1
                    i32.store
                    local.get $l2
                    local.get $l9
                    i32.const 2
                    i32.shl
                    i32.add
                    local.get $l6
                    i32.store
                    local.get $l9
                    i32.const 1
                    i32.add
                    local.set $l9
                  end
                  local.get $l5
                  i32.const 56
                  i32.add
                  local.set $l5
                  local.get $l7
                  i32.const -1
                  i32.add
                  local.tee $l7
                  br_if $L22
                end
                local.get $l14
                i32.const 1
                i32.add
                local.tee $l14
                local.get $l9
                i32.lt_u
                br_if $L21
              end
              local.get $l18
              i32.const 1
              i32.add
              local.set $l18
            end
            local.get $l20
            i32.const 1
            i32.add
            local.tee $l20
            local.get $l3
            i32.ne
            br_if $L19
            br $B17
          end
        end
        i32.const 0
        local.set $l18
        i32.const 0
        local.set $l8
        block $B24
          local.get $l3
          i32.const 1
          i32.eq
          br_if $B24
          local.get $l3
          i32.const 1
          i32.and
          local.set $l11
          local.get $l3
          i32.const -2
          i32.and
          local.set $l6
          i32.const 0
          local.set $l18
          local.get $l2
          i32.const 64
          i32.add
          local.set $l5
          i32.const 0
          local.set $l8
          loop $L25
            block $B26
              local.get $l5
              i32.load
              br_if $B26
              local.get $l5
              i32.const 1
              i32.store
              local.get $l18
              i32.const 1
              i32.add
              local.set $l18
            end
            block $B27
              local.get $l5
              i32.const 4
              i32.add
              local.tee $l7
              i32.load
              br_if $B27
              local.get $l7
              i32.const 1
              i32.store
              local.get $l18
              i32.const 1
              i32.add
              local.set $l18
            end
            local.get $l5
            i32.const 8
            i32.add
            local.set $l5
            local.get $l6
            local.get $l8
            i32.const 2
            i32.add
            local.tee $l8
            i32.ne
            br_if $L25
          end
          local.get $l11
          i32.eqz
          br_if $B17
        end
        local.get $l2
        i32.const 64
        i32.add
        local.get $l8
        i32.const 2
        i32.shl
        i32.add
        local.tee $l5
        i32.load
        br_if $B17
        local.get $l5
        i32.const 1
        i32.store
        local.get $l18
        i32.const 1
        i32.add
        local.set $l18
      end
      i32.const 0
      local.set $l11
      local.get $l18
      i32.const 1
      i32.shl
      local.get $l3
      local.get $l4
      i32.sub
      local.get $p0
      i32.load offset=5888
      i32.add
      local.get $l3
      local.get $l17
      i32.sub
      i32.add
      local.tee $l5
      i32.sub
      local.tee $l8
      i32.const -2147483647
      i32.and
      br_if $B1
      local.get $p1
      local.get $l5
      i32.store offset=12
      local.get $p1
      local.get $l18
      i32.store offset=4
      local.get $p1
      local.get $l18
      i32.store
      local.get $p1
      local.get $l8
      i32.const 1
      i32.shr_u
      i32.store offset=8
      i32.const 1
      local.set $l11
    end
    local.get $l11)
  (func $construct_face_loops_from_brep (type $t0) (result i32)
    (local $l0 i32) (local $l1 i32) (local $l2 i32) (local $l3 i32) (local $l4 i32) (local $l5 i32) (local $l6 i32) (local $l7 i32) (local $l8 i32) (local $l9 f64) (local $l10 f64) (local $l11 f64)
    i32.const 0
    local.set $l0
    block $B0
      i32.const 0
      i32.load offset=2166048
      local.tee $l1
      i32.const -4
      i32.add
      i32.const -3
      i32.lt_u
      br_if $B0
      i32.const 0
      local.set $l0
      block $B1
        i32.const 0
        i32.load offset=2166036
        i32.const 40
        i32.mul
        local.tee $l2
        i32.load offset=2166788
        local.tee $l3
        i32.eqz
        br_if $B1
        local.get $l2
        i32.const 2166752
        i32.add
        i32.const 4
        i32.add
        local.set $l4
        i32.const 0
        local.set $l5
        i32.const 0
        local.set $l0
        loop $L2
          local.get $l4
          local.get $l5
          i32.const 2
          i32.shl
          i32.add
          i32.load
          i32.const 24
          i32.mul
          local.tee $l2
          i32.load offset=2167552
          i32.const 56
          i32.mul
          local.tee $l6
          i32.const 2163968
          i32.add
          local.set $l7
          local.get $l2
          i32.load offset=2167572
          local.set $l8
          block $B3
            block $B4
              local.get $l6
              i32.load offset=2163968
              i32.const 1
              i32.ne
              br_if $B4
              local.get $l0
              i32.const 4
              i32.shl
              local.tee $l2
              local.get $l7
              i32.const 4
              i32.const 8
              local.get $l8
              i32.const 0
              i32.gt_s
              select
              i32.add
              i32.load
              i32.const 24
              i32.mul
              local.tee $l7
              f64.load offset=2163400
              f64.store offset=2175320
              local.get $l2
              local.get $l7
              f64.load offset=2163392
              f64.store offset=2175312
              local.get $l0
              i32.const 1
              i32.add
              local.set $l0
              br $B3
            end
            local.get $l7
            i32.load offset=16
            local.set $l2
            block $B5
              local.get $l8
              i32.const 1
              i32.lt_s
              br_if $B5
              local.get $l2
              i32.eqz
              br_if $B3
              local.get $l0
              local.get $l2
              i32.add
              local.set $l8
              local.get $l0
              i32.const 4
              i32.shl
              i32.const 2175312
              i32.add
              local.set $l0
              local.get $l7
              f64.load offset=40
              local.set $l9
              local.get $l7
              f64.load offset=48
              local.set $l10
              local.get $l7
              f64.load offset=32
              local.set $l11
              local.get $l7
              i32.load offset=12
              local.set $l7
              loop $L6
                local.get $l0
                i32.const 8
                i32.add
                local.get $l10
                local.get $l7
                i32.const 3
                i32.shl
                i32.const 248
                i32.and
                local.tee $l6
                f64.load offset=65824
                f64.mul
                local.get $l9
                f64.add
                f64.store
                local.get $l0
                local.get $l10
                local.get $l6
                f64.load offset=65568
                f64.mul
                local.get $l11
                f64.add
                f64.store
                local.get $l0
                i32.const 16
                i32.add
                local.set $l0
                local.get $l7
                i32.const 1
                i32.add
                local.set $l7
                local.get $l2
                i32.const -1
                i32.add
                local.tee $l2
                br_if $L6
              end
              local.get $l8
              local.set $l0
              br $B3
            end
            local.get $l2
            i32.eqz
            br_if $B3
            local.get $l0
            local.get $l2
            i32.add
            local.set $l8
            local.get $l0
            i32.const 4
            i32.shl
            i32.const 2175312
            i32.add
            local.set $l0
            local.get $l7
            f64.load offset=40
            local.set $l9
            local.get $l7
            f64.load offset=48
            local.set $l10
            local.get $l7
            f64.load offset=32
            local.set $l11
            local.get $l7
            i32.load offset=12
            local.set $l6
            loop $L7
              local.get $l0
              i32.const 8
              i32.add
              local.get $l10
              local.get $l6
              local.get $l2
              i32.add
              i32.const 31
              i32.and
              i32.const 3
              i32.shl
              local.tee $l7
              f64.load offset=65824
              f64.mul
              local.get $l9
              f64.add
              f64.store
              local.get $l0
              local.get $l10
              local.get $l7
              f64.load offset=65568
              f64.mul
              local.get $l11
              f64.add
              f64.store
              local.get $l0
              i32.const 16
              i32.add
              local.set $l0
              local.get $l2
              i32.const -1
              i32.add
              local.tee $l2
              br_if $L7
            end
            local.get $l8
            local.set $l0
          end
          local.get $l5
          i32.const 1
          i32.add
          local.tee $l5
          local.get $l3
          i32.ne
          br_if $L2
        end
      end
      i32.const 0
      local.get $l0
      i32.store offset=2175296
      block $B8
        local.get $l1
        i32.const 1
        i32.eq
        br_if $B8
        i32.const 0
        local.set $l0
        block $B9
          i32.const 0
          i32.load offset=2166040
          i32.const 40
          i32.mul
          local.tee $l2
          i32.load offset=2166788
          local.tee $l3
          i32.eqz
          br_if $B9
          local.get $l2
          i32.const 2166752
          i32.add
          i32.const 4
          i32.add
          local.set $l4
          i32.const 0
          local.set $l5
          i32.const 0
          local.set $l0
          loop $L10
            local.get $l4
            local.get $l5
            i32.const 2
            i32.shl
            i32.add
            i32.load
            i32.const 24
            i32.mul
            local.tee $l2
            i32.load offset=2167552
            i32.const 56
            i32.mul
            local.tee $l6
            i32.const 2163968
            i32.add
            local.set $l7
            local.get $l2
            i32.load offset=2167572
            local.set $l8
            block $B11
              block $B12
                local.get $l6
                i32.load offset=2163968
                i32.const 1
                i32.eq
                br_if $B12
                local.get $l7
                i32.load offset=16
                local.set $l2
                block $B13
                  local.get $l8
                  i32.const 0
                  i32.gt_s
                  br_if $B13
                  local.get $l2
                  i32.eqz
                  br_if $B11
                  local.get $l0
                  local.get $l2
                  i32.add
                  local.set $l8
                  local.get $l0
                  i32.const 4
                  i32.shl
                  i32.const 2175960
                  i32.add
                  local.set $l0
                  local.get $l7
                  f64.load offset=40
                  local.set $l9
                  local.get $l7
                  f64.load offset=48
                  local.set $l10
                  local.get $l7
                  f64.load offset=32
                  local.set $l11
                  local.get $l7
                  i32.load offset=12
                  local.set $l6
                  loop $L14
                    local.get $l0
                    local.get $l10
                    local.get $l6
                    local.get $l2
                    i32.add
                    i32.const 31
                    i32.and
                    i32.const 3
                    i32.shl
                    local.tee $l7
                    f64.load offset=65824
                    f64.mul
                    local.get $l9
                    f64.add
                    f64.store
                    local.get $l0
                    i32.const -8
                    i32.add
                    local.get $l10
                    local.get $l7
                    f64.load offset=65568
                    f64.mul
                    local.get $l11
                    f64.add
                    f64.store
                    local.get $l0
                    i32.const 16
                    i32.add
                    local.set $l0
                    local.get $l2
                    i32.const -1
                    i32.add
                    local.tee $l2
                    br_if $L14
                  end
                  local.get $l8
                  local.set $l0
                  br $B11
                end
                local.get $l2
                i32.eqz
                br_if $B11
                local.get $l0
                local.get $l2
                i32.add
                local.set $l8
                local.get $l0
                i32.const 4
                i32.shl
                i32.const 2175960
                i32.add
                local.set $l0
                local.get $l7
                f64.load offset=40
                local.set $l9
                local.get $l7
                f64.load offset=48
                local.set $l10
                local.get $l7
                f64.load offset=32
                local.set $l11
                local.get $l7
                i32.load offset=12
                local.set $l7
                loop $L15
                  local.get $l0
                  local.get $l10
                  local.get $l7
                  i32.const 3
                  i32.shl
                  i32.const 248
                  i32.and
                  local.tee $l6
                  f64.load offset=65824
                  f64.mul
                  local.get $l9
                  f64.add
                  f64.store
                  local.get $l0
                  i32.const -8
                  i32.add
                  local.get $l10
                  local.get $l6
                  f64.load offset=65568
                  f64.mul
                  local.get $l11
                  f64.add
                  f64.store
                  local.get $l0
                  i32.const 16
                  i32.add
                  local.set $l0
                  local.get $l7
                  i32.const 1
                  i32.add
                  local.set $l7
                  local.get $l2
                  i32.const -1
                  i32.add
                  local.tee $l2
                  br_if $L15
                end
                local.get $l8
                local.set $l0
                br $B11
              end
              local.get $l0
              i32.const 4
              i32.shl
              local.tee $l2
              local.get $l7
              i32.const 4
              i32.const 8
              local.get $l8
              i32.const 0
              i32.gt_s
              select
              i32.add
              i32.load
              i32.const 24
              i32.mul
              local.tee $l7
              f64.load offset=2163400
              f64.store offset=2175960
              local.get $l2
              local.get $l7
              f64.load offset=2163392
              f64.store offset=2175952
              local.get $l0
              i32.const 1
              i32.add
              local.set $l0
            end
            local.get $l5
            i32.const 1
            i32.add
            local.tee $l5
            local.get $l3
            i32.ne
            br_if $L10
          end
        end
        i32.const 0
        local.get $l0
        i32.store offset=2175300
        local.get $l1
        i32.const 2
        i32.eq
        br_if $B8
        i32.const 0
        local.set $l0
        block $B16
          i32.const 0
          i32.load offset=2166044
          i32.const 40
          i32.mul
          local.tee $l2
          i32.load offset=2166788
          local.tee $l3
          i32.eqz
          br_if $B16
          local.get $l2
          i32.const 2166752
          i32.add
          i32.const 4
          i32.add
          local.set $l4
          i32.const 0
          local.set $l5
          i32.const 0
          local.set $l0
          loop $L17
            local.get $l4
            local.get $l5
            i32.const 2
            i32.shl
            i32.add
            i32.load
            i32.const 24
            i32.mul
            local.tee $l2
            i32.load offset=2167552
            i32.const 56
            i32.mul
            local.tee $l6
            i32.const 2163968
            i32.add
            local.set $l7
            local.get $l2
            i32.load offset=2167572
            local.set $l8
            block $B18
              block $B19
                local.get $l6
                i32.load offset=2163968
                i32.const 1
                i32.eq
                br_if $B19
                local.get $l7
                i32.load offset=16
                local.set $l2
                block $B20
                  local.get $l8
                  i32.const 0
                  i32.gt_s
                  br_if $B20
                  local.get $l2
                  i32.eqz
                  br_if $B18
                  local.get $l0
                  local.get $l2
                  i32.add
                  local.set $l8
                  local.get $l0
                  i32.const 4
                  i32.shl
                  i32.const 2176600
                  i32.add
                  local.set $l0
                  local.get $l7
                  f64.load offset=40
                  local.set $l9
                  local.get $l7
                  f64.load offset=48
                  local.set $l10
                  local.get $l7
                  f64.load offset=32
                  local.set $l11
                  local.get $l7
                  i32.load offset=12
                  local.set $l6
                  loop $L21
                    local.get $l0
                    local.get $l10
                    local.get $l6
                    local.get $l2
                    i32.add
                    i32.const 31
                    i32.and
                    i32.const 3
                    i32.shl
                    local.tee $l7
                    f64.load offset=65824
                    f64.mul
                    local.get $l9
                    f64.add
                    f64.store
                    local.get $l0
                    i32.const -8
                    i32.add
                    local.get $l10
                    local.get $l7
                    f64.load offset=65568
                    f64.mul
                    local.get $l11
                    f64.add
                    f64.store
                    local.get $l0
                    i32.const 16
                    i32.add
                    local.set $l0
                    local.get $l2
                    i32.const -1
                    i32.add
                    local.tee $l2
                    br_if $L21
                  end
                  local.get $l8
                  local.set $l0
                  br $B18
                end
                local.get $l2
                i32.eqz
                br_if $B18
                local.get $l0
                local.get $l2
                i32.add
                local.set $l8
                local.get $l0
                i32.const 4
                i32.shl
                i32.const 2176600
                i32.add
                local.set $l0
                local.get $l7
                f64.load offset=40
                local.set $l9
                local.get $l7
                f64.load offset=48
                local.set $l10
                local.get $l7
                f64.load offset=32
                local.set $l11
                local.get $l7
                i32.load offset=12
                local.set $l7
                loop $L22
                  local.get $l0
                  local.get $l10
                  local.get $l7
                  i32.const 3
                  i32.shl
                  i32.const 248
                  i32.and
                  local.tee $l6
                  f64.load offset=65824
                  f64.mul
                  local.get $l9
                  f64.add
                  f64.store
                  local.get $l0
                  i32.const -8
                  i32.add
                  local.get $l10
                  local.get $l6
                  f64.load offset=65568
                  f64.mul
                  local.get $l11
                  f64.add
                  f64.store
                  local.get $l0
                  i32.const 16
                  i32.add
                  local.set $l0
                  local.get $l7
                  i32.const 1
                  i32.add
                  local.set $l7
                  local.get $l2
                  i32.const -1
                  i32.add
                  local.tee $l2
                  br_if $L22
                end
                local.get $l8
                local.set $l0
                br $B18
              end
              local.get $l0
              i32.const 4
              i32.shl
              local.tee $l2
              local.get $l7
              i32.const 4
              i32.const 8
              local.get $l8
              i32.const 0
              i32.gt_s
              select
              i32.add
              i32.load
              i32.const 24
              i32.mul
              local.tee $l7
              f64.load offset=2163400
              f64.store offset=2176600
              local.get $l2
              local.get $l7
              f64.load offset=2163392
              f64.store offset=2176592
              local.get $l0
              i32.const 1
              i32.add
              local.set $l0
            end
            local.get $l5
            i32.const 1
            i32.add
            local.tee $l5
            local.get $l3
            i32.ne
            br_if $L17
          end
        end
        i32.const 0
        local.get $l0
        i32.store offset=2175304
      end
      local.get $l1
      local.set $l0
    end
    local.get $l0)
  (func $tessellate_faces (type $t6) (param $p0 i32) (param $p1 f64) (param $p2 i32) (param $p3 i32) (param $p4 i32) (result i32)
    (local $l5 i32) (local $l6 i32) (local $l7 i32) (local $l8 i32) (local $l9 i32) (local $l10 i32) (local $l11 i32) (local $l12 i32) (local $l13 i32) (local $l14 i32) (local $l15 i32) (local $l16 i32) (local $l17 i32) (local $l18 i32) (local $l19 i32) (local $l20 f64) (local $l21 f64) (local $l22 i32) (local $l23 i32) (local $l24 f64) (local $l25 f64) (local $l26 f64) (local $l27 i32) (local $l28 f64) (local $l29 f64) (local $l30 f64) (local $l31 f64) (local $l32 i64) (local $l33 i64) (local $l34 f64) (local $l35 f64) (local $l36 f64) (local $l37 f64) (local $l38 f64) (local $l39 f64) (local $l40 f64) (local $l41 f64) (local $l42 f64) (local $l43 f64) (local $l44 f64) (local $l45 f64)
    i32.const 2175312
    local.set $l5
    i32.const 0
    local.set $l6
    i32.const 0
    local.set $l7
    i32.const 0
    local.set $l8
    i32.const 0
    local.set $l9
    loop $L0
      block $B1
        local.get $l9
        i32.const 2
        i32.shl
        i32.load offset=2175296
        local.tee $l10
        i32.eqz
        br_if $B1
        local.get $l9
        i32.const 640
        i32.mul
        i32.const 2175312
        i32.add
        local.set $l11
        i32.const 0
        local.set $l12
        block $B2
          local.get $l10
          i32.const 1
          i32.eq
          br_if $B2
          local.get $l10
          i32.const -1
          i32.add
          local.set $l13
          local.get $l8
          i32.const 3
          i32.shl
          i32.const 3621392
          i32.add
          local.set $l14
          local.get $l7
          i32.const 3
          i32.shl
          i32.const 3620560
          i32.add
          local.set $l15
          local.get $l6
          i32.const 5
          i32.shl
          i32.const 3617232
          i32.add
          local.set $l16
          i32.const 0
          local.set $l12
          local.get $l5
          local.set $l17
          loop $L3
            local.get $l16
            local.get $l17
            i64.load
            i64.store
            local.get $l14
            local.get $l17
            f64.load
            f64.store
            local.get $l16
            local.get $l17
            i32.const 8
            i32.add
            local.tee $l18
            i64.load
            i64.store offset=8
            local.get $l16
            i32.const 16
            i32.add
            local.get $l17
            i32.const 16
            i32.add
            local.tee $l19
            i64.load
            i64.store
            local.get $l16
            i32.const 24
            i32.add
            local.get $l17
            i32.const 24
            i32.add
            i64.load
            i64.store
            local.get $l15
            local.get $l18
            f64.load
            f64.store
            local.get $l14
            i32.const 8
            i32.add
            local.set $l14
            local.get $l15
            i32.const 8
            i32.add
            local.set $l15
            local.get $l16
            i32.const 32
            i32.add
            local.set $l16
            local.get $l19
            local.set $l17
            local.get $l13
            local.get $l12
            i32.const 1
            i32.add
            local.tee $l12
            i32.ne
            br_if $L3
          end
          local.get $l8
          local.get $l12
          i32.add
          local.set $l8
          local.get $l7
          local.get $l12
          i32.add
          local.set $l7
          local.get $l6
          local.get $l12
          i32.add
          local.set $l6
        end
        local.get $l6
        i32.const 5
        i32.shl
        local.tee $l16
        local.get $l11
        local.get $l12
        i32.const 4
        i32.shl
        i32.add
        local.tee $l17
        i64.load offset=8
        i64.store offset=3617240
        local.get $l16
        local.get $l17
        i64.load
        i64.store offset=3617232
        local.get $l7
        i32.const 3
        i32.shl
        local.get $l17
        f64.load offset=8
        f64.store offset=3620560
        local.get $l8
        i32.const 3
        i32.shl
        local.get $l17
        f64.load
        f64.store offset=3621392
        local.get $l16
        local.get $l11
        i32.const 0
        local.get $l12
        i32.const 1
        i32.add
        local.tee $l17
        local.get $l17
        local.get $l10
        i32.eq
        select
        i32.const 4
        i32.shl
        i32.add
        local.tee $l17
        i64.load
        i64.store offset=3617248
        local.get $l16
        local.get $l17
        i64.load offset=8
        i64.store offset=3617256
        local.get $l8
        i32.const 1
        i32.add
        local.set $l8
        local.get $l7
        i32.const 1
        i32.add
        local.set $l7
        local.get $l6
        i32.const 1
        i32.add
        local.set $l6
      end
      local.get $l5
      i32.const 640
      i32.add
      local.set $l5
      local.get $l9
      i32.const 1
      i32.add
      local.tee $l9
      local.get $p0
      i32.ne
      br_if $L0
    end
    block $B4
      local.get $l7
      i32.const 2
      i32.lt_u
      br_if $B4
      i32.const 3620560
      local.set $l15
      i32.const 1
      local.set $l14
      loop $L5
        local.get $l14
        i32.const 3
        i32.shl
        f64.load offset=3620560
        local.set $l20
        local.get $l15
        local.set $l16
        local.get $l14
        local.set $l17
        block $B6
          loop $L7
            local.get $l16
            f64.load
            local.tee $l21
            local.get $l20
            f64.gt
            i32.eqz
            br_if $B6
            local.get $l16
            i32.const 8
            i32.add
            local.get $l21
            f64.store
            local.get $l16
            i32.const -8
            i32.add
            local.set $l16
            local.get $l17
            i32.const -1
            i32.add
            local.tee $l17
            br_if $L7
          end
          i32.const 0
          local.set $l17
        end
        local.get $l17
        i32.const 3
        i32.shl
        local.get $l20
        f64.store offset=3620560
        local.get $l15
        i32.const 8
        i32.add
        local.set $l15
        local.get $l14
        i32.const 1
        i32.add
        local.tee $l14
        local.get $l7
        i32.ne
        br_if $L5
      end
      i32.const 1
      local.set $l17
      block $B8
        block $B9
          local.get $l7
          i32.const 2
          i32.ne
          br_if $B9
          i32.const 1
          local.set $l16
          br $B8
        end
        local.get $l7
        i32.const -1
        i32.add
        local.tee $l16
        i32.const 1
        i32.and
        local.set $l18
        local.get $l16
        i32.const -2
        i32.and
        local.set $l12
        i32.const 0
        local.set $l14
        i32.const 3620560
        local.set $l16
        i32.const 1
        local.set $l17
        loop $L10
          block $B11
            local.get $l16
            i32.const 8
            i32.add
            local.tee $l15
            f64.load
            local.tee $l21
            local.get $l16
            f64.load
            f64.eq
            br_if $B11
            local.get $l17
            i32.const 3
            i32.shl
            local.get $l21
            f64.store offset=3620560
            local.get $l17
            i32.const 1
            i32.add
            local.set $l17
          end
          block $B12
            local.get $l16
            i32.const 16
            i32.add
            local.tee $l16
            f64.load
            local.tee $l21
            local.get $l15
            f64.load
            f64.eq
            br_if $B12
            local.get $l17
            i32.const 3
            i32.shl
            local.get $l21
            f64.store offset=3620560
            local.get $l17
            i32.const 1
            i32.add
            local.set $l17
          end
          local.get $l12
          local.get $l14
          i32.const 2
          i32.add
          local.tee $l14
          i32.ne
          br_if $L10
        end
        block $B13
          local.get $l18
          br_if $B13
          local.get $l17
          local.set $l7
          br $B4
        end
        local.get $l14
        i32.const 1
        i32.add
        local.set $l16
      end
      block $B14
        local.get $l16
        i32.const 3
        i32.shl
        local.tee $l16
        f64.load offset=3620560
        local.tee $l21
        local.get $l16
        i32.const 3620552
        i32.add
        f64.load
        f64.ne
        br_if $B14
        local.get $l17
        local.set $l7
        br $B4
      end
      local.get $l17
      i32.const 3
      i32.shl
      local.get $l21
      f64.store offset=3620560
      local.get $l17
      i32.const 1
      i32.add
      local.set $l7
    end
    block $B15
      local.get $l8
      i32.const 2
      i32.lt_u
      br_if $B15
      i32.const 3621392
      local.set $l15
      i32.const 1
      local.set $l14
      loop $L16
        local.get $l14
        i32.const 3
        i32.shl
        f64.load offset=3621392
        local.set $l20
        local.get $l15
        local.set $l16
        local.get $l14
        local.set $l17
        block $B17
          loop $L18
            local.get $l16
            f64.load
            local.tee $l21
            local.get $l20
            f64.gt
            i32.eqz
            br_if $B17
            local.get $l16
            i32.const 8
            i32.add
            local.get $l21
            f64.store
            local.get $l16
            i32.const -8
            i32.add
            local.set $l16
            local.get $l17
            i32.const -1
            i32.add
            local.tee $l17
            br_if $L18
          end
          i32.const 0
          local.set $l17
        end
        local.get $l17
        i32.const 3
        i32.shl
        local.get $l20
        f64.store offset=3621392
        local.get $l15
        i32.const 8
        i32.add
        local.set $l15
        local.get $l14
        i32.const 1
        i32.add
        local.tee $l14
        local.get $l8
        i32.ne
        br_if $L16
      end
      i32.const 1
      local.set $l17
      block $B19
        block $B20
          local.get $l8
          i32.const 2
          i32.ne
          br_if $B20
          i32.const 1
          local.set $l16
          br $B19
        end
        local.get $l8
        i32.const -1
        i32.add
        local.tee $l16
        i32.const 1
        i32.and
        local.set $l18
        local.get $l16
        i32.const -2
        i32.and
        local.set $l12
        i32.const 0
        local.set $l14
        i32.const 3621392
        local.set $l16
        i32.const 1
        local.set $l17
        loop $L21
          block $B22
            local.get $l16
            i32.const 8
            i32.add
            local.tee $l15
            f64.load
            local.tee $l21
            local.get $l16
            f64.load
            f64.eq
            br_if $B22
            local.get $l17
            i32.const 3
            i32.shl
            local.get $l21
            f64.store offset=3621392
            local.get $l17
            i32.const 1
            i32.add
            local.set $l17
          end
          block $B23
            local.get $l16
            i32.const 16
            i32.add
            local.tee $l16
            f64.load
            local.tee $l21
            local.get $l15
            f64.load
            f64.eq
            br_if $B23
            local.get $l17
            i32.const 3
            i32.shl
            local.get $l21
            f64.store offset=3621392
            local.get $l17
            i32.const 1
            i32.add
            local.set $l17
          end
          local.get $l12
          local.get $l14
          i32.const 2
          i32.add
          local.tee $l14
          i32.ne
          br_if $L21
        end
        block $B24
          local.get $l18
          br_if $B24
          local.get $l17
          local.set $l8
          br $B15
        end
        local.get $l14
        i32.const 1
        i32.add
        local.set $l16
      end
      block $B25
        local.get $l16
        i32.const 3
        i32.shl
        local.tee $l16
        f64.load offset=3621392
        local.tee $l21
        local.get $l16
        i32.const 3621384
        i32.add
        f64.load
        f64.ne
        br_if $B25
        local.get $l17
        local.set $l8
        br $B15
      end
      local.get $l17
      i32.const 3
      i32.shl
      local.get $l21
      f64.store offset=3621392
      local.get $l17
      i32.const 1
      i32.add
      local.set $l8
    end
    i32.const 0
    local.set $l16
    block $B26
      local.get $l7
      i32.const 2
      i32.lt_u
      br_if $B26
      local.get $l8
      i32.const 1
      i32.and
      local.set $l22
      local.get $l8
      i32.const -2
      i32.and
      local.set $l10
      local.get $l8
      i32.const -1
      i32.add
      local.set $l23
      i32.const 0
      f64.load offset=3620560
      local.set $l24
      local.get $p1
      local.get $p1
      f64.sub
      local.tee $l25
      f64.neg
      local.set $l26
      i32.const 1
      local.set $l27
      i32.const 0
      local.set $l16
      loop $L27
        local.get $l24
        local.set $l28
        block $B28
          local.get $l27
          i32.const 3
          i32.shl
          f64.load offset=3620560
          local.tee $l24
          local.get $l28
          f64.gt
          i32.eqz
          br_if $B28
          block $B29
            local.get $l6
            i32.eqz
            br_if $B29
            local.get $l28
            local.get $l24
            f64.add
            f64.const 0x1p-1 (;=0.5;)
            f64.mul
            local.set $l20
            i32.const 0
            local.set $l5
            i32.const 0
            local.set $l12
            loop $L30
              local.get $p3
              local.get $p3
              i64.load
              i64.const 1
              i64.add
              i64.store
              local.get $l12
              i32.const 5
              i32.shl
              local.tee $l17
              f64.load offset=3617256
              local.set $l21
              block $B31
                block $B32
                  block $B33
                    local.get $l17
                    f64.load offset=3617240
                    local.tee $l29
                    local.get $l20
                    f64.le
                    i32.eqz
                    br_if $B33
                    local.get $l20
                    local.get $l21
                    f64.lt
                    br_if $B32
                  end
                  local.get $l20
                  local.get $l29
                  f64.lt
                  i32.eqz
                  br_if $B31
                  local.get $l21
                  local.get $l20
                  f64.le
                  i32.eqz
                  br_if $B31
                end
                local.get $l17
                i32.const 3617232
                i32.add
                local.tee $l18
                f64.load offset=16
                local.set $l30
                local.get $l18
                f64.load
                local.set $l31
                block $B34
                  block $B35
                    local.get $l29
                    local.get $l21
                    f64.ne
                    br_if $B35
                    local.get $l31
                    local.get $l30
                    local.get $l31
                    local.get $l30
                    f64.lt
                    select
                    local.set $l21
                    br $B34
                  end
                  local.get $l30
                  local.get $l31
                  f64.sub
                  local.get $l20
                  local.get $l29
                  f64.sub
                  local.get $l21
                  local.get $l29
                  f64.sub
                  f64.div
                  f64.mul
                  local.get $l31
                  f64.add
                  local.set $l21
                end
                local.get $l5
                i32.const 4
                i32.shl
                local.tee $l17
                local.get $l21
                f64.store offset=3622232
                i32.const 0
                local.set $l14
                local.get $l17
                i32.const 0
                i32.store offset=3622228
                local.get $l17
                local.get $l18
                i32.store offset=3622224
                block $B36
                  local.get $l5
                  i32.eqz
                  br_if $B36
                  local.get $p4
                  i64.load
                  i64.const 1
                  i64.add
                  local.tee $l32
                  local.get $l5
                  i32.const -1
                  i32.add
                  i64.extend_i32_u
                  i64.add
                  local.set $l33
                  local.get $l17
                  i32.const 3622208
                  i32.add
                  local.set $l17
                  local.get $l5
                  local.set $l14
                  block $B37
                    loop $L38
                      block $B39
                        local.get $l17
                        i32.const 8
                        i32.add
                        f64.load
                        local.get $l21
                        f64.le
                        i32.eqz
                        br_if $B39
                        local.get $l32
                        local.set $l33
                        br $B37
                      end
                      local.get $l17
                      i32.const 16
                      i32.add
                      local.tee $l15
                      local.get $l17
                      i64.load offset=8
                      i64.store offset=8
                      local.get $l15
                      local.get $l17
                      i64.load
                      i64.store
                      local.get $l17
                      i32.const -16
                      i32.add
                      local.set $l17
                      local.get $l32
                      i64.const 1
                      i64.add
                      local.set $l32
                      local.get $l14
                      i32.const -1
                      i32.add
                      local.tee $l14
                      br_if $L38
                    end
                    i32.const 0
                    local.set $l14
                  end
                  local.get $p4
                  local.get $l33
                  i64.store
                end
                local.get $l5
                i32.const 1
                i32.add
                local.set $l5
                local.get $l14
                i32.const 4
                i32.shl
                local.tee $l17
                local.get $l21
                f64.store offset=3622232
                local.get $l17
                i32.const 0
                i32.store offset=3622228
                local.get $l17
                local.get $l18
                i32.store offset=3622224
              end
              local.get $l12
              i32.const 1
              i32.add
              local.tee $l12
              local.get $l6
              i32.ne
              br_if $L30
            end
            block $B40
              local.get $l5
              i32.const 1
              i32.and
              i32.eqz
              br_if $B40
              i32.const 0
              return
            end
            local.get $p2
            local.get $p2
            i64.load
            i64.const 1
            i64.add
            i64.store
            local.get $l5
            i32.eqz
            br_if $B28
            local.get $l24
            local.get $l28
            f64.sub
            local.tee $l34
            f64.const 0x0p+0 (;=0;)
            f64.mul
            local.tee $l21
            local.get $l34
            f64.const -0x0p+0 (;=-0;)
            f64.mul
            f64.add
            local.set $l35
            local.get $l21
            local.get $l28
            local.get $l28
            f64.sub
            local.tee $l36
            f64.const -0x0p+0 (;=-0;)
            f64.mul
            f64.add
            local.set $l37
            local.get $l34
            local.get $l25
            f64.mul
            local.get $l25
            local.get $l34
            f64.neg
            f64.mul
            local.tee $l21
            f64.add
            local.set $l38
            local.get $l36
            local.get $l25
            f64.mul
            local.get $l21
            f64.add
            local.set $l39
            i32.const 0
            local.set $l11
            loop $L41
              local.get $l11
              i32.const 4
              i32.shl
              local.tee $l14
              i32.load offset=3622240
              local.set $l17
              local.get $l14
              i32.load offset=3622224
              local.tee $l14
              f64.load offset=16
              local.set $l20
              local.get $l14
              f64.load
              local.set $l21
              block $B42
                block $B43
                  local.get $l14
                  f64.load offset=8
                  local.tee $l29
                  local.get $l14
                  f64.load offset=24
                  local.tee $l31
                  f64.ne
                  br_if $B43
                  local.get $l21
                  local.get $l20
                  local.get $l21
                  local.get $l20
                  f64.lt
                  select
                  local.tee $l30
                  local.set $l40
                  br $B42
                end
                local.get $l20
                local.get $l21
                f64.sub
                local.tee $l20
                local.get $l24
                local.get $l29
                f64.sub
                local.get $l31
                local.get $l29
                f64.sub
                local.tee $l31
                f64.div
                f64.mul
                local.get $l21
                f64.add
                local.set $l40
                local.get $l20
                local.get $l28
                local.get $l29
                f64.sub
                local.get $l31
                f64.div
                f64.mul
                local.get $l21
                f64.add
                local.set $l30
              end
              local.get $l17
              f64.load offset=16
              local.set $l20
              local.get $l17
              f64.load
              local.set $l21
              block $B44
                block $B45
                  local.get $l17
                  f64.load offset=8
                  local.tee $l31
                  local.get $l17
                  f64.load offset=24
                  local.tee $l29
                  f64.ne
                  br_if $B45
                  local.get $l21
                  local.get $l20
                  local.get $l21
                  local.get $l20
                  f64.lt
                  select
                  local.tee $l20
                  local.set $l29
                  br $B44
                end
                local.get $l20
                local.get $l21
                f64.sub
                local.tee $l20
                local.get $l24
                local.get $l31
                f64.sub
                local.get $l29
                local.get $l31
                f64.sub
                local.tee $l41
                f64.div
                f64.mul
                local.get $l21
                f64.add
                local.set $l29
                local.get $l20
                local.get $l28
                local.get $l31
                f64.sub
                local.get $l41
                f64.div
                f64.mul
                local.get $l21
                f64.add
                local.set $l20
              end
              i32.const 0
              local.get $l30
              f64.store offset=3623888
              i32.const 1
              local.set $l15
              block $B46
                local.get $l8
                i32.eqz
                br_if $B46
                i32.const 0
                local.set $l14
                block $B47
                  local.get $l23
                  i32.eqz
                  br_if $B47
                  i32.const 3621392
                  local.set $l17
                  loop $L48
                    block $B49
                      local.get $l17
                      f64.load
                      local.tee $l21
                      local.get $l30
                      f64.gt
                      i32.eqz
                      br_if $B49
                      local.get $l21
                      local.get $l20
                      f64.lt
                      i32.eqz
                      br_if $B49
                      local.get $l15
                      i32.const 3
                      i32.shl
                      local.get $l21
                      f64.store offset=3623888
                      local.get $l15
                      i32.const 1
                      i32.add
                      local.set $l15
                    end
                    block $B50
                      local.get $l17
                      i32.const 8
                      i32.add
                      f64.load
                      local.tee $l21
                      local.get $l30
                      f64.gt
                      i32.eqz
                      br_if $B50
                      local.get $l21
                      local.get $l20
                      f64.lt
                      i32.eqz
                      br_if $B50
                      local.get $l15
                      i32.const 3
                      i32.shl
                      local.get $l21
                      f64.store offset=3623888
                      local.get $l15
                      i32.const 1
                      i32.add
                      local.set $l15
                    end
                    local.get $l17
                    i32.const 16
                    i32.add
                    local.set $l17
                    local.get $l10
                    local.get $l14
                    i32.const 2
                    i32.add
                    local.tee $l14
                    i32.ne
                    br_if $L48
                  end
                  local.get $l22
                  i32.eqz
                  br_if $B46
                end
                local.get $l14
                i32.const 3
                i32.shl
                f64.load offset=3621392
                local.tee $l21
                local.get $l30
                f64.gt
                i32.eqz
                br_if $B46
                local.get $l21
                local.get $l20
                f64.lt
                i32.eqz
                br_if $B46
                local.get $l15
                i32.const 3
                i32.shl
                local.get $l21
                f64.store offset=3623888
                local.get $l15
                i32.const 1
                i32.add
                local.set $l15
              end
              block $B51
                local.get $l20
                local.get $l30
                f64.eq
                br_if $B51
                local.get $l15
                i32.const 3
                i32.shl
                local.get $l20
                f64.store offset=3623888
                local.get $l15
                i32.const 1
                i32.add
                local.set $l15
              end
              i32.const 0
              local.get $l40
              f64.store offset=3624736
              block $B52
                block $B53
                  local.get $l8
                  br_if $B53
                  i32.const 1
                  local.set $l14
                  br $B52
                end
                i32.const 1
                local.set $l14
                i32.const 0
                local.set $l12
                block $B54
                  local.get $l23
                  i32.eqz
                  br_if $B54
                  i32.const 3621392
                  local.set $l17
                  loop $L55
                    block $B56
                      local.get $l17
                      f64.load
                      local.tee $l21
                      local.get $l40
                      f64.gt
                      i32.eqz
                      br_if $B56
                      local.get $l21
                      local.get $l29
                      f64.lt
                      i32.eqz
                      br_if $B56
                      local.get $l14
                      i32.const 3
                      i32.shl
                      local.get $l21
                      f64.store offset=3624736
                      local.get $l14
                      i32.const 1
                      i32.add
                      local.set $l14
                    end
                    block $B57
                      local.get $l17
                      i32.const 8
                      i32.add
                      f64.load
                      local.tee $l21
                      local.get $l40
                      f64.gt
                      i32.eqz
                      br_if $B57
                      local.get $l21
                      local.get $l29
                      f64.lt
                      i32.eqz
                      br_if $B57
                      local.get $l14
                      i32.const 3
                      i32.shl
                      local.get $l21
                      f64.store offset=3624736
                      local.get $l14
                      i32.const 1
                      i32.add
                      local.set $l14
                    end
                    local.get $l17
                    i32.const 16
                    i32.add
                    local.set $l17
                    local.get $l10
                    local.get $l12
                    i32.const 2
                    i32.add
                    local.tee $l12
                    i32.ne
                    br_if $L55
                  end
                  local.get $l22
                  i32.eqz
                  br_if $B52
                end
                local.get $l12
                i32.const 3
                i32.shl
                f64.load offset=3621392
                local.tee $l21
                local.get $l40
                f64.gt
                i32.eqz
                br_if $B52
                local.get $l21
                local.get $l29
                f64.lt
                i32.eqz
                br_if $B52
                local.get $l14
                i32.const 3
                i32.shl
                local.get $l21
                f64.store offset=3624736
                local.get $l14
                i32.const 1
                i32.add
                local.set $l14
              end
              block $B58
                local.get $l29
                local.get $l40
                f64.eq
                br_if $B58
                local.get $l14
                i32.const 3
                i32.shl
                local.get $l29
                f64.store offset=3624736
                local.get $l14
                i32.const 1
                i32.add
                local.set $l14
              end
              block $B59
                block $B60
                  local.get $l15
                  i32.const 1
                  i32.gt_u
                  local.tee $l13
                  br_if $B60
                  local.get $l14
                  i32.const 2
                  i32.lt_u
                  br_if $B59
                end
                local.get $l14
                i32.const 1
                i32.gt_u
                local.set $l9
                local.get $l29
                local.get $l40
                f64.sub
                local.set $l42
                local.get $l20
                local.get $l30
                f64.sub
                local.set $l43
                i32.const 0
                local.set $l19
                i32.const 1
                local.set $l18
                i32.const 1
                local.set $l12
                i32.const 0
                local.set $l17
                loop $L61
                  f64.const 0x1.fffffffffffffp+1023 (;=1.79769e+308;)
                  local.set $l29
                  f64.const 0x1.fffffffffffffp+1023 (;=1.79769e+308;)
                  local.set $l31
                  block $B62
                    local.get $l13
                    i32.const 1
                    i32.and
                    i32.eqz
                    br_if $B62
                    local.get $l12
                    i32.const 3
                    i32.shl
                    f64.load offset=3623888
                    local.get $l30
                    f64.sub
                    local.get $l43
                    f64.div
                    local.set $l31
                  end
                  block $B63
                    local.get $l9
                    i32.const 1
                    i32.and
                    i32.eqz
                    br_if $B63
                    local.get $l18
                    i32.const 3
                    i32.shl
                    f64.load offset=3624736
                    local.get $l40
                    f64.sub
                    local.get $l42
                    f64.div
                    local.set $l29
                  end
                  local.get $l19
                  i32.const 3
                  i32.shl
                  f64.load offset=3624736
                  local.tee $l41
                  local.get $l17
                  i32.const 3
                  i32.shl
                  f64.load offset=3623888
                  local.tee $l20
                  f64.sub
                  local.tee $l21
                  f64.neg
                  local.set $l44
                  block $B64
                    block $B65
                      block $B66
                        block $B67
                          local.get $l31
                          local.get $l29
                          f64.le
                          i32.eqz
                          br_if $B67
                          block $B68
                            local.get $l12
                            i32.const 3
                            i32.shl
                            f64.load offset=3623888
                            local.tee $l29
                            local.get $l20
                            f64.sub
                            local.tee $l31
                            local.get $l34
                            f64.mul
                            local.tee $l45
                            local.get $l36
                            local.get $l44
                            f64.mul
                            f64.add
                            local.tee $l44
                            local.get $l44
                            f64.mul
                            local.get $l39
                            local.get $l39
                            f64.mul
                            local.get $l25
                            local.get $l21
                            f64.mul
                            local.get $l31
                            local.get $l26
                            f64.mul
                            f64.add
                            local.tee $l44
                            local.get $l44
                            f64.mul
                            f64.add
                            f64.add
                            f64.const 0x1.4484bfeebc2ap-100 (;=1e-30;)
                            f64.le
                            br_if $B68
                            local.get $l16
                            i32.const 19999
                            i32.gt_u
                            br_if $B68
                            local.get $l16
                            i32.const 72
                            i32.mul
                            local.tee $l17
                            local.get $p1
                            f64.store offset=2177296
                            local.get $l17
                            local.get $l24
                            f64.store offset=2177288
                            local.get $l17
                            local.get $l41
                            f64.store offset=2177280
                            local.get $l17
                            local.get $p1
                            f64.store offset=2177272
                            local.get $l17
                            local.get $l28
                            f64.store offset=2177264
                            local.get $l17
                            local.get $l29
                            f64.store offset=2177256
                            local.get $l17
                            local.get $p1
                            f64.store offset=2177248
                            local.get $l17
                            local.get $l28
                            f64.store offset=2177240
                            local.get $l17
                            local.get $l20
                            f64.store offset=2177232
                            local.get $l16
                            i32.const 1
                            i32.add
                            local.set $l16
                          end
                          local.get $l21
                          local.get $l36
                          f64.mul
                          local.get $l45
                          f64.sub
                          local.tee $l44
                          local.get $l44
                          f64.mul
                          local.get $l37
                          local.get $l37
                          f64.mul
                          local.get $l31
                          f64.const 0x0p+0 (;=0;)
                          f64.mul
                          local.get $l21
                          f64.const -0x0p+0 (;=-0;)
                          f64.mul
                          f64.add
                          local.tee $l21
                          local.get $l21
                          f64.mul
                          f64.add
                          f64.add
                          f64.const 0x1.4484bfeebc2ap-100 (;=1e-30;)
                          f64.le
                          br_if $B65
                          local.get $l28
                          local.set $l21
                          local.get $l12
                          local.set $l17
                          local.get $l16
                          i32.const 19999
                          i32.le_u
                          br_if $B66
                          br $B64
                        end
                        block $B69
                          local.get $l18
                          i32.const 3
                          i32.shl
                          f64.load offset=3624736
                          local.tee $l29
                          local.get $l20
                          f64.sub
                          local.tee $l31
                          local.get $l34
                          f64.mul
                          local.tee $l45
                          local.get $l34
                          local.get $l44
                          f64.mul
                          f64.add
                          local.tee $l44
                          local.get $l44
                          f64.mul
                          local.get $l38
                          local.get $l38
                          f64.mul
                          local.get $l25
                          local.get $l21
                          f64.mul
                          local.get $l31
                          local.get $l26
                          f64.mul
                          f64.add
                          local.tee $l44
                          local.get $l44
                          f64.mul
                          f64.add
                          f64.add
                          f64.const 0x1.4484bfeebc2ap-100 (;=1e-30;)
                          f64.le
                          br_if $B69
                          local.get $l16
                          i32.const 19999
                          i32.gt_u
                          br_if $B69
                          local.get $l16
                          i32.const 72
                          i32.mul
                          local.tee $l12
                          local.get $p1
                          f64.store offset=2177296
                          local.get $l12
                          local.get $l24
                          f64.store offset=2177288
                          local.get $l12
                          local.get $l41
                          f64.store offset=2177280
                          local.get $l12
                          local.get $p1
                          f64.store offset=2177272
                          local.get $l12
                          local.get $l24
                          f64.store offset=2177264
                          local.get $l12
                          local.get $l29
                          f64.store offset=2177256
                          local.get $l12
                          local.get $p1
                          f64.store offset=2177248
                          local.get $l12
                          local.get $l28
                          f64.store offset=2177240
                          local.get $l12
                          local.get $l20
                          f64.store offset=2177232
                          local.get $l16
                          i32.const 1
                          i32.add
                          local.set $l16
                        end
                        block $B70
                          local.get $l21
                          local.get $l34
                          f64.mul
                          local.get $l45
                          f64.sub
                          local.tee $l44
                          local.get $l44
                          f64.mul
                          local.get $l35
                          local.get $l35
                          f64.mul
                          local.get $l31
                          f64.const 0x0p+0 (;=0;)
                          f64.mul
                          local.get $l21
                          f64.const -0x0p+0 (;=-0;)
                          f64.mul
                          f64.add
                          local.tee $l21
                          local.get $l21
                          f64.mul
                          f64.add
                          f64.add
                          f64.const 0x1.4484bfeebc2ap-100 (;=1e-30;)
                          f64.le
                          i32.eqz
                          br_if $B70
                          local.get $l18
                          local.set $l19
                          br $B64
                        end
                        local.get $l24
                        local.set $l21
                        local.get $l17
                        local.set $l12
                        local.get $l18
                        local.set $l19
                        local.get $l16
                        i32.const 19999
                        i32.gt_u
                        br_if $B64
                      end
                      local.get $l16
                      i32.const 72
                      i32.mul
                      local.tee $l17
                      i64.const 0
                      i64.store offset=2177296
                      local.get $l17
                      local.get $l21
                      f64.store offset=2177288
                      local.get $l17
                      local.get $l29
                      f64.store offset=2177280
                      local.get $l17
                      i64.const 0
                      i64.store offset=2177272
                      local.get $l17
                      local.get $l24
                      f64.store offset=2177264
                      local.get $l17
                      local.get $l41
                      f64.store offset=2177256
                      local.get $l17
                      i64.const 0
                      i64.store offset=2177248
                      local.get $l17
                      local.get $l28
                      f64.store offset=2177240
                      local.get $l17
                      local.get $l20
                      f64.store offset=2177232
                      local.get $l16
                      i32.const 1
                      i32.add
                      local.set $l16
                    end
                    local.get $l12
                    local.set $l17
                  end
                  local.get $l19
                  i32.const 1
                  i32.add
                  local.tee $l18
                  local.get $l14
                  i32.lt_u
                  local.set $l9
                  local.get $l17
                  i32.const 1
                  i32.add
                  local.tee $l12
                  local.get $l15
                  i32.lt_u
                  local.tee $l13
                  br_if $L61
                  local.get $l18
                  local.get $l14
                  i32.lt_u
                  br_if $L61
                end
              end
              local.get $l11
              i32.const 2
              i32.add
              local.tee $l11
              local.get $l5
              i32.lt_u
              br_if $L41
              br $B28
            end
          end
          local.get $p2
          local.get $p2
          i64.load
          i64.const 1
          i64.add
          i64.store
        end
        local.get $l27
        i32.const 1
        i32.add
        local.tee $l27
        local.get $l7
        i32.ne
        br_if $L27
      end
    end
    local.get $l8
    i32.const 3
    i32.shl
    i32.const 3621384
    i32.add
    local.set $l9
    local.get $l7
    i32.const 3
    i32.shl
    i32.const 3620552
    i32.add
    local.set $l5
    local.get $p1
    f64.neg
    local.set $l34
    i32.const 0
    local.set $l10
    loop $L71
      block $B72
        local.get $l10
        i32.const 2
        i32.shl
        i32.load offset=2175296
        local.tee $l13
        i32.eqz
        br_if $B72
        local.get $l10
        i32.const 640
        i32.mul
        i32.const 2175312
        i32.add
        local.set $l18
        i32.const 0
        local.set $l12
        loop $L73
          local.get $l18
          i32.const 0
          local.get $l12
          local.tee $l17
          i32.const 1
          i32.add
          local.tee $l12
          local.get $l12
          local.get $l13
          i32.eq
          local.tee $l19
          select
          i32.const 4
          i32.shl
          i32.add
          local.tee $l14
          f64.load
          local.set $l30
          local.get $l18
          local.get $l17
          i32.const 4
          i32.shl
          i32.add
          local.tee $l17
          f64.load
          local.set $l20
          block $B74
            block $B75
              block $B76
                local.get $l17
                f64.load offset=8
                local.tee $l21
                local.get $l14
                f64.load offset=8
                local.tee $l40
                f64.ne
                br_if $B76
                local.get $l20
                local.get $l30
                f64.lt
                br_if $B75
                local.get $l8
                i32.eqz
                br_if $B74
                local.get $l21
                local.get $l21
                f64.sub
                local.tee $l44
                local.get $p1
                f64.mul
                local.tee $l29
                local.get $l44
                f64.const -0x0p+0 (;=-0;)
                f64.mul
                f64.add
                local.set $l28
                local.get $l29
                local.get $l29
                f64.sub
                local.set $l24
                i32.const 0
                local.set $l15
                f64.const 0x0p+0 (;=0;)
                local.set $l31
                local.get $l9
                local.set $l17
                local.get $l8
                local.set $l14
                loop $L77
                  block $B78
                    local.get $l17
                    f64.load
                    local.tee $l29
                    local.get $l20
                    f64.le
                    i32.eqz
                    br_if $B78
                    local.get $l29
                    local.get $l30
                    f64.ge
                    i32.eqz
                    br_if $B78
                    block $B79
                      block $B80
                        local.get $l15
                        i32.eqz
                        br_if $B80
                        block $B81
                          local.get $l29
                          local.get $l31
                          f64.sub
                          local.tee $l40
                          local.get $l44
                          f64.mul
                          local.tee $l41
                          local.get $l41
                          f64.sub
                          local.tee $l25
                          local.get $l25
                          f64.mul
                          local.get $l28
                          local.get $l28
                          f64.mul
                          local.get $l40
                          f64.const 0x0p+0 (;=0;)
                          f64.mul
                          local.get $l40
                          local.get $l34
                          f64.mul
                          local.tee $l40
                          f64.add
                          local.tee $l25
                          local.get $l25
                          f64.mul
                          f64.add
                          f64.add
                          f64.const 0x1.4484bfeebc2ap-100 (;=1e-30;)
                          f64.le
                          br_if $B81
                          local.get $l16
                          i32.const 19999
                          i32.gt_u
                          br_if $B81
                          local.get $l16
                          i32.const 72
                          i32.mul
                          local.tee $l15
                          local.get $p1
                          f64.store offset=2177296
                          local.get $l15
                          local.get $l21
                          f64.store offset=2177288
                          local.get $l15
                          local.get $l29
                          f64.store offset=2177280
                          local.get $l15
                          i64.const 0
                          i64.store offset=2177272
                          local.get $l15
                          local.get $l21
                          f64.store offset=2177264
                          local.get $l15
                          local.get $l29
                          f64.store offset=2177256
                          local.get $l15
                          i64.const 0
                          i64.store offset=2177248
                          local.get $l15
                          local.get $l21
                          f64.store offset=2177240
                          local.get $l15
                          local.get $l31
                          f64.store offset=2177232
                          local.get $l16
                          i32.const 1
                          i32.add
                          local.set $l16
                        end
                        local.get $l41
                        local.get $l44
                        local.get $l31
                        local.get $l31
                        f64.sub
                        local.tee $l25
                        f64.mul
                        f64.sub
                        local.tee $l41
                        local.get $l41
                        f64.mul
                        local.get $l24
                        local.get $l24
                        f64.mul
                        local.get $p1
                        local.get $l25
                        f64.mul
                        local.get $l40
                        f64.add
                        local.tee $l40
                        local.get $l40
                        f64.mul
                        f64.add
                        f64.add
                        f64.const 0x1.4484bfeebc2ap-100 (;=1e-30;)
                        f64.le
                        br_if $B80
                        local.get $l16
                        i32.const 19999
                        i32.gt_u
                        br_if $B80
                        local.get $l16
                        i32.const 72
                        i32.mul
                        local.tee $l15
                        local.get $p1
                        f64.store offset=2177296
                        local.get $l15
                        local.get $l21
                        f64.store offset=2177288
                        local.get $l15
                        local.get $l31
                        f64.store offset=2177280
                        local.get $l15
                        local.get $p1
                        f64.store offset=2177272
                        local.get $l15
                        local.get $l21
                        f64.store offset=2177264
                        local.get $l15
                        local.get $l29
                        f64.store offset=2177256
                        local.get $l15
                        i64.const 0
                        i64.store offset=2177248
                        local.get $l15
                        local.get $l21
                        f64.store offset=2177240
                        local.get $l15
                        local.get $l31
                        f64.store offset=2177232
                        i32.const 1
                        local.set $l15
                        local.get $l16
                        i32.const 1
                        i32.add
                        local.set $l16
                        br $B79
                      end
                      i32.const 1
                      local.set $l15
                    end
                    local.get $l29
                    local.set $l31
                  end
                  local.get $l17
                  i32.const -8
                  i32.add
                  local.set $l17
                  local.get $l14
                  i32.const -1
                  i32.add
                  local.tee $l14
                  br_if $L77
                  br $B74
                end
              end
              block $B82
                local.get $l21
                local.get $l40
                f64.lt
                br_if $B82
                local.get $l7
                i32.eqz
                br_if $B74
                local.get $l40
                local.get $l21
                f64.sub
                local.set $l24
                local.get $l30
                local.get $l20
                f64.sub
                local.set $l25
                i32.const 0
                local.set $l15
                f64.const 0x0p+0 (;=0;)
                local.set $l31
                local.get $l5
                local.set $l17
                local.get $l7
                local.set $l14
                loop $L83
                  block $B84
                    local.get $l17
                    f64.load
                    local.tee $l29
                    local.get $l21
                    f64.le
                    i32.eqz
                    br_if $B84
                    local.get $l29
                    local.get $l40
                    f64.ge
                    i32.eqz
                    br_if $B84
                    block $B85
                      block $B86
                        local.get $l15
                        i32.eqz
                        br_if $B86
                        block $B87
                          local.get $l25
                          local.get $l29
                          local.get $l21
                          f64.sub
                          local.get $l24
                          f64.div
                          f64.mul
                          local.get $l20
                          f64.add
                          local.tee $l28
                          local.get $l25
                          local.get $l31
                          local.get $l21
                          f64.sub
                          local.get $l24
                          f64.div
                          f64.mul
                          local.get $l20
                          f64.add
                          local.tee $l30
                          f64.sub
                          local.tee $l41
                          local.get $l29
                          local.get $l31
                          f64.sub
                          local.tee $l44
                          f64.mul
                          local.tee $l36
                          local.get $l36
                          f64.sub
                          local.tee $l36
                          local.get $l36
                          f64.mul
                          local.get $l44
                          local.get $p1
                          f64.mul
                          local.tee $l36
                          local.get $l44
                          f64.const -0x0p+0 (;=-0;)
                          f64.mul
                          f64.add
                          local.tee $l35
                          local.get $l35
                          f64.mul
                          local.get $l41
                          f64.const 0x0p+0 (;=0;)
                          f64.mul
                          local.get $l41
                          local.get $l34
                          f64.mul
                          local.tee $l35
                          f64.add
                          local.tee $l37
                          local.get $l37
                          f64.mul
                          f64.add
                          f64.add
                          f64.const 0x1.4484bfeebc2ap-100 (;=1e-30;)
                          f64.le
                          br_if $B87
                          local.get $l16
                          i32.const 19999
                          i32.gt_u
                          br_if $B87
                          local.get $l16
                          i32.const 72
                          i32.mul
                          local.tee $l15
                          local.get $p1
                          f64.store offset=2177296
                          local.get $l15
                          local.get $l29
                          f64.store offset=2177288
                          local.get $l15
                          local.get $l28
                          f64.store offset=2177280
                          local.get $l15
                          i64.const 0
                          i64.store offset=2177272
                          local.get $l15
                          local.get $l29
                          f64.store offset=2177264
                          local.get $l15
                          local.get $l28
                          f64.store offset=2177256
                          local.get $l15
                          i64.const 0
                          i64.store offset=2177248
                          local.get $l15
                          local.get $l31
                          f64.store offset=2177240
                          local.get $l15
                          local.get $l30
                          f64.store offset=2177232
                          local.get $l16
                          i32.const 1
                          i32.add
                          local.set $l16
                        end
                        local.get $l41
                        local.get $l31
                        local.get $l31
                        f64.sub
                        local.tee $l37
                        f64.mul
                        local.get $l44
                        local.get $l30
                        local.get $l30
                        f64.sub
                        local.tee $l41
                        f64.mul
                        f64.sub
                        local.tee $l44
                        local.get $l44
                        f64.mul
                        local.get $l36
                        local.get $p1
                        local.get $l37
                        f64.mul
                        f64.sub
                        local.tee $l44
                        local.get $l44
                        f64.mul
                        local.get $p1
                        local.get $l41
                        f64.mul
                        local.get $l35
                        f64.add
                        local.tee $l41
                        local.get $l41
                        f64.mul
                        f64.add
                        f64.add
                        f64.const 0x1.4484bfeebc2ap-100 (;=1e-30;)
                        f64.le
                        br_if $B86
                        local.get $l16
                        i32.const 19999
                        i32.gt_u
                        br_if $B86
                        local.get $l16
                        i32.const 72
                        i32.mul
                        local.tee $l15
                        local.get $p1
                        f64.store offset=2177296
                        local.get $l15
                        local.get $l31
                        f64.store offset=2177288
                        local.get $l15
                        local.get $l30
                        f64.store offset=2177280
                        local.get $l15
                        local.get $p1
                        f64.store offset=2177272
                        local.get $l15
                        local.get $l29
                        f64.store offset=2177264
                        local.get $l15
                        local.get $l28
                        f64.store offset=2177256
                        local.get $l15
                        i64.const 0
                        i64.store offset=2177248
                        local.get $l15
                        local.get $l31
                        f64.store offset=2177240
                        local.get $l15
                        local.get $l30
                        f64.store offset=2177232
                        i32.const 1
                        local.set $l15
                        local.get $l16
                        i32.const 1
                        i32.add
                        local.set $l16
                        br $B85
                      end
                      i32.const 1
                      local.set $l15
                    end
                    local.get $l29
                    local.set $l31
                  end
                  local.get $l17
                  i32.const -8
                  i32.add
                  local.set $l17
                  local.get $l14
                  i32.const -1
                  i32.add
                  local.tee $l14
                  br_if $L83
                  br $B74
                end
              end
              local.get $l7
              i32.eqz
              br_if $B74
              local.get $l40
              local.get $l21
              f64.sub
              local.set $l24
              local.get $l30
              local.get $l20
              f64.sub
              local.set $l25
              i32.const 0
              local.set $l15
              f64.const 0x0p+0 (;=0;)
              local.set $l31
              i32.const 3620560
              local.set $l17
              local.get $l7
              local.set $l14
              loop $L88
                block $B89
                  local.get $l17
                  f64.load
                  local.tee $l29
                  local.get $l21
                  f64.ge
                  i32.eqz
                  br_if $B89
                  local.get $l29
                  local.get $l40
                  f64.le
                  i32.eqz
                  br_if $B89
                  block $B90
                    block $B91
                      local.get $l15
                      i32.eqz
                      br_if $B91
                      block $B92
                        local.get $l25
                        local.get $l29
                        local.get $l21
                        f64.sub
                        local.get $l24
                        f64.div
                        f64.mul
                        local.get $l20
                        f64.add
                        local.tee $l28
                        local.get $l25
                        local.get $l31
                        local.get $l21
                        f64.sub
                        local.get $l24
                        f64.div
                        f64.mul
                        local.get $l20
                        f64.add
                        local.tee $l30
                        f64.sub
                        local.tee $l41
                        local.get $l29
                        local.get $l31
                        f64.sub
                        local.tee $l44
                        f64.mul
                        local.tee $l36
                        local.get $l36
                        f64.sub
                        local.tee $l36
                        local.get $l36
                        f64.mul
                        local.get $l44
                        local.get $p1
                        f64.mul
                        local.tee $l36
                        local.get $l44
                        f64.const -0x0p+0 (;=-0;)
                        f64.mul
                        f64.add
                        local.tee $l35
                        local.get $l35
                        f64.mul
                        local.get $l41
                        f64.const 0x0p+0 (;=0;)
                        f64.mul
                        local.get $l41
                        local.get $l34
                        f64.mul
                        local.tee $l35
                        f64.add
                        local.tee $l37
                        local.get $l37
                        f64.mul
                        f64.add
                        f64.add
                        f64.const 0x1.4484bfeebc2ap-100 (;=1e-30;)
                        f64.le
                        br_if $B92
                        local.get $l16
                        i32.const 19999
                        i32.gt_u
                        br_if $B92
                        local.get $l16
                        i32.const 72
                        i32.mul
                        local.tee $l15
                        local.get $p1
                        f64.store offset=2177296
                        local.get $l15
                        local.get $l29
                        f64.store offset=2177288
                        local.get $l15
                        local.get $l28
                        f64.store offset=2177280
                        local.get $l15
                        i64.const 0
                        i64.store offset=2177272
                        local.get $l15
                        local.get $l29
                        f64.store offset=2177264
                        local.get $l15
                        local.get $l28
                        f64.store offset=2177256
                        local.get $l15
                        i64.const 0
                        i64.store offset=2177248
                        local.get $l15
                        local.get $l31
                        f64.store offset=2177240
                        local.get $l15
                        local.get $l30
                        f64.store offset=2177232
                        local.get $l16
                        i32.const 1
                        i32.add
                        local.set $l16
                      end
                      local.get $l41
                      local.get $l31
                      local.get $l31
                      f64.sub
                      local.tee $l37
                      f64.mul
                      local.get $l44
                      local.get $l30
                      local.get $l30
                      f64.sub
                      local.tee $l41
                      f64.mul
                      f64.sub
                      local.tee $l44
                      local.get $l44
                      f64.mul
                      local.get $l36
                      local.get $p1
                      local.get $l37
                      f64.mul
                      f64.sub
                      local.tee $l44
                      local.get $l44
                      f64.mul
                      local.get $p1
                      local.get $l41
                      f64.mul
                      local.get $l35
                      f64.add
                      local.tee $l41
                      local.get $l41
                      f64.mul
                      f64.add
                      f64.add
                      f64.const 0x1.4484bfeebc2ap-100 (;=1e-30;)
                      f64.le
                      br_if $B91
                      local.get $l16
                      i32.const 19999
                      i32.gt_u
                      br_if $B91
                      local.get $l16
                      i32.const 72
                      i32.mul
                      local.tee $l15
                      local.get $p1
                      f64.store offset=2177296
                      local.get $l15
                      local.get $l31
                      f64.store offset=2177288
                      local.get $l15
                      local.get $l30
                      f64.store offset=2177280
                      local.get $l15
                      local.get $p1
                      f64.store offset=2177272
                      local.get $l15
                      local.get $l29
                      f64.store offset=2177264
                      local.get $l15
                      local.get $l28
                      f64.store offset=2177256
                      local.get $l15
                      i64.const 0
                      i64.store offset=2177248
                      local.get $l15
                      local.get $l31
                      f64.store offset=2177240
                      local.get $l15
                      local.get $l30
                      f64.store offset=2177232
                      i32.const 1
                      local.set $l15
                      local.get $l16
                      i32.const 1
                      i32.add
                      local.set $l16
                      br $B90
                    end
                    i32.const 1
                    local.set $l15
                  end
                  local.get $l29
                  local.set $l31
                end
                local.get $l17
                i32.const 8
                i32.add
                local.set $l17
                local.get $l14
                i32.const -1
                i32.add
                local.tee $l14
                br_if $L88
                br $B74
              end
            end
            local.get $l8
            i32.eqz
            br_if $B74
            local.get $l21
            local.get $l21
            f64.sub
            local.tee $l44
            local.get $p1
            f64.mul
            local.tee $l29
            local.get $l44
            f64.const -0x0p+0 (;=-0;)
            f64.mul
            f64.add
            local.set $l28
            local.get $l29
            local.get $l29
            f64.sub
            local.set $l24
            i32.const 0
            local.set $l15
            f64.const 0x0p+0 (;=0;)
            local.set $l31
            i32.const 3621392
            local.set $l17
            local.get $l8
            local.set $l14
            loop $L93
              block $B94
                local.get $l17
                f64.load
                local.tee $l29
                local.get $l20
                f64.ge
                i32.eqz
                br_if $B94
                local.get $l29
                local.get $l30
                f64.le
                i32.eqz
                br_if $B94
                block $B95
                  block $B96
                    local.get $l15
                    i32.eqz
                    br_if $B96
                    block $B97
                      local.get $l29
                      local.get $l31
                      f64.sub
                      local.tee $l40
                      local.get $l44
                      f64.mul
                      local.tee $l41
                      local.get $l41
                      f64.sub
                      local.tee $l25
                      local.get $l25
                      f64.mul
                      local.get $l28
                      local.get $l28
                      f64.mul
                      local.get $l40
                      f64.const 0x0p+0 (;=0;)
                      f64.mul
                      local.get $l40
                      local.get $l34
                      f64.mul
                      local.tee $l40
                      f64.add
                      local.tee $l25
                      local.get $l25
                      f64.mul
                      f64.add
                      f64.add
                      f64.const 0x1.4484bfeebc2ap-100 (;=1e-30;)
                      f64.le
                      br_if $B97
                      local.get $l16
                      i32.const 19999
                      i32.gt_u
                      br_if $B97
                      local.get $l16
                      i32.const 72
                      i32.mul
                      local.tee $l15
                      local.get $p1
                      f64.store offset=2177296
                      local.get $l15
                      local.get $l21
                      f64.store offset=2177288
                      local.get $l15
                      local.get $l29
                      f64.store offset=2177280
                      local.get $l15
                      i64.const 0
                      i64.store offset=2177272
                      local.get $l15
                      local.get $l21
                      f64.store offset=2177264
                      local.get $l15
                      local.get $l29
                      f64.store offset=2177256
                      local.get $l15
                      i64.const 0
                      i64.store offset=2177248
                      local.get $l15
                      local.get $l21
                      f64.store offset=2177240
                      local.get $l15
                      local.get $l31
                      f64.store offset=2177232
                      local.get $l16
                      i32.const 1
                      i32.add
                      local.set $l16
                    end
                    local.get $l41
                    local.get $l44
                    local.get $l31
                    local.get $l31
                    f64.sub
                    local.tee $l25
                    f64.mul
                    f64.sub
                    local.tee $l41
                    local.get $l41
                    f64.mul
                    local.get $l24
                    local.get $l24
                    f64.mul
                    local.get $p1
                    local.get $l25
                    f64.mul
                    local.get $l40
                    f64.add
                    local.tee $l40
                    local.get $l40
                    f64.mul
                    f64.add
                    f64.add
                    f64.const 0x1.4484bfeebc2ap-100 (;=1e-30;)
                    f64.le
                    br_if $B96
                    local.get $l16
                    i32.const 19999
                    i32.gt_u
                    br_if $B96
                    local.get $l16
                    i32.const 72
                    i32.mul
                    local.tee $l15
                    local.get $p1
                    f64.store offset=2177296
                    local.get $l15
                    local.get $l21
                    f64.store offset=2177288
                    local.get $l15
                    local.get $l31
                    f64.store offset=2177280
                    local.get $l15
                    local.get $p1
                    f64.store offset=2177272
                    local.get $l15
                    local.get $l21
                    f64.store offset=2177264
                    local.get $l15
                    local.get $l29
                    f64.store offset=2177256
                    local.get $l15
                    i64.const 0
                    i64.store offset=2177248
                    local.get $l15
                    local.get $l21
                    f64.store offset=2177240
                    local.get $l15
                    local.get $l31
                    f64.store offset=2177232
                    i32.const 1
                    local.set $l15
                    local.get $l16
                    i32.const 1
                    i32.add
                    local.set $l16
                    br $B95
                  end
                  i32.const 1
                  local.set $l15
                end
                local.get $l29
                local.set $l31
              end
              local.get $l17
              i32.const 8
              i32.add
              local.set $l17
              local.get $l14
              i32.const -1
              i32.add
              local.tee $l14
              br_if $L93
            end
          end
          local.get $l19
          i32.eqz
          br_if $L73
        end
      end
      local.get $l10
      i32.const 1
      i32.add
      local.tee $l10
      local.get $p0
      i32.ne
      br_if $L71
    end
    local.get $l16)
  (func $add_loop (type $t7) (param $p0 i32) (param $p1 i32) (param $p2 i32) (param $p3 i32) (param $p4 i32)
    (local $l5 i32) (local $l6 i32) (local $l7 i32) (local $l8 i32) (local $l9 i32) (local $l10 i32) (local $l11 i32) (local $l12 i32)
    local.get $p0
    local.get $p0
    i32.load offset=5900
    local.tee $l5
    i32.const 1
    i32.add
    i32.store offset=5900
    local.get $p0
    local.get $l5
    i32.const 40
    i32.mul
    i32.add
    local.tee $l6
    local.get $p4
    i32.store offset=3396
    local.get $l6
    local.get $p1
    i32.store offset=3360
    local.get $p0
    local.get $p1
    i32.const 48
    i32.mul
    i32.add
    local.tee $l7
    local.get $l7
    i32.load offset=2608
    local.tee $l8
    i32.const 1
    i32.add
    i32.store offset=2608
    local.get $l7
    local.get $l8
    i32.const 2
    i32.shl
    i32.add
    local.get $l5
    i32.store offset=2596
    local.get $p0
    local.get $p0
    i32.load offset=5904
    local.tee $l7
    i32.const 1
    i32.add
    i32.store offset=5904
    local.get $p2
    i32.load
    local.set $l9
    local.get $p0
    i32.const 4160
    i32.add
    local.tee $l8
    local.get $l7
    i32.const 24
    i32.mul
    i32.add
    local.tee $l10
    local.get $l5
    i32.store offset=8
    local.get $l10
    local.get $p1
    i32.store offset=4
    local.get $l10
    local.get $l9
    i32.store
    local.get $l10
    local.get $p3
    i32.load
    i32.store offset=20
    local.get $l6
    local.get $l7
    i32.store offset=3364
    local.get $p0
    i32.const 576
    i32.add
    local.tee $l11
    local.get $p2
    i32.load
    i32.const 56
    i32.mul
    i32.add
    local.tee $l10
    local.get $l10
    i32.load offset=28
    local.tee $l9
    i32.const 1
    i32.add
    i32.store offset=28
    local.get $l10
    local.get $l9
    i32.const 2
    i32.shl
    i32.add
    local.get $l7
    i32.store offset=20
    local.get $l6
    i32.const 3364
    i32.add
    local.set $l7
    local.get $l6
    i32.const 3360
    i32.add
    local.set $l6
    block $B0
      local.get $p4
      i32.const 1
      i32.eq
      br_if $B0
      local.get $p0
      local.get $p0
      i32.load offset=5904
      local.tee $l10
      i32.const 1
      i32.add
      i32.store offset=5904
      local.get $p2
      i32.load offset=4
      local.set $l12
      local.get $l8
      local.get $l10
      i32.const 24
      i32.mul
      i32.add
      local.tee $l9
      local.get $l5
      i32.store offset=8
      local.get $l9
      local.get $p1
      i32.store offset=4
      local.get $l9
      local.get $l12
      i32.store
      local.get $p3
      i32.load offset=4
      local.set $l12
      local.get $l6
      local.get $l10
      i32.store offset=8
      local.get $l9
      local.get $l12
      i32.store offset=20
      local.get $l11
      local.get $p2
      i32.load offset=4
      i32.const 56
      i32.mul
      i32.add
      local.tee $l9
      local.get $l9
      i32.load offset=28
      local.tee $l12
      i32.const 1
      i32.add
      i32.store offset=28
      local.get $l9
      local.get $l12
      i32.const 2
      i32.shl
      i32.add
      local.get $l10
      i32.store offset=20
      local.get $p4
      i32.const 2
      i32.eq
      br_if $B0
      local.get $p0
      local.get $p0
      i32.load offset=5904
      local.tee $l10
      i32.const 1
      i32.add
      i32.store offset=5904
      local.get $p2
      i32.load offset=8
      local.set $l12
      local.get $l8
      local.get $l10
      i32.const 24
      i32.mul
      i32.add
      local.tee $l9
      local.get $l5
      i32.store offset=8
      local.get $l9
      local.get $p1
      i32.store offset=4
      local.get $l9
      local.get $l12
      i32.store
      local.get $l9
      local.get $p3
      i32.load offset=8
      i32.store offset=20
      local.get $l6
      local.get $l10
      i32.store offset=12
      local.get $l11
      local.get $p2
      i32.load offset=8
      i32.const 56
      i32.mul
      i32.add
      local.tee $l9
      local.get $l9
      i32.load offset=28
      local.tee $l12
      i32.const 1
      i32.add
      i32.store offset=28
      local.get $l9
      local.get $l12
      i32.const 2
      i32.shl
      i32.add
      local.get $l10
      i32.store offset=20
      local.get $p4
      i32.const 3
      i32.eq
      br_if $B0
      local.get $p0
      local.get $p0
      i32.load offset=5904
      local.tee $l10
      i32.const 1
      i32.add
      i32.store offset=5904
      local.get $p2
      i32.load offset=12
      local.set $l12
      local.get $l8
      local.get $l10
      i32.const 24
      i32.mul
      i32.add
      local.tee $l9
      local.get $l5
      i32.store offset=8
      local.get $l9
      local.get $p1
      i32.store offset=4
      local.get $l9
      local.get $l12
      i32.store
      local.get $p3
      i32.load offset=12
      local.set $l12
      local.get $l6
      local.get $l10
      i32.store offset=16
      local.get $l9
      local.get $l12
      i32.store offset=20
      local.get $l11
      local.get $p2
      i32.load offset=12
      i32.const 56
      i32.mul
      i32.add
      local.tee $l9
      local.get $l9
      i32.load offset=28
      local.tee $l12
      i32.const 1
      i32.add
      i32.store offset=28
      local.get $l9
      local.get $l12
      i32.const 2
      i32.shl
      i32.add
      local.get $l10
      i32.store offset=20
      local.get $p4
      i32.const 4
      i32.eq
      br_if $B0
      local.get $p0
      local.get $p0
      i32.load offset=5904
      local.tee $l10
      i32.const 1
      i32.add
      i32.store offset=5904
      local.get $p2
      i32.load offset=16
      local.set $l12
      local.get $l8
      local.get $l10
      i32.const 24
      i32.mul
      i32.add
      local.tee $l9
      local.get $l5
      i32.store offset=8
      local.get $l9
      local.get $p1
      i32.store offset=4
      local.get $l9
      local.get $l12
      i32.store
      local.get $l9
      local.get $p3
      i32.load offset=16
      i32.store offset=20
      local.get $l6
      local.get $l10
      i32.store offset=20
      local.get $l11
      local.get $p2
      i32.load offset=16
      i32.const 56
      i32.mul
      i32.add
      local.tee $l9
      local.get $l9
      i32.load offset=28
      local.tee $l12
      i32.const 1
      i32.add
      i32.store offset=28
      local.get $l9
      local.get $l12
      i32.const 2
      i32.shl
      i32.add
      local.get $l10
      i32.store offset=20
      local.get $p4
      i32.const 5
      i32.eq
      br_if $B0
      local.get $p0
      local.get $p0
      i32.load offset=5904
      local.tee $l10
      i32.const 1
      i32.add
      i32.store offset=5904
      local.get $p2
      i32.load offset=20
      local.set $l12
      local.get $l8
      local.get $l10
      i32.const 24
      i32.mul
      i32.add
      local.tee $l9
      local.get $l5
      i32.store offset=8
      local.get $l9
      local.get $p1
      i32.store offset=4
      local.get $l9
      local.get $l12
      i32.store
      local.get $p3
      i32.load offset=20
      local.set $l12
      local.get $l6
      local.get $l10
      i32.store offset=24
      local.get $l9
      local.get $l12
      i32.store offset=20
      local.get $l11
      local.get $p2
      i32.load offset=20
      i32.const 56
      i32.mul
      i32.add
      local.tee $l9
      local.get $l9
      i32.load offset=28
      local.tee $l12
      i32.const 1
      i32.add
      i32.store offset=28
      local.get $l9
      local.get $l12
      i32.const 2
      i32.shl
      i32.add
      local.get $l10
      i32.store offset=20
      local.get $p4
      i32.const 6
      i32.eq
      br_if $B0
      local.get $p0
      local.get $p0
      i32.load offset=5904
      local.tee $l10
      i32.const 1
      i32.add
      i32.store offset=5904
      local.get $p2
      i32.load offset=24
      local.set $l12
      local.get $l8
      local.get $l10
      i32.const 24
      i32.mul
      i32.add
      local.tee $l9
      local.get $l5
      i32.store offset=8
      local.get $l9
      local.get $p1
      i32.store offset=4
      local.get $l9
      local.get $l12
      i32.store
      local.get $l9
      local.get $p3
      i32.load offset=24
      i32.store offset=20
      local.get $l6
      local.get $l10
      i32.store offset=28
      local.get $l11
      local.get $p2
      i32.load offset=24
      i32.const 56
      i32.mul
      i32.add
      local.tee $l9
      local.get $l9
      i32.load offset=28
      local.tee $l12
      i32.const 1
      i32.add
      i32.store offset=28
      local.get $l9
      local.get $l12
      i32.const 2
      i32.shl
      i32.add
      local.get $l10
      i32.store offset=20
      local.get $p4
      i32.const 7
      i32.eq
      br_if $B0
      local.get $p0
      local.get $p0
      i32.load offset=5904
      local.tee $l10
      i32.const 1
      i32.add
      i32.store offset=5904
      local.get $p2
      i32.load offset=28
      local.set $l9
      local.get $l8
      local.get $l10
      i32.const 24
      i32.mul
      i32.add
      local.tee $p0
      local.get $l5
      i32.store offset=8
      local.get $p0
      local.get $p1
      i32.store offset=4
      local.get $p0
      local.get $l9
      i32.store
      local.get $p3
      i32.load offset=28
      local.set $p1
      local.get $l6
      local.get $l10
      i32.store offset=32
      local.get $p0
      local.get $p1
      i32.store offset=20
      local.get $l11
      local.get $p2
      i32.load offset=28
      i32.const 56
      i32.mul
      i32.add
      local.tee $p0
      local.get $p0
      i32.load offset=28
      local.tee $p1
      i32.const 1
      i32.add
      i32.store offset=28
      local.get $p0
      local.get $p1
      i32.const 2
      i32.shl
      i32.add
      local.get $l10
      i32.store offset=20
    end
    local.get $l7
    i32.load
    local.set $p0
    block $B1
      block $B2
        local.get $p4
        i32.const -1
        i32.add
        local.tee $l5
        br_if $B2
        i32.const 0
        local.set $p1
        br $B1
      end
      i32.const 2
      local.set $p1
      local.get $l8
      local.get $p0
      i32.const 24
      i32.mul
      i32.add
      local.tee $p2
      local.get $l7
      local.get $l5
      local.get $p4
      i32.rem_u
      i32.const 2
      i32.shl
      i32.add
      i32.load
      i32.store offset=16
      local.get $p2
      local.get $l6
      i32.load offset=8
      local.tee $p0
      i32.store offset=12
      block $B3
        local.get $p4
        i32.const -2
        i32.add
        local.tee $p2
        br_if $B3
        i32.const 1
        local.set $p1
        br $B1
      end
      local.get $l8
      local.get $p0
      i32.const 24
      i32.mul
      i32.add
      local.tee $l10
      local.get $l6
      i32.load offset=4
      i32.store offset=16
      local.get $l10
      local.get $l6
      i32.load offset=12
      local.tee $p0
      i32.store offset=12
      local.get $p2
      i32.const 1
      i32.eq
      br_if $B1
      local.get $l8
      local.get $p0
      i32.const 24
      i32.mul
      i32.add
      local.tee $p1
      local.get $l7
      local.get $p4
      i32.const 1
      i32.add
      local.get $p4
      i32.rem_u
      i32.const 2
      i32.shl
      i32.add
      i32.load
      i32.store offset=16
      local.get $p1
      local.get $l6
      i32.load offset=16
      local.tee $p0
      i32.store offset=12
      block $B4
        local.get $p2
        i32.const 2
        i32.ne
        br_if $B4
        i32.const 3
        local.set $p1
        br $B1
      end
      local.get $l8
      local.get $p0
      i32.const 24
      i32.mul
      i32.add
      local.tee $p1
      local.get $l7
      local.get $p4
      i32.const 2
      i32.add
      local.get $p4
      i32.rem_u
      i32.const 2
      i32.shl
      i32.add
      i32.load
      i32.store offset=16
      local.get $p1
      local.get $l6
      i32.load offset=20
      local.tee $p0
      i32.store offset=12
      block $B5
        local.get $p2
        i32.const 3
        i32.ne
        br_if $B5
        i32.const 4
        local.set $p1
        br $B1
      end
      local.get $l8
      local.get $p0
      i32.const 24
      i32.mul
      i32.add
      local.tee $p1
      local.get $l7
      local.get $p4
      i32.const 3
      i32.add
      local.get $p4
      i32.rem_u
      i32.const 2
      i32.shl
      i32.add
      i32.load
      i32.store offset=16
      local.get $p1
      local.get $l6
      i32.load offset=24
      local.tee $p0
      i32.store offset=12
      block $B6
        local.get $p2
        i32.const 4
        i32.ne
        br_if $B6
        i32.const 5
        local.set $p1
        br $B1
      end
      local.get $l8
      local.get $p0
      i32.const 24
      i32.mul
      i32.add
      local.tee $p1
      local.get $l7
      local.get $p4
      i32.const 4
      i32.add
      local.get $p4
      i32.rem_u
      i32.const 2
      i32.shl
      i32.add
      i32.load
      i32.store offset=16
      local.get $p1
      local.get $l6
      i32.load offset=28
      local.tee $p0
      i32.store offset=12
      block $B7
        local.get $p2
        i32.const 5
        i32.ne
        br_if $B7
        i32.const 6
        local.set $p1
        br $B1
      end
      local.get $l8
      local.get $p0
      i32.const 24
      i32.mul
      i32.add
      local.tee $p1
      local.get $l7
      local.get $p4
      i32.const 5
      i32.add
      local.get $p4
      i32.rem_u
      i32.const 2
      i32.shl
      i32.add
      i32.load
      i32.store offset=16
      local.get $p1
      local.get $l6
      i32.load offset=32
      local.tee $p0
      i32.store offset=12
      i32.const 7
      local.set $p1
    end
    local.get $l8
    local.get $p0
    i32.const 24
    i32.mul
    i32.add
    local.tee $p0
    local.get $l7
    local.get $l5
    local.get $p1
    i32.add
    i32.const 255
    i32.and
    local.get $p4
    i32.const 255
    i32.and
    i32.rem_u
    i32.const 2
    i32.shl
    i32.add
    i32.load
    i32.store offset=16
    local.get $p0
    local.get $l7
    i32.const 0
    local.get $p1
    i32.const 1
    i32.add
    local.tee $l6
    local.get $l6
    local.get $p4
    i32.eq
    select
    i32.const 2
    i32.shl
    i32.add
    i32.load
    i32.store offset=12)
  (memory $memory 128 128)
  (global $__stack_pointer (mut i32) (i32.const 65536))
  (export "memory" (memory $memory))
  (export "input_ptr" (func $input_ptr))
  (export "output_ptr" (func $output_ptr))
  (export "run" (func $run))
  (data $.rodata (i32.const 65536) "\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\01\00\00\00\01\00\00\00\01\00\00\00\01\00\00\00\00\00\00\00\00\00\f0?\b0\5c\f7\cf\97b\ef?F\8d2\cfk\90\ed?\a3\a1\0e)f\9b\ea?\cd;\7ff\9e\a0\e6?\c9h\ae9;\c7\e1?d\a9\ae\a6\e2}\d8?\0d\a6i<\b8\f8\c8?\00\00\00\00\00\00\00\00\0d\a6i<\b8\f8\c8\bfd\a9\ae\a6\e2}\d8\bf\c9h\ae9;\c7\e1\bf\cd;\7ff\9e\a0\e6\bf\a3\a1\0e)f\9b\ea\bfF\8d2\cfk\90\ed\bf\b0\5c\f7\cf\97b\ef\bf\00\00\00\00\00\00\f0\bf\b0\5c\f7\cf\97b\ef\bfF\8d2\cfk\90\ed\bf\a3\a1\0e)f\9b\ea\bf\cd;\7ff\9e\a0\e6\bf\c9h\ae9;\c7\e1\bfd\a9\ae\a6\e2}\d8\bf\0d\a6i<\b8\f8\c8\bf\00\00\00\00\00\00\00\00\0d\a6i<\b8\f8\c8?d\a9\ae\a6\e2}\d8?\c9h\ae9;\c7\e1?\cd;\7ff\9e\a0\e6?\a3\a1\0e)f\9b\ea?F\8d2\cfk\90\ed?\b0\5c\f7\cf\97b\ef?\00\00\00\00\00\00\00\00\0a\a6i<\b8\f8\c8?c\a9\ae\a6\e2}\d8?\c8h\ae9;\c7\e1?\cc;\7ff\9e\a0\e6?\a3\a1\0e)f\9b\ea?F\8d2\cfk\90\ed?\b0\5c\f7\cf\97b\ef?\00\00\00\00\00\00\f0?\b0\5c\f7\cf\97b\ef?F\8d2\cfk\90\ed?\a3\a1\0e)f\9b\ea?\cc;\7ff\9e\a0\e6?\c8h\ae9;\c7\e1?c\a9\ae\a6\e2}\d8?\0a\a6i<\b8\f8\c8?\00\00\00\00\00\00\00\00\0a\a6i<\b8\f8\c8\bfc\a9\ae\a6\e2}\d8\bf\c8h\ae9;\c7\e1\bf\cc;\7ff\9e\a0\e6\bf\a3\a1\0e)f\9b\ea\bfF\8d2\cfk\90\ed\bf\b0\5c\f7\cf\97b\ef\bf\00\00\00\00\00\00\f0\bf\b0\5c\f7\cf\97b\ef\bfF\8d2\cfk\90\ed\bf\a3\a1\0e)f\9b\ea\bf\cc;\7ff\9e\a0\e6\bf\c8h\ae9;\c7\e1\bfc\a9\ae\a6\e2}\d8\bf\0a\a6i<\b8\f8\c8\bf\01\00\00\00\01\00\00\00\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\01\00\00\00\01\00\00\00\ff\ff\ff\ff"))
