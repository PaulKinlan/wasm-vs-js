(module
  (memory (export "memory") 8) ;; 8 pages = 512 KB memory

  ;; Function: diff_vdom_flat
  ;; Parameters:
  ;;   $treeA_ptr (i32) - byte offset of flat Tree A
  ;;   $treeB_ptr (i32) - byte offset of flat Tree B
  ;;   $out_ptr   (i32) - byte offset for output patch buffer
  ;; Returns:
  ;;   (i32) total patches generated
  (func (export "diff_vdom_flat")
    (param $treeA_ptr i32)
    (param $treeB_ptr i32)
    (param $out_ptr i32)
    (result i32)
    (local $countB i32)
    (local $i i32)
    (local $nodeB_offset i32)
    (local $nodeA_offset i32)
    (local $nodeId i32)
    (local $tagA i32)
    (local $tagB i32)
    (local $attrKeyA i32)
    (local $attrValA i32)
    (local $attrKeyB i32)
    (local $attrValB i32)
    (local $textA i32)
    (local $textB i32)
    (local $patch_count i32)
    (local $cur_out i32)

    ;; Read node count from Tree B (u32 at offset 0)
    (local.set $countB (i32.load (local.get $treeB_ptr)))
    (local.set $patch_count (i32.const 0))
    (local.set $cur_out (local.get $out_ptr))

    (local.set $i (i32.const 0))
    (block $break_loop
      (loop $top_loop
        (br_if $break_loop (i32.ge_u (local.get $i) (local.get $countB)))

        ;; Compute byte offset of node B: treeB_ptr + 4 + i * 16
        (local.set $nodeB_offset 
          (i32.add 
            (i32.add (local.get $treeB_ptr) (i32.const 4))
            (i32.shl (local.get $i) (i32.const 4))
          )
        )

        ;; Compute corresponding node A offset (for matching node ID)
        (local.set $nodeA_offset 
          (i32.add 
            (i32.add (local.get $treeA_ptr) (i32.const 4))
            (i32.shl (local.get $i) (i32.const 4))
          )
        )

        ;; Read tags and attributes
        (local.set $nodeId (i32.load16_u (i32.add (local.get $nodeB_offset) (i32.const 0))))
        (local.set $tagA (i32.load16_s (i32.add (local.get $nodeA_offset) (i32.const 2))))
        (local.set $tagB (i32.load16_s (i32.add (local.get $nodeB_offset) (i32.const 2))))

        ;; Check if text node and text changed
        (if (i32.and (i32.eq (local.get $tagA) (i32.const -1)) (i32.eq (local.get $tagB) (i32.const -1)))
          (then
            (local.set $textA (i32.load16_s (i32.add (local.get $nodeA_offset) (i32.const 10))))
            (local.set $textB (i32.load16_s (i32.add (local.get $nodeB_offset) (i32.const 10))))
            (if (i32.ne (local.get $textA) (local.get $textB))
              (then
                ;; Write SET_TEXT patch (op: 1, nodeId: nodeId, val: textB)
                (i32.store16 (i32.add (local.get $cur_out) (i32.const 0)) (i32.const 1)) ;; op
                (i32.store16 (i32.add (local.get $cur_out) (i32.const 2)) (local.get $nodeId)) ;; nodeId
                (i32.store16 (i32.add (local.get $cur_out) (i32.const 4)) (local.get $textB)) ;; targetVal
                (local.set $cur_out (i32.add (local.get $cur_out) (i32.const 8)))
                (local.set $patch_count (i32.add (local.get $patch_count) (i32.const 1)))
              )
            )
          )
          (else
            ;; Check attribute change
            (local.set $attrKeyA (i32.load16_s (i32.add (local.get $nodeA_offset) (i32.const 6))))
            (local.set $attrValA (i32.load16_s (i32.add (local.get $nodeA_offset) (i32.const 8))))
            (local.set $attrKeyB (i32.load16_s (i32.add (local.get $nodeB_offset) (i32.const 6))))
            (local.set $attrValB (i32.load16_s (i32.add (local.get $nodeB_offset) (i32.const 8))))

            (if (i32.or (i32.ne (local.get $attrKeyA) (local.get $attrKeyB)) (i32.ne (local.get $attrValA) (local.get $attrValB)))
              (then
                ;; Write SET_ATTR patch (op: 2, nodeId: nodeId, attrKey: keyB, attrVal: valB)
                (i32.store16 (i32.add (local.get $cur_out) (i32.const 0)) (i32.const 2)) ;; op
                (i32.store16 (i32.add (local.get $cur_out) (i32.const 2)) (local.get $nodeId))
                (i32.store16 (i32.add (local.get $cur_out) (i32.const 4)) (local.get $attrKeyB))
                (i32.store16 (i32.add (local.get $cur_out) (i32.const 6)) (local.get $attrValB))
                (local.set $cur_out (i32.add (local.get $cur_out) (i32.const 8)))
                (local.set $patch_count (i32.add (local.get $patch_count) (i32.const 1)))
              )
            )
          )
        )

        (local.set $i (i32.add (local.get $i) (i32.const 1)))
        (br $top_loop)
      )
    )

    (local.get $patch_count)
  )
)
