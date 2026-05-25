# DNS setup for crm.microflexfilm.com

The custom domain has been added in Firebase Console. Next step is one DNS record at your DNS provider (wherever microflexfilm.com is registered — Squarespace, GoDaddy, Cloudflare, etc.).

## The DNS record

| Type | Name / Host | Value | TTL |
|---|---|---|---|
| **CNAME** | `crm` *(or `crm.microflexfilm.com`, depending on your provider's UI)* | `mfx-crm.web.app` | 3600 (1 hr) or default |

That's it. One record.

> **Why CNAME and not A?** Firebase's "Quick setup" issues a CNAME at the subdomain level. Subdomains can use CNAME freely (only the bare/apex domain like `microflexfilm.com` itself needs A records). CNAME is preferred because Firebase manages the underlying IPs and can re-route traffic without you needing to update DNS.

## How long it takes

- **DNS propagation:** typically 5–60 minutes, occasionally up to 24 hours depending on your provider's TTL.
- **SSL certificate:** Firebase auto-provisions a free SSL cert from Let's Encrypt as soon as DNS resolves. Usually done within an hour after DNS is live. No action needed from you.

## After you add the record

1. Go back to: Firebase Console → Hosting → site `mfx-crm` → custom domains
2. Click **Verify** next to `crm.microflexfilm.com`
3. Wait. Firebase will check the DNS, then queue SSL provisioning automatically.
4. Once status flips to **Connected**, `https://crm.microflexfilm.com` is live.

## Troubleshooting

If verify fails:
- Confirm the record value is exactly `mfx-crm.web.app` (no trailing dot in some UIs, with trailing dot in others — both work).
- Check propagation with `nslookup crm.microflexfilm.com` — the answer should resolve to a Firebase Hosting IP.
- If your DNS provider has a "proxy" toggle (Cloudflare orange cloud), set it to **DNS only** initially so Firebase can issue the cert, then re-enable proxy if you want.

## Verify command from terminal

```bash
nslookup crm.microflexfilm.com
# Expect to see: mfx-crm.web.app or a Firebase Hosting IP

dig crm.microflexfilm.com CNAME +short
# Expect to see: mfx-crm.web.app
```
