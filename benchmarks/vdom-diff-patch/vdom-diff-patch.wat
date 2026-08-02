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
    (local $c i32)
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
    (local $childCountA i32)
    (local $childCountB i32)
    (local $childOffA i32)
    (local $childOffB i32)
    (local $childrenMatch i32)
    (local $childA i32)
    (local $childB i32)
    (local $childBaseA i32)
    (local $childBaseB i32)
    (local $patch_count i32)
    (local $cur_out i32)
    (local $nodesA_count i32)

    (local.set $nodesA_count (i32.load (local.get $treeA_ptr)))
    (local.set $countB (i32.load (local.get $treeB_ptr)))
    (local.set $patch_count (i32.const 0))
    (local.set $cur_out (local.get $out_ptr))

    ;; Compute base offsets for child array buffers
    ;; childBase = tree_ptr + 4 + count * 16
    (local.set $childBaseA (i32.add (local.get $treeA_ptr) (i32.add (i32.const 4) (i32.shl (local.get $nodesA_count) (i32.const 4)))))
    (local.set $childBaseB (i32.add (local.get $treeB_ptr) (i32.add (i32.const 4) (i32.shl (local.get $countB) (i32.const 4)))))

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

        ;; Compute corresponding node A offset
        (local.set $nodeA_offset 
          (i32.add 
            (i32.add (local.get $treeA_ptr) (i32.const 4))
            (i32.shl (local.get $i) (i32.const 4))
          )
        )

        ;; Read tags and node ID
        (local.set $nodeId (i32.load16_u (i32.add (local.get $nodeB_offset) (i32.const 0))))
        (local.set $tagA (i32.load16_s (i32.add (local.get $nodeA_offset) (i32.const 2))))
        (local.set $tagB (i32.load16_s (i32.add (local.get $nodeB_offset) (i32.const 2))))

        ;; Check text node change
        (if (i32.and (i32.eq (local.get $tagA) (i32.const -1)) (i32.eq (local.get $tagB) (i32.const -1)))
          (then
            (local.set $textA (i32.load16_s (i32.add (local.get $nodeA_offset) (i32.const 10))))
            (local.set $textB (i32.load16_s (i32.add (local.get $nodeB_offset) (i32.const 10))))
            (if (i32.ne (local.get $textA) (local.get $textB))
              (then
                ;; Write SET_TEXT patch (op: 1, nodeId: nodeId, targetId/val: textB)
                (i32.store16 (i32.add (local.get $cur_out) (i32.const 0)) (i32.const 1))
                (i32.store16 (i32.add (local.get $cur_out) (i32.const 2)) (local.get $nodeId))
                (i32.store16 (i32.add (local.get $cur_out) (i32.const 4)) (local.get $textB))
                (i32.store16 (i32.add (local.get $cur_out) (i32.const 6)) (i32.const -1))
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
                (i32.store16 (i32.add (local.get $cur_out) (i32.const 0)) (i32.const 2))
                (i32.store16 (i32.add (local.get $cur_out) (i32.const 2)) (local.get $nodeId))
                (i32.store16 (i32.add (local.get $cur_out) (i32.const 4)) (local.get $attrKeyB))
                (i32.store16 (i32.add (local.get $cur_out) (i32.const 6)) (local.get $attrValB))
                (local.set $cur_out (i32.add (local.get $cur_out) (i32.const 8)))
                (local.set $patch_count (i32.add (local.get $patch_count) (i32.const 1)))
              )
            )

            ;; Check child list reorder / change
            (local.set $childCountA (i32.load16_u (i32.add (local.get $nodeA_offset) (i32.const 12))))
            (local.set $childCountB (i32.load16_u (i32.add (local.get $nodeB_offset) (i32.const 12))))
            (local.set $childOffA (i32.load16_u (i32.add (local.get $nodeA_offset) (i32.const 14))))
            (local.set $childOffB (i32.load16_u (i32.add (local.get $nodeB_offset) (i32.const 14))))

            (local.set $childrenMatch (i32.const 1))
            (if (i32.ne (local.get $childCountA) (local.get $childCountB))
              (then (local.set $childrenMatch (i32.const 0)))
              (else
                (local.set $c (i32.const 0))
                (block $break_children
                  (loop $child_loop
                    (br_if $break_children (i32.ge_u (local.get $c) (local.get $childCountA)))

                    (local.set $childA (i32.load16_u (i32.add (local.get $childBaseA) (i32.shl (i32.add (local.get $childOffA) (local.get $c)) (i32.const 1)))))
                    (local.set $childB (i32.load16_u (i32.add (local.get $childBaseB) (i32.shl (i32.add (local.get $childOffB) (local.get $c)) (i32.const 1)))))

                    (if (i32.ne (local.get $childA) (local.get $childB))
                      (then
                        (local.set $childrenMatch (i32.const 0))
                        (br $break_children)
                      )
                    )

                    (local.set $c (i32.add (local.get $c) (i32.const 1)))
                    (br $child_loop)
                  )
                )
              )
            )

            (if (i32.eq (local.get $childrenMatch) (i32.const 0))
              (then
                ;; Write REORDER_CHILDREN patch (op: 6, nodeId: nodeId, targetId: childCountB)
                (i32.store16 (i32.add (local.get $cur_out) (i32.const 0)) (i32.const 6))
                (i32.store16 (i32.add (local.get $cur_out) (i32.const 2)) (local.get $nodeId))
                (i32.store16 (i32.add (local.get $cur_out) (i32.const 4)) (local.get $childCountB))
                (i32.store16 (i32.add (local.get $cur_out) (i32.const 6)) (i32.const -1))
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
