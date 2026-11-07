# Sign-in setup: WhatsApp codes, Google, Microsoft

Everything below is switched on by environment variables in Vercel (Project, Settings, Environment Variables, Production). Nothing changes on the site until the keys exist. After saving keys, redeploy (Deployments, the latest one, Redeploy).

## 1. WhatsApp one-time codes (Meta WhatsApp Cloud API)

With these set, `/signin` becomes one screen: mobile number, then a 6-digit code on WhatsApp, then (new numbers only) a short profile. `/signup` redirects to it. A "Use a password instead" link keeps the old form, and teachers and admins always use passwords.

1. **Meta Business account.** business.facebook.com, create a business for Dhirwa. Verify it (business verification asks for trade licence details; needed to message at scale).
2. **App.** developers.facebook.com, My Apps, Create app, type "Business", add the product **WhatsApp**.
3. **Phone number.** In WhatsApp, API Setup, add the number that will send the codes. It must not already be on the WhatsApp app. Note its **Phone number ID**.
4. **Permanent token.** Business settings, Users, System users, add a system user, give it the app and the WhatsApp account, generate a token with `whatsapp_business_messaging` and `whatsapp_business_management`. A temporary token expires in 24 hours, so use the system-user token.
5. **Template.** WhatsApp Manager, Message templates, Create: category **Authentication**, name `dhirwa_login_code`, add the **copy code** button, and create it in **Arabic (ar)** and **English (en)**. Wait for approval (usually minutes to 2 days).
6. **Vercel variables:**
   - `WHATSAPP_PHONE_NUMBER_ID` = the Phone number ID
   - `WHATSAPP_ACCESS_TOKEN` = the system-user token
   - `WHATSAPP_TEMPLATE` = `dhirwa_login_code` (only if you named it differently)
   - `WHATSAPP_API_VERSION` = optional, default `v21.0`
7. Redeploy, open `/ar/signin` in a private window, enter your own number, and check the code arrives.

**Costs and abuse.** Meta charges per authentication message, by the recipient's country. The app allows 3 codes per number per 15 minutes and 10 per network address per hour, and a code allows 5 tries, but there is no daily cap across all visitors. Watch the Meta billing page for the first weeks.

**Legacy accounts.** An account made before the country-code list stores the number as typed (`0501234567`). A WhatsApp code does not open it, because that text fits more than one country; its owner signs in once with the password. Tell me if you want a link-your-number step added.

**Not on WhatsApp.** A person without WhatsApp can use the password link. Teachers' and parents' other emails (receipts, consent, reset) still go by email through Resend.

## 2. Google

1. console.cloud.google.com, create a project "Dhirwa".
2. APIs & Services, OAuth consent screen: External, app name Dhirwa, support email, **privacy policy** `https://dhirwa.ae/en/privacy`, authorised domain `dhirwa.ae`. Then **Publish** the app, or only test users can sign in.
3. Credentials, Create credentials, OAuth client ID, type Web. Authorised redirect URIs: `https://dhirwa.ae/api/auth/callback/google` (add `http://localhost:3000/api/auth/callback/google` for local work).
4. Vercel: `AUTH_GOOGLE_ID`, `AUTH_GOOGLE_SECRET`. Redeploy.

## 3. Microsoft

1. entra.microsoft.com, App registrations, New registration. Supported account types: **any organisational directory and personal Microsoft accounts**. Redirect URI (Web): `https://dhirwa.ae/api/auth/callback/microsoft-entra-id`.
2. Certificates & secrets, New client secret; copy the **Value** now.
3. Vercel: `AUTH_MICROSOFT_ENTRA_ID_ID` (Application (client) ID), `AUTH_MICROSOFT_ENTRA_ID_SECRET`. Redeploy.
4. Microsoft can create a new student account but never opens an existing one by email (it does not vouch for the address the way Google does).

## Testing the WhatsApp flow without Meta

`e2e/otp.spec.ts` runs against a local stand-in for the Meta API. In two terminals:

```bash
node -e "require('http').createServer((q,r)=>{q.resume();q.on('end',()=>{r.writeHead(200);r.end('{}')})}).listen(4010)"
```

```bash
WHATSAPP_PHONE_NUMBER_ID=stub WHATSAPP_ACCESS_TOKEN=stub WHATSAPP_API_BASE=http://localhost:4010 node scripts/e2e.mjs e2e/otp.spec.ts --project=en-desktop
```

The test plants a code whose hash it knows, so no real message is needed. Without those variables the spec skips itself.
