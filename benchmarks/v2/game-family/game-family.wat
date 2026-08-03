(module
  (memory (export "memory") 4 4)
  (func (export "hash") (param $ptr i32) (param $length i32) (param $seed i32) (result i32)
    (local $end i32)
    local.get $ptr
    local.get $length
    i32.add
    local.set $end
    (block $done
      (loop $loop
        local.get $ptr
        local.get $end
        i32.ge_u
        br_if $done
        local.get $seed
        local.get $ptr
        i32.load8_u
        i32.xor
        i32.const 16777619
        i32.mul
        local.set $seed
        local.get $ptr
        i32.const 1
        i32.add
        local.set $ptr
        br $loop
      )
    )
    local.get $seed
  )
)
