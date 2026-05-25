# Microflex Firebase — organization strategy

How to lay out Firebase across the public website, internal CRM, quote engine, client/vendor portals, and whatever you build next. Designed so you can scale to 5 surfaces and 50+ users without rework.

---

## What you have today

```
mfx-2026 (Firebase project · Blaze plan · org: microflexfilm.com)
├─ Web app: CORE                          (existing)
├─ Web app: Fin/Acct                      (existing)
├─ Web app: MFX-WEB                       (existing)
└─ Web app: CRM                           (added today)

Hosting sites:
├─ mfx-2026         (default — linked to MFX-WEB)
├─ mfx-2026-finance (linked to Fin/Acct)
├─ mfx-connect      (linked to CORE)
└─ mfx-crm          (linked to CRM, → crm.microflexfilm.com)
```

Everything sits in **one** project. That's been fine so far. Once you add a public marketing site, a quote engine, a client portal, and a vendor portal, this becomes a problem if you don't draw a firm line between *internal* and *external* surfaces.

---

## Three organizational models

### Model A — One project, many apps
Keep everything in `mfx-2026`. Each surface = its own web app + hosting site.

| Pros | Cons |
|---|---|
| One Auth — one sign-in across surfaces | Public users + internal users + portal customers all hit the **same** Firestore rules. One bad rule and customer-facing data leaks. |
| Shared Firestore — natural data flow CRM ↔ Quote ↔ Portal | One rate-limit bucket for everything. A traffic spike on the public site can throttle CRM. |
| Single billing line | One bug rollout affects everything |
| Cloud Functions serve all | Auditors and SOC reviewers don't love it |

### Model B — One project per surface
Separate Firebase projects for `mfx-public`, `mfx-crm`, `mfx-quote`, `mfx-portal`, `mfx-vendor`.

| Pros | Cons |
|---|---|
| Strong isolation — bug in one can't touch others | Users must sign in 5 times |
| Different rate limits per surface | Data sharing between surfaces requires explicit Pub/Sub/HTTP sync — tons of integration glue |
| Clean billing per surface | Quadruples ops, rules, CI/CD burden |
| Easier to spin off a surface to a different team / acquirer | Cross-surface workflows are a real pain |

### Model C — Hybrid: Internal vs External  *(recommended)*
Two projects, divided by **trust boundary**:

