;; dom.todomvc-journey.v1 — kernel: todomvc_engine
;; WebAssembly Text (WAT) baseline implementation
;; Exports: todomvc_engine

(module $todomvc_engine_c.wasm
  (type $t0 (func))
  (type $t1 (func (param i32 i32 i32 i32) (result i32)))
  (type $t2 (func (result i32)))
  (func $__wasm_call_ctors (type $t0))
  (func $run (type $t1) (param $p0 i32) (param $p1 i32) (param $p2 i32) (param $p3 i32) (result i32)
    (local $l4 i32) (local $l5 i32) (local $l6 i32) (local $l7 i32) (local $l8 i32) (local $l9 i32) (local $l10 i32) (local $l11 i32) (local $l12 i32)
    i32.const -1
    local.set $l4
    block $B0
      local.get $p0
      i32.const 150
      i32.gt_u
      br_if $B0
      i32.const 0
      local.set $l4
      local.get $p3
      i32.const 0
      i32.const 201
      memory.fill
      i32.const 0
      i32.const 0
      i32.store offset=65540
      i32.const 0
      i32.const 0
      i32.store offset=65536
      i32.const 0
      i32.const 0
      i32.store offset=65544
      i32.const 0
      i32.const 0
      i32.store offset=65548
      i32.const 0
      i32.const 0
      i32.store offset=65552
      i32.const 0
      i32.const 0
      i32.store offset=65556
      i32.const 0
      i32.const 0
      i32.store offset=65560
      i32.const 0
      i32.const 0
      i32.store offset=65564
      local.get $p0
      i32.eqz
      br_if $B0
      i32.const 0
      local.set $l5
      local.get $p0
      local.set $l6
      loop $L1
        block $B2
          local.get $p1
          local.get $l5
          i32.add
          local.tee $l7
          i32.const 4
          i32.add
          i32.load
          local.tee $l8
          i32.const 99
          i32.le_u
          br_if $B2
          i32.const -1
          return
        end
        block $B3
          local.get $l7
          i32.const 12
          i32.add
          i32.load
          local.tee $l9
          i32.const 1
          i32.le_u
          br_if $B3
          i32.const -1
          return
        end
        local.get $l7
        i32.const 8
        i32.add
        i32.load
        local.set $l10
        i32.const -1
        local.set $l4
        block $B4
          block $B5
            block $B6
              block $B7
                block $B8
                  block $B9
                    local.get $l7
                    i32.load
                    local.tee $l11
                    i32.const -1
                    i32.add
                    br_table $B9 $B8 $B7 $B6 $B5 $B0
                  end
                  local.get $p3
                  local.get $l8
                  i32.add
                  local.tee $l7
                  i32.load8_u
                  i32.const 1
                  i32.and
                  br_if $B0
                  local.get $l7
                  i32.const 0
                  i32.store8 offset=100
                  local.get $l7
                  i32.const 1
                  i32.store8
                  i32.const 2
                  local.set $l4
                  i32.const 65552
                  local.set $l7
                  br $B4
                end
                local.get $p3
                local.get $l8
                i32.add
                local.tee $l7
                i32.load8_u
                local.tee $l12
                i32.const 1
                i32.and
                i32.eqz
                br_if $B0
                local.get $l7
                local.get $l12
                i32.const 2
                i32.xor
                i32.store8
                i32.const 1
                local.set $l4
                i32.const 65548
                local.set $l7
                br $B4
              end
              local.get $l10
              i32.const 2
              i32.gt_u
              br_if $B0
              local.get $p3
              local.get $l10
              i32.store8 offset=200
              i32.const 1
              local.set $l4
              i32.const 65544
              local.set $l7
              br $B4
            end
            local.get $l10
            i32.const 1
            i32.ne
            br_if $B0
            local.get $p3
            local.get $l8
            i32.add
            local.tee $l7
            i32.load8_u
            i32.const 1
            i32.and
            i32.eqz
            br_if $B0
            i32.const 1
            local.set $l4
            local.get $l7
            i32.const 1
            i32.store8 offset=100
            i32.const 65536
            local.set $l7
            br $B4
          end
          local.get $p3
          local.get $l8
          i32.add
          local.tee $l7
          i32.load8_u
          i32.const 1
          i32.and
          i32.eqz
          br_if $B0
          local.get $l7
          i32.const 0
          i32.store8
          i32.const 1
          local.set $l4
          i32.const 65540
          local.set $l7
        end
        local.get $l7
        local.get $l7
        i32.load
        i32.const 1
        i32.add
        i32.store
        i32.const 0
        i32.const 0
        i32.load offset=65564
        local.get $l4
        i32.add
        i32.store offset=65564
        local.get $p2
        local.get $l5
        i32.add
        local.tee $l7
        local.get $l11
        i32.store
        local.get $l7
        i32.const 12
        i32.add
        local.get $l9
        i32.store
        local.get $l7
        i32.const 8
        i32.add
        local.get $l10
        i32.store
        local.get $l7
        i32.const 4
        i32.add
        local.get $l8
        i32.store
        i32.const 0
        i32.const 0
        i32.load offset=65556
        i32.const 1
        i32.add
        i32.store offset=65556
        i32.const 0
        i32.const 0
        i32.load offset=65560
        i32.const 1
        i32.add
        i32.store offset=65560
        local.get $l5
        i32.const 16
        i32.add
        local.set $l5
        local.get $l6
        i32.const -1
        i32.add
        local.tee $l6
        br_if $L1
      end
      local.get $p0
      local.set $l4
    end
    local.get $l4)
  (func $counter_actions (type $t2) (result i32)
    i32.const 0
    i32.load offset=65556)
  (func $counter_adds (type $t2) (result i32)
    i32.const 0
    i32.load offset=65552)
  (func $counter_toggles (type $t2) (result i32)
    i32.const 0
    i32.load offset=65548)
  (func $counter_filters (type $t2) (result i32)
    i32.const 0
    i32.load offset=65544)
  (func $counter_removes (type $t2) (result i32)
    i32.const 0
    i32.load offset=65540)
  (func $counter_edits (type $t2) (result i32)
    i32.const 0
    i32.load offset=65536)
  (func $counter_state_writes (type $t2) (result i32)
    i32.const 0
    i32.load offset=65564)
  (func $counter_commands_emitted (type $t2) (result i32)
    i32.const 0
    i32.load offset=65560)
  (table $__indirect_function_table 1 1 funcref)
  (memory $memory 16)
  (global $__stack_pointer (mut i32) (i32.const 65536))
  (global $__dso_handle i32 (i32.const 65536))
  (global $__data_end i32 (i32.const 65568))
  (global $__stack_low i32 (i32.const 0))
  (global $__stack_high i32 (i32.const 65536))
  (global $__global_base i32 (i32.const 65536))
  (global $__heap_base i32 (i32.const 65568))
  (global $__heap_end i32 (i32.const 1048576))
  (global $__memory_base i32 (i32.const 0))
  (global $__table_base i32 (i32.const 1))
  (global $__wasm_first_page_end i32 (i32.const 65536))
  (export "memory" (memory $memory))
  (export "__wasm_call_ctors" (func $__wasm_call_ctors))
  (export "__stack_pointer" (global $__stack_pointer))
  (export "run" (func $run))
  (export "counter_actions" (func $counter_actions))
  (export "counter_adds" (func $counter_adds))
  (export "counter_toggles" (func $counter_toggles))
  (export "counter_filters" (func $counter_filters))
  (export "counter_removes" (func $counter_removes))
  (export "counter_edits" (func $counter_edits))
  (export "counter_state_writes" (func $counter_state_writes))
  (export "counter_commands_emitted" (func $counter_commands_emitted))
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
