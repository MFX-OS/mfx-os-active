"""
apply-sec-03-full-quote-isolation.py
====================================
SEC-03 follow-up: full per-quote upload isolation.

What was broken:
  storage.rules:portal-uploads allowed ANY authenticated user to read/write
  any file under /portal-uploads/**. A portal user with knowledge (or
  guessing) of another company's quote number could list, download, or
  overwrite that company's uploaded artwork/POs.

What changes:
  1. storage.rules — new isolated path /portal-uploads/quotes/{quoteId}/**
     Readable + writable only by:
       (a) @microflexfilm.com users (internal/company)
       (b) portal users whose authed email matches the quote's poClientEmail
           or fields.custEmail (cross-service firestore.get lookup)
     Legacy /portal-uploads/{anything-else}/** stays readable by company
     users only and BLOCKED for new writes (forces all new uploads through
     the new isolated path).

  2. public/portal.html:fallbackStorageUpload — switch upload path from
     legacy `portal-uploads/{company}/{quoteNum}/...` to new isolated
     `portal-uploads/quotes/{QUOTE_DATA.id}/...`.

Notes:
  - Existing files at legacy paths remain accessible to company/internal
    users (kept for audit + customer-service lookup). They just can't be
    written to anymore from the client.
  - firestore.get() costs 1 Firestore read per upload action. Portal upload
    volume is low (handful per quote) so cost impact is negligible.
  - This is a STORAGE RULES deploy + HOSTING deploy. Atomic if possible.

Usage:
  python3 scripts/audits/apply-sec-03-full-quote-isolation.py
"""
import os
import shutil
import sys
import datetime

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..'))
os.chdir(ROOT)

BACKUP_DIR = os.path.join('scripts', 'audits', 'fix-backups-' + datetime.datetime.utcnow().strftime('%Y%m%d-%H%M%S') + '-sec03-full')
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


def replace_unique(content, needle, replacement, what):
    count = content.count(needle)
    if count == 0:
        raise RuntimeError(f'{what}: needle not found')
    if count > 1:
        raise RuntimeError(f'{what}: needle matches {count} times (expected 1)')
    return content.replace(needle, replacement)


# ============================================================
# storage.rules — add isolated /portal-uploads/quotes/{quoteId}/ rule
# ============================================================
def fix_storage_rules():
    print('[SEC-03 full] storage.rules: add per-quote isolated path rule')
    rel = 'storage.rules'
    backup(rel)
    src = read(rel)
    if 'SEC-03 full' in src:
        print('  SKIP (already applied)')
        return

    old = """    // Portal uploads — any authenticated user (clients via email link verification).
    // SEC-03 partial fix (2026-05-24): MIME allowlist added — blocks arbitrary
    // binary/script uploads. Full per-quote isolation requires changing
    // public/portal.html upload path to use {quoteId} as the first segment
    // (currently it uses {company}/{quoteNum}/...) — that's a separate task.
    match /portal-uploads/{allPaths=**} {
      allow read: if request.auth != null;
      allow write: if request.auth != null
        && request.resource.size < 25 * 1024 * 1024
        && (request.resource.contentType.matches('application/pdf')
            || request.resource.contentType.matches('image/.*')
            || request.resource.contentType.matches('application/.*zip.*')
            || request.resource.contentType.matches('application/octet-stream')
            || request.resource.contentType.matches('application/vnd\\\\..*office.*')
            || request.resource.contentType.matches('application/vnd\\\\.openxmlformats-officedocument\\\\..*')
            || request.resource.contentType.matches('application/msword')
            || request.resource.contentType.matches('application/vnd\\\\.ms-excel')
            || request.resource.contentType.matches('text/csv')
            || request.resource.contentType.matches('text/plain'));
    }"""

    new = """    // SEC-03 full fix (2026-05-24): per-quote upload isolation.
    // Portal customers can ONLY read/write files under
    // /portal-uploads/quotes/{quoteId}/** when their authed email matches
    // the quote's stored poClientEmail or fields.custEmail. Company users
    // (@microflexfilm.com) retain full access for internal review.
    function isQuoteCustomer(quoteId) {
      return request.auth != null
        && request.auth.token.email != null
        && (
          firestore.get(/databases/(default)/documents/quotes/$(quoteId)).data.get('poClientEmail', '') == request.auth.token.email
          || firestore.get(/databases/(default)/documents/quotes/$(quoteId)).data.get('fields', {}).get('custEmail', '') == request.auth.token.email
        );
    }
    function isAllowedUploadType() {
      return request.resource.size < 25 * 1024 * 1024
        && (request.resource.contentType.matches('application/pdf')
            || request.resource.contentType.matches('image/.*')
            || request.resource.contentType.matches('application/.*zip.*')
            || request.resource.contentType.matches('application/octet-stream')
            || request.resource.contentType.matches('application/vnd\\\\..*office.*')
            || request.resource.contentType.matches('application/vnd\\\\.openxmlformats-officedocument\\\\..*')
            || request.resource.contentType.matches('application/msword')
            || request.resource.contentType.matches('application/vnd\\\\.ms-excel')
            || request.resource.contentType.matches('text/csv')
            || request.resource.contentType.matches('text/plain'));
    }

    // NEW isolated path — all new portal uploads go here.
    match /portal-uploads/quotes/{quoteId}/{allPaths=**} {
      allow read: if companyUser() || isQuoteCustomer(quoteId);
      allow write: if (companyUser() || isQuoteCustomer(quoteId)) && isAllowedUploadType();
    }

    // LEGACY path: pre-2026-05-24 uploads at portal-uploads/{company}/{quoteNum}/...
    // Read-only for company users (audit/customer-service lookup). No new writes.
    match /portal-uploads/{allPaths=**} {
      allow read: if companyUser();
      allow write: if false;
    }"""

    src = replace_unique(src, old, new, 'SEC-03 full storage rule')
    atomic_write(rel, src)
    print('  OK')


