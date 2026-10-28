;; simulation.nbody-cloth.v1 — kernel: nbody_step
;; WebAssembly Text (WAT) baseline implementation
;; Exports: nbody_step

(module $nbody_step_c.wasm
  (type $t0 (func))
  (type $t1 (func (param i32 i32 i32 i32 i32 i32 i32 i32 i32 i32 i32 i32 i32 f64 f64 f64)))
  (func $__wasm_call_ctors (type $t0))
  (func $nbody_step (type $t1) (param $p0 i32) (param $p1 i32) (param $p2 i32) (param $p3 i32) (param $p4 i32) (param $p5 i32) (param $p6 i32) (param $p7 i32) (param $p8 i32) (param $p9 i32) (param $p10 i32) (param $p11 i32) (param $p12 i32) (param $p13 f64) (param $p14 f64) (param $p15 f64)
    (local $l16 i32) (local $l17 i32) (local $l18 f64) (local $l19 f64) (local $l20 f64) (local $l21 f64) (local $l22 i32) (local $l23 i32) (local $l24 i32) (local $l25 i32) (local $l26 f64) (local $l27 f64) (local $l28 i32) (local $l29 f64) (local $l30 f64) (local $l31 f64) (local $l32 i32) (local $l33 i32) (local $l34 i32) (local $l35 i32)
    block $B0
      local.get $p11
      i32.eqz
      br_if $B0
      i32.const 0
      local.set $l16
      loop $L1
        local.get $p3
        local.get $l16
        i32.const 3
        i32.shl
        local.tee $l17
        i32.add
        f64.load
        local.set $l18
        local.get $p2
        local.get $l17
        i32.add
        f64.load
        local.set $l19
        local.get $p1
        local.get $l17
        i32.add
        f64.load
        local.set $l20
        f64.const 0x0p+0 (;=0;)
        local.set $l21
        local.get $p0
        local.set $l22
        local.get $p3
        local.set $l23
        local.get $p2
        local.set $l24
        local.get $p1
        local.set $l25
        f64.const 0x0p+0 (;=0;)
        local.set $l26
        f64.const 0x0p+0 (;=0;)
        local.set $l27
        i32.const 0
        local.set $l28
        loop $L2
          block $B3
            local.get $l16
            local.get $l28
            i32.eq
            br_if $B3
            local.get $l27
            local.get $l23
            f64.load
            local.get $l18
            f64.sub
            local.tee $l29
            f64.const 0x1p+0 (;=1;)
            local.get $p15
            local.get $l25
            f64.load
            local.get $l20
            f64.sub
            local.tee $l30
            local.get $l30
            f64.mul
            local.get $l24
            f64.load
            local.get $l19
            f64.sub
            local.tee $l31
            local.get $l31
            f64.mul
            f64.add
            local.get $l29
            local.get $l29
            f64.mul
            f64.add
            f64.add
            f64.sqrt
            f64.div
            local.tee $l29
            local.get $l29
            local.get $l29
            local.get $p14
            local.get $l22
            f64.load
            f64.mul
            f64.mul
            f64.mul
            f64.mul
            local.tee $l29
            f64.mul
            f64.add
            local.set $l27
            local.get $l26
            local.get $l31
            local.get $l29
            f64.mul
            f64.add
            local.set $l26
            local.get $l21
            local.get $l30
            local.get $l29
            f64.mul
            f64.add
            local.set $l21
          end
          local.get $l22
          i32.const 8
          i32.add
          local.set $l22
          local.get $l23
          i32.const 8
          i32.add
          local.set $l23
          local.get $l24
          i32.const 8
          i32.add
          local.set $l24
          local.get $l25
          i32.const 8
          i32.add
          local.set $l25
          local.get $p11
          local.get $l28
          i32.const 1
          i32.add
          local.tee $l28
          i32.ne
          br_if $L2
        end
        local.get $p7
        local.get $l17
        i32.add
        local.get $l21
        f64.store
        local.get $p8
        local.get $l17
        i32.add
        local.get $l26
        f64.store
        local.get $p9
        local.get $l17
        i32.add
        local.get $l27
        f64.store
        local.get $l16
        i32.const 1
        i32.add
        local.tee $l16
        local.get $p11
        i32.ne
        br_if $L1
      end
    end
    block $B4
      local.get $p12
      i32.eqz
      br_if $B4
      local.get $p12
      i32.const 1
      i32.add
      local.tee $l28
      i32.const 2
      local.get $l28
      i32.const 2
      i32.gt_u
      select
      local.set $l32
      i32.const 1
      local.set $l33
      loop $L5
        local.get $p7
        local.set $l17
        local.get $p4
        local.set $l28
        local.get $p8
        local.set $p12
        local.get $p5
        local.set $l22
        local.get $p9
        local.set $l34
        local.get $p6
        local.set $l23
        local.get $p1
        local.set $l24
        local.get $p2
        local.set $l25
        local.get $p3
        local.set $l16
        local.get $p11
        local.set $l35
        block $B6
          local.get $p11
          i32.eqz
          br_if $B6
          loop $L7
            local.get $l28
            local.get $l28
            f64.load
            local.get $p13
            local.get $l17
            f64.load
            f64.mul
            f64.const 0x1p-1 (;=0.5;)
            f64.mul
            f64.add
            f64.store
            local.get $l22
            local.get $l22
            f64.load
            local.get $p13
            local.get $p12
            f64.load
            f64.mul
            f64.const 0x1p-1 (;=0.5;)
            f64.mul
            f64.add
            f64.store
            local.get $l23
            local.get $l23
            f64.load
            local.get $p13
            local.get $l34
            f64.load
            f64.mul
            f64.const 0x1p-1 (;=0.5;)
            f64.mul
            f64.add
            f64.store
            local.get $l24
            local.get $l24
            f64.load
            local.get $p13
            local.get $l28
            f64.load
            f64.mul
            f64.add
            f64.store
            local.get $l25
            local.get $l25
            f64.load
            local.get $p13
            local.get $l22
            f64.load
            f64.mul
            f64.add
            f64.store
            local.get $l16
            local.get $l16
            f64.load
            local.get $p13
            local.get $l23
            f64.load
            f64.mul
            f64.add
            f64.store
            local.get $l17
            i32.const 8
            i32.add
            local.set $l17
            local.get $l28
            i32.const 8
            i32.add
            local.set $l28
            local.get $p12
            i32.const 8
            i32.add
            local.set $p12
            local.get $l22
            i32.const 8
            i32.add
            local.set $l22
            local.get $l34
            i32.const 8
            i32.add
            local.set $l34
            local.get $l23
            i32.const 8
            i32.add
            local.set $l23
            local.get $l24
            i32.const 8
            i32.add
            local.set $l24
            local.get $l25
            i32.const 8
            i32.add
            local.set $l25
            local.get $l16
            i32.const 8
            i32.add
            local.set $l16
            local.get $l35
            i32.const -1
            i32.add
            local.tee $l35
            br_if $L7
          end
          i32.const 0
          local.set $l16
          loop $L8
            local.get $p3
            local.get $l16
            i32.const 3
            i32.shl
            local.tee $l17
            i32.add
            f64.load
            local.set $l18
            local.get $p2
            local.get $l17
            i32.add
            f64.load
            local.set $l19
            local.get $p1
            local.get $l17
            i32.add
            f64.load
            local.set $l20
            f64.const 0x0p+0 (;=0;)
            local.set $l21
            local.get $p0
            local.set $l22
            local.get $p3
            local.set $l23
            local.get $p2
            local.set $l24
            local.get $p1
            local.set $l25
            f64.const 0x0p+0 (;=0;)
            local.set $l26
            f64.const 0x0p+0 (;=0;)
            local.set $l27
            i32.const 0
            local.set $l28
            loop $L9
              block $B10
                local.get $l16
                local.get $l28
                i32.eq
                br_if $B10
                local.get $l27
                local.get $l23
                f64.load
                local.get $l18
                f64.sub
                local.tee $l29
                f64.const 0x1p+0 (;=1;)
                local.get $p15
                local.get $l25
                f64.load
                local.get $l20
                f64.sub
                local.tee $l30
                local.get $l30
                f64.mul
                local.get $l24
                f64.load
                local.get $l19
                f64.sub
                local.tee $l31
                local.get $l31
                f64.mul
                f64.add
                local.get $l29
                local.get $l29
                f64.mul
                f64.add
                f64.add
                f64.sqrt
                f64.div
                local.tee $l29
                local.get $l29
                local.get $l29
                local.get $p14
                local.get $l22
                f64.load
                f64.mul
                f64.mul
                f64.mul
                f64.mul
                local.tee $l29
                f64.mul
                f64.add
                local.set $l27
                local.get $l26
                local.get $l31
                local.get $l29
                f64.mul
                f64.add
                local.set $l26
                local.get $l21
                local.get $l30
                local.get $l29
                f64.mul
                f64.add
                local.set $l21
              end
              local.get $l22
              i32.const 8
              i32.add
              local.set $l22
              local.get $l23
              i32.const 8
              i32.add
              local.set $l23
              local.get $l24
              i32.const 8
              i32.add
              local.set $l24
              local.get $l25
              i32.const 8
              i32.add
              local.set $l25
              local.get $p11
              local.get $l28
              i32.const 1
              i32.add
              local.tee $l28
              i32.ne
              br_if $L9
            end
            local.get $p7
            local.get $l17
            i32.add
            local.get $l21
            f64.store
            local.get $p8
            local.get $l17
            i32.add
            local.get $l26
            f64.store
            local.get $p9
            local.get $l17
            i32.add
            local.get $l27
            f64.store
            local.get $l16
            i32.const 1
            i32.add
            local.tee $l16
            local.get $p11
            i32.ne
            br_if $L8
          end
          local.get $p7
          local.set $l24
          local.get $p4
          local.set $l28
          local.get $p8
          local.set $l25
          local.get $p5
          local.set $l22
          local.get $p9
          local.set $l16
          local.get $p6
          local.set $l23
          local.get $p11
          local.set $l17
          loop $L11
            local.get $l28
            local.get $l28
            f64.load
            local.get $p13
            local.get $l24
            f64.load
            f64.mul
            f64.const 0x1p-1 (;=0.5;)
            f64.mul
            f64.add
            f64.store
            local.get $l22
            local.get $l22
            f64.load
            local.get $p13
            local.get $l25
            f64.load
            f64.mul
            f64.const 0x1p-1 (;=0.5;)
            f64.mul
            f64.add
            f64.store
            local.get $l23
            local.get $l23
            f64.load
            local.get $p13
            local.get $l16
            f64.load
            f64.mul
            f64.const 0x1p-1 (;=0.5;)
            f64.mul
            f64.add
            f64.store
            local.get $l24
            i32.const 8
            i32.add
            local.set $l24
            local.get $l28
            i32.const 8
            i32.add
            local.set $l28
            local.get $l25
            i32.const 8
            i32.add
            local.set $l25
            local.get $l22
            i32.const 8
            i32.add
            local.set $l22
            local.get $l16
            i32.const 8
            i32.add
            local.set $l16
            local.get $l23
            i32.const 8
            i32.add
            local.set $l23
            local.get $l17
            i32.const -1
            i32.add
            local.tee $l17
            br_if $L11
          end
        end
        local.get $l33
        i32.const 1
        i32.add
        local.tee $l33
        local.get $l32
        i32.ne
        br_if $L5
      end
    end
    block $B12
      local.get $p11
      i32.eqz
      br_if $B12
      local.get $p11
      i32.const 3
      i32.and
      local.set $l24
      i32.const 0
      local.set $l25
      block $B13
        block $B14
          local.get $p11
          i32.const -1
          i32.add
          local.tee $l34
          i32.const 3
          i32.lt_u
          br_if $B14
          local.get $p11
          i32.const -4
          i32.and
          local.set $l16
          i32.const 0
          local.set $l28
          i32.const 0
          local.set $l25
          loop $L15
            local.get $p10
            local.get $l28
            i32.add
            local.tee $l22
            local.get $p1
            local.get $l28
            i32.add
            local.tee $l23
            f64.load
            f64.store
            local.get $l22
            i32.const 8
            i32.add
            local.get $l23
            i32.const 8
            i32.add
            f64.load
            f64.store
            local.get $l22
            i32.const 16
            i32.add
            local.get $l23
            i32.const 16
            i32.add
            f64.load
            f64.store
            local.get $l22
            i32.const 24
            i32.add
            local.get $l23
            i32.const 24
            i32.add
            f64.load
            f64.store
            local.get $l28
            i32.const 32
            i32.add
            local.set $l28
            local.get $l16
            local.get $l25
            i32.const 4
            i32.add
            local.tee $l25
            i32.ne
            br_if $L15
          end
          local.get $l24
          i32.eqz
          br_if $B13
        end
        local.get $p1
        local.get $l25
        i32.const 3
        i32.shl
        local.tee $l22
        i32.add
        local.set $l28
        local.get $p10
        local.get $l22
        i32.add
        local.set $l22
        loop $L16
          local.get $l22
          local.get $l28
          f64.load
          f64.store
          local.get $l28
          i32.const 8
          i32.add
          local.set $l28
          local.get $l22
          i32.const 8
          i32.add
          local.set $l22
          local.get $l24
          i32.const -1
          i32.add
          local.tee $l24
          br_if $L16
        end
      end
      local.get $p11
      i32.const 3
      i32.and
      local.set $l24
      i32.const 0
      local.set $l22
      local.get $p11
      local.set $l16
      block $B17
        block $B18
          local.get $l34
          i32.const 3
          i32.lt_u
          br_if $B18
          i32.const 0
          local.set $l25
          i32.const 0
          local.get $p11
          i32.const -4
          i32.and
          i32.sub
          local.set $l16
          local.get $p10
          local.get $p11
          i32.const 3
          i32.shl
          i32.add
          local.set $l17
          i32.const 0
          local.set $l28
          loop $L19
            local.get $l17
            local.get $l28
            i32.add
            local.tee $l22
            local.get $p2
            local.get $l28
            i32.add
            local.tee $l23
            f64.load
            f64.store
            local.get $l22
            i32.const 8
            i32.add
            local.get $l23
            i32.const 8
            i32.add
            f64.load
            f64.store
            local.get $l22
            i32.const 16
            i32.add
            local.get $l23
            i32.const 16
            i32.add
            f64.load
            f64.store
            local.get $l22
            i32.const 24
            i32.add
            local.get $l23
            i32.const 24
            i32.add
            f64.load
            f64.store
            local.get $l28
            i32.const 32
            i32.add
            local.set $l28
            local.get $l16
            local.get $l25
            i32.const -4
            i32.add
            local.tee $l25
            i32.ne
            br_if $L19
          end
          local.get $p11
          local.get $l25
          i32.sub
          local.set $l16
          local.get $l24
          i32.eqz
          br_if $B17
          i32.const 0
          local.get $l25
          i32.sub
          local.set $l22
        end
        local.get $l16
        local.get $l24
        i32.add
        local.set $l25
        local.get $p10
        local.get $l16
        i32.const 3
        i32.shl
        i32.add
        local.set $l28
        local.get $p2
        local.get $l22
        i32.const 3
        i32.shl
        i32.add
        local.set $l22
        local.get $l24
        local.set $l23
        loop $L20
          local.get $l28
          local.get $l22
          f64.load
          f64.store
          local.get $l28
          i32.const 8
          i32.add
          local.set $l28
          local.get $l22
          i32.const 8
          i32.add
          local.set $l22
          local.get $l23
          i32.const -1
          i32.add
          local.tee $l23
          br_if $L20
        end
        local.get $l25
        local.set $l16
      end
      i32.const 0
      local.set $l22
      block $B21
        block $B22
          local.get $l34
          i32.const 3
          i32.lt_u
          br_if $B22
          local.get $p11
          i32.const 3
          i32.and
          local.set $p2
          i32.const 0
          local.set $l25
          i32.const 0
          local.get $p11
          i32.const -4
          i32.and
          i32.sub
          local.set $l17
          local.get $p10
          local.get $l16
          i32.const 3
          i32.shl
          i32.add
          local.set $p12
          i32.const 0
          local.set $l28
          loop $L23
            local.get $p12
            local.get $l28
            i32.add
            local.tee $l22
            local.get $p3
            local.get $l28
            i32.add
            local.tee $l23
            f64.load
            f64.store
            local.get $l22
            i32.const 8
            i32.add
            local.get $l23
            i32.const 8
            i32.add
            f64.load
            f64.store
            local.get $l22
            i32.const 16
            i32.add
            local.get $l23
            i32.const 16
            i32.add
            f64.load
            f64.store
            local.get $l22
            i32.const 24
            i32.add
            local.get $l23
            i32.const 24
            i32.add
            f64.load
            f64.store
            local.get $l28
            i32.const 32
            i32.add
            local.set $l28
            local.get $l17
            local.get $l25
            i32.const -4
            i32.add
            local.tee $l25
            i32.ne
            br_if $L23
          end
          local.get $l16
          local.get $l25
          i32.sub
          local.set $l16
          local.get $p2
          i32.eqz
          br_if $B21
          i32.const 0
          local.get $l25
          i32.sub
          local.set $l22
        end
        local.get $l16
        local.get $l24
        i32.add
        local.set $l25
        local.get $p10
        local.get $l16
        i32.const 3
        i32.shl
        i32.add
        local.set $l28
        local.get $p3
        local.get $l22
        i32.const 3
        i32.shl
        i32.add
        local.set $l22
        local.get $l24
        local.set $l23
        loop $L24
          local.get $l28
          local.get $l22
          f64.load
          f64.store
          local.get $l28
          i32.const 8
          i32.add
          local.set $l28
          local.get $l22
          i32.const 8
          i32.add
          local.set $l22
          local.get $l23
          i32.const -1
          i32.add
          local.tee $l23
          br_if $L24
        end
        local.get $l25
        local.set $l16
      end
      i32.const 0
      local.set $l22
      block $B25
        block $B26
          local.get $l34
          i32.const 3
          i32.lt_u
          br_if $B26
          local.get $p11
          i32.const 3
          i32.and
          local.set $p3
          i32.const 0
          local.set $l25
          i32.const 0
          local.get $p11
          i32.const -4
          i32.and
          i32.sub
          local.set $l17
          local.get $p10
          local.get $l16
          i32.const 3
          i32.shl
          i32.add
          local.set $p12
          i32.const 0
          local.set $l28
          loop $L27
            local.get $p12
            local.get $l28
            i32.add
            local.tee $l22
            local.get $p4
            local.get $l28
            i32.add
            local.tee $l23
            f64.load
            f64.store
            local.get $l22
            i32.const 8
            i32.add
            local.get $l23
            i32.const 8
            i32.add
            f64.load
            f64.store
            local.get $l22
            i32.const 16
            i32.add
            local.get $l23
            i32.const 16
            i32.add
            f64.load
            f64.store
            local.get $l22
            i32.const 24
            i32.add
            local.get $l23
            i32.const 24
            i32.add
            f64.load
            f64.store
            local.get $l28
            i32.const 32
            i32.add
            local.set $l28
            local.get $l17
            local.get $l25
            i32.const -4
            i32.add
            local.tee $l25
            i32.ne
            br_if $L27
          end
          local.get $l16
          local.get $l25
          i32.sub
          local.set $l16
          local.get $p3
          i32.eqz
          br_if $B25
          i32.const 0
          local.get $l25
          i32.sub
          local.set $l22
        end
        local.get $l16
        local.get $l24
        i32.add
        local.set $l25
        local.get $p10
        local.get $l16
        i32.const 3
        i32.shl
        i32.add
        local.set $l28
        local.get $p4
        local.get $l22
        i32.const 3
        i32.shl
        i32.add
        local.set $l22
        local.get $l24
        local.set $l23
        loop $L28
          local.get $l28
          local.get $l22
          f64.load
          f64.store
          local.get $l28
          i32.const 8
          i32.add
          local.set $l28
          local.get $l22
          i32.const 8
          i32.add
          local.set $l22
          local.get $l23
          i32.const -1
          i32.add
          local.tee $l23
          br_if $L28
        end
        local.get $l25
        local.set $l16
      end
      i32.const 0
      local.set $l22
      block $B29
        block $B30
          local.get $l34
          i32.const 3
          i32.lt_u
          br_if $B30
          local.get $p11
          i32.const 3
          i32.and
          local.set $p3
          i32.const 0
          local.set $l25
          i32.const 0
          local.get $p11
          i32.const -4
          i32.and
          i32.sub
          local.set $l17
          local.get $p10
          local.get $l16
          i32.const 3
          i32.shl
          i32.add
          local.set $p12
          i32.const 0
          local.set $l28
          loop $L31
            local.get $p12
            local.get $l28
            i32.add
            local.tee $l22
            local.get $p5
            local.get $l28
            i32.add
            local.tee $l23
            f64.load
            f64.store
            local.get $l22
            i32.const 8
            i32.add
            local.get $l23
            i32.const 8
            i32.add
            f64.load
            f64.store
            local.get $l22
            i32.const 16
            i32.add
            local.get $l23
            i32.const 16
            i32.add
            f64.load
            f64.store
            local.get $l22
            i32.const 24
            i32.add
            local.get $l23
            i32.const 24
            i32.add
            f64.load
            f64.store
            local.get $l28
            i32.const 32
            i32.add
            local.set $l28
            local.get $l17
            local.get $l25
            i32.const -4
            i32.add
            local.tee $l25
            i32.ne
            br_if $L31
          end
          local.get $l16
          local.get $l25
          i32.sub
          local.set $l16
          local.get $p3
          i32.eqz
          br_if $B29
          i32.const 0
          local.get $l25
          i32.sub
          local.set $l22
        end
        local.get $l16
        local.get $l24
        i32.add
        local.set $l25
        local.get $p10
        local.get $l16
        i32.const 3
        i32.shl
        i32.add
        local.set $l28
        local.get $p5
        local.get $l22
        i32.const 3
        i32.shl
        i32.add
        local.set $l22
        local.get $l24
        local.set $l23
        loop $L32
          local.get $l28
          local.get $l22
          f64.load
          f64.store
          local.get $l28
          i32.const 8
          i32.add
          local.set $l28
          local.get $l22
          i32.const 8
          i32.add
          local.set $l22
          local.get $l23
          i32.const -1
          i32.add
          local.tee $l23
          br_if $L32
        end
        local.get $l25
        local.set $l16
      end
      i32.const 0
      local.set $l22
      block $B33
        local.get $l34
        i32.const 3
        i32.lt_u
        br_if $B33
        local.get $p11
        i32.const 3
        i32.and
        local.set $p12
        i32.const 0
        local.set $l25
        i32.const 0
        local.get $p11
        i32.const -4
        i32.and
        i32.sub
        local.set $p11
        local.get $p10
        local.get $l16
        i32.const 3
        i32.shl
        i32.add
        local.set $l17
        i32.const 0
        local.set $l28
        loop $L34
          local.get $l17
          local.get $l28
          i32.add
          local.tee $l22
          local.get $p6
          local.get $l28
          i32.add
          local.tee $l23
          f64.load
          f64.store
          local.get $l22
          i32.const 8
          i32.add
          local.get $l23
          i32.const 8
          i32.add
          f64.load
          f64.store
          local.get $l22
          i32.const 16
          i32.add
          local.get $l23
          i32.const 16
          i32.add
          f64.load
          f64.store
          local.get $l22
          i32.const 24
          i32.add
          local.get $l23
          i32.const 24
          i32.add
          f64.load
          f64.store
          local.get $l28
          i32.const 32
          i32.add
          local.set $l28
          local.get $p11
          local.get $l25
          i32.const -4
          i32.add
          local.tee $l25
          i32.ne
          br_if $L34
        end
        local.get $p12
        i32.eqz
        br_if $B12
        local.get $l16
        local.get $l25
        i32.sub
        local.set $l16
        i32.const 0
        local.get $l25
        i32.sub
        local.set $l22
      end
      local.get $p10
      local.get $l16
      i32.const 3
      i32.shl
      i32.add
      local.set $l28
      local.get $p6
      local.get $l22
      i32.const 3
      i32.shl
      i32.add
      local.set $l22
      loop $L35
        local.get $l28
        local.get $l22
        f64.load
        f64.store
        local.get $l28
        i32.const 8
        i32.add
        local.set $l28
        local.get $l22
        i32.const 8
        i32.add
        local.set $l22
        local.get $l24
        i32.const -1
        i32.add
        local.tee $l24
        br_if $L35
      end
    end)
  (memory $memory 256)
  (global $__stack_pointer (mut i32) (i32.const 65536))
  (global $__dso_handle i32 (i32.const 65536))
  (global $__data_end i32 (i32.const 65536))
  (global $__stack_low i32 (i32.const 0))
  (global $__stack_high i32 (i32.const 65536))
  (global $__global_base i32 (i32.const 65536))
  (global $__heap_base i32 (i32.const 65536))
  (global $__heap_end i32 (i32.const 16777216))
  (global $__memory_base i32 (i32.const 0))
  (global $__table_base i32 (i32.const 1))
  (global $__wasm_first_page_end i32 (i32.const 65536))
  (export "memory" (memory $memory))
  (export "__wasm_call_ctors" (func $__wasm_call_ctors))
  (export "__stack_pointer" (global $__stack_pointer))
  (export "nbody_step" (func $nbody_step))
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
