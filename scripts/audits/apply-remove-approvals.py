"""
apply-remove-approvals.py
=========================
Remove both internal approval flows at user request:
  1. Quote → CEO approval gate
  2. Vendor PO → CEO approval gate

Approach: NEUTER not DELETE.
  Keep submitForApproval(), vpSubmitForApproval(), vpSubmitFromDetail()
  as compat shims that promote straight to the next status (ready /
  approved). This means any leftover caller — the gamification.js wrap,
  master-automation.js references, third-party scripts, old modals — keeps
  working without errors. The functions just bypass the approval state.

  Then strip the buttons from the UI so nobody can manually invoke them.

  Customer portal SO approval (submitSOApproval in portal.html) is OUTBOUND
  customer-facing and is NOT touched.

What gets changed:
  public/js/app.js
    submitForApproval(qid)         → thin alias to markReadyDirect(qid)
  public/js/vendor-pos.js
    vpSubmitForApproval()          → auto-approve (no pending_approval state)
    vpSubmitFromDetail(vpoId)      → auto-approve from detail view
    "Submit for CEO Approval" btn  → "✓ Save & Approve"
  public/js/modules.js
    "🔒 Submit for Approval" btn   → removed (Mark Ready button stays + renamed)
    "📤 Resubmit for Approval" btn → "✓ Mark Ready" (calls markReadyDirect)

What stays:
  CEO-side approve/reject UI at modules.js:1492-1495 (dead code now but
  harmless — no quote will be in 'approval' status going forward).
  Same for VPO. Existing data is migrated via the console snippet at the
  end of this script's stdout.

Usage:
  python3 scripts/audits/apply-remove-approvals.py
"""
import os
import shutil
import subprocess
import sys
import datetime

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..'))
os.chdir(ROOT)

BACKUP_DIR = os.path.join('scripts', 'audits', 'fix-backups-' + datetime.datetime.utcnow().strftime('%Y%m%d-%H%M%S') + '-remove-approvals')
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
    # Auto-detect CRLF vs LF — most files in this repo are CRLF (Windows).
    # If the content uses CRLF, also convert needle/replacement to CRLF so
    # multi-line patterns match.
    if '\r\n' in content and '\r\n' not in needle:
        needle_crlf = needle.replace('\n', '\r\n')
        replacement_crlf = replacement.replace('\n', '\r\n')
        if needle_crlf in content:
            needle, replacement = needle_crlf, replacement_crlf
    count = content.count(needle)
    if count == 0:
        raise RuntimeError(f'{what}: needle not found')
    if count > 1:
        raise RuntimeError(f'{what}: needle matches {count} times (expected 1)')
    return content.replace(needle, replacement)


# ============================================================
# 1) app.js — neuter submitForApproval to auto-promote to 'ready'
# ============================================================
def patch_app_js():
    rel = 'public/js/app.js'
    print('[remove-approvals] app.js: neuter submitForApproval')
    backup(rel)
    src = read(rel)
    if 'APPROVAL REMOVAL (2026-05-24)' in src:
        print('  SKIP (already applied)')
        return

    old = "function submitForApproval(qid){const all=DB.quotes();const q=all.find(x=>x.id===qid);if(!q)return;\nif(!_validateQuoteForSubmit(q))return;\nq.status='approval';q.updatedAt=new Date().toISOString();q.submittedBy=getUserName();q.submittedAt=new Date().toISOString();\nlogQuoteEvent(q,'status','Submitted for approval');DB.saveQ(all,qid);DB.logActivity('quote.approval',q.quoteNum+' submitted for approval by '+getUserName());toast('Submitted for approval!','ok');notifyTeam('🔒 '+q.quoteNum+' needs approval — submitted by '+getUserName());if(S.view==='editor'){S.etab=6;renderEditor();setTimeout(renderSendPane,100)}else{renderQuotes()}}"
    new = (
        "function submitForApproval(qid){\n"
        "  // APPROVAL REMOVAL (2026-05-24): internal CEO approval gate was\n"
        "  // removed at user request. This function is kept as a compat shim\n"
        "  // that promotes straight to 'ready' so any leftover caller (the\n"
        "  // gamification.js wrap, master-automation triggers, third-party\n"
        "  // scripts) continues to work harmlessly.\n"
        "  return (typeof markReadyDirect==='function') ? markReadyDirect(qid) : null;\n"
        "}"
    )
    src = replace_unique(src, old, new, 'remove-approvals submitForApproval')
    atomic_write(rel, src)
    verify_js(rel)
    print('  OK')


