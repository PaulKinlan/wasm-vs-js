(module
  (memory (export "memory") 8)

  ;; Produce self-contained 24-byte patch records from two flat VDOM arrays.
  ;; Record: op,nodeId,targetId,attrKey,attrVal,index (i16), childPtr (u32),
  ;; nodePtr (u32), reserved (u32). Pointers identify data captured from tree B;
  ;; the JS boundary decoder copies that data into the independent patch value.
  (func (export "diff_vdom_flat")
    (param $a i32) (param $b i32) (param $out i32) (result i32)
    (local $countA i32) (local $countB i32) (local $baseA i32) (local $baseB i32)
    (local $childrenA i32) (local $childrenB i32)
    (local $i i32) (local $j i32) (local $nodeA i32) (local $nodeB i32)
    (local $idA i32) (local $idB i32) (local $tagA i32) (local $tagB i32)
    (local $keyA i32) (local $keyB i32) (local $attrA i32) (local $attrB i32)
    (local $valA i32) (local $valB i32) (local $textA i32) (local $textB i32)
    (local $lenA i32) (local $lenB i32) (local $offA i32) (local $offB i32)
    (local $same i32) (local $records i32) (local $record i32) (local $replace i32)
    (local $k i32) (local $found i32)

    (local.set $countA (i32.load (local.get $a)))
    (local.set $countB (i32.load (local.get $b)))
    (local.set $baseA (i32.add (local.get $a) (i32.const 4)))
    (local.set $baseB (i32.add (local.get $b) (i32.const 4)))
    (local.set $childrenA (i32.add (local.get $baseA) (i32.shl (local.get $countA) (i32.const 4))))
    (local.set $childrenB (i32.add (local.get $baseB) (i32.shl (local.get $countB) (i32.const 4))))

    ;; Visit every target node.
    (local.set $i (i32.const 0))
    (block $target_done
      (loop $target
        (br_if $target_done (i32.ge_u (local.get $i) (local.get $countB)))
        (local.set $nodeB (i32.add (local.get $baseB) (i32.shl (local.get $i) (i32.const 4))))
        (local.set $idB (i32.load16_u (local.get $nodeB)))
        ;; Locate the source node by stable ID; array positions may differ after
        ;; insertion/removal probes.
        (local.set $found (i32.const 0))
        (local.set $k (i32.const 0))
        (block $source_search_done
          (loop $source_search
            (br_if $source_search_done (i32.ge_u (local.get $k) (local.get $countA)))
            (local.set $nodeA (i32.add (local.get $baseA) (i32.shl (local.get $k) (i32.const 4))))
            (if (i32.eq (i32.load16_u (local.get $nodeA)) (local.get $idB))
              (then (local.set $found (i32.const 1)) (br $source_search_done)))
            (local.set $k (i32.add (local.get $k) (i32.const 1)))
            (br $source_search)))
        (local.set $replace (i32.eqz (local.get $found)))
        (if (local.get $found)
          (then
            (local.set $tagA (i32.load16_s (i32.add (local.get $nodeA) (i32.const 2))))
            (local.set $tagB (i32.load16_s (i32.add (local.get $nodeB) (i32.const 2))))
            (local.set $keyA (i32.load16_s (i32.add (local.get $nodeA) (i32.const 4))))
            (local.set $keyB (i32.load16_s (i32.add (local.get $nodeB) (i32.const 4))))
            (if (i32.or (i32.ne (local.get $tagA) (local.get $tagB))
                        (i32.ne (local.get $keyA) (local.get $keyB)))
              (then (local.set $replace (i32.const 1))))))

        (if (local.get $replace)
          (then
            (local.set $lenB (i32.load16_u (i32.add (local.get $nodeB) (i32.const 12))))
            (local.set $offB (i32.load16_u (i32.add (local.get $nodeB) (i32.const 14))))
            (local.set $record (i32.add (local.get $out) (i32.mul (local.get $records) (i32.const 24))))
            (i32.store16 (local.get $record) (i32.const 7))
            (i32.store16 (i32.add (local.get $record) (i32.const 2)) (local.get $idB))
            (i32.store16 (i32.add (local.get $record) (i32.const 4)) (local.get $idB))
            (i32.store16 (i32.add (local.get $record) (i32.const 6))
              (i32.load16_s (i32.add (local.get $nodeB) (i32.const 6))))
            (i32.store16 (i32.add (local.get $record) (i32.const 8))
              (i32.load16_s (i32.add (local.get $nodeB) (i32.const 8))))
            (i32.store16 (i32.add (local.get $record) (i32.const 10)) (i32.const -1))
            (i32.store (i32.add (local.get $record) (i32.const 12))
              (i32.add (local.get $childrenB) (i32.shl (local.get $offB) (i32.const 1))))
            (i32.store (i32.add (local.get $record) (i32.const 16)) (local.get $nodeB))
            (local.set $records (i32.add (local.get $records) (i32.const 1))))
          (else
            (if (i32.eq (local.get $tagB) (i32.const -1))
              (then
                (local.set $textA (i32.load16_s (i32.add (local.get $nodeA) (i32.const 10))))
                (local.set $textB (i32.load16_s (i32.add (local.get $nodeB) (i32.const 10))))
                (if (i32.ne (local.get $textA) (local.get $textB))
                  (then
                    (local.set $record (i32.add (local.get $out) (i32.mul (local.get $records) (i32.const 24))))
                    (i32.store16 (local.get $record) (i32.const 1))
                    (i32.store16 (i32.add (local.get $record) (i32.const 2)) (local.get $idB))
                    (i32.store16 (i32.add (local.get $record) (i32.const 4)) (local.get $textB))
                    (i32.store16 (i32.add (local.get $record) (i32.const 6)) (i32.const -1))
                    (i32.store16 (i32.add (local.get $record) (i32.const 8)) (i32.const -1))
                    (i32.store16 (i32.add (local.get $record) (i32.const 10)) (i32.const -1))
                    (local.set $records (i32.add (local.get $records) (i32.const 1))))))
              (else
                (local.set $attrA (i32.load16_s (i32.add (local.get $nodeA) (i32.const 6))))
                (local.set $attrB (i32.load16_s (i32.add (local.get $nodeB) (i32.const 6))))
                (local.set $valA (i32.load16_s (i32.add (local.get $nodeA) (i32.const 8))))
                (local.set $valB (i32.load16_s (i32.add (local.get $nodeB) (i32.const 8))))
                (if (i32.or (i32.ne (local.get $attrA) (local.get $attrB))
                            (i32.ne (local.get $valA) (local.get $valB)))
                  (then
                    (local.set $record (i32.add (local.get $out) (i32.mul (local.get $records) (i32.const 24))))
                    (if (i32.lt_s (local.get $attrB) (i32.const 0))
                      (then
                        (i32.store16 (local.get $record) (i32.const 3))
                        (i32.store16 (i32.add (local.get $record) (i32.const 6)) (local.get $attrA))
                        (i32.store16 (i32.add (local.get $record) (i32.const 8)) (i32.const -1)))
                      (else
                        (i32.store16 (local.get $record) (i32.const 2))
                        (i32.store16 (i32.add (local.get $record) (i32.const 6)) (local.get $attrB))
                        (i32.store16 (i32.add (local.get $record) (i32.const 8)) (local.get $valB))))
                    (i32.store16 (i32.add (local.get $record) (i32.const 2)) (local.get $idB))
                    (i32.store16 (i32.add (local.get $record) (i32.const 4)) (i32.const -1))
                    (i32.store16 (i32.add (local.get $record) (i32.const 10)) (i32.const -1))
                    (local.set $records (i32.add (local.get $records) (i32.const 1)))))

                (local.set $lenA (i32.load16_u (i32.add (local.get $nodeA) (i32.const 12))))
                (local.set $lenB (i32.load16_u (i32.add (local.get $nodeB) (i32.const 12))))
                (local.set $offA (i32.load16_u (i32.add (local.get $nodeA) (i32.const 14))))
                (local.set $offB (i32.load16_u (i32.add (local.get $nodeB) (i32.const 14))))
                (local.set $same (i32.eq (local.get $lenA) (local.get $lenB)))
                (local.set $j (i32.const 0))
                (block $children_done
                  (loop $children
                    (br_if $children_done (i32.or (i32.eqz (local.get $same))
                                                  (i32.ge_u (local.get $j) (local.get $lenA))))
                    (if (i32.ne
                      (i32.load16_u (i32.add (local.get $childrenA)
                        (i32.shl (i32.add (local.get $offA) (local.get $j)) (i32.const 1))))
                      (i32.load16_u (i32.add (local.get $childrenB)
                        (i32.shl (i32.add (local.get $offB) (local.get $j)) (i32.const 1)))))
                      (then (local.set $same (i32.const 0))))
                    (local.set $j (i32.add (local.get $j) (i32.const 1)))
                    (br $children)))
                (if (i32.eqz (local.get $same))
                  (then
                    (local.set $record (i32.add (local.get $out) (i32.mul (local.get $records) (i32.const 24))))
                    (i32.store16 (local.get $record) (i32.const 6))
                    (i32.store16 (i32.add (local.get $record) (i32.const 2)) (local.get $idB))
                    (i32.store16 (i32.add (local.get $record) (i32.const 4)) (local.get $lenB))
                    (i32.store16 (i32.add (local.get $record) (i32.const 6)) (i32.const -1))
                    (i32.store16 (i32.add (local.get $record) (i32.const 8)) (i32.const -1))
                    (i32.store16 (i32.add (local.get $record) (i32.const 10)) (local.get $lenB))
                    (i32.store (i32.add (local.get $record) (i32.const 12))
                      (i32.add (local.get $childrenB) (i32.shl (local.get $offB) (i32.const 1))))
                    (local.set $records (i32.add (local.get $records) (i32.const 1)))))))))
        (local.set $i (i32.add (local.get $i) (i32.const 1)))
        (br $target)))

    ;; Emit explicit removals for every source ID absent from the target.
    (local.set $i (i32.const 0))
    (block $remove_done
      (loop $remove
        (br_if $remove_done (i32.ge_u (local.get $i) (local.get $countA)))
        (local.set $nodeA (i32.add (local.get $baseA) (i32.shl (local.get $i) (i32.const 4))))
        (local.set $idA (i32.load16_u (local.get $nodeA)))
        (local.set $found (i32.const 0))
        (local.set $k (i32.const 0))
        (block $target_search_done
          (loop $target_search
            (br_if $target_search_done (i32.ge_u (local.get $k) (local.get $countB)))
            (local.set $nodeB (i32.add (local.get $baseB) (i32.shl (local.get $k) (i32.const 4))))
            (if (i32.eq (i32.load16_u (local.get $nodeB)) (local.get $idA))
              (then (local.set $found (i32.const 1)) (br $target_search_done)))
            (local.set $k (i32.add (local.get $k) (i32.const 1)))
            (br $target_search)))
        (if (i32.eqz (local.get $found))
          (then
            (local.set $record (i32.add (local.get $out) (i32.mul (local.get $records) (i32.const 24))))
            (i32.store16 (local.get $record) (i32.const 5))
            (i32.store16 (i32.add (local.get $record) (i32.const 2)) (local.get $idA))
            (i32.store16 (i32.add (local.get $record) (i32.const 4)) (local.get $idA))
            (i32.store16 (i32.add (local.get $record) (i32.const 6)) (i32.const -1))
            (i32.store16 (i32.add (local.get $record) (i32.const 8)) (i32.const -1))
            (i32.store16 (i32.add (local.get $record) (i32.const 10)) (i32.const -1))
            (local.set $records (i32.add (local.get $records) (i32.const 1)))))
        (local.set $i (i32.add (local.get $i) (i32.const 1)))
        (br $remove)))
    (local.get $records))
)
