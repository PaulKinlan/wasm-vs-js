;; dom-grid-movement.wat — Handwritten WebAssembly Text kernel for 64x64 grid movement
(module
  (memory (export "memory") 1)
  (global $seed (mut i32) (i32.const 0xc001d00d))

  ;; xorshift32 PRNG matching next_rand() in grid_kernel.c
  (func $next_rand (result i32)
    (local $s i32)
    global.get $seed
    global.get $seed
    i32.const 13
    i32.shl
    i32.xor
    local.tee $s
    local.get $s
    i32.const 17
    i32.shr_s ;; arithmetic right shift
    i32.xor
    local.tee $s
    local.get $s
    i32.const 5
    i32.shl
    i32.xor
    local.tee $s
    global.set $seed
    local.get $s
  )

  (func $grid_trace (export "grid_trace") (result i32)
    ;; Memory layout:
    ;; 0..1023: entities array [128 entities * 2 coordinates (x, y)] = 256 * 4 = 1024 bytes
    ;; 1024..15423: actions array [3600 actions * 4 bytes] = 14400 bytes
    ;; 16384..16395: results [total_moves, collisions, final_pos_sum]
    (local $i i32)
    (local $entity i32)
    (local $dir i32)
    (local $total_moves i32)
    (local $collisions i32)
    (local $a i32)
    (local $new_x i32)
    (local $new_y i32)
    (local $occupied i32)
    (local $j i32)
    (local $final_sum i32)

    ;; Initialize entities: entities[i * 2] = (i * 3) % 64; entities[i * 2 + 1] = (i * 3) / 64;
    (local.set $i (i32.const 0))
    (block $break_init
      (loop $loop_init
        local.get $i
        i32.const 128
        i32.ge_s
        br_if $break_init

        ;; offset = i * 8
        local.get $i
        i32.const 8
        i32.mul

        ;; x = (i * 3) % 64 = (i * 3) & 63
        local.get $i
        i32.const 3
        i32.mul
        i32.const 63
        i32.and
        i32.store

        ;; y = (i * 3) / 64
        local.get $i
        i32.const 8
        i32.mul
        i32.const 4
        i32.add
        local.get $i
        i32.const 3
        i32.mul
        i32.const 6
        i32.shr_u
        i32.store

        local.get $i
        i32.const 1
        i32.add
        local.set $i
        br $loop_init
      )
    )

    ;; Generate 3600 actions into 1024..
    (global.set $seed (i32.const 0xc001d00d))
    (local.set $i (i32.const 0))
    (block $break_actions
      (loop $loop_actions
        local.get $i
        i32.const 3600
        i32.ge_s
        br_if $break_actions

        ;; target address: 1024 + i * 4
        i32.const 1024
        local.get $i
        i32.const 4
        i32.mul
        i32.add

        ;; action = (dir << 8) | entity
        ;; entity = (r >> 25) & 0x7f
        call $next_rand
        i32.const 25
        i32.shr_u
        i32.const 0x7f
        i32.and

        ;; dir = (r2 >> 30)
        call $next_rand
        i32.const 30
        i32.shr_u
        i32.const 8
        i32.shl
        i32.or
        i32.store

        local.get $i
        i32.const 1
        i32.add
        local.set $i
        br $loop_actions
      )
    )

    ;; Simulate 3600 actions
    (local.set $total_moves (i32.const 0))
    (local.set $collisions (i32.const 0))
    (local.set $a (i32.const 0))

    (block $break_sim
      (loop $loop_sim
        local.get $a
        i32.const 3600
        i32.ge_s
        br_if $break_sim

        ;; read action
        i32.const 1024
        local.get $a
        i32.const 4
        i32.mul
        i32.add
        i32.load
        local.tee $entity ;; action value
        i32.const 0xff
        i32.and
        local.set $entity

        ;; dir = (action >> 8) & 0xff
        i32.const 1024
        local.get $a
        i32.const 4
        i32.mul
        i32.add
        i32.load
        i32.const 8
        i32.shr_u
        i32.const 0xff
        i32.and
        local.set $dir

        ;; new_x = entities[entity * 2]
        local.get $entity
        i32.const 8
        i32.mul
        i32.load
        local.set $new_x

        ;; new_y = entities[entity * 2 + 1]
        local.get $entity
        i32.const 8
        i32.mul
        i32.const 4
        i32.add
        i32.load
        local.set $new_y

        ;; switch(dir): 0=up(y-1 if y>0), 1=down(y+1 if y<63), 2=left(x-1 if x>0), 3=right(x+1 if x<63)
        (block $dir_done
          (block $dir_3
            (block $dir_2
              (block $dir_1
                (block $dir_0
                  local.get $dir
                  br_table $dir_0 $dir_1 $dir_2 $dir_3 $dir_done
                )
                ;; dir 0: up
                local.get $new_y
                i32.const 0
                i32.gt_s
                if
                  local.get $new_y
                  i32.const 1
                  i32.sub
                  local.set $new_y
                end
                br $dir_done
              )
              ;; dir 1: down
              local.get $new_y
              i32.const 63
              i32.lt_s
              if
                local.get $new_y
                i32.const 1
                i32.add
                local.set $new_y
              end
              br $dir_done
            )
            ;; dir 2: left
            local.get $new_x
            i32.const 0
            i32.gt_s
            if
              local.get $new_x
              i32.const 1
              i32.sub
              local.set $new_x
            end
            br $dir_done
          )
          ;; dir 3: right
          local.get $new_x
          i32.const 63
          i32.lt_s
          if
            local.get $new_x
            i32.const 1
            i32.add
            local.set $new_x
          end
          br $dir_done
        )

        ;; check collision across all 128 entities
        (local.set $occupied (i32.const 0))
        (local.set $j (i32.const 0))
        (block $break_collision
          (loop $loop_collision
            local.get $j
            i32.const 128
            i32.ge_s
            br_if $break_collision

            local.get $j
            local.get $entity
            i32.ne
            if
              ;; entities[j*2] == new_x && entities[j*2+1] == new_y
              local.get $j
              i32.const 8
              i32.mul
              i32.load
              local.get $new_x
              i32.eq
              if
                local.get $j
                i32.const 8
                i32.mul
                i32.const 4
                i32.add
                i32.load
                local.get $new_y
                i32.eq
                if
                  i32.const 1
                  local.set $occupied
                  local.get $collisions
                  i32.const 1
                  i32.add
                  local.set $collisions
                  br $break_collision
                end
              end
            end

            local.get $j
            i32.const 1
            i32.add
            local.set $j
            br $loop_collision
          )
        )

        ;; if (!occupied) { entities[entity*2] = new_x; entities[entity*2+1] = new_y; total_moves++; }
        local.get $occupied
        i32.eqz
        if
          local.get $entity
          i32.const 8
          i32.mul
          local.get $new_x
          i32.store

          local.get $entity
          i32.const 8
          i32.mul
          i32.const 4
          i32.add
          local.get $new_y
          i32.store

          local.get $total_moves
          i32.const 1
          i32.add
          local.set $total_moves
        end

        local.get $a
        i32.const 1
        i32.add
        local.set $a
        br $loop_sim
      )
    )

    ;; final_pos_sum = sum(entities[i*2] + entities[i*2+1] * 64)
    (local.set $final_sum (i32.const 0))
    (local.set $i (i32.const 0))
    (block $break_sum
      (loop $loop_sum
        local.get $i
        i32.const 128
        i32.ge_s
        br_if $break_sum

        local.get $final_sum
        local.get $i
        i32.const 8
        i32.mul
        i32.load
        local.get $i
        i32.const 8
        i32.mul
        i32.const 4
        i32.add
        i32.load
        i32.const 6
        i32.shl
        i32.add
        i32.add
        local.set $final_sum

        local.get $i
        i32.const 1
        i32.add
        local.set $i
        br $loop_sum
      )
    )

    ;; Store results to RES_OFFSET (16384)
    i32.const 16384
    local.get $total_moves
    i32.store

    i32.const 16388
    local.get $collisions
    i32.store

    i32.const 16392
    local.get $final_sum
    i32.store

    local.get $final_sum
  )
)
