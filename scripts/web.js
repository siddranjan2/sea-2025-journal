// Wraps src/page.html (the artifact page, which has no document skeleton) into a
// standalone site/index.html for local preview and any static host, with the public
// website's title, search and share tags, icons and a no-JavaScript summary.
const fs = require('fs');
const path = require('path');
const ROOT = path.join(__dirname, '..');
const { SITE_URL, TITLE, DESCRIPTION } = require('./site-meta');
const page = fs.readFileSync(path.join(ROOT, 'src', 'page.html'), 'utf8');
const attr = s => s.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');

const ld = {
  '@context': 'https://schema.org', '@type': 'Blog', name: TITLE, description: DESCRIPTION, url: SITE_URL,
  image: SITE_URL + 'og-image.jpg', inLanguage: 'en',
  about: ['India', 'Indonesia', 'Singapore', 'Malaysia', 'Thailand', 'Cambodia', 'Vietnam', 'Laos'].map(name => ({ '@type': 'Country', name })),
  temporalCoverage: '2025-02-02/2025-05-19',
};
const meta = `<link rel="canonical" href="${SITE_URL}">
<meta name="robots" content="index, follow, max-image-preview:large">
<meta name="theme-color" content="#13262d">
<link rel="icon" href="favicon.svg" type="image/svg+xml">
<link rel="icon" href="favicon-32.png" type="image/png" sizes="32x32">
<link rel="apple-touch-icon" href="apple-touch-icon.png">
<link rel="manifest" href="site.webmanifest">
<meta property="og:type" content="website">
<meta property="og:site_name" content="SEA 2025 Journal">
<meta property="og:title" content="${attr(TITLE)}">
<meta property="og:description" content="${attr(DESCRIPTION)}">
<meta property="og:url" content="${SITE_URL}">
<meta property="og:image" content="${SITE_URL}og-image.jpg">
<meta property="og:image:width" content="1200">
<meta property="og:image:height" content="630">
<meta property="og:image:alt" content="SEA 2025, Hike &amp; Seek: 106 days, 8 countries, 50 stops">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="${attr(TITLE)}">
<meta name="twitter:description" content="${attr(DESCRIPTION)}">
<meta name="twitter:image" content="${SITE_URL}og-image.jpg">
<script type="application/ld+json">${JSON.stringify(ld)}</script>
`;
const noscript = `<noscript><div style="max-width:720px;margin:40px auto;padding:0 16px;font:18px/1.6 Georgia,serif">
<h1>SEA 2025 · Hike &amp; Seek</h1><p>${attr(DESCRIPTION)}</p><p>This journal needs JavaScript for its maps, charts and photos. Please enable it to read the trip.</p></div></noscript>
`;

const head = page.slice(0, page.indexOf('<header'))
  .replace(/<title>[^<]*<\/title>/, `<title>${attr(TITLE)}</title>`)
  .replace(/<meta name="description" content="[^"]*">/, `<meta name="description" content="${attr(DESCRIPTION)}">`)
  .replace(/<meta name="claude:[^>]*>\n?/, '');
const doc = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
${head}${meta}</head>
<body>
${noscript}${page.slice(page.indexOf('<header'))}</body>
</html>
`;
// Version the CSS and JS URLs by content so browsers and the Pages CDN never serve a stale copy.
const ver = f => require('crypto').createHash('md5').update(fs.readFileSync(path.join(ROOT, 'site', f))).digest('hex').slice(0, 8);
fs.writeFileSync(path.join(ROOT, 'site', 'index.html'), doc
  .replace('href="style.css"', `href="style.css?v=${ver('style.css')}"`)
  .replace('src="app.js"', `src="app.js?v=${ver('app.js')}"`));
console.log('wrote site/index.html');
