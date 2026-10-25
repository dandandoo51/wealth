'use strict';

/* ---------- state ---------- */

const KEY = 'wealth.v1';
const GROUPS = {
  cash:        { label: 'Cash',             color: 'var(--s-cash)' },
  investments: { label: 'Investments',      color: 'var(--s-inv)' },
  cpf:         { label: 'CPF',              color: 'var(--s-cpf)' },
  other:       { label: 'Property & other', color: 'var(--s-other)' },
};
const BUDGET_COLORS = ['var(--s-cash)', 'var(--s-inv)', 'var(--s-cpf)', 'var(--s-other)'];
const PRIORITIES = ['Highest', 'Higher', 'Middle', 'Lowest'];

let S = null;
const ui = { tab: 'home', page: null, range: 'all' };

function blank() {
  return {
    version: 1, updated: today(),
    profile: { name: '', birthYear: new Date().getFullYear() - 30, usdSgd: 1.3 },
    accounts: [], liabilities: [], insurance: [], income: [], goals: [], snapshots: [],
    budget: { takeHome: 0, note: '', buckets: [] },
    forecast: { includeCpf: false, monthlyInvest: 500, monthlySave: 500, investReturn: 7, saveRate: 0.5,
      cpfMonthly: 0, cpfRate: 3.5, target: 1000000, retireAge: 60, spend: 4000, inflation: 2.5, realTerms: false },
    notes: '', prefs: {},
  };
}

function save() {
  try { localStorage.setItem(KEY, JSON.stringify(S)); }
  catch (e) { toast('Could not save on this device'); }
}
function touch() { S.updated = today(); save(); }

/* ---------- helpers ---------- */

const $ = (s, el = document) => el.querySelector(s);
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const uid = () => Math.random().toString(36).slice(2, 9);
const sum = (arr, f = x => x) => arr.reduce((a, x) => a + (+f(x) || 0), 0);
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
function today() { return new Date().toLocaleDateString('en-CA'); }
function parseDate(s) { return new Date(s + 'T00:00:00'); }
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
function fmtDate(s, short) {
  if (!s) return '';
  const d = parseDate(s);
  return short ? `${MONTHS[d.getMonth()]} ${d.getFullYear()}` : `${d.getDate()} ${MONTHS[d.getMonth()]} ${d.getFullYear()}`;
}
function monthsBetween(a, b) { return (b.getFullYear() - a.getFullYear()) * 12 + (b.getMonth() - a.getMonth()); }

