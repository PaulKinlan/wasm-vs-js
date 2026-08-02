(module
  (memory (export "memory") 1 1)

  ;; Fixed one-page layout: source=0, output=16384, mask/luma=32768,
  ;; stack/horizontal=36864, nine u32 counters=49152.
  (global $stack_size (mut i32) (i32.const 0))
  (global $operations (mut i32) (i32.const 0))
  (global $read_bytes (mut i32) (i32.const 0))
  (global $write_bytes (mut i32) (i32.const 0))
  (global $visited_pixels (mut i32) (i32.const 0))
  (global $changed_pixels (mut i32) (i32.const 0))
  (global $neighbor_tests (mut i32) (i32.const 0))
  (global $stack_pushes (mut i32) (i32.const 0))
  (global $stack_pops (mut i32) (i32.const 0))
  (global $max_frontier (mut i32) (i32.const 0))

  (func $reset_counters
    i32.const 0 global.set $stack_size
    i32.const 0 global.set $operations
    i32.const 0 global.set $read_bytes
    i32.const 0 global.set $write_bytes
    i32.const 0 global.set $visited_pixels
    i32.const 0 global.set $changed_pixels
    i32.const 0 global.set $neighbor_tests
    i32.const 0 global.set $stack_pushes
    i32.const 0 global.set $stack_pops
    i32.const 0 global.set $max_frontier
  )

  (func $write_counters
    i32.const 49152 global.get $operations i32.store
    i32.const 49156 global.get $read_bytes i32.store
    i32.const 49160 global.get $write_bytes i32.store
    i32.const 49164 global.get $visited_pixels i32.store
    i32.const 49168 global.get $changed_pixels i32.store
    i32.const 49172 global.get $neighbor_tests i32.store
    i32.const 49176 global.get $stack_pushes i32.store
    i32.const 49180 global.get $stack_pops i32.store
    i32.const 49184 global.get $max_frontier i32.store
  )

  (func $absdiff (param $left i32) (param $right i32) (result i32)
    local.get $left
    local.get $right
    i32.ge_u
    if (result i32)
      local.get $left local.get $right i32.sub
    else
      local.get $right local.get $left i32.sub
    end
  )

  (func $push (param $index i32)
    (local $new_size i32)
    i32.const 32768 local.get $index i32.add i32.const 1 i32.store8
    i32.const 36864 global.get $stack_size i32.const 4 i32.mul i32.add
    local.get $index
    i32.store
    global.get $stack_size i32.const 1 i32.add local.tee $new_size global.set $stack_size
    global.get $stack_pushes i32.const 1 i32.add global.set $stack_pushes
    global.get $write_bytes i32.const 5 i32.add global.set $write_bytes
    local.get $new_size global.get $max_frontier i32.gt_u
    if local.get $new_size global.set $max_frontier end
  )

  (func $try_push (param $index i32)
    global.get $neighbor_tests i32.const 1 i32.add global.set $neighbor_tests
    global.get $operations i32.const 1 i32.add global.set $operations
    global.get $read_bytes i32.const 1 i32.add global.set $read_bytes
    i32.const 32768 local.get $index i32.add i32.load8_u i32.eqz
    if local.get $index call $push end
  )

  (func (export "flood_fill") (param $width i32) (param $height i32) (param $seed_x i32) (param $seed_y i32)
    (local $seed_index i32) (local $seed_offset i32)
    (local $seed_r i32) (local $seed_g i32) (local $seed_b i32) (local $seed_a i32)
    (local $index i32) (local $offset i32) (local $maximum i32) (local $difference i32)
    (local $x i32) (local $y i32)
    call $reset_counters
    local.get $seed_y local.get $width i32.mul local.get $seed_x i32.add local.tee $seed_index
    i32.const 4 i32.mul local.set $seed_offset
    local.get $seed_offset i32.load8_u local.set $seed_r
    local.get $seed_offset i32.const 1 i32.add i32.load8_u local.set $seed_g
    local.get $seed_offset i32.const 2 i32.add i32.load8_u local.set $seed_b
    local.get $seed_offset i32.const 3 i32.add i32.load8_u local.set $seed_a
    i32.const 4 global.set $read_bytes
    i32.const 4 global.set $operations

    local.get $seed_r i32.const 34 i32.eq
    local.get $seed_g i32.const 139 i32.eq i32.and
    local.get $seed_b i32.const 230 i32.eq i32.and
    local.get $seed_a i32.const 191 i32.eq i32.and
    if
      call $write_counters
      return
    end

    local.get $seed_index call $push
    block $done
      loop $next
        global.get $stack_size i32.eqz br_if $done
        global.get $stack_size i32.const 1 i32.sub global.set $stack_size
        i32.const 36864 global.get $stack_size i32.const 4 i32.mul i32.add i32.load local.set $index
        global.get $stack_pops i32.const 1 i32.add global.set $stack_pops
        global.get $visited_pixels i32.const 1 i32.add global.set $visited_pixels
        global.get $read_bytes i32.const 8 i32.add global.set $read_bytes
        local.get $index i32.const 4 i32.mul local.set $offset

        local.get $offset i32.load8_u local.get $seed_r call $absdiff local.set $maximum
        local.get $offset i32.const 1 i32.add i32.load8_u local.get $seed_g call $absdiff local.tee $difference
        local.get $maximum i32.gt_u if local.get $difference local.set $maximum end
        local.get $offset i32.const 2 i32.add i32.load8_u local.get $seed_b call $absdiff local.tee $difference
        local.get $maximum i32.gt_u if local.get $difference local.set $maximum end
        local.get $offset i32.const 3 i32.add i32.load8_u local.get $seed_a call $absdiff local.tee $difference
        local.get $maximum i32.gt_u if local.get $difference local.set $maximum end
        global.get $operations i32.const 8 i32.add global.set $operations

        local.get $maximum i32.const 12 i32.le_u
        if
          i32.const 16384 local.get $offset i32.add i32.const 34 i32.store8
          i32.const 16384 local.get $offset i32.add i32.const 1 i32.add i32.const 139 i32.store8
          i32.const 16384 local.get $offset i32.add i32.const 2 i32.add i32.const 230 i32.store8
          i32.const 16384 local.get $offset i32.add i32.const 3 i32.add i32.const 191 i32.store8
          global.get $changed_pixels i32.const 1 i32.add global.set $changed_pixels
          global.get $write_bytes i32.const 4 i32.add global.set $write_bytes

          local.get $index local.get $width i32.rem_u local.set $x
          local.get $index local.get $width i32.div_u local.set $y
          local.get $y i32.const 0 i32.gt_u
          if local.get $index local.get $width i32.sub call $try_push end
          local.get $x i32.const 1 i32.add local.get $width i32.lt_u
          if local.get $index i32.const 1 i32.add call $try_push end
          local.get $y i32.const 1 i32.add local.get $height i32.lt_u
          if local.get $index local.get $width i32.add call $try_push end
          local.get $x i32.const 0 i32.gt_u
          if local.get $index i32.const 1 i32.sub call $try_push end
        end
        br $next
      end
    end
    call $write_counters
  )

  (func (export "luma_gaussian_pipeline") (param $width i32) (param $height i32)
    (local $pixels i32) (local $index i32) (local $offset i32)
    (local $x i32) (local $y i32) (local $left i32) (local $right i32)
    (local $top i32) (local $bottom i32) (local $value i32)
    call $reset_counters
    local.get $width local.get $height i32.mul local.set $pixels

    ;; Integer luma: (77R + 150G + 29B + 128) >> 8.
    block $luma_done
      loop $luma
        local.get $index local.get $pixels i32.ge_u br_if $luma_done
        local.get $index i32.const 4 i32.mul local.set $offset
        i32.const 32768 local.get $index i32.add
        local.get $offset i32.load8_u i32.const 77 i32.mul
        local.get $offset i32.const 1 i32.add i32.load8_u i32.const 150 i32.mul i32.add
        local.get $offset i32.const 2 i32.add i32.load8_u i32.const 29 i32.mul i32.add
        i32.const 128 i32.add i32.const 8 i32.shr_u
        i32.store8
        local.get $index i32.const 1 i32.add local.set $index
        br $luma
      end
    end

    i32.const 0 local.set $index
    block $horizontal_done
      loop $horizontal
        local.get $index local.get $pixels i32.ge_u br_if $horizontal_done
        local.get $index local.get $width i32.rem_u local.set $x
        local.get $index local.get $width i32.div_u local.set $y
        local.get $x i32.eqz
        if local.get $index local.set $left
        else local.get $index i32.const 1 i32.sub local.set $left end
        local.get $x i32.const 1 i32.add local.get $width i32.ge_u
        if local.get $index local.set $right
        else local.get $index i32.const 1 i32.add local.set $right end
        i32.const 36864 local.get $index i32.const 2 i32.mul i32.add
        i32.const 32768 local.get $left i32.add i32.load8_u
        i32.const 32768 local.get $index i32.add i32.load8_u i32.const 2 i32.mul i32.add
        i32.const 32768 local.get $right i32.add i32.load8_u i32.add
        i32.store16
        local.get $index i32.const 1 i32.add local.set $index
        br $horizontal
      end
    end

    i32.const 0 local.set $index
    block $vertical_done
      loop $vertical
        local.get $index local.get $pixels i32.ge_u br_if $vertical_done
        local.get $index local.get $width i32.div_u local.set $y
        local.get $y i32.eqz
        if local.get $index local.set $top
        else local.get $index local.get $width i32.sub local.set $top end
        local.get $y i32.const 1 i32.add local.get $height i32.ge_u
        if local.get $index local.set $bottom
        else local.get $index local.get $width i32.add local.set $bottom end
        i32.const 36864 local.get $top i32.const 2 i32.mul i32.add i32.load16_u
        i32.const 36864 local.get $index i32.const 2 i32.mul i32.add i32.load16_u i32.const 2 i32.mul i32.add
        i32.const 36864 local.get $bottom i32.const 2 i32.mul i32.add i32.load16_u i32.add
        i32.const 8 i32.add i32.const 4 i32.shr_u local.set $value
        local.get $index i32.const 4 i32.mul local.set $offset
        i32.const 16384 local.get $offset i32.add local.get $value i32.store8
        i32.const 16384 local.get $offset i32.add i32.const 1 i32.add local.get $value i32.store8
        i32.const 16384 local.get $offset i32.add i32.const 2 i32.add local.get $value i32.store8
        i32.const 16384 local.get $offset i32.add i32.const 3 i32.add
        local.get $offset i32.const 3 i32.add i32.load8_u i32.store8
        local.get $index i32.const 1 i32.add local.set $index
        br $vertical
      end
    end

    local.get $pixels i32.const 19 i32.mul global.set $operations
    local.get $pixels i32.const 13 i32.mul global.set $read_bytes
    local.get $pixels i32.const 7 i32.mul global.set $write_bytes
    local.get $pixels global.set $visited_pixels
    call $write_counters
  )
)
