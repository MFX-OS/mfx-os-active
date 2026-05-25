// MFX OS — Firestore Rules Tests
//
// Run with: cd tests && npm install && firebase emulators:exec --only firestore "npm test"
//
// These tests verify the most security-critical rules:
//   - Domain gate (only @microflexfilm.com can read)
//   - Self-edit role/dept lockdown
//   - Management-only writes on protected collections
//   - Fail-secure floor (unknown collections deny by default)
//
// This is a FOUNDATION suite. As rules grow, add tests for each new gate.

const { test, before, after, describe } = require('node:test');
const assert = require('node:assert/strict');
const {
  initializeTestEnvironment,
  assertFails,
  assertSucceeds,
} = require('@firebase/rules-unit-testing');
const fs = require('node:fs');
const path = require('node:path');

const PROJECT_ID = 'mfx-2026-test';
const RULES_PATH = path.resolve(__dirname, '..', 'firestore.rules');

let env;

before(async () => {
  env = await initializeTestEnvironment({
    projectId: PROJECT_ID,
    firestore: {
      rules: fs.readFileSync(RULES_PATH, 'utf8'),
      host: '127.0.0.1',
      port: 8080,
    },
  });
});

after(async () => {
  if (env) await env.cleanup();
});

function asMfxUser(uid, opts = {}) {
  return env.authenticatedContext(uid, {
    email: `${uid}@microflexfilm.com`,
    email_verified: true,
    name: opts.name || uid,
  }).firestore();
}

function asExternalUser(uid) {
  return env.authenticatedContext(uid, {
    email: `${uid}@example.com`,
    email_verified: true,
  }).firestore();
}

function asUnauthed() {
  return env.unauthenticatedContext().firestore();
}

async function seedUser(uid, role, dept) {
  await env.withSecurityRulesDisabled(async (ctx) => {
    await ctx.firestore().doc(`users/${uid}`).set({ role, dept });
  });
}

describe('Domain gate', () => {
  test('Unauthenticated user cannot read quotes', async () => {
    await assertFails(asUnauthed().doc('quotes/q1').get());
  });

  test('Non-microflexfilm.com user cannot read quotes', async () => {
    await assertFails(asExternalUser('outsider').doc('quotes/q1').get());
  });

  test('microflexfilm.com user can read quotes', async () => {
    await env.withSecurityRulesDisabled(async (ctx) => {
      await ctx.firestore().doc('quotes/q1').set({ status: 'draft' });
    });
    await assertSucceeds(asMfxUser('alice').doc('quotes/q1').get());
  });
});

describe('Self-role-edit lockdown', () => {
  test('User cannot change their own role', async () => {
    await seedUser('bob', 'sales', 'sales');
    await assertFails(
      asMfxUser('bob').doc('users/bob').update({ role: 'ceo' })
    );
  });

  test('User cannot change their own dept', async () => {
    await seedUser('carol', 'sales', 'sales');
    await assertFails(
      asMfxUser('carol').doc('users/carol').update({ dept: 'administration' })
    );
  });

  test('User can change their own display name', async () => {
    await seedUser('dave', 'sales', 'sales');
    await assertSucceeds(
      asMfxUser('dave').doc('users/dave').update({ displayName: 'Dave Smith' })
    );
  });

  test('Management can change another user role', async () => {
    await seedUser('eve', 'ceo', 'operations');
    await seedUser('frank', 'sales', 'sales');
    await assertSucceeds(
      asMfxUser('eve').doc('users/frank').update({ role: 'estimator' })
    );
  });
});

describe('Fail-secure floor', () => {
  test('Unknown collection: read denied', async () => {
    await env.withSecurityRulesDisabled(async (ctx) => {
      await ctx.firestore().doc('secretsNoRule/x').set({ token: 'shh' });
    });
    await assertFails(asMfxUser('alice').doc('secretsNoRule/x').get());
  });

  test('Unknown collection: write denied', async () => {
    await assertFails(
      asMfxUser('alice').doc('secretsNoRule/y').set({ data: 1 })
    );
  });
});

describe('Server-only collections', () => {
  test('No client can write to systemCounters', async () => {
    await seedUser('grace', 'ceo', 'operations');
    await assertFails(
      asMfxUser('grace').doc('systemCounters/quotes').set({ next: 999 })
    );
  });

  test('No client can write to _agentAuditLog', async () => {
    await seedUser('henry', 'ceo', 'operations');
    await assertFails(
      asMfxUser('henry').doc('_agentAuditLog/x').set({ event: 'evil' })
    );
  });
});
