"""
apply-sec-11-remove-giphy.py
============================
SEC-11 (manual rotation deferral) → resolved by REMOVAL.
Strips the Giphy integration entirely. Rationale:
  - Eliminates third-party API key from client-side bundle
  - Removes attack surface (rate-limit abuse, key exfiltration)
  - One less third-party dependency to monitor / rotate

What gets removed:
  public/js/chat.js
    - GIPHY_KEY var + comments (lines ~634-637)
    - GIF picker functions: chatSearchGif, gifSaveKey, gifLoadTrending,
      gifDoSearch, gifRenderResults, gifSelect (lines ~639-724)
    - window exports for those functions (lines ~781-784, 914)
    - IC-status "Add GIF" button (line ~2559)
    - icStatusSearchGif + icStatusGifDoSearch + icStatusGifRender (lines ~2574-2604)
    - window exports (lines ~2781-2782)
    - GIF button in pop-out chat header (line ~123)
  public/index.html
    - GIF button in #icInputBar (line ~396)
  public/css/theme.css
    - Selector rule that targeted that button (line ~1095)
  firebase.json
    - api.giphy.com + *.giphy.com from CSP connect-src

What is INTENTIONALLY kept (backwards compatibility):
  - var _icPendingGif=null;  (used by send-message path; just always null now)
  - msg.gif field on history messages (so old GIFs in statusReel/messages still render)
  - img-src 'self' data: https: blob:  (so historical Giphy CDN URLs still display)

Usage:
  python3 scripts/audits/apply-sec-11-remove-giphy.py
"""
import os
import shutil
import subprocess
import sys
import datetime

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..'))
os.chdir(ROOT)

BACKUP_DIR = os.path.join('scripts', 'audits', 'fix-backups-' + datetime.datetime.utcnow().strftime('%Y%m%d-%H%M%S') + '-sec11-giphy')
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


