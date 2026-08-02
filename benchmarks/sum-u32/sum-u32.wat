(module
  (memory (export "memory") 4)
  (func (export "sum_u32") (param $ptr i32) (param $len i32) (result i32)
    (local $index i32)
    (local $sum i32)
    (block $done
      (loop $next
        local.get $index
        local.get $len
        i32.ge_u
        br_if $done

        local.get $sum
        local.get $ptr
        local.get $index
        i32.const 4
        i32.mul
        i32.add
        i32.load
        i32.add
        local.set $sum

        local.get $index
        i32.const 1
        i32.add
        local.set $index
        br $next
      )
    )
    local.get $sum
  )
)
