# Split deployment: GitHub Pages + Node backend + MongoDB

These files prepare deployment; they do not create accounts, buy services or deploy by themselves. The Pages workflow is manual and stops if no responding backend URL has been configured.

## Required services

- GitHub Pages for the React build.
- A Node web service that supports Socket.IO/WebSockets, such as Render.
- A dedicated persistent MongoDB database, such as an Atlas Free cluster.

A public portfolio demo should contain fictional data only. There is no authentication or role isolation in this demo; visitors can change shared demo data. Rate limits reduce casual misuse but are not authorization. Do not put real donor, hospital or patient data here.

## Backend

1. Create a MongoDB Atlas Free cluster and a dedicated database user. Allow only the hosting service's outbound addresses when possible. Save the connection string in the host's secret environment settings, not GitHub source or chat.
2. Import `deployment/render.yaml` in Render, or create a free Node web service from this repository manually.
3. Build: `npm ci --include=dev && npm run build`. Start: `npm start`. Health endpoint: `/api/health`.
4. Environment: `NODE_ENV=production`, `HOST=0.0.0.0`, `TRUST_PROXY=1`, `MONGODB_URI` as a secret, and `CLIENT_ORIGIN` set to the actual Pages origin (scheme and hostname, no repository path).
5. The host supplies `PORT`. Never replace its value with the local demo port.
6. Check `/api/health` reports `database: connected`, then verify state and Socket.IO from a frontend browser.

Render Free services sleep after 15 minutes without traffic and may take about a minute to wake. Their disk is ephemeral and their RAM is limited. Hosted mode requires `MONGODB_URI` and refuses to fall back to a temporary MongoDB process. These limits mean this is a portfolio demo, not reliable emergency infrastructure.

## Frontend

1. Set repository Actions variable `VITE_API_URL` to the verified HTTPS backend URL without a trailing slash. This URL is public, not a secret. Never put database credentials in frontend variables.
2. Configure Pages source as **GitHub Actions**.
3. Run **Deploy frontend to GitHub Pages** manually. Vite uses the repository name as its base path so assets work below a project Pages URL.
4. Open the actual deployment URL returned by GitHub. Verify request creation, donor alert and acceptance across separate tabs, not only that the HTML loads.

## Local build check

```bash
VITE_API_URL=http://127.0.0.1:4173 VITE_BASE_PATH=/community-blood-donor-network/ npm run build
```

That prepares the static bundle only. The backend must still run separately. Default `npm run demo` remains same-origin local hosting.

## Current sources for hosting limits

- GitHub Pages is static: https://docs.github.com/en/pages/getting-started-with-github-pages/about-github-pages
- Render Free limits: https://render.com/docs/free
- Atlas Free cluster setup: https://www.mongodb.com/docs/atlas/tutorial/deploy-free-tier-cluster/

## Shared free-hour pool

The workspace includes other projects. A 24/7 service can consume 744 of 750 monthly free hours in a 31-day month, leaving only six hours for other services. Do not enable continuous pings without an approved quota-safe monitoring window. Do not suspend or change other projects to make room.

## Selected availability mode

Deploy without keep-alive pings or external uptime-monitor traffic. The free Render backend can sleep while idle and take about a minute to wake when the demo is opened. The frontend remains static. No automatic monitoring window or always-on guarantee is configured.