const nf0 = new Intl.NumberFormat('en-SG', { maximumFractionDigits: 0 });
const nf2 = new Intl.NumberFormat('en-SG', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
function moneyText(n, dp = 0) {
  const v = +n || 0;
  return `${v < 0 ? '−' : ''}S$${(dp ? nf2 : nf0).format(Math.abs(v))}`;
}
function money(n, dp = 0) { return `<span class="amt num">${moneyText(n, dp)}</span>`; }
function compact(n) {
  const a = Math.abs(n), s = n < 0 ? '−' : '';
  if (a >= 1e6) return `${s}${+(a / 1e6).toFixed(a >= 1e7 ? 1 : 2)}M`;
  if (a >= 1e3) return `${s}${Math.round(a / 1e3)}k`;
  return `${s}${Math.round(a)}`;
}
function pct(n, dp = 1) { return `${n > 0 ? '+' : n < 0 ? '−' : ''}${Math.abs(n * 100).toFixed(dp)}%`; }
function signed(n) {
  const cls = n > 0 ? 'pos' : n < 0 ? 'neg' : '';
  return `<span class="${cls}">${n > 0 ? '+' : ''}${money(n)}</span>`;
}

const fxRate = cur => cur === 'USD' ? (+S.profile.usdSgd || 1) : 1;
const valSgd = a => (+a.value || 0) * fxRate(a.currency);
const capSgd = a => (+a.capital || 0) * fxRate(a.currency);
const ageNow = () => new Date().getFullYear() - (+S.profile.birthYear || 1996);

function totals() {
  const g = { cash: 0, investments: 0, cpf: 0, other: 0 };
  for (const a of S.accounts) g[a.group in g ? a.group : 'other'] += valSgd(a);
  const assets = g.cash + g.investments + g.cpf + g.other;
  const liab = sum(S.liabilities, l => l.value);
  const invested = S.accounts.filter(a => a.group === 'investments' && +a.capital > 0);
  const capital = sum(invested, capSgd), invValue = sum(invested, valSgd);
  return { ...g, assets, liab, nw: assets - liab, liquid: g.cash + g.investments, capital, invValue };
}
const snapNw = s => (+s.cash || 0) + (+s.investments || 0) + (+s.cpf || 0) + (+s.other || 0) - (+s.liabilities || 0);
const snapsAsc = () => [...S.snapshots].sort((a, b) => a.date.localeCompare(b.date));

/* ---------- icons ---------- */

const ICON = {
  eye: '<svg viewBox="0 0 24 24"><path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/></svg>',
  eyeOff: '<svg viewBox="0 0 24 24"><path d="M3 3l18 18M10.6 5.1A10 10 0 0 1 12 5c6.4 0 10 7 10 7a17 17 0 0 1-3.2 4M6.6 6.6C3.8 8.4 2 12 2 12s3.6 7 10 7c1.8 0 3.4-.5 4.7-1.3M9.9 9.9a3 3 0 0 0 4.2 4.2"/></svg>',
  plus: '<svg viewBox="0 0 24 24"><path d="M12 5v14M5 12h14"/></svg>',
  chev: '<svg class="chev" viewBox="0 0 24 24"><path d="M9 6l6 6-6 6"/></svg>',
  back: '<svg viewBox="0 0 24 24"><path d="M15 6l-6 6 6 6"/></svg>',
  camera: '<svg viewBox="0 0 24 24"><path d="M4 8h3l2-3h6l2 3h3v11H4z"/><circle cx="12" cy="13" r="3.5"/></svg>',
};
const header = (title, sub, right = '') => `
  <div class="top"><div><h1>${title}</h1>${sub ? `<div class="sub">${sub}</div>` : ''}</div>${right}</div>`;
const backBtn = () => `<button class="back" data-act="back">${ICON.back}More</button>`;
const hideBtn = () => `<button class="icon-btn" data-act="toggleHide" aria-label="Hide amounts">${S.prefs?.hide ? ICON.eyeOff : ICON.eye}</button>`;

/* ---------- charts ---------- */

const CH = {};
function niceStep(raw) {
  const p = Math.pow(10, Math.floor(Math.log10(raw || 1)));
  const n = raw / p;
  return (n <= 1 ? 1 : n <= 2 ? 2 : n <= 2.5 ? 2.5 : n <= 5 ? 5 : 10) * p;
}
function lineChart(id, pts, o = {}) {
  if (pts.length < 2) return `<div class="empty small">Add more snapshots to see a trend</div>`;
  const W = 340, H = o.h || 170, pt = 6, pb = 20;
  const xs = pts.map(p => p.x), ys = pts.map(p => p.y);
  const x0 = Math.min(...xs), x1 = Math.max(...xs);
  let y0 = Math.min(0, ...ys), y1 = Math.max(...ys, o.ref || 0);
  if (y1 === y0) y1 = y0 + 1;
  const step = niceStep((y1 - y0) / 3);
  y1 = Math.ceil(y1 / step) * step; y0 = Math.floor(y0 / step) * step;
  const X = x => (x - x0) / (x1 - x0 || 1) * W;
  const Y = y => pt + (1 - (y - y0) / (y1 - y0)) * (H - pt - pb);
  let grid = '';
  for (let v = y0; v <= y1 + step / 2; v += step) {
    grid += `<line x1="0" x2="${W}" y1="${Y(v)}" y2="${Y(v)}" stroke="var(--grid)" stroke-width="1"/>`;
    grid += `<text class="axis-text amt" x="0" y="${Y(v) - 4}">${compact(v)}</text>`;
  }
  const P = pts.map(p => ({ ...p, px: X(p.x), py: Y(p.y) }));
  const d = P.map((p, i) => `${i ? 'L' : 'M'}${p.px.toFixed(1)},${p.py.toFixed(1)}`).join('');
  const area = `${d}L${W},${Y(Math.max(y0, 0))}L0,${Y(Math.max(y0, 0))}Z`;
  const ref = o.ref ? `<line x1="0" x2="${W}" y1="${Y(o.ref)}" y2="${Y(o.ref)}" stroke="var(--text-3)" stroke-width="1" stroke-dasharray="4 4"/>
    <text class="axis-text" x="${W}" y="${Y(o.ref) - 5}" text-anchor="end">${o.refLabel || ''}</text>` : '';
  const xl = o.xl || (p => String(new Date(p.x).getFullYear()));
  const ticks = (o.xticks || [P[0], P[P.length - 1]]).map((p, i, arr) => {
    const q = P.find(z => z.x === p.x) || p;
    const anchor = i === 0 ? 'start' : i === arr.length - 1 ? 'end' : 'middle';
    return `<text class="axis-text" x="${q.px ?? X(p.x)}" y="${H - 4}" text-anchor="${anchor}">${xl(p)}</text>`;
  }).join('');
  const last = P[P.length - 1];
  CH[id] = { pts: P, W, tip: o.tip };
  return `<div class="chart" data-ch="${id}"><div class="tip"></div>
    <svg viewBox="0 0 ${W} ${H}" role="img" aria-label="${esc(o.label || 'Chart')}">
      ${grid}${ref}
      <path d="${area}" fill="var(--chart-fill)"/>
      <path d="${d}" fill="none" stroke="var(--chart-line)" stroke-width="2" stroke-linejoin="round" stroke-linecap="round"/>
      <circle cx="${last.px}" cy="${last.py}" r="4.5" fill="var(--chart-line)" stroke="var(--card)" stroke-width="2"/>
      <line class="hl" x1="0" x2="0" y1="${pt}" y2="${H - pb}"/>
      <circle class="hd" r="4.5" cx="-20" cy="-20" fill="var(--chart-line)" stroke="var(--card)" stroke-width="2"/>
      ${ticks}
    </svg></div>`;
}
function bindCharts() {
  document.querySelectorAll('.chart[data-ch]').forEach(el => {
    const c = CH[el.dataset.ch]; if (!c) return;
    const svg = $('svg', el), tip = $('.tip', el), hl = $('.hl', svg), hd = $('.hd', svg);
    const move = e => {
      const r = svg.getBoundingClientRect();
      const vx = (e.clientX - r.left) / r.width * c.W;
      let best = c.pts[0];
      for (const p of c.pts) if (Math.abs(p.px - vx) < Math.abs(best.px - vx)) best = p;
      hl.setAttribute('x1', best.px); hl.setAttribute('x2', best.px);
      hd.setAttribute('cx', best.px); hd.setAttribute('cy', best.py);
      tip.innerHTML = c.tip(best);
      tip.style.left = clamp(best.px / c.W * r.width, 60, r.width - 60) + 'px';
      el.classList.add('active');
    };
    el.addEventListener('pointermove', move);
    el.addEventListener('pointerdown', move);
    el.addEventListener('pointerleave', () => el.classList.remove('active'));
  });
}
function stackBar(parts) {
  const total = sum(parts, p => Math.max(0, p.v)) || 1;
  return `<div class="stack">${parts.filter(p => p.v > 0).map(p =>
    `<span style="width:${p.v / total * 100}%;background:${p.c}" title="${esc(p.l)}"></span>`).join('')}</div>`;
}

/* ---------- pages ---------- */

function pageHome() {
  const t = totals();
  const snaps = snapsAsc();
  const prev = [...snaps].reverse().find(s => s.date < today());
  const delta = prev ? t.nw - snapNw(prev) : null;
  const latest = snaps[snaps.length - 1];
  const sinceMonths = latest ? monthsBetween(parseDate(latest.date), new Date()) : null;

  // net-worth series: recorded snapshots + live "now" point
  let pts = snaps.map(s => ({ x: +parseDate(s.date), y: snapNw(s), date: s.date }));
  if (!latest || latest.date !== today()) pts.push({ x: Date.now(), y: t.nw, date: today(), now: true });
  else pts[pts.length - 1] = { ...pts[pts.length - 1], y: t.nw, now: true };
  const cut = { '1y': 1, '3y': 3 }[ui.range];
  if (cut) {
    const from = new Date(); from.setFullYear(from.getFullYear() - cut);
    const keep = pts.filter(p => p.x >= +from);
    pts = keep.length >= 2 ? keep : pts.slice(-2);
  }
  const first = snaps[0];

  const comp = Object.entries(GROUPS).map(([k, g]) => ({ k, l: g.label, c: g.color, v: t[k] })).filter(p => p.v > 0);
  const debtOrig = sum(S.liabilities, l => l.original || l.value);
  const expenses = S.budget?.buckets?.find(b => /expense/i.test(b.name))?.amount;

  if (!S.accounts.length && !S.snapshots.length) {
    return header('Wealth', '', '') + `
      <div class="card"><h3>Welcome</h3>
        <p class="muted" style="margin-top:0">Everything you enter stays on this device. Nothing is sent anywhere.</p>
        <div class="btns"><button class="btn primary" data-act="importData">Import backup</button>
        <button class="btn" data-act="addAccount" data-id="cash">Start fresh</button></div>
      </div>`;
  }

  return header('Wealth', `Updated ${fmtDate(S.updated)}`, hideBtn()) + `
    <div class="hero">
      <div class="label">Net worth</div>
      <div class="big">${money(t.nw)}</div>
      ${delta !== null ? `<span class="chip ${delta >= 0 ? 'pos' : 'neg'}">${delta >= 0 ? '▲' : '▼'} <span class="amt">${moneyText(Math.abs(delta))}</span></span>
        <span class="muted small">&nbsp;since ${fmtDate(prev.date)}</span>` : ''}
    </div>

    ${sinceMonths !== null && sinceMonths >= 6 ? `<div class="banner"><div>It's been <b>${sinceMonths} months</b> since your last snapshot. Your rule: update every June & December.</div></div>` : ''}

    <div class="card">
      <h3>Net worth over time <span class="seg">${['1y', '3y', 'all'].map(r =>
        `<button class="${ui.range === r ? 'on' : ''}" data-act="range" data-id="${r}">${r.toUpperCase()}</button>`).join('')}</span></h3>
      ${lineChart('nw', pts, {
        label: 'Net worth over time',
        xl: p => p.now ? 'Now' : fmtDate(p.date, true),
        tip: p => `<span class="amt">${moneyText(p.y)}</span> <span class="muted">${p.now ? 'Now' : fmtDate(p.date)}</span>`,
      })}
      ${first ? `<div class="small muted" style="margin-top:10px">Since ${fmtDate(first.date, true)}: ${signed(t.nw - snapNw(first))}</div>` : ''}
    </div>

    <div class="card">
      <h3>What you own <span class="aside">${money(t.assets)}</span></h3>
      ${stackBar(comp)}
      <div class="legend">${comp.map(p => `
        <div class="row"><span class="dot" style="background:${p.c}"></span>
          <div class="main">${p.l}</div>
          <div class="val">${money(p.v)} <span class="muted small" style="font-weight:500">&nbsp;${Math.round(p.v / (t.assets || 1) * 100)}%</span></div></div>`).join('')}
        <div class="row"><span class="dot" style="background:var(--neg)"></span>
          <div class="main">Debt</div><div class="val neg">${money(-t.liab)}</div></div>
      </div>
    </div>

    <div class="grid2">
      <div class="stat"><div class="k">Liquid</div><div class="v">${money(t.liquid)}</div><div class="s">Cash + investments</div></div>
      <div class="stat"><div class="k">Debt left</div><div class="v">${money(t.liab)}</div>
        <div class="s">${debtOrig > 0 ? `${Math.round((1 - t.liab / debtOrig) * 100)}% paid off` : 'Debt-free'}</div></div>
      <div class="stat"><div class="k">Investment return</div><div class="v ${t.invValue - t.capital >= 0 ? 'pos' : 'neg'}">${t.capital ? pct(t.invValue / t.capital - 1) : '—'}</div>
        <div class="s">${t.capital ? `<span class="amt">${moneyText(t.invValue - t.capital)}</span> on capital` : 'Add capital to see ROI'}</div></div>
      <div class="stat"><div class="k">Emergency runway</div><div class="v">${expenses ? `${(t.cash / expenses).toFixed(1)} mo` : '—'}</div>
        <div class="s">${expenses ? `Cash ÷ <span class="amt">${moneyText(expenses)}</span>/mth spend` : 'Set expenses in Budget'}</div></div>
    </div>

    <div class="btns">
      <button class="btn" data-act="tab" data-id="accounts">Update balances</button>
      <button class="btn primary" data-act="snapshot">Save snapshot</button>
    </div>`;
}

function acctRow(a) {
  const roi = a.group === 'investments' && +a.capital > 0 ? +a.value / +a.capital - 1 : null;
  const meta = [a.institution, a.currency === 'USD' ? `US$${nf2.format(+a.value || 0)}` : '', roi !== null ? `<span class="${roi >= 0 ? 'pos' : 'neg'}">${pct(roi)}</span>` : '']
    .filter(Boolean).join(' · ');
  return `<button class="row" data-act="editAccount" data-id="${a.id}">
    <div class="main"><div class="title">${esc(a.name)}</div><div class="meta">${meta || '&nbsp;'}</div></div>
    <div class="val">${money(valSgd(a))}${a.note && !+a.value ? '<div class="meta">needs update</div>' : ''}</div>${ICON.chev}</button>`;
}

function pageAccounts() {
  const t = totals();
  let html = header('Accounts', 'Tap any item to update it', hideBtn());
  for (const [k, g] of Object.entries(GROUPS)) {
    const list = S.accounts.filter(a => (a.group in GROUPS ? a.group : 'other') === k);
    if (!list.length && k === 'other') {
      html += `<div class="section-title"><span>${g.label}</span></div>
        <div class="card flush"><button class="add" style="border:0" data-act="addAccount" data-id="${k}">${ICON.plus.replace('<svg', '<svg width="18" height="18" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"')} Add car, property, collectibles…</button></div>`;
      continue;
    }
    html += `<div class="section-title"><span>${g.label}</span><span class="aside">${money(t[k])}</span></div>
      <div class="card flush">${list.map(acctRow).join('')}
        <button class="add" data-act="addAccount" data-id="${k}">${ICON.plus.replace('<svg', '<svg width="18" height="18" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"')} Add</button></div>`;
  }
  html += `<div class="section-title"><span>Debt</span><span class="aside neg">${money(-t.liab)}</span></div>
    <div class="card flush">${S.liabilities.map(l => {
      const paid = +l.original ? 1 - l.value / l.original : null;
      const meta = [l.institution, l.rate ? `${l.rate}% p.a.` : '', paid !== null ? `${Math.round(paid * 100)}% paid` : ''].filter(Boolean).join(' · ');
      return `<button class="row" data-act="editDebt" data-id="${l.id}"><div class="main"><div class="title">${esc(l.name)}</div><div class="meta">${meta}</div>
        ${paid !== null ? `<div class="bar" style="margin:6px 0 0"><span style="width:${clamp(paid, 0, 1) * 100}%"></span></div>` : ''}</div>
        <div class="val">${money(l.value)}${payoffText(l)}</div>${ICON.chev}</button>`;
    }).join('')}
    <button class="add" data-act="addDebt">${ICON.plus.replace('<svg', '<svg width="18" height="18" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"')} Add debt</button></div>
    <div class="btns" style="margin-top:18px"><button class="btn primary" data-act="snapshot">Save snapshot</button></div>
    <p class="small muted" style="text-align:center">A snapshot records today's balances in your history.</p>`;
  return html;
}

function payoffMonths(l) {
  const P = +l.value, m = +l.monthly, r = (+l.rate || 0) / 1200;
  if (!P || !m) return null;
  if (r === 0) return Math.ceil(P / m);
  if (m <= P * r) return Infinity;
  return Math.ceil(-Math.log(1 - r * P / m) / Math.log(1 + r));
}
function payoffText(l) {
  const n = payoffMonths(l);
  if (n === null) return '';
  if (n === Infinity) return '<div class="meta neg">payment too low</div>';
  const d = new Date(); d.setMonth(d.getMonth() + n);
  return `<div class="meta">paid off ${MONTHS[d.getMonth()]} ${d.getFullYear()}</div>`;
}

function goalCurrent(g) {
  const t = totals();
  if (g.link === 'manual' || !g.link) return +g.saved || 0;
  if (g.link === 'networth') return t.nw;
  if (g.link === 'liquid') return t.liquid;
  if (g.link in t) return t[g.link];
  if (g.link.startsWith('acct:')) { const a = S.accounts.find(x => x.id === g.link.slice(5)); return a ? valSgd(a) : 0; }
  return 0;
}
function linkLabel(link) {
  if (!link || link === 'manual') return 'Tracked manually';
  if (link === 'networth') return 'Tracks net worth';
  if (link === 'liquid') return 'Tracks cash + investments';
  if (GROUPS[link]) return `Tracks ${GROUPS[link].label.toLowerCase()}`;
  const a = S.accounts.find(x => x.id === link.slice(5));
  return a ? `Tracks ${a.institution ? a.institution + ' ' : ''}${a.name}` : 'Tracked manually';
}

function pageGoals() {
  const by = PRIORITIES.map(p => S.goals.filter(g => g.priority === p)).flat()
    .concat(S.goals.filter(g => !PRIORITIES.includes(g.priority)));
  const nowY = new Date().getFullYear(), age = ageNow();
  return header('Goals', `You're ${age} this year`, hideBtn()) + by.map(g => {
    const cur = goalCurrent(g), p = g.target ? clamp(cur / g.target, 0, 1) : 0;
    const year = (+S.profile.birthYear) + (+g.age);
    const months = Math.max(0, (year - nowY) * 12 + (11 - new Date().getMonth()));
    const left = Math.max(0, g.target - cur);
    // 5+ years out: assume what's already there and new money both grow at the forecast return.
    const r = months >= 60 ? (+S.forecast.investReturn || 0) / 1200 : 0;
    const gap = r ? g.target - cur * Math.pow(1 + r, months) : left;
    const perMonth = r ? gap * r / (Math.pow(1 + r, months) - 1) : gap / months;
    const need = left <= 0 ? 'Reached' : months <= 0 ? 'Target date passed'
      : gap <= 0 ? 'On track from growth alone'
      : `${money(perMonth)}/mth${r ? ` at ${S.forecast.investReturn}%` : ''} to get there`;
    return `<div class="card"><button class="goal" data-act="editGoal" data-id="${g.id}">
      <div class="head"><div class="name">${esc(g.name)}<span class="tag">${esc(g.priority || '')}</span></div>
        <div class="num" style="font-weight:600">${money(g.target)}</div></div>
      <div class="bar ${p >= 1 ? 'done' : ''}"><span style="width:${p * 100}%"></span></div>
      <div class="foot"><span>${money(cur)} · ${Math.round(p * 100)}%</span><span>by age ${g.age} (${year})</span></div>
      <div class="foot" style="margin-top:4px"><span>${linkLabel(g.link)}</span><span>${need}</span></div>
      ${g.note ? `<div class="small muted" style="margin-top:8px">${esc(g.note)}</div>` : ''}
    </button></div>`;
  }).join('') + `<div class="btns"><button class="btn" data-act="addGoal">Add goal</button></div>`;
}

/* forecast */
function project(f, override = {}) {
  f = { ...f, ...override };
  const t = totals(), a0 = ageNow(), endAge = 85;
  let inv = t.investments, sav = t.cash, cpf = f.includeCpf ? t.cpf : 0;
  const r = (+f.investReturn || 0) / 1200, s = (+f.saveRate || 0) / 1200, c = (+f.cpfRate || 0) / 1200, i = (+f.inflation || 0) / 100;
  const rows = [{ age: a0, inv, sav, cpf, total: inv + sav + cpf }];
  let runOut = null;
  for (let m = 1; m <= (endAge - a0) * 12; m++) {
    const age = a0 + m / 12, working = age <= f.retireAge;
    inv = inv * (1 + r) + (working ? +f.monthlyInvest || 0 : 0);
    sav = sav * (1 + s) + (working ? +f.monthlySave || 0 : 0);
    cpf = cpf * (1 + c) + (working && f.includeCpf ? +f.cpfMonthly || 0 : 0);
    if (!working) {
      let w = (+f.spend || 0) * Math.pow(1 + i, age - a0);
      const fromSav = Math.min(sav, w); sav -= fromSav; w -= fromSav;
      inv -= w;
      if (inv < 0) { if (runOut === null) runOut = Math.floor(age); inv = 0; }
    }
    if (m % 12 === 0) rows.push({ age: a0 + m / 12, inv, sav, cpf, total: inv + sav + cpf });
  }
  const real = row => f.realTerms ? row.total / Math.pow(1 + i, row.age - a0) : row.total;
  rows.forEach(row => { row.shown = real(row); });
  return { rows, runOut };
}
function requiredInvest(f) {
  const atRetire = inv => project(f, { monthlyInvest: inv }).rows.find(r => r.age >= f.retireAge)?.shown ?? 0;
  if (atRetire(0) >= f.target) return 0;
  let lo = 0, hi = 100000;
  if (atRetire(hi) < f.target) return null;
  for (let k = 0; k < 40; k++) { const mid = (lo + hi) / 2; atRetire(mid) >= f.target ? hi = mid : lo = mid; }
  return Math.ceil(hi / 10) * 10;
}

function pageForecast() {
  const f = S.forecast, a0 = ageNow(), y0 = new Date().getFullYear();
  const { rows, runOut } = project(f);
  const atRetire = rows.find(r => r.age >= f.retireAge);
  const hit = rows.find(r => r.shown >= f.target);
  const need = requiredInvest(f);
  const t = totals();
  const pts = rows.map(r => ({ x: r.age, y: r.shown, age: r.age }));
  const ticks = [pts[0], pts.find(p => p.age === f.retireAge), pts[pts.length - 1]].filter(Boolean);
  const ages = [...new Set([35, 40, 45, 50, 55, 60, 65, 70, 80, +f.retireAge])].filter(a => a > a0 && a <= 85).sort((a, b) => a - b);
  const num = (k, label, unit = '', step = 'any') => `<div class="field"><label for="f-${k}">${label}</label>
    <input id="f-${k}" type="number" inputmode="decimal" step="${step}" data-f="${k}" value="${esc(f[k])}"><span class="unit">${unit}</span></div>`;
  const chk = (k, label) => `<div class="field"><label for="f-${k}">${label}</label><input id="f-${k}" type="checkbox" data-f="${k}" ${f[k] ? 'checked' : ''}></div>`;

  return header('Forecast', f.realTerms ? "In today's dollars" : 'Future dollars, before inflation', hideBtn()) + `
    <div class="card">
      <div class="answer">${hit
        ? `You reach <em>${money(f.target)}</em> at age <em>${hit.age}</em> <span class="muted" style="font-weight:500">(${y0 + hit.age - a0})</span>`
        : `You don't reach <em>${money(f.target)}</em> by 85 on this plan`}</div>
      <div class="small muted">At ${f.retireAge}: ${money(atRetire?.shown ?? 0)} · ${runOut ? `money runs out at ${runOut} spending ${money(f.spend)}/mth` : `lasts past 85 spending ${money(f.spend)}/mth`}</div>
      <div style="margin-top:14px">${lineChart('fc', pts, {
        h: 180, ref: +f.target, refLabel: `Target ${compact(+f.target)}`, xticks: ticks,
        label: 'Projected wealth by age', xl: p => `Age ${p.age}`,
        tip: p => `<span class="amt">${moneyText(p.y)}</span> <span class="muted">age ${p.age} · ${y0 + p.age - a0}</span>`,
      })}</div>
    </div>

    <div class="card"><h3>To hit your target by ${f.retireAge}</h3>
      <div class="answer" style="font-size:19px">${need === null ? 'Not reachable by investing alone — adjust the target or age'
        : need === 0 ? "You're already on track with no extra investing"
        : need <= +f.monthlyInvest ? `On track — you need about ${money(need)}/mth`
        : `Invest ${money(need)}/mth <span class="muted" style="font-weight:500">(${money(need - f.monthlyInvest)} more)</span>`}</div>
      <div class="small muted">Currently planned: ${money(f.monthlyInvest)}/mth at ${f.investReturn}% a year.</div>
    </div>

    <div class="card"><h3>Your plan</h3>
      ${num('target', 'Target amount', 'S$', 1000)}
      ${num('retireAge', 'Retire at age', 'yrs', 1)}
      ${num('monthlyInvest', 'Invest each month', 'S$', 10)}
      ${num('investReturn', 'Investment return', '%/yr', .5)}
      ${num('monthlySave', 'Save each month', 'S$', 10)}
      ${num('saveRate', 'Savings interest', '%/yr', .1)}
      ${num('spend', 'Spend in retirement', 'S$/m', 100)}
      ${num('inflation', 'Inflation', '%/yr', .1)}
      ${chk('realTerms', "Show in today's dollars")}
      ${chk('includeCpf', 'Include CPF')}
      ${f.includeCpf ? num('cpfMonthly', 'CPF contribution / mth', 'S$', 10) + num('cpfRate', 'CPF blended interest', '%/yr', .1) : ''}
      <div class="small muted" style="padding-top:10px">Starts from today's ${money(t.cash)} cash and ${money(t.investments)} investments${f.includeCpf ? ` and ${money(t.cpf)} CPF` : ''}. Contributions stop at retirement; then spending (rising with inflation) is drawn from savings first, then investments.</div>
    </div>

    <div class="card"><h3>Milestones</h3>
      <table class="tbl num"><thead><tr><th>Age</th><th>Year</th><th>Projected</th></tr></thead><tbody>
      ${ages.map(a => { const r = rows.find(x => x.age === a); return r ? `<tr class="${a === +f.retireAge ? 'hit' : ''}"><td>${a}</td><td>${y0 + a - a0}</td><td>${money(r.shown)}</td></tr>` : ''; }).join('')}
      </tbody></table>
    </div>`;
}

/* more */
function pageMore() {
  const t = totals();
  const prem = sum(S.insurance, p => annualPremium(p));
  const items = [
    ['insurance', 'Insurance', `${S.insurance.length} policies · ${moneyText(prem)}/yr`],
    ['history', 'Net worth history', `${S.snapshots.length} snapshots`],
    ['income', 'Income', S.income.length ? `${S.income.length} records` : 'Add salary history'],
    ['budget', 'Budget plan', S.budget?.takeHome ? `${moneyText(S.budget.takeHome)}/mth take-home` : 'Set up'],
    ['notes', 'Notes', 'Plans, benchmarks, ideas'],
    ['settings', 'Settings & backup', 'Profile, FX rate, export'],
  ];
  return header('More', '', hideBtn()) + `<div class="card flush">${items.map(([id, l, m]) =>
    `<button class="row" data-act="page" data-id="${id}"><div class="main"><div class="title">${l}</div><div class="meta amt">${esc(m)}</div></div>${ICON.chev}</button>`).join('')}</div>
    <p class="small muted" style="text-align:center;margin-top:20px">Your data lives only on this device.<br>Export a backup now and then.</p>`;
}

const annualPremium = p => (+p.premium || 0) * ({ monthly: 12, quarterly: 4, 'half-yearly': 2, yearly: 1, single: 0 }[p.freq] ?? 12);

function pageInsurance() {
  const prem = sum(S.insurance, annualPremium);
  const life = sum(S.insurance, p => p.cover);
  return backBtn() + header('Insurance', '', '') + `
    <div class="grid2">
      <div class="stat"><div class="k">Life cover</div><div class="v">${money(life)}</div><div class="s">Death / TPD sum assured</div></div>
      <div class="stat"><div class="k">Premiums</div><div class="v">${money(prem)}</div><div class="s"><span class="amt">${moneyText(prem / 12)}</span>/mth</div></div>
    </div>
    ${S.insurance.map(p => `<div class="card policy"><button class="goal" data-act="editPolicy" data-id="${p.id}">
      <div class="head"><div class="name">${esc(p.name)}${p.type ? `<span class="tag">${esc(p.type)}</span>` : ''}</div>${ICON.chev}</div>
      <div class="small muted">${esc(p.provider || 'Provider not set')}</div>
      <div class="cover">${p.cover ? money(p.cover) : '<span class="muted" style="font-size:16px">Cover not set</span>'}</div>
      <div class="small muted">${p.premium ? `${money(p.premium)} ${esc(p.freq)}` : 'Premium not set'}</div>
      ${p.riders?.length ? `<div style="margin-top:10px">${p.riders.map(r => `<div class="rider"><span>${esc(r.name)}</span><span>${r.cover ? money(r.cover) : ''}</span></div>`).join('')}</div>` : ''}
      ${p.note ? `<div class="small muted" style="margin-top:8px">${esc(p.note)}</div>` : ''}
    </button></div>`).join('')}
    <div class="btns"><button class="btn" data-act="addPolicy">Add policy</button></div>`;
}

function pageHistory() {
  const snaps = [...S.snapshots].sort((a, b) => b.date.localeCompare(a.date));
  return backBtn() + header('History', 'Tap a snapshot for details & notes', '') + `<div class="card flush">${snaps.map((s, i) => {
    const prev = snaps[i + 1];
    const d = prev ? snapNw(s) - snapNw(prev) : null;
    return `<button class="row" data-act="viewSnap" data-id="${s.id}"><div class="main"><div class="title">${fmtDate(s.date)}</div>
      <div class="meta">${s.comments?.length ? `${s.comments.length} note${s.comments.length > 1 ? 's' : ''}` : '&nbsp;'}</div></div>
      <div class="val">${money(snapNw(s))}<div class="meta">${d !== null ? signed(d) : 'first'}</div></div>${ICON.chev}</button>`;
  }).join('') || '<div class="empty">No snapshots yet</div>'}</div>`;
}

function pageIncome() {
  const list = [...S.income].sort((a, b) => b.date.localeCompare(a.date));
  const paid = [...S.income].filter(x => +x.monthly > 0).sort((a, b) => a.date.localeCompare(b.date));
  const growth = paid.length > 1 ? paid[paid.length - 1].monthly / paid[0].monthly - 1 : null;
  const yrs = paid.length > 1 ? (parseDate(paid[paid.length - 1].date) - parseDate(paid[0].date)) / 3.156e10 : 0;
  return backBtn() + header('Income', 'Gross monthly salary over time', '') + `
    ${growth !== null ? `<div class="grid2">
      <div class="stat"><div class="k">Salary growth</div><div class="v pos">${pct(growth)}</div><div class="s">over ${yrs.toFixed(1)} years</div></div>
      <div class="stat"><div class="k">Per year</div><div class="v">${pct(Math.pow(1 + growth, 1 / (yrs || 1)) - 1)}</div><div class="s">compounded</div></div></div>` : ''}
    <div class="card"><div class="tl">${list.map(x => `<button class="item goal" data-act="editIncome" data-id="${x.id}">
      <div class="d">${fmtDate(x.date, true)} · ${esc(x.source)}</div>
      <div class="t">${+x.monthly ? `${money(x.monthly)}/mth` : '—'}</div>
      ${x.note ? `<div class="small muted">${esc(x.note)}</div>` : ''}</button>`).join('') || '<div class="empty">No income records</div>'}</div></div>
    <div class="btns"><button class="btn" data-act="addIncome">Add income</button></div>`;
}

function pageBudget() {
  const b = S.budget, th = +b.takeHome || 0;
  const used = sum(b.buckets, x => x.amount);
  const parts = b.buckets.map((x, i) => ({ l: x.name, v: +x.amount, c: BUDGET_COLORS[i % 4] }));
  return backBtn() + header('Budget plan', 'How each month\'s take-home pay is split', '') + `
    <div class="card">
      <div class="field" style="padding-top:0"><label for="th">Take-home pay / mth</label><input id="th" type="number" inputmode="decimal" data-b="takeHome" value="${esc(th)}"><span class="unit">S$</span></div>
      ${stackBar(parts)}
      <div class="legend">${b.buckets.map((x, i) => `<button class="row" data-act="editBucket" data-id="${i}"><span class="dot" style="background:${BUDGET_COLORS[i % 4]}"></span>
        <div class="main">${esc(x.name)}</div><div class="val">${money(x.amount)} <span class="muted small" style="font-weight:500">&nbsp;${th ? Math.round(x.amount / th * 100) : 0}%</span></div></button>`).join('')}
        <div class="row"><span class="dot" style="background:var(--line)"></span><div class="main muted">Unallocated</div><div class="val muted">${money(th - used)}</div></div>
      </div>
      ${b.note ? `<div class="small muted" style="margin-top:8px">${esc(b.note)}</div>` : ''}
    </div>
    <div class="btns"><button class="btn" data-act="addBucket">Add category</button></div>`;
}

function pageNotes() {
  return backBtn() + header('Notes', 'Saved automatically', '') +
    `<div class="card"><textarea data-notes style="width:100%;min-height:60vh;border:0;background:transparent;font-size:16px;line-height:1.5;outline:none;resize:none">${esc(S.notes)}</textarea></div>`;
}

function pageSettings() {
  const p = S.profile;
  const fld = (k, label, type = 'text') => `<div class="field"><label for="p-${k}">${label}</label><input id="p-${k}" type="${type}" ${type === 'number' ? 'inputmode="decimal" step="any"' : ''} data-p="${k}" value="${esc(p[k])}"></div>`;
  const theme = S.prefs?.theme || 'auto';
  return backBtn() + header('Settings', '', '') + `
    <div class="card">${fld('name', 'Name')}${fld('birthYear', 'Birth year', 'number')}${fld('usdSgd', '1 USD in SGD', 'number')}
      <div class="field"><label>Appearance</label><span class="seg">${['auto', 'light', 'dark'].map(x => `<button class="${theme === x ? 'on' : ''}" data-act="theme" data-id="${x}">${x[0].toUpperCase() + x.slice(1)}</button>`).join('')}</span></div>
    </div>
    <div class="section-title"><span>Backup</span></div>
    <div class="card flush">
      <button class="row" data-act="exportData"><div class="main"><div class="title">Export backup</div><div class="meta">Save a .json file to Files or iCloud Drive</div></div>${ICON.chev}</button>
      <button class="row" data-act="importData"><div class="main"><div class="title">Import backup</div><div class="meta">Replaces everything on this device</div></div>${ICON.chev}</button>
    </div>
    <div class="card flush"><button class="row" data-act="resetAll"><div class="main"><div class="title neg">Erase all data</div></div></button></div>
    <p class="small muted" style="text-align:center">No bank connections, no accounts, no servers.<br>Everything stays in this app on this device.</p>`;
}

const PAGES = { home: pageHome, accounts: pageAccounts, goals: pageGoals, forecast: pageForecast, more: pageMore,
  insurance: pageInsurance, history: pageHistory, income: pageIncome, budget: pageBudget, notes: pageNotes, settings: pageSettings };

function render(keepScroll) {
  const y = window.scrollY;
  $('#view').innerHTML = PAGES[ui.page || ui.tab]();
  bindCharts();
  document.querySelectorAll('#tabbar button').forEach(b => b.classList.toggle('on', b.dataset.tab === ui.tab));
  document.body.classList.toggle('hide', !!S.prefs?.hide);
  window.scrollTo(0, keepScroll ? y : 0);
}

/* ---------- bottom-sheet form ---------- */

let sheetSave = null;
function openSheet(title, body, { onSave, onDelete, saveLabel = 'Save' } = {}) {
  const sh = $('#sheet');
  sh.innerHTML = `<div class="grab"></div><div class="sh-head"><button class="link" data-act="closeSheet">Cancel</button><h2>${esc(title)}</h2>
    ${onSave ? `<button class="link" data-act="sheetSave">${saveLabel}</button>` : '<span style="width:50px"></span>'}</div>
    <div class="form">${body}</div>${onDelete ? `<div class="btns" style="margin-top:6px"><button class="btn danger" data-act="sheetDelete">Delete</button></div>` : ''}`;
  sheetSave = { onSave, onDelete };
  $('#backdrop').classList.add('on'); sh.classList.add('on');
}
function closeSheet() { $('#sheet').classList.remove('on'); $('#backdrop').classList.remove('on'); sheetSave = null; }

function formBody(fields, d) {
  return `<div class="card">${fields.map(f => {
    const id = `ff-${f.k}`, v = d[f.k] ?? '';
    if (f.type === 'select') return `<div class="f"><label for="${id}">${f.label}</label><select id="${id}" data-k="${f.k}">${f.options.map(([ov, ol]) =>
      `<option value="${esc(ov)}" ${String(ov) === String(v) ? 'selected' : ''}>${esc(ol)}</option>`).join('')}</select></div>`;
    if (f.type === 'textarea') return `<div class="f"><label for="${id}">${f.label}</label><textarea id="${id}" data-k="${f.k}" placeholder="${esc(f.ph || '')}">${esc(v)}</textarea></div>`;
    if (f.type === 'check') return `<div class="f inline"><label for="${id}">${f.label}</label><input id="${id}" type="checkbox" data-k="${f.k}" ${v ? 'checked' : ''}></div>`;
    const num = f.type === 'number';
    return `<div class="f"><label for="${id}">${f.label}</label><input id="${id}" data-k="${f.k}" type="${num ? 'number' : f.type || 'text'}" ${num ? 'inputmode="decimal" step="any"' : ''}
      value="${esc(v)}" placeholder="${esc(f.ph || '')}"></div>`;
  }).join('')}</div>`;
}
function readForm(fields) {
  const out = {};
  for (const f of fields) {
    const el = $(`#sheet [data-k="${f.k}"]`); if (!el) continue;
    if (f.type === 'check') out[f.k] = el.checked;
    else if (f.type === 'number') out[f.k] = el.value === '' ? null : parseFloat(el.value);
    else out[f.k] = el.value.trim();
  }
  return out;
}
function editForm(title, fields, data, onSave, onDelete) {
  openSheet(title, formBody(fields, data), {
    onSave: () => { onSave(readForm(fields)); touch(); closeSheet(); render(true); },
    onDelete: onDelete && (() => { if (confirm('Delete this?')) { onDelete(); touch(); closeSheet(); render(true); } }),
  });
}

