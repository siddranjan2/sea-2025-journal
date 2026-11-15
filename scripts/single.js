// Builds one self-contained, shareable HTML file: styles, d3, trip data and every photo
// (re-encoded smaller) are inlined. Videos are left out (they show their preview frame),
// since 140 MB of video would make the file too heavy to send or open.
// Usage: node scripts/single.js [outFile]   (run build.js and web.js first)
const fs = require('fs');
const path = require('path');
const sharp = require('sharp');

const ROOT = path.join(__dirname, '..');
const SITE = path.join(ROOT, 'site');
const OUT = process.argv[2] || path.join(ROOT, '..', 'SEA 2025 Journal.html');
const EDGE = 1000, QUALITY = 52;

async function d3Source() {
  const local = path.join(ROOT, 'node_modules', 'd3', 'dist', 'd3.min.js');
  if (fs.existsSync(local)) return fs.readFileSync(local, 'utf8');
  const res = await fetch('https://cdnjs.cloudflare.com/ajax/libs/d3/7.9.0/d3.min.js');
  if (!res.ok) throw new Error('could not download d3: ' + res.status);
  return res.text();
}
const inlineScript = s => s.replace(/<\/script/gi, '<\\/script');

(async () => {
  const trip = JSON.parse(fs.readFileSync(path.join(SITE, 'trip.json'), 'utf8'));
  let n = 0;
  for (const s of trip.steps) {
    for (const p of s.photos) {
      const buf = await sharp(path.join(SITE, p.src)).resize(EDGE, EDGE, { fit: 'inside', withoutEnlargement: true }).webp({ quality: QUALITY }).toBuffer();
      p.src = 'data:image/webp;base64,' + buf.toString('base64');
      if (++n % 50 === 0) console.log(`photos ${n}`);
    }
    for (const v of s.videos) v.src = null;
  }

  const html = fs.readFileSync(path.join(SITE, 'index.html'), 'utf8')
    .replace(/<link rel="stylesheet" href="style\.css[^"]*">/, () => `<style>\n${fs.readFileSync(path.join(SITE, 'style.css'), 'utf8')}\n</style>`)
    .replace(/<script src="https:\/\/cdnjs[^"]+d3[^"]*"><\/script>/, '__D3__')
    .replace(/<script src="app\.js[^"]*"><\/script>/, '__APP__');
  const d3 = await d3Source();
  const out = html
    .replace('__D3__', () => `<script>${inlineScript(d3)}</script>`)
    .replace('__APP__', () => `<script>window.TRIP_DATA = ${inlineScript(JSON.stringify(trip))};</script>\n<script>${inlineScript(fs.readFileSync(path.join(SITE, 'app.js'), 'utf8'))}</script>`);
  fs.writeFileSync(OUT, out);
  console.log(`wrote ${OUT} (${(fs.statSync(OUT).size / 1e6).toFixed(1)} MB, ${n} photos embedded, videos as preview frames)`);
})().catch(e => { console.error(e); process.exit(1); });
