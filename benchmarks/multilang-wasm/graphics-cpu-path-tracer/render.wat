;; graphics-cpu-path-tracer.v1 — kernel: render
;; WebAssembly Text (WAT) baseline implementation
;; Exports: render

(module $path_tracer_c.wasm
  (type $t0 (func))
  (type $t1 (func (result i32)))
  (type $t2 (func (param i32 i32 i32) (result i32)))
  (func $__wasm_call_ctors (type $t0))
  (func $framebuffer_ptr (type $t1) (result i32)
    i32.const 66240)
  (func $counters_ptr (type $t1) (result i32)
    i32.const 1114816)
  (func $render (type $t2) (param $p0 i32) (param $p1 i32) (param $p2 i32) (result i32)
    (local $l3 i32) (local $l4 i32) (local $l5 i32) (local $l6 f32) (local $l7 f32) (local $l8 f32) (local $l9 i32) (local $l10 i32) (local $l11 i32) (local $l12 i32) (local $l13 i32) (local $l14 i32) (local $l15 i32) (local $l16 f32) (local $l17 i32) (local $l18 i32) (local $l19 i32) (local $l20 f32) (local $l21 i32) (local $l22 f32) (local $l23 f32) (local $l24 f32) (local $l25 f32) (local $l26 f32) (local $l27 f32) (local $l28 f32) (local $l29 f32) (local $l30 i32) (local $l31 f32) (local $l32 f32) (local $l33 i32) (local $l34 f32) (local $l35 f32) (local $l36 i32) (local $l37 f32) (local $l38 f32) (local $l39 f32) (local $l40 f32) (local $l41 i32) (local $l42 i32) (local $l43 i32) (local $l44 i32) (local $l45 i32) (local $l46 f32) (local $l47 f32) (local $l48 i32) (local $l49 f32) (local $l50 f32) (local $l51 i32) (local $l52 f32)
    global.get $__stack_pointer
    i32.const 128
    i32.sub
    local.set $l3
    i32.const 1
    local.set $l4
    block $B0
      local.get $p2
      i32.const 64
      i32.gt_u
      br_if $B0
      local.get $p1
      i32.const 512
      i32.gt_u
      br_if $B0
      local.get $p0
      i32.const 512
      i32.gt_u
      br_if $B0
      local.get $p0
      i32.eqz
      br_if $B0
      local.get $p1
      i32.eqz
      br_if $B0
      local.get $p2
      i32.eqz
      br_if $B0
      i32.const 0
      i64.const 0
      i64.store offset=1114832
      i32.const 0
      i64.const 0
      i64.store offset=1114840
      i32.const 0
      i64.const 0
      i64.store offset=1114824
      i32.const 0
      i64.const 0
      i64.store offset=1114816
      i32.const 0
      i32.const 1
      i32.store offset=1114848
      i32.const 0
      local.get $p1
      local.get $p0
      i32.mul
      local.tee $l5
      local.get $p2
      i32.mul
      i32.store offset=1114832
      local.get $p2
      f32.convert_i32_u
      local.set $l6
      local.get $p1
      f32.convert_i32_u
      local.set $l7
      local.get $p0
      f32.convert_i32_u
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
      i32.const 0
      local.set $l14
      loop $L1
        local.get $l9
        local.get $p0
        i32.mul
        local.set $l15
        local.get $l9
        f32.convert_i32_u
        local.set $l16
        i32.const 0
        local.set $l17
        loop $L2
          local.get $l17
          local.get $l15
          i32.add
          local.tee $l18
          i32.const -1640531527
          i32.mul
          i32.const 1831565813
          i32.xor
          local.set $l19
          local.get $l17
          f32.convert_i32_u
          local.set $l20
          i32.const 0
          local.set $l21
          f32.const 0x0p+0 (;=0;)
          local.set $l22
          f32.const 0x0p+0 (;=0;)
          local.set $l23
          f32.const 0x0p+0 (;=0;)
          local.set $l24
          loop $L3
            f32.const 0x1p+0 (;=1;)
            local.set $l25
            f32.const 0x0p+0 (;=0;)
            local.set $l26
            f32.const 0x1p+0 (;=1;)
            local.set $l27
            f32.const 0x0p+0 (;=0;)
            local.set $l28
            block $B4
              local.get $l21
              i32.const -2048144789
              i32.mul
              local.get $l19
              i32.xor
              local.tee $l4
              i32.const 13
              i32.shl
              local.get $l4
              i32.xor
              local.tee $l4
              i32.const 17
              i32.shr_u
              local.get $l4
              i32.xor
              local.tee $l4
              i32.const 5
              i32.shl
              local.get $l4
              i32.xor
              local.tee $l4
              i32.const 8
              i32.shr_u
              f32.convert_i32_u
              f32.const 0x1p-24 (;=5.96046e-08;)
              f32.mul
              local.get $l20
              f32.add
              local.get $l8
              f32.div
              local.tee $l29
              local.get $l29
              f32.add
              f32.const -0x1p+0 (;=-1;)
              f32.add
              f32.const 0x1.b33334p+0 (;=1.7;)
              f32.mul
              local.tee $l29
              local.get $l29
              f32.mul
              f32.const 0x1p+0 (;=1;)
              local.get $l4
              i32.const 13
              i32.shl
              local.get $l4
              i32.xor
              local.tee $l4
              i32.const 17
              i32.shr_u
              local.get $l4
              i32.xor
              local.tee $l4
              i32.const 5
              i32.shl
              local.get $l4
              i32.xor
              local.tee $l30
              i32.const 8
              i32.shr_u
              f32.convert_i32_u
              f32.const 0x1p-24 (;=5.96046e-08;)
              f32.mul
              local.get $l16
              f32.add
              local.get $l7
              f32.div
              local.tee $l31
              local.get $l31
              f32.add
              f32.sub
              f32.const 0x1.b33334p+0 (;=1.7;)
              f32.mul
              local.tee $l31
              local.get $l31
              f32.mul
              f32.const 0x1.44p+4 (;=20.25;)
              f32.add
              f32.add
              local.tee $l32
              f32.const 0x0p+0 (;=0;)
              f32.eq
              br_if $B4
              f32.const -0x1.2p+2 (;=-4.5;)
              local.get $l32
              f32.sqrt
              local.tee $l32
              f32.div
              local.set $l28
              local.get $l31
              local.get $l32
              f32.div
              local.set $l27
              local.get $l29
              local.get $l32
              f32.div
              local.set $l26
            end
            local.get $l13
            i32.const 2
            i32.add
            local.set $l13
            local.get $l14
            i32.const 5
            i32.add
            local.set $l33
            f32.const 0x0p+0 (;=0;)
            local.set $l34
            f32.const 0x1.2p+2 (;=4.5;)
            local.set $l35
            i32.const 0
            local.set $l36
            f32.const 0x1p+0 (;=1;)
            local.set $l37
            f32.const 0x1p+0 (;=1;)
            local.set $l38
            f32.const 0x0p+0 (;=0;)
            local.set $l32
            block $B5
              block $B6
                block $B7
                  loop $L8
                    local.get $l3
                    i32.const 0
                    i32.store
                    f32.const 0x1p+0 (;=1;)
                    local.get $l28
                    f32.div
                    local.set $l39
                    f32.const 0x1p+0 (;=1;)
                    local.get $l27
                    f32.div
                    local.set $l40
                    f32.const 0x1p+0 (;=1;)
                    local.get $l26
                    f32.div
                    local.set $l29
                    i32.const 1
                    local.set $l4
                    local.get $l14
                    i32.const 1
                    i32.add
                    local.set $l14
                    f32.const 0x1.93e594p+99 (;=1e+30;)
                    local.set $l31
                    i32.const -1
                    local.set $l41
                    loop $L9
                      block $B10
                        block $B11
                          local.get $l31
                          local.get $l29
                          local.get $l3
                          local.get $l4
                          i32.const -1
                          i32.add
                          local.tee $l42
                          i32.const 2
                          i32.shl
                          i32.add
                          local.tee $l43
                          i32.load
                          local.tee $l44
                          i32.const 36
                          i32.mul
                          local.tee $l45
                          i32.const 65772
                          i32.add
                          f32.load
                          local.get $l32
                          f32.sub
                          f32.mul
                          local.tee $l46
                          local.get $l29
                          local.get $l45
                          i32.const 65784
                          i32.add
                          f32.load
                          local.get $l32
                          f32.sub
                          f32.mul
                          local.tee $l47
                          local.get $l29
                          f32.const 0x0p+0 (;=0;)
                          f32.lt
                          local.tee $l48
                          select
                          local.tee $l49
                          local.get $l31
                          local.get $l49
                          f32.lt
                          select
                          local.tee $l49
                          f32.const 0x1.0624dep-10 (;=0.001;)
                          local.get $l47
                          local.get $l46
                          local.get $l48
                          select
                          local.tee $l46
                          local.get $l46
                          f32.const 0x1.0624dep-10 (;=0.001;)
                          f32.lt
                          select
                          local.tee $l46
                          f32.lt
                          i32.eqz
                          br_if $B11
                          local.get $l42
                          local.set $l4
                          br $B10
                        end
                        block $B12
                          local.get $l49
                          local.get $l40
                          local.get $l45
                          i32.const 65760
                          i32.add
                          local.tee $l48
                          f32.load offset=16
                          local.get $l34
                          f32.sub
                          f32.mul
                          local.tee $l47
                          local.get $l40
                          local.get $l48
                          f32.load offset=28
                          local.get $l34
                          f32.sub
                          f32.mul
                          local.tee $l50
                          local.get $l40
                          f32.const 0x0p+0 (;=0;)
                          f32.lt
                          local.tee $l51
                          select
                          local.tee $l52
                          local.get $l49
                          local.get $l52
                          f32.lt
                          select
                          local.tee $l49
                          local.get $l46
                          local.get $l50
                          local.get $l47
                          local.get $l51
                          select
                          local.tee $l47
                          local.get $l46
                          local.get $l47
                          f32.gt
                          select
                          local.tee $l46
                          f32.lt
                          i32.eqz
                          br_if $B12
                          local.get $l42
                          local.set $l4
                          br $B10
                        end
                        block $B13
                          local.get $l49
                          local.get $l39
                          local.get $l45
                          i32.const 65780
                          i32.add
                          f32.load
                          local.get $l35
                          f32.sub
                          f32.mul
                          local.tee $l47
                          local.get $l39
                          local.get $l45
                          i32.const 65792
                          i32.add
                          f32.load
                          local.get $l35
                          f32.sub
                          f32.mul
                          local.tee $l50
                          local.get $l39
                          f32.const 0x0p+0 (;=0;)
                          f32.lt
                          local.tee $l45
                          select
                          local.tee $l52
                          local.get $l49
                          local.get $l52
                          f32.lt
                          select
                          local.get $l46
                          local.get $l50
                          local.get $l47
                          local.get $l45
                          select
                          local.tee $l47
                          local.get $l46
                          local.get $l47
                          f32.gt
                          select
                          f32.lt
                          i32.eqz
                          br_if $B13
                          local.get $l42
                          local.set $l4
                          br $B10
                        end
                        block $B14
                          i32.const 1
                          local.get $l44
                          i32.shl
                          i32.const 8096
                          i32.and
                          i32.eqz
                          br_if $B14
                          i32.const 0
                          local.get $l10
                          i32.const 1
                          i32.add
                          local.tee $l10
                          i32.store offset=1114828
                          block $B15
                            local.get $l32
                            local.get $l48
                            i32.load offset=8
                            local.tee $l45
                            i32.const 5
                            i32.shl
                            local.tee $l4
                            i32.const 65536
                            i32.add
                            f32.load
                            f32.sub
                            local.tee $l46
                            local.get $l26
                            f32.mul
                            local.get $l34
                            local.get $l4
                            i32.const 65540
                            i32.add
                            f32.load
                            f32.sub
                            local.tee $l47
                            local.get $l27
                            f32.mul
                            local.get $l28
                            local.get $l35
                            local.get $l4
                            i32.const 65544
                            i32.add
                            f32.load
                            f32.sub
                            local.tee $l49
                            f32.mul
                            f32.add
                            f32.add
                            local.tee $l50
                            local.get $l50
                            f32.mul
                            local.get $l4
                            i32.const 65548
                            i32.add
                            f32.load
                            local.tee $l52
                            local.get $l52
                            f32.mul
                            local.get $l46
                            local.get $l46
                            f32.mul
                            local.get $l47
                            local.get $l47
                            f32.mul
                            local.get $l49
                            local.get $l49
                            f32.mul
                            f32.add
                            f32.add
                            f32.sub
                            f32.add
                            local.tee $l46
                            f32.const 0x0p+0 (;=0;)
                            f32.lt
                            i32.eqz
                            br_if $B15
                            local.get $l42
                            local.set $l4
                            br $B10
                          end
                          block $B16
                            local.get $l46
                            f32.sqrt
                            local.tee $l46
                            local.get $l50
                            f32.sub
                            local.get $l50
                            f32.neg
                            local.get $l46
                            f32.sub
                            local.tee $l46
                            local.get $l46
                            f32.const 0x1.0624dep-10 (;=0.001;)
                            f32.le
                            select
                            local.tee $l46
                            f32.const 0x1.0624dep-10 (;=0.001;)
                            f32.gt
                            br_if $B16
                            local.get $l42
                            local.set $l4
                            br $B10
                          end
                          block $B17
                            local.get $l46
                            local.get $l31
                            f32.lt
                            br_if $B17
                            block $B18
                              local.get $l46
                              local.get $l31
                              f32.eq
                              br_if $B18
                              local.get $l42
                              local.set $l4
                              br $B10
                            end
                            local.get $l45
                            local.get $l41
                            i32.lt_s
                            br_if $B17
                            local.get $l42
                            local.set $l4
                            br $B10
                          end
                          local.get $l46
                          local.set $l31
                          local.get $l45
                          local.set $l41
                          local.get $l42
                          local.set $l4
                          br $B10
                        end
                        local.get $l43
                        local.get $l48
                        i32.load offset=4
                        i32.store
                        local.get $l3
                        local.get $l4
                        i32.const 2
                        i32.shl
                        i32.add
                        local.get $l48
                        i32.load
                        i32.store
                        local.get $l4
                        i32.const 1
                        i32.add
                        local.set $l4
                      end
                      local.get $l12
                      i32.const 1
                      i32.add
                      local.set $l12
                      local.get $l4
                      br_if $L9
                    end
                    local.get $l41
                    i32.const 0
                    i32.lt_s
                    br_if $B7
                    f32.const 0x0p+0 (;=0;)
                    local.set $l46
                    f32.const 0x1p+0 (;=1;)
                    local.set $l47
                    f32.const 0x0p+0 (;=0;)
                    local.set $l49
                    block $B19
                      local.get $l32
                      local.get $l26
                      local.get $l31
                      f32.mul
                      f32.add
                      local.tee $l52
                      local.get $l41
                      i32.const 5
                      i32.shl
                      local.tee $l4
                      f32.load offset=65536
                      f32.sub
                      local.tee $l29
                      local.get $l29
                      f32.mul
                      local.get $l34
                      local.get $l27
                      local.get $l31
                      f32.mul
                      f32.add
                      local.tee $l39
                      local.get $l4
                      f32.load offset=65540
                      f32.sub
                      local.tee $l32
                      local.get $l32
                      f32.mul
                      local.get $l35
                      local.get $l28
                      local.get $l31
                      f32.mul
                      f32.add
                      local.tee $l35
                      local.get $l4
                      f32.load offset=65544
                      f32.sub
                      local.tee $l31
                      local.get $l31
                      f32.mul
                      f32.add
                      f32.add
                      local.tee $l40
                      f32.const 0x0p+0 (;=0;)
                      f32.eq
                      br_if $B19
                      local.get $l31
                      local.get $l40
                      f32.sqrt
                      local.tee $l46
                      f32.div
                      local.set $l49
                      local.get $l32
                      local.get $l46
                      f32.div
                      local.set $l47
                      local.get $l29
                      local.get $l46
                      f32.div
                      local.set $l46
                    end
                    local.get $l4
                    i32.const 65536
                    i32.add
                    local.set $l4
                    i32.const 0
                    local.get $l11
                    i32.const 1
                    i32.add
                    local.tee $l11
                    i32.store offset=1114820
                    local.get $l41
                    i32.const 6
                    i32.eq
                    br_if $B6
                    local.get $l38
                    local.get $l4
                    f32.load offset=24
                    f32.mul
                    local.set $l38
                    local.get $l37
                    local.get $l4
                    f32.load offset=20
                    f32.mul
                    local.set $l37
                    local.get $l25
                    local.get $l4
                    f32.load offset=16
                    f32.mul
                    local.set $l25
                    block $B20
                      local.get $l36
                      i32.const 2
                      i32.lt_u
                      br_if $B20
                      local.get $l13
                      i32.const 1
                      i32.add
                      local.set $l13
                      local.get $l30
                      i32.const 13
                      i32.shl
                      local.get $l30
                      i32.xor
                      local.tee $l4
                      i32.const 17
                      i32.shr_u
                      local.get $l4
                      i32.xor
                      local.tee $l4
                      i32.const 5
                      i32.shl
                      local.get $l4
                      i32.xor
                      local.tee $l30
                      i32.const 8
                      i32.shr_u
                      f32.convert_i32_u
                      f32.const 0x1p-24 (;=5.96046e-08;)
                      f32.mul
                      f32.const 0x1.99999ap-4 (;=0.1;)
                      f32.const 0x1.e66666p-1 (;=0.95;)
                      local.get $l25
                      local.get $l37
                      local.get $l38
                      local.get $l37
                      local.get $l38
                      f32.gt
                      select
                      local.tee $l29
                      local.get $l25
                      local.get $l29
                      f32.gt
                      select
                      local.tee $l29
                      local.get $l29
                      f32.const 0x1.e66666p-1 (;=0.95;)
                      f32.gt
                      select
                      local.tee $l29
                      local.get $l29
                      f32.const 0x1.99999ap-4 (;=0.1;)
                      f32.lt
                      select
                      local.tee $l29
                      f32.gt
                      br_if $B7
                      local.get $l38
                      local.get $l29
                      f32.div
                      local.set $l38
                      local.get $l37
                      local.get $l29
                      f32.div
                      local.set $l37
                      local.get $l25
                      local.get $l29
                      f32.div
                      local.set $l25
                    end
                    f32.const 0x0p+0 (;=0;)
                    local.set $l29
                    f32.const 0x1p+0 (;=1;)
                    local.set $l31
                    f32.const 0x0p+0 (;=0;)
                    local.set $l32
                    block $B21
                      local.get $l30
                      i32.const 13
                      i32.shl
                      local.get $l30
                      i32.xor
                      local.tee $l4
                      i32.const 17
                      i32.shr_u
                      local.get $l4
                      i32.xor
                      local.tee $l4
                      i32.const 5
                      i32.shl
                      local.get $l4
                      i32.xor
                      local.tee $l4
                      i32.const 8
                      i32.shr_u
                      f32.convert_i32_u
                      f32.const 0x1p-24 (;=5.96046e-08;)
                      f32.mul
                      local.tee $l40
                      local.get $l40
                      f32.add
                      f32.const -0x1p+0 (;=-1;)
                      f32.add
                      local.tee $l40
                      local.get $l40
                      f32.mul
                      local.get $l4
                      i32.const 13
                      i32.shl
                      local.get $l4
                      i32.xor
                      local.tee $l4
                      i32.const 17
                      i32.shr_u
                      local.get $l4
                      i32.xor
                      local.tee $l4
                      i32.const 5
                      i32.shl
                      local.get $l4
                      i32.xor
                      local.tee $l4
                      i32.const 8
                      i32.shr_u
                      f32.convert_i32_u
                      f32.const 0x1p-24 (;=5.96046e-08;)
                      f32.mul
                      local.tee $l34
                      local.get $l34
                      f32.add
                      f32.const -0x1p+0 (;=-1;)
                      f32.add
                      local.tee $l34
                      local.get $l34
                      f32.mul
                      local.get $l4
                      i32.const 13
                      i32.shl
                      local.get $l4
                      i32.xor
                      local.tee $l4
                      i32.const 17
                      i32.shr_u
                      local.get $l4
                      i32.xor
                      local.tee $l4
                      i32.const 5
                      i32.shl
                      local.get $l4
                      i32.xor
                      local.tee $l30
                      i32.const 8
                      i32.shr_u
                      f32.convert_i32_u
                      f32.const 0x1p-24 (;=5.96046e-08;)
                      f32.mul
                      local.tee $l50
                      local.get $l50
                      f32.add
                      f32.const -0x1p+0 (;=-1;)
                      f32.add
                      local.tee $l50
                      local.get $l50
                      f32.mul
                      f32.add
                      f32.add
                      local.tee $l26
                      f32.const 0x0p+0 (;=0;)
                      f32.eq
                      br_if $B21
                      local.get $l50
                      local.get $l26
                      f32.sqrt
                      local.tee $l29
                      f32.div
                      local.set $l32
                      local.get $l34
                      local.get $l29
                      f32.div
                      local.set $l31
                      local.get $l40
                      local.get $l29
                      f32.div
                      local.set $l29
                    end
                    local.get $l13
                    i32.const 3
                    i32.add
                    local.set $l13
                    local.get $l29
                    f32.neg
                    local.get $l29
                    local.get $l29
                    local.get $l46
                    f32.mul
                    local.get $l31
                    local.get $l47
                    f32.mul
                    local.get $l49
                    local.get $l32
                    f32.mul
                    f32.add
                    f32.add
                    f32.const 0x0p+0 (;=0;)
                    f32.lt
                    local.tee $l4
                    select
                    local.set $l26
                    local.get $l31
                    f32.neg
                    local.get $l31
                    local.get $l4
                    select
                    local.set $l27
                    local.get $l32
                    f32.neg
                    local.get $l32
                    local.get $l4
                    select
                    local.set $l28
                    local.get $l35
                    local.get $l49
                    f32.const 0x1.0624dep-10 (;=0.001;)
                    f32.mul
                    f32.add
                    local.set $l35
                    local.get $l39
                    local.get $l47
                    f32.const 0x1.0624dep-10 (;=0.001;)
                    f32.mul
                    f32.add
                    local.set $l34
                    local.get $l52
                    local.get $l46
                    f32.const 0x1.0624dep-10 (;=0.001;)
                    f32.mul
                    f32.add
                    local.set $l32
                    local.get $l36
                    i32.const 1
                    i32.add
                    local.tee $l36
                    i32.const 4
                    i32.ne
                    br_if $L8
                  end
                  local.get $l33
                  local.set $l14
                end
                i32.const 0
                local.get $l12
                i32.store offset=1114824
                f32.const 0x0p+0 (;=0;)
                local.set $l29
                f32.const 0x0p+0 (;=0;)
                local.set $l31
                f32.const 0x0p+0 (;=0;)
                local.set $l32
                br $B5
              end
              i32.const 0
              local.get $l12
              i32.store offset=1114824
              local.get $l38
              local.get $l4
              f32.load offset=28
              local.tee $l29
              f32.mul
              f32.const 0x0p+0 (;=0;)
              f32.add
              local.set $l32
              local.get $l37
              local.get $l29
              f32.mul
              f32.const 0x0p+0 (;=0;)
              f32.add
              local.set $l31
              local.get $l25
              local.get $l29
              f32.mul
              f32.const 0x0p+0 (;=0;)
              f32.add
              local.set $l29
            end
            local.get $l24
            local.get $l32
            f32.add
            local.set $l24
            local.get $l23
            local.get $l31
            f32.add
            local.set $l23
            local.get $l22
            local.get $l29
            f32.add
            local.set $l22
            local.get $l21
            i32.const 1
            i32.add
            local.tee $l21
            local.get $p2
            i32.ne
            br_if $L3
          end
          local.get $l18
          i32.const 2
          i32.shl
          local.tee $l4
          i32.const 255
          i32.store8 offset=66243
          local.get $l4
          f32.const 0x0p+0 (;=0;)
          f32.const 0x1p+0 (;=1;)
          local.get $l24
          local.get $l6
          f32.div
          local.tee $l29
          local.get $l29
          f32.const 0x1p+0 (;=1;)
          f32.add
          f32.div
          local.tee $l29
          local.get $l29
          f32.const 0x1p+0 (;=1;)
          f32.gt
          select
          local.tee $l29
          local.get $l29
          f32.const 0x0p+0 (;=0;)
          f32.lt
          select
          f32.sqrt
          f32.const 0x1.fep+7 (;=255;)
          f32.mul
          f32.const 0x1p-1 (;=0.5;)
          f32.add
          i32.trunc_sat_f32_s
          local.tee $l45
          i32.const 0
          local.get $l45
          i32.const 0
          i32.gt_s
          select
          local.tee $l45
          i32.const 255
          local.get $l45
          i32.const 255
          i32.lt_s
          select
          i32.store8 offset=66242
          local.get $l4
          f32.const 0x0p+0 (;=0;)
          f32.const 0x1p+0 (;=1;)
          local.get $l23
          local.get $l6
          f32.div
          local.tee $l29
          local.get $l29
          f32.const 0x1p+0 (;=1;)
          f32.add
          f32.div
          local.tee $l29
          local.get $l29
          f32.const 0x1p+0 (;=1;)
          f32.gt
          select
          local.tee $l29
          local.get $l29
          f32.const 0x0p+0 (;=0;)
          f32.lt
          select
          f32.sqrt
          f32.const 0x1.fep+7 (;=255;)
          f32.mul
          f32.const 0x1p-1 (;=0.5;)
          f32.add
          i32.trunc_sat_f32_s
          local.tee $l45
          i32.const 0
          local.get $l45
          i32.const 0
          i32.gt_s
          select
          local.tee $l45
          i32.const 255
          local.get $l45
          i32.const 255
          i32.lt_s
          select
          i32.store8 offset=66241
          local.get $l4
          f32.const 0x0p+0 (;=0;)
          f32.const 0x1p+0 (;=1;)
          local.get $l22
          local.get $l6
          f32.div
          local.tee $l29
          local.get $l29
          f32.const 0x1p+0 (;=1;)
          f32.add
          f32.div
          local.tee $l29
          local.get $l29
          f32.const 0x1p+0 (;=1;)
          f32.gt
          select
          local.tee $l29
          local.get $l29
          f32.const 0x0p+0 (;=0;)
          f32.lt
          select
          f32.sqrt
          f32.const 0x1.fep+7 (;=255;)
          f32.mul
          f32.const 0x1p-1 (;=0.5;)
          f32.add
          i32.trunc_sat_f32_s
          local.tee $l45
          i32.const 0
          local.get $l45
          i32.const 0
          i32.gt_s
          select
          local.tee $l45
          i32.const 255
          local.get $l45
          i32.const 255
          i32.lt_s
          select
          i32.store8 offset=66240
          local.get $l17
          i32.const 1
          i32.add
          local.tee $l17
          local.get $p0
          i32.ne
          br_if $L2
        end
        local.get $l9
        i32.const 1
        i32.add
        local.tee $l9
        local.get $p1
        i32.ne
        br_if $L1
      end
      i32.const 0
      local.set $l4
      i32.const 0
      local.get $l14
      i32.store offset=1114816
      i32.const 0
      local.get $l13
      i32.store offset=1114836
      i32.const 0
      local.get $l5
      i32.const 2
      i32.shl
      i32.store offset=1114844
    end
    local.get $l4)
  (memory $memory 256 256)
  (global $__stack_pointer (mut i32) (i32.const 65536))
  (global $__dso_handle i32 (i32.const 65536))
  (global $__data_end i32 (i32.const 1114852))
  (global $__stack_low i32 (i32.const 0))
  (global $__stack_high i32 (i32.const 65536))
  (global $__global_base i32 (i32.const 65536))
  (global $__heap_base i32 (i32.const 1114864))
  (global $__heap_end i32 (i32.const 16777216))
  (global $__memory_base i32 (i32.const 0))
  (global $__table_base i32 (i32.const 1))
  (global $__wasm_first_page_end i32 (i32.const 65536))
  (export "memory" (memory $memory))
  (export "__wasm_call_ctors" (func $__wasm_call_ctors))
  (export "__stack_pointer" (global $__stack_pointer))
  (export "framebuffer_ptr" (func $framebuffer_ptr))
  (export "counters_ptr" (func $counters_ptr))
  (export "render" (func $render))
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
  (data $.rodata (i32.const 65536) "\00\00\00\00\00@z\c4\00\00\00\00\00\00zD\ecQ8?\ecQ8?\ecQ8?\00\00\00\00\00@z\c4\00\00\00\00\00\00\00\00\00\00zD\ecQ8?\8f\c2\f5=\8f\c2\f5=\00\00\00\00\00@zD\00\00\00\00\00\00\00\00\00\00zD\8f\c2\f5=\ecQ8?\ecQ8>\00\00\00\00\00\00\00\00\00\00\00\00\00@z\c4\00\00zD\ecQ8?\ecQ8?\ecQ8?\00\00\00\00\9a\99\19\bfff\e6\be\9a\99\99>\cd\cc\0c?\00\00@?{\14.?\aeGa>\00\00\00\00ff&?\cd\cc\0c\bf\cd\ccL\beff\e6>\cd\ccL>\5c\8f\c2>\85\ebQ?\00\00\00\00\00\00\00\0033\13@\00\00\00\00\00\00\00?\00\00\80?\00\00\80?\00\00\80?\00\00\00A\01\00\00\00\02\00\00\00\ff\ff\ff\ff\00 \fa\c4\00 \fa\c4\00 \fa\c4\00 \faD\00\00zD\00\00zD\03\00\00\00\04\00\00\00\ff\ff\ff\ff\00 \fa\c4\00 \fa\c4\00 \fa\c4\00 \faD\00\00zD\00\00zD\05\00\00\00\06\00\00\00\ff\ff\ff\ff43\93\bf\00\00\80\bfff&\bf\cc\cc\8c?333@\9a\99Y?\07\00\00\00\08\00\00\00\ff\ff\ff\ff\00\00z\c4\00 \fa\c4\00 \fa\c4\00\00zD\00\00zD\00\00zD\09\00\00\00\0a\00\00\00\ff\ff\ff\ff\00 \fa\c4\00\00z\c4\00\00z\c4\00 \faD\00\00zD\00\00zD\ff\ff\ff\ff\ff\ff\ff\ff\04\00\00\0043\93\bf\00\00\80\bf\00\00\80\be\d0\ccL\bd\d0\cc\cc=\9a\99Y?\0b\00\00\00\0c\00\00\00\ff\ff\ff\ff\00\00\00\bf\00\00\80\bfff&\bf\cc\cc\8c?333@\00\00\00?\ff\ff\ff\ff\ff\ff\ff\ff\00\00\00\00\00\00z\c4\00 \fa\c4\00\00z\c4\00\00zD\00\00\80\bf\00\00zD\ff\ff\ff\ff\ff\ff\ff\ff\03\00\00\00\00\00z\c4\00\00z\c4\00 \fa\c4\00\00zD\00\00zD\00\00\80\bf\ff\ff\ff\ff\ff\ff\ff\ff\01\00\00\00\00 \fa\c4\00\00z\c4\00\00z\c4\00\00\80\bf\00\00zD\00\00zD\ff\ff\ff\ff\ff\ff\ff\ff\02\00\00\00\00\00\80?\00\00z\c4\00\00z\c4\00 \faD\00\00zD\00\00zD\ff\ff\ff\ff\ff\ff\ff\ff\05\00\00\00\cc\ccL>\00\00\80\bfff&\bf\cc\cc\8c?\d0\cc\cc\bd\ff\ff\7f>\ff\ff\ff\ff\ff\ff\ff\ff\06\00\00\00\00\00\00\bfff\e6?\00\00\00\bf\00\00\00?333@\00\00\00?"))