/* ---------- editors ---------- */

const ACCT_FIELDS = () => [
  { k: 'name', label: 'Name', ph: 'e.g. Savings account' },
  { k: 'institution', label: 'Bank / platform', ph: 'e.g. DBS, IBKR, CPF' },
  { k: 'group', label: 'Type', type: 'select', options: Object.entries(GROUPS).map(([k, g]) => [k, g.label]) },
  { k: 'currency', label: 'Currency', type: 'select', options: [['SGD', 'SGD'], ['USD', 'USD']] },
  { k: 'value', label: 'Current value', type: 'number' },
  { k: 'capital', label: 'Capital invested (for investments)', type: 'number' },
  { k: 'note', label: 'Note', type: 'textarea' },
];
function editAccount(id, group) {
  const a = S.accounts.find(x => x.id === id) || { id: uid(), group: group || 'cash', currency: 'SGD', name: '', value: 0 };
  const isNew = !S.accounts.includes(a);
  editForm(isNew ? 'Add account' : 'Update account', ACCT_FIELDS(), a,
    v => { Object.assign(a, v); if (isNew) S.accounts.push(a); },
    !isNew && (() => { S.accounts = S.accounts.filter(x => x !== a); }));
  if (!isNew) setTimeout(() => { const el = $('#ff-value'); el?.focus(); el?.select(); }, 300);
}
function editDebt(id) {
  const l = S.liabilities.find(x => x.id === id) || { id: uid(), name: '', value: 0 };
  const isNew = !S.liabilities.includes(l);
  editForm(isNew ? 'Add debt' : 'Update debt', [
    { k: 'name', label: 'Name' }, { k: 'institution', label: 'Lender' },
    { k: 'value', label: 'Amount owed now', type: 'number' }, { k: 'original', label: 'Original amount', type: 'number' },
    { k: 'rate', label: 'Interest rate (% p.a.)', type: 'number' }, { k: 'monthly', label: 'Monthly repayment', type: 'number' },
    { k: 'note', label: 'Note', type: 'textarea' },
  ], l, v => { Object.assign(l, v); if (isNew) S.liabilities.push(l); },
  !isNew && (() => { S.liabilities = S.liabilities.filter(x => x !== l); }));
}
function editGoal(id) {
  const g = S.goals.find(x => x.id === id) || { id: uid(), name: '', target: 0, age: ageNow() + 5, priority: 'Middle', link: 'manual', saved: 0 };
  const isNew = !S.goals.includes(g);
  const links = [['manual', 'Manual amount below'], ['networth', 'Net worth'], ['liquid', 'Cash + investments'],
    ...Object.entries(GROUPS).map(([k, x]) => [k, `All ${x.label.toLowerCase()}`]),
    ...S.accounts.map(a => [`acct:${a.id}`, `${a.institution ? a.institution + ' – ' : ''}${a.name}`])];
  editForm(isNew ? 'Add goal' : 'Edit goal', [
    { k: 'name', label: 'Goal' }, { k: 'target', label: 'Target amount', type: 'number' },
    { k: 'age', label: 'By age', type: 'number' },
    { k: 'priority', label: 'Priority', type: 'select', options: PRIORITIES.map(p => [p, p]) },
    { k: 'link', label: 'Progress comes from', type: 'select', options: links },
    { k: 'saved', label: 'Saved so far (if manual)', type: 'number' },
    { k: 'note', label: 'Note', type: 'textarea' },
  ], g, v => { Object.assign(g, v); if (isNew) S.goals.push(g); },
  !isNew && (() => { S.goals = S.goals.filter(x => x !== g); }));
}
function editPolicy(id) {
  const p = S.insurance.find(x => x.id === id) || { id: uid(), name: '', freq: 'monthly', riders: [] };
  const isNew = !S.insurance.includes(p);
  const data = { ...p, ridersText: (p.riders || []).map(r => `${r.name}${r.cover ? ': ' + r.cover : ''}`).join('\n') };
  editForm(isNew ? 'Add policy' : 'Edit policy', [
    { k: 'name', label: 'Policy name' }, { k: 'provider', label: 'Insurer', ph: 'e.g. Great Eastern, Income, AIA' },
    { k: 'type', label: 'Type', ph: 'Term life, Whole life, Hospital (ISP)…' },
    { k: 'cover', label: 'Sum assured', type: 'number' }, { k: 'premium', label: 'Premium', type: 'number' },
    { k: 'freq', label: 'Paid', type: 'select', options: ['monthly', 'quarterly', 'half-yearly', 'yearly', 'single'].map(x => [x, x]) },
    { k: 'ridersText', label: 'Riders — one per line, "Name: amount"', type: 'textarea' },
    { k: 'note', label: 'Note', type: 'textarea' },
  ], data, v => {
    v.riders = v.ridersText.split('\n').map(s => s.trim()).filter(Boolean).map(s => {
      const m = s.match(/^(.*?)(?:\s*[:\-–]\s*\$?([\d,.]+)k?)?$/i);
      const n = m && m[2] ? parseFloat(m[2].replace(/,/g, '')) * (/k$/i.test(s) ? 1000 : 1) : null;
      return { name: (m ? m[1] : s).trim(), cover: n };
    });
    delete v.ridersText; Object.assign(p, v); if (isNew) S.insurance.push(p);
  }, !isNew && (() => { S.insurance = S.insurance.filter(x => x !== p); }));
}
function editIncome(id) {
  const x = S.income.find(i => i.id === id) || { id: uid(), date: today(), source: '', monthly: null };
  const isNew = !S.income.includes(x);
  editForm(isNew ? 'Add income' : 'Edit income', [
    { k: 'date', label: 'From', type: 'date' }, { k: 'source', label: 'Employer / source' },
    { k: 'monthly', label: 'Gross monthly (S$)', type: 'number' }, { k: 'note', label: 'Note', type: 'textarea' },
  ], x, v => { Object.assign(x, v); if (isNew) S.income.push(x); },
  !isNew && (() => { S.income = S.income.filter(i => i !== x); }));
}
function editBucket(i) {
  const isNew = i === undefined;
  const b = isNew ? { name: '', amount: 0 } : S.budget.buckets[+i];
  editForm(isNew ? 'Add category' : 'Edit category', [{ k: 'name', label: 'Category' }, { k: 'amount', label: 'Amount per month', type: 'number' }], b,
    v => { Object.assign(b, v); if (isNew) S.budget.buckets.push(b); },
    !isNew && (() => { S.budget.buckets.splice(+i, 1); }));
}

