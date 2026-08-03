(module
  (memory (export "memory") 64) ;; 4 MiB: frozen text, DFA tables, and match tuples

  ;; Execute one deterministic automaton produced by subset construction from a
  ;; Thompson NFA. The transition table is state_count x 128 signed i16 values;
  ;; -1 is the dead state. Accept flags are one byte per state. Text is the
  ;; frozen ASCII/UTF-8 common-subset corpus, so byte offsets equal code points.
  (func (export "scan_dfa")
    (param $text_ptr i32) (param $text_len i32)
    (param $table_ptr i32) (param $accept_ptr i32)
    (param $anchor_start i32) (param $anchor_end i32)
    (param $out_ptr i32) (param $out_capacity i32)
    (result i32)
    (local $search i32) (local $cursor i32) (local $state i32)
    (local $code i32) (local $next i32) (local $best i32)
    (local $count i32) (local $valid_end i32)

    (local.set $search (i32.const 0))
    (local.set $count (i32.const 0))
    (block $done
      (loop $search_loop
        (br_if $done (i32.gt_u (local.get $search) (local.get $text_len)))
        (if (local.get $anchor_start)
          (then (br_if $done (i32.gt_u (local.get $search) (i32.const 0)))))
        (local.set $cursor (local.get $search))
        (local.set $state (i32.const 0))
        (local.set $best (i32.const -1))

        ;; Empty-string acceptance is included for completeness, although none
        ;; of the frozen twenty patterns is empty.
        (if (i32.load8_u (i32.add (local.get $accept_ptr) (local.get $state)))
          (then
            (local.set $valid_end (i32.eqz (local.get $anchor_end)))
            (if (local.get $anchor_end)
              (then (local.set $valid_end (call $is_valid_end
                (local.get $text_ptr) (local.get $text_len) (local.get $cursor)))))
            (if (local.get $valid_end) (then (local.set $best (local.get $cursor))))))

        (block $scan_done
          (loop $scan_loop
            (br_if $scan_done (i32.ge_u (local.get $cursor) (local.get $text_len)))
            (local.set $code (i32.load8_u (i32.add (local.get $text_ptr) (local.get $cursor))))
            (br_if $scan_done (i32.ge_u (local.get $code) (i32.const 128)))
            (local.set $next
              (i32.load16_s
                (i32.add (local.get $table_ptr)
                  (i32.shl
                    (i32.add (i32.shl (local.get $state) (i32.const 7)) (local.get $code))
                    (i32.const 1)))))
            (br_if $scan_done (i32.lt_s (local.get $next) (i32.const 0)))
            (local.set $state (local.get $next))
            (local.set $cursor (i32.add (local.get $cursor) (i32.const 1)))
            (if (i32.load8_u (i32.add (local.get $accept_ptr) (local.get $state)))
              (then
                (local.set $valid_end (i32.eqz (local.get $anchor_end)))
                (if (local.get $anchor_end)
                  (then (local.set $valid_end (call $is_valid_end
                    (local.get $text_ptr) (local.get $text_len) (local.get $cursor)))))
                (if (local.get $valid_end) (then (local.set $best (local.get $cursor))))))
            (br $scan_loop)))

        (if (i32.ge_s (local.get $best) (local.get $search))
          (then
            (if (i32.lt_u (local.get $count) (local.get $out_capacity))
              (then
                (i32.store
                  (i32.add (local.get $out_ptr) (i32.shl (local.get $count) (i32.const 3)))
                  (local.get $search))
                (i32.store
                  (i32.add
                    (i32.add (local.get $out_ptr) (i32.shl (local.get $count) (i32.const 3)))
                    (i32.const 4))
                  (local.get $best))))
            (local.set $count (i32.add (local.get $count) (i32.const 1)))
            (if (i32.gt_u (local.get $best) (local.get $search))
              (then (local.set $search (local.get $best)))
              (else (local.set $search (i32.add (local.get $search) (i32.const 1))))))
          (else
            (if (local.get $anchor_start) (then (br $done)))
            (local.set $search (i32.add (local.get $search) (i32.const 1)))))
        (br $search_loop)))
    (local.get $count))

  (func $is_valid_end (param $text_ptr i32) (param $text_len i32) (param $end i32) (result i32)
    (if (i32.eq (local.get $end) (local.get $text_len)) (then (return (i32.const 1))))
    (if (i32.eq (local.get $end) (i32.sub (local.get $text_len) (i32.const 1)))
      (then
        (if (i32.or
          (i32.eq (i32.load8_u (i32.add (local.get $text_ptr) (local.get $end))) (i32.const 10))
          (i32.eq (i32.load8_u (i32.add (local.get $text_ptr) (local.get $end))) (i32.const 13)))
          (then (return (i32.const 1))))))
    (if (i32.eq (local.get $end) (i32.sub (local.get $text_len) (i32.const 2)))
      (then
        (if (i32.and
          (i32.eq (i32.load8_u (i32.add (local.get $text_ptr) (local.get $end))) (i32.const 13))
          (i32.eq (i32.load8_u (i32.add
            (i32.add (local.get $text_ptr) (local.get $end)) (i32.const 1))) (i32.const 10)))
          (then (return (i32.const 1))))))
    (i32.const 0))
)