# ============================================================
# 2) modules.js — strip the "Submit for Approval" button + reframe siblings
# ============================================================
def patch_modules_js():
    rel = 'public/js/modules.js'
    print('[remove-approvals] modules.js: strip approval buttons')
    backup(rel)
    src = read(rel)
    if 'APPROVAL REMOVAL (2026-05-24)' in src:
        print('  SKIP (already applied)')
        return

    # ---- DRAFT state: remove the purple "Submit for Approval" button. Keep
    #      "Mark Ready" as the SINGLE primary action. Rename it from
    #      "✓ Mark Ready (Skip Approval)" → "✓ Mark Ready to Send".
    old_draft = (
        "h+='<button onclick=\"submitForApproval(\\''+q.id+'\\')\" style=\"width:100%;padding:14px;font-size:13px;font-weight:700;background:linear-gradient(135deg,#7c3aed,#6d28d9);color:#fff;border:none;border-radius:10px;cursor:pointer;margin-bottom:8px\">🔒 Submit for Approval</button>';\n"
        "h+='<button onclick=\"markReadyDirect(\\''+q.id+'\\')\" style=\"width:100%;padding:12px;font-size:12px;font-weight:600;background:var(--bg3);color:var(--ac);border:1px solid var(--ac);border-radius:10px;cursor:pointer\">✓ Mark Ready (Skip Approval)</button></div>';"
    )
    new_draft = (
        "/* APPROVAL REMOVAL (2026-05-24): purple '🔒 Submit for Approval' button removed. */\n"
        "h+='<button onclick=\"markReadyDirect(\\''+q.id+'\\')\" style=\"width:100%;padding:14px;font-size:13px;font-weight:700;background:linear-gradient(135deg,#0ea5e9,#0284c7);color:#fff;border:none;border-radius:10px;cursor:pointer\">✓ Mark Ready to Send</button></div>';"
    )
    src = replace_unique(src, old_draft, new_draft, 'remove-approvals draft button')

    # ---- REJECTED state: change Resubmit button to "Mark Ready". Rejected
    #      quotes can still exist from before; offer the same auto-promote path.
    old_rejected = "h+='<button onclick=\"submitForApproval(\\''+q.id+'\\')\" style=\"width:100%;padding:12px;font-size:12px;font-weight:600;background:var(--bg3);color:var(--ac);border:1px solid var(--ac);border-radius:10px;cursor:pointer\">📤 Resubmit for Approval</button></div>';"
    new_rejected = "/* APPROVAL REMOVAL (2026-05-24): Resubmit-for-Approval re-routed to Mark Ready. */\nh+='<button onclick=\"markReadyDirect(\\''+q.id+'\\')\" style=\"width:100%;padding:12px;font-size:12px;font-weight:600;background:var(--bg3);color:var(--ac);border:1px solid var(--ac);border-radius:10px;cursor:pointer\">✓ Mark Ready to Send</button></div>';"
    src = replace_unique(src, old_rejected, new_rejected, 'remove-approvals rejected button')

    atomic_write(rel, src)
    verify_js(rel)
    print('  OK')


