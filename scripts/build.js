// Builds site/trip.json from the Polarsteps export: steps, stories, transport legs,
// a simplified GPS route, per-country stats and a clipped basemap.
// Personal data (device name, user id, tracker ids, S3 links, view counts) is left out.
// Usage: node scripts/build.js [rawTripDir]
const fs = require('fs');
const path = require('path');
const topojson = require('topojson-client');
const bboxClip = require('@turf/bbox-clip').default;

const ROOT = path.join(__dirname, '..');
const RAW = process.argv[2] || path.join(ROOT, 'raw', 'trip', 'sea-2025_15870409');
const MEDIA = path.join(__dirname, 'out', 'media.json');

const trip = JSON.parse(fs.readFileSync(path.join(RAW, 'trip.json'), 'utf8'));
const gps = JSON.parse(fs.readFileSync(path.join(RAW, 'locations.json'), 'utf8')).locations.sort((a, b) => a.time - b.time);
const media = fs.existsSync(MEDIA) ? JSON.parse(fs.readFileSync(MEDIA, 'utf8')) : {};
const steps = trip.all_steps.slice().sort((a, b) => a.start_time - b.start_time);

const COUNTRY = { IN: 'India', ID: 'Indonesia', SG: 'Singapore', MY: 'Malaysia', TH: 'Thailand', KH: 'Cambodia', VN: 'Vietnam', LA: 'Laos' };

// How each leg was travelled, keyed by the number of the step it arrives at.
// "story" = said in the journal text; "estimate" = inferred from GPS speed and geography.
const LEGS = {
  2: [['flight'], 'story', 'Overnight 1 am flight from Bangalore, then a Grab to the hotel'],
  5: [['car'], 'story', 'Cab from Uluwatu with a very chatty driver'],
  8: [['car'], 'story', 'Two-hour drive from Nusa Dua'],
  9: [['car'], 'estimate', 'Day trip by car into the hills'],
  10: [['car'], 'estimate', 'Back to Ubud by road'],
  13: [['car'], 'estimate', 'Down to the coast by road'],
  14: [['bus', 'ferry'], 'story', 'Bus and ferry across to Java (take the Mtrans bus!)'],
  15: [['car'], 'estimate', 'Road trip west across East Java'],
  16: [['train'], 'estimate', 'Across Java by rail'],
  17: [['train'], 'story', 'A very long, very scenic train ride'],
  18: [['train'], 'estimate', 'Bandung to the capital'],
  19: [['flight'], 'story', 'Landed at Changi, metro straight to Bencoolen'],
  21: [['bus'], 'estimate', 'Over the causeway to Kuala Lumpur'],
  22: [['bus'], 'estimate', 'Up into the highlands'],
  23: [['bus'], 'story', 'Four hours on a very unpleasant bus'],
  24: [['bus', 'ferry'], 'story', 'Bus and ferry combo, caught only thanks to the cab driver'],
  25: [['scooter'], 'story', 'Scooter diaries around the island'],
  26: [['ferry', 'bus'], 'story', 'Ten-hour travel day: ferry, long bus, tuk tuk'],
  27: [['ferry'], 'estimate', 'Longtail boat round to Railay'],
  28: [['ferry'], 'story', 'Ferry from Krabi to Koh Tao'],
  31: [['ferry', 'car', 'flight'], 'story', 'Ferry, van, flight and cab with a furry co-passenger'],
  32: [['bus'], 'estimate', 'Over the border to Siem Reap'],
  33: [['bus', 'ferry'], 'story', 'First overnight sleeper bus, then the boat out'],
  34: [['ferry', 'bus'], 'estimate', 'Back to the mainland and on to the capital'],
  35: [['bus'], 'story', 'Bus across the border into Vietnam'],
  36: [['flight'], 'story', 'A 35-minute flight up to the hills'],
  37: [['car'], 'story', 'Three hours down the mountain in a fancy minivan'],
  38: [['flight'], 'story', 'Flight to Da Nang'],
  40: [['flight'], 'estimate', 'North to Hanoi'],
  41: [['car'], 'story', 'Day trip with the very lively Mr. Duc'],
  42: [['car', 'ferry'], 'story', 'Van to Ha Long City, then the cruise into Bai Tu Long'],
  43: [['bus', 'scooter'], 'estimate', 'Bus north, then three days on the loop'],
  44: [['bus', 'flight'], 'story', 'Bus back to Hanoi, flight into Wattay airport'],
  45: [['train'], 'story', 'Bullet train to Vang Vieng'],
  46: [['train'], 'story', 'Train north (and the same Chinese tourists again)'],
  47: [['train', 'car'], 'story', 'Slow train with hard seats, then five hours with an ex-F1 minivan driver'],
  48: [['car'], 'estimate', 'Minivan over the hills to Pai'],
  49: [['scooter', 'car'], 'story', 'Sidd rode a scooter back, the minivan took the rest'],
  50: [['flight'], 'estimate', 'Home to Bombay'],
};