function saveSnapshot() {
  const fields = [{ k: 'date', label: 'Date', type: 'date' }, { k: 'comments', label: 'Notes for this snapshot — one per line', type: 'textarea', ph: 'What changed? Big purchases, new job…' }];
  const t = totals();
  openSheet('Save snapshot', `<p class="small muted" style="margin:0 4px 10px">Records today's net worth of ${money(t.nw)} in your history.</p>` + formBody(fields, { date: today() }), {
    onSave: () => {
      const v = readForm(fields);
      const snap = {
        id: uid(), date: v.date || today(), cash: t.cash, investments: t.investments, cpf: t.cpf, other: t.other, liabilities: t.liab,
        holdings: S.accounts.map(a => [`${a.institution ? a.institution + ' ' : ''}${a.name}`, +valSgd(a).toFixed(2), +a.capital ? +capSgd(a).toFixed(2) : undefined].filter(x => x !== undefined)),
        debts: S.liabilities.map(l => [l.name, +l.value]),
        comments: v.comments.split('\n').map(s => s.trim()).filter(Boolean),
      };
      S.snapshots = S.snapshots.filter(s => s.date !== snap.date);
      S.snapshots.push(snap); touch(); closeSheet(); render(true); toast('Snapshot saved');
    }, saveLabel: 'Save',
  });
}
function viewSnap(id) {
  const s = S.snapshots.find(x => x.id === id); if (!s) return;
  const parts = Object.entries(GROUPS).map(([k, g]) => ({ l: g.label, c: g.color, v: +s[k] || 0 })).filter(p => p.v > 0);
  const body = `
    <div class="hero" style="padding:0 4px 8px"><div class="label">Net worth${s.dateNote ? ` · <span class="small">${esc(s.dateNote)}</span>` : ''}</div><div class="big" style="font-size:34px">${money(snapNw(s))}</div></div>
    <div class="card">${stackBar(parts)}<div class="legend">${parts.map(p => `<div class="row"><span class="dot" style="background:${p.c}"></span><div class="main">${p.l}</div><div class="val">${money(p.v)}</div></div>`).join('')}
      ${+s.liabilities ? `<div class="row"><span class="dot" style="background:var(--neg)"></span><div class="main">Debt</div><div class="val neg">${money(-s.liabilities)}</div></div>` : ''}</div></div>
    ${s.comments?.length ? `<div class="card"><h3>Notes</h3><ul class="comments">${s.comments.map(c => `<li>${esc(c)}</li>`).join('')}</ul></div>` : ''}
    ${s.holdings?.length ? `<div class="card"><h3>Breakdown</h3>${s.holdings.map(([n, v, c]) => `<div class="rider"><span>${esc(n)}</span><span class="num">${money(v, 2)}${c ? ` <span class="small ${v >= c ? 'pos' : 'neg'}">${pct(v / c - 1)}</span>` : ''}</span></div>`).join('')}</div>` : ''}
    ${s.debts?.length ? `<div class="card"><h3>Debts</h3>${s.debts.map(([n, v]) => `<div class="rider"><span>${esc(n)}</span><span class="num">${money(v, 2)}</span></div>`).join('')}</div>` : ''}
    <div class="btns"><button class="btn ghost" data-act="editSnap" data-id="${s.id}">Edit</button><button class="btn danger" data-act="deleteSnap" data-id="${s.id}">Delete</button></div>`;
  openSheet(fmtDate(s.date), body);
}
function editSnap(id) {
  const s = S.snapshots.find(x => x.id === id);
  const fields = [{ k: 'date', label: 'Date', type: 'date' },
    { k: 'cash', label: 'Cash', type: 'number' }, { k: 'investments', label: 'Investments', type: 'number' },
    { k: 'cpf', label: 'CPF', type: 'number' }, { k: 'other', label: 'Property & other', type: 'number' },
    { k: 'liabilities', label: 'Debt', type: 'number' }, { k: 'commentsText', label: 'Notes — one per line', type: 'textarea' }];
  editForm('Edit snapshot', fields, { ...s, commentsText: (s.comments || []).join('\n') }, v => {
    v.comments = v.commentsText.split('\n').map(x => x.trim()).filter(Boolean); delete v.commentsText;
    for (const k of ['cash', 'investments', 'cpf', 'other', 'liabilities']) v[k] = v[k] || 0;
    Object.assign(s, v);
  });
}

