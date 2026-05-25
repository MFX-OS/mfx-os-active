"""
build_mats_patch.py
-------------------
Merge entries from ./new_mats.json into the MATS literal inside
public/js/core.js and write the file back. Always creates a timestamped
backup under ./backups/ before touching core.js.

Usage:
  python3 build_mats_patch.py

Prereqs:
  - Run parse_stock_lists.py first to produce ./new_mats.json
  - core.js must contain a single `const MATS=[ ... ]` literal
"""
import datetime
import json
import os
import re
import shutil
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
PROJECT_ROOT = os.path.abspath(os.path.join(HERE, '..', '..'))
CORE_PATH = os.path.join(PROJECT_ROOT, 'public', 'js', 'core.js')
NEW_JSON = os.path.join(HERE, 'new_mats.json')
BACKUP_DIR = os.path.join(HERE, 'backups')


def fmt_entry(e):
    """Render one MATS entry as `{v:"...",s:"...",d:"...",m:X,mk:Y[,liner:...][,adhesive:...]}`
       matching the compact style used by the existing literal."""
    def fmt_num(v):
        if v is None:
            return 'null'
        if isinstance(v, (int, float)):
            if 0 < v < 1:
                return repr(v).lstrip('0')  # 0.129 -> .129
            return repr(v)
        return 'null'

    def q(s):
        return '"' + (s or '').replace('\\', '\\\\').replace('"', '\\"') + '"'

    parts = [
        f'v:{q(e["v"])}',
        f's:{q(e["s"])}',
        f'd:{q(e.get("d") or "")}',
        f'm:{fmt_num(e.get("m"))}',
        f'mk:{fmt_num(e.get("mk"))}',
    ]
    if e.get('liner'):
        parts.append(f'liner:{q(e["liner"])}')
    if e.get('adhesive'):
        parts.append(f'adhesive:{q(e["adhesive"])}')
    return '{' + ','.join(parts) + '}'


def main():
    os.makedirs(BACKUP_DIR, exist_ok=True)

    if not os.path.exists(NEW_JSON):
        print(f'ERROR: {NEW_JSON} not found. Run parse_stock_lists.py first.',
              file=sys.stderr)
        sys.exit(1)

    with open(CORE_PATH, 'r', encoding='utf-8') as f:
        src = f.read()

    m = re.search(r'const\s+MATS\s*=\s*\[', src)
    if not m:
        sys.exit('FATAL: could not find `const MATS=[` in core.js')
    literal_start = m.end() - 1  # the '['
    # Walk to matching ']'
    depth = 0
    literal_end = -1
    for i in range(literal_start, len(src)):
        c = src[i]
        if c == '[':
            depth += 1
        elif c == ']':
            depth -= 1
            if depth == 0:
                literal_end = i
                break
    if literal_end == -1:
        sys.exit('FATAL: unmatched [ in MATS literal')

    original_literal = src[literal_start:literal_end + 1]
    print(f'Found MATS literal: {len(original_literal):,} chars at {literal_start}-{literal_end}')

    # Quote keys, fix leading-dot numbers, then JSON-parse
    quoted = re.sub(r'([{,])\s*([a-zA-Z_]\w*)\s*:', r'\1"\2":', original_literal)
    quoted = re.sub(r':\s*\.(\d)', r':0.\1', quoted)
    quoted = re.sub(r':\s*-\.(\d)', r':-0.\1', quoted)
    try:
        existing = json.loads(quoted)
    except json.JSONDecodeError as e:
        print('Parse error context:', quoted[max(0, e.pos - 60):e.pos + 60])
        raise

    print(f'Existing entries: {len(existing)}')

    with open(NEW_JSON, 'r') as f:
        new_entries = json.load(f)

    existing_specs = {e['s'] for e in existing}
    to_add = []
    for e in new_entries:
        if e['s'] in existing_specs:
            continue
        clean = {k: v for k, v in e.items() if not k.startswith('_')}
        to_add.append(clean)
    print(f'New to append (dedup vs file): {len(to_add)}')

    merged = existing + to_add
    print(f'Final MATS will contain: {len(merged)}')

    # Build multi-line literal so future diffs stay readable
    lines = ['[']
    for idx, e in enumerate(merged):
        sep = ',' if idx < len(merged) - 1 else ''
        lines.append(fmt_entry(e) + sep)
    lines.append(']')
    new_literal = '\n'.join(lines)

    new_src = src[:literal_start] + new_literal + src[literal_end + 1:]

    ts = datetime.datetime.utcnow().strftime('%Y%m%d-%H%M%S')
    backup_path = os.path.join(BACKUP_DIR, f'core.js.before-mats-import-{ts}.bak')
    shutil.copy2(CORE_PATH, backup_path)
    print(f'Backup: {backup_path}')

    with open(CORE_PATH, 'w', encoding='utf-8') as f:
        f.write(new_src)
    print(f'core.js: {len(src):,} -> {len(new_src):,} bytes (+{len(new_src)-len(src):,})')
    print('Done.')


if __name__ == '__main__':
    main()
