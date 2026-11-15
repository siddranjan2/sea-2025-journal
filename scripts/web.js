// Wraps src/page.html (the artifact page, which has no document skeleton) into a
// standalone site/index.html for local preview and any static host.
const fs = require('fs');
const path = require('path');
const ROOT = path.join(__dirname, '..');
const page = fs.readFileSync(path.join(ROOT, 'src', 'page.html'), 'utf8');
const doc = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
${page.slice(0, page.indexOf('<header'))}</head>
<body>
${page.slice(page.indexOf('<header'))}</body>
</html>
`;
// Version the CSS and JS URLs by content so browsers and the Pages CDN never serve a stale copy.
const ver = f => require('crypto').createHash('md5').update(fs.readFileSync(path.join(ROOT, 'site', f))).digest('hex').slice(0, 8);
fs.writeFileSync(path.join(ROOT, 'site', 'index.html'), doc
  .replace('href="style.css"', `href="style.css?v=${ver('style.css')}"`)
  .replace('src="app.js"', `src="app.js?v=${ver('app.js')}"`));
console.log('wrote site/index.html');
