(module
  (memory (export "memory") 256)
  ;; Authored linear-Wasm Myers O(ND) line diff. Inputs are interned u32 line
  ;; IDs. Output records are four little-endian i32 fields:
  ;; kind (0 equal, 1 delete, 2 insert), base index, target index, line ID.
  ;; meta[0]=edit distance, meta[1]=frontier steps, meta[2]=operation count.
  (func $emit (param $out i32) (param $index i32) (param $kind i32)
    (param $ai i32) (param $bi i32) (param $line i32)
    (local $p i32)
    (local.set $p (i32.add (local.get $out) (i32.mul (local.get $index) (i32.const 16))))
    (i32.store (local.get $p) (local.get $kind))
    (i32.store offset=4 (local.get $p) (local.get $ai))
    (i32.store offset=8 (local.get $p) (local.get $bi))
    (i32.store offset=12 (local.get $p) (local.get $line)))

  (func $diff_myers (export "diff_myers")
    (param $a i32) (param $alen i32) (param $b i32) (param $blen i32)
    (param $out i32) (param $frontier i32) (param $trace i32) (param $meta i32)
    (result i32)
    (local $prefix i32) (local $suffix i32) (local $n i32) (local $m i32)
    (local $max i32) (local $width i32) (local $offset i32)
    (local $d i32) (local $k i32) (local $x i32) (local $y i32)
    (local $prevx i32) (local $prevy i32) (local $prevk i32)
    (local $down i32) (local $done i32) (local $steps i32)
    (local $ops i32) (local $i i32) (local $p i32) (local $q i32)
    (local $t0 i32) (local $t1 i32) (local $t2 i32) (local $t3 i32)

    ;; Trim common prefix and suffix before running the same Myers frontier.
    (block $prefixDone
      (loop $prefixLoop
        (br_if $prefixDone (i32.ge_u (local.get $prefix) (local.get $alen)))
        (br_if $prefixDone (i32.ge_u (local.get $prefix) (local.get $blen)))
        (br_if $prefixDone
          (i32.ne
            (i32.load (i32.add (local.get $a) (i32.mul (local.get $prefix) (i32.const 4))))
            (i32.load (i32.add (local.get $b) (i32.mul (local.get $prefix) (i32.const 4))))))
        (local.set $prefix (i32.add (local.get $prefix) (i32.const 1)))
        (br $prefixLoop)))
    (block $suffixDone
      (loop $suffixLoop
        (br_if $suffixDone (i32.ge_u (local.get $suffix) (i32.sub (local.get $alen) (local.get $prefix))))
        (br_if $suffixDone (i32.ge_u (local.get $suffix) (i32.sub (local.get $blen) (local.get $prefix))))
        (br_if $suffixDone
          (i32.ne
            (i32.load (i32.add (local.get $a) (i32.mul (i32.sub (i32.sub (local.get $alen) (i32.const 1)) (local.get $suffix)) (i32.const 4))))
            (i32.load (i32.add (local.get $b) (i32.mul (i32.sub (i32.sub (local.get $blen) (i32.const 1)) (local.get $suffix)) (i32.const 4))))))
        (local.set $suffix (i32.add (local.get $suffix) (i32.const 1)))
        (br $suffixLoop)))
    (local.set $n (i32.sub (i32.sub (local.get $alen) (local.get $prefix)) (local.get $suffix)))
    (local.set $m (i32.sub (i32.sub (local.get $blen) (local.get $prefix)) (local.get $suffix)))

    ;; Reverse output begins with the common suffix.
    (local.set $i (i32.const 0))
    (block $suffixEmitDone
      (loop $suffixEmit
        (br_if $suffixEmitDone (i32.ge_u (local.get $i) (local.get $suffix)))
        (local.set $x (i32.sub (i32.sub (local.get $alen) (i32.const 1)) (local.get $i)))
        (local.set $y (i32.sub (i32.sub (local.get $blen) (i32.const 1)) (local.get $i)))
        (call $emit (local.get $out) (local.get $ops) (i32.const 0) (local.get $x) (local.get $y)
          (i32.load (i32.add (local.get $a) (i32.mul (local.get $x) (i32.const 4)))))
        (local.set $ops (i32.add (local.get $ops) (i32.const 1)))
        (local.set $i (i32.add (local.get $i) (i32.const 1)))
        (br $suffixEmit)))

    (if (i32.eqz (local.get $n))
      (then
        (local.set $d (local.get $m))
        (local.set $i (local.get $m))
        (block $insertDone (loop $insertLoop
          (br_if $insertDone (i32.eqz (local.get $i)))
          (local.set $i (i32.sub (local.get $i) (i32.const 1)))
          (local.set $y (i32.add (local.get $prefix) (local.get $i)))
          (call $emit (local.get $out) (local.get $ops) (i32.const 2) (local.get $prefix) (local.get $y)
            (i32.load (i32.add (local.get $b) (i32.mul (local.get $y) (i32.const 4)))))
          (local.set $ops (i32.add (local.get $ops) (i32.const 1)))
          (br $insertLoop))))
      (else (if (i32.eqz (local.get $m))
        (then
          (local.set $d (local.get $n))
          (local.set $i (local.get $n))
          (block $deleteDone (loop $deleteLoop
            (br_if $deleteDone (i32.eqz (local.get $i)))
            (local.set $i (i32.sub (local.get $i) (i32.const 1)))
            (local.set $x (i32.add (local.get $prefix) (local.get $i)))
            (call $emit (local.get $out) (local.get $ops) (i32.const 1) (local.get $x) (local.get $prefix)
              (i32.load (i32.add (local.get $a) (i32.mul (local.get $x) (i32.const 4)))))
            (local.set $ops (i32.add (local.get $ops) (i32.const 1)))
            (br $deleteLoop))))
        (else
          (local.set $max (i32.add (local.get $n) (local.get $m)))
          (local.set $width (i32.add (i32.mul (local.get $max) (i32.const 2)) (i32.const 1)))
          (local.set $offset (local.get $max))
          (i32.store
            (i32.add (local.get $frontier) (i32.mul (i32.add (local.get $offset) (i32.const 1)) (i32.const 4)))
            (i32.const 0))
          (block $searchDone
            (loop $dLoop
              (local.set $k (i32.sub (i32.const 0) (local.get $d)))
              (block $kDone (loop $kLoop
                (br_if $kDone (i32.gt_s (local.get $k) (local.get $d)))
                (local.set $steps (i32.add (local.get $steps) (i32.const 1)))
                (local.set $down
                  (i32.or
                    (i32.eq (local.get $k) (i32.sub (i32.const 0) (local.get $d)))
                    (i32.and
                      (i32.ne (local.get $k) (local.get $d))
                      (i32.lt_s
                        (i32.load (i32.add (local.get $frontier) (i32.mul (i32.sub (i32.add (local.get $offset) (local.get $k)) (i32.const 1)) (i32.const 4))))
                        (i32.load (i32.add (local.get $frontier) (i32.mul (i32.add (i32.add (local.get $offset) (local.get $k)) (i32.const 1)) (i32.const 4))))))))
                (if (local.get $down)
                  (then (local.set $x (i32.load (i32.add (local.get $frontier) (i32.mul (i32.add (i32.add (local.get $offset) (local.get $k)) (i32.const 1)) (i32.const 4))))))
                  (else (local.set $x (i32.add (i32.load (i32.add (local.get $frontier) (i32.mul (i32.sub (i32.add (local.get $offset) (local.get $k)) (i32.const 1)) (i32.const 4)))) (i32.const 1)))))
                (local.set $y (i32.sub (local.get $x) (local.get $k)))
                (block $snakeDone (loop $snake
                  (br_if $snakeDone (i32.ge_u (local.get $x) (local.get $n)))
                  (br_if $snakeDone (i32.ge_u (local.get $y) (local.get $m)))
                  (br_if $snakeDone
                    (i32.ne
                      (i32.load (i32.add (local.get $a) (i32.mul (i32.add (local.get $prefix) (local.get $x)) (i32.const 4))))
                      (i32.load (i32.add (local.get $b) (i32.mul (i32.add (local.get $prefix) (local.get $y)) (i32.const 4))))))
                  (local.set $x (i32.add (local.get $x) (i32.const 1)))
                  (local.set $y (i32.add (local.get $y) (i32.const 1)))
                  (br $snake)))
                (i32.store (i32.add (local.get $frontier) (i32.mul (i32.add (local.get $offset) (local.get $k)) (i32.const 4))) (local.get $x))
                (if (i32.and (i32.ge_u (local.get $x) (local.get $n)) (i32.ge_u (local.get $y) (local.get $m)))
                  (then (local.set $done (i32.const 1))))
                (br_if $kDone (local.get $done))
                (local.set $k (i32.add (local.get $k) (i32.const 2)))
                (br $kLoop)))
              ;; Fixed-width trace is deterministic retained frontier storage.
              (local.set $i (i32.const 0))
              (block $copyDone (loop $copy
                (br_if $copyDone (i32.ge_u (local.get $i) (local.get $width)))
                (i32.store
                  (i32.add (local.get $trace) (i32.mul (i32.add (i32.mul (local.get $d) (local.get $width)) (local.get $i)) (i32.const 4)))
                  (i32.load (i32.add (local.get $frontier) (i32.mul (local.get $i) (i32.const 4)))))
                (local.set $i (i32.add (local.get $i) (i32.const 1)))
                (br $copy)))
              (br_if $searchDone (local.get $done))
              (local.set $d (i32.add (local.get $d) (i32.const 1)))
              (br $dLoop)))
          ;; Backtrack through the authored Wasm trace.
          (local.set $x (local.get $n)) (local.set $y (local.get $m))
          (block $backDone (loop $back
            (br_if $backDone (i32.eqz (local.get $d)))
            (local.set $k (i32.sub (local.get $x) (local.get $y)))
            (local.set $p (i32.add (local.get $trace) (i32.mul (i32.mul (i32.sub (local.get $d) (i32.const 1)) (local.get $width)) (i32.const 4))))
            (local.set $down
              (i32.or (i32.eq (local.get $k) (i32.sub (i32.const 0) (local.get $d)))
                (i32.and (i32.ne (local.get $k) (local.get $d))
                  (i32.lt_s
                    (i32.load (i32.add (local.get $p) (i32.mul (i32.sub (i32.add (local.get $offset) (local.get $k)) (i32.const 1)) (i32.const 4))))
                    (i32.load (i32.add (local.get $p) (i32.mul (i32.add (i32.add (local.get $offset) (local.get $k)) (i32.const 1)) (i32.const 4))))))))
            (local.set $prevk (select (i32.add (local.get $k) (i32.const 1)) (i32.sub (local.get $k) (i32.const 1)) (local.get $down)))
            (local.set $prevx (i32.load (i32.add (local.get $p) (i32.mul (i32.add (local.get $offset) (local.get $prevk)) (i32.const 4)))))
            (local.set $prevy (i32.sub (local.get $prevx) (local.get $prevk)))
            (block $backSnakeDone (loop $backSnake
              (br_if $backSnakeDone (i32.le_s (local.get $x) (local.get $prevx)))
              (br_if $backSnakeDone (i32.le_s (local.get $y) (local.get $prevy)))
              (local.set $x (i32.sub (local.get $x) (i32.const 1)))
              (local.set $y (i32.sub (local.get $y) (i32.const 1)))
              (call $emit (local.get $out) (local.get $ops) (i32.const 0)
                (i32.add (local.get $prefix) (local.get $x)) (i32.add (local.get $prefix) (local.get $y))
                (i32.load (i32.add (local.get $a) (i32.mul (i32.add (local.get $prefix) (local.get $x)) (i32.const 4)))))
              (local.set $ops (i32.add (local.get $ops) (i32.const 1)))
              (br $backSnake)))
            (if (local.get $down)
              (then
                (local.set $y (i32.sub (local.get $y) (i32.const 1)))
                (call $emit (local.get $out) (local.get $ops) (i32.const 2)
                  (i32.add (local.get $prefix) (local.get $x)) (i32.add (local.get $prefix) (local.get $y))
                  (i32.load (i32.add (local.get $b) (i32.mul (i32.add (local.get $prefix) (local.get $y)) (i32.const 4))))))
              (else
                (local.set $x (i32.sub (local.get $x) (i32.const 1)))
                (call $emit (local.get $out) (local.get $ops) (i32.const 1)
                  (i32.add (local.get $prefix) (local.get $x)) (i32.add (local.get $prefix) (local.get $y))
                  (i32.load (i32.add (local.get $a) (i32.mul (i32.add (local.get $prefix) (local.get $x)) (i32.const 4)))))))
            (local.set $ops (i32.add (local.get $ops) (i32.const 1)))
            (local.set $d (i32.sub (local.get $d) (i32.const 1)))
            (br $back)))))))

    ;; Prefix completes reverse output.
    (local.set $i (local.get $prefix))
    (block $prefixEmitDone (loop $prefixEmit
      (br_if $prefixEmitDone (i32.eqz (local.get $i)))
      (local.set $i (i32.sub (local.get $i) (i32.const 1)))
      (call $emit (local.get $out) (local.get $ops) (i32.const 0) (local.get $i) (local.get $i)
        (i32.load (i32.add (local.get $a) (i32.mul (local.get $i) (i32.const 4)))))
      (local.set $ops (i32.add (local.get $ops) (i32.const 1)))
      (br $prefixEmit)))

    ;; Reverse 16-byte records in place to canonical forward order.
    (local.set $i (i32.const 0))
    (block $reverseDone (loop $reverse
      (br_if $reverseDone (i32.ge_u (local.get $i) (i32.div_u (local.get $ops) (i32.const 2))))
      (local.set $p (i32.add (local.get $out) (i32.mul (local.get $i) (i32.const 16))))
      (local.set $q (i32.add (local.get $out) (i32.mul (i32.sub (i32.sub (local.get $ops) (i32.const 1)) (local.get $i)) (i32.const 16))))
      (local.set $t0 (i32.load (local.get $p))) (local.set $t1 (i32.load offset=4 (local.get $p)))
      (local.set $t2 (i32.load offset=8 (local.get $p))) (local.set $t3 (i32.load offset=12 (local.get $p)))
      (i32.store (local.get $p) (i32.load (local.get $q))) (i32.store offset=4 (local.get $p) (i32.load offset=4 (local.get $q)))
      (i32.store offset=8 (local.get $p) (i32.load offset=8 (local.get $q))) (i32.store offset=12 (local.get $p) (i32.load offset=12 (local.get $q)))
      (i32.store (local.get $q) (local.get $t0)) (i32.store offset=4 (local.get $q) (local.get $t1))
      (i32.store offset=8 (local.get $q) (local.get $t2)) (i32.store offset=12 (local.get $q) (local.get $t3))
      (local.set $i (i32.add (local.get $i) (i32.const 1))) (br $reverse)))
    (i32.store (local.get $meta) (local.get $d))
    ;; d was consumed by backtracking; derive edit distance from non-equal ops.
    (local.set $i (i32.const 0)) (local.set $d (i32.const 0))
    (block $countDone (loop $count
      (br_if $countDone (i32.ge_u (local.get $i) (local.get $ops)))
      (if (i32.ne (i32.load (i32.add (local.get $out) (i32.mul (local.get $i) (i32.const 16)))) (i32.const 0))
        (then (local.set $d (i32.add (local.get $d) (i32.const 1)))))
      (local.set $i (i32.add (local.get $i) (i32.const 1))) (br $count)))
    (i32.store (local.get $meta) (local.get $d))
    (i32.store offset=4 (local.get $meta) (local.get $steps))
    (i32.store offset=8 (local.get $meta) (local.get $ops))
    (local.get $ops))

  (global $internNext (mut i32) (i32.const 0))

  (func $lineHash (param $p i32) (param $n i32) (result i32)
    (local $i i32) (local $h i32)
    (local.set $h (i32.const 0x811c9dc5))
    (block $done (loop $loop
      (br_if $done (i32.ge_u (local.get $i) (local.get $n)))
      (local.set $h (i32.mul (i32.xor (local.get $h) (i32.load8_u (i32.add (local.get $p) (local.get $i)))) (i32.const 0x01000193)))
      (local.set $i (i32.add (local.get $i) (i32.const 1)))
      (br $loop)))
    (local.get $h))

  (func $bytesEqual (param $a i32) (param $b i32) (param $n i32) (result i32)
    (local $i i32)
    (block $done (loop $loop
      (br_if $done (i32.ge_u (local.get $i) (local.get $n)))
      (if (i32.ne (i32.load8_u (i32.add (local.get $a) (local.get $i))) (i32.load8_u (i32.add (local.get $b) (local.get $i))))
        (then (return (i32.const 0))))
      (local.set $i (i32.add (local.get $i) (i32.const 1)))
      (br $loop)))
    (i32.const 1))

  ;; Open-addressed, collision-checked UTF-8 line interning. Each 16-byte
  ;; entry stores id/hash/source-pointer/byte-length.
  (func $intern (param $line i32) (param $len i32) (param $table i32) (param $cap i32) (result i32)
    (local $hash i32) (local $slot i32) (local $entry i32) (local $id i32)
    (local.set $hash (call $lineHash (local.get $line) (local.get $len)))
    (local.set $slot (i32.and (local.get $hash) (i32.sub (local.get $cap) (i32.const 1))))
    (block $insert (loop $probe
      (local.set $entry (i32.add (local.get $table) (i32.mul (local.get $slot) (i32.const 16))))
      (local.set $id (i32.load (local.get $entry)))
      (br_if $insert (i32.eqz (local.get $id)))
      (if (i32.and
            (i32.eq (i32.load offset=4 (local.get $entry)) (local.get $hash))
            (i32.and
              (i32.eq (i32.load offset=12 (local.get $entry)) (local.get $len))
              (call $bytesEqual (i32.load offset=8 (local.get $entry)) (local.get $line) (local.get $len))))
        (then (return (local.get $id))))
      (local.set $slot (i32.and (i32.add (local.get $slot) (i32.const 1)) (i32.sub (local.get $cap) (i32.const 1))))
      (br $probe)))
    (global.set $internNext (i32.add (global.get $internNext) (i32.const 1)))
    (i32.store (local.get $entry) (global.get $internNext))
    (i32.store offset=4 (local.get $entry) (local.get $hash))
    (i32.store offset=8 (local.get $entry) (local.get $line))
    (i32.store offset=12 (local.get $entry) (local.get $len))
    (global.get $internNext))

  ;; Complete controlled target: parse canonical framed UTF-8, intern lines,
  ;; execute Myers, apply the script, and compare the applied IDs to target.
  (func (export "intern_diff_apply_validate")
    (param $input i32) (param $inputLen i32) (param $a i32) (param $b i32)
    (param $table i32) (param $tableCap i32) (param $out i32) (param $apply i32)
    (param $frontier i32) (param $trace i32) (param $traceBytes i32) (param $meta i32)
    (result i32)
    (local $p i32) (local $end i32) (local $alen i32) (local $blen i32)
    (local $i i32) (local $len i32) (local $line i32) (local $ops i32)
    (local $prefix i32) (local $suffix i32) (local $n i32) (local $m i32)
    (local $max i32) (local $width i32) (local $required i32)
    (local $kind i32) (local $op i32) (local $baseCursor i32) (local $outCursor i32)
    (local.set $p (local.get $input))
    (local.set $end (i32.add (local.get $input) (local.get $inputLen)))
    (if (i32.ne (i32.load (local.get $p)) (i32.const 0x31464454)) (then unreachable))
    (local.set $p (i32.add (local.get $p) (i32.const 4)))
    (local.set $alen (i32.load (local.get $p)))
    (local.set $p (i32.add (local.get $p) (i32.const 4)))
    (global.set $internNext (i32.const 0))
    (local.set $i (i32.const 0))
    (block $baseDone (loop $baseLoop
      (br_if $baseDone (i32.ge_u (local.get $i) (local.get $alen)))
      (if (i32.gt_u (i32.add (local.get $p) (i32.const 4)) (local.get $end)) (then unreachable))
      (local.set $len (i32.load (local.get $p)))
      (local.set $line (i32.add (local.get $p) (i32.const 4)))
      (if (i32.gt_u (i32.add (local.get $line) (local.get $len)) (local.get $end)) (then unreachable))
      (i32.store (i32.add (local.get $a) (i32.mul (local.get $i) (i32.const 4)))
        (call $intern (local.get $line) (local.get $len) (local.get $table) (local.get $tableCap)))
      (local.set $p (i32.add (local.get $line) (local.get $len)))
      (local.set $i (i32.add (local.get $i) (i32.const 1)))
      (br $baseLoop)))
    (if (i32.gt_u (i32.add (local.get $p) (i32.const 4)) (local.get $end)) (then unreachable))
    (local.set $blen (i32.load (local.get $p)))
    (local.set $p (i32.add (local.get $p) (i32.const 4)))
    (local.set $i (i32.const 0))
    (block $targetDone (loop $targetLoop
      (br_if $targetDone (i32.ge_u (local.get $i) (local.get $blen)))
      (if (i32.gt_u (i32.add (local.get $p) (i32.const 4)) (local.get $end)) (then unreachable))
      (local.set $len (i32.load (local.get $p)))
      (local.set $line (i32.add (local.get $p) (i32.const 4)))
      (if (i32.gt_u (i32.add (local.get $line) (local.get $len)) (local.get $end)) (then unreachable))
      (i32.store (i32.add (local.get $b) (i32.mul (local.get $i) (i32.const 4)))
        (call $intern (local.get $line) (local.get $len) (local.get $table) (local.get $tableCap)))
      (local.set $p (i32.add (local.get $line) (local.get $len)))
      (local.set $i (i32.add (local.get $i) (i32.const 1)))
      (br $targetLoop)))
    (if (i32.ne (local.get $p) (local.get $end)) (then unreachable))

    ;; Prove the supplied retained-trace region is sufficient before Myers.
    (block $prefixDone (loop $prefixLoop
      (br_if $prefixDone (i32.ge_u (local.get $prefix) (local.get $alen)))
      (br_if $prefixDone (i32.ge_u (local.get $prefix) (local.get $blen)))
      (br_if $prefixDone (i32.ne
        (i32.load (i32.add (local.get $a) (i32.mul (local.get $prefix) (i32.const 4))))
        (i32.load (i32.add (local.get $b) (i32.mul (local.get $prefix) (i32.const 4))))))
      (local.set $prefix (i32.add (local.get $prefix) (i32.const 1))) (br $prefixLoop)))
    (block $suffixDone (loop $suffixLoop
      (br_if $suffixDone (i32.ge_u (local.get $suffix) (i32.sub (local.get $alen) (local.get $prefix))))
      (br_if $suffixDone (i32.ge_u (local.get $suffix) (i32.sub (local.get $blen) (local.get $prefix))))
      (br_if $suffixDone (i32.ne
        (i32.load (i32.add (local.get $a) (i32.mul (i32.sub (i32.sub (local.get $alen) (i32.const 1)) (local.get $suffix)) (i32.const 4))))
        (i32.load (i32.add (local.get $b) (i32.mul (i32.sub (i32.sub (local.get $blen) (i32.const 1)) (local.get $suffix)) (i32.const 4))))))
      (local.set $suffix (i32.add (local.get $suffix) (i32.const 1))) (br $suffixLoop)))
    (local.set $n (i32.sub (i32.sub (local.get $alen) (local.get $prefix)) (local.get $suffix)))
    (local.set $m (i32.sub (i32.sub (local.get $blen) (local.get $prefix)) (local.get $suffix)))
    (if (i32.and (local.get $n) (local.get $m)) (then
      (local.set $max (i32.add (local.get $n) (local.get $m)))
      (local.set $width (i32.add (i32.mul (local.get $max) (i32.const 2)) (i32.const 1)))
      (local.set $required (i32.mul (i32.mul (i32.add (local.get $max) (i32.const 1)) (local.get $width)) (i32.const 4)))
      (if (i32.gt_u (local.get $required) (local.get $traceBytes)) (then unreachable))))

    (local.set $ops (call $diff_myers (local.get $a) (local.get $alen) (local.get $b) (local.get $blen)
      (local.get $out) (local.get $frontier) (local.get $trace) (local.get $meta)))
    ;; Apply and validate entirely inside linear memory.
    (local.set $i (i32.const 0))
    (block $applyDone (loop $applyLoop
      (br_if $applyDone (i32.ge_u (local.get $i) (local.get $ops)))
      (local.set $op (i32.add (local.get $out) (i32.mul (local.get $i) (i32.const 16))))
      (local.set $kind (i32.load (local.get $op)))
      (if (i32.eq (local.get $kind) (i32.const 0))
        (then
          (if (i32.ne (i32.load offset=4 (local.get $op)) (local.get $baseCursor)) (then unreachable))
          (if (i32.ne (i32.load offset=8 (local.get $op)) (local.get $outCursor)) (then unreachable))
          (if (i32.ne (i32.load offset=12 (local.get $op)) (i32.load (i32.add (local.get $a) (i32.mul (local.get $baseCursor) (i32.const 4))))) (then unreachable))
          (i32.store (i32.add (local.get $apply) (i32.mul (local.get $outCursor) (i32.const 4))) (i32.load offset=12 (local.get $op)))
          (local.set $baseCursor (i32.add (local.get $baseCursor) (i32.const 1)))
          (local.set $outCursor (i32.add (local.get $outCursor) (i32.const 1))))
      (else (if (i32.eq (local.get $kind) (i32.const 1))
        (then
          (if (i32.ne (i32.load offset=4 (local.get $op)) (local.get $baseCursor)) (then unreachable))
          (if (i32.ne (i32.load offset=12 (local.get $op)) (i32.load (i32.add (local.get $a) (i32.mul (local.get $baseCursor) (i32.const 4))))) (then unreachable))
          (local.set $baseCursor (i32.add (local.get $baseCursor) (i32.const 1))))
      (else (if (i32.eq (local.get $kind) (i32.const 2))
        (then
          (if (i32.ne (i32.load offset=4 (local.get $op)) (local.get $baseCursor)) (then unreachable))
          (if (i32.ne (i32.load offset=8 (local.get $op)) (local.get $outCursor)) (then unreachable))
          (i32.store (i32.add (local.get $apply) (i32.mul (local.get $outCursor) (i32.const 4))) (i32.load offset=12 (local.get $op)))
          (local.set $outCursor (i32.add (local.get $outCursor) (i32.const 1))))
        (else unreachable))))))
      (local.set $i (i32.add (local.get $i) (i32.const 1))) (br $applyLoop)))
    (if (i32.ne (local.get $baseCursor) (local.get $alen)) (then unreachable))
    (if (i32.ne (local.get $outCursor) (local.get $blen)) (then unreachable))
    (local.set $i (i32.const 0))
    (block $compareDone (loop $compareLoop
      (br_if $compareDone (i32.ge_u (local.get $i) (local.get $blen)))
      (if (i32.ne
        (i32.load (i32.add (local.get $apply) (i32.mul (local.get $i) (i32.const 4))))
        (i32.load (i32.add (local.get $b) (i32.mul (local.get $i) (i32.const 4))))) (then unreachable))
      (local.set $i (i32.add (local.get $i) (i32.const 1))) (br $compareLoop)))
    (i32.store offset=12 (local.get $meta) (i32.const 1))
    (i32.store offset=16 (local.get $meta) (global.get $internNext))
    (i32.store offset=20 (local.get $meta) (i32.const 5))
    (local.get $ops))
)
