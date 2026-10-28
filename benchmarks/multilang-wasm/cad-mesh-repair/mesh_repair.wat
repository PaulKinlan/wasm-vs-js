;; cad.mesh-repair.v1 — kernel: mesh_repair
;; WebAssembly Text (WAT) baseline implementation
;; Exports: mesh_repair

(module $mesh_repair_c.wasm
  (type $t0 (func))
  (type $t1 (func (result i32)))
  (type $t2 (func (param i32) (result i32)))
  (func $__wasm_call_ctors (type $t0))
  (func $input_ptr (type $t1) (result i32)
    i32.const 65536)
  (func $output_ptr (type $t1) (result i32)
    i32.const 185536)
  (func $run (type $t2) (param $p0 i32) (result i32)
    (local $l1 i32) (local $l2 i32) (local $l3 i32) (local $l4 i32) (local $l5 i32) (local $l6 i32) (local $l7 i32) (local $l8 i32) (local $l9 i32) (local $l10 i32) (local $l11 i32) (local $l12 f32) (local $l13 i32) (local $l14 i32) (local $l15 i32) (local $l16 i32) (local $l17 i32) (local $l18 i32) (local $l19 i64) (local $l20 i64) (local $l21 i32) (local $l22 i32) (local $l23 i32) (local $l24 i32) (local $l25 i32) (local $l26 i32) (local $l27 i32) (local $l28 i32) (local $l29 i32) (local $l30 i32) (local $l31 i32) (local $l32 i32) (local $l33 i64) (local $l34 i64) (local $l35 i64)
    global.get $__stack_pointer
    i32.const 16
    i32.sub
    local.set $l1
    block $B0
      local.get $p0
      i32.const 84
      i32.ge_s
      br_if $B0
      i32.const -1
      return
    end
    i32.const -2
    local.set $l2
    block $B1
      block $B2
        i32.const 0
        i32.load offset=65616
        local.tee $l3
        i32.const -4097
        i32.add
        i32.const -4096
        i32.lt_u
        br_if $B2
        local.get $p0
        local.get $l3
        i32.const 50
        i32.mul
        i32.const 84
        i32.add
        i32.ne
        br_if $B2
        i32.const 0
        local.set $l4
        i32.const 0
        local.set $l5
        i32.const 0
        local.set $l6
        i32.const 0
        local.set $l7
        i32.const 0
        local.set $l8
        i32.const 0
        local.set $l9
        loop $L3
          i32.const 2147483647
          local.set $l10
          block $B4
            local.get $l4
            i32.const 50
            i32.mul
            local.tee $l11
            f32.load offset=65632 align=2
            local.tee $l12
            local.get $l12
            f32.ne
            br_if $B4
            i32.const 2147483647
            local.set $l10
            local.get $l12
            f32.abs
            f32.const 0x1.86ap+16 (;=100000;)
            f32.gt
            br_if $B4
            local.get $l12
            f32.const 0x1.388p+13 (;=10000;)
            f32.mul
            local.tee $l12
            f32.const -0x1p-1 (;=-0.5;)
            f32.const 0x1p-1 (;=0.5;)
            local.get $l12
            f32.const 0x0p+0 (;=0;)
            f32.lt
            select
            f32.add
            i32.trunc_sat_f32_s
            local.set $l10
          end
          i32.const 2147483647
          local.set $l13
          block $B5
            local.get $l11
            i32.const 65636
            i32.add
            f32.load align=2
            local.tee $l12
            local.get $l12
            f32.ne
            br_if $B5
            local.get $l12
            f32.abs
            f32.const 0x1.86ap+16 (;=100000;)
            f32.gt
            br_if $B5
            local.get $l12
            f32.const 0x1.388p+13 (;=10000;)
            f32.mul
            local.tee $l12
            f32.const -0x1p-1 (;=-0.5;)
            f32.const 0x1p-1 (;=0.5;)
            local.get $l12
            f32.const 0x0p+0 (;=0;)
            f32.lt
            select
            f32.add
            i32.trunc_sat_f32_s
            local.set $l13
          end
          i32.const -3
          local.set $l2
          local.get $l11
          i32.const 65640
          i32.add
          f32.load align=2
          local.tee $l12
          local.get $l12
          f32.ne
          br_if $B2
          local.get $l12
          f32.abs
          f32.const 0x1.86ap+16 (;=100000;)
          f32.gt
          br_if $B2
          local.get $l10
          i32.const 2147483647
          i32.eq
          br_if $B2
          local.get $l13
          i32.const 2147483647
          i32.eq
          br_if $B2
          local.get $l12
          f32.const 0x1.388p+13 (;=10000;)
          f32.mul
          local.tee $l12
          f32.const -0x1p-1 (;=-0.5;)
          f32.const 0x1p-1 (;=0.5;)
          local.get $l12
          f32.const 0x0p+0 (;=0;)
          f32.lt
          select
          f32.add
          i32.trunc_sat_f32_s
          local.tee $l14
          i32.const 2147483647
          i32.eq
          br_if $B2
          block $B6
            block $B7
              block $B8
                block $B9
                  block $B10
                    block $B11
                      local.get $l5
                      i32.const 1
                      i32.ge_s
                      br_if $B11
                      local.get $l6
                      local.set $l15
                      br $B10
                    end
                    local.get $l6
                    local.get $l5
                    i32.add
                    local.set $l15
                    i32.const 0
                    local.set $l16
                    i32.const 385536
                    local.set $p0
                    block $B12
                      loop $L13
                        block $B14
                          local.get $p0
                          i32.load
                          local.get $l10
                          i32.ne
                          br_if $B14
                          local.get $p0
                          i32.const 4
                          i32.add
                          i32.load
                          local.get $l13
                          i32.ne
                          br_if $B14
                          local.get $p0
                          i32.const 8
                          i32.add
                          i32.load
                          local.get $l14
                          i32.eq
                          br_if $B12
                        end
                        local.get $p0
                        i32.const 12
                        i32.add
                        local.set $p0
                        local.get $l5
                        local.get $l16
                        i32.const 1
                        i32.add
                        local.tee $l16
                        i32.ne
                        br_if $L13
                      end
                      local.get $l5
                      i32.const 4096
                      i32.lt_s
                      br_if $B10
                      local.get $l1
                      i32.const 12
                      i32.add
                      local.set $p0
                      br $B1
                    end
                    local.get $l1
                    local.get $l16
                    i32.store offset=12
                    local.get $l6
                    local.get $l16
                    i32.add
                    i32.const 1
                    i32.add
                    local.set $l15
                    br $B9
                  end
                  local.get $l1
                  local.get $l5
                  i32.store offset=12
                  local.get $l5
                  i32.const 12
                  i32.mul
                  local.tee $p0
                  i32.const 385544
                  i32.add
                  local.get $l14
                  i32.store
                  local.get $p0
                  i32.const 385540
                  i32.add
                  local.get $l13
                  i32.store
                  local.get $p0
                  i32.const 385536
                  i32.add
                  local.get $l10
                  i32.store
                  local.get $l5
                  i32.const 0
                  i32.lt_s
                  br_if $B8
                  local.get $l5
                  local.set $l16
                  local.get $l5
                  i32.const 1
                  i32.add
                  local.set $l5
                end
                i32.const 2147483647
                local.set $l14
                i32.const 2147483647
                local.set $l13
                block $B15
                  local.get $l11
                  i32.const 65644
                  i32.add
                  f32.load align=2
                  local.tee $l12
                  local.get $l12
                  f32.ne
                  br_if $B15
                  i32.const 2147483647
                  local.set $l13
                  local.get $l12
                  f32.abs
                  f32.const 0x1.86ap+16 (;=100000;)
                  f32.gt
                  br_if $B15
                  local.get $l12
                  f32.const 0x1.388p+13 (;=10000;)
                  f32.mul
                  local.tee $l12
                  f32.const -0x1p-1 (;=-0.5;)
                  f32.const 0x1p-1 (;=0.5;)
                  local.get $l12
                  f32.const 0x0p+0 (;=0;)
                  f32.lt
                  select
                  f32.add
                  i32.trunc_sat_f32_s
                  local.set $l13
                end
                block $B16
                  local.get $l11
                  i32.const 65648
                  i32.add
                  f32.load align=2
                  local.tee $l12
                  local.get $l12
                  f32.ne
                  br_if $B16
                  local.get $l12
                  f32.abs
                  f32.const 0x1.86ap+16 (;=100000;)
                  f32.gt
                  br_if $B16
                  local.get $l12
                  f32.const 0x1.388p+13 (;=10000;)
                  f32.mul
                  local.tee $l12
                  f32.const -0x1p-1 (;=-0.5;)
                  f32.const 0x1p-1 (;=0.5;)
                  local.get $l12
                  f32.const 0x0p+0 (;=0;)
                  f32.lt
                  select
                  f32.add
                  i32.trunc_sat_f32_s
                  local.set $l14
                end
                local.get $l11
                i32.const 65652
                i32.add
                f32.load align=2
                local.tee $l12
                local.get $l12
                f32.ne
                br_if $B2
                local.get $l12
                f32.abs
                f32.const 0x1.86ap+16 (;=100000;)
                f32.gt
                br_if $B2
                local.get $l13
                i32.const 2147483647
                i32.eq
                br_if $B2
                local.get $l14
                i32.const 2147483647
                i32.eq
                br_if $B2
                local.get $l12
                f32.const 0x1.388p+13 (;=10000;)
                f32.mul
                local.tee $l12
                f32.const -0x1p-1 (;=-0.5;)
                f32.const 0x1p-1 (;=0.5;)
                local.get $l12
                f32.const 0x0p+0 (;=0;)
                f32.lt
                select
                f32.add
                i32.trunc_sat_f32_s
                local.tee $l17
                i32.const 2147483647
                i32.eq
                br_if $B2
                block $B17
                  local.get $l5
                  i32.const 1
                  i32.ge_s
                  br_if $B17
                  local.get $l15
                  local.set $l18
                  br $B7
                end
                local.get $l15
                local.get $l5
                i32.add
                local.set $l18
                i32.const 0
                local.set $l10
                i32.const 385536
                local.set $p0
                block $B18
                  loop $L19
                    block $B20
                      local.get $p0
                      i32.load
                      local.get $l13
                      i32.ne
                      br_if $B20
                      local.get $p0
                      i32.const 4
                      i32.add
                      i32.load
                      local.get $l14
                      i32.ne
                      br_if $B20
                      local.get $p0
                      i32.const 8
                      i32.add
                      i32.load
                      local.get $l17
                      i32.eq
                      br_if $B18
                    end
                    local.get $p0
                    i32.const 12
                    i32.add
                    local.set $p0
                    local.get $l5
                    local.get $l10
                    i32.const 1
                    i32.add
                    local.tee $l10
                    i32.ne
                    br_if $L19
                  end
                  local.get $l5
                  i32.const 4095
                  i32.le_s
                  br_if $B7
                  local.get $l1
                  i32.const 8
                  i32.add
                  local.set $p0
                  br $B1
                end
                local.get $l15
                local.get $l10
                i32.add
                i32.const 1
                i32.add
                local.set $l18
                local.get $l5
                local.set $l14
                br $B6
              end
              i32.const -4
              return
            end
            local.get $l5
            i32.const 12
            i32.mul
            local.tee $p0
            i32.const 385544
            i32.add
            local.get $l17
            i32.store
            local.get $p0
            i32.const 385540
            i32.add
            local.get $l14
            i32.store
            local.get $p0
            i32.const 385536
            i32.add
            local.get $l13
            i32.store
            block $B21
              local.get $l5
              i32.const -1
              i32.le_s
              br_if $B21
              local.get $l5
              i32.const 1
              i32.add
              local.set $l14
              local.get $l5
              local.set $l10
              br $B6
            end
            i32.const -4
            return
          end
          i32.const 2147483647
          local.set $l17
          i32.const 2147483647
          local.set $l5
          block $B22
            local.get $l11
            i32.const 65656
            i32.add
            f32.load align=2
            local.tee $l12
            local.get $l12
            f32.ne
            br_if $B22
            i32.const 2147483647
            local.set $l5
            local.get $l12
            f32.abs
            f32.const 0x1.86ap+16 (;=100000;)
            f32.gt
            br_if $B22
            local.get $l12
            f32.const 0x1.388p+13 (;=10000;)
            f32.mul
            local.tee $l12
            f32.const -0x1p-1 (;=-0.5;)
            f32.const 0x1p-1 (;=0.5;)
            local.get $l12
            f32.const 0x0p+0 (;=0;)
            f32.lt
            select
            f32.add
            i32.trunc_sat_f32_s
            local.set $l5
          end
          block $B23
            local.get $l11
            i32.const 65660
            i32.add
            f32.load align=2
            local.tee $l12
            local.get $l12
            f32.ne
            br_if $B23
            local.get $l12
            f32.abs
            f32.const 0x1.86ap+16 (;=100000;)
            f32.gt
            br_if $B23
            local.get $l12
            f32.const 0x1.388p+13 (;=10000;)
            f32.mul
            local.tee $l12
            f32.const -0x1p-1 (;=-0.5;)
            f32.const 0x1p-1 (;=0.5;)
            local.get $l12
            f32.const 0x0p+0 (;=0;)
            f32.lt
            select
            f32.add
            i32.trunc_sat_f32_s
            local.set $l17
          end
          local.get $l11
          i32.const 65664
          i32.add
          f32.load align=2
          local.tee $l12
          local.get $l12
          f32.ne
          br_if $B2
          local.get $l12
          f32.abs
          f32.const 0x1.86ap+16 (;=100000;)
          f32.gt
          br_if $B2
          local.get $l5
          i32.const 2147483647
          i32.eq
          br_if $B2
          local.get $l17
          i32.const 2147483647
          i32.eq
          br_if $B2
          local.get $l12
          f32.const 0x1.388p+13 (;=10000;)
          f32.mul
          local.tee $l12
          f32.const -0x1p-1 (;=-0.5;)
          f32.const 0x1p-1 (;=0.5;)
          local.get $l12
          f32.const 0x0p+0 (;=0;)
          f32.lt
          select
          f32.add
          i32.trunc_sat_f32_s
          local.tee $l11
          i32.const 2147483647
          i32.eq
          br_if $B2
          block $B24
            block $B25
              block $B26
                local.get $l14
                i32.const 1
                i32.ge_s
                br_if $B26
                local.get $l18
                local.set $l6
                br $B25
              end
              local.get $l18
              local.get $l14
              i32.add
              local.set $l6
              i32.const 0
              local.set $l13
              i32.const 385536
              local.set $p0
              block $B27
                loop $L28
                  block $B29
                    local.get $p0
                    i32.load
                    local.get $l5
                    i32.ne
                    br_if $B29
                    local.get $p0
                    i32.const 4
                    i32.add
                    i32.load
                    local.get $l17
                    i32.ne
                    br_if $B29
                    local.get $p0
                    i32.const 8
                    i32.add
                    i32.load
                    local.get $l11
                    i32.eq
                    br_if $B27
                  end
                  local.get $p0
                  i32.const 12
                  i32.add
                  local.set $p0
                  local.get $l14
                  local.get $l13
                  i32.const 1
                  i32.add
                  local.tee $l13
                  i32.ne
                  br_if $L28
                end
                local.get $l14
                i32.const 4095
                i32.le_s
                br_if $B25
                local.get $l1
                i32.const 4
                i32.add
                local.set $p0
                br $B1
              end
              local.get $l18
              local.get $l13
              i32.add
              i32.const 1
              i32.add
              local.set $l6
              local.get $l14
              local.set $l5
              br $B24
            end
            local.get $l14
            i32.const 12
            i32.mul
            local.tee $p0
            i32.const 385544
            i32.add
            local.get $l11
            i32.store
            local.get $p0
            i32.const 385540
            i32.add
            local.get $l17
            i32.store
            local.get $p0
            i32.const 385536
            i32.add
            local.get $l5
            i32.store
            block $B30
              local.get $l14
              i32.const -1
              i32.le_s
              br_if $B30
              local.get $l14
              i32.const 1
              i32.add
              local.set $l5
              local.get $l14
              local.set $l13
              br $B24
            end
            i32.const -4
            return
          end
          block $B31
            block $B32
              block $B33
                local.get $l16
                local.get $l10
                i32.eq
                br_if $B33
                local.get $l10
                local.get $l13
                i32.eq
                br_if $B33
                local.get $l16
                local.get $l13
                i32.ne
                br_if $B32
              end
              local.get $l9
              i32.const 1
              i32.add
              local.set $l9
              br $B31
            end
            block $B34
              local.get $l13
              i32.const 12
              i32.mul
              local.tee $p0
              i32.const 385540
              i32.add
              i32.load
              local.get $l16
              i32.const 12
              i32.mul
              local.tee $l14
              i32.const 385540
              i32.add
              i32.load
              local.tee $l17
              i32.sub
              i64.extend_i32_s
              local.get $l10
              i32.const 12
              i32.mul
              local.tee $l11
              i32.load offset=385536
              local.get $l14
              i32.load offset=385536
              local.tee $l14
              i32.sub
              i64.extend_i32_s
              i64.mul
              local.tee $l19
              local.get $p0
              i32.load offset=385536
              local.get $l14
              i32.sub
              i64.extend_i32_s
              local.get $l11
              i32.const 385540
              i32.add
              i32.load
              local.get $l17
              i32.sub
              i64.extend_i32_s
              i64.mul
              local.tee $l20
              i64.ne
              br_if $B34
              local.get $l9
              i32.const 1
              i32.add
              local.set $l9
              br $B31
            end
            block $B35
              block $B36
                local.get $l19
                local.get $l20
                i64.lt_s
                br_if $B36
                local.get $l13
                local.set $l14
                local.get $l10
                local.set $l13
                br $B35
              end
              local.get $l1
              local.get $l10
              i32.store offset=4
              local.get $l1
              local.get $l13
              i32.store offset=8
              local.get $l7
              i32.const 1
              i32.add
              local.set $l7
              local.get $l10
              local.set $l14
            end
            local.get $l8
            i32.const 12
            i32.mul
            local.tee $p0
            i32.const 434696
            i32.add
            local.get $l14
            i32.store
            local.get $p0
            i32.const 434692
            i32.add
            local.get $l13
            i32.store
            local.get $p0
            i32.const 434688
            i32.add
            local.get $l16
            i32.store
            local.get $l8
            i32.const 1
            i32.add
            local.set $l8
          end
          local.get $l4
          i32.const 1
          i32.add
          local.tee $l4
          local.get $l3
          i32.ne
          br_if $L3
        end
        block $B37
          local.get $l8
          i32.const 1
          i32.and
          i32.eqz
          br_if $B37
          i32.const -5
          return
        end
        i32.const 0
        local.set $l21
        i32.const 0
        local.set $l22
        block $B38
          local.get $l8
          i32.const 1
          i32.lt_s
          br_if $B38
          local.get $l8
          i32.const 9
          i32.mul
          local.set $l23
          i32.const 0
          local.set $l24
          i32.const 0
          local.set $l22
          loop $L39
            local.get $l23
            local.get $l22
            i32.add
            local.set $l22
            local.get $l24
            i32.const 12
            i32.mul
            local.tee $l18
            i32.load offset=434692
            local.set $p0
            local.get $l18
            i32.load offset=434688
            local.set $l16
            i32.const 434688
            local.set $l10
            local.get $l8
            local.set $l14
            i32.const 0
            local.set $l13
            loop $L40
              local.get $l13
              local.get $l16
              local.get $l10
              i32.load
              local.tee $l17
              i32.eq
              local.tee $l11
              local.get $p0
              local.get $l10
              i32.const 4
              i32.add
              i32.load
              local.tee $l1
              i32.eq
              local.tee $l4
              i32.and
              local.get $p0
              local.get $l17
              i32.eq
              local.tee $l17
              local.get $l16
              local.get $l1
              i32.eq
              local.tee $l1
              i32.and
              i32.or
              i32.add
              local.get $l1
              local.get $p0
              local.get $l10
              i32.const 8
              i32.add
              i32.load
              local.tee $l13
              i32.eq
              local.tee $l15
              i32.and
              local.get $l4
              local.get $l16
              local.get $l13
              i32.eq
              local.tee $l13
              i32.and
              i32.or
              i32.add
              local.get $l13
              local.get $l17
              i32.and
              local.get $l15
              local.get $l11
              i32.and
              i32.or
              i32.add
              local.set $l13
              local.get $l10
              i32.const 12
              i32.add
              local.set $l10
              local.get $l14
              i32.const -1
              i32.add
              local.tee $l14
              br_if $L40
            end
            i32.const -6
            local.set $l2
            local.get $l13
            i32.const 3
            i32.ge_s
            br_if $B2
            local.get $l18
            i32.const 434696
            i32.add
            i32.load
            local.set $l10
            i32.const 0
            local.set $l14
            i32.const 434688
            local.set $l13
            local.get $l8
            local.set $l17
            loop $L41
              local.get $l14
              local.get $p0
              local.get $l13
              i32.load
              local.tee $l11
              i32.eq
              local.tee $l1
              local.get $l10
              local.get $l13
              i32.const 4
              i32.add
              i32.load
              local.tee $l4
              i32.eq
              local.tee $l15
              i32.and
              local.get $l10
              local.get $l11
              i32.eq
              local.tee $l11
              local.get $p0
              local.get $l4
              i32.eq
              local.tee $l4
              i32.and
              i32.or
              i32.add
              local.get $l4
              local.get $l10
              local.get $l13
              i32.const 8
              i32.add
              i32.load
              local.tee $l14
              i32.eq
              local.tee $l18
              i32.and
              local.get $l15
              local.get $p0
              local.get $l14
              i32.eq
              local.tee $l14
              i32.and
              i32.or
              i32.add
              local.get $l14
              local.get $l11
              i32.and
              local.get $l18
              local.get $l1
              i32.and
              i32.or
              i32.add
              local.set $l14
              local.get $l13
              i32.const 12
              i32.add
              local.set $l13
              local.get $l17
              i32.const -1
              i32.add
              local.tee $l17
              br_if $L41
            end
            local.get $l14
            i32.const 2
            i32.gt_s
            br_if $B2
            i32.const 0
            local.set $l13
            i32.const 434688
            local.set $p0
            local.get $l8
            local.set $l14
            loop $L42
              local.get $l13
              local.get $l10
              local.get $p0
              i32.load
              local.tee $l17
              i32.eq
              local.tee $l11
              local.get $l16
              local.get $p0
              i32.const 4
              i32.add
              i32.load
              local.tee $l1
              i32.eq
              local.tee $l4
              i32.and
              local.get $l16
              local.get $l17
              i32.eq
              local.tee $l17
              local.get $l10
              local.get $l1
              i32.eq
              local.tee $l1
              i32.and
              i32.or
              i32.add
              local.get $l1
              local.get $l16
              local.get $p0
              i32.const 8
              i32.add
              i32.load
              local.tee $l13
              i32.eq
              local.tee $l15
              i32.and
              local.get $l4
              local.get $l10
              local.get $l13
              i32.eq
              local.tee $l13
              i32.and
              i32.or
              i32.add
              local.get $l13
              local.get $l17
              i32.and
              local.get $l15
              local.get $l11
              i32.and
              i32.or
              i32.add
              local.set $l13
              local.get $p0
              i32.const 12
              i32.add
              local.set $p0
              local.get $l14
              i32.const -1
              i32.add
              local.tee $l14
              br_if $L42
            end
            local.get $l13
            i32.const 2
            i32.gt_s
            br_if $B2
            local.get $l24
            i32.const 1
            i32.add
            local.tee $l24
            local.get $l8
            i32.ne
            br_if $L39
          end
        end
        i32.const 0
        local.set $l10
        block $B43
          local.get $l5
          i32.const 1
          i32.lt_s
          br_if $B43
          i32.const 0
          local.set $l10
          i32.const 0
          local.set $l11
          i32.const 0
          local.set $l21
          loop $L44
            local.get $l11
            i32.const 12
            i32.mul
            local.tee $l1
            i32.load offset=385536
            local.tee $p0
            i32.const -10000
            i32.add
            local.get $p0
            local.get $p0
            i32.const 10000
            i32.div_s
            i32.const 1
            i32.and
            select
            local.set $l13
            block $B45
              block $B46
                block $B47
                  local.get $l10
                  i32.const 1
                  i32.lt_s
                  br_if $B47
                  local.get $l21
                  local.get $l10
                  i32.add
                  local.set $l4
                  i32.const 0
                  local.set $l16
                  i32.const 483840
                  local.set $p0
                  local.get $l1
                  i32.const 385540
                  i32.add
                  local.set $l14
                  local.get $l1
                  i32.const 385544
                  i32.add
                  local.set $l17
                  loop $L48
                    block $B49
                      local.get $p0
                      i32.load
                      local.get $l13
                      i32.ne
                      br_if $B49
                      local.get $p0
                      i32.const 4
                      i32.add
                      i32.load
                      local.get $l14
                      i32.load
                      i32.ne
                      br_if $B49
                      local.get $p0
                      i32.const 8
                      i32.add
                      i32.load
                      local.get $l17
                      i32.load
                      i32.eq
                      br_if $B46
                    end
                    local.get $p0
                    i32.const 12
                    i32.add
                    local.set $p0
                    local.get $l10
                    local.get $l16
                    i32.const 1
                    i32.add
                    local.tee $l16
                    i32.ne
                    br_if $L48
                  end
                  local.get $l4
                  local.set $l21
                end
                local.get $l10
                i32.const 12
                i32.mul
                local.tee $p0
                i32.const 483840
                i32.add
                local.get $l13
                i32.store
                local.get $p0
                i32.const 483844
                i32.add
                local.get $l1
                i32.const 385540
                i32.add
                i32.load
                i32.store
                local.get $p0
                i32.const 483848
                i32.add
                local.get $l1
                i32.const 385544
                i32.add
                i32.load
                i32.store
                local.get $l10
                local.set $l16
                local.get $l10
                i32.const 1
                i32.add
                local.set $l10
                br $B45
              end
              local.get $l21
              local.get $l16
              i32.add
              i32.const 1
              i32.add
              local.set $l21
            end
            local.get $l11
            i32.const 2
            i32.shl
            local.get $l16
            i32.store offset=532992
            local.get $l11
            i32.const 1
            i32.add
            local.tee $l11
            local.get $l5
            i32.ne
            br_if $L44
          end
        end
        local.get $l8
        i32.const 1
        i32.shr_s
        local.set $l11
        i32.const 0
        local.set $l1
        block $B50
          local.get $l8
          i32.const 1
          i32.lt_s
          br_if $B50
          i32.const 434688
          local.set $p0
          local.get $l8
          local.set $l14
          loop $L51
            block $B52
              local.get $p0
              i32.load
              i32.const 2
              i32.shl
              i32.const 532992
              i32.add
              i32.load
              local.tee $l13
              local.get $p0
              i32.const 4
              i32.add
              i32.load
              i32.const 2
              i32.shl
              i32.const 532992
              i32.add
              i32.load
              local.tee $l16
              i32.eq
              br_if $B52
              local.get $l16
              local.get $p0
              i32.const 8
              i32.add
              i32.load
              i32.const 2
              i32.shl
              i32.const 532992
              i32.add
              i32.load
              local.tee $l17
              i32.eq
              br_if $B52
              local.get $l13
              local.get $l17
              i32.eq
              br_if $B52
              local.get $l1
              i32.const 12
              i32.mul
              local.tee $l4
              i32.const 549384
              i32.add
              local.get $l17
              i32.store
              local.get $l4
              i32.const 549380
              i32.add
              local.get $l16
              i32.store
              local.get $l4
              i32.const 549376
              i32.add
              local.get $l13
              i32.store
              local.get $l1
              i32.const 1
              i32.add
              local.set $l1
            end
            local.get $p0
            i32.const 12
            i32.add
            local.set $p0
            local.get $l14
            i32.const -1
            i32.add
            local.tee $l14
            br_if $L51
          end
        end
        block $B53
          local.get $l1
          local.get $l11
          i32.eq
          br_if $B53
          i32.const -7
          return
        end
        i32.const 0
        local.set $l25
        i32.const 0
        local.set $l26
        block $B54
          local.get $l11
          i32.const 1
          i32.lt_s
          br_if $B54
          local.get $l11
          i32.const 9
          i32.mul
          local.set $l27
          i32.const 0
          local.set $l16
          i32.const 0
          local.set $l26
          i32.const 0
          local.set $l25
          loop $L55
            local.get $l27
            local.get $l25
            i32.add
            local.set $l25
            local.get $l16
            i32.const 12
            i32.mul
            local.tee $l28
            i32.load offset=549380
            local.set $l14
            local.get $l28
            i32.load offset=549376
            local.set $l17
            i32.const 549376
            local.set $p0
            i32.const 0
            local.set $l13
            i32.const 0
            local.set $l1
            i32.const 0
            local.set $l15
            loop $L56
              block $B57
                block $B58
                  local.get $l13
                  local.get $l16
                  i32.ge_u
                  br_if $B58
                  i32.const 1
                  i32.const 1
                  i32.const 1
                  local.get $l15
                  local.get $l17
                  local.get $p0
                  i32.load
                  local.tee $l4
                  i32.eq
                  local.tee $l18
                  local.get $l14
                  local.get $p0
                  i32.const 4
                  i32.add
                  i32.load
                  local.tee $l2
                  i32.eq
                  local.tee $l24
                  i32.and
                  local.get $l14
                  local.get $l4
                  i32.eq
                  local.tee $l4
                  local.get $l17
                  local.get $l2
                  i32.eq
                  local.tee $l2
                  i32.and
                  i32.or
                  i32.const 1
                  i32.and
                  local.tee $l23
                  select
                  local.get $l2
                  local.get $l14
                  local.get $p0
                  i32.const 8
                  i32.add
                  i32.load
                  local.tee $l15
                  i32.eq
                  local.tee $l29
                  i32.and
                  local.get $l24
                  local.get $l17
                  local.get $l15
                  i32.eq
                  local.tee $l15
                  i32.and
                  i32.or
                  i32.const 1
                  i32.and
                  local.tee $l2
                  select
                  local.get $l15
                  local.get $l4
                  i32.and
                  local.get $l29
                  local.get $l18
                  i32.and
                  i32.or
                  local.tee $l4
                  select
                  local.set $l15
                  local.get $l1
                  local.get $l23
                  i32.add
                  local.get $l2
                  i32.add
                  local.set $l1
                  br $B57
                end
                local.get $l17
                local.get $p0
                i32.load
                local.tee $l4
                i32.eq
                local.tee $l18
                local.get $l14
                local.get $p0
                i32.const 4
                i32.add
                i32.load
                local.tee $l2
                i32.eq
                local.tee $l24
                i32.and
                local.get $l14
                local.get $l4
                i32.eq
                local.tee $l4
                local.get $l17
                local.get $l2
                i32.eq
                local.tee $l2
                i32.and
                i32.or
                local.set $l23
                block $B59
                  local.get $l16
                  local.get $l13
                  i32.eq
                  br_if $B59
                  local.get $l17
                  local.get $p0
                  i32.const 8
                  i32.add
                  i32.load
                  local.tee $l29
                  i32.eq
                  local.tee $l30
                  local.get $l4
                  i32.and
                  local.get $l14
                  local.get $l29
                  i32.eq
                  local.tee $l29
                  local.get $l18
                  i32.and
                  i32.or
                  local.set $l4
                  local.get $l1
                  local.get $l23
                  i32.add
                  local.get $l2
                  local.get $l29
                  i32.and
                  local.get $l24
                  local.get $l30
                  i32.and
                  i32.or
                  i32.add
                  local.set $l1
                  br $B57
                end
                local.get $l17
                local.get $p0
                i32.const 8
                i32.add
                i32.load
                local.tee $l29
                i32.eq
                local.tee $l30
                local.get $l4
                i32.and
                local.get $l14
                local.get $l29
                i32.eq
                local.tee $l29
                local.get $l18
                i32.and
                i32.or
                local.set $l4
                local.get $l1
                local.get $l23
                i32.add
                local.get $l2
                local.get $l29
                i32.and
                local.get $l24
                local.get $l30
                i32.and
                i32.or
                i32.add
                local.set $l1
              end
              local.get $p0
              i32.const 12
              i32.add
              local.set $p0
              local.get $l1
              local.get $l4
              i32.add
              local.set $l1
              local.get $l11
              local.get $l13
              i32.const 1
              i32.add
              local.tee $l13
              i32.ne
              br_if $L56
            end
            i32.const -8
            local.set $l2
            local.get $l1
            i32.const 3
            i32.ge_s
            br_if $B2
            local.get $l26
            local.get $l26
            i32.const 1
            i32.add
            local.get $l15
            select
            local.set $l31
            local.get $l28
            i32.const 549384
            i32.add
            local.tee $l32
            i32.load
            local.set $l14
            local.get $l28
            i32.const 549380
            i32.add
            i32.load
            local.set $l17
            i32.const 0
            local.set $l13
            i32.const 549376
            local.set $p0
            i32.const 0
            local.set $l1
            i32.const 0
            local.set $l15
            loop $L60
              block $B61
                block $B62
                  local.get $l13
                  local.get $l16
                  i32.lt_u
                  br_if $B62
                  local.get $l17
                  local.get $p0
                  i32.load
                  local.tee $l4
                  i32.eq
                  local.tee $l24
                  local.get $l14
                  local.get $p0
                  i32.const 4
                  i32.add
                  i32.load
                  local.tee $l18
                  i32.eq
                  local.tee $l23
                  i32.and
                  local.get $l14
                  local.get $l4
                  i32.eq
                  local.tee $l4
                  local.get $l17
                  local.get $l18
                  i32.eq
                  local.tee $l29
                  i32.and
                  i32.or
                  local.set $l18
                  block $B63
                    local.get $l16
                    local.get $l13
                    i32.eq
                    br_if $B63
                    local.get $l17
                    local.get $p0
                    i32.const 8
                    i32.add
                    i32.load
                    local.tee $l30
                    i32.eq
                    local.tee $l26
                    local.get $l4
                    i32.and
                    local.get $l14
                    local.get $l30
                    i32.eq
                    local.tee $l30
                    local.get $l24
                    i32.and
                    i32.or
                    local.set $l4
                    local.get $l1
                    local.get $l18
                    i32.add
                    local.get $l29
                    local.get $l30
                    i32.and
                    local.get $l23
                    local.get $l26
                    i32.and
                    i32.or
                    i32.add
                    local.set $l1
                    br $B61
                  end
                  local.get $l17
                  local.get $p0
                  i32.const 8
                  i32.add
                  i32.load
                  local.tee $l30
                  i32.eq
                  local.tee $l26
                  local.get $l4
                  i32.and
                  local.get $l14
                  local.get $l30
                  i32.eq
                  local.tee $l30
                  local.get $l24
                  i32.and
                  i32.or
                  local.set $l4
                  local.get $l1
                  local.get $l18
                  i32.add
                  local.get $l29
                  local.get $l30
                  i32.and
                  local.get $l23
                  local.get $l26
                  i32.and
                  i32.or
                  i32.add
                  local.set $l1
                  i32.const 1
                  local.get $l15
                  local.get $l18
                  select
                  local.set $l15
                  br $B61
                end
                i32.const 1
                i32.const 1
                i32.const 1
                local.get $l15
                local.get $l17
                local.get $p0
                i32.load
                local.tee $l4
                i32.eq
                local.tee $l18
                local.get $l14
                local.get $p0
                i32.const 4
                i32.add
                i32.load
                local.tee $l24
                i32.eq
                local.tee $l23
                i32.and
                local.get $l14
                local.get $l4
                i32.eq
                local.tee $l4
                local.get $l17
                local.get $l24
                i32.eq
                local.tee $l24
                i32.and
                i32.or
                i32.const 1
                i32.and
                local.tee $l29
                select
                local.get $l24
                local.get $l14
                local.get $p0
                i32.const 8
                i32.add
                i32.load
                local.tee $l15
                i32.eq
                local.tee $l30
                i32.and
                local.get $l23
                local.get $l17
                local.get $l15
                i32.eq
                local.tee $l15
                i32.and
                i32.or
                i32.const 1
                i32.and
                local.tee $l24
                select
                local.get $l15
                local.get $l4
                i32.and
                local.get $l30
                local.get $l18
                i32.and
                i32.or
                local.tee $l4
                select
                local.set $l15
                local.get $l1
                local.get $l29
                i32.add
                local.get $l24
                i32.add
                local.set $l1
              end
              local.get $p0
              i32.const 12
              i32.add
              local.set $p0
              local.get $l1
              local.get $l4
              i32.add
              local.set $l1
              local.get $l11
              local.get $l13
              i32.const 1
              i32.add
              local.tee $l13
              i32.ne
              br_if $L60
            end
            local.get $l1
            i32.const 2
            i32.gt_s
            br_if $B2
            local.get $l31
            local.get $l31
            i32.const 1
            i32.add
            local.get $l15
            select
            local.set $l31
            i32.const 549376
            local.set $p0
            local.get $l28
            i32.const 549376
            i32.add
            i32.load
            local.set $l14
            local.get $l32
            i32.load
            local.set $l17
            i32.const 0
            local.set $l13
            i32.const 0
            local.set $l1
            i32.const 0
            local.set $l15
            loop $L64
              block $B65
                block $B66
                  local.get $l13
                  local.get $l16
                  i32.lt_u
                  br_if $B66
                  local.get $l17
                  local.get $p0
                  i32.load
                  local.tee $l4
                  i32.eq
                  local.tee $l24
                  local.get $l14
                  local.get $p0
                  i32.const 4
                  i32.add
                  i32.load
                  local.tee $l18
                  i32.eq
                  local.tee $l23
                  i32.and
                  local.get $l14
                  local.get $l4
                  i32.eq
                  local.tee $l4
                  local.get $l17
                  local.get $l18
                  i32.eq
                  local.tee $l29
                  i32.and
                  i32.or
                  local.set $l18
                  block $B67
                    local.get $l16
                    local.get $l13
                    i32.eq
                    br_if $B67
                    local.get $l17
                    local.get $p0
                    i32.const 8
                    i32.add
                    i32.load
                    local.tee $l30
                    i32.eq
                    local.tee $l26
                    local.get $l4
                    i32.and
                    local.get $l14
                    local.get $l30
                    i32.eq
                    local.tee $l30
                    local.get $l24
                    i32.and
                    i32.or
                    local.set $l4
                    local.get $l1
                    local.get $l18
                    i32.add
                    local.get $l29
                    local.get $l30
                    i32.and
                    local.get $l23
                    local.get $l26
                    i32.and
                    i32.or
                    i32.add
                    local.set $l1
                    br $B65
                  end
                  i32.const 1
                  i32.const 1
                  local.get $l15
                  local.get $l18
                  i32.const 1
                  i32.and
                  select
                  local.get $l29
                  local.get $l14
                  local.get $p0
                  i32.const 8
                  i32.add
                  i32.load
                  local.tee $l15
                  i32.eq
                  local.tee $l30
                  i32.and
                  local.get $l23
                  local.get $l17
                  local.get $l15
                  i32.eq
                  local.tee $l29
                  i32.and
                  i32.or
                  local.tee $l23
                  select
                  local.set $l15
                  local.get $l29
                  local.get $l4
                  i32.and
                  local.get $l30
                  local.get $l24
                  i32.and
                  i32.or
                  local.set $l4
                  local.get $l1
                  local.get $l18
                  i32.add
                  local.get $l23
                  i32.add
                  local.set $l1
                  br $B65
                end
                i32.const 1
                i32.const 1
                i32.const 1
                local.get $l15
                local.get $l17
                local.get $p0
                i32.load
                local.tee $l4
                i32.eq
                local.tee $l18
                local.get $l14
                local.get $p0
                i32.const 4
                i32.add
                i32.load
                local.tee $l24
                i32.eq
                local.tee $l23
                i32.and
                local.get $l14
                local.get $l4
                i32.eq
                local.tee $l4
                local.get $l17
                local.get $l24
                i32.eq
                local.tee $l24
                i32.and
                i32.or
                i32.const 1
                i32.and
                local.tee $l29
                select
                local.get $l24
                local.get $l14
                local.get $p0
                i32.const 8
                i32.add
                i32.load
                local.tee $l15
                i32.eq
                local.tee $l30
                i32.and
                local.get $l23
                local.get $l17
                local.get $l15
                i32.eq
                local.tee $l15
                i32.and
                i32.or
                i32.const 1
                i32.and
                local.tee $l24
                select
                local.get $l15
                local.get $l4
                i32.and
                local.get $l30
                local.get $l18
                i32.and
                i32.or
                local.tee $l4
                select
                local.set $l15
                local.get $l1
                local.get $l29
                i32.add
                local.get $l24
                i32.add
                local.set $l1
              end
              local.get $p0
              i32.const 12
              i32.add
              local.set $p0
              local.get $l1
              local.get $l4
              i32.add
              local.set $l1
              local.get $l11
              local.get $l13
              i32.const 1
              i32.add
              local.tee $l13
              i32.ne
              br_if $L64
            end
            local.get $l1
            i32.const 2
            i32.gt_s
            br_if $B2
            local.get $l31
            local.get $l31
            i32.const 1
            i32.add
            local.get $l15
            select
            local.set $l26
            local.get $l16
            i32.const 1
            i32.add
            local.tee $l16
            local.get $l11
            i32.ne
            br_if $L55
          end
          i64.const 0
          local.set $l19
          i32.const 549376
          local.set $p0
          local.get $l11
          local.set $l17
          loop $L68
            local.get $p0
            i32.const 8
            i32.add
            i32.load
            i32.const 12
            i32.mul
            local.tee $l16
            i32.const 483844
            i32.add
            i64.load32_s
            local.tee $l20
            local.get $p0
            i32.const 4
            i32.add
            i32.load
            i32.const 12
            i32.mul
            local.tee $l13
            i32.const 483840
            i32.add
            i64.load32_s
            local.tee $l33
            i64.mul
            local.get $l16
            i32.const 483840
            i32.add
            i64.load32_s
            local.tee $l34
            local.get $l13
            i32.const 483844
            i32.add
            i64.load32_s
            local.tee $l35
            i64.mul
            i64.sub
            local.get $p0
            i32.load
            i32.const 12
            i32.mul
            local.tee $l14
            i32.const 483848
            i32.add
            i64.load32_s
            i64.mul
            local.get $l19
            i64.add
            local.get $l16
            i32.const 483848
            i32.add
            i64.load32_s
            local.tee $l19
            local.get $l35
            i64.mul
            local.get $l20
            local.get $l13
            i32.const 483848
            i32.add
            i64.load32_s
            local.tee $l35
            i64.mul
            i64.sub
            local.get $l14
            i32.const 483840
            i32.add
            i64.load32_s
            i64.mul
            i64.add
            local.get $l34
            local.get $l35
            i64.mul
            local.get $l19
            local.get $l33
            i64.mul
            i64.sub
            local.get $l14
            i32.const 483844
            i32.add
            i64.load32_s
            i64.mul
            i64.add
            local.set $l19
            local.get $p0
            i32.const 12
            i32.add
            local.set $p0
            local.get $l17
            i32.const -1
            i32.add
            local.tee $l17
            br_if $L68
          end
          local.get $l19
          i64.eqz
          br_if $B54
          i32.const -9
          return
        end
        i32.const 0
        i64.const 85899345920
        i64.store offset=185608
        i32.const 0
        local.get $l25
        i32.store offset=185604
        i32.const 0
        local.get $l22
        i32.store offset=185600
        i32.const 0
        local.get $l21
        i32.store offset=185596
        i32.const 0
        local.get $l6
        i32.store offset=185592
        i32.const 0
        local.get $l11
        i32.store offset=185588
        i32.const 0
        local.get $l10
        i32.store offset=185580
        i32.const 0
        local.get $l11
        i32.store offset=185576
        i32.const 0
        local.get $l26
        i32.store offset=185572
        i32.const 0
        local.get $l7
        i32.store offset=185564
        i32.const 0
        local.get $l9
        i32.store offset=185560
        i32.const 0
        local.get $l11
        i32.store offset=185556
        i32.const 0
        local.get $l8
        i32.store offset=185552
        i32.const 0
        local.get $l5
        i32.store offset=185548
        i32.const 0
        local.get $l3
        i32.store offset=185544
        i32.const 0
        i64.const 9886323528
        i64.store offset=185536
        i32.const 0
        local.get $l3
        i32.const 3
        i32.mul
        i32.store offset=185568
        i32.const 0
        i32.const 0
        i32.store offset=185584
        block $B69
          block $B70
            local.get $l10
            i32.const 1
            i32.ge_s
            br_if $B70
            i32.const 80
            local.set $l2
            br $B69
          end
          block $B71
            local.get $l10
            i32.const 3
            i32.mul
            local.tee $p0
            i32.const 1
            local.get $p0
            i32.const 1
            i32.gt_s
            select
            i32.const 2
            i32.shl
            local.tee $p0
            i32.eqz
            br_if $B71
            i32.const 185616
            i32.const 483840
            local.get $p0
            memory.copy
          end
          local.get $p0
          i32.const 80
          i32.add
          local.set $l2
        end
        local.get $l11
        i32.const 1
        i32.lt_s
        br_if $B2
        block $B72
          local.get $l8
          local.get $l11
          i32.add
          local.tee $p0
          i32.const 1
          local.get $p0
          i32.const 1
          i32.gt_s
          select
          i32.const 2
          i32.shl
          local.tee $p0
          i32.eqz
          br_if $B72
          local.get $l2
          i32.const 185536
          i32.add
          i32.const 549376
          local.get $p0
          memory.copy
        end
        local.get $l2
        local.get $p0
        i32.add
        local.set $l2
      end
      local.get $l2
      return
    end
    local.get $p0
    i32.const -1
    i32.store
    i32.const -4)
  (table $__indirect_function_table 1 1 funcref)
  (memory $memory 16)
  (global $__stack_pointer (mut i32) (i32.const 65536))
  (global $__dso_handle i32 (i32.const 65536))
  (global $__data_end i32 (i32.const 598528))
  (global $__stack_low i32 (i32.const 0))
  (global $__stack_high i32 (i32.const 65536))
  (global $__global_base i32 (i32.const 65536))
  (global $__heap_base i32 (i32.const 598528))
  (global $__heap_end i32 (i32.const 1048576))
  (global $__memory_base i32 (i32.const 0))
  (global $__table_base i32 (i32.const 1))
  (global $__wasm_first_page_end i32 (i32.const 65536))
  (export "memory" (memory $memory))
  (export "__wasm_call_ctors" (func $__wasm_call_ctors))
  (export "__stack_pointer" (global $__stack_pointer))
  (export "input_ptr" (func $input_ptr))
  (export "output_ptr" (func $output_ptr))
  (export "run" (func $run))
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
