#!/usr/bin/python3
"""Update one exact stage-owner file through O_NOFOLLOW authenticated descriptors."""
import hashlib, json, os, stat, sys

O_DIR = os.O_RDONLY | os.O_DIRECTORY | os.O_NOFOLLOW | os.O_CLOEXEC
O_FILE = os.O_RDWR | os.O_NOFOLLOW | os.O_CLOEXEC


def die(message):
    raise RuntimeError(message)


def exact(st, dev, ino):
    if st.st_dev != dev or st.st_ino != ino:
        die("inode identity changed")


def main():
    if len(sys.argv) != 10:
        die("usage: helper parent pdev pino child fdev fino expected-sha expected-state next-state")
    parent_path, pdev, pino, child_name, fdev, fino, expected_sha, expected_state, next_state = sys.argv[1:]
    if "/" in child_name or child_name in ("", ".", ".."):
        die("unsafe child name")
    if next_state not in (
        "ready-no-owned-launch",
        "owned-launch-active",
        "cleanup-verified",
        "cleanup-unresolved",
    ):
        die("unsafe lifecycle state")
    pdev, pino, fdev, fino = map(int, (pdev, pino, fdev, fino))
    parent = os.open(parent_path, O_DIR)
    try:
        pst = os.fstat(parent)
        exact(pst, pdev, pino)
        if pst.st_uid != os.getuid() or stat.S_IMODE(pst.st_mode) != 0o700:
            die("unsafe parent ownership or mode")
        owner = os.open(child_name, O_FILE, dir_fd=parent)
        try:
            fst = os.fstat(owner)
            exact(fst, fdev, fino)
            if not stat.S_ISREG(fst.st_mode) or fst.st_uid != os.getuid() or stat.S_IMODE(fst.st_mode) != 0o600:
                die("unsafe stage owner")
            chunks = []
            while True:
                chunk = os.read(owner, 65536)
                if not chunk:
                    break
                chunks.append(chunk)
            current_bytes = b"".join(chunks)
            if hashlib.sha256(current_bytes).hexdigest() != expected_sha:
                die("stage owner digest changed")
            current = json.loads(current_bytes)
            if current.get("cleanupLifecycle") != expected_state:
                die("stage owner lifecycle changed")
            current["cleanupLifecycle"] = next_state
            encoded = json.dumps(current, sort_keys=True, separators=(",", ":"), ensure_ascii=False).encode("utf-8") + b"\n"
            os.ftruncate(owner, 0)
            os.lseek(owner, 0, os.SEEK_SET)
            offset = 0
            while offset < len(encoded):
                offset += os.write(owner, encoded[offset:])
            os.fsync(owner)
            after = os.fstat(owner)
            exact(after, fdev, fino)
        finally:
            os.close(owner)
        exact(os.fstat(parent), pdev, pino)
    finally:
        os.close(parent)
    print(json.dumps({
        "updated": True,
        "dev": fdev,
        "ino": fino,
        "sha256": hashlib.sha256(encoded).hexdigest(),
        "cleanupLifecycle": next_state,
    }, separators=(",", ":")))


if __name__ == "__main__":
    try:
        main()
    except Exception as exc:
        print(str(exc), file=sys.stderr)
        sys.exit(1)
