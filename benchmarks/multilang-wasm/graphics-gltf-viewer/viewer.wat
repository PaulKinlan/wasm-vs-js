;; graphics.gltf-viewer.v1 — kernel: viewer
;; WebAssembly Text (WAT) baseline implementation
;; Exports: viewer

(module $viewer.wasm
  (type $t0 (func (result i32)))
  (type $t1 (func (param i32 i32) (result i32)))
  (type $t2 (func (param i32) (result i32)))
  (type $t3 (func (param i32 i32 i32 i32 i32 i32 i32 i32 i32 i32 i32) (result i32)))
  (func $heap_ptr (type $t0) (result i32)
    i32.const 65536)
  (func $output_ptr (type $t0) (result i32)
    i32.const 8065536)
  (func $validate_gltf (type $t1) (param $p0 i32) (param $p1 i32) (result i32)
    (local $l2 i32) (local $l3 i32) (local $l4 i32) (local $l5 i32) (local $l6 i32) (local $l7 i32) (local $l8 i32)
    global.get $__stack_pointer
    i32.const 16
    i32.sub
    local.tee $l2
    global.set $__stack_pointer
    i32.const -1
    local.set $l3
    block $B0
      local.get $p0
      i32.const 50331648
      i32.gt_u
      br_if $B0
      local.get $p1
      i32.const 50331648
      local.get $p0
      i32.sub
      i32.gt_u
      br_if $B0
      local.get $l2
      i32.const 0
      i32.store offset=12
      local.get $l2
      local.get $p0
      i32.const 65536
      i32.add
      local.tee $l4
      i32.store offset=4
      local.get $l2
      local.get $l4
      local.get $p1
      i32.add
      i32.store offset=8
      block $B1
        local.get $l2
        i32.const 4
        i32.add
        call $json_value
        br_if $B1
        i32.const -2
        local.set $l3
        br $B0
      end
      block $B2
        block $B3
          local.get $l2
          i32.load offset=4
          local.tee $l3
          local.get $l2
          i32.load offset=8
          local.tee $l5
          i32.ge_u
          br_if $B3
          loop $L4
            local.get $l3
            i32.load8_u
            i32.const -9
            i32.add
            local.tee $l6
            i32.const 23
            i32.gt_u
            br_if $B3
            i32.const 1
            local.get $l6
            i32.shl
            i32.const 8388627
            i32.and
            i32.eqz
            br_if $B3
            local.get $l2
            local.get $l3
            i32.const 1
            i32.add
            local.tee $l3
            i32.store offset=4
            local.get $l3
            local.get $l5
            i32.ne
            br_if $L4
            br $B2
          end
        end
        local.get $l3
        local.get $l5
        i32.eq
        br_if $B2
        i32.const -3
        local.set $l3
        br $B0
      end
      i32.const 1
      local.set $l3
      block $B5
        local.get $p1
        i32.eqz
        br_if $B5
        local.get $p1
        i32.const 3
        i32.and
        local.set $l5
        block $B6
          block $B7
            block $B8
              local.get $p1
              i32.const 4
              i32.ge_u
              br_if $B8
              i32.const -2128831035
              local.set $l3
              i32.const 0
              local.set $l7
              br $B7
            end
            local.get $p1
            i32.const -4
            i32.and
            local.set $l8
            i32.const -2128831035
            local.set $l3
            i32.const 0
            local.set $l7
            loop $L9
              local.get $l3
              local.get $l4
              local.get $l7
              i32.add
              local.tee $l6
              i32.load8_u
              i32.xor
              i32.const 16777619
              i32.mul
              local.get $l6
              i32.const 1
              i32.add
              i32.load8_u
              i32.xor
              i32.const 16777619
              i32.mul
              local.get $l6
              i32.const 2
              i32.add
              i32.load8_u
              i32.xor
              i32.const 16777619
              i32.mul
              local.get $l6
              i32.const 3
              i32.add
              i32.load8_u
              i32.xor
              i32.const 16777619
              i32.mul
              local.set $l3
              local.get $l8
              local.get $l7
              i32.const 4
              i32.add
              local.tee $l7
              i32.ne
              br_if $L9
            end
            local.get $l5
            i32.eqz
            br_if $B6
          end
          local.get $l7
          local.get $p0
          i32.add
          i32.const 65536
          i32.add
          local.set $l6
          loop $L10
            local.get $l3
            local.get $l6
            i32.load8_u
            i32.xor
            i32.const 16777619
            i32.mul
            local.set $l3
            local.get $l6
            i32.const 1
            i32.add
            local.set $l6
            local.get $l5
            i32.const -1
            i32.add
            local.tee $l5
            br_if $L10
          end
        end
        local.get $l3
        i32.const -360884316
        i32.ne
        local.set $l3
      end
      i32.const -4
      i32.const -4
      i32.const 0
      local.get $l3
      i32.const 1
      i32.and
      select
      local.get $p1
      i32.const 3083
      i32.ne
      select
      local.set $l3
    end
    local.get $l2
    i32.const 16
    i32.add
    global.set $__stack_pointer
    local.get $l3)
  (func $json_value (type $t2) (param $p0 i32) (result i32)
    (local $l1 i32) (local $l2 i32) (local $l3 i32) (local $l4 i32) (local $l5 i32)
    block $B0
      local.get $p0
      i32.load
      local.tee $l1
      local.get $p0
      i32.load offset=4
      local.tee $l2
      i32.ge_u
      br_if $B0
      loop $L1
        local.get $l1
        i32.load8_u
        i32.const -9
        i32.add
        local.tee $l3
        i32.const 23
        i32.gt_u
        br_if $B0
        i32.const 1
        local.get $l3
        i32.shl
        i32.const 8388627
        i32.and
        i32.eqz
        br_if $B0
        local.get $p0
        local.get $l1
        i32.const 1
        i32.add
        local.tee $l1
        i32.store
        local.get $l1
        local.get $l2
        i32.ne
        br_if $L1
      end
    end
    i32.const 0
    local.set $l4
    block $B2
      block $B3
        local.get $l1
        local.get $l2
        i32.ge_u
        br_if $B3
        block $B4
          block $B5
            block $B6
              block $B7
                block $B8
                  block $B9
                    block $B10
                      local.get $l1
                      i32.load8_u
                      local.tee $l5
                      i32.const -91
                      i32.add
                      br_table $B9 $B4 $B4 $B4 $B4 $B4 $B4 $B4 $B4 $B4 $B4 $B7 $B4 $B4 $B4 $B4 $B4 $B4 $B4 $B6 $B4 $B4 $B4 $B4 $B4 $B8 $B4 $B4 $B4 $B4 $B4 $B4 $B10 $B5
                    end
                    local.get $p0
                    local.get $p0
                    i32.load offset=8
                    local.tee $l5
                    i32.const 1
                    i32.add
                    i32.store offset=8
                    local.get $l5
                    i32.const 63
                    i32.gt_u
                    br_if $B3
                    local.get $p0
                    local.get $l1
                    i32.const 1
                    i32.add
                    local.tee $l3
                    i32.store
                    local.get $l1
                    i32.load8_u
                    i32.const 123
                    i32.ne
                    br_if $B3
                    block $B11
                      local.get $l3
                      local.get $l2
                      i32.ge_u
                      br_if $B11
                      loop $L12
                        local.get $l3
                        i32.load8_u
                        i32.const -9
                        i32.add
                        local.tee $l1
                        i32.const 23
                        i32.gt_u
                        br_if $B11
                        i32.const 1
                        local.get $l1
                        i32.shl
                        i32.const 8388627
                        i32.and
                        i32.eqz
                        br_if $B11
                        local.get $p0
                        local.get $l3
                        i32.const 1
                        i32.add
                        local.tee $l3
                        i32.store
                        local.get $l3
                        local.get $l2
                        i32.ne
                        br_if $L12
                      end
                    end
                    block $B13
                      local.get $l3
                      local.get $l2
                      i32.ge_u
                      br_if $B13
                      local.get $l3
                      i32.load8_u
                      i32.const 125
                      i32.ne
                      br_if $B13
                      local.get $p0
                      local.get $l5
                      i32.store offset=8
                      local.get $p0
                      local.get $l3
                      i32.const 1
                      i32.add
                      i32.store
                      i32.const 1
                      return
                    end
                    local.get $p0
                    call $json_string
                    i32.eqz
                    br_if $B3
                    loop $L14
                      block $B15
                        local.get $p0
                        i32.load
                        local.tee $l1
                        local.get $p0
                        i32.load offset=4
                        local.tee $l2
                        i32.ge_u
                        br_if $B15
                        loop $L16
                          local.get $l1
                          i32.load8_u
                          i32.const -9
                          i32.add
                          local.tee $l3
                          i32.const 23
                          i32.gt_u
                          br_if $B15
                          i32.const 1
                          local.get $l3
                          i32.shl
                          i32.const 8388627
                          i32.and
                          i32.eqz
                          br_if $B15
                          local.get $p0
                          local.get $l1
                          i32.const 1
                          i32.add
                          local.tee $l1
                          i32.store
                          local.get $l1
                          local.get $l2
                          i32.ne
                          br_if $L16
                        end
                      end
                      local.get $l1
                      local.get $l2
                      i32.ge_u
                      br_if $B3
                      local.get $p0
                      local.get $l1
                      i32.const 1
                      i32.add
                      local.tee $l3
                      i32.store
                      local.get $l1
                      i32.load8_u
                      i32.const 58
                      i32.ne
                      br_if $B3
                      block $B17
                        local.get $l3
                        local.get $l2
                        i32.ge_u
                        br_if $B17
                        loop $L18
                          local.get $l3
                          i32.load8_u
                          i32.const -9
                          i32.add
                          local.tee $l1
                          i32.const 23
                          i32.gt_u
                          br_if $B17
                          i32.const 1
                          local.get $l1
                          i32.shl
                          i32.const 8388627
                          i32.and
                          i32.eqz
                          br_if $B17
                          local.get $p0
                          local.get $l3
                          i32.const 1
                          i32.add
                          local.tee $l3
                          i32.store
                          local.get $l3
                          local.get $l2
                          i32.ne
                          br_if $L18
                        end
                      end
                      local.get $p0
                      call $json_value
                      i32.eqz
                      br_if $B3
                      block $B19
                        local.get $p0
                        i32.load
                        local.tee $l1
                        local.get $p0
                        i32.load offset=4
                        local.tee $l2
                        i32.ge_u
                        br_if $B19
                        loop $L20
                          local.get $l1
                          i32.load8_u
                          i32.const -9
                          i32.add
                          local.tee $l3
                          i32.const 23
                          i32.gt_u
                          br_if $B19
                          i32.const 1
                          local.get $l3
                          i32.shl
                          i32.const 8388627
                          i32.and
                          i32.eqz
                          br_if $B19
                          local.get $p0
                          local.get $l1
                          i32.const 1
                          i32.add
                          local.tee $l1
                          i32.store
                          local.get $l1
                          local.get $l2
                          i32.ne
                          br_if $L20
                        end
                      end
                      local.get $l1
                      local.get $l2
                      i32.ge_u
                      br_if $B3
                      local.get $l1
                      i32.load8_u
                      local.set $l5
                      local.get $p0
                      local.get $l1
                      i32.const 1
                      i32.add
                      local.tee $l3
                      i32.store
                      block $B21
                        local.get $l5
                        i32.const 125
                        i32.ne
                        br_if $B21
                        local.get $p0
                        local.get $p0
                        i32.load offset=8
                        i32.const -1
                        i32.add
                        i32.store offset=8
                        i32.const 1
                        return
                      end
                      local.get $l1
                      i32.load8_u
                      i32.const 44
                      i32.ne
                      br_if $B3
                      block $B22
                        local.get $l3
                        local.get $l2
                        i32.ge_u
                        br_if $B22
                        loop $L23
                          local.get $l3
                          i32.load8_u
                          i32.const -9
                          i32.add
                          local.tee $l1
                          i32.const 23
                          i32.gt_u
                          br_if $B22
                          i32.const 1
                          local.get $l1
                          i32.shl
                          i32.const 8388627
                          i32.and
                          i32.eqz
                          br_if $B22
                          local.get $p0
                          local.get $l3
                          i32.const 1
                          i32.add
                          local.tee $l3
                          i32.store
                          local.get $l3
                          local.get $l2
                          i32.ne
                          br_if $L23
                        end
                      end
                      local.get $p0
                      call $json_string
                      br_if $L14
                      br $B3
                    end
                  end
                  local.get $p0
                  local.get $p0
                  i32.load offset=8
                  local.tee $l5
                  i32.const 1
                  i32.add
                  i32.store offset=8
                  local.get $l5
                  i32.const 63
                  i32.gt_u
                  br_if $B3
                  local.get $p0
                  local.get $l1
                  i32.const 1
                  i32.add
                  local.tee $l3
                  i32.store
                  local.get $l1
                  i32.load8_u
                  i32.const 91
                  i32.ne
                  br_if $B3
                  block $B24
                    local.get $l3
                    local.get $l2
                    i32.ge_u
                    br_if $B24
                    loop $L25
                      local.get $l3
                      i32.load8_u
                      i32.const -9
                      i32.add
                      local.tee $l1
                      i32.const 23
                      i32.gt_u
                      br_if $B24
                      i32.const 1
                      local.get $l1
                      i32.shl
                      i32.const 8388627
                      i32.and
                      i32.eqz
                      br_if $B24
                      local.get $p0
                      local.get $l3
                      i32.const 1
                      i32.add
                      local.tee $l3
                      i32.store
                      local.get $l3
                      local.get $l2
                      i32.ne
                      br_if $L25
                    end
                  end
                  block $B26
                    local.get $l3
                    local.get $l2
                    i32.ge_u
                    br_if $B26
                    local.get $l3
                    i32.load8_u
                    i32.const 93
                    i32.ne
                    br_if $B26
                    local.get $p0
                    local.get $l5
                    i32.store offset=8
                    local.get $p0
                    local.get $l3
                    i32.const 1
                    i32.add
                    i32.store
                    i32.const 1
                    return
                  end
                  local.get $p0
                  call $json_value
                  i32.eqz
                  br_if $B3
                  loop $L27
                    block $B28
                      local.get $p0
                      i32.load
                      local.tee $l1
                      local.get $p0
                      i32.load offset=4
                      local.tee $l2
                      i32.ge_u
                      br_if $B28
                      loop $L29
                        local.get $l1
                        i32.load8_u
                        i32.const -9
                        i32.add
                        local.tee $l3
                        i32.const 23
                        i32.gt_u
                        br_if $B28
                        i32.const 1
                        local.get $l3
                        i32.shl
                        i32.const 8388627
                        i32.and
                        i32.eqz
                        br_if $B28
                        local.get $p0
                        local.get $l1
                        i32.const 1
                        i32.add
                        local.tee $l1
                        i32.store
                        local.get $l1
                        local.get $l2
                        i32.ne
                        br_if $L29
                      end
                    end
                    local.get $l1
                    local.get $l2
                    i32.ge_u
                    br_if $B3
                    local.get $l1
                    i32.load8_u
                    local.set $l5
                    local.get $p0
                    local.get $l1
                    i32.const 1
                    i32.add
                    local.tee $l3
                    i32.store
                    block $B30
                      local.get $l5
                      i32.const 93
                      i32.ne
                      br_if $B30
                      local.get $p0
                      local.get $p0
                      i32.load offset=8
                      i32.const -1
                      i32.add
                      i32.store offset=8
                      i32.const 1
                      return
                    end
                    local.get $l1
                    i32.load8_u
                    i32.const 44
                    i32.ne
                    br_if $B3
                    block $B31
                      local.get $l3
                      local.get $l2
                      i32.ge_u
                      br_if $B31
                      loop $L32
                        local.get $l3
                        i32.load8_u
                        i32.const -9
                        i32.add
                        local.tee $l1
                        i32.const 23
                        i32.gt_u
                        br_if $B31
                        i32.const 1
                        local.get $l1
                        i32.shl
                        i32.const 8388627
                        i32.and
                        i32.eqz
                        br_if $B31
                        local.get $p0
                        local.get $l3
                        i32.const 1
                        i32.add
                        local.tee $l3
                        i32.store
                        local.get $l3
                        local.get $l2
                        i32.ne
                        br_if $L32
                      end
                    end
                    local.get $p0
                    call $json_value
                    br_if $L27
                    br $B3
                  end
                end
                local.get $p0
                local.get $l1
                i32.const 1
                i32.add
                local.tee $l3
                i32.store
                local.get $l1
                i32.load8_u
                i32.const 116
                i32.ne
                br_if $B3
                local.get $l3
                local.get $l2
                i32.ge_u
                br_if $B3
                local.get $p0
                local.get $l1
                i32.const 2
                i32.add
                local.tee $l3
                i32.store
                local.get $l1
                i32.load8_u offset=1
                i32.const 114
                i32.ne
                br_if $B3
                local.get $l3
                local.get $l2
                i32.ge_u
                br_if $B3
                local.get $p0
                local.get $l1
                i32.const 3
                i32.add
                local.tee $l3
                i32.store
                local.get $l1
                i32.load8_u offset=2
                i32.const 117
                i32.ne
                br_if $B3
                local.get $l3
                local.get $l2
                i32.ge_u
                br_if $B3
                local.get $p0
                local.get $l1
                i32.const 4
                i32.add
                i32.store
                local.get $l1
                i32.load8_u offset=3
                i32.const 101
                i32.eq
                return
              end
              local.get $p0
              local.get $l1
              i32.const 1
              i32.add
              local.tee $l3
              i32.store
              local.get $l1
              i32.load8_u
              i32.const 102
              i32.ne
              br_if $B3
              local.get $l3
              local.get $l2
              i32.ge_u
              br_if $B3
              local.get $p0
              local.get $l1
              i32.const 2
              i32.add
              local.tee $l3
              i32.store
              local.get $l1
              i32.load8_u offset=1
              i32.const 97
              i32.ne
              br_if $B3
              local.get $l3
              local.get $l2
              i32.ge_u
              br_if $B3
              local.get $p0
              local.get $l1
              i32.const 3
              i32.add
              local.tee $l3
              i32.store
              local.get $l1
              i32.load8_u offset=2
              i32.const 108
              i32.ne
              br_if $B3
              local.get $l3
              local.get $l2
              i32.ge_u
              br_if $B3
              local.get $p0
              local.get $l1
              i32.const 4
              i32.add
              local.tee $l3
              i32.store
              local.get $l1
              i32.load8_u offset=3
              i32.const 115
              i32.ne
              br_if $B3
              local.get $l3
              local.get $l2
              i32.ge_u
              br_if $B3
              local.get $p0
              local.get $l1
              i32.const 5
              i32.add
              i32.store
              local.get $l1
              i32.load8_u offset=4
              i32.const 101
              i32.eq
              return
            end
            local.get $p0
            local.get $l1
            i32.const 1
            i32.add
            local.tee $l3
            i32.store
            local.get $l1
            i32.load8_u
            i32.const 110
            i32.ne
            br_if $B3
            local.get $l3
            local.get $l2
            i32.ge_u
            br_if $B3
            local.get $p0
            local.get $l1
            i32.const 2
            i32.add
            local.tee $l3
            i32.store
            local.get $l1
            i32.load8_u offset=1
            i32.const 117
            i32.ne
            br_if $B3
            local.get $l3
            local.get $l2
            i32.ge_u
            br_if $B3
            local.get $p0
            local.get $l1
            i32.const 3
            i32.add
            local.tee $l3
            i32.store
            local.get $l1
            i32.load8_u offset=2
            i32.const 108
            i32.ne
            br_if $B3
            local.get $l3
            local.get $l2
            i32.ge_u
            br_if $B3
            local.get $p0
            local.get $l1
            i32.const 4
            i32.add
            i32.store
            local.get $l1
            i32.load8_u offset=3
            i32.const 108
            i32.eq
            return
          end
          local.get $l5
          i32.const 34
          i32.eq
          br_if $B2
        end
        local.get $l1
        local.set $l3
        block $B33
          local.get $l5
          i32.const 45
          i32.ne
          br_if $B33
          local.get $p0
          local.get $l1
          i32.const 1
          i32.add
          local.tee $l3
          i32.store
        end
        local.get $l3
        local.get $l2
        i32.ge_u
        br_if $B3
        block $B34
          block $B35
            local.get $l3
            i32.load8_u
            local.tee $l5
            i32.const 48
            i32.ne
            br_if $B35
            local.get $p0
            local.get $l3
            i32.const 1
            i32.add
            local.tee $l3
            i32.store
            br $B34
          end
          local.get $l5
          i32.const -58
          i32.add
          i32.const 255
          i32.and
          i32.const 247
          i32.lt_u
          br_if $B3
          loop $L36
            local.get $l3
            i32.load8_u
            i32.const -48
            i32.add
            i32.const 255
            i32.and
            i32.const 9
            i32.gt_u
            br_if $B34
            local.get $p0
            local.get $l3
            i32.const 1
            i32.add
            local.tee $l3
            i32.store
            local.get $l3
            local.get $l2
            i32.ne
            br_if $L36
          end
          local.get $l2
          local.set $l3
        end
        block $B37
          local.get $l3
          local.get $l2
          i32.ge_u
          br_if $B37
          local.get $l3
          i32.load8_u
          i32.const 46
          i32.ne
          br_if $B37
          local.get $p0
          local.get $l3
          i32.const 1
          i32.add
          local.tee $l3
          i32.store
          local.get $l3
          local.get $l2
          i32.ge_u
          br_if $B3
          local.get $l3
          i32.load8_u
          i32.const -58
          i32.add
          i32.const 255
          i32.and
          i32.const 246
          i32.lt_u
          br_if $B3
          loop $L38
            local.get $l3
            i32.load8_u
            i32.const -48
            i32.add
            i32.const 255
            i32.and
            i32.const 9
            i32.gt_u
            br_if $B37
            local.get $p0
            local.get $l3
            i32.const 1
            i32.add
            local.tee $l3
            i32.store
            local.get $l3
            local.get $l2
            i32.ne
            br_if $L38
          end
          local.get $l2
          local.set $l3
        end
        block $B39
          local.get $l3
          local.get $l2
          i32.ge_u
          br_if $B39
          local.get $l3
          i32.load8_u
          i32.const 32
          i32.or
          i32.const 101
          i32.ne
          br_if $B39
          local.get $p0
          local.get $l3
          i32.const 1
          i32.add
          local.tee $l5
          i32.store
          block $B40
            local.get $l5
            local.get $l2
            i32.ge_u
            br_if $B40
            block $B41
              local.get $l5
              i32.load8_u
              i32.const -43
              i32.add
              br_table $B41 $B40 $B41 $B40
            end
            local.get $p0
            local.get $l3
            i32.const 2
            i32.add
            local.tee $l5
            i32.store
          end
          local.get $l5
          local.get $l2
          i32.ge_u
          br_if $B3
          local.get $l5
          i32.load8_u
          i32.const -58
          i32.add
          i32.const 255
          i32.and
          i32.const 246
          i32.lt_u
          br_if $B3
          loop $L42
            block $B43
              local.get $l5
              i32.load8_u
              i32.const -48
              i32.add
              i32.const 255
              i32.and
              i32.const 9
              i32.le_u
              br_if $B43
              local.get $l5
              local.set $l3
              br $B39
            end
            local.get $p0
            local.get $l5
            i32.const 1
            i32.add
            local.tee $l5
            i32.store
            local.get $l5
            local.get $l2
            i32.ne
            br_if $L42
          end
          local.get $l2
          local.set $l3
        end
        local.get $l3
        local.get $l1
        i32.gt_u
        local.set $l4
      end
      local.get $l4
      return
    end
    local.get $p0
    call $json_string)
  (func $json_string (type $t2) (param $p0 i32) (result i32)
    (local $l1 i32) (local $l2 i32) (local $l3 i32) (local $l4 i32) (local $l5 i32) (local $l6 i32)
    block $B0
      block $B1
        local.get $p0
        i32.load
        local.tee $l1
        local.get $p0
        i32.load offset=4
        local.tee $l2
        i32.ge_u
        br_if $B1
        local.get $l1
        i32.load8_u
        i32.const 34
        i32.ne
        br_if $B1
        local.get $p0
        local.get $l1
        i32.const 1
        i32.add
        local.tee $l1
        i32.store
        local.get $l1
        local.get $l2
        i32.ge_u
        br_if $B1
        local.get $l2
        i32.const -2
        i32.add
        local.set $l3
        loop $L2
          i32.const 1
          local.set $l4
          local.get $p0
          local.get $l1
          local.tee $l5
          i32.const 1
          i32.add
          local.tee $l1
          i32.store
          local.get $l5
          i32.load8_u
          local.tee $l6
          i32.const 34
          i32.eq
          br_if $B0
          local.get $l6
          i32.const 32
          i32.lt_u
          br_if $B1
          block $B3
            local.get $l6
            i32.const 92
            i32.ne
            br_if $B3
            local.get $l1
            local.get $l2
            i32.ge_u
            br_if $B1
            local.get $p0
            local.get $l5
            i32.const 2
            i32.add
            local.tee $l1
            i32.store
            i32.const 0
            local.set $l4
            block $B4
              local.get $l5
              i32.load8_u offset=1
              i32.const -34
              i32.add
              br_table $B3 $B0 $B0 $B0 $B0 $B0 $B0 $B0 $B0 $B0 $B0 $B0 $B0 $B3 $B0 $B0 $B0 $B0 $B0 $B0 $B0 $B0 $B0 $B0 $B0 $B0 $B0 $B0 $B0 $B0 $B0 $B0 $B0 $B0 $B0 $B0 $B0 $B0 $B0 $B0 $B0 $B0 $B0 $B0 $B0 $B0 $B0 $B0 $B0 $B0 $B0 $B0 $B0 $B0 $B0 $B0 $B0 $B0 $B3 $B0 $B0 $B0 $B0 $B0 $B3 $B0 $B0 $B0 $B3 $B0 $B0 $B0 $B0 $B0 $B0 $B0 $B3 $B0 $B0 $B0 $B3 $B0 $B3 $B4 $B0
            end
            local.get $l3
            local.get $l5
            i32.eq
            br_if $B1
            local.get $p0
            local.get $l5
            i32.const 3
            i32.add
            i32.store
            local.get $l5
            i32.load8_u offset=2
            local.tee $l1
            i32.const -58
            i32.add
            i32.const 255
            i32.and
            i32.const 246
            i32.lt_u
            local.get $l1
            i32.const 223
            i32.and
            i32.const -71
            i32.add
            i32.const 255
            i32.and
            i32.const 250
            i32.lt_u
            i32.and
            br_if $B1
            local.get $l3
            local.get $l5
            i32.sub
            local.tee $l1
            i32.const 1
            i32.eq
            br_if $B1
            local.get $p0
            local.get $l5
            i32.const 4
            i32.add
            i32.store
            local.get $l5
            i32.load8_u offset=3
            local.tee $l4
            i32.const -58
            i32.add
            i32.const 255
            i32.and
            i32.const 246
            i32.lt_u
            local.get $l4
            i32.const 223
            i32.and
            i32.const -71
            i32.add
            i32.const 255
            i32.and
            i32.const 250
            i32.lt_u
            i32.and
            br_if $B1
            local.get $l1
            i32.const 2
            i32.eq
            br_if $B1
            local.get $p0
            local.get $l5
            i32.const 5
            i32.add
            i32.store
            local.get $l5
            i32.load8_u offset=4
            local.tee $l4
            i32.const -58
            i32.add
            i32.const 255
            i32.and
            i32.const 246
            i32.lt_u
            local.get $l4
            i32.const 223
            i32.and
            i32.const -71
            i32.add
            i32.const 255
            i32.and
            i32.const 250
            i32.lt_u
            i32.and
            br_if $B1
            local.get $l1
            i32.const 3
            i32.eq
            br_if $B1
            local.get $p0
            local.get $l5
            i32.const 6
            i32.add
            local.tee $l1
            i32.store
            local.get $l5
            i32.load8_u offset=5
            local.tee $l5
            i32.const -58
            i32.add
            i32.const 255
            i32.and
            i32.const 245
            i32.gt_u
            br_if $B3
            local.get $l5
            i32.const -33
            i32.and
            i32.const -71
            i32.add
            i32.const 255
            i32.and
            i32.const 250
            i32.lt_u
            br_if $B1
          end
          local.get $l1
          local.get $l2
          i32.lt_u
          br_if $L2
        end
      end
      i32.const 0
      local.set $l4
    end
    local.get $l4)
  (func $run (type $t3) (param $p0 i32) (param $p1 i32) (param $p2 i32) (param $p3 i32) (param $p4 i32) (param $p5 i32) (param $p6 i32) (param $p7 i32) (param $p8 i32) (param $p9 i32) (param $p10 i32) (result i32)
    (local $l11 i32) (local $l12 i32) (local $l13 i32) (local $l14 i32) (local $l15 i32) (local $l16 i32) (local $l17 i32) (local $l18 i32) (local $l19 i32) (local $l20 i32) (local $l21 i32) (local $l22 i32) (local $l23 i32) (local $l24 i32) (local $l25 i32) (local $l26 i32) (local $l27 i32) (local $l28 i32) (local $l29 i32) (local $l30 i32) (local $l31 i32) (local $l32 i32) (local $l33 i64) (local $l34 i64) (local $l35 i32) (local $l36 i32) (local $l37 i32) (local $l38 i32) (local $l39 i32) (local $l40 i32) (local $l41 i64) (local $l42 i64) (local $l43 i32) (local $l44 i32) (local $l45 i32) (local $l46 i32) (local $l47 i32) (local $l48 i32) (local $l49 i32) (local $l50 i32) (local $l51 i32) (local $l52 i32) (local $l53 i32)
    local.get $p6
    i32.const 2
    i32.shl
    local.tee $l11
    i32.const 5065536
    i32.add
    local.tee $l12
    local.get $l11
    i32.add
    local.tee $l13
    local.get $l11
    i32.add
    local.set $l14
    local.get $p6
    i32.const 3
    i32.shl
    local.set $l15
    local.get $p6
    i32.const 12
    i32.mul
    local.set $l16
    local.get $p7
    i32.const 3
    i32.div_u
    local.set $l17
    local.get $p5
    i32.const 65536
    i32.add
    local.set $l18
    local.get $p4
    i32.const 65536
    i32.add
    local.set $l19
    local.get $p3
    i32.const 65536
    i32.add
    local.set $l20
    local.get $p2
    i32.const 65536
    i32.add
    local.set $l21
    i32.const -2128831035
    local.set $l22
    i32.const 65536
    local.set $l23
    i32.const 0
    local.set $l24
    i32.const 0
    local.set $l25
    i32.const -2128831035
    local.set $l26
    i32.const 0
    local.set $l27
    i32.const 0
    local.set $l28
    loop $L0
      block $B1
        block $B2
          local.get $p6
          br_if $B2
          i32.const -2147483648
          local.set $p2
          i32.const -2147483648
          local.set $l29
          i32.const 2147483647
          local.set $l30
          i32.const 2147483647
          local.set $l31
          br $B1
        end
        local.get $l18
        local.get $l28
        i32.const 12
        i32.mul
        i32.add
        local.tee $p5
        i32.load offset=8
        local.set $l32
        local.get $p5
        i64.load32_s offset=4
        local.set $l33
        local.get $p5
        i64.load32_s
        local.set $l34
        i32.const -2147483648
        local.set $l29
        i32.const 2147483647
        local.set $l31
        i32.const 0
        local.set $l35
        local.get $p1
        local.set $l36
        local.get $p0
        local.set $p5
        local.get $l11
        local.set $l37
        local.get $l15
        local.set $l38
        local.get $l16
        local.set $l39
        local.get $p6
        local.set $l40
        i32.const 2147483647
        local.set $l30
        i32.const -2147483648
        local.set $p2
        loop $L3
          local.get $p5
          i32.const 65540
          i32.add
          i32.load
          local.set $p4
          local.get $l35
          i32.const 5065536
          i32.add
          local.tee $p3
          i32.const 0
          local.get $p5
          i32.const 65536
          i32.add
          i32.load
          i32.sub
          i64.extend_i32_s
          local.tee $l41
          local.get $l34
          i64.mul
          local.get $p5
          i32.const 65544
          i32.add
          i64.load32_s
          local.tee $l42
          local.get $l33
          i64.mul
          i64.sub
          i64.const 1048576
          i64.div_s
          i64.extend32_s
          i64.const 1000
          i64.mul
          local.get $l42
          local.get $l34
          i64.mul
          local.get $l41
          local.get $l33
          i64.mul
          i64.add
          i64.const 1048576
          i64.div_s
          i32.wrap_i64
          i32.const 2000000
          i32.add
          local.tee $l43
          i64.extend_i32_s
          local.tee $l41
          i64.div_s
          i32.wrap_i64
          i32.const 48
          i32.add
          i32.store
          local.get $l37
          i32.const 5065536
          i32.add
          local.tee $l44
          i32.const 58
          local.get $l32
          local.get $p4
          i32.sub
          i64.extend_i32_s
          i64.const 1000
          i64.mul
          local.get $l41
          i64.div_s
          i32.wrap_i64
          i32.sub
          i32.store
          local.get $l38
          i32.const 5065536
          i32.add
          local.get $l43
          i32.store
          local.get $l39
          i32.const 5065536
          i32.add
          i32.const 0
          local.get $l36
          i32.const 65540
          i32.add
          i32.load
          i32.sub
          i32.store
          local.get $p3
          i32.load
          local.tee $p4
          local.get $l22
          i32.xor
          i32.const 16777619
          i32.mul
          local.get $l44
          i32.load
          local.tee $p3
          i32.xor
          i32.const 16777619
          i32.mul
          local.get $l43
          i32.xor
          i32.const 16777619
          i32.mul
          local.set $l22
          local.get $p3
          local.get $p2
          local.get $p3
          local.get $p2
          i32.gt_s
          select
          local.set $p2
          local.get $p4
          local.get $l29
          local.get $p4
          local.get $l29
          i32.gt_s
          select
          local.set $l29
          local.get $p3
          local.get $l30
          local.get $p3
          local.get $l30
          i32.lt_s
          select
          local.set $l30
          local.get $p4
          local.get $l31
          local.get $p4
          local.get $l31
          i32.lt_s
          select
          local.set $l31
          local.get $l36
          i32.const 12
          i32.add
          local.set $l36
          local.get $p5
          i32.const 12
          i32.add
          local.set $p5
          local.get $l35
          i32.const 4
          i32.add
          local.set $l35
          local.get $l37
          i32.const 4
          i32.add
          local.set $l37
          local.get $l38
          i32.const 4
          i32.add
          local.set $l38
          local.get $l39
          i32.const 4
          i32.add
          local.set $l39
          local.get $l40
          i32.const -1
          i32.add
          local.tee $l40
          br_if $L3
        end
      end
      i32.const 0
      local.set $l45
      i32.const 0
      local.set $l46
      block $B4
        local.get $l28
        i32.const -25
        i32.add
        local.tee $p5
        i32.const 550
        i32.gt_u
        br_if $B4
        local.get $p5
        i32.const 65535
        i32.and
        i32.const 50
        i32.rem_u
        i32.eqz
        local.set $l46
      end
      local.get $l28
      i32.const 50
      i32.div_u
      local.tee $p5
      i32.const 3
      i32.rem_u
      local.set $p4
      i32.const -1
      local.set $l47
      block $B5
        local.get $p7
        i32.const 3
        i32.lt_u
        local.tee $l48
        br_if $B5
        i32.const 76
        i32.const 70
        local.get $p5
        i32.const 1
        i32.and
        select
        local.set $l32
        local.get $p4
        i32.const 2
        i32.shl
        i32.const 44
        i32.add
        local.set $l49
        i32.const 2147483647
        local.set $l50
        i32.const -1
        local.set $l47
        i32.const 0
        local.set $l45
        local.get $l20
        local.set $p5
        i32.const 0
        local.set $p4
        loop $L6
          block $B7
            local.get $p5
            i32.const 8
            i32.add
            i32.load
            i32.const 2
            i32.shl
            local.tee $l36
            i32.load offset=5065536
            local.tee $l39
            local.get $p5
            i32.load
            i32.const 2
            i32.shl
            local.tee $l37
            i32.load offset=5065536
            local.tee $p3
            i32.sub
            i64.extend_i32_s
            local.get $l12
            local.get $p5
            i32.const 4
            i32.add
            i32.load
            i32.const 2
            i32.shl
            local.tee $l38
            i32.add
            i32.load
            local.tee $l40
            local.get $l12
            local.get $l37
            i32.add
            i32.load
            local.tee $l35
            i32.sub
            i64.extend_i32_s
            local.tee $l33
            i64.mul
            local.get $l12
            local.get $l36
            i32.add
            i32.load
            local.tee $l43
            local.get $l35
            i32.sub
            i64.extend_i32_s
            local.get $l38
            i32.load offset=5065536
            local.tee $l44
            local.get $p3
            i32.sub
            i64.extend_i32_s
            local.tee $l34
            i64.mul
            i64.ge_s
            br_if $B7
            local.get $l45
            i32.const 1
            i32.add
            local.set $l45
            local.get $l26
            local.get $p4
            i32.xor
            i32.const 16777619
            i32.mul
            local.get $l28
            i32.xor
            i32.const 16777619
            i32.mul
            local.set $l26
            local.get $l46
            i32.eqz
            br_if $B7
            local.get $l33
            local.get $l49
            local.get $p3
            i32.sub
            i64.extend_i32_s
            i64.mul
            local.get $l34
            local.get $l32
            local.get $l35
            i32.sub
            i64.extend_i32_s
            i64.mul
            i64.gt_s
            br_if $B7
            local.get $l43
            local.get $l40
            i32.sub
            i64.extend_i32_s
            local.get $l49
            local.get $l44
            i32.sub
            i64.extend_i32_s
            i64.mul
            local.get $l39
            local.get $l44
            i32.sub
            i64.extend_i32_s
            local.get $l32
            local.get $l40
            i32.sub
            i64.extend_i32_s
            i64.mul
            i64.gt_s
            br_if $B7
            local.get $l35
            local.get $l43
            i32.sub
            i64.extend_i32_s
            local.get $l49
            local.get $l39
            i32.sub
            i64.extend_i32_s
            i64.mul
            local.get $l32
            local.get $l43
            i32.sub
            i64.extend_i32_s
            local.get $p3
            local.get $l39
            i32.sub
            i64.extend_i32_s
            i64.mul
            i64.gt_s
            br_if $B7
            local.get $l13
            local.get $l38
            i32.add
            i32.load
            local.get $l13
            local.get $l37
            i32.add
            i32.load
            i32.add
            local.get $l13
            local.get $l36
            i32.add
            i32.load
            i32.add
            i32.const 3
            i32.div_s
            local.tee $p3
            local.get $l50
            local.get $p3
            local.get $l50
            i32.lt_s
            local.tee $p3
            select
            local.set $l50
            local.get $p4
            local.get $l47
            local.get $p3
            select
            local.set $l47
          end
          local.get $p5
          i32.const 12
          i32.add
          local.set $p5
          local.get $l17
          local.get $p4
          i32.const 1
          i32.add
          local.tee $p4
          i32.ne
          br_if $L6
        end
      end
      local.get $l28
      i32.const 5
      i32.shl
      local.tee $p5
      local.get $l26
      i32.store offset=8065676
      local.get $p5
      local.get $l22
      i32.store offset=8065672
      local.get $p5
      local.get $l47
      i32.store offset=8065668
      local.get $p5
      local.get $l45
      i32.store offset=8065664
      local.get $p5
      local.get $p2
      i32.store offset=8065660
      local.get $p5
      local.get $l29
      i32.store offset=8065656
      local.get $p5
      local.get $l30
      i32.store offset=8065652
      local.get $p5
      local.get $l31
      i32.store offset=8065648
      i32.const 0
      local.set $p5
      loop $L8
        local.get $p5
        i32.const 6165536
        i32.add
        i32.const 0
        i32.store
        local.get $p5
        i32.const 6065536
        i32.add
        i64.const 9223372034707292159
        i64.store align=4
        local.get $p5
        i32.const 6165540
        i32.add
        i32.const 0
        i32.store
        local.get $p5
        i32.const 6165544
        i32.add
        i32.const 0
        i32.store
        local.get $p5
        i32.const 6065544
        i32.add
        i32.const 2147483647
        i32.store
        local.get $p5
        i32.const 12
        i32.add
        local.tee $p5
        i32.const 36864
        i32.ne
        br_if $L8
      end
      local.get $l46
      local.get $l47
      i32.const -1
      i32.gt_s
      i32.and
      local.set $l51
      block $B9
        local.get $l48
        br_if $B9
        i32.const 0
        local.set $l52
        loop $L10
          block $B11
            local.get $l20
            local.get $l52
            i32.const 12
            i32.mul
            i32.add
            local.tee $p5
            i32.load offset=8
            i32.const 2
            i32.shl
            local.tee $l31
            i32.load offset=5065536
            local.tee $l36
            local.get $p5
            i32.load
            local.tee $l43
            i32.const 2
            i32.shl
            local.tee $p4
            i32.load offset=5065536
            local.tee $p3
            i32.sub
            i64.extend_i32_s
            local.get $l12
            local.get $p5
            i32.load offset=4
            i32.const 2
            i32.shl
            local.tee $l35
            i32.add
            local.tee $l37
            i32.load
            local.tee $p2
            local.get $l12
            local.get $p4
            i32.add
            local.tee $l38
            i32.load
            local.tee $p5
            i32.sub
            i64.extend_i32_s
            i64.mul
            local.get $l12
            local.get $l31
            i32.add
            local.tee $l44
            i32.load
            local.tee $l29
            local.get $p5
            i32.sub
            i64.extend_i32_s
            local.get $l35
            i32.load offset=5065536
            local.tee $l39
            local.get $p3
            i32.sub
            i64.extend_i32_s
            i64.mul
            i64.ge_s
            br_if $B11
            local.get $l14
            local.get $p4
            i32.add
            i64.load32_s
            i64.const 127
            i64.mul
            i64.const 32767
            i64.div_s
            local.set $l33
            local.get $l13
            local.get $l35
            i32.add
            i32.load
            local.get $l13
            local.get $p4
            i32.add
            i32.load
            i32.add
            local.get $l13
            local.get $l31
            i32.add
            i32.load
            i32.add
            i32.const 3
            i32.div_s
            local.set $l49
            local.get $p5
            local.get $p2
            local.get $p5
            local.get $p2
            i32.lt_s
            select
            local.tee $l30
            local.get $l29
            local.get $l30
            local.get $l29
            i32.lt_s
            select
            local.tee $l30
            i32.const 0
            local.get $l30
            i32.const 0
            i32.gt_s
            select
            local.tee $l30
            local.get $p5
            local.get $p2
            local.get $p5
            local.get $p2
            i32.gt_s
            select
            local.tee $p5
            local.get $l29
            local.get $p5
            local.get $l29
            i32.gt_s
            select
            local.tee $p5
            i32.const 95
            local.get $p5
            i32.const 95
            i32.lt_s
            select
            local.tee $l48
            i32.gt_s
            br_if $B11
            local.get $l21
            local.get $l43
            i32.const 3
            i32.shl
            i32.add
            local.tee $p5
            i64.load32_s
            i64.const 63
            i64.mul
            i64.const 65535
            i64.div_s
            local.set $l34
            local.get $p5
            i64.load32_s offset=4
            i64.const 63
            i64.mul
            i64.const 65535
            i64.div_s
            local.set $l41
            local.get $p3
            local.get $l39
            local.get $p3
            local.get $l39
            i32.lt_s
            select
            local.tee $p5
            local.get $l36
            local.get $p5
            local.get $l36
            i32.lt_s
            select
            local.tee $p5
            i32.const 0
            local.get $p5
            i32.const 0
            i32.gt_s
            select
            local.tee $p5
            local.get $p3
            local.get $l39
            local.get $p3
            local.get $l39
            i32.gt_s
            select
            local.tee $p3
            local.get $l36
            local.get $p3
            local.get $l36
            i32.gt_s
            select
            local.tee $p3
            i32.const 95
            local.get $p3
            i32.const 95
            i32.lt_s
            select
            local.tee $l39
            i32.gt_s
            br_if $B11
            local.get $l31
            i32.const 5065536
            i32.add
            local.set $l32
            local.get $l35
            i32.const 5065536
            i32.add
            local.set $l43
            local.get $p4
            i32.const 5065536
            i32.add
            local.set $l40
            local.get $l33
            i32.wrap_i64
            i32.const -64
            local.get $l33
            i64.const -64
            i64.gt_s
            select
            local.tee $p4
            i32.const 127
            local.get $p4
            i32.const 127
            i32.lt_s
            select
            i32.const 128
            i32.add
            local.set $l46
            local.get $l19
            local.get $l41
            i32.wrap_i64
            i32.const 0
            local.get $l41
            i64.const 0
            i64.gt_s
            select
            local.tee $p4
            i32.const 63
            local.get $p4
            i32.const 63
            i32.lt_s
            select
            i32.const 8
            i32.shl
            i32.add
            local.get $l34
            i32.wrap_i64
            i32.const 0
            local.get $l34
            i64.const 0
            i64.gt_s
            select
            local.tee $p4
            i32.const 63
            local.get $p4
            i32.const 63
            i32.lt_s
            select
            i32.const 2
            i32.shl
            i32.add
            local.set $l47
            local.get $l30
            i32.const 384
            i32.mul
            local.get $p5
            i32.const 2
            i32.shl
            i32.add
            i32.const 65536
            i32.add
            local.set $l50
            local.get $p5
            i32.const -1
            i32.add
            local.set $l53
            local.get $p5
            i64.extend_i32_u
            local.set $l34
            loop $L12
              local.get $l34
              local.set $l33
              local.get $l50
              local.set $p5
              local.get $l53
              local.set $l36
              loop $L13
                block $B14
                  local.get $l37
                  i32.load
                  local.tee $p4
                  local.get $l38
                  i32.load
                  local.tee $p3
                  i32.sub
                  i64.extend_i32_s
                  local.get $l33
                  local.get $l40
                  i32.load
                  local.tee $p2
                  i64.extend_i32_s
                  i64.sub
                  i64.mul
                  local.get $l43
                  i32.load
                  local.tee $l29
                  local.get $p2
                  i32.sub
                  i64.extend_i32_s
                  local.get $l30
                  local.get $p3
                  i32.sub
                  i64.extend_i32_s
                  i64.mul
                  i64.gt_s
                  br_if $B14
                  local.get $l44
                  i32.load
                  local.tee $l31
                  local.get $p4
                  i32.sub
                  i64.extend_i32_s
                  local.get $l33
                  local.get $l29
                  i64.extend_i32_s
                  i64.sub
                  i64.mul
                  local.get $l32
                  i32.load
                  local.tee $l35
                  local.get $l29
                  i32.sub
                  i64.extend_i32_s
                  local.get $l30
                  local.get $p4
                  i32.sub
                  i64.extend_i32_s
                  i64.mul
                  i64.gt_s
                  br_if $B14
                  local.get $p3
                  local.get $l31
                  i32.sub
                  i64.extend_i32_s
                  local.get $l33
                  local.get $l35
                  i64.extend_i32_s
                  i64.sub
                  i64.mul
                  local.get $l30
                  local.get $l31
                  i32.sub
                  i64.extend_i32_s
                  local.get $p2
                  local.get $l35
                  i32.sub
                  i64.extend_i32_s
                  i64.mul
                  i64.gt_s
                  br_if $B14
                  local.get $l49
                  local.get $p5
                  i32.const 6000000
                  i32.add
                  local.tee $p4
                  i32.load
                  i32.ge_s
                  br_if $B14
                  local.get $p4
                  local.get $l49
                  i32.store
                  local.get $p5
                  i32.const 6100000
                  i32.add
                  local.get $l46
                  local.get $l47
                  i32.load8_u
                  i32.mul
                  i32.const 255
                  i32.div_u
                  i32.store8
                  local.get $p5
                  i32.const 6100001
                  i32.add
                  local.get $l46
                  local.get $l47
                  i32.load8_u offset=1
                  i32.mul
                  i32.const 255
                  i32.div_u
                  i32.store8
                  local.get $l47
                  i32.load8_u offset=2
                  local.set $p4
                  local.get $p5
                  i32.const 6100003
                  i32.add
                  i32.const 255
                  i32.store8
                  local.get $p5
                  i32.const 6100002
                  i32.add
                  local.get $l46
                  local.get $p4
                  i32.mul
                  i32.const 255
                  i32.div_u
                  i32.store8
                  local.get $l27
                  i32.const 1
                  i32.add
                  local.set $l27
                end
                local.get $l33
                i64.const 1
                i64.add
                local.set $l33
                local.get $p5
                i32.const 4
                i32.add
                local.set $p5
                local.get $l36
                i32.const 1
                i32.add
                local.tee $l36
                local.get $l39
                i32.lt_s
                br_if $L13
              end
              local.get $l50
              i32.const 384
              i32.add
              local.set $l50
              local.get $l30
              local.get $l48
              i32.lt_s
              local.set $p5
              local.get $l30
              i32.const 1
              i32.add
              local.set $l30
              local.get $p5
              br_if $L12
            end
          end
          local.get $l52
          i32.const 1
          i32.add
          local.tee $l52
          local.get $l17
          i32.ne
          br_if $L10
        end
      end
      local.get $l45
      local.get $l24
      i32.add
      local.set $l24
      local.get $l25
      local.get $l51
      i32.add
      local.set $l25
      i32.const -36864
      local.set $p5
      loop $L15
        local.get $l23
        local.get $p5
        i32.add
        local.tee $p4
        i32.const 8056176
        i32.add
        local.get $p5
        i32.const 6202400
        i32.add
        i32.load8_u
        i32.store8
        local.get $p4
        i32.const 8056177
        i32.add
        local.get $p5
        i32.const 6202401
        i32.add
        i32.load8_u
        i32.store8
        local.get $p4
        i32.const 8056178
        i32.add
        local.get $p5
        i32.const 6202402
        i32.add
        i32.load8_u
        i32.store8
        local.get $p4
        i32.const 8056179
        i32.add
        local.get $p5
        i32.const 6202403
        i32.add
        i32.load8_u
        i32.store8
        local.get $p5
        i32.const 4
        i32.add
        local.tee $p5
        br_if $L15
      end
      local.get $l23
      i32.const 36864
      i32.add
      local.set $l23
      local.get $l28
      i32.const 1
      i32.add
      local.tee $l28
      i32.const 600
      i32.ne
      br_if $L0
    end
    i32.const 0
    i64.const 2576980378200
    i64.store offset=8065636 align=4
    i32.const 0
    i64.const 21474836484
    i64.store offset=8065628 align=4
    i32.const 0
    local.get $p10
    i32.store offset=8065624
    i32.const 0
    local.get $p9
    i32.store offset=8065620
    i32.const 0
    local.get $p8
    i32.store offset=8065616
    i32.const 0
    i32.const 1
    i32.store offset=8065612
    i32.const 0
    i64.const 4317105008
    i64.store offset=8065604 align=4
    i32.const 0
    i32.const 12
    i32.store offset=8065588
    i32.const 0
    i64.const 2576980378200
    i64.store offset=8065580 align=4
    i32.const 0
    local.get $l27
    i32.store offset=8065568
    i32.const 0
    local.get $l26
    i32.store offset=8065564
    i32.const 0
    local.get $l22
    i32.store offset=8065560
    i32.const 0
    local.get $l25
    i32.store offset=8065556
    i32.const 0
    local.get $l24
    i32.store offset=8065552
    i32.const 0
    i32.const 600
    i32.store offset=8065548
    i32.const 0
    local.get $p7
    i32.store offset=8065544
    i32.const 0
    local.get $p6
    i32.store offset=8065540
    i32.const 0
    i32.const 1196184646
    i32.store offset=8065536
    i32.const 0
    local.get $p8
    i32.const 5
    i32.add
    i32.store offset=8065596
    i32.const 0
    local.get $p10
    i32.const 4
    i32.add
    i32.store offset=8065592
    i32.const 0
    local.get $l17
    i32.const 1200
    i32.mul
    i32.store offset=8065576
    i32.const 0
    local.get $p6
    i32.const 600
    i32.mul
    i32.store offset=8065572
    i32.const 0
    local.get $p6
    i32.const 5
    i32.shl
    local.get $p7
    i32.const 2
    i32.shl
    i32.add
    i32.const 16384
    i32.add
    i32.store offset=8065600
    i32.const 0
    i32.const 0
    i32.store offset=8065644
    i32.const 0)
  (memory $memory 1024 1024)
  (global $__stack_pointer (mut i32) (i32.const 65536))
  (export "memory" (memory $memory))
  (export "heap_ptr" (func $heap_ptr))
  (export "output_ptr" (func $output_ptr))
  (export "validate_gltf" (func $validate_gltf))
  (export "run" (func $run)))
