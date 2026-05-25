# Microflex CRM — local project

Wired to your existing **MFX-OS** Firebase project (id `mfx-2026`).

| Surface | Where |
|---|---|
| Firebase project | `mfx-2026` (MFX-OS) — Blaze plan |
| Web app | **CRM** |
| Hosting site | `mfx-crm` → default URL `mfx-crm.web.app` |
| Custom domain (next step) | `crm.microflexfilm.com` |
| Other apps in this project | CORE · Fin/Acct · MFX-WEB *(not touched)* |

The full scaffold lives at `outputs/microflex-firebase/` — copy the rest of those files (functions/, firestore.rules, firestore.indexes.json, storage.rules, scripts/, .github/workflows/) into this folder when you want to deploy.

---

## What's already configured here

- `.firebaserc` — points at project `mfx-2026`, hosting target `crm` → site `mfx-crm`
- `firebase.json` — single hosting site (the CRM), Functions in `us-west1`, security headers, full emulator suite
- `apps/web/.env.local` — real Firebase config keys for the CRM app
- `apps/web/src/lib/firebase.ts` — SDK init reading from env

## To deploy

```bash
# from this folder
firebase login                              # if not already
firebase use mfx-2026
firebase deploy --only hosting:crm          # deploy the CRM hosting site
```

## To attach `crm.microflexfilm.com`

In the Firebase Console → Hosting → site `mfx-crm` → **Add custom domain** → enter `crm.microflexfilm.com`. Firebase will give you a TXT record to verify ownership and an A record to point DNS at. Add both at your DNS provider.

## What's *not* affected

The existing MFX-OS apps (CORE, Fin/Acct, MFX-WEB) and their hosting sites (mfx-2026, mfx-2026-finance, mfx-connect) are completely untouched. The CRM is its own web app with its own hosting site.