# ============================================================
# public/js/chat.js — gut the Giphy integration
# ============================================================
def fix_chat_js():
    print('[SEC-11] public/js/chat.js: removing Giphy integration')
    rel = 'public/js/chat.js'
    backup(rel)
    src = read(rel)
    if 'SEC-11 removal' in src:
        print('  SKIP (already applied)')
        return

    # ---- 1) Strip the GIF button from the pop-out chat header (line ~123) ----
    old_gif_btn_popout = "  h+='<button onclick=\"chatAddImage()\" style=\"background:none;border:none;cursor:pointer;font-size:14px;padding:4px;color:var(--tx3)\" title=\"Image / Photo\">🖼</button>';\n  h+='<button onclick=\"chatSearchGif()\" style=\"background:none;border:none;cursor:pointer;font-size:11px;padding:4px 6px;color:var(--tx3);font-weight:700;border:1px solid var(--bdr);border-radius:4px\" title=\"GIF\">GIF</button>';\n  h+='<button onclick=\"chatAddFileLink()\""
    new_gif_btn_popout = "  h+='<button onclick=\"chatAddImage()\" style=\"background:none;border:none;cursor:pointer;font-size:14px;padding:4px;color:var(--tx3)\" title=\"Image / Photo\">🖼</button>';\n  /* SEC-11 removal (2026-05-24): GIF button removed with Giphy integration */\n  h+='<button onclick=\"chatAddFileLink()\""
    src = replace_unique(src, old_gif_btn_popout, new_gif_btn_popout, 'SEC-11 pop-out GIF button')

    # ---- 2) Strip the entire GIPHY block (key declaration + 5 functions + gifSelect) ----
    # Replace from "// ── GIF PICKER (GIPHY API) ──" through end of gifSelect (just before `function icShowPreview`).
    old_giphy_block_start = "// ── GIF PICKER (GIPHY API) ──\n"
    if old_giphy_block_start not in src:
        raise RuntimeError('SEC-11 chat.js: GIPHY block start marker missing')
    start_idx = src.index(old_giphy_block_start)
    end_marker = "\n\nfunction icShowPreview(){"
    if end_marker not in src[start_idx:]:
        raise RuntimeError('SEC-11 chat.js: icShowPreview end marker missing after GIPHY block')
    end_idx = src.index(end_marker, start_idx)
    # Keep the _icPendingGif + _icReplyTo state vars (they live INSIDE this block at line 710-711).
    # Re-emit them after a stub comment, since send-message and icShowPreview depend on them.
    stub = (
        "// SEC-11 removal (2026-05-24): Giphy integration removed entirely.\n"
        "// State vars below kept so historical messages render and send-path still works.\n"
        "var _icPendingGif=null;\n"
        "var _icReplyTo=null; // {id, user, text}\n"
    )
    src = src[:start_idx] + stub + src[end_idx:]

    # ---- 3) Strip the window exports block (lines ~781-784) ----
    old_exports_1 = (
        "window.chatSearchGif=chatSearchGif;\n"
        "window.gifSaveKey=gifSaveKey;\n"
        "window.gifDoSearch=gifDoSearch;\n"
        "window.gifSelect=gifSelect;\n"
    )
    new_exports_1 = "/* SEC-11 removal: window.chatSearchGif/gifSaveKey/gifDoSearch/gifSelect removed */\n"
    src = replace_unique(src, old_exports_1, new_exports_1, 'SEC-11 first window exports')

    # ---- 4) Strip the duplicate window.chatSearchGif export (line ~914) ----
    old_exports_2 = (
        "window.chatAddImage=chatAddImage;\n"
        "window.chatSearchGif=chatSearchGif;\n"
        "window.chatAddFileLink=chatAddFileLink;\n"
    )
    new_exports_2 = (
        "window.chatAddImage=chatAddImage;\n"
        "/* SEC-11 removal: duplicate window.chatSearchGif export removed */\n"
        "window.chatAddFileLink=chatAddFileLink;\n"
    )
    src = replace_unique(src, old_exports_2, new_exports_2, 'SEC-11 duplicate chatSearchGif export')

    # ---- 5) Strip the "Add GIF" button in IC status modal (line ~2559) ----
    old_ic_status_gif_btn = (
        "  // GIF option\n"
        "  h+='<div style=\"display:flex;gap:8px;margin-bottom:12px\">';\n"
        "  h+='<button onclick=\"icStatusSearchGif()\" class=\"btn btn-ghost btn-sm\" style=\"flex:1;border-radius:10px\">🖼 Add GIF</button>';\n"
        "  h+='<div id=\"statusGifPreview\" style=\"display:none;position:relative\"><img id=\"statusGifImg\" style=\"height:40px;border-radius:6px\"><span onclick=\"document.getElementById(\\'statusGifPreview\\').style.display=\\'none\\';document.getElementById(\\'statusGifUrl\\').value=\\'\\'\" style=\"position:absolute;top:-4px;right:-4px;cursor:pointer;background:rgba(0,0,0,.7);border-radius:50%;width:14px;height:14px;font-size:8px;display:flex;align-items:center;justify-content:center;color:#fff\">&times;</span></div>';\n"
        "  h+='<input type=\"hidden\" id=\"statusGifUrl\" value=\"\">';\n"
        "  h+='</div>';\n"
    )
    new_ic_status_gif_btn = (
        "  // SEC-11 removal (2026-05-24): GIF option for status reel removed with Giphy.\n"
        "  // Hidden statusGifUrl input kept so icSubmitStatus() can still read .value=''\n"
        "  h+='<input type=\"hidden\" id=\"statusGifUrl\" value=\"\">';\n"
    )
    src = replace_unique(src, old_ic_status_gif_btn, new_ic_status_gif_btn, 'SEC-11 IC status GIF option')

    # ---- 6) Strip icStatusSearchGif + icStatusGifDoSearch + icStatusGifRender functions ----
    old_ic_status_fns_start = "\nfunction icStatusSearchGif(){\n"
    if old_ic_status_fns_start not in src:
        raise RuntimeError('SEC-11 chat.js: icStatusSearchGif start marker missing')
    s = src.index(old_ic_status_fns_start)
    end_after_render = "\nfunction icStatusPickGif(url){\n"
    if end_after_render not in src[s:]:
        raise RuntimeError('SEC-11 chat.js: icStatusPickGif end marker missing')
    e = src.index(end_after_render, s)
    src = src[:s] + (
        "\n// SEC-11 removal (2026-05-24): icStatusSearchGif + icStatusGifDoSearch + "
        "icStatusGifRender removed with Giphy.\n"
    ) + src[e+1:]

    # ---- 7) Strip the two window exports for icStatus GIF functions ----
    old_ic_exports = (
        "window.icStatusSearchGif=icStatusSearchGif;\n"
        "window.icStatusGifDoSearch=icStatusGifDoSearch;\n"
    )
    new_ic_exports = "/* SEC-11 removal: window.icStatusSearchGif/icStatusGifDoSearch removed */\n"
    src = replace_unique(src, old_ic_exports, new_ic_exports, 'SEC-11 IC status window exports')

    atomic_write(rel, src)
    verify_js(rel)
    print('  OK')


