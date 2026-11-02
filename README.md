# Civic

A nonpartisan web app that turns a voter's address into a **personal voting plan** and an **interactive sample ballot**, powered by the [Google Civic Information API](https://developers.google.com/civic-information).

Enter a home address and get:

- **Voting Plan**: election date and countdown, polling place on a map with hours and notes, early-voting sites and ballot drop-off locations sorted by distance, a mail-only notice, an add-to-calendar (.ics) file, a shareable link (it never includes the home address), and links to state and local election offices.
- **Sample Ballot**: every race and measure, grouped by level (federal, state, county, city, school, judicial) in official ballot order. Candidate cards show party, photo, website and contacts. Measure cards show the summary, pro/con statements, full text and the vote needed to pass.
- **Cheat sheet**: mark your choices (saved only in your browser), then print them or save them as an image.
- **English and Español**.

Product docs are in [`docs/`](docs/): the PRD and the API overview.

## Tech

| Part | Choice |
| --- | --- |
| Frontend | React 18 + TypeScript + Vite + Tailwind CSS |
| Map | Leaflet + OpenStreetMap tiles (lazy-loaded) |
| API proxy | **Netlify Edge Functions** (`netlify/edge-functions/`) + Netlify Functions for the v1.2 features (`netlify/functions/`) |
| Address autocomplete | Photon (OpenStreetMap), proxied through the edge function |
| Distance sorting | U.S. Census geocoder, called server-side |
| Tests | Vitest |

### API endpoints (Netlify Edge Functions)

| Path | Method | What it does |
| --- | --- | --- |
| `/api/voterinfo` | `POST {address, electionId?}` | Calls Google `voterinfo`, geocodes the address, sorts locations by distance, and returns the app's own normalized types |
| `/api/elections` | `GET` | Lists elections that have data (hides Google's test elections unless `?includeTest=1`) |
| `/api/autocomplete` | `POST {q}` | U.S. address suggestions |

The endpoints:
- add the API key on the server, so it never reaches the browser
- validate input
- rate-limit per IP
- cache `voterinfo` results for 15 minutes (keyed by a SHA-256 hash of the address)
- never log addresses

The address is sent in the POST body, not the URL. The shared logic lives in `shared/` and runs the same in Deno (Netlify Edge) and Node (local dev and tests).

## Deploy to Netlify

1. In Netlify: **Add new site → Import an existing project → GitHub →** pick this repo, branch `main`.
   The build settings come from `netlify.toml` (`npm run build`, publish `dist`, edge functions in `netlify/edge-functions`).
2. Add the API key: **Site configuration → Environment variables → Add a variable**
   - Key: `GOOGLE_CIVIC_API_KEY`
   - Value: your Google Civic Information API key
   - Scopes: include **Functions**, which also covers edge functions
3. Deploy, or trigger a redeploy if the first build ran before you added the key.
4. Check it: open the site and click **"Try it with a test election"**.

> The API key is **not** in this repository. In the Google Cloud Console, restrict it under **API restrictions** to *Google Civic Information API* only. Netlify edge IPs aren't fixed, so an IP restriction won't work.

## Optional features (environment variables in Netlify)

Everything below is optional. Each feature stays hidden until its keys are set (the app checks `/api/features`).

| Feature | Variables | Notes |
| --- | --- | --- |
| AI measure summaries (FR-16) | `ANTHROPIC_API_KEY` | Claude writes a plain-language, clearly labeled summary of long measures in English or Spanish. Summaries are cached in Netlify Blobs. |
| Email reminders (FR-17) | `REMINDER_SECRET` (any long random string), `RESEND_API_KEY`, `REMINDER_FROM_EMAIL` | Double opt-in plus a one-tap unsubscribe link. Stores only the contact, language, dates and polling place, never the home address. A scheduled function sends reminders daily. |
| Text reminders (FR-17) | `REMINDER_SECRET`, `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_FROM_NUMBER` | U.S. numbers need Twilio A2P 10DLC registration before carriers deliver texts. |
| State legislators in "Who Represents Me" (FR-18) | `OPENSTATES_API_KEY` (free at openstates.org) | Without it, the page shows Congress plus the state districts and a lookup link. |
| Analytics | `VITE_PLAUSIBLE_DOMAIN` | Cookieless Plausible. Events never include addresses or choices. Also add `https://plausible.io` to `script-src` and `connect-src` in `netlify.toml`. |
| Map tiles | `VITE_MAP_TILE_URL`, `VITE_MAP_ATTRIBUTION` | Swap OpenStreetMap for a production tile provider. |

Other setup:
- **Report a problem** uses Netlify Forms: in Netlify, open **Forms** and turn on form detection, then redeploy.
- **Uptime**: `.github/workflows/uptime.yml` checks `/api/health` every 30 minutes, and GitHub emails you if it fails.
- **Load test**: `node scripts/loadtest.mjs https://civic23.netlify.app 50 10`

## Run locally

```bash
npm install
```

```bash
cp .env.example .env
```

Put your key in `.env` (it's git-ignored), then:

```bash
npm run dev
```

The Vite dev server serves the same `/api/*` handlers (see `dev/apiMiddleware.ts`), so you don't need the Netlify CLI. To develop between elections, use the test election (`electionId=2000`) through the **"Try it with a test election"** button.

```bash
npm test
```

```bash
npm run build
```

## Project layout

```
docs/                    PRD and API overview (PDF)
netlify/edge-functions/  voterinfo.ts, elections.ts, autocomplete.ts
shared/                  types, Google → app normalization, server handlers, cache, rate limit
src/                     React app (components/, lib/)
dev/                     Vite middleware that runs the edge handlers locally
tests/                   Vitest tests + fixtures from the real API (no key)
```

## Privacy and neutrality

- No accounts. Addresses aren't stored or logged on the server. Ballot choices stay in the browser's localStorage.
- No ad trackers or analytics.
- Candidates appear in official ballot order. No rankings or endorsements.
- Every piece of data is labelled as coming from an official or an unofficial source.

## Status

- **1.0:** FR-1 to FR-15.
- **1.1:** candidate detail pages, a report-a-problem form, a health check and uptime monitoring, the analytics hook, configurable map tiles, a load-test script, and an accessibility audit (axe, WCAG 2.2 AA: no violations).
- **1.2:** FR-16 AI measure summaries, FR-17 email/text reminders, FR-18 Who Represents Me.
- **Design:** liquid-glass restyle.
