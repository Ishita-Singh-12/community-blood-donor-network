# LifeLink - Community Blood Donor Network

A full-stack project for coordinating blood requests between hospitals, patients and nearby donors. The hospital dashboard shows donor availability, blood group inventory and request status. A separate donor portal receives live request alerts and lets donors respond.

Built with **React, Node.js, Express, Socket.IO and MongoDB**.

## Run locally

Install Node.js 22 or newer, then run:

```bash
npm ci && npm run demo
```

Open **http://127.0.0.1:4173**. No MongoDB account, API keys or paid service is needed for the demo. The first run downloads a MongoDB binary through `mongodb-memory-server`, so allow a little extra time and an internet connection. Linux needs MongoDB's usual runtime libraries, including OpenSSL 3; macOS and Windows are supported by the dependency but have not been tested for this project.

The demo runs a real temporary MongoDB process. Records persist during that server session and reset when the server stops. Sixteen fictional donors, two fictional hospitals, eight blood groups and three sample requests are seeded automatically. Fonts are bundled locally.

### Use a persistent database

```bash
MONGODB_URI=mongodb://127.0.0.1:27017/blood_donor_network npm run demo
```

Set environment variables in your shell or deployment tool. `.env.example` documents the supported values; copying it to `.env` alone does not load it. An empty database is seeded once, not on every restart. Use a dedicated database for this demo.

## Try the live flow

1. Open the dashboard in one browser tab and the **Donor portal** in another. Leave the donor as **Ananya Rao (O+)**.
2. In the dashboard, click **Create blood request**. Use Marina General Hospital, O+, two units, Urgent and a 15 km radius.
3. Submit the request. The donor tab receives a Socket.IO alert with the hospital, distance and proximity rank, without refreshing.
4. Click **I can help** in the donor tab. The hospital sees the response count and status change to Scheduled immediately.
5. Open request details to review matching donors, nearest first. Mark it Fulfilled after collection or cancel it.
6. Toggle donor availability in the directory or portal. Edit inventory counts in **Blood inventory** and leave the field to save. Connected dashboards update automatically.

## Features

- Responsive hospital dashboard with availability totals, community-wide inventory, low-stock indicators and a request table.
- Searchable donor directory with blood group filters and availability controls.
- Requests for hospital or patient needs, with units, priority and search radius.
- In-app alerts sent only to available, exact-blood-group donors inside the search radius.
- Haversine distance matching, ordered nearest first with distance and rank shown in the donor portal and request details.
- Donor acceptance with duplicate-response, closed-request and capacity checks. MongoDB updates prevent concurrent responses from overbooking a request.
- Open, Scheduled, Fulfilled and Cancelled statuses.
- MongoDB-backed inventory and donor state, live Socket.IO synchronization and reconnect state refresh.
- Validated inputs, API rate limiting, request body limits, keyboard-accessible dialogs and locally bundled fonts.

## How matching works

The server filters donors by current availability and **exact blood group**, calculates straight-line distance between donor and hospital coordinates, removes donors outside the requested radius, then sorts by distance. Alerts are emitted to each matching donor's Socket.IO room in that order. All matches are notified immediately; there is no timed escalation queue. Distance is not travel time.

This is coordination logic, not a medical compatibility engine. The hospital must confirm clinical eligibility, cross-matching, consent and collection. Donor acceptance does **not** create a blood unit or change inventory automatically.

## Tests

```bash
npm test
npm run test:ui
```

The test runners start an isolated server with a fresh temporary MongoDB database on a free port, then shut it down. They never use `MONGODB_URI` from your environment.

- Unit tests cover distance calculation, nearest-first ordering, radius boundaries, availability filtering and non-mutation.
- API and Socket.IO tests cover validation, targeted alerts, state broadcasts, donor acceptance, duplicate responses, concurrent capacity checks, closed requests and inventory updates.
- Browser tests open separate hospital and donor pages, create a request, verify the live alert, accept it, check hospital status, search/filter donors, edit inventory and check mobile layouts. Screenshots are saved under `artifacts/`.

Browser tests use Google Chrome at `/usr/bin/google-chrome` by default. Override it when needed:

```bash
CHROME_PATH=/path/to/chrome npm run test:ui
```

The application was tested locally on Linux with Node.js 22 and Chrome. Tests demonstrate the implemented flow, not measured emergency response-time improvement.

## Project structure

```text
client/
  index.html
  src/
    main.jsx           React views and Socket.IO state
    style.css          Responsive interface
server/
  index.js             Express API, MongoDB models and Socket.IO events
  matching.js          Distance and donor matching
  seed.js              Fictional demo records
 tests/
  matching.test.js      Matching unit tests
  api.test.js           API and realtime integration tests
  ui.mjs                Browser flow and screenshot checks
  run.mjs               Isolated test server lifecycle
vite.config.js
package.json
.env.example
```

## Scope and safety

**This is a working portfolio demo, not a live hospital system or emergency service.** All names, hospitals, stock and locations are fictional demo data. There are no real donor contacts, patient records, SMS messages or emails.

The app deliberately uses demo identity switching instead of authentication. A local visitor can act as a hospital coordinator or choose any seeded donor. Do not expose this service publicly or put real health or location data into it. It binds to loopback by default.

Before a real deployment, add authenticated accounts, role-based authorization, verified hospitals and donors, privacy/consent controls, audit trails, transport security, backups and a reviewed medical workflow. Socket.IO alerts only reach connected browser sessions. Offline users see eligible open requests when they reconnect, but there are no background push notifications or delivery guarantees. The location plot is illustrative, not a navigable map.

## Deployment preparation

See [deployment/README.md](deployment/README.md) for GitHub Pages + Render backend + persistent MongoDB setup. The manual Pages workflow requires a responding backend URL. Render static hosting is not used.
