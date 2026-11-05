// Feature-video engine. Every visible value is a pure function of film time t.
// Data comes from build/data.js: window.FV = {video, shots, timelines}.
// Contract: window.__ready, window.__seek(t), window.__meta, window.__warnings, window.__clicks.
(() => {
  const P = new URLSearchParams(location.search);
  const FVD = window.FV;
  const V = FVD.video;
  const LANG = P.get('lang') || V.langs[0];
  const TL = FVD.timelines[LANG];
  const SHOTS = FVD.shots || {};
  const WARN = [...(TL.warnings || [])];
  const warn = (m) => { if (!WARN.includes(m)) WARN.push(m); };
  const tr = (o) => (o == null ? '' : typeof o === 'string' ? o : (o[LANG] ?? o.en ?? ''));
  const $ = (s) => document.querySelector(s);

  // ---------- math ----------
  const clamp = (x, a = 0, b = 1) => Math.min(b, Math.max(a, x));
  const lerp = (a, b, k) => a + (b - a) * k;
  const ease = (k) => (k < 0.5 ? 4 * k * k * k : 1 - Math.pow(-2 * k + 2, 3) / 2);
  const easeOut = (k) => 1 - Math.pow(1 - k, 3);
  const spring = (k) => (k <= 0 ? 0 : k >= 1.6 ? 1 : 1 - Math.exp(-7 * k) * (Math.cos(11 * k) + (7 / 11) * Math.sin(11 * k)));
  const win = (t, a, b, fin = 0.3, fout = 0.3) => (t < a || t > b ? 0 : Math.min(clamp((t - a) / fin), clamp((b - t) / fout)));

  // ---------- title card: stakeholder areas and motif icons ----------
  // An area matches a section of the release changelog. colors: [main, deep, soft text].
  const AREAS = {
    'lab-ops': { name: { en: 'Lab ops', pt: 'Lab ops' }, emoji: '🧪', colors: ['#0D9488', '#134E4A', '#5EEAD4'] },
    finance: { name: { en: 'Finance', pt: 'Financeiro' }, emoji: '💰', colors: ['#D97706', '#78350F', '#FCD34D'] },
    logistics: { name: { en: 'Logistics', pt: 'Logística' }, emoji: '🚚', colors: ['#16A34A', '#14532D', '#86EFAC'] },
    'quarry-qa': { name: { en: 'Quarry QA', pt: 'QA de pedreiras' }, emoji: '⛏️', colors: ['#EA580C', '#7C2D12', '#FDBA74'] },
    lca: { name: { en: 'LCA & data', pt: 'LCA e dados' }, emoji: '🌲', colors: ['#4F46E5', '#312E81', '#A5B4FC'] },
    everyone: { name: { en: 'Everyone', pt: 'Todos' }, emoji: '🌐', colors: ['#2A92F4', '#0B4F94', '#93C5FD'] },
  };
  // Lucide icons, written {i:name} inside a motif.
  const svg = (d) => `<svg class="i" viewBox="0 0 24 24">${d}</svg>`;
  const ICONS = {
    check: svg('<circle cx="12" cy="12" r="10"/><path d="m9 12 2 2 4-4"/>'),
    alert: svg('<circle cx="12" cy="12" r="10"/><line x1="12" x2="12" y1="8" y2="12"/><line x1="12" x2="12.01" y1="16" y2="16"/>'),
    x: svg('<circle cx="12" cy="12" r="10"/><path d="m15 9-6 6"/><path d="m9 9 6 6"/>'),
    plus: svg('<path d="M5 12h14M12 5v14"/>'),
    arrow: svg('<path d="M5 12h14M12 5l7 7-7 7"/>'),
    file: svg('<path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z"/><path d="M14 2v4a2 2 0 0 0 2 2h4"/><path d="M10 13H8M16 17H8"/>'),
    layers: svg('<path d="m12.83 2.18a2 2 0 0 0-1.66 0L2.6 6.08a1 1 0 0 0 0 1.83l8.58 3.91a2 2 0 0 0 1.66 0l8.58-3.9a1 1 0 0 0 0-1.83Z"/><path d="m22 17.65-9.17 4.16a2 2 0 0 1-1.66 0L2 17.65"/><path d="m22 12.65-9.17 4.16a2 2 0 0 1-1.66 0L2 12.65"/>'),
    search: svg('<circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/>'),
    calendar: svg('<path d="M8 2v4M16 2v4"/><rect width="18" height="18" x="3" y="4" rx="2"/><path d="M3 10h18"/>'),
    pin: svg('<path d="M20 10c0 4.99-5.54 10.19-7.4 11.8a1 1 0 0 1-1.2 0C9.54 20.19 4 14.99 4 10a8 8 0 0 1 16 0"/><circle cx="12" cy="10" r="3"/>'),
  };

  // ---------- layout ----------
  const FRAME = { x: 80, y: 112, w: 1760, h: 768 };
  const FC = { x: FRAME.x + FRAME.w / 2, y: FRAME.y + FRAME.h / 2 };
  const MAXS = V.maxScale ?? 1.0; // screen px per image px; above 1 the screenshot upsamples
  const lines = TL.lines;
  const lineById = Object.fromEntries(lines.map((l) => [l.id, l]));
  const srcLine = Object.fromEntries(V.lines.map((l) => [l.id, l]));
  const content = lines.filter((l) => !srcLine[l.id].card);

  const resolveAt = (line, at) => {
    if (at == null) return line.t0;
    if (typeof at === 'number') return line.t0 + at;
    const m = /^([^+-]+)([+-][\d.]+)?$/.exec(at);
    const base = m && m[1];
    const off = m && m[2] ? parseFloat(m[2]) : 0;
    if (base === 'end') return line.t1 + off;
    if (base in (line.marks || {})) return line.marks[base] + off;
    if (lineById[base]) return lineById[base].t0 + off;
    warn(`line ${line.id}: marker "${at}" not found, using line start`);
    return line.t0 + off;
  };
  const resolveUntil = (line, until) => {
    if (until == null) return line.t1 + 0.35;
    if (lineById[until]) return lineById[until].t1 + 0.35;
    return resolveAt(line, until);
  };

  // ---------- plan ----------
  const shotSwitches = []; // {t, id, fade}
  const camKeys = []; // {t, dur, shot, target, pad}
  const rings = []; // {t0, t1, shot, target, warn}
  const labels = []; // {t0, t1, shot, target, text, side, style}
  const clicks = []; // {t, shot, target}
  const PRE = 0.35; // camera starts moving this long before the words

  for (const line of content) {
    const src = srcLine[line.id];
    const start = Math.max(line.t0 - PRE, 0);
    if (src.shot) shotSwitches.push({ t: start, id: src.shot, fade: 0.5 });
    if (src.shot || src.focus !== undefined) camKeys.push({ t: start, dur: src.camDur ?? 1.0, line: line.id, target: src.focus ?? null, pad: src.pad });
    for (const b of src.beats || []) {
      const t = resolveAt(line, b.at);
      const t1 = resolveUntil(line, b.until);
      if (b.shot) shotSwitches.push({ t, id: b.shot, fade: b.fade ?? 0.25 });
      if (b.focus !== undefined) camKeys.push({ t, dur: b.camDur ?? 0.9, line: line.id, target: b.focus, pad: b.pad });
      if (b.ring) rings.push({ t0: t, t1, target: b.ring, warn: !!b.warn });
      if (b.click) clicks.push({ t, target: b.click });
      if (b.label) labels.push({ t0: t, t1, target: b.label.target ?? b.ring ?? b.click, text: tr(b.label), side: b.label.side || 'right', style: b.label.style || '' });
    }
  }
  shotSwitches.sort((a, b) => a.t - b.t);
  camKeys.sort((a, b) => a.t - b.t);
  clicks.sort((a, b) => a.t - b.t);

  const shotAt = (t) => {
    let id = shotSwitches[0]?.id;
    for (const s of shotSwitches) if (s.t <= t) id = s.id;
    return id;
  };
  const rectOf = (shotId, target, ctx) => {
    const sh = SHOTS[shotId];
    if (!sh) { warn(`${ctx}: shot "${shotId}" missing from shots/shots.json`); return null; }
    if (target == null) return [0, 0, sh.w, sh.h];
    const r = sh.targets?.[target];
    if (r) return r;
    for (const k in SHOTS) if (SHOTS[k].targets?.[target]) return SHOTS[k].targets[target];
    warn(`${ctx}: target "${target}" not captured in shot "${shotId}"`);
    return null;
  };

  // camera targets
  const fullCam = (shotId) => {
    const sh = SHOTS[shotId] || { w: FRAME.w, h: FRAME.h };
    const s = Math.min(FRAME.w / sh.w, FRAME.h / sh.h);
    return { cx: sh.w / 2, cy: sh.h / 2, s };
  };
  const camFor = (k) => {
    const shotId = shotAt(k.t + 0.01);
    const sh = SHOTS[shotId];
    const full = fullCam(shotId);
    if (k.target == null || !sh) return full;
    const r = rectOf(shotId, k.target, `focus in ${k.line}`);
    if (!r) return full;
    const pad = (k.pad ?? 60) * (sh.dpr || 2);
    let s = Math.min(FRAME.w / (r[2] + 2 * pad), FRAME.h / (r[3] + 2 * pad));
    s = clamp(s, full.s, MAXS);
    const cssScale = s * (sh.dpr || 2);
    if (cssScale < 1.25) warn(`focus "${k.target}" in ${k.line}: 14px app text shows at ${(14 * cssScale).toFixed(0)}px; tighten the target or capture at a higher dpr`);
    // keep the view inside the screenshot where it is larger than the frame
    const vw = FRAME.w / s, vh = FRAME.h / s;
    let cx = r[0] + r[2] / 2, cy = r[1] + r[3] / 2;
    if (vw < sh.w) cx = clamp(cx, vw / 2, sh.w - vw / 2); else cx = sh.w / 2;
    if (vh < sh.h) cy = clamp(cy, vh / 2, sh.h - vh / 2); else cy = sh.h / 2;
    return { cx, cy, s };
  };
  const keyCams = camKeys.map(camFor);
  const keyStart = [];
  const segAt = (i, t) => {
    const k = camKeys[i];
    const a = keyStart[i], b = keyCams[i];
    const e = ease(clamp((t - k.t) / k.dur));
    const s = Math.exp(lerp(Math.log(a.s), Math.log(b.s), e));
    return { cx: lerp(a.cx, b.cx, e), cy: lerp(a.cy, b.cy, e), s };
  };
  camKeys.forEach((k, i) => {
    if (i === 0) { keyStart[0] = keyCams[0]; return; }
    const p = camKeys[i - 1];
    if (k.t < p.t + p.dur - 1e-6) warn(`camera move at ${k.t.toFixed(2)}s (${k.line}) starts before the previous one ends (${(p.t + p.dur).toFixed(2)}s)`);
    keyStart[i] = segAt(i - 1, k.t);
  });
  const camAt = (t) => {
    if (!camKeys.length) return fullCam(shotAt(t));
    let i = 0;
    for (let j = 0; j < camKeys.length; j++) if (camKeys[j].t <= t) i = j;
    if (t < camKeys[0].t) return keyCams[0];
    const c = segAt(i, t);
    const end = camKeys[i].t + camKeys[i].dur;
    const push = 1 + Math.min(0.025, Math.max(0, t - end) * 0.005); // slow push while holding
    return { ...c, s: c.s * push };
  };
  const project = (cam, x, y) => ({ x: (x - cam.cx) * cam.s + FC.x, y: (y - cam.cy) * cam.s + FC.y });
  const projRect = (cam, r) => { const p = project(cam, r[0], r[1]); return { x: p.x, y: p.y, w: r[2] * cam.s, h: r[3] * cam.s }; };

  // cursor windows
  const curWins = [];
  for (const c of clicks) {
    const a = c.t - 1.3, b = c.t + 1.4;
    const last = curWins[curWins.length - 1];
    if (last && a - last.b < 2.5) { last.b = b; last.clicks.push(c); } else curWins.push({ a, b, clicks: [c] });
  }
  const centerOf = (c) => {
    const r = rectOf(shotAt(c.t - 0.01), c.target, `click at ${c.t.toFixed(2)}s`);
    return r ? { x: r[0] + r[2] / 2, y: r[1] + r[3] / 2 } : { x: 0, y: 0 };
  };
  clicks.forEach((c) => { c.p = centerOf(c); });

  // cards
  const titleLines = lines.filter((l) => srcLine[l.id].card === 'title');
  const endLines = lines.filter((l) => srcLine[l.id].card === 'end');
  const titleEnd = titleLines.length ? titleLines[titleLines.length - 1].t1 + 0.5 : -1;
  const endStart = endLines.length ? endLines[0].t0 - 0.7 : TL.dur + 1;

  // chapters
  const chapters = V.chapters || [];
  const chIndex = Object.fromEntries(chapters.map((c, i) => [c.id, i]));

  // ---------- DOM ----------
  const world = $('#world');
  const view = $('#view');
  const overlay = $('#overlay');
  const shotEls = {};
  const usedShots = [...new Set(shotSwitches.map((s) => s.id))];
  for (const id of usedShots) {
    const sh = SHOTS[id];
    if (!sh) { warn(`shot "${id}" used but not captured`); continue; }
    const img = document.createElement('img');
    img.className = 'shot';
    img.src = sh.src;
    img.style.width = sh.w + 'px';
    img.style.height = sh.h + 'px';
    world.appendChild(img);
    shotEls[id] = img;
  }
  const mk = (cls, parent = overlay) => { const d = document.createElement('div'); d.className = cls; parent.appendChild(d); return d; };
  rings.forEach((r) => { r.el = mk('ring' + (r.warn ? ' warn' : '')); });
  labels.forEach((l) => { l.el = mk('label ' + l.style); l.el.textContent = l.text; });
  const ripples = clicks.map(() => mk('ripple'));
  const cursor = document.createElement('div');
  cursor.id = 'cursor';
  cursor.innerHTML = '<svg viewBox="0 0 44 44" width="44" height="44"><path d="M6 4 L6 34 L14 26 L20 39 L26 36.5 L20 24 L31 24 Z" fill="#020817" stroke="#fff" stroke-width="2.5" stroke-linejoin="round"/></svg>';
  overlay.appendChild(cursor);

  // static text
  const tc = $('#titlecard');
  tc.querySelector('.kicker').textContent = tr(V.kicker);
  const area = V.area && AREAS[V.area];
  if (V.area && !area) warn(`area "${V.area}" is not one of: ${Object.keys(AREAS).join(', ')}`);
  if (area) {
    tc.classList.add('area');
    [['--area', 0], ['--area-2', 1], ['--area-soft', 2]].forEach(([k, i]) => tc.style.setProperty(k, area.colors[i]));
    const kicker = tc.querySelector('.kicker');
    kicker.innerHTML = '<span class="chip-area"><span class="e"></span><span class="n"></span></span><span class="feat"></span>';
    kicker.querySelector('.e').textContent = area.emoji;
    kicker.querySelector('.n').textContent = tr(area.name);
    kicker.querySelector('.feat').textContent = tr(V.kicker);
    tc.querySelector('.wm').textContent = tr(area.name);
  }
  const motif = tr(V.motif);
  if (motif) {
    tc.classList.add('has-motif');
    tc.querySelector('.motif .ui').innerHTML = motif.replace(/\{i:([a-z-]+)\}/g, (m, k) => ICONS[k] ?? (warn(`motif icon {i:${k}} is not one of: ${Object.keys(ICONS).join(', ')}`), m));
  }
  tc.querySelector('h1').innerHTML = tr(V.title);
  tc.querySelector('.who').innerHTML = tr(V.who);
  tc.querySelector('.pill').textContent = tr(V.ships);
  const ec = $('#endcard');
  ec.querySelector('h1').innerHTML = tr(V.end?.title);
  ec.querySelector('.who').innerHTML = tr(V.end?.text);
  ec.querySelector('.pill').textContent = tr(V.ships);
  if (!tr(V.ships)) ec.querySelector('.pill').style.display = tc.querySelector('.pill').style.display = 'none';
  $('#brand .f').textContent = tr(V.short || V.title).replace(/<[^>]+>/g, '');
  $('#note').textContent = tr(V.note);
  const subEl = $('#sub');
  const chipEl = $('#chip');
  const subHtml = (s) => s.replace(/\{[\w-]+\}/g, '').replace(/\*\*(.+?)\*\*/g, '<b>$1</b>').replace(/\s+/g, ' ').trim();
  for (const l of lines) if (subHtml(l.text).replace(/<[^>]+>/g, '').length > 110) warn(`line ${l.id}: subtitle longer than 110 characters (three lines on screen); split it`);

  const set = (el, { x = 0, y = 0, s = 1, op = 1 } = {}) => {
    el.style.opacity = op;
    el.style.visibility = op <= 0.001 ? 'hidden' : 'visible';
    el.style.transform = `translate(${x}px, ${y}px) scale(${s})`;
  };

  // ---------- seek ----------
  function seek(t) {
    // shots
    let iSw = -1;
    shotSwitches.forEach((s, i) => { if (s.t <= t) iSw = i; });
    const cur = shotSwitches[Math.max(iSw, 0)]?.id;
    const prev = iSw > 0 ? shotSwitches[iSw - 1].id : null;
    const a = iSw >= 0 ? clamp((t - shotSwitches[iSw].t) / shotSwitches[iSw].fade) : 1;
    for (const id in shotEls) {
      const el = shotEls[id];
      let op = 0, z = 0;
      if (id === cur) { op = prev && prev !== cur ? easeOut(a) : 1; z = 2; }
      else if (id === prev && a < 1) { op = 1; z = 1; }
      el.style.opacity = op;
      el.style.zIndex = z;
      el.style.visibility = op > 0 ? 'visible' : 'hidden';
    }
    // camera
    const cam = camAt(t);
    // the window hugs the screenshot when zoomed out and fills the frame when zoomed in
    const showing = [cur, prev && a < 1 ? prev : null].filter((id) => id && SHOTS[id]);
    let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
    for (const id of showing) {
      const p0 = project(cam, 0, 0), p1 = project(cam, SHOTS[id].w, SHOTS[id].h);
      x0 = Math.min(x0, p0.x); y0 = Math.min(y0, p0.y); x1 = Math.max(x1, p1.x); y1 = Math.max(y1, p1.y);
    }
    if (!showing.length) { x0 = FRAME.x; y0 = FRAME.y; x1 = FRAME.x + FRAME.w; y1 = FRAME.y + FRAME.h; }
    const vx = Math.max(FRAME.x, x0), vy = Math.max(FRAME.y, y0);
    const vw = Math.min(FRAME.x + FRAME.w, x1) - vx, vh = Math.min(FRAME.y + FRAME.h, y1) - vy;
    view.style.left = vx + 'px'; view.style.top = vy + 'px';
    view.style.width = Math.max(0, vw) + 'px'; view.style.height = Math.max(0, vh) + 'px';
    view.style.visibility = showing.length ? 'visible' : 'hidden';
    world.style.transform = `translate(${FC.x - vx}px, ${FC.y - vy}px) scale(${cam.s}) translate(${-cam.cx}px, ${-cam.cy}px)`;

    // rings
    for (const r of rings) {
      const rect = rectOf(shotAt(r.t0 + 0.01), r.target, `ring ${r.target}`);
      const op = win(t, r.t0, r.t1, 0.2, 0.3);
      if (!rect || op <= 0) { set(r.el, { op: 0 }); continue; }
      const p = projRect(cam, rect);
      const k = spring((t - r.t0) / 0.45);
      const pad = 10;
      r.el.style.left = p.x - pad + 'px'; r.el.style.top = p.y - pad + 'px';
      r.el.style.width = p.w + 2 * pad + 'px'; r.el.style.height = p.h + 2 * pad + 'px';
      r.el.style.transformOrigin = 'center';
      set(r.el, { s: lerp(1.12, 1, k), op });
    }
    // labels
    for (const l of labels) {
      const rect = rectOf(shotAt(l.t0 + 0.01), l.target, `label ${l.target}`);
      const op = win(t, l.t0 + 0.1, l.t1, 0.25, 0.3);
      if (!rect || op <= 0) { set(l.el, { op: 0 }); continue; }
      const p = projRect(cam, rect);
      const w = l.el.offsetWidth, h = l.el.offsetHeight, g = 30;
      let x, y;
      if (l.side === 'left') { x = p.x - w - g; y = p.y + p.h / 2 - h / 2; }
      else if (l.side === 'top') { x = p.x + p.w / 2 - w / 2; y = p.y - h - g; }
      else if (l.side === 'bottom') { x = p.x + p.w / 2 - w / 2; y = p.y + p.h + g; }
      else { x = p.x + p.w + g; y = p.y + p.h / 2 - h / 2; }
      x = clamp(x, 40, 1880 - w); y = clamp(y, 100, 890 - h);
      const k = spring((t - l.t0 - 0.1) / 0.5);
      l.el.style.left = x + 'px'; l.el.style.top = y + 'px';
      set(l.el, { y: lerp(14, 0, k), op });
    }
    // cursor
    let cOp = 0, cPos = null, press = 1;
    for (const w of curWins) {
      const op = win(t, w.a, w.b, 0.3, 0.4);
      if (op <= 0) continue;
      cOp = op;
      const cs = w.clicks;
      const enter = { x: cs[0].p.x + 320, y: cs[0].p.y + 240 };
      let pos = enter;
      for (let i = 0; i < cs.length; i++) {
        const from = i === 0 ? enter : cs[i - 1].p;
        const arrive = cs[i].t - 0.1;
        const dur = Math.min(0.85, Math.max(0.35, arrive - (i === 0 ? w.a : cs[i - 1].t + 0.15)));
        if (t >= arrive - dur) {
          const e = ease(clamp((t - (arrive - dur)) / dur));
          pos = { x: lerp(from.x, cs[i].p.x, e), y: lerp(from.y, cs[i].p.y, e) };
        }
        const d = t - cs[i].t;
        if (d >= 0 && d < 0.22) press = 1 - 0.18 * Math.sin((d / 0.22) * Math.PI);
      }
      cPos = pos;
    }
    if (cPos) {
      const p = project(cam, cPos.x, cPos.y);
      set(cursor, { x: p.x - 6, y: p.y - 4, s: press, op: cOp });
    } else set(cursor, { op: 0 });
    clicks.forEach((c, i) => {
      const d = t - c.t;
      const el = ripples[i];
      if (d < 0 || d > 0.6) { set(el, { op: 0 }); return; }
      const p = project(cam, c.p.x, c.p.y);
      const k = easeOut(d / 0.6);
      el.style.left = p.x - 10 + 'px'; el.style.top = p.y - 10 + 'px';
      set(el, { s: lerp(1, 6, k), op: 1 - k });
    });

    // cards
    const tOp = titleLines.length ? (t <= titleEnd ? 1 : 1 - clamp((t - titleEnd) / 0.6)) : 0;
    tc.style.opacity = tOp; tc.style.visibility = tOp > 0 ? 'visible' : 'hidden';
    if (tOp > 0) {
      // Frame 0 is the thumbnail chat apps show, so the kicker and title are in place from the start.
      ['.kicker', 'h1'].forEach((sel) => set(tc.querySelector(sel), { y: 0, op: 1 }));
      ['.who', '.pill'].forEach((sel, i) => {
        const k = spring((t - 0.15 - i * 0.18) / 0.6);
        set(tc.querySelector(sel), { y: lerp(30, 0, k), op: clamp((t - 0.15 - i * 0.18) / 0.3) });
      });
      tc.querySelector('.orb').style.transform = `translate(${-t * 6}px, ${t * 4}px) scale(${1 + t * 0.006})`;
      tc.querySelector('.motif').style.translate = `${-t * 5}px ${t * 2}px`;
    }
    const eOp = clamp((t - endStart) / 0.6);
    ec.style.opacity = eOp; ec.style.visibility = eOp > 0 ? 'visible' : 'hidden';
    if (eOp > 0) {
      ['h1', '.who', '.pill'].forEach((sel, i) => {
        const k = spring((t - endStart - 0.2 - i * 0.18) / 0.6);
        set(ec.querySelector(sel), { y: lerp(30, 0, k), op: clamp((t - endStart - 0.2 - i * 0.18) / 0.3) });
      });
    }
    const cardOp = Math.max(tOp, eOp);

    // chapter chip
    let curLine = null;
    for (const l of content) if (l.t0 - PRE <= t) curLine = l;
    if (curLine && chapters.length) {
      const ch = srcLine[curLine.id].ch;
      const first = content.find((l) => srcLine[l.id].ch === ch);
      const k = spring((t - (first.t0 - PRE)) / 0.5);
      chipEl.querySelector('.n').textContent = (chIndex[ch] ?? 0) + 1;
      chipEl.querySelector('.t').textContent = tr(chapters[chIndex[ch]]?.label ?? ch);
      set(chipEl, { x: lerp(-24, 0, k), op: clamp((t - (first.t0 - PRE)) / 0.25) * (1 - cardOp) });
    } else set(chipEl, { op: 0 });
    $('#brand').style.opacity = 1 - cardOp;
    $('#note').style.opacity = 1 - cardOp;

    // subtitles
    let sub = null;
    for (let i = 0; i < lines.length; i++) {
      const l = lines[i], n = lines[i + 1];
      const end = Math.min(l.t1 + 0.3, n ? n.t0 - 0.05 : Infinity);
      if (t >= l.t0 - 0.05 && t <= end) sub = { l, op: win(t, l.t0 - 0.05, end, 0.12, 0.12) };
    }
    if (sub && srcLine[sub.l.id].card === 'end') sub = null;
    if (sub && P.get('subs') !== '0') {
      const html = subHtml(sub.l.text);
      if (subEl.dataset.id !== sub.l.id) { subEl.innerHTML = html; subEl.dataset.id = sub.l.id; }
      set(subEl, { op: sub.op });
      subEl.style.transform = 'translateX(-50%)';
    } else set(subEl, { op: 0 });
  }

  // ---------- contract ----------
  const fit = () => {
    if (P.has('render')) return;
    const s = Math.min(innerWidth / 1920, innerHeight / 1080);
    $('#stage').style.transform = `scale(${s})`;
  };
  addEventListener('resize', fit);
  fit();
  window.__meta = { dur: TL.dur, fps: V.fps || 30, lang: LANG };
  window.__warnings = WARN;
  window.__clicks = clicks.map((c) => c.t);
  window.__beats = [...shotSwitches.map((s) => s.t), ...camKeys.map((k) => k.t), ...rings.map((r) => r.t0), ...clicks.map((c) => c.t), ...labels.map((l) => l.t0)].sort((a, b) => a - b);
  window.__seek = seek;
  const imgs = [...document.images].map((im) => im.decode().catch(() => warn(`image failed to load: ${im.src}`)));
  // Beside a motif the title column is narrow, so the lines under the title follow its real height.
  const layoutTitle = () => {
    if (!motif) return;
    const h1 = tc.querySelector('h1'), who = tc.querySelector('.who'), pill = tc.querySelector('.pill');
    const lineCount = () => Math.round(h1.offsetHeight / parseFloat(getComputedStyle(h1).lineHeight));
    if (lineCount() > 2) h1.style.fontSize = '88px';
    if (lineCount() > 3) warn('title runs past three lines beside the motif; shorten it');
    who.style.top = h1.offsetTop + h1.offsetHeight + 44 + 'px';
    pill.style.top = who.offsetTop + who.offsetHeight + 40 + 'px';
    if (pill.offsetTop + pill.offsetHeight > 1000) warn('title card text runs off the bottom; shorten the title or the who line');
    const m = tc.querySelector('.motif').getBoundingClientRect(), s = $('#stage').getBoundingClientRect();
    if (m.right > s.right + 1 || m.top < s.top || m.bottom > s.bottom) warn('motif runs off the frame; make it narrower or shorter');
  };
  window.__ready = Promise.all([document.fonts.ready, ...imgs]).then(() => { layoutTitle(); seek(0); return true; });

  window.__ready.then(() => {
    if (P.has('t')) seek(parseFloat(P.get('t')));
    if (P.has('play')) {
      const t0 = performance.now() - (parseFloat(P.get('t')) || 0) * 1000;
      const started = new Set();
      const tick = () => {
        const t = (performance.now() - t0) / 1000;
        seek(Math.min(t, TL.dur));
        for (const l of lines) if (t >= l.t0 && !started.has(l.id)) { started.add(l.id); if (t - l.t0 < 0.3) new Audio(`build/voice-${LANG}/${l.id}.wav`).play().catch(() => {}); }
        if (t < TL.dur) requestAnimationFrame(tick);
      };
      requestAnimationFrame(tick);
    }
  });
})();
