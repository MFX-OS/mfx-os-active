# MFX OS Tests

Foundation test suite for security-critical paths. Currently covers Firestore rules; intended to grow to cover Cloud Functions and rules for new collections as they're added.

## Running rules tests

Requires the Firebase emulator (`firebase-tools` installed globally or via npx).

```bash
cd tests
npm install
firebase emulators:exec --only firestore "npm test"
```

The emulator starts a local Firestore on port 8080, loads `firestore.rules`, runs the tests, and tears down.

## What's covered

- **Domain gate** — `@microflexfilm.com` email required to read collections
- **Self-role-edit lockdown** — users cannot escalate their own `role` or `dept`
- **Fail-secure floor** — collections without explicit rules deny by default
- **Server-only collections** — `systemCounters`, `_agentAuditLog`, etc. reject client writes

## What's NOT covered yet

Adding tests for new collections is encouraged when their rules are non-trivial:

- Per-collection write authorization (canEditCommercial / canEditPPD / canEditPurchasing splits)
- Portal client scoped reads on `quotes` (poClientEmail match)
- DM participant gating
- Field validation rules (status enum, string length caps)

## When to add a test

Add a rules test when you:
1. Add a new `match /collection/{id}` block — verify reads and writes
2. Tighten an existing rule — verify the new denial actually triggers
3. Loosen an existing rule — verify the new allow doesn't leak elsewhere
4. Fix a security bug — verify the fix and prevent regression
