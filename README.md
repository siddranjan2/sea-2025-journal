# SEA 2025 Journal

A travel-journal website built from our Polarsteps export of SEA 2025 (2 Feb to 19 May 2025, 50 stops, 8 countries).

`site/` is the whole website. It's plain static files with no server and no build step, so it can go on GitHub Pages, Netlify, Vercel or Cloudflare Pages as is.

## Rebuild from a Polarsteps export
1. Unzip the export into `raw/` (it is git-ignored) so that `raw/trip/sea-2025_15870409/` exists.
2. `npm install`
3. `node scripts/media.js`: photos to 1600px WebP, videos to 720p H.264 (needs ffmpeg). It prints a size budget.
4. `node scripts/build.js`: writes `site/trip.json` (stories, transport legs, route, basemap). Personal data is stripped.
5. `node scripts/web.js`: wraps `src/page.html` into `site/index.html`.
6. Preview: `npx http-server site -p 8765`

## Notes
- Transport per leg is in `LEGS` in `scripts/build.js`. "story" means it's written in the journal and "estimate" means it was inferred from GPS speed and geography. Edit it there to correct a leg.
- `src/page.html` is the page as published to the Claude artifact (no doctype). `site/index.html` is generated from it.
- Map data: Natural Earth via world-atlas, clipped to the region.
