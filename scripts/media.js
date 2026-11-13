// Converts the Polarsteps photos and videos into web-sized files under site/media
// and writes scripts/out/media.json (sizes, durations, tiny inline posters and thumbs).
// Usage: node scripts/media.js [rawTripDir]
const fs = require('fs');
const path = require('path');
const { execFileSync, execFile } = require('child_process');
const sharp = require('sharp');

const ROOT = path.join(__dirname, '..');
const RAW = process.argv[2] || path.join(ROOT, 'raw', 'trip', 'sea-2025_15870409');
const OUT = path.join(ROOT, 'site', 'media');
const META = path.join(__dirname, 'out');
const PHOTO_EDGE = 1600, PHOTO_Q = 74;
const VIDEO_CRF = Number(process.env.CRF || 28), VIDEO_MAXRATE = process.env.MAXRATE || '1600k';

fs.mkdirSync(path.join(OUT, 'photos'), { recursive: true });
fs.mkdirSync(path.join(OUT, 'videos'), { recursive: true });
fs.mkdirSync(META, { recursive: true });

const trip = JSON.parse(fs.readFileSync(path.join(RAW, 'trip.json'), 'utf8'));
const steps = trip.all_steps.slice().sort((a, b) => a.start_time - b.start_time);
const dirs = fs.readdirSync(RAW).filter(d => fs.statSync(path.join(RAW, d)).isDirectory());
const coverPrefix = (trip.cover_photo_path.split('/').pop() || '').split('_')[0];

const list = (d, ext) => (fs.existsSync(d) ? fs.readdirSync(d).filter(f => f.toLowerCase().endsWith(ext)).sort() : []);
const dataUri = buf => 'data:image/webp;base64,' + buf.toString('base64');
const ffmpeg = args => new Promise((res, rej) => execFile('ffmpeg', args, { maxBuffer: 1 << 26 }, (e, so, se) => (e ? rej(new Error(se)) : res())));
const probe = f => {
  const o = JSON.parse(execFileSync('ffprobe', ['-v', 'error', '-print_format', 'json', '-show_format', '-show_streams', f]).toString());
  const v = o.streams.find(s => s.codec_type === 'video');
  const rot = Number((v.side_data_list || []).find(s => s.rotation !== undefined)?.rotation || v.tags?.rotate || 0);
  const swap = Math.abs(rot) === 90;
  return { w: swap ? v.height : v.width, h: swap ? v.width : v.height, dur: Number(o.format.duration) };
};

async function pool(items, n, fn) {
  let i = 0;
  await Promise.all(Array.from({ length: n }, async () => { while (i < items.length) { const k = i++; await fn(items[k], k); } }));
}

(async () => {
  const media = {};
  const videoJobs = [];
  for (const [si, s] of steps.entries()) {
    const n = si + 1;
    const dir = dirs.find(d => d.endsWith('_' + s.id));
    const entry = (media[s.id] = { photos: [], videos: [], thumb: null });
    if (!dir) continue;
    let photos = list(path.join(RAW, dir, 'photos'), '.jpg');
    if (n === 1) photos.sort((a, b) => (b.startsWith(coverPrefix) ? 1 : 0) - (a.startsWith(coverPrefix) ? 1 : 0));
    for (const [k, f] of photos.entries()) {
      const src = path.join(RAW, dir, 'photos', f);
      const name = `${String(n).padStart(2, '0')}-${String(k + 1).padStart(2, '0')}.webp`;
      const dest = path.join(OUT, 'photos', name);
      const img = sharp(src).rotate();
      const info = await img.clone().resize(PHOTO_EDGE, PHOTO_EDGE, { fit: 'inside', withoutEnlargement: true }).webp({ quality: PHOTO_Q }).toFile(dest);
      const lqip = await img.clone().resize(24, 24, { fit: 'inside' }).webp({ quality: 40 }).toBuffer();
      entry.photos.push({ src: 'media/photos/' + name, w: info.width, h: info.height, lqip: dataUri(lqip) });
      if (k === 0) entry.thumb = dataUri(await img.clone().resize(112, 112, { fit: 'cover' }).webp({ quality: 62 }).toBuffer());
    }
    for (const [k, f] of list(path.join(RAW, dir, 'videos'), '.mp4').entries()) {
      const src = path.join(RAW, dir, 'videos', f);
      const name = `${String(n).padStart(2, '0')}-${String(k + 1).padStart(2, '0')}.mp4`;
      const v = { src: 'media/videos/' + name, ...probe(src), poster: null };
      entry.videos.push(v);
      videoJobs.push({ src, dest: path.join(OUT, 'videos', name), v });
    }
    process.stdout.write(`step ${n}: ${entry.photos.length} photos, ${entry.videos.length} videos\n`);
  }

  await pool(videoJobs, 3, async ({ src, dest, v }, k) => {
    const portrait = v.h > v.w;
    const scale = portrait ? 'scale=720:-2' : 'scale=-2:720';
    if (!fs.existsSync(dest)) {
      await ffmpeg(['-y', '-i', src, '-vf', scale, '-c:v', 'libx264', '-preset', 'slow', '-crf', String(VIDEO_CRF),
        '-maxrate', VIDEO_MAXRATE, '-bufsize', '3200k', '-pix_fmt', 'yuv420p', '-c:a', 'aac', '-b:a', '96k', '-ac', '2',
        '-movflags', '+faststart', dest]);
    }
    const frame = dest + '.poster.jpg';
    await ffmpeg(['-y', '-ss', String(Math.min(1, v.dur / 3)), '-i', dest, '-frames:v', '1', frame]);
    v.poster = dataUri(await sharp(frame).resize(480, 480, { fit: 'inside' }).webp({ quality: 55 }).toBuffer());
    fs.unlinkSync(frame);
    v.bytes = fs.statSync(dest).size;
    process.stdout.write(`video ${k + 1}/${videoJobs.length} ${path.basename(dest)} ${(v.bytes / 1e6).toFixed(1)} MB\n`);
  });

  fs.writeFileSync(path.join(META, 'media.json'), JSON.stringify(media));

  // Budget check against the artifact limits (256 MB and 511 files per version, 15 MB per file).
  let bytes = 0, files = 0, biggest = 0;
  for (const sub of ['photos', 'videos']) for (const f of fs.readdirSync(path.join(OUT, sub))) {
    const b = fs.statSync(path.join(OUT, sub, f)).size; bytes += b; files++; biggest = Math.max(biggest, b);
  }
  console.log(`\nBUDGET media: ${files} files, ${(bytes / 1e6).toFixed(1)} MB, largest ${(biggest / 1e6).toFixed(1)} MB`);
  if (bytes > 240e6 || files > 500 || biggest > 15e6) console.log('BUDGET WARNING: over the artifact limits, lower CRF/MAXRATE and rerun');
})().catch(e => { console.error(e); process.exit(1); });
