# GitHub Actions — DISABLED

All workflow files in this directory are renamed to `.yml.disabled` because:

1. **Deploys happen manually** from `C:\Users\A10ti\OneDrive\Desktop\MFX-OS copy` via
   `npm run build && firebase deploy --only hosting:os`. GitHub Actions is not part
   of the deploy chain.

2. The previous repo (`MFX-OS/mfx-deploy`) had `FIREBASE_SERVICE_ACCOUNT` and
   `FIREBASE_TOKEN` secrets set up. This repo (`MFX-OS/mfx-os-active`) does not, so
   every push to `master` triggered a failed run + email notification.

## To re-enable (future work)

1. Rename `*.yml.disabled` back to `*.yml`
2. On GitHub, go to: **Settings → Secrets and variables → Actions**
3. Add two repository secrets:
   - `FIREBASE_SERVICE_ACCOUNT` — JSON contents of a Firebase service account key
     with Hosting Admin + Cloud Functions Developer roles. Generate via:
     `firebase projects:list` → `gcloud iam service-accounts keys create ...`
   - `FIREBASE_TOKEN` — generate via `firebase login:ci` and paste the printed token
4. Push to `master` and the workflow will run

Until then, keep deploying manually from PowerShell.