# ============================================================
# 3) vendor-pos.js — auto-approve VPOs
# ============================================================
def patch_vendor_pos_js():
    rel = 'public/js/vendor-pos.js'
    print('[remove-approvals] vendor-pos.js: auto-approve VPOs')
    backup(rel)
    src = read(rel)
    if 'APPROVAL REMOVAL (2026-05-24)' in src:
        print('  SKIP (already applied)')
        return

    # ---- "Submit for CEO Approval" button → "✓ Save & Approve"
    old_btn = "h+='<button class=\"btn btn-submit-approval\" onclick=\"vpSubmitForApproval()\" style=\"width:100%;margin-bottom:4px\"><svg width=\"14\" height=\"14\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\"><line x1=\"22\" y1=\"2\" x2=\"11\" y2=\"13\"/><polygon points=\"22 2 15 22 11 13 2 9 22 2\"/></svg> Submit for CEO Approval</button>';"
    new_btn = "/* APPROVAL REMOVAL (2026-05-24): VPO CEO approval removed; button renamed to Save & Approve */\nh+='<button class=\"btn btn-pr\" onclick=\"vpSubmitForApproval()\" style=\"width:100%;margin-bottom:4px;background:linear-gradient(135deg,#16a34a,#15803d)\"><svg width=\"14\" height=\"14\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\"><polyline points=\"20 6 9 17 4 12\"/></svg> Save & Approve</button>';"
    src = replace_unique(src, old_btn, new_btn, 'remove-approvals VPO btn')

    # ---- vpSubmitForApproval(): build doc with 'approved' instead of 'pending_approval'
    old_vsfa = (
        "function vpSubmitForApproval(){\n"
        "  var vpo=vpBuildDoc('pending_approval');if(!vpo)return;\n"
        "  if(!vpo.eta)return toast('ETA required before submitting','err');\n"
        "  vpo.submittedBy=getUserName();vpo.submittedForApprovalAt=new Date().toISOString();\n"
        "  vpoSave(vpo).then(function(){\n"
        "    notifyTeam('📤 VPO APPROVAL REQUEST: '+vpo.vpoNum+' — '+vpo.vendorName+' | '+vpo.material+' | '+fmt$(vpo.total));\n"
        "    fbDb.collection('threads').add({type:'vpo.approval_requested',vpoNum:vpo.vpoNum,vendorName:vpo.vendorName,total:vpo.total,by:getUserName(),createdAt:new Date().toISOString(),message:'📤 VPO Approval: '+vpo.vpoNum+' — '+vpo.vendorName+' '+fmt$(vpo.total)}).catch(function(e){console.warn('op:',e)});\n"
        "    toast('Submitted for approval','ok');\n"
        "    closeModal();VP.tab='pending';renderVendorPOs();\n"
        "  }).catch(function(e){toast('Error: '+e.message,'err')});\n"
        "}"
    )
    new_vsfa = (
        "function vpSubmitForApproval(){\n"
        "  // APPROVAL REMOVAL (2026-05-24): auto-approve, no CEO gate. Skip\n"
        "  // the pending_approval state and the team-notification ping.\n"
        "  var vpo=vpBuildDoc('approved');if(!vpo)return;\n"
        "  if(!vpo.eta)return toast('ETA required before saving','err');\n"
        "  vpo.submittedBy=getUserName();vpo.submittedForApprovalAt=new Date().toISOString();\n"
        "  vpo.approvedBy=getUserName();vpo.approvedAt=new Date().toISOString();\n"
        "  vpoSave(vpo).then(function(){\n"
        "    toast('VPO approved — ready to send to vendor','ok');\n"
        "    closeModal();VP.tab='approved';renderVendorPOs();\n"
        "  }).catch(function(e){toast('Error: '+e.message,'err')});\n"
        "}"
    )
    src = replace_unique(src, old_vsfa, new_vsfa, 'remove-approvals vpSubmitForApproval body')

    # ---- vpSubmitFromDetail(): auto-approve from detail view too
    old_vsfd = "function vpSubmitFromDetail(vpoId){var vpo=vpoGet(vpoId);if(!vpo)return;vpo.status='pending_approval';vpo.submittedBy=getUserName();vpo.submittedForApprovalAt=new Date().toISOString();vpo.log=vpo.log||[];vpo.log.push({action:'Submitted for approval',by:getUserName(),at:new Date().toISOString()});vpoSave(vpo).then(function(){notifyTeam('📤 VPO APPROVAL: '+vpo.vpoNum+' — '+vpo.vendorName+' '+fmt$(vpo.total));toast('Submitted','ok');vpRenderDetail()})}"
    new_vsfd = (
        "function vpSubmitFromDetail(vpoId){\n"
        "  // APPROVAL REMOVAL (2026-05-24): auto-approve from detail view.\n"
        "  var vpo=vpoGet(vpoId);if(!vpo)return;\n"
        "  vpo.status='approved';\n"
        "  vpo.submittedBy=getUserName();vpo.submittedForApprovalAt=new Date().toISOString();\n"
        "  vpo.approvedBy=getUserName();vpo.approvedAt=new Date().toISOString();\n"
        "  vpo.log=vpo.log||[];vpo.log.push({action:'Auto-approved (approval flow removed)',by:getUserName(),at:new Date().toISOString()});\n"
        "  vpoSave(vpo).then(function(){toast('Approved','ok');vpRenderDetail()});\n"
        "}"
    )
    src = replace_unique(src, old_vsfd, new_vsfd, 'remove-approvals vpSubmitFromDetail body')

    atomic_write(rel, src)
    verify_js(rel)
    print('  OK')


