// Website extras for the public site: plane favicon set, social share image, web manifest,
// robots.txt, sitemap.xml and a 404 page. Run after build.js; web.js adds the matching <head> tags.
const fs = require('fs');
const path = require('path');
const sharp = require('sharp');
const ROOT = path.join(__dirname, '..');
const SITE = path.join(ROOT, 'site');
const { SITE_URL, TITLE, DESCRIPTION } = require('./site-meta');

// Plane glyph: Material Symbols "flight" (Apache 2.0), tilted to take off.
const PLANE = 'M21 16v-2l-8-5V3.5c0-.83-.67-1.5-1.5-1.5S10 2.67 10 3.5V9l-8 5v2l8-2.5V19l-2 1.5V22l3.5-1 3.5 1v-1.5L13 19v-5.5l8 2.5z';
const icon = (pad = 0) => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64">
  <rect width="64" height="64" rx="${pad ? 0 : 14}" fill="#13262d"/>
  <g transform="translate(32 32) rotate(45) scale(${pad ? 1.55 : 1.9}) translate(-12 -12)"><path d="${PLANE}" fill="#f0ac4c"/></g>
</svg>`;

(async () => {
  fs.writeFileSync(path.join(SITE, 'favicon.svg'), icon());
  const png = (svg, size, file) => sharp(Buffer.from(svg), { density: 600 }).resize(size, size).png().toFile(path.join(SITE, file));
  await png(icon(), 32, 'favicon-32.png');
  await png(icon(1), 180, 'apple-touch-icon.png');   // iOS rounds the corners itself
  await png(icon(1), 192, 'icon-192.png');
  await png(icon(1), 512, 'icon-512.png');

  // 1200x630 share card: a trip photo with the title over a dark gradient.
  const W = 1200, H = 630;
  const photo = await sharp(path.join(SITE, 'media', 'photos', '46-09.webp')).resize(W, H, { fit: 'cover' }).toBuffer();
  const card = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}">
  <defs><linearGradient id="g" x1="0" x2="1"><stop offset="0" stop-color="#0b171b" stop-opacity=".9"/><stop offset=".65" stop-color="#0b171b" stop-opacity=".25"/><stop offset="1" stop-color="#0b171b" stop-opacity="0"/></linearGradient></defs>
  <rect width="${W}" height="${H}" fill="url(#g)"/>
  <text x="70" y="250" font-family="Georgia, serif" font-weight="700" font-size="120" fill="#fbfcf9">SEA</text>
  <text x="70" y="380" font-family="Georgia, serif" font-weight="700" font-size="120" fill="#f0ac4c">2025</text>
  <text x="74" y="450" font-family="Georgia, serif" font-style="italic" font-size="44" fill="#fbfcf9">Hike &amp; Seek</text>
  <text x="74" y="540" font-family="Consolas, monospace" font-size="26" letter-spacing="3" fill="#dbe7e6">106 DAYS · 8 COUNTRIES · 50 STOPS · 21,402 KM</text>
</svg>`;
  await sharp(photo).composite([{ input: Buffer.from(card) }]).jpeg({ quality: 82, mozjpeg: true }).toFile(path.join(SITE, 'og-image.jpg'));

  fs.writeFileSync(path.join(SITE, 'site.webmanifest'), JSON.stringify({
    name: TITLE, short_name: 'SEA 2025', description: DESCRIPTION, start_url: './', scope: './', display: 'standalone',
    background_color: '#eef2ee', theme_color: '#13262d',
    icons: [{ src: 'icon-192.png', sizes: '192x192', type: 'image/png' }, { src: 'icon-512.png', sizes: '512x512', type: 'image/png' }, { src: 'favicon.svg', sizes: 'any', type: 'image/svg+xml' }],
  }, null, 2));

  const today = new Date().toISOString().slice(0, 10);
  fs.writeFileSync(path.join(SITE, 'robots.txt'), `User-agent: *\nAllow: /\n\nSitemap: ${SITE_URL}sitemap.xml\n`);
  fs.writeFileSync(path.join(SITE, 'sitemap.xml'), `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url><loc>${SITE_URL}</loc><lastmod>${today}</lastmod></url>
</urlset>
`);
  fs.writeFileSync(path.join(SITE, '404.html'), `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>Page not found · SEA 2025</title><meta name="robots" content="noindex">
<link rel="icon" href="${SITE_URL}favicon.svg" type="image/svg+xml">
<style>body{margin:0;min-height:100vh;display:grid;place-items:center;background:#eef2ee;color:#13262d;font:18px/1.5 Georgia,serif;text-align:center;padding:16px}a{color:#8a4f00}h1{font-size:44px;margin:0 0 8px}</style></head>
<body><main><h1>Off the map</h1><p>This page took a wrong turn somewhere in Southeast Asia.</p><p><a href="${SITE_URL}">Back to the SEA 2025 journal →</a></p></main></body></html>
`);
  console.log('wrote favicons, og-image.jpg, site.webmanifest, robots.txt, sitemap.xml, 404.html');
})().catch(e => { console.error(e); process.exit(1); });