/* ---------- backup ---------- */

async function exportData() {
  const name = `wealth-backup-${today()}.json`;
  const blob = new Blob([JSON.stringify(S, null, 2)], { type: 'application/json' });
  const file = new File([blob], name, { type: 'application/json' });
  if (navigator.canShare?.({ files: [file] })) {
    try { await navigator.share({ files: [file], title: name }); return; } catch (e) { if (e.name === 'AbortError') return; }
  }
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob); a.download = name; a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 2000);
}
function importData() {
  const inp = document.createElement('input');
  inp.type = 'file'; inp.accept = 'application/json,.json';
  inp.onchange = async () => {
    try {
      const d = JSON.parse(await inp.files[0].text());
      if (!Array.isArray(d.accounts) || !Array.isArray(d.snapshots)) throw new Error('bad');
      if (S.accounts.length && !confirm('Replace all data on this device with this backup?')) return;
      S = normalise(d); save(); ui.page = null; ui.tab = 'home'; render(); toast('Backup imported');
    } catch { toast("That file isn't a Wealth backup"); }
  };
  inp.click();
}
function normalise(d) {
  const b = blank();
  return { ...b, ...d, profile: { ...b.profile, ...d.profile }, forecast: { ...b.forecast, ...d.forecast },
    budget: { ...b.budget, ...d.budget }, prefs: { ...b.prefs, ...d.prefs } };
}

