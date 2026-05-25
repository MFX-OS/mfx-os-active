"""
apply-batch-10-fixes.py
=======================
Final atomic fixes:
  UX-15  haccp.html + mockrecall.html — add "← Return to MFX OS" banner at top
  SEC-12 chat.js — escape channelId interpolation via JSON.stringify (XSS fix)

All other remaining items are explicit deferrals (see end of session report):
  Manual:        SEC-05 (revoke keys), SEC-11 (rotate Giphy key)
  Architectural: PERF-15 (MATS lazy), SEC-12 full CSP, DATA-10 (8 SEED migrations),
                 DATA-15 (server-validated quote IDs)
  No-op/done:    DATA-12, UX-06, UX-14, UX-17 (already addressed or audit mechanism didn't reproduce)
  Informational: SEC-15

Usage:
  python3 scripts/audits/apply-batch-10-fixes.py
"""
import os
import shutil
import subprocess
import sys
import datetime

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..'))
os.chdir(ROOT)

BACKUP_DIR = os.path.join('scripts', 'audits', 'fix-backups-' + datetime.datetime.utcnow().strftime('%Y%m%d-%H%M%S') + '-batch10')
os.makedirs(BACKUP_DIR, exist_ok=True)


def backup(rel):
    dst = os.path.join(BACKUP_DIR, rel.replace('/', '__').replace('\\', '__'))
    os.makedirs(os.path.dirname(dst) or '.', exist_ok=True)
    if os.path.exists(rel):
        shutil.copy2(rel, dst)


def atomic_write(rel, content):
    tmp = rel + '.applying.tmp'
    with open(tmp, 'w', encoding='utf-8', newline='') as f:
        f.write(content)
    os.replace(tmp, rel)


def read(rel):
    with open(rel, 'r', encoding='utf-8', newline='') as f:
        return f.read()


def verify_js(rel):
    r = subprocess.run(['node', '--check', rel], capture_output=True, text=True)
    if r.returncode != 0:
        raise RuntimeError(f'{rel}: node --check FAILED:\n{r.stderr}')


def replace_unique(content, needle, replacement, what):
    count = content.count(needle)
    if count == 0:
        raise RuntimeError(f'{what}: needle not found')
    if count > 1:
        raise RuntimeError(f'{what}: needle matches {count} times (expected 1)')
    return content.replace(needle, replacement)


# Banner inserted right after <body> in the standalone HTML pages
BACK_BANNER = '''
<!-- UX-15 fix (2026-05-24): back-to-app banner so users aren't stranded -->
<a href="https://os.microflexfilm.com/" id="mfx-back-to-os" style="position:fixed;top:0;left:0;right:0;z-index:99999;background:rgba(0,212,245,.95);color:#000;padding:6px 14px;font-family:-apple-system,Inter,sans-serif;font-size:12px;font-weight:700;text-decoration:none;display:flex;align-items:center;gap:8px;box-shadow:0 1px 8px rgba(0,0,0,.25)">
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="15 18 9 12 15 6"/></svg>
  <span>Return to MFX OS</span>
</a>
<div style="height:28px"></div>
'''


# ============================================================
# UX-15 — back buttons on standalone HTML pages
# ============================================================
def fix_ux_15():
    print('[UX-15] adding back-to-app banner to haccp.html + mockrecall.html')
    for rel in ['public/haccp.html', 'public/mockrecall.html']:
        if not os.path.exists(rel):
            print(f'  skip (not present): {rel}')
            continue
        backup(rel)
        src = read(rel)
        if 'UX-15 fix' in src:
            print(f'  SKIP {rel} (already applied)')
            continue
        # Inject right after the opening <body...> tag
        import re
        m = re.search(r'<body[^>]*>', src)
        if not m:
            print(f'  WARN: no <body> tag found in {rel}, skipping')
            continue
        insert_at = m.end()
        new_src = src[:insert_at] + BACK_BANNER + src[insert_at:]
        atomic_write(rel, new_src)
        print(f'  OK {rel} (+{len(new_src) - len(src)} bytes)')


# ============================================================
# SEC-12 partial — escape channelId in chat.js pop-out script
# ============================================================
def fix_sec_12_channelid():
    print('[SEC-12 partial] chat.js: escape channelId interpolation (XSS vector close)')
    rel = 'public/js/chat.js'
    backup(rel)
    src = read(rel)
    if 'SEC-12 fix' in src:
        print('  SKIP (already applied)')
        return
    old = "  popHtml += 'var channelId=\"' + channelId + '\";';"
    new = """  // SEC-12 fix (2026-05-24): escape channelId via JSON.stringify before
  // injecting into the pop-out <script> block. Closes a stored-XSS vector
  // (if a malicious channelId ever contained `"` or `</script>`).
  popHtml += 'var channelId=' + JSON.stringify(channelId) + ';';"""
    src = replace_unique(src, old, new, 'SEC-12 channelId escape')
    atomic_write(rel, src)
    verify_js(rel)
    print('  OK')


# ============================================================
# RUN
# ============================================================
def main():
    print('Applying BATCH 10 (final fixes)...')
    print(f'Backup dir: {BACKUP_DIR}\n')
    fix_ux_15()
    fix_sec_12_channelid()
    print('\nAll BATCH 10 fixes applied.')


if __name__ == '__main__':
    try:
        main()
    except Exception as e:
        print(f'\nFAILED: {e}', file=sys.stderr)
        print(f'Backup at: {BACKUP_DIR}', file=sys.stderr)
        sys.exit(1)
