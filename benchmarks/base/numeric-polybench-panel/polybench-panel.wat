(module
  (memory (export "memory") 64 64)
  (func $addr (param $base i32) (param $index i32) (result i32)
    local.get $base local.get $index i32.const 3 i32.shl i32.add)

  ;; PolyBench GEMM source order: scale C row, then accumulate in i/k/j order.
  (func (export "gemm") (param $a i32) (param $b i32) (param $c i32)
    (param $ni i32) (param $nj i32) (param $nk i32) (param $alpha f64) (param $beta f64)
    (local $i i32) (local $j i32) (local $k i32) (local $p i32)
    i32.const 0 local.set $i
    block $done_i loop $loop_i
      local.get $i local.get $ni i32.ge_u br_if $done_i
      i32.const 0 local.set $j
      block $scale_done loop $scale
        local.get $j local.get $nj i32.ge_u br_if $scale_done
        local.get $i local.get $nj i32.mul local.get $j i32.add local.set $p
        local.get $c local.get $p call $addr
        local.get $c local.get $p call $addr f64.load local.get $beta f64.mul f64.store
        local.get $j i32.const 1 i32.add local.set $j br $scale
      end end
      i32.const 0 local.set $k
      block $done_k loop $loop_k
        local.get $k local.get $nk i32.ge_u br_if $done_k
        i32.const 0 local.set $j
        block $done_j loop $loop_j
          local.get $j local.get $nj i32.ge_u br_if $done_j
          local.get $i local.get $nj i32.mul local.get $j i32.add local.set $p
          local.get $c local.get $p call $addr
          local.get $c local.get $p call $addr f64.load
          local.get $alpha
          local.get $a local.get $i local.get $nk i32.mul local.get $k i32.add call $addr f64.load f64.mul
          local.get $b local.get $k local.get $nj i32.mul local.get $j i32.add call $addr f64.load f64.mul
          f64.add f64.store
          local.get $j i32.const 1 i32.add local.set $j br $loop_j
        end end
        local.get $k i32.const 1 i32.add local.set $k br $loop_k
      end end
      local.get $i i32.const 1 i32.add local.set $i br $loop_i
    end end)

  ;; In-place lower Cholesky. Returns 0 for a non-positive diagonal, otherwise 1.
  (func (export "cholesky") (param $a i32) (param $n i32) (result i32)
    (local $i i32) (local $j i32) (local $k i32) (local $p i32) (local $sum f64)
    i32.const 0 local.set $i
    block $done_i loop $loop_i
      local.get $i local.get $n i32.ge_u br_if $done_i
      i32.const 0 local.set $j
      block $done_j loop $loop_j
        local.get $j local.get $i i32.gt_u br_if $done_j
        local.get $i local.get $n i32.mul local.get $j i32.add local.set $p
        local.get $a local.get $p call $addr f64.load local.set $sum
        i32.const 0 local.set $k
        block $done_k loop $loop_k
          local.get $k local.get $j i32.ge_u br_if $done_k
          local.get $sum
          local.get $a local.get $i local.get $n i32.mul local.get $k i32.add call $addr f64.load
          local.get $a local.get $j local.get $n i32.mul local.get $k i32.add call $addr f64.load
          f64.mul f64.sub local.set $sum
          local.get $k i32.const 1 i32.add local.set $k br $loop_k
        end end
        local.get $i local.get $j i32.eq
        if
          local.get $sum f64.const 0 f64.le
          if i32.const 0 return end
          local.get $a local.get $p call $addr local.get $sum f64.sqrt f64.store
        else
          local.get $a local.get $p call $addr
          local.get $sum
          local.get $a local.get $j local.get $n i32.mul local.get $j i32.add call $addr f64.load
          f64.div f64.store
        end
        local.get $j i32.const 1 i32.add local.set $j br $loop_j
      end end
      ;; Canonicalize the unused upper triangle to zero.
      local.get $i i32.const 1 i32.add local.set $j
      block $upper_done loop $upper
        local.get $j local.get $n i32.ge_u br_if $upper_done
        local.get $a local.get $i local.get $n i32.mul local.get $j i32.add call $addr f64.const 0 f64.store
        local.get $j i32.const 1 i32.add local.set $j br $upper
      end end
      local.get $i i32.const 1 i32.add local.set $i br $loop_i
    end end
    i32.const 1)

  ;; One five-point sweep. Boundaries are copied by the host before entry.
  (func $stencil (export "stencil5") (param $a i32) (param $out i32) (param $n i32)
    (local $i i32) (local $j i32) (local $p i32)
    i32.const 1 local.set $i
    block $done_i loop $loop_i
      local.get $i local.get $n i32.const 1 i32.sub i32.ge_u br_if $done_i
      i32.const 1 local.set $j
      block $done_j loop $loop_j
        local.get $j local.get $n i32.const 1 i32.sub i32.ge_u br_if $done_j
        local.get $i local.get $n i32.mul local.get $j i32.add local.set $p
        local.get $out local.get $p call $addr
        f64.const 0.2
        local.get $a local.get $p call $addr f64.load
        local.get $a local.get $p i32.const 1 i32.sub call $addr f64.load f64.add
        local.get $a local.get $p i32.const 1 i32.add call $addr f64.load f64.add
        local.get $a local.get $p local.get $n i32.sub call $addr f64.load f64.add
        local.get $a local.get $p local.get $n i32.add call $addr f64.load f64.add
        f64.mul f64.store
        local.get $j i32.const 1 i32.add local.set $j br $loop_j
      end end
      local.get $i i32.const 1 i32.add local.set $i br $loop_i
    end end)

  ;; PolyBench Jacobi-2D: A->B then B->A for every registered timestep.
  (func (export "jacobi2d") (param $a i32) (param $b i32) (param $n i32) (param $steps i32)
    (local $t i32)
    i32.const 0 local.set $t
    block $done_t loop $loop_t
      local.get $t local.get $steps i32.ge_u br_if $done_t
      local.get $a local.get $b local.get $n call $stencil
      local.get $b local.get $a local.get $n call $stencil
      local.get $t i32.const 1 i32.add local.set $t br $loop_t
    end end)
)