# ============================================================
# RUN
# ============================================================
MIGRATION_SNIPPET = """
(async()=>{
  if(!fbDb||!firebase.auth().currentUser) return "Not signed in";
  const qSnap = await fbDb.collection("quotes").where("status","==","approval").get();
  const qBatch = fbDb.batch();
  qSnap.docs.forEach(d=>qBatch.update(d.ref,{status:"ready",approvedBy:"system (approval flow removed)",approvedAt:new Date().toISOString(),updatedAt:new Date().toISOString(),autoApprovedNote:"Auto-promoted 2026-05-24: approval gate removed"}));
  if(qSnap.size) await qBatch.commit();
  const vSnap = await fbDb.collection("vpos").where("status","==","pending_approval").get();
  const vBatch = fbDb.batch();
  vSnap.docs.forEach(d=>vBatch.update(d.ref,{status:"approved",approvedBy:"system (approval flow removed)",approvedAt:new Date().toISOString(),updatedAt:new Date().toISOString(),autoApprovedNote:"Auto-promoted 2026-05-24: approval gate removed"}));
  if(vSnap.size) await vBatch.commit();
  return `Auto-promoted: ${qSnap.size} quotes, ${vSnap.size} VPOs`;
})()
"""


def main():
    print('Applying removal of internal approval flows (quotes + VPOs)...')
    print(f'Backup dir: {BACKUP_DIR}\n')
    patch_app_js()
    patch_modules_js()
    patch_vendor_pos_js()
    print('\nDone. Next:')
    print('  npm run deploy                 (rebuild bundle)')
    print('')
    print('Then paste this in DevTools console (while signed in) to migrate')
    print('any existing in-flight items in the old approval states:')
    print(MIGRATION_SNIPPET)
    print('  vSnap.docs.forEach(d=>vBatch.update(d.ref,{status:"approved",approvedBy:"system (approval flow removed)",approvedAt:new Date().toISOString(),updatedAt:new Date().toISOString(),autoApprovedNote:"Auto-promoted 2026-05-24: approval gate removed"}));')
    print('  if(vSnap.size) await vBatch.commit();')
    print('  return `Auto-promoted: ${qSnap.size} quotes, ${vSnap.size} VPOs`;')
    print('})()')


if __name__ == '__main__':
    try:
        main()
    except Exception as e:
        print(f'\nFAILED: {e}', file=sys.stderr)
        print(f'Backup at: {BACKUP_DIR}', file=sys.stderr)
        sys.exit(1)
hile signed in) to migrate')
    print('any existing in-flight items in the old approval states:')
    print(MIGRATION_SNIPPET)


if __name__ == '__main__':
    try:
        main()
    except Exception as e:
        print(f'\nFAILED: {e}', file=sys.stderr)
        print(f'Backup at: {BACKUP_DIR}', file=sys.stderr)
        sys.exit(1)
