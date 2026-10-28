;; crypto.authenticated-stream.v1 — kernel: crypto
;; WebAssembly Text (WAT) baseline implementation
;; Exports: crypto

(module $crypto_c.wasm
  (type $t0 (func))
  (type $t1 (func (param i32 i32 i32 i32 i32 i32 i32 i32) (result i32)))
  (type $t2 (func (param i32 i32 i32 i32)))
  (type $t3 (func (param i32 i32 i32 i32 i32 i32 i32)))
  (type $t4 (func (param i32 i32 i32)))
  (func $__wasm_call_ctors (type $t0))
  (func $seal (type $t1) (param $p0 i32) (param $p1 i32) (param $p2 i32) (param $p3 i32) (param $p4 i32) (param $p5 i32) (param $p6 i32) (param $p7 i32) (result i32)
    (local $l8 i32) (local $l9 i32) (local $l10 i32) (local $l11 i32) (local $l12 i32) (local $l13 i32) (local $l14 i32) (local $l15 i32) (local $l16 i32) (local $l17 i32) (local $l18 i32) (local $l19 i32)
    global.get $__stack_pointer
    i32.const 64
    i32.sub
    local.tee $l8
    global.set $__stack_pointer
    block $B0
      local.get $p5
      i32.eqz
      br_if $B0
      i32.const 0
      local.set $l9
      local.get $p4
      local.set $l10
      local.get $p6
      local.set $l11
      local.get $p5
      local.set $l12
      i32.const 1
      local.set $l13
      loop $L1
        local.get $p0
        local.get $l13
        local.get $p1
        local.get $l8
        call $chacha_block
        i32.const 0
        local.set $l14
        block $B2
          block $B3
            local.get $l12
            i32.const 2
            i32.lt_u
            br_if $B3
            local.get $l12
            i32.const 1
            local.get $l12
            i32.const 1
            i32.gt_u
            select
            local.tee $l14
            i32.const 64
            local.get $l14
            i32.const 64
            i32.lt_u
            select
            local.tee $l14
            i32.const 1
            i32.and
            local.set $l15
            local.get $l14
            i32.const 126
            i32.and
            local.set $l16
            i32.const 0
            local.set $l14
            loop $L4
              local.get $l11
              local.get $l14
              i32.add
              local.tee $l17
              local.get $l8
              local.get $l14
              i32.add
              local.tee $l18
              i32.load8_u
              local.get $l10
              local.get $l14
              i32.add
              local.tee $l19
              i32.load8_u
              i32.xor
              i32.store8
              local.get $l17
              i32.const 1
              i32.add
              local.get $l18
              i32.const 1
              i32.add
              i32.load8_u
              local.get $l19
              i32.const 1
              i32.add
              i32.load8_u
              i32.xor
              i32.store8
              local.get $l16
              local.get $l14
              i32.const 2
              i32.add
              local.tee $l14
              i32.ne
              br_if $L4
            end
            local.get $l15
            i32.eqz
            br_if $B2
          end
          local.get $p6
          local.get $l14
          local.get $l9
          i32.add
          local.tee $l17
          i32.add
          local.get $l8
          local.get $l14
          i32.add
          i32.load8_u
          local.get $p4
          local.get $l17
          i32.add
          i32.load8_u
          i32.xor
          i32.store8
        end
        local.get $l10
        i32.const 64
        i32.add
        local.set $l10
        local.get $l11
        i32.const 64
        i32.add
        local.set $l11
        local.get $l12
        i32.const -64
        i32.add
        local.set $l12
        local.get $l13
        i32.const 1
        i32.add
        local.set $l13
        local.get $l9
        i32.const 64
        i32.add
        local.tee $l9
        local.get $p5
        i32.lt_u
        br_if $L1
      end
    end
    local.get $p0
    local.get $p1
    local.get $p2
    local.get $p3
    local.get $p6
    local.get $p5
    local.get $p7
    call $aead_tag
    local.get $l8
    i32.const 64
    i32.add
    global.set $__stack_pointer
    local.get $p5)
  (func $chacha_block (type $t2) (param $p0 i32) (param $p1 i32) (param $p2 i32) (param $p3 i32)
    (local $l4 i32) (local $l5 i32) (local $l6 i32) (local $l7 i32) (local $l8 i32) (local $l9 i32) (local $l10 i32) (local $l11 i32) (local $l12 i32) (local $l13 i32) (local $l14 i32) (local $l15 i32) (local $l16 i32) (local $l17 i32) (local $l18 i32) (local $l19 i32) (local $l20 i32) (local $l21 i32) (local $l22 i32) (local $l23 i32) (local $l24 i32) (local $l25 i32) (local $l26 i32) (local $l27 i32) (local $l28 i32) (local $l29 i32) (local $l30 i32) (local $l31 i32) (local $l32 i32) (local $l33 i32)
    i32.const 1797285236
    local.set $l4
    i32.const 2036477234
    local.set $l5
    i32.const 857760878
    local.set $l6
    i32.const 1634760805
    local.set $l7
    i32.const 10
    local.set $l8
    local.get $p0
    i32.load align=1
    local.tee $l9
    local.set $l10
    local.get $p1
    local.set $l11
    local.get $p0
    i32.load offset=16 align=1
    local.tee $l12
    local.set $l13
    local.get $p0
    i32.load offset=4 align=1
    local.tee $l14
    local.set $l15
    local.get $p2
    i32.load align=1
    local.tee $l16
    local.set $l17
    local.get $p0
    i32.load offset=20 align=1
    local.tee $l18
    local.set $l19
    local.get $p0
    i32.load offset=8 align=1
    local.tee $l20
    local.set $l21
    local.get $p2
    i32.load offset=4 align=1
    local.tee $l22
    local.set $l23
    local.get $p0
    i32.load offset=24 align=1
    local.tee $l24
    local.set $l25
    local.get $p0
    i32.load offset=12 align=1
    local.tee $l26
    local.set $l27
    local.get $p2
    i32.load offset=8 align=1
    local.tee $l28
    local.set $p2
    local.get $p0
    i32.load offset=28 align=1
    local.tee $l29
    local.set $p0
    loop $L0
      local.get $p0
      local.get $p2
      local.get $l4
      local.get $l27
      i32.add
      local.tee $l4
      i32.xor
      i32.const 16
      i32.rotl
      local.tee $p2
      i32.add
      local.tee $p0
      local.get $l27
      i32.xor
      i32.const 12
      i32.rotl
      local.tee $l27
      local.get $l4
      i32.add
      local.tee $l30
      local.get $l13
      local.get $l11
      local.get $l7
      local.get $l10
      i32.add
      local.tee $l4
      i32.xor
      i32.const 16
      i32.rotl
      local.tee $l7
      i32.add
      local.tee $l11
      local.get $l10
      i32.xor
      i32.const 12
      i32.rotl
      local.tee $l10
      local.get $l4
      i32.add
      local.tee $l31
      local.get $l7
      i32.xor
      i32.const 8
      i32.rotl
      local.tee $l7
      local.get $l11
      i32.add
      local.tee $l11
      local.get $l10
      i32.xor
      i32.const 7
      i32.rotl
      local.tee $l10
      i32.add
      local.tee $l4
      local.get $l25
      local.get $l23
      local.get $l5
      local.get $l21
      i32.add
      local.tee $l5
      i32.xor
      i32.const 16
      i32.rotl
      local.tee $l13
      i32.add
      local.tee $l25
      local.get $l21
      i32.xor
      i32.const 12
      i32.rotl
      local.tee $l21
      local.get $l5
      i32.add
      local.tee $l5
      local.get $l13
      i32.xor
      i32.const 8
      i32.rotl
      local.tee $l32
      i32.xor
      i32.const 16
      i32.rotl
      local.tee $l13
      local.get $l19
      local.get $l17
      local.get $l6
      local.get $l15
      i32.add
      local.tee $l6
      i32.xor
      i32.const 16
      i32.rotl
      local.tee $l17
      i32.add
      local.tee $l19
      local.get $l15
      i32.xor
      i32.const 12
      i32.rotl
      local.tee $l15
      local.get $l6
      i32.add
      local.tee $l6
      local.get $l17
      i32.xor
      i32.const 8
      i32.rotl
      local.tee $l17
      local.get $l19
      i32.add
      local.tee $l33
      i32.add
      local.tee $l19
      local.get $l10
      i32.xor
      i32.const 12
      i32.rotl
      local.tee $l10
      local.get $l4
      i32.add
      local.tee $l4
      local.get $l13
      i32.xor
      i32.const 8
      i32.rotl
      local.tee $l23
      local.get $l19
      i32.add
      local.tee $l19
      local.get $l10
      i32.xor
      i32.const 7
      i32.rotl
      local.set $l10
      local.get $l30
      local.get $p2
      i32.xor
      i32.const 8
      i32.rotl
      local.tee $p2
      local.get $p0
      i32.add
      local.tee $p0
      local.get $l27
      i32.xor
      i32.const 7
      i32.rotl
      local.tee $l27
      local.get $l5
      i32.add
      local.tee $l5
      local.get $l17
      i32.xor
      i32.const 16
      i32.rotl
      local.tee $l13
      local.get $l11
      i32.add
      local.tee $l11
      local.get $l27
      i32.xor
      i32.const 12
      i32.rotl
      local.tee $l27
      local.get $l5
      i32.add
      local.tee $l5
      local.get $l13
      i32.xor
      i32.const 8
      i32.rotl
      local.tee $l17
      local.get $l11
      i32.add
      local.tee $l13
      local.get $l27
      i32.xor
      i32.const 7
      i32.rotl
      local.set $l27
      local.get $p0
      local.get $l32
      local.get $l25
      i32.add
      local.tee $l25
      local.get $l21
      i32.xor
      i32.const 7
      i32.rotl
      local.tee $l21
      local.get $l6
      i32.add
      local.tee $l6
      local.get $l7
      i32.xor
      i32.const 16
      i32.rotl
      local.tee $l7
      i32.add
      local.tee $p0
      local.get $l21
      i32.xor
      i32.const 12
      i32.rotl
      local.tee $l21
      local.get $l6
      i32.add
      local.tee $l6
      local.get $l7
      i32.xor
      i32.const 8
      i32.rotl
      local.tee $l11
      local.get $p0
      i32.add
      local.tee $p0
      local.get $l21
      i32.xor
      i32.const 7
      i32.rotl
      local.set $l21
      local.get $p2
      local.get $l33
      local.get $l15
      i32.xor
      i32.const 7
      i32.rotl
      local.tee $l15
      local.get $l31
      i32.add
      local.tee $l7
      i32.xor
      i32.const 16
      i32.rotl
      local.tee $p2
      local.get $l25
      i32.add
      local.tee $l25
      local.get $l15
      i32.xor
      i32.const 12
      i32.rotl
      local.tee $l15
      local.get $l7
      i32.add
      local.tee $l7
      local.get $p2
      i32.xor
      i32.const 8
      i32.rotl
      local.tee $p2
      local.get $l25
      i32.add
      local.tee $l25
      local.get $l15
      i32.xor
      i32.const 7
      i32.rotl
      local.set $l15
      local.get $l8
      i32.const -1
      i32.add
      local.tee $l8
      br_if $L0
    end
    local.get $p3
    local.get $l28
    local.get $p2
    i32.add
    i32.store offset=60 align=1
    local.get $p3
    local.get $l22
    local.get $l23
    i32.add
    i32.store offset=56 align=1
    local.get $p3
    local.get $l16
    local.get $l17
    i32.add
    i32.store offset=52 align=1
    local.get $p3
    local.get $p1
    local.get $l11
    i32.add
    i32.store offset=48 align=1
    local.get $p3
    local.get $l29
    local.get $p0
    i32.add
    i32.store offset=44 align=1
    local.get $p3
    local.get $l24
    local.get $l25
    i32.add
    i32.store offset=40 align=1
    local.get $p3
    local.get $l18
    local.get $l19
    i32.add
    i32.store offset=36 align=1
    local.get $p3
    local.get $l12
    local.get $l13
    i32.add
    i32.store offset=32 align=1
    local.get $p3
    local.get $l26
    local.get $l27
    i32.add
    i32.store offset=28 align=1
    local.get $p3
    local.get $l20
    local.get $l21
    i32.add
    i32.store offset=24 align=1
    local.get $p3
    local.get $l14
    local.get $l15
    i32.add
    i32.store offset=20 align=1
    local.get $p3
    local.get $l9
    local.get $l10
    i32.add
    i32.store offset=16 align=1
    local.get $p3
    local.get $l4
    i32.const 1797285236
    i32.add
    i32.store offset=12 align=1
    local.get $p3
    local.get $l5
    i32.const 2036477234
    i32.add
    i32.store offset=8 align=1
    local.get $p3
    local.get $l6
    i32.const 857760878
    i32.add
    i32.store offset=4 align=1
    local.get $p3
    local.get $l7
    i32.const 1634760805
    i32.add
    i32.store align=1)
  (func $aead_tag (type $t3) (param $p0 i32) (param $p1 i32) (param $p2 i32) (param $p3 i32) (param $p4 i32) (param $p5 i32) (param $p6 i32)
    (local $l7 i32) (local $l8 i32) (local $l9 i32) (local $l10 i32) (local $l11 i32) (local $l12 i32) (local $l13 i32) (local $l14 i32) (local $l15 i64)
    global.get $__stack_pointer
    i32.const 160
    i32.sub
    local.tee $l7
    global.set $__stack_pointer
    local.get $p0
    i32.const 0
    local.get $p1
    local.get $l7
    i32.const 80
    i32.add
    call $chacha_block
    local.get $l7
    i32.const 0
    i32.store offset=60
    local.get $l7
    i64.const 0
    i64.store offset=52 align=4
    local.get $l7
    i64.const 0
    i64.store offset=44 align=4
    local.get $l7
    local.get $l7
    i32.load offset=96
    i32.store offset=64
    local.get $l7
    local.get $l7
    i32.load offset=80
    local.tee $p1
    i32.const 67108863
    i32.and
    i32.store offset=8
    local.get $l7
    local.get $l7
    i32.load offset=92
    local.tee $p0
    i32.const 8
    i32.shr_u
    i32.const 1048575
    i32.and
    local.tee $l8
    i32.store offset=24
    local.get $l7
    local.get $l8
    i32.const 5
    i32.mul
    i32.store offset=40
    local.get $l7
    local.get $p0
    i32.const 18
    i32.shl
    local.get $l7
    i32.load offset=88
    local.tee $p0
    i32.const 14
    i32.shr_u
    i32.or
    i32.const 66076671
    i32.and
    local.tee $l8
    i32.store offset=20
    local.get $l7
    local.get $l8
    i32.const 5
    i32.mul
    i32.store offset=36
    local.get $l7
    local.get $p0
    i32.const 12
    i32.shl
    local.get $l7
    i32.load offset=84
    local.tee $p0
    i32.const 20
    i32.shr_u
    i32.or
    i32.const 67092735
    i32.and
    local.tee $l8
    i32.store offset=16
    local.get $l7
    local.get $l8
    i32.const 5
    i32.mul
    i32.store offset=32
    local.get $l7
    local.get $p0
    i32.const 6
    i32.shl
    local.get $p1
    i32.const 26
    i32.shr_u
    i32.or
    i32.const 67108611
    i32.and
    local.tee $p1
    i32.store offset=12
    local.get $l7
    local.get $p1
    i32.const 5
    i32.mul
    i32.store offset=28
    local.get $l7
    local.get $l7
    i32.load offset=100
    i32.store offset=68
    local.get $l7
    local.get $l7
    i64.load offset=104
    i64.store offset=72 align=4
    block $B0
      block $B1
        local.get $p3
        i32.const 16
        i32.ge_u
        br_if $B1
        local.get $p3
        local.set $l9
        br $B0
      end
      local.get $p3
      local.set $l9
      loop $L2
        local.get $l7
        i32.const 8
        i32.add
        local.get $p2
        i32.const 16777216
        call $poly_block
        local.get $p2
        i32.const 16
        i32.add
        local.set $p2
        local.get $l9
        i32.const -16
        i32.add
        local.tee $l9
        i32.const 15
        i32.gt_u
        br_if $L2
      end
    end
    block $B3
      local.get $l9
      i32.eqz
      br_if $B3
      local.get $l9
      i32.const 3
      i32.and
      local.set $l10
      i32.const 0
      local.set $p1
      block $B4
        block $B5
          local.get $l9
          i32.const 4
          i32.lt_u
          br_if $B5
          local.get $l9
          i32.const 12
          i32.and
          local.set $l11
          i32.const 0
          local.set $p1
          loop $L6
            local.get $l7
            i32.const 144
            i32.add
            local.get $p1
            i32.add
            local.tee $p0
            local.get $p2
            local.get $p1
            i32.add
            local.tee $l8
            i32.load8_u
            i32.store8
            local.get $p0
            i32.const 1
            i32.add
            local.get $l8
            i32.const 1
            i32.add
            i32.load8_u
            i32.store8
            local.get $p0
            i32.const 2
            i32.add
            local.get $l8
            i32.const 2
            i32.add
            i32.load8_u
            i32.store8
            local.get $p0
            i32.const 3
            i32.add
            local.get $l8
            i32.const 3
            i32.add
            i32.load8_u
            i32.store8
            local.get $l11
            local.get $p1
            i32.const 4
            i32.add
            local.tee $p1
            i32.ne
            br_if $L6
          end
          local.get $l10
          i32.eqz
          br_if $B4
        end
        local.get $p2
        local.get $p1
        i32.add
        local.set $p2
        local.get $l7
        i32.const 144
        i32.add
        local.get $p1
        i32.add
        local.set $p1
        loop $L7
          local.get $p1
          local.get $p2
          i32.load8_u
          i32.store8
          local.get $p2
          i32.const 1
          i32.add
          local.set $p2
          local.get $p1
          i32.const 1
          i32.add
          local.set $p1
          local.get $l10
          i32.const -1
          i32.add
          local.tee $l10
          br_if $L7
        end
      end
      local.get $l9
      local.set $p2
      block $B8
        i32.const 0
        local.get $l9
        i32.sub
        i32.const 7
        i32.and
        local.tee $p1
        i32.eqz
        br_if $B8
        local.get $l9
        local.set $p2
        loop $L9
          local.get $l7
          i32.const 144
          i32.add
          local.get $p2
          i32.add
          i32.const 0
          i32.store8
          local.get $p2
          i32.const 1
          i32.add
          local.set $p2
          local.get $p1
          i32.const -1
          i32.add
          local.tee $p1
          br_if $L9
        end
      end
      block $B10
        local.get $l9
        i32.const 8
        i32.gt_u
        br_if $B10
        local.get $l7
        i32.const 144
        i32.add
        local.set $p1
        i32.const 16
        local.set $p0
        loop $L11
          local.get $p1
          local.get $p2
          i32.add
          i64.const 0
          i64.store align=1
          local.get $p1
          i32.const 8
          i32.add
          local.set $p1
          local.get $p2
          local.get $p0
          i32.const -8
          i32.add
          local.tee $p0
          i32.ne
          br_if $L11
        end
      end
      local.get $l7
      i32.const 8
      i32.add
      local.get $l7
      i32.const 144
      i32.add
      i32.const 16777216
      call $poly_block
    end
    block $B12
      block $B13
        local.get $p5
        i32.const 16
        i32.ge_u
        br_if $B13
        local.get $p5
        local.set $l8
        br $B12
      end
      local.get $p5
      local.set $l8
      loop $L14
        local.get $l7
        i32.const 8
        i32.add
        local.get $p4
        i32.const 16777216
        call $poly_block
        local.get $p4
        i32.const 16
        i32.add
        local.set $p4
        local.get $l8
        i32.const -16
        i32.add
        local.tee $l8
        i32.const 15
        i32.gt_u
        br_if $L14
      end
    end
    block $B15
      local.get $l8
      i32.eqz
      br_if $B15
      local.get $l8
      i32.const 3
      i32.and
      local.set $l9
      i32.const 0
      local.set $p2
      block $B16
        block $B17
          local.get $l8
          i32.const 4
          i32.lt_u
          br_if $B17
          local.get $l8
          i32.const 12
          i32.and
          local.set $l10
          i32.const 0
          local.set $p2
          loop $L18
            local.get $l7
            i32.const 144
            i32.add
            local.get $p2
            i32.add
            local.tee $p1
            local.get $p4
            local.get $p2
            i32.add
            local.tee $p0
            i32.load8_u
            i32.store8
            local.get $p1
            i32.const 1
            i32.add
            local.get $p0
            i32.const 1
            i32.add
            i32.load8_u
            i32.store8
            local.get $p1
            i32.const 2
            i32.add
            local.get $p0
            i32.const 2
            i32.add
            i32.load8_u
            i32.store8
            local.get $p1
            i32.const 3
            i32.add
            local.get $p0
            i32.const 3
            i32.add
            i32.load8_u
            i32.store8
            local.get $l10
            local.get $p2
            i32.const 4
            i32.add
            local.tee $p2
            i32.ne
            br_if $L18
          end
          local.get $l9
          i32.eqz
          br_if $B16
        end
        local.get $p4
        local.get $p2
        i32.add
        local.set $p4
        local.get $l7
        i32.const 144
        i32.add
        local.get $p2
        i32.add
        local.set $p2
        loop $L19
          local.get $p2
          local.get $p4
          i32.load8_u
          i32.store8
          local.get $p4
          i32.const 1
          i32.add
          local.set $p4
          local.get $p2
          i32.const 1
          i32.add
          local.set $p2
          local.get $l9
          i32.const -1
          i32.add
          local.tee $l9
          br_if $L19
        end
      end
      local.get $l8
      local.set $p4
      block $B20
        i32.const 0
        local.get $l8
        i32.sub
        i32.const 7
        i32.and
        local.tee $p2
        i32.eqz
        br_if $B20
        local.get $l8
        local.set $p4
        loop $L21
          local.get $l7
          i32.const 144
          i32.add
          local.get $p4
          i32.add
          i32.const 0
          i32.store8
          local.get $p4
          i32.const 1
          i32.add
          local.set $p4
          local.get $p2
          i32.const -1
          i32.add
          local.tee $p2
          br_if $L21
        end
      end
      block $B22
        local.get $l8
        i32.const 8
        i32.gt_u
        br_if $B22
        local.get $l7
        i32.const 144
        i32.add
        local.set $p2
        i32.const 16
        local.set $p1
        loop $L23
          local.get $p2
          local.get $p4
          i32.add
          i64.const 0
          i64.store align=1
          local.get $p2
          i32.const 8
          i32.add
          local.set $p2
          local.get $p4
          local.get $p1
          i32.const -8
          i32.add
          local.tee $p1
          i32.ne
          br_if $L23
        end
      end
      local.get $l7
      i32.const 8
      i32.add
      local.get $l7
      i32.const 144
      i32.add
      i32.const 16777216
      call $poly_block
    end
    local.get $l7
    i32.const 0
    i32.store offset=156
    local.get $l7
    local.get $p5
    i32.store offset=152
    local.get $l7
    i32.const 0
    i32.store offset=148
    local.get $l7
    local.get $p3
    i32.store offset=144
    local.get $l7
    i32.const 8
    i32.add
    local.get $l7
    i32.const 144
    i32.add
    i32.const 16777216
    call $poly_block
    local.get $p6
    local.get $l7
    i32.load offset=52
    local.get $l7
    i32.load offset=48
    local.tee $p4
    i32.const 26
    i32.shr_u
    i32.add
    local.tee $p2
    i32.const 26
    i32.shr_u
    local.get $l7
    i32.load offset=56
    i32.add
    local.tee $p0
    i32.const 26
    i32.shr_u
    local.get $l7
    i32.load offset=60
    i32.add
    local.tee $p1
    i32.const 26
    i32.shr_u
    i32.const 5
    i32.mul
    local.get $l7
    i32.load offset=44
    i32.add
    local.tee $l8
    i32.const 67108863
    i32.and
    local.tee $l9
    i32.const 5
    i32.add
    local.tee $l10
    i32.const 26
    i32.shr_u
    local.get $l8
    i32.const 26
    i32.shr_u
    local.get $p4
    i32.const 67108863
    i32.and
    i32.add
    local.tee $l8
    i32.add
    local.tee $p4
    i32.const 26
    i32.shr_u
    local.get $p2
    i32.const 67108863
    i32.and
    local.tee $l11
    i32.add
    local.tee $p3
    i32.const 26
    i32.shr_u
    local.get $p0
    i32.const 67108863
    i32.and
    local.tee $p0
    i32.add
    local.tee $p5
    i32.const 26
    i32.shr_u
    local.get $p1
    i32.const 67108863
    i32.and
    i32.add
    local.tee $l12
    i32.const -67108864
    i32.add
    local.tee $l13
    i32.const 31
    i32.shr_u
    i32.const -1
    i32.add
    local.tee $l14
    i32.const 67108863
    i32.and
    local.tee $p2
    local.get $p4
    i32.and
    local.get $l13
    i32.const 31
    i32.shr_s
    local.tee $p4
    local.get $l8
    i32.and
    i32.or
    local.tee $l8
    i32.const 26
    i32.shl
    local.get $p4
    local.get $l9
    i32.and
    local.get $p2
    local.get $l10
    i32.and
    i32.or
    i32.or
    local.tee $l9
    local.get $l7
    i32.load offset=64
    i32.add
    local.tee $l10
    i32.store align=1
    local.get $p6
    local.get $l8
    i32.const 6
    i32.shr_u
    local.get $p2
    local.get $p3
    i32.and
    local.get $p4
    local.get $l11
    i32.and
    i32.or
    local.tee $l8
    i32.const 20
    i32.shl
    i32.or
    i64.extend_i32_u
    local.get $l7
    i64.load32_u offset=68
    i64.add
    local.get $l10
    local.get $l9
    i32.lt_u
    i64.extend_i32_u
    i64.add
    local.tee $l15
    i64.store32 offset=4 align=1
    local.get $p6
    local.get $l8
    i32.const 12
    i32.shr_u
    local.get $p2
    local.get $p5
    i32.and
    local.get $p4
    local.get $p0
    i32.and
    i32.or
    local.tee $p2
    i32.const 14
    i32.shl
    i32.or
    i64.extend_i32_u
    local.get $l7
    i64.load32_u offset=72
    i64.add
    local.get $l15
    i64.const 32
    i64.shr_u
    i64.add
    local.tee $l15
    i64.store32 offset=8 align=1
    local.get $p6
    local.get $p2
    i32.const 18
    i32.shr_u
    local.get $l14
    local.get $l12
    i32.and
    local.get $p4
    local.get $p1
    i32.and
    i32.or
    i32.const 8
    i32.shl
    i32.or
    i64.extend_i32_u
    local.get $l7
    i64.load32_u offset=76
    i64.add
    local.get $l15
    i64.const 32
    i64.shr_u
    i64.add
    i64.store32 offset=12 align=1
    local.get $l7
    i32.const 160
    i32.add
    global.set $__stack_pointer)
  (func $poly_block (type $t4) (param $p0 i32) (param $p1 i32) (param $p2 i32)
    (local $l3 i64) (local $l4 i64) (local $l5 i64) (local $l6 i32) (local $l7 i32) (local $l8 i64) (local $l9 i64) (local $l10 i64) (local $l11 i64) (local $l12 i64) (local $l13 i64) (local $l14 i64) (local $l15 i64) (local $l16 i64) (local $l17 i64) (local $l18 i64)
    local.get $p0
    i64.load32_u offset=16
    local.set $l3
    local.get $p0
    i64.load32_u offset=12
    local.set $l4
    local.get $p0
    local.get $p0
    i64.load32_u offset=32
    local.tee $l5
    local.get $p0
    i32.load offset=48
    local.get $p1
    i32.load offset=12 align=1
    local.tee $l6
    i32.const 18
    i32.shl
    local.get $p1
    i32.load offset=8 align=1
    local.tee $l7
    i32.const 14
    i32.shr_u
    i32.or
    i32.const 67108863
    i32.and
    i32.add
    i64.extend_i32_u
    local.tee $l8
    i64.mul
    local.get $p0
    i64.load32_u
    local.tee $l9
    local.get $p0
    i32.load offset=44
    local.get $l7
    i32.const 12
    i32.shl
    local.get $p1
    i32.load offset=4 align=1
    local.tee $l7
    i32.const 20
    i32.shr_u
    i32.or
    i32.const 67108863
    i32.and
    i32.add
    i64.extend_i32_u
    local.tee $l10
    i64.mul
    i64.add
    local.get $p0
    i64.load32_u offset=28
    local.tee $l11
    local.get $l6
    i32.const 8
    i32.shr_u
    local.get $p2
    i32.add
    local.get $p0
    i32.load offset=52
    i32.add
    i64.extend_i32_u
    local.tee $l12
    i64.mul
    i64.add
    local.get $p0
    i64.load32_u offset=4
    local.tee $l13
    local.get $p0
    i32.load offset=40
    local.get $l7
    i32.const 6
    i32.shl
    local.get $p1
    i32.load align=1
    local.tee $p1
    i32.const 26
    i32.shr_u
    i32.or
    i32.const 67108863
    i32.and
    i32.add
    i64.extend_i32_u
    local.tee $l14
    i64.mul
    i64.add
    local.get $p0
    i64.load32_u offset=8
    local.tee $l15
    local.get $p0
    i32.load offset=36
    local.get $p1
    i32.const 67108863
    i32.and
    i32.add
    i64.extend_i32_u
    local.tee $l16
    i64.mul
    i64.add
    local.get $l5
    local.get $l10
    i64.mul
    local.get $l9
    local.get $l14
    i64.mul
    i64.add
    local.get $l11
    local.get $l8
    i64.mul
    i64.add
    local.get $p0
    i64.load32_u offset=24
    local.tee $l17
    local.get $l12
    i64.mul
    i64.add
    local.get $l13
    local.get $l16
    i64.mul
    i64.add
    local.get $l5
    local.get $l14
    i64.mul
    local.get $l9
    local.get $l16
    i64.mul
    i64.add
    local.get $l11
    local.get $l10
    i64.mul
    i64.add
    local.get $l17
    local.get $l8
    i64.mul
    i64.add
    local.get $p0
    i64.load32_u offset=20
    local.get $l12
    i64.mul
    i64.add
    local.tee $l11
    i64.const 26
    i64.shr_u
    i64.const 4294967295
    i64.and
    i64.add
    local.tee $l17
    i64.const 26
    i64.shr_u
    i64.const 4294967295
    i64.and
    i64.add
    local.tee $l18
    i32.wrap_i64
    i32.const 67108863
    i32.and
    i32.store offset=44
    local.get $p0
    local.get $l12
    local.get $l5
    i64.mul
    local.get $l9
    local.get $l8
    i64.mul
    i64.add
    local.get $l13
    local.get $l10
    i64.mul
    i64.add
    local.get $l15
    local.get $l14
    i64.mul
    i64.add
    local.get $l4
    local.get $l16
    i64.mul
    i64.add
    local.get $l18
    i64.const 26
    i64.shr_u
    i64.const 4294967295
    i64.and
    i64.add
    local.tee $l5
    i32.wrap_i64
    i32.const 67108863
    i32.and
    i32.store offset=48
    local.get $p0
    local.get $l13
    local.get $l8
    i64.mul
    local.get $l12
    local.get $l9
    i64.mul
    i64.add
    local.get $l15
    local.get $l10
    i64.mul
    i64.add
    local.get $l4
    local.get $l14
    i64.mul
    i64.add
    local.get $l3
    local.get $l16
    i64.mul
    i64.add
    local.get $l5
    i64.const 26
    i64.shr_u
    i64.const 4294967295
    i64.and
    i64.add
    local.tee $l8
    i32.wrap_i64
    i32.const 67108863
    i32.and
    i32.store offset=52
    local.get $p0
    local.get $l8
    i64.const 26
    i64.shr_u
    i32.wrap_i64
    i32.const 5
    i32.mul
    local.get $l11
    i32.wrap_i64
    i32.const 67108863
    i32.and
    i32.add
    local.tee $p1
    i32.const 67108863
    i32.and
    i32.store offset=36
    local.get $p0
    local.get $p1
    i32.const 26
    i32.shr_u
    local.get $l17
    i32.wrap_i64
    i32.const 67108863
    i32.and
    i32.add
    i32.store offset=40)
  (func $open (type $t1) (param $p0 i32) (param $p1 i32) (param $p2 i32) (param $p3 i32) (param $p4 i32) (param $p5 i32) (param $p6 i32) (param $p7 i32) (result i32)
    (local $l8 i32) (local $l9 i32) (local $l10 i32) (local $l11 i32) (local $l12 i32) (local $l13 i32) (local $l14 i32) (local $l15 i32) (local $l16 i32)
    global.get $__stack_pointer
    i32.const 80
    i32.sub
    local.tee $l8
    global.set $__stack_pointer
    local.get $p0
    local.get $p1
    local.get $p2
    local.get $p3
    local.get $p4
    local.get $p5
    local.get $l8
    call $aead_tag
    i32.const -1
    local.set $p3
    block $B0
      local.get $p6
      i32.load8_u
      local.get $l8
      i32.load8_u
      i32.ne
      br_if $B0
      local.get $p6
      i32.load8_u offset=1
      i32.const 255
      i32.and
      local.get $l8
      i32.load8_u offset=1
      i32.const 255
      i32.and
      i32.ne
      br_if $B0
      local.get $p6
      i32.load8_u offset=2
      i32.const 255
      i32.and
      local.get $l8
      i32.load8_u offset=2
      i32.const 255
      i32.and
      i32.ne
      br_if $B0
      local.get $p6
      i32.load8_u offset=3
      i32.const 255
      i32.and
      local.get $l8
      i32.load8_u offset=3
      i32.const 255
      i32.and
      i32.ne
      br_if $B0
      local.get $p6
      i32.load8_u offset=4
      i32.const 255
      i32.and
      local.get $l8
      i32.load8_u offset=4
      i32.const 255
      i32.and
      i32.ne
      br_if $B0
      local.get $p6
      i32.load8_u offset=5
      i32.const 255
      i32.and
      local.get $l8
      i32.load8_u offset=5
      i32.const 255
      i32.and
      i32.ne
      br_if $B0
      local.get $p6
      i32.load8_u offset=6
      i32.const 255
      i32.and
      local.get $l8
      i32.load8_u offset=6
      i32.const 255
      i32.and
      i32.ne
      br_if $B0
      local.get $p6
      i32.load8_u offset=7
      i32.const 255
      i32.and
      local.get $l8
      i32.load8_u offset=7
      i32.const 255
      i32.and
      i32.ne
      br_if $B0
      local.get $p6
      i32.load8_u offset=8
      i32.const 255
      i32.and
      local.get $l8
      i32.load8_u offset=8
      i32.const 255
      i32.and
      i32.ne
      br_if $B0
      local.get $p6
      i32.load8_u offset=9
      i32.const 255
      i32.and
      local.get $l8
      i32.load8_u offset=9
      i32.const 255
      i32.and
      i32.ne
      br_if $B0
      local.get $p6
      i32.load8_u offset=10
      i32.const 255
      i32.and
      local.get $l8
      i32.load8_u offset=10
      i32.const 255
      i32.and
      i32.ne
      br_if $B0
      local.get $p6
      i32.load8_u offset=11
      i32.const 255
      i32.and
      local.get $l8
      i32.load8_u offset=11
      i32.const 255
      i32.and
      i32.ne
      br_if $B0
      local.get $p6
      i32.load8_u offset=12
      i32.const 255
      i32.and
      local.get $l8
      i32.load8_u offset=12
      i32.const 255
      i32.and
      i32.ne
      br_if $B0
      local.get $p6
      i32.load8_u offset=13
      i32.const 255
      i32.and
      local.get $l8
      i32.load8_u offset=13
      i32.const 255
      i32.and
      i32.ne
      br_if $B0
      local.get $p6
      i32.load8_u offset=14
      i32.const 255
      i32.and
      local.get $l8
      i32.load8_u offset=14
      i32.const 255
      i32.and
      i32.ne
      br_if $B0
      local.get $p6
      i32.load8_u offset=15
      i32.const 255
      i32.and
      local.get $l8
      i32.load8_u offset=15
      i32.const 255
      i32.and
      i32.ne
      br_if $B0
      block $B1
        local.get $p5
        i32.eqz
        br_if $B1
        i32.const 0
        local.set $l9
        local.get $p4
        local.set $l10
        local.get $p7
        local.set $l11
        local.get $p5
        local.set $l12
        i32.const 1
        local.set $l13
        loop $L2
          local.get $p0
          local.get $l13
          local.get $p1
          local.get $l8
          i32.const 16
          i32.add
          call $chacha_block
          i32.const 0
          local.set $p6
          block $B3
            block $B4
              local.get $l12
              i32.const 2
              i32.lt_u
              br_if $B4
              local.get $l12
              i32.const 1
              local.get $l12
              i32.const 1
              i32.gt_u
              select
              local.tee $p6
              i32.const 64
              local.get $p6
              i32.const 64
              i32.lt_u
              select
              local.tee $p6
              i32.const 1
              i32.and
              local.set $l14
              local.get $p6
              i32.const 126
              i32.and
              local.set $l15
              i32.const 0
              local.set $p6
              loop $L5
                local.get $l11
                local.get $p6
                i32.add
                local.tee $p3
                local.get $l8
                i32.const 16
                i32.add
                local.get $p6
                i32.add
                local.tee $p2
                i32.load8_u
                local.get $l10
                local.get $p6
                i32.add
                local.tee $l16
                i32.load8_u
                i32.xor
                i32.store8
                local.get $p3
                i32.const 1
                i32.add
                local.get $p2
                i32.const 1
                i32.add
                i32.load8_u
                local.get $l16
                i32.const 1
                i32.add
                i32.load8_u
                i32.xor
                i32.store8
                local.get $l15
                local.get $p6
                i32.const 2
                i32.add
                local.tee $p6
                i32.ne
                br_if $L5
              end
              local.get $l14
              i32.eqz
              br_if $B3
            end
            local.get $p7
            local.get $p6
            local.get $l9
            i32.add
            local.tee $p3
            i32.add
            local.get $l8
            i32.const 16
            i32.add
            local.get $p6
            i32.add
            i32.load8_u
            local.get $p4
            local.get $p3
            i32.add
            i32.load8_u
            i32.xor
            i32.store8
          end
          local.get $l10
          i32.const 64
          i32.add
          local.set $l10
          local.get $l11
          i32.const 64
          i32.add
          local.set $l11
          local.get $l12
          i32.const -64
          i32.add
          local.set $l12
          local.get $l13
          i32.const 1
          i32.add
          local.set $l13
          local.get $l9
          i32.const 64
          i32.add
          local.tee $l9
          local.get $p5
          i32.lt_u
          br_if $L2
        end
      end
      local.get $p5
      local.set $p3
    end
    local.get $l8
    i32.const 80
    i32.add
    global.set $__stack_pointer
    local.get $p3)
  (table $__indirect_function_table 1 1 funcref)
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
  (export "seal" (func $seal))
  (export "open" (func $open))
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
