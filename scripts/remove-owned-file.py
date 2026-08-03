#!/usr/bin/python3
"""Remove one exact owned file using a retained parent descriptor and no-follow metadata."""
import json, os, stat, sys, uuid

O_DIR = os.O_RDONLY | os.O_DIRECTORY | os.O_NOFOLLOW | os.O_CLOEXEC


def die(message):
    raise RuntimeError(message)


def exact(st, dev, ino):
    if st.st_dev != dev or st.st_ino != ino:
        die("inode identity changed")


def main():
    if len(sys.argv) != 7:
        die("usage: helper parent parent-dev parent-ino child child-dev child-ino")
    parent_path, pdev, pino, child_name, cdev, cino = sys.argv[1:]
    if "/" in child_name or child_name in ("", ".", ".."):
        die("unsafe child name")
    pdev, pino, cdev, cino = map(int, (pdev, pino, cdev, cino))
    parent = os.open(parent_path, O_DIR)
    try:
        pst = os.fstat(parent)
        exact(pst, pdev, pino)
        if pst.st_uid != os.getuid() or stat.S_IMODE(pst.st_mode) != 0o700:
            die("unsafe parent ownership or mode")
        current = os.stat(child_name, dir_fd=parent, follow_symlinks=False)
        exact(current, cdev, cino)
        if not stat.S_ISREG(current.st_mode) or current.st_uid != os.getuid():
            die("unsafe owned file")
        tomb = ".removed-file-" + uuid.uuid4().hex
        os.rename(child_name, tomb, src_dir_fd=parent, dst_dir_fd=parent)
        moved = os.stat(tomb, dir_fd=parent, follow_symlinks=False)
        exact(moved, cdev, cino)
        if not stat.S_ISREG(moved.st_mode):
            die("owned file replaced during removal")
        os.unlink(tomb, dir_fd=parent)
        exact(os.fstat(parent), pdev, pino)
    finally:
        os.close(parent)
    print(json.dumps({"removed": True, "dev": cdev, "ino": cino}, separators=(",", ":")))


if __name__ == "__main__":
    try:
        main()
    except Exception as exc:
        print(str(exc), file=sys.stderr)
        sys.exit(1)
