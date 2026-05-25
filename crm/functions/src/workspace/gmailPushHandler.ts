/**
 * gmailPushHandler
 *
 * Pub/Sub-triggered. Gmail's push notifications fire to a Pub/Sub topic per user
 * watch; this handler pulls the changed message, classifies the sender domain,
 * matches to a company, and writes an activity entry.
 *
 * Setup (per user, refreshed every 7 days by a scheduled job):
 *   1. User OAuth grants `gmail.readonly` and `gmail.send`
 *   2. Cloud Function calls users.watch with topic projects/{p}/topics/gmail-incoming
 *   3. Gmail pushes to Pub/Sub when new mail arrives
 *   4. Pub/Sub triggers this function
 */
import { onMessagePublished } from 'firebase-functions/v2/pubsub';
import { logger }             from 'firebase-functions/v2';
import { defineSecret }       from 'firebase-functions/params';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';
import { google } from 'googleapis';

const oauthSecret = defineSecret('google-oauth-client-secret');

interface GmailPubSubPayload {
  emailAddress: string;
  historyId:    string;
}

export const gmailPushHandler = onMessagePublished(
  {
    topic:   'gmail-incoming',
    region:  'us-west1',
    secrets: [oauthSecret],
    minInstances: 1, // keep warm — inbox responsiveness matters
  },
  async (event) => {
    const decoded = Buffer.from(event.data.message.data, 'base64').toString('utf8');
    const payload: GmailPubSubPayload = JSON.parse(decoded);
    logger.info('Gmail push received', payload);

    const db = getFirestore();

    // 1. Find the internal user that this mailbox belongs to
    const userSnap = await db
      .collection('users')
      .where('email', '==', payload.emailAddress)
      .limit(1).get();
    if (userSnap.empty) {
      logger.warn(`No internal user for ${payload.emailAddress}`);
      return;
    }
    const user = userSnap.docs[0];

    // 2. Pull the user's OAuth tokens from /users/{uid}/private/google_tokens
    const tokenSnap = await db.doc(`users/${user.id}/private/google_tokens`).get();
    if (!tokenSnap.exists) {
      logger.warn(`No tokens for ${user.id} — user must reconnect Google`);
      return;
    }

    // 3. Set up Gmail client + diff history
    const oauth2 = new google.auth.OAuth2(
      process.env.GOOGLE_OAUTH_CLIENT_ID,
      oauthSecret.value(),
    );
    oauth2.setCredentials(tokenSnap.data() as any);
    const gmail = google.gmail({ version: 'v1', auth: oauth2 });

    const lastHistoryId = (await db.doc(`system_config/gmail-history-${user.id}`).get())
      .data()?.last_history_id;

    const history = await gmail.users.history.list({
      userId:    'me',
      startHistoryId: lastHistoryId || payload.historyId,
      historyTypes: ['messageAdded'],
    });

    // 4. For each new message, classify sender → company match, log activity
    for (const h of history.data.history ?? []) {
      for (const m of h.messagesAdded ?? []) {
        const msg = await gmail.users.messages.get({ userId: 'me', id: m.message?.id! });
        const headers = msg.data.payload?.headers ?? [];
        const from    = headers.find(h => h.name === 'From')?.value ?? '';
        const subject = headers.find(h => h.name === 'Subject')?.value ?? '';

        const senderDomain = from.match(/@([^>\s]+)/)?.[1]?.toLowerCase();
        if (!senderDomain) continue;

        // Match to a company by website domain
        const companySnap = await db
          .collection('companies')
          .where('website_domain', '==', senderDomain)
          .limit(1).get();
        if (companySnap.empty) continue;

        const company = companySnap.docs[0];
        await company.ref.collection('activities').add({
          type:       'email',
          subject:    subject.slice(0, 200),
          body:       msg.data.snippet ?? '',
          gmail_msg_id:    msg.data.id,
          gmail_thread_id: msg.data.threadId,
          owner_id:   user.id,
          occurred_at: FieldValue.serverTimestamp(),
        });

        logger.info(`Logged email "${subject}" to company ${company.id}`);
      }
    }

    // 5. Save the new history id for next call
    await db.doc(`system_config/gmail-history-${user.id}`).set({
      last_history_id: payload.historyId,
      updated_at:      FieldValue.serverTimestamp(),
    }, { merge: true });
  }
);
