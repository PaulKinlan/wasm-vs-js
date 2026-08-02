(module
  (memory (export "memory") 32) ;; 32 pages = 2 MB

  ;; Function: scan_literal_wasm
  ;; Scans text buffer for a literal byte pattern and writes matches to out_ptr
  ;; Params:
  ;;   $text_ptr (i32)
  ;;   $text_len (i32)
  ;;   $pat_ptr  (i32)
  ;;   $pat_len  (i32)
  ;;   $out_ptr  (i32)
  ;; Returns:
  ;;   (i32) match_count
  (func (export "scan_literal_wasm")
    (param $text_ptr i32)
    (param $text_len i32)
    (param $pat_ptr i32)
    (param $pat_len i32)
    (param $out_ptr i32)
    (result i32)
    (local $i i32)
    (local $j i32)
    (local $match_count i32)
    (local $cur_out i32)
    (local $found i32)
    (local $text_byte i32)
    (local $pat_byte i32)
    (local $max_idx i32)

    (if (i32.le_s (local.get $pat_len) (i32.const 0))
      (then (return (i32.const 0)))
    )

    (local.set $max_idx (i32.sub (local.get $text_len) (local.get $pat_len)))
    (local.set $match_count (i32.const 0))
    (local.set $cur_out (local.get $out_ptr))
    (local.set $i (i32.const 0))

    (block $break_outer
      (loop $outer_loop
        (br_if $break_outer (i32.gt_s (local.get $i) (local.get $max_idx)))

        (local.set $found (i32.const 1))
        (local.set $j (i32.const 0))

        (block $break_inner
          (loop $inner_loop
            (br_if $break_inner (i32.ge_s (local.get $j) (local.get $pat_len)))

            (local.set $text_byte (i32.load8_u (i32.add (local.get $text_ptr) (i32.add (local.get $i) (local.get $j)))))
            (local.set $pat_byte (i32.load8_u (i32.add (local.get $pat_ptr) (local.get $j))))

            (if (i32.ne (local.get $text_byte) (local.get $pat_byte))
              (then
                (local.set $found (i32.const 0))
                (br $break_inner)
              )
            )

            (local.set $j (i32.add (local.get $j) (i32.const 1)))
            (br $inner_loop)
          )
        )

        (if (local.get $found)
          (then
            ;; Store match tuple: start_cp (i32), end_cp (i32)
            (i32.store (i32.add (local.get $cur_out) (i32.const 0)) (local.get $i))
            (i32.store (i32.add (local.get $cur_out) (i32.const 4)) (i32.add (local.get $i) (local.get $pat_len)))
            (local.set $cur_out (i32.add (local.get $cur_out) (i32.const 8)))
            (local.set $match_count (i32.add (local.get $match_count) (i32.const 1)))
          )
        )

        (local.set $i (i32.add (local.get $i) (i32.const 1)))
        (br $outer_loop)
      )
    )

    (local.get $match_count)
  )
)