- `mfx-2026` (today's project, rename internally to "Internal") — CRM, Quote engine, Fin/Acct, CORE, future internal tools. **Workspace SSO restricted to `@microflexfilm.com`.**
- A new project `mfx-public` (or similar) — public website + customer portal + vendor portal. **No SSO restriction.** Customer portal uses email-link or custom auth.

Internal data syncs *outward* to the public project via Cloud Functions when something becomes customer-facing (a quote ready to view, an order shipped). The customer never reaches into your internal Firestore.

---

## Why hybrid wins for Microflex

The trust boundary is the real organizing principle. **Internal users** are 50 employees on `@microflexfilm.com` accounts. **External users** are thousands of brand-customer contacts at random `@gmail.com`, `@greenleaf.co`, `@zenpets.com` addresses. They have completely different:

- **Authentication** — Google Workspace SSO vs. email-link
- **Allowed actions** — full read/write across companies vs. read only their own data
- **Threat model** — insider mistakes vs. malicious outsiders
- **Compliance** — internal financial data shouldn't even share an Auth tenant with public-facing surfaces

Putting these in the same project is technically possible, but the security rules become hellish and one mistake exposes Fin/Acct or CRM data to a customer portal user. The hybrid split makes the rules trivially correct.

You still get most of the "single project" benefits inside `mfx-2026` (CRM ↔ Quote ↔ Fin/Acct flow naturally), and external surfaces stay properly walled off.

---

## Recommended structure

### Project 1 — `mfx-2026` (existing) · INTERNAL

The system of record. All sensitive data. Workspace SSO only.

**Web apps + hosting sites:**

| App | Hosting site | Custom domain | Purpose |
|---|---|---|---|
| CORE | mfx-connect | core.microflexfilm.com? *(or keep current)* | existing internal tool |
| Fin/Acct | mfx-2026-finance | finance.microflexfilm.com? | existing — internal finance |
| **CRM** | mfx-crm | **crm.microflexfilm.com** | sales · production · ops |
| **Quote engine** | mfx-quote | **quote.microflexfilm.com** | costing engine + quote generator (read by CRM, used by Sales, syncs to Public) |
| Internal admin / settings | mfx-admin | admin.microflexfilm.com | role mgmt, audit log, integration settings |
| Operator tablet PWA | mfx-floor | floor.microflexfilm.com | shop floor QR-scan PWA (Track C from roadmap) |

**Firestore collections (one shared database, role-gated):**
```
companies, contacts, products, raw_materials, art_files,
opportunities, intake_flows, quotes, sales_orders,
job_passports, tickets, production_jobs,
purchase_orders, shipments, invoices,
tasks, activities, documents,
users, audit_log, system_config
```

**Auth:** Workspace SSO with `hd: 'microflexfilm.com'` enforced.
**Custom claims:** `role` ∈ {admin, sales_mgr, sales, cs, art, buyer, planner, operator, qc, shipping, finance, exec}.
**MFA:** required for admin and finance.

### Project 2 — `mfx-public` (new) · EXTERNAL

Public-facing surfaces. Anyone can sign in with email or use it anonymously.

**Web apps + hosting sites:**

| App | Hosting site | Custom domain | Purpose |
|---|---|---|---|
| MFX-WEB *(if currently public)* | mfx-public-www | **microflexfilm.com**, www.microflexfilm.com | the marketing/landing site |
| Customer portal | mfx-customer | **my.microflexfilm.com** *or* portal.microflexfilm.com | brand-customers see their orders, COAs, reorder |
| Vendor portal | mfx-vendor | **vendors.microflexfilm.com** | suppliers confirm POs, send ASNs |

**Firestore collections (read-mostly mirrors written by Cloud Functions in Internal):**
```
public_orders, public_passports, public_invoices, public_documents,
portal_users, portal_audit,
vendor_pos, vendor_asns, vendor_users
```

Each portal user only reads `where('customer_id', '==', auth.token.customer_id)`.

**Auth:**
- Customer portal — email-link (passwordless) scoped to `portal_users` collection
- Vendor portal — email-link scoped to `vendor_users`
- Public site — no auth

**Sync from Internal → Public** via Cloud Functions in `mfx-2026`. When `sales_orders/{id}.status === 'shipped'`, a Function writes a sanitized copy to `public_orders/{id}` in `mfx-public`. The customer's portal reads that, never the original. This is the trust boundary.

---

## Naming conventions

Use these consistently from now on:

| Layer | Pattern | Example |
|---|---|---|
| Firebase project | `mfx-{role}` | `mfx-2026` (internal), `mfx-public` (external) |
| Web app nickname | Domain word, capitalized | `CRM`, `Quote`, `Customer Portal` |
| Hosting site | `mfx-{surface}` | `mfx-crm`, `mfx-quote`, `mfx-customer` |
| Subdomain | `{surface}.microflexfilm.com` | `crm.microflexfilm.com`, `quote.microflexfilm.com`, `my.microflexfilm.com`, `vendors.microflexfilm.com` |
| Firestore collections | snake_case nouns | `sales_orders`, `job_passports`, `portal_users` |
| Cloud Functions | camelCase verbs | `onSalesOrderConfirmed`, `mirrorOrderToPortal` |
| Custom claims | snake_case | `role`, `customer_id`, `vendor_id` |

This consistency matters because in 6 months when you have 8 surfaces, finding things by URL or filename should be instant.

---

## Migration plan (from where you are today)

You don't need to do all of this at once. Phase it.

### Phase A — Now (no migration cost)
1. Keep `mfx-2026` as-is. Internal-only.
2. Add the **CRM** custom domain to its current hosting site (in progress: `crm.microflexfilm.com` → `mfx-crm`).
3. When you build the **Quote engine**, add it as a new web app + hosting site `mfx-quote` in the same project. Same auth, same Firestore.

### Phase B — When you start the Customer Portal (3–6 months out)
1. Create a second Firebase project: `mfx-public`.
2. Move (or rebuild) MFX-WEB into it under hosting site `mfx-public-www`. Migrate the custom domain `microflexfilm.com`.
3. Add the Customer Portal app + hosting site `mfx-customer` → `my.microflexfilm.com`.
4. Set up the cross-project Cloud Function in `mfx-2026` that syncs sanitized data outward.

### Phase C — Vendor Portal + Operator PWA
- Vendor Portal goes in `mfx-public` under hosting site `mfx-vendor` → `vendors.microflexfilm.com`.
- Operator PWA stays in `mfx-2026` under hosting site `mfx-floor` → `floor.microflexfilm.com`. (Internal staff only — fits the trust boundary.)

### Phase D — Audit and adjust
At ~50 users / multiple portals, audit:
- Are any internal collections leaking into public reads? (Should not.)
- Is any portal user's Firestore quota maxing out? Move that surface to its own project.
- Are billing alerts firing on the right project?

---

## What stays "shared" across the two projects

A clean line between internal and external doesn't mean two completely separate worlds. These cross over:

- **Identity provider** — both can use Google Workspace's identity if you choose. Internal users are `@microflexfilm.com`, external use email-link.
- **Domain** — `microflexfilm.com` is the same root, just different subdomains.
- **Brand system** — same MFX Brand v2.1 styling across all surfaces (cream substrate, deep teal, cyan accent, Inter).
- **Source code** — keep both projects in **one monorepo** (`MFX-OS/`). Each surface lives under `apps/{name}/`. They share `packages/ui` for the brand components.

**Suggested monorepo layout:**

```
MFX-OS/
├─ apps/
│  ├─ crm/             (mfx-crm.web.app)
│  ├─ quote/           (mfx-quote.web.app)
│  ├─ admin/
│  ├─ floor/           (operator PWA)
│  ├─ public-www/      (microflexfilm.com)
│  ├─ customer-portal/ (my.microflexfilm.com)
│  └─ vendor-portal/   (vendors.microflexfilm.com)
├─ packages/
│  ├─ ui/              (MFX brand components, panels, drawers, gantt)
│  ├─ types/           (shared TS types)
│  └─ db-public/       (read-only public Firestore client)
├─ functions-internal/ (mfx-2026 Cloud Functions)
├─ functions-public/   (mfx-public Cloud Functions)
└─ infra/
   ├─ firebase.internal.json
   ├─ firebase.public.json
   └─ .firebaserc        (multi-project aliases)
```

Build commands route to the right project: `firebase deploy --project internal --only hosting:crm`, etc.

---

## Cost expectations

At 50 internal users and a customer portal serving 200 brand-customers:

| Project | Monthly cost (steady) |
|---|---|
| mfx-2026 (internal) | $80–160 — Firestore reads/writes, ~10 Functions, hosting bandwidth |
| mfx-public | $20–40 — public site is mostly static, portal traffic light |
| **Total** | **~$100–200/month** |

Compare with HubSpot Sales Pro at $90/user × 50 = $4,500/month, and you're paying ~5% of off-the-shelf for something that fits Microflex exactly.

---

## TL;DR

- Stay in **`mfx-2026`** for everything internal (CRM, Quote, Fin/Acct, CORE, Floor PWA, Admin).
- When you add a public-facing surface (customer portal, vendor portal, marketing site), put it in a **new project** — `mfx-public`.
- Use **hosting sites + custom subdomains** to keep each surface clean: `crm.`, `quote.`, `my.`, `vendors.`, `floor.`, `admin.`
- Sync data outward via Cloud Functions, never give the outside world direct access to internal Firestore.
- Keep all source code in one monorepo so brand and types stay consistent.

That gets you to 8 surfaces without rebuilding twice.