# ============================================================
# public/portal.html — switch upload path to per-quote isolated layout
# ============================================================
def fix_portal_html():
    print('[SEC-03 full] public/portal.html: upload to /quotes/{quoteId}/ path')
    rel = 'public/portal.html'
    backup(rel)
    src = read(rel)
    if 'SEC-03 full fix' in src:
        print('  SKIP (already applied)')
        return

    old = """// Fallback: upload to Firebase Storage if Cloud Function not available
function fallbackStorageUpload(f,type,itemId,arr,skuIdx){
  var company=(QUOTE_DATA&&QUOTE_DATA.fields?QUOTE_DATA.fields.custCo:'Unknown').replace(/[^a-zA-Z0-9 ]/g,'').trim();
  var qNum=QUOTE_DATA?QUOTE_DATA.quoteNum:'unknown';
  var folder=type==='po'?'PO':(skuIdx?'Art/SKU'+skuIdx:'Art');
  var path='portal-uploads/'+company+'/'+qNum+'/'+folder+'/'+Date.now()+'_'+f.name;
  var ref=storage.ref(path);"""

    new = """// Fallback: upload to Firebase Storage if Cloud Function not available.
// SEC-03 full fix (2026-05-24): upload path now uses the QUOTE_DATA.id
// (Firestore doc ID — globally unique, immutable) so storage.rules can
// scope access to only this quote's customer email. Legacy
// portal-uploads/{company}/{quoteNum}/... path is now READ-ONLY for
// company users; new writes MUST go through /quotes/{quoteId}/.
function fallbackStorageUpload(f,type,itemId,arr,skuIdx){
  var qid=QUOTE_DATA&&QUOTE_DATA.id?QUOTE_DATA.id:'unknown';
  if(qid==='unknown'){
    var st=document.querySelector('#'+itemId+' .upload-status');
    if(st)st.innerHTML='<span style="color:#ef4444">Upload failed: quote not loaded</span>';
    return;
  }
  var folder=type==='po'?'PO':(skuIdx?'Art/SKU'+skuIdx:'Art');
  var path='portal-uploads/quotes/'+qid+'/'+folder+'/'+Date.now()+'_'+f.name;
  var ref=storage.ref(path);"""

    src = replace_unique(src, old, new, 'SEC-03 full portal upload path')
    atomic_write(rel, src)
    print('  OK')


# ============================================================
# RUN
# ============================================================
def main():
    print('Applying SEC-03 full (per-quote upload isolation)...')
    print(f'Backup dir: {BACKUP_DIR}\n')
    fix_storage_rules()
    fix_portal_html()
    print('\nSEC-03 full applied.')
    print('Next:')
    print('  firebase deploy --only storage,hosting:os')
    print('After deploy, verify:')
    print('  1. Portal customer uploads to /quotes/{id}/Art/ work (logged-in as')
    print('     poClientEmail / custEmail on that quote)')
    print('  2. Same customer cannot list /quotes/{otherId}/Art/ (permission denied)')
    print('  3. Internal @microflexfilm.com users can read both old and new paths')


if __name__ == '__main__':
    try:
        main()
    except Exception as e:
        print(f'\nFAILED: {e}', file=sys.stderr)
        print(f'Backup at: {BACKUP_DIR}', file=sys.stderr)
        sys.exit(1)
