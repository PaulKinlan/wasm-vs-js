;; text.gc-document-edit.v1 — kernel: gc_document_edit_trace
;; WebAssembly Text (WAT) baseline implementation
;; Exports: gc_document_edit_trace

(module $gc_document_kernel_c.wasm
  (type $t0 (func))
  (type $t1 (func (param i32) (result i32)))
  (type $t2 (func (param i32)))
  (func $__wasm_call_ctors (type $t0))
  (func $gc_document_edit_trace (type $t1) (param $p0 i32) (result i32)
    (local $l1 i32) (local $l2 i32) (local $l3 i32) (local $l4 i32) (local $l5 i32) (local $l6 i32) (local $l7 i32) (local $l8 i32) (local $l9 i32) (local $l10 i32) (local $l11 i32) (local $l12 i32) (local $l13 i32) (local $l14 i32) (local $l15 i32) (local $l16 i32) (local $l17 i32) (local $l18 i32) (local $l19 i32)
    i32.const -16384
    local.set $l1
    i32.const 163840
    local.set $l2
    loop $L0
      local.get $l2
      i32.const 0
      i32.store16
      local.get $l1
      i32.const 98304
      i32.add
      i32.const -1
      i32.store
      local.get $l1
      i32.const 81920
      i32.add
      i32.const -2
      i32.store
      local.get $l1
      i32.const 114688
      i32.add
      i32.const -1
      i32.store
      local.get $l1
      i32.const 131072
      i32.add
      i32.const -1
      i32.store
      local.get $l1
      i32.const 147456
      i32.add
      i32.const 0
      i32.store
      local.get $l1
      i32.const 163840
      i32.add
      i32.const 0
      i32.store
      local.get $l2
      i32.const 2
      i32.add
      local.set $l2
      local.get $l1
      i32.const 4
      i32.add
      local.tee $l1
      br_if $L0
    end
    block $B1
      block $B2
        block $B3
          block $B4
            local.get $p0
            br_if $B4
            i32.const 0
            local.set $l1
            br $B3
          end
          i32.const 0
          local.set $l1
          block $B5
            loop $L6
              local.get $l1
              i32.const 196608
              i32.add
              i32.load8_u
              i32.const 10
              i32.eq
              br_if $B5
              local.get $p0
              local.get $l1
              i32.const 1
              i32.add
              local.tee $l1
              i32.ne
              br_if $L6
              br $B2
            end
          end
          local.get $l1
          i32.const 1
          i32.add
          local.set $l1
        end
        block $B7
          local.get $l1
          local.get $p0
          i32.ge_u
          br_if $B7
          block $B8
            loop $L9
              local.get $l1
              i32.const 196608
              i32.add
              i32.load8_u
              i32.const 9
              i32.eq
              br_if $B8
              local.get $p0
              local.get $l1
              i32.const 1
              i32.add
              local.tee $l1
              i32.eq
              br_if $B2
              br $L9
            end
          end
          local.get $l1
          i32.const 1
          i32.add
          local.set $l1
        end
        i32.const 1
        local.set $l3
        block $B10
          local.get $l1
          local.get $p0
          i32.ge_u
          br_if $B10
          local.get $l1
          i32.load8_u offset=196608
          local.tee $l2
          i32.const 45
          i32.ne
          local.set $l3
          local.get $l1
          local.get $l2
          i32.const 45
          i32.eq
          i32.add
          local.set $l1
        end
        i32.const 0
        local.set $l4
        block $B11
          block $B12
            block $B13
              local.get $l1
              local.get $p0
              i32.ge_u
              br_if $B13
              i32.const 0
              local.set $l4
              loop $L14
                local.get $l1
                i32.const 196608
                i32.add
                i32.load8_u
                local.tee $l2
                i32.const -58
                i32.add
                i32.const 255
                i32.and
                i32.const 246
                i32.lt_u
                br_if $B13
                local.get $l4
                i32.const 10
                i32.mul
                local.get $l2
                i32.add
                i32.const -48
                i32.add
                local.set $l4
                local.get $p0
                local.get $l1
                i32.const 1
                i32.add
                local.tee $l1
                i32.ne
                br_if $L14
                br $B12
              end
            end
            local.get $l1
            local.get $p0
            i32.ge_u
            br_if $B11
            block $B15
              loop $L16
                local.get $l1
                i32.const 196608
                i32.add
                i32.load8_u
                i32.const 10
                i32.eq
                br_if $B15
                local.get $p0
                local.get $l1
                i32.const 1
                i32.add
                local.tee $l1
                i32.eq
                br_if $B12
                br $L16
              end
            end
            local.get $l1
            i32.const 1
            i32.add
            local.set $l1
            local.get $l3
            br_if $B1
            i32.const 0
            local.get $l4
            i32.sub
            local.set $l4
            br $B1
          end
          local.get $p0
          local.set $l1
        end
        local.get $l3
        br_if $B1
        i32.const 0
        local.get $l4
        i32.sub
        local.set $l4
        br $B1
      end
      i32.const 0
      local.set $l4
      local.get $p0
      local.set $l1
    end
    block $B17
      block $B18
        local.get $l1
        local.get $p0
        i32.ge_u
        br_if $B18
        block $B19
          loop $L20
            local.get $l1
            i32.const 196608
            i32.add
            i32.load8_u
            i32.const 9
            i32.eq
            br_if $B19
            local.get $p0
            local.get $l1
            i32.const 1
            i32.add
            local.tee $l1
            i32.ne
            br_if $L20
          end
          local.get $p0
          local.set $l3
          br $B17
        end
        local.get $l1
        i32.const 1
        i32.add
        local.set $l1
      end
      block $B21
        local.get $l1
        local.get $p0
        i32.ge_u
        br_if $B21
        local.get $l1
        local.get $l1
        i32.load8_u offset=196608
        i32.const 45
        i32.eq
        i32.add
        local.set $l1
      end
      block $B22
        block $B23
          local.get $l1
          local.get $p0
          i32.ge_u
          br_if $B23
          local.get $l1
          i32.load8_u offset=196608
          i32.const -58
          i32.add
          i32.const 255
          i32.and
          i32.const 246
          i32.lt_u
          br_if $B23
          local.get $p0
          i32.const -1
          i32.add
          local.set $l5
          block $B24
            loop $L25
              local.get $l5
              local.get $l1
              i32.eq
              br_if $B24
              local.get $l1
              i32.const 196609
              i32.add
              local.set $l2
              local.get $l1
              i32.const 1
              i32.add
              local.tee $l3
              local.set $l1
              local.get $l2
              i32.load8_u
              i32.const -58
              i32.add
              i32.const 255
              i32.and
              i32.const 246
              i32.lt_u
              br_if $B22
              br $L25
            end
          end
          local.get $p0
          local.set $l3
          br $B17
        end
        local.get $l1
        local.set $l3
      end
      local.get $l3
      local.get $p0
      i32.ge_u
      br_if $B17
      block $B26
        loop $L27
          local.get $l3
          i32.const 196608
          i32.add
          i32.load8_u
          i32.const 10
          i32.eq
          br_if $B26
          local.get $p0
          local.get $l3
          i32.const 1
          i32.add
          local.tee $l3
          i32.ne
          br_if $L27
        end
        local.get $p0
        local.set $l3
        br $B17
      end
      local.get $l3
      i32.const 1
      i32.add
      local.set $l3
    end
    i32.const 0
    local.set $l6
    block $B28
      block $B29
        local.get $l4
        i32.const 1
        i32.ge_s
        br_if $B29
        i32.const 0
        local.set $l4
        i32.const 0
        local.set $l7
        i32.const 0
        local.set $l8
        br $B28
      end
      i32.const 0
      local.set $l8
      i32.const 0
      local.set $l7
      i32.const 0
      local.set $l9
      loop $L30
        i32.const 1
        local.set $l10
        block $B31
          local.get $l3
          i32.const 2
          i32.add
          local.tee $l1
          local.get $p0
          i32.ge_u
          br_if $B31
          local.get $l1
          local.get $l3
          i32.const 3
          i32.add
          local.get $l3
          i32.const 196610
          i32.add
          i32.load8_u
          i32.const 45
          i32.ne
          local.tee $l10
          select
          local.set $l1
        end
        i32.const 0
        local.set $l3
        block $B32
          local.get $l1
          local.get $p0
          i32.ge_u
          br_if $B32
          i32.const 0
          local.set $l3
          loop $L33
            local.get $l1
            i32.const 196608
            i32.add
            i32.load8_u
            local.tee $l2
            i32.const -58
            i32.add
            i32.const 255
            i32.and
            i32.const 246
            i32.lt_u
            br_if $B32
            local.get $l3
            i32.const 10
            i32.mul
            local.get $l2
            i32.add
            i32.const -48
            i32.add
            local.set $l3
            local.get $p0
            local.get $l1
            i32.const 1
            i32.add
            local.tee $l1
            i32.ne
            br_if $L33
          end
          local.get $p0
          local.set $l1
        end
        i32.const 1
        local.set $l11
        block $B34
          local.get $l1
          i32.const 1
          i32.add
          local.tee $l2
          local.get $p0
          i32.ge_u
          br_if $B34
          local.get $l2
          local.get $l1
          i32.const 2
          i32.add
          local.get $l1
          i32.const 196609
          i32.add
          i32.load8_u
          i32.const 45
          i32.ne
          local.tee $l11
          select
          local.set $l2
        end
        i32.const 0
        local.set $l5
        block $B35
          local.get $l2
          local.get $p0
          i32.ge_u
          br_if $B35
          i32.const 0
          local.set $l5
          loop $L36
            local.get $l2
            i32.const 196608
            i32.add
            i32.load8_u
            local.tee $l1
            i32.const -58
            i32.add
            i32.const 255
            i32.and
            i32.const 246
            i32.lt_u
            br_if $B35
            local.get $l5
            i32.const 10
            i32.mul
            local.get $l1
            i32.add
            i32.const -48
            i32.add
            local.set $l5
            local.get $p0
            local.get $l2
            i32.const 1
            i32.add
            local.tee $l2
            i32.ne
            br_if $L36
          end
          local.get $p0
          local.set $l2
        end
        i32.const 1
        local.set $l12
        block $B37
          local.get $l2
          i32.const 1
          i32.add
          local.tee $l1
          local.get $p0
          i32.ge_u
          br_if $B37
          local.get $l1
          local.get $l2
          i32.const 2
          i32.add
          local.get $l2
          i32.const 196609
          i32.add
          i32.load8_u
          i32.const 45
          i32.ne
          local.tee $l12
          select
          local.set $l1
        end
        i32.const 0
        local.get $l3
        i32.sub
        local.set $l13
        i32.const 0
        local.get $l5
        i32.sub
        local.set $l14
        i32.const 0
        local.set $l15
        block $B38
          local.get $l1
          local.get $p0
          i32.ge_u
          br_if $B38
          i32.const 0
          local.set $l15
          loop $L39
            local.get $l1
            i32.const 196608
            i32.add
            i32.load8_u
            local.tee $l2
            i32.const -58
            i32.add
            i32.const 255
            i32.and
            i32.const 246
            i32.lt_u
            br_if $B38
            local.get $l15
            i32.const 10
            i32.mul
            local.get $l2
            i32.add
            i32.const -48
            i32.add
            local.set $l15
            local.get $p0
            local.get $l1
            i32.const 1
            i32.add
            local.tee $l1
            i32.ne
            br_if $L39
          end
          local.get $p0
          local.set $l1
        end
        local.get $l3
        local.get $l13
        local.get $l10
        select
        local.set $l13
        local.get $l5
        local.get $l14
        local.get $l11
        select
        local.set $l11
        local.get $l1
        i32.const 1
        i32.add
        local.tee $l5
        local.set $l1
        block $B40
          block $B41
            local.get $l5
            local.get $p0
            i32.ge_u
            br_if $B41
            local.get $l5
            local.set $l1
            loop $L42
              local.get $l1
              i32.const 196608
              i32.add
              i32.load8_u
              i32.const -9
              i32.add
              i32.const 255
              i32.and
              i32.const 2
              i32.lt_u
              br_if $B41
              local.get $p0
              local.get $l1
              i32.const 1
              i32.add
              local.tee $l1
              i32.ne
              br_if $L42
            end
            local.get $p0
            local.set $l1
            local.get $p0
            local.set $l3
            br $B40
          end
          block $B43
            local.get $l1
            local.get $p0
            i32.lt_u
            br_if $B43
            local.get $l1
            local.set $l3
            br $B40
          end
          local.get $l1
          local.set $l2
          block $B44
            loop $L45
              local.get $l2
              i32.const 196608
              i32.add
              i32.load8_u
              i32.const 10
              i32.eq
              br_if $B44
              local.get $p0
              local.get $l2
              i32.const 1
              i32.add
              local.tee $l2
              i32.ne
              br_if $L45
            end
            local.get $p0
            local.set $l3
            br $B40
          end
          local.get $l2
          i32.const 1
          i32.add
          local.set $l3
        end
        local.get $l13
        i32.const 1
        i32.shl
        i32.const 163840
        i32.add
        local.get $l1
        local.get $l5
        i32.sub
        i32.store16
        local.get $l13
        i32.const 2
        i32.shl
        local.tee $l10
        i32.const 147456
        i32.add
        local.get $l5
        i32.store
        local.get $l10
        i32.const 131072
        i32.add
        local.set $l1
        local.get $l10
        i32.const 81920
        i32.add
        local.set $l2
        local.get $l10
        i32.const 65536
        i32.add
        local.set $l5
        block $B46
          block $B47
            local.get $l11
            i32.const -1
            i32.ne
            br_if $B47
            local.get $l2
            i32.const -1
            i32.store
            local.get $l5
            i32.const -1
            i32.store
            local.get $l1
            i32.const 0
            i32.store
            br $B46
          end
          local.get $l2
          i32.const -1
          i32.store
          local.get $l5
          local.get $l11
          i32.store
          local.get $l1
          i32.const 0
          i32.store
          block $B48
            block $B49
              local.get $l15
              i32.const 0
              local.get $l15
              i32.sub
              local.get $l12
              select
              local.tee $l2
              br_if $B49
              local.get $l10
              i32.const 98304
              i32.add
              i32.const -1
              i32.store
              local.get $l10
              i32.const 114688
              i32.add
              local.get $l11
              i32.const 2
              i32.shl
              i32.const 81920
              i32.add
              local.tee $l2
              i32.load
              local.tee $l1
              i32.store
              block $B50
                local.get $l1
                i32.const -1
                i32.eq
                br_if $B50
                local.get $l1
                i32.const 2
                i32.shl
                i32.const 98304
                i32.add
                local.get $l13
                i32.store
              end
              local.get $l2
              local.get $l13
              i32.store
              br $B48
            end
            local.get $l11
            i32.const 2
            i32.shl
            i32.const 81920
            i32.add
            local.tee $l12
            i32.load
            local.tee $l15
            local.set $l1
            block $B51
              local.get $l2
              i32.const 2
              i32.lt_s
              br_if $B51
              local.get $l15
              local.set $l1
              local.get $l15
              i32.const -1
              i32.eq
              br_if $B51
              local.get $l2
              i32.const -1
              i32.add
              local.set $l5
              i32.const 1
              local.set $l2
              local.get $l15
              local.set $l1
              loop $L52
                local.get $l1
                i32.const 2
                i32.shl
                i32.const 114688
                i32.add
                i32.load
                local.set $l1
                local.get $l2
                local.get $l5
                i32.ge_s
                br_if $B51
                local.get $l2
                i32.const 1
                i32.add
                local.set $l2
                local.get $l1
                i32.const -1
                i32.ne
                br_if $L52
              end
            end
            local.get $l10
            i32.const 98304
            i32.add
            local.set $l2
            local.get $l10
            i32.const 114688
            i32.add
            local.set $l5
            block $B53
              local.get $l1
              i32.const -1
              i32.ne
              br_if $B53
              local.get $l2
              i32.const -1
              i32.store
              local.get $l5
              local.get $l15
              i32.store
              block $B54
                local.get $l15
                i32.const -1
                i32.eq
                br_if $B54
                local.get $l15
                i32.const 2
                i32.shl
                i32.const 98304
                i32.add
                local.get $l13
                i32.store
              end
              local.get $l12
              local.get $l13
              i32.store
              br $B48
            end
            local.get $l2
            local.get $l1
            i32.store
            local.get $l5
            local.get $l1
            i32.const 2
            i32.shl
            i32.const 114688
            i32.add
            local.tee $l2
            i32.load
            local.tee $l1
            i32.store
            block $B55
              local.get $l1
              i32.const -1
              i32.eq
              br_if $B55
              local.get $l1
              i32.const 2
              i32.shl
              i32.const 98304
              i32.add
              local.get $l13
              i32.store
            end
            local.get $l2
            local.get $l13
            i32.store
          end
          local.get $l11
          i32.const 2
          i32.shl
          i32.const 131072
          i32.add
          local.tee $l1
          local.get $l1
          i32.load
          i32.const 1
          i32.add
          i32.store
          local.get $l7
          i32.const 1
          i32.add
          local.set $l7
          local.get $l8
          i32.const 1
          i32.add
          local.set $l8
        end
        local.get $l9
        i32.const 1
        i32.add
        local.tee $l9
        local.get $l4
        i32.ne
        br_if $L30
      end
    end
    block $B56
      block $B57
        local.get $l3
        local.get $p0
        i32.lt_u
        br_if $B57
        i32.const 0
        local.set $l12
        i32.const 0
        local.set $l9
        i32.const 0
        local.set $l10
        br $B56
      end
      i32.const 0
      local.set $l10
      i32.const 0
      local.set $l9
      i32.const 0
      local.set $l12
      i32.const 0
      local.set $l6
      loop $L58
        block $B59
          block $B60
            local.get $l3
            i32.load8_u offset=196608
            local.tee $l2
            i32.const 10
            i32.ne
            br_if $B60
            local.get $l3
            i32.const 1
            i32.add
            local.set $l3
            br $B59
          end
          local.get $l3
          i32.const 2
          i32.add
          local.set $l1
          block $B61
            block $B62
              block $B63
                block $B64
                  block $B65
                    block $B66
                      local.get $l2
                      i32.const -68
                      i32.add
                      br_table $B63 $B65 $B65 $B65 $B65 $B66 $B65 $B65 $B65 $B65 $B65 $B65 $B65 $B65 $B64 $B65
                    end
                    i32.const 1
                    local.set $l13
                    block $B67
                      local.get $l1
                      local.get $p0
                      i32.ge_u
                      br_if $B67
                      local.get $l1
                      local.get $l3
                      i32.const 3
                      i32.add
                      local.get $l3
                      i32.const 196610
                      i32.add
                      i32.load8_u
                      i32.const 45
                      i32.ne
                      local.tee $l13
                      select
                      local.set $l1
                    end
                    i32.const 0
                    local.set $l3
                    block $B68
                      local.get $l1
                      local.get $p0
                      i32.ge_u
                      br_if $B68
                      i32.const 0
                      local.set $l3
                      loop $L69
                        local.get $l1
                        i32.const 196608
                        i32.add
                        i32.load8_u
                        local.tee $l2
                        i32.const -58
                        i32.add
                        i32.const 255
                        i32.and
                        i32.const 246
                        i32.lt_u
                        br_if $B68
                        local.get $l3
                        i32.const 10
                        i32.mul
                        local.get $l2
                        i32.add
                        i32.const -48
                        i32.add
                        local.set $l3
                        local.get $p0
                        local.get $l1
                        i32.const 1
                        i32.add
                        local.tee $l1
                        i32.ne
                        br_if $L69
                      end
                      local.get $p0
                      local.set $l1
                    end
                    i32.const 1
                    local.set $l11
                    block $B70
                      local.get $l1
                      i32.const 1
                      i32.add
                      local.tee $l2
                      local.get $p0
                      i32.ge_u
                      br_if $B70
                      local.get $l2
                      local.get $l1
                      i32.const 2
                      i32.add
                      local.get $l1
                      i32.const 196609
                      i32.add
                      i32.load8_u
                      i32.const 45
                      i32.ne
                      local.tee $l11
                      select
                      local.set $l2
                    end
                    i32.const 0
                    local.set $l5
                    block $B71
                      local.get $l2
                      local.get $p0
                      i32.ge_u
                      br_if $B71
                      i32.const 0
                      local.set $l5
                      loop $L72
                        local.get $l2
                        i32.const 196608
                        i32.add
                        i32.load8_u
                        local.tee $l1
                        i32.const -58
                        i32.add
                        i32.const 255
                        i32.and
                        i32.const 246
                        i32.lt_u
                        br_if $B71
                        local.get $l5
                        i32.const 10
                        i32.mul
                        local.get $l1
                        i32.add
                        i32.const -48
                        i32.add
                        local.set $l5
                        local.get $p0
                        local.get $l2
                        i32.const 1
                        i32.add
                        local.tee $l2
                        i32.ne
                        br_if $L72
                      end
                      local.get $p0
                      local.set $l2
                    end
                    i32.const 1
                    local.set $l14
                    block $B73
                      local.get $l2
                      i32.const 1
                      i32.add
                      local.tee $l1
                      local.get $p0
                      i32.ge_u
                      br_if $B73
                      local.get $l1
                      local.get $l2
                      i32.const 2
                      i32.add
                      local.get $l2
                      i32.const 196609
                      i32.add
                      i32.load8_u
                      i32.const 45
                      i32.ne
                      local.tee $l14
                      select
                      local.set $l1
                    end
                    i32.const 0
                    local.get $l3
                    i32.sub
                    local.set $l16
                    i32.const 0
                    local.get $l5
                    i32.sub
                    local.set $l17
                    i32.const 0
                    local.set $l2
                    block $B74
                      local.get $l1
                      local.get $p0
                      i32.ge_u
                      br_if $B74
                      i32.const 0
                      local.set $l2
                      loop $L75
                        local.get $l1
                        i32.const 196608
                        i32.add
                        i32.load8_u
                        local.tee $l15
                        i32.const -58
                        i32.add
                        i32.const 255
                        i32.and
                        i32.const 246
                        i32.lt_u
                        br_if $B74
                        local.get $l2
                        i32.const 10
                        i32.mul
                        local.get $l15
                        i32.add
                        i32.const -48
                        i32.add
                        local.set $l2
                        local.get $p0
                        local.get $l1
                        i32.const 1
                        i32.add
                        local.tee $l1
                        i32.ne
                        br_if $L75
                      end
                      local.get $p0
                      local.set $l1
                    end
                    local.get $l3
                    local.get $l16
                    local.get $l13
                    select
                    local.set $l13
                    local.get $l5
                    local.get $l17
                    local.get $l11
                    select
                    local.set $l11
                    local.get $l2
                    i32.const 0
                    local.get $l2
                    i32.sub
                    local.get $l14
                    select
                    local.set $l14
                    local.get $l1
                    i32.const 1
                    i32.add
                    local.tee $l5
                    local.set $l1
                    block $B76
                      block $B77
                        local.get $l5
                        local.get $p0
                        i32.ge_u
                        br_if $B77
                        local.get $l5
                        local.set $l1
                        loop $L78
                          local.get $l1
                          i32.const 196608
                          i32.add
                          i32.load8_u
                          i32.const -9
                          i32.add
                          i32.const 255
                          i32.and
                          i32.const 2
                          i32.lt_u
                          br_if $B77
                          local.get $p0
                          local.get $l1
                          i32.const 1
                          i32.add
                          local.tee $l1
                          i32.ne
                          br_if $L78
                        end
                        local.get $p0
                        local.set $l1
                        local.get $p0
                        local.set $l3
                        br $B76
                      end
                      block $B79
                        local.get $l1
                        local.get $p0
                        i32.lt_u
                        br_if $B79
                        local.get $l1
                        local.set $l3
                        br $B76
                      end
                      local.get $l1
                      local.set $l2
                      block $B80
                        loop $L81
                          local.get $l2
                          i32.const 196608
                          i32.add
                          i32.load8_u
                          i32.const 10
                          i32.eq
                          br_if $B80
                          local.get $p0
                          local.get $l2
                          i32.const 1
                          i32.add
                          local.tee $l2
                          i32.ne
                          br_if $L81
                        end
                        local.get $p0
                        local.set $l3
                        br $B76
                      end
                      local.get $l2
                      i32.const 1
                      i32.add
                      local.set $l3
                    end
                    local.get $l13
                    i32.const 1
                    i32.shl
                    i32.const 163840
                    i32.add
                    local.get $l1
                    local.get $l5
                    i32.sub
                    i32.store16
                    local.get $l13
                    i32.const 2
                    i32.shl
                    local.tee $l15
                    i32.const 147456
                    i32.add
                    local.get $l5
                    i32.store
                    local.get $l15
                    i32.const 65536
                    i32.add
                    local.get $l11
                    i32.store
                    local.get $l15
                    i32.const 81920
                    i32.add
                    i32.const -1
                    i32.store
                    local.get $l15
                    i32.const 131072
                    i32.add
                    i32.const 0
                    i32.store
                    block $B82
                      local.get $l14
                      br_if $B82
                      local.get $l15
                      i32.const 98304
                      i32.add
                      i32.const -1
                      i32.store
                      local.get $l15
                      i32.const 114688
                      i32.add
                      local.get $l11
                      i32.const 2
                      i32.shl
                      i32.const 81920
                      i32.add
                      local.tee $l2
                      i32.load
                      local.tee $l1
                      i32.store
                      block $B83
                        local.get $l1
                        i32.const -1
                        i32.eq
                        br_if $B83
                        local.get $l1
                        i32.const 2
                        i32.shl
                        i32.const 98304
                        i32.add
                        local.get $l13
                        i32.store
                      end
                      local.get $l2
                      local.get $l13
                      i32.store
                      br $B61
                    end
                    local.get $l11
                    i32.const 2
                    i32.shl
                    i32.const 81920
                    i32.add
                    local.tee $l17
                    i32.load
                    local.tee $l16
                    local.set $l1
                    local.get $l14
                    i32.const 2
                    i32.lt_s
                    br_if $B62
                    local.get $l16
                    local.set $l1
                    local.get $l16
                    i32.const -1
                    i32.eq
                    br_if $B62
                    local.get $l14
                    i32.const -1
                    i32.add
                    local.set $l5
                    i32.const 1
                    local.set $l2
                    local.get $l16
                    local.set $l1
                    loop $L84
                      local.get $l1
                      i32.const 2
                      i32.shl
                      i32.const 114688
                      i32.add
                      i32.load
                      local.set $l1
                      local.get $l2
                      local.get $l5
                      i32.ge_s
                      br_if $B62
                      local.get $l2
                      i32.const 1
                      i32.add
                      local.set $l2
                      local.get $l1
                      i32.const -1
                      i32.ne
                      br_if $L84
                      br $B62
                    end
                  end
                  block $B85
                    local.get $l1
                    local.get $p0
                    i32.lt_u
                    br_if $B85
                    local.get $l1
                    local.set $l3
                    br $B59
                  end
                  block $B86
                    loop $L87
                      local.get $l1
                      i32.const 196608
                      i32.add
                      i32.load8_u
                      i32.const 10
                      i32.eq
                      br_if $B86
                      local.get $p0
                      local.get $l1
                      i32.const 1
                      i32.add
                      local.tee $l1
                      i32.ne
                      br_if $L87
                      br $B56
                    end
                  end
                  local.get $l1
                  i32.const 1
                  i32.add
                  local.set $l3
                  br $B59
                end
                i32.const 1
                local.set $l15
                block $B88
                  local.get $l1
                  local.get $p0
                  i32.ge_u
                  br_if $B88
                  local.get $l1
                  local.get $l3
                  i32.const 3
                  i32.add
                  local.get $l3
                  i32.const 196610
                  i32.add
                  i32.load8_u
                  i32.const 45
                  i32.ne
                  local.tee $l15
                  select
                  local.set $l1
                end
                i32.const 0
                local.set $l5
                block $B89
                  local.get $l1
                  local.get $p0
                  i32.ge_u
                  br_if $B89
                  i32.const 0
                  local.set $l5
                  loop $L90
                    local.get $l1
                    i32.const 196608
                    i32.add
                    i32.load8_u
                    local.tee $l2
                    i32.const -58
                    i32.add
                    i32.const 255
                    i32.and
                    i32.const 246
                    i32.lt_u
                    br_if $B89
                    local.get $l5
                    i32.const 10
                    i32.mul
                    local.get $l2
                    i32.add
                    i32.const -48
                    i32.add
                    local.set $l5
                    local.get $p0
                    local.get $l1
                    i32.const 1
                    i32.add
                    local.tee $l1
                    i32.ne
                    br_if $L90
                  end
                  local.get $p0
                  local.set $l1
                end
                i32.const 1
                local.set $l14
                block $B91
                  local.get $l1
                  i32.const 1
                  i32.add
                  local.tee $l2
                  local.get $p0
                  i32.ge_u
                  br_if $B91
                  local.get $l2
                  local.get $l1
                  i32.const 2
                  i32.add
                  local.get $l1
                  i32.const 196609
                  i32.add
                  i32.load8_u
                  i32.const 45
                  i32.ne
                  local.tee $l14
                  select
                  local.set $l2
                end
                i32.const 0
                local.set $l1
                block $B92
                  local.get $l2
                  local.get $p0
                  i32.ge_u
                  br_if $B92
                  i32.const 0
                  local.set $l1
                  loop $L93
                    local.get $l2
                    i32.const 196608
                    i32.add
                    i32.load8_u
                    local.tee $l3
                    i32.const -58
                    i32.add
                    i32.const 255
                    i32.and
                    i32.const 246
                    i32.lt_u
                    br_if $B92
                    local.get $l1
                    i32.const 10
                    i32.mul
                    local.get $l3
                    i32.add
                    i32.const -48
                    i32.add
                    local.set $l1
                    local.get $p0
                    local.get $l2
                    i32.const 1
                    i32.add
                    local.tee $l2
                    i32.ne
                    br_if $L93
                  end
                  local.get $p0
                  local.set $l2
                end
                i32.const 0
                local.get $l5
                i32.sub
                local.set $l11
                i32.const 1
                local.set $l13
                block $B94
                  local.get $l2
                  i32.const 1
                  i32.add
                  local.tee $l3
                  local.get $p0
                  i32.ge_u
                  br_if $B94
                  local.get $l3
                  local.get $l2
                  i32.const 2
                  i32.add
                  local.get $l2
                  i32.const 196609
                  i32.add
                  i32.load8_u
                  i32.const 45
                  i32.ne
                  local.tee $l13
                  select
                  local.set $l3
                end
                local.get $l5
                local.get $l11
                local.get $l15
                select
                local.set $l15
                i32.const 0
                local.set $l2
                block $B95
                  block $B96
                    local.get $l3
                    local.get $p0
                    i32.ge_u
                    br_if $B96
                    i32.const 0
                    local.set $l2
                    loop $L97
                      local.get $l3
                      i32.const 196608
                      i32.add
                      i32.load8_u
                      local.tee $l5
                      i32.const -58
                      i32.add
                      i32.const 255
                      i32.and
                      i32.const 246
                      i32.lt_u
                      br_if $B96
                      local.get $l2
                      i32.const 10
                      i32.mul
                      local.get $l5
                      i32.add
                      i32.const -48
                      i32.add
                      local.set $l2
                      local.get $p0
                      local.get $l3
                      i32.const 1
                      i32.add
                      local.tee $l3
                      i32.ne
                      br_if $L97
                    end
                    local.get $l2
                    i32.const 0
                    local.get $l2
                    i32.sub
                    local.get $l13
                    select
                    local.set $l11
                    local.get $p0
                    local.set $l3
                    br $B95
                  end
                  local.get $l2
                  i32.const 0
                  local.get $l2
                  i32.sub
                  local.get $l13
                  select
                  local.set $l11
                  local.get $l3
                  local.get $p0
                  i32.ge_u
                  br_if $B95
                  block $B98
                    loop $L99
                      local.get $l3
                      i32.const 196608
                      i32.add
                      i32.load8_u
                      i32.const 10
                      i32.eq
                      br_if $B98
                      local.get $p0
                      local.get $l3
                      i32.const 1
                      i32.add
                      local.tee $l3
                      i32.ne
                      br_if $L99
                    end
                    local.get $p0
                    local.set $l3
                    br $B95
                  end
                  local.get $l3
                  i32.const 1
                  i32.add
                  local.set $l3
                end
                i32.const 0
                local.get $l1
                i32.sub
                local.set $l18
                local.get $l15
                i32.const 2
                i32.shl
                local.tee $l5
                i32.const 114688
                i32.add
                local.tee $l13
                i32.load
                local.set $l2
                local.get $l5
                i32.const 65536
                i32.add
                local.tee $l19
                i32.load
                local.set $l16
                block $B100
                  block $B101
                    local.get $l5
                    i32.const 98304
                    i32.add
                    local.tee $l17
                    i32.load
                    local.tee $l5
                    i32.const -1
                    i32.ne
                    br_if $B101
                    local.get $l16
                    i32.const 2
                    i32.shl
                    i32.const 81920
                    i32.add
                    local.get $l2
                    i32.store
                    br $B100
                  end
                  local.get $l5
                  i32.const 2
                  i32.shl
                  i32.const 114688
                  i32.add
                  local.get $l2
                  i32.store
                end
                local.get $l1
                local.get $l18
                local.get $l14
                select
                local.set $l1
                block $B102
                  local.get $l2
                  i32.const -1
                  i32.eq
                  br_if $B102
                  local.get $l2
                  i32.const 2
                  i32.shl
                  i32.const 98304
                  i32.add
                  local.get $l5
                  i32.store
                end
                local.get $l13
                i32.const -1
                i32.store
                local.get $l19
                local.get $l1
                i32.store
                local.get $l16
                i32.const 2
                i32.shl
                i32.const 131072
                i32.add
                local.tee $l2
                local.get $l2
                i32.load
                i32.const -1
                i32.add
                i32.store
                local.get $l1
                i32.const 2
                i32.shl
                local.tee $l18
                i32.const 81920
                i32.add
                local.set $l14
                block $B103
                  block $B104
                    local.get $l11
                    br_if $B104
                    local.get $l17
                    i32.const -1
                    i32.store
                    local.get $l13
                    local.get $l14
                    i32.load
                    local.tee $l1
                    i32.store
                    block $B105
                      local.get $l1
                      i32.const -1
                      i32.eq
                      br_if $B105
                      local.get $l1
                      i32.const 2
                      i32.shl
                      i32.const 98304
                      i32.add
                      local.get $l15
                      i32.store
                    end
                    local.get $l14
                    local.get $l15
                    i32.store
                    br $B103
                  end
                  local.get $l14
                  i32.load
                  local.tee $l16
                  local.set $l1
                  block $B106
                    local.get $l11
                    i32.const 2
                    i32.lt_s
                    br_if $B106
                    local.get $l16
                    local.set $l1
                    local.get $l16
                    i32.const -1
                    i32.eq
                    br_if $B106
                    local.get $l11
                    i32.const -1
                    i32.add
                    local.set $l5
                    i32.const 1
                    local.set $l2
                    local.get $l16
                    local.set $l1
                    loop $L107
                      local.get $l1
                      i32.const 2
                      i32.shl
                      i32.const 114688
                      i32.add
                      i32.load
                      local.set $l1
                      local.get $l2
                      local.get $l5
                      i32.ge_s
                      br_if $B106
                      local.get $l2
                      i32.const 1
                      i32.add
                      local.set $l2
                      local.get $l1
                      i32.const -1
                      i32.ne
                      br_if $L107
                    end
                  end
                  block $B108
                    local.get $l1
                    i32.const -1
                    i32.ne
                    br_if $B108
                    local.get $l17
                    i32.const -1
                    i32.store
                    local.get $l13
                    local.get $l16
                    i32.store
                    block $B109
                      local.get $l16
                      i32.const -1
                      i32.eq
                      br_if $B109
                      local.get $l16
                      i32.const 2
                      i32.shl
                      i32.const 98304
                      i32.add
                      local.get $l15
                      i32.store
                    end
                    local.get $l14
                    local.get $l15
                    i32.store
                    br $B103
                  end
                  local.get $l17
                  local.get $l1
                  i32.store
                  local.get $l13
                  local.get $l1
                  i32.const 2
                  i32.shl
                  i32.const 114688
                  i32.add
                  local.tee $l2
                  i32.load
                  local.tee $l1
                  i32.store
                  block $B110
                    local.get $l1
                    i32.const -1
                    i32.eq
                    br_if $B110
                    local.get $l1
                    i32.const 2
                    i32.shl
                    i32.const 98304
                    i32.add
                    local.get $l15
                    i32.store
                  end
                  local.get $l2
                  local.get $l15
                  i32.store
                end
                local.get $l18
                i32.const 131072
                i32.add
                local.tee $l1
                local.get $l1
                i32.load
                i32.const 1
                i32.add
                i32.store
                local.get $l7
                i32.const 1
                i32.add
                local.set $l7
                local.get $l10
                i32.const 1
                i32.add
                local.set $l10
                local.get $l8
                i32.const 1
                i32.add
                local.set $l8
                local.get $l6
                i32.const 1
                i32.add
                local.set $l6
                br $B59
              end
              i32.const 1
              local.set $l5
              block $B111
                local.get $l1
                local.get $p0
                i32.ge_u
                br_if $B111
                local.get $l1
                local.get $l3
                i32.const 3
                i32.add
                local.get $l3
                i32.const 196610
                i32.add
                i32.load8_u
                i32.const 45
                i32.ne
                local.tee $l5
                select
                local.set $l1
              end
              i32.const 0
              local.set $l2
              block $B112
                block $B113
                  local.get $l1
                  local.get $p0
                  i32.ge_u
                  br_if $B113
                  i32.const 0
                  local.set $l2
                  loop $L114
                    local.get $l1
                    i32.const 196608
                    i32.add
                    i32.load8_u
                    local.tee $l3
                    i32.const -58
                    i32.add
                    i32.const 255
                    i32.and
                    i32.const 246
                    i32.lt_u
                    br_if $B113
                    local.get $l2
                    i32.const 10
                    i32.mul
                    local.get $l3
                    i32.add
                    i32.const -48
                    i32.add
                    local.set $l2
                    local.get $p0
                    local.get $l1
                    i32.const 1
                    i32.add
                    local.tee $l1
                    i32.ne
                    br_if $L114
                  end
                  local.get $l2
                  i32.const 0
                  local.get $l2
                  i32.sub
                  local.get $l5
                  select
                  local.set $l2
                  local.get $p0
                  local.set $l3
                  br $B112
                end
                local.get $l2
                i32.const 0
                local.get $l2
                i32.sub
                local.get $l5
                select
                local.set $l2
                block $B115
                  local.get $l1
                  local.get $p0
                  i32.lt_u
                  br_if $B115
                  local.get $l1
                  local.set $l3
                  br $B112
                end
                block $B116
                  loop $L117
                    local.get $l1
                    i32.const 196608
                    i32.add
                    i32.load8_u
                    i32.const 10
                    i32.eq
                    br_if $B116
                    local.get $p0
                    local.get $l1
                    i32.const 1
                    i32.add
                    local.tee $l1
                    i32.ne
                    br_if $L117
                  end
                  local.get $p0
                  local.set $l3
                  br $B112
                end
                local.get $l1
                i32.const 1
                i32.add
                local.set $l3
              end
              local.get $l2
              i32.const 2
              i32.shl
              local.tee $l2
              i32.const 114688
              i32.add
              local.tee $l15
              i32.load
              local.set $l1
              local.get $l2
              i32.const 65536
              i32.add
              local.tee $l13
              i32.load
              local.set $l5
              block $B118
                block $B119
                  local.get $l2
                  i32.const 98304
                  i32.add
                  local.tee $l11
                  i32.load
                  local.tee $l2
                  i32.const -1
                  i32.ne
                  br_if $B119
                  local.get $l5
                  i32.const 2
                  i32.shl
                  i32.const 81920
                  i32.add
                  local.get $l1
                  i32.store
                  br $B118
                end
                local.get $l2
                i32.const 2
                i32.shl
                i32.const 114688
                i32.add
                local.get $l1
                i32.store
              end
              block $B120
                local.get $l1
                i32.const -1
                i32.eq
                br_if $B120
                local.get $l1
                i32.const 2
                i32.shl
                i32.const 98304
                i32.add
                local.get $l2
                i32.store
              end
              local.get $l15
              i32.const -1
              i32.store
              local.get $l11
              i32.const -1
              i32.store
              local.get $l13
              i32.const -2
              i32.store
              local.get $l5
              i32.const 2
              i32.shl
              i32.const 131072
              i32.add
              local.tee $l1
              local.get $l1
              i32.load
              i32.const -1
              i32.add
              i32.store
              local.get $l4
              i32.const -1
              i32.add
              local.set $l4
              local.get $l7
              i32.const 1
              i32.add
              local.set $l7
              local.get $l10
              i32.const 1
              i32.add
              local.set $l10
              local.get $l12
              i32.const 1
              i32.add
              local.set $l12
              br $B59
            end
            local.get $l15
            i32.const 98304
            i32.add
            local.set $l2
            local.get $l15
            i32.const 114688
            i32.add
            local.set $l5
            block $B121
              local.get $l1
              i32.const -1
              i32.ne
              br_if $B121
              local.get $l2
              i32.const -1
              i32.store
              local.get $l5
              local.get $l16
              i32.store
              block $B122
                local.get $l16
                i32.const -1
                i32.eq
                br_if $B122
                local.get $l16
                i32.const 2
                i32.shl
                i32.const 98304
                i32.add
                local.get $l13
                i32.store
              end
              local.get $l17
              local.get $l13
              i32.store
              br $B61
            end
            local.get $l2
            local.get $l1
            i32.store
            local.get $l5
            local.get $l1
            i32.const 2
            i32.shl
            i32.const 114688
            i32.add
            local.tee $l2
            i32.load
            local.tee $l1
            i32.store
            block $B123
              local.get $l1
              i32.const -1
              i32.eq
              br_if $B123
              local.get $l1
              i32.const 2
              i32.shl
              i32.const 98304
              i32.add
              local.get $l13
              i32.store
            end
            local.get $l2
            local.get $l13
            i32.store
          end
          local.get $l11
          i32.const 2
          i32.shl
          i32.const 131072
          i32.add
          local.tee $l1
          local.get $l1
          i32.load
          i32.const 1
          i32.add
          i32.store
          local.get $l4
          i32.const 1
          i32.add
          local.set $l4
          local.get $l7
          i32.const 1
          i32.add
          local.set $l7
          local.get $l8
          i32.const 1
          i32.add
          local.set $l8
          local.get $l9
          i32.const 1
          i32.add
          local.set $l9
        end
        local.get $l3
        local.get $p0
        i32.lt_u
        br_if $L58
      end
    end
    i32.const 0
    i32.const -2128831035
    i32.store offset=172032
    i32.const 0
    call $dfs_mix
    i32.const 0
    i32.load offset=172032
    local.set $p0
    i32.const 0
    local.get $l9
    i32.store offset=524288
    i32.const 0
    local.get $l12
    i32.store offset=524292
    i32.const 0
    local.get $l6
    i32.store offset=524296
    i32.const 0
    local.get $l4
    i32.store offset=524300
    i32.const 0
    local.get $l8
    i32.store offset=524304
    i32.const 0
    local.get $l10
    i32.store offset=524308
    i32.const 0
    local.get $l7
    i32.store offset=524312
    i32.const 0
    local.get $p0
    i32.store offset=524316
    local.get $l4)
  (func $dfs_mix (type $t2) (param $p0 i32)
    (local $l1 i32) (local $l2 i32) (local $l3 i32) (local $l4 i32) (local $l5 i32) (local $l6 i32)
    i32.const 0
    i32.const 0
    i32.load offset=172032
    local.get $p0
    i32.const 255
    i32.and
    i32.xor
    i32.const 16777619
    i32.mul
    local.get $p0
    i32.const 8
    i32.shr_u
    i32.const 255
    i32.and
    i32.xor
    i32.const 16777619
    i32.mul
    local.get $p0
    i32.const 16
    i32.shr_u
    i32.const 255
    i32.and
    i32.xor
    i32.const 16777619
    i32.mul
    local.get $p0
    i32.const 24
    i32.shr_u
    i32.xor
    i32.const 16777619
    i32.mul
    local.get $p0
    i32.const 1
    i32.shl
    i32.const 163840
    i32.add
    i32.load16_u
    local.tee $l1
    i32.const 1
    i32.shr_u
    local.tee $l2
    i32.const 255
    i32.and
    i32.xor
    i32.const 16777619
    i32.mul
    local.get $l1
    i32.const 9
    i32.shr_u
    i32.xor
    i32.const 1055306571
    i32.mul
    local.tee $l3
    i32.store offset=172032
    local.get $p0
    i32.const 2
    i32.shl
    local.set $l4
    block $B0
      local.get $l2
      i32.eqz
      br_if $B0
      local.get $l4
      i32.const 147456
      i32.add
      i32.load
      i32.const 196608
      i32.add
      local.set $p0
      loop $L1
        local.get $p0
        i32.const 1
        i32.add
        i32.load8_u
        local.set $l1
        block $B2
          local.get $p0
          i32.load8_u
          local.tee $l5
          i32.const -48
          i32.add
          local.tee $l6
          i32.const 255
          i32.and
          i32.const 10
          i32.lt_u
          br_if $B2
          block $B3
            local.get $l5
            i32.const -97
            i32.add
            i32.const 255
            i32.and
            i32.const 5
            i32.gt_u
            br_if $B3
            local.get $l5
            i32.const -87
            i32.add
            local.set $l6
            br $B2
          end
          local.get $l5
          i32.const -55
          i32.add
          local.set $l6
        end
        local.get $l6
        i32.const 4
        i32.shl
        local.set $l5
        block $B4
          local.get $l1
          i32.const -48
          i32.add
          local.tee $l6
          i32.const 255
          i32.and
          i32.const 10
          i32.lt_u
          br_if $B4
          block $B5
            local.get $l1
            i32.const -97
            i32.add
            i32.const 255
            i32.and
            i32.const 5
            i32.gt_u
            br_if $B5
            local.get $l1
            i32.const -87
            i32.add
            local.set $l6
            br $B4
          end
          local.get $l1
          i32.const -55
          i32.add
          local.set $l6
        end
        i32.const 0
        local.get $l3
        local.get $l6
        local.get $l5
        i32.or
        i32.const 255
        i32.and
        i32.xor
        i32.const 16777619
        i32.mul
        local.tee $l3
        i32.store offset=172032
        local.get $p0
        i32.const 2
        i32.add
        local.set $p0
        local.get $l2
        i32.const -1
        i32.add
        local.tee $l2
        br_if $L1
      end
    end
    i32.const 0
    local.get $l3
    local.get $l4
    i32.const 131072
    i32.add
    i32.load
    local.tee $p0
    i32.const 255
    i32.and
    i32.xor
    i32.const 16777619
    i32.mul
    local.get $p0
    i32.const 8
    i32.shr_u
    i32.const 255
    i32.and
    i32.xor
    i32.const 16777619
    i32.mul
    local.get $p0
    i32.const 16
    i32.shr_u
    i32.const 255
    i32.and
    i32.xor
    i32.const 16777619
    i32.mul
    local.get $p0
    i32.const 24
    i32.shr_u
    i32.xor
    i32.const 16777619
    i32.mul
    i32.store offset=172032
    block $B6
      local.get $l4
      i32.const 81920
      i32.add
      i32.load
      local.tee $p0
      i32.const -1
      i32.eq
      br_if $B6
      loop $L7
        local.get $p0
        call $dfs_mix
        local.get $p0
        i32.const 2
        i32.shl
        i32.const 114688
        i32.add
        i32.load
        local.tee $p0
        i32.const -1
        i32.ne
        br_if $L7
      end
    end)
  (table $__indirect_function_table 1 1 funcref)
  (memory $memory 10)
  (global $__stack_pointer (mut i32) (i32.const 65536))
  (global $__dso_handle i32 (i32.const 65536))
  (global $__data_end i32 (i32.const 172036))
  (global $__stack_low i32 (i32.const 0))
  (global $__stack_high i32 (i32.const 65536))
  (global $__global_base i32 (i32.const 65536))
  (global $__heap_base i32 (i32.const 172048))
  (global $__heap_end i32 (i32.const 655360))
  (global $__memory_base i32 (i32.const 0))
  (global $__table_base i32 (i32.const 1))
  (global $__wasm_first_page_end i32 (i32.const 65536))
  (export "memory" (memory $memory))
  (export "__wasm_call_ctors" (func $__wasm_call_ctors))
  (export "__stack_pointer" (global $__stack_pointer))
  (export "gc_document_edit_trace" (func $gc_document_edit_trace))
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
