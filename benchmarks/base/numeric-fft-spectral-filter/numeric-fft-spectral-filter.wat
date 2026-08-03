;; numeric.fft-spectral-filter.v1 controlled scalar linear-Wasm pipeline.
;; Frozen order: window, forward radix-2 DIT, per-bin gain, conjugate,
;; forward radix-2 DIT, conjugate and 1/N scale. All arithmetic is f32.
(module
  (memory (export "memory") 512 512)

  (func $fft (param $ptr i32) (param $n i32) (param $twPtr i32)
    (local $i i32) (local $j i32) (local $bit i32)
    (local $len i32) (local $half i32) (local $twStart i32) (local $tw i32)
    (local $left i32) (local $right i32)
    (local $er f32) (local $ei f32) (local $or f32) (local $oi f32)
    (local $tr f32) (local $ti f32) (local $wc f32) (local $ws f32)

    (local.set $i (i32.const 1))
    (local.set $j (i32.const 0))
    (block $reverseDone
      (loop $reverse
        local.get $i local.get $n i32.ge_u br_if $reverseDone
        local.get $n i32.const 1 i32.shr_u local.set $bit
        (block $carryDone
          (loop $carry
            local.get $j local.get $bit i32.and i32.eqz br_if $carryDone
            local.get $j local.get $bit i32.xor local.set $j
            local.get $bit i32.const 1 i32.shr_u local.set $bit
            br $carry))
        local.get $j local.get $bit i32.xor local.set $j
        local.get $i local.get $j i32.lt_u
        (if
          (then
            local.get $ptr local.get $i i32.const 3 i32.shl i32.add local.set $left
            local.get $ptr local.get $j i32.const 3 i32.shl i32.add local.set $right
            local.get $left f32.load local.set $er
            local.get $left local.get $right f32.load f32.store
            local.get $right local.get $er f32.store
            local.get $left i32.const 4 i32.add local.set $left
            local.get $right i32.const 4 i32.add local.set $right
            local.get $left f32.load local.set $er
            local.get $left local.get $right f32.load f32.store
            local.get $right local.get $er f32.store))
        local.get $i i32.const 1 i32.add local.set $i
        br $reverse))

    i32.const 2 local.set $len
    local.get $twPtr local.set $twStart
    (block $stagesDone
      (loop $stages
        local.get $len local.get $n i32.gt_u br_if $stagesDone
        local.get $len i32.const 1 i32.shr_u local.set $half
        i32.const 0 local.set $i
        (block $groupsDone
          (loop $groups
            local.get $i local.get $n i32.ge_u br_if $groupsDone
            local.get $twStart local.set $tw
            i32.const 0 local.set $j
            (block $butterfliesDone
              (loop $butterflies
                local.get $j local.get $half i32.ge_u br_if $butterfliesDone
                local.get $tw f32.load local.set $wc
                local.get $tw i32.const 4 i32.add f32.load local.set $ws
                local.get $tw i32.const 8 i32.add local.set $tw
                local.get $ptr local.get $i local.get $j i32.add i32.const 3 i32.shl i32.add local.set $left
                local.get $ptr local.get $i local.get $j i32.add local.get $half i32.add i32.const 3 i32.shl i32.add local.set $right
                local.get $left f32.load local.set $er
                local.get $left i32.const 4 i32.add f32.load local.set $ei
                local.get $right f32.load local.set $or
                local.get $right i32.const 4 i32.add f32.load local.set $oi
                local.get $wc local.get $or f32.mul local.get $ws local.get $oi f32.mul f32.sub local.set $tr
                local.get $wc local.get $oi f32.mul local.get $ws local.get $or f32.mul f32.add local.set $ti
                local.get $left local.get $er local.get $tr f32.add f32.store
                local.get $left i32.const 4 i32.add local.get $ei local.get $ti f32.add f32.store
                local.get $right local.get $er local.get $tr f32.sub f32.store
                local.get $right i32.const 4 i32.add local.get $ei local.get $ti f32.sub f32.store
                local.get $j i32.const 1 i32.add local.set $j
                br $butterflies))
            local.get $i local.get $len i32.add local.set $i
            br $groups))
        local.get $twStart local.get $half i32.const 3 i32.shl i32.add local.set $twStart
        local.get $len i32.const 1 i32.shl local.set $len
        br $stages)))

  (func (export "spectral_pipeline")
    (param $data i32) (param $window i32) (param $twiddle i32) (param $gain i32) (param $n i32)
    (local $i i32) (local $dataOff i32) (local $fieldOff i32)
    (local $value f32) (local $scale f32)

    i32.const 0 local.set $i
    (block $windowDone
      (loop $windowLoop
        local.get $i local.get $n i32.ge_u br_if $windowDone
        local.get $data local.get $i i32.const 3 i32.shl i32.add local.set $dataOff
        local.get $i i32.const 2 i32.shl local.set $fieldOff
        local.get $dataOff
        local.get $dataOff f32.load
        local.get $window local.get $fieldOff i32.add f32.load
        f32.mul f32.store
        local.get $dataOff i32.const 4 i32.add f32.const 0 f32.store
        local.get $i i32.const 1 i32.add local.set $i
        br $windowLoop))

    local.get $data local.get $n local.get $twiddle call $fft

    i32.const 0 local.set $i
    (block $filterDone
      (loop $filterLoop
        local.get $i local.get $n i32.ge_u br_if $filterDone
        local.get $data local.get $i i32.const 3 i32.shl i32.add local.set $dataOff
        local.get $i i32.const 2 i32.shl local.set $fieldOff
        local.get $gain local.get $fieldOff i32.add f32.load local.set $value
        local.get $dataOff local.get $dataOff f32.load local.get $value f32.mul f32.store
        local.get $dataOff i32.const 4 i32.add
        local.get $dataOff i32.const 4 i32.add f32.load local.get $value f32.mul f32.neg f32.store
        local.get $i i32.const 1 i32.add local.set $i
        br $filterLoop))

    local.get $data local.get $n local.get $twiddle call $fft
    f32.const 1 local.get $n f32.convert_i32_u f32.div local.set $scale

    i32.const 0 local.set $i
    (block $scaleDone
      (loop $scaleLoop
        local.get $i local.get $n i32.ge_u br_if $scaleDone
        local.get $data local.get $i i32.const 3 i32.shl i32.add local.set $dataOff
        local.get $dataOff local.get $dataOff f32.load local.get $scale f32.mul f32.store
        local.get $dataOff i32.const 4 i32.add
        local.get $dataOff i32.const 4 i32.add f32.load f32.neg local.get $scale f32.mul f32.store
        local.get $i i32.const 1 i32.add local.set $i
        br $scaleLoop)))
)
