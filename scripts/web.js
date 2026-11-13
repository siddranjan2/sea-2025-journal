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
fs.writeFileSync(path.join(ROOT, 'site', 'index.html'), doc);
console.log('wrote site/index.html');
