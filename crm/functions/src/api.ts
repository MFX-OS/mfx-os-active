/**
 * api — HTTPS Cloud Function exposed at /api/**
 *
 * Hosts callable endpoints that don't fit neatly as Firestore triggers, e.g.:
 *   POST /api/uploads/sign        → mint a signed Storage upload URL
 *   POST /api/quotes/{id}/render  → render a quote PDF on demand
 *   POST /api/passports/{id}/coa  → assemble the COA packet for a passport
 *
 * Auth is enforced by checking the Firebase Auth ID token in the header.
 */
import { onRequest } from 'firebase-functions/v2/https';
import { getAuth }   from 'firebase-admin/auth';
import { logger }    from 'firebase-functions/v2';

export const api = onRequest(
  {
    region:        'us-west1',
    cors:          ['https://crm.microflexfilm.com', 'https://staging.crm.microflexfilm.com', 'https://dev.crm.microflexfilm.com'],
    invoker:       'public',
    concurrency:   80,
  },
  async (req, res) => {
    // Verify the Firebase ID token
    const authHeader = req.header('Authorization') ?? '';
    const idToken = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;
    if (!idToken) { res.status(401).send('Missing token'); return; }

    let decoded;
    try {
      decoded = await getAuth().verifyIdToken(idToken);
    } catch (err) {
      logger.warn('Bad ID token', err);
      res.status(401).send('Invalid token');
      return;
    }

    // Route
    const path = req.path.replace(/^\/api/, '');

    try {
      if (req.method === 'POST' && path === '/uploads/sign') {
        // TODO: implement signed upload URL minting
        res.json({ ok: true, todo: 'signed-upload-url', user: decoded.uid });
        return;
      }

      const quoteRender = path.match(/^\/quotes\/([^/]+)\/render$/);
      if (req.method === 'POST' && quoteRender) {
        // TODO: render quote PDF from Docs template
        res.json({ ok: true, todo: 'render-quote-pdf', quoteId: quoteRender[1] });
        return;
      }

      const coaPath = path.match(/^\/passports\/([^/]+)\/coa$/);
      if (req.method === 'POST' && coaPath) {
        // TODO: assemble COA packet
        res.json({ ok: true, todo: 'coa-packet', passportId: coaPath[1] });
        return;
      }

      res.status(404).send('Not found');
    } catch (err) {
      logger.error('api error', err);
      res.status(500).send('Internal error');
    }
  }
);
