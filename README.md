# My Places

A mobile-first PWA that maps where you've been, using your Google Maps data. India is drawn with
official (Survey of India–aligned) state boundaries, and trips abroad colour in countries and their states or provinces.
Regions are shaded by how many visits they have.

**Stack:** Next.js 16 (App Router), React 19, MongoDB/Mongoose, Auth.js (email + password), MapLibre GL,
Tailwind v4, Recharts.

## Run locally

```bash
docker compose up -d mongo        # MongoDB on :27017
cp .env.example .env.local        # then set AUTH_SECRET (openssl rand -base64 32)
npm install                       # also copies the MapLibre worker into public/
npm run dev                       # http://localhost:3000
```

To open it on your phone, run `npm run dev -- -H 0.0.0.0` and visit `http://<your-LAN-IP>:3000`.
Installing the PWA and running the service worker need HTTPS (or localhost), so for install testing use a tunnel
(e.g. `cloudflared tunnel --url http://localhost:3000`) or `npm run build && npm start` behind HTTPS.

Optional: `docker compose --profile tools up -d` starts mongo-express on :8081, and
`docker compose --profile app up --build` runs the production container.

## Importing data

| Source | What it gives |
| --- | --- |
| Google Takeout → **Maps** + **Maps (your places)** | Reviews (place, date, rating, text), Maps photo GPS, labelled places, suggested edits, geocode contributions |
| Phone **Timeline export** (`Timeline.json`, Android or iOS) | Full visit history. Google no longer includes Timeline in Takeout |
| Legacy `Semantic Location History/*.json`, `Records.json` | Older Takeout location history (raw points are collapsed to one per ~5 km per day) |
| Google Takeout → **Google Photos** | GPS and date from photo sidecar JSON |
| Manual | Search a place (Photon/OSM) or drop the crosshair, then pick a date |

Zip files are read in the browser through their central directory, so only the `.json` entries are
decompressed and only the extracted visits are uploaded. Re-importing the same export is a no-op,
because every visit has a dedupe key.

## Duplicates and counting

Every import batch (≤1000 entries) is filtered on the server, in this order:

1. **Already imported:** same source, place (~11 m), minute and name (`dedupeKey`). A unique index on `{userId, dedupeKey}` backs this up.
2. **Deleted before:** deleting an imported visit leaves a tombstone (`DeletedVisit`), so re-importing the same export doesn't bring it back. Settings → "Allow re-import" clears tombstones, and "Delete all visits" is a fresh start.
3. **Same Timeline stay from another export:** Timeline records that overlap in time (±15 min), lie within 200 m and don't have different Google place IDs are one stay. The kept record's end time is extended to cover both. Tombstoned stays count too.

Counting: a **visit** is a distinct place (~110 m cell) per calendar day (`DAY_TIMEZONE`, default `Asia/Kolkata`). A Timeline stay, three photos and a review at one spot on one day count once. "Where the data came from" still shows raw entries per source.

## Scaling

Rough sizing at 10k users with ~5k entries each: 50M visit documents, roughly 40–60 GB with indexes. A 3-node MongoDB replica set handles this; shard on `userId` beyond that.

- **Every query is per user:** they all start with `userId` and are covered by compound indexes (`userId+dedupeKey`, `userId+visitedAt`, `userId+source+visitedAt`, `userId+countryCode+stateCode`), so cost grows with one user's data, not the user base.
- **Parsing happens in the browser:** a 50 MB Timeline never reaches the server; only normalised batches do (well under the 4.5 MB body limit).
- **Import cost per batch:** three indexed reads (existing keys, tombstones, nearby stays) and one unordered `bulkWrite`. State/country lookup is memoised on an ~11 m grid (home and office hit the cache).
- **Reads are cached per user:** map, stats and points use `"use cache"`, keyed by `User.dataVersion`. Each write bumps the version, so a fresh import shows on the next request and repeat or public-profile views skip the aggregations.
- **Multiple app instances:** the default cache lives in memory per instance. It stays correct because of the version key, but each instance warms its own. Add a shared cache handler (e.g. Redis) when running several.
- **Not done yet:** rate limiting on `/api/import` and `/api/register`, an import queue if many users import at once (lookups are CPU-bound on the request thread), and paging `/api/points` for users with more than 20k entries.

## Project layout

```
scripts/prepare-geo.mjs       downloads + simplifies boundary data → data/geo (server) & public/geo (client)
src/lib/parsers/              pure parsers for every export format (unit tested against ../Takeout)
src/lib/geo/regions.ts        point-in-polygon → country + state, run at import time
src/lib/data.ts               aggregation queries (regions, stats, points, visits)
src/app/api/*                 REST routes; GETs accept ?slug= for public profiles
src/components/map/           MapLibre canvas, explorer UI, heat colours
public/sw.js                  offline shell, cached tiles/boundaries, last-seen API data
```

## Scripts

- `npm test`: Vitest (parsers + region assignment)
- `npm run geo`: rebuild boundary GeoJSON (cached downloads in `.geo-cache/`)

## Adding Google sign-in later

Add `Google` from `next-auth/providers/google` to `src/auth.ts`, set `AUTH_GOOGLE_ID` and `AUTH_GOOGLE_SECRET`,
and in the `signIn` callback link the account to the `User` by email.