# ============================================================
# public/index.html — strip the GIF button in #icInputBar
# ============================================================
def fix_index_html():
    print('[SEC-11] public/index.html: removing GIF button from IC input bar')
    rel = 'public/index.html'
    backup(rel)
    src = read(rel)
    if 'SEC-11 removal' in src:
        print('  SKIP (already applied)')
        return
    old = '<button onclick="chatSearchGif(\'ic\')" style="background:rgba(255,255,255,.06);border:none;cursor:pointer;padding:6px 8px;border-radius:10px;font-size:10px;font-weight:700;color:var(--tx3)">GIF</button>'
    new = '<!-- SEC-11 removal (2026-05-24): GIF button removed with Giphy -->'
    src = replace_unique(src, old, new, 'SEC-11 IC GIF button')
    atomic_write(rel, src)
    print('  OK')


# ============================================================
# public/css/theme.css — strip the CSS selector that targeted the button
# ============================================================
def fix_theme_css():
    print('[SEC-11] public/css/theme.css: removing dead Giphy button CSS')
    rel = 'public/css/theme.css'
    backup(rel)
    src = read(rel)
    if 'SEC-11 removal' in src:
        print('  SKIP (already applied)')
        return
    # Be flexible — match the selector line and remove only that line.
    needle = '#icInputBar button[onclick*="chatSearchGif"],\n'
    if needle in src:
        src = src.replace(needle, '/* SEC-11 removal: chatSearchGif selector removed */\n', 1)
        atomic_write(rel, src)
        print('  OK (removed selector line)')
    else:
        print('  SKIP (selector line not found; CSS may already be clean)')


# ============================================================
# firebase.json — remove giphy hosts from CSP connect-src
# ============================================================
def fix_firebase_json():
    print('[SEC-11] firebase.json: removing api.giphy.com from CSP connect-src')
    rel = 'firebase.json'
    backup(rel)
    src = read(rel)
    if 'SEC-11 removal' in src:
        # firebase.json doesn't get a comment, but check we haven't done it already
        pass
    old = ' https://api.giphy.com https://*.giphy.com'
    if old not in src:
        print('  SKIP (giphy already absent from CSP)')
        return
    src = src.replace(old, '', 1)
    atomic_write(rel, src)
    print('  OK')


# ============================================================
# RUN
# ============================================================
def main():
    print('Applying SEC-11 (remove Giphy integration entirely)...')
    print(f'Backup dir: {BACKUP_DIR}\n')
    fix_chat_js()
    fix_index_html()
    fix_theme_css()
    fix_firebase_json()
    print('\nSEC-11 removal complete.')
    print('Next: npm run deploy  (rebuilds mfx-chat bundle without Giphy code)')
    print('Then: revoke the old Giphy API key at developers.giphy.com/dashboard')
    print('      (key value was: GDbNFd3wNVLQwb3bnFRPYinHvy8bskQT)')


if __name__ == '__main__':
    try:
        main()
    except Exception as e:
        print(f'\nFAILED: {e}', file=sys.stderr)
        print(f'Backup at: {BACKUP_DIR}', file=sys.stderr)
        sys.exit(1)
