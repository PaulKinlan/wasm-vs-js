#!/usr/bin/python3
"""Delete one owned directory tree using only fd-relative, no-follow operations."""
import json, os, stat, sys, uuid

O_DIR = os.O_RDONLY | os.O_DIRECTORY | os.O_NOFOLLOW | os.O_CLOEXEC

def die(message):
    raise RuntimeError(message)

def exact(st, dev, ino, directory=True):
    if st.st_dev != dev or st.st_ino != ino:
        die("inode identity changed")
    if directory and not stat.S_ISDIR(st.st_mode):
        die("expected directory")

def empty_dir(fd):
    # scandir duplicates the supplied descriptor; all mutation remains relative to fd.
    for entry in list(os.scandir(fd)):
        name = entry.name
        st = os.stat(name, dir_fd=fd, follow_symlinks=False)
        if stat.S_ISDIR(st.st_mode):
            child = os.open(name, O_DIR, dir_fd=fd)
            try:
                exact(os.fstat(child), st.st_dev, st.st_ino)
                empty_dir(child)
                exact(os.fstat(child), st.st_dev, st.st_ino)
            finally:
                os.close(child)
            # If replaced here, rmdir can only remove an empty directory; it never follows links.
            os.rmdir(name, dir_fd=fd)
        else:
            # unlinkat never follows the terminal symlink.
            os.unlink(name, dir_fd=fd)

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
        child = os.open(child_name, O_DIR, dir_fd=parent)
        try:
            cst = os.fstat(child)
            exact(cst, cdev, cino)
            if cst.st_uid != os.getuid() or stat.S_IMODE(cst.st_mode) != 0o700:
                die("unsafe child ownership or mode")
        finally:
            os.close(child)
        tomb = ".removed-" + uuid.uuid4().hex
        os.rename(child_name, tomb, src_dir_fd=parent, dst_dir_fd=parent)
        child = os.open(tomb, O_DIR, dir_fd=parent)
        try:
            exact(os.fstat(child), cdev, cino)
            empty_dir(child)
            exact(os.fstat(child), cdev, cino)
        finally:
            os.close(child)
        os.rmdir(tomb, dir_fd=parent)
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