/* ---------- events ---------- */

function toast(msg) {
  const t = $('#toast'); t.textContent = msg; t.classList.add('on');
  clearTimeout(toast.h); toast.h = setTimeout(() => t.classList.remove('on'), 1800);
}
function applyTheme() {
  const th = S.prefs?.theme;
  if (th === 'light' || th === 'dark') document.documentElement.dataset.theme = th;
  else delete document.documentElement.dataset.theme;
}

const ACT = {
  tab: id => { ui.tab = id; ui.page = null; render(); },
  page: id => { ui.page = id; render(); },
  back: () => { ui.page = null; render(); },
  range: id => { ui.range = id; render(true); },
  toggleHide: () => { S.prefs.hide = !S.prefs.hide; save(); render(true); },
  theme: id => { S.prefs.theme = id; save(); applyTheme(); render(true); },
  addAccount: g => editAccount(null, g), editAccount: id => editAccount(id),
  addDebt: () => editDebt(null), editDebt: id => editDebt(id),
  addGoal: () => editGoal(null), editGoal: id => editGoal(id),
  addPolicy: () => editPolicy(null), editPolicy: id => editPolicy(id),
  addIncome: () => editIncome(null), editIncome: id => editIncome(id),
  addBucket: () => editBucket(undefined), editBucket: i => editBucket(i),
  snapshot: saveSnapshot, viewSnap, editSnap,
  deleteSnap: id => { if (confirm('Delete this snapshot?')) { S.snapshots = S.snapshots.filter(s => s.id !== id); save(); closeSheet(); render(true); } },
  closeSheet, sheetSave: () => sheetSave?.onSave?.(), sheetDelete: () => sheetSave?.onDelete?.(),
  exportData, importData,
  resetAll: () => { if (confirm('Erase everything on this device? Export a backup first if you might need it.')) { S = blank(); save(); ui.page = null; ui.tab = 'home'; render(); } },
};

