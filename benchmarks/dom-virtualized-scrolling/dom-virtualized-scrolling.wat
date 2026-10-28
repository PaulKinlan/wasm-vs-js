;; dom.virtualized-scrolling.v1 — compute_windows
;; WebAssembly Text (WAT) baseline for virtualized DOM list scrolling

(module $dom_vscroll.wasm
  (type $t0 (func (param i32 i32 i32 i32) (result i32)))
  (func $compute_windows (type $t0) (param $p0 i32) (param $p1 i32) (param $p2 i32) (param $p3 i32) (result i32)
    (local $l4 i32) (local $l5 i32) (local $l6 i32) (local $l7 i32) (local $l8 f64) (local $l9 i32) (local $l10 i32) (local $l11 i32) (local $l12 i32)
    i32.const 0
    local.set $l4
    block $B0
      local.get $p2
      i32.eqz
      br_if $B0
      i32.const 0
      local.set $l5
      loop $L1
        local.get $p1
        local.get $l5
        i32.const 3
        i32.shl
        i32.add
        local.tee $l6
        i32.load offset=4
        local.set $l7
        local.get $l6
        i32.load
        f64.convert_i32_u
        local.set $l8
        i32.const 0
        local.set $l9
        i32.const 0
        local.set $l10
        i32.const 99999
        local.set $l11
        loop $L2
          local.get $l9
          local.get $l11
          i32.add
          i32.const 1
          i32.shr_u
          local.tee $l6
          local.get $l10
          local.get $p0
          local.get $l6
          i32.const 3
          i32.shl
          i32.add
          f64.load
          local.get $l8
          f64.le
          local.tee $l12
          select
          local.set $l10
          local.get $l6
          i32.const 1
          i32.add
          local.get $l9
          local.get $l12
          select
          local.tee $l9
          local.get $l11
          local.get $l6
          i32.const -1
          i32.add
          local.get $l12
          select
          local.tee $l11
          i32.le_u
          br_if $L2
        end
        local.get $l10
        local.set $l11
        block $B3
          local.get $l10
          i32.const 99999
          i32.gt_u
          br_if $B3
          local.get $l8
          local.get $l7
          f64.convert_i32_u
          f64.add
          local.set $l8
          local.get $p0
          local.get $l10
          i32.const 3
          i32.shl
          i32.add
          local.set $l6
          local.get $l10
          local.set $l9
          loop $L4
            block $B5
              local.get $l6
              f64.load
              local.get $l8
              f64.lt
              br_if $B5
              local.get $l9
              local.set $l11
              br $B3
            end
            local.get $l6
            i32.const 8
            i32.add
            local.set $l6
            i32.const 100000
            local.set $l11
            local.get $l9
            i32.const 1
            i32.add
            local.tee $l9
            i32.const 100000
            i32.ne
            br_if $L4
          end
        end
        local.get $p3
        local.get $l5
        i32.const 12
        i32.mul
        i32.add
        local.tee $l6
        local.get $l10
        i32.store
        local.get $l6
        i32.const 8
        i32.add
        i32.const 1
        local.get $l11
        local.get $l10
        i32.sub
        local.get $l11
        local.get $l10
        i32.eq
        select
        local.tee $l9
        i32.store
        local.get $l6
        i32.const 4
        i32.add
        local.get $l11
        i32.store
        local.get $l9
        local.get $l4
        i32.add
        local.set $l4
        local.get $l5
        i32.const 1
        i32.add
        local.tee $l5
        local.get $p2
        i32.ne
        br_if $L1
      end
    end
    local.get $l4)
  (table $T0 1 1 funcref)
  (memory $memory 64)
  (global $__stack_pointer (mut i32) (i32.const 65536))
  (export "memory" (memory $memory))
  (export "compute_windows" (func $compute_windows)))
