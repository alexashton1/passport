/* GK — shared toolkit for the Wider-family prototypes (data, daily seeding, geo maths, UI bits). */
window.GK = (() => {
  'use strict';
  const C = window.WIDER_COUNTRIES, T = window.WIDER_TOPO;
  const byCode = new Map(C.map(c => [c.c, c]));
  const feats = G.feature(T, T.objects.countries).features;
  const featById = new Map(feats.map(f => [String(f.id), f]));
  const UN = C.filter(c => c.un && c.g && featById.has(c.g) && c.c !== 'XKX');
  const tier = t => C.filter(c => c.t === t);           // 1 gentle · 2 steady · 3 tough (recognisable outlines)
  const $ = id => document.getElementById(id);
  const esc = s => String(s).replace(/[&<>"]/g, m => ({'&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;'})[m]);

  /* ---- daily seeding: same puzzle for everyone, new one at 00:00 UTC ---- */
  // Puzzle No. 1 date (UTC): from the game's config.js if set, otherwise 19 Nov 2026
  const EPOCH = (() => { const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(((window.PASSPORT_CONFIG || {}).launchDate) || ''); return m ? Date.UTC(+m[1], +m[2] - 1, +m[3]) : Date.UTC(2026, 10, 19); })(), DAY = 864e5;
  const dayDate = n => new Date(EPOCH + (n - 1) * DAY);
  const dayNum = () => Math.max(1, Math.floor((Date.now() - EPOCH) / DAY) + 1);
  const msToNext = () => EPOCH + dayNum() * DAY - Date.now();
  const hash = s => { let h = 2166136261; for (const ch of s) { h ^= ch.charCodeAt(0); h = Math.imul(h, 16777619); } return h >>> 0; };
  const rng = seed => () => { seed |= 0; seed = seed + 0x6D2B79F5 | 0; let t = Math.imul(seed ^ seed >>> 15, 1 | seed); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
  const dailyRng = game => rng(hash(game + ':' + dayNum()));
  const shuffle = (r, a) => { a = a.slice(); for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
  const pick = (r, a) => a[Math.floor(r() * a.length)];

  /* ---- geo maths ---- */
  const R = 6371, rad = d => d * Math.PI / 180;
  function distKm(a, b) { const [la1, lo1] = a, [la2, lo2] = b; const h = Math.sin(rad(la2 - la1) / 2) ** 2 + Math.cos(rad(la1)) * Math.cos(rad(la2)) * Math.sin(rad(lo2 - lo1) / 2) ** 2; return 2 * R * Math.asin(Math.sqrt(h)); }
  function bearing(a, b) { const [la1, lo1] = a.map(rad), [la2, lo2] = b.map(rad); const y = Math.sin(lo2 - lo1) * Math.cos(la2), x = Math.cos(la1) * Math.sin(la2) - Math.sin(la1) * Math.cos(la2) * Math.cos(lo2 - lo1); return (Math.atan2(y, x) * 180 / Math.PI + 360) % 360; }
  const ARROWS = ['⬆️', '↗️', '➡️', '↘️', '⬇️', '↙️', '⬅️', '↖️'], DIRS = ['north', 'north-east', 'east', 'south-east', 'south', 'south-west', 'west', 'north-west'];
  const arrow = deg => ARROWS[Math.round(deg / 45) % 8], dirWord = deg => DIRS[Math.round(deg / 45) % 8];
  const fmtKm = km => km < 50 ? '<50 km' : (Math.round(km / 10) * 10).toLocaleString() + ' km';
  const clusterCache = new Map();
  function cluster(code) {
    if (clusterCache.has(code)) return clusterCache.get(code);
    const c = byCode.get(code), f = c && c.g && featById.get(c.g); let out = null;
    if (f) {
      const polys = f.geometry.type === 'Polygon' ? [f.geometry.coordinates] : f.geometry.coordinates;
      const items = polys.map(p => { const g = {type: 'Polygon', coordinates: p}; return {p, a: G.geoArea(g), c: G.geoCentroid(g)}; });
      const big = items.reduce((m, x) => x.a > m.a ? x : m);
      const keep = items.filter(x => x.a >= big.a * 0.08 && G.geoDistance(x.c, big.c) < 0.4);
      const geom = {type: 'MultiPolygon', coordinates: keep.map(x => x.p)};
      out = {f, geom, center: G.geoCentroid(geom), label: big.c};
    }
    clusterCache.set(code, out); return out;
  }
  const centre = code => { const cl = cluster(code), c = byCode.get(code); return cl ? [cl.center[1], cl.center[0]] : c.ll; };
  const ptsCache = new Map();
  function points(code, full) {     // outline vertices: main landmass by default, every territory when full
    const key = code + (full ? '+' : ''); if (ptsCache.has(key)) return ptsCache.get(key);
    const cl = cluster(code); let out = null;
    if (cl) { const raw = []; const g = full ? cl.f.geometry : cl.geom; for (const poly of g.type === 'Polygon' ? [g.coordinates] : g.coordinates) for (const ring of poly) for (const p of ring) raw.push(p);
      const step = Math.max(1, Math.ceil(raw.length / 500)); out = []; for (let i = 0; i < raw.length; i += step) out.push(raw[i]); }
    ptsCache.set(key, out); return out;
  }
  // nearest distance (km) from a lon/lat point to a country's outline
  function pointGapKm(lonlat, code) {
    const P = points(code, true), c = byCode.get(code);
    if (!P) return {km: distKm([lonlat[1], lonlat[0]], c.ll), at: [c.ll[1], c.ll[0]]};
    let best = Infinity, bp = null; for (const p of P) { const d = G.geoDistance(lonlat, p); if (d < best) { best = d; bp = p; } }
    return {km: best * R, at: bp};
  }
  const gapCache = new Map();
  function gapKm(a, b) {   // border-to-border between two countries' outlines
    if (a === b) return 0; const A = byCode.get(a), B = byCode.get(b); if (A.b.includes(b)) return 0;
    const key = a < b ? a + b : b + a; if (gapCache.has(key)) return gapCache.get(key);
    const PA = points(a), PB = points(b); let km;
    if (!PA || !PB) km = distKm(A.ll, B.ll);
    else { let best = Infinity; for (let i = 0; i < PA.length; i += 2) for (let j = 0; j < PB.length; j += 2) { const d = G.geoDistance(PA[i], PB[j]); if (d < best) best = d; } km = best * R; }
    gapCache.set(key, km); return km;
  }
  function guessFeedback(guess, answer) {
    if (guess === answer) return {cls: 'hit', km: 0};
    const A = byCode.get(answer), border = A.b.includes(guess), km = border ? 0 : gapKm(guess, answer);
    return {cls: border || km < 500 ? 'near' : km < 1500 ? 'mid' : 'far', km, border, deg: bearing(centre(guess), centre(answer))};
  }

  /* ---- search / autocomplete ---- */
  const norm = s => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/&/g, ' and ').replace(/[^a-z0-9 ]/g, ' ').replace(/\b(the|of)\b/g, ' ').replace(/\s+/g, ' ').trim();
  const SEARCH = C.map(c => ({c, n: norm(c.n), a: c.a}));
  function search(q) {
    q = norm(q); if (!q) return [];
    const out = [];
    for (const s of SEARCH) {
      let sc = -1;
      if (s.n === q || s.a.includes(q)) sc = 0; else if (s.n.startsWith(q)) sc = 1; else if (s.n.split(' ').some(w => w.startsWith(q))) sc = 2; else if (s.a.some(a => a.startsWith(q))) sc = 3; else if (q.length > 2 && s.n.includes(q)) sc = 4;
      if (sc >= 0) out.push([sc, s.c]);
    }
    out.sort((a, b) => a[0] - b[0] || (b[1].un - a[1].un) || a[1].n.localeCompare(b[1].n));
    return out.slice(0, 7).map(x => x[1]);
  }
  function autocomplete({input, list, form, msg, onPick, used}) {
    let matches = [], sel = 0;
    const show = () => {
      matches = search(input.value); sel = 0;
      if (!matches.length) { list.classList.remove('on'); return; }
      list.innerHTML = matches.map((c, i) => '<li role="option" aria-selected="' + (i === 0) + '" data-c="' + c.c + '" class="' + (used().includes(c.c) ? 'used' : '') + '"><span>' + c.f + '</span>' + esc(c.n) + '</li>').join('');
      list.classList.add('on');
    };
    const move = d => { if (!matches.length) return; sel = (sel + d + matches.length) % matches.length; [...list.children].forEach((li, i) => li.setAttribute('aria-selected', i === sel)); };
    const fail = m => { msg.textContent = m; form.classList.remove('shake'); void form.offsetWidth; form.classList.add('shake'); };
    const choose = c => {
      if (!c) return fail('Pick a country from the list');
      if (used().includes(c.c)) return fail('Already guessed ' + c.n);
      input.value = ''; list.classList.remove('on'); msg.textContent = ''; onPick(c.c);
    };
    input.addEventListener('input', () => { msg.textContent = ''; show(); });
    input.addEventListener('keydown', e => { if (e.key === 'ArrowDown') { e.preventDefault(); move(1); } else if (e.key === 'ArrowUp') { e.preventDefault(); move(-1); } else if (e.key === 'Escape') list.classList.remove('on'); });
    input.addEventListener('blur', () => setTimeout(() => list.classList.remove('on'), 150));
    list.addEventListener('mousedown', e => e.preventDefault());
    list.addEventListener('click', e => { const li = e.target.closest('li'); if (li) choose(byCode.get(li.dataset.c)); });
    form.addEventListener('submit', e => {
      e.preventDefault(); if (!input.value.trim()) return fail('Type a country name');
      const q = norm(input.value), exact = SEARCH.find(s => s.n === q || s.a.includes(q));
      choose(exact ? exact.c : matches[sel]);
    });
  }

  /* ---- outline renderer (orthographic, zooms out by level) ---- */
  function readColors() { const s = getComputedStyle(document.documentElement), o = {}; for (const k of ['ocean', 'grat', 'land', 'landEdge', 'target', 'far', 'mid', 'near', 'hit', 'ink', 'surface', 'accent']) o[k] = s.getPropertyValue('--' + k).trim(); return o; }
  function Outline(canvas) {
    const ctx = canvas.getContext('2d'), proj = G.geoOrthographic().clipAngle(90).precision(0.3), path = G.geoPath(proj, ctx), grat = G.geoGraticule10();
    let W = 0, H = 0, DPR = 1, colors = readColors(), state = null, view = {scale: 1, others: 0, labels: 0}, raf = 0;
    const st = {code: null, zoom: 0, others: 0, labels: [], tint: {}, reveal: false};
    function levels(code) {
      const cl = cluster(code); proj.rotate([-cl.center[0], -cl.center[1]]);
      const pad = Math.min(W, H) * 0.13; proj.fitExtent([[pad, pad], [W - pad, H - pad]], cl.geom);
      const s0 = proj.scale(), sg = Math.min(W, H) / 2 - 14;
      return z => s0 <= sg ? s0 * Math.pow(Math.max(sg, s0 * 0.7) / s0, Math.pow(z, 1.5)) : s0 * Math.pow(sg / s0, z);
    }
    function draw() {
      if (!st.code || !W) return;
      const cl = cluster(st.code);
      ctx.setTransform(DPR, 0, 0, DPR, 0, 0); ctx.clearRect(0, 0, W, H);
      proj.scale(view.scale).translate([W / 2, H / 2]);
      if (view.others > .01) {
        ctx.globalAlpha = view.others;
        ctx.beginPath(); path({type: 'Sphere'}); ctx.fillStyle = colors.ocean; ctx.fill();
        ctx.beginPath(); path(grat); ctx.strokeStyle = colors.grat; ctx.lineWidth = .6; ctx.stroke();
        ctx.beginPath(); for (const f of feats) if (f !== cl.f) path(f); ctx.fillStyle = colors.land; ctx.fill(); ctx.strokeStyle = colors.landEdge; ctx.lineWidth = .8; ctx.stroke();
        for (const [code, col] of Object.entries(st.tint)) { const c = cluster(code); if (!c || code === st.code) continue; ctx.beginPath(); path(c.f); ctx.fillStyle = colors[col] || col; ctx.fill(); }
        ctx.globalAlpha = 1;
      }
      ctx.beginPath(); path(view.others > .5 ? cl.f : cl.geom); ctx.fillStyle = st.reveal ? colors.hit : colors.target; ctx.fill();   // close-up: main landmass only
      // labels
      const centerLL = proj.invert([W / 2, H / 2]); ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; const placed = [];
      const labs = [...st.labels.map(c => [c, false]), ...(st.reveal ? [[st.code, true]] : [])];
      for (const [code, main] of labs) {
        const c = byCode.get(code), cc = cluster(code), pt = cc ? cc.label : [c.ll[1], c.ll[0]];
        if (centerLL && G.geoDistance(centerLL, pt) > 1.45) continue;
        const p = proj(pt); if (!p || p[0] < 16 || p[0] > W - 16 || p[1] < 14 || p[1] > H - 10) continue;
        ctx.font = (main ? '700 14px ' : '600 11.5px ') + getComputedStyle(document.body).fontFamily;
        const w = ctx.measureText(c.n).width + 12, h = main ? 22 : 18, box = [p[0] - w / 2, p[1] - h / 2, w, h];
        if (placed.some(q => box[0] < q[0] + q[2] && box[0] + w > q[0] && box[1] < q[1] + q[3] && box[1] + h > q[1])) continue;
        placed.push(box); ctx.fillStyle = main ? colors.hit : colors.surface; roundRect(ctx, ...box, h / 2); ctx.fill();
        ctx.fillStyle = main ? '#fff' : colors.ink; ctx.fillText(c.n, p[0], p[1] + .5);
      }
    }
    function set(next, animate = true) {
      Object.assign(st, next); if (!W) return;
      const sc = levels(st.code)(st.zoom), target = {scale: sc, others: st.others};
      if (!animate || matchMedia('(prefers-reduced-motion: reduce)').matches) { Object.assign(view, target); draw(); return; }
      cancelAnimationFrame(raf); const from = {...view}, t0 = performance.now(), ms = 850, ease = t => t < .5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
      const step = now => { const t = Math.min(1, (now - t0) / ms), e = ease(t); view.scale = Math.exp(Math.log(from.scale) + (Math.log(target.scale) - Math.log(from.scale)) * e); view.others = from.others + (target.others - from.others) * e; draw(); if (t < 1) raf = requestAnimationFrame(step); };
      raf = requestAnimationFrame(step);
    }
    function resize() { const r = canvas.getBoundingClientRect(); DPR = Math.min(devicePixelRatio || 1, 2.5); W = r.width; H = r.height; canvas.width = Math.round(W * DPR); canvas.height = Math.round(H * DPR); if (st.code) { view.scale = levels(st.code)(st.zoom); view.others = st.others; draw(); } }
    new ResizeObserver(resize).observe(canvas);
    matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => { colors = readColors(); draw(); });
    return {set, redraw: draw};
  }
  function roundRect(ctx, x, y, w, h, r) { ctx.beginPath(); ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r); ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath(); }

  /* ---- storage, UI helpers ---- */
  const store = {
    get(k) { try { return JSON.parse(localStorage.getItem(k)); } catch (e) { return null; } },
    set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} },
    del(k) { try { localStorage.removeItem(k); } catch (e) {} },
  };
  function toast(m) { let t = $('toast'); if (!t) { t = document.createElement('div'); t.id = 'toast'; t.className = 'toast'; t.setAttribute('role', 'status'); document.body.appendChild(t); } t.textContent = m; t.classList.add('on'); clearTimeout(t._h); t._h = setTimeout(() => t.classList.remove('on'), 1900); }
  function copy(text) {
    const ok = () => toast('Copied — paste it in your group chat');
    if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(text).then(ok, () => fallback()); else fallback();
    function fallback() { const t = document.createElement('textarea'); t.value = text; t.style.position = 'fixed'; t.style.opacity = 0; document.body.appendChild(t); t.select(); try { document.execCommand('copy'); ok(); } catch (e) { toast('Copy failed'); } t.remove(); }
  }
  function openDlg(d) { document.querySelectorAll('dialog[open]').forEach(x => x.close()); d.showModal ? d.showModal() : d.setAttribute('open', ''); }
  document.addEventListener('click', e => { const d = e.target.closest('dialog'); if (d && (e.target === d || e.target.closest('[data-close]'))) d.close(); });
  const cdText = () => { const ms = msToNext(); return [Math.floor(ms / 36e5), Math.floor(ms % 36e5 / 6e4), Math.floor(ms % 6e4 / 1e3)].map(v => String(v).padStart(2, '0')).join(':'); };
  setInterval(() => document.querySelectorAll('.js-cd').forEach(el => el.textContent = cdText()), 1000);
  const fmtDate = () => new Date(EPOCH + (dayNum() - 1) * DAY).toLocaleDateString(undefined, {weekday: 'short', day: 'numeric', month: 'short', timeZone: 'UTC'});
  const clsFor = (pts, max) => pts >= max * .9 ? 'hit' : pts >= max * .55 ? 'near' : pts > 0 ? 'mid' : 'far';
  const EMO = {hit: '🟩', near: '🟨', mid: '🟧', far: '🟥'};

  // Results sheet shared by all three prototypes
  function results({dlg, game, title, levels, total, max, verdict, shareLines, onReplay}) {
    const day = dayNum();
    dlg.innerHTML = '<div class="sheet" tabindex="-1" autofocus><button class="ib x" data-close aria-label="Close"><svg viewBox="0 0 24 24"><path d="M6 6l12 12M18 6L6 18"/></svg></button>' +
      '<div class="total"><div style="font-size:12px;letter-spacing:.1em;text-transform:uppercase;color:var(--muted);font-weight:700">' + esc(title) + ' No. ' + day + '</div>' +
      '<div class="big">' + total + '<small> / ' + max + '</small></div><div class="verdict">' + esc(verdict) + '</div></div>' +
      '<h3>Level by level</h3><ul class="breakdown">' + levels.map((l, i) => '<li><span class="dot bg-' + clsFor(l.pts, l.max) + '">' + (i + 1) + '</span><span><b>' + esc(l.name) + '</b><small>' + l.detail + '</small></span><span class="pts">' + l.pts + '</span></li>').join('') + '</ul>' +
      '<h3>Share</h3><pre class="sharebox">' + esc(shareLines.join('\n')) + '</pre>' +
      '<div class="row"><button class="btn" id="rsCopy">Copy result</button><button class="btn ghost" id="rsReplay">Replay (prototype)</button></div>' +
      '<div class="cd">Next puzzle in<b class="js-cd">' + cdText() + '</b></div></div>';
    openDlg(dlg);
    dlg.querySelector('#rsCopy').onclick = () => copy(shareLines.join('\n') + '\n' + location.href.split('#')[0]);
    dlg.querySelector('#rsReplay').onclick = () => { dlg.close(); onReplay(); };
  }

  /* ---- keep the app inside the visible viewport (mobile keyboards) ---- */
  const vv = window.visualViewport;
  function fit() { const root = document.documentElement.style; root.setProperty('--app-h', Math.round(vv ? vv.height : innerHeight) + 'px'); root.setProperty('--app-top', Math.round(vv ? vv.offsetTop : 0) + 'px'); }
  if (vv) { vv.addEventListener('resize', fit); vv.addEventListener('scroll', fit); } addEventListener('resize', fit); fit();

  return {EPOCH, dayDate, C, UN, byCode, feats, featById, tier, $, esc, dayNum, fmtDate, dailyRng, rng, hash, shuffle, pick, cluster, centre, points, pointGapKm, gapKm, distKm, bearing, arrow, dirWord, fmtKm, guessFeedback, search, autocomplete, Outline, readColors, roundRect, store, toast, copy, openDlg, clsFor, EMO, results};
})();
