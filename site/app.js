/* SEA 2025 journal: renders trip.json into the hero, route map, charts and chapters. */
(() => {
  'use strict';

  const ICON = {
    flight: '<path d="M17.8 19.2 16 11l3.5-3.5C21 6 21.5 4 21 3c-1-.5-3 0-4.5 1.5L13 8 4.8 6.2c-.5-.1-.9.1-1.1.5l-.3.5c-.2.5-.1 1 .3 1.3L9 12l-2 3H4l-1 1 3 2 2 3 1-1v-3l3-2 3.5 5.3c.3.4.8.5 1.3.3l.5-.2c.4-.3.6-.7.5-1.2z"/>',
    train: '<rect x="5" y="3" width="14" height="14" rx="3"/><path d="M5 10h14M12 3v7M8 21l2-4M16 21l-2-4"/><circle cx="9" cy="13.5" r=".6"/><circle cx="15" cy="13.5" r=".6"/>',
    bus: '<path d="M8 6v6M15 6v6M2 12h19.6M18 18h3s.5-1.7.8-2.8c.1-.4.2-.8.2-1.2s-.1-.8-.2-1.2l-1.4-5C20.1 6.8 19.1 6 18 6H4a2 2 0 0 0-2 2v10h3"/><circle cx="7" cy="18" r="2"/><path d="M9 18h5"/><circle cx="16" cy="18" r="2"/>',
    car: '<path d="M19 17h2c.6 0 1-.4 1-1v-3c0-.9-.7-1.7-1.5-1.9C18.7 10.6 16 10 16 10s-1.3-1.4-2.2-2.3c-.5-.4-1.1-.7-1.8-.7H5c-.6 0-1.1.4-1.4.9l-1.4 2.9A3.7 3.7 0 0 0 2 12v4c0 .6.4 1 1 1h2"/><circle cx="7" cy="17" r="2"/><path d="M9 17h6"/><circle cx="17" cy="17" r="2"/>',
    ferry: '<path d="M2 21c.6.5 1.2 1 2.5 1 2.5 0 2.5-2 5-2 1.3 0 1.9.5 2.5 1 .6.5 1.2 1 2.5 1 2.5 0 2.5-2 5-2 1.3 0 1.9.5 2.5 1"/><path d="M19.4 20A11.6 11.6 0 0 0 21 14l-9-4-9 4c0 2.9.9 5.3 2.8 7.8"/><path d="M19 13V7a2 2 0 0 0-2-2H7a2 2 0 0 0-2 2v6M12 10v4M12 2v3"/>',
    scooter: '<circle cx="5.5" cy="17.5" r="3.5"/><circle cx="18.5" cy="17.5" r="3.5"/><path d="M5.5 17.5h7l3-7h-4M15 6h3l.5 4.5 0 7"/>',
    local: '<circle cx="13" cy="4" r="2"/><path d="m9 20 3-6 2 2v6M7 10l4-3 3 3 3 1M10 14l-2.5 6"/>',
  };
  const MODE_NAME = { flight: 'Flight', train: 'Train', bus: 'Bus', car: 'Car & van', ferry: 'Ferry & boat', scooter: 'Scooter', local: 'Around town' };
  const MODE_ORDER = ['flight', 'bus', 'train', 'car', 'ferry', 'scooter', 'local'];
  const WX = {
    sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/>',
    moon: '<path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z"/>',
    partly: '<path d="M12 2v2M4.9 4.9l1.4 1.4M20 12h2M19.1 4.9l-1.4 1.4M15.9 13A4 4 0 0 0 8.3 10.6"/><path d="M13 22H7a5 5 0 1 1 4.9-6H13a3 3 0 0 1 0 6Z"/>',
    cloud: '<path d="M17.5 19H9a7 7 0 1 1 6.7-9h1.8a4.5 4.5 0 1 1 0 9Z"/>',
    rain: '<path d="M4 14.9A7 7 0 1 1 15.7 8h1.8a4.5 4.5 0 0 1 2.5 8.2"/><path d="M16 14v6M8 14v6M12 16v6"/>',
  };
  const wxKind = c => !c ? null : /rain|thunder|storm|sleet/.test(c) ? 'rain' : /partly/.test(c) ? 'partly' : /cloud|fog|wind/.test(c) ? 'cloud' : /night/.test(c) ? 'moon' : 'sun';
  const WX_NAME = { sun: 'Sunny', moon: 'Clear night', partly: 'Partly cloudy', cloud: 'Cloudy', rain: 'Rain' };
  const svgIcon = (body, extra = '') => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" ${extra}>${body}</svg>`;
  const $ = s => document.querySelector(s);
  const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const css = name => getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  const fmtDate = (t, tz, opts = { day: 'numeric', month: 'short' }) => new Intl.DateTimeFormat('en-GB', { ...opts, timeZone: tz || 'Asia/Kolkata' }).format(new Date(t * 1000));
  const fmtKm = km => Math.round(km).toLocaleString('en-IN');
  const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;

  let T, S, LEGS, LEG_BY_TO, mapApi;

  // The single-file export embeds the data as window.TRIP_DATA; the site fetches trip.json.
  (window.TRIP_DATA ? Promise.resolve(window.TRIP_DATA) : fetch('trip.json').then(r => { if (!r.ok) throw new Error(r.status); return r.json(); })).then(init).catch(err => {
    $('#chapters').innerHTML = `<p class="section">The trip data didn't load (${esc(err.message)}). Reload the page to try again.</p>`;
  });

  function init(data) {
    T = data; S = data.steps; LEGS = data.legs;
    LEG_BY_TO = Object.fromEntries(LEGS.map(l => [l.to, l]));
    S.forEach(s => { s.media = [...s.photos.map(p => ({ ...p, type: 'photo' })), ...s.videos.map(v => ({ ...v, type: 'video' }))]; });
    renderHero();
    renderStrip();
    mapApi = renderMap();
    renderTimeline();
    renderModes();
    renderHops();
    renderStamps();
    renderRecords();
    renderDistance();
    renderCoffee();
    renderThemes();
    renderMemories();
    renderStays();
    renderChapters();
    wireButtons();
    wireTabs();
  }

  /* ---------------- tabs: Overview and Journal ---------------- */
  let currentTab = 'overview';
  function showTab(name) {
    if (name === currentTab) return;
    currentTab = name;
    ['overview', 'journal'].forEach(t => {
      $(`#tab-${t}`).hidden = t !== name;
      $(`#tabbtn-${t}`).setAttribute('aria-selected', String(t === name));
    });
    $('#strip').hidden = $('#stripLabel').hidden = name !== 'journal';
  }
  // Which tab an element id lives in; scrolls to it after switching.
  function goTo(id, smooth = true) {
    if (id === 'overview' || id === 'journal') { showTab(id); window.scrollTo({ top: 0, behavior: 'instant' }); return; }
    const el = document.getElementById(id);
    if (!el) return;
    const tab = el.closest('[role="tabpanel"]');
    const switching = tab && tab.id !== `tab-${currentTab}`;
    if (tab) showTab(tab.id.slice(4));
    requestAnimationFrame(() => el.scrollIntoView({ behavior: switching || !smooth || reduceMotion ? 'instant' : 'smooth' }));
  }
  function wireTabs() {
    document.addEventListener('click', e => {
      const a = e.target.closest('a[href^="#"]');
      if (!a || e.defaultPrevented) return;
      const id = a.getAttribute('href').slice(1);
      if (!id) return;
      e.preventDefault();
      try { history.pushState(null, '', '#' + id); } catch { /* sandboxed frames may refuse */ }
      goTo(id);
    });
    window.addEventListener('popstate', () => goTo(location.hash.slice(1) || 'overview', false));
    if (location.hash.length > 1) setTimeout(() => goTo(location.hash.slice(1), false), 60);
  }

  const primaryMode = leg => (leg.modes.includes('flight') ? 'flight' : leg.modes[0]);
  const countryRuns = () => {
    const runs = [];
    S.forEach(s => { const r = runs[runs.length - 1]; if (r && r.code === s.country) r.steps.push(s); else runs.push({ code: s.country, steps: [s] }); });
    return runs;
  };

  /* ---------------- hero ---------------- */
  function renderHero() {
    const picks = [2, 43, 14].map(n => S[n - 1]).filter(s => s && s.photos.length);
    $('#polaroids').innerHTML = picks.map(s => {
      const p = s.photos[s.n === 43 ? 1 : 0] || s.photos[0];
      return `<figure class="polaroid" style="margin:0"><a href="#s-${s.n}"><img src="${p.src}" alt="${esc(s.title)}" style="background-image:url('${p.lqip}');background-size:cover"></a><figcaption>${esc(s.title)}</figcaption></figure>`;
    }).join('');
    const photos = S.reduce((a, s) => a + s.photos.length, 0), videos = S.reduce((a, s) => a + s.videos.length, 0);
    const days = Math.round((T.end - T.start) / 86400);
    const stats = [[days, 'days'], [Object.keys(T.countryDays).length, 'countries'], [S.length, 'stops'], [fmtKm(T.totalKm), 'km travelled'], [photos, 'photos'], [videos, 'videos']];
    $('#stats').innerHTML = stats.map(([v, l]) => `<div><b>${v}</b><span>${l}</span></div>`).join('');
    // "On this day": a stop that started on today's day and month.
    const now = new Date();
    const today = `${now.getDate()} ${now.toLocaleString('en-GB', { month: 'short' })}`;
    const hit = S.find(s => fmtDate(s.t, s.tz) === today);
    if (hit) {
      const yrs = now.getFullYear() - 2025;
      $('#onThisDay').innerHTML = `<a class="onthisday" href="#s-${hit.n}"><span class="hand" style="font-size:20px">On this day</span> <span>${yrs > 0 ? yrs + (yrs > 1 ? ' years' : ' year') + ' ago' : 'in 2025'} you were in <b>${esc(hit.title)}</b> →</span></a>`;
    }
  }

  /* ---------------- top progress strip ---------------- */
  function renderStrip() {
    const total = T.end - T.start;
    const runs = countryRuns();
    $('#strip').innerHTML = runs.map((r, i) => {
      const next = runs[i + 1]; const end = next ? next.steps[0].t : T.end;
      return `<span style="width:${((end - r.steps[0].t) / total) * 100}%;background:var(--c-${r.code})"></span>`;
    }).join('') + '<i id="stripMark" style="left:0"></i>';
  }
  function setActive(s) {
    const pct = ((s.t - T.start) / (T.end - T.start)) * 100;
    const m = $('#stripMark'); if (m) m.style.left = `calc(${pct}% - 1px)`;
    $('#stripLabel').textContent = `${s.n} · ${s.title} · ${T.countries[s.country]}`;
  }

  /* ---------------- route map ---------------- */
  function renderMap() {
    const svgEl = $('#map');
    const svg = d3.select(svgEl);
    const card = $('#mapcard');
    let W = svgEl.clientWidth, H = svgEl.clientHeight;
    svg.attr('viewBox', `0 0 ${W} ${H}`);
    const pad = W < 600 ? 30 : 70;
    const proj = d3.geoMercator().fitExtent([[pad, pad + 40], [W - pad, H - pad - 30]], { type: 'MultiPoint', coordinates: S.map(s => [s.lon, s.lat]) });
    const path = d3.geoPath(proj);
    const P = s => proj([s.lon, s.lat]);
    const visited = new Set(Object.keys(T.countries).map(c => T.countries[c]));

    const root = svg.append('g');
    root.append('path').attr('class', 'graticule').attr('d', path(d3.geoGraticule().step([5, 5]).extent([[60, -20], [140, 30]])()));
    root.append('g').attr('class', 'land').selectAll('path').data(T.land.features).join('path')
      .attr('class', d => (visited.has(d.properties.name) ? 'visited' : null)).attr('d', path);

    // Country labels at the centre of each country's stops.
    const labels = root.append('g');
    Object.entries(T.countries).forEach(([code, name]) => {
      if (code === 'IN') return;
      const pts = S.filter(s => s.country === code).map(P);
      const x = d3.mean(pts, p => p[0]), y = d3.mean(pts, p => p[1]);
      labels.append('g').attr('class', 'lab').attr('transform', `translate(${x},${y})`).append('text').attr('class', 'cname').attr('text-anchor', 'middle').attr('dy', code === 'SG' ? 22 : -18).text(name);
    });

    const legLine = d3.line().curve(d3.curveCatmullRom.alpha(0.5));
    const legD = l => {
      const a = P(S[l.from - 1]), b = P(S[l.to - 1]);
      if (primaryMode(l) === 'flight') {
        const mx = (a[0] + b[0]) / 2, my = (a[1] + b[1]) / 2, dx = b[0] - a[0], dy = b[1] - a[1];
        const k = 0.22; return `M${a}Q${mx - dy * k},${my + dx * k} ${b}`;
      }
      return l.path.length > 1 ? legLine(l.path.map(p => proj(p))) : `M${a}L${b}`;
    };
    const drawn = LEGS.filter(l => primaryMode(l) !== 'local');
    const legG = root.append('g');
    const legSel = legG.selectAll('path.leg').data(drawn).join('path')
      .attr('class', l => `leg ${primaryMode(l)}`).attr('d', legD)
      .attr('stroke', l => css(`--m-${primaryMode(l)}`)).attr('stroke-width', l => (primaryMode(l) === 'flight' ? 2 : 2.6));
    legG.selectAll('path.leg-hit').data(drawn).join('path').attr('class', 'leg-hit').attr('d', legD)
      .on('click', (e, l) => { e.stopPropagation(); openPopup(S[l.to - 1], l); })
      .append('title').text(l => `${l.modes.map(m => MODE_NAME[m]).join(' + ')} · ${fmtKm(l.km)} km · ${S[l.from - 1].title} → ${S[l.to - 1].title}`);

    const trailG = root.append('g');
    const defs = svg.append('defs');
    defs.append('clipPath').attr('id', 'pinclip').append('circle').attr('r', 15);

    const pins = root.append('g').selectAll('g.pin').data(S).join('g').attr('class', 'pin')
      .attr('transform', s => `translate(${P(s)})`).attr('tabindex', 0).attr('role', 'button')
      .attr('aria-label', s => `Stop ${s.n}: ${s.title}`)
      .on('click', (e, s) => { e.stopPropagation(); openPopup(s); })
      .on('keydown', (e, s) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); openPopup(s); } });
    const inner = pins.append('g').attr('class', 'pin-inner');
    // Dot mode (zoomed out) and photo mode (zoomed in).
    const dot = inner.append('g').attr('class', 'dotpin');
    dot.append('circle').attr('r', 9).attr('fill', s => css(`--c-${s.country}`)).attr('stroke', css('--paper')).attr('stroke-width', 2);
    dot.append('text').attr('class', 'num').attr('text-anchor', 'middle').attr('dy', 3.5).text(s => s.n);
    const ph = inner.append('g').attr('class', 'photopin').attr('display', 'none');
    ph.append('circle').attr('class', 'ring').attr('r', 18).attr('stroke', s => css(`--c-${s.country}`)).attr('stroke-width', 3);
    ph.filter(s => s.thumb).append('image').attr('href', s => s.thumb).attr('x', -15).attr('y', -15).attr('width', 30).attr('height', 30).attr('clip-path', 'url(#pinclip)');
    ph.append('circle').attr('cx', 13).attr('cy', -13).attr('r', 8).attr('fill', s => css(`--c-${s.country}`));
    ph.append('text').attr('class', 'num').attr('x', 13).attr('y', -13).attr('dy', 3.5).attr('text-anchor', 'middle').style('font-size', '9px').text(s => s.n);
    pins.append('title').text(s => `${s.n}. ${s.title}`);

    const traveller = root.append('g').attr('display', 'none');
    traveller.append('circle').attr('class', 'traveller').attr('r', 7);

    let k = 1, popupStep = null;
    const zoom = d3.zoom().scaleExtent([1, 220]).translateExtent([[-W, -H], [2 * W, 2 * H]]).on('zoom', e => {
      k = e.transform.k;
      root.attr('transform', e.transform);
      // Keep pins, labels and the traveller the same size on screen; spread clusters at high zoom.
      inner.attr('transform', `scale(${1 / k})`);
      labels.selectAll('g.lab text').attr('transform', `scale(${1 / k})`);
      traveller.select('circle').attr('r', 7 / k);
      const photoMode = k > 3.2;
      dot.attr('display', photoMode ? 'none' : null); ph.attr('display', photoMode ? null : 'none');
      positionPopup();
    });
    svg.call(zoom).on('dblclick.zoom', null);
    svg.on('click', () => closePopup());

    const flyTo = (x, y, kk, dur = 900) => svg.transition().duration(reduceMotion ? 0 : dur)
      .call(zoom.transform, d3.zoomIdentity.translate(W / 2, H / 2).scale(kk).translate(-x, -y));
    const fitPoints = (pts, maxK = 60) => {
      const xs = pts.map(p => p[0]), ys = pts.map(p => p[1]);
      const [x0, x1, y0, y1] = [d3.min(xs), d3.max(xs), d3.min(ys), d3.max(ys)];
      const kk = Math.min(maxK, 0.75 / Math.max((x1 - x0) / W, (y1 - y0) / H, 1e-3));
      return flyTo((x0 + x1) / 2, (y0 + y1) / 2, Math.max(1, kk));
    };
    const reset = () => { svg.transition().duration(reduceMotion ? 0 : 800).call(zoom.transform, d3.zoomIdentity); };

    // Popup card
    const pop = $('#popup');
    function openPopup(s, leg) {
      popupStep = s;
      pins.classed('active', d => d === s);
      const p = s.photos[0] || s.videos[0];
      const l = leg || LEG_BY_TO[s.n];
      const how = l && primaryMode(l) !== 'local' ? `${l.modes.map(m => MODE_NAME[m]).join(' + ')} · ${fmtKm(l.km)} km from ${esc(S[l.from - 1].title)}` : '';
      pop.innerHTML = `${p ? `<img src="${p.type === 'video' ? p.poster : p.src}" alt="" style="background-image:url('${p.lqip || ''}');background-size:cover">` : ''}
        <button class="x" type="button" aria-label="Close">×</button>
        <div class="body"><div class="meta">${s.n} · ${fmtDate(s.t, s.tz, { day: 'numeric', month: 'long' })} · ${esc(T.countries[s.country])}</div>
        <h3>${esc(s.title)}</h3>${how ? `<div class="meta" style="text-transform:none;letter-spacing:0">${how}</div>` : ''}
        <p>${esc(s.story.slice(0, 220))}</p><a class="btn primary go" href="#s-${s.n}">Read this chapter →</a></div>`;
      pop.hidden = false;
      pop.querySelector('.x').onclick = e => { e.stopPropagation(); closePopup(); };
      pop.onclick = e => e.stopPropagation();
      const [x, y] = P(s);
      flyTo(x, y, Math.max(k, s.country === 'ID' && s.n < 14 ? 40 : 8));
      positionPopup();
    }
    function positionPopup() {
      if (!popupStep || pop.hidden) return;
      const t = d3.zoomTransform(svgEl); const [x, y] = t.apply(P(popupStep));
      const half = pop.offsetWidth / 2;
      pop.style.left = `${Math.min(Math.max(x, half + 8), W - half - 8)}px`;
      pop.style.top = `${Math.max(y, pop.offsetHeight + 30)}px`;
    }
    function closePopup() { pop.hidden = true; popupStep = null; pins.classed('active', false); }

    // Country chips
    const cc = $('#countryChips');
    let activeCountry = null;
    cc.innerHTML = `<button class="chip" type="button" data-c="" aria-pressed="true">All</button>` + Object.entries(T.countries).map(([c, n]) =>
      `<button class="chip" type="button" data-c="${c}" aria-pressed="false"><span class="dot" style="background:var(--c-${c})"></span>${n}</button>`).join('');
    cc.addEventListener('click', e => {
      const b = e.target.closest('button'); if (!b) return;
      activeCountry = b.dataset.c || null;
      cc.querySelectorAll('button').forEach(x => x.setAttribute('aria-pressed', String(x === b)));
      pins.classed('dim', s => activeCountry && s.country !== activeCountry);
      closePopup();
      if (!activeCountry) return reset();
      fitPoints(S.filter(s => s.country === activeCountry).map(P), 30);
    });

    // Mode chips (toggle legs)
    const hidden = new Set();
    const usedModes = MODE_ORDER.filter(m => m !== 'local' && drawn.some(l => primaryMode(l) === m));
    const mc = $('#modeChips');
    mc.innerHTML = usedModes.map(m => `<button class="chip" type="button" data-m="${m}" style="color:var(--m-${m})">${svgIcon(ICON[m])}<span style="color:var(--ink)">${MODE_NAME[m]}</span></button>`).join('');
    mc.addEventListener('click', e => {
      const b = e.target.closest('button'); if (!b) return;
      const m = b.dataset.m; hidden.has(m) ? hidden.delete(m) : hidden.add(m);
      b.classList.toggle('off', hidden.has(m));
      legSel.classed('dim', l => hidden.has(primaryMode(l)));
    });

    $('#zoomIn').onclick = () => svg.transition().duration(300).call(zoom.scaleBy, 2);
    $('#zoomOut').onclick = () => svg.transition().duration(300).call(zoom.scaleBy, 0.5);
    $('#zoomReset').onclick = () => { closePopup(); reset(); };

    // Replay: a marker travels every leg in order and a trail is drawn behind it.
    let playing = false, stopReq = false;
    const hud = $('#hud');
    const playBtn = $('#playBtn');
    const PLAY = '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z"/></svg>';
    const STOP = '<svg viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="6" width="12" height="12" rx="1"/></svg>';
    const showHud = s => {
      hud.hidden = false;
      hud.innerHTML = `<span>${s.n} / ${S.length} · ${fmtDate(s.t, s.tz, { day: 'numeric', month: 'short' })}</span><b>${esc(s.title)}</b><span>${esc(T.countries[s.country])}</span>`;
      pins.classed('active', d => d === s);
    };
    const sleep = ms => new Promise(r => setTimeout(r, ms));
    async function play() {
      if (playing) { stopReq = true; return; }
      playing = true; stopReq = false; playBtn.innerHTML = STOP; closePopup(); reset();
      trailG.selectAll('*').remove();
      legSel.classed('dim', true);
      traveller.attr('display', null).attr('transform', `translate(${P(S[0])})`);
      showHud(S[0]);
      await sleep(700);
      for (const l of LEGS) {
        if (stopReq) break;
        const s = S[l.to - 1];
        if (primaryMode(l) === 'local') { traveller.attr('transform', `translate(${P(s)})`); showHud(s); await sleep(260); continue; }
        const tp = trailG.append('path').attr('class', 'trail').attr('d', legD(l)).attr('stroke', css(`--m-${primaryMode(l)}`));
        const node = tp.node(), len = node.getTotalLength();
        const dur = reduceMotion ? 0 : Math.min(2600, 500 + Math.sqrt(l.km) * 38);
        tp.attr('stroke-dasharray', `${len} ${len}`).attr('stroke-dashoffset', len);
        await new Promise(res => {
          tp.transition().duration(dur).ease(d3.easeCubicInOut).attr('stroke-dashoffset', 0)
            .tween('move', () => t => { const p = node.getPointAtLength(t * len); traveller.attr('transform', `translate(${p.x},${p.y})`); })
            .on('end interrupt', res);
        });
        showHud(s);
        await sleep(320);
      }
      playing = false; playBtn.innerHTML = PLAY;
      traveller.attr('display', 'none');
      legSel.classed('dim', l => hidden.has(primaryMode(l)));
      setTimeout(() => { if (!playing) { trailG.selectAll('*').remove(); hud.hidden = true; pins.classed('active', false); } }, 2500);
    }
    playBtn.onclick = play;

    return { play, openPopup };
  }

  /* ---------------- timeline: temperature over countries ---------------- */
  function renderTimeline() {
    const svg = d3.select('#timeline');
    const W = 1100, H = 250, m = { l: 44, r: 16, t: 30, b: 52 };
    const x = d3.scaleTime().domain([new Date(T.start * 1000), new Date(T.end * 1000)]).range([m.l, W - m.r]);
    const temps = S.filter(s => s.temp != null);
    const y = d3.scaleLinear().domain([d3.min(temps, s => s.temp) - 2, d3.max(temps, s => s.temp) + 2]).nice().range([H - m.b - 34, m.t]);
    const g = svg.append('g');
    const ticks = y.ticks(5);
    g.append('g').attr('class', 'grid').selectAll('line').data(ticks).join('line').attr('x1', m.l).attr('x2', W - m.r).attr('y1', y).attr('y2', y);
    g.append('g').selectAll('text').data(ticks).join('text').attr('x', m.l - 8).attr('y', d => y(d) + 4).attr('text-anchor', 'end').text(d => `${d}°`);
    // Country ribbon
    const ry = H - m.b - 18;
    const runs = countryRuns();
    runs.forEach((r, i) => {
      const x0 = x(new Date(r.steps[0].t * 1000)), x1 = x(new Date(((runs[i + 1] ? runs[i + 1].steps[0].t : T.end)) * 1000));
      g.append('rect').attr('x', x0).attr('y', ry).attr('width', Math.max(1, x1 - x0 - 1)).attr('height', 16).attr('rx', 3).attr('fill', `var(--c-${r.code})`);
      if (x1 - x0 > 46) g.append('text').attr('class', 'lbl').attr('x', (x0 + x1) / 2).attr('y', ry + 34).attr('text-anchor', 'middle').text(T.countries[r.code]);
    });
    // Months
    x.ticks(d3.timeMonth.every(1)).forEach(d => {
      g.append('text').attr('x', x(d)).attr('y', H - 4).text(d3.timeFormat('%B')(d).toUpperCase()).style('letter-spacing', '.12em');
      g.append('line').attr('x1', x(d)).attr('x2', x(d)).attr('y1', m.t - 6).attr('y2', ry + 20).attr('stroke', 'var(--line)').attr('stroke-dasharray', '2 4');
    });
    const line = d3.line().x(s => x(new Date(s.t * 1000))).y(s => y(s.temp)).curve(d3.curveMonotoneX);
    g.append('path').attr('d', line(temps)).attr('fill', 'none').attr('stroke', 'var(--ink-2)').attr('stroke-width', 1.6).attr('stroke-opacity', .6);
    const area = d3.area().x(s => x(new Date(s.t * 1000))).y0(ry - 2).y1(s => y(s.temp)).curve(d3.curveMonotoneX);
    g.insert('path', ':first-child').attr('d', area(temps)).attr('fill', 'var(--accent)').attr('fill-opacity', .08);
    const dots = g.selectAll('g.d').data(temps).join('g').attr('data-step', s => s.n)
      .attr('transform', s => `translate(${x(new Date(s.t * 1000))},${y(s.temp)})`)
      .on('click', (e, s) => goTo(`s-${s.n}`));
    dots.append('circle').attr('r', 5).attr('fill', s => `var(--c-${s.country})`).attr('stroke', 'var(--paper)').attr('stroke-width', 1.5);
    dots.append('circle').attr('r', 12).attr('fill', 'transparent');
    dots.append('title').text(s => `${s.n}. ${s.title} · ${fmtDate(s.t, s.tz)} · ${s.temp}°C${wxKind(s.weather) ? ', ' + WX_NAME[wxKind(s.weather)].toLowerCase() : ''}`);
    const hot = temps.reduce((a, b) => (b.temp > a.temp ? b : a)), cool = temps.reduce((a, b) => (b.temp < a.temp ? b : a));
    [[hot, -14, `Hottest: ${hot.temp}° in ${hot.place}`], [cool, 22, `Coolest: ${cool.temp}° ${cool.title}`]].forEach(([s, dy, t]) => {
      const xx = x(new Date(s.t * 1000));
      g.append('text').attr('class', 'lbl').attr('x', xx).attr('y', y(s.temp) + dy).attr('text-anchor', xx > W - 200 ? 'end' : xx < 200 ? 'start' : 'middle').text(t);
    });
  }

  /* ---------------- transport rows ---------------- */
  function renderModes() {
    const entries = MODE_ORDER.filter(mo => T.modeKm[mo]).map(mo => [mo, T.modeKm[mo], LEGS.filter(l => l.modes.includes(mo)).length]);
    const max = d3.max(entries, e => e[1]);
    $('#modeRows').innerHTML = entries.map(([mo, km, n]) => `
      <div class="mode-row"><span class="name" style="color:var(--m-${mo})">${svgIcon(ICON[mo])}<span style="color:var(--ink)">${MODE_NAME[mo]}</span></span>
      <span class="bar" title="${n} legs"><i style="width:${(km / max) * 100}%;background:var(--m-${mo})"></i></span>
      <span class="km">${fmtKm(km)} km</span></div>`).join('');
  }

  function renderHops() {
    const top = LEGS.slice().sort((a, b) => b.km - a.km).slice(0, 7);
    $('#hops').innerHTML = top.map(l => {
      const a = S[l.from - 1], b = S[l.to - 1], mo = primaryMode(l);
      return `<li><span style="color:var(--m-${mo})" title="${l.modes.map(m => MODE_NAME[m]).join(' + ')}">${svgIcon(ICON[mo])}</span><a href="#s-${b.n}">${esc(a.place.replace('Special capital Region of ', ''))} → ${esc(b.place)}</a><span class="km">${fmtKm(l.km)} km</span></li>`;
    }).join('');
  }

  function renderStamps() {
    const rot = [-9, 6, -4, 10, -7, 4, -11, 7];
    const seen = [];
    $('#stamps').innerHTML = countryRuns().filter(r => r.code !== 'IN' || !seen.includes('IN')).map((r) => {
      if (seen.includes(r.code)) return ''; seen.push(r.code);
      const all = S.filter(s => s.country === r.code);
      const days = Math.round(T.countryDays[r.code]);
      const i = seen.length - 1;
      return `<a class="stamp" href="#c-${r.code}" style="--c:var(--c-${r.code});--r:${rot[i % rot.length]}deg"><div><span>${fmtDate(r.steps[0].t, r.steps[0].tz)} 2025</span><b>${esc(T.countries[r.code])}</b><span>${days || '<1'} day${days === 1 ? '' : 's'} · ${all.length} stop${all.length > 1 ? 's' : ''}</span></div></a>`;
    }).join('');
  }

  /* ---------------- story themes (counted from the journal text) ---------------- */
  const THEMES = [
    ['Coffee & cafés', /\b(coffee|coffees|latte|espresso|cappuccino|kopi|cafe|cafes|café|cafés|ca phe)\b/gi],
    ['Food', /\b(banh mi|pho|nasi|mie|noodles?|curry|satay|pad thai|laksa|warung|street food|dumplings?|biryani|dosa|thali|naan)\b/gi],
    ['Beaches', /\bbeach(es)?\b/gi],
    ['Temples', /\b(temples?|pagodas?|wat|pura)\b/gi],
    ['Hikes & treks', /\b(hike[sd]?|hiking|trek(s|ked|king)?)\b/gi],
    ['Waterfalls', /\bwaterfalls?\b/gi],
    ['Markets', /\bmarkets?\b/gi],
    ['Sunrise & sunset', /\b(sunrises?|sunsets?)\b/gi],
    ['Rain', /\b(rain|rained|raining|rainy)\b/gi],
    ['In the water', /\b(snorkel\w*|dive|diving|swim\w*|surf\w*|kayak\w*)\b/gi],
    ['Beer', /\b(beers?|bintang|singha|beerlao)\b/gi],
    ['Massages & yoga', /\b(massages?|spa|yoga)\b/gi],
    ['Laughs', /😂|😆|🤣|:p|:P|haha/g],
  ];
  const countIn = (s, re) => (s.story.match(re) || []).length;
  const words = s => (s.story.match(/\S+/g) || []).length;
  const xBand = (W, l, r) => d3.scaleBand().domain(S.map(s => s.n)).range([l, W - r]).paddingInner(0.18);
  const countryBand = (g, x, y, h = 6) => countryRuns().forEach(r => {
    const a = x(r.steps[0].n), b = x(r.steps[r.steps.length - 1].n) + x.bandwidth();
    g.append('rect').attr('x', a).attr('y', y).attr('width', b - a).attr('height', h).attr('rx', 2).attr('fill', `var(--c-${r.code})`).append('title').text(T.countries[r.code]);
  });

  function renderRecords() {
    const by = (f, dir = 1) => S.reduce((a, b) => (dir * f(b) > dir * f(a) ? b : a));
    const stay = by(s => s.nights), pics = by(s => s.media.length), hot = by(s => s.temp ?? -99), cool = by(s => s.temp ?? 99, -1);
    const longStory = by(words), hop = LEGS.reduce((a, b) => (b.km > a.km ? b : a));
    const ground = LEGS.filter(l => !l.modes.includes('flight')).reduce((a, b) => (b.km > a.km ? b : a));
    const totalWords = S.reduce((a, s) => a + words(s), 0);
    const coffees = S.reduce((a, s) => a + countIn(s, THEMES[0][1]), 0);
    const R = [
      ['Longest stay', `${stay.nights} nights`, stay.title, stay.n, ICON.local],
      ['Most photographed', `${pics.media.length} shots`, pics.title, pics.n, '<rect x="3" y="6" width="18" height="14" rx="2"/><circle cx="12" cy="13" r="3.5"/><path d="M8 6l1.5-2h5L16 6"/>'],
      ['Hottest stop', `${hot.temp}°C`, hot.title, hot.n, WX.sun],
      ['Coolest stop', `${cool.temp}°C`, cool.title, cool.n, WX.cloud],
      ['Longest ride on the ground', `${fmtKm(ground.km)} km`, `${S[ground.from - 1].title} → ${S[ground.to - 1].title}`, ground.to, ICON[primaryMode(ground)]],
      ['Biggest hop', `${fmtKm(hop.km)} km`, `${S[hop.from - 1].title} → ${S[hop.to - 1].title}`, hop.to, ICON.flight],
      ['Words written', fmtKm(totalWords), `longest chapter: ${longStory.title} (${fmtKm(words(longStory))})`, longStory.n, '<path d="M4 4h11a4 4 0 0 1 4 4v12H8a4 4 0 0 1-4-4z"/><path d="M8 8h7M8 12h7"/>'],
      ['Coffee moments', coffees, 'mentions of coffee, kopi and cafés', null, '<path d="M17 8h1a4 4 0 1 1 0 8h-1"/><path d="M3 8h14v9a4 4 0 0 1-4 4H7a4 4 0 0 1-4-4Z"/><path d="M6 2v2M10 2v2M14 2v2"/>'],
    ];
    $('#records').innerHTML = R.map(([k, b, v, n, ic]) => `<a class="record" href="${n ? '#s-' + n : '#coffee'}"><span class="k">${svgIcon(ic)}${k}</span><b>${b}</b><span class="v">${esc(v)}</span></a>`).join('');
  }

  function renderDistance() {
    const svg = d3.select('#distChart'), W = 1100, H = 280, m = { l: 56, r: 120, t: 16, b: 34 };
    const modes = MODE_ORDER.filter(mo => T.modeKm[mo] && mo !== 'local');
    const cum = Object.fromEntries(modes.map(mo => [mo, 0]));
    const rows = [{ t: S[0].t, ...cum }];
    LEGS.forEach(l => {
      const ms = l.modes.includes('flight') ? ['flight'] : l.modes.filter(mo => mo !== 'local');
      ms.forEach(mo => { cum[mo] += l.km / ms.length; });
      rows.push({ t: S[l.to - 1].t, ...cum });
    });
    rows.push({ ...rows[rows.length - 1], t: T.end });
    const stack = d3.stack().keys(modes)(rows);
    const x = d3.scaleTime().domain([new Date(T.start * 1000), new Date(T.end * 1000)]).range([m.l, W - m.r]);
    const y = d3.scaleLinear().domain([0, d3.max(stack[stack.length - 1], d => d[1])]).nice().range([H - m.b, m.t]);
    const g = svg.append('g');
    y.ticks(5).forEach(v => {
      g.append('line').attr('x1', m.l).attr('x2', W - m.r).attr('y1', y(v)).attr('y2', y(v)).attr('stroke', 'var(--line)');
      g.append('text').attr('x', m.l - 8).attr('y', y(v) + 4).attr('text-anchor', 'end').text(v >= 1000 ? `${v / 1000}k` : v);
    });
    x.ticks(d3.timeMonth.every(1)).forEach(d => g.append('text').attr('x', x(d)).attr('y', H - 10).style('letter-spacing', '.12em').text(d3.timeFormat('%B')(d).toUpperCase()));
    const area = d3.area().x(d => x(new Date(d.data.t * 1000))).y0(d => y(d[0])).y1(d => y(d[1])).curve(d3.curveStepAfter);
    g.selectAll('path.a').data(stack).join('path').attr('d', area).attr('fill', d => `var(--m-${d.key})`).attr('fill-opacity', .85)
      .append('title').text(d => `${MODE_NAME[d.key]}: ${fmtKm(T.modeKm[d.key])} km`);
    // End labels, nudged apart so they never overlap.
    let lastY = -Infinity;
    stack.map(sr => ({ key: sr.key, mid: (sr[sr.length - 1][0] + sr[sr.length - 1][1]) / 2, v: sr[sr.length - 1][1] - sr[sr.length - 1][0] }))
      .sort((a, b) => y(a.mid) - y(b.mid))
      .forEach(d => {
        let yy = y(d.mid) + 4; if (yy - lastY < 14) yy = lastY + 14; lastY = yy;
        g.append('text').attr('class', 'lbl').attr('x', W - m.r + 8).attr('y', yy).attr('fill', `var(--m-${d.key})`).style('fill', `var(--m-${d.key})`).text(`${MODE_NAME[d.key]} ${fmtKm(d.v)}`);
      });
    // Mark the big flights.
    LEGS.filter(l => l.modes.includes('flight') && l.km > 800).forEach(l => {
      const s = S[l.to - 1], xx = x(new Date(s.t * 1000));
      g.append('text').attr('class', 'lbl').attr('x', xx + 4).attr('y', m.t + 12).text(`✈ ${s.place.replace('Special capital Region of ', '')}`);
      g.append('line').attr('x1', xx).attr('x2', xx).attr('y1', m.t).attr('y2', H - m.b).attr('stroke', 'var(--ink-2)').attr('stroke-dasharray', '2 4');
    });
  }

  function renderCoffee() {
    const re = THEMES[0][1];
    const counts = S.map(s => countIn(s, re));
    const total = d3.sum(counts);
    const svg = d3.select('#coffeeChart'), W = 640, H = 300, m = { l: 30, r: 40, t: 24, b: 40 };
    const x = xBand(W, m.l, m.r);
    const y = d3.scaleLinear().domain([0, d3.max(counts) + 1]).range([H - m.b, m.t]);
    const yc = d3.scaleLinear().domain([0, total]).range([H - m.b, m.t]);
    const g = svg.append('g');
    y.ticks(4).forEach(v => {
      g.append('line').attr('x1', m.l).attr('x2', W - m.r).attr('y1', y(v)).attr('y2', y(v)).attr('stroke', 'var(--line)');
      g.append('text').attr('x', m.l - 6).attr('y', y(v) + 4).attr('text-anchor', 'end').text(v);
    });
    g.append('text').attr('x', W - m.r + 6).attr('y', yc(total) + 4).text(total).attr('class', 'lbl');
    g.append('text').attr('x', W - m.r + 6).attr('y', yc(total) + 18).text('total');
    // Cups: one stacked circle per mention.
    S.forEach((s, i) => {
      const c = counts[i];
      const col = g.append('g').attr('data-step', s.n).on('click', () => goTo(`s-${s.n}`));
      col.append('rect').attr('x', x(s.n)).attr('y', m.t).attr('width', x.bandwidth()).attr('height', H - m.b - m.t).attr('fill', 'transparent');
      for (let k = 0; k < c; k++) {
        col.append('circle').attr('cx', x(s.n) + x.bandwidth() / 2).attr('cy', y(k + 0.5)).attr('r', Math.min(x.bandwidth() / 2, (y(0) - y(1)) / 2 - 1))
          .attr('fill', 'var(--coffee)');
      }
      col.append('title').text(`${s.n}. ${s.title}: ${c} mention${c === 1 ? '' : 's'}`);
    });
    let run = 0;
    const line = d3.line().x((d, i) => x(S[i].n) + x.bandwidth() / 2).y(d => yc(d)).curve(d3.curveStepAfter);
    g.append('path').attr('d', line(counts.map(c => (run += c)))).attr('fill', 'none').attr('stroke', 'var(--accent)').attr('stroke-width', 2).attr('stroke-dasharray', '4 3');
    countryBand(g, x, H - m.b + 6);
    const peak = S[counts.indexOf(d3.max(counts))];
    g.append('text').attr('class', 'lbl').attr('x', x(peak.n) + x.bandwidth() / 2).attr('y', y(d3.max(counts)) - 6).attr('text-anchor', 'middle').text(`${peak.place}`);
    g.append('text').attr('x', m.l).attr('y', H - 8).text('Dots: mentions at each stop · dashed line: running total');
    $('#coffeeSub').textContent = `${total} mentions of coffee, kopi and cafés across ${counts.filter(Boolean).length} stops. Tap a column to read that stop.`;
    // Quotes: short sentences that actually talk about coffee.
    const seen = new Set();
    const quotes = S.flatMap(s => (s.story.match(/[^.!?\n]*\b(coffee|kopi|ca phe)\b[^.!?\n]*[.!?]?/gi) || []).map(q => [s, q.trim()]))
      .filter(([s, q]) => q.length > 40 && q.length < 190 && !seen.has(s.n) && seen.add(s.n)).slice(0, 5);
    $('#coffeeQuotes').innerHTML = quotes.map(([s, q]) => `<li><q>${esc(q)}</q><a href="#s-${s.n}">${s.n} · ${esc(s.title)} →</a></li>`).join('') || '<li class="note">No coffee lines found.</li>';
  }

  function renderThemes() {
    const svg = d3.select('#themeChart'), W = 1100, m = { l: 150, r: 56, t: 30, b: 12 }, rowH = 28;
    const H = m.t + THEMES.length * rowH + m.b;
    svg.attr('viewBox', `0 0 ${W} ${H}`);
    const x = xBand(W, m.l, m.r).paddingInner(0.12);
    const g = svg.append('g');
    countryBand(g, x, 8, 8);
    THEMES.forEach(([name, re], r) => {
      const y = m.t + r * rowH;
      const counts = S.map(s => countIn(s, re));
      const max = d3.max(counts) || 1;
      g.append('text').attr('class', 'lbl').attr('x', m.l - 10).attr('y', y + rowH / 2 + 3).attr('text-anchor', 'end').text(name);
      g.append('text').attr('x', W - m.r + 10).attr('y', y + rowH / 2 + 3).text(d3.sum(counts));
      S.forEach((s, i) => {
        const c = counts[i];
        const cell = g.append('rect').attr('x', x(s.n)).attr('y', y + 3).attr('width', x.bandwidth()).attr('height', rowH - 6).attr('rx', 3)
          .attr('data-step', s.n).on('click', () => goTo(`s-${s.n}`));
        if (c) cell.attr('fill', `var(--c-${s.country})`).attr('fill-opacity', 0.18 + 0.82 * (c / max));
        else cell.attr('fill', 'var(--bg)');
        cell.append('title').text(`${name} · ${s.n}. ${s.title}: ${c}`);
      });
    });
  }

  function renderMemories() {
    const svg = d3.select('#memChart'), W = 520, m = { l: 92, r: 70, t: 8, b: 20 }, rowH = 32;
    const codes = Object.keys(T.countries).filter(c => S.some(s => s.country === c));
    const rows = codes.map(c => ({ c, p: d3.sum(S.filter(s => s.country === c), s => s.photos.length), v: d3.sum(S.filter(s => s.country === c), s => s.videos.length) }));
    const H = m.t + rows.length * rowH + m.b; svg.attr('viewBox', `0 0 ${W} ${H}`);
    const x = d3.scaleLinear().domain([0, d3.max(rows, r => r.p + r.v)]).range([m.l, W - m.r]);
    const g = svg.append('g');
    rows.forEach((r, i) => {
      const y = m.t + i * rowH;
      const row = g.append('a').attr('href', `#c-${r.c}`);
      row.append('text').attr('class', 'lbl').attr('x', m.l - 10).attr('y', y + 18).attr('text-anchor', 'end').text(T.countries[r.c]);
      row.append('rect').attr('x', m.l).attr('y', y + 6).attr('width', x(r.p) - m.l).attr('height', 18).attr('rx', 3).attr('fill', `var(--c-${r.c})`);
      row.append('rect').attr('x', x(r.p) + 1).attr('y', y + 6).attr('width', Math.max(0, x(r.p + r.v) - x(r.p) - 1)).attr('height', 18).attr('rx', 3).attr('fill', `var(--c-${r.c})`).attr('fill-opacity', .4);
      row.append('text').attr('x', x(r.p + r.v) + 8).attr('y', y + 19).text(`${r.p} + ${r.v}▶`);
    });
    g.append('text').attr('x', m.l).attr('y', H - 4).text('Solid: photos · faded: videos');
  }

  function renderStays() {
    const svg = d3.select('#stayChart'), W = 520, m = { l: 168, r: 56, t: 8, b: 8 }, rowH = 28;
    const top = S.filter(s => s.nights).sort((a, b) => b.nights - a.nights || a.n - b.n).slice(0, 10);
    const H = m.t + top.length * rowH + m.b; svg.attr('viewBox', `0 0 ${W} ${H}`);
    const x = d3.scaleLinear().domain([0, top[0].nights]).range([m.l, W - m.r]);
    const g = svg.append('g');
    top.forEach((s, i) => {
      const y = m.t + i * rowH;
      const row = g.append('a').attr('href', `#s-${s.n}`);
      row.append('text').attr('class', 'lbl').attr('x', m.l - 10).attr('y', y + 17).attr('text-anchor', 'end').text(s.title.length > 22 ? s.title.slice(0, 21) + '…' : s.title);
      row.append('rect').attr('x', m.l).attr('y', y + 5).attr('width', x(s.nights) - m.l).attr('height', 17).attr('rx', 3).attr('fill', `var(--c-${s.country})`);
      row.append('text').attr('x', x(s.nights) + 8).attr('y', y + 18).text(`${s.nights} nights`);
    });
  }

  /* ---------------- chapters ---------------- */
  function renderChapters() {
    const box = $('#chapters');
    const html = [];
    countryRuns().forEach((r, ri) => {
      const days = Math.round(r.steps.reduce((a, s, i) => a + ((S[s.n] ? S[s.n].t : T.end) - s.t), 0) / 86400);
      const first = r.steps[0], last = r.steps[r.steps.length - 1];
      const label = r.code === 'IN' ? (ri === 0 ? 'The send-off' : 'Home') : 'Chapter';
      html.push(`<header class="country-head" id="c-${r.code}${ri && r.code === 'IN' ? '-home' : ''}" style="--c:var(--c-${r.code})">
        <div class="stamp" style="--r:${ri % 2 ? 7 : -8}deg"><div><span>${label}</span><b>${esc(T.countries[r.code])}</b><span>${fmtDate(first.t, first.tz)}${last !== first ? ' – ' + fmtDate(last.t, last.tz) : ''}</span></div></div>
        <div><h2>${esc(T.countries[r.code])}</h2><p>${r.steps.length} stop${r.steps.length > 1 ? 's' : ''} · ${days || 1} day${days === 1 ? '' : 's'} · ${r.steps.reduce((a, s) => a + s.photos.length, 0)} photos</p></div></header>`);
      r.steps.forEach(s => html.push(chapterHTML(s)));
    });
    box.innerHTML = html.join('');
    $('#wordCount').textContent = fmtKm(S.reduce((n, s) => n + words(s), 0));
    $('#jump').innerHTML = countryRuns().map((r, ri) => `<a class="chip" href="#c-${r.code}${ri && r.code === 'IN' ? '-home' : ''}"><span class="dot" style="background:var(--c-${r.code})"></span>${esc(T.countries[r.code])}${r.code === 'IN' ? (ri ? ' (home)' : ' (start)') : ''}</a>`).join('');

    box.querySelectorAll('.more').forEach(b => b.addEventListener('click', () => {
      const st = b.previousElementSibling; const open = st.classList.toggle('clamped');
      b.textContent = open ? 'Read the whole story ↓' : 'Show less ↑';
    }));
    box.addEventListener('click', e => {
      const t = e.target.closest('.tile'); if (!t) return;
      const s = S[+t.dataset.step - 1]; openLightbox(s.media.map(m => ({ ...m, step: s })), +t.dataset.i);
    });

    // Draw each chapter's mini-map when it comes near the viewport; track the active chapter.
    const io = new IntersectionObserver(es => es.forEach(e => { if (e.isIntersecting) { drawMini(e.target); io.unobserve(e.target); } }), { rootMargin: '400px' });
    box.querySelectorAll('svg.mini').forEach(el => io.observe(el));
    const act = new IntersectionObserver(es => es.forEach(e => { if (e.isIntersecting) setActive(S[+e.target.dataset.step - 1]); }), { rootMargin: '-45% 0px -50% 0px' });
    box.querySelectorAll('.chapter').forEach(el => act.observe(el));
  }

  function chapterHTML(s) {
    const l = LEG_BY_TO[s.n];
    const kind = wxKind(s.weather);
    const paras = s.story.split(/\n+/).map(p => p.trim()).filter(Boolean).map(p => `<p>${esc(p)}</p>`).join('');
    const long = s.story.length > 1300;
    let ticket = '';
    if (l) {
      const mo = primaryMode(l), from = S[l.from - 1];
      ticket = `<div class="ticket" style="--tc:var(--m-${mo})"><div class="t-top"><span>${l.modes.map(m => svgIcon(ICON[m])).join('')} ${l.modes.map(m => MODE_NAME[m]).join(' + ')}</span><span>${mo === 'local' ? '' : fmtKm(l.km) + ' km'}</span></div>
        <div class="t-body"><div class="route">${esc(from.title)} <span aria-hidden="true">→</span> ${esc(s.title)}</div><div class="t-note">${esc(l.note)}</div>
        <div class="src">${l.source === 'story' ? 'From your story' : 'Estimated from GPS'}</div></div></div>`;
    } else {
      ticket = `<div class="ticket" style="--tc:var(--accent)"><div class="t-top"><span>Day one</span><span>${fmtDate(s.t, s.tz, { day: 'numeric', month: 'short', year: 'numeric' })}</span></div><div class="t-body"><div class="t-note">Bags packed, toothbrush (hopefully) included.</div></div></div>`;
    }
    const tiles = s.media.map((m, i) => {
      const ar = (m.w / m.h) || 1.33;
      if (m.type === 'video') {
        const d = Math.round(m.dur); const dur = `${Math.floor(d / 60)}:${String(d % 60).padStart(2, '0')}`;
        return `<button class="tile" type="button" data-step="${s.n}" data-i="${i}" style="--ar:${ar};--g:${ar.toFixed(3)};background-image:url('${m.poster}')" aria-label="Play video ${i + 1} from ${esc(s.title)}"><span class="play"><span><svg viewBox="0 0 24 24"><path d="M8 5v14l11-7z"/></svg></span></span><span class="dur">${dur}</span></button>`;
      }
      return `<button class="tile" type="button" data-step="${s.n}" data-i="${i}" style="--ar:${ar};--g:${ar.toFixed(3)};background-image:url('${m.lqip}')" aria-label="Open photo ${i + 1} from ${esc(s.title)}"><img src="${m.src}" alt="" loading="lazy" decoding="async" width="${m.w}" height="${m.h}"></button>`;
    }).join('');
    return `<article class="chapter" id="s-${s.n}" data-step="${s.n}" style="--c:var(--c-${s.country})">
      <aside class="side">
        <a class="n" href="#s-${s.n}" style="text-decoration:none" title="Link to this stop">${s.n}</a>
        <div class="when"><b>${fmtDate(s.t, s.tz, { weekday: 'long', day: 'numeric', month: 'long' })}</b><br>${s.nights ? s.nights + ' night' + (s.nights > 1 ? 's' : '') : 'Last stop'}${kind ? `<br><span class="wx">${svgIcon(WX[kind])}${s.temp != null ? s.temp + '°C · ' : ''}${WX_NAME[kind]}</span>` : ''}</div>
        <svg class="mini" data-step="${s.n}" viewBox="0 0 400 300" aria-hidden="true"></svg>
        ${ticket}
      </aside>
      <div class="main">
        <h3>${esc(s.title)}</h3>
        <div class="place">${esc(s.place)}, ${esc(T.countries[s.country])} · ${s.lat.toFixed(3)}°, ${s.lon.toFixed(3)}°</div>
        <div class="story${long ? ' clamped' : ''}">${paras || '<p class="hand">No words needed for this one.</p>'}</div>
        ${long ? '<button class="more" type="button">Read the whole story ↓</button>' : ''}
        <div class="mosaic">${tiles}</div>
      </div>
    </article>`;
  }

  function drawMini(el) {
    const s = S[+el.dataset.step - 1], l = LEG_BY_TO[s.n];
    const W = 400, H = 300;
    const pts = [[s.lon, s.lat]];
    if (l) { pts.push([S[l.from - 1].lon, S[l.from - 1].lat]); l.path.forEach(p => pts.push(p)); }
    let lon0 = d3.min(pts, p => p[0]), lon1 = d3.max(pts, p => p[0]), lat0 = d3.min(pts, p => p[1]), lat1 = d3.max(pts, p => p[1]);
    const minSpan = 0.6;
    if (lon1 - lon0 < minSpan) { const c = (lon0 + lon1) / 2; lon0 = c - minSpan / 2; lon1 = c + minSpan / 2; }
    if (lat1 - lat0 < minSpan * .75) { const c = (lat0 + lat1) / 2; lat0 = c - minSpan * .375; lat1 = c + minSpan * .375; }
    const proj = d3.geoMercator().fitExtent([[28, 28], [W - 28, H - 28]], { type: 'MultiPoint', coordinates: [[lon0, lat0], [lon1, lat1]] }).clipExtent([[0, 0], [W, H]]);
    const path = d3.geoPath(proj);
    const svg = d3.select(el);
    svg.append('g').attr('class', 'land').selectAll('path').data(T.land.features).join('path').attr('d', path);
    if (l && primaryMode(l) !== 'local') {
      const a = proj([S[l.from - 1].lon, S[l.from - 1].lat]), b = proj([s.lon, s.lat]);
      const mo = primaryMode(l);
      let d;
      if (mo === 'flight') { const mx = (a[0] + b[0]) / 2, my = (a[1] + b[1]) / 2, dx = b[0] - a[0], dy = b[1] - a[1]; d = `M${a}Q${mx - dy * .22},${my + dx * .22} ${b}`; }
      else d = d3.line().curve(d3.curveCatmullRom.alpha(.5))(l.path.length > 1 ? l.path.map(p => proj(p)) : [a, b]);
      svg.append('path').attr('d', d).attr('fill', 'none').attr('stroke', `var(--m-${mo})`).attr('stroke-width', 3).attr('stroke-linecap', 'round').attr('stroke-dasharray', mo === 'flight' ? '2 7' : null);
      svg.append('circle').attr('cx', a[0]).attr('cy', a[1]).attr('r', 5).attr('fill', 'var(--paper)').attr('stroke', 'var(--ink-2)').attr('stroke-width', 2);
      svg.append('text').attr('x', a[0]).attr('y', a[1] - 10).attr('text-anchor', 'middle').attr('style', 'font:500 12px var(--f-mono);fill:var(--ink-2)').text(S[l.from - 1].place.replace('Special capital Region of ', '').slice(0, 22));
    }
    const p = proj([s.lon, s.lat]);
    svg.append('circle').attr('cx', p[0]).attr('cy', p[1]).attr('r', 9).attr('fill', `var(--c-${s.country})`).attr('stroke', 'var(--paper)').attr('stroke-width', 3);
    svg.append('text').attr('x', p[0]).attr('y', p[1] + 26).attr('text-anchor', 'middle').attr('style', 'font:500 13px var(--f-mono);fill:var(--ink)').text(s.place.replace('Special capital Region of ', '').slice(0, 24));
    // Clicking the mini-map opens the stop on the big map.
    el.style.cursor = 'pointer';
    el.addEventListener('click', () => { goTo('route', false); setTimeout(() => mapApi.openPopup(s), 350); });
  }

  /* ---------------- lightbox and slideshow ---------------- */
  const lb = $('#lightbox');
  let lbItems = [], lbIndex = 0, lbTimer = null, lbAuto = false, lastFocus = null;
  function openLightbox(items, i, auto = false) {
    lbItems = items; lbIndex = i; lbAuto = auto; lastFocus = document.activeElement;
    lb.hidden = false; document.body.style.overflow = 'hidden';
    lb.innerHTML = `<div class="lb-top"><span class="t" id="lbT"></span>
      ${auto ? '<button type="button" id="lbPause">Pause</button>' : ''}<button type="button" id="lbGo">Chapter</button><button type="button" id="lbX" aria-label="Close">Close ✕</button></div>
      <div class="lb-stage" id="lbStage"></div><div class="lb-cap" id="lbCap"></div>
      <button class="lb-nav prev" type="button" aria-label="Previous">‹</button><button class="lb-nav next" type="button" aria-label="Next">›</button>
      ${auto ? '<div class="lb-bar"><i id="lbBar"></i></div>' : ''}`;
    lb.querySelector('#lbX').onclick = closeLightbox;
    lb.querySelector('.prev').onclick = () => step(-1);
    lb.querySelector('.next').onclick = () => step(1);
    lb.querySelector('#lbGo').onclick = () => { const s = lbItems[lbIndex].step; closeLightbox(); goTo(`s-${s.n}`, false); };
    const pb = lb.querySelector('#lbPause');
    if (pb) pb.onclick = () => { lbAuto = !lbAuto; pb.textContent = lbAuto ? 'Pause' : 'Play'; show(); };
    let x0 = null;
    lb.querySelector('#lbStage').addEventListener('touchstart', e => { x0 = e.touches[0].clientX; }, { passive: true });
    lb.querySelector('#lbStage').addEventListener('touchend', e => { if (x0 == null) return; const dx = e.changedTouches[0].clientX - x0; if (Math.abs(dx) > 40) step(dx < 0 ? 1 : -1); x0 = null; });
    show();
    lb.querySelector('#lbX').focus();
  }
  function show() {
    clearTimeout(lbTimer);
    const it = lbItems[lbIndex], s = it.step;
    const stage = lb.querySelector('#lbStage');
    // The single-file export has no video files (src is null), so it shows the preview frame instead.
    stage.innerHTML = it.type === 'video' && it.src
      ? `<video src="${it.src}" poster="${it.poster}" controls autoplay playsinline ${lbAuto ? 'muted' : ''}></video>`
      : it.type === 'video'
        ? `<div style="position:relative;display:grid;place-items:center"><img class="fade" src="${it.poster}" alt="${esc(s.title)}" style="min-width:min(70vw,640px)"><span style="position:absolute;bottom:12px;background:rgb(0 0 0 / .6);color:#fff;padding:6px 12px;border-radius:999px;font:500 12px var(--f-mono)">Video · ${Math.round(it.dur)}s · plays in the online journal</span></div>`
        : `<img class="fade" src="${it.src}" alt="${esc(s.title)}">`;
    lb.querySelector('#lbT').textContent = `${lbIndex + 1} / ${lbItems.length}`;
    lb.querySelector('#lbCap').innerHTML = `${esc(s.title)}<small>${s.n} · ${esc(s.place)}, ${esc(T.countries[s.country])} · ${fmtDate(s.t, s.tz, { day: 'numeric', month: 'long', year: 'numeric' })}</small>`;
    // Preload the next photo.
    const nx = lbItems[(lbIndex + 1) % lbItems.length]; if (nx && nx.type === 'photo') { const im = new Image(); im.src = nx.src; }
    const bar = lb.querySelector('#lbBar');
    if (lbAuto) {
      const ms = 4200;
      if (bar) { bar.style.transition = 'none'; bar.style.width = '0'; requestAnimationFrame(() => requestAnimationFrame(() => { bar.style.transition = `width ${ms}ms linear`; bar.style.width = '100%'; })); }
      if (it.type === 'video') stage.querySelector('video').addEventListener('ended', () => step(1));
      else lbTimer = setTimeout(() => step(1), ms);
    } else if (bar) { bar.style.transition = 'none'; bar.style.width = '0'; }
  }
  function step(d) { lbIndex = (lbIndex + d + lbItems.length) % lbItems.length; show(); }
  function closeLightbox() { clearTimeout(lbTimer); lb.hidden = true; lb.innerHTML = ''; document.body.style.overflow = ''; if (lastFocus) lastFocus.focus(); }
  document.addEventListener('keydown', e => {
    if (lb.hidden) return;
    if (e.key === 'Escape') closeLightbox();
    else if (e.key === 'ArrowRight') step(1);
    else if (e.key === 'ArrowLeft') step(-1);
  });

  function wireButtons() {
    const allPhotos = S.flatMap(s => s.photos.map(p => ({ ...p, type: 'photo', step: s })));
    const slideshow = () => openLightbox(allPhotos, 0, true);
    $('#slideshowBtn').onclick = slideshow;
    $('#slideshowBtn2').onclick = slideshow;
    $('#shuffleBtn').onclick = () => {
      const i = Math.floor(Math.random() * allPhotos.length);
      const s = allPhotos[i].step;
      openLightbox(s.media.map(m => ({ ...m, step: s })), s.media.findIndex(m => m.src === allPhotos[i].src));
    };
    $('#heroPlay').addEventListener('click', () => setTimeout(() => mapApi.play(), 600));
  }
})();
