# LifeLink - Community Blood Donor Network

A MERN coordination app with authenticated donor/hospital accounts, private realtime alerts, appointment and collection outcomes, institution-specific stock, and a Gemini-assisted request form. Clinical decisions remain with the institution.

## Local setup

Node 22+ and internet access for first install/MongoDB binary download:

```sh
npm ci
npm run demo
```

Open http://127.0.0.1:4173. Temporary local mode runs a real MongoDB **replica set**, needed for transactional acceptance and collection. Data resets on shutdown. Fictional records and demo accounts are seeded only when no external database is supplied:

| Account | Email |
|---|---|
| Hospital 1 | h1@lifelink.test |
| Hospital 2 | h2@lifelink.test |
| Donor 1 (O+) | d1@lifelink.test |
| Administrator | admin@lifelink.test |

Local-only demo password: `LifeLink-demo-2026!`. These credentials are intentionally public demo fixtures, never created in persistent mode.

## Implemented workflows

- **Accounts:** scrypt-hashed passwords, opaque HttpOnly cookie sessions stored as hashes, expiry and logout; consent-based donor/hospital registration. New donors start unavailable. Institutions need administrator approval to create requests.
- **Roles:** donors modify only their own availability/respond as themselves; coordinators access only their institution's requests, appointments and editable inventory. Admins approve/revoke institutions. Authenticated socket rooms cannot be joined by selecting another donor ID. Exact donor coordinates and emails are not sent to coordinators.
- **Matching:** exact blood group, availability and straight-line radius, ordered nearest-first. This is not a medical compatibility engine or travel-time routing.
- **Requests:** donor acceptance reserves capacity and creates an appointment record, not a blood unit. Atomic transaction protects concurrent acceptance.
- **Outcomes:** Accepted → Appointment → Attended → Collected, with explicit coordinator confirmations and validated transitions. Partial collections accumulate toward requested units; fulfillment occurs only after confirmed units meet the need. Cancellation releases reservations. Posting confirmed units to stock is a separate unchecked-by-default coordinator choice.
- **Inbox:** matching alerts are stored with seen/responded timestamps and stay available after reconnect/reload. Socket messages deliver immediate updates; persisted data owns the state.
- **Inventory:** blood-group counts belong to a hospital, include update timestamps, and keep an audit of adjustments. No external stock feed or automatic medical verification is claimed.
- **Push/PWA:** manifest, app icon and service worker; optional opt-in Web Push using VAPID. Notification text contains no patient/donor details. Unsupported or unconfigured push falls back to the inbox. Push is best-effort, not emergency delivery infrastructure.
- **Gemini assistant:** coordinator enters a short request description, Gemini returns a schema-validated draft with missing details left blank, coordinator chooses Apply and reviews all form fields before posting. It cannot submit a request by itself. No medical recommendations. Manual creation works without Gemini.

## Try the end-to-end flow

1. Sign in as hospital h1 in one browser and donor d1 in another.
2. Create an O+ request for one unit, review and confirm the fields.
3. Donor receives a live alert and a saved inbox item; choose I can help.
4. Hospital opens Appointments, schedules a future visit, confirms attendance, then confirms collected units.
5. The request becomes Fulfilled; inventory changes only if the coordinator explicitly chose to post collected units.
6. Reload donor portal: the saved alert and response history remain. Sign in as admin to review institution registrations.

## Gemini configuration

Set these securely in your shell/environment, never in frontend variables or Git:

```sh
export GEMINI_API_KEY='your-own-key'
export GEMINI_MODEL='gemini-3.8-flash'
npm run demo
```

The default model name follows current [Google structured-output documentation](https://ai.google.dev/gemini-api/docs/generate-content/structured-output); availability for your project must be verified. `GEMINI_MODEL` is configurable. Missing key, timeout, provider error or invalid output produces a manual-form fallback. Tests mock transport, not medical data. No real provider call was made during no-key validation. Check quota/billing before enabling real traffic.

The assistant warns against entering patient names, contact details or clinical records; the entered text goes to Gemini only when the user clicks Create draft. The server does not persist raw prompts or model responses. This warning is not a complete DLP system. Deploy only with a reviewed data policy.

## VAPID and push

Generate app-specific VAPID keys locally with `npx web-push generate-vapid-keys --json`, then set `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY` and `VAPID_SUBJECT` securely. Do not commit the private key. Browser push requires HTTPS or localhost, browser support and explicit permission. iOS may require installing the PWA. Known push service hosts are allowlisted to reduce SSRF risk. Delivery is not guaranteed; no real device push was tested without keys/device subscription.

## Persistent development / future hosting

Use a **dedicated new database** via `MONGODB_URI`, with replica-set/transaction support (for example Atlas). Never point this revision at StoryWeaver. Persistent mode does not seed demo users or records; bootstrap an admin explicitly:

```sh
# Set MONGODB_URI, ADMIN_EMAIL and ADMIN_PASSWORD securely first.
npm run bootstrap:admin
```

The bootstrap refuses to overwrite existing accounts. Institution registration then creates a pending institution and zeroed stock.

This revision changes the data model and cannot silently reuse the old demo database. Back up any prior data and write a reviewed migration before connecting existing datasets. `.env.example` documents process variables; copying it alone does not load them.

No deployment is configured by these updates. GitHub Pages + separate Render APIs require a reviewed cross-site cookie strategy: browser third-party-cookie policies may block the Pages/Render combination. Prefer a same-origin application or properly configured domains for authenticated hosting. Production cookies use Secure/SameSite=None; local cookies use Lax. Set exact `CLIENT_ORIGIN` and HTTPS before hosting. Free Render services can sleep; no keep-alive pings are configured. No always-on or emergency claim.

## Verification

```sh
npm test
npm run test:ui
```

Tests use isolated temporary MongoDB, never an environment `MONGODB_URI`. API tests cover role isolation, approval, alert persistence/live events, valid collection transitions, inventory posting, duplicate/concurrent acceptance, cancellation and push endpoint validation. Gemini fixture tests cover structured output, missing details and safe failure. Browser tests sign in two real local accounts, create/accept a request, confirm collection, reload the inbox and check mobile layout. Artifacts are saved under `artifacts/`. Use `CHROME_PATH` for another Chrome install.

## Limits before real use

This remains a local portfolio/pilot app, not an emergency service. Demo people and hospitals are fictional. There is no verified real hospital feed, donor screening, cross-matching, SMS/email, account email verification, password-reset flow, account deletion/export, backup policy or full operational review. Institution approval is an admin decision, not automatic legal/medical verification. Review privacy, consent, abuse controls, medical process and access rights before putting real donor/health data in it. Source control history records individual feature and fix steps.
