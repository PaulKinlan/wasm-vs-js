;; server.ssr-template.v1 — kernel: ssr_render
;; WebAssembly Text (WAT) baseline implementation
;; Exports: ssr_render

(module $server_ssr_kernel_c.wasm
  (type $t0 (func))
  (type $t1 (func (param i32) (result i32)))
  (type $t2 (func (param i32 i32 i32)))
  (type $t3 (func (param i32 i32)))
  (func $__wasm_call_ctors (type $t0))
  (func $ssr_render (type $t1) (param $p0 i32) (result i32)
    (local $l1 i32) (local $l2 i32) (local $l3 i32) (local $l4 i32) (local $l5 i32) (local $l6 i32) (local $l7 i32) (local $l8 i32) (local $l9 i32) (local $l10 i32) (local $l11 i32) (local $l12 i32) (local $l13 i32) (local $l14 i32) (local $l15 i32) (local $l16 i32) (local $l17 i32) (local $l18 i32) (local $l19 i32) (local $l20 i32)
    global.get $__stack_pointer
    i32.const 48
    i32.sub
    local.tee $l1
    global.set $__stack_pointer
    i32.const 0
    i32.const -2128831035
    i32.store offset=65760
    i32.const 0
    i32.const 0
    i32.store offset=65752
    i32.const 0
    i32.const 0
    i32.store offset=65748
    i32.const 0
    i32.const 0
    i32.store8 offset=65756
    block $B0
      block $B1
        local.get $p0
        i32.const 8
        i32.ge_u
        br_if $B1
        i32.const -1
        local.set $l2
        br $B0
      end
      i32.const 0
      i32.load offset=3145728
      local.set $l2
      i32.const 0
      i32.const 4
      i32.store offset=65752
      block $B2
        local.get $l2
        i32.const 826692435
        i32.eq
        br_if $B2
        i32.const -2
        local.set $l2
        br $B0
      end
      i32.const 0
      i32.load offset=3145732
      local.set $l2
      i32.const 0
      i32.const 8
      i32.store offset=65752
      block $B3
        local.get $l2
        i32.const 1000
        i32.eq
        br_if $B3
        i32.const -3
        local.set $l2
        br $B0
      end
      i32.const 0
      i32.const 83
      i32.store8 offset=3407872
      i32.const 0
      i32.const 0
      i32.load offset=65748
      local.tee $l2
      i32.const 1
      i32.add
      i32.store offset=65748
      i32.const 0
      i32.const 0
      i32.load offset=65760
      i32.const 83
      i32.xor
      i32.const 16777619
      i32.mul
      i32.store offset=65760
      local.get $l2
      i32.const 3407873
      i32.add
      i32.const 83
      i32.store8
      i32.const 0
      i32.const 0
      i32.load offset=65748
      local.tee $l2
      i32.const 1
      i32.add
      i32.store offset=65748
      i32.const 0
      i32.const 0
      i32.load offset=65760
      i32.const 83
      i32.xor
      i32.const 16777619
      i32.mul
      i32.store offset=65760
      local.get $l2
      i32.const 3407873
      i32.add
      i32.const 79
      i32.store8
      i32.const 0
      i32.const 0
      i32.load offset=65748
      local.tee $l2
      i32.const 1
      i32.add
      i32.store offset=65748
      i32.const 0
      i32.const 0
      i32.load offset=65760
      i32.const 79
      i32.xor
      i32.const 16777619
      i32.mul
      i32.store offset=65760
      local.get $l2
      i32.const 3407873
      i32.add
      i32.const 49
      i32.store8
      i32.const 0
      i32.const 0
      i32.load offset=65748
      local.tee $l2
      i32.const 1
      i32.add
      i32.store offset=65748
      i32.const 0
      i32.const 0
      i32.load offset=65760
      i32.const 49
      i32.xor
      i32.const 16777619
      i32.mul
      i32.store offset=65760
      local.get $l2
      i32.const 3407873
      i32.add
      i32.const 232
      i32.store8
      i32.const 0
      i32.const 0
      i32.load offset=65748
      local.tee $l2
      i32.const 1
      i32.add
      i32.store offset=65748
      i32.const 0
      i32.const 0
      i32.load offset=65760
      i32.const 232
      i32.xor
      i32.const 16777619
      i32.mul
      i32.store offset=65760
      local.get $l2
      i32.const 3407873
      i32.add
      i32.const 3
      i32.store8
      i32.const 0
      i32.const 0
      i32.load offset=65748
      local.tee $l2
      i32.const 1
      i32.add
      i32.store offset=65748
      i32.const 0
      i32.const 0
      i32.load offset=65760
      i32.const 3
      i32.xor
      i32.const 16777619
      i32.mul
      i32.store offset=65760
      local.get $l2
      i32.const 3407873
      i32.add
      i32.const 0
      i32.store8
      i32.const 0
      i32.const 0
      i32.load offset=65760
      i32.const 16777619
      i32.mul
      i32.store offset=65760
      i32.const 0
      i32.const 0
      i32.load offset=65748
      local.tee $l2
      i32.const 1
      i32.add
      i32.store offset=65748
      local.get $l2
      i32.const 3407873
      i32.add
      i32.const 0
      i32.store8
      i32.const 0
      i32.const 0
      i32.load offset=65760
      i32.const 16777619
      i32.mul
      i32.store offset=65760
      i32.const 0
      i32.const 0
      i32.load offset=65748
      i32.const 1
      i32.add
      i32.store offset=65748
      i32.const 0
      local.set $l3
      i32.const 0
      local.set $l4
      i32.const 0
      local.set $l5
      loop $L4
        i32.const 0
        local.set $l6
        i32.const 0
        local.set $l7
        i32.const 0
        local.set $l2
        i32.const 0
        local.set $l8
        block $B5
          block $B6
            block $B7
              i32.const 0
              i32.load8_u offset=65756
              br_if $B7
              i32.const 0
              local.set $l7
              block $B8
                local.get $p0
                i32.const 0
                i32.load offset=65752
                local.tee $l9
                i32.ge_u
                br_if $B8
                i32.const 0
                local.set $l2
                i32.const 0
                local.set $l8
                i32.const 0
                i32.const 1
                i32.store8 offset=65756
                br $B5
              end
              i32.const 0
              local.set $l2
              i32.const 0
              local.set $l8
              local.get $p0
              local.get $l9
              i32.sub
              i32.const 4
              i32.lt_u
              br_if $B7
              local.get $l9
              i32.const 3145728
              i32.add
              i32.load align=1
              local.set $l2
              i32.const 0
              local.set $l7
              i32.const 0
              local.get $l9
              i32.const 4
              i32.add
              local.tee $l8
              i32.store offset=65752
              block $B9
                local.get $p0
                local.get $l8
                i32.ge_u
                br_if $B9
                i32.const 0
                local.set $l8
                i32.const 0
                i32.const 1
                i32.store8 offset=65756
                br $B5
              end
              block $B10
                local.get $p0
                local.get $l8
                i32.sub
                i32.const 4
                i32.ge_u
                br_if $B10
                i32.const 0
                local.set $l8
                i32.const 0
                i32.const 1
                i32.store8 offset=65756
                br $B5
              end
              local.get $l9
              i32.const 3145732
              i32.add
              i32.load align=1
              local.set $l8
              i32.const 0
              local.set $l7
              i32.const 0
              local.get $l9
              i32.const 8
              i32.add
              local.tee $l10
              i32.store offset=65752
              local.get $p0
              local.get $l10
              i32.lt_u
              br_if $B7
              local.get $p0
              local.get $l10
              i32.sub
              i32.const 4
              i32.lt_u
              br_if $B7
              local.get $l9
              i32.const 3145736
              i32.add
              i32.load align=1
              local.set $l7
              i32.const 0
              local.get $l9
              i32.const 12
              i32.add
              local.tee $l10
              i32.store offset=65752
              local.get $p0
              local.get $l10
              i32.lt_u
              br_if $B7
              local.get $p0
              local.get $l10
              i32.sub
              i32.const 3
              i32.gt_u
              br_if $B6
            end
            i32.const 0
            i32.const 1
            i32.store8 offset=65756
            br $B5
          end
          local.get $l9
          i32.const 3145740
          i32.add
          i32.load align=1
          local.set $l6
          i32.const 0
          local.get $l9
          i32.const 16
          i32.add
          i32.store offset=65752
        end
        local.get $l1
        i32.const 0
        i32.store offset=32
        local.get $l1
        i32.const 0
        i32.store offset=28
        local.get $l1
        i32.const 0
        i32.store offset=24
        local.get $l1
        i32.const 0
        i32.store offset=20
        local.get $l1
        i32.const 0
        i32.store offset=16
        local.get $l1
        i32.const 0
        i32.store offset=12
        local.get $p0
        local.get $l1
        i32.const 32
        i32.add
        local.get $l1
        i32.const 28
        i32.add
        call $parse_string
        local.get $p0
        local.get $l1
        i32.const 24
        i32.add
        local.get $l1
        i32.const 20
        i32.add
        call $parse_string
        local.get $p0
        local.get $l1
        i32.const 16
        i32.add
        local.get $l1
        i32.const 12
        i32.add
        call $parse_string
        block $B11
          i32.const 0
          i32.load8_u offset=65756
          i32.eqz
          br_if $B11
          i32.const -5
          local.set $l2
          br $B0
        end
        i32.const 0
        i32.load offset=65748
        local.tee $l11
        i32.const 0
        i32.store8 offset=3407872
        i32.const 0
        i32.const 0
        i32.load offset=65760
        i32.const 16777619
        i32.mul
        i32.store offset=65760
        i32.const 0
        i32.const 0
        i32.load offset=65748
        local.tee $l9
        i32.const 1
        i32.add
        i32.store offset=65748
        local.get $l9
        i32.const 3407873
        i32.add
        i32.const 0
        i32.store8
        i32.const 0
        i32.const 0
        i32.load offset=65760
        i32.const 16777619
        i32.mul
        i32.store offset=65760
        i32.const 0
        i32.const 0
        i32.load offset=65748
        local.tee $l9
        i32.const 1
        i32.add
        i32.store offset=65748
        local.get $l9
        i32.const 3407873
        i32.add
        i32.const 0
        i32.store8
        i32.const 0
        i32.const 0
        i32.load offset=65760
        i32.const 16777619
        i32.mul
        i32.store offset=65760
        i32.const 0
        i32.const 0
        i32.load offset=65748
        local.tee $l9
        i32.const 1
        i32.add
        i32.store offset=65748
        local.get $l9
        i32.const 3407873
        i32.add
        i32.const 0
        i32.store8
        i32.const 0
        i32.const 0
        i32.load offset=65760
        i32.const 16777619
        i32.mul
        i32.store offset=65760
        i32.const 0
        i32.const 0
        i32.load offset=65748
        local.tee $l12
        i32.const 1
        i32.add
        local.tee $l10
        i32.store offset=65748
        i32.const -60
        local.set $l9
        local.get $l1
        i32.load offset=12
        local.set $l13
        local.get $l1
        i32.load offset=16
        local.set $l14
        local.get $l1
        i32.load offset=20
        local.set $l15
        local.get $l1
        i32.load offset=24
        local.set $l16
        local.get $l1
        i32.load offset=28
        local.set $l17
        local.get $l1
        i32.load offset=32
        local.set $l18
        loop $L12
          local.get $l10
          local.get $l9
          i32.const 65628
          i32.add
          i32.load8_u
          local.tee $l19
          i32.store8 offset=3407872
          i32.const 0
          i32.const 0
          i32.load offset=65748
          local.tee $l10
          i32.const 1
          i32.add
          i32.store offset=65748
          i32.const 0
          local.get $l19
          i32.const 0
          i32.load offset=65760
          i32.xor
          i32.const 16777619
          i32.mul
          i32.store offset=65760
          local.get $l10
          i32.const 3407873
          i32.add
          local.get $l9
          i32.const 65629
          i32.add
          i32.load8_u
          local.tee $l19
          i32.store8
          i32.const 0
          i32.const 0
          i32.load offset=65748
          i32.const 1
          i32.add
          local.tee $l10
          i32.store offset=65748
          i32.const 0
          local.get $l19
          i32.const 0
          i32.load offset=65760
          i32.xor
          i32.const 16777619
          i32.mul
          i32.store offset=65760
          local.get $l9
          i32.const 2
          i32.add
          local.tee $l9
          br_if $L12
        end
        i32.const 0
        local.set $l9
        loop $L13
          local.get $l1
          i32.const 38
          i32.add
          local.get $l9
          i32.add
          local.get $l2
          local.get $l2
          i32.const 10
          i32.div_u
          local.tee $l19
          i32.const 10
          i32.mul
          i32.sub
          i32.const 48
          i32.or
          i32.store8
          local.get $l9
          i32.const 1
          i32.add
          local.set $l9
          local.get $l2
          i32.const 9
          i32.gt_u
          local.set $l20
          local.get $l19
          local.set $l2
          local.get $l20
          br_if $L13
        end
        block $B14
          block $B15
            local.get $l9
            i32.const -1
            i32.add
            local.tee $l2
            i32.const 1
            i32.and
            i32.eqz
            br_if $B15
            local.get $l9
            local.set $l2
            br $B14
          end
          local.get $l10
          local.get $l1
          i32.const 38
          i32.add
          local.get $l9
          i32.add
          i32.const -1
          i32.add
          i32.load8_u
          local.tee $l19
          i32.store8 offset=3407872
          i32.const 0
          i32.const 0
          i32.load offset=65748
          i32.const 1
          i32.add
          local.tee $l10
          i32.store offset=65748
          i32.const 0
          local.get $l19
          i32.const 0
          i32.load offset=65760
          i32.xor
          i32.const 16777619
          i32.mul
          i32.store offset=65760
        end
        block $B16
          local.get $l9
          i32.const 1
          i32.eq
          br_if $B16
          loop $L17
            local.get $l10
            local.get $l1
            i32.const 38
            i32.add
            local.get $l2
            i32.add
            local.tee $l9
            i32.const -1
            i32.add
            i32.load8_u
            local.tee $l19
            i32.store8 offset=3407872
            i32.const 0
            i32.const 0
            i32.load offset=65748
            local.tee $l10
            i32.const 1
            i32.add
            i32.store offset=65748
            i32.const 0
            local.get $l19
            i32.const 0
            i32.load offset=65760
            i32.xor
            i32.const 16777619
            i32.mul
            i32.store offset=65760
            local.get $l10
            i32.const 3407873
            i32.add
            local.get $l9
            i32.const -2
            i32.add
            i32.load8_u
            local.tee $l9
            i32.store8
            i32.const 0
            i32.const 0
            i32.load offset=65748
            i32.const 1
            i32.add
            local.tee $l10
            i32.store offset=65748
            i32.const 0
            local.get $l9
            i32.const 0
            i32.load offset=65760
            i32.xor
            i32.const 16777619
            i32.mul
            i32.store offset=65760
            local.get $l2
            i32.const -2
            i32.add
            local.tee $l2
            br_if $L17
          end
        end
        local.get $l10
        i32.const 34
        i32.store8 offset=3407872
        i32.const 0
        local.set $l9
        i32.const 0
        i32.const 0
        i32.load offset=65748
        local.tee $l2
        i32.const 1
        i32.add
        i32.store offset=65748
        i32.const 0
        i32.const 0
        i32.load offset=65760
        i32.const 34
        i32.xor
        i32.const 16777619
        i32.mul
        i32.store offset=65760
        local.get $l2
        i32.const 3407873
        i32.add
        i32.const 62
        i32.store8
        i32.const 0
        i32.const 0
        i32.load offset=65748
        local.tee $l2
        i32.const 1
        i32.add
        i32.store offset=65748
        i32.const 0
        i32.const 0
        i32.load offset=65760
        i32.const 62
        i32.xor
        i32.const 16777619
        i32.mul
        i32.store offset=65760
        local.get $l2
        i32.const 3407873
        i32.add
        i32.const 60
        i32.store8
        i32.const 0
        i32.const 0
        i32.load offset=65748
        local.tee $l2
        i32.const 1
        i32.add
        i32.store offset=65748
        i32.const 0
        i32.const 0
        i32.load offset=65760
        i32.const 60
        i32.xor
        i32.const 16777619
        i32.mul
        i32.store offset=65760
        local.get $l2
        i32.const 3407873
        i32.add
        i32.const 104
        i32.store8
        i32.const 0
        i32.const 0
        i32.load offset=65748
        local.tee $l2
        i32.const 1
        i32.add
        i32.store offset=65748
        i32.const 0
        i32.const 0
        i32.load offset=65760
        i32.const 104
        i32.xor
        i32.const 16777619
        i32.mul
        i32.store offset=65760
        local.get $l2
        i32.const 3407873
        i32.add
        i32.const 49
        i32.store8
        i32.const 0
        i32.const 0
        i32.load offset=65748
        local.tee $l2
        i32.const 1
        i32.add
        i32.store offset=65748
        i32.const 0
        i32.const 0
        i32.load offset=65760
        i32.const 49
        i32.xor
        i32.const 16777619
        i32.mul
        i32.store offset=65760
        local.get $l2
        i32.const 3407873
        i32.add
        i32.const 62
        i32.store8
        i32.const 0
        i32.const 0
        i32.load offset=65748
        i32.const 1
        i32.add
        i32.store offset=65748
        i32.const 0
        i32.const 0
        i32.load offset=65760
        i32.const 62
        i32.xor
        i32.const 16777619
        i32.mul
        i32.store offset=65760
        local.get $l18
        local.get $l17
        call $write_text_escaped
        i32.const 0
        i32.load offset=65748
        i32.const 60
        i32.store8 offset=3407872
        i32.const 0
        i32.const 0
        i32.load offset=65748
        local.tee $l2
        i32.const 1
        i32.add
        i32.store offset=65748
        i32.const 0
        i32.const 0
        i32.load offset=65760
        i32.const 60
        i32.xor
        i32.const 16777619
        i32.mul
        i32.store offset=65760
        local.get $l2
        i32.const 3407873
        i32.add
        i32.const 47
        i32.store8
        i32.const 0
        i32.const 0
        i32.load offset=65748
        local.tee $l2
        i32.const 1
        i32.add
        i32.store offset=65748
        i32.const 0
        i32.const 0
        i32.load offset=65760
        i32.const 47
        i32.xor
        i32.const 16777619
        i32.mul
        i32.store offset=65760
        local.get $l2
        i32.const 3407873
        i32.add
        i32.const 104
        i32.store8
        i32.const 0
        i32.const 0
        i32.load offset=65748
        local.tee $l2
        i32.const 1
        i32.add
        i32.store offset=65748
        i32.const 0
        i32.const 0
        i32.load offset=65760
        i32.const 104
        i32.xor
        i32.const 16777619
        i32.mul
        i32.store offset=65760
        local.get $l2
        i32.const 3407873
        i32.add
        i32.const 49
        i32.store8
        i32.const 0
        i32.const 0
        i32.load offset=65748
        local.tee $l2
        i32.const 1
        i32.add
        i32.store offset=65748
        i32.const 0
        i32.const 0
        i32.load offset=65760
        i32.const 49
        i32.xor
        i32.const 16777619
        i32.mul
        i32.store offset=65760
        local.get $l2
        i32.const 3407873
        i32.add
        i32.const 62
        i32.store8
        i32.const 0
        i32.const 0
        i32.load offset=65748
        local.tee $l2
        i32.const 1
        i32.add
        i32.store offset=65748
        i32.const 0
        i32.const 0
        i32.load offset=65760
        i32.const 62
        i32.xor
        i32.const 16777619
        i32.mul
        i32.store offset=65760
        local.get $l2
        i32.const 3407873
        i32.add
        i32.const 60
        i32.store8
        i32.const 0
        i32.const 0
        i32.load offset=65748
        local.tee $l2
        i32.const 1
        i32.add
        i32.store offset=65748
        i32.const 0
        i32.const 0
        i32.load offset=65760
        i32.const 60
        i32.xor
        i32.const 16777619
        i32.mul
        i32.store offset=65760
        local.get $l2
        i32.const 3407873
        i32.add
        i32.const 112
        i32.store8
        i32.const 0
        i32.const 0
        i32.load offset=65748
        local.tee $l2
        i32.const 1
        i32.add
        i32.store offset=65748
        i32.const 0
        i32.const 0
        i32.load offset=65760
        i32.const 112
        i32.xor
        i32.const 16777619
        i32.mul
        i32.store offset=65760
        local.get $l2
        i32.const 3407873
        i32.add
        i32.const 32
        i32.store8
        i32.const 0
        i32.const 0
        i32.load offset=65748
        local.tee $l2
        i32.const 1
        i32.add
        i32.store offset=65748
        i32.const 0
        i32.const 0
        i32.load offset=65760
        i32.const 32
        i32.xor
        i32.const 16777619
        i32.mul
        i32.store offset=65760
        local.get $l2
        i32.const 3407873
        i32.add
        i32.const 100
        i32.store8
        i32.const 0
        i32.const 0
        i32.load offset=65748
        local.tee $l2
        i32.const 1
        i32.add
        i32.store offset=65748
        i32.const 0
        i32.const 0
        i32.load offset=65760
        i32.const 100
        i32.xor
        i32.const 16777619
        i32.mul
        i32.store offset=65760
        local.get $l2
        i32.const 3407873
        i32.add
        i32.const 97
        i32.store8
        i32.const 0
        i32.const 0
        i32.load offset=65748
        local.tee $l2
        i32.const 1
        i32.add
        i32.store offset=65748
        i32.const 0
        i32.const 0
        i32.load offset=65760
        i32.const 97
        i32.xor
        i32.const 16777619
        i32.mul
        i32.store offset=65760
        local.get $l2
        i32.const 3407873
        i32.add
        i32.const 116
        i32.store8
        i32.const 0
        i32.const 0
        i32.load offset=65748
        local.tee $l2
        i32.const 1
        i32.add
        i32.store offset=65748
        i32.const 0
        i32.const 0
        i32.load offset=65760
        i32.const 116
        i32.xor
        i32.const 16777619
        i32.mul
        i32.store offset=65760
        local.get $l2
        i32.const 3407873
        i32.add
        i32.const 97
        i32.store8
        i32.const 0
        i32.const 0
        i32.load offset=65748
        local.tee $l2
        i32.const 1
        i32.add
        i32.store offset=65748
        i32.const 0
        i32.const 0
        i32.load offset=65760
        i32.const 97
        i32.xor
        i32.const 16777619
        i32.mul
        i32.store offset=65760
        local.get $l2
        i32.const 3407873
        i32.add
        i32.const 45
        i32.store8
        i32.const 0
        i32.const 0
        i32.load offset=65748
        local.tee $l2
        i32.const 1
        i32.add
        i32.store offset=65748
        i32.const 0
        i32.const 0
        i32.load offset=65760
        i32.const 45
        i32.xor
        i32.const 16777619
        i32.mul
        i32.store offset=65760
        local.get $l2
        i32.const 3407873
        i32.add
        i32.const 117
        i32.store8
        i32.const 0
        i32.const 0
        i32.load offset=65748
        local.tee $l2
        i32.const 1
        i32.add
        i32.store offset=65748
        i32.const 0
        i32.const 0
        i32.load offset=65760
        i32.const 117
        i32.xor
        i32.const 16777619
        i32.mul
        i32.store offset=65760
        local.get $l2
        i32.const 3407873
        i32.add
        i32.const 115
        i32.store8
        i32.const 0
        i32.const 0
        i32.load offset=65748
        local.tee $l2
        i32.const 1
        i32.add
        i32.store offset=65748
        i32.const 0
        i32.const 0
        i32.load offset=65760
        i32.const 115
        i32.xor
        i32.const 16777619
        i32.mul
        i32.store offset=65760
        local.get $l2
        i32.const 3407873
        i32.add
        i32.const 101
        i32.store8
        i32.const 0
        i32.const 0
        i32.load offset=65748
        local.tee $l2
        i32.const 1
        i32.add
        i32.store offset=65748
        i32.const 0
        i32.const 0
        i32.load offset=65760
        i32.const 101
        i32.xor
        i32.const 16777619
        i32.mul
        i32.store offset=65760
        local.get $l2
        i32.const 3407873
        i32.add
        i32.const 114
        i32.store8
        i32.const 0
        i32.const 0
        i32.load offset=65748
        local.tee $l2
        i32.const 1
        i32.add
        i32.store offset=65748
        i32.const 0
        i32.const 0
        i32.load offset=65760
        i32.const 114
        i32.xor
        i32.const 16777619
        i32.mul
        i32.store offset=65760
        local.get $l2
        i32.const 3407873
        i32.add
        i32.const 61
        i32.store8
        i32.const 0
        i32.const 0
        i32.load offset=65748
        local.tee $l2
        i32.const 1
        i32.add
        i32.store offset=65748
        i32.const 0
        i32.const 0
        i32.load offset=65760
        i32.const 61
        i32.xor
        i32.const 16777619
        i32.mul
        i32.store offset=65760
        local.get $l2
        i32.const 3407873
        i32.add
        i32.const 34
        i32.store8
        i32.const 0
        i32.const 0
        i32.load offset=65748
        i32.const 1
        i32.add
        local.tee $l2
        i32.store offset=65748
        i32.const 0
        i32.const 0
        i32.load offset=65760
        i32.const 34
        i32.xor
        i32.const 16777619
        i32.mul
        i32.store offset=65760
        loop $L18
          local.get $l1
          i32.const 38
          i32.add
          local.get $l9
          i32.add
          local.get $l8
          local.get $l8
          i32.const 10
          i32.div_u
          local.tee $l10
          i32.const 10
          i32.mul
          i32.sub
          i32.const 48
          i32.or
          i32.store8
          local.get $l9
          i32.const 1
          i32.add
          local.set $l9
          local.get $l8
          i32.const 9
          i32.gt_u
          local.set $l19
          local.get $l10
          local.set $l8
          local.get $l19
          br_if $L18
        end
        block $B19
          block $B20
            local.get $l9
            i32.const -1
            i32.add
            local.tee $l8
            i32.const 1
            i32.and
            i32.eqz
            br_if $B20
            local.get $l9
            local.set $l8
            br $B19
          end
          local.get $l2
          local.get $l1
          i32.const 38
          i32.add
          local.get $l9
          i32.add
          i32.const -1
          i32.add
          i32.load8_u
          local.tee $l10
          i32.store8 offset=3407872
          i32.const 0
          i32.const 0
          i32.load offset=65748
          i32.const 1
          i32.add
          local.tee $l2
          i32.store offset=65748
          i32.const 0
          local.get $l10
          i32.const 0
          i32.load offset=65760
          i32.xor
          i32.const 16777619
          i32.mul
          i32.store offset=65760
        end
        block $B21
          local.get $l9
          i32.const 1
          i32.eq
          br_if $B21
          loop $L22
            local.get $l2
            local.get $l1
            i32.const 38
            i32.add
            local.get $l8
            i32.add
            local.tee $l9
            i32.const -1
            i32.add
            i32.load8_u
            local.tee $l10
            i32.store8 offset=3407872
            i32.const 0
            i32.const 0
            i32.load offset=65748
            local.tee $l2
            i32.const 1
            i32.add
            i32.store offset=65748
            i32.const 0
            local.get $l10
            i32.const 0
            i32.load offset=65760
            i32.xor
            i32.const 16777619
            i32.mul
            i32.store offset=65760
            local.get $l2
            i32.const 3407873
            i32.add
            local.get $l9
            i32.const -2
            i32.add
            i32.load8_u
            local.tee $l9
            i32.store8
            i32.const 0
            i32.const 0
            i32.load offset=65748
            i32.const 1
            i32.add
            local.tee $l2
            i32.store offset=65748
            i32.const 0
            local.get $l9
            i32.const 0
            i32.load offset=65760
            i32.xor
            i32.const 16777619
            i32.mul
            i32.store offset=65760
            local.get $l8
            i32.const -2
            i32.add
            local.tee $l8
            br_if $L22
          end
        end
        i32.const -26
        local.set $l8
        loop $L23
          local.get $l2
          local.get $l8
          i32.const 65717
          i32.add
          i32.load8_u
          local.tee $l9
          i32.store8 offset=3407872
          i32.const 0
          i32.const 0
          i32.load offset=65748
          local.tee $l2
          i32.const 1
          i32.add
          i32.store offset=65748
          i32.const 0
          local.get $l9
          i32.const 0
          i32.load offset=65760
          i32.xor
          i32.const 16777619
          i32.mul
          i32.store offset=65760
          local.get $l2
          i32.const 3407873
          i32.add
          local.get $l8
          i32.const 65718
          i32.add
          i32.load8_u
          local.tee $l9
          i32.store8
          i32.const 0
          i32.const 0
          i32.load offset=65748
          i32.const 1
          i32.add
          local.tee $l2
          i32.store offset=65748
          i32.const 0
          local.get $l9
          i32.const 0
          i32.load offset=65760
          i32.xor
          i32.const 16777619
          i32.mul
          i32.store offset=65760
          local.get $l8
          i32.const 2
          i32.add
          local.tee $l8
          br_if $L23
        end
        block $B24
          local.get $l15
          i32.eqz
          br_if $B24
          local.get $l16
          i32.const 3145728
          i32.add
          local.set $l9
          local.get $l15
          local.set $l10
          loop $L25
            block $B26
              block $B27
                block $B28
                  block $B29
                    block $B30
                      block $B31
                        block $B32
                          local.get $l9
                          i32.load8_u
                          local.tee $l8
                          i32.const -34
                          i32.add
                          br_table $B29 $B26 $B26 $B26 $B32 $B28 $B26 $B26 $B26 $B26 $B26 $B26 $B26 $B26 $B26 $B26 $B26 $B26 $B26 $B26 $B26 $B26 $B26 $B26 $B26 $B26 $B31 $B26 $B30 $B26
                        end
                        local.get $l2
                        i32.const 38
                        i32.store8 offset=3407872
                        i32.const 0
                        i32.const 0
                        i32.load offset=65748
                        local.tee $l2
                        i32.const 1
                        i32.add
                        i32.store offset=65748
                        i32.const 0
                        i32.const 0
                        i32.load offset=65760
                        i32.const 38
                        i32.xor
                        i32.const 16777619
                        i32.mul
                        i32.store offset=65760
                        local.get $l2
                        i32.const 3407873
                        i32.add
                        i32.const 97
                        i32.store8
                        i32.const 0
                        i32.const 0
                        i32.load offset=65748
                        local.tee $l2
                        i32.const 1
                        i32.add
                        i32.store offset=65748
                        i32.const 0
                        i32.const 0
                        i32.load offset=65760
                        i32.const 97
                        i32.xor
                        i32.const 16777619
                        i32.mul
                        i32.store offset=65760
                        local.get $l2
                        i32.const 3407873
                        i32.add
                        i32.const 109
                        i32.store8
                        i32.const 0
                        i32.const 0
                        i32.load offset=65748
                        local.tee $l2
                        i32.const 1
                        i32.add
                        i32.store offset=65748
                        i32.const 0
                        i32.const 0
                        i32.load offset=65760
                        i32.const 109
                        i32.xor
                        i32.const 16777619
                        i32.mul
                        i32.store offset=65760
                        local.get $l2
                        i32.const 3407873
                        i32.add
                        i32.const 112
                        i32.store8
                        i32.const 0
                        i32.const 0
                        i32.load offset=65748
                        i32.const 1
                        i32.add
                        local.tee $l2
                        i32.store offset=65748
                        i32.const 0
                        i32.const 0
                        i32.load offset=65760
                        i32.const 112
                        i32.xor
                        i32.const 16777619
                        i32.mul
                        i32.store offset=65760
                        br $B27
                      end
                      local.get $l2
                      i32.const 38
                      i32.store8 offset=3407872
                      i32.const 0
                      i32.const 0
                      i32.load offset=65748
                      local.tee $l2
                      i32.const 1
                      i32.add
                      i32.store offset=65748
                      i32.const 0
                      i32.const 0
                      i32.load offset=65760
                      i32.const 38
                      i32.xor
                      i32.const 16777619
                      i32.mul
                      i32.store offset=65760
                      local.get $l2
                      i32.const 3407873
                      i32.add
                      i32.const 108
                      i32.store8
                      i32.const 0
                      i32.const 0
                      i32.load offset=65748
                      local.tee $l2
                      i32.const 1
                      i32.add
                      i32.store offset=65748
                      i32.const 0
                      i32.const 0
                      i32.load offset=65760
                      i32.const 108
                      i32.xor
                      i32.const 16777619
                      i32.mul
                      i32.store offset=65760
                      local.get $l2
                      i32.const 3407873
                      i32.add
                      i32.const 116
                      i32.store8
                      i32.const 0
                      i32.const 0
                      i32.load offset=65748
                      i32.const 1
                      i32.add
                      local.tee $l2
                      i32.store offset=65748
                      i32.const 0
                      i32.const 0
                      i32.load offset=65760
                      i32.const 116
                      i32.xor
                      i32.const 16777619
                      i32.mul
                      i32.store offset=65760
                      br $B27
                    end
                    local.get $l2
                    i32.const 38
                    i32.store8 offset=3407872
                    i32.const 0
                    i32.const 0
                    i32.load offset=65748
                    local.tee $l2
                    i32.const 1
                    i32.add
                    i32.store offset=65748
                    i32.const 0
                    i32.const 0
                    i32.load offset=65760
                    i32.const 38
                    i32.xor
                    i32.const 16777619
                    i32.mul
                    i32.store offset=65760
                    local.get $l2
                    i32.const 3407873
                    i32.add
                    i32.const 103
                    i32.store8
                    i32.const 0
                    i32.const 0
                    i32.load offset=65748
                    local.tee $l2
                    i32.const 1
                    i32.add
                    i32.store offset=65748
                    i32.const 0
                    i32.const 0
                    i32.load offset=65760
                    i32.const 103
                    i32.xor
                    i32.const 16777619
                    i32.mul
                    i32.store offset=65760
                    local.get $l2
                    i32.const 3407873
                    i32.add
                    i32.const 116
                    i32.store8
                    i32.const 0
                    i32.const 0
                    i32.load offset=65748
                    i32.const 1
                    i32.add
                    local.tee $l2
                    i32.store offset=65748
                    i32.const 0
                    i32.const 0
                    i32.load offset=65760
                    i32.const 116
                    i32.xor
                    i32.const 16777619
                    i32.mul
                    i32.store offset=65760
                    br $B27
                  end
                  local.get $l2
                  i32.const 38
                  i32.store8 offset=3407872
                  i32.const 0
                  i32.const 0
                  i32.load offset=65748
                  local.tee $l2
                  i32.const 1
                  i32.add
                  i32.store offset=65748
                  i32.const 0
                  i32.const 0
                  i32.load offset=65760
                  i32.const 38
                  i32.xor
                  i32.const 16777619
                  i32.mul
                  i32.store offset=65760
                  local.get $l2
                  i32.const 3407873
                  i32.add
                  i32.const 113
                  i32.store8
                  i32.const 0
                  i32.const 0
                  i32.load offset=65748
                  local.tee $l2
                  i32.const 1
                  i32.add
                  i32.store offset=65748
                  i32.const 0
                  i32.const 0
                  i32.load offset=65760
                  i32.const 113
                  i32.xor
                  i32.const 16777619
                  i32.mul
                  i32.store offset=65760
                  local.get $l2
                  i32.const 3407873
                  i32.add
                  i32.const 117
                  i32.store8
                  i32.const 0
                  i32.const 0
                  i32.load offset=65748
                  local.tee $l2
                  i32.const 1
                  i32.add
                  i32.store offset=65748
                  i32.const 0
                  i32.const 0
                  i32.load offset=65760
                  i32.const 117
                  i32.xor
                  i32.const 16777619
                  i32.mul
                  i32.store offset=65760
                  local.get $l2
                  i32.const 3407873
                  i32.add
                  i32.const 111
                  i32.store8
                  i32.const 0
                  i32.const 0
                  i32.load offset=65748
                  local.tee $l2
                  i32.const 1
                  i32.add
                  i32.store offset=65748
                  i32.const 0
                  i32.const 0
                  i32.load offset=65760
                  i32.const 111
                  i32.xor
                  i32.const 16777619
                  i32.mul
                  i32.store offset=65760
                  local.get $l2
                  i32.const 3407873
                  i32.add
                  i32.const 116
                  i32.store8
                  i32.const 0
                  i32.const 0
                  i32.load offset=65748
                  i32.const 1
                  i32.add
                  local.tee $l2
                  i32.store offset=65748
                  i32.const 0
                  i32.const 0
                  i32.load offset=65760
                  i32.const 116
                  i32.xor
                  i32.const 16777619
                  i32.mul
                  i32.store offset=65760
                  br $B27
                end
                local.get $l2
                i32.const 38
                i32.store8 offset=3407872
                i32.const 0
                i32.const 0
                i32.load offset=65748
                local.tee $l2
                i32.const 1
                i32.add
                i32.store offset=65748
                i32.const 0
                i32.const 0
                i32.load offset=65760
                i32.const 38
                i32.xor
                i32.const 16777619
                i32.mul
                i32.store offset=65760
                local.get $l2
                i32.const 3407873
                i32.add
                i32.const 35
                i32.store8
                i32.const 0
                i32.const 0
                i32.load offset=65748
                local.tee $l2
                i32.const 1
                i32.add
                i32.store offset=65748
                i32.const 0
                i32.const 0
                i32.load offset=65760
                i32.const 35
                i32.xor
                i32.const 16777619
                i32.mul
                i32.store offset=65760
                local.get $l2
                i32.const 3407873
                i32.add
                i32.const 51
                i32.store8
                i32.const 0
                i32.const 0
                i32.load offset=65748
                local.tee $l2
                i32.const 1
                i32.add
                i32.store offset=65748
                i32.const 0
                i32.const 0
                i32.load offset=65760
                i32.const 51
                i32.xor
                i32.const 16777619
                i32.mul
                i32.store offset=65760
                local.get $l2
                i32.const 3407873
                i32.add
                i32.const 57
                i32.store8
                i32.const 0
                i32.const 0
                i32.load offset=65748
                i32.const 1
                i32.add
                local.tee $l2
                i32.store offset=65748
                i32.const 0
                i32.const 0
                i32.load offset=65760
                i32.const 57
                i32.xor
                i32.const 16777619
                i32.mul
                i32.store offset=65760
              end
              i32.const 59
              local.set $l8
            end
            local.get $l2
            local.get $l8
            i32.store8 offset=3407872
            i32.const 0
            i32.const 0
            i32.load offset=65748
            i32.const 1
            i32.add
            local.tee $l2
            i32.store offset=65748
            i32.const 0
            i32.const 0
            i32.load offset=65760
            local.get $l8
            i32.xor
            i32.const 16777619
            i32.mul
            i32.store offset=65760
            local.get $l9
            i32.const 1
            i32.add
            local.set $l9
            local.get $l10
            i32.const -1
            i32.add
            local.tee $l10
            br_if $L25
          end
        end
        local.get $l2
        i32.const 34
        i32.store8 offset=3407872
        i32.const 0
        i32.const 0
        i32.load offset=65748
        local.tee $l2
        i32.const 1
        i32.add
        i32.store offset=65748
        i32.const 0
        i32.const 0
        i32.load offset=65760
        i32.const 34
        i32.xor
        i32.const 16777619
        i32.mul
        i32.store offset=65760
        local.get $l2
        i32.const 3407873
        i32.add
        i32.const 62
        i32.store8
        i32.const 0
        i32.const 0
        i32.load offset=65748
        local.tee $l2
        i32.const 1
        i32.add
        i32.store offset=65748
        i32.const 0
        i32.const 0
        i32.load offset=65760
        i32.const 62
        i32.xor
        i32.const 16777619
        i32.mul
        i32.store offset=65760
        local.get $l2
        i32.const 3407873
        i32.add
        i32.const 72
        i32.store8
        i32.const 0
        i32.const 0
        i32.load offset=65748
        local.tee $l2
        i32.const 1
        i32.add
        i32.store offset=65748
        i32.const 0
        i32.const 0
        i32.load offset=65760
        i32.const 72
        i32.xor
        i32.const 16777619
        i32.mul
        i32.store offset=65760
        local.get $l2
        i32.const 3407873
        i32.add
        i32.const 101
        i32.store8
        i32.const 0
        i32.const 0
        i32.load offset=65748
        local.tee $l2
        i32.const 1
        i32.add
        i32.store offset=65748
        i32.const 0
        i32.const 0
        i32.load offset=65760
        i32.const 101
        i32.xor
        i32.const 16777619
        i32.mul
        i32.store offset=65760
        local.get $l2
        i32.const 3407873
        i32.add
        i32.const 108
        i32.store8
        i32.const 0
        i32.const 0
        i32.load offset=65748
        local.tee $l2
        i32.const 1
        i32.add
        i32.store offset=65748
        i32.const 0
        i32.const 0
        i32.load offset=65760
        i32.const 108
        i32.xor
        i32.const 16777619
        i32.mul
        i32.store offset=65760
        local.get $l2
        i32.const 3407873
        i32.add
        i32.const 108
        i32.store8
        i32.const 0
        i32.const 0
        i32.load offset=65748
        local.tee $l2
        i32.const 1
        i32.add
        i32.store offset=65748
        i32.const 0
        i32.const 0
        i32.load offset=65760
        i32.const 108
        i32.xor
        i32.const 16777619
        i32.mul
        i32.store offset=65760
        local.get $l2
        i32.const 3407873
        i32.add
        i32.const 111
        i32.store8
        i32.const 0
        i32.const 0
        i32.load offset=65748
        local.tee $l2
        i32.const 1
        i32.add
        i32.store offset=65748
        i32.const 0
        i32.const 0
        i32.load offset=65760
        i32.const 111
        i32.xor
        i32.const 16777619
        i32.mul
        i32.store offset=65760
        local.get $l2
        i32.const 3407873
        i32.add
        i32.const 44
        i32.store8
        i32.const 0
        i32.const 0
        i32.load offset=65748
        local.tee $l2
        i32.const 1
        i32.add
        i32.store offset=65748
        i32.const 0
        i32.const 0
        i32.load offset=65760
        i32.const 44
        i32.xor
        i32.const 16777619
        i32.mul
        i32.store offset=65760
        local.get $l2
        i32.const 3407873
        i32.add
        i32.const 32
        i32.store8
        i32.const 0
        i32.const 0
        i32.load offset=65748
        i32.const 1
        i32.add
        i32.store offset=65748
        i32.const 0
        i32.const 0
        i32.load offset=65760
        i32.const 32
        i32.xor
        i32.const 16777619
        i32.mul
        i32.store offset=65760
        local.get $l16
        local.get $l15
        call $write_text_escaped
        local.get $l3
        i32.const 2
        i32.add
        local.set $l3
        local.get $l5
        i32.const 1
        i32.add
        local.set $l5
        i32.const 0
        i32.load offset=65748
        local.set $l9
        i32.const -34
        local.set $l2
        loop $L33
          local.get $l9
          local.get $l2
          i32.const 65663
          i32.add
          i32.load8_u
          local.tee $l8
          i32.store8 offset=3407872
          i32.const 0
          i32.const 0
          i32.load offset=65748
          local.tee $l9
          i32.const 1
          i32.add
          i32.store offset=65748
          i32.const 0
          local.get $l8
          i32.const 0
          i32.load offset=65760
          i32.xor
          i32.const 16777619
          i32.mul
          i32.store offset=65760
          local.get $l9
          i32.const 3407873
          i32.add
          local.get $l2
          i32.const 65664
          i32.add
          i32.load8_u
          local.tee $l8
          i32.store8
          i32.const 0
          i32.const 0
          i32.load offset=65748
          i32.const 1
          i32.add
          local.tee $l9
          i32.store offset=65748
          i32.const 0
          local.get $l8
          i32.const 0
          i32.load offset=65760
          i32.xor
          i32.const 16777619
          i32.mul
          i32.store offset=65760
          local.get $l2
          i32.const 2
          i32.add
          local.tee $l2
          br_if $L33
        end
        i32.const 0
        local.set $l8
        local.get $l7
        local.set $l2
        loop $L34
          local.get $l1
          i32.const 38
          i32.add
          local.get $l8
          i32.add
          local.get $l2
          local.get $l2
          i32.const 10
          i32.div_u
          local.tee $l10
          i32.const 10
          i32.mul
          i32.sub
          i32.const 48
          i32.or
          i32.store8
          local.get $l8
          i32.const 1
          i32.add
          local.set $l8
          local.get $l2
          i32.const 9
          i32.gt_u
          local.set $l19
          local.get $l10
          local.set $l2
          local.get $l19
          br_if $L34
        end
        block $B35
          block $B36
            local.get $l8
            i32.const -1
            i32.add
            local.tee $l2
            i32.const 1
            i32.and
            i32.eqz
            br_if $B36
            local.get $l8
            local.set $l2
            br $B35
          end
          local.get $l9
          local.get $l1
          i32.const 38
          i32.add
          local.get $l8
          i32.add
          i32.const -1
          i32.add
          i32.load8_u
          local.tee $l10
          i32.store8 offset=3407872
          i32.const 0
          i32.const 0
          i32.load offset=65748
          i32.const 1
          i32.add
          local.tee $l9
          i32.store offset=65748
          i32.const 0
          local.get $l10
          i32.const 0
          i32.load offset=65760
          i32.xor
          i32.const 16777619
          i32.mul
          i32.store offset=65760
        end
        block $B37
          local.get $l8
          i32.const 1
          i32.eq
          br_if $B37
          loop $L38
            local.get $l9
            local.get $l1
            i32.const 38
            i32.add
            local.get $l2
            i32.add
            local.tee $l8
            i32.const -1
            i32.add
            i32.load8_u
            local.tee $l10
            i32.store8 offset=3407872
            i32.const 0
            i32.const 0
            i32.load offset=65748
            local.tee $l9
            i32.const 1
            i32.add
            i32.store offset=65748
            i32.const 0
            local.get $l10
            i32.const 0
            i32.load offset=65760
            i32.xor
            i32.const 16777619
            i32.mul
            i32.store offset=65760
            local.get $l9
            i32.const 3407873
            i32.add
            local.get $l8
            i32.const -2
            i32.add
            i32.load8_u
            local.tee $l8
            i32.store8
            i32.const 0
            i32.const 0
            i32.load offset=65748
            i32.const 1
            i32.add
            local.tee $l9
            i32.store offset=65748
            i32.const 0
            local.get $l8
            i32.const 0
            i32.load offset=65760
            i32.xor
            i32.const 16777619
            i32.mul
            i32.store offset=65760
            local.get $l2
            i32.const -2
            i32.add
            local.tee $l2
            br_if $L38
          end
        end
        local.get $l9
        i32.const 34
        i32.store8 offset=3407872
        i32.const 0
        local.set $l8
        i32.const 0
        i32.const 0
        i32.load offset=65748
        local.tee $l2
        i32.const 1
        i32.add
        i32.store offset=65748
        i32.const 0
        i32.const 0
        i32.load offset=65760
        i32.const 34
        i32.xor
        i32.const 16777619
        i32.mul
        i32.store offset=65760
        local.get $l2
        i32.const 3407873
        i32.add
        i32.const 62
        i32.store8
        i32.const 0
        i32.const 0
        i32.load offset=65748
        local.tee $l2
        i32.const 1
        i32.add
        i32.store offset=65748
        i32.const 0
        i32.const 0
        i32.load offset=65760
        i32.const 62
        i32.xor
        i32.const 16777619
        i32.mul
        i32.store offset=65760
        local.get $l2
        i32.const 3407873
        i32.add
        i32.const 85
        i32.store8
        i32.const 0
        i32.const 0
        i32.load offset=65748
        local.tee $l2
        i32.const 1
        i32.add
        i32.store offset=65748
        i32.const 0
        i32.const 0
        i32.load offset=65760
        i32.const 85
        i32.xor
        i32.const 16777619
        i32.mul
        i32.store offset=65760
        local.get $l2
        i32.const 3407873
        i32.add
        i32.const 83
        i32.store8
        i32.const 0
        i32.const 0
        i32.load offset=65748
        local.tee $l2
        i32.const 1
        i32.add
        i32.store offset=65748
        i32.const 0
        i32.const 0
        i32.load offset=65760
        i32.const 83
        i32.xor
        i32.const 16777619
        i32.mul
        i32.store offset=65760
        local.get $l2
        i32.const 3407873
        i32.add
        i32.const 68
        i32.store8
        i32.const 0
        i32.const 0
        i32.load offset=65748
        local.tee $l2
        i32.const 1
        i32.add
        i32.store offset=65748
        i32.const 0
        i32.const 0
        i32.load offset=65760
        i32.const 68
        i32.xor
        i32.const 16777619
        i32.mul
        i32.store offset=65760
        local.get $l2
        i32.const 3407873
        i32.add
        i32.const 32
        i32.store8
        i32.const 0
        i32.const 0
        i32.load offset=65748
        i32.const 1
        i32.add
        local.tee $l19
        i32.store offset=65748
        i32.const 0
        i32.const 0
        i32.load offset=65760
        i32.const 32
        i32.xor
        i32.const 16777619
        i32.mul
        i32.store offset=65760
        local.get $l7
        i32.const 100
        i32.div_u
        local.tee $l20
        local.set $l2
        loop $L39
          local.get $l1
          i32.const 38
          i32.add
          local.get $l8
          i32.add
          local.get $l2
          local.get $l2
          i32.const 10
          i32.div_u
          local.tee $l9
          i32.const 10
          i32.mul
          i32.sub
          i32.const 48
          i32.or
          i32.store8
          local.get $l8
          i32.const 1
          i32.add
          local.set $l8
          local.get $l2
          i32.const 9
          i32.gt_u
          local.set $l10
          local.get $l9
          local.set $l2
          local.get $l10
          br_if $L39
        end
        block $B40
          block $B41
            local.get $l8
            i32.const -1
            i32.add
            local.tee $l2
            i32.const 1
            i32.and
            i32.eqz
            br_if $B41
            local.get $l8
            local.set $l2
            br $B40
          end
          local.get $l19
          local.get $l1
          i32.const 38
          i32.add
          local.get $l8
          i32.add
          i32.const -1
          i32.add
          i32.load8_u
          local.tee $l9
          i32.store8 offset=3407872
          i32.const 0
          i32.const 0
          i32.load offset=65748
          i32.const 1
          i32.add
          local.tee $l19
          i32.store offset=65748
          i32.const 0
          local.get $l9
          i32.const 0
          i32.load offset=65760
          i32.xor
          i32.const 16777619
          i32.mul
          i32.store offset=65760
        end
        block $B42
          local.get $l8
          i32.const 1
          i32.eq
          br_if $B42
          loop $L43
            local.get $l19
            local.get $l1
            i32.const 38
            i32.add
            local.get $l2
            i32.add
            local.tee $l8
            i32.const -1
            i32.add
            i32.load8_u
            local.tee $l9
            i32.store8 offset=3407872
            i32.const 0
            i32.const 0
            i32.load offset=65748
            local.tee $l10
            i32.const 1
            i32.add
            i32.store offset=65748
            i32.const 0
            local.get $l9
            i32.const 0
            i32.load offset=65760
            i32.xor
            i32.const 16777619
            i32.mul
            i32.store offset=65760
            local.get $l10
            i32.const 3407873
            i32.add
            local.get $l8
            i32.const -2
            i32.add
            i32.load8_u
            local.tee $l8
            i32.store8
            i32.const 0
            i32.const 0
            i32.load offset=65748
            i32.const 1
            i32.add
            local.tee $l19
            i32.store offset=65748
            i32.const 0
            local.get $l8
            i32.const 0
            i32.load offset=65760
            i32.xor
            i32.const 16777619
            i32.mul
            i32.store offset=65760
            local.get $l2
            i32.const -2
            i32.add
            local.tee $l2
            br_if $L43
          end
        end
        local.get $l19
        i32.const 46
        i32.store8 offset=3407872
        i32.const 0
        local.set $l9
        i32.const 0
        i32.const 0
        i32.load offset=65748
        i32.const 1
        i32.add
        local.tee $l19
        i32.store offset=65748
        i32.const 0
        i32.const 0
        i32.load offset=65760
        i32.const 46
        i32.xor
        i32.const 16777619
        i32.mul
        i32.store offset=65760
        local.get $l7
        local.get $l20
        i32.const 100
        i32.mul
        i32.sub
        local.set $l10
        loop $L44
          local.get $l1
          i32.const 38
          i32.add
          local.get $l9
          local.tee $l8
          i32.add
          local.get $l10
          local.tee $l2
          local.get $l2
          i32.const 10
          i32.div_u
          local.tee $l10
          i32.const 10
          i32.mul
          i32.sub
          i32.const 48
          i32.or
          i32.store8
          local.get $l8
          i32.const 1
          i32.add
          local.set $l9
          local.get $l2
          i32.const 9
          i32.gt_u
          br_if $L44
          local.get $l8
          i32.eqz
          br_if $L44
        end
        block $B45
          block $B46
            local.get $l9
            i32.const -1
            i32.add
            local.tee $l2
            i32.const 1
            i32.and
            i32.eqz
            br_if $B46
            local.get $l9
            local.set $l2
            br $B45
          end
          local.get $l19
          local.get $l1
          i32.const 38
          i32.add
          local.get $l9
          i32.add
          i32.const -1
          i32.add
          i32.load8_u
          local.tee $l8
          i32.store8 offset=3407872
          i32.const 0
          i32.const 0
          i32.load offset=65748
          i32.const 1
          i32.add
          local.tee $l19
          i32.store offset=65748
          i32.const 0
          local.get $l8
          i32.const 0
          i32.load offset=65760
          i32.xor
          i32.const 16777619
          i32.mul
          i32.store offset=65760
        end
        block $B47
          local.get $l9
          i32.const 1
          i32.eq
          br_if $B47
          loop $L48
            local.get $l19
            local.get $l1
            i32.const 38
            i32.add
            local.get $l2
            i32.add
            local.tee $l8
            i32.const -1
            i32.add
            i32.load8_u
            local.tee $l9
            i32.store8 offset=3407872
            i32.const 0
            i32.const 0
            i32.load offset=65748
            local.tee $l10
            i32.const 1
            i32.add
            i32.store offset=65748
            i32.const 0
            local.get $l9
            i32.const 0
            i32.load offset=65760
            i32.xor
            i32.const 16777619
            i32.mul
            i32.store offset=65760
            local.get $l10
            i32.const 3407873
            i32.add
            local.get $l8
            i32.const -2
            i32.add
            i32.load8_u
            local.tee $l8
            i32.store8
            i32.const 0
            i32.const 0
            i32.load offset=65748
            i32.const 1
            i32.add
            local.tee $l19
            i32.store offset=65748
            i32.const 0
            local.get $l8
            i32.const 0
            i32.load offset=65760
            i32.xor
            i32.const 16777619
            i32.mul
            i32.store offset=65760
            local.get $l2
            i32.const -2
            i32.add
            local.tee $l2
            br_if $L48
          end
        end
        local.get $l19
        i32.const 60
        i32.store8 offset=3407872
        i32.const 0
        i32.const 0
        i32.load offset=65748
        local.tee $l2
        i32.const 1
        i32.add
        i32.store offset=65748
        i32.const 0
        i32.const 0
        i32.load offset=65760
        i32.const 60
        i32.xor
        i32.const 16777619
        i32.mul
        i32.store offset=65760
        local.get $l2
        i32.const 3407873
        i32.add
        i32.const 47
        i32.store8
        i32.const 0
        i32.const 0
        i32.load offset=65748
        local.tee $l2
        i32.const 1
        i32.add
        i32.store offset=65748
        i32.const 0
        i32.const 0
        i32.load offset=65760
        i32.const 47
        i32.xor
        i32.const 16777619
        i32.mul
        i32.store offset=65760
        local.get $l2
        i32.const 3407873
        i32.add
        i32.const 112
        i32.store8
        i32.const 0
        i32.const 0
        i32.load offset=65748
        local.tee $l2
        i32.const 1
        i32.add
        i32.store offset=65748
        i32.const 0
        i32.const 0
        i32.load offset=65760
        i32.const 112
        i32.xor
        i32.const 16777619
        i32.mul
        i32.store offset=65760
        local.get $l2
        i32.const 3407873
        i32.add
        i32.const 62
        i32.store8
        i32.const 0
        i32.const 0
        i32.load offset=65748
        local.tee $l2
        i32.const 1
        i32.add
        i32.store offset=65748
        i32.const 0
        i32.const 0
        i32.load offset=65760
        i32.const 62
        i32.xor
        i32.const 16777619
        i32.mul
        i32.store offset=65760
        local.get $l2
        i32.const 3407873
        i32.add
        i32.const 60
        i32.store8
        i32.const 0
        i32.const 0
        i32.load offset=65748
        local.tee $l2
        i32.const 1
        i32.add
        i32.store offset=65748
        i32.const 0
        i32.const 0
        i32.load offset=65760
        i32.const 60
        i32.xor
        i32.const 16777619
        i32.mul
        i32.store offset=65760
        local.get $l2
        i32.const 3407873
        i32.add
        i32.const 97
        i32.store8
        i32.const 0
        i32.const 0
        i32.load offset=65748
        local.tee $l2
        i32.const 1
        i32.add
        i32.store offset=65748
        i32.const 0
        i32.const 0
        i32.load offset=65760
        i32.const 97
        i32.xor
        i32.const 16777619
        i32.mul
        i32.store offset=65760
        local.get $l2
        i32.const 3407873
        i32.add
        i32.const 32
        i32.store8
        i32.const 0
        i32.const 0
        i32.load offset=65748
        local.tee $l2
        i32.const 1
        i32.add
        i32.store offset=65748
        i32.const 0
        i32.const 0
        i32.load offset=65760
        i32.const 32
        i32.xor
        i32.const 16777619
        i32.mul
        i32.store offset=65760
        local.get $l2
        i32.const 3407873
        i32.add
        i32.const 104
        i32.store8
        i32.const 0
        i32.const 0
        i32.load offset=65748
        local.tee $l2
        i32.const 1
        i32.add
        i32.store offset=65748
        i32.const 0
        i32.const 0
        i32.load offset=65760
        i32.const 104
        i32.xor
        i32.const 16777619
        i32.mul
        i32.store offset=65760
        local.get $l2
        i32.const 3407873
        i32.add
        i32.const 114
        i32.store8
        i32.const 0
        i32.const 0
        i32.load offset=65748
        local.tee $l2
        i32.const 1
        i32.add
        i32.store offset=65748
        i32.const 0
        i32.const 0
        i32.load offset=65760
        i32.const 114
        i32.xor
        i32.const 16777619
        i32.mul
        i32.store offset=65760
        local.get $l2
        i32.const 3407873
        i32.add
        i32.const 101
        i32.store8
        i32.const 0
        i32.const 0
        i32.load offset=65748
        local.tee $l2
        i32.const 1
        i32.add
        i32.store offset=65748
        i32.const 0
        i32.const 0
        i32.load offset=65760
        i32.const 101
        i32.xor
        i32.const 16777619
        i32.mul
        i32.store offset=65760
        local.get $l2
        i32.const 3407873
        i32.add
        i32.const 102
        i32.store8
        i32.const 0
        i32.const 0
        i32.load offset=65748
        local.tee $l2
        i32.const 1
        i32.add
        i32.store offset=65748
        i32.const 0
        i32.const 0
        i32.load offset=65760
        i32.const 102
        i32.xor
        i32.const 16777619
        i32.mul
        i32.store offset=65760
        local.get $l2
        i32.const 3407873
        i32.add
        i32.const 61
        i32.store8
        i32.const 0
        i32.const 0
        i32.load offset=65748
        local.tee $l2
        i32.const 1
        i32.add
        i32.store offset=65748
        i32.const 0
        i32.const 0
        i32.load offset=65760
        i32.const 61
        i32.xor
        i32.const 16777619
        i32.mul
        i32.store offset=65760
        local.get $l2
        i32.const 3407873
        i32.add
        i32.const 34
        i32.store8
        i32.const 0
        i32.const 0
        i32.load offset=65748
        local.tee $l2
        i32.const 1
        i32.add
        i32.store offset=65748
        i32.const 0
        i32.const 0
        i32.load offset=65760
        i32.const 34
        i32.xor
        i32.const 16777619
        i32.mul
        i32.store offset=65760
        local.get $l2
        i32.const 3407873
        i32.add
        i32.const 47
        i32.store8
        i32.const 0
        i32.const 0
        i32.load offset=65748
        local.tee $l2
        i32.const 1
        i32.add
        i32.store offset=65748
        i32.const 0
        i32.const 0
        i32.load offset=65760
        i32.const 47
        i32.xor
        i32.const 16777619
        i32.mul
        i32.store offset=65760
        local.get $l2
        i32.const 3407873
        i32.add
        i32.const 99
        i32.store8
        i32.const 0
        i32.const 0
        i32.load offset=65748
        local.tee $l2
        i32.const 1
        i32.add
        i32.store offset=65748
        i32.const 0
        i32.const 0
        i32.load offset=65760
        i32.const 99
        i32.xor
        i32.const 16777619
        i32.mul
        i32.store offset=65760
        local.get $l2
        i32.const 3407873
        i32.add
        i32.const 97
        i32.store8
        i32.const 0
        i32.const 0
        i32.load offset=65748
        local.tee $l2
        i32.const 1
        i32.add
        i32.store offset=65748
        i32.const 0
        i32.const 0
        i32.load offset=65760
        i32.const 97
        i32.xor
        i32.const 16777619
        i32.mul
        i32.store offset=65760
        local.get $l2
        i32.const 3407873
        i32.add
        i32.const 116
        i32.store8
        i32.const 0
        i32.const 0
        i32.load offset=65748
        local.tee $l2
        i32.const 1
        i32.add
        i32.store offset=65748
        i32.const 0
        i32.const 0
        i32.load offset=65760
        i32.const 116
        i32.xor
        i32.const 16777619
        i32.mul
        i32.store offset=65760
        local.get $l2
        i32.const 3407873
        i32.add
        i32.const 97
        i32.store8
        i32.const 0
        i32.const 0
        i32.load offset=65748
        local.tee $l2
        i32.const 1
        i32.add
        i32.store offset=65748
        i32.const 0
        i32.const 0
        i32.load offset=65760
        i32.const 97
        i32.xor
        i32.const 16777619
        i32.mul
        i32.store offset=65760
        local.get $l2
        i32.const 3407873
        i32.add
        i32.const 108
        i32.store8
        i32.const 0
        i32.const 0
        i32.load offset=65748
        local.tee $l2
        i32.const 1
        i32.add
        i32.store offset=65748
        i32.const 0
        i32.const 0
        i32.load offset=65760
        i32.const 108
        i32.xor
        i32.const 16777619
        i32.mul
        i32.store offset=65760
        local.get $l2
        i32.const 3407873
        i32.add
        i32.const 111
        i32.store8
        i32.const 0
        i32.const 0
        i32.load offset=65748
        local.tee $l2
        i32.const 1
        i32.add
        i32.store offset=65748
        i32.const 0
        i32.const 0
        i32.load offset=65760
        i32.const 111
        i32.xor
        i32.const 16777619
        i32.mul
        i32.store offset=65760
        local.get $l2
        i32.const 3407873
        i32.add
        i32.const 103
        i32.store8
        i32.const 0
        i32.const 0
        i32.load offset=65748
        local.tee $l2
        i32.const 1
        i32.add
        i32.store offset=65748
        i32.const 0
        i32.const 0
        i32.load offset=65760
        i32.const 103
        i32.xor
        i32.const 16777619
        i32.mul
        i32.store offset=65760
        local.get $l2
        i32.const 3407873
        i32.add
        i32.const 47
        i32.store8
        i32.const 0
        i32.const 0
        i32.load offset=65748
        i32.const 1
        i32.add
        i32.store offset=65748
        i32.const 0
        i32.const 0
        i32.load offset=65760
        i32.const 47
        i32.xor
        i32.const 16777619
        i32.mul
        i32.store offset=65760
        local.get $l14
        local.get $l13
        call $write_url_component
        i32.const 0
        i32.load offset=65748
        i32.const 63
        i32.store8 offset=3407872
        i32.const 0
        i32.const 0
        i32.load offset=65748
        local.tee $l2
        i32.const 1
        i32.add
        i32.store offset=65748
        i32.const 0
        i32.const 0
        i32.load offset=65760
        i32.const 63
        i32.xor
        i32.const 16777619
        i32.mul
        i32.store offset=65760
        local.get $l2
        i32.const 3407873
        i32.add
        i32.const 102
        i32.store8
        i32.const 0
        i32.const 0
        i32.load offset=65748
        local.tee $l2
        i32.const 1
        i32.add
        i32.store offset=65748
        i32.const 0
        i32.const 0
        i32.load offset=65760
        i32.const 102
        i32.xor
        i32.const 16777619
        i32.mul
        i32.store offset=65760
        local.get $l2
        i32.const 3407873
        i32.add
        i32.const 111
        i32.store8
        i32.const 0
        i32.const 0
        i32.load offset=65748
        local.tee $l2
        i32.const 1
        i32.add
        i32.store offset=65748
        i32.const 0
        i32.const 0
        i32.load offset=65760
        i32.const 111
        i32.xor
        i32.const 16777619
        i32.mul
        i32.store offset=65760
        local.get $l2
        i32.const 3407873
        i32.add
        i32.const 114
        i32.store8
        i32.const 0
        i32.const 0
        i32.load offset=65748
        local.tee $l2
        i32.const 1
        i32.add
        i32.store offset=65748
        i32.const 0
        i32.const 0
        i32.load offset=65760
        i32.const 114
        i32.xor
        i32.const 16777619
        i32.mul
        i32.store offset=65760
        local.get $l2
        i32.const 3407873
        i32.add
        i32.const 61
        i32.store8
        i32.const 0
        i32.const 0
        i32.load offset=65748
        i32.const 1
        i32.add
        i32.store offset=65748
        i32.const 0
        i32.const 0
        i32.load offset=65760
        i32.const 61
        i32.xor
        i32.const 16777619
        i32.mul
        i32.store offset=65760
        local.get $l16
        local.get $l15
        call $write_url_component
        local.get $l4
        i32.const 4
        i32.add
        local.set $l4
        i32.const 0
        i32.load offset=65748
        local.set $l8
        i32.const -26
        local.set $l2
        loop $L49
          local.get $l8
          local.get $l2
          i32.const 65690
          i32.add
          i32.load8_u
          local.tee $l9
          i32.store8 offset=3407872
          i32.const 0
          i32.const 0
          i32.load offset=65748
          local.tee $l8
          i32.const 1
          i32.add
          i32.store offset=65748
          i32.const 0
          local.get $l9
          i32.const 0
          i32.load offset=65760
          i32.xor
          i32.const 16777619
          i32.mul
          i32.store offset=65760
          local.get $l8
          i32.const 3407873
          i32.add
          local.get $l2
          i32.const 65691
          i32.add
          i32.load8_u
          local.tee $l9
          i32.store8
          i32.const 0
          i32.const 0
          i32.load offset=65748
          i32.const 1
          i32.add
          local.tee $l8
          i32.store offset=65748
          i32.const 0
          local.get $l9
          i32.const 0
          i32.load offset=65760
          i32.xor
          i32.const 16777619
          i32.mul
          i32.store offset=65760
          local.get $l2
          i32.const 2
          i32.add
          local.tee $l2
          br_if $L49
        end
        i32.const -6
        local.set $l2
        local.get $l6
        call $write_date
        i32.eqz
        br_if $B0
        i32.const 0
        i32.load offset=65748
        i32.const 34
        i32.store8 offset=3407872
        i32.const 0
        i32.const 0
        i32.load offset=65748
        local.tee $l8
        i32.const 1
        i32.add
        i32.store offset=65748
        i32.const 0
        i32.const 0
        i32.load offset=65760
        i32.const 34
        i32.xor
        i32.const 16777619
        i32.mul
        i32.store offset=65760
        local.get $l8
        i32.const 3407873
        i32.add
        i32.const 62
        i32.store8
        i32.const 0
        i32.const 0
        i32.load offset=65748
        i32.const 1
        i32.add
        i32.store offset=65748
        i32.const 0
        i32.const 0
        i32.load offset=65760
        i32.const 62
        i32.xor
        i32.const 16777619
        i32.mul
        i32.store offset=65760
        local.get $l6
        call $write_date
        i32.eqz
        br_if $B0
        i32.const 0
        i32.load offset=65748
        local.set $l8
        i32.const -30
        local.set $l2
        block $B50
          loop $L51
            local.get $l8
            local.get $l2
            i32.const 65566
            i32.add
            i32.load8_u
            local.tee $l9
            i32.store8 offset=3407872
            i32.const 0
            i32.const 0
            i32.load offset=65748
            local.tee $l10
            i32.const 1
            i32.add
            local.tee $l8
            i32.store offset=65748
            i32.const 0
            local.get $l9
            i32.const 0
            i32.load offset=65760
            i32.xor
            i32.const 16777619
            i32.mul
            i32.store offset=65760
            local.get $l2
            i32.eqz
            br_if $B50
            local.get $l8
            local.get $l2
            i32.const 65567
            i32.add
            i32.load8_u
            local.tee $l9
            i32.store8 offset=3407872
            i32.const 0
            i32.const 0
            i32.load offset=65748
            i32.const 1
            i32.add
            local.tee $l8
            i32.store offset=65748
            i32.const 0
            local.get $l9
            i32.const 0
            i32.load offset=65760
            i32.xor
            i32.const 16777619
            i32.mul
            i32.store offset=65760
            local.get $l2
            i32.const 2
            i32.add
            local.set $l2
            br $L51
          end
        end
        local.get $l11
        local.get $l10
        local.get $l12
        i32.sub
        i32.store offset=3407872 align=1
        local.get $l5
        i32.const 1000
        i32.ne
        br_if $L4
      end
      i32.const -7
      local.set $l2
      i32.const 0
      i32.load8_u offset=65756
      br_if $B0
      i32.const 0
      i32.load offset=65752
      local.get $p0
      i32.ne
      br_if $B0
      i32.const -2128831035
      local.set $l8
      i32.const 0
      local.set $l2
      i32.const 0
      i32.const -2128831035
      i32.store offset=65760
      block $B52
        i32.const 0
        i32.load offset=65748
        local.tee $l10
        i32.eqz
        br_if $B52
        local.get $l10
        i32.const 3
        i32.and
        local.set $l9
        block $B53
          local.get $l10
          i32.const 4
          i32.lt_u
          br_if $B53
          local.get $l10
          i32.const -4
          i32.and
          local.set $l10
          i32.const -2128831035
          local.set $l8
          i32.const 0
          local.set $l2
          loop $L54
            i32.const 0
            local.get $l8
            local.get $l2
            i32.const 3407872
            i32.add
            i32.load8_u
            i32.xor
            i32.const 16777619
            i32.mul
            local.tee $l8
            i32.store offset=65760
            i32.const 0
            local.get $l8
            local.get $l2
            i32.const 3407873
            i32.add
            i32.load8_u
            i32.xor
            i32.const 16777619
            i32.mul
            local.tee $l8
            i32.store offset=65760
            i32.const 0
            local.get $l8
            local.get $l2
            i32.const 3407874
            i32.add
            i32.load8_u
            i32.xor
            i32.const 16777619
            i32.mul
            local.tee $l8
            i32.store offset=65760
            i32.const 0
            local.get $l8
            local.get $l2
            i32.const 3407875
            i32.add
            i32.load8_u
            i32.xor
            i32.const 16777619
            i32.mul
            local.tee $l8
            i32.store offset=65760
            local.get $l10
            local.get $l2
            i32.const 4
            i32.add
            local.tee $l2
            i32.ne
            br_if $L54
          end
          local.get $l9
          i32.eqz
          br_if $B52
        end
        local.get $l2
        i32.const 3407872
        i32.add
        local.set $l2
        loop $L55
          i32.const 0
          local.get $l8
          local.get $l2
          i32.load8_u
          i32.xor
          i32.const 16777619
          i32.mul
          local.tee $l8
          i32.store offset=65760
          local.get $l2
          i32.const 1
          i32.add
          local.set $l2
          local.get $l9
          i32.const -1
          i32.add
          local.tee $l9
          br_if $L55
        end
      end
      i32.const 0
      local.set $l2
      i32.const 0
      i32.const 1000
      i32.store offset=3932160
      i32.const 0
      i32.const 7000
      i32.store offset=3932164
      i32.const 0
      i32.const 23000
      i32.store offset=3932168
      i32.const 0
      local.get $l3
      i32.store offset=3932172
      i32.const 0
      local.get $l5
      i32.store offset=3932176
      i32.const 0
      local.get $l3
      i32.store offset=3932180
      i32.const 0
      local.get $l4
      i32.store offset=3932184
      i32.const 0
      local.get $l3
      i32.store offset=3932188
      i32.const 0
      local.get $p0
      i32.store offset=3932192
      i32.const 0
      i32.const 0
      i32.load offset=65748
      i32.store offset=3932196
      i32.const 0
      i32.const 0
      i32.load offset=65760
      i32.store offset=3932200
      i32.const 0
      i32.const 0
      i32.store offset=3932204
    end
    local.get $l1
    i32.const 48
    i32.add
    global.set $__stack_pointer
    local.get $l2)
  (func $parse_string (type $t2) (param $p0 i32) (param $p1 i32) (param $p2 i32)
    (local $l3 i32) (local $l4 i32) (local $l5 i32) (local $l6 i32) (local $l7 i32) (local $l8 i32) (local $l9 i32) (local $l10 i32) (local $l11 i32)
    block $B0
      block $B1
        i32.const 0
        i32.load8_u offset=65756
        br_if $B1
        local.get $p0
        i32.const 0
        i32.load offset=65752
        local.tee $l3
        i32.lt_u
        br_if $B1
        local.get $p0
        local.get $l3
        i32.sub
        i32.const 4
        i32.lt_u
        br_if $B1
        local.get $l3
        i32.const 3145728
        i32.add
        i32.load align=1
        local.set $l4
        i32.const 0
        local.get $l3
        i32.const 4
        i32.add
        i32.store offset=65752
        local.get $l4
        i32.const 65536
        i32.gt_u
        br_if $B1
        local.get $p0
        i32.const 0
        i32.load offset=65752
        local.tee $l5
        i32.lt_u
        br_if $B1
        local.get $l4
        local.get $p0
        local.get $l5
        i32.sub
        i32.le_u
        br_if $B0
      end
      i32.const 0
      i32.const 1
      i32.store8 offset=65756
      return
    end
    block $B2
      block $B3
        local.get $l4
        i32.eqz
        br_if $B3
        local.get $l5
        i32.const 3145728
        i32.add
        local.set $l6
        i32.const 0
        local.set $p0
        loop $L4
          local.get $p0
          i32.const 1
          i32.add
          local.set $l3
          block $B5
            block $B6
              local.get $l6
              local.get $p0
              i32.add
              i32.load8_s
              local.tee $l7
              i32.const -1
              i32.le_s
              br_if $B6
              local.get $l3
              local.set $p0
              br $B5
            end
            block $B7
              block $B8
                local.get $l7
                i32.const 255
                i32.and
                local.tee $l8
                i32.const 224
                i32.and
                i32.const 192
                i32.ne
                br_if $B8
                i32.const 128
                local.set $l9
                i32.const 1
                local.set $l7
                i32.const 31
                local.set $l10
                br $B7
              end
              block $B9
                local.get $l8
                i32.const 240
                i32.and
                i32.const 224
                i32.ne
                br_if $B9
                i32.const 2048
                local.set $l9
                i32.const 2
                local.set $l7
                i32.const 15
                local.set $l10
                br $B7
              end
              local.get $l8
              i32.const 248
              i32.and
              i32.const 240
              i32.ne
              br_if $B2
              i32.const 65536
              local.set $l9
              i32.const 3
              local.set $l7
              i32.const 7
              local.set $l10
            end
            local.get $l7
            local.get $l3
            i32.add
            local.tee $l7
            local.get $l4
            i32.gt_u
            br_if $B2
            local.get $l6
            local.get $l3
            i32.add
            i32.load8_u
            local.tee $l3
            i32.const 192
            i32.and
            i32.const 128
            i32.ne
            br_if $B2
            local.get $l3
            i32.const 63
            i32.and
            local.get $l10
            local.get $l8
            i32.and
            local.tee $l3
            i32.const 6
            i32.shl
            local.tee $l8
            i32.or
            local.set $l10
            block $B10
              block $B11
                local.get $p0
                i32.const 2
                i32.add
                local.tee $l11
                local.get $l7
                i32.ne
                br_if $B11
                local.get $l10
                local.set $l11
                br $B10
              end
              local.get $l6
              local.get $l11
              i32.add
              i32.load8_u
              local.tee $l3
              i32.const 192
              i32.and
              i32.const 128
              i32.ne
              br_if $B2
              local.get $l3
              i32.const 63
              i32.and
              local.get $l10
              i32.const 6
              i32.shl
              local.tee $l8
              i32.or
              local.set $l3
              block $B12
                local.get $p0
                i32.const 3
                i32.add
                local.tee $p0
                local.get $l7
                i32.ne
                br_if $B12
                local.get $l3
                local.set $l11
                local.get $l10
                local.set $l3
                br $B10
              end
              local.get $l6
              local.get $p0
              i32.add
              i32.load8_u
              local.tee $p0
              i32.const 192
              i32.and
              i32.const 128
              i32.ne
              br_if $B2
              local.get $p0
              i32.const 63
              i32.and
              local.get $l3
              i32.const 6
              i32.shl
              local.tee $l8
              i32.or
              local.set $l11
            end
            local.get $l3
            i32.const 32736
            i32.and
            i32.const 864
            i32.eq
            br_if $B2
            local.get $l8
            i32.const 1114111
            i32.gt_u
            br_if $B2
            local.get $l7
            local.set $p0
            local.get $l11
            local.get $l9
            i32.lt_u
            br_if $B2
          end
          local.get $p0
          local.get $l4
          i32.lt_u
          br_if $L4
        end
      end
      local.get $p1
      local.get $l5
      i32.store
      local.get $p2
      local.get $l4
      i32.store
      i32.const 0
      local.get $l5
      local.get $l4
      i32.add
      i32.store offset=65752
      return
    end
    i32.const 0
    i32.const 1
    i32.store8 offset=65756)
  (func $write_text_escaped (type $t3) (param $p0 i32) (param $p1 i32)
    (local $l2 i32) (local $l3 i32)
    block $B0
      local.get $p1
      i32.eqz
      br_if $B0
      local.get $p0
      i32.const 3145728
      i32.add
      local.set $l2
      loop $L1
        block $B2
          block $B3
            block $B4
              block $B5
                block $B6
                  local.get $l2
                  i32.load8_u
                  local.tee $p0
                  i32.const -38
                  i32.add
                  br_table $B6 $B3 $B3 $B3 $B3 $B3 $B3 $B3 $B3 $B3 $B3 $B3 $B3 $B3 $B3 $B3 $B3 $B3 $B3 $B3 $B3 $B3 $B5 $B3 $B4 $B3
                end
                i32.const 0
                i32.load offset=65748
                i32.const 38
                i32.store8 offset=3407872
                i32.const 0
                i32.const 0
                i32.load offset=65748
                local.tee $p0
                i32.const 1
                i32.add
                i32.store offset=65748
                i32.const 0
                i32.const 0
                i32.load offset=65760
                i32.const 38
                i32.xor
                i32.const 16777619
                i32.mul
                i32.store offset=65760
                local.get $p0
                i32.const 3407873
                i32.add
                i32.const 97
                i32.store8
                i32.const 0
                i32.const 0
                i32.load offset=65748
                local.tee $p0
                i32.const 1
                i32.add
                i32.store offset=65748
                i32.const 0
                i32.const 0
                i32.load offset=65760
                i32.const 97
                i32.xor
                i32.const 16777619
                i32.mul
                i32.store offset=65760
                local.get $p0
                i32.const 3407873
                i32.add
                i32.const 109
                i32.store8
                i32.const 0
                i32.const 0
                i32.load offset=65748
                local.tee $p0
                i32.const 1
                i32.add
                i32.store offset=65748
                i32.const 0
                i32.const 0
                i32.load offset=65760
                i32.const 109
                i32.xor
                i32.const 16777619
                i32.mul
                i32.store offset=65760
                local.get $p0
                i32.const 3407873
                i32.add
                i32.const 112
                i32.store8
                i32.const 0
                i32.const 0
                i32.load offset=65748
                i32.const 1
                i32.add
                local.tee $l3
                i32.store offset=65748
                i32.const 0
                i32.const 0
                i32.load offset=65760
                i32.const 112
                i32.xor
                i32.const 16777619
                i32.mul
                i32.store offset=65760
                i32.const 59
                local.set $p0
                br $B2
              end
              i32.const 0
              i32.load offset=65748
              i32.const 38
              i32.store8 offset=3407872
              i32.const 0
              i32.const 0
              i32.load offset=65748
              local.tee $p0
              i32.const 1
              i32.add
              i32.store offset=65748
              i32.const 0
              i32.const 0
              i32.load offset=65760
              i32.const 38
              i32.xor
              i32.const 16777619
              i32.mul
              i32.store offset=65760
              local.get $p0
              i32.const 3407873
              i32.add
              i32.const 108
              i32.store8
              i32.const 0
              i32.const 0
              i32.load offset=65748
              local.tee $p0
              i32.const 1
              i32.add
              i32.store offset=65748
              i32.const 0
              i32.const 0
              i32.load offset=65760
              i32.const 108
              i32.xor
              i32.const 16777619
              i32.mul
              i32.store offset=65760
              local.get $p0
              i32.const 3407873
              i32.add
              i32.const 116
              i32.store8
              i32.const 0
              i32.const 0
              i32.load offset=65748
              i32.const 1
              i32.add
              local.tee $l3
              i32.store offset=65748
              i32.const 0
              i32.const 0
              i32.load offset=65760
              i32.const 116
              i32.xor
              i32.const 16777619
              i32.mul
              i32.store offset=65760
              i32.const 59
              local.set $p0
              br $B2
            end
            i32.const 0
            i32.load offset=65748
            i32.const 38
            i32.store8 offset=3407872
            i32.const 0
            i32.const 0
            i32.load offset=65748
            local.tee $p0
            i32.const 1
            i32.add
            i32.store offset=65748
            i32.const 0
            i32.const 0
            i32.load offset=65760
            i32.const 38
            i32.xor
            i32.const 16777619
            i32.mul
            i32.store offset=65760
            local.get $p0
            i32.const 3407873
            i32.add
            i32.const 103
            i32.store8
            i32.const 0
            i32.const 0
            i32.load offset=65748
            local.tee $p0
            i32.const 1
            i32.add
            i32.store offset=65748
            i32.const 0
            i32.const 0
            i32.load offset=65760
            i32.const 103
            i32.xor
            i32.const 16777619
            i32.mul
            i32.store offset=65760
            local.get $p0
            i32.const 3407873
            i32.add
            i32.const 116
            i32.store8
            i32.const 0
            i32.const 0
            i32.load offset=65748
            i32.const 1
            i32.add
            local.tee $l3
            i32.store offset=65748
            i32.const 0
            i32.const 0
            i32.load offset=65760
            i32.const 116
            i32.xor
            i32.const 16777619
            i32.mul
            i32.store offset=65760
            i32.const 59
            local.set $p0
            br $B2
          end
          i32.const 0
          i32.load offset=65748
          local.set $l3
        end
        local.get $l3
        local.get $p0
        i32.store8 offset=3407872
        i32.const 0
        i32.const 0
        i32.load offset=65748
        i32.const 1
        i32.add
        i32.store offset=65748
        i32.const 0
        i32.const 0
        i32.load offset=65760
        local.get $p0
        i32.xor
        i32.const 16777619
        i32.mul
        i32.store offset=65760
        local.get $l2
        i32.const 1
        i32.add
        local.set $l2
        local.get $p1
        i32.const -1
        i32.add
        local.tee $p1
        br_if $L1
      end
    end)
  (func $write_url_component (type $t3) (param $p0 i32) (param $p1 i32)
    (local $l2 i32) (local $l3 i32) (local $l4 i32)
    block $B0
      local.get $p1
      i32.eqz
      br_if $B0
      local.get $p0
      i32.const 3145728
      i32.add
      local.set $l2
      loop $L1
        block $B2
          block $B3
            block $B4
              local.get $l2
              i32.load8_u
              local.tee $p0
              i32.const -48
              i32.add
              i32.const 255
              i32.and
              i32.const 10
              i32.lt_u
              br_if $B4
              local.get $p0
              i32.const 223
              i32.and
              i32.const -65
              i32.add
              i32.const 255
              i32.and
              i32.const 26
              i32.lt_u
              br_if $B4
              local.get $p0
              i32.const -45
              i32.add
              i32.const 2
              i32.lt_u
              br_if $B4
              local.get $p0
              i32.const 126
              i32.eq
              br_if $B4
              local.get $p0
              i32.const 95
              i32.ne
              br_if $B3
            end
            i32.const 0
            i32.load offset=65748
            local.set $l3
            br $B2
          end
          i32.const 0
          i32.load offset=65748
          i32.const 37
          i32.store8 offset=3407872
          i32.const 0
          i32.const 0
          i32.load offset=65748
          local.tee $l3
          i32.const 1
          i32.add
          i32.store offset=65748
          i32.const 0
          i32.const 0
          i32.load offset=65760
          i32.const 37
          i32.xor
          i32.const 16777619
          i32.mul
          i32.store offset=65760
          local.get $l3
          i32.const 3407873
          i32.add
          local.get $p0
          i32.const 4
          i32.shr_u
          i32.load8_u offset=65728
          local.tee $l4
          i32.store8
          i32.const 0
          i32.const 0
          i32.load offset=65748
          i32.const 1
          i32.add
          local.tee $l3
          i32.store offset=65748
          i32.const 0
          local.get $l4
          i32.const 0
          i32.load offset=65760
          i32.xor
          i32.const 16777619
          i32.mul
          i32.store offset=65760
          local.get $p0
          i32.const 15
          i32.and
          i32.load8_u offset=65728
          local.set $p0
        end
        local.get $l3
        local.get $p0
        i32.store8 offset=3407872
        i32.const 0
        i32.const 0
        i32.load offset=65748
        i32.const 1
        i32.add
        i32.store offset=65748
        i32.const 0
        i32.const 0
        i32.load offset=65760
        local.get $p0
        i32.const 255
        i32.and
        i32.xor
        i32.const 16777619
        i32.mul
        i32.store offset=65760
        local.get $l2
        i32.const 1
        i32.add
        local.set $l2
        local.get $p1
        i32.const -1
        i32.add
        local.tee $p1
        br_if $L1
      end
    end)
  (func $write_date (type $t1) (param $p0 i32) (result i32)
    (local $l1 i32) (local $l2 i32) (local $l3 i32) (local $l4 i32) (local $l5 i32) (local $l6 i32)
    global.get $__stack_pointer
    i32.const 16
    i32.sub
    local.set $l1
    local.get $p0
    i32.const 100
    i32.div_u
    local.tee $l2
    i32.const 100
    i32.rem_u
    local.set $l3
    i32.const 0
    local.set $l4
    block $B0
      local.get $p0
      local.get $l2
      i32.const 100
      i32.mul
      i32.sub
      local.tee $l5
      i32.eqz
      br_if $B0
      local.get $p0
      i32.const -100000000
      i32.add
      i32.const -79740000
      i32.lt_u
      br_if $B0
      local.get $l3
      i32.eqz
      br_if $B0
      local.get $l3
      i32.const 12
      i32.gt_u
      br_if $B0
      local.get $l5
      i32.const 28
      i32.gt_u
      br_if $B0
      local.get $p0
      i32.const 10000
      i32.div_u
      local.set $l6
      i32.const 0
      local.set $l2
      loop $L1
        local.get $l1
        i32.const 6
        i32.add
        local.get $l2
        local.tee $l4
        i32.add
        local.get $l6
        local.tee $p0
        local.get $p0
        i32.const 10
        i32.div_u
        local.tee $l6
        i32.const 10
        i32.mul
        i32.sub
        i32.const 48
        i32.or
        i32.store8
        local.get $l4
        i32.const 1
        i32.add
        local.set $l2
        local.get $p0
        i32.const 9
        i32.gt_u
        br_if $L1
        local.get $l4
        i32.const 3
        i32.lt_u
        br_if $L1
      end
      i32.const 0
      i32.load offset=65748
      local.set $l4
      block $B2
        block $B3
          local.get $l2
          i32.const -1
          i32.add
          local.tee $p0
          i32.const 1
          i32.and
          i32.eqz
          br_if $B3
          local.get $l2
          local.set $p0
          br $B2
        end
        local.get $l4
        local.get $l1
        i32.const 6
        i32.add
        local.get $l2
        i32.add
        i32.const -1
        i32.add
        i32.load8_u
        local.tee $l6
        i32.store8 offset=3407872
        i32.const 0
        i32.const 0
        i32.load offset=65748
        i32.const 1
        i32.add
        local.tee $l4
        i32.store offset=65748
        i32.const 0
        local.get $l6
        i32.const 0
        i32.load offset=65760
        i32.xor
        i32.const 16777619
        i32.mul
        i32.store offset=65760
      end
      block $B4
        local.get $l2
        i32.const 1
        i32.eq
        br_if $B4
        loop $L5
          local.get $l4
          local.get $l1
          i32.const 6
          i32.add
          local.get $p0
          i32.add
          local.tee $l2
          i32.const -1
          i32.add
          i32.load8_u
          local.tee $l6
          i32.store8 offset=3407872
          i32.const 0
          i32.const 0
          i32.load offset=65748
          local.tee $l4
          i32.const 1
          i32.add
          i32.store offset=65748
          i32.const 0
          local.get $l6
          i32.const 0
          i32.load offset=65760
          i32.xor
          i32.const 16777619
          i32.mul
          i32.store offset=65760
          local.get $l4
          i32.const 3407873
          i32.add
          local.get $l2
          i32.const -2
          i32.add
          i32.load8_u
          local.tee $l2
          i32.store8
          i32.const 0
          i32.const 0
          i32.load offset=65748
          i32.const 1
          i32.add
          local.tee $l4
          i32.store offset=65748
          i32.const 0
          local.get $l2
          i32.const 0
          i32.load offset=65760
          i32.xor
          i32.const 16777619
          i32.mul
          i32.store offset=65760
          local.get $p0
          i32.const -2
          i32.add
          local.tee $p0
          br_if $L5
        end
      end
      local.get $l4
      i32.const 45
      i32.store8 offset=3407872
      i32.const 0
      local.set $l2
      i32.const 0
      i32.const 0
      i32.load offset=65748
      i32.const 1
      i32.add
      local.tee $l6
      i32.store offset=65748
      i32.const 0
      i32.const 0
      i32.load offset=65760
      i32.const 45
      i32.xor
      i32.const 16777619
      i32.mul
      i32.store offset=65760
      loop $L6
        local.get $l1
        i32.const 6
        i32.add
        local.get $l2
        local.tee $l4
        i32.add
        local.get $l3
        local.tee $p0
        local.get $p0
        i32.const 10
        i32.div_u
        local.tee $l3
        i32.const 10
        i32.mul
        i32.sub
        i32.const 48
        i32.or
        i32.store8
        local.get $l4
        i32.const 1
        i32.add
        local.set $l2
        local.get $p0
        i32.const 9
        i32.gt_u
        br_if $L6
        local.get $l4
        i32.eqz
        br_if $L6
      end
      block $B7
        block $B8
          local.get $l2
          i32.const -1
          i32.add
          local.tee $p0
          i32.const 1
          i32.and
          i32.eqz
          br_if $B8
          local.get $l2
          local.set $p0
          br $B7
        end
        local.get $l6
        local.get $l1
        i32.const 6
        i32.add
        local.get $l2
        i32.add
        i32.const -1
        i32.add
        i32.load8_u
        local.tee $l4
        i32.store8 offset=3407872
        i32.const 0
        i32.const 0
        i32.load offset=65748
        i32.const 1
        i32.add
        local.tee $l6
        i32.store offset=65748
        i32.const 0
        local.get $l4
        i32.const 0
        i32.load offset=65760
        i32.xor
        i32.const 16777619
        i32.mul
        i32.store offset=65760
      end
      block $B9
        local.get $l2
        i32.const 1
        i32.eq
        br_if $B9
        loop $L10
          local.get $l6
          local.get $l1
          i32.const 6
          i32.add
          local.get $p0
          i32.add
          local.tee $l4
          i32.const -1
          i32.add
          i32.load8_u
          local.tee $l3
          i32.store8 offset=3407872
          i32.const 0
          i32.const 0
          i32.load offset=65748
          local.tee $l2
          i32.const 1
          i32.add
          i32.store offset=65748
          i32.const 0
          local.get $l3
          i32.const 0
          i32.load offset=65760
          i32.xor
          i32.const 16777619
          i32.mul
          i32.store offset=65760
          local.get $l2
          i32.const 3407873
          i32.add
          local.get $l4
          i32.const -2
          i32.add
          i32.load8_u
          local.tee $l4
          i32.store8
          i32.const 0
          i32.const 0
          i32.load offset=65748
          i32.const 1
          i32.add
          local.tee $l6
          i32.store offset=65748
          i32.const 0
          local.get $l4
          i32.const 0
          i32.load offset=65760
          i32.xor
          i32.const 16777619
          i32.mul
          i32.store offset=65760
          local.get $p0
          i32.const -2
          i32.add
          local.tee $p0
          br_if $L10
        end
      end
      local.get $l6
      i32.const 45
      i32.store8 offset=3407872
      i32.const 0
      local.set $l3
      i32.const 0
      i32.const 0
      i32.load offset=65748
      i32.const 1
      i32.add
      local.tee $l2
      i32.store offset=65748
      i32.const 0
      i32.const 0
      i32.load offset=65760
      i32.const 45
      i32.xor
      i32.const 16777619
      i32.mul
      i32.store offset=65760
      loop $L11
        local.get $l1
        i32.const 6
        i32.add
        local.get $l3
        local.tee $l4
        i32.add
        local.get $l5
        local.tee $p0
        local.get $p0
        i32.const 10
        i32.div_u
        local.tee $l5
        i32.const 10
        i32.mul
        i32.sub
        i32.const 48
        i32.or
        i32.store8
        local.get $l4
        i32.const 1
        i32.add
        local.set $l3
        local.get $p0
        i32.const 9
        i32.gt_u
        br_if $L11
        local.get $l4
        i32.eqz
        br_if $L11
      end
      block $B12
        block $B13
          local.get $l3
          i32.const -1
          i32.add
          local.tee $p0
          i32.const 1
          i32.and
          i32.eqz
          br_if $B13
          local.get $l3
          local.set $p0
          br $B12
        end
        local.get $l2
        local.get $l1
        i32.const 6
        i32.add
        local.get $l3
        i32.add
        i32.const -1
        i32.add
        i32.load8_u
        local.tee $l4
        i32.store8 offset=3407872
        i32.const 0
        i32.const 0
        i32.load offset=65748
        i32.const 1
        i32.add
        local.tee $l2
        i32.store offset=65748
        i32.const 0
        local.get $l4
        i32.const 0
        i32.load offset=65760
        i32.xor
        i32.const 16777619
        i32.mul
        i32.store offset=65760
      end
      block $B14
        local.get $l3
        i32.const 1
        i32.eq
        br_if $B14
        loop $L15
          local.get $l2
          local.get $l1
          i32.const 6
          i32.add
          local.get $p0
          i32.add
          local.tee $l4
          i32.const -1
          i32.add
          i32.load8_u
          local.tee $l3
          i32.store8 offset=3407872
          i32.const 0
          i32.const 0
          i32.load offset=65748
          local.tee $l2
          i32.const 1
          i32.add
          i32.store offset=65748
          i32.const 0
          local.get $l3
          i32.const 0
          i32.load offset=65760
          i32.xor
          i32.const 16777619
          i32.mul
          i32.store offset=65760
          local.get $l2
          i32.const 3407873
          i32.add
          local.get $l4
          i32.const -2
          i32.add
          i32.load8_u
          local.tee $l4
          i32.store8
          i32.const 0
          i32.const 0
          i32.load offset=65748
          i32.const 1
          i32.add
          local.tee $l2
          i32.store offset=65748
          i32.const 0
          local.get $l4
          i32.const 0
          i32.load offset=65760
          i32.xor
          i32.const 16777619
          i32.mul
          i32.store offset=65760
          local.get $p0
          i32.const -2
          i32.add
          local.tee $p0
          br_if $L15
        end
      end
      i32.const 1
      local.set $l4
    end
    local.get $l4)
  (table $__indirect_function_table 1 1 funcref)
  (memory $memory 80)
  (global $__stack_pointer (mut i32) (i32.const 65536))
  (global $__dso_handle i32 (i32.const 65536))
  (global $__data_end i32 (i32.const 65764))
  (global $__stack_low i32 (i32.const 0))
  (global $__stack_high i32 (i32.const 65536))
  (global $__global_base i32 (i32.const 65536))
  (global $__heap_base i32 (i32.const 65776))
  (global $__heap_end i32 (i32.const 5242880))
  (global $__memory_base i32 (i32.const 0))
  (global $__table_base i32 (i32.const 1))
  (global $__wasm_first_page_end i32 (i32.const 65536))
  (export "memory" (memory $memory))
  (export "__wasm_call_ctors" (func $__wasm_call_ctors))
  (export "__stack_pointer" (global $__stack_pointer))
  (export "ssr_render" (func $ssr_render))
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
  (export "__wasm_first_page_end" (global $__wasm_first_page_end))
  (data $.rodata (i32.const 65536) "</time></article></body></html>\00<!doctype html><html lang=\22en\22><body><article data-product=\22\00.</p><p class=\22price\22 data-cents=\22\00\22>Open</a><time datetime=\22\00\22 aria-label=\22Catalog for \00\00\00\00\00\00\00\00\00\00\000123456789ABCDEF\00"))
