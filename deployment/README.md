# Deploy on Render with MongoDB Atlas

The deployment uses two Render services: a static React frontend and a free Node.js web service, plus an Atlas Free database. This config does not create accounts or deploy by itself.

Use fictional data only. This is an unauthenticated public portfolio demo. Visitors can change shared donor, request and inventory data; rate limits are not authorization. Do not add real health or location data.

## Database

1. Create an Atlas Free cluster and a dedicated database user for this project.
2. Allow the Render service's outbound addresses where possible. Use a dedicated database, never an existing production database.
3. Put the connection string only in the backend's `MONGODB_URI` secret environment setting. Never commit it, put it in chat or expose it as a `VITE_*` variable.

## Backend web service

Create a **Web Service** from this repository and choose **Free**, not a paid instance. `deployment/render.yaml` documents the settings and can also be imported as a Blueprint.

- Build command: `npm ci && npm run build`
- Start command: `npm start`
- Health path: `/api/health`
- `NODE_ENV=production`
- `HOST=0.0.0.0`
- `TRUST_PROXY=1` (Render's reverse proxy)
- `CLIENT_ORIGIN`: the actual frontend origin, including `https://` and hostname, without a trailing slash or path.
- `MONGODB_URI`: secret Atlas connection string.

Render supplies `PORT`. Hosted mode refuses to use temporary MongoDB. Check that the actual backend `/api/health` returns `database: connected` before setting up the frontend.

## Static frontend

Create a **Static Site** from this same repository.

- Build command: `npm ci && npm run build`
- Publish directory: `dist`
- `VITE_API_URL`: actual HTTPS backend origin. This is public configuration, not a secret.
- Rewrite `/*` to `/index.html`.

The static site does not use the free web service's idle-sleep behavior. No GitHub Pages workflow or extra GitHub workflow permission is needed.

Update backend `CLIENT_ORIGIN` to the final static-site origin. Deploy both services and test real request creation, Socket.IO donor alerts and acceptance from separate browser tabs at the public frontend URL.

## Availability monitoring

Render Free web services can sleep after 15 minutes without incoming traffic, cold-start and restart or suspend at limits. Ordinary external HTTP uptime checks on `/api/health` can reduce idle sleep if the provider permits them, but they cannot guarantee uninterrupted availability. Configure a free external monitor only after verifying that plan, account and monitoring scope; do not add paid plans or cards. A paid instance also cannot guarantee 100% uptime.

Free usage quotas are shared across a workspace. Existing services may consume some of the included hours, build minutes or bandwidth. Verify workspace usage and billing controls before deploying. No emergency-service reliability is claimed.

## Local build

```bash
VITE_API_URL=http://127.0.0.1:4173 npm run build
```

This produces the static client bundle. The API still needs a separate running server. `npm run demo` continues to serve both locally from one process.

## Hosting references

- Render Free limits: https://render.com/docs/free
- Render static sites: https://render.com/docs/static-sites
- Atlas Free cluster setup: https://www.mongodb.com/docs/atlas/tutorial/deploy-free-tier-cluster/
