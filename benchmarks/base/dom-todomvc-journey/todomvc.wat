(module
  (memory (export "memory") 1 1)
  (global $input i32 (i32.const 4096))
  (global $commands i32 (i32.const 8192))
  (global $state i32 (i32.const 16384))
  (func (export "input_ptr") (result i32) (global.get $input))
  (func (export "command_ptr") (result i32) (global.get $commands))
  (func (export "state_ptr") (result i32) (global.get $state))

  (func $alive (param $id i32) (result i32)
    (i32.and
      (i32.load8_u (i32.add (global.get $state) (local.get $id)))
      (i32.const 1)))

  (func $apply (param $opcode i32) (param $id i32) (param $value i32) (param $focus i32) (param $out i32) (result i32)
    (local $flags i32)
    (if (i32.or (i32.lt_s (local.get $id) (i32.const 0)) (i32.ge_s (local.get $id) (i32.const 100)))
      (then (return (i32.const 0))))
    (if (i32.or (i32.lt_s (local.get $focus) (i32.const 0)) (i32.gt_s (local.get $focus) (i32.const 1)))
      (then (return (i32.const 0))))

    (block $accepted
      (if (i32.eq (local.get $opcode) (i32.const 1))
        (then
          (if (call $alive (local.get $id)) (then (return (i32.const 0))))
          (i32.store8 (i32.add (global.get $state) (local.get $id)) (i32.const 1))
          (i32.store8 (i32.add (i32.add (global.get $state) (i32.const 100)) (local.get $id)) (i32.const 0))
          (br $accepted)))
      (if (i32.eq (local.get $opcode) (i32.const 2))
        (then
          (if (i32.eqz (call $alive (local.get $id))) (then (return (i32.const 0))))
          (local.set $flags (i32.load8_u (i32.add (global.get $state) (local.get $id))))
          (i32.store8
            (i32.add (global.get $state) (local.get $id))
            (i32.xor (local.get $flags) (i32.const 2)))
          (br $accepted)))
      (if (i32.eq (local.get $opcode) (i32.const 3))
        (then
          (if (i32.gt_s (local.get $value) (i32.const 2)) (then (return (i32.const 0))))
          (i32.store8 (i32.add (global.get $state) (i32.const 200)) (local.get $value))
          (br $accepted)))
      (if (i32.eq (local.get $opcode) (i32.const 4))
        (then
          (if (i32.or
            (i32.eqz (call $alive (local.get $id)))
            (i32.ne (local.get $value) (i32.const 1)))
            (then (return (i32.const 0))))
          (i32.store8
            (i32.add (i32.add (global.get $state) (i32.const 100)) (local.get $id))
            (local.get $value))
          (br $accepted)))
      (if (i32.eq (local.get $opcode) (i32.const 5))
        (then
          (if (i32.eqz (call $alive (local.get $id))) (then (return (i32.const 0))))
          (i32.store8 (i32.add (global.get $state) (local.get $id)) (i32.const 0))
          (br $accepted)))
      (return (i32.const 0)))

    (i32.store (local.get $out) (local.get $opcode))
    (i32.store offset=4 (local.get $out) (local.get $id))
    (i32.store offset=8 (local.get $out) (local.get $value))
    (i32.store offset=12 (local.get $out) (local.get $focus))
    (i32.const 1))

  (func (export "run") (param $count i32) (result i32)
    (local $i i32)
    (local $in i32)
    (local $out i32)
    (if (i32.or (i32.lt_s (local.get $count) (i32.const 0)) (i32.gt_s (local.get $count) (i32.const 150)))
      (then (return (i32.const -1))))
    (memory.fill (global.get $state) (i32.const 0) (i32.const 201))
    (memory.fill (global.get $commands) (i32.const 0) (i32.const 2400))
    (block $done
      (loop $next
        (br_if $done (i32.ge_u (local.get $i) (local.get $count)))
        (local.set $in (i32.add (global.get $input) (i32.mul (local.get $i) (i32.const 16))))
        (local.set $out (i32.add (global.get $commands) (i32.mul (local.get $i) (i32.const 16))))
        (if (i32.eqz
          (call $apply
            (i32.load (local.get $in))
            (i32.load offset=4 (local.get $in))
            (i32.load offset=8 (local.get $in))
            (i32.load offset=12 (local.get $in))
            (local.get $out)))
          (then (return (i32.const -1))))
        (local.set $i (i32.add (local.get $i) (i32.const 1)))
        (br $next)))
    (local.get $i))
)
