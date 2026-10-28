;; crypto.file-integrity.v1 — kernel: sha256
;; WebAssembly Text (WAT) baseline implementation
;; Exports: sha256

(module $sha256_c.wasm
  (type $t0 (func))
  (type $t1 (func (param i32 i32)))
  (type $t2 (func (result i32)))
  (func $__wasm_call_ctors (type $t0))
  (func $sha256_reset (type $t0)
    i32.const 0
    i32.const -1150833019
    i32.store offset=65796
    i32.const 0
    i32.const 1779033703
    i32.store offset=65792
    i32.const 0
    i32.const 1013904242
    i32.store offset=65800
    i32.const 0
    i32.const -1521486534
    i32.store offset=65804
    i32.const 0
    i32.const 1359893119
    i32.store offset=65808
    i32.const 0
    i32.const -1694144372
    i32.store offset=65812
    i32.const 0
    i32.const 528734635
    i32.store offset=65816
    i32.const 0
    i32.const 1541459225
    i32.store offset=65820
    i32.const 0
    i64.const 0
    i64.store offset=65832
    i32.const 0
    i32.const 0
    i32.store offset=65824)
  (func $sha256_update (type $t1) (param $p0 i32) (param $p1 i32)
    (local $l2 i32) (local $l3 i32) (local $l4 i32) (local $l5 i32) (local $l6 i32) (local $l7 i32) (local $l8 i32) (local $l9 i32)
    i32.const 0
    i32.const 0
    i64.load offset=65832
    local.get $p1
    i64.extend_i32_u
    i64.add
    i64.store offset=65832
    block $B0
      local.get $p1
      i32.eqz
      br_if $B0
      i32.const 0
      i32.load offset=65824
      local.set $l2
      loop $L1
        i32.const 64
        local.get $l2
        i32.sub
        local.tee $l3
        local.get $p1
        local.get $l3
        local.get $p1
        i32.lt_u
        select
        local.set $l4
        block $B2
          local.get $l2
          i32.const 64
          i32.eq
          br_if $B2
          local.get $l4
          i32.const 3
          i32.and
          local.set $l5
          i32.const 0
          local.set $l6
          block $B3
            local.get $l4
            i32.const 4
            i32.lt_u
            br_if $B3
            local.get $l2
            i32.const 65840
            i32.add
            local.set $l7
            local.get $l4
            i32.const -4
            i32.and
            local.set $l8
            i32.const 0
            local.set $l6
            loop $L4
              local.get $l7
              local.get $l6
              i32.add
              local.tee $l3
              local.get $p0
              local.get $l6
              i32.add
              local.tee $l9
              i32.load8_u
              i32.store8
              local.get $l3
              i32.const 1
              i32.add
              local.get $l9
              i32.const 1
              i32.add
              i32.load8_u
              i32.store8
              local.get $l3
              i32.const 2
              i32.add
              local.get $l9
              i32.const 2
              i32.add
              i32.load8_u
              i32.store8
              local.get $l3
              i32.const 3
              i32.add
              local.get $l9
              i32.const 3
              i32.add
              i32.load8_u
              i32.store8
              local.get $l8
              local.get $l6
              i32.const 4
              i32.add
              local.tee $l6
              i32.ne
              br_if $L4
            end
            local.get $l5
            i32.eqz
            br_if $B2
          end
          local.get $p0
          local.get $l6
          i32.add
          local.set $l3
          local.get $l2
          local.get $l6
          i32.add
          i32.const 65840
          i32.add
          local.set $l6
          loop $L5
            local.get $l6
            local.get $l3
            i32.load8_u
            i32.store8
            local.get $l3
            i32.const 1
            i32.add
            local.set $l3
            local.get $l6
            i32.const 1
            i32.add
            local.set $l6
            local.get $l5
            i32.const -1
            i32.add
            local.tee $l5
            br_if $L5
          end
        end
        i32.const 0
        local.get $l4
        local.get $l2
        i32.add
        local.tee $l2
        i32.store offset=65824
        local.get $p1
        local.get $l4
        i32.sub
        local.set $p1
        block $B6
          local.get $l2
          i32.const 64
          i32.ne
          br_if $B6
          call $compress
          i32.const 0
          local.set $l2
          i32.const 0
          i32.const 0
          i32.store offset=65824
        end
        local.get $p0
        local.get $l4
        i32.add
        local.set $p0
        local.get $p1
        br_if $L1
      end
    end)
  (func $compress (type $t0)
    (local $l0 i32) (local $l1 i32) (local $l2 i32) (local $l3 i32) (local $l4 i32) (local $l5 i32) (local $l6 i32) (local $l7 i32) (local $l8 i32) (local $l9 i32) (local $l10 i32) (local $l11 i32) (local $l12 i32) (local $l13 i32) (local $l14 i32) (local $l15 i32) (local $l16 i32) (local $l17 i32) (local $l18 i32) (local $l19 i32) (local $l20 i32) (local $l21 i32)
    global.get $__stack_pointer
    i32.const 256
    i32.sub
    local.tee $l0
    global.set $__stack_pointer
    i32.const 0
    local.set $l1
    local.get $l0
    i32.const 0
    i32.load offset=65840
    local.tee $l2
    i32.const 16711935
    i32.and
    i32.const 8
    i32.rotr
    local.get $l2
    i32.const 24
    i32.rotr
    i32.const 16711935
    i32.and
    i32.or
    i32.store
    local.get $l0
    i32.const 0
    i32.load offset=65844
    local.tee $l2
    i32.const 16711935
    i32.and
    i32.const 8
    i32.rotr
    local.get $l2
    i32.const 24
    i32.rotr
    i32.const 16711935
    i32.and
    i32.or
    i32.store offset=4
    local.get $l0
    i32.const 0
    i32.load offset=65848
    local.tee $l2
    i32.const 16711935
    i32.and
    i32.const 8
    i32.rotr
    local.get $l2
    i32.const 24
    i32.rotr
    i32.const 16711935
    i32.and
    i32.or
    i32.store offset=8
    local.get $l0
    i32.const 0
    i32.load offset=65852
    local.tee $l2
    i32.const 16711935
    i32.and
    i32.const 8
    i32.rotr
    local.get $l2
    i32.const 24
    i32.rotr
    i32.const 16711935
    i32.and
    i32.or
    i32.store offset=12
    local.get $l0
    i32.const 0
    i32.load offset=65856
    local.tee $l2
    i32.const 16711935
    i32.and
    i32.const 8
    i32.rotr
    local.get $l2
    i32.const 24
    i32.rotr
    i32.const 16711935
    i32.and
    i32.or
    i32.store offset=16
    local.get $l0
    i32.const 0
    i32.load offset=65860
    local.tee $l2
    i32.const 16711935
    i32.and
    i32.const 8
    i32.rotr
    local.get $l2
    i32.const 24
    i32.rotr
    i32.const 16711935
    i32.and
    i32.or
    i32.store offset=20
    local.get $l0
    i32.const 0
    i32.load offset=65864
    local.tee $l2
    i32.const 16711935
    i32.and
    i32.const 8
    i32.rotr
    local.get $l2
    i32.const 24
    i32.rotr
    i32.const 16711935
    i32.and
    i32.or
    i32.store offset=24
    local.get $l0
    i32.const 0
    i32.load offset=65868
    local.tee $l2
    i32.const 16711935
    i32.and
    i32.const 8
    i32.rotr
    local.get $l2
    i32.const 24
    i32.rotr
    i32.const 16711935
    i32.and
    i32.or
    i32.store offset=28
    local.get $l0
    i32.const 0
    i32.load offset=65872
    local.tee $l2
    i32.const 16711935
    i32.and
    i32.const 8
    i32.rotr
    local.get $l2
    i32.const 24
    i32.rotr
    i32.const 16711935
    i32.and
    i32.or
    i32.store offset=32
    local.get $l0
    i32.const 0
    i32.load offset=65876
    local.tee $l2
    i32.const 16711935
    i32.and
    i32.const 8
    i32.rotr
    local.get $l2
    i32.const 24
    i32.rotr
    i32.const 16711935
    i32.and
    i32.or
    i32.store offset=36
    local.get $l0
    i32.const 0
    i32.load offset=65880
    local.tee $l2
    i32.const 16711935
    i32.and
    i32.const 8
    i32.rotr
    local.get $l2
    i32.const 24
    i32.rotr
    i32.const 16711935
    i32.and
    i32.or
    i32.store offset=40
    local.get $l0
    i32.const 0
    i32.load offset=65884
    local.tee $l2
    i32.const 16711935
    i32.and
    i32.const 8
    i32.rotr
    local.get $l2
    i32.const 24
    i32.rotr
    i32.const 16711935
    i32.and
    i32.or
    i32.store offset=44
    local.get $l0
    i32.const 0
    i32.load offset=65888
    local.tee $l2
    i32.const 16711935
    i32.and
    i32.const 8
    i32.rotr
    local.get $l2
    i32.const 24
    i32.rotr
    i32.const 16711935
    i32.and
    i32.or
    i32.store offset=48
    local.get $l0
    i32.const 0
    i32.load offset=65892
    local.tee $l2
    i32.const 16711935
    i32.and
    i32.const 8
    i32.rotr
    local.get $l2
    i32.const 24
    i32.rotr
    i32.const 16711935
    i32.and
    i32.or
    i32.store offset=52
    local.get $l0
    i32.const 0
    i32.load offset=65896
    local.tee $l2
    i32.const 16711935
    i32.and
    i32.const 8
    i32.rotr
    local.get $l2
    i32.const 24
    i32.rotr
    i32.const 16711935
    i32.and
    i32.or
    i32.store offset=56
    local.get $l0
    i32.const 0
    i32.load offset=65900
    local.tee $l2
    i32.const 16711935
    i32.and
    i32.const 8
    i32.rotr
    local.get $l2
    i32.const 24
    i32.rotr
    i32.const 16711935
    i32.and
    i32.or
    i32.store offset=60
    loop $L0
      local.get $l0
      local.get $l1
      i32.add
      local.tee $l2
      i32.const 64
      i32.add
      local.get $l2
      i32.const 4
      i32.add
      i32.load
      local.tee $l3
      i32.const 25
      i32.rotl
      local.get $l3
      i32.const 14
      i32.rotl
      i32.xor
      local.get $l3
      i32.const 3
      i32.shr_u
      i32.xor
      local.get $l2
      i32.load
      i32.add
      local.get $l2
      i32.const 36
      i32.add
      i32.load
      i32.add
      local.get $l2
      i32.const 56
      i32.add
      i32.load
      local.tee $l2
      i32.const 15
      i32.rotl
      local.get $l2
      i32.const 13
      i32.rotl
      i32.xor
      local.get $l2
      i32.const 10
      i32.shr_u
      i32.xor
      i32.add
      i32.store
      local.get $l1
      i32.const 4
      i32.add
      local.tee $l1
      i32.const 192
      i32.ne
      br_if $L0
    end
    i32.const 0
    local.set $l4
    i32.const 0
    i32.load offset=65792
    local.tee $l5
    local.set $l6
    i32.const 0
    i32.load offset=65796
    local.tee $l7
    local.set $l2
    i32.const 0
    i32.load offset=65800
    local.tee $l8
    local.set $l3
    i32.const 0
    i32.load offset=65804
    local.tee $l9
    local.set $l10
    i32.const 0
    i32.load offset=65820
    local.tee $l11
    local.set $l12
    i32.const 0
    i32.load offset=65816
    local.tee $l13
    local.set $l14
    i32.const 0
    i32.load offset=65812
    local.tee $l15
    local.set $l16
    i32.const 0
    i32.load offset=65808
    local.tee $l17
    local.set $l18
    loop $L1
      local.get $l10
      local.set $l19
      local.get $l3
      local.set $l10
      local.get $l2
      local.set $l3
      local.get $l6
      local.tee $l2
      i32.const 30
      i32.rotl
      local.get $l2
      i32.const 19
      i32.rotl
      i32.xor
      local.get $l2
      i32.const 10
      i32.rotl
      i32.xor
      local.get $l2
      local.get $l3
      local.get $l10
      i32.xor
      i32.and
      local.get $l3
      local.get $l10
      i32.and
      i32.xor
      i32.add
      local.get $l12
      local.get $l18
      local.tee $l1
      i32.const 26
      i32.rotl
      local.get $l1
      i32.const 21
      i32.rotl
      i32.xor
      local.get $l1
      i32.const 7
      i32.rotl
      i32.xor
      i32.add
      local.get $l16
      local.tee $l20
      local.get $l14
      local.tee $l21
      i32.xor
      local.get $l1
      i32.and
      local.get $l21
      i32.xor
      i32.add
      local.get $l4
      i32.const 65536
      i32.add
      i32.load
      i32.add
      local.get $l0
      local.get $l4
      i32.add
      i32.load
      i32.add
      local.tee $l18
      i32.add
      local.set $l6
      local.get $l18
      local.get $l19
      i32.add
      local.set $l18
      local.get $l21
      local.set $l12
      local.get $l20
      local.set $l14
      local.get $l1
      local.set $l16
      local.get $l4
      i32.const 4
      i32.add
      local.tee $l4
      i32.const 256
      i32.ne
      br_if $L1
    end
    i32.const 0
    local.get $l2
    local.get $l7
    i32.add
    i32.store offset=65796
    i32.const 0
    local.get $l6
    local.get $l5
    i32.add
    i32.store offset=65792
    i32.const 0
    local.get $l3
    local.get $l8
    i32.add
    i32.store offset=65800
    i32.const 0
    local.get $l10
    local.get $l9
    i32.add
    i32.store offset=65804
    i32.const 0
    local.get $l18
    local.get $l17
    i32.add
    i32.store offset=65808
    i32.const 0
    local.get $l1
    local.get $l15
    i32.add
    i32.store offset=65812
    i32.const 0
    local.get $l20
    local.get $l13
    i32.add
    i32.store offset=65816
    i32.const 0
    local.get $l21
    local.get $l11
    i32.add
    i32.store offset=65820
    local.get $l0
    i32.const 256
    i32.add
    global.set $__stack_pointer)
  (func $sha256_finish (type $t2) (result i32)
    (local $l0 i32) (local $l1 i32) (local $l2 i64)
    i32.const 0
    i32.load offset=65824
    local.tee $l0
    i32.const 128
    i32.store8 offset=65840
    i32.const 0
    local.get $l0
    i32.const 1
    i32.add
    local.tee $l1
    i32.store offset=65824
    i32.const 0
    i64.load offset=65832
    local.set $l2
    block $B0
      block $B1
        block $B2
          local.get $l1
          i32.const 57
          i32.lt_u
          br_if $B2
          block $B3
            local.get $l1
            i32.const 63
            i32.gt_u
            br_if $B3
            block $B4
              i32.const 63
              local.get $l0
              i32.sub
              local.tee $l0
              i32.eqz
              br_if $B4
              local.get $l1
              i32.const 65840
              i32.add
              i32.const 0
              local.get $l0
              memory.fill
            end
            i32.const 0
            i32.const 64
            i32.store offset=65824
          end
          call $compress
          i32.const 0
          local.set $l1
          br $B1
        end
        local.get $l1
        i32.const 56
        i32.eq
        br_if $B0
      end
      block $B5
        i32.const 56
        local.get $l1
        i32.sub
        local.tee $l0
        i32.eqz
        br_if $B5
        local.get $l1
        i32.const 65840
        i32.add
        i32.const 0
        local.get $l0
        memory.fill
      end
      i32.const 0
      i32.const 56
      i32.store offset=65824
    end
    i32.const 0
    local.get $l2
    i64.const 59
    i64.shl
    local.get $l2
    i64.const 43
    i64.shl
    i64.const 71776119061217280
    i64.and
    i64.or
    local.get $l2
    i64.const 27
    i64.shl
    i64.const 280375465082880
    i64.and
    local.get $l2
    i64.const 11
    i64.shl
    i64.const 1095216660480
    i64.and
    i64.or
    i64.or
    local.get $l2
    i64.const 5
    i64.shr_u
    i64.const 4278190080
    i64.and
    local.get $l2
    i64.const 21
    i64.shr_u
    i64.const 16711680
    i64.and
    i64.or
    local.get $l2
    i64.const 37
    i64.shr_u
    i64.const 65280
    i64.and
    local.get $l2
    i64.const 3
    i64.shl
    i64.const 56
    i64.shr_u
    i64.or
    i64.or
    i64.or
    i64.store offset=65896
    call $compress
    i32.const 0
    i32.const 0
    i32.load offset=65792
    local.tee $l1
    i32.const 16711935
    i32.and
    i32.const 8
    i32.rotr
    local.get $l1
    i32.const 24
    i32.rotr
    i32.const 16711935
    i32.and
    i32.or
    i32.store offset=65904
    i32.const 0
    i32.const 0
    i32.load offset=65796
    local.tee $l1
    i32.const 16711935
    i32.and
    i32.const 8
    i32.rotr
    local.get $l1
    i32.const 24
    i32.rotr
    i32.const 16711935
    i32.and
    i32.or
    i32.store offset=65908
    i32.const 0
    i32.const 0
    i32.load offset=65800
    local.tee $l1
    i32.const 16711935
    i32.and
    i32.const 8
    i32.rotr
    local.get $l1
    i32.const 24
    i32.rotr
    i32.const 16711935
    i32.and
    i32.or
    i32.store offset=65912
    i32.const 0
    i32.const 0
    i32.load offset=65804
    local.tee $l1
    i32.const 16711935
    i32.and
    i32.const 8
    i32.rotr
    local.get $l1
    i32.const 24
    i32.rotr
    i32.const 16711935
    i32.and
    i32.or
    i32.store offset=65916
    i32.const 0
    i32.const 0
    i32.load offset=65808
    local.tee $l1
    i32.const 16711935
    i32.and
    i32.const 8
    i32.rotr
    local.get $l1
    i32.const 24
    i32.rotr
    i32.const 16711935
    i32.and
    i32.or
    i32.store offset=65920
    i32.const 0
    i32.const 0
    i32.load offset=65812
    local.tee $l1
    i32.const 16711935
    i32.and
    i32.const 8
    i32.rotr
    local.get $l1
    i32.const 24
    i32.rotr
    i32.const 16711935
    i32.and
    i32.or
    i32.store offset=65924
    i32.const 0
    i32.const 0
    i32.load offset=65816
    local.tee $l1
    i32.const 16711935
    i32.and
    i32.const 8
    i32.rotr
    local.get $l1
    i32.const 24
    i32.rotr
    i32.const 16711935
    i32.and
    i32.or
    i32.store offset=65928
    i32.const 0
    i32.const 0
    i32.load offset=65820
    local.tee $l1
    i32.const 16711935
    i32.and
    i32.const 8
    i32.rotr
    local.get $l1
    i32.const 24
    i32.rotr
    i32.const 16711935
    i32.and
    i32.or
    i32.store offset=65932
    i32.const 65904)
  (table $__indirect_function_table 1 1 funcref)
  (memory $memory 16)
  (global $__stack_pointer (mut i32) (i32.const 65536))
  (global $__dso_handle i32 (i32.const 65536))
  (global $__data_end i32 (i32.const 65936))
  (global $__stack_low i32 (i32.const 0))
  (global $__stack_high i32 (i32.const 65536))
  (global $__global_base i32 (i32.const 65536))
  (global $__heap_base i32 (i32.const 65936))
  (global $__heap_end i32 (i32.const 1048576))
  (global $__memory_base i32 (i32.const 0))
  (global $__table_base i32 (i32.const 1))
  (global $__wasm_first_page_end i32 (i32.const 65536))
  (export "memory" (memory $memory))
  (export "__wasm_call_ctors" (func $__wasm_call_ctors))
  (export "__stack_pointer" (global $__stack_pointer))
  (export "sha256_reset" (func $sha256_reset))
  (export "sha256_update" (func $sha256_update))
  (export "sha256_finish" (func $sha256_finish))
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
  (data $.rodata (i32.const 65536) "\98/\8aB\91D7q\cf\fb\c0\b5\a5\db\b5\e9[\c2V9\f1\11\f1Y\a4\82?\92\d5^\1c\ab\98\aa\07\d8\01[\83\12\be\851$\c3}\0cUt]\ber\fe\b1\de\80\a7\06\dc\9bt\f1\9b\c1\c1i\9b\e4\86G\be\ef\c6\9d\c1\0f\cc\a1\0c$o,\e9-\aa\84tJ\dc\a9\b0\5c\da\88\f9vRQ>\98m\c61\a8\c8'\03\b0\c7\7fY\bf\f3\0b\e0\c6G\91\a7\d5Qc\ca\06g))\14\85\0a\b7'8!\1b.\fcm,M\13\0d8STs\0ae\bb\0ajv.\c9\c2\81\85,r\92\a1\e8\bf\a2Kf\1a\a8p\8bK\c2\a3Ql\c7\19\e8\92\d1$\06\99\d6\855\0e\f4p\a0j\10\16\c1\a4\19\08l7\1eLwH'\b5\bc\b04\b3\0c\1c9J\aa\d8NO\ca\9c[\f3o.h\ee\82\8ftoc\a5x\14x\c8\84\08\02\c7\8c\fa\ff\be\90\eblP\a4\f7\a3\f9\be\f2xq\c6"))