document.addEventListener('click', e => {
  const b = e.target.closest('[data-act], #tabbar button');
  if (!b) return;
  if (b.dataset.tab) return ACT.tab(b.dataset.tab);
  ACT[b.dataset.act]?.(b.dataset.id, b);
});
$('#backdrop').addEventListener('click', closeSheet);

document.addEventListener('change', e => {
  const el = e.target;
  if (el.dataset.f) {
    const k = el.dataset.f;
    S.forecast[k] = el.type === 'checkbox' ? el.checked : (el.value === '' ? 0 : parseFloat(el.value));
    save(); render(true);
  } else if (el.dataset.p) {
    S.profile[el.dataset.p] = el.type === 'number' ? parseFloat(el.value) || 0 : el.value.trim();
    save();
  } else if (el.dataset.b) {
    S.budget[el.dataset.b] = parseFloat(el.value) || 0; save(); render(true);
  }
});
let notesTimer;
document.addEventListener('input', e => {
  if (e.target.matches('[data-notes]')) {
    clearTimeout(notesTimer);
    notesTimer = setTimeout(() => { S.notes = e.target.value; save(); }, 400);
  }
});

/* ---------- boot ---------- */

async function loadSeed() {
  // Only present when running from the project folder; a hosted copy of /app has no data file.
  try { const r = await fetch('../my-data.json', { cache: 'no-store' }); if (r.ok) return await r.json(); } catch { }
  return null;
}

(async function init() {
  try { S = JSON.parse(localStorage.getItem(KEY)); } catch { S = null; }
  if (!S) { S = (await loadSeed()) || blank(); }
  S = normalise(S); save();
  applyTheme(); render();
  if (navigator.storage?.persist) navigator.storage.persist().catch(() => { });
  if ('serviceWorker' in navigator && (location.protocol === 'https:' || location.hostname === 'localhost')) {
    navigator.serviceWorker.register('sw.js').catch(() => { });
  }
})();
