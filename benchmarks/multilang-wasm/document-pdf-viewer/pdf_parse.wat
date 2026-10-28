;; document.pdf-viewer.v1 — kernel: pdf_parse
;; WebAssembly Text (WAT) baseline implementation
;; Exports: pdf_parse

(module $pdf_engine_c.wasm
  (type $t0 (func))
  (type $t1 (func (result i32)))
  (type $t2 (func (param i32) (result i32)))
  (type $t3 (func (param i32 i32)))
  (type $t4 (func (param i32 i32 i32) (result i32)))
  (type $t5 (func (param i32 i32 i32 i32) (result i32)))
  (type $t6 (func (param i32 i32 i32 i32 i32) (result i32)))
  (type $t7 (func (param i32 i32 i32 i32 i32 i32) (result i32)))
  (type $t8 (func (param i32 i32) (result i32)))
  (func $__wasm_call_ctors (type $t0))
  (func $input_ptr (type $t1) (result i32)
    i32.const 65712)
  (func $rgba_ptr (type $t1) (result i32)
    i32.const 1114288)
  (func $counters_ptr (type $t1) (result i32)
    i32.const 8869552)
  (func $error_code (type $t1) (result i32)
    i32.const 0
    i32.load offset=8869588)
  (func $page_count (type $t1) (result i32)
    i32.const 0
    i32.load offset=8869556)
  (func $hit_count (type $t1) (result i32)
    i32.const 0
    i32.load offset=8869592)
  (func $hit_page (type $t2) (param $p0 i32) (result i32)
    (local $l1 i32)
    i32.const 0
    local.set $l1
    block $B0
      local.get $p0
      i32.const 0
      i32.load offset=8869592
      i32.ge_u
      br_if $B0
      local.get $p0
      i32.const 2
      i32.shl
      i32.load offset=8869600
      local.set $l1
    end
    local.get $l1)
  (func $text_ptr (type $t2) (param $p0 i32) (result i32)
    local.get $p0
    i32.const 96
    i32.mul
    i32.const 8870112
    i32.add
    i32.const 0
    local.get $p0
    i32.const 0
    i32.load offset=8869556
    i32.lt_u
    select)
  (func $text_len (type $t2) (param $p0 i32) (result i32)
    (local $l1 i32)
    i32.const 0
    local.set $l1
    block $B0
      local.get $p0
      i32.const 0
      i32.load offset=8869556
      i32.ge_u
      br_if $B0
      local.get $p0
      i32.const 2
      i32.shl
      i32.load offset=8882400
      local.set $l1
    end
    local.get $l1)
  (func $parse (type $t2) (param $p0 i32) (result i32)
    (local $l1 i32) (local $l2 i32) (local $l3 i32) (local $l4 i32) (local $l5 i32) (local $l6 i32) (local $l7 i32) (local $l8 i32) (local $l9 i32) (local $l10 i32) (local $l11 i32) (local $l12 i32) (local $l13 i32)
    global.get $__stack_pointer
    i32.const 96
    i32.sub
    local.tee $l1
    global.set $__stack_pointer
    i32.const 0
    i64.const 0
    i64.store offset=8869552
    i32.const 0
    i64.const 0
    i64.store offset=8869560
    i32.const 0
    i64.const 0
    i64.store offset=8869568
    i32.const 0
    i64.const 0
    i64.store offset=8869576
    i32.const 0
    i32.const 0
    i32.store offset=8869592
    i32.const 0
    i32.const 0
    i32.store offset=8869588
    i32.const 0
    i32.const 0
    i32.store offset=8869584
    i32.const 8882912
    i32.const 0
    i32.const 2048
    memory.fill
    i32.const 8884960
    i32.const 0
    i32.const 2048
    memory.fill
    i32.const 8887008
    i32.const 0
    i32.const 256
    memory.fill
    i32.const 8887264
    i32.const 0
    i32.const 256
    memory.fill
    i32.const 8887520
    i32.const 0
    i32.const 1024
    memory.fill
    i32.const 8888544
    i32.const 0
    i32.const 1792
    memory.fill
    block $B0
      block $B1
        block $B2
          local.get $p0
          i32.const -128
          i32.add
          i32.const 1048448
          i32.gt_u
          br_if $B2
          i32.const 0
          i32.load8_u offset=65712
          i32.const 255
          i32.and
          i32.const 37
          i32.ne
          br_if $B2
          i32.const 0
          i32.load8_u offset=65713
          i32.const 255
          i32.and
          i32.const 80
          i32.ne
          br_if $B2
          i32.const 0
          i32.load8_u offset=65714
          i32.const 255
          i32.and
          i32.const 68
          i32.ne
          br_if $B2
          i32.const 0
          i32.load8_u offset=65715
          i32.const 255
          i32.and
          i32.const 70
          i32.ne
          br_if $B2
          i32.const 0
          i32.load8_u offset=65716
          i32.const 255
          i32.and
          i32.const 45
          i32.ne
          br_if $B2
          i32.const 0
          i32.load8_u offset=65717
          i32.const 255
          i32.and
          i32.const 49
          i32.ne
          br_if $B2
          i32.const 0
          i32.load8_u offset=65718
          i32.const 255
          i32.and
          i32.const 46
          i32.ne
          br_if $B2
          i32.const 0
          i32.load8_u offset=65719
          i32.const 255
          i32.and
          i32.const 55
          i32.ne
          br_if $B2
          i32.const 0
          i32.load8_u offset=65720
          i32.const 255
          i32.and
          i32.const 10
          i32.eq
          br_if $B1
        end
        i32.const 1
        local.set $l2
        i32.const 0
        i32.const 1
        i32.store offset=8869588
        br $B0
      end
      local.get $p0
      i32.const -64
      i32.add
      local.set $l3
      block $B3
        block $B4
          block $B5
            loop $L6
              block $B7
                local.get $l3
                local.tee $l2
                i32.const 65712
                i32.add
                i32.load8_u
                i32.const 115
                i32.ne
                br_if $B7
                local.get $l2
                i32.const 65713
                i32.add
                i32.load8_u
                i32.const 116
                i32.ne
                br_if $B7
                local.get $l2
                i32.const 65714
                i32.add
                i32.load8_u
                i32.const 97
                i32.ne
                br_if $B7
                local.get $l2
                i32.const 65715
                i32.add
                i32.load8_u
                i32.const 114
                i32.ne
                br_if $B7
                local.get $l2
                i32.const 65716
                i32.add
                i32.load8_u
                i32.const 116
                i32.ne
                br_if $B7
                local.get $l2
                i32.const 65717
                i32.add
                i32.load8_u
                i32.const 120
                i32.ne
                br_if $B7
                local.get $l2
                i32.const 65718
                i32.add
                i32.load8_u
                i32.const 114
                i32.ne
                br_if $B7
                local.get $l2
                i32.const 65719
                i32.add
                i32.load8_u
                i32.const 101
                i32.ne
                br_if $B7
                local.get $l2
                i32.const 65720
                i32.add
                i32.load8_u
                i32.const 102
                i32.ne
                br_if $B7
                local.get $l2
                i32.const -1
                i32.eq
                br_if $B5
                local.get $l1
                local.get $l2
                i32.const 9
                i32.add
                i32.store offset=92
                local.get $l1
                i32.const 92
                i32.add
                local.get $p0
                call $skip_ws
                local.get $l1
                i32.load offset=92
                local.tee $l2
                local.get $p0
                i32.ge_u
                br_if $B4
                local.get $l2
                i32.load8_u offset=65712
                i32.const -58
                i32.add
                i32.const 255
                i32.and
                i32.const 246
                i32.lt_u
                br_if $B4
                i32.const 0
                local.set $l3
                block $B8
                  loop $L9
                    local.get $l2
                    i32.const 65712
                    i32.add
                    i32.load8_u
                    local.tee $l4
                    i32.const -58
                    i32.add
                    i32.const 255
                    i32.and
                    i32.const 246
                    i32.lt_u
                    br_if $B8
                    local.get $l3
                    i32.const 10
                    i32.mul
                    local.get $l4
                    i32.add
                    i32.const -48
                    i32.add
                    local.tee $l4
                    local.get $l3
                    i32.lt_u
                    br_if $B4
                    local.get $l4
                    local.set $l3
                    local.get $p0
                    local.get $l2
                    i32.const 1
                    i32.add
                    local.tee $l2
                    i32.ne
                    br_if $L9
                  end
                  local.get $p0
                  local.set $l2
                  local.get $l4
                  local.set $l3
                end
                local.get $l1
                local.get $l2
                i32.store offset=92
                local.get $l3
                local.get $p0
                i32.ge_u
                br_if $B4
                local.get $l3
                i32.const 4
                i32.add
                local.tee $l2
                local.get $p0
                i32.gt_u
                br_if $B4
                local.get $l3
                i32.const 65712
                i32.add
                i32.load8_u
                i32.const 120
                i32.ne
                br_if $B4
                local.get $l3
                i32.const 65713
                i32.add
                i32.load8_u
                i32.const 114
                i32.ne
                br_if $B4
                local.get $l3
                i32.const 65714
                i32.add
                i32.load8_u
                i32.const 101
                i32.ne
                br_if $B4
                local.get $l3
                i32.const 65715
                i32.add
                i32.load8_u
                i32.const 102
                i32.ne
                br_if $B4
                local.get $l1
                local.get $l2
                i32.store offset=88
                local.get $l1
                i32.const 88
                i32.add
                local.get $p0
                call $skip_ws
                block $B10
                  local.get $l1
                  i32.load offset=88
                  local.tee $l2
                  local.get $p0
                  i32.ge_u
                  br_if $B10
                  local.get $l2
                  i32.load8_u offset=65712
                  i32.const -58
                  i32.add
                  i32.const 255
                  i32.and
                  i32.const 246
                  i32.lt_u
                  br_if $B10
                  i32.const 0
                  local.set $l4
                  block $B11
                    loop $L12
                      local.get $l2
                      i32.const 65712
                      i32.add
                      i32.load8_u
                      local.tee $l5
                      i32.const -58
                      i32.add
                      i32.const 255
                      i32.and
                      i32.const 246
                      i32.lt_u
                      br_if $B11
                      local.get $l4
                      i32.const 10
                      i32.mul
                      local.get $l5
                      i32.add
                      i32.const -48
                      i32.add
                      local.tee $l5
                      local.get $l4
                      i32.lt_u
                      br_if $B10
                      local.get $l5
                      local.set $l4
                      local.get $p0
                      local.get $l2
                      i32.const 1
                      i32.add
                      local.tee $l2
                      i32.ne
                      br_if $L12
                    end
                    local.get $p0
                    local.set $l2
                    local.get $l5
                    local.set $l4
                  end
                  local.get $l1
                  local.get $l2
                  i32.store offset=88
                  local.get $l4
                  br_if $B10
                  local.get $l1
                  i32.const 88
                  i32.add
                  local.get $p0
                  local.get $l1
                  i32.const 84
                  i32.add
                  call $read_uint
                  i32.eqz
                  br_if $B10
                  local.get $l1
                  i32.load offset=84
                  local.tee $l6
                  i32.const -513
                  i32.add
                  i32.const -512
                  i32.gt_u
                  br_if $B3
                end
                i32.const 4
                local.set $l2
                i32.const 0
                i32.const 4
                i32.store offset=8869588
                br $B0
              end
              local.get $l2
              i32.const 1
              i32.add
              local.set $l3
              local.get $l2
              i32.const 10
              i32.add
              local.get $p0
              i32.le_u
              br_if $L6
            end
          end
          i32.const 2
          local.set $l2
          i32.const 0
          i32.const 2
          i32.store offset=8869588
          br $B0
        end
        i32.const 3
        local.set $l2
        i32.const 0
        i32.const 3
        i32.store offset=8869588
        br $B0
      end
      i32.const 0
      local.set $l7
      i32.const 0
      local.get $l6
      i32.const -1
      i32.add
      local.tee $l8
      i32.store offset=8890336
      block $B13
        block $B14
          block $B15
            block $B16
              block $B17
                loop $L18
                  local.get $l1
                  i32.const 88
                  i32.add
                  local.get $p0
                  call $skip_ws
                  local.get $l1
                  i32.load offset=88
                  local.tee $l2
                  local.get $p0
                  i32.ge_u
                  br_if $B17
                  local.get $l2
                  i32.load8_u offset=65712
                  i32.const -58
                  i32.add
                  i32.const 255
                  i32.and
                  i32.const 246
                  i32.lt_u
                  br_if $B17
                  i32.const 0
                  local.set $l4
                  block $B19
                    loop $L20
                      local.get $l2
                      i32.const 65712
                      i32.add
                      i32.load8_u
                      local.tee $l5
                      i32.const -58
                      i32.add
                      i32.const 255
                      i32.and
                      i32.const 246
                      i32.lt_u
                      br_if $B19
                      local.get $l4
                      i32.const 10
                      i32.mul
                      local.get $l5
                      i32.add
                      i32.const -48
                      i32.add
                      local.tee $l5
                      local.get $l4
                      i32.lt_u
                      br_if $B17
                      local.get $l5
                      local.set $l4
                      local.get $p0
                      local.get $l2
                      i32.const 1
                      i32.add
                      local.tee $l2
                      i32.ne
                      br_if $L20
                    end
                    local.get $p0
                    local.set $l2
                    local.get $l5
                    local.set $l4
                  end
                  local.get $l1
                  local.get $l2
                  i32.store offset=88
                  local.get $l1
                  i32.const 88
                  i32.add
                  local.get $p0
                  call $skip_ws
                  local.get $l1
                  i32.load offset=88
                  local.tee $l2
                  local.get $p0
                  i32.ge_u
                  br_if $B17
                  local.get $l2
                  i32.load8_u offset=65712
                  i32.const -58
                  i32.add
                  i32.const 255
                  i32.and
                  i32.const 246
                  i32.lt_u
                  br_if $B17
                  i32.const 0
                  local.set $l5
                  block $B21
                    loop $L22
                      local.get $l2
                      i32.const 65712
                      i32.add
                      i32.load8_u
                      local.tee $l9
                      i32.const -58
                      i32.add
                      i32.const 255
                      i32.and
                      i32.const 246
                      i32.lt_u
                      br_if $B21
                      local.get $l5
                      i32.const 10
                      i32.mul
                      local.get $l9
                      i32.add
                      i32.const -48
                      i32.add
                      local.tee $l9
                      local.get $l5
                      i32.lt_u
                      br_if $B17
                      local.get $l9
                      local.set $l5
                      local.get $p0
                      local.get $l2
                      i32.const 1
                      i32.add
                      local.tee $l2
                      i32.ne
                      br_if $L22
                    end
                    local.get $p0
                    local.set $l2
                    local.get $l9
                    local.set $l5
                  end
                  local.get $l1
                  local.get $l2
                  i32.store offset=88
                  local.get $l1
                  i32.const 88
                  i32.add
                  local.get $p0
                  call $skip_ws
                  block $B23
                    local.get $l1
                    i32.load offset=88
                    local.tee $l9
                    i32.const 1
                    i32.add
                    local.tee $l2
                    local.get $p0
                    i32.ge_u
                    br_if $B23
                    block $B24
                      loop $L25
                        local.get $l2
                        i32.const 65712
                        i32.add
                        i32.load8_u
                        i32.const 10
                        i32.eq
                        br_if $B24
                        local.get $p0
                        local.get $l2
                        i32.const 1
                        i32.add
                        local.tee $l2
                        i32.ne
                        br_if $L25
                      end
                      local.get $p0
                      local.set $l2
                      br $B23
                    end
                    local.get $l2
                    i32.const 1
                    i32.add
                    local.set $l2
                  end
                  local.get $l9
                  i32.load8_u offset=65712
                  local.set $l9
                  local.get $l1
                  local.get $l2
                  i32.store offset=88
                  block $B26
                    block $B27
                      local.get $l7
                      br_if $B27
                      block $B28
                        local.get $l5
                        i32.const 65535
                        i32.ne
                        br_if $B28
                        local.get $l9
                        i32.const 255
                        i32.and
                        i32.const 102
                        i32.eq
                        br_if $B26
                      end
                      i32.const 6
                      local.set $l2
                      i32.const 0
                      i32.const 6
                      i32.store offset=8869588
                      br $B0
                    end
                    block $B29
                      block $B30
                        local.get $l4
                        local.get $l3
                        i32.ge_u
                        br_if $B30
                        local.get $l4
                        i32.eqz
                        br_if $B30
                        local.get $l5
                        br_if $B30
                        local.get $l9
                        i32.const 255
                        i32.and
                        i32.const 110
                        i32.eq
                        br_if $B29
                      end
                      i32.const 7
                      local.set $l2
                      i32.const 0
                      i32.const 7
                      i32.store offset=8869588
                      br $B0
                    end
                    local.get $l7
                    i32.const 2
                    i32.shl
                    local.get $l4
                    i32.store offset=8884960
                  end
                  local.get $l7
                  i32.const 1
                  i32.add
                  local.tee $l7
                  local.get $l6
                  i32.ne
                  br_if $L18
                end
                local.get $l2
                i32.const 7
                i32.add
                local.get $p0
                i32.gt_u
                br_if $B16
                local.get $l2
                i32.const 65712
                i32.add
                i32.load8_u
                i32.const 116
                i32.ne
                br_if $B16
                local.get $l2
                i32.const 65713
                i32.add
                i32.load8_u
                i32.const 114
                i32.ne
                br_if $B16
                local.get $l2
                i32.const 65714
                i32.add
                i32.load8_u
                i32.const 97
                i32.ne
                br_if $B16
                local.get $l2
                i32.const 65715
                i32.add
                i32.load8_u
                i32.const 105
                i32.ne
                br_if $B16
                local.get $l2
                i32.const 65716
                i32.add
                i32.load8_u
                i32.const 108
                i32.ne
                br_if $B16
                local.get $l2
                i32.const 65717
                i32.add
                i32.load8_u
                i32.const 101
                i32.ne
                br_if $B16
                local.get $l2
                i32.const 65718
                i32.add
                i32.load8_u
                i32.const 114
                i32.ne
                br_if $B16
                i32.const -1
                local.set $l4
                block $B31
                  local.get $l2
                  i32.const 9
                  i32.add
                  local.get $p0
                  i32.gt_u
                  br_if $B31
                  local.get $l2
                  local.set $l5
                  loop $L32
                    block $B33
                      local.get $l5
                      local.tee $l4
                      i32.const 65712
                      i32.add
                      i32.load8_u
                      i32.const 115
                      i32.ne
                      br_if $B33
                      local.get $l4
                      i32.const 65713
                      i32.add
                      i32.load8_u
                      i32.const 116
                      i32.ne
                      br_if $B33
                      local.get $l4
                      i32.const 65714
                      i32.add
                      i32.load8_u
                      i32.const 97
                      i32.ne
                      br_if $B33
                      local.get $l4
                      i32.const 65715
                      i32.add
                      i32.load8_u
                      i32.const 114
                      i32.ne
                      br_if $B33
                      local.get $l4
                      i32.const 65716
                      i32.add
                      i32.load8_u
                      i32.const 116
                      i32.ne
                      br_if $B33
                      local.get $l4
                      i32.const 65717
                      i32.add
                      i32.load8_u
                      i32.const 120
                      i32.ne
                      br_if $B33
                      local.get $l4
                      i32.const 65718
                      i32.add
                      i32.load8_u
                      i32.const 114
                      i32.ne
                      br_if $B33
                      local.get $l4
                      i32.const 65719
                      i32.add
                      i32.load8_u
                      i32.const 101
                      i32.ne
                      br_if $B33
                      local.get $l4
                      i32.const 65720
                      i32.add
                      i32.load8_u
                      i32.const 102
                      i32.eq
                      br_if $B31
                    end
                    local.get $l4
                    i32.const 1
                    i32.add
                    local.set $l5
                    local.get $l4
                    i32.const 10
                    i32.add
                    local.get $p0
                    i32.le_u
                    br_if $L32
                  end
                  i32.const -1
                  local.set $l4
                end
                local.get $l2
                local.get $l4
                i32.const 65655
                i32.const 5
                call $find_key
                local.set $p0
                local.get $l2
                local.get $l4
                i32.const 65536
                i32.const 5
                call $find_key
                local.set $l2
                block $B34
                  block $B35
                    local.get $l4
                    i32.const -1
                    i32.eq
                    br_if $B35
                    local.get $p0
                    i32.const -1
                    i32.eq
                    br_if $B35
                    local.get $l2
                    i32.const -1
                    i32.ne
                    br_if $B34
                  end
                  i32.const 9
                  local.set $l2
                  i32.const 0
                  i32.const 9
                  i32.store offset=8869588
                  br $B0
                end
                local.get $l1
                local.get $l2
                i32.const 5
                i32.add
                i32.store offset=64
                local.get $l1
                local.get $p0
                i32.const 5
                i32.add
                i32.store offset=68
                local.get $l1
                i32.const 68
                i32.add
                local.get $l4
                local.get $l1
                i32.const 80
                i32.add
                call $read_uint
                i32.eqz
                br_if $B15
                local.get $l1
                i32.load offset=80
                local.get $l6
                i32.ne
                br_if $B15
                local.get $l1
                i32.const 64
                i32.add
                local.get $l4
                local.get $l1
                i32.const 76
                i32.add
                call $read_uint
                i32.eqz
                br_if $B15
                local.get $l1
                i32.const 64
                i32.add
                local.get $l4
                local.get $l1
                i32.const 72
                i32.add
                call $read_uint
                i32.eqz
                br_if $B15
                local.get $l1
                i32.load offset=72
                br_if $B15
                local.get $l1
                i32.const 64
                i32.add
                local.get $l4
                i32.const 65699
                i32.const 1
                call $match_token
                i32.eqz
                br_if $B15
                local.get $l1
                i32.load offset=76
                local.tee $l7
                i32.eqz
                br_if $B15
                local.get $l7
                local.get $l6
                i32.ge_u
                br_if $B15
                local.get $l6
                i32.const 2
                i32.lt_u
                br_if $B13
                i32.const 1
                local.set $l10
                loop $L36
                  local.get $l1
                  local.get $l10
                  i32.const 2
                  i32.shl
                  local.tee $l11
                  i32.load offset=8884960
                  i32.store offset=60
                  block $B37
                    block $B38
                      local.get $l1
                      i32.const 60
                      i32.add
                      local.get $l3
                      local.get $l1
                      i32.const 56
                      i32.add
                      call $read_uint
                      i32.eqz
                      br_if $B38
                      local.get $l1
                      i32.load offset=56
                      local.get $l10
                      i32.ne
                      br_if $B38
                      local.get $l1
                      i32.const 60
                      i32.add
                      local.get $l3
                      local.get $l1
                      i32.const 52
                      i32.add
                      call $read_uint
                      i32.eqz
                      br_if $B38
                      local.get $l1
                      i32.load offset=52
                      br_if $B38
                      local.get $l1
                      i32.const 60
                      i32.add
                      local.get $l3
                      i32.const 65639
                      i32.const 3
                      call $match_token
                      br_if $B37
                    end
                    i32.const 11
                    local.set $l2
                    i32.const 0
                    i32.const 11
                    i32.store offset=8869588
                    br $B0
                  end
                  local.get $l3
                  local.set $l9
                  block $B39
                    local.get $l10
                    i32.const 1
                    i32.add
                    local.tee $l10
                    local.get $l6
                    i32.ge_u
                    br_if $B39
                    local.get $l10
                    i32.const 2
                    i32.shl
                    i32.load offset=8884960
                    local.set $l9
                  end
                  local.get $l1
                  i32.load offset=60
                  local.tee $p0
                  i32.const 6
                  i32.add
                  local.get $l9
                  i32.gt_u
                  br_if $B14
                  local.get $l11
                  i32.const 8884960
                  i32.add
                  local.set $l12
                  i32.const 0
                  local.set $l2
                  i32.const -1
                  local.set $l4
                  block $B40
                    loop $L41
                      block $B42
                        local.get $p0
                        local.get $l2
                        i32.add
                        local.tee $l5
                        i32.const 65712
                        i32.add
                        i32.load8_u
                        i32.const 101
                        i32.ne
                        br_if $B42
                        local.get $l5
                        i32.const 65713
                        i32.add
                        i32.load8_u
                        i32.const 110
                        i32.ne
                        br_if $B42
                        local.get $l5
                        i32.const 65714
                        i32.add
                        i32.load8_u
                        i32.const 100
                        i32.ne
                        br_if $B42
                        local.get $l5
                        i32.const 65715
                        i32.add
                        i32.load8_u
                        i32.const 111
                        i32.ne
                        br_if $B42
                        local.get $l5
                        i32.const 65716
                        i32.add
                        i32.load8_u
                        i32.const 98
                        i32.ne
                        br_if $B42
                        local.get $l5
                        i32.const 65717
                        i32.add
                        i32.load8_u
                        i32.const 106
                        i32.ne
                        br_if $B42
                        local.get $p0
                        local.get $l4
                        i32.eq
                        br_if $B40
                        local.get $l12
                        local.get $p0
                        i32.store
                        local.get $l11
                        local.get $l5
                        i32.store offset=8882912
                        local.get $l10
                        local.get $l6
                        i32.ne
                        br_if $L36
                        br $B13
                      end
                      local.get $l4
                      i32.const -1
                      i32.add
                      local.set $l4
                      local.get $p0
                      local.get $l2
                      i32.const 1
                      i32.add
                      local.tee $l2
                      i32.add
                      i32.const 6
                      i32.add
                      local.get $l9
                      i32.le_u
                      br_if $L41
                    end
                  end
                end
                i32.const 12
                local.set $l2
                i32.const 0
                i32.const 12
                i32.store offset=8869588
                br $B0
              end
              i32.const 5
              local.set $l2
              i32.const 0
              i32.const 5
              i32.store offset=8869588
              br $B0
            end
            i32.const 8
            local.set $l2
            i32.const 0
            i32.const 8
            i32.store offset=8869588
            br $B0
          end
          i32.const 10
          local.set $l2
          i32.const 0
          i32.const 10
          i32.store offset=8869588
          br $B0
        end
        i32.const 12
        local.set $l2
        i32.const 0
        i32.const 12
        i32.store offset=8869588
        br $B0
      end
      block $B43
        block $B44
          local.get $l7
          i32.const 2
          i32.shl
          i32.load offset=8884960
          local.tee $l2
          i32.eqz
          br_if $B44
          local.get $l7
          i32.const 2
          i32.shl
          i32.load offset=8882912
          local.tee $l3
          local.get $l2
          i32.le_u
          br_if $B44
          local.get $l7
          i32.const 65670
          i32.const 5
          i32.const 65646
          i32.const 8
          call $object_has
          i32.eqz
          br_if $B44
          local.get $l2
          local.get $l3
          i32.const 65581
          i32.const 6
          local.get $l1
          i32.const 60
          i32.add
          call $ref_after
          br_if $B43
        end
        i32.const 13
        local.set $l2
        i32.const 0
        i32.const 13
        i32.store offset=8869588
        br $B0
      end
      block $B45
        block $B46
          local.get $l1
          i32.load offset=60
          local.tee $l3
          i32.const -1
          i32.add
          local.get $l8
          i32.ge_u
          br_if $B46
          local.get $l3
          i32.const 2
          i32.shl
          local.tee $p0
          i32.load offset=8884960
          local.tee $l2
          i32.eqz
          br_if $B46
          local.get $p0
          i32.load offset=8882912
          local.tee $l4
          local.get $l2
          i32.le_u
          br_if $B46
          local.get $l3
          i32.const 65670
          i32.const 5
          i32.const 65581
          i32.const 6
          call $object_has
          br_if $B45
        end
        i32.const 14
        local.set $l2
        i32.const 0
        i32.const 14
        i32.store offset=8869588
        br $B0
      end
      local.get $l2
      local.get $l4
      i32.const 65542
      i32.const 6
      call $find_key
      local.set $p0
      local.get $l2
      local.get $l4
      i32.const 65612
      i32.const 5
      call $find_key
      local.set $l2
      block $B47
        block $B48
          local.get $p0
          i32.const -1
          i32.eq
          br_if $B48
          local.get $l2
          i32.const -1
          i32.ne
          br_if $B47
        end
        i32.const 15
        local.set $l2
        i32.const 0
        i32.const 15
        i32.store offset=8869588
        br $B0
      end
      local.get $l1
      local.get $p0
      i32.const 6
      i32.add
      i32.store offset=52
      block $B49
        block $B50
          local.get $l1
          i32.const 52
          i32.add
          local.get $l4
          local.get $l1
          i32.const 56
          i32.add
          call $read_uint
          i32.eqz
          br_if $B50
          local.get $l1
          i32.load offset=56
          local.tee $l9
          i32.const -129
          i32.add
          i32.const -129
          i32.gt_u
          br_if $B49
        end
        i32.const 16
        local.set $l2
        i32.const 0
        i32.const 16
        i32.store offset=8869588
        br $B0
      end
      block $B51
        local.get $l2
        local.get $l4
        i32.ge_u
        br_if $B51
        local.get $l2
        i32.const 1
        i32.add
        local.set $l2
        loop $L52
          block $B53
            local.get $l2
            i32.const 65711
            i32.add
            i32.load8_u
            i32.const 91
            i32.ne
            br_if $B53
            local.get $l2
            i32.eqz
            br_if $B51
            local.get $l1
            local.get $l2
            i32.store offset=48
            block $B54
              block $B55
                local.get $l9
                i32.eqz
                br_if $B55
                i32.const 0
                local.set $l6
                i32.const 0
                local.set $l10
                loop $L56
                  block $B57
                    block $B58
                      local.get $l1
                      i32.const 48
                      i32.add
                      local.get $l4
                      local.get $l1
                      i32.const 44
                      i32.add
                      call $read_uint
                      i32.eqz
                      br_if $B58
                      local.get $l1
                      i32.const 48
                      i32.add
                      local.get $l4
                      local.get $l1
                      i32.const 40
                      i32.add
                      call $read_uint
                      i32.eqz
                      br_if $B58
                      local.get $l1
                      i32.load offset=40
                      br_if $B58
                      local.get $l1
                      i32.const 48
                      i32.add
                      local.get $l4
                      i32.const 65699
                      i32.const 1
                      call $match_token
                      br_if $B57
                    end
                    i32.const 18
                    local.set $l2
                    i32.const 0
                    i32.const 18
                    i32.store offset=8869588
                    br $B0
                  end
                  i32.const 19
                  local.set $l2
                  local.get $l1
                  i32.load offset=44
                  local.tee $p0
                  i32.const -1
                  i32.add
                  local.get $l8
                  i32.ge_u
                  br_if $B54
                  local.get $p0
                  i32.const 2
                  i32.shl
                  local.tee $l7
                  i32.load offset=8884960
                  local.tee $l5
                  i32.eqz
                  br_if $B54
                  local.get $l7
                  i32.load offset=8882912
                  local.tee $l7
                  local.get $l5
                  i32.le_u
                  br_if $B54
                  local.get $p0
                  i32.const 65670
                  i32.const 5
                  i32.const 65676
                  i32.const 5
                  call $object_has
                  i32.eqz
                  br_if $B54
                  local.get $l5
                  local.get $l7
                  i32.const 65555
                  i32.const 7
                  local.get $l1
                  i32.const 36
                  i32.add
                  call $ref_after
                  i32.eqz
                  br_if $B54
                  local.get $l5
                  i32.const 23
                  i32.add
                  local.get $l7
                  i32.gt_u
                  br_if $B54
                  local.get $l1
                  i32.load offset=36
                  local.get $l3
                  i32.ne
                  br_if $B54
                  i32.const -1
                  local.set $l11
                  i32.const 0
                  local.set $l12
                  loop $L59
                    block $B60
                      local.get $l5
                      local.get $l12
                      i32.add
                      local.tee $p0
                      i32.const 65712
                      i32.add
                      i32.load8_u
                      i32.const 47
                      i32.ne
                      br_if $B60
                      local.get $p0
                      i32.const 65713
                      i32.add
                      i32.load8_u
                      i32.const 77
                      i32.ne
                      br_if $B60
                      local.get $p0
                      i32.const 65714
                      i32.add
                      i32.load8_u
                      i32.const 101
                      i32.ne
                      br_if $B60
                      local.get $p0
                      i32.const 65715
                      i32.add
                      i32.load8_u
                      i32.const 100
                      i32.ne
                      br_if $B60
                      local.get $p0
                      i32.const 65716
                      i32.add
                      i32.load8_u
                      i32.const 105
                      i32.ne
                      br_if $B60
                      local.get $p0
                      i32.const 65717
                      i32.add
                      i32.load8_u
                      i32.const 97
                      i32.ne
                      br_if $B60
                      local.get $p0
                      i32.const 65718
                      i32.add
                      i32.load8_u
                      i32.const 66
                      i32.ne
                      br_if $B60
                      local.get $p0
                      i32.const 65719
                      i32.add
                      i32.load8_u
                      i32.const 111
                      i32.ne
                      br_if $B60
                      local.get $p0
                      i32.const 65720
                      i32.add
                      i32.load8_u
                      i32.const 120
                      i32.ne
                      br_if $B60
                      local.get $p0
                      i32.const 65721
                      i32.add
                      i32.load8_u
                      i32.const 32
                      i32.ne
                      br_if $B60
                      local.get $p0
                      i32.const 65722
                      i32.add
                      i32.load8_u
                      i32.const 91
                      i32.ne
                      br_if $B60
                      local.get $p0
                      i32.const 65723
                      i32.add
                      i32.load8_u
                      i32.const 48
                      i32.ne
                      br_if $B60
                      local.get $p0
                      i32.const 65724
                      i32.add
                      i32.load8_u
                      i32.const 32
                      i32.ne
                      br_if $B60
                      local.get $p0
                      i32.const 65725
                      i32.add
                      i32.load8_u
                      i32.const 48
                      i32.ne
                      br_if $B60
                      local.get $p0
                      i32.const 65726
                      i32.add
                      i32.load8_u
                      i32.const 32
                      i32.ne
                      br_if $B60
                      local.get $p0
                      i32.const 65727
                      i32.add
                      i32.load8_u
                      i32.const 54
                      i32.ne
                      br_if $B60
                      local.get $p0
                      i32.const 65728
                      i32.add
                      i32.load8_u
                      i32.const 49
                      i32.ne
                      br_if $B60
                      local.get $p0
                      i32.const 65729
                      i32.add
                      i32.load8_u
                      i32.const 50
                      i32.ne
                      br_if $B60
                      local.get $p0
                      i32.const 65730
                      i32.add
                      i32.load8_u
                      i32.const 32
                      i32.ne
                      br_if $B60
                      local.get $p0
                      i32.const 65731
                      i32.add
                      i32.load8_u
                      i32.const 55
                      i32.ne
                      br_if $B60
                      local.get $p0
                      i32.const 65732
                      i32.add
                      i32.load8_u
                      i32.const 57
                      i32.ne
                      br_if $B60
                      local.get $p0
                      i32.const 65733
                      i32.add
                      i32.load8_u
                      i32.const 50
                      i32.ne
                      br_if $B60
                      local.get $p0
                      i32.const 65734
                      i32.add
                      i32.load8_u
                      i32.const 93
                      i32.ne
                      br_if $B60
                      local.get $l5
                      local.get $l11
                      i32.eq
                      br_if $B54
                      local.get $l5
                      local.get $l7
                      i32.const 65588
                      i32.const 10
                      local.get $l1
                      i32.const 24
                      i32.add
                      local.get $l1
                      i32.const 20
                      i32.add
                      call $dictionary_after
                      i32.eqz
                      br_if $B54
                      local.get $l1
                      i32.load offset=24
                      local.get $l1
                      i32.load offset=20
                      i32.const 65549
                      i32.const 5
                      local.get $l1
                      i32.const 16
                      i32.add
                      local.get $l1
                      i32.const 12
                      i32.add
                      call $dictionary_after
                      i32.eqz
                      br_if $B54
                      local.get $l1
                      i32.load offset=16
                      local.get $l1
                      i32.load offset=12
                      local.get $l1
                      i32.const 28
                      i32.add
                      call $direct_ref_after
                      i32.eqz
                      br_if $B54
                      local.get $l5
                      local.get $l7
                      i32.const 65563
                      i32.const 9
                      local.get $l1
                      i32.const 32
                      i32.add
                      call $ref_after
                      i32.eqz
                      br_if $B54
                      local.get $l1
                      i32.load offset=28
                      local.set $l2
                      block $B61
                        block $B62
                          local.get $l6
                          br_if $B62
                          i32.const 0
                          local.set $p0
                          local.get $l2
                          call $parse_font
                          br_if $B61
                          i32.const 20
                          local.set $l2
                          br $B54
                        end
                        local.get $l2
                        local.get $l10
                        i32.ne
                        local.set $l5
                        local.get $l6
                        local.set $p0
                        local.get $l10
                        local.set $l2
                        local.get $l5
                        i32.eqz
                        br_if $B61
                        i32.const 21
                        local.set $l2
                        br $B54
                      end
                      block $B63
                        local.get $l1
                        i32.load offset=32
                        local.get $p0
                        call $parse_content
                        br_if $B63
                        i32.const 22
                        local.set $l2
                        br $B54
                      end
                      local.get $l2
                      local.set $l10
                      local.get $l6
                      i32.const 1
                      i32.add
                      local.tee $l6
                      local.get $l9
                      i32.ne
                      br_if $L56
                      br $B55
                    end
                    local.get $l11
                    i32.const -1
                    i32.add
                    local.set $l11
                    local.get $l5
                    local.get $l12
                    i32.const 1
                    i32.add
                    local.tee $l12
                    i32.add
                    i32.const 23
                    i32.add
                    local.get $l7
                    i32.le_u
                    br_if $L59
                    br $B54
                  end
                end
              end
              local.get $l1
              i32.const 48
              i32.add
              local.get $l4
              call $skip_ws
              block $B64
                local.get $l1
                i32.load offset=48
                local.tee $l2
                local.get $l4
                i32.ge_u
                br_if $B64
                local.get $l2
                i32.load8_u offset=65712
                i32.const 93
                i32.ne
                br_if $B64
                i32.const 0
                local.set $l2
                i32.const 0
                local.set $l5
                i32.const 0
                local.set $l7
                block $B65
                  local.get $l9
                  i32.eqz
                  br_if $B65
                  i32.const 8870112
                  local.set $l6
                  i32.const 0
                  local.set $p0
                  i32.const 0
                  local.set $l7
                  i32.const 0
                  local.set $l5
                  i32.const 0
                  local.set $l10
                  loop $L66
                    block $B67
                      block $B68
                        block $B69
                          local.get $p0
                          i32.const 2
                          i32.shl
                          i32.load offset=8882400
                          local.tee $l11
                          i32.const 6
                          i32.lt_u
                          br_if $B69
                          local.get $l11
                          local.get $l11
                          i32.const 1
                          i32.add
                          local.tee $l3
                          i32.const 7
                          local.get $l3
                          i32.const 7
                          i32.lt_u
                          select
                          i32.sub
                          i32.const 2
                          i32.add
                          local.set $l13
                          i32.const 0
                          local.set $l3
                          i32.const 0
                          local.set $l12
                          loop $L70
                            block $B71
                              local.get $l6
                              local.get $l3
                              i32.add
                              local.tee $l4
                              i32.load8_u
                              i32.const 78
                              i32.ne
                              br_if $B71
                              local.get $l4
                              i32.const 1
                              i32.add
                              i32.load8_u
                              i32.const 69
                              i32.ne
                              br_if $B71
                              local.get $l4
                              i32.const 2
                              i32.add
                              i32.load8_u
                              i32.const 69
                              i32.ne
                              br_if $B71
                              local.get $l4
                              i32.const 3
                              i32.add
                              i32.load8_u
                              i32.const 68
                              i32.ne
                              br_if $B71
                              local.get $l4
                              i32.const 4
                              i32.add
                              i32.load8_u
                              i32.const 76
                              i32.ne
                              br_if $B71
                              i32.const 1
                              local.get $l12
                              local.get $l4
                              i32.const 5
                              i32.add
                              i32.load8_u
                              i32.const 69
                              i32.eq
                              select
                              local.set $l12
                            end
                            local.get $l13
                            local.get $l3
                            i32.const 1
                            i32.add
                            local.tee $l3
                            i32.ne
                            br_if $L70
                          end
                          local.get $l7
                          local.get $l3
                          i32.add
                          local.set $l7
                          local.get $l12
                          br_if $B68
                        end
                        local.get $p0
                        i32.const 1
                        i32.add
                        local.set $p0
                        br $B67
                      end
                      local.get $l10
                      i32.const 2
                      i32.shl
                      local.get $p0
                      i32.const 1
                      i32.add
                      local.tee $p0
                      i32.store offset=8869600
                      i32.const 0
                      local.get $l10
                      i32.const 1
                      i32.add
                      local.tee $l10
                      i32.store offset=8869592
                    end
                    local.get $l6
                    i32.const 96
                    i32.add
                    local.set $l6
                    local.get $l11
                    local.get $l5
                    i32.add
                    local.set $l5
                    local.get $p0
                    local.get $l9
                    i32.ne
                    br_if $L66
                  end
                end
                i32.const 0
                i32.const 7755264
                i32.store offset=8869584
                i32.const 0
                i64.const 4294968880
                i64.store offset=8869576
                i32.const 0
                i64.const 5257039970304
                i64.store offset=8869568
                i32.const 0
                local.get $l7
                i32.store offset=8869564
                i32.const 0
                local.get $l5
                i32.store offset=8869560
                i32.const 0
                local.get $l9
                i32.store offset=8869556
                i32.const 0
                local.get $l8
                i32.store offset=8869552
                br $B0
              end
              i32.const 23
              local.set $l2
              i32.const 0
              i32.const 23
              i32.store offset=8869588
              br $B0
            end
            i32.const 0
            local.get $l2
            i32.store offset=8869588
            br $B0
          end
          local.get $l2
          i32.const 1
          i32.add
          local.tee $l2
          local.get $l4
          i32.le_u
          br_if $L52
        end
      end
      i32.const 17
      local.set $l2
      i32.const 0
      i32.const 17
      i32.store offset=8869588
    end
    local.get $l1
    i32.const 96
    i32.add
    global.set $__stack_pointer
    local.get $l2)
  (func $skip_ws (type $t3) (param $p0 i32) (param $p1 i32)
    (local $l2 i32)
    block $B0
      local.get $p0
      i32.load
      local.tee $l2
      local.get $p1
      i32.ge_u
      br_if $B0
      loop $L1
        block $B2
          block $B3
            block $B4
              local.get $l2
              i32.load8_u offset=65712
              br_table $B4 $B0 $B0 $B0 $B0 $B0 $B0 $B0 $B0 $B4 $B4 $B0 $B4 $B4 $B0 $B0 $B0 $B0 $B0 $B0 $B0 $B0 $B0 $B0 $B0 $B0 $B0 $B0 $B0 $B0 $B0 $B0 $B4 $B0 $B0 $B0 $B0 $B3 $B0
            end
            local.get $p0
            local.get $l2
            i32.const 1
            i32.add
            local.tee $l2
            i32.store
            br $B2
          end
          local.get $l2
          local.get $p1
          i32.ge_u
          br_if $B2
          loop $L5
            block $B6
              local.get $l2
              i32.const 65712
              i32.add
              i32.load8_u
              i32.const -10
              i32.add
              br_table $B2 $B6 $B6 $B2 $B6
            end
            local.get $p0
            local.get $l2
            i32.const 1
            i32.add
            local.tee $l2
            i32.store
            local.get $p1
            local.get $l2
            i32.ne
            br_if $L5
            br $B0
          end
        end
        local.get $l2
        local.get $p1
        i32.lt_u
        br_if $L1
      end
    end)
  (func $read_uint (type $t4) (param $p0 i32) (param $p1 i32) (param $p2 i32) (result i32)
    (local $l3 i32) (local $l4 i32) (local $l5 i32)
    local.get $p0
    local.get $p1
    call $skip_ws
    i32.const 0
    local.set $l3
    block $B0
      local.get $p0
      i32.load
      local.tee $l4
      local.get $p1
      i32.ge_u
      br_if $B0
      local.get $l4
      i32.load8_u offset=65712
      i32.const -58
      i32.add
      i32.const 255
      i32.and
      i32.const 246
      i32.lt_u
      br_if $B0
      i32.const 0
      local.set $l3
      block $B1
        loop $L2
          block $B3
            local.get $l4
            i32.const 65712
            i32.add
            i32.load8_u
            local.tee $l5
            i32.const -58
            i32.add
            i32.const 255
            i32.and
            i32.const 246
            i32.ge_u
            br_if $B3
            local.get $l3
            local.set $l5
            br $B1
          end
          block $B4
            local.get $l3
            i32.const 10
            i32.mul
            local.get $l5
            i32.add
            i32.const -48
            i32.add
            local.tee $l5
            local.get $l3
            i32.ge_u
            br_if $B4
            i32.const 0
            return
          end
          local.get $p0
          local.get $l4
          i32.const 1
          i32.add
          local.tee $l4
          i32.store
          local.get $l5
          local.set $l3
          local.get $p1
          local.get $l4
          i32.ne
          br_if $L2
        end
      end
      local.get $p2
      local.get $l5
      i32.store
      i32.const 1
      local.set $l3
    end
    local.get $l3)
  (func $find_key (type $t5) (param $p0 i32) (param $p1 i32) (param $p2 i32) (param $p3 i32) (result i32)
    (local $l4 i32) (local $l5 i32) (local $l6 i32)
    block $B0
      block $B1
        local.get $p0
        local.get $p3
        i32.add
        local.tee $l4
        local.get $p1
        i32.gt_u
        br_if $B1
        loop $L2
          local.get $p0
          i32.const 65712
          i32.add
          local.set $l5
          i32.const 0
          local.set $l6
          block $B3
            loop $L4
              local.get $p0
              local.get $l6
              i32.add
              i32.const 65712
              i32.add
              i32.load8_u
              local.get $p2
              local.get $l6
              i32.add
              i32.load8_u
              i32.ne
              br_if $B3
              local.get $p3
              local.get $l6
              i32.const 1
              i32.add
              local.tee $l6
              i32.ne
              br_if $L4
            end
            block $B5
              local.get $p0
              i32.eqz
              br_if $B5
              local.get $l5
              i32.const -1
              i32.add
              i32.load8_u
              call $delimiter
              i32.eqz
              br_if $B3
            end
            local.get $l4
            local.get $p1
            i32.eq
            br_if $B0
            local.get $l4
            i32.load8_u offset=65712
            call $delimiter
            br_if $B0
          end
          local.get $p0
          i32.const 1
          i32.add
          local.tee $p0
          local.get $p3
          i32.add
          local.tee $l4
          local.get $p1
          i32.le_u
          br_if $L2
        end
      end
      i32.const -1
      local.set $p0
    end
    local.get $p0)
  (func $match_token (type $t5) (param $p0 i32) (param $p1 i32) (param $p2 i32) (param $p3 i32) (result i32)
    (local $l4 i32) (local $l5 i32) (local $l6 i32)
    local.get $p0
    local.get $p1
    call $skip_ws
    i32.const 0
    local.set $l4
    block $B0
      local.get $p0
      i32.load
      local.tee $l5
      local.get $p3
      i32.add
      local.tee $l6
      local.get $p1
      i32.gt_u
      br_if $B0
      local.get $l5
      i32.const 65712
      i32.add
      i32.load8_u
      local.get $p2
      i32.load8_u
      i32.ne
      br_if $B0
      block $B1
        local.get $p3
        i32.const 1
        i32.eq
        br_if $B1
        local.get $l5
        i32.const 65713
        i32.add
        i32.load8_u
        local.get $p2
        i32.load8_u offset=1
        i32.ne
        br_if $B0
        local.get $p3
        i32.const 2
        i32.eq
        br_if $B1
        local.get $l5
        i32.const 65714
        i32.add
        i32.load8_u
        local.get $p2
        i32.load8_u offset=2
        i32.ne
        br_if $B0
      end
      block $B2
        local.get $l6
        local.get $p1
        i32.ge_u
        br_if $B2
        local.get $l6
        i32.load8_u offset=65712
        call $delimiter
        i32.eqz
        br_if $B0
      end
      local.get $p0
      local.get $l6
      i32.store
      i32.const 1
      local.set $l4
    end
    local.get $l4)
  (func $object_has (type $t6) (param $p0 i32) (param $p1 i32) (param $p2 i32) (param $p3 i32) (param $p4 i32) (result i32)
    (local $l5 i32) (local $l6 i32) (local $l7 i32) (local $l8 i32) (local $l9 i32) (local $l10 i32) (local $l11 i32) (local $l12 i32) (local $l13 i32) (local $l14 i32)
    global.get $__stack_pointer
    i32.const 16
    i32.sub
    local.tee $l5
    global.set $__stack_pointer
    i32.const 0
    local.set $l6
    block $B0
      local.get $p0
      i32.const -1
      i32.add
      i32.const 0
      i32.load offset=8890336
      i32.ge_u
      br_if $B0
      local.get $p0
      i32.const 2
      i32.shl
      local.tee $p0
      i32.load offset=8884960
      local.tee $l7
      i32.eqz
      br_if $B0
      local.get $p0
      i32.load offset=8882912
      local.tee $l8
      local.get $l7
      i32.le_u
      br_if $B0
      block $B1
        local.get $l7
        local.get $p2
        i32.add
        local.get $l8
        i32.le_u
        br_if $B1
        i32.const 0
        local.set $l6
        br $B0
      end
      local.get $l7
      local.get $p2
      local.get $l8
      i32.sub
      i32.add
      local.set $l9
      i32.const 0
      local.set $p0
      local.get $p1
      i32.load8_u
      i32.const 255
      i32.and
      local.set $l10
      local.get $p2
      i32.const 5
      i32.eq
      local.set $l11
      local.get $p2
      i32.const 6
      i32.eq
      local.set $l12
      local.get $p2
      i32.const 7
      i32.eq
      local.set $l13
      i32.const -1
      local.set $l14
      block $B2
        loop $L3
          block $B4
            local.get $l7
            local.get $p0
            i32.add
            local.tee $l6
            i32.const 65712
            i32.add
            i32.load8_u
            local.get $l10
            i32.ne
            br_if $B4
            local.get $l6
            i32.const 65713
            i32.add
            i32.load8_u
            local.get $p1
            i32.load8_u offset=1
            i32.ne
            br_if $B4
            local.get $l6
            i32.const 65714
            i32.add
            i32.load8_u
            local.get $p1
            i32.load8_u offset=2
            i32.ne
            br_if $B4
            local.get $l6
            i32.const 65715
            i32.add
            i32.load8_u
            local.get $p1
            i32.load8_u offset=3
            i32.ne
            br_if $B4
            local.get $l6
            i32.const 65716
            i32.add
            i32.load8_u
            local.get $p1
            i32.load8_u offset=4
            i32.ne
            br_if $B4
            block $B5
              local.get $l11
              br_if $B5
              local.get $l6
              i32.const 65717
              i32.add
              i32.load8_u
              local.get $p1
              i32.load8_u offset=5
              i32.ne
              br_if $B4
              local.get $l12
              br_if $B5
              local.get $l6
              i32.const 65718
              i32.add
              i32.load8_u
              local.get $p1
              i32.load8_u offset=6
              i32.ne
              br_if $B4
              local.get $l13
              br_if $B5
              local.get $l6
              i32.const 65719
              i32.add
              i32.load8_u
              local.get $p1
              i32.load8_u offset=7
              i32.ne
              br_if $B4
            end
            block $B6
              local.get $l6
              i32.eqz
              br_if $B6
              local.get $l6
              i32.const 65711
              i32.add
              i32.load8_u
              call $delimiter
              i32.eqz
              br_if $B4
            end
            local.get $l9
            local.get $p0
            i32.add
            i32.eqz
            br_if $B2
            local.get $l7
            local.get $p2
            i32.add
            i32.const 65712
            i32.add
            i32.load8_u
            call $delimiter
            br_if $B2
          end
          local.get $l14
          i32.const -1
          i32.add
          local.set $l14
          local.get $p0
          i32.const 1
          i32.add
          local.set $p0
          local.get $l7
          local.get $p2
          i32.const 1
          i32.add
          local.tee $p2
          i32.add
          local.get $l8
          i32.le_u
          br_if $L3
        end
        i32.const 0
        local.set $l6
        br $B0
      end
      i32.const 0
      local.set $l6
      local.get $l7
      local.get $l14
      i32.eq
      br_if $B0
      local.get $l5
      local.get $l7
      local.get $p2
      i32.add
      i32.store offset=12
      local.get $l5
      i32.const 12
      i32.add
      local.get $l8
      call $skip_ws
      local.get $l5
      i32.load offset=12
      local.tee $p0
      local.get $p4
      i32.add
      local.tee $p2
      local.get $l8
      i32.gt_u
      br_if $B0
      local.get $p0
      i32.const 65712
      i32.add
      local.tee $l7
      i32.load8_u
      local.get $p3
      i32.load8_u
      i32.ne
      br_if $B0
      local.get $l7
      i32.const 1
      i32.add
      i32.load8_u
      local.get $p3
      i32.load8_u offset=1
      i32.ne
      br_if $B0
      local.get $l7
      i32.const 2
      i32.add
      i32.load8_u
      local.get $p3
      i32.load8_u offset=2
      i32.ne
      br_if $B0
      local.get $l7
      i32.const 3
      i32.add
      i32.load8_u
      local.get $p3
      i32.load8_u offset=3
      i32.ne
      br_if $B0
      local.get $l7
      i32.const 4
      i32.add
      i32.load8_u
      local.get $p3
      i32.load8_u offset=4
      i32.ne
      br_if $B0
      block $B7
        local.get $p4
        i32.const 5
        i32.eq
        br_if $B7
        local.get $l7
        i32.const 5
        i32.add
        i32.load8_u
        local.get $p3
        i32.load8_u offset=5
        i32.ne
        br_if $B0
        local.get $p4
        i32.const 6
        i32.eq
        br_if $B7
        local.get $l7
        i32.const 6
        i32.add
        i32.load8_u
        local.get $p3
        i32.load8_u offset=6
        i32.ne
        br_if $B0
        local.get $p4
        i32.const 7
        i32.eq
        br_if $B7
        local.get $l7
        i32.const 7
        i32.add
        i32.load8_u
        local.get $p3
        i32.load8_u offset=7
        i32.ne
        br_if $B0
      end
      block $B8
        local.get $p0
        i32.eqz
        br_if $B8
        local.get $l7
        i32.const -1
        i32.add
        i32.load8_u
        call $delimiter
        i32.eqz
        br_if $B0
      end
      block $B9
        local.get $p2
        local.get $l8
        i32.ne
        br_if $B9
        i32.const 1
        local.set $l6
        br $B0
      end
      local.get $p2
      i32.load8_u offset=65712
      call $delimiter
      local.set $l6
    end
    local.get $l5
    i32.const 16
    i32.add
    global.set $__stack_pointer
    local.get $l6)
  (func $ref_after (type $t6) (param $p0 i32) (param $p1 i32) (param $p2 i32) (param $p3 i32) (param $p4 i32) (result i32)
    (local $l5 i32) (local $l6 i32) (local $l7 i32) (local $l8 i32)
    global.get $__stack_pointer
    i32.const 16
    i32.sub
    local.tee $l5
    global.set $__stack_pointer
    block $B0
      block $B1
        local.get $p3
        local.get $p0
        i32.add
        local.tee $l6
        local.get $p1
        i32.le_u
        br_if $B1
        i32.const 0
        local.set $l7
        br $B0
      end
      block $B2
        loop $L3
          local.get $p0
          i32.const 65712
          i32.add
          local.set $l8
          i32.const 0
          local.set $l7
          block $B4
            loop $L5
              local.get $p0
              local.get $l7
              i32.add
              i32.const 65712
              i32.add
              i32.load8_u
              local.get $p2
              local.get $l7
              i32.add
              i32.load8_u
              i32.ne
              br_if $B4
              local.get $p3
              local.get $l7
              i32.const 1
              i32.add
              local.tee $l7
              i32.ne
              br_if $L5
            end
            block $B6
              local.get $p0
              i32.eqz
              br_if $B6
              local.get $l8
              i32.const -1
              i32.add
              i32.load8_u
              call $delimiter
              i32.eqz
              br_if $B4
            end
            local.get $l6
            local.get $p1
            i32.eq
            br_if $B2
            local.get $l6
            i32.load8_u offset=65712
            call $delimiter
            br_if $B2
          end
          local.get $p0
          i32.const 1
          i32.add
          local.tee $p0
          local.get $p3
          i32.add
          local.tee $l6
          local.get $p1
          i32.le_u
          br_if $L3
        end
        i32.const 0
        local.set $l7
        br $B0
      end
      i32.const 0
      local.set $l7
      local.get $p0
      i32.const -1
      i32.eq
      br_if $B0
      local.get $l5
      local.get $p0
      local.get $p3
      i32.add
      i32.store offset=12
      local.get $l5
      i32.const 12
      i32.add
      local.get $p1
      call $skip_ws
      local.get $l5
      i32.load offset=12
      local.tee $p0
      local.get $p1
      i32.ge_u
      br_if $B0
      local.get $p0
      i32.load8_u offset=65712
      i32.const -58
      i32.add
      i32.const 255
      i32.and
      i32.const 246
      i32.lt_u
      br_if $B0
      i32.const 0
      local.set $l7
      block $B7
        loop $L8
          local.get $p0
          i32.const 65712
          i32.add
          i32.load8_u
          local.tee $p3
          i32.const -58
          i32.add
          i32.const 255
          i32.and
          i32.const 246
          i32.lt_u
          br_if $B7
          block $B9
            local.get $l7
            i32.const 10
            i32.mul
            local.get $p3
            i32.add
            i32.const -48
            i32.add
            local.tee $p3
            local.get $l7
            i32.ge_u
            br_if $B9
            i32.const 0
            local.set $l7
            br $B0
          end
          local.get $p3
          local.set $l7
          local.get $p1
          local.get $p0
          i32.const 1
          i32.add
          local.tee $p0
          i32.ne
          br_if $L8
        end
        local.get $p1
        local.set $p0
        local.get $p3
        local.set $l7
      end
      local.get $p4
      local.get $l7
      i32.store
      local.get $l5
      local.get $p0
      i32.store offset=12
      local.get $l5
      i32.const 12
      i32.add
      local.get $p1
      call $skip_ws
      i32.const 0
      local.set $l7
      local.get $l5
      i32.load offset=12
      local.tee $p0
      local.get $p1
      i32.ge_u
      br_if $B0
      local.get $p0
      i32.load8_u offset=65712
      i32.const -58
      i32.add
      i32.const 255
      i32.and
      i32.const 246
      i32.lt_u
      br_if $B0
      i32.const 0
      local.set $p3
      block $B10
        loop $L11
          local.get $p0
          i32.const 65712
          i32.add
          i32.load8_u
          local.tee $l7
          i32.const -58
          i32.add
          i32.const 255
          i32.and
          i32.const 246
          i32.lt_u
          br_if $B10
          block $B12
            local.get $p3
            i32.const 10
            i32.mul
            local.get $l7
            i32.add
            i32.const -48
            i32.add
            local.tee $l7
            local.get $p3
            i32.ge_u
            br_if $B12
            i32.const 0
            local.set $l7
            br $B0
          end
          local.get $l7
          local.set $p3
          local.get $p1
          local.get $p0
          i32.const 1
          i32.add
          local.tee $p0
          i32.ne
          br_if $L11
        end
        local.get $p1
        local.set $p0
        local.get $l7
        local.set $p3
      end
      local.get $l5
      local.get $p0
      i32.store offset=12
      i32.const 0
      local.set $l7
      local.get $p3
      br_if $B0
      local.get $l5
      i32.const 12
      i32.add
      local.get $p1
      call $skip_ws
      local.get $l5
      i32.load offset=12
      local.tee $p0
      i32.const 1
      i32.add
      local.tee $p3
      local.get $p1
      i32.gt_u
      br_if $B0
      local.get $p0
      i32.const 65712
      i32.add
      i32.load8_u
      i32.const 82
      i32.ne
      br_if $B0
      block $B13
        local.get $p3
        local.get $p1
        i32.ge_u
        br_if $B13
        local.get $p3
        i32.load8_u offset=65712
        call $delimiter
        i32.eqz
        br_if $B0
      end
      i32.const 1
      local.set $l7
    end
    local.get $l5
    i32.const 16
    i32.add
    global.set $__stack_pointer
    local.get $l7)
  (func $dictionary_after (type $t7) (param $p0 i32) (param $p1 i32) (param $p2 i32) (param $p3 i32) (param $p4 i32) (param $p5 i32) (result i32)
    (local $l6 i32) (local $l7 i32)
    global.get $__stack_pointer
    i32.const 16
    i32.sub
    local.tee $l6
    global.set $__stack_pointer
    i32.const 0
    local.set $l7
    block $B0
      local.get $p0
      local.get $p1
      local.get $p2
      local.get $p3
      call $find_direct_key
      local.tee $p2
      i32.const -1
      i32.eq
      br_if $B0
      local.get $l6
      local.get $p2
      local.get $p3
      i32.add
      i32.store offset=12
      local.get $l6
      i32.const 12
      i32.add
      local.get $p1
      call $skip_ws
      local.get $l6
      i32.load offset=12
      local.tee $p2
      i32.const 2
      i32.add
      local.get $p1
      i32.gt_u
      br_if $B0
      local.get $p2
      i32.const 65712
      i32.add
      i32.load8_u
      i32.const 60
      i32.ne
      br_if $B0
      local.get $p2
      i32.const 65713
      i32.add
      i32.load8_u
      i32.const 60
      i32.ne
      br_if $B0
      local.get $p4
      local.get $p2
      i32.store
      local.get $p2
      local.get $p1
      i32.ge_u
      br_if $B0
      i32.const 0
      local.set $p4
      loop $L1
        local.get $p2
        local.set $p3
        block $B2
          loop $L3
            block $B4
              block $B5
                local.get $p3
                i32.load8_u offset=65712
                local.tee $l7
                i32.const 40
                i32.ne
                br_if $B5
                i32.const 0
                local.set $l7
                local.get $p3
                i32.const 1
                i32.add
                local.tee $p3
                local.get $p1
                i32.ge_u
                br_if $B0
                i32.const 1
                local.set $p0
                loop $L6
                  block $B7
                    block $B8
                      block $B9
                        block $B10
                          local.get $p3
                          i32.load8_u offset=65712
                          local.tee $p2
                          i32.const 92
                          i32.eq
                          br_if $B10
                          local.get $p2
                          i32.const -40
                          i32.add
                          br_table $B9 $B8 $B7
                        end
                        i32.const 2
                        i32.const 1
                        local.get $p3
                        i32.const 1
                        i32.add
                        local.get $p1
                        i32.lt_u
                        select
                        local.get $p3
                        i32.add
                        local.tee $p3
                        local.get $p1
                        i32.lt_u
                        br_if $L6
                        br $B0
                      end
                      local.get $p0
                      i32.const 1
                      i32.add
                      local.set $p0
                      br $B7
                    end
                    local.get $p0
                    i32.const -1
                    i32.add
                    local.set $p0
                  end
                  block $B11
                    local.get $p3
                    i32.const 1
                    i32.add
                    local.tee $p3
                    local.get $p1
                    i32.ge_u
                    br_if $B11
                    local.get $p0
                    br_if $L6
                  end
                end
                local.get $p0
                i32.eqz
                br_if $B4
                br $B0
              end
              block $B12
                local.get $p3
                i32.const 2
                i32.add
                local.tee $p2
                local.get $p1
                i32.gt_u
                br_if $B12
                block $B13
                  block $B14
                    local.get $l7
                    i32.const -60
                    i32.add
                    br_table $B14 $B12 $B13 $B12
                  end
                  local.get $p3
                  i32.const 65713
                  i32.add
                  i32.load8_u
                  i32.const 60
                  i32.ne
                  br_if $B12
                  local.get $p4
                  i32.const 1
                  i32.add
                  local.set $p4
                  br $B2
                end
                local.get $p3
                i32.const 65713
                i32.add
                i32.load8_u
                i32.const 62
                i32.ne
                br_if $B12
                block $B15
                  local.get $p4
                  br_if $B15
                  i32.const 0
                  local.set $l7
                  br $B0
                end
                local.get $p4
                i32.const -1
                i32.add
                local.tee $p4
                br_if $B2
                local.get $p5
                local.get $p2
                i32.store
                i32.const 1
                local.set $l7
                br $B0
              end
              local.get $p3
              i32.const 1
              i32.add
              local.set $p3
            end
            i32.const 0
            local.set $l7
            local.get $p3
            local.get $p1
            i32.lt_u
            br_if $L3
            br $B0
          end
        end
        i32.const 0
        local.set $l7
        local.get $p2
        local.get $p1
        i32.lt_u
        br_if $L1
      end
    end
    local.get $l6
    i32.const 16
    i32.add
    global.set $__stack_pointer
    local.get $l7)
  (func $direct_ref_after (type $t4) (param $p0 i32) (param $p1 i32) (param $p2 i32) (result i32)
    (local $l3 i32) (local $l4 i32) (local $l5 i32)
    global.get $__stack_pointer
    i32.const 16
    i32.sub
    local.tee $l3
    global.set $__stack_pointer
    i32.const 0
    local.set $l4
    block $B0
      local.get $p0
      local.get $p1
      i32.const 65708
      i32.const 3
      call $find_direct_key
      local.tee $p0
      i32.const -1
      i32.eq
      br_if $B0
      local.get $l3
      local.get $p0
      i32.const 3
      i32.add
      i32.store offset=12
      local.get $l3
      i32.const 12
      i32.add
      local.get $p1
      call $skip_ws
      local.get $l3
      i32.load offset=12
      local.tee $p0
      local.get $p1
      i32.ge_u
      br_if $B0
      local.get $p0
      i32.load8_u offset=65712
      i32.const -58
      i32.add
      i32.const 255
      i32.and
      i32.const 246
      i32.lt_u
      br_if $B0
      i32.const 0
      local.set $l4
      block $B1
        loop $L2
          local.get $p0
          i32.const 65712
          i32.add
          i32.load8_u
          local.tee $l5
          i32.const -58
          i32.add
          i32.const 255
          i32.and
          i32.const 246
          i32.lt_u
          br_if $B1
          block $B3
            local.get $l4
            i32.const 10
            i32.mul
            local.get $l5
            i32.add
            i32.const -48
            i32.add
            local.tee $l5
            local.get $l4
            i32.ge_u
            br_if $B3
            i32.const 0
            local.set $l4
            br $B0
          end
          local.get $l5
          local.set $l4
          local.get $p1
          local.get $p0
          i32.const 1
          i32.add
          local.tee $p0
          i32.ne
          br_if $L2
        end
        local.get $p1
        local.set $p0
        local.get $l5
        local.set $l4
      end
      local.get $p2
      local.get $l4
      i32.store
      local.get $l3
      local.get $p0
      i32.store offset=12
      local.get $l3
      i32.const 12
      i32.add
      local.get $p1
      call $skip_ws
      i32.const 0
      local.set $l4
      local.get $l3
      i32.load offset=12
      local.tee $p0
      local.get $p1
      i32.ge_u
      br_if $B0
      local.get $p0
      i32.load8_u offset=65712
      i32.const -58
      i32.add
      i32.const 255
      i32.and
      i32.const 246
      i32.lt_u
      br_if $B0
      i32.const 0
      local.set $l5
      block $B4
        loop $L5
          local.get $p0
          i32.const 65712
          i32.add
          i32.load8_u
          local.tee $l4
          i32.const -58
          i32.add
          i32.const 255
          i32.and
          i32.const 246
          i32.lt_u
          br_if $B4
          block $B6
            local.get $l5
            i32.const 10
            i32.mul
            local.get $l4
            i32.add
            i32.const -48
            i32.add
            local.tee $l4
            local.get $l5
            i32.ge_u
            br_if $B6
            i32.const 0
            local.set $l4
            br $B0
          end
          local.get $l4
          local.set $l5
          local.get $p1
          local.get $p0
          i32.const 1
          i32.add
          local.tee $p0
          i32.ne
          br_if $L5
        end
        local.get $p1
        local.set $p0
        local.get $l4
        local.set $l5
      end
      local.get $l3
      local.get $p0
      i32.store offset=12
      i32.const 0
      local.set $l4
      local.get $l5
      br_if $B0
      local.get $l3
      i32.const 12
      i32.add
      local.get $p1
      call $skip_ws
      local.get $l3
      i32.load offset=12
      local.tee $p0
      i32.const 1
      i32.add
      local.tee $l5
      local.get $p1
      i32.gt_u
      br_if $B0
      local.get $p0
      i32.const 65712
      i32.add
      i32.load8_u
      i32.const 82
      i32.ne
      br_if $B0
      block $B7
        local.get $l5
        local.get $p1
        i32.ge_u
        br_if $B7
        local.get $l5
        i32.load8_u offset=65712
        call $delimiter
        i32.eqz
        br_if $B0
      end
      i32.const 1
      local.set $l4
    end
    local.get $l3
    i32.const 16
    i32.add
    global.set $__stack_pointer
    local.get $l4)
  (func $parse_font (type $t2) (param $p0 i32) (result i32)
    (local $l1 i32) (local $l2 i32) (local $l3 i32) (local $l4 i32) (local $l5 i32) (local $l6 i32) (local $l7 i32) (local $l8 i32) (local $l9 i32) (local $l10 i32) (local $l11 i32) (local $l12 i32) (local $l13 i32)
    global.get $__stack_pointer
    i32.const 32
    i32.sub
    local.tee $l1
    global.set $__stack_pointer
    i32.const 0
    local.set $l2
    block $B0
      local.get $p0
      i32.const -1
      i32.add
      i32.const 0
      i32.load offset=8890336
      i32.ge_u
      br_if $B0
      local.get $p0
      i32.const 2
      i32.shl
      local.tee $l3
      i32.load offset=8884960
      local.tee $l4
      i32.eqz
      br_if $B0
      local.get $l3
      i32.load offset=8882912
      local.tee $l5
      local.get $l4
      i32.le_u
      br_if $B0
      local.get $p0
      i32.const 65670
      i32.const 5
      i32.const 65549
      i32.const 5
      call $object_has
      i32.eqz
      br_if $B0
      local.get $p0
      i32.const 65661
      i32.const 8
      i32.const 65701
      i32.const 6
      call $object_has
      local.set $p0
      local.get $l4
      i32.const 33
      i32.add
      local.get $l5
      i32.gt_u
      br_if $B0
      local.get $p0
      i32.eqz
      br_if $B0
      i32.const 0
      local.set $p0
      i32.const -1
      local.set $l3
      loop $L1
        block $B2
          local.get $l4
          local.get $p0
          i32.add
          local.tee $l2
          i32.const 65712
          i32.add
          i32.load8_u
          i32.const 47
          i32.ne
          br_if $B2
          local.get $l2
          i32.const 65713
          i32.add
          i32.load8_u
          i32.const 70
          i32.ne
          br_if $B2
          local.get $l2
          i32.const 65714
          i32.add
          i32.load8_u
          i32.const 111
          i32.ne
          br_if $B2
          local.get $l2
          i32.const 65715
          i32.add
          i32.load8_u
          i32.const 110
          i32.ne
          br_if $B2
          local.get $l2
          i32.const 65716
          i32.add
          i32.load8_u
          i32.const 116
          i32.ne
          br_if $B2
          local.get $l2
          i32.const 65717
          i32.add
          i32.load8_u
          i32.const 77
          i32.ne
          br_if $B2
          local.get $l2
          i32.const 65718
          i32.add
          i32.load8_u
          i32.const 97
          i32.ne
          br_if $B2
          local.get $l2
          i32.const 65719
          i32.add
          i32.load8_u
          i32.const 116
          i32.ne
          br_if $B2
          local.get $l2
          i32.const 65720
          i32.add
          i32.load8_u
          i32.const 114
          i32.ne
          br_if $B2
          local.get $l2
          i32.const 65721
          i32.add
          i32.load8_u
          i32.const 105
          i32.ne
          br_if $B2
          local.get $l2
          i32.const 65722
          i32.add
          i32.load8_u
          i32.const 120
          i32.ne
          br_if $B2
          local.get $l2
          i32.const 65723
          i32.add
          i32.load8_u
          i32.const 32
          i32.ne
          br_if $B2
          local.get $l2
          i32.const 65724
          i32.add
          i32.load8_u
          i32.const 91
          i32.ne
          br_if $B2
          local.get $l2
          i32.const 65725
          i32.add
          i32.load8_u
          i32.const 48
          i32.ne
          br_if $B2
          local.get $l2
          i32.const 65726
          i32.add
          i32.load8_u
          i32.const 46
          i32.ne
          br_if $B2
          local.get $l2
          i32.const 65727
          i32.add
          i32.load8_u
          i32.const 49
          i32.ne
          br_if $B2
          local.get $l2
          i32.const 65728
          i32.add
          i32.load8_u
          i32.const 50
          i32.ne
          br_if $B2
          local.get $l2
          i32.const 65729
          i32.add
          i32.load8_u
          i32.const 53
          i32.ne
          br_if $B2
          local.get $l2
          i32.const 65730
          i32.add
          i32.load8_u
          i32.const 32
          i32.ne
          br_if $B2
          local.get $l2
          i32.const 65731
          i32.add
          i32.load8_u
          i32.const 48
          i32.ne
          br_if $B2
          local.get $l2
          i32.const 65732
          i32.add
          i32.load8_u
          i32.const 32
          i32.ne
          br_if $B2
          local.get $l2
          i32.const 65733
          i32.add
          i32.load8_u
          i32.const 48
          i32.ne
          br_if $B2
          local.get $l2
          i32.const 65734
          i32.add
          i32.load8_u
          i32.const 32
          i32.ne
          br_if $B2
          local.get $l2
          i32.const 65735
          i32.add
          i32.load8_u
          i32.const 48
          i32.ne
          br_if $B2
          local.get $l2
          i32.const 65736
          i32.add
          i32.load8_u
          i32.const 46
          i32.ne
          br_if $B2
          local.get $l2
          i32.const 65737
          i32.add
          i32.load8_u
          i32.const 49
          i32.ne
          br_if $B2
          local.get $l2
          i32.const 65738
          i32.add
          i32.load8_u
          i32.const 50
          i32.ne
          br_if $B2
          local.get $l2
          i32.const 65739
          i32.add
          i32.load8_u
          i32.const 53
          i32.ne
          br_if $B2
          local.get $l2
          i32.const 65740
          i32.add
          i32.load8_u
          i32.const 32
          i32.ne
          br_if $B2
          local.get $l2
          i32.const 65741
          i32.add
          i32.load8_u
          i32.const 48
          i32.ne
          br_if $B2
          local.get $l2
          i32.const 65742
          i32.add
          i32.load8_u
          i32.const 32
          i32.ne
          br_if $B2
          local.get $l2
          i32.const 65743
          i32.add
          i32.load8_u
          i32.const 48
          i32.ne
          br_if $B2
          local.get $l2
          i32.const 65744
          i32.add
          i32.load8_u
          i32.const 93
          i32.ne
          br_if $B2
          i32.const 0
          local.set $l2
          local.get $l4
          local.get $l3
          i32.eq
          br_if $B0
          local.get $l4
          local.get $l5
          i32.const 65682
          i32.const 10
          local.get $l1
          i32.const 16
          i32.add
          call $ref_after
          i32.eqz
          br_if $B0
          local.get $l1
          i32.load offset=16
          local.get $l1
          i32.const 28
          i32.add
          local.get $l1
          i32.const 24
          i32.add
          call $stream_range
          i32.eqz
          br_if $B0
          local.get $l1
          i32.load offset=28
          local.tee $l3
          i32.const 9
          i32.add
          local.get $l1
          i32.load offset=24
          local.tee $l6
          i32.gt_u
          br_if $B0
          i32.const 0
          local.set $p0
          i32.const -1
          local.set $l7
          loop $L3
            block $B4
              local.get $l3
              local.get $p0
              i32.add
              local.tee $l8
              i32.const 65712
              i32.add
              i32.load8_u
              i32.const 98
              i32.ne
              br_if $B4
              local.get $l8
              i32.const 65713
              i32.add
              i32.load8_u
              i32.const 101
              i32.ne
              br_if $B4
              local.get $l8
              i32.const 65714
              i32.add
              i32.load8_u
              i32.const 103
              i32.ne
              br_if $B4
              local.get $l8
              i32.const 65715
              i32.add
              i32.load8_u
              i32.const 105
              i32.ne
              br_if $B4
              local.get $l8
              i32.const 65716
              i32.add
              i32.load8_u
              i32.const 110
              i32.ne
              br_if $B4
              local.get $l8
              i32.const 65717
              i32.add
              i32.load8_u
              i32.const 99
              i32.ne
              br_if $B4
              local.get $l8
              i32.const 65718
              i32.add
              i32.load8_u
              i32.const 109
              i32.ne
              br_if $B4
              local.get $l8
              i32.const 65719
              i32.add
              i32.load8_u
              i32.const 97
              i32.ne
              br_if $B4
              local.get $l8
              i32.const 65720
              i32.add
              i32.load8_u
              i32.const 112
              i32.ne
              br_if $B4
              local.get $l3
              i32.const 7
              i32.add
              local.get $l6
              i32.gt_u
              br_if $B0
              local.get $l3
              local.get $l7
              i32.eq
              br_if $B0
              i32.const 0
              local.set $p0
              i32.const 1
              local.set $l7
              loop $L5
                block $B6
                  local.get $l3
                  local.get $p0
                  i32.add
                  local.tee $l8
                  i32.const 65712
                  i32.add
                  i32.load8_u
                  i32.const 101
                  i32.ne
                  br_if $B6
                  local.get $l3
                  local.get $l7
                  i32.add
                  local.tee $l9
                  i32.const 65712
                  i32.add
                  i32.load8_u
                  i32.const 110
                  i32.ne
                  br_if $B6
                  local.get $l8
                  i32.const 65714
                  i32.add
                  i32.load8_u
                  i32.const 100
                  i32.ne
                  br_if $B6
                  local.get $l8
                  i32.const 65715
                  i32.add
                  i32.load8_u
                  i32.const 99
                  i32.ne
                  br_if $B6
                  local.get $l8
                  i32.const 65716
                  i32.add
                  i32.load8_u
                  i32.const 109
                  i32.ne
                  br_if $B6
                  local.get $l8
                  i32.const 65717
                  i32.add
                  i32.load8_u
                  i32.const 97
                  i32.ne
                  br_if $B6
                  local.get $l8
                  i32.const 65718
                  i32.add
                  i32.load8_u
                  i32.const 112
                  i32.ne
                  br_if $B6
                  local.get $l9
                  i32.eqz
                  br_if $B0
                  block $B7
                    local.get $l3
                    i32.const 11
                    i32.add
                    local.get $l6
                    i32.gt_u
                    br_if $B7
                    i32.const 0
                    local.set $l10
                    loop $L8
                      local.get $l3
                      i32.const 11
                      i32.add
                      local.set $p0
                      block $B9
                        block $B10
                          loop $L11
                            block $B12
                              local.get $p0
                              i32.const 65701
                              i32.add
                              i32.load8_u
                              i32.const 60
                              i32.ne
                              br_if $B12
                              local.get $p0
                              i32.const 65704
                              i32.add
                              i32.load8_u
                              i32.const 62
                              i32.eq
                              br_if $B10
                            end
                            local.get $p0
                            i32.const 1
                            i32.add
                            local.tee $p0
                            local.get $l6
                            i32.le_u
                            br_if $L11
                            br $B9
                          end
                        end
                        block $B13
                          local.get $p0
                          i32.const 65702
                          i32.add
                          i32.load8_u
                          local.tee $l3
                          i32.const -48
                          i32.add
                          local.tee $l8
                          i32.const 255
                          i32.and
                          i32.const 9
                          i32.le_u
                          br_if $B13
                          block $B14
                            local.get $l3
                            i32.const -97
                            i32.add
                            i32.const 255
                            i32.and
                            i32.const 5
                            i32.gt_u
                            br_if $B14
                            local.get $l3
                            i32.const -87
                            i32.add
                            local.set $l8
                            br $B13
                          end
                          local.get $l3
                          i32.const -55
                          i32.add
                          i32.const -1
                          local.get $l3
                          i32.const -65
                          i32.add
                          i32.const 255
                          i32.and
                          i32.const 6
                          i32.lt_u
                          select
                          local.set $l8
                        end
                        block $B15
                          local.get $p0
                          i32.const 65703
                          i32.add
                          i32.load8_u
                          local.tee $l3
                          i32.const -48
                          i32.add
                          local.tee $l9
                          i32.const 255
                          i32.and
                          i32.const 9
                          i32.le_u
                          br_if $B15
                          block $B16
                            local.get $l3
                            i32.const -97
                            i32.add
                            i32.const 255
                            i32.and
                            i32.const 5
                            i32.gt_u
                            br_if $B16
                            local.get $l3
                            i32.const -87
                            i32.add
                            local.set $l9
                            br $B15
                          end
                          local.get $l3
                          i32.const -55
                          i32.add
                          i32.const -1
                          local.get $l3
                          i32.const -65
                          i32.add
                          i32.const 255
                          i32.and
                          i32.const 6
                          i32.lt_u
                          select
                          local.set $l9
                        end
                        local.get $l1
                        local.get $p0
                        i32.const -7
                        i32.add
                        i32.store offset=20
                        local.get $l1
                        i32.const 20
                        i32.add
                        local.get $l6
                        call $skip_ws
                        block $B17
                          block $B18
                            block $B19
                              local.get $l8
                              i32.const 0
                              i32.lt_s
                              br_if $B19
                              local.get $l9
                              i32.const 0
                              i32.lt_s
                              br_if $B19
                              local.get $l1
                              i32.load offset=20
                              local.tee $l7
                              i32.const 6
                              i32.add
                              local.tee $l3
                              local.get $l6
                              i32.gt_u
                              br_if $B19
                              local.get $l7
                              i32.load8_u offset=65712
                              i32.const 60
                              i32.ne
                              br_if $B19
                              local.get $l7
                              i32.const 65717
                              i32.add
                              i32.load8_u
                              i32.const 62
                              i32.eq
                              br_if $B18
                            end
                            local.get $p0
                            i32.const -10
                            i32.add
                            local.set $l3
                            br $B17
                          end
                          block $B20
                            local.get $l7
                            i32.const 65713
                            i32.add
                            i32.load8_u
                            local.tee $p0
                            i32.const -48
                            i32.add
                            local.tee $l11
                            i32.const 255
                            i32.and
                            i32.const 9
                            i32.le_u
                            br_if $B20
                            block $B21
                              local.get $p0
                              i32.const -97
                              i32.add
                              i32.const 255
                              i32.and
                              i32.const 5
                              i32.gt_u
                              br_if $B21
                              local.get $p0
                              i32.const -87
                              i32.add
                              local.set $l11
                              br $B20
                            end
                            local.get $p0
                            i32.const -55
                            i32.add
                            i32.const -1
                            local.get $p0
                            i32.const -65
                            i32.add
                            i32.const 255
                            i32.and
                            i32.const 6
                            i32.lt_u
                            select
                            local.set $l11
                          end
                          block $B22
                            local.get $l7
                            i32.const 65714
                            i32.add
                            i32.load8_u
                            local.tee $p0
                            i32.const -48
                            i32.add
                            local.tee $l12
                            i32.const 255
                            i32.and
                            i32.const 9
                            i32.le_u
                            br_if $B22
                            block $B23
                              local.get $p0
                              i32.const -97
                              i32.add
                              i32.const 255
                              i32.and
                              i32.const 5
                              i32.gt_u
                              br_if $B23
                              local.get $p0
                              i32.const -87
                              i32.add
                              local.set $l12
                              br $B22
                            end
                            local.get $p0
                            i32.const -55
                            i32.add
                            i32.const -1
                            local.get $p0
                            i32.const -65
                            i32.add
                            i32.const 255
                            i32.and
                            i32.const 6
                            i32.lt_u
                            select
                            local.set $l12
                          end
                          block $B24
                            local.get $l7
                            i32.const 65715
                            i32.add
                            i32.load8_u
                            local.tee $p0
                            i32.const -48
                            i32.add
                            local.tee $l13
                            i32.const 255
                            i32.and
                            i32.const 9
                            i32.le_u
                            br_if $B24
                            block $B25
                              local.get $p0
                              i32.const -97
                              i32.add
                              i32.const 255
                              i32.and
                              i32.const 5
                              i32.gt_u
                              br_if $B25
                              local.get $p0
                              i32.const -87
                              i32.add
                              local.set $l13
                              br $B24
                            end
                            local.get $p0
                            i32.const -55
                            i32.add
                            i32.const -1
                            local.get $p0
                            i32.const -65
                            i32.add
                            i32.const 255
                            i32.and
                            i32.const 6
                            i32.lt_u
                            select
                            local.set $l13
                          end
                          block $B26
                            local.get $l7
                            i32.const 65716
                            i32.add
                            i32.load8_u
                            local.tee $p0
                            i32.const -48
                            i32.add
                            local.tee $l7
                            i32.const 255
                            i32.and
                            i32.const 9
                            i32.le_u
                            br_if $B26
                            block $B27
                              local.get $p0
                              i32.const -97
                              i32.add
                              i32.const 255
                              i32.and
                              i32.const 5
                              i32.gt_u
                              br_if $B27
                              local.get $p0
                              i32.const -87
                              i32.add
                              local.set $l7
                              br $B26
                            end
                            local.get $p0
                            i32.const -55
                            i32.add
                            i32.const -1
                            local.get $p0
                            i32.const -65
                            i32.add
                            i32.const 255
                            i32.and
                            i32.const 6
                            i32.lt_u
                            select
                            local.set $l7
                          end
                          local.get $l11
                          i32.const 0
                          i32.lt_s
                          br_if $B0
                          local.get $l12
                          i32.const 0
                          i32.lt_s
                          br_if $B0
                          local.get $l13
                          i32.const 0
                          i32.lt_s
                          br_if $B0
                          local.get $l7
                          i32.const 0
                          i32.lt_s
                          br_if $B0
                          local.get $l12
                          i32.const 8
                          i32.shl
                          local.get $l11
                          i32.const 12
                          i32.shl
                          i32.add
                          local.get $l13
                          i32.const 4
                          i32.shl
                          i32.add
                          local.get $l7
                          i32.add
                          local.tee $l7
                          i32.const 127
                          i32.gt_u
                          br_if $B0
                          local.get $l9
                          local.get $l8
                          i32.const 4
                          i32.shl
                          i32.add
                          local.tee $p0
                          i32.load8_u offset=8887008
                          br_if $B0
                          local.get $p0
                          local.get $l7
                          i32.store8 offset=8887264
                          local.get $p0
                          i32.const 8887008
                          i32.add
                          i32.const 1
                          i32.store8
                          local.get $l10
                          i32.const 1
                          i32.add
                          local.set $l10
                        end
                        local.get $l3
                        i32.const 11
                        i32.add
                        local.get $l6
                        i32.le_u
                        br_if $L8
                      end
                    end
                    i32.const 0
                    local.set $l2
                    local.get $l4
                    i32.const 10
                    i32.add
                    local.get $l5
                    i32.gt_u
                    br_if $B0
                    local.get $l10
                    i32.eqz
                    br_if $B0
                    i32.const 0
                    local.set $p0
                    i32.const 0
                    local.get $l4
                    i32.sub
                    local.set $l7
                    local.get $l4
                    local.get $l5
                    i32.sub
                    i32.const 10
                    i32.add
                    local.set $l8
                    block $B28
                      loop $L29
                        block $B30
                          local.get $l4
                          local.get $p0
                          i32.add
                          local.tee $l3
                          i32.const 65712
                          i32.add
                          i32.load8_u
                          i32.const 47
                          i32.ne
                          br_if $B30
                          local.get $l3
                          i32.const 65713
                          i32.add
                          i32.load8_u
                          i32.const 67
                          i32.ne
                          br_if $B30
                          local.get $l3
                          i32.const 65714
                          i32.add
                          i32.load8_u
                          i32.const 104
                          i32.ne
                          br_if $B30
                          local.get $l3
                          i32.const 65715
                          i32.add
                          i32.load8_u
                          i32.const 97
                          i32.ne
                          br_if $B30
                          local.get $l3
                          i32.const 65716
                          i32.add
                          i32.load8_u
                          i32.const 114
                          i32.ne
                          br_if $B30
                          local.get $l3
                          i32.const 65717
                          i32.add
                          i32.load8_u
                          i32.const 80
                          i32.ne
                          br_if $B30
                          local.get $l3
                          i32.const 65718
                          i32.add
                          i32.load8_u
                          i32.const 114
                          i32.ne
                          br_if $B30
                          local.get $l3
                          i32.const 65719
                          i32.add
                          i32.load8_u
                          i32.const 111
                          i32.ne
                          br_if $B30
                          local.get $l3
                          i32.const 65720
                          i32.add
                          i32.load8_u
                          i32.const 99
                          i32.ne
                          br_if $B30
                          local.get $l3
                          i32.const 65721
                          i32.add
                          i32.load8_u
                          i32.const 115
                          i32.ne
                          br_if $B30
                          block $B31
                            local.get $l7
                            local.get $p0
                            i32.eq
                            br_if $B31
                            local.get $l3
                            i32.const 65711
                            i32.add
                            i32.load8_u
                            call $delimiter
                            i32.eqz
                            br_if $B30
                          end
                          local.get $l8
                          local.get $p0
                          i32.add
                          i32.eqz
                          br_if $B28
                          local.get $l3
                          i32.const 65722
                          i32.add
                          i32.load8_u
                          call $delimiter
                          br_if $B28
                        end
                        i32.const 0
                        local.set $l2
                        local.get $l4
                        local.get $p0
                        i32.const 1
                        i32.add
                        local.tee $p0
                        i32.add
                        i32.const 10
                        i32.add
                        local.get $l5
                        i32.le_u
                        br_if $L29
                        br $B0
                      end
                    end
                    i32.const 0
                    local.set $l2
                    local.get $l4
                    i32.const -1
                    i32.xor
                    local.get $p0
                    i32.eq
                    br_if $B0
                    local.get $l3
                    i32.const 2
                    i32.add
                    local.get $l5
                    i32.gt_u
                    br_if $B0
                    local.get $p0
                    i32.const 1
                    i32.add
                    local.set $l3
                    loop $L32
                      block $B33
                        local.get $l4
                        local.get $p0
                        i32.add
                        local.tee $l7
                        i32.const 65712
                        i32.add
                        i32.load8_u
                        i32.const 60
                        i32.ne
                        br_if $B33
                        local.get $l4
                        local.get $l3
                        i32.add
                        local.tee $l8
                        i32.const 65712
                        i32.add
                        i32.load8_u
                        i32.const 60
                        i32.ne
                        br_if $B33
                        local.get $l8
                        i32.eqz
                        br_if $B0
                        local.get $l7
                        i32.const 4
                        i32.add
                        local.get $l5
                        i32.gt_u
                        br_if $B0
                        local.get $l7
                        i32.const 2
                        i32.add
                        local.tee $l9
                        local.set $l8
                        loop $L34
                          block $B35
                            local.get $l8
                            i32.const 65712
                            i32.add
                            i32.load8_u
                            i32.const 62
                            i32.ne
                            br_if $B35
                            local.get $l8
                            i32.const 65713
                            i32.add
                            i32.load8_u
                            i32.const 62
                            i32.ne
                            br_if $B35
                            local.get $l8
                            i32.const -1
                            i32.eq
                            br_if $B0
                            local.get $l4
                            local.get $l5
                            i32.const 65599
                            i32.const 12
                            call $find_key
                            local.tee $p0
                            i32.const -1
                            i32.eq
                            br_if $B0
                            i32.const -1
                            local.set $l3
                            block $B36
                              local.get $p0
                              local.get $l5
                              i32.ge_u
                              br_if $B36
                              loop $L37
                                block $B38
                                  local.get $p0
                                  i32.const 65712
                                  i32.add
                                  i32.load8_u
                                  i32.const 91
                                  i32.ne
                                  br_if $B38
                                  local.get $p0
                                  local.set $l3
                                  br $B36
                                end
                                local.get $p0
                                i32.const 2
                                i32.add
                                local.set $l7
                                local.get $p0
                                i32.const 1
                                i32.add
                                local.set $p0
                                local.get $l7
                                local.get $l5
                                i32.le_u
                                br_if $L37
                              end
                            end
                            local.get $l3
                            i32.const 2
                            i32.add
                            local.get $l5
                            i32.gt_u
                            br_if $B0
                            local.get $l3
                            i32.const 1
                            i32.add
                            local.tee $l7
                            local.set $p0
                            loop $L39
                              block $B40
                                local.get $p0
                                i32.const 65712
                                i32.add
                                i32.load8_u
                                i32.const 93
                                i32.ne
                                br_if $B40
                                local.get $l3
                                i32.const -1
                                i32.eq
                                br_if $B0
                                local.get $p0
                                i32.const -1
                                i32.eq
                                br_if $B0
                                local.get $l1
                                local.get $l7
                                i32.store offset=28
                                block $B41
                                  local.get $l7
                                  local.get $p0
                                  i32.ge_u
                                  br_if $B41
                                  i32.const -1
                                  local.set $l7
                                  loop $L42
                                    local.get $l1
                                    i32.const 28
                                    i32.add
                                    local.get $p0
                                    call $skip_ws
                                    local.get $l1
                                    i32.load offset=28
                                    local.tee $l3
                                    local.get $p0
                                    i32.ge_u
                                    br_if $B41
                                    block $B43
                                      block $B44
                                        local.get $l3
                                        i32.load8_u offset=65712
                                        local.tee $l6
                                        i32.const -58
                                        i32.add
                                        i32.const 255
                                        i32.and
                                        i32.const 246
                                        i32.lt_u
                                        br_if $B44
                                        local.get $l1
                                        i32.const 28
                                        i32.add
                                        local.get $p0
                                        call $skip_ws
                                        i32.const 0
                                        local.set $l2
                                        local.get $l1
                                        i32.load offset=28
                                        local.tee $l3
                                        local.get $p0
                                        i32.ge_u
                                        br_if $B0
                                        local.get $l3
                                        i32.load8_u offset=65712
                                        i32.const -58
                                        i32.add
                                        i32.const 255
                                        i32.and
                                        i32.const 246
                                        i32.lt_u
                                        br_if $B0
                                        i32.const 0
                                        local.set $l7
                                        block $B45
                                          loop $L46
                                            local.get $l3
                                            i32.const 65712
                                            i32.add
                                            i32.load8_u
                                            local.tee $l2
                                            i32.const -58
                                            i32.add
                                            i32.const 255
                                            i32.and
                                            i32.const 246
                                            i32.lt_u
                                            br_if $B45
                                            block $B47
                                              local.get $l7
                                              i32.const 10
                                              i32.mul
                                              local.get $l2
                                              i32.add
                                              i32.const -48
                                              i32.add
                                              local.tee $l2
                                              local.get $l7
                                              i32.ge_u
                                              br_if $B47
                                              i32.const 0
                                              local.set $l2
                                              br $B0
                                            end
                                            local.get $l2
                                            local.set $l7
                                            local.get $p0
                                            local.get $l3
                                            i32.const 1
                                            i32.add
                                            local.tee $l3
                                            i32.ne
                                            br_if $L46
                                          end
                                          local.get $p0
                                          local.set $l3
                                          local.get $l2
                                          local.set $l7
                                        end
                                        local.get $l1
                                        local.get $l3
                                        i32.store offset=28
                                        local.get $l7
                                        i32.const 255
                                        i32.le_u
                                        br_if $B43
                                        i32.const 0
                                        local.set $l2
                                        br $B0
                                      end
                                      i32.const 0
                                      local.set $l2
                                      local.get $l6
                                      i32.const 255
                                      i32.and
                                      i32.const 47
                                      i32.ne
                                      br_if $B0
                                      local.get $l3
                                      i32.const 1
                                      i32.add
                                      local.tee $l6
                                      local.set $l3
                                      block $B48
                                        local.get $l6
                                        local.get $p0
                                        i32.ge_u
                                        br_if $B48
                                        local.get $l6
                                        local.set $l3
                                        loop $L49
                                          local.get $l3
                                          i32.const 65712
                                          i32.add
                                          i32.load8_u
                                          call $delimiter
                                          br_if $B48
                                          local.get $l3
                                          i32.const 1
                                          i32.add
                                          local.tee $l3
                                          local.get $p0
                                          i32.lt_u
                                          br_if $L49
                                        end
                                        local.get $p0
                                        local.set $l3
                                      end
                                      local.get $l1
                                      local.get $l3
                                      i32.store offset=28
                                      local.get $l7
                                      i32.const 255
                                      i32.gt_u
                                      br_if $B0
                                      local.get $l9
                                      local.get $l8
                                      local.get $l6
                                      local.get $l3
                                      local.get $l6
                                      i32.sub
                                      local.get $l1
                                      i32.const 24
                                      i32.add
                                      call $charproc_ref
                                      i32.eqz
                                      br_if $B0
                                      local.get $l1
                                      i32.load offset=24
                                      local.get $l7
                                      call $parse_charproc
                                      i32.eqz
                                      br_if $B0
                                      local.get $l7
                                      i32.const 1
                                      i32.add
                                      local.set $l7
                                    end
                                    local.get $l3
                                    local.get $p0
                                    i32.lt_u
                                    br_if $L42
                                  end
                                end
                                local.get $l4
                                local.get $l5
                                i32.const 65618
                                i32.const 10
                                call $find_key
                                local.set $p0
                                i32.const 0
                                local.set $l2
                                local.get $l4
                                local.get $l5
                                i32.const 65629
                                i32.const 9
                                call $find_key
                                local.set $l3
                                local.get $p0
                                i32.const -1
                                i32.eq
                                br_if $B0
                                local.get $l3
                                i32.const -1
                                i32.eq
                                br_if $B0
                                local.get $l1
                                local.get $l3
                                i32.const 9
                                i32.add
                                i32.store offset=8
                                local.get $l1
                                local.get $p0
                                i32.const 10
                                i32.add
                                i32.store offset=12
                                local.get $l1
                                i32.const 12
                                i32.add
                                local.get $l5
                                local.get $l1
                                i32.const 24
                                i32.add
                                call $read_uint
                                i32.eqz
                                br_if $B0
                                local.get $l1
                                i32.const 8
                                i32.add
                                local.get $l5
                                local.get $l1
                                i32.const 20
                                i32.add
                                call $read_uint
                                i32.eqz
                                br_if $B0
                                local.get $l1
                                i32.load offset=24
                                local.tee $l3
                                local.get $l1
                                i32.load offset=20
                                local.tee $l7
                                i32.gt_u
                                br_if $B0
                                local.get $l7
                                i32.const 255
                                i32.gt_u
                                br_if $B0
                                local.get $l4
                                local.get $l5
                                i32.const 65573
                                i32.const 7
                                call $find_key
                                local.tee $p0
                                local.get $l5
                                i32.ge_u
                                br_if $B0
                                local.get $p0
                                i32.const 1
                                i32.add
                                local.set $p0
                                block $B50
                                  loop $L51
                                    block $B52
                                      local.get $p0
                                      i32.const 65711
                                      i32.add
                                      i32.load8_u
                                      i32.const 91
                                      i32.ne
                                      br_if $B52
                                      local.get $p0
                                      i32.eqz
                                      br_if $B0
                                      local.get $l1
                                      local.get $p0
                                      i32.store offset=28
                                      local.get $l3
                                      i32.const 2
                                      i32.shl
                                      i32.const 8887520
                                      i32.add
                                      local.set $p0
                                      br $B50
                                    end
                                    local.get $p0
                                    i32.const 1
                                    i32.add
                                    local.tee $p0
                                    local.get $l5
                                    i32.le_u
                                    br_if $L51
                                    br $B0
                                  end
                                end
                                loop $L53
                                  local.get $l1
                                  i32.const 28
                                  i32.add
                                  local.get $l5
                                  local.get $p0
                                  call $read_uint
                                  i32.eqz
                                  br_if $B0
                                  local.get $p0
                                  i32.const 4
                                  i32.add
                                  local.set $p0
                                  local.get $l3
                                  i32.const 1
                                  i32.add
                                  local.tee $l3
                                  local.get $l7
                                  i32.le_u
                                  br_if $L53
                                end
                                local.get $l1
                                i32.const 28
                                i32.add
                                local.get $l5
                                call $skip_ws
                                local.get $l1
                                i32.load offset=28
                                local.tee $p0
                                local.get $l5
                                i32.ge_u
                                br_if $B0
                                local.get $p0
                                i32.load8_u offset=65712
                                i32.const 93
                                i32.eq
                                local.set $l2
                                br $B0
                              end
                              local.get $p0
                              i32.const 2
                              i32.add
                              local.set $l6
                              local.get $p0
                              i32.const 1
                              i32.add
                              local.set $p0
                              local.get $l6
                              local.get $l5
                              i32.le_u
                              br_if $L39
                              br $B0
                            end
                          end
                          local.get $l8
                          i32.const 3
                          i32.add
                          local.set $p0
                          local.get $l8
                          i32.const 1
                          i32.add
                          local.set $l8
                          local.get $p0
                          local.get $l5
                          i32.le_u
                          br_if $L34
                          br $B0
                        end
                      end
                      local.get $l3
                      i32.const 1
                      i32.add
                      local.set $l3
                      local.get $l4
                      local.get $p0
                      i32.const 1
                      i32.add
                      local.tee $p0
                      i32.add
                      i32.const 2
                      i32.add
                      local.get $l5
                      i32.le_u
                      br_if $L32
                      br $B0
                    end
                  end
                  i32.const 0
                  local.set $l2
                  br $B0
                end
                local.get $l7
                i32.const 1
                i32.add
                local.set $l7
                local.get $l3
                local.get $p0
                i32.const 1
                i32.add
                local.tee $p0
                i32.add
                i32.const 7
                i32.add
                local.get $l6
                i32.le_u
                br_if $L5
                br $B0
              end
            end
            local.get $l7
            i32.const -1
            i32.add
            local.set $l7
            local.get $l3
            local.get $p0
            i32.const 1
            i32.add
            local.tee $p0
            i32.add
            i32.const 9
            i32.add
            local.get $l6
            i32.le_u
            br_if $L3
            br $B0
          end
        end
        local.get $l3
        i32.const -1
        i32.add
        local.set $l3
        local.get $l4
        local.get $p0
        i32.const 1
        i32.add
        local.tee $p0
        i32.add
        i32.const 33
        i32.add
        local.get $l5
        i32.le_u
        br_if $L1
      end
      i32.const 0
      local.set $l2
    end
    local.get $l1
    i32.const 32
    i32.add
    global.set $__stack_pointer
    local.get $l2)
  (func $parse_content (type $t8) (param $p0 i32) (param $p1 i32) (result i32)
    (local $l2 i32) (local $l3 i32) (local $l4 i32) (local $l5 i32) (local $l6 i32) (local $l7 i32) (local $l8 i32) (local $l9 i32)
    global.get $__stack_pointer
    i32.const 16
    i32.sub
    local.tee $l2
    global.set $__stack_pointer
    i32.const 0
    local.set $l3
    block $B0
      local.get $p0
      local.get $l2
      i32.const 12
      i32.add
      local.get $l2
      i32.const 8
      i32.add
      call $stream_range
      i32.eqz
      br_if $B0
      local.get $l2
      i32.const 12
      i32.add
      local.get $l2
      i32.load offset=8
      local.tee $p0
      call $skip_ws
      local.get $l2
      i32.load offset=12
      local.tee $l4
      i32.const 2
      i32.add
      local.tee $l5
      local.get $p0
      i32.gt_u
      br_if $B0
      local.get $l4
      i32.const 65712
      i32.add
      i32.load8_u
      i32.const 66
      i32.ne
      br_if $B0
      local.get $l4
      i32.const 65713
      i32.add
      i32.load8_u
      i32.const 84
      i32.ne
      br_if $B0
      block $B1
        local.get $l5
        local.get $p0
        i32.ge_u
        br_if $B1
        local.get $l5
        i32.load8_u offset=65712
        call $delimiter
        i32.eqz
        br_if $B0
      end
      local.get $l2
      local.get $l5
      i32.store offset=12
      local.get $l2
      i32.const 12
      i32.add
      local.get $p0
      call $skip_ws
      local.get $l2
      i32.load offset=12
      local.tee $l4
      local.get $p0
      i32.ge_u
      br_if $B0
      local.get $l2
      local.get $l4
      i32.const 1
      i32.add
      i32.store offset=12
      local.get $l4
      i32.load8_u offset=65712
      i32.const 47
      i32.ne
      br_if $B0
      local.get $l2
      i32.const 12
      i32.add
      local.get $p0
      call $skip_ws
      local.get $l2
      i32.load offset=12
      local.tee $l4
      i32.const 2
      i32.add
      local.tee $l5
      local.get $p0
      i32.gt_u
      br_if $B0
      local.get $l4
      i32.const 65712
      i32.add
      i32.load8_u
      i32.const 70
      i32.ne
      br_if $B0
      local.get $l4
      i32.const 65713
      i32.add
      i32.load8_u
      i32.const 49
      i32.ne
      br_if $B0
      block $B2
        local.get $l5
        local.get $p0
        i32.ge_u
        br_if $B2
        local.get $l5
        i32.load8_u offset=65712
        call $delimiter
        i32.eqz
        br_if $B0
      end
      local.get $l2
      local.get $l5
      i32.store offset=12
      local.get $l2
      i32.const 12
      i32.add
      local.get $p0
      call $skip_ws
      local.get $l2
      i32.load offset=12
      local.tee $l4
      local.get $p0
      i32.ge_u
      br_if $B0
      local.get $l4
      i32.load8_u offset=65712
      i32.const -58
      i32.add
      i32.const 255
      i32.and
      i32.const 246
      i32.lt_u
      br_if $B0
      local.get $p1
      i32.const 2
      i32.shl
      i32.const 8890352
      i32.add
      local.set $l6
      i32.const 0
      local.set $l3
      block $B3
        loop $L4
          local.get $l4
          i32.const 65712
          i32.add
          i32.load8_u
          local.tee $l5
          i32.const -58
          i32.add
          i32.const 255
          i32.and
          i32.const 246
          i32.lt_u
          br_if $B3
          block $B5
            local.get $l3
            i32.const 10
            i32.mul
            local.get $l5
            i32.add
            i32.const -48
            i32.add
            local.tee $l5
            local.get $l3
            i32.ge_u
            br_if $B5
            i32.const 0
            local.set $l3
            br $B0
          end
          local.get $l5
          local.set $l3
          local.get $p0
          local.get $l4
          i32.const 1
          i32.add
          local.tee $l4
          i32.ne
          br_if $L4
        end
        local.get $p0
        local.set $l4
        local.get $l5
        local.set $l3
      end
      local.get $l6
      local.get $l3
      i32.store
      local.get $l2
      local.get $l4
      i32.store offset=12
      local.get $l2
      i32.const 12
      i32.add
      local.get $p0
      call $skip_ws
      i32.const 0
      local.set $l3
      local.get $l2
      i32.load offset=12
      local.tee $l4
      i32.const 2
      i32.add
      local.tee $l5
      local.get $p0
      i32.gt_u
      br_if $B0
      local.get $l4
      i32.const 65712
      i32.add
      i32.load8_u
      i32.const 84
      i32.ne
      br_if $B0
      local.get $l4
      i32.const 65713
      i32.add
      i32.load8_u
      i32.const 102
      i32.ne
      br_if $B0
      block $B6
        local.get $l5
        local.get $p0
        i32.ge_u
        br_if $B6
        local.get $l5
        i32.load8_u offset=65712
        call $delimiter
        i32.eqz
        br_if $B0
      end
      local.get $l2
      local.get $l5
      i32.store offset=12
      local.get $l2
      i32.const 12
      i32.add
      local.get $p0
      call $skip_ws
      local.get $l2
      i32.load offset=12
      local.tee $l4
      local.get $p0
      i32.ge_u
      br_if $B0
      local.get $l4
      i32.load8_u offset=65712
      i32.const -58
      i32.add
      i32.const 255
      i32.and
      i32.const 246
      i32.lt_u
      br_if $B0
      local.get $p1
      i32.const 2
      i32.shl
      i32.const 8890864
      i32.add
      local.set $l6
      i32.const 0
      local.set $l3
      block $B7
        loop $L8
          local.get $l4
          i32.const 65712
          i32.add
          i32.load8_u
          local.tee $l5
          i32.const -58
          i32.add
          i32.const 255
          i32.and
          i32.const 246
          i32.lt_u
          br_if $B7
          block $B9
            local.get $l3
            i32.const 10
            i32.mul
            local.get $l5
            i32.add
            i32.const -48
            i32.add
            local.tee $l5
            local.get $l3
            i32.ge_u
            br_if $B9
            i32.const 0
            local.set $l3
            br $B0
          end
          local.get $l5
          local.set $l3
          local.get $p0
          local.get $l4
          i32.const 1
          i32.add
          local.tee $l4
          i32.ne
          br_if $L8
        end
        local.get $p0
        local.set $l4
        local.get $l5
        local.set $l3
      end
      local.get $l6
      local.get $l3
      i32.store
      local.get $l2
      local.get $l4
      i32.store offset=12
      i32.const 0
      local.set $l3
      local.get $l2
      i32.const 12
      i32.add
      local.get $p0
      local.get $p1
      i32.const 2
      i32.shl
      i32.const 8903664
      i32.add
      call $read_uint
      i32.eqz
      br_if $B0
      local.get $l2
      i32.const 12
      i32.add
      local.get $p0
      i32.const 65693
      i32.const 2
      call $match_token
      i32.eqz
      br_if $B0
      local.get $l2
      i32.const 12
      i32.add
      local.get $p0
      call $skip_ws
      local.get $l2
      i32.load offset=12
      local.tee $l4
      local.get $p0
      i32.ge_u
      br_if $B0
      local.get $l4
      i32.load8_u offset=65712
      i32.const 40
      i32.ne
      br_if $B0
      local.get $l4
      i32.const 1
      i32.add
      local.tee $l4
      local.get $p0
      i32.ge_u
      br_if $B0
      local.get $p1
      i32.const 96
      i32.mul
      local.set $l7
      i32.const 0
      local.set $l6
      block $B10
        loop $L11
          local.get $l4
          i32.const 1
          i32.add
          local.set $l3
          block $B12
            block $B13
              local.get $l4
              i32.load8_u offset=65712
              local.tee $l5
              i32.const 92
              i32.eq
              br_if $B13
              local.get $l5
              i32.const 41
              i32.eq
              br_if $B10
              local.get $l3
              local.set $l4
              br $B12
            end
            block $B14
              local.get $l3
              local.get $p0
              i32.lt_u
              br_if $B14
              i32.const 0
              local.set $l3
              br $B0
            end
            local.get $l4
            i32.const 65713
            i32.add
            i32.load8_u
            local.set $l5
            local.get $l4
            i32.const 2
            i32.add
            local.set $l4
          end
          i32.const 0
          local.set $l3
          local.get $l6
          i32.const 96
          i32.eq
          br_if $B0
          local.get $l5
          i32.const 255
          i32.and
          local.tee $l8
          i32.load8_u offset=8887008
          i32.eqz
          br_if $B0
          local.get $l7
          local.get $l6
          i32.add
          local.tee $l9
          i32.const 8891376
          i32.add
          local.get $l5
          i32.store8
          local.get $l9
          i32.const 8870112
          i32.add
          local.get $l8
          i32.load8_u offset=8887264
          i32.store8
          local.get $l6
          i32.const 1
          i32.add
          local.set $l6
          local.get $l4
          local.get $p0
          i32.lt_u
          br_if $L11
          br $B0
        end
      end
      local.get $l2
      local.get $l3
      i32.store offset=12
      i32.const 0
      local.set $l3
      local.get $l2
      i32.const 12
      i32.add
      local.get $p0
      i32.const 65643
      i32.const 2
      call $match_token
      i32.eqz
      br_if $B0
      local.get $l2
      i32.const 12
      i32.add
      local.get $p0
      i32.const 65696
      i32.const 2
      call $match_token
      i32.eqz
      br_if $B0
      local.get $l2
      i32.const 12
      i32.add
      local.get $p0
      call $skip_ws
      local.get $l2
      i32.load offset=12
      local.get $p0
      i32.ne
      br_if $B0
      local.get $p1
      i32.const 2
      i32.shl
      local.get $l6
      i32.store offset=8882400
      i32.const 1
      local.set $l3
    end
    local.get $l2
    i32.const 16
    i32.add
    global.set $__stack_pointer
    local.get $l3)
  (func $delimiter (type $t2) (param $p0 i32) (result i32)
    (local $l1 i32)
    i32.const 1
    local.set $l1
    block $B0
      block $B1
        local.get $p0
        br_table $B0 $B1 $B1 $B1 $B1 $B1 $B1 $B1 $B1 $B0 $B0 $B1 $B0 $B0 $B1 $B1 $B1 $B1 $B1 $B1 $B1 $B1 $B1 $B1 $B1 $B1 $B1 $B1 $B1 $B1 $B1 $B1 $B0 $B1 $B1 $B1 $B1 $B1 $B1 $B1 $B0 $B0 $B1 $B1 $B1 $B1 $B1 $B0 $B1 $B1 $B1 $B1 $B1 $B1 $B1 $B1 $B1 $B1 $B1 $B1 $B0 $B1 $B0 $B1 $B1 $B1 $B1 $B1 $B1 $B1 $B1 $B1 $B1 $B1 $B1 $B1 $B1 $B1 $B1 $B1 $B1 $B1 $B1 $B1 $B1 $B1 $B1 $B1 $B1 $B1 $B1 $B0 $B1 $B0 $B1
      end
      local.get $p0
      i32.const 37
      i32.eq
      local.set $l1
    end
    local.get $l1)
  (func $find_direct_key (type $t5) (param $p0 i32) (param $p1 i32) (param $p2 i32) (param $p3 i32) (result i32)
    (local $l4 i32) (local $l5 i32) (local $l6 i32) (local $l7 i32) (local $l8 i32)
    global.get $__stack_pointer
    i32.const 16
    i32.sub
    local.tee $l4
    global.set $__stack_pointer
    local.get $l4
    local.get $p0
    i32.store offset=12
    local.get $l4
    i32.const 12
    i32.add
    local.get $p1
    call $skip_ws
    i32.const -1
    local.set $l5
    block $B0
      local.get $l4
      i32.load offset=12
      local.tee $l6
      i32.const 2
      i32.add
      local.get $p1
      i32.gt_u
      br_if $B0
      local.get $l6
      i32.const 65712
      i32.add
      i32.load8_u
      i32.const 60
      i32.ne
      br_if $B0
      local.get $l6
      i32.const 65713
      i32.add
      i32.load8_u
      i32.const 60
      i32.ne
      br_if $B0
      local.get $l6
      local.get $p1
      i32.ge_u
      br_if $B0
      i32.const 0
      local.set $l7
      loop $L1
        local.get $l6
        local.set $p0
        loop $L2
          block $B3
            block $B4
              block $B5
                block $B6
                  local.get $p0
                  i32.load8_u offset=65712
                  local.tee $l5
                  i32.const -37
                  i32.add
                  br_table $B6 $B5 $B5 $B4 $B5
                end
                local.get $p0
                local.get $p1
                i32.ge_u
                br_if $B3
                loop $L7
                  block $B8
                    local.get $p0
                    i32.const 65712
                    i32.add
                    i32.load8_u
                    i32.const -10
                    i32.add
                    br_table $B3 $B8 $B8 $B3 $B8
                  end
                  i32.const -1
                  local.set $l5
                  local.get $p1
                  local.get $p0
                  i32.const 1
                  i32.add
                  local.tee $p0
                  i32.ne
                  br_if $L7
                  br $B0
                end
              end
              local.get $p0
              i32.const 65712
              i32.add
              local.set $l8
              block $B9
                local.get $p0
                i32.const 2
                i32.add
                local.tee $l6
                local.get $p1
                i32.gt_u
                br_if $B9
                block $B10
                  block $B11
                    block $B12
                      local.get $l5
                      i32.const -60
                      i32.add
                      br_table $B12 $B9 $B11 $B9
                    end
                    local.get $l8
                    i32.const 1
                    i32.add
                    i32.load8_u
                    i32.const 60
                    i32.ne
                    br_if $B9
                    local.get $l7
                    i32.const 1
                    i32.add
                    local.set $l7
                    br $B10
                  end
                  local.get $l8
                  i32.const 1
                  i32.add
                  i32.load8_u
                  i32.const 62
                  i32.ne
                  br_if $B9
                  i32.const -1
                  local.set $l5
                  local.get $l7
                  i32.const 2
                  i32.lt_u
                  br_if $B0
                  local.get $l7
                  i32.const -1
                  i32.add
                  local.set $l7
                end
                i32.const -1
                local.set $l5
                local.get $l6
                local.get $p1
                i32.ge_u
                br_if $B0
                br $L1
              end
              block $B13
                local.get $l7
                i32.const 1
                i32.ne
                br_if $B13
                local.get $p0
                local.get $p3
                i32.add
                local.tee $l5
                local.get $p1
                i32.gt_u
                br_if $B13
                i32.const 0
                local.set $l6
                loop $L14
                  local.get $p0
                  local.get $l6
                  i32.add
                  i32.const 65712
                  i32.add
                  i32.load8_u
                  local.get $p2
                  local.get $l6
                  i32.add
                  i32.load8_u
                  i32.ne
                  br_if $B13
                  local.get $p3
                  local.get $l6
                  i32.const 1
                  i32.add
                  local.tee $l6
                  i32.ne
                  br_if $L14
                end
                block $B15
                  local.get $p0
                  i32.eqz
                  br_if $B15
                  local.get $l8
                  i32.const -1
                  i32.add
                  i32.load8_u
                  call $delimiter
                  i32.eqz
                  br_if $B13
                end
                block $B16
                  local.get $l5
                  local.get $p1
                  i32.ne
                  br_if $B16
                  local.get $p0
                  local.set $l5
                  br $B0
                end
                local.get $l5
                i32.load8_u offset=65712
                call $delimiter
                i32.eqz
                br_if $B13
                local.get $p0
                local.set $l5
                br $B0
              end
              local.get $p0
              i32.const 1
              i32.add
              local.set $p0
              br $B3
            end
            i32.const -1
            local.set $l5
            local.get $p0
            i32.const 1
            i32.add
            local.tee $p0
            local.get $p1
            i32.ge_u
            br_if $B0
            i32.const 1
            local.set $l8
            loop $L17
              block $B18
                block $B19
                  block $B20
                    block $B21
                      local.get $p0
                      i32.load8_u offset=65712
                      local.tee $l6
                      i32.const 92
                      i32.eq
                      br_if $B21
                      local.get $l6
                      i32.const -40
                      i32.add
                      br_table $B20 $B19 $B18
                    end
                    i32.const 2
                    i32.const 1
                    local.get $p0
                    i32.const 1
                    i32.add
                    local.get $p1
                    i32.lt_u
                    select
                    local.get $p0
                    i32.add
                    local.tee $p0
                    local.get $p1
                    i32.lt_u
                    br_if $L17
                    br $B0
                  end
                  local.get $l8
                  i32.const 1
                  i32.add
                  local.set $l8
                  br $B18
                end
                local.get $l8
                i32.const -1
                i32.add
                local.set $l8
              end
              block $B22
                local.get $p0
                i32.const 1
                i32.add
                local.tee $p0
                local.get $p1
                i32.ge_u
                br_if $B22
                local.get $l8
                br_if $L17
              end
            end
            local.get $l8
            br_if $B0
          end
          i32.const -1
          local.set $l5
          local.get $p0
          local.get $p1
          i32.lt_u
          br_if $L2
        end
      end
    end
    local.get $l4
    i32.const 16
    i32.add
    global.set $__stack_pointer
    local.get $l5)
  (func $stream_range (type $t4) (param $p0 i32) (param $p1 i32) (param $p2 i32) (result i32)
    (local $l3 i32) (local $l4 i32) (local $l5 i32) (local $l6 i32) (local $l7 i32) (local $l8 i32) (local $l9 i32) (local $l10 i32)
    global.get $__stack_pointer
    i32.const 16
    i32.sub
    local.tee $l3
    global.set $__stack_pointer
    i32.const 0
    local.set $l4
    block $B0
      local.get $p0
      i32.const -1
      i32.add
      i32.const 0
      i32.load offset=8890336
      i32.ge_u
      br_if $B0
      local.get $p0
      i32.const 2
      i32.shl
      local.tee $p0
      i32.load offset=8884960
      local.tee $l5
      i32.eqz
      br_if $B0
      local.get $p0
      i32.load offset=8882912
      local.tee $l6
      local.get $l5
      i32.le_u
      br_if $B0
      i32.const -1
      local.set $l7
      block $B1
        local.get $l5
        i32.const 7
        i32.add
        local.tee $l8
        local.get $l6
        i32.gt_u
        br_if $B1
        local.get $l6
        i32.const -7
        i32.add
        local.set $l9
        local.get $l5
        local.set $l10
        loop $L2
          block $B3
            local.get $l10
            local.tee $p0
            i32.const 65712
            i32.add
            i32.load8_u
            i32.const 47
            i32.ne
            br_if $B3
            local.get $p0
            i32.const 65713
            i32.add
            i32.load8_u
            i32.const 76
            i32.ne
            br_if $B3
            local.get $p0
            i32.const 65714
            i32.add
            i32.load8_u
            i32.const 101
            i32.ne
            br_if $B3
            local.get $p0
            i32.const 65715
            i32.add
            i32.load8_u
            i32.const 110
            i32.ne
            br_if $B3
            local.get $p0
            i32.const 65716
            i32.add
            i32.load8_u
            i32.const 103
            i32.ne
            br_if $B3
            local.get $p0
            i32.const 65717
            i32.add
            i32.load8_u
            i32.const 116
            i32.ne
            br_if $B3
            local.get $p0
            i32.const 65718
            i32.add
            i32.load8_u
            i32.const 104
            i32.ne
            br_if $B3
            block $B4
              local.get $p0
              i32.eqz
              br_if $B4
              local.get $p0
              i32.const 65711
              i32.add
              i32.load8_u
              call $delimiter
              i32.eqz
              br_if $B3
            end
            block $B5
              local.get $l9
              local.get $p0
              i32.ne
              br_if $B5
              local.get $p0
              local.set $l7
              br $B1
            end
            local.get $p0
            i32.const 65719
            i32.add
            i32.load8_u
            call $delimiter
            i32.eqz
            br_if $B3
            local.get $p0
            local.set $l7
            br $B1
          end
          local.get $p0
          i32.const 1
          i32.add
          local.set $l10
          local.get $p0
          i32.const 8
          i32.add
          local.get $l6
          i32.le_u
          br_if $L2
        end
      end
      local.get $l5
      i32.const 6
      i32.add
      local.get $l6
      i32.gt_u
      br_if $B0
      loop $L6
        block $B7
          local.get $l8
          local.tee $p0
          i32.const 65705
          i32.add
          i32.load8_u
          i32.const 115
          i32.ne
          br_if $B7
          local.get $p0
          i32.const 65706
          i32.add
          i32.load8_u
          i32.const 116
          i32.ne
          br_if $B7
          local.get $p0
          i32.const 65707
          i32.add
          i32.load8_u
          i32.const 114
          i32.ne
          br_if $B7
          local.get $p0
          i32.const 65708
          i32.add
          i32.load8_u
          i32.const 101
          i32.ne
          br_if $B7
          local.get $p0
          i32.const 65709
          i32.add
          i32.load8_u
          i32.const 97
          i32.ne
          br_if $B7
          local.get $p0
          i32.const 65710
          i32.add
          i32.load8_u
          i32.const 109
          i32.ne
          br_if $B7
          local.get $l7
          i32.const -1
          i32.eq
          br_if $B0
          local.get $p0
          i32.const 6
          i32.eq
          br_if $B0
          local.get $l3
          local.get $l7
          i32.const 7
          i32.add
          i32.store offset=12
          local.get $l3
          i32.const 12
          i32.add
          local.get $l6
          call $skip_ws
          local.get $l3
          i32.load offset=12
          local.tee $l10
          local.get $l6
          i32.ge_u
          br_if $B0
          local.get $l10
          i32.load8_u offset=65712
          i32.const -58
          i32.add
          i32.const 255
          i32.and
          i32.const 246
          i32.lt_u
          br_if $B0
          i32.const 0
          local.set $l8
          block $B8
            loop $L9
              block $B10
                local.get $l10
                i32.const 65712
                i32.add
                i32.load8_u
                local.tee $l4
                i32.const -58
                i32.add
                i32.const 255
                i32.and
                i32.const 246
                i32.ge_u
                br_if $B10
                local.get $l8
                local.set $l5
                br $B8
              end
              block $B11
                local.get $l8
                i32.const 10
                i32.mul
                local.get $l4
                i32.add
                i32.const -48
                i32.add
                local.tee $l5
                local.get $l8
                i32.ge_u
                br_if $B11
                i32.const 0
                local.set $l4
                br $B0
              end
              local.get $l5
              local.set $l8
              local.get $l6
              local.get $l10
              i32.const 1
              i32.add
              local.tee $l10
              i32.ne
              br_if $L9
            end
          end
          block $B12
            local.get $p0
            i32.const -1
            i32.add
            local.tee $l10
            local.get $l6
            i32.ge_u
            br_if $B12
            local.get $p0
            local.get $l10
            local.get $p0
            i32.const 65711
            i32.add
            i32.load8_u
            i32.const 13
            i32.eq
            select
            local.set $l10
          end
          i32.const 0
          local.set $l4
          local.get $l10
          local.get $l6
          i32.ge_u
          br_if $B0
          local.get $l10
          i32.load8_u offset=65712
          i32.const 10
          i32.ne
          br_if $B0
          local.get $l10
          i32.const 1
          i32.add
          local.tee $l10
          local.get $l5
          i32.add
          local.tee $p0
          local.get $l6
          i32.gt_u
          br_if $B0
          local.get $p1
          local.get $l10
          i32.store
          local.get $p2
          local.get $p0
          i32.store
          block $B13
            local.get $p0
            local.get $l6
            i32.ge_u
            br_if $B13
            local.get $p0
            local.get $p0
            i32.load8_u offset=65712
            i32.const 13
            i32.eq
            i32.add
            local.set $p0
          end
          block $B14
            local.get $p0
            local.get $l6
            i32.ge_u
            br_if $B14
            local.get $p0
            local.get $p0
            i32.load8_u offset=65712
            i32.const 10
            i32.eq
            i32.add
            local.set $p0
          end
          local.get $p0
          i32.const 9
          i32.add
          local.get $l6
          i32.gt_u
          br_if $B0
          local.get $p0
          i32.const 65712
          i32.add
          i32.load8_u
          i32.const 101
          i32.ne
          br_if $B0
          local.get $p0
          i32.const 65713
          i32.add
          i32.load8_u
          i32.const 110
          i32.ne
          br_if $B0
          local.get $p0
          i32.const 65714
          i32.add
          i32.load8_u
          i32.const 100
          i32.ne
          br_if $B0
          local.get $p0
          i32.const 65715
          i32.add
          i32.load8_u
          i32.const 115
          i32.ne
          br_if $B0
          local.get $p0
          i32.const 65716
          i32.add
          i32.load8_u
          i32.const 116
          i32.ne
          br_if $B0
          local.get $p0
          i32.const 65717
          i32.add
          i32.load8_u
          i32.const 114
          i32.ne
          br_if $B0
          local.get $p0
          i32.const 65718
          i32.add
          i32.load8_u
          i32.const 101
          i32.ne
          br_if $B0
          local.get $p0
          i32.const 65719
          i32.add
          i32.load8_u
          i32.const 97
          i32.ne
          br_if $B0
          local.get $p0
          i32.const 65720
          i32.add
          i32.load8_u
          i32.const 109
          i32.eq
          local.set $l4
          br $B0
        end
        local.get $p0
        i32.const 1
        i32.add
        local.set $l8
        local.get $p0
        local.get $l6
        i32.le_u
        br_if $L6
      end
    end
    local.get $l3
    i32.const 16
    i32.add
    global.set $__stack_pointer
    local.get $l4)
  (func $charproc_ref (type $t6) (param $p0 i32) (param $p1 i32) (param $p2 i32) (param $p3 i32) (param $p4 i32) (result i32)
    (local $l5 i32) (local $l6 i32) (local $l7 i32) (local $l8 i32) (local $l9 i32) (local $l10 i32) (local $l11 i32) (local $l12 i32) (local $l13 i32)
    global.get $__stack_pointer
    i32.const 16
    i32.sub
    local.tee $l5
    global.set $__stack_pointer
    local.get $l5
    local.get $p0
    i32.store offset=12
    block $B0
      block $B1
        local.get $p0
        local.get $p1
        i32.lt_u
        br_if $B1
        i32.const 0
        local.set $l6
        br $B0
      end
      local.get $p2
      i32.const 65712
      i32.add
      local.set $l7
      loop $L2
        local.get $l5
        i32.const 12
        i32.add
        local.get $p1
        call $skip_ws
        block $B3
          local.get $l5
          i32.load offset=12
          local.tee $p0
          local.get $p1
          i32.lt_u
          br_if $B3
          i32.const 0
          local.set $l6
          br $B0
        end
        block $B4
          local.get $p0
          i32.load8_u offset=65712
          i32.const 47
          i32.eq
          br_if $B4
          i32.const 0
          local.set $l6
          br $B0
        end
        local.get $p0
        i32.const 1
        i32.add
        local.tee $l8
        local.set $l9
        block $B5
          local.get $l8
          local.get $p1
          i32.ge_u
          br_if $B5
          local.get $l8
          local.set $l9
          loop $L6
            block $B7
              local.get $l9
              i32.const 65712
              i32.add
              i32.load8_u
              br_table $B5 $B7 $B7 $B7 $B7 $B7 $B7 $B7 $B7 $B5 $B5 $B7 $B5 $B5 $B7 $B7 $B7 $B7 $B7 $B7 $B7 $B7 $B7 $B7 $B7 $B7 $B7 $B7 $B7 $B7 $B7 $B7 $B5 $B7 $B7 $B7 $B7 $B5 $B7 $B7 $B5 $B5 $B7 $B7 $B7 $B7 $B7 $B5 $B7 $B7 $B7 $B7 $B7 $B7 $B7 $B7 $B7 $B7 $B7 $B7 $B5 $B7 $B5 $B7 $B7 $B7 $B7 $B7 $B7 $B7 $B7 $B7 $B7 $B7 $B7 $B7 $B7 $B7 $B7 $B7 $B7 $B7 $B7 $B7 $B7 $B7 $B7 $B7 $B7 $B7 $B7 $B5 $B7 $B5 $B7
            end
            local.get $p1
            local.get $l9
            i32.const 1
            i32.add
            local.tee $l9
            i32.ne
            br_if $L6
          end
          local.get $p1
          local.set $l9
        end
        local.get $l5
        local.get $l9
        i32.store offset=12
        local.get $l5
        i32.const 12
        i32.add
        local.get $p1
        call $skip_ws
        block $B8
          local.get $l5
          i32.load offset=12
          local.tee $p0
          local.get $p1
          i32.lt_u
          br_if $B8
          i32.const 0
          local.set $l6
          br $B0
        end
        block $B9
          local.get $p0
          i32.load8_u offset=65712
          i32.const -58
          i32.add
          i32.const 255
          i32.and
          i32.const 246
          i32.ge_u
          br_if $B9
          i32.const 0
          local.set $l6
          br $B0
        end
        local.get $l9
        local.get $l8
        i32.sub
        local.set $l10
        i32.const 0
        local.set $p2
        block $B10
          loop $L11
            local.get $p0
            i32.const 65712
            i32.add
            i32.load8_u
            local.tee $l11
            i32.const -58
            i32.add
            i32.const 255
            i32.and
            i32.const 246
            i32.lt_u
            br_if $B10
            block $B12
              local.get $p2
              i32.const 10
              i32.mul
              local.get $l11
              i32.add
              i32.const -48
              i32.add
              local.tee $l11
              local.get $p2
              i32.ge_u
              br_if $B12
              i32.const 0
              local.set $l6
              br $B0
            end
            local.get $l11
            local.set $p2
            local.get $p1
            local.get $p0
            i32.const 1
            i32.add
            local.tee $p0
            i32.ne
            br_if $L11
          end
          local.get $p1
          local.set $p0
          local.get $l11
          local.set $p2
        end
        local.get $l5
        local.get $p0
        i32.store offset=12
        local.get $l5
        i32.const 12
        i32.add
        local.get $p1
        call $skip_ws
        i32.const 0
        local.set $l6
        local.get $l5
        i32.load offset=12
        local.tee $p0
        local.get $p1
        i32.ge_u
        br_if $B0
        local.get $p0
        i32.load8_u offset=65712
        i32.const -58
        i32.add
        i32.const 255
        i32.and
        i32.const 246
        i32.lt_u
        br_if $B0
        i32.const 0
        local.set $l11
        block $B13
          loop $L14
            local.get $p0
            i32.const 65712
            i32.add
            i32.load8_u
            local.tee $l12
            i32.const -58
            i32.add
            i32.const 255
            i32.and
            i32.const 246
            i32.lt_u
            br_if $B13
            block $B15
              local.get $l11
              i32.const 10
              i32.mul
              local.get $l12
              i32.add
              i32.const -48
              i32.add
              local.tee $l12
              local.get $l11
              i32.ge_u
              br_if $B15
              i32.const 0
              local.set $l6
              br $B0
            end
            local.get $l12
            local.set $l11
            local.get $p1
            local.get $p0
            i32.const 1
            i32.add
            local.tee $p0
            i32.ne
            br_if $L14
          end
          local.get $p1
          local.set $p0
          local.get $l12
          local.set $l11
        end
        local.get $l5
        local.get $p0
        i32.store offset=12
        i32.const 0
        local.set $l6
        local.get $l11
        br_if $B0
        local.get $l5
        i32.const 12
        i32.add
        local.get $p1
        call $skip_ws
        local.get $l5
        i32.load offset=12
        local.tee $p0
        i32.const 1
        i32.add
        local.tee $l13
        local.get $p1
        i32.gt_u
        br_if $B0
        local.get $p0
        i32.const 65712
        i32.add
        i32.load8_u
        i32.const 82
        i32.ne
        br_if $B0
        block $B16
          local.get $l13
          local.get $p1
          i32.ge_u
          br_if $B16
          local.get $l13
          i32.load8_u offset=65712
          call $delimiter
          i32.eqz
          br_if $B0
        end
        local.get $l5
        local.get $l13
        i32.store offset=12
        block $B17
          block $B18
            local.get $l10
            local.get $p3
            i32.ne
            br_if $B18
            local.get $l9
            local.get $l8
            i32.eq
            br_if $B17
            local.get $l8
            i32.const 65712
            i32.add
            local.set $p0
            local.get $l7
            local.set $l11
            local.get $p3
            local.set $l12
            loop $L19
              local.get $p0
              i32.load8_u
              local.get $l11
              i32.load8_u
              i32.ne
              br_if $B18
              local.get $p0
              i32.const 1
              i32.add
              local.set $p0
              local.get $l11
              i32.const 1
              i32.add
              local.set $l11
              local.get $l12
              i32.const -1
              i32.add
              local.tee $l12
              i32.eqz
              br_if $B17
              br $L19
            end
          end
          local.get $l13
          local.get $p1
          i32.lt_u
          br_if $L2
          br $B0
        end
      end
      local.get $p4
      local.get $p2
      i32.store
      i32.const 1
      local.set $l6
    end
    local.get $l5
    i32.const 16
    i32.add
    global.set $__stack_pointer
    local.get $l6)
  (func $parse_charproc (type $t8) (param $p0 i32) (param $p1 i32) (result i32)
    (local $l2 i32) (local $l3 i32) (local $l4 i32) (local $l5 i32) (local $l6 i32) (local $l7 i32) (local $l8 i32) (local $l9 i32) (local $l10 i32)
    global.get $__stack_pointer
    i32.const 16
    i32.sub
    local.tee $l2
    global.set $__stack_pointer
    i32.const 0
    local.set $l3
    block $B0
      local.get $p0
      local.get $l2
      i32.const 12
      i32.add
      local.get $l2
      i32.const 8
      i32.add
      call $stream_range
      i32.eqz
      br_if $B0
      local.get $l2
      i32.const 12
      i32.add
      local.get $l2
      i32.load offset=8
      local.tee $l4
      call $skip_ws
      block $B1
        local.get $l2
        i32.load offset=12
        local.tee $p0
        local.get $l4
        i32.ge_u
        br_if $B1
        local.get $p0
        i32.load8_u offset=65712
        i32.const 45
        i32.ne
        br_if $B1
        local.get $l2
        local.get $p0
        i32.const 1
        i32.add
        i32.store offset=12
      end
      local.get $l2
      i32.const 12
      i32.add
      local.get $l4
      call $skip_ws
      local.get $l2
      i32.load offset=12
      local.tee $p0
      local.get $l4
      i32.ge_u
      br_if $B0
      local.get $p0
      i32.load8_u offset=65712
      i32.const -58
      i32.add
      i32.const 255
      i32.and
      i32.const 246
      i32.lt_u
      br_if $B0
      i32.const 0
      local.set $l5
      block $B2
        loop $L3
          local.get $p0
          i32.const 65712
          i32.add
          i32.load8_u
          local.tee $l3
          i32.const -58
          i32.add
          i32.const 255
          i32.and
          i32.const 246
          i32.lt_u
          br_if $B2
          block $B4
            local.get $l5
            i32.const 10
            i32.mul
            local.get $l3
            i32.add
            i32.const -48
            i32.add
            local.tee $l3
            local.get $l5
            i32.ge_u
            br_if $B4
            i32.const 0
            local.set $l3
            br $B0
          end
          local.get $l3
          local.set $l5
          local.get $l4
          local.get $p0
          i32.const 1
          i32.add
          local.tee $p0
          i32.ne
          br_if $L3
        end
        local.get $l4
        local.set $p0
        local.get $l3
        local.set $l5
      end
      local.get $l2
      local.get $p0
      i32.store offset=12
      i32.const 0
      local.set $l3
      local.get $l5
      i32.const 0
      i32.lt_s
      br_if $B0
      local.get $l2
      i32.const 12
      i32.add
      local.get $l4
      call $skip_ws
      block $B5
        local.get $l2
        i32.load offset=12
        local.tee $p0
        local.get $l4
        i32.ge_u
        br_if $B5
        local.get $p0
        i32.load8_u offset=65712
        i32.const 45
        i32.ne
        br_if $B5
        local.get $l2
        local.get $p0
        i32.const 1
        i32.add
        i32.store offset=12
      end
      local.get $l2
      i32.const 12
      i32.add
      local.get $l4
      call $skip_ws
      local.get $l2
      i32.load offset=12
      local.tee $p0
      local.get $l4
      i32.ge_u
      br_if $B0
      local.get $p0
      i32.load8_u offset=65712
      i32.const -58
      i32.add
      i32.const 255
      i32.and
      i32.const 246
      i32.lt_u
      br_if $B0
      i32.const 0
      local.set $l5
      block $B6
        loop $L7
          local.get $p0
          i32.const 65712
          i32.add
          i32.load8_u
          local.tee $l3
          i32.const -58
          i32.add
          i32.const 255
          i32.and
          i32.const 246
          i32.lt_u
          br_if $B6
          block $B8
            local.get $l5
            i32.const 10
            i32.mul
            local.get $l3
            i32.add
            i32.const -48
            i32.add
            local.tee $l3
            local.get $l5
            i32.ge_u
            br_if $B8
            i32.const 0
            local.set $l3
            br $B0
          end
          local.get $l3
          local.set $l5
          local.get $l4
          local.get $p0
          i32.const 1
          i32.add
          local.tee $p0
          i32.ne
          br_if $L7
        end
        local.get $l4
        local.set $p0
        local.get $l3
        local.set $l5
      end
      local.get $l2
      local.get $p0
      i32.store offset=12
      i32.const 0
      local.set $l3
      local.get $l5
      i32.const 0
      i32.lt_s
      br_if $B0
      local.get $l2
      i32.const 12
      i32.add
      local.get $l4
      call $skip_ws
      block $B9
        local.get $l2
        i32.load offset=12
        local.tee $p0
        local.get $l4
        i32.ge_u
        br_if $B9
        local.get $p0
        i32.load8_u offset=65712
        i32.const 45
        i32.ne
        br_if $B9
        local.get $l2
        local.get $p0
        i32.const 1
        i32.add
        i32.store offset=12
      end
      local.get $l2
      i32.const 12
      i32.add
      local.get $l4
      call $skip_ws
      local.get $l2
      i32.load offset=12
      local.tee $p0
      local.get $l4
      i32.ge_u
      br_if $B0
      local.get $p0
      i32.load8_u offset=65712
      i32.const -58
      i32.add
      i32.const 255
      i32.and
      i32.const 246
      i32.lt_u
      br_if $B0
      i32.const 0
      local.set $l5
      block $B10
        loop $L11
          local.get $p0
          i32.const 65712
          i32.add
          i32.load8_u
          local.tee $l3
          i32.const -58
          i32.add
          i32.const 255
          i32.and
          i32.const 246
          i32.lt_u
          br_if $B10
          block $B12
            local.get $l5
            i32.const 10
            i32.mul
            local.get $l3
            i32.add
            i32.const -48
            i32.add
            local.tee $l3
            local.get $l5
            i32.ge_u
            br_if $B12
            i32.const 0
            local.set $l3
            br $B0
          end
          local.get $l3
          local.set $l5
          local.get $l4
          local.get $p0
          i32.const 1
          i32.add
          local.tee $p0
          i32.ne
          br_if $L11
        end
        local.get $l4
        local.set $p0
        local.get $l3
        local.set $l5
      end
      local.get $l2
      local.get $p0
      i32.store offset=12
      i32.const 0
      local.set $l3
      local.get $l5
      i32.const 0
      i32.lt_s
      br_if $B0
      local.get $l2
      i32.const 12
      i32.add
      local.get $l4
      call $skip_ws
      block $B13
        local.get $l2
        i32.load offset=12
        local.tee $p0
        local.get $l4
        i32.ge_u
        br_if $B13
        local.get $p0
        i32.load8_u offset=65712
        i32.const 45
        i32.ne
        br_if $B13
        local.get $l2
        local.get $p0
        i32.const 1
        i32.add
        i32.store offset=12
      end
      local.get $l2
      i32.const 12
      i32.add
      local.get $l4
      call $skip_ws
      local.get $l2
      i32.load offset=12
      local.tee $p0
      local.get $l4
      i32.ge_u
      br_if $B0
      local.get $p0
      i32.load8_u offset=65712
      i32.const -58
      i32.add
      i32.const 255
      i32.and
      i32.const 246
      i32.lt_u
      br_if $B0
      i32.const 0
      local.set $l5
      block $B14
        loop $L15
          local.get $p0
          i32.const 65712
          i32.add
          i32.load8_u
          local.tee $l3
          i32.const -58
          i32.add
          i32.const 255
          i32.and
          i32.const 246
          i32.lt_u
          br_if $B14
          block $B16
            local.get $l5
            i32.const 10
            i32.mul
            local.get $l3
            i32.add
            i32.const -48
            i32.add
            local.tee $l3
            local.get $l5
            i32.ge_u
            br_if $B16
            i32.const 0
            local.set $l3
            br $B0
          end
          local.get $l3
          local.set $l5
          local.get $l4
          local.get $p0
          i32.const 1
          i32.add
          local.tee $p0
          i32.ne
          br_if $L15
        end
        local.get $l4
        local.set $p0
        local.get $l3
        local.set $l5
      end
      local.get $l2
      local.get $p0
      i32.store offset=12
      i32.const 0
      local.set $l3
      local.get $l5
      i32.const 0
      i32.lt_s
      br_if $B0
      local.get $l2
      i32.const 12
      i32.add
      local.get $l4
      call $skip_ws
      block $B17
        local.get $l2
        i32.load offset=12
        local.tee $p0
        local.get $l4
        i32.ge_u
        br_if $B17
        local.get $p0
        i32.load8_u offset=65712
        i32.const 45
        i32.ne
        br_if $B17
        local.get $l2
        local.get $p0
        i32.const 1
        i32.add
        i32.store offset=12
      end
      local.get $l2
      i32.const 12
      i32.add
      local.get $l4
      call $skip_ws
      local.get $l2
      i32.load offset=12
      local.tee $p0
      local.get $l4
      i32.ge_u
      br_if $B0
      local.get $p0
      i32.load8_u offset=65712
      i32.const -58
      i32.add
      i32.const 255
      i32.and
      i32.const 246
      i32.lt_u
      br_if $B0
      i32.const 0
      local.set $l5
      block $B18
        loop $L19
          local.get $p0
          i32.const 65712
          i32.add
          i32.load8_u
          local.tee $l3
          i32.const -58
          i32.add
          i32.const 255
          i32.and
          i32.const 246
          i32.lt_u
          br_if $B18
          block $B20
            local.get $l5
            i32.const 10
            i32.mul
            local.get $l3
            i32.add
            i32.const -48
            i32.add
            local.tee $l3
            local.get $l5
            i32.ge_u
            br_if $B20
            i32.const 0
            local.set $l3
            br $B0
          end
          local.get $l3
          local.set $l5
          local.get $l4
          local.get $p0
          i32.const 1
          i32.add
          local.tee $p0
          i32.ne
          br_if $L19
        end
        local.get $l4
        local.set $p0
        local.get $l3
        local.set $l5
      end
      local.get $l2
      local.get $p0
      i32.store offset=12
      i32.const 0
      local.set $l3
      local.get $l5
      i32.const 0
      i32.lt_s
      br_if $B0
      local.get $l2
      i32.const 12
      i32.add
      local.get $l4
      call $skip_ws
      block $B21
        local.get $l2
        i32.load offset=12
        local.tee $p0
        local.get $l4
        i32.ge_u
        br_if $B21
        local.get $p0
        i32.load8_u offset=65712
        i32.const 45
        i32.ne
        br_if $B21
        local.get $l2
        local.get $p0
        i32.const 1
        i32.add
        i32.store offset=12
      end
      local.get $l2
      i32.const 12
      i32.add
      local.get $l4
      call $skip_ws
      local.get $l2
      i32.load offset=12
      local.tee $p0
      local.get $l4
      i32.ge_u
      br_if $B0
      local.get $p0
      i32.load8_u offset=65712
      i32.const -58
      i32.add
      i32.const 255
      i32.and
      i32.const 246
      i32.lt_u
      br_if $B0
      i32.const 0
      local.set $l5
      block $B22
        loop $L23
          local.get $p0
          i32.const 65712
          i32.add
          i32.load8_u
          local.tee $l3
          i32.const -58
          i32.add
          i32.const 255
          i32.and
          i32.const 246
          i32.lt_u
          br_if $B22
          block $B24
            local.get $l5
            i32.const 10
            i32.mul
            local.get $l3
            i32.add
            i32.const -48
            i32.add
            local.tee $l3
            local.get $l5
            i32.ge_u
            br_if $B24
            i32.const 0
            local.set $l3
            br $B0
          end
          local.get $l3
          local.set $l5
          local.get $l4
          local.get $p0
          i32.const 1
          i32.add
          local.tee $p0
          i32.ne
          br_if $L23
        end
        local.get $l4
        local.set $p0
        local.get $l3
        local.set $l5
      end
      local.get $l2
      local.get $p0
      i32.store offset=12
      i32.const 0
      local.set $l3
      local.get $l5
      i32.const 0
      i32.lt_s
      br_if $B0
      local.get $l2
      i32.const 12
      i32.add
      local.get $l4
      call $skip_ws
      local.get $l2
      i32.load offset=12
      local.tee $p0
      i32.const 2
      i32.add
      local.tee $l5
      local.get $l4
      i32.gt_u
      br_if $B0
      local.get $p0
      i32.const 65712
      i32.add
      i32.load8_u
      i32.const 100
      i32.ne
      br_if $B0
      local.get $p0
      i32.const 65713
      i32.add
      i32.load8_u
      i32.const 49
      i32.ne
      br_if $B0
      block $B25
        local.get $l5
        local.get $l4
        i32.ge_u
        br_if $B25
        local.get $l5
        i32.load8_u offset=65712
        call $delimiter
        i32.eqz
        br_if $B0
      end
      local.get $l2
      local.get $l5
      i32.store offset=12
      local.get $l2
      i32.const 12
      i32.add
      local.get $l4
      call $skip_ws
      block $B26
        local.get $l2
        i32.load offset=12
        local.get $l4
        i32.ne
        br_if $B26
        i32.const 1
        local.set $l3
        br $B0
      end
      local.get $p1
      i32.const 7
      i32.mul
      i32.const 8888544
      i32.add
      local.set $l6
      loop $L27
        local.get $l2
        i32.const 12
        i32.add
        local.get $l4
        call $skip_ws
        i32.const 1
        local.set $p1
        block $B28
          local.get $l2
          i32.load offset=12
          local.tee $p0
          local.get $l4
          i32.ge_u
          br_if $B28
          i32.const 1
          local.set $p1
          local.get $p0
          i32.load8_u offset=65712
          i32.const 45
          i32.ne
          br_if $B28
          local.get $l2
          local.get $p0
          i32.const 1
          i32.add
          i32.store offset=12
          i32.const 0
          local.set $p1
        end
        local.get $l2
        i32.const 12
        i32.add
        local.get $l4
        call $skip_ws
        i32.const 0
        local.set $l3
        local.get $l2
        i32.load offset=12
        local.tee $l5
        local.get $l4
        i32.ge_u
        br_if $B0
        local.get $l5
        i32.load8_u offset=65712
        i32.const -58
        i32.add
        i32.const 255
        i32.and
        i32.const 246
        i32.lt_u
        br_if $B0
        i32.const 0
        local.set $p0
        block $B29
          loop $L30
            local.get $l5
            i32.const 65712
            i32.add
            i32.load8_u
            local.tee $l3
            i32.const -58
            i32.add
            i32.const 255
            i32.and
            i32.const 246
            i32.lt_u
            br_if $B29
            block $B31
              local.get $p0
              i32.const 10
              i32.mul
              local.get $l3
              i32.add
              i32.const -48
              i32.add
              local.tee $l3
              local.get $p0
              i32.ge_u
              br_if $B31
              i32.const 0
              local.set $l3
              br $B0
            end
            local.get $l3
            local.set $p0
            local.get $l4
            local.get $l5
            i32.const 1
            i32.add
            local.tee $l5
            i32.ne
            br_if $L30
          end
          local.get $l4
          local.set $l5
          local.get $l3
          local.set $p0
        end
        local.get $l2
        local.get $l5
        i32.store offset=12
        i32.const 0
        local.set $l3
        local.get $p0
        i32.const 0
        i32.lt_s
        br_if $B0
        local.get $l2
        i32.const 12
        i32.add
        local.get $l4
        call $skip_ws
        i32.const 1
        local.set $l7
        block $B32
          local.get $l2
          i32.load offset=12
          local.tee $l5
          local.get $l4
          i32.ge_u
          br_if $B32
          local.get $l5
          i32.load8_u offset=65712
          i32.const 45
          i32.ne
          br_if $B32
          local.get $l2
          local.get $l5
          i32.const 1
          i32.add
          i32.store offset=12
          i32.const 0
          local.set $l7
        end
        local.get $l2
        i32.const 12
        i32.add
        local.get $l4
        call $skip_ws
        local.get $l2
        i32.load offset=12
        local.tee $l5
        local.get $l4
        i32.ge_u
        br_if $B0
        local.get $l5
        i32.load8_u offset=65712
        i32.const -58
        i32.add
        i32.const 255
        i32.and
        i32.const 246
        i32.lt_u
        br_if $B0
        local.get $p0
        i32.const 0
        local.get $p0
        i32.sub
        local.get $p1
        select
        local.set $p1
        i32.const 0
        local.set $p0
        block $B33
          loop $L34
            local.get $l5
            i32.const 65712
            i32.add
            i32.load8_u
            local.tee $l3
            i32.const -58
            i32.add
            i32.const 255
            i32.and
            i32.const 246
            i32.lt_u
            br_if $B33
            block $B35
              local.get $p0
              i32.const 10
              i32.mul
              local.get $l3
              i32.add
              i32.const -48
              i32.add
              local.tee $l3
              local.get $p0
              i32.ge_u
              br_if $B35
              i32.const 0
              local.set $l3
              br $B0
            end
            local.get $l3
            local.set $p0
            local.get $l4
            local.get $l5
            i32.const 1
            i32.add
            local.tee $l5
            i32.ne
            br_if $L34
          end
          local.get $l4
          local.set $l5
          local.get $l3
          local.set $p0
        end
        local.get $l2
        local.get $l5
        i32.store offset=12
        i32.const 0
        local.set $l3
        local.get $p0
        i32.const 0
        i32.lt_s
        br_if $B0
        local.get $l2
        i32.const 12
        i32.add
        local.get $l4
        call $skip_ws
        i32.const 1
        local.set $l8
        block $B36
          local.get $l2
          i32.load offset=12
          local.tee $l5
          local.get $l4
          i32.ge_u
          br_if $B36
          local.get $l5
          i32.load8_u offset=65712
          i32.const 45
          i32.ne
          br_if $B36
          local.get $l2
          local.get $l5
          i32.const 1
          i32.add
          i32.store offset=12
          i32.const 0
          local.set $l8
        end
        local.get $l2
        i32.const 12
        i32.add
        local.get $l4
        call $skip_ws
        local.get $l2
        i32.load offset=12
        local.tee $l5
        local.get $l4
        i32.ge_u
        br_if $B0
        local.get $l5
        i32.load8_u offset=65712
        i32.const -58
        i32.add
        i32.const 255
        i32.and
        i32.const 246
        i32.lt_u
        br_if $B0
        local.get $p0
        i32.const 0
        local.get $p0
        i32.sub
        local.get $l7
        select
        local.set $l7
        i32.const 0
        local.set $p0
        block $B37
          loop $L38
            local.get $l5
            i32.const 65712
            i32.add
            i32.load8_u
            local.tee $l3
            i32.const -58
            i32.add
            i32.const 255
            i32.and
            i32.const 246
            i32.lt_u
            br_if $B37
            block $B39
              local.get $p0
              i32.const 10
              i32.mul
              local.get $l3
              i32.add
              i32.const -48
              i32.add
              local.tee $l3
              local.get $p0
              i32.ge_u
              br_if $B39
              i32.const 0
              local.set $l3
              br $B0
            end
            local.get $l3
            local.set $p0
            local.get $l4
            local.get $l5
            i32.const 1
            i32.add
            local.tee $l5
            i32.ne
            br_if $L38
          end
          local.get $l4
          local.set $l5
          local.get $l3
          local.set $p0
        end
        local.get $l2
        local.get $l5
        i32.store offset=12
        i32.const 0
        local.set $l3
        local.get $p0
        i32.const 0
        i32.lt_s
        br_if $B0
        local.get $l2
        i32.const 12
        i32.add
        local.get $l4
        call $skip_ws
        i32.const 1
        local.set $l9
        block $B40
          local.get $l2
          i32.load offset=12
          local.tee $l5
          local.get $l4
          i32.ge_u
          br_if $B40
          local.get $l5
          i32.load8_u offset=65712
          i32.const 45
          i32.ne
          br_if $B40
          local.get $l2
          local.get $l5
          i32.const 1
          i32.add
          i32.store offset=12
          i32.const 0
          local.set $l9
        end
        local.get $l2
        i32.const 12
        i32.add
        local.get $l4
        call $skip_ws
        local.get $l2
        i32.load offset=12
        local.tee $l5
        local.get $l4
        i32.ge_u
        br_if $B0
        local.get $l5
        i32.load8_u offset=65712
        i32.const -58
        i32.add
        i32.const 255
        i32.and
        i32.const 246
        i32.lt_u
        br_if $B0
        local.get $p0
        i32.const 0
        local.get $p0
        i32.sub
        local.get $l8
        select
        local.set $l10
        i32.const 0
        local.set $p0
        block $B41
          loop $L42
            local.get $l5
            i32.const 65712
            i32.add
            i32.load8_u
            local.tee $l3
            i32.const -58
            i32.add
            i32.const 255
            i32.and
            i32.const 246
            i32.lt_u
            br_if $B41
            block $B43
              local.get $p0
              i32.const 10
              i32.mul
              local.get $l3
              i32.add
              i32.const -48
              i32.add
              local.tee $l3
              local.get $p0
              i32.ge_u
              br_if $B43
              i32.const 0
              local.set $l3
              br $B0
            end
            local.get $l3
            local.set $p0
            local.get $l4
            local.get $l5
            i32.const 1
            i32.add
            local.tee $l5
            i32.ne
            br_if $L42
          end
          local.get $l4
          local.set $l5
          local.get $l3
          local.set $p0
        end
        local.get $l2
        local.get $l5
        i32.store offset=12
        i32.const 0
        local.set $l3
        local.get $p0
        i32.const 0
        i32.lt_s
        br_if $B0
        i32.const 0
        local.set $l3
        local.get $l2
        i32.const 12
        i32.add
        local.get $l4
        call $skip_ws
        local.get $l2
        i32.load offset=12
        local.tee $l8
        i32.const 2
        i32.add
        local.tee $l5
        local.get $l4
        i32.gt_u
        br_if $B0
        local.get $l8
        i32.const 65712
        i32.add
        i32.load8_u
        i32.const 114
        i32.ne
        br_if $B0
        local.get $l8
        i32.const 65713
        i32.add
        i32.load8_u
        i32.const 101
        i32.ne
        br_if $B0
        block $B44
          local.get $l5
          local.get $l4
          i32.ge_u
          br_if $B44
          local.get $l5
          i32.load8_u offset=65712
          call $delimiter
          i32.eqz
          br_if $B0
        end
        local.get $l2
        local.get $l5
        i32.store offset=12
        local.get $l2
        i32.const 12
        i32.add
        local.get $l4
        call $skip_ws
        local.get $l2
        i32.load offset=12
        local.tee $l8
        i32.const 1
        i32.add
        local.tee $l5
        local.get $l4
        i32.gt_u
        br_if $B0
        local.get $l8
        i32.const 65712
        i32.add
        i32.load8_u
        i32.const 102
        i32.ne
        br_if $B0
        block $B45
          local.get $l5
          local.get $l4
          i32.ge_u
          br_if $B45
          local.get $l5
          i32.load8_u offset=65712
          call $delimiter
          i32.eqz
          br_if $B0
        end
        local.get $l2
        local.get $l5
        i32.store offset=12
        local.get $p1
        i32.const 4
        i32.gt_u
        br_if $B0
        local.get $l7
        i32.const 6
        i32.gt_u
        br_if $B0
        local.get $l10
        i32.const 1
        i32.ne
        br_if $B0
        local.get $p0
        i32.const 0
        local.get $p0
        i32.sub
        local.get $l9
        select
        i32.const 1
        i32.ne
        br_if $B0
        i32.const 1
        local.set $l3
        local.get $l6
        local.get $l7
        i32.sub
        i32.const 6
        i32.add
        local.tee $p0
        local.get $p0
        i32.load8_u
        i32.const 1
        i32.const 4
        local.get $p1
        i32.sub
        i32.shl
        i32.or
        i32.store8
        local.get $l2
        i32.const 12
        i32.add
        local.get $l4
        call $skip_ws
        local.get $l2
        i32.load offset=12
        local.get $l4
        i32.ne
        br_if $L27
      end
    end
    local.get $l2
    i32.const 16
    i32.add
    global.set $__stack_pointer
    local.get $l3)
  (func $render_page (type $t2) (param $p0 i32) (result i32)
    (local $l1 i32) (local $l2 i32) (local $l3 i32) (local $l4 i32) (local $l5 i32) (local $l6 i32) (local $l7 i32) (local $l8 i32) (local $l9 i32) (local $l10 i32) (local $l11 i32) (local $l12 i32) (local $l13 i32) (local $l14 i32) (local $l15 i32)
    block $B0
      block $B1
        block $B2
          local.get $p0
          i32.const 49
          i32.gt_s
          br_if $B2
          local.get $p0
          i32.const 1
          i32.eq
          br_if $B1
          local.get $p0
          i32.const 25
          i32.eq
          br_if $B1
          br $B0
        end
        local.get $p0
        i32.const 50
        i32.eq
        br_if $B1
        local.get $p0
        i32.const 100
        i32.eq
        br_if $B1
        local.get $p0
        i32.const 75
        i32.ne
        br_if $B0
      end
      local.get $p0
      i32.const 0
      i32.load offset=8869556
      i32.gt_u
      br_if $B0
      i32.const 1114288
      i32.const 255
      i32.const 7755264
      memory.fill
      block $B3
        local.get $p0
        i32.const -1
        i32.add
        local.tee $p0
        i32.const 2
        i32.shl
        local.tee $l1
        i32.load offset=8890352
        i32.const 16
        i32.eq
        br_if $B3
        i32.const 0
        i32.const 25
        i32.store offset=8869588
        i32.const 25
        return
      end
      block $B4
        block $B5
          block $B6
            local.get $l1
            i32.load offset=8882400
            local.tee $l2
            i32.eqz
            br_if $B6
            local.get $p0
            i32.const 2
            i32.shl
            local.tee $l1
            i32.const 8903664
            i32.add
            local.set $l3
            local.get $p0
            i32.const 96
            i32.mul
            i32.const 8891376
            i32.add
            local.set $l4
            local.get $l1
            i32.load offset=8890864
            i32.const 1
            i32.shl
            local.set $l5
            i32.const 0
            local.set $l6
            loop $L7
              local.get $l4
              local.get $l6
              i32.add
              i32.load8_u
              local.tee $p0
              i32.load8_u offset=8887008
              i32.eqz
              br_if $B5
              local.get $p0
              i32.const 2
              i32.shl
              i32.load offset=8887520
              local.tee $l7
              i32.eqz
              br_if $B5
              local.get $l5
              i32.const -1220
              i32.add
              local.set $l8
              local.get $l5
              i32.const 2
              i32.shl
              i32.const 1114288
              i32.add
              local.set $l9
              local.get $p0
              i32.const 7
              i32.mul
              i32.const 8888544
              i32.add
              local.set $l10
              i32.const 0
              local.set $l11
              loop $L8
                local.get $l11
                i32.const 2
                i32.shl
                local.set $l12
                local.get $l10
                local.get $l11
                i32.add
                i32.load8_u
                local.set $l13
                i32.const 4
                local.set $l1
                local.get $l8
                local.set $l14
                i32.const 0
                local.set $l15
                loop $L9
                  block $B10
                    local.get $l13
                    local.get $l1
                    i32.shr_u
                    i32.const 1
                    i32.and
                    i32.eqz
                    br_if $B10
                    local.get $l14
                    i32.const -1224
                    i32.lt_u
                    br_if $B4
                    local.get $l12
                    local.get $l3
                    i32.load
                    local.tee $p0
                    i32.const 1
                    i32.shl
                    i32.sub
                    i32.const -24
                    i32.add
                    i32.const -1584
                    i32.lt_u
                    br_if $B4
                    local.get $l9
                    local.get $l15
                    local.get $p0
                    i32.const -9792
                    i32.mul
                    i32.add
                    i32.add
                    local.tee $p0
                    i32.const 7618178
                    i32.add
                    i32.const 0
                    i32.store8
                    local.get $p0
                    i32.const 7618182
                    i32.add
                    i32.const 0
                    i32.store8
                    local.get $p0
                    i32.const 7618176
                    i32.add
                    i32.const 0
                    i32.store16
                    local.get $p0
                    i32.const 7618186
                    i32.add
                    i32.const 0
                    i32.store8
                    local.get $p0
                    i32.const 7618180
                    i32.add
                    i32.const 0
                    i32.store16
                    local.get $p0
                    i32.const 7618190
                    i32.add
                    i32.const 0
                    i32.store8
                    local.get $p0
                    i32.const 7618184
                    i32.add
                    i32.const 0
                    i32.store16
                    local.get $p0
                    i32.const 7618194
                    i32.add
                    i32.const 0
                    i32.store8
                    local.get $p0
                    i32.const 7618188
                    i32.add
                    i32.const 0
                    i32.store16
                    local.get $p0
                    i32.const 7623074
                    i32.add
                    i32.const 0
                    i32.store8
                    local.get $p0
                    i32.const 7618192
                    i32.add
                    i32.const 0
                    i32.store16
                    local.get $p0
                    i32.const 7623072
                    i32.add
                    i32.const 0
                    i32.store16
                    local.get $p0
                    i32.const 7623077
                    i32.add
                    i32.const 0
                    i32.store16 align=1
                    local.get $p0
                    i32.const 7623076
                    i32.add
                    i32.const 0
                    i32.store8
                    local.get $p0
                    i32.const 7623081
                    i32.add
                    i32.const 0
                    i32.store16 align=1
                    local.get $p0
                    i32.const 7623086
                    i32.add
                    i32.const 0
                    i32.store8
                    local.get $p0
                    i32.const 7623080
                    i32.add
                    i32.const 0
                    i32.store8
                    local.get $p0
                    i32.const 7623084
                    i32.add
                    i32.const 0
                    i32.store16
                    local.get $p0
                    i32.const 7623090
                    i32.add
                    i32.const 0
                    i32.store8
                    local.get $p0
                    i32.const 7623088
                    i32.add
                    i32.const 0
                    i32.store16
                    local.get $p0
                    i32.const 7627970
                    i32.add
                    i32.const 0
                    i32.store8
                    local.get $p0
                    i32.const 7627968
                    i32.add
                    i32.const 0
                    i32.store16
                    local.get $p0
                    i32.const 7627974
                    i32.add
                    i32.const 0
                    i32.store8
                    local.get $p0
                    i32.const 7627972
                    i32.add
                    i32.const 0
                    i32.store16
                    local.get $p0
                    i32.const 7627978
                    i32.add
                    i32.const 0
                    i32.store8
                    local.get $p0
                    i32.const 7627976
                    i32.add
                    i32.const 0
                    i32.store16
                    local.get $p0
                    i32.const 7627981
                    i32.add
                    i32.const 0
                    i32.store16 align=1
                    local.get $p0
                    i32.const 7627980
                    i32.add
                    i32.const 0
                    i32.store8
                    local.get $p0
                    i32.const 7627985
                    i32.add
                    i32.const 0
                    i32.store16 align=1
                    local.get $p0
                    i32.const 7627984
                    i32.add
                    i32.const 0
                    i32.store8
                    local.get $p0
                    i32.const 7632865
                    i32.add
                    i32.const 0
                    i32.store16 align=1
                    local.get $p0
                    i32.const 7632864
                    i32.add
                    i32.const 0
                    i32.store8
                    local.get $p0
                    i32.const 7632869
                    i32.add
                    i32.const 0
                    i32.store16 align=1
                    local.get $p0
                    i32.const 7632874
                    i32.add
                    i32.const 0
                    i32.store8
                    local.get $p0
                    i32.const 7632868
                    i32.add
                    i32.const 0
                    i32.store8
                    local.get $p0
                    i32.const 7632878
                    i32.add
                    i32.const 0
                    i32.store8
                    local.get $p0
                    i32.const 7632872
                    i32.add
                    i32.const 0
                    i32.store16
                    local.get $p0
                    i32.const 7632882
                    i32.add
                    i32.const 0
                    i32.store8
                    local.get $p0
                    i32.const 7632876
                    i32.add
                    i32.const 0
                    i32.store16
                    local.get $p0
                    i32.const 7637762
                    i32.add
                    i32.const 0
                    i32.store8
                    local.get $p0
                    i32.const 7632880
                    i32.add
                    i32.const 0
                    i32.store16
                    local.get $p0
                    i32.const 7637766
                    i32.add
                    i32.const 0
                    i32.store8
                    local.get $p0
                    i32.const 7637760
                    i32.add
                    i32.const 0
                    i32.store16
                    local.get $p0
                    i32.const 7637764
                    i32.add
                    i32.const 0
                    i32.store16
                    local.get $p0
                    i32.const 7637769
                    i32.add
                    i32.const 0
                    i32.store16 align=1
                    local.get $p0
                    i32.const 7637768
                    i32.add
                    i32.const 0
                    i32.store8
                    local.get $p0
                    i32.const 7637773
                    i32.add
                    i32.const 0
                    i32.store16 align=1
                    local.get $p0
                    i32.const 7637772
                    i32.add
                    i32.const 0
                    i32.store8
                    local.get $p0
                    i32.const 7637777
                    i32.add
                    i32.const 0
                    i32.store16 align=1
                    local.get $p0
                    i32.const 7637776
                    i32.add
                    i32.const 0
                    i32.store8
                  end
                  local.get $l14
                  i32.const 4
                  i32.add
                  local.set $l14
                  local.get $l1
                  i32.const -1
                  i32.add
                  local.set $l1
                  local.get $l15
                  i32.const 16
                  i32.add
                  local.tee $l15
                  i32.const 80
                  i32.ne
                  br_if $L9
                end
                local.get $l9
                i32.const 19584
                i32.add
                local.set $l9
                local.get $l11
                i32.const 1
                i32.add
                local.tee $l11
                i32.const 7
                i32.ne
                br_if $L8
              end
              local.get $l7
              i32.const 2
              i32.shl
              local.get $l5
              i32.add
              local.set $l5
              local.get $l6
              i32.const 1
              i32.add
              local.tee $l6
              local.get $l2
              i32.ne
              br_if $L7
            end
          end
          i32.const 0
          i32.const 0
          i32.load offset=8869568
          i32.const 1
          i32.add
          i32.store offset=8869568
          i32.const 0
          return
        end
        i32.const 0
        i32.const 26
        i32.store offset=8869588
        i32.const 26
        return
      end
      i32.const 0
      i32.const 27
      i32.store offset=8869588
      i32.const 27
      return
    end
    i32.const 0
    i32.const 24
    i32.store offset=8869588
    i32.const 24)
  (table $__indirect_function_table 1 1 funcref)
  (memory $memory 256)
  (global $__stack_pointer (mut i32) (i32.const 65536))
  (global $__dso_handle i32 (i32.const 65536))
  (global $__data_end i32 (i32.const 8904176))
  (global $__stack_low i32 (i32.const 0))
  (global $__stack_high i32 (i32.const 65536))
  (global $__global_base i32 (i32.const 65536))
  (global $__heap_base i32 (i32.const 8904176))
  (global $__heap_end i32 (i32.const 16777216))
  (global $__memory_base i32 (i32.const 0))
  (global $__table_base i32 (i32.const 1))
  (global $__wasm_first_page_end i32 (i32.const 65536))
  (export "memory" (memory $memory))
  (export "__wasm_call_ctors" (func $__wasm_call_ctors))
  (export "__stack_pointer" (global $__stack_pointer))
  (export "input_ptr" (func $input_ptr))
  (export "rgba_ptr" (func $rgba_ptr))
  (export "counters_ptr" (func $counters_ptr))
  (export "error_code" (func $error_code))
  (export "page_count" (func $page_count))
  (export "hit_count" (func $hit_count))
  (export "hit_page" (func $hit_page))
  (export "text_ptr" (func $text_ptr))
  (export "text_len" (func $text_len))
  (export "parse" (func $parse))
  (export "render_page" (func $render_page))
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
  (data $.rodata (i32.const 65536) "/Root\00/Count\00/Font\00/Parent\00/Contents\00/Widths\00/Pages\00/Resources\00/Differences\00/Kids\00/FirstChar\00/LastChar\00obj\00Tj\00/Catalog\00/Size\00/Subtype\00/Type\00/Page\00/ToUnicode\00Td\00ET\00R\00/Type3\00/F1\00"))
