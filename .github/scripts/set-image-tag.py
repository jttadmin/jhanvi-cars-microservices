#!/usr/bin/env python3
"""Set image tags in a Helm values file, changing only the `tag:` lines.

Usage: set-image-tag.py VALUES_FILE TAG KEY_PATH [KEY_PATH ...]
  KEY_PATH is dotted, e.g. images.frontend or images.migrations.booking

Unlike yq, this keeps comments, blank lines and formatting exactly as they are,
so each deploy commit is a clean one-line-per-image diff.
"""
import re
import sys


def set_tag(lines, path, tag):
    keys = path.split(".")
    stack = []  # (indent, key) of the current mapping path
    for i, line in enumerate(lines):
        m = re.match(r"^(\s*)([A-Za-z0-9_-]+):(.*)$", line)
        if not m or line.lstrip().startswith("#"):
            continue
        indent, key, rest = len(m.group(1)), m.group(2), m.group(3)
        while stack and stack[-1][0] >= indent:
            stack.pop()
        current = [k for _, k in stack]
        if current == keys and key == "tag":
            lines[i] = f'{m.group(1)}tag: "{tag}"\n'
            return True
        if rest.strip() == "" or rest.strip().startswith("#"):
            stack.append((indent, key))
    return False


def main():
    values, tag, *paths = sys.argv[1:]
    with open(values) as f:
        lines = f.readlines()
    for path in paths:
        if not set_tag(lines, path, tag):
            sys.exit(f"error: no '{path}.tag' found in {values}")
        print(f"{path}.tag = {tag}")
    with open(values, "w") as f:
        f.writelines(lines)


if __name__ == "__main__":
    main()
