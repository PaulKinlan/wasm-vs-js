(module $mlp_forward_c.wasm
  (type (;0;) (func))
  (type (;1;) (func (param i32 i32 i32 i32 i32 i32 i32 i32 i32)))
  (func $__wasm_call_ctors (type 0))
  (func $mlp_forward (type 1) (param i32 i32 i32 i32 i32 i32 i32 i32 i32)
    (local i32 i32 i32 i32 i32 i32 i32 i32 i32 i32 i32 i32 i32 i32 i32 i32 i32 i32 i32 i32 i32 i32 f32 i32 i32 f64 f64 f64)
    block  ;; label = @1
      local.get 8
      i32.const -1
      i32.eq
      br_if 0 (;@1;)
      block  ;; label = @2
        local.get 7
        local.get 6
        i32.mul
        local.tee 9
        i32.eqz
        br_if 0 (;@2;)
        local.get 7
        i32.const 3
        i32.shl
        local.set 10
        local.get 7
        i32.const -2
        i32.and
        local.set 11
        local.get 7
        i32.const 1
        i32.and
        local.set 12
        local.get 7
        local.get 7
        i32.mul
        i32.const 2
        i32.shl
        local.set 13
        local.get 1
        local.get 7
        i32.const 2
        i32.shl
        local.tee 14
        i32.add
        local.set 15
        i32.const 0
        local.set 16
        local.get 1
        local.set 17
        loop  ;; label = @3
          local.get 5
          local.get 4
          local.get 3
          local.get 16
          i32.const 1
          i32.and
          select
          local.get 16
          local.get 8
          i32.eq
          local.tee 18
          select
          local.set 19
          block  ;; label = @4
            local.get 6
            i32.eqz
            br_if 0 (;@4;)
            local.get 7
            i32.eqz
            br_if 0 (;@4;)
            local.get 2
            local.get 16
            local.get 7
            i32.mul
            local.tee 20
            i32.const 2
            i32.shl
            i32.add
            local.set 21
            local.get 1
            local.get 20
            local.get 7
            i32.mul
            i32.const 2
            i32.shl
            i32.add
            local.set 22
            i32.const 0
            local.set 23
            local.get 0
            local.set 24
            loop  ;; label = @5
              local.get 19
              local.get 23
              local.get 7
              i32.mul
              i32.const 2
              i32.shl
              local.tee 20
              i32.add
              local.set 25
              local.get 0
              local.get 20
              i32.add
              local.set 26
              local.get 17
              local.set 27
              local.get 15
              local.set 28
              i32.const 0
              local.set 29
              loop  ;; label = @6
                local.get 21
                local.get 29
                i32.const 2
                i32.shl
                local.tee 30
                i32.add
                f32.load
                local.set 31
                i32.const 0
                local.set 32
                block  ;; label = @7
                  block  ;; label = @8
                    local.get 7
                    i32.const 1
                    i32.eq
                    br_if 0 (;@8;)
                    i32.const 0
                    local.set 32
                    i32.const 0
                    local.set 20
                    local.get 24
                    local.set 33
                    loop  ;; label = @9
                      local.get 33
                      i32.const 4
                      i32.add
                      f32.load
                      local.get 28
                      local.get 20
                      i32.add
                      f32.load
                      f32.mul
                      local.get 33
                      f32.load
                      local.get 27
                      local.get 20
                      i32.add
                      f32.load
                      f32.mul
                      local.get 31
                      f32.add
                      f32.add
                      local.set 31
                      local.get 20
                      local.get 10
                      i32.add
                      local.set 20
                      local.get 33
                      i32.const 8
                      i32.add
                      local.set 33
                      local.get 11
                      local.get 32
                      i32.const 2
                      i32.add
                      local.tee 32
                      i32.ne
                      br_if 0 (;@9;)
                    end
                    local.get 12
                    i32.eqz
                    br_if 1 (;@7;)
                  end
                  local.get 26
                  local.get 32
                  i32.const 2
                  i32.shl
                  i32.add
                  f32.load
                  local.get 22
                  local.get 30
                  i32.add
                  local.get 32
                  local.get 7
                  i32.mul
                  i32.const 2
                  i32.shl
                  i32.add
                  f32.load
                  f32.mul
                  local.get 31
                  f32.add
                  local.set 31
                end
                local.get 25
                local.get 30
                i32.add
                local.get 31
                f32.const 0x0p+0 (;=0;)
                f32.add
                f32.store
                local.get 27
                i32.const 4
                i32.add
                local.set 27
                local.get 28
                i32.const 4
                i32.add
                local.set 28
                local.get 29
                i32.const 1
                i32.add
                local.tee 29
                local.get 7
                i32.ne
                br_if 0 (;@6;)
              end
              local.get 24
              local.get 14
              i32.add
              local.set 24
              local.get 23
              i32.const 1
              i32.add
              local.tee 23
              local.get 6
              i32.ne
              br_if 0 (;@5;)
            end
          end
          block  ;; label = @4
            local.get 16
            local.get 8
            i32.ge_u
            br_if 0 (;@4;)
            local.get 19
            local.set 20
            local.get 9
            local.set 33
            loop  ;; label = @5
              block  ;; label = @6
                local.get 20
                f32.load
                f64.promote_f32
                local.tee 34
                local.get 34
                f64.mul
                local.get 34
                f64.mul
                f64.const 0x1.6e4e26d4801f7p-5 (;=0.044715;)
                f64.mul
                local.get 34
                f64.add
                f64.const 0x1.9884533d43651p-1 (;=0.797885;)
                f64.mul
                local.tee 35
                local.get 35
                f64.ne
                br_if 0 (;@6;)
                block  ;; label = @7
                  local.get 35
                  f64.const 0x1.205a1cac08312p+3 (;=9.011;)
                  f64.ge
                  i32.eqz
                  br_if 0 (;@7;)
                  f64.const 0x1p+0 (;=1;)
                  local.set 35
                  br 1 (;@6;)
                end
                block  ;; label = @7
                  local.get 35
                  f64.const -0x1.205a1cac08312p+3 (;=-9.011;)
                  f64.le
                  i32.eqz
                  br_if 0 (;@7;)
                  f64.const -0x1p+0 (;=-1;)
                  local.set 35
                  br 1 (;@6;)
                end
                block  ;; label = @7
                  block  ;; label = @8
                    local.get 35
                    local.get 35
                    f64.add
                    local.tee 35
                    f64.const 0x1.62e42f837b4a2p+9 (;=709.783;)
                    f64.gt
                    i32.eqz
                    br_if 0 (;@8;)
                    f64.const inf (;=inf;)
                    local.set 35
                    br 1 (;@7;)
                  end
                  block  ;; label = @8
                    local.get 35
                    f64.const -0x1.6231eb851eb85p+9 (;=-708.39;)
                    f64.lt
                    i32.eqz
                    br_if 0 (;@8;)
                    f64.const 0x1p+0 (;=1;)
                    local.set 35
                    br 1 (;@7;)
                  end
                  local.get 35
                  local.get 35
                  f64.const 0x1.62e42fefa39efp-1 (;=0.693147;)
                  f64.div
                  f64.const 0x1p-1 (;=0.5;)
                  f64.add
                  f64.floor
                  local.tee 36
                  f64.const 0x1.62e42fefa39efp-1 (;=0.693147;)
                  f64.mul
                  f64.sub
                  local.tee 35
                  f64.const 0x1.1eed8eff8d898p-29 (;=2.08768e-09;)
                  f64.mul
                  f64.const 0x1.ae64567f544e3p-26 (;=2.50521e-08;)
                  f64.add
                  local.get 35
                  f64.mul
                  f64.const 0x1.27e4fb7789f5cp-22 (;=2.75573e-07;)
                  f64.add
                  local.get 35
                  f64.mul
                  f64.const 0x1.71de3a556c734p-19 (;=2.75573e-06;)
                  f64.add
                  local.get 35
                  f64.mul
                  f64.const 0x1.a01a01a01a01ap-16 (;=2.48016e-05;)
                  f64.add
                  local.get 35
                  f64.mul
                  f64.const 0x1.a01a01a01a01ap-13 (;=0.000198413;)
                  f64.add
                  local.get 35
                  f64.mul
                  f64.const 0x1.6c16c16c16c17p-10 (;=0.00138889;)
                  f64.add
                  local.get 35
                  f64.mul
                  f64.const 0x1.1111111111111p-7 (;=0.00833333;)
                  f64.add
                  local.get 35
                  f64.mul
                  f64.const 0x1.5555555555555p-5 (;=0.0416667;)
                  f64.add
                  local.get 35
                  f64.mul
                  f64.const 0x1.5555555555555p-3 (;=0.166667;)
                  f64.add
                  local.get 35
                  f64.mul
                  f64.const 0x1p-1 (;=0.5;)
                  f64.add
                  local.get 35
                  f64.mul
                  f64.const 0x1p+0 (;=1;)
                  f64.add
                  local.get 35
                  f64.mul
                  f64.const 0x1p+0 (;=1;)
                  f64.add
                  local.get 36
                  i32.trunc_sat_f64_s
                  i32.const 1023
                  i32.add
                  i64.extend_i32_u
                  i64.const 52
                  i64.shl
                  f64.reinterpret_i64
                  f64.mul
                  f64.const 0x1p+0 (;=1;)
                  f64.add
                  local.set 35
                end
                f64.const -0x1p+1 (;=-2;)
                local.get 35
                f64.div
                f64.const 0x1p+0 (;=1;)
                f64.add
                local.set 35
              end
              local.get 20
              local.get 34
              f64.const 0x1p-1 (;=0.5;)
              f64.mul
              local.get 35
              f64.const 0x1p+0 (;=1;)
              f64.add
              f64.mul
              f32.demote_f64
              f32.const 0x0p+0 (;=0;)
              f32.add
              f32.store
              local.get 20
              i32.const 4
              i32.add
              local.set 20
              local.get 33
              i32.const -1
              i32.add
              local.tee 33
              br_if 0 (;@5;)
            end
          end
          local.get 17
          local.get 13
          i32.add
          local.set 17
          local.get 15
          local.get 13
          i32.add
          local.set 15
          local.get 16
          i32.const 1
          i32.add
          local.set 16
          local.get 19
          local.set 0
          local.get 18
          i32.eqz
          br_if 0 (;@3;)
          br 2 (;@1;)
        end
      end
      local.get 6
      i32.eqz
      br_if 0 (;@1;)
      local.get 7
      i32.eqz
      br_if 0 (;@1;)
      local.get 7
      i32.const 3
      i32.shl
      local.set 10
      local.get 7
      i32.const -2
      i32.and
      local.set 11
      local.get 7
      i32.const 1
      i32.and
      local.set 12
      local.get 7
      local.get 7
      i32.mul
      i32.const 2
      i32.shl
      local.set 13
      local.get 1
      local.get 7
      i32.const 2
      i32.shl
      local.tee 14
      i32.add
      local.set 19
      i32.const 0
      local.set 16
      local.get 1
      local.set 15
      loop  ;; label = @2
        local.get 5
        local.get 4
        local.get 3
        local.get 16
        i32.const 1
        i32.and
        select
        local.get 16
        local.get 8
        i32.eq
        select
        local.set 17
        local.get 2
        local.get 16
        local.get 7
        i32.mul
        local.tee 20
        i32.const 2
        i32.shl
        i32.add
        local.set 21
        local.get 1
        local.get 20
        local.get 7
        i32.mul
        i32.const 2
        i32.shl
        i32.add
        local.set 22
        local.get 0
        local.set 24
        i32.const 0
        local.set 23
        loop  ;; label = @3
          local.get 17
          local.get 23
          local.get 7
          i32.mul
          i32.const 2
          i32.shl
          local.tee 20
          i32.add
          local.set 25
          local.get 0
          local.get 20
          i32.add
          local.set 26
          i32.const 0
          local.set 29
          local.get 15
          local.set 27
          local.get 19
          local.set 28
          loop  ;; label = @4
            local.get 21
            local.get 29
            i32.const 2
            i32.shl
            local.tee 30
            i32.add
            f32.load
            local.set 31
            block  ;; label = @5
              block  ;; label = @6
                block  ;; label = @7
                  local.get 7
                  i32.const 1
                  i32.ne
                  br_if 0 (;@7;)
                  i32.const 0
                  local.set 32
                  br 1 (;@6;)
                end
                i32.const 0
                local.set 32
                i32.const 0
                local.set 20
                local.get 24
                local.set 33
                loop  ;; label = @7
                  local.get 33
                  i32.const 4
                  i32.add
                  f32.load
                  local.get 28
                  local.get 20
                  i32.add
                  f32.load
                  f32.mul
                  local.get 33
                  f32.load
                  local.get 27
                  local.get 20
                  i32.add
                  f32.load
                  f32.mul
                  local.get 31
                  f32.add
                  f32.add
                  local.set 31
                  local.get 20
                  local.get 10
                  i32.add
                  local.set 20
                  local.get 33
                  i32.const 8
                  i32.add
                  local.set 33
                  local.get 11
                  local.get 32
                  i32.const 2
                  i32.add
                  local.tee 32
                  i32.ne
                  br_if 0 (;@7;)
                end
                local.get 12
                i32.eqz
                br_if 1 (;@5;)
              end
              local.get 26
              local.get 32
              i32.const 2
              i32.shl
              i32.add
              f32.load
              local.get 22
              local.get 30
              i32.add
              local.get 32
              local.get 7
              i32.mul
              i32.const 2
              i32.shl
              i32.add
              f32.load
              f32.mul
              local.get 31
              f32.add
              local.set 31
            end
            local.get 25
            local.get 30
            i32.add
            local.get 31
            f32.const 0x0p+0 (;=0;)
            f32.add
            f32.store
            local.get 27
            i32.const 4
            i32.add
            local.set 27
            local.get 28
            i32.const 4
            i32.add
            local.set 28
            local.get 29
            i32.const 1
            i32.add
            local.tee 29
            local.get 7
            i32.ne
            br_if 0 (;@4;)
          end
          local.get 24
          local.get 14
          i32.add
          local.set 24
          local.get 23
          i32.const 1
          i32.add
          local.tee 23
          local.get 6
          i32.ne
          br_if 0 (;@3;)
        end
        local.get 15
        local.get 13
        i32.add
        local.set 15
        local.get 19
        local.get 13
        i32.add
        local.set 19
        local.get 16
        local.get 8
        i32.ne
        local.set 20
        local.get 17
        local.set 0
        local.get 16
        i32.const 1
        i32.add
        local.set 16
        local.get 20
        br_if 0 (;@2;)
      end
    end)
  (memory (;0;) 256)
  (global $__stack_pointer (mut i32) (i32.const 65536))
  (global (;1;) i32 (i32.const 65536))
  (global (;2;) i32 (i32.const 65536))
  (global (;3;) i32 (i32.const 0))
  (global (;4;) i32 (i32.const 65536))
  (global (;5;) i32 (i32.const 65536))
  (global (;6;) i32 (i32.const 65536))
  (global (;7;) i32 (i32.const 16777216))
  (global (;8;) i32 (i32.const 0))
  (global (;9;) i32 (i32.const 1))
  (global (;10;) i32 (i32.const 65536))
  (export "memory" (memory 0))
  (export "__wasm_call_ctors" (func 0))
  (export "__stack_pointer" (global 0))
  (export "mlp_forward" (func 1))
  (export "__dso_handle" (global 1))
  (export "__data_end" (global 2))
  (export "__stack_low" (global 3))
  (export "__stack_high" (global 4))
  (export "__global_base" (global 5))
  (export "__heap_base" (global 6))
  (export "__heap_end" (global 7))
  (export "__memory_base" (global 8))
  (export "__table_base" (global 9))
  (export "__wasm_first_page_end" (global 10)))
