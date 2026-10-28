;; audio.webaudio-effects.v1 — kernel: audio_dsp
;; WebAssembly Text (WAT) baseline implementation
;; Exports: audio_dsp

(module $audio_dsp_kernel_c.wasm
  (type $t0 (func))
  (type $t1 (func (result i32)))
  (type $t2 (func (param f32 i32 i32 i32)))
  (func $__wasm_call_ctors (type $t0))
  (func $audio_dsp (type $t1) (result i32)
    (local $l0 i32) (local $l1 i32) (local $l2 i32) (local $l3 i32) (local $l4 i32) (local $l5 i32) (local $l6 f32) (local $l7 i32) (local $l8 f32) (local $l9 f32) (local $l10 f32) (local $l11 f32) (local $l12 i32) (local $l13 i32) (local $l14 i32) (local $l15 i32) (local $l16 i32) (local $l17 i32) (local $l18 i32) (local $l19 i32) (local $l20 i32) (local $l21 i32) (local $l22 i32) (local $l23 i32) (local $l24 i32)
    global.get $__stack_pointer
    i32.const 160
    i32.sub
    local.tee $l0
    global.set $__stack_pointer
    i32.const 0
    i32.const 1065353216
    i32.store offset=65536
    i32.const 0
    i32.const -1086324736
    i32.store offset=257536
    i32.const 0
    i32.const 0
    i32.store offset=3145728
    i32.const 0
    i32.const 0
    i32.store offset=3145732
    i32.const 0
    i32.const 0
    i32.store offset=3145736
    i32.const 0
    i32.const 0
    i32.store offset=3145740
    i32.const 4
    local.set $l1
    i32.const 1
    local.set $l2
    loop $L0
      block $B1
        block $B2
          local.get $l2
          i32.const 11999
          i32.gt_u
          br_if $B2
          local.get $l1
          i32.const 257536
          i32.add
          i32.const -1114007142
          i32.store
          local.get $l1
          i32.const 65536
          i32.add
          i32.const 1036831949
          i32.store
          br $B1
        end
        block $B3
          local.get $l2
          i32.const 23999
          i32.gt_u
          br_if $B3
          local.get $l1
          i32.const 257536
          i32.add
          i32.const -1103101952
          i32.store
          local.get $l1
          i32.const 65536
          i32.add
          i32.const 1048576000
          i32.store
          br $B1
        end
        block $B4
          local.get $l2
          i32.const 35999
          i32.gt_u
          br_if $B4
          local.get $l1
          i32.const 257536
          i32.add
          i32.const -1100585370
          i32.store
          local.get $l1
          i32.const 65536
          i32.add
          i32.const 1050253722
          i32.store
          br $B1
        end
        local.get $l1
        i32.const 257536
        i32.add
        i32.const 1041865114
        i32.store
        local.get $l1
        i32.const 65536
        i32.add
        i32.const -1102263091
        i32.store
      end
      local.get $l1
      i32.const 4
      i32.add
      local.set $l1
      local.get $l2
      i32.const 1
      i32.add
      local.tee $l2
      i32.const 48000
      i32.ne
      br_if $L0
    end
    local.get $l0
    i32.const 80
    i32.add
    i32.const 0
    i32.const 80
    memory.fill
    local.get $l0
    i32.const 92
    i32.add
    local.set $l1
    i32.const 0
    local.set $l3
    i32.const 0
    local.set $l4
    i32.const 0
    local.set $l2
    loop $L5
      block $B6
        local.get $l4
        i32.eqz
        br_if $B6
        i32.const 0
        i32.const 0
        i32.load offset=3145732
        i32.const 1
        i32.add
        i32.store offset=3145732
      end
      i32.const 0
      local.set $l5
      loop $L7
        local.get $l0
        f32.load offset=84
        local.set $l6
        local.get $l0
        local.get $l3
        local.get $l5
        i32.add
        local.tee $l7
        i32.const 65536
        i32.add
        f32.load
        local.tee $l8
        f32.const 0x1.a70f44p-3 (;=0.206572;)
        f32.mul
        local.tee $l9
        local.get $l9
        local.get $l0
        f32.load offset=80
        f32.add
        local.tee $l9
        f32.const -0x1.9107d4p-3 (;=-0.195816;)
        f32.mul
        f32.add
        f32.store offset=84
        local.get $l0
        local.get $l6
        local.get $l8
        f32.const 0x1.a70f44p-2 (;=0.413144;)
        f32.mul
        local.get $l9
        f32.const 0x1.7a6562p-2 (;=0.369527;)
        f32.mul
        f32.add
        f32.add
        f32.store offset=80
        f32.const 0x1p+0 (;=1;)
        local.set $l8
        local.get $l0
        f32.const 0x1.ccccccp-1 (;=0.9;)
        f32.const 0x1.ffbe76p-1 (;=0.9995;)
        local.get $l9
        f32.abs
        local.tee $l6
        local.get $l0
        f32.load offset=88
        local.tee $l10
        f32.gt
        select
        local.tee $l11
        local.get $l10
        f32.mul
        local.get $l6
        f32.const 0x1p+0 (;=1;)
        local.get $l11
        f32.sub
        f32.mul
        f32.add
        local.tee $l6
        f32.store offset=88
        block $B8
          local.get $l6
          f32.const 0x1.99999ap-3 (;=0.2;)
          f32.le
          br_if $B8
          local.get $l6
          f32.const -0x1p-2 (;=-0.25;)
          f32.add
          f32.const 0x1p-2 (;=0.25;)
          f32.mul
          f32.const 0x1p-2 (;=0.25;)
          f32.add
          local.set $l8
          block $B9
            local.get $l6
            f32.const 0x1.333334p-2 (;=0.3;)
            f32.ge
            br_if $B9
            local.get $l6
            f32.const -0x1.99999ap-3 (;=-0.2;)
            f32.add
            f32.const 0x1.99999ap-4 (;=0.1;)
            f32.div
            local.tee $l10
            local.get $l10
            f32.mul
            local.get $l8
            local.get $l6
            f32.sub
            f32.mul
            local.get $l6
            f32.add
            local.set $l8
          end
          local.get $l8
          local.get $l6
          f32.div
          local.set $l8
        end
        local.get $l1
        local.get $l2
        i32.const 2
        i32.shl
        i32.add
        local.get $l9
        local.get $l8
        f32.mul
        local.tee $l6
        f32.store
        local.get $l7
        i32.const 449536
        i32.add
        local.get $l1
        local.get $l2
        i32.const -1
        i32.add
        i32.const 15
        local.get $l2
        select
        local.tee $l7
        i32.const -1
        i32.add
        i32.const 15
        local.get $l7
        select
        local.tee $l12
        i32.const -1
        i32.add
        i32.const 15
        local.get $l12
        select
        local.tee $l13
        i32.const -1
        i32.add
        i32.const 15
        local.get $l13
        select
        local.tee $l14
        i32.const -1
        i32.add
        i32.const 15
        local.get $l14
        select
        local.tee $l15
        i32.const -1
        i32.add
        i32.const 15
        local.get $l15
        select
        local.tee $l16
        i32.const -1
        i32.add
        i32.const 15
        local.get $l16
        select
        local.tee $l17
        i32.const -1
        i32.add
        i32.const 15
        local.get $l17
        select
        local.tee $l18
        i32.const -1
        i32.add
        i32.const 15
        local.get $l18
        select
        local.tee $l19
        i32.const -1
        i32.add
        i32.const 15
        local.get $l19
        select
        local.tee $l20
        i32.const -1
        i32.add
        i32.const 15
        local.get $l20
        select
        local.tee $l21
        i32.const -1
        i32.add
        i32.const 15
        local.get $l21
        select
        local.tee $l22
        i32.const -1
        i32.add
        i32.const 15
        local.get $l22
        select
        local.tee $l23
        i32.const -1
        i32.add
        i32.const 15
        local.get $l23
        select
        local.tee $l24
        i32.const -1
        i32.add
        i32.const 15
        local.get $l24
        select
        i32.const 2
        i32.shl
        i32.add
        f32.load
        f32.const 0x1.b5e4d6p-9 (;=0.00334087;)
        f32.mul
        local.get $l1
        local.get $l24
        i32.const 2
        i32.shl
        i32.add
        f32.load
        f32.const -0x1.23ede4p-8 (;=-0.00445449;)
        f32.mul
        local.get $l1
        local.get $l23
        i32.const 2
        i32.shl
        i32.add
        f32.load
        f32.const 0x1.853d3p-8 (;=0.00593932;)
        f32.mul
        local.get $l1
        local.get $l22
        i32.const 2
        i32.shl
        i32.add
        f32.load
        f32.const -0x1.037e2p-7 (;=-0.00791909;)
        f32.mul
        local.get $l1
        local.get $l21
        i32.const 2
        i32.shl
        i32.add
        f32.load
        f32.const 0x1.59fd8p-7 (;=0.0105588;)
        f32.mul
        local.get $l1
        local.get $l20
        i32.const 2
        i32.shl
        i32.add
        f32.load
        f32.const -0x1.cd52p-7 (;=-0.0140784;)
        f32.mul
        local.get $l1
        local.get $l19
        i32.const 2
        i32.shl
        i32.add
        f32.load
        f32.const 0x1.338cp-6 (;=0.0187712;)
        f32.mul
        local.get $l1
        local.get $l18
        i32.const 2
        i32.shl
        i32.add
        f32.load
        f32.const -0x1.9a1p-6 (;=-0.0250282;)
        f32.mul
        local.get $l1
        local.get $l17
        i32.const 2
        i32.shl
        i32.add
        f32.load
        f32.const 0x1.116p-5 (;=0.033371;)
        f32.mul
        local.get $l1
        local.get $l16
        i32.const 2
        i32.shl
        i32.add
        f32.load
        f32.const -0x1.6c8p-5 (;=-0.0444946;)
        f32.mul
        local.get $l1
        local.get $l15
        i32.const 2
        i32.shl
        i32.add
        f32.load
        f32.const 0x1.e6p-5 (;=0.0593262;)
        f32.mul
        local.get $l1
        local.get $l14
        i32.const 2
        i32.shl
        i32.add
        f32.load
        f32.const -0x1.44p-4 (;=-0.0791016;)
        f32.mul
        local.get $l1
        local.get $l13
        i32.const 2
        i32.shl
        i32.add
        f32.load
        f32.const 0x1.bp-4 (;=0.105469;)
        f32.mul
        local.get $l1
        local.get $l12
        i32.const 2
        i32.shl
        i32.add
        f32.load
        f32.const 0x1.2p-3 (;=0.140625;)
        f32.mul
        local.get $l1
        local.get $l7
        i32.const 2
        i32.shl
        i32.add
        f32.load
        f32.const -0x1.8p-3 (;=-0.1875;)
        f32.mul
        local.get $l6
        f32.const 0x1.4p-1 (;=0.625;)
        f32.mul
        f32.const 0x0p+0 (;=0;)
        f32.add
        f32.add
        f32.add
        f32.add
        f32.add
        f32.add
        f32.add
        f32.add
        f32.add
        f32.add
        f32.add
        f32.add
        f32.add
        f32.add
        f32.add
        f32.add
        f32.store
        i32.const 0
        local.get $l2
        i32.const 1
        i32.add
        local.tee $l2
        local.get $l2
        i32.const 16
        i32.eq
        select
        local.set $l2
        local.get $l5
        i32.const 4
        i32.add
        local.tee $l5
        i32.const 512
        i32.ne
        br_if $L7
      end
      i32.const 0
      i32.const 0
      i32.load offset=3145728
      i32.const 1
      i32.add
      i32.store offset=3145728
      local.get $l3
      i32.const 512
      i32.add
      local.set $l3
      local.get $l4
      i32.const 1
      i32.add
      local.tee $l4
      i32.const 375
      i32.ne
      br_if $L5
    end
    local.get $l0
    local.get $l2
    i32.store offset=156
    f32.const 0x0p+0 (;=0;)
    i32.const 449536
    i32.const 48000
    local.get $l0
    i32.const 80
    i32.add
    call $convolve_sample
    f32.const 0x0p+0 (;=0;)
    i32.const 449536
    i32.const 48001
    local.get $l0
    i32.const 80
    i32.add
    call $convolve_sample
    f32.const 0x0p+0 (;=0;)
    i32.const 449536
    i32.const 48002
    local.get $l0
    i32.const 80
    i32.add
    call $convolve_sample
    f32.const 0x0p+0 (;=0;)
    i32.const 449536
    i32.const 48003
    local.get $l0
    i32.const 80
    i32.add
    call $convolve_sample
    f32.const 0x0p+0 (;=0;)
    i32.const 449536
    i32.const 48004
    local.get $l0
    i32.const 80
    i32.add
    call $convolve_sample
    f32.const 0x0p+0 (;=0;)
    i32.const 449536
    i32.const 48005
    local.get $l0
    i32.const 80
    i32.add
    call $convolve_sample
    f32.const 0x0p+0 (;=0;)
    i32.const 449536
    i32.const 48006
    local.get $l0
    i32.const 80
    i32.add
    call $convolve_sample
    f32.const 0x0p+0 (;=0;)
    i32.const 449536
    i32.const 48007
    local.get $l0
    i32.const 80
    i32.add
    call $convolve_sample
    f32.const 0x0p+0 (;=0;)
    i32.const 449536
    i32.const 48008
    local.get $l0
    i32.const 80
    i32.add
    call $convolve_sample
    f32.const 0x0p+0 (;=0;)
    i32.const 449536
    i32.const 48009
    local.get $l0
    i32.const 80
    i32.add
    call $convolve_sample
    f32.const 0x0p+0 (;=0;)
    i32.const 449536
    i32.const 48010
    local.get $l0
    i32.const 80
    i32.add
    call $convolve_sample
    f32.const 0x0p+0 (;=0;)
    i32.const 449536
    i32.const 48011
    local.get $l0
    i32.const 80
    i32.add
    call $convolve_sample
    f32.const 0x0p+0 (;=0;)
    i32.const 449536
    i32.const 48012
    local.get $l0
    i32.const 80
    i32.add
    call $convolve_sample
    f32.const 0x0p+0 (;=0;)
    i32.const 449536
    i32.const 48013
    local.get $l0
    i32.const 80
    i32.add
    call $convolve_sample
    f32.const 0x0p+0 (;=0;)
    i32.const 449536
    i32.const 48014
    local.get $l0
    i32.const 80
    i32.add
    call $convolve_sample
    i32.const 0
    i32.const 0
    i32.load offset=3145736
    i32.const 1
    i32.add
    i32.store offset=3145736
    i32.const 0
    i32.const 0
    i32.load offset=3145740
    i32.const 15
    i32.add
    i32.store offset=3145740
    local.get $l0
    i32.const 0
    i32.const 80
    memory.fill
    local.get $l0
    i32.const 12
    i32.add
    local.set $l1
    i32.const 0
    local.set $l3
    i32.const 0
    local.set $l4
    i32.const 0
    local.set $l2
    loop $L10
      block $B11
        local.get $l4
        i32.eqz
        br_if $B11
        i32.const 0
        i32.const 0
        i32.load offset=3145732
        i32.const 1
        i32.add
        i32.store offset=3145732
      end
      i32.const 0
      local.set $l5
      loop $L12
        local.get $l0
        f32.load offset=4
        local.set $l6
        local.get $l0
        local.get $l3
        local.get $l5
        i32.add
        local.tee $l7
        i32.const 257536
        i32.add
        f32.load
        local.tee $l8
        f32.const 0x1.a70f44p-3 (;=0.206572;)
        f32.mul
        local.tee $l9
        local.get $l9
        local.get $l0
        f32.load
        f32.add
        local.tee $l9
        f32.const -0x1.9107d4p-3 (;=-0.195816;)
        f32.mul
        f32.add
        f32.store offset=4
        local.get $l0
        local.get $l6
        local.get $l8
        f32.const 0x1.a70f44p-2 (;=0.413144;)
        f32.mul
        local.get $l9
        f32.const 0x1.7a6562p-2 (;=0.369527;)
        f32.mul
        f32.add
        f32.add
        f32.store
        f32.const 0x1p+0 (;=1;)
        local.set $l8
        local.get $l0
        f32.const 0x1.ccccccp-1 (;=0.9;)
        f32.const 0x1.ffbe76p-1 (;=0.9995;)
        local.get $l9
        f32.abs
        local.tee $l6
        local.get $l0
        f32.load offset=8
        local.tee $l10
        f32.gt
        select
        local.tee $l11
        local.get $l10
        f32.mul
        local.get $l6
        f32.const 0x1p+0 (;=1;)
        local.get $l11
        f32.sub
        f32.mul
        f32.add
        local.tee $l6
        f32.store offset=8
        block $B13
          local.get $l6
          f32.const 0x1.99999ap-3 (;=0.2;)
          f32.le
          br_if $B13
          local.get $l6
          f32.const -0x1p-2 (;=-0.25;)
          f32.add
          f32.const 0x1p-2 (;=0.25;)
          f32.mul
          f32.const 0x1p-2 (;=0.25;)
          f32.add
          local.set $l8
          block $B14
            local.get $l6
            f32.const 0x1.333334p-2 (;=0.3;)
            f32.ge
            br_if $B14
            local.get $l6
            f32.const -0x1.99999ap-3 (;=-0.2;)
            f32.add
            f32.const 0x1.99999ap-4 (;=0.1;)
            f32.div
            local.tee $l10
            local.get $l10
            f32.mul
            local.get $l8
            local.get $l6
            f32.sub
            f32.mul
            local.get $l6
            f32.add
            local.set $l8
          end
          local.get $l8
          local.get $l6
          f32.div
          local.set $l8
        end
        local.get $l1
        local.get $l2
        i32.const 2
        i32.shl
        i32.add
        local.get $l9
        local.get $l8
        f32.mul
        local.tee $l6
        f32.store
        local.get $l7
        i32.const 641600
        i32.add
        local.get $l1
        local.get $l2
        i32.const -1
        i32.add
        i32.const 15
        local.get $l2
        select
        local.tee $l7
        i32.const -1
        i32.add
        i32.const 15
        local.get $l7
        select
        local.tee $l12
        i32.const -1
        i32.add
        i32.const 15
        local.get $l12
        select
        local.tee $l13
        i32.const -1
        i32.add
        i32.const 15
        local.get $l13
        select
        local.tee $l14
        i32.const -1
        i32.add
        i32.const 15
        local.get $l14
        select
        local.tee $l15
        i32.const -1
        i32.add
        i32.const 15
        local.get $l15
        select
        local.tee $l16
        i32.const -1
        i32.add
        i32.const 15
        local.get $l16
        select
        local.tee $l17
        i32.const -1
        i32.add
        i32.const 15
        local.get $l17
        select
        local.tee $l18
        i32.const -1
        i32.add
        i32.const 15
        local.get $l18
        select
        local.tee $l19
        i32.const -1
        i32.add
        i32.const 15
        local.get $l19
        select
        local.tee $l20
        i32.const -1
        i32.add
        i32.const 15
        local.get $l20
        select
        local.tee $l21
        i32.const -1
        i32.add
        i32.const 15
        local.get $l21
        select
        local.tee $l22
        i32.const -1
        i32.add
        i32.const 15
        local.get $l22
        select
        local.tee $l23
        i32.const -1
        i32.add
        i32.const 15
        local.get $l23
        select
        local.tee $l24
        i32.const -1
        i32.add
        i32.const 15
        local.get $l24
        select
        i32.const 2
        i32.shl
        i32.add
        f32.load
        f32.const 0x1.b5e4d6p-9 (;=0.00334087;)
        f32.mul
        local.get $l1
        local.get $l24
        i32.const 2
        i32.shl
        i32.add
        f32.load
        f32.const -0x1.23ede4p-8 (;=-0.00445449;)
        f32.mul
        local.get $l1
        local.get $l23
        i32.const 2
        i32.shl
        i32.add
        f32.load
        f32.const 0x1.853d3p-8 (;=0.00593932;)
        f32.mul
        local.get $l1
        local.get $l22
        i32.const 2
        i32.shl
        i32.add
        f32.load
        f32.const -0x1.037e2p-7 (;=-0.00791909;)
        f32.mul
        local.get $l1
        local.get $l21
        i32.const 2
        i32.shl
        i32.add
        f32.load
        f32.const 0x1.59fd8p-7 (;=0.0105588;)
        f32.mul
        local.get $l1
        local.get $l20
        i32.const 2
        i32.shl
        i32.add
        f32.load
        f32.const -0x1.cd52p-7 (;=-0.0140784;)
        f32.mul
        local.get $l1
        local.get $l19
        i32.const 2
        i32.shl
        i32.add
        f32.load
        f32.const 0x1.338cp-6 (;=0.0187712;)
        f32.mul
        local.get $l1
        local.get $l18
        i32.const 2
        i32.shl
        i32.add
        f32.load
        f32.const -0x1.9a1p-6 (;=-0.0250282;)
        f32.mul
        local.get $l1
        local.get $l17
        i32.const 2
        i32.shl
        i32.add
        f32.load
        f32.const 0x1.116p-5 (;=0.033371;)
        f32.mul
        local.get $l1
        local.get $l16
        i32.const 2
        i32.shl
        i32.add
        f32.load
        f32.const -0x1.6c8p-5 (;=-0.0444946;)
        f32.mul
        local.get $l1
        local.get $l15
        i32.const 2
        i32.shl
        i32.add
        f32.load
        f32.const 0x1.e6p-5 (;=0.0593262;)
        f32.mul
        local.get $l1
        local.get $l14
        i32.const 2
        i32.shl
        i32.add
        f32.load
        f32.const -0x1.44p-4 (;=-0.0791016;)
        f32.mul
        local.get $l1
        local.get $l13
        i32.const 2
        i32.shl
        i32.add
        f32.load
        f32.const 0x1.bp-4 (;=0.105469;)
        f32.mul
        local.get $l1
        local.get $l12
        i32.const 2
        i32.shl
        i32.add
        f32.load
        f32.const 0x1.2p-3 (;=0.140625;)
        f32.mul
        local.get $l1
        local.get $l7
        i32.const 2
        i32.shl
        i32.add
        f32.load
        f32.const -0x1.8p-3 (;=-0.1875;)
        f32.mul
        local.get $l6
        f32.const 0x1.4p-1 (;=0.625;)
        f32.mul
        f32.const 0x0p+0 (;=0;)
        f32.add
        f32.add
        f32.add
        f32.add
        f32.add
        f32.add
        f32.add
        f32.add
        f32.add
        f32.add
        f32.add
        f32.add
        f32.add
        f32.add
        f32.add
        f32.add
        f32.store
        i32.const 0
        local.get $l2
        i32.const 1
        i32.add
        local.tee $l2
        local.get $l2
        i32.const 16
        i32.eq
        select
        local.set $l2
        local.get $l5
        i32.const 4
        i32.add
        local.tee $l5
        i32.const 512
        i32.ne
        br_if $L12
      end
      i32.const 0
      i32.const 0
      i32.load offset=3145728
      i32.const 1
      i32.add
      i32.store offset=3145728
      local.get $l3
      i32.const 512
      i32.add
      local.set $l3
      local.get $l4
      i32.const 1
      i32.add
      local.tee $l4
      i32.const 375
      i32.ne
      br_if $L10
    end
    local.get $l0
    local.get $l2
    i32.store offset=76
    f32.const 0x0p+0 (;=0;)
    i32.const 641600
    i32.const 48000
    local.get $l0
    call $convolve_sample
    f32.const 0x0p+0 (;=0;)
    i32.const 641600
    i32.const 48001
    local.get $l0
    call $convolve_sample
    f32.const 0x0p+0 (;=0;)
    i32.const 641600
    i32.const 48002
    local.get $l0
    call $convolve_sample
    f32.const 0x0p+0 (;=0;)
    i32.const 641600
    i32.const 48003
    local.get $l0
    call $convolve_sample
    f32.const 0x0p+0 (;=0;)
    i32.const 641600
    i32.const 48004
    local.get $l0
    call $convolve_sample
    f32.const 0x0p+0 (;=0;)
    i32.const 641600
    i32.const 48005
    local.get $l0
    call $convolve_sample
    f32.const 0x0p+0 (;=0;)
    i32.const 641600
    i32.const 48006
    local.get $l0
    call $convolve_sample
    f32.const 0x0p+0 (;=0;)
    i32.const 641600
    i32.const 48007
    local.get $l0
    call $convolve_sample
    f32.const 0x0p+0 (;=0;)
    i32.const 641600
    i32.const 48008
    local.get $l0
    call $convolve_sample
    f32.const 0x0p+0 (;=0;)
    i32.const 641600
    i32.const 48009
    local.get $l0
    call $convolve_sample
    f32.const 0x0p+0 (;=0;)
    i32.const 641600
    i32.const 48010
    local.get $l0
    call $convolve_sample
    f32.const 0x0p+0 (;=0;)
    i32.const 641600
    i32.const 48011
    local.get $l0
    call $convolve_sample
    f32.const 0x0p+0 (;=0;)
    i32.const 641600
    i32.const 48012
    local.get $l0
    call $convolve_sample
    f32.const 0x0p+0 (;=0;)
    i32.const 641600
    i32.const 48013
    local.get $l0
    call $convolve_sample
    f32.const 0x0p+0 (;=0;)
    i32.const 641600
    i32.const 48014
    local.get $l0
    call $convolve_sample
    i32.const 0
    local.set $l1
    i32.const 0
    i32.const 0
    i32.load offset=3145736
    i32.const 1
    i32.add
    i32.store offset=3145736
    i32.const 0
    i32.const 0
    i32.load offset=3145740
    i32.const 15
    i32.add
    i32.store offset=3145740
    i32.const 2097152
    local.set $l2
    loop $L15 (result i32)
      local.get $l1
      i32.const 449536
      i32.add
      f32.load
      local.set $l6
      local.get $l2
      i32.const 4
      i32.add
      f32.const 0x0p+0 (;=0;)
      local.get $l1
      i32.const 641600
      i32.add
      f32.load
      local.tee $l9
      local.get $l9
      f32.const 0x0p+0 (;=0;)
      f32.eq
      select
      f32.store
      local.get $l2
      f32.const 0x0p+0 (;=0;)
      local.get $l6
      local.get $l6
      f32.const 0x0p+0 (;=0;)
      f32.eq
      select
      f32.store
      block $B16
        local.get $l1
        i32.const 192056
        i32.ne
        br_if $B16
        i32.const -2128831035
        local.set $l2
        i32.const 0
        local.set $l1
        loop $L17
          local.get $l2
          local.get $l1
          i32.const 2097152
          i32.add
          i32.load8_u
          i32.xor
          i32.const 16777619
          i32.mul
          local.get $l1
          i32.const 2097153
          i32.add
          i32.load8_u
          i32.xor
          i32.const 16777619
          i32.mul
          local.get $l1
          i32.const 2097154
          i32.add
          i32.load8_u
          i32.xor
          i32.const 16777619
          i32.mul
          local.get $l1
          i32.const 2097155
          i32.add
          i32.load8_u
          i32.xor
          i32.const 16777619
          i32.mul
          local.get $l1
          i32.const 2097156
          i32.add
          i32.load8_u
          i32.xor
          i32.const 16777619
          i32.mul
          local.set $l2
          local.get $l1
          i32.const 5
          i32.add
          local.tee $l1
          i32.const 384120
          i32.ne
          br_if $L17
        end
        i32.const 0
        local.get $l2
        i32.store offset=3145744
        local.get $l0
        i32.const 160
        i32.add
        global.set $__stack_pointer
        local.get $l2
        return
      end
      local.get $l1
      i32.const 449540
      i32.add
      f32.load
      local.set $l6
      local.get $l2
      i32.const 12
      i32.add
      f32.const 0x0p+0 (;=0;)
      local.get $l1
      i32.const 641604
      i32.add
      f32.load
      local.tee $l9
      local.get $l9
      f32.const 0x0p+0 (;=0;)
      f32.eq
      select
      f32.store
      local.get $l2
      i32.const 8
      i32.add
      f32.const 0x0p+0 (;=0;)
      local.get $l6
      local.get $l6
      f32.const 0x0p+0 (;=0;)
      f32.eq
      select
      f32.store
      local.get $l2
      i32.const 16
      i32.add
      local.set $l2
      local.get $l1
      i32.const 8
      i32.add
      local.set $l1
      br $L15
    end)
  (func $convolve_sample (type $t2) (param $p0 f32) (param $p1 i32) (param $p2 i32) (param $p3 i32)
    (local $l4 i32) (local $l5 i32) (local $l6 i32) (local $l7 i32) (local $l8 i32) (local $l9 i32) (local $l10 i32) (local $l11 i32) (local $l12 i32) (local $l13 i32) (local $l14 i32) (local $l15 i32)
    local.get $p3
    i32.const 12
    i32.add
    local.tee $l4
    local.get $p3
    i32.load offset=76
    local.tee $l5
    i32.const 2
    i32.shl
    i32.add
    local.get $p0
    f32.store
    local.get $p3
    i32.const 0
    local.get $l5
    i32.const 1
    i32.add
    local.tee $l6
    local.get $l6
    i32.const 16
    i32.eq
    select
    i32.store offset=76
    local.get $p1
    local.get $p2
    i32.const 2
    i32.shl
    i32.add
    local.get $l4
    local.get $l5
    i32.const -1
    i32.add
    i32.const 15
    local.get $l5
    select
    local.tee $p3
    i32.const -1
    i32.add
    i32.const 15
    local.get $p3
    select
    local.tee $l5
    i32.const -1
    i32.add
    i32.const 15
    local.get $l5
    select
    local.tee $p2
    i32.const -1
    i32.add
    i32.const 15
    local.get $p2
    select
    local.tee $p1
    i32.const -1
    i32.add
    i32.const 15
    local.get $p1
    select
    local.tee $l6
    i32.const -1
    i32.add
    i32.const 15
    local.get $l6
    select
    local.tee $l7
    i32.const -1
    i32.add
    i32.const 15
    local.get $l7
    select
    local.tee $l8
    i32.const -1
    i32.add
    i32.const 15
    local.get $l8
    select
    local.tee $l9
    i32.const -1
    i32.add
    i32.const 15
    local.get $l9
    select
    local.tee $l10
    i32.const -1
    i32.add
    i32.const 15
    local.get $l10
    select
    local.tee $l11
    i32.const -1
    i32.add
    i32.const 15
    local.get $l11
    select
    local.tee $l12
    i32.const -1
    i32.add
    i32.const 15
    local.get $l12
    select
    local.tee $l13
    i32.const -1
    i32.add
    i32.const 15
    local.get $l13
    select
    local.tee $l14
    i32.const -1
    i32.add
    i32.const 15
    local.get $l14
    select
    local.tee $l15
    i32.const -1
    i32.add
    i32.const 15
    local.get $l15
    select
    i32.const 2
    i32.shl
    i32.add
    f32.load
    f32.const 0x1.b5e4d6p-9 (;=0.00334087;)
    f32.mul
    local.get $l4
    local.get $l15
    i32.const 2
    i32.shl
    i32.add
    f32.load
    f32.const -0x1.23ede4p-8 (;=-0.00445449;)
    f32.mul
    local.get $l4
    local.get $l14
    i32.const 2
    i32.shl
    i32.add
    f32.load
    f32.const 0x1.853d3p-8 (;=0.00593932;)
    f32.mul
    local.get $l4
    local.get $l13
    i32.const 2
    i32.shl
    i32.add
    f32.load
    f32.const -0x1.037e2p-7 (;=-0.00791909;)
    f32.mul
    local.get $l4
    local.get $l12
    i32.const 2
    i32.shl
    i32.add
    f32.load
    f32.const 0x1.59fd8p-7 (;=0.0105588;)
    f32.mul
    local.get $l4
    local.get $l11
    i32.const 2
    i32.shl
    i32.add
    f32.load
    f32.const -0x1.cd52p-7 (;=-0.0140784;)
    f32.mul
    local.get $l4
    local.get $l10
    i32.const 2
    i32.shl
    i32.add
    f32.load
    f32.const 0x1.338cp-6 (;=0.0187712;)
    f32.mul
    local.get $l4
    local.get $l9
    i32.const 2
    i32.shl
    i32.add
    f32.load
    f32.const -0x1.9a1p-6 (;=-0.0250282;)
    f32.mul
    local.get $l4
    local.get $l8
    i32.const 2
    i32.shl
    i32.add
    f32.load
    f32.const 0x1.116p-5 (;=0.033371;)
    f32.mul
    local.get $l4
    local.get $l7
    i32.const 2
    i32.shl
    i32.add
    f32.load
    f32.const -0x1.6c8p-5 (;=-0.0444946;)
    f32.mul
    local.get $l4
    local.get $l6
    i32.const 2
    i32.shl
    i32.add
    f32.load
    f32.const 0x1.e6p-5 (;=0.0593262;)
    f32.mul
    local.get $l4
    local.get $p1
    i32.const 2
    i32.shl
    i32.add
    f32.load
    f32.const -0x1.44p-4 (;=-0.0791016;)
    f32.mul
    local.get $l4
    local.get $p2
    i32.const 2
    i32.shl
    i32.add
    f32.load
    f32.const 0x1.bp-4 (;=0.105469;)
    f32.mul
    local.get $l4
    local.get $l5
    i32.const 2
    i32.shl
    i32.add
    f32.load
    f32.const 0x1.2p-3 (;=0.140625;)
    f32.mul
    local.get $l4
    local.get $p3
    i32.const 2
    i32.shl
    i32.add
    f32.load
    f32.const -0x1.8p-3 (;=-0.1875;)
    f32.mul
    local.get $p0
    f32.const 0x1.4p-1 (;=0.625;)
    f32.mul
    f32.const 0x0p+0 (;=0;)
    f32.add
    f32.add
    f32.add
    f32.add
    f32.add
    f32.add
    f32.add
    f32.add
    f32.add
    f32.add
    f32.add
    f32.add
    f32.add
    f32.add
    f32.add
    f32.add
    f32.store)
  (table $__indirect_function_table 1 1 funcref)
  (memory $memory 56)
  (global $__stack_pointer (mut i32) (i32.const 65536))
  (global $__dso_handle i32 (i32.const 65536))
  (global $__data_end i32 (i32.const 833660))
  (global $__stack_low i32 (i32.const 0))
  (global $__stack_high i32 (i32.const 65536))
  (global $__global_base i32 (i32.const 65536))
  (global $__heap_base i32 (i32.const 833664))
  (global $__heap_end i32 (i32.const 3670016))
  (global $__memory_base i32 (i32.const 0))
  (global $__table_base i32 (i32.const 1))
  (global $__wasm_first_page_end i32 (i32.const 65536))
  (export "memory" (memory $memory))
  (export "__wasm_call_ctors" (func $__wasm_call_ctors))
  (export "__stack_pointer" (global $__stack_pointer))
  (export "audio_dsp" (func $audio_dsp))
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
