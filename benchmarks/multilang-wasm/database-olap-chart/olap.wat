;; database.olap-chart.v1 — kernel: olap
;; WebAssembly Text (WAT) baseline implementation
;; Exports: olap

(module $olap_c.wasm
  (type $t0 (func))
  (type $t1 (func (result i32)))
  (type $t2 (func (param i32) (result i32)))
  (func $__wasm_call_ctors (type $t0))
  (func $input_ptr (type $t1) (result i32)
    i32.const 65536)
  (func $result_ptr (type $t1) (result i32)
    i32.const 305696)
  (func $counter (type $t2) (param $p0 i32) (result i32)
    (local $l1 i32)
    i32.const 0
    local.set $l1
    block $B0
      local.get $p0
      i32.const 8
      i32.gt_u
      br_if $B0
      local.get $p0
      i32.const 2
      i32.shl
      i32.load offset=307936
      local.set $l1
    end
    local.get $l1)
  (func $run (type $t2) (param $p0 i32) (result i32)
    (local $l1 i32) (local $l2 i32) (local $l3 i32) (local $l4 i32) (local $l5 i32) (local $l6 i32) (local $l7 i32) (local $l8 i32) (local $l9 i32) (local $l10 i32) (local $l11 i32) (local $l12 i32) (local $l13 i32) (local $l14 i32) (local $l15 i32) (local $l16 i32) (local $l17 i32) (local $l18 i32) (local $l19 i32) (local $l20 i32) (local $l21 i32) (local $l22 i32) (local $l23 i32) (local $l24 i32) (local $l25 i32) (local $l26 i32) (local $l27 i32)
    global.get $__stack_pointer
    i32.const 320
    i32.sub
    local.tee $l1
    global.set $__stack_pointer
    i32.const 0
    local.set $l2
    block $B0
      local.get $p0
      i32.const 240152
      i32.ne
      br_if $B0
      i32.const 0
      i32.load offset=65536
      i32.const 1346456655
      i32.ne
      br_if $B0
      i32.const 0
      i32.load offset=65540
      i32.const 1
      i32.ne
      br_if $B0
      i32.const 0
      i32.load offset=65544
      i32.const 10000
      i32.ne
      br_if $B0
      i32.const 0
      i32.load offset=65548
      i32.const 5
      i32.ne
      br_if $B0
      i32.const 0
      i32.load offset=65552
      i32.const 16
      i32.ne
      br_if $B0
      i32.const 0
      i32.load offset=65556
      i32.const 8
      i32.ne
      br_if $B0
      i32.const 0
      i32.load offset=65560
      i32.const 6
      i32.ne
      br_if $B0
      i32.const 0
      i32.load offset=65564
      i32.const 6
      i32.ne
      br_if $B0
      i32.const 0
      i64.const 0
      i64.store offset=307936
      i32.const 0
      i64.const 0
      i64.store offset=307952
      i32.const 0
      i64.const 0
      i64.store offset=307944
      i32.const 0
      i32.const 560
      i32.store offset=307968
      i32.const 0
      i64.const 171798691920
      i64.store offset=307960
      i32.const 0
      i32.const 5
      i32.store offset=307936
      i32.const 0
      local.set $l3
      i32.const 0
      local.set $l4
      i32.const 0
      local.set $l5
      i32.const 0
      local.set $l6
      loop $L1
        local.get $l3
        i32.const 24
        i32.mul
        local.tee $l2
        i32.load offset=305588
        local.set $l7
        local.get $l2
        i32.load offset=305584
        local.set $l8
        local.get $l2
        i32.load offset=305580
        local.set $l9
        local.get $l2
        i32.load offset=305576
        local.set $l10
        local.get $l2
        i32.load offset=305572
        local.set $l11
        local.get $l2
        i32.load offset=305568
        local.set $l12
        local.get $l1
        i64.const 0
        i64.store offset=256
        local.get $l1
        i64.const 0
        i64.store offset=264
        local.get $l1
        i64.const 0
        i64.store offset=272
        local.get $l1
        i64.const 0
        i64.store offset=280
        local.get $l1
        i64.const 0
        i64.store offset=288
        local.get $l1
        i64.const 0
        i64.store offset=296
        local.get $l1
        i64.const 0
        i64.store offset=304
        local.get $l1
        i64.const 0
        i64.store offset=312
        local.get $l1
        i32.const 128
        i32.add
        i32.const 0
        i32.const 128
        memory.fill
        local.get $l1
        i32.const 0
        i32.const 128
        memory.fill
        i32.const -2128831035
        local.set $l13
        i32.const 225568
        local.set $l2
        i32.const 0
        local.set $p0
        i32.const 0
        local.set $l14
        loop $L2
          block $B3
            local.get $l12
            local.get $l2
            i32.const -120000
            i32.add
            i32.load
            i32.shr_u
            i32.const 1
            i32.and
            i32.eqz
            br_if $B3
            local.get $l11
            local.get $l2
            i32.const -80000
            i32.add
            i32.load
            local.tee $l15
            i32.shr_u
            i32.const 1
            i32.and
            i32.eqz
            br_if $B3
            local.get $l2
            i32.load
            local.tee $l16
            local.get $l10
            i32.lt_u
            br_if $B3
            i32.const 0
            local.get $l6
            i32.const 1
            i32.add
            local.tee $l6
            i32.store offset=307956
            i32.const 0
            local.get $l5
            i32.const 1
            i32.add
            local.tee $l5
            i32.store offset=307948
            local.get $l14
            i32.const 2
            i32.shl
            local.get $p0
            i32.store offset=307984
            local.get $l1
            i32.const 256
            i32.add
            local.get $l15
            i32.const 2
            i32.shl
            i32.add
            local.tee $l17
            local.get $l17
            i32.load
            i32.const 1
            i32.add
            i32.store
            local.get $l1
            i32.const 128
            i32.add
            local.get $l15
            i32.const 3
            i32.shl
            local.tee $l15
            i32.add
            local.tee $l17
            local.get $l17
            i64.load
            local.get $l16
            i64.extend_i32_u
            i64.add
            i64.store
            local.get $l1
            local.get $l15
            i32.add
            local.tee $l15
            local.get $l15
            i64.load
            local.get $l2
            i32.const 40000
            i32.add
            i64.load32_u
            i64.add
            i64.store
            local.get $l14
            i32.const 1
            i32.add
            local.set $l14
            local.get $p0
            local.get $l13
            i32.xor
            i32.const 16777619
            i32.mul
            local.set $l13
          end
          local.get $l2
          i32.const 4
          i32.add
          local.set $l2
          local.get $p0
          i32.const 1
          i32.add
          local.tee $p0
          i32.const 10000
          i32.ne
          br_if $L2
        end
        block $B4
          local.get $l14
          i32.const 2
          i32.lt_u
          br_if $B4
          i32.const 160000
          i32.const 200000
          local.get $l8
          select
          i32.const 65568
          i32.add
          local.set $l17
          i32.const 1
          local.set $l18
          loop $L5
            local.get $l18
            i32.const 3
            i32.shl
            local.set $l19
            i32.const 0
            local.set $l20
            i32.const 0
            local.get $l18
            i32.const 1
            i32.shl
            local.tee $l21
            i32.sub
            local.set $l22
            i32.const 347984
            local.set $l23
            i32.const 0
            local.set $l24
            local.get $l18
            local.set $l25
            loop $L6
              local.get $l14
              local.get $l20
              local.tee $l26
              local.get $l21
              i32.add
              local.tee $l20
              local.get $l14
              local.get $l20
              i32.lt_u
              select
              local.set $l10
              block $B7
                block $B8
                  local.get $l26
                  local.get $l14
                  local.get $l26
                  local.get $l18
                  i32.add
                  local.tee $l2
                  local.get $l14
                  local.get $l2
                  i32.lt_u
                  select
                  local.tee $l27
                  i32.ge_u
                  br_if $B8
                  local.get $l2
                  local.get $l10
                  i32.ge_u
                  br_if $B8
                  i32.const 0
                  local.set $l11
                  local.get $l23
                  local.set $l15
                  local.get $l27
                  local.set $l2
                  local.get $l26
                  local.set $p0
                  block $B9
                    loop $L10
                      local.get $l15
                      local.get $p0
                      i32.const 2
                      i32.shl
                      i32.load offset=307984
                      local.tee $l12
                      local.get $l2
                      i32.const 2
                      i32.shl
                      i32.load offset=307984
                      local.tee $l16
                      local.get $l12
                      local.get $l16
                      i32.lt_u
                      local.get $l17
                      local.get $l12
                      i32.const 2
                      i32.shl
                      i32.add
                      i32.load
                      local.tee $l12
                      local.get $l17
                      local.get $l16
                      i32.const 2
                      i32.shl
                      i32.add
                      i32.load
                      local.tee $l16
                      i32.gt_u
                      local.get $l12
                      local.get $l16
                      i32.lt_u
                      local.get $l9
                      select
                      local.get $l12
                      local.get $l16
                      i32.eq
                      select
                      local.tee $l12
                      select
                      i32.store
                      local.get $l2
                      local.get $l12
                      i32.const 1
                      i32.xor
                      i32.add
                      local.set $l2
                      local.get $l11
                      i32.const 1
                      i32.add
                      local.set $l11
                      local.get $p0
                      local.get $l12
                      i32.add
                      local.tee $p0
                      local.get $l27
                      i32.ge_u
                      br_if $B9
                      local.get $l15
                      i32.const 4
                      i32.add
                      local.set $l15
                      local.get $l2
                      local.get $l10
                      i32.lt_u
                      br_if $L10
                    end
                  end
                  i32.const 0
                  local.get $l4
                  local.get $l11
                  i32.add
                  local.tee $l4
                  i32.store offset=307952
                  local.get $l26
                  local.get $l11
                  i32.add
                  local.set $l15
                  br $B7
                end
                local.get $l26
                local.set $p0
                local.get $l27
                local.set $l2
                local.get $l26
                local.set $l15
              end
              block $B11
                local.get $l27
                local.get $p0
                i32.le_u
                br_if $B11
                local.get $l14
                local.get $l25
                local.get $l14
                local.get $l25
                i32.lt_u
                select
                local.set $l12
                block $B12
                  local.get $l27
                  local.get $p0
                  i32.sub
                  i32.const 2
                  i32.shl
                  local.tee $l16
                  i32.eqz
                  br_if $B12
                  local.get $l15
                  i32.const 2
                  i32.shl
                  i32.const 347984
                  i32.add
                  local.get $p0
                  i32.const 2
                  i32.shl
                  i32.const 307984
                  i32.add
                  local.get $l16
                  memory.copy
                end
                local.get $l12
                local.get $p0
                i32.sub
                local.get $l15
                i32.add
                local.set $l15
              end
              block $B13
                local.get $l10
                local.get $l2
                i32.le_u
                br_if $B13
                local.get $l10
                local.get $l2
                i32.sub
                i32.const 2
                i32.shl
                local.tee $p0
                i32.eqz
                br_if $B13
                local.get $l15
                i32.const 2
                i32.shl
                i32.const 347984
                i32.add
                local.get $l2
                i32.const 2
                i32.shl
                i32.const 307984
                i32.add
                local.get $p0
                memory.copy
              end
              block $B14
                local.get $l26
                local.get $l10
                i32.ge_u
                br_if $B14
                local.get $l10
                local.get $l22
                local.get $l24
                i32.mul
                i32.add
                i32.const 2
                i32.shl
                local.tee $l2
                i32.eqz
                br_if $B14
                local.get $l24
                local.get $l19
                i32.mul
                local.tee $p0
                i32.const 307984
                i32.add
                local.get $p0
                i32.const 347984
                i32.add
                local.get $l2
                memory.copy
              end
              local.get $l23
              local.get $l19
              i32.add
              local.set $l23
              local.get $l24
              i32.const 1
              i32.add
              local.set $l24
              local.get $l25
              local.get $l21
              i32.add
              local.set $l25
              local.get $l20
              local.get $l14
              i32.lt_u
              br_if $L6
            end
            local.get $l21
            local.set $l18
            local.get $l21
            local.get $l14
            i32.lt_u
            br_if $L5
          end
        end
        local.get $l3
        i32.const 448
        i32.mul
        local.tee $l2
        local.get $l7
        i32.store offset=305724
        local.get $l2
        i64.const 68719476744
        i64.store offset=305716 align=4
        local.get $l2
        local.get $l13
        i32.store offset=305712
        local.get $l2
        local.get $l9
        i32.store offset=305708
        local.get $l2
        local.get $l8
        i32.store offset=305704
        local.get $l2
        local.get $l14
        i32.store offset=305700
        local.get $l2
        local.get $l3
        i32.store offset=305696
        local.get $l2
        i32.const 0
        i32.load offset=307984
        local.tee $p0
        i32.store offset=305728
        local.get $l2
        i32.const 0
        i32.load offset=307988
        local.tee $l15
        i32.store offset=305740
        local.get $l2
        i32.const 305732
        i32.add
        local.get $p0
        i32.const 2
        i32.shl
        local.tee $p0
        i32.const 225568
        i32.add
        i32.load
        i32.store
        local.get $l2
        i32.const 305736
        i32.add
        local.get $p0
        i32.const 265568
        i32.add
        i32.load
        i32.store
        local.get $l2
        i32.const 305744
        i32.add
        local.get $l15
        i32.const 2
        i32.shl
        local.tee $p0
        i32.const 225568
        i32.add
        i32.load
        i32.store
        local.get $l2
        i32.const 305748
        i32.add
        local.get $p0
        i32.const 265568
        i32.add
        i32.load
        i32.store
        local.get $l2
        i32.const 0
        i32.load offset=307992
        local.tee $p0
        i32.store offset=305752
        local.get $l2
        i32.const 0
        i32.load offset=307996
        local.tee $l15
        i32.store offset=305764
        local.get $l2
        i32.const 0
        i32.load offset=308000
        local.tee $l12
        i32.store offset=305776
        local.get $l2
        i32.const 305756
        i32.add
        local.get $p0
        i32.const 2
        i32.shl
        local.tee $p0
        i32.const 225568
        i32.add
        i32.load
        i32.store
        local.get $l2
        i32.const 305760
        i32.add
        local.get $p0
        i32.const 265568
        i32.add
        i32.load
        i32.store
        local.get $l2
        i32.const 305768
        i32.add
        local.get $l15
        i32.const 2
        i32.shl
        local.tee $p0
        i32.const 225568
        i32.add
        i32.load
        i32.store
        local.get $l2
        i32.const 305772
        i32.add
        local.get $p0
        i32.const 265568
        i32.add
        i32.load
        i32.store
        local.get $l2
        i32.const 305780
        i32.add
        local.get $l12
        i32.const 2
        i32.shl
        local.tee $p0
        i32.const 225568
        i32.add
        i32.load
        i32.store
        local.get $l2
        i32.const 305784
        i32.add
        local.get $p0
        i32.const 265568
        i32.add
        i32.load
        i32.store
        local.get $l2
        i32.const 0
        i32.load offset=308004
        local.tee $p0
        i32.store offset=305788
        local.get $l2
        i32.const 0
        i32.load offset=308008
        local.tee $l15
        i32.store offset=305800
        local.get $l2
        i32.const 0
        i32.load offset=308012
        local.tee $l12
        i32.store offset=305812
        local.get $l2
        i32.const 305792
        i32.add
        local.get $p0
        i32.const 2
        i32.shl
        local.tee $p0
        i32.const 225568
        i32.add
        i32.load
        i32.store
        local.get $l2
        i32.const 305796
        i32.add
        local.get $p0
        i32.const 265568
        i32.add
        i32.load
        i32.store
        local.get $l2
        i32.const 305804
        i32.add
        local.get $l15
        i32.const 2
        i32.shl
        local.tee $p0
        i32.const 225568
        i32.add
        i32.load
        i32.store
        local.get $l2
        i32.const 305808
        i32.add
        local.get $p0
        i32.const 265568
        i32.add
        i32.load
        i32.store
        local.get $l2
        i32.const 305816
        i32.add
        local.get $l12
        i32.const 2
        i32.shl
        local.tee $p0
        i32.const 225568
        i32.add
        i32.load
        i32.store
        local.get $l2
        i32.const 305820
        i32.add
        local.get $p0
        i32.const 265568
        i32.add
        i32.load
        i32.store
        local.get $l2
        local.get $l1
        i32.load offset=256
        i32.store offset=305824
        local.get $l2
        i32.const 305828
        i32.add
        local.get $l1
        i64.load offset=128
        i64.store align=4
        local.get $l2
        i32.const 305836
        i32.add
        local.get $l1
        i64.load
        i64.store align=4
        local.get $l2
        local.get $l1
        i32.load offset=260
        i32.store offset=305844
        local.get $l2
        i32.const 305848
        i32.add
        local.get $l1
        i64.load offset=136
        i64.store
        local.get $l2
        i32.const 305856
        i32.add
        local.get $l1
        i64.load offset=8
        i64.store
        local.get $l2
        local.get $l1
        i32.load offset=264
        i32.store offset=305864
        local.get $l2
        i32.const 305868
        i32.add
        local.get $l1
        i64.load offset=144
        i64.store align=4
        local.get $l2
        i32.const 305876
        i32.add
        local.get $l1
        i64.load offset=16
        i64.store align=4
        local.get $l2
        local.get $l1
        i32.load offset=268
        i32.store offset=305884
        local.get $l2
        i32.const 305888
        i32.add
        local.get $l1
        i64.load offset=152
        i64.store
        local.get $l2
        i32.const 305896
        i32.add
        local.get $l1
        i64.load offset=24
        i64.store
        local.get $l2
        local.get $l1
        i32.load offset=272
        i32.store offset=305904
        local.get $l2
        i32.const 305908
        i32.add
        local.get $l1
        i64.load offset=160
        i64.store align=4
        local.get $l2
        i32.const 305916
        i32.add
        local.get $l1
        i64.load offset=32
        i64.store align=4
        local.get $l2
        local.get $l1
        i32.load offset=276
        i32.store offset=305924
        local.get $l2
        i32.const 305928
        i32.add
        local.get $l1
        i64.load offset=168
        i64.store
        local.get $l2
        i32.const 305936
        i32.add
        local.get $l1
        i64.load offset=40
        i64.store
        local.get $l2
        local.get $l1
        i32.load offset=280
        i32.store offset=305944
        local.get $l2
        i32.const 305948
        i32.add
        local.get $l1
        i64.load offset=176
        i64.store align=4
        local.get $l2
        i32.const 305956
        i32.add
        local.get $l1
        i64.load offset=48
        i64.store align=4
        local.get $l2
        local.get $l1
        i32.load offset=284
        i32.store offset=305964
        local.get $l2
        i32.const 305968
        i32.add
        local.get $l1
        i64.load offset=184
        i64.store
        local.get $l2
        i32.const 305976
        i32.add
        local.get $l1
        i64.load offset=56
        i64.store
        local.get $l2
        local.get $l1
        i32.load offset=288
        i32.store offset=305984
        local.get $l2
        i32.const 305988
        i32.add
        local.get $l1
        i64.load offset=192
        i64.store align=4
        local.get $l2
        i32.const 305996
        i32.add
        local.get $l1
        i64.load offset=64
        i64.store align=4
        local.get $l2
        local.get $l1
        i32.load offset=292
        i32.store offset=306004
        local.get $l2
        i32.const 306008
        i32.add
        local.get $l1
        i64.load offset=200
        i64.store
        local.get $l2
        i32.const 306016
        i32.add
        local.get $l1
        i64.load offset=72
        i64.store
        local.get $l2
        local.get $l1
        i32.load offset=296
        i32.store offset=306024
        local.get $l2
        i32.const 306028
        i32.add
        local.get $l1
        i64.load offset=208
        i64.store align=4
        local.get $l2
        i32.const 306036
        i32.add
        local.get $l1
        i64.load offset=80
        i64.store align=4
        local.get $l2
        local.get $l1
        i32.load offset=300
        i32.store offset=306044
        local.get $l2
        i32.const 306048
        i32.add
        local.get $l1
        i64.load offset=216
        i64.store
        local.get $l2
        i32.const 306056
        i32.add
        local.get $l1
        i64.load offset=88
        i64.store
        local.get $l2
        local.get $l1
        i32.load offset=304
        i32.store offset=306064
        local.get $l2
        i32.const 306068
        i32.add
        local.get $l1
        i64.load offset=224
        i64.store align=4
        local.get $l2
        i32.const 306076
        i32.add
        local.get $l1
        i64.load offset=96
        i64.store align=4
        local.get $l2
        local.get $l1
        i32.load offset=308
        i32.store offset=306084
        local.get $l2
        i32.const 306088
        i32.add
        local.get $l1
        i64.load offset=232
        i64.store
        local.get $l2
        i32.const 306096
        i32.add
        local.get $l1
        i64.load offset=104
        i64.store
        local.get $l2
        local.get $l1
        i32.load offset=312
        i32.store offset=306104
        local.get $l2
        i32.const 306108
        i32.add
        local.get $l1
        i64.load offset=240
        i64.store align=4
        local.get $l2
        i32.const 306116
        i32.add
        local.get $l1
        i64.load offset=112
        i64.store align=4
        local.get $l2
        local.get $l1
        i32.load offset=316
        i32.store offset=306124
        local.get $l2
        i32.const 306128
        i32.add
        local.get $l1
        i64.load offset=248
        i64.store
        local.get $l2
        i32.const 306136
        i32.add
        local.get $l1
        i64.load offset=120
        i64.store
        local.get $l3
        i32.const 1
        i32.add
        local.tee $l3
        i32.const 5
        i32.ne
        br_if $L1
      end
      i32.const 0
      i64.const 644245094450000
      i64.store offset=307940 align=4
      i32.const 560
      local.set $l2
    end
    local.get $l1
    i32.const 320
    i32.add
    global.set $__stack_pointer
    local.get $l2)
  (memory $memory 16)
  (global $__stack_pointer (mut i32) (i32.const 65536))
  (global $__dso_handle i32 (i32.const 65536))
  (global $__data_end i32 (i32.const 387984))
  (global $__stack_low i32 (i32.const 0))
  (global $__stack_high i32 (i32.const 65536))
  (global $__global_base i32 (i32.const 65536))
  (global $__heap_base i32 (i32.const 387984))
  (global $__heap_end i32 (i32.const 1048576))
  (global $__memory_base i32 (i32.const 0))
  (global $__table_base i32 (i32.const 1))
  (global $__wasm_first_page_end i32 (i32.const 65536))
  (export "memory" (memory $memory))
  (export "__wasm_call_ctors" (func $__wasm_call_ctors))
  (export "__stack_pointer" (global $__stack_pointer))
  (export "input_ptr" (func $input_ptr))
  (export "result_ptr" (func $result_ptr))
  (export "counter" (func $counter))
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