const R = 6371;
const hav = (a, b) => {
  const r = Math.PI / 180, dl = (b[1] - a[1]) * r, dn = (b[0] - a[0]) * r;
  const h = Math.sin(dl / 2) ** 2 + Math.cos(a[1] * r) * Math.cos(b[1] * r) * Math.sin(dn / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
};
const pathKm = pts => pts.reduce((s, p, i) => (i ? s + hav(pts[i - 1], p) : 0), 0);

// Douglas-Peucker in lon/lat degrees.
function simplify(pts, tol) {
  if (pts.length < 3) return pts;
  const keep = new Uint8Array(pts.length); keep[0] = keep[pts.length - 1] = 1;
  const stack = [[0, pts.length - 1]];
  while (stack.length) {
    const [a, b] = stack.pop(); let idx = -1, max = tol;
    const [x1, y1] = pts[a], [x2, y2] = pts[b], dx = x2 - x1, dy = y2 - y1, len = Math.hypot(dx, dy) || 1e-12;
    for (let i = a + 1; i < b; i++) {
      const d = Math.abs(dy * pts[i][0] - dx * pts[i][1] + x2 * y1 - y2 * x1) / len;
      if (d > max) { max = d; idx = i; }
    }
    if (idx > 0) { keep[idx] = 1; stack.push([a, idx], [idx, b]); }
  }
  return pts.filter((_, i) => keep[i]);
}
const round = p => [Math.round(p[0] * 1e4) / 1e4, Math.round(p[1] * 1e4) / 1e4];

const out = steps.map((s, i) => {
  const n = i + 1, next = steps[i + 1];
  const m = media[s.id] || { photos: [], videos: [], thumb: null };
  return {
    n,
    slug: `${n}-${s.slug}`,
    title: s.display_name.trim(),
    place: s.location.name,
    country: s.location.country_code,
    lat: s.location.lat,
    lon: s.location.lon,
    tz: s.timezone_id,
    t: s.start_time,
    nights: next ? Math.max(0, Math.round((next.start_time - s.start_time) / 86400)) : 0,
    weather: s.weather_condition || null,
    temp: s.weather_temperature ?? null,
    story: (s.description || '').replace(/\r/g, '').trim(),
    photos: m.photos,
    videos: m.videos,
    thumb: m.thumb,
  };
});

const legs = [];
for (let i = 1; i < steps.length; i++) {
  const a = steps[i - 1], b = steps[i], n = i + 1;
  const A = [a.location.lon, a.location.lat], B = [b.location.lon, b.location.lat];
  const spec = LEGS[n] || [['local'], 'estimate', 'Around town'];
  const modes = spec[0];
  const raw = [A, ...gps.filter(p => p.time > a.start_time && p.time <= b.start_time).map(p => [p.lon, p.lat]), B];
  // Drop GPS jumps (flights) from ground tracks; flights are drawn as arcs.
  const ground = raw.filter((p, k) => k === 0 || hav(raw[k - 1], p) < 250);
  const isFlight = modes.includes('flight');
  const km = isFlight ? hav(A, B) : Math.max(hav(A, B), pathKm(simplify(ground, 0.004)));
  legs.push({
    to: n, from: n - 1, modes, source: spec[1], note: spec[2],
    km: Math.round(km),
    path: modes[0] === 'local' ? [] : simplify(ground, 0.012).map(round),
  });
}

// Days in each country (each step's time runs until the next step).
const countryDays = {};
out.forEach((s, i) => {
  const end = out[i + 1] ? out[i + 1].t : s.t + 86400 * 0.5;
  countryDays[s.country] = (countryDays[s.country] || 0) + (end - s.t) / 86400;
});
const modeKm = {};
// A leg that includes a flight counts as flight distance; other mixed legs split evenly.
for (const l of legs) {
  const ms = l.modes.includes('flight') ? ['flight'] : l.modes;
  for (const m of ms) modeKm[m] = (modeKm[m] || 0) + l.km / ms.length;
}

// Basemap: Natural Earth 1:50m, clipped to the region.
const topo = JSON.parse(fs.readFileSync(path.join(__dirname, 'vendor', 'countries-50m.json'), 'utf8'));
const BBOX = [66, -13, 132, 26.5];
const land = topojson.feature(topo, topo.objects.countries).features
  .map(f => {
    try { const c = bboxClip(f, BBOX); return c.geometry && c.geometry.coordinates.length ? c : null; } catch { return null; }
  })
  .filter(Boolean)
  .map(f => {
    const q = c => (typeof c[0] === 'number' ? round(c) : c.map(q));
    return { type: 'Feature', properties: { name: f.properties.name }, geometry: { type: f.geometry.type, coordinates: q(f.geometry.coordinates) } };
  })
  .filter(f => JSON.stringify(f.geometry.coordinates).length > 60);

const data = {
  name: trip.name,
  summary: trip.summary,
  start: trip.start_date,
  end: trip.end_date,
  totalKm: Math.round(trip.total_km),
  countries: COUNTRY,
  countryDays,
  modeKm,
  steps: out,
  legs,
  land: { type: 'FeatureCollection', features: land },
};

fs.mkdirSync(path.join(ROOT, 'site'), { recursive: true });
const file = path.join(ROOT, 'site', 'trip.json');
fs.writeFileSync(file, JSON.stringify(data));

const photos = out.reduce((s, x) => s + x.photos.length, 0), videos = out.reduce((s, x) => s + x.videos.length, 0);
console.log(`steps ${out.length}, legs ${legs.length}, photos ${photos}, videos ${videos}, land features ${land.length}`);
console.log('country days', Object.fromEntries(Object.entries(countryDays).map(([k, v]) => [k, +v.toFixed(1)])));
console.log('mode km', Object.fromEntries(Object.entries(modeKm).map(([k, v]) => [k, Math.round(v)])));
console.log('route points', legs.reduce((s, l) => s + l.path.length, 0), 'trip.json', (fs.statSync(file).size / 1e6).toFixed(2), 'MB');
const leak = fs.readFileSync(file, 'utf8');
for (const bad of ['OnePlus', 'user_id', 'polarsteps.s3', String(trip.user_id)]) if (leak.includes(bad)) console.log('PRIVACY WARNING: found', bad);
